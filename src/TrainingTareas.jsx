import React, { useEffect, useMemo, useState } from "react";
import { leerEquipoElegido } from "./domain/equipo.js";
import { cargarPlantelConCatapult } from "./domain/plantel.js";
import {
  MODO_PARCIAL,
  MODO_TOTAL,
  armarEnvio,
  cargarSesion,
  estadoDeTarea,
  estadoEnvioTarea,
  fechaDeActividad,
  guardarSesion,
  horaAMs,
  horaLocal,
  huellaTarea,
  msAHora,
  nuevaPausa,
  nuevaTarea,
  pausaAbierta,
  problemasDeTarea,
  resumenTarea,
  segundosATexto,
} from "./domain/sesionEntrenamiento.js";
import {
  CabeceraTablero,
  HojaEntraSale,
  HojaJugadores,
  HojaTodasLasTareas,
  ListaTareas,
  PanelSinTareas,
  PanelTarea,
  RelojTarea,
  SolapasTareas,
  TarjetaPausas,
} from "./TrainingTablero.jsx";
import { pedirJson } from "./trainingApi.js";
import { ETIQUETAS_VEREDICTO, MOTIVOS_FALLO, mensajeDeError } from "./textosEntrenamiento.js";
import { BotonVolver, DatoDetalle } from "./components/BotonVolver.jsx";
import { useEscudoClub } from "./components/ClubCrest";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { Icono } from "./components/AppChrome";

