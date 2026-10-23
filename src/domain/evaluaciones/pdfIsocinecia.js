import { VELOCIDADES } from "./tests/isocinecia.js";

// Isocinecia desde el PDF del isocinético (Santiago, 09/10: «hicimos un lector
// en python que traia los datos, lo que se me ocurre es meter esa misma logica
// dentro del soft y cargar el pdf ahi»; 23/10, en un cuestionario: «Leer el
// PDF en Cargar», «Varios a la vez», la fecha «La del PDF» y «Una tarjeta por
// PDF» para revisar antes de guardar).
//
// El PDF es el «Comprehensive Evaluation» del equipo (rodilla, extensión y
// flexión, bilateral): una página por velocidad (60, 180 y 300 DEG/SEC), con
// letra Helvetica común y el texto de cada página comprimido en un solo
// bloque. Acá se lee sin bibliotecas: se descomprime cada bloque, se juntan
// los textos con su lugar en la página y, por fila, se toman los números de
// cada columna. El orden de las piernas cambia con la pierna marcada como
// lesionada («Involved»): se mira la fila RIGHT / LEFT de cada página.
//
// De cada página van Peak TQ/BW, Work/BW (WRK/BODYWEIGHT), AVG Power, Work
// Fatigue y ROM (uno por pierna: en el PDF es el mismo en extensión y en
// flexión); de la primera, el nombre (Name), la fecha (Session, mes/día/año)
// y el peso (Wt) como P.C.
//
// Cada medida se busca por el nombre de su fila en el PDF. El club lo puede
// cambiar en Ajustes, y también si se usa (Santiago, 23/10, en un
// cuestionario: «Nombre y si se usa»); si un nombre no aparece, se dice cuál y
// qué filas del PDF quedaron sin usar, para elegir en la tarjeta («Se elige en
// la tarjeta»).

// Las medidas de la app y el nombre de su fila en el PDF, de entrada.
export const MEDIDAS_PDF = Object.freeze([
  { clave: "peak", titulo: "Peak TQ/BW", enElPdf: "PEAK TQ/BW" },
  { clave: "work", titulo: "Work/BW", enElPdf: "WRK/BODYWEIGHT" },
  { clave: "avg", titulo: "Average Power", enElPdf: "AVG. POWER" },
  { clave: "wf", titulo: "Work Fatigue", enElPdf: "WORK FATIGUE" },
  { clave: "rom", titulo: "ROM", enElPdf: "ROM" },
]);
export const TEST_DEL_PDF = "isocinecia";
// En los Ajustes del club (evaluaciones_campos), como un campo más del test:
// «pdf.peak», con el nombre en la etiqueta y «oculto» si no se usa.
export const campoDelPdf = (medida) => `pdf.${medida}`;

// Cómo se lee cada medida: { peak: { nombre, usar }, … }, con lo del club
// encima de lo de entrada.
export const lecturaDeConfig = (config) =>
  Object.fromEntries(
    MEDIDAS_PDF.map(({ clave, enElPdf }) => {
      const propio = config?.campos?.[TEST_DEL_PDF]?.[campoDelPdf(clave)];
      const nombre = String(propio?.etiquetas?.["es-AR"] || propio?.etiquetas?.["pt-BR"] || "").trim();
      return [clave, { nombre: nombre || enElPdf, usar: !propio?.oculto }];
    }),
  );
export const LECTURA_DE_ENTRADA = lecturaDeConfig(null);

// Los nombres se comparan sin mayúsculas ni espacios de más.
const comoRotulo = (texto) => String(texto ?? "").replace(/\s+/g, " ").trim().toUpperCase();

// Cuánto puede correrse un texto de su fila (en puntos de la página).
const MISMA_FILA = 3;

// -------------------------------------------------- El PDF por dentro --

const bytesDe = (datos) => (datos instanceof Uint8Array ? datos : new Uint8Array(datos));
const comoTexto = (bytes) => {
  let texto = "";
  // De a pedazos: con todo junto, String.fromCharCode se queda sin lugar.
  for (let i = 0; i < bytes.length; i += 8192) texto += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return texto;
};

