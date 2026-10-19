// Exportar todos los datos de un atleta (portabilidad, 20261104; Santiago,
// 18/10: «Excel y además JSON», con las bases, los partidos donde estuvo y
// el historial de cambios). Con lo que contesta exportar_atleta arma:
//   · el Excel: una hoja por base, con los nombres de columnas y de listas
//     del club, como se ven en la app (lo guardado, no lo que se calcula);
//   · el JSON: lo guardado tal cual, para que lo lea otro sistema.
// t: el traductor de la app (los textos fijos de las hojas).
import { fechaCorta, fechaYHora } from "../idioma/formatos.js";
import { CAMPOS, armarConfig as armarConfigLesiones, etiquetaDeCampo, etiquetaDeOpcion as opcionDeLesiones } from "./lesionesCampos.js";
import { camposCambiados, valorDe } from "./lesiones.js";
import { armarConfig as armarConfigEvaluaciones, etiquetaDeOpcion as opcionDeEvaluaciones, tituloDeColumna } from "./evaluaciones/ajustes.js";
import { listaDeColumna } from "./evaluaciones/celdas.js";
import { TESTS } from "./evaluaciones/tests/index.js";
import { armarConfigGps, gpsDelClub } from "./gps/ajustes.js";
import { textoDeSegundos } from "./gps/valores.js";
import { leerLocalia } from "./localia.js";
import { nombrePuesto } from "./plantel.js";
import { textoDeMinutos } from "./tabla.js";

const vacio = (valor) => valor === null || valor === undefined || valor === "";
const numero = (valor) => (typeof valor === "number" && Number.isFinite(valor) ? valor : vacio(valor) ? "" : String(valor));

// Los nombres de columnas y listas del club que vinieron con la exportación.
export const configsDeLaExportacion = (ajustes = {}) => {
  const lesionesOpciones = ajustes.lesiones_opciones || [];
  return {
    lesiones: armarConfigLesiones(ajustes.lesiones_campos || [], lesionesOpciones),
    evaluaciones: armarConfigEvaluaciones(
      ajustes.evaluaciones_campos || [],
      ajustes.evaluaciones_opciones || [],
      lesionesOpciones.filter((fila) => fila.campo === "categoria"),
    ),
    gps: armarConfigGps(ajustes.gps_campos || [], ajustes.gps_opciones || []),
  };
};

// Quién y cuándo, al final de cada fila de una base.
const autoria = (t) => [t("exportar.columnas.cargadoPor"), t("exportar.columnas.cargadoEl"), t("exportar.columnas.cambiadoPor"), t("exportar.columnas.cambiadoEl")];
const autoriaDe = (fila) => [fila.creado_por || "", fechaYHora(fila.creado_en), fila.actualizado_por || "", fechaYHora(fila.actualizado_en)];

// ------------------------------------------------------- Datos básicos --

const hojaDatos = (datos, config, idioma, t) => {
  const jugador = datos.jugador || {};
  const opcion = (clave) => (vacio(jugador[clave]) ? "" : opcionDeLesiones(clave, jugador[clave], config, idioma));
  const anteriores = (datos.nombres_anteriores || []).map((uno) => `${uno.nombre} (${t("exportar.hasta", { fecha: fechaCorta(uno.hasta) })})`);
  const filas = [
    [etiquetaDeCampo("jugador", config, idioma), jugador.nombre || ""],
    [t("datos.actual"), jugador.actual === false ? t("comun.no") : t("comun.si")],
    [etiquetaDeCampo("categoria", config, idioma), opcion("categoria")],
    [etiquetaDeCampo("fecha_nacimiento", config, idioma), fechaCorta(jugador.fecha_nacimiento)],
    [etiquetaDeCampo("pie_dominante", config, idioma), opcion("pie_dominante")],
    [etiquetaDeCampo("posicion", config, idioma), opcion("posicion")],
    [t("datos.foto"), jugador.foto_url || ""],
    [t("datos.horasPrevias"), numero(jugador.horas_previas)],
    [t("exportar.columnas.numeroRegistro"), jugador.numero_registro || ""],
    [t("exportar.columnas.puestos"), (jugador.puestos || []).map(nombrePuesto).join(", ")],
    [t("exportar.columnas.catapult"), jugador.catapult_nombre || ""],
    [t("exportar.columnas.nombresAnteriores"), anteriores.join(" · ")],
    [t("exportar.columnas.cargadoEl"), fechaYHora(jugador.creado_en)],
  ];
  return { nombre: t("exportar.hojas.datos"), filas: [[t("exportar.columnas.dato"), t("exportar.columnas.valor")], ...filas] };
};

// ------------------------------------------------------------ Lesiones --

