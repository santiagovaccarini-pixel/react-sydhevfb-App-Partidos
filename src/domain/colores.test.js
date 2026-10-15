import { describe, expect, test } from "vitest";
import { COLORES_SUAVES, suave } from "./colores.js";

describe("los colores suaves (Santiago, 15/10)", () => {
  test("cada color fuerte de los archivos pasa a su versión suave, en mayúsculas o minúsculas", () => {
    expect(suave("#FF0000")).toBe(COLORES_SUAVES.rojo);
    expect(suave("#ff7f7f")).toBe(COLORES_SUAVES.rojo);
    expect(suave("#FFFF00")).toBe(COLORES_SUAVES.amarillo);
    expect(suave("#FFFF7F")).toBe(COLORES_SUAVES.amarillo);
    expect(suave("#92D050")).toBe(COLORES_SUAVES.verde);
    expect(suave("#4f6228")).toBe(COLORES_SUAVES.verdeOscuro);
    expect(suave("#7FAD94")).toBe(COLORES_SUAVES.verdeOscuro);
    expect(suave("#F79646")).toBe(COLORES_SUAVES.naranja);
    expect(suave("#FBCAA2")).toBe(COLORES_SUAVES.naranjaClaro);
  });
  test("lo que no es de los archivos queda igual (el gris de las clases, el negro)", () => {
    expect(suave("#D9D9D9")).toBe("#D9D9D9");
    expect(suave("#000000")).toBe("#000000");
    expect(suave(undefined)).toBeUndefined();
  });
});
