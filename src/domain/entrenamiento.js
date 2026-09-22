// El entrenamiento como lo registra el cuerpo técnico: un día (y a veces un
// nombre, "Turno tarde"), sus tareas con horarios, pausas y jugadores, y, recién
// cuando se envían los cortes, la sesión de OpenField a la que van. Vive en el
// celular (lista local) y en la base (tabla `entrenamientos`); el celular es la
// copia de trabajo y la base la que comparten todos los aparatos.

import {
  CLAVE_ACTIVIDAD,
  CLAVE_SESION,
  estadoEnvioTarea,
  fechaDeActividad,
  hoyLocal,
  leerActividadElegida,
  normalizarActividad,
  normalizarTarea,
} from "./sesionEntrenamiento.js";

export const CLAVE_ENTRENAMIENTOS = "entrenamientos";
export const CLAVE_ENTRENAMIENTO_ACTUAL = "entrenamiento_actual";
// En el celular quedan los últimos; el resto vive en la base.
export const MAXIMO_LOCALES = 40;

export const ETIQUETAS_ESTADO_ENTRENAMIENTO = {
  vacio: "Sin tareas",
  "en-curso": "En curso",
  "sin-enviar": "Sin enviar",
  enviado: "Enviado",
};

const limpiar = (valor) => String(valor ?? "").trim();
const esFecha = (fecha) => /^\d{4}-\d{2}-\d{2}$/.test(limpiar(fecha));
const objeto = (valor) => (valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {});
const objetoONull = (valor) => (valor && typeof valor === "object" && !Array.isArray(valor) ? valor : null);

// Siempre un UUID: la columna id de la tabla es uuid.
export const generarIdEntrenamiento = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (letra) => {
    const azar = Math.floor(Math.random() * 16);
    return (letra === "x" ? azar : (azar % 4) + 8).toString(16);
  });
};

export const nuevoEntrenamiento = ({
  id = generarIdEntrenamiento(),
  fecha = "",
  nombre = "",
  equipoId = null,
  ahora = new Date(),
} = {}) => ({
  id,
  equipoId: limpiar(equipoId) || null,
  fecha: esFecha(fecha) ? limpiar(fecha) : hoyLocal(ahora),
  nombre: limpiar(nombre),
  tareas: [],
  // La sesión de OpenField se elige al enviar; hasta entonces no hace falta.
  actividad: null,
  asignaciones: {},
  ultimoEnvio: null,
  creadoEn: ahora.toISOString(),
  actualizadoEn: ahora.toISOString(),
  // Cuándo se subió a la base por última vez; vacío = todavía no.
  guardadoEn: "",
});

export const normalizarEntrenamiento = (entrenamiento) => {
  const id = limpiar(entrenamiento?.id);
  if (!id) return null;
  const fecha = esFecha(entrenamiento?.fecha) ? limpiar(entrenamiento.fecha) : hoyLocal();
  const creadoEn = limpiar(entrenamiento?.creadoEn) || limpiar(entrenamiento?.actualizadoEn) || new Date().toISOString();

  return {
    id,
    equipoId: limpiar(entrenamiento?.equipoId) || null,
    fecha,
    nombre: limpiar(entrenamiento?.nombre),
    tareas: (Array.isArray(entrenamiento?.tareas) ? entrenamiento.tareas : [])
      .map((tarea) => normalizarTarea(tarea, fecha))
      .filter((tarea) => tarea.id),
    actividad: normalizarActividad(entrenamiento?.actividad),
    asignaciones: objeto(entrenamiento?.asignaciones),
    ultimoEnvio: objetoONull(entrenamiento?.ultimoEnvio),
    creadoEn,
    actualizadoEn: limpiar(entrenamiento?.actualizadoEn) || creadoEn,
    guardadoEn: limpiar(entrenamiento?.guardadoEn),
  };
};

// Lo que se muestra en una fila de la lista, sin recorrer las tareas cada vez.
export const resumenEntrenamiento = (entrenamiento) => {
  const tareas = Array.isArray(entrenamiento?.tareas) ? entrenamiento.tareas : [];
  const estados = tareas.map(estadoEnvioTarea);
  const enCurso = tareas.some((tarea) => tarea.inicio && !tarea.fin);
  const pendientes = estados.filter((estado) => estado === "pendiente").length;
  const conCambios = estados.filter((estado) => estado === "modificada").length;
  const sinEnviar = pendientes + conCambios;
  const estado = tareas.length === 0 ? "vacio" : enCurso ? "en-curso" : sinEnviar > 0 ? "sin-enviar" : "enviado";

  return { tareas: tareas.length, enCurso, pendientes, conCambios, sinEnviar, estado };
};

export const resumenLocal = (entrenamiento) => ({
  id: entrenamiento.id,
  equipoId: entrenamiento.equipoId,
  fecha: entrenamiento.fecha,
  nombre: entrenamiento.nombre,
  actividadId: entrenamiento.actividad?.id || "",
  actividadNombre: entrenamiento.actividad?.name || "",
  ...resumenEntrenamiento(entrenamiento),
  actualizadoEn: entrenamiento.actualizadoEn,
  guardadoEn: entrenamiento.guardadoEn,
});

// "22/09" y "martes 22 de septiembre", sin que el huso corra la fecha.
const fechaLocal = (fecha) => (esFecha(fecha) ? new Date(`${fecha}T12:00:00`) : null);

