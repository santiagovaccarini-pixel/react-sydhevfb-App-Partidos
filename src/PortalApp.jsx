import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import App from "./App";
import TrainingModule from "./TrainingModule";
import AccessGate from "./AccessGate.jsx";
import OpenFieldSession from "./OpenFieldSession.jsx";
import { ArteFlujo, ArtePartido, IconoFlujo, IconoPartido } from "./components/PortalArt.jsx";
import { leerEquipoElegido } from "./domain/equipo.js";
import "./portal.css";
import "./training.css";

const MODOS = {
  PORTAL: "portal",
  PARTIDO: "partido",
  ENTRENAMIENTO: "entrenamiento",
};

// Las dos puertas de la app, contadas en una línea: lo esencial de cada una.
// `foco` es qué parte de la foto queda a la vista cuando hay que recortarla
// (0 izquierda, 1 derecha; 0 arriba, 1 abajo): en el celular, parado, la foto
// apaisada no entra entera. `fotoParada` es la versión vertical de la foto,
// la que va en la portada del celular (entra casi entera), con su `focoParada`.
const TARJETAS = [
  {
    modo: MODOS.PARTIDO,
    permiso: "partido",
    clase: "tarjeta-partido",
    foto: "/portal/partido.webp",
    fotoParada: "/portal/partido-parada.webp",
    foco: [0.5, 0.5],
    focoParada: [0.2, 0.5],
    Arte: ArtePartido,
    Icono: IconoPartido,
    titulo: "Partido",
    texto: "Registrá el partido en vivo: formación, tiempos y cambios.",
  },
  {
    modo: MODOS.ENTRENAMIENTO,
    permiso: "flujo",
    clase: "tarjeta-flujo",
    foto: "/portal/flujo.webp",
    fotoParada: "/portal/flujo-parada.webp",
    foco: [0.18, 0.5],
    focoParada: [0.3, 0.5],
    Arte: ArteFlujo,
    Icono: IconoFlujo,
    titulo: "Flujo diario",
    etiqueta: "En prueba",
    texto: "Todo lo del día después de entrenar: cortes, datos, planilla y PSE.",
  },
];

// Cuánto dura la portada al tocar una tarjeta: el zoom de la foto hasta la
// pantalla entera, la foto quieta con el nombre y la salida sobre el módulo.
export const TIEMPOS_PORTADA = { zoom: 450, quieta: 1600, salida: 350 };

// La foto de la tarjeta, con el ícono arriba a la izquierda si se pide; si la
// foto no carga (primera vez sin señal), va el dibujo.
const FotoTarjeta = ({ src, Arte, Icono, className = "" }) => {
  const [fallo, setFallo] = useState(false);
  return (
    <span className={`portal-foto ${className}`.trim()}>
      {fallo ? <Arte /> : <img src={src} alt="" decoding="async" onError={() => setFallo(true)} />}
      {Icono && (
        <span className="portal-icono">
          <Icono />
        </span>
      )}
    </span>
  );
};

// Dónde está la foto de la tarjeta en la pantalla: de ahí arranca el zoom.
const lugarDeLaFoto = (boton) => {
  const foto = boton.querySelector(".portal-foto") || boton;
  const { top, left, width, height } = foto.getBoundingClientRect();
  return { top, left, width, height };
};

// Dónde termina la foto de la portada: tapando la pantalla entera, como el
// fondo de una pantalla de bloqueo. Si la foto no tiene la forma de la
// pantalla, se agranda hasta cubrirla y lo que sobra queda afuera, del lado
// que dice el foco. `proporcion` es ancho / alto de la foto.
const enPixeles = (numero) => Math.round(numero * 100) / 100 + 0;

export const lugarEnPantalla = (ancho, alto, { proporcion = 16 / 9, foco = [0.5, 0.5] } = {}) => {
  const anchoFoto = Math.max(ancho, alto * proporcion);
  const altoFoto = anchoFoto / proporcion;
  return {
    top: enPixeles(-(altoFoto - alto) * foco[1]),
    left: enPixeles(-(anchoFoto - ancho) * foco[0]),
    width: enPixeles(anchoFoto),
    height: enPixeles(altoFoto),
    borderRadius: 0,
  };
};

// Qué foto va en la portada: en el celular, parado, la versión parada si la
// tarjeta la tiene (entra casi entera); si no, la foto de la tarjeta.
export const fotoDePortada = (tarjeta, ancho, alto) => {
  const parada = alto > ancho && Boolean(tarjeta.fotoParada);
  return { src: parada ? tarjeta.fotoParada : tarjeta.foto, parada };
};

const PROPORCION_PARADA = 9 / 16;

