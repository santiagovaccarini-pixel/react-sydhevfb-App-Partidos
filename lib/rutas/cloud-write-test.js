import { randomUUID } from "node:crypto";
import { autenticarCookieOpenField } from "../openfieldAuth.js";
import { resolverPase } from "../catapultAcceso.js";
import { ACTIVIDAD_PRUEBA, leerBodyJson, resumirError, textoSeguro } from "../catapultCloud.js";
import { describirAutorizacion } from "../catapultInspect.js";
import { ACTIVITY_SERVICE_BASE_DEFAULT } from "../catapultInternal.js";
import {
  armarBatchCompleto,
  armarPeriodoNuevo,
  elegirNombreLibre,
  elegirVentanaPrueba,
  idsAtletas,
  normalizarInterno,
  validarEscrituraBatch,
  veredictoEscritura,
} from "../catapultWrite.js";
import { describirCuerpo } from "../openfieldProbe.js";
import { tomarSnapshotConnect } from "../openfieldSnapshot.js";

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
  let etapa = "inicio";

  try {
    // Pase: cuenta guardada del usuario, o usuario y contraseña si vienen.
    etapa = "acceso";
    const acceso = await resolverPase({ request, username, password });
    if (!acceso.ok) {
      return response.status(acceso.status || 502).json({
        ok: false,
        code: acceso.code || null,
        error: `${acceso.error} No se escribió nada.`,
        etapa: acceso.etapa || etapa,
      });
    }

    const pase = acceso.pase;
    const autorizacion = `${pase.tokenType || "Bearer"} ${pase.accessToken}`;
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
    // El batch reemplaza todos los períodos: van los actuales más el nuevo.
    const batch = armarBatchCompleto({
      periodosInternos: internoAntesRaw.payload.periods,
      periodosConnect: connectAntes.snapshot.periods,
      nuevo,
    });
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
      usuario: acceso.usuario,
      origenPase: acceso.origen,
      pase: {
        formato: descripcionPase?.formato || null,
        expira: descripcionPase?.expira || pase.expira || null,
      },
      enviado: {
        metodo: "PUT",
        host: new URL(baseServicio()).hostname,
        path: `${rutaActividad}/batch`,
        periodosEnviados: batch.periods.length,
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
    return response.status(502).json({
      ok: false,
      code: "WRITE_TEST_ERROR",
      error: `El write test no pudo completarse (etapa: ${etapa}).`,
      etapa,
      detalle: resumirError(error),
      escribio: ["esperar", "leer-despues", "validar"].includes(etapa),
    });
  }
}
