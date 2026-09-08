import React, { useEffect, useRef } from "react";
import { Icono } from "./AppChrome";

/**
 * Hoja de confirmación que sube desde el borde inferior, para reemplazar al
 * window.confirm del navegador. Los botones quedan al alcance del pulgar,
 * que es como se usa la app en el celular.
 */
export const HojaConfirmar = ({
  abierta,
  titulo,
  descripcion,
  detalle,
  icono = "borrar",
  etiquetaConfirmar = "Sí, borrar",
  etiquetaCancelar = "Cancelar",
  onConfirmar,
  onCancelar,
}) => {
  const botonCancelar = useRef(null);

  // Arrancar con el foco en Cancelar: es una acción destructiva, así que un
  // Enter de más no tiene que borrar nada.
  useEffect(() => {
    if (abierta) botonCancelar.current?.focus();
  }, [abierta]);

  useEffect(() => {
    if (!abierta) return undefined;

    const alPresionar = (evento) => {
      if (evento.key === "Escape") onCancelar();
    };

    const desbordeOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alPresionar);

    return () => {
      document.body.style.overflow = desbordeOriginal;
      window.removeEventListener("keydown", alPresionar);
    };
  }, [abierta, onCancelar]);

  if (!abierta) return null;

  return (
    <div
      className="velo-dialogo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCancelar();
      }}
    >
      <div
        className="hoja-confirmar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-hoja-confirmar"
      >
        <div className="tirador-hoja" />

        <span className="icono-hoja">
          <Icono nombre={icono} size={26} />
        </span>

        <h3 id="titulo-hoja-confirmar">{titulo}</h3>
        {descripcion && <p>{descripcion}</p>}
        {detalle && <div className="detalle-hoja">{detalle}</div>}

        <div className="acciones-hoja">
          <button
            type="button"
            ref={botonCancelar}
            className="boton-cancelar-hoja"
            onClick={onCancelar}
          >
            {etiquetaCancelar}
          </button>
          <button
            type="button"
            className="boton-confirmar-hoja"
            onClick={onConfirmar}
          >
            {etiquetaConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
};
