import React, { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import "./training-access.css";

export default function TrainingAccessGate({ children, onVolver }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usuario, setUsuario] = useState(null);
  const [autorizado, setAutorizado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

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
      throw new Error(payload?.error || "No se pudo autorizar el acceso a OpenField.");
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
        if (session) {
          try {
            await abrirSesionBackend(session);
          } catch (errorBackend) {
            if (activo) setError(errorBackend.message);
          }
        }
      } catch (errorInicio) {
        if (activo) setError(errorInicio?.message || "No se pudo revisar la sesión.");
      } finally {
        if (activo) setCargando(false);
      }
    };

    iniciar();

    const { data } = supabase.auth.onAuthStateChange((evento, session) => {
      if (!activo) return;

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
      setError(errorLogin?.message || "No se pudo iniciar sesión.");
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
        setMensaje("Cuenta creada. Revisá tu correo para confirmar el acceso y después iniciá sesión.");
      }
    } catch (errorRegistro) {
      setError(errorRegistro?.message || "No se pudo crear la cuenta.");
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
      <main className="training-access-page">
        <button type="button" className="training-access-back" onClick={onVolver}>
          ← Módulos
        </button>
        <section className="training-access-card">
          <span className="training-access-lock">🔒</span>
          <h1>Verificando acceso</h1>
          <p>Comprobando la sesión segura del módulo Entrenamiento…</p>
        </section>
      </main>
    );
  }

  if (autorizado) {
    return (
      <div className="training-access-shell">
        <div className="training-access-status">
          <span>🔒 OpenField protegido · {usuario?.email}</span>
          <button type="button" onClick={salir} disabled={accion === "salir"}>
            {accion === "salir" ? "Saliendo…" : "Cerrar sesión"}
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <main className="training-access-page">
      <button type="button" className="training-access-back" onClick={onVolver}>
        ← Módulos
      </button>

      <section className="training-access-card">
        <span className="training-access-kicker">ENTRENAMIENTO · FASE BETA</span>
        <span className="training-access-lock">🔒</span>
        <h1>Acceso protegido</h1>
        <p>
          Iniciá sesión para consultar los datos reales de OpenField. El token de Catapult nunca
          sale del servidor.
        </p>

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
            {accion === "ingresar" ? "Ingresando…" : "Ingresar"}
          </button>

          <button
            type="button"
            className="training-access-secondary"
            onClick={crearCuenta}
            disabled={Boolean(accion)}
          >
            {accion === "crear" ? "Creando…" : "Crear cuenta"}
          </button>
        </form>

        <small>
          Crear una cuenta no otorga acceso automáticamente: el correo también debe estar
          autorizado en el servidor.
        </small>
      </section>
    </main>
  );
}
