import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearCookieSesionOpenField } from "./openfieldAuth.js";

// Supabase de mentira para /api/openfield/session: el usuario del token y lo
// que contesta mi_cuenta() sobre él.
const supabaseFalso = vi.hoisted(() => ({ cuenta: null }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "id-persona", email: "persona@prueba.com" } }, error: null }),
    },
    rpc: (funcion) => ({
      maybeSingle: async () =>
        funcion === "mi_cuenta"
          ? { data: supabaseFalso.cuenta, error: null }
          : { data: null, error: { code: "PGRST202", message: `no existe ${funcion}` } },
    }),
  })),
}));

// Las rutas de Ajustes › Pruebas técnicas: el técnico (rol 'admin' de la
// cookie: el dueño principal con Flujo diario en el club del token de
// Catapult) las corre siempre; el resto de las cuentas, solo con
// OPENFIELD_DIAGNOSTICO prendida. La escritura de prueba, solo el técnico.
// Se prueba la puerta: a quien no puede, se le contesta 403 antes de tocar
// Catapult.
const { default: sesion } = await import("../api/openfield/session.js");
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
  const cookie = crearCookieSesionOpenField({ id: `id-${rol}`, email: `${rol}@prueba.com`, rol });
  return { method, headers: { cookie: cookie.split(";")[0] }, query: {}, body: {} };
};

const llamar = async (handler, request) => {
  const respuesta = { status: null, cuerpo: null, cabeceras: {} };
  const response = {
    setHeader: (nombre, valor) => {
      respuesta.cabeceras[nombre] = valor;
    },
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

  it.each(RUTAS)("%s: al técnico lo deja pasar (después pide lo que le falta)", async (_nombre, handler, method) => {
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

  it("cloud-write-test sigue siendo solo del técnico, aunque OPENFIELD_DIAGNOSTICO esté prendida", async () => {
    vi.stubEnv("OPENFIELD_DIAGNOSTICO", "1");
    const respuesta = await llamar(cloudWriteTest, pedido("usuario", "POST"));
    expect(respuesta.status).toBe(403);
    expect(respuesta.cuerpo).toMatchObject({ code: "SOLO_ADMIN" });
  });

  it("cloud-write-test: al técnico lo deja pasar (después pide la confirmación)", async () => {
    const respuesta = await llamar(cloudWriteTest, pedido("admin", "POST"));
    expect(respuesta.status).toBe(400);
    expect(respuesta.cuerpo).toMatchObject({ code: "CONFIRMACION_INVALIDA" });
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

// De punta a punta: la cookie que entrega /api/openfield/session sale de
// mi_cuenta(), y es la que abre (o no) las pruebas técnicas y la escritura.
describe("la cookie de /api/openfield/session decide quién corre las pruebas", () => {
  const abrirSesion = async (cuenta) => {
    supabaseFalso.cuenta = cuenta;
    return llamar(sesion, { method: "POST", headers: { authorization: "Bearer token-de-prueba" }, query: {}, body: {} });
  };
  const conCookie = (setCookie, method) => ({ method, headers: { cookie: setCookie.split(";")[0] }, query: {}, body: {} });

  beforeEach(() => {
    vi.stubEnv("OPENFIELD_SESSION_SECRET", SECRETO);
    vi.stubEnv("OPENFIELD_DIAGNOSTICO", "");
    vi.stubEnv("CATAPULT_SESSION_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("no debería salir a la red");
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("el técnico (dueño principal con Flujo diario en el club del token) sale con rol admin y corre todo", async () => {
    const respuesta = await abrirSesion({ estado: "autorizado", dueno: "principal", flujo: true, catapult: true, tecnico: true });
    expect(respuesta.status).toBe(200);
    expect(respuesta.cuerpo).toMatchObject({ ok: true, email: "persona@prueba.com", rol: "admin" });
    const cookie = respuesta.cabeceras["Set-Cookie"];
    expect((await llamar(capabilityProbe, conCookie(cookie, "GET"))).status).not.toBe(403);
    expect((await llamar(cloudWriteTest, conCookie(cookie, "POST"))).cuerpo).toMatchObject({ code: "CONFIRMACION_INVALIDA" });
  });

  it("un sub-dueño que es staff con Flujo diario en el club del token entra a Flujo diario, pero no a las pruebas ni a la escritura", async () => {
    const respuesta = await abrirSesion({ estado: "autorizado", dueno: "sub", flujo: true, catapult: true, tecnico: false });
    expect(respuesta.status).toBe(200);
    expect(respuesta.cuerpo).toMatchObject({ ok: true, rol: "usuario" });
    const cookie = respuesta.cabeceras["Set-Cookie"];
    for (const [handler, method] of [
      [capabilityProbe, "GET"],
      [cloudEditorInspect, "POST"],
      [cloudLoginTest, "POST"],
      [cloudTokenProbe, "POST"],
      [cloudWriteTest, "POST"],
    ]) {
      const prueba = await llamar(handler, conCookie(cookie, method));
      expect(prueba.status).toBe(403);
      expect(prueba.cuerpo).toMatchObject({ code: "SOLO_ADMIN" });
    }
  });

  it("el dueño principal con Flujo diario solo en otro club no recibe cookie: 403 SIN_CATAPULT", async () => {
    const respuesta = await abrirSesion({ estado: "autorizado", dueno: "principal", flujo: true, catapult: false, tecnico: false });
    expect(respuesta.status).toBe(403);
    expect(respuesta.cuerpo).toEqual({
      ok: false,
      code: "SIN_CATAPULT",
      error: "Tu club todavía no conectó Catapult en la app.",
    });
    expect(respuesta.cabeceras["Set-Cookie"]).toBeUndefined();
  });
});
