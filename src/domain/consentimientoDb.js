// Consentimiento de los atletas (migración 20261103_consentimiento.sql). El
// club confirma una vez (lo hace el administrador) que tiene el
// consentimiento de sus atletas; al cargar un archivo con personas que no
// están en Datos básicos, quien lo carga confirma las de ese archivo. Sin la
// confirmación del club, la base no deja cargar datos nuevos de atletas. Lo
// que se confirma (quién, como qué y cuándo) lo pone la base. Lo que no
// habla con la base está en consentimiento.js.
import { supabase } from "../supabase.js";
import { esSoloLectura } from "./alDia.js";
import { normalizarPersona } from "./consentimiento.js";

const DE_RED = /failed to fetch|load failed|networkerror|network request failed|fetch failed/i;

// La base todavía no tiene la tabla (falta correr la migración): la app
// sigue como antes, sin pedir nada (la base tampoco lo frena).
const faltaTabla = (error) =>
  ["42P01", "PGRST205"].includes(error?.code) || (/consentimientos/.test(error?.message || "") && /does not exist|schema cache|Could not find/i.test(error?.message || ""));

// Si el club ya confirmó: { confirmado, sinTabla, error }. Quien ya se fue
// del club (solo lectura) no carga nada: no se le pregunta.
export const leerConsentimientoDelClub = async (equipoId) => {
  if (!equipoId || esSoloLectura(equipoId)) return { confirmado: true, sinTabla: false, error: "" };
  let respuesta;
  try {
    respuesta = await supabase.from("consentimientos").select("id").eq("equipo_id", equipoId).eq("alcance", "club").limit(1);
  } catch {
    return { confirmado: null, sinTabla: false, error: "consentimiento.error.noLeer" };
  }
  const { data, error } = respuesta || {};
  if (error) {
    if (faltaTabla(error)) return { confirmado: true, sinTabla: true, error: "" };
    return { confirmado: null, sinTabla: false, error: DE_RED.test(error.message || "") ? "comun.sinConexion" : "consentimiento.error.noLeer" };
  }
  return { confirmado: Array.isArray(data) && data.length > 0, sinTabla: false, error: "" };
};

export const confirmarConsentimientoDelClub = async (equipoId, texto) => {
  const { error } = await supabase.from("consentimientos").insert([{ equipo_id: equipoId, alcance: "club", texto }]);
  if (!error) return { error: "" };
  return { error: DE_RED.test(error.message || "") ? "comun.sinConexion" : "consentimiento.error.noGuardar", detalle: error.message || "" };
};

// Las personas de afuera ya confirmadas en el club que la cuenta puede ver
// (las de sus bases), como se comparan. { personas: Set | null, sinTabla, error }.
export const leerPersonasConfirmadas = async (equipoId) => {
  if (!equipoId || esSoloLectura(equipoId)) return { personas: new Set(), sinTabla: false, error: "" };
  let respuesta;
  try {
    respuesta = await supabase.from("consentimientos").select("personas").eq("equipo_id", equipoId).eq("alcance", "personas");
  } catch {
    return { personas: null, sinTabla: false, error: "consentimiento.error.noLeer" };
  }
  const { data, error } = respuesta || {};
  if (error) {
    if (faltaTabla(error)) return { personas: null, sinTabla: true, error: "" };
    return { personas: null, sinTabla: false, error: DE_RED.test(error.message || "") ? "comun.sinConexion" : "consentimiento.error.noLeer" };
  }
  return { personas: new Set((data || []).flatMap((fila) => fila.personas || []).map(normalizarPersona)), sinTabla: false, error: "" };
};

export const confirmarPersonas = async (equipoId, base, personas, texto) => {
  const { error } = await supabase.from("consentimientos").insert([{ equipo_id: equipoId, alcance: "personas", base, personas, texto }]);
  if (!error) return { error: "" };
  return { error: DE_RED.test(error.message || "") ? "comun.sinConexion" : "consentimiento.error.noGuardar", detalle: error.message || "" };
};
