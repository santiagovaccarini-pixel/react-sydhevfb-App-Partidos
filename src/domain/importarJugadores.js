// Pegar jugadores desde el Excel (la hoja "Datos Básicos"): lo pegado se
// lee por las cabeceras, se convierte a los valores que guarda la app, se
// empareja con el plantel y queda armado lo que hay que crear o cambiar.
// Nada de esto toca la base: la pantalla muestra el plan y guarda.
import { normalizarTextoBase } from "./match";
import { desdeTexto, esFechaReal, interpretarFecha, interpretarHoras, interpretarValor, textoDeHoras } from "./tabla.js";

export const CAMPOS_IMPORTABLES = ["categoria", "fecha_nacimiento", "pie_dominante", "posicion", "foto_url", "horas_previas"];
export const NUEVO = "nuevo";
export const NO_CARGAR = "no_cargar";

// Una cabecera sin acentos, mayúsculas, puntos ni lo que va entre paréntesis:
// "D. Nac. (DD/MM/AAAA)" → "d nac".
export const normalizarCabecera = (texto) =>
  normalizarTextoBase(texto)
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Cómo puede venir escrita cada cabecera. Se suman los nombres que el club
// les haya puesto en la app (en los dos idiomas).
const CABECERAS = {
  nombre: ["nome e sobrenome", "nombre y apellido", "nome completo", "nombre completo", "nome", "nombre", "jogador", "jugador"],
  categoria: ["categoria"],
  fecha_nacimiento: ["d nac", "data de nascimento", "data nascimento", "nascimento", "fecha de nacimiento", "fecha nacimiento", "nacimiento", "f nac"],
  pie_dominante: ["p dominante", "pe dominante", "pie dominante"],
  posicion: ["posicao", "posicion", "puesto"],
  foto_url: ["links das fotos", "link das fotos", "link da foto", "links de las fotos", "fotos", "foto", "foto enlace", "foto link"],
  // En el Excel la columna A (las horas de entrenamiento de antes de que
  // llegara el cuerpo técnico) no tiene título: en su cabecera está el botón
  // "Voltar ao menu inicial".
  horas_previas: ["voltar ao menu inicial", "horas previas", "horas anteriores", "horas de entrenamiento previas", "horas de treino anteriores"],
};

// Hasta qué fila se busca la de las cabeceras (el Excel tiene títulos arriba).
const FILAS_PARA_BUSCAR_CABECERAS = 15;

const campoDeCabecera = (texto, alias) => {
  const buscado = normalizarCabecera(texto);
  if (!buscado) return null;
  const encontrado = Object.entries(alias).find(([, nombres]) => nombres.includes(buscado));
  return encontrado ? encontrado[0] : null;
};

// Lo pegado como filas: { columnas: { campo: índice }, filas: [{ indice,
// nombre, textos: { campo: texto } }], error }. El error es una clave del
// diccionario: sin la fila de cabeceras no se adivina qué es cada columna.
export const leerPegado = (texto, { alias = {} } = {}) => {
  const todos = Object.fromEntries(
    Object.entries(CABECERAS).map(([campo, nombres]) => [campo, [...nombres, ...(alias[campo] || []).map(normalizarCabecera).filter(Boolean)]]),
  );
  const matriz = desdeTexto(texto);
  // La fila de cabeceras es la que más cabeceras conocidas tiene (y una de
  // ellas es el nombre): un título como "JUGADOR" arriba no la tapa.
  let filaCabeceras = -1;
  let columnas = {};
  for (let f = 0; f < Math.min(matriz.length, FILAS_PARA_BUSCAR_CABECERAS); f++) {
    const encontradas = {};
    matriz[f].forEach((celda, c) => {
      const campo = campoDeCabecera(celda, todos);
      if (campo && !(campo in encontradas)) encontradas[campo] = c;
    });
    if ("nombre" in encontradas && Object.keys(encontradas).length > Object.keys(columnas).length) {
      filaCabeceras = f;
      columnas = encontradas;
    }
  }
  if (filaCabeceras === -1) return { columnas: {}, filas: [], error: "datos.importar.sinCabeceras" };

  const filas = [];
  matriz.slice(filaCabeceras + 1).forEach((celdas, i) => {
    const nombre = String(celdas[columnas.nombre] ?? "").replace(/\s+/g, " ").trim();
    // Filas vacías o la fila de cabeceras repetida (si se pegó dos veces).
    if (!nombre || campoDeCabecera(nombre, todos) === "nombre") return;
    const textos = {};
    CAMPOS_IMPORTABLES.forEach((campo) => {
      if (campo in columnas) textos[campo] = String(celdas[columnas[campo]] ?? "").trim();
    });
    filas.push({ indice: filaCabeceras + 1 + i, nombre, textos });
  });
  if (filas.length === 0) return { columnas, filas, error: "datos.importar.sinFilas" };
  return { columnas, filas, error: "" };
};

