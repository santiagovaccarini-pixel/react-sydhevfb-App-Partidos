import React from "react";
import { t } from "../idioma/index.js";
import { fechaCorta } from "../idioma/formatos.js";

// El aviso de quien ya no está en el club: ve lo cargado hasta su último
// día y no puede agregar ni cambiar nada. Igual en todos los módulos.
export const AvisoSoloLectura = ({ hasta, className = "" }) =>
  hasta ? (
    <div className={`aviso-solo-lectura ${className}`.trim()} role="status">
      <b>{t("club.soloLecturaTitulo", { fecha: fechaCorta(hasta) })}</b>
      <span>{t("club.soloLecturaTexto")}</span>
    </div>
  ) : null;
