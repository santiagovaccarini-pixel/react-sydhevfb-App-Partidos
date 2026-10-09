import { categoriaPorCodigo } from "../categorias.js";
import { claseMas, claseMenos, cortesDe } from "../clases.js";
import { absoluto, dividir, esBlanco, esVacio, igual, mayor, mayorIgual, menor, menorIgual, restar, siError, subtotal } from "../excel.js";
import { COLORES, SIN_RELLENO, degrade, estiloDeClase, letraSobreGris, masDesvios } from "../formatoCondicional.js";

// Curl Nórdico e Isoprone: la hoja "CurlNordico e Isoprone" del Excel
// BD_evaluaciones, entera en un solo lugar. Son dos evaluaciones que se toman
// en la misma máquina, por eso van en la misma hoja (Santiago, 09/10): una
// fila por día, con el peso corporal (P.C.) del día, y cuatro bloques (Curl
// Nórdico Máxima y Media, Isoprone Máxima y Media), cada uno con la pierna
// izquierda (L) y la derecha (R): la fuerza relativa al peso, su clase, su %
// de mejora, el déficit entre piernas con su clase y qué pierna rinde menos.
// Lo que se decidió el 09/10 (docs/PENDIENTES.md, "Evaluaciones"): sin las
// columnas ocultas que suman las dos piernas ("% mejora L + R" y "Clas L +
// R"); las clases contra los V.R. de la categoría de cada fila; el N° del
// informe cuenta datos y las cuentas de PD / PI respetan el filtro; las
// clases como en toda la app (el número del color de su clase, sobre gris).

const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });

const ID = "curl_nordico_isoprone";

// Los cuatro bloques (la fila de arriba de las cabeceras). `test`: de qué
// evaluación es; `medida`: máxima o media.
const BLOQUES = Object.freeze([
  { clave: "curl_max", test: "curl", medida: "max", titulo: et("Curl Nórdico · Máxima", "Curl Nórdico · Máxima") },
  { clave: "curl_med", test: "curl", medida: "med", titulo: et("Curl Nórdico · Media", "Curl Nórdico · Média") },
  { clave: "iso_max", test: "iso", medida: "max", titulo: et("Isoprone · Máxima", "Isoprone · Máxima") },
  { clave: "iso_med", test: "iso", medida: "med", titulo: et("Isoprone · Media", "Isoprone · Média") },
]);

export const GRUPOS = Object.freeze(BLOQUES.map(({ clave, titulo }) => ({ clave, titulo })));

// Las claves de las columnas de un bloque.
const clavesDe = ({ test, medida }) => ({
  l: `${test}_l_${medida}`,
  r: `${test}_r_${medida}`,
  lRel: `${test}_l_${medida}_rel`,
  rRel: `${test}_r_${medida}_rel`,
  lClas: `${test}_l_${medida}_clas`,
  rClas: `${test}_r_${medida}_clas`,
  lMejora: `${test}_l_${medida}_mejora`,
  rMejora: `${test}_r_${medida}_mejora`,
  deficit: `${test}_def_${medida}`,
  deficitClas: `${test}_def_${medida}_clas`,
  pierna: `${test}_pierna_${medida}`,
});

// Lo que se carga: el peso del día y la fuerza de cada pierna en cada bloque.
const FUERZAS = BLOQUES.flatMap((bloque) => [clavesDe(bloque).l, clavesDe(bloque).r]);
export const NUMEROS = Object.freeze(["pc", ...FUERZAS]);

// ---------------------------------------------------------- Las columnas --
// Los nombres, los del Excel (la fila 17). "Deficit Pierna" dice qué pierna
// rinde menos: PD (la derecha), PI (la izquierda) o Sin Deficit.
const PIERNA = Object.freeze({
  PD: et("PD", "PD"),
  PI: et("PI", "PE"),
  "Sin Deficit": et("Sin Deficit", "Sem Déficit"),
});

