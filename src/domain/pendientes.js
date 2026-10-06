import { clavePartido } from "./match.js";

// La cola de partidos que no se pudieron subir (los "pendientes") y cómo se
// cruza con el partido que se está cargando. Vive aparte de App.js para poder
// probar las reglas sin montar la pantalla.

/** Un número al azar para reconocer algo guardado en el celular. */
export const idAlAzar = () => {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Sin crypto (navegador viejo): se arma a mano abajo.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Cada entrada de la cola lleva su propio número: es lo que permite sacar de
 * la cola exactamente lo que se subió, y no otra versión del mismo partido
 * que se guardó mientras tanto. Las de antes no lo tienen: se reconocen por
 * su contenido entero.
 */
export const identidadPendiente = (item) =>
  item?.idPendiente ? `id:${item.idPendiente}` : `contenido:${JSON.stringify(item)}`;

/** La entrada que va a la cola, con su número propio. */
export const comoPendiente = (registro) => ({
  ...registro,
  sinSincronizar: true,
  idPendiente: idAlAzar(),
});

/**
 * La cola releída, menos lo que se subió. Antes se reescribía con la copia
 * que se había leído al empezar a subir, y un partido guardado sin señal en
 * el medio desaparecía de la cola.
 */
export const quitarSubidos = (cola, subidos) => {
  const yaSubidos = new Set(subidos);
  return (cola || []).filter((item) => !yaSubidos.has(identidadPendiente(item)));
};

export const sigueEnLaCola = (cola, pendiente) => {
  const buscada = identidadPendiente(pendiente);
  return (cola || []).some((item) => identidadPendiente(item) === buscada);
};

/**
 * Si un pendiente es una versión del partido que se acaba de guardar en la
 * base: misma fila, o misma fecha y rival (que para la app, y para el índice
 * único de la base, son el mismo partido). Esas versiones son más viejas que
 * lo recién guardado y no tienen que volver a subirse encima.
 */
export const esVersionDelPartido = (pendiente, guardado, idGuardado = null) => {
  if (!pendiente || !guardado) return false;
  const id = idGuardado ?? guardado.idSupabase ?? null;
  if (id && pendiente.idSupabase && String(pendiente.idSupabase) === String(id)) {
    return true;
  }
  return clavePartido(pendiente) === clavePartido(guardado);
};

/**
 * La cola sin las versiones del partido que se acaba de guardar. Con
 * `anteriores` (las identidades de lo que había en la cola cuando el guardado
 * empezó a escribir) se sacan solo esas: lo que entró después es más nuevo
 * (otro Guardar de ese partido que lo esperó y quedó en el celular) y se queda.
 */
export const sinVersionesDelPartido = (
  cola,
  guardado,
  idGuardado = null,
  anteriores = null,
) =>
  (cola || []).filter(
    (item) =>
      !esVersionDelPartido(item, guardado, idGuardado) ||
      (anteriores !== null && !anteriores.has(identidadPendiente(item))),
  );

/**
 * Si el borrador en pantalla tiene que quedarse con el número de fila que
 * recibió un pendiente al subir. Solo si todavía no tiene uno, es el mismo
 * partido (fecha y rival) y, cuando los dos lo saben, salió de este mismo
 * borrador: uno empezado de cero después de Limpiar no hereda nada.
 */
export const borradorRecibeId = (borrador, pendiente) => {
  if (!borrador || !pendiente) return false;
  if (borrador.idSupabase) return false;
  if (clavePartido(borrador) !== clavePartido(pendiente)) return false;
  if (borrador.idLocal && pendiente.idLocal && borrador.idLocal !== pendiente.idLocal) {
    return false;
  }
  return true;
};
