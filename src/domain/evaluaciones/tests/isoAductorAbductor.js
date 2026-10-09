import { categoriaPorCodigo } from "../categorias.js";
import { claseMas, claseMenos, claseRatio, cortesDe } from "../clases.js";
import { absoluto, dividir, esBlanco, esError, esVacio, igual, mayor, mayorIgual, menor, menorIgual, restar, siError, subtotal } from "../excel.js";
import { COLORES, COLOR_DE_CLASE, SIN_RELLENO, degrade, estiloDeClase, letraSobreGris, masDesvios } from "../formatoCondicional.js";

// Iso Aductor-Abductor: la hoja "Iso Aductor-Abductor" del Excel
// BD_evaluaciones, entera en un solo lugar. Una fila por evaluación, con el
// peso corporal (P.C.) del día y dos bloques (Aductores y Abductores), cada
// uno con la pierna derecha (PD) y la izquierda (PI): la fuerza (ABS) y la
// relativa al peso (REL), su clase, su % de mejora, el déficit entre piernas
// con su clase y qué pierna rinde menos. Al final, el ratio Aductor ÷
// Abductor de cada pierna («Ant/Ago») con su clase. Lo que decidió Santiago
// el 09/10 (docs/PENDIENTES.md, "Evaluaciones"): el ratio es Aductor ÷
// Abductor, como lo calcula la hoja (sus V.R. se llamaban «Ratio Abd/Adu»);
// la comparación «Vs …» del informe, como en Zona Media; la columna Grados
// (vacía) queda afuera.

const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });

const ID = "iso_aductor_abductor";

// Los dos bloques (la fila 13 del Excel).
const BLOQUES = Object.freeze([
  { clave: "ad", titulo: et("ADUCTORES", "ADUTORES") },
  { clave: "ab", titulo: et("ABDUCTORES", "ABDUTORES") },
]);

export const GRUPOS = Object.freeze([
  ...BLOQUES.map(({ clave, titulo }) => ({ clave, titulo })),
  // En el Excel, las columnas del ratio no tienen título arriba.
  { clave: "ratio", titulo: et("Ratio Aductor / Abductor", "Ratio Adutor / Abdutor") },
]);

// Las claves de las columnas de un bloque.
const clavesDe = (bloque) => ({
  pd: `${bloque}_pd`,
  pdRel: `${bloque}_pd_rel`,
  pdClas: `${bloque}_pd_clas`,
  pdMejora: `${bloque}_pd_mejora`,
  pi: `${bloque}_pi`,
  piRel: `${bloque}_pi_rel`,
  piClas: `${bloque}_pi_clas`,
  piMejora: `${bloque}_pi_mejora`,
  deficit: `${bloque}_deficit`,
  deficitClas: `${bloque}_deficit_clas`,
  pierna: `${bloque}_pierna`,
});
const AD = clavesDe("ad");
const AB = clavesDe("ab");

// Lo que se carga: el peso del día y la fuerza de cada pierna en cada bloque.
export const NUMEROS = Object.freeze(["pc", AD.pd, AD.pi, AB.pd, AB.pi]);

// ---------------------------------------------------------- Las columnas --
// Los nombres, los del Excel (la fila 14), sin los espacios de más. "DEFICIT
// PIERNA" dice qué pierna rinde menos: PD (la derecha), PI (la izquierda) o
// Sin Deficit.
const PIERNA = Object.freeze({
  PD: et("PD", "PD"),
  PI: et("PI", "PE"),
  "Sin Deficit": et("Sin Deficit", "Sem Déficit"),
});

