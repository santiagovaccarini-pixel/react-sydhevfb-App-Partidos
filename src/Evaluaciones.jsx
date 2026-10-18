import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEnVivo } from "./domain/enVivo.js";
import { Icono, MarcoAplicacion } from "./components/AppChrome";
import BotonModulos from "./components/BotonModulos.jsx";
import { EscudoDeClub } from "./components/ClubCrest";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { TablaDatos } from "./components/TablaDatos.jsx";
import { AvisoSoloLectura } from "./components/SoloLectura.jsx";
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
import { TESTS } from "./domain/evaluaciones/tests/index.js";
import {
  actualizarEvaluacion,
  borrarEvaluacion,
  crearEvaluacion,
  guardarCabecera,
  guardarOpcionDeLista,
  leerAjustes,
  leerCategorias,
  leerReferencias,
  listarEvaluaciones,
} from "./domain/evaluacionesDb.js";
import { cargarEquipos, elegirEquipoInicial, guardarEquipoElegido, leerEquipoElegido, soloParaMirar } from "./domain/equipo.js";
import { cargarPlantelLesiones } from "./domain/lesionesDb.js";
import { actualesPrimero, esActual } from "./domain/plantel.js";
import { interpretarMinutos, textoDeMinutos } from "./domain/tabla.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, fechaLarga, hoyISO } from "./idioma/formatos.js";
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
  const soloLectura = seFue || mirar;

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
    if (silencioso) {
      if (!respuestaPlantel.error && !respuestaPlantel.deRespaldo) setPlantel(respuestaPlantel.plantel || []);
      if (!respuestaEvaluaciones.error) setEvaluaciones(respuestaEvaluaciones.evaluaciones);
      if (!respuestaReferencias.error) setReferenciasPorTest(respuestaReferencias.referencias || {});
      if (!respuestaAjustes.error) setFilasAjustes({ campos: respuestaAjustes.campos, opciones: respuestaAjustes.opciones });
      if (!respuestaCategorias.error) setFilasCategorias(respuestaCategorias.filas);
      return;
    }
    setPlantel(respuestaPlantel.plantel || []);
    setPlantelSinLeer(Boolean(respuestaPlantel.error || respuestaPlantel.deRespaldo));
    if (respuestaEvaluaciones.error || respuestaReferencias.error) {
      setError(respuestaEvaluaciones.error || respuestaReferencias.error);
    } else {
      setEvaluaciones(respuestaEvaluaciones.evaluaciones);
      setReferenciasPorTest(respuestaReferencias.referencias || {});
    }
    // Sin poder leer los Ajustes, siguen los nombres del Excel.
    if (!respuestaAjustes.error) setFilasAjustes({ campos: respuestaAjustes.campos, opciones: respuestaAjustes.opciones });
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

  // Cómo se ve cada celda (como en el Excel, con su formato) y qué se edita.
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
        };
      }),
    [calculadas, test, visibles, jugadorDe, config, idioma],
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
  const guardarFila = (id, cambiar) => {
    const unPaso = async () => {
      const evaluacion = ultimas.current.find((una) => una.id === id);
      if (!evaluacion) return { error: "evaluaciones.error.noGuardar" };
      const { evaluacion: nueva, error: falta } = cambiar(evaluacion);
      if (falta) return { error: falta };
      if (!nueva) return {};
      const respuesta = await actualizarEvaluacion(id, nueva);
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
    for (const evaluacion of elegidas) {
      const respuesta = await borrarEvaluacion(evaluacion.id);
      if (respuesta.error) falla = falla || respuesta.error;
      else borradas.push(evaluacion.id);
    }
    setOcupado(false);
    setEvaluaciones((previas) => previas.filter((una) => !borradas.includes(una.id)));
    if (formulario?.id && borradas.includes(formulario.id)) cerrarFormulario();
    if (falla) setAviso(elegidas.length === 1 ? t(falla) : `${t(falla)} ${t("tabla.borradasDe", { n: borradas.length, total: elegidas.length })}`);
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
    const respuesta = carga.id ? await actualizarEvaluacion(carga.id, evaluacion) : await crearEvaluacion(equipoId, carga.test, evaluacion);
    setOcupado(false);
    if (respuesta.error) {
      setErrorFormulario(t(respuesta.error));
      return;
    }
    if (carga.id) reemplazar(respuesta.evaluacion);
    else setEvaluaciones((previas) => [...previas, respuesta.evaluacion]);
    cerrarFormulario();
    setAviso(t("evaluaciones.guardada"));
  };

  const testDeNuevas = nuevas ? testDe(nuevas.test) || TESTS_QUE_SE_CARGAN[0] : null;
  const columnasDeNuevas = useMemo(() => (testDeNuevas ? columnasDeLaCarga(testDeNuevas, config) : null), [testDeNuevas, config]);

  // Una evaluación por fila con algo cargado, de a una. Si una no se puede,
  // las guardadas salen de la carga (al reintentar no se repiten).
  const guardarNuevas = async () => {
    const { evaluaciones: listas, error: falta } = evaluacionesDeLaCarga(nuevas, {
      columnas: columnasDeNuevas.columnas,
      nombreDe: (id) => jugadorDe(id)?.nombre || "",
      titulo: (columna) => titulo(testDeNuevas, columna),
    });
    if (falta) {
      setErrorNuevas(falta);
      return;
    }
    setErrorNuevas("");
    setOcupado(true);
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

  const estado = !enLinea ? (
    <p className="lesiones-estado">{t("evaluaciones.estado.sinConexion")}</p>
  ) : error ? (
    <div className="lesiones-estado error">
      {t(error)}{" "}
      <button type="button" onClick={cargar}>
        {t("comun.reintentar")}
      </button>
    </div>
  ) : cargando ? (
    <p className="lesiones-estado">{t("evaluaciones.estado.cargando")}</p>
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
            <button type="button" className="boton-principal boton-formacion-grande" onClick={abrirNueva} disabled={!enLinea || Boolean(error) || cargando}>
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
          <button type="button" className="boton-secundario datos-pegar-excel lesiones-pegar-excel" onClick={() => setImportando(true)} disabled={!enLinea || cargando || Boolean(error)}>
            <Icono nombre="documento" size={16} />
            {t("evaluaciones.importar.boton")}
          </button>
        )}
        <section className="tarjeta evaluaciones-tabla">
          <TablaDatos
            key={`${test.id}-${vistaDeLaBase}`}
            id={`evaluaciones-${test.id}`}
            recordar={`evaluaciones:${test.id}`}
            columnas={columnas}
            filas={filas}
            fijas={fijas}
            vista={informeYColores}
            onEditar={editarCelda}
            onPegar={pegarEnTabla}
            leyenda={t("datos.leyendaYaNoEsta")}
            rotuloApagada={t("datos.yaNoEsta")}
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
    <button key={id} type="button" className={`opcion-ajuste ${clase}`.trim()} onClick={alTocar} disabled={soloLectura}>
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
              <button type="button" className="boton-principal" onClick={() => abrirOpcion(null)} disabled={soloLectura}>
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
        onGuardar={guardarNuevas}
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
          onVolver={() => setImportando(false)}
          onRecargar={cargar}
          // Las cargadas quedan en la lista antes de recargar: si la recarga
          // falla, al reintentar se ven como "Ya está" y no se duplican.
          onGuardadas={(nuevas) =>
            setEvaluaciones((previas) => {
              const yaEstan = new Set(previas.map((una) => una.id));
              return [...previas, ...nuevas.filter((una) => !yaEstan.has(una.id))];
            })
          }
          onListo={({ cargadas }) => {
            setImportando(false);
            setAviso(plural("evaluaciones.importar.listo", cargadas));
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
