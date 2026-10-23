// Las zonas que se tocan y se pintan en la figura del mapa corporal del
// reporte individual de Lesiones (Santiago, 23/10: la figura que mandó, de
// frente y de espaldas; «las tarjetas de abajo podríamos meterlas dentro del
// cuerpo modelado, o sea que se puedan tocar las zonas y ahí elegís»). Las
// marcó Claude a mano sobre la figura.
//
// Las coordenadas son píxeles de cada imagen (cuerpo-lesiones-frente.webp y
// cuerpo-lesiones-espalda.webp). Una forma con `eje` es de un brazo o una
// pierna: sus puntos son los del lado que queda a la izquierda de quien mira
// y el otro lado es su espejo sobre ese eje (la figura no es del todo
// simétrica: por eso cada forma tiene el suyo). Sin `eje`, va en el medio y
// no tiene lado.

export const TAMANO = Object.freeze({ frente: { ancho: 456, alto: 1011 }, espalda: { ancho: 454, alto: 1011 } });

// De frente, a la izquierda de quien mira está la derecha del jugador; de
// espaldas, su izquierda.
export const LADO_A_LA_IZQUIERDA = Object.freeze({ frente: "direito", espalda: "esquerdo" });

const forma = (eje, ...puntos) => ({ eje, puntos });
const medio = (...puntos) => ({ eje: null, puntos });

