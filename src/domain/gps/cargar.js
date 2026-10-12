// GPS › Cargar (paso 2, Santiago 10/10): lo de cada día con la lógica de la
// plantilla «Original Suma de Bloques_CAM_nuevo.xlsm» (hoja «Sesion
// Partido»), con sus errores chicos corregidos («Corregirlos», 10/10). Entra
// el CSV de Catapult y lo que se completa de la sesión y de cada tarea; salen
// las filas de la base en el orden en que las pegaba la plantilla. Nada de
// esto toca la base: la pantalla muestra lo que va a guardar.
//
// Lo de la plantilla que se cuenta acá:
//   · El CSV: se sacan las filas «Session» (la sesión entera) y cada nombre de
//     período es un bloque (con otro número, el mismo bloque). «PRIMER TIEMPO»
//     y «SEGUNDO TIEMPO» son el partido; los demás, las tareas, ordenadas por
//     su nombre como las ordenaba la plantilla.
//   · Cada jugador tiene una sola fila «Total» por día: la que junta todo lo
//     que hizo (si hizo una sola cosa, esa fila). Las demás son «Parcial».
//   · El promedio del equipo («Team Average») de cada tarea es el de los que
//     hicieron al menos el 75 % del tiempo promedio de la tarea («Va tarea»,
//     se cambia a mano); el de cada tiempo del partido, la suma ÷ 10.
//   · El total de la sesión y su promedio, el regenerativo, los que no
//     entrenaron y el adicional, como los bloques de abajo de la plantilla.
//   · Los números de esas reglas están en REGLAS_CARGA (los cambia el club en
//     Ajustes › Reglas de carga).
//   · Errores chicos que acá están corregidos: los rangos corridos una fila,
//     HDOP del partido completo tomado del jugador de arriba, «Total» decidido
//     por la distancia en lugar de por el jugador, la pausa de la relación
//     trabajo/pausa sin las horas, la clasificación del día sin _M/_T y las
//     horas y la calidad GNSS de la fila del regenerativo (salían de otras
//     columnas). Además, en el total con partido y tareas el tiempo llega
//     hasta el final de la última tarea (la plantilla miraba la primera) y la
//     calidad GNSS y HDOP del total mira todas sus filas (la plantilla, solo
//     las tareas).
// En docs/PENDIENTES.md, «GPS», Cargar.
import { COLUMNAS_GPS, LISTAS_GPS, codigoDeTexto } from "./columnas.js";
import { leerNumero } from "../evaluaciones/importar.js";
import { leerSegundos } from "./importar.js";

// Las reglas de la plantilla (su hoja «Datos Básicos» y sus fórmulas). Los
// cortes del regenerativo y de los que no entrenaron, «como pasa hoy»
// (Santiago, 10/10): en la plantilla el de los que no entrenaron nunca deja
// contarlos y el de sesión + regenerativo siempre los deja; acá quedan
// apagados y se prenden en Ajustes.
export const REGLAS_CARGA = Object.freeze({
  // El microciclo 1 empieza el lunes de la semana de esta fecha (vacío: el 1
  // de enero del año de la sesión).
  inicioMicrociclo: "",
  // «Va tarea»: entra en el promedio de la tarea quien hizo al menos esta
  // parte del tiempo promedio (también en el total de la sesión).
  parteDelTiempo: 0.75,
  // En cada tiempo del partido, el promedio es la suma ÷ esto.
  divisorDelPartido: 10,
  // Con menos jugadores que esto no hay promedio del equipo en un bloque.
  minimoParaPromedio: 4,
  // Desde esta hora (en segundos) la sesión es de la tarde (_T).
  horaDeLaTarde: 13 * 3600,
  // Quien hizo solo regenerativo cuenta en el promedio de la sesión si lo
  // hicieron al menos estos.
  minimoRegenerativo: 7,
  // Sesión + regenerativo: con el corte prendido, cuentan si son al menos
  // minimoRegenerativo; apagado, siempre.
  cortarSesionMasRegenerativo: false,
  // Los que no entrenaron: con el corte prendido, cuentan con 0 si son menos
  // que esta parte del plantel; apagado, nunca.
  contarNoEntrenaron: false,
  parteNoEntrenaron: 0.3,
  // El día de partido, todos los del partido (también los que no ingresaron)
  // van en el promedio de la sesión.
  partidoVaEntero: true,
  // Los V.R. de partido por minuto (la plantilla: «Datos Básicos», «VR
  // Partido»): con ellos cada bloque muestra su % (vsPartido). Los pone cada
  // club; no van en el código.
  vrPartido: Object.freeze({}),
  // Lo de arriba de los bloques del partido que no se ve (Santiago, 12/10:
  // «no tienen que estar las opciones de largo, ancho, base, m2, series,
  // bloques, codigo de estrategia y nmro de jugadores»; se ven desde Ajustes).
  ocultosDelPartido: Object.freeze(["codigo", "jugadores", "series", "bloques", "largo", "ancho", "m2"]),
  // Los arqueros (Posición «Arquero» en Datos básicos) entran en la carga
  // (Santiago, 12/10: la base del club no los lleva; otro club los prende).
  conArqueros: false,
});

// Lo de arriba de un bloque del partido que se puede ocultar (el tipo de
// sesión siempre se ve: sin él no se carga).
export const CAMPOS_DEL_PARTIDO = Object.freeze(["codigo", "zona", "jugadores", "series", "bloques", "pausa", "largo", "ancho", "m2"]);

// % vs V.R. de partido (la plantilla, arriba de cada bloque, columnas P a Z):
// lo de cada minuto del Team Average del bloque ÷ el V.R. de partido; la
// metabólica, la fuerza y la velocidad, el promedio de las suyas; y el
// promedio de las nueve primeras (sin Mts >= 90% Pico). Con esto se elige la
// densidad (el «Tipo de Sesión») del bloque (Santiago, 12/10).
export const VS_PARTIDO = Object.freeze({
  medidas: Object.freeze(["d_min", "d_shi_min", "d_acchi_min", "d_dechi_min", "d_mphi_min", "d_s6_min", "d_a8_min", "d_a1_min", "d_mp5_min", "mts90_min"]),
  grupos: Object.freeze({
    metabolica: Object.freeze(["d_min", "d_shi_min", "d_mphi_min"]),
    fuerza: Object.freeze(["d_acchi_min", "d_dechi_min", "d_a8_min", "d_a1_min"]),
    velocidad: Object.freeze(["d_s6_min", "d_mp5_min"]),
  }),
  promedio: Object.freeze(["d_min", "d_shi_min", "d_acchi_min", "d_dechi_min", "d_mphi_min", "d_s6_min", "d_a8_min", "d_a1_min", "d_mp5_min"]),
});

// Cómo se escribe cada regla en Ajustes › Reglas de carga: fecha, parte (un
// porcentaje: 75 es 0,75), número (con su mínimo y máximo), hora (h:mm),
// prendida/apagada, campos (los que se ocultan, de una lista) o vr (un
// número por medida).
export const AJUSTES_DE_REGLAS = Object.freeze([
  { clave: "inicioMicrociclo", tipo: "fecha" },
  { clave: "parteDelTiempo", tipo: "parte", minimo: 0, maximo: 1 },
  { clave: "divisorDelPartido", tipo: "numero", minimo: 1, maximo: 100 },
  { clave: "minimoParaPromedio", tipo: "numero", minimo: 1, maximo: 100 },
  { clave: "horaDeLaTarde", tipo: "hora" },
  { clave: "minimoRegenerativo", tipo: "numero", minimo: 1, maximo: 100 },
  { clave: "cortarSesionMasRegenerativo", tipo: "prendida" },
  { clave: "contarNoEntrenaron", tipo: "prendida" },
  { clave: "parteNoEntrenaron", tipo: "parte", minimo: 0, maximo: 1 },
  { clave: "partidoVaEntero", tipo: "prendida" },
  { clave: "vrPartido", tipo: "vr" },
  { clave: "ocultosDelPartido", tipo: "campos", opciones: CAMPOS_DEL_PARTIDO },
  { clave: "conArqueros", tipo: "prendida" },
]);

