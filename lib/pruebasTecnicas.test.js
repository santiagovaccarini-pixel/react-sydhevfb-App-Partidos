import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearCookieSesionOpenField } from "./openfieldAuth.js";

// Las rutas de Ajustes › Pruebas técnicas: el dueño de la plataforma las
// corre siempre; el resto de las cuentas, solo con OPENFIELD_DIAGNOSTICO
// prendida. La escritura de prueba, solo el dueño. Se prueba la puerta: a
// quien no puede, se le contesta 403 antes de tocar Catapult.
const { default: capabilityProbe } = await import("../api/openfield/capability-probe.js");
const { default: cloudEditorInspect } = await import("../api/openfield/cloud-editor-inspect.js");
const { default: cloudLoginTest } = await import("../api/openfield/cloud-login-test.js");
const { default: cloudTokenProbe } = await import("../api/openfield/cloud-token-probe.js");
const { default: cloudWriteTest } = await import("../api/openfield/cloud-write-test.js");

const SECRETO = "una frase larga y aburrida que nadie va a adivinar 2026";

const RUTAS = [
  ["capability-probe", capabilityProbe, "GET"],
  ["cloud-editor-inspect", cloudEditorInspect, "POST"],
  ["cloud-login-test", cloudLoginTest, "POST"],
  ["cloud-token-probe", cloudTokenProbe, "POST"],
];

const pedido = (rol, method) => {
  const cookie = crearCookieSesionOpenField({ id: `id-${rol}`, email: `${rol}@club.com`, rol });
  return { method, headers: { cookie: cookie.split(";")[0] }, query: {}, body: {} };
};

const llamar = async (handler, request) => {
  const respuesta = { status: null, cuerpo: null };
  const response = {
    setHeader: () => {},
    status: (status) => {
      respuesta.status = status;
      return { json: (cuerpo) => Object.assign(respuesta, { cuerpo }) };
    },
  };
  await handler(request, response);
  return respuesta;
};

describe("pruebas técnicas de OpenField", () => {
  let fetchFalso;

  beforeEach(() => {
    vi.stubEnv("OPENFIELD_SESSION_SECRET", SECRETO);
    vi.stubEnv("OPENFIELD_DIAGNOSTICO", "");
    vi.stubEnv("CATAPULT_SESSION_KEY", "");
    // Nada de esto puede llegar a Catapult: sin datos, cada ruta se frena antes.
    fetchFalso = vi.fn(async () => {
      throw new Error("no debería salir a la red");
    });
    vi.stubGlobal("fetch", fetchFalso);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(RUTAS)("%s: a una cuenta común le contesta 403 SOLO_ADMIN", async (_nombre, handler, method) => {
    const respuesta = await llamar(handler, pedido("usuario", method));
    expect(respuesta.status).toBe(403);
    expect(respuesta.cuerpo).toMatchObject({ ok: false, code: "SOLO_ADMIN" });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it.each(RUTAS)("%s: al dueño lo deja pasar (después pide lo que le falta)", async (_nombre, handler, method) => {
    const respuesta = await llamar(handler, pedido("admin", method));
    expect(respuesta.status).not.toBe(403);
    expect(respuesta.status).not.toBe(401);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it.each(RUTAS)("%s: con OPENFIELD_DIAGNOSTICO prendida, deja pasar a cualquier cuenta", async (_nombre, handler, method) => {
    vi.stubEnv("OPENFIELD_DIAGNOSTICO", "1");
    const respuesta = await llamar(handler, pedido("usuario", method));
    expect(respuesta.status).not.toBe(403);
    expect(respuesta.status).not.toBe(401);
  });

  it.each(RUTAS)("%s: sin sesión, 401", async (_nombre, handler, method) => {
    const respuesta = await llamar(handler, { method, headers: {}, query: {}, body: {} });
    expect(respuesta.status).toBe(401);
  });

  it("cloud-write-test sigue siendo solo del dueño, aunque OPENFIELD_DIAGNOSTICO esté prendida", async () => {
    vi.stubEnv("OPENFIELD_DIAGNOSTICO", "1");
    const respuesta = await llamar(cloudWriteTest, pedido("usuario", "POST"));
    expect(respuesta.status).toBe(403);
    expect(respuesta.cuerpo).toMatchObject({ code: "SOLO_ADMIN" });
  });
});
