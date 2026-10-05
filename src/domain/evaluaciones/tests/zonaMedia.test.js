import { describe, expect, it } from "vitest";
import { calcularFilas, estadisticas, estilosDeFilas, estilosDeUnaFila, ordenDelExcel, quienEs } from "../motor.js";
import { COLORES, cssDeEstilo, estiloDeCelda, ordenarReglas, SIN_RELLENO, degrade, letraDeClase } from "../formatoCondicional.js";
import { categoriaDeTexto } from "../categorias.js";
import { ZONA_MEDIA, cortesDe } from "./zonaMedia.js";

// Todo inventado: valores de referencia y evaluaciones de prueba (nada del
// Excel del club).
const t = (minutos, segundos) => minutos * 60 + segundos;
const dias = (minutos, segundos) => t(minutos, segundos) / 1440;

const bloque = (cortes) => ({
  n: { lumbar: 20, lateral_d: 20, lateral_i: 20, def_lat: 20, prono: 20, ratio: 20 },
  ...cortes,
});
const REFERENCIAS = {
  categorias: {
    mayor: bloque({
      excelente: { lumbar: dias(4, 0), lateral_d: dias(2, 30), lateral_i: dias(2, 30), def_lat: 4, prono: dias(3, 30), ratio: 1.4 },
      muy_bueno: { lumbar: dias(3, 30), lateral_d: dias(2, 10), lateral_i: dias(2, 10), def_lat: 9, prono: dias(3, 0), ratio: 1.2 },
      bueno: { lumbar: dias(3, 0), lateral_d: dias(1, 50), lateral_i: dias(1, 50), def_lat: 15, prono: dias(2, 30), ratio: 1 },
      regular: { lumbar: dias(2, 30), lateral_d: dias(1, 30), lateral_i: dias(1, 30), def_lat: 21, prono: dias(1, 40), ratio: 0.8 },
      malo: { lumbar: dias(2, 0), lateral_d: dias(1, 10), lateral_i: dias(1, 10), def_lat: 28, prono: dias(1, 10), ratio: 0.6 },
    }),
  },
};

let orden = 0;
const evaluacion = ({ persona = "Ana Prueba", jugador_id = null, fecha = "2026-06-12", ...datos }) => {
  orden += 1;
  return { id: `e${orden}`, orden, fecha, jugador_id, persona: jugador_id ? null : persona, datos: { seleccion: "mayor", ...datos } };
};

const calcular = (filas, referencias = REFERENCIAS) => calcularFilas(ZONA_MEDIA, filas, referencias);
const celdasDe = (resultado, id) => resultado.find((uno) => uno.fila.id === id).celdas;

