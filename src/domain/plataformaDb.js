import { supabase } from "../supabase.js";
import { correoValido } from "./membresiasDb.js";

// La plataforma: el dueño principal, los sub-dueños y el panel "Clubes de la
// app". Todo pasa por funciones de la base (RPC) que miran quién llama antes
// de hacer nada: de cada club, un dueño ve solo el nombre, el correo de la
// entidad, el del administrador y cuánta gente tiene. Nunca la gente, los
// datos ni las invitaciones. Y nunca acepta a nadie en un club: eso lo
// decide cada club.

// Las zonas horarias que se ofrecen al crear un club (después se cambia solo
// por SQL). La de por defecto es la del primer club.
export const ZONA_POR_DEFECTO = "America/Sao_Paulo";
export const ZONAS_DE_CLUB = Object.freeze([
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Montevideo",
  "America/Santiago",
  "America/Asuncion",
  "America/Bogota",
  "America/Lima",
  "America/Mexico_City",
  "Europe/Madrid",
  "Europe/Lisbon",
]);

// "America/Argentina/Buenos_Aires" → "Buenos Aires".
export const nombreDeZona = (zona) => String(zona || "").split("/").pop().replace(/_/g, " ");

// ------------------------------------------------------------ Errores --

const FALLO_DE_RED = /failed to fetch|load failed|networkerror|network request failed|fetch failed/i;
const aCamello = (codigo) => codigo.replace(/_([a-z])/g, (_, letra) => letra.toUpperCase());

// Arma el traductor de errores de un grupo de RPC: el código que manda la
// base ("nombre_repetido") pasa a la clave del diccionario
// ("panel.error.nombreRepetido"). Los códigos se buscan en orden y desde el
// principio de una palabra: los largos van antes que los cortos que los
// contienen ("dueno_principal_invalido" antes que "dueno_principal").
// Una función que la base todavía no tiene es "falta actualizar la base"; un
// permiso negado, "no tenés permiso"; sin red, el aviso de siempre.
export const armarClaveDeError = (prefijo, codigos) => (error, porDefecto = `${prefijo}.generico`) => {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  if (FALLO_DE_RED.test(texto)) return "comun.sinConexion";
  const codigo = codigos.find((uno) => new RegExp(`\\b${uno}`).test(texto));
  if (codigo) return `${prefijo}.${aCamello(codigo)}`;
  if (error?.code === "PGRST202" || error?.code === "42883" || /could not find the function/i.test(texto)) return `${prefijo}.faltaMigracion`;
  if (error?.code === "42501" || /permission denied|row-level security/i.test(texto)) return `${prefijo}.sinPermiso`;
  return porDefecto;
};

export const claveDeError = armarClaveDeError("panel.error", [
  "solo_duenos",
  "solo_dueno_principal",
  "dueno_principal_invalido",
  "dueno_principal",
  "nombre_invalido",
  "nombre_repetido",
  "zona_horaria_invalida",
  "club_inexistente",
  "correo_invalido",
  "entidad_es_dueno",
  "entidad_repetida",
  "cuenta_inexistente",
  "correo_sin_confirmar",
  "cuenta_bloqueada",
  "ya_es_dueno",
  "es_entidad",
  "no_es_subdueno",
  "pedido_cerrado",
  "club_sin_admin",
]);

const fallo = (error, porDefecto) =>
  Object.assign(new Error(claveDeError(error, porDefecto)), { codigo: error?.code || "", detalle: error?.message || "" });

const llamar = async (funcion, parametros) => {
  const { data, error } = await supabase.rpc(funcion, parametros);
  if (error) throw fallo(error);
  return data;
};

const limpiarCorreo = (correo) => String(correo || "").trim().toLowerCase();

// --------------------------------------------------------- La cuenta --

// Lo que la base dice de quien entró: si es dueño ('principal' o 'sub'),
// si tiene Flujo diario y si puede usar el Catapult del servidor (el de un
// solo club por ahora). Solo sobre la propia cuenta.
export const leerMiCuenta = async () => {
  const { data, error } = await supabase.rpc("mi_cuenta").maybeSingle();
  if (error) throw fallo(error);
  if (!data) return null;
  return {
    estado: data.estado || "pendiente",
    dueno: data.dueno === "principal" || data.dueno === "sub" ? data.dueno : null,
    flujo: Boolean(data.flujo),
    catapult: Boolean(data.catapult),
    tecnico: Boolean(data.tecnico),
  };
};

