// Cuenta de Catapult por usuario: cifrado de la contraseña y del pase con la
// clave de Vercel, lectura/escritura de la fila propia en Supabase bajo RLS
// (con el token del usuario, sin clave administrativa) y obtención de un pase
// listo para usar: del cache mientras dure, o con un login nuevo si venció.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./openfieldAuth.js";

export const TABLA_CUENTAS = "catapult_cuentas";
export const LARGO_MINIMO_CLAVE = 32;

const VERSION = "v1";
const ALGORITMO = "aes-256-gcm";
const LARGO_IV = 12;

// Un pase se considera vigente si le queda al menos este margen.
export const MARGEN_PASE_MS = 5 * 60 * 1000;

export const claveConfigurada = (frase = process.env.CATAPULT_SESSION_KEY) =>
  typeof frase === "string" && frase.trim().length >= LARGO_MINIMO_CLAVE;

const derivarClave = (frase) => {
  if (!claveConfigurada(frase)) {
    throw new Error(
      `CATAPULT_SESSION_KEY no está configurada o tiene menos de ${LARGO_MINIMO_CLAVE} caracteres.`,
    );
  }
  return Buffer.from(hkdfSync("sha256", Buffer.from(frase, "utf8"), "catapult-cuentas", ALGORITMO, 32));
};

const b64 = (buffer) => Buffer.from(buffer).toString("base64url");
const desdeB64 = (texto) => Buffer.from(String(texto || ""), "base64url");

export const cifrar = (texto, frase = process.env.CATAPULT_SESSION_KEY) => {
  const clave = derivarClave(frase);
  const iv = randomBytes(LARGO_IV);
  const cipher = createCipheriv(ALGORITMO, clave, iv);
  const cifrado = Buffer.concat([cipher.update(String(texto ?? ""), "utf8"), cipher.final()]);
  return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(cifrado)].join(".");
};

export const descifrar = (blob, frase = process.env.CATAPULT_SESSION_KEY) => {
  const clave = derivarClave(frase);
  const partes = String(blob || "").split(".");

  if (partes.length !== 4 || partes[0] !== VERSION) {
    throw new Error("El dato cifrado no tiene el formato esperado.");
  }

  try {
    const decipher = createDecipheriv(ALGORITMO, clave, desdeB64(partes[1]));
    decipher.setAuthTag(desdeB64(partes[2]));
    return Buffer.concat([decipher.update(desdeB64(partes[3])), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("No se pudo descifrar: la clave cambió o el dato está dañado.");
  }
};

// true si el pase guardado sirve todavía (con margen); false si hay que renovar.
export const paseVigente = (expira, ahora = Date.now(), margenMs = MARGEN_PASE_MS) => {
  const limite = new Date(expira || 0).getTime();
  return Number.isFinite(limite) && limite - ahora > margenMs;
};

// Vencimiento del pase: el claim exp del JWT si está, si no expires_in.
export const vencimientoPase = (pase, ahora = Date.now()) => {
  const partes = String(pase?.accessToken || "").split(".");
  if (partes.length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
      if (typeof claims?.exp === "number") return new Date(claims.exp * 1000).toISOString();
    } catch {
      // Sin claims legibles: se cae a expires_in.
    }
  }
  const segundos = Number(pase?.expiresIn);
  return new Date(ahora + (Number.isFinite(segundos) && segundos > 0 ? segundos : 3600) * 1000).toISOString();
};

// Cliente que actúa como el usuario: Supabase aplica RLS con su token.
export const clienteUsuario = (token) =>
  createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

const describirCuenta = (fila) =>
  fila
    ? {
        configurada: true,
        usuario: fila.usuario,
        verificado_en: fila.verificado_en,
        actualizado_en: fila.actualizado_en,
        pase_expira: fila.pase_expira,
        pase_vigente: paseVigente(fila.pase_expira),
      }
    : { configurada: false };

export const leerCuenta = async ({ token, userId }) => {
  const { data, error } = await clienteUsuario(token)
    .from(TABLA_CUENTAS)
    .select("user_id, usuario, secreto, pase_secreto, pase_expira, verificado_en, actualizado_en")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, code: error.code || null };
  return { ok: true, fila: data || null, cuenta: describirCuenta(data) };
};

