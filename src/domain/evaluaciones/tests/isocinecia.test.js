import { describe, expect, it } from "vitest";
import { columnasDeLaVista } from "../ajustes.js";
import { COLORES } from "../formatoCondicional.js";
import { COMO_PERSONA, leerEvaluacionesPegadas, planDeEvaluaciones } from "../importar.js";
import { calcularFilas, estadisticas, estilosDeFilas, vistaDeFilas } from "../motor.js";
import { ISOCINECIA as ISO } from "./isocinecia.js";

// Todo inventado: valores de referencia y evaluaciones de prueba (nada del
// Excel del club).
const cortes = (excelente, muyBueno, bueno, regular, malo) => ({ excelente, muy_bueno: muyBueno, bueno, regular, malo });
const MEDIDA = cortes(300, 270, 240, 210, 180); // más es mejor
const MENOS = cortes(0.02, 0.05, 0.08, 0.12, 0.2); // menos es mejor (déficit)
const FATIGA = cortes(10, 15, 20, 25, 30); // Work Fatigue: menos es mejor
const RATIO = cortes(0.8, 0.7, 0.6, 0.5, 0.4); // a los dos lados
const vr = () => {
  const filas = { excelente: {}, muy_bueno: {}, bueno: {}, regular: {}, malo: {} };
  ISO.metricas.forEach(({ clave }) => {
    if (clave.endsWith("_de")) return;
    const cuales = clave.endsWith("_deficit") ? MENOS : /_ratio_p[di]$/.test(clave) ? RATIO : /_wf_/.test(clave) ? FATIGA : MEDIDA;
    Object.keys(filas).forEach((fila) => {
      filas[fila][clave] = cuales[fila];
    });
  });
  return filas;
};
const REFERENCIAS = { categorias: { mayor: vr() } };

let orden = 0;
const evaluacion = ({ persona = "Ana Prueba", fecha = "2026-06-12", seleccion = "mayor", ...datos }) => {
  orden += 1;
  return { id: `i${orden}`, orden, fecha, jugador_id: null, persona, datos: { seleccion, ...datos } };
};
const calcular = (filas, referencias = REFERENCIAS) => calcularFilas(ISO, filas, referencias);
const celdasDe = (resultado, id) => resultado.find((uno) => uno.fila.id === id).celdas;

