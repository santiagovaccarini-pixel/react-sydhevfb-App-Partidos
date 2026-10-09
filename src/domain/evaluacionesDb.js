// Evaluaciones en la base (migración 20261012_evaluaciones.sql). Todo va con
// la sesión de quien usa la app; la base (RLS + puede_usar_en('evaluaciones'))
// decide si puede. Cada función devuelve { ..., error } con el error ya
// traducido a una clave del diccionario.
import { supabase } from "../supabase.js";
import { esSoloLectura } from "./alDia.js";

const COLUMNAS = "id, equipo_id, test, orden, jugador_id, persona, fecha, datos, creado_en, actualizado_en";

// La API devuelve hasta 1000 filas por vez: se piden de a 1000 hasta el final.
const POR_VEZ = 1000;

export const claveDeErrorEvaluaciones = (error, porDefecto = "evaluaciones.error.noGuardar") => {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  // Sin la migración: la tabla o la columna del permiso no existen todavía.
  if (["42P01", "PGRST205", "42883"].includes(error?.code) || (/evaluaciones/.test(texto) && /does not exist|schema cache|Could not find/i.test(texto))) {
    return "evaluaciones.error.faltaMigracion";
  }
  if (/jugador_de_otro_club/.test(texto)) return "evaluaciones.error.jugadorDeOtroClub";
  if (/evaluaciones_sin_futuro/.test(texto)) return "evaluaciones.error.fechaFutura";
  if (/evaluaciones_de_quien/.test(texto)) return "evaluaciones.error.sinJugador";
  if (error?.code === "42501" || /row-level security|permission denied/.test(texto)) return "evaluaciones.error.sinPermiso";
  // Sin señal: al guardar, "no se pudo guardar"; al leer o borrar, el
  // mensaje de lo que se estaba haciendo (como en Lesiones).
  if (/Failed to fetch|NetworkError|Load failed/i.test(texto)) return porDefecto === "evaluaciones.error.noGuardar" ? "evaluaciones.error.sinConexion" : porDefecto;
  return porDefecto;
};

const fallo = (error, porDefecto) => ({ error: claveDeErrorEvaluaciones(error, porDefecto), detalle: error?.message || "" });

export const normalizarEvaluacion = (fila) => ({
  id: fila?.id ?? null,
  equipo_id: fila?.equipo_id ?? null,
  test: fila?.test || "",
  orden: Number(fila?.orden) || 0,
  jugador_id: fila?.jugador_id ?? null,
  persona: fila?.persona ?? null,
  fecha: fila?.fecha || null,
  datos: fila?.datos && typeof fila.datos === "object" && !Array.isArray(fila.datos) ? fila.datos : {},
});

// Lo cargado, sin vacíos: así `datos` tiene solo lo que se escribió.
const limpiarDatos = (datos = {}) =>
  Object.fromEntries(
    Object.entries(datos || {})
      .map(([clave, valor]) => [clave, typeof valor === "string" ? valor.trim() : valor])
      .filter(([, valor]) => valor !== null && valor !== undefined && valor !== ""),
  );

// Solo lo que la app decide: de quién es (un jugador o, si no, una persona),
// la fecha y lo cargado.
const soloCampos = (evaluacion) => ({
  jugador_id: evaluacion.jugador_id || null,
  persona: evaluacion.jugador_id ? null : String(evaluacion.persona || "").replace(/\s+/g, " ").trim() || null,
  fecha: evaluacion.fecha || null,
  datos: limpiarDatos(evaluacion.datos),
});

// Todas las filas de un pedido, de a 1000. pedir(desde, hasta) arma la consulta.
const todas = async (pedir) => {
  const filas = [];
  for (let desde = 0; ; desde += POR_VEZ) {
    const { data, error } = await pedir(desde, desde + POR_VEZ - 1); // eslint-disable-line no-await-in-loop
    if (error) return { filas, error };
    const pagina = Array.isArray(data) ? data : [];
    filas.push(...pagina);
    if (pagina.length < POR_VEZ) return { filas, error: null };
  }
};

// La foto del último día de quien ya se fue del club (datos_al_dia), entera.
const fotoAlDia = (tabla, equipoId) =>
  todas((desde, hasta) => supabase.rpc("datos_al_dia", { p_tabla: tabla, p_equipo: equipoId }).range(desde, hasta));

// Las evaluaciones del club, de todos los tests (o de uno, si se pide), en el
// orden de carga.
export const listarEvaluaciones = async (equipoId, test = null) => {
  if (!equipoId) return { evaluaciones: [], error: "" };
  if (esSoloLectura(equipoId)) {
    const { filas, error } = await fotoAlDia("evaluaciones", equipoId);
    if (error) return { evaluaciones: [], ...fallo(error, "evaluaciones.error.noLeer") };
    return {
      evaluaciones: filas
        .filter((fila) => fila && typeof fila === "object" && (!test || fila.test === test))
        .map(normalizarEvaluacion)
        .sort((a, b) => a.orden - b.orden),
      error: "",
    };
  }
  const { filas, error } = await todas((desde, hasta) => {
    const consulta = supabase.from("evaluaciones").select(COLUMNAS).eq("equipo_id", equipoId);
    return (test ? consulta.eq("test", test) : consulta).order("orden", { ascending: true }).range(desde, hasta);
  });
  if (error) return { evaluaciones: [], ...fallo(error, "evaluaciones.error.noLeer") };
  return { evaluaciones: filas.map(normalizarEvaluacion), error: "" };
};