export const fechaCorta = (fecha) => {
  const partes = limpiar(fecha).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}` : "";
};

export const fechaLarga = (fecha) => {
  const valor = fechaLocal(fecha);
  return valor ? valor.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }) : "";
};

// "mar 22/09 · Turno tarde": para la cabecera del tablero.
export const etiquetaEntrenamiento = (entrenamiento) => {
  const valor = fechaLocal(entrenamiento?.fecha);
  const dia = valor ? valor.toLocaleDateString("es-AR", { weekday: "short" }).replace(/\.$/, "") : "";
  const base = [dia, fechaCorta(entrenamiento?.fecha)].filter(Boolean).join(" ");
  return entrenamiento?.nombre ? `${base} · ${entrenamiento.nombre}` : base;
};

export const tocar = (entrenamiento, ahora = new Date()) => ({ ...entrenamiento, actualizadoEn: ahora.toISOString() });

// Todavía no está en la base, o cambió después de la última subida.
export const sinSubir = (entrenamiento) =>
  !entrenamiento.guardadoEn || entrenamiento.guardadoEn < entrenamiento.actualizadoEn;

export const ordenarEntrenamientos = (lista) =>
  [...lista].sort(
    (a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.creadoEn || "").localeCompare(String(a.creadoEn || "")),
  );

// Se conservan los últimos `maximo`, pero nunca se suelta uno que todavía no
// subió a la base: eso sería perderlo.
export const recortarLocales = (lista, maximo = MAXIMO_LOCALES) => {
  const ordenada = ordenarEntrenamientos(lista);
  if (ordenada.length <= maximo) return ordenada;
  const pendientes = ordenada.filter(sinSubir);
  const guardados = ordenada.filter((entrenamiento) => !sinSubir(entrenamiento));
  return ordenarEntrenamientos([...pendientes, ...guardados.slice(0, Math.max(0, maximo - pendientes.length))]);
};

// Vincular (o cambiar) la sesión de OpenField. Cambiarla deja las tareas como
// sin enviar: lo enviado fue a otra sesión, y las asignaciones son de aquella.
export const vincularActividad = (entrenamiento, actividad) => {
  const limpia = normalizarActividad(actividad);
  const cambia = (limpia?.id || "") !== (entrenamiento.actividad?.id || "");
  return {
    ...entrenamiento,
    actividad: limpia,
    asignaciones: cambia ? {} : entrenamiento.asignaciones,
    ultimoEnvio: cambia ? null : entrenamiento.ultimoEnvio,
    tareas: cambia ? entrenamiento.tareas.map((tarea) => ({ ...tarea, envio: null })) : entrenamiento.tareas,
  };
};

// Entre la copia del celular y la de la base gana la más nueva.
export const masNuevo = (local, remoto) => {
  if (!local) return remoto || null;
  if (!remoto) return local;
  return String(remoto.actualizadoEn) >= String(local.actualizadoEn) ? remoto : local;
};

export const leerEntrenamientosLocales = () => {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_ENTRENAMIENTOS) || "[]");
    return (Array.isArray(lista) ? lista : []).map(normalizarEntrenamiento).filter(Boolean);
  } catch {
    return [];
  }
};

export const guardarEntrenamientosLocales = (lista) => {
  try {
    localStorage.setItem(CLAVE_ENTRENAMIENTOS, JSON.stringify(recortarLocales(lista)));
    return true;
  } catch {
    return false;
  }
};

export const leerEntrenamientoActualId = () => {
  try {
    return limpiar(localStorage.getItem(CLAVE_ENTRENAMIENTO_ACTUAL));
  } catch {
    return "";
  }
};

export const guardarEntrenamientoActualId = (id) => {
  try {
    if (id) localStorage.setItem(CLAVE_ENTRENAMIENTO_ACTUAL, id);
    else localStorage.removeItem(CLAVE_ENTRENAMIENTO_ACTUAL);
  } catch {
    // Sin localStorage la app sigue, sin recordar.
  }
};

// Las sesiones del formato anterior (una por actividad de OpenField, guardadas
// como entrenamiento_sesion:<id>) pasan a entrenamientos con esa sesión ya
// vinculada, y se borran del formato viejo. Devuelve los migrados.
export const migrarSesionesViejas = ({ equipoId = null, ahora = new Date() } = {}) => {
  const migrados = [];
  try {
    const claves = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const clave = localStorage.key(i);
      if (clave && clave.startsWith(`${CLAVE_SESION}:`)) claves.push(clave);
    }
    const elegida = leerActividadElegida();

    claves.forEach((clave) => {
      const activityId = clave.slice(CLAVE_SESION.length + 1);
      let vieja = null;
      try {
        vieja = JSON.parse(localStorage.getItem(clave) || "null");
      } catch {
        vieja = null;
      }
      const tareas = (Array.isArray(vieja?.tareas) ? vieja.tareas : []).map((tarea) => normalizarTarea(tarea)).filter((tarea) => tarea.id);

      if (tareas.length > 0) {
        const actividad =
          elegida?.id === activityId
            ? elegida
            : { id: activityId, name: limpiar(vieja?.activityName), start_time: null, end_time: null };
        const fecha = tareas.find((tarea) => tarea.fecha)?.fecha || fechaDeActividad(actividad, ahora);
        migrados.push({
          ...nuevoEntrenamiento({ fecha, equipoId, ahora }),
          tareas,
          actividad: normalizarActividad(actividad),
          asignaciones: objeto(vieja?.asignaciones),
          ultimoEnvio: objetoONull(vieja?.ultimoEnvio),
        });
      }
      localStorage.removeItem(clave);
    });
    localStorage.removeItem(CLAVE_ACTIVIDAD);
  } catch {
    // Sin localStorage no hay nada que migrar.
  }
  return migrados;
};
