import { categoriaPorCodigo } from "../categorias.js";
import { claseMas, claseMenos, cortesDe } from "../clases.js";
import { absoluto, dividir, esBlanco, esError, esVacio, igual, mayorIgual, menor, restar, siError } from "../excel.js";
import { COLORES, COLOR_DE_CLASE, SIN_RELLENO, degrade, estiloDeClase, letraSobreGris, masDesvios } from "../formatoCondicional.js";

// Saltos: la hoja "Saltos" del Excel BD_evaluaciones («EVALUACIONES DE
// SALTO»). En cada fila, los saltos de un jugador en un día, en cuatro
// bloques: Countermovement, Drop, Squat y Single Leg (con cada pierna). Como
// en Funcional, cada bloque es su propio test, con su n° de evaluación
// (Santiago, 10/10: «es muy parecida a funcional»); al pegar, cada uno toma la
// Fecha, la Selección y el P.C. de la fila. Lo que decidió Santiago el 10/10
// (docs/PENDIENTES.md, "Evaluaciones"):
//   · Drop y Squat tienen sus propios V.R., vacíos por ahora: sus clases
//     quedan vacías hasta que se carguen (en el Excel, Drop usaba los de
//     Countermovement y daba 1 en toda la Fuerza y 5 en toda la Potencia;
//     Squat no tenía clases).
//   · La comparación «Vs …» del informe, como en Zona Media, en los cuatro
//     (en el Excel miraba celdas vacías y en Single Leg no estaba).
//   · Los títulos de las clases que no eran de su medida se corrigieron:
//     «Clas. RM» es «Clas. Altura», «P. Rel. Clas» es «Clas. RSI» y, en Single
//     Leg, la clase del Pico de Fuerza PD es «Clas.PD» (decía «Pot. Clas PD»).

const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });

// O de Excel: si alguno es un error, el resultado es el error.
const o = (...valores) => valores.find(esError) || valores.some(Boolean);

// "Deficit Pierna" dice qué pierna rinde menos: PD, PI o Sin Deficit.
const PIERNA = Object.freeze({
  PD: et("PD", "PD"),
  PI: et("PI", "PE"),
  "Sin Deficit": et("Sin Deficit", "Sem Déficit"),
});

// --------------------------------------------------------- Lo común --

// Lo cargado de una fila, como lo cuenta el Excel.
const entradaDe = (numeros) => (fila) => {
  const datos = fila?.datos || {};
  const numero = (clave) => (typeof datos[clave] === "number" && Number.isFinite(datos[clave]) ? datos[clave] : null);
  return {
    fecha: fila?.fecha || null,
    seleccion: datos.seleccion || null,
    ...Object.fromEntries(numeros.map((clave) => [clave, numero(clave)])),
  };
};

// La clase de una fila contra los V.R. de la categoría de esa fila (como en
// todos los tests; el Excel comparaba siempre contra Mayor). Sin valor, sin
// categoría o sin V.R. de esa categoría, vacía.
const claseDeFila = ({ seleccion, valor, referencias, metrica, clasificar, esCategoria }) => {
  if (esVacio(valor) || esBlanco(seleccion) || !esCategoria(seleccion)) return "";
  const cortes = cortesDe(referencias, seleccion, metrica);
  return cortes ? siError(clasificar(valor, cortes), "") : "";
};

// % mejora: (actual − anterior) / anterior, contra la evaluación anterior del
// jugador que tenga el dato, sin límite de cuántas atrás (como en todos los
// tests; el Excel miraba solo la anterior, por su n°).
const mejoraCon = (anterior) => (actual, clave) => {
  if (esVacio(actual)) return "";
  const previa = anterior(clave);
  if (esVacio(previa)) return "";
  return siError(dividir(restar(actual, previa), previa), "");
};

// Las columnas fijas, en el orden del Excel (la fila 12). El jugador se llama
// «Apellido» en el Excel: acá, «Jugador», como en los otros tests (al pegar
// se entiende cualquiera de los dos). Posición no está; la Fecha Nac. sale de
// Datos básicos. El P.C. (el peso del día) va en los cuatro tests, en el
// primer paso de la carga.
const FIJAS = Object.freeze([
  { clave: "numero", titulo: et("nº Eva", "nº Aval."), tipo: "calculado", formato: "General", fija: true, ancho: 96 },
  { clave: "fecha", titulo: et("Fecha", "Data"), tipo: "fecha", fija: true, ancho: 140 },
  { clave: "seleccion", titulo: et("Selección", "Seleção"), tipo: "lista", fija: true, ancho: 120 },
  { clave: "fecha_nac", titulo: et("Fecha Nac", "Data Nasc."), tipo: "dato_jugador", fija: true, ancho: 120 },
  { clave: "jugador", titulo: et("Jugador", "Jogador"), tipo: "jugador", fija: true, ancho: 168 },
  { clave: "pc", titulo: et("P.C.", "P.C."), tipo: "numero", formato: "0.0", enPrimerPaso: true },
]);

