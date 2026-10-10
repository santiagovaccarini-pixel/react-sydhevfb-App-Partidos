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
  const gps = Boolean(perfil?.gps);
  const dueno = perfil?.dueno === "principal" || perfil?.dueno === "sub" ? perfil.dueno : null;
  return {
    partido,
    flujo,
    lesiones,
    evaluaciones,
    gps,
    // Datos básicos (los jugadores) lo usa cualquiera que tenga algún módulo.
    datos: partido || flujo || lesiones || evaluaciones || gps,
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
  if (!club) return { partido: false, flujo: false, lesiones: false, evaluaciones: false, gps: false, datos: false, dueno, esDueno, adminClub: false };
  const modulo = (clave) => (typeof club[clave] === "boolean" ? club[clave] : Boolean(permisosCuenta?.[clave]));
  const partido = modulo("partido");
  const flujo = modulo("flujo");
  const lesiones = modulo("lesiones");
  const evaluaciones = modulo("evaluaciones");
  const gps = modulo("gps");
  const adminClub = club.rol === "admin" && !club.hasta;
  return { partido, flujo, lesiones, evaluaciones, gps, datos: partido || flujo || lesiones || evaluaciones || gps, dueno, esDueno, adminClub };
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
