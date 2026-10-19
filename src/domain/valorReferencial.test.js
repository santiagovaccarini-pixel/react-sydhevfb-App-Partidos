import { describe, expect, test } from "vitest";
import {
  AUTOMATICO,
  CORTES_MANUALES,
  MANUAL,
  MAS_ES_MEJOR,
  MENOS_ES_MEJOR,
  calcularValorReferencial,
  cortesValidos,
  opcionesDeCorte,
  sinAtipicos,
  sumaCompleta,
  sumaDePorcentajes,
} from "./valorReferencial.js";

// Tres casos con datos inventados (nada del club), calculados también con la
// planilla del club recalculada: los números de abajo son los que da ella.
// Cada fila: [valor, % de la muestra, desvíos del corte] de Excelente, Muy
// bueno, Bueno, Regular y Malo.
const CASOS = {
  absolutaMasEsMejor: {
    datos: [
      5211.479, 5219.455, 5035.97, 4305.414, 4394.403, 5246.135, 5202.549, 5372.292, 4674.659, 5399.411, 4009.342, 4625.49, 4117.357, 5204.824, 6116.616, 4648.34, 4707.423, 4629.778,
      5739.895, 5548.066, 4627.848, 4959.498, 6548.675, 4202.977, 5100.14,
    ].map((valor) => ({ valor })),
    sentido: MAS_ES_MEJOR,
    relativa: false,
    usados: 24,
    promedio: 4929.14004167,
    desvio: 531.508112743,
    auto: [
      [5859.27923897, 0.0416666666667, 1.75],
      [5327.77112622, 0.166666666667, 0.75],
      [4929.14004167, 0.333333333333, null],
      [4264.75490074, 0.333333333333, 1.25],
      [4131.87787255, 0.125, 1.5],
    ],
    manual: [
      [5593.52518259, 0.0833333333333],
      [5460.64815441, 0.0416666666667],
      [4929.14004167, null],
      [4530.50895711, 0.25],
      [3999.00084437, 0.208333333333],
    ],
  },
  absolutaMenosEsMejor: {
    datos: [
      263.335, 295.551, 210.915, 254.919, 280.442, 206.161, 203.627, 184.6, 218.535, 288.829, 352.033, 282.358, 267.985, 226.826, 303.259, 259.25, 374.625, 292.694, 360.058, 322.315, 289.421,
      307.718, 227.125, 340.913, 276.19, 1059.094, 1034.656,
    ].map((valor) => ({ valor })),
    sentido: MENOS_ES_MEJOR,
    relativa: false,
    usados: 25,
    promedio: 275.58736,
    desvio: 51.44055264,
    auto: [
      [198.42653104, 0.04, 1.5],
      [211.2866692, 0.12, 1.25],
      [275.58736, 0.28, null],
      [314.16777448, 0.36, 0.75],
      [327.02791264, 0.2, 1],
    ],
    manual: [
      [211.2866692, 0.16],
      [224.14680736, 0.04],
      [275.58736, null],
      [314.16777448, 0.36],
      [365.60832712, 0.2],
    ],
  },
  relativaMasEsMejor: {
    datos: [
      [344947.795, 66.19],
      [197295.399, 37.8],
      [241323.6824, 47.92],
      [150345.0569, 34.92],
      [220862.6948, 50.26],
      [355373.1849, 67.74],
      [212576.1521, 40.86],
      [239550.5003, 44.59],
      [225599.0433, 48.26],
      [428767.2275, 79.41],
      [159692.0919, 39.83],
      [359030.5338, 77.62],
      [97334.3195, 23.64],
      [439131.0009, 84.37],
      [565542.3154, 92.46],
      [250917.3932, 53.98],
      [278255.7735, 59.11],
      [331723.5937, 71.65],
      [500576.2429, 87.21],
      [215819.7674, 38.9],
      [278503.8926, 60.18],
      [417788.1115, 84.24],
      [493377.1745, 75.34],
      [201154.4792, 47.86],
      [245724.7452, 48.18],
    ].map(([numerador, denominador]) => ({ numerador, denominador })),
    sentido: MAS_ES_MEJOR,
    relativa: true,
    usados: 24,
    promedio: 5015.81265366,
    desvio: 531.508112627,
    auto: [
      [5813.0748226, 0.0416666666667, 1.5],
      [5414.44373813, 0.0833333333333, 0.75],
      [5015.81265366, 0.375, null],
      [4351.42751287, 0.333333333333, 1.25],
      [4218.55048472, 0.166666666667, 1.5],
    ],
    manual: [
      [6078.82887891, 0.0416666666667],
      [5414.44373813, 0.0833333333333],
      [5015.81265366, null],
      [4484.30454103, 0.291666666667],
      [3952.7964284, 0.208333333333],
    ],
  },
};
const CATEGORIAS = ["excelente", "muy_bueno", "bueno", "regular", "malo"];
const cerca = (esperado) => (calculado) => expect(Math.abs(calculado - esperado)).toBeLessThanOrEqual(1e-8 * Math.max(1, Math.abs(esperado)));

