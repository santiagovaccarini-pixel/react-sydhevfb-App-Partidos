// Sesión de entrenamiento en la app: las tareas registradas para una
// actividad de OpenField, guardadas en el celular por actividad, y su
// conversión al formato que espera el envío (instantes en milisegundos,
// participantes con su id de Catapult).

export const CLAVE_SESION = "entrenamiento_sesion";
export const CLAVE_ACTIVIDAD = "entrenamiento_actividad";
export const MODO_TOTAL = "total";
export const MODO_PARCIAL = "parcial";

const claveDeSesion = (activityId) => `${CLAVE_SESION}:${activityId}`;

const limpiar = (valor) => String(valor ?? "").trim();

// La actividad de OpenField elegida como sesión de trabajo. Se guarda en el
// celular para que Tareas siga sabiendo sobre qué actividad trabaja aunque se
// cierre la app o se pase por Ajustes.
export const normalizarActividad = (actividad) => {
  const id = limpiar(actividad?.id);
  if (!id) return null;
  const inicio = Number(actividad?.start_time);
  const fin = Number(actividad?.end_time);
  return {
    id,
    name: limpiar(actividad?.name),
    start_time: Number.isFinite(inicio) && inicio > 0 ? inicio : null,
    end_time: Number.isFinite(fin) && fin > 0 ? fin : null,
  };
};

export const leerActividadElegida = () => {
  try {
    return normalizarActividad(JSON.parse(localStorage.getItem(CLAVE_ACTIVIDAD) || "null"));
  } catch {
    return null;
  }
};

export const guardarActividadElegida = (actividad) => {
  try {
    const limpia = normalizarActividad(actividad);
    if (limpia) localStorage.setItem(CLAVE_ACTIVIDAD, JSON.stringify(limpia));
    else localStorage.removeItem(CLAVE_ACTIVIDAD);
    return true;
  } catch {
    return false;
  }
};

export const hoyLocal = (ahora = new Date()) => {
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, "0");
  const dd = String(ahora.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const horaLocal = (ahora = new Date()) =>
  [ahora.getHours(), ahora.getMinutes(), ahora.getSeconds()]
    .map((parte) => String(parte).padStart(2, "0"))
    .join(":");

// El día (local) en que empezó la actividad: las tareas nuevas arrancan con esa
// fecha. Connect informa segundos; el servicio interno, milisegundos.
export const fechaDeActividad = (actividad, ahora = new Date()) => {
  const numero = Number(actividad?.start_time);
  if (!Number.isFinite(numero) || numero <= 0) return hoyLocal(ahora);
  const fecha = new Date(numero < 1e12 ? numero * 1000 : numero);
  return Number.isNaN(fecha.getTime()) ? hoyLocal(ahora) : hoyLocal(fecha);
};

// "HH:MM" o "HH:MM:SS" del día `fecha`, en la hora local del navegador, a
// milisegundos absolutos. El servidor corre en UTC: por eso la conversión se
// hace acá y nunca allá.
export const horaAMs = (fecha, hora) => {
  const f = limpiar(fecha);
  const h = limpiar(hora);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{2}:\d{2}(:\d{2})?$/.test(h)) return null;
  const ms = new Date(`${f}T${h.length === 5 ? `${h}:00` : h}`).getTime();
  return Number.isFinite(ms) ? ms : null;
};

export const msAHora = (ms) => {
  const fecha = new Date(Number(ms));
  return Number.isNaN(fecha.getTime()) ? "" : horaLocal(fecha);
};

export const nuevaPausa = () => ({ inicio: "", fin: "" });

export const nuevaTarea = ({ id, nombre = "", fecha = hoyLocal() }) => ({
  id,
  nombre,
  fecha,
  inicio: "",
  fin: "",
  pausas: [],
  // jugadorId → { modo, inicio, fin }
  participantes: {},
  envio: null,
});

