import { supabase } from "../supabase.js";
import { hoyISO } from "../idioma/formatos.js";

// Quién está en cada club, y hasta cuándo (tabla `club_miembros`). Cada uno
// lee las suyas; el administrador las lee y las decide todas. `hasta` vacío
// es que sigue en el club; con fecha, ese fue su último día: ve lo cargado
// hasta ahí y no cambia nada.

export const TABLA_MEMBRESIAS = "club_miembros";
const COLUMNAS = "equipo_id, user_id, desde, hasta";

const normalizar = (fila) => ({
  equipo_id: fila.equipo_id,
  user_id: fila.user_id,
  desde: fila.desde || null,
  hasta: fila.hasta || null,
});

// "activo" (sigue en el club), "hasta" (se fue) o "ninguno" (nunca estuvo).
export const estadoDeMembresia = (fila) => {
  if (!fila) return "ninguno";
  return fila.hasta ? "hasta" : "activo";
};

export const membresiaDe = (lista, userId, equipoId) =>
  (lista || []).find((fila) => fila.user_id === userId && fila.equipo_id === equipoId) || null;

export const listarMembresias = async () => {
  const { data, error } = await supabase.from(TABLA_MEMBRESIAS).select(COLUMNAS);
  if (error) throw new Error(error.message || "cuentas.errorClubes");
  return (data || []).map(normalizar);
};

// Crea o cambia la fila de una cuenta en un club. Si la base no dejó (no
// sos administrador), no vuelve ninguna fila y se avisa.
const cambiar = async (userId, equipoId, cambios) => {
  const { data, error } = await supabase
    .from(TABLA_MEMBRESIAS)
    .upsert({ equipo_id: equipoId, user_id: userId, ...cambios }, { onConflict: "equipo_id,user_id" })
    .select(COLUMNAS);
  if (error) throw new Error(error.message || "cuentas.errorClub");
  if (!data || data.length === 0) throw new Error("cuentas.errorClub");
  return normalizar(data[0]);
};

export const sumarAlClub = (userId, equipoId) => cambiar(userId, equipoId, { desde: hoyISO(), hasta: null });
export const darDeBaja = (userId, equipoId, hasta) => cambiar(userId, equipoId, { hasta });
export const reincorporar = (userId, equipoId) => cambiar(userId, equipoId, { hasta: null });
