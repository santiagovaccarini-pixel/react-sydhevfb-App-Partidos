import { categoriaPorCodigo } from "../categorias.js";
import { claseMas, cortesDe } from "../clases.js";
import { dividir, esBlanco, esError, esVacio, igual, mayorIgual, menor, multiplicar, restar, siError, sumar } from "../excel.js";
import { COLORES, COLOR_DE_CLASE, SIN_RELLENO, degrade, estiloDeClase, masDesvios } from "../formatoCondicional.js";

// Press Plano: la hoja "Press Plano informe" del Excel BD_evaluaciones (su
// título dice «Pecho Plano»), entera en un solo lugar. Una fila por
// evaluación, con el peso del día (P.C.), las repeticiones (Rep) y los Kg
// levantados. Se calculan el RM (Kg × (1 + 0,029 × Rep)), las cargas al 40 %,
// 50 %, 60 %, 70 % y 80 % del RM, la relación con el peso (Rel), la clase y el
// % de mejora de cada uno, y Va?. Lo que decidió Santiago el 10/10
// (docs/PENDIENTES.md, "Evaluaciones"):
//   · Sin Rep, el RM es el Kg levantado, como en el Excel («esas vacías son
//     1»: un intento de máximo).
//   · El bloque oculto «CARGA 1» a «CARGA 5» (cargas sugeridas, fuera de la
//     tabla) queda afuera.
//   · La fila «Vs …» compara el RM y la Rel, cada uno con su clase; la celda
//     que clasificaba el % mejora contra los V.R. de Rel, no.

const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });

const ID = "press_plano";

// Lo que se carga: el peso del día, las repeticiones y los Kg.
export const NUMEROS = Object.freeze(["pc", "rep", "kg"]);

// Las cargas sobre el RM (K a O del Excel): su título es el número de la
// fila 10 (0,4 … 0,8), que multiplica al RM.
const CARGAS = Object.freeze([
  { clave: "rm_40", factor: 0.4, titulo: "0,4" },
  { clave: "rm_50", factor: 0.5, titulo: "0,5" },
  { clave: "rm_60", factor: 0.6, titulo: "0,6" },
  { clave: "rm_70", factor: 0.7, titulo: "0,7" },
  { clave: "rm_80", factor: 0.8, titulo: "0,8" },
]);

// ---------------------------------------------------------- Las columnas --
// Los nombres, los de la fila 10 del Excel, en su orden. Posición no va: no
// se usa (Santiago, 05/10); la Fecha Nac. sale de Datos básicos. El peso va en
// el primer paso de la carga.
export const COLUMNAS = Object.freeze([
  { clave: "numero", titulo: et("nº Eva", "nº Aval."), tipo: "calculado", formato: "General", fija: true, ancho: 96 },
  { clave: "fecha", titulo: et("Fecha", "Data"), tipo: "fecha", fija: true, ancho: 140 },
  { clave: "jugador", titulo: et("Jugador", "Jogador"), tipo: "jugador", fija: true, ancho: 168 },
  { clave: "seleccion", titulo: et("Seleccion", "Seleção"), tipo: "lista", fija: true, ancho: 120 },
  { clave: "fecha_nac", titulo: et("Fecha Nac", "Data Nasc."), tipo: "dato_jugador", fija: true, ancho: 120 },
  { clave: "pc", titulo: et("P.C.", "P.C."), tipo: "numero", formato: "0.0", enPrimerPaso: true },
  ...CARGAS.map(({ clave, titulo }) => ({ clave, titulo: et(titulo, titulo), tipo: "calculado", formato: "0" })),
  { clave: "rep", titulo: et("Rep", "Rep"), tipo: "numero", formato: "General" },
  { clave: "rm", titulo: et("RM", "RM"), tipo: "calculado", formato: "0" },
  { clave: "rm_clas", titulo: et("Clas. RM", "Clas. RM"), tipo: "calculado", formato: "0" },
  { clave: "rm_mejora", titulo: et("% mejora", "% melhora"), tipo: "calculado", formato: "0.0%" },
  { clave: "kg", titulo: et("Kg", "Kg"), tipo: "numero", formato: "General" },
  { clave: "rel", titulo: et("Rel", "Rel"), tipo: "calculado", formato: "0.00" },
  { clave: "rel_clas", titulo: et("Clas. Grupo (Rel)", "Clas. Grupo (Rel)"), tipo: "calculado", formato: "General" },
  { clave: "rel_mejora", titulo: et("% mejora", "% melhora"), tipo: "calculado", formato: "0.0%" },
  { clave: "va", titulo: et("Va?", "Va?"), tipo: "calculado", formato: "General" },
  { clave: "nota", titulo: et("Nota", "Nota"), tipo: "texto" },
]);

