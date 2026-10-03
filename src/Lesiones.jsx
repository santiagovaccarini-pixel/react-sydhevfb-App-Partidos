import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icono, MarcoAplicacion } from "./components/AppChrome";
import { EscudoDeClub } from "./components/ClubCrest";
import { BotonVolver, DatoDetalle } from "./components/BotonVolver.jsx";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { TablaDatos } from "./components/TablaDatos.jsx";
import { AvisoSoloLectura } from "./components/SoloLectura.jsx";
import ReportesLesiones from "./ReportesLesiones.jsx";
import ImportarLesiones from "./ImportarLesiones.jsx";
import { FiguraCuerpo } from "./components/FiguraCuerpo.jsx";
import { CAMPOS_DE_ESTRUCTURA, ElegirEstructura, ElegirZona, vistaDeLesion } from "./components/MapaCorporal.jsx";
import { CAMPOS_DEL_CUERPO, TERCIOS, crearMapa, partesPorNombre, tercioPorNombre } from "./domain/mapaCorporal.js";
import { cargarEquipos, elegirEquipoInicial, guardarEquipoElegido, leerEquipoElegido } from "./domain/equipo.js";
import {
  calcular,
  claveDeQuien,
  conValor,
  diasDeBaja,
  errorDeCampo,
  errorImagenAntes,
  erroresNuevos,
  estaActiva,
  etapaDe,
  horasHastaLaImagen,
  lesionVacia,
  lesionesActivas,
  lesionesSinFecha,
  tieneFecha,
  normalizarTexto,
  ordenarPorCaso,
  posibleRecidiva,
  validarLesion,
  valorDe,
} from "./domain/lesiones.js";
import {
  CAMPOS,
  CAMPOS_CON_LISTA,
  GRUPOS,
  OPCIONES,
  PASOS,
  TIPOS_MANUALES,
  campoOculto,
  campoPorClave,
  claveDeGrupo,
  codigoNuevo,
  etiquetaDeCampo,
  etiquetaDeGrupo,
  etiquetaDeOpcion,
  opcionesDeCampo,
} from "./domain/lesionesCampos.js";
import {
  actualizarLesion,
  borrarLesion,
  cargarPlantelLesiones,
  crearLesion,
  guardarCampo,
  guardarOpcion,
  historialDeLesion,
  leerConfig,
  listarLesiones,
} from "./domain/lesionesDb.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, fechaLarga, fechaYHora, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import "./lesiones.css";

// El módulo Lesiones, con la misma cara que Partido: fichas con "Ver
// detalle", la base estilo Excel, el historial de cada jugador y Ajustes con
// filas. Las columnas son las del Excel original (lesionesCampos.js),
// ordenadas por los grupos del Excel (Dados Gerais, Descrição Geral...): se
// cargan a mano solo las que el Excel no calcula; el resto se calcula igual
// que ahí.

