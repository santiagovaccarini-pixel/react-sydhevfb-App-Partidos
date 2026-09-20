import React, { useEffect, useMemo, useRef, useState } from "react";
import "./training-openfield.css";
import { mensajeDeRespuesta } from "./trainingApi.js";

const OPENFIELD_EDITOR_BASE = "https://us.openfield.catapultsports.com/editor";

const segundosATiempo = (segundos) => {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segs = total % 60;

  if (horas > 0) {
    return `${horas}:${String(minutos).padStart(2, "0")}:${String(segs).padStart(2, "0")}`;
  }

  return `${minutos}:${String(segs).padStart(2, "0")}`;
};

const timestampAFecha = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return null;

  const fecha = new Date(numero < 1e12 ? numero * 1000 : numero);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const formatearFechaHoraActividad = (valor) => {
  const fecha = timestampAFecha(valor);
  if (!fecha) return "Sin horario";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
};

const formatearHoraPeriodo = (valor) => {
  const fecha = timestampAFecha(valor);
  if (!fecha) return "Sin horario";

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(fecha);
};

const leerJson = async (url) => {
  const respuesta = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload = await respuesta.json().catch(() => null);
  return { respuesta, payload };
};

// Sesión: la actividad de OpenField sobre la que se trabaja. Se elige una vez
// y queda guardada; desde acá también se ve lo que hoy tiene en OpenField.
export default function TrainingApp({ actividad = null, onSeleccionar, onIrATareas, onVolver }) {
  const [estadoOpenField, setEstadoOpenField] = useState("desconectado");
  const [actividades, setActividades] = useState([]);
  const [errorOpenField, setErrorOpenField] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [eligiendo, setEligiendo] = useState(false);

  const [estadoPeriodos, setEstadoPeriodos] = useState("idle");
  const [periodos, setPeriodos] = useState([]);
  const [errorPeriodos, setErrorPeriodos] = useState("");
  const solicitudPeriodosRef = useRef(0);

  const [estadoSnapshot, setEstadoSnapshot] = useState("idle");
  const [snapshot, setSnapshot] = useState(null);
  const [errorSnapshot, setErrorSnapshot] = useState("");
  const solicitudSnapshotRef = useRef(0);

  const actividadesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const base = texto
      ? actividades.filter((item) =>
          [item.name, item.id, item.venue]
            .filter(Boolean)
            .some((valor) => String(valor).toLowerCase().includes(texto)),
        )
      : actividades;

    return base.slice(0, texto ? 50 : 20);
  }, [actividades, busqueda]);

  const participantesPorPeriodo = useMemo(
    () => new Map((snapshot?.periods || []).map((periodo) => [periodo.id, periodo])),
    [snapshot],
  );

  // Los participantes se leen aparte y quedan viejos apenas cambian los períodos.
  const descartarSnapshot = () => {
    solicitudSnapshotRef.current += 1;
    setSnapshot(null);
    setEstadoSnapshot("idle");
    setErrorSnapshot("");
  };

  const cargarPeriodos = async (activityId) => {
    if (!activityId) return;

    const solicitudActual = solicitudPeriodosRef.current + 1;
    solicitudPeriodosRef.current = solicitudActual;
    setEstadoPeriodos("cargando");
    setPeriodos([]);
    setErrorPeriodos("");
    descartarSnapshot();

    try {
      const { respuesta, payload } = await leerJson(
        `/api/openfield/periods?activityId=${encodeURIComponent(activityId)}`,
      );

      if (!respuesta.ok || !payload?.ok) {
        throw new Error(mensajeDeRespuesta(payload, "No se pudieron leer los períodos de OpenField."));
      }

      if (solicitudActual !== solicitudPeriodosRef.current) return;

      setPeriodos(Array.isArray(payload.periods) ? payload.periods : []);
      setEstadoPeriodos("listo");
    } catch (error) {
      if (solicitudActual !== solicitudPeriodosRef.current) return;
      setPeriodos([]);
      setEstadoPeriodos("error");
      setErrorPeriodos(error?.message || "No se pudieron leer los períodos de OpenField.");
    }
  };

  const cargarParticipantes = async (activityId) => {
    if (!activityId) return;

    const solicitudActual = solicitudSnapshotRef.current + 1;
    solicitudSnapshotRef.current = solicitudActual;
    setEstadoSnapshot("cargando");
    setErrorSnapshot("");

    try {
      const { respuesta, payload } = await leerJson(
        `/api/openfield/snapshot?activityId=${encodeURIComponent(activityId)}`,
      );

      if (!respuesta.ok || !payload?.ok) {
        throw new Error(mensajeDeRespuesta(payload, "No se pudieron leer los participantes."));
      }

      if (solicitudActual !== solicitudSnapshotRef.current) return;

      setSnapshot(payload);
      setEstadoSnapshot("listo");
    } catch (error) {
      if (solicitudActual !== solicitudSnapshotRef.current) return;
      setSnapshot(null);
      setEstadoSnapshot("error");
      setErrorSnapshot(error?.message || "No se pudieron leer los participantes de OpenField.");
    }
  };

  useEffect(() => {
    if (actividad?.id) {
      cargarPeriodos(actividad.id);
    } else {
      solicitudPeriodosRef.current += 1;
      descartarSnapshot();
      setPeriodos([]);
      setEstadoPeriodos("idle");
      setErrorPeriodos("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividad?.id]);

  const buscarSesiones = async () => {
    setEstadoOpenField("cargando");
    setErrorOpenField("");

    try {
      const { respuesta, payload } = await leerJson("/api/openfield/activities");

      if (!respuesta.ok || !payload?.ok) {
        throw new Error(mensajeDeRespuesta(payload, "No se pudo leer OpenField."));
      }

      setActividades(Array.isArray(payload.activities) ? payload.activities : []);
      setEstadoOpenField("conectado");
      setEligiendo(true);
    } catch (error) {
      setActividades([]);
      setEstadoOpenField("error");
      setErrorOpenField(error?.message || "No se pudo conectar con OpenField.");
    }
  };

  const elegir = (item) => {
    onSeleccionar({
      id: item.id,
      name: item.name,
      start_time: item.start_time,
      end_time: item.end_time,
    });
    setEligiendo(false);
    setBusqueda("");
  };

  const buscando = estadoOpenField === "cargando";
  const periodosListos = estadoPeriodos === "listo";
  const snapshotListo = estadoSnapshot === "listo" && Boolean(snapshot);

  return (
    <main className="entrenamiento-app">
      <header className="entrenamiento-barra">
        <button type="button" className="entrenamiento-volver" onClick={onVolver}>
          ← Módulos
        </button>
        <div>
          <span>Entrenamiento</span>
          <strong>Sesión</strong>
        </div>
      </header>

      <section className="entrenamiento-contenido entrenamiento-sesion">
        <section className="entrenamiento-panel">
          <div className="entrenamiento-panel-titulo">
            <span>01</span>
            <div>
              <h1>Sesión de OpenField</h1>
              <p>La actividad de OpenField sobre la que vas a cargar las tareas.</p>
            </div>
          </div>

          {actividad ? (
            <div className="entrenamiento-seleccion-confirmada">
              <div>
                <span>Sesión elegida</span>
                <strong>{actividad.name || "Sin nombre"}</strong>
                <small>{formatearFechaHoraActividad(actividad.start_time)}</small>
              </div>
              <a
                href={`${OPENFIELD_EDITOR_BASE}/${actividad.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir en OpenField ↗
              </a>
            </div>
          ) : (
            <div className="entrenamiento-vacio">
              Todavía no elegiste la sesión. Buscala en OpenField y tocala en la lista.
            </div>
          )}

          <div className="entrenamiento-sesion-acciones">
            {actividad && (
              <button type="button" className="entrenamiento-boton-principal" onClick={onIrATareas}>
                Ir a Tareas
              </button>
            )}
            <button
              type="button"
              className={actividad ? "entrenamiento-boton-secundario" : "entrenamiento-boton-principal"}
              onClick={buscarSesiones}
              disabled={buscando}
            >
              {buscando
                ? "Buscando…"
                : actividad
                  ? "Cambiar de sesión"
                  : "Buscar sesiones en OpenField"}
            </button>
          </div>

          {estadoOpenField === "error" && (
            <div className="entrenamiento-estado error">{errorOpenField}</div>
          )}

          {estadoOpenField === "conectado" && eligiendo && (
            <div className="entrenamiento-sesion-lista">
              <label>
                Buscar sesión
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o sede"
                />
              </label>

              <div className="entrenamiento-actividad-resumen">
                <span>
                  {busqueda.trim()
                    ? `${actividadesFiltradas.length} coincidencias`
                    : `Las ${Math.min(20, actividades.length)} más recientes`}
                </span>
                <span>{actividades.length} en total</span>
              </div>

              {actividadesFiltradas.length === 0 ? (
                <div className="entrenamiento-vacio">No hay sesiones con ese nombre.</div>
              ) : (
                <div className="entrenamiento-lista-actividades">
                  {actividadesFiltradas.map((item) => {
                    const seleccionada = item.id === actividad?.id;
                    const duracion =
                      Number(item.end_time) > Number(item.start_time)
                        ? Number(item.end_time) - Number(item.start_time)
                        : 0;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`entrenamiento-actividad ${seleccionada ? "seleccionada" : ""}`}
                        onClick={() => elegir(item)}
                        aria-pressed={seleccionada}
                      >
                        <div>
                          <strong>{item.name || "Sin nombre"}</strong>
                          <span>{formatearFechaHoraActividad(item.start_time)}</span>
                        </div>
                        <div className="entrenamiento-actividad-datos">
                          <span>{item.period_count ?? 0} períodos</span>
                          <span>{segundosATiempo(duracion)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {actividad && (
          <section className="entrenamiento-panel">
            <div className="entrenamiento-panel-titulo">
              <span>02</span>
              <div>
                <h2>Períodos en OpenField</h2>
                <p>Lo que hoy tiene la sesión en OpenField, incluidos los cortes que mande la app.</p>
              </div>
            </div>

            <div className="entrenamiento-periodos-bloque">
              <div className="entrenamiento-periodos-cabecera">
                <div>
                  <span>Períodos</span>
                  <strong>
                    {estadoPeriodos === "cargando"
                      ? "Leyendo OpenField…"
                      : periodosListos
                        ? `${periodos.length} períodos`
                        : estadoPeriodos === "error"
                          ? "No se pudieron leer"
                          : "Pendiente"}
                  </strong>
                </div>
                <button
                  type="button"
                  className="entrenamiento-boton-secundario"
                  onClick={() => cargarPeriodos(actividad.id)}
                  disabled={estadoPeriodos === "cargando"}
                >
                  {estadoPeriodos === "cargando" ? "Leyendo…" : "Actualizar"}
                </button>
              </div>

              {estadoPeriodos === "error" && (
                <div className="entrenamiento-estado error">{errorPeriodos}</div>
              )}

              {periodosListos && periodos.length === 0 && (
                <div className="entrenamiento-vacio">Esta sesión no tiene períodos en OpenField.</div>
              )}

              {periodosListos && periodos.length > 0 && (
                <>
                  <div className="entrenamiento-participantes-barra">
                    <span>
                      {estadoSnapshot === "cargando"
                        ? "Leyendo los jugadores de cada período…"
                        : snapshotListo
                          ? "Jugadores de cada período leídos."
                          : estadoSnapshot === "error"
                            ? errorSnapshot
                            : "Los jugadores de cada período se leen aparte."}
                    </span>
                    <button
                      type="button"
                      className="entrenamiento-boton-secundario"
                      onClick={() => cargarParticipantes(actividad.id)}
                      disabled={estadoSnapshot === "cargando"}
                    >
                      {estadoSnapshot === "cargando"
                        ? "Leyendo…"
                        : snapshotListo
                          ? "Releer jugadores"
                          : "Ver jugadores"}
                    </button>
                  </div>

                  <div className="entrenamiento-lista-periodos">
                    {periodos.map((periodo, indice) => {
                      const detalle = participantesPorPeriodo.get(periodo.id);
                      const atletas = Array.isArray(detalle?.athletes)
                        ? [...detalle.athletes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
                        : null;

                      return (
                        <article className="entrenamiento-periodo" key={periodo.id}>
                          <div className="entrenamiento-periodo-identidad">
                            <span>{String(indice + 1).padStart(2, "0")}</span>
                            <div>
                              <strong>{periodo.name || "Sin nombre"}</strong>
                            </div>
                          </div>
                          <div className="entrenamiento-periodo-horarios">
                            <div>
                              <span>Inicio</span>
                              <strong>{formatearHoraPeriodo(periodo.start_ms ?? periodo.start_time)}</strong>
                            </div>
                            <div>
                              <span>Fin</span>
                              <strong>{formatearHoraPeriodo(periodo.end_ms ?? periodo.end_time)}</strong>
                            </div>
                            <div>
                              <span>Duración</span>
                              <strong>{segundosATiempo(periodo.duration_seconds)}</strong>
                            </div>
                          </div>
                          {detalle && (
                            <details className="entrenamiento-periodo-participantes">
                              <summary>
                                {atletas ? `${atletas.length} jugadores` : "Jugadores sin leer"}
                              </summary>
                              {atletas && atletas.length > 0 && (
                                <ul>
                                  {atletas.map((atleta) => (
                                    <li key={atleta.id}>
                                      {atleta.jersey != null ? `${atleta.jersey} · ` : ""}
                                      {atleta.nombre}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </details>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
