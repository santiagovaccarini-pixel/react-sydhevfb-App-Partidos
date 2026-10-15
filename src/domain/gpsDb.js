// GPS en la base (migración 20261016_gps.sql). Todo va con la sesión de quien
// usa la app; la base (RLS + puede_usar_en('gps')) decide si puede. Cada
// función devuelve { ..., error } con el error ya traducido a una clave del
// diccionario.
import { supabase } from "../supabase.js";
import { esSoloLectura } from "./alDia.js";
import { CATEGORIAS_DE_UN_VR } from "./gps/informe.js";
import { calcularNoIngresaron } from "./match.js";

// actualizado_en: para traer después solo lo cambiado (ponerAlDiaGps).
const COLUMNAS = "id, equipo_id, orden, fecha, jugador_id, persona, promedio, datos, actualizado_en";

// La API devuelve hasta 1000 filas por vez: se piden de a 1000. Sabiendo
// cuántas son, varias páginas van a la vez.
const POR_VEZ = 1000;
const PAGINAS_A_LA_VEZ = 6;
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
  ...(fila?.actualizado_en ? { actualizado_en: fila.actualizado_en } : {}),
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
// alAvanzar(n, total): cuántas van, mientras llegan.
export const listarGps = async (equipoId, { desde = null, hasta = null, jugador = "", dispositivo = "", maximo = null, alAvanzar = null } = {}) => {
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
  let traidas = filas.length;
  alAvanzar?.(traidas, total ?? traidas);
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
        else {
          paginas[i] = Array.isArray(data) ? data : [];
          traidas += paginas[i].length;
          alAvanzar?.(Math.min(traidas, total), total);
        }
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

// Al renombrar una opción de estrategia, su nombre cambia también en la
// Descripción de las filas ya guardadas (nota del 12/10; la base lo hace con
// los permisos de quien la llama, 20261022_nombres_en_todos_lados.sql).
// antes: los nombres que tenía (el del club y el de la plantilla). Sin la
// función (antes del SQL), nada y sin error: queda como hasta ahora.
const faltaLaFuncion = (error) => ["PGRST202", "42883"].includes(error?.code);
export const cambiarEnDescripcionesGps = async (equipoId, antes, despues) => {
  const nuevo = textoLimpio(despues);
  const viejos = [...new Set((antes || []).map(textoLimpio).filter((nombre) => nombre && nombre !== nuevo))];
  if (!equipoId || !nuevo || !viejos.length) return { cambiadas: 0, error: "" };
  const { data, error } = await supabase.rpc("gps_cambiar_en_descripciones", { p_equipo: equipoId, p_antes: viejos, p_despues: nuevo });
  if (error) return { cambiadas: 0, error: faltaLaFuncion(error) ? "" : "gps.ajustes.errorDescripciones" };
  return { cambiadas: Number(data) || 0, error: "" };
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

// ------------------------------------------------- Las reglas de la carga --
// Los números de las reglas de GPS › Cargar (migración 20261020_gps_reglas.sql):
// una fila por club. Sin fila (o sin la tabla todavía), valen los de la
// plantilla; faltaTabla dice si falta correr el SQL.

export const leerReglasGps = async (equipoId) => {
  if (!equipoId) return { reglas: {}, faltaTabla: false, error: "" };
  const { data, error } = await supabase.from("gps_reglas").select("reglas").eq("equipo_id", equipoId).maybeSingle();
  if (error) {
    const clave = claveDeErrorGps(error, "gps.error.noLeer");
    if (clave === "gps.error.faltaMigracion") return { reglas: {}, faltaTabla: true, error: "" };
    return { reglas: {}, faltaTabla: false, error: clave };
  }
  return { reglas: data?.reglas && typeof data.reglas === "object" && !Array.isArray(data.reglas) ? data.reglas : {}, faltaTabla: false, error: "" };
};

export const guardarReglasGps = async (equipoId, reglas) => {
  const { error } = await supabase.from("gps_reglas").upsert({ equipo_id: equipoId, reglas }, { onConflict: "equipo_id" });
  if (error) {
    const clave = claveDeErrorGps(error, "gps.ajustes.errorGuardar");
    return { error: clave === "gps.error.faltaMigracion" ? "gps.reglas.faltaMigracion" : clave };
  }
  return { error: "" };
};

// ------------------------------------------ Los valores de referencia --
// Los V.R. de cada dispositivo (migración 20261024_gps_referencias.sql):
// [{ id, dispositivo, tipo, tabla, grupo, orden, promedio, desvio,
// categorias, dePartido }], en su orden. Sin la tabla todavía, ninguno y
// faltaTabla (la Base sigue andando, sin V.R.). Desde
// 20261025_referencias_editables.sql se cambian en GPS › Valores de
// referencia (Santiago, 14/10: «Todos los vr tienen que tener su solapa
// aparte») y cada dispositivo marca el suyo «de partido»; sin esa
// actualización, sinEdicion (se miran, no se cambian, y Cargar sigue con el
// V.R. de partido de las reglas). Las categorías de los V.R. por jugador
// (20261026_gps_referencias_categorias.sql): las cuatro siempre, vacías si no
// tiene; sin esa actualización, todas vacías.
const categoriasDe = (valor) => Object.fromEntries(CATEGORIAS_DE_UN_VR.map((categoria) => [categoria, objeto(objeto(valor)[categoria])]));

export const normalizarReferenciaGps = (fila) => ({
  id: fila.id,
  dispositivo: textoLimpio(fila.dispositivo),
  tipo: textoLimpio(fila.tipo),
  tabla: textoLimpio(fila.tabla),
  grupo: textoLimpio(fila.grupo),
  orden: Number.isFinite(fila.orden) ? fila.orden : 0,
  promedio: objeto(fila.promedio),
  desvio: objeto(fila.desvio),
  categorias: categoriasDe(fila.categorias),
  dePartido: fila.de_partido === true,
});

const COLUMNAS_VR = "id, dispositivo, tipo, tabla, grupo, orden, promedio, desvio";
// Sin la columna (la base sin 20261025 o sin 20261026): la API dice que no
// existe. Sin de_partido tampoco están las categorías (son de después).
const textoDelError = (error) => `${error?.message || ""} ${error?.details || ""}`;
const faltaLaColumna = (error) => error?.code === "42703" || /de_partido|categorias/.test(textoDelError(error));

export const leerReferenciasGps = async (equipoId) => {
  if (!equipoId) return { referencias: [], faltaTabla: false, sinEdicion: false, error: "" };
  const pedir = (columnas) => supabase.from("gps_referencias").select(columnas).eq("equipo_id", equipoId).order("orden", { ascending: true });
  let sinEdicion = false;
  let { data, error } = await pedir(`${COLUMNAS_VR}, de_partido, categorias`);
  if (error && faltaLaColumna(error) && !/de_partido/.test(textoDelError(error))) ({ data, error } = await pedir(`${COLUMNAS_VR}, de_partido`));
  if (error && faltaLaColumna(error)) {
    sinEdicion = true;
    ({ data, error } = await pedir(COLUMNAS_VR));
  }
  if (error) {
    const clave = claveDeErrorGps(error, "gps.error.noLeer");
    if (clave === "gps.error.faltaMigracion") return { referencias: [], faltaTabla: true, sinEdicion: true, error: "" };
    return { referencias: [], faltaTabla: false, sinEdicion, error: clave };
  }
  return { referencias: (Array.isArray(data) ? data : []).map(normalizarReferenciaGps), faltaTabla: false, sinEdicion, error: "" };
};

// Al cambiar un V.R.: sin la actualización, que falta; un nombre que ya
// tiene otro V.R. del dispositivo, que está repetido.
const falloDeReferencia = (error) => {
  const texto = `${error?.message || ""} ${error?.details || ""}`;
  if (/gps_referencias_una|duplicate key/.test(texto)) return { error: "gps.vr.repetido" };
  if (/gps_referencias_un_partido/.test(texto)) return { error: "gps.vr.otroDePartido" };
  if (/referencia_invalida|gps_referencias_numeros|gps_referencias_textos/.test(texto)) return { error: "gps.vr.noSeEntiende" };
  const clave = claveDeErrorGps(error, "gps.error.noGuardar");
  return { error: clave === "gps.error.faltaMigracion" ? "gps.vr.faltaActualizacion" : clave };
};

// Un número de un V.R.: cual, "promedio", "desvio" o una categoría
// ("excelente", "muy_bueno", "regular" o "malo"); clave, la columna; valor,
// un número o null (se borra). Se cambia en la base, de a uno.
export const cambiarValorDeReferenciaGps = async (id, cual, clave, valor) => {
  const { data, error } = await supabase.rpc("gps_referencia_cambiar", { p_id: id, p_cual: cual, p_clave: clave, p_valor: valor });
  if (error) return falloDeReferencia(error);
  const fila = Array.isArray(data) ? data[0] : data;
  return fila ? { referencia: normalizarReferenciaGps(fila), error: "" } : { error: "gps.error.noGuardar" };
};

// Marca (o desmarca) el V.R. de partido de su dispositivo; devuelve los V.R.
// de ese dispositivo como quedaron.
export const marcarDePartidoGps = async (id, marcar) => {
  const { data, error } = await supabase.rpc("gps_referencia_de_partido", { p_id: id, p_marcar: Boolean(marcar) });
  if (error) return falloDeReferencia(error);
  return { referencias: (Array.isArray(data) ? data : []).map(normalizarReferenciaGps), error: "" };
};

// Las categorías van solo si tiene alguna (al volver atrás un V.R. por
// jugador borrado): así se suma igual en una base sin 20261026. Vuelve la
// fila entera, con las columnas que tenga la base.
export const sumarReferenciaGps = async (equipoId, { dispositivo, tipo, tabla, grupo, orden = 0, promedio = {}, desvio = {}, categorias = {} }) => {
  const fila = { equipo_id: equipoId, dispositivo, tipo: textoLimpio(tipo), tabla: textoLimpio(tabla), grupo: textoLimpio(grupo), orden, promedio, desvio };
  const conNumeros = Object.entries(categoriasDe(categorias)).filter(([, valores]) => Object.keys(valores).length);
  if (conNumeros.length) fila.categorias = Object.fromEntries(conNumeros);
  const { data, error } = await supabase.from("gps_referencias").insert(fila).select("*").single();
  if (error) return falloDeReferencia(error);
  return { referencia: normalizarReferenciaGps(data), error: "" };
};

export const renombrarReferenciaGps = async (id, { tipo, tabla, grupo }) => {
  const { data, error } = await supabase
    .from("gps_referencias")
    .update({ tipo: textoLimpio(tipo), tabla: textoLimpio(tabla), grupo: textoLimpio(grupo) })
    .eq("id", id)
    .select("*");
  if (error) return falloDeReferencia(error);
  if (!Array.isArray(data) || !data.length) return { error: "gps.error.sinPermiso" };
  return { referencia: normalizarReferenciaGps(data[0]), error: "" };
};

export const borrarReferenciaGps = async (id) => {
  const { data, error } = await supabase.from("gps_referencias").delete().eq("id", id).select("id");
  if (error) return falloDeReferencia(error);
  if (!Array.isArray(data) || !data.length) return { error: "gps.error.sinPermiso" };
  return { error: "" };
};

// El partido de ese día cargado en Partido (Santiago, 12/10: «siempre que sea
// la misma fecha que un partido … ponés Vs el rival de turno»; y «los
// jugadores que no ingresaron tmb podes sacarlos del partido cargado»):
// { rival, noIngresaron: [nombres, como en Partido] }, null si no hay o
// { error } si no se pudo mirar. Lo lee quien tiene Partido en el club.
export const partidoDelDia = async (equipoId, fecha) => {
  if (!equipoId || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || "")) || esSoloLectura(equipoId)) return null;
  // Todas las columnas: así no falla si al club le falta alguna nueva.
  const { data, error } = await supabase.from("registros_partido").select("*").eq("equipo_id", equipoId).eq("fecha", fecha).order("id", { ascending: true }).limit(1);
  if (error) return { error: "gps.cargar.partidoNoSeLeyo" };
  if (!Array.isArray(data) || !data.length) return null;
  const fila = data[0] || {};
  const rival = String(fila.rival || "").trim();
  // Los cambios como los arma Partido: los cinco de siempre y los de más.
  const cambios = [1, 2, 3, 4, 5].map((n) => ({ entra: fila[`cambio_${n}_entra`] || "", sale: fila[`cambio_${n}_sale`] || "" })).concat(Array.isArray(fila.cambios_extra) ? fila.cambios_extra : []);
  return { rival, noIngresaron: calcularNoIngresaron({ convocados: fila.convocados }, cambios) };
};

