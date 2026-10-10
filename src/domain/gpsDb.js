// GPS en la base (migración 20261016_gps.sql). Todo va con la sesión de quien
// usa la app; la base (RLS + puede_usar_en('gps')) decide si puede. Cada
// función devuelve { ..., error } con el error ya traducido a una clave del
// diccionario.
import { supabase } from "../supabase.js";
import { esSoloLectura } from "./alDia.js";

const COLUMNAS = "id, equipo_id, orden, fecha, jugador_id, persona, promedio, datos";

// La API devuelve hasta 1000 filas por vez: se piden de a 1000 hasta el final.
const POR_VEZ = 1000;
// Al pegar el historial (miles de filas), se guardan de a tandas.
export const POR_TANDA = 250;

export const claveDeErrorGps = (error, porDefecto = "gps.error.noGuardar") => {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  // Sin la migración: la tabla, la columna del permiso o la función no existen.
  if (["42P01", "PGRST205", "42883"].includes(error?.code) || (/gps/.test(texto) && /does not exist|schema cache|Could not find/i.test(texto))) {
    return "gps.error.faltaMigracion";
  }
  if (/jugador_de_otro_club/.test(texto)) return "gps.error.jugadorDeOtroClub";
  if (/gps_sin_futuro/.test(texto)) return "gps.error.fechaFutura";
  if (/gps_de_quien/.test(texto)) return "gps.error.sinJugador";
  if (error?.code === "42501" || /row-level security|permission denied/.test(texto)) return "gps.error.sinPermiso";
  // Sin señal: al guardar, "no se pudo guardar"; al leer o borrar, el
  // mensaje de lo que se estaba haciendo.
  if (/Failed to fetch|NetworkError|Load failed/i.test(texto)) return porDefecto === "gps.error.noGuardar" ? "gps.error.sinConexion" : porDefecto;
  return porDefecto;
};

const fallo = (error, porDefecto) => ({ error: claveDeErrorGps(error, porDefecto), detalle: error?.message || "" });

export const normalizarFilaGps = (fila) => ({
  id: fila?.id ?? null,
  equipo_id: fila?.equipo_id ?? null,
  orden: Number(fila?.orden) || 0,
  fecha: fila?.fecha || null,
  jugador_id: fila?.jugador_id ?? null,
  persona: fila?.persona ?? null,
  promedio: fila?.promedio ?? null,
  datos: fila?.datos && typeof fila.datos === "object" && !Array.isArray(fila.datos) ? fila.datos : {},
});

// Lo cargado, sin vacíos.
const limpiarDatos = (datos = {}) =>
  Object.fromEntries(
    Object.entries(datos || {})
      .map(([clave, valor]) => [clave, typeof valor === "string" ? valor.trim() : valor])
      .filter(([, valor]) => valor !== null && valor !== undefined && valor !== "" && !(typeof valor === "number" && !Number.isFinite(valor))),
  );

// Solo lo que decide la app: de quién es (un jugador, una persona o el
// promedio del equipo), la fecha y los valores.
const soloCampos = (fila) => {
  const promedio = fila.promedio || null;
  const jugador = promedio ? null : fila.jugador_id || null;
  return {
    jugador_id: jugador,
    persona:
      promedio || jugador
        ? null
        : String(fila.persona || "")
            .replace(/\s+/g, " ")
            .trim() || null,
    promedio,
    fecha: fila.fecha || null,
    datos: limpiarDatos(fila.datos),
  };
};

const porFechaYOrden = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.orden - b.orden);

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

// Las filas del club entre dos fechas (ISO, las dos incluidas; sin una, sin
// ese límite), por fecha y en el orden de carga. Quien ya se fue del club ve
// la foto de su último día (toda: se filtra acá).
export const listarGps = async (equipoId, { desde = null, hasta = null } = {}) => {
  if (!equipoId) return { filas: [], error: "" };
  const enElPeriodo = (fila) => fila && typeof fila === "object" && fila.fecha && (!desde || fila.fecha >= desde) && (!hasta || fila.fecha <= hasta);
  if (esSoloLectura(equipoId)) {
    const { filas, error } = await todas((d, h) => supabase.rpc("datos_al_dia", { p_tabla: "gps", p_equipo: equipoId }).range(d, h));
    if (error) return { filas: [], ...fallo(error, "gps.error.noLeer") };
    return { filas: filas.filter(enElPeriodo).map(normalizarFilaGps).sort(porFechaYOrden), error: "" };
  }
  const { filas, error } = await todas((d, h) => {
    let consulta = supabase.from("gps").select(COLUMNAS).eq("equipo_id", equipoId);
    if (desde) consulta = consulta.gte("fecha", desde);
    if (hasta) consulta = consulta.lte("fecha", hasta);
    return consulta.order("fecha", { ascending: true }).order("orden", { ascending: true }).range(d, h);
  });
  if (error) return { filas: [], ...fallo(error, "gps.error.noLeer") };
  return { filas: filas.map(normalizarFilaGps), error: "" };
};

