import { describe, expect, it } from "vitest";
import { calcularFilas, vistaDeFilas } from "../motor.js";
import { COLORES } from "../formatoCondicional.js";
import { COMO_PERSONA, leerEvaluacionesPegadas, planDeEvaluaciones } from "../importar.js";
import { ISO_ADUCTOR_ABDUCTOR as T, TABLAS_DE_REFERENCIA } from "./isoAductorAbductor.js";

// Todo inventado: valores de referencia y evaluaciones de prueba (nada del
// Excel del club).
const cortes = (excelente, muyBueno, bueno, regular, malo) => ({ excelente, muy_bueno: muyBueno, bueno, regular, malo });
const fila = (cual, porMetrica) => Object.fromEntries(Object.entries(porMetrica).map(([clave, valores]) => [clave, valores[cual]]));
const METRICAS = {
  // REL: más es mejor (3,5 / 3 / 2,5 / 2 / 1,8); déficit: menos es mejor.
  ad_pd_rel: cortes(3.5, 3, 2.5, 2, 1.8),
  ad_pi_rel: cortes(3.5, 3, 2.5, 2, 1.8),
  ad_deficit: cortes(0.02, 0.05, 0.08, 0.12, 0.2),
  ab_pd_rel: cortes(3.5, 3, 2.5, 2, 1.8),
  ab_pi_rel: cortes(3.5, 3, 2.5, 2, 1.8),
  ab_deficit: cortes(0.02, 0.05, 0.08, 0.12, 0.2),
  // Ratio, a los dos lados del Bueno (1): Malo ≥ 1,15, Regular ≥ 1,07, Regular ≤ 0,92, Malo ≤ 0,83.
  ratio_pd: cortes(1.15, 1.07, 1, 0.92, 0.83),
  ratio_pi: cortes(1.15, 1.07, 1, 0.92, 0.83),
};
const REFERENCIAS = {
  categorias: { mayor: Object.fromEntries(["excelente", "muy_bueno", "bueno", "regular", "malo"].map((cual) => [cual, fila(cual, METRICAS)])) },
};

let orden = 0;
const evaluacion = ({ persona = "Ana Prueba", fecha = "2026-06-12", seleccion = "mayor", ...datos }) => {
  orden += 1;
  return { id: `a${orden}`, orden, fecha, jugador_id: null, persona, datos: { seleccion, ...datos } };
};
const celdasDe = (resultado, id) => resultado.find((uno) => uno.fila.id === id).celdas;

describe("Iso Aductor-Abductor: cada fila, como el Excel", () => {
  it("la fuerza relativa al peso, sus clases, el déficit, qué pierna rinde menos y el ratio Aductor ÷ Abductor", () => {
    // 80 kg: Aductores PD 240 (3) y PI 216 (2,7); Abductores PD 200 (2,5) y PI 200 (2,5).
    const una = evaluacion({ pc: 80, ad_pd: 240, ad_pi: 216, ab_pd: 200, ab_pi: 200 });
    const c = celdasDe(calcularFilas(T, [una], REFERENCIAS), una.id);
    expect(c.numero).toBe(1);
    expect(c.ad_pd_rel).toBe(3);
    expect(c.ad_pi_rel).toBeCloseTo(2.7, 12);
    // Justo en el corte de Muy Bueno: 4; entre Bueno y Muy Bueno: 3.
    expect(c.ad_pd_clas).toBe(4);
    expect(c.ad_pi_clas).toBe(3);
    // |3 − 2,7| / 2,7 = 11,1 %: menos es mejor, entre Bueno y Regular: 2.
    expect(c.ad_deficit).toBeCloseTo(0.3 / 2.7, 12);
    expect(c.ad_deficit_clas).toBe(2);
    // PD − PI > 0 (con la fuerza ABS): la que rinde menos es la izquierda.
    expect(c.ad_pierna).toBe("PI");
    expect(c.ab_pierna).toBe("Sin Deficit");
    // Ratio PD: 3 / 2,5 = 1,2 (≥ Malo de arriba): 1; ratio PI: 2,7 / 2,5 = 1,08 (≥ Regular de arriba): 2.
    expect(c.ratio_pd).toBeCloseTo(1.2, 12);
    expect(c.ratio_pd_clas).toBe(1);
    expect(c.ratio_pi).toBeCloseTo(1.08, 12);
    expect(c.ratio_pi_clas).toBe(2);
    expect(c.ad_pd_mejora).toBe("");
  });

  it("sin el peso, no hay relativa, clases, déficit ni ratio; la pierna sale de la fuerza ABS", () => {
    const sinPeso = evaluacion({ fecha: null, ad_pd: 214, ad_pi: 187, ab_pd: 224, ab_pi: 243 });
    const c = celdasDe(calcularFilas(T, [sinPeso], REFERENCIAS), sinPeso.id);
    expect([c.ad_pd_rel, c.ad_pd_clas, c.ad_deficit, c.ratio_pd, c.ratio_pd_clas]).toEqual(["", "", "", "", ""]);
    expect(c.ad_pierna).toBe("PI");
    expect(c.ab_pierna).toBe("PD");
  });

  it("% Mejora sobre la relativa, contra la evaluación anterior por fecha que la tenga; un ratio sobre 0, vacío", () => {
    const segunda = evaluacion({ fecha: "2026-03-01", pc: 80, ad_pd: 264, ab_pd: 0 });
    const primera = evaluacion({ fecha: "2026-01-01", pc: 80, ad_pd: 240, ab_pd: 200 });
    const resultado = calcularFilas(T, [segunda, primera], REFERENCIAS);
    expect(celdasDe(resultado, primera.id).numero).toBe(1);
    expect(celdasDe(resultado, segunda.id).numero).toBe(2);
    expect(celdasDe(resultado, segunda.id).ad_pd_mejora).toBeCloseTo(0.1, 12);
    expect(celdasDe(resultado, segunda.id).ab_pd_mejora).toBe(-1);
    expect(celdasDe(resultado, segunda.id).ratio_pd).toBe("");
  });
});

