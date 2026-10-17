import { describe, expect, test } from "vitest";
import { COLORES_FUERTES, COLORES_SUAVES, fuerte, rellenoDe, suave } from "./colores.js";

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

describe("el relleno de las celdas: un degradé de blanco a su color fuerte (Santiago, 17/10)", () => {
  test("cada color de franja: blanco hasta el 30 % y su tono fuerte desde el 70 %", () => {
    expect(rellenoDe(COLORES_SUAVES.verde)).toBe(`linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 30%, ${COLORES_FUERTES.verde} 70%, ${COLORES_FUERTES.verde} 100%)`);
    expect(rellenoDe(COLORES_SUAVES.rojo.toLowerCase())).toContain(COLORES_FUERTES.rojo);
    expect(fuerte(COLORES_SUAVES.amarillo)).toBe(COLORES_FUERTES.amarillo);
  });
  test("otro color (el gris de las clases, el de la fila del equipo) queda liso", () => {
    expect(rellenoDe(COLORES_SUAVES.gris)).toBe(COLORES_SUAVES.gris);
    expect(rellenoDe("#D9D9D9")).toBe("#D9D9D9");
    expect(rellenoDe(null)).toBeNull();
    expect(fuerte("#000000")).toBe("#000000");
  });
});
