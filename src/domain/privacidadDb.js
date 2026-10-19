// Lo que un atleta le pide al club sobre sus datos (20261104): exportarlos
// todos. Lo hace solo el administrador del club, con todo aunque no tenga
// cada base: lo decide la base (exportar_atleta).
import { supabase } from "../supabase.js";

const DE_RED = /failed to fetch|load failed|networkerror|network request failed|fetch failed/i;

const claveDeError = (error) => {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  if (/solo_admin/.test(texto)) return "exportar.error.soloAdmin";
  if (["PGRST202", "42883"].includes(error?.code) || /exportar_atleta/.test(texto)) return "exportar.error.faltaMigracion";
  if (DE_RED.test(texto)) return "comun.sinConexion";
  return "exportar.error.noSe";
};

// { datos, error }: todo lo del jugador en su club (ver exportarAtleta.js).
export const exportarAtleta = async (jugadorId) => {
  try {
    const { data, error } = await supabase.rpc("exportar_atleta", { p_jugador: jugadorId });
    if (error) return { datos: null, error: claveDeError(error) };
    return { datos: data && typeof data === "object" ? data : null, error: data ? "" : "exportar.error.noSe" };
  } catch (error) {
    return { datos: null, error: claveDeError(error) };
  }
};
