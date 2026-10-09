import { categoriaPorCodigo } from "../categorias.js";
import { claseMas, claseMenos, claseRatio, cortesDe } from "../clases.js";
import { absoluto, dividir, esBlanco, esVacio, igual, mayor, mayorIgual, menor, menorIgual, restar, siError, subtotal } from "../excel.js";
import { COLORES, SIN_RELLENO, degrade, estiloDeClase, letraSobreGris, masDesvios } from "../formatoCondicional.js";

// Isocinecia: la hoja "Isocinecia" del Excel BD_evaluaciones, entera en un
// solo lugar. Es el test isocinético de rodilla (extensión y flexión, pierna
// derecha PD e izquierda PI) a tres velocidades, 60°, 180° y 300°, en la
// misma fila: un solo test, con un selector de velocidad en la Base como los
// botones del Excel (Santiago, 09/10: «Un test + selector»). Cada velocidad
// tiene cinco medidas: Peak TQ/BW, Work/BW y Average Power (con su clase, su
// % de mejora, el déficit entre piernas, qué pierna rinde menos y el ratio
// Ant/Ago, flexión ÷ extensión), Work Fatigue (su clase, menos es mejor, y
// el ratio) y ROM (como las primeras, sin ratio).
// Lo que se decidió (docs/PENDIENTES.md, "Evaluaciones"): las clases contra
// los V.R. de la categoría de cada fila; el N° del informe cuenta datos y las
// cuentas de PD / PI respetan el filtro; % de mejora contra la evaluación
// anterior que tenga la medida; sin una de las dos piernas, "Deficit Pierna"
// vacío; una división por cero, vacía; los colores, los de toda la app.

const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });

const ID = "isocinecia";

// Las velocidades (los bloques de 87 columnas del Excel).
export const VELOCIDADES = Object.freeze([
  { clave: "v60", grados: 60 },
  { clave: "v180", grados: 180 },
  { clave: "v300", grados: 300 },
]);

// Las medidas de cada velocidad, con su nombre en el Excel (la fila 14) y el
// que usa la fila 16 ("Peak TQ/BW Ext Right 60"), que es por el que se pega.
const MEDIDAS = Object.freeze({
  peak: { titulo: "Peak TQ/BW", enExcel: "Peak TQ/BW" },
  work: { titulo: "Work/BW", enExcel: "Work/BW" },
  avg: { titulo: "Average Power", enExcel: "AVG Power" },
  wf: { titulo: "Work Fatigue", enExcel: "Work Fatigue" },
  rom: { titulo: "ROM", enExcel: "ROM" },
});
// Las que tienen % de mejora, déficit y ratio (Work Fatigue tiene solo la
// clase y el ratio; ROM, todo menos el ratio).
const COMPLETAS = Object.freeze(["peak", "work", "avg"]);

// Los movimientos (la fila 15 del Excel, en portugués: EXTENSAO, FLEXAO y
// FLEXAO/EXTENSAO).
const MOVIMIENTOS = Object.freeze({
  ext: { titulo: et("Extensión", "Extensão"), enExcel: "Ext" },
  flex: { titulo: et("Flexión", "Flexão"), enExcel: "Fle" },
  ratio: { titulo: et("Flexión/Extensión", "Flexão/Extensão") },
});

// ---------------------------------------------------------- Las claves --

const k = (v, ...partes) => [v, ...partes].join("_");
// Las de una medida con piernas (Peak, Work, AVG y ROM) en un movimiento.
const clavesDePiernas = (base) => ({
  pd: `${base}_pd`,
  pdClas: `${base}_pd_clas`,
  pdMejora: `${base}_pd_mejora`,
  pi: `${base}_pi`,
  piClas: `${base}_pi_clas`,
  piMejora: `${base}_pi_mejora`,
  deficit: `${base}_deficit`,
  deficitClas: `${base}_deficit_clas`,
  pierna: `${base}_pierna`,
});
const clavesDeRatio = (base) => ({ pd: `${base}_ratio_pd`, pdClas: `${base}_ratio_pd_clas`, pi: `${base}_ratio_pi`, piClas: `${base}_ratio_pi_clas` });

