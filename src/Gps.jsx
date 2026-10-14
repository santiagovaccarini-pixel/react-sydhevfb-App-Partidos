import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEnVivo } from "./domain/enVivo.js";
import { Icono, MarcoAplicacion } from "./components/AppChrome";
import { EscudoDeClub } from "./components/ClubCrest";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { TablaDatos } from "./components/TablaDatos.jsx";
import { AvisoSoloLectura } from "./components/SoloLectura.jsx";
import ImportarGps from "./ImportarGps.jsx";
import CargarGps from "./CargarGps.jsx";
import { ListaParaMarcar } from "./components/ListaParaMarcar.jsx";
import { BotonGuia, GuiaDelModulo, OfrecerGuia, TerminoDe, useGuiaDelModulo } from "./components/Guia.jsx";
import { COLUMNAS_FIJAS, absolutaDe, codigoNuevo, columnaOculta, columnasVisibles, opcionesDeLista, opcionesDelExcel, tituloDeColumna } from "./domain/evaluaciones/ajustes.js";
import { TIPOS_PROPIOS, armarConfigGps, claveDeColumnaPropia, configGpsVacia, gpsDelClub } from "./domain/gps/ajustes.js";
import { AJUSTES_DE_REGLAS, REGLAS_CARGA, VS_PARTIDO, reglasDelClub } from "./domain/gps/cargar.js";
import { PROMEDIOS } from "./domain/gps/columnas.js";
import { FILAS_DEL_INFORME, ZONAS_DE_IMPACTO, ZONA_AL_ABRIR, comparaciones, porcentajesVsVr, vistaDelGps } from "./domain/gps/informe.js";
import { textoDeValor } from "./domain/evaluaciones/excel.js";
import { datosConCambio, esNumero, periodoInicial, textoDeCelda } from "./domain/gps/valores.js";
import {
  actualizarFilaGps,
  borrarEnCurso,
  borrarFilasGps,
  cuentaDeLaSesion,
  guardarCabeceraGps,
  guardarOpcionGps,
  cambiarEnDescripcionesGps,
  guardarReglasGps,
  leerAjustesGps,
  leerEnCurso,
  leerReferenciasGps,
  leerReglasGps,
  listarEnCurso,
  ponerAlDiaGps,
  traerTodoGps,
  unirFilasGps,
} from "./domain/gpsDb.js";
import { guardarCopiaGps, leerCopiaGps } from "./domain/copiaGps.js";
import { cargarEquipos, elegirEquipoInicial, guardarEquipoElegido, leerEquipoElegido } from "./domain/equipo.js";
import { cargarPlantelLesiones } from "./domain/lesionesDb.js";
import { actualesPrimero, esActual } from "./domain/plantel.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, fechaLarga, fechaYHora, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import "./lesiones.css";
import "./evaluaciones.css";
import "./gps.css";

// GPS (en Bases de Datos): la hoja BD_GPS del Excel (Santiago, 10/10). Lo de
// cada columna está en domain/gps/columnas.js; el informe y los colores, en
// domain/gps/informe.js.
//   · Cargar (paso 2): lo de cada día desde el CSV de Catapult, con la
//     lógica de la plantilla Suma de Bloques (CargarGps.jsx y
//     domain/gps/cargar.js).
//   · Base: todas las filas del club (Santiago, 14/10), con arriba, por
//     dispositivo, el promedio de lo que dejan ver los filtros de la tabla,
//     su V.R. y el % contra él, y las Comparaciones (Santiago, 12/10 y
//     14/10), y los mismos colores del Excel, cada dispositivo contra lo
//     suyo. Se corrige en la tabla y el historial se trae una vez con Pegar
//     desde Excel.
//   · Ajustes: el nombre de cada columna, esconderla, sumar columnas del
//     club, las opciones de cada lista (también los dispositivos) y los
//     números de las reglas de la carga.
// Los reportes y los V.R. son los pasos que siguen (docs/PENDIENTES.md, «GPS»).

