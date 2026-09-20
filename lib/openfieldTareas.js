// Motor de cortes: cómo una tarea de entrenamiento (nombre, inicio, fin,
// pausas y participantes totales o parciales) se convierte en períodos de
// OpenField, con ids estables para que corregir no duplique, y cómo se
// verifica cada uno después de escribir. Lógica pura, sin red.
//
// Decisiones del proyecto que este módulo aplica:
// - Una tarea es UN período de punta a punta en OpenField. Las pausas viven en
//   la app (segundos por pausa y total, para el C/P t) y no parten el período.
// - Un participante "parcial" (entró tarde o salió antes) va en un período
//   aparte con el mismo nombre y su ventana real. Cada jugador aparece en una
//   sola ventana, así los reportes por nombre de período agrupan bien.
// - OpenField resuelve de a 10 ms: todo tiempo se alinea a esa grilla.

import { RESOLUCION_MS } from "./openfieldPeriods.js";

export const MODO_TOTAL = "total";
export const MODO_PARCIAL = "parcial";

const MS_SEGUNDO = 1000;

const aMs = (valor, etiqueta) => {
  let ms;
  if (valor instanceof Date) ms = valor.getTime();
  else if (typeof valor === "number") ms = valor < 1e12 ? valor * MS_SEGUNDO : valor;
  else if (typeof valor === "string" && valor.trim()) ms = new Date(valor).getTime();
  else ms = NaN;

  if (!Number.isFinite(ms)) throw new Error(`${etiqueta} no es una fecha/hora válida.`);
  return Math.round(ms / RESOLUCION_MS) * RESOLUCION_MS;
};

const segundos = (inicioMs, finMs) => (finMs - inicioMs) / MS_SEGUNDO;

export const prepararTarea = ({ id, nombre, inicio, fin, pausas = [], participantes = [] }) => {
  const tareaId = String(id || "").trim();
  if (!tareaId) throw new Error("La tarea necesita un id.");

  const nombreLimpio = String(nombre || "").trim();
  if (!nombreLimpio) throw new Error("La tarea necesita un nombre.");

  const inicioMs = aMs(inicio, "El inicio de la tarea");
  const finMs = aMs(fin, "El fin de la tarea");
  if (finMs <= inicioMs) throw new Error("El fin de la tarea debe ser posterior al inicio.");

  const pausasNormalizadas = (Array.isArray(pausas) ? pausas : [])
    .map((pausa, indice) => {
      const n = indice + 1;
      const pInicio = aMs(pausa?.inicio, `El inicio de la pausa ${n}`);
      const pFin = aMs(pausa?.fin, `El fin de la pausa ${n}`);
      if (pFin <= pInicio) throw new Error(`La pausa ${n} debe terminar después de comenzar.`);
      if (pInicio < inicioMs || pFin > finMs) {
        throw new Error(`La pausa ${n} está fuera de los límites de la tarea.`);
      }
      return { inicioMs: pInicio, finMs: pFin, segundos: segundos(pInicio, pFin) };
    })
    .sort((a, b) => a.inicioMs - b.inicioMs);

  for (let i = 1; i < pausasNormalizadas.length; i += 1) {
    if (pausasNormalizadas[i].inicioMs < pausasNormalizadas[i - 1].finMs) {
      throw new Error(`Las pausas ${i} y ${i + 1} se superponen.`);
    }
  }

  const vistos = new Set();
  const participantesNormalizados = (Array.isArray(participantes) ? participantes : []).map(
    (participante, indice) => {
      const atletaId = String(participante?.atletaId ?? participante?.id ?? "").trim();
      if (!atletaId) throw new Error(`El participante ${indice + 1} no tiene identificador.`);
      if (vistos.has(atletaId)) throw new Error(`El participante ${atletaId} está repetido.`);
      vistos.add(atletaId);

      const modo = participante?.modo === MODO_PARCIAL ? MODO_PARCIAL : MODO_TOTAL;
      if (modo === MODO_TOTAL) {
        return { atletaId, modo, inicioMs, finMs, segundos: segundos(inicioMs, finMs) };
      }

      const pInicio = aMs(participante?.inicio, `El inicio parcial de ${atletaId}`);
      const pFin = aMs(participante?.fin, `El fin parcial de ${atletaId}`);
      if (pFin <= pInicio) throw new Error(`El tiempo parcial de ${atletaId} termina antes de empezar.`);
      if (pInicio < inicioMs || pFin > finMs) {
        throw new Error(`El tiempo parcial de ${atletaId} está fuera de la tarea.`);
      }

      // Un parcial que cubre toda la tarea es, en la práctica, un total.
      if (pInicio === inicioMs && pFin === finMs) {
        return { atletaId, modo: MODO_TOTAL, inicioMs, finMs, segundos: segundos(inicioMs, finMs) };
      }

      return { atletaId, modo, inicioMs: pInicio, finMs: pFin, segundos: segundos(pInicio, pFin) };
    },
  );

  const pausasSegundos = pausasNormalizadas.reduce((total, pausa) => total + pausa.segundos, 0);
  const duracionBrutaSegundos = segundos(inicioMs, finMs);

  return {
    id: tareaId,
    nombre: nombreLimpio,
    inicioMs,
    finMs,
    duracionBrutaSegundos,
    pausas: pausasNormalizadas,
    pausasSegundos,
    duracionEfectivaSegundos: duracionBrutaSegundos - pausasSegundos,
    participantes: participantesNormalizados,
  };
};