export const normalizarTarea = (tarea, fechaPorDefecto = hoyLocal()) => ({
  id: limpiar(tarea?.id),
  nombre: limpiar(tarea?.nombre),
  fecha: /^\d{4}-\d{2}-\d{2}$/.test(limpiar(tarea?.fecha)) ? limpiar(tarea.fecha) : fechaPorDefecto,
  inicio: limpiar(tarea?.inicio),
  fin: limpiar(tarea?.fin),
  pausas: (Array.isArray(tarea?.pausas) ? tarea.pausas : []).map((pausa) => ({
    inicio: limpiar(pausa?.inicio),
    fin: limpiar(pausa?.fin),
  })),
  participantes: Object.fromEntries(
    Object.entries(tarea?.participantes && typeof tarea.participantes === "object" ? tarea.participantes : {})
      .filter(([jugadorId]) => limpiar(jugadorId))
      .map(([jugadorId, datos]) => [
        limpiar(jugadorId),
        {
          modo: datos?.modo === MODO_PARCIAL ? MODO_PARCIAL : MODO_TOTAL,
          inicio: limpiar(datos?.inicio),
          fin: limpiar(datos?.fin),
        },
      ]),
  ),
  envio: tarea?.envio && typeof tarea.envio === "object" ? tarea.envio : null,
});

export const sesionVacia = (activityId, activityName = "") => ({
  activityId: limpiar(activityId),
  activityName: limpiar(activityName),
  tareas: [],
  asignaciones: {},
  ultimoEnvio: null,
});

export const normalizarSesion = (sesion, activityId, activityName = "") => ({
  ...sesionVacia(activityId, activityName || sesion?.activityName),
  tareas: (Array.isArray(sesion?.tareas) ? sesion.tareas : []).map((tarea) => normalizarTarea(tarea)).filter((t) => t.id),
  asignaciones:
    sesion?.asignaciones && typeof sesion.asignaciones === "object" && !Array.isArray(sesion.asignaciones)
      ? sesion.asignaciones
      : {},
  ultimoEnvio: sesion?.ultimoEnvio && typeof sesion.ultimoEnvio === "object" ? sesion.ultimoEnvio : null,
});

export const cargarSesion = (activityId, activityName = "") => {
  try {
    const guardada = JSON.parse(localStorage.getItem(claveDeSesion(activityId)) || "null");
    return normalizarSesion(guardada, activityId, activityName);
  } catch {
    return sesionVacia(activityId, activityName);
  }
};

export const guardarSesion = (sesion) => {
  try {
    localStorage.setItem(claveDeSesion(sesion.activityId), JSON.stringify(sesion));
    return true;
  } catch {
    return false;
  }
};

const segundosEntre = (inicioMs, finMs) => (finMs - inicioMs) / 1000;

// Duraciones de una tarea con lo que haya cargado. Las pausas incompletas o
// fuera de rango no cuentan; se avisan aparte al validar.
export const resumenTarea = (tarea) => {
  const inicioMs = horaAMs(tarea.fecha, tarea.inicio);
  const finMs = horaAMs(tarea.fecha, tarea.fin);
  const valida = inicioMs !== null && finMs !== null && finMs > inicioMs;

  const pausas = tarea.pausas
    .map((pausa) => ({ inicioMs: horaAMs(tarea.fecha, pausa.inicio), finMs: horaAMs(tarea.fecha, pausa.fin) }))
    .filter((pausa) => pausa.inicioMs !== null && pausa.finMs !== null && pausa.finMs > pausa.inicioMs);
  const pausasSegundos = pausas.reduce((total, pausa) => total + segundosEntre(pausa.inicioMs, pausa.finMs), 0);

  return {
    valida,
    inicioMs,
    finMs,
    duracionBrutaSegundos: valida ? segundosEntre(inicioMs, finMs) : 0,
    pausas: pausas.map((pausa) => segundosEntre(pausa.inicioMs, pausa.finMs)),
    pausasSegundos,
    duracionEfectivaSegundos: valida ? segundosEntre(inicioMs, finMs) - pausasSegundos : 0,
    participantes: Object.keys(tarea.participantes).length,
  };
};