// ------------------------------------------------ Las cargas sin terminar --
// GPS › Cargar se deja para revisar y se sigue desde otro aparato
// (migración 20261021_gps_en_curso.sql; Santiago, 13/10: «poder guardarlo en
// la computadora y poder seguirlo desde mi celular donde lo deje o
// viceversa»). Una por día y club. La lista (gps_en_curso) es liviana; lo
// hecho (el CSV, lo elegido y lo corregido) va aparte (gps_en_curso_datos).
// Quién la dejó, cuándo y la versión los pone la base.

const COLUMNAS_EN_CURSO = "id, fecha, paso, resumen, version, creado_email, creado_en, actualizado_email, actualizado_en";

const objeto = (valor) => (valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {});

export const normalizarEnCurso = (fila) => ({
  id: fila?.id ?? null,
  fecha: fila?.fecha || "",
  paso: Number.isInteger(fila?.paso) && fila.paso >= 0 ? fila.paso : 0,
  resumen: objeto(fila?.resumen),
  version: Number(fila?.version) || 1,
  creado_email: fila?.creado_email || "",
  creado_en: fila?.creado_en || "",
  actualizado_email: fila?.actualizado_email || fila?.creado_email || "",
  actualizado_en: fila?.actualizado_en || fila?.creado_en || "",
});