const columnasDelBloque = ({ clave: grupo }) => {
  const c = clavesDe(grupo);
  // En el Excel, el % Mejora PD de Aductores tiene dos decimales.
  const formatoMejoraPd = grupo === "ad" ? "0.00%" : "0.0%";
  return [
    { clave: c.pd, titulo: et("PD (ABS)", "PD (ABS)"), tipo: "numero", formato: "0.0", grupo },
    { clave: c.pdRel, titulo: et("PD (REL)", "PD (REL)"), tipo: "calculado", formato: "0.0", grupo },
    { clave: c.pdClas, titulo: et("Clas. PD (REL)", "Clas. PD (REL)"), tipo: "calculado", formato: "General", grupo },
    { clave: c.pdMejora, titulo: et("% Mejora PD", "% Melhora PD"), tipo: "calculado", formato: formatoMejoraPd, grupo },
    { clave: c.pi, titulo: et("PI (ABS)", "PE (ABS)"), tipo: "numero", formato: "0.0", grupo },
    { clave: c.piRel, titulo: et("PI (REL)", "PE (REL)"), tipo: "calculado", formato: "0.0", grupo },
    { clave: c.piClas, titulo: et("Clas. PI (REL)", "Clas. PE (REL)"), tipo: "calculado", formato: "General", grupo },
    { clave: c.piMejora, titulo: et("% Mejora PI", "% Melhora PE"), tipo: "calculado", formato: "0.0%", grupo },
    { clave: c.deficit, titulo: et("DEFICIT LATERAL", "DÉFICIT LATERAL"), tipo: "calculado", formato: "0.0%", grupo },
    { clave: c.deficitClas, titulo: et("Clas. Deficit", "Clas. Déficit"), tipo: "calculado", formato: "General", grupo },
    { clave: c.pierna, titulo: et("DEFICIT PIERNA", "DÉFICIT PERNA"), tipo: "calculado", formato: "General", valores: PIERNA, grupo },
  ];
};

const RATIO = Object.freeze({ pd: "ratio_pd", pdClas: "ratio_pd_clas", pi: "ratio_pi", piClas: "ratio_pi_clas" });

