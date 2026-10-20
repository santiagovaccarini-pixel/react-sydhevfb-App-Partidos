import { describe, expect, test } from "vitest";
import { TESTS } from "./tests/index.js";
import { bloqueDeLaPlanilla, calculoDeEvaluaciones, filasDeLaPlanilla, filtrosDeLaCategoria, medidasDeEvaluaciones } from "./planillaVr.js";
import { calcularPlanilla, eleccionDeEntrada } from "../gps/planillaVr.js";
import { AUTOMATICO, MANUAL, MAS_ES_MEJOR, calcularValorReferencial } from "../valorReferencial.js";

// Todo inventado.
const elTest = (id) => TESTS.find((uno) => uno.id === id);
const PRESS = elTest("press_plano");
const fila = (id, celdas, seleccion = "mayor") => ({ id, valores: { seleccion, jugador: id }, textos: { seleccion: seleccion === "mayor" ? "Mayor" : "Reserva" }, celdas });
const FILAS = [
  fila("a", { pc: 80, rm: 100, rel: 1.25, kg: 90, rep: 5 }),
  fila("b", { pc: 70, rm: 95, rel: 95 / 70, kg: 85, rep: 6 }),
  fila("c", { pc: 90, rm: 120, rel: 120 / 90, kg: 110, rep: 4 }),
  fila("d", { pc: 75, rm: 90, rel: 1.2, kg: 80, rep: 7 }),
  fila("e", { pc: 85, rm: 110, rel: 110 / 85, kg: 100, rep: 5 }),
  fila("f", { pc: 0, rm: 100, rel: "", kg: 90, rep: 5 }),
  fila("g", { rm: 105, kg: 95, rep: 6 }),
];

