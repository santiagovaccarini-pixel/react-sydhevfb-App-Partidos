import { supabase } from "../supabase.js";

// Las notas de la app (tabla `notas`): las mejoras que se quieren hacer,
// anotadas adentro de la app. Las escriben y las leen solo los dueños de la
// plataforma; quién escribió cada una y cuándo lo pone la base.

const TABLA_NOTAS = "notas";
const COLUMNAS_NOTA = "id, texto, hecha, creado_email, creado_en, actualizado_en";
export const LARGO_MAXIMO_NOTA = 2000;

const FALLO_DE_RED = /failed to fetch|load failed|networkerror|network request failed|fetch failed/i;

// Los errores de la base como claves del diccionario.
export const claveDeError = (error, porDefecto = "notas.errorCargar") => {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  if (FALLO_DE_RED.test(texto)) return "comun.sinConexion";
  if (/notas_texto_check/.test(texto)) return "notas.errorTexto";
  if (error?.code === "42501" || /row-level security|permission denied/.test(texto)) return "notas.errorSinPermiso";
  if (error?.code === "42P01" || error?.code === "PGRST205" || /does not exist|could not find the table/i.test(texto)) return "notas.errorFaltaMigracion";
  return porDefecto;
};

const fallo = (error, porDefecto) => new Error(claveDeError(error, porDefecto));

const normalizarNota = (fila) => ({
  id: fila.id,
  texto: fila.texto || "",
  hecha: Boolean(fila.hecha),
  creado_email: fila.creado_email || "",
  creado_en: fila.creado_en || null,
  actualizado_en: fila.actualizado_en || null,
});

// Primero las que faltan hacer y después las hechas; en cada grupo, la más
// nueva arriba.
export const ordenarNotas = (lista) =>
  [...(lista || [])].sort((a, b) => {
    if (a.hecha !== b.hecha) return a.hecha ? 1 : -1;
    return String(b.creado_en || "").localeCompare(String(a.creado_en || ""));
  });

export const listarNotas = async () => {
  const { data, error } = await supabase.from(TABLA_NOTAS).select(COLUMNAS_NOTA).order("creado_en", { ascending: false });
  if (error) throw fallo(error, "notas.errorCargar");
  return ordenarNotas((data || []).map(normalizarNota));
};

export const agregarNota = async (texto) => {
  const limpio = String(texto || "").trim();
  if (!limpio) throw new Error("notas.errorTexto");
  const { data, error } = await supabase.from(TABLA_NOTAS).insert({ texto: limpio }).select(COLUMNAS_NOTA).single();
  if (error) throw fallo(error, "notas.errorGuardar");
  return normalizarNota(data);
};

// Cambia el texto o si está hecha (lo que venga en `cambios`).
export const cambiarNota = async (id, cambios) => {
  const fila = {};
  if (typeof cambios?.texto === "string") {
    fila.texto = cambios.texto.trim();
    if (!fila.texto) throw new Error("notas.errorTexto");
  }
  if (typeof cambios?.hecha === "boolean") fila.hecha = cambios.hecha;
  const { data, error } = await supabase.from(TABLA_NOTAS).update(fila).eq("id", id).select(COLUMNAS_NOTA);
  if (error) throw fallo(error, "notas.errorGuardar");
  if (!data?.length) throw new Error("notas.errorSinPermiso");
  return normalizarNota(data[0]);
};

export const borrarNota = async (id) => {
  const { data, error } = await supabase.from(TABLA_NOTAS).delete().eq("id", id).select("id");
  if (error) throw fallo(error, "notas.errorBorrar");
  if (!data?.length) throw new Error("notas.errorSinPermiso");
};
