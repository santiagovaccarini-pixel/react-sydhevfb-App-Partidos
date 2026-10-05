import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t, useIdioma } from "../idioma/index.js";
import { fechaCorta } from "../idioma/formatos.js";
import "../portal.css";

// Las tarjetas del portal y su portada de entrada. Las usan la pantalla
// principal (una tarjeta por módulo) y Bases de Datos (una tarjeta por base):
// se ven y se comportan igual.
//
// Una tarjeta: { modo, permiso, clase, foto, fotoParada, foco, focoParada,
// Arte, Icono, titulo, etiqueta?, texto }. `foco` es qué parte de la foto
// queda a la vista cuando hay que recortarla (0 izquierda, 1 derecha; 0
// arriba, 1 abajo): en el celular, parado, la foto apaisada no entra entera.
// `fotoParada` es la versión vertical de la foto, la que va en la portada del
// celular (entra casi entera), con su `focoParada`. Sin foto, va el dibujo
// (`Arte`). Títulos y textos: claves del diccionario de idioma.

// Cuánto dura la portada al tocar una tarjeta: el zoom de la foto hasta la
// pantalla entera, la foto quieta con el nombre y la salida sobre el módulo.
export const TIEMPOS_PORTADA = { zoom: 450, quieta: 1600, salida: 350 };

// La foto de la tarjeta, con el ícono arriba a la izquierda si se pide; si la
// foto no carga (primera vez sin señal), va el dibujo.
const FotoTarjeta = ({ src, Arte, Icono, className = "" }) => {
  const [fallo, setFallo] = useState(false);
  return (
    <span className={`portal-foto ${className}`.trim()}>
      {fallo || !src ? <Arte /> : <img src={src} alt="" decoding="async" onError={() => setFallo(true)} />}
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

  useIdioma();
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
        <strong>{t(titulo)}</strong>
        <small>{t("portal.entrando")}</small>
      </div>
    </div>
  );
};

// Las tarjetas, una al lado de la otra (una abajo de la otra en el
// celular). Cada una es un botón grande: la foto arriba con el ícono, y abajo
// el nombre, una línea de qué hay adentro y Entrar. onElegir(tarjeta, desde):
// `desde` es dónde estaba la foto, para que la portada arranque de ahí.
export const TarjetasDelPortal = ({ tarjetas, onElegir }) => (
  <div className="portal-opciones">
    {tarjetas.map((tarjeta) => {
      const { modo, clase, foto, Arte, Icono, titulo, etiqueta, texto } = tarjeta;
      return (
        <button
          type="button"
          key={modo}
          className={`portal-tarjeta ${clase}`}
          onClick={(evento) => onElegir(tarjeta, lugarDeLaFoto(evento.currentTarget))}
          aria-label={t("portal.entrarA", { modulo: t(titulo) })}
        >
          <FotoTarjeta src={foto} Arte={Arte} Icono={Icono} />
          <span className="portal-cuerpo">
            <span className="portal-tarjeta-texto">
              <strong>
                {t(titulo)}
                {etiqueta && <em className="portal-beta">{t(etiqueta)}</em>}
              </strong>
              <small>{t(texto)}</small>
            </span>
            <span className="portal-entrar" aria-hidden="true">
              {t("portal.entrar")} <span>›</span>
            </span>
          </span>
        </button>
      );
    })}
  </div>
);

// El club con el que se trabaja, arriba del título: si la cuenta ya se fue
// del club, hasta cuándo (solo lectura); y, si se pide, el botón para cambiarlo.
export const ClubDelPortal = ({ equipo, onCambiarClub = null }) =>
  equipo?.nombre ? (
    <span className="portal-kicker portal-club">
      {equipo.nombre}
      {equipo.hasta && <em className="portal-club-hasta">{t("club.hasta", { fecha: fechaCorta(equipo.hasta) })}</em>}
      {onCambiarClub && (
        <button type="button" className="portal-cambiar-club" onClick={onCambiarClub}>
          {t("comun.cambiar")}
        </button>
      )}
    </span>
  ) : null;

// La flecha de los botones para volver de las pantallas con la cara del
// portal (Cuentas, Bases de Datos).
export const FlechaVolver = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
);
