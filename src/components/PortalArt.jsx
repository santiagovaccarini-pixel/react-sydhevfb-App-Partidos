import React from "react";
import { ANCHO as ANCHO_FIGURA, ORDEN_DE_REGIONES, dibujoDe } from "./siluetaCuerpo.js";

// Dibujos e íconos del portal. Van en código (SVG) para que carguen al toque
// y sin internet; el día que haya fotos del club, se cambian por ellas.

// Cancha vista desde arriba, con la pelota: el fondo de la tarjeta Partido.
export const ArtePartido = () => (
  <svg className="portal-arte" viewBox="0 0 420 260" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
    <defs>
      <linearGradient id="pasto" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#0f6b3b" />
        <stop offset="1" stopColor="#063b22" />
      </linearGradient>
      <radialGradient id="luz-partido" cx="0.72" cy="0.3" r="0.6">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="franjas" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.07" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <rect width="420" height="260" fill="url(#pasto)" />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <rect key={i} x={110 + i * 52} y="0" width="26" height="260" fill="url(#franjas)" />
    ))}
    <g fill="none" stroke="#e8fff1" strokeOpacity="0.55" strokeWidth="2">
      <rect x="120" y="18" width="380" height="224" rx="2" />
      <line x1="310" y1="18" x2="310" y2="242" />
      <circle cx="310" cy="130" r="38" />
      <rect x="120" y="66" width="70" height="128" />
      <rect x="120" y="96" width="28" height="68" />
      <path d="M190 100 a 38 38 0 0 1 0 60" />
    </g>
    <circle cx="310" cy="130" r="3" fill="#e8fff1" fillOpacity="0.7" />
    <rect width="420" height="260" fill="url(#luz-partido)" />
    <g transform="translate(346 66) scale(1.35)">
      <circle r="22" fill="#f8fafc" />
      <path d="M0 -10 9 -3 6 8h-12l-3 -11z" fill="#1f2937" />
      <path d="M0 -10v-12M9 -3l11 -4M6 8l7 10M-6 8l-7 10M-9 -3l-11 -4" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
      <circle r="22" fill="none" stroke="#0b1220" strokeOpacity="0.25" strokeWidth="2" />
    </g>
  </svg>
);

// La huella de los chalecos sobre la cancha, la nube y la planilla: el fondo
// de la tarjeta del flujo diario.
export const ArteFlujo = () => (
  <svg className="portal-arte" viewBox="0 0 420 260" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
    <defs>
      <linearGradient id="noche" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#123f6b" />
        <stop offset="1" stopColor="#071a2e" />
      </linearGradient>
      <radialGradient id="luz-flujo" cx="0.7" cy="0.25" r="0.65">
        <stop offset="0" stopColor="#7dd3fc" stopOpacity="0.28" />
        <stop offset="1" stopColor="#7dd3fc" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="traza" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fbbf24" />
        <stop offset="1" stopColor="#f97316" />
      </linearGradient>
    </defs>
    <rect width="420" height="260" fill="url(#noche)" />
    <g fill="none" stroke="#bfdbfe" strokeOpacity="0.28" strokeWidth="2">
      <rect x="130" y="40" width="330" height="200" rx="2" />
      <line x1="295" y1="40" x2="295" y2="240" />
      <circle cx="295" cy="140" r="34" />
      <rect x="130" y="84" width="60" height="112" />
    </g>
    <rect width="420" height="260" fill="url(#luz-flujo)" />
    <path
      d="M150 200 C 190 150, 210 220, 250 170 S 300 90, 340 120 S 380 200, 410 150"
      fill="none"
      stroke="url(#traza)"
      strokeWidth="4"
      strokeLinecap="round"
      strokeDasharray="1 9"
    />
    {[
      [150, 200],
      [250, 170],
      [340, 120],
      [410, 150],
    ].map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="#fbbf24" />
    ))}
    <g transform="translate(286 18) scale(1.25)">
      <path
        d="M14 46h56a18 18 0 0 0 2-36 26 26 0 0 0-50-6 20 20 0 0 0-8 42z"
        fill="#e0f2fe"
        fillOpacity="0.92"
      />
      <path d="M42 40V16m0 0-9 9m9-9 9 9" fill="none" stroke="#0369a1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <g transform="translate(316 184)">
      <rect x="0" y="0" width="92" height="52" rx="8" fill="#0b1220" fillOpacity="0.55" stroke="#bae6fd" strokeOpacity="0.5" />
      {[12, 30, 48, 66].map((x, i) => (
        <rect key={x} x={x} y={40 - [16, 28, 20, 34][i]} width="10" height={[16, 28, 20, 34][i]} rx="2" fill="#7dd3fc" />
      ))}
    </g>
  </svg>
);