export const guardarCuenta = async ({ token, userId, usuario, password, pase = null }) => {
  const ahora = new Date().toISOString();
  const fila = {
    user_id: userId,
    usuario: String(usuario || "").trim(),
    secreto: cifrar(password),
    pase_secreto: pase ? cifrar(pase.accessToken) : null,
    pase_expira: pase ? vencimientoPase(pase) : null,
    verificado_en: pase ? ahora : null,
    actualizado_en: ahora,
  };

  const { data, error } = await clienteUsuario(token)
    .from(TABLA_CUENTAS)
    .upsert(fila, { onConflict: "user_id" })
    .select("user_id, usuario, pase_expira, verificado_en, actualizado_en")
    .single();

  if (error) return { ok: false, error: error.message, code: error.code || null };
  return { ok: true, cuenta: describirCuenta(data) };
};

export const guardarPase = async ({ token, userId, pase }) => {
  const ahora = new Date().toISOString();
  const { error } = await clienteUsuario(token)
    .from(TABLA_CUENTAS)
    .update({
      pase_secreto: cifrar(pase.accessToken),
      pase_expira: vencimientoPase(pase),
      verificado_en: ahora,
      actualizado_en: ahora,
    })
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message, code: error.code || null };
  return { ok: true };
};

export const borrarCuenta = async ({ token, userId }) => {
  const { error } = await clienteUsuario(token).from(TABLA_CUENTAS).delete().eq("user_id", userId);
  if (error) return { ok: false, error: error.message, code: error.code || null };
  return { ok: true };
};

// Mensaje claro cuando la tabla todavía no existe (migración sin ejecutar).
export const errorDeTabla = (resultado) =>
  /catapult_cuentas|schema cache|does not exist/i.test(String(resultado?.error || ""))
    ? "La tabla de cuentas de Catapult no existe todavía: falta ejecutar la migración 20260920_cuenta_catapult.sql en Supabase."
    : resultado?.error || "No se pudo acceder a la cuenta de Catapult.";

// Devuelve un pase listo para usar. `iniciarSesion` es la función que hace el
// login real (Playwright) y devuelve { ok, pase, code, error }; se inyecta
// para poder testear esta lógica sin navegador.
export const obtenerPase = async ({ token, userId, iniciarSesion, ahora = Date.now() }) => {
  const lectura = await leerCuenta({ token, userId });
  if (!lectura.ok) return { ok: false, code: "CUENTA_NO_LEGIBLE", error: errorDeTabla(lectura) };
  if (!lectura.fila) {
    return { ok: false, code: "SIN_CUENTA", error: "Todavía no conectaste tu cuenta de Catapult." };
  }

  const fila = lectura.fila;

  if (fila.pase_secreto && paseVigente(fila.pase_expira, ahora)) {
    try {
      return {
        ok: true,
        origen: "cache",
        usuario: fila.usuario,
        pase: { tokenType: "Bearer", accessToken: descifrar(fila.pase_secreto), expira: fila.pase_expira },
      };
    } catch {
      // Pase ilegible (clave cambiada): se renueva con un login.
    }
  }

  let password;
  try {
    password = descifrar(fila.secreto);
  } catch (error) {
    return { ok: false, code: "SECRETO_ILEGIBLE", error: error.message };
  }

  const login = await iniciarSesion({ username: fila.usuario, password });
  if (!login.ok || !login.pase) {
    return {
      ok: false,
      code: login.code || "LOGIN_FALLIDO",
      error: login.error || "Catapult no aceptó la cuenta guardada.",
      etapa: login.etapa,
    };
  }

  const guardado = await guardarPase({ token, userId, pase: login.pase });

  return {
    ok: true,
    origen: "login",
    usuario: fila.usuario,
    pase: { ...login.pase, expira: vencimientoPase(login.pase, ahora) },
    paseGuardado: guardado.ok,
  };
};
