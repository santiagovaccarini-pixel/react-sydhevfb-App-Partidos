// La silueta de la figura del cuerpo (FiguraCuerpo.jsx): un cuerpo de
// verdad, de frente y de espaldas, en un lienzo de 200 x 440. El brazo y la
// pierna se dibujan del lado izquierdo de la pantalla y se espejan para el
// otro lado; la cabeza, el cuello y el tronco se dibujan por la mitad y se
// completan espejando. Cada parte del cuerpo es el pedazo de su región entre
// dos cortes (el reborde de las costillas, la rodilla, el tobillo…), con su
// propio contorno: lo que se toca es exactamente lo que se ve.

export const ANCHO = 200;
export const ALTO = 440;

// Un trazo es un punto de inicio y sus tramos: [x, y] es una recta y
// [c1x, c1y, c2x, c2y, x, y], una curva.
const trazo = (inicio, ...tramos) => ({ inicio, tramos });
const fin = (tramo) => tramo.slice(-2);
const numero = (valor) => String(Math.round(valor * 100) / 100);
const par = (valores) => `${numero(valores[0])},${numero(valores[1])}`;
const tramoATexto = (tramo) => (tramo.length === 2 ? `L${par(tramo)}` : `C${par(tramo.slice(0, 2))} ${par(tramo.slice(2, 4))} ${par(tramo.slice(4))}`);
const texto = ({ inicio, tramos }) => [`M${par(inicio)}`, ...tramos.map(tramoATexto)].join(" ");
const cerrada = (uno) => `${texto(uno)} Z`;
const espejar = (valores) => valores.map((valor, i) => (i % 2 === 0 ? ANCHO - valor : valor));
const espejada = ({ inicio, tramos }) => trazo(espejar(inicio), ...tramos.map(espejar));
// El mismo trazo, recorrido al revés.
const alReves = ({ inicio, tramos }) => {
  const puntos = [inicio, ...tramos.map(fin)];
  return trazo(puntos[puntos.length - 1], ...tramos.map((tramo, i) => (tramo.length === 2 ? puntos[i] : [...tramo.slice(2, 4), ...tramo.slice(0, 2), ...puntos[i]])).reverse());
};
// Una figura simétrica a partir de su mitad izquierda, que va de un punto
// del medio a otro: se completa con la mitad derecha, de vuelta.
const simetrica = (mitad) => cerrada(trazo(mitad.inicio, ...mitad.tramos, ...espejada(alReves(mitad)).tramos));

// Un punto de un tramo (t de 0 a 1).
const puntoEn = (desde, tramo, t) => {
  if (tramo.length === 2) return [desde[0] + (tramo[0] - desde[0]) * t, desde[1] + (tramo[1] - desde[1]) * t];
  const u = 1 - t;
  const en = (i) => u * u * u * desde[i] + 3 * u * u * t * tramo[i] + 3 * u * t * t * tramo[2 + i] + t * t * t * tramo[4 + i];
  return [en(0), en(1)];
};

// Un tramo partido en dos en t (las curvas, por de Casteljau).
const partirTramo = (desde, tramo, t) => {
  const entre = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  if (tramo.length === 2) return [entre(desde, tramo), tramo];
  const [c1, c2, hasta] = [tramo.slice(0, 2), tramo.slice(2, 4), tramo.slice(4)];
  const a = entre(desde, c1);
  const b = entre(c1, c2);
  const c = entre(c2, hasta);
  const d = entre(a, b);
  const e = entre(b, c);
  return [[...a, ...d, ...entre(d, e)], [...e, ...c, ...hasta]];
};

// Dónde cruza un tramo la altura y: los t, de menor a mayor (sin las
// puntas, que ya son puntos del trazo).
const cruces = (desde, tramo, y) => {
  const PASOS = 64;
  const resto = (t) => puntoEn(desde, tramo, t)[1] - y;
  const encontrados = [];
  for (let paso = 1; paso <= PASOS; paso += 1) {
    let a = (paso - 1) / PASOS;
    let b = paso / PASOS;
    if (resto(b) === 0 && paso < PASOS) encontrados.push(b);
    if (resto(a) * resto(b) >= 0) continue;
    for (let vuelta = 0; vuelta < 40; vuelta += 1) {
      const medio = (a + b) / 2;
      if (resto(a) * resto(medio) <= 0) b = medio;
      else a = medio;
    }
    encontrados.push((a + b) / 2);
  }
  return encontrados;
};