// Lo que se carga: el peso del día y, por velocidad, las 18 medidas.
const ENTRADAS = VELOCIDADES.flatMap(({ clave: v }) => [
  ...COMPLETAS.flatMap((m) => ["ext", "flex"].flatMap((mov) => [k(v, m, mov, "pd"), k(v, m, mov, "pi")])),
  ...["ext", "flex"].flatMap((mov) => [k(v, "wf", mov, "pd"), k(v, "wf", mov, "pi")]),
  k(v, "rom", "pd"),
  k(v, "rom", "pi"),
]);
export const NUMEROS = Object.freeze(["pc", ...ENTRADAS]);

// ---------------------------------------------------------- Las columnas --
// Los nombres, los cortos de la fila 17 (en 300° el Excel repite ahí los
// largos de la fila 16: van los cortos, como en 60° y 180°). Encima, cada
// grupo: la medida, la velocidad y el movimiento (las filas 14 y 15).
const PIERNA = Object.freeze({
  PD: et("PD", "PD"),
  PI: et("PI", "PE"),
  "Sin Deficit": et("Sin Deficit", "Sem Déficit"),
});

const T = Object.freeze({
  pd: et("PD", "PD"),
  pi: et("PI", "PE"),
  pdClas: et("Clas PD", "Clas PD"),
  piClas: et("Clas PI", "Clas PE"),
  pdMejora: et("% Mejora PD", "% Melhora PD"),
  piMejora: et("% Mejora PI", "% Melhora PE"),
  deficit: et("% Deficit", "% Déficit"),
  deficitClas: et("Clas Deficit", "Clas Déficit"),
  pierna: et("Deficit Pierna", "Déficit Perna"),
  ratioPd: et("Ant/Ago PD", "Ant/Ago PD"),
  ratioPi: et("Ant/Ago PI", "Ant/Ago PE"),
  ratioPdClas: et("Clas Ratio PD", "Clas Ratio PD"),
  ratioPiClas: et("Clas Ratio PI", "Clas Ratio PE"),
});

const tituloDeMedida = (m, grados) => et(`${MEDIDAS[m].titulo} ${grados}°`, `${MEDIDAS[m].titulo} ${grados}°`);
const conMovimiento = (m, grados, mov) => et(`${MEDIDAS[m].titulo} ${grados}° · ${MOVIMIENTOS[mov].titulo["es-AR"]}`, `${MEDIDAS[m].titulo} ${grados}° · ${MOVIMIENTOS[mov].titulo["pt-BR"]}`);

// Los grupos de la tabla: la medida, la velocidad y el movimiento (ROM no
// tiene movimiento).
export const GRUPOS = Object.freeze(
  VELOCIDADES.flatMap(({ clave: v, grados }) =>
    Object.keys(MEDIDAS).flatMap((m) =>
      m === "rom" ? [{ clave: k(v, m), titulo: tituloDeMedida(m, grados) }] : ["ext", "flex", "ratio"].map((mov) => ({ clave: k(v, m, mov), titulo: conMovimiento(m, grados, mov) })),
    ),
  ),
);

const numero = (clave, titulo, extra) => ({ clave, titulo, tipo: "numero", formato: "General", ...extra });
const calculada = (clave, titulo, formato, extra) => ({ clave, titulo, tipo: "calculado", formato, ...extra });

const columnasDePiernas = (c, extra, { conMejora = true, conDeficit = true } = {}) => [
  numero(c.pd, T.pd, extra),
  calculada(c.pdClas, T.pdClas, "General", extra),
  ...(conMejora ? [calculada(c.pdMejora, T.pdMejora, "0.0%", extra)] : []),
  numero(c.pi, T.pi, extra),
  calculada(c.piClas, T.piClas, "General", extra),
  ...(conMejora ? [calculada(c.piMejora, T.piMejora, "0.0%", extra)] : []),
  ...(conDeficit ? [calculada(c.deficit, T.deficit, "0.0%", extra), calculada(c.deficitClas, T.deficitClas, "General", extra), calculada(c.pierna, T.pierna, "General", { ...extra, valores: PIERNA })] : []),
];

