import {
  autenticarBearerSupabase,
  autenticarCookieOpenField,
  borrarCookieSesionOpenField,
  crearCookieSesionOpenField,
  responderNoAutenticado,
} from "../../lib/openfieldAuth.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Cookie, Authorization");

  if (request.method === "GET") {
    const auth = autenticarCookieOpenField(request);
    if (!auth.ok) return responderNoAutenticado(response, auth);

    return response.status(200).json({ ok: true, email: auth.user.email, rol: auth.user.rol });
  }

  if (request.method === "POST") {
    const auth = await autenticarBearerSupabase(request);
    if (!auth.ok) return responderNoAutenticado(response, auth);

    const cookie = crearCookieSesionOpenField(auth.user, { jwtExp: auth.jwtExp });
    if (!cookie) {
      return response.status(500).json({
        ok: false,
        code: "SIN_SECRETO",
        error: "No se pudo crear la sesión segura de OpenField.",
      });
    }

    response.setHeader("Set-Cookie", cookie);
    return response.status(200).json({ ok: true, email: auth.user.email, rol: auth.user.rol });
  }

  if (request.method === "DELETE") {
    response.setHeader("Set-Cookie", borrarCookieSesionOpenField());
    return response.status(200).json({ ok: true });
  }

  response.setHeader("Allow", "GET, POST, DELETE");
  return response.status(405).json({ ok: false, error: "Método no permitido" });
}
