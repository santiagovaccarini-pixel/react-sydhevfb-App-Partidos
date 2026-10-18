import { CATEGORIAS, categoriaDeTexto, categoriaPorCodigo, deDatosBasicos } from "./categorias.js";
import { armarConfig as armarConfigDeDatos, opcionesDeCampo } from "../lesionesCampos.js";

// Evaluaciones › Ajustes: el nombre de cada cabecera de cada test y las
// opciones de cada lista, por club, como en Lesiones › Ajustes (pedido de
// Santiago del 09/10). En la base (migración 20261015_evaluaciones_ajustes)
// hay una fila solo para lo que el club cambió: si no, valen los nombres del
// Excel. Las evaluaciones guardan el código de cada opción; el texto está acá.

// Selección: las categorías, la misma lista en todos los tests. Desde el
// 18/10 son las de Datos básicos (ver opcionesDeCategorias).
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
//   listas: { lista: [{ codigo, etiquetas, oculto, orden }] },
//   categorias: lo de Datos básicos › Ajustes (la lista Categoría del club),
//   o null si no se pudo leer (valen las de la app) }.
export const armarConfig = (filasCampos = [], filasOpciones = [], filasCategorias = null) => {
  const config = configVacia();
  config.categorias = filasCategorias ? armarConfigDeDatos([], filasCategorias) : null;
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
// Una columna relativa (por minuto, por peso) no tiene nombre propio: es el
// de su absoluta con «/min» o «/PC» (Santiago, 13/10: «solo se puede cambiar
// el nombre de las absolutas y las relativas pasan a tomar el nombre del
// absoluto pero dependiendo que sea se le agrega /Min o /PC»).
export const absolutaDe = (test, columna) => (columna?.relativa ? test.columnas.find((una) => una.clave === columna.relativa.de) || null : null);

export const tituloDeColumna = (test, columna, config, idioma) => {
  const absoluta = absolutaDe(test, columna);
  if (absoluta) return `${tituloDeColumna(test, absoluta, config, idioma)}${columna.relativa.sufijo}`;
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

// Las categorías (Selección): las de Datos básicos, con sus nombres y en su
// orden (Santiago, 18/10: «La de Datos básicos»; se cambian en Datos básicos
// › Ajustes, ya no en Evaluaciones). Lo cargado antes con una categoría que
// no está allá (una del Excel o una que el club había sumado acá) se sigue
// viendo con su nombre, como escondida: no se elige.
const opcionesDeCategorias = (config, idioma, conOcultas) => {
  const deDatos = opcionesDeCampo("categoria", config?.categorias || null, idioma, { conOcultas: true }).map((opcion) => {
    const valor = deDatosBasicos(opcion.valor);
    return { valor, etiqueta: opcion.etiqueta, oculto: opcion.oculto, delExcel: Boolean(categoriaPorCodigo(valor)) };
  });
  const vistas = new Set(deDatos.map((opcion) => opcion.valor));
  const viejas = [...CATEGORIAS.map((categoria) => ({ codigo: categoria.codigo, etiquetas: categoria.etiquetas })), ...(config?.listas?.[LISTA_SELECCION] || [])]
    .filter((opcion) => {
      if (vistas.has(opcion.codigo)) return false;
      vistas.add(opcion.codigo);
      return true;
    })
    .map((opcion) => ({
      valor: opcion.codigo,
      etiqueta: enIdioma(opcion.etiquetas, idioma) || enIdioma(categoriaPorCodigo(opcion.codigo)?.etiquetas, idioma) || opcion.codigo,
      oculto: true,
      delExcel: Boolean(categoriaPorCodigo(opcion.codigo)),
    }));
  return [...deDatos, ...viejas].filter((opcion) => conOcultas || !opcion.oculto);
};

// Las opciones de una lista en este club: las del Excel (con el nombre que
// les puso el club) y las que sumó el club, en su orden. Cada una:
// { valor, etiqueta, oculto, delExcel }. Selección, las de Datos básicos.
export const opcionesDeLista = (lista, config, idioma, { test = null, conOcultas = false } = {}) => {
  if (lista === LISTA_SELECCION) return opcionesDeCategorias(config, idioma, conOcultas);
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
// la categoría se llama como en el Excel; si no (en Datos básicos, «Mayor
// (profesional)»), "Vs" y su nombre.
export const textoDeComparar = (codigo, config, idioma) => {
  const categoria = categoriaPorCodigo(codigo);
  const etiqueta = etiquetaDeOpcion(LISTA_SELECCION, codigo, config, idioma);
  if (categoria && etiqueta === categoria.etiquetas[idiomaLargo(idioma)]) return categoria.contra[idiomaLargo(idioma)];
  return `Vs ${etiqueta}`;
};

const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_-]+/g, "")
    .toLowerCase();

// La categoría de un texto pegado del Excel: la del Excel ("Sub-15",
// "Profissional"…) o una del club (las de Datos básicos y las que se ven en lo
// cargado) por su código o su nombre en cualquiera de los dos idiomas. null si
// está vacío, undefined si no es ninguna.
export const categoriaDeTextoDelClub = (texto, config) => {
  const delExcel = categoriaDeTexto(texto);
  if (delExcel !== undefined) return delExcel;
  const buscado = normalizar(texto);
  const encontrada = IDIOMAS.flatMap((idioma) => opcionesDeLista(LISTA_SELECCION, config, idioma, { conOcultas: true })).find(
    (opcion) => normalizar(opcion.valor) === buscado || normalizar(opcion.etiqueta) === buscado,
  );
  return encontrada ? encontrada.valor : undefined;
};

// La opción de una lista de un texto pegado del Excel ("BAJA", "NO 1 y
// 2"…): su código, por el código o por el nombre en cualquiera de los dos
// idiomas (el del Excel o el que le puso el club). null si está vacío o
// undefined si no es ninguna.
export const opcionDeTexto = (lista, texto, config, test = null) => {
  const buscado = normalizar(texto);
  if (!buscado) return null;
  const candidatas = IDIOMAS.flatMap((idioma) => [config, configVacia()].flatMap((cual) => opcionesDeLista(lista, cual, idioma, { test, conOcultas: true })));
  const encontrada = candidatas.find((opcion) => normalizar(opcion.valor) === buscado || normalizar(opcion.etiqueta) === buscado);
  return encontrada ? encontrada.valor : undefined;
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