const columnasDeRatio = (c, formato, extra) => [
  calculada(c.pd, T.ratioPd, formato, extra),
  calculada(c.pdClas, T.ratioPdClas, "General", extra),
  calculada(c.pi, T.ratioPi, formato, extra),
  calculada(c.piClas, T.ratioPiClas, "General", extra),
];

const columnasDeVelocidad = ({ clave: v }) => [
  ...COMPLETAS.flatMap((m) => [
    ...columnasDePiernas(clavesDePiernas(k(v, m, "ext")), { vista: v, grupo: k(v, m, "ext") }),
    ...columnasDePiernas(clavesDePiernas(k(v, m, "flex")), { vista: v, grupo: k(v, m, "flex") }),
    ...columnasDeRatio(clavesDeRatio(k(v, m)), "0.00", { vista: v, grupo: k(v, m, "ratio") }),
  ]),
  ...["ext", "flex"].flatMap((mov) => columnasDePiernas(clavesDePiernas(k(v, "wf", mov)), { vista: v, grupo: k(v, "wf", mov) }, { conMejora: false, conDeficit: false })),
  ...columnasDeRatio(clavesDeRatio(k(v, "wf")), "0.0", { vista: v, grupo: k(v, "wf", "ratio") }),
  ...columnasDePiernas(clavesDePiernas(k(v, "rom")), { vista: v, grupo: k(v, "rom") }),
];

// Quedan a la vista al correr la tabla, como el Excel inmovilizado (el P.C.
// no, para que se vea su informe, como en Curl Nórdico).
export const COLUMNAS = Object.freeze([
  { clave: "jugador", titulo: et("Jugador", "Jogador"), tipo: "jugador", fija: true, ancho: 168 },
  { clave: "fecha", titulo: et("Fecha", "Data"), tipo: "fecha", fija: true, ancho: 140 },
  { clave: "numero", titulo: et("Nº Evaluacion", "Nº Avaliação"), tipo: "calculado", formato: "General", fija: true, ancho: 104 },
  { clave: "seleccion", titulo: et("Seleccion", "Seleção"), tipo: "lista", fija: true, ancho: 120 },
  { clave: "pc", titulo: et("P.C.", "P.C."), tipo: "numero", formato: "0.0" },
  ...VELOCIDADES.flatMap(columnasDeVelocidad),
]);

// El selector de la Base (los botones "60 Grados", "180 Grados", "300 Grados"
// y "Tudo" del Excel): qué velocidad se ve.
export const VISTAS = Object.freeze({
  rotulo: et("Velocidad", "Velocidade"),
  opciones: VELOCIDADES.map(({ clave, grados }) => ({ clave, titulo: et(`${grados}°`, `${grados}°`) })),
  todas: et("Todas", "Todas"),
});

// ------------------------------------------------------------ Las cuentas --

// Lo cargado de una fila, como lo cuenta el Excel.
const entrada = (fila) => {
  const datos = fila?.datos || {};
  const numeroDe = (clave) => (typeof datos[clave] === "number" && Number.isFinite(datos[clave]) ? datos[clave] : null);
  return {
    fecha: fila?.fecha || null,
    seleccion: datos.seleccion || null,
    ...Object.fromEntries(NUMEROS.map((clave) => [clave, numeroDe(clave)])),
  };
};

// La clase de una fila contra los V.R. de su categoría (como en Curl
// Nórdico: Santiago, 09/10; el Excel comparaba siempre contra Mayor). Sin
// valor, sin categoría o sin V.R. de esa categoría, vacía.
const claseDeFila = ({ seleccion, valor, referencias, metrica, clasificar, esCategoria }) => {
  if (esVacio(valor) || esBlanco(seleccion) || !esCategoria(seleccion)) return "";
  const cortes = cortesDe(referencias, seleccion, metrica);
  return cortes ? siError(clasificar(valor, cortes), "") : "";
};

