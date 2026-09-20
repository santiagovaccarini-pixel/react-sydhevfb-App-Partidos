import React, { useState } from "react";
import { MarcoAplicacion } from "./components/AppChrome";
import TrainingApp from "./TrainingApp";
import TrainingSettings from "./TrainingSettings";
import TrainingTareas from "./TrainingTareas";
import {
  guardarActividadElegida,
  leerActividadElegida,
  normalizarActividad,
} from "./domain/sesionEntrenamiento.js";
import "./training-marco.css";
import "./training-settings.css";

export const DESTINOS_ENTRENAMIENTO = [
  { id: "sesion", etiqueta: "Sesión", icono: "partido" },
  { id: "tareas", etiqueta: "Tareas", icono: "registros" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

// Entrenamiento con el mismo marco que Partido: barra lateral en escritorio y
// barra inferior en el celular. Sesión elige la actividad de OpenField, Tareas
// registra los cortes sobre ella y Ajustes guarda la cuenta y los jugadores.
export default function TrainingModule({ onVolver }) {
  const [vista, setVista] = useState("sesion");
  const [actividad, setActividad] = useState(leerActividadElegida);

  const elegirActividad = (nueva) => {
    const limpia = normalizarActividad(nueva);
    guardarActividadElegida(limpia);
    setActividad(limpia);
  };

  const pantallas = {
    sesion: (
      <TrainingApp
        actividad={actividad}
        onSeleccionar={elegirActividad}
        onIrATareas={() => setVista("tareas")}
        onVolver={onVolver}
      />
    ),
    tareas: <TrainingTareas actividad={actividad} onIrASesion={() => setVista("sesion")} />,
    ajustes: <TrainingSettings onVolverModulos={onVolver} />,
  };

  return (
    <MarcoAplicacion
      activo={vista}
      onNavigate={setVista}
      destinos={DESTINOS_ENTRENAMIENTO}
      marca="Entrenamiento"
      className="entrenamiento-marco"
    >
      {pantallas[vista] || pantallas.sesion}
    </MarcoAplicacion>
  );
}
