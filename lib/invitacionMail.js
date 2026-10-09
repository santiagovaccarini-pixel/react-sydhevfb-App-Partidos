import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, clienteComoUsuario, tokenBearer } from "./openfieldAuth.js";

// El mail de una invitación a un club (Cuentas › Invitar y Reenviar mail).
//
// Quién puede: lo decide la base. La invitación se lee con el token de quien
// pide, así que solo la ve el administrador de ese club (o el dueño de la
// plataforma); para cualquier otro no existe. El mail va siempre al correo
// de la invitación guardada: nada del pedido elige a quién se le escribe.
//
// Lo manda Supabase (Auth › invitar, con el SMTP propio del proyecto), con
// una clave del servidor que nunca sale de acá: SUPABASE_SECRET_KEY (o la
// vieja SUPABASE_SERVICE_ROLE_KEY). No se registra ni se devuelve.
//
// Mientras "Confirm email" esté apagado en Supabase no se manda nada: así,
// quien sepa un correo invitado crea la cuenta con ese correo sin abrir el
// buzón y se queda con la cuenta que creó la invitación. Supabase lo dice en
// /auth/v1/settings (mailer_autoconfirm).

export const APP_URL_POR_DEFECTO = "https://react-sydhevfb-app-partidos.vercel.app";
export const IDIOMAS_DEL_MAIL = ["es-AR", "pt-BR"];

const FORMA_DE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LARGO_MAXIMO_CLUB = 120;
const TOPE_AJUSTES_MS = 8000;

const TEXTOS = {
  SIN_SESION: "Iniciá sesión para mandar invitaciones.",
  SESION_INVALIDA: "La sesión venció o no es válida.",
  PEDIDO_INVALIDO: "Falta la invitación.",
  NO_ENCONTRADA: "No se encontró esa invitación.",
  LECTURA_FALLIDA: "No se pudo leer la invitación. Probá de nuevo.",
  INVITACION_USADA: "Esa invitación ya se usó.",
  INVITACION_CANCELADA: "Esa invitación se canceló.",
  INVITACION_VENCIDA: "Esa invitación venció.",
  AJUSTES_NO_LEGIBLES: "No se pudo comprobar la configuración del correo. Probá de nuevo.",
  CONFIRMACION_APAGADA: "Los mails se activan cuando se prenda la confirmación de correo.",
  SIN_CLAVE_SERVIDOR: "Falta la clave del servidor para mandar mails.",
  LIMITE_DE_MAILS: "Se mandaron muchos mails seguidos. Probá en un rato.",
  ENVIO_FALLIDO: "El mail no salió. Probá de nuevo.",
};

const respuesta = (status, cuerpo) => ({ status, cuerpo });
const fallo = (status, code) => respuesta(status, { ok: false, code, error: TEXTOS[code] || TEXTOS.ENVIO_FALLIDO });

// La clave del servidor: la nueva (sb_secret_…) o, si no está, la legacy
// service_role. Nunca una VITE_: esas terminan en el navegador.
export const claveDelServidor = (env = process.env) =>
  String(env?.SUPABASE_SECRET_KEY || "").trim() || String(env?.SUPABASE_SERVICE_ROLE_KEY || "").trim();

// Adónde vuelve el enlace del mail: la app publicada (APP_URL o la de
// producción). Supabase solo lo respeta si está en sus Redirect URLs.
export const urlDeLaApp = (env = process.env) => {
  try {
    const url = new URL(String(env?.APP_URL || "").trim());
    if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
  } catch {
    // Sin APP_URL (o mal escrita) vale la de producción.
  }
  return APP_URL_POR_DEFECTO;
};

export const leerCuerpo = (request) => {
  const cuerpo = request?.body;
  if (cuerpo && typeof cuerpo === "object") return cuerpo;
  if (typeof cuerpo !== "string") return {};
  try {
    const leido = JSON.parse(cuerpo);
    return leido && typeof leido === "object" ? leido : {};
  } catch {
    return {};
  }
};