export const resumirPausas = (tarea) => ({
  cantidad: tarea.pausas.length,
  segundosPorPausa: tarea.pausas.map((pausa) => pausa.segundos),
  segundosTotales: tarea.pausasSegundos,
});

const claveVentana = (inicioMs, finMs) => `${inicioMs}-${finMs}`;

// Agrupa los participantes por ventana de tiempo. La ventana principal (la
// tarea entera) se emite si tiene participantes totales o si la tarea no
// tiene participantes; con solo parciales, cada uno lleva la suya y no se
// crea un período vacío de más.
export const ventanasDeTarea = (tarea) => {
  const principalClave = claveVentana(tarea.inicioMs, tarea.finMs);
  const grupos = new Map();

  tarea.participantes.forEach((participante) => {
    const clave = claveVentana(participante.inicioMs, participante.finMs);
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        inicioMs: participante.inicioMs,
        finMs: participante.finMs,
        principal: clave === principalClave,
        atletaIds: [],
      });
    }
    grupos.get(clave).atletaIds.push(participante.atletaId);
  });

  if (!grupos.has(principalClave) && tarea.participantes.length === 0) {
    grupos.set(principalClave, {
      clave: principalClave,
      inicioMs: tarea.inicioMs,
      finMs: tarea.finMs,
      principal: true,
      atletaIds: [],
    });
  }

  return [...grupos.values()].sort(
    (a, b) => Number(b.principal) - Number(a.principal) || a.inicioMs - b.inicioMs || a.finMs - b.finMs,
  );
};

const claveAsignacion = (tareaId, ventanaClave) => `${tareaId}|${ventanaClave}`;

// El servicio interno identifica a cada participante de un período por
// `athlete_id` (observado en el batch del editor y en la lectura interna);
// el snapshot de Connect y las formas normalizadas usan `id`.
export const idDeAtleta = (atleta) => {
  if (typeof atleta === "string") return atleta;
  return String(atleta?.athlete_id ?? atleta?.id ?? "");
};

// Cómo va cada participante en el batch. Si el atleta ya figura en algún
// período de la actividad, se copia su objeto tal cual vino del servicio
// interno (es lo que hizo el write test que quedó validado). Si no, la forma
// mínima que manda el editor: { athlete_id }.
const atletaParaBatch = (atletaId, atletas) => {
  const conocido = atletas instanceof Map ? atletas.get(String(atletaId)) : null;
  return conocido && typeof conocido === "object" ? conocido : { athlete_id: String(atletaId) };
};

