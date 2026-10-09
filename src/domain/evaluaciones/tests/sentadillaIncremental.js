import { categoriaPorCodigo } from "../categorias.js";
import { claseMas, cortesDe } from "../clases.js";
import { desvioMuestral, dividir, esBlanco, esNumero, esVacio, igual, mayor, mayorIgual, menor, menorIgual, multiplicar, promedio, restar, siError, sumar } from "../excel.js";
import { COLORES, COLOR_DE_CLASE, SIN_RELLENO, degrade, estiloDeClase, masDesvios } from "../formatoCondicional.js";

// Sentadilla Incremental: la hoja "Sentadilla Incremental informe" del Excel
// BD_evaluaciones, entera en un solo lugar. Una fila por evaluación, con el
// peso corporal (P.C.) del día, el dispositivo y el medio (el ejercicio), y
// cinco series de carga creciente: en cada una, los Kg, la velocidad, el PSE
// (el esfuerzo percibido), el % del RM que corresponde a ese PSE, el RM que
// sale de esa serie (Fmax T) y la carga sobre el RM. El RM IND es el promedio
// de los Fmax T de las series, con su desvío, su coeficiente de variación, su
// relación con el peso (Rel), su % de mejora y su clase. Aparte, el RM que da
// el dispositivo por la velocidad (RM x Vel) y su relación con el peso.
//
// Lo que decidió Santiago el 09/10 (docs/PENDIENTES.md, "Evaluaciones"):
//   · Cada serie dice si cuenta para el RM («Respetar lo que sacaron»): en el
//     Excel se borraba a mano la fórmula de las que no contaban. Una serie sin
//     Kg o sin PSE nunca cuenta.
//   · En Leg Press la carga es solo lo que se levanta, en las cinco series
//     («Sin peso corporal»; el Excel buscaba la palabra «prensa» y solo en la
//     primera serie).
//   · La comparación «Vs …» del informe, como en Zona Media.
//   · Pot (vacía), RM IND/REL (igual a Rel) y los V.R. «0.6» y «0.7» quedan
//     afuera («Sacar las tres»); Rel toma los colores que tenía RM IND/REL.


const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });

const ID = "sentadilla_incremental";

const SERIES = Object.freeze([1, 2, 3, 4, 5]);

// Las claves de las columnas de una serie.
const deLaSerie = (i) => ({
  kg: `kg_${i}`,
  carga: `carga_${i}`,
  vel: `vel_${i}`,
  pse: `pse_${i}`,
  rmPse: `rm_pse_${i}`,
  fmax: `fmax_${i}`,
  rmPct: `rm_pct_${i}`,
  cuenta: `cuenta_${i}`,
});
const SERIE = Object.fromEntries(SERIES.map((i) => [i, deLaSerie(i)]));

// Lo que se carga como número: el peso del día, los Kg, la velocidad y el PSE
// de cada serie y el RM que da el dispositivo.
export const NUMEROS = Object.freeze(["pc", ...SERIES.flatMap((i) => [SERIE[i].kg, SERIE[i].vel, SERIE[i].pse]), "rm_vel"]);

// ------------------------------------------------------------- Listas --
// Dispositivo y Medio se escribían a mano en el Excel: acá son listas, con
// los textos que tenía la hoja (cada club les cambia el nombre o suma otras
// en Ajustes). «Prensa» es el Leg Press: va sin peso corporal.
export const MEDIO_SIN_PESO = "prensa";

export const LISTAS = Object.freeze({
  sentadilla_dispositivo: Object.freeze([
    { codigo: "vitruve", etiquetas: et("vitruve - vel. Med", "vitruve - vel. Méd") },
    { codigo: "sin_control", etiquetas: et("sin control vel.", "sem controle vel.") },
  ]),
  sentadilla_medio: Object.freeze([
    { codigo: "agachamento_trap", etiquetas: et("Sentadilla con Trap", "Agachamento com Trap") },
    { codigo: "agachamento", etiquetas: et("Sentadilla", "Agachamento") },
    { codigo: MEDIO_SIN_PESO, etiquetas: et("Leg Press", "Leg Press") },
  ]),
  sentadilla_cuenta: Object.freeze([
    { codigo: "si", etiquetas: et("SI", "SIM") },
    { codigo: "no", etiquetas: et("NO", "NÃO") },
  ]),
});

