import React, { useMemo, useState } from "react";
import { Icono } from "./components/AppChrome";
import TrainingBloques from "./TrainingApp.jsx";
import {
  ETIQUETAS_ESTADO_ENTRENAMIENTO,
  fechaCorta,
  fechaLarga,
  resumenEntrenamiento,
} from "./domain/entrenamiento.js";
import { hoyLocal } from "./domain/sesionEntrenamiento.js";

const primeraMayuscula = (texto) => (texto ? texto[0].toUpperCase() + texto.slice(1) : "");

const diaYMes = (fecha) => {
  const partes = String(fecha || "").split("-");
  if (partes.length !== 3) return { dia: "--", mes: "" };
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return { dia: partes[2], mes: meses[Number(partes[1]) - 1] || "" };
};

// Inicio de Entrenamiento, con la misma cara que el inicio de Partido: el
// entrenamiento actual arriba, la fecha para empezar otro, y la lista de los
// anteriores (los de este aparato y los de la base) para volver a abrir uno.
export default function TrainingInicio({
  resumenes = [],
  actual = null,
  actualId = "",
  estadoBase = "idle",
  onCrear,
  onAbrir,
  onIrATareas,
  onElegirSesion,
  onRecargar,
  onVolverModulos,
}) {
  const [fecha, setFecha] = useState(hoyLocal);
  const [nombre, setNombre] = useState("");
  const [abriendo, setAbriendo] = useState("");
  const [aviso, setAviso] = useState("");

  const resumen = useMemo(() => (actual ? resumenEntrenamiento(actual) : null), [actual]);
  const hayTareas = Boolean(resumen && resumen.tareas > 0);
  const estadoHero = resumen ? ETIQUETAS_ESTADO_ENTRENAMIENTO[resumen.estado] : "";

  const empezar = () => {
    onCrear({ fecha, nombre });
    setNombre("");
  };

  const abrir = async (id) => {
    setAviso("");
    setAbriendo(id);
    const pudo = await onAbrir(id);
    setAbriendo("");
    if (!pudo) setAviso("No se pudo abrir ese entrenamiento: está en la base y ahora no hay señal.");
  };

  return (
    <div className="app app-inicio">
      <div className="contenedor contenedor-inicio-formacion">
        <header className="hero-partido hero-sesion">
          {onVolverModulos && (
            <button type="button" className="boton-modulos" onClick={onVolverModulos}>
              <Icono nombre="flecha" size={14} />
              Módulos
            </button>
          )}
          <span className="etiqueta-hero">{actual ? "ENTRENAMIENTO" : "SIN ENTRENAMIENTO"}</span>
          <strong className="nombre-sesion">
            {actual ? primeraMayuscula(fechaLarga(actual.fecha)) : "Empezá el de hoy"}
          </strong>
          <p className="fecha-hero">
            {actual
              ? [actual.nombre, actual.actividad ? `Sesión de OpenField: ${actual.actividad.name || "sin nombre"}` : "Sin sesión de OpenField todavía"]
                  .filter(Boolean)
                  .join(" · ")
              : primeraMayuscula(fechaLarga(hoyLocal()))}
          </p>
          {actual && hayTareas && (
            <span className={`estado-hero ${resumen.enCurso ? "en-curso" : ""}`}>
              <i aria-hidden="true" />
              {estadoHero.toUpperCase()}
            </span>
          )}
        </header>

        {actual && (
          <section className="tarjeta tarjeta-inicio">
            <div className="acciones-inicio">
              <button type="button" className="boton-principal boton-formacion-grande" onClick={onIrATareas}>
                {hayTareas ? "Seguir registrando" : "Ir a Entrenamiento"}
              </button>
              <button type="button" className="boton-secundario" onClick={onElegirSesion}>
                {actual.actividad ? "Cambiar la sesión de OpenField" : "Elegir la sesión de OpenField"}
              </button>
            </div>
          </section>
        )}

        {actual && hayTareas && (
          <button type="button" className="tarjeta-en-curso" onClick={onIrATareas}>
            <span className="cabecera-en-curso">
              <span className={`pastilla-vivo ${resumen.enCurso ? "" : "sin-empezar"}`}>
                <i aria-hidden="true" />
                {estadoHero.toUpperCase()}
              </span>
              <span className="fecha-registro">{fechaCorta(actual.fecha)}</span>
            </span>
            <span className="tiempos-registro">
              <span>
                Tareas <strong>{resumen.tareas}</strong>
              </span>
              <span>
                Sin enviar <strong>{resumen.pendientes}</strong>
              </span>
              {resumen.conCambios > 0 && (
                <span>
                  Con cambios <strong>{resumen.conCambios}</strong>
                </span>
              )}
            </span>
            <span className="ir-al-partido">
              Seguir registrando
              <span aria-hidden="true">›</span>
            </span>
          </button>
        )}

        <section className="tarjeta tarjeta-inicio formulario-entrenamiento">
          <div className="cabeza-ficha">
            <b>{actual ? "Otro entrenamiento" : "Nuevo entrenamiento"}</b>
          </div>
          <div className="campo-inicio">
            <label htmlFor="fecha-entrenamiento">Fecha</label>
            <input id="fecha-entrenamiento" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="campo-inicio">
            <label htmlFor="nombre-entrenamiento">Nombre (opcional)</label>
            <input
              id="nombre-entrenamiento"
              type="text"
              value={nombre}
              placeholder="Turno tarde"
              autoComplete="off"
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="acciones-inicio">
            <button type="button" className="boton-principal boton-formacion-grande" onClick={empezar}>
              Ir a Entrenamiento
            </button>
          </div>
        </section>

        <section className="tarjeta tarjeta-ficha">
          <div className="cabeza-ficha">
            <b>Entrenamientos anteriores</b>
            <span className="cuenta-ajuste">{resumenes.length}</span>
            <button type="button" className="boton-texto" onClick={onRecargar} disabled={estadoBase === "cargando"}>
              {estadoBase === "cargando" ? "Buscando…" : "Actualizar"}
            </button>
          </div>

          {estadoBase === "error" && (
            <p className="pista-equipo">Sin conexión con la base. Se muestran los guardados en este aparato.</p>
          )}
          {aviso && <p className="error-equipo">{aviso}</p>}

          {resumenes.length === 0 ? (
            <p className="vacio-ficha">
              {estadoBase === "cargando" ? "Buscando en la base…" : "Todavía no hay entrenamientos."}
            </p>
          ) : (
            <div className="lista-entrenamientos">
              {resumenes.map((item) => {
                const { dia, mes } = diaYMes(item.fecha);
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`fila-entrenamiento ${item.id === actualId ? "elegido" : ""}`.trim()}
                    onClick={() => abrir(item.id)}
                    disabled={abriendo === item.id}
                  >
                    <span className="dia-entrenamiento">
                      {dia}
                      <small>{mes}</small>
                    </span>
                    <span className="texto">
                      <b>{item.nombre || primeraMayuscula(fechaLarga(item.fecha))}</b>
                      <small>
                        {item.tareas} {item.tareas === 1 ? "tarea" : "tareas"} ·{" "}
                        {item.actividadNombre ? `Sesión ${item.actividadNombre}` : "sin sesión de OpenField"}
                        {!item.local ? " · en la base" : ""}
                      </small>
                    </span>
                    <span className={`estado-entrenamiento ${item.estado}`}>
                      {abriendo === item.id ? "Abriendo…" : ETIQUETAS_ESTADO_ENTRENAMIENTO[item.estado] || ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {actual?.actividad && <TrainingBloques actividad={actual.actividad} />}
      </div>
    </div>
  );
}
