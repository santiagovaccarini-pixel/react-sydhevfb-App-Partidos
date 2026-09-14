import React, { useEffect } from "react";

/**
 * Hoja que sube desde abajo para elegir una opción de una lista. Es la misma
 * forma que la hoja de confirmar, y ocupa el lugar que antes ocupaba el
 * desplegable del sistema: las opciones aparecen sobre la pantalla, grandes y
 * al alcance del pulgar, sin tener que abrir nada más.
 */
export const HojaOpciones = ({
  abierta,
  titulo,
  opciones = [],
  elegida,
  onElegir,
  onCerrar,
}) => {
  useEffect(() => {
    if (!abierta) return undefined;

    const alPresionar = (evento) => {
      if (evento.key === "Escape") onCerrar();
    };

    const desbordeOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alPresionar);

    return () => {
      document.body.style.overflow = desbordeOriginal;
      window.removeEventListener("keydown", alPresionar);
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div
      className="velo-dialogo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <div
        className="hoja-confirmar hoja-opciones"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className="tirador-hoja" />

        <h3>{titulo}</h3>

        <div className="lista-opciones-hoja">
          {opciones.map(({ valor, etiqueta }) => (
            <button
              key={valor}
              type="button"
              className={`opcion-hoja ${valor === elegida ? "activa" : ""}`}
              aria-pressed={valor === elegida}
              onClick={() => onElegir(valor)}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="boton-cancelar-hoja"
          onClick={onCerrar}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
