import { supabase } from "../supabase.js";
import { hoyISO } from "../idioma/formatos.js";
import { cabecerasJson } from "../trainingApi.js";

// La gente de cada club (tabla `club_miembros`, vista `v_miembros_club`), su
// historia y las invitaciones. Quién puede ver y cambiar qué lo decide la
// base: el admin del club, la gente de su club (menos a otro admin, a sí
// mismo y a los dueños de la app, principal o sub); cada uno, lo suyo. Los
// dueños de la app no ven ni tocan la gente de ningún club.

export const TABLA_MEMBRESIAS = "club_miembros";
export const MODULOS_DEL_CLUB = ["partido", "flujo", "lesiones", "evaluaciones", "gps"];

// El nivel de cada módulo (Santiago, 17/10: «Vamos a implementar un nivel mas
// de permisos para cada modulo (Solo Lectura y Edicion) solo lectura no deja
// editar nada y edicion si»): sin acceso (el módulo apagado), solo lectura
// (prendido y en `solo_lectura`) o edición (prendido, fuera de la lista).
// Antes de 20261029_niveles_de_permiso.sql la columna no está: todo es edición.
export const NIVELES = ["sin", "lectura", "edicion"];

// Datos básicos también tiene nivel (Santiago, 17/10: «Su propio
// desplegable»), pero no se apaga: lo tiene todo el que sigue en el club
// (los demás módulos usan su lista de jugadores). Solo lectura o Edición.
export const DATOS_BASICOS = "datos";
export const MODULOS_CON_NIVEL = [...MODULOS_DEL_CLUB, DATOS_BASICOS];
export const nivelesDe = (modulo) => (modulo === DATOS_BASICOS ? ["lectura", "edicion"] : NIVELES);

const soloLecturaDe = (fila) =>
  Array.isArray(fila?.solo_lectura) ? MODULOS_CON_NIVEL.filter((modulo) => fila.solo_lectura.includes(modulo)) : [];

export const nivelDe = (fila, modulo) => {
  if (modulo !== DATOS_BASICOS && !fila?.[modulo]) return "sin";
  return soloLecturaDe(fila).includes(modulo) ? "lectura" : "edicion";
};

// Lo que cambia al dejar un módulo en un nivel: el módulo y la lista de solo
// lectura (sin acceso lo saca también de la lista). Datos básicos no tiene
// columna propia: solo la lista.
export const conNivel = (fila, modulo, nivel) => {
  const resto = soloLecturaDe(fila).filter((otro) => otro !== modulo);
  const soloLectura = nivel === "lectura" ? MODULOS_CON_NIVEL.filter((otro) => otro === modulo || resto.includes(otro)) : resto;
  return modulo === DATOS_BASICOS ? { solo_lectura: soloLectura } : { [modulo]: nivel !== "sin", solo_lectura: soloLectura };
};

