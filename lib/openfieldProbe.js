// Lógica pura de la sonda de capacidades de la Connect API.
// Acá no hay red: solo se arma la lista de rutas a consultar y se interpreta
// lo que el servidor respondió. Mantenerlo puro permite testearlo sin tocar OpenField.

export const METODOS_ESCRITURA = ["POST", "PUT", "PATCH", "DELETE"];

// Únicos métodos que la sonda tiene permitido enviar a OpenField.
// Ninguno de los dos crea, modifica ni borra nada.
export const METODOS_SONDA = ["GET", "OPTIONS"];

export const parsearMetodos = (valor) => {
  const vistos = new Set();
  String(valor || "")
    .split(",")
    .map((metodo) => metodo.trim().toUpperCase())
    .filter(Boolean)
    .forEach((metodo) => vistos.add(metodo));
  return [...vistos];
};

// Rutas candidatas. Ninguna se da por existente: la respuesta real decide.
// Primera ronda (26-05 T): /activities/{id} anuncia GET, HEAD y PUT; los
// períodos como recurso son solo lectura y no traen participantes.
// Segunda ronda: dónde se leen los participantes de un período, si la ruta
// anidada /activities/{id}/periods/{pid} acepta escritura, y qué anuncia la
// colección /activities.
export const rutasSonda = ({ activityId, periodId }) => {
  const actividad = `/activities/${encodeURIComponent(activityId)}`;
  const rutas = [
    { clave: "actividades-options", metodo: "OPTIONS", ruta: "/activities" },
    { clave: "actividad-get", metodo: "GET", ruta: actividad },
    { clave: "actividad-options", metodo: "OPTIONS", ruta: actividad },
    { clave: "actividad-periodos-get", metodo: "GET", ruta: `${actividad}/periods` },
    { clave: "actividad-periodos-options", metodo: "OPTIONS", ruta: `${actividad}/periods` },
    { clave: "actividad-atletas-get", metodo: "GET", ruta: `${actividad}/athletes` },
    { clave: "actividad-atletas-options", metodo: "OPTIONS", ruta: `${actividad}/athletes` },
    { clave: "periodos-get", metodo: "GET", ruta: "/periods" },
    { clave: "periodos-options", metodo: "OPTIONS", ruta: "/periods" },
  ];

  if (periodId) {
    const periodo = `/periods/${encodeURIComponent(periodId)}`;
    const anidado = `${actividad}/periods/${encodeURIComponent(periodId)}`;
    rutas.push(
      { clave: "periodo-get", metodo: "GET", ruta: periodo },
      { clave: "periodo-options", metodo: "OPTIONS", ruta: periodo },
      { clave: "periodo-atletas-get", metodo: "GET", ruta: `${periodo}/athletes` },
      { clave: "periodo-atletas-options", metodo: "OPTIONS", ruta: `${periodo}/athletes` },
      { clave: "actividad-periodo-get", metodo: "GET", ruta: anidado },
      { clave: "actividad-periodo-options", metodo: "OPTIONS", ruta: anidado },
    );
  }

  return rutas;
};

export const clasificarEstado = (status) => {
  if (status >= 200 && status < 300) return "responde";
  if (status === 401) return "token-rechazado";
  if (status === 403) return "prohibido";
  if (status === 404) return "ruta-inexistente";
  if (status === 405) return "metodo-no-permitido";
  if (status === 0) return "sin-respuesta";
  return "inconcluso";
};

export const ETIQUETAS_CLASIFICACION = {
  responde: "Responde",
  "token-rechazado": "Token rechazado (401)",
  prohibido: "Prohibido (403)",
  "ruta-inexistente": "Ruta inexistente (404)",
  "metodo-no-permitido": "Método no permitido (405): la ruta existe",
  "sin-respuesta": "Sin respuesta",
  inconcluso: "Inconcluso",
};

// true / false / null: null significa que la respuesta no permite afirmarlo.
// Un 403 puede ser "falta scope" o un gateway que esconde rutas desconocidas,
// así que no se toma partido sin leer el cuerpo.
const rutaExiste = (status, allow) => {
  if (allow.length > 0) return true;
  if (status === 405) return true;
  if (status >= 200 && status < 300) return true;
  if (status === 404) return false;
  return null;
};

export const interpretarRespuesta = ({ status, allow, corsMethods }) => {
  const permitidos = parsearMetodos(allow);

  return {
    clasificacion: clasificarEstado(status),
    rutaExiste: rutaExiste(status, permitidos),
    allow: permitidos,
    // Allow describe al recurso puntual (RFC 7231): es la señal fuerte.
    escrituraAnunciada: METODOS_ESCRITURA.filter((metodo) => permitidos.includes(metodo)),
    // Access-Control-Allow-Methods suele ser global al servidor: solo informativo.
    corsMethods: parsearMetodos(corsMethods),
  };
};

