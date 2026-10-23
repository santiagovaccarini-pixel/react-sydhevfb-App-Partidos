import { deflateSync } from "node:zlib";

// Solo para las pruebas: un PDF como el del isocinético («Comprehensive
// Evaluation», una página por velocidad), con datos inventados. Cada número
// dice de dónde sale: centenas la velocidad (1 = 60°, 2 = 180°, 3 = 300°),
// decenas la medida (1 Peak TQ/BW, 2 Work/BW, 3 AVG Power, 4 Work Fatigue,
// 5 ROM), unidades la columna (1 extensión derecha, 2 extensión izquierda,
// 3 flexión derecha, 4 flexión izquierda) y un decimal para que no sean
// redondos: 60° Peak TQ/BW extensión izquierda es 112.5.

const MEDIDAS = [
  ["PEAK TORQUE", 0],
  ["PEAK TQ/BW", 1],
  ["TIME TO PK TQ", 0],
  ["WRK/BODYWEIGHT", 2],
  ["WORK FATIGUE", 4],
  ["AVG. POWER", 3],
  ["ROM", 5],
];
const X_COLUMNAS = [250.7, 289.4, 366.7, 405.5];
const X_DEFICIT = [328.9, 448.3];

export const valorDePrueba = (indiceVelocidad, medida, columna) => Number(`${indiceVelocidad + 1}${medida}${columna + 1}.5`);

const escapar = (texto) => texto.replace(/([()\\])/g, "\\$1");
// Como lo escribe el PDF de verdad: el texto en pedazos con huecos (TJ).
const texto = (x, y, contenido) => {
  const pedazos = contenido.match(/.{1,3}/g) || [""];
  const tj = pedazos.map((pedazo) => `(${escapar(pedazo)})`).join("-2.5");
  return `q\n8.33333 0 0 8.33333 0 0 cm BT\n/R8 7.92 Tf\n0.999409 0 0 1 ${x} ${y} Tm\n[${tj}]TJ\nET\nQ\n`;
};

const pagina = ({ grados, indiceVelocidad, nombre, sesion, peso, involucrada, rotulos }) => {
  // Con la izquierda como lesionada, la derecha va primero; con la derecha,
  // al revés (como el PDF: «UNINVOL» primero).
  const orden = involucrada === "Right" ? ["LEFT", "RIGHT"] : ["RIGHT", "LEFT"];
  let contenido = texto(196.1, 793.8, "Comprehensive Evaluation");
  contenido += texto(29.6, 775.9, "Name:  ") + texto(89.2, 775.6, nombre) + texto(190.3, 775.9, "Session:  ") + texto(255.7, 775.6, sesion) + texto(386.6, 775.9, "Windowing: ");
  contenido += texto(29.6, 759.1, "ID: ") + texto(190.3, 759.1, "Involved:  ") + texto(255.7, 758.8, involucrada);
  contenido += texto(29.6, 708.6, "Wt: ") + texto(89.2, 708.3, peso) + texto(190.3, 708.6, "Joint:  ") + texto(255.7, 708.3, "Knee");
  contenido += texto(256.7, 664.6, "EXTENSION") + texto(378.5, 664.6, "FLEXION");
  contenido += texto(256.2, 652.0, `${grados} DEG/SEC`) + texto(372.2, 652.0, `${grados} DEG/SEC`);
  contenido += texto(327.6, 637.3, "DEFICIT") + texto(443.6, 637.3, "DEFICIT");
  contenido += [252.2, 292.4, 368.3, 408.5].map((x, indice) => texto(x, 618.3, orden[indice % 2])).join("");
  MEDIDAS.forEach(([rotulo, medida], fila) => {
    const y = 598.9 - fila * 18.9;
    contenido += texto(140, y, rotulos[rotulo] ?? rotulo) + texto(221.5, y, "%");
    X_COLUMNAS.forEach((x, columna) => {
      // La columna del PDF (por el orden de las piernas) a la de la prueba.
      const pierna = orden[columna % 2] === "RIGHT" ? 0 : 1;
      const deLaPrueba = (columna < 2 ? 0 : 2) + pierna;
      // ROM: el mismo en extensión y en flexión, por pierna.
      const valor = medida === 5 ? valorDePrueba(indiceVelocidad, 5, pierna) : medida ? valorDePrueba(indiceVelocidad, medida, deLaPrueba) : 99.9;
      contenido += texto(x, y - 0.4, valor.toFixed(1));
    });
    if (medida === 3) X_DEFICIT.forEach((x) => (contenido += texto(x, y - 0.4, "-12.1")));
  });
  return contenido;
};

// El PDF entero. velocidades: cuáles van (de entrada, las tres); rotulos:
// otro nombre para alguna fila ({ "WRK/BODYWEIGHT": "WORK/BW" }), como si el
// equipo lo cambiara.
export const pdfDePrueba = ({ nombre = "Jugador de Prueba", sesion = "7/22/2026 11:01:58 AM", peso = "80.0", involucrada = "Left", velocidades = [60, 180, 300], rotulos = {} } = {}) => {
  const todas = [60, 180, 300];
  const paginas = velocidades.map((grados) => pagina({ grados, indiceVelocidad: todas.indexOf(grados), nombre, sesion, peso, involucrada, rotulos }));
  const partes = ["%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"];
  const objetos = [];
  objetos.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  const kids = paginas.map((_, indice) => `${10 + indice * 3} 0 R`).join(" ");
  objetos.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>\nendobj\n`);
  objetos.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  const binarios = [];
  paginas.forEach((contenido, indice) => {
    const n = 10 + indice * 3;
    const comprimido = deflateSync(Buffer.from(contenido, "latin1"));
    objetos.push(`${n} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${n + 1} 0 R /Resources << /Font << /R8 3 0 R >> >> >>\nendobj\n`);
    // El largo de la primera, en otro objeto (como en los PDF de verdad).
    const largo = indice === 0 ? `${n + 2} 0 R` : String(comprimido.length);
    binarios.push({ antes: `${n + 1} 0 obj\n<< /Length ${largo} /Filter /FlateDecode >>\nstream\n`, comprimido, despues: "\nendstream\nendobj\n" });
    if (indice === 0) objetos.push(`${n + 2} 0 obj\n${comprimido.length}\nendobj\n`);
  });
  const piezas = [Buffer.from(partes.join(""), "latin1"), Buffer.from(objetos.join(""), "latin1")];
  binarios.forEach(({ antes, comprimido, despues }) => piezas.push(Buffer.from(antes, "latin1"), comprimido, Buffer.from(despues, "latin1")));
  piezas.push(Buffer.from("trailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1"));
  return new Uint8Array(Buffer.concat(piezas));
};
