import { esNumero } from "./valores.js";
import {
  TIPOS_DE_VARIABLE,
  cuentasDeGrupo,
  desvio,
  diasDe,
  dispositivoDe,
  franjasDe,
  franjasDeTabla,
  franjasDeTodo,
  indicesDe,
  porcentajesDeFila,
  promedio,
  referenciaDeFila,
  valorDeFiltro,
  valorDeVariable,
} from "./porMicrociclo.js";

// GPS › Informe › Por tarea: la parte «Por tarea» de la hoja «INFORME GPS»
// del Excel (filas 213 a 323), con sus tablas dinámicas (hoja TD,
// «TablaDinámica34» y las de las comparaciones B a E) y Micro_Sesión. Lo que
// decidió Santiago el 16/10 está en docs/PENDIENTES.md («Por tarea (16/10)»).
//
// Hasta 5 comparaciones (en el archivo, A a E fijas; Santiago, 16/10:
// «Tarjetas que sumás»), cada una con sus filtros: Tipo de Sesión,
// Microciclo, Fecha, Nombre y Condición (las segmentaciones de cada una). En
// cada una, una fila por microciclo (como su tabla dinámica, que deja afuera
// Va «Readaptación») y su fila con el promedio de esos microciclos; arriba,
// el promedio de las comparaciones. Siempre con todo su detalle: el archivo
// lo mostraba solo con un Tipo de Sesión elegido y hasta 20 microciclos.
// Cada fila, como en «Por microciclo»: U.A. suma y promedio, los índices, los
// % del V.R. de su dispositivo y las variables; sin carga crónica ni VS RIVAL
// (el archivo no los tiene en Por tarea).

export const FILTROS_POR_TAREA = Object.freeze(["tipo_sesion", "microciclo", "fecha", "nombre", "condicion"]);
export const MAXIMO_DE_COMPARACIONES = 5;
export const LETRAS = Object.freeze(["A", "B", "C", "D", "E"]);

// La página fija de las tablas dinámicas: Va vacío, No o Si.
export const entraEnPorTarea = (fila) => ["", "si", "no"].includes(String(fila?.datos?.va ?? ""));

// filtros: { filtro: [valores elegidos] }; sin nada elegido, todos.
export const pasaLosFiltrosDeTarea = (fila, filtros = {}) =>
  FILTROS_POR_TAREA.every((filtro) => {
    const elegidos = filtros[filtro];
    if (!elegidos || !elegidos.length) return true;
    const valor = valorDeFiltro(fila, filtro);
    return elegidos.some((elegido) => elegido === valor || String(elegido) === String(valor));
  });

// Las filas de una comparación: una por microciclo, de menor a mayor (las sin
// microciclo, al final). N° de sesiones: los días (fecha y clasificación de
// días) de ese microciclo con estos filtros, como Micro_Sesión (sin mirar
// Va).
export const filasDeComparacion = (filasGps, filtros = {}) => {
  const grupos = new Map();
  const deTodas = new Map();
  filasGps.forEach((fila) => {
    if (!pasaLosFiltrosDeTarea(fila, filtros)) return;
    const microciclo = esNumero(fila.datos?.microciclo) ? fila.datos.microciclo : null;
    if (!deTodas.has(microciclo)) deTodas.set(microciclo, []);
    deTodas.get(microciclo).push(fila);
    if (!entraEnPorTarea(fila)) return;
    if (!grupos.has(microciclo)) grupos.set(microciclo, []);
    grupos.get(microciclo).push(fila);
  });
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a - b))
    .map(([microciclo, suyas]) => ({
      microciclo,
      microciclos: microciclo === null ? [] : [microciclo],
      dispositivo: dispositivoDe(suyas),
      sesiones: diasDe(deTodas.get(microciclo) || suyas, false),
      ...cuentasDeGrupo(suyas),
      filas: suyas,
    }));
};

// El promedio de unos números que pueden faltar (PROMEDIO del Excel: salta
// las vacías); sin ninguno, vacío.
const promedioDe = (valores) => promedio(valores.filter(esNumero));

// Una fila de promedios (la de cada comparación y la de arriba): cada
// columna, el promedio de la de las filas (la fila 7 de la tabla dinámica,
// con todos los microciclos elegidos: Santiago, 16/10, «LAS SELECCIONADAS»;
// el archivo tomaba solo los del 17 en adelante y los buscaba mal).
const filaDePromedios = (filas, claves) => ({
  sumas: { ua: promedioDe(filas.map((fila) => fila.sumas.ua)) },
  promedios: { ua: promedioDe(filas.map((fila) => fila.promedios.ua)) },
  indices: Object.fromEntries(Object.keys(indicesDe({})).map((clave) => [clave, promedioDe(filas.map((fila) => fila.indices[clave]))])),
  variables: Object.fromEntries(claves.map((clave) => [clave, promedioDe(filas.map((fila) => fila.variables[clave]))])),
});

