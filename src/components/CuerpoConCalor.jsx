import React, { useId } from "react";
import { ALTO, ANCHO, ORDEN_DE_REGIONES, dibujoDe } from "./siluetaCuerpo.js";
import { estructurasDe } from "./anatomiaCuerpo.js";

// El mapa corporal de los reportes: la figura del cuerpo (la de cargar una
// lesión, con sus músculos y tendones dibujados) con relieve, de frente y de
// espaldas una al lado de la otra, y una mancha de calor donde hubo lesiones
// (más grande cuantas más), cada una con una línea al nombre de lo
// lesionado: los de la vista de frente a la izquierda, los de la de espaldas
// a la derecha. manchas: { frente, espalda } (manchasDe en
// manchasCuerpo.js); nombreDe(mancha) da el nombre; maxNombres: cuántos
// nombres como mucho en cada vista (las manchas de más quedan sin nombre);
// vistas: { frente, espalda } con el texto debajo de cada una.

const ESPEJO = `matrix(-1 0 0 1 ${ANCHO} 0)`;
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
// Lo que ocupa cada letra de la letra angosta en mayúsculas (aproximado): un
// renglón que no entra en su costado se angosta para que no quede cortado.
const ANCHO_DE_LETRA = 0.58;
const LUGAR_DEL_NOMBRE = COSTADO - 14;
const ajusteDe = (renglon) => (renglon.length * LETRA * ANCHO_DE_LETRA > LUGAR_DEL_NOMBRE ? { textLength: LUGAR_DEL_NOMBRE, lengthAdjust: "spacingAndGlyphs" } : {});
// El tamaño de la mancha: más lesiones, más grande (hasta cuatro).
const radioDe = (cantidad) => 15 + 4 * Math.min(cantidad - 1, 3);

// Un id que sirve adentro de url(#…).
const useIdLimpio = () => `calor-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

// El nombre partido en renglones cortos.
const renglonesDe = (texto) =>
  String(texto || "")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((renglones, palabra) => {
      const ultimo = renglones[renglones.length - 1];
      if (ultimo && `${ultimo} ${palabra}`.length <= LETRAS_POR_RENGLON) renglones[renglones.length - 1] = `${ultimo} ${palabra}`;
      else renglones.push(palabra);
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
  const grupos = [...porNombre.values()]
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, maxNombres)
    .map((grupo) => {
      const renglones = renglonesDe(grupo.cantidad > 1 ? `${grupo.nombre} ×${grupo.cantidad}` : grupo.nombre);
      return { ...grupo, renglones, alto: renglones.length * RENGLON, y: grupo.manchas.reduce((suma, mancha) => suma + mancha.y, 0) / grupo.manchas.length };
    })
    .sort((a, b) => a.y - b.y);
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

// Una vista: el cuerpo con relieve, las manchas y los nombres al costado.
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
        {dibujos.map(({ region, dibujo }) => (
          <clipPath id={`${clave}-${region}`} key={region}>
            {dibujo.piezas.map((pieza) => (
              <path key={pieza.parte} d={pieza.camino} />
            ))}
          </clipPath>
        ))}
        <clipPath id={`${clave}-cuerpo`}>
          {dibujos.flatMap(({ region, dibujo }) => dibujo.piezas.map((pieza) => <path key={`${region}-${pieza.parte}`} d={pieza.camino} transform={dibujo.espejada ? ESPEJO : undefined} />))}
        </clipPath>
      </defs>
      <g filter={`url(#${id}-relieve)`}>
        {dibujos.map(({ region, dibujo }) => (
          <g key={region} transform={dibujo.espejada ? ESPEJO : undefined}>
            {dibujo.piezas.map((pieza) => (
              <path key={pieza.parte} d={pieza.camino} className="cuerpo-calor-piel" />
            ))}
            <g clipPath={`url(#${clave}-${region})`}>
              {estructurasDe(region, vista)
                .filter((una) => una.capa !== "profunda" && una.tipo !== "ligamento")
                .map((una) => (
                  <path key={una.clave} d={una.camino} className={`cuerpo-calor-${una.tipo}`} fill={una.tipo === "musculo" ? `url(#${id}-musculo)` : undefined} />
                ))}
            </g>
            {dibujo.detalles.map((camino) => (
              <path key={camino} d={camino} className="cuerpo-calor-detalle" />
            ))}
          </g>
        ))}
      </g>
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
            <text key={renglon} x={xNombre} y={grupo.arriba + LETRA * 0.95 + indice * RENGLON} fontSize={LETRA} textAnchor={aLaIzquierda ? "end" : "start"} {...ajusteDe(renglon)}>
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
  return (
    <svg className="cuerpo-calor" viewBox={`0 0 ${ANCHO_TOTAL} ${ALTO_TOTAL}`} role="img" aria-label={titulo}>
      <defs>
        {/* El relieve: la silueta como una superficie, iluminada de arriba a la izquierda. */}
        <filter id={`${id}-relieve`} x="-8%" y="-3%" width="116%" height="106%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.6" result="alto" />
          <feDiffuseLighting in="alto" surfaceScale="4.5" diffuseConstant="1.12" lightingColor="#ffffff" result="luz">
            <feDistantLight azimuth="230" elevation="52" />
          </feDiffuseLighting>
          <feComposite in="luz" in2="SourceAlpha" operator="in" result="luzAdentro" />
          <feBlend in="SourceGraphic" in2="luzAdentro" mode="multiply" result="sombreado" />
          <feSpecularLighting in="alto" surfaceScale="4.5" specularConstant="0.5" specularExponent="16" lightingColor="#ffffff" result="brillo">
            <feDistantLight azimuth="230" elevation="58" />
          </feSpecularLighting>
          <feComposite in="brillo" in2="SourceAlpha" operator="in" result="brilloAdentro" />
          <feComposite in="sombreado" in2="brilloAdentro" operator="arithmetic" k2="1" k3="0.55" />
        </filter>
        <radialGradient id={`${id}-musculo`} cx="0.42" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#ececef" />
          <stop offset="0.65" stopColor="#c9c9ce" />
          <stop offset="1" stopColor="#a6a6ad" />
        </radialGradient>
        <radialGradient id={`${id}-calor`}>
          <stop offset="0" stopColor="#fff6c2" stopOpacity="1" />
          <stop offset="0.2" stopColor="#ffb21e" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#f2541b" stopOpacity="0.72" />
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
