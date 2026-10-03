// Los períodos guardados de "Lesiones c/1000h y días perdidos" en la base
// (lesiones_periodos): solo el nombre y las fechas; los números se calculan
// cada vez. Todo va con la sesión de quien usa la app; la base (RLS) decide
// si puede. Cada función devuelve { ..., error } con el error ya traducido a
// una clave del diccionario.
import { supabase } from "../supabase.js";
import { claveDeErrorDeBase } from "./lesiones.js";

const COLUMNAS = "id, equipo_id, nombre, desde, hasta, creado_en";

// Lo que dice la base, en palabras de los períodos.
export const claveDeErrorDePeriodo = (error, porDefecto = "lesiones.periodos.error.noGuardar") => {
  const mensaje = String(error?.message || "");
  const codigo = String(error?.code || "");
  if (codigo === "42P01" || /lesiones_periodos.*(does not exist|schema cache)|Could not find the table/i.test(mensaje)) return "lesiones.periodos.error.faltaMigracion";
  if (codigo === "23505" || /lesiones_periodos_nombre_unico/i.test(mensaje)) return "lesiones.periodos.error.repetido";
  if (/lesiones_periodos_fechas/i.test(mensaje)) return "lesiones.periodos.error.fechas";
  if (/lesiones_periodos_nombre/i.test(mensaje)) return "lesiones.periodos.error.nombre";
  return claveDeErrorDeBase(error) || porDefecto;
};

const normalizar = (fila) => ({ id: fila.id, nombre: fila.nombre || "", desde: fila.desde || "", hasta: fila.hasta || "" });

export const listarPeriodos = async (equipoId) => {
  if (!equipoId) return { periodos: [], error: "" };
  const { data, error } = await supabase.from("lesiones_periodos").select(COLUMNAS).eq("equipo_id", equipoId).order("creado_en", { ascending: true });
  if (error) return { periodos: [], error: claveDeErrorDePeriodo(error, "lesiones.periodos.error.noLeer") };
  return { periodos: (data || []).map(normalizar), error: "" };
};

// Sin fecha de inicio, desde la primera lesión.
export const guardarPeriodo = async (equipoId, { nombre, desde, hasta }) => {
  const { data, error } = await supabase
    .from("lesiones_periodos")
    .insert({ equipo_id: equipoId, nombre: String(nombre || "").trim(), desde: desde || null, hasta })
    .select(COLUMNAS)
    .single();
  if (error) return { error: claveDeErrorDePeriodo(error) };
  return { periodo: normalizar(data), error: "" };
};

export const borrarPeriodo = async (id) => {
  const { error } = await supabase.from("lesiones_periodos").delete().eq("id", id);
  if (error) return { error: claveDeErrorDePeriodo(error, "lesiones.periodos.error.noBorrar") };
  return { error: "" };
};
