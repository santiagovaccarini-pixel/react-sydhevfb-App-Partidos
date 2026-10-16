import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { ListaParaMarcar } from "./components/ListaParaMarcar.jsx";
import { TerminoDe } from "./components/Guia.jsx";
import { textoDeValor } from "./domain/evaluaciones/excel.js";
import { esNumero } from "./domain/gps/valores.js";
import {
  FILTROS_POR_MICROCICLO,
  TIPOS_DE_VARIABLE,
  colorDeCargaCronica,
  colorDeMayorMejor,
  colorDeUa,
  colorDeVariable,
  entraEnElInforme,
  filasPorMicrociclo,
  informePorMicrociclo,
  pasaLosFiltros,
  soloJugadores,
  valorDeFiltro,
  visualizacionPara,
  visualizacionesDe,
} from "./domain/gps/porMicrociclo.js";
import { FILTROS_POR_TAREA, LETRAS, MAXIMO_DE_COMPARACIONES, entraEnPorTarea, filasPorMicrocicloDe, informePorTarea, pasaLosFiltrosDe } from "./domain/gps/porTarea.js";
import { FILTROS_POR_JUGADOR, informePorJugador, soloDeJugadores } from "./domain/gps/porJugador.js";
import ReporteIndividualGps from "./ReporteIndividualGps.jsx";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// GPS › Reportes (Santiago, 15/10): «Cuando se entra hay 3 opciones Por
// microciclo, Por tarea o Por jugador … Una ves elegido alguna de las 3
// opciones, entra a los filtros … y despues se le da a siguiente», con «LOS
// MISMOS BOTONES Y LOGICAS QUE TIENE EL ARCHIVO». Lo que decidió está en
// docs/PENDIENTES.md («Informe: Por microciclo, Por tarea y Por jugador»).
// Por jugador, todavía no.
//
// Por microciclo, en dos pasos:
//   1. Los filtros: un desplegable con casillas por filtro (15/10, D2); sin
//      nada elegido, todo; solo las opciones con datos con lo elegido en los
//      demás. Al entrar, «Microciclo/Jugador» en Sesión, como abre el
//      archivo; «Limpiar filtros» los vacía todos.
//   2. El informe (domain/gps/porMicrociclo.js): Tipo de variable,
//      Visualización y Categorización; el V.R. de los colores y «+ Otro
//      V.R.» para los microciclos de otro dispositivo o los que se elijan
//      (D1); un solo botón para ver las franjas de cada V.R. (15/10, «solo
//      deja un boton»); la tabla con la primera columna fija (D3). Arriba,
//      «Filtros» abre ahí mismo los del paso 1, sin salir del informe
//      (16/10); «‹ Informe» vuelve a «Ver informes».
//
// Por tarea (domain/gps/porTarea.js), en los mismos dos pasos (Santiago,
// 16/10, «Tarjetas que sumás»): en el paso 1, una tarjeta por comparación
// con sus filtros (Tipo de Sesión, Microciclo, Fecha, Nombre y Condición) y
// «+ Otra comparación», hasta 5; en el informe, los mismos controles (sin
// Objetivo) y una sola tabla: arriba el promedio de las comparaciones y, de
// cada una, su fila y una por microciclo. No se pinta (16/10).
//
// Por jugador (domain/gps/porJugador.js), igual que Por tarea, con los
// filtros de Por jugador (Nombre, Microciclo, Fecha, Tipo de Sesión,
// Condición y Clasificación Días) y pintado: con «Mi selección», unas solas
// franjas de todo lo que se ve; con «Valor referencial», las del V.R. de
// cada fila; las dos, arriba de la tabla. Con «Objetivo», cada microciclo
// con el suyo.

const FRANJAS = ["excelente", "muyBueno", "bueno", "regular", "malo", "desvio"];
const SIN_ELEGIR = [];
// Al entrar a los filtros: el promedio del equipo de cada microciclo.
const FILTROS_AL_ENTRAR = Object.freeze({ microciclo_jugador: ["sesion"] });
// «Categorización», en el orden del archivo.
const CATEGORIZACIONES_DEL_INFORME = ["miSeleccion", "valorReferencial", "objetivo"];
// Al entrar, una comparación como quedó guardado el archivo: en Por tarea,
// sin filtros (Tipo de Sesión, Fecha, Nombre y Condición en «(Todas)»); en
// Por jugador, Condición en Total (el jugador se elige).
const COMPARACIONES_NUEVAS = Object.freeze({ porTarea: Object.freeze({ filtros: Object.freeze({}) }), porJugador: Object.freeze({ filtros: Object.freeze({ condicion: Object.freeze(["total"]) }) }) });
const SIN_FILTROS = Object.freeze({ filtros: Object.freeze({}) });
const FILTROS_DE = { porMicrociclo: FILTROS_POR_MICROCICLO, porTarea: FILTROS_POR_TAREA, porJugador: FILTROS_POR_JUGADOR };

// Los grupos de columnas con su «?».
const TERMINOS_DE_GRUPOS = { ua: "gps.terminos.unidadArbitraria", cronica: "gps.terminos.cargaCronica" };

const nombreDeReferencia = (referencia) => [referencia.tipo, referencia.tabla, referencia.grupo].filter(Boolean).join(" · ");

