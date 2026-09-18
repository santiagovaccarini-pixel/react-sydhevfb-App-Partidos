import { autenticarCookieOpenField } from "../../lib/openfieldAuth.js";

const OPENFIELD_BASE_URL =
  process.env.OPENFIELD_API_BASE_URL ||
  "https://connect-us.catapultsports.com/api/v6";

const normalizarActivityId = (valor) => {
  const candidato = Array.isArray(valor) ? valor[0] : valor;
  const id = String(candidato || "").trim();
  if (!id || id.length > 128) return "";
  return id;
};

// OpenField guarda cada tiempo como segundos Unix + centésimas (0-99).
// La resolución real es 10 ms: cualquier comparación exacta tiene que hacerse
// sobre esta suma y no sobre start_time solo, que trunca al segundo.
const centesimas = (valor) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 && numero < 100 ? numero : null;
};

const aMilisegundos = (segundos, centi) => {
  const base = Number(segundos);
  if (!Number.isFinite(base)) return null;
  return base * 1000 + (centesimas(centi) ?? 0) * 10;
};

const limpiarPeriodo = (periodo) => {
  const startMs = aMilisegundos(periodo?.start_time, periodo?.start_centiseconds);
  const endMs = aMilisegundos(periodo?.end_time, periodo?.end_centiseconds);
  const duracionValida = startMs !== null && endMs !== null && endMs >= startMs;

  return {
    id: String(periodo?.id || ""),
    name: String(periodo?.name || periodo?.period_name || "Sin nombre"),
    start_time: periodo?.start_time ?? null,
    end_time: periodo?.end_time ?? null,
    start_centiseconds: centesimas(periodo?.start_centiseconds),
    end_centiseconds: centesimas(periodo?.end_centiseconds),
    start_ms: startMs,
    end_ms: endMs,
    duration_seconds: duracionValida ? (endMs - startMs) / 1000 : null,
    // Los períodos forman un árbol (nested set): lft/rgt ordenan padres e hijos.
    period_depth_id: periodo?.period_depth_id ?? null,
    lft: periodo?.lft ?? null,
    rgt: periodo?.rgt ?? null,
  };
};

const ordenarPeriodos = (a, b) =>
  Number(a.start_ms || 0) - Number(b.start_ms || 0) || Number(a.lft || 0) - Number(b.lft || 0);

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
