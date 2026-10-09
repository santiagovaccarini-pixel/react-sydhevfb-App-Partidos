import { describe, expect, it } from "vitest";
import { calcularFilas, vistaDeFilas } from "../motor.js";
import { COLORES } from "../formatoCondicional.js";
import { COMO_PERSONA, leerEvaluacionesPegadas, planDeEvaluaciones } from "../importar.js";
import { SENTADILLA_INCREMENTAL as T, franjaDelExcel, porcentajeDelRm } from "./sentadillaIncremental.js";

// Todo inventado: valores de referencia y evaluaciones de prueba (nada del
// Excel del club).
const cortes = (excelente, muyBueno, bueno, regular, malo) => ({ excelente, muy_bueno: muyBueno, bueno, regular, malo });
const METRICAS = {
  rm_ind: cortes(320, 290, 260, 230, 200),
  rel: cortes(3.6, 3.3, 3, 2.7, 2.4),
  rm_vel: cortes(300, 270, 240, 210, 180),
  rel_vel: cortes(3.5, 3.2, 2.9, 2.6, 2.3),
};
const REFERENCIAS = {
  categorias: {
    mayor: Object.fromEntries(["excelente", "muy_bueno", "bueno", "regular", "malo"].map((cual) => [cual, Object.fromEntries(Object.entries(METRICAS).map(([clave, valores]) => [clave, valores[cual]]))])),
  },
};

let orden = 0;
const evaluacion = ({ persona = "Ana Prueba", fecha = "2026-06-12", seleccion = "mayor", medio = "agachamento_trap", ...datos }) => {
  orden += 1;
  return { id: `s${orden}`, orden, fecha, jugador_id: null, persona, datos: { seleccion, medio, ...datos } };
};
const celdasDe = (resultado, id) => resultado.find((uno) => uno.fila.id === id).celdas;
const fmax = (carga, pse) => (100 * carga) / porcentajeDelRm(pse);
const media = (valores) => valores.reduce((a, b) => a + b, 0) / valores.length;
const desvio = (valores) => {
  const m = media(valores);
  return Math.sqrt(valores.reduce((total, x) => total + (x - m) ** 2, 0) / (valores.length - 1));
};

// 80 kg; cuatro series (la quinta no se hizo).
const CUATRO_SERIES = { pc: 80, kg_1: 20, pse_1: 0, kg_2: 40, pse_2: 2, kg_3: 60, pse_3: 4, kg_4: 80, pse_4: 6 };

