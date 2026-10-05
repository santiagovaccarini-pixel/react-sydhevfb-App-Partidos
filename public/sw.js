/**
 * Para que la app abra sin señal.
 *
 * Se usa en vivo y en un estadio, donde la conexión es mala o no hay. Sin
 * esto, llegar sin señal y no tener la app ya abierta era quedarse sin poder
 * registrar el partido: la página ni siquiera cargaba.
 *
 * La lista de archivos y el nombre del cache los completa scripts/precache.js
 * después de compilar, que es cuando se sabe cómo se llaman los archivos.
 */

const CACHE = "__CACHE__";
const PRECARGA = ["__PRECARGA__"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECARGA))
      // Sin esperar a que se cierren las pestañas viejas: una versión nueva
      // tiene que quedar lista para el próximo partido, no para dentro de dos.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter((nombre) => nombre !== CACHE)
            .map((nombre) => caches.delete(nombre)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const guardar = async (clave, respuesta) => {
  // Solo lo que sirve para volver a abrir: una respuesta parcial, de otro
  // dominio o que vino de una redirección no se guarda (el navegador se niega
  // a usar una respuesta redirigida para abrir la app).
  if (
    !respuesta ||
    !respuesta.ok ||
    respuesta.type !== "basic" ||
    respuesta.redirected
  )
    return respuesta;
  const cache = await caches.open(CACHE);
  cache.put(clave, respuesta.clone());
  return respuesta;
};

// Cuánto se espera a la red para abrir la página. Con barras pero sin datos
// el pedido puede no contestar nunca (el celular se cree conectado): pasado
// este rato se abre la guardada, como sin señal.
const TOPE_PAGINA_MS = 3000;

const esperar = (milisegundos) =>
  new Promise((resolver) => setTimeout(() => resolver(null), milisegundos));

// Primero la red y, si no hay, lo guardado. Para el HTML, que tiene que poder
// traer una versión nueva apenas haya señal. Con `tope`, si la red tarda más
// que eso se usa lo guardado (si hay; si no, se sigue esperando a la red).
const redPrimero = async (
  pedido,
  { clave = pedido, reserva = null, sinParametros = false, tope = 0 } = {},
) => {
  const loGuardado = async () => {
    const guardado = await caches.match(clave, { ignoreSearch: sinParametros });
    if (guardado || !reserva) return guardado;
    return caches.match(reserva);
  };
  const deLaRed = fetch(pedido);
  try {
    if (tope) {
      const aTiempo = await Promise.race([deLaRed, esperar(tope)]);
      if (aTiempo) return await guardar(clave, aTiempo);
      const guardado = await loGuardado();
      if (guardado) {
        // Lo que conteste la red después no se guarda: la página ya abrió con
        // lo guardado, y una versión nueva del HTML sin sus archivos dejaría
        // la app en blanco la próxima vez sin señal.
        deLaRed.catch(() => {});
        return guardado;
      }
    }
    return await guardar(clave, await deLaRed);
  } catch (error) {
    const guardado = await loGuardado();
    if (guardado) return guardado;
    throw error;
  }
};

// Primero lo guardado. Para los archivos compilados, que llevan un hash en el
// nombre: si el nombre es el mismo, el contenido es el mismo.
const cachePrimero = async (pedido) => {
  const guardado = await caches.match(pedido);
  if (guardado) return guardado;
  return guardar(pedido, await fetch(pedido));
};

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;

  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  // El aviso de versión nueva tiene que preguntar de verdad: una copia
  // guardada lo dejaría diciendo siempre lo mismo.
  if (url.pathname === "/version.json") return;

  // Lo que contesta el servidor propio (/api/…) es de cada cuenta y de cada
  // momento: nunca se guarda ni se sirve desde el cache, aunque no haya señal.
  if (url.pathname.startsWith("/api/")) return;

  if (pedido.mode === "navigate") {
    // La app vive en "/" con parámetros que van cambiando (?actualizar=…):
    // se guarda y se busca sin ellos, y la reserva es la portada precargada.
    evento.respondWith(
      redPrimero(pedido, {
        clave: url.origin + url.pathname,
        reserva: "/",
        sinParametros: true,
        tope: TOPE_PAGINA_MS,
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    evento.respondWith(cachePrimero(pedido));
    return;
  }

  evento.respondWith(redPrimero(pedido));
});