describe("Zona Media: cada fila, como el Excel", () => {
  it("las clases contra los V.R. de su categoría, el déficit, el ratio y PRO??", () => {
    const fila = evaluacion({ lumbar: t(3, 30), lateral_d: t(2, 0), lateral_i: t(1, 40), prono: t(3, 0) });
    const celdas = celdasDe(calcular([fila]), fila.id);
    expect(celdas.numero).toBe(1);
    // Justo en el corte de Muy Bueno: 4.
    expect(celdas.lumbar_clas).toBe(4);
    expect(celdas.lateral_d_clas).toBe(3);
    expect(celdas.lateral_i_clas).toBe(2);
    expect(celdas.prono_clas).toBe(4);
    // El déficit: (I − D) / el menor × 100, sin signo (la "A" del Excel, que no
    // se muestra, es lo mismo con signo); "menos es mejor".
    expect(celdas.deficit).toBeCloseTo(20, 10);
    expect(celdas).not.toHaveProperty("asimetria");
    // 20 %: entre Bueno (15) y Regular (21), "menos es mejor": 2.
    expect(celdas.deficit_clas).toBe(2);
    expect(celdas.ratio).toBeCloseTo(180 / 210, 12);
    // Entre Regular y Muy Bueno: lo mejor para el ratio (3).
    expect(celdas.ratio_clas).toBe(3);
    expect(celdas.pro).toBe(3.25);
    expect(celdas.va).toBe(1);
    // Sin evaluación anterior, no hay % mejora.
    expect(celdas.lumbar_mejora).toBe("");
  });

  it("% mejora contra la evaluación anterior que tenga esa medida, sin límite de cuántas atrás", () => {
    const primera = evaluacion({ fecha: "2026-06-01", lumbar: t(3, 30), lateral_d: t(2, 0), lateral_i: t(1, 40), prono: t(3, 0) });
    const segunda = evaluacion({ fecha: "2026-07-01", lumbar: t(3, 51), lateral_i: t(1, 50) });
    const tercera = evaluacion({ fecha: "2026-08-01", lateral_d: t(2, 12) });
    const cuarta = evaluacion({ fecha: "2026-09-01", prono: t(2, 42) });
    const resultado = calcular([cuarta, tercera, segunda, primera]);
    expect(celdasDe(resultado, segunda.id).lumbar_mejora).toBeCloseTo(231 / 210 - 1, 12);
    expect(celdasDe(resultado, segunda.id).lateral_i_mejora).toBeCloseTo(0.1, 12);
    // Lateral D no se midió en la segunda: compara con la primera.
    expect(celdasDe(resultado, tercera.id).lateral_d_mejora).toBeCloseTo(0.1, 12);
    // Prono, tres evaluaciones atrás.
    expect(celdasDe(resultado, cuarta.id).prono_mejora).toBeCloseTo(-0.1, 12);
    // Sin la medida en la fila, nada.
    expect(celdasDe(resultado, tercera.id).lumbar_mejora).toBe("");
    expect(resultado.map((uno) => uno.celdas.numero)).toEqual([1, 2, 3, 4]);
  });

  it("sin uno de los laterales no hay déficit ni su clase; sin Prono no hay ratio", () => {
    const fila = evaluacion({ lumbar: t(3, 0), lateral_i: t(1, 50) });
    const celdas = celdasDe(calcular([fila]), fila.id);
    expect(celdas.deficit).toBe("");
    expect(celdas.deficit_clas).toBe("");
    expect(celdas.ratio).toBe("");
    expect(celdas.ratio_clas).toBe("");
    expect(celdas.lateral_d_clas).toBe("");
    // PRO?? promedia las clases que hay (Lumbar 3, Lateral I 3).
    expect(celdas.pro).toBe(3);
  });

  it("sin selección, sin V.R. o con una selección fuera de la lista", () => {
    const sinSeleccion = evaluacion({ seleccion: null, lumbar: t(3, 0) });
    expect(celdasDe(calcular([sinSeleccion]), sinSeleccion.id).lumbar_clas).toBe("");
    const fila = evaluacion({ lumbar: t(3, 0) });
    expect(celdasDe(calcular([fila], null), fila.id).lumbar_clas).toBe("");
    expect(celdasDe(calcular([fila], { categorias: {} }), fila.id).pro).toBe("");
    // Otra categoría (Sub-20) sin su bloque: vacía.
    const sub20 = evaluacion({ seleccion: "sub20", lumbar: t(3, 0) });
    expect(celdasDe(calcular([sub20]), sub20.id).lumbar_clas).toBe("");
    // Una que no es de la lista: FALSO, como en el Excel.
    const rara = evaluacion({ seleccion: "sub21", lumbar: t(3, 0) });
    expect(celdasDe(calcular([rara]), rara.id).lumbar_clas).toBe(false);
  });

  it("Va: con más de 7 evaluaciones, las últimas 7 van de 1 a 7", () => {
    const filas = Array.from({ length: 9 }, (_, i) => evaluacion({ fecha: `2026-0${(i % 9) + 1}-15`, lumbar: t(3, i) }));
    expect(calcular(filas).map((uno) => uno.celdas.va)).toEqual(["", "", 1, 2, 3, 4, 5, 6, 7]);
  });

  it("el orden es por fecha (y, el mismo día, por carga); cada uno se cuenta aparte", () => {
    const ana1 = evaluacion({ fecha: "2026-08-01", lumbar: t(3, 0) });
    const otra = evaluacion({ persona: "Bea Prueba", fecha: "2026-05-01", lumbar: t(3, 0) });
    const ana2 = evaluacion({ persona: "  ana   PRUEBA ", fecha: "2026-05-01", lumbar: t(3, 0) });
    const sinFecha = evaluacion({ fecha: null, lumbar: t(3, 0) });
    const resultado = calcular([sinFecha, ana1, otra, ana2]);
    expect(resultado.map((uno) => uno.fila.id)).toEqual([otra.id, ana2.id, ana1.id, sinFecha.id]);
    expect(resultado.map((uno) => uno.celdas.numero)).toEqual([1, 1, 2, 3]);
    expect(quienEs({ persona: " Ana  Prueba" })).toBe(quienEs({ persona: "ana prueba" }));
    expect(quienEs({ jugador_id: 7, persona: null })).toBe("j:7");
    expect(ordenDelExcel([{ fecha: "2026-01-02", orden: 1 }, { fecha: "2026-01-02", orden: 0 }]).map((fila) => fila.orden)).toEqual([0, 1]);
  });

  it("lee los cortes de una categoría solo si están todos", () => {
    expect(cortesDe(REFERENCIAS, "mayor", "ratio")).toEqual([1.4, 1.2, 1, 0.8, 0.6]);
    expect(cortesDe(REFERENCIAS, "sub15", "ratio")).toBe(null);
    expect(cortesDe({ categorias: { mayor: { excelente: { ratio: 1 } } } }, "mayor", "ratio")).toBe(null);
    expect(categoriaDeTexto("Sub 15")).toBe("sub15");
    expect(categoriaDeTexto("Profissional")).toBe("mayor");
    expect(categoriaDeTexto("")).toBe(null);
    expect(categoriaDeTexto("Reserva")).toBe(undefined);
  });
});

