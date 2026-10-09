import { describe, expect, it } from "vitest";
import { calcularFilas, vistaDeFilas } from "../motor.js";
import { COLORES } from "../formatoCondicional.js";
import { leerEvaluacionesPegadas, planDeEvaluaciones, ordenDeCarga, COMO_PERSONA, ESTADOS } from "../importar.js";
import { MOVILIDAD_CADERA, MOVILIDAD_ISQUIO, MOVILIDAD_TOBILLO } from "./movilidad.js";

// Todo inventado: valores de referencia y evaluaciones de prueba (nada del
// Excel del club).
const cortes = (excelente, muyBueno, bueno, regular, malo) => ({ excelente, muy_bueno: muyBueno, bueno, regular, malo });
const VR = (medida, deficit) => {
  const fila = (cual) => ({ pd: medida[cual], pi: medida[cual], deficit: deficit[cual] });
  return { excelente: fila("excelente"), muy_bueno: fila("muy_bueno"), bueno: fila("bueno"), regular: fila("regular"), malo: fila("malo") };
};
// Tobillo: más es mejor (45 / 42 / 38 / 33 / 31); déficit, menos es mejor (2 % / 5 % / 8 % / 12 % / 20 %).
const REF_TOBILLO = { categorias: { mayor: VR(cortes(45, 42, 38, 33, 31), cortes(0.02, 0.05, 0.08, 0.12, 0.2)) } };
// Isquio: menos es mejor (11 / 13 / 17 / 22 / 26).
const REF_ISQUIO = { categorias: { mayor: VR(cortes(11, 13, 17, 22, 26), cortes(0.02, 0.05, 0.08, 0.12, 0.2)) } };

let orden = 0;
const evaluacion = ({ persona = "Ana Prueba", fecha = "2026-06-12", seleccion = "mayor", ...datos }) => {
  orden += 1;
  return { id: `m${orden}`, orden, fecha, jugador_id: null, persona, datos: { seleccion, ...datos } };
};
const celdasDe = (resultado, id) => resultado.find((uno) => uno.fila.id === id).celdas;

describe("Movilidad (Tobillo, Cadera, Isquio): cada fila, como el Excel", () => {
  it("las clases, el déficit con su clase y qué pierna rinde menos (más es mejor)", () => {
    // PD 40, PI 44: PD rinde menos; déficit |44 − 40| / 40 = 10 %.
    const fila = evaluacion({ pd: 40, pi: 44 });
    const c = celdasDe(calcularFilas(MOVILIDAD_TOBILLO, [fila], REF_TOBILLO), fila.id);
    expect(c.numero).toBe(1);
    expect(c.pd_clas).toBe(3);
    // Justo en el corte de Muy Bueno: 4.
    expect(c.pi_clas).toBe(4);
    expect(c.deficit).toBeCloseTo(0.1, 12);
    expect(c.deficit_clas).toBe(2);
    expect(c.pierna).toBe("PD");
    expect(c.pd_mejora).toBe("");
  });

  it("en Isquio, menos es mejor: las clases con <= y la pierna con el valor más grande", () => {
    const fila = evaluacion({ pd: 20, pi: 13 });
    const c = celdasDe(calcularFilas(MOVILIDAD_ISQUIO, [fila], REF_ISQUIO), fila.id);
    expect(c.pd_clas).toBe(2);
    expect(c.pi_clas).toBe(4);
    expect(c.pierna).toBe("PD");
    const iguales = evaluacion({ pd: 15, pi: 15 });
    expect(celdasDe(calcularFilas(MOVILIDAD_ISQUIO, [iguales], REF_ISQUIO), iguales.id).pierna).toBe("Sin Deficit");
  });

  it("% Mejora contra la evaluación anterior del jugador que tenga el dato; sin una pierna, ni déficit ni pierna", () => {
    const primera = evaluacion({ fecha: "2026-01-10", pd: 40, pi: 40 });
    const segunda = evaluacion({ fecha: "2026-02-10", pi: 44 });
    const tercera = evaluacion({ fecha: "2026-03-10", pd: 44, pi: 33 });
    const resultado = calcularFilas(MOVILIDAD_CADERA, [tercera, segunda, primera], REF_TOBILLO);
    expect(celdasDe(resultado, segunda.id).pi_mejora).toBeCloseTo(0.1, 12);
    expect(celdasDe(resultado, segunda.id).deficit).toBe("");
    expect(celdasDe(resultado, segunda.id).pierna).toBe("");
    // La segunda no tiene PD: la tercera compara con la primera.
    expect(celdasDe(resultado, tercera.id).pd_mejora).toBeCloseTo(0.1, 12);
    expect(celdasDe(resultado, tercera.id).pi_mejora).toBeCloseTo(-0.25, 12);
    expect(celdasDe(resultado, tercera.id).numero).toBe(3);
  });

  it("sin V.R. o con otra categoría sin V.R., las clases quedan vacías", () => {
    const fila = evaluacion({ pd: 40, pi: 44, seleccion: "sub15" });
    const c = celdasDe(calcularFilas(MOVILIDAD_TOBILLO, [fila], REF_TOBILLO), fila.id);
    expect(c.pd_clas).toBe("");
    expect(c.deficit).toBeCloseTo(0.1, 12);
    expect(celdasDe(calcularFilas(MOVILIDAD_TOBILLO, [fila], null), fila.id).pd_clas).toBe("");
  });
});