// Quedan a la vista al correr la tabla, como el Excel inmovilizado, en el
// orden del Excel (Posición no va: Santiago, 05/10; la Fecha Nac. sale de
// Datos básicos). El peso del día va en el primer paso de la carga.
export const COLUMNAS = Object.freeze([
  { clave: "jugador", titulo: et("Jugador", "Jogador"), tipo: "jugador", fija: true, ancho: 168 },
  { clave: "seleccion", titulo: et("Seleccion", "Seleção"), tipo: "lista", fija: true, ancho: 120 },
  { clave: "fecha_nac", titulo: et("F.N.", "D.N."), tipo: "dato_jugador", fija: true, ancho: 120 },
  { clave: "numero", titulo: et("Evaluación", "Avaliação"), tipo: "calculado", formato: "General", fija: true, ancho: 104 },
  { clave: "fecha", titulo: et("Fecha", "Data"), tipo: "fecha", fija: true, ancho: 140 },
  { clave: "pc", titulo: et("P.C.", "P.C."), tipo: "numero", formato: "0.0", enPrimerPaso: true },
  ...BLOQUES.flatMap(columnasDelBloque),
  { clave: RATIO.pd, titulo: et("Ant/Ago PD", "Ant/Ago PD"), tipo: "calculado", formato: "0.00", grupo: "ratio" },
  { clave: RATIO.pdClas, titulo: et("Clas Ratio PD", "Clas Ratio PD"), tipo: "calculado", formato: "General", grupo: "ratio" },
  { clave: RATIO.pi, titulo: et("Ant/Ago PI", "Ant/Ago PE"), tipo: "calculado", formato: "0.00", grupo: "ratio" },
  { clave: RATIO.piClas, titulo: et("Clas Ratio PI", "Clas Ratio PE"), tipo: "calculado", formato: "General", grupo: "ratio" },
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

// La clase de una fila contra los V.R. de su categoría (como en todos los
// tests; el Excel comparaba siempre contra Mayor). Sin valor, sin categoría
// o sin V.R. de esa categoría, vacía.
const claseDeFila = ({ seleccion, valor, referencias, metrica, clasificar, esCategoria }) => {
  if (esVacio(valor) || esBlanco(seleccion) || !esCategoria(seleccion)) return "";
  const cortes = cortesDe(referencias, seleccion, metrica);
  return cortes ? siError(clasificar(valor, cortes), "") : "";
};

const calcularFila = ({ entrada: e, numero, anterior, referencias, esCategoria = (codigo) => Boolean(categoriaPorCodigo(codigo)) }) => {
  const calculadas = { numero };
  const clase = (valor, metrica, clasificar) => claseDeFila({ seleccion: e.seleccion, valor, referencias, metrica, clasificar, esCategoria });
  // % Mejora sobre la REL: contra la evaluación anterior del jugador que la
  // tenga, sin límite de cuántas atrás (como en todos los tests; el Excel
  // miraba solo la anterior, por el lugar de la fila). (actual − anterior) / anterior.
  const mejora = (actual, clave) => {
    if (esVacio(actual)) return "";
    const previa = anterior(clave);
    if (esVacio(previa)) return "";
    return siError(dividir(restar(actual, previa), previa), "");
  };
  BLOQUES.forEach(({ clave: bloque }) => {
    const c = clavesDe(bloque);
    // REL: IF(OR(ISBLANK(P.C.),ISBLANK(ABS)),"",ABS/P.C.).
    const relativa = (fuerza) => (esBlanco(e.pc) || esBlanco(fuerza) ? "" : siError(dividir(fuerza, e.pc), ""));
    const pdRel = relativa(e[c.pd]);
    const piRel = relativa(e[c.pi]);
    // DEFICIT LATERAL: IFERROR(ABS(PD REL − PI REL) / IF(PI REL < PD REL, PI REL, PD REL), "").
    let deficit = "";
    if (!esVacio(pdRel) && !esVacio(piRel)) {
      deficit = siError(dividir(absoluto(restar(pdRel, piRel)), menor(piRel, pdRel) === true ? piRel : pdRel), "");
    }
    // DEFICIT PIERNA, con la fuerza ABS:
    // IF(OR(ISBLANK(PI),ISBLANK(PD)),"",IF(PD−PI<0,"PD",IF(PD−PI=0,"Sin Deficit","PI"))).
    let pierna = "";
    if (!esBlanco(e[c.pd]) && !esBlanco(e[c.pi])) {
      const diferencia = restar(e[c.pd], e[c.pi]);
      if (menor(diferencia, 0) === true) pierna = "PD";
      else if (igual(diferencia, 0) === true) pierna = "Sin Deficit";
      else pierna = "PI";
    }
    Object.assign(calculadas, {
      [c.pdRel]: pdRel,
      [c.pdClas]: clase(pdRel, c.pdRel, claseMas),
      [c.pdMejora]: mejora(pdRel, c.pdRel),
      [c.piRel]: piRel,
      [c.piClas]: clase(piRel, c.piRel, claseMas),
      [c.piMejora]: mejora(piRel, c.piRel),
      [c.deficit]: deficit,
      [c.deficitClas]: clase(deficit, c.deficit, claseMenos),
      [c.pierna]: pierna,
    });
  });
  // Ant/Ago: IF(OR(Aductor REL="",Abductor REL=""),"",Aductor REL / Abductor
  // REL). Una división por cero, vacía (en el Excel daba #DIV/0!). Su clase,
  // a los dos lados (de 1 a 3, como el ratio de Isocinecia).
  const ratio = (aductor, abductor) => (esVacio(aductor) || esVacio(abductor) ? "" : siError(dividir(aductor, abductor), ""));
  const ratioPd = ratio(calculadas[AD.pdRel], calculadas[AB.pdRel]);
  const ratioPi = ratio(calculadas[AD.piRel], calculadas[AB.piRel]);
  Object.assign(calculadas, {
    [RATIO.pd]: ratioPd,
    [RATIO.pdClas]: clase(ratioPd, RATIO.pd, claseRatio),
    [RATIO.pi]: ratioPi,
    [RATIO.piClas]: clase(ratioPi, RATIO.pi, claseRatio),
  });
  return calculadas;
};

// ------------------------------------------------------------ El informe --
// Arriba, la comparación con los V.R. de la categoría elegida («Vs …», como
// en Zona Media: el promedio sobre el "Bueno" y la clase del promedio;
// Santiago, 09/10: en el Excel el selector estaba pero no hacía nada) y su
// "Bueno". Después, las filas 7 a 11 del Excel con las filas que se ven:
// Promedios, Desvíos, n (cuántos datos), Máximo y Mínimo. En DEFICIT PIERNA,
// cuántas PD, PI y Sin Deficit hay (en el Excel, en las filas de Promedios,
// Desvíos y Mínimo, sin respetar el filtro; acá, con el filtro, como en Curl
// Nórdico), con el formato del Excel (0.0).

const NUMERICAS_DEL_BLOQUE = (c) => [c.pd, c.pdRel, c.pdClas, c.pdMejora, c.pi, c.piRel, c.piClas, c.piMejora, c.deficit, c.deficitClas];
const COLUMNAS_DEL_INFORME = Object.freeze(["numero", ...NUMERICAS_DEL_BLOQUE(AD), ...NUMERICAS_DEL_BLOQUE(AB), RATIO.pd, RATIO.pdClas, RATIO.pi, RATIO.piClas]);
const PIERNAS = [AD.pierna, AB.pierna];

// Los formatos de cada fila del informe (los del Excel), por tipo de columna.
const TIPO_DE_COLUMNA = Object.fromEntries([
  ...[AD, AB].flatMap((c) => [
    [c.pd, "abs"],
    [c.pi, "abs"],
    [c.pdRel, "rel"],
    [c.piRel, "rel"],
    [c.pdClas, "clas"],
    [c.piClas, "clas"],
    [c.pdMejora, "porcentaje"],
    [c.piMejora, "porcentaje"],
    [c.deficit, "porcentaje"],
    [c.deficitClas, "clasDeficit"],
  ]),
  [RATIO.pd, "ratio"],
  [RATIO.pi, "ratio"],
  [RATIO.pdClas, "ratio"],
  [RATIO.piClas, "ratio"],
]);
const FORMATOS = {
  promedio: { abs: "0", rel: "0.0", clas: "0.0", porcentaje: "0.0%", clasDeficit: "0.00", ratio: "0.00" },
  desvio: { abs: "0.00", rel: "0.00", clas: "0.00", porcentaje: "0.0%", clasDeficit: "0.00", ratio: "0.00" },
  maximo: { abs: "0.0", rel: "0.0", clas: "0.0", porcentaje: "0.0%", clasDeficit: "0.0", ratio: "0.0" },
  minimo: { abs: "0.0", rel: "0.0", clas: "0.0", porcentaje: "0.0%", clasDeficit: "0.0", ratio: "0.0" },
};

// Sin ningún número en la columna, vacío (Santiago, 05/10: el Excel mostraba
// #DIV/0! y 0).
const filaDeEstadistica = (est, campo) =>
  Object.fromEntries(
    COLUMNAS_DEL_INFORME.filter((clave) => campo === "n" || clave !== "numero").map((clave) => {
      const valor = est[clave].n === 0 && campo !== "n" ? "" : est[clave][campo];
      return [clave, { valor, formato: campo === "n" ? "General" : FORMATOS[campo][TIPO_DE_COLUMNA[clave]] }];
    }),
  );

// La medida de cada columna que se compara con los V.R. y su clase al lado.
const COMPARADAS = [
  ...[AD, AB].flatMap((c) => [
    { clave: c.pdRel, clase: c.pdClas, clasificar: claseMas, formato: "0.00" },
    { clave: c.piRel, clase: c.piClas, clasificar: claseMas, formato: "0.00" },
    { clave: c.deficit, clase: c.deficitClas, clasificar: claseMenos, formato: "0.0%" },
  ]),
  { clave: RATIO.pd, clase: RATIO.pdClas, clasificar: claseRatio, formato: "0.00" },
  { clave: RATIO.pi, clase: RATIO.piClas, clasificar: claseRatio, formato: "0.00" },
];

const CUENTAS = [
  { fila: "promedios", valor: "PD" },
  { fila: "desvios", valor: "PI" },
  { fila: "minimo", valor: "Sin Deficit" },
];

const informe = ({ est, referencias, comparar, filas = [] }) => {
  const comparacion = {};
  const referencia = {};
  COMPARADAS.forEach(({ clave, clase, clasificar, formato }) => {
    const cortes = cortesDe(referencias, comparar, clave);
    const bueno = cortes ? cortes[2] : "";
    referencia[clave] = { valor: bueno, formato };
    comparacion[clave] = { valor: siError(dividir(est[clave].promedio, bueno), ""), formato: "0.00%" };
    comparacion[clase] = { valor: cortes ? siError(clasificar(est[clave].promedio, cortes), "") : "", formato: "0" };
  });
  const porFila = {
    promedios: filaDeEstadistica(est, "promedio"),
    desvios: filaDeEstadistica(est, "desvio"),
    n: filaDeEstadistica(est, "n"),
    maximo: filaDeEstadistica(est, "maximo"),
    minimo: filaDeEstadistica(est, "minimo"),
  };
  CUENTAS.forEach(({ fila, valor }) => {
    PIERNAS.forEach((clave) => {
      porFila[fila][clave] = { valor: subtotal(2, filas.map((celdas) => (igual(celdas[clave], valor) === true ? 1 : null))), formato: "0.0", rotulo: PIERNA[valor] };
    });
  });
  return [
    { id: "comparacion", celdas: comparacion },
    { id: "referencia", celdas: referencia },
    { id: "promedios", rotulo: et("Promedios", "Médias"), celdas: porFila.promedios },
    { id: "desvios", rotulo: et("Desvíos", "Desvios"), celdas: porFila.desvios },
    { id: "n", rotulo: et("n", "n"), celdas: porFila.n },
    { id: "maximo", rotulo: et("Máximo", "Máximo"), celdas: porFila.maximo },
    { id: "minimo", rotulo: et("Mínimo", "Mínimo"), celdas: porFila.minimo },
  ];
};

// ------------------------------------------------- Formato condicional --
// Las reglas del Excel que pintan algo, con su prioridad. μ y σ: el promedio
// y el desvío de la columna con las filas que se ven. Los colores, los de
// toda la app. La fuerza ABS no se pinta.

const CLASES = [...[AD, AB].flatMap((c) => [c.pdClas, c.piClas, c.deficitClas]), RATIO.pdClas, RATIO.piClas];
const MAS_ES_MEJOR = [AD, AB].flatMap((c) => [c.pdRel, c.pdMejora, c.piRel, c.piMejora]);
const DEFICITS = [AD.deficit, AB.deficit];
const RATIOS = [RATIO.pd, RATIO.pi];
const TODAS = COLUMNAS.filter((columna) => !columna.fija).map((columna) => columna.clave);

const o = (...valores) => valores.find(esError) || valores.some(Boolean);
const y = (...valores) => valores.find((valor) => valor && typeof valor === "object") || valores.every((valor) => valor === true);
const mas = (ctx, k) => masDesvios(ctx.promedio, ctx.desvio, k);

export const REGLAS = Object.freeze([
  // Las clases (también las del ratio): el número del color de su clase,
  // sobre gris (igual en toda la app).
  ...[5, 4, 3, 2, 1].map((clase, i) => ({ prioridad: 1 + i, columnas: CLASES, cumple: ({ valor }) => igual(valor, clase), estilo: estiloDeClase(clase) })),
  // Qué pierna rinde menos: una letra de color en negrita sobre gris (las de
  // Curl Nórdico).
  { prioridad: 6, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "Sin Deficit"), estilo: letraSobreGris("#7030A0") },
  { prioridad: 7, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "PI"), estilo: letraSobreGris("#984807") },
  { prioridad: 8, columnas: PIERNAS, cumple: ({ valor }) => igual(valor, "PD"), estilo: letraSobreGris("#0D0D0D") },
  // Las celdas vacías no se pintan.
  { prioridad: 9, columnas: TODAS, cumple: ({ valor }) => esVacio(valor), estilo: SIN_RELLENO },
  // El ratio, a los dos lados: lejos del promedio, rojo; cerca, amarillo (como en Isocinecia).
  { prioridad: 10, columnas: RATIOS, cumple: (ctx) => o(menorIgual(ctx.valor, mas(ctx, -1)), mayorIgual(ctx.valor, mas(ctx, 1))), estilo: degrade(COLORES.rojo) },
  {
    prioridad: 11,
    columnas: RATIOS,
    cumple: (ctx) => o(y(mayor(ctx.valor, mas(ctx, -0.5)), menorIgual(ctx.valor, ctx.promedio)), y(menor(ctx.valor, mas(ctx, 0.5)), mayorIgual(ctx.valor, ctx.promedio))),
    estilo: degrade(COLORES.amarillo),
  },
  // El déficit: menos es mejor.
  { prioridad: 12, columnas: DEFICITS, cumple: (ctx) => mayor(ctx.valor, mas(ctx, 1)), estilo: degrade(COLORES.rojo) },
  { prioridad: 13, columnas: DEFICITS, cumple: (ctx) => y(mayor(ctx.valor, ctx.promedio), menorIgual(ctx.valor, mas(ctx, 1))), estilo: degrade(COLORES.naranja) },
  { prioridad: 14, columnas: DEFICITS, cumple: (ctx) => y(mayor(ctx.valor, mas(ctx, -1)), menorIgual(ctx.valor, ctx.promedio)), estilo: degrade(COLORES.amarillo) },
  { prioridad: 15, columnas: DEFICITS, cumple: (ctx) => y(mayor(ctx.valor, mas(ctx, -2)), menorIgual(ctx.valor, mas(ctx, -1))), estilo: degrade(COLORES.verde) },
  { prioridad: 16, columnas: DEFICITS, cumple: (ctx) => menorIgual(ctx.valor, mas(ctx, -2)), estilo: degrade(COLORES.verdeOscuro) },
  {
    prioridad: 17,
    columnas: RATIOS,
    cumple: (ctx) => o(y(mayor(ctx.valor, mas(ctx, -1)), menorIgual(ctx.valor, mas(ctx, -0.5))), y(menor(ctx.valor, mas(ctx, 1)), mayorIgual(ctx.valor, mas(ctx, 0.5)))),
    estilo: degrade(COLORES.naranja),
  },
  // La REL y su % de mejora: más es mejor, contra μ y σ.
  { prioridad: 18, columnas: MAS_ES_MEJOR, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, 2)), estilo: degrade(COLORES.verdeOscuro) },
  { prioridad: 19, columnas: MAS_ES_MEJOR, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, 1)), estilo: degrade(COLORES.verde) },
  { prioridad: 20, columnas: MAS_ES_MEJOR, cumple: (ctx) => mayorIgual(ctx.valor, ctx.promedio), estilo: degrade(COLORES.amarillo) },
  { prioridad: 21, columnas: MAS_ES_MEJOR, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, -1)), estilo: degrade(COLORES.naranja) },
  { prioridad: 22, columnas: MAS_ES_MEJOR, cumple: (ctx) => menor(ctx.valor, mas(ctx, -1)), estilo: degrade(COLORES.rojo) },
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