// Carga muchas filas (pegadas del Excel), de a tandas y en su orden: la base
// numera el orden de carga en el orden en que llegan. alAvanzar(hechas,
// total) después de cada tanda. Si una tanda falla, se corta ahí: vuelven las
// que se guardaron y el error (las que faltan se ven al volver a pegar).
export const crearFilasGps = async (equipoId, filas, { alAvanzar = null, seguir = () => true } = {}) => {
  const creadas = [];
  for (let i = 0; i < filas.length; i += POR_TANDA) {
    if (!seguir()) break;
    const tanda = filas.slice(i, i + POR_TANDA).map((fila) => ({ equipo_id: equipoId, ...soloCampos(fila) }));
    const { data, error } = await supabase.from("gps").insert(tanda).select(COLUMNAS); // eslint-disable-line no-await-in-loop
    if (error) return { creadas, ...fallo(error, "gps.error.noGuardar") };
    creadas.push(...(data || []).map(normalizarFilaGps));
    alAvanzar?.(creadas.length, filas.length);
  }
  return { creadas, error: "" };
};

export const actualizarFilaGps = async (id, fila) => {
  const { data, error } = await supabase.from("gps").update(soloCampos(fila)).eq("id", id).select(COLUMNAS).single();
  if (error) return fallo(error, "gps.error.noGuardar");
  return { fila: normalizarFilaGps(data), error: "" };
};

export const borrarFilaGps = async (id) => {
  const { error } = await supabase.from("gps").delete().eq("id", id);
  if (error) return fallo(error, "gps.error.noBorrar");
  return { error: "" };
};

// ------------------------------------------------------------- Ajustes --
// El nombre de cada columna, si se ve, las columnas del club y las opciones
// de cada lista (gps_campos y gps_opciones). Sin esas tablas todavía, valen
// los nombres del Excel: los Ajustes avisan al guardar.

const COLUMNAS_CAMPOS = "campo, etiqueta_es, etiqueta_pt, oculto, orden, tipo";
const COLUMNAS_OPCIONES = "lista, codigo, etiqueta_es, etiqueta_pt, oculto, orden";

export const leerAjustesGps = async (equipoId) => {
  if (!equipoId) return { campos: [], opciones: [], error: "" };
  const [campos, opciones] = await Promise.all([
    supabase.from("gps_campos").select(COLUMNAS_CAMPOS).eq("equipo_id", equipoId),
    supabase.from("gps_opciones").select(COLUMNAS_OPCIONES).eq("equipo_id", equipoId).order("orden", { ascending: true }),
  ]);
  const error = campos.error || opciones.error;
  if (error) {
    const clave = claveDeErrorGps(error, "gps.error.noLeer");
    if (clave === "gps.error.faltaMigracion") return { campos: [], opciones: [], error: "" };
    return { campos: [], opciones: [], error: clave };
  }
  return { campos: campos.data || [], opciones: opciones.data || [], error: "" };
};

const textoLimpio = (texto) => String(texto || "").trim();

const falloDeAjustes = (error) => {
  const clave = claveDeErrorGps(error, "gps.ajustes.errorGuardar");
  return { error: clave === "gps.error.faltaMigracion" ? "gps.ajustes.faltaMigracion" : clave };
};

// El nombre de una columna y si se ve; con `tipo`, una columna que suma el club.
export const guardarCabeceraGps = async (equipoId, campo, { etiquetas = {}, oculto = false, orden = 0, tipo = null }) => {
  const { error } = await supabase.from("gps_campos").upsert(
    {
      equipo_id: equipoId,
      campo,
      etiqueta_es: textoLimpio(etiquetas["es-AR"]),
      etiqueta_pt: textoLimpio(etiquetas["pt-BR"]),
      oculto: Boolean(oculto),
      orden,
      tipo: tipo || null,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "equipo_id,campo" },
  );
  if (error) return falloDeAjustes(error);
  return { error: "" };
};

export const guardarOpcionGps = async (equipoId, lista, { codigo, etiquetas = {}, oculto = false, orden = 0 }) => {
  const { error } = await supabase.from("gps_opciones").upsert(
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