// Íconos de las tarjetas: la pelota y la nube.
export const IconoPartido = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="3" />
    <path d="M32 19l11 8-4 13H25l-4-13 11-8z" fill="currentColor" />
    <path
      d="M32 19V9M43 27l10-4M39 40l6 9M25 40l-6 9M21 27l-10-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

// La nube con la flecha de subir: lo del día termina en la nube. Trazos
// limpios y gruesos para que se lea chico, sobre la foto.
export const IconoFlujo = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path
      d="M47 27h-3.15A20 20 0 1 0 24.5 52H47a12.5 12.5 0 0 0 0-25z"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
    <path
      d="M32 43V28m-7 7 7-7 7 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Discos de una base de datos, con la luz dorada, delante de dos tableros:
// el dibujo de la tarjeta Bases de Datos si la foto no carga.
const DISCOS_GRANDES = [182, 150, 118];
const DISCOS_CHICOS = [184, 162];

const Disco = ({ cx, y, rx, ry, alto, opacidad = 1 }) => (
  <g opacity={opacidad}>
    <path d={`M${cx - rx} ${y} v${alto} a${rx} ${ry} 0 0 0 ${2 * rx} 0 v${-alto} z`} fill="url(#cuerpo-base)" />
    <path d={`M${cx - rx} ${y + alto / 2} a${rx} ${ry} 0 0 0 ${2 * rx} 0`} fill="none" stroke="#f0c978" strokeWidth="2" />
    <ellipse cx={cx} cy={y} rx={rx} ry={ry} fill="#2b2316" stroke="#f0c978" strokeOpacity="0.75" strokeWidth="1.5" />
  </g>
);

export const ArteBases = () => (
  <svg className="portal-arte" viewBox="0 0 420 260" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
    <defs>
      <linearGradient id="noche-bases" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#1d170d" />
        <stop offset="1" stopColor="#060504" />
      </linearGradient>
      <radialGradient id="luz-bases" cx="0.74" cy="0.6" r="0.55">
        <stop offset="0" stopColor="#f0c978" stopOpacity="0.3" />
        <stop offset="1" stopColor="#f0c978" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="cuerpo-base" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#0d0b07" />
        <stop offset="0.45" stopColor="#3a3020" />
        <stop offset="1" stopColor="#0d0b07" />
      </linearGradient>
      <linearGradient id="estela-bases" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stopColor="#f0c978" stopOpacity="0.9" />
        <stop offset="1" stopColor="#f0c978" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="piso-bases" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f0c978" stopOpacity="0" />
        <stop offset="1" stopColor="#f0c978" stopOpacity="0.12" />
      </linearGradient>
    </defs>
    <rect width="420" height="260" fill="url(#noche-bases)" />
    <rect width="420" height="260" fill="url(#luz-bases)" />
    <g fill="#0b0905" fillOpacity="0.6" stroke="#f0c978" strokeOpacity="0.4" strokeWidth="1.5">
      <rect x="150" y="34" width="104" height="66" rx="6" />
      <rect x="266" y="24" width="136" height="76" rx="6" />
    </g>
    {[0, 1, 2, 3, 4].map((i) => (
      <rect key={i} x={164 + i * 17} y={88 - [18, 30, 22, 40, 28][i]} width="9" height={[18, 30, 22, 40, 28][i]} rx="2" fill="#f0c978" fillOpacity="0.55" />
    ))}
    <polyline points="278,84 298,72 318,78 338,58 358,64 376,44" fill="none" stroke="#f0c978" strokeOpacity="0.7" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="384" cy="80" r="10" fill="none" stroke="#f0c978" strokeOpacity="0.55" strokeWidth="4" strokeDasharray="44 20" />
    <rect y="214" width="420" height="46" fill="url(#piso-bases)" />
    {[0, 1, 2].map((i) => (
      <path key={i} d={`M266 ${170 + i * 14} C 220 ${178 + i * 16}, 170 ${200 + i * 10}, 110 ${206 + i * 12}`} fill="none" stroke="url(#estela-bases)" strokeWidth="2" strokeLinecap="round" />
    ))}
    {DISCOS_CHICOS.map((y) => (
      <Disco key={y} cx={196} y={y} rx={30} ry={8} alto={18} opacidad={0.75} />
    ))}
    {DISCOS_GRANDES.map((y) => (
      <Disco key={y} cx={316} y={y} rx={50} ry={12} alto={26} />
    ))}
  </svg>
);