// Lo que se carga de una lesión (no lo que se calcula ni lo que viene de
// Datos básicos, salvo la categoría de ese momento).
const CAMPOS_DE_LESION = CAMPOS.filter(
  (campo) => ["auto", "lista", "fecha", "fecha_hora", "numero", "texto", "texto_largo"].includes(campo.tipo) || campo.clave === "categoria",
);

const textoDeLesion = (lesion, campo, config, idioma) => {
  const valor = valorDe(lesion, campo.clave);
  if (vacio(valor)) return "";
  if (campo.tipo === "lista" || campo.clave === "categoria") return opcionDeLesiones(campo.clave, valor, config, idioma);
  if (campo.tipo === "fecha") return fechaCorta(valor);
  if (campo.tipo === "fecha_hora") return fechaYHora(valor);
  if (campo.tipo === "numero" || campo.tipo === "auto") return numero(valor);
  return String(valor);
};

const hojaLesiones = (lesiones, config, idioma, t) => ({
  nombre: t("exportar.hojas.lesiones"),
  filas: [
    [...CAMPOS_DE_LESION.map((campo) => etiquetaDeCampo(campo.clave, config, idioma)), ...autoria(t)],
    ...lesiones.map((lesion) => [...CAMPOS_DE_LESION.map((campo) => textoDeLesion(lesion, campo, config, idioma)), ...autoriaDe(lesion)]),
  ],
});

// -------------------------------------------------------- Evaluaciones --

const TIPOS_CARGADOS = ["fecha", "lista", "tiempo", "numero", "texto"];

const textoDeEvaluacion = (fila, test, columna, config, idioma) => {
  if (columna.tipo === "fecha") return fechaCorta(fila.fecha);
  const valor = fila.datos?.[columna.clave];
  if (vacio(valor)) return "";
  if (columna.tipo === "lista") return opcionDeEvaluaciones(listaDeColumna(columna), valor, config, idioma, test);
  if (columna.tipo === "tiempo") return typeof valor === "number" ? textoDeMinutos(valor) : String(valor);
  if (columna.tipo === "numero") return numero(valor);
  return String(valor);
};

// Una hoja por test, con lo que se carga de cada uno.
const hojasEvaluaciones = (evaluaciones, config, idioma, t) => {
  const porTest = new Map();
  evaluaciones.forEach((fila) => porTest.set(fila.test, [...(porTest.get(fila.test) || []), fila]));
  const conocidos = TESTS.filter((test) => porTest.has(test.id)).map((test) => {
    const columnas = test.columnas.filter((columna) => TIPOS_CARGADOS.includes(columna.tipo));
    return {
      nombre: test.titulo?.[idioma] || test.titulo?.["es-AR"] || test.id,
      filas: [
        [...columnas.map((columna) => tituloDeColumna(test, columna, config, idioma)), ...autoria(t)],
        ...porTest.get(test.id).map((fila) => [...columnas.map((columna) => textoDeEvaluacion(fila, test, columna, config, idioma)), ...autoriaDe(fila)]),
      ],
    };
  });
  // Un test que la app ya no tiene: lo guardado, con sus claves.
  const otros = [...porTest.keys()]
    .filter((id) => !TESTS.some((test) => test.id === id))
    .map((id) => {
      const filas = porTest.get(id);
      const claves = [...new Set(filas.flatMap((fila) => Object.keys(fila.datos || {})))].sort();
      return {
        nombre: id,
        filas: [[t("exportar.columnas.fecha"), ...claves, ...autoria(t)], ...filas.map((fila) => [fechaCorta(fila.fecha), ...claves.map((clave) => numero(fila.datos?.[clave])), ...autoriaDe(fila)])],
      };
    });
  return [...conocidos, ...otros];
};

// ----------------------------------------------------------------- GPS --

const textoDeGps = (fila, gps, columna, config, idioma) => {
  const valor = columna.clave === "fecha" ? fila.fecha : fila.datos?.[columna.clave];
  if (vacio(valor)) return "";
  if (columna.tipo === "fecha") return fechaCorta(valor);
  if (columna.tipo === "lista") return opcionDeEvaluaciones(columna.lista || columna.clave, valor, config, idioma, gps);
  if (columna.tipo === "tiempo" || columna.tipo === "hora") return typeof valor === "number" ? textoDeSegundos(valor) : String(valor);
  if (columna.tipo === "numero" || columna.tipo === "porMinuto") return numero(valor);
  return String(valor);
};

