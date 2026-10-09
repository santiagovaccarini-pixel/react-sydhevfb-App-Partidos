import { categoriaPorCodigo } from "../categorias.js";
import { claseMas, claseMenos, cortesDe } from "../clases.js";
import { absoluto, dividir, esBlanco, esError, esVacio, igual, mayor, mayorIgual, menor, menorIgual, restar, siError, subtotal, sumar } from "../excel.js";
import { COLORES, COLOR_DE_CLASE, SIN_RELLENO, degrade, estiloDeClase, letraSobreGris, masDesvios } from "../formatoCondicional.js";

// Movilidad de Tobillo, de Cadera y de Isquio: tres de los bloques de la
// hoja "Funcional" del Excel BD_evaluaciones. En el Excel van en la misma
// fila del jugador pero se toman en días distintos, cada uno con su fecha y
// su n° de evaluación (Santiago, 09/10: «como todas esas evaluaciones son de
// movilidad pero se toman distinto hicimos esto»): en la app, cada bloque es
// su propio test. Los tres tienen las mismas columnas y las mismas fórmulas;
// en Isquio, menos es mejor. Lo que se decidió el 09/10 (docs/PENDIENTES.md,
// "Evaluaciones"): Sentadilla de Arranque, Hombro, los re-test y las notas
// quedan afuera; la comparación «Vs …» del informe, como en Zona Media.

const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });

// Lo que se carga: el valor de cada pierna (PD, la derecha; PI, la izquierda).
const NUMEROS = Object.freeze(["pd", "pi"]);

// "Deficit Pierna" dice qué pierna rinde menos: PD, PI o Sin Deficit.
const PIERNA = Object.freeze({
  PD: et("PD", "PD"),
  PI: et("PI", "PE"),
  "Sin Deficit": et("Sin Deficit", "Sem Déficit"),
});

// O y Y de Excel: si alguno es un error, el resultado es el error.
const o = (...valores) => valores.find(esError) || valores.some(Boolean);
const y = (...valores) => valores.find(esError) || valores.every(Boolean);

// Lo que se agrega a la ayuda de Pegar desde Excel: los tests de la hoja
// Funcional se pegan con la hoja (entera o hasta el bloque del test).
export const AYUDA_FUNCIONAL = Object.freeze(
  et(
    "Es un bloque de la hoja Funcional: copiá la tabla desde la fila de títulos, desde la columna Jugador hasta el final del bloque de este test (o la hoja entera). Se leen solo las filas con datos de este test.",
    "É um bloco da planilha Funcional: copie a tabela a partir da linha de títulos, da coluna Jugador até o fim do bloco deste teste (ou a planilha inteira). Só são lidas as linhas com dados deste teste.",
  ),
);

// Pegar: en la fila de títulos de la hoja Funcional, "Fecha", "PD" y "PI" se
// repiten (una Fecha por bloque; PD y PI en cada bloque y en cada Re - test).
// Cada test busca su bloque por su propia Fecha y lee lo suyo adentro, sin
// contar columnas desde la izquierda (Santiago, 09/10: con las columnas de
// Tobillo ocultas, Excel no las copia y el PD de Cadera quedaba en otro
// lugar). Los tramos van de una Fecha a la siguiente: el primero (el de la
// Fecha de al lado del Jugador) es el de Tobillo; Cadera e Isquio son los que
// tienen PD después de su Fecha y su Evaluación (el primero Cadera, el
// segundo Isquio), y Estabilidad rotacional, el que tiene Cifosis. Si se ve
// uno solo de Cadera e Isquio, es Cadera cuando es lo último que se pegó (se
// copió hasta el fin de Cadera); si no, no se sabe cuál es (el otro estaba
// oculto) y no se lee: nunca se cargan los datos de un bloque en otro test.
// titulos: la fila de títulos, ya normalizada. Devuelve { desde, hasta } o null.
export const bloqueDeFuncional = (cual) => (titulos) => {
  const fechas = titulos.flatMap((titulo, i) => (titulo === "fecha" ? [i] : []));
  if (!fechas.length) return null;
  const tramos = fechas.map((desde, k) => ({ desde, hasta: k + 1 < fechas.length ? fechas[k + 1] : titulos.length }));
  if (cual === "tobillo") return tramos[0];
  const propios = tramos.slice(1);
  if (cual === "estabilidad") return propios.find((tramo) => titulos.slice(tramo.desde, tramo.hasta).includes("cifosis derecha")) || null;
  const deMovilidad = propios.filter((tramo) => titulos.slice(tramo.desde + 1, tramo.desde + 3).includes("pd"));
  if (deMovilidad.length === 1) return cual === "cadera" && deMovilidad[0] === tramos[tramos.length - 1] ? deMovilidad[0] : null;
  return deMovilidad[cual === "cadera" ? 0 : 1] || null;
};