// Tres discos apilados: una base de datos.
export const IconoBases = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <ellipse cx="32" cy="15" rx="19" ry="7" fill="none" stroke="currentColor" strokeWidth="3.5" />
    <path d="M13 15v34c0 3.9 8.5 7 19 7s19-3.1 19-7V15" fill="none" stroke="currentColor" strokeWidth="3.5" />
    <path d="M13 27c0 3.9 8.5 7 19 7s19-3.1 19-7M13 38c0 3.9 8.5 7 19 7s19-3.1 19-7" fill="none" stroke="currentColor" strokeWidth="3" />
  </svg>
);

// La figura del cuerpo (la misma de la carga de lesiones, siluetaCuerpo.js)
// en dorado sobre negro, con una lesión encendida en el muslo derecho y las
// líneas finas de las fotos: el dibujo de la tarjeta Lesiones si su foto no
// carga (la primera vez sin señal).
const SILUETA = ORDEN_DE_REGIONES.map((region) => dibujoDe(region, "frente"));
const BARRAS_LESIONES = [16, 26, 20, 34, 24];

export const ArteLesiones = () => (
  <svg className="portal-arte" viewBox="0 0 420 260" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
    <defs>
      <linearGradient id="noche-lesiones" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#1f1214" />
        <stop offset="1" stopColor="#050405" />
      </linearGradient>
      <radialGradient id="luz-lesiones" cx="0.76" cy="0.55" r="0.5">
        <stop offset="0" stopColor="#b91c1c" stopOpacity="0.28" />
        <stop offset="1" stopColor="#b91c1c" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="cuerpo-lesiones" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2c2022" />
        <stop offset="1" stopColor="#0c0809" />
      </linearGradient>
      <radialGradient id="calor-lesiones">
        <stop offset="0" stopColor="#ffd6d6" stopOpacity="0.95" />
        <stop offset="0.25" stopColor="#ef4444" stopOpacity="0.85" />
        <stop offset="1" stopColor="#ef4444" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="420" height="260" fill="url(#noche-lesiones)" />
    <rect width="420" height="260" fill="url(#luz-lesiones)" />
    <g fill="none" stroke="#f0c978">
      <circle cx="318" cy="128" r="112" strokeOpacity="0.12" />
      <ellipse cx="318" cy="241" rx="62" ry="11" strokeOpacity="0.25" />
      <ellipse cx="318" cy="241" rx="44" ry="7" strokeOpacity="0.55" />
    </g>
    <g fill="#0b0708" fillOpacity="0.6" stroke="#f0c978" strokeOpacity="0.35" strokeWidth="1.5">
      <rect x="150" y="146" width="96" height="62" rx="6" />
    </g>
    <rect x="160" y="156" width="34" height="4" rx="2" fill="#f0c978" fillOpacity="0.5" />
    {BARRAS_LESIONES.map((alto, i) => (
      <rect key={i} x={162 + i * 16} y={200 - alto} width="9" height={alto} rx="2" fill={i === 3 ? "#ef4444" : "#f0c978"} fillOpacity={i === 3 ? 0.85 : 0.55} />
    ))}
    <g transform="translate(266 16) scale(0.519)" fill="url(#cuerpo-lesiones)" stroke="#f0c978" strokeOpacity="0.7" strokeWidth="2.2" strokeLinejoin="round">
      {SILUETA.map((dibujo, i) => (
        <g key={i} transform={dibujo.espejada ? `matrix(-1 0 0 1 ${ANCHO_FIGURA} 0)` : undefined}>
          {dibujo.piezas.map((pieza) => (
            <path key={pieza.parte} d={pieza.camino} />
          ))}
        </g>
      ))}
    </g>
    <circle cx="309" cy="158" r="17" fill="url(#calor-lesiones)" />
    <circle cx="309" cy="158" r="24" fill="none" stroke="#f0c978" strokeOpacity="0.6" strokeDasharray="4 5" />
    <path d="M331 150 L352 136 H392" fill="none" stroke="#f0c978" strokeOpacity="0.6" strokeWidth="1.2" />
    <circle cx="392" cy="136" r="2.5" fill="#f0c978" />
  </svg>
);

