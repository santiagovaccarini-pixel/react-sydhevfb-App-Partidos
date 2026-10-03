// Sacarle el fondo a la foto del jugador para el reporte individual: las
// fotos del club vienen con un fondo liso gris claro, y en la cabecera negra
// el jugador queda parado sobre el negro. Se trabaja con los puntos de la
// imagen (RGBA, como ImageData): si el borde no es un fondo liso y claro, no
// se toca (null) y el reporte la muestra como está.

// Cuánto se puede alejar un punto del color del fondo y seguir siendo fondo
// (el de las fotos del club es un gris parejo; con más, se empieza a comer
// lo blanco de la camiseta que toca el fondo), y desde dónde ya es del
// jugador del todo (en el medio, borde suave).
const TOLERANCIA = 10;
const BORDE_SUAVE = 40;
// Un fondo liso: casi todo el borde de la foto del mismo color, y claro (el
// de abajo no cuenta: ahí el jugador queda cortado).
const PAREJO = 0.9;
const CLARO = 170;

const distancia = (datos, i, fondo) => {
  const r = datos[i] - fondo[0];
  const g = datos[i + 1] - fondo[1];
  const b = datos[i + 2] - fondo[2];
  return Math.sqrt(r * r + g * g + b * b);
};

const mediana = (valores) => {
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.floor(ordenados.length / 2)];
};

// Los puntos del borde de la imagen (su índice): arriba y a los costados, y
// si se pide, abajo.
const puntosDelBorde = (ancho, alto, conElDeAbajo = true) => {
  const puntos = [];
  for (let x = 0; x < ancho; x += 1) puntos.push(x);
  if (conElDeAbajo) for (let x = 0; x < ancho; x += 1) puntos.push((alto - 1) * ancho + x);
  for (let y = 1; y < alto - 1; y += 1) puntos.push(y * ancho, y * ancho + ancho - 1);
  return puntos;
};

// El color del fondo si el borde es liso y claro; si no, null.
export const fondoParejo = (datos, ancho, alto) => {
  if (!datos || ancho < 8 || alto < 8) return null;
  const borde = puntosDelBorde(ancho, alto, false);
  const fondo = [0, 1, 2].map((canal) => mediana(borde.map((punto) => datos[punto * 4 + canal])));
  const luz = 0.299 * fondo[0] + 0.587 * fondo[1] + 0.114 * fondo[2];
  if (luz < CLARO) return null;
  const parejos = borde.filter((punto) => distancia(datos, punto * 4, fondo) <= TOLERANCIA).length;
  return parejos / borde.length >= PAREJO ? fondo : null;
};

// La foto sin el fondo: el fondo que se toca con el borde (de a vecinos,
// para no comerse lo claro del jugador que no llega al borde, como las rayas
// blancas de la camiseta) queda transparente; en el contorno, a medias y
// sin el gris del fondo mezclado. Cambia los datos y devuelve true, o
// devuelve false si la foto no tiene un fondo liso.
export const sacarFondo = (datos, ancho, alto) => {
  const fondo = fondoParejo(datos, ancho, alto);
  if (!fondo) return false;
  const total = ancho * alto;
  const esFondo = new Uint8Array(total);
  const cola = new Int32Array(total);
  let entra = 0;
  let sale = 0;
  puntosDelBorde(ancho, alto).forEach((punto) => {
    if (!esFondo[punto] && distancia(datos, punto * 4, fondo) <= TOLERANCIA) {
      esFondo[punto] = 1;
      cola[entra++] = punto;
    }
  });
  while (sale < entra) {
    const punto = cola[sale++];
    const x = punto % ancho;
    const vecinos = [x > 0 ? punto - 1 : -1, x < ancho - 1 ? punto + 1 : -1, punto - ancho, punto + ancho];
    vecinos.forEach((vecino) => {
      if (vecino < 0 || vecino >= total || esFondo[vecino]) return;
      if (distancia(datos, vecino * 4, fondo) > TOLERANCIA) return;
      esFondo[vecino] = 1;
      cola[entra++] = vecino;
    });
  }
  for (let punto = 0; punto < total; punto += 1) {
    const i = punto * 4;
    if (esFondo[punto]) {
      datos[i + 3] = 0;
      continue;
    }
    // El contorno: los puntos pegados al fondo, a medias según cuánto se
    // parecen al fondo, y con su color sin el gris mezclado.
    const x = punto % ancho;
    const pegado = (x > 0 && esFondo[punto - 1]) || (x < ancho - 1 && esFondo[punto + 1]) || (punto >= ancho && esFondo[punto - ancho]) || (punto + ancho < total && esFondo[punto + ancho]);
    if (!pegado) continue;
    const opaco = Math.min(1, Math.max(0.15, (distancia(datos, i, fondo) - TOLERANCIA) / BORDE_SUAVE));
    for (let canal = 0; canal < 3; canal += 1) {
      datos[i + canal] = Math.max(0, Math.min(255, Math.round((datos[i + canal] - (1 - opaco) * fondo[canal]) / opaco)));
    }
    datos[i + 3] = Math.round(opaco * datos[i + 3]);
  }
  return true;
};
