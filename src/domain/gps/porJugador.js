import { esNumero } from "./valores.js";
import {
  TIPOS_DE_VARIABLE,
  cargaCronicaDeJugador,
  desvio,
  franjasDe,
  franjasDeTabla,
  franjasDeTodo,
  indiceDeCargas,
  indicesDe,
  porcentajesDeFila,
  promedio,
  referenciaDeFila,
  sesionesDelObjetivo,
  valorDeVariable,
} from "./porMicrociclo.js";
import { LETRAS, MAXIMO_DE_COMPARACIONES, filasPorMicrocicloDe } from "./porTarea.js";

// GPS › Informe › Por jugador: la parte «Por Jugador - Microciclo» de la
// hoja «INFORME GPS» del Excel (filas 71 a 211), con sus tablas dinámicas
// (hoja TD, desde CW, una por comparación), Micro_Sesión, la tabla de carga
// por jugador («PSE X Jugador_Microciclo (2)») y TD2. Lo que decidió
// Santiago el 16/10 está en docs/PENDIENTES.md («Por jugador (16/10)»).
//
// Hasta 5 comparaciones (en el archivo, A a E fijas), cada una con sus
// filtros: Nombre, Microciclo, Fecha, Tipo de Sesión, Condición y
// Clasificación Días. En cada una, una fila por microciclo (su tabla
// dinámica deja afuera Va «Readaptación») y su fila con el promedio de esos
// microciclos (el archivo promediaba aparte los de antes del 17: Santiago,
// 16/10, «Todos los microciclos juntos»). Cada fila, como en Por microciclo:
// N° de sesiones y de descansos, U.A., la carga crónica del jugador en ese
// microciclo (si la comparación es de un solo jugador, como la tabla de
// carga del archivo), los índices, los % del V.R. de su dispositivo y las
// variables. Se pinta («por jugador si se pinta con las categorias»):
//   · «Mi selección»: unas solas franjas, con el promedio y el desvío de
//     todos los microciclos de todas las comparaciones, a 2 desvíos
//     (Santiago, 16/10: «Unas solas para todo»; el archivo ponía unas por
//     comparación, y en B a E a 1,5 desvíos).
//   · «Valor referencial»: cada fila, las del V.R. de su dispositivo.
//   · «Objetivo»: cada microciclo, el del equipo en ese microciclo (el
//     promedio del Team Average de sus sesiones y el desvío de los
//     jugadores; Santiago, 16/10, «Sí, por microciclo»). Solo cuando las
//     comparaciones son de jugadores.

export const FILTROS_POR_JUGADOR = Object.freeze(["nombre", "microciclo", "fecha", "tipo_sesion", "condicion", "clasificacion_dias"]);

// El jugador de una comparación, si eligió uno solo (para su carga crónica).
const jugadorDe = (filtros) => {
  const elegidos = filtros?.nombre || [];
  return elegidos.length === 1 && !String(elegidos[0]).startsWith("promedio:") ? String(elegidos[0]) : null;
};
// Objetivo pinta cuando todas las comparaciones son de jugadores (sin el
// promedio del equipo en Nombre y con alguno elegido).
export const soloDeJugadores = (comparaciones = []) =>
  comparaciones.length > 0 && comparaciones.every((comparacion) => (comparacion.filtros?.nombre || []).length > 0 && comparacion.filtros.nombre.every((valor) => !String(valor).startsWith("promedio:")));

const promedioDe = (valores) => promedio(valores.filter(esNumero));
const CLAVES_DE_INDICE = Object.keys(indicesDe({}));
const NIVELES = ["excelente", "muyBueno", "bueno", "regular", "malo", "desvio"];

// La fila de una comparación: el promedio de cada columna de sus
// microciclos; N° de sesiones y de descansos, las sumas.
const resumenDe = (filas, claves) => ({
  cantidad: filas.length,
  sesiones: filas.reduce((total, fila) => total + fila.sesiones, 0),
  descansos: filas.reduce((total, fila) => total + fila.descansos, 0),
  sumas: { ua: promedioDe(filas.map((fila) => fila.sumas.ua)) },
  promedios: { ua: promedioDe(filas.map((fila) => fila.promedios.ua)) },
  cargaCronica: { suma: promedioDe(filas.map((fila) => fila.cargaCronica.suma)), promedio: promedioDe(filas.map((fila) => fila.cargaCronica.promedio)) },
  indices: Object.fromEntries(CLAVES_DE_INDICE.map((clave) => [clave, promedioDe(filas.map((fila) => fila.indices[clave]))])),
  variables: Object.fromEntries(claves.map((clave) => [clave, promedioDe(filas.map((fila) => fila.variables[clave]))])),
});

// Unas franjas de U.A. o de carga crónica con unos números (lo bajo es
// Excelente, como en Por microciclo).
const franjasAlReves = (numeros) => franjasDe(promedio(numeros.filter(esNumero)), desvio(numeros.filter(esNumero)), { alReves: true });

// El promedio de unas franjas, nivel por nivel (para la fila de la
// comparación con Objetivo: el objetivo promedio de sus microciclos).
const promedioDeFranjas = (lista) => {
  const conDatos = lista.filter(Boolean);
  if (!conDatos.length) return null;
  const nivel = Object.fromEntries(NIVELES.map((uno) => [uno, promedioDe(conDatos.map((franjas) => franjas[uno]))]));
  return NIVELES.slice(0, 5).every((uno) => esNumero(nivel[uno])) ? nivel : null;
};
const promedioDeGrupos = (lista, claves) => Object.fromEntries(claves.map((clave) => [clave, promedioDeFranjas(lista.map((grupo) => grupo?.[clave]))]));

