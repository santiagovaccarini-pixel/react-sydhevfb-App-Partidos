import { ANCHO, contornoDe, espejadaEn, tipoDeRegion } from "./siluetaCuerpo.js";

// Lo que hay adentro de la figura del cuerpo: músculos, tendones y
// ligamentos dibujados sobre la silueta (siluetaCuerpo.js), de frente y de
// espaldas, cada uno con el código de su opción del catálogo. Se dibujan en
// el brazo y la pierna de la izquierda de la pantalla y en la mitad
// izquierda del tronco (el resto, espejado), como la silueta. Lateral es
// hacia afuera (x chica) y medial, hacia el medio (x hacia 100). Además, los
// esquemas de la rodilla, el tobillo y la planta del pie, para los
// ligamentos y lo que no se ve desde afuera.

const r = (n) => Math.round(n * 100) / 100;

// Un contorno suave que pasa por los puntos (Catmull-Rom cerrado).
export const suave = (puntos) => {
  const n = puntos.length;
  const p = (i) => puntos[(i + n) % n];
  let camino = `M${r(p(0)[0])},${r(p(0)[1])}`;
  for (let i = 0; i < n; i += 1) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    camino += ` C${r(c1[0])},${r(c1[1])} ${r(c2[0])},${r(c2[1])} ${r(p2[0])},${r(p2[1])}`;
  }
  return `${camino} Z`;
};

// Una cinta de cierto ancho a lo largo de una línea (el sartorio, un tendón,
// un ligamento).
export const cinta = (centro, ancho) => {
  const ida = [];
  const vuelta = [];
  centro.forEach((punto, i) => {
    const a = centro[Math.max(0, i - 1)];
    const b = centro[Math.min(centro.length - 1, i + 1)];
    const largo = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (-(b[1] - a[1]) / largo) * ancho;
    const ny = ((b[0] - a[0]) / largo) * ancho;
    ida.push([punto[0] + nx, punto[1] + ny]);
    vuelta.push([punto[0] - nx, punto[1] - ny]);
  });
  return [...ida, ...vuelta.reverse()];
};

// Los bordes de la pierna a cada altura: afuera (lateral) y adentro (medial;
// arriba del pubis, la ingle). Sirven para que los músculos lleguen justo
// hasta el borde.
const PUNTOS_PIERNA = contornoDe("pierna");
const cortesEn = (y) => {
  const xs = [];
  for (let i = 1; i < PUNTOS_PIERNA.length; i += 1) {
    const [x1, y1] = PUNTOS_PIERNA[i - 1];
    const [x2, y2] = PUNTOS_PIERNA[i];
    if ((y1 - y) * (y2 - y) <= 0 && y1 !== y2) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
  }
  return xs;
};
const alturas = (y0, y1) => {
  const ys = [];
  const paso = y1 >= y0 ? 3 : -3;
  for (let y = y0; paso > 0 ? y < y1 : y > y1; y += paso) ys.push(y);
  return [...ys, y1];
};
// Puntos sobre el borde de afuera o el de adentro, de y0 a y1, metidos
// `hacia` unidades para el centro de la pierna.
const porAfuera = (y0, y1, hacia = 0) => alturas(y0, y1).map((y) => [Math.min(...cortesEn(y)) + hacia, y]);
const porAdentro = (y0, y1, hacia = 0) => alturas(y0, y1).map((y) => [Math.max(...cortesEn(y)) - hacia, y]);

// tipo: "musculo" | "tendon" | "ligamento"; campo: la columna de la opción.
// Los profundos (debajo de otros) van en la capa "profunda": se ven y se
// tocan al pasar la figura a "Profundos".
const musculo = (codigo, puntos) => ({ codigo, campo: "musculo_especifico", tipo: "musculo", puntos });
const profundo = (codigo, puntos) => ({ ...musculo(codigo, puntos), capa: "profunda" });
const grupo = (codigo, puntos) => ({ codigo, campo: "musculo", tipo: "musculo", puntos });
const tendon = (codigo, puntos, campo = "musculo_especifico") => ({ codigo, campo, tipo: "tendon", puntos });
const ligamento = (codigo, puntos) => ({ codigo, campo: "ligamento", tipo: "ligamento", puntos });

// ---------------------------------------------------------------- Pierna --

