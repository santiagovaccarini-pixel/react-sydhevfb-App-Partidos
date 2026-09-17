import { autenticarCookieOpenField } from "../../lib/openfieldAuth.js";

const OPENFIELD_BASE_URL =
  process.env.OPENFIELD_API_BASE_URL ||
  "https://connect-us.catapultsports.com/api/v6";

const normalizarLista = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.activities)) return payload.activities;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const normalizarActivityId = (valor) => {
  const candidato = Array.isArray(valor) ? valor[0] : valor;
  const id = String(candidato || "").trim();
  if (!id || id.length > 128) return "";
  return id;
};

const limpiarPeriodo = (periodo) => {
  const inicio = Number(periodo?.start_time);
  const fin = Number(periodo?.end_time);
  const duracionValida = Number.isFinite(inicio) && Number.isFinite(fin) && fin >= inicio;

  return {
    id: String(periodo?.id || ""),
    name: String(periodo?.name || periodo?.period_name || "Sin nombre"),
    start_time: periodo?.start_time ?? null,
    end_time: periodo?.end_time ?? null,
    duration_seconds: duracionValida ? fin - inicio : null,
  };
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Cookie");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({
      ok: false,
      error: "Método no permitido",
    });
  }

  const auth = autenticarCookieOpenField(request);
  if (!auth.ok) {
    return response.status(auth.status).json({ ok: false, error: auth.error });
  }

  const activityId = normalizarActivityId(request.query?.activityId);
  if (!activityId) {
    return response.status(400).json({
      ok: false,
      error: "Falta un activityId válido.",
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
    // Connect documenta los períodos dentro de cada elemento devuelto por /activities.
    // No usamos una ruta no documentada de escritura ni asumimos /activities/:id.
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
        error: "OpenField rechazó la consulta de períodos.",
        upstreamStatus: upstream.status,
      });
    }

    const actividad = normalizarLista(payload).find(
      (item) => String(item?.id || "") === activityId,
    );

    if (!actividad) {
      return response.status(404).json({
        ok: false,
        error: "La actividad seleccionada ya no aparece en OpenField.",
      });
    }

    const periods = (Array.isArray(actividad?.periods) ? actividad.periods : [])
      .map(limpiarPeriodo)
      .filter((periodo) => periodo.id)
      .sort((a, b) => Number(a.start_time || 0) - Number(b.start_time || 0));

    return response.status(200).json({
      ok: true,
      source: "catapult-connect",
      version: "periods-read-v1-authenticated",
      activity: {
        id: String(actividad?.id || ""),
        name: String(actividad?.name || actividad?.activity_name || "Sin nombre"),
        start_time: actividad?.start_time ?? null,
        end_time: actividad?.end_time ?? null,
      },
      count: periods.length,
      periods,
    });
  } catch (error) {
    const esTimeout = error?.name === "AbortError";

    return response.status(esTimeout ? 504 : 502).json({
      ok: false,
      error: esTimeout
        ? "OpenField demoró demasiado en responder al leer los períodos."
        : "No se pudieron leer los períodos de OpenField.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
