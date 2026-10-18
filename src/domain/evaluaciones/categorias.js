// Las categorías del Excel de evaluaciones, las mismas en todas las hojas:
// la lista de "Seleccion" de cada fila y la del selector del informe
// ("Vs Sub 15" … "Vs Mayor"). La app guarda el código; en pantalla va el
// texto del Excel (en portugués, "Mayor" es "Profissional", como en Lesiones).

const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });

export const CATEGORIAS = Object.freeze([
  { codigo: "sub15", excel: "Sub-15", comparar: "Vs Sub 15", etiquetas: et("Sub-15", "Sub-15"), contra: et("Vs Sub 15", "Vs Sub 15") },
  { codigo: "sub17", excel: "Sub-17", comparar: "Vs Sub 17", etiquetas: et("Sub-17", "Sub-17"), contra: et("Vs Sub 17", "Vs Sub 17") },
  { codigo: "sub18", excel: "Sub-18", comparar: "Vs Sub 18", etiquetas: et("Sub-18", "Sub-18"), contra: et("Vs Sub 18", "Vs Sub 18") },
  { codigo: "sub20", excel: "Sub-20", comparar: "Vs Sub 20", etiquetas: et("Sub-20", "Sub-20"), contra: et("Vs Sub 20", "Vs Sub 20") },
  { codigo: "sub23", excel: "Sub-23", comparar: "Vs Sub 23", etiquetas: et("Sub-23", "Sub-23"), contra: et("Vs Sub 23", "Vs Sub 23") },
  { codigo: "mayor", excel: "Mayor", comparar: "Vs Mayor", etiquetas: et("Mayor", "Profissional"), contra: et("Vs Mayor", "Vs Profissional") },
]);

// Con qué categoría compara el informe al abrir (la del Excel).
export const COMPARAR_AL_ABRIR = "mayor";

export const categoriaPorCodigo = (codigo) => CATEGORIAS.find((categoria) => categoria.codigo === codigo) || null;

const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_-]+/g, "")
    .toLowerCase();

// La categoría de un texto pegado del Excel ("Sub-15", "sub 15", "Mayor",
// "Profissional"…): su código, null si está vacío o undefined si no es una
// de la lista.
export const categoriaDeTexto = (texto) => {
  const buscado = normalizar(texto);
  if (!buscado) return null;
  const encontrada = CATEGORIAS.find(
    (categoria) =>
      normalizar(categoria.codigo) === buscado || normalizar(categoria.excel) === buscado || Object.values(categoria.etiquetas).some((etiqueta) => normalizar(etiqueta) === buscado),
  );
  return encontrada ? encontrada.codigo : undefined;
};

// Las categorías de Evaluaciones son las de Datos básicos (Santiago, 18/10, en
// un cuestionario: «Usas las que tenga el jugador en datos basicos» y, para
// la lista y sus nombres, «La de Datos básicos»). Datos básicos guarda
// «profissional» la que acá (en lo cargado y en los V.R.) es «mayor», la del
// Excel; las demás tienen el mismo código. Lo guardado no cambia.
const DE_DATOS_BASICOS = Object.freeze({ profissional: "mayor" });
export const deDatosBasicos = (codigo) => (codigo ? DE_DATOS_BASICOS[codigo] || codigo : null);
export const aDatosBasicos = (codigo) => (codigo ? Object.keys(DE_DATOS_BASICOS).find((clave) => DE_DATOS_BASICOS[clave] === codigo) || codigo : null);

// Al cambiarle la categoría a un jugador en Datos básicos, en sus evaluaciones
// (Santiago, 18/10: «Como hicimos en lesiones, se pregunta mismamente por
// base»): como categoriasAlCambiar de Lesiones, con la fecha de cada
// evaluación y su Selección. «todo» (desde null) deja la nueva en todas;
// «desde» una fecha, las de antes quedan con la que tenían o, si no tenían,
// con la anterior, y las de esa fecha en adelante pasan a la nueva. anterior
// y nueva, como las guarda Datos básicos. Devuelve solo las que cambian:
// [{ id, datos }].
export const seleccionesAlCambiar = (evaluaciones = [], { anterior = "", nueva = "", desde = null } = {}) =>
  evaluaciones
    .map((evaluacion) => {
      const datos = evaluacion.datos || {};
      const antes = Boolean(desde && evaluacion.fecha && evaluacion.fecha < desde);
      const seleccion = antes ? datos.seleccion || deDatosBasicos(anterior) : deDatosBasicos(nueva);
      if ((datos.seleccion || "") === (seleccion || "")) return null;
      const nuevos = { ...datos };
      if (seleccion) nuevos.seleccion = seleccion;
      else delete nuevos.seleccion;
      return { id: evaluacion.id, datos: nuevos };
    })
    .filter(Boolean);