describe("Isocinecia: cada fila, como el Excel", () => {
  it("la clase de cada pierna, el déficit con su clase, qué pierna rinde menos y el ratio", () => {
    // Peak 60° Ext: PD 300 (Excelente: 5), PI 270 (Muy Bueno: 4); |270 − 300| / 270 = 11,1 %.
    const fila = evaluacion({ pc: 80, v60_peak_ext_pd: 300, v60_peak_ext_pi: 270, v60_peak_flex_pd: 180, v60_peak_flex_pi: 189 });
    const c = celdasDe(calcular([fila]), fila.id);
    expect(c.numero).toBe(1);
    expect(c.v60_peak_ext_pd_clas).toBe(5);
    expect(c.v60_peak_ext_pi_clas).toBe(4);
    expect(c.v60_peak_ext_deficit).toBeCloseTo(30 / 270, 12);
    // 11,1 %: entre Bueno (8 %) y Regular (12 %), menos es mejor: 2.
    expect(c.v60_peak_ext_deficit_clas).toBe(2);
    // La izquierda rinde menos.
    expect(c.v60_peak_ext_pierna).toBe("PI");
    expect(c.v60_peak_flex_pierna).toBe("PD");
    // Ant/Ago: flexión ÷ extensión, de cada pierna; 0,6 está en el Bueno: 3.
    expect(c.v60_peak_ratio_pd).toBeCloseTo(0.6, 12);
    expect(c.v60_peak_ratio_pd_clas).toBe(3);
    expect(c.v60_peak_ratio_pi).toBeCloseTo(0.7, 12);
    // 0,7 = Muy Bueno: ya está lejos del promedio, 2.
    expect(c.v60_peak_ratio_pi_clas).toBe(2);
    // Sin evaluación anterior no hay % mejora; lo que no se cargó, vacío.
    expect(c.v60_peak_ext_pd_mejora).toBe("");
    expect(c.v180_peak_ext_pd_clas).toBe("");
    expect(c.v180_peak_ext_deficit).toBe("");
    expect(c.v180_peak_ratio_pd).toBe("");
  });

  it("sin una pierna, Deficit Pierna y el déficit quedan vacíos; las dos iguales, Sin Deficit", () => {
    const fila = evaluacion({ v60_work_ext_pd: 250, v60_work_flex_pd: 200, v60_work_flex_pi: 200, v60_rom_pi: 140 });
    const c = celdasDe(calcular([fila]), fila.id);
    // El Excel ponía "PI" con la izquierda vacía (Santiago, 05/10 y 09/10: sin el dato, vacío).
    expect(c.v60_work_ext_pierna).toBe("");
    expect(c.v60_work_ext_deficit).toBe("");
    expect(c.v60_work_ext_deficit_clas).toBe("");
    expect(c.v60_work_flex_pierna).toBe("Sin Deficit");
    expect(c.v60_work_flex_deficit).toBe(0);
    expect(c.v60_rom_pierna).toBe("");
  });

  it("Work Fatigue: su clase es menos es mejor y su ratio; un 0 es un dato (Santiago, 09/10)", () => {
    const fila = evaluacion({ v60_wf_ext_pd: 12, v60_wf_ext_pi: 26, v60_wf_flex_pd: 0, v60_wf_flex_pi: 13 });
    const c = celdasDe(calcular([fila]), fila.id);
    expect(c.v60_wf_ext_pd_clas).toBe(4);
    expect(c.v60_wf_ext_pi_clas).toBe(1);
    expect(c.v60_wf_flex_pd_clas).toBe(5);
    expect(c.v60_wf_ratio_pd).toBe(0);
    expect(c.v60_wf_ratio_pd_clas).toBe(1);
    expect(c.v60_wf_ratio_pi).toBeCloseTo(0.5, 12);
    // Work Fatigue no tiene % mejora ni déficit.
    expect(c).not.toHaveProperty("v60_wf_ext_pd_mejora");
    expect(c).not.toHaveProperty("v60_wf_ext_deficit");
  });

  it("con la extensión en 0, el ratio queda vacío (el Excel mostraba #DIV/0!)", () => {
    const fila = evaluacion({ v300_avg_ext_pd: 0, v300_avg_flex_pd: 150 });
    const c = celdasDe(calcular([fila]), fila.id);
    expect(c.v300_avg_ratio_pd).toBe("");
    expect(c.v300_avg_ratio_pd_clas).toBe("");
  });

  it("el % mejora, contra la evaluación anterior que tenga la medida, sin límite", () => {
    const primera = evaluacion({ fecha: "2026-01-10", v60_rom_pd: 120 });
    const sinRom = evaluacion({ fecha: "2026-03-10", v60_peak_ext_pd: 250 });
    const tercera = evaluacion({ fecha: "2026-06-10", v60_rom_pd: 132 });
    const resultado = calcular([tercera, primera, sinRom]);
    expect(celdasDe(resultado, tercera.id).numero).toBe(3);
    expect(celdasDe(resultado, tercera.id).v60_rom_pd_mejora).toBeCloseTo(0.1, 12);
    expect(celdasDe(resultado, sinRom.id).v60_rom_pd_mejora).toBe("");
  });

  it("las clases, contra los V.R. de la categoría de la fila; sin V.R. de esa categoría, vacías", () => {
    const sub20 = evaluacion({ seleccion: "sub20", v60_peak_ext_pd: 300 });
    const mayor = evaluacion({ v60_peak_ext_pd: 300 });
    const resultado = calcular([sub20, mayor]);
    expect(celdasDe(resultado, sub20.id).v60_peak_ext_pd_clas).toBe("");
    expect(celdasDe(resultado, mayor.id).v60_peak_ext_pd_clas).toBe(5);
    expect(celdasDe(calcular([mayor], null), mayor.id).v60_peak_ext_pd_clas).toBe("");
  });
});

