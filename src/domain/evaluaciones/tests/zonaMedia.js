import { categoriaPorCodigo } from "../categorias.js";
import {
  absoluto,
  dividir,
  esBlanco,
  esError,
  esVacio,
  igual,
  mayor,
  mayorIgual,
  menor,
  menorIgual,
  multiplicar,
  promedio,
  restar,
  siError,
  tiempoParaExcel,
  entre,
} from "../excel.js";
import { claseMas, claseMenos, cortesDe } from "../clases.js";
import { COLORES, COLOR_DE_CLASE, SIN_RELLENO, degrade, estiloDeClase, masDesvios } from "../formatoCondicional.js";

// Test Zona Media: la hoja "Test Zona Media Informe" del Excel
// BD_evaluaciones, entera en un solo lugar: sus columnas (con los nombres del
// Excel), cada fórmula, el informe de arriba, el formato condicional con sus
// colores y cómo son sus valores de referencia (V.R.). Lo que el Excel hacía
// distinto por sus límites, va como lo decidió Santiago el 05/10 (anotado en
// cada lugar). Más adelante, lo que sea de cada club pasa a su configuración
// (docs/PENDIENTES.md, "Evaluaciones").

const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });

const ID = "zona_media";

// Las medidas (en segundos: "3:04" son 3 min 04 s; el Excel las guarda como
// horas y minutos).
const TIEMPOS = ["lumbar", "lateral_d", "lateral_i", "prono"];

// Las columnas de los V.R. de cada categoría, en el orden del Excel.
export const METRICAS = Object.freeze([
  { clave: "lumbar", titulo: et("Lumbar", "Lombar"), formato: "tiempo" },
  { clave: "lateral_d", titulo: et("Lateral D", "Lateral D"), formato: "tiempo" },
  { clave: "lateral_i", titulo: et("Lateral I", "Lateral E"), formato: "tiempo" },
  { clave: "def_lat", titulo: et("Def. Lat", "Déf. Lat"), formato: "0.00" },
  { clave: "prono", titulo: et("Prono", "Prono"), formato: "tiempo" },
  { clave: "ratio", titulo: et("Ratio", "Ratio"), formato: "0.00" },
]);

// El resumen de los V.R. ("RESUMEN CATEGORIAS (Promedios)"): por categoría,
// su n y el "Bueno" de estas medidas, en este orden (el del Excel). Su
// columna "Pro" da #REF! en el Excel: va vacía.
const RESUMEN = Object.freeze(["lumbar", "lateral_d", "lateral_i", "prono", "ratio", "def_lat"]);

// Las filas de cada bloque de V.R.: n y los cinco cortes.
export const FILAS_DE_REFERENCIA = Object.freeze([
  { clave: "n", titulo: et("n", "n"), formato: "General" },
  { clave: "excelente", titulo: et("Excelente", "Excelente") },
  { clave: "muy_bueno", titulo: et("Muy Bueno", "Muito Bom") },
  { clave: "bueno", titulo: et("Bueno", "Bom") },
  { clave: "regular", titulo: et("Regular", "Regular") },
  { clave: "malo", titulo: et("Malo", "Ruim") },
]);

// Los cortes de una medida en una categoría (Excelente … Malo, las filas 4 a
// 8 de su bloque), o null sin V.R.: en ../clases.js.
export { cortesDe };

// Las clases "más es mejor" y "menos es mejor" están en ../clases.js; la del
// ratio, acá.

// O y Y de Excel: si alguno es un error, el resultado es el error.
const o = (...valores) => valores.find(esError) || valores.some(Boolean);
const y = (...valores) => valores.find(esError) || valores.every(Boolean);

// El ratio, a los dos lados (de 1 a 3: lo mejor es estar cerca del Bueno):
// IF(OR(x>=Exc,x<=Malo),1,IF(OR(x>=MB,x<=Reg),2,IF(AND(x>Reg,x<MB),3,""))).
const claseRatio = (valor, [excelente, muyBueno, , regular, malo]) => {
  const uno = o(mayorIgual(valor, excelente), menorIgual(valor, malo));
  if (esError(uno)) return uno;
  if (uno) return 1;
  const dos = o(mayorIgual(valor, muyBueno), menorIgual(valor, regular));
  if (esError(dos)) return dos;
  if (dos) return 2;
  const tres = y(mayor(valor, regular), menor(valor, muyBueno));
  if (esError(tres)) return tres;
  return tres ? 3 : "";
};

