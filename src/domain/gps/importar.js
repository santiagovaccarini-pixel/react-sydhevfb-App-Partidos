// Pegar desde Excel, en GPS › Base: la hoja BD_GPS con su fila de títulos
// (la 18, la de los filtros, o la 17). Se leen las columnas por su nombre; se
// busca a cada jugador (por su nombre en Catapult o en Datos básicos) y se
// compara con lo que ya está. Nada de esto toca la base: la pantalla muestra
// qué pasa y guarda. Se trae todo tal como está en el Excel (Santiago,
// 10/10): también los promedios del equipo, los totales y los "por minuto".
import { normalizarCabecera } from "../importarJugadores.js";
import { fechaDelExcel, formatoDeLasFechas } from "../importarLesiones.js";
import { COMO_PERSONA, DUDOSO, ESTADOS, LARGO_DEL_NOMBRE, NO_CARGAR, buscadorDeJugadores, nombreIgual } from "../importarPersonas.js";
import { desdeTexto } from "../tabla.js";
import { opcionesDeLista } from "../evaluaciones/ajustes.js";
import { leerNumero } from "../evaluaciones/importar.js";

export { COMO_PERSONA, ESTADOS, NO_CARGAR };

// Hasta qué fila se busca la de los títulos (arriba está el informe: 16 filas).
const FILAS_PARA_BUSCAR_CABECERAS = 25;

// Los errores del Excel, como los copia (en castellano, portugués o inglés).
const ERRORES_DEL_EXCEL = /^#(n\/?[ad]|¡?ref!?|div\/0!?|¡?valor!?|value!?|¿?nombre\??|name\??|¡?num!?|¡?nulo!?|null!?|calc!?|spill!?|¡?desbordamiento!?)$/i;

const SEGUNDOS_POR_DIA = 86400;

// Un texto de una lista como se compara al pegar: sin mayúsculas, acentos ni
// espacios de más ("Analitica" es "Analítica"). Los signos cuentan: en
// Clasificación Días, "-4_M" no es "4_M".
const textoDeOpcion = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// La opción de una lista de un texto pegado: por su código o por su nombre
// en cualquiera de los dos idiomas (el del Excel o el que le puso el club).
// undefined si no es ninguna.
const opcionDeLista = (lista, texto, config, gps) => {
  const buscado = textoDeOpcion(texto);
  if (!buscado) return null;
  const candidatas = ["es-AR", "pt-BR"].flatMap((idioma) => [config, null].flatMap((cual) => opcionesDeLista(lista, cual, idioma, { test: gps, conOcultas: true })));
  return candidatas.find((opcion) => textoDeOpcion(opcion.valor) === buscado || textoDeOpcion(opcion.etiqueta) === buscado)?.valor;
};

// El promedio del equipo, por cómo lo escribe la columna Nombre.
export const promedioDeNombre = (nombre) => {
  const texto = nombreIgual(nombre).normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (texto === "team average sesion") return "sesion";
  if (texto === "team average parcial" || texto === "team average") return "parcial";
  return null;
};

