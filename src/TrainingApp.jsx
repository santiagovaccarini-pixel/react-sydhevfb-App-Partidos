import React, { useEffect, useMemo, useRef, useState } from "react";

// Lectura sin sesión de la app: estas rutas solo necesitan el acceso que ya
// tiene el servidor. Se conserva tal cual (método, cabeceras y caché).
export const leerJson = async (url) => {
  const respuesta = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload = await respuesta.json().catch(() => null);
  return { respuesta, payload };
};

// El servidor informa segundos o milisegundos según la ruta.
export const marcaAFecha = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return null;

  const fecha = new Date(numero < 1e12 ? numero * 1000 : numero);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

// "16:15", en la hora del celular.
export const horaCorta = (valor) => {
  const fecha = marcaAFecha(valor);
  if (!fecha) return "";
  return `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
};

const numeroDeBloque = (indice) => String(indice + 1).padStart(2, "0");

const textoDeJugadores = (detalle) => {
  const lista = Array.isArray(detalle?.athletes) ? detalle.athletes : [];
  if (lista.length === 0) return "Sin jugadores";

  const nombres = [...lista]
    .sort((a, b) => String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es"))
    .map((jugador) => (jugador?.jersey != null ? `${jugador.jersey} · ${jugador.nombre}` : jugador?.nombre || ""))
    .filter(Boolean);

  return `${lista.length} ${lista.length === 1 ? "jugador" : "jugadores"}: ${nombres.join(", ")}`;
};

// Los bloques que hoy tiene la sesión, tal como los ve el servidor. Se leen al
// elegir la sesión; los jugadores de cada bloque se leen enseguida, aparte,
// para mostrar cuántos hay; los nombres quedan plegados.
export default function TrainingBloques({ actividad = null }) {
  const [estadoBloques, setEstadoBloques] = useState("idle");
  const [bloques, setBloques] = useState([]);
  const solicitudBloquesRef = useRef(0);

  const [estadoJugadores, setEstadoJugadores] = useState("idle");
  const [jugadoresPorBloque, setJugadoresPorBloque] = useState(null);
  const solicitudJugadoresRef = useRef(0);

  const detallePorBloque = useMemo(
    () => new Map((jugadoresPorBloque?.periods || []).map((bloque) => [bloque.id, bloque])),
    [jugadoresPorBloque],
  );

  // Los jugadores quedan viejos apenas cambian los bloques.
  const descartarJugadores = () => {
    solicitudJugadoresRef.current += 1;
    setJugadoresPorBloque(null);
    setEstadoJugadores("idle");
  };

  const cargarBloques = async (activityId) => {
    if (!activityId) return;

    const solicitudActual = solicitudBloquesRef.current + 1;
    solicitudBloquesRef.current = solicitudActual;
    setEstadoBloques("cargando");
    setBloques([]);
    descartarJugadores();

    try {
      const { respuesta, payload } = await leerJson(
        `/api/openfield/periods?activityId=${encodeURIComponent(activityId)}`,
      );

      if (!respuesta.ok || !payload?.ok) throw new Error("bloques");
      if (solicitudActual !== solicitudBloquesRef.current) return;

      const lista = Array.isArray(payload.periods) ? payload.periods : [];
      setBloques(lista);
      setEstadoBloques("listo");
      // La cantidad de jugadores de cada bloque se lee enseguida, aparte.
      if (lista.length > 0) cargarJugadores(activityId);
    } catch {
      if (solicitudActual !== solicitudBloquesRef.current) return;
      setBloques([]);
      setEstadoBloques("error");
    }
  };

  const cargarJugadores = async (activityId) => {
    if (!activityId) return;

    const solicitudActual = solicitudJugadoresRef.current + 1;
    solicitudJugadoresRef.current = solicitudActual;
    setEstadoJugadores("cargando");

    try {
      const { respuesta, payload } = await leerJson(
        `/api/openfield/snapshot?activityId=${encodeURIComponent(activityId)}`,
      );

      if (!respuesta.ok || !payload?.ok) throw new Error("jugadores");
      if (solicitudActual !== solicitudJugadoresRef.current) return;

      setJugadoresPorBloque(payload);
      setEstadoJugadores("listo");
    } catch {
      if (solicitudActual !== solicitudJugadoresRef.current) return;
      setJugadoresPorBloque(null);
      setEstadoJugadores("error");
    }
  };

  useEffect(() => {
    if (actividad?.id) {
      cargarBloques(actividad.id);
    } else {
      solicitudBloquesRef.current += 1;
      descartarJugadores();
      setBloques([]);
      setEstadoBloques("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividad?.id]);

  const leyendoBloques = estadoBloques === "cargando";
  const bloquesListos = estadoBloques === "listo";
  const leyendoJugadores = estadoJugadores === "cargando";
  const jugadoresListos = estadoJugadores === "listo" && Boolean(jugadoresPorBloque);

  return (
    <section className="tarjeta tarjeta-ficha">
      <div className="cabeza-ficha">
        <b>Bloques de la sesión</b>
        <span className="cuenta-ajuste">{bloquesListos ? bloques.length : "–"}</span>
        <button
          type="button"
          className="boton-texto"
          onClick={() => cargarBloques(actividad?.id)}
          disabled={leyendoBloques || !actividad?.id}
        >
          {leyendoBloques ? "Leyendo…" : "Actualizar"}
        </button>
      </div>

      {leyendoBloques && <p className="vacio-ficha">Leyendo los bloques…</p>}

      {estadoBloques === "error" && (
        <p className="error-equipo">No se pudieron leer los bloques. Fijate la señal y tocá Actualizar.</p>
      )}

      {bloquesListos && bloques.length === 0 && (
        <p className="vacio-ficha">Esta sesión todavía no tiene bloques.</p>
      )}

      {bloquesListos && bloques.length > 0 && (
        <>
          {bloques.map((bloque, indice) => {
            const detalle = detallePorBloque.get(bloque.id);
            const cantidad = Array.isArray(detalle?.athletes) ? detalle.athletes.length : null;
            return (
              <div className="dato-detalle" key={bloque.id ?? indice}>
                <span>
                  {numeroDeBloque(indice)} · {bloque.name || "Sin nombre"}
                  <small className="jugadores-bloque">
                    {cantidad !== null
                      ? `${cantidad} ${cantidad === 1 ? "jugador" : "jugadores"}`
                      : leyendoJugadores
                        ? "leyendo jugadores…"
                        : estadoJugadores === "error"
                          ? "jugadores sin leer"
                          : ""}
                  </small>
                </span>
                <strong>
                  {horaCorta(bloque.start_ms ?? bloque.start_time) || "--:--"} →{" "}
                  {horaCorta(bloque.end_ms ?? bloque.end_time) || "--:--"}
                </strong>
              </div>
            );
          })}

          <details className="ajustes-periodo">
            <summary>Ver quiénes están en cada bloque</summary>
            <div className="contenido-ajustes-periodo">
              <button
                type="button"
                className="boton-texto"
                onClick={() => cargarJugadores(actividad?.id)}
                disabled={leyendoJugadores}
              >
                {leyendoJugadores ? "Leyendo…" : jugadoresListos ? "Volver a leer" : "Leer jugadores"}
              </button>

              {estadoJugadores === "error" && (
                <p className="error-equipo">No se pudieron leer los jugadores.</p>
              )}

              {jugadoresListos &&
                bloques.map((bloque, indice) => (
                  <div key={`jugadores-${bloque.id ?? indice}`}>
                    <b>{bloque.name || "Sin nombre"}</b>
                    <p className="pista-equipo">{textoDeJugadores(detallePorBloque.get(bloque.id))}</p>
                  </div>
                ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
