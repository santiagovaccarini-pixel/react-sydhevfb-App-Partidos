// Lo cargado, cambiado o borrado sin señal que todavía no subió (paso 3 de
// la nota «cargar sin señal y a la vez que otra persona»; Santiago, 21/10:
// «Tiene que poder hacer todo y que se suba cuando vuelva a tener
// internet»). Una cola por club, base y cuenta, en este aparato (IndexedDB,
// junto a la copia para ver sin señal; copiaSinSenal.js). Lo que cada base
// pone en la cola y cómo lo sube lo decide la base (Evaluaciones:
// evaluaciones/espera.js).
//
// Es trabajo de quien lo cargó, como los partidos pendientes: no se borra al
// salir de la cuenta ni al dejar el club (copiasLocales.js); se sube cuando
// esa cuenta vuelve a abrir la base con señal. Sin IndexedDB (un navegador
// viejo, una ventana privada que no lo deja), la cola vive mientras la
// pantalla está abierta.
import { ALMACEN_ESPERA, claveDe, conAlmacen } from "./copiaSinSenal.js";

// La cola guardada ([] si no hay o no se pudo leer).
export const leerEspera = async (modulo, cuenta, equipoId) => {
  if (!modulo || !cuenta || !equipoId) return [];
  const guardada = await conAlmacen("readonly", (almacen) => almacen.get(claveDe(modulo, cuenta, equipoId)), ALMACEN_ESPERA);
  return Array.isArray(guardada?.cola) ? guardada.cola : [];
};

// La cola entera, como queda (vacía: se borra). true si se guardó.
export const guardarEspera = async (modulo, cuenta, equipoId, cola) => {
  if (!modulo || !cuenta || !equipoId) return null;
  const clave = claveDe(modulo, cuenta, equipoId);
  const hecho = await conAlmacen(
    "readwrite",
    (almacen) => (Array.isArray(cola) && cola.length ? almacen.put({ cola, guardadaEn: new Date().toISOString() }, clave) : almacen.delete(clave)),
    ALMACEN_ESPERA,
  );
  return hecho ? true : null;
};
