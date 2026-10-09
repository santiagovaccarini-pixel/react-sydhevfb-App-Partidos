import { CATEGORIAS, categoriaDeTexto, categoriaPorCodigo } from "./categorias.js";

// Evaluaciones › Ajustes: el nombre de cada cabecera de cada test y las
// opciones de cada lista, por club, como en Lesiones › Ajustes (pedido de
// Santiago del 09/10). En la base (migración 20261015_evaluaciones_ajustes)
// hay una fila solo para lo que el club cambió: si no, valen los nombres del
// Excel. Las evaluaciones guardan el código de cada opción; el texto está acá.

// Selección: las categorías, la misma lista en todos los tests.
export const LISTA_SELECCION = "seleccion";

// Las columnas que no se esconden: sin ellas no se sabe de quién es la
// evaluación, de cuándo ni contra qué valores de referencia se clasifica.
export const COLUMNAS_FIJAS = Object.freeze(["fecha", "jugador", "seleccion"]);

const IDIOMAS = ["es-AR", "pt-BR"];

const idiomaLargo = (idioma) => (String(idioma || "").startsWith("pt") ? "pt-BR" : "es-AR");

// Un texto en el idioma pedido, y si está vacío, en el otro.
const enIdioma = (etiquetas, idioma) => {
  const principal = idiomaLargo(idioma);
  const otro = IDIOMAS.find((uno) => uno !== principal);
  return String(etiquetas?.[principal] || etiquetas?.[otro] || "").trim();
};

const conTexto = (etiquetas) => IDIOMAS.some((idioma) => String(etiquetas?.[idioma] || "").trim());

export const configVacia = () => ({ campos: {}, listas: {} });

// Lo que vino de la base, en la forma que usan las pantallas:
// { campos: { test: { campo: { etiquetas, oculto, orden } } },
//   listas: { lista: [{ codigo, etiquetas, oculto, orden }] } }.
export const armarConfig = (filasCampos = [], filasOpciones = []) => {
  const config = configVacia();
  filasCampos.forEach((fila) => {
    if (!config.campos[fila.test]) config.campos[fila.test] = {};
    config.campos[fila.test][fila.campo] = {
      etiquetas: { "es-AR": fila.etiqueta_es || "", "pt-BR": fila.etiqueta_pt || "" },
      oculto: Boolean(fila.oculto),
      orden: fila.orden ?? 0,
    };
  });
  [...filasOpciones]
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .forEach((fila) => {
      if (!config.listas[fila.lista]) config.listas[fila.lista] = [];
      config.listas[fila.lista].push({
        codigo: fila.codigo,
        etiquetas: { "es-AR": fila.etiqueta_es || "", "pt-BR": fila.etiqueta_pt || "" },
        oculto: Boolean(fila.oculto),
        orden: fila.orden ?? 0,
      });
    });
  return config;
};

// ------------------------------------------------------------ Cabeceras --

export const claveDeGrupo = (grupo) => `grupo:${grupo}`;

const propioDe = (test, clave, config) => config?.campos?.[test?.id]?.[clave] || null;

// El nombre de una columna del test en este club.
export const tituloDeColumna = (test, columna, config, idioma) => {
  const propio = propioDe(test, columna.clave, config);
  return (propio && conTexto(propio.etiquetas) ? enIdioma(propio.etiquetas, idioma) : "") || enIdioma(columna.titulo, idioma) || columna.clave;
};

// El nombre de un bloque de columnas (la fila de arriba de las cabeceras).
export const tituloDeGrupo = (test, grupo, config, idioma) => {
  const propio = propioDe(test, claveDeGrupo(grupo.clave), config);
  return (propio && conTexto(propio.etiquetas) ? enIdioma(propio.etiquetas, idioma) : "") || enIdioma(grupo.titulo, idioma) || grupo.clave;
};

export const columnaOculta = (test, clave, config) => !COLUMNAS_FIJAS.includes(clave) && Boolean(propioDe(test, clave, config)?.oculto);

// Las columnas que el club tiene a la vista, en el orden del Excel.
export const columnasVisibles = (test, config) => test.columnas.filter((columna) => !columnaOculta(test, columna.clave, config));

// Las columnas de una vista del test (en Isocinecia, una velocidad, como los
// botones del Excel): las comunes y las de esa vista. Con "todas", o en un
// test sin vistas, todas.
export const VISTA_TODAS = "todas";
export const columnasDeLaVista = (columnas, vista) => (!vista || vista === VISTA_TODAS ? columnas : columnas.filter((columna) => !columna.vista || columna.vista === vista));