const claveDeErrorEnCurso = (error, porDefecto) => {
  const texto = `${error?.message || ""} ${error?.details || ""}`;
  if (/gps_en_curso_un_dia/.test(texto) || error?.code === "23505") return "gps.enCurso.yaEnCurso";
  if (/gps_en_curso_otro_aparato/.test(texto)) return "gps.enCurso.otroAparato";
  if (/gps_en_curso_no_esta/.test(texto)) return "gps.enCurso.noEsta";
  if (/gps_en_curso_datos_tamano/.test(texto)) return "gps.enCurso.muyGrande";
  const clave = claveDeErrorGps(error, porDefecto);
  return clave === "gps.error.faltaMigracion" ? "gps.enCurso.faltaMigracion" : clave;
};

// Las del club, de la más nueva a la más vieja. Sin la migración, ninguna
// (faltaTabla lo dice).
export const listarEnCurso = async (equipoId) => {
  if (!equipoId || esSoloLectura(equipoId)) return { enCurso: [], faltaTabla: false, error: "" };
  const { data, error } = await supabase.from("gps_en_curso").select(COLUMNAS_EN_CURSO).eq("equipo_id", equipoId).order("fecha", { ascending: false });
  if (error) {
    const clave = claveDeErrorEnCurso(error, "gps.enCurso.noSeLeyo");
    return { enCurso: [], faltaTabla: clave === "gps.enCurso.faltaMigracion", error: clave === "gps.enCurso.faltaMigracion" ? "" : clave };
  }
  return { enCurso: (Array.isArray(data) ? data : []).map(normalizarEnCurso), faltaTabla: false, error: "" };
};