// Una hora o una duración como la copia el Excel: "0:48:57", "20:00:04",
// "8:00:04 p. m." o el número (la fracción del día, con la columna en
// formato Número). En segundos; null si está vacía, undefined si no se
// entiende.
export const leerSegundos = (texto) => {
  const limpio = String(texto ?? "").trim();
  if (!limpio) return null;
  const reloj = /^(\d{1,3}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*([ap])?\.?\s*(m\.?)?$/i.exec(limpio);
  if (reloj) {
    let horas = Number(reloj[1]);
    const minutos = Number(reloj[2]);
    const segundos = Number(reloj[3] || 0) + (reloj[4] ? Number(`0.${reloj[4]}`) : 0);
    if (minutos > 59 || segundos >= 60) return undefined;
    const marca = reloj[5]?.toLowerCase();
    if (marca) {
      if (horas < 1 || horas > 12) return undefined;
      if (marca === "a" && horas === 12) horas = 0;
      if (marca === "p" && horas !== 12) horas += 12;
    }
    return horas * 3600 + minutos * 60 + segundos;
  }
  const numero = leerNumero(limpio);
  if (numero === undefined || numero === null || numero < 0) return undefined;
  return numero * SEGUNDOS_POR_DIA;
};

// Los nombres con que se reconoce cada columna: los del Excel y los que les
// puso el club en Ajustes (en los dos idiomas).
const nombresDeColumnas = (columnas, titulos = {}) =>
  columnas.map((columna) => ({ columna, nombres: new Set([...(columna.pegar || []), ...(titulos[columna.clave] || [])].map(normalizarCabecera).filter(Boolean)) }));

// Lo pegado como filas: { columnas: { clave: índice }, filas: [{ indice,
// nombre, textos: { clave: texto } }], error }. La fila de títulos es la que
// tiene Nombre y Fecha y más títulos conocidos. columnas: las del GPS del
// club; titulos: { clave: [nombres del club] }.
export const leerGpsPegado = (texto, columnas, titulos = {}) => {
  const conocidas = nombresDeColumnas(columnas, titulos);
  const matriz = desdeTexto(texto);
  let filaCabeceras = -1;
  let encontradas = {};
  matriz.slice(0, FILAS_PARA_BUSCAR_CABECERAS).forEach((celdas, f) => {
    const deLaFila = {};
    celdas.forEach((celda, c) => {
      const buscada = normalizarCabecera(celda);
      if (!buscada) return;
      const suya = conocidas.find(({ columna, nombres }) => !(columna.clave in deLaFila) && nombres.has(buscada));
      if (suya) deLaFila[suya.columna.clave] = c;
    });
    if ("jugador" in deLaFila && "fecha" in deLaFila && Object.keys(deLaFila).length > Object.keys(encontradas).length) {
      filaCabeceras = f;
      encontradas = deLaFila;
    }
  });
  if (filaCabeceras === -1) return { columnas: {}, filas: [], error: "gps.importar.sinCabeceras" };
  const delNombre = conocidas.find(({ columna }) => columna.clave === "jugador").nombres;
  const filas = [];
  matriz.slice(filaCabeceras + 1).forEach((celdas, i) => {
    const nombre = String(celdas[encontradas.jugador] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    // Una fila de títulos repetida no es una fila de datos.
    if (nombre && delNombre.has(normalizarCabecera(nombre))) return;
    const textos = Object.fromEntries(Object.entries(encontradas).map(([clave, c]) => [clave, String(celdas[c] ?? "").trim()]));
    // Sin nombre y sin nada: una fila vacía de la planilla.
    if (!nombre && !Object.values(textos).some(Boolean)) return;
    filas.push({ indice: filaCabeceras + 1 + i, nombre, textos });
  });
  if (filas.length === 0) return { columnas: encontradas, filas, error: "gps.importar.sinFilas" };
  return { columnas: encontradas, filas, error: "" };
};

// Lo que guarda una fila, sin la fecha ni de quién: para saber si ya está.
// El dispositivo no cuenta (se elige al pegar).
const firmaDe = (fila) => {
  const { dispositivo, ...resto } = fila.datos || {}; // eslint-disable-line no-unused-vars
  const quien = fila.jugador_id ? `j:${fila.jugador_id}` : fila.promedio ? `p:${fila.promedio}` : `n:${nombreIgual(fila.persona)}`;
  const datos = Object.keys(resto)
    .sort()
    .map((clave) => [clave, resto[clave]]);
  return JSON.stringify([fila.fecha || null, quien, datos]);
};

// Quién es cada nombre del Excel: el jugador con ese nombre en Catapult (el
// vínculo de Datos básicos) y si no, el de ese nombre en Datos básicos.
// Devuelve el jugador, DUDOSO (se parece a dos) o null.
export const buscadorDelGps = (plantel) => {
  const porCatapult = new Map();
  plantel.forEach((jugador) => {
    const llave = nombreIgual(jugador.catapult_nombre);
    if (!llave) return;
    porCatapult.set(llave, porCatapult.has(llave) ? DUDOSO : jugador);
  });
  const porNombre = buscadorDeJugadores(plantel);
  return (nombre) => porCatapult.get(nombreIgual(nombre)) || porNombre(nombre);
};

// El plan: cada fila con { ...fila, jugador, promedio, fila: { fecha,
// jugador_id, persona, promedio, datos }, estado, problemas, avisos,
// destino, dudoso, fueraDeDatos }. columnas: las del GPS del club; plantel:
// los jugadores (con catapult_nombre); existentes: las filas que ya están en
// esas fechas; hoy: ISO; elegidos: { nombre normalizado: destino } (lo que
// se eligió para un nombre vale para todas sus filas); config: los Ajustes
// (las listas del club); gps: el GPS del club (sus listas); dispositivo: el
// código elegido para todas (o null).
export const planDelGps = (filas, { columnas, plantel = [], existentes = [], hoy, elegidos = {}, config = null, gps = null, dispositivo = null }) => {
  const jugadorDe = buscadorDelGps(plantel);
  const formato = formatoDeLasFechas(filas.map((fila) => fila.textos.fecha));
  const yaEstan = new Set(existentes.map(firmaDe));
  // La opción de cada texto de una lista, una vez por texto (son miles de filas).
  const opciones = new Map();
  const opcionDe = (lista, texto) => {
    const llave = `${lista}\u0000${texto}`;
    if (!opciones.has(llave)) opciones.set(llave, opcionDeLista(lista, texto, config, gps));
    return opciones.get(llave);
  };
  const porClave = Object.fromEntries(columnas.map((columna) => [columna.clave, columna]));

  return filas.map((fila) => {
    const problemas = [];
    const avisos = [];
    const promedio = promedioDeNombre(fila.nombre);
    const llave = nombreIgual(fila.nombre);
    const encontrado = promedio ? null : jugadorDe(fila.nombre);
    const destino = promedio ? null : (elegidos[llave] ?? null);
    const elegido = destino && destino !== COMO_PERSONA && destino !== NO_CARGAR ? plantel.find((uno) => String(uno.id) === String(destino)) || null : null;
    const jugador = elegido || (destino ? null : encontrado === DUDOSO ? null : encontrado);
    const comoPersona = !promedio && !jugador && destino === COMO_PERSONA;

    const fecha = fechaDelExcel(fila.textos.fecha, formato);
    const datos = {};
    Object.entries(fila.textos).forEach(([clave, texto]) => {
      const columna = porClave[clave];
      if (!columna || !texto || ["jugador", "fecha"].includes(clave)) return;
      if (ERRORES_DEL_EXCEL.test(texto)) {
        avisos.push({ campo: clave, valor: texto });
        return;
      }
      if (["numero", "porMinuto"].includes(columna.tipo)) {
        const numero = leerNumero(texto);
        if (numero === undefined || numero === null) avisos.push({ campo: clave, valor: texto });
        else datos[clave] = numero;
      } else if (["tiempo", "hora"].includes(columna.tipo)) {
        const segundos = leerSegundos(texto);
        if (segundos === undefined || segundos === null) avisos.push({ campo: clave, valor: texto });
        else datos[clave] = segundos;
      } else if (columna.tipo === "lista") {
        // Una opción que no está en la lista se guarda como vino (se ve igual
        // y se puede sumar en Ajustes): se trae todo como estaba.
        const codigo = opcionDe(columna.lista, texto);
        datos[clave] = codigo || texto;
      } else {
        datos[clave] = texto;
      }
    });
    if (dispositivo) datos.dispositivo = dispositivo;

    const nueva = {
      fecha: fecha || null,
      jugador_id: jugador ? jugador.id : null,
      persona: promedio || jugador ? null : fila.nombre,
      promedio,
      datos,
    };
    const plan = { ...fila, jugador, promedio, fila: nueva, problemas, avisos, destino, dudoso: encontrado === DUDOSO, fueraDeDatos: !promedio && !jugador };

    if (!fila.nombre) return { ...plan, fueraDeDatos: false, problemas: ["gps.importar.sinNombre"], estado: ESTADOS.conProblemas };
    if (fecha && yaEstan.has(firmaDe(nueva))) return { ...plan, estado: ESTADOS.yaEsta };
    if (destino === NO_CARGAR) return { ...plan, estado: ESTADOS.noVa };
    if (!promedio && !jugador && !comoPersona) return { ...plan, estado: ESTADOS.sinJugador };

    if (fecha === null) problemas.push("gps.importar.sinFecha");
    else if (fecha === undefined) problemas.push("gps.importar.fechaMal");
    else if (fecha > hoy) problemas.push("gps.importar.fechaFutura");
    if (comoPersona && fila.nombre.length > LARGO_DEL_NOMBRE) problemas.push("gps.importar.nombreLargo");
    if (problemas.length) return { ...plan, estado: ESTADOS.conProblemas };
    // Dos filas iguales en lo pegado (la misma persona, el mismo día y los
    // mismos valores) se cargan las dos, como están en el Excel.
    return { ...plan, estado: ESTADOS.nueva };
  });
};

// Las que se cargan, en el orden del Excel.
export const ordenDeCarga = (plan) => plan.filter((fila) => fila.estado === ESTADOS.nueva).sort((a, b) => a.indice - b.indice);

// Los nombres que no están en Datos básicos y falta elegir qué son, uno por
// nombre: [{ llave, nombre, filas, dudoso }].
export const nombresSinElegir = (plan) => {
  const porNombre = new Map();
  plan
    .filter((fila) => fila.estado === ESTADOS.sinJugador)
    .forEach((fila) => {
      const llave = nombreIgual(fila.nombre);
      if (!porNombre.has(llave)) porNombre.set(llave, { llave, nombre: fila.nombre, filas: 0, dudoso: fila.dudoso });
      porNombre.get(llave).filas += 1;
    });
  return [...porNombre.values()].sort((a, b) => b.filas - a.filas || a.nombre.localeCompare(b.nombre));
};
