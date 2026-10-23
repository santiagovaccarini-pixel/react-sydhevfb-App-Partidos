// La fila de espera de GPS (paso 3c de la nota «cargar sin señal y a la vez
// que otra persona»; Santiago, 23/10, en un cuestionario: sin señal se puede
// «Cambiar y borrar en la Base», «Cargar un día», «Pegar desde una planilla»
// y «Valores de referencia»; lo demás, como en Evaluaciones y Lesiones: lo
// que espera, con un aviso arriba y las filas «de otro color»; al volver la
// señal «Lo sube sola y avisa»). Va por partes; la 3c.1: cambiar celdas y
// borrar filas de la Base; la 3c.2b: «Cargar un día» y «Dejar para revisar»
// (Santiago, 23/10: sin señal el «Vs» va a mano, lo dejado para revisar
// «Queda en el aparato» y al subir valen las reglas del «Mismo CSV»). Acá,
// sin pantalla: qué queda en la cola con cada cosa que se hace, cómo se ve
// lo que espera y cómo se sube.
//
// Las filas de la pantalla siguen siendo las de la base (y su copia del
// aparato, copiaGps.js); lo que espera se pone encima para mirarlo. Así, al
// poner al día con la base (ponerAlDiaGps), las cuentas dan.
//
// Cada elemento de la cola es un cambio, en el orden en que se hizo:
//   · { tipo: "cambiar", id, cambios, antes } (como gps_cambiar, 20261116)
//   · { tipo: "borrar", id }
//   · { tipo: "dia", id: "local:…", fecha, dispositivo, filas, enCurso,
//     reemplazar?, chocan? }: un día guardado sin señal. Cada fila tiene su
//     id («local:…#n») hasta que sube: lo que se le cambia o borra queda
//     acá. enCurso: la carga sin terminar de la base que se siguió (al subir
//     deja de estar «Sin terminar»). reemplazar: a la Regla 1 se contestó
//     «Reemplazar y cargar». chocan: es la misma sesión que cargó otra
//     persona con otros datos; espera y se pregunta («Espera y te pregunta»,
//     como en Evaluaciones).
//   · { tipo: "enCurso", id: "local:…", base, fecha, paso, resumen, datos,
//     dejadaEn }: una carga dejada para revisar sin señal. base: la de la
//     base que se siguió ({ id, version }), si se siguió una.
import { esLocal, nuevoIdLocal } from "../evaluaciones/espera.js";
import { filasDeLaMismaSesion, filasEnOtroCsv, filasYaEnLaBase } from "./cargar.js";
import { datosConCambio } from "./valores.js";

export { esLocal };

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

// Borrar: lo que esperaba para esa fila ya no hace falta. Las de un día que
// espera salen de su día (y el día, si se queda sin filas).
export const conBorradas = (cola, ids = []) => {
  const locales = new Set(ids.filter(esLocal));
  const nuevas = new Set(ids.filter((id) => !esLocal(id)));
  const sinLocales = locales.size
    ? cola.flatMap((uno) => {
        if (uno.tipo !== "dia" || !uno.filas.some((fila) => locales.has(fila.id))) return [uno];
        const filas = uno.filas.filter((fila) => !locales.has(fila.id));
        return filas.length ? [{ ...uno, filas }] : [];
      })
    : cola;
  const yaEsperan = new Set(cola.filter((uno) => uno.tipo === "borrar").map((uno) => uno.id));
  return [
    ...sinLocales.filter((uno) => !(uno.tipo === "cambiar" && nuevas.has(uno.id))),
    ...[...nuevas].filter((id) => !yaEsperan.has(id)).map((id) => ({ tipo: "borrar", id })),
  ];
};

// Lo que va a la base de una fila (sin lo de la pantalla).
const paraLaBase = ({ id, orden, equipo_id: equipo, actualizado_en: actualizado, ...fila }) => fila;

// «Cargar un día» sin señal: el día entra en la cola, con un id para cada
// fila. enCurso: la carga sin terminar que se seguía ({ id }): si era de este
// aparato, sale de la cola (ahora es este día) y queda la de la base que
// había seguido ella. Devuelve { cola, id }.
export const conDia = (cola, { fecha, dispositivo = "", filas = [], enCurso = null, reemplazar = false }) => {
  const id = nuevoIdLocal();
  const deAca = cola.find((uno) => uno.tipo === "enCurso" && uno.id === enCurso?.id) || null;
  const dia = {
    tipo: "dia",
    id,
    fecha,
    dispositivo,
    filas: filas.map((fila, i) => ({ ...paraLaBase(fila), fecha: fila.fecha || fecha, id: `${id}#${i + 1}`, orden: i + 1 })),
    enCurso: deAca ? deAca.base?.id ?? null : esLocal(enCurso?.id) ? null : enCurso?.id ?? null,
    ...(reemplazar ? { reemplazar: true } : {}),
  };
  return { cola: [...cola.filter((uno) => uno !== deAca), dia], id };
};