const calcularFila = ({ entrada: e, numero: n, anterior, referencias, esCategoria = (codigo) => Boolean(categoriaPorCodigo(codigo)) }) => {
  const calculadas = { numero: n };
  const clase = (valor, metrica, clasificar) => claseDeFila({ seleccion: e.seleccion, valor, referencias, metrica, clasificar, esCategoria });
  // % Mejora: contra la evaluación anterior del jugador que tenga la medida,
  // sin límite (Santiago, 05/10; el Excel miraba solo la n° − 1):
  // IF((x−prev)>0,(x−prev)/prev,−(prev−x)/prev), o sea (x − prev) / prev.
  const mejora = (clave) => {
    if (esBlanco(e[clave])) return "";
    const previa = anterior(clave);
    if (esVacio(previa)) return "";
    return siError(dividir(restar(e[clave], previa), previa), "");
  };
  // Una medida con las dos piernas (Peak, Work, AVG y ROM).
  const piernas = (c) => {
    // % Deficit: IFERROR(ABS(PI−PD)/IF(PI<PD,PI,PD),""): cuánto le saca la
    // fuerte a la débil (sin una de las dos, la vacía cuenta 0 y da vacío).
    const deficit = siError(dividir(absoluto(restar(e[c.pi], e[c.pd])), menor(e[c.pi], e[c.pd]) === true ? e[c.pi] : e[c.pd]), "");
    // Deficit Pierna: IF(ISBLANK(PD),"",IF(PI<PD,"PI",IF(PI>PD,"PD","Sin
    // Deficit"))); sin una de las dos piernas, vacío (el Excel ponía "PI"
    // con la izquierda vacía).
    let pierna = "";
    if (!esBlanco(e[c.pd]) && !esBlanco(e[c.pi])) {
      if (menor(e[c.pi], e[c.pd]) === true) pierna = "PI";
      else if (mayor(e[c.pi], e[c.pd]) === true) pierna = "PD";
      else pierna = "Sin Deficit";
    }
    Object.assign(calculadas, {
      [c.pdClas]: clase(e[c.pd], c.pd, claseMas),
      [c.pdMejora]: mejora(c.pd),
      [c.piClas]: clase(e[c.pi], c.pi, claseMas),
      [c.piMejora]: mejora(c.pi),
      [c.deficit]: deficit,
      [c.deficitClas]: clase(deficit, c.deficit, claseMenos),
      [c.pierna]: pierna,
    });
  };
  // Ant/Ago: IF(OR(Ext="",Flex=""),"",Flex/Ext); con la extensión en 0, vacío
  // (el Excel mostraba #DIV/0!). Su clase, a los dos lados (1 a 3).
  const ratio = (c, flexion, extension) => {
    const deUnLado = (flex, ext) => (esBlanco(flex) || esBlanco(ext) ? "" : siError(dividir(flex, ext), ""));
    const pd = deUnLado(e[flexion.pd], e[extension.pd]);
    const pi = deUnLado(e[flexion.pi], e[extension.pi]);
    Object.assign(calculadas, { [c.pd]: pd, [c.pdClas]: clase(pd, c.pd, claseRatio), [c.pi]: pi, [c.piClas]: clase(pi, c.pi, claseRatio) });
  };
  VELOCIDADES.forEach(({ clave: v }) => {
    COMPLETAS.forEach((m) => {
      const ext = clavesDePiernas(k(v, m, "ext"));
      const flex = clavesDePiernas(k(v, m, "flex"));
      piernas(ext);
      piernas(flex);
      ratio(clavesDeRatio(k(v, m)), flex, ext);
    });
    // Work Fatigue: solo su clase (menos es mejor) y el ratio.
    const ext = clavesDePiernas(k(v, "wf", "ext"));
    const flex = clavesDePiernas(k(v, "wf", "flex"));
    [ext, flex].forEach((c) => Object.assign(calculadas, { [c.pdClas]: clase(e[c.pd], c.pd, claseMenos), [c.piClas]: clase(e[c.pi], c.pi, claseMenos) }));
    ratio(clavesDeRatio(k(v, "wf")), flex, ext);
    piernas(clavesDePiernas(k(v, "rom")));
  });
  return calculadas;
};