describe("Zona Media: el informe con las filas que se ven", () => {
  const filas = [
    evaluacion({ persona: "Uno", lumbar: t(3, 0), lateral_d: t(2, 0), lateral_i: t(2, 0), prono: t(2, 30) }),
    evaluacion({ persona: "Dos", lumbar: t(3, 30), lateral_d: t(1, 40), lateral_i: t(2, 0), prono: t(3, 0) }),
    evaluacion({ persona: "Tres", lumbar: t(4, 0), lateral_d: t(2, 0), lateral_i: t(1, 40), prono: t(3, 30) }),
  ];
  const calculadas = calcular(filas);
  const est = estadisticas(ZONA_MEDIA.columnasDelInforme, calculadas.map((uno) => uno.celdas));
  const informe = ZONA_MEDIA.informe({ est, referencias: REFERENCIAS, comparar: "mayor" });
  const fila = (id) => informe.find((una) => una.id === id).celdas;

  it("promedio, desvío, n, máximo y mínimo; sin números en una columna, vacíos (y n en 0)", () => {
    expect(fila("promedios").lumbar.valor).toBeCloseTo(dias(3, 30), 15);
    expect(fila("promedios").lumbar.formato).toBe("tiempo");
    expect(fila("desvios").lumbar.valor).toBeCloseTo(dias(0, 30), 12);
    expect(fila("n").numero.valor).toBe(3);
    expect(fila("maximo").lumbar.valor).toBe(dias(4, 0));
    expect(fila("minimo").lumbar.valor).toBe(dias(3, 0));
    expect(fila("promedios").lumbar_mejora.valor).toBe("");
    expect(fila("maximo").lumbar_mejora.valor).toBe("");
    expect(fila("n").lumbar_mejora.valor).toBe(0);
    expect(fila("maximo").prono_mejora.formato).toBe("0%");
  });

  it("la comparación con el Bueno de la categoría elegida, con su clase", () => {
    expect(fila("referencia").lumbar.valor).toBe(dias(3, 0));
    expect(fila("comparacion").lumbar.valor).toBeCloseTo(210 / 180, 12);
    expect(fila("comparacion").lumbar_clas.valor).toBe(4);
    // El ratio del informe, con la misma regla que el de las filas.
    expect(fila("comparacion").ratio_clas.valor).toBe(3);
    // AC3: Prono / Lumbar de los promedios.
    expect(fila("referencia").pro.valor).toBeCloseTo(180 / 210, 12);
    // Sin V.R., la comparación queda vacía.
    const sinReferencias = ZONA_MEDIA.informe({ est, referencias: null, comparar: "mayor" });
    expect(sinReferencias[0].celdas.lumbar.valor).toBe("");
    expect(sinReferencias[0].celdas.lumbar_clas.valor).toBe("");
  });

  it("los colores: los tiempos contra su promedio y su desvío, las clases con su color, lo vacío sin nada", () => {
    const estilos = estilosDeFilas(ZONA_MEDIA.reglas, calculadas.map((uno) => ({ id: uno.fila.id, celdas: uno.celdas })), est);
    const degradeDe = (color) => ({ background: `linear-gradient(90deg, #FFFFFF, ${color})` });
    // Lumbar 3:00 / 3:30 / 4:00: promedio 3:30 y desvío 0:30.
    expect(estilos[filas[0].id].lumbar).toEqual(degradeDe(COLORES.naranja));
    expect(estilos[filas[1].id].lumbar).toEqual(degradeDe(COLORES.amarillo));
    expect(estilos[filas[2].id].lumbar).toEqual(degradeDe(COLORES.verde));
    // La clase 4 de Lumbar (3:30): en negrita verde sobre gris.
    expect(estilos[filas[1].id].lumbar_clas).toEqual({ background: COLORES.gris, color: COLORES.verde, fontWeight: 700 });
    // El % mejora no tiene reglas.
    expect(estilos[filas[1].id].lumbar_mejora).toBeUndefined();
    // La fila 2 del informe: cada porcentaje con el color de su clase.
    const fila2 = Object.fromEntries(Object.entries(fila("comparacion")).map(([clave, celda]) => [clave, celda.valor]));
    expect(estilosDeUnaFila(ZONA_MEDIA.reglasDelInforme, fila2).lumbar).toEqual(degradeDe(COLORES.verde));
  });

  it("con una sola fila a la vista no hay desvío: solo pinta lo que no lo necesita", () => {
    const una = calcular([filas[0]]);
    const estUna = estadisticas(ZONA_MEDIA.columnasDelInforme, una.map((uno) => uno.celdas));
    const estilos = estilosDeFilas(ZONA_MEDIA.reglas, una.map((uno) => ({ id: uno.fila.id, celdas: uno.celdas })), estUna);
    // Como en el Excel: igual al promedio, amarillo.
    expect(estilos[filas[0].id].lumbar).toEqual({ background: `linear-gradient(90deg, #FFFFFF, ${COLORES.amarillo})` });
  });
});

