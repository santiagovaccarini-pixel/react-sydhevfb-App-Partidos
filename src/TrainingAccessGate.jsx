import React, { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { mensajeDeRespuesta } from "./trainingApi.js";
import { IconoFlujo } from "./components/PortalArt.jsx";

const esRecuperacionSolicitada = () => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("training_recovery") === "1";
};

const limpiarParametroRecuperacion = () => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("training_recovery");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
};

// Supabase contesta en inglés; acá se traduce lo que puede pasarle a quien entra.
const textoDeErrorDeAcceso = (error, porDefecto) => {
  const texto = String(error?.message || "");
  if (/invalid login credentials/i.test(texto)) return "El correo o la contraseña no son correctos.";
  if (/email not confirmed/i.test(texto)) return "Todavía no confirmaste tu correo. Revisá la casilla.";
  return porDefecto;
};

// La foto del módulo, borrosa, de fondo: la parada en el celular y la
// apaisada en la computadora (las mismas de la portada).
const fotoDeFondo = () =>
  typeof window !== "undefined" && window.innerHeight > window.innerWidth
    ? "/portal/flujo-parada.webp"
    : "/portal/flujo.webp";

// La puerta de Flujo diario, con la misma pinta que el portal: la foto del
// módulo borrosa atrás, la nube dorada y una tarjeta oscura con lo que haya
// que completar. Arriba, el botón para volver al portal.
const PantallaAcceso = ({ titulo, texto, onVolver, children }) => (
  <main className="training-access-page">
    <div className="training-access-fondo" aria-hidden="true">
      <img src={fotoDeFondo()} alt="" decoding="async" />
    </div>
    {onVolver ? (
      <button type="button" className="training-access-volver" onClick={onVolver}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
        Volver al portal
      </button>
    ) : (
      <span />
    )}
    <section className="training-access-card">
      <span className="portal-icono" aria-hidden="true">
        <IconoFlujo />
      </span>
      <span className="training-access-kicker">Flujo diario</span>
      <h1>{titulo}</h1>
      {texto && <p>{texto}</p>}
      {children}
    </section>
  </main>
);