// Unos números de microciclo, de corrido: «10 a 16, 18» (dos seguidos van
// sueltos: «15, 16»).
const tramos = (numeros, unir) => {
  const lista = [...new Set(numeros.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  const partes = [];
  lista.forEach((numero) => {
    const ultimo = partes[partes.length - 1];
    if (ultimo && numero === ultimo[1] + 1) ultimo[1] = numero;
    else partes.push([numero, numero]);
  });
  return partes.map(([desde, hasta]) => (desde === hasta ? String(desde) : hasta === desde + 1 ? `${desde}, ${hasta}` : unir(desde, hasta))).join(", ");
};

// Las columnas ocultadas a mano se recuerdan en el aparato (como las columnas
// fijas de las bases), cada informe las suyas. Las filas no se ocultan
// (Santiago, 16/10: «quiero que saques la opcion de ocultar filas»).
const CLAVES_COLUMNAS_OCULTAS = { porMicrociclo: "gps_informe_columnas_ocultas", porTarea: "gps_informe_tarea_columnas_ocultas", porJugador: "gps_informe_jugador_columnas_ocultas" };
const leerColumnasOcultas = (clave) => {
  try {
    const guardadas = JSON.parse(localStorage.getItem(clave) || "null");
    return Array.isArray(guardadas) ? guardadas.filter((una) => typeof una === "string") : [];
  } catch {
    return [];
  }
};
const guardarColumnasOcultas = (clave, columnas) => {
  try {
    localStorage.setItem(clave, JSON.stringify(columnas));
  } catch {
    // Sin localStorage, quedan ocultas mientras se está en el informe.
  }
};

// El microciclo de una fila del informe: el suyo (el promedio del equipo) o
// el último de los suyos (un jugador).
const microcicloDe = (fila) => (fila.microciclo ?? fila.microciclos[fila.microciclos.length - 1] ?? null);

// filasGps: todas las del club; referencias: los V.R.; elegidos: los V.R.
// elegidos en la Base (de cada dispositivo); nombreDe(fila) y
// nombreDelDispositivo(código): cómo se llaman; tituloDe(clave) y
// textoDe(clave, valor): el nombre y el formato de cada columna;
// textosDeListas: el texto de cada opción de cada lista; encabezado y
// arriba: los de las demás solapas.
export default function ReportesGps({ filasGps, referencias, elegidos, nombreDe, nombreDelDispositivo, tituloDe, textoDe, textosDeListas, encabezado, arriba = null, cargando = false }) {
  const { idioma, plural } = useIdioma();
  const [modo, setModo] = useState("menu");
  // El informe elegido en «Ver informes»: «porMicrociclo», «porTarea»,
  // «porJugador» o «reporteIndividual» (ese, en su propio componente).
  const [tipo, setTipo] = useState("porMicrociclo");
  const esReporte = tipo === "reporteIndividual";
  const [filtros, setFiltros] = useState(FILTROS_AL_ENTRAR);
  // Por tarea y Por jugador: las comparaciones de cada uno, con sus filtros.
  const [comparacionesDe, setComparacionesDe] = useState(() => ({ porTarea: [COMPARACIONES_NUEVAS.porTarea], porJugador: [COMPARACIONES_NUEVAS.porJugador] }));
  const porTarea = tipo === "porTarea";
  const porJugador = tipo === "porJugador";
  const conComparaciones = porTarea || porJugador;
  const comparaciones = comparacionesDe[tipo] || SIN_ELEGIR;
  const setComparaciones = (nuevas) => setComparacionesDe((antes) => ({ ...antes, [tipo]: nuevas }));
  const filtrosDelInforme = FILTROS_DE[tipo];
  const pasaLosDeEste = (fila, losFiltros) => pasaLosFiltrosDe(fila, losFiltros, filtrosDelInforme);
  const [hoja, setHoja] = useState(null);
  const [tipoVariable, setTipoVariable] = useState("absolutas");
  const [visualizacion, setVisualizacion] = useState("promedio");
  const [categorizacion, setCategorizacion] = useState("miSeleccion");
  // Los V.R. elegidos: [{ id, microciclos }]; el primero, el de los colores
  // (sin microciclos: los de su dispositivo). null: el de entrada.
  const [vrs, setVrs] = useState(null);
  const [verFranjas, setVerFranjas] = useState(0);
  // Los filtros, también dentro del informe (Santiago, 16/10: «haces una
  // flechita hacia arriba que diga filtros y eso revela los filtros pero no
  // te saca de la pantalla, despues podes volver a ocultarlo tocando la misma
  // flecha»): si están abiertos ahí.
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  // Las columnas que se ocultaron a mano (Santiago, 15/10: «poder ocultar
  // manualmente un columna … sin necesidad de entrar a ajustes»; «Cuando toco
  // un columna … tiene que preguntarme si la quiero ocultar»): solo dejan de
  // verse, los números no cambian. aOcultar: la columna tocada, mientras se
  // pregunta.
  const [todasLasOcultas, setTodasLasOcultas] = useState(() => Object.fromEntries(Object.entries(CLAVES_COLUMNAS_OCULTAS).map(([cual, clave]) => [cual, leerColumnasOcultas(clave)])));
  const columnasOcultas = todasLasOcultas[tipo];
  const setColumnasOcultas = (cambio) => setTodasLasOcultas((antes) => ({ ...antes, [tipo]: typeof cambio === "function" ? cambio(antes[tipo]) : cambio }));
  const [aOcultar, setAOcultar] = useState(null);
  useEffect(() => Object.entries(CLAVES_COLUMNAS_OCULTAS).forEach(([cual, clave]) => guardarColumnasOcultas(clave, todasLasOcultas[cual])), [todasLasOcultas]);
  // Las franjas de color, ocultas con su botón (Santiago, 16/10: «al lado de
  // ocultar columnas agregues un boton para que se oculten las franjas de
  // color y cuando lo vuelva a toca aparescan»). La fila del V.R. queda («sirve
  // para ver el vr sin necesidad de cambiar la manera de categorizar»).
  const [franjasOcultas, setFranjasOcultas] = useState(false);
  // El alto de la fila de los grupos (puede tener dos renglones): la de las
  // cabeceras queda pegada debajo al bajar por la tabla.
  const filaDeGrupos = useRef(null);
  useLayoutEffect(() => {
    const fila = filaDeGrupos.current;
    if (!fila) return undefined;
    const medir = () => fila.closest("table")?.style.setProperty("--alto-grupos", `${fila.getBoundingClientRect().height}px`);
    medir();
    if (typeof ResizeObserver !== "function") return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(fila);
    return () => observador.disconnect();
  });

  // ------------------------------------------------------- Los filtros --
  // Las opciones de cada filtro: las de las filas que entran con lo elegido
  // en los demás filtros (como las segmentaciones del archivo, que esconden
  // lo que no tiene datos). Lo elegido sigue a la vista aunque no tenga.
  // lista, pasa y entra: los filtros y las reglas de cada informe.
  const opcionesCon = (elegidosAhora, lista, pasa, entra) => {
    const porFiltro = Object.fromEntries(lista.map((filtro) => [filtro, new Set(elegidosAhora[filtro] || SIN_ELEGIR)]));
    filasGps.forEach((fila) => {
      if (!entra(fila)) return;
      const fallan = lista.filter((filtro) => !pasa(fila, { [filtro]: elegidosAhora[filtro] }));
      if (fallan.length > 1) return;
      (fallan.length ? fallan : lista).forEach((filtro) => porFiltro[filtro].add(valorDeFiltro(fila, filtro)));
    });
    return porFiltro;
  };
  const opciones = useMemo(
    () => (modo === "menu" || conComparaciones || esReporte ? {} : opcionesCon(filtros, FILTROS_POR_MICROCICLO, pasaLosFiltros, entraEnElInforme)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filasGps, filtros, modo, conComparaciones, esReporte],
  );
  // Por tarea: las de cada comparación, con sus filtros.
  const opcionesDeTarea = useMemo(
    () => (modo === "menu" || !conComparaciones ? [] : comparaciones.map((comparacion) => opcionesCon(comparacion.filtros, filtrosDelInforme, pasaLosDeEste, entraEnPorTarea))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filasGps, comparaciones, modo, tipo],
  );

  const textoDeOpcion = (filtro, valor) => {
    if (valor === "" || valor === null || valor === undefined) return "";
    if (filtro === "fecha") return fechaCorta(valor);
    if (filtro === "microciclo_jugador") return t(`gps.reportes.microcicloJugador.${valor}`);
    if (filtro === "nombre") {
      const [tipo, ...resto] = String(valor).split(":");
      const quien = resto.join(":");
      if (tipo === "promedio") return nombreDe({ promedio: quien });
      if (tipo === "jugador") return nombreDe({ jugador_id: Number(quien) }) || quien;
      return quien;
    }
    if (filtro === "microciclo") return String(valor);
    return textosDeListas[filtro]?.get(valor) || String(valor);
  };
  // En orden: los números de menor a mayor, las fechas por día, las listas
  // como en Ajustes y los nombres con el promedio del equipo primero.
  const valoresDe = (filtro, deLasOpciones = opciones) => {
    const valores = [...(deLasOpciones[filtro] || [])];
    if (filtro === "microciclo") valores.sort((a, b) => Number(a) - Number(b));
    else if (filtro === "fecha") valores.sort((a, b) => String(a).localeCompare(String(b)));
    else if (textosDeListas[filtro]) {
      const orden = [...textosDeListas[filtro].keys()];
      const lugar = (valor) => (orden.includes(valor) ? orden.indexOf(valor) : orden.length);
      valores.sort((a, b) => lugar(a) - lugar(b));
    } else {
      const primero = (valor) => (String(valor).startsWith("promedio:") ? 0 : 1);
      valores.sort((a, b) => primero(a) - primero(b) || textoDeOpcion(filtro, a).localeCompare(textoDeOpcion(filtro, b), idioma, { sensitivity: "base", numeric: true }));
    }
    return valores.map((valor) => ({ clave: valor, texto: textoDeOpcion(filtro, valor) }));
  };

  const tituloDeFiltro = (filtro) => {
    if (filtro === "microciclo_jugador") return t("gps.reportes.filtros.microcicloJugador");
    if (filtro === "nombre") return tituloDe("jugador");
    return tituloDe(filtro);
  };

  const cambiarVr = (indice, cambio) => setVrs((antes) => (antes || []).map((uno, i) => (i === indice ? { ...uno, ...cambio } : uno)));

  // La lista con casillas abierta: la de un filtro (en Por tarea, de una
  // comparación) o la de los microciclos de un V.R. ({ filtro, comparacion }
  // o { vr: índice }).
  const abrirFiltro = (filtro, comparacion) =>
    comparacion === undefined
      ? setHoja({ filtro, titulo: tituloDeFiltro(filtro), valores: valoresDe(filtro), elegidos: [...(filtros[filtro] || SIN_ELEGIR)], busqueda: "" })
      : setHoja({
          filtro,
          comparacion,
          titulo: `${t("gps.reportes.tarea.comparacion", { letra: LETRAS[comparacion] })} · ${tituloDeFiltro(filtro)}`,
          valores: valoresDe(filtro, opcionesDeTarea[comparacion] || {}),
          elegidos: [...(comparaciones[comparacion]?.filtros[filtro] || SIN_ELEGIR)],
          busqueda: "",
        });
  const aplicarHoja = () => {
    if (!hoja) return;
    const marcados = hoja.valores.map((valor) => valor.clave).filter((clave) => hoja.elegidos.includes(clave));
    if (hoja.vr !== undefined) cambiarVr(hoja.vr, { microciclos: marcados });
    // Las columnas que se ven: las que quedaron sin marcar se ocultan; las
    // ocultas que no están en la lista (las variables del otro Tipo de
    // variable) siguen ocultas.
    else if (hoja.ocultar)
      setColumnasOcultas((antes) => {
        const enLaLista = hoja.valores.map((valor) => valor.clave);
        return [...antes.filter((clave) => !enLaLista.includes(clave)), ...enLaLista.filter((clave) => !marcados.includes(clave))];
      });
    // En un filtro, todo marcado es lo mismo que nada: todos.
    else if (hoja.comparacion !== undefined)
      cambiarComparaciones(comparaciones.map((una, c) => (c === hoja.comparacion ? { filtros: { ...una.filtros, [hoja.filtro]: marcados.length === hoja.valores.length ? SIN_ELEGIR : marcados } } : una)));
    else cambiarFiltros({ ...filtros, [hoja.filtro]: marcados.length === hoja.valores.length ? SIN_ELEGIR : marcados });
    setHoja(null);
  };

  // Las filas del informe con estos filtros (sin V.R. todavía); en Por
  // tarea, las de microciclo de todas las comparaciones.
  const porComparacion = (lasComparaciones) => lasComparaciones.slice(0, MAXIMO_DE_COMPARACIONES).map((comparacion) => filasPorMicrocicloDe(filasGps, comparacion.filtros, filtrosDelInforme));
  const gruposDeTarea = (lasComparaciones) => porComparacion(lasComparaciones).flat();
  const deCadaComparacion = useMemo(
    () => (modo === "menu" || !conComparaciones ? [] : porComparacion(comparaciones)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modo, filasGps, tipo, comparaciones],
  );
  const grupos = useMemo(
    () => (modo === "menu" || esReporte ? [] : conComparaciones ? deCadaComparacion.flat() : filasPorMicrociclo(filasGps, filtros)),
    [modo, filasGps, filtros, conComparaciones, deCadaComparacion, esReporte],
  );
  // «Objetivo» solo pinta cuando todas las filas son jugadores (Santiago,
  // 16/10): si no, la opción no está y se ve con «Mi selección». En Por
  // jugador, cuando todas las comparaciones son de jugadores; Por tarea no se
  // pinta.
  const objetivoPosibleCon = (losGrupos, lasComparaciones) => (porJugador ? soloDeJugadores(lasComparaciones) : !porTarea && soloJugadores(losGrupos));
  const objetivoPosible = objetivoPosibleCon(grupos, comparaciones);
  const categorizacionVista = categorizacion === "objetivo" && !objetivoPosible ? "miSeleccion" : categorizacion;
  const sinObjetivoCon = (losGrupos, lasComparaciones = comparaciones) => {
    if (!objetivoPosibleCon(losGrupos, lasComparaciones)) setCategorizacion((antes) => (antes === "objetivo" ? "miSeleccion" : antes));
  };

  // ----------------------------------------------------------- Los V.R. --
  // El de entrada: el del dispositivo del último microciclo, el elegido en
  // la Base (o el primero de ese dispositivo).
  const vrsAlEntrar = (deLosGrupos) => {
    const ultimo = [...deLosGrupos].sort((a, b) => (microcicloDe(a) ?? -Infinity) - (microcicloDe(b) ?? -Infinity)).pop();
    const dispositivo = ultimo?.dispositivo || referencias[0]?.dispositivo || "";
    const suyas = referencias.filter((referencia) => referencia.dispositivo === dispositivo);
    const referencia = suyas.find((una) => una.id === elegidos?.vr?.[dispositivo]) || suyas[0] || referencias[0];
    return referencia ? [{ id: referencia.id, microciclos: SIN_ELEGIR }] : [];
  };
  const elegidosVr = (vrs || []).filter((uno) => referencias.some((referencia) => referencia.id === uno.id));
  const asignaciones = useMemo(
    () =>
      elegidosVr.map((uno) => ({
        referencia: referencias.find((referencia) => referencia.id === uno.id),
        microciclos: uno.microciclos.length ? uno.microciclos : null,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(elegidosVr), referencias],
  );

  const informe = useMemo(() => {
    if (modo !== "informe") return null;
    if (porTarea) return informePorTarea(filasGps, { comparaciones, tipoVariable, visualizacion, asignaciones });
    if (porJugador) return informePorJugador(filasGps, { comparaciones, tipoVariable, visualizacion, categorizacion: categorizacionVista, asignaciones });
    return informePorMicrociclo(filasGps, { filtros, tipoVariable, visualizacion, categorizacion: categorizacionVista, asignaciones, nombreDe });
  }, [modo, porTarea, porJugador, filasGps, filtros, comparaciones, tipoVariable, visualizacion, categorizacionVista, asignaciones, nombreDe]);

  // Los V.R. elegidos siguen si alguno vale para lo filtrado (su dispositivo
  // o sus microciclos); si no, van los de entrada. Dice si cambiaron.
  const revisarVrs = (deLosGrupos) => {
    const dispositivosFiltrados = new Set(deLosGrupos.map((grupo) => grupo.dispositivo));
    const sirve = (uno) => {
      const referencia = referencias.find((una) => una.id === uno.id);
      return Boolean(referencia) && (uno.microciclos.length > 0 || dispositivosFiltrados.has(referencia.dispositivo));
    };
    if (vrs && vrs.some(sirve)) return false;
    setVrs(vrsAlEntrar(deLosGrupos));
    return true;
  };
  // Al pasar al informe: los V.R. revisados, las franjas del primero, los
  // filtros cerrados y, si no son todos jugadores, sin Objetivo.
  const irAlInforme = () => {
    revisarVrs(grupos);
    sinObjetivoCon(grupos, comparaciones);
    setVerFranjas(0);
    setFiltrosAbiertos(false);
    setModo("informe");
  };
  // Cambiar los filtros. Dentro del informe, sin salir, los V.R. y Objetivo
  // se revisan como al pasar de los filtros al informe.
  const cambiarFiltros = (nuevos) => {
    setFiltros(nuevos);
    if (modo !== "informe") return;
    const nuevosGrupos = filasPorMicrociclo(filasGps, nuevos);
    if (revisarVrs(nuevosGrupos)) setVerFranjas(0);
    sinObjetivoCon(nuevosGrupos);
  };
  // Por tarea: cambiar las comparaciones (sus filtros, sumar o quitar una),
  // con los V.R. revisados igual.
  const cambiarComparaciones = (nuevas) => {
    setComparaciones(nuevas);
    if (modo !== "informe") return;
    if (revisarVrs(gruposDeTarea(nuevas))) setVerFranjas(0);
    sinObjetivoCon(null, nuevas);
  };
  const sumarComparacion = () => comparaciones.length < MAXIMO_DE_COMPARACIONES && cambiarComparaciones([...comparaciones, COMPARACIONES_NUEVAS[tipo]]);
  const quitarComparacion = (c) => cambiarComparaciones(comparaciones.filter((_, i) => i !== c));
  // «Limpiar filtros»: los de todas las comparaciones (como el botón del
  // archivo, que limpia todas las segmentaciones).
  const limpiarFiltros = () => (conComparaciones ? cambiarComparaciones(comparaciones.map(() => SIN_FILTROS)) : cambiarFiltros({}));
  const hayFiltrosDeTarea = comparaciones.some((comparacion) => filtrosDelInforme.some((filtro) => comparacion.filtros[filtro]?.length));

  // ----------------------------------------------------------- Formatos --
  const porciento = (valor) => (esNumero(valor) ? textoDeValor(valor, "0%", idioma) : "");
  const entero = (valor) => (esNumero(valor) ? textoDeValor(valor, "0", idioma) : "");
  const conDos = (valor) => (esNumero(valor) ? textoDeValor(valor, "0.00", idioma) : "");
  const enPorcentaje = visualizacion === "porcentajePromedio" || visualizacion === "porcentajeSuma";
  const textoDeVariable = (clave, valor) => (enPorcentaje ? porciento(valor) : textoDe(clave, valor));

  // ------------------------------------------------------------- Partes --
  const botonVolver = (texto, alTocar) => (
    <div className="reporte-acciones">
      <button type="button" className="boton-secundario reporte-volver" onClick={alTocar}>
        <Icono nombre="flecha" size={14} />
        {texto}
      </button>
    </div>
  );

  // Elegir varios: el desplegable dice cuáles van y abre la lista con
  // casillas (la del filtro de las bases), como en Cargar.
  const desplegableDeVarios = (rotulo, elegidosAhora, textoDe1, alAbrir, vacio) => (
    <button type="button" className="selector-hoja" aria-label={rotulo} onClick={alAbrir}>
      <b>{elegidosAhora.length ? elegidosAhora.map(textoDe1).join(", ") : vacio}</b>
      <Icono nombre="flecha" size={15} />
    </button>
  );

  const hojaDeVarios = (
    <HojaInferior
      abierta={Boolean(hoja)}
      className="tabla-datos-hoja-filtro"
      titulo={hoja ? hoja.titulo : ""}
      onCerrar={() => setHoja(null)}
      acciones={
        <>
          <button type="button" className="boton-cancelar-hoja" onClick={() => setHoja(null)}>
            {t("comun.cancelar")}
          </button>
          <button type="button" className="boton-confirmar-hoja" onClick={aplicarHoja}>
            {t("comun.listo")}
          </button>
        </>
      }
    >
      {hoja && (
        <div className="tabla-datos-filtro-cuerpo">
          <ListaParaMarcar
            valores={hoja.valores}
            elegidos={hoja.elegidos}
            onCambiar={(elegidosNuevos) => setHoja((antes) => ({ ...antes, elegidos: elegidosNuevos }))}
            busqueda={hoja.busqueda}
            onBuscar={(busqueda) => setHoja((antes) => ({ ...antes, busqueda }))}
          />
        </div>
      )}
    </HojaInferior>
  );

  // Los filtros, cada uno con su desplegable: en el paso 1 y, con «Filtros»,
  // dentro del informe. En Por tarea, una tarjeta por comparación con los
  // suyos, «Quitar» (si hay más de una) y «+ Otra comparación», hasta 5.
  const hayFiltros = conComparaciones ? hayFiltrosDeTarea : FILTROS_POR_MICROCICLO.some((filtro) => filtros[filtro]?.length);
  const nombreDeComparacion = (c) => t("gps.reportes.tarea.comparacion", { letra: LETRAS[c] });
  const grillaDeFiltros = () =>
    !conComparaciones ? (
      <div className="gps-reportes-grilla">
        {FILTROS_POR_MICROCICLO.map((filtro) => (
          <div className="campo-inicio" key={filtro}>
            <span className="gps-reportes-rotulo">{tituloDeFiltro(filtro)}</span>
            {desplegableDeVarios(tituloDeFiltro(filtro), filtros[filtro] || SIN_ELEGIR, (valor) => textoDeOpcion(filtro, valor) || t("tabla.vacias"), () => abrirFiltro(filtro), t("gps.reportes.todos"))}
          </div>
        ))}
      </div>
    ) : (
      <div className="gps-tarea-comparaciones">
        {comparaciones.slice(0, MAXIMO_DE_COMPARACIONES).map((comparacion, c) => (
          <div className="gps-tarea-comparacion" key={c}>
            <div className="gps-tarea-comparacion-cabeza">
              <span className="gps-tarea-letra" aria-hidden="true">
                {LETRAS[c]}
              </span>
              <span className="gps-tarea-comparacion-titulo">
                <b>{nombreDeComparacion(c)}</b>
                <span>{plural("gps.reportes.tarea.microciclos", deCadaComparacion[c]?.length || 0)}</span>
              </span>
              {comparaciones.length > 1 && (
                <button type="button" className="boton-secundario gps-reportes-quitar" onClick={() => quitarComparacion(c)} aria-label={t("gps.reportes.tarea.quitar", { letra: LETRAS[c] })}>
                  <Icono nombre="borrar" size={15} />
                </button>
              )}
            </div>
            <div className="gps-reportes-grilla">
              {filtrosDelInforme.map((filtro) => (
                <div className="campo-inicio" key={filtro}>
                  <span className="gps-reportes-rotulo">{tituloDeFiltro(filtro)}</span>
                  {desplegableDeVarios(
                    `${nombreDeComparacion(c)} · ${tituloDeFiltro(filtro)}`,
                    comparacion.filtros[filtro] || SIN_ELEGIR,
                    (valor) => textoDeOpcion(filtro, valor) || t("tabla.vacias"),
                    () => abrirFiltro(filtro, c),
                    t("gps.reportes.todos"),
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <button type="button" className="boton-secundario gps-tarea-sumar" onClick={sumarComparacion} disabled={comparaciones.length >= MAXIMO_DE_COMPARACIONES}>
          {comparaciones.length >= MAXIMO_DE_COMPARACIONES ? t("gps.reportes.tarea.hastaCinco") : t("gps.reportes.tarea.sumar")}
        </button>
      </div>
    );
  // Cuántas filas va a tener el informe.
  const cuantasVan = () => (conComparaciones ? plural("gps.reportes.tarea.cuantas", grupos.length) : plural("gps.reportes.cuantas", grupos.length));

  // --------------------------------------------------------------- Menú --
  if (modo === "menu") {
    const opcion = (cual, icono, hecho) => (
      <button
        type="button"
        key={cual}
        className="opcion-ajuste reporte-opcion"
        onClick={() => {
          if (!hecho) return;
          setTipo(cual);
          setModo("filtros");
        }}
        disabled={!hecho}
      >
        <span className="icono-ajuste">
          <Icono nombre={icono} size={18} />
        </span>
        <span className="texto-ajuste">
          <b>{t(`gps.reportes.${cual}`)}</b>
          <span>{hecho ? t(`gps.reportes.${cual}Texto`) : t("gps.reportes.todaviaNo")}</span>
        </span>
        {hecho && <span className="flecha-ajuste">›</span>}
      </button>
    );
    return (
      <div className="app">
        <div className="contenedor contenedor-base">
          {encabezado(t("gps.reportes.titulo"), t("gps.reportes.texto"))}
          {arriba}
          <section className="tarjeta tarjeta-ficha gps-reportes-menu">
            <div className="cabeza-ficha">
              <b>{t("gps.reportes.ver")}</b>
            </div>
            <div className="lista-opciones">
              {opcion("porMicrociclo", "calendario", true)}
              {opcion("porTarea", "registros", true)}
              {opcion("porJugador", "usuario", true)}
              {opcion("reporteIndividual", "documento", true)}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ------------------------------------------------- Reporte individual --
  // Va aparte, con sus dos pasos (Santiago, 16/10: «Dentro de Informe»).
  if (tipo === "reporteIndividual") {
    return (
      <ReporteIndividualGps
        filasGps={filasGps}
        nombreDe={nombreDe}
        tituloDe={tituloDe}
        textoDe={textoDe}
        textosDeListas={textosDeListas}
        encabezado={encabezado}
        arriba={arriba}
        cargando={cargando}
        volver={botonVolver(t("gps.reportes.titulo"), () => setModo("menu"))}
      />
    );
  }

  // ------------------------------------------------------------ Filtros --
  if (modo === "filtros") {
    return (
      <div className="app">
        <div className="contenedor contenedor-base">
          {botonVolver(t("gps.reportes.titulo"), () => setModo("menu"))}
          {encabezado(t(`gps.reportes.${tipo}`), t(porJugador ? "gps.reportes.jugador.filtrosTexto" : porTarea ? "gps.reportes.tarea.filtrosTexto" : "gps.reportes.filtrosTexto"))}
          {arriba}
          <section className="tarjeta gps-reportes-filtros">
            <div className="gps-reportes-filtros-cabeza">
              <b>{t(conComparaciones ? "gps.reportes.tarea.comparaciones" : "gps.reportes.filtrosTitulo")}</b>
              <button type="button" className="boton-secundario" onClick={limpiarFiltros} disabled={!hayFiltros}>
                {t("gps.reportes.limpiar")}
              </button>
            </div>
            {grillaDeFiltros()}
            <div className="gps-reportes-siguiente">
              <p className="lesiones-ayuda" role="status">
                {cargando && !filasGps.length ? t("gps.estado.cargando") : grupos.length ? cuantasVan() : t("gps.reportes.sinFilas")}
              </p>
              <button type="button" className="boton-principal" onClick={irAlInforme} disabled={!grupos.length}>
                {t("gps.reportes.siguiente")}
              </button>
            </div>
          </section>
        </div>
        {hojaDeVarios}
      </div>
    );
  }

  // ------------------------------------------------------------ Informe --
  // deTodo: con «Mi selección» y «Objetivo», las franjas de todo lo que se
  // ve, para todas las filas (Santiago, 16/10); con «Valor referencial», null
  // (cada fila, las de su V.R.). filas: las de microciclo (o de jugador); en
  // Por tarea, las de todas las comparaciones.
  const { ua, tablas } = informe;
  const filas = conComparaciones ? informe.comparaciones.flatMap((bloque) => bloque.filas) : informe.filas;
  const deTodo = conComparaciones ? null : informe.general;
  const actual = tablas.length ? Math.min(verFranjas, tablas.length - 1) : -1;
  const tabla = actual >= 0 ? tablas[actual] : null;
  const variables = TIPOS_DE_VARIABLE[tipoVariable];
  const unirTramo = (desde, hasta) => t("gps.reportes.tramo", { desde, hasta });
  const nombreDeVr = (referencia) => (referencia ? `${nombreDelDispositivo(referencia.dispositivo)} · ${nombreDeReferencia(referencia)}` : "");

  // Lo elegido en los filtros, en una línea (en Por tarea, en una por
  // comparación).
  const resumenDe = (losFiltros, lista) =>
    lista
      .filter((filtro) => losFiltros[filtro]?.length)
      .map((filtro) => {
        const elegidosAhora = losFiltros[filtro];
        const texto = filtro === "microciclo" ? tramos(elegidosAhora, unirTramo) : elegidosAhora.map((valor) => textoDeOpcion(filtro, valor) || t("tabla.vacias")).join(", ");
        return `${tituloDeFiltro(filtro)}: ${texto}`;
      })
      .join(" · ");
  const resumenDeFiltros = conComparaciones
    ? comparaciones
        .slice(0, MAXIMO_DE_COMPARACIONES)
        .map((comparacion, c) => `${LETRAS[c]}: ${resumenDe(comparacion.filtros, filtrosDelInforme) || t("gps.reportes.tarea.sinFiltros")}`)
        .join("\n")
    : resumenDe(filtros, FILTROS_POR_MICROCICLO);

  // Los microciclos del informe (para el «+ Otro V.R.») y los que quedaron
  // sin V.R.
  const microciclosDelInforme = [...new Set(filas.flatMap((fila) => (fila.promedio ? [fila.microciclo] : fila.microciclos)).filter((m) => m !== null && m !== undefined))].sort((a, b) => a - b);
  const sinVr = filas.filter((fila) => !fila.vr).flatMap((fila) => (fila.promedio ? [fila.microciclo] : fila.microciclos));

  const quitarVr = (indice) => {
    setVrs((antes) => (antes || []).filter((_, i) => i !== indice));
    setVerFranjas(0);
  };
  const sumarVr = () => {
    // De entrada, uno del dispositivo de lo que quedó sin V.R. (o el primero que no se usa).
    const sinVrDispositivo = filas.find((fila) => !fila.vr && fila.dispositivo)?.dispositivo;
    const libre =
      referencias.find((referencia) => referencia.dispositivo === sinVrDispositivo && !elegidosVr.some((uno) => uno.id === referencia.id)) ||
      referencias.find((referencia) => !elegidosVr.some((uno) => uno.id === referencia.id)) ||
      referencias[0];
    if (libre) setVrs((antes) => [...(antes || []), { id: libre.id, microciclos: SIN_ELEGIR }]);
  };
  // Con V.R. de más de un dispositivo, cada uno dice de cuál es (también con
  // la lista cerrada).
  const dispositivos = [...new Set(referencias.map((referencia) => referencia.dispositivo))];
  const textoDeVr = (referencia) => (dispositivos.length > 1 ? nombreDeVr(referencia) : nombreDeReferencia(referencia));
  const selectorDeVr = (uno, indice) => (
    <select value={uno.id} onChange={(evento) => cambiarVr(indice, { id: evento.target.value })} aria-label={indice ? t("gps.reportes.otroVr") : t("gps.reportes.vr")}>
      {dispositivos.map((dispositivo) => (
        <optgroup key={dispositivo} label={nombreDelDispositivo(dispositivo)}>
          {referencias
            .filter((referencia) => referencia.dispositivo === dispositivo)
            .map((referencia) => (
              <option key={referencia.id} value={referencia.id}>
                {textoDeVr(referencia)}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
  // «+ Otro V.R.»: al lado del primer V.R. (o solo, si no hay ninguno elegido).
  const botonSumarVr =
    referencias.length > 0 ? (
      <button type="button" className="boton-secundario gps-reportes-sumar" onClick={sumarVr}>
        {t("gps.reportes.sumarVr")}
      </button>
    ) : null;

  // Las columnas de la tabla, con su grupo (y su tono, como en la base). La
  // U.A. y la carga crónica se pintan como el archivo; los índices y las
  // variables, con la regla que el archivo usa para esas columnas en «Por
  // jugador» (en «Por microciclo» no las pinta).
  const tablaDe = (fila) => tablas.find((una) => una.asignacion === fila.asignacion) || null;
  const COLUMNA_SESIONES = { clave: "sesiones", titulo: t("gps.reportes.columnas.sesiones"), valor: (fila) => fila.sesiones ?? null, texto: entero };
  const COLUMNAS_UA = [
    { clave: "uaSuma", grupo: "ua", titulo: t("gps.reportes.columnas.suma"), valor: (fila) => fila.sumas.ua, texto: entero, franjas: ua?.suma, color: colorDeUa },
    { clave: "uaPromedio", grupo: "ua", titulo: t("gps.reportes.columnas.promedio"), valor: (fila) => fila.promedios.ua, texto: entero, franjas: ua?.promedio, color: colorDeUa },
  ];
  const COLUMNAS_MEDIDAS = [
    ...[
      ["volumen", "indices", t("gps.reportes.columnas.volumen")],
      ["relativo", "indices", t("gps.reportes.columnas.relativo")],
      ["total", "total", tituloDe("d")],
      ["totalRel", "total", tituloDe("d_min")],
      ["alta", "alta", t("gps.reportes.columnas.abs")],
      ["altaRel", "alta", t("gps.reportes.columnas.rel")],
      ["maxima", "maxima", t("gps.reportes.columnas.abs")],
      ["maximaRel", "maxima", t("gps.reportes.columnas.rel")],
    ].map(([clave, grupo, titulo]) => ({ clave, grupo, titulo, valor: (fila) => fila.indices[clave], texto: porciento, franjas: (tabla || deTodo)?.indices?.[clave], franjasDeFila: (fila) => (tablaDe(fila) || deTodo)?.indices?.[clave], color: colorDeMayorMejor })),
    ...variables.map((clave) => ({
      clave: `variable:${clave}`,
      grupo: "variables",
      titulo: tituloDe(clave),
      valor: (fila) => fila.variables[clave],
      texto: (valor) => textoDeVariable(clave, valor),
      franjas: (tabla || deTodo)?.variables?.[clave],
      franjasDeFila: (fila) => (tablaDe(fila) || deTodo)?.variables?.[clave],
      color: colorDeVariable,
      vr: (referencia) => textoDe(clave, referencia?.promedio?.[clave]),
    })),
  ];
  // Por microciclo: N° Sesiones y Descanso, U.A., carga crónica, los índices,
  // las variables y VS RIVAL. Por tarea, como el archivo: N° Micr. y N° Ses.
  // (en la fila de cada comparación; en la de cada microciclo, sus sesiones),
  // U.A., los índices y las variables.
  // Por tarea no se pinta (Santiago, 16/10: «por tarea no se pinta con
  // nada»): sus columnas van sin color.
  const sinColor = (columna) => ({ ...columna, color: null, franjas: null, franjasDeFila: null });
  const COLUMNAS_DE_MICROCICLO = [
    COLUMNA_SESIONES,
    { clave: "descansos", titulo: t("gps.reportes.columnas.descansos"), valor: (fila) => fila.descansos, texto: entero },
    ...COLUMNAS_UA,
    { clave: "ccSuma", grupo: "cronica", titulo: t("gps.reportes.columnas.suma"), valor: (fila) => fila.cargaCronica.suma, texto: conDos, franjas: ua?.cronicaSuma, color: colorDeCargaCronica },
    { clave: "ccPromedio", grupo: "cronica", titulo: t("gps.reportes.columnas.promedio"), valor: (fila) => fila.cargaCronica.promedio, texto: conDos, franjas: ua?.cronicaPromedio, color: colorDeCargaCronica },
    ...COLUMNAS_MEDIDAS,
  ];
  // Por jugador: las franjas de cada celda según la categorización (con «Mi
  // selección», las de todo; con «Valor referencial», las de su V.R.; con
  // «Objetivo», las de su microciclo).
  const DONDE_ESTAN = { uaSuma: ["ua", "suma"], uaPromedio: ["ua", "promedio"], ccSuma: ["ua", "cronicaSuma"], ccPromedio: ["ua", "cronicaPromedio"] };
  const dondeEsta = (clave) => DONDE_ESTAN[clave] || (clave.startsWith("variable:") ? ["variables", clave.slice(9)] : ["indices", clave]);
  const conFranjasDeJugador = (columna) => {
    if (!columna.color) return columna;
    const [grupo, clave] = dondeEsta(columna.clave);
    const deTodas = informe.general?.[grupo]?.[clave] ?? null;
    return {
      ...columna,
      franjas: categorizacionVista === "valorReferencial" ? (tabla?.[grupo]?.[clave] ?? null) : deTodas,
      franjasDeFila: (fila) => {
        if (categorizacionVista === "objetivo") return fila.franjas?.[grupo]?.[clave] ?? null;
        if (categorizacionVista === "valorReferencial") return tablaDe(fila)?.[grupo]?.[clave] ?? null;
        return deTodas;
      },
    };
  };
  // Por tarea, como el archivo: N° Micr. y N° Ses., sin colores. Por
  // jugador, como Por microciclo sin VS RIVAL (el archivo no lo tiene ahí).
  const COLUMNAS = porTarea
    ? [{ clave: "microciclos", titulo: t("gps.reportes.columnas.microciclos"), valor: (fila) => fila.cantidad ?? null, texto: entero }, COLUMNA_SESIONES, ...COLUMNAS_UA, ...COLUMNAS_MEDIDAS].map(sinColor)
    : porJugador
      ? COLUMNAS_DE_MICROCICLO.map(conFranjasDeJugador)
      : [...COLUMNAS_DE_MICROCICLO, { clave: "vsRival", titulo: t("gps.reportes.columnas.vsRival"), valor: (fila) => fila.vsRival, texto: (valor) => valor || "", rival: true }];
  const TITULOS_DE_GRUPOS = {
    ua: t("gps.reportes.columnas.ua"),
    cronica: t("gps.reportes.columnas.cronica"),
    indices: t("gps.reportes.columnas.indices"),
    total: t("gps.reportes.columnas.total"),
    alta: t("gps.reportes.columnas.alta"),
    maxima: t("gps.reportes.columnas.maxima"),
    variables: t(`gps.reportes.tipos.${tipoVariable}`),
  };
  const tonos = Object.fromEntries(Object.keys(TITULOS_DE_GRUPOS).map((clave, i) => [clave, i]));
  const tituloCompleto = (columna) => (columna.grupo ? `${TITULOS_DE_GRUPOS[columna.grupo]} · ${columna.titulo}` : columna.titulo);

  // Lo que se ve: sin lo ocultado a mano.
  const columnas = COLUMNAS.filter((columna) => !columnasOcultas.includes(columna.clave));
  const gruposDeColumnas = [];
  columnas.forEach((columna) => {
    const ultimo = gruposDeColumnas[gruposDeColumnas.length - 1];
    if (columna.grupo && ultimo?.clave === columna.grupo) ultimo.cantidad += 1;
    else gruposDeColumnas.push({ clave: columna.grupo || null, columna, cantidad: 1 });
  });

  // La primera columna dice qué es cada fila: solo microciclos del equipo,
  // solo jugadores o las dos cosas.
  const soloEquipo = !conComparaciones && filas.every((fila) => fila.promedio);
  const todasDeJugadores = !conComparaciones && soloJugadores(filas);
  const tituloDeLaPrimera = conComparaciones
    ? t("gps.reportes.columnas.comparacion")
    : soloEquipo
      ? t("gps.reportes.columnas.microciclo")
      : todasDeJugadores
        ? t("gps.reportes.columnas.jugador")
        : t("gps.reportes.columnas.nombre");
  // Por tarea: la fila de una comparación dice su letra y su Tipo de Sesión
  // («Nombre Tarea» en el archivo); la de arriba, «Promedio»; las de cada
  // microciclo, su número. Por jugador: su letra y el jugador elegido
  // («Nombre Jugador»).
  const etiquetaDeBloque = (bloque) => {
    const filtro = porJugador ? "nombre" : "tipo_sesion";
    const elegidosAhora = bloque.filtros[filtro] || SIN_ELEGIR;
    if (!elegidosAhora.length) return t(porJugador ? "gps.reportes.jugador.todos" : "gps.reportes.tarea.todasLasTareas");
    return elegidosAhora.map((valor) => textoDeOpcion(filtro, valor) || t("tabla.vacias")).join(", ");
  };
  const textoDeFilaDeTarea = (fila) => {
    if (fila.tipoDeFila === "general") return t("gps.reportes.tarea.promedioDeTodas");
    if (fila.tipoDeFila === "comparacion") return `${nombreDeComparacion(fila.c)} · ${etiquetaDeBloque(fila.bloque)}\n${resumenDe(fila.bloque.filtros, filtrosDelInforme) || t("gps.reportes.tarea.sinFiltros")}`;
    return t("gps.reportes.microcicloN", { n: fila.microciclo ?? "" });
  };
  const nombreDeFilaDeTarea = (fila) => {
    if (fila.tipoDeFila === "general")
      return (
        <span className="gps-informe-nombre">
          <b>{t("gps.reportes.tarea.promedio")}</b>
        </span>
      );
    if (fila.tipoDeFila === "comparacion")
      return (
        <span className="gps-informe-nombre gps-tarea-nombre">
          <span className="gps-tarea-letra" aria-hidden="true">
            {LETRAS[fila.c]}
          </span>
          <b>{etiquetaDeBloque(fila.bloque)}</b>
        </span>
      );
    return (
      <span className="gps-informe-nombre">
        <b>{fila.microciclo ?? "–"}</b>
      </span>
    );
  };
  const textoDeFila = (fila) =>
    conComparaciones ? textoDeFilaDeTarea(fila) : fila.promedio ? (soloEquipo ? t("gps.reportes.microcicloN", { n: fila.microciclo ?? "" }) : `${nombreDe(fila)} ${fila.microciclo ?? ""}`) : nombreDe(fila);
  const nombreDeFila = (fila) =>
    conComparaciones ? (
      nombreDeFilaDeTarea(fila)
    ) : fila.promedio ? (
      <span className="gps-informe-nombre">
        {!soloEquipo && <span>{nombreDe(fila)}</span>}
        <b>{fila.microciclo}</b>
      </span>
    ) : (
      <span className="gps-informe-nombre">
        <b>{nombreDe(fila)}</b>
        {fila.microciclos.length > 0 && <span>{tramos(fila.microciclos, unirTramo)}</span>}
      </span>
    );

  // Las filas de la tabla. Por tarea: arriba el promedio de las comparaciones
  // (con más de una) y, de cada una, su fila y la de cada microciclo (una
  // comparación sin microciclos lo dice en su fila). Por jugador, igual sin
  // el promedio de arriba (el archivo no lo tiene).
  const conResumen = porTarea ? informe.comparaciones.filter((bloque) => bloque.resumen).length : 0;
  const filasDeLaTabla = conComparaciones
    ? [
        ...(conResumen > 1 && informe.general ? [{ ...informe.general, tipoDeFila: "general" }] : []),
        ...informe.comparaciones.flatMap((bloque, c) => [
          { ...(bloque.resumen || { clave: `${bloque.letra}:resumen`, vacia: true }), tipoDeFila: "comparacion", bloque, c },
          ...bloque.filas.map((fila) => ({ ...fila, tipoDeFila: "microciclo" })),
        ]),
      ]
    : filas;
  const claseDeFila = (fila) => (fila.tipoDeFila === "general" ? "gps-tarea-general" : fila.tipoDeFila === "comparacion" ? "gps-tarea-resumen" : undefined);

  // Las filas de arriba: el V.R. y las franjas (las franjas se ocultan con su
  // botón; el V.R. queda). Con «Mi selección» u «Objetivo» y más de un V.R.,
  // una fila por V.R. con el nombre de su dispositivo: cada fila del informe
  // tiene el suyo y así cada % tiene su referencia a la vista (16/10,
  // «Preferencia visual» del sistema de diseño: no se ocultan datos útiles).
  const variosVr = (porTarea || categorizacionVista !== "valorReferencial") && tablas.filter((una) => una.vr).length > 1;
  const conVr = tablas.filter((una) => una.vr);
  const repetido = (una) => conVr.filter((otra) => otra.vr.dispositivo === una.vr.dispositivo).length > 1;
  const filasDelVr = !tabla?.vr
    ? []
    : variosVr
      ? conVr.map((una) => ({
          clave: `franja:vr:${una.asignacion}`,
          franja: "vr",
          vr: una.vr,
          texto: t("gps.reportes.franjas.vrDe", { vr: repetido(una) ? nombreDeVr(una.vr) : nombreDelDispositivo(una.vr.dispositivo) }),
        }))
      : [{ clave: "franja:vr", franja: "vr", vr: tabla.vr, texto: t("gps.reportes.franjas.vr") }];
  // Por jugador con «Objetivo», cada microciclo tiene las suyas y no hay unas
  // para mostrar (ni el botón «Franjas»).
  const conBotonDeFranjas = !porTarea && !(porJugador && categorizacionVista === "objetivo");
  const filasDeFranjas = franjasOcultas || !conBotonDeFranjas ? [] : FRANJAS.map((franja) => ({ clave: `franja:${franja}`, franja, texto: t(`gps.reportes.franjas.${franja}`) }));
  const franjasAVista = [...filasDelVr, ...filasDeFranjas];
  const cuantasOcultas = columnasOcultas.filter((clave) => COLUMNAS.some((columna) => columna.clave === clave)).length;

  const abrirColumnas = () => {
    const valores = COLUMNAS.map((columna) => ({ clave: columna.clave, texto: tituloCompleto(columna) }));
    setHoja({ ocultar: "columnas", titulo: t("gps.reportes.aLaVista.columnas"), valores, elegidos: valores.map((valor) => valor.clave).filter((clave) => !columnasOcultas.includes(clave)), busqueda: "" });
  };
  const ocultar = ({ clave }) => setColumnasOcultas((antes) => [...antes.filter((una) => una !== clave), clave]);

  const vacio = <span className="gps-informe-vacio">–</span>;
  const celda = (columna, fila) => {
    const valor = columna.valor(fila);
    const texto = columna.texto(valor);
    const color = columna.color ? columna.color(valor, columna.franjasDeFila ? columna.franjasDeFila(fila) : columna.franjas) : null;
    return (
      <td key={columna.clave} className={`${columna.rival ? "gps-informe-rival" : ""} ${color ? "pintada" : ""}`} style={color ? { background: color } : undefined} title={columna.rival && texto ? texto : undefined}>
        {texto === "" ? vacio : texto}
      </td>
    );
  };
  // En las franjas, cada número pintado con el color que toma lo que cae ahí
  // (Santiago, 15/10, con una imagen: la celda entera, no un punto al lado).
  const celdaDeFranja = (columna, { franja, vr }) => {
    if (franja === "vr") return <td key={columna.clave}>{columna.vr ? columna.vr(vr) || vacio : ""}</td>;
    const valor = columna.franjas ? columna.franjas[franja] : null;
    if (!columna.franjas) return <td key={columna.clave} />;
    const color = franja !== "desvio" && columna.color ? columna.color(valor, columna.franjas) : null;
    const texto = columna.texto(valor);
    return (
      <td key={columna.clave} className={color ? "pintada" : undefined} style={color ? { background: color } : undefined}>
        {texto === "" ? vacio : texto}
      </td>
    );
  };

  const filaDeFranja = (una) => (
    <tr key={una.clave} className={`franja-${una.franja}`}>
      <th scope="row" className="gps-informe-id">
        {una.texto}
      </th>
      {columnas.map((columna) => celdaDeFranja(columna, una))}
    </tr>
  );
  const filaDeLaTabla = (fila) => (
    <tr key={fila.clave} className={claseDeFila(fila)}>
      <th scope="row" className="gps-informe-id" title={textoDeFila(fila)}>
        {nombreDeFila(fila)}
      </th>
      {fila.vacia ? (
        <td colSpan={columnas.length} className="gps-tarea-sin-filas">
          {t("gps.reportes.tarea.sinMicrociclos")}
        </td>
      ) : (
        columnas.map((columna) => celda(columna, fila))
      )}
    </tr>
  );

  return (
    <div className="app">
      <div className="contenedor contenedor-base">
        {botonVolver(t("gps.reportes.titulo"), () => setModo("menu"))}
        {encabezado(t(`gps.reportes.${tipo}`), t(porTarea ? "gps.reportes.tarea.informeTexto" : porJugador ? "gps.reportes.jugador.informeTexto" : "gps.reportes.informeTexto"))}
        {arriba}
        {/* «Filtros»: dice qué se filtró y, tocándolo, abre acá abajo los
            mismos filtros del paso 1, sin salir del informe; tocándolo
            otra vez, se cierran. */}
        <section className={`tarjeta gps-reportes-filtros gps-informe-filtros ${filtrosAbiertos ? "abiertos" : ""}`.trim()}>
          <button type="button" className="gps-informe-filtros-boton" onClick={() => setFiltrosAbiertos((antes) => !antes)} aria-expanded={filtrosAbiertos}>
            <span className="gps-informe-filtros-flecha">
              <Icono nombre="flecha" size={16} />
            </span>
            <span className="gps-informe-filtros-texto">
              <b>{t("gps.reportes.filtrosTitulo")}</b>
              <span className="gps-informe-filtros-resumen">{resumenDeFiltros || t("gps.reportes.sinFiltros")}</span>
            </span>
          </button>
          {filtrosAbiertos && (
            <div className="gps-informe-filtros-cuerpo">
              {grillaDeFiltros()}
              <div className="gps-reportes-siguiente">
                <p className="lesiones-ayuda" role="status">
                  {grupos.length ? cuantasVan() : t("gps.reportes.sinFilas")}
                </p>
                <button type="button" className="boton-secundario" onClick={limpiarFiltros} disabled={!hayFiltros}>
                  {t("gps.reportes.limpiar")}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="tarjeta gps-reportes-controles">
          <div className="gps-reportes-grilla">
            <label className="campo-inicio">
              <span className="gps-reportes-rotulo">{t("gps.reportes.tipoVariable")}</span>
              <span className="gps-reportes-campo">
                <Icono nombre="grafico" size={18} />
                <select
                  value={tipoVariable}
                  onChange={(evento) => {
                    const nuevo = evento.target.value;
                    setTipoVariable(nuevo);
                    setVisualizacion((antes) => visualizacionPara(nuevo, antes));
                  }}
                >
                  {Object.keys(TIPOS_DE_VARIABLE).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {t(`gps.reportes.tipos.${tipo}`)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="campo-inicio">
              <span className="gps-reportes-rotulo">{t("gps.reportes.visualizacion")}</span>
              <span className="gps-reportes-campo">
                <Icono nombre="tendencia" size={18} />
                <select value={visualizacion} onChange={(evento) => setVisualizacion(evento.target.value)}>
                  {visualizacionesDe(tipoVariable).map((una) => (
                    <option key={una} value={una}>
                      {t(`gps.reportes.visualizaciones.${una}`)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            {/* Por tarea no se pinta: sin Categorización. */}
            {!porTarea && (
              <label className="campo-inicio">
                <span className="gps-reportes-rotulo">
                  {t("gps.reportes.categorizacion")}
                  <TerminoDe clave="gps.terminos.categorizacion" />
                </span>
                <span className="gps-reportes-campo">
                  <Icono nombre="cuadros" size={18} />
                  <select value={categorizacionVista} onChange={(evento) => setCategorizacion(evento.target.value)}>
                    {CATEGORIZACIONES_DEL_INFORME.filter((una) => una !== "objetivo" || objetivoPosible).map((una) => (
                      <option key={una} value={una}>
                        {t(`gps.reportes.categorizaciones.${una}`)}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            )}
          </div>

          <div className="gps-reportes-vrs">
            <span className="gps-reportes-rotulo">
              {t("gps.reportes.vr")}
              <TerminoDe clave="gps.terminos.vrInforme" />
            </span>
            {elegidosVr.length === 0 && <p className="lesiones-ayuda">{t(referencias.length ? "gps.reportes.sinVrElegido" : "gps.reportes.sinVrs")}</p>}
            {elegidosVr.map((uno, indice) => (
              <div className={`gps-reportes-vr ${indice ? "otro" : ""}`} key={`${indice}:${uno.id}`}>
                <span className="gps-reportes-campo">
                  <Icono nombre="objetivo" size={18} />
                  {selectorDeVr(uno, indice)}
                </span>
                {indice > 0 &&
                  desplegableDeVarios(
                    t("gps.reportes.microciclosDelVr"),
                    uno.microciclos,
                    (valor) => String(valor),
                    () =>
                      setHoja({
                        vr: indice,
                        titulo: t("gps.reportes.microciclosDelVr"),
                        valores: microciclosDelInforme.map((m) => ({ clave: m, texto: String(m) })),
                        elegidos: [...uno.microciclos],
                        busqueda: "",
                      }),
                    t("gps.reportes.todosLosDe", { dispositivo: nombreDelDispositivo(referencias.find((referencia) => referencia.id === uno.id)?.dispositivo) }),
                  )}
                {indice > 0 && (
                  <button type="button" className="boton-secundario gps-reportes-quitar" onClick={() => quitarVr(indice)} aria-label={t("gps.reportes.quitarVr")}>
                    <Icono nombre="borrar" size={15} />
                  </button>
                )}
                {indice === 0 && botonSumarVr}
              </div>
            ))}
            {sinVr.length > 0 && elegidosVr.length > 0 && <p className="lesiones-ayuda gps-reportes-sin-vr">{t("gps.reportes.sinVrFilas", { microciclos: tramos(sinVr, unirTramo) })}</p>}
            {elegidosVr.length === 0 && botonSumarVr}
          </div>
        </section>

        {filas.length === 0 ? (
          <p className="lesiones-estado">{t("gps.reportes.sinFilas")}</p>
        ) : (
          <section className="tarjeta gps-reportes-tabla">
            <div className="gps-informe-barra">
              <div className="gps-informe-titulo">
                <Icono nombre="grafico" size={20} />
                <span className="gps-informe-titulo-texto">
                  <b>
                    {porTarea
                      ? t("gps.reportes.tarea.comparaciones")
                      : categorizacionVista !== "valorReferencial"
                        ? t("gps.reportes.franjasDe", { vr: t(`gps.reportes.categorizaciones.${categorizacionVista}`) })
                        : tabla?.vr
                          ? t("gps.reportes.franjasDe", { vr: nombreDeVr(tabla.vr) })
                          : t("gps.reportes.franjasSinVr")}
                  </b>
                  <span>
                    {conComparaciones
                      ? `${plural("gps.reportes.tarea.cuantasComparaciones", informe.comparaciones.length)} · ${plural("gps.reportes.tarea.microciclos", filas.length)}`
                      : plural(soloEquipo ? "gps.reportes.cuantosMicrociclos" : todasDeJugadores ? "gps.reportes.cuantosJugadores" : "gps.reportes.cuantasFilas", filas.length)}
                  </span>
                </span>
              </div>
              <div className="gps-informe-acciones">
                {!porTarea && categorizacionVista === "valorReferencial" && tablas.length > 1 && (
                  <button type="button" className="boton-secundario gps-informe-otras" onClick={() => setVerFranjas((actual + 1) % tablas.length)}>
                    <Icono nombre="cambio" size={15} />
                    {t("gps.reportes.verFranjasDe", { vr: nombreDeVr(tablas[(actual + 1) % tablas.length].vr) })}
                  </button>
                )}
                <button type="button" className={`selector-hoja gps-informe-ver ${cuantasOcultas ? "con-ocultas" : ""}`} onClick={abrirColumnas}>
                  <span>{t("gps.reportes.ocultas.columnas")}</span>
                  <b>{cuantasOcultas ? plural("gps.reportes.ocultas.cuantas", cuantasOcultas) : t("gps.reportes.ocultas.todas")}</b>
                  <Icono nombre="flecha" size={15} />
                </button>
                {/* Las franjas de color: un toque las oculta y otro las vuelve a mostrar (Por tarea no tiene; Por jugador con «Objetivo», tampoco). */}
                {conBotonDeFranjas && (
                  <button
                    type="button"
                    className={`selector-hoja gps-informe-ver gps-informe-franjas-boton ${franjasOcultas ? "con-ocultas" : ""}`}
                    onClick={() => setFranjasOcultas((antes) => !antes)}
                    aria-label={t(franjasOcultas ? "gps.reportes.ocultas.mostrarFranjas" : "gps.reportes.ocultas.ocultarFranjas")}
                    title={t(franjasOcultas ? "gps.reportes.ocultas.mostrarFranjas" : "gps.reportes.ocultas.ocultarFranjas")}
                  >
                    <span>{t("gps.reportes.ocultas.franjas")}</span>
                    <b>{t(franjasOcultas ? "gps.reportes.ocultas.franjasOcultas" : "gps.reportes.ocultas.franjasALaVista")}</b>
                    <Icono nombre="ocultar" size={15} />
                  </button>
                )}
              </div>
            </div>
            <div className="gps-informe-marco" tabIndex={0} role="region" aria-label={t(`gps.reportes.${tipo}`)}>
              <table className={`gps-informe-tabla ${soloEquipo ? "solo-equipo" : ""}`}>
                <thead>
                  <tr className="gps-informe-grupos" ref={filaDeGrupos}>
                    <th scope="col" rowSpan={2} className="gps-informe-id">
                      {tituloDeLaPrimera}
                    </th>
                    {gruposDeColumnas.map((grupo) =>
                      grupo.clave ? (
                        <th key={grupo.clave} scope="colgroup" colSpan={grupo.cantidad} className={`tono-${tonos[grupo.clave]}`}>
                          <span className="gps-informe-grupo">
                            {TITULOS_DE_GRUPOS[grupo.clave]}
                            {TERMINOS_DE_GRUPOS[grupo.clave] && <TerminoDe clave={TERMINOS_DE_GRUPOS[grupo.clave]} />}
                          </span>
                        </th>
                      ) : (
                        <th key={grupo.columna.clave} scope="col" rowSpan={2} className={`gps-informe-suelta ${grupo.columna.rival ? "gps-informe-rival" : ""}`}>
                          <button type="button" className="gps-informe-cabecera" onClick={() => setAOcultar({ tipo: "columnas", clave: grupo.columna.clave, titulo: tituloCompleto(grupo.columna) })} title={t("gps.reportes.tocarParaOcultar")} aria-haspopup="dialog">
                            {grupo.columna.titulo}
                          </button>
                        </th>
                      ),
                    )}
                  </tr>
                  <tr className="gps-informe-cabeceras">
                    {columnas
                      .filter((columna) => columna.grupo)
                      .map((columna) => (
                        <th key={columna.clave} scope="col" className={`tono-${tonos[columna.grupo]}`}>
                          <button type="button" className="gps-informe-cabecera" onClick={() => setAOcultar({ tipo: "columnas", clave: columna.clave, titulo: tituloCompleto(columna) })} title={t("gps.reportes.tocarParaOcultar")} aria-haspopup="dialog">
                            {columna.titulo}
                          </button>
                        </th>
                      ))}
                  </tr>
                </thead>
                {franjasAVista.length > 0 && <tbody className="gps-informe-franjas">{franjasAVista.map(filaDeFranja)}</tbody>}
                <tbody className="gps-informe-filas">{filasDeLaTabla.map(filaDeLaTabla)}</tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      {hojaDeVarios}
      <HojaConfirmar
        abierta={Boolean(aOcultar)}
        icono="ocultar"
        titulo={aOcultar ? t("gps.reportes.ocultarTitulo", { nombre: aOcultar.titulo }) : ""}
        descripcion={aOcultar ? t("gps.reportes.ocultarColumnaTexto") : ""}
        etiquetaConfirmar={t("gps.reportes.ocultar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={() => {
          ocultar(aOcultar);
          setAOcultar(null);
        }}
        onCancelar={() => setAOcultar(null)}
      />
    </div>
  );
}
