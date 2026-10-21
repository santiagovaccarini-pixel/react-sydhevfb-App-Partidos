import React, { useCallback, useEffect, useState } from "react";
import { cuentaDelAparato, guardarCopiaSinSenal, leerCopiaSinSenal } from "../domain/copiaSinSenal.js";
import { idiomaActual, t, useIdioma } from "../idioma/index.js";

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
// leer(), guardar(datos), cuenta }: activo, si hay cuenta y club para
// guardarla; cuenta, la de este aparato (para la fila de espera del paso 3).
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

  return { activo, leer, guardar, cuenta };
};

// Arriba de la base, mientras se ve la copia: de cuándo es y que para
// cambiar algo hace falta señal.
export const AvisoSinSenal = ({ guardadaEn }) => (
  <div className="aviso-solo-lectura aviso-sin-senal" role="status">
    <b>{t("sinSenal.copiaTitulo")}</b>
    <span>{t("sinSenal.copiaTexto", { fecha: cuando(guardadaEn) })}</span>
  </div>
);

// Arriba de una base que deja cargar sin señal (paso 3; Santiago, 21/10, en
// un cuestionario: lo que espera, con un aviso arriba y las filas «de otro
// color»; al volver la señal «Lo sube sola y avisa»). Sin señal: que se ve
// la copia (de cuándo es) y cuántos cambios esperan; con señal, mientras
// algo espera: cuántos, si se están subiendo y, si no, «Subir ahora».
// chocan: los que esperan porque chocan con lo que cargó otra persona.
export const AvisoDeEspera = ({ sinSenal = false, guardadaEn = null, cuantos = 0, chocan = 0, subiendo = false, alSubir = null }) => {
  const { plural } = useIdioma();
  if (!sinSenal && !cuantos) return null;
  const fecha = cuando(guardadaEn);
  return (
    <div className="aviso-solo-lectura aviso-sin-senal aviso-espera" role="status">
      <b>{cuantos ? plural(sinSenal ? "sinSenal.esperanSinSenal" : "sinSenal.esperan", cuantos) : t(fecha ? "sinSenal.copiaTitulo" : "sinSenal.titulo")}</b>
      {sinSenal ? (
        <span>{cuantos ? `${t("sinSenal.seSubenSolos")}${fecha ? ` ${t("sinSenal.copiaDel", { fecha })}` : ""}` : fecha ? t("sinSenal.copiaConCambios", { fecha }) : t("sinSenal.cambiosSinCopia")}</span>
      ) : (
        <span>{subiendo ? t("sinSenal.subiendo") : chocan ? plural("sinSenal.chocan", chocan) : t("sinSenal.seSubenSolosConSenal")}</span>
      )}
      {!sinSenal && !subiendo && alSubir && (
        <button type="button" className="cuenta-autorizar" onClick={alSubir}>
          {t(chocan ? "sinSenal.subirYRevisar" : "sinSenal.subirAhora")}
        </button>
      )}
    </div>
  );
};
