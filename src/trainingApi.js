import { supabase } from "./supabase.js";

// Token de Supabase del usuario que está usando la app. Los endpoints que
// leen su cuenta de Catapult lo necesitan para que la base le muestre solo su
// propia fila.
export const tokenSesion = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  } catch {
    return "";
  }
};

export const cabecerasJson = async () => {
  const token = await tokenSesion();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// El texto de error de una respuesta. Los endpoints de la app mandan
// `error` como texto; Vercel, cuando la función falla o no existe, manda un
// objeto { code, message }. Sin esto, el celular mostraba "[object Object]".
export const mensajeDeRespuesta = (payload, porDefecto) => {
  const error = payload?.error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const mensaje = typeof error.message === "string" ? error.message.trim() : "";
    const codigo = typeof error.code === "string" ? error.code.trim() : "";
    if (mensaje && codigo) return `${mensaje} (${codigo})`;
    if (mensaje) return mensaje;
    if (codigo) return `${porDefecto} (${codigo})`;
  }
  return porDefecto;
};

// fetch con la sesión de la app puesta (cookie de OpenField + token de Supabase).
export const pedirJson = async (url, { method = "GET", body } = {}) => {
  const respuesta = await fetch(url, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: await cabecerasJson(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await respuesta.json().catch(() => null);
  return { respuesta, payload };
};
