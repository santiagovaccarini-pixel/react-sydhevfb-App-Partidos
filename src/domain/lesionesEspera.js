// La fila de espera de Lesiones (paso 3b de la nota «cargar sin señal y a la
// vez que otra persona»; Santiago, 21/10, en un cuestionario: sin señal se
// puede «Cargar, cambiar y borrar», «Dar el alta» y «Pegar desde Excel»; lo
// demás, como en Evaluaciones: lo que espera, con un aviso arriba y las filas
// «de otro color»; al volver la señal «Lo sube sola y avisa»). Acá, sin
// pantalla: qué queda en la cola con cada cosa que se hace, cómo se ve lo
// que espera y cómo se sube. Lo que vale igual para las dos bases sale de
// evaluaciones/espera.js. Dos diferencias, de Santiago el 21/10:
//   · Una nueva que otra persona ya cargó (la misma lesión: el mismo jugador
//     o persona, parte del cuerpo, lado y fecha de inicio; la regla de la
//     base, lesiones_sin_repetir) no se pregunta: «Si es la misma tiene que
//     avisar y descartar».
//   · El N° de caso: «El Nº de caso se ordena por fecha de incio de
//     lesiones», y eligió «Las nuevas, después del último»: al subir, las
//     nuevas toman los N° que siguen al último de la Base, de la fecha de
//     inicio más vieja a la más nueva (las sin fecha, al final). Los N° que ya
//     están no cambian. Un N° pegado del Excel queda si está libre; si no,
//     toma el que le toca por su fecha.
//
// Cada elemento de la cola es un cambio, en el orden en que se hizo:
//   · { tipo: "crear", id: "local:…", lesion } (sin id; numero_caso, el que
//     trajo el Excel o null)
//   · { tipo: "cambiar", id, cambios, antes } (como lesiones_cambiar, 20261115)
//   · { tipo: "borrar", id }
// Una cargada sin señal tiene un id propio («local:…») hasta que sube: lo que
// se le cambia queda en su «crear» y, si se borra, sale de la cola.
import { conLosCambios, esLocal, nuevoIdLocal } from "./evaluaciones/espera.js";

export { esLocal };

// Las claves de los errores de la base (lesiones.js, claveDeErrorDeBase).
const REPETIDA = "lesiones.error.repetida";
const CASO_OCUPADO = "lesiones.importar.casoOcupado";

const copia = (valor) => JSON.parse(JSON.stringify(valor));

// ------------------------------------------------- Lo que entra en la cola --

// Las nuevas: [lesion] → los elementos (con su id propio).
export const conCreadas = (cola, lesiones = []) => [
  ...cola,
  ...lesiones.map((lesion) => {
    const { id: _, ...sinId } = lesion || {};
    return { tipo: "crear", id: nuevoIdLocal(), lesion: copia({ ...sinId, numero_caso: sinId.numero_caso ?? null }) };
  }),
];

