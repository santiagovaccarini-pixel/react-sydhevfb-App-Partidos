import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.js", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

const { mensajeDeRespuesta } = await import("./trainingApi.js");

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
