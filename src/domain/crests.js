import { normalizarTextoBase } from "./match";

export const CLAVE_ESCUDOS = "escudos_rivales";

// Un fallido se recuerda un día: si la API no conoce al club, no tiene sentido
// volver a preguntar en cada tecla, pero tampoco quedarse pegado para siempre.
export const ESPERA_REINTENTO = 24 * 60 * 60 * 1000;

// Uno encontrado se vuelve a buscar al mes. Un club puede cambiar el escudo, y
// alguna vez se guardó el de otro con nombre parecido: sin esto ese quedaba
// para siempre y no había forma de corregirlo.
export const ESPERA_REFRESCO = 30 * 24 * 60 * 60 * 1000;

const LIMITE_BYTES_GUARDADOS = 150 * 1024;

/**
 * Clave con la que se guarda el escudo de un club. Se saca lo que cambia de un
 * partido a otro (SC, EC, FC, CA, "clube", "club", "de futebol"…) para que
 * "Cruzeiro", "Cruzeiro EC" y "Cruzeiro Esporte Clube" caigan en la misma.
 */
export const claveEscudo = (nombre) => {
  const base = normalizarTextoBase(nombre);
  if (!base) return "";

  return base
    .replace(/[.'’-]/g, " ")
    .split(/\s+/)
    .filter(
      (palabra) =>
        palabra &&
        ![
          "ec",
          "sc",
          "fc",
          "ac",
          "ca",
          "cd",
          "cr",
          "af",
          "afc",
          "cf",
          "sad",
          "club",
          "clube",
          "esporte",
          "esportivo",
          "deportivo",
          "atletico",
          "athletico",
          "futebol",
          "futbol",
          "football",
          "regatas",
          "de",
          "del",
          "do",
          "da",
          "el",
          "la",
          "los",
          "las",
        ].includes(palabra),
    )
    .join(" ")
    .trim();
};

export const leerCacheEscudos = () => {
  try {
    const crudo = localStorage.getItem(CLAVE_ESCUDOS);
    const datos = crudo ? JSON.parse(crudo) : null;
    return datos && typeof datos === "object" ? datos : {};
  } catch (error) {
    return {};
  }
};

export const guardarEnCacheEscudos = (clave, entrada) => {
  if (!clave) return;

  try {
    const cache = leerCacheEscudos();
    cache[clave] = entrada;
    localStorage.setItem(CLAVE_ESCUDOS, JSON.stringify(cache));
  } catch (error) {
    // El cache es una comodidad, no algo por lo que valga la pena romper nada.
    console.warn("No se pudo guardar el escudo en el cache local.");
  }
};

const traer = async (url, senal) => {
  const respuesta = await fetch(url, { signal: senal });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return respuesta.json();
};

/**
 * TheSportsDB: es la fuente pensada para esto, devuelve el escudo recortado y
 * con fondo transparente. La clave "3" es la pública de prueba.
 */
const buscarEnSportsDb = async (nombre, senal) => {
  const datos = await traer(
    "https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=" +
      encodeURIComponent(nombre),
    senal,
  );

  const equipo = (datos?.teams || []).find(
    (candidato) => candidato?.strBadge || candidato?.strTeamBadge,
  );
  if (!equipo) return null;

  return {
    url: equipo.strBadge || equipo.strTeamBadge,
    fuente: "thesportsdb",
    nombreOficial: equipo.strTeam || nombre,
  };
};

/**
 * Wikipedia como red de contención: no siempre da el escudo recortado, pero
 * conoce muchos más clubes y no necesita clave. origin=* habilita el CORS.
 */
const buscarEnWikipedia = async (nombre, senal, idioma = "es") => {
  const parametros = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: nombre,
    gsrlimit: "1",
    prop: "pageimages",
    piprop: "original|thumbnail",
    pithumbsize: "240",
    format: "json",
    origin: "*",
  });

  const datos = await traer(
    `https://${idioma}.wikipedia.org/w/api.php?${parametros}`,
    senal,
  );

  const paginas = Object.values(datos?.query?.pages || {});
  const pagina = paginas.find((p) => p?.thumbnail?.source || p?.original?.source);
  if (!pagina) return null;

  return {
    url: pagina.thumbnail?.source || pagina.original?.source,
    fuente: `wikipedia-${idioma}`,
    nombreOficial: pagina.title || nombre,
  };
};

const fuentes = [
  (nombre, senal) => buscarEnSportsDb(nombre, senal),
  (nombre, senal) => buscarEnWikipedia(nombre, senal, "es"),
  (nombre, senal) => buscarEnWikipedia(nombre, senal, "pt"),
];

/**
 * Descarga la imagen y la deja como data URI, así el escudo sigue apareciendo
 * la próxima vez aunque no haya señal en la cancha. Si no se puede (CORS, peso,
 * lo que sea), no es grave: queda la URL, que igual carga con internet.
 */
export const incrustarImagen = async (url, senal) => {
  // Ya viene incrustada: no hay nada que descargar.
  if (String(url).startsWith("data:")) return url;

  try {
    const respuesta = await fetch(url, { signal: senal });
    if (!respuesta.ok) return null;

    const blob = await respuesta.blob();
    if (!blob.size || blob.size > LIMITE_BYTES_GUARDADOS) return null;

    return await new Promise((resolver) => {
      const lector = new FileReader();
      lector.onloadend = () =>
        resolver(
          typeof lector.result === "string" ? lector.result : null,
        );
      lector.onerror = () => resolver(null);
      lector.readAsDataURL(blob);
    });
  } catch (error) {
    return null;
  }
};