const TITULOS_DE_LISTAS = Object.freeze({
  sentadilla_dispositivo: et("Dispositivo", "Dispositivo"),
  sentadilla_medio: et("Medio", "Meio"),
  sentadilla_cuenta: et("Cuenta para el RM", "Conta para o RM"),
});

// --------------------------------------------------------- Las columnas --
// Los nombres, los de la fila 10 del Excel. Las series no tienen título
// arriba en el Excel: acá, «Serie 1» … «Serie 5». «Carga» es el Kg de al lado
// (en el Excel, las dos columnas bajo un mismo «Kg»): los Kg más el peso.
export const GRUPOS = Object.freeze([
  ...SERIES.map((i) => ({ clave: `serie_${i}`, titulo: et(`Serie ${i}`, `Série ${i}`) })),
  { clave: "rm", titulo: et("R.M. Indirecto x PSE", "R.M. Indireto x PSE") },
  { clave: "vel", titulo: et("Valor Referencial", "Valor Referencial") },
]);

const columnasDeLaSerie = (i) => {
  const c = SERIE[i];
  const grupo = `serie_${i}`;
  return [
    { clave: c.kg, titulo: et("Kg", "Kg"), tipo: "numero", formato: "0", grupo },
    { clave: c.carga, titulo: et("Carga", "Carga"), tipo: "calculado", formato: "0.0", grupo },
    { clave: c.vel, titulo: et("Vel", "Vel"), tipo: "numero", formato: "0.000", grupo },
    // En el Excel el PSE tenía un formato por fila («7» y «7,0»): uno por
    // columna, que muestra el 0,5.
    { clave: c.pse, titulo: et("PSE", "PSE"), tipo: "numero", formato: "General", grupo },
    { clave: c.rmPse, titulo: et("%RMx PSE", "%RMx PSE"), tipo: "calculado", formato: "0.00", grupo },
    { clave: c.fmax, titulo: et("Fmax T", "Fmax T"), tipo: "calculado", formato: "0.0", grupo },
    { clave: c.rmPct, titulo: et("% RM IND", "% RM IND"), tipo: "calculado", formato: "0%", grupo },
    { clave: c.cuenta, titulo: et("¿Cuenta?", "Conta?"), tipo: "lista", lista: "sentadilla_cuenta", grupo },
  ];
};

// Quedan a la vista al correr la tabla, como en el Excel, en su orden. El
// peso del día, el dispositivo y el medio van en el primer paso de la carga.
export const COLUMNAS = Object.freeze([
  { clave: "numero", titulo: et("nº Eva", "nº Aval."), tipo: "calculado", formato: "General", fija: true, ancho: 96 },
  { clave: "fecha", titulo: et("Fecha", "Data"), tipo: "fecha", fija: true, ancho: 140 },
  { clave: "jugador", titulo: et("Jugador", "Jogador"), tipo: "jugador", fija: true, ancho: 168 },
  { clave: "seleccion", titulo: et("Seleccion", "Seleção"), tipo: "lista", fija: true, ancho: 120 },
  { clave: "dispositivo", titulo: et("Dispositivo", "Dispositivo"), tipo: "lista", lista: "sentadilla_dispositivo" },
  { clave: "medio", titulo: et("Medio", "Meio"), tipo: "lista", lista: "sentadilla_medio" },
  { clave: "pc", titulo: et("P.C.", "P.C."), tipo: "numero", formato: "0.0", enPrimerPaso: true },
  ...SERIES.flatMap(columnasDeLaSerie),
  { clave: "rm_ind", titulo: et("RM IND", "RM IND"), tipo: "calculado", formato: "0.0", grupo: "rm" },
  { clave: "desvio", titulo: et("DESVIO", "DESVIO"), tipo: "calculado", formato: "0.0", grupo: "rm" },
  { clave: "coef_var", titulo: et("COEF. VAR", "COEF. VAR"), tipo: "calculado", formato: "0.00%", grupo: "rm" },
  { clave: "rel", titulo: et("Rel", "Rel"), tipo: "calculado", formato: "0.00", grupo: "rm" },
  { clave: "rel_mejora", titulo: et("% mejora", "% melhora"), tipo: "calculado", formato: "0.0%", grupo: "rm" },
  { clave: "clas", titulo: et("Clas. Grupo", "Clas. Grupo"), tipo: "calculado", formato: "General", grupo: "rm" },
  { clave: "rm_vel", titulo: et("RM x Vel", "RM x Vel"), tipo: "numero", formato: "0.0", grupo: "vel" },
  { clave: "rel_vel", titulo: et("Rel (vel)", "Rel (vel)"), tipo: "calculado", formato: "0.00", grupo: "vel" },
  { clave: "rel_vel_mejora", titulo: et("% mejora", "% melhora"), tipo: "calculado", formato: "0.0%", grupo: "vel" },
  { clave: "nota", titulo: et("Nota", "Nota"), tipo: "texto" },
]);