// Un título que se busca adentro del bloque del test (la n-ésima vez que
// aparece ahí).
export const enSuBloque = (nombre, vez = 1) => ({ nombres: [nombre], vez, enBloque: true });

// Lo cargado de una fila, como lo cuenta el Excel.
const entrada = (fila) => {
  const datos = fila?.datos || {};
  const numero = (clave) => (typeof datos[clave] === "number" && Number.isFinite(datos[clave]) ? datos[clave] : null);
  return {
    fecha: fila?.fecha || null,
    seleccion: datos.seleccion || null,
    pd: numero("pd"),
    pi: numero("pi"),
  };
};

// La clase de una fila contra los V.R. de la categoría de esa fila (como en
// Curl Nórdico; el Excel comparaba siempre contra Mayor). Sin valor, sin
// categoría o sin V.R. de esa categoría, vacía.
const claseDeFila = ({ seleccion, valor, referencias, metrica, clasificar, esCategoria }) => {
  if (esVacio(valor) || esBlanco(seleccion) || !esCategoria(seleccion)) return "";
  const cortes = cortesDe(referencias, seleccion, metrica);
  return cortes ? siError(clasificar(valor, cortes), "") : "";
};

// Arma uno de los tres tests. menosEsMejor: en Isquio, el valor más chico es
// el mejor (sus clases van con <=, sus colores al revés y "Deficit Pierna"
// marca la pierna con el valor más grande).
const armarTest = ({ id, pestana, titulo, menosEsMejor = false, formatos, bloque }) => {
  const clasificar = menosEsMejor ? claseMenos : claseMas;

  // ------------------------------------------------------ Las cuentas --
  const calcularFila = ({ entrada: e, numero, anterior, referencias, esCategoria = (codigo) => Boolean(categoriaPorCodigo(codigo)) }) => {
    // % Mejora: (actual − anterior) / anterior, contra la evaluación anterior
    // del jugador que tenga el dato (sin límite de cuántas atrás, como en
    // todos los tests; el Excel miraba solo la anterior).
    const mejora = (clave) => {
      if (esVacio(e[clave])) return "";
      const previa = anterior(clave);
      if (esVacio(previa)) return "";
      return siError(dividir(restar(e[clave], previa), previa), "");
    };
    // % DEFICIT LATERAL: IFERROR(ABS(PI − PD) / IF(PI < PD, PI, PD), ""). Sin
    // una de las dos piernas, vacío.
    let deficit = "";
    if (!esBlanco(e.pd) && !esBlanco(e.pi)) {
      deficit = siError(dividir(absoluto(restar(e.pi, e.pd)), menor(e.pi, e.pd) === true ? e.pi : e.pd), "");
    }
    // Dificit Pierna: IF(OR(ISBLANK(PI),ISBLANK(PD)),"",IF(PD−PI<0,"PD",
    // IF(PD−PI=0,"Sin Deficit","PI"))); en Isquio, con PD−PI>0.
    let pierna = "";
    if (!esBlanco(e.pd) && !esBlanco(e.pi)) {
      const diferencia = restar(e.pd, e.pi);
      if ((menosEsMejor ? mayor(diferencia, 0) : menor(diferencia, 0)) === true) pierna = "PD";
      else if (igual(diferencia, 0) === true) pierna = "Sin Deficit";
      else pierna = "PI";
    }
    const clase = (valor, metrica, comoSeClasifica) => claseDeFila({ seleccion: e.seleccion, valor, referencias, metrica, clasificar: comoSeClasifica, esCategoria });
    return {
      numero,
      pd_clas: clase(e.pd, "pd", clasificar),
      pd_mejora: mejora("pd"),
      pi_clas: clase(e.pi, "pi", clasificar),
      pi_mejora: mejora("pi"),
      deficit,
      // El déficit, siempre menos es mejor.
      deficit_clas: clase(deficit, "deficit", claseMenos),
      pierna,
    };
  };

  // ----------------------------------------------------- Las columnas --
  // Los nombres, los del Excel (la fila 17). Posición no va (Santiago,
  // 05/10). "Dificit Pierna" del Excel va como "Deficit Pierna", como en
  // los otros tests. Los formatos: en el Excel cambian de fila a fila en la
  // misma columna (17 y 17,0); acá, uno por columna: los números enteros,
  // sin decimales, y los % con uno (el % Mejora PI de Isquio tenía, en
  // muchas filas, formato de número: mostraba 0,1 en vez de 10,0%).
  const COLUMNAS = Object.freeze([
    { clave: "jugador", titulo: et("Jugador", "Jogador"), tipo: "jugador", fija: true, ancho: 168 },
    { clave: "fecha", titulo: et("Fecha", "Data"), tipo: "fecha", fija: true, ancho: 140 },
    { clave: "numero", titulo: et("Evaluacion", "Avaliação"), tipo: "calculado", formato: "General", fija: true, ancho: 104 },
    { clave: "fecha_nac", titulo: et("Fecha Nac", "Data Nasc."), tipo: "dato_jugador", fija: true, ancho: 120 },
    { clave: "seleccion", titulo: et("Seleccion", "Seleção"), tipo: "lista", fija: true, ancho: 120 },
    { clave: "pd", titulo: et("PD", "PD"), tipo: "numero", formato: "General" },
    { clave: "pd_clas", titulo: et("PD Clas", "PD Clas"), tipo: "calculado", formato: "General" },
    { clave: "pd_mejora", titulo: et("% Mejora PD", "% Melhora PD"), tipo: "calculado", formato: "0.0%" },
    { clave: "pi", titulo: et("PI", "PE"), tipo: "numero", formato: "General" },
    { clave: "pi_clas", titulo: et("PI Clas", "PE Clas"), tipo: "calculado", formato: "General" },
    { clave: "pi_mejora", titulo: et("% Mejora PI", "% Melhora PE"), tipo: "calculado", formato: "0.0%" },
    { clave: "deficit", titulo: et("% DEFICIT LATERAL", "% DÉFICIT LATERAL"), tipo: "calculado", formato: "0.0%" },
    { clave: "deficit_clas", titulo: et("Clas. Dif. Cm", "Clas. Dif. Cm"), tipo: "calculado", formato: "General" },
    { clave: "pierna", titulo: et("Deficit Pierna", "Déficit Perna"), tipo: "calculado", formato: "General", valores: PIERNA },
  ]);

  // ------------------------------------------------------- El informe --
  // Arriba, la comparación con los V.R. de la categoría elegida («Vs …»,
  // como en Zona Media: el promedio sobre el "Bueno" y la clase del
  // promedio; Santiago, 09/10) y su "Bueno". Después, las filas 12 a 16 del
  // Excel con las filas que se ven: N° (cuántos datos), Promedio, Desvío
  // (con el 0,0000000000001 que le suma el Excel), Máximo y Mínimo. En
  // "Deficit Pierna", cuántas PD, PI y Sin Deficit hay (en el Excel, sin
  // respetar el filtro; acá, con el filtro, como en Curl Nórdico).
  const COLUMNAS_DEL_INFORME = Object.freeze(["numero", "pd", "pd_clas", "pd_mejora", "pi", "pi_clas", "pi_mejora", "deficit", "deficit_clas"]);
  const FORMATO_DEL_INFORME = {
    pd: "0.0",
    pd_clas: formatos.informePdClas,
    pd_mejora: "0.0%",
    pi: "0.0",
    pi_clas: "0.0",
    pi_mejora: "0.0%",
    deficit: "0.0%",
    deficit_clas: formatos.informeDeficitClas,
  };
  const COMPARADAS = [
    { clave: "pd", metrica: "pd", clase: "pd_clas", clasificar, formato: "0.00" },
    { clave: "pi", metrica: "pi", clase: "pi_clas", clasificar, formato: "0.00" },
    { clave: "deficit", metrica: "deficit", clase: "deficit_clas", clasificar: claseMenos, formato: "0.0%" },
  ];
  const CUENTAS = [
    { fila: "promedios", valor: "PD" },
    { fila: "desvios", valor: "PI" },
    { fila: "maximo", valor: "Sin Deficit" },
  ];
  // Sin ningún número en la columna, vacío (Santiago, 05/10: el Excel
  // mostraba #DIV/0! y 0).
  const filaDeEstadistica = (est, campo, valorDe = (unaEst) => unaEst[campo]) =>
    Object.fromEntries(
      COLUMNAS_DEL_INFORME.filter((clave) => campo === "n" || clave !== "numero").map((clave) => [
        clave,
        { valor: est[clave].n === 0 && campo !== "n" ? "" : valorDe(est[clave]), formato: campo === "n" ? "General" : FORMATO_DEL_INFORME[clave] },
      ]),
    );

  const informe = ({ est, referencias, comparar, filas = [] }) => {
    const comparacion = {};
    const referencia = {};
    COMPARADAS.forEach(({ clave, metrica, clase, clasificar: comoSeClasifica, formato }) => {
      const cortes = cortesDe(referencias, comparar, metrica);
      const bueno = cortes ? cortes[2] : "";
      referencia[clave] = { valor: bueno, formato };
      comparacion[clave] = { valor: siError(dividir(est[clave].promedio, bueno), ""), formato: "0.00%" };
      comparacion[clase] = { valor: cortes ? siError(comoSeClasifica(est[clave].promedio, cortes), "") : "", formato: "0" };
    });
    const porFila = {
      n: filaDeEstadistica(est, "n"),
      promedios: filaDeEstadistica(est, "promedio"),
      desvios: filaDeEstadistica(est, "desvio", (unaEst) => sumar(unaEst.desvio, 0.0000000000001)),
      maximo: filaDeEstadistica(est, "maximo"),
      minimo: filaDeEstadistica(est, "minimo"),
    };
    CUENTAS.forEach(({ fila, valor }) => {
      porFila[fila].pierna = { valor: subtotal(2, filas.map((celdas) => (igual(celdas.pierna, valor) === true ? 1 : null))), formato: "0.0", rotulo: PIERNA[valor] };
    });
    return [
      { id: "comparacion", celdas: comparacion },
      { id: "referencia", celdas: referencia },
      { id: "n", rotulo: et("N°", "N°"), celdas: porFila.n },
      { id: "promedios", rotulo: et("Promedio", "Média"), celdas: porFila.promedios },
      { id: "desvios", rotulo: et("Desvío", "Desvio"), celdas: porFila.desvios },
      { id: "maximo", rotulo: et("Máximo", "Máximo"), celdas: porFila.maximo },
      { id: "minimo", rotulo: et("Mínimo", "Mínimo"), celdas: porFila.minimo },
    ];
  };

  // ------------------------------------------- Formato condicional --
  // Las reglas del Excel que pintan algo, con su prioridad; los colores, los
  // de toda la app. μ y σ: el promedio y el desvío de la columna con las
  // filas que se ven (σ con el 0,0000000000001 del Excel). En Isquio, PD y
  // PI van como el déficit (menos es mejor) y su % Mejora no se pinta.
  const MAS_ES_MEJOR = menosEsMejor ? [] : ["pd", "pd_mejora", "pi", "pi_mejora"];
  const MENOS_ES_MEJOR = menosEsMejor ? ["pd", "pi", "deficit"] : ["deficit"];
  const CLASES = ["pd_clas", "pi_clas", "deficit_clas"];
  const TODAS = COLUMNAS_DEL_INFORME.filter((clave) => clave !== "numero").concat("pierna");
  const mas = (ctx, k) => masDesvios(ctx.promedio, sumar(ctx.desvio, 0.0000000000001), k);

  const REGLAS = Object.freeze([
    // "Deficit Pierna" con la clase del déficit en 2 o menos: degradé a negro
    // con la letra blanca (en el Excel de Tobillo la regla estaba mal escrita
    // y no pintaba nunca; en Cadera e Isquio, sí: acá, en los tres).
    { prioridad: 1, columnas: ["pierna"], cumple: ({ celda }) => menorIgual(celda("deficit_clas"), 2), estilo: { relleno: { tipo: "degradado", color: "#000000" }, letra: COLORES.blanco, negrita: true } },
    // Las celdas vacías no se pintan.
    { prioridad: 2, columnas: TODAS, cumple: ({ valor }) => esVacio(valor), estilo: SIN_RELLENO },
    // Más es mejor, contra μ y σ.
    { prioridad: 3, columnas: MAS_ES_MEJOR, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, 2)), estilo: degrade(COLORES.verdeOscuro) },
    { prioridad: 4, columnas: MAS_ES_MEJOR, cumple: (ctx) => y(menor(ctx.valor, mas(ctx, 2)), mayorIgual(ctx.valor, mas(ctx, 1))), estilo: degrade(COLORES.verde) },
    { prioridad: 5, columnas: MAS_ES_MEJOR, cumple: (ctx) => y(menor(ctx.valor, mas(ctx, 1)), mayorIgual(ctx.valor, ctx.promedio)), estilo: degrade(COLORES.amarillo) },
    { prioridad: 6, columnas: MAS_ES_MEJOR, cumple: (ctx) => y(menor(ctx.valor, ctx.promedio), mayorIgual(ctx.valor, mas(ctx, -1))), estilo: degrade(COLORES.naranja) },
    { prioridad: 7, columnas: MAS_ES_MEJOR, cumple: (ctx) => menor(ctx.valor, mas(ctx, -1)), estilo: degrade(COLORES.rojo) },
    // Menos es mejor.
    { prioridad: 8, columnas: MENOS_ES_MEJOR, cumple: (ctx) => mayor(ctx.valor, mas(ctx, 1)), estilo: degrade(COLORES.rojo) },
    { prioridad: 9, columnas: MENOS_ES_MEJOR, cumple: (ctx) => y(mayor(ctx.valor, ctx.promedio), menorIgual(ctx.valor, mas(ctx, 1))), estilo: degrade(COLORES.naranja) },
    { prioridad: 10, columnas: MENOS_ES_MEJOR, cumple: (ctx) => y(mayor(ctx.valor, mas(ctx, -1)), menorIgual(ctx.valor, ctx.promedio)), estilo: degrade(COLORES.amarillo) },
    { prioridad: 11, columnas: MENOS_ES_MEJOR, cumple: (ctx) => y(mayor(ctx.valor, mas(ctx, -2)), menorIgual(ctx.valor, mas(ctx, -1))), estilo: degrade(COLORES.verde) },
    { prioridad: 12, columnas: MENOS_ES_MEJOR, cumple: (ctx) => menorIgual(ctx.valor, mas(ctx, -2)), estilo: degrade(COLORES.verdeOscuro) },
    // Qué pierna rinde menos: una letra de color en negrita sobre gris (las
    // de Curl Nórdico).
    { prioridad: 13, columnas: ["pierna"], cumple: ({ valor }) => igual(valor, "Sin Deficit"), estilo: letraSobreGris("#7030A0") },
    { prioridad: 14, columnas: ["pierna"], cumple: ({ valor }) => igual(valor, "PI"), estilo: letraSobreGris("#984807") },
    { prioridad: 15, columnas: ["pierna"], cumple: ({ valor }) => igual(valor, "PD"), estilo: letraSobreGris("#0D0D0D") },
    // Las clases: el número del color de su clase, sobre gris (igual en toda la app).
    ...[5, 4, 3, 2, 1].map((numero, i) => ({ prioridad: 16 + i, columnas: CLASES, cumple: ({ valor }) => igual(valor, numero), estilo: estiloDeClase(numero) })),
  ]);

  // La fila de la comparación: cada porcentaje con el color de la clase de
  // al lado, en degradé (como en Zona Media).
  const CLASE_DE = Object.fromEntries(COMPARADAS.map(({ clave, clase }) => [clave, clase]));
  const PORCENTAJES = COMPARADAS.map(({ clave }) => clave);
  const REGLAS_DEL_INFORME = Object.freeze([
    { prioridad: 1, columnas: PORCENTAJES, cumple: ({ valor, clave, celda }) => o(igual(valor, ""), igual(celda(CLASE_DE[clave]), "")), estilo: SIN_RELLENO },
    ...[5, 4, 3, 2, 1].map((numero, i) => ({
      prioridad: 2 + i,
      columnas: PORCENTAJES,
      cumple: ({ clave, celda }) => igual(celda(CLASE_DE[clave]), numero),
      estilo: degrade(COLOR_DE_CLASE[numero]),
    })),
  ]);

  // --------------------------------------- Valores de referencia --
  // Los de "VR para Evaluaciones" (hoy solo Mayor): PD, PI y el déficit con
  // su n, Promedio, Desv. Estándar y los cinco cortes (en Isquio, de menor a
  // mayor: menos es mejor). "DE": los desvíos de cada corte del déficit
  // (solo se muestran).
  const METRICAS = Object.freeze([
    { clave: "pd", titulo: et("PD", "PD"), formato: "0.00" },
    { clave: "pi", titulo: et("PI", "PE"), formato: "0.00" },
    { clave: "deficit", titulo: et("Deficit", "Déficit"), formato: "0.0%" },
    { clave: "deficit_de", titulo: et("DE", "DE"), formato: "General" },
  ]);

  return Object.freeze({
    id,
    // El área del reporte individual (src/domain/evaluaciones/areas.js).
    area: "zona_media",
    pestana,
    titulo,
    nota: et("", ""),
    columnas: COLUMNAS,
    tiempos: [],
    numeros: NUMEROS,
    metricas: METRICAS,
    filasDeReferencia: FILAS_DE_REFERENCIA,
    entrada,
    calcularFila,
    columnasDelInforme: COLUMNAS_DEL_INFORME,
    informe,
    reglas: REGLAS,
    reglasDelInforme: REGLAS_DEL_INFORME,
    // Al pegar la hoja Funcional entera, cada fila tiene los bloques de
    // varios tests: la que no tiene PD ni PI es de otro test y no se lee.
    saltearFilasSinMedidas: true,
    ayudaParaPegar: AYUDA_FUNCIONAL,
    bloqueParaPegar: bloqueDeFuncional(bloque),
    cabecerasParaPegar: Object.freeze({
      jugador: ["jugador"],
      seleccion: ["seleccion", "selección"],
      fecha: enSuBloque("fecha"),
      pd: enSuBloque("pd"),
      pi: enSuBloque("pi"),
    }),
  });
};

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