describe("Movilidad: el informe y los colores", () => {
  const filas = [evaluacion({ pd: 38, pi: 44 }), evaluacion({ pd: 46, pi: 46 }), evaluacion({ pd: 36, pi: 30 })];
  const calc = calcularFilas(MOVILIDAD_TOBILLO, filas, REF_TOBILLO);
  const vista = vistaDeFilas(MOVILIDAD_TOBILLO, calc.map((c) => ({ id: c.fila.id, celdas: c.celdas })), REF_TOBILLO, "mayor");
  const fila = (id) => vista.informe.find((una) => una.id === id).celdas;

  it("la comparación «Vs …» como en Zona Media: el promedio sobre el Bueno y su clase", () => {
    // Promedio PD 40 / Bueno 38.
    expect(fila("comparacion").pd.valor).toBeCloseTo(40 / 38, 12);
    expect(fila("comparacion").pd_clas.valor).toBe(3);
    expect(fila("referencia").pd.valor).toBe(38);
    expect(vista.estilosComparacion.pd).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.amarillo})` });
  });

  it("N°, promedio, desvío (con lo que suma el Excel), máximo, mínimo y las cuentas de PD / PI / Sin Deficit", () => {
    expect(fila("n").pd.valor).toBe(3);
    expect(fila("promedios").pd.valor).toBe(40);
    expect(fila("desvios").pd.valor).toBe(Math.sqrt(28) + 0.0000000000001);
    expect(fila("maximo").pd.valor).toBe(46);
    expect(fila("minimo").pd.valor).toBe(36);
    expect(fila("promedios").pierna).toMatchObject({ valor: 1, formato: "0.0" });
    expect(fila("desvios").pierna.valor).toBe(1);
    expect(fila("maximo").pierna.valor).toBe(1);
  });

  it("los colores: más es mejor en PD, clases sobre gris y la pierna en negro con la clase del déficit en 2 o menos", () => {
    const [uno, dos, tres] = filas.map((una) => vista.estilos[una.id]);
    // μ = 40 y σ = 5,29…: PD 46 ≥ μ + σ: verde; 36 ≥ μ − σ: naranja.
    expect(dos.pd).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.verde})` });
    expect(tres.pd).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.naranja})` });
    expect(uno.pd_clas).toEqual({ background: COLORES.gris, color: COLORES.amarillo, fontWeight: 700 });
    // Déficit 15,8 % (clase 1): pierna en negro con letra blanca.
    expect(uno.pierna).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, #000000)`, color: COLORES.blanco, fontWeight: 700 });
    // Sin déficit (clase 5): la letra de color sobre gris.
    expect(dos.pierna).toEqual({ background: COLORES.gris, color: "#7030A0", fontWeight: 700 });
  });

  it("en Isquio, PD y PI van como el déficit (menos es mejor) y su % Mejora no se pinta", () => {
    const isquio = [evaluacion({ fecha: "2026-01-01", pd: 10, pi: 10 }), evaluacion({ fecha: "2026-02-01", pd: 20, pi: 20 })];
    const c = calcularFilas(MOVILIDAD_ISQUIO, isquio, REF_ISQUIO);
    const { estilos } = vistaDeFilas(MOVILIDAD_ISQUIO, c.map((una) => ({ id: una.fila.id, celdas: una.celdas })), REF_ISQUIO, "mayor");
    // μ = 15 y σ = 7,07…: 10, entre μ − σ y μ: amarillo; 20, entre μ y μ + σ: naranja.
    expect(estilos[isquio[0].id].pd).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.amarillo})` });
    expect(estilos[isquio[1].id].pd).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.naranja})` });
    expect(estilos[isquio[1].id].pd_mejora).toBeUndefined();
  });
});