describe("Sentadilla Incremental: cada fila, como el Excel", () => {
  it("la carga con el peso, el % del RM por el PSE, el Fmax T de cada serie y el RM IND (su promedio)", () => {
    const una = evaluacion(CUATRO_SERIES);
    const c = celdasDe(calcularFilas(T, [una], REFERENCIAS), una.id);
    expect(c.numero).toBe(1);
    expect(c.carga_1).toBe(100);
    expect(c.rm_pse_1).toBeCloseTo(35.092, 12);
    expect(c.rm_pse_2).toBeCloseTo(0.0415 * 8 - 0.8181 * 4 + 9.8094 * 2 + 35.092, 12);
    expect(c.fmax_1).toBeCloseTo(fmax(100, 0), 9);
    const fmaxes = [fmax(100, 0), fmax(120, 2), fmax(140, 4), fmax(160, 6)];
    expect(c.rm_ind).toBeCloseTo(media(fmaxes), 9);
    expect(c.desvio).toBeCloseTo(desvio(fmaxes), 9);
    expect(c.coef_var).toBeCloseTo(desvio(fmaxes) / media(fmaxes), 9);
    expect(c.rel).toBeCloseTo(media(fmaxes) / 80, 9);
    expect(c.rm_pct_2).toBeCloseTo(120 / media(fmaxes), 9);
    // La serie que no se hizo queda vacía (en el Excel, la carga era el peso solo).
    expect([c.carga_5, c.rm_pse_5, c.fmax_5, c.rm_pct_5]).toEqual(["", "", "", ""]);
  });

  it("una serie con «NO» o sin PSE no cuenta para el RM; su carga y su % RM IND quedan", () => {
    const todas = evaluacion(CUATRO_SERIES);
    const sinLaPrimera = evaluacion({ ...CUATRO_SERIES, cuenta_1: "no" });
    const sinPse = evaluacion({ ...CUATRO_SERIES, pse_1: null });
    const conSi = evaluacion({ ...CUATRO_SERIES, cuenta_1: "si" });
    const resultado = calcularFilas(T, [todas, sinLaPrimera, sinPse, conSi], REFERENCIAS);
    const tres = [fmax(120, 2), fmax(140, 4), fmax(160, 6)];
    const c = celdasDe(resultado, sinLaPrimera.id);
    expect([c.rm_pse_1, c.fmax_1]).toEqual(["", ""]);
    expect(c.carga_1).toBe(100);
    expect(c.rm_ind).toBeCloseTo(media(tres), 9);
    expect(c.rm_pct_1).toBeCloseTo(100 / media(tres), 9);
    expect(celdasDe(resultado, sinPse.id).rm_ind).toBeCloseTo(media(tres), 9);
    expect(celdasDe(resultado, conSi.id).rm_ind).toBeCloseTo(celdasDe(resultado, todas.id).rm_ind, 12);
  });

  it("en Leg Press la carga es solo lo que se levanta, en las cinco series (Santiago, 09/10)", () => {
    const prensa = evaluacion({ ...CUATRO_SERIES, medio: "prensa", kg_5: 100, pse_5: 8 });
    const c = celdasDe(calcularFilas(T, [prensa], REFERENCIAS), prensa.id);
    expect([c.carga_1, c.carga_2, c.carga_3, c.carga_4, c.carga_5]).toEqual([20, 40, 60, 80, 100]);
    expect(c.rm_ind).toBeCloseTo(media([fmax(20, 0), fmax(40, 2), fmax(60, 4), fmax(80, 6), fmax(100, 8)]), 9);
  });

  it("la clase de la Rel contra los V.R. de su categoría; sin V.R. o sin peso, vacía", () => {
    const una = evaluacion(CUATRO_SERIES);
    const juvenil = evaluacion({ ...CUATRO_SERIES, seleccion: "sub15" });
    const sinPeso = evaluacion({ ...CUATRO_SERIES, pc: null });
    const resultado = calcularFilas(T, [una, juvenil, sinPeso], REFERENCIAS);
    const c = celdasDe(resultado, una.id);
    const esperada = c.rel >= 3.6 ? 5 : c.rel >= 3.3 ? 4 : c.rel >= 3 ? 3 : c.rel >= 2.7 ? 2 : 1;
    expect(c.clas).toBe(esperada);
    expect(celdasDe(resultado, juvenil.id).clas).toBe("");
    expect(celdasDe(resultado, sinPeso.id).rel).toBe("");
    expect(celdasDe(resultado, sinPeso.id).clas).toBe("");
  });

  it("% mejora contra la evaluación anterior del jugador con el mismo Medio que tenga el dato", () => {
    const primera = evaluacion({ ...CUATRO_SERIES, fecha: "2026-01-10" });
    const otroMedio = evaluacion({ ...CUATRO_SERIES, fecha: "2026-02-10", medio: "agachamento", pc: 70 });
    const tercera = evaluacion({ ...CUATRO_SERIES, fecha: "2026-03-10", pc: 70 });
    const resultado = calcularFilas(T, [tercera, otroMedio, primera], REFERENCIAS);
    expect(celdasDe(resultado, tercera.id).numero).toBe(3);
    expect(celdasDe(resultado, otroMedio.id).rel_mejora).toBe("");
    const antes = celdasDe(resultado, primera.id).rel;
    const ahora = celdasDe(resultado, tercera.id).rel;
    expect(celdasDe(resultado, tercera.id).rel_mejora).toBeCloseTo((ahora - antes) / antes, 12);
  });

  it("la Rel (vel) es el RM x Vel sobre el peso; sin RM x Vel, vacía (en el Excel daba 0)", () => {
    const conVel = evaluacion({ ...CUATRO_SERIES, rm_vel: 240 });
    const sinVel = evaluacion(CUATRO_SERIES);
    const resultado = calcularFilas(T, [conVel, sinVel], REFERENCIAS);
    expect(celdasDe(resultado, conVel.id).rel_vel).toBe(3);
    expect(celdasDe(resultado, sinVel.id).rel_vel).toBe("");
  });

  it("la franja de color del RM IND y de la Rel (vel), como las reglas del Excel (en el corte del Bueno, naranja)", () => {
    const c = [320, 290, 260, 230, 200];
    expect(franjaDelExcel(229.9, c)).toBe(1);
    expect(franjaDelExcel(230, c)).toBe(2);
    expect(franjaDelExcel(260, c)).toBe(2);
    expect(franjaDelExcel(260.1, c)).toBe(3);
    expect(franjaDelExcel(290, c)).toBe(3);
    expect(franjaDelExcel(320, c)).toBe(4);
    expect(franjaDelExcel(320.1, c)).toBe(5);
    expect(franjaDelExcel("", c)).toBe("");
    expect(franjaDelExcel(250, null)).toBe("");
  });
});

