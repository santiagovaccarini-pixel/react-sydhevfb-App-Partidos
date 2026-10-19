import { describe, expect, test } from "vitest";
import { COLUMNAS_GPS, columnaGps } from "./columnas.js";
import { CLAVES_DE_LOS_VR } from "./informe.js";
import { conSentidoGps } from "../sentido.js";
import { AUTOMATICO, MANUAL, MAS_ES_MEJOR, MENOS_ES_MEJOR, calcularValorReferencial } from "../valorReferencial.js";
import {
  armarPlanilla,
  calcularPlanilla,
  datoDeLaFila,
  eleccionDeEntrada,
  eleccionDeLaPlanilla,
  filasDeLaMuestra,
  leerPlanilla,
  medidasDeLaPlanilla,
  medidasDeLaPlanillaGuardada,
  muestraDeLosFiltros,
  numerosParaGuardar,
} from "./planillaVr.js";

// Todo inventado.
const fila = (id, datos) => ({ id, datos });
const FILAS = [
  fila("a", { d: 4000, tiempo: 3000 }),
  fila("b", { d: 4200, tiempo: 3600 }),
  fila("c", { d: 3900, tiempo: 2400 }),
  fila("d", { d: 4100, tiempo: 3000 }),
  fila("e", { d: 4050, tiempo: 3300 }),
  fila("f", { d: 3950, tiempo: 3000 }),
  fila("g", { d: 4150, tiempo: 3500 }),
  fila("h", { d: 9000, tiempo: 3000 }),
  fila("i", { tiempo: 3000 }),
];

