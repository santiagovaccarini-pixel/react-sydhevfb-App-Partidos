import { esNumero } from "./valores.js";
import { claveDeNombre, colorDeUa, colorDeVariable, desvio, franjasDe, franjasDelObjetivo, franjasDelVr, promedio, sesionesDelObjetivo } from "./porMicrociclo.js";
import { entraEnElReporte, esDelEquipo, pasaLosFiltrosDelReporte } from "./reporteIndividual.js";

// GPS › Informe › Reporte grupal. La hoja «Reporte Grupal» del Excel del GPS
// es un borrador sin datos ni fórmulas: el título, «Período», «Grupo» y
// «Sesiones» arriba; «Rendimiento y carga – análisis grupal» con 10 casillas
// (la primera, «Distancia (m)») y «Jugadores en el informe». Santiago (16/10,
// en un cuestionario: «Proponeme el contenido») pidió una propuesta con los
// datos que ya hay; esto es esa propuesta (docs/PENDIENTES.md, «Reporte
// individual y Reporte grupal (16/10)»):
//   · Los filtros, los del Reporte individual (Tipo de Sesión, Fecha y
//     Microciclo), con Condición Total.
//   · Las sesiones: las del promedio del equipo de la sesión (Team Average
//     Sesion) con tiempo; las de descanso o sin GPS (tiempo 0 o vacío) no
//     cuentan.
//   · Las 10 casillas: las 9 medidas del Reporte individual y la carga
//     (U.A.); en cada una, el promedio por sesión del equipo y el total del
//     período.
//   · Los jugadores: los que tienen filas en el período (con tiempo); de cada
//     uno, cuántas sesiones y su promedio por sesión de Tiempo y de las mismas
//     10. Se pinta con las tres categorizaciones del Informe (Santiago, 16/10:
//     «Los 3 tipos de categorizacion»), con sus mismas reglas:
//       - «Mi selección»: el promedio y el desvío de los jugadores que se ven
//         (la U.A., al revés: lo bajo es Excelente);
//       - «Valor referencial»: las franjas del V.R. elegido;
//       - «Objetivo sesión/microciclo»: el equipo en las sesiones del período
//         (el Team Average de cada sesión y el desvío de sus jugadores).
//     Como en el Informe, la U.A. se pinta solo con «Mi selección» y un 0, en
//     rojo.

export const CASILLAS = Object.freeze(["d", "d_shi", "d_acchi", "d_dechi", "d_mphi", "d_s6", "d_a8", "d_a1", "d_mp5", "ua"]);
export const COLUMNAS_JUGADORES = Object.freeze(["tiempo", ...CASILLAS]);

// Con tiempo: la sesión tuvo GPS.
export const conTiempo = (fila) => esNumero(fila?.datos?.tiempo) && fila.datos.tiempo > 0;
const entra = (fila, filtros) => entraEnElReporte(fila) && conTiempo(fila) && pasaLosFiltrosDelReporte(fila, filtros);

const numerosDe = (filas, clave) => filas.map((fila) => fila.datos?.[clave]).filter(esNumero);
const sumar = (numeros) => numeros.reduce((total, x) => total + x, 0);

export const CATEGORIZACIONES_DEL_GRUPAL = Object.freeze(["miSeleccion", "valorReferencial", "objetivo"]);
// La regla de color de cada columna (la del Informe): la U.A., al revés.
export const colorDeColumna = (clave) => (clave === "ua" ? colorDeUa : colorDeVariable);

// Las franjas de cada columna de la tabla de jugadores.
const franjasDeColumnas = (jugadores, { categorizacion, vr, sesiones }) =>
  Object.fromEntries(
    COLUMNAS_JUGADORES.map((clave) => {
      if (categorizacion === "miSeleccion") {
        const numeros = jugadores.map((uno) => uno.valores[clave]).filter(esNumero);
        return [clave, franjasDe(promedio(numeros), desvio(numeros), { alReves: clave === "ua" })];
      }
      if (clave === "ua") return [clave, null];
      if (categorizacion === "valorReferencial") return [clave, vr ? franjasDelVr(vr, clave) : null];
      if (categorizacion === "objetivo") return [clave, sesiones.length ? franjasDelObjetivo(sesiones, clave) : null];
      return [clave, null];
    }),
  );

// opciones: { filtros ({ tipo_sesion, fecha, microciclo }, como en el
// Reporte individual), categorizacion, vr (el V.R. elegido, para «Valor
// referencial») }. dispositivo: el de la última sesión (para elegir el V.R.
// de entrada, como el Informe).
export const reporteGrupal = (filasGps, { filtros = {}, categorizacion = "miSeleccion", vr = null } = {}) => {
  const sesiones = filasGps.filter((fila) => esDelEquipo(fila) && entra(fila, filtros));
  const fechas = sesiones.map((fila) => fila.fecha).filter(Boolean).sort();
  const ultima = sesiones.reduce((antes, fila) => (!antes || String(fila.fecha || "") >= String(antes.fecha || "") ? fila : antes), null);
  const casillas = Object.fromEntries(
    CASILLAS.map((clave) => {
      const numeros = numerosDe(sesiones, clave);
      return [clave, { promedio: promedio(numeros), total: numeros.length ? sumar(numeros) : null }];
    }),
  );

  // Cada jugador, con sus filas del período.
  const porJugador = new Map();
  filasGps.forEach((fila) => {
    if (fila.promedio || !entra(fila, filtros)) return;
    const clave = claveDeNombre(fila);
    if (!porJugador.has(clave)) porJugador.set(clave, []);
    porJugador.get(clave).push(fila);
  });
  const jugadores = [...porJugador.entries()].map(([clave, filas]) => ({
    clave,
    sesiones: filas.length,
    valores: Object.fromEntries(COLUMNAS_JUGADORES.map((columna) => [columna, promedio(numerosDe(filas, columna))])),
  }));

  // Objetivo: las sesiones del período con GPS (las del Informe, con los
  // mismos filtros).
  const delObjetivo = categorizacion === "objetivo" ? sesionesDelObjetivo(filasGps, filtros).filter((sesion) => sesion.equipo.some(conTiempo)) : [];
  const franjas = franjasDeColumnas(jugadores, { categorizacion, vr, sesiones: delObjetivo });
  jugadores.forEach((uno) => {
    uno.colores = Object.fromEntries(COLUMNAS_JUGADORES.map((columna) => [columna, colorDeColumna(columna)(uno.valores[columna], franjas[columna])]));
  });

  return {
    sesiones: sesiones.length,
    dispositivo: ultima?.datos?.dispositivo || "",
    desde: fechas[0] || null,
    hasta: fechas[fechas.length - 1] || null,
    casillas,
    jugadores,
    franjas,
  };
};