// Las reglas del club: las guardadas que estén bien y, las demás, las de la
// plantilla.
export const reglasDelClub = (guardadas = {}) => {
  const reglas = { ...REGLAS_CARGA };
  AJUSTES_DE_REGLAS.forEach(({ clave, tipo, minimo, maximo, opciones }) => {
    const valor = guardadas?.[clave];
    if (valor === undefined || valor === null) return;
    if (tipo === "fecha" && (valor === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(valor)))) reglas[clave] = String(valor);
    else if (tipo === "prendida" && typeof valor === "boolean") reglas[clave] = valor;
    else if (tipo === "campos" && Array.isArray(valor)) reglas[clave] = Object.freeze(opciones.filter((campo) => valor.includes(campo)));
    else if (tipo === "vr" && typeof valor === "object" && !Array.isArray(valor))
      reglas[clave] = Object.freeze(Object.fromEntries(VS_PARTIDO.medidas.filter((medida) => Number.isFinite(valor[medida]) && valor[medida] > 0).map((medida) => [medida, valor[medida]])));
    else if (tipo === "hora" && Number.isFinite(valor) && valor >= 0 && valor < 86400) reglas[clave] = valor;
    else if ((tipo === "numero" || tipo === "parte") && Number.isFinite(valor) && valor >= minimo && valor <= maximo && (tipo === "parte" ? valor > 0 : true)) reglas[clave] = valor;
  });
  return reglas;
};

const MINUTOS = 60;

// ------------------------------------------------------------ El CSV --

// Un título del CSV como se compara: sin mayúsculas ni espacios de más (los
// paréntesis cuentan: «(Set 2)» es otra columna).
const tituloIgual = (texto) =>
  String(texto ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Las columnas que trae el CSV: { clave: título } de las del GPS que dicen
// su título de Catapult, más las del club que se llaman como una del CSV.
const columnasDelCsv = (columnas) => columnas.filter((columna) => columna.catapult || columna.propia);

// Una línea del CSV en celdas (con comillas, como lo escribe Catapult; o con
// tabuladores, si se copió de una planilla).
const celdasDeLinea = (linea, separador) => {
  const celdas = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < linea.length; i += 1) {
    const letra = linea[i];
    if (entreComillas) {
      if (letra === '"' && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else if (letra === '"') entreComillas = false;
      else actual += letra;
    } else if (letra === '"' && actual === "") entreComillas = true;
    else if (letra === separador) {
      celdas.push(actual);
      actual = "";
    } else actual += letra;
  }
  celdas.push(actual);
  return celdas;
};

// El nombre de un jugador como lo limpiaba la plantilla: espacios de más
// (también los «duros») y el punto del final.
export const limpiarNombre = (nombre) =>
  String(nombre ?? "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "")
    .trim();

// Las filas que no son de un jugador: la sesión entera y, en los CSV viejos,
// el promedio, el desvío y los de cada puesto.
const PERIODO_DE_LA_SESION = "session";
const NO_ES_JUGADOR = /^(prom|desvest|def|del|vol)$/i;

// La fecha de la cabecera del CSV («Date: 09/10/2026», día primero).
const fechaDelCsv = (texto) => {
  const partes = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(String(texto ?? "").trim());
  if (!partes) return null;
  const [, dia, mes, anio] = partes.map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return fecha.toISOString().slice(0, 10);
};

// El CSV de Catapult: { fecha, filas: [{ nombre, periodo, numero, valores:
// { clave: valor } }], faltan: [claves que no trae], error }. Las horas y
// las duraciones, en segundos. columnas: las del GPS del club.
export const leerCsvCatapult = (texto, columnas = COLUMNAS_GPS) => {
  const lineas = String(texto ?? "")
    .replace(/^﻿/, "")
    .split(/\r?\n/);
  let fecha = null;
  let indiceCabecera = -1;
  let separador = ",";
  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i];
    if (!linea.trim()) continue;
    const posible = linea.includes("\t") ? "\t" : ",";
    const celdas = celdasDeLinea(linea, posible).map(tituloIgual);
    if (celdas[0] === "date:" && !fecha) fecha = fechaDelCsv(celdasDeLinea(linea, posible)[1]);
    if (celdas.includes("player name") && celdas.includes("period name")) {
      indiceCabecera = i;
      separador = posible;
      break;
    }
  }
  if (indiceCabecera === -1) return { fecha, filas: [], faltan: [], error: "gps.cargar.sinCabeceras" };
  const titulos = celdasDeLinea(lineas[indiceCabecera], separador).map(tituloIgual);
  const lugar = (titulo) => titulos.indexOf(tituloIgual(titulo));
  const delJugador = lugar("Player Name");
  const delPeriodo = lugar("Period Name");
  const delNumero = lugar("Period Number");
  const suyas = columnasDelCsv(columnas)
    .map((columna) => ({ columna, indice: lugar(columna.catapult || columna.titulo?.["es-AR"] || columna.titulo?.["pt-BR"] || "") }))
    .filter(({ indice }) => indice !== -1);
  const faltan = columnas.filter((columna) => columna.catapult && !suyas.some(({ columna: suya }) => suya.clave === columna.clave)).map((columna) => columna.clave);
  const filas = [];
  lineas.slice(indiceCabecera + 1).forEach((linea) => {
    if (!linea.trim()) return;
    const celdas = celdasDeLinea(linea, separador);
    const nombre = limpiarNombre(celdas[delJugador]);
    const periodo = String(celdas[delPeriodo] ?? "").trim();
    if (!nombre || !periodo || tituloIgual(periodo) === PERIODO_DE_LA_SESION || NO_ES_JUGADOR.test(nombre)) return;
    const valores = {};
    suyas.forEach(({ columna, indice }) => {
      const textoCelda = String(celdas[indice] ?? "").trim();
      if (!textoCelda) return;
      if (columna.tipo === "tiempo" || columna.tipo === "hora") {
        const segundos = leerSegundos(textoCelda);
        if (typeof segundos === "number") valores[columna.clave] = segundos;
      } else if (columna.tipo === "texto") valores[columna.clave] = textoCelda;
      else {
        const numero = leerNumero(textoCelda);
        if (typeof numero === "number") valores[columna.clave] = numero;
      }
    });
    filas.push({ nombre, periodo, numero: delNumero === -1 ? null : leerNumero(celdas[delNumero]) ?? null, valores });
  });
  if (filas.length === 0) return { fecha, filas, faltan, error: "gps.cargar.sinFilas" };
  return { fecha, filas, faltan, error: "" };
};

// Los nombres de los tiempos del partido en el CSV (sin mayúsculas).
export const PERIODOS_DEL_PARTIDO = Object.freeze({ primer: "primer tiempo", segundo: "segundo tiempo" });

// Las filas del CSV en bloques: { primer, segundo, tareas: [{ nombre, filas }] }.
// Un mismo nombre es un bloque aunque cambie su número (los cambios del
// segundo tiempo); las tareas, ordenadas por su nombre, como la plantilla.
export const bloquesDelCsv = (filas) => {
  const porNombre = new Map();
  filas.forEach((fila) => {
    if (!porNombre.has(fila.periodo)) porNombre.set(fila.periodo, []);
    porNombre.get(fila.periodo).push(fila);
  });
  const bloques = { primer: null, segundo: null, tareas: [] };
  porNombre.forEach((suyas, nombre) => {
    const igual = tituloIgual(nombre);
    if (igual === PERIODOS_DEL_PARTIDO.primer) bloques.primer = { nombre, filas: [...(bloques.primer?.filas || []), ...suyas] };
    else if (igual === PERIODOS_DEL_PARTIDO.segundo) bloques.segundo = { nombre, filas: [...(bloques.segundo?.filas || []), ...suyas] };
    else bloques.tareas.push({ nombre, filas: suyas });
  });
  bloques.tareas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  return bloques;
};

// --------------------------------------------------- Cuentas de a una --

