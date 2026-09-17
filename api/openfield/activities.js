const OPENFIELD_BASE_URL =
  process.env.OPENFIELD_API_BASE_URL ||
  "https://connect-us.catapultsports.com/api/v6";

const limpiarActividad = (actividad) => ({
  id: actividad?.id || "",
  name: actividad?.name || actividad?.activity_name || "Sin nombre",
  start_time: actividad?.start_time ?? null,
  end_time: actividad?.end_time ?? null,
  venue: actividad?.venue?.name || actividad?.venue_name || "",
  period_count: Array.isArray(actividad?.periods) ? actividad.periods.length : 0,
  tag_list: Array.isArray(actividad?.tag_list) ? actividad.tag_list : [],
});

const normalizarLista = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.activities)) return payload.activities;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({
      ok: false,
      error: "Método no permitido",
    });
  }

  const token = process.env.OPENFIELD_API_TOKEN;

  if (!token) {
    return response.status(500).json({
      ok: false,
      error: "OPENFIELD_API_TOKEN no está configurado en el servidor.",
    });
  }

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 9000);

  try {
    const upstream = await fetch(`${OPENFIELD_BASE_URL}/activities`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controlador.signal,
    });

    const texto = await upstream.text();
    let payload = null;

    try {
      payload = texto ? JSON.parse(texto) : null;
    } catch {
      payload = null;
    }

    if (!upstream.ok) {
      return response.status(502).json({
        ok: false,
        error: "OpenField rechazó la consulta de actividades.",
        upstreamStatus: upstream.status,
      });
    }

    const actividades = normalizarLista(payload)
      .map(limpiarActividad)
      .filter((actividad) => actividad.id)
      .sort((a, b) => Number(b.start_time || 0) - Number(a.start_time || 0));

    return response.status(200).json({
      ok: true,
      source: "catapult-connect",
      count: actividades.length,
      activities: actividades,
    });
  } catch (error) {
    const esTimeout = error?.name === "AbortError";

    return response.status(esTimeout ? 504 : 502).json({
      ok: false,
      error: esTimeout
        ? "OpenField demoró demasiado en responder."
        : "No se pudo conectar con OpenField.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
