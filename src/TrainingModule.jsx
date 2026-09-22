import React, { useEffect, useState } from "react";
import { MarcoAplicacion } from "./components/AppChrome";
import TrainingInicio from "./TrainingInicio";
import TrainingElegirSesion from "./TrainingElegirSesion";
import TrainingSettings from "./TrainingSettings";
import TrainingTareas from "./TrainingTareas";
import {
  guardarActividadElegida,
  leerActividadElegida,
  normalizarActividad,
} from "./domain/sesionEntrenamiento.js";

export const DESTINOS_ENTRENAMIENTO = [
  { id: "sesion", etiqueta: "Sesión", icono: "partido" },
  { id: "tareas", etiqueta: "Tareas", icono: "registros" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

export const CLAVE_VISTA = "entrenamiento_vista";

const VISTAS_AJUSTES = ["inicio", "cuenta", "jugadores", "pruebas"];

// La app arranca siempre en Sesión: al reabrirla no tiene que aparecer en
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
// barra inferior en el celular. Sesión elige la sesión de trabajo, Tareas
// registra las tareas sobre ella y Ajustes guarda el usuario y los jugadores.
export default function TrainingModule({ onVolver, email = "", onCerrarSesion }) {
  const [vista, setVista] = useState("sesion");
  const [vistaAjustes, setVistaAjustesEstado] = useState("inicio");
  const [actividad, setActividad] = useState(leerActividadElegida);

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

  const elegirActividad = (nueva) => {
    const limpia = normalizarActividad(nueva);
    guardarActividadElegida(limpia);
    setActividad(limpia);
  };

  const pantallas = {
    sesion: (
      <TrainingInicio
        actividad={actividad}
        onElegirSesion={() => irA("elegir-sesion")}
        onIrATareas={() => irA("tareas")}
        onVolverModulos={onVolver}
      />
    ),
    "elegir-sesion": (
      <TrainingElegirSesion
        actividad={actividad}
        onSeleccionar={(nueva) => {
          elegirActividad(nueva);
          irA("sesion");
        }}
        onVolver={() => irA("sesion")}
      />
    ),
    tareas: <TrainingTareas actividad={actividad} onIrASesion={() => irA("sesion")} />,
    ajustes: (
      <TrainingSettings
        vista={vistaAjustes}
        onCambiarVista={setVistaAjustes}
        email={email}
        onCerrarSesion={onCerrarSesion}
      />
    ),
  };

  // En la barra, "Elegir sesión" cuenta como Sesión.
  const activo = vista === "elegir-sesion" ? "sesion" : vista;

  return (
    <MarcoAplicacion
      activo={activo}
      onNavigate={onNavigate}
      destinos={DESTINOS_ENTRENAMIENTO}
      marca="Entrenamiento"
      className="entrenamiento-marco"
    >
      {pantallas[vista] || pantallas.sesion}
    </MarcoAplicacion>
  );
}