const esNumero = (valor) => typeof valor === "number" && Number.isFinite(valor);
const valor = (fila, clave) => (esNumero(fila?.[clave]) ? fila[clave] : null);
const sumar = (filas, clave) => filas.reduce((total, fila) => total + (valor(fila, clave) ?? 0), 0);
const hayAlguno = (filas, clave) => filas.some((fila) => valor(fila, clave) !== null);
const promedio = (filas, clave) => {
  const numeros = filas.map((fila) => valor(fila, clave)).filter((numero) => numero !== null);
  return numeros.length ? numeros.reduce((a, b) => a + b, 0) / numeros.length : null;
};
const maximo = (filas, clave) => {
  const numeros = filas.map((fila) => valor(fila, clave)).filter((numero) => numero !== null);
  return numeros.length ? Math.max(...numeros) : null;
};
const minimo = (filas, clave) => {
  const numeros = filas.map((fila) => valor(fila, clave)).filter((numero) => numero !== null);
  return numeros.length ? Math.min(...numeros) : null;
};
// Pesado por el tiempo (SUMAPRODUCTO ÷ SUMA): lo que falta cuenta 0.
const ponderado = (filas, clave) => {
  const tiempo = sumar(filas, "tiempo");
  if (!(tiempo > 0)) return null;
  return filas.reduce((total, fila) => total + (valor(fila, clave) ?? 0) * (valor(fila, "tiempo") ?? 0), 0) / tiempo;
};
// Una medida por minuto (la suma de la medida ÷ la suma de los minutos).
const porMinutoDe = (filas, clave) => {
  const tiempo = sumar(filas, "tiempo");
  return tiempo > 0 ? sumar(filas, clave) / (tiempo / MINUTOS) : null;
};
// El valor más repetido (si empatan, el que aparece primero).
const masRepetido = (valores) => {
  const cuenta = new Map();
  valores.forEach((v) => cuenta.set(v, (cuenta.get(v) || 0) + 1));
  let elegido = null;
  cuenta.forEach((veces, v) => {
    if (elegido === null || veces > cuenta.get(elegido)) elegido = v;
  });
  return elegido;
};

// Las columnas de Catapult por cómo se juntan (columnas.js, «junta»).
const gruposDe = (columnas) => {
  const de = (junta) => columnas.filter((columna) => columna.junta === junta && columna.tipo !== "porMinuto");
  const medidas = de("suma").filter((columna) => columna.clave !== "tiempo");
  const conPorMinuto = Object.fromEntries(columnas.filter((columna) => columna.tipo === "porMinuto").map((columna) => [columna.de, columna.clave]));
  return {
    // D … Mts >= 90% Pico: tienen su «por minuto».
    medidas: medidas.filter((columna) => conPorMinuto[columna.clave]),
    // Distancia Explosiva, 19,8-25,2, Esfuerzo Explosivo: sin «por minuto».
    sumas: medidas.filter((columna) => !conPorMinuto[columna.clave]),
    porMinuto: conPorMinuto,
    maximos: de("maximo"),
    ponderados: de("ponderado"),
    explosivaPorMinuto: de("explosivaPorMinuto"),
    // Las que el club no suma en el total de la sesión de cada jugador.
    fueraDelTotal: new Set(columnas.filter((columna) => columna.enElTotal === false).map((columna) => columna.clave)),
    // Las del club que vienen en el CSV: solo en la fila de cada jugador.
    propias: columnas.filter((columna) => columna.propia),
  };
};

// Los «por minuto» de una fila con sus medidas y su tiempo.
const conPorMinutos = (datos, grupos, { cero = false } = {}) => {
  grupos.medidas.forEach((columna) => {
    const medida = valor(datos, columna.clave);
    const tiempo = valor(datos, "tiempo");
    let calculado = null;
    if (medida !== null && tiempo > 0) calculado = medida / (tiempo / MINUTOS);
    else if (medida !== null && cero) calculado = 0;
    if (calculado !== null) datos[grupos.porMinuto[columna.clave]] = calculado;
  });
  return datos;
};

// ------------------------------------------------------- La sesión --

// El microciclo de una fecha: semanas de lunes a domingo desde el lunes de
// la semana de `inicio` (la plantilla: «Fecha inicio Mic»).
export const microcicloDe = (fecha, inicio = "") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ""))) return null;
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(inicio || "")) ? inicio : `${fecha.slice(0, 4)}-01-01`;
  const dia = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;
  const inicioDia = dia(desde);
  const lunes = inicioDia - ((new Date(inicioDia * 86400000).getUTCDay() + 6) % 7);
  return Math.floor((dia(fecha) - lunes) / 7) + 1;
};

// «2026_10_09» (lo que empieza cada descripción).
const prefijoDeFecha = (fecha) => String(fecha || "").replace(/-/g, "_");
// Lo que va después de la fecha en una descripción (la plantilla:
// EXTRAE(descripción; 12; 1000)).
const sinFecha = (descripcion) => String(descripcion || "").slice(11);
// Las descripciones de los totales juntan las partes con « + »; la plantilla
// después cambiaba «+  +» por «+» hasta que no quedara ninguno.
const juntarPartes = (texto) => {
  let limpio = texto;
  while (limpio.includes("+  +")) limpio = limpio.split("+  +").join("+");
  return limpio;
};

// La clasificación del día con su _M o _T, como código de la lista.
const clasificacionDe = (dia, inicio, reglas) => {
  if (!dia) return null;
  const tarde = esNumero(inicio) && inicio >= reglas.horaDeLaTarde;
  return codigoDeTexto(`${dia}_${tarde ? "T" : "M"}`);
};

// Lo mismo en todas las filas de la sesión.
const datosDelDia = (carga, microciclo) => {
  const datos = {};
  if (microciclo !== null) datos.microciclo = microciclo;
  if (carga.tipoMicrociclo) datos.tipo_microciclo = carga.tipoMicrociclo;
  if (carga.dispositivo) datos.dispositivo = carga.dispositivo;
  return datos;
};

// Un número de la tarea que no se escribió (0 o vacío): no va.
const siHay = (numero) => (esNumero(numero) && numero !== 0 ? numero : null);
// Un dato escrito como lo pone el Excel en un texto (los decimales, con coma).
const comoEnElExcel = (valor) => {
  if (valor === null || valor === undefined) return "";
  if (esNumero(valor)) return String(valor).replace(".", ",");
  return String(valor).trim();
};

// ¿El CSV ya está en la Base? Cuántas de sus filas tienen, ese día, una fila
// en la Base con la misma distancia, el mismo tiempo y la misma hora de
// inicio (Santiago, 12/10: si ya está, no se carga). Los nombres no cuentan:
// una distancia con todos sus decimales no se repite.
export const filasYaEnLaBase = (filasCsv = [], filasBase = []) => {
  const iguales = (a, b, margen) => esNumero(a) && esNumero(b) && Math.abs(a - b) <= margen;
  const deLaBase = filasBase.map((fila) => fila?.datos || {}).filter((datos) => esNumero(datos.d) && datos.d > 0);
  return filasCsv.filter((fila) => {
    const v = fila?.valores || {};
    if (!(esNumero(v.d) && v.d > 0)) return false;
    return deLaBase.some(
      (datos) =>
        iguales(v.d, datos.d, 1e-4) &&
        (!esNumero(v.tiempo) || !esNumero(datos.tiempo) || iguales(v.tiempo, datos.tiempo, 0.5)) &&
        (!esNumero(v.inicio) || !esNumero(datos.inicio) || iguales(v.inicio, datos.inicio, 0.5)),
    );
  }).length;
};

// Los m² por jugador (la plantilla, con base: un trapecio).
export const metrosPorJugador = ({ largo, ancho, base, jugadores }) => {
  if (!esNumero(largo) || !esNumero(ancho) || !(jugadores > 0)) return null;
  const area = esNumero(base) && base !== 0 ? ancho * largo - ((ancho - base) / 2) * largo : ancho * largo;
  return Math.round((area / jugadores) * 100) / 100;
};

// La relación pausa / trabajo de la tarea: la pausa sobre el tiempo más largo
// menos la pausa (la plantilla no contaba las horas).
export const pausaSobreTrabajo = (pausa, filas) => {
  if (!esNumero(pausa) || pausa === 0) return null;
  const mayor = maximo(filas, "tiempo");
  if (!esNumero(mayor) || mayor - pausa === 0) return null;
  return pausa / (mayor - pausa);
};