export const DESTINOS_LESIONES = [
  { id: "lesionados", etiqueta: "Lesionados", icono: "usuario" },
  { id: "historial", etiqueta: "Historial", icono: "registros" },
  { id: "base", etiqueta: "Base", icono: "documento" },
  { id: "reportes", etiqueta: "Reportes", icono: "grafico" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

// Hasta esta cantidad, las opciones van como botones a la vista; con más, en la hoja con buscador.
const MAXIMO_CHIPS = 6;
// En la ficha, la pestaña de los cambios va después de las de los grupos.
const SECCION_CAMBIOS = "cambios";
// Las columnas que deciden si una lesión nueva puede ser recidiva.
const CAMPOS_DE_RECIDIVA = ["parte_cuerpo", "lado", "fecha_lesion"];

const primeraMayuscula = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "");

const EtapaChip = ({ lesion }) => {
  const etapa = etapaDe(lesion);
  return <span className={`lesiones-etapa ${etapa}`}>{t(`lesiones.etapa.${etapa}`)}</span>;
};

// Título de las pantallas que no son la principal, con el globo del idioma
// a la derecha.
const Encabezado = ({ titulo, texto, children = null }) => (
  <header className="encabezado lesiones-encabezado">
    <div className="lesiones-encabezado-texto">
      <h1>{titulo}</h1>
      {texto && <p>{texto}</p>}
      {children}
    </div>
    <SelectorIdioma className="lesiones-idioma" />
  </header>
);

export default function Lesiones({ onVolver }) {
  const { idioma, plural } = useIdioma();
  const [equipo, setEquipo] = useState(() => leerEquipoElegido());
  const [vista, setVista] = useState("lesionados");
  const [plantel, setPlantel] = useState([]);
  const [lesiones, setLesiones] = useState([]);
  const [config, setConfig] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));

  // Pantallas encima de la vista: la ficha de una lesión (con la pestaña que
  // se está mirando) y la carga por pasos.
  const [detalleId, setDetalleId] = useState(null);
  const [seccionFicha, setSeccionFicha] = useState(null);
  const [cambiosDetalle, setCambiosDetalle] = useState([]);
  // Sube con cada lesión guardada: la ficha vuelve a pedir sus cambios.
  const [guardadas, setGuardadas] = useState(0);
  const [formulario, setFormulario] = useState(null);
  const [paso, setPaso] = useState(0);
  const [pasoMaximo, setPasoMaximo] = useState(0);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [busquedaJugador, setBusquedaJugador] = useState("");
  // Los pasos donde se eligió cargar de la lista en vez de con la figura, y
  // desde dónde se mira la figura (de frente o de espaldas).
  const [deLaLista, setDeLaLista] = useState({});
  const [vistaCuerpo, setVistaCuerpo] = useState("frente");

  // Hojas: elegir de una lista (como los desplegables de Partido), dar el
  // alta, borrar.
  const [hojaSelector, setHojaSelector] = useState(null);
  const [aDarAlta, setADarAlta] = useState(null);
  const [fechaAlta, setFechaAlta] = useState(hoyISO());
  const [aBorrar, setABorrar] = useState(null);

  // El historial es de un jugador: se lo busca por el nombre.
  const [jugadorHistorial, setJugadorHistorial] = useState("");
  const [busquedaHistorial, setBusquedaHistorial] = useState("");

  // Ajustes: cabeceras y listas del club.
  const [vistaAjustes, setVistaAjustes] = useState("inicio");
  // Base › Pegar desde Excel.
  const [importando, setImportando] = useState(false);
  const [hojaCabecera, setHojaCabecera] = useState(null);
  const [hojaOpcion, setHojaOpcion] = useState(null);
  const [errorHoja, setErrorHoja] = useState("");

  const equipoId = equipo?.id || null;
  // Quien ya se fue del club ve lo cargado hasta su último día y no cambia nada.
  const soloLectura = Boolean(equipo?.hasta);

  // Sin club elegido en este celular, se adopta el que diga la base, igual
  // que hace Partido al abrir.
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

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    const [respuestaPlantel, respuestaLesiones, respuestaConfig] = await Promise.all([
      cargarPlantelLesiones(equipoId),
      listarLesiones(equipoId),
      leerConfig(equipoId),
    ]);
    setPlantel(respuestaPlantel.plantel || []);
    setConfig(respuestaConfig.config);
    if (respuestaLesiones.error || respuestaConfig.error) {
      setError(respuestaLesiones.error || respuestaConfig.error);
    } else {
      setLesiones(respuestaLesiones.lesiones);
    }
    setCargando(false);
  }, [equipoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

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

  // La ficha trae sus últimos cambios cuando se abre y cada vez que se
  // guarda algo. Quien ya se fue del club no los ve: la lista tendría lo que
  // se cambió después de su último día.
  useEffect(() => {
    if (!detalleId || soloLectura) return undefined;
    let vigente = true;
    historialDeLesion(detalleId).then((respuesta) => vigente && setCambiosDetalle(respuesta.cambios));
    return () => {
      vigente = false;
    };
  }, [detalleId, soloLectura, guardadas]);

  useEffect(() => {
    setCambiosDetalle([]);
  }, [detalleId]);

  // ------------------------------------------------------------- Ayudas --

  const jugadorDe = (id) => plantel.find((jugador) => String(jugador.id) === String(id)) || null;
  // De quién es una lesión: el jugador de Datos básicos, o el nombre de la
  // persona que no está ahí (vino en una base pegada).
  const nombreDeLesion = (lesion) => jugadorDe(lesion?.jugador_id)?.nombre || lesion?.persona || "";
  const etiqueta = (clave) => etiquetaDeCampo(clave, config, idioma);
  const opciones = (clave) => opcionesDeCampo(clave, config, idioma);
  const textoDeOpcion = (clave, codigo) => etiquetaDeOpcion(clave, codigo, config, idioma);
  const visible = (campo) => !campoOculto(campo.clave, config);
  // Dónde va en el cuerpo cada opción de las listas, también las que agregó el club.
  const mapa = useMemo(() => crearMapa(config?.listas), [config]);
  const delCatalogo = (clave, codigo) => (OPCIONES[clave] || []).some((opcion) => opcion.codigo === codigo);
  // Cómo se dice en Ajustes dónde va una opción: las partes del cuerpo (o
  // que va en todas, si no se reconoce) o, en el área, el tercio.
  const textoDondeVa = (clave, partes, tercio) => {
    if (clave === "area") return TERCIOS.includes(tercio) ? t("lesiones.ajustes.vaConTercio", { tercio: t(`lesiones.cuerpo.tercios.${tercio}`) }) : t("lesiones.ajustes.sinTercio");
    return partes?.length ? t("lesiones.ajustes.vaEn", { partes: partes.map((parte) => textoDeOpcion("parte_cuerpo", parte)).join(", ") }) : t("lesiones.ajustes.vaEnTodas");
  };
  // Las partes del cuerpo del catálogo son la figura: no hace falta decir dónde van.
  const dondeVa = (clave, codigo) =>
    CAMPOS_DEL_CUERPO.includes(clave) && !(clave === "parte_cuerpo" && delCatalogo(clave, codigo)) ? textoDondeVa(clave, mapa.partesDeOpcion(clave, codigo), mapa.tercioDeArea(codigo)) : "";
  // Mientras se escribe una opción nueva (o una del club), dónde va a ir.
  const dondeVaAlEscribir = (hoja) => {
    if (!CAMPOS_DEL_CUERPO.includes(hoja.campo)) return "";
    if (delCatalogo(hoja.campo, hoja.codigo)) return dondeVa(hoja.campo, hoja.codigo);
    const textos = Object.values(hoja.etiquetas || {}).filter((texto) => String(texto || "").trim());
    return textos.length ? textoDondeVa(hoja.campo, partesPorNombre(...textos), tercioPorNombre(...textos)) : "";
  };
  // Lo que necesita el cálculo de las columnas del Excel.
  const contexto = useMemo(() => ({ lesiones, texto: textoDeOpcion, hoy: hoyISO() }), [lesiones, config, idioma]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cómo se muestra cada columna del Excel en una lesión.
  const enPantalla = (campo, lesion) => {
    const jugador = jugadorDe(lesion.jugador_id);
    switch (campo.tipo) {
      case "auto":
        return lesion.numero_caso ? String(lesion.numero_caso) : "";
      case "jugador":
        return jugador?.nombre || lesion.persona || "";
      case "dato_jugador": {
        const valor = campo.clave === "categoria" ? lesion.datos?.categoria || jugador?.categoria : jugador?.[campo.clave];
        if (!valor) return "";
        if (campo.lista) return textoDeOpcion(campo.clave, valor);
        if (campo.clave === "fecha_nacimiento") return fechaCorta(valor);
        return String(valor);
      }
      case "calculado": {
        const resultado = calcular(campo.clave, lesion, jugador, contexto);
        if (resultado === null || resultado === undefined || resultado === "") return "";
        if (campo.lista) return textoDeOpcion(campo.clave, resultado);
        if (campo.clave === "edad") return plural("lesiones.anios", resultado);
        if (["recup_1", "recup_2", "recuperacion"].includes(campo.clave)) return plural("lesiones.dias", resultado);
        if (campo.clave === "horas_imagen") return plural("lesiones.horas", resultado);
        return String(resultado);
      }
      case "lista":
        return textoDeOpcion(campo.clave, valorDe(lesion, campo.clave));
      case "fecha":
        return fechaCorta(valorDe(lesion, campo.clave));
      case "fecha_hora":
        return fechaYHora(valorDe(lesion, campo.clave));
      case "numero": {
        const valor = valorDe(lesion, campo.clave);
        return valor === null || valor === undefined || valor === "" ? "" : String(valor);
      }
      default:
        return String(valorDe(lesion, campo.clave) || "");
    }
  };

  const activas = useMemo(() => lesionesActivas(lesiones), [lesiones]);
  // Las que vinieron sin fecha de inicio: quedan para completar.
  const sinFecha = useMemo(() => lesionesSinFecha(lesiones), [lesiones]);
  // Los pasos de la carga que tienen alguna columna a la vista (una columna
  // escondida en Ajustes puede dejar un paso vacío, y ese paso se saltea).
  const pasos = useMemo(() => PASOS.filter((unPaso) => unPaso.campos.some((clave) => !campoOculto(clave, config))), [config]);
  // Lo que el club escondió no se revisa: no se ve ni se puede corregir.
  const oculto = (clave) => campoOculto(clave, config);
  // El día de la lesión va en un paso posterior al de la imagen (Evolución):
  // la imagen se compara con él en ese paso, cuando ya está cargado.
  const pasoDe = (clave) => pasos.findIndex((unPaso) => unPaso.campos.includes(clave));
  const claveDelCruce = pasoDe("fecha_lesion") > pasoDe("hora_imagen") ? "fecha_lesion" : "hora_imagen";
  // Las horas hasta la imagen que se muestran al cargar (si esa columna se ve).
  const horasALaVista = (fecha, hora) => {
    if (oculto("horas_imagen") || oculto("hora_imagen")) return null;
    // Con la imagen de antes del día de la lesión va el error, no las horas.
    if (errorImagenAntes({ fecha_lesion: fecha, datos: { hora_imagen: hora } })) return null;
    const horas = horasHastaLaImagen(fecha, hora);
    return horas !== null && horas >= 0 ? horas : null;
  };
  const lesionDetalle = detalleId ? lesiones.find((lesion) => lesion.id === detalleId) || null : null;

  const avisarError = (clave, lesion) =>
    setAviso(
      t(clave, {
        parte: textoDeOpcion("parte_cuerpo", lesion?.datos?.parte_cuerpo),
        lado: textoDeOpcion("lado", lesion?.datos?.lado),
      }),
    );

  const reemplazar = (lesion) => {
    setLesiones((actuales) => {
      const existe = actuales.some((otra) => otra.id === lesion.id);
      return existe ? actuales.map((otra) => (otra.id === lesion.id ? lesion : otra)) : [lesion, ...actuales];
    });
    setGuardadas((cuantas) => cuantas + 1);
  };

  // El botón negro que muestra lo elegido y sube la hoja para cambiarlo: lo
  // mismo que usa Partido en vez de los desplegables del sistema.
  const selectorConHoja = ({ titulo, opciones: lista, valor, alElegir, clase = "" }) => {
    const elegida = lista.find((una) => una.valor === valor);
    return (
      <button
        type="button"
        className={`selector-hoja ${clase}`.trim()}
        aria-label={titulo}
        onClick={() => setHojaSelector({ titulo, opciones: lista, valor, alElegir })}
      >
        <b>{elegida && elegida.valor !== "" ? elegida.etiqueta : titulo}</b>
        <Icono nombre="flecha" size={15} />
      </button>
    );
  };

  // ------------------------------------------------------------ Acciones --

  const abrirFicha = (id) => {
    setSeccionFicha(null);
    setDetalleId(id);
  };

  const abrirNueva = () => {
    setErrorFormulario("");
    setBusquedaJugador("");
    setDeLaLista({});
    setVistaCuerpo("frente");
    setSeccionFicha(null);
    setPaso(0);
    setPasoMaximo(0);
    setFormulario(lesionVacia());
  };

  // Al editar se abre en el paso del grupo que se estaba mirando en la ficha;
  // si ese grupo no es un paso (Diagnóstico, Cambios), en el de la lesión.
  const abrirEdicion = (lesion, grupo = null) => {
    const delGrupo = pasos.findIndex((unPaso) => unPaso.id === grupo);
    setErrorFormulario("");
    setDeLaLista({});
    // La figura, como en la ficha: de espaldas si la lesión es de atrás.
    setVistaCuerpo(vistaDeLesion(mapa.piezaDe(lesion.datos?.parte_cuerpo, mapa.regionDe(lesion.datos?.parte_cuerpo, lesion.datos?.lado)), lesion.datos?.musculo));
    setPaso(delGrupo >= 0 ? delGrupo : Math.min(1, pasos.length - 1));
    setPasoMaximo(pasos.length - 1);
    setFormulario({ ...lesion, datos: { ...(lesion.datos || {}) } });
  };

  const cerrarFormulario = () => {
    setFormulario(null);
    setErrorFormulario("");
  };

  const guardarFormulario = async () => {
    const lesion = formulario;
    const hoy = hoyISO();
    // Lo que falta se muestra en el paso donde se corrige (al editar se puede
    // guardar desde cualquier paso).
    const pasoConError = pasos.findIndex((_, indice) => validarPaso(indice, lesion));
    if (pasoConError >= 0) {
      setErrorFormulario(validarPaso(pasoConError, lesion));
      setPaso(pasoConError);
      return;
    }
    const falta = validarLesion(lesion, { hoy, otras: lesiones, oculto });
    if (falta) {
      setErrorFormulario(
        t(falta, { parte: textoDeOpcion("parte_cuerpo", lesion.datos?.parte_cuerpo), lado: textoDeOpcion("lado", lesion.datos?.lado) }),
      );
      return;
    }
    const jugador = jugadorDe(lesion.jugador_id);
    const datos = { ...(lesion.datos || {}) };
    // La categoría queda como estaba el día de la lesión.
    if (!datos.categoria && jugador?.categoria) datos.categoria = jugador.categoria;
    const aGuardar = { ...lesion, datos };
    setOcupado(true);
    const respuesta = lesion.id ? await actualizarLesion(lesion.id, aGuardar) : await crearLesion(equipoId, aGuardar);
    setOcupado(false);
    if (respuesta.error) {
      setErrorFormulario(
        t(respuesta.error, { parte: textoDeOpcion("parte_cuerpo", datos.parte_cuerpo), lado: textoDeOpcion("lado", datos.lado) }),
      );
      return;
    }
    reemplazar(respuesta.lesion);
    setFormulario(null);
    setDetalleId(respuesta.lesion.id);
    setAviso(t("lesiones.guardado"));
  };

  const confirmarAlta = async () => {
    const lesion = aDarAlta;
    if (!lesion) return;
    const hoy = hoyISO();
    // Sin fecha de inicio, primero hay que completarla (editando la lesión).
    if (!tieneFecha(lesion)) return setAviso(t("lesiones.error.fecha"));
    if (!fechaAlta || fechaAlta < lesion.fecha_lesion) return setAviso(t("lesiones.error.fechaAntes"));
    if (fechaAlta > hoy) return setAviso(t("lesiones.error.fechaFuturaOtra"));
    setOcupado(true);
    const respuesta = await actualizarLesion(lesion.id, { ...lesion, fecha_alta: fechaAlta });
    setOcupado(false);
    if (respuesta.error) return avisarError(respuesta.error, lesion);
    reemplazar(respuesta.lesion);
    setADarAlta(null);
    setAviso(t("lesiones.altaGuardada"));
    return undefined;
  };

  const confirmarBorrar = async () => {
    const lesion = aBorrar;
    setABorrar(null);
    if (!lesion) return;
    setOcupado(true);
    const respuesta = await borrarLesion(lesion.id);
    setOcupado(false);
    if (respuesta.error) {
      avisarError(respuesta.error, lesion);
      return;
    }
    setLesiones((actuales) => actuales.filter((otra) => otra.id !== lesion.id));
    if (detalleId === lesion.id) setDetalleId(null);
    if (formulario?.id === lesion.id) setFormulario(null);
    setAviso(t("lesiones.borrada"));
  };

  const recargarConfig = async () => {
    const respuesta = await leerConfig(equipoId);
    if (!respuesta.error) setConfig(respuesta.config);
  };

  const guardarHojaCabecera = async () => {
    const hoja = hojaCabecera;
    if (!hoja) return;
    if (!String(hoja.etiquetas[idioma] || "").trim()) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    setOcupado(true);
    const respuesta = await guardarCampo(equipoId, hoja.clave, hoja);
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    await recargarConfig();
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
    const respuesta = await guardarOpcion(equipoId, hoja.campo, {
      ...hoja,
      codigo: hoja.codigo || codigoNuevo(propio),
    });
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    await recargarConfig();
    setHojaOpcion(null);
    setAviso(t("lesiones.ajustes.guardado"));
  };

  // ----------------------------------------------- Historial por jugador --

  // Los del plantel y, después, quienes no están en Datos básicos pero tienen
  // lesiones (vinieron en una base pegada), cada uno con su clave.
  const todosDelHistorial = useMemo(() => {
    const cuantas = new Map();
    const personas = new Map();
    lesiones.forEach((lesion) => {
      const clave = claveDeQuien(lesion);
      if (!clave) return;
      cuantas.set(clave, (cuantas.get(clave) || 0) + 1);
      if (!lesion.jugador_id && !personas.has(clave)) personas.set(clave, lesion.persona);
    });
    return [
      ...plantel.map((jugador) => ({ clave: `j:${jugador.id}`, nombre: jugador.nombre, cuantas: cuantas.get(`j:${jugador.id}`) || 0, fuera: false })),
      ...[...personas.entries()]
        .map(([clave, nombre]) => ({ clave, nombre, cuantas: cuantas.get(clave), fuera: true }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    ];
  }, [plantel, lesiones]);
  const jugadoresDelHistorial = useMemo(() => {
    const buscado = normalizarTexto(busquedaHistorial);
    return todosDelHistorial.filter((uno) => !buscado || normalizarTexto(uno.nombre).includes(buscado));
  }, [todosDelHistorial, busquedaHistorial]);
  const elegidoHistorial = jugadorHistorial ? todosDelHistorial.find((uno) => uno.clave === jugadorHistorial) || null : null;

  // ------------------------------------------------------------ Pantallas --

  const hoy = primeraMayuscula(fechaLarga(hoyISO()));

  const estado = !enLinea ? (
    <p className="lesiones-estado">{t("lesiones.estado.sinConexion")}</p>
  ) : error ? (
    <div className="lesiones-estado error">
      {t(error)}{" "}
      <button type="button" onClick={cargar}>
        {t("comun.reintentar")}
      </button>
    </div>
  ) : cargando ? (
    <p className="lesiones-estado">{t("lesiones.estado.cargando")}</p>
  ) : null;

  // Una lesión en la lista, con la misma cara que un registro de Partido.
  const tarjetaLesion = (lesion, { conAlta = false } = {}) => (
    <div className="registro-guardado lesiones-registro" key={lesion.id}>
      <span className="cabecera-registro">
        <span className="fecha-registro">{lesion.fecha_lesion ? fechaCorta(lesion.fecha_lesion) : "—"}</span>
        <EtapaChip lesion={lesion} />
        {lesion.numero_caso && <span className="lesiones-caso">{t("lesiones.caso", { n: lesion.numero_caso })}</span>}
      </span>
      <div className="lesiones-registro-cuerpo">
        <strong>{nombreDeLesion(lesion) || "—"}</strong>
        <span>{enPantalla(campoPorClave("diagnostico"), lesion) || textoDeOpcion("parte_cuerpo", lesion.datos?.parte_cuerpo)}</span>
      </div>
      <div className="tiempos-registro">
        {lesion.fecha_lesion && (
          <span>
            {etiqueta("recuperacion")} <strong>{plural("lesiones.dias", diasDeBaja(lesion))}</strong>
          </span>
        )}
        {lesion.fecha_alta && tieneFecha(lesion) && (
          <span>
            {etiqueta("severidad")} <strong>{enPantalla(campoPorClave("severidad"), lesion)}</strong>
          </span>
        )}
      </div>
      <div className="acciones-registro">
        <button type="button" className="boton-detalle" onClick={() => abrirFicha(lesion.id)}>
          {t("lesiones.verDetalle")}
        </button>
        {conAlta && estaActiva(lesion) && !soloLectura && (
          <button
            type="button"
            className="boton-detalle"
            onClick={() => {
              setFechaAlta(hoyISO());
              setADarAlta(lesion);
            }}
          >
            {t("lesiones.darAlta")}
          </button>
        )}
        {!soloLectura && (
          <button type="button" className="boton-eliminar-registro" aria-label={t("lesiones.borrar")} onClick={() => setABorrar(lesion)}>
            <Icono nombre="borrar" size={18} />
          </button>
        )}
      </div>
    </div>
  );

  const pantallaLesionados = (
    <div className="app app-inicio">
      <div className="contenedor contenedor-inicio-formacion">
        <header className="hero-partido hero-lesiones">
          <div className="hero-lesiones-barra">
            {onVolver ? (
              <button type="button" className="boton-modulos" onClick={onVolver}>
                <Icono nombre="flecha" size={14} />
                {t("portal.modulos")}
              </button>
            ) : (
              <span />
            )}
            <SelectorIdioma />
          </div>
          <div className="hero-lesiones-club">
            <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
            <span className="etiqueta-hero">{t("lesiones.titulo").toUpperCase()}</span>
            <strong className="nombre-sesion">{equipo?.nombre || t("lesiones.hoy")}</strong>
            <p className="fecha-hero">{hoy}</p>
            <span className={`estado-hero ${activas.length ? "en-curso" : ""}`}>{plural("lesiones.activas", activas.length)}</span>
          </div>
        </header>

        <AvisoSoloLectura hasta={equipo?.hasta} />
        {estado}

        {!soloLectura && (
          <div className="acciones-inicio lesiones-acciones">
            <button type="button" className="boton-principal boton-formacion-grande" onClick={abrirNueva} disabled={!enLinea || Boolean(error) || cargando}>
              {t("lesiones.nueva")}
            </button>
          </div>
        )}

        {!cargando && !error && activas.length === 0 && <p className="lesiones-vacio">{t("lesiones.sinActivas")}</p>}
        <div className="lesiones-lista">{activas.map((lesion) => tarjetaLesion(lesion, { conAlta: true }))}</div>

        {sinFecha.length > 0 && (
          <section className="lesiones-sin-fecha">
            <h2>{plural("lesiones.sinFecha.titulo", sinFecha.length)}</h2>
            <p className="lesiones-ayuda">{t("lesiones.sinFecha.texto")}</p>
            <div className="lesiones-lista">{sinFecha.map((lesion) => tarjetaLesion(lesion))}</div>
          </section>
        )}
      </div>
    </div>
  );

  // La base estilo Excel: una fila por lesión, una columna por cabecera, y
  // arriba la fila de los grupos del Excel.
  const columnasBase = useMemo(
    () =>
      CAMPOS.filter(visible).map((campo) => ({
        clave: campo.clave,
        titulo: etiquetaDeCampo(campo.clave, config, idioma),
        grupo: campo.grupo,
        grupoTitulo: etiquetaDeGrupo(campo.grupo, config, idioma),
        tipo: campo.tipo,
        editable: !soloLectura && TIPOS_MANUALES.includes(campo.tipo),
        opciones:
          campo.tipo === "lista"
            ? opcionesDeCampo(campo.clave, config, idioma).map((opcion) => ({
                ...opcion,
                // Para pegar: también vale el texto en el otro idioma.
                alias: [etiquetaDeOpcion(campo.clave, opcion.valor, config, idioma === "pt-BR" ? "es-AR" : "pt-BR")],
              }))
            : undefined,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, idioma, soloLectura],
  );

  // Para ordenar, lo que no es el valor guardado: el nombre del jugador (no su
  // id), su fecha de nacimiento y los números que se calculan.
  const ordenDe = (campo, lesion) => {
    const jugador = jugadorDe(lesion.jugador_id);
    if (campo.tipo === "jugador") return jugador?.nombre || lesion.persona || "";
    if (campo.clave === "fecha_nacimiento") return jugador?.fecha_nacimiento || "";
    if (campo.tipo === "calculado") {
      const resultado = calcular(campo.clave, lesion, jugador, contexto);
      return typeof resultado === "number" ? resultado : undefined;
    }
    return undefined;
  };

  // Como en el Excel: por n° de caso, las nuevas abajo.
  const filasBase = useMemo(
    () =>
      ordenarPorCaso(lesiones).map((lesion) => ({
        id: lesion.id,
        // De quién es (jugador o persona), para el historial.
        quien: claveDeQuien(lesion),
        valores: Object.fromEntries(CAMPOS.map((campo) => [campo.clave, campo.tipo === "jugador" ? lesion.jugador_id : valorDe(lesion, campo.clave)])),
        textos: Object.fromEntries(CAMPOS.map((campo) => [campo.clave, enPantalla(campo, lesion)])),
        orden: Object.fromEntries(CAMPOS.map((campo) => [campo.clave, ordenDe(campo, lesion)]).filter(([, valor]) => valor !== undefined)),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesiones, plantel, config, idioma],
  );
  // El historial de un jugador: la misma base, con sus lesiones nada más.
  const filasHistorial = useMemo(
    () => (jugadorHistorial ? filasBase.filter((fila) => fila.quien === jugadorHistorial) : []),
    [filasBase, jugadorHistorial],
  );

  // Lo que necesitan los errores que nombran la lesión (la misma lesión dos
  // veces): su parte y su lado.
  const variablesDelError = (lesion) => ({ parte: textoDeOpcion("parte_cuerpo", lesion?.datos?.parte_cuerpo), lado: textoDeOpcion("lado", lesion?.datos?.lado) });

  const editarCelda = async (lesionId, clave, valor) => {
    const lesion = lesiones.find((una) => una.id === lesionId);
    if (!lesion) return { error: "lesiones.error.noGuardar" };
    const nueva = conValor(lesion, clave, valor);
    // Solo frena lo que rompe esta edición (no lo que ya le faltaba a la lesión).
    const falta = erroresNuevos(lesion, nueva, { hoy: hoyISO(), otras: lesiones, oculto })[0]?.error;
    if (falta) return { error: falta, variables: variablesDelError(nueva) };
    const respuesta = await actualizarLesion(lesion.id, nueva);
    if (respuesta.error) return { error: respuesta.error, variables: variablesDelError(nueva) };
    reemplazar(respuesta.lesion);
    return {};
  };

  const pegarEnBase = async (cambios) => {
    const porLesion = new Map();
    cambios.forEach((cambio) => {
      if (!porLesion.has(cambio.filaId)) porLesion.set(cambio.filaId, []);
      porLesion.get(cambio.filaId).push(cambio);
    });
    let hechos = 0;
    let ultimoError = "";
    let variables;
    for (const [lesionId, suyos] of porLesion) {
      const lesion = lesiones.find((una) => una.id === lesionId);
      if (!lesion) continue;
      const nueva = suyos.reduce((acumulada, cambio) => conValor(acumulada, cambio.clave, cambio.valor), lesion);
      const falta = erroresNuevos(lesion, nueva, { hoy: hoyISO(), otras: lesiones, oculto })[0]?.error;
      if (falta) {
        ultimoError = falta;
        variables = variablesDelError(nueva);
        continue;
      }
      const respuesta = await actualizarLesion(lesion.id, nueva); // eslint-disable-line no-await-in-loop
      if (respuesta.error) {
        ultimoError = respuesta.error;
        variables = variablesDelError(nueva);
        continue;
      }
      reemplazar(respuesta.lesion);
      hechos += suyos.length;
    }
    return { hechos, error: ultimoError, variables };
  };

  // La tabla de lesiones: la de la Base y la del historial de un jugador
  // son la misma (mismas columnas y mismo orden de columnas guardado). Cada
  // una recuerda sus filtros al abrir una ficha y volver.
  const tablaDeLesiones = (filas, clave = "todas") => (
    <TablaDatos
      key={clave}
      id="lesiones"
      recordar={`lesiones:${clave}`}
      columnas={columnasBase}
      filas={filas}
      onEditar={editarCelda}
      onPegar={pegarEnBase}
      onAbrirFila={abrirFicha}
      onBorrarFila={
        soloLectura
          ? undefined
          : (id) => {
              const lesion = lesiones.find((una) => una.id === id);
              if (lesion) setABorrar(lesion);
            }
      }
    />
  );

  const pantallaBase = (
    <div className="app">
      <div className="contenedor contenedor-base">
        <Encabezado titulo={t("nav.base")} texto={t("tabla.editar")} />
        {estado}
        {!soloLectura && (
          <button type="button" className="boton-secundario datos-pegar-excel lesiones-pegar-excel" onClick={() => setImportando(true)} disabled={!enLinea || cargando || Boolean(error)}>
            <Icono nombre="documento" size={16} />
            {t("lesiones.importar.boton")}
          </button>
        )}
        <section className="tarjeta">{tablaDeLesiones(filasBase)}</section>
      </div>
    </div>
  );

  // El historial de un jugador: se busca por el nombre y queda su base, con
  // sus lesiones nada más. Elegido, la lista se retrae como en Partido.
  const pantallaHistorial = (
    <div className="app">
      <div className="contenedor contenedor-base">
        <Encabezado titulo={t("lesiones.historial.titulo")} texto={t("lesiones.historial.texto")} />
        {estado}
        <section className="tarjeta lesiones-elegir-jugador">
          {elegidoHistorial ? (
            <button
              type="button"
              className="rival-elegido"
              onClick={() => {
                setJugadorHistorial("");
                setBusquedaHistorial("");
              }}
            >
              <b>{elegidoHistorial.nombre}</b>
              <span>{t("lesiones.pasos.cambiar")}</span>
            </button>
          ) : (
            <>
              <input
                className="lesiones-buscador-jugador"
                type="search"
                value={busquedaHistorial}
                onChange={(evento) => setBusquedaHistorial(evento.target.value)}
                placeholder={t("lesiones.historial.buscar")}
                aria-label={t("lesiones.historial.buscar")}
                autoComplete="off"
              />
              {!cargando && todosDelHistorial.length === 0 && <p className="lesiones-ayuda">{t("lesiones.sinJugadores")}</p>}
              {todosDelHistorial.length > 0 && (
                <div className="lista-rivales lesiones-lista-jugadores">
                  {jugadoresDelHistorial.length === 0 ? (
                    <p className="sin-resultados">{t("lesiones.pasos.ningunJugador")}</p>
                  ) : (
                    jugadoresDelHistorial.map((uno) => (
                      <button type="button" key={uno.clave} onClick={() => setJugadorHistorial(uno.clave)}>
                        <b>{uno.nombre}</b>
                        <span>{[plural("lesiones.historial.cantidad", uno.cuantas), uno.fuera ? t("lesiones.fueraDeDatos") : ""].filter(Boolean).join(" · ")}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {elegidoHistorial && (
          <section className="tarjeta">
            <p className="lesiones-cantidad">{plural("lesiones.historial.cantidad", filasHistorial.length)}</p>
            {filasHistorial.length === 0 ? (
              <p className="vacio-ficha">{t("lesiones.historial.sinLesiones")}</p>
            ) : (
              tablaDeLesiones(filasHistorial, `jugador-${jugadorHistorial}`)
            )}
          </section>
        )}
      </div>
    </div>
  );

  // Ajustes, con el mismo formato que en Flujo diario: filas, y adentro de
  // cada una su pantalla con "Volver a Ajustes".
  const filaAjuste = ({ id, icono, titulo, detalle, alTocar, extra = null, clase = "" }) => (
    <button key={id} type="button" className={`opcion-ajuste ${clase}`.trim()} onClick={alTocar} disabled={soloLectura}>
      {icono && (
        <span className="icono-ajuste">
          <Icono nombre={icono} size={18} />
        </span>
      )}
      <span className="texto-ajuste">
        <b>{titulo}</b>
        <span>{detalle}</span>
      </span>
      {extra}
      <span className="flecha-ajuste">›</span>
    </button>
  );

  const pantallaAjustes = () => {
    if (vistaAjustes === "cabeceras") {
      return (
        <div className="app">
          <div className="contenedor">
            <Encabezado titulo={t("lesiones.ajustes.cabeceras")} texto={t("lesiones.ajustes.cabecerasAyuda")} />
            {/* Cada grupo del Excel con sus columnas abajo: el grupo también
                se renombra (es la fila de arriba de las cabeceras). */}
            {GRUPOS.map((grupo, indiceGrupo) => {
              const suyos = CAMPOS.filter((campo) => campo.grupo === grupo.clave);
              const claveGrupo = claveDeGrupo(grupo.clave);
              return (
                <React.Fragment key={grupo.clave}>
                  {filaAjuste({
                    id: claveGrupo,
                    clase: "lesiones-ajuste-grupo",
                    titulo: etiquetaDeGrupo(grupo.clave, config, idioma),
                    detalle: plural("lesiones.ajustes.grupoDe", suyos.length),
                    alTocar: () => {
                      setErrorHoja("");
                      const propio = config?.campos?.[claveGrupo];
                      setHojaCabecera({
                        clave: claveGrupo,
                        grupo: grupo.clave,
                        etiquetas: { ...(propio?.etiquetas || grupo.etiquetas) },
                        oculto: false,
                        orden: propio?.orden ?? 1000 + indiceGrupo,
                      });
                    },
                  })}
                  {suyos.map((campo) =>
                    filaAjuste({
                      id: campo.clave,
                      titulo: etiqueta(campo.clave),
                      detalle: t("lesiones.ajustes.porDefecto", { texto: campo.etiquetas[idioma] || campo.etiquetas["es-AR"] }),
                      extra: campoOculto(campo.clave, config) ? <span className="lesiones-oculta">{t("lesiones.ajustes.oculto")}</span> : null,
                      alTocar: () => {
                        setErrorHoja("");
                        const propio = config?.campos?.[campo.clave];
                        setHojaCabecera({
                          clave: campo.clave,
                          etiquetas: { ...(propio?.etiquetas || campo.etiquetas) },
                          oculto: Boolean(propio?.oculto),
                          orden: propio?.orden ?? CAMPOS.indexOf(campo),
                        });
                      },
                    }),
                  )}
                </React.Fragment>
              );
            })}
            <div className="acciones-dobles">
              <BotonVolver onClick={() => setVistaAjustes("inicio")}>{t("lesiones.ajustes.volver")}</BotonVolver>
            </div>
          </div>
        </div>
      );
    }

    if (vistaAjustes.startsWith("lista:")) {
      const clave = vistaAjustes.slice("lista:".length);
      const campo = campoPorClave(clave);
      const todas = opcionesDeCampo(clave, config, idioma, { conOcultas: true });
      const abrirOpcion = (opcion) => {
        setErrorHoja("");
        const guardada = (config?.listas?.[clave] || []).find((una) => una.codigo === opcion?.valor);
        setHojaOpcion({
          campo: clave,
          codigo: opcion?.valor || null,
          etiquetas: { ...(guardada?.etiquetas || { "es-AR": "", "pt-BR": "" }) },
          oculto: Boolean(guardada?.oculto),
          orden: guardada?.orden ?? todas.length,
        });
      };
      return (
        <div className="app">
          <div className="contenedor">
            <Encabezado
              titulo={etiqueta(clave)}
              texto={CAMPOS_DEL_CUERPO.includes(clave) ? `${plural("lesiones.ajustes.opciones", todas.length)}. ${t("lesiones.ajustes.seUbicanSolas")}` : plural("lesiones.ajustes.opciones", todas.length)}
            />
            {todas.map((opcion) =>
              filaAjuste({
                id: opcion.valor,
                titulo: opcion.etiqueta,
                // En las listas del cuerpo, dónde va cada una.
                detalle: dondeVa(clave, opcion.valor) || (opcion.oculto ? t("lesiones.ajustes.oculto") : t("lesiones.ajustes.mostrar")),
                extra: opcion.oculto ? <span className="lesiones-oculta">{t("lesiones.ajustes.oculto")}</span> : null,
                alTocar: () => abrirOpcion(opcion),
              }),
            )}
            <div className="acciones-dobles">
              <BotonVolver onClick={() => setVistaAjustes("listas")}>{t("lesiones.ajustes.volverListas")}</BotonVolver>
              <button type="button" className="boton-principal" onClick={() => abrirOpcion(null)} disabled={!campo}>
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
            <Encabezado titulo={t("lesiones.ajustes.listas")} texto={t("lesiones.ajustes.listasAyuda")} />
            {CAMPOS_CON_LISTA.map((campo) =>
              filaAjuste({
                id: campo.clave,
                titulo: etiqueta(campo.clave),
                detalle: plural("lesiones.ajustes.opciones", opcionesDeCampo(campo.clave, config, idioma).length),
                alTocar: () => setVistaAjustes(`lista:${campo.clave}`),
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
          <Encabezado titulo={t("lesiones.ajustes.titulo")} texto={t("lesiones.ajustes.texto")} />
          <AvisoSoloLectura hasta={equipo?.hasta} />
          {filaAjuste({
            id: "cabeceras",
            icono: "documento",
            titulo: t("lesiones.ajustes.cabeceras"),
            detalle: t("lesiones.ajustes.cabecerasTexto"),
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
    );
  };

  // La ficha de una lesión, como la de un partido: arriba el resumen
  // (diagnóstico y días de baja) y abajo una pestaña por grupo del Excel, más
  // la de los últimos cambios. Se mira un grupo a la vez.
  const seccionesDeFicha = () => [
    ...GRUPOS.map((grupo) => ({
      id: grupo.clave,
      titulo: etiquetaDeGrupo(grupo.clave, config, idioma),
      campos: CAMPOS.filter((campo) => campo.grupo === grupo.clave && visible(campo)),
    })).filter((seccion) => seccion.campos.length > 0),
    // Quien ya se fue del club no ve los cambios: tendrían lo que se tocó
    // después de su último día.
    ...(soloLectura ? [] : [{ id: SECCION_CAMBIOS, titulo: t("lesiones.ficha.cambios"), campos: [] }]),
  ];

  // La pestaña elegida queda a la vista en la barra, que se desliza de
  // costado: solo cuando cambia, para no pelear con el dedo.
  const pestanaVista = useRef("");
  const mostrarPestana = (barra, clave) => {
    if (!barra || pestanaVista.current === clave) return;
    pestanaVista.current = clave;
    const activa = barra.querySelector('[aria-selected="true"]');
    if (!activa) return;
    const desde = activa.offsetLeft;
    const hasta = desde + activa.offsetWidth;
    if (desde < barra.scrollLeft) barra.scrollLeft = desde;
    else if (hasta > barra.scrollLeft + barra.clientWidth) barra.scrollLeft = hasta - barra.clientWidth;
  };

  const tarjetaCambios = () => (
    <section className="tarjeta tarjeta-ficha" role="tabpanel" aria-label={t("lesiones.ficha.cambios")}>
      <div className="cabeza-ficha">
        <b>{t("lesiones.ficha.ultimos")}</b>
        <span>{t("lesiones.ficha.ultimosTexto").toUpperCase()}</span>
      </div>
      {cambiosDetalle.length === 0 ? (
        <p className="vacio-ficha">{t("lesiones.ficha.sinCambios")}</p>
      ) : (
        <ul className="lesiones-cambios">
          {cambiosDetalle.map((cambio) => (
            <li key={cambio.id}>
              <div className="dato-detalle">
                <span>{t(`lesiones.ficha.${cambio.accion === "creada" ? "creada" : "editada"}`)}</span>
                <strong>{t("lesiones.ficha.cambio", { fecha: fechaYHora(cambio.cuando), quien: cambio.quien_email || "—" })}</strong>
              </div>
              {cambio.campos?.length > 0 && (
                <p className="lesiones-cambio-columnas">{t("lesiones.ficha.columnas", { columnas: cambio.campos.map(etiqueta).join(", ") })}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const pantallaDetalle = (lesion) => {
    const activa = estaActiva(lesion);
    const secciones = seccionesDeFicha();
    const seccion = secciones.find((una) => una.id === seccionFicha) || secciones[0];
    const diagnostico = enPantalla(campoPorClave("diagnostico"), lesion) || textoDeOpcion("parte_cuerpo", lesion.datos?.parte_cuerpo);
    // La figura chica con la parte lesionada (de espaldas si es de atrás).
    const regionLesion = mapa.regionDe(lesion.datos?.parte_cuerpo, lesion.datos?.lado);
    const piezaLesion = mapa.piezaDe(lesion.datos?.parte_cuerpo, regionLesion);
    return (
      <div className="app">
        <div className="contenedor ficha-registro lesiones-ficha">
          <Encabezado
            titulo={nombreDeLesion(lesion) || t("lesiones.titulo")}
            texto={[
              lesion.numero_caso ? t("lesiones.caso", { n: lesion.numero_caso }) : "",
              lesion.fecha_lesion ? fechaCorta(lesion.fecha_lesion) : "",
              t(`lesiones.etapa.${etapaDe(lesion)}`),
              lesion.jugador_id ? "" : t("lesiones.fueraDeDatos"),
            ]
              .filter(Boolean)
              .join(" · ")}
          />

          <section className="marcador-ficha lesiones-marcador" aria-label={t("lesiones.ficha.resumen")}>
            {piezaLesion && (
              <div className="lesiones-marcador-figura" aria-hidden="true">
                <FiguraCuerpo chica vista={vistaDeLesion(piezaLesion, lesion.datos?.musculo)} elegida={{ parte: piezaLesion, region: regionLesion }} />
              </div>
            )}
            <div className="lesiones-marcador-texto">
              <span>{etiqueta("diagnostico")}</span>
              <strong>{diagnostico || "—"}</strong>
            </div>
            <div className="total-ficha">
              <b>{tieneFecha(lesion) ? diasDeBaja(lesion) : "—"}</b>
              <small>{t("lesiones.ficha.diasDeBaja").toUpperCase()}</small>
            </div>
          </section>

          <section className="selector-periodos en-ficha lesiones-secciones" aria-label={t("lesiones.ficha.secciones")}>
            <div role="tablist" ref={(barra) => mostrarPestana(barra, `${lesion.id}:${seccion.id}`)}>
              {secciones.map((una) => (
                <button
                  type="button"
                  role="tab"
                  key={una.id}
                  aria-selected={una.id === seccion.id}
                  className={una.id === seccion.id ? "activo" : ""}
                  onClick={() => setSeccionFicha(una.id)}
                >
                  {una.titulo}
                </button>
              ))}
            </div>
          </section>

          {seccion.id === SECCION_CAMBIOS ? (
            tarjetaCambios()
          ) : (
            <section className="tarjeta tarjeta-ficha" role="tabpanel" aria-label={seccion.titulo}>
              <div className="cabeza-ficha">
                <b>{seccion.titulo}</b>
              </div>
              {seccion.campos.map((campo) => (
                <DatoDetalle key={campo.clave} label={etiqueta(campo.clave)} valor={enPantalla(campo, lesion)} />
              ))}
            </section>
          )}

          {activa && !soloLectura && (
            <div className="acciones-inicio">
              <button
                type="button"
                className="boton-secundario"
                onClick={() => {
                  setFechaAlta(hoyISO());
                  setADarAlta(lesion);
                }}
              >
                {t("lesiones.darAlta")}
              </button>
            </div>
          )}
          <div className="acciones-dobles">
            <BotonVolver onClick={() => setDetalleId(null)}>{t("comun.volver")}</BotonVolver>
            {!soloLectura && (
              <button type="button" className="boton-principal" onClick={() => abrirEdicion(lesion, seccion.id)}>
                {t("lesiones.editar")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ------------------------------------------------- La carga por pasos --

  const campoDelPaso = (campo, lesion) => {
    const cambiar = (valor) => setFormulario((actual) => conCambios(actual, { [campo.clave]: valor }));
    const rotulo = etiqueta(campo.clave);
    const valor = valorDe(lesion, campo.clave);
    const opcional = !campo.obligatorio ? <em className="lesiones-opcional">{t("lesiones.pasos.opcional")}</em> : null;
    switch (campo.tipo) {
      case "lista": {
        const lista = opciones(campo.clave);
        if (lista.length <= MAXIMO_CHIPS) {
          return (
            <div className="campo-inicio lesiones-campo-paso" key={campo.clave}>
              <label>
                {rotulo} {opcional}
              </label>
              <div className="grilla-criterios lesiones-chips">
                {lista.map((opcion) => (
                  <button
                    type="button"
                    key={opcion.valor}
                    className={`chip-criterio ${valor === opcion.valor ? "prendido" : ""}`}
                    aria-pressed={valor === opcion.valor}
                    onClick={() => cambiar(valor === opcion.valor ? null : opcion.valor)}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div className="campo-inicio lesiones-campo-paso" key={campo.clave}>
            <label>
              {rotulo} {opcional}
            </label>
            {selectorConHoja({
              titulo: rotulo,
              opciones: [...(campo.obligatorio ? [] : [{ valor: "", etiqueta: t("comun.sinDato") }]), ...lista],
              valor: valor || "",
              alElegir: (elegido) => cambiar(elegido || null),
            })}
          </div>
        );
      }
      case "fecha": {
        // Si el día de la lesión se carga después de la imagen, las horas se ven acá.
        const horas = campo.clave === "fecha_lesion" && claveDelCruce === "fecha_lesion" ? horasALaVista(valor, lesion.datos?.hora_imagen) : null;
        return (
          <div className="campo-inicio lesiones-campo-paso" key={campo.clave}>
            <label>
              {rotulo} {opcional}
            </label>
            <input type="date" value={valor || ""} max={hoyISO()} onChange={(evento) => cambiar(evento.target.value)} />
            {horas !== null && (
              <small className="lesiones-ayuda">
                {etiqueta("horas_imagen")}: {plural("lesiones.horas", horas)}
              </small>
            )}
          </div>
        );
      }
      case "fecha_hora": {
        // La hora de la imagen: las horas desde la lesión salen solas (si el
        // día de la lesión ya se cargó; si no, todavía es el de hoy).
        const horas = campo.clave === "hora_imagen" && pasoMaximo >= pasoDe("fecha_lesion") ? horasALaVista(lesion.fecha_lesion, valor) : null;
        return (
          <div className="campo-inicio lesiones-campo-paso" key={campo.clave}>
            <label>
              {rotulo} {opcional}
            </label>
            <input type="datetime-local" value={valor || ""} onChange={(evento) => cambiar(evento.target.value)} />
            {horas !== null && (
              <small className="lesiones-ayuda">
                {etiqueta("horas_imagen")}: {plural("lesiones.horas", horas)}
              </small>
            )}
          </div>
        );
      }
      case "numero":
        return (
          <div className="campo-inicio lesiones-campo-paso" key={campo.clave}>
            <label>
              {rotulo} {opcional}
            </label>
            <input type="number" inputMode="decimal" min="0" step="0.5" value={valor ?? ""} onChange={(evento) => cambiar(evento.target.value === "" ? null : evento.target.value)} />
          </div>
        );
      case "texto_largo":
        return (
          <div className="campo-inicio lesiones-campo-paso" key={campo.clave}>
            <label>
              {rotulo} {opcional}
            </label>
            <textarea rows={3} maxLength={1000} value={valor || ""} onChange={(evento) => cambiar(evento.target.value)} />
          </div>
        );
      default:
        return (
          <div className="campo-inicio lesiones-campo-paso" key={campo.clave}>
            <label>
              {rotulo} {opcional}
            </label>
            <input type="text" maxLength={200} value={valor || ""} onChange={(evento) => cambiar(evento.target.value)} />
          </div>
        );
    }
  };

  // El jugador se elige de una lista grande, buscando por el nombre. Elegido,
  // la lista se retrae (como el equipo en el filtro de Partido): queda el
  // nombre con "Cambiar" y abajo sus datos.
  const pasoJugador = (lesion) => {
    const buscado = normalizarTexto(busquedaJugador);
    const candidatos = plantel.filter((jugador) => !buscado || normalizarTexto(jugador.nombre).includes(buscado));
    const elegido = jugadorDe(lesion.jugador_id);
    const datosDelJugador = CAMPOS.filter((campo) => campo.tipo === "dato_jugador" && visible(campo)).map((campo) => (
      <DatoDetalle key={campo.clave} label={etiqueta(campo.clave)} valor={enPantalla(campo, lesion) || "—"} />
    ));
    if (lesion.id) {
      return (
        <section className="tarjeta tarjeta-ficha lesiones-grupo">
          <DatoDetalle label={etiqueta("jugador")} valor={elegido?.nombre || lesion.persona || "—"} />
          {datosDelJugador}
        </section>
      );
    }
    if (elegido) {
      return (
        <section className="tarjeta tarjeta-ficha lesiones-grupo">
          <button
            type="button"
            className="rival-elegido"
            onClick={() => {
              setBusquedaJugador("");
              setFormulario((actual) => conValor(actual, "jugador", null));
            }}
          >
            <b>{elegido.nombre}</b>
            <span>{t("lesiones.pasos.cambiar")}</span>
          </button>
          <div className="lesiones-jugador-elegido">{datosDelJugador}</div>
        </section>
      );
    }
    return (
      <section className="tarjeta tarjeta-ficha lesiones-grupo">
        <input
          className="lesiones-buscador-jugador"
          type="search"
          value={busquedaJugador}
          onChange={(evento) => setBusquedaJugador(evento.target.value)}
          placeholder={t("lesiones.pasos.buscar")}
          aria-label={t("lesiones.pasos.buscar")}
          autoComplete="off"
        />
        {plantel.length === 0 && <p className="lesiones-ayuda">{t("lesiones.sinJugadores")}</p>}
        {plantel.length > 0 && (
          <div className="lista-rivales lesiones-lista-jugadores">
            {candidatos.length === 0 ? (
              <p className="sin-resultados">{t("lesiones.pasos.ningunJugador")}</p>
            ) : (
              candidatos.map((jugador) => (
                <button type="button" key={jugador.id} onClick={() => setFormulario((actual) => conValor(actual, "jugador", jugador.id))}>
                  <b>{jugador.nombre}</b>
                  <span>{[jugador.posicion ? textoDeOpcion("posicion", jugador.posicion) : "", jugador.categoria ? textoDeOpcion("categoria", jugador.categoria) : ""].filter(Boolean).join(" · ")}</span>
                </button>
              ))
            )}
          </div>
        )}
      </section>
    );
  };

  // Los cambios de la carga. Si cambia la parte del cuerpo, lo que el mapa sabe
  // que era de la parte anterior (músculo, ligamento, área) se borra.
  const conCambios = (actual, cambios) => {
    const aplicar = (lesion, pares) => Object.entries(pares).reduce((acumulada, [clave, valor]) => conValor(acumulada, clave, valor), lesion);
    const nueva = aplicar(actual, cambios);
    const parte = cambios.parte_cuerpo;
    if (!parte || parte === actual.datos?.parte_cuerpo) return nueva;
    return aplicar(nueva, mapa.estructurasQueNoSonDe(parte, nueva.datos || {}));
  };
  const cambiarVarios = (cambios) => setFormulario((actual) => conCambios(actual, cambios));

  // Dónde fue: la figura del cuerpo en lugar de la parte y el lado.
  const zonaDelPaso = (lesion) => (
    <div className="campo-inicio lesiones-campo-paso" key="zona">
      <label>
        {etiqueta("parte_cuerpo")} · {etiqueta("lado")}
      </label>
      <ElegirZona
        parte={lesion.datos?.parte_cuerpo || null}
        lado={lesion.datos?.lado || null}
        partes={opciones("parte_cuerpo").map((opcion) => opcion.valor)}
        lados={opciones("lado")}
        opciones={opciones}
        mapa={mapa}
        textoDeOpcion={textoDeOpcion}
        onCambiar={cambiarVarios}
        vista={vistaCuerpo}
        onVista={setVistaCuerpo}
      />
    </div>
  );

  // Qué estructura: lo que va en esa parte, con botones.
  const estructuraDelPaso = (lesion) => (
    <ElegirEstructura
      key="estructura"
      parte={lesion.datos.parte_cuerpo}
      lado={lesion.datos?.lado || null}
      vista={vistaCuerpo}
      valores={Object.fromEntries(CAMPOS_DE_ESTRUCTURA.map((clave) => [clave, valorDe(lesion, clave)]))}
      opciones={opciones}
      visible={(clave) => !campoOculto(clave, config)}
      mapa={mapa}
      etiqueta={etiqueta}
      textoDeOpcion={textoDeOpcion}
      onCambiar={cambiarVarios}
    />
  );

  // Las columnas de un paso. Donde se elige la parte del cuerpo va la figura,
  // y donde se elige la estructura, sus botones; con "Elegir de la lista"
  // vuelven los campos de siempre.
  const camposDelPaso = (unPaso, campos, lesion) => {
    const enLista = Boolean(deLaLista[unPaso.id]);
    const manuales = campos.filter((campo) => campo.clave !== "jugador");
    const conZona = manuales.some((campo) => campo.clave === "parte_cuerpo");
    const conEstructura = Boolean(lesion.datos?.parte_cuerpo) && manuales.some((campo) => CAMPOS_DE_ESTRUCTURA.includes(campo.clave));
    const primeraDeEstructura = manuales.find((campo) => CAMPOS_DE_ESTRUCTURA.includes(campo.clave))?.clave;
    const piezas = manuales.map((campo) => {
      if (!enLista && conZona && campo.clave === "parte_cuerpo") return zonaDelPaso(lesion);
      if (!enLista && conZona && campo.clave === "lado") return null;
      if (!enLista && conEstructura && CAMPOS_DE_ESTRUCTURA.includes(campo.clave)) return campo.clave === primeraDeEstructura ? estructuraDelPaso(lesion) : null;
      return campoDelPaso(campo, lesion);
    });
    if (manuales.length === 0) return null;
    return (
      <section className="tarjeta tarjeta-ficha lesiones-grupo">
        {piezas}
        {(conZona || conEstructura) && (
          <button type="button" className="lesiones-cambiar-modo" onClick={() => setDeLaLista((previos) => ({ ...previos, [unPaso.id]: !enLista }))}>
            <Icono nombre={enLista ? "usuario" : "registros"} size={15} />
            {enLista ? t("lesiones.cuerpo.conFigura") : t("lesiones.cuerpo.deLaLista")}
          </button>
        )}
      </section>
    );
  };

  // Para pasar de paso se revisan las columnas de ese paso que están a la
  // vista; al guardar se revisa todo. Que la imagen no sea de antes de la
  // lesión se revisa en el paso del que se carga último de los dos.
  const validarPaso = (indice, lesion) => {
    const hoy = hoyISO();
    for (const clave of pasos[indice]?.campos || []) {
      if (oculto(clave)) continue;
      let falta = errorDeCampo(lesion, clave, hoy);
      if (!falta && clave === claveDelCruce && !oculto("hora_imagen") && errorImagenAntes(lesion)) {
        falta = clave === "fecha_lesion" ? "lesiones.error.lesionDespuesDeImagen" : "lesiones.error.imagenAntes";
      }
      if (falta) return t(falta === "lesiones.error.jugador" ? "lesiones.pasos.sinJugador" : falta, { imagen: fechaYHora(lesion.datos?.hora_imagen) });
    }
    return "";
  };

  // Para ir hacia adelante, cada paso del medio tiene que estar completo: no
  // se puede saltear uno al que le falta algo (como el tipo de lesión).
  const irAlPaso = (indice, lesion) => {
    for (let uno = paso; uno < indice; uno += 1) {
      const falta = validarPaso(uno, lesion);
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

  const pantallaFormulario = (lesion) => {
    const total = pasos.length;
    const actual = pasos[Math.min(paso, total - 1)];
    const campos = actual.campos.map(campoPorClave).filter((campo) => campo && visible(campo));
    // El aviso de recidiva va en los pasos donde se elige lo que la decide.
    const recidiva = actual.campos.some((clave) => CAMPOS_DE_RECIDIVA.includes(clave)) ? posibleRecidiva(lesion, lesiones) : null;
    const ultimo = paso === total - 1;
    return (
      <div className="app">
        <div className="contenedor">
          <Encabezado titulo={lesion.id ? t("lesiones.formEditar") : t("lesiones.formNueva")} texto={nombreDeLesion(lesion)}>
            <div className="lesiones-progreso" role="tablist" aria-label={t("lesiones.pasos.paso", { n: paso + 1, total })}>
              {pasos.map((unPaso, indice) => (
                <button
                  type="button"
                  role="tab"
                  key={unPaso.id}
                  aria-selected={indice === paso}
                  className={`${indice === paso ? "actual" : ""} ${indice < paso ? "hecho" : ""}`.trim()}
                  disabled={indice > pasoMaximo + 1}
                  onClick={() => irAlPaso(indice, lesion)}
                  aria-label={etiquetaDeGrupo(unPaso.id, config, idioma)}
                />
              ))}
            </div>
            <p className="lesiones-paso-numero">{t("lesiones.pasos.paso", { n: paso + 1, total })}</p>
          </Encabezado>

          <section className="lesiones-paso-titulo">
            <h2>{etiquetaDeGrupo(actual.id, config, idioma)}</h2>
            <p>{t(`lesiones.pasos.${actual.id}Texto`, {}, "")}</p>
          </section>

          {errorFormulario && <div className="aviso-hoja">{errorFormulario}</div>}
          {recidiva && (
            <div className="lesiones-aviso-recidiva">
              {t("lesiones.avisoRecidiva", {
                parte: textoDeOpcion("parte_cuerpo", recidiva.datos?.parte_cuerpo),
                lado: textoDeOpcion("lado", recidiva.datos?.lado),
                fecha: fechaCorta(recidiva.fecha_lesion),
              })}
            </div>
          )}

          {actual.campos.includes("jugador") && pasoJugador(lesion)}
          {camposDelPaso(actual, campos, lesion)}

          <div className="acciones-dobles">
            <BotonVolver onClick={() => (paso === 0 ? cerrarFormulario() : irAlPaso(paso - 1, lesion))}>
              {paso === 0 ? t("comun.cancelar") : t("lesiones.pasos.atras")}
            </BotonVolver>
            {ultimo ? (
              <button type="button" className="boton-principal" onClick={guardarFormulario} disabled={ocupado}>
                {ocupado ? t("comun.guardando") : t("lesiones.pasos.guardar")}
              </button>
            ) : (
              <button type="button" className="boton-principal" onClick={() => irAlPaso(paso + 1, lesion)}>
                {t("lesiones.pasos.siguiente")}
              </button>
            )}
          </div>
          {lesion.id && (
            <button type="button" className="lesiones-boton-borrar" disabled={ocupado} onClick={() => setABorrar(lesion)}>
              <Icono nombre="borrar" size={16} />
              {t("lesiones.borrar")}
            </button>
          )}
        </div>
      </div>
    );
  };

  let contenido;
  if (formulario) contenido = pantallaFormulario(formulario);
  else if (lesionDetalle) contenido = pantallaDetalle(lesionDetalle);
  else if (vista === "historial") contenido = pantallaHistorial;
  else if (vista === "base")
    contenido =
      importando && !soloLectura ? (
        <ImportarLesiones
          equipoId={equipoId}
          plantel={plantel}
          lesiones={lesiones}
          config={config}
          onVolver={() => setImportando(false)}
          onRecargar={cargar}
          onListo={({ cargadas }) => {
            setImportando(false);
            setAviso(plural("lesiones.importar.listo", cargadas));
          }}
        />
      ) : (
        pantallaBase
      );
  // Los reportes: gps son los minutos del GPS, que la app todavía no tiene.
  else if (vista === "reportes")
    contenido = (
      <ReportesLesiones
        lesiones={lesiones}
        plantel={plantel}
        equipo={equipo}
        mapa={mapa}
        hoy={hoyISO()}
        etiqueta={etiqueta}
        textoDeOpcion={textoDeOpcion}
        enPantalla={enPantalla}
        camposVisibles={CAMPOS.filter(visible)}
        gps={null}
        estado={
          <>
            <AvisoSoloLectura hasta={equipo?.hasta} />
            {estado}
          </>
        }
        datosListos={!cargando && !error}
        onAviso={setAviso}
      />
    );
  else if (vista === "ajustes") contenido = pantallaAjustes();
  else contenido = pantallaLesionados;

  // Tocar un destino de la barra cierra lo que estuviera encima.
  const navegar = (id) => {
    setDetalleId(null);
    setFormulario(null);
    setImportando(false);
    if (id === "ajustes") setVistaAjustes("inicio");
    setVista(id);
  };

  // Cabeceras y opciones se renombran en el idioma que se está usando; el
  // otro idioma guarda lo que tenía.
  const hojaDeTextos = ({ abierta, titulo, hoja, setHoja, onGuardar, onCerrar, fija = false, nota = "", dondeVaEn = null }) =>
    hoja ? (
      <HojaInferior
        abierta={abierta}
        className="lesiones-hoja"
        titulo={titulo}
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
          <input
            type="text"
            maxLength={120}
            value={hoja.etiquetas[idioma] || ""}
            onChange={(evento) => setHoja({ ...hoja, etiquetas: { ...hoja.etiquetas, [idioma]: evento.target.value } })}
          />
          <small className="lesiones-ayuda">{t("lesiones.ajustes.nombreAyuda")}</small>
        </div>
        {/* En las listas del cuerpo, dónde va la opción: el aviso está desde
            que se abre la hoja, para que el lector de pantalla lo lea al cambiar. */}
        {dondeVaEn !== null && <div aria-live="polite">{dondeVaEn && <p className="lesiones-donde-va">{dondeVaEn}</p>}</div>}
        {nota ? (
          <p className="lesiones-ayuda lesiones-nota-fija">{nota}</p>
        ) : fija ? (
          <p className="lesiones-ayuda lesiones-nota-fija">{t("lesiones.ajustes.noSeOculta")}</p>
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

  return (
    <MarcoAplicacion activo={vista} onNavigate={navegar} destinos={DESTINOS_LESIONES} marca={t("lesiones.titulo")} className="entrenamiento-marco lesiones-marco">
      {contenido}

      {aviso && (
        <div className="lesiones-toast" role="status">
          {aviso}
        </div>
      )}

      <HojaOpciones
        abierta={Boolean(hojaSelector)}
        titulo={hojaSelector?.titulo}
        opciones={hojaSelector?.opciones || []}
        elegida={hojaSelector?.valor}
        onElegir={(cual) => {
          hojaSelector?.alElegir(cual);
          setHojaSelector(null);
        }}
        onCerrar={() => setHojaSelector(null)}
      />

      {aDarAlta && (
        <HojaInferior
          abierta
          className="lesiones-hoja"
          titulo={t("lesiones.altaTitulo")}
          descripcion={t("lesiones.altaTexto", { jugador: nombreDeLesion(aDarAlta) })}
          onCerrar={() => !ocupado && setADarAlta(null)}
          acciones={
            <>
              <button type="button" className="boton-cancelar-hoja" onClick={() => setADarAlta(null)} disabled={ocupado}>
                {t("comun.cancelar")}
              </button>
              <button type="button" className="boton-confirmar-hoja" onClick={confirmarAlta} disabled={ocupado}>
                {ocupado ? t("comun.guardando") : t("lesiones.siAlta")}
              </button>
            </>
          }
        >
          <div className="campo-inicio">
            <label>{t("lesiones.altaFecha")}</label>
            <input type="date" value={fechaAlta} min={aDarAlta.fecha_lesion} max={hoyISO()} onChange={(evento) => setFechaAlta(evento.target.value)} />
          </div>
        </HojaInferior>
      )}

      {hojaDeTextos({
        abierta: Boolean(hojaCabecera),
        titulo: !hojaCabecera
          ? ""
          : hojaCabecera.grupo
            ? `${t("lesiones.ajustes.editarGrupo")}: ${etiquetaDeGrupo(hojaCabecera.grupo, config, idioma)}`
            : `${t("lesiones.ajustes.editarCabecera")}: ${etiqueta(hojaCabecera.clave)}`,
        hoja: hojaCabecera,
        setHoja: setHojaCabecera,
        onGuardar: guardarHojaCabecera,
        onCerrar: () => !ocupado && setHojaCabecera(null),
        fija: Boolean(hojaCabecera && campoPorClave(hojaCabecera.clave)?.obligatorio),
        // Un grupo no se esconde: se esconden sus columnas.
        nota: hojaCabecera?.grupo ? t("lesiones.ajustes.grupoAyuda") : "",
      })}

      {hojaDeTextos({
        abierta: Boolean(hojaOpcion),
        titulo: hojaOpcion ? (hojaOpcion.codigo ? `${t("lesiones.ajustes.editarOpcion")}: ${etiqueta(hojaOpcion.campo)}` : t("lesiones.ajustes.nuevaOpcion")) : "",
        hoja: hojaOpcion,
        setHoja: setHojaOpcion,
        onGuardar: guardarHojaOpcion,
        onCerrar: () => !ocupado && setHojaOpcion(null),
        dondeVaEn: hojaOpcion && CAMPOS_DEL_CUERPO.includes(hojaOpcion.campo) ? dondeVaAlEscribir(hojaOpcion) : null,
      })}

      <HojaConfirmar
        abierta={Boolean(aBorrar)}
        titulo={t("lesiones.borrarTitulo")}
        descripcion={t("lesiones.borrarTexto", { jugador: nombreDeLesion(aBorrar) })}
        icono="borrar"
        etiquetaConfirmar={t("lesiones.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBorrar}
        onCancelar={() => setABorrar(null)}
      />
    </MarcoAplicacion>
  );
}
