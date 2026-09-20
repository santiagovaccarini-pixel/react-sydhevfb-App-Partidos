// Vínculo entre la lista de jugadores de la app y los atletas de Catapult.
// Lógica pura: normaliza nombres, propone a quién corresponde cada jugador y
// marca conflictos. La decisión final siempre es de la persona.

const quitarAcentos = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "");

// "VITAO ." → "VITAO"; "Kauã Pascini" → "KAUA PASCINI"; espacios de más fuera.
export const normalizarNombre = (texto) =>
  quitarAcentos(texto)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (texto) => normalizarNombre(texto).split(" ").filter(Boolean);

// Las formas en que puede aparecer un atleta de Catapult: nombre y apellido,
// apellido y nombre, apodo, y solo apellido o solo nombre si el otro campo
// está vacío o es un punto.
export const variantesAtleta = (atleta) => {
  const nombre = normalizarNombre(atleta?.first_name);
  const apellido = normalizarNombre(atleta?.last_name);
  const apodo = normalizarNombre(atleta?.nickname);
  const completo = normalizarNombre(atleta?.nombre);

  return [...new Set(
    [
      completo,
      nombre && apellido ? `${nombre} ${apellido}` : "",
      nombre && apellido ? `${apellido} ${nombre}` : "",
      nombre,
      apellido,
      apodo,
    ].filter(Boolean),
  )];
};

export const nombreVisibleAtleta = (atleta) => {
  const partes = [atleta?.first_name, atleta?.last_name]
    .map(normalizarNombre)
    .filter(Boolean);
  const base = partes.join(" ") || normalizarNombre(atleta?.nombre) || normalizarNombre(atleta?.nickname);
  const jersey = String(atleta?.jersey || "").trim();
  return jersey ? `${base} (${jersey})` : base;
};

const mismoConjunto = (a, b) => a.length === b.length && a.every((token) => b.includes(token));

// Todos los tokens del más corto están en el más largo (p. ej. "A MINDA" vs
// "ALEXANDRE MINDA" no; "REINIER" vs "REINIER JESUS" sí).
const contenido = (a, b) => {
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  return corto.length > 0 && corto.every((token) => largo.includes(token));
};

const puntuar = (jugador, atleta) => {
  const objetivo = normalizarNombre(jugador?.nombre);
  if (!objetivo) return 0;
  const tokensJugador = tokens(objetivo);
  const variantes = variantesAtleta(atleta);

  if (variantes.includes(objetivo)) return 3;
  if (variantes.some((variante) => mismoConjunto(tokens(variante), tokensJugador))) return 2;
  if (variantes.some((variante) => contenido(tokens(variante), tokensJugador))) return 1;
  return 0;
};

export const NIVEL = { 3: "exacto", 2: "exacto", 1: "probable", 0: null };

// Para cada jugador de la app, el atleta de Catapult que más le calza.
// - `vinculo`: el atleta ya guardado (catapult_id), si existe en la lista.
// - `propuesta`: el mejor candidato y su nivel (exacto / probable), o null.
// - `conflicto`: dos jugadores con el mismo atleta propuesto o guardado.
export const proponerVinculos = ({ jugadores = [], atletas = [] }) => {
  const porId = new Map(atletas.map((atleta) => [String(atleta.id), atleta]));

  const filas = jugadores.map((jugador) => {
    const guardado = jugador?.catapult_id ? porId.get(String(jugador.catapult_id)) || null : null;

    let mejor = null;
    let mejorPuntaje = 0;
    let empate = false;
    atletas.forEach((atleta) => {
      const puntaje = puntuar(jugador, atleta);
      if (puntaje > mejorPuntaje) {
        mejor = atleta;
        mejorPuntaje = puntaje;
        empate = false;
      } else if (puntaje > 0 && puntaje === mejorPuntaje) {
        empate = true;
      }
    });

    const propuesta =
      mejor && !empate
        ? { atletaId: String(mejor.id), nombre: nombreVisibleAtleta(mejor), nivel: NIVEL[mejorPuntaje] }
        : null;

    return {
      jugadorId: jugador?.id ?? null,
      nombre: jugador?.nombre || "",
      vinculo: guardado
        ? { atletaId: String(guardado.id), nombre: nombreVisibleAtleta(guardado) }
        : jugador?.catapult_id
          ? { atletaId: String(jugador.catapult_id), nombre: jugador.catapult_nombre || "", ausente: true }
          : null,
      propuesta,
      empate,
      conflicto: false,
    };
  });

  // Conflictos: el mismo atleta elegido (guardado o propuesto) para dos jugadores.
  const usos = new Map();
  filas.forEach((fila) => {
    const atletaId = fila.vinculo?.atletaId || fila.propuesta?.atletaId;
    if (!atletaId) return;
    usos.set(atletaId, (usos.get(atletaId) || 0) + 1);
  });
  filas.forEach((fila) => {
    const atletaId = fila.vinculo?.atletaId || fila.propuesta?.atletaId;
    if (atletaId && usos.get(atletaId) > 1) fila.conflicto = true;
  });

  return filas;
};

export const resumirVinculos = (filas = []) => ({
  total: filas.length,
  vinculados: filas.filter((fila) => fila.vinculo && !fila.vinculo.ausente).length,
  ausentes: filas.filter((fila) => fila.vinculo?.ausente).length,
  exactos: filas.filter((fila) => !fila.vinculo && fila.propuesta?.nivel === "exacto").length,
  probables: filas.filter((fila) => !fila.vinculo && fila.propuesta?.nivel === "probable").length,
  sinPropuesta: filas.filter((fila) => !fila.vinculo && !fila.propuesta).length,
  conflictos: filas.filter((fila) => fila.conflicto).length,
});
