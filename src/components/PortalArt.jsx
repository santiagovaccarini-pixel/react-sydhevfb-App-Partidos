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