// La de un día, si hay (para no empezar otra: «lo frena y dice que ya esta en
// curso ese cargado»). Sin la migración, ninguna.
export const enCursoDelDia = async (equipoId, fecha) => {
  if (!equipoId || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ""))) return { enCurso: null, error: "" };
  const { data, error } = await supabase.from("gps_en_curso").select(COLUMNAS_EN_CURSO).eq("equipo_id", equipoId).eq("fecha", fecha).limit(1);
  if (error) {
    const clave = claveDeErrorEnCurso(error, "gps.enCurso.noSeLeyo");
    return { enCurso: null, error: clave === "gps.enCurso.faltaMigracion" ? "" : clave };
  }
  const fila = Array.isArray(data) ? data[0] : null;
  return { enCurso: fila ? normalizarEnCurso(fila) : null, error: "" };
};

// Una, con lo hecho, para seguirla.
export const leerEnCurso = async (id) => {
  if (!id) return { enCurso: null, error: "gps.enCurso.noSeAbrio" };
  const [lista, hecho] = await Promise.all([
    supabase.from("gps_en_curso").select(COLUMNAS_EN_CURSO).eq("id", id).limit(1),
    supabase.from("gps_en_curso_datos").select("datos").eq("en_curso_id", id).limit(1),
  ]);
  const error = lista.error || hecho.error;
  if (error) return { enCurso: null, error: claveDeErrorEnCurso(error, "gps.enCurso.noSeAbrio") };
  const fila = Array.isArray(lista.data) ? lista.data[0] : null;
  const datos = Array.isArray(hecho.data) ? hecho.data[0]?.datos : null;
  if (!fila) return { enCurso: null, error: "gps.enCurso.noEsta" };
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return { enCurso: null, error: "gps.enCurso.noSeAbrio" };
  return { enCurso: { ...normalizarEnCurso(fila), datos }, error: "" };
};

