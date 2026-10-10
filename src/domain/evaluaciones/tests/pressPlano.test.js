import { describe, expect, it } from "vitest";
import { calcularFilas, vistaDeFilas } from "../motor.js";
import { COLORES } from "../formatoCondicional.js";
import { COMO_PERSONA, leerEvaluacionesPegadas, planDeEvaluaciones } from "../importar.js";
import { PRESS_PLANO as T } from "./pressPlano.js";

// Todo inventado: valores de referencia y evaluaciones de prueba (nada del
// Excel del club).
const cortes = (excelente, muyBueno, bueno, regular, malo) => ({ excelente, muy_bueno: muyBueno, bueno, regular, malo });
const METRICAS = { rm: cortes(100, 92, 85, 78, 70), rel: cortes(1.35, 1.25, 1.15, 1.05, 0.95) };
const REFERENCIAS = {
  categorias: {
    mayor: Object.fromEntries(["excelente", "muy_bueno", "bueno", "regular", "malo"].map((cual) => [cual, Object.fromEntries(Object.entries(METRICAS).map(([clave, valores]) => [clave, valores[cual]]))])),
  },
};

let orden = 0;
const evaluacion = ({ persona = "Ana Prueba", fecha = "2026-06-24", seleccion = "mayor", ...datos }) => {
  orden += 1;
  return { id: `p${orden}`, orden, fecha, jugador_id: null, persona, datos: { seleccion, ...datos } };
};
const celdasDe = (resultado, id) => resultado.find((uno) => uno.fila.id === id).celdas;

describe("Press Plano: cada fila, como el Excel", () => {
  it("el RM con las repeticiones, las cargas sobre el RM, la Rel y sus clases", () => {
    // 80 kg × (1 + 0,029 × 5) = 91,6; peso 80: Rel 1,145.
    const una = evaluacion({ pc: 80, rep: 5, kg: 80 });
    const c = celdasDe(calcularFilas(T, [una], REFERENCIAS), una.id);
    expect(c.numero).toBe(1);
    expect(c.rm).toBeCloseTo(91.6, 12);
    expect(c.rm_40).toBeCloseTo(91.6 * 0.4, 12);
    expect(c.rm_80).toBeCloseTo(91.6 * 0.8, 12);
    expect(c.rel).toBeCloseTo(91.6 / 80, 12);
    // RM 91,6: entre Bueno (85) y Muy Bueno (92): 3. Rel 1,145: entre Regular y Bueno: 2.
    expect(c.rm_clas).toBe(3);
    expect(c.rel_clas).toBe(2);
    expect(c.rm_mejora).toBe("");
    expect(c.va).toBe(1);
  });

  it("sin Rep, el RM es el Kg levantado (Santiago, 10/10: «esas vacías son 1»); sin Kg, sin RM", () => {
    const sinRep = evaluacion({ pc: 80, kg: 100 });
    const sinKg = evaluacion({ pc: 80, rep: 3 });
    const resultado = calcularFilas(T, [sinRep, sinKg], REFERENCIAS);
    expect(celdasDe(resultado, sinRep.id).rm).toBe(100);
    expect(celdasDe(resultado, sinRep.id).rm_clas).toBe(5);
    const c = celdasDe(resultado, sinKg.id);
    expect([c.rm, c.rm_40, c.rm_clas, c.rel, c.rel_clas]).toEqual(["", "", "", "", ""]);
  });

  it("sin peso, sin Rel ni su clase; sin V.R. de la categoría, sin clases", () => {
    const sinPeso = evaluacion({ rep: 2, kg: 90 });
    const juvenil = evaluacion({ seleccion: "sub17", pc: 70, rep: 2, kg: 60 });
    const resultado = calcularFilas(T, [sinPeso, juvenil], REFERENCIAS);
    expect(celdasDe(resultado, sinPeso.id).rel).toBe("");
    expect(celdasDe(resultado, sinPeso.id).rel_clas).toBe("");
    expect(celdasDe(resultado, sinPeso.id).rm_clas).not.toBe("");
    expect(celdasDe(resultado, juvenil.id).rm_clas).toBe("");
  });

  it("% mejora contra la evaluación anterior por fecha que tenga el dato; Va? como en Zona Media", () => {
    const segunda = evaluacion({ fecha: "2026-08-25", pc: 80, rep: 2, kg: 99 });
    const primera = evaluacion({ fecha: "2026-06-24", pc: 80, rep: 2, kg: 90 });
    const resultado = calcularFilas(T, [segunda, primera], REFERENCIAS);
    expect(celdasDe(resultado, segunda.id).numero).toBe(2);
    expect(celdasDe(resultado, segunda.id).rm_mejora).toBeCloseTo(0.1, 12);
    expect(celdasDe(resultado, segunda.id).rel_mejora).toBeCloseTo(0.1, 12);
    expect(celdasDe(resultado, segunda.id).va).toBe(2);
  });
});

