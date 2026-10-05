// Fechas en el idioma activo. Es el único lugar que llama a Intl para las
// pantallas nuevas; Partido y Flujo diario siguen con lo suyo por ahora.
import { idiomaActual } from "./index.js";

const aFecha = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  const texto = String(valor);
  // "2026-10-01" se lee como fecha local, no UTC, para no restar un día.
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? new Date(`${texto}T00:00:00`) : new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

// Una lista en palabras, en el idioma activo: "a, b y c" ("a, b e c").
export const enLista = (textos) => {
  const lista = (textos || []).filter(Boolean);
  try {
    return new Intl.ListFormat(idiomaActual(), { style: "long", type: "conjunction" }).format(lista);
  } catch {
    return lista.join(", ");
  }
};

export const fechaCorta = (valor) => {
  const fecha = aFecha(valor);
  if (!fecha) return "";
  return new Intl.DateTimeFormat(idiomaActual(), { day: "2-digit", month: "2-digit", year: "numeric" }).format(fecha);
};

export const fechaLarga = (valor) => {
  const fecha = aFecha(valor);
  if (!fecha) return "";
  return new Intl.DateTimeFormat(idiomaActual(), { weekday: "long", day: "numeric", month: "long" }).format(fecha);
};

export const fechaYHora = (valor) => {
  const fecha = aFecha(valor);
  if (!fecha) return "";
  return new Intl.DateTimeFormat(idiomaActual(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
};

// Hoy en formato ISO local (yyyy-mm-dd), que es lo que guardan los campos de fecha.
export const hoyISO = (ahora = new Date()) =>
  [ahora.getFullYear(), String(ahora.getMonth() + 1).padStart(2, "0"), String(ahora.getDate()).padStart(2, "0")].join("-");
