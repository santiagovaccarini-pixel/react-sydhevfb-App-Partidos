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

// Respuestas del servidor que quieren decir "la sesión de OpenField no
// sirve": se pide una nueva con el token de Supabase y se repite el pedido.
export const CODIGOS_SESION_OPENFIELD = new Set(["SIN_SESION", "SESION_INVALIDA", "SESION_VENCIDA"]);

export const RUTA_SESION_OPENFIELD = "/api/openfield/session";

// Abre (o renueva) la sesión de OpenField del servidor con el token de
// Supabase de quien entró. Devuelve la respuesta y el cuerpo.
export const abrirSesionOpenField = async () => {
  const token = await tokenSesion();
  if (!token) return { respuesta: null, payload: null };
  const respuesta = await fetch(RUTA_SESION_OPENFIELD, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const payload = await respuesta.json().catch(() => null);
  return { respuesta, payload };
};

const pedirUnaVez = async (url, { method, body }) => {
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

// fetch con la sesión de la app puesta (cookie de OpenField + token de
// Supabase). Si la cookie venció (la app estuvo en el fondo del celular más
// de una hora), se renueva sola y se repite el pedido una vez. Si al
// renovarla el servidor dice que la cuenta no puede (403: sin Flujo diario,
// o su club no tiene Catapult en la app), vale esa respuesta: dice el porqué.
export const pedirJson = async (url, { method = "GET", body } = {}) => {
  const primero = await pedirUnaVez(url, { method, body });
  const codigo = primero.payload?.code;
  const sesionVencida =
    primero.respuesta.status === 401 && CODIGOS_SESION_OPENFIELD.has(codigo) && !url.startsWith(RUTA_SESION_OPENFIELD);
  if (!sesionVencida) return primero;

  const renovada = await abrirSesionOpenField();
  if (renovada.respuesta?.status === 403) return renovada;
  if (!renovada.respuesta?.ok) return primero;
  return pedirUnaVez(url, { method, body });
};
