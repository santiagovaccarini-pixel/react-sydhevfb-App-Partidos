import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Icono, MarcoAplicacion } from "./components/AppChrome";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { cargarEquipos, elegirEquipoInicial, guardarEquipoElegido, leerEquipoElegido } from "./domain/equipo.js";
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
import { actualizarLesion, crearLesion, darAltaLesion, historialDeLesion, listarLesiones } from "./domain/lesionesDb.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, fechaLarga, fechaYHora, hoyISO } from "./idioma/formatos.js";
import "./lesiones.css";

// El módulo Lesiones: quién está lesionado hoy, el historial completo, el
// plantel con su situación y los ajustes. Nace en dos idiomas: todo texto
// sale del diccionario (lesiones.*). Lee y escribe directo en la base; sin
// señal avisa y no inventa nada.

export const DESTINOS_LESIONES = [
  { id: "lesionados", etiqueta: "Lesionados", icono: "usuario" },
  { id: "historial", etiqueta: "Historial", icono: "registros" },
  { id: "plantel", etiqueta: "Plantel", icono: "escudo" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

const primeraMayuscula = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "");

const nombreDe = (plantel, jugadorId) =>
  plantel.find((jugador) => String(jugador.id) === String(jugadorId))?.nombre || "";

const Chips = ({ opciones, prefijo, valor, onElegir, opcional = false }) => (
  <div className="lesiones-chips" role="group">
    {opcional && (
      <button type="button" className={`lesiones-chip${!valor ? " elegido" : ""}`} aria-pressed={!valor} onClick={() => onElegir(null)}>
        {t("comun.sinDato")}
      </button>
    )}
    {opciones.map((codigo) => (
      <button
        key={codigo}
        type="button"
        className={`lesiones-chip${valor === codigo ? " elegido" : ""}`}
        aria-pressed={valor === codigo}
        onClick={() => onElegir(codigo)}
      >
        {t(`${prefijo}.${codigo}`)}
      </button>
    ))}
  </div>
);

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

const Formulario = ({ abierta, inicial, plantel, lesiones, ocupado, onGuardar, onCerrar }) => {
  const [lesion, setLesion] = useState(inicial);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [cambios, setCambios] = useState([]);

  useEffect(() => {
    setLesion(inicial);
    setBusqueda("");
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
  const filtro = busqueda.trim().toLocaleLowerCase();
  const candidatos = filtro
    ? plantel.filter((jugador) => jugador.nombre.toLocaleLowerCase().includes(filtro))
    : plantel;

  const guardar = () => {
    const falta = validarLesion(lesion, { hoy, otras: lesiones });
    if (falta) {
      setError(t(falta, { region: t(`lesiones.opciones.region.${lesion.region}`), lado: t(`lesiones.opciones.lado.${lesion.lado}`) }));
      return;
    }
    onGuardar({ ...lesion, recidiva_de: recidiva?.id || lesion.recidiva_de || null });
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

      <label className="lesiones-campo">
        <span>{t("lesiones.jugador")}</span>
        {lesion.id ? (
          <strong className="lesiones-jugador-fijo">{nombreDe(plantel, lesion.jugador_id)}</strong>
        ) : (
          <>
            <input
              type="search"
              value={busqueda}
              placeholder={t("lesiones.buscarJugador")}
              onChange={(evento) => setBusqueda(evento.target.value)}
            />
            {plantel.length === 0 ? (
              <small className="lesiones-ayuda">{t("lesiones.sinJugadores")}</small>
            ) : (
              <div className="lesiones-chips lesiones-jugadores">
                {candidatos.map((jugador) => (
                  <button
                    key={jugador.id}
                    type="button"
                    className={`lesiones-chip${String(lesion.jugador_id) === String(jugador.id) ? " elegido" : ""}`}
                    aria-pressed={String(lesion.jugador_id) === String(jugador.id)}
                    onClick={() => cambiar("jugador_id", jugador.id)}
                  >
                    {jugador.nombre}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </label>

      <div className="lesiones-fechas">
        <label className="lesiones-campo">
          <span>{t("lesiones.fechaLesion")}</span>
          <input type="date" value={lesion.fecha_lesion || ""} max={hoy} onChange={(evento) => cambiar("fecha_lesion", evento.target.value)} />
        </label>
        <label className="lesiones-campo">
          <span>{t("lesiones.fechaAlta")}</span>
          <input
            type="date"
            value={lesion.fecha_alta || ""}
            min={lesion.fecha_lesion || undefined}
            max={hoy}
            onChange={(evento) => cambiar("fecha_alta", evento.target.value || null)}
          />
          <small className="lesiones-ayuda">{lesion.fecha_alta ? "" : t("lesiones.sinAlta")}</small>
        </label>
      </div>

      <div className="lesiones-campo">
        <span>{t("lesiones.region")}</span>
        <Chips opciones={REGIONES} prefijo="lesiones.opciones.region" valor={lesion.region} onElegir={(valor) => cambiar("region", valor)} />
      </div>
      <div className="lesiones-campo">
        <span>{t("lesiones.lado")}</span>
        <Chips opciones={LADOS} prefijo="lesiones.opciones.lado" valor={lesion.lado} onElegir={(valor) => cambiar("lado", valor)} />
      </div>
      <div className="lesiones-campo">
        <span>{t("lesiones.contexto")}</span>
        <Chips opciones={CONTEXTOS} prefijo="lesiones.opciones.contexto" valor={lesion.contexto} onElegir={(valor) => cambiar("contexto", valor)} />
      </div>
      <div className="lesiones-campo">
        <span>{t("lesiones.modoInicio")}</span>
        <Chips opciones={MODOS_INICIO} prefijo="lesiones.opciones.modo" valor={lesion.modo_inicio} onElegir={(valor) => cambiar("modo_inicio", valor)} />
      </div>
      <div className="lesiones-campo">
        <span>{t("lesiones.mecanismo")}</span>
        <Chips opciones={MECANISMOS} prefijo="lesiones.opciones.mecanismo" valor={lesion.mecanismo} onElegir={(valor) => cambiar("mecanismo", valor)} opcional />
      </div>
      <div className="lesiones-campo">
        <span>{t("lesiones.tejido")}</span>
        <Chips opciones={TEJIDOS} prefijo="lesiones.opciones.tejido" valor={lesion.tejido} onElegir={(valor) => cambiar("tejido", valor)} opcional />
      </div>

      <label className="lesiones-campo">
        <span>{t("lesiones.diagnostico")}</span>
        <input type="text" value={lesion.diagnostico} maxLength={120} onChange={(evento) => cambiar("diagnostico", evento.target.value)} />
        <small className="lesiones-ayuda">{t("lesiones.diagnosticoAyuda")}</small>
      </label>
      <label className="lesiones-campo">
        <span>{t("lesiones.observaciones")}</span>
        <textarea rows={2} value={lesion.observaciones} maxLength={500} onChange={(evento) => cambiar("observaciones", evento.target.value)} />
      </label>

      {lesion.id && (
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

export default function Lesiones({ email = "", onVolver, onCerrarSesion }) {
  const { idioma, idiomas, cambiarIdioma, plural } = useIdioma();
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
  const [filtroJugador, setFiltroJugador] = useState(null);
  const [eligiendoJugador, setEligiendoJugador] = useState(false);
  const [eligiendoIdioma, setEligiendoIdioma] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));

  const equipoId = equipo?.id || null;

  // Sin club elegido en este celular (todavía no se entró a Partido), se
  // adopta el que diga la base, igual que hace Partido al abrir.
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
  const historial = useMemo(
    () => ordenarHistorial(filtroJugador ? lesiones.filter((lesion) => String(lesion.jugador_id) === String(filtroJugador)) : lesiones),
    [lesiones, filtroJugador],
  );
  const plantelConEstado = useMemo(() => estadoDelPlantel(plantel, lesiones), [plantel, lesiones]);

  const reemplazar = (lesion) =>
    setLesiones((actuales) => {
      const existe = actuales.some((otra) => otra.id === lesion.id);
      return existe ? actuales.map((otra) => (otra.id === lesion.id ? lesion : otra)) : [lesion, ...actuales];
    });

  const guardar = async (lesion) => {
    setOcupado(true);
    const respuesta = lesion.id ? await actualizarLesion(lesion.id, lesion) : await crearLesion(equipoId, lesion);
    setOcupado(false);
    if (respuesta.error) {
      setAviso(t(respuesta.error, { region: t(`lesiones.opciones.region.${lesion.region}`), lado: t(`lesiones.opciones.lado.${lesion.lado}`) }));
      return;
    }
    reemplazar(respuesta.lesion);
    setFormulario(null);
    setAviso(t("lesiones.guardado"));
  };

  const darAlta = async (lesion, fecha) => {
    setOcupado(true);
    const respuesta = await darAltaLesion(lesion.id, fecha);
    setOcupado(false);
    if (respuesta.error) {
      setAviso(t(respuesta.error));
      return;
    }
    reemplazar(respuesta.lesion);
    setADarAlta(null);
    setAviso(t("lesiones.altaGuardada"));
  };

  const abrirNueva = () => setFormulario(lesionVacia());

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
          <header className="hero-partido hero-sesion">
            {onVolver && (
              <button type="button" className="boton-modulos" onClick={onVolver}>
                <Icono nombre="flecha" size={14} />
                {t("portal.modulos")}
              </button>
            )}
            <span className="etiqueta-hero">{t("lesiones.titulo").toUpperCase()}</span>
            <strong className="nombre-sesion">{equipo?.nombre || t("lesiones.hoy")}</strong>
            <p className="fecha-hero">{hoy}</p>
            <span className={`estado-hero ${activas.length ? "en-curso" : ""}`}>{plural("lesiones.activas", activas.length)}</span>
          </header>

          {estado}

          <button type="button" className="lesiones-boton-nueva" onClick={abrirNueva} disabled={!enLinea || Boolean(error)}>
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
          <header className="encabezado">
            <h1>{t("lesiones.historial.titulo")}</h1>
            <p>{t("lesiones.historial.texto")}</p>
          </header>
          {estado}
          <button type="button" className="lesiones-filtro" onClick={() => setEligiendoJugador(true)}>
            <Icono nombre="filtro" size={16} />
            {filtroJugador ? nombreDe(plantel, filtroJugador) : t("lesiones.historial.todos")}
          </button>
          {!cargando && !error && historial.length === 0 && <p className="lesiones-vacio">{t("lesiones.historial.vacio")}</p>}
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
          <header className="encabezado">
            <h1>{t("lesiones.plantel.titulo")}</h1>
            <p>
              {t("lesiones.plantel.texto")}{" "}
              {plantel.length > 0 &&
                t("lesiones.plantel.disponibles", {
                  n: plantelConEstado.filter((fila) => fila.lesiones.length === 0).length,
                  total: plantel.length,
                })}
            </p>
          </header>
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
          <header className="encabezado">
            <h1>{t("lesiones.ajustes.titulo")}</h1>
            <p>{t("lesiones.ajustes.texto")}</p>
          </header>
          {[
            {
              id: "idioma",
              icono: "documento",
              titulo: t("lesiones.ajustes.idioma"),
              detalle: idiomas.find((opcion) => opcion.codigo === idioma)?.nombre || idioma,
              alTocar: () => setEligiendoIdioma(true),
            },
            {
              id: "modulos",
              icono: "flecha",
              titulo: t("lesiones.ajustes.modulos"),
              detalle: t("lesiones.ajustes.modulosTexto"),
              alTocar: onVolver,
            },
            {
              id: "salir",
              icono: "candado",
              titulo: t("lesiones.ajustes.cerrarSesion"),
              detalle: email || t("lesiones.ajustes.cerrarSesionTexto"),
              alTocar: () => setConfirmarSalida(true),
            },
          ].map((opcion) => (
            <button key={opcion.id} type="button" className="opcion-ajuste" onClick={opcion.alTocar}>
              <span className="icono-ajuste">
                <Icono nombre={opcion.icono} size={18} />
              </span>
              <span className="texto-ajuste">
                <b>{opcion.titulo}</b>
                <span>{opcion.detalle}</span>
              </span>
              <span className="flecha-ajuste">›</span>
            </button>
          ))}
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
        onCerrar={() => !ocupado && setFormulario(null)}
      />
      <HojaAlta lesion={aDarAlta} plantel={plantel} ocupado={ocupado} onConfirmar={darAlta} onCerrar={() => !ocupado && setADarAlta(null)} />

      <HojaOpciones
        abierta={eligiendoJugador}
        titulo={t("lesiones.jugador")}
        opciones={[{ valor: "", etiqueta: t("lesiones.historial.todos") }, ...plantel.map((jugador) => ({ valor: String(jugador.id), etiqueta: jugador.nombre }))]}
        elegida={filtroJugador ? String(filtroJugador) : ""}
        onElegir={(valor) => {
          setFiltroJugador(valor || null);
          setEligiendoJugador(false);
        }}
        onCerrar={() => setEligiendoJugador(false)}
      />
      <HojaOpciones
        abierta={eligiendoIdioma}
        titulo={t("lesiones.ajustes.idioma")}
        opciones={idiomas.map((opcion) => ({ valor: opcion.codigo, etiqueta: opcion.nombre }))}
        elegida={idioma}
        onElegir={(valor) => {
          cambiarIdioma(valor);
          setEligiendoIdioma(false);
        }}
        onCerrar={() => setEligiendoIdioma(false)}
      />
      <HojaConfirmar
        abierta={confirmarSalida}
        titulo={t("lesiones.ajustes.cerrarTitulo")}
        descripcion={t("lesiones.ajustes.cerrarTexto")}
        icono="candado"
        etiquetaConfirmar={t("lesiones.ajustes.siCerrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={() => {
          setConfirmarSalida(false);
          onCerrarSesion?.();
        }}
        onCancelar={() => setConfirmarSalida(false)}
      />
    </MarcoAplicacion>
  );
}