// Una fila de un día que espera, cambiada.
export const conFilaCambiada = (cola, fila) =>
  cola.map((uno) => (uno.tipo === "dia" && uno.filas.some((una) => una.id === fila.id) ? { ...uno, filas: uno.filas.map((una) => (una.id === fila.id ? { ...fila } : una)) } : uno));

// La Regla 1 de un día que chocaba, contestada «Reemplazar y cargar».
export const conReemplazo = (cola, id) => cola.map((uno) => (uno.tipo === "dia" && uno.id === id ? { ...uno, chocan: false, reemplazar: true } : uno));

// «Dejar para revisar» sin señal: queda en este aparato. Con el id de una
// de este aparato, la cambia; con el de una de la base (se siguió esa), la
// recuerda (base) para seguirla al subir. Devuelve { cola, id }.
export const conEnCurso = (cola, { id = null, version = null, fecha, paso = 0, resumen = {}, datos, dejadaEn = new Date().toISOString() }) => {
  const ya = cola.find((uno) => uno.tipo === "enCurso" && uno.id === id) || null;
  const carga = { tipo: "enCurso", id: ya ? ya.id : nuevoIdLocal(), base: ya ? ya.base : id && !esLocal(id) ? { id, version } : null, fecha, paso, resumen, datos, dejadaEn };
  return { cola: ya ? cola.map((uno) => (uno === ya ? carga : uno)) : [...cola, carga], id: carga.id };
};

// Una carga sin terminar de este aparato, fuera (se borró o se subió).
export const sinEnCurso = (cola, id) => cola.filter((uno) => !(uno.tipo === "enCurso" && uno.id === id));

// Las cargas sin terminar de este aparato.
export const enCursoEnEspera = (cola = []) => cola.filter((uno) => uno.tipo === "enCurso");

// ------------------------------------------------------ Cómo se ve con ella --

// Las filas de los días que esperan.
const filasQueEsperan = (cola) => cola.flatMap((uno) => (uno.tipo === "dia" ? uno.filas : []));
export const filaQueEspera = (cola = [], id) => filasQueEsperan(cola).find((fila) => fila.id === id) || null;

// Por fecha; en un día, las de la base primero y en su orden.
const porFecha = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : esLocal(a.id) - esLocal(b.id) || (a.orden || 0) - (b.orden || 0));

// Las filas con lo que espera encima (y las de los días que esperan, en su
// fecha). Se puede aplicar más de una vez: da lo mismo. Sin nada esperando,
// las mismas filas (son miles: no se copian).
export const conLoQueEspera = (filas = [], cola = []) => {
  if (!cola.length) return filas;
  const cambios = new Map(cola.filter((uno) => uno.tipo === "cambiar").map((uno) => [uno.id, uno.cambios]));
  const borradas = new Set(cola.filter((uno) => uno.tipo === "borrar").map((uno) => uno.id));
  const deLaBase = filas.filter((fila) => !borradas.has(fila.id) && !esLocal(fila.id)).map((fila) => (cambios.has(fila.id) ? conLosCambios(fila, cambios.get(fila.id)) : fila));
  const locales = filasQueEsperan(cola);
  return locales.length ? [...deLaBase, ...locales].sort(porFecha) : deLaBase;
};

// Las filas que esperan (para pintarlas): las cambiadas y las de los días.
export const idsEnEspera = (cola = []) => new Set([...cola.filter((uno) => uno.tipo === "cambiar").map((uno) => uno.id), ...filasQueEsperan(cola).map((fila) => fila.id)]);

// Cuánto espera (un día cuenta sus filas), cuánto choca y cuántos se suben solos.
export const cuentaDeLaEspera = (cola = []) =>
  cola.reduce(
    (cuenta, uno) => {
      const n = uno.tipo === "dia" ? uno.filas.length : 1;
      return { total: cuenta.total + n, chocan: cuenta.chocan + (uno.chocan ? n : 0), pendientes: cuenta.pendientes + (uno.chocan ? 0 : 1) };
    },
    { total: 0, chocan: 0, pendientes: 0 },
  );

