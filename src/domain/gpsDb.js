// GPS en la base (migración 20261016_gps.sql). Todo va con la sesión de quien
// usa la app; la base (RLS + puede_usar_en('gps')) decide si puede. Cada
// función devuelve { ..., error } con el error ya traducido a una clave del
// diccionario.
import { supabase } from "../supabase.js";
import { esSoloLectura } from "./alDia.js";

const COLUMNAS = "id, equipo_id, orden, fecha, jugador_id, persona, promedio, datos";

// La API devuelve hasta 1000 filas por vez: se piden de a 1000. Sabiendo
// cuántas son, varias páginas van a la vez.
const POR_VEZ = 1000;
const PAGINAS_A_LA_VEZ = 4;
// Se borran de a 100 (los id van en la dirección del pedido).
export const POR_BORRADO = 100;
// En `jugador`, el promedio del equipo (Team Average); en `dispositivo`, las
// filas sin dispositivo.
export const SOLO_PROMEDIOS = "promedio";
export const SIN_DISPOSITIVO = "-";
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
// ese límite), de un jugador (su id), del promedio del equipo
// (SOLO_PROMEDIOS) o de todos, y de un dispositivo (su código;
// SIN_DISPOSITIVO: sin dispositivo) o de todos; por fecha y en el orden de
// carga. La base filtra: no se baja lo que no se pidió. Con `maximo`, si son
// más, no las trae y dice cuántas son ({ demasiadas: true, total }). Quien
// ya se fue del club ve la foto de su último día (toda: se filtra acá).
export const listarGps = async (equipoId, { desde = null, hasta = null, jugador = "", dispositivo = "", maximo = null } = {}) => {
  if (!equipoId) return { filas: [], total: 0, demasiadas: false, error: "" };
  const deJugador = (fila) => (!jugador ? true : jugador === SOLO_PROMEDIOS ? Boolean(fila.promedio) : String(fila.jugador_id ?? "") === String(jugador));
  const deDispositivo = (fila) => {
    if (!dispositivo) return true;
    const suyo = fila.datos?.dispositivo;
    return dispositivo === SIN_DISPOSITIVO ? suyo === undefined || suyo === null || suyo === "" : suyo === dispositivo;
  };
  const pasa = (fila) =>
    fila && typeof fila === "object" && fila.fecha && (!desde || fila.fecha >= desde) && (!hasta || fila.fecha <= hasta) && deJugador(fila) && deDispositivo(fila);
  const conMaximo = (filas) => (maximo && filas.length > maximo ? { filas: [], total: filas.length, demasiadas: true, error: "" } : { filas, total: filas.length, demasiadas: false, error: "" });
  if (esSoloLectura(equipoId)) {
    const { filas, error } = await todas((d, h) => supabase.rpc("datos_al_dia", { p_tabla: "gps", p_equipo: equipoId }).range(d, h));
    if (error) return { filas: [], total: 0, demasiadas: false, ...fallo(error, "gps.error.noLeer") };
    return conMaximo(filas.filter(pasa).map(normalizarFilaGps).sort(porFechaYOrden));
  }
  const consulta = (opciones) => {
    let pedido = supabase.from("gps").select(COLUMNAS, opciones).eq("equipo_id", equipoId);
    if (desde) pedido = pedido.gte("fecha", desde);
    if (hasta) pedido = pedido.lte("fecha", hasta);
    if (jugador === SOLO_PROMEDIOS) pedido = pedido.not("promedio", "is", null);
    else if (jugador) pedido = pedido.eq("jugador_id", jugador);
    if (dispositivo === SIN_DISPOSITIVO) pedido = pedido.is("datos->dispositivo", null);
    else if (dispositivo) pedido = pedido.eq("datos->>dispositivo", dispositivo);
    return pedido.order("fecha", { ascending: true }).order("orden", { ascending: true });
  };
  // La primera página dice también cuántas son.
  const primera = await consulta({ count: "exact" }).range(0, POR_VEZ - 1);
  if (primera.error) return { filas: [], total: 0, demasiadas: false, ...fallo(primera.error, "gps.error.noLeer") };
  const total = Number.isFinite(primera.count) ? primera.count : null;
  if (maximo && total !== null && total > maximo) return { filas: [], total, demasiadas: true, error: "" };
  const filas = [...(Array.isArray(primera.data) ? primera.data : [])];
  if (total === null) {
    // Sin la cuenta, de a 1000 hasta el final.
    if (filas.length === POR_VEZ) {
      const resto = await todas((d, h) => consulta().range(d + POR_VEZ, h + POR_VEZ));
      if (resto.error) return { filas: [], total: 0, demasiadas: false, ...fallo(resto.error, "gps.error.noLeer") };
      filas.push(...resto.filas);
    }
  } else {
    const inicios = [];
    for (let inicio = filas.length; inicio < total; inicio += POR_VEZ) inicios.push(inicio);
    const paginas = new Array(inicios.length);
    let siguiente = 0;
    let falla = null;
    const pedirPaginas = async () => {
      while (siguiente < inicios.length && !falla) {
        const i = siguiente;
        siguiente += 1;
        const { data, error } = await consulta().range(inicios[i], inicios[i] + POR_VEZ - 1); // eslint-disable-line no-await-in-loop
        if (error) falla = error;
        else paginas[i] = Array.isArray(data) ? data : [];
      }
    };
    await Promise.all(Array.from({ length: Math.min(PAGINAS_A_LA_VEZ, inicios.length) }, pedirPaginas));
    if (falla) return { filas: [], total: 0, demasiadas: false, ...fallo(falla, "gps.error.noLeer") };
    paginas.forEach((pagina) => filas.push(...pagina));
  }
  // Si mientras se leía se sumó una fila, alguna puede llegar dos veces.
  const vistas = new Set();
  const unicas = filas.filter((fila) => fila?.id && !vistas.has(fila.id) && vistas.add(fila.id));
  return { filas: unicas.map(normalizarFilaGps), total: total ?? unicas.length, demasiadas: false, error: "" };
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

// Varias filas, de a POR_BORRADO por pedido. Devuelve las que la base borró
// de verdad (las que no se pueden, por permisos, no vuelven) y, si un pedido
// falla, se corta ahí con su error.
export const borrarFilasGps = async (ids, { alAvanzar = null } = {}) => {
  const borradas = [];
  for (let i = 0; i < ids.length; i += POR_BORRADO) {
    const tanda = ids.slice(i, i + POR_BORRADO);
    const { data, error } = await supabase.from("gps").delete().in("id", tanda).select("id"); // eslint-disable-line no-await-in-loop
    if (error) return { borradas, ...fallo(error, "gps.error.noBorrar") };
    borradas.push(...(Array.isArray(data) ? data.map((fila) => fila.id) : []));
    alAvanzar?.(Math.min(i + POR_BORRADO, ids.length), ids.length);
  }
  return { borradas, error: "" };
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