const generarId = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Etiqueta y color (clase de `.estado-tarea`) de cada estado de envío de una
// tarea terminada.
const ESTADOS = {
  pendiente: { etiqueta: "Sin enviar", clase: "pendiente" },
  enviada: { etiqueta: "Enviada", clase: "enviada" },
  modificada: { etiqueta: "Con cambios", clase: "modificada" },
  incompleta: { etiqueta: "Incompleta", clase: "incompleta" },
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

// Tareas de la sesión, registradas como los tiempos de un partido: una solapa
// por tarea, el reloj arriba y la tarjeta con Iniciar/Terminar, Pausa,
// Jugadores y Entra/Sale. Todo queda guardado en el celular por sesión; al
// servidor va cuando se revisa el resumen y se confirma con el nombre de la
// sesión.
export default function TrainingTareas({ actividad = null, onIrASesion }) {
  const activityId = actividad?.id || "";

  const [sesion, setSesion] = useState(() => (activityId ? cargarSesion(activityId, actividad?.name) : null));
  const [equipo] = useState(() => leerEquipoElegido());
  const escudo = useEscudoClub(equipo?.nombre || "", { demora: 0 });
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
  const [pantalla, setPantalla] = useState("tablero");
  // La tarea que se ve en el tablero; sin elegir, la última.
  const [activaId, setActivaId] = useState("");
  const [hoja, setHoja] = useState("");
  const [pausasDesplegadas, setPausasDesplegadas] = useState(false);
  const [borrando, setBorrando] = useState("");
  // El reloj de la pantalla avanza solo, como el del partido.
  const [ahora, setAhora] = useState(() => Date.now());
  const [envio, setEnvio] = useState({ estado: "idle" });
  const [confirmacion, setConfirmacion] = useState("");

  useEffect(() => {
    setSesion(activityId ? cargarSesion(activityId, actividad?.name) : null);
    setPantalla("tablero");
    setActivaId("");
    setHoja("");
    setPausasDesplegadas(false);
    setBorrando("");
    setEnvio({ estado: "idle" });
    setConfirmacion("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  useEffect(() => {
    if (sesion?.activityId) guardarSesion(sesion);
  }, [sesion]);

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const { plantel: lista, error } = await cargarPlantelConCatapult(equipo?.id || null);
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

  // La tarea nueva nace sin nombre y sin hora: el nombre se toca de las
  // sugerencias o se escribe, y la hora la pone Iniciar tarea.
  const agregarTarea = () => {
    const id = generarId();
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
            ...nuevaTarea({ id, nombre: "", fecha: fechaDeActividad(actividad) }),
            participantes,
          },
        ],
      };
    });
    setActivaId(id);
    setPausasDesplegadas(false);
    setHoja("");
    setBorrando("");
  };

  const borrarTarea = (id) => {
    setSesion((actual) => ({ ...actual, tareas: actual.tareas.filter((tarea) => tarea.id !== id) }));
    setBorrando("");
    if (activaId === id) setActivaId("");
  };

  const iniciarTarea = (id) => actualizarTarea(id, { inicio: horaLocal() });

  // Terminar cierra también la pausa abierta y completa el tiempo del que
  // entró tarde y no tenía fin: la tarea no queda con cabos sueltos.
  const terminarTarea = (id) =>
    actualizarTarea(id, (tarea) => {
      const fin = horaLocal();
      return {
        fin,
        pausas: tarea.pausas.map((pausa) => (pausa.inicio && !pausa.fin ? { ...pausa, fin } : pausa)),
        participantes: Object.fromEntries(
          Object.entries(tarea.participantes).map(([jugadorId, datos]) =>
            datos.modo === MODO_PARCIAL
              ? [jugadorId, { ...datos, inicio: datos.inicio || tarea.inicio, fin: datos.fin || fin }]
              : [jugadorId, datos],
          ),
        ),
      };
    });

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

  const alternarPausa = (tarea) => (pausaAbierta(tarea) ? terminarPausa(tarea.id) : empezarPausa(tarea.id));

  const agregarPausaVacia = (id) => actualizarTarea(id, (tarea) => ({ pausas: [...tarea.pausas, nuevaPausa()] }));

  // Entra / Sale: el que se suma tarde entra desde ahora; el que se va antes
  // queda hasta ahora. Deshacer vuelve a como estaba.
  const entrarAhora = (id, jugadorId) =>
    cambiarParticipante(id, jugadorId, { modo: MODO_PARCIAL, inicio: horaLocal(), fin: "" });

  const salirAhora = (id, jugadorId) =>
    actualizarTarea(id, (tarea) => {
      const datos = tarea.participantes[jugadorId] || { modo: MODO_TOTAL, inicio: "", fin: "" };
      const inicio = datos.modo === MODO_PARCIAL && datos.inicio ? datos.inicio : tarea.inicio;
      return { participantes: { ...tarea.participantes, [jugadorId]: { modo: MODO_PARCIAL, inicio, fin: horaLocal() } } };
    });

  const deshacerEntraSale = (id, jugadorId) =>
    actualizarTarea(id, (tarea) => {
      const datos = tarea.participantes[jugadorId];
      const participantes = { ...tarea.participantes };
      // Entró tarde y no salió: no estaba en la tarea. Si salió, estaba entera.
      if (datos?.modo === MODO_PARCIAL && !datos.fin) delete participantes[jugadorId];
      else participantes[jugadorId] = { modo: MODO_TOTAL, inicio: "", fin: "" };
      return { participantes };
    });

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

  const volverAlTablero = () => {
    setPantalla("tablero");
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

  const renderErrorEnvio = ({ conCerrar = false } = {}) => (
    <Aviso
      titulo="No se pudo enviar"
      accion={conCerrar ? "Cerrar" : undefined}
      onAccion={conCerrar ? () => setEnvio({ estado: "idle" }) : undefined}
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

  // Lo que se corrige a mano, plegado bajo "Ajustar horarios y pausas".
  const renderAjustes = (tarea) => {
    const idFecha = `tarea-fecha-${tarea.id}`;
    const elegidos = plantel.filter((jugador) => tarea.participantes[String(jugador.id)]);
    const resumen = resumenTarea(tarea);

    return (
      <>
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
            <small>{pausa.inicio && !pausa.fin ? "en curso" : duracionDePausa(tarea, pausa)}</small>
          </div>
        ))}

        <button type="button" className="agregar-cambio-operativo" onClick={() => agregarPausaVacia(tarea.id)}>
          <Icono nombre="plus" size={16} />
          Agregar una pausa a mano
        </button>

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

        <div className="campo-inicio">
          <label htmlFor={idFecha}>Fecha de la tarea</label>
          <input
            id={idFecha}
            type="date"
            value={tarea.fecha}
            onChange={(e) => actualizarTarea(tarea.id, { fecha: e.target.value })}
          />
        </div>
      </>
    );
  };

  const renderTablero = () => {
    const activa = tareas.find((tarea) => tarea.id === activaId) || tareas[tareas.length - 1] || null;
    const indiceActiva = activa ? tareas.indexOf(activa) : -1;
    const corriendo = (tarea) => ["en-curso", "en-pausa"].includes(estadoDeTarea(tarea));
    const pendientes = cuenta("pendiente") + cuenta("modificada");
    const etiquetaEnviar =
      envio.estado === "planificando" ? "Armando…" : pendientes > 0 ? `Enviar ${plural(pendientes, "tarea", "tareas")}` : "Enviar";

    // Con algo incompleto, Enviar abre la lista y dice qué falta.
    const alEnviar = () => {
      if (conProblemas.length > 0) setHoja("todas");
      else pedirPlan();
    };

    const pastillaDe = (tarea) => {
      const estado = estadoDeTarea(tarea);
      if (estado === "terminada") {
        return (problemas.get(tarea.id) || []).length > 0 ? ESTADOS.incompleta : ESTADOS[estadoEnvioTarea(tarea)];
      }
      if (estado === "en-pausa") return { etiqueta: "En pausa", clase: "pausa" };
      if (estado === "en-curso") return { etiqueta: "En curso", clase: "en-curso" };
      return { etiqueta: "Nueva", clase: "" };
    };

    const filaDeTarea = (tarea) => {
      const estado = estadoDeTarea(tarea);
      if (corriendo(tarea)) return { etiqueta: estado === "en-pausa" ? "En pausa" : "En curso", clase: "viva" };
      if (estado === "sin-iniciar") return { etiqueta: "Sin iniciar", clase: "" };
      return pastillaDe(tarea);
    };

    const textoPie = activa
      ? `Tarea ${indiceActiva + 1} de ${tareas.length} · ${activa.inicio ? `${activa.inicio} → ${activa.fin || "en curso"}` : "sin empezar"}`
      : "Sin tareas";
    const avisoLista =
      conProblemas.length > 0
        ? `Antes de enviar, completá: ${conProblemas.map((tarea) => tarea.nombre || `Tarea ${tareas.indexOf(tarea) + 1}`).join(", ")}. Abrí la tarea para ver qué falta.`
        : "";
    const descripcionLista =
      tareas.length === 0
        ? "Tocá Nueva tarea cuando arranque la primera."
        : `${plural(tareas.length, "tarea", "tareas")} · ${plural(cuenta("enviada"), "enviada", "enviadas")} · ${pendientes} sin enviar. Tocá una para ir a su solapa.`;

    const irATarea = (id) => {
      setActivaId(id);
      setPausasDesplegadas(false);
      setHoja("");
    };

    const atajos = activa
      ? [
          { etiqueta: "Todos", onClick: () => marcarTodos(activa.id) },
          { etiqueta: "Ninguno", onClick: () => marcarNinguno(activa.id) },
          ...(indiceActiva > 0
            ? [{ etiqueta: "Como la anterior", onClick: () => copiarJugadoresDe(activa.id, tareas[indiceActiva - 1]) }]
            : []),
          ...gruposDeRol.map((grupo) => ({ etiqueta: grupo.etiqueta, onClick: () => alternarGrupo(activa.id, grupo.ids) })),
        ]
      : [];

    return (
      <div className="tablero-partido tablero-tareas">
        <CabeceraTablero
          nombreSesion={nombreSesion}
          nombreEquipo={equipo?.nombre || ""}
          escudoUrl={escudo.url}
          enCurso={tareas.some(corriendo)}
          etiquetaEnviar={etiquetaEnviar}
          onEnviar={alEnviar}
          onBorrar={() => activa && setBorrando(activa.id)}
          puedeBorrar={Boolean(activa)}
          deshabilitado={tareas.length === 0 || envio.estado === "planificando" || envio.estado === "enviando"}
        />

        {(estadoAtletas === "error" || envio.estado === "error") && (
          <div className="avisos-tablero">
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
            {envio.estado === "error" && renderErrorEnvio({ conCerrar: true })}
          </div>
        )}

        <div className="resumen-operativo">
          <div className="columna-reloj">
            {activa && (
              <>
                <RelojTarea tarea={activa} numero={indiceActiva + 1} ahora={ahora} />
                <TarjetaPausas
                  tarea={activa}
                  ahora={ahora}
                  desplegada={pausasDesplegadas}
                  onAlternar={() => setPausasDesplegadas((valor) => !valor)}
                  onQuitar={(indice) => quitarPausa(activa.id, indice)}
                />
              </>
            )}
          </div>

          <SolapasTareas
            tareas={tareas}
            activaId={activa?.id || ""}
            textoPie={textoPie}
            onElegir={irATarea}
            onNueva={agregarTarea}
            onVerTodas={() => setHoja("todas")}
          />
        </div>

        <div className="grilla-operativa">
          {activa ? (
            <PanelTarea
              tarea={activa}
              numero={indiceActiva + 1}
              total={tareas.length}
              pastilla={pastillaDe(activa)}
              faltantes={problemas.get(activa.id) || []}
              cantidadJugadores={Object.keys(activa.participantes).length}
              onNombre={(nombre) => actualizarTarea(activa.id, { nombre })}
              onIniciar={() => iniciarTarea(activa.id)}
              onTerminar={() => terminarTarea(activa.id)}
              onNueva={agregarTarea}
              onJugadores={() => setHoja("jugadores")}
              onPausa={() => alternarPausa(activa)}
              onEntraSale={() => setHoja("entra-sale")}
            >
              {renderAjustes(activa)}
            </PanelTarea>
          ) : (
            <PanelSinTareas onNueva={agregarTarea} />
          )}

          <section className="panel-operativo panel-lista-tareas" aria-label="Todas las tareas">
            <div className="panel-titulo">
              <div>
                <span className="sobrelinea">TODAS LAS TAREAS</span>
                <h2>{plural(tareas.length, "tarea", "tareas")}</h2>
              </div>
            </div>
            {avisoLista && <p className="aviso-hoja">{avisoLista}</p>}
            {tareas.length === 0 ? (
              <p className="vacio-ficha">Todavía no hay tareas.</p>
            ) : (
              <ListaTareas tareas={tareas} activaId={activa?.id || ""} filaDeTarea={filaDeTarea} onElegir={irATarea} />
            )}
          </section>
        </div>

        {envio.estado === "idle" && sesion.ultimoEnvio && (
          <p className="pie-tablero">
            Último envío: {formatearFechaHora(sesion.ultimoEnvio.fecha)} ·{" "}
            {sesion.ultimoEnvio.ok ? "todo bien" : "con problemas"}
          </p>
        )}

        <HojaJugadores
          abierta={hoja === "jugadores"}
          tarea={activa}
          plantel={plantel}
          elegibles={elegibles}
          estadoPlantel={estadoPlantel}
          errorPlantel={errorPlantel}
          tieneDatos={tieneDatos}
          atajos={atajos}
          onAlternar={(clave) => alternarJugador(activa.id, clave)}
          onCerrar={() => setHoja("")}
        />
        <HojaEntraSale
          abierta={hoja === "entra-sale"}
          tarea={activa}
          elegibles={elegibles}
          onEntra={(clave) => entrarAhora(activa.id, clave)}
          onSale={(clave) => salirAhora(activa.id, clave)}
          onDeshacer={(clave) => deshacerEntraSale(activa.id, clave)}
          onCerrar={() => setHoja("")}
        />
        <HojaTodasLasTareas
          abierta={hoja === "todas"}
          nombreSesion={nombreSesion}
          tareas={tareas}
          activaId={activa?.id || ""}
          descripcion={descripcionLista}
          aviso={avisoLista}
          filaDeTarea={filaDeTarea}
          onElegir={irATarea}
          onNueva={agregarTarea}
          onCerrar={() => setHoja("")}
        />
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
          <BotonVolver onClick={volverAlTablero}>Volver a Tareas</BotonVolver>
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
    <>
      {pantalla === "enviar" ? <div className="app">{renderEnviar()}</div> : renderTablero()}

      <HojaConfirmar
        abierta={Boolean(borrando)}
        titulo="¿Borrar esta tarea?"
        descripcion="Si ya la habías enviado, en el próximo envío también se saca de la sesión."
        etiquetaConfirmar="Sí, borrar"
        etiquetaCancelar="No"
        onConfirmar={() => borrarTarea(borrando)}
        onCancelar={() => setBorrando("")}
      />
    </>
  );
}