// ------------------------------------------------------------ El informe --
// Las filas 9 a 13 del Excel, con las filas que se ven: N° (cuántos datos:
// Santiago, 09/10), Promedio, Desvío, Máximo y Mínimo. No compara con los
// V.R. (no tiene "Vs …"). En las columnas de Deficit Pierna, cuántas PD, PI
// y Sin Deficit hay (en el Excel, sin respetar el filtro; acá, con el filtro,
// como en Curl Nórdico), con el formato del Excel (0.0).

const COLUMNAS_DE_VELOCIDADES = COLUMNAS.filter((columna) => columna.vista);
const PIERNAS = COLUMNAS_DE_VELOCIDADES.filter((columna) => columna.valores === PIERNA).map((columna) => columna.clave);
const COLUMNAS_DEL_INFORME = Object.freeze(["numero", "pc", ...COLUMNAS_DE_VELOCIDADES.filter((columna) => !PIERNAS.includes(columna.clave)).map((columna) => columna.clave)]);

// Los formatos de las filas 10 a 13: las medidas y las clases con un decimal,
// los porcentajes con su %, los ratios con uno (en 300°, el de Peak con dos).
const formatoDelInforme = (clave) => {
  const columna = COLUMNAS.find((una) => una.clave === clave);
  if (columna?.formato === "0.0%") return "0.0%";
  if (clave === "v300_peak_ratio_pd" || clave === "v300_peak_ratio_pi") return "0.00";
  return "0.0";
};

const filaDeEstadistica = (est, campo) =>
  Object.fromEntries(
    COLUMNAS_DEL_INFORME.filter((clave) => campo === "n" || clave !== "numero").map((clave) => {
      // Sin ningún número en la columna, vacío (Santiago, 05/10: el Excel
      // mostraba #DIV/0! y 0).
      const valor = est[clave].n === 0 && campo !== "n" ? "" : est[clave][campo];
      return [clave, { valor, formato: campo === "n" ? "General" : formatoDelInforme(clave) }];
    }),
  );

const CUENTAS = [
  { fila: "promedios", valor: "PD" },
  { fila: "desvios", valor: "PI" },
  { fila: "maximo", valor: "Sin Deficit" },
];