export default function TrainingAccessGate({ children, onVolver }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usuario, setUsuario] = useState(null);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [modoRecuperacion, setModoRecuperacion] = useState(esRecuperacionSolicitada);
  const [sesionRecuperacion, setSesionRecuperacion] = useState(null);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");

  const abrirSesionBackend = async (session) => {
    if (!session?.access_token) {
      setAutorizado(false);
      return false;
    }

    const respuesta = await fetch("/api/openfield/session", {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const payload = await respuesta.json().catch(() => null);

    if (!respuesta.ok || !payload?.ok) {
      setAutorizado(false);
      throw new Error(mensajeDeRespuesta(payload, "No se pudo comprobar tu acceso. Probá de nuevo."));
    }

    setUsuario({ email: payload.email || session.user?.email || "" });
    setAutorizado(true);
    return true;
  };

  useEffect(() => {
    let activo = true;

    const iniciar = async () => {
      setCargando(true);
      setError("");

      try {
        const { data, error: errorSesion } = await supabase.auth.getSession();
        if (errorSesion) throw errorSesion;
        if (!activo) return;

        const session = data?.session;
        if (esRecuperacionSolicitada()) {
          setModoRecuperacion(true);
          setSesionRecuperacion(session || null);
          if (!session) {
            setError("El enlace de recuperación no pudo validarse o venció. Pedí uno nuevo.");
          }
          return;
        }

        if (session) {
          try {
            await abrirSesionBackend(session);
          } catch (errorBackend) {
            if (activo) setError(errorBackend.message);
          }
        }
      } catch (errorInicio) {
        if (activo) setError(errorInicio?.message || "No se pudo comprobar tu acceso. Probá de nuevo.");
      } finally {
        if (activo) setCargando(false);
      }
    };

    iniciar();

    const { data } = supabase.auth.onAuthStateChange((evento, session) => {
      if (!activo) return;

      if (evento === "PASSWORD_RECOVERY" || (esRecuperacionSolicitada() && session)) {
        setModoRecuperacion(true);
        setSesionRecuperacion(session || null);
        setError("");
        setCargando(false);
        return;
      }

      if (evento === "SIGNED_OUT" || !session) {
        setUsuario(null);
        setAutorizado(false);
        return;
      }

      if (evento === "SIGNED_IN" || evento === "TOKEN_REFRESHED") {
        abrirSesionBackend(session).catch((errorBackend) => {
          if (activo) setError(errorBackend.message);
        });
      }
    });

    return () => {
      activo = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const ingresar = async (event) => {
    event.preventDefault();
    setAccion("ingresar");
    setError("");
    setMensaje("");

    try {
      const { data, error: errorLogin } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (errorLogin) throw errorLogin;
      await abrirSesionBackend(data.session);
      setPassword("");
    } catch (errorLogin) {
      setError(textoDeErrorDeAcceso(errorLogin, "No se pudo entrar. Probá de nuevo."));
    } finally {
      setAccion("");
    }
  };

  const crearCuenta = async () => {
    setAccion("crear");
    setError("");
    setMensaje("");

    try {
      const correo = email.trim();
      if (!correo || !password) {
        throw new Error("Completá correo y contraseña.");
      }

      const { data, error: errorRegistro } = await supabase.auth.signUp({
        email: correo,
        password,
      });

      if (errorRegistro) throw errorRegistro;

      if (data.session) {
        await abrirSesionBackend(data.session);
        setPassword("");
      } else {
        setMensaje("Cuenta creada. Revisá tu correo para confirmarla y después entrá.");
      }
    } catch (errorRegistro) {
      setError(textoDeErrorDeAcceso(errorRegistro, errorRegistro?.message || "No se pudo crear la cuenta."));
    } finally {
      setAccion("");
    }
  };

  const solicitarRestablecimiento = async () => {
    setAccion("recuperar");
    setError("");
    setMensaje("");

    try {
      const correo = email.trim();
      if (!correo) {
        throw new Error("Escribí tu correo primero.");
      }

      const redirectTo = `${window.location.origin}/?training_recovery=1`;
      const { error: errorReset } = await supabase.auth.resetPasswordForEmail(correo, {
        redirectTo,
      });

      if (errorReset) throw errorReset;

      setMensaje(
        "Si ese correo tiene una cuenta, vas a recibir un enlace para elegir una contraseña nueva.",
      );
    } catch (errorReset) {
      setError(errorReset?.message || "No se pudo enviar el correo de recuperación.");
    } finally {
      setAccion("");
    }
  };

  const guardarNuevaPassword = async (event) => {
    event.preventDefault();
    setAccion("cambiar-password");
    setError("");
    setMensaje("");

    try {
      if (!sesionRecuperacion) {
        throw new Error("El enlace de recuperación no es válido. Pedí uno nuevo.");
      }

      if (nuevaPassword.length < 8) {
        throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
      }

      if (nuevaPassword !== confirmarPassword) {
        throw new Error("Las contraseñas no coinciden.");
      }

      const { error: errorUpdate } = await supabase.auth.updateUser({
        password: nuevaPassword,
      });

      if (errorUpdate) throw errorUpdate;

      const { data, error: errorSesion } = await supabase.auth.getSession();
      if (errorSesion) throw errorSesion;
      if (!data?.session) throw new Error("No se pudo abrir la sesión después de cambiar la contraseña.");

      limpiarParametroRecuperacion();
      setModoRecuperacion(false);
      setSesionRecuperacion(null);
      setNuevaPassword("");
      setConfirmarPassword("");
      await abrirSesionBackend(data.session);
    } catch (errorUpdate) {
      setError(errorUpdate?.message || "No se pudo cambiar la contraseña.");
    } finally {
      setAccion("");
    }
  };

  const salir = async () => {
    setAccion("salir");
    setError("");

    try {
      await fetch("/api/openfield/session", {
        method: "DELETE",
        cache: "no-store",
        headers: { Accept: "application/json" },
      }).catch(() => null);
      await supabase.auth.signOut();
      setUsuario(null);
      setAutorizado(false);
      setPassword("");
    } finally {
      setAccion("");
    }
  };

  if (cargando) {
    return (
      <PantallaAcceso titulo="Un momento…" texto="Comprobando tu acceso." onVolver={onVolver}>
        <span className="training-access-espera" aria-hidden="true" />
      </PantallaAcceso>
    );
  }

  if (modoRecuperacion) {
    return (
      <PantallaAcceso
        titulo="Elegí una contraseña nueva"
        texto="Después vas a entrar con esta."
        onVolver={onVolver}
      >
        <form onSubmit={guardarNuevaPassword} className="training-access-form">
          <label>
            Nueva contraseña
            <input
              type="password"
              value={nuevaPassword}
              onChange={(event) => setNuevaPassword(event.target.value)}
              autoComplete="new-password"
              minLength="8"
              required
            />
          </label>

          <label>
            Repetir contraseña
            <input
              type="password"
              value={confirmarPassword}
              onChange={(event) => setConfirmarPassword(event.target.value)}
              autoComplete="new-password"
              minLength="8"
              required
            />
          </label>

          {error && <div className="training-access-message error">{error}</div>}

          <button
            type="submit"
            className="training-access-primary"
            disabled={Boolean(accion) || !sesionRecuperacion}
          >
            {accion === "cambiar-password" ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
      </PantallaAcceso>
    );
  }

  if (autorizado) {
    return typeof children === "function"
      ? children({ email: usuario?.email || "", cerrarSesion: salir })
      : children;
  }

  return (
    <PantallaAcceso
      titulo="Entrá con tu cuenta"
      texto="Tu correo y tu contraseña de la app."
      onVolver={onVolver}
    >
      <form onSubmit={ingresar} className="training-access-form">
        <label>
          Correo
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="nombre@club.com"
            required
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            minLength="8"
            required
          />
        </label>

        {error && <div className="training-access-message error">{error}</div>}
        {mensaje && <div className="training-access-message ok">{mensaje}</div>}

        <button type="submit" className="training-access-primary" disabled={Boolean(accion)}>
          {accion === "ingresar" ? "Entrando…" : "Entrar"}
        </button>

        <div className="training-access-enlaces">
          <button
            type="button"
            className="training-access-enlace"
            onClick={solicitarRestablecimiento}
            disabled={Boolean(accion)}
          >
            {accion === "recuperar" ? "Enviando…" : "Olvidé mi contraseña"}
          </button>

          <button
            type="button"
            className="training-access-enlace"
            onClick={crearCuenta}
            disabled={Boolean(accion)}
          >
            {accion === "crear" ? "Creando…" : "Crear una cuenta"}
          </button>
        </div>
      </form>

      <small>Si creás una cuenta nueva, hay que autorizarla antes de que pueda entrar.</small>
    </PantallaAcceso>
  );
}