const NOTA = { clave: "nota", titulo: et("Nota", "Nota"), tipo: "texto" };

// Las filas del informe: arriba, la comparación con los V.R. de la categoría
// elegida («Vs …», como en Zona Media: el promedio sobre el "Bueno" y la clase
// del promedio; Santiago, 10/10) y su "Bueno". Después, las filas 5 a 9 del
// Excel con las filas que se ven: Promedios, Desvíos, nº, Máximo y Mínimo.
// Sin ningún número en la columna, vacío (Santiago, 05/10: el Excel mostraba
// #DIV/0! y 0).
const armarInforme = ({ columnas, formatoDe, comparadas }) => {
  const filaDeEstadistica = (est, campo) =>
    Object.fromEntries(
      columnas
        .filter((clave) => campo === "n" || clave !== "numero")
        .map((clave) => {
          const valor = est[clave].n === 0 && campo !== "n" ? "" : est[clave][campo];
          return [clave, { valor, formato: campo === "n" ? "General" : formatoDe(clave, campo) }];
        }),
    );
  return ({ est, referencias, comparar }) => {
    const comparacion = {};
    const referencia = {};
    comparadas.forEach(({ clave, clase, clasificar, formato }) => {
      const cortes = cortesDe(referencias, comparar, clave);
      const bueno = cortes ? cortes[2] : "";
      referencia[clave] = { valor: bueno, formato };
      comparacion[clave] = { valor: siError(dividir(est[clave].promedio, bueno), ""), formato: "0.0%" };
      comparacion[clase] = { valor: cortes ? siError(clasificar(est[clave].promedio, cortes), "") : "", formato: "0" };
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
};

// Los formatos de las filas del informe que no cambian de una columna a otra
// (los del Excel): los Desvíos con un decimal y el Máximo y el Mínimo sin
// decimales; los % mejora y los déficits, en %.
const formatoComun = (campo, esPorcentaje) => {
  if (campo === "desvio") return esPorcentaje ? "0.0%" : "0.0";
  return esPorcentaje ? "0%" : "0";
};

// Los colores. μ y σ: el promedio y el desvío de la columna con las filas
// que se ven. Los colores, los de toda la app.
const mas = (ctx, k) => masDesvios(ctx.promedio, ctx.desvio, k);
const reglasMasEsMejor = (columnas, desde) => [
  { prioridad: desde, columnas, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, 2)), estilo: degrade(COLORES.verdeOscuro) },
  { prioridad: desde + 1, columnas, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, 1)), estilo: degrade(COLORES.verde) },
  { prioridad: desde + 2, columnas, cumple: (ctx) => mayorIgual(ctx.valor, ctx.promedio), estilo: degrade(COLORES.amarillo) },
  { prioridad: desde + 3, columnas, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, -1)), estilo: degrade(COLORES.naranja) },
  { prioridad: desde + 4, columnas, cumple: (ctx) => menor(ctx.valor, mas(ctx, -1)), estilo: degrade(COLORES.rojo) },
];
// Las clases: el número del color de su clase, sobre gris (igual en toda la app).
const reglasDeClases = (columnas, desde) =>
  [5, 4, 3, 2, 1].map((clase, i) => ({ prioridad: desde + i, columnas, cumple: ({ valor }) => igual(valor, clase), estilo: estiloDeClase(clase) }));

// La fila de la comparación: cada porcentaje con el color de la clase de al
// lado, en degradé (como en Zona Media).
const reglasDelInforme = (comparadas) => {
  const claseDe = Object.fromEntries(comparadas.map(({ clave, clase }) => [clave, clase]));
  const porcentajes = comparadas.map(({ clave }) => clave);
  return Object.freeze([
    { prioridad: 1, columnas: porcentajes, cumple: ({ valor, clave, celda }) => o(igual(valor, ""), igual(celda(claseDe[clave]), "")), estilo: SIN_RELLENO },
    ...[5, 4, 3, 2, 1].map((clase, i) => ({
      prioridad: 2 + i,
      columnas: porcentajes,
      cumple: ({ clave, celda }) => igual(celda(claseDe[clave]), clase),
      estilo: degrade(COLOR_DE_CLASE[clase]),
    })),
  ]);
};

