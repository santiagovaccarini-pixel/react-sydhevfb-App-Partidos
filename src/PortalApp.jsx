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

// Las dos puertas de la app, contadas en criollo: qué se hace en cada una y
// por qué pasos se va. Nada técnico: eso queda para adentro.
const TARJETAS = [
  {
    modo: MODOS.PARTIDO,
    clase: "tarjeta-partido",
    foto: "/portal/partido.webp",
    Arte: ArtePartido,
    Icono: IconoPartido,
    titulo: "Partido",
    texto:
      "El día del partido, en vivo desde la cancha: la formación, los tiempos de cada período, los cambios, el VAR y la hidratación. Al final se guarda todo con un botón.",
    pasos: ["Formación", "Tiempos", "Cambios", "Guardar"],
  },
  {
    modo: MODOS.ENTRENAMIENTO,
    clase: "tarjeta-flujo",
    foto: "/portal/flujo.webp",
    Arte: ArteFlujo,
    Icono: IconoFlujo,
    titulo: "Flujo diario",
    etiqueta: "En prueba",
    texto:
      "Lo de todos los días después de entrenar: las tareas de la sesión y sus cortes en la nube, la descarga de los datos, la planilla de Excel, el PSE y los archivos para cargar.",
    pasos: ["Tareas", "Cortes", "Descarga", "Planilla", "PSE", "Carga"],
    nota: "Hoy están las tareas y los cortes. El resto se va sumando.",
  },
];

// La foto de la tarjeta; si no carga (primera vez sin señal), el dibujo.
const FotoTarjeta = ({ src, Arte }) => {
  const [fallo, setFallo] = useState(false);
  return (
    <span className="portal-foto">
      {fallo ? <Arte /> : <img src={src} alt="" decoding="async" onError={() => setFallo(true)} />}
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
          {TARJETAS.map(({ modo, clase, foto, Arte, Icono, titulo, etiqueta, texto, pasos, nota }) => (
            <button
              type="button"
              key={modo}
              className={`portal-tarjeta ${clase}`}
              onClick={() => onElegir(modo)}
              aria-label={`Entrar a ${titulo}`}
            >
              <FotoTarjeta src={foto} Arte={Arte} />
              <span className="portal-cuerpo">
                <span className="portal-icono">
                  <Icono />
                </span>
                <span className="portal-tarjeta-texto">
                  <strong>
                    {titulo}
                    {etiqueta && <em className="portal-beta">{etiqueta}</em>}
                  </strong>
                  <small>{texto}</small>
                  <span className="portal-pasos" aria-label="Pasos">
                    {pasos.map((paso) => (
                      <i key={paso}>{paso}</i>
                    ))}
                  </span>
                  {nota && <span className="portal-nota">{nota}</span>}
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
