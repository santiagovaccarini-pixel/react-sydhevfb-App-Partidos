// Pegar las lesiones del Excel (la hoja "Antecedentes BD"): lo pegado se lee
// por las cabeceras, se convierte a lo que guarda la app (códigos de las
// listas, fechas ISO), se busca a cada jugador en el plantel y se compara con
// las lesiones que ya están. Nada de esto toca la base: la pantalla muestra
// qué pasa con cada fila y guarda.
//
// Solo se traen las columnas que en el Excel se cargan a mano. Lo que el
// Excel calcula (N° de registro, edad, recuperación, severidad, recurrencia,
// recidiva, diagnóstico…) o trae del jugador (categoría, nacimiento, pie,
// posición) lo pone la app, con las mismas cuentas.
import { normalizarTextoBase } from "./match";
import { normalizarCabecera } from "./importarJugadores.js";
import { erroresDeLesion } from "./lesiones.js";
import { CAMPOS, OPCIONES, campoOculto, etiquetaDeCampo, etiquetaDeOpcion, opcionesDeCampo } from "./lesionesCampos.js";
import { desdeTexto, esFechaReal, interpretarFechaHora, interpretarValor } from "./tabla.js";

const TIPOS_QUE_SE_TRAEN = ["auto", "jugador", "lista", "fecha", "fecha_hora", "texto", "texto_largo"];
export const CAMPOS_QUE_SE_TRAEN = CAMPOS.filter((campo) => TIPOS_QUE_SE_TRAEN.includes(campo.tipo)).map((campo) => campo.clave);
const FECHAS = CAMPOS.filter((campo) => campo.tipo === "fecha").map((campo) => campo.clave);
const LISTAS = CAMPOS.filter((campo) => campo.tipo === "lista").map((campo) => campo.clave);

// Otros nombres con los que aparecen las cabeceras en el Excel (la fila del
// filtro, debajo de la de los títulos, dice algunas distinto).
const CABECERAS_EXTRA = {
  numero_caso: ["n de caso", "no de caso", "nro de caso", "numero de caso"],
  parte_cuerpo: ["parte do corpo ferida"],
  lado: ["side"],
  hora_imagen: ["hora da foto"],
  fecha_transicion: ["passagem para o readaptacao"],
};

// Valores que en el Excel se escribieron a mano, fuera de sus listas, y a
// qué opción van (lo decidió Santiago el 03/10/2026). Por ahora están acá;
// más adelante pasan a la configuración del club, junto con las listas.
export const EQUIVALENCIAS_DEL_EXCEL = {
  tipo_lesion: { "RUPTURA DE TENDÃO": "tendinea", TENDINOPATIA: "tendinea", "LACERAÇÃO/ ABRASÃO": "laceracao", "LACERAÇÃO/ABRASÃO": "laceracao" },
  parte_cuerpo: { PE: "pe_dedo" },
};

// Hasta qué fila se busca la de las cabeceras (el Excel tiene títulos arriba).
const FILAS_PARA_BUSCAR_CABECERAS = 15;

const DIA_MS = 86400000;
const CERO_DE_EXCEL = Date.UTC(1899, 11, 30);
const ULTIMA_SERIE = 2958465;
const FECHA_CON_BARRAS = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;
const SERIE = /^\d+([.,]\d+)?$/;
// La hora que el Excel pone después de la fecha en las columnas con hora.
const HORA_AL_FINAL = /[ ,T]+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?\s*m\.?)?$/i;

// El día de un número de serie del Excel (una celda sin formato de fecha).
const diaDeSerie = (serie) => new Date(CERO_DE_EXCEL + Math.floor(serie) * DIA_MS).toISOString().slice(0, 10);