const LISTAS_PROPIAS = ["dispositivo", "medio", ...SERIES.map((i) => SERIE[i].cuenta)];

// ---------------------------------------------------------- Las cuentas --

// Lo cargado de una fila, como lo cuenta el Excel.
const entrada = (fila) => {
  const datos = fila?.datos || {};
  const numero = (clave) => (typeof datos[clave] === "number" && Number.isFinite(datos[clave]) ? datos[clave] : null);
  const opcion = (clave) => (typeof datos[clave] === "string" && datos[clave] !== "" ? datos[clave] : null);
  return {
    fecha: fila?.fecha || null,
    seleccion: datos.seleccion || null,
    ...Object.fromEntries(NUMEROS.map((clave) => [clave, numero(clave)])),
    ...Object.fromEntries(LISTAS_PROPIAS.map((clave) => [clave, opcion(clave)])),
  };
};

// El % del RM que corresponde a un PSE (la fórmula del Excel, en su orden):
// 0,0415 × PSE³ − 0,8181 × PSE² + 9,8094 × PSE + 35,092.
export const porcentajeDelRm = (pse) => 0.0415 * pse * pse * pse - 0.8181 * pse * pse + 9.8094 * pse + 35.092;

// La clase de una fila contra los V.R. de su categoría (como en todos los
// tests). Sin valor, sin categoría o sin V.R. de esa categoría, vacía.
const claseDeFila = ({ seleccion, valor, referencias, metrica, esCategoria }) => {
  if (esVacio(valor) || esBlanco(seleccion) || !esCategoria(seleccion)) return "";
  const cortes = cortesDe(referencias, seleccion, metrica);
  return cortes ? siError(claseMas(valor, cortes), "") : "";
};

// El color del RM IND y de la Rel (vel), como las reglas del Excel (contra los
// V.R. de RM y de Rel (Vel); en el Excel, siempre los de Mayor, acá los de la
// categoría de la fila): por debajo de Regular, 1 (rojo); por encima de
// Excelente, 5 (verde oscuro); entre Regular y Bueno (con los dos), 2
// (naranja); hasta Muy Bueno, 3 (amarillo); hasta Excelente, 4 (verde).
// Malo no se usa. Se guarda en la fila sin mostrarse.
export const franjaDelExcel = (valor, cortes) => {
  if (!cortes || !esNumero(valor)) return "";
  const [excelente, muyBueno, bueno, regular] = cortes;
  if (menor(valor, regular) === true) return 1;
  if (mayor(valor, excelente) === true) return 5;
  if (menorIgual(valor, bueno) === true) return 2;
  if (menorIgual(valor, muyBueno) === true) return 3;
  return 4;
};

const FRANJA = Object.freeze({ rm_ind: "franja_rm_ind", rel_vel: "franja_rel_vel" });