// Los errores de la base como claves del diccionario.
export const claveDeError = (error, porDefecto = "cuentas.errorClub") => {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  if (/ultimo_admin/.test(texto)) return "cuentas.errorUltimoAdmin";
  if (/dueno_protegido/.test(texto)) return "cuentas.errorDuenoProtegido";
  if (/hasta_futura/.test(texto)) return "cuentas.errorHastaFutura";
  if (/correo_invalido/.test(texto)) return "cuentas.errorCorreo";
  if (/club_invitaciones_abierta_unica|duplicate key/.test(texto)) return "cuentas.errorInvitacionRepetida";
  if (error?.code === "42501" || /row-level security|permission denied/.test(texto)) return "cuentas.errorSinPermiso";
  if (error?.code === "42P01" || /does not exist|solo_lectura/.test(texto)) return "cuentas.errorFaltaMigracion";
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
  gps: Boolean(fila.gps),
  solo_lectura: soloLecturaDe(fila),
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
// la lista. Vuelve la fila entera: con o sin la columna solo_lectura.
const cambiar = async (userId, equipoId, cambios) => {
  const { data, error } = await supabase
    .from(TABLA_MEMBRESIAS)
    .update(cambios)
    .eq("equipo_id", equipoId)
    .eq("user_id", userId)
    .select("*");
  if (error) throw fallo(error);
  if (!data || data.length === 0) throw new Error("cuentas.errorSinPermiso");
  return normalizarMembresia(data[0]);
};

// Deja un módulo de un miembro en un nivel. La lista de solo lectura va solo
// si cambia: así, sin la actualización de la base, dar o sacar un módulo
// sigue andando.
export const cambiarNivel = (miembro, modulo, nivel) => {
  if (!MODULOS_CON_NIVEL.includes(modulo) || !nivelesDe(modulo).includes(nivel)) throw new Error("cuentas.errorClub");
  const nuevo = conNivel(miembro, modulo, nivel);
  const cambios = modulo === DATOS_BASICOS ? {} : { [modulo]: nuevo[modulo] };
  if (nuevo.solo_lectura.join(",") !== soloLecturaDe(miembro).join(",")) cambios.solo_lectura = nuevo.solo_lectura;
  // Datos básicos en el nivel que ya tenía: no hay nada que mandar.
  if (!Object.keys(cambios).length) return Promise.resolve(normalizarMembresia(miembro));
  return cambiar(miembro.user_id, miembro.equipo_id, cambios);
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
    .select("*")
    .eq("equipo_id", equipoId)
    .is("usada_en", null)
    .is("cancelada_en", null)
    .order("creado_en", { ascending: false });
  if (error) throw fallo(error, "cuentas.errorInvitaciones");
  return data || [];
};

// Invita un correo al club, siempre como staff (la base no deja invitar
// administradores). Si la cuenta ya existe (y confirmó su correo), la base la
// mete en el club en el acto y la invitación vuelve usada; la de un dueño de
// la app queda abierta, como la de un correo sin cuenta. Vuelve también el id
// de la invitación, para mandarle el mail. Los módulos en solo lectura van
// solo si hay alguno (sin la actualización de la base, invitar sigue andando).
export const invitar = async (equipoId, { email, partido = true, flujo = true, lesiones = false, evaluaciones = false, gps = false, solo_lectura = [] }) => {
  const rol = "staff";
  const correo = String(email || "").trim().toLowerCase();
  if (!correoValido(correo)) throw new Error("cuentas.errorCorreo");
  const modulos = { partido, flujo, lesiones, evaluaciones, gps };
  const soloLectura = soloLecturaDe({ solo_lectura }).filter((modulo) => modulo === DATOS_BASICOS || modulos[modulo]);
  const insertar = () =>
    supabase
      .from("club_invitaciones")
      .insert({ equipo_id: equipoId, email: correo, rol, ...modulos, ...(soloLectura.length ? { solo_lectura: soloLectura } : {}) });
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
  return { usada: Boolean(data?.[0]?.usada_en), id: data?.[0]?.id || null };
};

// El mail de una invitación lo manda el servidor (api/invitar), siempre al
// correo de esa invitación. Vuelve qué pasó, como clave del diccionario:
// enviado, la confirmación de correo apagada en Supabase, demasiados mails,
// la invitación ya cerrada o vencida, o que no salió (sin señal, sin la clave
// del servidor, otro error). La invitación queda guardada igual: se le puede
// mandar el mensaje con "Copiar mensaje". Nunca dice que el correo ya tiene
// cuenta: una invitación abierta a una cuenta confirmada es la de un dueño de
// la app, y quien invita no tiene que poder saberlo. Todo lo que no sea un
// mail enviado, sin un motivo de los de arriba, es "no salió".
export const RUTA_INVITAR_POR_MAIL = "/api/invitar";

const RESULTADO_DEL_MAIL = {
  CONFIRMACION_APAGADA: "cuentas.mail.confirmacionApagada",
  LIMITE_DE_MAILS: "cuentas.mail.limite",
  INVITACION_VENCIDA: "cuentas.mail.vencida",
  INVITACION_USADA: "cuentas.mail.cerrada",
  INVITACION_CANCELADA: "cuentas.mail.cerrada",
};

export const enviarInvitacionPorMail = async (invitacionId, idioma) => {
  try {
    const respuesta = await fetch(RUTA_INVITAR_POR_MAIL, {
      method: "POST",
      cache: "no-store",
      headers: await cabecerasJson(),
      body: JSON.stringify({ invitacion: invitacionId, idioma }),
    });
    const payload = await respuesta.json().catch(() => null);
    if (respuesta.ok && payload?.ok && payload.enviado === true) return "cuentas.mail.enviado";
    return RESULTADO_DEL_MAIL[payload?.code] || "cuentas.mail.noSalio";
  } catch {
    return "cuentas.mail.noSalio";
  }
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

