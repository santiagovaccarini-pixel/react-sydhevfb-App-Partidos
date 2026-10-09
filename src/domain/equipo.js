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
    if (!guardado.startsWith("{")) return { id: guardado, nombre: "", hasta: null };

    const leido = JSON.parse(guardado);
    return leido?.id ? { id: leido.id, nombre: limpiar(leido.nombre), hasta: leido.hasta || null, ...membresiaDe(leido) } : null;
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
        JSON.stringify({ id: equipo.id, nombre: limpiar(equipo.nombre), hasta: equipo.hasta || null, ...membresiaDe(equipo) }),
      );
    } else {
      localStorage.removeItem(CLAVE_EQUIPO_ELEGIDO);
    }
  } catch (error) {
    console.warn("No se pudo guardar el equipo elegido:", error);
  }
};

// El rol y los módulos de la cuenta en un club, solo si la base los trae
// (una base sin la migración de cuentas v2 no los tiene: ahí manda la cuenta).
function membresiaDe(fila) {
  const resultado = {};
  if (fila?.rol) resultado.rol = fila.rol;
  ["partido", "flujo", "lesiones", "evaluaciones"].forEach((clave) => {
    if (typeof fila?.[clave] === "boolean") resultado[clave] = fila[clave];
  });
  return resultado;
}

// Un club con lo que quien entró tiene en él: `hasta` es su último día si
// ya se fue (vacío mientras sigue), `miembro` dice si está o estuvo (una
// base de antes le mostraba al dueño también clubes en los que no está), y
// el rol y los módulos de su membresía.
const normalizarEquipo = (fila) => ({
  id: fila?.id ?? null,
  nombre: limpiar(fila?.nombre),
  hasta: fila?.hasta || null,
  miembro: fila?.desde === undefined ? true : Boolean(fila.desde),
  ...membresiaDe(fila),
});

/** Quien ya se fue del club: ve lo cargado hasta su último día y no cambia nada. */
export const esSoloLectura = (equipo) => Boolean(equipo?.hasta);

// Los clubes de quien consulta, con su membresía. Si la base todavía no
// tiene la vista (o algo falló), no hay membresía que leer: devuelve null.
const leerMisClubes = async () => {
  try {
    // Todas las columnas: así sirve con la vista vieja (sin rol ni módulos)
    // y con la de cuentas v2.
    const { data, error } = await supabase
      .from("v_mis_clubes")
      .select("*")
      .order("nombre", { ascending: true });
    if (error) return null;
    return (data || []).map(normalizarEquipo).filter((e) => e.id);
  } catch {
    return null;
  }
};

export const cargarEquipos = async () => {
  const misClubes = await leerMisClubes();
  if (misClubes) return { equipos: misClubes };

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
