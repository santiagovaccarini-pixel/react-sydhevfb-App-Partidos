import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Cada archivo .js de api/ es una función de Vercel (salvo los que empiezan
// con "_" o "."). El plan de Vercel admite hasta 12 por publicación: con una
// más, la publicación falla entera y la app se queda en la versión anterior
// (pasó el 09/10 con api/invitar.js).
const TOPE_DE_FUNCIONES = 12;

const funcionesEn = (carpeta) =>
  readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    if (entrada.name.startsWith("_") || entrada.name.startsWith(".")) return [];
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) return funcionesEn(ruta);
    return /\.(js|mjs|cjs|ts)$/.test(entrada.name) ? [ruta] : [];
  });

describe("funciones de Vercel", () => {
  it(`api/ no pasa de ${TOPE_DE_FUNCIONES} funciones`, () => {
    const funciones = funcionesEn(join(import.meta.dirname, "..", "api"));
    expect(funciones.length).toBeGreaterThan(0);
    expect(funciones.length, funciones.join("\\n")).toBeLessThanOrEqual(TOPE_DE_FUNCIONES);
  });
});
