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