// Dejarla para revisar: sin id, una nueva; con id, la misma (si nadie la dejó
// desde otro aparato desde `version`). Devuelve su id y su versión nueva.
export const dejarEnCurso = async (equipoId, { id = null, version = null, fecha, paso = 0, resumen = {}, datos }) => {
  const { data, error } = await supabase.rpc("gps_dejar_en_curso", {
    p_id: id,
    p_version: id ? version : null,
    p_equipo: equipoId,
    p_fecha: fecha,
    p_paso: paso,
    p_resumen: objeto(resumen),
    p_datos: objeto(datos),
  });
  if (error) return { id: null, version: null, error: claveDeErrorEnCurso(error, "gps.enCurso.noSeDejo") };
  const respuesta = objeto(data);
  return { id: respuesta.id ?? null, version: Number(respuesta.version) || null, error: "" };
};

export const borrarEnCurso = async (id) => {
  if (!id) return { error: "" };
  const { error } = await supabase.from("gps_en_curso").delete().eq("id", id);
  if (error) return { error: claveDeErrorEnCurso(error, "gps.enCurso.noSeBorro") };
  return { error: "" };
};

// ------------------------------------------- Todas las filas, rápido --
// La Base abre con todas las filas del club (Santiago, 14/10: «Lo que sea
// mejor para poder abrir lo mas rapido posible todas las filas que se
// tengan»). La pantalla guarda una copia en el aparato (copiaGps.js): con
// ella abre al instante y después trae solo lo cambiado (ponerAlDiaGps).
// Sin copia, la primera vez, trae primero las últimas semanas (se ven
// enseguida) y después las demás (traerTodoGps).

// La cuenta que usa la app (la copia del aparato es de cada cuenta).
export const cuentaDeLaSesion = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch {
    return null;
  }
};

// Lo último que se trajo de la base: la hora (de la base) del último cambio.
const ultimoCambio = (filas, desde = null) =>
  filas.reduce((ultimo, fila) => (fila.actualizado_en && (!ultimo || Date.parse(fila.actualizado_en) > Date.parse(ultimo)) ? fila.actualizado_en : ultimo), desde);

const diaAnterior = (iso) => {
  const [anio, mes, dia] = String(iso).split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia - 1));
  return fecha.toISOString().slice(0, 10);
};

// Las filas de antes de `desdeReciente` y las de después, juntas (las de
// después, como estén en `recientes`: pudieron cambiarse mientras tanto).
export const unirFilasGps = (viejas, recientes) => {
  const ids = new Set(recientes.map((fila) => fila.id));
  return [...viejas.filter((fila) => !ids.has(fila.id)), ...recientes].sort(porFechaYOrden);
};

