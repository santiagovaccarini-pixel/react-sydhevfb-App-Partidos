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

// El medio del rectángulo que ocupa un camino (las partes de la figura son
// rectas y curvas con coordenadas absolutas).
const medioDeCamino = (camino) => {
  const numeros = (String(camino).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const xs = numeros.filter((_, i) => i % 2 === 0);
  const ys = numeros.filter((_, i) => i % 2 === 1);
  if (!xs.length || !ys.length) return null;
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

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

// { vista, x, y, campo, codigo } de una lesión, o null si no se sabe dónde
// va (sin parte del cuerpo, o una parte de un brazo o una pierna sin lado).
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

  for (const buscado of buscadosDe(datos, pieza)) {
    for (const vista of vistas) {
      const encontradas = estructurasDe(region, vista).filter((una) => buscado.es(una) && delLado(una));
      if (!encontradas.length) continue;
      const [x, y] = espejar(vista, medioDe(encontradas.flatMap((una) => una.puntos)));
      return { vista, x, y, campo: buscado.campo, codigo: buscado.nombre };
    }
  }
  for (const vista of vistas) {
    const laPieza = dibujoDe(region, vista)?.piezas.find((una) => una.parte === pieza);
    const medio = laPieza && medioDeCamino(laPieza.camino);
    if (!medio) continue;
    const [x, y] = espejar(vista, medio);
    return { vista, x, y, campo: "parte_cuerpo", codigo: parte };
  }
  return null;
};

// Las manchas de unas lesiones, por vista: { frente: [...], espalda: [...] },
// cada una { clave, x, y, cantidad, campo, codigo }; las de un mismo lugar y
// una misma estructura, juntas. Más lesiones, primero.
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