// La portada de entrada: la foto de la tarjeta que se tocó crece desde donde
// estaba hasta tapar la pantalla (un zoom de verdad: la foto se agranda
// entera, no se recorta de a poco), mientras atrás aparece la misma foto
// borrosa. Se queda unos segundos con el nombre del módulo y se desvanece.
// Mientras tanto el módulo ya se cargó abajo, así que al irse está listo.
// Con una foto parada, el zoom arranca igual desde la foto de la tarjeta y
// en el camino se funde con la parada, que es la que queda.
export const Portada = ({ tarjeta, desde, onTerminar }) => {
  const [foto] = useState(() => fotoDePortada(tarjeta, window.innerWidth, window.innerHeight));
  const [lugar] = useState(() =>
    lugarEnPantalla(window.innerWidth, window.innerHeight, {
      proporcion: foto.parada ? PROPORCION_PARADA : 16 / 9,
      foco: (foto.parada && tarjeta.focoParada) || tarjeta.foco,
    }),
  );
  const [fase, setFase] = useState(desde ? "inicio" : "llena");
  const ref = useRef(null);

  // Se pinta primero del tamaño de la tarjeta y, ya medida, se le pide la
  // pantalla entera: la transición de la hoja de estilos hace el zoom.
  useLayoutEffect(() => {
    if (fase !== "inicio") return;
    if (ref.current) ref.current.getBoundingClientRect();
    setFase("llena");
  }, [fase]);

  useEffect(() => {
    const { zoom, quieta, salida } = TIEMPOS_PORTADA;
    const irse = window.setTimeout(() => setFase("saliendo"), zoom + quieta);
    const fin = window.setTimeout(onTerminar, zoom + quieta + salida);
    return () => {
      window.clearTimeout(irse);
      window.clearTimeout(fin);
    };
  }, [onTerminar]);

  const { Arte, Icono, titulo, clase } = tarjeta;
  const lugarFoto =
    fase === "inicio" && desde
      ? { top: desde.top, left: desde.left, width: desde.width, height: desde.height, borderRadius: "22px 22px 0 0" }
      : lugar;

  return (
    <div className={`portal-portada ${clase} ${fase}`} aria-hidden="true">
      <div className="portal-portada-fondo">
        <FotoTarjeta src={foto.src} Arte={Arte} />
      </div>
      <div ref={ref} className="portal-portada-foto" style={lugarFoto}>
        {foto.parada && <FotoTarjeta src={tarjeta.foto} Arte={Arte} />}
        <FotoTarjeta src={foto.src} Arte={Arte} className={foto.parada ? "foto-parada" : ""} />
      </div>
      <div className="portal-portada-velo" />
      <div className="portal-portada-texto">
        <span className="portal-icono">
          <Icono />
        </span>
        <strong>{titulo}</strong>
        <small>Entrando…</small>
      </div>
    </div>
  );
};

const Portal = ({ onElegir, permisos, email, onSalir }) => {
  const equipo = leerEquipoElegido();
  const tarjetas = TARJETAS.filter((tarjeta) => permisos?.[tarjeta.permiso]);

  return (
    <main className="portal-modulos">
      <section className="portal-contenido">
        <div className="portal-cuenta">
          <span className="portal-cuenta-correo" title={email}>
            {email}
          </span>
          <button type="button" className="portal-salir" onClick={onSalir}>
            Salir
          </button>
        </div>

        <div className="portal-encabezado">
          {equipo?.nombre && <span className="portal-kicker">{equipo.nombre}</span>}
          <h1>¿Qué vas a hacer hoy?</h1>
          <p>{tarjetas.length > 1 ? "Elegí por dónde arrancar." : "Esto es lo que tenés habilitado."}</p>
        </div>

        <div className="portal-opciones">
          {tarjetas.map((tarjeta) => {
            const { modo, clase, foto, Arte, Icono, titulo, etiqueta, texto } = tarjeta;
            return (
              <button
                type="button"
                key={modo}
                className={`portal-tarjeta ${clase}`}
                onClick={(evento) => onElegir(tarjeta, lugarDeLaFoto(evento.currentTarget))}
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
            );
          })}
        </div>
      </section>
    </main>
  );
};

// Con la sesión abierta: el portal y los dos módulos, cada uno detrás de su
// portada. Partido entra directo (la puerta ya comprobó la cuenta); Flujo
// diario abre además su sesión de OpenField en el servidor.
const AppConSesion = ({ email, userId, permisos, cerrarSesion }) => {
  const [modo, setModo] = useState(MODOS.PORTAL);
  // La portada que se está mostrando (tarjeta y desde dónde arranca el zoom),
  // o nada. Se muestra encima del módulo mientras este se carga.
  const [portada, setPortada] = useState(null);
  const terminarPortada = useCallback(() => setPortada(null), []);

  const elegir = (tarjeta, desde) => {
    if (!permisos?.[tarjeta.permiso]) return;
    setPortada({ tarjeta, desde });
    setModo(tarjeta.modo);
  };

  const volver = () => setModo(MODOS.PORTAL);

  let contenido;

  if (modo === MODOS.PARTIDO && permisos?.partido) {
    // La portada ya mostró la foto: Partido entra sin su intro.
    contenido = <App intro={false} />;
  } else if (modo === MODOS.ENTRENAMIENTO && permisos?.flujo) {
    contenido = (
      <OpenFieldSession onVolver={volver}>
        {() => <TrainingModule onVolver={volver} email={email} onCerrarSesion={cerrarSesion} />}
      </OpenFieldSession>
    );
  } else {
    contenido = <Portal onElegir={elegir} permisos={permisos} email={email} onSalir={cerrarSesion} />;
  }

  return (
    <>
      {contenido}
      {portada && <Portada tarjeta={portada.tarjeta} desde={portada.desde} onTerminar={terminarPortada} />}
    </>
  );
};

export default function PortalApp() {
  return (
    <AccessGate>
      {({ email, userId, permisos, cerrarSesion }) => (
        <AppConSesion email={email} userId={userId} permisos={permisos} cerrarSesion={cerrarSesion} />
      )}
    </AccessGate>
  );
}
