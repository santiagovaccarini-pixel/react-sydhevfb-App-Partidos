import {
  autenticarBearerSupabase,
  autenticarCookieOpenField,
  borrarCookieSesionOpenField,
  crearCookieSesionOpenField,
} from "../../lib/openfieldAuth.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Cookie, Authorization");

  if (request.method === "GET") {
    const auth = autenticarCookieOpenField(request);
    if (!auth.ok) {
      return response.status(auth.status).json({ ok: false, error: auth.error });
    }

    return response.status(200).json({
      ok: true,
      email: auth.user.email,
    });
  }

  if (request.method === "POST") {
    const auth = await autenticarBearerSupabase(request);
    if (!auth.ok) {
      return response.status(auth.status).json({ ok: false, error: auth.error });
    }

    const cookie = crearCookieSesionOpenField(auth.user);
    if (!cookie) {
      return response.status(500).json({
        ok: false,
        error: "No se pudo crear la sesión segura de OpenField.",
      });
    }

    response.setHeader("Set-Cookie", cookie);
    return response.status(200).json({
      ok: true,
      email: auth.user.email,
    });
  }

  if (request.method === "DELETE") {
    response.setHeader("Set-Cookie", borrarCookieSesionOpenField());
    return response.status(200).json({ ok: true });
  }

  response.setHeader("Allow", "GET, POST, DELETE");
  return response.status(405).json({ ok: false, error: "Método no permitido" });
}
