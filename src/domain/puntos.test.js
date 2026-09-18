import { describe, expect, test } from "vitest";
import { puntosDeRegistros } from "./puntos";

const partido = (resultado) => ({ resultado });

describe("puntos obtenidos", () => {
  test("3 por ganado, 1 por empatado, 0 por perdido", () => {
    const cuenta = puntosDeRegistros([
      partido("2-1"),
      partido("3-0"),
      partido("1-1"),
      partido("0-2"),
    ]);

    expect(cuenta).toMatchObject({
      jugados: 4,
      puntos: 7,
      posibles: 12,
      ganados: 2,
      empatados: 1,
      perdidos: 1,
    });
    // 7 de 12 es 58,33: se redondea.
    expect(cuenta.porcentaje).toBe(58);
  });

  test("un partido sin marcador no cuenta ni de un lado ni del otro", () => {
    // Cargar la formación de un partido que todavía no se jugó no puede bajar
    // el porcentaje.
    const cuenta = puntosDeRegistros([partido("2-1"), partido(""), partido()]);

    expect(cuenta).toMatchObject({ jugados: 1, puntos: 3, posibles: 3 });
    expect(cuenta.porcentaje).toBe(100);
  });

  test("sin partidos jugados no hay porcentaje", () => {
    // 0% diría que se jugó y no se sacó nada, que no es lo mismo.
    expect(puntosDeRegistros([]).porcentaje).toBeNull();
    expect(puntosDeRegistros([partido("")]).porcentaje).toBeNull();
    expect(puntosDeRegistros(null).porcentaje).toBeNull();
  });

  test("el partido de penales vale según lo que diga el filtro", () => {
    const copa = [partido("1-1 (4-3)"), partido("2-2 (3-5)")];

    // Apagado: los dos terminaron empatados a los 90, 1 punto cada uno.
    expect(puntosDeRegistros(copa)).toMatchObject({
      puntos: 2,
      posibles: 6,
      ganados: 0,
      empatados: 2,
      perdidos: 0,
    });

    // Prendido: uno ganado y otro perdido.
    expect(puntosDeRegistros(copa, { penalesCuentan: true })).toMatchObject({
      puntos: 3,
      posibles: 6,
      ganados: 1,
      empatados: 0,
      perdidos: 1,
    });
  });
});
