import React, { useId } from "react";
import { ALTO, ANCHO } from "./siluetaCuerpo.js";
import cuerpoDeFrente from "../assets/cuerpo-frente.webp";
import cuerpoDeEspaldas from "../assets/cuerpo-espalda.webp";

// El mapa corporal de los reportes: la figura del cuerpo (la de cargar una
// lesión) con relieve, como una escultura gris con sus músculos (las
// imágenes las arma scripts/cuerpo-3d/ a partir del mismo dibujo, así que
// las coordenadas coinciden), de frente y de espaldas una al lado de la otra.
// Donde hubo lesiones se pinta solo lo lesionado (el músculo, el tendón, el
// ligamento o la parte del cuerpo), sin pasar de la parte lesionada, más
// intenso cuantas más lesiones; nada más: ni nombres, ni líneas, ni puntos
// (Santiago, 11/10). El nombre se lee al pasar el mouse.
// manchas: { frente, espalda } (manchasDe en manchasCuerpo.js); nombreDe(mancha)
// da el nombre; vistas: { frente, espalda } con el texto debajo de cada una.

const ESPEJO = `matrix(-1 0 0 1 ${ANCHO} 0)`;
// Las imágenes cubren de x = 20 a 180 del lienzo de la figura, todo el alto.
const IMAGEN = { frente: cuerpoDeFrente, espalda: cuerpoDeEspaldas };
const IMAGEN_DESDE = 20;
const IMAGEN_ANCHO = 160;
// La silueta ocupa de x = 32 a 168 del lienzo de la figura.
const DESDE = 32;
const CUERPO = 136;
// El aire a cada lado y entre las dos vistas.
const COSTADO = 14;
const ENTRE_VISTAS = 26;
const ANCHO_TOTAL = COSTADO * 2 + CUERPO * 2 + ENTRE_VISTAS;
const ALTO_TOTAL = ALTO + 36;
const CORRIDA = { frente: COSTADO - DESDE, espalda: COSTADO + CUERPO + ENTRE_VISTAS - DESDE };

// El color del calor: de amarillo (una lesión) a rojo oscuro (el lugar con
// más). Con pocas lesiones la escala llega hasta 4 (una sola no es "lo
// máximo"); con más, hasta la mancha con más lesiones del mapa.
const TONOS = [
  [250, 204, 21],
  [249, 115, 22],
  [220, 38, 38],
  [127, 29, 29],
];
const LESIONES_PARA_EL_MAXIMO = 4;
export const colorDeCalor = (cantidad, tope) => {
  const t = Math.min(Math.max(cantidad / Math.max(tope, LESIONES_PARA_EL_MAXIMO), 0), 1);
  // Una lesión cae en el primer tono; el tope, en el último.
  const lugar = Math.min(Math.max(((t - 1 / LESIONES_PARA_EL_MAXIMO) / (1 - 1 / LESIONES_PARA_EL_MAXIMO)) * (TONOS.length - 1), 0), TONOS.length - 1);
  const desde = Math.floor(lugar);
  const hasta = Math.min(desde + 1, TONOS.length - 1);
  const parte = lugar - desde;
  const [r, g, b] = TONOS[desde].map((valor, i) => Math.round(valor + (TONOS[hasta][i] - valor) * parte));
  return `rgb(${r}, ${g}, ${b})`;
};