// Divisorias que comparten dos músculos vecinos del muslo, de arriba abajo.
const TENSOR_ADENTRO = [[75.4, 193], [73.4, 206], [71.6, 222], [70.6, 240], [70.6, 252], [71.6, 276], [73.4, 300]];
const VASTO_RECTO = [[77.8, 205], [77.6, 214], [77.2, 232], [77.6, 252], [79.2, 271], [81.4, 288], [82.6, 296]];
const RECTO_ADENTRO = [[80.4, 203.5], [85.2, 214], [88.2, 234], [89, 254], [87.8, 274], [86.4, 288], [85.6, 295]];
const BICEPS_SEMITENDINOSO = [[90.6, 252.4], [87.6, 262], [84.6, 272]];
const al = (lista) => [...lista].reverse();

const PIERNA = {
  frente: [
    musculo("tensor_fascia_lata", [...porAfuera(190, 300), ...al(TENSOR_ADENTRO)]),
    musculo("vasto_lateral", [...TENSOR_ADENTRO.slice(1), [78.6, 299], ...al(VASTO_RECTO)]),
    musculo("reto_femoral", [[78.2, 202.5], ...RECTO_ADENTRO, ...al(VASTO_RECTO)]),
    musculo("vasto_medial", [[89, 254], [91.6, 258], [94.4, 270], [95.4, 285], [94.4, 300], [91, 303.6], [87.2, 301], ...al(RECTO_ADENTRO.slice(4))]),
    musculo("adutor_longo", [[95.2, 220.4], ...porAdentro(222, 262), [96.2, 264], [93.2, 256], [91.8, 244], [92, 232], [93.4, 224]]),
    musculo("adutor_magno", [...porAdentro(262, 296), [96.2, 296], [95.8, 285], [95, 272], [94, 264], [96.2, 262.5]]),
    musculo("psoas", [[85.6, 205.6], [90, 210.8], [94.6, 215.8], [93.4, 224], [92, 232], [91.6, 238], [89.4, 238], [88.6, 226], [86.6, 214]]),
    musculo("sartorio", cinta([[75.2, 193], [78.6, 207], [83.6, 228], [89.2, 249], [93.6, 267], [96, 285], [96.6, 302], [96, 317]], 1.8)),
    tendon("tendao_quadriceps", [[82.6, 295.5], [88.6, 295], [89.6, 302.4], [81.6, 302.4]]),
    tendon("tendao_patelar", [[83.3, 320.4], [87.7, 320.4], [87.4, 334], [83.6, 334]]),
    ligamento("lle", [...porAfuera(301, 329, 0.6), ...porAfuera(329, 301, 3.2)]),
    ligamento("lli", [...porAdentro(301, 333, 2.8), ...porAdentro(333, 301, 5)]),
    musculo("gastrocnemio_medial", [...porAdentro(326, 360), [94.4, 360], [93.4, 346], [93.6, 332]]),
    musculo("soleo", [...porAdentro(360, 386), [94.2, 386], [93.4, 374], [94.2, 362]]),
    ligamento("membrana_interossea", cinta([[79.6, 336], [80.6, 362], [81.6, 390]], 0.9)),
    ligamento("tibiofibular_anterior", [[79.6, 394], [84.6, 391.6], [85.2, 394.6], [80.2, 397.6]]),
    // Debajo del recto anterior y del aductor largo.
    profundo("vasto_intermedio", [[80, 222], [86, 224], [88, 240], [88, 262], [86, 282], [83, 288], [80, 284], [78.6, 262], [78.6, 240]]),
    profundo("adutor_curto", [[93, 226], [97.5, 224], [98, 236], [97, 248], [94.6, 252], [92.6, 246], [92.4, 234]]),
  ],
  espalda: [
    musculo("gluteo_medio", [[69.6, 183.4], [75, 189.6], [82, 197.4], [76, 202], [70.4, 206.6], [66.2, 209], ...porAfuera(206, 186)]),
    musculo("gluteo_maximo", [[82, 197.4], [88, 204.6], [94, 211.6], [100, 219.4], ...porAdentro(222, 246), [93, 251.4], [84, 251.8], [75, 248.4], [68.8, 241], ...porAfuera(238, 212), [70.4, 206.6], [76, 202]]),
    musculo("tensor_fascia_lata", [...porAfuera(243, 300), ...porAfuera(300, 243, 3)]),
    musculo("adutor_magno", [[96.2, 250], ...porAdentro(248.5, 263), [97.6, 268], [96.4, 260]]),
    musculo("biceps_femoral_curta", [...porAfuera(266, 296, 3), [75.8, 295], [75.4, 282], [73.8, 268]]),
    musculo("biceps_femoral_longa", [...BICEPS_SEMITENDINOSO, [81.6, 284], [78.8, 296], [75.8, 295], [75.4, 282], [73.8, 268], ...porAfuera(264, 252, 3), [74, 250.6], [83, 252.4]]),
    musculo("semitendinoso", [...al(BICEPS_SEMITENDINOSO), [86.4, 280], [89.6, 290], [91.8, 300], [94.6, 302], [94.6, 288], [94.4, 272], [94.8, 256]]),
    musculo("semimembranoso", [[94.8, 256], [96.4, 260], [97.6, 268], ...porAdentro(272, 304, 0.4), [94.6, 302], [94.6, 288], [94.4, 272]]),
    tendon("tendao_conjunto", [[89.6, 246.4], [94.6, 246.2], [95.2, 255.4], [90, 256]]),
    tendon("biceps_femoral", [[74.4, 296.4], [78.6, 296.2], [77.4, 318], [74.4, 318.6]]),
    tendon("semitendinoso", [[91.8, 300], [94.6, 302], [95.2, 321], [92.8, 321]]),
    musculo("soleo", [...porAfuera(346, 390), [84.6, 391], [88.4, 391], ...porAdentro(388, 366), [95.6, 368], [91, 374.6], [86.6, 373], [82, 368], [77.4, 361]]),
    musculo("gastrocnemio_lateral", [...porAfuera(316, 358), [77.4, 361], [82, 368], [85.4, 366], [85.6, 342], [85.2, 320], [80, 316]]),
    musculo("gastrocnemio_medial", [[86.4, 318], [92, 314.4], ...porAdentro(316, 364), [95.6, 368], [91, 374.6], [86.6, 373], [85.6, 360], [86, 340]]),
    musculo("plantar", [[77.4, 306.6], [80.4, 306], [81.6, 314], [79.2, 318.4], [76.8, 313.6]]),
    tendon("tendao_aquiles", [[84.6, 378], [88.6, 378], [88.2, 396], [89.4, 415], [83.8, 415], [84.8, 396]]),
    // Debajo de los glúteos: del sacro al trocánter.
    profundo("gluteo_minimo", [[70, 188], [78, 192], [80, 198], [74, 203], [68, 205], [67, 196]]),
    profundo("piriforme", cinta([[99, 203.6], [90, 204.6], [80, 206.6], [72, 209.6]], 2.4)),
    profundo("obturador_interno", cinta([[98.6, 213.6], [88, 213.8], [78, 214.6], [72, 215.6]], 2)),
    profundo("obturador_externo", cinta([[97, 222], [87, 221.2], [78, 221], [72.6, 221.4]], 1.8)),
  ],
};