// El % vs V.R. de partido de un bloque (VS_PARTIDO) con los datos de su Team
// Average: { medidas: { d_min: 0,85 … }, metabolica, fuerza, velocidad,
// promedio }. Sin el dato o sin su V.R., vacío (la plantilla: «»); un
// promedio, de los que hay.
export const vsPartido = (datos, vr = {}) => {
  const medidas = Object.fromEntries(
    VS_PARTIDO.medidas.map((clave) => {
      const delBloque = valor(datos, clave);
      const referencia = valor(vr, clave);
      return [clave, delBloque !== null && referencia ? delBloque / referencia : null];
    }),
  );
  const promedioDe = (claves) => {
    const numeros = claves.map((clave) => medidas[clave]).filter((numero) => numero !== null);
    return numeros.length ? numeros.reduce((a, b) => a + b, 0) / numeros.length : null;
  };
  return {
    medidas,
    metabolica: promedioDe(VS_PARTIDO.grupos.metabolica),
    fuerza: promedioDe(VS_PARTIDO.grupos.fuerza),
    velocidad: promedioDe(VS_PARTIDO.grupos.velocidad),
    promedio: promedioDe(VS_PARTIDO.promedio),
  };
};

// Un arquero de Datos básicos (su Posición).
export const esArquero = (jugador) => jugador?.posicion === "goleiro";

// Lo que lleva toda fila que va a la Base (Santiago, 12/10: «No se puede
// cargar ningun dato que no tenga dia de microciclo, dispositivo o tipo de
// sesion»): las claves que le faltan a alguna.
export const OBLIGATORIOS = Object.freeze(["clasificacion_dias", "dispositivo", "tipo_sesion"]);
export const faltaLoObligatorio = (filas = []) => OBLIGATORIOS.filter((clave) => filas.some((fila) => !fila?.datos?.[clave]));

// El nombre de una opción como en el Excel (las listas de columnas.js).
const etiquetaDelExcel = (lista, codigo) => LISTAS_GPS[lista]?.find((opcion) => opcion.codigo === codigo)?.etiquetas?.["es-AR"] ?? null;

// Una fila para la base.
const filaDeLaBase = (fecha, quien, datos) => ({
  fecha,
  jugador_id: quien?.jugador_id ?? null,
  persona: quien?.jugador_id ? null : quien?.persona ?? null,
  promedio: quien?.promedio ?? null,
  datos: Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== null && v !== undefined && v !== "" && !(typeof v === "number" && !Number.isFinite(v)))),
});

// ---------------------------------------------------- Calcular el día --

