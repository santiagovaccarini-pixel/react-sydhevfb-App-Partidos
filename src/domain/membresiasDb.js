import { supabase } from "../supabase.js";
import { hoyISO } from "../idioma/formatos.js";

// La gente de cada club (tabla `club_miembros`, vista `v_miembros_club`), su
// historia y las invitaciones. Quién puede ver y cambiar qué lo decide la
// base: el admin del club, la gente de su club (menos a otro admin, a sí
// mismo y a los dueños de la app, principal o sub); cada uno, lo suyo. Los
// dueños de la app no ven ni tocan la gente de ningún club.

export const TABLA_MEMBRESIAS = "club_miembros";
export const MODULOS_DEL_CLUB = ["partido", "flujo", "lesiones", "evaluaciones"];

const COLUMNAS_MEMBRESIA = "equipo_id, user_id, desde, hasta, rol, partido, flujo, lesiones, evaluaciones";

// Los errores de la base como claves del diccionario.
export const claveDeError = (error, porDefecto = "cuentas.errorClub") => {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  if (/ultimo_admin/.test(texto)) return "cuentas.errorUltimoAdmin";
  if (/dueno_protegido/.test(texto)) return "cuentas.errorDuenoProtegido";
  if (/hasta_futura/.test(texto)) return "cuentas.errorHastaFutura";
  if (/correo_invalido/.test(texto)) return "cuentas.errorCorreo";
  if (/club_invitaciones_abierta_unica|duplicate key/.test(texto)) return "cuentas.errorInvitacionRepetida";
  if (error?.code === "42501" || /row-level security|permission denied/.test(texto)) return "cuentas.errorSinPermiso";
  if (error?.code === "42P01" || /does not exist/.test(texto)) return "cuentas.errorFaltaMigracion";
  return porDefecto;
};

const fallo = (error, porDefecto) => new Error(claveDeError(error, porDefecto));

// Lo que es de la membresía (la tabla club_miembros: no tiene el correo ni
// el estado de la cuenta).
const normalizarMembresia = (fila) => ({
  equipo_id: fila.equipo_id,
  user_id: fila.user_id,
  desde: fila.desde || null,
  hasta: fila.hasta || null,
  rol: fila.rol || "staff",
  partido: Boolean(fila.partido),
  flujo: Boolean(fila.flujo),
  lesiones: Boolean(fila.lesiones),
  evaluaciones: Boolean(fila.evaluaciones),
});

// Un miembro como lo muestra Cuentas (la vista v_miembros_club): la membresía
// y su cuenta. `protegido`: es dueño de la app (principal o sub); nadie del
// club lo saca ni le cambia nada, solo él se va. Una base sin esa columna
// dice false.
const normalizarMiembro = (fila) => ({
  ...normalizarMembresia(fila),
  email: fila.email || "",
  estado: fila.estado || "",
  confirmado_en: fila.confirmado_en || null,
  protegido: fila.protegido === true,
});

// "activo" (sigue en el club), "hasta" (se fue) o "ninguno" (nunca estuvo).
export const estadoDeMembresia = (fila) => {
  if (!fila) return "ninguno";
  return fila.hasta ? "hasta" : "activo";
};

// Los miembros de un club: primero los activos (administradores arriba),
// después los que se fueron (el más reciente primero).
export const ordenarMiembros = (lista) =>
  [...(lista || [])].sort((a, b) => {
    if (Boolean(a.hasta) !== Boolean(b.hasta)) return a.hasta ? 1 : -1;
    if (a.hasta && b.hasta && a.hasta !== b.hasta) return a.hasta < b.hasta ? 1 : -1;
    if (a.rol !== b.rol) return a.rol === "admin" ? -1 : 1;
    return a.email.localeCompare(b.email);
  });

export const listarMiembros = async (equipoId) => {
  const { data, error } = await supabase.from("v_miembros_club").select("*").eq("equipo_id", equipoId);
  if (error) throw fallo(error, "cuentas.errorClubes");
  return ordenarMiembros((data || []).map(normalizarMiembro));
};

// Cambia una membresía que ya existe. Si la base no dejó (no administra ese
// club, o la fila es de otro admin o la propia), no vuelve ninguna fila y se
// avisa. El rol no se cambia desde la app. Devuelve solo la membresía: lo
// de la cuenta (correo, estado) no está en esa tabla y queda como estaba en
// la lista.
const cambiar = async (userId, equipoId, cambios) => {
  const { data, error } = await supabase
    .from(TABLA_MEMBRESIAS)
    .update(cambios)
    .eq("equipo_id", equipoId)
    .eq("user_id", userId)
    .select(COLUMNAS_MEMBRESIA);
  if (error) throw fallo(error);
  if (!data || data.length === 0) throw new Error("cuentas.errorSinPermiso");
  return normalizarMembresia(data[0]);
};

