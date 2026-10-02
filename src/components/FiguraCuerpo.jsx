import React from "react";
import { ALTO, ANCHO, ORDEN_DE_REGIONES, dibujoDe, zoomA } from "./siluetaCuerpo.js";

// La figura del cuerpo, de frente o de espaldas: la silueta de un cuerpo
// (siluetaCuerpo.js) partida en regiones (cabeza, tronco, brazos y piernas)
// y cada región en las partes del cuerpo del catálogo. Sin región elegida se
// toca la región entera; con una región elegida la figura se acerca a ella,
// se marcan los bordes de sus partes y se toca cada parte.
// De frente, el lado derecho del jugador queda a la izquierda de quien mira;
// de espaldas, a la derecha.

// vista: "frente" | "espalda"; region: la que está acercada (o null);
// elegida: { parte, region } que va pintada; disponibles: las partes de la
// figura que se pueden tocar (las que el club no escondió);
// regionesDisponibles: las regiones que se pueden tocar (si no se pasan, las
// que tienen alguna parte disponible). onRegion / onParte reciben la región
// o la parte tocada; sin ellas la figura es solo para mirar.
export const FiguraCuerpo = ({
  vista = "frente",
  region = null,
  elegida = null,
  disponibles = null,
  regionesDisponibles = null,
  nombreDeRegion = (clave) => clave,
  nombreDeParte = (clave) => clave,
  onRegion,
  onParte,
  chica = false,
  etiquetas = null,
}) => {
  const zoom = zoomA(region, vista);
  const sePuede = (parte) => !disponibles || disponibles.includes(parte);
  // La región acercada se dibuja al final, encima de las otras.
  const regiones = [...ORDEN_DE_REGIONES].sort((a, b) => (a === region) - (b === region));
  const tocar = (accion) => (evento) => {
    if (evento.type === "keydown" && evento.key !== "Enter" && evento.key !== " ") return;
    evento.preventDefault();
    accion();
  };

  return (
    <div className={`figura-cuerpo ${chica ? "chica" : ""} ${region ? "acercada" : ""}`.trim()}>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="group" aria-label={etiquetas?.figura}>
        <g className="figura-cuerpo-zoom" style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.escala})` }}>
          {regiones.map((clave) => {
            const dibujo = dibujoDe(clave, vista);
            const activa = region === clave;
            const tocable = !chica && (regionesDisponibles ? regionesDisponibles.includes(clave) : dibujo.piezas.some((pieza) => sePuede(pieza.parte)));
            // Sin región elegida, la región entera es un botón. Con una
            // acercada, las otras quedan de fondo: no se tocan.
            const comoRegion = tocable && onRegion && !region;
            return (
              <g
                key={clave}
                data-region={clave}
                className={`figura-cuerpo-region ${activa ? "activa" : ""} ${region && !activa ? "apagada" : ""} ${comoRegion ? "tocable" : ""}`.trim()}
                transform={dibujo.espejada ? `matrix(-1 0 0 1 ${ANCHO} 0)` : undefined}
                role={comoRegion ? "button" : undefined}
                tabIndex={comoRegion ? 0 : undefined}
                aria-label={comoRegion ? nombreDeRegion(clave) : undefined}
                onClick={comoRegion ? tocar(() => onRegion(clave)) : undefined}
                onKeyDown={comoRegion ? tocar(() => onRegion(clave)) : undefined}
              >
                {dibujo.piezas.map((pieza) => {
                  const esLaElegida = elegida?.parte === pieza.parte && elegida?.region === clave;
                  const puede = sePuede(pieza.parte);
                  // Con la región acercada, cada parte es un botón.
                  const comoParte = !chica && activa && puede && onParte;
                  const forma = <path d={pieza.camino} className={`figura-cuerpo-pieza ${esLaElegida ? "elegida" : ""} ${puede ? "" : "sin-opcion"}`.trim()} />;
                  return comoParte ? (
                    <g
                      key={pieza.parte}
                      data-parte={pieza.parte}
                      className="figura-cuerpo-parte tocable"
                      role="button"
                      tabIndex={0}
                      aria-label={nombreDeParte(pieza.parte)}
                      aria-pressed={esLaElegida}
                      onClick={tocar(() => onParte(pieza.parte, clave))}
                      onKeyDown={tocar(() => onParte(pieza.parte, clave))}
                    >
                      {forma}
                    </g>
                  ) : (
                    <React.Fragment key={pieza.parte}>{forma}</React.Fragment>
                  );
                })}
                {/* Las líneas del cuerpo (en la figura chica no se verían). */}
                {!chica && dibujo.detalles.map((camino) => <path key={camino} d={camino} className="figura-cuerpo-detalle" />)}
              </g>
            );
          })}
        </g>
      </svg>
      {/* Derecha e izquierda debajo de la figura entera (acercada, ya se sabe). */}
      {etiquetas?.derecha && !region && (
        <div className={`figura-cuerpo-lados ${vista === "espalda" ? "de-espaldas" : ""}`.trim()} aria-hidden="true">
          <span>{etiquetas.derecha}</span>
          <span>{etiquetas.izquierda}</span>
        </div>
      )}
    </div>
  );
};

export default FiguraCuerpo;
