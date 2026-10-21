import React, { useCallback, useEffect, useState } from "react";
import { cuentaDelAparato, guardarCopiaSinSenal, leerCopiaSinSenal } from "../domain/copiaSinSenal.js";
import { idiomaActual, t } from "../idioma/index.js";

// Ver una base sin señal (paso 1 de la nota «cargar sin señal y a la vez que
// otra persona»; Santiago, 21/10: la copia «Automática en todos, sin botón»).
// Lo mismo para Lesiones, Evaluaciones y GPS: la base dice qué guarda y cómo
// se muestra; acá, la copia de este aparato y el aviso.

// De cuándo es la copia: la fecha y la hora (de 0 a 23, así la frase no
// termina en «p. m.»).
const cuando = (iso) => {
  const fecha = new Date(iso || "");
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat(idiomaActual(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(fecha);
};

// Sin señal de verdad (el navegador lo sabe) o una lectura que no llegó.
export const sinSenalAhora = () => typeof navigator !== "undefined" && navigator.onLine === false;
export const falloDeRed = (respuesta) => /Failed to fetch|NetworkError|Load failed/i.test(`${respuesta?.detalle || ""} ${respuesta?.error || ""}`);

// modulo: "lesiones", "evaluaciones" o "gps". deshabilitado: quien ya se fue
// del club (ve la foto de su último día: no guarda copia). Devuelve { activo,
// leer(), guardar(datos) }: activo, si hay cuenta y club para guardarla.
export const useSinSenal = (modulo, equipoId, { deshabilitado = false } = {}) => {
  const [cuenta, setCuenta] = useState(null);

  useEffect(() => {
    let vigente = true;
    cuentaDelAparato().then((leida) => vigente && setCuenta(leida));
    return () => {
      vigente = false;
    };
  }, []);

  // La cuenta se busca de nuevo: la base puede leer antes de que llegue.
  const leer = useCallback(async () => {
    if (deshabilitado || !equipoId) return null;
    const deEsteAparato = cuenta || (await cuentaDelAparato());
    return leerCopiaSinSenal(modulo, deEsteAparato, equipoId);
  }, [modulo, cuenta, equipoId, deshabilitado]);

  const activo = Boolean(cuenta && equipoId && !deshabilitado);
  const guardar = useCallback((datos) => (activo ? guardarCopiaSinSenal(modulo, cuenta, equipoId, datos) : Promise.resolve(null)), [modulo, cuenta, equipoId, activo]);

  return { activo, leer, guardar };
};

// Arriba de la base, mientras se ve la copia: de cuándo es y que para
// cambiar algo hace falta señal.
export const AvisoSinSenal = ({ guardadaEn }) => (
  <div className="aviso-solo-lectura aviso-sin-senal" role="status">
    <b>{t("sinSenal.copiaTitulo")}</b>
    <span>{t("sinSenal.copiaTexto", { fecha: cuando(guardadaEn) })}</span>
  </div>
);
