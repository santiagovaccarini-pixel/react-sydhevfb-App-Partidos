// La copia del GPS en este aparato (Santiago, 14/10: «Lo que sea mejor para
// poder abrir lo mas rapido posible todas las filas que se tengan»): todas
// las filas del club, para que la Base abra al instante y después traiga de
// la base solo lo nuevo, lo cambiado y lo borrado (gpsDb.js, ponerAlDiaGps).
//
// Va en IndexedDB (son miles de filas: no entran en localStorage), una por
// cuenta y club. Se borra al salir de la cuenta, cuando la cuenta deja el
// club o pierde el GPS (copiasLocales.js y PortalApp.jsx). Sin IndexedDB (un
// navegador viejo, una ventana privada que no lo deja) no hay copia: la Base
// trae todo de la base, como la primera vez.

const BASE = "ark-copias";
const ALMACEN = "gps";
const VERSION_DE_LA_BASE = 1;
// Si cambia lo que se guarda, las copias viejas no se usan.
export const FORMATO_COPIA_GPS = 1;

const abrirBase = () =>
  new Promise((resolver) => {
    if (typeof indexedDB === "undefined" || !indexedDB) {
      resolver(null);
      return;
    }
    try {
      const pedido = indexedDB.open(BASE, VERSION_DE_LA_BASE);
      pedido.onupgradeneeded = () => {
        const base = pedido.result;
        if (!base.objectStoreNames.contains(ALMACEN)) base.createObjectStore(ALMACEN);
      };
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => resolver(null);
      pedido.onblocked = () => resolver(null);
    } catch {
      resolver(null);
    }
  });

// Una operación sobre el almacén; null si no se pudo (sin IndexedDB, lleno o
// cualquier falla: la copia es solo para abrir más rápido).
const conAlmacen = async (modo, hacer) => {
  const base = await abrirBase();
  if (!base) return null;
  return new Promise((resolver) => {
    let resultado = null;
    try {
      const transaccion = base.transaction(ALMACEN, modo);
      const pedido = hacer(transaccion.objectStore(ALMACEN));
      if (pedido) pedido.onsuccess = () => (resultado = pedido.result);
      transaccion.oncomplete = () => {
        base.close();
        resolver(resultado ?? true);
      };
      transaccion.onerror = () => {
        base.close();
        resolver(null);
      };
      transaccion.onabort = () => {
        base.close();
        resolver(null);
      };
    } catch {
      base.close();
      resolver(null);
    }
  });
};

const claveDe = (cuenta, equipoId) => `${cuenta}:${equipoId}`;

// La copia de esta cuenta en este club: { filas, hasta, guardadaEn } o null
// (guardadaEn: cuándo se guardó en este aparato, para decirlo sin señal).
export const leerCopiaGps = async (cuenta, equipoId) => {
  if (!cuenta || !equipoId) return null;
  const copia = await conAlmacen("readonly", (almacen) => almacen.get(claveDe(cuenta, equipoId)));
  if (!copia || copia === true || copia.formato !== FORMATO_COPIA_GPS || !Array.isArray(copia.filas)) return null;
  return { filas: copia.filas, hasta: copia.hasta || null, guardadaEn: Number.isFinite(copia.guardada) ? new Date(copia.guardada).toISOString() : null };
};

// hasta: lo último que se trajo de la base (su hora, la de la base).
export const guardarCopiaGps = async (cuenta, equipoId, { filas, hasta = null }) => {
  if (!cuenta || !equipoId || !Array.isArray(filas)) return null;
  return conAlmacen("readwrite", (almacen) => almacen.put({ formato: FORMATO_COPIA_GPS, filas, hasta, guardada: Date.now() }, claveDe(cuenta, equipoId)));
};

// Las copias de un club (de todas las cuentas de este aparato) o, sin club,
// todas.
export const borrarCopiasGps = async (equipoId = null) =>
  conAlmacen("readwrite", (almacen) => {
    if (!equipoId) return almacen.clear();
    const cursor = almacen.openCursor();
    cursor.onsuccess = () => {
      const actual = cursor.result;
      if (!actual) return;
      if (String(actual.key).endsWith(`:${equipoId}`)) actual.delete();
      actual.continue();
    };
    return null;
  });
