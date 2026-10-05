// El idioma de la app. Un diccionario por idioma (es-AR es el de referencia),
// una función t('clave') que devuelve el texto en el idioma activo, y un hook
// para que las pantallas se vuelvan a dibujar cuando cambia. El idioma vive
// en el celular (localStorage): sirve sin señal y antes de entrar.
import { useSyncExternalStore } from "react";
import esAR from "./es-AR.js";
import ptBR from "./pt-BR.js";

export const IDIOMAS = [
  { codigo: "es-AR", nombre: "Español" },
  { codigo: "pt-BR", nombre: "Português" },
];
export const IDIOMA_POR_DEFECTO = "es-AR";
export const CLAVE_IDIOMA = "idioma";

const diccionarios = { "es-AR": esAR, "pt-BR": ptBR };

// "pt", "pt-BR", "pt-PT" → pt-BR; "es", "es-AR", "es-ES" → es-AR; otro → nada.
export const normalizarIdioma = (valor) => {
  const texto = String(valor || "").toLowerCase();
  if (texto.startsWith("pt")) return "pt-BR";
  if (texto.startsWith("es")) return "es-AR";
  return null;
};

export const detectarIdioma = () => {
  try {
    const guardado = localStorage.getItem(CLAVE_IDIOMA);
    if (guardado && diccionarios[guardado]) return guardado;
  } catch {
    // Sin localStorage (navegación privada): se detecta por el navegador.
  }
  const delNavegador =
    typeof navigator !== "undefined" ? normalizarIdioma(navigator.language) : null;
  return delNavegador || IDIOMA_POR_DEFECTO;
};

// El idioma de la página (<html lang>): lo usan el lector de pantalla y el
// corrector del teclado. Se pone al abrir, no solo al cambiarlo.
const ponerIdiomaDeLaPagina = (idioma) => {
  if (typeof document !== "undefined" && document.documentElement) document.documentElement.lang = idioma;
};

let actual = detectarIdioma();
ponerIdiomaDeLaPagina(actual);
const oyentes = new Set();
const avisar = () => oyentes.forEach((oyente) => oyente());

export const idiomaActual = () => actual;

export const cambiarIdioma = (idioma) => {
  if (!diccionarios[idioma] || idioma === actual) return;
  actual = idioma;
  try {
    localStorage.setItem(CLAVE_IDIOMA, idioma);
  } catch {
    // Queda para esta sesión igual.
  }
  ponerIdiomaDeLaPagina(idioma);
  avisar();
};

const buscar = (diccionario, clave) =>
  String(clave)
    .split(".")
    .reduce((nodo, parte) => (nodo && typeof nodo === "object" ? nodo[parte] : undefined), diccionario);

const rellenar = (texto, variables) =>
  texto.replace(/\{\{(\w+)\}\}/g, (_, nombre) => (variables[nombre] ?? ""));

// El texto de una clave en el idioma activo. Si falta en ese idioma, el de
// es-AR; si tampoco está, `porDefecto` o la clave misma (así se nota).
export const t = (clave, variables = {}, porDefecto) => {
  let texto = buscar(diccionarios[actual], clave);
  if (typeof texto !== "string") texto = buscar(esAR, clave);
  if (typeof texto !== "string") return porDefecto ?? clave;
  return rellenar(texto, variables);
};

// Plural según el idioma: claves `x_one` y `x_other`. El cero va con
// `_other` en los dos idiomas ("0 lesões ativas", "0 linhas"): para el
// portugués de Intl el 0 es "one".
export const plural = (clave, cantidad, variables = {}) => {
  const regla = cantidad === 0 ? "other" : new Intl.PluralRules(actual).select(cantidad);
  const conRegla = buscar(diccionarios[actual], `${clave}_${regla}`);
  const texto =
    typeof conRegla === "string"
      ? conRegla
      : buscar(diccionarios[actual], `${clave}_other`) ?? buscar(esAR, `${clave}_other`) ?? clave;
  return rellenar(String(texto), { n: cantidad, ...variables });
};

const suscribir = (oyente) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

// Para las pantallas: se vuelven a dibujar al cambiar el idioma.
export const useIdioma = () => {
  const idioma = useSyncExternalStore(suscribir, idiomaActual, idiomaActual);
  return { idioma, t, plural, cambiarIdioma, idiomas: IDIOMAS };
};

// Solo para pruebas: fija el idioma sin tocar el celular.
export const fijarIdiomaParaPruebas = (idioma) => {
  actual = diccionarios[idioma] ? idioma : IDIOMA_POR_DEFECTO;
  avisar();
};

export const claves = (diccionario = esAR, prefijo = "") =>
  Object.entries(diccionario).flatMap(([clave, valor]) =>
    typeof valor === "object" && valor !== null
      ? claves(valor, `${prefijo}${clave}.`)
      : [`${prefijo}${clave}`],
  );

export const DICCIONARIOS = diccionarios;