// Los V.R. (los de "VR para Evaluaciones"; hoy solo Mayor de Countermovement y
// de Single Leg), con su n, Promedio, Desv. Estándar y los cinco cortes. Las
// clases usan Excelente, Muy Bueno, Bueno y Regular (Malo se muestra).
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

const NOTA_DEL_INFORME = et(
  "*Los Valores pintados corresponden a la comparación entre los datos filtrados y los Valores referenciales de la Categoría seleccionada",
  "*Os valores coloridos correspondem à comparação entre os dados filtrados e os valores de referência da categoria selecionada",
);

// ------------------------------------------------------------ Pegar --
// Se pega la hoja Saltos (entera o hasta el bloque del test). En la fila de
// títulos, "Altura", "Pico de Fuerza", "Pico de Potencia", "RSI-modified" y
// "Nota" se repiten en Countermovement, Drop y Squat: cada test lee los de su
// bloque, sin contar columnas desde la izquierda (Excel no copia las columnas
// ocultas; ver Funcional). Los bloques van de un "Altura" al siguiente (o al
// "Altura PD" de Single Leg): el de Countermovement es el que tiene "Va?";
// los otros dos, Drop y Squat, en ese orden. Si se ve uno solo de ellos, es
// Drop cuando es lo último que se pegó (se copió hasta el fin de Drop); si no,
// no se sabe cuál es (el otro estaba oculto) y no se lee: nunca se cargan los
// datos de un bloque en otro test. Sin "Va?" (oculta) y con los tres bloques,
// el primero es Countermovement.
// titulos: la fila de títulos, ya normalizada. Devuelve { desde, hasta } o null.
export const bloqueDeSaltos = (cual) => (titulos) => {
  const bordes = titulos.flatMap((titulo, i) => (titulo === "altura" || titulo === "altura pd" ? [i] : []));
  const tramos = bordes
    .map((desde, k) => ({ desde, hasta: k + 1 < bordes.length ? bordes[k + 1] : titulos.length }))
    .filter(({ desde }) => titulos[desde] === "altura");
  let countermovement = tramos.find((tramo) => titulos.slice(tramo.desde, tramo.hasta).includes("va")) || null;
  let otros = tramos.filter((tramo) => tramo !== countermovement);
  if (!countermovement && otros.length === 3) [countermovement, ...otros] = otros;
  if (cual === "countermovement") return countermovement;
  if (otros.length === 2) return cual === "drop" ? otros[0] : otros[1];
  if (otros.length === 1 && cual === "drop" && otros[0].hasta === titulos.length) return otros[0];
  return null;
};

// Un título que se busca adentro del bloque del test.
const enSuBloque = (nombre) => ({ nombres: [nombre], vez: 1, enBloque: true });

// Lo que es de la fila (no de un bloque): el jugador, la Selección, la Fecha
// y el P.C.
const CABECERAS_DE_LA_FILA = Object.freeze({
  jugador: ["apellido", "jugador"],
  seleccion: ["seleccion", "selección"],
  fecha: ["fecha"],
  pc: ["p c", "pc"],
});

// --------------------------------- Countermovement, Drop y Squat --
// Los tres bloques tienen las mismas columnas y las mismas fórmulas: cada
// medida con su clase (contra los V.R.) y su % mejora; Countermovement suma
// Va? al final.

