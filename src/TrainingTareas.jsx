import React, { useEffect, useMemo, useState } from "react";
import { leerEquipoElegido } from "./domain/equipo.js";
import { cargarPlantelConCatapult } from "./domain/plantel.js";
import {
  MODO_PARCIAL,
  MODO_TOTAL,
  armarEnvio,
  cargarSesion,
  estadoEnvioTarea,
  fechaDeActividad,
  guardarSesion,
  horaAMs,
  horaLocal,
  huellaTarea,
  msAHora,
  nuevaTarea,
  problemasDeTarea,
  resumenTarea,
  segundosATexto,
} from "./domain/sesionEntrenamiento.js";
import { pedirJson } from "./trainingApi.js";
import { ETIQUETAS_VEREDICTO, MOTIVOS_FALLO, mensajeDeError } from "./textosEntrenamiento.js";
import { BotonVolver, DatoDetalle } from "./components/BotonVolver.jsx";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { Icono } from "./components/AppChrome";

const generarId = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Etiqueta y pastilla de cada estado de envío, con la clase de Partido que le
// da el color (gris, verde, ámbar) más `tarea-estado` para encontrarla.
const ESTADOS = {
  pendiente: { etiqueta: "Sin enviar", clase: "marca-localia" },
  enviada: { etiqueta: "Enviada", clase: "marca-enviada" },
  modificada: { etiqueta: "Con cambios", clase: "marca-sin-sincronizar" },
  incompleta: { etiqueta: "Incompleta", clase: "marca-incompleta" },
};

const huellaEnvio = (tareas) => JSON.stringify(tareas.map(huellaTarea));

// Lo que hace falta para entender un rechazo del servidor sin abrir Vercel:
// el código HTTP de la respuesta, el status y el cuerpo del PUT, la etapa y
// el detalle del error. Se muestra plegado, solo para mandar por chat.
const detalleTecnico = (payload, status) => {
  const partes = [];
  if (status) partes.push(`Respuesta del servidor: ${status}`);
  if (payload?.code) partes.push(`Código: ${payload.code}`);
  if (payload?.etapa) partes.push(`Etapa: ${payload.etapa}`);
  if (payload?.put) {
    partes.push(`PUT batch: ${payload.put.status ?? "sin respuesta"}${payload.put.error ? ` (${payload.put.error})` : ""}`);
    if (payload.put.cuerpoCrudo) partes.push(`Respuesta de OpenField: ${payload.put.cuerpoCrudo}`);
    else if (payload.put.cuerpo) partes.push(`Cuerpo del PUT: ${JSON.stringify(payload.put.cuerpo)}`);
  }
  if (payload?.detalle) partes.push(`Detalle: ${typeof payload.detalle === "string" ? payload.detalle : JSON.stringify(payload.detalle)}`);
  if (payload?.veredicto?.codigo) partes.push(`Veredicto: ${payload.veredicto.codigo}`);
  if (payload?.evaluacion?.interna?.resumen) partes.push(`Interna: ${JSON.stringify(payload.evaluacion.interna.resumen)}`);
  if (payload?.evaluacion?.connect?.resumen) partes.push(`Connect: ${JSON.stringify(payload.evaluacion.connect.resumen)}`);
  return partes.join("\n");
};

const DetalleTecnico = ({ texto }) =>
  texto ? (
    <details className="ajustes-periodo detalle-tecnico">
      <summary>Detalle para mandar por chat</summary>
      <pre>{texto}</pre>
    </details>
  ) : null;

// "26/05 18:10", en la hora del celular.
const formatearFechaHora = (iso) => {
  const fecha = new Date(iso);
  if (!iso || Number.isNaN(fecha.getTime())) return "";
  const dos = (numero) => String(numero).padStart(2, "0");
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
};

// "HH:MM" a partir de "HH:MM:SS" o de un instante en ms.
const horaCorta = (hora) => String(hora || "").slice(0, 5);
const horaCortaDeMs = (ms) => horaCorta(msAHora(ms));