export const FORMAS = Object.freeze({
  frente: {
    cabeza: medio(185, 0, 292, 0, 292, 118, 186, 118),
    cuello: medio(196, 112, 282, 112, 296, 150, 300, 168, 178, 168, 182, 150),
    hombro: forma(238, 205, 168, 170, 170, 140, 172, 110, 180, 88, 198, 76, 228, 78, 262, 108, 262, 135, 245, 150, 205, 175, 190, 205, 188),
    pectoral: forma(238, 150, 200, 140, 248, 150, 280, 175, 292, 205, 290, 232, 282, 236, 240, 234, 195, 205, 190, 175, 190),
    torax: medio(226, 182, 250, 182, 252, 280, 300, 290, 330, 286, 334, 305, 240, 305, 142, 305, 145, 286, 176, 292, 224, 282),
    abdomen: medio(150, 300, 325, 300, 332, 340, 330, 420, 300, 435, 238, 440, 175, 435, 145, 420, 143, 340),
    brazo: forma(238, 80, 255, 110, 258, 135, 250, 140, 300, 132, 335, 105, 345, 70, 340, 62, 300),
    codo: forma(233, 60, 325, 105, 335, 110, 368, 80, 378, 45, 370, 50, 340),
    antebrazo: forma(233, 45, 360, 80, 370, 110, 360, 100, 420, 80, 470, 55, 478, 28, 468, 32, 410),
    muneca: forma(233, 25, 460, 58, 468, 60, 495, 22, 495),
    mano: forma(227, 5, 485, 60, 488, 58, 540, 50, 580, 20, 585, 0, 560),
    ingle: forma(233, 140, 425, 178, 440, 224, 448, 230, 505, 214, 520, 185, 490, 150, 470, 128, 455),
    psoas: forma(233, 170, 440, 222, 450, 226, 500, 205, 505, 178, 470),
    muslo: forma(227, 118, 470, 150, 470, 185, 492, 214, 520, 226, 520, 222, 560, 205, 610, 195, 640, 150, 650, 115, 640, 102, 590, 100, 540),
    cuadriceps: forma(227, 118, 470, 150, 470, 170, 497, 183, 545, 194, 600, 195, 645, 150, 652, 115, 640, 102, 590, 100, 540),
    aductores: forma(227, 170, 490, 214, 518, 226, 522, 220, 565, 205, 612, 194, 600, 183, 545),
    rodilla: forma(227, 115, 640, 195, 640, 195, 700, 185, 725, 125, 725, 112, 700),
    pierna: forma(227, 110, 720, 190, 722, 178, 780, 165, 840, 150, 890, 110, 892, 95, 840, 88, 780),
    tobillo: forma(222, 100, 885, 150, 885, 145, 930, 135, 955, 95, 955, 90, 930),
    pie: forma(222, 55, 945, 135, 940, 140, 985, 130, 1008, 55, 1008, 45, 985),
  },
  espalda: {
    cabeza: medio(180, 0, 285, 0, 285, 120, 180, 120),
    cuello: medio(190, 112, 272, 112, 285, 160, 180, 160),
    hombro: forma(230, 150, 165, 115, 172, 88, 190, 70, 225, 68, 262, 100, 268, 122, 250, 128, 215, 160, 185),
    torax: medio(180, 150, 285, 150, 282, 250, 262, 330, 232, 340, 202, 330, 182, 250),
    dorsal: forma(231, 125, 215, 165, 225, 195, 270, 215, 330, 222, 380, 170, 385, 140, 370, 128, 320, 120, 260),
    lumbar: medio(150, 360, 310, 360, 318, 420, 232, 440, 146, 420),
    brazo: forma(230, 68, 255, 100, 262, 122, 250, 125, 300, 110, 340, 80, 348, 55, 335, 58, 290),
    codo: forma(230, 50, 330, 100, 340, 98, 375, 70, 385, 35, 375, 40, 345),
    antebrazo: forma(230, 35, 365, 70, 378, 98, 370, 85, 425, 70, 470, 42, 478, 18, 468, 22, 410),
    muneca: forma(228, 15, 460, 55, 468, 55, 500, 15, 500),
    mano: forma(228, 5, 490, 58, 492, 55, 545, 48, 580, 15, 585, 0, 560),
    gluteo: forma(232, 130, 415, 175, 412, 228, 425, 230, 470, 222, 520, 180, 530, 130, 520, 118, 470),
    rotadores: forma(232, 150, 430, 200, 428, 222, 445, 205, 470, 160, 470, 140, 455),
    muslo: forma(225, 105, 515, 225, 515, 225, 560, 210, 620, 185, 690, 115, 690, 102, 620, 100, 560),
    isquiotibiales: forma(225, 108, 525, 222, 525, 220, 565, 205, 625, 182, 688, 118, 688, 104, 625, 102, 565),
    rodilla: forma(225, 112, 680, 185, 680, 180, 735, 115, 735),
    gemelos: forma(225, 100, 725, 175, 725, 175, 790, 160, 840, 105, 840, 88, 790, 90, 750),
    soleo: forma(225, 100, 815, 165, 815, 155, 880, 140, 905, 108, 905, 95, 860),
    pantorrilla: forma(225, 100, 725, 175, 725, 175, 790, 160, 845, 140, 905, 108, 905, 92, 850, 88, 790, 90, 750),
    pierna: forma(225, 100, 725, 175, 725, 175, 790, 160, 845, 140, 940, 105, 940, 92, 850, 88, 790, 90, 750),
    tobillo: forma(220, 95, 900, 145, 900, 145, 950, 140, 1008, 60, 1008, 55, 975, 95, 950),
    talon: forma(220, 60, 960, 140, 960, 142, 1008, 60, 1008),
  },
});

