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
import { mensajeDeRespuesta, pedirJson } from "./trainingApi.js";
import "./training-tareas.css";

const generarId = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const ETIQUETAS_ESTADO = {
  pendiente: "Sin enviar",
  enviada: "Enviada",
  modificada: "Con cambios",
};

// Lo que el servidor contesta con un código se traduce a algo que se entienda
// sin conocer la cocina.
const MENSAJES_CODIGO = {
  SIN_CUENTA: "Todavía no conectaste tu cuenta de Catapult. Hacelo en Ajustes.",
  SESION_APP: "Se venció la sesión de la app. Volvé a entrar a Entrenamiento.",
  SIN_CLAVE: "Falta configurar el servidor (CATAPULT_SESSION_KEY).",
  CONFIRMACION_INVALIDA: "El nombre no coincide. Escribilo tal cual aparece en OpenField.",
  SNAPSHOT_INCOMPLETO: "OpenField no dejó leer todos los períodos actuales. Probá de nuevo en un momento.",
  INTERNO_NO_LEGIBLE: "OpenField no devolvió la sesión. Probá de nuevo en un momento.",
  PLAN_INVALIDO: "Hay tareas que OpenField no puede recibir así.",
};

const ETIQUETAS_VEREDICTO = {
  "cortes-validados": "Todo quedó en OpenField tal cual se pidió.",
  "cortes-con-diferencias": "Algunas tareas no quedaron exactamente como se pidió. Revisalas y volvé a enviar.",
  "ajenos-tocados": "Cambió algo de la sesión que la app no maneja. Revisá la sesión en OpenField.",
  "obsoletos-no-retirados": "Las tareas quedaron bien, pero un corte viejo de la app no se retiró.",
  "sin-relectura": "Se envió, pero no se pudo volver a leer OpenField para confirmarlo.",
  "escritura-rechazada": "OpenField rechazó el envío. Nada cambió.",
};

const MOTIVOS_FALLO = {
  "no-encontrado": "no apareció en OpenField",
  diferencias: "quedó con diferencias",
};

const mensajeDeError = (payload, porDefecto) =>
  MENSAJES_CODIGO[payload?.code] || mensajeDeRespuesta(payload, porDefecto);

const huellaEnvio = (tareas) => JSON.stringify(tareas.map(huellaTarea));

// Lo que hace falta para entender un rechazo de OpenField sin abrir Vercel:
// el código HTTP de la respuesta, el status y el cuerpo del PUT, la etapa y
// el detalle del error. Se muestra plegado, solo cuando algo falló.
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
    <details className="tareas-detalle-tecnico">
      <summary>Ver detalle técnico (para pegar en el chat)</summary>
      <pre>{texto}</pre>
    </details>
  ) : null;