// ------------------------------------------------- Valores de referencia --
// Los de "VR para Evaluaciones" (Aductor, Abductor y el ratio; hoy solo
// Mayor), una tabla por cada uno, con su n, Promedio, Desv. Estándar y los
// cinco cortes. En Aductor y Abductor las clases usan Excelente, Muy Bueno,
// Bueno y Regular (Malo se muestra); "DE" son los desvíos de cada corte del
// déficit (solo se muestran). En el ratio, los cortes van a los dos lados
// del "Bueno" (Malo y Regular arriba, Regular y Malo abajo) y se guardan en
// ese orden. En el Excel los cortes salen del promedio y el desvío: en la
// base van ya calculados; si el club los cambia, hay que recalcularlos.

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

// Las filas del ratio, con los nombres del Excel.
const FILAS_DEL_RATIO = Object.freeze([
  FILAS_DE_REFERENCIA[0],
  FILAS_DE_REFERENCIA[1],
  FILAS_DE_REFERENCIA[2],
  { clave: "excelente", titulo: et("Malo", "Ruim") },
  { clave: "muy_bueno", titulo: et("Regular", "Regular") },
  { clave: "bueno", titulo: et("Bueno", "Bom") },
  { clave: "regular", titulo: et("Regular", "Regular") },
  { clave: "malo", titulo: et("Malo", "Ruim") },
]);

