import React, { useCallback, useEffect, useMemo, useState } from "react";
import { EscudoCAM, EscudoRival, Icono, MarcoAplicacion } from "./components/AppChrome";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { cargarEquipos, elegirEquipoInicial, esElCam, guardarEquipoElegido, leerEquipoElegido } from "./domain/equipo.js";
import { cargarPlantel } from "./domain/plantel.js";
import {
  CONTEXTOS,
  LADOS,
  MECANISMOS,
  MODOS_INICIO,
  REGIONES,
  TEJIDOS,
  diasDeBaja,
  estadoDelPlantel,
  gravedad,
  lesionVacia,
  lesionesActivas,
  ordenarHistorial,
  posibleRecidiva,
  validarLesion,
} from "./domain/lesiones.js";
import {
  actualizarLesion,
  borrarLesion,
  crearLesion,
  darAltaLesion,
  historialDeLesion,
  listarLesiones,
} from "./domain/lesionesDb.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, fechaLarga, fechaYHora, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import "./lesiones.css";

// El módulo Lesiones: quién está lesionado hoy, el historial completo con
// filtros, el plantel con su situación y las listas de cada desplegable.
// Nace en dos idiomas: todo texto sale del diccionario (lesiones.*). Lee y
// escribe directo en la base; sin señal avisa y no inventa nada.

