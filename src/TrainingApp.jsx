import React, { useMemo, useState } from "react";
import { prepararCorteOpenField } from "./domain/openfieldCuts.js";
import "./training-openfield.css";

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

const nuevaPausa = () => ({ inicio: "", fin: "" });

export default function TrainingApp({ onVolver }) {
  const [fecha, setFecha] = useState(hoyLocal);
  const [nombre, setNombre] = useState("Tarea 1");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [pausas, setPausas] = useState([]);

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

  const actualizarPausa = (indice, campo, valor) => {
    setPausas((actuales) =>
      actuales.map((pausa, i) =>
        i === indice ? { ...pausa, [campo]: valor } : pausa,
      ),
    );
  };

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
            Ninguna acción de esta pantalla modifica OpenField todavía. Primero vamos a
            conectar, leer y validar. La escritura se habilitará recién cuando esa etapa
            sea confiable.
          </span>
        </div>

        <div className="entrenamiento-grid">
          <div className="entrenamiento-columna-principal">
            <section className="entrenamiento-panel">
              <div className="entrenamiento-panel-titulo">
                <span>01</span>
                <div>
                  <h1>OpenField</h1>
                  <p>Primero validamos que la app pueda comunicarse con Cloud Editor.</p>
                </div>
              </div>

              <div className="entrenamiento-conexion">
                <div>
                  <span className="entrenamiento-estado-punto pendiente" aria-hidden="true" />
                  <div>
                    <strong>Conexión pendiente</strong>
                    <span>Playwright todavía no está conectado a OpenField.</span>
                  </div>
                </div>
                <span className="entrenamiento-modo-chip">SOLO LECTURA</span>
              </div>

              <div className="entrenamiento-siguiente">
                <strong>Objetivo de este paso</strong>
                <span>
                  Poder abrir OpenField desde el backend, comprobar que la sesión esté
                  autenticada y leer las actividades disponibles sin crear, editar ni borrar
                  períodos.
                </span>
              </div>
            </section>

            <section className="entrenamiento-panel entrenamiento-panel-bloqueado">
              <div className="entrenamiento-panel-titulo">
                <span>02</span>
                <div>
                  <h2>Elegir actividad</h2>
                  <p>Después de conectar, acá aparecerán las actividades de OpenField.</p>
                </div>
              </div>

              <div className="entrenamiento-vacio">
                Primero tenemos que completar la conexión con OpenField. Si hay una sola
                actividad válida en la fecha, podremos proponerla automáticamente; si hay
                varias, vas a elegir cuál usar antes de continuar.
              </div>
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
                <p>Esto será lo que luego reciba Playwright.</p>
              </div>
            </div>

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

                <div className="entrenamiento-siguiente">
                  <strong>Todavía no se puede aplicar</strong>
                  <span>
                    El corte está bien calculado, pero falta conectar OpenField y elegir una
                    actividad real. Hasta entonces la app no envía ninguna modificación.
                  </span>
                </div>
              </>
            ) : (
              <div className="entrenamiento-estado pendiente">{evaluacion.error}</div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