const informe = ({ est, filas = [] }) => {
  const porFila = { n: filaDeEstadistica(est, "n"), promedios: filaDeEstadistica(est, "promedio"), desvios: filaDeEstadistica(est, "desvio"), maximo: filaDeEstadistica(est, "maximo"), minimo: filaDeEstadistica(est, "minimo") };
  PIERNAS.forEach((clave) => {
    // N°: cuántas tienen PD, PI o Sin Deficit.
    porFila.n[clave] = { valor: subtotal(2, filas.map((celdas) => (typeof celdas[clave] === "string" && celdas[clave] !== "" ? 1 : null))), formato: "General" };
    CUENTAS.forEach(({ fila, valor }) => {
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
// Las 22 reglas del Excel, con su prioridad. μ y σ: el promedio y el desvío
// de la columna con las filas que se ven. Los colores, los de toda la app
// (Santiago, 09/10; esta hoja tenía otro verde oscuro y otro naranja en los
// degradé), y las letras de PD / PI / Sin Deficit, las mismas de Curl Nórdico.

const TODAS = COLUMNAS_DE_VELOCIDADES.map((columna) => columna.clave);
const CLASES = TODAS.filter((clave) => clave.endsWith("_clas"));
const RATIOS = TODAS.filter((clave) => /_ratio_p[di]$/.test(clave));
const DEFICITS = TODAS.filter((clave) => clave.endsWith("_deficit"));
const FATIGA = TODAS.filter((clave) => /_wf_(ext|flex)_p[di]$/.test(clave));
const MEJORAS = TODAS.filter((clave) => clave.endsWith("_mejora"));
const MEDIDAS_MAS = ENTRADAS.filter((clave) => !FATIGA.includes(clave));
const MENOS_ES_MEJOR = [...DEFICITS, ...FATIGA];
const MAS_ES_MEJOR = [...MEDIDAS_MAS, ...MEJORAS];

const y = (...valores) => valores.find((valor) => valor && typeof valor === "object") || valores.every((valor) => valor === true);
const o = (...valores) => valores.find((valor) => valor && typeof valor === "object") || valores.some((valor) => valor === true);
const mas = (ctx, d) => masDesvios(ctx.promedio, ctx.desvio, d);

export const REGLAS = Object.freeze([
  // Las celdas vacías no se pintan y no se miran las demás reglas:
  // OR(G18="",ISBLANK(G18)), con "Detener si es verdad".
  { prioridad: 1, columnas: TODAS, cumple: ({ valor }) => esVacio(valor), estilo: SIN_RELLENO, detener: true },
  // Las clases: el número del color de su clase, sobre gris (igual en toda la app).
  ...[5, 4, 3, 2, 1].map((clase, i) => ({ prioridad: 2 + i, columnas: CLASES, cumple: ({ valor }) => igual(valor, clase), estilo: estiloDeClase(clase) })),
  // Qué pierna rinde menos: una letra de color en negrita sobre gris.
  { prioridad: 7, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "Sin Deficit"), estilo: letraSobreGris("#7030A0") },
  { prioridad: 8, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "PI"), estilo: letraSobreGris("#984807") },
  { prioridad: 9, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "PD"), estilo: letraSobreGris("#0D0D0D") },
  // Los déficits y Work Fatigue: menos es mejor.
  { prioridad: 10, columnas: MENOS_ES_MEJOR, cumple: (ctx) => mayor(ctx.valor, mas(ctx, 1)), estilo: degrade(COLORES.rojo) },
  { prioridad: 11, columnas: MENOS_ES_MEJOR, cumple: (ctx) => y(mayor(ctx.valor, ctx.promedio), menorIgual(ctx.valor, mas(ctx, 1))), estilo: degrade(COLORES.naranja) },
  { prioridad: 12, columnas: MENOS_ES_MEJOR, cumple: (ctx) => y(mayor(ctx.valor, mas(ctx, -1)), menorIgual(ctx.valor, ctx.promedio)), estilo: degrade(COLORES.amarillo) },
  { prioridad: 13, columnas: MENOS_ES_MEJOR, cumple: (ctx) => y(mayor(ctx.valor, mas(ctx, -2)), menorIgual(ctx.valor, mas(ctx, -1))), estilo: degrade(COLORES.verde) },
  { prioridad: 14, columnas: MENOS_ES_MEJOR, cumple: (ctx) => menorIgual(ctx.valor, mas(ctx, -2)), estilo: degrade(COLORES.verdeOscuro) },
  // Las medidas y sus % de mejora: más es mejor.
  { prioridad: 15, columnas: MAS_ES_MEJOR, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, 2)), estilo: degrade(COLORES.verdeOscuro) },
  { prioridad: 16, columnas: MAS_ES_MEJOR, cumple: (ctx) => y(menor(ctx.valor, mas(ctx, 2)), mayorIgual(ctx.valor, mas(ctx, 1))), estilo: degrade(COLORES.verde) },
  { prioridad: 17, columnas: MAS_ES_MEJOR, cumple: (ctx) => y(menor(ctx.valor, mas(ctx, 1)), mayorIgual(ctx.valor, ctx.promedio)), estilo: degrade(COLORES.amarillo) },
  { prioridad: 18, columnas: MAS_ES_MEJOR, cumple: (ctx) => y(menor(ctx.valor, ctx.promedio), mayorIgual(ctx.valor, mas(ctx, -1))), estilo: degrade(COLORES.naranja) },
  { prioridad: 19, columnas: MAS_ES_MEJOR, cumple: (ctx) => menor(ctx.valor, mas(ctx, -1)), estilo: degrade(COLORES.rojo) },
  // Los ratios, a los dos lados: lejos del promedio, rojo; cerca, amarillo.
  { prioridad: 20, columnas: RATIOS, cumple: (ctx) => o(menorIgual(ctx.valor, mas(ctx, -1)), mayorIgual(ctx.valor, mas(ctx, 1))), estilo: degrade(COLORES.rojo) },
  {
    prioridad: 21,
    columnas: RATIOS,
    cumple: (ctx) => o(y(mayor(ctx.valor, mas(ctx, -0.5)), menorIgual(ctx.valor, ctx.promedio)), y(mayorIgual(ctx.valor, ctx.promedio), menor(ctx.valor, mas(ctx, 0.5)))),
    estilo: degrade(COLORES.amarillo),
  },
  {
    prioridad: 22,
    columnas: RATIOS,
    cumple: (ctx) => o(y(mayor(ctx.valor, mas(ctx, -1)), menorIgual(ctx.valor, mas(ctx, -0.5))), y(mayorIgual(ctx.valor, mas(ctx, 0.5)), menor(ctx.valor, mas(ctx, 1)))),
    estilo: degrade(COLORES.naranja),
  },
]);