// ----------------------------------------------------------------- Brazo --

const DELTOIDES = [[77, 72.4], [66, 73.2], [56, 76.6], [52, 86], [50, 98], [50.4, 110], [53.2, 118.6], [57.6, 112], [62, 100], [66.4, 91.6], [70.6, 84], [76, 78]];
const BRAZO = {
  frente: [
    grupo("deltoide", DELTOIDES),
    grupo("biceps", [[55, 108], [60.6, 100.4], [64.8, 108], [64.6, 130], [62.6, 150], [59.6, 164], [55.8, 166], [52.4, 156], [51, 136], [52, 118]]),
    tendon("biceps", [[55.8, 164.6], [59.4, 164.4], [59.2, 176.4], [56.4, 176.6]], "musculo"),
  ],
  espalda: [
    grupo("deltoide", DELTOIDES),
    grupo("triceps_braquial", [[54.6, 106], [61.4, 100], [65.6, 110], [65, 132], [62.8, 152], [60.4, 165], [55, 167.4], [51.4, 156], [49.6, 134], [51, 116]]),
    tendon("triceps_braquial", [[55.2, 165.6], [60, 165.2], [59.2, 178], [56, 178.2]], "musculo"),
  ],
};

// ---------------------------------------------------------------- Tronco --

// La mitad izquierda de la pantalla (la otra, espejada) y lo del medio.
const TRONCO = {
  frente: {
    mitad: [
      musculo("peitoral_maior", [[98.6, 79], [88, 77.8], [76, 79.8], [69.2, 84], [67.6, 96], [68.6, 108], [74, 118], [84, 124.6], [98.6, 124]]),
      musculo("obliquo_externo", [[68.4, 146], [76, 138], [89.6, 134], [89.8, 170], [91.6, 198], [95, 212], [88, 206.6], [80, 198], [72.6, 188.4], [70.2, 178], [70.4, 164], [69.2, 152]]),
      // Debajo del pectoral mayor y del oblicuo externo.
      profundo("peitoral_menor", [[73, 86], [78, 86], [90, 100], [92, 112], [88, 116], [82, 106], [74, 92]]),
      profundo("obliquo_interno", [[71, 166], [80, 160], [89.6, 158], [89.8, 180], [91, 198], [84, 196], [76, 188], [71.5, 178]]),
    ],
    medio: [musculo("abdominal", [[90.6, 132], [109.4, 132], [110.2, 170], [108.4, 200], [103.4, 216], [96.6, 216], [91.6, 200], [89.8, 170]])],
  },
  espalda: {
    mitad: [
      grupo("dorsal", [[67.2, 104], [72.4, 106], [84, 126], [94, 146], [97.6, 166], [97.6, 194], [90, 196], [80, 190], [71.6, 182], [70.4, 168], [70.2, 150], [68.4, 130], [67, 116]]),
      musculo("manguito_rotador", [[71, 92.4], [88.8, 90.6], [90.2, 104], [86.6, 123], [80, 116], [73.8, 104]]),
    ],
    medio: [],
  },
};