// Los formatos de las filas del informe que cambian de un test a otro (los
// del Excel). En Isquio, el % DEFICIT LATERAL del informe tenía formato de
// número (mostraba 0,1 en vez de 10,0%): va en %.
export const MOVILIDAD_TOBILLO = armarTest({
  id: "movilidad_tobillo",
  pestana: et("Movilidad de Tobillo", "Mobilidade de Tornozelo"),
  titulo: et("Movilidad de Tobillo", "Mobilidade de Tornozelo"),
  formatos: { informePdClas: "0.0", informeDeficitClas: "0.0" },
  bloque: "tobillo",
});

export const MOVILIDAD_CADERA = armarTest({
  id: "movilidad_cadera",
  pestana: et("Movilidad de Cadera", "Mobilidade de Quadril"),
  titulo: et("Movilidad de Cadera", "Mobilidade de Quadril"),
  formatos: { informePdClas: "0.00", informeDeficitClas: "0.00" },
  bloque: "cadera",
});

export const MOVILIDAD_ISQUIO = armarTest({
  id: "movilidad_isquio",
  pestana: et("Movilidad de Isquio", "Mobilidade de Isquiotibiais"),
  titulo: et("Movilidad de Isquio", "Mobilidade de Isquiotibiais"),
  menosEsMejor: true,
  formatos: { informePdClas: "0.0", informeDeficitClas: "0.0" },
  bloque: "isquio",
});
