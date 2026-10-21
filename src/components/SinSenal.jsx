import React, { useCallback, useEffect, useState } from "react";
import { Icono } from "./AppChrome";
import { HojaConfirmar } from "./ConfirmSheet.js";
import { activarSinSenal, cuentaDelAparato, desactivarSinSenal, guardarCopiaSinSenal, leerCopiaSinSenal, sinSenalActivo } from "../domain/copiaSinSenal.js";
import { idiomaActual, t } from "../idioma/index.js";

// Ver una base sin señal (paso 1 de la nota «cargar sin señal y a la vez que
// otra persona»; Santiago, 20/10: «Solo donde se active», en cada base; 21/10:
// el botón, en la Base). Lo mismo para Lesiones, Evaluaciones y GPS: la base
// dice qué guarda y cómo se muestra; acá, si está activado, la copia, el aviso
// y el botón.

const nombreDe = (modulo) => t(`cuentas.modulos.${modulo}`);

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
// guardadaEn, leer(), guardar(datos), activar(), desactivar() }.
export const useSinSenal = (modulo, equipoId, { deshabilitado = false } = {}) => {
  const [cuenta, setCuenta] = useState(null);
  const [activo, setActivo] = useState(false);
  const [guardadaEn, setGuardadaEn] = useState(null);

  useEffect(() => {
    let vigente = true;
    cuentaDelAparato().then((leida) => vigente && setCuenta(leida));
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    const ahora = !deshabilitado && sinSenalActivo(modulo, cuenta, equipoId);
    setActivo(ahora);
    setGuardadaEn(null);
    if (!ahora) return undefined;
    let vigente = true;
    leerCopiaSinSenal(modulo, cuenta, equipoId).then((copia) => vigente && setGuardadaEn(copia?.guardadaEn || null));
    return () => {
      vigente = false;
    };
  }, [modulo, cuenta, equipoId, deshabilitado]);

  // La cuenta se busca de nuevo: la base puede leer antes de que llegue.
  const leer = useCallback(async () => {
    if (deshabilitado || !equipoId) return null;
    const deEsteAparato = cuenta || (await cuentaDelAparato());
    return leerCopiaSinSenal(modulo, deEsteAparato, equipoId);
  }, [modulo, cuenta, equipoId, deshabilitado]);

  const guardar = useCallback(
    async (datos) => {
      if (!activo) return null;
      const hora = await guardarCopiaSinSenal(modulo, cuenta, equipoId, datos);
      if (hora) setGuardadaEn(hora);
      return hora;
    },
    [modulo, cuenta, equipoId, activo],
  );

  const activar = useCallback(() => {
    if (deshabilitado || !activarSinSenal(modulo, cuenta, equipoId)) return false;
    setActivo(true);
    return true;
  }, [modulo, cuenta, equipoId, deshabilitado]);

  const desactivar = useCallback(async () => {
    await desactivarSinSenal(modulo, cuenta, equipoId);
    setActivo(false);
    setGuardadaEn(null);
  }, [modulo, cuenta, equipoId]);

  return { activo, guardadaEn, leer, guardar, activar, desactivar, listo: Boolean(cuenta && equipoId) };
};

// Arriba de la base, mientras se ve la copia: de cuándo es y que para
// cambiar algo hace falta señal.
export const AvisoSinSenal = ({ guardadaEn }) => (
  <div className="aviso-solo-lectura aviso-sin-senal" role="status">
    <b>{t("sinSenal.copiaTitulo")}</b>
    <span>{t("sinSenal.copiaTexto", { fecha: cuando(guardadaEn) })}</span>
  </div>
);

// En la Base, al lado de «Pegar desde Excel» (Santiago, 21/10: «Ese boton
// tiene que ir dentro de la base, no en ajustes»): «Ver sin señal en este
// aparato», con «Activado» o «Desactivado». Activar pregunta antes (son datos
// de los atletas en el aparato); desactivar borra la copia. onAviso(texto):
// el aviso de abajo.
export const BotonSinSenal = ({ modulo, sinSenal, onAviso }) => {
  const [hoja, setHoja] = useState(null);
  const base = nombreDe(modulo);
  const confirmar = async () => {
    const era = hoja;
    setHoja(null);
    if (era === "activar") {
      if (sinSenal.activar()) onAviso?.(t("sinSenal.activadoListo", { base }));
      else onAviso?.(t("sinSenal.noSeActivo"));
      return;
    }
    await sinSenal.desactivar();
    onAviso?.(t("sinSenal.desactivadoListo", { base }));
  };
  return (
    <>
      <button
        type="button"
        className="boton-secundario datos-pegar-excel boton-sin-senal"
        aria-pressed={sinSenal.activo}
        title={sinSenal.activo ? "" : t("sinSenal.botonAyuda", { base })}
        onClick={() => setHoja(sinSenal.activo ? "desactivar" : "activar")}
        disabled={!sinSenal.listo}
      >
        <Icono nombre="guardar" size={16} />
        <span>{t("sinSenal.boton")}</span>
        <span className={`estado-sin-senal ${sinSenal.activo ? "activo" : ""}`}>{t(sinSenal.activo ? "sinSenal.activado" : "sinSenal.desactivado")}</span>
      </button>
      <HojaConfirmar
        abierta={hoja === "activar"}
        icono="candado"
        titulo={t("sinSenal.activarTitulo", { base })}
        descripcion={t("sinSenal.activarTexto", { base })}
        detalle={<p className="detalle-sin-senal">{t("sinSenal.activarDetalle", { base })}</p>}
        etiquetaCancelar={t("comun.cancelar")}
        etiquetaConfirmar={t("sinSenal.activar")}
        onConfirmar={confirmar}
        onCancelar={() => setHoja(null)}
      />
      <HojaConfirmar
        abierta={hoja === "desactivar"}
        icono="borrar"
        titulo={t("sinSenal.desactivarTitulo", { base })}
        descripcion={t("sinSenal.desactivarTexto")}
        detalle={sinSenal.guardadaEn ? <p className="detalle-sin-senal">{t("sinSenal.copiaDel", { fecha: cuando(sinSenal.guardadaEn) })}</p> : null}
        etiquetaCancelar={t("comun.cancelar")}
        etiquetaConfirmar={t("sinSenal.desactivar")}
        onConfirmar={confirmar}
        onCancelar={() => setHoja(null)}
      />
    </>
  );
};
