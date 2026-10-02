import React from "react";

// La figura del cuerpo, de frente o de espaldas, armada con piezas: cada
// pieza es una parte del cuerpo del catálogo en una región (cabeza, tronco,
// brazos y piernas). Sin región elegida se toca la región entera; con una
// región elegida la figura se acerca a ella y se toca cada parte.
// De frente, el lado derecho del jugador queda a la izquierda de quien mira;
// de espaldas, a la derecha.

const ANCHO = 160;
const ALTO = 340;

const espejo = (x, w) => ANCHO - x - w;

const piezasDeUnLado = (lado, enX) => {
  const brazo = `brazo_${lado === "derecho" ? "derecho" : "izquierdo"}`;
  const pierna = `pierna_${lado === "derecho" ? "derecha" : "izquierda"}`;
  const caja = (region, parte, x, y, w, h, r) => ({ region, parte, x: enX(x, w), y, w, h, r });
  return [
    caja(brazo, "ombro", 36, 58, 18, 18, 9),
    caja(brazo, "braco", 33, 77, 16, 40, 8),
    caja(brazo, "cotovelo", 33, 118, 15, 11, 5.5),
    caja(brazo, "antebraco", 32, 130, 14, 36, 7),
    caja(brazo, "punho", 33, 167, 12, 7, 3.5),
    caja(brazo, "mao", 31, 175, 15, 20, 7),
    caja(pierna, "quadril_virilha", 57, 142, 22, 20, 8),
    caja(pierna, "coxa", 57, 163, 22, 58, 10),
    caja(pierna, "joelho", 58, 222, 20, 15, 7.5),
    caja(pierna, "perna_aquiles", 59, 238, 18, 52, 9),
    caja(pierna, "tornozelo_pe", 61, 291, 14, 10, 5),
    caja(pierna, "pe_dedo", 57, 302, 21, 12, 6),
  ];
};

// Las piezas de cada vista. Las del tronco son caminos; el resto, cajas con
// bordes redondeados. Todas llevan su rectángulo (x, y, w, h) para el zoom.
export const piezasDeLaFigura = (vista) => {
  const espalda = vista === "espalda";
  const delDerecho = espalda ? espejo : (x) => x;
  const delIzquierdo = espalda ? (x) => x : espejo;
  return [
    { region: "cabeza", parte: "cabeca_face", x: 65, y: 10, w: 30, h: 36, elipse: true },
    { region: "cabeza", parte: "pescoco", x: 72, y: 45, w: 16, h: 12, r: 5 },
    { region: "tronco", parte: "esterno", x: 52, y: 54, w: 56, h: espalda ? 54 : 50, camino: espalda ? "M52,59 Q80,54 108,59 L106,104 Q80,108 54,104 Z" : "M52,59 Q80,54 108,59 L106,100 Q80,104 54,100 Z" },
    espalda
      ? { region: "tronco", parte: "coluna_lombar", x: 54, y: 106, w: 52, h: 40, camino: "M54,106 Q80,110 106,106 L103,140 Q80,146 57,140 Z" }
      : { region: "tronco", parte: "abdomen", x: 54, y: 102, w: 52, h: 44, camino: "M54,102 Q80,106 106,102 L103,140 Q80,146 57,140 Z" },
    ...piezasDeUnLado("derecho", delDerecho),
    ...piezasDeUnLado("izquierdo", delIzquierdo),
  ];
};

// Lo que hay que mover y agrandar para que una región llene la figura.
export const zoomA = (piezas, region) => {
  const suyas = piezas.filter((pieza) => pieza.region === region);
  if (!region || suyas.length === 0) return { x: 0, y: 0, escala: 1 };
  const x0 = Math.min(...suyas.map((p) => p.x));
  const y0 = Math.min(...suyas.map((p) => p.y));
  const x1 = Math.max(...suyas.map((p) => p.x + p.w));
  const y1 = Math.max(...suyas.map((p) => p.y + p.h));
  const margen = 10;
  const escala = Math.min(ANCHO / (x1 - x0 + margen * 2), ALTO / (y1 - y0 + margen * 2), 3);
  return { x: ANCHO / 2 - escala * ((x0 + x1) / 2), y: ALTO / 2 - escala * ((y0 + y1) / 2), escala };
};

const Pieza = ({ pieza, clase }) =>
  pieza.camino ? (
    <path d={pieza.camino} className={clase} />
  ) : pieza.elipse ? (
    <ellipse cx={pieza.x + pieza.w / 2} cy={pieza.y + pieza.h / 2} rx={pieza.w / 2} ry={pieza.h / 2} className={clase} />
  ) : (
    <rect x={pieza.x} y={pieza.y} width={pieza.w} height={pieza.h} rx={pieza.r} className={clase} />
  );

// vista: "frente" | "espalda"; region: la que está acercada (o null);
// elegida: { parte, region } que va pintada; disponibles: las partes que se
// pueden tocar (las que el club no escondió). onRegion / onParte reciben la
// región o la parte tocada; sin ellas la figura es solo para mirar.
export const FiguraCuerpo = ({
  vista = "frente",
  region = null,
  elegida = null,
  disponibles = null,
  nombreDeRegion = (clave) => clave,
  nombreDeParte = (clave) => clave,
  onRegion,
  onParte,
  chica = false,
  etiquetas = null,
}) => {
  const piezas = piezasDeLaFigura(vista);
  const zoom = zoomA(piezas, region);
  const sePuede = (pieza) => !disponibles || disponibles.includes(pieza.parte);
  // La región acercada se dibuja al final, encima de las otras (que se
  // enciman en los bordes al agrandar).
  const regiones = [...new Set(piezas.map((pieza) => pieza.region))].sort((a, b) => (a === region) - (b === region));
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
            const suyas = piezas.filter((pieza) => pieza.region === clave);
            const activa = region === clave;
            const tocable = !chica && suyas.some(sePuede);
            // Sin región elegida, la región entera es un botón. Con una
            // acercada, las otras quedan de fondo: no se tocan.
            const comoRegion = tocable && onRegion && !region;
            return (
              <g
                key={clave}
                data-region={clave}
                className={`figura-cuerpo-region ${activa ? "activa" : ""} ${region && !activa ? "apagada" : ""} ${comoRegion ? "tocable" : ""}`.trim()}
                role={comoRegion ? "button" : undefined}
                tabIndex={comoRegion ? 0 : undefined}
                aria-label={comoRegion ? nombreDeRegion(clave) : undefined}
                onClick={comoRegion ? tocar(() => onRegion(clave)) : undefined}
                onKeyDown={comoRegion ? tocar(() => onRegion(clave)) : undefined}
              >
                {suyas.map((pieza) => {
                  const esLaElegida = elegida?.parte === pieza.parte && elegida?.region === clave;
                  const puede = sePuede(pieza);
                  // Con la región acercada, cada parte es un botón.
                  const comoParte = !chica && activa && puede && onParte;
                  const clase = `figura-cuerpo-pieza ${esLaElegida ? "elegida" : ""} ${puede ? "" : "sin-opcion"}`.trim();
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
                      <Pieza pieza={pieza} clase={clase} />
                    </g>
                  ) : (
                    <Pieza key={pieza.parte} pieza={pieza} clase={clase} />
                  );
                })}
              </g>
            );
          })}
          {/* De espaldas, la columna: así se distingue de un vistazo. */}
          {vista === "espalda" && <path d="M80,60 L80,140" className="figura-cuerpo-columna" />}
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
