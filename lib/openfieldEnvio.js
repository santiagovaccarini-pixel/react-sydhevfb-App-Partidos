// Envío de cortes: de las tareas registradas en la app al batch del servicio
// interno, y la evaluación de lo que quedó en OpenField después. Lógica pura;
// la red vive en api/openfield/cortes.js.

import {
  planificarBatch,
  prepararTarea,
  resumirPausas,
  resumirVerificacion,
  tareaAPeriodos,
  verificarPeriodos,
} from "./openfieldTareas.js";
import { compararSnapshots } from "./openfieldPeriods.js";

// Arma el plan completo: valida cada tarea, la convierte en períodos con ids
// estables y construye el batch preservando lo que la app no gestiona.
// `actividadInterna` es la actividad tal cual la devuelve el servicio interno
// (start_time_ms, end_time_ms, periods con athletes).
export const planificarCortes = ({
  tareas = [],
  asignaciones = {},
  actividadInterna,
  periodosConnect = [],
  generarId,
}) => {
  const errores = [];
  const planTareas = [];
  const gestionados = [];
  const obsoletos = [];
  let asignacionesActuales = { ...asignaciones };

  const inicioActividad = Number(actividadInterna?.start_time_ms);
  const finActividad = Number(actividadInterna?.end_time_ms);
  const ventanaConocida = Number.isFinite(inicioActividad) && Number.isFinite(finActividad);

  (Array.isArray(tareas) ? tareas : []).forEach((tarea) => {
    let preparada;
    try {
      preparada = prepararTarea(tarea);
    } catch (error) {
      errores.push({ tareaId: tarea?.id ?? null, nombre: tarea?.nombre ?? "", error: error.message });
      return;
    }

    if (ventanaConocida && (preparada.inicioMs < inicioActividad || preparada.finMs > finActividad)) {
      errores.push({
        tareaId: preparada.id,
        nombre: preparada.nombre,
        error: "La tarea queda fuera del horario de la actividad en OpenField.",
      });
      return;
    }

    const resultado = tareaAPeriodos(preparada, { asignaciones: asignacionesActuales, generarId });
    asignacionesActuales = resultado.asignaciones;
    gestionados.push(...resultado.periodos);
    obsoletos.push(...resultado.idsObsoletos);

    planTareas.push({
      tareaId: preparada.id,
      nombre: preparada.nombre,
      inicioMs: preparada.inicioMs,
      finMs: preparada.finMs,
      pausas: resumirPausas(preparada),
      duracionEfectivaSegundos: preparada.duracionEfectivaSegundos,
      periodos: resultado.periodos.map((periodo) => ({
        id: periodo.id,
        start_time_ms: periodo.start_time_ms,
        end_time_ms: periodo.end_time_ms,
        participantes: periodo.athletes.length,
        principal: periodo.ventana.principal,
      })),
    });
  });

  if (errores.length > 0) {
    return { ok: false, errores, tareas: planTareas };
  }

  const plan = planificarBatch({
    periodosActuales: Array.isArray(actividadInterna?.periods) ? actividadInterna.periods : [],
    periodosGestionados: gestionados,
    idsObsoletos: obsoletos,
    periodosConnect,
  });

  const { resumen } = plan;
  const invariante = resumen.preservados + resumen.reemplazados + resumen.eliminados === resumen.actuales;
  const vaciaLaActividad = plan.batch.periods.length === 0 && resumen.actuales > 0;

  if (!invariante || vaciaLaActividad) {
    return {
      ok: false,
      errores: [{ tareaId: null, nombre: "", error: "El plan no preserva los períodos existentes; no se envía nada." }],
      tareas: planTareas,
      resumen,
    };
  }

  return {
    ok: true,
    batch: plan.batch,
    resumen,
    periodosGestionados: gestionados,
    idsObsoletos: obsoletos,
    asignaciones: asignacionesActuales,
    tareas: planTareas,
  };
};

