// El historial de los valores de referencia (V.R.) de GPS y Evaluaciones
// (migración 20261025_referencias_editables.sql): cada cambio, quién y
// cuándo, con cómo estaba la fila y cómo quedó. Lo ve quien puede cambiar
// esos V.R. (el módulo en el club y seguir en él). Sin la tabla todavía,
// faltaTabla: los V.R. se miran pero no se cambian.
import { supabase } from "../supabase.js";
import { normalizarEntrada } from "./referencias.js";

// Los últimos cambios bastan para volver atrás (la tabla guarda todos).
export const CAMBIOS_QUE_SE_TRAEN = 200;

const faltaLaTabla = (error) => {
  const texto = `${error?.message || ""} ${error?.details || ""}`;
  return ["42P01", "PGRST205"].includes(error?.code) || (/referencias_historial/.test(texto) && /does not exist|schema cache|Could not find/i.test(texto));
};

// tabla: "gps_referencias" o "evaluaciones_referencias".
export const leerHistorialDeReferencias = async (equipoId, tabla, { cuantos = CAMBIOS_QUE_SE_TRAEN } = {}) => {
  if (!equipoId) return { cambios: [], faltaTabla: false, error: "" };
  const { data, error } = await supabase
    .from("referencias_historial")
    .select("id, tabla, fila_id, accion, quien_email, cuando, antes, despues")
    .eq("equipo_id", equipoId)
    .eq("tabla", tabla)
    .order("cuando", { ascending: false })
    .order("id", { ascending: false })
    .limit(cuantos);
  if (error) {
    if (faltaLaTabla(error)) return { cambios: [], faltaTabla: true, error: "" };
    return { cambios: [], faltaTabla: false, error: "referencias.historial.noSeLeyo" };
  }
  return { cambios: (Array.isArray(data) ? data : []).map(normalizarEntrada), faltaTabla: false, error: "" };
};