describe("Movilidad: pegar la hoja Funcional entera", () => {
  // La fila de títulos de la hoja, con los bloques que se repiten: Fecha
  // (una por bloque), PD y PI (también en cada Re - test).
  const titulos = [
    "Jugador", "Fecha", "Evaluacion", "Fecha Nac", "Posición", "Seleccion",
    "PD", "PD Clas", "% Mejora PD", "PI", "PI Clas", "% Mejora PI", " % DEFICIT LATERAL", "Clas. Dif. Cm", "Dificit Pierna", "PD", "PI", "Nota",
    "Fecha", "Evaluacion", "PD", "PD Clas", "% Mejora PD", "PI", "PI Clas", "% Mejora PI", " % DEFICIT LATERAL", "Clas. Dif. Cm", "Dificit Pierna", "PD", "PI", "Nota",
    "Fecha", "Evaluacion", "PD", "PD Clas", "% Mejora PD", "PI", "PI Clas", "% Mejora PI", " % DEFICIT LATERAL", "Clas. Dif. Cm", "Dificit Pierna", "PD", "PI", "Nota",
    // Después de Isquio, el bloque de Hombro (sin datos).
    "Fecha", "Evaluacion", "BD", "BI", "FINAL ",
  ];
  const fila = ({ jugador, tobillo = ["", "", ""], cadera = ["", "", ""], isquio = ["", "", ""] }) =>
    [
      jugador, tobillo[0], "1", "", "", "Mayor",
      tobillo[1], "3", "", tobillo[2], "3", "", "5,0%", "4", "PI", "", "", "",
      cadera[0], "1", cadera[1], "3", "", cadera[2], "3", "", "5,0%", "4", "PI", "", "", "",
      isquio[0], "1", isquio[1], "3", "", isquio[2], "3", "", "5,0%", "4", "PI", "", "", "",
      "", "", "", "", "",
    ].join("\t");
  const texto = [
    titulos.join("\t"),
    fila({ jugador: "ALFA", tobillo: ["10/06/2026", "40", "42"], cadera: ["10/06/2026", "30", "31"] }),
    fila({ jugador: "BETA", tobillo: ["11/06/2026", "38", "38"], cadera: ["11/06/2026", "28", "29"], isquio: ["23/06/2026", "17", "18,5"] }),
    // Una fila de Estabilidad rotacional sola: no es de ningún test de movilidad.
    fila({ jugador: "GAMA" }),
  ].join("\n");
  const planDe = (test) => {
    const leidas = leerEvaluacionesPegadas(texto, test);
    return planDeEvaluaciones(leidas.filas, { test, hoy: "2026-10-09", elegidos: Object.fromEntries(leidas.filas.map((una) => [una.indice, COMO_PERSONA])) });
  };

  it("cada test lee su Fecha, su PD y su PI, y saltea las filas que no tienen sus datos", () => {
    const tobillo = planDe(MOVILIDAD_TOBILLO);
    expect(tobillo.map((una) => [una.nombre, una.evaluacion.fecha, una.evaluacion.datos])).toEqual([
      ["ALFA", "2026-06-10", { seleccion: "mayor", pd: 40, pi: 42 }],
      ["BETA", "2026-06-11", { seleccion: "mayor", pd: 38, pi: 38 }],
    ]);
    expect(planDe(MOVILIDAD_CADERA).map((una) => una.evaluacion.datos.pd)).toEqual([30, 28]);
    const isquio = planDe(MOVILIDAD_ISQUIO);
    expect(isquio.map((una) => [una.nombre, una.evaluacion.fecha, una.evaluacion.datos.pi])).toEqual([["BETA", "2026-06-23", 18.5]]);
    expect(ordenDeCarga(isquio)).toHaveLength(1);
  });

  // Excel no copia las columnas ocultas: lo pegado sin ellas (de la columna
  // `desde` a la `hasta`, en la fila de títulos de arriba).
  const sinColumnas = (quitar, hasta = titulos.length) =>
    texto
      .split("\n")
      .map((linea) =>
        linea
          .split("\t")
          .filter((_, i) => i < hasta && !quitar.includes(i))
          .join("\t"),
      )
      .join("\n");
  const TOBILLO = Array.from({ length: 12 }, (_, i) => 6 + i);
  const CADERA = Array.from({ length: 14 }, (_, i) => 18 + i);
  const leer = (test, pegado) => {
    const leidas = leerEvaluacionesPegadas(pegado, test);
    if (leidas.error) return leidas.error;
    return planDeEvaluaciones(leidas.filas, { test, hoy: "2026-10-09", elegidos: Object.fromEntries(leidas.filas.map((una) => [una.indice, COMO_PERSONA])) }).map((una) => [
      una.evaluacion.fecha,
      una.evaluacion.datos.pd,
    ]);
  };

  it("cada test busca su bloque por su Fecha: con Tobillo oculto, Cadera e Isquio se leen igual (Santiago, 09/10)", () => {
    const sinTobillo = sinColumnas(TOBILLO);
    expect(leer(MOVILIDAD_CADERA, sinTobillo)).toEqual([
      ["2026-06-10", 30],
      ["2026-06-11", 28],
    ]);
    expect(leer(MOVILIDAD_ISQUIO, sinTobillo)).toEqual([["2026-06-23", 17]]);
    expect(leer(MOVILIDAD_TOBILLO, sinTobillo)).toBe("evaluaciones.importar.sinMedidas");
    // Copiado hasta el fin de Cadera (como lo pegó Santiago): Cadera se lee;
    // Isquio no está y no toma los datos de Cadera.
    const hastaCadera = sinColumnas(TOBILLO, 32);
    expect(leer(MOVILIDAD_CADERA, hastaCadera)).toEqual([
      ["2026-06-10", 30],
      ["2026-06-11", 28],
    ]);
    expect(leer(MOVILIDAD_ISQUIO, hastaCadera)).toBe("evaluaciones.importar.sinMedidas");
    // Con Cadera oculto (la hoja entera) no se sabe de quién es el bloque que
    // queda: no se lee en ninguno de los dos.
    const sinCadera = sinColumnas(CADERA);
    expect(leer(MOVILIDAD_CADERA, sinCadera)).toBe("evaluaciones.importar.sinMedidas");
    expect(leer(MOVILIDAD_ISQUIO, sinCadera)).toBe("evaluaciones.importar.sinMedidas");
    expect(leer(MOVILIDAD_TOBILLO, sinCadera)).toEqual([
      ["2026-06-10", 40],
      ["2026-06-11", 38],
    ]);
  });

  it("pegada otra vez, lo que ya está se ve como «Ya está»", () => {
    const yaCargadas = planDe(MOVILIDAD_TOBILLO).map((una) => ({ ...una.evaluacion, test: MOVILIDAD_TOBILLO.id }));
    const leidas = leerEvaluacionesPegadas(texto, MOVILIDAD_TOBILLO);
    const otraVez = planDeEvaluaciones(leidas.filas, { test: MOVILIDAD_TOBILLO, hoy: "2026-10-09", evaluaciones: yaCargadas });
    expect(otraVez.map((una) => una.estado)).toEqual([ESTADOS.yaEsta, ESTADOS.yaEsta]);
  });
});