describe("La planilla de valor referencial en GPS", () => {
  test("las medidas son todas las columnas de números, en el orden de la Base (también las del club)", () => {
    const claves = medidasDeLaPlanilla(COLUMNAS_GPS).map((columna) => columna.clave);
    expect(claves).toEqual(COLUMNAS_GPS.filter(conSentidoGps).map((columna) => columna.clave));
    CLAVES_DE_LOS_VR.forEach((clave) => expect(claves).toContain(clave));
    ["smax", "pse", "ua"].forEach((clave) => expect(claves).toContain(clave));
    // No las que no son números ni las fijas.
    ["microciclo", "jugador", "puesto", "inicio", "tarea_partido", "dispositivo"].forEach((clave) => expect(claves).not.toContain(clave));
    expect(medidasDeLaPlanilla([columnaGps("tiempo"), columnaGps("d"), { clave: "propia_sprints", tipo: "numero", propia: true }]).map((columna) => columna.clave)).toEqual(["tiempo", "d", "propia_sprints"]);
  });

  test("de entrada, el sentido de Ajustes (o el de la app) y Automático", () => {
    const medidas = medidasDeLaPlanilla(COLUMNAS_GPS);
    const eleccion = eleccionDeEntrada(medidas, (clave) => (clave === "tiempo" ? MENOS_ES_MEJOR : null));
    expect(eleccion.d).toEqual({ sentido: MAS_ES_MEJOR, modo: AUTOMATICO });
    expect(eleccion.tiempo).toEqual({ sentido: MENOS_ES_MEJOR, modo: AUTOMATICO });
  });

  test("el dato de cada fila: el número de la absoluta; la por minuto, su medida sobre los minutos", () => {
    expect(datoDeLaFila(columnaGps("d"), FILAS[0])).toEqual({ valor: 4000 });
    expect(datoDeLaFila(columnaGps("tiempo"), FILAS[0])).toEqual({ valor: 3000 });
    expect(datoDeLaFila(columnaGps("d_min"), FILAS[0])).toEqual({ numerador: 4000, denominador: 50 });
    expect(datoDeLaFila(columnaGps("d_min"), fila("x", { d: 10 }))).toEqual({ numerador: 10, denominador: null });
  });

  test("calcula cada medida como la planilla y dice qué filas quedaron afuera", () => {
    const medidas = [columnaGps("d"), columnaGps("d_min"), columnaGps("d_shi")];
    const eleccion = { d: { sentido: MAS_ES_MEJOR, modo: AUTOMATICO }, d_min: { sentido: MAS_ES_MEJOR, modo: MANUAL }, d_shi: { sentido: MAS_ES_MEJOR, modo: AUTOMATICO } };
    const calculos = calcularPlanilla(FILAS, medidas, eleccion);
    const esperado = calcularValorReferencial(
      FILAS.map((una) => ({ valor: una.datos.d })),
      { sentido: MAS_ES_MEJOR },
    );
    expect(calculos.d.resultado.valores).toEqual(esperado.valores);
    expect(calculos.d.resultado.n).toBe(8);
    expect(calculos.d.atipicos.map((uno) => [uno.fila.id, uno.valor, uno.bajo])).toEqual([["h", 9000, false]]);
    expect(calculos.d_min.resultado.n).toBe(8);
    // Manual sin desvíos elegidos: los de Automático.
    const relativas = FILAS.map((una) => ({ numerador: una.datos.d, denominador: una.datos.tiempo / 60 }));
    const automatico = calcularValorReferencial(relativas, { relativa: true });
    expect(calculos.d_min.resultado.valores).toEqual(calcularValorReferencial(relativas, { relativa: true, modo: MANUAL, cortes: automatico.desvios }).valores);
    // Con los elegidos, esos.
    const cortes = { excelente: 2, muy_bueno: 1, regular: 0.5, malo: 1.5 };
    const conCortes = calcularPlanilla(FILAS, [columnaGps("d_min")], { d_min: { sentido: MAS_ES_MEJOR, modo: MANUAL, cortes } });
    expect(conCortes.d_min.resultado.desvios).toEqual(cortes);
    expect(conCortes.d_min.resultado.valores).toEqual(calcularValorReferencial(relativas, { relativa: true, modo: MANUAL, cortes }).valores);
    // Sin datos en ninguna fila, no hay V.R. de esa medida.
    expect(calculos.d_shi).toEqual({ resultado: null, atipicos: [], sinTiempo: 0 });
    expect(calculos.d.sinTiempo).toBe(0);
    expect(calculos.d_min.sinTiempo).toBe(0);
  });

  test("en las por minuto, cuenta las filas con el dato y sin tiempo o con tiempo 0 (en la planilla, #DIV/0!): no entran", () => {
    const filas = [...FILAS.slice(0, 7), fila("j", { d: 500, tiempo: 0 }), fila("k", { d: 0, tiempo: 0 }), fila("l", { d: 300 }), fila("m", { d: 0, tiempo: 3000 })];
    const calculos = calcularPlanilla(filas, [columnaGps("d_min")], { d_min: { sentido: MAS_ES_MEJOR, modo: AUTOMATICO } });
    expect(calculos.d_min.sinTiempo).toBe(3);
    // El dato 0 con tiempo entra (0 por minuto), como en la planilla.
    expect(calculos.d_min.resultado.n).toBe(8);
    // Sin ninguna fila con tiempo, no hay V.R., pero se dice cuántas faltan.
    expect(calcularPlanilla(filas.slice(7, 10), [columnaGps("d_min")], {}).d_min).toEqual({ resultado: null, atipicos: [], sinTiempo: 3 });
  });

  test("se guarda como un V.R. por jugador: el Bueno en el promedio y las otras cuatro en las categorías", () => {
    const calculos = calcularPlanilla(FILAS, [columnaGps("d"), columnaGps("d_shi")], eleccionDeEntrada([columnaGps("d"), columnaGps("d_shi")]));
    const numeros = numerosParaGuardar(calculos);
    expect(Object.keys(numeros.promedio)).toEqual(["d"]);
    expect(numeros.promedio.d).toBe(calculos.d.resultado.valores.bueno);
    expect(numeros.categorias.excelente.d).toBe(calculos.d.resultado.valores.excelente);
    expect(numeros.categorias.malo.d).toBe(calculos.d.resultado.valores.malo);
    expect(Object.keys(numeros.categorias)).toEqual(["excelente", "muy_bueno", "regular", "malo"]);
    expect(numeros.desvio).toEqual({});
  });

  test("la muestra se guarda con los valores de las filas, no con los textos (sirve en otro idioma)", () => {
    const armadas = [
      { id: "a", valores: { tarea_partido: "partido_oficial_torneo", jugador: "1", fecha: "2026-10-01" }, textos: { tarea_partido: "Partido Oficial Torneo", jugador: "ALFA", fecha: "01/10/2026" } },
      { id: "b", valores: { tarea_partido: "tarea", jugador: "2", fecha: "2026-10-01" }, textos: { tarea_partido: "Tarea", jugador: "BETA", fecha: "01/10/2026" } },
      { id: "c", valores: { tarea_partido: "partido_oficial_torneo", jugador: "promedio:parcial", fecha: "2026-10-02" }, textos: { tarea_partido: "Partido Oficial Torneo", jugador: "Team Average", fecha: "02/10/2026" } },
      { id: "d", valores: { tarea_partido: "", jugador: "3", fecha: "2026-10-03" }, textos: { tarea_partido: "", jugador: "GAMA", fecha: "03/10/2026" } },
    ];
    const muestra = muestraDeLosFiltros(armadas, { tarea_partido: ["Partido Oficial Torneo", ""], jugador: ["ALFA", "Team Average", "GAMA"] });
    expect(muestra).toEqual({ tarea_partido: ["partido_oficial_torneo", ""], jugador: ["1", "promedio:parcial", "3"] });
    expect(filasDeLaMuestra(armadas, muestra).map((una) => una.id)).toEqual(["a", "c", "d"]);
    // En portugués, los mismos valores: las mismas filas.
    const enPortugues = armadas.map((una) => ({ ...una, textos: { ...una.textos, tarea_partido: una.textos.tarea_partido && `PT ${una.textos.tarea_partido}` } }));
    expect(filasDeLaMuestra(enPortugues, muestra).map((una) => una.id)).toEqual(["a", "c", "d"]);
    // Una fila nueva que cumple también entra (Recalcular, con los datos de ese día).
    const conNueva = [...armadas, { id: "e", valores: { tarea_partido: "partido_oficial_torneo", jugador: "1", fecha: "2026-10-09" }, textos: {} }];
    expect(filasDeLaMuestra(conNueva, muestra).map((una) => una.id)).toEqual(["a", "c", "d", "e"]);
    // Sin filtros, todas.
    expect(filasDeLaMuestra(armadas, {}).map((una) => una.id)).toEqual(["a", "b", "c", "d"]);
    expect(muestraDeLosFiltros(armadas, {})).toEqual({});
  });

  test("la planilla guardada: lo elegido, cuántas filas y cuándo; lo que no se entiende queda afuera", () => {
    const cortes = { excelente: 1.5, muy_bueno: 1, regular: 0.75, malo: 1 };
    const planilla = armarPlanilla({
      muestra: { tarea_partido: ["tarea"] },
      eleccion: { d: { sentido: MENOS_ES_MEJOR, modo: MANUAL, cortes }, d_min: { sentido: MAS_ES_MEJOR, modo: AUTOMATICO, cortes }, tiempo: { sentido: "x", modo: "y" } },
      filas: 40,
      calculado: "2026-10-19",
    });
    // Los desvíos se guardan solo en Manual.
    expect(planilla).toEqual({
      version: 1,
      muestra: { tarea_partido: ["tarea"] },
      medidas: { d: { sentido: MENOS_ES_MEJOR, modo: MANUAL, cortes }, d_min: { sentido: MAS_ES_MEJOR, modo: AUTOMATICO }, tiempo: { sentido: MAS_ES_MEJOR, modo: AUTOMATICO } },
      filas: 40,
      calculado: "2026-10-19",
    });
    expect(leerPlanilla(planilla)).toEqual(planilla);
    expect(leerPlanilla(null)).toBeNull();
    expect(leerPlanilla([1])).toBeNull();
    expect(leerPlanilla({ muestra: { a: "x", b: [1] }, medidas: { d: 3, deficit: {} } })).toEqual({ version: 1, muestra: { b: [1] }, medidas: { deficit: { sentido: MENOS_ES_MEJOR, modo: AUTOMATICO } }, filas: null, calculado: null });
    // Desvíos que la planilla no ofrece: al más cercano que sí.
    expect(leerPlanilla({ medidas: { d: { modo: MANUAL, cortes: { excelente: 0.5, muy_bueno: 1, regular: 0.75, malo: 9 } } } }).medidas.d.cortes).toEqual({ excelente: 1.25, muy_bueno: 1, regular: 0.75, malo: 2 });
    // Para recalcular: solo las medidas elegidas (las que siguen estando), con lo elegido.
    const medidas = [columnaGps("d"), columnaGps("d_shi"), columnaGps("d_min")];
    expect(medidasDeLaPlanillaGuardada(leerPlanilla(planilla), medidas).map((columna) => columna.clave)).toEqual(["d", "d_min"]);
    expect(eleccionDeLaPlanilla(leerPlanilla(planilla), medidas)).toEqual({ d: { sentido: MENOS_ES_MEJOR, modo: MANUAL, cortes }, d_min: { sentido: MAS_ES_MEJOR, modo: AUTOMATICO } });
  });
});