const columnasDelBloque = (bloque) => {
  const c = clavesDe(bloque);
  const max = bloque.medida === "max";
  const nombre = max ? et("MÁX", "MÁX") : et("MED.", "MÉD.");
  const con = (base, sufijo = "") => et(`${base} ${nombre["es-AR"]}${sufijo}`, `${base} ${nombre["pt-BR"]}${sufijo}`);
  // En el Excel, el % mejora L de Isoprone Media tiene dos decimales.
  const formatoMejoraL = bloque.clave === "iso_med" ? "0.00%" : "0.0%";
  const grupo = bloque.clave;
  return [
    { clave: c.l, titulo: con("L"), tipo: "numero", formato: "General", grupo },
    { clave: c.lRel, titulo: con("L", " Rel"), tipo: "calculado", formato: "0.00", grupo },
    { clave: c.lClas, titulo: et("Clas L", "Clas L"), tipo: "calculado", formato: "General", grupo },
    { clave: c.lMejora, titulo: et("% mejora L", "% melhora L"), tipo: "calculado", formato: formatoMejoraL, grupo },
    { clave: c.r, titulo: con("R"), tipo: "numero", formato: "General", grupo },
    { clave: c.rRel, titulo: con("R", " Rel"), tipo: "calculado", formato: "0.00", grupo },
    { clave: c.rClas, titulo: et("Clas R", "Clas R"), tipo: "calculado", formato: "General", grupo },
    { clave: c.rMejora, titulo: et("% mejora R", "% melhora R"), tipo: "calculado", formato: "0.0%", grupo },
    {
      clave: c.deficit,
      titulo: max ? et("Deficit MAX %", "Déficit MÁX %") : et("Déficit MED %", "Déficit MÉD %"),
      tipo: "calculado",
      formato: "0.0%",
      grupo,
    },
    { clave: c.deficitClas, titulo: et("Clas Deficit", "Clas Déficit"), tipo: "calculado", formato: "General", grupo },
    { clave: c.pierna, titulo: et("Deficit Pierna", "Déficit Perna"), tipo: "calculado", formato: "General", valores: PIERNA, grupo },
  ];
};

// Quedan a la vista al correr la tabla, como el Excel inmovilizado (el P.C.
// no, para que se vea su informe).
export const COLUMNAS = Object.freeze([
  { clave: "jugador", titulo: et("Jugador", "Jogador"), tipo: "jugador", fija: true, ancho: 168 },
  { clave: "fecha", titulo: et("Fecha", "Data"), tipo: "fecha", fija: true, ancho: 140 },
  { clave: "numero", titulo: et("Evaluacion", "Avaliação"), tipo: "calculado", formato: "General", fija: true, ancho: 104 },
  { clave: "seleccion", titulo: et("Seleccion", "Seleção"), tipo: "lista", fija: true, ancho: 120 },
  // El peso del día va en el primer paso de la carga, con el jugador y la fecha.
  { clave: "pc", titulo: et("P.C.", "P.C."), tipo: "numero", formato: "General", enPrimerPaso: true },
  ...BLOQUES.flatMap(columnasDelBloque),
]);

// ------------------------------------------------------------ Las cuentas --

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

// La clase de una fila contra los V.R. de su categoría (Santiago, 09/10: "si
// en el desplegable dice sub 17 todas las clasificaciones se tienen que
// comparar contra el valor de ese vr"; el Excel comparaba siempre contra
// Mayor). Sin valor, sin categoría o sin V.R. de esa categoría, vacía.
const claseDeFila = ({ seleccion, valor, referencias, metrica, clasificar, esCategoria }) => {
  if (esVacio(valor) || esBlanco(seleccion) || !esCategoria(seleccion)) return "";
  const cortes = cortesDe(referencias, seleccion, metrica);
  return cortes ? siError(clasificar(valor, cortes), "") : "";
};

const calcularFila = ({ entrada: e, numero, anterior, referencias, esCategoria = (codigo) => Boolean(categoriaPorCodigo(codigo)) }) => {
  const calculadas = { numero };
  BLOQUES.forEach((bloque) => {
    const c = clavesDe(bloque);
    // Rel: IFERROR(IF(OR(ISBLANK($H),ISBLANK(I)),"",I/$H),""): la fuerza
    // relativa al peso del día.
    const relativa = (fuerza) => (esBlanco(e.pc) || esBlanco(fuerza) ? "" : siError(dividir(fuerza, e.pc), ""));
    const lRel = relativa(e[c.l]);
    const rRel = relativa(e[c.r]);
    // % mejora sobre la Rel: contra la evaluación anterior del jugador que la
    // tenga, sin límite de cuántas atrás (Santiago, 05/10; el Excel miraba solo
    // la anterior). (actual − anterior) / anterior.
    const mejora = (actual, clave) => {
      if (esVacio(actual)) return "";
      const previa = anterior(clave);
      if (esVacio(previa)) return "";
      return siError(dividir(restar(actual, previa), previa), "");
    };
    // Déficit: IFERROR(ABS(R Rel − L Rel) / IF(R Rel < L Rel, R Rel, L Rel), "").
    let deficit = "";
    if (!esVacio(lRel) && !esVacio(rRel)) {
      const menorDeLasDos = menor(rRel, lRel) === true ? rRel : lRel;
      deficit = siError(dividir(absoluto(restar(rRel, lRel)), menorDeLasDos), "");
    }
    // Deficit Pierna, con la fuerza sin dividir:
    // IF(OR(ISBLANK(L),ISBLANK(R)),"",IF(R−L<0,"PD",IF(R−L=0,"Sin Deficit","PI"))).
    let pierna = "";
    if (!esBlanco(e[c.l]) && !esBlanco(e[c.r])) {
      const diferencia = restar(e[c.r], e[c.l]);
      if (menor(diferencia, 0) === true) pierna = "PD";
      else if (igual(diferencia, 0) === true) pierna = "Sin Deficit";
      else pierna = "PI";
    }
    const clase = (valor, metrica, clasificar) => claseDeFila({ seleccion: e.seleccion, valor, referencias, metrica, clasificar, esCategoria });
    Object.assign(calculadas, {
      [c.lRel]: lRel,
      [c.lClas]: clase(lRel, c.lRel, claseMas),
      [c.lMejora]: mejora(lRel, c.lRel),
      [c.rRel]: rRel,
      [c.rClas]: clase(rRel, c.rRel, claseMas),
      [c.rMejora]: mejora(rRel, c.rRel),
      [c.deficit]: deficit,
      [c.deficitClas]: clase(deficit, c.deficit, claseMenos),
      [c.pierna]: pierna,
    });
  });
  return calculadas;
};

