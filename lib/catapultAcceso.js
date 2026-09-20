// Resuelve el pase de Catapult para un pedido de la app, en este orden:
// 1) si el pedido trae usuario y contraseña, login con esas (modo diagnóstico);
// 2) si no, la cuenta guardada del usuario (identificado por su token de
//    Supabase), con el pase del cache mientras dure o un login nuevo.
// Devuelve { ok, pase, usuario, origen } o { ok: false, status, code, error }.

import { capturarPaseConLogin } from "./catapultCloud.js";
import { claveConfigurada, obtenerPase } from "./catapultCuenta.js";
import { autenticarBearerSupabase } from "./openfieldAuth.js";

export const resolverPase = async ({ request, username, password }) => {
  if (username && password) {
    const login = await capturarPaseConLogin({ username, password });
    if (!login.ok) return { ok: false, status: login.status || 502, ...login };
    return { ok: true, pase: login.pase, usuario: username, origen: "credenciales" };
  }

  if (!claveConfigurada()) {
    return {
      ok: false,
      status: 500,
      code: "SIN_CLAVE",
      error: "CATAPULT_SESSION_KEY no está configurada en el servidor.",
    };
  }

  const auth = await autenticarBearerSupabase(request);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      code: "SESION_APP",
      error: `${auth.error} Volvé a entrar a Entrenamiento.`,
    };
  }

  const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const resultado = await obtenerPase({
    token,
    userId: auth.user.id,
    iniciarSesion: capturarPaseConLogin,
  });

  if (!resultado.ok) {
    const status = resultado.code === "SIN_CUENTA" ? 409 : resultado.code === "SESION_APP" ? 401 : 502;
    return { ok: false, status, ...resultado };
  }

  return { ok: true, pase: resultado.pase, usuario: resultado.usuario, origen: resultado.origen };
};
