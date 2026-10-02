// Las horas de exposición de cada jugador, para las lesiones cada 1000 horas:
// los minutos que jugó en cada partido (Partido) y los que entrenó en cada
// tarea (Flujo diario), con lo que la app ya guarda. Nada se guarda aparte:
// se cuenta cada vez que se mira un reporte.
//
// Cada tramo: { jugadorId, fecha: "aaaa-mm-dd", segundos, tipo: "partido" | "entrenamiento" }.
import { participacionEnPartido } from "./jugadores.js";
import { normalizarTexto } from "./match";
import { horaAMs } from "./sesionEntrenamiento.js";

const texto = (valor) => String(valor ?? "");

// Lo que hace falta de una fila de registros_partido para medir los minutos
// (las mismas columnas que lee Partido al abrir un partido guardado: los
// horarios ya están en hora real, también los de transmisión).
const vars = (fila, periodo) =>
  [1, 2, 3]
    .map((n) => ({ inicio: texto(fila[`inicio_var_${periodo}_${n}`]), final: texto(fila[`final_var_${periodo}_${n}`]) }))
    .filter((parada) => parada.inicio || parada.final);

export const partidoDeFila = (fila) => {
  const prorroga = fila?.prorroga && typeof fila.prorroga === "object" ? fila.prorroga : {};
  const cambiosExtra = Array.isArray(fila?.cambios_extra) ? fila.cambios_extra : [];
  return {
    fecha: texto(fila?.fecha),
    inicioPT: texto(fila?.inicio_pt),
    finalPT: texto(fila?.final_pt),
    inicioST: texto(fila?.inicio_st),
    finalST: texto(fila?.final_st),
    varsPT: vars(fila || {}, "pt"),
    varsST: vars(fila || {}, "st"),
    inicioHidratacionPT: texto(fila?.inicio_hid_pt),
    finalHidratacionPT: texto(fila?.final_hid_pt),
    inicioHidratacionST: texto(fila?.inicio_hid_st),
    finalHidratacionST: texto(fila?.final_hid_st),
    prorrogaActiva: Boolean(prorroga.activa),
    inicioPTE: texto(prorroga.inicioPTE),
    finalPTE: texto(prorroga.finalPTE),
    varsPTE: Array.isArray(prorroga.varsPTE) ? prorroga.varsPTE : [],
    inicioHidratacionPTE: texto(prorroga.inicioHidratacionPTE),
    finalHidratacionPTE: texto(prorroga.finalHidratacionPTE),
    inicioSTE: texto(prorroga.inicioSTE),
    finalSTE: texto(prorroga.finalSTE),
    varsSTE: Array.isArray(prorroga.varsSTE) ? prorroga.varsSTE : [],
    inicioHidratacionSTE: texto(prorroga.inicioHidratacionSTE),
    finalHidratacionSTE: texto(prorroga.finalHidratacionSTE),
    cambios: [
      ...[1, 2, 3, 4, 5].map((n) => ({ sale: texto(fila?.[`cambio_${n}_sale`]), entra: texto(fila?.[`cambio_${n}_entra`]), hora: texto(fila?.[`cambio_${n}_tiempo`]) })),
      ...cambiosExtra,
    ],
    formacion: {
      titulares: Array.isArray(fila?.titulares) ? fila.titulares : [],
      convocados: Array.isArray(fila?.convocados) ? fila.convocados : [],
    },
  };
};

// Los minutos de cada jugador del plantel en cada partido. En Partido los
// jugadores van por nombre: se busca cada uno del plantel (con las mismas
// equivalencias de nombres que usa Partido). Lo neto: sin VAR ni hidratación.
export const exposicionDePartidos = (filas, plantel) => {
  const tramos = [];
  (filas || []).forEach((fila) => {
    const partido = partidoDeFila(fila);
    if (!partido.fecha) return;
    const nombres = new Set(
      [...partido.formacion.titulares, ...partido.formacion.convocados, ...partido.cambios.flatMap((cambio) => [cambio?.sale, cambio?.entra])]
        .filter(Boolean)
        .map((nombre) => normalizarTexto(nombre)),
    );
    (plantel || []).forEach((jugador) => {
      if (!jugador?.nombre || !nombres.has(normalizarTexto(jugador.nombre))) return;
      const suyo = participacionEnPartido(partido, jugador.nombre);
      if (suyo && suyo.neto > 0) tramos.push({ jugadorId: String(jugador.id), fecha: partido.fecha, segundos: suyo.neto, tipo: "partido" });
    });
  });
  return tramos;
};

// Lo que un jugador entrenó en una tarea: la tarea entera ("total") o su
// tramo ("parcial"), sin las pausas de la tarea que caen adentro.
const segundosEnTarea = (tarea, participacion) => {
  const inicioTarea = horaAMs(tarea.fecha, tarea.inicio);
  const finTarea = horaAMs(tarea.fecha, tarea.fin);
  if (inicioTarea === null || finTarea === null || finTarea <= inicioTarea) return 0;
  let desde = inicioTarea;
  let hasta = finTarea;
  if (participacion?.modo === "parcial") {
    const propioInicio = horaAMs(tarea.fecha, participacion.inicio);
    const propioFin = horaAMs(tarea.fecha, participacion.fin);
    if (propioInicio !== null) desde = Math.max(desde, propioInicio);
    if (propioFin !== null) hasta = Math.min(hasta, propioFin);
  }
  if (hasta <= desde) return 0;
  const pausas = (tarea.pausas || []).reduce((total, pausa) => {
    const inicio = horaAMs(tarea.fecha, pausa?.inicio);
    const fin = horaAMs(tarea.fecha, pausa?.fin);
    if (inicio === null || fin === null || fin <= inicio) return total;
    return total + Math.max(0, Math.min(fin, hasta) - Math.max(inicio, desde));
  }, 0);
  return Math.max(0, (hasta - desde - pausas) / 1000);
};

// Los minutos de cada jugador en cada tarea de los entrenamientos guardados.
// En Flujo diario los jugadores van por su id: se suma directo.
export const exposicionDeEntrenamientos = (filas) => {
  const tramos = [];
  (filas || []).forEach((fila) => {
    const tareas = Array.isArray(fila?.datos?.tareas) ? fila.datos.tareas : [];
    tareas.forEach((tarea) => {
      const fecha = texto(tarea?.fecha || fila?.fecha);
      if (!fecha) return;
      Object.entries(tarea?.participantes || {}).forEach(([jugadorId, participacion]) => {
        const segundos = segundosEnTarea({ ...tarea, fecha }, participacion);
        if (segundos > 0) tramos.push({ jugadorId: String(jugadorId), fecha, segundos, tipo: "entrenamiento" });
      });
    });
  });
  return tramos;
};
