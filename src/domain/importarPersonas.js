import { normalizarTextoBase } from "./match";

// Lo común a las bases que se pegan desde Excel (Lesiones, Evaluaciones):
// cómo se reconoce a cada nombre en Datos básicos y qué pasa con cada fila.

// Quién es cada nombre en el plantel: el mismo nombre (sin mayúsculas ni
// espacios de más, como lo distingue la base) y si no hay, el mismo sin
// acentos ni signos. Si dos jugadores dan lo mismo, no se adivina: DUDOSO.
// Después, un nombre que tuvo un jugador (nombres_anteriores: la base los
// anota al cambiarle el nombre; nota del 12/10), si hoy no es de nadie.
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
  const indice = (clave, nombresDe) => {
    const mapa = new Map();
    plantel.forEach((jugador) => {
      new Set(nombresDe(jugador).map(clave)).forEach((llave) => {
        if (!llave) return;
        mapa.set(llave, mapa.has(llave) && mapa.get(llave) !== jugador ? DUDOSO : jugador);
      });
    });
    return mapa;
  };
  const deHoy = (jugador) => [jugador.nombre];
  const anteriores = (jugador) => jugador.nombres_anteriores || [];
  const iguales = indice(nombreIgual, deHoy);
  const parecidos = indice(nombreParecido, deHoy);
  const igualesAntes = indice(nombreIgual, anteriores);
  const parecidosAntes = indice(nombreParecido, anteriores);
  return (nombre) =>
    iguales.get(nombreIgual(nombre)) ||
    parecidos.get(nombreParecido(nombre)) ||
    igualesAntes.get(nombreIgual(nombre)) ||
    parecidosAntes.get(nombreParecido(nombre)) ||
    null;
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
