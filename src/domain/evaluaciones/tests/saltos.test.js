import { describe, expect, it } from "vitest";
import { calcularFilas, vistaDeFilas } from "../motor.js";
import { COLORES, COLOR_DE_CLASE } from "../formatoCondicional.js";
import { COMO_PERSONA, leerEvaluacionesPegadas, planDeEvaluaciones } from "../importar.js";
import { SALTO_COUNTERMOVEMENT, SALTO_DROP, SALTO_SINGLE_LEG, SALTO_SQUAT, bloqueDeSaltos } from "./saltos.js";
import { TESTS } from "./index.js";

// Todo inventado: valores de referencia y evaluaciones de prueba (nada del
// Excel del club).
const CORTES = ["excelente", "muy_bueno", "bueno", "regular", "malo"];
const conCortes = (metricas) => ({ categorias: { mayor: Object.fromEntries(CORTES.map((cual, i) => [cual, Object.fromEntries(Object.entries(metricas).map(([clave, valores]) => [clave, valores[i]]))])) } });
// Countermovement: más es mejor en las cuatro medidas.
const REF_CMJ = conCortes({ altura: [45, 42, 40, 37, 34], fuerza: [5000, 4800, 4600, 4400, 4200], potencia: [60, 57, 55, 52, 50], rsi: [0.7, 0.65, 0.6, 0.55, 0.5] });
// Single Leg: cada pierna, más es mejor; el déficit, menos es mejor.
const REF_SL = conCortes({
  altura_pd: [25, 23, 21, 19, 17],
  altura_pi: [25, 23, 21, 19, 17],
  altura_deficit: [0.02, 0.05, 0.08, 0.12, 0.2],
  fuerza_pd: [3600, 3400, 3200, 3000, 2800],
  fuerza_pi: [3600, 3400, 3200, 3000, 2800],
  fuerza_deficit: [0.02, 0.05, 0.08, 0.12, 0.2],
});

let orden = 0;
const evaluacion = ({ persona = "Ana Prueba", fecha = "2026-06-12", seleccion = "mayor", ...datos }) => {
  orden += 1;
  return { id: `s${orden}`, orden, fecha, jugador_id: null, persona, datos: { seleccion, ...datos } };
};
const celdasDe = (resultado, id) => resultado.find((uno) => uno.fila.id === id).celdas;

describe("Saltos: cuatro tests, uno por bloque (Santiago, 10/10)", () => {
  it("van al final de la lista, en el orden de la hoja, en «Potencia y velocidad»", () => {
    expect(TESTS.slice(-4).map((test) => test.id)).toEqual(["salto_countermovement", "salto_drop", "salto_squat", "salto_single_leg"]);
    expect(TESTS.slice(-4).every((test) => test.area === "potencia")).toBe(true);
  });

  it("los títulos de las clases, corregidos: Clas. Altura, Clas. N, Pot. Clas y Clas. RSI; Va? solo en Countermovement", () => {
    const titulos = (test) => test.columnas.map((columna) => columna.titulo["es-AR"]);
    expect(titulos(SALTO_COUNTERMOVEMENT)).toEqual([
      "nº Eva", "Fecha", "Selección", "Fecha Nac", "Jugador", "P.C.",
      "Altura", "Clas. Altura", "% mejora", "Pico de Fuerza", "Clas. N", "% mejora",
      "Pico de Potencia", "Pot. Clas", "% mejora", "RSI-modified [m/s]", "Clas. RSI", "% mejora", "Va?", "Nota",
    ]);
    expect(titulos(SALTO_DROP)).not.toContain("Va?");
    expect(titulos(SALTO_SQUAT)).toEqual(titulos(SALTO_DROP));
    // En Single Leg, la clase del Pico de Fuerza PD es «Clas.PD» (decía «Pot. Clas PD»).
    const fuerza = SALTO_SINGLE_LEG.columnas.filter((columna) => columna.grupo === "fuerza").map((columna) => columna.titulo["es-AR"]);
    expect(fuerza.slice(0, 5)).toEqual(["Pico de Fuerza PD", "Clas.PD", "% mejora", "Pico de Fuerza PI", "Clas.PI"]);
    expect(titulos(SALTO_SINGLE_LEG)).toContain("Clas. RSI PD");
    expect(titulos(SALTO_SINGLE_LEG)).not.toContain("Nota");
  });
});

