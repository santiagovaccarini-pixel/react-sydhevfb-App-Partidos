import React, { useMemo } from "react";
import { Icono } from "./components/AppChrome";
import TrainingBloques, { horaCorta, marcaAFecha } from "./TrainingApp.jsx";
import { cargarSesion, estadoEnvioTarea } from "./domain/sesionEntrenamiento.js";

const esHoy = (fecha, ahora = new Date()) =>
  Boolean(fecha) &&
  fecha.getFullYear() === ahora.getFullYear() &&
  fecha.getMonth() === ahora.getMonth() &&
  fecha.getDate() === ahora.getDate();

// "Hoy · 16:12 a 18:05" | "martes 26 de mayo · 16:12 a 18:05" | "Hoy".
const fechaDelHero = (actividad) => {
  const inicio = marcaAFecha(actividad?.start_time);
  if (!inicio) return "Hoy";

  const dia = esHoy(inicio)
    ? "Hoy"
    : inicio.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const desde = horaCorta(actividad.start_time);
  const hasta = horaCorta(actividad.end_time);

  if (desde && hasta) return `${dia} · ${desde} a ${hasta}`;
  if (desde) return `${dia} · ${desde}`;
  return dia;
};

// "26/05" para la tarjeta de tareas.
const diaCorto = (actividad, tareas) => {
  const inicio = marcaAFecha(actividad?.start_time);
  if (inicio) {
    return `${String(inicio.getDate()).padStart(2, "0")}/${String(inicio.getMonth() + 1).padStart(2, "0")}`;
  }
  const fecha = tareas.find((tarea) => tarea.fecha)?.fecha || "";
  const partes = fecha.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}` : "";
};

// Inicio de Entrenamiento, con la misma cara que el inicio de Partido: la
// sesión elegida arriba, el botón principal en la tarjeta blanca y, si ya hay
// tareas registradas, una tarjeta que lleva directo a seguir con ellas.
export default function TrainingInicio({ actividad = null, onElegirSesion, onIrATareas, onVolverModulos }) {
  const resumen = useMemo(() => {
    if (!actividad?.id) return { tareas: [], enCurso: false, sinEnviar: 0, conCambios: 0, pendientes: 0 };

    const { tareas } = cargarSesion(actividad.id, actividad.name);
    const estados = tareas.map((tarea) => estadoEnvioTarea(tarea));

    return {
      tareas,
      enCurso: tareas.some((tarea) => tarea.inicio && !tarea.fin),
      sinEnviar: estados.filter((estado) => estado !== "enviada").length,
      conCambios: estados.filter((estado) => estado === "modificada").length,
      pendientes: estados.filter((estado) => estado === "pendiente").length,
    };
  }, [actividad?.id]);

  const hayTareas = resumen.tareas.length > 0;
  const estadoHero = resumen.enCurso ? "EN CURSO" : resumen.sinEnviar > 0 ? "SIN ENVIAR" : "TODO ENVIADO";
  const estadoTarjeta = resumen.enCurso ? "EN CURSO" : resumen.sinEnviar > 0 ? "SIN ENVIAR" : "ENVIADO";

  const textoPrincipal = !actividad ? "Elegir la sesión" : hayTareas ? "Ver las tareas" : "Registrar tareas";

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
          <span className="etiqueta-hero">{actividad ? "SESIÓN ELEGIDA" : "SIN SESIÓN"}</span>
          <strong className="nombre-sesion">
            {actividad ? actividad.name || "Sin nombre" : "Todavía no elegiste la sesión"}
          </strong>
          <p className="fecha-hero">{fechaDelHero(actividad)}</p>
          {actividad && hayTareas && (
            <span className={`estado-hero ${resumen.enCurso ? "en-curso" : ""}`}>
              <i aria-hidden="true" />
              {estadoHero}
            </span>
          )}
        </header>

        <section className="tarjeta tarjeta-inicio">
          {!actividad && (
            <p className="pista-equipo">Elegí la sesión sobre la que vas a registrar las tareas.</p>
          )}
          <div className="acciones-inicio">
            <button
              type="button"
              className="boton-principal boton-formacion-grande"
              onClick={actividad ? onIrATareas : onElegirSesion}
            >
              {textoPrincipal}
            </button>
            {actividad && (
              <button type="button" className="boton-secundario" onClick={onElegirSesion}>
                Cambiar de sesión
              </button>
            )}
          </div>
        </section>

        {actividad && hayTareas && (
          <button type="button" className="tarjeta-en-curso" onClick={onIrATareas}>
            <span className="cabecera-en-curso">
              <span className={`pastilla-vivo ${resumen.enCurso ? "" : "sin-empezar"}`}>
                <i aria-hidden="true" />
                {estadoTarjeta}
              </span>
              <span className="fecha-registro">{diaCorto(actividad, resumen.tareas)}</span>
            </span>
            <span className="tiempos-registro">
              <span>
                Tareas <strong>{resumen.tareas.length}</strong>
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

        {actividad && <TrainingBloques actividad={actividad} />}
      </div>
    </div>
  );
}
