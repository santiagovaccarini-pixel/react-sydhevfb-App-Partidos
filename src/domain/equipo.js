import { supabase } from "../supabase.js";

/**
 * El equipo propio: el que aparece a la izquierda del marcador en todas las
 * pantallas. Se elige en Ajustes y se guarda en la base, para que sea el mismo
 * si abrís la app en otro teléfono.
 *
 * El escudo no se configura: se busca por nombre contra la base de clubes, que
 * es lo que ya hace el rival.
 */

export const EQUIPO_POR_DEFECTO = "Atlético Mineiro";
export const CLAVE_EQUIPO = "equipo_propio";

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

export const leerEquipoGuardado = () => {
  try {
    return limpiar(localStorage.getItem(CLAVE_EQUIPO)) || null;
  } catch (error) {
    console.warn("No se pudo leer el equipo guardado:", error);
    return null;
  }
};

export const guardarEquipoLocal = (nombre) => {
  try {
    localStorage.setItem(CLAVE_EQUIPO, limpiar(nombre));
  } catch (error) {
    console.warn("No se pudo guardar el equipo en el celular:", error);
  }
};

/**
 * Trae el equipo de la base. Si no se puede, el último que quedó en el
 * teléfono y, si tampoco hay, el de siempre: la app nunca se queda sin nombre.
 */
export const cargarEquipoPropio = async () => {
  try {
    const { data, error } = await supabase
      .from("ajustes")
      .select("valor")
      .eq("clave", CLAVE_EQUIPO)
      .maybeSingle();

    if (error) throw error;

    const nombre = limpiar(data?.valor);

    if (nombre) {
      guardarEquipoLocal(nombre);
      return { equipo: nombre, desde: "base" };
    }

    return {
      equipo: leerEquipoGuardado() || EQUIPO_POR_DEFECTO,
      desde: "respaldo",
    };
  } catch (error) {
    console.warn("No se pudo leer el equipo de la base:", error);
    return {
      equipo: leerEquipoGuardado() || EQUIPO_POR_DEFECTO,
      desde: "respaldo",
    };
  }
};

export const guardarEquipoPropio = async (nombre) => {
  const limpio = limpiar(nombre);
  if (!limpio) return { error: "Escribí el nombre del equipo." };

  // Se guarda primero en el teléfono: si la base falla, al menos en este
  // aparato el equipo queda como lo elegiste.
  guardarEquipoLocal(limpio);

  const { error } = await supabase
    .from("ajustes")
    .upsert(
      {
        clave: CLAVE_EQUIPO,
        valor: limpio,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "clave" },
    );

  return error ? { equipo: limpio, error: error.message } : { equipo: limpio };
};
