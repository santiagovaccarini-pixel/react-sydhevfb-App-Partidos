import React, { useId } from "react";

const trazos = {
  partido: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 8 3-2 3 2-1 4h-4Z" />
      <path d="m5 10 5 2m4 0 5-2M8 20l2-8m6 8-2-8" />
    </>
  ),
  formacion: (
    <>
      <circle cx="12" cy="7" r="3" />
      <circle cx="5" cy="10" r="2" />
      <circle cx="19" cy="10" r="2" />
      <path d="M7 20v-2a5 5 0 0 1 10 0v2M2 20v-2a4 4 0 0 1 5-3.8M22 20v-2a4 4 0 0 0-5-3.8" />
    </>
  ),
  registros: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  cambio: <path d="M4 7h13m0 0-3-3m3 3-3 3M20 17H7m0 0 3 3m-3-3 3-3" />,
  var: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9v6l2-3 2 3V9m3 6V9h3a2 2 0 0 1 0 4h-3" />
    </>
  ),
  hidratacion: (
    <>
      <path d="M9 3h6M10 3v4l-2 3v10h8V10l-2-3V3" />
      <path d="M8 13h8" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  guardar: (
    <>
      <path d="M5 3h12l2 2v16H5Z" />
      <path d="M8 3v6h8V3M8 21v-7h8v7" />
    </>
  ),
  documento: (
    <>
      <path d="M6 2h8l4 4v16H6Z" />
      <path d="M14 2v5h5M9 12h6M9 16h6" />
    </>
  ),
  borrar: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </>
  ),
  flecha: <path d="m9 18 6-6-6-6" />,
};

export const Icono = ({ nombre, size = 22, className = "" }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {trazos[nombre] || trazos.partido}
  </svg>
);

const siluetaEscudo = "M7 25h50v23c0 14.5-9.3 23.2-25 30C16.3 71.2 7 62.5 7 48Z";

export const EscudoCAM = ({ compacto = false }) => {
  const recorte = useId();

  return (
    <span
      className={`escudo-cam ${compacto ? "compacto" : ""}`}
      aria-label="Atlético Mineiro"
    >
      <svg viewBox="0 0 64 82" role="img" aria-hidden="true">
        <defs>
          <clipPath id={recorte}>
            <path d={siluetaEscudo} />
          </clipPath>
        </defs>

        <path
          className="estrella-escudo"
          d="M32 1.5 35.3 8.7 43.2 9.7 37.4 15.1 38.9 22.9 32 19.1 25.1 22.9 26.6 15.1 20.8 9.7 28.7 8.7Z"
        />

        <path className="cuerpo-escudo" d={siluetaEscudo} />

        <g className="franjas-escudo" clipPath={`url(#${recorte})`}>
          <rect x="11" y="44" width="7" height="36" />
          <rect x="25" y="44" width="7" height="36" />
          <rect x="39" y="44" width="7" height="36" />
        </g>

        <path className="contorno-escudo" d={siluetaEscudo} />

        <text x="32" y="39" textAnchor="middle">
          CAM
        </text>
      </svg>
    </span>
  );
};

export const EscudoRival = ({ nombre = "", mini = false }) => {
  const inicial = (String(nombre).trim()[0] || "R").toUpperCase();

  return (
    <span
      className={`escudo-rival ${mini ? "mini" : ""}`}
      aria-label={String(nombre).trim() || "Rival"}
    >
      <svg viewBox="0 0 64 82" role="img" aria-hidden="true">
        <path
          className="cuerpo-escudo-rival"
          d="M7 10h50v38c0 14.5-9.3 23.2-25 30C16.3 71.2 7 62.5 7 48Z"
        />
        <text x="32" y="50" textAnchor="middle">
          {inicial}
        </text>
      </svg>
    </span>
  );
};

const destinos = [
  { id: "partido", etiqueta: "Partido", icono: "partido" },
  { id: "formacion", etiqueta: "Formación", icono: "formacion" },
  { id: "registros", etiqueta: "Registros", icono: "registros" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes", escritorio: true },
];

export const MarcoAplicacion = ({
  activo = "partido",
  onNavigate,
  children,
}) => (
  <div className="marco-aplicacion">
    <aside className="navegacion-escritorio" aria-label="Navegación principal">
      <div className="marca-aplicacion">
        <EscudoCAM />
        <strong>Registro Partido</strong>
      </div>

      <nav>
        {destinos.map((destino) => (
          <button
            key={destino.id}
            type="button"
            className={activo === destino.id ? "activo" : ""}
            onClick={() => onNavigate(destino.id)}
          >
            <Icono nombre={destino.icono} />
            <span>{destino.etiqueta}</span>
          </button>
        ))}
      </nav>
    </aside>

    <main className="contenido-aplicacion">{children}</main>

    <nav className="navegacion-movil" aria-label="Navegación principal">
      {destinos
        .filter((destino) => !destino.escritorio)
        .map((destino) => (
          <button
            key={destino.id}
            type="button"
            className={activo === destino.id ? "activo" : ""}
            onClick={() => onNavigate(destino.id)}
          >
            <Icono nombre={destino.icono} size={21} />
            <span>{destino.etiqueta}</span>
          </button>
        ))}
    </nav>
  </div>
);