describe("El valor referencial, con la lógica de la planilla del club", () => {
  Object.entries(CASOS).forEach(([nombre, caso]) => {
    test(`da lo mismo que la planilla (${nombre})`, () => {
      const auto = calcularValorReferencial(caso.datos, { sentido: caso.sentido, relativa: caso.relativa });
      const manual = calcularValorReferencial(caso.datos, { sentido: caso.sentido, relativa: caso.relativa, modo: MANUAL });
      expect(auto.usados).toBe(caso.usados);
      expect(auto.n).toBe(caso.datos.length);
      cerca(caso.promedio)(auto.promedio);
      cerca(caso.desvio)(auto.desvio);
      CATEGORIAS.forEach((categoria, i) => {
        const [valor, parte, desvios] = caso.auto[i];
        cerca(valor)(auto.valores[categoria]);
        cerca(parte)(auto.porcentajes[categoria]);
        if (desvios !== null) cerca(desvios)(auto.desvios[categoria]);
        const [valorManual, parteManual] = caso.manual[i];
        cerca(valorManual)(manual.valores[categoria]);
        // El % de Bueno del modo Manual, en la planilla, es el del Automático.
        if (parteManual !== null) cerca(parteManual)(manual.porcentajes[categoria]);
      });
    });
  });

  test("los % de las cinco suman toda la muestra; con «Menos es mejor», Excelente es lo más bajo", () => {
    Object.values(CASOS).forEach((caso) => {
      const r = calcularValorReferencial(caso.datos, { sentido: caso.sentido, relativa: caso.relativa });
      cerca(1)(CATEGORIAS.reduce((suma, categoria) => suma + r.porcentajes[categoria], 0));
      const v = r.valores;
      if (caso.sentido === MENOS_ES_MEJOR) expect(v.excelente < v.muy_bueno && v.muy_bueno < v.bueno && v.bueno < v.regular && v.regular < v.malo).toBe(true);
      else expect(v.excelente > v.muy_bueno && v.muy_bueno > v.bueno && v.bueno > v.regular && v.regular > v.malo).toBe(true);
    });
  });

  test("los atípicos: cuáles quedaron afuera (su lugar en los datos) y entre qué límites", () => {
    const caso = CASOS.absolutaMenosEsMejor;
    const r = calcularValorReferencial(caso.datos, { sentido: caso.sentido });
    expect(r.descartados).toBe(2);
    expect(r.atipicos.indices).toEqual([25, 26]);
    expect(r.atipicos.hasta).toBeLessThan(1034.656);
    expect(r.atipicos.desde).toBeLessThan(184.6);
    expect(r.veces).toBe(1.5);
    // Lo que no es un número no cuenta, pero los lugares siguen siendo los de los datos.
    const conHuecos = calcularValorReferencial([{ valor: null }, ...caso.datos, { valor: "x" }], { sentido: caso.sentido });
    expect(conHuecos.n).toBe(caso.datos.length);
    expect(conHuecos.atipicos.indices).toEqual([26, 27]);
  });

  test("sinAtipicos: con 1,5 veces el rango si así se descarta hasta el 10 %; si no, con 3", () => {
    const pocos = sinAtipicos([10, 11, 12, 13, 14, 15, 16, 17, 18, 100]);
    expect(pocos.veces).toBe(1.5);
    expect(pocos.quedan.filter((queda) => !queda)).toHaveLength(1);
    const muchos = sinAtipicos([10, 11, 12, 13, 14, 15, 16, 17, 40, 41]);
    expect(muchos.veces).toBe(3);
    expect(muchos.desde).toBeLessThan(10);
    expect(muchos.hasta).toBeGreaterThan(muchos.desde);
  });

  test("una relativa con promedio de 1 o menos no descarta nada (como la hoja de relativos)", () => {
    // El 3 sería atípico por los cuartiles, pero el promedio da 0,806.
    const datos = [0.2, 0.3, 0.25, 0.28, 3].map((numerador) => ({ numerador, denominador: 1 }));
    const r = calcularValorReferencial(datos, { relativa: true });
    expect(r.descartados).toBe(0);
    expect(r.atipicos).toEqual({ desde: null, hasta: null, indices: [] });
    // El Bueno es la suma de los numeradores sobre la de los denominadores.
    cerca((0.2 + 0.3 + 0.25 + 0.28 + 3) / 5)(r.promedio);
    expect(sinAtipicos(datos.map((dato) => dato.numerador)).quedan).toContain(false);
  });

  test("una absoluta con promedio de 1 o menos tampoco descarta nada (Santiago, 19/10)", () => {
    // El 3 sería atípico por los cuartiles, pero el promedio da 0,806.
    const valores = [0.2, 0.3, 0.25, 0.28, 3];
    expect(sinAtipicos(valores).quedan).toContain(false);
    const r = calcularValorReferencial(valores.map((valor) => ({ valor })));
    expect(r.descartados).toBe(0);
    expect(r.veces).toBeNull();
    expect(r.atipicos).toEqual({ desde: null, hasta: null, indices: [] });
    cerca(0.806)(r.promedio);
    // Exactamente 1, tampoco (como la hoja de relativos: «1 o menos»).
    const justo1 = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 5.5];
    expect(sinAtipicos(justo1).quedan).toContain(false);
    expect(calcularValorReferencial(justo1.map((valor) => ({ valor }))).descartados).toBe(0);
    // Con más de 1, sí: los cuartiles.
    expect(calcularValorReferencial([20, 30, 25, 28, 300].map((valor) => ({ valor }))).descartados).toBe(1);
  });

  test("el orden de los datos no cambia nada (los cuartiles, como CUARTIL de Excel)", () => {
    const ordenados = [100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 6000];
    const desordenados = [1500, 300, 6000, 100, 1000, 500, 200, 1200, 800, 400, 600];
    const a = calcularValorReferencial(ordenados.map((valor) => ({ valor })));
    const b = calcularValorReferencial(desordenados.map((valor) => ({ valor })));
    expect(b.valores).toEqual(a.valores);
    expect(b.porcentajes).toEqual(a.porcentajes);
    // Q1 350 y Q3 1100: de -775 a 2225; afuera, el 6000.
    expect([a.atipicos.desde, a.atipicos.hasta]).toEqual([-775, 2225]);
    expect([b.atipicos.desde, b.atipicos.hasta]).toEqual([-775, 2225]);
    expect(desordenados[b.atipicos.indices[0]]).toBe(6000);
    cerca(660)(a.promedio);
  });

  test("sin datos, con uno solo o sin variación no hay V.R.", () => {
    expect(calcularValorReferencial([])).toBeNull();
    expect(calcularValorReferencial([{ valor: 3 }])).toBeNull();
    expect(calcularValorReferencial([{ valor: 3 }, { valor: 3 }, { valor: 3 }])).toBeNull();
    expect(calcularValorReferencial([{ numerador: 3, denominador: 0 }], { relativa: true })).toBeNull();
  });

  test("Manual: los cortes fijos de la planilla (o los que se pasen), en desvíos desde el promedio", () => {
    const datos = CASOS.absolutaMasEsMejor.datos;
    const r = calcularValorReferencial(datos, { modo: MANUAL });
    cerca(r.promedio + CORTES_MANUALES.absoluta.excelente * r.desvio)(r.valores.excelente);
    cerca(r.promedio - CORTES_MANUALES.absoluta.malo * r.desvio)(r.valores.malo);
    const propios = calcularValorReferencial(datos, { modo: MANUAL, cortes: { excelente: 2, muy_bueno: 1, regular: 1, malo: 2 } });
    cerca(r.promedio + 2 * r.desvio)(propios.valores.excelente);
    cerca(r.promedio - r.desvio)(propios.valores.regular);
    expect(calcularValorReferencial(datos, { modo: AUTOMATICO }).valores).not.toEqual(r.valores);
  });

  test("Manual: los desvíos que ofrece la planilla (Excelente por encima de Muy bueno y Malo por encima de Regular, hasta 2)", () => {
    expect(opcionesDeCorte("muy_bueno")).toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]);
    expect(opcionesDeCorte("regular")).toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]);
    expect(opcionesDeCorte("excelente", { muy_bueno: 1.5 })).toEqual([1.75, 2]);
    expect(opcionesDeCorte("excelente", { muy_bueno: 1.75 })).toEqual([2]);
    expect(opcionesDeCorte("malo", { regular: 0.25 })).toEqual([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
    // Lo que no se ofrece pasa al más cercano que sí.
    expect(cortesValidos({ excelente: 1, muy_bueno: 1.5, regular: 0.75, malo: 3 })).toEqual({ excelente: 1.75, muy_bueno: 1.5, regular: 0.75, malo: 2 });
    expect(cortesValidos({ excelente: 1.3, muy_bueno: 0.9, regular: 0.1, malo: 0.6 })).toEqual({ excelente: 1.25, muy_bueno: 1, regular: 0.25, malo: 0.5 });
    // Lo de Automático siempre se puede elegir en Manual.
    Object.values(CASOS).forEach((caso) => {
      const auto = calcularValorReferencial(caso.datos, { sentido: caso.sentido, relativa: caso.relativa });
      expect(cortesValidos(auto.desvios)).toEqual(auto.desvios);
    });
  });

  test("la suma de los % de las cinco da 100 % con los desvíos que ofrece la planilla", () => {
    const datos = CASOS.absolutaMasEsMejor.datos;
    [0.25, 0.5, 1, 1.75].forEach((muyBueno) =>
      opcionesDeCorte("excelente", { muy_bueno: muyBueno }).forEach((excelente) => {
        const r = calcularValorReferencial(datos, { modo: MANUAL, cortes: { excelente, muy_bueno: muyBueno, regular: 0.75, malo: 1 } });
        expect(sumaCompleta(r)).toBe(true);
      }),
    );
    // Con cortes cruzados (que la pantalla no deja elegir), no da 100 %.
    const cruzados = calcularValorReferencial(datos, { modo: MANUAL, cortes: { excelente: 0.25, muy_bueno: 1.75, regular: 0.75, malo: 1 } });
    expect(sumaDePorcentajes(cruzados)).toBeGreaterThan(1);
    expect(sumaCompleta(cruzados)).toBe(false);
    expect(sumaCompleta(null)).toBe(false);
  });
});
