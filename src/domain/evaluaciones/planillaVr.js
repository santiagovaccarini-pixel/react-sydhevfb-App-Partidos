// Evaluaciones › Valores de referencia › «Calcular con la planilla» (nota 3
// de la planilla de valor referencial; Santiago, 19/10, en cuestionarios:
// «Un botón arriba», la muestra con «Las de esa Selección», las relativas
// «En ves de tiempo se divide por peso» y que llene todo el bloque: «Eso se
// usa para ver el vr, lo que vos decis es mi seleccion»). La cuenta es la de
// GPS (domain/gps/planillaVr.js y domain/valorReferencial.js), con las filas
// del test como las calcula la Base (sus celdas, en la unidad de los V.R.:
// los tiempos, en la del Excel). El resultado va al bloque de la categoría:
// n (los datos usados), el desvío de la muestra, los cinco cortes y, en los
// déficits, «DE» (los desvíos de cada corte); con qué se calculó, en
// `planilla` del bloque, para «Recalcular». Sin Promedio: es el Bueno
// (Santiago, 19/10: «Agrega estos datos para todos los vr que hagamos de aca
// en adelante: Cantidad de datos utilizados en cada variable. Desvio de la
// muestra y saca esa fila de promedio que esta de mas»).

import { CATEGORIAS_CON_CORTE } from "../valorReferencial.js";
import { textoDeValor } from "./excel.js";

const CATEGORIAS = ["excelente", "muy_bueno", "bueno", "regular", "malo"];
const esObjeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);

// Las tablas de V.R. de un test (una sola si no tiene varias).
export const tablasDeReferencia = (test) => test.tablasDeReferencia || [{ id: "", titulo: null, metricas: test.metricas }];

// Las medidas que se pueden calcular: las de las tablas de V.R., en su
// orden y sin repetir, sin las «DE» de los déficits (no son datos: se llenan
// con los desvíos elegidos). Cada una, con el título de su tabla si el test
// tiene varias.
export const medidasDeEvaluaciones = (test) => {
  const tablas = tablasDeReferencia(test);
  const todas = tablas.flatMap((tabla) => tabla.metricas.map((metrica) => ({ ...metrica, tituloDeTabla: tablas.length > 1 ? tabla.titulo || null : null })));
  const claves = new Set(todas.map((metrica) => metrica.clave));
  const vistas = new Set();
  return todas.filter((metrica) => {
    if (vistas.has(metrica.clave)) return false;
    vistas.add(metrica.clave);
    return !esColumnaDe(metrica.clave, claves);
  });
};
const esColumnaDe = (clave, claves) => clave.endsWith("_de") && claves.has(clave.slice(0, -3));

// La relativa de una medida (por peso: la fuerza ÷ el P.C.), si es una.
const relativaDe = (test, clave) => (test.columnas || []).find((columna) => columna.clave === clave)?.relativa || null;

// Lo propio de Evaluaciones para la planilla (ver PlanillaVr.jsx): la fila
// armada de la Base trae sus celdas; las relativas, el numerador y el peso.
export const calculoDeEvaluaciones = (test, idioma = "es-AR") => ({
  crudaDe: (fila) => fila,
  jugadorDe: (fila) => fila?.valores?.jugador || null,
  datoDe: (metrica, fila) => {
    const celdas = fila?.celdas || {};
    const relativa = relativaDe(test, metrica.clave);
    if (relativa) return { numerador: celdas[relativa.de], denominador: celdas.pc };
    return { valor: celdas[metrica.clave] };
  },
  esRelativa: (metrica) => Boolean(relativaDe(test, metrica.clave)),
  esTiempo: (metrica) => metrica.formato === "tiempo",
  // Con 2 decimales; los porcentajes, como porcentaje.
  textoDelNumero: (metrica, valor, todos) => {
    if (/%$/.test(metrica.formato || "")) return todos ? `${textoDeValor(valor * 100, "General", idioma)}%` : textoDeValor(valor, "0.00%", idioma);
    return textoDeValor(valor, todos ? "General" : "0.00", idioma);
  },
  sinDenominador: "evaluaciones.referencias.planilla.sinPeso",
});

// Las filas de un bloque calculado con la planilla: n, Desvío y las cinco,
// con los títulos del test (o los de siempre, si el test no tiene esa fila).
const FILAS_DE_LA_PLANILLA = ["n", "desvio", ...CATEGORIAS];
const TITULOS = {
  n: { "es-AR": "n", "pt-BR": "n" },
  desvio: { "es-AR": "Desv. Estándar", "pt-BR": "Desvio padrão" },
};
export const filasDeLaPlanilla = (test, tabla = null) => {
  const delTest = tabla?.filas || test.filasDeReferencia || [];
  return FILAS_DE_LA_PLANILLA.map((clave) => delTest.find((fila) => fila.clave === clave) || { clave, titulo: TITULOS[clave], ...(clave === "n" ? { formato: "General" } : {}) });
};

// El bloque de la categoría con lo calculado: sobre el de antes (las medidas
// que no se calcularon y los títulos quedan como estaban), los números de
// cada medida calculada y `planilla`.
export const bloqueDeLaPlanilla = ({ anterior, calculos, planilla, test }) => {
  const claves = new Set(tablasDeReferencia(test).flatMap((tabla) => tabla.metricas.map((metrica) => metrica.clave)));
  const bloque = esObjeto(anterior) ? JSON.parse(JSON.stringify(anterior)) : {};
  const poner = (fila, clave, valor) => {
    if (!esObjeto(bloque[fila])) bloque[fila] = {};
    bloque[fila][clave] = valor;
  };
  Object.entries(calculos || {}).forEach(([clave, { resultado }]) => {
    if (!resultado) return;
    poner("n", clave, resultado.usados);
    poner("desvio", clave, resultado.desvio);
    CATEGORIAS.forEach((categoria) => poner(categoria, clave, resultado.valores[categoria]));
    // Sin Promedio (es el Bueno): lo de antes de esa medida se va.
    if (esObjeto(bloque.promedio)) {
      delete bloque.promedio[clave];
      if (!Object.keys(bloque.promedio).length) delete bloque.promedio;
    }
    // «DE»: los desvíos de cada corte (el Bueno es el promedio).
    const de = `${clave}_de`;
    if (claves.has(de)) CATEGORIAS_CON_CORTE.forEach((categoria) => poner(categoria, de, resultado.desvios[categoria]));
  });
  bloque.planilla = planilla;
  return bloque;
};

// Los filtros con que arranca la muestra de una categoría: su Selección
// (Santiago, 19/10: «Las de esa Selección»), con el texto que muestran las
// filas.
export const filtrosDeLaCategoria = (filas, categoria, etiqueta) => {
  const textos = [...new Set(filas.filter((fila) => fila.valores?.seleccion === categoria).map((fila) => fila.textos?.seleccion).filter(Boolean))];
  return { seleccion: textos.length ? textos : [etiqueta || categoria] };
};
