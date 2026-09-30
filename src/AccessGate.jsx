import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import {
  guardarPerfilLocal,
  leerMiPerfil,
  leerPerfilLocal,
  permisosDePerfil,
  situacionDePerfil,
} from "./domain/perfilesDb.js";
import { RUTA_SESION_OPENFIELD } from "./trainingApi.js";

// La puerta de la app. Se entra una vez con correo y contraseña (Supabase
// Auth) y de ahí cada cuenta usa lo que tiene habilitado: Partido, Flujo
// diario o todo (administrador). La cuenta se lee de la tabla `perfiles`;
// sin señal se usa la copia guardada en el celular, así en la cancha se
// entra igual.

const esRecuperacionSolicitada = () => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("training_recovery") === "1";
};

export const limpiarParametroRecuperacion = () => {
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

const sinSenal = () => typeof navigator !== "undefined" && navigator.onLine === false;

// La foto del estadio, borrosa, de fondo: la parada en el celular y la
// apaisada en la computadora (las mismas de la portada de Partido).
const fotoDeFondo = () =>
  typeof window !== "undefined" && window.innerHeight > window.innerWidth
    ? "/portal/partido-parada.webp"
    : "/portal/partido.webp";

// La pantalla de la puerta, con la misma pinta que el portal: la foto
// borrosa atrás, el ícono de la app y una tarjeta oscura con lo que haya que
// completar. Arriba, si hay adónde volver, el botón para volver.
export const PantallaAcceso = ({ titulo, texto, onVolver, etiquetaVolver = "Volver al portal", children }) => (
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
        {etiquetaVolver}
      </button>
    ) : (
      <span />
    )}
    <section className="training-access-card">
      <span className="training-access-logo" aria-hidden="true">
        <img src="/icono-app-192.png" alt="" />
      </span>
      <span className="training-access-kicker">Registro Partido</span>
      <h1>{titulo}</h1>
      {texto && <p>{texto}</p>}
      {children}
    </section>
  </main>
);

const Espera = () => <span className="training-access-espera" aria-hidden="true" />;

