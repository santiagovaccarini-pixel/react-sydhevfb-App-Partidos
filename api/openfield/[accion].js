// Única función de Vercel para todo /api/openfield/*.
//
// El plan Hobby de Vercel admite hasta 12 funciones por despliegue y con la
// ruta de cortes ya eran 13: el despliegue fallaba y producción se quedaba en
// la versión anterior. Con un solo punto de entrada, cada ruta es un módulo en
// lib/rutas que se carga recién cuando alguien la pide, así las rutas livianas
// (leer actividades, períodos) no cargan Playwright al arrancar.
//
// Las URLs no cambian: /api/openfield/cortes sigue siendo /api/openfield/cortes.

export const config = {
  maxDuration: 60,
};

const RUTAS = {
  activities: () => import("../../lib/rutas/activities.js"),
  atletas: () => import("../../lib/rutas/atletas.js"),
  "capability-probe": () => import("../../lib/rutas/capability-probe.js"),
  "cloud-editor-inspect": () => import("../../lib/rutas/cloud-editor-inspect.js"),
  "cloud-login-test": () => import("../../lib/rutas/cloud-login-test.js"),
  "cloud-token-probe": () => import("../../lib/rutas/cloud-token-probe.js"),
  "cloud-write-test": () => import("../../lib/rutas/cloud-write-test.js"),
  cortes: () => import("../../lib/rutas/cortes.js"),
  cuenta: () => import("../../lib/rutas/cuenta.js"),
  periods: () => import("../../lib/rutas/periods.js"),
  session: () => import("../../lib/rutas/session.js"),
  snapshot: () => import("../../lib/rutas/snapshot.js"),
};

// Vercel deja el segmento dinámico en request.query.accion; por las dudas
// también se lee del final de la URL.
export const nombreDeAccion = (request) => {
  const deQuery = request?.query?.accion;
  if (typeof deQuery === "string" && deQuery) return deQuery;

  try {
    const partes = new URL(request?.url || "", "http://localhost").pathname.split("/").filter(Boolean);
    return partes[partes.length - 1] || "";
  } catch {
    return "";
  }
};

export default async function handler(request, response) {
  const accion = nombreDeAccion(request);
  const cargar = Object.prototype.hasOwnProperty.call(RUTAS, accion) ? RUTAS[accion] : null;

  if (!cargar) {
    response.setHeader("Cache-Control", "private, no-store");
    return response.status(404).json({ ok: false, error: "Ruta inexistente." });
  }

  const modulo = await cargar();
  return modulo.default(request, response);
}