// ------------------------------------------------------------- Al subirla --

// Un día guardado sin señal, a la base (gps_guardar_dia, 20261111: todo o
// nada, con la regla del CSV que ya está y la Regla 1). Sin esa
// actualización, como antes: la app mira las dos reglas y lo crea de a
// tandas. Devuelve { estado: listo | yaEsta | chocan | red | error, ... }.
const subirDia = async (dia, { guardarDia, crear, listar, borrarEnCurso }, esDeRed) => {
  const filas = dia.filas.map(paraLaBase);
  const conRed = (respuesta, hechas = 0) => (esDeRed(respuesta) ? { estado: "red", hechas } : { estado: "error", error: respuesta.error, hechas });
  const respuesta = await guardarDia({ fecha: dia.fecha, dispositivo: dia.dispositivo, filas, reemplazar: Boolean(dia.reemplazar) });
  if (respuesta.yaEsta) return { estado: "yaEsta" };
  if (respuesta.conOtras) {
    // Las de esa sesión que ya estaban, para preguntar con ellas.
    const delDia = await listar(dia.fecha);
    return { estado: "chocan", existentes: delDia.error ? [] : filasDeLaMismaSesion(filas, delDia.filas, dia.dispositivo) };
  }
  if (respuesta.error) return conRed(respuesta);
  if (respuesta.sinFuncion) {
    const delDia = await listar(dia.fecha);
    if (delDia.error) return conRed(delDia);
    if (filasYaEnLaBase(filas.map((fila) => ({ valores: fila.datos })), delDia.filas)) return { estado: "yaEsta" };
    const otras = filasDeLaMismaSesion(filas, delDia.filas, dia.dispositivo);
    if (otras.length && dia.reemplazar) return { estado: "error", error: "gps.error.faltaMigracion", hechas: 0 };
    if (otras.length) return { estado: "chocan", existentes: otras };
    const creadas = await crear(filas);
    if (creadas.error) return conRed(creadas, creadas.creadas?.length || 0);
  }
  // Ya está en la Base: la carga sin terminar que se siguió deja de estarlo.
  const quitada = dia.enCurso ? await borrarEnCurso(dia.enCurso) : { error: "" };
  return { estado: "listo", hechas: respuesta.sinFuncion ? filas.length : respuesta.creadas ?? filas.length, reemplazadas: respuesta.reemplazadas || 0, sinBorrar: Boolean(quitada.error) };
};

// Una carga dejada para revisar sin señal, a «Sin terminar». Si su CSV ya
// está en la Base o en otra carga sin terminar de ese día, se avisa y se
// descarta (Santiago, 23/10: «si cumple con las reglas de validacion avisa y
// lo descarta», con el «Mismo CSV», «Con y sin señal»); también si la que se
// siguió la siguieron desde otro aparato. csvDe(datos): las filas del CSV de
// lo hecho. Devuelve { estado: listo | enLaBase | repetida | otroAparato |
// red | error, ... }.
const subirEnCurso = async (carga, { listar, dejar, enCursos, leerEnCurso }, { csvDe, esDeRed }) => {
  const conRed = (respuesta) => (esDeRed(respuesta) ? { estado: "red" } : { estado: "error", error: respuesta.error });
  const csv = csvDe(carga.datos);
  const delDia = await listar(carga.fecha);
  if (delDia.error) return conRed(delDia);
  if (filasYaEnLaBase(csv, delDia.filas)) return { estado: "enLaBase" };
  const otras = await enCursos(carga.fecha);
  if (otras.error) return conRed(otras);
  for (const otra of otras.enCurso.filter((una) => una.id !== carga.base?.id)) {
    const abierta = await leerEnCurso(otra.id); // eslint-disable-line no-await-in-loop
    if (abierta.error === "gps.enCurso.noEsta") continue;
    if (abierta.error) return conRed(abierta);
    if (filasEnOtroCsv(csv, csvDe(abierta.enCurso.datos))) return { estado: "repetida", otra };
  }
  const lo = { fecha: carga.fecha, paso: carga.paso, resumen: carga.resumen, datos: carga.datos };
  let respuesta = await dejar({ id: carga.base?.id || null, version: carga.base?.version || null, ...lo });
  // La que se siguió ya no está (la borraron): queda como una nueva.
  if (respuesta.error === "gps.enCurso.noEsta") respuesta = await dejar({ id: null, version: null, ...lo });
  if (respuesta.error === "gps.enCurso.otroAparato") return { estado: "otroAparato" };
  if (respuesta.error) return conRed(respuesta);
  return { estado: "listo", id: respuesta.id };
};