const espejarPuntos = (puntos) => puntos.map(([x, y]) => [ANCHO - x, y]);
const conCamino = (estructura, i, extra = {}) => ({ ...estructura, clave: `${estructura.campo}:${estructura.codigo}:${i}`, camino: suave(estructura.puntos), ...extra });

// Lo que se dibuja en una región, en una vista: { clave, codigo, campo, tipo,
// capa, camino, lado }. En el brazo y la pierna, como están dibujados (la
// figura los espeja con la región); en el tronco, las dos mitades, cada una
// con el lado del jugador que le toca ("direito"/"esquerdo"; null lo del
// medio).
export const estructurasDe = (region, vista = "frente") => {
  const tipo = tipoDeRegion(region);
  if (tipo === "pierna") return PIERNA[vista].map((una, i) => conCamino(una, i, { lado: null }));
  if (tipo === "brazo") return BRAZO[vista].map((una, i) => conCamino(una, i, { lado: null }));
  if (tipo !== "tronco") return [];
  const { mitad, medio } = TRONCO[vista];
  // De frente, la mitad izquierda de la pantalla es el lado derecho del jugador; de espaldas, el izquierdo.
  const izquierdaDePantalla = vista === "espalda" ? "esquerdo" : "direito";
  const derechaDePantalla = vista === "espalda" ? "direito" : "esquerdo";
  return [
    ...mitad.map((una, i) => conCamino(una, i, { lado: izquierdaDePantalla })),
    ...mitad.map((una, i) => conCamino({ ...una, puntos: espejarPuntos(una.puntos) }, i + mitad.length, { lado: derechaDePantalla })),
    ...medio.map((una, i) => conCamino(una, i + mitad.length * 2, { lado: null })),
  ];
};

// ------------------------------------------------------------- Acercar --

// Qué se ve de cada parte: un rectángulo del lienzo (en el brazo y la pierna
// de la izquierda de la pantalla). El hombro incluye el omóplato (el
// manguito rotador está ahí).
const CAJAS = {
  cabeca_face: [74, 4, 52, 62],
  pescoco: [78, 40, 44, 42],
  esterno: [62, 66, 76, 96],
  abdomen: [64, 124, 72, 100],
  coluna_lombar: [62, 140, 76, 92],
  ombro: [42, 64, 54, 66],
  braco: [42, 90, 30, 88],
  cotovelo: [38, 144, 30, 44],
  antebraco: [34, 168, 32, 60],
  punho: [32, 204, 30, 34],
  mao: [30, 212, 30, 64],
  quadril_virilha: [60, 178, 42, 82],
  coxa: [58, 194, 46, 132],
  joelho: [64, 280, 38, 70],
  perna_aquiles: [64, 304, 38, 118],
  tornozelo_pe: [68, 368, 34, 68],
  pe_dedo: [68, 384, 34, 52],
};

