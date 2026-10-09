import { supabase } from "../supabase.js";
import { armarClaveDeError } from "./plataformaDb.js";

// Pedidos de acceso. Quien entra sin invitación escribe a qué club quiere
// entrar, manda el pedido y espera: nada más. Lo acepta o lo rechaza el
// administrador de ese club (nunca un dueño de la app). La persona no sabe si
// el club usa la app: ve lo mismo en los dos casos, y la base nunca le dice
// a qué club fue a parar su pedido.

export const ESTADOS_PEDIDO = Object.freeze(["abierto", "aceptado", "rechazado", "cancelado"]);

export const claveDeError = armarClaveDeError("pedidos.error", [
  "club_invalido",
  "ya_hay_un_pedido",
  "solo_admin",
  "pedido_cerrado",
  "cuenta_bloqueada",
  "correo_sin_confirmar",
  "ultimo_admin",
  "dueno_protegido",
  "no_es_miembro",
]);

const fallo = (error, porDefecto) =>
  Object.assign(new Error(claveDeError(error, porDefecto)), { codigo: error?.code || "", detalle: error?.message || "" });

const llamar = async (funcion, parametros) => {
  const { data, error } = await supabase.rpc(funcion, parametros);
  if (error) throw fallo(error);
  return data;
};

const masNuevoPrimero = (a, b) => String(b.creado_en || "").localeCompare(String(a.creado_en || ""));

// ------------------------------------------------- Lo de quien pide --

// El nombre del club como lo escribió (y el país, si quiso). La base lo
// compara sin tildes ni mayúsculas contra los clubes de la app.
export const pedirAcceso = async (club, pais = "") => {
  const nombre = String(club || "").trim().replace(/\s+/g, " ");
  if (nombre.length < 2 || nombre.length > 80) throw new Error("pedidos.error.clubInvalido");
  const donde = String(pais || "").trim().replace(/\s+/g, " ").slice(0, 60);
  return llamar("pedir_acceso", { p_club: nombre, p_pais: donde || null });
};

// Los pedidos propios, el más nuevo primero (sin el club al que fueron).
export const misPedidos = async () => {
  const filas = (await llamar("mis_pedidos")) || [];
  return [...filas].sort(masNuevoPrimero);
};

// El pedido que todavía espera, si hay uno (puede haber uno solo).
export const pedidoAbierto = (pedidos) => (pedidos || []).find((pedido) => pedido.estado === "abierto") || null;

export const cancelarPedido = async (id) => {
  await llamar("cancelar_pedido", { p_id: id });
  return true;
};

// ------------------------------------------- Lo del admin del club --

export const pedidosDelClub = async (equipoId) => {
  const filas = (await llamar("pedidos_del_club", { p_equipo: equipoId })) || [];
  return [...filas].sort(masNuevoPrimero);
};

// Acepta con los módulos elegidos: la cuenta entra al club como staff.
export const aceptarPedido = async (id, { partido = false, flujo = false, lesiones = false, evaluaciones = false } = {}) => {
  await llamar("aceptar_pedido", {
    p_id: id,
    p_partido: Boolean(partido),
    p_flujo: Boolean(flujo),
    p_lesiones: Boolean(lesiones),
    p_evaluaciones: Boolean(evaluaciones),
  });
  return true;
};

// Rechazado: desaparece de la lista del club y la persona puede volver a pedir.
export const rechazarPedido = async (id) => {
  await llamar("rechazar_pedido", { p_id: id });
  return true;
};

// Irse de un club por cuenta propia (último día: hoy). Es la única forma de
// que el dueño principal deje un club.
export const salirDelClub = async (equipoId) => {
  await llamar("salir_del_club", { p_equipo: equipoId });
  return true;
};