const metricasDe = (c) => [
  { clave: c.pdRel, titulo: et("PD", "PD"), formato: "0.00" },
  { clave: c.piRel, titulo: et("PI", "PE"), formato: "0.00" },
  { clave: c.deficit, titulo: et("Deficit", "Déficit"), formato: "0.0%" },
  { clave: `${c.deficit}_de`, titulo: et("DE", "DE"), formato: "General" },
];

export const TABLAS_DE_REFERENCIA = Object.freeze([
  { id: "aductor", titulo: et("Aductor", "Adutor"), metricas: metricasDe(AD) },
  { id: "abductor", titulo: et("Abductor", "Abdutor"), metricas: metricasDe(AB) },
  {
    id: "ratio",
    titulo: et("Ratio Aductor / Abductor", "Ratio Adutor / Abdutor"),
    metricas: [
      { clave: RATIO.pd, titulo: et("PD", "PD"), formato: "0.00" },
      { clave: RATIO.pi, titulo: et("PI", "PE"), formato: "0.00" },
    ],
    filas: FILAS_DEL_RATIO,
  },
]);

export const METRICAS = Object.freeze(TABLAS_DE_REFERENCIA.flatMap((tabla) => tabla.metricas));

// ---------------------------------------------------------------- Pegar --
// Lo que se trae al pegar la tabla del Excel, por el nombre de su columna en
// la fila de títulos (la 14). "PD (ABS)" y "PD (REL)" se leen igual (lo de
// entre paréntesis no cuenta), así que cada una va por el lugar en que
// aparece: la primera PD es la de Aductores y la tercera, la de Abductores
// (lo mismo con PI).
export const CABECERAS_PARA_PEGAR = Object.freeze({
  jugador: ["jugador"],
  seleccion: ["seleccion", "selección"],
  fecha: ["fecha"],
  pc: ["p c", "pc"],
  [AD.pd]: { nombres: ["pd"], vez: 1 },
  [AD.pi]: { nombres: ["pi"], vez: 1 },
  [AB.pd]: { nombres: ["pd"], vez: 3 },
  [AB.pi]: { nombres: ["pi"], vez: 3 },
});

export const ISO_ADUCTOR_ABDUCTOR = Object.freeze({
  id: ID,
  // El área del reporte individual (src/domain/evaluaciones/areas.js).
  area: "funcionales",
  pestana: et("Iso Aductor-Abductor", "Iso Adutor-Abdutor"),
  titulo: et("Aductor y Abductor", "Adutor e Abdutor"),
  nota: et(
    "*Los Valores pintados corresponden a la comparación entre los datos filtrados y los Valores referenciales de la Categoría seleccionada",
    "*Os valores coloridos correspondem à comparação entre os dados filtrados e os valores de referência da categoria selecionada",
  ),
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
  reglasDelInforme: REGLAS_DEL_INFORME,
  cabecerasParaPegar: CABECERAS_PARA_PEGAR,
});

export default ISO_ADUCTOR_ABDUCTOR;