describe("Press Plano: el informe y los colores", () => {
  const filas = [evaluacion({ persona: "Uno", pc: 80, rep: 2, kg: 90 }), evaluacion({ persona: "Dos", pc: 75, rep: 4, kg: 80 }), evaluacion({ persona: "Tres", pc: 90, kg: 100 })];
  const calc = calcularFilas(T, filas, REFERENCIAS);
  const vista = vistaDeFilas(T, calc.map((c) => ({ id: c.fila.id, celdas: c.celdas })), REFERENCIAS, "mayor");
  const filaDe = (id) => vista.informe.find((una) => una.id === id).celdas;
  const rms = calc.map((c) => c.celdas.rm);

  it("la comparación «Vs …» del RM y la Rel con su clase, sin la del % mejora, y las filas del Excel", () => {
    expect(vista.informe.map((una) => una.id)).toEqual(["comparacion", "referencia", "promedios", "desvios", "n", "maximo", "minimo"]);
    const promedio = rms.reduce((a, b) => a + b, 0) / rms.length;
    expect(filaDe("comparacion").rm).toMatchObject({ valor: expect.closeTo(promedio / 85, 12), formato: "0.0%" });
    expect(filaDe("comparacion").rm_clas.valor).toBe(promedio >= 92 ? 4 : promedio >= 85 ? 3 : 2);
    expect(Object.keys(filaDe("comparacion"))).toEqual(["rm", "rm_clas", "rel", "rel_clas"]);
    expect(filaDe("referencia").rel).toEqual({ valor: 1.15, formato: "0.00" });
    expect(filaDe("promedios").kg).toEqual({ valor: 90, formato: "0.00" });
    expect(filaDe("n").rep.valor).toBe(2);
    expect(filaDe("n").numero).toEqual({ valor: 3, formato: "General" });
    // Sin % mejora en ninguna fila: vacío (el Excel mostraba #DIV/0! y 0).
    expect(filaDe("promedios").rm_mejora.valor).toBe("");
    expect(filaDe("maximo").rm_mejora).toEqual({ valor: "", formato: "0%" });
  });

  it("los colores: RM y Rel contra el grupo, las clases sobre gris, la fila de comparación con la clase", () => {
    const [uno] = filas.map((una) => vista.estilos[una.id]);
    expect(uno.rm.background).toContain("linear-gradient");
    expect(uno.rm_clas.background).toBe(COLORES.gris);
    expect(uno.kg).toBeUndefined();
    expect(uno.rm_40).toBeUndefined();
    expect(vista.estilosComparacion.rm.background).toContain("linear-gradient");
  });
});

describe("Press Plano: pegar desde Excel", () => {
  it("P.C., Rep y Kg por su nombre (un título con salto de línea entre comillas, como lo copia Excel)", () => {
    const titulos = ["nº Eva", "Fecha", "Jugador", "Seleccion", "Fecha Nac", "Posición", "P.C.", "0,4", "0,5", "0,6", "0,7", "0,8", "Rep", "RM", '"Clas.\nRM"', "% mejora", "Kg", "Rel", "Clas. Grupo (Rel)", "% mejora", "Va?", "Nota"];
    const alfa = ["1", "24/06/26", "ALFA", "Mayor", "", "", "80,25", "32", "40", "48", "56", "64", "2", "85", "3", "", "80", "1,06", "2", "", "1", ""];
    const beta = ["1", "30/06/26", "BETA", "Mayor", "", "", "88", "40", "50", "60", "70", "80", "", "100", "4", "", "100", "1,14", "2", "", "1", "nota"];
    const texto = [titulos, alfa, beta].map((una) => una.join("\t")).join("\n");
    const leidas = leerEvaluacionesPegadas(texto, T);
    expect(leidas.error).toBe("");
    const plan = planDeEvaluaciones(leidas.filas, { test: T, hoy: "2026-10-10", elegidos: Object.fromEntries(leidas.filas.map((una) => [una.indice, COMO_PERSONA])) });
    expect(plan[0].evaluacion).toEqual({ jugador_id: null, persona: "ALFA", fecha: "2026-06-24", datos: { seleccion: "mayor", pc: 80.25, rep: 2, kg: 80 } });
    expect(plan[1].evaluacion).toEqual({ jugador_id: null, persona: "BETA", fecha: "2026-06-30", datos: { seleccion: "mayor", pc: 88, kg: 100, nota: "nota" } });
  });
});