// Un cambio: a una que espera para cargarse, en su «crear»; a una de la
// base, junto con los que ya esperaban para ella (lo que se veía antes del
// primero queda: así, al subir, se sabe si otra persona la cambió).
export const conCambio = (cola, { id, cambios = {}, antes = {} }) => {
  if (!Object.keys(cambios).length) return cola;
  if (esLocal(id)) return cola.map((uno) => (uno.tipo === "crear" && uno.id === id ? { ...uno, lesion: conLosCambios(uno.lesion, cambios) } : uno));
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

// ------------------------------------------------------ Cómo se ve con ella --

// Las lesiones con lo que espera encima, en orden: lo que se ve sin señal (la
// copia + la cola) y con señal hasta que sube. Se puede aplicar más de una
// vez: da lo mismo.
export const conLoQueEspera = (lesiones = [], cola = []) => {
  let lista = [...lesiones];
  cola.forEach((uno) => {
    if (uno.tipo === "crear") lista = [...lista.filter((una) => una.id !== uno.id), { ...copia(uno.lesion), id: uno.id }];
    else if (uno.tipo === "cambiar") lista = lista.map((una) => (una.id === uno.id ? conLosCambios(una, uno.cambios) : una));
    else if (uno.tipo === "borrar") lista = lista.filter((una) => una.id !== uno.id);
  });
  return lista;
};

// Las que esperan (para pintarlas): las cargadas y las cambiadas.
export const idsEnEspera = (cola = []) => new Set(cola.filter((uno) => uno.tipo === "crear" || uno.tipo === "cambiar").map((uno) => uno.id));

// ------------------------------------------------------------- Al subirla --

// El N° de caso de cada nueva ({ id local: N° }), con lo que hay en la base
// (servidor): el del Excel si está libre; las demás, después del último (de
// la base y de los del Excel que quedan), por fecha de inicio.
export const numerosDeCaso = (cola = [], servidor = []) => {
  const nuevas = cola.filter((uno) => uno.tipo === "crear");
  const ocupados = new Set(servidor.map((una) => Number(una.numero_caso)).filter((numero) => Number.isInteger(numero) && numero > 0));
  const numeros = new Map();
  nuevas.forEach((uno) => {
    const delExcel = Number(uno.lesion?.numero_caso);
    if (!Number.isInteger(delExcel) || delExcel <= 0 || ocupados.has(delExcel)) return;
    ocupados.add(delExcel);
    numeros.set(uno.id, delExcel);
  });
  let siguiente = Math.max(0, ...ocupados) + 1;
  const fecha = (uno) => uno.lesion?.fecha_lesion || "";
  nuevas
    .filter((uno) => !numeros.has(uno.id))
    .map((uno, orden) => ({ uno, orden }))
    .sort((a, b) => Number(!fecha(a.uno)) - Number(!fecha(b.uno)) || fecha(a.uno).localeCompare(fecha(b.uno)) || a.orden - b.orden)
    .forEach(({ uno }) => {
      numeros.set(uno.id, siguiente);
      siguiente += 1;
    });
  return numeros;
};

// Sube lo que espera, en orden, con las funciones de la base (las de
// lesionesDb.js; se reciben para probarlas sin la base): crear es
// importarLesion (con el N° de caso). servidor: las lesiones como están ahora
// en la base (para los N° de caso y, sin la actualización 20261115, para
// cambiar la lesión entera). Una nueva que otra persona ya cargó se descarta
// y vuelve en repetidas ({ id, lesion }), para avisar. Si otra persona tomó
// su N° mientras se subía, toma el que sigue (lo pone la base). Sin señal en
// el camino, se corta: lo que falta queda. Un error de la base (sin permiso,
// otra regla) no se reintenta: va en errores ({ error, lesion }: la lesión
// como iba a quedar, para decir cuál es) y sale de la cola. nuevas: las que
// subieron ({ id local: la lesión de la base }).
export const subirLaEspera = async (cola, { equipoId, servidor = [], funciones, esDeRed }) => {
  const { crear, cambiar, actualizar, borrar } = funciones;
  const numeros = numerosDeCaso(cola, servidor);
  const quedan = [];
  const resultado = { subidos: 0, pisadas: [], borradasPorOtra: 0, repetidas: [], errores: [], cortado: false, nuevas: {} };
  for (const uno of cola) {
    if (resultado.cortado) {
      quedan.push(uno);
      continue;
    }
    let respuesta;
    if (uno.tipo === "crear") {
      const lesion = { ...uno.lesion, numero_caso: numeros.get(uno.id) ?? null };
      respuesta = await crear(equipoId, lesion); // eslint-disable-line no-await-in-loop
      if (respuesta.error === CASO_OCUPADO) respuesta = await crear(equipoId, { ...lesion, numero_caso: null }); // eslint-disable-line no-await-in-loop
      if (respuesta.error === REPETIDA) {
        resultado.repetidas.push({ id: uno.id, lesion: uno.lesion });
        continue;
      }
      if (!respuesta.error) resultado.nuevas[uno.id] = respuesta.lesion;
    } else if (uno.tipo === "cambiar") {
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
    } else continue;
    if (!respuesta.error) resultado.subidos += 1;
    else if (esDeRed(respuesta)) {
      resultado.cortado = true;
      quedan.push(uno);
    } else {
      const enLaBase = servidor.find((una) => una.id === uno.id);
      resultado.errores.push({ error: respuesta.error, lesion: uno.lesion || (enLaBase && conLosCambios(enLaBase, uno.cambios)) || null });
    }
  }
  return { ...resultado, quedan };
};

// La cola después de subir, con lo que se hizo mientras se subía (ahora: la
// cola de ese momento; enviada: la que se subió). Lo que ya se subió (o se
// descartó, o la base no dejó) sale. Una nueva que subió y se cambió
// mientras tanto: lo cambiado, sobre la que ya está en la base (cambiosDe:
// cambiosDeLaLesion); si se borró mientras tanto, se borra la que subió.
export const conLoHechoMientras = (ahora, { enviada = [], quedan = [], nuevas = {}, repetidas = [] }, cambiosDe) => {
  const hechos = new Set(enviada.filter((uno) => !quedan.includes(uno)));
  const descartadas = new Set(repetidas.map((una) => una.id));
  let cola = [];
  ahora.forEach((uno) => {
    if (hechos.has(uno) || (uno.tipo === "crear" && descartadas.has(uno.id))) return;
    if (uno.tipo === "crear" && nuevas[uno.id]) {
      const subida = enviada.find((otro) => otro.tipo === "crear" && otro.id === uno.id);
      cola = conCambio(cola, { id: nuevas[uno.id].id, ...cambiosDe(subida.lesion, uno.lesion) });
      return;
    }
    cola.push(uno);
  });
  Object.entries(nuevas).forEach(([local, lesion]) => {
    if (!ahora.some((uno) => uno.tipo === "crear" && uno.id === local)) cola = conBorrada(cola, lesion.id);
  });
  return cola;
};