// Mapa athlete_id → objeto tal cual vino del servicio interno, juntando los
// participantes de todos los períodos de la actividad.
export const atletasDeActividad = (actividadInterna) => {
  const mapa = new Map();
  const listas = [
    ...(Array.isArray(actividadInterna?.athletes) ? [actividadInterna.athletes] : []),
    ...(Array.isArray(actividadInterna?.periods) ? actividadInterna.periods.map((p) => p?.athletes) : []),
  ];
  listas.forEach((lista) => {
    (Array.isArray(lista) ? lista : []).forEach((atleta) => {
      const id = idDeAtleta(atleta);
      if (id && atleta && typeof atleta === "object" && !mapa.has(id)) mapa.set(id, atleta);
    });
  });
  return mapa;
};

// Convierte la tarea en períodos del formato del batch. `asignaciones` guarda
// qué id de período le tocó a cada ventana de cada tarea: al regenerar, se
// reutiliza (corregir un horario actualiza el mismo período, no lo duplica).
// Las ventanas que dejaron de existir devuelven sus ids en `idsObsoletos`
// para que el batch los retire.
export const tareaAPeriodos = (tarea, { asignaciones = {}, generarId, atletas = null } = {}) => {
  if (typeof generarId !== "function") throw new Error("Falta generarId para crear períodos.");

  const nuevasAsignaciones = { ...asignaciones };
  const usadas = new Set();

  const periodos = ventanasDeTarea(tarea).map((ventana) => {
    const clave = claveAsignacion(tarea.id, ventana.clave);
    const id = nuevasAsignaciones[clave] || generarId();
    nuevasAsignaciones[clave] = id;
    usadas.add(clave);

    return {
      id,
      name: tarea.nombre,
      start_time_ms: ventana.inicioMs,
      end_time_ms: ventana.finMs,
      athletes: ventana.atletaIds.map((atletaId) => atletaParaBatch(atletaId, atletas)),
      tareaId: tarea.id,
      ventana: { inicioMs: ventana.inicioMs, finMs: ventana.finMs, principal: ventana.principal },
    };
  });

  const prefijo = `${tarea.id}|`;
  const idsObsoletos = Object.entries(nuevasAsignaciones)
    .filter(([clave]) => clave.startsWith(prefijo) && !usadas.has(clave))
    .map(([, id]) => id);

  Object.keys(nuevasAsignaciones).forEach((clave) => {
    if (clave.startsWith(prefijo) && !usadas.has(clave)) delete nuevasAsignaciones[clave];
  });

  return { periodos, asignaciones: nuevasAsignaciones, idsObsoletos };
};

const aFormatoBatch = (periodo, depth) => ({
  id: String(periodo.id),
  name: String(periodo.name || ""),
  start_time_ms: Number(periodo.start_time_ms),
  end_time_ms: Number(periodo.end_time_ms),
  athletes: Array.isArray(periodo.athletes) ? periodo.athletes : [],
  ...(depth ? { period_depth_id: depth } : {}),
});

