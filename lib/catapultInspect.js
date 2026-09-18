// Interpretación pura de lo que el Cloud Editor hace por la red: qué hosts
// llama, con qué credencial y qué forma tiene. Nunca guarda ni expone el
// valor de un token, una cookie o una contraseña: solo nombres, esquemas,
// largos y claims no sensibles.

export const esHostCatapult = (host) => /(^|\.)catapultsports\.com$/i.test(String(host || ""));

export const esHostAuth = (host) =>
  /(^|\.)(auth0\.com|amazoncognito\.com|amazonaws\.com|okta\.com|microsoftonline\.com|accounts\.google\.com)$/i.test(
    String(host || ""),
  );

// Recursos que no aportan nada a la inspección (scripts, estilos, imágenes).
export const TIPOS_RED = new Set(["xhr", "fetch", "document", "websocket"]);

const CLAIMS_VISIBLES = ["iss", "aud", "exp", "iat", "nbf", "scope", "azp", "token_use", "client_id"];

const HEADERS_ESPECIALES = /api[-_]?key|x-auth|x-token|x-session|x-tenant|x-customer|x-org|x-client|x-app/i;

const decodificarJwt = (token) => {
  const partes = String(token || "").split(".");
  if (partes.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
};

// Resume el header Authorization sin copiar el token: esquema, formato,
// largo y, si es un JWT, los claims que describen al emisor y la vigencia.
export const describirAutorizacion = (headers = {}) => {
  const nombres = Object.keys(headers || {});
  const especiales = nombres.filter((nombre) => HEADERS_ESPECIALES.test(nombre)).sort();
  const auth = headers.authorization ?? headers.Authorization;

  if (!auth) {
    return especiales.length > 0 ? { esquema: null, headersEspeciales: especiales } : null;
  }

  const [esquema, ...resto] = String(auth).trim().split(/\s+/);
  const token = resto.join(" ");
  const claims = decodificarJwt(token);

  return {
    esquema: esquema || null,
    largo: token.length,
    formato: claims ? "JWT" : "opaco",
    ...(claims
      ? {
          claims: Object.fromEntries(
            CLAIMS_VISIBLES.filter((clave) => claims[clave] !== undefined).map((clave) => [
              clave,
              claims[clave],
            ]),
          ),
          claimNombres: Object.keys(claims).sort(),
          expira: typeof claims.exp === "number" ? new Date(claims.exp * 1000).toISOString() : null,
        }
      : {}),
    headersEspeciales: especiales,
  };
};

// Forma de un cuerpo enviado: solo claves de primer nivel o largo. Nunca un
// fragmento del texto, porque el login lleva la contraseña.
export const describirEnvio = (texto) => {
  const contenido = String(texto || "");
  if (!contenido) return null;

  try {
    const json = JSON.parse(contenido);
    if (Array.isArray(json)) return { tipo: "array", largo: json.length };
    if (json && typeof json === "object") {
      return { tipo: "objeto", claves: Object.keys(json).slice(0, 25) };
    }
    return { tipo: typeof json };
  } catch {
    return { tipo: "texto", largo: contenido.length };
  }
};

export const resumirCapturas = (solicitudes = []) => {
  const lista = Array.isArray(solicitudes) ? solicitudes : [];
  const catapult = lista.filter((s) => esHostCatapult(s.host));
  const conAuth = catapult.filter((s) => s.autorizacion?.esquema);
  const servicioActividad = catapult.filter((s) => /activity-service/i.test(String(s.host || "")));
  const servicioConAuth = servicioActividad.filter((s) => s.autorizacion?.esquema);
  const proveedorAuth = [...new Set(lista.filter((s) => esHostAuth(s.host)).map((s) => s.host))];
  const esquemas = [
    ...new Set(conAuth.map((s) => `${s.autorizacion.esquema} (${s.autorizacion.formato})`)),
  ];

  const base = {
    hostsCatapult: [...new Set(catapult.map((s) => s.host))],
    solicitudesCatapult: catapult.length,
    conAutorizacion: conAuth.length,
    esquemas,
    proveedorAuth,
    servicioActividad: servicioActividad
      .slice(0, 20)
      .map((s) => `${s.metodo} ${s.path} → ${s.status ?? "sin respuesta"}`),
    autorizacionEjemplo: (servicioConAuth[0] || conAuth[0])?.autorizacion || null,
  };

  if (catapult.length === 0) {
    return {
      ...base,
      veredicto: "sin-trafico",
      detalle: "No se capturó ningún pedido a Catapult: el login o el editor no llegaron a cargar.",
    };
  }

  if (servicioActividad.length === 0) {
    return {
      ...base,
      veredicto: "sin-servicio-interno",
      detalle:
        "El editor cargó, pero no llamó al servicio interno de actividad durante la carga. Hay que mirar por qué host lee la actividad.",
    };
  }

  if (servicioConAuth.length > 0) {
    const ejemplo = servicioConAuth[0].autorizacion;
    return {
      ...base,
      veredicto: "credencial-observada",
      detalle: `El servicio interno de actividad recibe Authorization ${ejemplo.esquema} (${ejemplo.formato}${
        ejemplo.expira ? `, vence ${ejemplo.expira}` : ""
      }). Esa es la credencial a capturar para escribir por la misma puerta que el editor.`,
    };
  }

  const especiales = [
    ...new Set(servicioActividad.flatMap((s) => s.autorizacion?.headersEspeciales || [])),
  ];

  return {
    ...base,
    veredicto: "sin-authorization-visible",
    detalle: `El servicio interno se llamó sin header Authorization: la sesión viaja por cookie u otro header${
      especiales.length > 0 ? ` (${especiales.join(", ")})` : ""
    }. Hay que mirar las cookies capturadas.`,
  };
};