// Descomprimir un bloque (FlateDecode es zlib): con lo que trae el navegador.
export const inflarConElNavegador = async (bytes) => {
  if (typeof DecompressionStream !== "function") throw new Error("sin DecompressionStream");
  const flujo = new Response(bytes).body.pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
};

// Los bloques de texto del PDF (los comprimidos que no son imágenes), en el
// orden del archivo; cada página dice su velocidad, así que el orden no importa.
const bloquesDeTexto = async (bytes, inflar) => {
  const texto = comoTexto(bytes);
  const bloques = [];
  const inicio = /(\d+)\s+\d+\s+obj\s*<<([\s\S]*?)>>\s*stream\r?\n/g;
  let encontrado;
  while ((encontrado = inicio.exec(texto))) {
    const diccionario = encontrado[2];
    const desde = inicio.lastIndex;
    const hasta = texto.indexOf("endstream", desde);
    if (hasta < 0) break;
    inicio.lastIndex = hasta;
    if (!/\/FlateDecode/.test(diccionario) || /\/Subtype\s*\/Image/.test(diccionario)) continue;
    // El largo, escrito ahí o en otro objeto («/Length 12 0 R»). Sin él, hasta
    // «endstream» sin el salto de línea de antes (el navegador no acepta
    // nada de más después de lo comprimido).
    const directo = /\/Length\s+(\d+)\b(?!\s+\d+\s+R)/.exec(diccionario);
    const indirecto = /\/Length\s+(\d+)\s+(\d+)\s+R/.exec(diccionario);
    const enOtro = indirecto ? new RegExp(`(?:^|[^\\d])${indirecto[1]}\\s+${indirecto[2]}\\s+obj\\s*(\\d+)\\s*endobj`).exec(texto) : null;
    const largo = Number(directo?.[1] ?? enOtro?.[1]);
    let fin = hasta;
    while (fin > desde && (texto[fin - 1] === "\n" || texto[fin - 1] === "\r")) fin -= 1;
    if (Number.isFinite(largo) && largo > 0 && desde + largo <= hasta) fin = desde + largo;
    try {
      bloques.push(comoTexto(await inflar(bytes.subarray(desde, fin))));
    } catch {
      // Un bloque que no se descomprime (una fuente, por ejemplo) no es texto.
    }
  }
  return bloques;
};

// Las barras de los textos del PDF: las conocidas, en octal, el fin de línea
// (sigue en la otra) y cualquier otra, la letra sola.
const desescapar = (texto) =>
  texto.replace(/\\([0-7]{1,3}|[\s\S])/g, (_, codigo) => {
    const especiales = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "\n": "", "\r": "" };
    if (codigo in especiales) return especiales[codigo];
    return /^[0-7]+$/.test(codigo) ? String.fromCharCode(parseInt(codigo, 8)) : codigo;
  });

// Los textos de una página con su lugar: [{ x, y, texto }]. Cada BT … ET con
// su Tm (o Td) y lo que muestra (TJ o Tj); en TJ, un hueco grande es un espacio.
export const textosDeLaPagina = (contenido) => {
  const textos = [];
  const bloques = contenido.match(/BT[\s\S]*?ET/g) || [];
  bloques.forEach((bloque) => {
    let x = 0;
    let y = 0;
    let texto = "";
    const partes = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm|(-?[\d.]+)\s+(-?[\d.]+)\s+T[dD]|\[((?:\\.|[^\]\\])*)\]\s*TJ|\(((?:\\.|[^)\\])*)\)\s*(?:Tj|')/g;
    let parte;
    while ((parte = partes.exec(bloque))) {
      if (parte[1] !== undefined) {
        x = Number(parte[5]);
        y = Number(parte[6]);
      } else if (parte[7] !== undefined) {
        x += Number(parte[7]);
        y += Number(parte[8]);
      } else if (parte[9] !== undefined) {
        const piezas = /\(((?:\\.|[^)\\])*)\)|(-?[\d.]+)/g;
        let pieza;
        while ((pieza = piezas.exec(parte[9]))) {
          if (pieza[1] !== undefined) texto += desescapar(pieza[1]);
          else if (Math.abs(Number(pieza[2])) > 200) texto += " ";
        }
      } else if (parte[10] !== undefined) {
        texto += desescapar(parte[10]);
      }
    }
    if (texto.trim()) textos.push({ x, y, texto: texto.replace(/\s+/g, " ").trim() });
  });
  return textos;
};

