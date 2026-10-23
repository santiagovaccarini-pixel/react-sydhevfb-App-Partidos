// La fila de espera de GPS (paso 3c de la nota «cargar sin señal y a la vez
// que otra persona»; Santiago, 23/10, en un cuestionario: sin señal se puede
// «Cambiar y borrar en la Base», «Cargar un día», «Pegar desde una planilla»
// y «Valores de referencia»; lo demás, como en Evaluaciones y Lesiones: lo
// que espera, con un aviso arriba y las filas «de otro color»; al volver la
// señal «Lo sube sola y avisa»). Va por partes; la 3c.1: cambiar celdas y
// borrar filas de la Base. Acá, sin pantalla: qué queda en la cola con cada
// cosa que se hace, cómo se ve lo que espera y cómo se sube.
//
// Las filas de la pantalla siguen siendo las de la base (y su copia del
// aparato, copiaGps.js); lo que espera se pone encima para mirarlo. Así, al
// poner al día con la base (ponerAlDiaGps), las cuentas dan.
//
// Cada elemento de la cola es un cambio, en el orden en que se hizo:
//   · { tipo: "cambiar", id, cambios, antes } (como gps_cambiar, 20261116)
//   · { tipo: "borrar", id }
import { datosConCambio } from "./valores.js";

// Los cambios (gps_cambiar) sobre una fila, como los junta la base: en datos,
// null o "" borra el dato; el «por minuto» de lo cambiado se recalcula con lo
// que quedó (y todos, si cambió el Tiempo).
export const conLosCambios = (fila, cambios = {}) =>
  Object.entries(cambios).reduce((nueva, [clave, valor]) => {
    if (clave.startsWith("datos.")) return { ...nueva, datos: datosConCambio(nueva.datos || {}, clave.slice(6), valor ?? null) };
    return { ...nueva, [clave]: valor ?? null };
  }, { ...fila, datos: { ...(fila?.datos || {}) } });

// ------------------------------------------------- Lo que entra en la cola --

// Un cambio, junto con los que ya esperaban para esa fila (lo que se veía
// antes del primero queda: así, al subir, se sabe si otra persona la cambió).
export const conCambio = (cola, { id, cambios = {}, antes = {} }) => {
  if (!Object.keys(cambios).length) return cola;
  const ya = cola.find((uno) => uno.tipo === "cambiar" && uno.id === id);
  if (!ya) return [...cola, { tipo: "cambiar", id, cambios: { ...cambios }, antes: { ...antes } }];
  return cola.map((uno) => (uno === ya ? { ...uno, cambios: { ...uno.cambios, ...cambios }, antes: { ...antes, ...uno.antes } } : uno));
};

// Borrar: lo que esperaba para esa fila ya no hace falta.
export const conBorradas = (cola, ids = []) => {
  const nuevas = new Set(ids);
  const yaEsperan = new Set(cola.filter((uno) => uno.tipo === "borrar").map((uno) => uno.id));
  return [
    ...cola.filter((uno) => !(uno.tipo === "cambiar" && nuevas.has(uno.id))),
    ...[...nuevas].filter((id) => !yaEsperan.has(id)).map((id) => ({ tipo: "borrar", id })),
  ];
};

// ------------------------------------------------------ Cómo se ve con ella --

// Las filas con lo que espera encima. Se puede aplicar más de una vez: da lo
// mismo. Sin nada esperando, las mismas filas (son miles: no se copian).
export const conLoQueEspera = (filas = [], cola = []) => {
  if (!cola.length) return filas;
  const cambios = new Map(cola.filter((uno) => uno.tipo === "cambiar").map((uno) => [uno.id, uno.cambios]));
  const borradas = new Set(cola.filter((uno) => uno.tipo === "borrar").map((uno) => uno.id));
  return filas.filter((fila) => !borradas.has(fila.id)).map((fila) => (cambios.has(fila.id) ? conLosCambios(fila, cambios.get(fila.id)) : fila));
};

