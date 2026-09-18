import { autenticarCookieOpenField } from "../../lib/openfieldAuth.js";
import {
  METODOS_SONDA,
  describirCuerpo,
  interpretarRespuesta,
  resumirSonda,
  rutasSonda,
} from "../../lib/openfieldProbe.js";

export const config = {
  maxDuration: 30,
};

const OPENFIELD_BASE_URL =
  process.env.OPENFIELD_API_BASE_URL ||
  "https://connect-us.catapultsports.com/api/v6";

// 26-05 T: la única actividad autorizada para pruebas.
const ACTIVIDAD_PRUEBA_ID = "9dffa100-99e5-4ce6-921f-226e9e01e264";

// OPENFIELD_API_TOKEN es el token en uso. OPENFIELD_API_TOKEN_WRITE es opcional:
// permite comparar un segundo token (por ejemplo con otros scopes) sin pisar el primero.
const TOKENS = [
  { clave: "principal", env: "OPENFIELD_API_TOKEN" },
  { clave: "alternativo", env: "OPENFIELD_API_TOKEN_WRITE" },
];

const TIMEOUT_RUTA_MS = 8000;
const TIMEOUT_CONTROL_MS = 9000;

const normalizarActivityId = (valor) => {
  const candidato = Array.isArray(valor) ? valor[0] : valor;
  const id = String(candidato || "").trim();
  if (!id) return ACTIVIDAD_PRUEBA_ID;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : "";
};

const normalizarPeriodId = (valor) => {
  const candidato = Array.isArray(valor) ? valor[0] : valor;
  const id = String(candidato || "").trim();
  return /^[0-9a-zA-Z-]{1,64}$/.test(id) ? id : "";
};

const normalizarLista = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.activities)) return payload.activities;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

// Única puerta de salida hacia OpenField. Rechaza cualquier método que no sea
// GET u OPTIONS: la sonda no puede crear, editar ni borrar por construcción.
const solicitar = async ({ metodo, ruta, token, timeoutMs }) => {
  if (!METODOS_SONDA.includes(metodo)) {
    throw new Error(`La sonda no envía ${metodo}: solo GET y OPTIONS.`);
  }

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), timeoutMs);
  const inicio = Date.now();

  try {
    const upstream = await fetch(`${OPENFIELD_BASE_URL}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controlador.signal,
      redirect: "manual",
    });

    const texto = await upstream.text();

    return {
      status: upstream.status,
      ms: Date.now() - inicio,
      allow: upstream.headers.get("allow") || "",
      corsMethods: upstream.headers.get("access-control-allow-methods") || "",
      contentType: upstream.headers.get("content-type") || "",
      texto,
    };
  } catch (error) {
    return {
      status: 0,
      ms: Date.now() - inicio,
      allow: "",
      corsMethods: "",
      contentType: "",
      texto: "",
      error: error?.name === "AbortError" ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timeout);
  }
};

// Lectura de control por la ruta que ya funciona en producción. Sirve para
// confirmar token + base URL y para descubrir un período real de la actividad.
const leerControl = async ({ token, activityId }) => {
  const respuesta = await solicitar({
    metodo: "GET",
    ruta: "/activities",
    token,
    timeoutMs: TIMEOUT_CONTROL_MS,
  });

  let payload = null;
  try {
    payload = respuesta.texto ? JSON.parse(respuesta.texto) : null;
  } catch {
    payload = null;
  }

  const actividad = normalizarLista(payload).find(
    (item) => String(item?.id || "") === activityId,
  );
  const periodos = Array.isArray(actividad?.periods) ? actividad.periods : [];

  return {
    ruta: "/activities",
    status: respuesta.status,
    ms: respuesta.ms,
    ok: respuesta.status >= 200 && respuesta.status < 300,
    actividadEncontrada: Boolean(actividad),
    actividadNombre: actividad ? String(actividad.name || actividad.activity_name || "") : "",
    periodos: periodos.length,
    primerPeriodoId: periodos[0]?.id ? String(periodos[0].id) : "",
    ...(respuesta.error ? { error: respuesta.error } : {}),
  };
};

const sondearToken = async ({ token, rutas }) => {
  const respuestas = await Promise.all(
    rutas.map((ruta) =>
      solicitar({ metodo: ruta.metodo, ruta: ruta.ruta, token, timeoutMs: TIMEOUT_RUTA_MS }),
    ),
  );

  const resultados = rutas.map((ruta, indice) => {
    const respuesta = respuestas[indice];
    const interpretacion = interpretarRespuesta(respuesta);

    return {
      clave: ruta.clave,
      metodo: ruta.metodo,
      ruta: ruta.ruta,
      status: respuesta.status,
      ms: respuesta.ms,
      contentType: respuesta.contentType,
      ...interpretacion,
      cuerpo: describirCuerpo(respuesta.texto),
      ...(respuesta.error ? { error: respuesta.error } : {}),
    };
  });

  return { resultados, resumen: resumirSonda(resultados) };
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

  const periodIdSolicitado = normalizarPeriodId(request.query?.periodId);

  const tokens = TOKENS.map((definicion) => ({
    ...definicion,
    configurado: Boolean(process.env[definicion.env]),
  }));
  const disponibles = tokens.filter((definicion) => definicion.configurado);

  if (disponibles.length === 0) {
    return response.status(500).json({
      ok: false,
      error: "No hay ningún token de OpenField configurado en el servidor.",
      tokens: tokens.map(({ clave, env, configurado }) => ({ clave, env, configurado })),
    });
  }

  const control = await leerControl({
    token: process.env[disponibles[0].env],
    activityId,
  });

  const periodId = periodIdSolicitado || control.primerPeriodoId;
  const rutas = rutasSonda({ activityId, periodId });

  const sondas = await Promise.all(
    disponibles.map(async (definicion) => {
      const sonda = await sondearToken({ token: process.env[definicion.env], rutas });
      return [definicion.clave, sonda];
    }),
  );

  return response.status(200).json({
    ok: true,
    probe: "capability-read-only",
    version: "capability-probe-v1",
    metodosEnviados: METODOS_SONDA,
    baseUrl: OPENFIELD_BASE_URL,
    activityId,
    periodId: periodId || null,
    tokens: tokens.map(({ clave, env, configurado }) => ({ clave, env, configurado })),
    control: { token: disponibles[0].clave, ...control },
    sondas: Object.fromEntries(sondas),
  });
}
