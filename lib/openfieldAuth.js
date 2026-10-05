import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://gwzebinonoaaxtdkpqem.supabase.co";

export const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_Sj4GFkR23dsbe07y04-YRA_JlVDBPan";

// Extrae el access token de Supabase del header Authorization, si viene.
export const tokenBearer = (request) => {
  const cabecera = String(request?.headers?.authorization || "");
  const coincidencia = cabecera.match(/^Bearer\s+(.+)$/i);
  return coincidencia?.[1]?.trim() || "";
};

export const OPENFIELD_SESSION_COOKIE = "openfield_session";

// La cookie lleva versión: al cambiar su formato (o la regla con que se
// entrega), las viejas dejan de valer. La 3 es la que mira la membresía del
// club en vez de los permisos viejos de perfiles: al publicarla, las cookies
// de antes quedan vencidas y la app pide otra sola.
export const VERSION_COOKIE = 3;

// Cuánto dura la cookie: poco, porque las rutas de lectura no vuelven a
// preguntarle a la base. A quien le sacan Flujo diario, lo dan de baja del
// club o le bloquean la cuenta, la cookie le dura como mucho 10 minutos;
// pasado eso la app la renueva sola con su token de Supabase (pedirJson y
// OpenFieldSession) y ahí la base vuelve a decidir. Nunca más allá del
// vencimiento del token más un margen, ni menos de 5 minutos.
export const SESSION_MARGEN_SECONDS = 15 * 60;
export const SESSION_MIN_SECONDS = 5 * 60;
export const SESSION_MAX_SECONDS = 10 * 60;
export const SESSION_DEFAULT_SECONDS = 10 * 60;

const LARGO_MINIMO_SECRETO = 32;

const normalizarEmail = (valor) => String(valor || "").trim().toLowerCase();

// Cliente que actúa como el usuario: Supabase aplica RLS con su token.
export const clienteComoUsuario = (token) =>
  createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

// La clave que firma la cookie sale de OPENFIELD_SESSION_SECRET (un secreto
// propio, de 32 caracteres o más). Mientras no esté cargada, se deriva del
// token de Catapult como hasta ahora, para que el despliegue no dependa de
// cargarla primero. Cambiar el secreto invalida todas las cookies de golpe.
export const secretoSesionPropio = () => {
  const secreto = String(process.env.OPENFIELD_SESSION_SECRET || "");
  return secreto.length >= LARGO_MINIMO_SECRETO ? secreto : "";
};

const claveSesion = () => {
  const secreto = secretoSesionPropio() || process.env.OPENFIELD_API_TOKEN;
  if (!secreto) return null;
  return createHash("sha256").update(`openfield-session:${secreto}`).digest();
};

const firmar = (payloadCodificado) => {
  const clave = claveSesion();
  if (!clave) return null;
  return createHmac("sha256", clave).update(payloadCodificado).digest("base64url");
};

const leerCookies = (cabecera = "") =>
  cabecera.split(";").reduce((acc, parte) => {
    const indice = parte.indexOf("=");
    if (indice < 0) return acc;
    const nombre = parte.slice(0, indice).trim();
    const valor = parte.slice(indice + 1).trim();
    if (nombre) acc[nombre] = valor;
    return acc;
  }, {});

const validarFirma = (payloadCodificado, firmaRecibida) => {
  const firmaEsperada = firmar(payloadCodificado);
  if (!firmaEsperada || !firmaRecibida) return false;

  const esperada = Buffer.from(firmaEsperada);
  const recibida = Buffer.from(firmaRecibida);
  if (esperada.length !== recibida.length) return false;

  return timingSafeEqual(esperada, recibida);
};

// El vencimiento (exp, en segundos) del token de Supabase. Se lee sin
// verificar la firma: la verificó auth.getUser antes de llegar acá.
export const expDelJwt = (token) => {
  try {
    const partes = String(token || "").split(".");
    if (partes.length < 2) return null;
    const payload = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
    return Number.isFinite(payload?.exp) ? Number(payload.exp) : null;
  } catch {
    return null;
  }
};

const noAutenticado = (status, code, error) => ({ ok: false, status, code, error });

