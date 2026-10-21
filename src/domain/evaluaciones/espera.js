// La fila de espera de Evaluaciones (paso 3 de la nota «cargar sin señal y a
// la vez que otra persona»; Santiago, 21/10, en un cuestionario: sin señal se
// puede «Cargar, cambiar y borrar», «Pegar desde Excel» y «Valores de
// referencia»; lo que espera, con un aviso arriba y las filas «de otro
// color»; al volver la señal «Lo sube sola y avisa»; si una choca con otra
// que cargó otra persona, «Espera y te pregunta»). Acá, sin pantalla: qué
// queda en la cola con cada cosa que se hace y cómo se ve lo que espera.
//
// Cada elemento de la cola es un cambio, en el orden en que se hizo:
//   · { tipo: "crear", id: "local:…", test, evaluacion: { jugador_id, persona, fecha, datos }, chocan? }
//   · { tipo: "cambiar", id, cambios, antes } (como evaluaciones_cambiar, 20261114)
//   · { tipo: "borrar", id }
//   · { tipo: "referencia", test, ruta, valor } (como cambiarReferencia)
// Una cargada sin señal tiene un id propio («local:…») hasta que sube: lo que
// se le cambia queda en su «crear» y, si se borra, sale de la cola.

const PREFIJO_LOCAL = "local:";

export const esLocal = (id) => String(id ?? "").startsWith(PREFIJO_LOCAL);

