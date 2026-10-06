import { supabase } from "../supabase.js";

// La cuenta de quien entró: si está autorizada. Vive en la tabla `perfiles`
// de Supabase; la fila la crea la base al registrarse y la pasa a autorizada
// el club que la deja entrar (invitación o pedido aceptado). Acá se lee la
// propia (la base muestra a cada uno solo la suya) y se guarda una copia en
// el celular para poder entrar sin señal. Si es dueña de la app no lo dice
// esta tabla: lo dice `mi_cuenta` (domain/plataformaDb.js) y viaja en la
// copia como `dueno`.

export const TABLA_PERFILES = "perfiles";
export const CLAVE_PERFIL_LOCAL = "perfil_cuenta";

// Todas las columnas: así una columna nueva (lesiones) no rompe la lectura
// en un celular con la app nueva y la base vieja, ni al revés.
export const COLUMNAS_PERFIL = "*";

// Lo que dice la cuenta: los módulos viejos de perfiles (solo valen con una
// base sin membresías) y si es dueña de la app ('principal', 'sub' o nada).
// Ser dueño no da módulos ni entra a ningún club.
export const permisosDePerfil = (perfil) => {
  const partido = Boolean(perfil?.partido);
  const flujo = Boolean(perfil?.flujo);
  const lesiones = Boolean(perfil?.lesiones);
  const evaluaciones = Boolean(perfil?.evaluaciones);
  const dueno = perfil?.dueno === "principal" || perfil?.dueno === "sub" ? perfil.dueno : null;
  return {
    partido,
    flujo,
    lesiones,
    evaluaciones,
    // Datos básicos (los jugadores) lo usa cualquiera que tenga algún módulo.
    datos: partido || flujo || lesiones || evaluaciones,
    dueno,
    esDueno: Boolean(dueno),
  };
};

// Cómo está la cuenta para entrar: pendiente, bloqueada o lista ("ok"). Qué
// módulos usa ya no lo dice la cuenta sino cada club (su membresía).
export const situacionDePerfil = (perfil) => {
  const estado = perfil?.estado || "pendiente";
  if (estado === "bloqueado") return "bloqueado";
  if (estado !== "autorizado") return "pendiente";
  return "ok";
};

// Lo que la cuenta puede hacer en el club elegido: los módulos de su
// membresía (si la base todavía no los tiene, los de la cuenta) y si
// administra la gente del club. Ser dueño de la app no administra ningún
// club: eso lo da solo la membresía.
export const permisosEnClub = (permisosCuenta, club) => {
  const dueno = permisosCuenta?.dueno || null;
  const esDueno = Boolean(dueno);
  if (!club) return { partido: false, flujo: false, lesiones: false, evaluaciones: false, datos: false, dueno, esDueno, adminClub: false };
  const modulo = (clave) => (typeof club[clave] === "boolean" ? club[clave] : Boolean(permisosCuenta?.[clave]));
  const partido = modulo("partido");
  const flujo = modulo("flujo");
  const lesiones = modulo("lesiones");
  const evaluaciones = modulo("evaluaciones");
  const adminClub = club.rol === "admin" && !club.hasta;
  return { partido, flujo, lesiones, evaluaciones, datos: partido || flujo || lesiones || evaluaciones, dueno, esDueno, adminClub };
};

// Los errores de la base vuelven como clave del diccionario (Supabase
// contesta en inglés y el texto de acá iba siempre en castellano): así se
// leen en el idioma de la app. Un fallo de red queda marcado (deRed), para
// que la puerta entre con la copia del celular.
const FALLO_DE_RED = /failed to fetch|load failed|networkerror|network request failed|fetch failed/i;
const fallo = (error, clave) => {
  const deRed = FALLO_DE_RED.test(String(error?.message || ""));
  return Object.assign(new Error(deRed ? "comun.sinConexion" : clave), { deRed, detalle: error?.message || "" });
};

export const leerMiPerfil = async (userId) => {
  const { data, error } = await supabase
    .from(TABLA_PERFILES)
    .select(COLUMNAS_PERFIL)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw fallo(error, "acceso.error.noComprobar");
  return data || null;
};

export const guardarPerfilLocal = (perfil) => {
  try {
    if (perfil) localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(perfil));
    else localStorage.removeItem(CLAVE_PERFIL_LOCAL);
  } catch {
    // Sin localStorage no hay copia; la próxima vez se vuelve a leer.
  }
};

// La copia guardada: la de la cuenta pedida o, sin cuenta (sin señal y sin
// sesión que leer), la última que entró en este celular.
export const leerPerfilLocal = (userId = null) => {
  try {
    const perfil = JSON.parse(localStorage.getItem(CLAVE_PERFIL_LOCAL) || "null");
    if (!perfil || typeof perfil !== "object") return null;
    return userId && perfil.user_id !== userId ? null : perfil;
  } catch {
    return null;
  }
};

// ------------------------------------------------ Para el administrador --
// La base le muestra todas las filas solo a un administrador autorizado; a
// cualquier otro, únicamente la suya (y no le deja cambiar nada).

export const listarPerfiles = async () => {
  const { data, error } = await supabase
    .from(TABLA_PERFILES)
    .select(COLUMNAS_PERFIL)
    .order("creado_en", { ascending: true });
  if (error) throw fallo(error, "cuentas.errorLeer");
  return data || [];
};

export const contarPendientes = async () => {
  const { count, error } = await supabase
    .from(TABLA_PERFILES)
    .select("user_id", { count: "exact", head: true })
    .eq("estado", "pendiente");
  if (error) throw fallo(error, "cuentas.errorLeer");
  return count || 0;
};

// Cambia el estado o los módulos de una cuenta ajena. Si la base no dejó
// (no sos administrador, es tu propia fila o la cuenta ya no existe), no
// actualiza ninguna fila y no da error: por eso se mira cuántas volvieron.
export const decidirPerfil = async (userId, cambios) => {
  const permitidos = {};
  for (const clave of ["estado", "partido", "flujo", "lesiones", "admin"]) {
    if (clave in cambios) permitidos[clave] = cambios[clave];
  }
  const { data, error } = await supabase
    .from(TABLA_PERFILES)
    .update(permitidos)
    .eq("user_id", userId)
    .select(COLUMNAS_PERFIL);
  if (error) throw fallo(error, "cuentas.errorCambiar");
  if (!data || data.length === 0) throw new Error("cuentas.errorCambiarSinPermiso");
  return data[0];
};

// Las cuentas en tres listas, la propia marcada, para la pantalla Cuentas.
export const agruparPerfiles = (perfiles, miUserId) => {
  const grupos = { pendientes: [], conAcceso: [], sinAcceso: [] };
  for (const perfil of perfiles || []) {
    const fila = { ...perfil, esMia: perfil.user_id === miUserId };
    if (perfil.estado === "autorizado") grupos.conAcceso.push(fila);
    else if (perfil.estado === "bloqueado") grupos.sinAcceso.push(fila);
    else grupos.pendientes.push(fila);
  }
  return grupos;
};
