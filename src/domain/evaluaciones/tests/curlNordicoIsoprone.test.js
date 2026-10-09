import { describe, expect, it } from "vitest";
import { calcularFilas, estadisticas, estilosDeFilas, vistaDeFilas } from "../motor.js";
import { COLORES } from "../formatoCondicional.js";
import { leerEvaluacionesPegadas, planDeEvaluaciones } from "../importar.js";
import { CURL_NORDICO_ISOPRONE as CURL } from "./curlNordicoIsoprone.js";

// Todo inventado: valores de referencia y evaluaciones de prueba (nada del
// Excel del club).
const cortes = (excelente, muyBueno, bueno, regular, malo) => ({ excelente, muy_bueno: muyBueno, bueno, regular, malo });
const VR = (rel, def) => {
  const metricas = {};
  ["curl", "iso"].forEach((test) =>
    ["l_max_rel", "r_max_rel", "l_med_rel", "r_med_rel"].forEach((m) => {
      metricas[`${test}_${m}`] = rel;
    }),
  );
  ["curl", "iso"].forEach((test) =>
    ["def_max", "def_med"].forEach((m) => {
      metricas[`${test}_${m}`] = def;
    }),
  );
  const fila = (cual) => Object.fromEntries(Object.entries(metricas).map(([clave, valores]) => [clave, valores[cual]]));
  return { excelente: fila("excelente"), muy_bueno: fila("muy_bueno"), bueno: fila("bueno"), regular: fila("regular"), malo: fila("malo") };
};
// Rel: más es mejor (6 / 5,5 / 5 / 4,5 / 4); déficit: menos es mejor (2 % / 5 % / 8 % / 12 % / 20 %).
const REFERENCIAS = { categorias: { mayor: VR(cortes(6, 5.5, 5, 4.5, 4), cortes(0.02, 0.05, 0.08, 0.12, 0.2)) } };

let orden = 0;
const evaluacion = ({ persona = "Ana Prueba", fecha = "2026-06-12", seleccion = "mayor", ...datos }) => {
  orden += 1;
  return { id: `c${orden}`, orden, fecha, jugador_id: null, persona, datos: { seleccion, ...datos } };
};
const calcular = (filas, referencias = REFERENCIAS) => calcularFilas(CURL, filas, referencias);
const celdasDe = (resultado, id) => resultado.find((uno) => uno.fila.id === id).celdas;