describe("Countermovement, Drop y Squat: cada fila, como el Excel", () => {
  it("cada medida con su clase contra los V.R. de la categoría de la fila; Va? como en Zona Media", () => {
    const una = evaluacion({ pc: 80, altura: 41, fuerza: 4800, potencia: 49, rsi: 0.62 });
    const c = celdasDe(calcularFilas(SALTO_COUNTERMOVEMENT, [una], REF_CMJ), una.id);
    expect(c.numero).toBe(1);
    expect(c.altura_clas).toBe(3);
    // Justo en el corte de Muy Bueno: 4.
    expect(c.fuerza_clas).toBe(4);
    expect(c.potencia_clas).toBe(1);
    expect(c.rsi_clas).toBe(3);
    expect(c.altura_mejora).toBe("");
    expect(c.va).toBe(1);
  });

  it("% mejora contra la evaluación anterior por fecha que tenga el dato", () => {
    const tercera = evaluacion({ fecha: "2026-03-01", altura: 44 });
    const segunda = evaluacion({ fecha: "2026-02-01", rsi: 0.6 });
    const primera = evaluacion({ fecha: "2026-01-01", altura: 40, rsi: 0.5 });
    const resultado = calcularFilas(SALTO_COUNTERMOVEMENT, [tercera, segunda, primera], REF_CMJ);
    expect(celdasDe(resultado, segunda.id).rsi_mejora).toBeCloseTo(0.2, 12);
    // La segunda no tiene Altura: la tercera compara con la primera.
    expect(celdasDe(resultado, tercera.id).altura_mejora).toBeCloseTo(0.1, 12);
    expect(celdasDe(resultado, tercera.id).numero).toBe(3);
  });

  it("Drop y Squat sin V.R. (vacíos por ahora): sin clases y sin comparación", () => {
    const una = evaluacion({ altura: 41, fuerza: 2000, potencia: 120, rsi: 0.9 });
    for (const test of [SALTO_DROP, SALTO_SQUAT]) {
      const calc = calcularFilas(test, [una], null);
      const c = celdasDe(calc, una.id);
      expect([c.altura_clas, c.fuerza_clas, c.potencia_clas, c.rsi_clas]).toEqual(["", "", "", ""]);
      expect(c.va).toBeUndefined();
      const vista = vistaDeFilas(test, calc.map((uno) => ({ id: uno.fila.id, celdas: uno.celdas })), null, "mayor");
      expect(vista.informe.find((fila) => fila.id === "comparacion").celdas.altura.valor).toBe("");
    }
  });
});