// ------------------------------------------------- Cada página, leída --

const numero = (texto) => (/^-?\d+(\.\d+)?$/.test(texto) ? Number(texto) : null);
const enLaFila = (textos, y) => textos.filter((uno) => Math.abs(uno.y - y) <= MISMA_FILA);
// El valor de un rótulo («Wt:», «Session:»): lo primero a su derecha en la fila.
const alLadoDe = (textos, rotulo) => {
  const etiqueta = textos.find((uno) => uno.texto.replace(/\s/g, "").toLowerCase().startsWith(rotulo.toLowerCase()));
  if (!etiqueta) return "";
  const aLaDerecha = enLaFila(textos, etiqueta.y)
    .filter((uno) => uno.x > etiqueta.x && uno !== etiqueta)
    .sort((a, b) => a.x - b.x);
  const valor = aLaDerecha[0];
  // Si lo siguiente es otro rótulo, el campo está vacío.
  return valor && !/:$/.test(valor.texto) ? valor.texto : "";
};

// Una página: { grados, valores: { v60_peak_ext_pd: …, … }, nombre, sesion,
// peso, encontradas: [medidas], filas: [nombres de las filas con números] } o
// null si no es una página del informe.
export const leerPagina = (textos, lectura = LECTURA_DE_ENTRADA) => {
  const velocidad = textos.map((uno) => /^(\d+)\s*DEG\/SEC$/i.exec(uno.texto)).find(Boolean);
  const grados = velocidad ? Number(velocidad[1]) : null;
  const clave = VELOCIDADES.find((una) => una.grados === grados)?.clave;
  if (!clave) return null;
  // Las columnas: la fila RIGHT / LEFT (dos de extensión y dos de flexión) y
  // los DEFICIT (que no van).
  const piernas = textos.filter((uno) => /^(RIGHT|LEFT)$/.test(uno.texto)).sort((a, b) => a.x - b.x);
  if (piernas.length !== 4) return null;
  const columnas = [
    ...piernas.map((uno, indice) => ({ x: uno.x, movimiento: indice < 2 ? "ext" : "flex", pierna: uno.texto === "RIGHT" ? "pd" : "pi" })),
    ...textos.filter((uno) => uno.texto === "DEFICIT").map((uno) => ({ x: uno.x, deficit: true })),
  ];
  // Las filas de la tabla: lo de más a la izquierda de cada renglón con
  // números en las columnas.
  const desde = Math.min(...piernas.map((uno) => uno.x)) - 15;
  const conNumeros = (uno) => enLaFila(textos, uno.y).filter((otro) => otro.x >= desde && numero(otro.texto) !== null).length >= 2;
  const filas = textos
    .filter((uno) => uno.x < desde && numero(uno.texto) === null && /[A-Za-z]/.test(uno.texto) && conNumeros(uno))
    .filter((uno, _, todas) => !todas.some((otra) => otra !== uno && Math.abs(otra.y - uno.y) <= MISMA_FILA && otra.x < uno.x))
    .sort((a, b) => b.y - a.y)
    .map((uno) => uno.texto.trim());
  const valores = {};
  const encontradas = [];
  MEDIDAS_PDF.forEach(({ clave: medida }) => {
    const como = lectura[medida] || LECTURA_DE_ENTRADA[medida];
    if (!como.usar) return;
    const fila = textos.find((uno) => comoRotulo(uno.texto) === comoRotulo(como.nombre));
    if (!fila) return;
    encontradas.push(medida);
    enLaFila(textos, fila.y)
      .filter((uno) => uno.x > fila.x && numero(uno.texto) !== null)
      .forEach((uno) => {
        const columna = columnas.reduce((cerca, otra) => (Math.abs(otra.x - uno.x) < Math.abs(cerca.x - uno.x) ? otra : cerca));
        if (columna.deficit) return;
        const destino = medida === "rom" ? `${clave}_rom_${columna.pierna}` : `${clave}_${medida}_${columna.movimiento}_${columna.pierna}`;
        // ROM: el de extensión (el de flexión es el mismo).
        if (medida === "rom" && destino in valores) return;
        valores[destino] = numero(uno.texto);
      });
  });
  return { grados, valores, encontradas, filas, nombre: alLadoDe(textos, "Name:"), sesion: alLadoDe(textos, "Session:"), peso: alLadoDe(textos, "Wt:") };
};