const calcularFila = ({ entrada: e, numero, anterior, referencias, esCategoria = (codigo) => Boolean(categoriaPorCodigo(codigo)) }) => {
  const calculadas = { numero };
  const sinPeso = e.medio === MEDIO_SIN_PESO;
  const fmax = {};
  SERIES.forEach((i) => {
    const c = SERIE[i];
    const kg = e[c.kg];
    // La carga: los Kg más el peso (en Leg Press, solo los Kg). Sin Kg, la
    // serie no se hizo: vacía (en el Excel quedaba el peso solo).
    const carga = esBlanco(kg) ? "" : sinPeso ? kg : sumar(e.pc, kg);
    // Cuenta para el RM si tiene Kg y PSE y no dice «NO».
    const cuenta = !esBlanco(kg) && !esBlanco(e[c.pse]) && e[c.cuenta] !== "no";
    const rmPse = cuenta ? porcentajeDelRm(e[c.pse]) : "";
    // Fmax T: IFERROR(100 × carga / %RM, "").
    fmax[i] = cuenta ? siError(dividir(multiplicar(100, carga), rmPse), "") : "";
    Object.assign(calculadas, { [c.carga]: carga, [c.rmPse]: rmPse, [c.fmax]: fmax[i] });
  });
  // RM IND: el promedio de los Fmax T, en el orden del Excel
  // (AVERAGE(AO,AG,Y,Q,AW)); DESVIO: STDEV.S(AW,AO,AG,Y,Q).
  const rmInd = siError(promedio([fmax[4], fmax[3], fmax[2], fmax[1], fmax[5]]), "");
  const desvio = siError(desvioMuestral([fmax[5], fmax[4], fmax[3], fmax[2], fmax[1]]), "");
  SERIES.forEach((i) => {
    const c = SERIE[i];
    // % RM IND: la carga de la serie sobre el RM IND.
    calculadas[c.rmPct] = esVacio(calculadas[c.carga]) ? "" : siError(dividir(calculadas[c.carga], rmInd), "");
  });
  const rel = siError(dividir(rmInd, e.pc), "");
  // RM x Vel lo da el dispositivo: sin él, la Rel (vel) queda vacía (en el
  // Excel daba 0).
  const relVel = esBlanco(e.rm_vel) ? "" : siError(dividir(e.rm_vel, e.pc), "");
  // % mejora: contra la evaluación anterior del jugador con el mismo Medio que
  // tenga el dato (como el Excel, que miraba jugador y medio).
  const mismoMedio = (previa) => (previa.medio ?? null) === (e.medio ?? null);
  const mejora = (actual, clave) => {
    if (esVacio(actual)) return "";
    const previa = anterior(clave, mismoMedio);
    if (esVacio(previa)) return "";
    return siError(dividir(restar(actual, previa), previa), "");
  };
  const cortesDeLaFila = (metrica) => (esBlanco(e.seleccion) || !esCategoria(e.seleccion) ? null : cortesDe(referencias, e.seleccion, metrica));
  Object.assign(calculadas, {
    rm_ind: rmInd,
    desvio,
    coef_var: siError(dividir(desvio, rmInd), ""),
    rel,
    rel_mejora: mejora(rel, "rel"),
    clas: claseDeFila({ seleccion: e.seleccion, valor: rel, referencias, metrica: "rel", esCategoria }),
    rel_vel: relVel,
    rel_vel_mejora: mejora(relVel, "rel_vel"),
    [FRANJA.rm_ind]: franjaDelExcel(rmInd, cortesDeLaFila("rm_ind")),
    [FRANJA.rel_vel]: franjaDelExcel(relVel, cortesDeLaFila("rel_vel")),
  });
  return calculadas;
};

// ---------------------------------------------------------- El informe --
// Arriba, la comparación con los V.R. de la categoría elegida («Vs …», como
// en Zona Media: el promedio sobre el "Bueno", pintado con la clase del
// promedio; Santiago, 09/10) y su "Bueno". Después, las filas 4 a 8 del
// Excel con las filas que se ven: Promedios, Desvíos, nº, Máximo y Mínimo,
// con los formatos del Excel.

const COLUMNAS_DE_LA_SERIE = (i) => {
  const c = SERIE[i];
  return [c.kg, c.carga, c.vel, c.pse, c.rmPse, c.fmax, c.rmPct];
};
const COLUMNAS_DEL_INFORME = Object.freeze([
  "numero",
  "pc",
  ...SERIES.flatMap(COLUMNAS_DE_LA_SERIE),
  "rm_ind",
  "desvio",
  "coef_var",
  "rel",
  "rel_mejora",
  "clas",
  "rm_vel",
  "rel_vel",
  "rel_vel_mejora",
]);

