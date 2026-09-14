import { normalizarTexto } from "./match";
import {
  RESULTADO,
  comoTermino,
  golesDelRegistro,
  leerLocalia,
} from "./localia";

/**
 * Con qué se recorta la lista de partidos en la vista de Equipo. Es el
 * equivalente del filtro de la vista de Jugador, pero mirando el partido y no
 * a alguien adentro de él.
 */

export const FILTRO_EQUIPO = {
  TODOS: "todos",
  RIVAL: "rival",
  FECHA: "fecha",
  RESULTADO: "resultado",
  LOCALIA: "localia",
};

/** Cómo se mira el resultado: por cómo terminó, o por el marcador exacto. */
export const MODO_RESULTADO = {
  GANADO: RESULTADO.GANADO,
  EMPATADO: RESULTADO.EMPATADO,
  PERDIDO: RESULTADO.PERDIDO,
  EXACTO: "exacto",
};

const vacio = (valor) => String(valor ?? "").trim() === "";

/**
 * Los rivales que aparecen en el historial, en orden alfabético y con cuántos
 * partidos tiene cada uno. Es lo que se ofrece en el desplegable: la base no
 * tiene una tabla de rivales, se arman de los partidos guardados.
 */
export const rivalesDelHistorial = (registros) => {
  const cuenta = new Map();

  (Array.isArray(registros) ? registros : []).forEach((registro) => {
    const nombre = String(registro?.rival ?? "").trim();
    const id = normalizarTexto(nombre);
    if (!id) return;
    if (!cuenta.has(id)) cuenta.set(id, { nombre, partidos: 0 });
    cuenta.get(id).partidos += 1;
  });

  return [...cuenta.values()].sort((uno, otro) =>
    uno.nombre.localeCompare(otro.nombre, "es"),
  );
};

/** El marcador escrito a mano, comparable contra lo guardado. */
const mismoMarcador = (escrito, resultado) => {
  const [unoA, unoB] = golesDelRegistro(escrito);
  const [otroA, otroB] = golesDelRegistro(resultado);
  if (unoA === "" || unoB === "") return true; // a medio escribir, no recorta
  return unoA === otroA && unoB === otroB;
};

const PASAN = {
  [FILTRO_EQUIPO.RIVAL]: (registro, { rival }) =>
    vacio(rival) || normalizarTexto(registro?.rival) === normalizarTexto(rival),

  // Las fechas son "AAAA-MM-DD", así que se comparan como texto sin pasar por
  // Date: no hay zonas horarias de por medio y el orden es el mismo.
  [FILTRO_EQUIPO.FECHA]: (registro, { desde, hasta }) => {
    const fecha = String(registro?.fecha ?? "").trim();
    if (!fecha) return false;
    if (!vacio(desde) && fecha < String(desde).trim()) return false;
    if (!vacio(hasta) && fecha > String(hasta).trim()) return false;
    return true;
  },

  [FILTRO_EQUIPO.RESULTADO]: (registro, { modo, marcador }) =>
    modo === MODO_RESULTADO.EXACTO
      ? mismoMarcador(marcador, registro?.resultado)
      : comoTermino(registro?.resultado) === modo,

  [FILTRO_EQUIPO.LOCALIA]: (registro, { localia }) =>
    leerLocalia(registro?.localia) === leerLocalia(localia),
};

/**
 * Recorta los partidos con el filtro elegido. Cada fila es { item, index },
 * igual que la lista que ya arma la pantalla.
 */
export const filtrarRegistros = (filas, { filtro, ...opciones } = {}) => {
  const lista = Array.isArray(filas) ? filas : [];
  const pasa = PASAN[filtro];
  if (!pasa) return lista;
  return lista.filter((fila) => pasa(fila.item, opciones));
};
