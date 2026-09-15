/**
 * Si el partido se jugó de local, de visitante o en cancha neutral, y qué
 * cambia con eso.
 *
 * Lo guardado no se toca: el resultado es siempre nuestros goles primero, así
 * un partido cargado antes de que esto existiera sigue leyéndose igual. La
 * localía solo cambia cómo se muestra, poniendo al local a la izquierda, que es
 * como se escribe un partido de fútbol. En cancha neutral no hay local, así que
 * vamos primero nosotros, que es el orden en que está guardado.
 */

export const LOCALIA = {
  LOCAL: "local",
  VISITANTE: "visitante",
  NEUTRAL: "neutral",
};

/** El botón las recorre en este orden, y el filtro las ofrece en el mismo. */
export const LOCALIAS = [LOCALIA.LOCAL, LOCALIA.VISITANTE, LOCALIA.NEUTRAL];

const ETIQUETAS = {
  [LOCALIA.LOCAL]: "Local",
  [LOCALIA.VISITANTE]: "Visitante",
  [LOCALIA.NEUTRAL]: "Neutral",
};

/** Lo que no sea una de las tres es local, incluido lo que no está cargado. */
export const leerLocalia = (valor) => {
  const limpio = String(valor ?? "")
    .trim()
    .toLowerCase();
  return LOCALIAS.includes(limpio) ? limpio : LOCALIA.LOCAL;
};

export const esVisitante = (registro) =>
  leerLocalia(registro?.localia) === LOCALIA.VISITANTE;

export const esNeutral = (registro) =>
  leerLocalia(registro?.localia) === LOCALIA.NEUTRAL;

/** Un toque pasa a la siguiente: local › visitante › neutral › local. */
export const otraLocalia = (valor) => {
  const actual = LOCALIAS.indexOf(leerLocalia(valor));
  return LOCALIAS[(actual + 1) % LOCALIAS.length];
};

export const etiquetaLocalia = (valor) => ETIQUETAS[leerLocalia(valor)];

/**
 * Los dos lados en el orden en que van en pantalla: primero el local. En cancha
 * neutral no hay local, así que queda el orden de siempre, nosotros primero.
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