// «7/22/2026 11:01:58 AM» → «2026-07-22».
export const fechaDeSesion = (texto) => {
  const partes = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(texto || "").trim());
  if (!partes) return null;
  const [, mes, dia, anio] = partes.map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
};

// Los textos de cada página del PDF (para leerlo, y para volver a leerlo si
// cambia cómo se lee una medida): { paginas: [[{ x, y, texto }]] } o { error }.
export const textosDelPdf = async (datos, { inflar = inflarConElNavegador } = {}) => {
  const bytes = bytesDe(datos);
  if (comoTexto(bytes.subarray(0, 5)) !== "%PDF-") return { error: "evaluaciones.pdf.noEsPdf" };
  try {
    return { paginas: (await bloquesDeTexto(bytes, inflar)).map(textosDeLaPagina) };
  } catch {
    return { error: "evaluaciones.pdf.noSeLeyo" };
  }
};

// Lo leído con una forma de leer cada medida: { nombre, fecha, datos: { pc,
// v60_…, … }, velocidades: [60, 180, 300], faltan: [grados que no vinieron],
// noEncontradas: [medidas que se usan y cuyo nombre no aparece], filasLibres:
// [las filas del PDF que no son de ninguna medida] } o { error } si no es el
// informe del isocinético.
export const leerPaginas = (paginasDelPdf = [], lectura = LECTURA_DE_ENTRADA) => {
  const paginas = paginasDelPdf.map((textos) => leerPagina(textos, lectura)).filter(Boolean);
  if (!paginas.length) return { error: "evaluaciones.pdf.noEsIsocinecia" };
  const primera = paginas[0];
  const peso = numero(String(primera.peso).replace(",", "."));
  const datosLeidos = { ...(peso !== null && peso > 0 ? { pc: peso } : {}) };
  paginas.forEach((pagina) => Object.assign(datosLeidos, pagina.valores));
  const velocidades = VELOCIDADES.map((una) => una.grados).filter((grados) => paginas.some((pagina) => pagina.grados === grados));
  const usadas = new Set(
    MEDIDAS_PDF.filter(({ clave }) => paginas.some((pagina) => pagina.encontradas.includes(clave))).map(({ clave }) => comoRotulo((lectura[clave] || LECTURA_DE_ENTRADA[clave]).nombre)),
  );
  const filasLibres = [];
  paginas.forEach((pagina) =>
    pagina.filas.forEach((fila) => {
      if (!usadas.has(comoRotulo(fila)) && !filasLibres.some((otra) => comoRotulo(otra) === comoRotulo(fila))) filasLibres.push(fila);
    }),
  );
  return {
    nombre: primera.nombre,
    fecha: fechaDeSesion(primera.sesion),
    datos: datosLeidos,
    velocidades,
    faltan: VELOCIDADES.map((una) => una.grados).filter((grados) => !velocidades.includes(grados)),
    noEncontradas: MEDIDAS_PDF.filter(({ clave }) => (lectura[clave] || LECTURA_DE_ENTRADA[clave]).usar && !paginas.some((pagina) => pagina.encontradas.includes(clave))).map(({ clave }) => clave),
    filasLibres,
  };
};

// El PDF entero, de una vez: lo de leerPaginas y sus textos (paginas).
export const leerPdfIsocinecia = async (datos, { inflar = inflarConElNavegador, lectura = LECTURA_DE_ENTRADA } = {}) => {
  const textos = await textosDelPdf(datos, { inflar });
  if (textos.error) return { error: textos.error };
  const leido = leerPaginas(textos.paginas, lectura);
  return leido.error ? leido : { ...leido, paginas: textos.paginas };
};
