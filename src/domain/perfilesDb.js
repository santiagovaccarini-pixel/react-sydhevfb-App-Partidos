import { supabase } from "../supabase.js";

// La cuenta de quien entró: si está autorizada y qué módulos puede usar.
// Vive en la tabla `perfiles` de Supabase; la fila la crea la base al
// registrarse y la decide el administrador. Acá se lee la propia (la base
// muestra a cada uno solo la suya) y se guarda una copia en el celular para
// poder entrar sin señal.

export const TABLA_PERFILES = "perfiles";
export const CLAVE_PERFIL_LOCAL = "perfil_cuenta";

export const COLUMNAS_PERFIL = "user_id, email, estado, partido, flujo, admin, confirmado_en";

// Qué puede usar: el administrador, todo.
export const permisosDePerfil = (perfil) => {
  const admin = Boolean(perfil?.admin);
  return {
    partido: admin || Boolean(perfil?.partido),
    flujo: admin || Boolean(perfil?.flujo),
    admin,
  };
};

// Cómo está la cuenta para entrar: pendiente, bloqueada, autorizada sin
// ningún módulo ("sin-modulos") o lista ("ok").
export const situacionDePerfil = (perfil) => {
  const estado = perfil?.estado || "pendiente";
  if (estado === "bloqueado") return "bloqueado";
  if (estado !== "autorizado") return "pendiente";
  const permisos = permisosDePerfil(perfil);
  return permisos.partido || permisos.flujo ? "ok" : "sin-modulos";
};

export const leerMiPerfil = async (userId) => {
  const { data, error } = await supabase
    .from(TABLA_PERFILES)
    .select(COLUMNAS_PERFIL)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message || "No se pudo leer la cuenta.");
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
