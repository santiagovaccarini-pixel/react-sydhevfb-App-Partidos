import { autenticarCookieOpenField } from "../../lib/openfieldAuth.js";
import { tomarSnapshotConnect } from "../../lib/openfieldSnapshot.js";

export const config = {
  maxDuration: 30,
};

const normalizarActivityId = (valor) => {
  const candidato = Array.isArray(valor) ? valor[0] : valor;
  const id = String(candidato || "").trim();
  if (!id || id.length > 128) return "";
  return id;
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

  const lectura = await tomarSnapshotConnect({
    token,
    activityId,
    baseUrl: process.env.OPENFIELD_API_BASE_URL,
  });

  if (!lectura.ok) {
    return response.status(lectura.status).json({
      ok: false,
      error: lectura.error,
      ...(lectura.upstreamStatus ? { upstreamStatus: lectura.upstreamStatus } : {}),
    });
  }

  return response.status(200).json({
    ok: true,
    source: "catapult-connect",
    ...lectura.snapshot,
  });
}
