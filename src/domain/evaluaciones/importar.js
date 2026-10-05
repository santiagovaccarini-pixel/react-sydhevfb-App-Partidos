// Pegar desde Excel la tabla de un test de evaluaciones (con su fila de
// títulos): se leen las columnas que se cargan a mano, por su nombre; se
// busca a cada jugador en Datos básicos y se compara con lo que ya está. Nada
// de esto toca la base: la pantalla muestra qué pasa con cada fila y guarda.
// Lo que el Excel calcula no se trae: lo calcula la app, con las mismas
// fórmulas.
import { normalizarCabecera } from "../importarJugadores.js";
import { fechaDelExcel, formatoDeLasFechas } from "../importarLesiones.js";
import { COMO_PERSONA, DUDOSO, ESTADOS, LARGO_DEL_NOMBRE, NO_CARGAR, buscadorDeJugadores, nombreIgual, nombreParecido } from "../importarPersonas.js";
import { desdeTexto, esFechaReal, interpretarMinutos } from "../tabla.js";
import { categoriaDeTexto } from "./categorias.js";

export { COMO_PERSONA, ESTADOS, NO_CARGAR };

// Hasta qué fila se busca la de los títulos (el Excel tiene el informe arriba).
const FILAS_PARA_BUSCAR_CABECERAS = 15;

// Los meses como los abrevia el Excel en castellano, portugués o inglés.
const MESES = {
  ene: 1,
  jan: 1,
  feb: 2,
  fev: 2,
  mar: 3,
  abr: 4,
  apr: 4,
  may: 5,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  aug: 8,
  sep: 9,
  sept: 9,
  set: 9,
  oct: 10,
  out: 10,
  nov: 11,
  dic: 12,
  dez: 12,
  dec: 12,
};

const dosCifras = (numero) => String(numero).padStart(2, "0");

// Una fecha como la muestra el Excel de evaluaciones ("12-jun", "12-jun-26"):
// { dia, mes, anio } (anio null si no lo trae) o undefined si no es eso.
export const fechaConMes = (texto) => {
  const partes = /^(\d{1,2})[\s./-]+([a-zç]{3,4})\.?(?:[\s./-]+(\d{2}|\d{4}))?$/i.exec(String(texto ?? "").trim());
  if (!partes) return undefined;
  const mes = MESES[partes[2].toLowerCase()];
  if (!mes) return undefined;
  const anio = partes[3] ? Number(partes[3].length === 2 ? `20${partes[3]}` : partes[3]) : null;
  return { dia: Number(partes[1]), mes, anio };
};

// La fecha de una fila: ISO, null si está vacía o undefined si no se
// entiende. Si viene sin año ("12-jun"), va con `anio` y sinAnio: true.
export const leerFecha = (texto, formato, anio) => {
  const limpio = String(texto ?? "").trim();
  if (!limpio) return { fecha: null, sinAnio: false };
  const conAnio = fechaDelExcel(limpio, formato);
  if (conAnio) return { fecha: conAnio, sinAnio: false };
  const conMes = fechaConMes(limpio);
  if (!conMes) return { fecha: undefined, sinAnio: false };
  const usado = conMes.anio ?? anio;
  const iso = `${usado}-${dosCifras(conMes.mes)}-${dosCifras(conMes.dia)}`;
  return { fecha: esFechaReal(iso) ? iso : undefined, sinAnio: conMes.anio === null };
};

const alias = (test) => Object.fromEntries(Object.entries(test.cabecerasParaPegar).map(([campo, nombres]) => [campo, nombres.map(normalizarCabecera)]));

const cabecerasDeLaFila = (celdas, nombres) => {
  const encontradas = {};
  celdas.forEach((celda, c) => {
    const buscada = normalizarCabecera(celda);
    if (!buscada) return;
    const campo = Object.keys(nombres).find((clave) => nombres[clave].includes(buscada));
    if (campo && !(campo in encontradas)) encontradas[campo] = c;
  });
  return encontradas;
};

