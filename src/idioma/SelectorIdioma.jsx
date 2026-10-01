import React from "react";
import { useIdioma } from "./index.js";

// Dos botones chicos, cada uno escrito en su propio idioma. Va en la puerta
// de acceso y en el portal: el idioma se cambia antes de entrar y después.
export const SelectorIdioma = ({ className = "" }) => {
  const { idioma, idiomas, cambiarIdioma, t } = useIdioma();
  return (
    <div className={`selector-idioma ${className}`.trim()} role="group" aria-label={t("comun.idioma")}>
      {idiomas.map((opcion) => (
        <button
          key={opcion.codigo}
          type="button"
          lang={opcion.codigo}
          className={opcion.codigo === idioma ? "activo" : ""}
          aria-pressed={opcion.codigo === idioma}
          onClick={() => cambiarIdioma(opcion.codigo)}
        >
          {opcion.nombre}
        </button>
      ))}
    </div>
  );
};

export default SelectorIdioma;