// El V.R. de una fila de promedios (para pintarla con Valor referencial): el
// de su último microciclo, como un jugador en Por microciclo.
const asignacionDelUltimo = (filas) => {
  const conMicrociclo = filas.filter((fila) => esNumero(fila.microciclo));
  const ultima = conMicrociclo.length ? conMicrociclo.reduce((mejor, fila) => (fila.microciclo > mejor.microciclo ? fila : mejor)) : filas[filas.length - 1];
  return ultima ? ultima.asignacion : -1;
};

// Todo «Por tarea». opciones: { comparaciones: [{ filtros }], tipoVariable,
// visualizacion, categorizacion («miSeleccion» o «valorReferencial»),
// asignaciones (los V.R. elegidos, como en Por microciclo) }. Devuelve
// { comparaciones: [{ letra, filtros, filas, resumen }], general, ua, tablas,
// franjas }: general es la fila del promedio de las comparaciones; franjas,
// las de todo lo que se ve con «Mi selección» (null con Valor referencial).
export const informePorTarea = (filasGps, opciones = {}) => {
  const { comparaciones = [{ filtros: {} }], tipoVariable = "absolutas", visualizacion = "promedio", asignaciones = [] } = opciones;
  const categorizacion = opciones.categorizacion === "valorReferencial" ? "valorReferencial" : "miSeleccion";
  const claves = TIPOS_DE_VARIABLE[tipoVariable];
  const bloques = comparaciones.slice(0, MAXIMO_DE_COMPARACIONES).map((comparacion, c) => {
    const filas = filasDeComparacion(filasGps, comparacion.filtros).map((fila) => {
      const asignacion = referenciaDeFila(asignaciones, { microciclo: fila.microciclo, dispositivo: fila.dispositivo });
      const vr = asignacion?.referencia || null;
      const porcentajes = porcentajesDeFila(fila, vr);
      return {
        ...fila,
        clave: `${LETRAS[c]}:${fila.microciclo ?? ""}`,
        asignacion: asignacion ? asignaciones.indexOf(asignacion) : -1,
        vr,
        porcentajes,
        indices: indicesDe(porcentajes.promedios),
        variables: Object.fromEntries(claves.map((clave) => [clave, valorDeVariable(fila, porcentajes, clave, tipoVariable, visualizacion)])),
      };
    });
    const resumen = filas.length
      ? {
          ...filaDePromedios(filas, claves),
          clave: `${LETRAS[c]}:resumen`,
          cantidad: filas.length,
          sesiones: filas.reduce((total, fila) => total + fila.sesiones, 0),
          asignacion: asignacionDelUltimo(filas),
        }
      : null;
    return { letra: LETRAS[c], filtros: comparacion.filtros || {}, filas, resumen };
  });
  const todas = bloques.flatMap((bloque) => bloque.filas);
  const resumenes = bloques.map((bloque) => bloque.resumen).filter(Boolean);
  const general = resumenes.length ? { ...filaDePromedios(resumenes, claves), clave: "general", cantidad: null, sesiones: null, asignacion: asignacionDelUltimo(todas) } : null;
  // La U.A., con «Mi selección», de todas las filas de microciclo (lo bajo es
  // Excelente, como en Por microciclo).
  const franjasDeUa = (valorDe) => {
    const numeros = todas.map(valorDe).filter(esNumero);
    return franjasDe(promedio(numeros), desvio(numeros), { alReves: true });
  };
  const ua = categorizacion === "miSeleccion" ? { suma: franjasDeUa((fila) => fila.sumas.ua), promedio: franjasDeUa((fila) => fila.promedios.ua) } : null;
  // «Mi selección»: unas solas franjas de todo lo que se ve (las filas de
  // microciclo de todas las comparaciones), como en Por microciclo; «Valor
  // referencial»: las del V.R. de cada fila.
  const franjas = categorizacion === "miSeleccion" ? franjasDeTodo(todas, { categorizacion, tipoVariable, visualizacion }) : null;
  const tablas = asignaciones.map((asignacion, a) => ({
    asignacion: a,
    vr: asignacion.referencia || null,
    ...(franjas ||
      franjasDeTabla(
        todas.filter((fila) => fila.asignacion === a),
        asignacion.referencia,
        { categorizacion, tipoVariable, visualizacion },
      )),
  }));
  return { comparaciones: bloques, general, ua, tablas, franjas };
};
