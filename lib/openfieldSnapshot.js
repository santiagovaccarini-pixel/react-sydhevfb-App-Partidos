// Snapshot de una actividad por la Connect API (solo GET): actividad, plantel,
// períodos con centésimas y participantes de cada período, más una huella
// del estado. Lo usan el endpoint de snapshot y el write test para comparar
// antes y después de escribir.

import { createHash } from "node:crypto";
import {
  huellaSnapshot,
  limpiarAtleta,
  limpiarPeriodo,
  ordenarPeriodos,
} from "./openfieldPeriods.js";

export const OPENFIELD_CONNECT_BASE_DEFAULT = "https://connect-us.catapultsports.com/api/v6";

const TIMEOUT_MS = 9000;

const listaAtletas = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.athletes)) return payload.athletes;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

// Única salida hacia Connect desde acá: GET y nada más.
export const leerJsonConnect = async ({ url, token, timeoutMs = TIMEOUT_MS }) => {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const upstream = await fetch(url, {
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

export const tomarSnapshotConnect = async ({ token, activityId, baseUrl }) => {
  const base = String(baseUrl || OPENFIELD_CONNECT_BASE_DEFAULT).replace(/\/+$/, "");
  const rutaActividad = `${base}/activities/${encodeURIComponent(activityId)}`;

  // La actividad trae los períodos con centésimas; los participantes de cada
  // período viven en /periods/{id}/athletes (comprobado con la sonda).
  const [actividad, plantel] = await Promise.all([
    leerJsonConnect({ url: rutaActividad, token }),
    leerJsonConnect({ url: `${rutaActividad}/athletes`, token }),
  ]);

  if (actividad.status === 404) {
    return {
      ok: false,
      status: 404,
      error: "La actividad seleccionada ya no aparece en OpenField.",
    };
  }

  if (!actividad.ok || !actividad.payload?.id) {
    return {
      ok: false,
      status: actividad.error === "timeout" ? 504 : 502,
      upstreamStatus: actividad.status,
      error: "No se pudo leer la actividad para tomar el snapshot.",
    };
  }

  const periodos = (Array.isArray(actividad.payload.periods) ? actividad.payload.periods : [])
    .map(limpiarPeriodo)
    .filter((periodo) => periodo.id)
    .sort(ordenarPeriodos);

  const participantes = await Promise.all(
    periodos.map((periodo) =>
      leerJsonConnect({ url: `${base}/periods/${encodeURIComponent(periodo.id)}/athletes`, token }),
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

  return {
    ok: true,
    snapshot: {
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
    },
  };
};
