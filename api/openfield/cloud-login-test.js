import { autenticarCookieOpenField } from "../../lib/openfieldAuth.js";
import {
  ACTIVIDAD_PRUEBA,
  abrirEditorActividad,
  abrirNavegador,
  capturarPantalla,
  cerrarNavegador,
  clasificarErrorNavegador,
  iniciarSesionCatapult,
  leerBodyJson,
  resumirError,
  textoSeguro,
} from "../../lib/catapultCloud.js";

export const config = {
  maxDuration: 60,
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Cookie");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const auth = autenticarCookieOpenField(request);
  if (!auth.ok) {
    return response.status(auth.status).json({ ok: false, error: auth.error });
  }

  const body = leerBodyJson(request);
  const username = textoSeguro(body?.username, 254);
  const password = textoSeguro(body?.password, 512);

  if (!username || !password) {
    return response.status(400).json({
      ok: false,
      error: "Completá usuario y contraseña de Catapult.",
    });
  }

  let nav = null;
  let etapa = "inicio";

  try {
    etapa = "lanzar-navegador";
    nav = await abrirNavegador();

    etapa = "login";
    const login = await iniciarSesionCatapult(nav.page, { username, password });
    if (!login.ok) {
      return response.status(login.status).json({
        ok: false,
        code: login.code,
        error: login.error,
        etapa,
        captura: await capturarPantalla(nav.page),
      });
    }

    etapa = "abrir-editor";
    const editor = await abrirEditorActividad(nav.page, ACTIVIDAD_PRUEBA);

    if (!editor.enEditor || !editor.nombreVisible) {
      return response.status(502).json({
        ok: false,
        code: "EDITOR_NOT_REACHED",
        error:
          "Catapult inició sesión, pero la prueba no pudo confirmar el Editor de la actividad 26-05 T.",
      });
    }

    return response.status(200).json({
      ok: true,
      result: "catapult-login-verified",
      mode: "read-only-login-test",
      activity: ACTIVIDAD_PRUEBA,
      message:
        "Inicio de sesión validado y actividad 26-05 T abierta correctamente. No se modificó ningún período.",
    });
  } catch (error) {
    const { timeout } = clasificarErrorNavegador(error);

    return response.status(timeout ? 504 : 502).json({
      ok: false,
      code: timeout ? "CATAPULT_TIMEOUT" : "CATAPULT_BROWSER_ERROR",
      error: timeout
        ? `Catapult demoró demasiado en responder durante la prueba de conexión (etapa: ${etapa}).`
        : `No se pudo completar la prueba de acceso automatizado a Catapult (etapa: ${etapa}).`,
      etapa,
      detalle: resumirError(error),
      captura: await capturarPantalla(nav?.page),
    });
  } finally {
    await cerrarNavegador(nav);
  }
}