// La clase de una fila: IF(ISBLANK($G),"",IF($G="Mayor",IF(ISBLANK(x),"",…))).
// Con una selección que no es de la lista, el Excel da FALSO. La lista es la
// del club (la del Excel y las que sume en Ajustes); una categoría sin V.R.
// deja las clases vacías.
const claseDeFila = (seleccion, valor, cortes, clasificar, esCategoria) => {
  if (esBlanco(seleccion)) return "";
  if (!esCategoria(seleccion)) return false;
  if (esBlanco(valor)) return "";
  return cortes ? clasificar(valor, cortes) : "";
};

// Lo cargado de una fila, como lo cuenta el Excel (los tiempos, en días).
const entrada = (fila) => {
  const datos = fila?.datos || {};
  const tiempo = (clave) => tiempoParaExcel(typeof datos[clave] === "number" ? datos[clave] : null);
  return {
    fecha: fila?.fecha || null,
    seleccion: datos.seleccion || null,
    lumbar: tiempo("lumbar"),
    lateral_d: tiempo("lateral_d"),
    lateral_i: tiempo("lateral_i"),
    prono: tiempo("prono"),
    nota: typeof datos.nota === "string" && datos.nota !== "" ? datos.nota : null,
  };
};

// Las fórmulas de cada fila (D, K, L, O, P, R, S, T, U, V, X, Y, Z, AA, AB, AC).
const calcularFila = ({ entrada: e, numero, total, anterior, referencias, esCategoria = (codigo) => Boolean(categoriaPorCodigo(codigo)) }) => {
  const { seleccion } = e;
  const cortes = (metrica) => cortesDe(referencias, seleccion, metrica);

  // % mejora (Santiago, 05/10): la medida contra la misma de la evaluación
  // anterior del jugador que la tenga, sin límite de cuántas atrás. En el
  // Excel, Lateral D, Lateral I y Prono miraban otra columna.
  const mejora = (medida) => {
    if (esBlanco(e[medida])) return "";
    const previa = anterior(medida);
    if (esBlanco(previa)) return "";
    return siError(restar(dividir(e[medida], previa), 1), "");
  };

  // Deficit Lateral %: IFERROR(ABS(T),""), con T, la columna "A" del Excel:
  // IFERROR(IF(($Q-$N)<0,(($Q-$N)/$Q)*100,(($Q-$N)/$N)*100),""). La "A" no
  // se muestra: es el mismo valor con signo (Santiago, 05/10).
  const diferencia = restar(e.lateral_i, e.lateral_d);
  const negativa = menor(diferencia, 0);
  const asimetria = esError(negativa) ? "" : siError(multiplicar(dividir(diferencia, negativa ? e.lateral_i : e.lateral_d), 100), "");
  const deficit = siError(absoluto(asimetria), "");

  // Ratio: IFERROR(W/J,""). Sin Prono, vacío (Santiago, 05/10: el Excel daba
  // 0, con Ratio. Clas 1 en rojo).
  const ratio = esBlanco(e.prono) ? "" : siError(dividir(e.prono, e.lumbar), "");

  const lumbarClas = claseDeFila(seleccion, e.lumbar, cortes("lumbar"), claseMas, esCategoria);
  const lateralDClas = claseDeFila(seleccion, e.lateral_d, cortes("lateral_d"), claseMas, esCategoria);
  const lateralIClas = claseDeFila(seleccion, e.lateral_i, cortes("lateral_i"), claseMas, esCategoria);
  const pronoClas = claseDeFila(seleccion, e.prono, cortes("prono"), claseMas, esCategoria);
  // Sin uno de los laterales no hay déficit que clasificar: vacía (Santiago,
  // 05/10; en el Excel daba 1 en rojo).
  const deficitClas = claseDeFila(seleccion, deficit === "" ? null : deficit, cortes("def_lat"), claseMenos, esCategoria);
  const ratioClas = claseDeFila(seleccion, esVacio(ratio) ? null : ratio, cortes("ratio"), claseRatio, esCategoria);

  // Va: con 7 o menos evaluaciones, el n°; si no, las últimas 7 van de 1 a 7
  // (7 la más nueva) y las anteriores, nada.
  const atras = total - numero;
  let va = "";
  if (total <= 7) va = numero;
  else if (atras >= 0 && atras <= 6) va = 7 - atras;

  return {
    numero,
    lumbar_clas: lumbarClas,
    lumbar_mejora: mejora("lumbar"),
    lateral_d_clas: lateralDClas,
    lateral_d_mejora: mejora("lateral_d"),
    lateral_i_clas: lateralIClas,
    lateral_i_mejora: mejora("lateral_i"),
    deficit,
    deficit_clas: deficitClas,
    prono_clas: pronoClas,
    prono_mejora: mejora("prono"),
    ratio,
    ratio_clas: ratioClas,
    va,
    // PRO??: IFERROR(AVERAGE(K,O,R,X),"").
    pro: siError(promedio([lumbarClas, lateralDClas, lateralIClas, pronoClas]), ""),
  };
};

