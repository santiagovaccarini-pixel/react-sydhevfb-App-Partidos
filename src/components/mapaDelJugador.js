import { ZONAS } from "./zonasDeLaFigura.js";
import { diasPerdidos } from "../domain/reportes.js";

// Las cuentas del mapa corporal del reporte individual (Santiago, 23/10: la
// figura del reporte oscuro «MAPA CORPORAL DE LESIONES», donde se tocan las
// zonas y se ve su detalle, su historial y el tipo de lesión).
//
// Una zona es el músculo de la lesión si está dibujado; si no, la parte del
// cuerpo (como pinta el mapa de hoy). Los dos lados van juntos: el calor se
// pinta en el lado lesionado y el historial dice el lado de cada una.

const ZONA_POR_CLAVE = new Map(ZONAS.map((zona) => [`${zona.campo}:${zona.codigo}`, zona]));
export const claveDeZona = (zona) => (zona ? `${zona.campo}:${zona.codigo}` : "");
export const zonaPorClave = (clave) => ZONA_POR_CLAVE.get(clave) || null;

// La zona de una lesión: { campo, codigo, formas } o null si no hay dónde.
export const zonaDeLesion = (lesion) => {
  const datos = lesion?.datos || {};
  return ZONA_POR_CLAVE.get(`musculo:${datos.musculo}`) || ZONA_POR_CLAVE.get(`parte_cuerpo:${datos.parte_cuerpo}`) || null;
};

// Las familias de la dona «Tipo de lesión», como en la foto (muscular,
// tendinosa, articular, otras), más la ósea; lo que el club agregó, en Otras.
export const FAMILIAS = ["muscular", "tendinosa", "articular", "osea", "otras"];
const FAMILIA_DE_TIPO = {
  muscular_1a: "muscular",
  muscular_1b: "muscular",
  muscular_1c: "muscular",
  muscular_2a: "muscular",
  muscular_2b: "muscular",
  muscular_2c: "muscular",
  muscular_3a: "muscular",
  muscular_3b: "muscular",
  muscular_3c: "muscular",
  sobrecarga_caibra: "muscular",
  tendinea: "tendinosa",
  entorse: "articular",
  luxacao: "articular",
  meniscal: "articular",
  fratura: "osea",
  osseas: "osea",
  edema_osseo: "osea",
  avulsao: "osea",
};
export const familiaDeTipo = (codigo) => FAMILIA_DE_TIPO[codigo] || "otras";

// El lado de una lesión en el mapa: "direito", "esquerdo" o null (sin lado o
// «No se aplica»: se pintan los dos).
export const ladoDeLesion = (lesion) => {
  const lado = lesion?.datos?.lado;
  return lado === "direito" || lado === "esquerdo" ? lado : null;
};

// Todo lo del mapa de unas lesiones (ya filtradas por el período):
// { zonas: Map(clave → { zona, lesiones, cantidad, dias, porLado: { direito,
// esquerdo, ambos } }), tipos: [{ familia, cantidad, porcentaje }], sinZona,
// maximo (la zona y el lado con más) }.
export const resumenDelMapa = (lesiones, hoy) => {
  const zonas = new Map();
  let sinZona = 0;
  (lesiones || []).forEach((lesion) => {
    const zona = zonaDeLesion(lesion);
    if (!zona) {
      sinZona += 1;
      return;
    }
    const clave = claveDeZona(zona);
    const ya = zonas.get(clave) || { zona, lesiones: [], cantidad: 0, dias: 0, porLado: { direito: 0, esquerdo: 0, ambos: 0 } };
    ya.lesiones.push(lesion);
    ya.cantidad += 1;
    ya.dias += diasPerdidos(lesion, hoy);
    ya.porLado[ladoDeLesion(lesion) || "ambos"] += 1;
    zonas.set(clave, ya);
  });
  // Lo que se pinta en un lado: las de ese lado y las que no tienen.
  const maximo = Math.max(0, ...[...zonas.values()].flatMap(({ porLado }) => [porLado.direito + porLado.ambos, porLado.esquerdo + porLado.ambos]));
  const total = (lesiones || []).length;
  const tipos = FAMILIAS.map((familia) => {
    const cantidad = (lesiones || []).filter((lesion) => familiaDeTipo(lesion?.datos?.tipo_lesion) === familia).length;
    return { familia, cantidad, porcentaje: total ? (cantidad / total) * 100 : 0 };
  }).filter((tipo) => tipo.cantidad > 0);
  return { zonas, tipos, sinZona, maximo };
};

// La zona con más lesiones (la que se ve al abrir); a igual cantidad, la de
// más días perdidos y después el orden de ZONAS.
export const zonaConMas = (zonas) => {
  let mejor = null;
  ZONAS.forEach((zona) => {
    const datos = zonas.get(claveDeZona(zona));
    if (!datos) return;
    if (!mejor || datos.cantidad > mejor.cantidad || (datos.cantidad === mejor.cantidad && datos.dias > mejor.dias)) mejor = datos;
  });
  return mejor ? claveDeZona(mejor.zona) : "";
};

// Lo más afectado de una zona: lo más preciso que se cargó de cada lesión
// (el músculo específico, el ligamento o el músculo; en una parte sin nada
// de eso, no cuenta), de más a menos: [{ campo, codigo, cantidad }].
export const masAfectadosDe = (lesiones) => {
  const cuentas = new Map();
  (lesiones || []).forEach((lesion) => {
    const datos = lesion?.datos || {};
    const campo = ["musculo_especifico", "ligamento", "musculo"].find((uno) => datos[uno]);
    if (!campo) return;
    const clave = `${campo}:${datos[campo]}`;
    const ya = cuentas.get(clave) || { campo, codigo: datos[campo], cantidad: 0 };
    ya.cantidad += 1;
    cuentas.set(clave, ya);
  });
  return [...cuentas.values()].sort((a, b) => b.cantidad - a.cantidad);
};

// Lo que dice la columna «Músculo» del historial de la zona: lo más preciso
// que tenga la lesión (o nada).
export const estructuraDe = (lesion) => {
  const datos = lesion?.datos || {};
  const campo = ["musculo_especifico", "ligamento", "musculo"].find((uno) => datos[uno]);
  return campo ? { campo, codigo: datos[campo] } : null;
};
