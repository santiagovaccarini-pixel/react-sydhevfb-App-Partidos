// Lo que la app guarda en el celular de cada club (copias de lo que bajó de
// la base) y cuándo se borra: al salir de la cuenta y cuando la cuenta deja
// un club. Lo que la persona cargó y todavía no subió (partidos pendientes,
// el borrador del partido, los entrenamientos del aparato) no se toca: es
// trabajo suyo, no datos ajenos.

const COPIAS_POR_CLUB = ["backup_registros_partidos", "plantel_jugadores", "plantel_catapult"];
const COPIAS_DE_LA_CUENTA = ["perfil_cuenta", "equipo_elegido"];

const claves = () => {
  try {
    return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(Boolean);
  } catch {
    return [];
  }
};

const borrar = (clave) => {
  try {
    localStorage.removeItem(clave);
  } catch {
    // Sin localStorage no hay nada guardado.
  }
};

// Las copias de un club (o de todos, sin id).
export const limpiarCopiasDelClub = (equipoId = null) => {
  claves().forEach((clave) => {
    const [base, id] = clave.split(":");
    if (!COPIAS_POR_CLUB.includes(base)) return;
    if (!equipoId || id === String(equipoId) || id === undefined) borrar(clave);
  });
};

// Al salir de la cuenta: la copia de la cuenta, el club elegido y las copias
// de todos los clubes.
export const limpiarAlSalir = () => {
  COPIAS_DE_LA_CUENTA.forEach(borrar);
  limpiarCopiasDelClub(null);
};
