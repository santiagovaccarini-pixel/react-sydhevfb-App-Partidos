import React, { useState } from "react";
import TrainingApp from "./TrainingApp";
import TrainingSettings from "./TrainingSettings";
import "./training-settings.css";

const VISTAS = {
  REGISTRO: "registro",
  AJUSTES: "ajustes",
};

export default function TrainingModule({ onVolver }) {
  const [vista, setVista] = useState(VISTAS.REGISTRO);

  if (vista === VISTAS.AJUSTES) {
    return (
      <TrainingSettings
        onVolverRegistro={() => setVista(VISTAS.REGISTRO)}
        onVolverModulos={onVolver}
      />
    );
  }

  return (
    <div className="entrenamiento-modulo-shell">
      <TrainingApp onVolver={onVolver} />
      <button
        type="button"
        className="entrenamiento-ajustes-acceso"
        onClick={() => setVista(VISTAS.AJUSTES)}
        aria-label="Abrir ajustes de Entrenamiento"
      >
        <span aria-hidden="true">⚙</span>
        Ajustes
      </button>
    </div>
  );
}