/**
 * Busca el escudo de un club recorriendo las fuentes en orden y se queda con
 * la primera que responda. Devuelve null si ninguna lo conoce.
 */
export const buscarEscudo = async (nombre, { senal } = {}) => {
  const consulta = String(nombre || "").trim();
  if (!consulta) return null;

  for (const fuente of fuentes) {
    try {
      const encontrado = await fuente(consulta, senal);
      if (encontrado?.url) return encontrado;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      // Fuente caída o sin CORS: se prueba la siguiente.
    }
  }

  return null;
};

export const entradaVencida = (entrada, ahora = Date.now()) => {
  if (!entrada) return true;

  const edad = ahora - (entrada.ts || 0);
  return entrada.url ? edad > ESPERA_REFRESCO : edad > ESPERA_REINTENTO;
};

const TIEMPO_LIMITE = 8000;

const desdeCache = (entrada) =>
  entrada?.datos || entrada?.url
    ? {
        url: entrada.datos || entrada.url,
        fuente: entrada.fuente || "",
        nombreOficial: entrada.nombreOficial || "",
      }
    : null;

/** Lo que ya está guardado, sin salir a la red. */
export const escudoGuardado = (nombre) => {
  const clave = claveEscudo(nombre);
  return clave ? desdeCache(leerCacheEscudos()[clave]) : null;
};

/** Si lo guardado ya cumplió su tiempo y conviene volver a buscarlo. */
export const escudoVencido = (nombre) => {
  const clave = claveEscudo(nombre);
  if (!clave) return false;
  return entradaVencida(leerCacheEscudos()[clave]);
};

// Vaciar el cache tiene que verse en el momento, y los escudos están repartidos
// por toda la app. Cada uno se anota acá y se entera.
const alVaciar = new Set();

export const alVaciarEscudos = (oyente) => {
  alVaciar.add(oyente);
  return () => alVaciar.delete(oyente);
};

/** Tira todos los escudos guardados para que se vuelvan a bajar. */
export const vaciarCacheEscudos = () => {
  try {
    localStorage.removeItem(CLAVE_ESCUDOS);
  } catch (error) {
    console.warn("No se pudo vaciar el cache de escudos.");
  }

  alVaciar.forEach((oyente) => oyente());
};

const enVuelo = new Map();
let cola = Promise.resolve();

const buscarYGuardar = async (nombre, clave) => {
  const controlador = new AbortController();
  const corte = setTimeout(() => controlador.abort(), TIEMPO_LIMITE);

  try {
    const encontrado = await buscarEscudo(nombre, { senal: controlador.signal });

    if (!encontrado) {
      // Si ya había uno bueno, que la búsqueda falle no es motivo para
      // borrarlo: en la cancha sin señal es mejor el de antes que ninguno.
      const previa = leerCacheEscudos()[clave];
      const anterior = desdeCache(previa);

      if (anterior) {
        guardarEnCacheEscudos(clave, { ...previa, ts: Date.now() });
        return anterior;
      }

      guardarEnCacheEscudos(clave, { url: "", ts: Date.now() });
      return null;
    }

    const datos = await incrustarImagen(encontrado.url, controlador.signal);

    guardarEnCacheEscudos(clave, {
      url: encontrado.url,
      datos: datos || "",
      fuente: encontrado.fuente,
      nombreOficial: encontrado.nombreOficial,
      ts: Date.now(),
    });

    return { ...encontrado, url: datos || encontrado.url };
  } finally {
    clearTimeout(corte);
  }
};

/**
 * El escudo de un club, resuelto de la única forma sensata cuando hay muchos
 * en pantalla: primero el cache, y si hay que buscarlo, de a uno por vez y una
 * sola vez por club. Abrir la lista de registros con veinte rivales no puede
 * disparar veinte pedidos juntos: además de la ráfaga, un límite de la API
 * dejaría veinte "no existe" guardados por un día.
 */
export const obtenerEscudo = (nombre) => {
  const clave = claveEscudo(nombre);
  if (!clave) return Promise.resolve(null);

  const guardado = leerCacheEscudos()[clave];
  const vencida = entradaVencida(guardado);
  const yaEstaba = vencida ? null : desdeCache(guardado);
  if (yaEstaba) return Promise.resolve(yaEstaba);
  if (guardado && !vencida) return Promise.resolve(null);

  if (enVuelo.has(clave)) return enVuelo.get(clave);

  // Mientras esperaba el turno, otro pudo haberlo guardado. Pero uno vencido
  // no sirve: es justo el que se venía a renovar.
  const recienGuardado = () => {
    const entrada = leerCacheEscudos()[clave];
    return entradaVencida(entrada) ? null : desdeCache(entrada);
  };

  const tarea = cola.then(
    () => recienGuardado() || buscarYGuardar(nombre, clave),
    () => buscarYGuardar(nombre, clave),
  );

  enVuelo.set(clave, tarea);
  cola = tarea.then(
    () => enVuelo.delete(clave),
    () => enVuelo.delete(clave),
  );

  return tarea;
};
