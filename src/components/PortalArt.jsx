import React from "react";

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
