import { describe, expect, it } from "vitest";
import {
  ERROR,
  absoluto,
  comparar,
  contarNumeros,
  desvioMuestral,
  dividir,
  entre,
  esBlanco,
  esError,
  esVacio,
  igual,
  mayor,
  mayorIgual,
  maximo,
  menor,
  minimo,
  promedio,
  redondearComoExcel,
  restar,
  seCumple,
  siError,
  subtotal,
  sumar,
  textoDeTiempo,
  textoDeValor,
  tiempoParaExcel,
} from "./excel.js";

describe("cómo calcula Excel", () => {
  it("vacía, texto vacío y error son cosas distintas", () => {
    expect(esBlanco(null)).toBe(true);
    expect(esBlanco("")).toBe(false);
    expect(esVacio("")).toBe(true);
    expect(esError(ERROR.div0)).toBe(true);
    expect(siError(ERROR.div0, "")).toBe("");
    expect(siError(3, "")).toBe(3);
  });

  it("las cuentas: la vacía es 0, un texto da #VALUE! y dividir por 0, #DIV/0!", () => {
    expect(sumar(null, 2)).toBe(2);
    expect(restar(null, null)).toBe(0);
    expect(sumar("", 2)).toBe(ERROR.valor);
    expect(dividir(4, null)).toBe(ERROR.div0);
    expect(dividir(ERROR.valor, 0)).toBe(ERROR.valor);
    expect(absoluto(-2.5)).toBe(2.5);
    expect(absoluto("")).toBe(ERROR.valor);
  });

  it("compara como Excel: a 15 cifras, cualquier texto mayor que cualquier número, sin mayúsculas", () => {
    expect(igual(0.1 + 0.2, 0.3)).toBe(true);
    expect(mayor("", 1e9)).toBe(true);
    expect(menor(5, "a")).toBe(true);
    expect(igual("Mayor", "MAYOR")).toBe(true);
    // La vacía vale 0 contra un número y "" contra un texto.
    expect(igual(null, 0)).toBe(true);
    expect(igual(null, "")).toBe(true);
    expect(mayorIgual(null, -1)).toBe(true);
    expect(comparar(ERROR.div0, 1)).toBe(ERROR.div0);
    expect(mayorIgual(1, ERROR.div0)).toBe(ERROR.div0);
  });

  it("entre incluye los bordes y no importa el orden", () => {
    expect(entre(5, 5, 9)).toBe(true);
    expect(entre(5, 9, 5)).toBe(true);
    expect(entre(4.99, 9, 5)).toBe(false);
    expect(entre(5, ERROR.div0, 9)).toBe(ERROR.div0);
  });

  it("una regla se cumple solo con VERDADERO (o un número distinto de 0)", () => {
    expect(seCumple(true)).toBe(true);
    expect(seCumple(2)).toBe(true);
    expect(seCumple(false)).toBe(false);
    expect(seCumple("x")).toBe(false);
    expect(seCumple(ERROR.div0)).toBe(false);
  });

  it("PROMEDIO y SUBTOTAL toman solo los números; un error en el rango es el resultado", () => {
    expect(promedio([4, "", false, null, 2])).toBe(3);
    expect(promedio(["", null])).toBe(ERROR.div0);
    expect(promedio([1, ERROR.div0])).toBe(ERROR.div0);
    expect(contarNumeros([1, "", ERROR.div0, 3])).toBe(2);
    expect(maximo([])).toBe(0);
    expect(minimo(["", null])).toBe(0);
    expect(maximo([3, 7, ""])).toBe(7);
    expect(subtotal(2, [1, 2, ""])).toBe(2);
    expect(subtotal(5, [4, 2, 9])).toBe(2);
    expect(() => subtotal(9, [1])).toThrow();
  });

  it("el desvío muestral con la cuenta de Excel", () => {
    expect(desvioMuestral([1, 2, 3, 4])).toBeCloseTo(Math.sqrt(5 / 3), 15);
    expect(desvioMuestral([7])).toBe(ERROR.div0);
    expect(desvioMuestral([2, 2, 2])).toBe(0);
  });

  it("redondea como muestra Excel: a 15 cifras y la mitad lejos del cero", () => {
    expect(redondearComoExcel(1.005, 2)).toBe(1.01);
    expect(redondearComoExcel(-2.5, 0)).toBe(-3);
    expect(redondearComoExcel(-0.0004, 2)).toBe(0);
  });

  it("muestra cada valor con el formato de su celda", () => {
    expect(textoDeValor(0.10234, "0.0%")).toBe("10,2%");
    expect(textoDeValor(1.1021, "0.00%")).toBe("110,21%");
    expect(textoDeValor(0.5, "0%")).toBe("50%");
    expect(textoDeValor(2.75, "0.0")).toBe("2,8");
    expect(textoDeValor(0.8571428, "0.00")).toBe("0,86");
    expect(textoDeValor(3.4, "0")).toBe("3");
    expect(textoDeValor(29, "General")).toBe("29");
    expect(textoDeValor(2.75, "General")).toBe("2,75");
    expect(textoDeValor(1 / 3, "General")).toBe("0,3333333333");
    expect(textoDeValor(ERROR.div0, "0.0")).toBe("");
    expect(textoDeValor("", "0.0")).toBe("");
    expect(textoDeValor(false)).toBe("FALSO");
    expect(textoDeValor(true, "General", "pt-BR")).toBe("VERDADEIRO");
    expect(textoDeValor("texto")).toBe("texto");
  });

  it("los tiempos: segundos de verdad, contados en la unidad del Excel y vistos como minutos y segundos", () => {
    expect(tiempoParaExcel(184)).toBe(184 / 1440);
    expect(tiempoParaExcel(null)).toBe(null);
    expect(textoDeTiempo(184 / 1440)).toBe("3:04");
    // Lo que sobra del segundo no se redondea para arriba (como el h:mm del Excel).
    expect(textoDeTiempo(284.7 / 1440)).toBe("4:44");
    expect(textoDeTiempo(59.6 / 1440)).toBe("0:59");
    expect(textoDeTiempo(1530 / 1440)).toBe("25:30");
    expect(textoDeValor(184 / 1440, "tiempo")).toBe("3:04");
  });
});
