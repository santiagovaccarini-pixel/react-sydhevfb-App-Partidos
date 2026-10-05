import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DICCIONARIOS,
  claves,
  cambiarIdioma,
  fijarIdiomaParaPruebas,
  normalizarIdioma,
  plural,
  t,
} from "./index.js";
import { fechaCorta, hoyISO } from "./formatos.js";

afterEach(() => {
  fijarIdiomaParaPruebas("es-AR");
  localStorage.clear();
});

describe("los diccionarios", () => {
  const es = claves(DICCIONARIOS["es-AR"]);
  const pt = claves(DICCIONARIOS["pt-BR"]);

  it("tienen exactamente las mismas claves en los dos idiomas", () => {
    expect(pt.filter((clave) => !es.includes(clave))).toEqual([]);
    expect(es.filter((clave) => !pt.includes(clave))).toEqual([]);
  });

  it("no tienen textos vacíos y conservan los mismos huecos {{x}}", () => {
    const huecos = (texto) => (String(texto).match(/\{\{\w+\}\}/g) || []).sort();
    for (const clave of es) {
      const enEs = t(clave);
      fijarIdiomaParaPruebas("pt-BR");
      const enPt = t(clave);
      fijarIdiomaParaPruebas("es-AR");
      expect(enEs.trim(), clave).not.toBe("");
      expect(enPt.trim(), clave).not.toBe("");
      expect(huecos(enPt), clave).toEqual(huecos(enEs));
    }
  });
});

describe("t y plural", () => {
  it("devuelve el texto del idioma activo y rellena variables", () => {
    expect(t("acceso.entrar")).toBe("Entrar");
    expect(t("cuentas.creadaEl", { fecha: "01/10/2026" })).toBe("Creada el 01/10/2026");
    cambiarIdioma("pt-BR");
    expect(t("acceso.entrarTitulo")).toBe("Entre com sua conta");
    expect(localStorage.getItem("idioma")).toBe("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("si falta la clave devuelve lo pedido por defecto o la clave misma, nunca rompe", () => {
    expect(t("no.existe", {}, "Texto")).toBe("Texto");
    expect(t("no.existe")).toBe("no.existe");
  });

  it("pluraliza según el idioma", () => {
    expect(plural("lesiones.dias", 1)).toBe("1 día");
    expect(plural("lesiones.dias", 12)).toBe("12 días");
    fijarIdiomaParaPruebas("pt-BR");
    expect(plural("lesiones.dias", 1)).toBe("1 dia");
    expect(plural("lesiones.dias", 3)).toBe("3 dias");
  });

  it("el cero va en plural en los dos idiomas (en portugués Intl lo da como singular)", () => {
    expect(plural("lesiones.activas", 0)).toBe("0 lesiones activas");
    fijarIdiomaParaPruebas("pt-BR");
    expect(plural("lesiones.activas", 0)).toBe("0 lesões ativas");
    expect(plural("lesiones.activas", 1)).toBe("1 lesão ativa");
    expect(plural("lesiones.dias", 0)).toBe("0 dias");
  });

  it("el idioma de la página (<html lang>) queda puesto desde que abre la app", async () => {
    document.documentElement.lang = "es";
    localStorage.setItem("idioma", "pt-BR");
    vi.resetModules();
    await import("./index.js");
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("entiende el idioma del navegador", () => {
    expect(normalizarIdioma("pt-BR")).toBe("pt-BR");
    expect(normalizarIdioma("pt")).toBe("pt-BR");
    expect(normalizarIdioma("es-419")).toBe("es-AR");
    expect(normalizarIdioma("en-US")).toBeNull();
  });
});

describe("formatos", () => {
  it("formatea una fecha ISO sin restar un día", () => {
    expect(fechaCorta("2026-10-01")).toBe("01/10/2026");
    fijarIdiomaParaPruebas("pt-BR");
    expect(fechaCorta("2026-10-01")).toBe("01/10/2026");
    expect(fechaCorta("")).toBe("");
    expect(hoyISO(new Date(2026, 9, 1, 23, 30))).toBe("2026-10-01");
  });
});