describe("Sentadilla Incremental: el informe y los colores", () => {
  const filas = [
    evaluacion({ ...CUATRO_SERIES, vel_1: 1.2, rm_vel: 240 }),
    evaluacion({ ...CUATRO_SERIES, pc: 70, vel_1: 1.0, rm_vel: 230 }),
    evaluacion({ ...CUATRO_SERIES, pc: 90, vel_1: 1.1 }),
  ];
  const calc = calcularFilas(T, filas, REFERENCIAS);
  const vista = vistaDeFilas(T, calc.map((c) => ({ id: c.fila.id, celdas: c.celdas })), REFERENCIAS, "mayor");
  const filaDe = (id) => vista.informe.find((una) => una.id === id).celdas;
  const rels = calc.map((c) => c.celdas.rel);

  it("la comparación «Vs …» como en Zona Media y las filas del Excel, con sus formatos", () => {
    expect(vista.informe.map((una) => una.id)).toEqual(["comparacion", "referencia", "promedios", "desvios", "n", "maximo", "minimo"]);
    expect(filaDe("comparacion").rel).toMatchObject({ valor: expect.closeTo(media(rels) / 3, 12), formato: "0.0%" });
    expect(filaDe("referencia").rel).toEqual({ valor: 3, formato: "0.00" });
    expect(filaDe("comparacion").rm_vel.valor).toBeCloseTo(235 / 240, 12);
    expect(filaDe("comparacion").vs_rm_vel.valor).toBe(2);
    // Mayor sin V.R. de P.C.: vacío.
    expect(filaDe("comparacion").pc.valor).toBe("");
    expect(filaDe("promedios").pc).toEqual({ valor: 80, formato: "0.00" });
    expect(filaDe("desvios").kg_1).toMatchObject({ valor: 0, formato: "0.0" });
    expect(filaDe("desvios").fmax_2.formato).toBe("0.00");
    expect(filaDe("maximo").rm_pct_1.formato).toBe("0%");
    expect(filaDe("n").numero).toEqual({ valor: 3, formato: "General" });
    expect(filaDe("n").rm_vel.valor).toBe(2);
    // Sin ningún número en la columna (la quinta serie), vacío.
    expect(filaDe("promedios").kg_5.valor).toBe("");
  });

  it("los colores: la clase sobre gris, el RM IND por su franja y la velocidad contra el grupo", () => {
    const [uno, dos] = filas.map((una) => vista.estilos[una.id]);
    const franja = calc[0].celdas.franja_rm_ind;
    const color = { 1: COLORES.rojo, 2: COLORES.naranja, 3: COLORES.amarillo, 4: COLORES.verde, 5: COLORES.verdeOscuro }[franja];
    expect(uno.rm_ind).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${color})` });
    // Vel: 1,2, 1,0 y 1,1 (μ 1,1, σ 0,1): 1,2 ≥ μ + σ, verde; 1,0 ≥ μ − σ, naranja.
    expect(uno.vel_1).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.verde})` });
    expect(dos.vel_1).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.naranja})` });
    expect(uno.clas.background).toBe(COLORES.gris);
    // Lo cargado (Kg, P.C.) no se pinta; una vacía, tampoco.
    expect(uno.kg_1).toBeUndefined();
    expect(uno.pc).toBeUndefined();
    expect(vista.estilos[filas[2].id].rel_vel).toBeUndefined();
  });

  it("la fila de comparación, pintada con la clase del promedio; el P.C., sin color", () => {
    expect(vista.estilosComparacion.rm_vel).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.naranja})` });
    expect(vista.estilosComparacion.pc).toBeUndefined();
  });
});