// ------------------------------------------------------------ El informe --
// Las filas 12 a 16 del Excel, con las filas que se ven: N° (cuántos datos),
// Promedio, Desvío, Máximo y Mínimo. No compara con los V.R. (no tiene "Vs …").
// En las columnas de Deficit Pierna, cuántas PD, PI y Sin Deficit hay (en el
// Excel, en las filas de Promedio, Desvío y Máximo, sin respetar el filtro;
// acá, con el filtro: Santiago, 09/10), con el formato del Excel (0.0).

const NUMERICAS_DEL_BLOQUE = (bloque) => {
  const c = clavesDe(bloque);
  return [c.l, c.lRel, c.lClas, c.lMejora, c.r, c.rRel, c.rClas, c.rMejora, c.deficit, c.deficitClas];
};
const COLUMNAS_DEL_INFORME = Object.freeze(["numero", "pc", ...BLOQUES.flatMap(NUMERICAS_DEL_BLOQUE)]);
const PORCENTAJES = new Set(BLOQUES.flatMap((bloque) => [clavesDe(bloque).lMejora, clavesDe(bloque).rMejora, clavesDe(bloque).deficit]));
const PIERNAS = BLOQUES.map((bloque) => clavesDe(bloque).pierna);

// Sin ningún número en la columna, vacío (Santiago, 05/10: el Excel mostraba
// #DIV/0! y 0).
const filaDeEstadistica = (est, campo) =>
  Object.fromEntries(
    COLUMNAS_DEL_INFORME.filter((clave) => campo === "n" || clave !== "numero").map((clave) => {
      const valor = est[clave].n === 0 && campo !== "n" ? "" : est[clave][campo];
      return [clave, { valor, formato: campo === "n" ? "General" : PORCENTAJES.has(clave) ? "0.0%" : "0.0" }];
    }),
  );

const CUENTAS = [
  { fila: "promedios", valor: "PD" },
  { fila: "desvios", valor: "PI" },
  { fila: "maximo", valor: "Sin Deficit" },
];

const informe = ({ est, filas = [] }) => {
  const porFila = { n: filaDeEstadistica(est, "n"), promedios: filaDeEstadistica(est, "promedio"), desvios: filaDeEstadistica(est, "desvio"), maximo: filaDeEstadistica(est, "maximo"), minimo: filaDeEstadistica(est, "minimo") };
  CUENTAS.forEach(({ fila, valor }) => {
    PIERNAS.forEach((clave) => {
      porFila[fila][clave] = { valor: subtotal(2, filas.map((celdas) => (igual(celdas[clave], valor) === true ? 1 : null))), formato: "0.0", rotulo: PIERNA[valor] };
    });
  });
  return [
    { id: "n", rotulo: et("N°", "N°"), celdas: porFila.n },
    { id: "promedios", rotulo: et("Promedio", "Média"), celdas: porFila.promedios },
    { id: "desvios", rotulo: et("Desvío", "Desvio"), celdas: porFila.desvios },
    { id: "maximo", rotulo: et("Máximo", "Máximo"), celdas: porFila.maximo },
    { id: "minimo", rotulo: et("Mínimo", "Mínimo"), celdas: porFila.minimo },
  ];
};