export const cambiarModulo = (userId, equipoId, modulo, valor) => {
  if (!MODULOS_DEL_CLUB.includes(modulo)) throw new Error("cuentas.errorClub");
  return cambiar(userId, equipoId, { [modulo]: Boolean(valor) });
};
export const darDeBaja = (userId, equipoId, hasta) => cambiar(userId, equipoId, { hasta });
export const reincorporar = (userId, equipoId) => cambiar(userId, equipoId, { hasta: null, desde: hoyISO() });

export const historialDeMiembro = async (equipoId, userId) => {
  const { data, error } = await supabase
    .from("club_miembros_historial")
    .select("id, accion, detalle, quien_email, cuando")
    .eq("equipo_id", equipoId)
    .eq("user_id", userId)
    .order("cuando", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw fallo(error, "cuentas.errorHistorial");
  return data || [];
};

// ------------------------------------------------------- Invitaciones --

// Un correo que puede existir: sin espacios; antes de la @, sin punto al
// principio, al final ni dos seguidos; el dominio, con partes que no empiezan
// ni terminan en guion y que termina en letras (.ar, .com.br, .museum) o en una
// terminación internacional escrita como "xn--..." (.рф es .xn--p1ai). Así no
// pasa "nombre@club.com." (el punto del mensaje pegado al copiar).
const FORMA_DE_CORREO =
  /^[\w!#$%&'*+\/=?^`{|}~-]+(?:\.[\w!#$%&'*+\/=?^`{|}~-]+)*@(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+(?:[a-z]{2,63}|xn--[a-z\d](?:[a-z\d-]{0,57}[a-z\d])?)$/i;

export const correoValido = (correo) => FORMA_DE_CORREO.test(String(correo || "").trim());

// Una invitación abierta que ya venció: no sirve para entrar (la base solo
// aplica las vigentes), pero hasta que se cancela sigue ocupando el correo.
export const invitacionVencida = (invitacion, ahora = Date.now()) => {
  const vence = Date.parse(invitacion?.vence_en || "");
  return Number.isFinite(vence) && vence <= ahora;
};

export const listarInvitaciones = async (equipoId) => {
  const { data, error } = await supabase
    .from("club_invitaciones")
    .select("id, email, rol, partido, flujo, lesiones, evaluaciones, creado_en, vence_en, usada_en, cancelada_en")
    .eq("equipo_id", equipoId)
    .is("usada_en", null)
    .is("cancelada_en", null)
    .order("creado_en", { ascending: false });
  if (error) throw fallo(error, "cuentas.errorInvitaciones");
  return data || [];
};

// Invita un correo al club, siempre como staff (la base no deja invitar
// administradores). Si la cuenta ya existe (y confirmó su correo), la base la
// mete en el club en el acto y la invitación vuelve usada.
export const invitar = async (equipoId, { email, partido = true, flujo = true, lesiones = false, evaluaciones = false }) => {
  const rol = "staff";
  const correo = String(email || "").trim().toLowerCase();
  if (!correoValido(correo)) throw new Error("cuentas.errorCorreo");
  const insertar = () =>
    supabase.from("club_invitaciones").insert({ equipo_id: equipoId, email: correo, rol, partido, flujo, lesiones, evaluaciones });
  let { error } = await insertar();
  // La base no deja dos invitaciones abiertas al mismo correo, aunque la que
  // hay ya haya vencido: si todas las abiertas vencieron, se cancelan y se
  // vuelve a invitar. Si hay una vigente, se avisa como siempre.
  if (error && claveDeError(error) === "cuentas.errorInvitacionRepetida") {
    const { data: abiertas, error: errorLeer } = await supabase
      .from("club_invitaciones")
      .select("id, vence_en")
      .eq("equipo_id", equipoId)
      .eq("email", correo)
      .is("usada_en", null)
      .is("cancelada_en", null);
    if (!errorLeer && abiertas?.length && abiertas.every((una) => invitacionVencida(una))) {
      for (const vencida of abiertas) await cancelarInvitacion(vencida.id); // eslint-disable-line no-await-in-loop
      ({ error } = await insertar());
    }
  }
  if (error) throw fallo(error, "cuentas.errorInvitar");
  // La fila se vuelve a leer aparte: si la cuenta entró en el acto, la
  // invitación ya no está abierta (y no hace falta mostrarla).
  const { data } = await supabase
    .from("club_invitaciones")
    .select("id, usada_en")
    .eq("equipo_id", equipoId)
    .eq("email", correo)
    .order("creado_en", { ascending: false })
    .limit(1);
  return { usada: Boolean(data?.[0]?.usada_en) };
};

export const cancelarInvitacion = async (id) => {
  const { data, error } = await supabase
    .from("club_invitaciones")
    .update({ cancelada_en: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw fallo(error, "cuentas.errorInvitar");
  if (!data || data.length === 0) throw new Error("cuentas.errorSinPermiso");
  return true;
};