describe("Curl Nórdico e Isoprone: cada fila, como el Excel", () => {
  it("la fuerza relativa al peso, su clase, el déficit con su clase y qué pierna rinde menos", () => {
    // 80 kg; L 440 (5,5) y R 400 (5): R rinde menos, déficit 10 %.
    const fila = evaluacion({ pc: 80, curl_l_max: 440, curl_r_max: 400 });
    const c = celdasDe(calcular([fila]), fila.id);
    expect(c.numero).toBe(1);
    expect(c.curl_l_max_rel).toBe(5.5);
    expect(c.curl_r_max_rel).toBe(5);
    // Justo en el corte de Muy Bueno: 4; justo en el de Bueno: 3.
    expect(c.curl_l_max_clas).toBe(4);
    expect(c.curl_r_max_clas).toBe(3);
    // |5 − 5,5| / 5 = 10 %: entre Bueno (8 %) y Regular (12 %), menos es mejor: 2.
    expect(c.curl_def_max).toBeCloseTo(0.1, 12);
    expect(c.curl_def_max_clas).toBe(2);
    expect(c.curl_pierna_max).toBe("PD");
    // Sin evaluación anterior, no hay % mejora; lo que no se cargó, vacío.
    expect(c.curl_l_max_mejora).toBe("");
    expect(c.curl_l_med_rel).toBe("");
    expect(c.curl_def_med).toBe("");
    expect(c.curl_pierna_med).toBe("");
    expect(c.iso_l_max_clas).toBe("");
    // Las columnas que sumaban las dos piernas no están (Santiago, 09/10).
    expect(c).not.toHaveProperty("curl_max_mejora_lr");
  });

  it("qué pierna rinde menos va con la fuerza sin dividir (no necesita el peso); el resto, sí", () => {
    const iguales = evaluacion({ curl_l_max: 400, curl_r_max: 400, iso_l_max: 30, iso_r_max: 35 });
    const c = celdasDe(calcular([iguales]), iguales.id);
    expect(c.curl_pierna_max).toBe("Sin Deficit");
    expect(c.iso_pierna_max).toBe("PI");
    // Sin P.C., ni la relativa ni el déficit.
    expect(c.curl_l_max_rel).toBe("");
    expect(c.curl_def_max).toBe("");
    expect(c.curl_l_max_clas).toBe("");
  });

  it("% mejora: sobre la relativa, contra la evaluación anterior que la tenga (sin límite)", () => {
    const primera = evaluacion({ fecha: "2026-03-01", pc: 80, curl_l_max: 400, curl_l_med: 320 });
    // La segunda no tiene Media: la tercera compara su Media con la primera.
    const segunda = evaluacion({ fecha: "2026-04-01", pc: 80, curl_l_max: 440 });
    const tercera = evaluacion({ fecha: "2026-05-01", pc: 75, curl_l_max: 450, curl_l_med: 330 });
    const resultado = calcular([tercera, primera, segunda]);
    expect(celdasDe(resultado, segunda.id).curl_l_max_mejora).toBeCloseTo(0.1, 12);
    expect(celdasDe(resultado, tercera.id).numero).toBe(3);
    expect(celdasDe(resultado, tercera.id).curl_l_max_mejora).toBeCloseTo(6 / 5.5 - 1, 12);
    expect(celdasDe(resultado, tercera.id).curl_l_med_mejora).toBeCloseTo(330 / 75 / 4 - 1, 12);
  });

  it("las clases contra los V.R. de la categoría de cada fila; sin V.R. de esa categoría, vacías", () => {
    const sub17 = evaluacion({ seleccion: "sub17", pc: 80, curl_l_max: 440 });
    const sinCategoria = evaluacion({ seleccion: null, pc: 80, curl_l_max: 440 });
    const resultado = calcular([sub17, sinCategoria]);
    expect(celdasDe(resultado, sub17.id).curl_l_max_clas).toBe("");
    expect(celdasDe(resultado, sinCategoria.id).curl_l_max_clas).toBe("");
    const conSub17 = { categorias: { ...REFERENCIAS.categorias, sub17: VR(cortes(5, 4.5, 4, 3.5, 3), cortes(0.02, 0.05, 0.08, 0.12, 0.2)) } };
    expect(celdasDe(calcular([sub17], conSub17), sub17.id).curl_l_max_clas).toBe(5);
    // Sin ningún V.R., todas vacías (el Excel les daba 1 o 5).
    expect(celdasDe(calcular([sub17], null), sub17.id).curl_l_max_clas).toBe("");
  });
});

