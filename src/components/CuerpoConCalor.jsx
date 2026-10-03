import React, { useId, useLayoutEffect, useRef } from "react";
import { ALTO, ANCHO, ORDEN_DE_REGIONES, dibujoDe } from "./siluetaCuerpo.js";
import cuerpoDeFrente from "../assets/cuerpo-frente.webp";
import cuerpoDeEspaldas from "../assets/cuerpo-espalda.webp";

// El mapa corporal de los reportes: la figura del cuerpo (la de cargar una
// lesión) con relieve, como una escultura gris con sus músculos (las
// imágenes las arma scripts/cuerpo-3d/ a partir del mismo dibujo, así que
// las coordenadas coinciden), de frente y de espaldas una al lado de la otra, y una mancha de calor donde hubo lesiones
// (más grande cuantas más), cada una con una línea al nombre de lo
// lesionado: los de la vista de frente a la izquierda, los de la de espaldas
// a la derecha. manchas: { frente, espalda } (manchasDe en
// manchasCuerpo.js); nombreDe(mancha) da el nombre; maxNombres: cuántos
// nombres como mucho en cada vista (las manchas de más quedan sin nombre);
// vistas: { frente, espalda } con el texto debajo de cada una.

const ESPEJO = `matrix(-1 0 0 1 ${ANCHO} 0)`;
// Las imágenes cubren de x = 20 a 180 del lienzo de la figura, todo el alto.
const IMAGEN = { frente: cuerpoDeFrente, espalda: cuerpoDeEspaldas };
const IMAGEN_DESDE = 20;
const IMAGEN_ANCHO = 160;
// La silueta ocupa de x = 32 a 168 del lienzo de la figura.
const DESDE = 32;
const CUERPO = 136;
// El lugar de los nombres a cada lado y entre las dos vistas.
const COSTADO = 108;
const ENTRE_VISTAS = 26;
const ANCHO_TOTAL = COSTADO * 2 + CUERPO * 2 + ENTRE_VISTAS;
const ALTO_TOTAL = ALTO + 36;
const CORRIDA = { frente: COSTADO - DESDE, espalda: COSTADO + CUERPO + ENTRE_VISTAS - DESDE };
const LETRA = 13.5;
const RENGLON = 15;
const ENTRE_NOMBRES = 7;
const LETRAS_POR_RENGLON = 13;
// Un renglón que no entra en su costado se angosta para que no quede
// cortado. Primero se calcula con lo que ocupa cada letra de la letra
// angosta en mayúsculas (de más: solo los que seguro no entran) y después,
// en el navegador, se mide de verdad.
const ANCHO_DE_LETRA = 0.62;
const LUGAR_DEL_NOMBRE = COSTADO - 14;
const ajusteDe = (renglon) => (renglon.length * LETRA * ANCHO_DE_LETRA > LUGAR_DEL_NOMBRE ? { textLength: LUGAR_DEL_NOMBRE, lengthAdjust: "spacingAndGlyphs" } : {});
const ajustarMedidos = (svg) => {
  if (!svg?.isConnected) return;
  svg.querySelectorAll(".cuerpo-calor-nombre text").forEach((texto) => {
    if (typeof texto.getComputedTextLength !== "function") return;
    texto.removeAttribute("textLength");
    texto.removeAttribute("lengthAdjust");
    let largo = 0;
    try {
      largo = texto.getComputedTextLength();
    } catch {
      return;
    }
    if (largo > LUGAR_DEL_NOMBRE) {
      texto.setAttribute("textLength", String(LUGAR_DEL_NOMBRE));
      texto.setAttribute("lengthAdjust", "spacingAndGlyphs");
    }
  });
};
// El tamaño de la mancha: más lesiones, más grande (hasta cuatro).
const radioDe = (cantidad) => 18 + 5 * Math.min(cantidad - 1, 3);