export const IconoLesiones = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="10" y="18" width="44" height="32" rx="7" fill="none" stroke="currentColor" strokeWidth="3.5" />
    <path d="M26 18v-4a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" fill="none" stroke="currentColor" strokeWidth="3.5" />
    <path d="M32 27v14M25 34h14" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

// Un cronómetro dorado y la escala de las clases del Excel de evaluaciones
// (de 5, verde oscuro, a 1, rojo), con el degradé de su formato
// condicional: el dibujo de la tarjeta Evaluaciones mientras no tenga foto.
const CLASES_EVALUACIONES = [
  { color: "#4f6228", largo: 92 },
  { color: "#92d050", largo: 74 },
  { color: "#ffff00", largo: 58 },
  { color: "#f79646", largo: 40 },
  { color: "#ff0000", largo: 26 },
];

export const ArteEvaluaciones = () => (
  <svg className="portal-arte" viewBox="0 0 420 260" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
    <defs>
      <linearGradient id="noche-evaluaciones" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#141a12" />
        <stop offset="1" stopColor="#050605" />
      </linearGradient>
      <radialGradient id="luz-evaluaciones" cx="0.76" cy="0.52" r="0.5">
        <stop offset="0" stopColor="#f0c978" stopOpacity="0.26" />
        <stop offset="1" stopColor="#f0c978" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="esfera-evaluaciones" cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#2a2418" />
        <stop offset="1" stopColor="#0b0906" />
      </radialGradient>
      {CLASES_EVALUACIONES.map((clase, i) => (
        <linearGradient key={clase.color} id={`clase-evaluaciones-${i}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor={clase.color} />
        </linearGradient>
      ))}
    </defs>
    <rect width="420" height="260" fill="url(#noche-evaluaciones)" />
    <rect width="420" height="260" fill="url(#luz-evaluaciones)" />
    <g fill="#0b0906" fillOpacity="0.6" stroke="#f0c978" strokeOpacity="0.35" strokeWidth="1.5">
      <rect x="128" y="64" width="126" height="138" rx="8" />
    </g>
    {CLASES_EVALUACIONES.map((clase, i) => (
      <g key={clase.color}>
        <rect x="140" y={78 + i * 24} width="16" height="16" rx="3" fill="#d9d9d9" fillOpacity="0.9" />
        <text x="148" y={90.5 + i * 24} textAnchor="middle" fontSize="12" fontWeight="700" fill={clase.color}>
          {5 - i}
        </text>
        <rect x="164" y={80 + i * 24} width={clase.largo} height="12" rx="3" fill={`url(#clase-evaluaciones-${i})`} fillOpacity="0.85" />
      </g>
    ))}
    <g fill="none" stroke="#f0c978">
      <circle cx="326" cy="140" r="104" strokeOpacity="0.1" />
      <rect x="314" y="26" width="24" height="14" rx="3" fill="#2b2316" strokeOpacity="0.75" strokeWidth="2" />
      <path d="M326 40v12" strokeOpacity="0.75" strokeWidth="5" />
      <path d="M380 66l10-10" strokeOpacity="0.6" strokeWidth="5" strokeLinecap="round" />
    </g>
    <circle cx="326" cy="140" r="78" fill="url(#esfera-evaluaciones)" stroke="#f0c978" strokeOpacity="0.8" strokeWidth="3" />
    <g stroke="#f0c978" strokeLinecap="round">
      {Array.from({ length: 12 }, (_, i) => {
        const angulo = (i * Math.PI) / 6;
        const largo = i % 3 === 0 ? 12 : 6;
        return (
          <line
            key={i}
            x1={326 + Math.sin(angulo) * 66}
            y1={140 - Math.cos(angulo) * 66}
            x2={326 + Math.sin(angulo) * (66 - largo)}
            y2={140 - Math.cos(angulo) * (66 - largo)}
            strokeOpacity={i % 3 === 0 ? 0.85 : 0.45}
            strokeWidth={i % 3 === 0 ? 3 : 2}
          />
        );
      })}
    </g>
    <path d="M326 140 L326 90" stroke="#f0c978" strokeWidth="3" strokeLinecap="round" />
    <path d="M326 140 L362 160" stroke="#f0c978" strokeOpacity="0.7" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M326 76 A64 64 0 0 1 388 124" fill="none" stroke="#92d050" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" />
    <circle cx="326" cy="140" r="5" fill="#f0c978" />
  </svg>
);

// Un cronómetro.
export const IconoEvaluaciones = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="36" r="20" fill="none" stroke="currentColor" strokeWidth="3.5" />
    <path d="M26 8h12M32 8v8M47 19l4-4" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M32 36V24M32 36l8 5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

// El recorrido de un jugador en la cancha, como lo dibuja el GPS (puntos
// cada vez más claros hasta donde está ahora) y, a la izquierda, una columna
// de la base con los cinco colores del Excel de GPS (de Excelente, verde
// oscuro, a Malo, rojo): el dibujo de la tarjeta GPS mientras no tenga foto.
const COLORES_DEL_DIBUJO_GPS = ["#7FAD94", "#C8E7A7", "#FFFF7F", "#F1B584", "#FF7F7F"];
const RECORRIDO_GPS = [
  [246, 206],
  [262, 188],
  [284, 182],
  [300, 164],
  [296, 140],
  [314, 122],
  [340, 118],
  [356, 100],
  [350, 78],
  [366, 62],
];

export const ArteGps = () => (
  <svg className="portal-arte" viewBox="0 0 420 260" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
    <defs>
      <linearGradient id="noche-gps" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#0e1519" />
        <stop offset="1" stopColor="#040607" />
      </linearGradient>
      <radialGradient id="luz-gps" cx="0.74" cy="0.42" r="0.55">
        <stop offset="0" stopColor="#7fd1c0" stopOpacity="0.22" />
        <stop offset="1" stopColor="#7fd1c0" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="420" height="260" fill="url(#noche-gps)" />
    <rect width="420" height="260" fill="url(#luz-gps)" />
    <g fill="#060a0c" fillOpacity="0.6" stroke="#7fd1c0" strokeOpacity="0.3" strokeWidth="1.5">
      <rect x="112" y="58" width="82" height="150" rx="8" />
    </g>
    {COLORES_DEL_DIBUJO_GPS.map((color, i) => (
      <rect key={color} x="124" y={72 + i * 26} width={58 - i * 6} height="14" rx="3" fill={color} fillOpacity="0.85" />
    ))}
    <g fill="none" stroke="#7fd1c0" strokeOpacity="0.35" strokeWidth="1.5">
      <rect x="216" y="30" width="180" height="200" rx="6" />
      <path d="M216 130h180" />
      <circle cx="306" cy="130" r="26" />
      <rect x="270" y="30" width="72" height="30" />
      <rect x="270" y="200" width="72" height="30" />
    </g>
    <polyline points={RECORRIDO_GPS.map((punto) => punto.join(",")).join(" ")} fill="none" stroke="#7fd1c0" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
    {RECORRIDO_GPS.map(([x, y], i) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r={i === RECORRIDO_GPS.length - 1 ? 6 : 3} fill="#7fd1c0" fillOpacity={0.25 + (0.75 * i) / (RECORRIDO_GPS.length - 1)} />
    ))}
    <circle cx="366" cy="62" r="14" fill="none" stroke="#7fd1c0" strokeOpacity="0.45" strokeWidth="2" />
    <circle cx="366" cy="62" r="24" fill="none" stroke="#7fd1c0" strokeOpacity="0.2" strokeWidth="2" />
  </svg>
);

// Un punto de ubicación con la señal del satélite.
export const IconoGps = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 56s-15-15.5-15-27a15 15 0 0 1 30 0c0 11.5-15 27-15 27z" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
    <circle cx="32" cy="29" r="5.5" fill="none" stroke="currentColor" strokeWidth="3.5" />
    <path d="M44 8a14 14 0 0 1 10 10M43 14a7 7 0 0 1 5 5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

// Una planilla con filas y columnas: el fondo de la tarjeta Datos básicos.
export const ArteDatos = () => (
  <svg className="portal-arte" viewBox="0 0 420 260" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
    <defs>
      <linearGradient id="grafito" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#1f2937" />
        <stop offset="1" stopColor="#0b0d10" />
      </linearGradient>
    </defs>
    <rect width="420" height="260" fill="url(#grafito)" />
    <g stroke="#c8a85a" strokeOpacity="0.35" strokeWidth="1.5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={`h${i}`} x1="150" y1={56 + i * 32} x2="400" y2={56 + i * 32} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`v${i}`} x1={150 + i * 62} y1="56" x2={150 + i * 62} y2="216" />
      ))}
    </g>
    <rect x="150" y="56" width="250" height="32" fill="#c8a85a" fillOpacity="0.28" />
    {[1, 2, 3, 4].map((f) =>
      [0, 1, 2, 3].map((c) => (
        <rect key={`${f}-${c}`} x={158 + c * 62} y={66 + f * 32} width={30 + ((f * 7 + c * 11) % 20)} height="8" rx="4" fill="#f4f6f8" fillOpacity={0.18 + ((f + c) % 3) * 0.08} />
      )),
    )}
  </svg>
);

