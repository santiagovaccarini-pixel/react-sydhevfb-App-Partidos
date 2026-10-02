// La tabla estilo base de datos: lo que se calcula sin pantalla. Columnas que
// se reordenan, celdas que se copian como texto con tabulaciones (lo que
// Excel y Google Sheets entienden) y texto pegado que vuelve a ser valores.
import { normalizarTextoBase } from "./match";

// Mueve el elemento `desde` a la posición `hasta`.
export const reordenar = (lista, desde, hasta) => {
  const copia = [...lista];
  if (desde < 0 || desde >= copia.length || hasta < 0 || hasta >= copia.length || desde === hasta) return copia;
  const [movido] = copia.splice(desde, 1);
  copia.splice(hasta, 0, movido);
  return copia;
};

// El orden guardado para una tabla, completado con las columnas nuevas y sin
// las que ya no existen.
export const ordenDeColumnas = (claves, guardado) => {
  const existentes = new Set(claves);
  const primero = (Array.isArray(guardado) ? guardado : []).filter((clave) => existentes.has(clave));
  const faltan = claves.filter((clave) => !primero.includes(clave));
  return [...primero, ...faltan];
};

// Un rectángulo de celdas como texto: filas con salto de línea, celdas con
// tabulación. Un texto con tabulaciones o saltos va entre comillas.
const escaparCelda = (texto) => {
  const t = String(texto ?? "");
  return /[\t\n"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export const aTexto = (matriz) => matriz.map((fila) => fila.map(escaparCelda).join("\t")).join("\n");

// Lo inverso: el texto pegado (desde Excel, Sheets o esta misma tabla) como
// matriz de textos. Respeta las comillas de Excel.
export const desdeTexto = (texto) => {
  const limpio = String(texto ?? "").replace(/\r\n?/g, "\n").replace(/\n$/, "");
  if (!limpio) return [];
  const filas = [];
  let fila = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i];
    if (entreComillas) {
      if (ch === '"') {
        if (limpio[i + 1] === '"') {
          celda += '"';
          i++;
        } else entreComillas = false;
      } else celda += ch;
    } else if (ch === '"' && celda === "") {
      entreComillas = true;
    } else if (ch === "\t") {
      fila.push(celda);
      celda = "";
    } else if (ch === "\n") {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += ch;
  }
  fila.push(celda);
  filas.push(fila);
  return filas;
};

// Una fecha escrita a mano ("1/10/2026", "2026-10-01", "01-10-26") como ISO.
export const interpretarFecha = (texto) => {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${anio}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return undefined;
};

export const interpretarFechaHora = (texto) => {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(.+?)[ T](\d{1,2}):(\d{2})/);
  const fecha = interpretarFecha(m ? m[1] : t);
  if (!fecha) return fecha;
  const hora = m ? `${m[2].padStart(2, "0")}:${m[3]}` : "00:00";
  return `${fecha}T${hora}`;
};

