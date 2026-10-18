import React, { useCallback, useEffect, useRef, useState } from "react";
import { HojaConfirmar } from "./ConfirmSheet.js";
import { personasSinConfirmar } from "../domain/consentimiento.js";
import { confirmarConsentimientoDelClub, confirmarPersonas, leerConsentimientoDelClub, leerPersonasConfirmadas } from "../domain/consentimientoDb.js";
import { plural, t, useIdioma } from "../idioma/index.js";

// El consentimiento de los atletas (20261103; Santiago, 18/10: el club
// confirma una vez, lo hace el administrador, y mientras no confirme no se
// cargan datos nuevos). En la pantalla principal, a quien sigue en el club:
// el administrador lo confirma ahí; los demás ven que lo tiene que hacer él.
// Si no se pudo leer (sin señal) no se muestra nada: la base frena igual.
export const AvisoConsentimiento = ({ club, adminClub = false }) => {
  useIdioma();
  const equipoId = club?.id || null;
  const activo = Boolean(equipoId) && !club?.hasta && club?.miembro !== false;
  // De qué club es lo leído: al cambiar de club no se muestra lo del otro.
  const [leido, setLeido] = useState({ equipoId: null, confirmado: true, recien: false });
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState("");
  const guardando = useRef(false);

  useEffect(() => {
    if (!activo) return undefined;
    let vigente = true;
    leerConsentimientoDelClub(equipoId).then((respuesta) => {
      if (vigente) setLeido({ equipoId, confirmado: respuesta.confirmado !== false, recien: false });
    });
    return () => {
      vigente = false;
    };
  }, [activo, equipoId]);

  if (!activo || leido.equipoId !== equipoId) return null;
  if (leido.recien) {
    return (
      <p className="aviso-solo-lectura aviso-consentimiento ok" role="status">
        <b>{t("consentimiento.listo")}</b>
      </p>
    );
  }
  if (leido.confirmado) return null;

  const declaracion = t("consentimiento.declaracion", { club: club?.nombre || "" });
  const confirmar = async () => {
    if (guardando.current) return;
    guardando.current = true;
    const respuesta = await confirmarConsentimientoDelClub(equipoId, declaracion);
    guardando.current = false;
    setAbierta(false);
    if (respuesta.error) {
      setError(respuesta.error);
      return;
    }
    setLeido({ equipoId, confirmado: true, recien: true });
  };

  return (
    <>
      <div className="aviso-solo-lectura aviso-consentimiento" role="status">
        <b>{t("consentimiento.titulo")}</b>
        <span>{t(adminClub ? "consentimiento.avisoAdmin" : "consentimiento.avisoStaff")}</span>
        {error && (
          <span className="aviso-consentimiento-error" role="alert">
            {t(error)}
          </span>
        )}
        {adminClub && (
          <button
            type="button"
            className="cuenta-autorizar"
            onClick={() => {
              setError("");
              setAbierta(true);
            }}
          >
            {t("consentimiento.confirmar")}
          </button>
        )}
      </div>
      <HojaConfirmar
        abierta={abierta}
        icono="documento"
        titulo={t("consentimiento.titulo")}
        descripcion={declaracion}
        etiquetaConfirmar={t("consentimiento.confirmo")}
        etiquetaCancelar={t("consentimiento.ahoraNo")}
        onConfirmar={confirmar}
        onCancelar={() => setAbierta(false)}
      />
    </>
  );
};

// Al cargar un archivo con personas que no están en Datos básicos: antes de
// guardar, quien carga confirma las que todavía no estén confirmadas (todas
// juntas). pedir(nombres) devuelve si se puede seguir; hoja va en la
// pantalla. Sin la tabla en la base (falta la migración), no pregunta.
export const useConsentimientoPersonas = (equipoId, base) => {
  useIdioma();
  const [pedido, setPedido] = useState(null);
  const resolver = useRef(null);

  const terminar = useCallback((sePuede) => {
    const alTerminar = resolver.current;
    resolver.current = null;
    setPedido(null);
    alTerminar?.(sePuede);
  }, []);

  // Si la pantalla se va con la hoja abierta, no se carga nada.
  useEffect(() => () => resolver.current?.(false), []);

  const pedir = useCallback(
    async (nombres) => {
      if (!equipoId || !(nombres || []).some((nombre) => String(nombre ?? "").trim())) return { sigue: true, error: "" };
      const leidas = await leerPersonasConfirmadas(equipoId);
      if (leidas.sinTabla) return { sigue: true, error: "" };
      const faltan = personasSinConfirmar(nombres, leidas.personas);
      if (faltan.length === 0) return { sigue: true, error: "" };
      const sigue = await new Promise((resolve) => {
        resolver.current = resolve;
        setPedido({ personas: faltan, error: "" });
      });
      if (!sigue) return { sigue: false, error: "" };
      const texto = plural("consentimiento.personas.texto", faltan.length);
      const guardado = await confirmarPersonas(equipoId, base, faltan, texto);
      return guardado.error ? { sigue: false, error: guardado.error } : { sigue: true, error: "" };
    },
    [equipoId, base],
  );

  const hoja = (
    <HojaConfirmar
      abierta={Boolean(pedido)}
      icono="documento"
      titulo={t("consentimiento.personas.titulo")}
      descripcion={pedido ? plural("consentimiento.personas.texto", pedido.personas.length) : ""}
      detalle={
        pedido ? (
          <ul className="consentimiento-personas" aria-label={t("consentimiento.personas.lista")}>
            {pedido.personas.map((nombre) => (
              <li key={nombre}>{nombre}</li>
            ))}
          </ul>
        ) : null
      }
      etiquetaConfirmar={t("consentimiento.personas.confirmar")}
      etiquetaCancelar={t("comun.volver")}
      onConfirmar={() => terminar(true)}
      onCancelar={() => terminar(false)}
    />
  );

  return { pedir, hoja };
};
