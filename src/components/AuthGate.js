import React, { useEffect, useState } from "react";
import App from "../App";
import { supabase } from "../supabase";
import { EscudoCAM } from "./AppChrome";

const mensajeErrorAcceso = (error) => {
  const mensaje = String(error?.message || "").toLowerCase();

  if (mensaje.includes("rate limit") || mensaje.includes("too many")) {
    return "Se enviaron demasiados enlaces. Esperá un minuto y probá de nuevo.";
  }

  return "No pudimos enviar el enlace. Revisá el correo e intentá nuevamente.";
};

const PantallaAcceso = () => {
  const [correo, setCorreo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState(null);

  const enviarEnlace = async (evento) => {
    evento.preventDefault();
    if (enviando) return;

    const correoNormalizado = correo.trim().toLowerCase();
    if (!correoNormalizado) return;

    setEnviando(true);
    setEstado(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: correoNormalizado,
        options: {
          emailRedirectTo: new URL("/", window.location.origin).toString(),
          shouldCreateUser: true,
        },
      });

      if (error) {
        setEstado({ tipo: "error", texto: mensajeErrorAcceso(error) });
      } else {
        setEstado({
          tipo: "ok",
          texto:
            "Te enviamos un enlace. Abrilo desde este dispositivo para entrar.",
        });
      }
    } catch (error) {
      setEstado({ tipo: "error", texto: mensajeErrorAcceso(error) });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="pantalla-acceso">
      <section className="tarjeta-acceso" aria-labelledby="titulo-acceso">
        <div className="marca-acceso">
          <EscudoCAM />
          <span>ATLÉTICO MINEIRO</span>
        </div>

        <div className="texto-acceso">
          <span className="sobrelinea">REGISTRO OPERATIVO</span>
          <h1 id="titulo-acceso">Entrá a tu cuenta</h1>
          <p>
            Recibí un enlace seguro por correo. Si es tu primera vez, la cuenta
            se crea automáticamente.
          </p>
        </div>

        <form onSubmit={enviarEnlace}>
          <label htmlFor="correo-acceso">Correo electrónico</label>
          <input
            id="correo-acceso"
            name="email"
            type="email"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            placeholder="nombre@correo.com"
            autoComplete="email"
            inputMode="email"
            required
          />
          <button type="submit" disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar enlace de acceso"}
          </button>
        </form>

        {estado && (
          <p className={`estado-acceso ${estado.tipo}`} role="status">
            {estado.texto}
          </p>
        )}

        <p className="nota-acceso">
          Cada cuenta mantiene sus partidos privados. El administrador puede
          consultar el historial general.
        </p>
      </section>
    </main>
  );
};

const CargandoSesion = () => (
  <main className="pantalla-acceso cargando-sesion" aria-live="polite">
    <div className="indicador-carga" aria-hidden="true" />
    <span>Verificando sesión…</span>
  </main>
);

export default function AuthGate() {
  const [sesion, setSesion] = useState(undefined);
  const [cerrando, setCerrando] = useState(false);
  const [errorSesion, setErrorSesion] = useState("");

  useEffect(() => {
    let activo = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!activo) return;
        setErrorSesion(error ? "No pudimos verificar la sesión." : "");
        setSesion(data?.session || null);
      })
      .catch(() => {
        if (!activo) return;
        setErrorSesion("No pudimos verificar la sesión.");
        setSesion(null);
      });

    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      if (!activo) return;
      setErrorSesion("");
      setCerrando(false);
      setSesion(nuevaSesion);
    });

    return () => {
      activo = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const cerrarSesion = async () => {
    if (cerrando) return;
    setCerrando(true);
    setErrorSesion("");

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setCerrando(false);
      setSesion(null);
    } catch (error) {
      setErrorSesion("No se pudo cerrar la sesión. Intentá nuevamente.");
      setCerrando(false);
    }
  };

  if (sesion === undefined) return <CargandoSesion />;
  if (!sesion) return <PantallaAcceso />;

  const correo = sesion.user?.email || "Cuenta autenticada";

  return (
    <div className="aplicacion-autenticada">
      <header className="barra-cuenta" aria-label="Sesión actual">
        <span>
          Sesión: <strong>{correo}</strong>
        </span>
        {errorSesion && <span className="error-sesion">{errorSesion}</span>}
        <button type="button" onClick={cerrarSesion} disabled={cerrando}>
          {cerrando ? "Cerrando…" : "Cerrar sesión"}
        </button>
      </header>
      <App key={sesion.user?.id} session={sesion} />
    </div>
  );
}
