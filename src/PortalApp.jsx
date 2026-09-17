import React, { useState } from "react";
import App from "./App";
import TrainingModule from "./TrainingModule";
import TrainingAccessGate from "./TrainingAccessGate";
import "./portal.css";

const MODOS = {
  PORTAL: "portal",
  PARTIDO: "partido",
  ENTRENAMIENTO: "entrenamiento",
};

const modoInicial = () => {
  if (typeof window === "undefined") return MODOS.PORTAL;

  const params = new URLSearchParams(window.location.search);
  return params.get("training_recovery") === "1"
    ? MODOS.ENTRENAMIENTO
    : MODOS.PORTAL;
};

const IconoPartido = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="21" />
    <path d="m32 20 8 6-3 9H27l-3-9 8-6Z" />
    <path d="m24 26-8 2M40 26l8 2M27 35l-5 8M37 35l5 8" />
  </svg>
);

const IconoEntrenamiento = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M14 46h36" />
    <path d="m20 46 8-27h8l8 27" />
    <path d="M24 34h16" />
    <path d="M27 26h10" />
  </svg>
);

const Portal = ({ onElegir }) => (
  <main className="portal-modulos">
    <section className="portal-contenido">
      <div className="portal-encabezado">
        <span className="portal-kicker">Registro deportivo</span>
        <h1>¿Qué vas a registrar?</h1>
        <p>Elegí el módulo de trabajo para continuar.</p>
      </div>

      <div className="portal-opciones">
        <button
          type="button"
          className="portal-tarjeta"
          onClick={() => onElegir(MODOS.PARTIDO)}
        >
          <span className="portal-icono">
            <IconoPartido />
          </span>
          <span className="portal-tarjeta-texto">
            <strong>Partido</strong>
            <small>Registro en vivo, formaciones, cambios y tiempos.</small>
          </span>
          <span className="portal-flecha" aria-hidden="true">›</span>
        </button>

        <button
          type="button"
          className="portal-tarjeta portal-tarjeta-beta"
          onClick={() => onElegir(MODOS.ENTRENAMIENTO)}
        >
          <span className="portal-icono">
            <IconoEntrenamiento />
          </span>
          <span className="portal-tarjeta-texto">
            <span className="portal-beta">FASE BETA</span>
            <strong>Entrenamiento</strong>
            <small>Tareas, pausas, participantes y procesamiento OpenField.</small>
          </span>
          <span className="portal-flecha" aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  </main>
);

export default function PortalApp() {
  const [modo, setModo] = useState(modoInicial);

  if (modo === MODOS.PARTIDO) {
    return <App />;
  }

  if (modo === MODOS.ENTRENAMIENTO) {
    const volver = () => {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("training_recovery");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      }
      setModo(MODOS.PORTAL);
    };

    return (
      <TrainingAccessGate onVolver={volver}>
        <TrainingModule onVolver={volver} />
      </TrainingAccessGate>
    );
  }

  return <Portal onElegir={setModo} />;
}
