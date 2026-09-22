import React, { useState } from "react";
import App from "./App";
import TrainingModule from "./TrainingModule";
import TrainingAccessGate from "./TrainingAccessGate";
import { ArteFlujo, ArtePartido, IconoFlujo, IconoPartido } from "./components/PortalArt.jsx";
import { leerEquipoElegido } from "./domain/equipo.js";
import "./portal.css";
import "./training.css";

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

// Las dos puertas de la app, contadas en una línea: lo esencial de cada una.
const TARJETAS = [
  {
    modo: MODOS.PARTIDO,
    clase: "tarjeta-partido",
    foto: "/portal/partido.webp",
    Arte: ArtePartido,
    Icono: IconoPartido,
    titulo: "Partido",
    texto: "Registrá el partido en vivo: formación, tiempos y cambios.",
  },
  {
    modo: MODOS.ENTRENAMIENTO,
    clase: "tarjeta-flujo",
    foto: "/portal/flujo.webp",
    Arte: ArteFlujo,
    Icono: IconoFlujo,
    titulo: "Flujo diario",
    etiqueta: "En prueba",
    texto: "Todo lo del día después de entrenar: cortes, datos, planilla y PSE.",
  },
];

// La foto de la tarjeta con el ícono arriba a la izquierda; si la foto no
// carga (primera vez sin señal), va el dibujo.
const FotoTarjeta = ({ src, Arte, Icono }) => {
  const [fallo, setFallo] = useState(false);
  return (
    <span className="portal-foto">
      {fallo ? <Arte /> : <img src={src} alt="" decoding="async" onError={() => setFallo(true)} />}
      <span className="portal-icono">
        <Icono />
      </span>
    </span>
  );
};

const Portal = ({ onElegir }) => {
  const equipo = leerEquipoElegido();

  return (
    <main className="portal-modulos">
      <section className="portal-contenido">
        <div className="portal-encabezado">
          <span className="portal-kicker">{equipo?.nombre || "Registro deportivo"}</span>
          <h1>¿Qué vas a hacer hoy?</h1>
          <p>Elegí por dónde arrancar.</p>
        </div>

        <div className="portal-opciones">
          {TARJETAS.map(({ modo, clase, foto, Arte, Icono, titulo, etiqueta, texto }) => (
            <button
              type="button"
              key={modo}
              className={`portal-tarjeta ${clase}`}
              onClick={() => onElegir(modo)}
              aria-label={`Entrar a ${titulo}`}
            >
              <FotoTarjeta src={foto} Arte={Arte} Icono={Icono} />
              <span className="portal-cuerpo">
                <span className="portal-tarjeta-texto">
                  <strong>
                    {titulo}
                    {etiqueta && <em className="portal-beta">{etiqueta}</em>}
                  </strong>
                  <small>{texto}</small>
                </span>
                <span className="portal-entrar" aria-hidden="true">
                  Entrar <span>›</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
};

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
        {({ email, cerrarSesion }) => (
          <TrainingModule onVolver={volver} email={email} onCerrarSesion={cerrarSesion} />
        )}
      </TrainingAccessGate>
    );
  }

  return <Portal onElegir={setModo} />;
}
