// Pegar jugadores desde el Excel (la hoja "Datos Básicos"): lo pegado se
// lee por las cabeceras, se convierte a los valores que guarda la app, se
// empareja con el plantel y queda armado lo que hay que crear o cambiar.
// Nada de esto toca la base: la pantalla muestra el plan y guarda.
import { normalizarTextoBase } from "./match";
import { desdeTexto, interpretarFecha, interpretarValor } from "./tabla.js";

export const CAMPOS_IMPORTABLES = ["categoria", "fecha_nacimiento", "pie_dominante", "posicion", "foto_url"];
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
  let filaCabeceras = -1;
  let columnas = {};
  for (let f = 0; f < Math.min(matriz.length, FILAS_PARA_BUSCAR_CABECERAS); f++) {
    const encontradas = {};
    matriz[f].forEach((celda, c) => {
      const campo = campoDeCabecera(celda, todos);
      if (campo && !(campo in encontradas)) encontradas[campo] = c;
    });
    if ("nombre" in encontradas) {
      filaCabeceras = f;
      columnas = encontradas;
      break;
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

const esFechaReal = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return false;
  const fecha = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === iso;
};

const restarSiglo = (iso) => `${Number(iso.slice(0, 4)) - 100}${iso.slice(4)}`;

// La fecha de nacimiento como viene del Excel: "25/07/1986", "1986-07-25",
// "25/07/86" (del siglo pasado si no, sería futura) o el número de serie de
// Excel cuando la celda no tiene formato de fecha. Devuelve undefined si no
// se entiende y null si está vacía.
export const fechaDeNacimiento = (texto, hoy) => {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  if (/^\d+([.,]\d+)?$/.test(t)) {
    const serie = Math.floor(Number(t.replace(",", ".")));
    // Entre 1910 y hoy, en días desde el 30/12/1899 (como cuenta Excel).
    if (serie < 3653) return undefined;
    const iso = new Date(Date.UTC(1899, 11, 30) + serie * 86400000).toISOString().slice(0, 10);
    return iso <= hoy ? iso : undefined;
  }
  let iso = interpretarFecha(t);
  if (iso && /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2}$/.test(t) && iso > hoy) iso = restarSiglo(iso);
  if (!esFechaReal(iso)) {
    // Un Excel en inglés escribe mes/día: si día/mes no existe, se prueba así.
    const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!m) return undefined;
    iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    if (!esFechaReal(iso)) return undefined;
  }
  return iso <= hoy ? iso : undefined;
};

const esEnlace = (texto) => /^https?:\/\/\S+$/i.test(texto);

// Una fila leída, con los valores que guarda la app. Lo que no se entiende
// no se toca y queda como aviso: { campo, valor }.
// listas: { campo: [{ valor, etiqueta, alias }] } (las opciones del club).
export const interpretarFila = (fila, { listas = {}, hoy }) => {
  const datos = {};
  const avisos = [];
  Object.entries(fila.textos).forEach(([campo, texto]) => {
    if (!texto) return;
    let valor;
    if (campo === "fecha_nacimiento") valor = fechaDeNacimiento(texto, hoy);
    else if (campo === "foto_url") valor = esEnlace(texto) ? texto : undefined;
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
  Object.fromEntries(Object.entries(datos).filter(([campo, valor]) => String(jugador?.[campo] ?? "") !== String(valor)));