// Los formatos de cada columna en las filas Promedios, Desvíos, Máximo y
// Mínimo del Excel (nº, siempre General).
const FORMATO_POR_TIPO = {
  pc: ["0.00", "General", "General", "General"],
  kg: ["0.00", "0.0", "General", "General"],
  carga: ["0.00", "0.0", "General", "General"],
  vel: ["0.00", "0.00", "General", "General"],
  pse: ["0.00", "0.0", "General", "General"],
  rmPse: ["0.00", "General", "General", "General"],
  fmax: ["0.00", "General", "General", "General"],
  rmPct: ["0.00", "General", "0%", "0%"],
  rm_ind: ["0.00", "0.00", "0.00", "0.00"],
  desvio: ["0.00", "0.00", "0.00", "0.00"],
  coef_var: ["0.00", "0.00", "0.00", "0.00"],
  rel: ["0.00", "General", "General", "General"],
  rel_mejora: ["0%", "0.0%", "0%", "0%"],
  clas: ["0.00", "General", "General", "General"],
  rm_vel: ["0.00", "General", "General", "General"],
  rel_vel: ["0.00", "General", "General", "General"],
  rel_vel_mejora: ["0%", "0.0%", "0%", "0%"],
};
const FORMATOS_DEL_INFORME = Object.fromEntries([
  ["pc", FORMATO_POR_TIPO.pc],
  ...SERIES.flatMap((i) => Object.entries(SERIE[i]).filter(([tipo]) => tipo !== "cuenta").map(([tipo, clave]) => [clave, [...FORMATO_POR_TIPO[tipo]]])),
  ...["rm_ind", "desvio", "coef_var", "rel", "rel_mejora", "clas", "rm_vel", "rel_vel", "rel_vel_mejora"].map((clave) => [clave, FORMATO_POR_TIPO[clave]]),
]);
// Lo que en el Excel tiene otro formato que el resto de su tipo.
FORMATOS_DEL_INFORME[SERIE[2].fmax][1] = "0.00";
FORMATOS_DEL_INFORME[SERIE[1].rmPse][2] = "0.00";
FORMATOS_DEL_INFORME[SERIE[1].fmax][2] = "0.00";
FORMATOS_DEL_INFORME[SERIE[5].rmPse] = ["0.00", "0.00", "0.00", "0.00"];
FORMATOS_DEL_INFORME[SERIE[5].fmax] = ["0.00", "0.00", "0.00", "0.00"];

const CAMPOS = ["promedio", "desvio", "maximo", "minimo"];

// Sin ningún número en la columna, vacío (Santiago, 05/10: el Excel mostraba
// #DIV/0! y 0).
const filaDeEstadistica = (est, campo) =>
  Object.fromEntries(
    COLUMNAS_DEL_INFORME.filter((clave) => campo === "n" || clave !== "numero").map((clave) => {
      const valor = est[clave].n === 0 && campo !== "n" ? "" : est[clave][campo];
      return [clave, { valor, formato: campo === "n" ? "General" : FORMATOS_DEL_INFORME[clave][CAMPOS.indexOf(campo)] }];
    }),
  );

// Lo que se compara con los V.R. de la categoría elegida. El P.C. no tiene
// clase (no es mejor ni peor): va sin pintar. La clase de la Rel va en
// «Clas. Grupo»; las otras, en la fila sin mostrarse (`vs_…`), solo para el
// color.
const COMPARADAS = Object.freeze([
  { clave: "pc", formato: "0.00" },
  { clave: "rm_ind", formato: "0.00", clase: "vs_rm_ind" },
  { clave: "rel", formato: "0.00", clase: "clas" },
  { clave: "rm_vel", formato: "0.00", clase: "vs_rm_vel" },
  { clave: "rel_vel", formato: "0.00", clase: "vs_rel_vel" },
]);

