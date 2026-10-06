import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { abrirSesionOpenField, mensajeDeRespuesta } from "./trainingApi.js";
import { PantallaAcceso, esFalloDeRed } from "./AccessGate.jsx";
import { t, useIdioma } from "./idioma/index.js";

// Antes de entrar a Flujo diario, el servidor abre su sesión de OpenField
// (una cookie) con el token de Supabase de quien entró: ahí comprueba en la
// base que la cuenta esté autorizada y tenga Flujo diario. Cuando Supabase
// renueva el token, la cookie se renueva sola.
//
// Sin señal no hay servidor que consultar, y el módulo está hecho para seguir
// trabajando igual (las tareas se guardan en el celular y el envío avisa por
// su cuenta): se entra sin sesión y se abre apenas vuelve la conexión.
const SIN_SENAL = { fase: "lista", rol: "usuario", sinSenal: true };
// Si el servidor falla (5xx), lo mismo que sin señal, con un aviso arriba
// para volver a probar sin salir del módulo.
const SERVIDOR_CAIDO = { ...SIN_SENAL, servidorCaido: true };

export default function OpenFieldSession({ children, onVolver, sinSenal = false }) {
  const [estado, setEstado] = useState({ fase: "abriendo" });
  const [reintentando, setReintentando] = useState(false);
  useIdioma();
  const estadoActual = useRef(estado);
  estadoActual.current = estado;

  const abrir = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setEstado({ fase: "abriendo" });
    try {
      const { respuesta, payload } = await abrirSesionOpenField();
      if (respuesta?.ok && payload?.ok) {
        setEstado({ fase: "lista", rol: payload.rol || "usuario", sinSenal: false });
        return;
      }
      if (silencioso) return;
      if (!respuesta) {
        // Sin token: la sesión venció y no hay señal para renovarla. Adentro
        // igual; con señal habría token.
        if (esFalloDeRed()) {
          setEstado(SIN_SENAL);
          return;
        }
        throw new Error(t("openfield.iniciaSesion"));
      }
      if (respuesta.status >= 500) {
        setEstado(SERVIDOR_CAIDO);
        return;
      }
      setEstado({
        fase: respuesta.status === 403 ? "sin-acceso" : "error",
        code: payload?.code || "",
        // El Catapult del servidor es de un solo club: el resto lo lee en su idioma.
        error: payload?.code === "SIN_CATAPULT" ? t("openfield.sinCatapult") : mensajeDeRespuesta(payload, t("openfield.errorTexto")),
      });
    } catch (errorApertura) {
      if (silencioso) return;
      if (esFalloDeRed(errorApertura)) {
        setEstado(SIN_SENAL);
        return;
      }
      setEstado({ fase: "error", error: errorApertura?.message || t("openfield.errorTexto") });
    }
  }, []);

  useEffect(() => {
    // Quien entró con la copia del celular (sin señal) no espera al servidor:
    // sin conexión, Supabase tarda medio minuto en rendirse con el token.
    if (sinSenal || esFalloDeRed()) setEstado(SIN_SENAL);
    else abrir();

    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "TOKEN_REFRESHED" || evento === "SIGNED_IN") abrir({ silencioso: true });
    });
    const alVolverLaSenal = () => {
      if (estadoActual.current.sinSenal) abrir({ silencioso: true });
    };
    window.addEventListener("online", alVolverLaSenal);
    return () => {
      data?.subscription?.unsubscribe();
      window.removeEventListener("online", alVolverLaSenal);
    };
  }, [abrir, sinSenal]);

  // Reintentar desde el aviso: sin sacar el módulo de la pantalla.
  const reintentar = async () => {
    setReintentando(true);
    await abrir({ silencioso: true });
    setReintentando(false);
  };

  if (estado.fase === "lista") {
    // Siempre con la misma forma: que el aviso se vaya no vuelve a armar el módulo.
    return (
      <>
        {estado.servidorCaido && (
          <div className="aviso-openfield-caido" role="status">
            <span>{t("openfield.servidorCaido")}</span>
            <button type="button" onClick={reintentar} disabled={reintentando}>
              {reintentando ? t("openfield.reintentando") : t("comun.reintentar")}
            </button>
          </div>
        )}
        {typeof children === "function" ? children({ rol: estado.rol, sinSenal: Boolean(estado.sinSenal) }) : children}
      </>
    );
  }

  if (estado.fase === "sin-acceso") {
    return (
      <PantallaAcceso titulo={t("openfield.sinAccesoTitulo")} texto={estado.error} onVolver={onVolver} />
    );
  }

  if (estado.fase === "error") {
    return (
      <PantallaAcceso titulo={t("openfield.errorTitulo")} texto={estado.error} onVolver={onVolver}>
        <div className="training-access-form">
          <button type="button" className="training-access-primary" onClick={() => abrir()}>
            {t("comun.reintentar")}
          </button>
        </div>
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso titulo={t("openfield.abriendoTitulo")} texto={t("openfield.abriendoTexto")} onVolver={onVolver}>
      <span className="training-access-espera" aria-hidden="true" />
    </PantallaAcceso>
  );
}
