import { supabase } from "../supabase.js";
import { leerEquipoElegido } from "./equipo.js";

// Quien ya se fue de un club no lee las tablas: lee la foto de su último día,
// que arma la base (datos_al_dia) con cada partido, entrenamiento, jugador y
// lesión tal como estaban al terminar ese día. Quien sigue en el club lee las
// tablas como siempre.

// Si el club (el elegido en este celular) es de solo lectura para la cuenta.
export const esSoloLectura = (equipoId) => {
  const elegido = leerEquipoElegido();
  return Boolean(equipoId && elegido?.id === equipoId && elegido.hasta);
};

// Las filas de una tabla en la foto del último día. Tira el error de la base.
export const leerAlDia = async (tabla, equipoId) => {
  const { data, error } = await supabase.rpc("datos_al_dia", { p_tabla: tabla, p_equipo: equipoId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).filter((fila) => fila && typeof fila === "object");
};

// Ordena filas por una columna de texto o fecha, de la más nueva a la más vieja.
export const masNuevasPrimero = (filas, columna) =>
  [...filas].sort((a, b) => String(b?.[columna] ?? "").localeCompare(String(a?.[columna] ?? "")));