// Si "Confirm email" está prendido. Se pregunta en cada envío: es público
// (sirve la clave publishable) y es lo que hace seguro mandar invitaciones.
export const leerAjustesDeAuth = async ({ url = SUPABASE_URL, clave = SUPABASE_KEY, pedir = fetch } = {}) => {
  try {
    const contestacion = await pedir(`${url}/auth/v1/settings`, {
      headers: { apikey: clave, Accept: "application/json" },
      signal: AbortSignal.timeout(TOPE_AJUSTES_MS),
    });
    if (!contestacion?.ok) return { ok: false };
    const ajustes = await contestacion.json();
    return { ok: true, autoconfirm: ajustes?.mailer_autoconfirm };
  } catch {
    return { ok: false };
  }
};

export const clienteDelServidor = (clave) =>
  createClient(SUPABASE_URL, clave, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

// Una contraseña que nadie conoce: no se guarda, no se registra ni se
// devuelve. 64 caracteres al azar más una minúscula, una mayúscula, un número
// y un signo, por si Supabase exige de cada tipo (el tope es 72).
export const contrasenaAlAzar = () => `${randomBytes(48).toString("base64url")}aA1!`;

// Si el correo ya tiene una cuenta sin confirmar, antes de mandar el mail:
// - Se le cambia la contraseña por una al azar. Esa cuenta pudo crearla
//   cualquiera que sepa el correo ("Crear una cuenta" con una contraseña
//   suya): al abrir el mail, Supabase confirma el correo, conserva la
//   contraseña que tenga y la base la suma al club. Así, quien la puso no
//   entra; el invitado elige la suya en la bienvenida.
// - Se le ponen el club y el idioma de esta invitación: Supabase reenvía con
//   los datos de la cuenta, no con los nuevos (el mail diría el club de antes).
// Va antes del envío: cambiar la contraseña después anularía el enlace recién
// mandado. A una cuenta confirmada no se le toca nada (ni se le manda el
// mail); que lo esté lo dice Supabase, no solo la copia de `perfiles`.
// Devuelve null si se puede mandar, o el error que lo impide: sin comprobar
// la cuenta o sin cambiarle la contraseña, el mail no sale.
const prepararCuentaSinConfirmar = async (servidor, correo, datos) => {
  const { data, error } = await servidor.from("perfiles").select("user_id, confirmado_en").eq("email", correo).limit(1);
  if (error || !Array.isArray(data)) return error || { code: "perfiles_ilegibles" };
  const cuenta = data[0];
  if (!cuenta?.user_id || cuenta.confirmado_en) return null;

  const { data: leida, error: errorLectura } = await servidor.auth.admin.getUserById(cuenta.user_id);
  if (errorLectura || !leida?.user) return errorLectura || { code: "cuenta_ilegible" };
  if (String(leida.user.email || "").trim().toLowerCase() !== correo) return { code: "cuenta_distinta" };
  if (leida.user.email_confirmed_at) return null;

  const { error: errorCambio } = await servidor.auth.admin.updateUserById(cuenta.user_id, {
    password: contrasenaAlAzar(),
    user_metadata: datos,
  });
  return errorCambio || null;
};

const yaTieneCuenta = (error) =>
  error?.code === "email_exists" || (error?.status === 422 && /already been registered/i.test(String(error?.message || "")));

const esLimite = (error) => error?.status === 429 || error?.code === "over_email_send_rate_limit";

// Manda (o reenvía) el mail de una invitación. Devuelve { status, cuerpo }.
export const enviarInvitacion = async ({
  token,
  cuerpo,
  env = process.env,
  comoUsuario = clienteComoUsuario,
  comoServidor = clienteDelServidor,
  leerAjustes = leerAjustesDeAuth,
  ahora = Date.now,
  avisar = console.error,
} = {}) => {
  if (!token) return fallo(401, "SIN_SESION");

  const invitacionId = String(cuerpo?.invitacion || "").trim();
  if (!FORMA_DE_UUID.test(invitacionId)) return fallo(400, "PEDIDO_INVALIDO");
  const idioma = IDIOMAS_DEL_MAIL.includes(cuerpo?.idioma) ? cuerpo.idioma : IDIOMAS_DEL_MAIL[0];

  const usuario = comoUsuario(token);
  const { data: sesion, error: errorSesion } = await usuario.auth.getUser(token);
  if (errorSesion || !sesion?.user?.id) return fallo(401, "SESION_INVALIDA");

  // Con el token de quien pide: si no administra ese club, no la ve.
  const { data: invitacion, error: errorLectura } = await usuario
    .from("club_invitaciones")
    .select("id, email, equipo_id, vence_en, usada_en, cancelada_en")
    .eq("id", invitacionId)
    .maybeSingle();
  if (errorLectura) return fallo(502, "LECTURA_FALLIDA");
  if (!invitacion?.email) return fallo(404, "NO_ENCONTRADA");
  if (invitacion.usada_en) return fallo(409, "INVITACION_USADA");
  if (invitacion.cancelada_en) return fallo(409, "INVITACION_CANCELADA");
  const vence = Date.parse(invitacion.vence_en || "");
  if (!Number.isFinite(vence) || vence <= ahora()) return fallo(409, "INVITACION_VENCIDA");

  const ajustes = await leerAjustes();
  if (!ajustes?.ok) return fallo(502, "AJUSTES_NO_LEGIBLES");
  if (ajustes.autoconfirm !== false) return fallo(409, "CONFIRMACION_APAGADA");

  const clave = claveDelServidor(env);
  if (!clave) return fallo(503, "SIN_CLAVE_SERVIDOR");

  // El nombre del club para el mail. Si no se puede leer, el mail sale sin él.
  const { data: club } = await usuario.from("equipos").select("nombre").eq("id", invitacion.equipo_id).maybeSingle();
  const datos = { club: String(club?.nombre || "").trim().slice(0, LARGO_MAXIMO_CLUB), idioma };

  const correo = String(invitacion.email).trim().toLowerCase();
  try {
    const servidor = comoServidor(clave);
    const errorCuenta = await prepararCuentaSinConfirmar(servidor, correo, datos);
    if (errorCuenta) {
      avisar("invitar: no se preparó la cuenta sin confirmar", { status: errorCuenta?.status ?? null, code: errorCuenta?.code ?? null });
      return fallo(502, "ENVIO_FALLIDO");
    }
    const { error } = await servidor.auth.admin.inviteUserByEmail(correo, {
      redirectTo: `${urlDeLaApp(env)}/?invitacion=1`,
      data: datos,
    });
    if (!error) return respuesta(200, { ok: true, enviado: true });
    // Ya tiene la cuenta confirmada: la base ya la hizo entrar con la
    // invitación (o la hace entrar sola); no hace falta el mail.
    if (yaTieneCuenta(error)) return respuesta(200, { ok: true, enviado: false, yaTieneCuenta: true });
    if (esLimite(error)) return fallo(429, "LIMITE_DE_MAILS");
    // Para entender qué pasó en los registros de Vercel: solo el estado y el
    // código de Supabase (nada del correo ni de la clave).
    avisar("invitar: Supabase no mandó el mail", { status: error?.status ?? null, code: error?.code ?? null });
    return fallo(502, "ENVIO_FALLIDO");
  } catch (errorEnvio) {
    avisar("invitar: falló el envío", { nombre: errorEnvio?.name || "Error" });
    return fallo(502, "ENVIO_FALLIDO");
  }
};

// La función de Vercel (api/invitar.js): solo POST, nada en caché.
export const atenderInvitar = async (request, response, opciones = {}) => {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Robots-Tag", "noindex");
  response.setHeader("Vary", "Authorization");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, code: "METODO_NO_PERMITIDO", error: "Método no permitido" });
  }

  try {
    const { status, cuerpo } = await enviarInvitacion({ ...opciones, token: tokenBearer(request), cuerpo: leerCuerpo(request) });
    return response.status(status).json(cuerpo);
  } catch (error) {
    (opciones.avisar || console.error)("invitar: error inesperado", { nombre: error?.name || "Error" });
    return response.status(500).json({ ok: false, code: "ERROR_INTERNO", error: TEXTOS.ENVIO_FALLIDO });
  }
};
