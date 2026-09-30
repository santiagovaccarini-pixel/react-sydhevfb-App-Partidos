import { describe, expect, it, vi } from "vitest";

// El módulo arranca Chromium recién al usarlo; para probar los ayudantes puros
// alcanza con no cargar los binarios.
vi.mock("@sparticuz/chromium", () => ({ default: { args: [], executablePath: async () => "" } }));
vi.mock("playwright-core", () => ({ chromium: { launch: async () => { throw new Error("sin navegador en las pruebas"); } } }));

const { resumirError, textoSecreto, textoSeguro } = await import("./catapultCloud.js");

describe("resumirError", () => {
  it("descarta las líneas del call log que repiten lo escrito en un campo", () => {
    const error = new Error(
      [
        "locator.fill: Timeout 12000ms exceeded.",
        "Call log:",
        '  - waiting for locator("input[name=\'password\']")',
        '  - fill("MiClaveSecreta!")',
        '  - type("MiClaveSecreta!")',
        "  - locator resolved to <input …>",
      ].join("\n"),
    );
    error.name = "TimeoutError";

    const resumen = resumirError(error, { ocultar: ["MiClaveSecreta!", "santi"] });

    expect(resumen.tipo).toBe("TimeoutError");
    expect(resumen.mensaje).not.toContain("MiClaveSecreta!");
    expect(resumen.mensaje).toContain("locator.fill: Timeout 12000ms exceeded.");
    expect(resumen.mensaje).toContain("locator resolved to");
  });

  it("tapa el secreto aunque aparezca en una línea cualquiera", () => {
    const error = new Error("page.goto: net::ERR_FAILED at https://x/?u=santi&p=MiClaveSecreta!");

    const { mensaje } = resumirError(error, { ocultar: ["MiClaveSecreta!", "santi", ""] });

    expect(mensaje).toBe("page.goto: net::ERR_FAILED at https://x/?u=[oculto]&p=[oculto]");
  });

  it("sigue funcionando sin nada que ocultar y sin mensaje", () => {
    expect(resumirError(null)).toEqual({ tipo: "Error", mensaje: "" });
    expect(resumirError(new Error("a\n\nb")).mensaje).toBe("a · b");
  });
});

describe("textoSecreto", () => {
  it("recorta el largo pero conserva los espacios de la contraseña", () => {
    expect(textoSecreto("  clave con espacios ", 512)).toBe("  clave con espacios ");
    expect(textoSecreto("x".repeat(600), 512)).toHaveLength(512);
    expect(textoSecreto(null, 5)).toBe("");
    expect(textoSeguro("  usuario ", 10)).toBe("usuario");
  });
});