export const DESTINOS_LESIONES = [
  { id: "lesionados", etiqueta: "Lesionados", icono: "usuario" },
  { id: "historial", etiqueta: "Historial", icono: "registros" },
  { id: "plantel", etiqueta: "Plantel", icono: "escudo" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

// Cada desplegable del formulario: el campo, sus códigos y el prefijo de sus
// textos en el diccionario. Es la misma lista que muestra Ajustes › Listas.
export const LISTAS = [
  { campo: "region", codigos: REGIONES, prefijo: "lesiones.opciones.region", etiqueta: "lesiones.region", obligatorio: true },
  { campo: "lado", codigos: LADOS, prefijo: "lesiones.opciones.lado", etiqueta: "lesiones.lado", obligatorio: true },
  { campo: "contexto", codigos: CONTEXTOS, prefijo: "lesiones.opciones.contexto", etiqueta: "lesiones.contexto", obligatorio: true },
  { campo: "modo_inicio", codigos: MODOS_INICIO, prefijo: "lesiones.opciones.modo", etiqueta: "lesiones.modoInicio", obligatorio: true },
  { campo: "mecanismo", codigos: MECANISMOS, prefijo: "lesiones.opciones.mecanismo", etiqueta: "lesiones.mecanismo", obligatorio: false },
  { campo: "tejido", codigos: TEJIDOS, prefijo: "lesiones.opciones.tejido", etiqueta: "lesiones.tejido", obligatorio: false },
];

const FILTROS_VACIOS = Object.freeze({ jugador: "", estado: "", region: "", lado: "", tejido: "", contexto: "" });

const primeraMayuscula = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "");

const nombreDe = (plantel, jugadorId) =>
  plantel.find((jugador) => String(jugador.id) === String(jugadorId))?.nombre || "";

// Un desplegable del sistema: en el celular abre la rueda de opciones.
const Desplegable = ({ etiqueta, valor, onCambiar, opciones, vacio, deshabilitado = false }) => (
  <label className="lesiones-campo">
    <span>{etiqueta}</span>
    <select value={valor ?? ""} disabled={deshabilitado} onChange={(evento) => onCambiar(evento.target.value)}>
      <option value="">{vacio}</option>
      {opciones.map((opcion) => (
        <option key={opcion.valor} value={opcion.valor}>
          {opcion.etiqueta}
        </option>
      ))}
    </select>
  </label>
);

const opcionesDeLista = (lista) => lista.codigos.map((codigo) => ({ valor: codigo, etiqueta: t(`${lista.prefijo}.${codigo}`) }));

const Etiqueta = ({ lesion }) => {
  const nivel = gravedad(lesion);
  return <span className={`lesiones-gravedad ${nivel}`}>{t(`lesiones.gravedad.${nivel}`)}</span>;
};

const TarjetaLesion = ({ lesion, plantel, onEditar, onAlta }) => {
  const { plural } = useIdioma();
  const activa = !lesion.fecha_alta;
  return (
    <li className={`lesiones-tarjeta${activa ? " activa" : ""}`}>
      <button type="button" className="lesiones-tarjeta-cuerpo" onClick={() => onEditar(lesion)}>
        <span className="lesiones-tarjeta-fila">
          <strong>{nombreDe(plantel, lesion.jugador_id) || "—"}</strong>
          <Etiqueta lesion={lesion} />
        </span>
        <span className="lesiones-tarjeta-detalle">
          {t(`lesiones.opciones.region.${lesion.region}`)} · {t(`lesiones.opciones.lado.${lesion.lado}`)}
          {lesion.tejido ? ` · ${t(`lesiones.opciones.tejido.${lesion.tejido}`)}` : ""}
        </span>
        <span className="lesiones-tarjeta-fechas">
          <b>{plural("lesiones.dias", diasDeBaja(lesion))}</b>
          {" · "}
          {t("lesiones.desde", { fecha: fechaCorta(lesion.fecha_lesion) })}
          {lesion.fecha_alta ? ` · ${t("lesiones.altaEl", { fecha: fechaCorta(lesion.fecha_alta) })}` : ""}
        </span>
        {lesion.diagnostico && <span className="lesiones-tarjeta-diagnostico">{lesion.diagnostico}</span>}
      </button>
      {activa && onAlta && (
        <button type="button" className="lesiones-boton-alta" onClick={() => onAlta(lesion)}>
          {t("lesiones.darAlta")}
        </button>
      )}
    </li>
  );
};

const Formulario = ({ abierta, inicial, plantel, lesiones, ocupado, onGuardar, onBorrar, onCerrar }) => {
  const [lesion, setLesion] = useState(inicial);
  const [conAlta, setConAlta] = useState(false);
  const [error, setError] = useState("");
  const [cambios, setCambios] = useState([]);

  useEffect(() => {
    setLesion(inicial);
    setConAlta(Boolean(inicial?.fecha_alta));
    setError("");
    setCambios([]);
    if (abierta && inicial?.id) {
      historialDeLesion(inicial.id).then((respuesta) => setCambios(respuesta.cambios));
    }
  }, [abierta, inicial]);

  if (!abierta || !lesion) return null;

  const cambiar = (campo, valor) => setLesion((actual) => ({ ...actual, [campo]: valor }));
  const hoy = hoyISO();
  const recidiva = posibleRecidiva(lesion, lesiones);

  const guardar = () => {
    const aGuardar = { ...lesion, fecha_alta: conAlta ? lesion.fecha_alta || "" : null };
    const falta = validarLesion(aGuardar, { hoy, otras: lesiones });
    if (falta) {
      setError(
        t(falta, {
          region: t(`lesiones.opciones.region.${lesion.region}`),
          lado: t(`lesiones.opciones.lado.${lesion.lado}`),
        }),
      );
      return;
    }
    onGuardar({ ...aGuardar, recidiva_de: recidiva?.id || lesion.recidiva_de || null });
  };

  return (
    <HojaInferior
      abierta={abierta}
      className="lesiones-hoja"
      titulo={lesion.id ? t("lesiones.formEditar") : t("lesiones.formNueva")}
      onCerrar={onCerrar}
      acciones={
        <>
          <button type="button" className="boton-cancelar-hoja" onClick={onCerrar} disabled={ocupado}>
            {t("comun.cancelar")}
          </button>
          <button type="button" className="boton-confirmar-hoja" onClick={guardar} disabled={ocupado}>
            {ocupado ? t("comun.guardando") : t("comun.guardar")}
          </button>
        </>
      }
    >
      {error && <div className="aviso-hoja">{error}</div>}
      {recidiva && (
        <div className="lesiones-aviso-recidiva">
          {t("lesiones.avisoRecidiva", {
            region: t(`lesiones.opciones.region.${recidiva.region}`),
            lado: t(`lesiones.opciones.lado.${recidiva.lado}`),
            fecha: fechaCorta(recidiva.fecha_lesion),
          })}
        </div>
      )}

      {lesion.id ? (
        <div className="lesiones-campo">
          <span>{t("lesiones.jugador")}</span>
          <strong className="lesiones-jugador-fijo">{nombreDe(plantel, lesion.jugador_id)}</strong>
        </div>
      ) : (
        <>
          <Desplegable
            etiqueta={t("lesiones.jugador")}
            valor={lesion.jugador_id ?? ""}
            vacio={t("comun.elegir")}
            opciones={plantel.map((jugador) => ({ valor: String(jugador.id), etiqueta: jugador.nombre }))}
            onCambiar={(valor) => cambiar("jugador_id", valor ? (plantel.find((j) => String(j.id) === valor)?.id ?? valor) : null)}
          />
          {plantel.length === 0 && <small className="lesiones-ayuda">{t("lesiones.sinJugadores")}</small>}
        </>
      )}

      <label className="lesiones-campo">
        <span>{t("lesiones.fechaLesion")}</span>
        <input type="date" value={lesion.fecha_lesion || ""} max={hoy} onChange={(evento) => cambiar("fecha_lesion", evento.target.value)} />
      </label>

      {LISTAS.map((lista) => (
        <Desplegable
          key={lista.campo}
          etiqueta={t(lista.etiqueta)}
          valor={lesion[lista.campo] ?? ""}
          vacio={lista.obligatorio ? t("comun.elegir") : t("comun.sinDato")}
          opciones={opcionesDeLista(lista)}
          onCambiar={(valor) => cambiar(lista.campo, valor || (lista.obligatorio ? "" : null))}
        />
      ))}

      <label className="lesiones-campo">
        <span>{t("lesiones.diagnostico")}</span>
        <input type="text" value={lesion.diagnostico} maxLength={120} onChange={(evento) => cambiar("diagnostico", evento.target.value)} />
        <small className="lesiones-ayuda">{t("lesiones.diagnosticoAyuda")}</small>
      </label>
      <label className="lesiones-campo">
        <span>{t("lesiones.observaciones")}</span>
        <textarea rows={2} value={lesion.observaciones} maxLength={500} onChange={(evento) => cambiar("observaciones", evento.target.value)} />
      </label>

      <label className="lesiones-marcar">
        <input type="checkbox" checked={conAlta} onChange={(evento) => setConAlta(evento.target.checked)} />
        <span>{t("lesiones.yaTieneAlta")}</span>
      </label>
      {conAlta ? (
        <label className="lesiones-campo">
          <span>{t("lesiones.fechaAlta")}</span>
          <input
            type="date"
            value={lesion.fecha_alta || ""}
            min={lesion.fecha_lesion || undefined}
            max={hoy}
            onChange={(evento) => cambiar("fecha_alta", evento.target.value || null)}
          />
        </label>
      ) : (
        <small className="lesiones-ayuda">{t("lesiones.sinAlta")}</small>
      )}

      {lesion.id && (
        <>
          <div className="lesiones-cambios">
            <span>{t("lesiones.historial.cambios")}</span>
            {cambios.length === 0 ? (
              <small className="lesiones-ayuda">{t("lesiones.historial.sinCambios")}</small>
            ) : (
              <ul>
                {cambios.map((cambio) => (
                  <li key={cambio.id}>
                    <b>{t(`lesiones.historial.${cambio.accion === "creada" ? "creada" : "editada"}`)}</b>{" "}
                    {t("lesiones.historial.cambio", { fecha: fechaYHora(cambio.cuando), quien: cambio.quien_email || "—" })}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="lesiones-boton-borrar" disabled={ocupado} onClick={() => onBorrar(lesion)}>
            <Icono nombre="borrar" size={16} />
            {t("lesiones.borrar")}
          </button>
        </>
      )}
    </HojaInferior>
  );
};

const HojaAlta = ({ lesion, plantel, ocupado, onConfirmar, onCerrar }) => {
  const [fecha, setFecha] = useState(hoyISO());
  const [error, setError] = useState("");
  useEffect(() => {
    setFecha(hoyISO());
    setError("");
  }, [lesion]);
  if (!lesion) return null;
  const confirmar = () => {
    if (!fecha) return setError(t("lesiones.error.fecha"));
    if (fecha < lesion.fecha_lesion) return setError(t("lesiones.error.altaAntes"));
    if (fecha > hoyISO()) return setError(t("lesiones.error.altaFutura"));
    return onConfirmar(lesion, fecha);
  };
  return (
    <HojaInferior
      abierta={Boolean(lesion)}
      className="lesiones-hoja"
      titulo={t("lesiones.altaTitulo")}
      descripcion={t("lesiones.altaTexto", { jugador: nombreDe(plantel, lesion.jugador_id) })}
      onCerrar={onCerrar}
      acciones={
        <>
          <button type="button" className="boton-cancelar-hoja" onClick={onCerrar} disabled={ocupado}>
            {t("comun.cancelar")}
          </button>
          <button type="button" className="boton-confirmar-hoja" onClick={confirmar} disabled={ocupado}>
            {ocupado ? t("comun.guardando") : t("lesiones.siAlta")}
          </button>
        </>
      }
    >
      {error && <div className="aviso-hoja">{error}</div>}
      <label className="lesiones-campo">
        <span>{t("lesiones.altaFecha")}</span>
        <input type="date" value={fecha} min={lesion.fecha_lesion} max={hoyISO()} onChange={(evento) => setFecha(evento.target.value)} />
      </label>
    </HojaInferior>
  );
};

const Escudo = ({ nombre }) =>
  esElCam(nombre) ? <EscudoCAM etiqueta={nombre} /> : <EscudoRival nombre={nombre} />;

// Título de las pantallas que no son la principal, con el globo del idioma
// a la derecha.
const Encabezado = ({ titulo, texto }) => (
  <header className="encabezado lesiones-encabezado">
    <div className="lesiones-encabezado-texto">
      <h1>{titulo}</h1>
      <p>{texto}</p>
    </div>
    <SelectorIdioma className="lesiones-idioma" />
  </header>
);

export default function Lesiones({ onVolver }) {
  const { plural } = useIdioma();
  const [equipo, setEquipo] = useState(() => leerEquipoElegido());
  const [vista, setVista] = useState("lesionados");
  const [plantel, setPlantel] = useState([]);
  const [lesiones, setLesiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [formulario, setFormulario] = useState(null);
  const [aDarAlta, setADarAlta] = useState(null);
  const [aBorrar, setABorrar] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));

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
    const [respuestaPlantel, respuestaLesiones] = await Promise.all([cargarPlantel(equipoId), listarLesiones(equipoId)]);
    setPlantel(respuestaPlantel.plantel || []);
    if (respuestaLesiones.error) {
      setError(respuestaLesiones.error);
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

  const activas = useMemo(() => lesionesActivas(lesiones), [lesiones]);
  const hayFiltros = Object.values(filtros).some(Boolean);
  const historial = useMemo(
    () =>
      ordenarHistorial(
        lesiones.filter((lesion) => {
          if (filtros.jugador && String(lesion.jugador_id) !== filtros.jugador) return false;
          if (filtros.estado === "activas" && lesion.fecha_alta) return false;
          if (filtros.estado === "conAlta" && !lesion.fecha_alta) return false;
          if (filtros.region && lesion.region !== filtros.region) return false;
          if (filtros.lado && lesion.lado !== filtros.lado) return false;
          if (filtros.tejido && lesion.tejido !== filtros.tejido) return false;
          if (filtros.contexto && lesion.contexto !== filtros.contexto) return false;
          return true;
        }),
      ),
    [lesiones, filtros],
  );
  const plantelConEstado = useMemo(() => estadoDelPlantel(plantel, lesiones), [plantel, lesiones]);

  const reemplazar = (lesion) =>
    setLesiones((actuales) => {
      const existe = actuales.some((otra) => otra.id === lesion.id);
      return existe ? actuales.map((otra) => (otra.id === lesion.id ? lesion : otra)) : [lesion, ...actuales];
    });

  const avisarError = (clave, lesion) =>
    setAviso(
      t(clave, {
        region: t(`lesiones.opciones.region.${lesion?.region}`),
        lado: t(`lesiones.opciones.lado.${lesion?.lado}`),
      }),
    );

  const guardar = async (lesion) => {
    setOcupado(true);
    const respuesta = lesion.id ? await actualizarLesion(lesion.id, lesion) : await crearLesion(equipoId, lesion);
    setOcupado(false);
    if (respuesta.error) return avisarError(respuesta.error, lesion);
    reemplazar(respuesta.lesion);
    setFormulario(null);
    setAviso(t("lesiones.guardado"));
    return undefined;
  };

  const darAlta = async (lesion, fecha) => {
    setOcupado(true);
    const respuesta = await darAltaLesion(lesion.id, fecha);
    setOcupado(false);
    if (respuesta.error) return avisarError(respuesta.error, lesion);
    reemplazar(respuesta.lesion);
    setADarAlta(null);
    setAviso(t("lesiones.altaGuardada"));
    return undefined;
  };

  const borrar = async () => {
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
    setFormulario(null);
    setAviso(t("lesiones.borrada"));
  };

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

  const pantallas = {
    lesionados: (
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
              <Escudo nombre={equipo?.nombre || ""} />
              <span className="etiqueta-hero">{t("lesiones.titulo").toUpperCase()}</span>
              <strong className="nombre-sesion">{equipo?.nombre || t("lesiones.hoy")}</strong>
              <p className="fecha-hero">{hoy}</p>
              <span className={`estado-hero ${activas.length ? "en-curso" : ""}`}>{plural("lesiones.activas", activas.length)}</span>
            </div>
          </header>

          {estado}

          <button type="button" className="lesiones-boton-nueva" onClick={() => setFormulario(lesionVacia())} disabled={!enLinea || Boolean(error)}>
            + {t("lesiones.nueva")}
          </button>

          {!cargando && !error && activas.length === 0 && <p className="lesiones-vacio">{t("lesiones.sinActivas")}</p>}
          <ul className="lesiones-lista">
            {activas.map((lesion) => (
              <TarjetaLesion key={lesion.id} lesion={lesion} plantel={plantel} onEditar={setFormulario} onAlta={setADarAlta} />
            ))}
          </ul>
        </div>
      </div>
    ),
    historial: (
      <div className="app">
        <div className="contenedor">
          <Encabezado titulo={t("lesiones.historial.titulo")} texto={t("lesiones.historial.texto")} />
          {estado}
          <section className="lesiones-filtros" aria-label={t("comun.filtros")}>
            <div className="lesiones-filtros-titulo">
              <Icono nombre="filtro" size={14} />
              <span>{t("comun.filtros")}</span>
              {hayFiltros && (
                <button type="button" onClick={() => setFiltros(FILTROS_VACIOS)}>
                  {t("comun.quitarFiltros")}
                </button>
              )}
            </div>
            <div className="lesiones-filtros-grilla">
              <Desplegable
                etiqueta={t("lesiones.jugador")}
                valor={filtros.jugador}
                vacio={t("lesiones.historial.todos")}
                opciones={plantel.map((jugador) => ({ valor: String(jugador.id), etiqueta: jugador.nombre }))}
                onCambiar={(valor) => setFiltros((actual) => ({ ...actual, jugador: valor }))}
              />
              <Desplegable
                etiqueta={t("lesiones.historial.estado")}
                valor={filtros.estado}
                vacio={t("lesiones.historial.todas")}
                opciones={[
                  { valor: "activas", etiqueta: t("lesiones.historial.activas") },
                  { valor: "conAlta", etiqueta: t("lesiones.historial.conAlta") },
                ]}
                onCambiar={(valor) => setFiltros((actual) => ({ ...actual, estado: valor }))}
              />
              {LISTAS.filter((lista) => ["region", "lado", "tejido", "contexto"].includes(lista.campo)).map((lista) => (
                <Desplegable
                  key={lista.campo}
                  etiqueta={t(lista.etiqueta)}
                  valor={filtros[lista.campo]}
                  vacio={t("lesiones.historial.todas")}
                  opciones={opcionesDeLista(lista)}
                  onCambiar={(valor) => setFiltros((actual) => ({ ...actual, [lista.campo]: valor }))}
                />
              ))}
            </div>
          </section>
          {!cargando && !error && (
            <p className="lesiones-cantidad">
              {lesiones.length === 0
                ? t("lesiones.historial.vacio")
                : historial.length === 0
                  ? t("lesiones.historial.sinResultados")
                  : plural("lesiones.historial.cantidad", historial.length)}
            </p>
          )}
          <ul className="lesiones-lista">
            {historial.map((lesion) => (
              <TarjetaLesion key={lesion.id} lesion={lesion} plantel={plantel} onEditar={setFormulario} onAlta={null} />
            ))}
          </ul>
        </div>
      </div>
    ),
    plantel: (
      <div className="app">
        <div className="contenedor">
          <Encabezado
            titulo={t("lesiones.plantel.titulo")}
            texto={`${t("lesiones.plantel.texto")}${
              plantel.length > 0
                ? ` ${t("lesiones.plantel.disponibles", {
                    n: plantelConEstado.filter((fila) => fila.lesiones.length === 0).length,
                    total: plantel.length,
                  })}`
                : ""
            }`}
          />
          {estado}
          {!cargando && plantel.length === 0 && <p className="lesiones-vacio">{t("lesiones.plantel.sinPlantel")}</p>}
          <ul className="lesiones-plantel">
            {plantelConEstado.map(({ jugador, lesiones: suyas }) => (
              <li key={jugador.id} className={suyas.length ? "lesionado" : "disponible"}>
                <strong>{jugador.nombre}</strong>
                <span>
                  {suyas.length
                    ? `${t("lesiones.plantel.lesionado")} · ${suyas.map((lesion) => t(`lesiones.opciones.region.${lesion.region}`)).join(", ")}`
                    : t("lesiones.plantel.disponible")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
    ajustes: (
      <div className="app">
        <div className="contenedor">
          <Encabezado titulo={t("lesiones.ajustes.titulo")} texto={t("lesiones.ajustes.texto")} />
          <section className="lesiones-listas">
            <h2>{t("lesiones.ajustes.listas")}</h2>
            <p>{t("lesiones.ajustes.listasTexto")}</p>
            {LISTAS.map((lista) => (
              <details key={lista.campo} className="lesiones-lista-detalle">
                <summary>
                  <b>{t(lista.etiqueta)}</b>
                  <span>{plural("lesiones.ajustes.opciones", lista.codigos.length)}</span>
                </summary>
                <ul>
                  {opcionesDeLista(lista).map((opcion) => (
                    <li key={opcion.valor}>{opcion.etiqueta}</li>
                  ))}
                </ul>
              </details>
            ))}
            <p className="lesiones-ayuda">{t("lesiones.ajustes.listasAyuda")}</p>
          </section>
        </div>
      </div>
    ),
  };

  return (
    <MarcoAplicacion activo={vista} onNavigate={setVista} destinos={DESTINOS_LESIONES} marca={t("lesiones.titulo")} className="entrenamiento-marco lesiones-marco">
      {pantallas[vista] || pantallas.lesionados}

      {aviso && (
        <div className="lesiones-toast" role="status">
          {aviso}
        </div>
      )}

      <Formulario
        abierta={Boolean(formulario)}
        inicial={formulario}
        plantel={plantel}
        lesiones={lesiones}
        ocupado={ocupado}
        onGuardar={guardar}
        onBorrar={setABorrar}
        onCerrar={() => !ocupado && setFormulario(null)}
      />
      <HojaAlta lesion={aDarAlta} plantel={plantel} ocupado={ocupado} onConfirmar={darAlta} onCerrar={() => !ocupado && setADarAlta(null)} />
      <HojaConfirmar
        abierta={Boolean(aBorrar)}
        titulo={t("lesiones.borrarTitulo")}
        descripcion={t("lesiones.borrarTexto", { jugador: nombreDe(plantel, aBorrar?.jugador_id) })}
        icono="borrar"
        etiquetaConfirmar={t("lesiones.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={borrar}
        onCancelar={() => setABorrar(null)}
      />
    </MarcoAplicacion>
  );
}