const informe = ({ est, referencias, comparar }) => {
  const comparacion = {};
  const referencia = {};
  COMPARADAS.forEach(({ clave, formato, clase }) => {
    const cortes = cortesDe(referencias, comparar, clave);
    const bueno = cortes ? cortes[2] : "";
    referencia[clave] = { valor: bueno, formato };
    comparacion[clave] = { valor: siError(dividir(est[clave].promedio, bueno), ""), formato: "0.0%" };
    if (clase) comparacion[clase] = { valor: cortes ? siError(claseMas(est[clave].promedio, cortes), "") : "", formato: "0" };
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
// Las reglas del Excel que pintan algo, con su prioridad. μ y σ: el promedio
// y el desvío de la columna con las filas que se ven. Los colores, los de
// toda la app.

// Contra μ y σ: la velocidad de cada serie, el RM x Vel y la Rel (que toma
// los colores de RM IND/REL, que salió; Santiago, 09/10).
const CONTRA_EL_GRUPO = [...SERIES.map((i) => SERIE[i].vel), "rm_vel", "rel"];
const CON_FRANJA = ["rm_ind", "rel_vel"];
const mas = (ctx, k) => masDesvios(ctx.promedio, ctx.desvio, k);
const COLOR_DE_FRANJA = { 1: COLORES.rojo, 5: COLORES.verdeOscuro, 2: COLORES.naranja, 3: COLORES.amarillo, 4: COLORES.verde };

export const REGLAS = Object.freeze([
  // La clase: el número del color de su clase, sobre gris (igual en toda la app).
  ...[5, 4, 3, 2, 1].map((clase, i) => ({ prioridad: 1 + i, columnas: ["clas"], cumple: ({ valor }) => igual(valor, clase), estilo: estiloDeClase(clase) })),
  // Las celdas vacías no se pintan.
  { prioridad: 6, columnas: [...CONTRA_EL_GRUPO, ...CON_FRANJA], cumple: ({ valor }) => esVacio(valor), estilo: SIN_RELLENO },
  // El RM IND y la Rel (vel), contra los V.R. (la franja de la fila).
  ...[1, 5, 2, 3, 4].map((franja, i) => ({
    prioridad: 7 + i,
    columnas: CON_FRANJA,
    cumple: ({ clave, celda }) => igual(celda(FRANJA[clave]), franja),
    estilo: degrade(COLOR_DE_FRANJA[franja]),
  })),
  // Más es mejor, contra μ y σ.
  { prioridad: 12, columnas: CONTRA_EL_GRUPO, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, 2)), estilo: degrade(COLORES.verdeOscuro) },
  { prioridad: 13, columnas: CONTRA_EL_GRUPO, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, 1)), estilo: degrade(COLORES.verde) },
  { prioridad: 14, columnas: CONTRA_EL_GRUPO, cumple: (ctx) => mayorIgual(ctx.valor, ctx.promedio), estilo: degrade(COLORES.amarillo) },
  { prioridad: 15, columnas: CONTRA_EL_GRUPO, cumple: (ctx) => mayorIgual(ctx.valor, mas(ctx, -1)), estilo: degrade(COLORES.naranja) },
  { prioridad: 16, columnas: CONTRA_EL_GRUPO, cumple: (ctx) => menor(ctx.valor, mas(ctx, -1)), estilo: degrade(COLORES.rojo) },
]);

// La fila de la comparación: cada porcentaje con el color de la clase del
// promedio, en degradé (como en Zona Media). El P.C., sin color.
const CLASE_DE = Object.fromEntries(COMPARADAS.filter(({ clase }) => clase).map(({ clave, clase }) => [clave, clase]));
const PORCENTAJES = Object.keys(CLASE_DE);
export const REGLAS_DEL_INFORME = Object.freeze([
  { prioridad: 1, columnas: PORCENTAJES, cumple: ({ valor, clave, celda }) => igual(valor, "") === true || igual(celda(CLASE_DE[clave]), "") === true, estilo: SIN_RELLENO },
  ...[5, 4, 3, 2, 1].map((clase, i) => ({
    prioridad: 2 + i,
    columnas: PORCENTAJES,
    cumple: ({ clave, celda }) => igual(celda(CLASE_DE[clave]), clase),
    estilo: degrade(COLOR_DE_CLASE[clase]),
  })),
]);

// ------------------------------------------------ Valores de referencia --
// Los de la derecha de la hoja (columnas BK a DV), una tabla por categoría
// con su n y los cinco cortes; Sub-23 y Mayor tienen también el desvío con el
// que se arman sus cortes (la fila 9). Las juveniles tienen P.C., Rep, RM, Kg
// y Rel; Sub-23, solo Rel; Mayor, RM y Rel por PSE (los de la base) y por
// velocidad. Los «0.6» y «0.7» salieron (Santiago, 09/10: el Excel decía
// «BORRAR .6 Y .7»). Las clases usan la Rel; los colores, RM y Rel (Vel).