// ---------------------------------------------------------- Las columnas --
// tipo: calculado (lo calcula la app), fecha, jugador, lista (selección),
// dato_jugador (sale de Datos básicos, como en el Excel salía de "Lista
// Jugadores"), tiempo (minutos y segundos) o texto. formato: el del Excel.
// fija: queda a la vista al correr la tabla (el Excel inmovilizado), con su
// ancho (en píxeles, de borde a borde). Posición no va: no se usa
// (Santiago, 05/10).
export const COLUMNAS = Object.freeze([
  { clave: "numero", titulo: et("nº Eva", "nº Aval."), tipo: "calculado", formato: "General", fija: true, ancho: 96 },
  { clave: "fecha", titulo: et("Fecha", "Data"), tipo: "fecha", fija: true, ancho: 160 },
  { clave: "jugador", titulo: et("Jugador", "Jogador"), tipo: "jugador", fija: true, ancho: 168 },
  { clave: "seleccion", titulo: et("Seleccion", "Seleção"), tipo: "lista", fija: true, ancho: 120 },
  { clave: "fecha_nac", titulo: et("Fecha Nac", "Data Nasc."), tipo: "dato_jugador", fija: true, ancho: 120 },
  { clave: "lumbar", titulo: et("Lumbar", "Lombar"), tipo: "tiempo", formato: "tiempo" },
  { clave: "lumbar_clas", titulo: et("L. Clas", "L. Clas"), tipo: "calculado", formato: "General" },
  { clave: "lumbar_mejora", titulo: et("% mejora", "% melhora"), tipo: "calculado", formato: "0.0%" },
  { clave: "lateral_d", titulo: et("Lateral D", "Lateral D"), tipo: "tiempo", formato: "tiempo" },
  { clave: "lateral_d_clas", titulo: et("L.D. Clas", "L.D. Clas"), tipo: "calculado", formato: "General" },
  { clave: "lateral_d_mejora", titulo: et("% mejora", "% melhora"), tipo: "calculado", formato: "0.0%" },
  { clave: "lateral_i", titulo: et("Lateral I", "Lateral E"), tipo: "tiempo", formato: "tiempo" },
  { clave: "lateral_i_clas", titulo: et("L.I. Clas", "L.E. Clas"), tipo: "calculado", formato: "General" },
  { clave: "lateral_i_mejora", titulo: et("% mejora", "% melhora"), tipo: "calculado", formato: "0.0%" },
  { clave: "deficit", titulo: et("Deficit Lateral %", "Déficit Lateral %"), tipo: "calculado", formato: "0.0" },
  { clave: "deficit_clas", titulo: et("Deficit. Clas", "Déficit. Clas"), tipo: "calculado", formato: "0" },
  { clave: "prono", titulo: et("Prono", "Prono"), tipo: "tiempo", formato: "tiempo" },
  { clave: "prono_clas", titulo: et("P. Clas", "P. Clas"), tipo: "calculado", formato: "General" },
  { clave: "prono_mejora", titulo: et("% mejora", "% melhora"), tipo: "calculado", formato: "0.0%" },
  { clave: "ratio", titulo: et("Ratio", "Ratio"), tipo: "calculado", formato: "0.00" },
  { clave: "ratio_clas", titulo: et("Ratio. Clas", "Ratio. Clas"), tipo: "calculado", formato: "0" },
  { clave: "va", titulo: et("Va", "Va"), tipo: "calculado", formato: "General" },
  { clave: "pro", titulo: et("PRO??", "PRO??"), tipo: "calculado", formato: "0.0" },
  { clave: "nota", titulo: et("Nota", "Nota"), tipo: "texto" },
]);

// ------------------------------------------------------------ El informe --
// Las filas 2 a 8 del Excel, arriba de las columnas, con las filas que se
// ven. La 2 compara el promedio con el "Bueno" de la categoría elegida
// (Vs …) y su clase; la 3 es ese "Bueno"; de la 4 a la 8, SUBTOTAL.