export default function AccessGate({ children }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [desdeCache, setDesdeCache] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [modoRecuperacion, setModoRecuperacion] = useState(esRecuperacionSolicitada);
  const [sesionRecuperacion, setSesionRecuperacion] = useState(null);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const sesionActual = useRef(null);

  const ponerSesion = (nueva) => {
    sesionActual.current = nueva;
    setSesion(nueva);
  };

  // La cuenta de quien entró: su fila de perfiles. Sin señal, la copia del
  // celular; sin copia, se avisa.
  const resolverPerfil = useCallback(async (session) => {
    const userId = session?.user?.id;
    if (!userId) {
      setPerfil(null);
      return;
    }
    try {
      const fila = await leerMiPerfil(userId);
      const cuenta = fila || { user_id: userId, email: session.user?.email || "", estado: "pendiente" };
      guardarPerfilLocal(fila ? cuenta : null);
      setPerfil(cuenta);
      setDesdeCache(false);
    } catch (errorLectura) {
      const guardado = leerPerfilLocal(userId);
      if (guardado) {
        setPerfil(guardado);
        setDesdeCache(true);
        return;
      }
      setPerfil(null);
      throw new Error(
        sinSenal()
          ? "Sin señal no se pudo comprobar tu cuenta. Probá cuando tengas conexión."
          : errorLectura?.message || "No se pudo comprobar tu cuenta. Probá de nuevo.",
      );
    }
  }, []);

  useEffect(() => {
    let activo = true;

    const iniciar = async () => {
      setCargando(true);
      setError("");

      try {
        const { data, error: errorSesion } = await supabase.auth.getSession();
        if (!activo) return;
        const session = data?.session || null;

        if (esRecuperacionSolicitada()) {
          setModoRecuperacion(true);
          setSesionRecuperacion(session);
          if (!session) {
            setError("El enlace de recuperación no pudo validarse o venció. Pedí uno nuevo.");
          }
          return;
        }

        if (errorSesion && !session) {
          // Sin señal y con la sesión vencida, Supabase no la puede renovar:
          // vale la última cuenta que entró en este celular.
          const guardado = sinSenal() ? leerPerfilLocal() : null;
          if (!guardado) throw errorSesion;
          ponerSesion({ user: { id: guardado.user_id, email: guardado.email || "" }, sinSenal: true });
          setPerfil(guardado);
          setDesdeCache(true);
          return;
        }

        ponerSesion(session);
        if (session) await resolverPerfil(session);
      } catch (errorInicio) {
        if (activo) setError(errorInicio?.message || "No se pudo comprobar tu cuenta. Probá de nuevo.");
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
        ponerSesion(null);
        setPerfil(null);
        return;
      }

      if (evento === "TOKEN_REFRESHED") {
        ponerSesion(session);
        return;
      }

      // Entró en otra pestaña, o volvió una sesión que no teníamos.
      if (evento === "SIGNED_IN" && sesionActual.current?.user?.id !== session.user?.id) {
        ponerSesion(session);
        resolverPerfil(session).catch((errorPerfil) => {
          if (activo) setError(errorPerfil.message);
        });
      }
    });

    return () => {
      activo = false;
      data?.subscription?.unsubscribe();
    };
  }, [resolverPerfil]);

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
      ponerSesion(data.session);
      setPassword("");
      await resolverPerfil(data.session);
    } catch (errorLogin) {
      setError(textoDeErrorDeAcceso(errorLogin, errorLogin?.message || "No se pudo entrar. Probá de nuevo."));
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
        ponerSesion(data.session);
        setPassword("");
        await resolverPerfil(data.session);
      } else {
        setMensaje(
          "Cuenta creada. Confirmá tu correo desde la casilla y entrá; después quien administra la app tiene que autorizarla.",
        );
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
      ponerSesion(data.session);
      await resolverPerfil(data.session);
    } catch (errorUpdate) {
      setError(errorUpdate?.message || "No se pudo cambiar la contraseña.");
    } finally {
      setAccion("");
    }
  };

  const cancelarRecuperacion = () => {
    limpiarParametroRecuperacion();
    setModoRecuperacion(false);
    setSesionRecuperacion(null);
    setError("");
  };

  const volverAComprobar = async () => {
    setAccion("comprobar");
    setError("");
    try {
      await resolverPerfil(sesionActual.current);
    } catch (errorPerfil) {
      setError(errorPerfil.message);
    } finally {
      setAccion("");
    }
  };

  const salir = async () => {
    setAccion("salir");
    setError("");

    try {
      await fetch(RUTA_SESION_OPENFIELD, {
        method: "DELETE",
        cache: "no-store",
        headers: { Accept: "application/json" },
      }).catch(() => null);
      await supabase.auth.signOut().catch(() => null);
    } finally {
      guardarPerfilLocal(null);
      ponerSesion(null);
      setPerfil(null);
      setDesdeCache(false);
      setPassword("");
      setAccion("");
    }
  };

  if (cargando) {
    return (
      <PantallaAcceso titulo="Un momento…" texto="Comprobando tu cuenta.">
        <Espera />
      </PantallaAcceso>
    );
  }

  if (modoRecuperacion) {
    return (
      <PantallaAcceso
        titulo="Elegí una contraseña nueva"
        texto="Después vas a entrar con esta."
        onVolver={cancelarRecuperacion}
        etiquetaVolver="Volver"
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

  if (sesion && perfil) {
    const situacion = situacionDePerfil(perfil);
    const correo = perfil.email || sesion.user?.email || "";

    if (situacion === "ok") {
      return typeof children === "function"
        ? children({
            email: correo,
            userId: sesion.user?.id || perfil.user_id || "",
            permisos: permisosDePerfil(perfil),
            perfil,
            desdeCache,
            cerrarSesion: salir,
          })
        : children;
    }

    const textos = {
      pendiente: {
        titulo: "Tu cuenta está pendiente",
        texto: `Ya quedó creada con ${correo}. Avisale a quien administra la app; cuando la autorice, tocá Volver a comprobar.`,
      },
      bloqueado: {
        titulo: "Tu cuenta no tiene acceso",
        texto: "Si creés que es un error, hablá con quien administra la app.",
      },
      "sin-modulos": {
        titulo: "Tu cuenta no tiene nada habilitado",
        texto: "Quien administra la app tiene que marcarte Partido o Flujo diario. Después tocá Volver a comprobar.",
      },
    }[situacion];

    return (
      <PantallaAcceso titulo={textos.titulo} texto={textos.texto}>
        <div className="training-access-form">
          {error && <div className="training-access-message error">{error}</div>}
          <button type="button" className="training-access-primary" onClick={volverAComprobar} disabled={Boolean(accion)}>
            {accion === "comprobar" ? "Comprobando…" : "Volver a comprobar"}
          </button>
          <div className="training-access-enlaces">
            <button type="button" className="training-access-enlace" onClick={salir} disabled={Boolean(accion)}>
              {accion === "salir" ? "Saliendo…" : "Salir"}
            </button>
          </div>
        </div>
      </PantallaAcceso>
    );
  }

  if (sesion && !perfil) {
    return (
      <PantallaAcceso titulo="No se pudo comprobar tu cuenta" texto={error || "Probá de nuevo en un momento."}>
        <div className="training-access-form">
          <button type="button" className="training-access-primary" onClick={volverAComprobar} disabled={Boolean(accion)}>
            {accion === "comprobar" ? "Comprobando…" : "Reintentar"}
          </button>
          <div className="training-access-enlaces">
            <button type="button" className="training-access-enlace" onClick={salir} disabled={Boolean(accion)}>
              {accion === "salir" ? "Saliendo…" : "Salir"}
            </button>
          </div>
        </div>
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso titulo="Entrá con tu cuenta" texto="Tu correo y tu contraseña de la app.">
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
