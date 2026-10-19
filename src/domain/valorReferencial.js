// El valor referencial calculado con la lógica de la planilla del club
// («Plantilla VR»; Santiago, 18/10: «una planilla donde tiene logicas
// estadisticas para descartar datos atipicos y vos copias esa logica dentro
// de la web»). Por variable, con los datos de la muestra elegida:
//   1. Se descartan los atípicos con cuartiles: fuera de 1,5 veces el rango
//      entre el primero y el tercero si así se descarta hasta el 10 %; si no,
//      fuera de 3 veces (solo los extremos).
//   2. Con lo que queda, el promedio (el Bueno) y el desvío.
//   3. Automático: los cortes buscan repartir los datos como una curva normal
//      (2,5 % Excelente, 13,5 % Muy bueno, 34 % Bueno, 34 % Regular y 16 %
//      Malo), probando de 0,25 en 0,25 desvíos hasta 2. Manual: cortes fijos.
// Cada variable es «Más es mejor» o «Menos es mejor» (con la segunda, las
// franjas se dan vuelta). Las relativas (por minuto) son el numerador sobre
// el denominador de cada fila; su promedio, la suma de los numeradores
// sobre la de los denominadores, y si ese promedio es 1 o menos no se
// descarta nada (como la hoja de relativos).
// Las funciones de Excel que usa, como en Excel: CUARTIL y PERCENTIL
// (inclusivos), DESVEST (muestral) y JERARQUIA (de mayor a menor). En Malo,
// la planilla usa siempre el corte de Regular más 0,25 desvíos (Santiago,
// 18/10: «Copialo igual»).

import { MAS_ES_MEJOR, MENOS_ES_MEJOR } from "./sentido.js";

export { MAS_ES_MEJOR, MENOS_ES_MEJOR };
export const AUTOMATICO = "automatico";
export const MANUAL = "manual";

// El reparto que se busca, como una curva normal (la planilla, X35:X39).
export const REPARTO = Object.freeze({ excelente: 0.025, muy_bueno: 0.135, bueno: 0.34, regular: 0.34, malo: 0.16 });

// Los cortes fijos del modo Manual, en desvíos desde el promedio (la
// planilla, AD27:AD31 de cada hoja).
export const CORTES_MANUALES = Object.freeze({
  absoluta: Object.freeze({ excelente: 1.25, muy_bueno: 1, regular: 0.75, malo: 1.75 }),
  relativa: Object.freeze({ excelente: 2, muy_bueno: 0.75, regular: 1, malo: 2 }),
});

// Los cortes que se prueban para Muy bueno y Regular (AC35:AC41).
const PASOS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75];
// Lo que se suma al de Muy bueno para Excelente, por opción, sin pasar de 2.
const SALTO = 0.25;
const TOPE = 2;

const numero = (valor) => typeof valor === "number" && Number.isFinite(valor);
const promedio = (valores) => valores.reduce((suma, valor) => suma + valor, 0) / valores.length;
const desvioMuestral = (valores) => {
  if (valores.length < 2) return NaN;
  const media = promedio(valores);
  return Math.sqrt(valores.reduce((suma, valor) => suma + (valor - media) ** 2, 0) / (valores.length - 1));
};
// CUARTIL y PERCENTIL de Excel (inclusivos): interpolando entre los ordenados.
const percentil = (ordenados, p) => {
  const posicion = (ordenados.length - 1) * p;
  const abajo = Math.floor(posicion);
  return abajo + 1 < ordenados.length ? ordenados[abajo] + (posicion - abajo) * (ordenados[abajo + 1] - ordenados[abajo]) : ordenados[abajo];
};
// JERARQUIA de Excel, de mayor a menor: 1 más cuántos son mayores.
const jerarquia = (valor, todos) => 1 + todos.filter((otro) => otro > valor).length;

// Qué datos quedan sin los atípicos: una marca por dato, en su orden, y
// entre qué límites (para mostrar cuáles quedaron afuera y por qué).
export const sinAtipicos = (valores) => {
  const ordenados = [...valores].sort((a, b) => a - b);
  const q1 = percentil(ordenados, 0.25);
  const q3 = percentil(ordenados, 0.75);
  const rango = q3 - q1;
  const adentro = (veces) => (valor) => valor >= q1 - veces * rango && valor <= q3 + veces * rango;
  const afueraCon15 = valores.filter((valor) => !adentro(1.5)(valor)).length / valores.length;
  const veces = afueraCon15 <= 0.1 ? 1.5 : 3;
  return { veces, desde: q1 - veces * rango, hasta: q3 + veces * rango, quedan: valores.map(adentro(veces)) };
};

// El corte de Muy bueno (o de Regular) que deja más cerca del 34 % los datos
// entre el promedio y el corte (Z); entre los que empatan, el que más se
// acerca a la cola de ese lado (Y), como JERARQUIA y BUSCARV en la planilla.
// Devuelve el corte y cuántas opciones se pueden probar con él (AD).
const elegirCorte = (distancias, colas) => {
  const porDistancia = distancias.map((distancia) => jerarquia(distancia, distancias));
  const mejor = Math.max(...porDistancia);
  const puntos = distancias.map((distancia, i) => (porDistancia[i] === mejor ? porDistancia[i] + jerarquia(colas[i], colas) : null));
  const maximo = Math.max(...puntos.filter((punto) => punto !== null));
  const elegido = puntos.findIndex((punto) => punto === maximo);
  return { corte: PASOS[elegido], opciones: PASOS.length - elegido };
};