describe("Isocinecia: el informe y los colores, con las filas que se ven", () => {
  const filas = [
    evaluacion({ persona: "Uno", pc: 80, v60_peak_ext_pd: 300, v60_peak_ext_pi: 270 }),
    evaluacion({ persona: "Dos", pc: 70, v60_peak_ext_pd: 240, v60_peak_ext_pi: 260 }),
    evaluacion({ persona: "Tres", pc: 75, v60_peak_ext_pd: 250, v60_peak_ext_pi: 230 }),
  ];
  const calculadas = calcular(filas);
  const visibles = calculadas.map(({ fila, celdas }) => ({ id: fila.id, celdas }));

  it("el N° cuenta datos y las cuentas de PD / PI / Sin Deficit respetan el filtro", () => {
    const { informe } = vistaDeFilas(ISO, visibles, REFERENCIAS, "mayor");
    const fila = (id) => informe.find((una) => una.id === id).celdas;
    expect(informe.map((una) => una.id)).toEqual(["n", "promedios", "desvios", "maximo", "minimo"]);
    expect(fila("n").numero.valor).toBe(3);
    // Solo hay % mejora donde hay anterior: ninguna (el Excel contaba las fórmulas: 3).
    expect(fila("n").v60_peak_ext_pd_mejora.valor).toBe(0);
    expect(fila("n").v60_peak_ext_pierna.valor).toBe(3);
    // Como el Excel: en la fila de Promedio, cuántas PD; en la de Desvío, cuántas PI.
    expect(fila("promedios").v60_peak_ext_pierna).toMatchObject({ valor: 1, formato: "0.0", rotulo: { "es-AR": "PD", "pt-BR": "PD" } });
    expect(fila("desvios").v60_peak_ext_pierna).toMatchObject({ valor: 2, rotulo: { "es-AR": "PI", "pt-BR": "PE" } });
    expect(fila("maximo").v60_peak_ext_pierna).toMatchObject({ valor: 0, rotulo: { "es-AR": "Sin Deficit", "pt-BR": "Sem Déficit" } });
    expect(fila("promedios").v60_peak_ext_pd).toMatchObject({ valor: 790 / 3, formato: "0.0" });
    // Sin ningún dato en la columna, vacío.
    expect(fila("promedios").v180_peak_ext_pd.valor).toBe("");
    // Con el filtro, solo las filas que se ven.
    const filtrado = vistaDeFilas(ISO, visibles.slice(0, 1), REFERENCIAS, "mayor").informe;
    expect(filtrado.find((una) => una.id === "desvios").celdas.v60_peak_ext_pierna.valor).toBe(1);
    expect(filtrado.find((una) => una.id === "promedios").celdas.v60_peak_ext_pierna.valor).toBe(0);
  });

  it("las clases sobre gris, la pierna en su color y los ratios a los dos lados", () => {
    const est = estadisticas(ISO.columnasDelInforme, visibles.map((una) => una.celdas));
    const estilos = estilosDeFilas(ISO.reglas, visibles, est);
    const [uno, dos] = filas;
    expect(estilos[uno.id].v60_peak_ext_pd_clas).toEqual({ background: COLORES.gris, color: COLORES.verdeOscuro, fontWeight: 700 });
    expect(estilos[uno.id].v60_peak_ext_pierna).toEqual({ background: COLORES.gris, color: "#984807", fontWeight: 700 });
    expect(estilos[dos.id].v60_peak_ext_pierna).toEqual({ background: COLORES.gris, color: "#0D0D0D", fontWeight: 700 });
    // Las vacías no se pintan.
    expect(estilos[uno.id].v180_peak_ext_pd).toBeUndefined();
    // 300 con μ ≈ 263 y σ ≈ 32: entre μ + σ y μ + 2σ, verde.
    expect(estilos[uno.id].v60_peak_ext_pd).toEqual({ background: `linear-gradient(90deg, ${COLORES.blanco}, ${COLORES.verde})` });
  });
});

describe("Isocinecia: la Base, la carga y el pegado", () => {
  it("el selector de velocidad deja las comunes y las de esa velocidad", () => {
    const de60 = columnasDeLaVista(ISO.columnas, "v60");
    expect(de60).toHaveLength(5 + 87);
    expect(de60.every((columna) => !columna.vista || columna.vista === "v60")).toBe(true);
    expect(columnasDeLaVista(ISO.columnas, "todas")).toHaveLength(ISO.columnas.length);
  });

  it("al pegar, las medidas por los nombres largos de la fila 16", () => {
    const titulos = ["Jugador", "Fecha", "Nº Evaluacion", "Seleccion", "P.C.", "Peak TQ/BW Ext Right 60", "Clas PD", "Peak TQ/BW Fle left 60", "Work Fatigue Fle Right 180", "ROM Left 300"];
    const cortos = ["Jugador", "Fecha", "Nº Evaluacion", "Seleccion", "P.C.", "PD", "Clas PD", "PI", "PD", "ROM Left 300"];
    const fila = ["Ana Prueba", "12/06/2026", "1", "Mayor", "80,5", "300,5", "5", "170", "0", "141"];
    const leidas = leerEvaluacionesPegadas([titulos, cortos, fila].map((celdas) => celdas.join("\t")).join("\n"), ISO);
    expect(leidas.error).toBe("");
    // La fila 17 (títulos cortos, con "Jugador") no es una evaluación.
    expect(leidas.filas).toHaveLength(1);
    const [plan] = planDeEvaluaciones(leidas.filas, { test: ISO, hoy: "2026-10-09", elegidos: { [leidas.filas[0].indice]: COMO_PERSONA } });
    expect(plan.evaluacion.datos).toEqual({ seleccion: "mayor", pc: 80.5, v60_peak_ext_pd: 300.5, v60_peak_flex_pi: 170, v180_wf_flex_pd: 0, v300_rom_pi: 141 });
  });
});