describe("Iso Aductor-Abductor: el informe y los colores", () => {
  const filas = [
    evaluacion({ pc: 80, ad_pd: 240, ad_pi: 216, ab_pd: 200, ab_pi: 200 }),
    evaluacion({ pc: 80, ad_pd: 200, ad_pi: 220, ab_pd: 220, ab_pi: 210 }),
    evaluacion({ pc: 80, ad_pd: 220, ad_pi: 220, ab_pd: 180, ab_pi: 240 }),
  ];
  const calc = calcularFilas(T, filas, REFERENCIAS);
  const vista = vistaDeFilas(T, calc.map((c) => ({ id: c.fila.id, celdas: c.celdas })), REFERENCIAS, "mayor");
  const filaDe = (id) => vista.informe.find((una) => una.id === id).celdas;

  it("la comparación «Vs …» como en Zona Media, también del ratio, y las filas del Excel", () => {
    expect(vista.informe.map((una) => una.id)).toEqual(["comparacion", "referencia", "promedios", "desvios", "n", "maximo", "minimo"]);
    // Promedio PD REL 2,75 sobre el Bueno 2,5.
    expect(filaDe("comparacion").ad_pd_rel.valor).toBeCloseTo(2.75 / 2.5, 12);
    expect(filaDe("comparacion").ad_pd_clas.valor).toBe(3);
    expect(filaDe("referencia").ratio_pd).toEqual({ valor: 1, formato: "0.00" });
    expect(filaDe("comparacion").ratio_pd_clas.valor).toBe(2);
    expect(filaDe("promedios").ad_pd).toMatchObject({ valor: 220, formato: "0" });
    expect(filaDe("desvios").ad_pd).toMatchObject({ valor: 20, formato: "0.00" });
    expect(filaDe("n").ad_pd.valor).toBe(3);
    expect(filaDe("maximo").ad_pd).toMatchObject({ valor: 240, formato: "0.0" });
    // Las cuentas de PD / PI / Sin Deficit van en Promedios, Desvíos y Mínimo, con el filtro.
    expect(filaDe("promedios").ad_pierna).toMatchObject({ valor: 1, formato: "0.0", rotulo: { "es-AR": "PD" } });
    expect(filaDe("desvios").ad_pierna.valor).toBe(1);
    expect(filaDe("minimo").ad_pierna).toMatchObject({ valor: 1, rotulo: { "es-AR": "Sin Deficit" } });
  });

  it("los colores: la relativa más es mejor, el ratio a los dos lados y la fuerza ABS sin color", () => {
    const [uno, dos] = filas.map((una) => vista.estilos[una.id]);
    // PD REL: 3, 2,5 y 2,75: μ = 2,75, σ = 0,25. 3 ≥ μ + σ: verde; 2,5 ≥ μ − σ: naranja.
    expect(uno.ad_pd_rel).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.verde})` });
    expect(dos.ad_pd_rel).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.naranja})` });
    expect(uno.ad_pd).toBeUndefined();
    expect(uno.pc).toBeUndefined();
    // Ratio PD: 1,2, 0,909… y 1,222…: el más lejos del promedio, rojo.
    expect(dos.ratio_pd).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.rojo})` });
    expect(uno.ad_pd_clas).toEqual({ background: COLORES.gris, color: COLORES.verde, fontWeight: 700 });
    expect(uno.ad_pierna).toEqual({ background: COLORES.gris, color: "#984807", fontWeight: 700 });
  });
});

describe("Iso Aductor-Abductor: valores de referencia y pegar", () => {
  it("tres tablas; la del ratio con los nombres del Excel (Malo, Regular, Bueno, Regular, Malo)", () => {
    expect(TABLAS_DE_REFERENCIA.map((tabla) => tabla.id)).toEqual(["aductor", "abductor", "ratio"]);
    const ratio = TABLAS_DE_REFERENCIA.find((tabla) => tabla.id === "ratio");
    expect(ratio.filas.slice(3).map((una) => una.titulo["es-AR"])).toEqual(["Malo", "Regular", "Bueno", "Regular", "Malo"]);
    expect(TABLAS_DE_REFERENCIA[0].filas).toBeUndefined();
  });

  it("al pegar, PD (ABS) y PD (REL) se leen igual: va la primera de Aductores y la tercera de Abductores", () => {
    const titulos = ["Jugador", "Seleccion", "Posición", "F.N.", "Evaluación", "Fecha", "P.C.", "Grados", "PD     (ABS).", "PD    (REL)", "Clas. PD (REL)", "% Mejora PD", "PI     (ABS).", "PI    (REL)", "Clas. PI (REL)", "% Mejora PI", "DEFICIT LATERAL ", "Clas. Deficit", "DEFICIT PIERNA", "PD     (ABS)", "PD    (REL)", "Clas. PD (REL)", "% Mejora PD", "PI     (ABS)", "PI    (REL)", "Clas. PI (REL)", "% Mejora PI", "DEFICIT LATERAL ", "Clas. Deficit", "DEFICIT PIERNA", "Ant/Ago PD", "Clas Ratio PD", "Ant/Ago PI", "Clas Ratio PI"];
    const datos = ["ALFA", "Mayor", "", "", "1", "27/06/2026", "77,358490566037740", "", "174,0", "2,2", "2", "", "177,0", "2,3", "2", "", "1,7%", "3", "PD", "222,0", "2,9", "4", "", "205,0", "2,7", "3", "", "8,3%", "2", "PI", "0,78", "1", "0,86", "2"];
    const sinFecha = ["BETA", "Mayor", "", "", "2", "", "", "", "214,0", "", "", "", "187,0", "", "", "", "", "", "PI", "224,0", "", "", "", "243,0", "", "", "", "", "", "PD", "", "", "", ""];
    const texto = [titulos, datos, sinFecha].map((una) => una.join("\t")).join("\n");
    const leidas = leerEvaluacionesPegadas(texto, T);
    const plan = planDeEvaluaciones(leidas.filas, { test: T, hoy: "2026-10-09", elegidos: Object.fromEntries(leidas.filas.map((una) => [una.indice, COMO_PERSONA])) });
    expect(plan[0].evaluacion).toMatchObject({ fecha: "2026-06-27", datos: { seleccion: "mayor", pc: 77.35849056603774, ad_pd: 174, ad_pi: 177, ab_pd: 222, ab_pi: 205 } });
    expect(plan[0].avisos).toEqual([]);
    // La que no tiene fecha ni peso entra igual (Santiago, 09/10).
    expect(plan[1].evaluacion).toMatchObject({ fecha: null, datos: { ad_pd: 214, ad_pi: 187, ab_pd: 224, ab_pi: 243 } });
    expect(plan[1].problemas).toEqual([]);
  });
});
