import React, { useId } from "react";
import { ANCHO, ORDEN_DE_REGIONES, dibujoDe } from "./siluetaCuerpo.js";
import { ESQUEMAS, cajaDeParte, estructurasDe } from "./anatomiaCuerpo.js";

// Una parte del cuerpo de cerca, con los músculos, tendones y ligamentos
// dibujados encima (anatomiaCuerpo.js): se toca uno para elegirlo. Es una
// ayuda para tocar con el dedo: lo mismo se elige con los botones de abajo
// (que son los que lee el lector de pantalla), así que el dibujo va oculto
// para él.
//
// estadoDe(estructura, region) dice cómo va cada una: "apagada" (no se
// ofrece en esta parte: no se toca), "elegida", "del-grupo" (es del grupo
// elegido) o "" (se puede tocar). nombreDe(estructura) da su nombre y
// onTocar(estructura, region) recibe la tocada.

// Un músculo, tendón o ligamento. Los finos llevan además un borde invisible
// más ancho, para que se puedan tocar con el dedo.
const Estructura = ({ estructura, region, estado, nombre, onTocar }) => {
  const clase = `figura-anatomia-${estructura.tipo} ${estado}`.trim();
  if (estado === "apagada" || !onTocar) return <path d={estructura.camino} className={clase} />;
  return (
    <g className="figura-anatomia-tocable" data-campo={estructura.campo} data-codigo={estructura.codigo} data-lado={estructura.lado || undefined} onClick={() => onTocar(estructura, region)}>
      <title>{nombre}</title>
      <path d={estructura.camino} className={clase} />
      {estructura.tipo !== "musculo" && <path d={estructura.camino} className="figura-anatomia-dedo" />}
    </g>
  );
};

// Un id que sirve adentro de url(#…).
const useIdLimpio = () => `anatomia-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

const ESPEJO = `matrix(-1 0 0 1 ${ANCHO} 0)`;

// pieza y region: la parte elegida; vista: "frente" | "espalda"; capa:
// "superficie" | "profunda" (en la profunda, lo de encima queda apagado).
export const VistaAnatomica = ({ pieza, region, vista, capa = "superficie", titulo, estadoDe, nombreDe, onTocar }) => {
  const id = useIdLimpio();
  const caja = cajaDeParte(pieza, region, vista);
  if (!caja) return null;
  // La región de la parte va al final, encima de las vecinas.
  const regiones = [...ORDEN_DE_REGIONES].sort((a, b) => (a === region) - (b === region));
  const deLaParte = dibujoDe(region, vista);
  return (
    <figure className="figura-anatomia" data-vista={vista}>
      {titulo && <figcaption>{titulo}</figcaption>}
      <svg viewBox={caja.join(" ")} aria-hidden="true">
        <defs>
          {regiones.map((clave) => (
            <clipPath id={`${id}-${clave}`} key={clave}>
              {dibujoDe(clave, vista).piezas.map((una) => (
                <path key={una.parte} d={una.camino} />
              ))}
            </clipPath>
          ))}
        </defs>
        {regiones.map((clave) => {
          const dibujo = dibujoDe(clave, vista);
          const estructuras = estructurasDe(clave, vista);
          // En la capa profunda, lo de encima queda como sombra (no se toca).
          const encima = capa === "profunda" ? estructuras.filter((estructura) => estructura.capa !== "profunda") : [];
          const deLaCapa = estructuras.filter((estructura) => (estructura.capa === "profunda") === (capa === "profunda"));
          return (
            <g key={clave} data-region={clave} transform={dibujo.espejada ? ESPEJO : undefined}>
              {dibujo.piezas.map((una) => (
                <path key={una.parte} d={una.camino} className={`figura-anatomia-pieza ${clave === region && una.parte === pieza ? "es-la-parte" : ""}`.trim()} />
              ))}
              {dibujo.detalles.map((camino) => (
                <path key={camino} d={camino} className="figura-cuerpo-detalle" />
              ))}
              <g clipPath={`url(#${id}-${clave})`}>
                {encima.map((estructura) => (
                  <path key={estructura.clave} d={estructura.camino} className={`figura-anatomia-${estructura.tipo} apagada encima`} />
                ))}
                {deLaCapa.map((estructura) => (
                  <Estructura key={estructura.clave} estructura={estructura} region={clave} estado={estadoDe(estructura, clave)} nombre={nombreDe(estructura)} onTocar={onTocar} />
                ))}
              </g>
            </g>
          );
        })}
        {/* El borde de la parte elegida, encima de todo (no se toca). */}
        <g transform={deLaParte.espejada ? ESPEJO : undefined}>
          {deLaParte.piezas
            .filter((una) => una.parte === pieza)
            .map((una) => (
              <path key={una.parte} d={una.camino} className="figura-anatomia-borde" />
            ))}
        </g>
      </svg>
    </figure>
  );
};

// Un esquema (rodilla, tobillo, planta del pie) de la parte de region.
// espejado: para la pierna izquierda. rotulo(clave) da el texto corto de
// cada rótulo.
export const EsquemaAnatomico = ({ cual, region, espejado = false, titulo, rotulo, estadoDe, nombreDe, onTocar }) => {
  const esquema = ESQUEMAS[cual];
  if (!esquema) return null;
  const [x, , w] = esquema.caja;
  // Espejado dentro de la misma caja: x' = 2x + w − x.
  const espejo = espejado ? `matrix(-1 0 0 1 ${2 * x + w} 0)` : undefined;
  const enX = (valor) => (espejado ? 2 * x + w - valor : valor);
  const piezas = esquema.piezas.map((pieza, i) => ({ ...pieza, clave: `${cual}:${i}` }));
  const rotulos = piezas.filter((pieza) => pieza.rotulo && pieza.en);
  return (
    <figure className="figura-anatomia figura-anatomia-esquema" data-esquema={cual}>
      {titulo && <figcaption>{titulo}</figcaption>}
      <svg viewBox={esquema.caja.join(" ")} aria-hidden="true">
        <g transform={espejo}>
          {piezas
            .filter((pieza) => pieza.tipo === "hueso")
            .map((pieza) => (
              <path key={pieza.clave} d={pieza.camino} className="figura-anatomia-hueso" />
            ))}
        </g>
        {/* Las líneas de los rótulos de afuera: sobre los huesos, debajo de lo que se toca. */}
        {rotulos
          .filter((pieza) => pieza.hacia)
          .map((pieza) => (
            <line key={`linea-${pieza.clave}`} x1={enX(pieza.en[0])} y1={pieza.en[1]} x2={enX(pieza.hacia[0])} y2={pieza.hacia[1]} className="figura-anatomia-linea" />
          ))}
        <g transform={espejo}>
          {piezas
            .filter((pieza) => pieza.tipo !== "hueso")
            .map((pieza) => (
              <Estructura key={pieza.clave} estructura={pieza} region={region} estado={estadoDe(pieza, region)} nombre={nombreDe(pieza)} onTocar={onTocar} />
            ))}
        </g>
        {rotulos.map((pieza) => (
          <text key={`rotulo-${pieza.clave}`} x={enX(pieza.en[0])} y={pieza.en[1]} fontSize={esquema.letra} className="figura-anatomia-rotulo">
            {rotulo(pieza.rotulo)}
          </text>
        ))}
      </svg>
    </figure>
  );
};