// Las columnas que tienen estadísticas (D solo tiene el nº).
const COLUMNAS_DEL_INFORME = [
  "numero",
  "lumbar",
  "lumbar_clas",
  "lumbar_mejora",
  "lateral_d",
  "lateral_d_clas",
  "lateral_d_mejora",
  "lateral_i",
  "lateral_i_clas",
  "lateral_i_mejora",
  "deficit",
  "deficit_clas",
  "prono",
  "prono_clas",
  "prono_mejora",
  "ratio",
  "ratio_clas",
  "pro",
];

// La medida de cada columna que se compara con los V.R. y su clase al lado.
const COMPARADAS = [
  { clave: "lumbar", metrica: "lumbar", clase: "lumbar_clas", clasificar: claseMas },
  { clave: "lateral_d", metrica: "lateral_d", clase: "lateral_d_clas", clasificar: claseMas },
  { clave: "lateral_i", metrica: "lateral_i", clase: "lateral_i_clas", clasificar: claseMas },
  { clave: "deficit", metrica: "def_lat", clase: "deficit_clas", clasificar: claseMenos },
  { clave: "prono", metrica: "prono", clase: "prono_clas", clasificar: claseMas },
  // El ratio del informe se clasifica como el de cada fila (Santiago, 05/10:
  // toda clase usa la misma regla; en el Excel AA2 tenía otra).
  { clave: "ratio", metrica: "ratio", clase: "ratio_clas", clasificar: claseRatio },
];

// Los formatos de las filas 4 a 8 de cada columna (los del Excel).
const FORMATO_ESTADISTICA = {
  lumbar: "tiempo",
  lateral_d: "tiempo",
  lateral_i: "tiempo",
  prono: "tiempo",
  lumbar_clas: "0.0",
  lateral_d_clas: "0.0",
  lateral_i_clas: "0.0",
  prono_clas: "0.0",
  deficit_clas: "0.0",
  lumbar_mejora: "0.0%",
  lateral_d_mejora: "0.0%",
  lateral_i_mejora: "0.0%",
  prono_mejora: "0.0%",
  deficit: "0.0",
  ratio: "0.00",
  ratio_clas: "0.00",
  pro: "0.00",
};
const FORMATO_EXTREMO = {
  ...FORMATO_ESTADISTICA,
  lumbar_clas: "0",
  lateral_d_clas: "0",
  lateral_i_clas: "0",
  prono_clas: "0",
  deficit_clas: "0",
  deficit: "0",
  ratio: "0.0",
  ratio_clas: "0.0",
  pro: "0.0",
};
// El Excel tiene "0%" en el máximo de % mejora de Prono (Y7).
const FORMATO_MAXIMO = { ...FORMATO_EXTREMO, prono_mejora: "0%" };

// Una fila de estadísticas. Sin ningún número en la columna, el promedio, el
// desvío, el máximo y el mínimo quedan vacíos (Santiago, 05/10: el Excel
// mostraba #DIV/0! y 0).
const filaDeEstadistica = (est, campo, formatos, columnas = COLUMNAS_DEL_INFORME.filter((clave) => clave !== "numero")) =>
  Object.fromEntries(
    columnas.map((clave) => {
      const valor = est[clave].n === 0 && campo !== "n" ? "" : est[clave][campo];
      return [clave, { valor, formato: formatos[clave] || "General" }];
    }),
  );

const informe = ({ est, referencias, comparar }) => {
  const comparacion = {};
  const referencia = {};
  COMPARADAS.forEach(({ clave, metrica, clase, clasificar }) => {
    const cortes = cortesDe(referencias, comparar, metrica);
    // Fila 3: el "Bueno" de la categoría elegida (vacío sin V.R.).
    const bueno = cortes ? cortes[2] : "";
    referencia[clave] = { valor: bueno, formato: FORMATO_ESTADISTICA[clave] === "tiempo" ? "tiempo" : clave === "deficit" ? "0.0" : "0.00" };
    // Fila 2: IFERROR(promedio / Bueno, "") y la clase del promedio.
    comparacion[clave] = { valor: siError(dividir(est[clave].promedio, bueno), ""), formato: "0.00%" };
    comparacion[clase] = { valor: cortes ? siError(clasificar(est[clave].promedio, cortes), "") : "", formato: "0" };
  });
  // AC3: Prono / Lumbar de los promedios (W4/J4).
  referencia.pro = { valor: dividir(est.prono.promedio, est.lumbar.promedio), formato: "0.00" };
  return [
    { id: "comparacion", celdas: comparacion },
    { id: "referencia", celdas: referencia },
    { id: "promedios", rotulo: et("Promedios", "Médias"), celdas: filaDeEstadistica(est, "promedio", FORMATO_ESTADISTICA) },
    { id: "desvios", rotulo: et("Desvíos", "Desvios"), celdas: filaDeEstadistica(est, "desvio", FORMATO_ESTADISTICA) },
    { id: "n", rotulo: et("nº", "nº"), celdas: filaDeEstadistica(est, "n", {}, COLUMNAS_DEL_INFORME) },
    { id: "maximo", rotulo: et("Máximo", "Máximo"), celdas: filaDeEstadistica(est, "maximo", FORMATO_MAXIMO) },
    { id: "minimo", rotulo: et("Mínimo", "Mínimo"), celdas: filaDeEstadistica(est, "minimo", FORMATO_EXTREMO) },
  ];
};