// ------------------------------------------------------------ El panel --

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre);

export const panelClubes = async () => {
  const filas = (await llamar("panel_clubes")) || [];
  return filas
    .map((fila) => ({
      equipo_id: fila.equipo_id,
      nombre: String(fila.nombre || "").trim(),
      correo_entidad: fila.correo_entidad || null,
      correo_admin: fila.correo_admin || null,
      personas: Number(fila.personas) || 0,
    }))
    .sort(porNombre);
};

// Los dueños: el principal arriba.
export const panelDuenos = async () => {
  const filas = (await llamar("panel_duenos")) || [];
  return filas
    .map((fila) => ({ user_id: fila.user_id, email: fila.email || "", principal: Boolean(fila.principal), es_mia: Boolean(fila.es_mia) }))
    .sort((a, b) => (a.principal === b.principal ? a.email.localeCompare(b.email) : a.principal ? -1 : 1));
};

export const panelHistorial = async (limite = 50) => (await llamar("panel_historial", { p_limite: limite })) || [];

// Crea un club vacío: quien lo crea no queda adentro. Con el correo de la
// entidad, queda anotada (en este paso es solo un dato).
export const crearClub = async ({ nombre, correoEntidad = "", zona = ZONA_POR_DEFECTO } = {}) => {
  const limpio = String(nombre || "").trim();
  if (!limpio || limpio.length > 60) throw new Error("panel.error.nombreInvalido");
  const correo = limpiarCorreo(correoEntidad);
  if (correo && !correoValido(correo)) throw new Error("panel.error.correoInvalido");
  return llamar("crear_club", { p_nombre: limpio, p_correo_entidad: correo || null, p_zona: zona || ZONA_POR_DEFECTO });
};

// El nombre limpio como lo guarda la base: sin espacios en las puntas y con
// los del medio juntados en uno. Así "Club  Uno" es el mismo que "Club Uno".
export const limpiarNombreDeClub = (nombre) => String(nombre || "").trim().replace(/\s+/g, " ");

// Cambia el nombre de un club, con las mismas reglas que al crearlo (la base
// además lo compara con los otros sin tildes ni mayúsculas). Los datos de un
// club los cambian solo los dueños (decisión del 09/10): ni su administrador
// ni su entidad. Queda en Movimientos y en la historia del club, sin decir
// qué dueño fue.
export const renombrarClub = async (equipoId, nombre) => {
  const limpio = limpiarNombreDeClub(nombre);
  if (!limpio || limpio.length > 60) throw new Error("panel.error.nombreInvalido");
  await llamar("renombrar_club", { p_equipo: equipoId, p_nombre: limpio });
  return true;
};

// Asigna o cambia el correo de la entidad de un club; vacío, la saca.
export const asignarEntidad = async (equipoId, correoNuevo) => {
  const correo = limpiarCorreo(correoNuevo);
  if (correo && !correoValido(correo)) throw new Error("panel.error.correoInvalido");
  await llamar("asignar_entidad", { p_equipo: equipoId, p_correo: correo || null });
  return true;
};

// Sumar, quitar y traspasar dueños: solo el dueño principal (la base lo frena
// para los demás).
export const agregarSubdueno = async (correoNuevo) => {
  const correo = limpiarCorreo(correoNuevo);
  if (!correoValido(correo)) throw new Error("panel.error.correoInvalido");
  return llamar("agregar_subdueno", { p_correo: correo });
};

export const quitarSubdueno = async (userId) => {
  await llamar("quitar_subdueno", { p_user: userId });
  return true;
};

export const traspasarPrincipal = async (userId) => {
  await llamar("traspasar_principal", { p_user: userId });
  return true;
};

// --------------------------------------- Pedidos de clubes que no están --
// Quien pidió entrar a un club que no coincide con ninguno de la app, o a uno
// que hoy no tiene administrador. Los dueños lo mandan a un club con
// administrador (ahí decide él; a uno sin administrador la base no deja:
// 'club_sin_admin') o lo rechazan.

export const pedidosSinClub = async () => (await llamar("pedidos_sin_club")) || [];

export const derivarPedido = async (id, equipoId) => {
  await llamar("derivar_pedido", { p_id: id, p_equipo: equipoId });
  return true;
};

export const rechazarPedidoSinClub = async (id) => {
  await llamar("rechazar_pedido_sin_club", { p_id: id });
  return true;
};