describe("La planilla de V.R. en Evaluaciones", () => {
  test("las variables: las de las tablas de V.R., sin las «DE» de los déficits; con el título de su tabla si hay varias", () => {
    expect(medidasDeEvaluaciones(PRESS).map((metrica) => metrica.clave)).toEqual(["pc", "rep", "rm", "kg", "rel"]);
    const movilidad = medidasDeEvaluaciones(elTest("movilidad_tobillo")).map((metrica) => metrica.clave);
    expect(movilidad).toEqual(["pd", "pi", "deficit"]);
    const curl = medidasDeEvaluaciones(elTest("curl_nordico_isoprone"));
    expect(curl.map((metrica) => metrica.clave)).not.toContain("curl_def_max_de");
    expect(curl.find((metrica) => metrica.clave === "iso_l_max_rel").tituloDeTabla).toBeTruthy();
    expect(medidasDeEvaluaciones(PRESS)[0].tituloDeTabla).toBeNull();
  });

  test("las relativas por peso: la fuerza sobre el P.C. de cada fila; el promedio, la suma de las fuerzas sobre la de los pesos", () => {
    const calculo = calculoDeEvaluaciones(PRESS);
    const rel = medidasDeEvaluaciones(PRESS).find((metrica) => metrica.clave === "rel");
    expect(calculo.esRelativa(rel)).toBe(true);
    expect(calculo.datoDe(rel, FILAS[0])).toEqual({ numerador: 100, denominador: 80 });
    const calculos = calcularPlanilla(FILAS, [rel], { rel: { sentido: MAS_ES_MEJOR, modo: AUTOMATICO } }, calculo);
    // Sin peso (0 o vacío) no entran: se dicen.
    expect(calculos.rel.sinDenominador).toBe(2);
    expect(calculos.rel.resultado.n).toBe(5);
    const esperado = calcularValorReferencial(FILAS.slice(0, 5).map((una) => ({ numerador: una.celdas.rm, denominador: una.celdas.pc })), { relativa: true });
    expect(calculos.rel.resultado.valores).toEqual(esperado.valores);
    expect(calculos.rel.resultado.promedio).toBeCloseTo((100 + 95 + 120 + 90 + 110) / (80 + 70 + 90 + 75 + 85), 10);
    // Las absolutas, su número; sin denominador que contar.
    const rm = medidasDeEvaluaciones(PRESS).find((metrica) => metrica.clave === "rm");
    expect(calculo.esRelativa(rm)).toBe(false);
    expect(calcularPlanilla(FILAS, [rm], {}, calculo).rm).toMatchObject({ sinDenominador: 0 });
    expect(calcularPlanilla(FILAS, [rm], {}, calculo).rm.resultado.n).toBe(7);
  });

  test("cómo se ven: 2 decimales (los porcentajes, como porcentaje); tocando, todos; los tiempos aparte", () => {
    const calculo = calculoDeEvaluaciones(PRESS);
    expect(calculo.textoDelNumero({ formato: "0.00" }, 1.23456, false)).toBe("1,23");
    expect(calculo.textoDelNumero({ formato: "0.00" }, 1.23456, true)).toBe("1,23456");
    expect(calculo.textoDelNumero({ formato: "0.0%" }, 0.123456, false)).toBe("12,35%");
    expect(calculo.textoDelNumero({ formato: "0.0%" }, 0.123456, true)).toBe("12,3456%");
    expect(calculo.esTiempo({ formato: "tiempo" })).toBe(true);
    expect(calculo.esTiempo({ formato: "0.00" })).toBe(false);
  });

  test("el bloque: n (los usados), Desvío, los cinco y, en los déficits, «DE» con los desvíos; sin Promedio; solo las variables usadas", () => {
    const movilidad = elTest("movilidad_tobillo");
    const medidas = medidasDeEvaluaciones(movilidad);
    const filas = [0.1, 0.12, 0.08, 0.15, 0.11, 0.09, 0.13, 0.5].map((deficit, i) => fila(`m${i}`, { pd: 10 + i, pi: 11 + i, deficit }));
    const eleccion = { ...eleccionDeEntrada(medidas), deficit: { sentido: "menos", modo: MANUAL, cortes: { excelente: 1.5, muy_bueno: 1, regular: 0.75, malo: 1.25 } } };
    const calculos = calcularPlanilla(filas, medidas.filter((metrica) => metrica.clave !== "pi"), eleccion, calculoDeEvaluaciones(movilidad));
    const anterior = { titulo: "Mayor (VR)", n: { pi: 40 }, promedio: { pi: 12, deficit: 0.3 }, bueno: { pi: 12, deficit: 0.3 }, excelente: { deficit_de: 9 } };
    const planilla = { version: 1, muestra: { seleccion: ["mayor"] }, medidas: {}, filas: 8, calculado: "2026-10-19" };
    const bloque = bloqueDeLaPlanilla({ test: movilidad, anterior, calculos, planilla });
    const deficit = calculos.deficit.resultado;
    expect(bloque.n.deficit).toBe(deficit.usados);
    // Sin Promedio: es el Bueno.
    expect(bloque.promedio).toBeUndefined();
    expect(deficit.valores.bueno).toBe(deficit.promedio);
    expect(bloque.desvio.deficit).toBe(deficit.desvio);
    expect(bloque.bueno.deficit).toBe(deficit.valores.bueno);
    expect(bloque.malo.deficit).toBe(deficit.valores.malo);
    expect([bloque.excelente.deficit_de, bloque.muy_bueno.deficit_de, bloque.regular.deficit_de, bloque.malo.deficit_de]).toEqual([1.5, 1, 0.75, 1.25]);
    expect(bloque.bueno.deficit_de).toBeUndefined();
    // Solo las variables usadas (Santiago, 20/10): PI no se calculó y no está;
    // el título queda; el de antes no cambia.
    expect(bloque.n.pi).toBeUndefined();
    expect(bloque.bueno.pi).toBeUndefined();
    expect(Object.keys(bloque.bueno)).toEqual(["pd", "deficit"]);
    expect(bloque.excelente.deficit_de).toBe(1.5);
    expect(bloque.titulo).toBe("Mayor (VR)");
    expect(anterior.bueno.pi).toBe(12);
    expect(anterior.bueno.deficit).toBe(0.3);
    expect(bloque.planilla).toEqual(planilla);
    // Un test sin fila de Desvío (Press Plano): igual va, y se ve con su título.
    const press = bloqueDeLaPlanilla({ test: PRESS, anterior: null, calculos: calcularPlanilla(FILAS, medidasDeEvaluaciones(PRESS), {}, calculoDeEvaluaciones(PRESS)), planilla });
    expect(press.promedio).toBeUndefined();
    expect(Object.keys(press.desvio)).toEqual(["pc", "rep", "rm", "kg", "rel"]);
    expect(Object.keys(press.bueno)).toEqual(["pc", "rep", "rm", "kg", "rel"]);
    expect(filasDeLaPlanilla(PRESS).map((fila) => [fila.clave, fila.titulo["es-AR"]])).toEqual([
      ["n", "n"],
      ["desvio", "Desv. Estándar"],
      ["excelente", "Excelente"],
      ["muy_bueno", "Muy Bueno"],
      ["bueno", "Bueno"],
      ["regular", "Regular"],
      ["malo", "Malo"],
    ]);
  });

  test("la muestra arranca con la Selección de la categoría (el texto que muestran las filas)", () => {
    expect(filtrosDeLaCategoria(FILAS, "mayor", "Mayor")).toEqual({ seleccion: ["Mayor"] });
    expect(filtrosDeLaCategoria([...FILAS, fila("r", {}, "reserva")], "reserva", "Reserva")).toEqual({ seleccion: ["Reserva"] });
    // Sin filas de esa categoría, igual con su nombre.
    expect(filtrosDeLaCategoria(FILAS, "sub20", "Sub 20")).toEqual({ seleccion: ["Sub 20"] });
  });
});