// Todo, la primera vez: alPrimeraParte(filas) con las de desde
// `desdeReciente` (para mostrarlas enseguida) y alAvanzar(n, total) mientras
// llegan las demás. Devuelve { recientes, viejas, hasta, error }; si las
// viejas no llegan, vuelven las recientes con el error.
export const traerTodoGps = async (equipoId, { desdeReciente, alPrimeraParte = null, alAvanzar = null } = {}) => {
  if (!equipoId) return { recientes: [], viejas: [], hasta: null, error: "" };
  // Quien ya se fue del club: la foto de su último día, entera.
  if (esSoloLectura(equipoId)) {
    const foto = await listarGps(equipoId);
    return { recientes: foto.filas, viejas: [], hasta: null, error: foto.error };
  }
  const recientes = await listarGps(equipoId, { desde: desdeReciente });
  if (recientes.error) return { recientes: [], viejas: [], hasta: null, error: recientes.error };
  alPrimeraParte?.(recientes.filas);
  const viejas = await listarGps(equipoId, { hasta: diaAnterior(desdeReciente), alAvanzar });
  if (viejas.error) return { recientes: recientes.filas, viejas: [], hasta: null, error: viejas.error };
  return { recientes: recientes.filas, viejas: viejas.filas, hasta: ultimoCambio([...recientes.filas, ...viejas.filas]), error: "" };
};

// Lo que se cambió desde `hasta` se trae con un margen (una carga larga pudo
// guardarse con una hora un poco anterior): lo repetido se pisa.
export const MARGEN_AL_DIA_MS = 10 * 60 * 1000;

// Poner al día lo que hay en el aparato: lo cargado o cambiado desde la
// última vez (por actualizado_en) y, si la cuenta de la base no da, lo
// borrado (se piden solo los id). Devuelve { filas, hasta, cambio, error }.
export const ponerAlDiaGps = async (equipoId, { filas = [], hasta = null } = {}) => {
  if (!equipoId || esSoloLectura(equipoId)) return { filas, hasta, cambio: false, error: "" };
  const desde = hasta ? new Date(Date.parse(hasta) - MARGEN_AL_DIA_MS).toISOString() : null;
  const cambios = await todas((d, h) => {
    let pedido = supabase.from("gps").select(COLUMNAS).eq("equipo_id", equipoId);
    if (desde) pedido = pedido.gte("actualizado_en", desde);
    return pedido.order("actualizado_en", { ascending: true }).order("id", { ascending: true }).range(d, h);
  });
  if (cambios.error) return { filas, hasta, cambio: false, ...fallo(cambios.error, "gps.error.noLeer") };
  const porId = new Map(filas.map((fila) => [fila.id, fila]));
  let cambio = false;
  cambios.filas.forEach((cruda) => {
    const fila = normalizarFilaGps(cruda);
    const antes = porId.get(fila.id);
    if (!antes || antes.actualizado_en !== fila.actualizado_en || JSON.stringify(antes.datos) !== JSON.stringify(fila.datos)) {
      porId.set(fila.id, fila);
      cambio = true;
    }
  });
  // ¿Se borró alguna? Si la cuenta de la base no da, se piden los id.
  const cuenta = await supabase.from("gps").select("id", { count: "exact", head: true }).eq("equipo_id", equipoId);
  if (cuenta.error) return { filas, hasta, cambio: false, ...fallo(cuenta.error, "gps.error.noLeer") };
  if (Number.isFinite(cuenta.count) && cuenta.count !== porId.size) {
    const ids = await todas((d, h) => supabase.from("gps").select("id").eq("equipo_id", equipoId).order("id", { ascending: true }).range(d, h));
    if (ids.error) return { filas, hasta, cambio: false, ...fallo(ids.error, "gps.error.noLeer") };
    const vivas = new Set(ids.filas.map((fila) => fila.id));
    [...porId.keys()].forEach((id) => {
      if (vivas.has(id)) return;
      porId.delete(id);
      cambio = true;
    });
    // Faltan filas que no se trajeron (la copia era vieja de más): todo de nuevo.
    if ([...vivas].some((id) => !porId.has(id))) {
      const todo = await listarGps(equipoId);
      if (todo.error) return { filas, hasta, cambio: false, error: todo.error };
      return { filas: todo.filas, hasta: ultimoCambio(todo.filas), cambio: true, error: "" };
    }
  }
  const nuevas = cambio ? [...porId.values()].sort(porFechaYOrden) : filas;
  return { filas: nuevas, hasta: ultimoCambio(cambios.filas, hasta), cambio, error: "" };
};