const MEDIDAS = Object.freeze([
  {
    clave: "altura",
    titulo: et("Altura", "Altura"),
    clase: et("Clas. Altura", "Clas. Altura"),
    vr: et("Altura", "Altura"),
    formato: "0.0",
    formatoClase: "General",
    promedio: "0.0",
    promedioClase: "0.00",
    pegar: "altura",
  },
  {
    clave: "fuerza",
    titulo: et("Pico de Fuerza", "Pico de Força"),
    clase: et("Clas. N", "Clas. N"),
    vr: et("Fuerza de caida (N)", "Força de queda (N)"),
    formato: "General",
    formatoClase: "General",
    promedio: "0.00",
    promedioClase: "0.00",
    pegar: "pico de fuerza",
  },
  {
    clave: "potencia",
    titulo: et("Pico de Potencia", "Pico de Potência"),
    clase: et("Pot. Clas", "Pot. Clas"),
    vr: et("Pot./Rel.", "Pot./Rel."),
    formato: "0.0",
    formatoClase: "0",
    promedio: "0",
    promedioClase: "0.0",
    pegar: "pico de potencia",
  },
  {
    clave: "rsi",
    titulo: et("RSI-modified [m/s]", "RSI-modified [m/s]"),
    clase: et("Clas. RSI", "Clas. RSI"),
    vr: et("RSI-modified [m/s]", "RSI-modified [m/s]"),
    formato: "0.00",
    formatoClase: "General",
    promedio: "0.0",
    promedioClase: "0.00",
    pegar: "rsi modified m s",
  },
]);

// La ayuda de Pegar desde Excel, la misma en los cuatro tests. Hay valores
// con decimales que no se ven (P.C., un RSI-modified, el Pico de Potencia de
// Single Leg): con la tabla a 15 decimales se copian enteros.
const ayudaDelBloque = (bloque) =>
  et(
    `Es un bloque de la hoja Saltos: copiá la tabla desde la fila de títulos, desde la columna nº Eva hasta el final de ${bloque} (o la hoja entera). Antes de copiar, seleccioná desde la columna P.C. hasta el final y ponele formato Número con 15 decimales: hay valores con decimales que no se ven (después lo podés deshacer). Se leen solo las filas con datos de este test.`,
    `É um bloco da planilha Saltos: copie a tabela a partir da linha de títulos, da coluna nº Eva até o fim de ${bloque} (ou a planilha inteira). Antes de copiar, selecione da coluna P.C. até o fim e coloque formato Número com 15 casas decimais: há valores com decimais que não aparecem (depois você pode desfazer). Só são lidas as linhas com dados deste teste.`,
  );