// El rectángulo de una parte (de la figura) en una región y una vista:
// espejado si la región va del otro lado.
export const cajaDeParte = (pieza, region, vista = "frente") => {
  const caja = CAJAS[pieza];
  if (!caja) return null;
  const [x, y, w, h] = caja;
  return espejadaEn(region, vista) ? [ANCHO - x - w, y, w, h] : [x, y, w, h];
};

// ------------------------------------------------------------- Esquemas --

// Las articulaciones vistas por dentro, para los ligamentos y los meniscos,
// y la planta del pie. Como la pierna derecha (de frente, lateral a la
// izquierda; para la izquierda se espejan). Cada uno: caja (lo que se ve),
// letra (el tamaño de los rótulos) y piezas: huesos y lo que se toca, con su
// rótulo (la clave del diccionario del texto corto, lesiones.cuerpo.rotulos),
// dónde va (en) y, si va afuera, hasta dónde llega su línea (hacia).
const hueso = (camino) => ({ tipo: "hueso", camino });
const enEsquema = (estructura, rotulo = null, en = null, hacia = null) => ({ ...estructura, camino: suave(estructura.puntos), rotulo, en, hacia });

export const ESQUEMAS = {
  rodilla: {
    caja: [0, 0, 100, 96],
    letra: 4.6,
    piezas: [
      hueso("M40,0 L60,0 L62,20 C72,24 80,31 80,39 C80,46 73,49 64,46.5 C60,45.4 57,44.2 55,45.6 C52,48 48,48 45,45.6 C43,44.2 40,45.4 36,46.5 C27,49 20,46 20,39 C20,31 28,24 38,20 Z"),
      hueso("M19,54.5 C21,51.6 34,50.8 50,50.8 C66,50.8 79,51.6 81,54.5 L78,62 C71,66 65,69 63,75 L61,96 L39,96 L37,75 C35,69 29,66 22,62 Z"),
      hueso("M12.5,60 C12.5,55.4 20,55 21,59.6 C21.6,63 19.6,66 18.4,67 L18,96 L14,96 L13.6,67 C12.8,65.6 12.5,63 12.5,60 Z"),
      enEsquema(ligamento("menisco_lateral", [[21, 50.2], [28, 47.2], [38, 46.6], [46.4, 48], [46.4, 50.8], [21.4, 51.6]]), "ml", [32, 58.6], [32, 50]),
      enEsquema(ligamento("menisco_medial", [[53.6, 48], [62, 46.6], [72, 47.2], [79, 50.2], [78.6, 51.6], [53.6, 50.8]]), "mm", [68, 58.6], [68, 50]),
      enEsquema(ligamento("lca", cinta([[43.6, 33], [47.6, 41], [53.6, 51]], 2.1)), "lca", [40.6, 28.6]),
      enEsquema(ligamento("lcp", cinta([[56.4, 32], [53.2, 41.6], [46.4, 51.4]], 2.1)), "lcp", [60, 28.6]),
      enEsquema(ligamento("lle", cinta([[19.4, 33], [16.4, 45], [15.8, 57.6]], 2)), "lle", [8.4, 40]),
      enEsquema(ligamento("lli", cinta([[80.8, 33], [82.6, 46], [80.2, 66]], 2.3)), "lli", [91.6, 40]),
    ],
  },
  tobilloAfuera: {
    caja: [0, 0, 98, 76],
    letra: 4.2,
    piezas: [
      hueso("M46,0 L66,0 L67,26 C70,30 72,34 70,38 L46,38 Z"),
      hueso("M30,0 L39,0 L40,30 C41,36 39,42 35.4,45 C32,46.4 29.6,43 29.6,38 Z"),
      hueso("M40,38 C44,33.6 64,32.4 72,37.6 C76,40.6 76,46 72,49 L44,50 C40,47 38.6,41.6 40,38 Z"),
      hueso("M14,56 C14,49 22,46 32,46.6 L52,48.6 C58,50 60,56 58,62 L54,70 C48,73 26,73 18,70 C15,67 14,61 14,56 Z"),
      hueso("M72,46 C80,44 96,46 110,50 C116,52 118,57 115,60 C104,62 84,62 70,60 C64,58 64,50 72,46 Z"),
      enEsquema(ligamento("membrana_interossea", cinta([[40.2, 4], [41.8, 12], [42.8, 20]], 1.6))),
      enEsquema(ligamento("tibiofibular_anterior", cinta([[38.6, 27], [43, 25.8], [47.4, 24.4]], 1.8)), "sindesmosis", [82, 14], [46, 25]),
      enEsquema(ligamento("lle_anterior", cinta([[37.4, 41.6], [47, 43.4], [57.4, 44.6]], 2.2)), "anterior", [84, 31], [55, 44.4]),
      enEsquema(ligamento("lle_medio", cinta([[33, 45.2], [31, 52], [29.4, 59]], 2.2)), "medio", [9, 66], [30, 56]),
      enEsquema(ligamento("lle_posterior", cinta([[30, 41.6], [24, 44.4], [18.6, 48.6]], 2.1)), "posterior", [13, 34], [22, 46]),
    ],
  },
  tobilloAdentro: {
    caja: [22, 0, 96, 78],
    letra: 4.2,
    piezas: [
      hueso("M54,0 L74,0 L75,30 C77,36 76,42 72,45.4 C68,47 64,44 63,40 L52,40 Z"),
      hueso("M46,40 C50,35.6 68,34.4 76,39.6 C80,42.6 80,48 76,51 L48,52 C44,49 42.6,43.6 46,40 Z"),
      hueso("M66,58 C66,51 74,48 84,48.6 L100,50.6 C106,52 108,58 106,64 L102,72 C96,75 76,75 70,72 C67,69 66,63 66,58 Z"),
      hueso("M8,48 C16,46 32,46 46,50 C52,52 54,57 51,60 C40,62 20,62 6,60 C0,58 0,50 8,48 Z"),
      enEsquema(ligamento("lli_deltoide", [[66, 43], [74, 44.6], [86, 56], [80, 60], [70, 58], [58, 58], [48, 55], [52, 50]]), "deltoideo", [100, 26], [76, 50]),
    ],
  },
  planta: {
    caja: [0, 0, 64, 132],
    letra: 4.4,
    piezas: [
      hueso(suave([[20, 128], [12, 118], [10, 100], [13, 80], [12, 60], [10, 40], [12, 22], [22, 8], [36, 4], [50, 8], [56, 20], [56, 40], [52, 62], [46, 82], [44, 100], [44, 116], [36, 128]])),
      enEsquema(grupo("musculos_pe", [[14, 40], [22, 28], [40, 24], [52, 30], [52, 48], [40, 52], [24, 52], [14, 50]]), "musculos", [22, 46]),
      enEsquema(musculo("adutor_halux", [[38, 30], [50, 34], [48, 44], [34, 46], [28, 40]]), "aductor", [40, 38]),
      enEsquema(grupo("fascia_plantar_nao_insercao", [[16, 56], [26, 54], [38, 54], [46, 58], [42, 78], [38, 98], [34, 104], [24, 104], [18, 96], [16, 78]]), "fascia", [30, 80]),
      enEsquema(grupo("fascia_plantar_insercao", [[22, 106], [34, 106], [38, 116], [32, 124], [22, 124], [17, 116]]), "insercion", [27.6, 115.6]),
    ],
  },
};

// Los esquemas que se muestran de cada parte del cuerpo.
const ESQUEMAS_DE_PARTE = {
  joelho: ["rodilla"],
  tornozelo_pe: ["tobilloAfuera", "tobilloAdentro"],
  pe_dedo: ["planta"],
};
export const esquemasDe = (pieza) => ESQUEMAS_DE_PARTE[pieza] || [];

// Todos los códigos dibujados, por columna.
export const codigosDibujados = () => {
  const todos = [
    ...["frente", "espalda"].flatMap((vista) => [...PIERNA[vista], ...BRAZO[vista], ...TRONCO[vista].mitad, ...TRONCO[vista].medio]),
    ...Object.values(ESQUEMAS).flatMap((esquema) => esquema.piezas.filter((pieza) => pieza.codigo)),
  ];
  return todos.reduce((porCampo, una) => ({ ...porCampo, [una.campo]: [...new Set([...(porCampo[una.campo] || []), una.codigo])] }), {});
};
