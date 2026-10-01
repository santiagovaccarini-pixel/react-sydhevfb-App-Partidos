import React, { useEffect, useId, useRef, useState } from "react";
import { useIdioma } from "./index.js";

// Un globo terráqueo arriba a la derecha; al tocarlo se despliega la lista
// de idiomas, cada uno con su bandera. Se cierra tocando afuera o con Escape.

const BanderaAR = () => (
  <svg viewBox="0 0 24 16" aria-hidden="true">
    <rect width="24" height="16" fill="#74acdf" />
    <rect y="5.33" width="24" height="5.34" fill="#fff" />
    <circle cx="12" cy="8" r="1.9" fill="#f6b40e" />
  </svg>
);

const BanderaBR = () => (
  <svg viewBox="0 0 24 16" aria-hidden="true">
    <rect width="24" height="16" fill="#009c3b" />
    <path d="M12 2.2 21 8l-9 5.8L3 8Z" fill="#ffdf00" />
    <circle cx="12" cy="8" r="3.1" fill="#002776" />
  </svg>
);

const BANDERAS = { "es-AR": BanderaAR, "pt-BR": BanderaBR };

const Globo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3Z" />
  </svg>
);

export const SelectorIdioma = ({ className = "" }) => {
  const { idioma, idiomas, cambiarIdioma, t } = useIdioma();
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);
  const idMenu = useId();

  useEffect(() => {
    if (!abierto) return undefined;
    const alTocar = (evento) => {
      if (raiz.current && !raiz.current.contains(evento.target)) setAbierto(false);
    };
    const alTeclear = (evento) => {
      if (evento.key === "Escape") setAbierto(false);
    };
    document.addEventListener("pointerdown", alTocar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("pointerdown", alTocar);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  const BanderaActual = BANDERAS[idioma];

  return (
    <div ref={raiz} className={`selector-idioma ${className}`.trim()}>
      <button
        type="button"
        className="selector-idioma-globo"
        aria-label={t("comun.idioma")}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={idMenu}
        onClick={() => setAbierto((actual) => !actual)}
      >
        <Globo />
        {BanderaActual && (
          <span className="selector-idioma-actual">
            <BanderaActual />
          </span>
        )}
      </button>
      {abierto && (
        <ul id={idMenu} className="selector-idioma-menu" role="menu" aria-label={t("comun.idioma")}>
          {idiomas.map((opcion) => {
            const Bandera = BANDERAS[opcion.codigo];
            const activo = opcion.codigo === idioma;
            return (
              <li key={opcion.codigo} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  lang={opcion.codigo}
                  aria-checked={activo}
                  className={activo ? "activo" : ""}
                  onClick={() => {
                    cambiarIdioma(opcion.codigo);
                    setAbierto(false);
                  }}
                >
                  {Bandera && <Bandera />}
                  <span>{opcion.nombre}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SelectorIdioma;
