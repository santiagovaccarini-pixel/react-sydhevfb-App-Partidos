// GPS › Valores de referencia › «Agregar V.R.» con la planilla del club
// (nota 2 de la planilla de valor referencial; Santiago, 18/10 y 19/10, en
// cuestionarios y al ver la maqueta). Un V.R. se calcula con una muestra: las
// filas de un dispositivo en la Base, filtradas con el embudo de cada columna
// (las del promedio del equipo también están: «Se ven y se filtran»). Cada
// medida elegida (las columnas de números: «Necesito poder elegir las
// columnas que voy a usar en el vr (Siempre tienen que ser numericas)»;
// «Vienen todas las numericas») se calcula con la lógica de la planilla
// (domain/valorReferencial.js), con su sentido (el de Ajustes › Cabeceras,
// que se puede cambiar) y Automático o Manual («eso se decide si el
// automatico da malos porcentajes en cada categoria»; en Manual se eligen
// los desvíos de cada categoría, de entrada los de Automático). Se guarda como los
// V.R. por jugador: el Bueno en el promedio y las otras cuatro en las
// categorías; y, en `planilla`, con qué se calculó, para «Recalcular» con
// los datos de ese día (migración 20261108_gps_vr_planilla.sql).

import { AUTOMATICO, CATEGORIAS_CON_CORTE, MANUAL, calcularValorReferencial, cortesValidos } from "../valorReferencial.js";
import { conSentidoGps, sentidoDe, sentidoGuardado } from "../sentido.js";
import { CATEGORIAS_DE_UN_VR } from "./informe.js";

export const VERSION_DE_LA_PLANILLA = 1;
export const MODOS = Object.freeze([AUTOMATICO, MANUAL]);

const esNumero = (valor) => typeof valor === "number" && Number.isFinite(valor);
const esObjeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);

// Las medidas que se pueden elegir: las columnas de números (las medidas, sus
// por minuto, los tiempos y las del club; no las fijas, como el Microciclo),
// en el orden de la Base. De entrada, todas.
export const medidasDeLaPlanilla = (columnas = []) => columnas.filter(conSentidoGps);

// Lo elegido de entrada en una medida: el sentido de Ajustes › Cabeceras y
// Automático.
export const eleccionDeEntrada = (medidas, sentidoDeAjustes = () => null) =>
  Object.fromEntries(medidas.map((columna) => [columna.clave, { sentido: sentidoDe(sentidoDeAjustes(columna.clave), columna.clave), modo: AUTOMATICO }]));

// El dato de una medida en una fila del GPS (como viene de la base): las
// absolutas, su número (el Tiempo, en segundos); las por minuto, su medida
// sobre los minutos, como la hoja de relativos de la planilla.
export const datoDeLaFila = (columna, fila) => {
  const datos = fila?.datos || {};
  if (columna.tipo === "porMinuto") return { numerador: datos[columna.de], denominador: esNumero(datos.tiempo) ? datos.tiempo / 60 : null };
  return { valor: datos[columna.clave] };
};

// Cada medida con las filas de la muestra: { clave: { resultado, atipicos } }.
// resultado, el de calcularValorReferencial (null si no alcanza); atipicos,
// las filas que quedaron afuera, de menor a mayor: [{ fila, valor, bajo }].
export const calcularPlanilla = (filas, medidas, eleccion) =>
  Object.fromEntries(
    medidas.map((columna) => {
      const datos = filas.map((fila) => datoDeLaFila(columna, fila));
      const relativa = columna.tipo === "porMinuto";
      const elegido = eleccion?.[columna.clave] || {};
      // Manual sin desvíos elegidos: los de Automático.
      const automatico = () => calcularValorReferencial(datos, { sentido: elegido.sentido, relativa });
      const resultado =
        elegido.modo === MANUAL
          ? calcularValorReferencial(datos, { sentido: elegido.sentido, modo: MANUAL, relativa, cortes: cortesValidos(elegido.cortes || automatico()?.desvios || {}) })
          : automatico();
      const atipicos = resultado
        ? resultado.atipicos.indices
            .map((indice) => {
              const dato = datos[indice];
              const valor = relativa ? dato.numerador / dato.denominador : dato.valor;
              return { fila: filas[indice], valor, bajo: valor < resultado.atipicos.desde };
            })
            .sort((a, b) => a.valor - b.valor)
        : [];
      return [columna.clave, { resultado, atipicos }];
    }),
  );

