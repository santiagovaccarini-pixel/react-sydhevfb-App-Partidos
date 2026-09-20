import { randomUUID } from "node:crypto";
import { autenticarCookieOpenField } from "../../lib/openfieldAuth.js";
import { resolverPase } from "../../lib/catapultAcceso.js";
import { leerBodyJson, resumirError, textoSeguro } from "../../lib/catapultCloud.js";
import {
  escribirBatchInterno,
  leerActividadInterna,
  validarActivityId,
} from "../../lib/catapultServicio.js";
import { normalizarInterno } from "../../lib/catapultWrite.js";
import { evaluarEnvio, planificarCortes } from "../../lib/openfieldEnvio.js";
import { describirCuerpo } from "../../lib/openfieldProbe.js";
import { tomarSnapshotConnect } from "../../lib/openfieldSnapshot.js";

export const config = {
  maxDuration: 60,
};

const MAX_TAREAS = 60;
const ESPERA_REPROCESO_MS = 2500;

// Envío de cortes de una sesión de entrenamiento a OpenField.
// POST { activityId, confirmacion, tareas, asignaciones, soloPlan }
// - soloPlan: true → arma y devuelve el plan sin escribir nada (vista previa).
// - confirmacion: el nombre exacto de la actividad en OpenField; se compara
//   con el nombre real leído del servicio interno, no con lo que diga la app.
// Flujo: pase de la cuenta guardada → lectura interna + snapshot Connect →
// plan (preserva lo ajeno) → PUT batch → espera → relectura por las dos vías
// → evaluación por tarea.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Cookie, Authorization");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const auth = autenticarCookieOpenField(request);
  if (!auth.ok) {
    return response.status(auth.status).json({ ok: false, error: auth.error });
  }

  const body = leerBodyJson(request);
  const activityId = validarActivityId(body?.activityId);
  const confirmacion = textoSeguro(body?.confirmacion, 120);
  const soloPlan = body?.soloPlan === true;
  const tareas = Array.isArray(body?.tareas) ? body.tareas : [];
  const asignaciones =
    body?.asignaciones && typeof body.asignaciones === "object" && !Array.isArray(body.asignaciones)
      ? body.asignaciones
      : {};

  if (!activityId) {
    return response.status(400).json({ ok: false, error: "Falta un activityId válido." });
  }
  if (tareas.length === 0) {
    return response.status(400).json({ ok: false, error: "No hay tareas para enviar." });
  }
  if (tareas.length > MAX_TAREAS) {
    return response.status(400).json({ ok: false, error: `Demasiadas tareas en un envío (máximo ${MAX_TAREAS}).` });
  }

  const connectToken = process.env.OPENFIELD_API_TOKEN;
  if (!connectToken) {
    return response.status(500).json({ ok: false, error: "OPENFIELD_API_TOKEN no está configurado en el servidor." });
  }

  let etapa = "acceso";

  try {
    const acceso = await resolverPase({ request });
    if (!acceso.ok) {
      return response.status(acceso.status || 502).json({
        ok: false,
        code: acceso.code || null,
        error: `${acceso.error} No se escribió nada.`,
        etapa,
      });
    }
    const autorizacion = `${acceso.pase.tokenType || "Bearer"} ${acceso.pase.accessToken}`;

    etapa = "leer-antes";
    const [internoAntesRaw, connectAntes] = await Promise.all([
      leerActividadInterna({ autorizacion, activityId }),
      tomarSnapshotConnect({ token: connectToken, activityId, baseUrl: process.env.OPENFIELD_API_BASE_URL }),
    ]);

    if (!internoAntesRaw.ok || !internoAntesRaw.payload?.id) {
      return response.status(502).json({
        ok: false,
        code: "INTERNO_NO_LEGIBLE",
        error: "OpenField no devolvió la actividad. No se escribió nada.",
        etapa,
        upstreamStatus: internoAntesRaw.status,
      });
    }
    if (!connectAntes.ok) {
      return response.status(connectAntes.status || 502).json({
        ok: false,
        code: "CONNECT_NO_LEGIBLE",
        error: `${connectAntes.error} No se escribió nada.`,
        etapa,
      });
    }

    const actividadInterna = internoAntesRaw.payload;
    const nombreReal = String(actividadInterna.name || "").trim();

    etapa = "planificar";
    const plan = planificarCortes({
      tareas,
      asignaciones,
      actividadInterna,
      periodosConnect: connectAntes.snapshot.periods,
      generarId: randomUUID,
    });

    const base = {
      activity: {
        id: String(actividadInterna.id),
        name: nombreReal,
        start_time_ms: actividadInterna.start_time_ms ?? null,
        end_time_ms: actividadInterna.end_time_ms ?? null,
        periodosActuales: Array.isArray(actividadInterna.periods) ? actividadInterna.periods.length : 0,
      },
      usuario: acceso.usuario,
      origenPase: acceso.origen,
    };

    if (!plan.ok) {
      return response.status(422).json({
        ok: false,
        code: "PLAN_INVALIDO",
        error: "Hay tareas que no se pueden enviar. No se escribió nada.",
        etapa,
        ...base,
        errores: plan.errores,
        avisos: plan.avisos,
        tareas: plan.tareas,
      });
    }

    if (soloPlan) {
      return response.status(200).json({
        ok: true,
        result: "plan",
        escribio: false,
        ...base,
        resumen: plan.resumen,
        avisos: plan.avisos,
        tareas: plan.tareas,
        asignaciones: plan.asignaciones,
        confirmacionRequerida: nombreReal,
      });
    }

    if (confirmacion !== nombreReal) {
      return response.status(400).json({
        ok: false,
        code: "CONFIRMACION_INVALIDA",
        error: `Para escribir tenés que confirmar escribiendo exactamente el nombre de la actividad: "${nombreReal}". No se escribió nada.`,
        etapa: "confirmar",
        ...base,
        confirmacionRequerida: nombreReal,
      });
    }

    if (connectAntes.snapshot.incompleto) {
      return response.status(409).json({
        ok: false,
        code: "SNAPSHOT_INCOMPLETO",
        error: "No se pudieron leer los participantes de todos los períodos actuales. No se escribió nada.",
        etapa,
        ...base,
      });
    }

    etapa = "escribir";
    const put = await escribirBatchInterno({ autorizacion, activityId, batch: plan.batch });

    etapa = "esperar";
    await new Promise((resolver) => setTimeout(resolver, ESPERA_REPROCESO_MS));

    etapa = "leer-despues";
    const [internoDespuesRaw, connectDespues] = await Promise.all([
      leerActividadInterna({ autorizacion, activityId }),
      tomarSnapshotConnect({ token: connectToken, activityId, baseUrl: process.env.OPENFIELD_API_BASE_URL }),
    ]);

    etapa = "evaluar";
    const internoAntes = normalizarInterno(actividadInterna);
    const internoDespues =
      internoDespuesRaw.ok && internoDespuesRaw.payload?.id ? normalizarInterno(internoDespuesRaw.payload) : null;
    const evaluacion = evaluarEnvio({
      periodosGestionados: plan.periodosGestionados,
      idsObsoletos: plan.idsObsoletos,
      internoAntes,
      internoDespues,
      connectDespues: connectDespues.ok ? connectDespues.snapshot : null,
    });

    const putOk = put.status >= 200 && put.status < 300;
    const veredicto = putOk
      ? evaluacion.veredicto
      : {
          codigo: "escritura-rechazada",
          detalle: `OpenField rechazó el batch (${put.status || "sin respuesta"}).${
            evaluacion.preservadosIntactos === true && evaluacion.interna.resumen.fallidos === plan.periodosGestionados.length
              ? " Nada cambió."
              : " Revisá la actividad en el editor."
          }`,
        };

    // Las asignaciones solo se confirman si el período quedó escrito: así un
    // reintento vuelve a intentar el mismo id y no crea otro.
    const tareasResultado = plan.tareas.map((tarea) => {
      const evaluada = evaluacion.tareas.find((t) => t.tareaId === tarea.tareaId);
      return { ...tarea, ok: putOk && Boolean(evaluada?.ok), fallidos: evaluada?.fallidos || [] };
    });

    return response.status(200).json({
      ok: putOk && evaluacion.ok,
      result: "cortes-enviados",
      escribio: true,
      ...base,
      put: {
        status: put.status,
        ms: put.ms,
        cuerpo: describirCuerpo(put.texto),
        ...(put.error ? { error: put.error } : {}),
      },
      resumen: plan.resumen,
      avisos: plan.avisos,
      asignaciones: plan.asignaciones,
      tareas: tareasResultado,
      evaluacion: {
        interna: evaluacion.interna,
        connect: evaluacion.connect,
        preservadosIntactos: evaluacion.preservadosIntactos,
        obsoletosRetirados: evaluacion.obsoletosRetirados,
        diffAjenos: evaluacion.diffAjenos,
      },
      veredicto,
      message: veredicto.detalle,
    });
  } catch (error) {
    return response.status(502).json({
      ok: false,
      code: "ENVIO_ERROR",
      error: `El envío no pudo completarse (etapa: ${etapa}).`,
      etapa,
      detalle: resumirError(error),
      escribio: ["esperar", "leer-despues", "evaluar"].includes(etapa),
    });
  }
}