// ---------------------------------------------------------- Las cuentas --

// Lo cargado de una fila, como lo cuenta el Excel.
const entrada = (fila) => {
  const datos = fila?.datos || {};
  const numero = (clave) => (typeof datos[clave] === "number" && Number.isFinite(datos[clave]) ? datos[clave] : null);
  return {
    fecha: fila?.fecha || null,
    seleccion: datos.seleccion || null,
    ...Object.fromEntries(NUMEROS.map((clave) => [clave, numero(clave)])),
  };
};

// La clase de una fila contra los V.R. de su categoría (como en todos los
// tests). Sin valor, sin categoría o sin V.R. de esa categoría, vacía.
const claseDeFila = ({ seleccion, valor, referencias, metrica, esCategoria }) => {
  if (esVacio(valor) || esBlanco(seleccion) || !esCategoria(seleccion)) return "";
  const cortes = cortesDe(referencias, seleccion, metrica);
  return cortes ? siError(claseMas(valor, cortes), "") : "";
};

const calcularFila = ({ entrada: e, numero, total, anterior, referencias, esCategoria = (codigo) => Boolean(categoriaPorCodigo(codigo)) }) => {
  // RM: IF(((Rep*0.029)+1)*(Kg)=0,"",((Rep*0.029)+1)*(Kg)). Sin Rep, el Kg.
  const producto = multiplicar(sumar(multiplicar(e.rep, 0.029), 1), e.kg);
  const rm = igual(producto, 0) === true ? "" : siError(producto, "");
  // Rel: IFERROR(RM / P.C., ""). Sin peso, vacía.
  const rel = esBlanco(e.pc) ? "" : siError(dividir(rm, e.pc), "");
  // % mejora: contra la evaluación anterior del jugador que tenga el dato,
  // sin límite de cuántas atrás (como en todos los tests; el Excel miraba
  // hasta tres atrás por su n°). IFERROR(actual / anterior − 1, "").
  const mejora = (actual, clave) => {
    if (esVacio(actual)) return "";
    const previa = anterior(clave);
    if (esVacio(previa)) return "";
    return siError(restar(dividir(actual, previa), 1), "");
  };
  // Va?: con 7 o menos evaluaciones, el n°; si no, las últimas 7 van de 1 a
  // 7 (7 la más nueva) y las anteriores, nada (como el «Va» de Zona Media).
  const atras = total - numero;
  let va = "";
  if (total <= 7) va = numero;
  else if (atras >= 0 && atras <= 6) va = 7 - atras;
  return {
    numero,
    ...Object.fromEntries(CARGAS.map(({ clave, factor }) => [clave, siError(multiplicar(rm, factor), "")])),
    rm,
    rm_clas: claseDeFila({ seleccion: e.seleccion, valor: rm, referencias, metrica: "rm", esCategoria }),
    rm_mejora: mejora(rm, "rm"),
    rel,
    rel_clas: claseDeFila({ seleccion: e.seleccion, valor: rel, referencias, metrica: "rel", esCategoria }),
    rel_mejora: mejora(rel, "rel"),
    va,
  };
};

// ---------------------------------------------------------- El informe --
// Arriba, la comparación con los V.R. de la categoría elegida («Vs …»): el
// promedio del RM y de la Rel sobre el "Bueno", con la clase del promedio
// (como en Zona Media; la celda que clasificaba el % mejora contra los V.R. de
// Rel salió: Santiago, 10/10). Después, las filas 4 a 8 del Excel con las
// filas que se ven: Promedios, Desvíos, nº, Máximo y Mínimo, con los formatos
// del Excel.

const COLUMNAS_DEL_INFORME = Object.freeze(["numero", "pc", ...CARGAS.map(({ clave }) => clave), "rep", "rm", "rm_clas", "rm_mejora", "kg", "rel", "rel_clas", "rel_mejora"]);