const armarSalto = ({ id, bloque, pestana, titulo, conVa }) => {
  const numeros = Object.freeze(["pc", ...MEDIDAS.map(({ clave }) => clave)]);

  const columnas = Object.freeze([
    ...FIJAS,
    ...MEDIDAS.flatMap(({ clave, titulo: suTitulo, clase, formato, formatoClase }) => [
      { clave, titulo: suTitulo, tipo: "numero", formato },
      { clave: `${clave}_clas`, titulo: clase, tipo: "calculado", formato: formatoClase },
      // En el Excel, algunos % mejora de Drop y Squat tenían formato General
      // (mostraban 0,05 en vez de 5,0%): van en %, como los otros.
      { clave: `${clave}_mejora`, titulo: et("% mejora", "% melhora"), tipo: "calculado", formato: "0.0%" },
    ]),
    ...(conVa ? [{ clave: "va", titulo: et("Va?", "Va?"), tipo: "calculado", formato: "General" }] : []),
    NOTA,
  ]);

  const calcularFila = ({ entrada: e, numero, total, anterior, referencias, esCategoria = (codigo) => Boolean(categoriaPorCodigo(codigo)) }) => {
    const mejora = mejoraCon(anterior);
    const calculadas = { numero };
    MEDIDAS.forEach(({ clave }) => {
      // IFERROR(IF(x="","",IF(x>=Exc,5,…,IF(x<Reg,1,""))),"").
      calculadas[`${clave}_clas`] = claseDeFila({ seleccion: e.seleccion, valor: e[clave], referencias, metrica: clave, clasificar: claseMas, esCategoria });
      calculadas[`${clave}_mejora`] = mejora(e[clave], clave);
    });
    if (conVa) {
      // Va?: con 7 o menos evaluaciones, el n°; si no, las últimas 7 van de 1
      // a 7 (7 la más nueva) y las anteriores, nada (como el «Va» de Zona Media).
      const atras = total - numero;
      calculadas.va = total <= 7 ? numero : atras >= 0 && atras <= 6 ? 7 - atras : "";
    }
    return calculadas;
  };

  const columnasDelInforme = Object.freeze(["numero", "pc", ...MEDIDAS.flatMap(({ clave }) => [clave, `${clave}_clas`, `${clave}_mejora`])]);
  const PROMEDIOS = Object.fromEntries([["pc", "0"], ...MEDIDAS.flatMap(({ clave, promedio, promedioClase }) => [[clave, promedio], [`${clave}_clas`, promedioClase]])]);
  const formatoDe = (clave, campo) => {
    const esPorcentaje = clave.endsWith("_mejora");
    if (campo === "promedio") return esPorcentaje ? "0.0%" : PROMEDIOS[clave];
    return formatoComun(campo, esPorcentaje);
  };
  const comparadas = MEDIDAS.map(({ clave }) => ({ clave, clase: `${clave}_clas`, clasificar: claseMas, formato: "0.00" }));

  // Las reglas del Excel que pintan algo (en todos los bloques, las mismas).
  // Las medidas y su % mejora: más es mejor, contra μ y σ. Las celdas vacías
  // no se pintan. P.C., Va? y la Nota no se pintan.
  const valores = MEDIDAS.flatMap(({ clave }) => [clave, `${clave}_mejora`]);
  const clases = MEDIDAS.map(({ clave }) => `${clave}_clas`);
  const reglas = Object.freeze([
    { prioridad: 1, columnas: [...valores, ...clases], cumple: ({ valor }) => esVacio(valor), estilo: SIN_RELLENO },
    ...reglasDeClases(clases, 2),
    ...reglasMasEsMejor(valores, 7),
  ]);

  return Object.freeze({
    id,
    // El área del reporte individual (src/domain/evaluaciones/areas.js).
    area: "potencia",
    pestana,
    titulo,
    nota: NOTA_DEL_INFORME,
    columnas,
    tiempos: [],
    numeros,
    metricas: Object.freeze(MEDIDAS.map(({ clave, vr }) => ({ clave, titulo: vr, formato: "0.00" }))),
    filasDeReferencia: FILAS_DE_REFERENCIA,
    entrada: entradaDe(numeros),
    calcularFila,
    columnasDelInforme,
    informe: armarInforme({ columnas: columnasDelInforme, formatoDe, comparadas }),
    reglas,
    reglasDelInforme: reglasDelInforme(comparadas),
    // Al pegar la hoja Saltos, cada fila trae los bloques de los cuatro
    // tests: la que no tiene ninguna medida de este bloque es de otro (el
    // P.C. está en los cuatro: no alcanza).
    saltearFilasSinMedidas: Object.freeze(MEDIDAS.map(({ clave }) => clave)),
    ayudaParaPegar: ayudaDelBloque(bloque),
    bloqueParaPegar: bloqueDeSaltos(id.replace("salto_", "")),
    cabecerasParaPegar: Object.freeze({
      ...CABECERAS_DE_LA_FILA,
      ...Object.fromEntries(MEDIDAS.map(({ clave, pegar }) => [clave, enSuBloque(pegar)])),
      nota: enSuBloque("nota"),
    }),
  });
};

export const SALTO_COUNTERMOVEMENT = armarSalto({
  id: "salto_countermovement",
  bloque: "Countermovement",
  pestana: et("Salto Countermovement", "Salto Countermovement"),
  titulo: et("Evaluaciones de Salto · Countermovement", "Avaliações de Salto · Countermovement"),
  conVa: true,
});

export const SALTO_DROP = armarSalto({
  id: "salto_drop",
  bloque: "Drop",
  pestana: et("Salto Drop", "Salto Drop"),
  titulo: et("Evaluaciones de Salto · Drop", "Avaliações de Salto · Drop"),
  conVa: false,
});

export const SALTO_SQUAT = armarSalto({
  id: "salto_squat",
  bloque: "Squat",
  pestana: et("Salto Squat", "Salto Squat"),
  titulo: et("Evaluaciones de Salto · Squat", "Avaliações de Salto · Squat"),
  conVa: false,
});

// ------------------------------------------------------ Single Leg --
// Con cada pierna (PD, la derecha; PI, la izquierda), cuatro medidas: Altura,
// Pico de Fuerza, Pico de Potencia y RSI-modified. En cada una, la clase y el
// % mejora de cada pierna, el DEFICIT LATERAL (|PI − PD| / la menor) con su
// clase (menos es mejor) y qué pierna rinde menos (DEFICIT PIERNA), como en
// Movilidad. No tiene Va? ni Nota.

