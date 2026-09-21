import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { leerEquipoElegido } from "./domain/equipo.js";
import {
  agregarJugador,
  cargarPlantelConCatapult,
  guardarVinculoCatapult,
} from "./domain/plantel.js";
import {
  nombreVisibleAtleta,
  normalizarNombre,
  proponerVinculos,
  resumirVinculos,
} from "../lib/vinculoJugadores.js";
import { mensajeDeRespuesta, pedirJson } from "./trainingApi.js";

const ETIQUETA_NIVEL = {
  exacto: "Coincide solo",
  probable: "Parecido, revisalo",
};

const plural = (cantidad, singular, muchos) => `${cantidad} ${cantidad === 1 ? singular : muchos}`;

// La misma lista de jugadores que Partido. Cada jugador se empareja una vez
// con su chaleco para que los datos lleguen a la persona correcta.
export default function TrainingJugadores({ onVolver }) {
  const equipo = useMemo(() => leerEquipoElegido(), []);
  const equipoId = equipo?.id || null;

  const [estado, setEstado] = useState("cargando");
  const [plantel, setPlantel] = useState([]);
  const [errorCarga, setErrorCarga] = useState("");
  const [errorPlantel, setErrorPlantel] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const temporizadorAviso = useRef(null);

  const [nombreNuevo, setNombreNuevo] = useState("");
  const [agregando, setAgregando] = useState(false);

  const [estadoAtletas, setEstadoAtletas] = useState("idle");
  const [atletas, setAtletas] = useState([]);
  const [elecciones, setElecciones] = useState({});
  const [guardando, setGuardando] = useState(false);

  const avisar = (texto) => {
    setAviso(texto);
    if (temporizadorAviso.current) window.clearTimeout(temporizadorAviso.current);
    temporizadorAviso.current = window.setTimeout(() => setAviso(""), 2600);
  };

  useEffect(
    () => () => {
      if (temporizadorAviso.current) window.clearTimeout(temporizadorAviso.current);
    },
    [],
  );

  const cargar = async () => {
    setEstado("cargando");
    setErrorCarga("");

    try {
      const resultado = await cargarPlantelConCatapult(equipoId);
      if (resultado.error) {
        setPlantel([]);
        setEstado("error");
        setErrorCarga(resultado.error);
        return;
      }
      setPlantel(resultado.plantel);
      setEstado("listo");
    } catch (errorLectura) {
      setPlantel([]);
      setEstado("error");
      setErrorCarga(errorLectura?.message || "No se pudo leer la lista de jugadores.");
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
    if (agregando) return;
    if (!nombre) {
      setErrorPlantel("Escribí un nombre.");
      return;
    }
    if (plantel.some((jugador) => normalizarNombre(jugador.nombre) === normalizarNombre(nombre))) {
      setErrorPlantel("Ese jugador ya está en la lista.");
      return;
    }

    setAgregando(true);
    setErrorPlantel("");

    try {
      const resultado = await agregarJugador(nombre, equipoId);
      if (resultado.error) {
        setErrorPlantel(resultado.error);
      } else {
        setNombreNuevo("");
        avisar(`${nombre} agregado a la lista (también en Partido).`);
        await cargar();
      }
    } finally {
      setAgregando(false);
    }
  };

  const traerAtletas = async () => {
    setEstadoAtletas("cargando");
    setError("");

    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/atletas");
      if (!respuesta.ok || !payload?.ok) {
        throw new Error(mensajeDeRespuesta(payload, "No se pudieron leer los chalecos."));
      }

      const lista = Array.isArray(payload.atletas) ? payload.atletas : [];
      setAtletas(lista);

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
      setError(errorAtletas?.message || "No se pudieron leer los chalecos.");
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
    if (guardados > 0) avisar(`${plural(guardados, "cambio guardado", "cambios guardados")}.`);
    await cargar();
  };

  const opcionesAtletas = useMemo(
    () =>
      [...atletas].sort((a, b) => nombreVisibleAtleta(a).localeCompare(nombreVisibleAtleta(b), "es")),
    [atletas],
  );

  const conChaleco = plantel.filter((jugador) => jugador.catapult_id).length;

  const estadoDeFila = (jugador) => {
    if (estadoAtletas !== "listo") {
      return jugador.catapult_id
        ? { texto: `Chaleco: ${jugador.catapult_nombre || jugador.catapult_id}`, tono: "ok" }
        : { texto: "Sin chaleco", tono: "" };
    }

    const fila = filas.find((f) => f.jugadorId === jugador.id);
    const eleccion = elecciones[jugador.id] ?? (jugador.catapult_id || "");

    if (eleccion && eleccionesRepetidas.has(eleccion)) return { texto: "Repetido", tono: "error" };
    if (!eleccion) return { texto: "Sin chaleco", tono: "" };
    if (fila?.vinculo && eleccion === fila.vinculo.atletaId) {
      return fila.vinculo.ausente
        ? { texto: "Ese chaleco ya no existe", tono: "error" }
        : { texto: "Guardado", tono: "ok" };
    }
    if (fila?.propuesta && eleccion === fila.propuesta.atletaId) {
      return {
        texto: ETIQUETA_NIVEL[fila.propuesta.nivel],
        tono: fila.propuesta.nivel === "exacto" ? "ok" : "",
      };
    }
    return { texto: "Elegido a mano", tono: "ok" };
  };

  const etiquetaGuardar = guardando
    ? "Guardando…"
    : cambios.length === 0
      ? "Sin cambios para guardar"
      : `Guardar ${plural(cambios.length, "cambio", "cambios")}`;

  return (
    <div className="app">
      <div className="contenedor">
        <header className="encabezado">
          <h1>Lista de jugadores</h1>
          <p>Ajustes · Lista de jugadores</p>
        </header>

        {aviso && (
          <div className="notificacion-guardado" role="status">
            <Icono nombre="check" size={18} /> {aviso}
          </div>
        )}

        {!equipoId && (
          <div className="aviso-base">
            <div>
              <b>Primero elegí tu equipo</b>
              <p>Hacelo en Partido › Ajustes › Equipo y volvé.</p>
            </div>
          </div>
        )}

        <section className="tarjeta tarjeta-ficha">
          <div className="cabeza-ficha">
            <b>Plantel</b>
            <span className="cuenta-ajuste">{plantel.length}</span>
          </div>

          <p className="pista-equipo">
            La misma lista que Partido. Cada jugador se empareja una vez con su chaleco para que los
            datos lleguen a la persona correcta.
          </p>

          {estado === "cargando" && <p className="vacio-ficha">Leyendo la lista…</p>}

          {estado === "error" && (
            <>
              <p className="error-equipo">{errorCarga}</p>
              <button type="button" className="boton-texto" onClick={cargar}>
                Reintentar
              </button>
            </>
          )}

          {estado === "listo" && (
            <>
              <p className="pista-equipo">
                {plural(plantel.length, "jugador", "jugadores")} · {conChaleco} con chaleco
              </p>

              <div className="agregar-jugador">
                <input
                  type="text"
                  value={nombreNuevo}
                  placeholder="Nombre del jugador"
                  onChange={(event) => {
                    setNombreNuevo(event.target.value);
                    if (errorPlantel) setErrorPlantel("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") sumarJugador();
                  }}
                  disabled={agregando}
                />
                <button type="button" onClick={sumarJugador} disabled={agregando}>
                  {agregando ? "Agregando…" : "Agregar"}
                </button>
              </div>

              {errorPlantel && <p className="error-equipo">{errorPlantel}</p>}

              {plantel.length === 0 ? (
                <p className="vacio-ficha">Todavía no hay jugadores cargados.</p>
              ) : (
                <ul className="lista-plantel">
                  {plantel.map((jugador, indice) => {
                    const estadoFila = estadoDeFila(jugador);
                    const eleccion = elecciones[jugador.id] ?? (jugador.catapult_id || "");

                    return (
                      <li key={jugador.id ?? jugador.nombre}>
                        <span className="numero-lista">{indice + 1}</span>
                        <span className="nombre-lista">{jugador.nombre}</span>
                        <span className={`estado-vinculo ${estadoFila.tono}`.trim()}>{estadoFila.texto}</span>

                        {estadoAtletas === "listo" && (
                          <select
                            className="selector-chaleco"
                            aria-label={`Chaleco de ${jugador.nombre}`}
                            value={eleccion}
                            onChange={(event) =>
                              setElecciones((actuales) => ({ ...actuales, [jugador.id]: event.target.value }))
                            }
                            disabled={guardando}
                          >
                            <option value="">— Sin chaleco —</option>
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
              )}
            </>
          )}
        </section>

        {estado === "listo" && (
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>Emparejar con los chalecos</b>
            </div>

            <p className="pista-equipo">
              Busca los chalecos de las últimas sesiones y propone quién es quién. Después guardás.
            </p>

            {estadoAtletas !== "listo" && (
              <button
                type="button"
                className="boton-principal"
                onClick={traerAtletas}
                disabled={estadoAtletas === "cargando" || plantel.length === 0}
              >
                {estadoAtletas === "cargando" ? "Buscando…" : "Buscar chalecos"}
              </button>
            )}

            {estadoAtletas === "listo" && (
              <p className="pista-equipo">
                {plural(atletas.length, "chaleco encontrado", "chalecos encontrados")} ·{" "}
                {plural(resumen.exactos, "coincide solo", "coinciden solos")} ·{" "}
                {plural(resumen.probables, "parecido", "parecidos")} · {resumen.sinPropuesta} sin propuesta ·{" "}
                {plural(resumen.ausentes, "ya no existe", "ya no existen")}
              </p>
            )}

            {eleccionesRepetidas.size > 0 && (
              <p className="error-equipo">Hay un chaleco elegido para más de un jugador. Corregilo antes de guardar.</p>
            )}
            {error && <p className="error-equipo">{error}</p>}

            {estadoAtletas === "listo" && (
              <button
                type="button"
                className="boton-principal"
                onClick={guardarVinculos}
                disabled={cambios.length === 0 || guardando || eleccionesRepetidas.size > 0}
              >
                {etiquetaGuardar}
              </button>
            )}
          </section>
        )}

        <div className="acciones-dobles">
          <BotonVolver onClick={onVolver}>Volver a Ajustes</BotonVolver>
        </div>
      </div>
    </div>
  );
}
