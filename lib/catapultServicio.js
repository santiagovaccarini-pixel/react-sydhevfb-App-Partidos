// Salida única hacia el servicio interno de actividad de Catapult. Solo dos
// operaciones, atadas a la ruta de UNA actividad: leerla (GET) y escribir su
// batch (PUT). Ningún otro método ni ruta puede salir por acá.

import { ACTIVITY_SERVICE_BASE_DEFAULT } from "./catapultInternal.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const baseServicioActividad = () =>
  String(process.env.OPENFIELD_ACTIVITY_SERVICE_BASE_URL || ACTIVITY_SERVICE_BASE_DEFAULT).replace(/\/+$/, "");

const pedir = async ({ metodo, ruta, autorizacion, body, timeoutMs }) => {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), timeoutMs);
  const inicio = Date.now();

  try {
    const upstream = await fetch(`${baseServicioActividad()}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: autorizacion,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controlador.signal,
      redirect: "manual",
    });

    const texto = await upstream.text();
    let payload = null;
    try {
      payload = texto ? JSON.parse(texto) : null;
    } catch {
      payload = null;
    }

    return {
      status: upstream.status,
      ok: upstream.ok,
      ms: Date.now() - inicio,
      contentType: upstream.headers.get("content-type") || "",
      texto,
      payload,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      ms: Date.now() - inicio,
      contentType: "",
      texto: "",
      payload: null,
      error: error?.name === "AbortError" ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const validarActivityId = (valor) => (UUID.test(String(valor || "").trim()) ? String(valor).trim() : "");

export const leerActividadInterna = ({ autorizacion, activityId, timeoutMs = 9000 }) => {
  const id = validarActivityId(activityId);
  if (!id) throw new Error("activityId inválido.");
  return pedir({ metodo: "GET", ruta: `/activities/${id}`, autorizacion, timeoutMs });
};

export const escribirBatchInterno = ({ autorizacion, activityId, batch, timeoutMs = 15000 }) => {
  const id = validarActivityId(activityId);
  if (!id) throw new Error("activityId inválido.");
  if (!batch || !Array.isArray(batch.periods)) throw new Error("El batch no tiene períodos.");
  return pedir({ metodo: "PUT", ruta: `/activities/${id}/batch`, autorizacion, body: batch, timeoutMs });
};
