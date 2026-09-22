import React, { useEffect, useMemo, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { horaCorta, leerJson, marcaAFecha } from "./TrainingApp.jsx";
import { hoyLocal } from "./domain/sesionEntrenamiento.js";

const esHoy = (fecha, ahora = new Date()) =>
  Boolean(fecha) &&
  fecha.getFullYear() === ahora.getFullYear() &&
  fecha.getMonth() === ahora.getMonth() &&
  fecha.getDate() === ahora.getDate();

// "Hoy 16:12" | "26/05 16:12" | "Sin horario".
const cuandoEmpieza = (valor) => {
  const fecha = marcaAFecha(valor);
  if (!fecha) return "Sin horario";
  const dia = esHoy(fecha)
    ? "Hoy"
    : `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}`;
  return `${dia} ${horaCorta(valor)}`;
};

// "1 h 53 min" | "53 min".
const duracionDe = (item) => {
  const inicio = Number(item?.start_time);
  const fin = Number(item?.end_time);
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) return "";
  const minutos = Math.round((fin - inicio) / 60);
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return horas > 0 ? `${horas} h ${String(resto).padStart(2, "0")} min` : `${resto} min`;
};

const bloquesDe = (item) => {
  const cantidad = Number(item?.period_count);
  if (!Number.isFinite(cantidad)) return "";
  return `${cantidad} ${cantidad === 1 ? "bloque" : "bloques"}`;
};

const detalleDe = (item) => [cuandoEmpieza(item?.start_time), duracionDe(item), bloquesDe(item)].filter(Boolean).join(" · ");

// La lista de sesiones de OpenField para elegir a cuál van los cortes. Se
// busca sola al entrar; se muestran las más recientes y se filtra escribiendo.
// Con la fecha del entrenamiento, las sesiones de ese día van primero.
export default function TrainingElegirSesion({
  actividad = null,
  fecha = "",
  titulo = "Elegir sesión",
  subtitulo = "Sesión · Elegir",
  etiquetaVolver = "Volver a Sesión",
  onSeleccionar,
  onVolver,
}) {
  const [estado, setEstado] = useState("cargando");
  const [actividades, setActividades] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  const buscarSesiones = async () => {
    setEstado("cargando");

    try {
      const { respuesta, payload } = await leerJson("/api/openfield/activities");
      if (!respuesta.ok || !payload?.ok) throw new Error("sesiones");

      setActividades(Array.isArray(payload.activities) ? payload.activities : []);
      setEstado("listo");
    } catch {
      setActividades([]);
      setEstado("error");
    }
  };

  useEffect(() => {
    buscarSesiones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const texto = busqueda.trim().toLowerCase();
  const filtradas = useMemo(() => {
    const base = texto
      ? actividades.filter((item) =>
          [item.name, item.id, item.venue]
            .filter(Boolean)
            .some((valor) => String(valor).toLowerCase().includes(texto)),
        )
      : actividades;

    const delDia = (item) => {
      const inicio = marcaAFecha(item?.start_time);
      return Boolean(fecha) && Boolean(inicio) && hoyLocal(inicio) === fecha;
    };
    const ordenadas = fecha
      ? base.map((item, orden) => ({ item, orden })).sort((a, b) => Number(delDia(b.item)) - Number(delDia(a.item)) || a.orden - b.orden).map(({ item }) => item)
      : base;

    return ordenadas.slice(0, texto ? 50 : 20);
  }, [actividades, texto, fecha]);

  const elegir = (item) => {
    onSeleccionar({
      id: item.id,
      name: item.name,
      start_time: item.start_time,
      end_time: item.end_time,
    });
  };

  return (
    <div className="app">
      <div className="contenedor">
        <header className="encabezado">
          <h1>{titulo}</h1>
          <p>{subtitulo}</p>
        </header>

        <section className="tarjeta tarjeta-ficha">
          <div className="cabeza-ficha">
            <b>Sesiones recientes</b>
            <span className="cuenta-ajuste">{actividades.length}</span>
          </div>

          {estado === "listo" && (
            <input
              className="buscador-plantel"
              type="search"
              value={busqueda}
              placeholder="Buscar por nombre o lugar"
              aria-label="Buscar sesión"
              onChange={(evento) => setBusqueda(evento.target.value)}
            />
          )}

          {estado === "cargando" && <p className="vacio-ficha">Buscando las sesiones…</p>}

          {estado === "error" && (
            <div className="aviso-base">
              <div>
                <b>No se pudieron cargar las sesiones</b>
                <p>Fijate la señal y probá de nuevo.</p>
              </div>
              <button type="button" onClick={buscarSesiones}>
                Reintentar
              </button>
            </div>
          )}

          {estado === "listo" && filtradas.length === 0 && (
            <p className="vacio-ficha">No hay sesiones con ese nombre.</p>
          )}

          {estado === "listo" && filtradas.length > 0 && (
            <ul className="lista-equipos">
              {filtradas.map((item) => {
                const seleccionada = item.id === actividad?.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`entrenamiento-actividad ${seleccionada ? "seleccionada" : ""}`}
                      onClick={() => elegir(item)}
                      aria-pressed={seleccionada}
                    >
                      <Icono nombre="reloj" size={18} />
                      <span className="texto-ajuste">
                        <b>{item.name || "Sin nombre"}</b>
                        <span>{detalleDe(item)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {estado === "listo" && !texto && actividades.length > 20 && (
            <p className="pista-equipo">Se muestran las 20 más recientes. Escribí para buscar otra.</p>
          )}
        </section>

        <div className="acciones-dobles">
          <BotonVolver onClick={onVolver}>{etiquetaVolver}</BotonVolver>
        </div>
      </div>
    </div>
  );
}
