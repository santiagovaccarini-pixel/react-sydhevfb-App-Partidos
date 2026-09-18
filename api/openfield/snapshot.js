import { createHash } from "node:crypto";
import { autenticarCookieOpenField } from "../../lib/openfieldAuth.js";
import {
  huellaSnapshot,
  limpiarAtleta,
  limpiarPeriodo,
  ordenarPeriodos,
} from "../../lib/openfieldPeriods.js";

export const config = {
  maxDuration: 30,
};

const OPENFIELD_BASE_URL =
  process.env.OPENFIELD_API_BASE_URL ||
  "https://connect-us.catapultsports.com/api/v6";

const TIMEOUT_MS = 9000;

const normalizarActivityId = (valor) => {
  const candidato = Array.isArray(valor) ? valor[0] : valor;
  const id = String(candidato || "").trim();
  if (!id || id.length > 128) return "";
  return id;
};

const listaAtletas = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.athletes)) return payload.athletes;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

// Única salida hacia OpenField: GET y nada más.
const leerJson = async ({ ruta, token }) => {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(`${OPENFIELD_BASE_URL}${ruta}`, {
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

    return { status: upstream.status, ok: upstream.ok, payload };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      payload: null,
      error: error?.name === "AbortError" ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timeout);
  }
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Cookie");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const auth = autenticarCookieOpenField(request);
  if (!auth.ok) {
    return response.status(auth.status).json({ ok: false, error: auth.error });
  }

  const activityId = normalizarActivityId(request.query?.activityId);
  if (!activityId) {
    return response.status(400).json({ ok: false, error: "Falta un activityId válido." });
  }

  const token = process.env.OPENFIELD_API_TOKEN;
  if (!token) {
    return response.status(500).json({
      ok: false,
      error: "OPENFIELD_API_TOKEN no está configurado en el servidor.",
    });
  }

  const rutaActividad = `/activities/${encodeURIComponent(activityId)}`;

  // La actividad trae los períodos con centésimas; los participantes de cada
  // período viven en /periods/{id}/athletes (comprobado con la sonda).
  const [actividad, plantel] = await Promise.all([
    leerJson({ ruta: rutaActividad, token }),
    leerJson({ ruta: `${rutaActividad}/athletes`, token }),
  ]);

  if (actividad.status === 404) {
    return response.status(404).json({
      ok: false,
      error: "La actividad seleccionada ya no aparece en OpenField.",
    });
  }

  if (!actividad.ok || !actividad.payload?.id) {
    return response.status(actividad.error === "timeout" ? 504 : 502).json({
      ok: false,
      error: "No se pudo leer la actividad para tomar el snapshot.",
      upstreamStatus: actividad.status,
    });
  }

  const periodos = (Array.isArray(actividad.payload.periods) ? actividad.payload.periods : [])
    .map(limpiarPeriodo)
    .filter((periodo) => periodo.id)
    .sort(ordenarPeriodos);

  const participantes = await Promise.all(
    periodos.map((periodo) =>
      leerJson({ ruta: `/periods/${encodeURIComponent(periodo.id)}/athletes`, token }),
    ),
  );

  let incompleto = !plantel.ok;

  const periodosConAtletas = periodos.map((periodo, indice) => {
    const lectura = participantes[indice];

    if (!lectura.ok) {
      incompleto = true;
      return { ...periodo, athletes: null, athlete_count: null, athletes_status: lectura.status };
    }

    const athletes = listaAtletas(lectura.payload)
      .map(limpiarAtleta)
      .filter((atleta) => atleta.id);

    return { ...periodo, athletes, athlete_count: athletes.length };
  });

  const snapshot = {
    activity: {
      id: String(actividad.payload.id),
      name: String(actividad.payload.name || actividad.payload.activity_name || "Sin nombre"),
      start_time: actividad.payload.start_time ?? null,
      end_time: actividad.payload.end_time ?? null,
      timezone: actividad.payload.timezone ?? null,
      modified_at: actividad.payload.modified_at ?? null,
    },
    periods: periodosConAtletas,
  };

  const huella = createHash("sha256").update(huellaSnapshot(snapshot)).digest("hex");

  return response.status(200).json({
    ok: true,
    source: "catapult-connect",
    version: "snapshot-v1",
    tomado_en: new Date().toISOString(),
    resolution_ms: 10,
    activity: snapshot.activity,
    athletes: plantel.ok
      ? listaAtletas(plantel.payload)
          .map(limpiarAtleta)
          .filter((atleta) => atleta.id)
      : null,
    count: periodosConAtletas.length,
    periods: periodosConAtletas,
    incompleto,
    huella,
  });
}
