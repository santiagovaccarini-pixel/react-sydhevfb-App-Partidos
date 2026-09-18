import { normalizarTexto } from "./match";
import { pasaPorMinutos } from "./minutos";
import { resumenDeTiempos } from "./tiempos";
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
  DURACION: "duracion",
};

/** Cómo se mira el resultado: por cómo terminó, o por el marcador exacto. */
export const MODO_RESULTADO = {
  GANADO: RESULTADO.GANADO,
  EMPATADO: RESULTADO.EMPATADO,
  PERDIDO: RESULTADO.PERDIDO,
  EXACTO: "exacto",
};

/**
 * Qué hace el botón de penales que acompaña a "Ganados" y a "Perdidos". Los
 * de penales no son una opción más de la lista: son una vuelta de tuerca sobre
 * ganar o perder, y se eligen ahí mismo en vez de tener su propio renglón.
 */
export const PENALES = {
  SIN: "sin",
  CON: "con",
  SOLO: "solo",
};

// Un 1-1 (4-3) lo clasifica comoTermino aparte; acá se dice a qué se suma.
const EN_PENALES = {
  [MODO_RESULTADO.GANADO]: RESULTADO.GANADO_PENALES,
  [MODO_RESULTADO.PERDIDO]: RESULTADO.PERDIDO_PENALES,
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

  [FILTRO_EQUIPO.RESULTADO]: (
    registro,
    { modo, modos, marcador, penales = PENALES.SIN },
  ) => {
    // Se pueden pedir varios a la vez: ganados y empatados, por ejemplo. Basta
    // con que el partido entre en alguno.
    const pedidos = Array.isArray(modos) && modos.length > 0 ? modos : [modo];

    if (pedidos.includes(MODO_RESULTADO.EXACTO)) {
      return mismoMarcador(marcador, registro?.resultado);
    }

    const termino = comoTermino(registro?.resultado);

    return pedidos.some((cual) => {
      const desempatado = EN_PENALES[cual];

      // "Empatados" no tiene vuelta de penales: un partido que se definió
      // desde el punto no terminó empatado, terminó ganado o perdido.
      if (!desempatado) return termino === cual;

      if (penales === PENALES.SOLO) return termino === desempatado;
      if (penales === PENALES.CON) {
        return termino === cual || termino === desempatado;
      }
      return termino === cual;
    });
  },

  [FILTRO_EQUIPO.LOCALIA]: (registro, { localia }) =>
    leerLocalia(registro?.localia) === leerLocalia(localia),

  // Cuánto duró el partido de punta a punta, con el reloj corrido: es lo que
  // separa un partido normal de uno que se fue a cien minutos de tanto VAR.
  //
  // Lo suyo viaja en su propia bolsa: por fecha también hay un "desde" y un
  // "hasta", y compartiendo nombre uno le pisaba el rango al otro.
  [FILTRO_EQUIPO.DURACION]: (registro, { duracion }) =>
    pasaPorMinutos(resumenDeTiempos(registro).total.bruto, duracion),
};

/**
 * Recorta los partidos con los criterios elegidos. Cada fila es { item, index },
 * igual que la lista que ya arma la pantalla.
 *
 * Se pueden pedir varios a la vez y el partido los tiene que cumplir todos:
 * contra Santos Y de local Y ganados. Un criterio que no existe —"todos", o
 * uno que se quitó— no recorta nada, así que no hace falta limpiarlo antes.
 */
export const filtrarRegistros = (
  filas,
  { filtro, filtros, ...opciones } = {},
) => {
  const lista = Array.isArray(filas) ? filas : [];
  const pedidos = Array.isArray(filtros) ? filtros : filtro ? [filtro] : [];
  const activos = pedidos.map((cual) => PASAN[cual]).filter(Boolean);

  if (activos.length === 0) return lista;
  return lista.filter((fila) =>
    activos.every((pasa) => pasa(fila.item, opciones)),
  );
};
