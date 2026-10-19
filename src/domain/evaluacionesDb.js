// Evaluaciones en la base (migración 20261012_evaluaciones.sql). Todo va con
// la sesión de quien usa la app; la base (RLS + puede_usar_en('evaluaciones'))
// decide si puede. Cada función devuelve { ..., error } con el error ya
// traducido a una clave del diccionario.
import { supabase } from "../supabase.js";
import { esSoloLectura } from "./alDia.js";
import { claveDeErrorConsentimiento } from "./consentimiento.js";
import { faltaSentido, sentidoGuardado } from "./sentido.js";

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
  // Sin la confirmación del consentimiento (20261103).
  if (claveDeErrorConsentimiento(error)) return claveDeErrorConsentimiento(error);
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

// Un valor de los V.R. de un test (Santiago, 14/10: se cambian en la solapa
// «Valores de referencia»; migración 20261025_referencias_editables.sql):
// ruta, dónde (["categorias", "mayor", "bueno", "lumbar"]); valor, un
// número, un bloque entero o null (se borra). Se cambia en la base, de a
// uno: dos personas a la vez no se pisan. Devuelve los V.R. del test como
// quedaron.
export const cambiarReferencia = async (equipoId, test, ruta, valor) => {
  const { data, error } = await supabase.rpc("evaluaciones_referencia_cambiar", { p_equipo: equipoId, p_test: test, p_ruta: ruta, p_valor: valor === undefined ? null : valor });
  if (error) {
    const texto = `${error?.message || ""} ${error?.details || ""}`;
    if (/referencia_invalida/.test(texto)) return { error: "evaluaciones.referencias.noSeGuardo" };
    const clave = claveDeErrorEvaluaciones(error);
    return { error: clave === "evaluaciones.error.faltaMigracion" ? "evaluaciones.referencias.faltaActualizacion" : clave };
  }
  return { datos: data && typeof data === "object" && !Array.isArray(data) ? data : {}, error: "" };
};

// Las categorías del club (Datos básicos › Ajustes › Listas › Categoría): son
// la Selección de Evaluaciones (Santiago, 18/10). Solo se leen (las ve
// cualquiera que sigue en el club). Si no se pueden leer, o quien mira ya se
// fue del club, valen las de la app: { filas } o { filas: null }.
export const leerCategorias = async (equipoId) => {
  if (!equipoId || esSoloLectura(equipoId)) return { filas: null, error: "" };
  const { data, error } = await supabase
    .from("lesiones_opciones")
    .select("campo, codigo, etiqueta_es, etiqueta_pt, oculto, orden")
    .eq("equipo_id", equipoId)
    .eq("campo", "categoria")
    .order("orden");
  if (error) return { filas: null, ...fallo(error, "evaluaciones.error.noLeer") };
  return { filas: Array.isArray(data) ? data : [], error: "" };
};

// La Selección de las evaluaciones al cambiarle la categoría a un jugador
// (Datos básicos; Santiago, 18/10, como en Lesiones). Las evaluaciones de
// cada jugador, livianas: { [jugador_id]: [{ id, fecha, datos }] }. Sin
// Evaluaciones (o en solo lectura) no se ve ninguna, y no se pregunta.
export const leerEvaluacionesPorJugador = async (equipoId) => {
  if (!equipoId || esSoloLectura(equipoId)) return { porJugador: {}, error: "" };
  const { filas, error } = await todas((desde, hasta) =>
    supabase.from("evaluaciones").select("id, jugador_id, fecha, datos").eq("equipo_id", equipoId).not("jugador_id", "is", null).order("id").range(desde, hasta),
  );
  if (error) return { porJugador: {}, ...fallo(error, "evaluaciones.error.noLeer") };
  const porJugador = {};
  filas.forEach((fila) => {
    const evaluacion = { id: fila.id, fecha: fila.fecha || null, datos: fila.datos && typeof fila.datos === "object" && !Array.isArray(fila.datos) ? fila.datos : {} };
    (porJugador[fila.jugador_id] = porJugador[fila.jugador_id] || []).push(evaluacion);
  });
  return { porJugador, error: "" };
};

// cambios: [{ id, datos }] (los datos enteros de cada evaluación, con su
// Selección nueva). De a una; si una falla, se sigue y se avisa.
export const guardarSeleccionDeEvaluaciones = async (cambios) => {
  const hechas = [];
  let error = "";
  for (const cambio of cambios) {
    const respuesta = await supabase.from("evaluaciones").update({ datos: cambio.datos }).eq("id", cambio.id); // eslint-disable-line no-await-in-loop
    if (respuesta.error) error = fallo(respuesta.error).error;
    else hechas.push(cambio.id);
  }
  return { hechas, error };
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
  if (!equipoId) return { campos: [], opciones: [], sinSentido: false, error: "" };
  const leerCampos = (columnas) => supabase.from("evaluaciones_campos").select(columnas).eq("equipo_id", equipoId);
  let [campos, opciones] = await Promise.all([
    leerCampos(`${COLUMNAS_CAMPOS}, sentido`),
    supabase.from("evaluaciones_opciones").select(COLUMNAS_OPCIONES).eq("equipo_id", equipoId).order("orden", { ascending: true }),
  ]);
  // Sin la columna sentido (la base sin 20261107): como antes, sin «Para los V.R.».
  const sinSentido = Boolean(campos.error && faltaSentido(campos.error));
  if (sinSentido) campos = await leerCampos(COLUMNAS_CAMPOS);
  const error = campos.error || opciones.error;
  if (error) {
    const clave = claveDeErrorEvaluaciones(error, "evaluaciones.error.noLeer");
    if (clave === "evaluaciones.error.faltaMigracion") return { campos: [], opciones: [], sinSentido, error: "" };
    return { campos: [], opciones: [], sinSentido, error: clave };
  }
  return { campos: campos.data || [], opciones: opciones.data || [], sinSentido, error: "" };
};

const sinMigracionDeAjustes = (error) => {
  const texto = `${error?.message || ""} ${error?.details || ""}`;
  return ["42P01", "PGRST205"].includes(error?.code) || (/evaluaciones_(campos|opciones)/.test(texto) && /does not exist|schema cache|Could not find/i.test(texto));
};

const falloDeAjustes = (error) =>
  sinMigracionDeAjustes(error) ? { error: "evaluaciones.ajustes.faltaMigracion" } : { error: claveDeErrorEvaluaciones(error, "evaluaciones.ajustes.errorGuardar") };

const textoLimpio = (texto) => String(texto || "").trim();

// Con `sentido`, también «Más es mejor» o «Menos es mejor» para los V.R. (sin
// él no se toca: así anda también sin 20261107).
export const guardarCabecera = async (equipoId, test, campo, { etiquetas = {}, oculto = false, orden = 0, sentido = null }) => {
  const { error } = await supabase.from("evaluaciones_campos").upsert(
    {
      equipo_id: equipoId,
      test,
      campo,
      etiqueta_es: textoLimpio(etiquetas["es-AR"]),
      etiqueta_pt: textoLimpio(etiquetas["pt-BR"]),
      oculto: Boolean(oculto),
      orden,
      ...(sentidoGuardado(sentido) ? { sentido: sentidoGuardado(sentido) } : {}),
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
