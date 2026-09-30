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

// Primero la red y, si no hay, lo guardado. Para el HTML, que tiene que poder
// traer una versión nueva apenas haya señal.
const redPrimero = async (
  pedido,
  { clave = pedido, reserva = null, sinParametros = false } = {},
) => {
  try {
    return await guardar(clave, await fetch(pedido));
  } catch (error) {
    const guardado = await caches.match(clave, { ignoreSearch: sinParametros });
    if (guardado) return guardado;
    if (reserva) {
      const deReserva = await caches.match(reserva);
      if (deReserva) return deReserva;
    }
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
