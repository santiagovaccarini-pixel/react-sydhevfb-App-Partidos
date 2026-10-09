import capabilityProbe from "../../lib/pruebasTecnicas/capability-probe.js";
import cloudEditorInspect from "../../lib/pruebasTecnicas/cloud-editor-inspect.js";
import cloudLoginTest from "../../lib/pruebasTecnicas/cloud-login-test.js";
import cloudTokenProbe from "../../lib/pruebasTecnicas/cloud-token-probe.js";
import cloudWriteTest from "../../lib/pruebasTecnicas/cloud-write-test.js";

export const config = {
  maxDuration: 60,
};

// Las pruebas técnicas de Flujo diario (Ajustes › Pruebas técnicas) en una
// sola función: el plan de Vercel admite hasta 12 funciones por publicación.
// Cada prueba sigue igual en lib/pruebasTecnicas/ y se elige con ?prueba=.
const PRUEBAS = {
  "capability-probe": capabilityProbe,
  "cloud-editor-inspect": cloudEditorInspect,
  "cloud-login-test": cloudLoginTest,
  "cloud-token-probe": cloudTokenProbe,
  "cloud-write-test": cloudWriteTest,
};

export default async function handler(request, response) {
  const pedida = request.query?.prueba;
  const nombre = String(Array.isArray(pedida) ? pedida[0] : pedida || "");
  const prueba = Object.hasOwn(PRUEBAS, nombre) ? PRUEBAS[nombre] : null;
  if (!prueba) {
    response.setHeader("Cache-Control", "private, no-store");
    return response.status(404).json({ ok: false, error: "Prueba técnica desconocida" });
  }
  return prueba(request, response);
}