const plural = (cantidad, singular, pluralTexto) => `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;

// Duración de una pausa tal como está cargada; "—" si todavía no cierra.
const duracionDePausa = (tarea, pausa) => {
  const inicioMs = horaAMs(tarea.fecha, pausa.inicio);
  const finMs = horaAMs(tarea.fecha, pausa.fin);
  if (inicioMs === null || finMs === null || finMs <= inicioMs) return "—";
  return segundosATexto((finMs - inicioMs) / 1000);
};

const Aviso = ({ tono = "", titulo, texto, accion, onAccion, children }) => (
  <div className={`aviso-base ${tono}`.trim()}>
    <div>
      <b>{titulo}</b>
      {texto && <p>{texto}</p>}
      {children}
    </div>
    {accion && (
      <button type="button" onClick={onAccion}>
        {accion}
      </button>
    )}
  </div>
);

// Tareas de la sesión: cada una con su horario, sus pausas y sus jugadores.
// Todo queda guardado en el celular por sesión; al servidor va cuando se
// revisa el resumen y se confirma con el nombre de la sesión.
export default function TrainingTareas({ actividad = null, onIrASesion }) {
  const activityId = actividad?.id || "";

  const [sesion, setSesion] = useState(() => (activityId ? cargarSesion(activityId, actividad?.name) : null));
  const [plantel, setPlantel] = useState([]);
  const [estadoPlantel, setEstadoPlantel] = useState("cargando");
  const [errorPlantel, setErrorPlantel] = useState("");
  // Lo que el servidor sabe de la sesión: quiénes tienen datos (ids de los
  // chalecos) y el rango de tiempo de esos datos. Es contra eso que valida
  // el envío, así que se frena acá antes.
  const [atletasActividad, setAtletasActividad] = useState(null);
  const [ventana, setVentana] = useState(null);
  const [estadoAtletas, setEstadoAtletas] = useState("cargando");
  // "red": sin señal o sin respuesta. "codigo": el servidor contestó un error.
  const [errorConsulta, setErrorConsulta] = useState({ tipo: "", mensaje: "" });
  const [reintento, setReintento] = useState(0);
  const [pantalla, setPantalla] = useState("lista");
  const [abierta, setAbierta] = useState("");
  const [borrando, setBorrando] = useState("");
  const [envio, setEnvio] = useState({ estado: "idle" });
  const [confirmacion, setConfirmacion] = useState("");

  useEffect(() => {
    setSesion(activityId ? cargarSesion(activityId, actividad?.name) : null);
    setPantalla("lista");
    setAbierta("");
    setBorrando("");
    setEnvio({ estado: "idle" });
    setConfirmacion("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  useEffect(() => {
    if (sesion?.activityId) guardarSesion(sesion);
  }, [sesion]);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const { plantel: lista, error } = await cargarPlantelConCatapult(leerEquipoElegido()?.id || null);
        if (!activo) return;
        setPlantel(Array.isArray(lista) ? lista : []);
        setEstadoPlantel(error ? "error" : "listo");
        setErrorPlantel(error || "");
      } catch (errorCarga) {
        if (!activo) return;
        setPlantel([]);
        setEstadoPlantel("error");
        setErrorPlantel(errorCarga?.message || "No se pudo leer la lista de jugadores.");
      }
    };

    cargar();
    return () => {
      activo = false;
    };
  }, []);

  // Lo que el servidor sabe de la sesión, leído con el usuario guardado.
  useEffect(() => {
    if (!activityId) return undefined;
    let activo = true;
    setAtletasActividad(null);
    setVentana(null);
    setEstadoAtletas("cargando");
    setErrorConsulta({ tipo: "", mensaje: "" });

    const cargar = async () => {
      try {
        const { respuesta, payload } = await pedirJson("/api/openfield/cortes", {
          method: "POST",
          body: { activityId, soloPlan: true, tareas: [] },
        });
        if (!activo) return;
        if (!respuesta.ok || payload?.result !== "consulta") {
          setEstadoAtletas("error");
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            setErrorConsulta({ tipo: "red", mensaje: "" });
          } else if (payload?.code || payload?.error) {
            setErrorConsulta({
              tipo: "codigo",
              mensaje: mensajeDeError(payload, "No se pudo leer la sesión. Probá de nuevo en un momento."),
            });
          } else {
            setErrorConsulta({ tipo: "red", mensaje: "" });
          }
          return;
        }
        setAtletasActividad(new Set((Array.isArray(payload.atletas) ? payload.atletas : []).map(String)));
        const inicioMs = Number(payload.activity?.start_time_ms);
        const finMs = Number(payload.activity?.end_time_ms);
        setVentana(Number.isFinite(inicioMs) && Number.isFinite(finMs) && finMs > inicioMs ? { inicioMs, finMs } : null);
        setEstadoAtletas("listo");
      } catch {
        if (!activo) return;
        // fetch tira TypeError cuando no hay red: no hay nada que traducir.
        setEstadoAtletas("error");
        setErrorConsulta({ tipo: "red", mensaje: "" });
      }
    };

    cargar();
    return () => {
      activo = false;
    };
  }, [activityId, reintento]);

  const tareas = sesion?.tareas || [];
  const rosterConocido = atletasActividad instanceof Set && atletasActividad.size > 0;
  const tieneDatos = (jugador) => !rosterConocido || atletasActividad.has(String(jugador.catapult_id));
  // Elegibles: con chaleco y, si se pudo leer, con datos en la sesión.
  const elegibles = useMemo(
    () => plantel.filter((jugador) => jugador.catapult_id && tieneDatos(jugador)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plantel, atletasActividad],
  );
  const nombrePorCatapultId = useMemo(
    () => new Map(plantel.filter((jugador) => jugador.catapult_id).map((jugador) => [String(jugador.catapult_id), jugador.nombre])),
    [plantel],
  );

  const problemas = useMemo(
    () => new Map(tareas.map((tarea) => [tarea.id, problemasDeTarea(tarea, plantel, { atletasActividad, ventana })])),
    [tareas, plantel, atletasActividad, ventana],
  );
  const conProblemas = tareas.filter((tarea) => problemas.get(tarea.id).length > 0);
  const estados = tareas.map(estadoEnvioTarea);
  const cuenta = (estado) => estados.filter((valor) => valor === estado).length;

  const actualizarTarea = (id, cambio) =>
    setSesion((actual) =>
      actual
        ? {
            ...actual,
            tareas: actual.tareas.map((tarea) =>
              tarea.id === id ? { ...tarea, ...(typeof cambio === "function" ? cambio(tarea) : cambio) } : tarea,
            ),
          }
        : actual,
    );

  // La hora actual, solo si cae dentro de los datos de la sesión: si se
  // cargan tareas después, el inicio queda vacío y se completa a mano.
  const inicioAutomatico = () => {
    if (!ventana) return "";
    const ahora = Date.now();
    return ahora >= ventana.inicioMs && ahora <= ventana.finMs ? horaLocal() : "";
  };

  const agregarTarea = () => {
    const id = generarId();
    const inicio = inicioAutomatico();
    setSesion((actual) => {
      const anterior = actual.tareas[actual.tareas.length - 1];
      const elegiblesIds = new Set(elegibles.map((jugador) => String(jugador.id)));
      // La primera tarea arranca con todos los que tienen datos; las
      // siguientes, con los de la tarea anterior (lo habitual es repetir el
      // grupo). En los dos casos entran con toda la tarea.
      const base = anterior ? Object.keys(anterior.participantes || {}) : [...elegiblesIds];
      const participantes = Object.fromEntries(
        base
          .filter((jugadorId) => elegiblesIds.has(jugadorId))
          .map((jugadorId) => [jugadorId, { modo: MODO_TOTAL, inicio: "", fin: "" }]),
      );
      return {
        ...actual,
        tareas: [
          ...actual.tareas,
          {
            ...nuevaTarea({ id, nombre: `Tarea ${actual.tareas.length + 1}`, fecha: fechaDeActividad(actividad) }),
            inicio,
            participantes,
          },
        ],
      };
    });
    setAbierta(id);
    setBorrando("");
  };

  const borrarTarea = (id) => {
    setSesion((actual) => ({ ...actual, tareas: actual.tareas.filter((tarea) => tarea.id !== id) }));
    setBorrando("");
    if (abierta === id) setAbierta("");
  };

  const empezarPausa = (id) =>
    actualizarTarea(id, (tarea) => ({ pausas: [...tarea.pausas, { inicio: horaLocal(), fin: "" }] }));

  const terminarPausa = (id) =>
    actualizarTarea(id, (tarea) => {
      const indice = tarea.pausas.findIndex((pausa) => pausa.inicio && !pausa.fin);
      if (indice < 0) return {};
      return { pausas: tarea.pausas.map((pausa, i) => (i === indice ? { ...pausa, fin: horaLocal() } : pausa)) };
    });

  const cambiarPausa = (id, indice, cambios) =>
    actualizarTarea(id, (tarea) => ({
      pausas: tarea.pausas.map((pausa, i) => (i === indice ? { ...pausa, ...cambios } : pausa)),
    }));

  const quitarPausa = (id, indice) =>
    actualizarTarea(id, (tarea) => ({ pausas: tarea.pausas.filter((_, i) => i !== indice) }));

  const alternarJugador = (id, jugadorId) =>
    actualizarTarea(id, (tarea) => {
      const participantes = { ...tarea.participantes };
      if (participantes[jugadorId]) delete participantes[jugadorId];
      else participantes[jugadorId] = { modo: MODO_TOTAL, inicio: "", fin: "" };
      return { participantes };
    });

  // "Todos" deja exactamente a los elegibles: saca a los que no tienen datos
  // en la sesión y conserva el tiempo parcial de los que ya estaban.
  const marcarTodos = (id) =>
    actualizarTarea(id, (tarea) => ({
      participantes: Object.fromEntries(
        elegibles.map((jugador) => [
          String(jugador.id),
          tarea.participantes[String(jugador.id)] || { modo: MODO_TOTAL, inicio: "", fin: "" },
        ]),
      ),
    }));

  const marcarNinguno = (id) => actualizarTarea(id, { participantes: {} });

  // Copia los jugadores de otra tarea (los elegibles), con toda la tarea.
  const copiarJugadoresDe = (id, origen) =>
    actualizarTarea(id, (tarea) => ({
      participantes: Object.fromEntries(
        elegibles
          .filter((jugador) => origen.participantes[String(jugador.id)])
          .map((jugador) => [
            String(jugador.id),
            tarea.participantes[String(jugador.id)] || { modo: MODO_TOTAL, inicio: "", fin: "" },
          ]),
      ),
    }));

  // Un grupo (por ejemplo los defensores): si ya están todos, los saca; si
  // falta alguno, los agrega.
  const alternarGrupo = (id, ids) =>
    actualizarTarea(id, (tarea) => {
      const participantes = { ...tarea.participantes };
      const faltan = ids.filter((jugadorId) => !participantes[jugadorId]);
      if (faltan.length === 0) {
        ids.forEach((jugadorId) => delete participantes[jugadorId]);
      } else {
        faltan.forEach((jugadorId) => {
          participantes[jugadorId] = { modo: MODO_TOTAL, inicio: "", fin: "" };
        });
      }
      return { participantes };
    });

  const GRUPOS = [
    ["Defensa", "Defensores"],
    ["Mediocampo", "Medios"],
    ["Ataque", "Delanteros"],
  ];
  const gruposDeRol = GRUPOS.map(([rol, etiqueta]) => ({
    rol,
    etiqueta,
    ids: elegibles.filter((jugador) => (jugador.roles || []).includes(rol)).map((jugador) => String(jugador.id)),
  })).filter((grupo) => grupo.ids.length > 0);

  const cambiarParticipante = (id, jugadorId, cambios) =>
    actualizarTarea(id, (tarea) => ({
      participantes: { ...tarea.participantes, [jugadorId]: { ...tarea.participantes[jugadorId], ...cambios } },
    }));

  const cambiarModo = (tarea, jugadorId, modo) => {
    const datos = tarea.participantes[jugadorId] || {};
    cambiarParticipante(
      tarea.id,
      jugadorId,
      modo === MODO_PARCIAL
        ? { modo, inicio: datos.inicio || tarea.inicio, fin: datos.fin || tarea.fin }
        : { modo, inicio: "", fin: "" },
    );
  };

  const pedirPlan = async () => {
    const { tareas: payloadTareas } = armarEnvio({ tareas, plantel, atletasActividad, ventana });
    setEnvio({ estado: "planificando" });

    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/cortes", {
        method: "POST",
        body: { activityId, tareas: payloadTareas, asignaciones: sesion.asignaciones, soloPlan: true },
      });

      if (!respuesta.ok || !payload?.ok || payload.result !== "plan") {
        setEnvio({
          estado: "error",
          error: mensajeDeError(payload, "No se pudo armar el resumen."),
          errores: Array.isArray(payload?.errores) ? payload.errores : [],
          escribio: false,
          detalle: detalleTecnico(payload, respuesta.status),
        });
        return;
      }

      setEnvio({ estado: "plan", plan: payload, huella: huellaEnvio(tareas) });
      setConfirmacion("");
      setPantalla("enviar");
    } catch (error) {
      setEnvio({ estado: "error", error: error?.message || "No se pudo armar el resumen.", escribio: false });
    }
  };

  const enviar = async () => {
    const { tareas: payloadTareas } = armarEnvio({ tareas, plantel, atletasActividad, ventana });
    setEnvio((actual) => ({ ...actual, estado: "enviando", error: "" }));

    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/cortes", {
        method: "POST",
        body: {
          activityId,
          confirmacion: confirmacion.trim(),
          tareas: payloadTareas,
          asignaciones: sesion.asignaciones,
        },
      });

      if (payload?.result === "cortes-enviados") {
        const fecha = new Date().toISOString();
        const porTarea = new Map((payload.tareas || []).map((tarea) => [String(tarea.tareaId), tarea]));

        setSesion((actual) => ({
          ...actual,
          asignaciones:
            payload.asignaciones && typeof payload.asignaciones === "object" && !Array.isArray(payload.asignaciones)
              ? payload.asignaciones
              : actual.asignaciones,
          tareas: actual.tareas.map((tarea) => {
            const resultado = porTarea.get(String(tarea.id));
            if (!resultado) return tarea;
            return {
              ...tarea,
              envio: { ok: Boolean(resultado.ok), fecha, huella: huellaTarea(tarea), fallidos: resultado.fallidos || [] },
            };
          }),
          ultimoEnvio: {
            fecha,
            ok: Boolean(payload.ok),
            codigo: payload.veredicto?.codigo || "",
            detalle: payload.veredicto?.detalle || "",
          },
        }));
        setEnvio({ estado: "enviado", resultado: payload, fecha });
        setConfirmacion("");
        return;
      }

      if (respuesta.status === 400 && payload?.code === "CONFIRMACION_INVALIDA") {
        setEnvio((actual) => ({ ...actual, estado: "plan", error: mensajeDeError(payload, "") }));
        return;
      }

      setEnvio({
        estado: "error",
        error: mensajeDeError(payload, "No se pudo enviar."),
        errores: Array.isArray(payload?.errores) ? payload.errores : [],
        escribio: payload?.escribio === true,
        detalle: detalleTecnico(payload, respuesta.status),
      });
    } catch (error) {
      setEnvio({ estado: "error", error: error?.message || "No hubo respuesta.", escribio: null });
    }
  };

  const volverALista = () => {
    setPantalla("lista");
    // El resultado ya quedó como "Último envío"; el error se sigue mostrando
    // en la tarjeta de envío hasta el próximo intento.
    setEnvio((actual) => (actual.estado === "error" ? actual : { estado: "idle" }));
    setConfirmacion("");
  };

  if (!actividad) {
    return (
      <div className="app">
        <div className="contenedor">
          <header className="encabezado">
            <h1>Tareas</h1>
            <p>Primero elegí la sesión</p>
          </header>
          <section className="tarjeta tarjeta-ficha">
            <p className="vacio-ficha">Las tareas se registran sobre una sesión. Elegila en Sesión y volvé.</p>
            <button type="button" className="boton-principal" onClick={onIrASesion}>
              Ir a Sesión
            </button>
          </section>
        </div>
      </div>
    );
  }

  if (!sesion) return null;

  const nombreSesion = actividad.name || "Sin nombre";
  const planVigente = envio.plan && envio.huella === huellaEnvio(tareas);
  const puedeRevisar =
    tareas.length > 0 && conProblemas.length === 0 && envio.estado !== "planificando" && envio.estado !== "enviando";
  const enviando = envio.estado === "enviando";

  const renderErrorEnvio = () => (
    <Aviso
      titulo="No se pudo enviar"
      texto={`${envio.error || ""}${
        envio.escribio === true
          ? " Puede que algo haya quedado guardado: revisá la sesión antes de volver a enviar."
          : envio.escribio === null
            ? " No hubo respuesta: revisá la sesión antes de volver a enviar."
            : ""
      }`}
    >
      {envio.errores?.length > 0 && (
        <ul className="lista-resultado">
          {envio.errores.map((item, i) => (
            <li key={`${item.tareaId || "general"}-${i}`} className="fallo">
              {item.nombre ? `${item.nombre}: ` : ""}
              {item.error}
              {Array.isArray(item.atletasFuera) && item.atletasFuera.length > 0
                ? ` Sin datos: ${item.atletasFuera.map((id) => nombrePorCatapultId.get(String(id)) || id).join(", ")}.`
                : ""}
              {item.ventana ? ` Datos de ${horaCortaDeMs(item.ventana.inicioMs)} a ${horaCortaDeMs(item.ventana.finMs)}.` : ""}
            </li>
          ))}
        </ul>
      )}
      <DetalleTecnico texto={envio.detalle} />
    </Aviso>
  );

  const renderTarea = (tarea, indice) => {
    const tareaAnterior = indice > 0 ? tareas[indice - 1] : null;
    const abiertaEsta = abierta === tarea.id;
    const resumen = resumenTarea(tarea);
    const faltantes = problemas.get(tarea.id) || [];
    const estado = faltantes.length > 0 ? ESTADOS.incompleta : ESTADOS[estadoEnvioTarea(tarea)];
    const seleccionados = Object.keys(tarea.participantes).length;
    const pausaEnCurso = tarea.pausas.some((pausa) => pausa.inicio && !pausa.fin);
    const horario = tarea.inicio && tarea.fin ? `${horaCorta(tarea.inicio)} → ${horaCorta(tarea.fin)}` : "Sin horario";
    const idNombre = `tarea-nombre-${tarea.id}`;
    const idFecha = `tarea-fecha-${tarea.id}`;
    const elegidos = plantel.filter((jugador) => tarea.participantes[String(jugador.id)]);

    return (
      <div key={tarea.id} className={`registro-guardado ${abiertaEsta ? "abierta" : ""}`.trim()}>
        <button
          type="button"
          className="tarea-cabecera"
          onClick={() => setAbierta(abiertaEsta ? "" : tarea.id)}
          aria-expanded={abiertaEsta}
        >
          <span className="cabecera-registro">
            <span className="fecha-registro">
              Tarea {indice + 1} · {horario}
            </span>
            <span className={`tarea-estado ${estado.clase}`}>{estado.etiqueta}</span>
          </span>
          <span className="tarea-nombre">{tarea.nombre || "Sin nombre"}</span>
          <span className="tiempos-registro">
            <span>
              Jugadores <strong>{seleccionados}</strong>
            </span>
            <span>
              Pausas <strong>{tarea.pausas.length}</strong>
            </span>
            <span>
              Efectivo <strong>{segundosATexto(resumen.duracionEfectivaSegundos)}</strong>
            </span>
          </span>
        </button>

        {abiertaEsta && (
          <>
            <div className="campo-inicio">
              <label htmlFor={idNombre}>Nombre</label>
              <input
                id={idNombre}
                type="text"
                value={tarea.nombre}
                onChange={(e) => actualizarTarea(tarea.id, { nombre: e.target.value })}
                placeholder="Ej. Posesión 6v6+3"
              />
            </div>

            <div className="campos-hora">
              {[
                ["inicio", "Inicio", "Inicio de la tarea"],
                ["fin", "Fin", "Fin de la tarea"],
              ].map(([campo, rotulo, etiqueta]) => (
                <div className="campo-inicio" key={campo}>
                  <label>{rotulo}</label>
                  <div className="fila-hora-cambio">
                    <input
                      aria-label={etiqueta}
                      type="time"
                      step="1"
                      value={tarea[campo]}
                      onChange={(e) => actualizarTarea(tarea.id, { [campo]: e.target.value })}
                    />
                    <button
                      type="button"
                      className="boton-ahora-cambio"
                      onClick={() => actualizarTarea(tarea.id, { [campo]: horaLocal() })}
                    >
                      Ahora
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!tarea.inicio && (
              <button
                type="button"
                className="accion-periodo"
                onClick={() => actualizarTarea(tarea.id, { inicio: horaLocal() })}
              >
                <span className="simbolo-accion-periodo" aria-hidden="true" />
                Empezar tarea
              </button>
            )}
            {tarea.inicio && !tarea.fin && (
              <button
                type="button"
                className="accion-periodo finalizar"
                onClick={() => actualizarTarea(tarea.id, { fin: horaLocal() })}
              >
                <span className="simbolo-accion-periodo" aria-hidden="true" />
                Terminar tarea
              </button>
            )}

            <div className="cabeza-ficha">
              <b>Pausas</b>
              <span>
                {tarea.pausas.length === 0
                  ? "Sin pausas"
                  : `${plural(tarea.pausas.length, "pausa", "pausas")} · total ${segundosATexto(resumen.pausasSegundos)}`}
              </span>
            </div>

            {tarea.pausas.map((pausa, i) => (
              <div className="fila-pausa" key={`pausa-${i}`}>
                <span className="numero-lista">{i + 1}</span>
                <input
                  aria-label={`Inicio pausa ${i + 1}`}
                  type="time"
                  step="1"
                  value={pausa.inicio}
                  onChange={(e) => cambiarPausa(tarea.id, i, { inicio: e.target.value })}
                />
                <span aria-hidden="true">→</span>
                <input
                  aria-label={`Fin pausa ${i + 1}`}
                  type="time"
                  step="1"
                  value={pausa.fin}
                  onChange={(e) => cambiarPausa(tarea.id, i, { fin: e.target.value })}
                />
                <button
                  type="button"
                  className="quitar-jugador"
                  aria-label={`Quitar pausa ${i + 1}`}
                  onClick={() => quitarPausa(tarea.id, i)}
                >
                  ×
                </button>
                <small>
                  {pausa.inicio && !pausa.fin ? "en curso" : duracionDePausa(tarea, pausa)}
                </small>
              </div>
            ))}

            {pausaEnCurso ? (
              <button type="button" className="accion-periodo finalizar" onClick={() => terminarPausa(tarea.id)}>
                <Icono nombre="pausa" size={18} />
                Terminar pausa
              </button>
            ) : (
              <button type="button" className="accion-periodo reanudar" onClick={() => empezarPausa(tarea.id)}>
                <Icono nombre="pausa" size={18} />
                Empezar pausa
              </button>
            )}

            <div className="cabeza-ficha">
              <b>Jugadores</b>
              <span>
                {seleccionados} de {elegibles.length} en la tarea
              </span>
            </div>

            <div className="atajos-jugadores">
              <button type="button" className="boton-texto" onClick={() => marcarTodos(tarea.id)}>
                Todos
              </button>
              <button type="button" className="boton-texto" onClick={() => marcarNinguno(tarea.id)}>
                Ninguno
              </button>
              {tareaAnterior && (
                <button type="button" className="boton-texto" onClick={() => copiarJugadoresDe(tarea.id, tareaAnterior)}>
                  Como la anterior
                </button>
              )}
              {gruposDeRol.map((grupo) => (
                <button
                  key={grupo.rol}
                  type="button"
                  className="boton-texto"
                  onClick={() => alternarGrupo(tarea.id, grupo.ids)}
                >
                  {grupo.etiqueta}
                </button>
              ))}
            </div>

            {estadoPlantel === "cargando" && <p className="vacio-ficha">Leyendo la lista de jugadores…</p>}
            {estadoPlantel === "error" && <p className="error-equipo">{errorPlantel}</p>}
            {estadoPlantel === "listo" && plantel.length === 0 && (
              <p className="vacio-ficha">La lista de jugadores está vacía. Cargala en Ajustes › Lista de jugadores.</p>
            )}

            <div className="lista-jugadores-tarea">
              {plantel.map((jugador) => {
                const clave = String(jugador.id);
                const datos = tarea.participantes[clave];
                const conChaleco = Boolean(jugador.catapult_id);
                const sinDatos = conChaleco && !tieneDatos(jugador);
                // Sin datos en la sesión no se puede agregar, pero sí sacar.
                const apagado = !conChaleco || (sinDatos && !datos);
                const puestos = Array.isArray(jugador.puestos) ? jugador.puestos.join(" ") : "";

                return (
                  <label
                    key={clave}
                    className={`fila-jugador ${datos ? "activo" : ""} ${apagado ? "apagado" : ""}`.replace(/\s+/g, " ").trim()}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(datos)}
                      disabled={apagado}
                      onChange={() => alternarJugador(tarea.id, clave)}
                    />
                    <span className="nombre-fila-jugador">{jugador.nombre}</span>
                    {!conChaleco ? (
                      <small>sin chaleco</small>
                    ) : sinDatos ? (
                      <small>sin datos</small>
                    ) : puestos ? (
                      <small>{puestos}</small>
                    ) : null}
                  </label>
                );
              })}
            </div>

            {elegidos.length > 0 && (
              <details className="ajustes-periodo">
                <summary>Alguno jugó menos tiempo</summary>
                <div className="contenido-ajustes-periodo">
                  {elegidos.map((jugador) => {
                    const clave = String(jugador.id);
                    const datos = tarea.participantes[clave];
                    return (
                      <div className="fila-tiempo" key={clave}>
                        <b>{jugador.nombre}</b>
                        <select
                          className="selector-tiempo"
                          aria-label={`Tiempo de ${jugador.nombre}`}
                          value={datos.modo}
                          onChange={(e) => cambiarModo(tarea, clave, e.target.value)}
                        >
                          <option value={MODO_TOTAL}>Toda la tarea</option>
                          <option value={MODO_PARCIAL}>Menos tiempo</option>
                        </select>

                        {datos.modo === MODO_PARCIAL && (
                          <div className="fila-parcial">
                            <input
                              aria-label={`Desde, ${jugador.nombre}`}
                              type="time"
                              step="1"
                              value={datos.inicio}
                              onChange={(e) => cambiarParticipante(tarea.id, clave, { inicio: e.target.value })}
                            />
                            <button
                              type="button"
                              className="boton-ahora-cambio"
                              onClick={() => cambiarParticipante(tarea.id, clave, { inicio: horaLocal() })}
                            >
                              Ahora
                            </button>
                            <input
                              aria-label={`Hasta, ${jugador.nombre}`}
                              type="time"
                              step="1"
                              value={datos.fin}
                              onChange={(e) => cambiarParticipante(tarea.id, clave, { fin: e.target.value })}
                            />
                            <button
                              type="button"
                              className="boton-ahora-cambio"
                              onClick={() => cambiarParticipante(tarea.id, clave, { fin: horaLocal() })}
                            >
                              Ahora
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            <details className="ajustes-periodo">
              <summary>Cambiar la fecha</summary>
              <div className="contenido-ajustes-periodo">
                <div className="campo-inicio">
                  <label htmlFor={idFecha}>Fecha de la tarea</label>
                  <input
                    id={idFecha}
                    type="date"
                    value={tarea.fecha}
                    onChange={(e) => actualizarTarea(tarea.id, { fecha: e.target.value })}
                  />
                </div>
              </div>
            </details>

            <div className="resumen-tarea">
              <span>
                Duración
                <strong>{segundosATexto(resumen.duracionBrutaSegundos)}</strong>
              </span>
              <span>
                Pausas
                <strong>{segundosATexto(resumen.pausasSegundos)}</strong>
              </span>
              <span>
                Efectivo
                <strong>{segundosATexto(resumen.duracionEfectivaSegundos)}</strong>
              </span>
            </div>

            {faltantes.length > 0 ? (
              <div className="aviso-formacion">
                {faltantes.map((problema) => (
                  <div key={problema}>{problema}</div>
                ))}
              </div>
            ) : (
              <span className="modo-captura">✓ Lista para enviar</span>
            )}

            <div className="acciones-registro">
              <button type="button" className="boton-detalle" onClick={() => setAbierta("")}>
                Cerrar
              </button>
              <button
                type="button"
                className="boton-eliminar-registro"
                onClick={() => setBorrando(tarea.id)}
                aria-label="Borrar tarea"
              >
                <Icono nombre="borrar" size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderLista = () => {
    const subtitulo =
      estadoAtletas === "cargando"
        ? `${nombreSesion} · leyendo la sesión…`
        : ventana
          ? `${nombreSesion} · datos de ${horaCortaDeMs(ventana.inicioMs)} a ${horaCortaDeMs(ventana.finMs)} · ${plural(tareas.length, "tarea", "tareas")}`
          : `${nombreSesion} · ${plural(tareas.length, "tarea", "tareas")}`;
    const pendientes = cuenta("pendiente") + cuenta("modificada");

    return (
      <div className="contenedor">
        <header className="encabezado">
          <h1>Tareas</h1>
          <p>{subtitulo}</p>
        </header>

        {estadoAtletas === "error" && errorConsulta.tipo === "red" && (
          <Aviso
            tono="espera"
            titulo="Sin conexión"
            texto="Podés seguir registrando. Enviá cuando vuelva la señal."
            accion="Reintentar"
            onAccion={() => setReintento((n) => n + 1)}
          />
        )}
        {estadoAtletas === "error" && errorConsulta.tipo === "codigo" && (
          <Aviso
            titulo="No se pudo leer la sesión"
            texto={errorConsulta.mensaje}
            accion="Reintentar"
            onAccion={() => setReintento((n) => n + 1)}
          />
        )}

        {tareas.length === 0 && (
          <p className="vacio-ficha">Todavía no hay tareas. Tocá "Nueva tarea" cuando arranque la primera.</p>
        )}
        {tareas.map(renderTarea)}

        <button type="button" className="agregar-cambio-operativo" onClick={agregarTarea}>
          <Icono nombre="plus" size={16} />
          + Nueva tarea
        </button>

        <section className="tarjeta tarjeta-ficha">
          <div className="cabeza-ficha">
            <b>Enviar</b>
            <span className="cuenta-ajuste">{pendientes}</span>
          </div>

          {tareas.length > 0 && (
            <div className="chips-envio">
              <span className="modo-captura">{plural(cuenta("enviada"), "enviada", "enviadas")}</span>
              <span className="modo-captura">{cuenta("modificada")} con cambios</span>
              <span className="modo-captura">{cuenta("pendiente")} sin enviar</span>
            </div>
          )}

          {conProblemas.length > 0 && (
            <p className="error-equipo">
              Antes de enviar, completá {conProblemas.length === 1 ? "la tarea marcada" : "las tareas marcadas"}:{" "}
              {conProblemas.map((tarea) => tarea.nombre || "sin nombre").join(", ")}. Abrila para ver qué falta.
            </p>
          )}

          {envio.estado === "error" && renderErrorEnvio()}

          <button type="button" className="boton-principal" onClick={pedirPlan} disabled={!puedeRevisar}>
            {envio.estado === "planificando" ? "Armando el resumen…" : "Revisar y enviar"}
          </button>

          {envio.estado === "idle" && sesion.ultimoEnvio && (
            <p className="pista-equipo">
              Último envío: {formatearFechaHora(sesion.ultimoEnvio.fecha)} ·{" "}
              {sesion.ultimoEnvio.ok ? "todo bien" : "con problemas"}
            </p>
          )}
        </section>
      </div>
    );
  };

  const renderEnviar = () => {
    const plan = envio.plan;
    const resultado = envio.estado === "enviado" ? envio.resultado : null;
    const confirmacionRequerida = plan?.confirmacionRequerida || "";
    const mostrarPlan = plan && !resultado && envio.estado !== "error";

    return (
      <div className="contenedor">
        <header className="encabezado">
          <h1>Enviar</h1>
          <p>Tareas · Enviar</p>
        </header>

        {mostrarPlan && (
          <>
            <section className="tarjeta tarjeta-ficha">
              <div className="cabeza-ficha">
                <b>Qué va a pasar</b>
              </div>
              <DatoDetalle label="Tareas nuevas" valor={String(plan.resumen?.nuevos ?? 0)} />
              <DatoDetalle label="Tareas actualizadas" valor={String(plan.resumen?.reemplazados ?? 0)} />
              <DatoDetalle label="Tareas que se sacan" valor={String(plan.resumen?.eliminados ?? 0)} />
              <DatoDetalle label="Lo que ya estaba y queda igual" valor={String(plan.resumen?.preservados ?? 0)} />
              {(plan.tareas || []).length > 0 && (
                <ul className="lista-plantel">
                  {(plan.tareas || []).map((tarea, i) => (
                    <li key={tarea.tareaId || i}>
                      <span className="numero-lista">{i + 1}</span>
                      <span className="nombre-lista">{tarea.nombre}</span>
                      <small>
                        {plural((tarea.periodos || []).length, "bloque", "bloques")} ·{" "}
                        {plural(
                          (tarea.periodos || []).reduce((total, periodo) => total + (periodo.participantes || 0), 0),
                          "jugador",
                          "jugadores",
                        )}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {planVigente ? (
              <section className="tarjeta tarjeta-ficha">
                <div className="cabeza-ficha">
                  <b>Confirmación</b>
                </div>
                <label className="etiqueta-equipo" htmlFor="confirmacion-envio">
                  Para enviar, escribí el nombre de la sesión tal cual: {confirmacionRequerida}
                </label>
                <input
                  id="confirmacion-envio"
                  type="text"
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  placeholder={confirmacionRequerida}
                  autoComplete="off"
                  disabled={enviando}
                />
                {envio.error && <p className="error-equipo">{envio.error}</p>}
              </section>
            ) : (
              <Aviso
                tono="espera"
                titulo="Las tareas cambiaron"
                texto="Volvé a revisar antes de enviar."
                accion="Revisar"
                onAccion={pedirPlan}
              />
            )}
          </>
        )}

        {envio.estado === "error" && renderErrorEnvio()}

        {resultado && (
          <Aviso
            tono={resultado.ok ? "listo" : ""}
            titulo={ETIQUETAS_VEREDICTO[resultado.veredicto?.codigo] || resultado.veredicto?.detalle || "Envío terminado."}
            texto={formatearFechaHora(envio.fecha)}
          >
            <ul className="lista-resultado">
              {(resultado.tareas || []).map((tarea) => (
                <li key={tarea.tareaId} className={tarea.ok ? "ok" : "fallo"}>
                  {tarea.ok ? "✓" : "✗"} {tarea.nombre}
                  {!tarea.ok && tarea.fallidos?.length > 0
                    ? ` — ${[...new Set(tarea.fallidos.map((fallo) => MOTIVOS_FALLO[fallo.motivo] || fallo.motivo))].join(", ")}`
                    : ""}
                </li>
              ))}
            </ul>
            {!resultado.ok && <DetalleTecnico texto={detalleTecnico(resultado)} />}
          </Aviso>
        )}

        <div className="acciones-dobles">
          <BotonVolver onClick={volverALista}>Volver a Tareas</BotonVolver>
          {mostrarPlan && planVigente && (
            <button
              type="button"
              className="boton-principal"
              onClick={enviar}
              disabled={enviando || confirmacion.trim() !== confirmacionRequerida}
            >
              {enviando ? "Enviando…" : "Enviar"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      {pantalla === "enviar" ? renderEnviar() : renderLista()}

      <HojaConfirmar
        abierta={Boolean(borrando)}
        titulo="¿Borrar esta tarea?"
        descripcion="Si ya la habías enviado, en el próximo envío también se saca de la sesión."
        etiquetaConfirmar="Sí, borrar"
        etiquetaCancelar="No"
        onConfirmar={() => borrarTarea(borrando)}
        onCancelar={() => setBorrando("")}
      />
    </div>
  );
}
