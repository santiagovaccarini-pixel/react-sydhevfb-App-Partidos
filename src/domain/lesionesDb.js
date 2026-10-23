// Lesiones en la base. Todo va con la sesión de quien usa la app; la base
// (RLS + puede_usar('lesiones')) decide si puede. Cada función devuelve
// { ..., error } con el error ya traducido a una clave del diccionario.
import { supabase } from "../supabase.js";
import { camposCambiados, claveDeErrorDeBase, normalizarLesion } from "./lesiones.js";
import { COLUMNAS_DE_DATOS_BASICOS, armarConfig, campoPorClave, esCalculado, filasParaSembrar } from "./lesionesCampos.js";
import { agregarJugador, cargarPlantel, normalizarJugador, quitarJugador } from "./plantel.js";
import { esSoloLectura, leerAlDia, masNuevasPrimero } from "./alDia.js";
import { hoyISO } from "../idioma/formatos.js";

const COLUMNAS_SIN_PERSONA =
  "id, equipo_id, jugador_id, numero_caso, fecha_lesion, fecha_transicion, fecha_retorno_entrenamiento, fecha_alta, datos, creado_en, actualizado_en";
const COLUMNAS = `${COLUMNAS_SIN_PERSONA}, persona`;

// El nombre de quien no está en Datos básicos (persona) llega con
// 20261010_lesiones_sin_fecha_y_personas.sql: mientras no se corra, se lee y
// se guarda sin él (lo que no lo necesita sigue andando). Se recuerda para no
// preguntar dos veces.
let sinPersona = false;
const faltaPersona = (error) => /persona/.test(error?.message || "") && /42703|PGRST204/.test(String(error?.code || ""));

// Pide algo a la base con la columna persona y, si la base todavía no la
// tiene, otra vez sin ella. armar(conPersona) arma la consulta. Lo que es de
// una persona va siempre con la columna (sin ella no se puede guardar): si
// sale bien, la base ya la tiene (se corrió el SQL con la app abierta). La
// lista se pide siempre primero con la columna (probar): así, si se corre el
// SQL con la app abierta, al recargar ya se ven los nombres.
const conOSinPersona = async (armar, { dePersona = false, probar = false } = {}) => {
  const conPersona = !sinPersona || dePersona || probar;
  const respuesta = await armar(conPersona);
  if (!respuesta.error) {
    if (conPersona) sinPersona = false;
    return respuesta;
  }
  if (!conPersona || dePersona || !faltaPersona(respuesta.error)) return respuesta;
  sinPersona = true;
  return armar(false);
};

const fallo = (error, porDefecto) => ({
  error: claveDeErrorDeBase(error) || porDefecto,
  detalle: error?.message || "",
});

// Los vacíos no se guardan, y lo que el Excel calcula tampoco (se calcula
// cada vez que se mira): así `datos` tiene solo lo cargado a mano. Lo que se
// cargó a mano en una columna que después pasó a calcularse queda, y la
// categoría del jugador ese día también (delDia).
const limpiarDatos = (datos = {}) =>
  Object.fromEntries(
    Object.entries(datos || {})
      .filter(([clave]) => !esCalculado(clave) || campoPorClave(clave)?.cargadoAntes || campoPorClave(clave)?.delDia)
      .map(([clave, valor]) => [clave, typeof valor === "string" ? valor.trim() : valor])
      .filter(([, valor]) => valor !== null && valor !== undefined && valor !== ""),
  );

