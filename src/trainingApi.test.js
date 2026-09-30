import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sesion = vi.hoisted(() => ({ token: "" }));

vi.mock("./supabase.js", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: sesion.token ? { access_token: sesion.token } : null } }) } },
}));

const { mensajeDeRespuesta, pedirJson } = await import("./trainingApi.js");

const respuesta = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });

describe("pedirJson renueva la sesión de OpenField cuando venció", () => {
  beforeEach(() => {
    sesion.token = "tok";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sesion.token = "";
  });

  it("ante un 401 de sesión pide una cookie nueva y repite el pedido una vez", async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(respuesta(401, { ok: false, code: "SESION_VENCIDA", error: "venció" }))
      .mockResolvedValueOnce(respuesta(200, { ok: true, email: "dt@club.com" }))
      .mockResolvedValueOnce(respuesta(200, { ok: true, activities: [] }));
    vi.stubGlobal("fetch", fetchFalso);

    const { respuesta: final, payload } = await pedirJson("/api/openfield/activities", { method: "POST", body: { a: 1 } });

    expect(final.status).toBe(200);
    expect(payload).toEqual({ ok: true, activities: [] });
    expect(fetchFalso).toHaveBeenCalledTimes(3);
    expect(fetchFalso.mock.calls[1][0]).toBe("/api/openfield/session");
    expect(fetchFalso.mock.calls[1][1]).toMatchObject({ method: "POST", headers: { Authorization: "Bearer tok" } });
    // El segundo intento lleva lo mismo que el primero.
    expect(fetchFalso.mock.calls[2][0]).toBe("/api/openfield/activities");
    expect(fetchFalso.mock.calls[2][1]).toMatchObject({ method: "POST", body: JSON.stringify({ a: 1 }) });
  });

  it("no reintenta si la cookie nueva no se pudo pedir, ni ante otros 401, ni ante 403", async () => {
    const sinPermiso = vi.fn().mockResolvedValue(respuesta(403, { ok: false, code: "PENDIENTE", error: "todavía no" }));
    vi.stubGlobal("fetch", sinPermiso);
    expect((await pedirJson("/api/openfield/cortes")).respuesta.status).toBe(403);
    expect(sinPermiso).toHaveBeenCalledTimes(1);

    const catapult = vi.fn().mockResolvedValue(respuesta(401, { ok: false, code: "CATAPULT_LOGIN_REJECTED", error: "clave mal" }));
    vi.stubGlobal("fetch", catapult);
    expect((await pedirJson("/api/openfield/cuenta")).payload.code).toBe("CATAPULT_LOGIN_REJECTED");
    expect(catapult).toHaveBeenCalledTimes(1);

    const sinRenovar = vi
      .fn()
      .mockResolvedValueOnce(respuesta(401, { ok: false, code: "SIN_SESION", error: "entrá" }))
      .mockResolvedValueOnce(respuesta(403, { ok: false, code: "BLOQUEADO", error: "sin acceso" }));
    vi.stubGlobal("fetch", sinRenovar);
    const { respuesta: final } = await pedirJson("/api/openfield/periods");
    expect(final.status).toBe(401);
    expect(sinRenovar).toHaveBeenCalledTimes(2);
  });

  it("sin sesión de Supabase no intenta renovar", async () => {
    sesion.token = "";
    const fetchFalso = vi.fn().mockResolvedValue(respuesta(401, { ok: false, code: "SIN_SESION", error: "entrá" }));
    vi.stubGlobal("fetch", fetchFalso);
    await pedirJson("/api/openfield/atletas");
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});

describe("mensajeDeRespuesta", () => {
  it("usa el texto del endpoint cuando viene", () => {
    expect(mensajeDeRespuesta({ ok: false, error: "Iniciá sesión." }, "x")).toBe("Iniciá sesión.");
  });

  it("traduce el error de plataforma de Vercel en vez de mostrar [object Object]", () => {
    expect(
      mensajeDeRespuesta({ error: { code: "FUNCTION_INVOCATION_FAILED", message: "A server error has occurred" } }, "x"),
    ).toBe("A server error has occurred (FUNCTION_INVOCATION_FAILED)");
    expect(mensajeDeRespuesta({ error: { code: "NOT_FOUND" } }, "No se pudo")).toBe("No se pudo (NOT_FOUND)");
    expect(mensajeDeRespuesta({ error: { message: "Falló" } }, "x")).toBe("Falló");
  });

  it("cae al texto por defecto sin error, con error vacío o sin respuesta", () => {
    expect(mensajeDeRespuesta({ ok: false }, "Por defecto")).toBe("Por defecto");
    expect(mensajeDeRespuesta({ error: "   " }, "Por defecto")).toBe("Por defecto");
    expect(mensajeDeRespuesta({ error: {} }, "Por defecto")).toBe("Por defecto");
    expect(mensajeDeRespuesta(null, "Por defecto")).toBe("Por defecto");
  });
});