// Lo que falta para poder enviar una tarea. Vacío = lista.
export const problemasDeTarea = (tarea, plantel = [], { atletasActividad = null } = {}) => {
  const conDatos = (jugador) =>
    !(atletasActividad instanceof Set) ||
    atletasActividad.size === 0 ||
    atletasActividad.has(String(jugador.catapult_id));
  const problemas = [];
  const { valida, inicioMs, finMs } = resumenTarea(tarea);

  if (!tarea.nombre) problemas.push("Falta el nombre.");
  if (!valida) problemas.push("Falta el inicio o el fin, o el fin no es posterior al inicio.");

  tarea.pausas.forEach((pausa, indice) => {
    const pInicio = horaAMs(tarea.fecha, pausa.inicio);
    const pFin = horaAMs(tarea.fecha, pausa.fin);
    if (pInicio === null || pFin === null) problemas.push(`La pausa ${indice + 1} está incompleta.`);
    else if (pFin <= pInicio) problemas.push(`La pausa ${indice + 1} termina antes de empezar.`);
    else if (valida && (pInicio < inicioMs || pFin > finMs)) problemas.push(`La pausa ${indice + 1} está fuera de la tarea.`);
  });

  const porId = new Map(plantel.map((jugador) => [String(jugador.id), jugador]));
  const entradas = Object.entries(tarea.participantes);
  if (entradas.length === 0) problemas.push("No hay participantes.");

  entradas.forEach(([jugadorId, datos]) => {
    const jugador = porId.get(String(jugadorId));
    const nombre = jugador?.nombre || `jugador ${jugadorId}`;
    if (!jugador) problemas.push(`${nombre} ya no está en la lista.`);
    else if (!jugador.catapult_id) problemas.push(`${nombre} no está vinculado con Catapult.`);
    else if (!conDatos(jugador)) problemas.push(`${nombre} no tiene datos en esta sesión.`);

    if (datos.modo === MODO_PARCIAL) {
      const pInicio = horaAMs(tarea.fecha, datos.inicio);
      const pFin = horaAMs(tarea.fecha, datos.fin);
      if (pInicio === null || pFin === null) problemas.push(`${nombre}: falta el inicio o el fin parcial.`);
      else if (pFin <= pInicio) problemas.push(`${nombre}: el tiempo parcial termina antes de empezar.`);
      else if (valida && (pInicio < inicioMs || pFin > finMs)) problemas.push(`${nombre}: el tiempo parcial está fuera de la tarea.`);
    }
  });

  return problemas;
};

// Tareas en el formato del envío: instantes en ms y participantes con su id
// de Catapult. Devuelve también los problemas por tarea; con problemas no
// se arma nada de esa tarea.
export const armarEnvio = ({ tareas, plantel = [], atletasActividad = null }) => {
  const porId = new Map(plantel.map((jugador) => [String(jugador.id), jugador]));
  const listas = [];
  const problemas = [];

  tareas.forEach((tarea) => {
    const faltantes = problemasDeTarea(tarea, plantel, { atletasActividad });
    if (faltantes.length > 0) {
      problemas.push({ tareaId: tarea.id, nombre: tarea.nombre, problemas: faltantes });
      return;
    }

    listas.push({
      id: tarea.id,
      nombre: tarea.nombre,
      inicio: horaAMs(tarea.fecha, tarea.inicio),
      fin: horaAMs(tarea.fecha, tarea.fin),
      pausas: tarea.pausas.map((pausa) => ({
        inicio: horaAMs(tarea.fecha, pausa.inicio),
        fin: horaAMs(tarea.fecha, pausa.fin),
      })),
      participantes: Object.entries(tarea.participantes).map(([jugadorId, datos]) => {
        const jugador = porId.get(String(jugadorId));
        const base = { atletaId: jugador.catapult_id, modo: datos.modo };
        return datos.modo === MODO_PARCIAL
          ? { ...base, inicio: horaAMs(tarea.fecha, datos.inicio), fin: horaAMs(tarea.fecha, datos.fin) }
          : base;
      }),
    });
  });

  return { tareas: listas, problemas };
};

// Lo que define a la tarea de cara a OpenField, sin el estado del envío. Se
// guarda con cada envío para saber si la tarea cambió desde entonces.
export const huellaTarea = (tarea) =>
  JSON.stringify({
    nombre: limpiar(tarea?.nombre),
    fecha: tarea?.fecha ?? "",
    inicio: tarea?.inicio ?? "",
    fin: tarea?.fin ?? "",
    pausas: tarea?.pausas ?? [],
    participantes: Object.fromEntries(
      Object.entries(tarea?.participantes || {}).sort(([a], [b]) => a.localeCompare(b)),
    ),
  });

// "enviada": el último envío de esta tarea salió bien y no se tocó desde
// entonces. "modificada": se envió alguna vez y cambió después. "pendiente":
// nunca llegó a OpenField (o el último envío falló).
export const estadoEnvioTarea = (tarea) => {
  if (!tarea?.envio) return "pendiente";
  if (!tarea.envio.ok) return "pendiente";
  return tarea.envio.huella === huellaTarea(tarea) ? "enviada" : "modificada";
};

export const segundosATexto = (segundos) => {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const minutos = Math.floor(total / 60);
  const segs = total % 60;
  return `${minutos}:${String(segs).padStart(2, "0")}`;
};