// Cómo vienen las fechas de lo pegado: día/mes (lo del Excel en castellano
// o portugués) o mes/día (un Excel en inglés). Como en Datos básicos
// (formatoDeFechas), se decide con todas juntas, porque el Excel de quien
// copia las escribe todas igual (una columna con pocas fechas sola no
// alcanza para saberlo); pero si unas obligan a leer día/mes y otras
// mes/día, gana la mayoría: en Antecedentes BD hay fechas escritas como
// texto (día/mes) entre las de verdad.
export const formatoDeLasFechas = (textos = []) => {
  let diaMes = 0;
  let mesDia = 0;
  textos.forEach((texto) => {
    const m = String(texto ?? "")
      .trim()
      .replace(HORA_AL_FINAL, "")
      .match(FECHA_CON_BARRAS);
    if (!m) return;
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a > 12 && b <= 12) diaMes += 1;
    if (b > 12 && a <= 12) mesDia += 1;
  });
  return mesDia > diaMes ? "mes_dia" : "dia_mes";
};

// Una fecha del Excel: "21/01/2026", "21/01/2026 00:00" (las columnas con
// hora), "2026-01-21" o el número de serie. formato: el de todas las fechas
// (formatoDeLasFechas); una fecha que así no existe y al revés sí (la
// escrita como texto en otro orden) se lee al revés. Devuelve la fecha ISO,
// null si está vacía o undefined si no se entiende.
export const fechaDelExcel = (texto, formato = "dia_mes") => {
  const t = String(texto ?? "")
    .trim()
    .replace(HORA_AL_FINAL, "");
  if (!t) return null;
  if (SERIE.test(t)) {
    const serie = Number(t.replace(",", "."));
    return serie >= 1 && serie <= ULTIMA_SERIE ? diaDeSerie(serie) : undefined;
  }
  const m = t.match(FECHA_CON_BARRAS);
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = (dia, mes) => `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    const [comoVa, alReves] = formato === "mes_dia" ? [iso(m[2], m[1]), iso(m[1], m[2])] : [iso(m[1], m[2]), iso(m[2], m[1])];
    if (esFechaReal(comoVa)) return comoVa;
    return esFechaReal(alReves) ? alReves : undefined;
  }
  return esFechaReal(t) ? t : undefined;
};

// Una fecha con hora del Excel ("21/01/2026 18:30", o el número de serie con
// la hora en los decimales), como la guarda un campo de fecha y hora.
export const fechaHoraDelExcel = (texto, formato = "dia_mes") => {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  if (SERIE.test(t)) {
    const serie = Number(t.replace(",", "."));
    if (serie < 1 || serie > ULTIMA_SERIE) return undefined;
    const minutos = Math.round((serie - Math.floor(serie)) * 24 * 60);
    if (minutos >= 24 * 60) return `${diaDeSerie(serie + 1)}T00:00`;
    return `${diaDeSerie(serie)}T${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
  }
  // interpretarFechaHora lee día/mes: con las fechas en mes/día, se da
  // vuelta antes; y como en fechaDelExcel, si así no existe, al revés.
  const dadaVuelta = t.replace(/^(\d{1,2})([/.-])(\d{1,2})(?=[/.-])/, "$3$2$1");
  const [comoVa, alReves] = formato === "mes_dia" ? [dadaVuelta, t] : [t, dadaVuelta];
  const leida = interpretarFechaHora(comoVa);
  return leida === undefined ? interpretarFechaHora(alReves) : leida;
};

const campoDeCabecera = (texto, alias) => {
  const buscado = normalizarCabecera(texto);
  if (!buscado) return null;
  const encontrado = Object.entries(alias).find(([, nombres]) => nombres.includes(buscado));
  return encontrado ? encontrado[0] : null;
};

