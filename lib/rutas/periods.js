import { autenticarCookieOpenField } from "../openfieldAuth.js";
import { limpiarPeriodo, ordenarPeriodos } from "../openfieldPeriods.js";

const OPENFIELD_BASE_URL =
  process.env.OPENFIELD_API_BASE_URL ||
  "https://connect-us.catapultsports.com/api/v6";

const normalizarActivityId = (valor) => {
  const candidato = Array.isArray(valor) ? valor[0] : valor;
  const id = String(candidato || "").trim();
  if (!id || id.length > 128) return "";
  return id;
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
    // GET /activities/{id} existe y devuelve la actividad con sus períodos
    // (segundos + centésimas). Comprobado con la sonda de capacidades sobre
    // 26-05 T: misma unidad y mismos períodos que el listado, sin bajar las
    // demás actividades.
    const upstream = await fetch(
      `${OPENFIELD_BASE_URL}/activities/${encodeURIComponent(activityId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: controlador.signal,
      },
    );

    const texto = await upstream.text();
    let payload = null;

    try {
      payload = texto ? JSON.parse(texto) : null;
    } catch {
      payload = null;
    }

    if (upstream.status === 404) {
      return response.status(404).json({
        ok: false,
        error: "La actividad seleccionada ya no aparece en OpenField.",
      });
    }

    if (!upstream.ok) {
      return response.status(502).json({
        ok: false,
        error: "OpenField rechazó la consulta de períodos.",
        upstreamStatus: upstream.status,
      });
    }

    const actividad = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : null;

    if (!actividad?.id) {
      return response.status(502).json({
        ok: false,
        error: "OpenField devolvió la actividad sin datos reconocibles.",
      });
    }

    const periods = (Array.isArray(actividad.periods) ? actividad.periods : [])
      .map(limpiarPeriodo)
      .filter((periodo) => periodo.id)
      .sort(ordenarPeriodos);

    return response.status(200).json({
      ok: true,
      source: "catapult-connect",
      version: "periods-read-v2-activity",
      route: "/activities/{id}",
      resolution_ms: 10,
      activity: {
        id: String(actividad.id),
        name: String(actividad.name || actividad.activity_name || "Sin nombre"),
        start_time: actividad.start_time ?? null,
        end_time: actividad.end_time ?? null,
        timezone: actividad.timezone ?? null,
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