// Solo las columnas que la app puede decidir. Sin la columna persona en la
// base, va solo si la lesión es de una persona (y la base dice que falta el
// SQL).
const soloCampos = (lesion, conPersona = true) => ({
  jugador_id: lesion.jugador_id || null,
  ...(conPersona || lesion.persona ? { persona: lesion.jugador_id ? null : String(lesion.persona || "").replace(/\s+/g, " ").trim() || null } : {}),
  fecha_lesion: lesion.fecha_lesion || null,
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
  const { data, error } = await conOSinPersona((conPersona) =>
    supabase
      .from("lesiones")
      .select(conPersona ? COLUMNAS : COLUMNAS_SIN_PERSONA)
      .eq("equipo_id", equipoId)
      // Las sin fecha (casos sin terminar) al final, como en la foto del último día.
      .order("fecha_lesion", { ascending: false, nullsFirst: false }),
    { probar: true },
  );
  if (error) return { lesiones: [], ...fallo(error, "lesiones.error.noLeer") };
  return { lesiones: (data || []).map(normalizarLesion), error: "" };
};

export const crearLesion = async (equipoId, lesion) => {
  const { data, error } = await conOSinPersona((conPersona) =>
    supabase
      .from("lesiones")
      .insert({ equipo_id: equipoId, ...soloCampos(lesion, conPersona) })
      .select(conPersona ? COLUMNAS : COLUMNAS_SIN_PERSONA)
      .single(),
    { dePersona: Boolean(lesion.persona && !lesion.jugador_id) },
  );
  if (error) return fallo(error, "lesiones.error.noGuardar");
  return { lesion: normalizarLesion(data), error: "" };
};

// Una lesión que viene del Excel: con su N° de caso, si lo trae (si no, lo
// pone la base, como a las cargadas a mano).
export const importarLesion = async (equipoId, lesion) => {
  const numeroCaso = Number.isInteger(lesion.numero_caso) && lesion.numero_caso > 0 ? { numero_caso: lesion.numero_caso } : {};
  const { data, error } = await conOSinPersona((conPersona) =>
    supabase
      .from("lesiones")
      .insert({ equipo_id: equipoId, ...numeroCaso, ...soloCampos(lesion, conPersona) })
      .select(conPersona ? COLUMNAS : COLUMNAS_SIN_PERSONA)
      .single(),
    { dePersona: Boolean(lesion.persona && !lesion.jugador_id) },
  );
  if (error) return fallo(error, "lesiones.error.noGuardar");
  return { lesion: normalizarLesion(data), error: "" };
};

// Lo que cambió de una lesión, celda por celda (para lesiones_cambiar):
// cambios, lo nuevo; antes, lo que se veía. En datos, lo vaciado va como
// null. Lo que la app no guarda (lo calculado, los vacíos) no cuenta.
const COLUMNAS_QUE_SE_CAMBIAN = ["jugador_id", "persona", "fecha_lesion", "fecha_transicion", "fecha_retorno_entrenamiento", "fecha_alta"];
export const cambiosDeLaLesion = (vieja, nueva) => {
  const de = soloCampos(vieja || {});
  const a = soloCampos(nueva || {});
  const cambios = {};
  const antes = {};
  COLUMNAS_QUE_SE_CAMBIAN.forEach((clave) => {
    if ((de[clave] ?? null) === (a[clave] ?? null)) return;
    cambios[clave] = a[clave] ?? null;
    antes[clave] = de[clave] ?? null;
  });
  new Set([...Object.keys(de.datos), ...Object.keys(a.datos)]).forEach((clave) => {
    if (JSON.stringify(de.datos[clave] ?? null) === JSON.stringify(a.datos[clave] ?? null)) return;
    cambios[`datos.${clave}`] = a.datos[clave] ?? null;
    antes[`datos.${clave}`] = de.datos[clave] ?? null;
  });
  return { cambios, antes };
};

// Cambiar solo lo cambiado (20261115_lesiones_cambiar.sql), como en
// Evaluaciones: dos personas que cambian celdas distintas de la misma lesión
// no se pisan; en la misma celda gana el último y la base dice cuáles pisó
// (pisadas: [{ clave, habia }], Santiago, 21/10: «Gana el último, con
// aviso»). Si otra persona la borró, borrada («Queda borrada y te aviso»).
// Sin esa actualización, sinFuncion: se guarda como antes, la fila entera
// (actualizarLesion).
export const cambiarLesion = async (id, { cambios = {}, antes = {} } = {}) => {
  const { data, error } = await supabase.rpc("lesiones_cambiar", { p_id: id, p_cambios: cambios, p_antes: antes });
  if (error) {
    const texto = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`;
    if (error.code === "PGRST202" || (/lesiones_cambiar/.test(texto) && /does not exist|schema cache|Could not find/i.test(texto))) return { sinFuncion: true, error: "" };
    if (/fila_borrada/.test(texto)) return { borrada: true, error: "" };
    return fallo(error, "lesiones.error.noGuardar");
  }
  return { lesion: normalizarLesion(data?.fila), pisadas: Array.isArray(data?.pisadas) ? data.pisadas : [], error: "" };
};

export const actualizarLesion = async (id, lesion) => {
  const { data, error } = await conOSinPersona((conPersona) =>
    supabase
      .from("lesiones")
      .update(soloCampos(lesion, conPersona))
      .eq("id", id)
      .select(conPersona ? COLUMNAS : COLUMNAS_SIN_PERSONA)
      .single(),
    { dePersona: Boolean(lesion.persona && !lesion.jugador_id) },
  );
  if (error) return fallo(error, "lesiones.error.noGuardar");
  return { lesion: normalizarLesion(data), error: "" };
};

export const borrarLesion = async (id) => {
  const { error } = await supabase.from("lesiones").delete().eq("id", id);
  if (error) return fallo(error, "lesiones.error.noBorrar");
  return { error: "" };
};

// La categoría de las lesiones al cambiarle la categoría a un jugador
// (Datos básicos; Santiago, 17/10). Las lesiones de cada jugador, livianas:
// { [jugador_id]: [{ id, fecha_lesion, datos }] }. Sin Lesiones (o en solo
// lectura) no se ve ninguna, y no se pregunta. De a 1000 por vez.
const LESIONES_POR_VEZ = 1000;
export const leerLesionesPorJugador = async (equipoId) => {
  if (!equipoId || esSoloLectura(equipoId)) return { porJugador: {}, error: "" };
  const filas = [];
  for (let desde = 0; ; desde += LESIONES_POR_VEZ) {
    const { data, error } = await supabase
      .from("lesiones")
      .select("id, jugador_id, fecha_lesion, datos")
      .eq("equipo_id", equipoId)
      .not("jugador_id", "is", null)
      .order("id")
      .range(desde, desde + LESIONES_POR_VEZ - 1); // eslint-disable-line no-await-in-loop
    if (error) return { porJugador: {}, ...fallo(error, "lesiones.error.noLeer") };
    const pagina = Array.isArray(data) ? data : [];
    filas.push(...pagina);
    if (pagina.length < LESIONES_POR_VEZ) break;
  }
  const porJugador = {};
  filas.forEach((fila) => {
    const lesion = { id: fila.id, fecha_lesion: fila.fecha_lesion || null, datos: fila.datos && typeof fila.datos === "object" ? fila.datos : {} };
    (porJugador[fila.jugador_id] = porJugador[fila.jugador_id] || []).push(lesion);
  });
  return { porJugador, error: "" };
};

// cambios: [{ id, datos, antes }] (los datos enteros de cada lesión, con su
// categoría nueva; antes, la categoría que tenía). De a una; si una falla,
// se sigue y se avisa. Con 20261115 se cambia solo la categoría (paso 2 de
// «cargar sin señal y a la vez que otra persona»): lo demás que otra persona
// cambió en la lesión queda; pisadas dice en cuántas otra persona había
// cambiado la categoría mientras tanto (gana el último) y datos, cómo quedó
// cada una. Una que otra persona borró ya no está: no cuenta como hecha ni
// como error.
export const guardarCategoriaDeLesiones = async (cambios) => {
  const hechas = [];
  const datos = {};
  let pisadas = 0;
  let error = "";
  let sinFuncion = false;
  for (const cambio of cambios) {
    if (!sinFuncion) {
      // eslint-disable-next-line no-await-in-loop
      const respuesta = await cambiarLesion(cambio.id, { cambios: { "datos.categoria": cambio.datos?.categoria || null }, antes: { "datos.categoria": cambio.antes || null } });
      sinFuncion = Boolean(respuesta.sinFuncion);
      if (!sinFuncion) {
        if (respuesta.error) error = respuesta.error;
        else if (!respuesta.borrada) {
          hechas.push(cambio.id);
          datos[cambio.id] = respuesta.lesion.datos;
          pisadas += respuesta.pisadas.length;
        }
        continue;
      }
    }
    const respuesta = await supabase.from("lesiones").update({ datos: cambio.datos }).eq("id", cambio.id); // eslint-disable-line no-await-in-loop
    if (respuesta.error) error = fallo(respuesta.error, "lesiones.error.noGuardar").error;
    else hechas.push(cambio.id);
  }
  return { hechas, datos, pisadas, error };
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

// Columnas que llegan con un SQL nuevo: mientras no se corra, se lee y se
// guarda sin ellas. Las horas previas (de entrenamiento, de antes de que
// llegara el cuerpo técnico) con 20261007_horas_previas.sql; si está hoy en
// el plantel (actual) con 20261011_jugadores_actual.sql. Cómo se reconoce en
// el error que falta cada una (actual, como palabra: "actualizado_en" va en
// cada cambio) y qué se avisa si se quería guardar.
const COLUMNAS_NUEVAS = {
  horas_previas: { falta: /horas_previas/, aviso: "datos.error.faltanHorasPrevias" },
  actual: { falta: /\bactual\b/, aviso: "datos.error.faltaActual" },
};
const COLUMNAS_JUGADOR_SIEMPRE = "id, nombre, roles, puestos, categoria, fecha_nacimiento, pie_dominante, posicion, foto_url";
const columnasJugador = (sin = []) => [COLUMNAS_JUGADOR_SIEMPRE, ...Object.keys(COLUMNAS_NUEVAS).filter((columna) => !sin.includes(columna))].join(", ");
// La columna nueva que falta en la base, según el error (o null).
const columnaQueFalta = (error, sin = []) =>
  Object.keys(COLUMNAS_NUEVAS).find((columna) => !sin.includes(columna) && COLUMNAS_NUEVAS[columna].falta.test(error?.message || "")) || null;

const horasPrevias = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const horas = Number(valor);
  return Number.isFinite(horas) ? horas : null;
};

export const normalizarJugadorLesiones = (fila) => ({
  ...normalizarJugador(fila),
  // Sin el dato (antes del SQL, o una foto del último día de antes), está.
  actual: fila?.actual !== false,
  categoria: fila?.categoria || "",
  fecha_nacimiento: fila?.fecha_nacimiento || "",
  pie_dominante: fila?.pie_dominante || "",
  posicion: fila?.posicion || "",
  foto_url: fila?.foto_url || "",
  horas_previas: horasPrevias(fila?.horas_previas),
});

// ------------------------------------------- Los minutos de entrenamiento --
// Las horas de Lesiones c/1000h salen del GPS (migración
// 20261018_minutos_lesiones.sql): por jugador (o persona fuera de Datos
// básicos), día y si son de la selección, ya sumados en la base (Minutos
// Campo + Minutos Fuerza Metabólico de todas sus filas, como la hoja «BD GPS»
// del Excel de lesiones; el promedio del equipo no cuenta). Los ve quien tiene
// Lesiones, aunque no tenga GPS, sin ver las filas del GPS; quien ya se fue,
// los de su último día (lo decide la base). Sin la migración o sin minutos
// cargados: null (los reportes muestran "—" y avisan). De a 1000 por vez.
const MINUTOS_POR_VEZ = 1000;
const faltaFuncion = (error) =>
  ["PGRST202", "42883"].includes(error?.code) || (/minutos_de_entrenamiento/.test(`${error?.message || ""}`) && /Could not find|does not exist/i.test(`${error?.message || ""}`));

export const leerMinutosDeEntrenamiento = async (equipoId) => {
  if (!equipoId) return { minutos: null, error: "" };
  const filas = [];
  for (let desde = 0; ; desde += MINUTOS_POR_VEZ) {
    const { data, error } = await supabase.rpc("minutos_de_entrenamiento", { p_equipo: equipoId }).range(desde, desde + MINUTOS_POR_VEZ - 1); // eslint-disable-line no-await-in-loop
    if (error) return faltaFuncion(error) ? { minutos: null, error: "" } : { minutos: null, ...fallo(error, "lesiones.error.noLeer") };
    const pagina = Array.isArray(data) ? data : [];
    filas.push(...pagina);
    if (pagina.length < MINUTOS_POR_VEZ) break;
  }
  const minutos = filas
    .map((fila) => ({
      jugadorId: fila?.jugador_id ?? null,
      persona: fila?.persona ?? null,
      fecha: fila?.fecha || "",
      minutos: Number(fila?.minutos),
      seleccion: Boolean(fila?.seleccion),
    }))
    .filter((fila) => fila.fecha && Number.isFinite(fila.minutos));
  return { minutos: minutos.length ? minutos : null, error: "" };
};

const porNombre = (lista) => [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

// Los nombres que tuvo cada jugador (20261022_nombres_en_todos_lados.sql),
// para reconocerlos al pegar una planilla o cargar el CSV del GPS: { id:
// [nombres] }. Sin la tabla (antes del SQL) o si no se pudieron leer, ninguno.
const leerNombresAnteriores = async (equipoId) => {
  const porJugador = new Map();
  try {
    const { data, error } = await supabase.from("jugadores_nombres_anteriores").select("jugador_id, nombre").eq("equipo_id", equipoId);
    if (error || !Array.isArray(data)) return porJugador;
    data.forEach((fila) => {
      const nombre = typeof fila?.nombre === "string" ? fila.nombre.trim() : "";
      if (fila?.jugador_id === null || fila?.jugador_id === undefined || !nombre) return;
      const clave = String(fila.jugador_id);
      porJugador.set(clave, [...(porJugador.get(clave) || []), nombre]);
    });
  } catch {
    // Sin los nombres anteriores, se reconocen solo los de hoy.
  }
  return porJugador;
};
const conNombresAnteriores = (plantel, anteriores) =>
  anteriores.size ? plantel.map((jugador) => (anteriores.has(String(jugador.id)) ? { ...jugador, nombres_anteriores: anteriores.get(String(jugador.id)) } : jugador)) : plantel;

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
  const leer = (columnas) => supabase.from("jugadores").select(columnas).eq("equipo_id", equipoId).order("nombre", { ascending: true });
  const sin = [];
  let { data, error } = await leer(columnasJugador(sin));
  for (let falta = columnaQueFalta(error, sin); falta; falta = columnaQueFalta(error, sin)) {
    sin.push(falta);
    ({ data, error } = await leer(columnasJugador(sin))); // eslint-disable-line no-await-in-loop
  }
  if (!error) return { plantel: conNombresAnteriores(porNombre((data || []).map(normalizarJugadorLesiones)), await leerNombresAnteriores(equipoId)), error: "" };
  const respaldo = await cargarPlantel(equipoId);
  // deRespaldo: la base no respondió y es la última copia guardada (o nada).
  return { plantel: (respaldo.plantel || []).map(normalizarJugadorLesiones), error: "", deRespaldo: respaldo.desde !== "base" };
};

// Solo lo que se mande: una celda de la tabla, o la ficha entera.
// Cada columna de Datos básicos como se guarda (y como se compara con lo que
// hay en la base): sin espacios de más y, lo vacío, null.
const COMO_SE_GUARDA = {
  nombre: (valor) => String(valor || "").trim(),
  categoria: (valor) => valor || null,
  fecha_nacimiento: (valor) => valor || null,
  pie_dominante: (valor) => valor || null,
  posicion: (valor) => valor || null,
  foto_url: (valor) => String(valor || "").trim() || null,
  horas_previas: (valor) => horasPrevias(valor),
  actual: (valor) => valor !== false,
};

// Cambiar solo lo cambiado con lo que se veía (20261117_jugadores_cambiar.sql;
// paso 2 de «cargar sin señal y a la vez que otra persona»): en la misma
// columna gana el último y la base dice cuáles pisó (pisadas, Santiago,
// 21/10: «Gana el último, con aviso»); si otra persona lo borró, borrado
// («Queda borrada y te aviso»). Sin esa actualización, sinFuncion.
const cambiarJugador = async (id, cambios, jugador) => {
  const antes = Object.fromEntries(Object.keys(cambios).map((clave) => [clave, COMO_SE_GUARDA[clave](jugador?.[clave])]));
  const { data, error } = await supabase.rpc("jugadores_cambiar", { p_id: id, p_cambios: cambios, p_antes: antes });
  if (error) {
    const texto = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`;
    if (error.code === "PGRST202" || (/jugadores_cambiar/.test(texto) && /does not exist|schema cache|Could not find/i.test(texto))) return { sinFuncion: true, error: "" };
    if (/fila_borrada/.test(texto)) return { borrado: true, error: "" };
    if (/duplicate key|unique/i.test(error.message || "")) return { error: "datos.error.repetido" };
    return fallo(error, "datos.error.guardar");
  }
  return { jugador: normalizarJugadorLesiones(data?.fila), pisadas: Array.isArray(data?.pisadas) ? data.pisadas : [], error: "" };
};

// antes: el jugador como se veía al cambiarlo (sin él, se guarda como antes
// de 20261117).
export const guardarDatosJugador = async (id, datos, { antes = null } = {}) => {
  const cambios = { actualizado_en: new Date().toISOString() };
  Object.keys(COMO_SE_GUARDA).forEach((clave) => {
    if (clave in datos) cambios[clave] = COMO_SE_GUARDA[clave](datos[clave]);
  });
  if ("horas_previas" in datos && (datos.horas_previas ?? "") !== "" && (cambios.horas_previas === null || cambios.horas_previas < 0)) return { error: "datos.error.horas" };
  if (cambios.nombre === "") return { error: "datos.error.nombre" };
  // Nadie nace en el futuro (una fecha elegida en el calendario de la celda).
  if (cambios.fecha_nacimiento && cambios.fecha_nacimiento > hoyISO()) return { error: "datos.error.nacimientoFuturo" };
  if (antes) {
    const { actualizado_en: _, ...soloLoCambiado } = cambios;
    const respuesta = await cambiarJugador(id, soloLoCambiado, antes);
    if (!respuesta.sinFuncion) return respuesta;
  }
  const guardar = (valores, columnas) => supabase.from("jugadores").update(valores).eq("id", id).select(columnas).single();
  const sin = [];
  let valores = cambios;
  let { data, error } = await guardar(valores, columnasJugador(sin));
  // Sin el SQL de una columna nueva: lo demás se guarda igual y, si había
  // algo para guardar en ella, se avisa. Si solo era eso, no se guarda nada.
  // (Vaciar las horas sin la columna no pierde nada: no avisa.) avisos: lo
  // que no se guardó; se avisa el primero y sinGuardar dice cuántos datos.
  const avisos = [];
  for (let falta = columnaQueFalta(error, sin); falta; falta = columnaQueFalta(error, sin)) {
    sin.push(falta);
    const { [falta]: valor, ...resto } = valores;
    const seQueria = falta in valores && valor !== null && valor !== undefined;
    if (seQueria && !Object.keys(resto).some((clave) => clave !== "actualizado_en")) return { error: avisos[0] || COLUMNAS_NUEVAS[falta].aviso };
    if (seQueria) avisos.push(COLUMNAS_NUEVAS[falta].aviso);
    valores = resto;
    ({ data, error } = await guardar(valores, columnasJugador(sin))); // eslint-disable-line no-await-in-loop
  }
  if (error) {
    if (/duplicate key|unique/i.test(error.message || "")) return { error: "datos.error.repetido" };
    return fallo(error, "datos.error.guardar");
  }
  return { jugador: normalizarJugadorLesiones(data), error: "", ...(avisos.length ? { aviso: avisos[0], sinGuardar: avisos.length } : {}) };
};

// Alta y baja de jugadores desde Datos básicos: las mismas de Partido. El
// error vuelve como clave del diccionario, para que se lea en el idioma de
// la app (si no es una, el genérico).
const esClaveDeDatos = (texto) => /^datos\.error\.\w+$/.test(String(texto || ""));

export const agregarJugadorBasico = async (equipoId, nombre) => {
  const respuesta = await agregarJugador(nombre, equipoId);
  if (respuesta.error) {
    if (esClaveDeDatos(respuesta.error)) return { error: respuesta.error, ...(respuesta.detalle ? { detalle: respuesta.detalle } : {}) };
    return { error: "datos.error.guardar", detalle: respuesta.error };
  }
  return { jugador: normalizarJugadorLesiones(respuesta.jugador), error: "" };
};

export const quitarJugadorBasico = async (id) => {
  const respuesta = await quitarJugador(id);
  if (!respuesta.error) return { error: "" };
  // Con lesiones o evaluaciones cargadas no se borra: se desmarca "Actual".
  return { error: esClaveDeDatos(respuesta.error) ? respuesta.error : "datos.error.borrar" };
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

// Datos básicos › Ajustes (20261028_datos_basicos_ajustes.sql). Las
// columnas del jugador que comparte con Lesiones (su nombre y sus listas,
// las de esta misma configuración) las ve y las cambia cualquiera que sigue
// en el club; lo propio de Datos básicos (el nombre de sus otras columnas y
// cuáles se esconden en su tabla) va en datos_basicos_columnas. Sin el SQL,
// quien no tiene Lesiones ve los textos de la app y la tabla todas las
// columnas. Devuelve { config, columnas: { [columna]: { etiquetas, oculto } }, error }.
export const leerConfigDatos = async (equipoId) => {
  if (!equipoId) return { config: armarConfig(), columnas: {}, error: "" };
  const leer = () =>
    Promise.all([
      supabase.from("lesiones_campos").select("campo, etiqueta_es, etiqueta_pt, oculto, orden").eq("equipo_id", equipoId).in("campo", COLUMNAS_DE_DATOS_BASICOS).order("orden"),
      supabase.from("lesiones_opciones").select("campo, codigo, etiqueta_es, etiqueta_pt, oculto, orden").eq("equipo_id", equipoId).in("campo", COLUMNAS_DE_DATOS_BASICOS).order("orden"),
    ]);
  let [campos, opciones] = await leer();
  // Lo que falta del Excel se siembra (solo de estas columnas). Si no se
  // puede (sin el SQL, sin Lesiones), valen los textos de la app.
  if (!campos.error && !opciones.error) {
    const semilla = filasParaSembrar(equipoId);
    const hay = new Set((campos.data || []).map((fila) => fila.campo));
    const hayOpcion = new Set((opciones.data || []).map((fila) => `${fila.campo}|${fila.codigo}`));
    const camposNuevos = semilla.campos.filter((fila) => COLUMNAS_DE_DATOS_BASICOS.includes(fila.campo) && !hay.has(fila.campo));
    const opcionesNuevas = semilla.opciones.filter((fila) => COLUMNAS_DE_DATOS_BASICOS.includes(fila.campo) && !hayOpcion.has(`${fila.campo}|${fila.codigo}`));
    const sembrado = await Promise.all([
      camposNuevos.length ? supabase.from("lesiones_campos").upsert(camposNuevos, { onConflict: "equipo_id,campo", ignoreDuplicates: true }) : { error: null },
      opcionesNuevas.length ? supabase.from("lesiones_opciones").upsert(opcionesNuevas, { onConflict: "equipo_id,campo,codigo", ignoreDuplicates: true }) : { error: null },
    ]);
    if ((camposNuevos.length || opcionesNuevas.length) && !sembrado.some((uno) => uno.error)) [campos, opciones] = await leer();
  }
  const config = campos.error || opciones.error ? armarConfig() : armarConfig(campos.data || [], opciones.data || []);
  const propias = await supabase.from("datos_basicos_columnas").select("columna, etiqueta_es, etiqueta_pt, oculto").eq("equipo_id", equipoId);
  const columnas = Object.fromEntries(
    (propias.error ? [] : propias.data || []).map((fila) => [
      fila.columna,
      { etiquetas: { "es-AR": fila.etiqueta_es || "", "pt-BR": fila.etiqueta_pt || "" }, oculto: Boolean(fila.oculto) },
    ]),
  );
  // Con el detalle: sin señal, Datos básicos abre con la copia del aparato.
  const falla = campos.error || opciones.error;
  return { config, columnas, ...(falla ? fallo(falla, "lesiones.error.noLeer") : { error: "" }) };
};

// Lo propio de una columna de Datos básicos: su nombre (solo el de las que
// no son de Lesiones) y si se esconde en la tabla de Datos básicos.
export const guardarColumnaDatos = async (equipoId, columna, { etiquetas = {}, oculto = false }) => {
  const { error } = await supabase.from("datos_basicos_columnas").upsert(
    {
      equipo_id: equipoId,
      columna,
      etiqueta_es: String(etiquetas["es-AR"] || "").trim(),
      etiqueta_pt: String(etiquetas["pt-BR"] || "").trim(),
      oculto: Boolean(oculto),
    },
    { onConflict: "equipo_id,columna" },
  );
  if (!error) return { error: "" };
  // Sin el SQL nuevo, la tabla no está: se dice qué falta.
  if (/datos_basicos_columnas/.test(error.message || "") || ["42P01", "PGRST205"].includes(error.code)) return { error: "datos.ajustes.faltaSql" };
  return fallo(error, "lesiones.ajustes.errorGuardar");
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