let vez = 0;
export const nuevoIdLocal = () => {
  vez += 1;
  const azar = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${PREFIJO_LOCAL}${azar}-${vez}`;
};

const copia = (valor) => (valor === undefined ? undefined : JSON.parse(JSON.stringify(valor)));

// Los cambios (evaluaciones_cambiar) sobre una evaluación, como los aplica la
// base: en datos, null o "" borra el dato.
export const conLosCambios = (evaluacion, cambios = {}) => {
  const datos = { ...(evaluacion?.datos || {}) };
  const nueva = { ...evaluacion, datos };
  Object.entries(cambios).forEach(([clave, valor]) => {
    if (clave.startsWith("datos.")) {
      const dato = clave.slice(6);
      if (valor === null || valor === undefined || valor === "") delete datos[dato];
      else datos[dato] = valor;
    } else nueva[clave] = valor ?? null;
  });
  return nueva;
};

// Un valor en un lugar de los V.R. (como evaluaciones_referencia_cambiar):
// null lo saca.
export const conValorEnRuta = (datos, ruta = [], valor) => {
  const nuevos = copia(datos && typeof datos === "object" ? datos : {}) || {};
  if (!ruta.length) return nuevos;
  let lugar = nuevos;
  ruta.slice(0, -1).forEach((parte) => {
    if (!lugar[parte] || typeof lugar[parte] !== "object" || Array.isArray(lugar[parte])) lugar[parte] = {};
    lugar = lugar[parte];
  });
  const ultima = ruta[ruta.length - 1];
  if (valor === null || valor === undefined) delete lugar[ultima];
  else lugar[ultima] = copia(valor);
  return nuevos;
};

// ------------------------------------------------- Lo que entra en la cola --

// Las nuevas de un test: [{ evaluacion }] → los elementos (con su id propio).
export const conCreadas = (cola, test, evaluaciones = []) => [
  ...cola,
  ...evaluaciones.map((evaluacion) => ({ tipo: "crear", id: nuevoIdLocal(), test, evaluacion: copia(evaluacion) })),
];

// Un cambio: a una que espera para cargarse, en su «crear»; a una de la
// base, junto con los que ya esperaban para ella (lo que se veía antes del
// primero queda: así, al subir, se sabe si otra persona la cambió).
export const conCambio = (cola, { id, cambios = {}, antes = {} }) => {
  if (!Object.keys(cambios).length) return cola;
  if (esLocal(id)) {
    return cola.map((uno) => (uno.tipo === "crear" && uno.id === id ? { ...uno, evaluacion: conLosCambios(uno.evaluacion, cambios), chocan: false } : uno));
  }
  const ya = cola.find((uno) => uno.tipo === "cambiar" && uno.id === id);
  if (!ya) return [...cola, { tipo: "cambiar", id, cambios: { ...cambios }, antes: { ...antes } }];
  return cola.map((uno) => (uno === ya ? { ...uno, cambios: { ...uno.cambios, ...cambios }, antes: { ...antes, ...uno.antes } } : uno));
};

// Borrar: una que espera para cargarse, sale de la cola; una de la base, se
// borra al subir (lo que esperaba para ella ya no hace falta).
export const conBorrada = (cola, id) => {
  if (esLocal(id)) return cola.filter((uno) => !(uno.tipo === "crear" && uno.id === id));
  return [...cola.filter((uno) => !(uno.tipo === "cambiar" && uno.id === id)), { tipo: "borrar", id }];
};

// Un valor de los V.R.: el mismo lugar cambiado otra vez, queda el último.
export const conReferencia = (cola, { test, ruta = [], valor }) => {
  const mismo = (uno) => uno.tipo === "referencia" && uno.test === test && JSON.stringify(uno.ruta) === JSON.stringify(ruta);
  return [...cola.filter((uno) => !mismo(uno)), { tipo: "referencia", test, ruta: [...ruta], valor: copia(valor) ?? null }];
};

// ------------------------------------------------------ Cómo se ve con ella --

// Las evaluaciones y los V.R. ({ [test]: datos }) con lo que espera encima,
// en orden: lo que se ve sin señal (la copia + la cola) y con señal hasta
// que sube.
export const conLoQueEspera = ({ evaluaciones = [], referencias = {} } = {}, cola = []) => {
  let lista = [...evaluaciones];
  let vrs = { ...referencias };
  let orden = lista.reduce((mayor, una) => Math.max(mayor, Number(una.orden) || 0), 0);
  cola.forEach((uno) => {
    if (uno.tipo === "crear") {
      orden += 1;
      lista = [...lista.filter((una) => una.id !== uno.id), { ...copia(uno.evaluacion), id: uno.id, test: uno.test, orden, persona: uno.evaluacion?.persona ?? null }];
    } else if (uno.tipo === "cambiar") {
      lista = lista.map((una) => (una.id === uno.id ? conLosCambios(una, uno.cambios) : una));
    } else if (uno.tipo === "borrar") {
      lista = lista.filter((una) => una.id !== uno.id);
    } else if (uno.tipo === "referencia") {
      vrs = { ...vrs, [uno.test]: conValorEnRuta(vrs[uno.test], uno.ruta, uno.valor) };
    }
  });
  return { evaluaciones: lista, referencias: vrs };
};

// Las filas que esperan (para pintarlas): las cargadas y las cambiadas.
export const idsEnEspera = (cola = []) => new Set(cola.filter((uno) => uno.tipo === "crear" || uno.tipo === "cambiar").map((uno) => uno.id));

// ------------------------------------------------------------- Al subirla --

// Sube lo que espera, en orden, con las funciones de la base (las de
// evaluacionesDb.js; se reciben para probarlas sin la base). servidor: las
// evaluaciones como están ahora en la base (para la Regla 1). Las nuevas de
// un mismo test, seguidas, van juntas (evaluaciones_guardar, 20261113); la que
// choca con otra del mismo jugador y día con otros datos no sube: queda con
// chocan y vuelve en chocadas, para preguntar («Espera y te pregunta»). Las
// que ya chocaron no se intentan solas (conChocadas, cuando se pide de nuevo).
// Sin señal en el camino, se corta: lo que falta queda. Un error de la base
// (sin permiso, otra regla) no se reintenta: va en errores y sale de la cola.
export const subirLaEspera = async (cola, { equipoId, servidor = [], funciones, esDeRed, conChocadas = false, conOtrosDatos }) => {
  const { guardar, crear, cambiar, actualizar, borrar, referencia } = funciones;
  const quedan = [];
  const resultado = { subidos: 0, pisadas: [], borradasPorOtra: 0, errores: [], chocadas: [], cortado: false };
  const fallo = (respuesta, pendientes) => {
    if (esDeRed(respuesta)) {
      resultado.cortado = true;
      quedan.push(...pendientes);
    } else resultado.errores.push(respuesta.error);
  };
  for (let i = 0; i < cola.length; ) {
    if (resultado.cortado) {
      quedan.push(...cola.slice(i));
      break;
    }
    const uno = cola[i];
    if (uno.tipo === "crear") {
      let fin = i;
      while (fin < cola.length && cola[fin].tipo === "crear" && cola[fin].test === uno.test) fin += 1;
      const grupo = cola.slice(i, fin);
      i = fin;
      const pendientes = grupo.filter((nueva) => conChocadas || !nueva.chocan);
      quedan.push(...grupo.filter((nueva) => !pendientes.includes(nueva)));
      const choques = conOtrosDatos(
        pendientes.map((nueva) => nueva.evaluacion),
        servidor.filter((una) => una.test === uno.test),
      );
      const conflictivas = pendientes.filter((nueva) => choques.some((choque) => choque.evaluacion === nueva.evaluacion));
      conflictivas.forEach((nueva) => {
        quedan.push({ ...nueva, chocan: true });
        resultado.chocadas.push({ ...nueva, chocan: true, existentes: choques.find((choque) => choque.evaluacion === nueva.evaluacion).existentes });
      });
      const libres = pendientes.filter((nueva) => !conflictivas.includes(nueva));
      if (!libres.length) continue;
      const respuesta = await guardar(equipoId, uno.test, { evaluaciones: libres.map((nueva) => nueva.evaluacion) }); // eslint-disable-line no-await-in-loop
      if (respuesta.sinFuncion) {
        for (const [n, nueva] of libres.entries()) {
          const una = await crear(equipoId, uno.test, nueva.evaluacion); // eslint-disable-line no-await-in-loop
          if (!una.error) resultado.subidos += 1;
          else if (esDeRed(una)) {
            resultado.cortado = true;
            quedan.push(...libres.slice(n));
            break;
          } else resultado.errores.push(una.error);
        }
      } else if (respuesta.conOtras) {
        // Otra persona cargó esos días mientras se subía: se vuelven a
        // revisar la próxima vez, con lo de ese momento.
        quedan.push(...libres);
      } else if (respuesta.error) fallo(respuesta, libres);
      else resultado.subidos += libres.length;
      continue;
    }
    i += 1;
    let respuesta;
    if (uno.tipo === "cambiar") {
      respuesta = await cambiar(uno.id, { cambios: uno.cambios, antes: uno.antes }); // eslint-disable-line no-await-in-loop
      if (respuesta.sinFuncion) {
        const enLaBase = servidor.find((una) => una.id === uno.id);
        respuesta = enLaBase ? await actualizar(uno.id, conLosCambios(enLaBase, uno.cambios)) : { borrada: true, error: "" }; // eslint-disable-line no-await-in-loop
      }
      if (respuesta.borrada) {
        resultado.borradasPorOtra += 1;
        continue;
      }
      if (!respuesta.error) resultado.pisadas.push(...(respuesta.pisadas || []).map((pisada) => ({ ...pisada, id: uno.id })));
    } else if (uno.tipo === "borrar") {
      respuesta = await borrar(uno.id); // eslint-disable-line no-await-in-loop
    } else if (uno.tipo === "referencia") {
      respuesta = await referencia(equipoId, uno.test, uno.ruta, uno.valor); // eslint-disable-line no-await-in-loop
    } else continue;
    if (respuesta.error) fallo(respuesta, [uno]);
    else resultado.subidos += 1;
  }
  return { ...resultado, quedan };
};