// datos: [{ valor }] (absolutas) o [{ numerador, denominador }] (relativas).
// Devuelve null si no alcanza para calcular (sin datos, uno solo o sin
// variación), o { n, usados, descartados, veces, promedio, desvio, valores:
// { excelente, muy_bueno, bueno, regular, malo }, porcentajes: {…},
// desvios: { excelente, muy_bueno, regular, malo }, atipicos: { desde,
// hasta, indices } }: los atípicos, entre qué límites quedaba adentro y en
// qué lugar de `datos` estaban (sin descartar, límites null).
export const calcularValorReferencial = (datos, { sentido = MAS_ES_MEJOR, modo = AUTOMATICO, relativa = false, cortes = null } = {}) => {
  const filas = (datos || [])
    .map((dato, indice) =>
      relativa
        ? numero(dato?.numerador) && numero(dato?.denominador) && dato.denominador > 0
          ? { indice, valor: dato.numerador / dato.denominador, numerador: dato.numerador, denominador: dato.denominador }
          : null
        : numero(dato?.valor)
          ? { indice, valor: dato.valor }
          : null,
    )
    .filter(Boolean);
  if (!filas.length) return null;
  const valores = filas.map((fila) => fila.valor);
  const suma = (lista, clave) => lista.reduce((total, fila) => total + fila[clave], 0);
  // En las relativas con un promedio de 1 o menos no se descarta nada.
  const promedioCrudo = relativa ? (suma(filas, "numerador") === 0 ? 0.01 : suma(filas, "numerador")) / suma(filas, "denominador") : null;
  const { veces, desde = null, hasta = null, quedan } = relativa && promedioCrudo <= 1 ? { veces: null, quedan: valores.map(() => true) } : sinAtipicos(valores);
  const usadas = filas.filter((_, i) => quedan[i]);
  const x = usadas.map((fila) => fila.valor);
  const media = relativa ? suma(usadas, "numerador") / suma(usadas, "denominador") : promedio(x);
  const desvio = desvioMuestral(x);
  if (!x.length || !numero(media) || !numero(desvio) || desvio === 0) return null;

  // s: hacia dónde es mejor. «Mejor o igual que el corte» y «peor que el corte».
  const s = sentido === MENOS_ES_MEJOR ? -1 : 1;
  const alMenos = (valor, corte) => s * valor >= s * corte;
  const peorQue = (valor, corte) => s * valor < s * corte;
  const parte = (cumple) => x.filter(cumple).length / x.length;
  const corteA = (desvios) => media + s * desvios * desvio;

  let desvios;
  if (modo === MANUAL) {
    const fijos = cortes || CORTES_MANUALES[relativa ? "relativa" : "absoluta"];
    desvios = { excelente: fijos.excelente, muy_bueno: fijos.muy_bueno, regular: fijos.regular, malo: fijos.malo };
  } else {
    // Las colas: cuántos desvíos hay del promedio al promedio del 5 % de cada punta.
    const ordenados = [...x].sort((a, b) => a - b);
    const p95 = percentil(ordenados, 0.95);
    const p5 = percentil(ordenados, 0.05);
    const arriba = (promedio(x.filter((valor) => valor >= p95)) - media) / desvio;
    const abajo = (media - promedio(x.filter((valor) => valor <= p5))) / desvio;
    const colaMejor = s > 0 ? arriba : abajo;
    const colaPeor = s > 0 ? abajo : arriba;

    // Muy bueno y Excelente.
    const muyBueno = elegirCorte(
      PASOS.map((paso) => Math.abs(REPARTO.bueno - parte((valor) => alMenos(valor, media) && peorQue(valor, corteA(paso))))),
      PASOS.map((paso) => paso - colaMejor),
    );
    let excelente = null;
    let menorDistancia = Infinity;
    for (let opcion = 1; opcion <= PASOS.length; opcion += 1) {
      const paso = muyBueno.corte + SALTO * opcion;
      if (muyBueno.opciones < opcion || paso > TOPE) continue;
      const distancia =
        Math.abs(REPARTO.excelente - parte((valor) => alMenos(valor, corteA(paso)))) +
        Math.abs(REPARTO.muy_bueno - parte((valor) => alMenos(valor, corteA(muyBueno.corte)) && peorQue(valor, corteA(paso))));
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        excelente = paso;
      }
    }

    // Regular y Malo (el Malo, siempre el de Regular más 0,25: la planilla
    // compara solo cuántos quedan por debajo de Regular).
    const regular = elegirCorte(
      PASOS.map((paso) => Math.abs(REPARTO.regular - parte((valor) => peorQue(valor, media) && alMenos(valor, corteA(-paso))))),
      PASOS.map((paso) => paso - colaPeor),
    );
    desvios = { excelente, muy_bueno: muyBueno.corte, regular: regular.corte, malo: regular.corte + SALTO };
  }

  const valoresVr = {
    excelente: corteA(desvios.excelente),
    muy_bueno: corteA(desvios.muy_bueno),
    bueno: media,
    regular: corteA(-desvios.regular),
    malo: corteA(-desvios.malo),
  };
  const porcentajes = {
    excelente: parte((valor) => alMenos(valor, valoresVr.excelente)),
    muy_bueno: parte((valor) => alMenos(valor, valoresVr.muy_bueno) && peorQue(valor, valoresVr.excelente)),
    bueno: parte((valor) => alMenos(valor, media) && peorQue(valor, valoresVr.muy_bueno)),
    regular: parte((valor) => alMenos(valor, valoresVr.regular) && peorQue(valor, media)),
    malo: parte((valor) => peorQue(valor, valoresVr.regular)),
  };
  const atipicos = { desde, hasta, indices: filas.filter((_, i) => !quedan[i]).map((fila) => fila.indice) };
  return { n: filas.length, usados: x.length, descartados: filas.length - x.length, veces, promedio: media, desvio, valores: valoresVr, porcentajes, desvios, atipicos };
};