describe("Countermovement: el informe y los colores", () => {
  const filas = [
    evaluacion({ persona: "Uno", pc: 80, altura: 38, fuerza: 4500, potencia: 54, rsi: 0.55 }),
    evaluacion({ persona: "Dos", pc: 75, altura: 42, fuerza: 4700, potencia: 58, rsi: 0.65 }),
    evaluacion({ persona: "Tres", pc: 90, altura: 40, fuerza: 4600, potencia: 56, rsi: 0.6 }),
  ];
  const calc = calcularFilas(SALTO_COUNTERMOVEMENT, filas, REF_CMJ);
  const vista = vistaDeFilas(SALTO_COUNTERMOVEMENT, calc.map((c) => ({ id: c.fila.id, celdas: c.celdas })), REF_CMJ, "mayor");
  const filaDe = (id) => vista.informe.find((una) => una.id === id).celdas;

  it("la comparación «Vs …» de las cuatro medidas con su clase y las filas del Excel, con sus formatos", () => {
    expect(vista.informe.map((una) => una.id)).toEqual(["comparacion", "referencia", "promedios", "desvios", "n", "maximo", "minimo"]);
    // Promedio de la Altura 40 sobre el Bueno 40: 100 %, Clas. 3.
    expect(filaDe("comparacion").altura).toEqual({ valor: 1, formato: "0.0%" });
    expect(filaDe("comparacion").altura_clas.valor).toBe(3);
    expect(Object.keys(filaDe("comparacion"))).toEqual(["altura", "altura_clas", "fuerza", "fuerza_clas", "potencia", "potencia_clas", "rsi", "rsi_clas"]);
    expect(filaDe("referencia").rsi).toEqual({ valor: 0.6, formato: "0.00" });
    expect(filaDe("promedios").pc).toEqual({ valor: 245 / 3, formato: "0" });
    expect(filaDe("promedios").rsi.formato).toBe("0.0");
    expect(filaDe("desvios").altura).toEqual({ valor: 2, formato: "0.0" });
    expect(filaDe("n").numero).toEqual({ valor: 3, formato: "General" });
    expect(filaDe("maximo").altura).toEqual({ valor: 42, formato: "0" });
    // Sin ningún % mejora: vacío (el Excel mostraba #DIV/0! y 0).
    expect(filaDe("promedios").altura_mejora.valor).toBe("");
    expect(filaDe("minimo").altura_mejora).toEqual({ valor: "", formato: "0%" });
  });

  it("los colores: cada medida contra el grupo, las clases sobre gris; P.C. y Va? sin color", () => {
    const [uno, dos] = filas.map((una) => vista.estilos[una.id]);
    // 38 está por debajo del promedio (40) y a un desvío (2): naranja; 42, a un desvío arriba: verde.
    expect(uno.altura.background).toContain(COLORES.naranja);
    expect(dos.altura.background).toContain(COLORES.verde);
    expect(uno.altura_clas).toEqual({ background: COLORES.gris, color: COLOR_DE_CLASE[2], fontWeight: 700 });
    expect(uno.pc).toBeUndefined();
    expect(uno.va).toBeUndefined();
    // Vacío: sin color.
    expect(uno.altura_mejora).toBeUndefined();
  });
});

