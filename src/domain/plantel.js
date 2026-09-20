import { supabase } from "../supabase.js";
import jugadoresDelCodigo from "../jugadores";

export const CLAVE_PLANTEL = "plantel_jugadores";

// Una copia por club: sin esto, al cambiar de equipo quedaban a la vista los
// jugadores del anterior.
const claveDelPlantel = (equipoId) =>
  equipoId ? `${CLAVE_PLANTEL}:${equipoId}` : CLAVE_PLANTEL;

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

// Lo que Entrenamiento suma a cada jugador: su atleta en Catapult. Va aparte
// de normalizarJugador para que la forma que usa Partido no cambie.
export const normalizarJugadorConCatapult = (fila) => ({
  ...normalizarJugador(fila),
  catapult_id: fila?.catapult_id ? String(fila.catapult_id) : null,
  catapult_nombre: limpiar(fila?.catapult_nombre) || null,
  catapult_vinculado_en: fila?.catapult_vinculado_en || null,
});

/**
 * El plantel que hoy vive en el código, por si la base todavía no respondió o
 * no está disponible. Así los desplegables nunca quedan vacíos.
 */
export const plantelDeRespaldo = () =>
  jugadoresDelCodigo
    .filter(Boolean)
    .map((nombre) => normalizarJugador({ nombre }));

export const leerPlantelGuardado = (equipoId = null) => {
  try {
    const guardado = JSON.parse(
      localStorage.getItem(claveDelPlantel(equipoId)) || "null",
    );
    if (!Array.isArray(guardado) || guardado.length === 0) return null;
    return guardado.map(normalizarJugador);
  } catch (error) {
    console.warn("No se pudo leer el plantel guardado:", error);
    return null;
  }
};

export const guardarPlantelLocal = (plantel, equipoId = null) => {
  try {
    localStorage.setItem(claveDelPlantel(equipoId), JSON.stringify(plantel));
  } catch (error) {
    console.warn("No se pudo guardar el plantel en el celular:", error);
  }
};

/**
 * Trae el plantel de la base. Si no se puede, devuelve lo último que quedó
 * guardado en el celular y, si tampoco hay, el del código: un desplegable de
 * nombres vacío deja la app inutilizable.
 */
export const cargarPlantel = async (equipoId = null) => {
  try {
    let consulta = supabase
      .from("jugadores")
      .select("id, nombre, roles, puestos");

    // Sin equipo elegido todavía no hay plantel que traer: en una base con
    // varios clubes, traerlos todos mezclaría los desplegables.
    if (equipoId) consulta = consulta.eq("equipo_id", equipoId);

    const { data, error } = await consulta.order("nombre", { ascending: true });

    if (error) throw error;

    if (Array.isArray(data)) {
      const plantel = ordenarPorNombre(data.map(normalizarJugador));
      guardarPlantelLocal(plantel, equipoId);
      // Un club recién creado no tiene plantel, y eso es un dato: mostrarle el
      // de otro equipo sería peor que mostrarle nada.
      return { plantel, desde: "base" };
    }

    return respaldoDelPlantel(equipoId);
  } catch (error) {
    console.warn("No se pudo leer el plantel de la base:", error);
    return respaldoDelPlantel(equipoId);
  }
};

/**
 * Con la base caída, lo último que se vio de ESE club. La lista del código
 * solo sirve cuando todavía no hay club elegido: es la del Mineiro, y para
 * cualquier otro equipo sería un plantel ajeno.
 */
const respaldoDelPlantel = (equipoId) => ({
  plantel:
    leerPlantelGuardado(equipoId) || (equipoId ? [] : plantelDeRespaldo()),
  desde: "respaldo",
});

export const agregarJugador = async (nombre, equipoId = null) => {
  const limpio = limpiar(nombre);
  if (!limpio) return { error: "Escribí un nombre." };

  const { data, error } = await supabase
    .from("jugadores")
    .insert([
      {
        nombre: limpio,
        roles: [],
        puestos: [],
        ...(equipoId ? { equipo_id: equipoId } : {}),
      },
    ])
    .select();

  if (error) {
    const repetido = /duplicate key|unique/i.test(error.message || "");
    return {
      error: repetido ? "Ese jugador ya está en la lista." : error.message,
    };
  }

  return { jugador: normalizarJugador(data?.[0]) };
};

export const quitarJugador = async (id) => {
  const { error } = await supabase.from("jugadores").delete().eq("id", id);
  return error ? { error: error.message } : {};
};

/**
 * La misma lista que Partido, con el vínculo a Catapult de cada jugador. Va
 * aparte de cargarPlantel para que Partido no dependa de la migración del
 * vínculo: si las columnas todavía no existen, acá se avisa en vez de caer.
 */
export const cargarPlantelConCatapult = async (equipoId = null) => {
  let consulta = supabase
    .from("jugadores")
    .select("id, nombre, roles, puestos, catapult_id, catapult_nombre, catapult_vinculado_en");

  if (equipoId) consulta = consulta.eq("equipo_id", equipoId);

  const { data, error } = await consulta.order("nombre", { ascending: true });

  if (error) {
    const faltaColumna = /catapult_/i.test(error.message || "") && /column|does not exist/i.test(error.message || "");
    return {
      plantel: [],
      error: faltaColumna
        ? "La lista de jugadores todavía no tiene el vínculo con Catapult: falta ejecutar la migración 20260920_jugadores_catapult.sql en Supabase."
        : error.message,
    };
  }

  return { plantel: ordenarPorNombre((data || []).map(normalizarJugadorConCatapult)) };
};

export const guardarVinculoCatapult = async (id, { catapultId, catapultNombre }) => {
  const { error } = await supabase
    .from("jugadores")
    .update({
      catapult_id: catapultId ? String(catapultId) : null,
      catapult_nombre: catapultId ? limpiar(catapultNombre) || null : null,
      catapult_vinculado_en: catapultId ? new Date().toISOString() : null,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    const repetido = /duplicate key|unique/i.test(error.message || "");
    return {
      error: repetido
        ? "Ese atleta de Catapult ya está vinculado a otro jugador."
        : error.message,
    };
  }

  return {};
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