// carga: lo de la sesión (ver la pantalla, src/CargarGps.jsx):
//   { fecha, tipoMicrociclo, dia ("+1"), dispositivo,
//     partido: { nombre ("Vs …"), tareaPartido, primer, segundo, completo,
//                banco: { …, jugadores: [quien] } } | null,
//       (cada tiempo y el completo: { tipoSesion, zona, codigo, jugadores,
//        series, bloques, pausa, largo, ancho, m2 }, como su encabezado en
//        la plantilla)
//     tareas: [tarea], adicional: tarea | null,
//     sesion: { tipoSesion, zona, codigo, base, largo, ancho, jugadores,
//               pausa, cpJug },
//     regenerativo: { duracion (s), jugadores: [quien] },
//     noEntrenaron: [{ quien, motivo, tipoSesion }],
//     va: { [quien.clave]: "si" | "no" } (el «Va» del total, a mano) }
// tarea: { id, nombre, tipoSesion, zona, codigo, jugadores, pausa, cpJug,
//          base, largo, ancho, enLaDescripcion (va en la descripción del
//          promedio de la sesión), filas: [{ quien, valores, vaTarea? }] }
// quien: { clave, jugador_id } o { clave, persona }.
// Devuelve { filas: [fila de la base, con _quien y _seccion para la
// pantalla], totales: [{ quien, tiempo, va }] }.
export const calcularCarga = (carga, { reglas = REGLAS_CARGA, columnas = COLUMNAS_GPS, etiqueta = etiquetaDelExcel } = {}) => {
  const grupos = gruposDe(columnas);
  // El código de estrategia va escrito en la descripción («PC Posesión …»).
  const textoDelCodigo = (codigo) => (codigo ? etiqueta("codigo_estrategia", codigo) || codigo : "");
  const fecha = carga.fecha;
  const prefijo = prefijoDeFecha(fecha);
  const microciclo = microcicloDe(fecha, reglas.inicioMicrociclo);
  const delDia = () => datosDelDia(carga, microciclo);
  const salida = [];
  const agregar = (seccion, quien, datos) => {
    const fila = filaDeLaBase(fecha, quien?.clave ? quien : null, datos);
    if (quien?.promedio) fila.promedio = quien.promedio;
    fila._quien = quien?.clave || null;
    fila._seccion = seccion;
    salida.push(fila);
    return fila;
  };
  const PARCIAL = codigoDeTexto("Parcial");
  const TOTAL = codigoDeTexto("Total");
  const SI = codigoDeTexto("Si");
  const NO = codigoDeTexto("No");
  const OTRA_TAREA = codigoDeTexto("Otra Tarea");
  const REGENERACION = codigoDeTexto("Regeneración");
  const promedioParcial = { clave: "promedio:parcial", promedio: "parcial" };

  // Los valores de una fila del CSV, con sus «por minuto».
  const valoresDe = (fila) => conPorMinutos({ ...fila.valores }, grupos);

  // ------------------------------------------- Quién hizo qué en el día --
  const partido = carga.partido && (carga.partido.primer?.filas?.length || carga.partido.segundo?.filas?.length) ? carga.partido : null;
  const mitades = partido ? [partido.primer, partido.segundo].filter((mitad) => mitad?.filas?.length) : [];
  const tareas = (carga.tareas || []).filter((tarea) => tarea.filas?.length);
  const adicional = carga.adicional?.filas?.length ? carga.adicional : null;
  const banco = partido ? (partido.banco?.jugadores || []).filter(Boolean) : [];
  const regenerativo = carga.regenerativo?.jugadores?.length ? carga.regenerativo : null;
  const noEntrenaron = (carga.noEntrenaron || []).filter((uno) => uno?.quien);

  // Cada persona, con sus filas.
  const personas = new Map();
  const persona = (quien) => {
    if (!personas.has(quien.clave))
      personas.set(quien.clave, { quien, mitades: [], tareas: [], banco: false, adicional: [], regenerativo: false, noEntreno: null });
    return personas.get(quien.clave);
  };
  mitades.forEach((mitad, m) => mitad.filas.forEach((fila) => persona(fila.quien).mitades.push({ m, valores: valoresDe(fila) })));
  banco.forEach((quien) => {
    persona(quien).banco = true;
  });
  tareas.forEach((tarea, t) => tarea.filas.forEach((fila, f) => persona(fila.quien).tareas.push({ t, f, valores: valoresDe(fila) })));
  if (adicional) adicional.filas.forEach((fila, f) => persona(fila.quien).adicional.push({ f, valores: valoresDe(fila) }));
  if (regenerativo)
    regenerativo.jugadores.forEach((quien) => {
      persona(quien).regenerativo = true;
    });
  noEntrenaron.forEach((uno) => {
    persona(uno.quien).noEntreno = uno;
  });

  // ¿Cuántas filas tiene en la sesión (sin el adicional)? El banco es una.
  const filasDeSesion = (p) => p.mitades.length + p.tareas.length + (p.banco ? 1 : 0);
  const jugoElPartido = (p) => p.mitades.length > 0;

  // ------------------------------------------------ Los tiempos del partido --
  // La descripción de un tiempo del partido (y del partido completo), como
  // la de la plantilla: el código, el nombre y, si se escribieron, los
  // jugadores, las series, los bloques, la pausa y la cancha.
  const descripcionDelPartido = (bloque, nombre) => {
    const b = bloque || {};
    const [jugadores, series, bloques, pausa, largo, ancho] = ["jugadores", "series", "bloques", "pausa", "largo", "ancho"].map((campo) => comoEnElExcel(b[campo]));
    return (
      `${prefijo}_${textoDelCodigo(b.codigo)} ${nombre}` +
      `${jugadores ? `, ${jugadores} jug, ` : ""}${series}${series ? " series x " : ""}${bloques}${bloques ? " bloques, pausa: " : ""}` +
      `${pausa} ${largo}${largo ? " x " : ""}${ancho}`
    );
  };
  const nombreDelPartido = (sufijo) => [partido?.nombre, sufijo].filter(Boolean).join(" ");
  const datosDeBloque = (bloque, extra = {}) => {
    const datos = delDia();
    if (bloque?.tipoSesion) datos.tipo_sesion = bloque.tipoSesion;
    if (bloque?.zona) datos.zona_impacto = bloque.zona;
    if (bloque?.codigo) datos.codigo_estrategia = bloque.codigo;
    return Object.assign(datos, extra);
  };

  // El promedio de un tiempo del partido (y del partido completo): la suma ÷
  // 10 (Mts >= 90% Pico: el promedio; las máximas y las horas, pesadas por
  // el tiempo).
  const promedioDelPartido = (filas, { maximas = null } = {}) => {
    const datos = {};
    const divisor = reglas.divisorDelPartido;
    grupos.medidas.forEach((columna) => {
      datos[columna.clave] = columna.mitadDelPartido === "promedio" ? promedio(filas, columna.clave) : sumar(filas, columna.clave) / divisor;
      const pm = porMinutoDe(filas, columna.clave);
      if (pm !== null) datos[grupos.porMinuto[columna.clave]] = pm;
    });
    datos.tiempo = sumar(filas, "tiempo") / divisor;
    grupos.maximos.forEach((columna) => {
      datos[columna.clave] = maximas ? maximas[columna.clave] : ponderado(filas, columna.clave);
    });
    grupos.sumas.forEach((columna) => {
      datos[columna.clave] = sumar(filas, columna.clave) / divisor;
    });
    grupos.explosivaPorMinuto.forEach((columna) => {
      datos[columna.clave] = porMinutoDe(filas, "dist_explosiva");
    });
    ["inicio", "fin"].forEach((clave) => {
      if (hayAlguno(filas, clave)) datos[clave] = ponderado(filas, clave);
    });
    grupos.ponderados.forEach((columna) => {
      datos[columna.clave] = ponderado(filas, columna.clave);
    });
    return datos;
  };

  const promediosDeMitades = [];
  if (partido) {
    const sufijos = ["PT", "ST"];
    [partido.primer, partido.segundo].forEach((mitad, m) => {
      if (!mitad?.filas?.length) return;
      const nombre = nombreDelPartido(sufijos[m]);
      const descripcion = descripcionDelPartido(mitad, nombre);
      const filas = mitad.filas.map((fila) => ({ quien: fila.quien, valores: valoresDe(fila) }));
      const extra = { tarea_partido: partido.tareaPartido || null, descripcion, m2: siHay(mitad.m2) };
      if (filas.length >= reglas.minimoParaPromedio) {
        const datos = { ...datosDeBloque(mitad, extra), ...promedioDelPartido(filas.map((fila) => fila.valores)), condicion: PARCIAL };
        datos.clasificacion_dias = clasificacionDe(carga.dia, datos.inicio, reglas);
        promediosDeMitades[m] = datos;
        agregar(`partido:${m}`, promedioParcial, datos);
      }
      filas.forEach((fila, f) => {
        const p = personas.get(fila.quien.clave);
        const datos = { ...datosDeBloque(mitad, extra), ...fila.valores, clasificacion_dias: clasificacionDe(carga.dia, fila.valores.inicio, reglas) };
        const agregada = agregar(`partido:${m}`, fila.quien, datos);
        agregada._persona = p;
        agregada._fila = f;
      });
    });
  }

  // El partido completo de cada uno: la suma de los dos tiempos (las
  // máximas, la mayor; el inicio, el de su primer tiempo; el fin, el del
  // último).
  const completoDe = (p) => {
    const filas = p.mitades.map((mitad) => mitad.valores);
    const datos = {};
    grupos.medidas.forEach((columna) => {
      datos[columna.clave] = sumar(filas, columna.clave);
    });
    datos.tiempo = sumar(filas, "tiempo");
    conPorMinutos(datos, grupos);
    grupos.maximos.forEach((columna) => {
      datos[columna.clave] = Math.max(...filas.map((fila) => valor(fila, columna.clave) ?? 0));
    });
    grupos.sumas.forEach((columna) => {
      datos[columna.clave] = sumar(filas, columna.clave);
    });
    grupos.explosivaPorMinuto.forEach((columna) => {
      datos[columna.clave] = datos.tiempo > 0 ? (datos.dist_explosiva ?? 0) / (datos.tiempo / MINUTOS) : null;
    });
    const primero = p.mitades.slice().sort((a, b) => a.m - b.m)[0].valores;
    const ultimo = p.mitades.slice().sort((a, b) => a.m - b.m)[p.mitades.length - 1].valores;
    if (valor(primero, "inicio") !== null) datos.inicio = primero.inicio;
    if (valor(ultimo, "fin") !== null) datos.fin = ultimo.fin;
    grupos.ponderados.forEach((columna) => {
      datos[columna.clave] = ponderado(filas, columna.clave);
    });
    return datos;
  };

  const enElPartido = [...personas.values()].filter(jugoElPartido);
  let promedioCompleto = null;
  if (partido) {
    const nombre = nombreDelPartido("TOTAL");
    const bloque = partido.completo || {};
    const extra = { tarea_partido: partido.tareaPartido || null, descripcion: descripcionDelPartido(bloque, nombre), m2: siHay(bloque.m2) };
    if (enElPartido.length >= reglas.minimoParaPromedio) {
      const filas = enElPartido.map(completoDe);
      const maximas = Object.fromEntries(grupos.maximos.map((columna) => [columna.clave, maximo(promediosDeMitades.filter(Boolean), columna.clave)]));
      const datos = { ...datosDeBloque(bloque, extra), ...promedioDelPartido(filas, { maximas }), condicion: PARCIAL };
      datos.clasificacion_dias = clasificacionDe(carga.dia, datos.inicio, reglas);
      promedioCompleto = datos;
      agregar("partido:completo", promedioParcial, datos);
    }
    // Quien jugó un solo tiempo ya tiene esa fila: el completo sería igual.
    enElPartido
      .filter((p) => p.mitades.length > 1)
      .forEach((p) => {
        const datos = { ...datosDeBloque(bloque, extra), ...completoDe(p) };
        datos.clasificacion_dias = clasificacionDe(carga.dia, datos.inicio, reglas);
        agregar("partido:completo", p.quien, datos)._persona = p;
      });
    // Los que no ingresaron: todo en 0; inicio y fin, los más tempranos del
    // partido.
    const banquillo = partido.banco || {};
    const filasDelPartido = salida.filter((fila) => String(fila._seccion).startsWith("partido:")).map((fila) => fila.datos);
    const inicioDelPartido = minimo(filasDelPartido, "inicio");
    const finDelPartido = minimo(filasDelPartido, "fin");
    const extraBanco = { tarea_partido: partido.tareaPartido || null, descripcion: descripcionDelPartido({ codigo: banquillo.codigo }, nombreDelPartido("SIN INGRESAR")) };
    banco.forEach((quien) => {
      const datos = { ...datosDeBloque({ ...banquillo, zona: null }, extraBanco) };
      grupos.medidas.forEach((columna) => {
        datos[columna.clave] = 0;
        datos[grupos.porMinuto[columna.clave]] = 0;
      });
      datos.tiempo = 0;
      [...grupos.maximos, ...grupos.sumas, ...grupos.explosivaPorMinuto, ...grupos.ponderados].forEach((columna) => {
        datos[columna.clave] = 0;
      });
      if (inicioDelPartido !== null) datos.inicio = inicioDelPartido;
      if (finDelPartido !== null) datos.fin = finDelPartido;
      datos.clasificacion_dias = clasificacionDe(carga.dia, datos.inicio, reglas);
      const p = personas.get(quien.clave);
      p.bancoValores = datos;
      agregar("partido:banco", quien, datos)._persona = p;
    });
  }

  // ---------------------------------------------------------- Las tareas --
  const descripcionDeTarea = (tarea) => `${prefijo}_${textoDelCodigo(tarea.codigo)} ${tarea.nombre || ""}`;
  // «Va tarea»: hizo al menos el 75 % del tiempo promedio de la tarea (o lo
  // que se eligió a mano).
  const vaEnLaTarea = (filas) => {
    const tiempoPromedio = promedio(
      filas.map((fila) => fila.valores),
      "tiempo",
    );
    return filas.map((fila) => {
      if (fila.vaTarea === SI || fila.vaTarea === NO) return fila.vaTarea === SI;
      return esNumero(tiempoPromedio) && (valor(fila.valores, "tiempo") ?? 0) >= reglas.parteDelTiempo * tiempoPromedio;
    });
  };
  const datosDeTarea = (tarea, filas) => {
    const extra = { tarea_partido: OTRA_TAREA, descripcion: descripcionDeTarea(tarea) };
    const m2 = metrosPorJugador(tarea);
    if (m2 !== null) extra.m2 = m2;
    const cp = pausaSobreTrabajo(tarea.pausa, filas.map((fila) => fila.valores));
    if (cp !== null) extra.cp_tarea = cp;
    ["cpJug", "base", "largo", "ancho"].forEach((campo) => {
      const numero = siHay(tarea[campo]);
      if (numero !== null) extra[{ cpJug: "cp_jug", base: "base", largo: "largo", ancho: "ancho" }[campo]] = numero;
    });
    return extra;
  };
  // El número de tarea de cada jugador: cuántas tareas lleva hasta esta.
  const vecesHasta = new Map();
  const numerosDeTareas = [...tareas, ...(adicional ? [adicional] : [])].map((tarea) =>
    tarea.filas.map((fila) => {
      const veces = (vecesHasta.get(fila.quien.clave) || 0) + 1;
      vecesHasta.set(fila.quien.clave, veces);
      return veces;
    }),
  );

  // El promedio del equipo de una tarea (o del adicional): el de los «Va
  // tarea»; inicio, fin y clasificación, los del primero de la lista.
  const promedioDeTarea = (tarea, filas, va, numeroDeTarea) => {
    const queVan = filas.filter((_, i) => va[i]).map((fila) => fila.valores);
    const todas = filas.map((fila) => fila.valores);
    const datos = {};
    grupos.medidas.forEach((columna) => {
      const prom = promedio(queVan, columna.clave);
      if (prom !== null) datos[columna.clave] = prom;
      const pm = porMinutoDe(queVan, columna.clave);
      if (pm !== null) datos[grupos.porMinuto[columna.clave]] = pm;
    });
    const tiempo = promedio(queVan, "tiempo");
    if (tiempo !== null) datos.tiempo = tiempo;
    [...grupos.maximos, ...grupos.sumas].forEach((columna) => {
      if (hayAlguno(todas, columna.clave)) datos[columna.clave] = promedio(queVan, columna.clave);
    });
    grupos.explosivaPorMinuto.forEach((columna) => {
      if (hayAlguno(todas, columna.clave)) datos[columna.clave] = porMinutoDe(queVan, "dist_explosiva");
    });
    ["inicio", "fin"].forEach((clave) => {
      if (hayAlguno(todas, clave) && valor(todas[0], clave) !== null) datos[clave] = todas[0][clave];
    });
    grupos.ponderados.forEach((columna) => {
      datos[columna.clave] = ponderado(todas, columna.clave);
    });
    if (numeroDeTarea) datos.numero_tarea = numeroDeTarea;
    return datos;
  };

  const filasDeTarea = (tarea, t, seccion) => {
    const filas = tarea.filas.map((fila) => ({ ...fila, valores: valoresDe(fila) }));
    const va = vaEnLaTarea(filas);
    const extra = datosDeTarea(tarea, filas);
    const conPromedio = filas.length >= reglas.minimoParaPromedio;
    const numeros = numerosDeTareas[t];
    const numeroDeTarea = conPromedio ? codigoDeTexto(`M${masRepetido(numeros)}`) : null;
    const clasificacionPrimero = clasificacionDe(carga.dia, filas[0]?.valores?.inicio, reglas);
    let promedioFila = null;
    if (conPromedio && (seccion !== "adicional" || va.filter(Boolean).length >= reglas.minimoParaPromedio)) {
      const datos = { ...datosDeBloque(tarea, extra), ...promedioDeTarea(tarea, filas, va, numeroDeTarea), condicion: seccion === "adicional" ? TOTAL : PARCIAL };
      datos.clasificacion_dias = clasificacionPrimero;
      promedioFila = agregar(seccion, promedioParcial, datos);
    }
    filas.forEach((fila, f) => {
      const datos = { ...datosDeBloque(tarea, extra), ...fila.valores };
      if (numeroDeTarea) datos.numero_tarea = codigoDeTexto(`M${numeros[f]}`);
      datos.clasificacion_dias = seccion === "adicional" && promedioFila ? promedioFila.datos.clasificacion_dias : clasificacionDe(carga.dia, fila.valores.inicio, reglas);
      const agregada = agregar(seccion, fila.quien, datos);
      agregada._persona = personas.get(fila.quien.clave);
      agregada._vaTarea = va[f] ? SI : NO;
      agregada._fila = f;
    });
    return { filas, va, promedioFila };
  };
  const tareasCalculadas = tareas.map((tarea, t) => filasDeTarea(tarea, t, `tarea:${tarea.id ?? t}`));

  // ----------------------------------------- El total de cada jugador --
  const enLaSesion = [...personas.values()].filter((p) => filasDeSesion(p) > 0);
  const totalDe = (p) => {
    const filas = [...p.mitades.map((mitad) => mitad.valores), ...(p.bancoValores ? [p.bancoValores] : []), ...p.tareas.map((tarea) => tarea.valores)];
    const datos = {};
    grupos.medidas.forEach((columna) => {
      datos[columna.clave] = sumar(filas, columna.clave);
    });
    // El tiempo: con partido y tareas, del inicio del partido al final de la
    // última tarea; solo partido, el del partido; si no, del inicio de la
    // primera tarea al final de la última (con las pausas).
    const finDeTarea = (tarea) => (valor(tarea.valores, "inicio") !== null ? tarea.valores.inicio + (valor(tarea.valores, "tiempo") ?? 0) : null);
    const finales = p.tareas.map(finDeTarea).filter((fin) => fin !== null);
    const inicios = p.tareas.map((tarea) => valor(tarea.valores, "inicio")).filter((inicio) => inicio !== null);
    if (jugoElPartido(p) && p.tareas.length) {
      const completo = completoDe(p);
      datos.tiempo = (finales.length ? Math.max(...finales) : 0) - (completo.inicio ?? 0);
    } else if (jugoElPartido(p)) datos.tiempo = completoDe(p).tiempo;
    else datos.tiempo = (finales.length ? Math.max(...finales) : 0) - (inicios.length ? Math.min(...inicios) : 0);
    conPorMinutos(datos, grupos, { cero: true });
    grupos.maximos.forEach((columna) => {
      if (!grupos.fueraDelTotal.has(columna.clave)) datos[columna.clave] = maximo(filas, columna.clave);
    });
    grupos.sumas.forEach((columna) => {
      if (!grupos.fueraDelTotal.has(columna.clave)) datos[columna.clave] = sumar(filas, columna.clave);
    });
    // La plantilla deja vacía una hora en 0.
    const inicio = minimo(filas, "inicio");
    const fin = maximo(filas, "fin");
    if (inicio) datos.inicio = inicio;
    if (fin) datos.fin = fin;
    grupos.ponderados.forEach((columna) => {
      datos[columna.clave] = ponderado(filas, columna.clave);
    });
    return datos;
  };
  const totales = new Map(enLaSesion.map((p) => [p.quien.clave, totalDe(p)]));
  const tiempoPromedio = promedio([...totales.values()], "tiempo");
  // «Va» del total (la plantilla: «Va Tarea?» del total): llegó al 75 % del
  // tiempo promedio de los totales, o lo que se eligió a mano.
  // El día de partido, los del partido (también los que no ingresaron) van
  // todos: así está en el historial (Santiago lo cambia a mano si no).
  const vaDelTotal = (p) => {
    const elegido = carga.va?.[p.quien.clave];
    if (elegido === SI || elegido === NO) return elegido === SI;
    if (reglas.partidoVaEntero && (jugoElPartido(p) || p.banco)) return true;
    return esNumero(tiempoPromedio) && (valor(totales.get(p.quien.clave), "tiempo") ?? 0) >= reglas.parteDelTiempo * tiempoPromedio;
  };

  // El regenerativo.
  const cuantosRegenerativo = regenerativo ? regenerativo.jugadores.length : 0;
  const regenerativoCuenta = cuantosRegenerativo >= reglas.minimoRegenerativo;
  const combinadaCuenta = !reglas.cortarSesionMasRegenerativo || cuantosRegenerativo >= reglas.minimoRegenerativo;
  // Los que no entrenaron.
  const plantelDelDia = Math.max(1, Number(carga.plantel) || 0);
  const noEntrenoCuenta = reglas.contarNoEntrenaron && noEntrenaron.length < reglas.parteNoEntrenaron * plantelDelDia;

  // Quién tiene más de una cosa en el día: su fila «Total» es la que junta
  // todo.
  const conRegenerativo = (p) => p.regenerativo && filasDeSesion(p) > 0;
  const conAdicional = (p) => p.adicional.length > 0;

  // La fila que es el total de su sesión: si hizo una sola cosa, esa; si
  // jugó los dos tiempos y nada más, el partido completo; si no, una fila
  // aparte.
  const representante = new Map();
  salida.forEach((fila) => {
    const p = fila._persona;
    if (!p || filasDeSesion(p) === 0) return;
    const unica = filasDeSesion(p) === 1;
    const soloPartido = jugoElPartido(p) && !p.tareas.length && !p.banco && p.mitades.length > 1 && fila._seccion === "partido:completo";
    if ((unica || soloPartido) && !representante.has(p.quien.clave)) representante.set(p.quien.clave, fila);
  });

  // ----------------------------------- Los promedios y totales de la sesión --
  const sesion = carga.sesion || {};
  const datosDeSesion = (extra = {}) => datosDeBloque(sesion, { tarea_partido: OTRA_TAREA, ...extra });
  // La descripción del promedio de la sesión: el partido y las tareas (con
  // su promedio) que se marcaron.
  const partesDeTareas = tareasCalculadas.map((calculada, t) => (calculada.promedioFila && tareas[t].enLaDescripcion !== false ? sinFecha(calculada.promedioFila.datos.descripcion) : ""));
  const descripcionPromedioSesion = (() => {
    const desdeElPartido = promedioCompleto ? promedioCompleto.descripcion : "";
    let texto = desdeElPartido;
    partesDeTareas.forEach((parte, t) => {
      if (!parte) return;
      texto += texto ? ` + ${parte}` : `${prefijo}_${parte}`;
      void t;
    });
    return texto.replace(/\s+/g, " ").trim();
  })();
  // La parte de cada uno en la descripción de su total: su partido (o el
  // banco) y cada tarea.
  const descripcionDelTotal = (p) => {
    const descripcionEn = (seccion) => salida.find((fila) => fila._persona === p && fila._seccion === seccion)?.datos?.descripcion;
    const delPartido = jugoElPartido(p) ? descripcionDelPartido(partido?.completo || {}, nombreDelPartido("TOTAL")) : p.banco ? descripcionEn("partido:banco") : "";
    const partes = [sinFecha(delPartido), ...tareas.map((tarea) => sinFecha(descripcionEn(`tarea:${tarea.id ?? tareas.indexOf(tarea)}`)))];
    while (partes.length < 11) partes.push("");
    return juntarPartes(`${fecha ? prefijo : ""} ${partes.join(" + ")}`);
  };

  // Los datos de la sesión (su encabezado en la plantilla): los m² por
  // jugador (la plantilla ponía la Base en la columna m2: corregido), la
  // relación pausa / trabajo con el total más largo y la cancha.
  const m2DeLaSesion = metrosPorJugador(sesion);
  const delEncabezadoDeLaSesion = Object.fromEntries(
    [
      ["m2", m2DeLaSesion],
      ["cp_tarea", pausaSobreTrabajo(sesion.pausa, [...totales.values()])],
      ["cp_jug", siHay(sesion.cpJug)],
      ["base", siHay(sesion.base)],
      ["largo", siHay(sesion.largo)],
      ["ancho", siHay(sesion.ancho)],
    ].filter(([, valor]) => valor !== null),
  );

  const hayPromedioFinal = (regenerativo && regenerativoCuenta) || (noEntrenaron.length && noEntrenoCuenta);
  // El promedio de la sesión (con el regenerativo o los que no entrenaron,
  // pasa a «Parcial» y el de la sesión es el de abajo).
  let promedioSesion = null;
  if (enLaSesion.length) {
    const queVan = enLaSesion.filter(vaDelTotal).map((p) => totales.get(p.quien.clave));
    const todos = enLaSesion.map((p) => totales.get(p.quien.clave));
    const datos = datosDeSesion({ descripcion: descripcionPromedioSesion, condicion: hayPromedioFinal ? PARCIAL : TOTAL, ...delEncabezadoDeLaSesion });
    grupos.medidas.forEach((columna) => {
      const prom = promedio(queVan, columna.clave);
      if (prom !== null) datos[columna.clave] = prom;
      const pm = porMinutoDe(queVan, columna.clave);
      if (pm !== null) datos[grupos.porMinuto[columna.clave]] = pm;
    });
    const tiempo = promedio(queVan, "tiempo");
    if (tiempo !== null) datos.tiempo = tiempo;
    [...grupos.maximos, ...grupos.sumas].forEach((columna) => {
      if (hayAlguno(todos, columna.clave)) datos[columna.clave] = promedio(queVan, columna.clave);
    });
    const inicio = minimo(todos, "inicio");
    const fin = maximo(todos, "fin");
    if (inicio !== null) datos.inicio = inicio;
    if (fin !== null) datos.fin = fin;
    grupos.ponderados.forEach((columna) => {
      datos[columna.clave] = ponderado(todos, columna.clave);
    });
    datos.clasificacion_dias = clasificacionDe(carga.dia, datos.inicio, reglas);
    if (datos.condicion === TOTAL && esNumero(datos.tiempo)) datos.min_campo = Math.round((datos.tiempo / MINUTOS) * 10) / 10;
    promedioSesion = agregar("sesion:promedio", { clave: hayPromedioFinal ? "promedio:parcial" : "promedio:sesion", promedio: hayPromedioFinal ? "parcial" : "sesion" }, datos);
  }
  const clasificacionDeLaSesion = promedioSesion?.datos?.clasificacion_dias ?? clasificacionDe(carga.dia, null, reglas);

  // Lo que se le pone a la fila que es el total de cada uno.
  const marcarTotal = (fila, tiempo) => {
    fila.datos.condicion = TOTAL;
    if (esNumero(tiempo)) fila.datos.min_campo = Math.round((tiempo / MINUTOS) * 10) / 10;
  };

  // El total de la sesión de cada uno (o su fila única, marcada).
  enLaSesion.forEach((p) => {
    const total = totales.get(p.quien.clave);
    const esElTotalDelDia = !conRegenerativo(p) && !conAdicional(p);
    const va = conRegenerativo(p) ? (combinadaCuenta ? null : SI) : vaDelTotal(p) ? SI : NO;
    const unica = representante.get(p.quien.clave);
    if (unica) {
      if (esElTotalDelDia) marcarTotal(unica, unica.datos.tiempo);
      else unica.datos.condicion = PARCIAL;
      if (va) unica.datos.va = va;
      unica._total = true;
      return;
    }
    const datos = { ...datosDeSesion({ descripcion: descripcionDelTotal(p), condicion: PARCIAL }), ...total };
    if (m2DeLaSesion !== null) datos.m2 = m2DeLaSesion;
    datos.clasificacion_dias = clasificacionDe(carga.dia, total.inicio, reglas);
    if (va) datos.va = va;
    const fila = agregar("sesion:total", p.quien, datos);
    fila._persona = p;
    fila._total = true;
    if (esElTotalDelDia) marcarTotal(fila, datos.tiempo);
  });
  // Las demás filas de la sesión de cada uno son parciales.
  salida.forEach((fila) => {
    if (fila._persona && !fila._total && !fila.datos.condicion) fila.datos.condicion = PARCIAL;
  });

  // Sesión + regenerativo: la sesión y el regenerativo juntos.
  const duracion = esNumero(regenerativo?.duracion) ? regenerativo.duracion : 0;
  const descripcionRegenerativo = `${prefijo}_Regenerativo ${cuantosRegenerativo} Jug`;
  enLaSesion.filter(conRegenerativo).forEach((p) => {
    const total = totales.get(p.quien.clave);
    const datos = { ...datosDeSesion(), ...total };
    datos.tiempo = (total.tiempo ?? 0) + duracion;
    conPorMinutos(datos, grupos, { cero: true });
    const delTotal = representante.get(p.quien.clave)?.datos?.descripcion ?? descripcionDelTotal(p);
    datos.descripcion = juntarPartes(`${prefijo} ${sinFecha(delTotal)} + ${sinFecha(descripcionRegenerativo)}`);
    datos.clasificacion_dias = clasificacionDe(carga.dia, total.inicio, reglas);
    datos.va = combinadaCuenta ? SI : NO;
    datos.condicion = PARCIAL;
    const fila = agregar("sesion:regenerativo", p.quien, datos);
    fila._persona = p;
    if (!conAdicional(p)) marcarTotal(fila, datos.tiempo);
  });

  // El regenerativo de cada uno: el tiempo del regenerativo, lo demás en 0.
  const ceros = () => {
    const datos = {};
    grupos.medidas.forEach((columna) => {
      datos[columna.clave] = 0;
      datos[grupos.porMinuto[columna.clave]] = 0;
    });
    return datos;
  };
  if (regenerativo)
    regenerativo.jugadores.forEach((quien) => {
      const p = personas.get(quien.clave);
      const datos = { ...datosDeSesion(), ...ceros(), tiempo: duracion, tipo_sesion: REGENERACION, descripcion: descripcionRegenerativo };
      delete datos.zona_impacto;
      datos.clasificacion_dias = clasificacionDeLaSesion;
      datos.va = regenerativoCuenta ? SI : NO;
      datos.condicion = PARCIAL;
      const fila = agregar("regenerativo", quien, datos);
      fila._persona = p;
      if (filasDeSesion(p) === 0 && !conAdicional(p)) marcarTotal(fila, duracion);
    });

  // Los que no entrenaron: todo en 0, con su motivo.
  noEntrenaron.forEach((uno) => {
    const datos = { ...datosDeSesion(), ...ceros(), tiempo: 0, descripcion: `${prefijo}_${uno.motivo || "No Entreno"}` };
    delete datos.zona_impacto;
    delete datos.tipo_sesion;
    if (uno.tipoSesion) datos.tipo_sesion = uno.tipoSesion;
    datos.clasificacion_dias = clasificacionDeLaSesion;
    datos.va = noEntrenoCuenta ? SI : NO;
    const fila = agregar("noEntreno", uno.quien, datos);
    fila._persona = personas.get(uno.quien.clave);
    marcarTotal(fila, 0);
  });

  // El promedio de la sesión con el regenerativo y los que no entrenaron:
  // el de todos los «Va».
  if (hayPromedioFinal && promedioSesion) {
    // Los totales que van (con lo de su total), la sesión + regenerativo, el
    // regenerativo y los que no entrenaron que van.
    const queVan = [
      ...enLaSesion.filter((p) => !conRegenerativo(p) && vaDelTotal(p)).map((p) => totales.get(p.quien.clave)),
      ...salida.filter((fila) => fila.datos.va === SI && ["sesion:regenerativo", "regenerativo", "noEntreno"].includes(fila._seccion)).map((fila) => fila.datos),
    ];
    const datos = datosDeSesion({
      descripcion: `${promedioSesion.datos.descripcion}+${regenerativo && regenerativoCuenta ? `Regenerativo ${cuantosRegenerativo} Jug` : ""}+${noEntrenaron.length && noEntrenoCuenta ? "No entrenó" : ""}`,
      condicion: TOTAL,
    });
    // Como la plantilla (su encabezado propio, sin zona de impacto).
    delete datos.zona_impacto;
    grupos.medidas.forEach((columna) => {
      const prom = promedio(queVan, columna.clave);
      if (prom !== null) datos[columna.clave] = prom;
      const pm = porMinutoDe(queVan, columna.clave);
      if (pm !== null) datos[grupos.porMinuto[columna.clave]] = pm;
    });
    const tiempo = promedio(queVan, "tiempo");
    if (tiempo !== null) datos.tiempo = tiempo;
    grupos.maximos.forEach((columna) => {
      if (!grupos.fueraDelTotal.has(columna.clave)) datos[columna.clave] = maximo(queVan, columna.clave);
    });
    if (esNumero(promedioSesion.datos.inicio)) datos.inicio = promedioSesion.datos.inicio;
    if (esNumero(promedioSesion.datos.fin)) datos.fin = promedioSesion.datos.fin;
    datos.clasificacion_dias = clasificacionDeLaSesion;
    agregar("sesion:final", { clave: "promedio:sesion", promedio: "sesion" }, datos);
  }

  // El adicional: una tarea aparte, después de la sesión.
  if (adicional) {
    const calculada = filasDeTarea(adicional, tareas.length, "adicional");
    void calculada;
    // El total con el adicional de cada uno: lo del día y el adicional, con la
    // pausa entre los dos.
    [...personas.values()].filter(conAdicional).forEach((p) => {
      const delAdicional = p.adicional.map((fila) => fila.valores);
      const filasDelDia = salida.filter((fila) => fila._persona === p && fila.datos.condicion !== undefined && fila._seccion !== "adicional");
      if (filasDeSesion(p) === 0 && !p.regenerativo && !p.noEntreno && delAdicional.length === 1) {
        const unica = salida.find((fila) => fila._persona === p && fila._seccion === "adicional");
        if (unica) {
          marcarTotal(unica, unica.datos.tiempo);
          unica.datos.va = NO;
        }
        return;
      }
      const delDiaTotal = conRegenerativo(p)
        ? salida.find((fila) => fila._persona === p && fila._seccion === "sesion:regenerativo")
        : representante.get(p.quien.clave) || salida.find((fila) => fila._persona === p && fila._seccion === "sesion:total") || salida.find((fila) => fila._persona === p && (fila._seccion === "regenerativo" || fila._seccion === "noEntreno"));
      const base = delDiaTotal?.datos || {};
      const datos = { ...datosDeSesion() };
      grupos.medidas.forEach((columna) => {
        datos[columna.clave] = (valor(base, columna.clave) ?? 0) + sumar(delAdicional, columna.clave);
      });
      const finDelDia = maximo(filasDelDia.map((fila) => fila.datos), "fin");
      const inicioAdicional = minimo(delAdicional, "inicio");
      const pausa = esNumero(finDelDia) && esNumero(inicioAdicional) ? Math.abs(inicioAdicional - finDelDia) : 0;
      datos.tiempo = (valor(base, "tiempo") ?? 0) + sumar(delAdicional, "tiempo") + pausa;
      conPorMinutos(datos, grupos);
      const parteAdicional = sinFecha(descripcionDeTarea(adicional));
      datos.descripcion = `${base.descripcion || ""} +  ${parteAdicional}`;
      datos.clasificacion_dias = salida.find((fila) => fila._seccion === "adicional" && fila.promedio)?.datos?.clasificacion_dias ?? clasificacionDe(carga.dia, inicioAdicional, reglas);
      datos.va = NO;
      if (delDiaTotal) delDiaTotal.datos.condicion = PARCIAL;
      const fila = agregar("adicional:total", p.quien, datos);
      fila._persona = p;
      marcarTotal(fila, datos.tiempo);
    });
    salida.forEach((fila) => {
      if (fila._seccion === "adicional" && fila._persona && !fila.datos.condicion) fila.datos.condicion = PARCIAL;
    });
  }

  const resultado = salida.map((fila) => {
    const { _persona, ...limpia } = fila; // eslint-disable-line no-unused-vars
    return limpia;
  });
  return {
    filas: resultado,
    microciclo,
    totales: enLaSesion.map((p) => ({ quien: p.quien, tiempo: valor(totales.get(p.quien.clave), "tiempo"), va: vaDelTotal(p) })),
  };
};
