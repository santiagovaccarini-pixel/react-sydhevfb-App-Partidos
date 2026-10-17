import React from "react";
import { t } from "../idioma/index.js";
import { fechaCorta } from "../idioma/formatos.js";

// El aviso de quien ya no está en el club: ve lo cargado hasta su último
// día y no puede agregar ni cambiar nada. Igual en todos los módulos. Con
// `mirar`, el de quien tiene el módulo en «Solo lectura» (Cuentas): ve todo,
// al día, y no cambia nada.
export const AvisoSoloLectura = ({ hasta, mirar = false, modulo = "", className = "" }) => {
  if (hasta)
    return (
      <div className={`aviso-solo-lectura ${className}`.trim()} role="status">
        <b>{t("club.soloLecturaTitulo", { fecha: fechaCorta(hasta) })}</b>
        <span>{t("club.soloLecturaTexto")}</span>
      </div>
    );
  if (mirar)
    return (
      <div className={`aviso-solo-lectura ${className}`.trim()} role="status">
        <b>{t("club.soloMirarTitulo", { modulo: modulo ? t(`cuentas.modulos.${modulo}`) : "" })}</b>
        <span>{t("club.soloMirarTexto")}</span>
      </div>
    );
  return null;
};
