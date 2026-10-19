// «Más es mejor» o «Menos es mejor» de cada medida (Santiago, 19/10, al ver
// la maqueta de la planilla de V.R.: «Dentro de ajustes donde estan las
// cabeceras, le agregamos que cuando se haga click pregunte eso tmb, tiene
// que ser para todas las bases igual»; en un cuestionario, «Solo las de
// números y tiempos»). Es lo que viene elegido al calcular un V.R. con esa
// medida; en cada cálculo se puede cambiar. Se guarda en la cabecera de cada
// base (columna sentido, 20261107_sentido_de_las_medidas.sql); vacío es lo
// de la app. Automático o Manual no va acá: se elige al calcular.
// Solo en las bases con V.R., GPS y Evaluaciones (Santiago, 19/10: «solo
// tienen que aparecer cuando la base de datos o pantalla que este viendo
// tenga Valores Referenciales»): Lesiones y Datos básicos no lo preguntan.

export const MAS_ES_MEJOR = "mas";
export const MENOS_ES_MEJOR = "menos";

export const sentidoGuardado = (valor) => (valor === MAS_ES_MEJOR || valor === MENOS_ES_MEJOR ? valor : null);

// Lo de la app: «Más es mejor», salvo los déficits de Evaluaciones, que sus
// clases ya miden al revés (claseMenos en src/domain/evaluaciones/clases.js).
const ES_DEFICIT = /(^|_)def(icit)?(_|$)/;
export const sentidoPorDefecto = (clave) => (ES_DEFICIT.test(String(clave || "")) ? MENOS_ES_MEJOR : MAS_ES_MEJOR);

// El de una medida: el guardado o, sin él, el de la app.
export const sentidoDe = (guardado, clave) => sentidoGuardado(guardado) || sentidoPorDefecto(clave);

// Qué columnas lo llevan: las de números y tiempos de cada base, sin las
// que identifican la fila (las fijas, como el Microciclo).
// GPS: las medidas, sus por minuto y los tiempos (también las del club).
export const conSentidoGps = (columna) => Boolean(columna) && !columna.fija && ["numero", "porMinuto", "tiempo"].includes(columna.tipo);
// Evaluaciones: lo que se carga con números o tiempos y lo calculado que
// tiene V.R. (las relativas y los déficits), en los tests con V.R.
export const conSentidoEvaluaciones = (test, columna) =>
  Boolean(columna) &&
  !columna.fija &&
  test?.conReferencias !== false &&
  (["numero", "tiempo"].includes(columna.tipo) || (columna.tipo === "calculado" && (test?.metricas || []).some((metrica) => metrica.clave === columna.clave)));

// Sin la columna (la base sin 20261107): la API dice que no existe. Entonces
// se lee como antes y no se pregunta.
export const faltaSentido = (error) => error?.code === "42703" || /sentido/.test(`${error?.message || ""} ${error?.details || ""}`);