// ------------------------------------------------- Formato condicional --
// Las reglas del Excel que pintan algo, con su prioridad. Las 430 reglas
// "sin color" que tiene la hoja no cambian nada y no están. Los rangos del
// Excel terminaban en distintas filas (511, 865…): acá cada regla vale para
// toda la columna, con la de las primeras filas.

const CLASES = ["lumbar_clas", "lateral_d_clas", "lateral_i_clas", "deficit_clas", "prono_clas", "ratio_clas"];

const sinDatos = ({ valor }) => esVacio(valor);
const desde = (k) => (ctx) => mayorIgual(ctx.valor, masDesvios(ctx.promedio, ctx.desvio, k));
const debajoDe = (k) => (ctx) => menor(ctx.valor, masDesvios(ctx.promedio, ctx.desvio, k));
const claseIgual = (clase) => ({ valor }) => igual(valor, clase);
const entreValores = (minimo, maximo) => ({ valor }) => y(mayorIgual(valor, minimo), menor(valor, maximo));

export const REGLAS = Object.freeze([
  // Ratio (Z12:Z511): a los dos lados de su promedio, de a medio desvío.
  { prioridad: 1, columnas: ["ratio"], cumple: sinDatos, estilo: SIN_RELLENO },
  { prioridad: 2, columnas: ["ratio"], cumple: desde(1), estilo: degrade(COLORES.rojo) },
  { prioridad: 3, columnas: ["ratio"], cumple: desde(0.5), estilo: degrade(COLORES.naranja) },
  { prioridad: 4, columnas: ["ratio"], cumple: desde(-0.5), estilo: degrade(COLORES.amarillo) },
  { prioridad: 5, columnas: ["ratio"], cumple: desde(-1), estilo: degrade(COLORES.naranja) },
  { prioridad: 6, columnas: ["ratio"], cumple: debajoDe(-1), estilo: degrade(COLORES.rojo) },
  // Las celdas vacías no se pintan (OR(ISBLANK(J12),J12="")).
  { prioridad: 31, columnas: [...TIEMPOS, "deficit", "pro", ...CLASES], cumple: sinDatos, estilo: SIN_RELLENO },
  // Déficit (U): menos es mejor.
  { prioridad: 37, columnas: ["deficit"], cumple: (ctx) => mayor(ctx.valor, masDesvios(ctx.promedio, ctx.desvio, 1.75)), estilo: degrade(COLORES.rojo) },
  { prioridad: 38, columnas: ["deficit"], cumple: (ctx) => entre(ctx.valor, ctx.promedio, masDesvios(ctx.promedio, ctx.desvio, 1.75)), estilo: degrade(COLORES.naranja) },
  { prioridad: 39, columnas: ["deficit"], cumple: (ctx) => entre(ctx.valor, ctx.promedio, masDesvios(ctx.promedio, ctx.desvio, -0.75)), estilo: degrade(COLORES.amarillo) },
  {
    prioridad: 40,
    columnas: ["deficit"],
    cumple: (ctx) => entre(ctx.valor, masDesvios(ctx.promedio, ctx.desvio, -0.75), masDesvios(ctx.promedio, ctx.desvio, -1.25)),
    estilo: degrade(COLORES.verde),
  },
  { prioridad: 41, columnas: ["deficit"], cumple: (ctx) => menor(ctx.valor, masDesvios(ctx.promedio, ctx.desvio, -1.25)), estilo: degrade(COLORES.verdeOscuro) },
  // Los tiempos: contra su promedio y su desvío.
  { prioridad: 42, columnas: TIEMPOS, cumple: desde(2), estilo: degrade(COLORES.verdeOscuro) },
  { prioridad: 43, columnas: TIEMPOS, cumple: desde(1), estilo: degrade(COLORES.verde) },
  { prioridad: 44, columnas: TIEMPOS, cumple: (ctx) => mayorIgual(ctx.valor, ctx.promedio), estilo: degrade(COLORES.amarillo) },
  { prioridad: 45, columnas: TIEMPOS, cumple: desde(-1), estilo: degrade(COLORES.naranja) },
  { prioridad: 46, columnas: TIEMPOS, cumple: debajoDe(-1), estilo: degrade(COLORES.rojo) },
  // Las clases: el número en negrita sobre el color de su clase (igual en
  // toda la app: Santiago, 09/10; en el Excel, del color de su clase sobre gris).
  ...[5, 4, 3, 2, 1].map((clase, i) => ({ prioridad: 47 + i, columnas: CLASES, cumple: claseIgual(clase), estilo: estiloDeClase(clase) })),
  // PRO??: el promedio de las clases, por tramos, con el estilo de la clase
  // de su tramo.
  { prioridad: 292, columnas: ["pro"], cumple: ({ valor }) => mayorIgual(valor, 4.2), estilo: estiloDeClase(5) },
  { prioridad: 293, columnas: ["pro"], cumple: entreValores(3.4, 4.2), estilo: estiloDeClase(4) },
  { prioridad: 294, columnas: ["pro"], cumple: entreValores(2.6, 3.4), estilo: estiloDeClase(3) },
  { prioridad: 295, columnas: ["pro"], cumple: entreValores(1.8, 2.6), estilo: estiloDeClase(2) },
  { prioridad: 311, columnas: ["pro"], cumple: entreValores(1, 1.8), estilo: estiloDeClase(1) },
]);

