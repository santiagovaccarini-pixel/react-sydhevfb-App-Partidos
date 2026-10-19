// Lo que un atleta le pide al club sobre sus datos (20261104): exportarlos
// todos. Lo hace solo el administrador del club, con todo aunque no tenga
// cada base: lo decide la base (exportar_atleta).
import { supabase } from "../supabase.js";

const DE_RED = /failed to fetch|load failed|networkerror|network request failed|fetch failed/i;

// «Falta una actualización» solo si lo que falta es exportar_atleta (antes
// también salía con cualquier función que faltara adentro de ella, 19/10).
export const claveDeErrorDeExportar = (error) => {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  if (/solo_admin/.test(texto)) return "exportar.error.soloAdmin";
  if (error?.code === "PGRST202" || (error?.code === "42883" && /exportar_atleta/.test(error?.message || ""))) return "exportar.error.faltaMigracion";
  if (DE_RED.test(texto)) return "comun.sinConexion";
  return "exportar.error.noSe";
};

const fallo = (error) => {
  const clave = claveDeErrorDeExportar(error);
  // Lo que dijo la base, para quien lo revise (en pantalla va el aviso).
  if (clave === "exportar.error.noSe") console.warn("No se pudieron exportar los datos del atleta:", error?.code || "", error?.message || error);
  return { datos: null, error: clave };
};

// { datos, error }: todo lo del jugador en su club (ver exportarAtleta.js).
export const exportarAtleta = async (jugadorId) => {
  try {
    const { data, error } = await supabase.rpc("exportar_atleta", { p_jugador: jugadorId });
    if (error) return fallo(error);
    return { datos: data && typeof data === "object" ? data : null, error: data ? "" : "exportar.error.noSe" };
  } catch (error) {
    return fallo(error);
  }
};