// ------------------------------------------------- Formato condicional --
// Las 19 reglas del Excel, con su prioridad. μ y σ: el promedio y el desvío
// de la columna con las filas que se ven. Los colores, los de toda la app
// (Santiago, 09/10; esta hoja tenía otros tonos de verde oscuro, naranja y
// del amarillo de la clase 3).

const CLASES = BLOQUES.flatMap((bloque) => [clavesDe(bloque).lClas, clavesDe(bloque).rClas, clavesDe(bloque).deficitClas]);
const MAS_ES_MEJOR = BLOQUES.flatMap((bloque) => [clavesDe(bloque).lRel, clavesDe(bloque).lMejora, clavesDe(bloque).rRel, clavesDe(bloque).rMejora]);
const DEFICITS = BLOQUES.map((bloque) => clavesDe(bloque).deficit);
const TODAS = BLOQUES.flatMap((bloque) => Object.values(clavesDe(bloque)));

const y = (...valores) => valores.find((valor) => valor && typeof valor === "object") || valores.every((valor) => valor === true);
const mas = (ctx, k) => masDesvios(ctx.promedio, ctx.desvio, k);

export const REGLAS = Object.freeze([
  // Las clases: el número del color de su clase, sobre gris (igual en toda la app).
  ...[5, 4, 3, 2, 1].map((clase, i) => ({ prioridad: 1 + i, columnas: CLASES, cumple: ({ valor }) => igual(valor, clase), estilo: estiloDeClase(clase) })),
  // Las celdas vacías no se pintan: OR(I18="",ISBLANK(I18)).
  { prioridad: 6, columnas: TODAS, cumple: ({ valor }) => esVacio(valor), estilo: SIN_RELLENO },
  // La fuerza relativa y su % de mejora: más es mejor, contra μ y σ.
  { prioridad: 7, columnas: MAS_ES_MEJOR, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, 2)), estilo: degrade(COLORES.verdeOscuro) },
  { prioridad: 8, columnas: MAS_ES_MEJOR, cumple: (ctx) => y(menor(ctx.valor, mas(ctx, 2)), mayorIgual(ctx.valor, mas(ctx, 1))), estilo: degrade(COLORES.verde) },
  { prioridad: 9, columnas: MAS_ES_MEJOR, cumple: (ctx) => y(menor(ctx.valor, mas(ctx, 1)), mayorIgual(ctx.valor, ctx.promedio)), estilo: degrade(COLORES.amarillo) },
  { prioridad: 10, columnas: MAS_ES_MEJOR, cumple: (ctx) => y(menor(ctx.valor, ctx.promedio), mayorIgual(ctx.valor, mas(ctx, -1))), estilo: degrade(COLORES.naranja) },
  { prioridad: 11, columnas: MAS_ES_MEJOR, cumple: (ctx) => menor(ctx.valor, mas(ctx, -1)), estilo: degrade(COLORES.rojo) },
  // Qué pierna rinde menos: una letra de color en negrita sobre gris.
  { prioridad: 12, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "Sin Deficit"), estilo: letraSobreGris("#7030A0") },
  { prioridad: 13, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "PI"), estilo: letraSobreGris("#984807") },
  { prioridad: 14, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "PD"), estilo: letraSobreGris("#0D0D0D") },
  // El déficit: menos es mejor.
  { prioridad: 15, columnas: DEFICITS, cumple: (ctx) => mayor(ctx.valor, mas(ctx, 1)), estilo: degrade(COLORES.rojo) },
  { prioridad: 16, columnas: DEFICITS, cumple: (ctx) => y(mayor(ctx.valor, ctx.promedio), menorIgual(ctx.valor, mas(ctx, 1))), estilo: degrade(COLORES.naranja) },
  { prioridad: 17, columnas: DEFICITS, cumple: (ctx) => y(mayor(ctx.valor, mas(ctx, -1)), menorIgual(ctx.valor, ctx.promedio)), estilo: degrade(COLORES.amarillo) },
  { prioridad: 18, columnas: DEFICITS, cumple: (ctx) => y(mayor(ctx.valor, mas(ctx, -2)), menorIgual(ctx.valor, mas(ctx, -1))), estilo: degrade(COLORES.verde) },
  { prioridad: 19, columnas: DEFICITS, cumple: (ctx) => menorIgual(ctx.valor, mas(ctx, -2)), estilo: degrade(COLORES.verdeOscuro) },
]);