describe("Curl Nórdico e Isoprone: el informe y los colores", () => {
  const filas = [
    evaluacion({ persona: "Uno", pc: 80, curl_l_max: 400, curl_r_max: 360 }),
    evaluacion({ persona: "Dos", pc: 80, curl_l_max: 480, curl_r_max: 500 }),
    evaluacion({ persona: "Tres", pc: 80, curl_l_max: 440, curl_r_max: 440 }),
    evaluacion({ persona: "Cuatro", pc: 80, curl_l_max: 360, curl_r_max: 320 }),
  ];
  const calculadas = calcular(filas);

  it("N°, promedio, desvío, máximo y mínimo; y cuántas PD / PI / Sin Deficit hay con las filas que se ven", () => {
    const vista = vistaDeFilas(CURL, calculadas.map((uno) => ({ id: uno.fila.id, celdas: uno.celdas })), REFERENCIAS, "mayor");
    const fila = (id) => vista.informe.find((una) => una.id === id).celdas;
    expect(vista.informe.map((una) => una.id)).toEqual(["n", "promedios", "desvios", "maximo", "minimo"]);
    expect(fila("n").numero.valor).toBe(4);
    expect(fila("n").curl_l_max_rel.valor).toBe(4);
    expect(fila("promedios").curl_l_max_rel.valor).toBeCloseTo(5.25, 12);
    expect(fila("promedios").curl_l_max_rel.formato).toBe("0.0");
    expect(fila("promedios").curl_def_max.formato).toBe("0.0%");
    expect(fila("promedios").curl_pierna_max).toMatchObject({ valor: 2, rotulo: { "es-AR": "PD", "pt-BR": "PD" } });
    expect(fila("desvios").curl_pierna_max).toMatchObject({ valor: 1, rotulo: { "es-AR": "PI", "pt-BR": "PE" } });
    expect(fila("maximo").curl_pierna_max).toMatchObject({ valor: 1 });
    // Sin ningún dato en la columna: vacío (el Excel mostraba #DIV/0! y 0).
    expect(fila("promedios").iso_l_max_rel.valor).toBe("");
    expect(fila("n").iso_l_max_rel.valor).toBe(0);
    // Con el filtro, solo las que se ven.
    const dos = vistaDeFilas(CURL, calculadas.slice(0, 2).map((uno) => ({ id: uno.fila.id, celdas: uno.celdas })), REFERENCIAS, "mayor");
    expect(dos.informe.find((una) => una.id === "promedios").celdas.curl_pierna_max.valor).toBe(1);
    // Sin "Vs …": no compara con los V.R.
    expect(vista.estilosComparacion).toEqual({});
  });

  it("los colores: la relativa contra su promedio y su desvío, el déficit al revés, las clases con su color", () => {
    const est = estadisticas(CURL.columnasDelInforme, calculadas.map((uno) => uno.celdas));
    const estilos = estilosDeFilas(CURL.reglas, calculadas.map((uno) => ({ id: uno.fila.id, celdas: uno.celdas })), est);
    const degradeDe = (color) => ({ background: `linear-gradient(90deg, #FFFFFF, ${color})` });
    // L MÁX Rel 5 / 6 / 5,5 / 4,5: promedio 5,25, desvío ≈ 0,65.
    expect(estilos[filas[1].id].curl_l_max_rel).toEqual(degradeDe(COLORES.verde));
    expect(estilos[filas[2].id].curl_l_max_rel).toEqual(degradeDe(COLORES.amarillo));
    expect(estilos[filas[0].id].curl_l_max_rel).toEqual(degradeDe(COLORES.naranja));
    expect(estilos[filas[3].id].curl_l_max_rel).toEqual(degradeDe(COLORES.rojo));
    // La clase 5 (6 ≥ Excelente): sobre verde oscuro, la letra blanca.
    expect(estilos[filas[1].id].curl_l_max_clas).toEqual({ background: COLORES.gris, color: COLORES.verdeOscuro, fontWeight: 700 });
    // Qué pierna: la letra de color sobre gris, como en el Excel.
    expect(estilos[filas[0].id].curl_pierna_max).toEqual({ background: COLORES.gris, color: "#0D0D0D", fontWeight: 700 });
    expect(estilos[filas[2].id].curl_pierna_max).toEqual({ background: COLORES.gris, color: "#7030A0", fontWeight: 700 });
    // Lo vacío, sin nada.
    expect(estilos[filas[0].id].iso_l_max_rel).toBeUndefined();
  });
});

describe("Curl Nórdico e Isoprone: pegar desde Excel", () => {
  it("los títulos que se repiten: el primero es de Curl Nórdico y el segundo de Isoprone; los números con coma", () => {
    const pegado = [
      "Jugador\tFecha\tEvaluacion\tSeleccion\tP.C.\tL MÁX\tL MÁX Rel\tR MÁX\tL MED.\tR MED.\tL MÁX\tR MÁX\tL MED.\tR MED.",
      "Ana Prueba\t12/06/2026\t1\tMayor\t80,5\t400\t4,97\t380\t310,5\t300\t30\t32\t\t",
    ].join("\n");
    const leido = leerEvaluacionesPegadas(pegado, CURL);
    expect(leido.error).toBe("");
    const [plan] = planDeEvaluaciones(leido.filas, { test: CURL, plantel: [], hoy: "2026-10-09", anio: 2026, elegidos: { [leido.filas[0].indice]: "persona" } });
    expect(plan.evaluacion.datos).toEqual({ seleccion: "mayor", pc: 80.5, curl_l_max: 400, curl_r_max: 380, curl_l_med: 310.5, curl_r_med: 300, iso_l_max: 30, iso_r_max: 32 });
    expect(plan.avisos).toEqual([]);
  });
});
