import React, { useEffect, useMemo, useState } from "react";
import { leerEquipoElegido } from "./domain/equipo.js";
import {
  agregarJugador,
  cargarPlantelConCatapult,
  guardarVinculoCatapult,
} from "./domain/plantel.js";
import { nombreVisibleAtleta, proponerVinculos, resumirVinculos } from "../lib/vinculoJugadores.js";
import { mensajeDeRespuesta, pedirJson } from "./trainingApi.js";

const ETIQUETA_NIVEL = {
  exacto: "Propuesta exacta",
  probable: "Probable, revisá",
};

// La misma lista de jugadores que Partido, con el vínculo de cada uno a su
// atleta de Catapult. Se vincula una vez y queda guardado.
export default function TrainingJugadores() {
  const equipo = useMemo(() => leerEquipoElegido(), []);
  const equipoId = equipo?.id || null;

  const [estado, setEstado] = useState("cargando");
  const [plantel, setPlantel] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [nombreNuevo, setNombreNuevo] = useState("");
  const [agregando, setAgregando] = useState(false);

  const [estadoAtletas, setEstadoAtletas] = useState("idle");
  const [atletas, setAtletas] = useState([]);
  const [fuenteAtletas, setFuenteAtletas] = useState("");
  const [elecciones, setElecciones] = useState({});
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setEstado("cargando");
    setError("");

    try {
      const resultado = await cargarPlantelConCatapult(equipoId);
      if (resultado.error) {
        setPlantel([]);
        setEstado("error");
        setError(resultado.error);
        return;
      }
      setPlantel(resultado.plantel);
      setEstado("listo");
    } catch (errorCarga) {
      setPlantel([]);
      setEstado("error");
      setError(errorCarga?.message || "No se pudo leer la lista de jugadores.");
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoId]);

  const filas = useMemo(
    () => (atletas.length > 0 ? proponerVinculos({ jugadores: plantel, atletas }) : []),
    [plantel, atletas],
  );
  const resumen = useMemo(() => resumirVinculos(filas), [filas]);

  const sumarJugador = async () => {
    const nombre = nombreNuevo.trim();
    if (!nombre || agregando) return;

    setAgregando(true);
    setMensaje("");
    setError("");

    try {
      const resultado = await agregarJugador(nombre, equipoId);
      if (resultado.error) {
        setError(resultado.error);
      } else {
        setNombreNuevo("");
        setMensaje(`${nombre} agregado a la lista (también en Partido).`);
        await cargar();
      }
    } finally {
      setAgregando(false);
    }
  };

  const traerAtletas = async () => {
    setEstadoAtletas("cargando");
    setError("");
    setMensaje("");

    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/atletas");
      if (!respuesta.ok || !payload?.ok) {
        throw new Error(mensajeDeRespuesta(payload, "No se pudieron leer los atletas de Catapult."));
      }

      const lista = Array.isArray(payload.atletas) ? payload.atletas : [];
      setAtletas(lista);
      setFuenteAtletas(payload.fuente || "");

      // Punto de partida: lo guardado; si no hay, la propuesta.
      const propuestas = proponerVinculos({ jugadores: plantel, atletas: lista });
      const iniciales = {};
      propuestas.forEach((fila) => {
        iniciales[fila.jugadorId] = fila.vinculo?.atletaId || fila.propuesta?.atletaId || "";
      });
      setElecciones(iniciales);
      setEstadoAtletas("listo");
    } catch (errorAtletas) {
      setAtletas([]);
      setEstadoAtletas("error");
      setError(errorAtletas?.message || "No se pudieron leer los atletas de Catapult.");
    }
  };

  const cambios = useMemo(
    () =>
      plantel.filter((jugador) => {
        if (!(jugador.id in elecciones)) return false;
        return (elecciones[jugador.id] || "") !== (jugador.catapult_id || "");
      }),
    [plantel, elecciones],
  );

  const eleccionesRepetidas = useMemo(() => {
    const usos = new Map();
    Object.values(elecciones).forEach((atletaId) => {
      if (atletaId) usos.set(atletaId, (usos.get(atletaId) || 0) + 1);
    });
    return new Set([...usos.entries()].filter(([, veces]) => veces > 1).map(([id]) => id));
  }, [elecciones]);

  const guardarVinculos = async () => {
    if (cambios.length === 0 || guardando || eleccionesRepetidas.size > 0) return;

    setGuardando(true);
    setError("");
    setMensaje("");

    const atletasPorId = new Map(atletas.map((atleta) => [String(atleta.id), atleta]));
    const errores = [];
    let guardados = 0;

    for (const jugador of cambios) {
      const atletaId = elecciones[jugador.id] || "";
      const atleta = atletaId ? atletasPorId.get(atletaId) : null;
      // eslint-disable-next-line no-await-in-loop
      const resultado = await guardarVinculoCatapult(jugador.id, {
        catapultId: atletaId || null,
        catapultNombre: atleta ? nombreVisibleAtleta(atleta) : "",
      });
      if (resultado.error) errores.push(`${jugador.nombre}: ${resultado.error}`);
      else guardados += 1;
    }

    setGuardando(false);
    if (errores.length > 0) setError(errores.join(" · "));
    setMensaje(guardados > 0 ? `${guardados} vínculo${guardados === 1 ? "" : "s"} guardado${guardados === 1 ? "" : "s"}.` : "");
    await cargar();
  };

  const opcionesAtletas = useMemo(
    () =>
      [...atletas].sort((a, b) => nombreVisibleAtleta(a).localeCompare(nombreVisibleAtleta(b), "es")),
    [atletas],
  );

  return (
    <>
      {!equipoId && (
        <div className="entrenamiento-estado advertencia">
          No hay un equipo elegido en Partido. Elegí el equipo en Partido → Ajustes → Equipo y volvé.
        </div>
      )}

      {estado === "cargando" && (
        <div className="entrenamiento-ajustes-resultado" aria-live="polite">
          <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
          <div>
            <strong>Leyendo la lista…</strong>
            <span>Es la misma lista de jugadores de Partido.</span>
          </div>
        </div>
      )}

      {estado === "error" && (
        <>
          <div className="entrenamiento-estado error">{error}</div>
          <button type="button" className="entrenamiento-boton-secundario entrenamiento-ajustes-boton-ancho" onClick={cargar}>
            Reintentar
          </button>
        </>
      )}

      {estado === "listo" && (
        <>
          <div className="entrenamiento-sonda-tokens">
            <span className="entrenamiento-sonda-chip">{plantel.length} jugadores</span>
            <span className={`entrenamiento-sonda-chip ${plantel.some((j) => !j.catapult_id) ? "advertencia" : "correcto"}`}>
              {plantel.filter((j) => j.catapult_id).length} vinculados con Catapult
            </span>
            {equipo?.nombre && <span className="entrenamiento-sonda-chip">{equipo.nombre}</span>}
          </div>

          <div className="entrenamiento-jugadores-agregar">
            <input
              type="text"
              value={nombreNuevo}
              placeholder="Agregar jugador (también aparece en Partido)"
              onChange={(event) => setNombreNuevo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sumarJugador();
              }}
              disabled={agregando}
            />
            <button type="button" className="entrenamiento-boton-secundario" onClick={sumarJugador} disabled={agregando || !nombreNuevo.trim()}>
              {agregando ? "Agregando…" : "Agregar"}
            </button>
          </div>

          {mensaje && <div className="entrenamiento-estado correcto">{mensaje}</div>}
          {error && <div className="entrenamiento-estado error">{error}</div>}

          {estadoAtletas !== "listo" && (
            <button
              type="button"
              className="entrenamiento-boton-principal"
              onClick={traerAtletas}
              disabled={estadoAtletas === "cargando" || plantel.length === 0}
            >
              {estadoAtletas === "cargando" ? "Leyendo atletas de Catapult…" : "Vincular con Catapult"}
            </button>
          )}

          {estadoAtletas === "listo" && (
            <>
              <p className="entrenamiento-sonda-control">
                {atletas.length} atletas en Catapult
                {fuenteAtletas === "actividades" ? " (de las últimas actividades)" : ""} ·{" "}
                {resumen.exactos} propuestas exactas · {resumen.probables} probables · {resumen.sinPropuesta} sin
                propuesta{resumen.ausentes > 0 ? ` · ${resumen.ausentes} con atleta que ya no está` : ""}
              </p>

              {eleccionesRepetidas.size > 0 && (
                <div className="entrenamiento-estado error">
                  Hay un atleta elegido para más de un jugador. Corregilo antes de guardar.
                </div>
              )}

              <button
                type="button"
                className="entrenamiento-boton-principal"
                onClick={guardarVinculos}
                disabled={cambios.length === 0 || guardando || eleccionesRepetidas.size > 0}
              >
                {guardando
                  ? "Guardando…"
                  : cambios.length === 0
                    ? "Sin cambios para guardar"
                    : `Guardar ${cambios.length} vínculo${cambios.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}

          <ul className="entrenamiento-jugadores-lista">
            {plantel.map((jugador) => {
              const fila = filas.find((f) => f.jugadorId === jugador.id);
              const eleccion = elecciones[jugador.id] ?? (jugador.catapult_id || "");
              const repetida = eleccion && eleccionesRepetidas.has(eleccion);

              return (
                <li key={jugador.id ?? jugador.nombre}>
                  <div className="entrenamiento-jugadores-fila">
                    <strong>{jugador.nombre}</strong>
                    {estadoAtletas !== "listo" ? (
                      <span className={`entrenamiento-sonda-chip ${jugador.catapult_id ? "correcto" : "advertencia"}`}>
                        {jugador.catapult_id ? `Catapult: ${jugador.catapult_nombre || jugador.catapult_id}` : "Sin vincular"}
                      </span>
                    ) : (
                      <span
                        className={`entrenamiento-sonda-chip ${
                          repetida ? "error" : eleccion ? (fila?.vinculo && !fila.vinculo.ausente ? "correcto" : fila?.propuesta?.nivel === "exacto" ? "correcto" : "advertencia") : "advertencia"
                        }`}
                      >
                        {repetida
                          ? "Repetido"
                          : fila?.vinculo && !fila.vinculo.ausente && eleccion === fila.vinculo.atletaId
                            ? "Guardado"
                            : fila?.vinculo?.ausente && eleccion === fila.vinculo.atletaId
                              ? "El atleta ya no está en Catapult"
                              : eleccion && fila?.propuesta && eleccion === fila.propuesta.atletaId
                                ? ETIQUETA_NIVEL[fila.propuesta.nivel]
                                : eleccion
                                  ? "Elegido a mano"
                                  : "Sin vincular"}
                      </span>
                    )}
                  </div>

                  {estadoAtletas === "listo" && (
                    <select
                      aria-label={`Atleta de Catapult para ${jugador.nombre}`}
                      value={eleccion}
                      onChange={(event) =>
                        setElecciones((actuales) => ({ ...actuales, [jugador.id]: event.target.value }))
                      }
                      disabled={guardando}
                    >
                      <option value="">— Sin vincular —</option>
                      {opcionesAtletas.map((atleta) => (
                        <option key={atleta.id} value={String(atleta.id)}>
                          {nombreVisibleAtleta(atleta)}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
