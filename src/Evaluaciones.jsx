import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEnVivo } from "./domain/enVivo.js";
import { Icono, MarcoAplicacion } from "./components/AppChrome";
import BotonModulos from "./components/BotonModulos.jsx";
import { EscudoDeClub } from "./components/ClubCrest";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { SentidoParaVr } from "./components/SentidoParaVr.jsx";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { TablaDatos } from "./components/TablaDatos.jsx";
import { AvisoSoloLectura } from "./components/SoloLectura.jsx";
import { AvisoDeEspera, falloDeRed, sinSenalAhora, useSinSenal } from "./components/SinSenal.jsx";
import CargaPorJugador, { cargaNueva, evaluacionesDeLaCarga, hayAlgoCargado } from "./CargaPorJugador.jsx";
import ImportarEvaluaciones from "./ImportarEvaluaciones.jsx";
import ReportesEvaluaciones, { SelectorDeTest, SelectorDeVista, vistaInicial } from "./ReportesEvaluaciones.jsx";
import ReferenciasEvaluaciones from "./ReferenciasEvaluaciones.jsx";
import { COMPARAR_AL_ABRIR } from "./domain/evaluaciones/categorias.js";
import {
  COLUMNAS_FIJAS,
  LISTA_SELECCION,
  absolutaDe,
  armarConfig,
  claveDeGrupo,
  codigoNuevo,
  columnaOculta,
  columnasDeLaVista,
  columnasVisibles,
  configVacia,
  esCategoriaDelClub,
  opcionesDeLista,
  opcionesDelExcel,
  textoDeComparar,
  tituloDeColumna,
  tituloDeGrupo,
} from "./domain/evaluaciones/ajustes.js";
import { celdasDeLaFila, listaDeColumna, textoDeCeldaDelInforme } from "./domain/evaluaciones/celdas.js";
import { textoDeValor } from "./domain/evaluaciones/excel.js";
import { calcularFilas, vistaDeFilas } from "./domain/evaluaciones/motor.js";
import { conOtrosDatos, igualEnTodo } from "./domain/evaluaciones/importar.js";
import { conBorrada, conCambio as conCambioEnEspera, conCreadas, conLoQueEspera, conReferencia, conValorEnRuta, esLocal, idsEnEspera, subirLaEspera } from "./domain/evaluaciones/espera.js";
import { guardarEspera, leerEspera } from "./domain/filaDeEspera.js";
import { TESTS } from "./domain/evaluaciones/tests/index.js";
import {
  actualizarEvaluacion,
  borrarEvaluacion,
  cambiarEvaluacion,
  cambiarReferencia,
  cambiosDeLaEvaluacion,
  crearEvaluacion,
  guardarCabecera,
  guardarEvaluaciones,
  guardarOpcionDeLista,
  leerAjustes,
  leerCategorias,
  leerReferencias,
  listarEvaluaciones,
} from "./domain/evaluacionesDb.js";
import { conSentidoEvaluaciones, sentidoDe } from "./domain/sentido.js";
import { cargarEquipos, elegirEquipoInicial, guardarEquipoElegido, leerEquipoElegido, soloParaMirar } from "./domain/equipo.js";
import { cargarPlantelLesiones } from "./domain/lesionesDb.js";
import { actualesPrimero, esActual } from "./domain/plantel.js";
import { interpretarMinutos, textoDeMinutos } from "./domain/tabla.js";
import { t, useIdioma } from "./idioma/index.js";
import { enLista, fechaCorta, fechaLarga, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import "./lesiones.css";
import "./evaluaciones.css";

// Evaluaciones (en Bases de Datos): las hojas del Excel BD_evaluaciones, un
// test cada una (hoy Zona Media; los demás se suman de a uno en
// domain/evaluaciones/tests/). Como Lesiones (Santiago, 09/10), en pantallas:
//   · Cargar: las evaluaciones nuevas se cargan aparte (regla para todas las
//     bases: la carga nueva va en su pantalla), varios jugadores a la vez, una
//     fila por jugador (CargaPorJugador.jsx, 18/10); una de hoy se corrige en
//     un formulario por pasos.
//   · Base: una sola, eligiendo qué test se ve; arriba el informe del Excel
//     (promedio, desvío, n, máximo y mínimo de las filas que deja ver el
//     filtro y la comparación con los V.R. de la categoría elegida) y abajo
//     la tabla con los mismos colores del Excel. Se corrige en la tabla y lo
//     viejo se trae una vez con Pegar desde Excel.
//   · Reportes: el individual (un jugador, todos sus tests) y el grupal (un
//     test, por categoría y fechas), para imprimir.
//   · Valores de referencia: los V.R. de cada test, solo para mirar (se
//     cargan aparte, con los valores exactos del Excel).
//   · Ajustes: el nombre de cada cabecera y las opciones de cada lista.

export const DESTINOS_EVALUACIONES = [
  { id: "cargar", etiqueta: "Cargar", icono: "usuario" },
  { id: "base", etiqueta: "Base", icono: "documento" },
  { id: "reportes", etiqueta: "Reportes", icono: "grafico" },
  { id: "referencias", etiqueta: "Valores de referencia", icono: "registros" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

// Cómo va cada tipo de columna del test en la tabla.
const TIPO_EN_LA_TABLA = { calculado: "calculado", dato_jugador: "calculado", fecha: "fecha", jugador: "lista", lista: "lista", tiempo: "tiempo", texto: "texto", numero: "numero" };
// Lo que se carga a mano (lo demás lo calcula la app o sale de Datos básicos).
const SE_CARGAN = ["fecha", "jugador", "lista", "tiempo", "texto", "numero"];
// Los tests que se cargan a mano en Cargar. Isocinecia no: sale del PDF del
// equipo (Santiago, 09/10); se trae con Pegar desde Excel y se corrige en la Base.
const TESTS_QUE_SE_CARGAN = TESTS.filter((uno) => uno.seCargaEnLaApp !== false);
// Regla 1: cuántos nombres se ven en la hoja (después, «y N más»).
const A_LA_VISTA = 6;
// Los tests con listas propias (sin contar Selección), los de Ajustes › Listas.
const TESTS_CON_LISTAS = TESTS.filter((uno) => uno.columnas.some((columna) => columna.tipo === "lista" && listaDeColumna(columna) !== LISTA_SELECCION));
// Van alineadas a la izquierda, como en el Excel; el resto, centrado.
const A_LA_IZQUIERDA = ["jugador", "nota"];
// Una lista corta se elige con botones; una larga, con la hoja de opciones
// (como en Lesiones).
const MAXIMO_CHIPS = 6;

// Cómo más se puede escribir una opción al pegar: su nombre en los dos
// idiomas, en este club y en el Excel.
const aliasDeOpcion = (lista, codigo, config, test) => [
  ...new Set(
    ["es-AR", "pt-BR"].flatMap((uno) =>
      [config, configVacia()].map((cual) => opcionesDeLista(lista, cual, uno, { test, conOcultas: true }).find((opcion) => opcion.valor === codigo)?.etiqueta).filter(Boolean),
    ),
  ),
];

const primeraMayuscula = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "");

// Lo que tiene una carga, sin vacíos: para saber si se cambió algo.
const sinVacios = (formulario) => {
  if (!formulario) return "";
  const { textos = {}, datos = {}, id, test, jugador_id, persona, fecha } = formulario;
  const limpio = (objeto) =>
    Object.entries(objeto || {})
      .filter(([, valor]) => valor !== null && valor !== undefined && valor !== "")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify([id, test, jugador_id, persona, fecha, limpio(datos), limpio(textos)]);
};

// Los pasos de la carga de un test: primero de quién y de cuándo (con las
// listas sueltas, como Selección); después, un paso por bloque de medidas
// (las columnas con el mismo grupo) y las sueltas juntas; los textos (la
// nota) van al final del último.
export const pasosDeCarga = (test, config) => {
  const manuales = columnasVisibles(test, config).filter((columna) => SE_CARGAN.includes(columna.tipo) && !["fecha", "jugador"].includes(columna.tipo));
  // Al primer paso van también las listas sueltas y lo que el test pide ahí
  // (el peso del día en Curl Nórdico e Isoprone).
  const listasSueltas = manuales.filter((columna) => (columna.tipo === "lista" && !columna.grupo) || columna.enPrimerPaso);
  const textos = manuales.filter((columna) => columna.tipo === "texto" && !columna.grupo && !columna.enPrimerPaso);
  const medidas = manuales.filter((columna) => !listasSueltas.includes(columna) && !textos.includes(columna));
  const pasos = [{ id: "quien", grupo: null, columnas: ["jugador", "fecha", ...listasSueltas.map((columna) => columna.clave)] }];
  medidas.forEach((columna) => {
    const grupo = columna.grupo || null;
    const ultimo = pasos[pasos.length - 1];
    if (pasos.length > 1 && ultimo.grupo === grupo) ultimo.columnas.push(columna.clave);
    else pasos.push({ id: grupo ? `grupo:${grupo}` : `medidas:${pasos.length}`, grupo, columnas: [columna.clave] });
  });
  if (textos.length) {
    if (pasos.length === 1) pasos.push({ id: "medidas:1", grupo: null, columnas: [] });
    pasos[pasos.length - 1].columnas.push(...textos.map((columna) => columna.clave));
  }
  return pasos;
};

// La carga nueva, una fila por jugador (18/10): las columnas de cada fila, en
// el orden de los pasos (la Selección, las listas sueltas, el peso del día,
// cada bloque y la nota al final). Las listas sueltas que no son la Selección
// (Dispositivo y Medio) se eligen para todos en el paso 1 y se pueden cambiar
// en cada fila (Santiago: «Uno para todos pero se puede modificar individual»).
export const columnasDeLaCarga = (test, config) => {
  const columnas = pasosDeCarga(test, config)
    .flatMap((unPaso) => unPaso.columnas)
    .filter((clave) => !["jugador", "fecha"].includes(clave))
    .map((clave) => test.columnas.find((columna) => columna.clave === clave))
    .filter(Boolean);
  const comunes = columnas.filter((columna) => columna.tipo === "lista" && !columna.grupo && listaDeColumna(columna) !== LISTA_SELECCION);
  return { columnas, comunes };
};

// onVolver: el botón de arriba a la izquierda (vuelve a Bases de Datos);
// volverA: la clave de su texto.
export default function Evaluaciones({ onVolver, volverA = "portal.basesTitulo" }) {
  const { idioma, plural } = useIdioma();
  const [equipo, setEquipo] = useState(() => leerEquipoElegido());
  const [vista, setVista] = useState("cargar");
  const [testId, setTestId] = useState(TESTS[0].id);
  const test = TESTS.find((uno) => uno.id === testId) || TESTS[0];
  // Qué parte de cada test se ve en la Base (Isocinecia: qué velocidad).
  const [vistaPorTest, setVistaPorTest] = useState({});
  const vistaDeLaBase = vistaPorTest[test.id] || vistaInicial(test);
  const [plantel, setPlantel] = useState([]);
  const [plantelSinLeer, setPlantelSinLeer] = useState(false);
  // Las evaluaciones del club, de todos los tests.
  const [evaluaciones, setEvaluaciones] = useState([]);
  // Los V.R. del club, por test.
  const [referenciasPorTest, setReferenciasPorTest] = useState({});
  const [filasAjustes, setFilasAjustes] = useState({ campos: [], opciones: [] });
  // Las categorías del club en Datos básicos (son la Selección; 18/10). null:
  // no se pudieron leer y valen las de la app.
  const [filasCategorias, setFilasCategorias] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // Contra qué categoría compara el informe (el "Vs Mayor" del Excel).
  const [comparar, setComparar] = useState(COMPARAR_AL_ABRIR);
  const [importando, setImportando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  // Sin señal, lo que se ve es la copia de este aparato ({ guardadaEn }; paso
  // 1 de «cargar sin señal…»), con lo que espera para subir encima.
  const [deLaCopia, setDeLaCopia] = useState(null);
  // Lo cargado, cambiado o borrado sin señal que espera para subir (paso 3;
  // evaluaciones/espera.js), lo que ya se está subiendo y las nuevas que
  // chocan con otra del mismo jugador y día (Regla 1: se pregunta).
  const [cola, setCola] = useState([]);
  const colaActual = useRef([]);
  const [subiendo, setSubiendo] = useState(false);
  const subiendoAhora = useRef(false);
  const [chocadas, setChocadas] = useState(null);

  // La carga: { id, test, jugador_id, persona, fecha, datos, textos } (textos:
  // los tiempos como se escriben, hasta guardar).
  const [formulario, setFormulario] = useState(null);
  const [paso, setPaso] = useState(0);
  const [pasoMaximo, setPasoMaximo] = useState(0);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [aSalir, setASalir] = useState(null);
  const [hojaSelector, setHojaSelector] = useState(null);
  // La carga nueva, varios jugadores a la vez (CargaPorJugador.jsx).
  const [nuevas, setNuevas] = useState(null);
  const [errorNuevas, setErrorNuevas] = useState("");
  // Regla 1 (Santiago, 20/10): las evaluaciones de la carga de alguien que ese
  // día ya tiene otra del test, con otros datos (la hoja pregunta).
  const [otrasDelDia, setOtrasDelDia] = useState(null);
  // «Ir a la Base»: lo que espera ({ tipo: "carga", carga } o { tipo:
  // "pegado", texto, anio, elegidos }) y las filas que se revisan ({ tipo,
  // test, fecha, vez, filtros }).
  const [enEspera, setEnEspera] = useState(null);
  const [revisar, setRevisar] = useState(null);

  // Ajustes: qué se mira y la hoja abierta.
  const [vistaAjustes, setVistaAjustes] = useState("inicio");
  const [hojaCabecera, setHojaCabecera] = useState(null);
  const [hojaOpcion, setHojaOpcion] = useState(null);
  const [errorHoja, setErrorHoja] = useState("");

  const equipoId = equipo?.id || null;
  // Quien ya se fue del club ve lo cargado hasta su último día y no cambia
  // nada; quien tiene Evaluaciones «Solo lectura» ve todo, al día, y tampoco.
  const seFue = Boolean(equipo?.hasta);
  const mirar = soloParaMirar(equipo, "evaluaciones");
  // Sin señal se carga, se cambia y se borra igual (paso 3 de «cargar sin
  // señal…»; Santiago, 21/10); los Ajustes, solo con señal.
  const soloLectura = seFue || mirar;
  const sinConexion = Boolean(deLaCopia) || !enLinea;
  // Para ver Evaluaciones sin señal (Santiago, 21/10: la copia «Automática en
  // todos, sin botón»). Quien ya se fue no guarda copia.
  const sinSenal = useSinSenal("evaluaciones", equipoId, { deshabilitado: seFue });
  const leerCopia = useRef(sinSenal.leer);
  leerCopia.current = sinSenal.leer;
  const cuenta = sinSenal.cuenta;

  // La fila de espera queda en este aparato con cada cambio.
  const ponerCola = (nueva) => {
    colaActual.current = nueva;
    setCola(nueva);
    guardarEspera("evaluaciones", cuenta, equipoId, nueva);
  };
  // Lo que se lee (de la base o de la copia), con lo que espera encima.
  const conLaCola = (evaluacionesLeidas, referenciasLeidas) => conLoQueEspera({ evaluaciones: evaluacionesLeidas, referencias: referenciasLeidas }, colaActual.current);

  // Sin club elegido en este celular, se adopta el que diga la base.
  useEffect(() => {
    if (equipoId) return undefined;
    let vigente = true;
    cargarEquipos().then(({ equipos, error: falla }) => {
      const elegido = elegirEquipoInicial(equipos, null, { huboError: Boolean(falla) });
      if (vigente && elegido) {
        guardarEquipoElegido(elegido);
        setEquipo(elegido);
      }
    });
    return () => {
      vigente = false;
    };
  }, [equipoId]);

  // silencioso: lo nuevo de otros (useEnVivo), sin "Cargando…"; lo que no se
  // pudo leer queda como se veía.
  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    // Sin señal, la copia de este aparato; si no hay, como siempre (el aviso
    // de que hace falta señal).
    const conLaCopia = async () => {
      const copia = await leerCopia.current();
      if (!copia) return false;
      const { datos } = copia;
      setPlantel(Array.isArray(datos.plantel) ? datos.plantel : []);
      setPlantelSinLeer(false);
      const conEspera = conLaCola(Array.isArray(datos.evaluaciones) ? datos.evaluaciones : [], datos.referencias || {});
      setEvaluaciones(conEspera.evaluaciones);
      setReferenciasPorTest(conEspera.referencias);
      if (datos.ajustes) setFilasAjustes(datos.ajustes);
      setFilasCategorias(datos.categorias ?? null);
      setDeLaCopia({ guardadaEn: copia.guardadaEn });
      setError("");
      setCargando(false);
      return true;
    };
    if (sinSenalAhora() && (await conLaCopia())) return;
    if (!silencioso) {
      setCargando(true);
      setError("");
    }
    const [respuestaPlantel, respuestaEvaluaciones, respuestaReferencias, respuestaAjustes, respuestaCategorias] = await Promise.all([
      cargarPlantelLesiones(equipoId),
      listarEvaluaciones(equipoId),
      leerReferencias(equipoId),
      leerAjustes(equipoId),
      leerCategorias(equipoId),
    ]);
    // Se cortó la señal en el camino: la copia, si hay.
    const sinLlegar = [respuestaEvaluaciones, respuestaReferencias].find((respuesta) => respuesta.error);
    if (sinLlegar && falloDeRed(sinLlegar) && (await conLaCopia())) return;
    if (!sinLlegar) setDeLaCopia(null);
    if (silencioso) {
      if (!respuestaPlantel.error && !respuestaPlantel.deRespaldo) setPlantel(respuestaPlantel.plantel || []);
      if (!respuestaEvaluaciones.error) setEvaluaciones(conLaCola(respuestaEvaluaciones.evaluaciones, {}).evaluaciones);
      if (!respuestaReferencias.error) setReferenciasPorTest(conLaCola([], respuestaReferencias.referencias || {}).referencias);
      if (!respuestaAjustes.error) setFilasAjustes({ campos: respuestaAjustes.campos, opciones: respuestaAjustes.opciones, sinSentido: respuestaAjustes.sinSentido });
      if (!respuestaCategorias.error) setFilasCategorias(respuestaCategorias.filas);
      return;
    }
    setPlantel(respuestaPlantel.plantel || []);
    setPlantelSinLeer(Boolean(respuestaPlantel.error || respuestaPlantel.deRespaldo));
    if (respuestaEvaluaciones.error || respuestaReferencias.error) {
      setError(respuestaEvaluaciones.error || respuestaReferencias.error);
    } else {
      const conEspera = conLaCola(respuestaEvaluaciones.evaluaciones, respuestaReferencias.referencias || {});
      setEvaluaciones(conEspera.evaluaciones);
      setReferenciasPorTest(conEspera.referencias);
    }
    // Sin poder leer los Ajustes, siguen los nombres del Excel.
    if (!respuestaAjustes.error) setFilasAjustes({ campos: respuestaAjustes.campos, opciones: respuestaAjustes.opciones, sinSentido: respuestaAjustes.sinSentido });
    setFilasCategorias(respuestaCategorias.filas);
    setCargando(false);
  }, [equipoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Lo que carga o cambia otra persona aparece solo (Santiago, 11/10).
  useEnVivo({ nombre: "evaluaciones", tablas: ["evaluaciones", "jugadores"], equipoId, activo: !seFue, alCambiar: () => cargar({ silencioso: true }) });
  // Los V.R. que cambia otra persona, en su propio canal (sin la
  // actualización 20261025 la tabla no avisa: no hay nada que escuchar).
  useEnVivo({ nombre: "evaluaciones-referencias", tablas: ["evaluaciones_referencias"], equipoId, activo: !seFue, alCambiar: () => cargar({ silencioso: true }) });

  useEffect(() => {
    const alCambiar = () => setEnLinea(navigator.onLine !== false);
    window.addEventListener("online", alCambiar);
    window.addEventListener("offline", alCambiar);
    return () => {
      window.removeEventListener("online", alCambiar);
      window.removeEventListener("offline", alCambiar);
    };
  }, []);

  // La fila de espera de esta cuenta y este club, en este aparato: lo que se
  // ve, con ella encima.
  useEffect(() => {
    let vigente = true;
    leerEspera("evaluaciones", cuenta, equipoId).then((guardada) => {
      if (!vigente || !guardada.length) return;
      colaActual.current = guardada;
      setCola(guardada);
      setEvaluaciones((previas) => conLoQueEspera({ evaluaciones: previas, referencias: {} }, guardada).evaluaciones);
      setReferenciasPorTest((previas) => conLoQueEspera({ evaluaciones: [], referencias: previas }, guardada).referencias);
    });
    return () => {
      vigente = false;
    };
  }, [cuenta, equipoId]);

  // Vuelve la señal mientras se ve la copia: lo de la base, al día (si algo
  // espera, se sube primero; ver abajo).
  useEffect(() => {
    if (enLinea && deLaCopia && !colaActual.current.some((uno) => !uno.chocan)) cargar();
  }, [enLinea]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lo que se ve (al día, con señal) queda en la copia de este aparato, un
  // rato después de cada cambio.
  // (Mientras algo espera para subir, no: la copia es lo que había en la base.)
  useEffect(() => {
    if (!sinSenal.activo || deLaCopia || cola.length || cargando || error || plantelSinLeer || !equipoId) return undefined;
    const temporizador = setTimeout(
      () => sinSenal.guardar({ plantel, evaluaciones, referencias: referenciasPorTest, ajustes: filasAjustes, categorias: filasCategorias }),
      1500,
    );
    return () => clearTimeout(temporizador);
  }, [sinSenal.activo, sinSenal.guardar, deLaCopia, cola.length, cargando, error, plantelSinLeer, equipoId, plantel, evaluaciones, referenciasPorTest, filasAjustes, filasCategorias]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aviso) return undefined;
    const temporizador = setTimeout(() => setAviso(""), 2600);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  const config = useMemo(() => (filasAjustes ? armarConfig(filasAjustes.campos, filasAjustes.opciones, filasCategorias) : configVacia()), [filasAjustes, filasCategorias]);
  const esCategoria = useCallback((codigo) => esCategoriaDelClub(codigo, config), [config]);
  const titulo = (unTest, columna) => tituloDeColumna(unTest, columna, config, idioma);
  const opcionesDeColumna = (unTest, columna) => opcionesDeLista(listaDeColumna(columna), config, idioma, { test: unTest });
  const categorias = useMemo(() => opcionesDeLista(LISTA_SELECCION, config, idioma), [config, idioma]);

  const jugadorDe = useCallback((id) => plantel.find((jugador) => String(jugador.id) === String(id)) || null, [plantel]);
  const nombreDe = (evaluacion) => jugadorDe(evaluacion?.jugador_id)?.nombre || evaluacion?.persona || "";
  const testDe = (id) => TESTS.find((uno) => uno.id === id) || null;

  // Los jugadores para elegir: los del plantel actual primero; quien ya no
  // está, con su aviso (al pegar, también vale el nombre solo).
  const opcionesDeJugadores = useMemo(
    () =>
      actualesPrimero(plantel).map((jugador) => ({
        valor: String(jugador.id),
        etiqueta: esActual(jugador) ? jugador.nombre : `${jugador.nombre} · ${t("datos.yaNoEsta")}`,
        alias: [jugador.nombre],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plantel, idioma],
  );

  // ----------------------------------------------------------------- Base --

  const delTest = useMemo(() => evaluaciones.filter((evaluacion) => evaluacion.test === test.id), [evaluaciones, test]);
  const referencias = referenciasPorTest[test.id] || null;

  // Paso 1: lo que el Excel calcula de cada fila, con todas las del test.
  const calculadas = useMemo(() => calcularFilas(test, delTest, referencias, { esCategoria }), [test, delTest, referencias, esCategoria]);

  const visibles = useMemo(() => columnasDeLaVista(columnasVisibles(test, config), vistaDeLaBase), [test, config, vistaDeLaBase]);
  const columnas = useMemo(
    () =>
      visibles.map((columna) => ({
        clave: columna.clave,
        titulo: tituloDeColumna(test, columna, config, idioma),
        grupo: columna.grupo,
        grupoTitulo: columna.grupo ? tituloDeGrupo(test, test.grupos?.find((grupo) => grupo.clave === columna.grupo) || { clave: columna.grupo }, config, idioma) : undefined,
        tipo: TIPO_EN_LA_TABLA[columna.tipo] || "calculado",
        editable: !soloLectura && SE_CARGAN.includes(columna.tipo),
        ancho: columna.ancho,
        alinear: A_LA_IZQUIERDA.includes(columna.clave) ? undefined : "centro",
        opciones:
          columna.tipo === "jugador"
            ? opcionesDeJugadores
            : columna.tipo === "lista"
              ? opcionesDeLista(listaDeColumna(columna), config, idioma, { test }).map((opcion) => ({
                  valor: opcion.valor,
                  etiqueta: opcion.etiqueta,
                  // Para pegar: también vale el texto en el otro idioma y como lo escribe el Excel.
                  alias: aliasDeOpcion(listaDeColumna(columna), opcion.valor, config, test),
                }))
              : undefined,
      })),
    [test, visibles, config, idioma, soloLectura, opcionesDeJugadores],
  );
  const fijas = useMemo(() => visibles.filter((columna) => columna.fija).map((columna) => columna.clave), [visibles]);

  // La planilla de V.R. (nota 3, 19/10): las filas del test como en la Base,
  // con todas sus columnas (no solo las de una vista), solo para mirar y
  // filtrar la muestra. Las filas se arman recién al abrirla.
  const planillaDeVr = useMemo(() => {
    const todas = columnasVisibles(test, config);
    const etiqueta = (columna) => tituloDeColumna(test, columna, config, idioma);
    return {
      columnas: todas.map((columna) => ({
        clave: columna.clave,
        titulo: etiqueta(columna),
        grupo: columna.grupo,
        grupoTitulo: columna.grupo ? tituloDeGrupo(test, test.grupos?.find((grupo) => grupo.clave === columna.grupo) || { clave: columna.grupo }, config, idioma) : undefined,
        tipo: TIPO_EN_LA_TABLA[columna.tipo] || "calculado",
        editable: false,
        ancho: columna.ancho,
        alinear: A_LA_IZQUIERDA.includes(columna.clave) ? undefined : "centro",
      })),
      fijas: todas.filter((columna) => columna.fija).map((columna) => columna.clave),
      armarFilas: () =>
        calculadas.map(({ fila, celdas }) => ({
          id: fila.id,
          ...celdasDeLaFila({ test, columnas: todas, fila, celdas, jugador: jugadorDe(fila.jugador_id), config, idioma }),
          celdas,
        })),
      // Cómo se ve un valor guardado de la muestra (para decir con qué se calculó).
      textoDe: (clave, valor) => {
        const columna = todas.find((una) => una.clave === clave);
        if (!columna) return String(valor ?? "");
        if (columna.tipo === "fecha") return fechaCorta(valor);
        if (columna.tipo === "jugador") return jugadorDe(valor)?.nombre || String(valor ?? "");
        if (columna.tipo === "lista") return opcionesDeLista(listaDeColumna(columna), config, idioma, { conOcultas: true, test }).find((opcion) => opcion.valor === valor)?.etiqueta || String(valor ?? "");
        return String(valor ?? "");
      },
      // El sentido de Ajustes › Cabeceras (nota 1).
      sentidoDe: (clave) => config.campos?.[test.id]?.[clave]?.sentido || null,
    };
  }, [test, config, idioma, calculadas, jugadorDe]);

  // Cómo se ve cada celda (como en el Excel, con su formato) y qué se edita.
  const idsQueEsperan = useMemo(() => idsEnEspera(cola), [cola]);
  const filas = useMemo(
    () =>
      calculadas.map(({ fila, celdas }) => {
        const jugador = jugadorDe(fila.jugador_id);
        return {
          id: fila.id,
          ...celdasDeLaFila({ test, columnas: visibles, fila, celdas, jugador, config, idioma }),
          celdas,
          // Quien ya no está en el plantel actual, en otro color (como en Lesiones).
          apagada: Boolean(jugador && !esActual(jugador)),
          // Lo cargado o cambiado sin señal, en otro color hasta que sube
          // (Santiago, 21/10: las filas «de otro color»).
          espera: idsQueEsperan.has(fila.id),
        };
      }),
    [calculadas, test, visibles, jugadorDe, config, idioma, idsQueEsperan],
  );

  const selectorComparar = (
    <label className="evaluaciones-comparar">
      <span>{t("evaluaciones.comparar")}</span>
      <select value={comparar} onChange={(evento) => setComparar(evento.target.value)}>
        {categorias.map((categoria) => (
          <option key={categoria.valor} value={categoria.valor}>
            {textoDeComparar(categoria.valor, config, idioma)}
          </option>
        ))}
      </select>
    </label>
  );

  // Paso 2, con las filas que se ven: el informe de arriba y los colores.
  const informeYColores = useCallback(
    (filasVista) => {
      const { informe, estilos, estilosComparacion } = vistaDeFilas(
        test,
        filasVista.map((fila) => ({ id: fila.id, celdas: fila.celdas })),
        referencias,
        comparar,
      );
      const rotulo = (fila) => {
        // Las filas 2 y 3 del Excel: a la izquierda, el selector "Vs …".
        if (fila.id === "comparacion") return selectorComparar;
        if (fila.id === "referencia") return null;
        // El nº de evaluaciones (D6 del Excel) va a la izquierda del rótulo.
        if (fila.id === "n")
          return (
            <span className="evaluaciones-rotulo-n">
              <b title={t("evaluaciones.totalEvaluaciones")}>{textoDeValor(fila.celdas.numero?.valor, "General", idioma)}</b>
              <span>{fila.rotulo[idioma]}</span>
            </span>
          );
        return fila.rotulo[idioma];
      };
      return {
        estilos,
        arriba: informe.map((fila) => ({
          id: fila.id,
          rotulo: rotulo(fila),
          alto: fila.id === "comparacion" ? 2 : 1,
          celdas: Object.fromEntries(
            Object.entries(fila.celdas).map(([clave, celda]) => [
              clave,
              { texto: textoDeCeldaDelInforme(celda, idioma), estilo: fila.id === "comparacion" ? estilosComparacion[clave] : undefined },
            ]),
          ),
        })),
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [test, referencias, comparar, idioma, config, categorias],
  );

  const reemplazar = (evaluacion) => setEvaluaciones((previas) => previas.map((una) => (una.id === evaluacion.id ? evaluacion : una)));

  // Lo último de cada evaluación (lo que ya devolvió la base, aunque la
  // pantalla todavía no se haya redibujado) y una cola por fila: dos celdas
  // de la misma fila guardadas seguidas no se pisan, la segunda sale de lo
  // que dejó la primera.
  const ultimas = useRef(evaluaciones);
  ultimas.current = evaluaciones;
  const colas = useRef(new Map());

  // Se guarda solo lo cambiado (paso 2 de «cargar sin señal y a la vez que
  // otra persona»): celdas distintas de la misma fila no se pisan; en la
  // misma celda gana el último y se avisa (Santiago, 21/10: «Gana el último,
  // con aviso»); si otra persona la borró, queda borrada y se avisa. vieja:
  // como se veía al empezar a cambiarla. Sin la actualización 20261114, la
  // fila entera, como antes.
  const nombreDeLaClave = (unTest, clave) => {
    const columna = clave.startsWith("datos.")
      ? unTest.columnas.find((una) => una.clave === clave.slice(6))
      : unTest.columnas.find((una) => una.tipo === (clave === "fecha" ? "fecha" : "jugador"));
    return columna ? titulo(unTest, columna) : clave;
  };
  // Sin señal (o si la señal se corta al guardar), y siempre en una que
  // todavía espera para cargarse, el cambio queda en la fila de espera
  // (enEspera) y se ve al toque.
  const guardarCambios = async (id, vieja, nueva) => {
    const { cambios, antes } = cambiosDeLaEvaluacion(vieja, nueva);
    const enLaLista = ultimas.current.find((una) => una.id === id) || vieja;
    if (!Object.keys(cambios).length) return { evaluacion: enLaLista, error: "" };
    const aLaEspera = () => {
      ponerCola(conCambioEnEspera(colaActual.current, { id, cambios, antes }));
      const { textos: _, ...sinTextos } = { ...enLaLista, ...nueva, id };
      return { evaluacion: sinTextos, enEspera: true, error: "" };
    };
    if (sinConexion || esLocal(id)) return aLaEspera();
    const respuesta = await cambiarEvaluacion(id, { cambios, antes });
    if (falloDeRed(respuesta)) return aLaEspera();
    if (respuesta.sinFuncion) return actualizarEvaluacion(id, nueva);
    if (respuesta.borrada) {
      ultimas.current = ultimas.current.filter((una) => una.id !== id);
      setEvaluaciones((previas) => previas.filter((una) => una.id !== id));
      setAviso(t("evaluaciones.cambios.borrada"));
      return { borrada: true, error: "" };
    }
    if (respuesta.error) return respuesta;
    if (respuesta.pisadas.length) {
      const suyo = testDe(vieja?.test || respuesta.evaluacion.test) || test;
      setAviso(t("evaluaciones.cambios.pisadas", { columnas: enLista([...new Set(respuesta.pisadas.map((pisada) => nombreDeLaClave(suyo, pisada.clave)))]) }));
    }
    return { evaluacion: respuesta.evaluacion, pisadas: respuesta.pisadas, error: "" };
  };

  const guardarFila = (id, cambiar) => {
    const unPaso = async () => {
      const evaluacion = ultimas.current.find((una) => una.id === id);
      if (!evaluacion) return { error: "evaluaciones.error.noGuardar" };
      const { evaluacion: nueva, error: falta } = cambiar(evaluacion);
      if (falta) return { error: falta };
      if (!nueva) return {};
      const respuesta = await guardarCambios(id, evaluacion, nueva);
      if (respuesta.borrada) return {};
      if (respuesta.error) return { error: respuesta.error };
      ultimas.current = ultimas.current.map((una) => (una.id === id ? respuesta.evaluacion : una));
      reemplazar(respuesta.evaluacion);
      return {};
    };
    const siguiente = (colas.current.get(id) || Promise.resolve()).then(unPaso, unPaso);
    colas.current.set(id, siguiente);
    return siguiente;
  };

  // Una celda cambiada, sobre la evaluación: { evaluacion } o { error } (y
  // nada si no es de las que se cargan).
  const conCambio = (evaluacion, clave, valor) => {
    const columna = test.columnas.find((una) => una.clave === clave);
    if (!columna || !SE_CARGAN.includes(columna.tipo)) return {};
    if (columna.tipo === "fecha") return { evaluacion: { ...evaluacion, fecha: valor || null } };
    // Una evaluación es siempre de alguien.
    if (columna.tipo === "jugador") return valor ? { evaluacion: { ...evaluacion, jugador_id: Number(valor), persona: null } } : { error: "evaluaciones.error.sinJugador" };
    return { evaluacion: { ...evaluacion, datos: { ...evaluacion.datos, [clave]: valor === "" ? null : valor } } };
  };

  const editarCelda = (id, clave, valor) => guardarFila(id, (evaluacion) => conCambio(evaluacion, clave, valor));

  const pegarEnTabla = async (cambios) => {
    const porFila = new Map();
    cambios.forEach((cambio) => porFila.set(cambio.filaId, [...(porFila.get(cambio.filaId) || []), cambio]));
    let hechos = 0;
    let ultimoError = "";
    for (const [id, suyos] of porFila) {
      // eslint-disable-next-line no-await-in-loop
      const resultado = await guardarFila(id, (evaluacion) => {
        let falta = "";
        const nueva = suyos.reduce((acumulada, cambio) => {
          const uno = conCambio(acumulada, cambio.clave, cambio.valor);
          if (uno.error) falta = uno.error;
          return uno.evaluacion || acumulada;
        }, evaluacion);
        return falta ? { error: falta } : { evaluacion: nueva };
      });
      if (resultado.error) ultimoError = resultado.error;
      else hechos += suyos.length;
    }
    return { hechos, error: ultimoError };
  };

  // Se borran de a una, todas las elegidas (con Shift, varias filas de la
  // Base); si alguna no se puede, se avisa cuántas se borraron.
  const confirmarBorrar = async () => {
    const elegidas = aBorrar || [];
    setABorrar(null);
    if (!elegidas.length) return;
    setOcupado(true);
    const borradas = [];
    let falla = "";
    let esperan = 0;
    for (const evaluacion of elegidas) {
      // Sin señal (o si se corta), y la que todavía espera para cargarse:
      // en la fila de espera.
      const respuesta = sinConexion || esLocal(evaluacion.id) ? { error: "", enEspera: true } : await borrarEvaluacion(evaluacion.id); // eslint-disable-line no-await-in-loop
      if (respuesta.enEspera || falloDeRed(respuesta)) {
        ponerCola(conBorrada(colaActual.current, evaluacion.id));
        if (!esLocal(evaluacion.id)) esperan += 1;
        borradas.push(evaluacion.id);
      } else if (respuesta.error) falla = falla || respuesta.error;
      else borradas.push(evaluacion.id);
    }
    setOcupado(false);
    setEvaluaciones((previas) => previas.filter((una) => !borradas.includes(una.id)));
    if (formulario?.id && borradas.includes(formulario.id)) cerrarFormulario();
    if (falla) setAviso(elegidas.length === 1 ? t(falla) : `${t(falla)} ${t("tabla.borradasDe", { n: borradas.length, total: elegidas.length })}`);
    else if (esperan) setAviso(plural("sinSenal.quedaronEnElAparato", esperan));
    else setAviso(elegidas.length === 1 ? t("evaluaciones.borrada") : t("evaluaciones.borradas", { n: borradas.length }));
  };

  // --------------------------------------------------------------- Cargar --

  const formularioAlAbrir = useRef(null);
  const abrirFormulario = (nuevo, { pasoInicial = 0, todos = false } = {}) => {
    formularioAlAbrir.current = nuevo;
    setErrorFormulario("");
    setPaso(pasoInicial);
    setPasoMaximo(todos ? pasosDeCarga(testDe(nuevo.test) || TESTS[0], config).length - 1 : pasoInicial);
    setFormulario(nuevo);
  };

  const abrirNueva = () => {
    setErrorNuevas("");
    // La carga que quedó en espera («Ir a la Base») sigue desde ahí.
    if (enEspera?.tipo === "carga") {
      setNuevas(enEspera.carga);
      setEnEspera(null);
      setRevisar(null);
      return;
    }
    setNuevas(cargaNueva((TESTS_QUE_SE_CARGAN.includes(test) ? test : TESTS_QUE_SE_CARGAN[0]).id));
  };

  // Al editar, los tiempos se ven como se escriben (3:04).
  const abrirEdicion = (evaluacion) => {
    const suyo = testDe(evaluacion.test);
    if (!suyo || !TESTS_QUE_SE_CARGAN.includes(suyo)) return;
    const textos = {};
    suyo.columnas.forEach((columna) => {
      if (columna.tipo === "tiempo" && typeof evaluacion.datos?.[columna.clave] === "number") textos[columna.clave] = textoDeMinutos(evaluacion.datos[columna.clave]);
      if (columna.tipo === "numero" && typeof evaluacion.datos?.[columna.clave] === "number") textos[columna.clave] = String(evaluacion.datos[columna.clave]).replace(".", ",");
    });
    abrirFormulario({ ...evaluacion, datos: { ...(evaluacion.datos || {}) }, textos }, { pasoInicial: 0, todos: true });
  };

  function cerrarFormulario() {
    setFormulario(null);
    setErrorFormulario("");
  }

  const testDelFormulario = formulario ? testDe(formulario.test) || TESTS[0] : null;
  const pasos = useMemo(() => (testDelFormulario ? pasosDeCarga(testDelFormulario, config) : []), [testDelFormulario, config]);

  const cambiarFormulario = (cambios) => setFormulario((actual) => ({ ...actual, ...cambios }));
  const cambiarDato = (clave, valor) => setFormulario((actual) => ({ ...actual, datos: { ...actual.datos, [clave]: valor } }));
  const cambiarTexto = (clave, texto) => setFormulario((actual) => ({ ...actual, textos: { ...actual.textos, [clave]: texto } }));

  // Un tiempo o un número escrito: { valor } (null si está vacío) o { error }.
  const leerEscrito = (columna, texto) => {
    const limpio = String(texto ?? "").trim();
    if (!limpio) return { valor: null };
    if (columna.tipo === "tiempo") {
      const segundos = interpretarMinutos(limpio);
      return typeof segundos === "number" ? { valor: segundos } : { error: t("evaluaciones.form.tiempoMal", { columna: titulo(testDelFormulario, columna), valor: limpio }) };
    }
    const numero = Number(limpio.replace(",", "."));
    return Number.isFinite(numero) ? { valor: numero } : { error: t("evaluaciones.form.numeroMal", { columna: titulo(testDelFormulario, columna), valor: limpio }) };
  };

  // Lo que le falta a un paso para seguir ("" si nada).
  const validarPaso = (indice, carga) => {
    const unPaso = pasos[indice];
    if (!unPaso) return "";
    for (const clave of unPaso.columnas) {
      if (clave === "jugador" && !carga.jugador_id && !carga.persona) return t("evaluaciones.error.sinJugador");
      if (clave === "fecha") {
        if (!carga.fecha) return t("evaluaciones.form.faltaFecha");
        if (carga.fecha > hoyISO()) return t("evaluaciones.error.fechaFutura");
      }
      const columna = testDelFormulario.columnas.find((una) => una.clave === clave);
      if (columna && ["tiempo", "numero"].includes(columna.tipo)) {
        const leido = leerEscrito(columna, carga.textos?.[clave]);
        if (leido.error) return leido.error;
      }
    }
    return "";
  };

  const irAlPaso = (indice) => {
    for (let uno = paso; uno < indice; uno += 1) {
      const falta = validarPaso(uno, formulario);
      if (falta) {
        setErrorFormulario(falta);
        setPaso(uno);
        return;
      }
    }
    setErrorFormulario("");
    setPaso(indice);
    setPasoMaximo((actual) => Math.max(actual, indice));
  };

  const guardarFormulario = async () => {
    const carga = formulario;
    for (let indice = 0; indice < pasos.length; indice += 1) {
      const falta = validarPaso(indice, carga);
      if (falta) {
        setErrorFormulario(falta);
        setPaso(indice);
        return;
      }
    }
    // Lo escrito pasa a lo guardado: los tiempos, en segundos.
    const datos = { ...carga.datos };
    testDelFormulario.columnas.forEach((columna) => {
      if (["tiempo", "numero"].includes(columna.tipo) && carga.textos && columna.clave in carga.textos) datos[columna.clave] = leerEscrito(columna, carga.textos[columna.clave]).valor;
    });
    const evaluacion = { jugador_id: carga.jugador_id, persona: carga.persona, fecha: carga.fecha, datos };
    setOcupado(true);
    const respuesta = carga.id ? await guardarCambios(carga.id, formularioAlAbrir.current, evaluacion) : await crearOEsperar(carga.test, evaluacion);
    setOcupado(false);
    if (respuesta.borrada) {
      cerrarFormulario();
      return;
    }
    if (respuesta.error) {
      setErrorFormulario(t(respuesta.error));
      return;
    }
    if (carga.id) reemplazar(respuesta.evaluacion);
    else setEvaluaciones((previas) => [...previas, respuesta.evaluacion]);
    cerrarFormulario();
    // Si pisó lo de otra persona, ese aviso queda.
    if (respuesta.enEspera) setAviso(t("sinSenal.quedoEnElAparato"));
    else if (!respuesta.pisadas?.length) setAviso(t("evaluaciones.guardada"));
  };

  // Una nueva: sin señal (o si se corta al guardar), a la fila de espera.
  const crearOEsperar = async (unTest, evaluacion) => {
    const aLaEspera = () => {
      const nuevaCola = conCreadas(colaActual.current, unTest, [evaluacion]);
      ponerCola(nuevaCola);
      const { evaluaciones: conEspera } = conLoQueEspera({ evaluaciones: ultimas.current }, nuevaCola);
      return { evaluacion: conEspera[conEspera.length - 1], enEspera: true, error: "" };
    };
    if (sinConexion) return aLaEspera();
    const respuesta = await crearEvaluacion(equipoId, unTest, evaluacion);
    return falloDeRed(respuesta) ? aLaEspera() : respuesta;
  };

  const testDeNuevas = nuevas ? testDe(nuevas.test) || TESTS_QUE_SE_CARGAN[0] : null;
  const columnasDeNuevas = useMemo(() => (testDeNuevas ? columnasDeLaCarga(testDeNuevas, config) : null), [testDeNuevas, config]);

  // Sin la actualización 20261113: una evaluación por fila con algo cargado,
  // de a una. Si una no se puede, las guardadas salen de la carga (al
  // reintentar no se repiten).
  const guardarDeAUna = async (listas) => {
    const guardadas = [];
    let falla = "";
    for (const { filaId, evaluacion } of listas) {
      const respuesta = await crearEvaluacion(equipoId, nuevas.test, evaluacion); // eslint-disable-line no-await-in-loop
      if (respuesta.error) {
        falla = respuesta.error;
        break;
      }
      guardadas.push({ filaId, evaluacion: respuesta.evaluacion });
    }
    setOcupado(false);
    if (guardadas.length) setEvaluaciones((previas) => [...previas, ...guardadas.map((una) => una.evaluacion)]);
    if (falla) {
      const ids = new Set(guardadas.map((una) => una.filaId));
      setNuevas((actual) => ({ ...actual, filas: actual.filas.filter((fila) => !ids.has(fila.id)) }));
      setErrorNuevas(guardadas.length ? `${t(falla)} ${plural("evaluaciones.varios.seGuardaron", guardadas.length)}` : t(falla));
      return;
    }
    setNuevas(null);
    setAviso(plural("evaluaciones.varios.guardadas", guardadas.length));
  };

  // Todas de una vez (20261113): se guardan todas o ninguna. La igual en todo
  // a una que ya está no se carga; la de alguien que ese día ya tiene otra
  // con otros datos (Regla 1), se pregunta: «Ir a la Base» o «Reemplazar y
  // cargar».
  const guardarNuevas = async ({ reemplazar = false } = {}) => {
    setOtrasDelDia(null);
    const { evaluaciones: listas, error: falta } = evaluacionesDeLaCarga(nuevas, {
      columnas: columnasDeNuevas.columnas,
      nombreDe: (id) => jugadorDe(id)?.nombre || "",
      titulo: (columna) => titulo(testDeNuevas, columna),
    });
    if (falta) {
      setErrorNuevas(falta);
      return;
    }
    const delTestDeNuevas = evaluaciones.filter((una) => una.test === nuevas.test);
    const igual = listas.find(({ evaluacion }) => delTestDeNuevas.some((otra) => igualEnTodo(otra, evaluacion)));
    if (igual) {
      setErrorNuevas(t("evaluaciones.varios.yaEsta", { jugador: nombreDe(igual.evaluacion) }));
      return;
    }
    // Sin señal, todas quedan esperando: la Regla 1 se pregunta al subirlas,
    // con lo que haya en la base en ese momento (Santiago, 21/10: «Espera y
    // te pregunta»).
    const aLaEspera = () => {
      const nuevaCola = conCreadas(
        colaActual.current,
        nuevas.test,
        listas.map((una) => una.evaluacion),
      );
      ponerCola(nuevaCola);
      setEvaluaciones((previas) => conLoQueEspera({ evaluaciones: previas }, nuevaCola).evaluaciones);
      setErrorNuevas("");
      setOcupado(false);
      setNuevas(null);
      setAviso(plural("sinSenal.quedaronEnElAparato", listas.length));
    };
    if (sinConexion) {
      aLaEspera();
      return;
    }
    const choques = conOtrosDatos(
      listas.map((una) => una.evaluacion),
      delTestDeNuevas,
    );
    if (choques.length && !reemplazar) {
      setOtrasDelDia(choques);
      return;
    }
    setErrorNuevas("");
    setOcupado(true);
    const respuesta = await guardarEvaluaciones(equipoId, nuevas.test, { evaluaciones: listas.map((una) => una.evaluacion), reemplazar });
    if (falloDeRed(respuesta) && !reemplazar) {
      aLaEspera();
      return;
    }
    if (respuesta.sinFuncion) {
      if (!reemplazar) {
        await guardarDeAUna(listas);
        return;
      }
      setOcupado(false);
      setErrorNuevas(t("evaluaciones.error.faltaActualizacion"));
      return;
    }
    setOcupado(false);
    const borradas = new Set(respuesta.borradas);
    if (respuesta.evaluaciones.length || borradas.size) setEvaluaciones((previas) => [...previas.filter((una) => !borradas.has(una.id)), ...respuesta.evaluaciones]);
    // Otra persona cargó esos días mientras tanto: con lo de ahora se vuelve a revisar.
    if (respuesta.conOtras) {
      await cargar({ silencioso: true });
      setErrorNuevas(t("evaluaciones.mismoDia.cambiaronMientrasTanto"));
      return;
    }
    if (respuesta.error) {
      setErrorNuevas(t(respuesta.error));
      return;
    }
    setNuevas(null);
    const guardadas = plural("evaluaciones.varios.guardadas", respuesta.evaluaciones.length);
    setAviso(borradas.size ? `${guardadas} ${plural("evaluaciones.mismoDia.reemplazadas", borradas.size)}` : guardadas);
  };

  // «Ir a la Base»: lo cargado (o lo pegado) queda en espera y la Base se abre
  // con las evaluaciones que ya estaban (esos jugadores y esos días, con
  // filtros aparte de los de siempre).
  const nombresDe = (lista) => [...new Set(lista.map(nombreDe).filter(Boolean))];
  const verCargaEnLaBase = () => {
    const existentes = (otrasDelDia || []).flatMap((choque) => choque.existentes);
    setOtrasDelDia(null);
    setEnEspera({ tipo: "carga", carga: nuevas });
    setRevisar({ tipo: "carga", test: nuevas.test, fecha: nuevas.fecha, vez: Date.now(), filtros: { jugador: nombresDe(existentes), fecha: [fechaCorta(nuevas.fecha)] } });
    setTestId(nuevas.test);
    setImportando(false);
    setNuevas(null);
    setVista("base");
  };
  const verPegadoEnLaBase = ({ choques = [], espera }) => {
    const existentes = choques.flatMap((choque) => choque.existentes);
    setEnEspera({ tipo: "pegado", ...espera });
    setRevisar({ tipo: "pegado", test: test.id, vez: Date.now(), filtros: { jugador: nombresDe(existentes), fecha: [...new Set(existentes.map((una) => fechaCorta(una.fecha)))] } });
    setImportando(false);
  };
  // ---------------------------------------- La fila de espera, al subirla --

  // Al volver la señal se sube sola y avisa (Santiago, 21/10: «Lo sube sola y
  // avisa»). Las nuevas que chocan con otra del mismo jugador y día (con otros
  // datos) esperan y se pregunta, como al cargar («Espera y te pregunta»);
  // solas no se vuelven a intentar: conChocadas, cuando se pide. Devuelve si
  // subió (y se volvió a leer la base).
  const subir = async ({ conChocadas = false } = {}) => {
    const enviada = colaActual.current;
    if (subiendoAhora.current || !enviada.length || !equipoId || seFue) return false;
    if (!conChocadas && enviada.every((uno) => uno.chocan)) return false;
    subiendoAhora.current = true;
    setSubiendo(true);
    const leidas = await listarEvaluaciones(equipoId);
    if (leidas.error) {
      subiendoAhora.current = false;
      setSubiendo(false);
      return false;
    }
    const resultado = await subirLaEspera(enviada, {
      equipoId,
      servidor: leidas.evaluaciones,
      funciones: { guardar: guardarEvaluaciones, crear: crearEvaluacion, cambiar: cambiarEvaluacion, actualizar: actualizarEvaluacion, borrar: borrarEvaluacion, referencia: cambiarReferencia },
      esDeRed: falloDeRed,
      conChocadas,
      conOtrosDatos,
    });
    // Lo que se hizo mientras subía queda para la próxima.
    ponerCola([...resultado.quedan, ...colaActual.current.filter((uno) => !enviada.includes(uno))]);
    const columnasPisadas = resultado.pisadas.map((pisada) => {
      const suya = enviada.find((uno) => uno.id === pisada.id);
      const deLaBase = leidas.evaluaciones.find((una) => una.id === pisada.id);
      return nombreDeLaClave(testDe(deLaBase?.test || suya?.test) || test, pisada.clave);
    });
    const partes = [
      resultado.subidos ? plural("sinSenal.subidos", resultado.subidos) : "",
      columnasPisadas.length ? t("evaluaciones.cambios.pisadas", { columnas: enLista([...new Set(columnasPisadas)]) }) : "",
      resultado.borradasPorOtra ? plural("evaluaciones.espera.borradas", resultado.borradasPorOtra) : "",
      resultado.errores.length ? plural("sinSenal.noSubieron", resultado.errores.length, { error: t(resultado.errores[0]) }) : "",
    ].filter(Boolean);
    if (partes.length) setAviso(partes.join(" "));
    if (resultado.chocadas.length) setChocadas(resultado.chocadas);
    await cargar({ silencioso: true });
    subiendoAhora.current = false;
    setSubiendo(false);
    return true;
  };
  const subirAlVolver = useRef(subir);
  subirAlVolver.current = subir;
  // Con señal y algo esperando, se sube: al volver la señal, al abrir y, si
  // la señal anda a medias, cada medio minuto.
  const pendientes = cola.filter((uno) => !uno.chocan).length;
  useEffect(() => {
    if (!enLinea || !pendientes || seFue || cargando) return undefined;
    const ya = setTimeout(() => subirAlVolver.current(), deLaCopia ? 0 : 1500);
    const otraVez = setInterval(() => subirAlVolver.current(), 30000);
    return () => {
      clearTimeout(ya);
      clearInterval(otraVez);
    };
  }, [enLinea, pendientes, seFue, cargando, Boolean(deLaCopia)]); // eslint-disable-line react-hooks/exhaustive-deps

  // «Reemplazar y cargar»: las que chocaban se cargan y las otras de ese
  // jugador y ese día se borran (quedan en el historial).
  const reemplazarChocadas = async () => {
    const lista = chocadas || [];
    setChocadas(null);
    if (!lista.length) return;
    setOcupado(true);
    let reemplazadas = 0;
    let cargadas = 0;
    let falla = "";
    const subidas = new Set();
    for (const unTest of [...new Set(lista.map((una) => una.test))]) {
      const delTest = lista.filter((una) => una.test === unTest);
      // eslint-disable-next-line no-await-in-loop
      const respuesta = await guardarEvaluaciones(equipoId, unTest, { evaluaciones: delTest.map((una) => una.evaluacion), reemplazar: true });
      if (respuesta.error || respuesta.sinFuncion) {
        falla = falla || respuesta.error || "evaluaciones.error.faltaActualizacion";
        continue;
      }
      delTest.forEach((una) => subidas.add(una.id));
      cargadas += respuesta.evaluaciones.length;
      reemplazadas += respuesta.borradas.length;
    }
    ponerCola(colaActual.current.filter((uno) => !subidas.has(uno.id)));
    setOcupado(false);
    if (falla) setAviso(t(falla));
    else {
      const listo = plural("evaluaciones.varios.guardadas", cargadas);
      setAviso(reemplazadas ? `${listo} ${plural("evaluaciones.mismoDia.reemplazadas", reemplazadas)}` : listo);
    }
    if (revisar?.tipo === "espera") setRevisar(null);
    await cargar({ silencioso: true });
  };
  // «Ir a la Base»: esperan y la Base se abre con las de esos jugadores y
  // esos días (las que ya estaban y las que esperan, en su color).
  const verChocadasEnLaBase = () => {
    const lista = chocadas || [];
    setChocadas(null);
    if (!lista.length) return;
    const existentes = lista.flatMap((una) => una.existentes);
    setRevisar({
      tipo: "espera",
      test: lista[0].test,
      vez: Date.now(),
      filtros: { jugador: nombresDe([...existentes, ...lista.map((una) => una.evaluacion)]), fecha: [...new Set(existentes.map((una) => fechaCorta(una.fecha)))] },
    });
    setTestId(lista[0].test);
    setImportando(false);
    setVista("base");
  };

  // «Seguir»: vuelve a lo que espera, como estaba.
  const seguirConLoQueEspera = () => {
    setRevisar(null);
    if (enEspera?.tipo === "pegado") {
      setImportando(true);
      return;
    }
    if (enEspera?.tipo !== "carga") return;
    setErrorNuevas("");
    setNuevas(enEspera.carga);
    setEnEspera(null);
    setVista("cargar");
  };

  const selectorConHoja = ({ titulo: rotulo, opciones, valor, alElegir }) => {
    const elegida = opciones.find((una) => una.valor === valor);
    return (
      <button type="button" className="selector-hoja" aria-label={rotulo} onClick={() => setHojaSelector({ titulo: rotulo, opciones, valor, alElegir })}>
        <b>{elegida && elegida.valor !== "" ? elegida.etiqueta : rotulo}</b>
        <Icono nombre="flecha" size={15} />
      </button>
    );
  };

  // De quién es: no se cambia acá (se corrige en la Base). La carga nueva
  // elige a cada jugador en su fila (CargaPorJugador.jsx).
  const campoJugador = (carga) => {
    const rotulo = titulo(testDelFormulario, testDelFormulario.columnas.find((columna) => columna.tipo === "jugador") || { clave: "jugador", titulo: { "es-AR": "Jugador", "pt-BR": "Jogador" } });
    return (
      <div className="campo-inicio lesiones-campo-paso" key="jugador">
        <label>{rotulo}</label>
        <p className="evaluaciones-jugador-fijo">{jugadorDe(carga.jugador_id)?.nombre || carga.persona || "—"}</p>
      </div>
    );
  };

  const campoDelPaso = (columna, carga) => {
    const rotulo = titulo(testDelFormulario, columna);
    switch (columna.tipo) {
      case "fecha":
        return (
          <div className="campo-inicio lesiones-campo-paso" key={columna.clave}>
            <label>{rotulo}</label>
            <input type="date" value={carga.fecha || ""} max={hoyISO()} onChange={(evento) => cambiarFormulario({ fecha: evento.target.value || null })} />
          </div>
        );
      case "lista": {
        const opciones = opcionesDeColumna(testDelFormulario, columna);
        const valor = carga.datos?.[columna.clave] || null;
        return (
          <div className="campo-inicio lesiones-campo-paso" key={columna.clave}>
            <label>{rotulo}</label>
            {opciones.length <= MAXIMO_CHIPS ? (
              <div className="grilla-criterios lesiones-chips">
                {opciones.map((opcion) => (
                  <button
                    type="button"
                    key={opcion.valor}
                    className={`chip-criterio ${valor === opcion.valor ? "prendido" : ""}`}
                    aria-pressed={valor === opcion.valor}
                    onClick={() => cambiarDato(columna.clave, valor === opcion.valor ? null : opcion.valor)}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            ) : (
              selectorConHoja({
                titulo: rotulo,
                opciones: [{ valor: "", etiqueta: t("comun.sinDato") }, ...opciones],
                valor: valor || "",
                alElegir: (elegido) => cambiarDato(columna.clave, elegido || null),
              })
            )}
          </div>
        );
      }
      case "tiempo":
      case "numero":
        return (
          <div className="campo-inicio lesiones-campo-paso" key={columna.clave}>
            <label>{rotulo}</label>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={columna.tipo === "tiempo" ? "0:00" : undefined}
              value={carga.textos?.[columna.clave] ?? ""}
              onChange={(evento) => cambiarTexto(columna.clave, evento.target.value)}
            />
          </div>
        );
      case "texto":
        return (
          <div className="campo-inicio lesiones-campo-paso" key={columna.clave}>
            <label>{rotulo}</label>
            <textarea rows={3} value={carga.datos?.[columna.clave] || ""} onChange={(evento) => cambiarDato(columna.clave, evento.target.value)} />
          </div>
        );
      default:
        return null;
    }
  };

  const tituloDelPaso = (unPaso) => {
    if (unPaso.id === "quien") return t("evaluaciones.form.quien");
    if (unPaso.grupo) return tituloDeGrupo(testDelFormulario, testDelFormulario.grupos?.find((grupo) => grupo.clave === unPaso.grupo) || { clave: unPaso.grupo }, config, idioma);
    return t("evaluaciones.form.medidas");
  };

  // Los tests, si hay más de uno, en un desplegable: el elegido es el que se ve.
  const elegirTest = (elegido, alElegir) => <SelectorDeTest elegido={elegido} alElegir={alElegir} idioma={idioma} />;

  // Título a la izquierda y el idioma a la derecha, como en Lesiones.
  const encabezado = (textoTitulo, texto, hijos = null) => (
    <header className="encabezado lesiones-encabezado">
      <div className="lesiones-encabezado-texto">
        <h1>{textoTitulo}</h1>
        {texto && <p>{texto}</p>}
        {hijos}
      </div>
      <SelectorIdioma className="lesiones-idioma" />
    </header>
  );

  const pantallaFormulario = (carga) => {
    const total = pasos.length;
    const actual = pasos[Math.min(paso, total - 1)];
    const ultimo = paso === total - 1;
    return (
      <div className="app">
        <div className="contenedor">
          {encabezado(
            carga.id ? t("evaluaciones.form.editar") : t("evaluaciones.form.nueva"),
            [testDelFormulario.pestana[idioma], nombreDe(carga)].filter(Boolean).join(" · "),
            <>
              <div className="lesiones-progreso" role="tablist" aria-label={t("lesiones.pasos.paso", { n: paso + 1, total })}>
                {pasos.map((unPaso, indice) => (
                  <button
                    type="button"
                    role="tab"
                    key={unPaso.id}
                    aria-selected={indice === paso}
                    className={`${indice === paso ? "actual" : ""} ${indice < paso ? "hecho" : ""}`.trim()}
                    disabled={indice > pasoMaximo + 1}
                    onClick={() => irAlPaso(indice)}
                    aria-label={tituloDelPaso(unPaso)}
                  />
                ))}
              </div>
              <p className="lesiones-paso-numero">{t("lesiones.pasos.paso", { n: paso + 1, total })}</p>
            </>,
          )}

          <section className="lesiones-paso-titulo">
            <h2>{tituloDelPaso(actual)}</h2>
            {/* Cómo se escriben los tiempos, una vez por paso. */}
            {actual.columnas.some((clave) => testDelFormulario.columnas.find((columna) => columna.clave === clave)?.tipo === "tiempo") && <p>{t("evaluaciones.form.tiempoAyuda")}</p>}
          </section>

          {errorFormulario && <div className="aviso-hoja">{errorFormulario}</div>}

          <section className="tarjeta tarjeta-ficha lesiones-grupo">
            {actual.columnas.map((clave) => {
              if (clave === "jugador") return campoJugador(carga);
              const columna = testDelFormulario.columnas.find((una) => una.clave === clave);
              return columna ? campoDelPaso(columna, carga) : null;
            })}
          </section>

          <div className="acciones-dobles">
            <BotonVolver onClick={() => (paso === 0 ? cerrarFormulario() : irAlPaso(paso - 1))}>{paso === 0 ? t("comun.cancelar") : t("lesiones.pasos.atras")}</BotonVolver>
            {ultimo ? (
              <button type="button" className="boton-principal" onClick={guardarFormulario} disabled={ocupado}>
                {ocupado ? t("comun.guardando") : t("evaluaciones.form.guardar")}
              </button>
            ) : (
              <button type="button" className="boton-principal" onClick={() => irAlPaso(paso + 1)}>
                {t("lesiones.pasos.siguiente")}
              </button>
            )}
          </div>
          {carga.id && (
            <button type="button" className="lesiones-boton-borrar" disabled={ocupado} onClick={() => setABorrar([evaluaciones.find((una) => una.id === carga.id) || carga])}>
              <Icono nombre="borrar" size={16} />
              {t("evaluaciones.borrarEvaluacion")}
            </button>
          )}
        </div>
      </div>
    );
  };

  // ------------------------------------------------------------ Pantallas --

  const chocan = cola.filter((uno) => uno.chocan).length;
  const estado = deLaCopia ? (
    <AvisoDeEspera sinSenal guardadaEn={deLaCopia.guardadaEn} cuantos={cola.length} />
  ) : !enLinea && (error || cargando) ? (
    <p className="lesiones-estado">{t("evaluaciones.estado.sinConexion")}</p>
  ) : !enLinea ? (
    <AvisoDeEspera sinSenal cuantos={cola.length} />
  ) : error ? (
    <div className="lesiones-estado error">
      {t(error)}{" "}
      <button type="button" onClick={cargar}>
        {t("comun.reintentar")}
      </button>
    </div>
  ) : cargando ? (
    <p className="lesiones-estado">{t("evaluaciones.estado.cargando")}</p>
  ) : cola.length ? (
    <AvisoDeEspera cuantos={cola.length} chocan={chocan} subiendo={subiendo} alSubir={() => subir({ conChocadas: Boolean(chocan) })} />
  ) : null;

  const hoy = hoyISO();
  // Las de hoy, la última cargada arriba.
  const deHoy = evaluaciones.filter((evaluacion) => evaluacion.fecha === hoy).sort((a, b) => b.orden - a.orden);

  const tarjetaEvaluacion = (evaluacion) => {
    const suyo = testDe(evaluacion.test);
    const seleccion = evaluacion.datos?.seleccion ? opcionesDeLista(LISTA_SELECCION, config, idioma, { conOcultas: true }).find((una) => una.valor === evaluacion.datos.seleccion)?.etiqueta : "";
    return (
      <div className="registro-guardado lesiones-registro evaluaciones-registro" key={evaluacion.id}>
        <span className="cabecera-registro">
          <span className="fecha-registro">{evaluacion.fecha ? fechaCorta(evaluacion.fecha) : "—"}</span>
          {suyo && <span className="lesiones-caso">{suyo.pestana[idioma]}</span>}
        </span>
        <div className="lesiones-registro-cuerpo">
          <strong>{nombreDe(evaluacion) || "—"}</strong>
          <span>{seleccion || evaluacion.datos?.seleccion || ""}</span>
        </div>
        {!soloLectura && (
          <div className="acciones-registro">
            {/* Lo que no se carga a mano (Isocinecia) se corrige en la Base. */}
            {TESTS_QUE_SE_CARGAN.includes(suyo) && (
              <button type="button" className="boton-detalle" onClick={() => abrirEdicion(evaluacion)}>
                {t("evaluaciones.editar")}
              </button>
            )}
            <button type="button" className="boton-eliminar-registro" aria-label={t("evaluaciones.borrarEvaluacion")} onClick={() => setABorrar([evaluacion])}>
              <Icono nombre="borrar" size={16} />
            </button>
          </div>
        )}
      </div>
    );
  };

  const pantallaCargar = (
    <div className="app app-inicio">
      <div className="contenedor contenedor-inicio-formacion">
        <header className="hero-partido hero-lesiones">
          <div className="hero-lesiones-barra">
            {onVolver ? (
              <BotonModulos onClick={onVolver}>{t(volverA)}</BotonModulos>
            ) : (
              <span />
            )}
            <SelectorIdioma />
          </div>
          <div className="hero-lesiones-club">
            <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
            <span className="etiqueta-hero">{t("evaluaciones.titulo").toUpperCase()}</span>
            <strong className="nombre-sesion">{equipo?.nombre || t("evaluaciones.titulo")}</strong>
            <p className="fecha-hero">{primeraMayuscula(fechaLarga(hoy))}</p>
            <span className={`estado-hero ${deHoy.length ? "en-curso" : ""}`}>{plural("evaluaciones.deHoy", deHoy.length)}</span>
          </div>
        </header>

        <AvisoSoloLectura hasta={equipo?.hasta} mirar={mirar} modulo="evaluaciones" />
        {estado}

        {!soloLectura && (
          <div className="acciones-inicio lesiones-acciones">
            <button type="button" className="boton-principal boton-formacion-grande" onClick={abrirNueva} disabled={Boolean(error) || cargando}>
              {t("evaluaciones.nueva")}
            </button>
          </div>
        )}

        {!cargando && !error && deHoy.length === 0 && <p className="lesiones-vacio">{t("evaluaciones.sinHoy")}</p>}
        <div className="lesiones-lista">{deHoy.map(tarjetaEvaluacion)}</div>
      </div>
    </div>
  );

  // Un test sin valores de referencia (Estabilidad rotacional) no avisa que faltan.
  const sinReferencias = test.conReferencias !== false && !cargando && !error && !referencias;

  // Lo que se revisa («Ir a la Base»), si es de este test.
  const revisando = revisar && revisar.test === test.id ? revisar : null;

  const pantallaBase = (
    <div className="app">
      <div className="contenedor contenedor-base">
        <div className="evaluaciones-elegir">
          {elegirTest(test.id, (id) => {
            setTestId(id);
            setImportando(false);
          })}
          <SelectorDeVista test={test} elegida={vistaDeLaBase} alElegir={(vista) => setVistaPorTest((antes) => ({ ...antes, [test.id]: vista }))} idioma={idioma} />
        </div>
        {encabezado(test.titulo[idioma], test.nota[idioma])}
        <AvisoSoloLectura hasta={equipo?.hasta} mirar={mirar} modulo="evaluaciones" />
        {estado}
        {sinReferencias && <p className="lesiones-estado evaluaciones-sin-referencias">{t("evaluaciones.sinReferencias")}</p>}
        {!soloLectura && (
          <button type="button" className="boton-secundario datos-pegar-excel lesiones-pegar-excel" onClick={() => setImportando(true)} disabled={cargando || Boolean(error)}>
            <Icono nombre="documento" size={16} />
            {t("evaluaciones.importar.boton")}
          </button>
        )}
        {revisando && revisando.tipo === "espera" && (
          <div className="lesiones-estado evaluaciones-revisar" role="status">
            {t("evaluaciones.espera.enEsperaRevisar")}{" "}
            <button
              type="button"
              onClick={() => {
                setRevisar(null);
                subir({ conChocadas: true });
              }}
            >
              {t("evaluaciones.espera.subirLoQueEspera")}
            </button>{" "}
            <button type="button" onClick={() => setRevisar(null)}>
              {t("evaluaciones.mismoDia.verTodo")}
            </button>
          </div>
        )}
        {revisando && revisando.tipo !== "espera" && (
          <div className="lesiones-estado evaluaciones-revisar" role="status">
            {revisando.tipo === "carga" ? t("evaluaciones.mismoDia.enEsperaCarga", { fecha: fechaCorta(revisando.fecha) }) : t("evaluaciones.mismoDia.enEsperaPegado")}{" "}
            <button type="button" onClick={() => seguirConLoQueEspera()}>
              {t(revisando.tipo === "carga" ? "evaluaciones.mismoDia.seguirCarga" : "evaluaciones.mismoDia.seguirPegado")}
            </button>{" "}
            <button type="button" onClick={() => setRevisar(null)}>
              {t("evaluaciones.mismoDia.verTodo")}
            </button>
          </div>
        )}
        <section className="tarjeta evaluaciones-tabla">
          <TablaDatos
            key={revisando ? `revisar:${revisando.vez}:${test.id}-${vistaDeLaBase}` : `${test.id}-${vistaDeLaBase}`}
            id={`evaluaciones-${test.id}`}
            recordar={revisando ? `evaluaciones:revisar:${revisando.vez}` : `evaluaciones:${test.id}`}
            filtrosIniciales={revisando?.filtros || null}
            columnas={columnas}
            filas={filas}
            fijas={fijas}
            vista={informeYColores}
            onEditar={editarCelda}
            onPegar={pegarEnTabla}
            leyenda={t("datos.leyendaYaNoEsta")}
            rotuloApagada={t("datos.yaNoEsta")}
            leyendaEspera={t("sinSenal.leyendaEspera")}
            onBorrarFilas={
              soloLectura
                ? undefined
                : (ids) => {
                    const elegidas = evaluaciones.filter((una) => ids.includes(una.id));
                    if (elegidas.length) setABorrar(elegidas);
                  }
            }
          />
        </section>
      </div>
    </div>
  );

  // Los valores de referencia, como a la derecha de la hoja del Excel: un
  // bloque por categoría y el resumen. Se cambian ahí (Santiago, 14/10).
  const categoriasConOcultas = opcionesDeLista(LISTA_SELECCION, config, idioma, { conOcultas: true });
  const pantallaReferencias = (
    <ReferenciasEvaluaciones
      test={test}
      referencias={referencias}
      categorias={categorias}
      categoriasConOcultas={categoriasConOcultas}
      idioma={idioma}
      equipoId={equipoId}
      soloLectura={soloLectura}
      seFue={seFue}
      enLinea={enLinea}
      sinSenal={sinConexion}
      onAlAparato={(testId, ruta, valor) => {
        ponerCola(conReferencia(colaActual.current, { test: testId, ruta, valor }));
        return conValorEnRuta(referenciasPorTest[testId], ruta, valor);
      }}
      cargando={cargando}
      error={error}
      selector={elegirTest(test.id, setTestId)}
      encabezado={encabezado}
      arriba={
        <>
          <AvisoSoloLectura hasta={equipo?.hasta} mirar={mirar} modulo="evaluaciones" />
          {estado}
        </>
      }
      planilla={planillaDeVr}
      onCambiadas={(id, datos) => setReferenciasPorTest((antes) => ({ ...antes, [id]: datos }))}
      onRecargar={() => cargar({ silencioso: true })}
      onAviso={setAviso}
    />
  );

  // -------------------------------------------------------------- Ajustes --

  const guardarHojaCabecera = async () => {
    const hoja = hojaCabecera;
    if (!hoja) return;
    // Una relativa no guarda nombre propio (sale del de su absoluta).
    if (!hoja.relativa && !String(hoja.etiquetas[idioma] || "").trim()) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    setOcupado(true);
    const respuesta = await guardarCabecera(equipoId, hoja.test, hoja.clave, hoja.relativa ? { ...hoja, etiquetas: {} } : hoja);
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    await cargar();
    setHojaCabecera(null);
    setAviso(t("lesiones.ajustes.guardado"));
  };

  const guardarHojaOpcion = async () => {
    const hoja = hojaOpcion;
    if (!hoja) return;
    const propio = String(hoja.etiquetas[idioma] || "").trim();
    if (!propio) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    setOcupado(true);
    const respuesta = await guardarOpcionDeLista(equipoId, hoja.lista, { ...hoja, codigo: hoja.codigo || codigoNuevo(propio) });
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    await cargar();
    setHojaOpcion(null);
    setAviso(t("lesiones.ajustes.guardado"));
  };

  const filaAjuste = ({ id, icono, titulo: rotulo, detalle, alTocar, extra = null, clase = "" }) => (
    <button key={id} type="button" className={`opcion-ajuste ${clase}`.trim()} onClick={alTocar} disabled={soloLectura || sinConexion}>
      {icono && (
        <span className="icono-ajuste">
          <Icono nombre={icono} size={18} />
        </span>
      )}
      <span className="texto-ajuste">
        <b>{rotulo}</b>
        <span>{detalle}</span>
      </span>
      {extra}
      <span className="flecha-ajuste">›</span>
    </button>
  );

  // Las listas de los tests, una vez cada una. Selección ya no está: son las
  // categorías de Datos básicos y se cambian allá (Santiago, 18/10: «La lista
  // «Selección»», «La de Datos básicos»).
  const LISTAS = useMemo(() => {
    const listas = [];
    TESTS.forEach((uno) =>
      uno.columnas
        .filter((columna) => columna.tipo === "lista" && listaDeColumna(columna) !== LISTA_SELECCION)
        .forEach((columna) => {
          if (!listas.some((lista) => lista.clave === listaDeColumna(columna))) listas.push({ clave: listaDeColumna(columna), test: uno, columna });
        }),
    );
    return listas;
  }, []);
  // El nombre de una lista: el que le da el test (si la usan varias columnas,
  // como Cifosis en Estabilidad rotacional) o el de su primera columna.
  const tituloDeLista = (lista) => lista.test?.titulosDeListas?.[lista.clave]?.[idioma] || (lista.columna ? titulo(lista.test || TESTS[0], lista.columna) : lista.clave);

  const pantallaAjustes = () => {
    if (vistaAjustes === "cabeceras") {
      // Por test: cada bloque (si tiene) y sus columnas.
      const columnasDelTest = test.columnas;
      return (
        <div className="app">
          <div className="contenedor">
            {encabezado(t("lesiones.ajustes.cabeceras"), t("evaluaciones.ajustes.cabecerasAyuda"))}
            {elegirTest(test.id, setTestId)}
            <div className="lista-opciones">
              {columnasDelTest.map((columna, indice) => {
                const grupo = columna.grupo && columnasDelTest[indice - 1]?.grupo !== columna.grupo ? test.grupos?.find((uno) => uno.clave === columna.grupo) || { clave: columna.grupo } : null;
                const propio = config.campos?.[test.id]?.[columna.clave];
                const absoluta = absolutaDe(test, columna);
                const relativa = absoluta ? { absoluta: titulo(test, absoluta), sufijo: columna.relativa.sufijo, nombre: titulo(test, columna) } : null;
                return (
                  <React.Fragment key={columna.clave}>
                    {grupo &&
                      filaAjuste({
                        id: claveDeGrupo(grupo.clave),
                        clase: "lesiones-ajuste-grupo",
                        titulo: tituloDeGrupo(test, grupo, config, idioma),
                        detalle: plural("lesiones.ajustes.grupoDe", columnasDelTest.filter((una) => una.grupo === grupo.clave).length),
                        alTocar: () => {
                          setErrorHoja("");
                          const guardado = config.campos?.[test.id]?.[claveDeGrupo(grupo.clave)];
                          setHojaCabecera({
                            test: test.id,
                            clave: claveDeGrupo(grupo.clave),
                            grupo,
                            etiquetas: { ...(guardado?.etiquetas || grupo.titulo || {}) },
                            oculto: false,
                            orden: guardado?.orden ?? 1000 + indice,
                          });
                        },
                      })}
                    {filaAjuste({
                      id: columna.clave,
                      titulo: titulo(test, columna),
                      detalle: relativa ? t("lesiones.ajustes.relativa", relativa) : t("lesiones.ajustes.porDefecto", { texto: columna.titulo[idioma] || columna.titulo["es-AR"] }),
                      extra: columnaOculta(test, columna.clave, config) ? <span className="lesiones-oculta">{t("lesiones.ajustes.oculto")}</span> : null,
                      alTocar: () => {
                        setErrorHoja("");
                        setHojaCabecera({
                          test: test.id,
                          clave: columna.clave,
                          etiquetas: { ...(propio?.etiquetas && Object.values(propio.etiquetas).some(Boolean) ? propio.etiquetas : columna.titulo) },
                          oculto: Boolean(propio?.oculto),
                          orden: propio?.orden ?? indice,
                          relativa,
                          // «Para los V.R.»: en las de números y tiempos, con la base al día.
                          sentido: conSentidoEvaluaciones(test, columna) && !filasAjustes.sinSentido ? sentidoDe(propio?.sentido, columna.clave) : null,
                        });
                      },
                    })}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="acciones-dobles">
              <BotonVolver onClick={() => setVistaAjustes("inicio")}>{t("lesiones.ajustes.volver")}</BotonVolver>
            </div>
          </div>
        </div>
      );
    }

    if (vistaAjustes.startsWith("lista:")) {
      const clave = vistaAjustes.slice("lista:".length);
      const lista = LISTAS.find((una) => una.clave === clave);
      const todas = opcionesDeLista(clave, config, idioma, { test: lista?.test, conOcultas: true });
      const abrirOpcion = (opcion) => {
        setErrorHoja("");
        const guardada = (config.listas?.[clave] || []).find((una) => una.codigo === opcion?.valor);
        const delExcel = opcion?.delExcel ? opcionesDelExcel(clave, lista?.test).find((una) => una.codigo === opcion.valor) : null;
        const conNombre = guardada?.etiquetas && Object.values(guardada.etiquetas).some((texto) => String(texto || "").trim());
        setHojaOpcion({
          lista: clave,
          codigo: opcion?.valor || null,
          // Una del Excel sin nombre propio: se ve el del Excel, para cambiarlo.
          etiquetas: { ...(conNombre ? guardada.etiquetas : delExcel?.etiquetas || { "es-AR": "", "pt-BR": "" }) },
          oculto: Boolean(opcion?.oculto),
          orden: guardada?.orden ?? (opcion ? todas.findIndex((una) => una.valor === opcion.valor) : todas.length),
        });
      };
      return (
        <div className="app">
          <div className="contenedor">
            {encabezado(lista ? tituloDeLista(lista) : clave, plural("lesiones.ajustes.opciones", todas.length))}
            <div className="lista-opciones">
              {todas.map((opcion) =>
                filaAjuste({
                  id: opcion.valor,
                  titulo: opcion.etiqueta,
                  detalle: opcion.oculto ? t("lesiones.ajustes.oculto") : t("lesiones.ajustes.mostrar"),
                  extra: opcion.oculto ? <span className="lesiones-oculta">{t("lesiones.ajustes.oculto")}</span> : null,
                  alTocar: () => abrirOpcion(opcion),
                }),
              )}
            </div>
            <div className="acciones-dobles">
              <BotonVolver onClick={() => setVistaAjustes("listas")}>{t("lesiones.ajustes.volverListas")}</BotonVolver>
              <button type="button" className="boton-principal" onClick={() => abrirOpcion(null)} disabled={soloLectura || sinConexion}>
                {t("lesiones.ajustes.nuevaOpcion")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (vistaAjustes === "listas") {
      // Primero el test, como en Cabeceras, y solo los que tienen listas
      // (Santiago, 18/10: «Sí, elegir el test», «Solo los que tienen listas»).
      const testDeListas = TESTS_CON_LISTAS.includes(test) ? test : TESTS_CON_LISTAS[0];
      const suyas = LISTAS.filter((lista) => testDeListas.columnas.some((columna) => columna.tipo === "lista" && listaDeColumna(columna) === lista.clave));
      return (
        <div className="app">
          <div className="contenedor">
            {encabezado(t("lesiones.ajustes.listas"), t("evaluaciones.ajustes.listasAyuda"))}
            <SelectorDeTest tests={TESTS_CON_LISTAS} elegido={testDeListas.id} alElegir={setTestId} idioma={idioma} />
            <div className="lista-opciones">
              {suyas.map((lista) =>
                filaAjuste({
                  id: lista.clave,
                  titulo: tituloDeLista(lista),
                  detalle: plural("lesiones.ajustes.opciones", opcionesDeLista(lista.clave, config, idioma, { test: lista.test }).length),
                  alTocar: () => setVistaAjustes(`lista:${lista.clave}`),
                }),
              )}
            </div>
            <div className="acciones-dobles">
              <BotonVolver onClick={() => setVistaAjustes("inicio")}>{t("lesiones.ajustes.volver")}</BotonVolver>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="app">
        <div className="contenedor">
          {encabezado(t("lesiones.ajustes.titulo"), t("evaluaciones.ajustes.texto"))}
          <AvisoSoloLectura hasta={equipo?.hasta} mirar={mirar} modulo="evaluaciones" />
          {/* Los Ajustes, solo con señal (Santiago, 20/10: «Sí, con señal»). */}
          {sinConexion && !soloLectura && <p className="lesiones-estado">{t("sinSenal.ajustesConSenal")}</p>}
          <div className="lista-opciones">
            {filaAjuste({
              id: "cabeceras",
              icono: "documento",
              titulo: t("lesiones.ajustes.cabeceras"),
              detalle: t("evaluaciones.ajustes.cabecerasTexto"),
              alTocar: () => setVistaAjustes("cabeceras"),
            })}
            {filaAjuste({
              id: "listas",
              icono: "filtro",
              titulo: t("lesiones.ajustes.listas"),
              detalle: t("lesiones.ajustes.listasTexto"),
              alTocar: () => setVistaAjustes("listas"),
            })}
          </div>
        </div>
      </div>
    );
  };

  // Cabeceras y opciones se renombran en el idioma que se está usando; el
  // otro idioma guarda lo que tenía.
  const hojaDeTextos = ({ abierta, titulo: rotulo, hoja, setHoja, onGuardar, onCerrar, fija = false, nota = "" }) =>
    hoja ? (
      <HojaInferior
        abierta={abierta}
        className="lesiones-hoja"
        titulo={rotulo}
        onCerrar={onCerrar}
        acciones={
          <>
            <button type="button" className="boton-cancelar-hoja" onClick={onCerrar} disabled={ocupado}>
              {t("comun.cancelar")}
            </button>
            <button type="button" className="boton-confirmar-hoja" onClick={onGuardar} disabled={ocupado}>
              {ocupado ? t("comun.guardando") : t("comun.guardar")}
            </button>
          </>
        }
      >
        {errorHoja && <div className="aviso-hoja">{errorHoja}</div>}
        <div className="campo-inicio">
          <label>{t("lesiones.ajustes.nombre")}</label>
          {hoja.relativa ? (
            <>
              <input type="text" value={hoja.relativa.nombre} readOnly disabled />
              <small className="lesiones-ayuda">{t("lesiones.ajustes.relativaAyuda", hoja.relativa)}</small>
            </>
          ) : (
            <>
              <input type="text" maxLength={120} value={hoja.etiquetas[idioma] || ""} onChange={(evento) => setHoja({ ...hoja, etiquetas: { ...hoja.etiquetas, [idioma]: evento.target.value } })} />
              <small className="lesiones-ayuda">{t("lesiones.ajustes.nombreAyuda")}</small>
            </>
          )}
        </div>
        {nota ? (
          <p className="lesiones-ayuda lesiones-nota-fija">{nota}</p>
        ) : fija ? (
          <p className="lesiones-ayuda lesiones-nota-fija">{t("evaluaciones.ajustes.noSeOculta")}</p>
        ) : (
          <div className="grilla-criterios">
            <button type="button" className={`chip-criterio ${!hoja.oculto ? "prendido" : ""}`} aria-pressed={!hoja.oculto} onClick={() => setHoja({ ...hoja, oculto: false })}>
              {t("lesiones.ajustes.mostrar")}
            </button>
            <button type="button" className={`chip-criterio ${hoja.oculto ? "prendido" : ""}`} aria-pressed={hoja.oculto} onClick={() => setHoja({ ...hoja, oculto: true })}>
              {t("lesiones.ajustes.oculto")}
            </button>
          </div>
        )}
        {hoja.sentido && <SentidoParaVr valor={hoja.sentido} onCambiar={(sentido) => setHoja({ ...hoja, sentido })} />}
      </HojaInferior>
    ) : null;

  // --------------------------------------------------------- Navegación --

  let contenido;
  if (formulario) contenido = pantallaFormulario(formulario);
  else if (nuevas)
    contenido = (
      <CargaPorJugador
        carga={nuevas}
        setCarga={setNuevas}
        tests={TESTS_QUE_SE_CARGAN}
        columnas={columnasDeNuevas.columnas}
        comunes={columnasDeNuevas.comunes}
        config={config}
        plantel={plantel}
        encabezado={encabezado}
        error={errorNuevas}
        setError={setErrorNuevas}
        ocupado={ocupado}
        onCancelar={() => (hayAlgoCargado(nuevas) ? setASalir("cargar") : setNuevas(null))}
        onGuardar={() => guardarNuevas()}
      />
    );
  else if (vista === "base")
    contenido =
      importando && !soloLectura ? (
        <ImportarEvaluaciones
          test={test}
          config={config}
          equipoId={equipoId}
          plantel={plantel}
          plantelSinLeer={plantelSinLeer}
          evaluaciones={delTest}
          enEspera={enEspera?.tipo === "pegado" ? enEspera : null}
          onVolver={() => {
            setImportando(false);
            if (enEspera?.tipo === "pegado") setEnEspera(null);
            if (revisar?.tipo === "pegado") setRevisar(null);
          }}
          onRecargar={cargar}
          // Las cargadas quedan en la lista antes de recargar (y las
          // reemplazadas salen): si la recarga falla, al reintentar se ven
          // como "Ya está" y no se duplican.
          onGuardadas={(nuevas, borradas = []) =>
            setEvaluaciones((previas) => {
              const fuera = new Set(borradas);
              const quedan = previas.filter((una) => !fuera.has(una.id));
              const yaEstan = new Set(quedan.map((una) => una.id));
              return [...quedan, ...nuevas.filter((una) => !yaEstan.has(una.id))];
            })
          }
          onVerEnLaBase={verPegadoEnLaBase}
          sinSenal={sinConexion}
          onAlAparato={(lista) => {
            const nuevaCola = conCreadas(colaActual.current, test.id, lista);
            ponerCola(nuevaCola);
            setEvaluaciones((previas) => conLoQueEspera({ evaluaciones: previas }, nuevaCola).evaluaciones);
          }}
          onListo={({ cargadas, reemplazadas = 0, alAparato = 0 }) => {
            setImportando(false);
            if (enEspera?.tipo === "pegado") setEnEspera(null);
            if (revisar?.tipo === "pegado") setRevisar(null);
            if (alAparato) {
              setAviso(plural("sinSenal.quedaronEnElAparato", alAparato));
              return;
            }
            const listo = plural("evaluaciones.importar.listo", cargadas);
            setAviso(reemplazadas ? `${listo} ${plural("evaluaciones.mismoDia.reemplazadas", reemplazadas)}` : listo);
          }}
        />
      ) : (
        pantallaBase
      );
  else if (vista === "reportes")
    contenido = (
      <ReportesEvaluaciones
        evaluaciones={evaluaciones}
        referenciasPorTest={referenciasPorTest}
        plantel={plantel}
        config={config}
        equipo={equipo}
        hoy={hoy}
        estado={
          <>
            <AvisoSoloLectura hasta={equipo?.hasta} mirar={mirar} modulo="evaluaciones" />
            {estado}
          </>
        }
        datosListos={!cargando && !error}
      />
    );
  else if (vista === "referencias") contenido = pantallaReferencias;
  else if (vista === "ajustes") contenido = pantallaAjustes();
  else contenido = pantallaCargar;

  // Tocar un destino de la barra cierra lo que estuviera encima.
  const irA = (id) => {
    setFormulario(null);
    setNuevas(null);
    setImportando(false);
    if (id === "ajustes") setVistaAjustes("inicio");
    setVista(id);
  };
  // Una carga con algo sin guardar no se tira sin preguntar.
  const navegar = (id) => {
    if ((formulario && sinVacios(formulario) !== sinVacios(formularioAlAbrir.current)) || hayAlgoCargado(nuevas)) {
      setASalir(id);
      return;
    }
    irA(id);
  };

  const columnaDeLaHoja = hojaCabecera && !hojaCabecera.grupo ? testDe(hojaCabecera.test)?.columnas.find((columna) => columna.clave === hojaCabecera.clave) : null;

  return (
    <MarcoAplicacion activo={vista} onNavigate={navegar} destinos={DESTINOS_EVALUACIONES} marca={t("evaluaciones.titulo")} className="entrenamiento-marco lesiones-marco evaluaciones-marco">
      {contenido}

      {aviso && (
        <div className="lesiones-toast" role="status">
          {aviso}
        </div>
      )}

      <HojaOpciones
        abierta={Boolean(hojaSelector)}
        titulo={hojaSelector?.titulo || ""}
        opciones={hojaSelector?.opciones || []}
        elegida={hojaSelector?.valor ?? null}
        buscador={(hojaSelector?.opciones?.length || 0) > 8}
        onElegir={(valor) => {
          hojaSelector?.alElegir(valor);
          setHojaSelector(null);
        }}
        onCerrar={() => setHojaSelector(null)}
      />

      {hojaDeTextos({
        abierta: Boolean(hojaCabecera),
        titulo: !hojaCabecera
          ? ""
          : hojaCabecera.grupo
            ? `${t("lesiones.ajustes.editarGrupo")}: ${tituloDeGrupo(testDe(hojaCabecera.test), hojaCabecera.grupo, config, idioma)}`
            : `${t("lesiones.ajustes.editarCabecera")}: ${columnaDeLaHoja ? titulo(testDe(hojaCabecera.test), columnaDeLaHoja) : hojaCabecera.clave}`,
        hoja: hojaCabecera,
        setHoja: setHojaCabecera,
        onGuardar: guardarHojaCabecera,
        onCerrar: () => !ocupado && setHojaCabecera(null),
        fija: Boolean(hojaCabecera && COLUMNAS_FIJAS.includes(hojaCabecera.clave)),
        // Un bloque no se esconde: se esconden sus columnas.
        nota: hojaCabecera?.grupo ? t("evaluaciones.ajustes.grupoAyuda") : "",
      })}

      {hojaDeTextos({
        abierta: Boolean(hojaOpcion),
        titulo: hojaOpcion ? (hojaOpcion.codigo ? `${t("lesiones.ajustes.editarOpcion")}: ${tituloDeLista(LISTAS.find((lista) => lista.clave === hojaOpcion.lista) || { clave: hojaOpcion.lista })}` : t("lesiones.ajustes.nuevaOpcion")) : "",
        hoja: hojaOpcion,
        setHoja: setHojaOpcion,
        onGuardar: guardarHojaOpcion,
        onCerrar: () => !ocupado && setHojaOpcion(null),
      })}

      <HojaConfirmar
        abierta={Boolean(aBorrar?.length)}
        titulo={aBorrar?.length > 1 ? t("evaluaciones.borrarVariasTitulo", { n: aBorrar.length }) : t("evaluaciones.borrarTitulo")}
        descripcion={
          aBorrar?.length > 1
            ? t("evaluaciones.borrarVariasTexto", { n: aBorrar.length })
            : t("evaluaciones.borrarTexto", { jugador: nombreDe(aBorrar?.[0]), fecha: aBorrar?.[0]?.fecha ? fechaCorta(aBorrar[0].fecha) : t("evaluaciones.sinFecha") })
        }
        icono="borrar"
        etiquetaConfirmar={t("evaluaciones.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBorrar}
        onCancelar={() => setABorrar(null)}
      />

      <HojaConfirmar
        abierta={Boolean(otrasDelDia)}
        icono="refrescar"
        titulo={t("evaluaciones.mismoDia.titulo")}
        descripcion={plural("evaluaciones.mismoDia.carga", otrasDelDia?.length || 0, {
          test: testDeNuevas?.pestana[idioma] || "",
          fecha: nuevas?.fecha ? fechaCorta(nuevas.fecha) : "",
        })}
        detalle={
          <div className="evaluaciones-mismo-dia">
            <ul className="consentimiento-personas">
              {(otrasDelDia || []).slice(0, A_LA_VISTA).map(({ evaluacion }, i) => (
                <li key={`${evaluacion.jugador_id || evaluacion.persona}-${i}`}>{nombreDe(evaluacion)}</li>
              ))}
            </ul>
            {(otrasDelDia?.length || 0) > A_LA_VISTA && <p>{plural("evaluaciones.mismoDia.yMas", otrasDelDia.length - A_LA_VISTA)}</p>}
            <p>{t("evaluaciones.mismoDia.queHaceCarga")}</p>
          </div>
        }
        etiquetaCancelar={t("evaluaciones.mismoDia.irALaBase")}
        etiquetaConfirmar={t("evaluaciones.mismoDia.reemplazar")}
        onCancelar={verCargaEnLaBase}
        onConfirmar={() => guardarNuevas({ reemplazar: true })}
        onCerrar={() => setOtrasDelDia(null)}
      />

      {/* Lo cargado sin señal que choca con otra que cargó otra persona
          (Santiago, 21/10: «Espera y te pregunta»): la misma hoja. */}
      <HojaConfirmar
        abierta={Boolean(chocadas)}
        icono="refrescar"
        titulo={t("evaluaciones.mismoDia.titulo")}
        descripcion={plural("evaluaciones.espera.choques", chocadas?.length || 0)}
        detalle={
          <div className="evaluaciones-mismo-dia">
            <ul className="consentimiento-personas">
              {(chocadas || []).slice(0, A_LA_VISTA).map((una) => (
                <li key={una.id}>{[una.evaluacion.fecha ? fechaCorta(una.evaluacion.fecha) : "", nombreDe(una.evaluacion), testDe(una.test)?.pestana[idioma] || ""].filter(Boolean).join(" · ")}</li>
              ))}
            </ul>
            {(chocadas?.length || 0) > A_LA_VISTA && <p>{plural("evaluaciones.mismoDia.yMas", chocadas.length - A_LA_VISTA)}</p>}
            <p>{t("evaluaciones.espera.queHace")}</p>
          </div>
        }
        etiquetaCancelar={t("evaluaciones.mismoDia.irALaBase")}
        etiquetaConfirmar={t("evaluaciones.mismoDia.reemplazar")}
        onCancelar={verChocadasEnLaBase}
        onConfirmar={reemplazarChocadas}
        onCerrar={() => setChocadas(null)}
      />

      <HojaConfirmar
        abierta={Boolean(aSalir)}
        titulo={t("evaluaciones.form.salirTitulo")}
        descripcion={t("evaluaciones.form.salirTexto")}
        icono="salir"
        etiquetaConfirmar={t("lesiones.siSalir")}
        etiquetaCancelar={t("lesiones.seguirCargando")}
        onConfirmar={() => {
          const destino = aSalir;
          setASalir(null);
          irA(destino);
        }}
        onCancelar={() => setASalir(null)}
      />
    </MarcoAplicacion>
  );
}