const PORCENTAJE_ENTERO = ["rm_mejora", "rel_mejora"];
const formatoDe = (clave, campo) => {
  if (campo === "n") return "General";
  if (campo === "promedio" || campo === "desvio") return "0.00";
  return PORCENTAJE_ENTERO.includes(clave) ? "0%" : "General";
};

// Sin ningún número en la columna, vacío (Santiago, 05/10: el Excel mostraba
// #DIV/0! y 0).
const filaDeEstadistica = (est, campo) =>
  Object.fromEntries(
    COLUMNAS_DEL_INFORME.filter((clave) => campo === "n" || clave !== "numero").map((clave) => {
      const valor = est[clave].n === 0 && campo !== "n" ? "" : est[clave][campo];
      return [clave, { valor, formato: formatoDe(clave, campo) }];
    }),
  );

const COMPARADAS = Object.freeze([
  { clave: "rm", clase: "rm_clas" },
  { clave: "rel", clase: "rel_clas" },
]);

const informe = ({ est, referencias, comparar }) => {
  const comparacion = {};
  const referencia = {};
  COMPARADAS.forEach(({ clave, clase }) => {
    const cortes = cortesDe(referencias, comparar, clave);
    const bueno = cortes ? cortes[2] : "";
    referencia[clave] = { valor: bueno, formato: "0.00" };
    comparacion[clave] = { valor: siError(dividir(est[clave].promedio, bueno), ""), formato: "0.0%" };
    comparacion[clase] = { valor: cortes ? siError(claseMas(est[clave].promedio, cortes), "") : "", formato: "0" };
  });
  return [
    { id: "comparacion", celdas: comparacion },
    { id: "referencia", celdas: referencia },
    { id: "promedios", rotulo: et("Promedios", "Médias"), celdas: filaDeEstadistica(est, "promedio") },
    { id: "desvios", rotulo: et("Desvíos", "Desvios"), celdas: filaDeEstadistica(est, "desvio") },
    { id: "n", rotulo: et("nº", "nº"), celdas: filaDeEstadistica(est, "n") },
    { id: "maximo", rotulo: et("Máximo", "Máximo"), celdas: filaDeEstadistica(est, "maximo") },
    { id: "minimo", rotulo: et("Mínimo", "Mínimo"), celdas: filaDeEstadistica(est, "minimo") },
  ];
};

// ------------------------------------------------ Formato condicional --
// Las reglas del Excel, con su prioridad. μ y σ: el promedio y el desvío de
// la columna con las filas que se ven. Los colores, los de toda la app.

const CLASES = ["rm_clas", "rel_clas"];
const o = (...valores) => valores.find(esError) || valores.some(Boolean);
const MEDIDAS = ["rm", "rel"];
const mas = (ctx, k) => masDesvios(ctx.promedio, ctx.desvio, k);

export const REGLAS = Object.freeze([
  // Las celdas vacías no se pintan.
  { prioridad: 7, columnas: [...MEDIDAS, ...CLASES], cumple: ({ valor }) => esVacio(valor), estilo: SIN_RELLENO },
  // El RM y la Rel: más es mejor, contra μ y σ.
  { prioridad: 8, columnas: MEDIDAS, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, 2)), estilo: degrade(COLORES.verdeOscuro) },
  { prioridad: 9, columnas: MEDIDAS, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, 1)), estilo: degrade(COLORES.verde) },
  { prioridad: 10, columnas: MEDIDAS, cumple: (ctx) => mayorIgual(ctx.valor, ctx.promedio), estilo: degrade(COLORES.amarillo) },
  { prioridad: 11, columnas: MEDIDAS, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, -1)), estilo: degrade(COLORES.naranja) },
  { prioridad: 12, columnas: MEDIDAS, cumple: (ctx) => menor(ctx.valor, mas(ctx, -1)), estilo: degrade(COLORES.rojo) },
  // Las clases: el número del color de su clase, sobre gris (igual en toda la app).
  ...[5, 4, 3, 2, 1].map((clase, i) => ({ prioridad: 13 + i, columnas: CLASES, cumple: ({ valor }) => igual(valor, clase), estilo: estiloDeClase(clase) })),
]);