// Qué formas son de cada parte del cuerpo y de cada músculo (las listas de
// la carga de una lesión). Un código sin formas no tiene dónde ir: sus
// lesiones van a la parte del cuerpo.
export const ZONAS = Object.freeze([
  { campo: "parte_cuerpo", codigo: "cabeca_face", formas: { frente: ["cabeza"], espalda: ["cabeza"] } },
  { campo: "parte_cuerpo", codigo: "pescoco", formas: { frente: ["cuello"], espalda: ["cuello"] } },
  { campo: "parte_cuerpo", codigo: "ombro", formas: { frente: ["hombro"], espalda: ["hombro"] } },
  { campo: "parte_cuerpo", codigo: "esterno", formas: { frente: ["torax"], espalda: ["torax"] } },
  { campo: "parte_cuerpo", codigo: "abdomen", formas: { frente: ["abdomen"] } },
  { campo: "parte_cuerpo", codigo: "coluna_lombar", formas: { espalda: ["lumbar"] } },
  { campo: "parte_cuerpo", codigo: "braco", formas: { frente: ["brazo"], espalda: ["brazo"] } },
  { campo: "parte_cuerpo", codigo: "cotovelo", formas: { frente: ["codo"], espalda: ["codo"] } },
  { campo: "parte_cuerpo", codigo: "antebraco", formas: { frente: ["antebrazo"], espalda: ["antebrazo"] } },
  { campo: "parte_cuerpo", codigo: "punho", formas: { frente: ["muneca"], espalda: ["muneca"] } },
  { campo: "parte_cuerpo", codigo: "mao", formas: { frente: ["mano"], espalda: ["mano"] } },
  { campo: "parte_cuerpo", codigo: "quadril_virilha", formas: { frente: ["ingle"] } },
  { campo: "parte_cuerpo", codigo: "coxa", formas: { frente: ["muslo"], espalda: ["muslo"] } },
  { campo: "parte_cuerpo", codigo: "joelho", formas: { frente: ["rodilla"], espalda: ["rodilla"] } },
  { campo: "parte_cuerpo", codigo: "perna_aquiles", formas: { frente: ["pierna"], espalda: ["pierna"] } },
  { campo: "parte_cuerpo", codigo: "tornozelo_pe", formas: { frente: ["tobillo", "pie"], espalda: ["tobillo"] } },
  { campo: "parte_cuerpo", codigo: "pe_dedo", formas: { frente: ["pie"] } },
  { campo: "musculo", codigo: "deltoide", formas: { frente: ["hombro"], espalda: ["hombro"] } },
  { campo: "musculo", codigo: "peitoral", formas: { frente: ["pectoral"] } },
  { campo: "musculo", codigo: "biceps", formas: { frente: ["brazo"] } },
  { campo: "musculo", codigo: "triceps_braquial", formas: { espalda: ["brazo"] } },
  { campo: "musculo", codigo: "dorsal", formas: { espalda: ["dorsal"] } },
  { campo: "musculo", codigo: "gluteos", formas: { espalda: ["gluteo"] } },
  { campo: "musculo", codigo: "rotadores_quadril", formas: { espalda: ["rotadores"] } },
  { campo: "musculo", codigo: "psoas_iliaco", formas: { frente: ["psoas"] } },
  { campo: "musculo", codigo: "quadriceps", formas: { frente: ["cuadriceps"] } },
  { campo: "musculo", codigo: "adutores", formas: { frente: ["aductores"] } },
  { campo: "musculo", codigo: "isquiotibiais", formas: { espalda: ["isquiotibiales"] } },
  { campo: "musculo", codigo: "panturrilha", formas: { espalda: ["gemelos"] } },
  { campo: "musculo", codigo: "triceps_sural", formas: { espalda: ["pantorrilla"] } },
  { campo: "musculo", codigo: "soleo", formas: { espalda: ["soleo"] } },
  { campo: "musculo", codigo: "musculos_pe", formas: { frente: ["pie"] } },
  { campo: "musculo", codigo: "fascia_plantar_insercao", formas: { espalda: ["talon"] } },
  { campo: "musculo", codigo: "fascia_plantar_nao_insercao", formas: { espalda: ["talon"] } },
]);

// Los puntos de una forma del lado del jugador (lado: "direito" o
// "esquerdo"; en una forma del medio no importa): [[x, y], …].
export const paresDe = (vista, nombre, lado) => {
  const laForma = FORMAS[vista]?.[nombre];
  if (!laForma) return [];
  const espejar = laForma.eje !== null && lado && lado !== LADO_A_LA_IZQUIERDA[vista];
  // El espejo de un borde de afuera puede pasarse de la imagen: queda en el borde.
  const { ancho } = TAMANO[vista];
  const pares = [];
  for (let i = 0; i < laForma.puntos.length; i += 2) {
    const x = espejar ? 2 * laForma.eje - laForma.puntos[i] : laForma.puntos[i];
    pares.push([Math.min(Math.max(x, 0), ancho), laForma.puntos[i + 1]]);
  }
  return pares;
};

// Los mismos, como los pide un polígono de SVG: "x,y x,y …".
export const puntosDe = (vista, nombre, lado) =>
  paresDe(vista, nombre, lado)
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

// Si una forma tiene lado (es de un brazo o una pierna).
export const tieneLado = (vista, nombre) => Boolean(FORMAS[vista]?.[nombre]?.eje);