// Lo que se guarda: el Bueno de cada medida en el promedio y Excelente, Muy
// Bueno, Regular y Malo en las categorías. Las medidas sin cuenta no van.
export const numerosParaGuardar = (calculos) => {
  const promedio = {};
  const categorias = Object.fromEntries(CATEGORIAS_DE_UN_VR.map((categoria) => [categoria, {}]));
  Object.entries(calculos).forEach(([clave, { resultado }]) => {
    if (!resultado) return;
    promedio[clave] = resultado.valores.bueno;
    CATEGORIAS_DE_UN_VR.forEach((categoria) => {
      categorias[categoria][clave] = resultado.valores[categoria];
    });
  });
  return { promedio, desvio: {}, categorias };
};

// ------------------------------------------------------------ La muestra --
// Los filtros de la tabla son textos (lo que se ve, en el idioma de cada
// uno). Se guardan los valores de las filas que muestran esos textos (el
// código de una opción, la fecha, el id del jugador), así la muestra se
// vuelve a armar igual en otro idioma o con otro nombre en Ajustes. Las
// personas fuera del plantel no tienen id: van todas juntas.
const claveDe = (valor) => JSON.stringify(valor ?? "");

// filasArmadas: las de la tabla ({ valores, textos }); filtros: { clave: [textos] }.
export const muestraDeLosFiltros = (filasArmadas, filtros = {}) =>
  Object.fromEntries(
    Object.entries(filtros || {})
      .filter(([, elegidos]) => Array.isArray(elegidos))
      .map(([clave, elegidos]) => {
        const textos = new Set(elegidos.map((texto) => String(texto ?? "").trim()));
        const valores = new Map();
        filasArmadas.forEach((fila) => {
          if (!textos.has(String(fila.textos?.[clave] ?? "").trim())) return;
          const valor = fila.valores?.[clave] ?? "";
          valores.set(claveDe(valor), valor);
        });
        return [clave, [...valores.values()]];
      }),
  );

// Las filas que entran con una muestra guardada.
export const filasDeLaMuestra = (filasArmadas, muestra = {}) => {
  const conjuntos = Object.entries(esObjeto(muestra) ? muestra : {})
    .filter(([, valores]) => Array.isArray(valores))
    .map(([clave, valores]) => [clave, new Set(valores.map(claveDe))]);
  return filasArmadas.filter((fila) => conjuntos.every(([clave, valores]) => valores.has(claveDe(fila.valores?.[clave]))));
};

// ----------------------------------------------------- Lo que se guarda --
// planilla: { version, muestra: { clave: [valores] }, medidas: { clave: {
// sentido, modo, cortes? } } (solo las elegidas; cortes, los desvíos de
// Manual), filas: cuántas entraron, calculado: la fecha (ISO) }.
const medidaGuardada = (clave, elegido) => {
  const modo = MODOS.includes(elegido?.modo) ? elegido.modo : AUTOMATICO;
  const medida = { sentido: sentidoGuardado(elegido?.sentido) || sentidoDe(null, clave), modo };
  if (modo === MANUAL && esObjeto(elegido?.cortes) && CATEGORIAS_CON_CORTE.every((categoria) => esNumero(elegido.cortes[categoria]))) medida.cortes = cortesValidos(elegido.cortes);
  return medida;
};
export const armarPlanilla = ({ muestra, eleccion, filas, calculado }) => ({
  version: VERSION_DE_LA_PLANILLA,
  muestra,
  medidas: Object.fromEntries(Object.entries(eleccion).map(([clave, elegido]) => [clave, medidaGuardada(clave, elegido)])),
  filas,
  calculado,
});

// La planilla como viene de la base (o null si no es de la planilla): lo que
// no se entiende queda afuera.
export const leerPlanilla = (valor) => {
  if (!esObjeto(valor)) return null;
  const muestra = Object.fromEntries(Object.entries(esObjeto(valor.muestra) ? valor.muestra : {}).filter(([, valores]) => Array.isArray(valores)));
  const medidas = Object.fromEntries(
    Object.entries(esObjeto(valor.medidas) ? valor.medidas : {})
      .filter(([, elegido]) => esObjeto(elegido))
      .map(([clave, elegido]) => [clave, medidaGuardada(clave, { ...elegido, sentido: sentidoDe(elegido.sentido, clave) })]),
  );
  return {
    version: esNumero(valor.version) ? valor.version : VERSION_DE_LA_PLANILLA,
    muestra,
    medidas,
    filas: esNumero(valor.filas) ? valor.filas : null,
    calculado: typeof valor.calculado === "string" ? valor.calculado : null,
  };
};

// Para recalcular: las medidas que se eligieron (las que siguen estando) y lo
// elegido en cada una.
export const medidasDeLaPlanillaGuardada = (planilla, medidas) => medidas.filter((columna) => esObjeto(planilla?.medidas?.[columna.clave]));
export const eleccionDeLaPlanilla = (planilla, medidas) => Object.fromEntries(medidasDeLaPlanillaGuardada(planilla, medidas).map((columna) => [columna.clave, planilla.medidas[columna.clave]]));
