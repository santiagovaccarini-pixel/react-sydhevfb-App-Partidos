/**
 * Comparar una cantidad de minutos contra lo que se escribió en el filtro.
 * Lo usan los minutos de un jugador y la duración de un partido: la pregunta
 * es la misma —"más de", "entre"— y cambia solo de dónde sale el número.
 */

export const COMPARADOR = {
  MAYOR: "mayor",
  MAYOR_IGUAL: "mayorIgual",
  MENOR: "menor",
  MENOR_IGUAL: "menorIgual",
  ENTRE: "entre",
};

/**
 * Los minutos escritos, pasados a segundos. Una casilla vacía o con cualquier
 * cosa devuelve null, que acá quiere decir "sin tope": mientras se borra para
 * escribir otro número no se puede vaciar la pantalla. Ojo que Number("") da 0
 * y ese sí es un tope, que se llevaría puestos a los que no ingresaron.
 */
export const enSegundos = (minutos) => {
  const escrito = String(minutos ?? "").trim();
  if (escrito === "") return null;

  const valor = Number(escrito);
  return Number.isFinite(valor) ? valor * 60 : null;
};

const COMPARACIONES = {
  [COMPARADOR.MAYOR]: (medido, desde) => medido > desde,
  [COMPARADOR.MAYOR_IGUAL]: (medido, desde) => medido >= desde,
  [COMPARADOR.MENOR]: (medido, desde) => medido < desde,
  [COMPARADOR.MENOR_IGUAL]: (medido, desde) => medido <= desde,
};

/**
 * Si unos segundos medidos entran en lo que pide el filtro. Devuelve true
 * cuando todavía no hay número escrito: a medio escribir no se vacía la
 * pantalla.
 */
export const pasaPorMinutos = (
  medido,
  { comparador, desde, hasta, desdeIgual = true, hastaIgual = true } = {},
) => {
  const piso = enSegundos(desde);

  if (comparador === COMPARADOR.ENTRE) {
    const techo = enSegundos(hasta);
    // Un "entre" con una sola punta no es un entre: hasta que estén los dos
    // números no se recorta nada.
    if (piso === null || techo === null) return true;

    // Cada punta dice en su botón si se incluye o no; se respeta tal cual,
    // aunque el de abajo sea más grande que el de arriba y no quede nada.
    const pasaAbajo = desdeIgual ? medido >= piso : medido > piso;
    const pasaArriba = hastaIgual ? medido <= techo : medido < techo;
    return pasaAbajo && pasaArriba;
  }

  if (piso === null) return true;

  const comparar = COMPARACIONES[comparador] || COMPARACIONES[COMPARADOR.MAYOR];
  return comparar(medido, piso);
};
