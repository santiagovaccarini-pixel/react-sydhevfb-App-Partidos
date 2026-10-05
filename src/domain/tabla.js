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
// las que ya no existen. Una columna nueva va después de la que la precede
// en el orden de siempre (como "Actual" al lado del nombre); si no hay, al
// principio.
export const ordenDeColumnas = (claves, guardado) => {
  const existentes = new Set(claves);
  const orden = (Array.isArray(guardado) ? guardado : []).filter((clave) => existentes.has(clave));
  claves.forEach((clave, indice) => {
    if (orden.includes(clave)) return;
    const anterior = claves.slice(0, indice).reverse().find((otra) => orden.includes(otra));
    orden.splice(anterior === undefined ? 0 : orden.indexOf(anterior) + 1, 0, clave);
  });
  return orden;
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

// Una fecha ISO (yyyy-mm-dd) que existe de verdad: no un 30 de febrero ni un
// mes 13.
export const esFechaReal = (iso) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return false;
  const fecha = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === iso;
};

// Una fecha escrita a mano ("1/10/2026", "2026-10-01", "01-10-26") como ISO:
// día y mes, en ese orden. Si la fecha no existe, no se entiende.
export const interpretarFecha = (texto) => {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  let iso;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = iso ? null : t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3];
    iso = `${anio}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return iso && esFechaReal(iso) ? iso : undefined;
};

// Una fecha con hora ("1/10/2026 8:05", "02/10/2026, 06:30 p. m.",
// "2026-10-01T18:30") como la guarda un campo de fecha y hora; sin hora, las
// 00:00. La hora tiene que existir (no 25:99); "p. m." o "PM" suma 12.
export const interpretarFechaHora = (texto) => {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(.+?),?[ T](\d{1,2}):(\d{2})(?::\d{2}(?:[.,]\d+)?)?([\s\S]*)$/);
  const fecha = interpretarFecha(m ? m[1] : t);
  if (!fecha) return fecha;
  if (!m) return `${fecha}T00:00`;
  let hora = Number(m[2]);
  const minuto = Number(m[3]);
  // "a. m." / "p. m." justo después de la hora; con una hora de 0 o de 13 a
  // 23 sobra y no cambia nada.
  const meridiano = hora >= 1 && hora <= 12 ? (/^\s*([ap])\.?\s*m(?![a-z])/i.exec(m[4]) || [])[1]?.toLowerCase() : null;
  if (meridiano === "p" && hora < 12) hora += 12;
  if (meridiano === "a" && hora === 12) hora = 0;
  if (hora > 23 || minuto > 59) return undefined;
  return `${fecha}T${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
};

// Horas como las escribe el Excel ([h]:mm:ss): "30:14:20", "30:14" (o
// "1:5", que el Excel lee 1:05), o en número, "30,5" o "30". Devuelve las horas (30,24 para "30:14:20"), null
// si está vacío y undefined si no se entiende.
export const interpretarHoras = (texto) => {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const reloj = /^(\d{1,6}):([0-5]?\d)(?::([0-5]?\d))?$/.exec(t);
  if (reloj) return Number(reloj[1]) + Number(reloj[2]) / 60 + Number(reloj[3] || 0) / 3600;
  if (/^\d{1,6}([.,]\d+)?$/.test(t)) return Number(t.replace(",", "."));
  return undefined;
};

// Las horas para mostrar, como en el Excel: "30:14:20" (o "30:14" si no hay
// segundos). Vacío si no hay horas.
export const textoDeHoras = (horas) => {
  if (horas === null || horas === undefined || horas === "" || !Number.isFinite(Number(horas))) return "";
  const segundos = Math.round(Number(horas) * 3600);
  const dos = (numero) => String(numero).padStart(2, "0");
  const reloj = `${Math.floor(segundos / 3600)}:${dos(Math.floor((segundos % 3600) / 60))}`;
  return segundos % 60 ? `${reloj}:${dos(segundos % 60)}` : reloj;
};

// Un tiempo de minutos y segundos, como los del Excel de evaluaciones: "3:04"
// (o "3.04", "3,04" como sale del teclado numérico del celular, o "3:04:00"
// como lo copia Excel, que lo cree horas) son 184 segundos, y "45" son 45.
// Solo segundos, hasta dos cifras: "304" no se adivina (¿3:04 o 5:04?).
// Devuelve null si está vacío y undefined si no se entiende.
export const interpretarMinutos = (texto) => {
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const partes = /^(\d{1,3})[:.,](\d{2})(?::00)?$/.exec(t);
  if (partes) {
    const segundos = Number(partes[2]);
    return segundos < 60 ? Number(partes[1]) * 60 + segundos : undefined;
  }
  if (/^\d{1,2}$/.test(t)) return Number(t);
  return undefined;
};

// Los segundos como se escriben: 184 → "3:04".
export const textoDeMinutos = (segundos) =>
  typeof segundos === "number" && Number.isFinite(segundos) ? `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}` : "";

// Cómo se escribe una casilla marcada o vacía al pegar (en los dos idiomas,
// sin mayúsculas ni acentos). Lo copiado de la tabla es Sí/No (Sim/Não).
const TEXTOS_DE_CASILLA = {
  marcada: ["si", "sim", "s", "x", "1", "true", "verdadero", "verdadeiro", "✓", "✔"],
  vacia: ["no", "nao", "n", "0", "false", "falso"],
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
    case "horas":
      return interpretarHoras(t);
    case "tiempo":
      return interpretarMinutos(t);
    case "casilla": {
      // Una celda vacía no desmarca a nadie: se deja como está.
      const buscado = normalizarTextoBase(t);
      if (TEXTOS_DE_CASILLA.marcada.includes(buscado)) return true;
      if (TEXTOS_DE_CASILLA.vacia.includes(buscado)) return false;
      return undefined;
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

// Para ordenar: lo que la fila diga en `orden` para esa columna (si la
// pantalla lo da: el nombre en vez del id del jugador, la fecha en vez del
// texto); si no, el valor guardado si es un número o una fecha; si no, el
// texto que se ve.
const claveDeOrden = (fila, clave) => {
  const propio = Boolean(fila?.orden) && Object.prototype.hasOwnProperty.call(fila.orden, clave);
  const valor = propio ? fila.orden[clave] : fila?.valores?.[clave];
  if (typeof valor === "number" && Number.isFinite(valor)) return { tipo: "numero", valor };
  if (esFechaISO(valor)) return { tipo: "fecha", valor };
  const texto = propio ? String(valor ?? "").trim() : textoDeCelda(fila, clave);
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
