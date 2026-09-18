import { randomUUID } from "node:crypto";
import { autenticarCookieOpenField } from "../../lib/openfieldAuth.js";
import {
  ACTIVIDAD_PRUEBA,
  abrirNavegador,
  cerrarNavegador,
  clasificarErrorNavegador,
  iniciarSesionCatapult,
  leerBodyJson,
  resumirError,
  textoSeguro,
} from "../../lib/catapultCloud.js";
import { describirAutorizacion } from "../../lib/catapultInspect.js";
import { ACTIVITY_SERVICE_BASE_DEFAULT, extraerTokenOauth } from "../../lib/catapultInternal.js";
import {
  armarBatch,
  armarPeriodoNuevo,
  elegirNombreLibre,
  elegirVentanaPrueba,
  idsAtletas,
  normalizarInterno,
  validarEscrituraBatch,
  veredictoEscritura,
} from "../../lib/catapultWrite.js";
import { describirCuerpo } from "../../lib/openfieldProbe.js";
import { tomarSnapshotConnect } from "../../lib/openfieldSnapshot.js";

export const config = {
  maxDuration: 60,
};

const TIMEOUT_LECTURA_MS = 9000;
const TIMEOUT_ESCRITURA_MS = 15000;
const ESPERA_REPROCESO_MS = 2500;

const baseServicio = () =>
  String(process.env.OPENFIELD_ACTIVITY_SERVICE_BASE_URL || ACTIVITY_SERVICE_BASE_DEFAULT).replace(
    /\/+$/,
    "",
  );

