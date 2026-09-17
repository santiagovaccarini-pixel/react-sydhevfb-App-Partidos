import React, { useState } from "react";
import "./training-settings.css";

const usuarioInicial = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("catapult_openfield_username") || "";
};

export default function TrainingSettings({ onVolverRegistro, onVolverModulos }) {
  const [username, setUsername] = useState(usuarioInicial);
  const [password, setPassword] = useState("");
  const [estado, setEstado] = useState("idle");
  const [mensaje, setMensaje] = useState("");

  const probarConexion = async (event) => {
    event.preventDefault();

    const usuarioLimpio = username.trim();
    if (!usuarioLimpio || !password) {
      setEstado("error");
      setMensaje("Completá usuario y contraseña de Catapult.");
      return;
    }

    setEstado("probando");
    setMensaje("Abriendo Catapult y comprobando el acceso a 26-05 T…");

    try {
      const respuesta = await fetch("/api/openfield/cloud-login-test", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: usuarioLimpio,
          password,
        }),
      });

      const payload = await respuesta.json().catch(() => null);
      setPassword("");

      if (!respuesta.ok || !payload?.ok) {
        throw new Error(payload?.error || "No se pudo validar el acceso a Catapult.");
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("catapult_openfield_username", usuarioLimpio);
      }

      setEstado("ok");
      setMensaje(
        payload?.message ||
          "Catapult conectado y actividad 26-05 T abierta correctamente. No se modificó ningún período.",
      );
    } catch (error) {
      setPassword("");
      setEstado("error");
      setMensaje(error?.message || "No se pudo validar el acceso a Catapult.");
    }
  };

  return (
    <main className="entrenamiento-app entrenamiento-ajustes-pagina">
      <header className="entrenamiento-barra">
        <button type="button" className="entrenamiento-volver" onClick={onVolverRegistro}>
          ← Registro
        </button>
        <div>
          <span>Entrenamiento</span>
          <strong>Ajustes</strong>
        </div>
        <button
          type="button"
          className="entrenamiento-ajustes-modulos"
          onClick={onVolverModulos}
        >
          Módulos
        </button>
      </header>

      <section className="entrenamiento-contenido entrenamiento-ajustes-contenido">
        <div className="entrenamiento-ajustes-encabezado">
          <span>Integraciones</span>
          <h1>Catapult OpenField</h1>
          <p>
            Conectá la cuenta que usará la automatización del Cloud Editor. En esta primera prueba
            solo validamos el inicio de sesión y que podamos abrir la actividad 26-05 T.
          </p>
        </div>

        <div className="entrenamiento-ajustes-grid">
          <section className="entrenamiento-panel entrenamiento-ajustes-panel">
            <div className="entrenamiento-panel-titulo">
              <span>01</span>
              <div>
                <h2>Cuenta de Catapult</h2>
                <p>La contraseña se usa únicamente durante la prueba y no se guarda.</p>
              </div>
            </div>

            <form onSubmit={probarConexion}>
              <label>
                Usuario
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Usuario o correo de Catapult"
                  disabled={estado === "probando"}
                />
              </label>

              <label>
                Contraseña
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Contraseña de Catapult"
                  disabled={estado === "probando"}
                />
              </label>

              <button
                type="submit"
                className="entrenamiento-boton-principal"
                disabled={estado === "probando"}
              >
                {estado === "probando" ? "Comprobando acceso…" : "Conectar Catapult"}
              </button>
            </form>

            <div className="entrenamiento-ajustes-seguridad">
              <strong>Seguridad</strong>
              <span>
                La contraseña no se escribe en GitHub, Vercel, localStorage ni Supabase. El backend
                la mantiene solo durante esta solicitud y cierra el navegador al terminar.
              </span>
            </div>
          </section>

          <section className="entrenamiento-panel entrenamiento-ajustes-panel">
            <div className="entrenamiento-panel-titulo">
              <span>02</span>
              <div>
                <h2>Prueba controlada</h2>
                <p>Antes de habilitar cualquier escritura.</p>
              </div>
            </div>

            <div className="entrenamiento-ajustes-objetivo">
              <span>Actividad de prueba</span>
              <strong>26-05 T</strong>
              <small>9dffa100-99e5-4ce6-921f-226e9e01e264</small>
            </div>

            <div
              className={`entrenamiento-ajustes-resultado ${
                estado === "ok" ? "correcto" : estado === "error" ? "error" : ""
              }`}
              aria-live="polite"
            >
              <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
              <div>
                <strong>
                  {estado === "probando"
                    ? "Probando conexión"
                    : estado === "ok"
                      ? "Catapult conectado"
                      : estado === "error"
                        ? "No se pudo conectar"
                        : "Sin probar"}
                </strong>
                <span>
                  {mensaje ||
                    "La prueba iniciará sesión y comprobará que el Editor de 26-05 T sea accesible. No crea, edita ni borra períodos."}
                </span>
              </div>
            </div>

            <div className="entrenamiento-ajustes-limites">
              <strong>Esta etapa no puede escribir</strong>
              <span>
                El endpoint usado acá solo realiza login y navegación. La creación de períodos se
                implementará recién después de validar esta conexión.
              </span>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
