import { normalizarTextoBase } from "./match";

// Lo común a las bases que se pegan desde Excel (Lesiones, Evaluaciones):
// cómo se reconoce a cada nombre en Datos básicos y qué pasa con cada fila.

// Quién es cada nombre en el plantel: el mismo nombre (sin mayúsculas ni
// espacios de más, como lo distingue la base) y si no hay, el mismo sin
// acentos ni signos. Si dos jugadores dan lo mismo, no se adivina: DUDOSO.
export const DUDOSO = "dudoso";

export const nombreIgual = (nombre) =>
  String(nombre ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const nombreParecido = (nombre) =>
  normalizarTextoBase(nombre)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const buscadorDeJugadores = (plantel) => {
  const indice = (clave) => {
    const mapa = new Map();
    plantel.forEach((jugador) => {
      const llave = clave(jugador.nombre);
      mapa.set(llave, mapa.has(llave) ? DUDOSO : jugador);
    });
    return mapa;
  };
  const iguales = indice(nombreIgual);
  const parecidos = indice(nombreParecido);
  return (nombre) => iguales.get(nombreIgual(nombre)) || parecidos.get(nombreParecido(nombre)) || null;
};

// El nombre más largo que guarda la base para alguien fuera de Datos básicos.
export const LARGO_DEL_NOMBRE = 120;

// Qué pasa con cada fila.
export const ESTADOS = {
  // Se carga.
  nueva: "nueva",
  // Ya está en la app: no se toca.
  yaEsta: "yaEsta",
  // El nombre no está en Datos básicos (o se parece a dos): hay que elegir
  // si se guarda con ese nombre, si es un jugador de la lista o si no va.
  sinJugador: "sinJugador",
  // Se eligió no cargarla.
  noVa: "noVa",
  // Algo impide cargarla: `problemas` dice qué.
  conProblemas: "conProblemas",
};

// Lo que se elige para un nombre que no está en Datos básicos: guardarlo
// con ese nombre (sin agregarlo a Datos básicos), no cargar la fila, o el id
// de un jugador de la lista.
export const COMO_PERSONA = "persona";
export const NO_CARGAR = "no";