const filtrarAjenos = (snapshot, excluidos) => ({
  periods: (Array.isArray(snapshot?.periods) ? snapshot.periods : []).filter(
    (periodo) => !excluidos.has(String(periodo?.id || "")),
  ),
});

// Evalúa la relectura: cada período gestionado exacto por las dos vías, los
// ajenos sin tocar y los obsoletos retirados. `internoAntes`/`internoDespues`
// vienen normalizados (start_ms, end_ms, athletes), igual que el snapshot de
// Connect.
export const evaluarEnvio = ({
  periodosGestionados = [],
  idsObsoletos = [],
  internoAntes,
  internoDespues,
  connectDespues,
}) => {
  const verifInterna = internoDespues ? verificarPeriodos({ esperados: periodosGestionados, snapshot: internoDespues }) : [];
  const verifConnect = connectDespues ? verificarPeriodos({ esperados: periodosGestionados, snapshot: connectDespues }) : [];
  const resumenInterno = resumirVerificacion(verifInterna);
  const resumenConnect = resumirVerificacion(verifConnect);

  const excluidos = new Set([
    ...periodosGestionados.map((periodo) => String(periodo.id)),
    ...idsObsoletos.map(String),
  ]);
  const diffAjenos =
    internoAntes && internoDespues
      ? compararSnapshots(filtrarAjenos(internoAntes, excluidos), filtrarAjenos(internoDespues, excluidos))
      : null;
  const preservadosIntactos = diffAjenos ? diffAjenos.sinCambios : null;

  const obsoletosRetirados = internoDespues
    ? idsObsoletos.every(
        (id) =>
          !(internoDespues.periods || []).some(
            (periodo) => String(periodo?.id) === String(id) && !periodo?.is_deleted,
          ),
      )
    : null;

  const porTarea = new Map();
  [...resumenInterno.tareas, ...resumenConnect.tareas].forEach((tarea) => {
    const clave = tarea.tareaId ?? "";
    const actual = porTarea.get(clave) || { tareaId: tarea.tareaId ?? null, ok: true, fallidos: [] };
    if (!tarea.ok) {
      actual.ok = false;
      actual.fallidos.push(...tarea.fallidos);
    }
    porTarea.set(clave, actual);
  });

  const hayRelectura = Boolean(internoDespues) && Boolean(connectDespues);
  const ok =
    hayRelectura &&
    resumenInterno.ok &&
    resumenConnect.ok &&
    preservadosIntactos === true &&
    obsoletosRetirados !== false;

  let veredicto;
  if (!hayRelectura) {
    veredicto = {
      codigo: "sin-relectura",
      detalle: "No se pudo releer OpenField después de escribir. Revisá la actividad en el editor antes de seguir.",
    };
  } else if (preservadosIntactos === false) {
    veredicto = {
      codigo: "ajenos-tocados",
      detalle: "Cambió algún período que la app no gestiona. Revisá la actividad en el editor antes de seguir.",
    };
  } else if (!resumenInterno.ok || !resumenConnect.ok) {
    veredicto = {
      codigo: "cortes-con-diferencias",
      detalle: `${Math.max(resumenInterno.fallidos, resumenConnect.fallidos)} período(s) no quedaron exactamente como se pidió.`,
    };
  } else if (obsoletosRetirados === false) {
    veredicto = {
      codigo: "obsoletos-no-retirados",
      detalle: "Los cortes quedaron bien, pero un período viejo de la app no se retiró.",
    };
  } else {
    veredicto = {
      codigo: "cortes-validados",
      detalle: `${periodosGestionados.length} período(s) exactos en el servicio interno y en la API oficial; el resto de la actividad quedó intacto.`,
    };
  }

  return {
    ok,
    veredicto,
    interna: { resultados: verifInterna, resumen: resumenInterno },
    connect: { resultados: verifConnect, resumen: resumenConnect },
    preservadosIntactos,
    diffAjenos,
    obsoletosRetirados,
    tareas: [...porTarea.values()],
  };
};