export const DESTINOS_GPS = [
  { id: "cargar", etiqueta: "Cargar", icono: "usuario" },
  { id: "base", etiqueta: "Base", icono: "documento" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

// Cómo va cada tipo de columna en la tabla. Las duraciones y las horas se
// guardan en segundos; la tabla las escribe como horas (h:mm:ss).
const TIPO_EN_LA_TABLA = { jugador: "lista", fecha: "fecha", numero: "numero", porMinuto: "numero", tiempo: "horas", hora: "horas", lista: "lista", texto: "texto" };
const EN_SEGUNDOS = ["tiempo", "hora"];
// Van alineadas a la izquierda, como en el Excel; el resto, centrado.
const A_LA_IZQUIERDA = ["jugador", "descripcion"];
// Quién es una fila del promedio del equipo, en la columna Nombre.
const PROMEDIO = "promedio:";
// Cuántas filas se guardan a la vez al pegar en la tabla.
const GUARDADOS_A_LA_VEZ = 6;
// Las palabras propias de GPS que explica la guía, en este orden.
const TERMINOS_GPS = ["teamAverage", "va", "microciclo", "porMinuto", "dispositivo", "vrBase", "comparaciones", "vrPartido", "vsPartido", "sinIngresar", "regenerativo"];
// El V.R. elegido de cada dispositivo y la zona de impacto de las
// Comparaciones (las celdas A14:C14 y AI16 del Excel) quedan en este aparato.
const claveDeElegidos = (equipoId) => `gps_vr:${equipoId}`;
const leerElegidos = (equipoId) => {
  try {
    const guardados = JSON.parse(window.localStorage.getItem(claveDeElegidos(equipoId)) || "{}");
    return guardados && typeof guardados === "object" && !Array.isArray(guardados) ? guardados : {};
  } catch {
    return {};
  }
};
const guardarElegidos = (equipoId, elegidos) => {
  try {
    window.localStorage.setItem(claveDeElegidos(equipoId), JSON.stringify(elegidos));
  } catch {
    // Sin lugar en el aparato: vale mientras la pantalla esté abierta.
  }
};
// Armar miles de filas para la tabla (cada celda con el formato del Excel)
// traba un celular un par de segundos: se arman antes de que hagan falta, de
// a tandas, sin trabar la pantalla. armado: la ref con { armarFila, armadas }
// de la pantalla (si cambian, se sigue con las nuevas); seguir: si todavía
// hacen falta. Con la página escondida, sin pausas (nadie la está usando y el
// navegador demora las pausas).
const FILAS_POR_TANDA = 300;
const SIN_FILAS = [];
const armarDeATandas = async (armado, lista, seguir) => {
  for (let desde = 0; desde < lista.length; desde += FILAS_POR_TANDA) {
    if (!seguir()) return;
    const { armarFila, armadas } = armado.current;
    lista.slice(desde, desde + FILAS_POR_TANDA).forEach((fila) => {
      if (!armadas.has(fila)) armadas.set(fila, armarFila(fila));
    });
    if (typeof document === "undefined" || !document.hidden) await new Promise((listo) => setTimeout(listo, 0));
  }
};

const primeraMayuscula = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "");

// onVolver: el botón de arriba a la izquierda (vuelve a Bases de Datos);
// volverA: la clave de su texto.
export default function Gps({ onVolver, volverA = "portal.basesTitulo" }) {
  const { idioma, plural } = useIdioma();
  const [equipo, setEquipo] = useState(() => leerEquipoElegido());
  const [vista, setVista] = useState("cargar");
  // Cómo se usa GPS (Santiago, 14/10: «pensa como si lo fuese a usar por
  // primera ves»): el «?» de arriba; la primera vez en el aparato se ofrece.
  const guia = useGuiaDelModulo("gps");
  const [plantel, setPlantel] = useState([]);
  const [plantelSinLeer, setPlantelSinLeer] = useState(false);
  // Todas las filas del club (Santiago, 14/10: «Lo que sea mejor para poder
  // abrir lo mas rapido posible todas las filas que se tengan»).
  const [filasGps, setFilasGps] = useState([]);
  const [filasAjustes, setFilasAjustes] = useState({ campos: [], opciones: [] });
  // La primera vez en un aparato: mientras llegan las filas de antes de las
  // últimas 4 semanas, cuántas van ({ n, total }); si no llegaron, el error.
  const [trayendo, setTrayendo] = useState(null);
  const [errorHistorial, setErrorHistorial] = useState("");
  // Cuántas filas se están borrando.
  const [borrando, setBorrando] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [importando, setImportando] = useState(false);
  // Cargar: el día que se está cargando (los pasos, encima de la pantalla) y
  // si tiene algo sin guardar (al irse, se pregunta).
  const [cargandoDia, setCargandoDia] = useState(false);
  const diaSinGuardar = useRef(false);
  // Las cargas sin terminar (Santiago, 13/10: dejar el entrenamiento para
  // revisar y seguirlo desde otro aparato): la lista, la que se sigue
  // ({ id, version, paso, datos }; sin ella, una nueva), cuál se está
  // abriendo y cuál se va a borrar.
  const [enCurso, setEnCurso] = useState([]);
  const [errorEnCurso, setErrorEnCurso] = useState("");
  const [cargaEnCurso, setCargaEnCurso] = useState(null);
  const [abriendoEnCurso, setAbriendoEnCurso] = useState(null);
  const [enCursoABorrar, setEnCursoABorrar] = useState(null);
  const [aSalir, setASalir] = useState(null);
  // Las reglas de la carga que guardó el club (sin la tabla, las de la plantilla).
  const [reglasGuardadas, setReglasGuardadas] = useState({});
  const [faltanReglas, setFaltanReglas] = useState(false);
  // Los V.R. de cada dispositivo (gps_referencias) y cuál se eligió.
  const [referencias, setReferencias] = useState([]);
  const [faltanReferencias, setFaltanReferencias] = useState(false);
  const [elegidos, setElegidos] = useState({});
  const [hojaReglas, setHojaReglas] = useState(null);
  const avisarSinGuardar = useCallback((sinGuardar) => {
    diaSinGuardar.current = sinGuardar;
  }, []);
  const [aBorrar, setABorrar] = useState(null);
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));

  // Ajustes: qué se mira y la hoja abierta.
  const [vistaAjustes, setVistaAjustes] = useState("inicio");
  const [hojaCabecera, setHojaCabecera] = useState(null);
  const [hojaOpcion, setHojaOpcion] = useState(null);
  const [hojaColumna, setHojaColumna] = useState(null);
  const [errorHoja, setErrorHoja] = useState("");

  const equipoId = equipo?.id || null;
  // Quien ya se fue del club ve lo cargado hasta su último día y no cambia nada.
  const soloLectura = Boolean(equipo?.hasta);

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

  // Datos básicos y los Ajustes: una vez por club.
  // silencioso: lo nuevo de otros (useEnVivo); lo que no se pudo leer queda
  // como se veía.
  const cargarClub = useCallback(async ({ silencioso = false } = {}) => {
    const [respuestaPlantel, respuestaAjustes, respuestaReglas, respuestaReferencias] = await Promise.all([
      cargarPlantelLesiones(equipoId),
      leerAjustesGps(equipoId),
      leerReglasGps(equipoId),
      leerReferenciasGps(equipoId),
    ]);
    if (silencioso && (respuestaPlantel.error || respuestaPlantel.deRespaldo)) return;
    setPlantel(respuestaPlantel.plantel || []);
    setPlantelSinLeer(Boolean(respuestaPlantel.error || respuestaPlantel.deRespaldo));
    // Sin poder leer los Ajustes, siguen los nombres del Excel.
    if (!respuestaAjustes.error) setFilasAjustes({ campos: respuestaAjustes.campos, opciones: respuestaAjustes.opciones });
    // Sin poder leer las reglas, siguen las de antes (o las de la plantilla).
    if (!respuestaReglas.error) {
      setReglasGuardadas(respuestaReglas.reglas);
      setFaltanReglas(respuestaReglas.faltaTabla);
    }
    // Sin poder leer los V.R., siguen los de antes (o ninguno).
    if (!respuestaReferencias.error) {
      setReferencias(respuestaReferencias.referencias);
      setFaltanReferencias(respuestaReferencias.faltaTabla);
    }
  }, [equipoId]);

  useEffect(() => {
    setElegidos(equipoId ? leerElegidos(equipoId) : {});
  }, [equipoId]);
  const elegir = useCallback(
    (cambio) =>
      setElegidos((antes) => {
        const nuevos = { ...antes, ...cambio, vr: { ...(antes.vr || {}), ...(cambio.vr || {}) } };
        if (equipoId) guardarElegidos(equipoId, nuevos);
        return nuevos;
      }),
    [equipoId],
  );

  // Todas las filas, lo más rápido posible (Santiago, 14/10). Con la copia
  // de este aparato se ven al instante y después se trae solo lo cambiado;
  // sin copia (la primera vez), primero las últimas 4 semanas (se ven
  // enseguida) y después las demás. Quien ya se fue del club ve la foto de su
  // último día (sin copia). Si se vuelve a abrir mientras se leía, vale la
  // última lectura.
  const lecturas = useRef(0);
  const cuenta = useRef(null);
  // Lo último que se trajo de la base (para traer después solo lo cambiado).
  const marca = useRef(null);
  const actuales = useRef(filasGps);
  actuales.current = filasGps;
  // Las puestas al día van de a una (abrir, lo de otros, después de cargar).
  const cola = useRef(Promise.resolve());
  // Cómo se arma una fila para la tabla (más abajo) y las ya armadas.
  const armado = useRef(null);
  const ponerAlDia = useCallback(() => {
    const esta = lecturas.current;
    const tarea = async () => {
      if (!equipoId || esta !== lecturas.current) return;
      const respuesta = await ponerAlDiaGps(equipoId, { filas: actuales.current, hasta: marca.current });
      // Si no se pudo, queda lo que se veía; se intenta la próxima vez.
      if (esta !== lecturas.current || respuesta.error) return;
      marca.current = respuesta.hasta;
      if (respuesta.cambio) {
        actuales.current = respuesta.filas;
        setFilasGps(respuesta.filas);
      }
    };
    cola.current = cola.current.then(tarea, tarea);
    return cola.current;
  }, [equipoId]);

  const cargarFilas = useCallback(async () => {
    lecturas.current += 1;
    const esta = lecturas.current;
    setCargando(true);
    setError("");
    setErrorHistorial("");
    setTrayendo(null);
    marca.current = null;
    if (!soloLectura) {
      cuenta.current = await cuentaDeLaSesion();
      const copia = cuenta.current ? await leerCopiaGps(cuenta.current, equipoId) : null;
      if (esta !== lecturas.current) return;
      if (copia) {
        marca.current = copia.hasta;
        actuales.current = copia.filas;
        setFilasGps(copia.filas);
        setCargando(false);
        await ponerAlDia();
        return;
      }
    }
    const respuesta = await traerTodoGps(equipoId, {
      desdeReciente: periodoInicial(hoyISO()).desde,
      alPrimeraParte: (recientes) => {
        if (esta !== lecturas.current) return;
        actuales.current = recientes;
        setFilasGps(recientes);
        setCargando(false);
        setTrayendo({ n: 0, total: null });
      },
      alAvanzar: (n, total) => {
        if (esta === lecturas.current) setTrayendo({ n, total });
      },
    });
    if (esta !== lecturas.current) return;
    // Las de antes, armadas antes de sumarlas: la Base no se traba al sumarlas.
    if (!respuesta.error && respuesta.viejas.length) await armarDeATandas(armado, respuesta.viejas, () => esta === lecturas.current);
    if (esta !== lecturas.current) return;
    setTrayendo(null);
    setCargando(false);
    if (respuesta.error) {
      // Sin nada a la vista, el error; con las últimas semanas, un aviso.
      if (respuesta.recientes.length) setErrorHistorial(respuesta.error);
      else setError(respuesta.error);
      return;
    }
    marca.current = respuesta.hasta;
    // Lo de antes, con lo reciente como esté (se pudo cambiar mientras tanto).
    setFilasGps((antes) => (soloLectura ? respuesta.recientes : unirFilasGps(respuesta.viejas, antes)));
  }, [equipoId, soloLectura, ponerAlDia]);

  // La copia de este aparato, al día con lo que se ve (al rato de cada
  // cambio, para no escribirla en cada celda).
  useEffect(() => {
    if (soloLectura || cargando || trayendo || errorHistorial || !cuenta.current || !equipoId) return undefined;
    const temporizador = setTimeout(() => guardarCopiaGps(cuenta.current, equipoId, { filas: filasGps, hasta: marca.current }), 1500);
    return () => clearTimeout(temporizador);
  }, [filasGps, cargando, trayendo, errorHistorial, soloLectura, equipoId]);

  const cargar = useCallback(() => Promise.all([cargarClub(), cargarFilas()]), [cargarClub, cargarFilas]);

  useEffect(() => {
    cargarClub();
  }, [cargarClub]);

  useEffect(() => {
    cargarFilas();
  }, [cargarFilas]);

  // Lo que carga o cambia otra persona aparece solo (Santiago, 11/10): las
  // filas (solo lo cambiado) y Datos básicos.
  useEnVivo({
    nombre: "gps",
    tablas: ["gps", "jugadores"],
    equipoId,
    activo: !soloLectura,
    alCambiar: () => Promise.all([cargarClub({ silencioso: true }), ponerAlDia()]),
  });

  const cargarEnCurso = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!equipoId || soloLectura) {
        setEnCurso([]);
        return;
      }
      const respuesta = await listarEnCurso(equipoId);
      if (respuesta.error) {
        if (!silencioso) setErrorEnCurso(respuesta.error);
        return;
      }
      setErrorEnCurso("");
      setEnCurso(respuesta.enCurso);
    },
    [equipoId, soloLectura],
  );
  const enCargar = vista === "cargar" && !cargandoDia;
  useEffect(() => {
    if (enCargar) cargarEnCurso();
  }, [enCargar, cargarEnCurso]);
  // Las que deja otra persona (o este mismo usuario en otro aparato)
  // aparecen solas, como lo demás del GPS.
  useEnVivo({
    nombre: "gps-en-curso",
    tablas: ["gps_en_curso"],
    equipoId,
    activo: !soloLectura && enCargar,
    alCambiar: () => cargarEnCurso({ silencioso: true }),
  });

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

  const config = useMemo(() => (filasAjustes ? armarConfigGps(filasAjustes.campos, filasAjustes.opciones) : configGpsVacia()), [filasAjustes]);
  // Las columnas del Excel y las que sumó el club.
  const gps = useMemo(() => gpsDelClub(config), [config]);
  const titulo = (columna) => tituloDeColumna(gps, columna, config, idioma);
  const reglas = useMemo(() => reglasDelClub(reglasGuardadas), [reglasGuardadas]);

  const jugadorDe = useCallback((id) => plantel.find((jugador) => String(jugador.id) === String(id)) || null, [plantel]);
  // De quién es una fila: el jugador, la persona o el promedio del equipo.
  const nombreDe = (fila) => (fila?.promedio ? PROMEDIOS[fila.promedio]?.[idioma] : jugadorDe(fila?.jugador_id)?.nombre || fila?.persona || "");

  // ----------------------------------------------------------------- Base --

  const visibles = useMemo(() => columnasVisibles(gps, config), [gps, config]);
  // El texto de cada opción de cada lista, una vez por lista (son miles de celdas).
  const textosDeListas = useMemo(() => {
    const listas = {};
    gps.columnas
      .filter((columna) => columna.tipo === "lista")
      .forEach((columna) => {
        listas[columna.lista] = new Map(opcionesDeLista(columna.lista, config, idioma, { test: gps, conOcultas: true }).map((opcion) => [opcion.valor, opcion.etiqueta]));
      });
    return listas;
  }, [gps, config, idioma]);

  // Para elegir de quién es una fila: el promedio del equipo o un jugador
  // (los del plantel actual primero; quien ya no está, con su aviso).
  const opcionesDeQuien = useMemo(
    () => [
      ...Object.entries(PROMEDIOS).map(([clave, texto]) => ({ valor: `${PROMEDIO}${clave}`, etiqueta: texto[idioma], alias: Object.values(texto) })),
      ...actualesPrimero(plantel).map((jugador) => ({
        valor: String(jugador.id),
        etiqueta: esActual(jugador) ? jugador.nombre : `${jugador.nombre} · ${t("datos.yaNoEsta")}`,
        alias: [jugador.nombre],
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plantel, idioma],
  );

  const columnas = useMemo(
    () =>
      visibles.map((columna) => ({
        clave: columna.clave,
        titulo: tituloDeColumna(gps, columna, config, idioma),
        tipo: TIPO_EN_LA_TABLA[columna.tipo] || "texto",
        // Un "por minuto" no se escribe: sale de su medida y del Tiempo.
        editable: !soloLectura && columna.tipo !== "porMinuto",
        ancho: columna.ancho,
        alinear: A_LA_IZQUIERDA.includes(columna.clave) ? undefined : "centro",
        opciones:
          columna.tipo === "jugador"
            ? opcionesDeQuien
            : columna.tipo === "lista"
              ? opcionesDeLista(columna.lista, config, idioma, { test: gps }).map((opcion) => ({
                  valor: opcion.valor,
                  etiqueta: opcion.etiqueta,
                  // Para pegar: también vale el texto en el otro idioma y como lo escribe el Excel.
                  alias: [
                    ...new Set(
                      ["es-AR", "pt-BR"].flatMap((uno) =>
                        [config, configGpsVacia()].map((cual) => opcionesDeLista(columna.lista, cual, uno, { test: gps, conOcultas: true }).find((una) => una.valor === opcion.valor)?.etiqueta).filter(Boolean),
                      ),
                    ),
                  ],
                }))
              : undefined,
      })),
    [gps, visibles, config, idioma, soloLectura, opcionesDeQuien],
  );
  const fijas = useMemo(() => visibles.filter((columna) => columna.fija).map((columna) => columna.clave), [visibles]);

  // Cómo se ve cada celda (con el formato del Excel) y qué se edita (también
  // en lo que se va a guardar al cargar un día).
  const armarFila = useCallback(
    (fila) => {
      const jugador = fila.jugador_id ? jugadorDe(fila.jugador_id) : null;
      const valores = {};
      const textos = {};
      const orden = {};
      visibles.forEach((columna) => {
        const { clave } = columna;
        const dato = fila.datos?.[clave];
        switch (columna.tipo) {
          case "jugador":
            valores[clave] = fila.promedio ? `${PROMEDIO}${fila.promedio}` : fila.jugador_id ? String(fila.jugador_id) : "";
            textos[clave] = fila.promedio ? PROMEDIOS[fila.promedio]?.[idioma] || "" : jugador?.nombre || fila.persona || "";
            orden[clave] = textos[clave];
            break;
          case "fecha":
            valores[clave] = fila.fecha;
            textos[clave] = fechaCorta(fila.fecha);
            orden[clave] = fila.fecha || "";
            break;
          case "lista":
            valores[clave] = dato ?? "";
            textos[clave] = dato === undefined || dato === null || dato === "" ? "" : textosDeListas[columna.lista]?.get(dato) || String(dato);
            break;
          default:
            if (EN_SEGUNDOS.includes(columna.tipo)) {
              valores[clave] = esNumero(dato) ? dato / 3600 : null;
              if (esNumero(dato)) orden[clave] = dato;
            } else if (columna.tipo === "texto") {
              valores[clave] = dato ?? "";
            } else {
              valores[clave] = esNumero(dato) ? dato : null;
              if (esNumero(dato)) orden[clave] = dato;
            }
            textos[clave] = textoDeCelda(columna, dato, idioma);
        }
      });
      // Quien ya no está en el plantel actual, en otro color (como en Lesiones).
      return { id: fila.id, valores, textos, orden, gps: fila, apagada: Boolean(jugador && !esActual(jugador)) };
    },
    [visibles, jugadorDe, textosDeListas, idioma],
  );
  // Cada fila de la Base se arma una vez y se guarda: al cambiar o borrar
  // una, se arma solo esa (son miles). Se vuelven a armar todas si cambian
  // las columnas, el idioma, las listas o Datos básicos.
  const armadas = useMemo(() => new WeakMap(), [armarFila]);
  armado.current = { armarFila, armadas };
  // Solo con la Base a la vista (la pantalla abre en Cargar); mientras tanto
  // se van armando de a tandas, y al abrir la Base ya están.
  const enLaBase = vista === "base";
  const filas = useMemo(
    () =>
      enLaBase
        ? filasGps.map((fila) => {
            const ya = armadas.get(fila);
            if (ya) return ya;
            const armada = armarFila(fila);
            armadas.set(fila, armada);
            return armada;
          })
        : SIN_FILAS,
    [enLaBase, filasGps, armadas, armarFila],
  );
  useEffect(() => {
    if (enLaBase) return undefined;
    let sigue = true;
    armarDeATandas(armado, filasGps, () => sigue);
    return () => {
      sigue = false;
    };
  }, [enLaBase, filasGps, armadas]);

  const ordenDeDispositivos = useMemo(() => new Map([...(textosDeListas.dispositivo?.keys() || [])].map((codigo, indice) => [codigo, indice])), [textosDeListas]);

  // Las columnas con V.R. en el club: sus cuentas hacen falta aunque estén
  // escondidas (las Comparaciones van con todas, como en el Excel).
  const conCuentas = useMemo(() => {
    const conVr = new Set(referencias.flatMap((referencia) => Object.keys(referencia.promedio)));
    return gps.columnas.filter((columna) => conVr.has(columna.clave));
  }, [gps, referencias]);

  // Con las filas que se ven: lo de arriba y los colores, cada dispositivo
  // con lo suyo (con más de uno a la vista, cada uno con su nombre): el
  // promedio, su V.R. y el % contra él, en cada columna; arriba de la tabla,
  // qué V.R. y las Comparaciones (Santiago, 12/10 y 14/10).
  const informeYColores = useCallback(
    (filasVista) => {
      const { grupos, estilos } = vistaDelGps(
        filasVista.map((fila) => fila.gps),
        visibles,
        conCuentas,
      );
      const delInforme = visibles.filter((columna) => columna.informe);
      // Los dispositivos en el orden de su lista (Ajustes); sin dispositivo, al final.
      const lugar = (codigo) => (codigo ? (ordenDeDispositivos.has(codigo) ? ordenDeDispositivos.get(codigo) : ordenDeDispositivos.size) : ordenDeDispositivos.size + 1);
      grupos.sort((a, b) => lugar(a.dispositivo) - lugar(b.dispositivo));
      const varios = grupos.length > 1;
      const nombreDelDispositivo = (codigo) => (codigo ? textosDeListas.dispositivo?.get(codigo) || codigo : t("gps.sinDispositivo"));
      const zona = ZONAS_DE_IMPACTO.some((una) => una.id === elegidos.zona) ? elegidos.zona : ZONA_AL_ABRIR;
      // Cada dispositivo, con sus V.R., el elegido (o el primero) y sus %.
      const deCadaUno = grupos.map((grupo) => {
        const suyas = grupo.dispositivo ? referencias.filter((referencia) => referencia.dispositivo === grupo.dispositivo) : [];
        const referencia = suyas.find((una) => una.id === elegidos.vr?.[grupo.dispositivo]) || suyas[0] || null;
        const porcentajes = porcentajesVsVr(grupo.cuentas, referencia?.promedio);
        return { grupo, suyas, referencia, porcentajes };
      });
      const porciento = (valor) => (esNumero(valor) ? textoDeValor(valor, "0%", idioma) : "");
      const texto = (columna, { grupo, referencia, porcentajes }, fila) => {
        if (fila === "media") return esNumero(grupo.cuentas[columna.clave]?.media) ? textoDeCelda(columna, grupo.cuentas[columna.clave].media, idioma) : "";
        if (fila === "vr") return esNumero(referencia?.promedio?.[columna.clave]) ? textoDeCelda(columna, referencia.promedio[columna.clave], idioma) : "";
        return porciento(porcentajes[columna.clave]);
      };
      const nombreDeReferencia = (referencia) => [referencia.tipo, referencia.tabla, referencia.grupo].filter(Boolean).join(" · ");
      const conVr = deCadaUno.some((uno) => uno.referencia);
      const encima = deCadaUno.length ? (
        <div className="gps-comparaciones">
          <div className="gps-comparaciones-cabeza">
            <b>
              {t("gps.comparaciones.titulo")}
              <TerminoDe clave="gps.terminos.comparaciones" />
            </b>
            {conVr && (
              <label className="gps-comparaciones-zona">
                <span>{t("gps.comparaciones.zona")}</span>
                <select value={zona} onChange={(evento) => elegir({ zona: evento.target.value })}>
                  {ZONAS_DE_IMPACTO.map((una) => (
                    <option key={una.id} value={una.id}>
                      {t(`gps.comparaciones.zonas.${una.id}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {deCadaUno.map(({ grupo, suyas, referencia, porcentajes }) => {
            const numeros = referencia ? comparaciones(porcentajes, zona) : null;
            return (
              <section className="gps-comparacion" key={grupo.dispositivo || "-"}>
                <div className="gps-comparacion-vr">
                  <b>{nombreDelDispositivo(grupo.dispositivo)}</b>
                  {referencia ? (
                    <div className="gps-comparacion-elegir">
                      <span>
                        {t("gps.vr.rotulo")}
                        <TerminoDe clave="gps.terminos.vrBase" />
                      </span>
                      <select value={referencia.id} onChange={(evento) => elegir({ vr: { [grupo.dispositivo]: evento.target.value } })} aria-label={t("gps.vr.elegir", { dispositivo: nombreDelDispositivo(grupo.dispositivo) })}>
                        {suyas.map((una) => (
                          <option key={una.id} value={una.id}>
                            {nombreDeReferencia(una)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="gps-comparacion-sin">{t(faltanReferencias ? "gps.vr.faltaMigracion" : grupo.dispositivo ? "gps.vr.sinVr" : "gps.vr.sinDispositivo")}</span>
                  )}
                </div>
                {numeros && (
                  <dl className="gps-comparacion-numeros">
                    {["volumen", "volumenZona", "densidad", "densidadZona", "tiempo"].map((clave) => (
                      <div key={clave}>
                        <dt>{t(`gps.comparaciones.${clave}`)}</dt>
                        <dd>{porciento(numeros[clave]) || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            );
          })}
        </div>
      ) : null;
      return {
        estilos,
        encima,
        arriba: deCadaUno.flatMap((uno) =>
          FILAS_DEL_INFORME.map((fila) => ({
            id: `${uno.grupo.dispositivo}:${fila}`,
            rotulo: varios ? (
              <span className="gps-rotulo">
                <b>{nombreDelDispositivo(uno.grupo.dispositivo)}</b>
                <span>{t(`gps.informe.${fila}`)}</span>
              </span>
            ) : (
              t(`gps.informe.${fila}`)
            ),
            celdas: Object.fromEntries(delInforme.map((columna) => [columna.clave, { texto: texto(columna, uno, fila) }])),
          })),
        ),
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibles, conCuentas, textosDeListas, ordenDeDispositivos, idioma, referencias, faltanReferencias, elegidos, elegir],
  );

  // Al pegar en muchas filas, lo guardado se junta y la tabla se redibuja
  // una sola vez, al final.
  const lote = useRef(null);
  const reemplazar = (fila) => {
    if (lote.current) lote.current.set(fila.id, fila);
    else setFilasGps((previas) => previas.map((una) => (una.id === fila.id ? fila : una)));
  };

  // Lo último de cada fila (lo que ya devolvió la base, aunque la pantalla
  // todavía no se haya redibujado) y una cola por fila: dos celdas de la
  // misma fila guardadas seguidas no se pisan, la segunda sale de lo que
  // dejó la primera.
  const ultimas = useRef(filasGps);
  ultimas.current = filasGps;
  const colas = useRef(new Map());
  const guardarFila = (id, cambiar) => {
    const unPaso = async () => {
      const fila = ultimas.current.find((una) => una.id === id);
      if (!fila) return { error: "gps.error.noGuardar" };
      const { fila: nueva, error: falta } = cambiar(fila);
      if (falta) return { error: falta };
      if (!nueva) return {};
      const respuesta = await actualizarFilaGps(id, nueva);
      if (respuesta.error) return { error: respuesta.error };
      ultimas.current = ultimas.current.map((una) => (una.id === id ? respuesta.fila : una));
      reemplazar(respuesta.fila);
      return {};
    };
    const siguiente = (colas.current.get(id) || Promise.resolve()).then(unPaso, unPaso);
    colas.current.set(id, siguiente);
    return siguiente;
  };

  // Una celda cambiada, sobre la fila: { fila } o { error } (y nada si no
  // se cambia a mano). Si se cambia una medida o el Tiempo, se recalcula su
  // "por minuto".
  const conCambio = (fila, clave, valor) => {
    const columna = gps.columnas.find((una) => una.clave === clave);
    if (!columna || columna.tipo === "porMinuto") return {};
    if (columna.tipo === "fecha") return valor ? { fila: { ...fila, fecha: valor } } : { error: "gps.error.sinFecha" };
    if (columna.tipo === "jugador") {
      // Una fila es siempre de alguien: un jugador o el promedio del equipo.
      if (!valor) return { error: "gps.error.sinJugador" };
      if (String(valor).startsWith(PROMEDIO)) return { fila: { ...fila, jugador_id: null, persona: null, promedio: String(valor).slice(PROMEDIO.length) } };
      return { fila: { ...fila, jugador_id: Number(valor), persona: null, promedio: null } };
    }
    let nuevo = valor === "" || valor === undefined ? null : valor;
    if (EN_SEGUNDOS.includes(columna.tipo)) nuevo = esNumero(nuevo) ? Math.round(nuevo * 3600) : null;
    return { fila: { ...fila, datos: datosConCambio(fila.datos, clave, nuevo) } };
  };

  const editarCelda = (id, clave, valor) => guardarFila(id, (fila) => conCambio(fila, clave, valor));

  // Lo pegado se guarda de a varias filas a la vez (cada fila con su cola).
  const pegarEnTabla = async (cambios) => {
    const porFila = new Map();
    cambios.forEach((cambio) => porFila.set(cambio.filaId, [...(porFila.get(cambio.filaId) || []), cambio]));
    const pendientes = [...porFila];
    let hechos = 0;
    let ultimoError = "";
    const guardarPendientes = async () => {
      while (pendientes.length) {
        const [id, suyos] = pendientes.shift();
        // eslint-disable-next-line no-await-in-loop
        const resultado = await guardarFila(id, (fila) => {
          let falta = "";
          const nueva = suyos.reduce((acumulada, cambio) => {
            const uno = conCambio(acumulada, cambio.clave, cambio.valor);
            if (uno.error) falta = uno.error;
            return uno.fila || acumulada;
          }, fila);
          return falta ? { error: falta } : { fila: nueva };
        });
        if (resultado.error) ultimoError = resultado.error;
        else hechos += suyos.length;
      }
    };
    const juntadas = new Map();
    lote.current = juntadas;
    try {
      await Promise.all(Array.from({ length: Math.min(GUARDADOS_A_LA_VEZ, pendientes.length) }, guardarPendientes));
    } finally {
      lote.current = null;
      if (juntadas.size) setFilasGps((previas) => previas.map((una) => juntadas.get(una.id) || una));
    }
    return { hechos, error: ultimoError };
  };

  // Todas las elegidas (con Shift, varias filas), de a tandas; si alguna no
  // se puede, se avisa cuántas se borraron.
  const confirmarBorrar = async () => {
    const elegidas = aBorrar || [];
    setABorrar(null);
    if (!elegidas.length) return;
    setOcupado(true);
    setBorrando(elegidas.length);
    const respuesta = await borrarFilasGps(elegidas.map((fila) => fila.id));
    const borradas = new Set(respuesta.borradas);
    const falla = respuesta.error || (borradas.size < elegidas.length ? "gps.error.noBorrar" : "");
    setOcupado(false);
    setBorrando(0);
    if (borradas.size) setFilasGps((previas) => previas.filter((una) => !borradas.has(una.id)));
    if (falla) setAviso(elegidas.length === 1 ? t(falla) : `${t(falla)} ${t("tabla.borradasDe", { n: borradas.size, total: elegidas.length })}`);
    else setAviso(elegidas.length === 1 ? t("gps.borrada") : t("gps.borradas", { n: borradas.size }));
  };

  // ------------------------------------------------------------ Pantallas --

  const estado = !enLinea ? (
    <p className="lesiones-estado">{t("gps.estado.sinConexion")}</p>
  ) : error ? (
    <div className="lesiones-estado error">
      {t(error)}{" "}
      <button type="button" onClick={cargar}>
        {t("comun.reintentar")}
      </button>
    </div>
  ) : borrando ? (
    <p className="lesiones-estado" role="status">
      {plural("gps.estado.borrando", borrando)}
    </p>
  ) : cargando ? (
    <p className="lesiones-estado">{t("gps.estado.cargando")}</p>
  ) : null;

  const numero = (n) => Number(n).toLocaleString(idioma);

  const hoy = hoyISO();

  const pantallaBase = (
    <div className="app app-inicio">
      <div className="contenedor contenedor-inicio-formacion contenedor-base">
        <header className="hero-partido hero-lesiones">
          <div className="hero-lesiones-barra">
            {onVolver ? (
              <button type="button" className="boton-modulos" onClick={onVolver}>
                <Icono nombre="flecha" size={14} />
                {t(volverA)}
              </button>
            ) : (
              <span />
            )}
            <div className="guia-e-idioma">
              <BotonGuia onClick={guia.abrir} />
              <SelectorIdioma />
            </div>
          </div>
          <div className="hero-lesiones-club">
            <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
            <span className="etiqueta-hero">{t("gps.titulo").toUpperCase()}</span>
            <strong className="nombre-sesion">{equipo?.nombre || t("gps.titulo")}</strong>
            <p className="fecha-hero">{primeraMayuscula(fechaLarga(hoy))}</p>
            <span className="estado-hero">{cargando ? t("gps.estado.leyendo") : plural("gps.filas", filasGps.length, { n: numero(filasGps.length) })}</span>
          </div>
        </header>

        <p className="pantalla-donde">{t(soloLectura ? "gps.donde.baseSoloLectura" : "gps.donde.base")}</p>
        <AvisoSoloLectura hasta={equipo?.hasta} />

        {estado}

        {trayendo && (
          <p className="lesiones-estado gps-trayendo" role="status">
            {trayendo.total ? t("gps.trayendo", { n: numero(trayendo.n), total: numero(trayendo.total) }) : t("gps.trayendoSinCuenta")}
          </p>
        )}
        {errorHistorial && (
          <div className="lesiones-estado error">
            {t("gps.faltaHistorial", { error: t(errorHistorial) })}{" "}
            <button type="button" onClick={cargarFilas}>
              {t("comun.reintentar")}
            </button>
          </div>
        )}

        {!soloLectura && (
          <button type="button" className="boton-secundario datos-pegar-excel lesiones-pegar-excel" onClick={() => setImportando(true)} disabled={!enLinea}>
            <Icono nombre="documento" size={16} />
            {t("gps.importar.boton")}
          </button>
        )}
        <section className="tarjeta evaluaciones-tabla">
          <TablaDatos
            id="gps"
            recordar="gps"
            columnas={columnas}
            filas={filas}
            fijas={fijas}
            // Son miles de filas: se dibujan las que se ven.
            muchasFilas
            vista={informeYColores}
            onEditar={editarCelda}
            onPegar={pegarEnTabla}
            leyenda={t("datos.leyendaYaNoEsta")}
            rotuloApagada={t("datos.yaNoEsta")}
            onBorrarFilas={
              soloLectura
                ? undefined
                : (ids) => {
                    const pedidas = new Set(ids);
                    const elegidas = filasGps.filter((una) => pedidas.has(una.id));
                    if (elegidas.length) setABorrar(elegidas);
                  }
            }
          />
        </section>
      </div>
    </div>
  );

  // -------------------------------------------------------------- Cargar --

  // Lo de hoy, si la Base tiene traído el día de hoy.
  const conHoy = !cargando && !error;
  const deHoy = conHoy ? filasGps.filter((fila) => fila.fecha === hoy).length : null;

  // Guardado el día: a la Base.
  const alCargarDia = ({ cargadas, fecha, quedoEnCurso = false }) => {
    diaSinGuardar.current = false;
    setCargandoDia(false);
    setCargaEnCurso(null);
    setVista("base");
    ponerAlDia();
    setAviso(quedoEnCurso ? t("gps.enCurso.quedoSinBorrar") : plural("gps.cargar.listo", cargadas, { fecha: fecha ? fechaCorta(fecha) : "—" }));
  };

  // Dejado para revisar: vuelve a Cargar, donde queda en «Sin terminar».
  const alDejarDia = () => {
    diaSinGuardar.current = false;
    setCargandoDia(false);
    setCargaEnCurso(null);
    cargarEnCurso();
    setAviso(t("gps.enCurso.dejada"));
  };

  // Seguir una carga sin terminar en el paso donde quedó (también la última,
  // si la siguieron en otro aparato).
  const seguirEnCurso = async (id) => {
    if (!id || abriendoEnCurso) return;
    setAbriendoEnCurso(id);
    const respuesta = await leerEnCurso(id);
    setAbriendoEnCurso(null);
    if (respuesta.error) {
      setCargandoDia(false);
      setCargaEnCurso(null);
      setErrorEnCurso(respuesta.error);
      cargarEnCurso({ silencioso: true });
      return;
    }
    setErrorEnCurso("");
    diaSinGuardar.current = false;
    setCargaEnCurso(respuesta.enCurso);
    setCargandoDia(true);
  };

  const confirmarBorrarEnCurso = async () => {
    const carga = enCursoABorrar;
    setEnCursoABorrar(null);
    if (!carga) return;
    const { error: falla } = await borrarEnCurso(carga.id);
    if (falla) {
      setErrorEnCurso(falla);
      return;
    }
    setEnCurso((antes) => antes.filter((una) => una.id !== carga.id));
    setAviso(t("gps.enCurso.borrada", { fecha: fechaCorta(carga.fecha) }));
  };

  // Una carga sin terminar en la lista, con la misma cara que una lesión
  // en curso en Lesiones (Santiago, 13/10: «que aparesca en un cuadro abajo
  // de cargar como aparecen las lesion sin fecha de retorno»).
  const tarjetaEnCurso = (carga) => (
    <div className="registro-guardado lesiones-registro" key={carga.id}>
      <span className="cabecera-registro">
        <span className="fecha-registro">{fechaCorta(carga.fecha)}</span>
        {carga.resumen.pasos > 0 && <span className="lesiones-caso">{t("gps.enCurso.paso", { n: carga.resumen.paso, total: carga.resumen.pasos })}</span>}
      </span>
      <div className="lesiones-registro-cuerpo">
        <strong>{carga.resumen.titulo || t("gps.enCurso.sinTitulo")}</strong>
        <span>{t("gps.enCurso.dejadaPor", { quien: carga.actualizado_email || "—", cuando: carga.actualizado_en ? fechaYHora(carga.actualizado_en) : "—" })}</span>
      </div>
      <div className="acciones-registro">
        <button type="button" className="boton-detalle" onClick={() => seguirEnCurso(carga.id)} disabled={!enLinea || Boolean(abriendoEnCurso)}>
          {abriendoEnCurso === carga.id ? t("gps.enCurso.abriendo") : t("gps.enCurso.seguir")}
        </button>
        <button type="button" className="boton-eliminar-registro" aria-label={t("gps.enCurso.borrar", { fecha: fechaCorta(carga.fecha) })} onClick={() => setEnCursoABorrar(carga)}>
          <Icono nombre="borrar" size={18} />
        </button>
      </div>
    </div>
  );

  const pantallaCargar = (
    <div className="app app-inicio">
      <div className="contenedor contenedor-inicio-formacion">
        <header className="hero-partido hero-lesiones">
          <div className="hero-lesiones-barra">
            {onVolver ? (
              <button type="button" className="boton-modulos" onClick={onVolver}>
                <Icono nombre="flecha" size={14} />
                {t(volverA)}
              </button>
            ) : (
              <span />
            )}
            <div className="guia-e-idioma">
              <BotonGuia onClick={guia.abrir} />
              <SelectorIdioma />
            </div>
          </div>
          <div className="hero-lesiones-club">
            <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
            <span className="etiqueta-hero">{t("gps.titulo").toUpperCase()}</span>
            <strong className="nombre-sesion">{equipo?.nombre || t("gps.titulo")}</strong>
            <p className="fecha-hero">{primeraMayuscula(fechaLarga(hoy))}</p>
            {deHoy !== null && <span className={`estado-hero ${deHoy ? "en-curso" : ""}`}>{plural("gps.cargar.deHoy", deHoy, { n: numero(deHoy) })}</span>}
          </div>
        </header>

        {!soloLectura && <p className="pantalla-donde">{t("gps.donde.cargar")}</p>}
        <AvisoSoloLectura hasta={equipo?.hasta} />
        {!enLinea && <p className="lesiones-estado">{t("gps.estado.sinConexion")}</p>}

        {!soloLectura && (
          <div className="acciones-inicio lesiones-acciones">
            <button
              type="button"
              className="boton-principal boton-formacion-grande"
              onClick={() => {
                setCargaEnCurso(null);
                setCargandoDia(true);
              }}
              disabled={!enLinea}
            >
              {t("gps.cargar.nuevo")}
            </button>
          </div>
        )}
        {!soloLectura && errorEnCurso && (
          <div className="lesiones-estado error">
            {t(errorEnCurso)}{" "}
            <button type="button" onClick={() => cargarEnCurso()}>
              {t("comun.reintentar")}
            </button>
          </div>
        )}
        {!soloLectura && enCurso.length > 0 && (
          <section className="lesiones-sin-fecha gps-en-curso">
            <h2>{plural("gps.enCurso.titulo", enCurso.length)}</h2>
            <p className="lesiones-ayuda">{t("gps.enCurso.texto")}</p>
            <div className="lesiones-lista">{enCurso.map(tarjetaEnCurso)}</div>
          </section>
        )}
      </div>
    </div>
  );

  // -------------------------------------------------------------- Ajustes --

  // Título a la izquierda y el idioma a la derecha, como en Evaluaciones.
  const encabezado = (textoTitulo, texto) => (
    <header className="encabezado lesiones-encabezado">
      <div className="lesiones-encabezado-texto">
        <h1>{textoTitulo}</h1>
        {texto && <p>{texto}</p>}
      </div>
      <div className="guia-e-idioma">
        <BotonGuia onClick={guia.abrir} />
        <SelectorIdioma className="lesiones-idioma" />
      </div>
    </header>
  );

  const guardarHojaCabecera = async () => {
    const hoja = hojaCabecera;
    if (!hoja) return;
    // Una relativa no guarda nombre propio (sale del de su absoluta).
    if (!hoja.relativa && !String(hoja.etiquetas[idioma] || "").trim()) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    setOcupado(true);
    // Una columna del club guarda también su tipo (sin él, deja de estar).
    const respuesta = await guardarCabeceraGps(equipoId, hoja.clave, hoja.relativa ? { ...hoja, etiquetas: {} } : hoja);
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    await cargarClub();
    setHojaCabecera(null);
    setAviso(t("lesiones.ajustes.guardado"));
  };

  const guardarHojaColumna = async () => {
    const hoja = hojaColumna;
    if (!hoja) return;
    const nombre = String(hoja.nombre || "").trim();
    if (!nombre) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    // Ni dos columnas con el mismo nombre (al pegar, no se sabría cuál es).
    const repetida = gps.columnas.some((columna) =>
      ["es-AR", "pt-BR"].some((uno) => tituloDeColumna(gps, columna, config, uno).trim().toLowerCase() === nombre.toLowerCase()),
    );
    if (repetida) {
      setErrorHoja(t("gps.ajustes.columnaRepetida"));
      return;
    }
    setOcupado(true);
    const clave = claveDeColumnaPropia(
      nombre,
      [...gps.columnas.map((columna) => columna.clave), ...filasAjustes.campos.map((fila) => fila.campo)],
    );
    const respuesta = await guardarCabeceraGps(equipoId, clave, { etiquetas: { [idioma]: nombre }, oculto: false, orden: 1000 + (config.propias?.length || 0), tipo: hoja.tipo });
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    await cargarClub();
    setHojaColumna(null);
    setAviso(t("gps.ajustes.columnaAgregada"));
  };

  const guardarHojaOpcion = async () => {
    const hoja = hojaOpcion;
    if (!hoja) return;
    const propio = String(hoja.etiquetas[idioma] || "").trim();
    if (!propio) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    // Una opción de estrategia va escrita en la Descripción de cada fila (con
    // su nombre en castellano): si cambia, cambia también ahí (nota del 12/10).
    const enCastellano = (cual) => opcionesDeLista(hoja.lista, cual, "es-AR", { test: gps, conOcultas: true }).find((opcion) => opcion.valor === hoja.codigo)?.etiqueta || "";
    const antes = hoja.lista === "codigo_estrategia" && hoja.codigo ? [enCastellano(config), enCastellano(configGpsVacia())] : [];
    setOcupado(true);
    const respuesta = await guardarOpcionGps(equipoId, hoja.lista, { ...hoja, codigo: hoja.codigo || codigoNuevo(propio) });
    if (respuesta.error) {
      setOcupado(false);
      setErrorHoja(t(respuesta.error));
      return;
    }
    const despues = String(hoja.etiquetas["es-AR"] || "").trim() || String(hoja.etiquetas["pt-BR"] || "").trim();
    const enDescripciones = antes.length ? await cambiarEnDescripcionesGps(equipoId, antes, despues) : { cambiadas: 0, error: "" };
    setOcupado(false);
    await cargarClub();
    if (enDescripciones.cambiadas) ponerAlDia();
    setHojaOpcion(null);
    setAviso(t(enDescripciones.error || "lesiones.ajustes.guardado"));
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

  // Las listas del GPS, una por columna de tipo lista, en el orden del Excel.
  const LISTAS = useMemo(() => gps.columnas.filter((columna) => columna.tipo === "lista").map((columna) => ({ clave: columna.lista, columna })), [gps]);
  const tituloDeLista = (lista) => (lista?.columna ? titulo(lista.columna) : lista?.clave || "");

  const tipoDeColumna = (tipo) => t(`gps.ajustes.tipos.${tipo}`);

  // Las reglas de la carga: cómo se ve cada una (75 %, 13:00, Prendido, los
  // V.R. cargados, lo que se ve en el partido).
  const tituloDeMedida = (clave) => {
    const columna = gps.columnas.find((una) => una.clave === clave);
    return columna ? titulo(columna) : clave;
  };
  const decimal = (numero) => (esNumero(numero) ? numero.toLocaleString(idioma, { maximumFractionDigits: 10, useGrouping: false }) : "");
  const textoDeRegla = (ajuste, valor) => {
    if (ajuste.tipo === "prendida") return valor ? t("gps.reglas.prendido") : t("gps.reglas.apagado");
    if (ajuste.tipo === "vr") {
      const cargados = VS_PARTIDO.medidas.filter((clave) => valor?.[clave]).length;
      return cargados ? t("gps.reglas.vrPartido.cargados", { n: cargados, total: VS_PARTIDO.medidas.length }) : t("gps.reglas.vrPartido.ninguno");
    }
    if (ajuste.tipo === "campos") {
      const seVen = ajuste.opciones.filter((campo) => !(valor || []).includes(campo));
      return seVen.length ? seVen.map((campo) => t(`gps.reglas.${ajuste.clave}.campos.${campo}`)).join(", ") : t(`gps.reglas.${ajuste.clave}.nada`);
    }
    if (ajuste.tipo === "parte") return `${numero(Math.round(valor * 1000) / 10)} %`;
    if (ajuste.tipo === "hora") return `${Math.floor(valor / 3600)}:${String(Math.floor((valor % 3600) / 60)).padStart(2, "0")}`;
    if (ajuste.tipo === "fecha") return valor ? fechaCorta(valor) : t("gps.reglas.inicioDelAnio");
    return numero(valor);
  };
  // Lo que se escribe en la hoja, como texto (la parte, en %; la hora, h:mm).
  const textoParaEscribir = (ajuste, valor) => {
    if (ajuste.tipo === "vr") return Object.fromEntries(VS_PARTIDO.medidas.map((clave) => [clave, decimal(valor?.[clave])]));
    // Los campos: los que se ven (marcados).
    if (ajuste.tipo === "campos") return ajuste.opciones.filter((campo) => !(valor || []).includes(campo));
    if (ajuste.tipo === "parte") return String(Math.round(valor * 1000) / 10);
    if (ajuste.tipo === "hora") return textoDeRegla(ajuste, valor);
    return valor;
  };
  const abrirRegla = (ajuste) => {
    setErrorHoja("");
    setHojaReglas({ ...ajuste, valor: textoParaEscribir(ajuste, reglas[ajuste.clave]) });
  };
  const guardarHojaReglas = async () => {
    const hoja = hojaReglas;
    if (!hoja) return;
    let valor = hoja.valor;
    if (hoja.tipo === "parte" || hoja.tipo === "numero") {
      const leido = Number(String(valor ?? "").replace(",", "."));
      valor = hoja.tipo === "parte" ? leido / 100 : leido;
      const bien = String(hoja.valor ?? "").trim() !== "" && Number.isFinite(valor) && valor >= hoja.minimo && valor <= hoja.maximo && (hoja.tipo === "parte" ? valor > 0 : Number.isInteger(valor));
      if (!bien) {
        setErrorHoja(hoja.tipo === "parte" ? t("gps.reglas.malLaParte") : t("gps.reglas.malElNumero", { minimo: hoja.minimo, maximo: hoja.maximo }));
        return;
      }
    } else if (hoja.tipo === "vr") {
      // Cada V.R., un número mayor que 0 (o vacío: no está).
      const leidos = Object.entries(hoja.valor || {}).filter(([, texto]) => String(texto ?? "").trim() !== "");
      valor = Object.fromEntries(leidos.map(([clave, texto]) => [clave, Number(String(texto).trim().replace(",", "."))]));
      if (Object.values(valor).some((numero) => !(Number.isFinite(numero) && numero > 0))) {
        setErrorHoja(t("gps.reglas.vrPartido.malo"));
        return;
      }
    } else if (hoja.tipo === "campos") {
      valor = hoja.opciones.filter((campo) => !(hoja.valor || []).includes(campo));
    } else if (hoja.tipo === "hora") {
      const partes = /^(\d{1,2})(?::(\d{2}))?$/.exec(String(valor ?? "").trim());
      valor = partes ? Number(partes[1]) * 3600 + Number(partes[2] || 0) * 60 : NaN;
      if (!partes || Number(partes[2] || 0) > 59 || !(valor >= 0 && valor < 86400)) {
        setErrorHoja(t("gps.reglas.malLaHora"));
        return;
      }
    }
    setOcupado(true);
    const respuesta = await guardarReglasGps(equipoId, { ...reglasGuardadas, [hoja.clave]: valor });
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    await cargarClub();
    setHojaReglas(null);
    setAviso(t("lesiones.ajustes.guardado"));
  };

  const pantallaAjustes = () => {
    if (vistaAjustes === "reglas") {
      return (
        <div className="app">
          <div className="contenedor">
            {encabezado(t("gps.reglas.titulo"), t("gps.reglas.ayuda"))}
            {faltanReglas && <p className="lesiones-estado error">{t("gps.reglas.faltaMigracion")}</p>}
            {AJUSTES_DE_REGLAS.map((ajuste) =>
              filaAjuste({
                id: ajuste.clave,
                titulo: t(`gps.reglas.${ajuste.clave}.titulo`),
                detalle: ajuste.tipo === "prendida" ? textoDeRegla(ajuste, reglas[ajuste.clave]) : t(`gps.reglas.${ajuste.clave}.detalle`, { valor: textoDeRegla(ajuste, reglas[ajuste.clave]) }),
                extra: JSON.stringify(reglas[ajuste.clave]) !== JSON.stringify(REGLAS_CARGA[ajuste.clave]) ? <span className="lesiones-oculta">{t("gps.reglas.cambiada")}</span> : null,
                alTocar: () => abrirRegla(ajuste),
              }),
            )}
            <div className="acciones-dobles">
              <BotonVolver onClick={() => setVistaAjustes("inicio")}>{t("lesiones.ajustes.volver")}</BotonVolver>
            </div>
          </div>
        </div>
      );
    }

    if (vistaAjustes === "cabeceras") {
      return (
        <div className="app">
          <div className="contenedor">
            {encabezado(t("lesiones.ajustes.cabeceras"), t("gps.ajustes.cabecerasAyuda"))}
            {gps.columnas.map((columna, indice) => {
              const propio = config.campos?.[gps.id]?.[columna.clave];
              const absoluta = absolutaDe(gps, columna);
              const relativa = absoluta ? { absoluta: titulo(absoluta), sufijo: columna.relativa.sufijo, nombre: titulo(columna) } : null;
              return filaAjuste({
                id: columna.clave,
                titulo: titulo(columna),
                detalle: relativa
                  ? t("lesiones.ajustes.relativa", relativa)
                  : columna.propia
                    ? t("gps.ajustes.delClub", { tipo: tipoDeColumna(columna.tipo) })
                    : t("lesiones.ajustes.porDefecto", { texto: columna.titulo[idioma] || columna.titulo["es-AR"] }),
                extra: columnaOculta(gps, columna.clave, config) ? <span className="lesiones-oculta">{t("lesiones.ajustes.oculto")}</span> : null,
                alTocar: () => {
                  setErrorHoja("");
                  setHojaCabecera({
                    clave: columna.clave,
                    etiquetas: { ...(propio?.etiquetas && Object.values(propio.etiquetas).some(Boolean) ? propio.etiquetas : columna.titulo) },
                    oculto: Boolean(propio?.oculto),
                    orden: propio?.orden ?? indice,
                    tipo: columna.propia ? columna.tipo : null,
                    relativa,
                  });
                },
              });
            })}
            <div className="acciones-dobles">
              <BotonVolver onClick={() => setVistaAjustes("inicio")}>{t("lesiones.ajustes.volver")}</BotonVolver>
              <button
                type="button"
                className="boton-principal"
                onClick={() => {
                  setErrorHoja("");
                  setHojaColumna({ nombre: "", tipo: TIPOS_PROPIOS[0] });
                }}
                disabled={soloLectura}
              >
                {t("gps.ajustes.agregarColumna")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (vistaAjustes.startsWith("lista:")) {
      const clave = vistaAjustes.slice("lista:".length);
      const lista = LISTAS.find((una) => una.clave === clave);
      const todas = opcionesDeLista(clave, config, idioma, { test: gps, conOcultas: true });
      const abrirOpcion = (opcion) => {
        setErrorHoja("");
        const guardada = (config.listas?.[clave] || []).find((una) => una.codigo === opcion?.valor);
        const delExcel = opcion?.delExcel ? opcionesDelExcel(clave, gps).find((una) => una.codigo === opcion.valor) : null;
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
            {clave === "dispositivo" && <p className="lesiones-ayuda gps-ayuda-lista">{t("gps.ajustes.dispositivosAyuda")}</p>}
            {todas.map((opcion) =>
              filaAjuste({
                id: opcion.valor,
                titulo: opcion.etiqueta,
                detalle: opcion.oculto ? t("lesiones.ajustes.oculto") : t("lesiones.ajustes.mostrar"),
                extra: opcion.oculto ? <span className="lesiones-oculta">{t("lesiones.ajustes.oculto")}</span> : null,
                alTocar: () => abrirOpcion(opcion),
              }),
            )}
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
      return (
        <div className="app">
          <div className="contenedor">
            {encabezado(t("lesiones.ajustes.listas"), t("gps.ajustes.listasAyuda"))}
            {LISTAS.map((lista) =>
              filaAjuste({
                id: lista.clave,
                titulo: tituloDeLista(lista),
                detalle: plural("lesiones.ajustes.opciones", opcionesDeLista(lista.clave, config, idioma, { test: gps }).length),
                alTocar: () => setVistaAjustes(`lista:${lista.clave}`),
              }),
            )}
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
          {encabezado(t("lesiones.ajustes.titulo"), t("gps.ajustes.texto"))}
          <AvisoSoloLectura hasta={equipo?.hasta} />
          {filaAjuste({
            id: "cabeceras",
            icono: "documento",
            titulo: t("lesiones.ajustes.cabeceras"),
            detalle: t("gps.ajustes.cabecerasTexto"),
            alTocar: () => setVistaAjustes("cabeceras"),
          })}
          {filaAjuste({
            id: "listas",
            icono: "filtro",
            titulo: t("lesiones.ajustes.listas"),
            detalle: t("gps.ajustes.listasTexto"),
            alTocar: () => setVistaAjustes("listas"),
          })}
          {filaAjuste({
            id: "reglas",
            icono: "reloj",
            titulo: t("gps.reglas.titulo"),
            detalle: t("gps.reglas.texto"),
            alTocar: () => setVistaAjustes("reglas"),
          })}
        </div>
      </div>
    );
  };

  // Mostrar u ocultar, como en Evaluaciones › Ajustes.
  const chipsMostrar = (hoja, setHoja) => (
    <div className="grilla-criterios">
      <button type="button" className={`chip-criterio ${!hoja.oculto ? "prendido" : ""}`} aria-pressed={!hoja.oculto} onClick={() => setHoja({ ...hoja, oculto: false })}>
        {t("lesiones.ajustes.mostrar")}
      </button>
      <button type="button" className={`chip-criterio ${hoja.oculto ? "prendido" : ""}`} aria-pressed={hoja.oculto} onClick={() => setHoja({ ...hoja, oculto: true })}>
        {t("lesiones.ajustes.oculto")}
      </button>
    </div>
  );

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
        {fija ? <p className="lesiones-ayuda lesiones-nota-fija">{t("gps.ajustes.noSeOculta")}</p> : chipsMostrar(hoja, setHoja)}
        {nota && <p className="lesiones-ayuda lesiones-nota-fija">{nota}</p>}
      </HojaInferior>
    ) : null;

  // --------------------------------------------------------- Navegación --

  let contenido;
  if (vista === "ajustes") contenido = pantallaAjustes();
  else if (vista === "cargar")
    contenido =
      cargandoDia && !soloLectura ? (
        <CargarGps
          key={cargaEnCurso ? `${cargaEnCurso.id}:${cargaEnCurso.version}` : "nueva"}
          gps={gps}
          config={config}
          equipoId={equipoId}
          plantel={plantel}
          plantelSinLeer={plantelSinLeer}
          reglas={reglas}
          columnas={columnas}
          fijas={fijas}
          armarFila={armarFila}
          conCambio={conCambio}
          enLinea={enLinea}
          enCurso={cargaEnCurso}
          onListo={alCargarDia}
          onCancelar={() => {
            setCargandoDia(false);
            setCargaEnCurso(null);
          }}
          onSinGuardar={avisarSinGuardar}
          onDejado={alDejarDia}
          onAbrirEnCurso={seguirEnCurso}
          onGuia={guia.abrir}
        />
      ) : (
        pantallaCargar
      );
  else if (importando && !soloLectura)
    contenido = (
      <ImportarGps
        gps={gps}
        config={config}
        equipoId={equipoId}
        plantel={plantel}
        plantelSinLeer={plantelSinLeer}
        onVolver={() => setImportando(false)}
        onGuia={guia.abrir}
        onRecargar={ponerAlDia}
        onListo={({ cargadas }) => {
          setImportando(false);
          setAviso(plural("gps.importar.listo", cargadas));
        }}
      />
    );
  else contenido = pantallaBase;

  // La guía: qué se hace en cada parte de GPS y las palabras propias.
  const contenidoDeLaGuia = {
    titulo: t("gps.guia.titulo"),
    intro: t("gps.guia.intro"),
    secciones: ["cargar", "base", "traer", "ajustes"].map((parte) => ({ titulo: t(`gps.guia.${parte}Titulo`), texto: t(`gps.guia.${parte}`) })),
    terminos: TERMINOS_GPS.map((termino) => ({ titulo: t(`gps.terminos.${termino}.titulo`), texto: t(`gps.terminos.${termino}.texto`) })),
  };

  // Tocar un destino de la barra cierra lo que estuviera encima.
  const irA = (id) => {
    setImportando(false);
    setCargandoDia(false);
    setCargaEnCurso(null);
    diaSinGuardar.current = false;
    if (id === "ajustes") setVistaAjustes("inicio");
    setVista(id);
  };
  // Un día a medio cargar no se tira sin preguntar.
  const navegar = (id) => {
    if (vista === "cargar" && cargandoDia && diaSinGuardar.current) {
      setASalir(id);
      return;
    }
    irA(id);
  };

  const columnaDeLaHoja = hojaCabecera ? gps.columnas.find((columna) => columna.clave === hojaCabecera.clave) : null;

  return (
    <MarcoAplicacion activo={vista} onNavigate={navegar} destinos={DESTINOS_GPS} marca={t("gps.titulo")} className="entrenamiento-marco lesiones-marco evaluaciones-marco gps-marco">
      {contenido}

      <GuiaDelModulo guia={contenidoDeLaGuia} abierta={guia.abierta} onCerrar={guia.cerrar} />
      <OfrecerGuia abierta={guia.ofrecer && !guia.abierta} modulo={t("gps.titulo")} onVer={guia.ver} onAhoraNo={guia.ahoraNo} />

      {aviso && (
        <div className="lesiones-toast" role="status">
          {aviso}
        </div>
      )}

      {hojaDeTextos({
        abierta: Boolean(hojaCabecera),
        titulo: hojaCabecera ? `${t("lesiones.ajustes.editarCabecera")}: ${columnaDeLaHoja ? titulo(columnaDeLaHoja) : hojaCabecera.clave}` : "",
        hoja: hojaCabecera,
        setHoja: setHojaCabecera,
        onGuardar: guardarHojaCabecera,
        onCerrar: () => !ocupado && setHojaCabecera(null),
        fija: Boolean(hojaCabecera && COLUMNAS_FIJAS.includes(hojaCabecera.clave)),
        // Quitar una columna es esconderla: lo cargado no se pierde.
        nota: hojaCabecera && !COLUMNAS_FIJAS.includes(hojaCabecera.clave) ? t("gps.ajustes.ocultarAyuda") : "",
      })}

      {hojaDeTextos({
        abierta: Boolean(hojaOpcion),
        titulo: hojaOpcion ? (hojaOpcion.codigo ? `${t("lesiones.ajustes.editarOpcion")}: ${tituloDeLista(LISTAS.find((lista) => lista.clave === hojaOpcion.lista) || { clave: hojaOpcion.lista })}` : t("lesiones.ajustes.nuevaOpcion")) : "",
        hoja: hojaOpcion,
        setHoja: setHojaOpcion,
        onGuardar: guardarHojaOpcion,
        onCerrar: () => !ocupado && setHojaOpcion(null),
      })}

      {hojaColumna && (
        <HojaInferior
          abierta
          className="lesiones-hoja"
          titulo={t("gps.ajustes.agregarColumna")}
          onCerrar={() => !ocupado && setHojaColumna(null)}
          acciones={
            <>
              <button type="button" className="boton-cancelar-hoja" onClick={() => setHojaColumna(null)} disabled={ocupado}>
                {t("comun.cancelar")}
              </button>
              <button type="button" className="boton-confirmar-hoja" onClick={guardarHojaColumna} disabled={ocupado}>
                {ocupado ? t("comun.guardando") : t("comun.guardar")}
              </button>
            </>
          }
        >
          {errorHoja && <div className="aviso-hoja">{errorHoja}</div>}
          <div className="campo-inicio">
            <label>{t("lesiones.ajustes.nombre")}</label>
            <input type="text" maxLength={120} value={hojaColumna.nombre} onChange={(evento) => setHojaColumna({ ...hojaColumna, nombre: evento.target.value })} />
            <small className="lesiones-ayuda">{t("gps.ajustes.nombreColumnaAyuda")}</small>
          </div>
          <div className="campo-inicio">
            <label>{t("gps.ajustes.tipo")}</label>
            <div className="grilla-criterios">
              {TIPOS_PROPIOS.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  className={`chip-criterio ${hojaColumna.tipo === tipo ? "prendido" : ""}`}
                  aria-pressed={hojaColumna.tipo === tipo}
                  onClick={() => setHojaColumna({ ...hojaColumna, tipo })}
                >
                  {tipoDeColumna(tipo)}
                </button>
              ))}
            </div>
            <small className="lesiones-ayuda">{t("gps.ajustes.tipoAyuda")}</small>
          </div>
        </HojaInferior>
      )}

      {hojaReglas && (
        <HojaInferior
          abierta
          className="lesiones-hoja"
          titulo={t(`gps.reglas.${hojaReglas.clave}.titulo`)}
          onCerrar={() => !ocupado && setHojaReglas(null)}
          acciones={
            <>
              <button type="button" className="boton-cancelar-hoja" onClick={() => setHojaReglas(null)} disabled={ocupado}>
                {t("comun.cancelar")}
              </button>
              <button type="button" className="boton-confirmar-hoja" onClick={guardarHojaReglas} disabled={ocupado || faltanReglas}>
                {ocupado ? t("comun.guardando") : t("comun.guardar")}
              </button>
            </>
          }
        >
          {errorHoja && <div className="aviso-hoja">{errorHoja}</div>}
          {faltanReglas && <div className="aviso-hoja">{t("gps.reglas.faltaMigracion")}</div>}
          <div className="campo-inicio">
            {hojaReglas.tipo === "prendida" ? (
              // Una lista va en un desplegable (Santiago, 01/10 y 12/10).
              <select
                className="gps-regla-desplegable"
                value={hojaReglas.valor ? "si" : "no"}
                onChange={(evento) => setHojaReglas({ ...hojaReglas, valor: evento.target.value === "si" })}
                aria-label={t(`gps.reglas.${hojaReglas.clave}.titulo`)}
              >
                <option value="si">{t("gps.reglas.prendido")}</option>
                <option value="no">{t("gps.reglas.apagado")}</option>
              </select>
            ) : hojaReglas.tipo === "vr" ? (
              <div className="gps-regla-vr">
                {VS_PARTIDO.medidas.map((clave) => (
                  <label key={clave}>
                    <span>{tituloDeMedida(clave)}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={hojaReglas.valor?.[clave] ?? ""}
                      onChange={(evento) => setHojaReglas({ ...hojaReglas, valor: { ...hojaReglas.valor, [clave]: evento.target.value } })}
                    />
                  </label>
                ))}
              </div>
            ) : hojaReglas.tipo === "campos" ? (
              <div className="tabla-datos-filtro-cuerpo">
                <ListaParaMarcar
                  valores={hojaReglas.opciones.map((campo) => ({ clave: campo, texto: t(`gps.reglas.${hojaReglas.clave}.campos.${campo}`) }))}
                  elegidos={hojaReglas.valor || []}
                  onCambiar={(elegidos) => setHojaReglas({ ...hojaReglas, valor: elegidos })}
                  busqueda={hojaReglas.busqueda || ""}
                  onBuscar={(busqueda) => setHojaReglas({ ...hojaReglas, busqueda })}
                />
              </div>
            ) : hojaReglas.tipo === "fecha" ? (
              <input type="date" value={hojaReglas.valor || ""} onChange={(evento) => setHojaReglas({ ...hojaReglas, valor: evento.target.value })} aria-label={t(`gps.reglas.${hojaReglas.clave}.titulo`)} />
            ) : (
              <div className="gps-regla-numero">
                <input
                  type="text"
                  inputMode={hojaReglas.tipo === "hora" ? "numeric" : "decimal"}
                  value={hojaReglas.valor ?? ""}
                  onChange={(evento) => setHojaReglas({ ...hojaReglas, valor: evento.target.value })}
                  aria-label={t(`gps.reglas.${hojaReglas.clave}.titulo`)}
                />
                {hojaReglas.tipo === "parte" && <span>%</span>}
              </div>
            )}
            <small className="lesiones-ayuda">{t(`gps.reglas.${hojaReglas.clave}.ayuda`, { valor: textoDeRegla(hojaReglas, REGLAS_CARGA[hojaReglas.clave]) })}</small>
          </div>
        </HojaInferior>
      )}

      <HojaConfirmar
        abierta={Boolean(aSalir)}
        titulo={t("gps.cargar.salirTitulo")}
        descripcion={t("gps.cargar.salirTexto")}
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

      <HojaConfirmar
        abierta={Boolean(aBorrar?.length)}
        titulo={aBorrar?.length > 1 ? t("gps.borrarVariasTitulo", { n: aBorrar.length }) : t("gps.borrarTitulo")}
        descripcion={
          aBorrar?.length > 1
            ? t("gps.borrarVariasTexto", { n: aBorrar.length })
            : t("gps.borrarTexto", { jugador: nombreDe(aBorrar?.[0]) || "—", fecha: aBorrar?.[0]?.fecha ? fechaCorta(aBorrar[0].fecha) : "—" })
        }
        icono="borrar"
        etiquetaConfirmar={t("gps.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBorrar}
        onCancelar={() => setABorrar(null)}
      />

      <HojaConfirmar
        abierta={Boolean(enCursoABorrar)}
        titulo={t("gps.enCurso.borrarTitulo", { fecha: enCursoABorrar ? fechaCorta(enCursoABorrar.fecha) : "—" })}
        descripcion={t("gps.enCurso.borrarTexto")}
        icono="borrar"
        etiquetaConfirmar={t("gps.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBorrarEnCurso}
        onCancelar={() => setEnCursoABorrar(null)}
      />
    </MarcoAplicacion>
  );
}
