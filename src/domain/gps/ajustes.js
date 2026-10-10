import { armarConfig, configVacia } from "../evaluaciones/ajustes.js";
import { COLUMNAS_GPS, GPS } from "./columnas.js";

// GPS › Ajustes: el nombre de cada columna, si se ve, las columnas que suma
// el club y las opciones de cada lista (migración 20261016_gps.sql), con las
// mismas reglas que Evaluaciones › Ajustes (domain/evaluaciones/ajustes.js):
// una fila solo para lo que el club cambió o sumó. Santiago (10/10): «tiene
// que poder añadirse columna como quitarlas, las que yo quiera sin
// problema». Quitar es esconder: lo cargado no se pierde.

// Los tipos de una columna que suma el club (los mismos que acepta la base).
export const TIPOS_PROPIOS = Object.freeze(["numero", "texto", "tiempo", "hora"]);

// Lo que vino de la base: la config de Evaluaciones (con GPS como su único
// test) y las columnas propias del club, en su orden.
export const armarConfigGps = (filasCampos = [], filasOpciones = []) => {
  const config = armarConfig(
    filasCampos.map((fila) => ({ ...fila, test: GPS.id })),
    filasOpciones,
  );
  const deLaApp = new Set(COLUMNAS_GPS.map((columna) => columna.clave));
  config.propias = filasCampos
    .filter((fila) => fila.tipo && TIPOS_PROPIOS.includes(fila.tipo) && !deLaApp.has(fila.campo))
    .map((fila) => ({
      clave: fila.campo,
      titulo: { "es-AR": fila.etiqueta_es || fila.etiqueta_pt || fila.campo, "pt-BR": fila.etiqueta_pt || fila.etiqueta_es || fila.campo },
      tipo: fila.tipo,
      formato: "General",
      pegar: [fila.etiqueta_es, fila.etiqueta_pt].filter(Boolean),
      propia: true,
      orden: fila.orden ?? 0,
    }))
    .sort((a, b) => a.orden - b.orden || a.clave.localeCompare(b.clave));
  return config;
};

export const configGpsVacia = () => ({ ...configVacia(), propias: [] });

// GPS con las columnas del club: las del Excel y, al final, las que sumó.
export const gpsDelClub = (config) => (config?.propias?.length ? { ...GPS, columnas: [...COLUMNAS_GPS, ...config.propias] } : GPS);

// La clave de una columna nueva del club: "propia_" y su nombre, sin repetir.
export const claveDeColumnaPropia = (nombre, usadas = []) => {
  const base = `propia_${
    String(nombre || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50) || "columna"
  }`;
  const ocupadas = new Set(usadas);
  if (!ocupadas.has(base)) return base;
  for (let n = 2; ; n += 1) if (!ocupadas.has(`${base}_${n}`)) return `${base}_${n}`;
};