describe("formato condicional: cómo se combinan las reglas", () => {
  const reglas = ordenarReglas([
    { prioridad: 3, columnas: ["a"], cumple: () => true, estilo: letraDeClase(COLORES.rojo) },
    { prioridad: 1, columnas: ["a"], cumple: ({ valor }) => valor === "", estilo: SIN_RELLENO },
    { prioridad: 2, columnas: ["a", "b"], cumple: () => true, estilo: degrade(COLORES.amarillo), detener: true },
    { prioridad: 4, columnas: ["b"], cumple: () => true, estilo: degrade(COLORES.rojo) },
  ]);

  it("para cada cosa gana la regla de más prioridad que se cumple; 'sin relleno' también", () => {
    expect(estiloDeCelda(reglas, "a", { valor: "" })).toEqual({ relleno: { tipo: "ninguno" } });
    expect(cssDeEstilo(estiloDeCelda(reglas, "a", { valor: "" }))).toBe(null);
    expect(estiloDeCelda(reglas, "a", { valor: 3 })).toEqual({ relleno: { tipo: "degradado", color: COLORES.amarillo } });
  });

  it("'detener si es verdad' corta las de menos prioridad", () => {
    expect(estiloDeCelda(reglas, "b", { valor: 3 })).toEqual({ relleno: { tipo: "degradado", color: COLORES.amarillo } });
  });

  it("una regla que da error no pinta", () => {
    const conError = [{ prioridad: 1, columnas: ["a"], cumple: () => ({ error: "#DIV/0!" }), estilo: degrade(COLORES.rojo) }];
    expect(estiloDeCelda(conError, "a", { valor: 1 })).toEqual({});
  });
});
