// Un archivo de Excel (.xlsx) armado acá, sin bibliotecas: un .zip sin
// comprimir con las partes mínimas del formato (el libro, sus hojas y los
// estilos: la primera fila en negrita y fija al bajar). Lo usa la
// exportación de los datos de un atleta (exportarAtleta.js).
//
// hojas: [{ nombre, filas: [[celda, …], …] }]. Una celda es un texto, un
// número o vacía (null / undefined / ""). Los textos van como texto: lo que
// empieza con "=" no se vuelve fórmula.

const codificar = (texto) => new TextEncoder().encode(texto);

// Lo que el XML no acepta: los caracteres de control (menos tab y saltos).
const SIN_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const xml = (texto) =>
  String(texto)
    .replace(SIN_CONTROL, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// La columna de Excel de un índice: 0 → A, 26 → AA.
export const letraDeColumna = (indice) => {
  let letra = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  return letra;
};

// El nombre de una hoja: hasta 31 letras, sin \ / ? * [ ] :, y sin repetir.
export const nombresDeHojas = (nombres) => {
  const usados = new Set();
  return nombres.map((nombre, i) => {
    const base = String(nombre || `Hoja ${i + 1}`).replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || `Hoja ${i + 1}`;
    let elegido = base;
    for (let n = 2; usados.has(elegido.toLowerCase()); n += 1) elegido = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
    usados.add(elegido.toLowerCase());
    return elegido;
  });
};

const celdaXml = (valor, referencia, negrita) => {
  if (valor === null || valor === undefined || valor === "") return "";
  const estilo = negrita ? ' s="1"' : "";
  if (typeof valor === "number" && Number.isFinite(valor)) return `<c r="${referencia}"${estilo}><v>${valor}</v></c>`;
  return `<c r="${referencia}"${estilo} t="inlineStr"><is><t xml:space="preserve">${xml(valor)}</t></is></c>`;
};

// El ancho de cada columna, por lo más largo que tiene (entre 8 y 60).
const anchos = (filas) => {
  const maximo = [];
  filas.forEach((fila) =>
    fila.forEach((valor, i) => {
      const largo = valor === null || valor === undefined ? 0 : String(valor).length;
      maximo[i] = Math.max(maximo[i] || 0, largo);
    }),
  );
  return maximo.map((largo) => Math.min(60, Math.max(8, largo + 2)));
};

const hojaXml = (filas) => {
  const columnas = anchos(filas);
  const cols = columnas.length
    ? `<cols>${columnas.map((ancho, i) => `<col min="${i + 1}" max="${i + 1}" width="${ancho}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const vista =
    filas.length > 1
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const datos = filas
    .map((fila, f) => `<row r="${f + 1}">${fila.map((valor, c) => celdaXml(valor, `${letraDeColumna(c)}${f + 1}`, f === 0)).join("")}</row>`)
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `${vista}${cols}<sheetData>${datos}</sheetData></worksheet>`
  );
};

const ESTILOS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

const partesDelLibro = (hojas) => {
  const nombres = nombresDeHojas(hojas.map((hoja) => hoja.nombre));
  const partes = [
    [
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
        "</Types>",
    ],
    [
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    ],
    [
      "xl/workbook.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets>${nombres.map((nombre, i) => `<sheet name="${xml(nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
        "</workbook>",
    ],
    [
      "xl/_rels/workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        "</Relationships>",
    ],
    ["xl/styles.xml", ESTILOS],
    ...hojas.map((hoja, i) => [`xl/worksheets/sheet${i + 1}.xml`, hojaXml(hoja.filas || [])]),
  ];
  return partes.map(([nombre, texto]) => ({ nombre, datos: codificar(texto) }));
};

// ------------------------------------------------- El .zip, sin comprimir --

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

export const crc32 = (datos) => {
  let crc = 0xffffffff;
  for (let i = 0; i < datos.length; i += 1) crc = TABLA_CRC[(crc ^ datos[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

// Un .zip con los archivos tal cual (método 0). La fecha va fija (1/1/1980):
// el mismo contenido da el mismo archivo.
export const armarZip = (archivos) => {
  const locales = [];
  const centrales = [];
  let desplazamiento = 0;
  archivos.forEach(({ nombre, datos }) => {
    const nombreBytes = codificar(nombre);
    const crc = crc32(datos);
    const local = new Uint8Array(30 + nombreBytes.length);
    const vista = new DataView(local.buffer);
    vista.setUint32(0, 0x04034b50, true);
    vista.setUint16(4, 20, true);
    vista.setUint16(6, 0x0800, true); // nombres en UTF-8
    vista.setUint16(8, 0, true);
    vista.setUint16(10, 0, true);
    vista.setUint16(12, 0x21, true);
    vista.setUint32(14, crc, true);
    vista.setUint32(18, datos.length, true);
    vista.setUint32(22, datos.length, true);
    vista.setUint16(26, nombreBytes.length, true);
    vista.setUint16(28, 0, true);
    local.set(nombreBytes, 30);
    const central = new Uint8Array(46 + nombreBytes.length);
    const vc = new DataView(central.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(4, 20, true);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint16(10, 0, true);
    vc.setUint16(12, 0, true);
    vc.setUint16(14, 0x21, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, datos.length, true);
    vc.setUint32(24, datos.length, true);
    vc.setUint16(28, nombreBytes.length, true);
    vc.setUint32(42, desplazamiento, true);
    central.set(nombreBytes, 46);
    locales.push(local, datos);
    centrales.push(central);
    desplazamiento += local.length + datos.length;
  });
  const tamanoCentral = centrales.reduce((suma, parte) => suma + parte.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, archivos.length, true);
  vf.setUint16(10, archivos.length, true);
  vf.setUint32(12, tamanoCentral, true);
  vf.setUint32(16, desplazamiento, true);
  const total = new Uint8Array(desplazamiento + tamanoCentral + fin.length);
  let donde = 0;
  [...locales, ...centrales, fin].forEach((parte) => {
    total.set(parte, donde);
    donde += parte.length;
  });
  return total;
};

export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// El libro entero, listo para descargar (Uint8Array).
export const crearXlsx = (hojas) => armarZip(partesDelLibro(hojas.length ? hojas : [{ nombre: "Hoja 1", filas: [] }]));