// La fila 2 del informe: cada porcentaje con el color de su clase (la celda
// de al lado), en degradé.
const CLASE_DE = Object.fromEntries(COMPARADAS.map(({ clave, clase }) => [clave, clase]));
const PORCENTAJES = COMPARADAS.map(({ clave }) => clave);

export const REGLAS_DEL_INFORME = Object.freeze([
  { prioridad: 25, columnas: PORCENTAJES, cumple: ({ valor, clave, celda }) => o(igual(valor, ""), igual(celda(CLASE_DE[clave]), "")), estilo: SIN_RELLENO },
  ...[5, 4, 3, 2, 1].map((clase, i) => ({
    prioridad: 26 + i,
    columnas: PORCENTAJES,
    cumple: ({ clave, celda }) => igual(celda(CLASE_DE[clave]), clase),
    estilo: degrade(COLOR_DE_CLASE[clase]),
  })),
]);

// ---------------------------------------------------------------- Pegar --
// Lo que se trae al pegar la tabla del Excel (lo cargado a mano), por el
// nombre de su columna en la fila de títulos. Lo calculado no se trae: lo
// calcula la app.
export const CABECERAS_PARA_PEGAR = Object.freeze({
  fecha: ["fecha"],
  jugador: ["jugador"],
  seleccion: ["seleccion", "selección"],
  lumbar: ["lumbar"],
  lateral_d: ["lateral d"],
  lateral_i: ["lateral i"],
  prono: ["prono"],
  nota: ["nota"],
});

export const ZONA_MEDIA = Object.freeze({
  id: ID,
  // El área del reporte individual (src/domain/evaluaciones/areas.js).
  area: "zona_media",
  pestana: et("Zona Media", "Zona Média"),
  titulo: et('Evaluación Zona Media "CORE"', 'Avaliação Zona Média "CORE"'),
  nota: et(
    "*Los Valores pintados corresponden a la comparación entre los datos filtrados y los Valores referenciales de la Categoría seleccionada",
    "*Os valores coloridos correspondem à comparação entre os dados filtrados e os valores de referência da categoria selecionada",
  ),
  columnas: COLUMNAS,
  tiempos: TIEMPOS,
  metricas: METRICAS,
  filasDeReferencia: FILAS_DE_REFERENCIA,
  resumen: RESUMEN,
  entrada,
  calcularFila,
  columnasDelInforme: COLUMNAS_DEL_INFORME,
  informe,
  reglas: REGLAS,
  reglasDelInforme: REGLAS_DEL_INFORME,
  cabecerasParaPegar: CABECERAS_PARA_PEGAR,
});

export default ZONA_MEDIA;