// Los nombres de cada cabecera: los del Excel (en los dos idiomas), los que
// el club les puso en la app y los de CABECERAS_EXTRA.
const aliasDeCabeceras = (config) =>
  Object.fromEntries(
    CAMPOS_QUE_SE_TRAEN.map((clave) => {
      const campo = CAMPOS.find((uno) => uno.clave === clave);
      const nombres = [
        ...Object.values(campo.etiquetas),
        etiquetaDeCampo(clave, config, "es-AR"),
        etiquetaDeCampo(clave, config, "pt-BR"),
        ...(CABECERAS_EXTRA[clave] || []),
      ];
      return [clave, [...new Set(nombres.map(normalizarCabecera).filter(Boolean))]];
    }),
  );

const cabecerasDeLaFila = (celdas, alias) => {
  const encontradas = {};
  celdas.forEach((celda, c) => {
    const campo = campoDeCabecera(celda, alias);
    if (campo && !(campo in encontradas)) encontradas[campo] = c;
  });
  return encontradas;
};

// Lo pegado como filas: { columnas: { campo: índice }, filas: [{ indice,
// nombre, textos: { campo: texto } }], error }. La fila de cabeceras es la
// que más cabeceras conocidas tiene (y una es la del jugador). El Excel
// tiene dos filas de cabeceras (los títulos y la del filtro): lo que una no
// reconoce se busca en la otra, y la de abajo no se lee como una lesión.
export const leerLesionesPegadas = (texto, { config = null } = {}) => {
  const alias = aliasDeCabeceras(config);
  const matriz = desdeTexto(texto);
  const encontradas = matriz.slice(0, FILAS_PARA_BUSCAR_CABECERAS).map((celdas) => cabecerasDeLaFila(celdas, alias));
  let filaCabeceras = -1;
  encontradas.forEach((una, f) => {
    if ("jugador" in una && (filaCabeceras === -1 || Object.keys(una).length > Object.keys(encontradas[filaCabeceras]).length)) filaCabeceras = f;
  });
  if (filaCabeceras === -1) return { columnas: {}, filas: [], error: "lesiones.importar.sinCabeceras" };
  const columnas = { ...encontradas[filaCabeceras] };
  [filaCabeceras - 1, filaCabeceras + 1].forEach((f) => {
    const otra = encontradas[f];
    if (!otra || !("jugador" in otra)) return;
    const usadas = new Set(Object.values(columnas));
    Object.entries(otra).forEach(([campo, c]) => {
      if (!(campo in columnas) && !usadas.has(c)) columnas[campo] = c;
    });
  });

  const filas = [];
  matriz.slice(filaCabeceras + 1).forEach((celdas, i) => {
    const nombre = String(celdas[columnas.jugador] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    // Filas vacías o una fila de cabeceras (la del filtro, o si se pegó dos veces).
    if (!nombre || campoDeCabecera(nombre, alias) === "jugador") return;
    const textos = Object.fromEntries(Object.entries(columnas).map(([campo, c]) => [campo, String(celdas[c] ?? "").trim()]));
    filas.push({ indice: filaCabeceras + 1 + i, nombre, textos });
  });
  if (filas.length === 0) return { columnas, filas, error: "lesiones.importar.sinFilas" };
  return { columnas, filas, error: "" };
};

// Cómo se lee el valor de cada lista, de a pasos, para que lo más propio
// gane: primero las opciones del club con su texto de hoy (en los dos
// idiomas; el Excel escribe en portugués), después el texto original del
// Excel de cada opción (si el club la renombró) y al final las
// equivalencias del Excel. Las escondidas también valen: lo cargado antes no
// se pierde. { campo: [opciones de cada paso] }.
export const listasParaImportar = (config) =>
  Object.fromEntries(
    LISTAS.map((campo) => {
      const delClub = opcionesDeCampo(campo, config, "es-AR", { conOcultas: true }).map((opcion) => ({
        ...opcion,
        alias: [etiquetaDeOpcion(campo, opcion.valor, config, "pt-BR")],
      }));
      const codigos = new Set(delClub.map((opcion) => opcion.valor));
      const delExcel = (OPCIONES[campo] || [])
        .filter((opcion) => codigos.has(opcion.codigo))
        .map((opcion) => ({ valor: opcion.codigo, etiqueta: opcion.etiquetas["pt-BR"], alias: [opcion.etiquetas["es-AR"]] }));
      const equivalencias = Object.entries(EQUIVALENCIAS_DEL_EXCEL[campo] || {})
        .filter(([, codigo]) => codigos.has(codigo))
        .map(([texto, codigo]) => ({ valor: codigo, etiqueta: texto }));
      return [campo, [delClub, delExcel, equivalencias]];
    }),
  );

const valorDeLista = (pasos, texto) => {
  for (const opciones of pasos) {
    const valor = interpretarValor({ tipo: "lista", opciones }, texto);
    if (valor !== undefined && valor !== null) return valor;
  }
  return undefined;
};

// Quién es cada nombre en el plantel: el mismo nombre (sin mayúsculas ni
// espacios de más, como lo distingue la base) y si no hay, el mismo sin
// acentos ni signos. Si dos jugadores dan lo mismo, no se adivina: DUDOSO.
const DUDOSO = "dudoso";
const nombreIgual = (nombre) =>
  String(nombre ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const nombreParecido = (nombre) =>
  normalizarTextoBase(nombre)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const buscadorDeJugadores = (plantel) => {
  const indice = (clave) => {
    const mapa = new Map();
    plantel.forEach((jugador) => {
      const llave = clave(jugador.nombre);
      mapa.set(llave, mapa.has(llave) ? DUDOSO : jugador);
    });
    return mapa;
  };
  const iguales = indice(nombreIgual);
  const parecidos = indice(nombreParecido);
  return (nombre) => iguales.get(nombreIgual(nombre)) || parecidos.get(nombreParecido(nombre)) || null;
};

// La misma lesión: mismo jugador, parte del cuerpo, lado y fecha de inicio
// (la regla de la base, lesiones_sin_repetir).
const esLaMisma = (una, otra) =>
  String(una.jugador_id) === String(otra.jugador_id) &&
  una.fecha_lesion === otra.fecha_lesion &&
  (una.datos?.parte_cuerpo ?? null) === (otra.datos?.parte_cuerpo ?? null) &&
  (una.datos?.lado ?? null) === (otra.datos?.lado ?? null);

// Qué pasa con cada fila.
export const ESTADOS = {
  // Se carga.
  nueva: "nueva",
  // Ya está en la app: no se toca.
  yaEsta: "yaEsta",
  // Sin fecha de inicio: no se carga (en el Excel son casos sin terminar).
  sinFecha: "sinFecha",
  // Algo impide cargarla: `problemas` dice qué.
  conProblemas: "conProblemas",
};

// El plan: cada fila con { ...fila, numeroCaso, jugador, lesion, estado,
// problemas: [clave del diccionario], avisos: [{ campo, valor }] }. Los
// avisos son valores que no se entendieron: esa columna queda vacía, pero la
// lesión se carga igual (si no es una de las obligatorias).
// plantel: los jugadores de la app; lesiones: las que ya están; config: la
// del club (leerConfig); hoy: ISO.
export const planDeImportacion = (filas, { plantel = [], lesiones = [], config = null, hoy }) => {
  const jugadorDe = buscadorDeJugadores(plantel);
  const listas = listasParaImportar(config);
  // Todas las fechas se leen igual (día/mes o mes/día).
  const formato = formatoDeLasFechas(filas.flatMap((fila) => [...FECHAS, "hora_imagen"].map((clave) => fila.textos[clave])));
  // Las fechas se revisan aunque el club haya escondido la columna: la base
  // las revisa igual (fechas en orden y no futuras).
  const oculto = (clave) => !FECHAS.includes(clave) && campoOculto(clave, config);
  // Las que no traen N° de caso van después del más alto de todo lo pegado
  // (también de los casos que no se cargan, para no quitarles el número) y
  // de los de la app.
  let siguienteCaso =
    Math.max(
      0,
      ...lesiones.map((otra) => Number(otra.numero_caso) || 0),
      ...filas.map((fila) => (/^\d+$/.test(fila.textos.numero_caso || "") ? Number(fila.textos.numero_caso) : 0)),
    ) + 1;
  const aCargar = [];
  const casosDeLoPegado = new Set();

  return filas.map((fila) => {
    const problemas = [];
    const avisos = [];
    const encontrado = jugadorDe(fila.nombre);
    const jugador = encontrado === DUDOSO ? null : encontrado;
    const textoCaso = fila.textos.numero_caso || "";
    const numeroCaso = /^\d+$/.test(textoCaso) && Number(textoCaso) > 0 ? Number(textoCaso) : null;
    if (textoCaso && numeroCaso === null) avisos.push({ campo: "numero_caso", valor: textoCaso });

    const lesion = {
      id: null,
      jugador_id: jugador ? jugador.id : null,
      numero_caso: numeroCaso,
      fecha_lesion: null,
      fecha_transicion: null,
      fecha_retorno_entrenamiento: null,
      fecha_alta: null,
      datos: {},
    };
    Object.entries(fila.textos).forEach(([campo, texto]) => {
      if (!texto || campo === "jugador" || campo === "numero_caso") return;
      let valor;
      if (FECHAS.includes(campo)) valor = fechaDelExcel(texto, formato);
      else if (campo === "hora_imagen") valor = fechaHoraDelExcel(texto, formato);
      else if (LISTAS.includes(campo)) valor = valorDeLista(listas[campo], texto);
      else valor = texto;
      if (valor === undefined || valor === null) avisos.push({ campo, valor: texto });
      else if (FECHAS.includes(campo)) lesion[campo] = valor;
      else lesion.datos[campo] = valor;
    });
    const plan = { ...fila, numeroCaso, jugador, lesion, problemas, avisos };

    if (!fila.textos.fecha_lesion) return { ...plan, estado: ESTADOS.sinFecha };
    if (!jugador) return { ...plan, estado: ESTADOS.conProblemas, problemas: [encontrado === DUDOSO ? "lesiones.importar.jugadorDudoso" : "lesiones.importar.sinJugador"] };
    if (lesion.fecha_lesion && lesiones.some((otra) => esLaMisma(otra, lesion))) return { ...plan, estado: ESTADOS.yaEsta };

    if (numeroCaso !== null) {
      if (lesiones.some((otra) => Number(otra.numero_caso) === numeroCaso)) problemas.push("lesiones.importar.casoOcupado");
      else if (casosDeLoPegado.has(numeroCaso)) problemas.push("lesiones.importar.casoRepetido");
      casosDeLoPegado.add(numeroCaso);
    }
    // Lo mismo que se revisa al cargar una a mano (fechas, tipo, parte, lado,
    // la misma lesión dos veces), contra las de la app y las de más arriba.
    erroresDeLesion(lesion, { hoy, otras: [...lesiones, ...aCargar], oculto }).forEach((uno) => problemas.includes(uno.error) || problemas.push(uno.error));
    if (problemas.length) return { ...plan, estado: ESTADOS.conProblemas };
    if (numeroCaso === null) lesion.numero_caso = siguienteCaso++;
    aCargar.push({ ...lesion, id: `pegada-${fila.indice}` });
    return { ...plan, estado: ESTADOS.nueva };
  });
};

// Las que se cargan, en orden: por N° de caso (así el N° de registro de cada
// jugador queda como en el Excel), y las que no traen número, al final.
export const ordenDeCarga = (plan) =>
  plan
    .filter((fila) => fila.estado === ESTADOS.nueva)
    .sort(
      (a, b) =>
        (a.numeroCaso ?? Infinity) - (b.numeroCaso ?? Infinity) ||
        String(a.lesion.fecha_lesion).localeCompare(String(b.lesion.fecha_lesion)) ||
        a.indice - b.indice,
    );