// Único punto de la app que puede enviar una escritura a OpenField. Está
// atado a la actividad de prueba: cualquier otra ruta se rechaza antes de
// salir a la red.
const pedirInterno = async ({ metodo, ruta, autorizacion, body, timeoutMs }) => {
  if (!ruta.startsWith(`/activities/${ACTIVIDAD_PRUEBA.id}`)) {
    throw new Error(`Modo prueba: solo se opera sobre ${ACTIVIDAD_PRUEBA.name}.`);
  }
  if (metodo !== "GET" && metodo !== "PUT") {
    throw new Error(`Modo prueba: método ${metodo} no permitido.`);
  }

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), timeoutMs);
  const inicio = Date.now();

  try {
    const upstream = await fetch(`${baseServicio()}${ruta}`, {
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

const resumirConnect = (snapshot) => ({
  count: snapshot.count,
  huella: snapshot.huella,
  incompleto: snapshot.incompleto,
  periods: snapshot.periods,
});

// Primer write test, Modo Prueba: login → pase → snapshot por las dos vías →
// UN período nuevo por el batch del servicio interno → relectura → comparación.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Cookie");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const auth = autenticarCookieOpenField(request);
  if (!auth.ok) {
    return response.status(auth.status).json({ ok: false, error: auth.error });
  }

  const body = leerBodyJson(request);
  const username = textoSeguro(body?.username, 254);
  const password = textoSeguro(body?.password, 512);
  const confirmacion = textoSeguro(body?.confirmacion, 64);

  if (!username || !password) {
    return response.status(400).json({
      ok: false,
      error: "Completá usuario y contraseña de Catapult.",
    });
  }

  if (confirmacion !== ACTIVIDAD_PRUEBA.name) {
    return response.status(400).json({
      ok: false,
      code: "CONFIRMACION_INVALIDA",
      error: `Para escribir tenés que confirmar escribiendo exactamente "${ACTIVIDAD_PRUEBA.name}".`,
    });
  }

  const connectToken = process.env.OPENFIELD_API_TOKEN;
  if (!connectToken) {
    return response.status(500).json({
      ok: false,
      error: "OPENFIELD_API_TOKEN no está configurado en el servidor.",
    });
  }

  const activityId = ACTIVIDAD_PRUEBA.id;
  const rutaActividad = `/activities/${activityId}`;
  let nav = null;
  let etapa = "inicio";
  let pase = null;

  try {
    etapa = "lanzar-navegador";
    nav = await abrirNavegador();

    nav.page.on("response", async (res) => {
      try {
        const url = new URL(res.url());
        if (!/\/oauth\/token$/.test(url.pathname)) return;
        if (res.status() < 200 || res.status() >= 300) return;
        const extraido = extraerTokenOauth(JSON.parse(await res.text()));
        if (extraido) pase = extraido;
      } catch {
        // Respuesta no legible: se sigue esperando otra.
      }
    });

    etapa = "login";
    const login = await iniciarSesionCatapult(nav.page, { username, password });
    if (!login.ok) {
      return response.status(login.status).json({
        ok: false,
        code: login.code,
        error: login.error,
        etapa,
      });
    }

    etapa = "capturar-pase";
    for (let intento = 0; intento < 10 && !pase; intento += 1) {
      await nav.page.waitForTimeout(300);
    }

    await cerrarNavegador(nav);
    nav = null;

    if (!pase) {
      return response.status(502).json({
        ok: false,
        code: "SIN_PASE",
        error: "El login terminó pero no se vio la respuesta de /oauth/token. No se escribió nada.",
        etapa,
      });
    }

    const autorizacion = `${pase.tokenType} ${pase.accessToken}`;
    const descripcionPase = describirAutorizacion({ authorization: autorizacion });

    etapa = "leer-antes";
    const [internoAntesRaw, connectAntes] = await Promise.all([
      pedirInterno({
        metodo: "GET",
        ruta: rutaActividad,
        autorizacion,
        timeoutMs: TIMEOUT_LECTURA_MS,
      }),
      tomarSnapshotConnect({
        token: connectToken,
        activityId,
        baseUrl: process.env.OPENFIELD_API_BASE_URL,
      }),
    ]);

    if (!internoAntesRaw.ok || !internoAntesRaw.payload?.id) {
      return response.status(502).json({
        ok: false,
        code: "INTERNO_NO_LEGIBLE",
        error: "El servicio interno no devolvió la actividad antes de escribir. No se escribió nada.",
        etapa,
        upstreamStatus: internoAntesRaw.status,
      });
    }

    if (!connectAntes.ok) {
      return response.status(connectAntes.status).json({
        ok: false,
        code: "CONNECT_NO_LEGIBLE",
        error: `${connectAntes.error} No se escribió nada.`,
        etapa,
      });
    }

    if (connectAntes.snapshot.incompleto) {
      return response.status(409).json({
        ok: false,
        code: "SNAPSHOT_INCOMPLETO",
        error:
          "El snapshot previo quedó incompleto (faltan participantes de algún período). No se escribió nada.",
        etapa,
      });
    }

    const internoAntes = normalizarInterno(internoAntesRaw.payload);

    etapa = "preparar";
    const nombre = elegirNombreLibre(internoAntes.periods);
    if (!nombre) {
      return response.status(409).json({
        ok: false,
        code: "SIN_NOMBRE_LIBRE",
        error: "No queda ningún nombre TEST APP NN libre. No se escribió nada.",
        etapa,
      });
    }

    const ventana = elegirVentanaPrueba({
      inicioActividadMs: internoAntes.activity.start_ms,
      finActividadMs: internoAntes.activity.end_ms,
    });
    if (ventana.error) {
      return response.status(409).json({
        ok: false,
        code: "VENTANA_INVALIDA",
        error: `${ventana.error} No se escribió nada.`,
        etapa,
      });
    }

    const fuente = (Array.isArray(internoAntesRaw.payload.periods)
      ? internoAntesRaw.payload.periods
      : [])[0];
    const athletes = Array.isArray(fuente?.athletes) ? fuente.athletes : [];
    if (athletes.length === 0) {
      return response.status(409).json({
        ok: false,
        code: "SIN_PARTICIPANTES",
        error: "El primer período no tiene participantes para copiar. No se escribió nada.",
        etapa,
      });
    }

    const nuevo = armarPeriodoNuevo({
      id: randomUUID(),
      nombre,
      startMs: ventana.startMs,
      endMs: ventana.endMs,
      athletes,
    });
    const batch = armarBatch(nuevo);
    const esperado = {
      nombre,
      inicioMs: ventana.startMs,
      finMs: ventana.endMs,
      athleteIds: idsAtletas(athletes),
    };

    etapa = "escribir";
    const put = await pedirInterno({
      metodo: "PUT",
      ruta: `${rutaActividad}/batch`,
      autorizacion,
      body: batch,
      timeoutMs: TIMEOUT_ESCRITURA_MS,
    });

    etapa = "esperar";
    await new Promise((resolver) => setTimeout(resolver, ESPERA_REPROCESO_MS));

    etapa = "leer-despues";
    const [internoDespuesRaw, connectDespues] = await Promise.all([
      pedirInterno({
        metodo: "GET",
        ruta: rutaActividad,
        autorizacion,
        timeoutMs: TIMEOUT_LECTURA_MS,
      }),
      tomarSnapshotConnect({
        token: connectToken,
        activityId,
        baseUrl: process.env.OPENFIELD_API_BASE_URL,
      }),
    ]);

    const internoDespues =
      internoDespuesRaw.ok && internoDespuesRaw.payload?.id
        ? normalizarInterno(internoDespuesRaw.payload)
        : null;

    etapa = "validar";
    const interna = internoDespues
      ? validarEscrituraBatch({ antes: internoAntes, despues: internoDespues, esperado })
      : null;
    const connect = connectDespues.ok
      ? validarEscrituraBatch({
          antes: connectAntes.snapshot,
          despues: connectDespues.snapshot,
          esperado,
        })
      : null;

    const veredicto = veredictoEscritura({ putStatus: put.status, interna, connect });

    return response.status(200).json({
      ok: true,
      result: "cloud-write-tested",
      mode: "modo-prueba",
      activity: ACTIVIDAD_PRUEBA,
      pase: {
        formato: descripcionPase?.formato || null,
        expira: descripcionPase?.expira || null,
        duraSegundos: pase.expiresIn,
      },
      enviado: {
        metodo: "PUT",
        host: new URL(baseServicio()).hostname,
        path: `${rutaActividad}/batch`,
        periodo: {
          id: nuevo.id,
          name: nuevo.name,
          start_time_ms: nuevo.start_time_ms,
          end_time_ms: nuevo.end_time_ms,
          participantes: athletes.length,
        },
      },
      put: {
        status: put.status,
        ms: put.ms,
        contentType: put.contentType,
        cuerpo: describirCuerpo(put.texto),
        ...(put.error ? { error: put.error } : {}),
      },
      antes: {
        interno: internoAntes,
        connect: resumirConnect(connectAntes.snapshot),
      },
      despues: {
        interno: internoDespues,
        internoStatus: internoDespuesRaw.status,
        connect: connectDespues.ok
          ? resumirConnect(connectDespues.snapshot)
          : { error: connectDespues.error, status: connectDespues.status },
      },
      validacion: { interna, connect },
      veredicto,
      message:
        veredicto.codigo === "escritura-validada"
          ? `Se escribió ${nombre} en ${ACTIVIDAD_PRUEBA.name} y quedó exactamente como se pidió.`
          : `El write test terminó con el resultado "${veredicto.codigo}". Revisá el detalle.`,
    });
  } catch (error) {
    const { timeout } = clasificarErrorNavegador(error);

    return response.status(timeout ? 504 : 502).json({
      ok: false,
      code: timeout ? "CATAPULT_TIMEOUT" : "WRITE_TEST_ERROR",
      error: timeout
        ? `Catapult demoró demasiado durante el write test (etapa: ${etapa}).`
        : `El write test no pudo completarse (etapa: ${etapa}).`,
      etapa,
      detalle: resumirError(error),
      escribio: ["esperar", "leer-despues", "validar"].includes(etapa),
    });
  } finally {
    await cerrarNavegador(nav);
  }
}
