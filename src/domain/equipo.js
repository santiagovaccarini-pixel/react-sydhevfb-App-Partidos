import { supabase } from "../supabase.js";

/**
 * Los equipos que conviven en la misma base. Cada teléfono elige el suyo una
 * vez y desde ahí ve solo sus partidos y su plantel.
 *
 * Lo que se guarda en el teléfono es el id, no el nombre: así, corregir
 * "Estudiantes" a "Estudiantes de La Plata" no deja afuera todo lo cargado
 * antes. El escudo tampoco se configura: se busca por nombre contra la base de
 * clubes, igual que el del rival.
 *
 * Esto ordena, no protege: cualquiera puede cambiarse de equipo desde Ajustes.
 */

export const EQUIPO_POR_DEFECTO = "Atlético Mineiro";
export const CLAVE_EQUIPO_ELEGIDO = "equipo_elegido";

const limpiar = (valor) => String(valor ?? "").trim();

/** Sin acentos ni mayúsculas, para comparar dos formas de escribir lo mismo. */
const comparable = (nombre) =>
  limpiar(nombre).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Si el equipo propio sigue siendo el Mineiro. Lo usa el escudo para saber si
 * puede caer al dibujado de siempre o le toca el genérico.
 */
export const esElCam = (nombre) =>
  comparable(nombre) === comparable(EQUIPO_POR_DEFECTO);

/**
 * El equipo de este teléfono, con su nombre. Se guarda el nombre además del id
 * para que sin señal la app siga sabiendo de qué club es: si no, mostraría el
 * que viene por defecto, que para otro club está mal.
 */
export const leerEquipoElegido = () => {
  try {
    const guardado = localStorage.getItem(CLAVE_EQUIPO_ELEGIDO);
    if (!guardado) return null;

    // Antes se guardaba solo el id, pelado.
    if (!guardado.startsWith("{")) return { id: guardado, nombre: "" };

    const leido = JSON.parse(guardado);
    return leido?.id ? { id: leido.id, nombre: limpiar(leido.nombre) } : null;
  } catch (error) {
    console.warn("No se pudo leer el equipo elegido:", error);
    return null;
  }
};

export const guardarEquipoElegido = (equipo) => {
  try {
    if (equipo?.id) {
      localStorage.setItem(
        CLAVE_EQUIPO_ELEGIDO,
        JSON.stringify({ id: equipo.id, nombre: limpiar(equipo.nombre) }),
      );
    } else {
      localStorage.removeItem(CLAVE_EQUIPO_ELEGIDO);
    }
  } catch (error) {
    console.warn("No se pudo guardar el equipo elegido:", error);
  }
};

const normalizarEquipo = (fila) => ({
  id: fila?.id ?? null,
  nombre: limpiar(fila?.nombre),
});

export const cargarEquipos = async () => {
  try {
    const { data, error } = await supabase
      .from("equipos")
      .select("id, nombre")
      .order("nombre", { ascending: true });

    if (error) throw error;

    return { equipos: (data || []).map(normalizarEquipo).filter((e) => e.id) };
  } catch (error) {
    console.warn("No se pudieron leer los equipos:", error);
    return { equipos: [], error: error.message || String(error) };
  }
};

/**
 * Cuál de los equipos usar al abrir. Si el del teléfono ya no existe y hay uno
 * solo en la base, se adopta ese: es el caso de siempre, un equipo y varios
 * teléfonos, y no tiene sentido hacer elegir cuando no hay nada que elegir.
 */
export const elegirEquipoInicial = (equipos, guardado, { huboError } = {}) => {
  const lista = equipos || [];

  // Si la base no contestó, este teléfono sigue siendo del equipo que ya
  // sabía. Preguntar de nuevo sin poder ofrecer la lista no lleva a ningún
  // lado, y en la cancha suele no haber señal.
  if (huboError) return guardado || null;

  const enLaBase = lista.find((equipo) => equipo.id === guardado?.id);
  if (enLaBase) return enLaBase;
  if (lista.length === 1) return lista[0];
  return null;
};

export const crearEquipo = async (nombre) => {
  const limpio = limpiar(nombre);
  if (!limpio) return { error: "Escribí el nombre del equipo." };

  const { data, error } = await supabase
    .from("equipos")
    .insert([{ nombre: limpio }])
    .select();

  if (error) {
    const repetido = /duplicate key|unique/i.test(error.message || "");
    return {
      error: repetido ? "Ya hay un equipo con ese nombre." : error.message,
    };
  }

  return { equipo: normalizarEquipo(data?.[0]) };
};

export const renombrarEquipo = async (id, nombre) => {
  const limpio = limpiar(nombre);
  if (!limpio) return { error: "Escribí el nombre del equipo." };

  const { error } = await supabase
    .from("equipos")
    .update({ nombre: limpio })
    .eq("id", id);

  if (error) {
    const repetido = /duplicate key|unique/i.test(error.message || "");
    return {
      error: repetido ? "Ya hay un equipo con ese nombre." : error.message,
    };
  }

  return { equipo: { id, nombre: limpio } };
};