export const FILAS_DE_REFERENCIA = Object.freeze([
  { clave: "n", titulo: et("n", "n"), formato: "General" },
  { clave: "excelente", titulo: et("Excelente", "Excelente") },
  { clave: "muy_bueno", titulo: et("Muy Bueno", "Muito Bom") },
  { clave: "bueno", titulo: et("Bueno", "Bom") },
  { clave: "regular", titulo: et("Regular", "Regular") },
  { clave: "malo", titulo: et("Malo", "Ruim") },
  { clave: "desvio", titulo: et("Desvío", "Desvio") },
]);

export const METRICAS = Object.freeze([
  { clave: "pc", titulo: et("P.C.", "P.C."), formato: "0.00" },
  { clave: "rep", titulo: et("Rep", "Rep"), formato: "0.00" },
  { clave: "rm_ind", titulo: et("RM", "RM"), formato: "0.00" },
  { clave: "kg", titulo: et("Kg", "Kg"), formato: "0.00" },
  { clave: "rel", titulo: et("Rel", "Rel"), formato: "0.00" },
  { clave: "rm_vel", titulo: et("RM (Vel)", "RM (Vel)"), formato: "0.00" },
  { clave: "rel_vel", titulo: et("Rel (Vel)", "Rel (Vel)"), formato: "0.00" },
]);

// El resumen («RESUMEN CATEGORIAS (Promedios)»): por categoría, su n y el
// "Bueno" de estas medidas. No tiene la columna «Pro» de Zona Media.
const RESUMEN = Object.freeze(["pc", "rep", "rm_ind", "kg", "rel"]);

// ---------------------------------------------------------------- Pegar --
// Lo que se trae al pegar la tabla del Excel, por el nombre de su columna en
// la fila de títulos (la 10). Kg, Vel, PSE y Fmax T están una vez por serie.
// El Fmax T (calculado) se lee solo para saber qué series no contaban: una
// con Kg y PSE pero sin Fmax T es una a la que le borraron la fórmula.
export const CABECERAS_PARA_PEGAR = Object.freeze({
  jugador: ["jugador"],
  seleccion: ["seleccion", "selección"],
  fecha: ["fecha"],
  dispositivo: ["dispositivo"],
  medio: ["medio"],
  pc: ["p c", "pc"],
  ...Object.fromEntries(
    SERIES.flatMap((i) => [
      [SERIE[i].kg, { nombres: ["kg"], vez: i }],
      [SERIE[i].vel, { nombres: ["vel"], vez: i }],
      [SERIE[i].pse, { nombres: ["pse"], vez: i }],
      [SERIE[i].fmax, { nombres: ["fmax t"], vez: i }],
    ]),
  ),
  rm_vel: ["rm x vel"],
  nota: ["nota"],
});

const completarAlPegar = (textos, datos) =>
  Object.fromEntries(
    SERIES.filter((i) => {
      const c = SERIE[i];
      return typeof datos[c.kg] === "number" && typeof datos[c.pse] === "number" && c.fmax in textos && textos[c.fmax] === "";
    }).map((i) => [SERIE[i].cuenta, "no"]),
  );

const AYUDA_PARA_PEGAR = et(
  "Copiá desde la columna nº Eva hasta Nota. Una serie con Kg y PSE pero sin Fmax T entra como que no cuenta para el RM.",
  "Copie da coluna nº Eva até Nota. Uma série com Kg e PSE mas sem Fmax T entra como não contando para o RM.",
);

export const SENTADILLA_INCREMENTAL = Object.freeze({
  id: ID,
  // El área del reporte individual (src/domain/evaluaciones/areas.js).
  area: "funcionales",
  pestana: et("Sentadilla Incremental", "Agachamento Incremental"),
  titulo: et("Sentadilla Incremental", "Agachamento Incremental"),
  nota: et(
    "*Los Valores pintados corresponden a la comparación entre los datos filtrados y los Valores referenciales de la Categoría seleccionada",
    "*Os valores coloridos correspondem à comparação entre os dados filtrados e os valores de referência da categoria selecionada",
  ),
  grupos: GRUPOS,
  columnas: COLUMNAS,
  listas: LISTAS,
  titulosDeListas: TITULOS_DE_LISTAS,
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
  completarAlPegar,
});

export default SENTADILLA_INCREMENTAL;