// --------------------------------------------------------------- Listas --

// Las opciones del Excel de una lista: Selección (las categorías) o la que
// traiga el test en `listas`.
export const opcionesDelExcel = (lista, test) =>
  lista === LISTA_SELECCION ? CATEGORIAS.map((categoria) => ({ codigo: categoria.codigo, etiquetas: categoria.etiquetas })) : test?.listas?.[lista] || [];

// Las opciones de una lista en este club: las del Excel (con el nombre que
// les puso el club) y las que sumó el club, en su orden. Cada una:
// { valor, etiqueta, oculto, delExcel }.
export const opcionesDeLista = (lista, config, idioma, { test = null, conOcultas = false } = {}) => {
  const delExcel = opcionesDelExcel(lista, test);
  const guardadas = config?.listas?.[lista] || [];
  const porCodigo = new Map(guardadas.map((guardada) => [guardada.codigo, guardada]));
  const codigosDelExcel = new Set(delExcel.map((opcion) => opcion.codigo));
  const todas = [
    ...delExcel.map((opcion, indice) => {
      const guardada = porCodigo.get(opcion.codigo);
      return {
        codigo: opcion.codigo,
        etiquetas: guardada && conTexto(guardada.etiquetas) ? guardada.etiquetas : opcion.etiquetas,
        oculto: Boolean(guardada?.oculto),
        orden: guardada?.orden ?? indice,
        delExcel: true,
      };
    }),
    ...guardadas.filter((guardada) => !codigosDelExcel.has(guardada.codigo)).map((guardada) => ({ ...guardada, delExcel: false })),
  ];
  // Las del Excel van en su orden; una que sumó el club, donde la puso.
  return todas
    .map((opcion, indice) => ({ opcion, indice }))
    .sort((a, b) => a.opcion.orden - b.opcion.orden || a.indice - b.indice)
    .map(({ opcion }) => opcion)
    .filter((opcion) => conOcultas || !opcion.oculto)
    .map((opcion) => ({ valor: opcion.codigo, etiqueta: enIdioma(opcion.etiquetas, idioma) || opcion.codigo, oculto: opcion.oculto, delExcel: opcion.delExcel }));
};

// El texto de una opción guardada. Una que ya no está en la lista se muestra
// igual (por su código), para no perder lo cargado.
export const etiquetaDeOpcion = (lista, codigo, config, idioma, test = null) => {
  if (!codigo) return "";
  return opcionesDeLista(lista, config, idioma, { test, conOcultas: true }).find((opcion) => opcion.valor === codigo)?.etiqueta || String(codigo);
};

// Una categoría de la lista del club (también una escondida: lo cargado
// sigue valiendo).
export const esCategoriaDelClub = (codigo, config) => Boolean(codigo) && opcionesDeLista(LISTA_SELECCION, config, "es-AR", { conOcultas: true }).some((opcion) => opcion.valor === codigo);

// Lo que dice el selector del informe: el texto del Excel ("Vs Sub 15") si
// el club no le cambió el nombre a la categoría; si no, "Vs" y su nombre.
export const textoDeComparar = (codigo, config, idioma) => {
  const categoria = categoriaPorCodigo(codigo);
  const guardada = (config?.listas?.[LISTA_SELECCION] || []).find((una) => una.codigo === codigo);
  if (categoria && !(guardada && conTexto(guardada.etiquetas))) return categoria.contra[idiomaLargo(idioma)];
  return `Vs ${etiquetaDeOpcion(LISTA_SELECCION, codigo, config, idioma)}`;
};

const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_-]+/g, "")
    .toLowerCase();

// La categoría de un texto pegado del Excel: la del Excel ("Sub-15",
// "Profissional"…) o una del club por su nombre en cualquiera de los dos
// idiomas. null si está vacío, undefined si no es ninguna.
export const categoriaDeTextoDelClub = (texto, config) => {
  const delExcel = categoriaDeTexto(texto);
  if (delExcel !== undefined) return delExcel;
  const buscado = normalizar(texto);
  const encontrada = (config?.listas?.[LISTA_SELECCION] || []).find(
    (opcion) => normalizar(opcion.codigo) === buscado || IDIOMAS.some((idioma) => normalizar(opcion.etiquetas?.[idioma]) === buscado),
  );
  return encontrada ? encontrada.codigo : undefined;
};

// Código para una opción nueva que agrega el club.
export const codigoNuevo = (texto) => {
  const base = String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${base || "opcion"}_${Date.now().toString(36)}`;
};
