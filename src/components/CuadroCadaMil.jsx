import React from "react";
import { HojasDeOcultar, OcultasArriba, TocarParaOcultar, useOcultar } from "./Ocultar.jsx";
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
// celdas: [{ texto, tono? }] }]. Columnas y filas se ocultan tocando su
// nombre (Santiago, 15/10); las cuentas no cambian.
export const CuadroCadaMil = ({ titulo, filas }) => {
  const ocultar = useOcultar("lesiones-cada-mil");
  const variantes = VARIANTES.map((variante, indice) => ({ variante, indice })).filter(({ variante }) => !ocultar.columnaOculta(variante.id));
  const filasAVista = filas.filter((fila) => !ocultar.filaOculta(fila.id));
  const deTipos = (soloMusculares) => variantes.filter(({ variante }) => variante.soloMusculares === soloMusculares).length;
  return (
    <div className="informe-bloque">
      <h3 className="informe-cuadro-titulo">{titulo}</h3>
      <OcultasArriba
        ocultar={ocultar}
        columnas={VARIANTES.map((variante) => ({ clave: variante.id, texto: tituloDeVariante(variante) }))}
        filas={filas.map((fila) => ({ clave: fila.id, texto: fila.rotulo }))}
      />
      <div className="informe-cuadro-marco">
        <table className="informe-cuadro" aria-label={titulo}>
          <thead>
            <tr>
              <td rowSpan={2} />
              {deTipos(false) > 0 && (
                <th scope="colgroup" colSpan={deTipos(false)}>
                  {t("lesiones.reportes.tiposTodos")}
                </th>
              )}
              {deTipos(true) > 0 && (
                <th scope="colgroup" colSpan={deTipos(true)} className="informe-lm">
                  {t("lesiones.reportes.tiposLM")}
                </th>
              )}
            </tr>
            <tr>
              {variantes.map(({ variante }) => {
                const nombre = t(variante.sinLeves ? "lesiones.reportes.severidadSinLeves" : "lesiones.reportes.severidadTodas");
                return (
                  <th scope="col" key={variante.id}>
                    {/* Al menos una columna queda a la vista. */}
                    {variantes.length > 1 ? (
                      <TocarParaOcultar ocultar={ocultar} tipo="columna" clave={variante.id} titulo={tituloDeVariante(variante)}>
                        {nombre}
                      </TocarParaOcultar>
                    ) : (
                      nombre
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filasAVista.map((fila) => (
              <tr key={fila.id} className={fila.clase}>
                <th scope="row">
                  <TocarParaOcultar ocultar={ocultar} tipo="fila" clave={fila.id} titulo={fila.rotulo}>
                    {fila.rotulo}
                  </TocarParaOcultar>
                </th>
                {variantes.map(({ variante, indice }) => (
                  <td key={variante.id} className={fila.celdas[indice]?.tono || undefined}>
                    {fila.celdas[indice]?.texto}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <HojasDeOcultar ocultar={ocultar} />
    </div>
  );
};