// ------------------------------------------------- Valores de referencia --
// Los de "VR para Evaluaciones" (Curl Nordico A1:J9 e Isoprone A12:J20), por
// categoría (hoy el Excel tiene solo Mayor). Una tabla por evaluación, con
// sus filas: n, Promedio, Desv. Estándar y los cinco cortes. Las clases usan
// Excelente, Muy Bueno, Bueno y Regular (Malo se muestra). En el Excel los
// cortes salen del promedio y el desvío (Bueno = Promedio): en la base van
// ya calculados; si el club cambia el promedio o el desvío, hay que
// recalcularlos. "DE" son los desvíos de cada corte del déficit (solo se
// muestran).
const metricasDe = (test) => [
  { clave: `${test}_l_max_rel`, titulo: et("L MÁX Rel", "L MÁX Rel"), formato: "0.00" },
  { clave: `${test}_r_max_rel`, titulo: et("R MÁX Rel", "R MÁX Rel"), formato: "0.00" },
  { clave: `${test}_l_med_rel`, titulo: et("L MED Rel", "L MÉD Rel"), formato: "0.00" },
  { clave: `${test}_r_med_rel`, titulo: et("R MED Rel", "R MÉD Rel"), formato: "0.00" },
  { clave: `${test}_def_max`, titulo: et("Deficit Max", "Déficit Máx"), formato: "0.0%" },
  { clave: `${test}_def_max_de`, titulo: et("DE", "DE"), formato: "General" },
  { clave: `${test}_def_med`, titulo: et("Deficit Med", "Déficit Méd"), formato: "0.0%" },
  { clave: `${test}_def_med_de`, titulo: et("DE", "DE"), formato: "General" },
];

export const TABLAS_DE_REFERENCIA = Object.freeze([
  { id: "curl", titulo: et("Curl Nórdico", "Curl Nórdico"), metricas: metricasDe("curl") },
  { id: "iso", titulo: et("Isoprone", "Isoprone"), metricas: metricasDe("iso") },
]);

export const METRICAS = Object.freeze(TABLAS_DE_REFERENCIA.flatMap((tabla) => tabla.metricas));

export const FILAS_DE_REFERENCIA = Object.freeze([
  { clave: "n", titulo: et("n", "n"), formato: "General" },
  { clave: "promedio", titulo: et("Promedio", "Média") },
  { clave: "desvio", titulo: et("Desv. Estándar", "Desvio padrão") },
  { clave: "excelente", titulo: et("Excelente", "Excelente") },
  { clave: "muy_bueno", titulo: et("Muy Bueno", "Muito Bom") },
  { clave: "bueno", titulo: et("Bueno", "Bom") },
  { clave: "regular", titulo: et("Regular", "Regular") },
  { clave: "malo", titulo: et("Malo", "Ruim") },
]);

// ---------------------------------------------------------------- Pegar --
// Lo que se trae al pegar la tabla del Excel, por el nombre de su columna en
// la fila de títulos. "L MÁX", "R MÁX", "L MED." y "R MED." están una vez por
// evaluación: la primera es de Curl Nórdico y la segunda de Isoprone.
export const CABECERAS_PARA_PEGAR = Object.freeze({
  fecha: ["fecha"],
  jugador: ["jugador"],
  seleccion: ["seleccion", "selección"],
  pc: ["p c", "pc"],
  curl_l_max: { nombres: ["l max"], vez: 1 },
  curl_r_max: { nombres: ["r max"], vez: 1 },
  curl_l_med: { nombres: ["l med"], vez: 1 },
  curl_r_med: { nombres: ["r med"], vez: 1 },
  iso_l_max: { nombres: ["l max"], vez: 2 },
  iso_r_max: { nombres: ["r max"], vez: 2 },
  iso_l_med: { nombres: ["l med"], vez: 2 },
  iso_r_med: { nombres: ["r med"], vez: 2 },
});

export const CURL_NORDICO_ISOPRONE = Object.freeze({
  id: ID,
  // El área del reporte individual (src/domain/evaluaciones/areas.js).
  area: "funcionales",
  pestana: et("Curl Nórdico e Isoprone", "Curl Nórdico e Isoprone"),
  titulo: et("Curl Nórdico e Isoprone", "Curl Nórdico e Isoprone"),
  nota: et("", ""),
  grupos: GRUPOS,
  columnas: COLUMNAS,
  tiempos: [],
  numeros: NUMEROS,
  metricas: METRICAS,
  tablasDeReferencia: TABLAS_DE_REFERENCIA,
  filasDeReferencia: FILAS_DE_REFERENCIA,
  entrada,
  calcularFila,
  columnasDelInforme: COLUMNAS_DEL_INFORME,
  informe,
  reglas: REGLAS,
  reglasDelInforme: [],
  cabecerasParaPegar: CABECERAS_PARA_PEGAR,
});

export default CURL_NORDICO_ISOPRONE;