const LADOS = Object.freeze([
  {
    clave: "altura",
    grupo: et("Altura", "Altura"),
    pd: et("Altura PD", "Altura PD"),
    pi: et("Altura PI", "Altura PE"),
    clasPd: et("Clas.PD", "Clas.PD"),
    clasPi: et("Clas.PI", "Clas.PE"),
    formato: "General",
    promedio: "0.0",
    pegar: "altura",
  },
  {
    clave: "fuerza",
    grupo: et("Pico de Fuerza", "Pico de Força"),
    pd: et("Pico de Fuerza PD", "Pico de Força PD"),
    pi: et("Pico de Fuerza PI", "Pico de Força PE"),
    clasPd: et("Clas.PD", "Clas.PD"),
    clasPi: et("Clas.PI", "Clas.PE"),
    formato: "General",
    promedio: "0.0",
    pegar: "pico de fuerza",
  },
  {
    clave: "potencia",
    grupo: et("Pico de Potencia", "Pico de Potência"),
    pd: et("Pico de Potencia PD", "Pico de Potência PD"),
    pi: et("Pico de Potencia PI", "Pico de Potência PE"),
    clasPd: et("Pot. Clas PD", "Pot. Clas PD"),
    clasPi: et("Pot. Clas PI", "Pot. Clas PE"),
    formato: "0.0",
    promedio: "0.0",
    pegar: "pico de potencia",
  },
  {
    clave: "rsi",
    grupo: et("RSI-modified", "RSI-modified"),
    pd: et("RSI-modified PD [m/s]", "RSI-modified PD [m/s]"),
    pi: et("RSI-modified PI [m/s]", "RSI-modified PE [m/s]"),
    clasPd: et("Clas. RSI PD", "Clas. RSI PD"),
    clasPi: et("Clas. RSI PI", "Clas. RSI PE"),
    formato: "0.00",
    promedio: "0.00",
    pegar: "rsi modified",
  },
]);

// Las claves de las columnas de una medida.
const clavesDe = (medida) => ({
  pd: `${medida}_pd`,
  pdClas: `${medida}_pd_clas`,
  pdMejora: `${medida}_pd_mejora`,
  pi: `${medida}_pi`,
  piClas: `${medida}_pi_clas`,
  piMejora: `${medida}_pi_mejora`,
  deficit: `${medida}_deficit`,
  deficitClas: `${medida}_deficit_clas`,
  pierna: `${medida}_pierna`,
});

const NUMEROS_SINGLE_LEG = Object.freeze(["pc", ...LADOS.flatMap(({ clave }) => [clavesDe(clave).pd, clavesDe(clave).pi])]);

// Los formatos de los datos: uno por columna (en el Excel, el Pico de
// Potencia cambiaba de fila a fila: «36,7» y «36,66666667»; va con uno, como
// lo mostraba en las filas con decimales). Los % mejora, con dos decimales
// (el RSI, con uno), como en el Excel.
const COLUMNAS_SINGLE_LEG = Object.freeze([
  ...FIJAS,
  ...LADOS.flatMap(({ clave: grupo, pd, pi, clasPd, clasPi, formato }) => {
    const c = clavesDe(grupo);
    const formatoMejora = grupo === "rsi" ? "0.0%" : "0.00%";
    return [
      { clave: c.pd, titulo: pd, tipo: "numero", formato, grupo },
      { clave: c.pdClas, titulo: clasPd, tipo: "calculado", formato: "General", grupo },
      { clave: c.pdMejora, titulo: et("% mejora", "% melhora"), tipo: "calculado", formato: formatoMejora, grupo },
      { clave: c.pi, titulo: pi, tipo: "numero", formato, grupo },
      { clave: c.piClas, titulo: clasPi, tipo: "calculado", formato: "General", grupo },
      { clave: c.piMejora, titulo: et("% mejora", "% melhora"), tipo: "calculado", formato: formatoMejora, grupo },
      { clave: c.deficit, titulo: et("DEFICIT LATERAL", "DÉFICIT LATERAL"), tipo: "calculado", formato: "0.0%", grupo },
      { clave: c.deficitClas, titulo: et("Clas. Deficit", "Clas. Déficit"), tipo: "calculado", formato: "General", grupo },
      { clave: c.pierna, titulo: et("DEFICIT PIERNA", "DÉFICIT PERNA"), tipo: "calculado", formato: "General", valores: PIERNA, grupo },
    ];
  }),
]);