describe("Single Leg: cada pierna, el déficit y qué pierna rinde menos", () => {
  it("las clases de cada pierna, el DEFICIT LATERAL con su clase (menos es mejor) y DEFICIT PIERNA", () => {
    // Altura PD 20, PI 22: rinde menos la PD; déficit |22 − 20| / 20 = 10 %.
    const una = evaluacion({ altura_pd: 20, altura_pi: 22, fuerza_pd: 3400, fuerza_pi: 3300 });
    const c = celdasDe(calcularFilas(SALTO_SINGLE_LEG, [una], REF_SL), una.id);
    expect(c.altura_pd_clas).toBe(2);
    expect(c.altura_pi_clas).toBe(3);
    expect(c.altura_deficit).toBeCloseTo(0.1, 12);
    expect(c.altura_deficit_clas).toBe(2);
    expect(c.altura_pierna).toBe("PD");
    expect(c.fuerza_pd_clas).toBe(4);
    expect(c.fuerza_pierna).toBe("PI");
    // Sin V.R. de una medida (el Pico de Potencia de prueba no tiene): sin clase.
    expect(c.potencia_pd_clas).toBe("");
  });

  it("sin una pierna, ni déficit ni pierna; con las dos iguales, «Sin Deficit»", () => {
    const sinPi = evaluacion({ rsi_pd: 0.3 });
    const iguales = evaluacion({ rsi_pd: 0.3, rsi_pi: 0.3 });
    const resultado = calcularFilas(SALTO_SINGLE_LEG, [sinPi, iguales], REF_SL);
    expect(celdasDe(resultado, sinPi.id).rsi_deficit).toBe("");
    expect(celdasDe(resultado, sinPi.id).rsi_pierna).toBe("");
    expect(celdasDe(resultado, iguales.id).rsi_pierna).toBe("Sin Deficit");
    expect(celdasDe(resultado, iguales.id).rsi_deficit).toBe(0);
  });

  it("las clases se pintan como toda clase; el déficit no; la pierna con su letra", () => {
    const filas = [evaluacion({ persona: "Uno", altura_pd: 20, altura_pi: 22 }), evaluacion({ persona: "Dos", altura_pd: 24, altura_pi: 21 })];
    const calc = calcularFilas(SALTO_SINGLE_LEG, filas, REF_SL);
    const { estilos, informe } = vistaDeFilas(SALTO_SINGLE_LEG, calc.map((c) => ({ id: c.fila.id, celdas: c.celdas })), REF_SL, "mayor");
    const uno = estilos[filas[0].id];
    expect(uno.altura_pd_clas).toEqual({ background: COLORES.gris, color: COLOR_DE_CLASE[2], fontWeight: 700 });
    expect(uno.altura_deficit).toBeUndefined();
    expect(uno.altura_pierna).toEqual({ background: COLORES.gris, color: "#0D0D0D", fontWeight: 700 });
    // La comparación «Vs …» también en Single Leg (en el Excel no estaba).
    const comparacion = informe.find((fila) => fila.id === "comparacion").celdas;
    expect(comparacion.altura_pd).toEqual({ valor: 22 / 21, formato: "0.0%" });
    expect(comparacion.altura_deficit.formato).toBe("0.0%");
  });
});

