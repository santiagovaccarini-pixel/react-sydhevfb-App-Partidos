// Lesiones en la base. Todo va con la sesión de quien usa la app; la base
// (RLS + puede_usar('lesiones')) decide si puede. Cada función devuelve
// { datos, error } con el error ya traducido a una clave del diccionario.
import { supabase } from "../supabase.js";
import { claveDeErrorDeBase, normalizarLesion } from "./lesiones.js";

const COLUMNAS =
  "id, equipo_id, jugador_id, fecha_lesion, fecha_alta, contexto, modo_inicio, mecanismo, region, lado, tejido, diagnostico, observaciones, recidiva_de, creado_en, actualizado_en";

const fallo = (error, porDefecto) => ({
  error: claveDeErrorDeBase(error) || porDefecto,
  detalle: error?.message || "",
});

// Solo las columnas que la app puede decidir.
const soloCampos = (lesion) => ({
  jugador_id: lesion.jugador_id,
  fecha_lesion: lesion.fecha_lesion,
  fecha_alta: lesion.fecha_alta || null,
  contexto: lesion.contexto,
  modo_inicio: lesion.modo_inicio,
  mecanismo: lesion.mecanismo || null,
  region: lesion.region,
  lado: lesion.lado,
  tejido: lesion.tejido || null,
  diagnostico: String(lesion.diagnostico || "").trim(),
  observaciones: String(lesion.observaciones || "").trim(),
  recidiva_de: lesion.recidiva_de || null,
});

export const listarLesiones = async (equipoId) => {
  if (!equipoId) return { lesiones: [], error: "" };
  const { data, error } = await supabase
    .from("lesiones")
    .select(COLUMNAS)
    .eq("equipo_id", equipoId)
    .order("fecha_lesion", { ascending: false });
  if (error) return { lesiones: [], ...fallo(error, "lesiones.error.noLeer") };
  return { lesiones: (data || []).map(normalizarLesion), error: "" };
};

export const crearLesion = async (equipoId, lesion) => {
  const { data, error } = await supabase
    .from("lesiones")
    .insert({ equipo_id: equipoId, ...soloCampos(lesion) })
    .select(COLUMNAS)
    .single();
  if (error) return fallo(error, "lesiones.error.noGuardar");
  return { lesion: normalizarLesion(data), error: "" };
};

export const actualizarLesion = async (id, lesion) => {
  const { data, error } = await supabase
    .from("lesiones")
    .update(soloCampos(lesion))
    .eq("id", id)
    .select(COLUMNAS)
    .single();
  if (error) return fallo(error, "lesiones.error.noGuardar");
  return { lesion: normalizarLesion(data), error: "" };
};

export const darAltaLesion = async (id, fechaAlta) => {
  const { data, error } = await supabase
    .from("lesiones")
    .update({ fecha_alta: fechaAlta })
    .eq("id", id)
    .select(COLUMNAS)
    .single();
  if (error) return fallo(error, "lesiones.error.noGuardar");
  return { lesion: normalizarLesion(data), error: "" };
};

// Los cambios de una lesión, del más nuevo al más viejo.
export const historialDeLesion = async (id) => {
  const { data, error } = await supabase
    .from("lesiones_historial")
    .select("id, accion, quien_email, cuando")
    .eq("lesion_id", id)
    .order("cuando", { ascending: false });
  if (error) return { cambios: [], ...fallo(error, "lesiones.error.noLeer") };
  return { cambios: data || [], error: "" };
};

export const borrarLesion = async (id) => {
  const { error } = await supabase.from("lesiones").delete().eq("id", id);
  if (error) return fallo(error, "lesiones.error.noBorrar");
  return { error: "" };
};