const calcularFilaSingleLeg = ({ entrada: e, numero, anterior, referencias, esCategoria = (codigo) => Boolean(categoriaPorCodigo(codigo)) }) => {
  const mejora = mejoraCon(anterior);
  const clase = (valor, metrica, clasificar) => claseDeFila({ seleccion: e.seleccion, valor, referencias, metrica, clasificar, esCategoria });
  const calculadas = { numero };
  LADOS.forEach(({ clave: medida }) => {
    const c = clavesDe(medida);
    const pd = e[c.pd];
    const pi = e[c.pi];
    // DEFICIT LATERAL: IFERROR(ABS(PI − PD) / IF(PI < PD, PI, PD), ""). Sin
    // una de las dos piernas, vacío (en el Excel también: daba #DIV/0!).
    let deficit = "";
    if (!esBlanco(pd) && !esBlanco(pi)) deficit = siError(dividir(absoluto(restar(pi, pd)), menor(pi, pd) === true ? pi : pd), "");
    // DEFICIT PIERNA: IF(ISBLANK(PD),"",IF(PI<PD,"PI",IF(PI>PD,"PD","Sin
    // Deficit"))). Sin una de las dos piernas, vacío (como en Movilidad; en
    // el Excel, sin PI decía «PI»).
    let pierna = "";
    if (!esBlanco(pd) && !esBlanco(pi)) {
      if (menor(pi, pd) === true) pierna = "PI";
      else if (menor(pd, pi) === true) pierna = "PD";
      else pierna = "Sin Deficit";
    }
    Object.assign(calculadas, {
      [c.pdClas]: clase(pd, c.pd, claseMas),
      [c.pdMejora]: mejora(pd, c.pd),
      [c.piClas]: clase(pi, c.pi, claseMas),
      [c.piMejora]: mejora(pi, c.pi),
      [c.deficit]: deficit,
      // El déficit: menos es mejor.
      [c.deficitClas]: clase(deficit, c.deficit, claseMenos),
      [c.pierna]: pierna,
    });
  });
  return calculadas;
};

const NUMERICAS_SINGLE_LEG = LADOS.flatMap(({ clave }) => {
  const c = clavesDe(clave);
  return [c.pd, c.pdClas, c.pdMejora, c.pi, c.piClas, c.piMejora, c.deficit, c.deficitClas];
});
const COLUMNAS_DEL_INFORME_SINGLE_LEG = Object.freeze(["numero", "pc", ...NUMERICAS_SINGLE_LEG]);

// Los formatos del informe (los del Excel): el Promedio de cada medida con
// uno o dos decimales, el de las clases con dos; los % mejora y el déficit,
// en %.
const TIPO_SINGLE_LEG = Object.fromEntries([
  ["pc", { promedio: "0" }],
  ...LADOS.flatMap(({ clave, promedio }) => {
    const c = clavesDe(clave);
    return [
      [c.pd, { promedio }],
      [c.pi, { promedio }],
      [c.pdClas, { promedio: "0.00" }],
      [c.piClas, { promedio: "0.00" }],
      [c.deficitClas, { promedio: "0.00" }],
      [c.pdMejora, { porcentaje: true }],
      [c.piMejora, { porcentaje: true }],
      [c.deficit, { porcentaje: true }],
    ];
  }),
]);
const formatoDeSingleLeg = (clave, campo) => {
  const { promedio, porcentaje = false } = TIPO_SINGLE_LEG[clave];
  if (campo === "promedio") return porcentaje ? "0.0%" : promedio;
  return formatoComun(campo, porcentaje);
};

const COMPARADAS_SINGLE_LEG = LADOS.flatMap(({ clave }) => {
  const c = clavesDe(clave);
  return [
    { clave: c.pd, clase: c.pdClas, clasificar: claseMas, formato: "0.00" },
    { clave: c.pi, clase: c.piClas, clasificar: claseMas, formato: "0.00" },
    { clave: c.deficit, clase: c.deficitClas, clasificar: claseMenos, formato: "0.0%" },
  ];
});