export const IconoDatos = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="10" y="14" width="44" height="36" rx="6" fill="none" stroke="currentColor" strokeWidth="3.5" />
    <path d="M10 26h44M10 38h44M26 14v36M42 14v36" fill="none" stroke="currentColor" strokeWidth="3" />
  </svg>
);

// Notas: una hoja de anotador con renglones, algunas tildadas, y un lápiz.
export const ArteNotas = () => (
  <svg className="portal-arte" viewBox="0 0 420 260" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
    <defs>
      <linearGradient id="grafito-notas" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#1f2937" />
        <stop offset="1" stopColor="#0b0d10" />
      </linearGradient>
    </defs>
    <rect width="420" height="260" fill="url(#grafito-notas)" />
    <g transform="rotate(-4 290 136)">
      <rect x="196" y="34" width="190" height="204" rx="12" fill="#f4f6f8" fillOpacity="0.08" stroke="#c8a85a" strokeOpacity="0.45" strokeWidth="1.5" />
      <rect x="196" y="34" width="190" height="26" rx="12" fill="#c8a85a" fillOpacity="0.28" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x="214" y={78 + i * 30} width="14" height="14" rx="3" fill="none" stroke="#c8a85a" strokeOpacity="0.6" strokeWidth="1.5" />
          {i < 2 && <path d={`M217 ${85 + i * 30}l4 4 7-9`} fill="none" stroke="#f0c978" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          <rect x="238" y={81 + i * 30} width={70 + ((i * 23) % 60)} height="8" rx="4" fill="#f4f6f8" fillOpacity={i < 2 ? 0.12 : 0.24} />
        </g>
      ))}
    </g>
    <g transform="rotate(38 172 178)">
      <rect x="120" y="170" width="110" height="16" rx="3" fill="#c8a85a" fillOpacity="0.75" />
      <path d="M230 170l18 8-18 8z" fill="#f4f6f8" fillOpacity="0.55" />
      <rect x="112" y="170" width="10" height="16" rx="2" fill="#f4f6f8" fillOpacity="0.3" />
    </g>
  </svg>
);

export const IconoNotas = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="12" y="10" width="40" height="46" rx="6" fill="none" stroke="currentColor" strokeWidth="3.5" />
    <path d="M21 24h22M21 33h22M21 42h14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
