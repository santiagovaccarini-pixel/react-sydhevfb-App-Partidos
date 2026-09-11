import { supabase } from "../supabase.js";
import jugadoresDelCodigo from "../jugadores";

export const CLAVE_PLANTEL = "plantel_jugadores";

// Los tres roles gruesos. Un jugador puede tener más de uno.
export const ROLES = ["Defensa", "Mediocampo", "Ataque"];

// Los puestos concretos, con la sigla que se muestra y el nombre que se lee al
// abrir la lista. Sin arquero: la app trabaja con los diez de campo.
export const PUESTOS = [
  { sigla: "LAT", nombre: "Lateral" },
  { sigla: "CAR", nombre: "Carrilero" },
  { sigla: "DEF", nombre: "Defensor" },
  { sigla: "VD", nombre: "Volante Defensivo" },
  { sigla: "VC", nombre: "Volante Central" },
  { sigla: "VM", nombre: "Volante Mixto" },
  { sigla: "VOL", nombre: "Volante" },
  { sigla: "VO", nombre: "Volante Ofensivo" },
  { sigla: "EXT", nombre: "Extremo" },
  { sigla: "MP", nombre: "Mediapunta" },
  { sigla: "DEL", nombre: "Delantero" },
];

export const MAXIMO_PUESTOS = 4;

export const nombrePuesto = (sigla) =>
  PUESTOS.find((puesto) => puesto.sigla === sigla)?.nombre || sigla;

const limpiar = (valor) => String(valor ?? "").trim();

const ordenarPorNombre = (lista) =>
  [...lista].sort((uno, otro) =>
    limpiar(uno.nombre).localeCompare(limpiar(otro.nombre), "es"),
  );

export const normalizarJugador = (fila) => ({
  id: fila?.id ?? null,
  nombre: limpiar(fila?.nombre),
  roles: (Array.isArray(fila?.roles) ? fila.roles : []).filter((rol) =>
    ROLES.includes(rol),
  ),
  puestos: (Array.isArray(fila?.puestos) ? fila.puestos : [])
    .filter((sigla) => PUESTOS.some((puesto) => puesto.sigla === sigla))
    .slice(0, MAXIMO_PUESTOS),
});

/**
 * El plantel que hoy vive en el código, por si la base todavía no respondió o
 * no está disponible. Así los desplegables nunca quedan vacíos.
 */
export const plantelDeRespaldo = () =>
  jugadoresDelCodigo
    .filter(Boolean)
    .map((nombre) => normalizarJugador({ nombre }));

export const leerPlantelGuardado = () => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_PLANTEL) || "null");
    if (!Array.isArray(guardado) || guardado.length === 0) return null;
    return guardado.map(normalizarJugador);
  } catch (error) {
    console.warn("No se pudo leer el plantel guardado:", error);
    return null;
  }
};

export const guardarPlantelLocal = (plantel) => {
  try {
    localStorage.setItem(CLAVE_PLANTEL, JSON.stringify(plantel));
  } catch (error) {
    console.warn("No se pudo guardar el plantel en el celular:", error);
  }
};

/**
 * Trae el plantel de la base. Si no se puede, devuelve lo último que quedó
 * guardado en el celular y, si tampoco hay, el del código: un desplegable de
 * nombres vacío deja la app inutilizable.
 */
export const cargarPlantel = async () => {
  try {
    const { data, error } = await supabase
      .from("jugadores")
      .select("id, nombre, roles, puestos")
      .order("nombre", { ascending: true });

    if (error) throw error;

    if (Array.isArray(data) && data.length > 0) {
      const plantel = ordenarPorNombre(data.map(normalizarJugador));
      guardarPlantelLocal(plantel);
      return { plantel, desde: "base" };
    }

    // Una tabla vacía no es lo mismo que una tabla inaccesible, pero en los dos
    // casos conviene no dejar la app sin nombres.
    return { plantel: leerPlantelGuardado() || plantelDeRespaldo(), desde: "respaldo" };
  } catch (error) {
    console.warn("No se pudo leer el plantel de la base:", error);
    return { plantel: leerPlantelGuardado() || plantelDeRespaldo(), desde: "respaldo" };
  }
};

export const agregarJugador = async (nombre) => {
  const limpio = limpiar(nombre);
  if (!limpio) return { error: "Escribí un nombre." };

  const { data, error } = await supabase
    .from("jugadores")
    .insert([{ nombre: limpio, roles: [], puestos: [] }])
    .select();

  if (error) {
    const repetido = /duplicate key|unique/i.test(error.message || "");
    return { error: repetido ? "Ese jugador ya está en la lista." : error.message };
  }

  return { jugador: normalizarJugador(data?.[0]) };
};

export const quitarJugador = async (id) => {
  const { error } = await supabase.from("jugadores").delete().eq("id", id);
  return error ? { error: error.message } : {};
};

export const guardarPuestos = async (id, { roles, puestos }) => {
  const { error } = await supabase
    .from("jugadores")
    .update({ roles, puestos, actualizado_en: new Date().toISOString() })
    .eq("id", id);

  return error ? { error: error.message } : {};
};

// Lo que esperan los desplegables de nombre: una lista de textos con el vacío
// adelante, como la que había en el código.
export const nombresDelPlantel = (plantel) => [
  "",
  ...plantel.map((jugador) => jugador.nombre).filter(Boolean),
];