// Sube lo que espera, en orden, con las funciones de la base (las de
// gpsDb.js; se reciben para probarlas sin la base): los borrados seguidos,
// juntos (borrarFilasGps). filaDe(id): la fila como está en la pantalla, para
// cambiarla entera si la base no tiene la actualización 20261116. Si otra
// persona borró una fila que se cambió, se cuenta (borradasPorOtra). Sin señal
// en el camino, se corta: lo que falta queda. Un error de la base (sin
// permiso, otra regla) no se reintenta: va en errores ({ error, ids }) y sale
// de la cola. devueltas: las filas como quedaron en la base; borradas: los
// id que ya no están (para que la pantalla no espere a ponerse al día).
// Un día que choca queda (chocan) y vuelve en chocadas ({ dia, existentes })
// para preguntar; uno que ya estaba, o una carga sin terminar del mismo CSV,
// sale y vuelve en descartadas ({ tipo, fecha, otra }). subidasEnCurso: las
// de este aparato que ya están en «Sin terminar» ({ local, id }).
export const subirLaEspera = async (cola, { funciones, filaDe = () => null, csvDe = () => [], esDeRed }) => {
  const { cambiar, actualizar, borrar } = funciones;
  const quedan = [];
  const resultado = {
    subidos: 0,
    pisadas: [],
    borradasPorOtra: 0,
    errores: [],
    cortado: false,
    devueltas: [],
    borradas: [],
    chocadas: [],
    descartadas: [],
    reemplazadas: 0,
    sinBorrar: 0,
    subidasEnCurso: [],
    conEnCurso: false,
  };
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
    if (uno.tipo === "dia") {
      const hecho = await subirDia(uno, funciones, esDeRed); // eslint-disable-line no-await-in-loop
      resultado.subidos += hecho.hechas || 0;
      if (hecho.estado === "yaEsta") resultado.descartadas.push({ tipo: "dia", fecha: uno.fecha });
      else if (hecho.estado === "chocan") {
        const espera = { ...uno, chocan: true };
        quedan.push(espera);
        resultado.chocadas.push({ dia: espera, existentes: hecho.existentes });
      } else if (hecho.estado === "red") {
        // Sin señal en el camino: lo que falta del día queda.
        resultado.cortado = true;
        quedan.push(hecho.hechas ? { ...uno, filas: uno.filas.slice(hecho.hechas) } : uno);
      } else if (hecho.estado === "error") resultado.errores.push({ error: hecho.error, ids: uno.filas.slice(hecho.hechas || 0).map((fila) => fila.id) });
      else {
        resultado.reemplazadas += hecho.reemplazadas;
        if (hecho.sinBorrar) resultado.sinBorrar += 1;
        if (uno.enCurso) resultado.conEnCurso = true;
      }
      continue;
    }
    if (uno.tipo === "enCurso") {
      const hecho = await subirEnCurso(uno, funciones, { csvDe, esDeRed }); // eslint-disable-line no-await-in-loop
      if (hecho.estado === "red") {
        resultado.cortado = true;
        quedan.push(uno);
        continue;
      }
      if (hecho.estado === "error") {
        resultado.errores.push({ error: hecho.error, ids: [uno.id] });
        continue;
      }
      resultado.conEnCurso = true;
      if (hecho.estado === "listo") {
        resultado.subidos += 1;
        resultado.subidasEnCurso.push({ local: uno.id, id: hecho.id });
      } else resultado.descartadas.push({ tipo: hecho.estado, fecha: uno.fecha, otra: hecho.otra || null });
      continue;
    }
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
// base no dejó) sale; lo que volvió cambiado (un día que choca o lo que
// falta de uno que se cortó) queda en su lugar; lo demás queda, en orden.
export const conLoHechoMientras = (ahora, { enviada = [], quedan = [] }) => {
  const enviados = new Set(enviada);
  const siguen = new Set(quedan);
  const cambiados = new Map(quedan.filter((uno) => !enviados.has(uno)).map((uno) => [`${uno.tipo}|${uno.id}`, uno]));
  return ahora.flatMap((uno) => {
    if (!enviados.has(uno) || siguen.has(uno)) return [uno];
    const otro = cambiados.get(`${uno.tipo}|${uno.id}`);
    return otro ? [otro] : [];
  });
};
