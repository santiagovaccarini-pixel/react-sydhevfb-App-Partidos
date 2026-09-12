import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(<App />);

// Deja la app guardada en el teléfono para que abra sin señal, que es la
// situación normal en un estadio. Solo en producción: en desarrollo serviría
// archivos viejos y volvería loco cualquier cambio.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("No se pudo guardar la app para usarla sin señal:", error);
    });
  });
}
