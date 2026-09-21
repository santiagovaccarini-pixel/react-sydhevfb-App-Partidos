import React from "react";

// Copias literales de las funciones internas de App.js (no exportadas), con
// las mismas clases, para que Entrenamiento herede el CSS de Partido sin
// tocar App.js.

export const DatoDetalle = ({ label, valor }) => (
  <div className="dato-detalle">
    <span>{label}</span>
    <strong>{valor || "-"}</strong>
  </div>
);

// El botón para salir de una pantalla. La flecha va dibujada y no como el
// caracter de flecha del teclado, que en el teléfono sale tan fino que el
// botón termina leyéndose como un renglón de texto más.
export const BotonVolver = ({ onClick, children = "Volver" }) => (
  <button
    type="button"
    className="boton-secundario boton-volver"
    onClick={onClick}
  >
    <span className="flecha-volver" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
    </span>
    <span>{children}</span>
  </button>
);

export default BotonVolver;