// El trazo con un punto más donde cruza cada una de esas alturas.
const partirEnAlturas = (uno, alturas) => {
  const tramos = [];
  let desde = uno.inicio;
  uno.tramos.forEach((tramo) => {
    const ts = alturas.flatMap((y) => cruces(desde, tramo, y)).sort((a, b) => a - b);
    let origen = desde;
    let resto = tramo;
    let hecho = 0;
    ts.forEach((t) => {
      const [primero, segundo] = partirTramo(origen, resto, (t - hecho) / (1 - hecho));
      tramos.push(primero);
      origen = fin(primero);
      resto = segundo;
      hecho = t;
    });
    tramos.push(resto);
    desde = fin(tramo);
  });
  return trazo(uno.inicio, ...tramos);
};

// El pedazo de un contorno cerrado entre dos alturas, cerrado por los cortes.
const pedazo = (contorno, arriba, abajo) => {
  const { inicio, tramos } = partirEnAlturas(contorno, [arriba, abajo]);
  const puntos = [inicio, ...tramos.map(fin)];
  const adentro = tramos.map((tramo, i) => {
    const y = puntoEn(puntos[i], tramo, 0.5)[1];
    return y > arriba && y < abajo;
  });
  // Se recorre desde el primer tramo de adentro que viene después de uno de
  // afuera; cada tanda de adentro se une a la siguiente por el corte.
  const primero = adentro.findIndex((esta, i) => esta && !adentro[(i + adentro.length - 1) % adentro.length]);
  if (primero < 0) return adentro[0] ? cerrada(trazo(inicio, ...tramos)) : "";
  const partes = [];
  let seguido = false;
  tramos.forEach((_, vuelta) => {
    const i = (primero + vuelta) % tramos.length;
    if (!adentro[i]) {
      seguido = false;
      return;
    }
    if (!seguido) partes.push(`${partes.length ? "L" : "M"}${par(puntos[i])}`);
    partes.push(tramoATexto(tramos[i]));
    seguido = true;
  });
  return `${partes.join(" ")} Z`;
};

// Una mitad (del medio al costado y de vuelta al medio) partida donde el
// costado cruza la altura y: lo de arriba, lo de abajo y el punto del corte.
const partirMitad = (mitad, y) => {
  const { inicio, tramos } = partirEnAlturas(mitad, [y]);
  const puntos = [inicio, ...tramos.map(fin)];
  const i = puntos.findIndex((punto) => Math.abs(punto[1] - y) < 1e-6);
  return { arriba: trazo(inicio, ...tramos.slice(0, i)), abajo: trazo(puntos[i], ...tramos.slice(i)), punto: puntos[i] };
};