// Quién es (token de Supabase) y si puede usar Flujo diario, con su propio
// token: el estado de la cuenta y si es el dueño de la plataforma salen de
// su fila de perfiles (la base le muestra solo la suya); Flujo diario, de
// sus membresías (puede_usar('flujo'): lo tiene en algún club donde sigue).
// Los permisos viejos de perfiles (partido, flujo) ya no cuentan: quien se
// fue del club no entra aunque los tenga, y quien entró por invitación con
// Flujo diario entra aunque no los tenga.
export const autenticarBearerSupabase = async (request) => {
  const accessToken = tokenBearer(request);
  if (!accessToken) {
    return noAutenticado(401, "SIN_SESION", "Iniciá sesión para acceder a OpenField.");
  }

  const supabase = clienteComoUsuario(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  const user = data?.user;

  if (error || !user?.id || !user?.email) {
    return noAutenticado(401, "SESION_INVALIDA", "La sesión venció o no es válida.");
  }

  const [lecturaPerfil, lecturaFlujo] = await Promise.all([
    supabase.from("perfiles").select("estado, admin").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("puede_usar", { modulo: "flujo" }),
  ]);
  const perfil = lecturaPerfil?.data;

  // Si la base no contesta, no se deja pasar: se avisa que reintente.
  if (lecturaPerfil?.error || lecturaFlujo?.error) {
    return noAutenticado(
      503,
      "PERFIL_NO_LEGIBLE",
      "No se pudo comprobar tu cuenta. Probá de nuevo en un momento.",
    );
  }

  const estado = perfil?.estado || "pendiente";
  if (estado === "bloqueado") {
    return noAutenticado(403, "BLOQUEADO", "Tu cuenta no tiene acceso.");
  }
  if (estado !== "autorizado") {
    return noAutenticado(403, "PENDIENTE", "Tu cuenta todavía no fue autorizada.");
  }
  // El dueño de la plataforma entra siempre (las pruebas técnicas son suyas);
  // el resto, con Flujo diario en un club donde sigue.
  if (!(perfil.admin === true || lecturaFlujo?.data === true)) {
    return noAutenticado(403, "SIN_PERMISO", "Tu cuenta no tiene Flujo diario en ningún club donde estés.");
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: normalizarEmail(user.email),
      rol: perfil.admin ? "admin" : "usuario",
    },
    jwtExp: expDelJwt(accessToken),
  };
};

export const crearCookieSesionOpenField = (user, { jwtExp } = {}) => {
  const ahora = Math.floor(Date.now() / 1000);
  const pedido = Number.isFinite(jwtExp)
    ? Number(jwtExp) + SESSION_MARGEN_SECONDS
    : ahora + SESSION_DEFAULT_SECONDS;
  const exp = Math.min(Math.max(pedido, ahora + SESSION_MIN_SECONDS), ahora + SESSION_MAX_SECONDS);
  const payload = {
    v: VERSION_COOKIE,
    sub: user.id,
    email: normalizarEmail(user.email),
    rol: user.rol === "admin" ? "admin" : "usuario",
    iat: ahora,
    exp,
  };

  const codificado = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const firma = firmar(codificado);

  if (!firma) return null;

  return `${OPENFIELD_SESSION_COOKIE}=${codificado}.${firma}; Path=/; Max-Age=${exp - ahora}; HttpOnly; Secure; SameSite=Lax`;
};

export const borrarCookieSesionOpenField = () =>
  `${OPENFIELD_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

// Síncrona y sin red: las rutas de lectura la llaman en cada pedido.
export const autenticarCookieOpenField = (request) => {
  const cookies = leerCookies(String(request.headers?.cookie || ""));
  const valor = cookies[OPENFIELD_SESSION_COOKIE];

  if (!valor) {
    return noAutenticado(401, "SIN_SESION", "Iniciá sesión para acceder a OpenField.");
  }

  const separador = valor.lastIndexOf(".");
  if (separador <= 0) {
    return noAutenticado(401, "SESION_INVALIDA", "La sesión de OpenField no es válida.");
  }

  const codificado = valor.slice(0, separador);
  const firma = valor.slice(separador + 1);

  if (!validarFirma(codificado, firma)) {
    return noAutenticado(401, "SESION_INVALIDA", "La sesión de OpenField no es válida.");
  }

  try {
    const payload = JSON.parse(Buffer.from(codificado, "base64url").toString("utf8"));
    const ahora = Math.floor(Date.now() / 1000);

    if (payload?.v !== VERSION_COOKIE) {
      return noAutenticado(401, "SESION_VENCIDA", "La sesión de OpenField venció. Volvé a entrar.");
    }
    if (!payload?.sub || !payload?.email || !Number.isFinite(payload?.exp)) {
      return noAutenticado(401, "SESION_INVALIDA", "La sesión de OpenField no es válida.");
    }
    if (payload.exp <= ahora) {
      return noAutenticado(401, "SESION_VENCIDA", "La sesión de OpenField venció. Volvé a entrar.");
    }

    return {
      ok: true,
      user: {
        id: String(payload.sub),
        email: normalizarEmail(payload.email),
        rol: payload.rol === "admin" ? "admin" : "usuario",
      },
    };
  } catch {
    return noAutenticado(401, "SESION_INVALIDA", "La sesión de OpenField no es válida.");
  }
};

// Solo el administrador: para las rutas que escriben de prueba en OpenField.
export const exigirAdmin = (auth) => {
  if (!auth.ok) return auth;
  if (auth.user?.rol === "admin") return auth;
  return noAutenticado(403, "SOLO_ADMIN", "Solo el administrador puede hacer esto.");
};

// Respuesta uniforme cuando no se pudo entrar: viaja el código, así la app
// distingue una sesión vencida (se renueva sola) de una cuenta sin permiso.
export const responderNoAutenticado = (response, auth) =>
  response.status(auth.status).json({ ok: false, code: auth.code || null, error: auth.error });
