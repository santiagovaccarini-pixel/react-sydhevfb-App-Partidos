import React from "react";
import { VARIANTES } from "../domain/reportes.js";
import { t } from "../idioma/index.js";

// El nombre de cada columna del cuadro, el del Excel: "Severidad (SIN
// LEVES) y Tipos (SOLO LM)".
export const tituloDeVariante = (variante) =>
  t("lesiones.reportes.variante", {
    severidad: t(variante.sinLeves ? "lesiones.reportes.severidadSinLeves" : "lesiones.reportes.severidadTodas"),
    tipos: t(variante.soloMusculares ? "lesiones.reportes.tiposLM" : "lesiones.reportes.tiposTodos"),
  });

// El cuadro del Excel: las cuatro columnas (severidad todas o sin leves, de
// todos los tipos o solo LM) y una fila por medida: [{ id, rotulo, clase?,
// celdas: [{ texto, tono? }] }].
export const CuadroCadaMil = ({ titulo, filas }) => (
  <div className="informe-bloque">
    <h3 className="informe-cuadro-titulo">{titulo}</h3>
    <div className="informe-cuadro-marco">
      <table className="informe-cuadro" aria-label={titulo}>
        <thead>
          <tr>
            <td rowSpan={2} />
            <th scope="colgroup" colSpan={2}>
              {t("lesiones.reportes.tiposTodos")}
            </th>
            <th scope="colgroup" colSpan={2} className="informe-lm">
              {t("lesiones.reportes.tiposLM")}
            </th>
          </tr>
          <tr>
            {VARIANTES.map((variante) => (
              <th scope="col" key={variante.id}>
                {t(variante.sinLeves ? "lesiones.reportes.severidadSinLeves" : "lesiones.reportes.severidadTodas")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} className={fila.clase}>
              <th scope="row">{fila.rotulo}</th>
              {fila.celdas.map((celda, indice) => (
                <td key={VARIANTES[indice].id} className={celda.tono || undefined}>
                  {celda.texto}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