// Todo «Por jugador». opciones: { comparaciones: [{ filtros }], tipoVariable,
// visualizacion, categorizacion, asignaciones (los V.R. elegidos, como en Por
// microciclo) }. Devuelve { comparaciones: [{ letra, filtros, filas,
// resumen }], general, tablas, categorizacion }. general: con «Mi
// selección», las franjas de todo ({ indices, variables, ua }); con
// «Objetivo», cada fila (y su resumen) trae las suyas en `franjas`; con
// «Valor referencial», las de cada V.R. están en tablas.
export const informePorJugador = (filasGps, opciones = {}) => {
  const { comparaciones = [{ filtros: {} }], tipoVariable = "absolutas", visualizacion = "promedio", asignaciones = [] } = opciones;
  const pedidas = comparaciones.slice(0, MAXIMO_DE_COMPARACIONES);
  const pedida = opciones.categorizacion || "miSeleccion";
  const categorizacion = pedida === "objetivo" && !soloDeJugadores(pedidas) ? "miSeleccion" : pedida;
  const claves = TIPOS_DE_VARIABLE[tipoVariable];
  const cargas = indiceDeCargas(filasGps);
  const vrDeSesion = (sesion) => referenciaDeFila(asignaciones, { microciclo: sesion.microciclo, dispositivo: sesion.dispositivo })?.referencia || null;
  const bloques = pedidas.map((comparacion, c) => {
    const filtros = comparacion.filtros || {};
    const jugador = jugadorDe(filtros);
    const filas = filasPorMicrocicloDe(filasGps, filtros, FILTROS_POR_JUGADOR).map((fila) => {
      const asignacion = referenciaDeFila(asignaciones, { microciclo: fila.microciclo, dispositivo: fila.dispositivo });
      const vr = asignacion?.referencia || null;
      const porcentajes = porcentajesDeFila(fila, vr);
      const lista = {
        ...fila,
        clave: `${LETRAS[c]}:${fila.microciclo ?? ""}`,
        asignacion: asignacion ? asignaciones.indexOf(asignacion) : -1,
        vr,
        porcentajes,
        indices: indicesDe(porcentajes.promedios),
        variables: Object.fromEntries(claves.map((clave) => [clave, valorDeVariable(fila, porcentajes, clave, tipoVariable, visualizacion)])),
        cargaCronica: jugador && esNumero(fila.microciclo) ? cargaCronicaDeJugador(cargas, jugador, fila.microciclo) : { suma: null, promedio: null },
      };
      // Objetivo: el del equipo en las sesiones de ese microciclo (con los
      // demás filtros de la comparación, menos Nombre y Condición).
      if (categorizacion === "objetivo" && esNumero(fila.microciclo)) {
        const sesiones = sesionesDelObjetivo(filasGps, { microciclo: [fila.microciclo], fecha: filtros.fecha, tipo_sesion: filtros.tipo_sesion, clasificacion_dias: filtros.clasificacion_dias });
        lista.franjas = franjasDeTodo([lista], { categorizacion, tipoVariable, visualizacion, sesiones, vrDeSesion });
      }
      return lista;
    });
    const resumen = filas.length ? { ...resumenDe(filas, claves), clave: `${LETRAS[c]}:resumen` } : null;
    // La fila de la comparación, con Valor referencial, se pinta con el V.R.
    // de su último microciclo.
    if (resumen) {
      const ultima = filas.filter((fila) => esNumero(fila.microciclo)).pop() || filas[filas.length - 1];
      resumen.asignacion = ultima ? ultima.asignacion : -1;
      if (categorizacion === "objetivo") resumen.franjas = { indices: promedioDeGrupos(filas.map((fila) => fila.franjas?.indices), CLAVES_DE_INDICE), variables: promedioDeGrupos(filas.map((fila) => fila.franjas?.variables), claves) };
    }
    return { letra: LETRAS[c], filtros, jugador, filas, resumen };
  });
  const todas = bloques.flatMap((bloque) => bloque.filas);
  // Mi selección: las de todos los microciclos de todas las comparaciones
  // (la U.A. y la carga crónica, al revés, como en Por microciclo).
  const general =
    categorizacion === "miSeleccion" && todas.length
      ? {
          ...franjasDeTodo(todas, { categorizacion, tipoVariable, visualizacion }),
          ua: {
            suma: franjasAlReves(todas.map((fila) => fila.sumas.ua)),
            promedio: franjasAlReves(todas.map((fila) => fila.promedios.ua)),
            cronicaSuma: franjasAlReves(todas.map((fila) => fila.cargaCronica.suma)),
            cronicaPromedio: franjasAlReves(todas.map((fila) => fila.cargaCronica.promedio)),
          },
        }
      : null;
  const tablas = asignaciones.map((asignacion, a) => ({
    asignacion: a,
    vr: asignacion.referencia || null,
    ...(categorizacion === "valorReferencial" ? franjasDeTabla(todas.filter((fila) => fila.asignacion === a), asignacion.referencia, { categorizacion, tipoVariable, visualizacion }) : {}),
  }));
  return { comparaciones: bloques, general, tablas, categorizacion };
};
