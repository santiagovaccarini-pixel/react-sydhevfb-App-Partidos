import React, { useEffect, useState } from "react";
import { MarcoAplicacion } from "./components/AppChrome";
import TrainingInicio from "./TrainingInicio";
import TrainingElegirSesion from "./TrainingElegirSesion";
import TrainingSettings from "./TrainingSettings";
import TrainingTareas from "./TrainingTareas";
import useEntrenamientos from "./useEntrenamientos.js";
import { vincularActividad } from "./domain/entrenamiento.js";
import { leerEquipoElegido } from "./domain/equipo.js";

export const DESTINOS_ENTRENAMIENTO = [
  { id: "inicio", etiqueta: "Inicio", icono: "partido" },
  { id: "tareas", etiqueta: "Tareas", icono: "registros" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

export const CLAVE_VISTA = "entrenamiento_vista";

const VISTAS_AJUSTES = ["inicio", "cuenta", "jugadores", "pruebas"];

// La app arranca siempre en Inicio: al reabrirla no tiene que aparecer en
// Ajustes ni en el medio de otra cosa. La clave quedó de una versión que
// recordaba la pantalla; se limpia para no dejar basura en el celular.
const olvidarVistaGuardada = () => {
  try {
    localStorage.removeItem(CLAVE_VISTA);
  } catch {
    // Sin localStorage no hay nada que limpiar.
  }
};

// Entrenamiento con el mismo marco que Partido: barra lateral en escritorio y
// barra inferior en el celular. Inicio empieza o reabre un entrenamiento (por
// fecha), Tareas lo registra y Ajustes guarda el usuario y los jugadores. La
// sesión de OpenField se elige recién al enviar los cortes.
export default function TrainingModule({ onVolver, email = "", onCerrarSesion }) {
  const [vista, setVista] = useState("inicio");
  const [vistaAjustes, setVistaAjustesEstado] = useState("inicio");
  const [equipo] = useState(() => leerEquipoElegido());
  const entrenamientos = useEntrenamientos({ equipoId: equipo?.id || null, email });
  const { actual } = entrenamientos;

  useEffect(olvidarVistaGuardada, []);

  const irA = (nueva) => setVista(nueva);

  const setVistaAjustes = (nueva) => {
    setVistaAjustesEstado(VISTAS_AJUSTES.includes(nueva) ? nueva : "inicio");
  };

  // Tocar un destino de la barra siempre vuelve a la raíz de Ajustes.
  const onNavigate = (id) => {
    setVistaAjustesEstado("inicio");
    setVista(id);
  };

  const abrirYRegistrar = async (id) => {
    const pudo = await entrenamientos.abrir(id);
    if (pudo) irA("tareas");
    return pudo;
  };

  const pantallas = {
    inicio: (
      <TrainingInicio
        resumenes={entrenamientos.resumenes}
        actual={actual}
        actualId={entrenamientos.actualId}
        estadoBase={entrenamientos.estadoBase}
        onCrear={(datos) => {
          entrenamientos.crear(datos);
          irA("tareas");
        }}
        onAbrir={abrirYRegistrar}
        onIrATareas={() => irA("tareas")}
        onElegirSesion={() => irA("elegir-sesion")}
        onRecargar={entrenamientos.recargarBase}
        onVolverModulos={onVolver}
      />
    ),
    "elegir-sesion": (
      <TrainingElegirSesion
        actividad={actual?.actividad || null}
        fecha={actual?.fecha || ""}
        titulo="Sesión de OpenField"
        subtitulo="Inicio · Sesión de OpenField"
        etiquetaVolver="Volver a Inicio"
        onSeleccionar={(nueva) => {
          if (actual) entrenamientos.cambiar(actual.id, (entrenamiento) => vincularActividad(entrenamiento, nueva));
          irA("inicio");
        }}
        onVolver={() => irA("inicio")}
      />
    ),
    tareas: (
      <TrainingTareas
        entrenamiento={actual}
        onCambiar={(cambio) => actual && entrenamientos.cambiar(actual.id, cambio)}
        onIrAInicio={() => irA("inicio")}
        guardado={entrenamientos.guardado}
      />
    ),
    ajustes: (
      <TrainingSettings
        vista={vistaAjustes}
        onCambiarVista={setVistaAjustes}
        email={email}
        onCerrarSesion={onCerrarSesion}
      />
    ),
  };

  // En la barra, elegir la sesión de OpenField cuenta como Inicio.
  const activo = vista === "elegir-sesion" ? "inicio" : vista;

  return (
    <MarcoAplicacion
      activo={activo}
      onNavigate={onNavigate}
      destinos={DESTINOS_ENTRENAMIENTO}
      marca="Entrenamiento"
      className="entrenamiento-marco"
    >
      {pantallas[vista] || pantallas.inicio}
    </MarcoAplicacion>
  );
}
