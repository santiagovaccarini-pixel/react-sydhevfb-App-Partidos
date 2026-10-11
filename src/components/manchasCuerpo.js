import { ANCHO, dibujoDe } from "./siluetaCuerpo.js";
import { estructurasDe } from "./anatomiaCuerpo.js";
import { DE_ESPALDAS_PRIMERO, ESTRUCTURAS } from "../domain/mapaCorporal.js";

// Dónde va cada lesión en el mapa corporal de los reportes: en la vista
// (frente o espalda) y en el punto de la figura (el lienzo de 200 x 440 de
// siluetaCuerpo.js) del músculo, tendón o ligamento lesionado si está
// dibujado (anatomiaCuerpo.js), y si no, en el medio de la parte del cuerpo.
// Con el lado del jugador: de frente, su derecha queda a la izquierda de
// quien mira; de espaldas, a la derecha.

const SOLO_DE_ESPALDAS = ["coluna_lombar"];

// El medio de unos puntos.
const medioDe = (puntos) => [puntos.reduce((suma, [x]) => suma + x, 0) / puntos.length, puntos.reduce((suma, [, y]) => suma + y, 0) / puntos.length];

// El rectángulo que ocupa un camino (las partes de la figura son rectas y
// curvas con coordenadas absolutas): { x0, x1, y0, y1 }.
const cajaDeCamino = (camino) => {
  const numeros = (String(camino).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const xs = numeros.filter((_, i) => i % 2 === 0);
  const ys = numeros.filter((_, i) => i % 2 === 1);
  if (!xs.length || !ys.length) return null;
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

// Cuánto se puede pasar un músculo del alto de la parte lesionada y seguir
// contando (el borde de un músculo que llega a la rodilla, por ejemplo).
const MARGEN_DE_LA_PARTE = 4;

// Lo que se busca dibujado, de lo más chico a lo más grande: el músculo o
// tendón específico, el ligamento y el grupo muscular (sus músculos de esa
// parte, o el grupo si está dibujado entero, como el deltoides).
const buscadosDe = (datos, pieza) => {
  const { musculo, musculo_especifico: especifico, ligamento } = datos;
  const delGrupo = musculo ? ESTRUCTURAS[pieza]?.musculos?.[musculo] || [] : [];
  return [
    especifico && { campo: "musculo_especifico", nombre: especifico, es: (una) => una.campo === "musculo_especifico" && una.codigo === especifico },
    ligamento && { campo: "ligamento", nombre: ligamento, es: (una) => una.campo === "ligamento" && una.codigo === ligamento },
    musculo && {
      campo: "musculo",
      nombre: musculo,
      es: (una) => (una.campo === "musculo" && una.codigo === musculo) || (una.campo === "musculo_especifico" && delGrupo.includes(una.codigo)),
    },
  ].filter(Boolean);
};

// { vista, x, y, campo, codigo, pintar } de una lesión, o null si no se sabe
// dónde va (sin parte del cuerpo, o una parte de un brazo o una pierna sin
// lado). pintar: lo que se pinta en el mapa (Santiago, 11/10: solo lo
// lesionado): { formas: [camino] (el músculo, tendón o ligamento, o la parte),
// parte: el camino de la parte lesionada (nada pasa de ahí), espejada: si van
// espejados como su región, mitad: "izquierda"/"derecha" en el tronco y la
// cabeza sin músculo, la mitad del lado del jugador }.
// mapa: el del club (crearMapa).
export const dondeVa = (lesion, mapa) => {
  const datos = lesion?.datos || {};
  const parte = datos.parte_cuerpo;
  if (!parte) return null;
  const lado = datos.lado;
  const region = mapa.regionDe(parte, lado);
  if (!region) return null;
  const pieza = mapa.piezaDe(parte, region) || parte;
  const primera = SOLO_DE_ESPALDAS.includes(pieza) || (DE_ESPALDAS_PRIMERO[pieza] || []).includes(datos.musculo) ? "espalda" : "frente";
  const vistas = primera === "espalda" ? ["espalda", "frente"] : ["frente", "espalda"];
  const espejar = (vista, [x, y]) => (dibujoDe(region, vista)?.espejada ? [ANCHO - x, y] : [x, y]);
  // En el tronco cada mitad tiene su lado; lo del medio, ninguno.
  const delLado = (una) => !una.lado || !["direito", "esquerdo"].includes(lado) || una.lado === lado;

  // La parte lesionada en cada vista (sin espejar, como están dibujadas).
  const piezaEn = (vista) => dibujoDe(region, vista)?.piezas.find((una) => una.parte === pieza) || null;
  const cajaDeLaParte = (vista) => {
    const laPieza = piezaEn(vista);
    return laPieza ? cajaDeCamino(laPieza.camino) : null;
  };
  const conQuePintar = (vista, formas, mitad = null) => ({ formas, parte: piezaEn(vista)?.camino || null, espejada: Boolean(dibujoDe(region, vista)?.espejada), mitad });
  // El medio de la parte; en el tronco y la cabeza (que no tienen lado),
  // corrido a la mitad del lado del jugador.
  const medioDeLaParte = (vista, caja) => {
    let x = (caja.x0 + caja.x1) / 2;
    if (!dibujoDe(region, vista)?.espejada && !region.includes("_") && ["direito", "esquerdo"].includes(lado)) {
      const aLaIzquierda = (lado === "direito") === (vista === "frente");
      x = aLaIzquierda ? (caja.x0 + ANCHO / 2) / 2 : (ANCHO / 2 + caja.x1) / 2;
    }
    return [x, (caja.y0 + caja.y1) / 2];
  };

  for (const buscado of buscadosDe(datos, pieza)) {
    for (const vista of vistas) {
      const encontradas = estructurasDe(region, vista).filter((una) => buscado.es(una) && delLado(una));
      if (!encontradas.length) continue;
      // Solo lo que cae en la parte lesionada: un isquiotibial cargado en la
      // rodilla va en la rodilla, no en el medio del muslo.
      const caja = cajaDeLaParte(vista);
      const puntos = encontradas.flatMap((una) => una.puntos);
      const enLaParte = caja ? puntos.filter(([, y]) => y >= caja.y0 - MARGEN_DE_LA_PARTE && y <= caja.y1 + MARGEN_DE_LA_PARTE) : puntos;
      const [x, y] = espejar(vista, enLaParte.length >= 3 ? medioDe(enLaParte) : caja ? medioDeLaParte(vista, caja) : medioDe(puntos));
      return { vista, x, y, campo: buscado.campo, codigo: buscado.nombre, pintar: conQuePintar(vista, encontradas.map((una) => una.camino)) };
    }
  }
  for (const vista of vistas) {
    const caja = cajaDeLaParte(vista);
    if (!caja) continue;
    const [x, y] = espejar(vista, medioDeLaParte(vista, caja));
    // En el tronco y la cabeza (sin lado propio), la mitad del lado del jugador.
    const conMitad = !dibujoDe(region, vista)?.espejada && !region.includes("_") && ["direito", "esquerdo"].includes(lado);
    const mitad = conMitad ? ((lado === "direito") === (vista === "frente") ? "izquierda" : "derecha") : null;
    return { vista, x, y, campo: "parte_cuerpo", codigo: parte, pintar: conQuePintar(vista, [piezaEn(vista).camino], mitad) };
  }
  return null;
};

// Las manchas de unas lesiones, por vista: { frente: [...], espalda: [...] },
// cada una { clave, x, y, cantidad, campo, codigo, pintar }; las de un mismo
// lugar y una misma estructura, juntas. Más lesiones, primero.
export const manchasDe = (lesiones, mapa) => {
  const juntas = new Map();
  lesiones.forEach((lesion) => {
    const donde = dondeVa(lesion, mapa);
    if (!donde) return;
    const clave = `${donde.vista}:${Math.round(donde.x)}:${Math.round(donde.y)}:${donde.campo}:${donde.codigo}`;
    const ya = juntas.get(clave);
    if (ya) ya.cantidad += 1;
    else juntas.set(clave, { clave, ...donde, cantidad: 1 });
  });
  const todas = [...juntas.values()].sort((a, b) => b.cantidad - a.cantidad || a.y - b.y);
  return {
    frente: todas.filter((mancha) => mancha.vista === "frente"),
    espalda: todas.filter((mancha) => mancha.vista === "espalda"),
  };
};