// El batch del servicio interno reemplaza TODOS los períodos de la actividad.
// Este plan preserva los que no gestiona la app tal cual están, reemplaza por
// id los que sí, agrega los nuevos y retira los obsoletos. Invariante:
// preservados + reemplazados + eliminados = períodos actuales.
export const planificarBatch = ({
  periodosActuales = [],
  periodosGestionados = [],
  idsObsoletos = [],
  periodosConnect = [],
}) => {
  const depthPorId = new Map(
    (Array.isArray(periodosConnect) ? periodosConnect : []).map((periodo) => [
      String(periodo?.id || ""),
      periodo?.period_depth_id ?? null,
    ]),
  );
  const gestionadosPorId = new Map(periodosGestionados.map((p) => [String(p.id), p]));
  const obsoletos = new Set(idsObsoletos.map(String));

  let reemplazados = 0;
  let eliminados = 0;
  const preservados = [];

  (Array.isArray(periodosActuales) ? periodosActuales : [])
    .filter((periodo) => periodo?.id)
    .forEach((periodo) => {
      const id = String(periodo.id);
      if (gestionadosPorId.has(id)) reemplazados += 1;
      else if (obsoletos.has(id)) eliminados += 1;
      else preservados.push(aFormatoBatch(periodo, depthPorId.get(id)));
    });

  const gestionados = periodosGestionados.map((periodo) =>
    aFormatoBatch(periodo, depthPorId.get(String(periodo.id))),
  );
  const nuevos = gestionados.length - reemplazados;

  return {
    batch: { periods: [...preservados, ...gestionados] },
    resumen: {
      actuales: preservados.length + reemplazados + eliminados,
      preservados: preservados.length,
      reemplazados,
      nuevos,
      eliminados,
      total: preservados.length + gestionados.length,
    },
  };
};

const idsOrdenados = (athletes) =>
  (Array.isArray(athletes) ? athletes : [])
    .map(idDeAtleta)
    .filter(Boolean)
    .sort();

// Comprueba, sobre un snapshot releído, que cada período esperado quedó
// exacto: mismo nombre, inicio y fin a la centésima y mismos participantes.
export const verificarPeriodos = ({ esperados = [], snapshot }) => {
  const activos = (Array.isArray(snapshot?.periods) ? snapshot.periods : []).filter(
    (periodo) => periodo?.id && !periodo.is_deleted,
  );
  const porId = new Map(activos.map((periodo) => [String(periodo.id), periodo]));

  return esperados.map((esperado) => {
    const base = { periodId: String(esperado.id), tareaId: esperado.tareaId ?? null, nombre: esperado.name };
    const real = porId.get(String(esperado.id));

    if (!real) return { ...base, ok: false, motivo: "no-encontrado" };

    const diferenciaInicioMs = Number(real.start_ms) - Number(esperado.start_time_ms);
    const diferenciaFinMs = Number(real.end_ms) - Number(esperado.end_time_ms);
    const nombreOk = String(real.name) === String(esperado.name);
    const idsEsperados = idsOrdenados(esperado.athletes);
    const idsReales = idsOrdenados(real.athletes);
    const participantes = {
      faltantes: idsEsperados.filter((id) => !idsReales.includes(id)),
      sobrantes: idsReales.filter((id) => !idsEsperados.includes(id)),
    };
    const ok =
      nombreOk &&
      diferenciaInicioMs === 0 &&
      diferenciaFinMs === 0 &&
      participantes.faltantes.length === 0 &&
      participantes.sobrantes.length === 0;

    return {
      ...base,
      ok,
      motivo: ok ? "ok" : "diferencias",
      nombreOk,
      diferenciaInicioMs,
      diferenciaFinMs,
      participantes,
    };
  });
};

export const resumirVerificacion = (resultados = []) => {
  const porTarea = new Map();

  resultados.forEach((resultado) => {
    const clave = resultado.tareaId ?? "";
    if (!porTarea.has(clave)) {
      porTarea.set(clave, { tareaId: resultado.tareaId ?? null, ok: true, periodos: 0, fallidos: [] });
    }
    const tarea = porTarea.get(clave);
    tarea.periodos += 1;
    if (!resultado.ok) {
      tarea.ok = false;
      tarea.fallidos.push({ periodId: resultado.periodId, motivo: resultado.motivo });
    }
  });

  const tareas = [...porTarea.values()];
  return {
    ok: tareas.every((tarea) => tarea.ok),
    tareas,
    periodos: resultados.length,
    fallidos: resultados.filter((resultado) => !resultado.ok).length,
  };
};