// Los valores de referencia del club, por test: { test: datos } (un test que
// todavía no los tiene no está).
export const leerReferencias = async (equipoId) => {
  if (!equipoId) return { referencias: {}, error: "" };
  const porTest = (filas) => Object.fromEntries(filas.filter((fila) => fila && typeof fila === "object" && fila.test && fila.datos).map((fila) => [fila.test, fila.datos]));
  if (esSoloLectura(equipoId)) {
    const { filas, error } = await fotoAlDia("evaluaciones_referencias", equipoId);
    if (error) return { referencias: {}, ...fallo(error, "evaluaciones.error.noLeer") };
    return { referencias: porTest(filas), error: "" };
  }
  const { data, error } = await supabase.from("evaluaciones_referencias").select("test, datos").eq("equipo_id", equipoId);
  if (error) return { referencias: {}, ...fallo(error, "evaluaciones.error.noLeer") };
  return { referencias: porTest(Array.isArray(data) ? data : []), error: "" };
};

export const crearEvaluacion = async (equipoId, test, evaluacion) => {
  const { data, error } = await supabase
    .from("evaluaciones")
    .insert({ equipo_id: equipoId, test, ...soloCampos(evaluacion) })
    .select(COLUMNAS)
    .single();
  if (error) return fallo(error, "evaluaciones.error.noGuardar");
  return { evaluacion: normalizarEvaluacion(data), error: "" };
};

export const actualizarEvaluacion = async (id, evaluacion) => {
  const { data, error } = await supabase.from("evaluaciones").update(soloCampos(evaluacion)).eq("id", id).select(COLUMNAS).single();
  if (error) return fallo(error, "evaluaciones.error.noGuardar");
  return { evaluacion: normalizarEvaluacion(data), error: "" };
};

export const borrarEvaluacion = async (id) => {
  const { error } = await supabase.from("evaluaciones").delete().eq("id", id);
  if (error) return fallo(error, "evaluaciones.error.noBorrar");
  return { error: "" };
};

// ------------------------------------------------------------- Ajustes --
// El nombre de cada cabecera y las opciones de cada lista en el club
// (migración 20261015_evaluaciones_ajustes.sql). Sin esas tablas todavía, la
// app sigue con los nombres del Excel: los Ajustes avisan al guardar.

const COLUMNAS_CAMPOS = "test, campo, etiqueta_es, etiqueta_pt, oculto, orden";
const COLUMNAS_OPCIONES = "lista, codigo, etiqueta_es, etiqueta_pt, oculto, orden";

// { campos: [filas], opciones: [filas], error }. Si las tablas todavía no
// están, vuelve vacío y sin error (valen los nombres del Excel).
export const leerAjustes = async (equipoId) => {
  if (!equipoId) return { campos: [], opciones: [], error: "" };
  const [campos, opciones] = await Promise.all([
    supabase.from("evaluaciones_campos").select(COLUMNAS_CAMPOS).eq("equipo_id", equipoId),
    supabase.from("evaluaciones_opciones").select(COLUMNAS_OPCIONES).eq("equipo_id", equipoId).order("orden", { ascending: true }),
  ]);
  const error = campos.error || opciones.error;
  if (error) {
    const clave = claveDeErrorEvaluaciones(error, "evaluaciones.error.noLeer");
    if (clave === "evaluaciones.error.faltaMigracion") return { campos: [], opciones: [], error: "" };
    return { campos: [], opciones: [], error: clave };
  }
  return { campos: campos.data || [], opciones: opciones.data || [], error: "" };
};

const sinMigracionDeAjustes = (error) => {
  const texto = `${error?.message || ""} ${error?.details || ""}`;
  return ["42P01", "PGRST205"].includes(error?.code) || (/evaluaciones_(campos|opciones)/.test(texto) && /does not exist|schema cache|Could not find/i.test(texto));
};

const falloDeAjustes = (error) =>
  sinMigracionDeAjustes(error) ? { error: "evaluaciones.ajustes.faltaMigracion" } : { error: claveDeErrorEvaluaciones(error, "evaluaciones.ajustes.errorGuardar") };

const textoLimpio = (texto) => String(texto || "").trim();

export const guardarCabecera = async (equipoId, test, campo, { etiquetas = {}, oculto = false, orden = 0 }) => {
  const { error } = await supabase.from("evaluaciones_campos").upsert(
    {
      equipo_id: equipoId,
      test,
      campo,
      etiqueta_es: textoLimpio(etiquetas["es-AR"]),
      etiqueta_pt: textoLimpio(etiquetas["pt-BR"]),
      oculto: Boolean(oculto),
      orden,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "equipo_id,test,campo" },
  );
  if (error) return falloDeAjustes(error);
  return { error: "" };
};

export const guardarOpcionDeLista = async (equipoId, lista, { codigo, etiquetas = {}, oculto = false, orden = 0 }) => {
  const { error } = await supabase.from("evaluaciones_opciones").upsert(
    {
      equipo_id: equipoId,
      lista,
      codigo,
      etiqueta_es: textoLimpio(etiquetas["es-AR"]),
      etiqueta_pt: textoLimpio(etiquetas["pt-BR"]),
      oculto: Boolean(oculto),
      orden,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "equipo_id,lista,codigo" },
  );
  if (error) return falloDeAjustes(error);
  return { error: "" };
};