// ------------------------------------------------- Valores de referencia --
// Los de "VR para Evaluaciones" (Isocinecia 60, 180 y 300 Grados), por
// categoría (hoy el Excel tiene solo Mayor): una tabla por velocidad, en el
// orden del Excel. Las clases usan Excelente, Muy Bueno, Bueno y Regular (las
// de los ratios, Excelente, Muy Bueno, Regular y Malo). En el Excel los
// cortes salen del promedio y el desvío (Bueno = Promedio): en la base van ya
// calculados; si el club los cambia, hay que recalcularlos. "DE" son los
// desvíos de cada corte del déficit (solo se muestran). Los nombres del
// Excel de los déficits y los ratios se distinguían solo por un punto o un
// espacio ("Deficit Pico Ext", "Deficit Pico Ext."): acá dicen de qué medida son.
const metricasDe = (v) => {
  const metrica = (clave, titulo, formato) => ({ clave, titulo, formato });
  const medidas = [
    ...COMPLETAS.flatMap((m) =>
      ["ext", "flex"].flatMap((mov) => [
        metrica(k(v, m, mov, "pd"), et(`${MEDIDAS[m].titulo} ${MOVIMIENTOS[mov].enExcel === "Ext" ? "Ext" : "Flex"} PD`, `${MEDIDAS[m].titulo} ${MOVIMIENTOS[mov].enExcel === "Ext" ? "Ext" : "Flex"} PD`), "0.00"),
        metrica(k(v, m, mov, "pi"), et(`${MEDIDAS[m].titulo} ${MOVIMIENTOS[mov].enExcel === "Ext" ? "Ext" : "Flex"} PI`, `${MEDIDAS[m].titulo} ${MOVIMIENTOS[mov].enExcel === "Ext" ? "Ext" : "Flex"} PE`), "0.00"),
      ]),
    ),
    ...["ext", "flex"].flatMap((mov) => [
      metrica(k(v, "wf", mov, "pd"), et(`Work Fatigue ${mov === "ext" ? "Ext" : "Flex"} PD`, `Work Fatigue ${mov === "ext" ? "Ext" : "Flex"} PD`), "0.00"),
      metrica(k(v, "wf", mov, "pi"), et(`Work Fatigue ${mov === "ext" ? "Ext" : "Flex"} PI`, `Work Fatigue ${mov === "ext" ? "Ext" : "Flex"} PE`), "0.00"),
    ]),
    metrica(k(v, "rom", "pd"), et("ROM PD", "ROM PD"), "0.00"),
    metrica(k(v, "rom", "pi"), et("ROM PI", "ROM PE"), "0.00"),
  ];
  const deficits = [
    ...COMPLETAS.flatMap((m) => ["ext", "flex"].map((mov) => [k(v, m, mov, "deficit"), `${MEDIDAS[m].titulo} ${mov === "ext" ? "Ext" : "Flex"}`])),
    [k(v, "rom", "deficit"), "ROM"],
  ].flatMap(([clave, nombre]) => [metrica(clave, et(`Deficit ${nombre}`, `Déficit ${nombre}`), "0.0%"), metrica(`${clave}_de`, et("DE", "DE"), "General")]);
  const ratios = [...COMPLETAS, "wf"].flatMap((m) => [
    metrica(k(v, m, "ratio", "pd"), et(`Ant/Ago ${MEDIDAS[m].titulo} PD`, `Ant/Ago ${MEDIDAS[m].titulo} PD`), "0.00"),
    metrica(k(v, m, "ratio", "pi"), et(`Ant/Ago ${MEDIDAS[m].titulo} PI`, `Ant/Ago ${MEDIDAS[m].titulo} PE`), "0.00"),
  ]);
  return [...medidas, ...deficits, ...ratios];
};

