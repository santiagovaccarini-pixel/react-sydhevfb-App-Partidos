import { supabase } from "../supabase.js";

// El partido en curso compartido entre los celulares del club
// (20261120_partido_en_curso.sql; paso 4 de la nota «cargar sin señal y a la
// vez que otra persona»). Sube solo los datos que cambiaron (partidoEnCurso.js)
// con lo que se veía de cada uno: si otra persona cambió el mismo dato
// mientras tanto, gana el último y la base lo dice (pisadas). Sin id, lo
// empieza. registroId: la fila del Historial, cuando ya se guardó.
//
// Devuelve { id, datos, version, pisadas: [{ clave, habia }], error }; si la
// base todavía no tiene la actualización, sinFuncion (Partido sigue como
// antes, solo en el celular); si lo borraron, noEsta.
const FALTA = /partido_en_curso_cambiar|partidos_en_curso/;
const faltaLaFuncion = (error) => {
  const texto = `${error?.message || ""} ${error?.details || ""}`;
  return ["PGRST202", "42883", "42P01", "PGRST205"].includes(error?.code) || (FALTA.test(texto) && /Could not find|does not exist|schema cache/i.test(texto));
};

export const cambiarPartidoEnCurso = async (equipoId, { id = null, cambios = {}, antes = {}, registroId = null } = {}) => {
  if (!equipoId) return { error: "partido.enCurso.sinClub" };
  const { data, error } = await supabase.rpc("partido_en_curso_cambiar", {
    p_id: id,
    p_equipo: equipoId,
    p_cambios: cambios,
    p_antes: antes,
    p_registro: registroId,
  });
  if (error) {
    if (faltaLaFuncion(error)) return { sinFuncion: true, error: "" };
    if (/partido_en_curso_no_esta/.test(`${error.message || ""}`)) return { noEsta: true, error: "" };
    const sinPermiso = error.code === "42501" || /row-level security|permission denied/.test(`${error.message || ""}`);
    return { error: sinPermiso ? "partido.enCurso.sinPermiso" : "partido.enCurso.noSubio", detalle: error.message || "" };
  }
  // Una respuesta que no es la de la función: como sin la actualización.
  if (!data || typeof data !== "object" || Array.isArray(data) || !data.id) return { sinFuncion: true, error: "" };
  return {
    id: data.id,
    datos: data.datos && typeof data.datos === "object" ? data.datos : {},
    version: data.version ?? null,
    pisadas: Array.isArray(data.pisadas) ? data.pisadas : [],
    error: "",
  };
};

// Los partidos en curso del club con algún cambio en las últimas 6 horas, el
// último primero (20261121_partido_en_curso_en_vivo.sql): para ofrecer
// «Sumarme» y para traer lo que anotan los otros celulares en el abierto.
// [{ id, datos, registroId, version, actualizadoEn, actualizadoEmail }]. Sin la
// actualización de la base, ninguno (sinFuncion).
export const partidosEnCursoDelClub = async (equipoId) => {
  if (!equipoId) return { partidos: [], error: "" };
  const { data, error } = await supabase.rpc("partidos_en_curso_del_club", { p_equipo: equipoId });
  if (error) {
    if (faltaLaFuncion(error) || /partidos_en_curso_del_club/.test(`${error.message || ""}`)) return { partidos: [], sinFuncion: true, error: "" };
    return { partidos: [], error: "partido.enCurso.noSeLeyo", detalle: error.message || "" };
  }
  return {
    partidos: (Array.isArray(data) ? data : [])
      .filter((fila) => fila?.id && fila.datos && typeof fila.datos === "object")
      .map((fila) => ({
        id: fila.id,
        datos: fila.datos,
        registroId: fila.registro_id ?? null,
        version: fila.version ?? null,
        actualizadoEn: fila.actualizado_en || null,
        actualizadoEmail: fila.actualizado_email || "",
      })),
    error: "",
  };
};
