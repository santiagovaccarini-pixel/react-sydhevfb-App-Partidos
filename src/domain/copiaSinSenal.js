// Ver las bases sin señal (paso 1 de la nota «cargar sin señal y a la vez que
// otra persona»; Santiago, 20/10: la copia para usar sin señal «Solo donde se
// active», en Ajustes de cada base: «Ver Lesiones sin señal en este
// aparato»). Si se activó en este aparato, la base guarda acá lo que trajo
// (para esta cuenta y este club) y, sin señal, abre con eso para mirar.
//
// Lo que se guarda va en IndexedDB, una copia por club, base y cuenta. Que
// está activado, en localStorage (es solo una marca). Todo se borra al
// desactivarlo, al salir de la cuenta, cuando la cuenta deja el club
// (copiasLocales.js) y cuando pierde esa base (PortalApp.jsx). Sin IndexedDB
// (un navegador viejo, una ventana privada que no lo deja) no hay copia: sin
// señal se ve el aviso de siempre.
import { supabase } from "../supabase.js";
import { leerPerfilLocal } from "./perfilesDb.js";

const BASE = "ark-sin-senal";
const ALMACEN = "copias";
const VERSION_DE_LA_BASE = 1;
// Si cambia lo que se guarda, las copias viejas no se usan.
export const FORMATO_SIN_SENAL = 1;
// La marca de cada base activada: sin_senal:<club>:<base>:<cuenta>.
export const MARCA_SIN_SENAL = "sin_senal";

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
// cualquier falla).
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

const claveDe = (modulo, cuenta, equipoId) => `${equipoId}|${modulo}|${cuenta}`;
const marcaDe = (modulo, cuenta, equipoId) => `${MARCA_SIN_SENAL}:${equipoId}:${modulo}:${cuenta}`;

// La cuenta de este aparato: la de la sesión o, sin señal y sin sesión que
// leer, la última que entró (como la puerta de entrada).
export const cuentaDelAparato = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) return data.session.user.id;
  } catch {
    // Sin sesión que leer: la guardada.
  }
  return leerPerfilLocal()?.user_id || null;
};

export const sinSenalActivo = (modulo, cuenta, equipoId) => {
  if (!modulo || !cuenta || !equipoId) return false;
  try {
    return localStorage.getItem(marcaDe(modulo, cuenta, equipoId)) === "1";
  } catch {
    return false;
  }
};

export const activarSinSenal = (modulo, cuenta, equipoId) => {
  if (!modulo || !cuenta || !equipoId) return false;
  try {
    localStorage.setItem(marcaDe(modulo, cuenta, equipoId), "1");
    return true;
  } catch {
    return false;
  }
};

// Se desactiva y la copia se borra.
export const desactivarSinSenal = async (modulo, cuenta, equipoId) => {
  if (!modulo || !cuenta || !equipoId) return null;
  try {
    localStorage.removeItem(marcaDe(modulo, cuenta, equipoId));
  } catch {
    // Sin localStorage no había marca.
  }
  return conAlmacen("readwrite", (almacen) => almacen.delete(claveDe(modulo, cuenta, equipoId)));
};

// datos: lo que la base necesita para mostrarse (lo decide cada base). Solo
// si está activado. Devuelve la hora en que se guardó (ISO) o null.
export const guardarCopiaSinSenal = async (modulo, cuenta, equipoId, datos) => {
  if (!sinSenalActivo(modulo, cuenta, equipoId) || !datos || typeof datos !== "object") return null;
  const guardadaEn = new Date().toISOString();
  const hecho = await conAlmacen("readwrite", (almacen) => almacen.put({ formato: FORMATO_SIN_SENAL, guardadaEn, datos }, claveDe(modulo, cuenta, equipoId)));
  return hecho ? guardadaEn : null;
};

// { datos, guardadaEn } o null (sin activar, sin copia o de otro formato).
export const leerCopiaSinSenal = async (modulo, cuenta, equipoId) => {
  if (!sinSenalActivo(modulo, cuenta, equipoId)) return null;
  const copia = await conAlmacen("readonly", (almacen) => almacen.get(claveDe(modulo, cuenta, equipoId)));
  if (!copia || copia === true || copia.formato !== FORMATO_SIN_SENAL || !copia.datos || typeof copia.datos !== "object") return null;
  return { datos: copia.datos, guardadaEn: copia.guardadaEn || null };
};

// Las copias y las marcas de un club (de todas las cuentas de este aparato),
// de una base de ese club o, sin club, todas.
export const borrarCopiasSinSenal = async (equipoId = null, modulo = null) => {
  try {
    Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      .filter(Boolean)
      .forEach((clave) => {
        const [marca, club, base] = clave.split(":");
        if (marca !== MARCA_SIN_SENAL) return;
        if ((!equipoId || club === String(equipoId)) && (!modulo || base === modulo)) localStorage.removeItem(clave);
      });
  } catch {
    // Sin localStorage no hay marcas.
  }
  return conAlmacen("readwrite", (almacen) => {
    if (!equipoId) return almacen.clear();
    const cursor = almacen.openCursor();
    cursor.onsuccess = () => {
      const actual = cursor.result;
      if (!actual) return;
      const [club, base] = String(actual.key).split("|");
      if (club === String(equipoId) && (!modulo || base === modulo)) actual.delete();
      actual.continue();
    };
    return null;
  });
};
