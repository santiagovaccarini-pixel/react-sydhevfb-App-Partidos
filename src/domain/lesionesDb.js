// Lesiones en la base. Todo va con la sesión de quien usa la app; la base
// (RLS + puede_usar('lesiones')) decide si puede. Cada función devuelve
// { ..., error } con el error ya traducido a una clave del diccionario.
import { supabase } from "../supabase.js";
import { camposCambiados, claveDeErrorDeBase, normalizarLesion } from "./lesiones.js";
import { armarConfig, campoPorClave, esCalculado, filasParaSembrar } from "./lesionesCampos.js";
import { agregarJugador, cargarPlantel, normalizarJugador, quitarJugador } from "./plantel.js";
import { esSoloLectura, leerAlDia, masNuevasPrimero } from "./alDia.js";

const COLUMNAS =
  "id, equipo_id, jugador_id, numero_caso, fecha_lesion, fecha_transicion, fecha_retorno_entrenamiento, fecha_alta, datos, creado_en, actualizado_en";

const fallo = (error, porDefecto) => ({
  error: claveDeErrorDeBase(error) || porDefecto,
  detalle: error?.message || "",
});

// Los vacíos no se guardan, y lo que el Excel calcula tampoco (se calcula
// cada vez que se mira): así `datos` tiene solo lo cargado a mano. Lo que se
// cargó a mano en una columna que después pasó a calcularse queda.
const limpiarDatos = (datos = {}) =>
  Object.fromEntries(
    Object.entries(datos || {})
      .filter(([clave]) => !esCalculado(clave) || campoPorClave(clave)?.cargadoAntes)
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
  // Quien ya se fue del club: las lesiones de la foto de su último día.
  if (esSoloLectura(equipoId)) {
    try {
      return { lesiones: masNuevasPrimero(await leerAlDia("lesiones", equipoId), "fecha_lesion").map(normalizarLesion), error: "" };
    } catch (error) {
      return { lesiones: [], ...fallo(error, "lesiones.error.noLeer") };
    }
  }
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

// Los últimos cambios de una lesión, del más nuevo al más viejo, con las
// columnas que tocó cada edición.
export const CAMBIOS_EN_LA_FICHA = 5;

export const historialDeLesion = async (id) => {
  const { data, error } = await supabase
    .from("lesiones_historial")
    .select("id, accion, quien_email, cuando, antes, despues")
    .eq("lesion_id", id)
    .order("cuando", { ascending: false })
    .order("id", { ascending: false })
    .limit(CAMBIOS_EN_LA_FICHA);
  if (error) return { cambios: [], ...fallo(error, "lesiones.error.noLeer") };
  const cambios = (data || []).map(({ antes, despues, ...cambio }) => ({
    ...cambio,
    campos: cambio.accion === "editada" ? camposCambiados(antes, despues) : [],
  }));
  return { cambios, error: "" };
};

// ------------------------------------------------------------ Jugadores --

const COLUMNAS_JUGADOR = "id, nombre, roles, puestos, categoria, fecha_nacimiento, pie_dominante, posicion, foto_url";

export const normalizarJugadorLesiones = (fila) => ({
  ...normalizarJugador(fila),
  categoria: fila?.categoria || "",
  fecha_nacimiento: fila?.fecha_nacimiento || "",
  pie_dominante: fila?.pie_dominante || "",
  posicion: fila?.posicion || "",
  foto_url: fila?.foto_url || "",
});

const porNombre = (lista) => [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

// El mismo plantel que Partido, con los datos que pide el Excel. Si la base
// todavía no tiene esas columnas, vale la lista de siempre.
export const cargarPlantelLesiones = async (equipoId) => {
  if (!equipoId) return { plantel: [], error: "" };
  if (esSoloLectura(equipoId)) {
    try {
      return { plantel: porNombre((await leerAlDia("jugadores", equipoId)).map(normalizarJugadorLesiones)), error: "" };
    } catch (error) {
      return { plantel: [], ...fallo(error, "datos.error.leer") };
    }
  }
  const { data, error } = await supabase
    .from("jugadores")
    .select(COLUMNAS_JUGADOR)
    .eq("equipo_id", equipoId)
    .order("nombre", { ascending: true });
  if (!error) return { plantel: porNombre((data || []).map(normalizarJugadorLesiones)), error: "" };
  const respaldo = await cargarPlantel(equipoId);
  return { plantel: (respaldo.plantel || []).map(normalizarJugadorLesiones), error: "" };
};

// Solo lo que se mande: una celda de la tabla, o la ficha entera.
export const guardarDatosJugador = async (id, datos) => {
  const cambios = { actualizado_en: new Date().toISOString() };
  if ("nombre" in datos) cambios.nombre = String(datos.nombre || "").trim();
  if ("categoria" in datos) cambios.categoria = datos.categoria || null;
  if ("fecha_nacimiento" in datos) cambios.fecha_nacimiento = datos.fecha_nacimiento || null;
  if ("pie_dominante" in datos) cambios.pie_dominante = datos.pie_dominante || null;
  if ("posicion" in datos) cambios.posicion = datos.posicion || null;
  if ("foto_url" in datos) cambios.foto_url = String(datos.foto_url || "").trim() || null;
  if (cambios.nombre === "") return { error: "datos.error.nombre" };
  const { data, error } = await supabase.from("jugadores").update(cambios).eq("id", id).select(COLUMNAS_JUGADOR).single();
  if (error) {
    if (/duplicate key|unique/i.test(error.message || "")) return { error: "datos.error.repetido" };
    return fallo(error, "datos.error.guardar");
  }
  return { jugador: normalizarJugadorLesiones(data), error: "" };
};

// Alta y baja de jugadores desde Datos básicos: las mismas de Partido. El
// error del alta vuelve como clave del diccionario (Partido lo da en
// castellano), para que se lea en el idioma de la app.
export const agregarJugadorBasico = async (equipoId, nombre) => {
  const respuesta = await agregarJugador(nombre, equipoId);
  if (respuesta.error) {
    if (respuesta.error === "Escribí un nombre.") return { error: "datos.error.nombre" };
    if (/ya está en la lista/i.test(respuesta.error)) return { error: "datos.error.repetido" };
    return { error: "datos.error.guardar", detalle: respuesta.error };
  }
  return { jugador: normalizarJugadorLesiones(respuesta.jugador), error: "" };
};

export const quitarJugadorBasico = async (id) => {
  const respuesta = await quitarJugador(id);
  return respuesta.error ? { error: respuesta.error } : { error: "" };
};

// ------------------------------------------- Cabeceras y listas por club --

const leerFilasConfig = async (equipoId) => {
  const [campos, opciones] = await Promise.all([
    supabase.from("lesiones_campos").select("campo, etiqueta_es, etiqueta_pt, oculto, orden").eq("equipo_id", equipoId).order("orden"),
    supabase.from("lesiones_opciones").select("campo, codigo, etiqueta_es, etiqueta_pt, oculto, orden").eq("equipo_id", equipoId).order("orden"),
  ]);
  return { campos, opciones, error: campos.error || opciones.error };
};

// Lo que el catálogo del Excel tiene y el club todavía no: la primera vez
// es todo; después, lo que se haya sumado al catálogo. Nunca pisa lo que el
// club ya cambió (los repetidos se ignoran).
const completarSemilla = async (equipoId, filas) => {
  const semilla = filasParaSembrar(equipoId);
  const campos = new Set((filas.campos.data || []).map((fila) => fila.campo));
  const opciones = new Set((filas.opciones.data || []).map((fila) => `${fila.campo}|${fila.codigo}`));
  const camposNuevos = semilla.campos.filter((fila) => !campos.has(fila.campo));
  const opcionesNuevas = semilla.opciones.filter((fila) => !opciones.has(`${fila.campo}|${fila.codigo}`));
  // Si no se puede sembrar (quien ya se fue del club no escribe), se sigue
  // con lo que haya: para lo que falte valen los textos del Excel.
  if (camposNuevos.length) {
    const { error } = await supabase.from("lesiones_campos").upsert(camposNuevos, { onConflict: "equipo_id,campo", ignoreDuplicates: true });
    if (error) return { error: null, cambios: 0 };
  }
  if (opcionesNuevas.length) {
    const { error } = await supabase.from("lesiones_opciones").upsert(opcionesNuevas, { onConflict: "equipo_id,campo,codigo", ignoreDuplicates: true });
    if (error) return { error: null, cambios: 0 };
  }
  return { error: null, cambios: camposNuevos.length + opcionesNuevas.length };
};

// La configuración del club. La primera vez se siembra con el Excel; después
// se completa con lo que se sume al catálogo.
export const leerConfig = async (equipoId) => {
  if (!equipoId) return { config: armarConfig(), error: "" };
  let filas = await leerFilasConfig(equipoId);
  if (filas.error) return { config: armarConfig(), ...fallo(filas.error, "lesiones.error.noLeer") };
  const completado = await completarSemilla(equipoId, filas);
  if (completado.error) return { config: armarConfig(), ...fallo(completado.error, "lesiones.error.noLeer") };
  if (completado.cambios) {
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