// Un id que sirve adentro de url(#…).
const useIdLimpio = () => `calor-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

// El nombre partido en renglones cortos: entre palabras o después de una
// barra (TORNOZELO/PÉ).
const renglonesDe = (texto) =>
  String(texto || "")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((palabra) => palabra.split(/(?<=\/)/).map((pedazo, indice) => ({ pedazo, pegado: indice > 0 })))
    .reduce((renglones, { pedazo, pegado }) => {
      const ultimo = renglones[renglones.length - 1];
      const junto = ultimo === undefined ? pedazo : `${ultimo}${pegado ? "" : " "}${pedazo}`;
      if (ultimo !== undefined && junto.length <= LETRAS_POR_RENGLON) renglones[renglones.length - 1] = junto;
      else renglones.push(pedazo);
      return renglones;
    }, []);

// Los nombres de una vista: las manchas con el mismo nombre lo comparten (una
// línea a cada una); de arriba abajo a la altura de sus manchas y sin
// pisarse.
const nombresDe = (manchas, nombreDe, maxNombres) => {
  const porNombre = new Map();
  manchas.forEach((mancha) => {
    const nombre = nombreDe(mancha);
    const grupo = porNombre.get(nombre) || { nombre, manchas: [], cantidad: 0 };
    grupo.manchas.push(mancha);
    grupo.cantidad += mancha.cantidad;
    porNombre.set(nombre, grupo);
  });
  const conMasLesiones = [...porNombre.values()]
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, maxNombres)
    .map((grupo) => {
      const renglones = renglonesDe(grupo.cantidad > 1 ? `${grupo.nombre} ×${grupo.cantidad}` : grupo.nombre);
      return { ...grupo, renglones, alto: renglones.length * RENGLON, y: grupo.manchas.reduce((suma, mancha) => suma + mancha.y, 0) / grupo.manchas.length };
    });
  // Los que no entran en el alto de la figura quedan sin nombre (los de
  // menos lesiones): si no, se saldrían por arriba.
  const ocupan = (lista) => lista.reduce((suma, grupo) => suma + grupo.alto, 0) + ENTRE_NOMBRES * Math.max(lista.length - 1, 0);
  while (conMasLesiones.length > 1 && ocupan(conMasLesiones) > ALTO - 8) conMasLesiones.pop();
  const grupos = conMasLesiones.sort((a, b) => a.y - b.y);
  let piso = 6;
  grupos.forEach((grupo) => {
    grupo.arriba = Math.max(grupo.y - grupo.alto / 2, piso);
    piso = grupo.arriba + grupo.alto + ENTRE_NOMBRES;
  });
  // Si se pasaron de abajo, se suben.
  let techo = ALTO - 2;
  [...grupos].reverse().forEach((grupo) => {
    grupo.arriba = Math.min(grupo.arriba, techo - grupo.alto);
    techo = grupo.arriba - ENTRE_NOMBRES;
  });
  return grupos;
};

// Una vista: el cuerpo con relieve, las manchas (solo adentro del cuerpo) y
// los nombres al costado.
const Vista = ({ id, vista, manchas, nombreDe, maxNombres, texto }) => {
  const dibujos = ORDEN_DE_REGIONES.map((region) => ({ region, dibujo: dibujoDe(region, vista) })).filter(({ dibujo }) => dibujo);
  const corrida = CORRIDA[vista];
  const aLaIzquierda = vista === "frente";
  // Dónde terminan las líneas y empiezan los nombres (en el lienzo de la
  // figura, que va corrido).
  const borde = aLaIzquierda ? COSTADO - 6 - corrida : ANCHO_TOTAL - COSTADO + 6 - corrida;
  const xNombre = aLaIzquierda ? borde - 4 : borde + 4;
  const nombres = nombresDe(manchas, nombreDe, maxNombres);
  const clave = `${id}-${vista}`;
  return (
    <g data-vista={vista} transform={`translate(${corrida} 0)`}>
      <defs>
        <clipPath id={`${clave}-cuerpo`}>
          {dibujos.flatMap(({ region, dibujo }) => dibujo.piezas.map((pieza) => <path key={`${region}-${pieza.parte}`} d={pieza.camino} transform={dibujo.espejada ? ESPEJO : undefined} />))}
        </clipPath>
      </defs>
      <image className="cuerpo-calor-figura" href={IMAGEN[vista]} x={IMAGEN_DESDE} y={0} width={IMAGEN_ANCHO} height={ALTO} preserveAspectRatio="none" />
      <g clipPath={`url(#${clave}-cuerpo)`}>
        {manchas.map((mancha) => (
          <circle key={mancha.clave} className="cuerpo-calor-mancha" cx={mancha.x} cy={mancha.y} r={radioDe(mancha.cantidad)} fill={`url(#${id}-calor)`} />
        ))}
      </g>
      {nombres.map((grupo) => (
        <g key={grupo.nombre} className="cuerpo-calor-nombre">
          {grupo.manchas.map((mancha) => (
            <line key={mancha.clave} x1={mancha.x} y1={mancha.y} x2={borde} y2={grupo.arriba + LETRA * 0.6} />
          ))}
          {grupo.renglones.map((renglon, indice) => (
            <text key={indice} x={xNombre} y={grupo.arriba + LETRA * 0.95 + indice * RENGLON} fontSize={LETRA} textAnchor={aLaIzquierda ? "end" : "start"} {...ajusteDe(renglon)}>
              {renglon}
            </text>
          ))}
        </g>
      ))}
      {manchas.map((mancha) => (
        <circle key={mancha.clave} className="cuerpo-calor-punto" cx={mancha.x} cy={mancha.y} r={2.4} />
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

export const CuerpoConCalor = ({ manchas, nombreDe, maxNombres = Infinity, vistas, titulo }) => {
  const id = useIdLimpio();
  const svg = useRef(null);
  // Los nombres medidos de verdad (y de nuevo cuando llega la letra).
  useLayoutEffect(() => {
    const actual = svg.current;
    ajustarMedidos(actual);
    document.fonts?.ready?.then(() => ajustarMedidos(actual));
  });
  return (
    <svg ref={svg} className="cuerpo-calor" viewBox={`0 0 ${ANCHO_TOTAL} ${ALTO_TOTAL}`} role="img" aria-label={titulo}>
      <defs>
        <radialGradient id={`${id}-calor`}>
          <stop offset="0" stopColor="#fff8cf" stopOpacity="1" />
          <stop offset="0.18" stopColor="#ffbe2e" stopOpacity="1" />
          <stop offset="0.45" stopColor="#f5641f" stopOpacity="0.82" />
          <stop offset="0.72" stopColor="#e3342a" stopOpacity="0.38" />
          <stop offset="1" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
      </defs>
      {["frente", "espalda"].map((vista) => (
        <Vista key={vista} id={id} vista={vista} manchas={manchas[vista] || []} nombreDe={nombreDe} maxNombres={maxNombres} texto={vistas?.[vista] || ""} />
      ))}
    </svg>
  );
};

export default CuerpoConCalor;
