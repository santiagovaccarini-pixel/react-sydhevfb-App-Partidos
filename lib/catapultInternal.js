// Lógica pura para probar el "pase" del Cloud Editor contra los servicios
// internos de Catapult. El pase es el access_token que devuelve
// POST /api/v6/oauth/token al iniciar sesión (observado en la inspección).
// Acá no hay red y nunca se devuelve el valor del token: solo se arman las
// rutas candidatas, la cabecera de cookies y el veredicto.

export const BACKEND_BASE_DEFAULT = "https://backend-us.openfield.catapultsports.com";

// Host del servicio que recibe el PUT /activities/{id}/batch del editor,
// observado en DevTools por el usuario. La inspección de carga no lo mostró
// porque el editor se deslogueó antes de leer la actividad: por eso se prueba
// acá, con el pase, y solo con GET.
export const ACTIVITY_SERVICE_BASE_DEFAULT =
  "https://of-uw1-prod-activity-service.openfield.catapultsports.com";

const limpiarBase = (valor, porDefecto) => String(valor || porDefecto).replace(/\/+$/, "");

export const candidatosInternos = ({ activityId, backendBase, activityServiceBase }) => {
  const id = encodeURIComponent(String(activityId || ""));
  const backend = limpiarBase(backendBase, BACKEND_BASE_DEFAULT);
  const servicio = limpiarBase(activityServiceBase, ACTIVITY_SERVICE_BASE_DEFAULT);

  return [
    {
      clave: "servicio-actividad",
      descripcion: "Servicio interno de actividad, con el pase",
      metodo: "GET",
      url: `${servicio}/activities/${id}`,
      conCookies: false,
    },
    {
      clave: "servicio-actividad-periodos",
      descripcion: "Períodos en el servicio interno, con el pase",
      metodo: "GET",
      url: `${servicio}/activities/${id}/periods`,
      conCookies: false,
    },
    {
      clave: "backend-v6-pase",
      descripcion: "Backend principal, con el pase",
      metodo: "GET",
      url: `${backend}/api/v6/activities/${id}`,
      conCookies: false,
    },
    {
      clave: "backend-v6-sesion",
      descripcion: "Backend principal, con la sesión (cookies)",
      metodo: "GET",
      url: `${backend}/api/v6/activities/${id}`,
      conCookies: true,
    },
  ];
};

const dominioCoincide = (host, domain) => {
  const d = String(domain || "")
    .replace(/^\./, "")
    .toLowerCase();
  const h = String(host || "").toLowerCase();
  return Boolean(d) && (h === d || h.endsWith(`.${d}`));
};

// Cookies que el navegador mandaría a ese host, en formato de cabecera.
export const cabeceraCookies = (cookies, host) =>
  (Array.isArray(cookies) ? cookies : [])
    .filter((cookie) => cookie?.name && dominioCoincide(host, cookie.domain))
    .map((cookie) => `${cookie.name}=${cookie.value ?? ""}`)
    .join("; ");

// Extrae lo necesario de la respuesta de /oauth/token sin conservar nada
// que no haga falta. El refresh_token no se guarda: solo se anota si vino.
export const extraerTokenOauth = (json) => {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;

  const accessToken = json.access_token;
  if (typeof accessToken !== "string" || !accessToken) return null;

  const expiresIn = Number(json.expires_in);

  return {
    accessToken,
    tokenType: typeof json.token_type === "string" && json.token_type ? json.token_type : "Bearer",
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : null,
    tieneRefresh: typeof json.refresh_token === "string" && json.refresh_token.length > 0,
  };
};

const exitoso = (r) => r.status >= 200 && r.status < 300;

export const resumirInterno = (resultados = [], { tokenCapturado = false } = {}) => {
  const lista = Array.isArray(resultados) ? resultados : [];

  if (!tokenCapturado) {
    return {
      veredicto: "sin-pase",
      detalle:
        "El login terminó pero no se vio la respuesta de /oauth/token: no hay pase para probar.",
    };
  }

  const servicio = lista.filter((r) => String(r.clave || "").startsWith("servicio-actividad"));
  const servicioOk = servicio.filter(exitoso);
  const ok = lista.filter(exitoso);
  const rechazados = lista.filter((r) => r.status === 401 || r.status === 403);
  const sinRespuesta = lista.filter((r) => !r.status);

  if (servicioOk.length > 0) {
    return {
      veredicto: "pase-abre-servicio",
      detalle: `El pase abre el servicio interno de actividad (${servicioOk
        .map((r) => r.clave)
        .join(", ")}). Es la misma puerta que usa el editor para escribir.`,
      rutas: servicioOk.map((r) => r.clave),
    };
  }

  if (ok.length > 0) {
    return {
      veredicto: "pase-abre-backend",
      detalle: `El pase abre ${ok.map((r) => r.clave).join(", ")}, pero el servicio interno de actividad respondió ${servicio
        .map((r) => r.status || "sin respuesta")
        .join(" / ")}. Falta confirmar el host correcto de ese servicio.`,
      rutas: ok.map((r) => r.clave),
    };
  }

  if (lista.length > 0 && rechazados.length === lista.length) {
    return {
      veredicto: "pase-rechazado",
      detalle: "Todas las rutas internas rechazaron el pase (401/403).",
    };
  }

  if (lista.length > 0 && sinRespuesta.length === lista.length) {
    return {
      veredicto: "sin-respuesta",
      detalle: "Ninguna ruta interna respondió: red caída o hosts inexistentes.",
    };
  }

  return {
    veredicto: "inconcluso",
    detalle: "Las respuestas no alcanzan para una conclusión; revisá cada ruta.",
  };
};
