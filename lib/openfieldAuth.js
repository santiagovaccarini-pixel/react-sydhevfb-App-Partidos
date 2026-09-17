import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://gwzebinonoaaxtdkpqem.supabase.co";

const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_Sj4GFkR23dsbe07y04-YRA_JlVDBPan";

export const OPENFIELD_SESSION_COOKIE = "openfield_session";
const SESSION_SECONDS = 8 * 60 * 60;

const normalizarEmail = (valor) => String(valor || "").trim().toLowerCase();

const correosPermitidos = () =>
  String(process.env.OPENFIELD_ALLOWED_EMAILS || "")
    .split(",")
    .map(normalizarEmail)
    .filter(Boolean);

const emailPermitido = (email) => {
  const permitidos = correosPermitidos();
  if (permitidos.length === 0) return false;
  return permitidos.includes(normalizarEmail(email));
};

const claveSesion = () => {
  const token = process.env.OPENFIELD_API_TOKEN;
  if (!token) return null;
  return createHash("sha256").update(`openfield-session:${token}`).digest();
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

export const autenticarBearerSupabase = async (request) => {
  if (correosPermitidos().length === 0) {
    return {
      ok: false,
      status: 503,
      error: "El acceso a OpenField todavía no tiene usuarios autorizados configurados.",
    };
  }

  const cabecera = String(request.headers?.authorization || "");
  const coincidencia = cabecera.match(/^Bearer\s+(.+)$/i);
  const accessToken = coincidencia?.[1]?.trim();

  if (!accessToken) {
    return { ok: false, status: 401, error: "Iniciá sesión para acceder a OpenField." };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  const user = data?.user;

  if (error || !user?.id || !user?.email) {
    return { ok: false, status: 401, error: "La sesión venció o no es válida." };
  }

  if (!emailPermitido(user.email)) {
    return {
      ok: false,
      status: 403,
      error: "Tu usuario no tiene permiso para acceder a OpenField.",
    };
  }

  return { ok: true, user: { id: user.id, email: normalizarEmail(user.email) } };
};

export const crearCookieSesionOpenField = (user) => {
  const ahora = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    email: normalizarEmail(user.email),
    iat: ahora,
    exp: ahora + SESSION_SECONDS,
  };

  const codificado = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const firma = firmar(codificado);

  if (!firma) return null;

  return `${OPENFIELD_SESSION_COOKIE}=${codificado}.${firma}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
};

export const borrarCookieSesionOpenField = () =>
  `${OPENFIELD_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export const autenticarCookieOpenField = (request) => {
  if (correosPermitidos().length === 0) {
    return {
      ok: false,
      status: 503,
      error: "El acceso a OpenField todavía no tiene usuarios autorizados configurados.",
    };
  }

  const cookies = leerCookies(String(request.headers?.cookie || ""));
  const valor = cookies[OPENFIELD_SESSION_COOKIE];

  if (!valor) {
    return { ok: false, status: 401, error: "Iniciá sesión para acceder a OpenField." };
  }

  const separador = valor.lastIndexOf(".");
  if (separador <= 0) {
    return { ok: false, status: 401, error: "La sesión de OpenField no es válida." };
  }

  const codificado = valor.slice(0, separador);
  const firma = valor.slice(separador + 1);

  if (!validarFirma(codificado, firma)) {
    return { ok: false, status: 401, error: "La sesión de OpenField no es válida." };
  }

  try {
    const payload = JSON.parse(Buffer.from(codificado, "base64url").toString("utf8"));
    const ahora = Math.floor(Date.now() / 1000);

    if (!payload?.sub || !payload?.email || !payload?.exp || payload.exp <= ahora) {
      return { ok: false, status: 401, error: "La sesión de OpenField venció." };
    }

    if (!emailPermitido(payload.email)) {
      return {
        ok: false,
        status: 403,
        error: "Tu usuario ya no tiene permiso para acceder a OpenField.",
      };
    }

    return {
      ok: true,
      user: { id: String(payload.sub), email: normalizarEmail(payload.email) },
    };
  } catch {
    return { ok: false, status: 401, error: "La sesión de OpenField no es válida." };
  }
};
