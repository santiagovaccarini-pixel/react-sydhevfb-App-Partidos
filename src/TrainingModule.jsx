import React, { useState } from "react";
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

const VISTAS = ["sesion", "elegir-sesion", "tareas", "ajustes"];
const VISTAS_AJUSTES = ["inicio", "cuenta", "jugadores", "pruebas"];

// La pantalla en la que quedó el módulo, para volver ahí al reabrir la app.
// "elegir-sesion" es una pantalla de paso: al releer cae a "sesion".
export const leerVistaGuardada = () => {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE_VISTA) || "null") || {};
    const vista = VISTAS.includes(guardada.vista) && guardada.vista !== "elegir-sesion" ? guardada.vista : "sesion";
    const vistaAjustes = VISTAS_AJUSTES.includes(guardada.vistaAjustes) ? guardada.vistaAjustes : "inicio";
    return { vista, vistaAjustes };
  } catch {
    return { vista: "sesion", vistaAjustes: "inicio" };
  }
};

const guardarVista = (vista, vistaAjustes) => {
  try {
    localStorage.setItem(CLAVE_VISTA, JSON.stringify({ vista, vistaAjustes }));
  } catch {
    // Sin espacio o sin localStorage: la app sigue, solo no recuerda la pantalla.
  }
};

// Entrenamiento con el mismo marco que Partido: barra lateral en escritorio y
// barra inferior en el celular. Sesión elige la sesión de trabajo, Tareas
// registra las tareas sobre ella y Ajustes guarda el usuario y los jugadores.
export default function TrainingModule({ onVolver, email = "", onCerrarSesion }) {
  const [vistaInicial] = useState(leerVistaGuardada);
  const [vista, setVista] = useState(vistaInicial.vista);
  const [vistaAjustes, setVistaAjustesEstado] = useState(vistaInicial.vistaAjustes);
  const [actividad, setActividad] = useState(leerActividadElegida);

  const irA = (nueva) => {
    setVista(nueva);
    guardarVista(nueva, vistaAjustes);
  };

  const setVistaAjustes = (nueva) => {
    const limpia = VISTAS_AJUSTES.includes(nueva) ? nueva : "inicio";
    setVistaAjustesEstado(limpia);
    guardarVista(vista, limpia);
  };

  // Tocar un destino de la barra siempre vuelve a la raíz de Ajustes.
  const onNavigate = (id) => {
    setVistaAjustesEstado("inicio");
    setVista(id);
    guardarVista(id, "inicio");
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
        onVolverModulos={onVolver}
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
