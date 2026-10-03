import React, { useEffect, useMemo, useState } from "react";
import { actualesPrimero, cargarPlantelConCatapult, esActual, guardarVinculoCatapult } from "../domain/plantel.js";
import { nombreVisibleAtleta, proponerVinculos, resumirVinculos } from "../../lib/vinculoJugadores.js";
import { mensajeDeRespuesta, pedirJson } from "../trainingApi.js";
import { t, useIdioma } from "../idioma/index.js";

// Cada jugador con su chaleco de Catapult, para que los datos de Flujo diario
// lleguen a la persona correcta. Es lo que estaba en Flujo diario › Ajustes ›
// Lista de jugadores, igual, ahora en Datos básicos (los jugadores se agregan
// y se borran en la tabla de Datos básicos).

// equipoId; soloLectura: quien ya se fue del club ve los vínculos y no los
// cambia; onAviso(texto): un aviso corto al guardar.
export const VinculosCatapult = ({ equipoId, soloLectura = false, onAviso = () => {} }) => {
  const { plural } = useIdioma();
  const [estado, setEstado] = useState("cargando");
  const [plantel, setPlantel] = useState([]);
  const [errorCarga, setErrorCarga] = useState("");
  const [error, setError] = useState("");
  const [estadoAtletas, setEstadoAtletas] = useState("idle");
  const [atletas, setAtletas] = useState([]);
  const [elecciones, setElecciones] = useState({});
  const [guardando, setGuardando] = useState(false);

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
      setErrorCarga(errorLectura?.message || t("datos.catapult.noLeer"));
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoId]);

  // A quien ya no está en el plantel actual no se le propone un chaleco
  // (su chaleco guardado se ve igual).
  const conPropuestas = (jugadores, lista) => {
    const actuales = new Set(jugadores.filter(esActual).map((jugador) => jugador.id));
    return proponerVinculos({ jugadores, atletas: lista }).map((fila) => (actuales.has(fila.jugadorId) ? fila : { ...fila, propuesta: null }));
  };
  const filas = useMemo(() => (atletas.length > 0 ? conPropuestas(plantel, atletas) : []), [plantel, atletas]);
  const resumen = useMemo(() => resumirVinculos(filas), [filas]);

  const traerAtletas = async () => {
    setEstadoAtletas("cargando");
    setError("");
    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/atletas");
      if (!respuesta.ok || !payload?.ok) throw new Error(mensajeDeRespuesta(payload, t("datos.catapult.noChalecos")));
      const lista = Array.isArray(payload.atletas) ? payload.atletas : [];
      setAtletas(lista);
      // Punto de partida: lo guardado; si no hay, la propuesta.
      const iniciales = {};
      const actuales = new Set(plantel.filter(esActual).map((jugador) => jugador.id));
      conPropuestas(plantel, lista).forEach((fila) => {
        // Un chaleco guardado que ya no existe arranca en "Sin chaleco", así
        // guardar lo desvincula. El de quien ya se fue queda (sus sesiones
        // viejas lo necesitan); se puede sacar a mano.
        const queda = fila.vinculo?.ausente && !actuales.has(fila.jugadorId);
        iniciales[fila.jugadorId] = queda ? fila.vinculo.atletaId : fila.vinculo?.ausente ? "" : fila.vinculo?.atletaId || fila.propuesta?.atletaId || "";
      });
      setElecciones(iniciales);
      setEstadoAtletas("listo");
    } catch (errorAtletas) {
      setAtletas([]);
      setEstadoAtletas("error");
      setError(errorAtletas?.message || t("datos.catapult.noChalecos"));
    }
  };

  const cambios = useMemo(
    () => plantel.filter((jugador) => jugador.id in elecciones && (elecciones[jugador.id] || "") !== (jugador.catapult_id || "")),
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
      const resultado = await guardarVinculoCatapult(jugador.id, { catapultId: atletaId || null, catapultNombre: atleta ? nombreVisibleAtleta(atleta) : "" });
      if (resultado.error) errores.push(`${jugador.nombre}: ${resultado.error}`);
      else guardados += 1;
    }
    setGuardando(false);
    if (errores.length > 0) setError(errores.join(" · "));
    if (guardados > 0) onAviso(plural("datos.catapult.guardados", guardados));
    await cargar();
  };

  const opcionesAtletas = useMemo(() => [...atletas].sort((a, b) => nombreVisibleAtleta(a).localeCompare(nombreVisibleAtleta(b), "es")), [atletas]);
  const conChaleco = plantel.filter((jugador) => jugador.catapult_id).length;

  const estadoDeFila = (jugador) => {
    if (estadoAtletas !== "listo") {
      return jugador.catapult_id ? { texto: t("datos.catapult.chaleco", { chaleco: jugador.catapult_nombre || jugador.catapult_id }), tono: "ok" } : { texto: t("datos.catapult.sinChaleco"), tono: "" };
    }
    const fila = filas.find((una) => una.jugadorId === jugador.id);
    const eleccion = elecciones[jugador.id] ?? (jugador.catapult_id || "");
    if (eleccion && eleccionesRepetidas.has(eleccion)) return { texto: t("datos.catapult.repetido"), tono: "error" };
    if (!eleccion) return { texto: t("datos.catapult.sinChaleco"), tono: "" };
    if (fila?.vinculo && eleccion === fila.vinculo.atletaId) {
      return fila.vinculo.ausente ? { texto: t("datos.catapult.yaNoExiste"), tono: "error" } : { texto: t("datos.catapult.guardado"), tono: "ok" };
    }
    if (fila?.propuesta && eleccion === fila.propuesta.atletaId) {
      return fila.propuesta.nivel === "exacto" ? { texto: t("datos.catapult.exacto"), tono: "ok" } : { texto: t("datos.catapult.probable"), tono: "" };
    }
    return { texto: t("datos.catapult.aMano"), tono: "ok" };
  };

  const etiquetaGuardar = guardando
    ? t("comun.guardando")
    : cambios.length === 0
      ? t("datos.catapult.sinCambios")
      : plural("datos.catapult.guardar", cambios.length);

  return (
    <>
      <section className="tarjeta tarjeta-ficha">
        <div className="cabeza-ficha">
          <b>{t("datos.catapult.titulo")}</b>
          <span className="cuenta-ajuste">{plantel.length}</span>
        </div>
        <p className="pista-equipo">{t("datos.catapult.texto")}</p>

        {estado === "cargando" && <p className="vacio-ficha">{t("comun.cargando")}</p>}

        {estado === "error" && (
          <>
            <p className="error-equipo">{errorCarga}</p>
            <button type="button" className="boton-texto" onClick={cargar}>
              {t("comun.reintentar")}
            </button>
          </>
        )}

        {estado === "listo" && (
          <>
            <p className="pista-equipo">
              {plural("datos.jugadores", plantel.length)} · {t("datos.catapult.conChaleco", { n: conChaleco })}
            </p>
            {plantel.length === 0 ? (
              <p className="vacio-ficha">{t("datos.vacio")}</p>
            ) : (
              <ul className="lista-plantel">
                {actualesPrimero(plantel).map((jugador, indice) => {
                  const estadoFila = estadoDeFila(jugador);
                  const eleccion = elecciones[jugador.id] ?? (jugador.catapult_id || "");
                  return (
                    <li key={jugador.id ?? jugador.nombre}>
                      <span className="numero-lista">{indice + 1}</span>
                      <span className="nombre-lista">
                        {jugador.nombre}
                        {!esActual(jugador) && <small className="ya-no-esta"> · {t("datos.yaNoEsta")}</small>}
                      </span>
                      <span className={`estado-vinculo ${estadoFila.tono}`.trim()}>{estadoFila.texto}</span>
                      {estadoAtletas === "listo" && (
                        <select
                          className="selector-chaleco"
                          aria-label={t("datos.catapult.chalecoDe", { jugador: jugador.nombre })}
                          value={eleccion}
                          onChange={(evento) => setElecciones((actuales) => ({ ...actuales, [jugador.id]: evento.target.value }))}
                          disabled={guardando}
                        >
                          <option value="">{t("datos.catapult.opcionSin")}</option>
                          {/* El chaleco guardado que ya no está en la cuenta (de quien se fue). */}
                          {jugador.catapult_id && !opcionesAtletas.some((atleta) => String(atleta.id) === String(jugador.catapult_id)) && (
                            <option value={String(jugador.catapult_id)}>{jugador.catapult_nombre || jugador.catapult_id}</option>
                          )}
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

      {estado === "listo" && !soloLectura && (
        <section className="tarjeta tarjeta-ficha">
          <div className="cabeza-ficha">
            <b>{t("datos.catapult.emparejar")}</b>
          </div>
          <p className="pista-equipo">{t("datos.catapult.emparejarTexto")}</p>

          {estadoAtletas !== "listo" && (
            <button type="button" className="boton-principal" onClick={traerAtletas} disabled={estadoAtletas === "cargando" || plantel.length === 0}>
              {estadoAtletas === "cargando" ? t("datos.catapult.buscando") : t("datos.catapult.buscar")}
            </button>
          )}

          {estadoAtletas === "listo" && (
            <p className="pista-equipo">
              {t("datos.catapult.resumen", {
                chalecos: atletas.length,
                exactos: resumen.exactos,
                probables: resumen.probables,
                sinPropuesta: resumen.sinPropuesta,
                ausentes: resumen.ausentes,
              })}
            </p>
          )}

          {eleccionesRepetidas.size > 0 && <p className="error-equipo">{t("datos.catapult.hayRepetidos")}</p>}
          {error && <p className="error-equipo">{error}</p>}

          {estadoAtletas === "listo" && (
            <button type="button" className="boton-principal" onClick={guardarVinculos} disabled={cambios.length === 0 || guardando || eleccionesRepetidas.size > 0}>
              {etiquetaGuardar}
            </button>
          )}
        </section>
      )}
    </>
  );
};

export default VinculosCatapult;