export const TABLAS_DE_REFERENCIA = Object.freeze(VELOCIDADES.map(({ clave, grados }) => ({ id: clave, titulo: et(`Isocinecia ${grados}°`, `Isocinecia ${grados}°`), metricas: metricasDe(clave) })));

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
// Lo que se trae al pegar la tabla del Excel, por el nombre de su columna. La
// fila 17 repite "PD" y "PI" en cada medida: las medidas se reconocen por los
// nombres largos de la fila 16 ("Peak TQ/BW Ext Right 60", "ROM Left 300"),
// así que se copia desde la fila 16.
const nombreLargo = (v, m, mov, lado) => {
  const grados = VELOCIDADES.find((una) => una.clave === v).grados;
  const pierna = lado === "pd" ? "Right" : "Left";
  return m === "rom" ? `ROM ${pierna} ${grados}` : `${MEDIDAS[m].enExcel} ${MOVIMIENTOS[mov].enExcel} ${pierna} ${grados}`;
};

export const CABECERAS_PARA_PEGAR = Object.freeze({
  fecha: ["fecha"],
  jugador: ["jugador"],
  seleccion: ["seleccion", "selección"],
  pc: ["p c", "pc"],
  ...Object.fromEntries(
    VELOCIDADES.flatMap(({ clave: v }) => [
      ...[...COMPLETAS, "wf"].flatMap((m) => ["ext", "flex"].flatMap((mov) => ["pd", "pi"].map((lado) => [k(v, m, mov, lado), [nombreLargo(v, m, mov, lado)]]))),
      ...["pd", "pi"].map((lado) => [k(v, "rom", lado), [nombreLargo(v, "rom", null, lado)]]),
    ]),
  ),
});

export const ISOCINECIA = Object.freeze({
  id: ID,
  // El área del reporte individual (src/domain/evaluaciones/areas.js).
  area: "fuerza",
  // No se carga a mano en la app: sale del PDF del equipo isocinético (en el
  // Excel, la macro "Cargar evaluación"; Santiago, 09/10: «no pierdas tiempo
  // en meter eso en cargar evaluacion xq eso se carga atraves de un pdf»).
  // Por ahora, lo viejo se trae con Pegar desde Excel y se corrige en la Base.
  seCargaEnLaApp: false,
  pestana: et("Isocinecia", "Isocinesia"),
  titulo: et("Isocinecia", "Isocinesia"),
  nota: et("", ""),
  grupos: GRUPOS,
  columnas: COLUMNAS,
  vistas: VISTAS,
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

export default ISOCINECIA;
