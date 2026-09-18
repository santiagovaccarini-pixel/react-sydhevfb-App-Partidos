import { RESULTADO, comoTermino } from "./localia";

/**
 * Los puntos que se sacaron y qué porcentaje son del total posible. Es la
 * cuenta del fútbol de siempre: 3 por ganado, 1 por empatado, 0 por perdido,
 * sobre 3 por cada partido jugado.
 *
 * Un partido sin marcador cargado no entra en ninguna de las dos puntas: no
 * suma puntos, pero tampoco agranda el total posible. Si contara, cargar la
 * formación de un partido que todavía no se jugó bajaría el porcentaje.
 */

const PUNTOS = {
  [RESULTADO.GANADO]: 3,
  [RESULTADO.EMPATADO]: 1,
  [RESULTADO.PERDIDO]: 0,
};

/**
 * Cuánto vale un partido definido por penales depende de lo que diga el
 * filtro. Con el botón de penales apagado el partido terminó empatado a los 90
 * y vale 1, que es como lo cuenta el fútbol; con el botón prendido el filtro
 * lo está tratando como ganado o perdido, y la cuenta lo acompaña.
 */
const PUNTOS_CON_PENALES = {
  ...PUNTOS,
  [RESULTADO.GANADO_PENALES]: 3,
  [RESULTADO.PERDIDO_PENALES]: 0,
};

const PUNTOS_SIN_PENALES = {
  ...PUNTOS,
  [RESULTADO.GANADO_PENALES]: 1,
  [RESULTADO.PERDIDO_PENALES]: 1,
};

export const puntosDeRegistros = (
  registros,
  { penalesCuentan = false } = {},
) => {
  const tabla = penalesCuentan ? PUNTOS_CON_PENALES : PUNTOS_SIN_PENALES;

  const cuenta = (Array.isArray(registros) ? registros : []).reduce(
    (total, registro) => {
      const termino = comoTermino(registro?.resultado);
      if (termino === null) return total;

      const suma = tabla[termino] ?? 0;

      return {
        jugados: total.jugados + 1,
        puntos: total.puntos + suma,
        // Los de penales se agrupan con los de los 90 según cuánto valgan, que
        // es justo lo que el filtro está diciendo que son.
        ganados: total.ganados + (suma === 3 ? 1 : 0),
        empatados: total.empatados + (suma === 1 ? 1 : 0),
        perdidos: total.perdidos + (suma === 0 ? 1 : 0),
      };
    },
    { jugados: 0, puntos: 0, ganados: 0, empatados: 0, perdidos: 0 },
  );

  const posibles = cuenta.jugados * 3;

  return {
    ...cuenta,
    posibles,
    // Sin partidos jugados no hay porcentaje que mostrar: 0% diría que se jugó
    // y se sacó nada, que no es lo mismo que no haber jugado.
    porcentaje:
      posibles === 0 ? null : Math.round((cuenta.puntos / posibles) * 100),
  };
};