// Las filas que esperan (para pintarlas): las cambiadas.
export const idsEnEspera = (cola = []) => new Set(cola.filter((uno) => uno.tipo === "cambiar").map((uno) => uno.id));

// ------------------------------------------------------------- Al subirla --

// Sube lo que espera, en orden, con las funciones de la base (las de
// gpsDb.js; se reciben para probarlas sin la base): los borrados seguidos,
// juntos (borrarFilasGps). filaDe(id): la fila como está en la pantalla, para
// cambiarla entera si la base no tiene la actualización 20261116. Si otra
// persona borró una fila que se cambió, se cuenta (borradasPorOtra). Sin señal
// en el camino, se corta: lo que falta queda. Un error de la base (sin
// permiso, otra regla) no se reintenta: va en errores ({ error, ids }) y sale
// de la cola. devueltas: las filas como quedaron en la base; borradas: los
// id que ya no están (para que la pantalla no espere a ponerse al día).
export const subirLaEspera = async (cola, { funciones, filaDe = () => null, esDeRed }) => {
  const { cambiar, actualizar, borrar } = funciones;
  const quedan = [];
  const resultado = { subidos: 0, pisadas: [], borradasPorOtra: 0, errores: [], cortado: false, devueltas: [], borradas: [] };
  for (let i = 0; i < cola.length; ) {
    if (resultado.cortado) {
      quedan.push(...cola.slice(i));
      break;
    }
    const uno = cola[i];
    if (uno.tipo === "borrar") {
      let fin = i;
      while (fin < cola.length && cola[fin].tipo === "borrar") fin += 1;
      const grupo = cola.slice(i, fin);
      i = fin;
      const respuesta = await borrar(grupo.map((otro) => otro.id)); // eslint-disable-line no-await-in-loop
      // Las que la base no devolvió ya no estaban (otra persona las borró) o
      // no se pueden borrar: con error, se dice; sin error, ya no están.
      const hechas = new Set(respuesta.borradas || []);
      if (!respuesta.error) {
        resultado.subidos += grupo.length;
        resultado.borradas.push(...grupo.map((otro) => otro.id));
        continue;
      }
      resultado.borradas.push(...hechas);
      resultado.subidos += hechas.size;
      const faltan = grupo.filter((otro) => !hechas.has(otro.id));
      if (esDeRed(respuesta)) {
        resultado.cortado = true;
        quedan.push(...faltan);
      } else resultado.errores.push({ error: respuesta.error, ids: faltan.map((otro) => otro.id) });
      continue;
    }
    i += 1;
    if (uno.tipo !== "cambiar") continue;
    let respuesta = await cambiar(uno.id, { cambios: uno.cambios, antes: uno.antes }); // eslint-disable-line no-await-in-loop
    if (respuesta.sinFuncion) {
      const fila = filaDe(uno.id);
      respuesta = fila ? await actualizar(uno.id, conLosCambios(fila, uno.cambios)) : { borrada: true, error: "" }; // eslint-disable-line no-await-in-loop
    }
    if (respuesta.borrada) {
      resultado.borradasPorOtra += 1;
      resultado.borradas.push(uno.id);
      continue;
    }
    if (!respuesta.error) {
      resultado.subidos += 1;
      if (respuesta.fila?.id) resultado.devueltas.push(respuesta.fila);
      resultado.pisadas.push(...(respuesta.pisadas || []).map((pisada) => ({ ...pisada, id: uno.id })));
    } else if (esDeRed(respuesta)) {
      resultado.cortado = true;
      quedan.push(uno);
    } else resultado.errores.push({ error: respuesta.error, ids: [uno.id] });
  }
  return { ...resultado, quedan };
};

// La cola después de subir, con lo que se hizo mientras se subía (ahora: la
// cola de ese momento; enviada: la que se subió): lo que ya se subió (o la
// base no dejó) sale; lo demás queda, en orden.
export const conLoHechoMientras = (ahora, { enviada = [], quedan = [] }) => {
  const hechos = new Set(enviada.filter((uno) => !quedan.includes(uno)));
  return ahora.filter((uno) => !hechos.has(uno));
};
