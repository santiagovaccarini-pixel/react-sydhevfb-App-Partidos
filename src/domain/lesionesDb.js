// Lesiones en la base. Todo va con la sesión de quien usa la app; la base
// (RLS + puede_usar('lesiones')) decide si puede. Cada función devuelve
// { ..., error } con el error ya traducido a una clave del diccionario.
import { supabase } from "../supabase.js";
import { claveDeErrorDeBase, normalizarLesion } from "./lesiones.js";
import { armarConfig, filasParaSembrar } from "./lesionesCampos.js";
import { cargarPlantel, normalizarJugador } from "./plantel.js";

const COLUMNAS =
  "id, equipo_id, jugador_id, numero_caso, fecha_lesion, fecha_transicion, fecha_retorno_entrenamiento, fecha_alta, datos, creado_en, actualizado_en";

const fallo = (error, porDefecto) => ({
  error: claveDeErrorDeBase(error) || porDefecto,
  detalle: error?.message || "",
});

// Los vacíos no se guardan: así `datos` tiene solo lo cargado.
const limpiarDatos = (datos = {}) =>
  Object.fromEntries(
    Object.entries(datos || {})
      .map(([clave, valor]) => [clave, typeof valor === "string" ? valor.trim() : valor])
      .filter(([, valor]) => valor !== null && valor !== undefined && valor !== ""),
  );

// Solo las columnas que la app puede decidir.
const soloCampos = (lesion) => ({
  jugador_id: lesion.jugador_id,
  fecha_lesion: lesion.fecha_lesion,
  fecha_transicion: lesion.fecha_transicion || null,
  fecha_retorno_entrenamiento: lesion.fecha_retorno_entrenamiento || null,
  fecha_alta: lesion.fecha_alta || null,
  datos: limpiarDatos(lesion.datos),
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

export const borrarLesion = async (id) => {
  const { error } = await supabase.from("lesiones").delete().eq("id", id);
  if (error) return fallo(error, "lesiones.error.noBorrar");
  return { error: "" };
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

// ------------------------------------------------------------ Jugadores --

const COLUMNAS_JUGADOR = "id, nombre, roles, puestos, numero_registro, categoria, fecha_nacimiento, pie_dominante";

export const normalizarJugadorLesiones = (fila) => ({
  ...normalizarJugador(fila),
  numero_registro: String(fila?.numero_registro ?? "").trim(),
  categoria: fila?.categoria || "",
  fecha_nacimiento: fila?.fecha_nacimiento || "",
  pie_dominante: fila?.pie_dominante || "",
});

const porNombre = (lista) => [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

// El mismo plantel que Partido, con los datos que pide el Excel. Si la base
// todavía no tiene esas columnas, vale la lista de siempre.
export const cargarPlantelLesiones = async (equipoId) => {
  if (!equipoId) return { plantel: [], error: "" };
  const { data, error } = await supabase
    .from("jugadores")
    .select(COLUMNAS_JUGADOR)
    .eq("equipo_id", equipoId)
    .order("nombre", { ascending: true });
  if (!error) return { plantel: porNombre((data || []).map(normalizarJugadorLesiones)), error: "" };
  const respaldo = await cargarPlantel(equipoId);
  return { plantel: (respaldo.plantel || []).map(normalizarJugadorLesiones), error: "" };
};

export const guardarDatosJugador = async (id, datos) => {
  const { data, error } = await supabase
    .from("jugadores")
    .update({
      numero_registro: String(datos.numero_registro || "").trim() || null,
      categoria: datos.categoria || null,
      fecha_nacimiento: datos.fecha_nacimiento || null,
      pie_dominante: datos.pie_dominante || null,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id)
    .select(COLUMNAS_JUGADOR)
    .single();
  if (error) return fallo(error, "lesiones.plantel.errorGuardar");
  return { jugador: normalizarJugadorLesiones(data), error: "" };
};

// ------------------------------------------- Cabeceras y listas por club --

const leerFilasConfig = async (equipoId) => {
  const [campos, opciones] = await Promise.all([
    supabase.from("lesiones_campos").select("campo, etiqueta_es, etiqueta_pt, oculto, orden").eq("equipo_id", equipoId).order("orden"),
    supabase.from("lesiones_opciones").select("campo, codigo, etiqueta_es, etiqueta_pt, oculto, orden").eq("equipo_id", equipoId).order("orden"),
  ]);
  return { campos, opciones, error: campos.error || opciones.error };
};

// La configuración del club. La primera vez, se siembra con el Excel.
export const leerConfig = async (equipoId) => {
  if (!equipoId) return { config: armarConfig(), error: "" };
  let filas = await leerFilasConfig(equipoId);
  if (filas.error) return { config: armarConfig(), ...fallo(filas.error, "lesiones.error.noLeer") };
  if ((filas.campos.data || []).length === 0) {
    const semilla = filasParaSembrar(equipoId);
    const sembrado = await supabase.from("lesiones_campos").upsert(semilla.campos, { onConflict: "equipo_id,campo", ignoreDuplicates: true });
    if (sembrado.error) return { config: armarConfig(), ...fallo(sembrado.error, "lesiones.error.noLeer") };
    const sembradas = await supabase.from("lesiones_opciones").upsert(semilla.opciones, { onConflict: "equipo_id,campo,codigo", ignoreDuplicates: true });
    if (sembradas.error) return { config: armarConfig(), ...fallo(sembradas.error, "lesiones.error.noLeer") };
    filas = await leerFilasConfig(equipoId);
    if (filas.error) return { config: armarConfig(), ...fallo(filas.error, "lesiones.error.noLeer") };
  }
  return { config: armarConfig(filas.campos.data || [], filas.opciones.data || []), error: "" };
};

export const guardarCampo = async (equipoId, campo, { etiquetas = {}, oculto = false, orden = 0 }) => {
  const { error } = await supabase.from("lesiones_campos").upsert(
    {
      equipo_id: equipoId,
      campo,
      etiqueta_es: String(etiquetas["es-AR"] || "").trim(),
      etiqueta_pt: String(etiquetas["pt-BR"] || "").trim(),
      oculto: Boolean(oculto),
      orden,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "equipo_id,campo" },
  );
  if (error) return fallo(error, "lesiones.ajustes.errorGuardar");
  return { error: "" };
};

export const guardarOpcion = async (equipoId, campo, { codigo, etiquetas = {}, oculto = false, orden = 0 }) => {
  const { error } = await supabase.from("lesiones_opciones").upsert(
    {
      equipo_id: equipoId,
      campo,
      codigo,
      etiqueta_es: String(etiquetas["es-AR"] || "").trim(),
      etiqueta_pt: String(etiquetas["pt-BR"] || "").trim(),
      oculto: Boolean(oculto),
      orden,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "equipo_id,campo,codigo" },
  );
  if (error) return fallo(error, "lesiones.ajustes.errorGuardar");
  return { error: "" };
};