// La fila de la comparación: cada porcentaje con el color de la clase de al
// lado, en degradé (como en Zona Media).
const CLASE_DE = Object.fromEntries(COMPARADAS.map(({ clave, clase }) => [clave, clase]));
const PORCENTAJES = COMPARADAS.map(({ clave }) => clave);
export const REGLAS_DEL_INFORME = Object.freeze([
  { prioridad: 1, columnas: PORCENTAJES, cumple: ({ valor, clave, celda }) => o(igual(valor, ""), igual(celda(CLASE_DE[clave]), "")), estilo: SIN_RELLENO },
  ...[5, 4, 3, 2, 1].map((clase, i) => ({
    prioridad: 2 + i,
    columnas: PORCENTAJES,
    cumple: ({ clave, celda }) => igual(celda(CLASE_DE[clave]), clase),
    estilo: degrade(COLOR_DE_CLASE[clase]),
  })),
]);

// ------------------------------------------------ Valores de referencia --
// Los de la derecha de la hoja (columnas AA a CK): un bloque por categoría con
// su n y los cinco cortes de P.C., Rep, RM, Kg y Rel, y el resumen. Los
// «0.6» y «0.7» no van (el Excel dice «BORRAR .6 Y .7», como en Sentadilla
// Incremental; son el RM × 0,6 y × 0,7). Las clases usan el RM y la Rel.

export const FILAS_DE_REFERENCIA = Object.freeze([
  { clave: "n", titulo: et("n", "n"), formato: "General" },
  { clave: "excelente", titulo: et("Excelente", "Excelente") },
  { clave: "muy_bueno", titulo: et("Muy Bueno", "Muito Bom") },
  { clave: "bueno", titulo: et("Bueno", "Bom") },
  { clave: "regular", titulo: et("Regular", "Regular") },
  { clave: "malo", titulo: et("Malo", "Ruim") },
]);

export const METRICAS = Object.freeze([
  { clave: "pc", titulo: et("P.C.", "P.C."), formato: "0.00" },
  { clave: "rep", titulo: et("Rep", "Rep"), formato: "0.00" },
  { clave: "rm", titulo: et("RM", "RM"), formato: "0.00" },
  { clave: "kg", titulo: et("Kg", "Kg"), formato: "0.00" },
  { clave: "rel", titulo: et("Rel", "Rel"), formato: "0.00" },
]);

// El resumen («RESUMEN CATEGORIAS (Promedios)»): por categoría, su n y el
// "Bueno" de cada medida. No tiene la columna «Pro» de Zona Media.
const RESUMEN = Object.freeze(["pc", "rep", "rm", "kg", "rel"]);

// ---------------------------------------------------------------- Pegar --
// Lo que se trae al pegar la tabla del Excel (lo cargado a mano), por el
// nombre de su columna en la fila de títulos (la 10).
export const CABECERAS_PARA_PEGAR = Object.freeze({
  fecha: ["fecha"],
  jugador: ["jugador"],
  seleccion: ["seleccion", "selección"],
  pc: ["p c", "pc"],
  rep: ["rep"],
  kg: ["kg"],
  nota: ["nota"],
});

const AYUDA_PARA_PEGAR = et(
  "Antes de copiar, poné la columna P.C. con dos decimales: hay un peso con decimales que no se ven. Copiá desde la columna nº Eva hasta Nota.",
  "Antes de copiar, coloque a coluna P.C. com duas casas decimais: há um peso com decimais que não aparecem. Copie da coluna nº Eva até Nota.",
);

export const PRESS_PLANO = Object.freeze({
  id: ID,
  // El área del reporte individual (src/domain/evaluaciones/areas.js).
  area: "fuerza",
  pestana: et("Press Plano", "Supino Reto"),
  titulo: et("Pecho Plano", "Supino Reto"),
  nota: et(
    "*Los Valores pintados corresponden a la comparación entre los datos filtrados y los Valores referenciales de la Categoría seleccionada",
    "*Os valores coloridos correspondem à comparação entre os dados filtrados e os valores de referência da categoria selecionada",
  ),
  columnas: COLUMNAS,
  tiempos: [],
  numeros: NUMEROS,
  metricas: METRICAS,
  filasDeReferencia: FILAS_DE_REFERENCIA,
  resumen: RESUMEN,
  resumenConPro: false,
  entrada,
  calcularFila,
  columnasDelInforme: COLUMNAS_DEL_INFORME,
  informe,
  reglas: REGLAS,
  reglasDelInforme: REGLAS_DEL_INFORME,
  ayudaParaPegar: AYUDA_PARA_PEGAR,
  cabecerasParaPegar: CABECERAS_PARA_PEGAR,
});

export default PRESS_PLANO;