// Describe un cuerpo JSON sin copiar valores: claves y tamaños alcanzan para
// saber qué forma tiene la respuesta y cómo habría que leerla después.
export const describirCuerpo = (texto, { maximoSnippet = 300 } = {}) => {
  const contenido = String(texto || "");
  if (!contenido.trim()) return { tipo: "vacio" };

  let json;
  try {
    json = JSON.parse(contenido);
  } catch {
    return { tipo: "texto", snippet: contenido.slice(0, maximoSnippet) };
  }

  if (Array.isArray(json)) {
    return {
      tipo: "array",
      largo: json.length,
      clavesPrimero: json[0] && typeof json[0] === "object" ? Object.keys(json[0]).slice(0, 25) : [],
    };
  }

  if (json && typeof json === "object") {
    const periodos = Array.isArray(json.periods) ? json.periods : null;
    const primero = periodos?.[0] && typeof periodos[0] === "object" ? periodos[0] : null;

    return {
      tipo: "objeto",
      claves: Object.keys(json).slice(0, 25),
      ...(periodos ? { periodos: periodos.length } : {}),
      ...(primero
        ? {
            muestraPeriodo: {
              claves: Object.keys(primero).slice(0, 25),
              start_time: primero.start_time ?? null,
              end_time: primero.end_time ?? null,
            },
          }
        : {}),
      ...(typeof json.message === "string" ? { message: json.message.slice(0, maximoSnippet) } : {}),
      ...(typeof json.error === "string" ? { error: json.error.slice(0, maximoSnippet) } : {}),
    };
  }

  return { tipo: typeof json, snippet: contenido.slice(0, maximoSnippet) };
};

export const resumirSonda = (resultados) => {
  const lista = Array.isArray(resultados) ? resultados : [];

  if (lista.length === 0) {
    return { veredicto: "sin-datos", detalle: "La sonda no consultó ninguna ruta." };
  }

  const conEscritura = lista.filter((r) => r.escrituraAnunciada?.length > 0);
  const rechazados = lista.filter((r) => r.clasificacion === "token-rechazado");
  const sinRespuesta = lista.filter((r) => r.clasificacion === "sin-respuesta");
  const prohibidos = lista.filter((r) => r.clasificacion === "prohibido");
  const existentes = lista.filter((r) => r.rutaExiste === true);
  const inexistentes = lista.filter((r) => r.rutaExiste === false);

  if (rechazados.length === lista.length) {
    return {
      veredicto: "token-rechazado",
      detalle: "OpenField rechazó el token en todas las rutas (401). Revisá el valor cargado en Vercel.",
    };
  }

  if (sinRespuesta.length === lista.length) {
    return {
      veredicto: "sin-respuesta",
      detalle: "Ninguna ruta respondió. Puede ser un corte de red o un timeout del servidor.",
    };
  }

  if (conEscritura.length > 0) {
    return {
      veredicto: "escritura-anunciada",
      detalle: `El servidor anunció métodos de escritura en: ${conEscritura
        .map((r) => `${r.ruta} (${r.escrituraAnunciada.join(", ")})`)
        .join("; ")}. La escritura por API oficial es posible.`,
      rutas: conEscritura.map((r) => r.ruta),
    };
  }

  if (prohibidos.length > 0) {
    return {
      veredicto: "prohibido",
      detalle: `${prohibidos.length} ruta(s) respondieron 403. Puede faltar scope en el token o el gateway puede estar ocultando rutas desconocidas: el cuerpo de la respuesta decide.`,
      rutas: prohibidos.map((r) => `${r.metodo} ${r.ruta}`),
    };
  }

  if (existentes.length > 0) {
    return {
      veredicto: "sin-escritura-anunciada",
      detalle: `${existentes.length} ruta(s) existen, pero ninguna anunció POST/PUT/PATCH/DELETE. Si el servidor no implementa OPTIONS esto no descarta la escritura: solo descarta que la anuncie.`,
      rutas: existentes.map((r) => `${r.metodo} ${r.ruta}`),
    };
  }

  if (inexistentes.length === lista.length) {
    return {
      veredicto: "rutas-inexistentes",
      detalle: "Todas las rutas consultadas devolvieron 404: la Connect API no expone períodos ni actividades individuales en estas formas.",
    };
  }

  return {
    veredicto: "inconcluso",
    detalle: "Las respuestas no alcanzan para una conclusión. Revisá el detalle de cada ruta.",
  };
};
