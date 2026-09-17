import React, { useMemo, useState } from "react";
import { prepararCorteOpenField } from "./domain/openfieldCuts.js";
import "./training-openfield.css";

const OPENFIELD_EDITOR_BASE = "https://us.openfield.catapultsports.com/editor";

const hoyLocal = () => {
  const ahora = new Date();
  const yyyy = ahora.getFullYear();
  const mm = String(ahora.getMonth() + 1).padStart(2, "0");
  const dd = String(ahora.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const fechaHoraLocal = (fecha, hora) => {
  if (!fecha || !hora) return null;
  const normalizada = hora.length === 5 ? `${hora}:00` : hora;
  return `${fecha}T${normalizada}`;
};

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

const formatearFechaHoraActividad = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return "Sin horario";

  const fecha = new Date(numero < 1e12 ? numero * 1000 : numero);
  if (Number.isNaN(fecha.getTime())) return "Sin horario";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(fecha);
};

const nuevaPausa = () => ({ inicio: "", fin: "" });

export default function TrainingApp({ onVolver }) {
  const [fecha, setFecha] = useState(hoyLocal);
  const [nombre, setNombre] = useState("Tarea 1");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [pausas, setPausas] = useState([]);

  const [estadoOpenField, setEstadoOpenField] = useState("desconectado");
  const [actividades, setActividades] = useState([]);
  const [errorOpenField, setErrorOpenField] = useState("");
  const [busquedaActividad, setBusquedaActividad] = useState("");
  const [actividadSeleccionadaId, setActividadSeleccionadaId] = useState("");

  const evaluacion = useMemo(() => {
    if (!inicio || !fin) {
      return { corte: null, error: "Completá inicio y fin para validar el corte." };
    }

    try {
      const corte = prepararCorteOpenField({
        nombre,
        inicio: fechaHoraLocal(fecha, inicio),
        fin: fechaHoraLocal(fecha, fin),
        pausas: pausas.map((pausa) => ({
          inicio: fechaHoraLocal(fecha, pausa.inicio),
          fin: fechaHoraLocal(fecha, pausa.fin),
        })),
      });

      return { corte, error: "" };
    } catch (error) {
      return { corte: null, error: error.message };
    }
  }, [fecha, nombre, inicio, fin, pausas]);

  const actividadesFiltradas = useMemo(() => {
    const texto = busquedaActividad.trim().toLowerCase();
    const base = texto
      ? actividades.filter((actividad) =>
          [actividad.name, actividad.id, actividad.venue]
            .filter(Boolean)
            .some((valor) => String(valor).toLowerCase().includes(texto)),
        )
      : actividades;

    return base.slice(0, texto ? 50 : 20);
  }, [actividades, busquedaActividad]);

  const actividadSeleccionada = useMemo(
    () => actividades.find((actividad) => actividad.id === actividadSeleccionadaId) || null,
    [actividades, actividadSeleccionadaId],
  );

  const cargarActividades = async () => {
    setEstadoOpenField("cargando");
    setErrorOpenField("");

    try {
      const respuesta = await fetch("/api/openfield/activities", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const payload = await respuesta.json().catch(() => null);

      if (!respuesta.ok || !payload?.ok) {
        const detalle = payload?.upstreamStatus
          ? ` Código OpenField: ${payload.upstreamStatus}.`
          : "";
        throw new Error(`${payload?.error || "No se pudo leer OpenField."}${detalle}`);
      }

      const lista = Array.isArray(payload.activities) ? payload.activities : [];
      setActividades(lista);
      setEstadoOpenField("conectado");

      if (
        actividadSeleccionadaId &&
        !lista.some((actividad) => actividad.id === actividadSeleccionadaId)
      ) {
        setActividadSeleccionadaId("");
      }
    } catch (error) {
      setActividades([]);
      setActividadSeleccionadaId("");
      setEstadoOpenField("error");
      setErrorOpenField(error?.message || "No se pudo conectar con OpenField.");
    }
  };

  const actualizarPausa = (indice, campo, valor) => {
    setPausas((actuales) =>
      actuales.map((pausa, i) =>
        i === indice ? { ...pausa, [campo]: valor } : pausa,
      ),
    );
  };

  const conexionLista = estadoOpenField === "conectado";

  return (
    <main className="entrenamiento-app">
      <header className="entrenamiento-barra">
        <button type="button" className="entrenamiento-volver" onClick={onVolver}>
          ← Módulos
        </button>
        <div>
          <span>Entrenamiento</span>
          <strong>OpenField · Modo prueba</strong>
        </div>
      </header>

      <section className="entrenamiento-contenido">
        <div className="entrenamiento-aviso">
          <strong>Modo prueba</strong>
          <span>
            Esta pantalla ya puede leer actividades reales de OpenField. Sigue bloqueada toda
            acción de escritura: no crea, edita ni borra períodos.
          </span>
        </div>

        <div className="entrenamiento-grid">
          <div className="entrenamiento-columna-principal">
            <section className="entrenamiento-panel">
              <div className="entrenamiento-panel-titulo">
                <span>01</span>
                <div>
                  <h1>OpenField</h1>
                  <p>Conexión oficial por Catapult Connect API, únicamente en modo lectura.</p>
                </div>
              </div>

              <div className="entrenamiento-conexion">
                <div>
                  <span
                    className={`entrenamiento-estado-punto ${
                      conexionLista
                        ? "conectado"
                        : estadoOpenField === "error"
                          ? "error"
                          : "pendiente"
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>
                      {estadoOpenField === "cargando"
                        ? "Conectando…"
                        : conexionLista
                          ? "OpenField conectado"
                          : estadoOpenField === "error"
                            ? "Error de conexión"
                            : "Listo para conectar"}
                    </strong>
                    <span>
                      {conexionLista
                        ? `${actividades.length} actividades disponibles.`
                        : estadoOpenField === "error"
                          ? errorOpenField
                          : "El token permanece en el backend de Vercel."}
                    </span>
                  </div>
                </div>
                <span className="entrenamiento-modo-chip">SOLO LECTURA</span>
              </div>

              <button
                type="button"
                className="entrenamiento-boton-principal"
                onClick={cargarActividades}
                disabled={estadoOpenField === "cargando"}
              >
                {estadoOpenField === "cargando"
                  ? "Conectando…"
                  : conexionLista
                    ? "Actualizar actividades"
                    : "Conectar OpenField"}
              </button>
            </section>

            <section
              className={`entrenamiento-panel ${
                conexionLista ? "" : "entrenamiento-panel-bloqueado"
              }`}
            >
              <div className="entrenamiento-panel-titulo">
                <span>02</span>
                <div>
                  <h2>Elegir actividad</h2>
                  <p>Seleccioná explícitamente la actividad sobre la que trabajaremos.</p>
                </div>
              </div>

              {!conexionLista ? (
                <div className="entrenamiento-vacio">
                  Conectá OpenField para cargar las actividades reales. No se selecciona ninguna
                  automáticamente para evitar trabajar sobre una actividad equivocada.
                </div>
              ) : (
                <>
                  <label>
                    Buscar actividad
                    <input
                      type="search"
                      value={busquedaActividad}
                      onChange={(e) => setBusquedaActividad(e.target.value)}
                      placeholder="Nombre, ID o sede"
                    />
                  </label>

                  <div className="entrenamiento-actividad-resumen">
                    <span>
                      {busquedaActividad.trim()
                        ? `${actividadesFiltradas.length} coincidencias mostradas`
                        : `Mostrando las ${Math.min(20, actividades.length)} más recientes`}
                    </span>
                    <span>{actividades.length} totales</span>
                  </div>

                  {actividadesFiltradas.length === 0 ? (
                    <div className="entrenamiento-vacio">
                      No encontramos actividades con ese criterio.
                    </div>
                  ) : (
                    <div className="entrenamiento-lista-actividades">
                      {actividadesFiltradas.map((actividad) => {
                        const seleccionada = actividad.id === actividadSeleccionadaId;
                        const duracion =
                          Number(actividad.end_time) > Number(actividad.start_time)
                            ? Number(actividad.end_time) - Number(actividad.start_time)
                            : 0;

                        return (
                          <button
                            key={actividad.id}
                            type="button"
                            className={`entrenamiento-actividad ${seleccionada ? "seleccionada" : ""}`}
                            onClick={() => setActividadSeleccionadaId(actividad.id)}
                            aria-pressed={seleccionada}
                          >
                            <div>
                              <strong>{actividad.name || "Sin nombre"}</strong>
                              <span>{formatearFechaHoraActividad(actividad.start_time)}</span>
                            </div>
                            <div className="entrenamiento-actividad-datos">
                              <span>{actividad.period_count ?? 0} períodos</span>
                              <span>{segundosATiempo(duracion)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {actividadSeleccionada && (
                    <div className="entrenamiento-seleccion-confirmada">
                      <div>
                        <span>Actividad seleccionada</span>
                        <strong>{actividadSeleccionada.name}</strong>
                        <small>{actividadSeleccionada.id}</small>
                      </div>
                      <a
                        href={`${OPENFIELD_EDITOR_BASE}/${actividadSeleccionada.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir en OpenField ↗
                      </a>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="entrenamiento-panel">
              <div className="entrenamiento-panel-titulo">
                <span>03</span>
                <div>
                  <h2>Definir tarea</h2>
                  <p>Los horarios quedan editables antes de procesar.</p>
                </div>
              </div>

              <label>
                Fecha
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </label>

              <label>
                Nombre / descripción
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Posesión 6v6+3"
                />
              </label>

              <div className="entrenamiento-dos-columnas">
                <label>
                  Hora de inicio
                  <input
                    type="time"
                    step="1"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                  />
                </label>

                <label>
                  Hora final
                  <input
                    type="time"
                    step="1"
                    value={fin}
                    onChange={(e) => setFin(e.target.value)}
                  />
                </label>
              </div>

              <div className="entrenamiento-pausas-cabecera">
                <div>
                  <strong>Pausas</strong>
                  <span>Opcionales. Podés agregar más de una.</span>
                </div>
                <button
                  type="button"
                  className="entrenamiento-boton-secundario"
                  onClick={() => setPausas((actuales) => [...actuales, nuevaPausa()])}
                >
                  + Agregar pausa
                </button>
              </div>

              {pausas.length === 0 ? (
                <div className="entrenamiento-vacio">Esta tarea no tiene pausas.</div>
              ) : (
                <div className="entrenamiento-lista-pausas">
                  {pausas.map((pausa, indice) => (
                    <div className="entrenamiento-pausa" key={`pausa-${indice}`}>
                      <span>Pausa {indice + 1}</span>
                      <input
                        aria-label={`Inicio pausa ${indice + 1}`}
                        type="time"
                        step="1"
                        value={pausa.inicio}
                        onChange={(e) => actualizarPausa(indice, "inicio", e.target.value)}
                      />
                      <span>→</span>
                      <input
                        aria-label={`Fin pausa ${indice + 1}`}
                        type="time"
                        step="1"
                        value={pausa.fin}
                        onChange={(e) => actualizarPausa(indice, "fin", e.target.value)}
                      />
                      <button
                        type="button"
                        aria-label={`Eliminar pausa ${indice + 1}`}
                        onClick={() =>
                          setPausas((actuales) => actuales.filter((_, i) => i !== indice))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="entrenamiento-panel entrenamiento-resumen">
            <div className="entrenamiento-panel-titulo">
              <span>04</span>
              <div>
                <h2>Vista previa</h2>
                <p>Actividad real + corte calculado antes de habilitar escritura.</p>
              </div>
            </div>

            {actividadSeleccionada ? (
              <div className="entrenamiento-estado correcto">
                ✓ Actividad seleccionada: {actividadSeleccionada.name}
              </div>
            ) : (
              <div className="entrenamiento-estado pendiente">Elegí una actividad de OpenField.</div>
            )}

            {evaluacion.corte ? (
              <>
                <div className="entrenamiento-estado correcto">✓ Corte válido</div>
                <dl className="entrenamiento-metricas">
                  <div>
                    <dt>Tarea</dt>
                    <dd>{evaluacion.corte.nombre || "Sin nombre"}</dd>
                  </div>
                  <div>
                    <dt>Duración bruta</dt>
                    <dd>{segundosATiempo(evaluacion.corte.duracionBrutaSegundos)}</dd>
                  </div>
                  <div>
                    <dt>Pausas</dt>
                    <dd>{segundosATiempo(evaluacion.corte.pausasSegundos)}</dd>
                  </div>
                  <div>
                    <dt>Duración efectiva</dt>
                    <dd>{segundosATiempo(evaluacion.corte.duracionEfectivaSegundos)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="entrenamiento-estado pendiente">{evaluacion.error}</div>
            )}

            <div className="entrenamiento-siguiente">
              <strong>
                {actividadSeleccionada && evaluacion.corte
                  ? "Lectura lista para validar"
                  : "Todavía no se puede aplicar"}
              </strong>
              <span>
                {actividadSeleccionada && evaluacion.corte
                  ? "Ya tenemos una actividad real y un corte calculado. El siguiente paso será leer los períodos de esa actividad y validar sus límites antes de cualquier escritura."
                  : "Necesitamos una actividad real seleccionada y un corte válido. La app sigue sin enviar modificaciones a OpenField."}
              </span>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
