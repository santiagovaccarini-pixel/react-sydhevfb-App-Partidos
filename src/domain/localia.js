/**
 * Si el partido se jugó de local o de visitante, y qué cambia con eso.
 *
 * Lo guardado no se toca: el resultado es siempre nuestros goles primero, así
 * un partido cargado antes de que esto existiera sigue leyéndose igual. La
 * localía solo cambia cómo se muestra, poniendo al local a la izquierda, que es
 * como se escribe un partido de fútbol.
 */

export const LOCALIA = {
  LOCAL: "local",
  VISITANTE: "visitante",
};

/** Cualquier cosa que no sea "visitante" es local, incluido lo que no está. */
export const leerLocalia = (valor) =>
  String(valor ?? "")
    .trim()
    .toLowerCase() === LOCALIA.VISITANTE
    ? LOCALIA.VISITANTE
    : LOCALIA.LOCAL;

export const esVisitante = (registro) =>
  leerLocalia(registro?.localia) === LOCALIA.VISITANTE;

export const otraLocalia = (valor) =>
  leerLocalia(valor) === LOCALIA.VISITANTE ? LOCALIA.LOCAL : LOCALIA.VISITANTE;

export const etiquetaLocalia = (valor) =>
  leerLocalia(valor) === LOCALIA.VISITANTE ? "Visitante" : "Local";

/**
 * Los dos lados en el orden en que van en pantalla: primero el local.
 * Sirve tanto para los escudos como para cualquier par que los acompañe.
 */
export const enOrdenDeCancha = (registro, propio, rival) =>
  esVisitante(registro) ? [rival, propio] : [propio, rival];

/** Los goles tal como están guardados: los nuestros y los del rival. */
export const golesDelRegistro = (resultado) => {
  const [nuestros = "", suyos = ""] = String(resultado ?? "")
    .split(/\s*[-–:]\s*/)
    .slice(0, 2);
  return [nuestros.trim(), suyos.trim()];
};

/**
 * Los goles en el orden en que se muestran, que sigue al de los escudos: de
 * visitante, primero los del local.
 */
export const golesEnPantalla = (resultado, registro) => {
  const [nuestros, suyos] = golesDelRegistro(resultado);
  return esVisitante(registro) ? [suyos, nuestros] : [nuestros, suyos];
};

/** El marcador ya armado para mostrar, o "" si el partido no tiene resultado. */
export const marcadorEnPantalla = (resultado, registro) => {
  const [izquierda, derecha] = golesEnPantalla(resultado, registro);
  if (izquierda === "" && derecha === "") return "";
  return `${izquierda || "0"}-${derecha || "0"}`;
};

export const RESULTADO = {
  GANADO: "ganado",
  EMPATADO: "empatado",
  PERDIDO: "perdido",
};

/**
 * Cómo terminó el partido para nosotros. Se mira siempre contra lo guardado,
 * que no depende de la localía, así que un 2-1 es una victoria de local y de
 * visitante por igual. Devuelve null si no hay un marcador con dos números.
 */
export const comoTermino = (resultado) => {
  const [nuestros, suyos] = golesDelRegistro(resultado);
  if (nuestros === "" || suyos === "") return null;

  const propios = Number(nuestros);
  const ajenos = Number(suyos);
  if (!Number.isFinite(propios) || !Number.isFinite(ajenos)) return null;

  if (propios > ajenos) return RESULTADO.GANADO;
  if (propios < ajenos) return RESULTADO.PERDIDO;
  return RESULTADO.EMPATADO;
};
