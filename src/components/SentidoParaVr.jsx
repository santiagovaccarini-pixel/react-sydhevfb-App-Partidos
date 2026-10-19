import React from "react";
import { MAS_ES_MEJOR, MENOS_ES_MEJOR } from "../domain/sentido.js";
import { t } from "../idioma/index.js";

// Ajustes › Cabeceras de cada base (GPS, Evaluaciones, Lesiones y Datos
// básicos): «Para los V.R.», si en esta medida más es mejor o menos es mejor
// (src/domain/sentido.js). Va en la hoja de la cabecera, debajo de lo demás,
// solo en las columnas de números y tiempos.
const OPCIONES = [
  [MAS_ES_MEJOR, "lesiones.ajustes.masEsMejor"],
  [MENOS_ES_MEJOR, "lesiones.ajustes.menosEsMejor"],
];

export const SentidoParaVr = ({ valor, onCambiar }) => (
  <div className="sentido-para-vr" role="group" aria-labelledby="sentido-para-vr-titulo">
    <span id="sentido-para-vr-titulo" className="sentido-para-vr-titulo">
      {t("lesiones.ajustes.paraLosVr")}
    </span>
    <div className="grilla-criterios">
      {OPCIONES.map(([sentido, texto]) => (
        <button key={sentido} type="button" className={`chip-criterio ${valor === sentido ? "prendido" : ""}`} aria-pressed={valor === sentido} onClick={() => onCambiar(sentido)}>
          {t(texto)}
        </button>
      ))}
    </div>
    <small className="lesiones-ayuda">{t("lesiones.ajustes.paraLosVrAyuda")}</small>
  </div>
);