describe("Sentadilla Incremental: pegar desde Excel", () => {
  it("Kg, Vel, PSE y Fmax T una vez por serie; sin Fmax T con Kg y PSE, la serie no cuenta", () => {
    const serie = ["Kg", "", "Vel", "Pot", "PSE", "%RMx PSE", "Fmax T", "%        RM IND"];
    const titulos = ["nº Eva", "Fecha", "Jugador", "Seleccion", "Dispositivo", "Medio", "P.C.", ...serie, ...serie, ...serie, ...serie, ...serie, "RM IND", "DESVIO", "COEF. VAR", "RM IND/REL", "Rel", "% mejora", "Clas. Grupo", "RM x Vel", "Rel (vel)", "% mejora", "Nota"];
    const s = (kg, vel, pse, fmaxTexto) => [kg, "", vel, "", pse, "", fmaxTexto, ""];
    const alfa = ["1", "01-03-26", "ALFA", "Mayor", "vitruve - vel. Med", "Agachamento com Trap", "80,5", ...s("20", "1,201", "0", ""), ...s("40", "1,1", "0,5", "260,1"), ...s("60", "", "4", "270"), ...s("80", "", "6", "280"), ...s("", "", "", ""), "", "", "", "", "", "", "", "251", "", "", "nota de prueba"];
    const beta = ["1", "25-08-26", "BETA", "Mayor", "sin control vel.", "Leg Press", "70", ...s("80", "", "1", "200"), ...s("", "", "", ""), ...s("", "", "", ""), ...s("", "", "", ""), ...s("", "", "", ""), "", "", "", "", "", "", "", "", "", "", ""];
    const texto = [titulos, alfa, beta].map((una) => una.join("\t")).join("\n");
    const leidas = leerEvaluacionesPegadas(texto, T);
    expect(leidas.error).toBe("");
    const plan = planDeEvaluaciones(leidas.filas, { test: T, hoy: "2026-10-09", elegidos: Object.fromEntries(leidas.filas.map((una) => [una.indice, COMO_PERSONA])) });
    expect(plan[0].evaluacion).toEqual({
      jugador_id: null,
      persona: "ALFA",
      fecha: "2026-03-01",
      datos: {
        seleccion: "mayor",
        dispositivo: "vitruve",
        medio: "agachamento_trap",
        pc: 80.5,
        kg_1: 20,
        vel_1: 1.201,
        pse_1: 0,
        kg_2: 40,
        vel_2: 1.1,
        pse_2: 0.5,
        kg_3: 60,
        pse_3: 4,
        kg_4: 80,
        pse_4: 6,
        rm_vel: 251,
        nota: "nota de prueba",
        cuenta_1: "no",
      },
    });
    expect(plan[0].avisos).toEqual([]);
    expect(plan[1].evaluacion.fecha).toBe("2026-08-25");
    expect(plan[1].evaluacion.datos).toMatchObject({ dispositivo: "sin_control", medio: "prensa", kg_1: 80, pse_1: 1 });
    expect(plan[1].evaluacion.datos).not.toHaveProperty("cuenta_1");
  });
});