// Lo pegado como filas: { columnas: { campo: índice }, filas: [{ indice,
// nombre, textos: { campo: texto } }], error }. La fila de títulos es la que
// más títulos conocidos tiene, con el del jugador. Lo de arriba (el informe,
// una fila de títulos repetida) no se lee.
export const leerEvaluacionesPegadas = (texto, test) => {
  const nombres = alias(test);
  const matriz = desdeTexto(texto);
  let filaCabeceras = -1;
  let columnas = {};
  matriz.slice(0, FILAS_PARA_BUSCAR_CABECERAS).forEach((celdas, f) => {
    const encontradas = cabecerasDeLaFila(celdas, nombres);
    if ("jugador" in encontradas && Object.keys(encontradas).length > Object.keys(columnas).length) {
      filaCabeceras = f;
      columnas = encontradas;
    }
  });
  if (filaCabeceras === -1) return { columnas: {}, filas: [], error: "evaluaciones.importar.sinCabeceras" };
  const filas = [];
  matriz.slice(filaCabeceras + 1).forEach((celdas, i) => {
    const nombre = String(celdas[columnas.jugador] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    // Una fila de títulos (si se pegó dos veces) no es una evaluación.
    if (nombre && nombres.jugador.includes(normalizarCabecera(nombre))) return;
    const textos = Object.fromEntries(Object.entries(columnas).map(([campo, c]) => [campo, String(celdas[c] ?? "").trim()]));
    // Sin nombre y sin nada cargado: una fila vacía de la planilla.
    if (!nombre && !Object.values(textos).some(Boolean)) return;
    filas.push({ indice: filaCabeceras + 1 + i, nombre, textos });
  });
  if (filas.length === 0) return { columnas, filas, error: "evaluaciones.importar.sinFilas" };
  return { columnas, filas, error: "" };
};

// La misma evaluación: de la misma persona (el mismo jugador o el mismo
// nombre), el mismo día y con los mismos tiempos.
const mismaEvaluacion = (una, otra, nombreDe, tiempos) =>
  nombreIgual(nombreDe(una)) !== "" &&
  nombreIgual(nombreDe(una)) === nombreIgual(nombreDe(otra)) &&
  (una.fecha || null) === (otra.fecha || null) &&
  tiempos.every((clave) => (una.datos?.[clave] ?? null) === (otra.datos?.[clave] ?? null));

// El plan: cada fila con { ...fila, jugador, evaluacion, estado, problemas:
// [clave], avisos: [{ campo, valor }], destino, dudoso, fueraDeDatos,
// sinAnio }. Los avisos son valores que no se entendieron: esa columna queda
// vacía. test: el del Excel; plantel: los jugadores de la app; evaluaciones:
// las que ya están de ese test; hoy: ISO; anio: el de las fechas que vienen
// sin año; elegidos: { indice de la fila: destino }.
export const planDeEvaluaciones = (filas, { test, plantel = [], evaluaciones = [], hoy, anio, elegidos = {} }) => {
  const jugadorDe = buscadorDeJugadores(plantel);
  const porId = new Map(plantel.map((jugador) => [String(jugador.id), jugador]));
  const nombreDe = (evaluacion) => (evaluacion.jugador_id ? porId.get(String(evaluacion.jugador_id))?.nombre : evaluacion.persona) || "";
  const formato = formatoDeLasFechas(filas.map((fila) => fila.textos.fecha));
  const tiempos = test.tiempos;
  const aCargar = [];
  // El mismo nombre fuera de Datos básicos escrito de otra forma es la misma
  // persona: se guarda como ya está en la app, o como en la primera fila.
  const comoEstaEscrito = new Map();
  const escrituraDe = (nombre) => {
    const llave = nombreParecido(nombre);
    if (!llave) return nombre;
    if (!comoEstaEscrito.has(llave)) comoEstaEscrito.set(llave, nombre);
    return comoEstaEscrito.get(llave);
  };
  evaluaciones.forEach((otra) => otra.persona && escrituraDe(String(otra.persona).replace(/\s+/g, " ").trim()));

  return filas.map((fila) => {
    const problemas = [];
    const avisos = [];
    const encontrado = jugadorDe(fila.nombre);
    const destino = elegidos[fila.indice] ?? null;
    const elegido = destino && destino !== COMO_PERSONA && destino !== NO_CARGAR ? plantel.find((uno) => String(uno.id) === String(destino)) || null : null;
    const jugador = elegido || (destino ? null : encontrado === DUDOSO ? null : encontrado);
    const comoPersona = !jugador && destino === COMO_PERSONA;

    const { fecha, sinAnio } = leerFecha(fila.textos.fecha, formato, anio);
    const datos = {};
    if (fila.textos.seleccion) {
      const seleccion = categoriaDeTexto(fila.textos.seleccion);
      if (seleccion) datos.seleccion = seleccion;
      else avisos.push({ campo: "seleccion", valor: fila.textos.seleccion });
    }
    tiempos.forEach((clave) => {
      if (!fila.textos[clave]) return;
      const segundos = interpretarMinutos(fila.textos[clave]);
      if (segundos === undefined || segundos === null) avisos.push({ campo: clave, valor: fila.textos[clave] });
      else datos[clave] = segundos;
    });
    if (fila.textos.nota) datos.nota = fila.textos.nota;

    const evaluacion = {
      jugador_id: jugador ? jugador.id : null,
      persona: jugador ? null : escrituraDe(fila.nombre),
      fecha: fecha || null,
      datos,
    };
    const plan = { ...fila, jugador, evaluacion, problemas, avisos, destino, dudoso: encontrado === DUDOSO, fueraDeDatos: !jugador, sinAnio };

    if (!fila.nombre) return { ...plan, fueraDeDatos: false, problemas: ["evaluaciones.importar.sinNombre"], estado: ESTADOS.conProblemas };
    if (fecha !== undefined && evaluaciones.some((otra) => mismaEvaluacion(evaluacion, otra, nombreDe, tiempos))) return { ...plan, estado: ESTADOS.yaEsta };
    if (destino === NO_CARGAR) return { ...plan, estado: ESTADOS.noVa };
    if (!jugador && !comoPersona) return { ...plan, estado: ESTADOS.sinJugador };

    if (fecha === undefined) problemas.push("evaluaciones.importar.fechaMal");
    else if (fecha && fecha > hoy) problemas.push("evaluaciones.importar.fechaFutura");
    if (comoPersona && evaluacion.persona.length > LARGO_DEL_NOMBRE) problemas.push("evaluaciones.importar.nombreLargo");
    if (!problemas.length && aCargar.some((otra) => mismaEvaluacion(evaluacion, otra, nombreDe, tiempos))) problemas.push("evaluaciones.importar.repetida");
    if (problemas.length) return { ...plan, estado: ESTADOS.conProblemas };
    aCargar.push(evaluacion);
    return { ...plan, estado: ESTADOS.nueva };
  });
};

// Las que se cargan, en el orden del Excel (así, con la misma fecha, quedan
// en el mismo orden).
export const ordenDeCarga = (plan) => plan.filter((fila) => fila.estado === ESTADOS.nueva).sort((a, b) => a.indice - b.indice);
