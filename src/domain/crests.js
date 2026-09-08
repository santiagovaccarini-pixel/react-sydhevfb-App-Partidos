import { normalizarTextoBase } from "./match";

export const CLAVE_ESCUDOS = "escudos_rivales";

// Un fallido se recuerda un día: si la API no conoce al club, no tiene sentido
// volver a preguntar en cada tecla, pero tampoco quedarse pegado para siempre.
export const ESPERA_REINTENTO = 24 * 60 * 60 * 1000;

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

export const entradaVencida = (entrada, ahora = Date.now()) =>
  !entrada || (!entrada.url && ahora - (entrada.ts || 0) > ESPERA_REINTENTO);
