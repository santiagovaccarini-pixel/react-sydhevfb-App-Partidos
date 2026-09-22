import React, { useEffect, useId } from "react";

/**
 * Hoja que sube desde el borde inferior con contenido propio (una lista, un
 * formulario corto). Misma cara que HojaConfirmar, pero sin la pregunta fija:
 * quien la usa pone el cuerpo y los botones. Se cierra con Escape, tocando el
 * velo o con el botón que se le pase.
 */
export const HojaInferior = ({
  abierta,
  titulo,
  descripcion,
  className = "",
  acciones = null,
  onCerrar,
  children,
}) => {
  const idTitulo = useId();

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
        className={`hoja-confirmar hoja-inferior ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
      >
        <div className="tirador-hoja" />
        <h3 id={idTitulo}>{titulo}</h3>
        {descripcion && <p>{descripcion}</p>}
        <div className="cuerpo-hoja">{children}</div>
        {acciones && <div className="acciones-hoja">{acciones}</div>}
      </div>
    </div>
  );
};
