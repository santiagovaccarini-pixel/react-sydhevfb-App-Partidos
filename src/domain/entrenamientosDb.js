// La tabla `entrenamientos` de la base: una fila por entrenamiento, con las
// tareas adentro (jsonb) y unas columnas sueltas (fecha, nombre, estado) para
// listar sin bajar las tareas de todos. Quien llama decide qué hacer sin
// señal: acá solo se habla con la base.

import { supabase } from "../supabase.js";
import { normalizarEntrenamiento, resumenEntrenamiento } from "./entrenamiento.js";

export const TABLA_ENTRENAMIENTOS = "entrenamientos";

const COLUMNAS_LISTA =
  "id, equipo_id, fecha, nombre, actividad_id, actividad_nombre, estado, tareas_cantidad, actualizado_en";

export const filaDeEntrenamiento = (entrenamiento, { actualizadoPor = "" } = {}) => {
  const resumen = resumenEntrenamiento(entrenamiento);
  return {
    id: entrenamiento.id,
    equipo_id: entrenamiento.equipoId || null,
    fecha: entrenamiento.fecha,
    nombre: entrenamiento.nombre || "",
    actividad_id: entrenamiento.actividad?.id || "",
    actividad_nombre: entrenamiento.actividad?.name || "",
    estado: resumen.estado,
    tareas_cantidad: resumen.tareas,
    datos: {
      tareas: entrenamiento.tareas,
      actividad: entrenamiento.actividad,
      asignaciones: entrenamiento.asignaciones,
      ultimoEnvio: entrenamiento.ultimoEnvio,
      creadoEn: entrenamiento.creadoEn,
    },
    actualizado_en: entrenamiento.actualizadoEn,
    actualizado_por: String(actualizadoPor || ""),
  };
};

// Una fila completa vuelve a ser un entrenamiento. Lo leído de la base ya está
// guardado: guardadoEn es su actualizado_en.
export const entrenamientoDeFila = (fila) =>
  normalizarEntrenamiento({
    id: fila?.id,
    equipoId: fila?.equipo_id,
    fecha: fila?.fecha,
    nombre: fila?.nombre,
    ...(fila?.datos && typeof fila.datos === "object" ? fila.datos : {}),
    creadoEn: fila?.datos?.creadoEn || fila?.creado_en,
    actualizadoEn: fila?.actualizado_en,
    guardadoEn: fila?.actualizado_en,
  });

export const resumenDeFila = (fila) => ({
  id: String(fila?.id || ""),
  equipoId: fila?.equipo_id || null,
  fecha: String(fila?.fecha || ""),
  nombre: String(fila?.nombre || ""),
  actividadId: String(fila?.actividad_id || ""),
  actividadNombre: String(fila?.actividad_nombre || ""),
  estado: String(fila?.estado || "vacio"),
  tareas: Number(fila?.tareas_cantidad) || 0,
  actualizadoEn: String(fila?.actualizado_en || ""),
  guardadoEn: String(fila?.actualizado_en || ""),
});

export const listarEntrenamientosDb = async (equipoId = null, { limite = 100 } = {}) => {
  let consulta = supabase.from(TABLA_ENTRENAMIENTOS).select(COLUMNAS_LISTA);
  if (equipoId) consulta = consulta.eq("equipo_id", equipoId);
  const { data, error } = await consulta
    .order("fecha", { ascending: false })
    .order("actualizado_en", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(resumenDeFila).filter((fila) => fila.id);
};

export const leerEntrenamientoDb = async (id) => {
  const { data, error } = await supabase.from(TABLA_ENTRENAMIENTOS).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data && data.id ? entrenamientoDeFila(data) : null;
};

export const guardarEntrenamientoDb = async (entrenamiento, opciones = {}) => {
  const { error } = await supabase
    .from(TABLA_ENTRENAMIENTOS)
    .upsert(filaDeEntrenamiento(entrenamiento, opciones), { onConflict: "id" });
  if (error) throw error;
  return true;
};

export const borrarEntrenamientoDb = async (id) => {
  const { error } = await supabase.from(TABLA_ENTRENAMIENTOS).delete().eq("id", id);
  if (error) throw error;
  return true;
};
