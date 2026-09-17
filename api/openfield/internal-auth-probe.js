import { autenticarCookieOpenField } from "../../lib/openfieldAuth.js";

const OPENFIELD_INTERNAL_BASE_URL =
  process.env.OPENFIELD_INTERNAL_ACTIVITY_BASE_URL ||
  "https://of-uw1-prod-activity-service.openfield.catapultsports.com";

const normalizarActivityId = (valor) => {
  const candidato = Array.isArray(valor) ? valor[0] : valor;
  const id = String(candidato || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : "";
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Cookie");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const auth = autenticarCookieOpenField(request);
  if (!auth.ok) {
    return response.status(auth.status).json({ ok: false, error: auth.error });
  }

  const activityId = normalizarActivityId(request.query?.activityId);
  if (!activityId) {
    return response.status(400).json({ ok: false, error: "Falta un activityId válido." });
  }

  const token = process.env.OPENFIELD_API_TOKEN;
  if (!token) {
    return response.status(500).json({
      ok: false,
      error: "OPENFIELD_API_TOKEN no está configurado en el servidor.",
    });
  }

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 8000);

  try {
    // Endpoint observado en el Cloud Editor al releer la actividad después de guardar.
    // Esta prueba es estrictamente GET y nunca envía PUT/POST/PATCH/DELETE.
    const upstream = await fetch(
      `${OPENFIELD_INTERNAL_BASE_URL}/activities/${encodeURIComponent(activityId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: controlador.signal,
        redirect: "manual",
      },
    );

    const status = upstream.status;
    const authAccepted = status >= 200 && status < 300;
    const authRejected = status === 401 || status === 403;

    return response.status(200).json({
      ok: true,
      probe: "read-only",
      method: "GET",
      upstreamStatus: status,
      result: authAccepted
        ? "token-accepted"
        : authRejected
          ? "token-rejected"
          : "inconclusive",
      message: authAccepted
        ? "El token de Connect fue aceptado por el servicio interno de actividad."
        : authRejected
          ? "El servicio interno rechazó el token de Connect; el Cloud Editor usa otra autenticación o scope."
          : "La respuesta no permite confirmar todavía si el token sirve para este servicio.",
    });
  } catch (error) {
    const esTimeout = error?.name === "AbortError";
    return response.status(esTimeout ? 504 : 502).json({
      ok: false,
      error: esTimeout
        ? "El servicio interno de OpenField demoró demasiado en responder."
        : "No se pudo consultar el servicio interno de OpenField.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