const DIA_MS = 86400000;
const CERO_DE_EXCEL = Date.UTC(1899, 11, 30);
const conAnios = (iso, anios) => `${String(Number(iso.slice(0, 4)) + anios).padStart(4, "0")}${iso.slice(4)}`;
const FECHA_CON_BARRAS = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;

// Cómo vienen las fechas de una columna: día/mes (lo del Excel, DD/MM/AAAA)
// o mes/día (un Excel en inglés). Se decide por la columna entera, no fila
// por fila: mes/día solo si alguna fecha no puede ser día/mes y ninguna
// obliga a leerla como día/mes.
export const formatoDeFechas = (textos = []) => {
  let soloDiaMes = false;
  let soloMesDia = false;
  textos.forEach((texto) => {
    const m = String(texto ?? "").trim().match(FECHA_CON_BARRAS);
    if (!m) return;
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a > 12 && b <= 12) soloDiaMes = true;
    if (b > 12 && a <= 12) soloMesDia = true;
  });
  return soloMesDia && !soloDiaMes ? "mes_dia" : "dia_mes";
};

// La fecha de nacimiento como viene del Excel: "25/07/1986", "1986-07-25",
// "25/07/86" o el número de serie de Excel (la celda sin formato de fecha).
// Tiene que existir, no ser futura ni de hace más de cien años; con el año
// en dos cifras se toma el siglo que no deja al jugador con menos de diez
// años. Devuelve undefined si no se entiende y null si está vacía.
export const fechaDeNacimiento = (texto, hoy, formato = "dia_mes") => {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const desde = conAnios(hoy, -100);
  const valida = (iso) => (esFechaReal(iso) && iso <= hoy && iso >= desde ? iso : undefined);
  if (/^\d+([.,]\d+)?$/.test(t)) {
    const serie = Math.floor(Number(t.replace(",", ".")));
    const serieDeHoy = Math.floor((Date.parse(`${hoy}T00:00:00Z`) - CERO_DE_EXCEL) / DIA_MS);
    if (!Number.isFinite(serie) || serie < 1 || serie > serieDeHoy) return undefined;
    return valida(new Date(CERO_DE_EXCEL + serie * DIA_MS).toISOString().slice(0, 10));
  }
  const m = t.match(FECHA_CON_BARRAS);
  if (m) {
    const [dia, mes] = formato === "mes_dia" ? [m[2], m[1]] : [m[1], m[2]];
    let iso = `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    if (m[3].length === 2 && esFechaReal(iso) && iso > conAnios(hoy, -10)) iso = conAnios(iso, -100);
    return valida(iso);
  }
  return valida(interpretarFecha(t));
};

const esEnlace = (texto) => /^https?:\/\/\S+$/i.test(texto);

// Una fila leída, con los valores que guarda la app. Lo que no se entiende
// no se toca y queda como aviso: { campo, valor }.
// listas: { campo: [{ valor, etiqueta, alias }] } (las opciones del club);
// formatoFecha: el de la columna entera (formatoDeFechas).
export const interpretarFila = (fila, { listas = {}, hoy, formatoFecha = "dia_mes" }) => {
  const datos = {};
  const avisos = [];
  Object.entries(fila.textos).forEach(([campo, texto]) => {
    if (!texto) return;
    let valor;
    if (campo === "fecha_nacimiento") valor = fechaDeNacimiento(texto, hoy, formatoFecha);
    else if (campo === "foto_url") valor = esEnlace(texto) ? texto : undefined;
    else if (campo === "horas_previas") valor = interpretarHoras(texto);
    else valor = interpretarValor({ tipo: "lista", opciones: listas[campo] || [] }, texto);
    if (valor === undefined || valor === null) avisos.push({ campo, valor: texto });
    else datos[campo] = valor;
  });
  return { datos, avisos };
};

// El nombre para comparar: sin acentos, mayúsculas ni signos.
const nombreParaComparar = (nombre) =>
  normalizarTextoBase(nombre)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const palabrasDe = (nombre) => nombreParaComparar(nombre).split(" ").filter((palabra) => palabra.length >= 3);
const contiene = (grandes, chicas) => chicas.length > 0 && chicas.every((palabra) => grandes.includes(palabra));

// Quién es cada fila en el plantel de la app: el mismo nombre ("igual"), un
// nombre que está entero adentro del otro, como "SCARPA" en "Gustavo
// Scarpa" ("parecido", si es el único posible), o nadie ("nuevo"). Un
// jugador de la app no queda para dos filas.
export const emparejar = (filas, plantel = []) => {
  const resultado = filas.map(() => ({ destino: NUEVO, como: "nuevo" }));
  const tomados = new Set();
  const vistos = new Map();
  filas.forEach((fila, i) => {
    const clave = nombreParaComparar(fila.nombre);
    // El mismo nombre dos veces en lo pegado: la segunda no se carga.
    if (vistos.has(clave)) {
      resultado[i] = { destino: NO_CARGAR, como: "repetido" };
      return;
    }
    vistos.set(clave, i);
    const igual = plantel.find((jugador) => nombreParaComparar(jugador.nombre) === clave && !tomados.has(String(jugador.id)));
    if (igual) {
      tomados.add(String(igual.id));
      resultado[i] = { destino: String(igual.id), como: "igual" };
    }
  });

  const candidatos = filas.map((fila, i) => {
    if (resultado[i].como !== "nuevo") return [];
    const suyas = palabrasDe(fila.nombre);
    return plantel.filter((jugador) => {
      if (tomados.has(String(jugador.id))) return false;
      const deLaApp = palabrasDe(jugador.nombre);
      return contiene(suyas, deLaApp) || contiene(deLaApp, suyas);
    });
  });
  // Un jugador de la app que le sirve a más de una fila es dudoso: no se sugiere.
  const cuantasVeces = new Map();
  candidatos.flat().forEach((jugador) => cuantasVeces.set(String(jugador.id), (cuantasVeces.get(String(jugador.id)) || 0) + 1));
  candidatos.forEach((lista, i) => {
    const unicos = lista.filter((jugador) => cuantasVeces.get(String(jugador.id)) === 1);
    if (lista.length === 1 && unicos.length === 1) resultado[i] = { destino: String(unicos[0].id), como: "parecido" };
  });
  return resultado;
};

// Qué cambia en un jugador de la app: los datos del Excel que no tiene o que
// tiene distintos. Lo que el Excel trae vacío no borra nada.
export const cambiosPara = (datos, jugador) =>
  Object.fromEntries(
    Object.entries(datos).filter(([campo, valor]) =>
      // Las horas se comparan como se ven (30:14:20): el número guardado puede
      // tener más decimales.
      campo === "horas_previas" ? textoDeHoras(jugador?.[campo]) !== textoDeHoras(valor) : String(jugador?.[campo] ?? "") !== String(valor),
    ),
  );