// Un texto pegado en una celda, convertido al valor que guarda esa columna.
// Devuelve undefined cuando no se entiende (y la celda no se toca).
export const interpretarValor = (columna, texto) => {
  const t = String(texto ?? "").trim();
  switch (columna.tipo) {
    case "lista": {
      if (!t) return null;
      const buscado = normalizarTextoBase(t);
      const opcion = (columna.opciones || []).find(
        (una) => normalizarTextoBase(una.etiqueta) === buscado || normalizarTextoBase(una.valor) === buscado || (una.alias || []).some((a) => normalizarTextoBase(a) === buscado),
      );
      return opcion ? opcion.valor : undefined;
    }
    case "fecha":
      return interpretarFecha(t);
    case "fecha_hora":
      return interpretarFechaHora(t);
    case "numero": {
      if (!t) return null;
      const n = Number(t.replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    }
    case "texto":
    case "texto_largo":
      return t;
    default:
      return undefined;
  }
};

// Lo que se pega, aplicado desde la celda activa: una lista de cambios
// (fila, columna, valor) y cuántas celdas no se entendieron o no se podían
// tocar.
export const aplicarPegado = (matriz, { filas, columnas, filaInicial, columnaInicial }) => {
  const cambios = [];
  let ignoradas = 0;
  matriz.forEach((celdas, i) => {
    const fila = filas[filaInicial + i];
    if (!fila) {
      ignoradas += celdas.length;
      return;
    }
    celdas.forEach((texto, j) => {
      const columna = columnas[columnaInicial + j];
      if (!columna) {
        ignoradas++;
        return;
      }
      if (!columna.editable) {
        ignoradas++;
        return;
      }
      const valor = interpretarValor(columna, texto);
      if (valor === undefined) {
        ignoradas++;
        return;
      }
      cambios.push({ filaId: fila.id, clave: columna.clave, valor });
    });
  });
  return { cambios, ignoradas };
};

// ------------------------------------------------ Filtros y orden --
// Como el filtro de las cabeceras de Excel: cada columna filtrada deja pasar
// las filas cuyo texto está entre los elegidos. Las celdas vacías cuentan
// como un valor más ("").

const textoDeCelda = (fila, clave) => String(fila?.textos?.[clave] ?? "").trim();

// Los valores distintos de una columna, con cuántas filas tiene cada uno, en
// orden alfabético (las vacías al final).
export const valoresDeColumna = (filas, clave) => {
  const cuentas = new Map();
  filas.forEach((fila) => {
    const texto = textoDeCelda(fila, clave);
    cuentas.set(texto, (cuentas.get(texto) || 0) + 1);
  });
  return [...cuentas.entries()]
    .map(([texto, cantidad]) => ({ texto, cantidad }))
    .sort((a, b) => {
      if (!a.texto) return 1;
      if (!b.texto) return -1;
      return a.texto.localeCompare(b.texto, "es", { numeric: true, sensitivity: "base" });
    });
};

// filtros: { clave: [textos elegidos] }. Una columna sin entrada no filtra.
// `salvo` deja afuera una columna (para armar su propia lista de valores con
// lo que dejan pasar las demás, como Excel).
export const filtrarFilas = (filas, filtros = {}, { salvo = null } = {}) => {
  const activos = Object.entries(filtros).filter(([clave, elegidos]) => clave !== salvo && Array.isArray(elegidos));
  if (activos.length === 0) return filas;
  const conjuntos = activos.map(([clave, elegidos]) => [clave, new Set(elegidos)]);
  return filas.filter((fila) => conjuntos.every(([clave, elegidos]) => elegidos.has(textoDeCelda(fila, clave))));
};

const esFechaISO = (valor) => typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor);

// Para ordenar: el valor guardado si es un número o una fecha; si no, el texto.
const claveDeOrden = (fila, clave) => {
  const valor = fila?.valores?.[clave];
  if (typeof valor === "number" && Number.isFinite(valor)) return { tipo: "numero", valor };
  if (esFechaISO(valor)) return { tipo: "fecha", valor };
  const texto = textoDeCelda(fila, clave);
  return texto ? { tipo: "texto", valor: texto } : null;
};

// orden: { clave, sentido: "asc" | "desc" }. Las vacías siempre al final.
export const ordenarFilas = (filas, orden) => {
  if (!orden?.clave) return filas;
  const signo = orden.sentido === "desc" ? -1 : 1;
  return filas
    .map((fila, indice) => ({ fila, indice, clave: claveDeOrden(fila, orden.clave) }))
    .sort((a, b) => {
      if (!a.clave && !b.clave) return a.indice - b.indice;
      if (!a.clave) return 1;
      if (!b.clave) return -1;
      let comparacion;
      if (a.clave.tipo === "numero" && b.clave.tipo === "numero") comparacion = a.clave.valor - b.clave.valor;
      else if (a.clave.tipo === "fecha" && b.clave.tipo === "fecha") comparacion = a.clave.valor.localeCompare(b.clave.valor);
      else comparacion = String(a.clave.valor).localeCompare(String(b.clave.valor), "es", { numeric: true, sensitivity: "base" });
      return comparacion * signo || a.indice - b.indice;
    })
    .map(({ fila }) => fila);
};

// Las columnas en tramos de un mismo grupo seguido (la fila de arriba de las
// cabeceras). Si se mueve una columna a otro lado, su grupo se parte.
export const tramosDeGrupos = (columnas) => {
  const tramos = [];
  columnas.forEach((columna, indice) => {
    const grupo = columna.grupo || "";
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.grupo === grupo) {
      ultimo.cantidad += 1;
    } else {
      tramos.push({ grupo, titulo: columna.grupoTitulo || "", desde: indice, cantidad: 1 });
    }
  });
  return tramos;
};