// El rectángulo que ocupan unos trazos (para acercar la figura).
const cajaDe = (trazos) => {
  const puntos = trazos.flatMap(({ inicio, tramos }) => {
    let desde = inicio;
    return [
      inicio,
      ...tramos.flatMap((tramo) => {
        const muestras = Array.from({ length: 16 }, (_, paso) => puntoEn(desde, tramo, (paso + 1) / 16));
        desde = fin(tramo);
        return muestras;
      }),
    ];
  });
  const xs = puntos.map((punto) => punto[0]);
  const ys = puntos.map((punto) => punto[1]);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

// ------------------------------------------------------------ Contornos --

const CABEZA = trazo([100, 8], [88, 8, 79.5, 17, 79.5, 31], [79.5, 40.5, 82.5, 48, 87.5, 53.5], [91.5, 57.5, 95.5, 59.5, 100, 59.5]);
const OREJA = trazo([80, 27], [76.5, 26.5, 76, 33, 77, 37], [78, 41, 80, 43, 81.5, 40.5]);
const CUELLO = trazo([100, 54], [96, 54, 93, 52.5, 90.5, 48.5], [90.8, 57, 89.8, 64, 87, 71.5], [92, 73.5, 96, 74.5, 100, 74.5]);

// Medio tronco: de la base del cuello por el hombro, la axila, la cintura y
// la cresta ilíaca, y por la ingle hasta el pubis. Baja apenas debajo de
// donde empiezan las piernas (que lo tapan), para que no quede una rendija.
const TRONCO = trazo(
  [100, 69],
  [88, 69],
  [80, 70.5, 72, 73, 66, 77],
  [65.5, 86, 65.5, 95, 66, 104],
  [66.5, 120, 67, 136, 68.5, 150],
  [69.5, 156, 70.5, 160, 70.5, 166],
  [70.5, 172, 69.5, 177, 69.4, 182.6],
  [75, 191, 90, 211, 100, 219.8],
);

// La pierna: de la cresta ilíaca por afuera hasta el pie, de vuelta por
// adentro hasta el pubis y por la ingle. De espaldas, arriba está el glúteo.
const PIERNA = trazo(
  [69.5, 182],
  [66, 192, 64.5, 203, 64.5, 214],
  [64.5, 240, 67, 272, 71, 300],
  [72.5, 307, 72.5, 315, 72, 322],
  [70.5, 335, 71, 352, 74, 368],
  [76, 380, 78, 392, 78.5, 402],
  [78.5, 410, 75, 417, 74.5, 423],
  [74, 428, 77, 431, 82, 431.5],
  [88, 432, 94, 431.5, 96, 429],
  [97.5, 425, 96.5, 414, 95.5, 404],
  [94.5, 392, 95, 380, 96.5, 370],
  [98.5, 356, 98.5, 340, 97, 330],
  [96, 322, 96, 314, 97, 306],
  [98.5, 290, 99.5, 262, 99.5, 246],
  [99.5, 238, 100, 230, 100, 219],
  [90, 210, 75, 190, 69.5, 182],
);

// El brazo, con la palma hacia adelante y el pulgar hacia afuera: del hombro
// por afuera hasta la mano y de vuelta por adentro hasta la axila.
const BRAZO = trazo(
  [77, 71.8],
  [68, 72.4, 56, 75.5, 52, 86],
  [49.5, 94, 49, 104, 50, 112],
  [49, 124, 48, 140, 48.5, 152],
  [48.5, 158, 47.5, 163, 46.5, 168],
  [44, 176, 43, 186, 42, 200],
  [41.2, 210, 40.6, 215, 40.5, 220],
  [38.5, 224, 35.5, 230, 35, 236],
  [34.5, 240, 36.5, 241.5, 38, 239],
  [38.5, 250, 39.5, 260, 43, 266],
  [45, 269, 49, 269.5, 50.5, 266],
  [53, 258, 53.5, 244, 52.5, 232],
  [52.5, 228, 52.5, 225, 52.5, 222],
  [53.5, 206, 57, 188, 60, 176],
  [61, 170, 61.5, 166, 61.5, 162],
  [62.5, 150, 65, 132, 66, 118],
  [66.5, 112, 66.5, 108, 66.5, 104],
  [68.5, 94, 71.5, 80, 77, 71.8],
);

// ---------------------------------------------------------------- Partes --

// Cada parte baja un poco debajo de su corte (la de abajo, que se dibuja
// después, la tapa): así no queda una rendija entre dos partes.
const SOLAPE = 0.6;

// Un brazo o una pierna, partidos a lo ancho a esas alturas.
const partesEntre = (contorno, partes, alturas) =>
  partes.map((parte, i) => ({ parte, camino: pedazo(contorno, i === 0 ? -Infinity : alturas[i - 1], i === partes.length - 1 ? Infinity : alturas[i] + SOLAPE) }));

// El tronco, partido por una curva que va del costado (a la altura y) al
// medio: el reborde de las costillas de frente, la última costilla de espaldas.
const partirTronco = (partes, y, curva) => {
  const arriba = partirMitad(TRONCO, y + SOLAPE);
  const abajo = partirMitad(TRONCO, y);
  const bajada = curva.map((valor, i) => (i % 2 === 1 ? valor + SOLAPE : valor));
  const subida = alReves(trazo(abajo.punto, curva));
  return [
    { parte: partes[0], camino: simetrica(trazo(TRONCO.inicio, ...arriba.arriba.tramos, bajada)) },
    { parte: partes[1], camino: simetrica(trazo(subida.inicio, ...subida.tramos, ...abajo.abajo.tramos)) },
  ];
};

// La oreja espejada se recorre al revés, en el mismo sentido que la cabeza:
// si no, donde se pisan queda sin pintar.
const CABEZA_CON_OREJAS = `${simetrica(CABEZA)} ${cerrada(OREJA)} ${cerrada(alReves(espejada(OREJA)))}`;

// ------------------------------------------------------------- Detalles --

// Unas líneas finas para que se lea como un cuerpo: no se tocan.
const conSuEspejo = (...trazos) => trazos.flatMap((uno) => [texto(uno), texto(espejada(uno))]);
const punto = (x, y, r) => `M${x - r},${y} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`;

const DETALLES = {
  frente: {
    tronco: [
      // Clavículas, pectorales, la línea del abdomen y el ombligo.
      ...conSuEspejo(trazo([96, 76], [88, 77, 76, 78, 68, 81]), trazo([68, 110], [74, 121, 86, 126, 98, 121])),
      texto(trazo([100, 141], [100, 164])),
      punto(100, 170, 1.5),
    ],
    // La ingle y la rótula.
    pierna: [
      texto(trazo([70.5, 184], [76, 192, 89, 208.5, 99.5, 218.6])),
      texto(trazo([80.5, 306], [82.5, 302, 88.5, 302, 90.5, 306])),
      texto(trazo([81, 317], [83.5, 320.5, 88, 320.5, 90.5, 317])),
    ],
  },
  espalda: {
    tronco: [
      // La columna, los omóplatos y los hoyuelos de la cintura.
      texto(trazo([100, 76], [100, 218])),
      ...conSuEspejo(trazo([89, 91], [90.5, 102, 90, 113, 86, 124], [81, 117, 76, 108, 72.5, 97]), trazo([88.5, 94], [83, 92, 77, 92, 71, 93.5])),
      punto(91, 197, 1.2),
      punto(109, 197, 1.2),
    ],
    // El pliegue del glúteo y el de atrás de la rodilla.
    pierna: [texto(trazo([75, 247], [84, 252, 93, 252, 99, 248])), texto(trazo([80, 317], [85, 320, 90, 320, 95, 317]))],
    // El codo.
    brazo: [texto(trazo([60, 166], [57, 169, 55, 172, 54, 176]))],
  },
};

// --------------------------------------------------------------- Dibujo --

// Por cada tipo de región: sus partes de frente (y de espaldas, si cambian),
// de arriba hacia abajo, y el rectángulo que ocupa.
const DIBUJOS = {
  cabeza: {
    // La cabeza tapa el cuello: el mentón hace de corte.
    piezas: { frente: [{ parte: "pescoco", camino: simetrica(CUELLO) }, { parte: "cabeca_face", camino: CABEZA_CON_OREJAS }] },
    caja: cajaDe([CABEZA, OREJA, espejada(OREJA), CUELLO]),
  },
  tronco: {
    piezas: {
      frente: partirTronco(["esterno", "abdomen"], 158, [80, 152, 92, 140, 100, 137]),
      espalda: partirTronco(["esterno", "coluna_lombar"], 160, [80, 163, 92, 165, 100, 165]),
    },
    caja: cajaDe([TRONCO, espejada(TRONCO)]),
  },
  brazo: {
    // Hombro, brazo, codo, antebrazo, muñeca y mano.
    piezas: { frente: partesEntre(BRAZO, ["ombro", "braco", "cotovelo", "antebraco", "punho", "mao"], [110, 158, 178, 218, 229]) },
    caja: cajaDe([BRAZO]),
  },
  pierna: {
    // Cadera e ingle (de espaldas, el glúteo), muslo, rodilla, pierna, tobillo y pie.
    piezas: { frente: partesEntre(PIERNA, ["quadril_virilha", "coxa", "joelho", "perna_aquiles", "tornozelo_pe", "pe_dedo"], [250, 300, 326, 396, 414]) },
    caja: cajaDe([PIERNA]),
  },
};

// El orden de las regiones: el de lectura (con el teclado) y el del dibujo.
// Cada una tapa a las anteriores donde se juntan: el tronco, la base del
// cuello; el brazo, el borde del tronco en el hombro; la pierna, el borde
// del tronco en la ingle.
export const ORDEN_DE_REGIONES = ["cabeza", "tronco", "brazo_derecho", "pierna_derecha", "brazo_izquierdo", "pierna_izquierda"];

export const tipoDeRegion = (region) => String(region || "").split("_")[0];

// De frente, el lado derecho del jugador queda a la izquierda de quien mira
// (como está dibujado); de espaldas, a la derecha (espejado).
export const espejadaEn = (region, vista) => {
  const lado = String(region || "").split("_")[1];
  if (!lado) return false;
  const derecho = lado === "derecho" || lado === "derecha";
  return vista === "espalda" ? derecho : !derecho;
};

// Lo que se dibuja de una región en una vista: sus partes ({ parte, camino }),
// las líneas del cuerpo y si va espejada.
export const dibujoDe = (region, vista = "frente") => {
  const dibujo = DIBUJOS[tipoDeRegion(region)];
  if (!dibujo) return null;
  return {
    piezas: dibujo.piezas[vista] || dibujo.piezas.frente,
    detalles: DETALLES[vista]?.[tipoDeRegion(region)] || [],
    espejada: espejadaEn(region, vista),
  };
};

// El rectángulo de una región en la figura (espejado si va del otro lado).
export const cajaDeRegion = (region, vista = "frente") => {
  const caja = DIBUJOS[tipoDeRegion(region)]?.caja;
  if (!caja) return null;
  return espejadaEn(region, vista) ? { ...caja, x: ANCHO - caja.x - caja.w } : { ...caja };
};

// Lo que hay que mover y agrandar para que una región llene la figura.
export const zoomA = (region, vista = "frente") => {
  const caja = region ? cajaDeRegion(region, vista) : null;
  if (!caja) return { x: 0, y: 0, escala: 1 };
  const margen = 10;
  const escala = Math.min(ANCHO / (caja.w + margen * 2), ALTO / (caja.h + margen * 2), 3);
  return { x: ANCHO / 2 - escala * (caja.x + caja.w / 2), y: ALTO / 2 - escala * (caja.y + caja.h / 2), escala };
};