const hojaGps = (filas, config, idioma, t) => {
  const gps = gpsDelClub(config);
  const usadas = new Set(filas.flatMap((fila) => Object.keys(fila.datos || {})));
  const columnas = gps.columnas.filter((columna) => columna.tipo !== "jugador" && (columna.clave === "fecha" || usadas.has(columna.clave)));
  const conFecha = columnas.some((columna) => columna.clave === "fecha") ? columnas : [{ clave: "fecha", tipo: "fecha", titulo: { "es-AR": t("exportar.columnas.fecha"), "pt-BR": t("exportar.columnas.fecha") } }, ...columnas];
  return {
    nombre: t("exportar.hojas.gps"),
    filas: [
      [...conFecha.map((columna) => tituloDeColumna(gps, columna, config, idioma)), ...autoria(t)],
      ...filas.map((fila) => [...conFecha.map((columna) => textoDeGps(fila, gps, columna, config, idioma)), ...autoriaDe(fila)]),
    ],
  };
};

// ------------------------------------------------------------ Partidos --

const hojaPartidos = (partidos, t) => ({
  nombre: t("exportar.hojas.partidos"),
  filas: [
    ["fecha", "rival", "resultado", "localia", "convocado", "titular", "entro", "salio"].map((clave) => t(`exportar.columnas.${clave}`)),
    ...partidos.map((uno) => [
      fechaCorta(uno.fecha) || uno.fecha || "",
      uno.rival || "",
      uno.resultado || "",
      t(`exportar.localia.${leerLocalia(uno.localia)}`),
      uno.convocado ? t("comun.si") : t("comun.no"),
      uno.titular ? t("comun.si") : t("comun.no"),
      (uno.entro || []).filter(Boolean).join(", "),
      (uno.salio || []).filter(Boolean).join(", "),
    ]),
  ],
});

// ----------------------------------------------------------- Historial --

const tituloDelTest = (id, idioma) => {
  const test = TESTS.find((uno) => uno.id === id);
  return test?.titulo?.[idioma] || test?.titulo?.["es-AR"] || id || "";
};

const registroDe = (cambio, idioma, t) => {
  if (cambio.base === "lesiones") return cambio.numero_caso ? t("exportar.caso", { n: cambio.numero_caso }) : "";
  if (cambio.base === "evaluaciones") return [tituloDelTest(cambio.test, idioma), fechaCorta(cambio.fecha)].filter(Boolean).join(" · ");
  if (cambio.base === "gps") return fechaCorta(cambio.fecha);
  return "";
};

const hojaHistorial = (historial, config, idioma, t) => ({
  nombre: t("exportar.hojas.historial"),
  filas: [
    ["cuando", "base", "accion", "registro", "quien", "cambios"].map((clave) => t(`exportar.columnas.${clave}`)),
    ...historial.map((cambio) => [
      fechaYHora(cambio.cuando),
      t(`exportar.hojas.${cambio.base}`),
      t(`exportar.acciones.${cambio.accion}`),
      registroDe(cambio, idioma, t),
      cambio.quien || "",
      cambio.base === "lesiones" && cambio.accion === "editada"
        ? camposCambiados(cambio.antes, cambio.despues)
            .map((clave) => etiquetaDeCampo(clave, config, idioma))
            .join(", ")
        : "",
    ]),
  ],
});

// ------------------------------------------------------------- Todo junto --

// Las hojas del Excel, en el orden de la app (las bases sin nada no van,
// salvo Datos básicos).
export const hojasDeLaExportacion = (datos, { idioma, t }) => {
  const configs = configsDeLaExportacion(datos.ajustes);
  const lesiones = datos.lesiones || [];
  const evaluaciones = datos.evaluaciones || [];
  const gps = datos.gps || [];
  const partidos = datos.partidos || [];
  const historial = datos.historial || [];
  return [
    hojaDatos(datos, configs.lesiones, idioma, t),
    ...(lesiones.length ? [hojaLesiones(lesiones, configs.lesiones, idioma, t)] : []),
    ...hojasEvaluaciones(evaluaciones, configs.evaluaciones, idioma, t),
    ...(gps.length ? [hojaGps(gps, configs.gps, idioma, t)] : []),
    ...(partidos.length ? [hojaPartidos(partidos, t)] : []),
    ...(historial.length ? [hojaHistorial(historial, configs.lesiones, idioma, t)] : []),
  ];
};

// El JSON: lo guardado tal cual (sin los ajustes del club, que no son del
// atleta).
export const jsonDeLaExportacion = (datos) =>
  JSON.stringify(
    {
      generado_en: datos.generado_en,
      club: datos.club,
      atleta: { ...(datos.jugador || {}), nombres_anteriores: datos.nombres_anteriores || [] },
      lesiones: datos.lesiones || [],
      evaluaciones: datos.evaluaciones || [],
      gps: datos.gps || [],
      partidos: datos.partidos || [],
      historial: datos.historial || [],
    },
    null,
    2,
  );

// El nombre de los archivos: «datos-de-ana-perez-2026-10-19».
export const nombreDeArchivo = (prefijo, nombre, hoy) =>
  `${prefijo}-${String(nombre || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "atleta"}-${hoy}`;