// Un id que sirve adentro de url(#…).
const useIdLimpio = () => `calor-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

// Un texto partido después de cada barra, con la barra en el pedazo de antes
// ("TORNOZELO/PÉ" → "TORNOZELO/", "PÉ"). Sin expresiones regulares que miren
// hacia atrás (lookbehind): con una sola, en iPhones con iOS anterior al 16.4
// la app entera no arranca.
export const partirDespuesDeBarras = (texto) => {
  const pedazos = String(texto).split("/");
  const conBarra = pedazos.map((pedazo, indice) => (indice < pedazos.length - 1 ? `${pedazo}/` : pedazo));
  // Si termina en barra, el último queda vacío y no va.
  return conBarra.length > 1 && conBarra[conBarra.length - 1] === "" ? conBarra.slice(0, -1) : conBarra;
};

// Una mancha: lo lesionado pintado (un poco difuso, como calor), recortado
// a la parte lesionada y, en el tronco o la cabeza sin músculo, a la mitad
// del lado del jugador.
const Mancha = ({ id, clave, mancha, color, nombre }) => {
  const { formas = [], parte, espejada, mitad } = mancha.pintar || {};
  const transformar = espejada ? ESPEJO : undefined;
  const conParte = parte ? `${clave}-parte` : null;
  const conMitad = mitad ? `${clave}-mitad` : null;
  return (
    <>
      <defs>
        {conParte && (
          <clipPath id={conParte}>
            <path d={parte} transform={transformar} />
          </clipPath>
        )}
        {conMitad && (
          <clipPath id={conMitad}>
            <rect x={mitad === "izquierda" ? 0 : ANCHO / 2} y={0} width={ANCHO / 2} height={ALTO} />
          </clipPath>
        )}
      </defs>
      {/* Mezclado con la figura: se sigue viendo el relieve del músculo. */}
      <g className="cuerpo-calor-mancha" data-cantidad={mancha.cantidad} clipPath={conParte ? `url(#${conParte})` : undefined} style={{ mixBlendMode: "multiply" }}>
        {nombre && <title>{nombre}</title>}
        <g clipPath={conMitad ? `url(#${conMitad})` : undefined}>
          <g filter={`url(#${id}-difuso)`} fill={color} fillOpacity={0.95}>
            {formas.map((camino, indice) => (
              <path key={indice} d={camino} transform={transformar} />
            ))}
          </g>
        </g>
      </g>
    </>
  );
};

// Una vista: el cuerpo con relieve y lo lesionado pintado.
const Vista = ({ id, vista, manchas, nombreDe, tope, texto }) => {
  const clave = `${id}-${vista}`;
  return (
    <g data-vista={vista} transform={`translate(${CORRIDA[vista]} 0)`}>
      <image className="cuerpo-calor-figura" href={IMAGEN[vista]} x={IMAGEN_DESDE} y={0} width={IMAGEN_ANCHO} height={ALTO} preserveAspectRatio="none" />
      {/* Las de menos lesiones primero: la más intensa queda arriba. */}
      {[...manchas]
        .sort((a, b) => a.cantidad - b.cantidad)
        .map((mancha, indice) => (
          <Mancha key={mancha.clave} id={id} clave={`${clave}-${indice}`} mancha={mancha} color={colorDeCalor(mancha.cantidad, tope)} nombre={nombreDe ? nombreDe(mancha) : ""} />
        ))}
      <g className="cuerpo-calor-vista">
        <rect x={ANCHO / 2 - 46} y={ALTO + 8} width={92} height={24} rx={12} />
        <text x={ANCHO / 2} y={ALTO + 24.5} textAnchor="middle" fontSize={12.5}>
          {texto}
        </text>
      </g>
    </g>
  );
};

export const CuerpoConCalor = ({ manchas, nombreDe = null, vistas, titulo }) => {
  const id = useIdLimpio();
  const todas = [...(manchas?.frente || []), ...(manchas?.espalda || [])];
  const tope = Math.max(0, ...todas.map((mancha) => mancha.cantidad));
  // Lo que se lee sin ver el mapa: cada lugar con sus lesiones.
  const nombreCompleto = nombreDe ? (mancha) => (mancha.cantidad > 1 ? `${nombreDe(mancha)} ×${mancha.cantidad}` : nombreDe(mancha)) : null;
  return (
    <svg className="cuerpo-calor" viewBox={`0 0 ${ANCHO_TOTAL} ${ALTO_TOTAL}`} role="img" aria-label={nombreCompleto && todas.length ? `${titulo}: ${todas.map(nombreCompleto).join(", ")}` : titulo}>
      <defs>
        <filter id={`${id}-difuso`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      {["frente", "espalda"].map((vista) => (
        <Vista key={vista} id={id} vista={vista} manchas={manchas?.[vista] || []} nombreDe={nombreCompleto} tope={tope} texto={vistas?.[vista] || ""} />
      ))}
    </svg>
  );
};

export default CuerpoConCalor;
