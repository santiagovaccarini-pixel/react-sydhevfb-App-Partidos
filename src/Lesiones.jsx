import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Icono, MarcoAplicacion } from "./components/AppChrome";
import { EscudoDeClub } from "./components/ClubCrest";
import { BotonVolver, DatoDetalle } from "./components/BotonVolver.jsx";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { cargarEquipos, elegirEquipoInicial, guardarEquipoElegido, leerEquipoElegido } from "./domain/equipo.js";
import { nombrePuesto } from "./domain/plantel.js";
import {
  ETAPAS,
  FILTRO,
  buscarEnLesiones,
  calcular,
  conValor,
  diasDeBaja,
  diasEntre,
  estaActiva,
  estadoDelPlantel,
  etapaDe,
  filtrarLesiones,
  lesionVacia,
  lesionesActivas,
  normalizarTexto,
  ordenarHistorial,
  posibleRecidiva,
  severidadPorDias,
  validarLesion,
  valorDe,
} from "./domain/lesiones.js";
import {
  CAMPOS,
  CAMPOS_CON_LISTA,
  GRUPOS,
  campoOculto,
  campoPorClave,
  codigoNuevo,
  etiquetaDeCampo,
  etiquetaDeOpcion,
  opcionesDeCampo,
} from "./domain/lesionesCampos.js";
import {
  actualizarLesion,
  borrarLesion,
  cargarPlantelLesiones,
  crearLesion,
  guardarCampo,
  guardarDatosJugador,
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
// detalle", el filtro de Registros (botón negro, hoja "Filtrar por" y chips),
// Ajustes con filas y "Volver a Ajustes". Las columnas son las del Excel
// original (lesionesCampos.js); cada club las renombra y arma sus listas
// desde Ajustes. Lee y escribe directo en la base; sin señal avisa.

export const DESTINOS_LESIONES = [
  { id: "lesionados", etiqueta: "Lesionados", icono: "usuario" },
  { id: "historial", etiqueta: "Historial", icono: "registros" },
  { id: "plantel", etiqueta: "Plantel", icono: "escudo" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

const MULTI_FILTRO = "multi";
const LISTAS_DEL_FILTRO = CAMPOS.filter((campo) => campo.tipo === "lista").map((campo) => campo.clave);

const primeraMayuscula = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "");

const EtapaChip = ({ lesion }) => {
  const etapa = etapaDe(lesion);
  return <span className={`lesiones-etapa ${etapa}`}>{t(`lesiones.etapa.${etapa}`)}</span>;
};

// Título de las pantallas que no son la principal, con el globo del idioma
// a la derecha.
const Encabezado = ({ titulo, texto }) => (
  <header className="encabezado lesiones-encabezado">
    <div className="lesiones-encabezado-texto">
      <h1>{titulo}</h1>
      {texto && <p>{texto}</p>}
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

  // Pantallas encima de la vista: la ficha de una lesión, el formulario, los
  // datos de un jugador.
  const [detalleId, setDetalleId] = useState(null);
  const [cambiosDetalle, setCambiosDetalle] = useState([]);
  const [formulario, setFormulario] = useState(null);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [jugadorEditando, setJugadorEditando] = useState(null);

  // Hojas: elegir de una lista (como los desplegables de Partido), dar el
  // alta, borrar.
  const [hojaSelector, setHojaSelector] = useState(null);
  const [aDarAlta, setADarAlta] = useState(null);
  const [fechaAlta, setFechaAlta] = useState(hoyISO());
  const [aBorrar, setABorrar] = useState(null);

  // El filtro del historial, igual que el de Registros de Partido.
  const [busqueda, setBusqueda] = useState("");
  // Fichas (como Registros de Partido) o tabla (como la base del Excel).
  const [vistaHistorial, setVistaHistorial] = useState("fichas");
  const [filtroAbierto, setFiltroAbierto] = useState(false);
  const [criterio, setCriterio] = useState(FILTRO.TODOS);
  const [criteriosMulti, setCriteriosMulti] = useState([]);
  const [jugadorFiltro, setJugadorFiltro] = useState("");
  const [buscadorJugador, setBuscadorJugador] = useState("");
  const [etapasFiltro, setEtapasFiltro] = useState([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [listasFiltro, setListasFiltro] = useState({});

  // Ajustes: cabeceras y listas del club.
  const [vistaAjustes, setVistaAjustes] = useState("inicio");
  const [hojaCabecera, setHojaCabecera] = useState(null);
  const [hojaOpcion, setHojaOpcion] = useState(null);
  const [errorHoja, setErrorHoja] = useState("");

  const equipoId = equipo?.id || null;

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

  // La ficha trae sus cambios cuando se abre.
  useEffect(() => {
    if (!detalleId) return undefined;
    let vigente = true;
    setCambiosDetalle([]);
    historialDeLesion(detalleId).then((respuesta) => vigente && setCambiosDetalle(respuesta.cambios));
    return () => {
      vigente = false;
    };
  }, [detalleId]);

  // ------------------------------------------------------------- Ayudas --

  const jugadorDe = (id) => plantel.find((jugador) => String(jugador.id) === String(id)) || null;
  const nombreDe = (id) => jugadorDe(id)?.nombre || "";
  const etiqueta = (clave) => etiquetaDeCampo(clave, config, idioma);
  const opciones = (clave) => opcionesDeCampo(clave, config, idioma);
  const textoDeOpcion = (clave, codigo) => etiquetaDeOpcion(clave, codigo, config, idioma);
  const visible = (campo) => !campoOculto(campo.clave, config);

  // Cómo se muestra cada columna del Excel en una lesión.
  const enPantalla = (campo, lesion) => {
    const jugador = jugadorDe(lesion.jugador_id);
    switch (campo.tipo) {
      case "auto":
        return lesion.numero_caso ? String(lesion.numero_caso) : "";
      case "jugador":
        return jugador?.nombre || "";
      case "dato_jugador": {
        if (campo.clave === "posicion") return (jugador?.puestos || []).map(nombrePuesto).join(" / ");
        const valor = campo.clave === "categoria" ? lesion.datos?.categoria || jugador?.categoria : jugador?.[campo.clave];
        if (!valor) return "";
        if (campo.lista) return textoDeOpcion(campo.clave, valor);
        if (campo.clave === "fecha_nacimiento") return fechaCorta(valor);
        return String(valor);
      }
      case "calculado": {
        const numero = calcular(campo.clave, lesion, jugador);
        if (numero === null || numero === undefined) return "";
        if (campo.clave === "edad") return plural("lesiones.anios", numero);
        if (campo.clave === "horas_imagen") return plural("lesiones.horas", numero);
        return plural("lesiones.dias", numero);
      }
      case "lista":
        return textoDeOpcion(campo.clave, valorDe(lesion, campo.clave));
      case "fecha":
        return fechaCorta(valorDe(lesion, campo.clave));
      case "fecha_hora":
        return fechaYHora(valorDe(lesion, campo.clave));
      default:
        return String(valorDe(lesion, campo.clave) || "");
    }
  };

  const activas = useMemo(() => lesionesActivas(lesiones), [lesiones]);
  const plantelConEstado = useMemo(() => estadoDelPlantel(plantel, lesiones), [plantel, lesiones]);
  const lesionDetalle = detalleId ? lesiones.find((lesion) => lesion.id === detalleId) || null : null;

  const avisarError = (clave, lesion) =>
    setAviso(
      t(clave, {
        parte: textoDeOpcion("parte_cuerpo", lesion?.datos?.parte_cuerpo),
        lado: textoDeOpcion("lado", lesion?.datos?.lado),
      }),
    );

  const reemplazar = (lesion) =>
    setLesiones((actuales) => {
      const existe = actuales.some((otra) => otra.id === lesion.id);
      return existe ? actuales.map((otra) => (otra.id === lesion.id ? lesion : otra)) : [lesion, ...actuales];
    });

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

  const abrirNueva = () => {
    setErrorFormulario("");
    setFormulario(lesionVacia());
  };

  const abrirEdicion = (lesion) => {
    setErrorFormulario("");
    setFormulario({ ...lesion, datos: { ...(lesion.datos || {}) } });
  };

  const guardarFormulario = async () => {
    const lesion = formulario;
    const hoy = hoyISO();
    const falta = validarLesion(lesion, { hoy, otras: lesiones });
    if (falta) {
      setErrorFormulario(
        t(falta, { parte: textoDeOpcion("parte_cuerpo", lesion.datos?.parte_cuerpo), lado: textoDeOpcion("lado", lesion.datos?.lado) }),
      );
      return;
    }
    const jugador = jugadorDe(lesion.jugador_id);
    const recidiva = posibleRecidiva(lesion, lesiones);
    const datos = { ...(lesion.datos || {}) };
    // Lo que el Excel completa solo si no se cargó a mano.
    if (!datos.categoria && jugador?.categoria) datos.categoria = jugador.categoria;
    if (lesion.fecha_alta && !datos.severidad) datos.severidad = severidadPorDias(diasEntre(lesion.fecha_lesion, lesion.fecha_alta));
    if (recidiva && !datos.recidiva) datos.recidiva = "sim";
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
    if (!fechaAlta || fechaAlta < lesion.fecha_lesion) return setAviso(t("lesiones.error.fechaAntes"));
    if (fechaAlta > hoy) return setAviso(t("lesiones.error.fechaFuturaOtra"));
    const datos = { ...(lesion.datos || {}) };
    if (!datos.severidad) datos.severidad = severidadPorDias(diasEntre(lesion.fecha_lesion, fechaAlta));
    setOcupado(true);
    const respuesta = await actualizarLesion(lesion.id, { ...lesion, fecha_alta: fechaAlta, datos });
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

  const guardarJugador = async () => {
    const jugador = jugadorEditando;
    if (!jugador) return;
    setOcupado(true);
    const respuesta = await guardarDatosJugador(jugador.id, jugador);
    setOcupado(false);
    if (respuesta.error) {
      setAviso(t(respuesta.error));
      return;
    }
    setPlantel((actual) => actual.map((uno) => (uno.id === respuesta.jugador.id ? respuesta.jugador : uno)));
    setJugadorEditando(null);
    setAviso(t("lesiones.plantel.guardados"));
  };

  const recargarConfig = async () => {
    const respuesta = await leerConfig(equipoId);
    if (!respuesta.error) setConfig(respuesta.config);
  };

  const guardarHojaCabecera = async () => {
    const hoja = hojaCabecera;
    if (!hoja) return;
    if (!String(hoja.etiquetas["es-AR"] || "").trim() && !String(hoja.etiquetas["pt-BR"] || "").trim()) {
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
    const es = String(hoja.etiquetas["es-AR"] || "").trim();
    const pt = String(hoja.etiquetas["pt-BR"] || "").trim();
    if (!es && !pt) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    setOcupado(true);
    const respuesta = await guardarOpcion(equipoId, hoja.campo, {
      ...hoja,
      codigo: hoja.codigo || codigoNuevo(es || pt),
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

  // -------------------------------------------------------------- Filtro --

  const criteriosDelFiltro = useMemo(
    () => [
      { valor: FILTRO.TODOS, etiqueta: t("lesiones.filtro.todos") },
      { valor: FILTRO.JUGADOR, etiqueta: t("lesiones.filtro.jugador") },
      { valor: FILTRO.ETAPA, etiqueta: t("lesiones.filtro.etapa") },
      { valor: FILTRO.FECHA, etiqueta: t("lesiones.filtro.fecha") },
      ...LISTAS_DEL_FILTRO.filter((clave) => !campoOculto(clave, config)).map((clave) => ({ valor: clave, etiqueta: etiquetaDeCampo(clave, config, idioma) })),
      { valor: MULTI_FILTRO, etiqueta: t("lesiones.filtro.multi") },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, idioma],
  );
  const enMultiFiltro = criterio === MULTI_FILTRO;
  const criteriosActivos = enMultiFiltro ? criteriosMulti : [criterio].filter((cual) => cual !== FILTRO.TODOS);
  const tieneCriterio = (cual) => criteriosActivos.includes(cual);
  const nombreDelCriterio = (criteriosDelFiltro.find((uno) => uno.valor === criterio) || {}).etiqueta;
  const criteriosSinMulti = criteriosDelFiltro.filter(({ valor }) => valor !== MULTI_FILTRO && valor !== FILTRO.TODOS);

  const limpiarFiltros = () => {
    setFiltroAbierto(false);
    setHojaSelector(null);
    setCriterio(FILTRO.TODOS);
    setCriteriosMulti([]);
    setJugadorFiltro("");
    setBuscadorJugador("");
    setEtapasFiltro([]);
    setFechaDesde("");
    setFechaHasta("");
    setListasFiltro({});
  };

  const elegirCriterio = (cual) => {
    if (cual === FILTRO.TODOS) {
      limpiarFiltros();
      return;
    }
    setCriterio(cual);
    setFiltroAbierto(true);
  };

  const abrirHojaDeCriterios = () =>
    setHojaSelector({ titulo: t("lesiones.filtro.filtrarPor"), opciones: criteriosDelFiltro, valor: criterio, alElegir: elegirCriterio });

  const alternar = (lista, cual) => (lista.includes(cual) ? lista.filter((uno) => uno !== cual) : [...lista, cual]);
  const alternarCriterio = (cual) => setCriteriosMulti((previos) => alternar(previos, cual));
  const alternarEtapa = (cual) => setEtapasFiltro((previas) => alternar(previas, cual));
  const alternarOpcionFiltro = (clave, codigo) =>
    setListasFiltro((previas) => ({ ...previas, [clave]: alternar(previas[clave] || [], codigo) }));

  const historialVisible = useMemo(() => {
    const filtradas = filtrarLesiones(ordenarHistorial(lesiones), {
      criterios: criteriosActivos,
      jugador: jugadorFiltro,
      etapas: etapasFiltro,
      desde: fechaDesde,
      hasta: fechaHasta,
      listas: listasFiltro,
    });
    return buscarEnLesiones(filtradas, busqueda, { nombreDe, config, idioma });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesiones, criteriosActivos.join(","), jugadorFiltro, etapasFiltro, fechaDesde, fechaHasta, listasFiltro, busqueda, plantel, config, idioma]);

  const jugadoresDelFiltro = useMemo(() => {
    const buscado = normalizarTexto(buscadorJugador);
    return plantel
      .map((jugador) => ({ jugador, lesiones: lesiones.filter((lesion) => String(lesion.jugador_id) === String(jugador.id)).length }))
      .filter(({ jugador }) => !buscado || normalizarTexto(jugador.nombre).includes(buscado));
  }, [plantel, lesiones, buscadorJugador]);

  const conRotulo = (rotulo, contenido, clave) => (
    <div className="bloque-criterio" key={clave || rotulo}>
      <p className="rotulo-criterio">{rotulo}</p>
      {contenido}
    </div>
  );

  const chips = (lista, prendidas, alTocar) => (
    <div className="grilla-criterios">
      {lista.map(({ valor, etiqueta: texto }) => (
        <button
          type="button"
          key={valor}
          className={`chip-criterio ${prendidas.includes(valor) ? "prendido" : ""}`}
          aria-pressed={prendidas.includes(valor)}
          onClick={() => alTocar(valor)}
        >
          {texto}
        </button>
      ))}
    </div>
  );

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
        <span className="fecha-registro">{fechaCorta(lesion.fecha_lesion)}</span>
        <EtapaChip lesion={lesion} />
        {lesion.numero_caso && <span className="lesiones-caso">{t("lesiones.caso", { n: lesion.numero_caso })}</span>}
      </span>
      <div className="lesiones-registro-cuerpo">
        <strong>{nombreDe(lesion.jugador_id) || "—"}</strong>
        <span>
          {[textoDeOpcion("parte_cuerpo", lesion.datos?.parte_cuerpo), textoDeOpcion("lado", lesion.datos?.lado), textoDeOpcion("tipo_lesion", lesion.datos?.tipo_lesion)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
      <div className="tiempos-registro">
        <span>
          {etiqueta("recuperacion")} <strong>{plural("lesiones.dias", diasDeBaja(lesion))}</strong>
        </span>
        {lesion.datos?.severidad && (
          <span>
            {etiqueta("severidad")} <strong>{textoDeOpcion("severidad", lesion.datos.severidad)}</strong>
          </span>
        )}
      </div>
      <div className="acciones-registro">
        <button type="button" className="boton-detalle" onClick={() => setDetalleId(lesion.id)}>
          {t("lesiones.verDetalle")}
        </button>
        {conAlta && estaActiva(lesion) && (
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
        <button type="button" className="boton-eliminar-registro" aria-label={t("lesiones.borrar")} onClick={() => setABorrar(lesion)}>
          <Icono nombre="borrar" size={18} />
        </button>
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

        {estado}

        <div className="acciones-inicio lesiones-acciones">
          <button type="button" className="boton-principal boton-formacion-grande" onClick={abrirNueva} disabled={!enLinea || Boolean(error) || cargando}>
            {t("lesiones.nueva")}
          </button>
        </div>

        {!cargando && !error && activas.length === 0 && <p className="lesiones-vacio">{t("lesiones.sinActivas")}</p>}
        <div className="lesiones-lista">{activas.map((lesion) => tarjetaLesion(lesion, { conAlta: true }))}</div>
      </div>
    </div>
  );

  const pantallaHistorial = (
    <div className="app">
      <div className="contenedor">
        <Encabezado titulo={t("lesiones.historial.titulo")} texto={t("lesiones.historial.texto")} />
        {estado}
        <section className="tarjeta">
          <div className="cambiar-vista" role="tablist">
            {[
              ["fichas", t("lesiones.historial.fichas")],
              ["tabla", t("lesiones.historial.tabla")],
            ].map(([modo, texto]) => (
              <button
                key={modo}
                type="button"
                role="tab"
                aria-selected={vistaHistorial === modo}
                className={vistaHistorial === modo ? "activo" : ""}
                onClick={() => setVistaHistorial(modo)}
              >
                {texto}
              </button>
            ))}
          </div>

          <div className="buscador-registros">
            <div className="linea-buscador">
              <input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder={t("lesiones.historial.buscar")} />
              <button
                type="button"
                className={`boton-filtro ${criterio === FILTRO.TODOS ? "" : "con-filtro"}`}
                aria-label={filtroAbierto ? t("lesiones.filtro.borrar") : t("lesiones.filtro.filtrar")}
                aria-expanded={filtroAbierto}
                onClick={() => (filtroAbierto ? limpiarFiltros() : abrirHojaDeCriterios())}
              >
                <Icono nombre="filtro" size={20} />
              </button>
            </div>

            {filtroAbierto && (
              <div className="panel-filtro">
                <button type="button" className="criterio-elegido" onClick={abrirHojaDeCriterios}>
                  <b>{nombreDelCriterio}</b>
                  <span>{t("lesiones.filtro.cambiar")}</span>
                </button>

                {enMultiFiltro && (
                  <>
                    <p className="rotulo-criterio">{t("lesiones.filtro.conCuales")}</p>
                    {chips(criteriosSinMulti, criteriosMulti, alternarCriterio)}
                  </>
                )}

                {tieneCriterio(FILTRO.JUGADOR) &&
                  conRotulo(
                    t("lesiones.filtro.jugador"),
                    jugadorFiltro ? (
                      <button type="button" className="rival-elegido" onClick={() => setJugadorFiltro("")}>
                        <b>{nombreDe(jugadorFiltro)}</b>
                        <span>{t("lesiones.filtro.cambiar")}</span>
                      </button>
                    ) : (
                      <>
                        <input
                          value={buscadorJugador}
                          onChange={(evento) => setBuscadorJugador(evento.target.value)}
                          placeholder={t("lesiones.filtro.buscarJugador")}
                          aria-label={t("lesiones.filtro.buscarJugador")}
                        />
                        <div className="lista-rivales">
                          {jugadoresDelFiltro.length === 0 ? (
                            <p className="sin-resultados">{t("lesiones.filtro.ningunJugador")}</p>
                          ) : (
                            jugadoresDelFiltro.map(({ jugador, lesiones: cuantas }) => (
                              <button type="button" key={jugador.id} onClick={() => setJugadorFiltro(String(jugador.id))}>
                                <b>{jugador.nombre}</b>
                                <span>{plural("lesiones.historial.cantidad", cuantas)}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    ),
                    "jugador",
                  )}

                {tieneCriterio(FILTRO.ETAPA) &&
                  conRotulo(
                    t("lesiones.filtro.etapa"),
                    chips(
                      ETAPAS.map((etapa) => ({ valor: etapa, etiqueta: t(`lesiones.etapa.${etapa}`) })),
                      etapasFiltro,
                      alternarEtapa,
                    ),
                    "etapa",
                  )}

                {tieneCriterio(FILTRO.FECHA) &&
                  conRotulo(
                    t("lesiones.filtro.fecha"),
                    <div className="rango-fechas">
                      <label>
                        <span>{t("lesiones.filtro.desde")}</span>
                        <input type="date" value={fechaDesde} onChange={(evento) => setFechaDesde(evento.target.value)} />
                      </label>
                      <label>
                        <span>{t("lesiones.filtro.hasta")}</span>
                        <input type="date" value={fechaHasta} onChange={(evento) => setFechaHasta(evento.target.value)} />
                      </label>
                    </div>,
                    "fecha",
                  )}

                {LISTAS_DEL_FILTRO.filter(tieneCriterio).map((clave) =>
                  conRotulo(etiqueta(clave), chips(opciones(clave), listasFiltro[clave] || [], (codigo) => alternarOpcionFiltro(clave, codigo)), clave),
                )}
              </div>
            )}
          </div>

          {!cargando && !error && (
            <p className="lesiones-cantidad">
              {lesiones.length === 0 ? t("lesiones.historial.vacio") : plural("lesiones.historial.cantidad", historialVisible.length)}
            </p>
          )}
          {lesiones.length > 0 && historialVisible.length === 0 && <div className="sin-resultados">{t("lesiones.historial.sinResultados")}</div>}
          {vistaHistorial === "tabla" && historialVisible.length > 0 ? (
            // La base como en el Excel: una fila por lesión, una columna por
            // cabecera, en su orden. Tocar una fila abre la ficha.
            <div className="lesiones-tabla-marco">
              <table className="lesiones-tabla">
                <thead>
                  <tr>
                    {CAMPOS.filter(visible).map((campo) => (
                      <th key={campo.clave}>{etiqueta(campo.clave)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historialVisible.map((lesion) => (
                    <tr key={lesion.id} onClick={() => setDetalleId(lesion.id)}>
                      {CAMPOS.filter(visible).map((campo) => (
                        <td key={campo.clave}>{enPantalla(campo, lesion) || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="lesiones-lista">{historialVisible.map((lesion) => tarjetaLesion(lesion))}</div>
          )}
        </section>
      </div>
    </div>
  );

  const pantallaPlantel = (
    <div className="app">
      <div className="contenedor">
        <Encabezado
          titulo={t("lesiones.plantel.titulo")}
          texto={`${t("lesiones.plantel.texto")}${
            plantel.length > 0
              ? ` ${t("lesiones.plantel.disponibles", {
                  n: plantelConEstado.filter((fila) => fila.situacion === "disponible").length,
                  total: plantel.length,
                })}`
              : ""
          }`}
        />
        {estado}
        {!cargando && plantel.length === 0 && <p className="lesiones-vacio">{t("lesiones.plantel.sinPlantel")}</p>}
        <div className="lesiones-plantel">
          {plantelConEstado.map(({ jugador, lesiones: suyas, situacion }) => (
            <button
              type="button"
              key={jugador.id}
              className={`opcion-ajuste lesiones-plantel-fila ${situacion}`}
              onClick={() => setJugadorEditando({ ...jugador })}
            >
              <span className="texto-ajuste">
                <b>{jugador.nombre}</b>
                <span>
                  {suyas.length
                    ? suyas.map((lesion) => textoDeOpcion("parte_cuerpo", lesion.datos?.parte_cuerpo)).filter(Boolean).join(", ") ||
                      t(`lesiones.plantel.${situacion}`)
                    : (jugador.puestos || []).map(nombrePuesto).join(" / ") || (jugador.numero_registro ? `N° ${jugador.numero_registro}` : "—")}
                </span>
              </span>
              <span className={`lesiones-situacion ${situacion}`}>{t(`lesiones.plantel.${situacion}`)}</span>
              <span className="flecha-ajuste">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Ajustes, con el mismo formato que en Flujo diario: filas, y adentro de
  // cada una su pantalla con "Volver a Ajustes".
  const filaAjuste = ({ id, icono, titulo, detalle, alTocar, extra = null }) => (
    <button key={id} type="button" className="opcion-ajuste" onClick={alTocar}>
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
            {CAMPOS.map((campo) =>
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
            <Encabezado titulo={etiqueta(clave)} texto={plural("lesiones.ajustes.opciones", todas.length)} />
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

  // La ficha de una lesión: todas las columnas del Excel, por grupo.
  const pantallaDetalle = (lesion) => {
    const activa = estaActiva(lesion);
    return (
      <div className="app">
        <div className="contenedor">
          <Encabezado
            titulo={nombreDe(lesion.jugador_id) || t("lesiones.titulo")}
            texto={[lesion.numero_caso ? t("lesiones.caso", { n: lesion.numero_caso }) : "", fechaCorta(lesion.fecha_lesion), t(`lesiones.etapa.${etapaDe(lesion)}`)]
              .filter(Boolean)
              .join(" · ")}
          />
          {GRUPOS.map((grupo) => {
            const campos = CAMPOS.filter((campo) => campo.grupo === grupo && visible(campo));
            if (campos.length === 0) return null;
            return (
              <section className="tarjeta tarjeta-ficha" key={grupo}>
                <div className="cabeza-ficha">
                  <b>{t(`lesiones.grupos.${grupo}`)}</b>
                </div>
                {campos.map((campo) => (
                  <DatoDetalle key={campo.clave} label={etiqueta(campo.clave)} valor={enPantalla(campo, lesion)} />
                ))}
              </section>
            );
          })}
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{t("lesiones.historial.cambios")}</b>
            </div>
            {cambiosDetalle.length === 0 ? (
              <p className="vacio-ficha">{t("lesiones.historial.sinCambios")}</p>
            ) : (
              cambiosDetalle.map((cambio) => (
                <DatoDetalle
                  key={cambio.id}
                  label={t(`lesiones.historial.${cambio.accion === "creada" ? "creada" : "editada"}`)}
                  valor={t("lesiones.historial.cambio", { fecha: fechaYHora(cambio.cuando), quien: cambio.quien_email || "—" })}
                />
              ))
            )}
          </section>
          {activa && (
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
            <button type="button" className="boton-principal" onClick={() => abrirEdicion(lesion)}>
              {t("lesiones.editar")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // El formulario: una tarjeta por grupo, con las columnas del Excel.
  const campoDelFormulario = (campo, lesion) => {
    const cambiar = (valor) => setFormulario((actual) => conValor(actual, campo.clave, valor));
    const rotulo = etiqueta(campo.clave);
    switch (campo.tipo) {
      case "auto":
        return <DatoDetalle key={campo.clave} label={rotulo} valor={enPantalla(campo, lesion) || t("lesiones.calculado")} />;
      case "calculado":
        return <DatoDetalle key={campo.clave} label={rotulo} valor={enPantalla(campo, lesion) || t("lesiones.calculado")} />;
      case "dato_jugador":
        return <DatoDetalle key={campo.clave} label={rotulo} valor={lesion.jugador_id ? enPantalla(campo, lesion) || "—" : t("lesiones.delJugador")} />;
      case "jugador":
        return (
          <div className="campo-inicio" key={campo.clave}>
            <label>{rotulo}</label>
            {lesion.id ? (
              <strong className="lesiones-jugador-fijo">{nombreDe(lesion.jugador_id)}</strong>
            ) : (
              selectorConHoja({
                titulo: t("lesiones.jugador"),
                opciones: plantel.map((jugador) => ({ valor: String(jugador.id), etiqueta: jugador.nombre })),
                valor: lesion.jugador_id ? String(lesion.jugador_id) : "",
                alElegir: (valor) => cambiar(jugadorDe(valor)?.id ?? null),
              })
            )}
            {plantel.length === 0 && <small className="lesiones-ayuda">{t("lesiones.sinJugadores")}</small>}
          </div>
        );
      case "lista":
        return (
          <div className="campo-inicio" key={campo.clave}>
            <label>{rotulo}</label>
            {selectorConHoja({
              titulo: rotulo,
              opciones: [...(campo.obligatorio ? [] : [{ valor: "", etiqueta: t("comun.sinDato") }]), ...opciones(campo.clave)],
              valor: valorDe(lesion, campo.clave) || "",
              alElegir: (valor) => cambiar(valor || null),
            })}
          </div>
        );
      case "fecha":
        return (
          <div className="campo-inicio" key={campo.clave}>
            <label>{rotulo}</label>
            <input type="date" value={valorDe(lesion, campo.clave) || ""} max={hoyISO()} onChange={(evento) => cambiar(evento.target.value)} />
          </div>
        );
      case "fecha_hora":
        return (
          <div className="campo-inicio" key={campo.clave}>
            <label>{rotulo}</label>
            <input type="datetime-local" value={valorDe(lesion, campo.clave) || ""} onChange={(evento) => cambiar(evento.target.value)} />
          </div>
        );
      case "texto_largo":
        return (
          <div className="campo-inicio" key={campo.clave}>
            <label>{rotulo}</label>
            <textarea rows={3} maxLength={1000} value={valorDe(lesion, campo.clave) || ""} onChange={(evento) => cambiar(evento.target.value)} />
          </div>
        );
      default:
        return (
          <div className="campo-inicio" key={campo.clave}>
            <label>{rotulo}</label>
            <input type="text" maxLength={200} value={valorDe(lesion, campo.clave) || ""} onChange={(evento) => cambiar(evento.target.value)} />
          </div>
        );
    }
  };

  const pantallaFormulario = (lesion) => {
    const recidiva = posibleRecidiva(lesion, lesiones);
    const jugador = jugadorDe(lesion.jugador_id);
    return (
      <div className="app">
        <div className="contenedor">
          <Encabezado titulo={lesion.id ? t("lesiones.formEditar") : t("lesiones.formNueva")} texto={jugador?.nombre || ""} />
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
          {GRUPOS.map((grupo) => {
            const campos = CAMPOS.filter((campo) => campo.grupo === grupo && visible(campo));
            if (campos.length === 0) return null;
            return (
              <section className="tarjeta tarjeta-ficha lesiones-grupo" key={grupo}>
                <div className="cabeza-ficha">
                  <b>{t(`lesiones.grupos.${grupo}`)}</b>
                </div>
                {campos.map((campo) => campoDelFormulario(campo, lesion))}
                {grupo === "jugador" && jugador && (
                  <button type="button" className="boton-texto" onClick={() => setJugadorEditando({ ...jugador })}>
                    {t("lesiones.plantel.datos")} ›
                  </button>
                )}
              </section>
            );
          })}
          <div className="acciones-dobles">
            <BotonVolver
              onClick={() => {
                setFormulario(null);
                setErrorFormulario("");
              }}
            >
              {t("comun.cancelar")}
            </BotonVolver>
            <button type="button" className="boton-principal" onClick={guardarFormulario} disabled={ocupado}>
              {ocupado ? t("comun.guardando") : t("comun.guardar")}
            </button>
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

  // Los datos del Excel de un jugador (quedan en la lista de jugadores).
  const pantallaJugador = (jugador) => {
    const cambiar = (campo, valor) => setJugadorEditando((actual) => ({ ...actual, [campo]: valor }));
    return (
      <div className="app">
        <div className="contenedor">
          <Encabezado titulo={jugador.nombre} texto={t("lesiones.plantel.datosTexto")} />
          <section className="tarjeta tarjeta-ficha lesiones-grupo">
            <div className="cabeza-ficha">
              <b>{t("lesiones.plantel.datos")}</b>
            </div>
            <div className="campo-inicio">
              <label>{etiqueta("numero_registro")}</label>
              <input type="text" maxLength={40} value={jugador.numero_registro || ""} onChange={(evento) => cambiar("numero_registro", evento.target.value)} />
            </div>
            <div className="campo-inicio">
              <label>{etiqueta("categoria")}</label>
              {selectorConHoja({
                titulo: etiqueta("categoria"),
                opciones: [{ valor: "", etiqueta: t("comun.sinDato") }, ...opciones("categoria")],
                valor: jugador.categoria || "",
                alElegir: (valor) => cambiar("categoria", valor || ""),
              })}
            </div>
            <div className="campo-inicio">
              <label>{etiqueta("fecha_nacimiento")}</label>
              <input type="date" max={hoyISO()} value={jugador.fecha_nacimiento || ""} onChange={(evento) => cambiar("fecha_nacimiento", evento.target.value)} />
            </div>
            <div className="campo-inicio">
              <label>{etiqueta("pie_dominante")}</label>
              {selectorConHoja({
                titulo: etiqueta("pie_dominante"),
                opciones: [{ valor: "", etiqueta: t("comun.sinDato") }, ...opciones("pie_dominante")],
                valor: jugador.pie_dominante || "",
                alElegir: (valor) => cambiar("pie_dominante", valor || ""),
              })}
            </div>
            <DatoDetalle label={etiqueta("posicion")} valor={(jugador.puestos || []).map(nombrePuesto).join(" / ")} />
          </section>
          <div className="acciones-dobles">
            <BotonVolver onClick={() => setJugadorEditando(null)}>{t("comun.cancelar")}</BotonVolver>
            <button type="button" className="boton-principal" onClick={guardarJugador} disabled={ocupado}>
              {ocupado ? t("comun.guardando") : t("comun.guardar")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  let contenido;
  if (jugadorEditando) contenido = pantallaJugador(jugadorEditando);
  else if (formulario) contenido = pantallaFormulario(formulario);
  else if (lesionDetalle) contenido = pantallaDetalle(lesionDetalle);
  else if (vista === "historial") contenido = pantallaHistorial;
  else if (vista === "plantel") contenido = pantallaPlantel;
  else if (vista === "ajustes") contenido = pantallaAjustes();
  else contenido = pantallaLesionados;

  // Tocar un destino de la barra cierra lo que estuviera encima.
  const navegar = (id) => {
    setDetalleId(null);
    setFormulario(null);
    setJugadorEditando(null);
    if (id === "ajustes") setVistaAjustes("inicio");
    setVista(id);
  };

  const hojaDeTextos = ({ abierta, titulo, hoja, setHoja, onGuardar, onCerrar }) =>
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
          <label>{t("lesiones.ajustes.enEspanol")}</label>
          <input
            type="text"
            maxLength={120}
            value={hoja.etiquetas["es-AR"] || ""}
            onChange={(evento) => setHoja({ ...hoja, etiquetas: { ...hoja.etiquetas, "es-AR": evento.target.value } })}
          />
        </div>
        <div className="campo-inicio">
          <label>{t("lesiones.ajustes.enPortugues")}</label>
          <input
            type="text"
            maxLength={120}
            value={hoja.etiquetas["pt-BR"] || ""}
            onChange={(evento) => setHoja({ ...hoja, etiquetas: { ...hoja.etiquetas, "pt-BR": evento.target.value } })}
          />
        </div>
        <div className="grilla-criterios">
          <button type="button" className={`chip-criterio ${!hoja.oculto ? "prendido" : ""}`} aria-pressed={!hoja.oculto} onClick={() => setHoja({ ...hoja, oculto: false })}>
            {t("lesiones.ajustes.mostrar")}
          </button>
          <button type="button" className={`chip-criterio ${hoja.oculto ? "prendido" : ""}`} aria-pressed={hoja.oculto} onClick={() => setHoja({ ...hoja, oculto: true })}>
            {t("lesiones.ajustes.oculto")}
          </button>
        </div>
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
          descripcion={t("lesiones.altaTexto", { jugador: nombreDe(aDarAlta.jugador_id) })}
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
        titulo: hojaCabecera ? `${t("lesiones.ajustes.editarCabecera")}: ${etiqueta(hojaCabecera.clave)}` : "",
        hoja: hojaCabecera,
        setHoja: setHojaCabecera,
        onGuardar: guardarHojaCabecera,
        onCerrar: () => !ocupado && setHojaCabecera(null),
      })}

      {hojaDeTextos({
        abierta: Boolean(hojaOpcion),
        titulo: hojaOpcion ? (hojaOpcion.codigo ? `${t("lesiones.ajustes.editarOpcion")}: ${etiqueta(hojaOpcion.campo)}` : t("lesiones.ajustes.nuevaOpcion")) : "",
        hoja: hojaOpcion,
        setHoja: setHojaOpcion,
        onGuardar: guardarHojaOpcion,
        onCerrar: () => !ocupado && setHojaOpcion(null),
      })}

      <HojaConfirmar
        abierta={Boolean(aBorrar)}
        titulo={t("lesiones.borrarTitulo")}
        descripcion={t("lesiones.borrarTexto", { jugador: nombreDe(aBorrar?.jugador_id) })}
        icono="borrar"
        etiquetaConfirmar={t("lesiones.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBorrar}
        onCancelar={() => setABorrar(null)}
      />
    </MarcoAplicacion>
  );
}