// Los colores: cada pierna y su % mejora, más es mejor, contra μ y σ; el
// DEFICIT LATERAL no se pinta (como en el Excel). Las clases, con los colores
// de toda clase (Santiago, 05/10): en el Excel, la regla de las clases de
// Single Leg devolvía el texto «Verdadero» y no pintaba nunca (como el negro
// de Tobillo en Funcional). Qué pierna rinde menos, con las letras de Curl
// Nórdico.
const VALORES_SINGLE_LEG = LADOS.flatMap(({ clave }) => {
  const c = clavesDe(clave);
  return [c.pd, c.pdMejora, c.pi, c.piMejora];
});
const CLASES_SINGLE_LEG = LADOS.flatMap(({ clave }) => {
  const c = clavesDe(clave);
  return [c.pdClas, c.piClas, c.deficitClas];
});
const PIERNAS = LADOS.map(({ clave }) => clavesDe(clave).pierna);
const TODAS_SINGLE_LEG = COLUMNAS_SINGLE_LEG.filter((columna) => !columna.fija && columna.clave !== "pc").map((columna) => columna.clave);

const REGLAS_SINGLE_LEG = Object.freeze([
  { prioridad: 1, columnas: TODAS_SINGLE_LEG, cumple: ({ valor }) => esVacio(valor), estilo: SIN_RELLENO },
  ...reglasDeClases(CLASES_SINGLE_LEG, 2),
  ...reglasMasEsMejor(VALORES_SINGLE_LEG, 7),
  { prioridad: 12, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "Sin Deficit"), estilo: letraSobreGris("#7030A0") },
  { prioridad: 13, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "PI"), estilo: letraSobreGris("#984807") },
  { prioridad: 14, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "PD"), estilo: letraSobreGris("#0D0D0D") },
]);

// Los V.R.: una tabla por medida (en el Excel, una sola con las doce
// columnas), con los nombres del Excel.
export const TABLAS_DE_REFERENCIA_SINGLE_LEG = Object.freeze(
  LADOS.map(({ clave, grupo, pd, pi }) => {
    const c = clavesDe(clave);
    return {
      id: clave,
      titulo: grupo,
      metricas: [
        { clave: c.pd, titulo: pd, formato: "0.00" },
        { clave: c.pi, titulo: pi, formato: "0.00" },
        { clave: c.deficit, titulo: et("DEFICIT LATERAL", "DÉFICIT LATERAL"), formato: "0.0%" },
      ],
    };
  }),
);

export const SALTO_SINGLE_LEG = Object.freeze({
  id: "salto_single_leg",
  // El área del reporte individual (src/domain/evaluaciones/areas.js).
  area: "potencia",
  pestana: et("Salto Single Leg", "Salto Single Leg"),
  titulo: et("Evaluaciones de Salto · Single Leg", "Avaliações de Salto · Single Leg"),
  nota: NOTA_DEL_INFORME,
  grupos: Object.freeze(LADOS.map(({ clave, grupo }) => ({ clave, titulo: grupo }))),
  columnas: COLUMNAS_SINGLE_LEG,
  tiempos: [],
  numeros: NUMEROS_SINGLE_LEG,
  metricas: Object.freeze(TABLAS_DE_REFERENCIA_SINGLE_LEG.flatMap((tabla) => tabla.metricas)),
  tablasDeReferencia: TABLAS_DE_REFERENCIA_SINGLE_LEG,
  filasDeReferencia: FILAS_DE_REFERENCIA,
  entrada: entradaDe(NUMEROS_SINGLE_LEG),
  calcularFila: calcularFilaSingleLeg,
  columnasDelInforme: COLUMNAS_DEL_INFORME_SINGLE_LEG,
  informe: armarInforme({ columnas: COLUMNAS_DEL_INFORME_SINGLE_LEG, formatoDe: formatoDeSingleLeg, comparadas: COMPARADAS_SINGLE_LEG }),
  reglas: REGLAS_SINGLE_LEG,
  reglasDelInforme: reglasDelInforme(COMPARADAS_SINGLE_LEG),
  saltearFilasSinMedidas: Object.freeze(NUMEROS_SINGLE_LEG.filter((clave) => clave !== "pc")),
  ayudaParaPegar: ayudaDelBloque("Single Leg"),
  // Los títulos de Single Leg no se repiten: se leen por su nombre.
  cabecerasParaPegar: Object.freeze({
    ...CABECERAS_DE_LA_FILA,
    ...Object.fromEntries(
      LADOS.flatMap(({ clave, pegar }) => {
        const c = clavesDe(clave);
        // "RSI-modified PD [m/s]" se lee "rsi modified pd m s".
        const sufijo = clave === "rsi" ? " m s" : "";
        return [
          [c.pd, [`${pegar} pd${sufijo}`]],
          [c.pi, [`${pegar} pi${sufijo}`]],
        ];
      }),
    ),
  }),
});
