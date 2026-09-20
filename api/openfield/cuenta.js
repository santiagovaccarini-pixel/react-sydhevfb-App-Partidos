import { autenticarBearerSupabase, tokenBearer } from "../../lib/openfieldAuth.js";
import { capturarPaseConLogin, leerBodyJson, textoSeguro } from "../../lib/catapultCloud.js";
import {
  borrarCuenta,
  claveConfigurada,
  errorDeTabla,
  guardarCuenta,
  leerCuenta,
} from "../../lib/catapultCuenta.js";

export const config = {
  maxDuration: 60,
};

// Cuenta de Catapult del usuario que hace el pedido.
// GET: estado (sin secretos). POST: conectar (valida con un login real y
// guarda cifrado). DELETE: desconectar. Siempre con el token de Supabase del
// usuario, así la base solo le muestra su propia fila.
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Authorization");

  if (!["GET", "POST", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST, DELETE");
    return response.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const auth = await autenticarBearerSupabase(request);
  if (!auth.ok) {
    return response.status(auth.status).json({ ok: false, error: auth.error });
  }

  if (!claveConfigurada()) {
    return response.status(500).json({
      ok: false,
      code: "SIN_CLAVE",
      error: "CATAPULT_SESSION_KEY no está configurada en el servidor.",
    });
  }

  const token = tokenBearer(request);
  const userId = auth.user.id;

  if (request.method === "GET") {
    const lectura = await leerCuenta({ token, userId });
    if (!lectura.ok) {
      return response.status(502).json({ ok: false, error: errorDeTabla(lectura) });
    }
    return response.status(200).json({ ok: true, cuenta: lectura.cuenta });
  }

  if (request.method === "DELETE") {
    const borrado = await borrarCuenta({ token, userId });
    if (!borrado.ok) {
      return response.status(502).json({ ok: false, error: errorDeTabla(borrado) });
    }
    return response.status(200).json({ ok: true, cuenta: { configurada: false } });
  }

  const body = leerBodyJson(request);
  const usuario = textoSeguro(body?.username, 254);
  const password = textoSeguro(body?.password, 512);

  if (!usuario || !password) {
    return response.status(400).json({
      ok: false,
      error: "Completá usuario y contraseña de Catapult.",
    });
  }

  // Antes de guardar, se comprueba que Catapult acepte la cuenta.
  const login = await capturarPaseConLogin({ username: usuario, password });
  if (!login.ok) {
    return response.status(login.status || 502).json({
      ok: false,
      code: login.code,
      error:
        login.code === "CATAPULT_LOGIN_REJECTED"
          ? "Catapult no aceptó ese usuario y contraseña. No se guardó nada."
          : `${login.error} No se guardó nada.`,
      etapa: login.etapa,
      captura: login.captura || null,
    });
  }

  const guardado = await guardarCuenta({ token, userId, usuario, password, pase: login.pase });
  if (!guardado.ok) {
    return response.status(502).json({ ok: false, error: errorDeTabla(guardado) });
  }

  return response.status(200).json({
    ok: true,
    cuenta: guardado.cuenta,
    message: `Cuenta de Catapult conectada como ${usuario}. La contraseña quedó guardada cifrada.`,
  });
}