describe("Saltos: pegar desde Excel", () => {
  // La fila de títulos de la hoja (la 12), con las columnas ocultas (A, B, C,
  // G y H) que Excel no copia; los nombres, inventados.
  const CMJ = ["Altura", '"Clas.\nRM"', "% mejora", "Pico de Fuerza", '"Clas.\nN"', "% mejora", "Pico de Potencia", "Pot. Clas", "% mejora", "RSI-modified [m/s]", "P. Rel. Clas", "% mejora"];
  const TITULOS = [
    "nº Eva", "Fecha", "Selección", "Apellido", "P.C.",
    ...CMJ, "Va?", "Nota", "",
    ...CMJ, "", "Nota", "",
    ...CMJ, "", "Nota", "",
    "Altura PD", "Clas.PD", "% mejora", "Altura PI", "Clas.PI", "% mejora", "DEFICIT LATERAL ", "Clas. Deficit", "DEFICIT PIERNA",
    "Pico de Fuerza PD", "Pot. Clas PD", "% mejora", "Pico de Fuerza PI", "Clas.PI", "% mejora", "DEFICIT LATERAL ", "Clas. Deficit", "DEFICIT PIERNA",
    "Pico de Potencia PD", "Pot. Clas PD", "% mejora", "Pico de Potencia PI", "Pot. Clas PI", "% mejora", "DEFICIT LATERAL ", "Clas. Deficit", "DEFICIT PIERNA",
    "RSI-modified PD [m/s] ", "P. Rel. Clas PD", "% mejora", "RSI-modified PI [m/s] ", "P. Rel. Clas PI", "% mejora", "DEFICIT LATERAL ", "Clas. Deficit", "DEFICIT PIERNA",
  ];
  const bloque = (altura, fuerza, potencia, rsi) => [altura, "", "", fuerza, "", "", potencia, "", "", rsi, "", ""];
  const lado = (pd, pi) => [pd, "", "", pi, "", "", "", "", ""];
  const ALFA = ["1", "11/1/2024", "Mayor", "ALFA", "78,250000000000000", ...bloque("39,7", "4871", "57,2", "0,63"), "1", "", "", ...bloque("", "", "", ""), "", "", "", ...bloque("", "", "", ""), "", "", "", ...lado("20,9", "21,3"), ...lado("3181", "3205"), ...lado("36,666666666666700", "37,5"), ...lado("0,26", "0,27")];
  const BETA = ["1", "22/7/2026", "Mayor", "BETA", "81,7", ...bloque("", "", "", ""), "", "", "", ...bloque("43", "1910", "111,1", "0,89"), "", "", "", ...bloque("46,8", "6237", "75,9", "0,9"), "", "", "", ...lado("", ""), ...lado("", ""), ...lado("", ""), ...lado("", "")];
  const texto = [TITULOS, ALFA, BETA].map((una) => una.join("\t")).join("\n");
  const plan = (test) => {
    const leidas = leerEvaluacionesPegadas(texto, test);
    expect(leidas.error).toBe("");
    return planDeEvaluaciones(leidas.filas, { test, hoy: "2026-10-10", elegidos: Object.fromEntries(leidas.filas.map((una) => [una.indice, COMO_PERSONA])) }).map((una) => una.evaluacion);
  };

  it("cada test lee lo de su bloque, con la Fecha, la Selección y el P.C. de la fila, y solo sus filas", () => {
    expect(plan(SALTO_COUNTERMOVEMENT)).toEqual([{ jugador_id: null, persona: "ALFA", fecha: "2024-01-11", datos: { seleccion: "mayor", pc: 78.25, altura: 39.7, fuerza: 4871, potencia: 57.2, rsi: 0.63 } }]);
    expect(plan(SALTO_DROP)).toEqual([{ jugador_id: null, persona: "BETA", fecha: "2026-07-22", datos: { seleccion: "mayor", pc: 81.7, altura: 43, fuerza: 1910, potencia: 111.1, rsi: 0.89 } }]);
    expect(plan(SALTO_SQUAT)[0].datos).toEqual({ seleccion: "mayor", pc: 81.7, altura: 46.8, fuerza: 6237, potencia: 75.9, rsi: 0.9 });
    expect(plan(SALTO_SINGLE_LEG)).toEqual([
      {
        jugador_id: null,
        persona: "ALFA",
        fecha: "2024-01-11",
        datos: { seleccion: "mayor", pc: 78.25, altura_pd: 20.9, altura_pi: 21.3, fuerza_pd: 3181, fuerza_pi: 3205, potencia_pd: 36.6666666666667, potencia_pi: 37.5, rsi_pd: 0.26, rsi_pi: 0.27 },
      },
    ]);
  });

  it("los bloques por su lugar: con Drop oculto (Excel no lo copia), Squat no se lee como Drop", () => {
    const titulos = (lista) => lista.map((titulo) => titulo.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
    const completa = titulos(TITULOS);
    expect(bloqueDeSaltos("drop")(completa)).toEqual({ desde: 20, hasta: 35 });
    const sinDrop = completa.slice(0, 20).concat(completa.slice(35));
    expect(bloqueDeSaltos("countermovement")(sinDrop)).not.toBeNull();
    expect(bloqueDeSaltos("drop")(sinDrop)).toBeNull();
    expect(bloqueDeSaltos("squat")(sinDrop)).toBeNull();
    // Copiado hasta el fin de Drop: es Drop.
    expect(bloqueDeSaltos("drop")(completa.slice(0, 34))).toEqual({ desde: 20, hasta: 34 });
    expect(bloqueDeSaltos("squat")(completa.slice(0, 34))).toBeNull();
    const conDropOculto = [TITULOS.filter((_, i) => i < 20 || i >= 35), ALFA.filter((_, i) => i < 20 || i >= 35)].map((una) => una.join("\t")).join("\n");
    expect(leerEvaluacionesPegadas(conDropOculto, SALTO_DROP).error).toBe("evaluaciones.importar.sinMedidas");
  });
});
