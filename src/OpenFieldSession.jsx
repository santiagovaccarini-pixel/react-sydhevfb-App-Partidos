import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { abrirSesionOpenField, mensajeDeRespuesta } from "./trainingApi.js";
import { PantallaAcceso } from "./AccessGate.jsx";

// Antes de entrar a Flujo diario, el servidor abre su sesión de OpenField
// (una cookie) con el token de Supabase de quien entró: ahí comprueba en la
// base que la cuenta esté autorizada y tenga Flujo diario. Cuando Supabase
// renueva el token, la cookie se renueva sola.
export default function OpenFieldSession({ children, onVolver }) {
  const [estado, setEstado] = useState({ fase: "abriendo" });

  const abrir = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setEstado({ fase: "abriendo" });
    try {
      const { respuesta, payload } = await abrirSesionOpenField();
      if (respuesta?.ok && payload?.ok) {
        setEstado({ fase: "lista", rol: payload.rol || "usuario" });
        return;
      }
      if (silencioso) return;
      if (!respuesta) throw new Error("Iniciá sesión para acceder a OpenField.");
      setEstado({
        fase: respuesta.status === 403 ? "sin-acceso" : "error",
        code: payload?.code || "",
        error: mensajeDeRespuesta(payload, "No se pudo abrir la sesión de OpenField. Probá de nuevo."),
      });
    } catch (errorApertura) {
      if (silencioso) return;
      setEstado({ fase: "error", error: errorApertura?.message || "No se pudo abrir la sesión de OpenField. Probá de nuevo." });
    }
  }, []);

  useEffect(() => {
    abrir();
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "TOKEN_REFRESHED") abrir({ silencioso: true });
    });
    return () => data?.subscription?.unsubscribe();
  }, [abrir]);

  if (estado.fase === "lista") {
    return typeof children === "function" ? children({ rol: estado.rol }) : children;
  }

  if (estado.fase === "sin-acceso") {
    return (
      <PantallaAcceso titulo="Sin acceso a Flujo diario" texto={estado.error} onVolver={onVolver} />
    );
  }

  if (estado.fase === "error") {
    return (
      <PantallaAcceso titulo="No pudimos conectar con OpenField" texto={estado.error} onVolver={onVolver}>
        <div className="training-access-form">
          <button type="button" className="training-access-primary" onClick={() => abrir()}>
            Reintentar
          </button>
        </div>
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso titulo="Un momento…" texto="Estamos conectando con OpenField." onVolver={onVolver}>
      <span className="training-access-espera" aria-hidden="true" />
    </PantallaAcceso>
  );
}