const formatearFechaHora = (iso) => {
  const fecha = new Date(iso);
  if (!iso || Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
};

const plural = (cantidad, singular, pluralTexto) => `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;

// Tareas de la sesión: cada una con su horario, sus pausas y sus jugadores.
// Todo queda guardado en el celular por sesión; a OpenField va cuando se
// pide la vista previa y se confirma con el nombre de la sesión.
export default function TrainingTareas({ actividad = null, onIrASesion }) {
  const activityId = actividad?.id || "";

  const [sesion, setSesion] = useState(() => (activityId ? cargarSesion(activityId, actividad?.name) : null));
  const [plantel, setPlantel] = useState([]);
  const [estadoPlantel, setEstadoPlantel] = useState("cargando");
  const [errorPlantel, setErrorPlantel] = useState("");
  // Atletas con datos en esta sesión según OpenField (ids de Catapult).
  const [atletasActividad, setAtletasActividad] = useState(null);
  const [estadoAtletas, setEstadoAtletas] = useState("cargando");
  const [abierta, setAbierta] = useState("");
  const [borrando, setBorrando] = useState("");
  const [envio, setEnvio] = useState({ estado: "idle" });
  const [confirmacion, setConfirmacion] = useState("");

  useEffect(() => {
    setSesion(activityId ? cargarSesion(activityId, actividad?.name) : null);
    setAbierta("");
    setBorrando("");
    setEnvio({ estado: "idle" });
    setConfirmacion("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  useEffect(() => {
    if (sesion?.activityId) guardarSesion(sesion);
  }, [sesion]);

  // Quiénes tienen datos en esta sesión: sin eso, "Todos" manda jugadores
  // que OpenField no acepta en la actividad y rechaza el envío entero.
  useEffect(() => {
    if (!activityId) return undefined;
    let activo = true;
    setAtletasActividad(null);
    setEstadoAtletas("cargando");

    const cargar = async () => {
      try {
        const { respuesta, payload } = await pedirJson(
          `/api/openfield/snapshot?activityId=${encodeURIComponent(activityId)}`,
        );
        if (!activo) return;
        if (!respuesta.ok || !payload?.ok || !Array.isArray(payload.athletes)) {
          setEstadoAtletas("error");
          return;
        }
        setAtletasActividad(new Set(payload.athletes.map((atleta) => String(atleta?.id || "")).filter(Boolean)));
        setEstadoAtletas("listo");
      } catch {
        if (activo) setEstadoAtletas("error");
      }
    };

    cargar();
    return () => {
      activo = false;
    };
  }, [activityId]);

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

  const tareas = sesion?.tareas || [];
  const rosterConocido = atletasActividad instanceof Set && atletasActividad.size > 0;
  const tieneDatos = (jugador) => !rosterConocido || atletasActividad.has(String(jugador.catapult_id));
  // Elegibles: vinculados con Catapult y, si se pudo leer, con datos en la sesión.
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
    () => new Map(tareas.map((tarea) => [tarea.id, problemasDeTarea(tarea, plantel, { atletasActividad })])),
    [tareas, plantel, atletasActividad],
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

  const agregarTarea = () => {
    const id = generarId();
    setSesion((actual) => ({
      ...actual,
      tareas: [
        ...actual.tareas,
        nuevaTarea({ id, nombre: `Tarea ${actual.tareas.length + 1}`, fecha: fechaDeActividad(actividad) }),
      ],
    }));
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
    const { tareas: payloadTareas } = armarEnvio({ tareas, plantel, atletasActividad });
    setEnvio({ estado: "planificando" });

    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/cortes", {
        method: "POST",
        body: { activityId, tareas: payloadTareas, asignaciones: sesion.asignaciones, soloPlan: true },
      });

      if (!respuesta.ok || !payload?.ok || payload.result !== "plan") {
        setEnvio({
          estado: "error",
          error: mensajeDeError(payload, "No se pudo armar la vista previa."),
          errores: Array.isArray(payload?.errores) ? payload.errores : [],
          escribio: false,
        });
        return;
      }

      setEnvio({ estado: "plan", plan: payload, huella: huellaEnvio(tareas) });
      setConfirmacion("");
    } catch (error) {
      setEnvio({ estado: "error", error: error?.message || "No se pudo armar la vista previa.", escribio: false });
    }
  };

  const enviar = async () => {
    const { tareas: payloadTareas } = armarEnvio({ tareas, plantel, atletasActividad });
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
        setEnvio({ estado: "enviado", resultado: payload });
        setConfirmacion("");
        return;
      }

      if (respuesta.status === 400 && payload?.code === "CONFIRMACION_INVALIDA") {
        setEnvio((actual) => ({ ...actual, estado: "plan", error: mensajeDeError(payload, "") }));
        return;
      }

      setEnvio({
        estado: "error",
        error: mensajeDeError(payload, "No se pudo enviar a OpenField."),
        errores: Array.isArray(payload?.errores) ? payload.errores : [],
        escribio: payload?.escribio === true,
        detalle: detalleTecnico(payload, respuesta.status),
      });
    } catch (error) {
      setEnvio({ estado: "error", error: error?.message || "No hubo respuesta de OpenField.", escribio: null });
    }
  };

  if (!actividad) {
    return (
      <main className="entrenamiento-app entrenamiento-tareas">
        <header className="entrenamiento-barra">
          <div>
            <span>Entrenamiento</span>
            <strong>Tareas</strong>
          </div>
        </header>
        <section className="entrenamiento-contenido">
          <section className="entrenamiento-panel">
            <h2>Primero elegí la sesión</h2>
            <p>Las tareas se cargan sobre una sesión de OpenField. Elegila en Sesión y volvé.</p>
            <button type="button" className="entrenamiento-boton-principal tareas-boton-ir" onClick={onIrASesion}>
              Ir a Sesión
            </button>
          </section>
        </section>
      </main>
    );
  }

  if (!sesion) return null;

  const planVigente = envio.plan && envio.huella === huellaEnvio(tareas);
  const puedePrevisualizar =
    tareas.length > 0 && conProblemas.length === 0 && envio.estado !== "planificando" && envio.estado !== "enviando";
  const enviando = envio.estado === "enviando";
  const mostrarPlan = (envio.estado === "plan" || enviando) && envio.plan;

  const renderTarea = (tarea, indice) => {
    const abiertaEsta = abierta === tarea.id;
    const resumen = resumenTarea(tarea);
    const faltantes = problemas.get(tarea.id) || [];
    const estado = estadoEnvioTarea(tarea);
    const seleccionados = Object.keys(tarea.participantes).length;
    const pausaEnCurso = tarea.pausas.some((pausa) => pausa.inicio && !pausa.fin);
    const detalleHorario = tarea.inicio && tarea.fin ? `${tarea.inicio} → ${tarea.fin}` : "Sin horario";

    return (
      <li
        key={tarea.id}
        className={`tarea ${abiertaEsta ? "abierta" : ""} ${faltantes.length > 0 ? "con-problemas" : ""}`}
      >
        <button
          type="button"
          className="tarea-cabecera"
          onClick={() => setAbierta(abiertaEsta ? "" : tarea.id)}
          aria-expanded={abiertaEsta}
        >
          <span className="tarea-numero">{indice + 1}</span>
          <span className="tarea-titulo">
            <strong>{tarea.nombre || "Sin nombre"}</strong>
            <small>
              {detalleHorario} · {plural(seleccionados, "jugador", "jugadores")}
              {tarea.pausas.length > 0 ? ` · ${plural(tarea.pausas.length, "pausa", "pausas")}` : ""}
            </small>
          </span>
          <span className={`tarea-estado ${faltantes.length > 0 ? "incompleta" : estado}`}>
            {faltantes.length > 0 ? "Incompleta" : ETIQUETAS_ESTADO[estado]}
          </span>
        </button>

        {abiertaEsta && (
          <div className="tarea-cuerpo">
            <label>
              Nombre de la tarea
              <input
                type="text"
                value={tarea.nombre}
                onChange={(e) => actualizarTarea(tarea.id, { nombre: e.target.value })}
                placeholder="Ej. Posesión 6v6+3"
              />
            </label>

            <div className="tarea-horario">
              <label>
                Fecha
                <input
                  type="date"
                  value={tarea.fecha}
                  onChange={(e) => actualizarTarea(tarea.id, { fecha: e.target.value })}
                />
              </label>
              <div className="tarea-hora">
                <span>Inicio</span>
                <div>
                  <input
                    aria-label="Inicio de la tarea"
                    type="time"
                    step="1"
                    value={tarea.inicio}
                    onChange={(e) => actualizarTarea(tarea.id, { inicio: e.target.value })}
                  />
                  <button type="button" onClick={() => actualizarTarea(tarea.id, { inicio: horaLocal() })}>
                    Ahora
                  </button>
                </div>
              </div>
              <div className="tarea-hora">
                <span>Fin</span>
                <div>
                  <input
                    aria-label="Fin de la tarea"
                    type="time"
                    step="1"
                    value={tarea.fin}
                    onChange={(e) => actualizarTarea(tarea.id, { fin: e.target.value })}
                  />
                  <button type="button" onClick={() => actualizarTarea(tarea.id, { fin: horaLocal() })}>
                    Ahora
                  </button>
                </div>
              </div>
            </div>

            <div className="tarea-seccion">
              <div className="tarea-seccion-cabecera">
                <div>
                  <strong>Pausas</strong>
                  <span>
                    {tarea.pausas.length === 0
                      ? "Sin pausas"
                      : `${plural(tarea.pausas.length, "pausa", "pausas")} · total ${segundosATexto(resumen.pausasSegundos)}`}
                  </span>
                </div>
                {pausaEnCurso ? (
                  <button
                    type="button"
                    className="entrenamiento-boton-principal tarea-boton-pausa"
                    onClick={() => terminarPausa(tarea.id)}
                  >
                    Terminar pausa
                  </button>
                ) : (
                  <button
                    type="button"
                    className="entrenamiento-boton-secundario"
                    onClick={() => empezarPausa(tarea.id)}
                  >
                    Empezar pausa
                  </button>
                )}
              </div>

              {tarea.pausas.map((pausa, i) => {
                return (
                  <div className="tarea-pausa" key={`pausa-${i}`}>
                    <span>{i + 1}</span>
                    <input
                      aria-label={`Inicio pausa ${i + 1}`}
                      type="time"
                      step="1"
                      value={pausa.inicio}
                      onChange={(e) => cambiarPausa(tarea.id, i, { inicio: e.target.value })}
                    />
                    <span>→</span>
                    <input
                      aria-label={`Fin pausa ${i + 1}`}
                      type="time"
                      step="1"
                      value={pausa.fin}
                      onChange={(e) => cambiarPausa(tarea.id, i, { fin: e.target.value })}
                    />
                    <strong>{pausa.inicio && !pausa.fin ? "en curso" : duracionDePausa(tarea, pausa)}</strong>
                    <button type="button" aria-label={`Quitar pausa ${i + 1}`} onClick={() => quitarPausa(tarea.id, i)}>
                      ×
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="tarea-seccion">
              <div className="tarea-seccion-cabecera">
                <div>
                  <strong>Jugadores</strong>
                  <span>
                    {seleccionados} de {elegibles.length} en la tarea
                  </span>
                </div>
                <div className="tarea-seccion-botones">
                  <button type="button" className="entrenamiento-boton-secundario" onClick={() => marcarTodos(tarea.id)}>
                    Todos
                  </button>
                  <button type="button" className="entrenamiento-boton-secundario" onClick={() => marcarNinguno(tarea.id)}>
                    Ninguno
                  </button>
                </div>
              </div>

              {estadoPlantel === "cargando" && (
                <div className="entrenamiento-vacio">Cargando la lista de jugadores…</div>
              )}
              {estadoPlantel === "error" && <div className="entrenamiento-estado error">{errorPlantel}</div>}
              {estadoPlantel === "listo" && plantel.length === 0 && (
                <div className="entrenamiento-vacio">La lista de jugadores está vacía. Cargala en Ajustes.</div>
              )}
              {estadoAtletas === "error" && (
                <div className="entrenamiento-estado advertencia">
                  No se pudo leer qué jugadores tienen datos en esta sesión. OpenField lo controla al enviar.
                </div>
              )}

              <ul className="tarea-jugadores">
                {plantel.map((jugador) => {
                  const clave = String(jugador.id);
                  const datos = tarea.participantes[clave];
                  const vinculado = Boolean(jugador.catapult_id);
                  const sinDatos = vinculado && !tieneDatos(jugador);

                  return (
                    <li key={clave} className={datos ? "elegido" : ""}>
                      <label className="tarea-jugador">
                        <input
                          type="checkbox"
                          checked={Boolean(datos)}
                          // Sin datos en la sesión no se puede agregar, pero sí sacar.
                          disabled={!vinculado || (sinDatos && !datos)}
                          onChange={() => alternarJugador(tarea.id, clave)}
                        />
                        <span>{jugador.nombre}</span>
                        {!vinculado && <small>Sin vincular con Catapult</small>}
                        {sinDatos && <small>Sin datos en esta sesión</small>}
                      </label>

                      {datos && (
                        <div className="tarea-jugador-tiempo">
                          <select
                            aria-label={`Tiempo de ${jugador.nombre}`}
                            value={datos.modo}
                            onChange={(e) => cambiarModo(tarea, clave, e.target.value)}
                          >
                            <option value={MODO_TOTAL}>Toda la tarea</option>
                            <option value={MODO_PARCIAL}>Menos tiempo</option>
                          </select>

                          {datos.modo === MODO_PARCIAL && (
                            <div className="tarea-jugador-parcial">
                              <input
                                aria-label={`Desde, ${jugador.nombre}`}
                                type="time"
                                step="1"
                                value={datos.inicio}
                                onChange={(e) => cambiarParticipante(tarea.id, clave, { inicio: e.target.value })}
                              />
                              <button
                                type="button"
                                onClick={() => cambiarParticipante(tarea.id, clave, { inicio: horaLocal() })}
                              >
                                Ahora
                              </button>
                              <span>→</span>
                              <input
                                aria-label={`Hasta, ${jugador.nombre}`}
                                type="time"
                                step="1"
                                value={datos.fin}
                                onChange={(e) => cambiarParticipante(tarea.id, clave, { fin: e.target.value })}
                              />
                              <button
                                type="button"
                                onClick={() => cambiarParticipante(tarea.id, clave, { fin: horaLocal() })}
                              >
                                Ahora
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <dl className="tarea-resumen">
              <div>
                <dt>Duración</dt>
                <dd>{segundosATexto(resumen.duracionBrutaSegundos)}</dd>
              </div>
              <div>
                <dt>Pausas</dt>
                <dd>{segundosATexto(resumen.pausasSegundos)}</dd>
              </div>
              <div>
                <dt>Tiempo efectivo</dt>
                <dd>{segundosATexto(resumen.duracionEfectivaSegundos)}</dd>
              </div>
            </dl>

            {faltantes.length > 0 ? (
              <ul className="tarea-problemas">
                {faltantes.map((problema) => (
                  <li key={problema}>{problema}</li>
                ))}
              </ul>
            ) : (
              <div className="entrenamiento-estado correcto">✓ Lista para enviar</div>
            )}

            <div className="tarea-acciones">
              <button type="button" className="entrenamiento-boton-secundario" onClick={() => setAbierta("")}>
                Cerrar
              </button>
              {borrando === tarea.id ? (
                <div className="tarea-confirmar-borrado">
                  <span>
                    {estado === "pendiente"
                      ? "¿Borrar esta tarea?"
                      : "¿Borrar esta tarea? En el próximo envío también se retira de OpenField."}
                  </span>
                  <button type="button" className="tarea-boton-borrar" onClick={() => borrarTarea(tarea.id)}>
                    Sí, borrar
                  </button>
                  <button type="button" className="entrenamiento-boton-secundario" onClick={() => setBorrando("")}>
                    No
                  </button>
                </div>
              ) : (
                <button type="button" className="tarea-boton-borrar" onClick={() => setBorrando(tarea.id)}>
                  Borrar tarea
                </button>
              )}
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <main className="entrenamiento-app entrenamiento-tareas">
      <header className="entrenamiento-barra">
        <div>
          <span>Entrenamiento</span>
          <strong>Tareas</strong>
        </div>
        <span className="tareas-sesion-chip" title={actividad.name}>
          {actividad.name || "Sesión sin nombre"}
        </span>
      </header>

      <section className="entrenamiento-contenido">
        <div className="tareas-cabecera">
          <div>
            <span>Sesión</span>
            <strong>{actividad.name || "Sin nombre"}</strong>
            <small>{plural(tareas.length, "tarea", "tareas")}</small>
          </div>
          <button type="button" className="entrenamiento-boton-principal tareas-boton-nueva" onClick={agregarTarea}>
            + Nueva tarea
          </button>
        </div>

        {estadoPlantel === "error" && <div className="entrenamiento-estado error">{errorPlantel}</div>}

        {tareas.length === 0 ? (
          <div className="entrenamiento-vacio">
            Todavía no hay tareas. Tocá "Nueva tarea", ponele nombre, marcá el inicio y el fin y elegí los
            jugadores.
          </div>
        ) : (
          <ol className="tareas-lista">{tareas.map(renderTarea)}</ol>
        )}

        <section className="entrenamiento-panel tareas-envio">
          <div className="entrenamiento-panel-titulo">
            <span>OF</span>
            <div>
              <h2>Enviar a OpenField</h2>
              <p>Primero la vista previa. Para escribir, se confirma con el nombre de la sesión.</p>
            </div>
          </div>

          {tareas.length > 0 && (
            <div className="tareas-envio-resumen">
              <span>{plural(cuenta("enviada"), "enviada", "enviadas")}</span>
              <span>{plural(cuenta("modificada"), "con cambios", "con cambios")}</span>
              <span>{plural(cuenta("pendiente"), "sin enviar", "sin enviar")}</span>
            </div>
          )}

          {conProblemas.length > 0 && (
            <div className="entrenamiento-estado advertencia">
              Antes de enviar, completá:{" "}
              {conProblemas
                .map((tarea) => `${tarea.nombre || "tarea sin nombre"} (${problemas.get(tarea.id)[0]})`)
                .join(" · ")}
            </div>
          )}

          <button
            type="button"
            className="entrenamiento-boton-principal"
            onClick={pedirPlan}
            disabled={!puedePrevisualizar}
          >
            {envio.estado === "planificando" ? "Armando la vista previa…" : "Vista previa del envío"}
          </button>

          {envio.estado === "error" && (
            <div className="entrenamiento-estado error">
              {envio.error}
              {envio.escribio === true && " Es posible que algo se haya escrito: revisá la sesión en OpenField."}
              {envio.escribio === null && " No hubo respuesta: revisá la sesión en OpenField antes de volver a enviar."}
              {envio.errores?.length > 0 && (
                <ul>
                  {envio.errores.map((item, i) => (
                    <li key={`${item.tareaId || "general"}-${i}`}>
                      {item.nombre ? `${item.nombre}: ` : ""}
                      {item.error}
                      {Array.isArray(item.atletasFuera) && item.atletasFuera.length > 0
                        ? ` Sin datos: ${item.atletasFuera.map((id) => nombrePorCatapultId.get(String(id)) || id).join(", ")}.`
                        : ""}
                    </li>
                  ))}
                </ul>
              )}
              <DetalleTecnico texto={envio.detalle} />
            </div>
          )}

          {mostrarPlan && (
            <div className="tareas-plan">
              <strong>Qué va a pasar en OpenField</strong>
              <ul className="tareas-plan-resumen">
                <li>{plural(envio.plan.resumen?.nuevos ?? 0, "período nuevo", "períodos nuevos")}</li>
                <li>{plural(envio.plan.resumen?.reemplazados ?? 0, "período de la app actualizado", "períodos de la app actualizados")}</li>
                <li>{plural(envio.plan.resumen?.eliminados ?? 0, "período de la app retirado", "períodos de la app retirados")}</li>
                <li>
                  {plural(envio.plan.resumen?.preservados ?? 0, "período que no es de la app queda igual", "períodos que no son de la app quedan igual")}
                </li>
              </ul>
              <ol className="tareas-plan-tareas">
                {(envio.plan.tareas || []).map((tarea) => (
                  <li key={tarea.tareaId}>
                    <strong>{tarea.nombre}</strong>
                    <span>
                      {plural((tarea.periodos || []).length, "período", "períodos")} ·{" "}
                      {plural(
                        (tarea.periodos || []).reduce((total, periodo) => total + (periodo.participantes || 0), 0),
                        "jugador",
                        "jugadores",
                      )}
                    </span>
                  </li>
                ))}
              </ol>

              {envio.plan.avisos?.length > 0 && (
                <div className="entrenamiento-estado advertencia">
                  OpenField informa la actividad de {msAHora(envio.plan.activity?.start_time_ms) || "?"} a{" "}
                  {msAHora(envio.plan.activity?.end_time_ms) || "?"}. Fuera de ese horario quedan:{" "}
                  {envio.plan.avisos.map((aviso) => aviso.nombre || "tarea sin nombre").join(", ")}. OpenField las
                  acepta igual; revisá que la fecha y la hora sean las correctas antes de enviar.
                </div>
              )}

              {!planVigente ? (
                <div className="entrenamiento-estado advertencia">
                  Las tareas cambiaron después de la vista previa. Pedila de nuevo antes de enviar.
                </div>
              ) : (
                <>
                  <label>
                    Para enviar, escribí el nombre de la sesión tal cual:{" "}
                    <strong>{envio.plan.confirmacionRequerida}</strong>
                    <input
                      type="text"
                      value={confirmacion}
                      onChange={(e) => setConfirmacion(e.target.value)}
                      placeholder={envio.plan.confirmacionRequerida}
                      autoComplete="off"
                      disabled={enviando}
                    />
                  </label>
                  {envio.error && <div className="entrenamiento-estado error">{envio.error}</div>}
                  <button
                    type="button"
                    className="entrenamiento-boton-principal"
                    onClick={enviar}
                    disabled={enviando || confirmacion.trim() !== envio.plan.confirmacionRequerida}
                  >
                    {enviando ? "Enviando a OpenField…" : "Enviar a OpenField"}
                  </button>
                </>
              )}
            </div>
          )}

          {envio.estado === "enviado" && envio.resultado && (
            <div className="tareas-resultado">
              <div className={`entrenamiento-estado ${envio.resultado.ok ? "correcto" : "error"}`}>
                {envio.resultado.ok ? "✓ " : ""}
                {ETIQUETAS_VEREDICTO[envio.resultado.veredicto?.codigo] ||
                  envio.resultado.veredicto?.detalle ||
                  "Envío terminado."}
              </div>
              <ul>
                {(envio.resultado.tareas || []).map((tarea) => (
                  <li key={tarea.tareaId} className={tarea.ok ? "ok" : "fallo"}>
                    {tarea.ok ? "✓" : "✗"} {tarea.nombre}
                    {!tarea.ok && tarea.fallidos?.length > 0
                      ? ` — ${[...new Set(tarea.fallidos.map((fallo) => MOTIVOS_FALLO[fallo.motivo] || fallo.motivo))].join(", ")}`
                      : ""}
                  </li>
                ))}
              </ul>
              {!envio.resultado.ok && <DetalleTecnico texto={detalleTecnico(envio.resultado)} />}
            </div>
          )}

          {envio.estado === "idle" && sesion.ultimoEnvio && (
            <div className="tareas-ultimo-envio">
              Último envío: {formatearFechaHora(sesion.ultimoEnvio.fecha)} ·{" "}
              {ETIQUETAS_VEREDICTO[sesion.ultimoEnvio.codigo] || sesion.ultimoEnvio.detalle}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

// Duración de una pausa tal como está cargada; "—" si todavía no cierra.
const duracionDePausa = (tarea, pausa) => {
  const inicioMs = horaAMs(tarea.fecha, pausa.inicio);
  const finMs = horaAMs(tarea.fecha, pausa.fin);
  if (inicioMs === null || finMs === null || finMs <= inicioMs) return "—";
  return segundosATexto((finMs - inicioMs) / 1000);
};
