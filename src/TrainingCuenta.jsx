import React, { useEffect, useState } from "react";
import { pedirJson } from "./trainingApi.js";

const formatearFecha = (iso) => {
  const fecha = new Date(iso);
  if (!iso || Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
};

// Cuenta de Catapult OpenField del usuario: se conecta una vez y queda
// guardada cifrada. Desde acá solo se ve, se conecta o se desconecta.
export default function TrainingCuenta({ onCambio }) {
  const [estado, setEstado] = useState("cargando");
  const [cuenta, setCuenta] = useState(null);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");

  const aplicar = (nuevaCuenta) => {
    setCuenta(nuevaCuenta);
    setEstado(nuevaCuenta?.configurada ? "conectada" : "sin-cuenta");
    if (typeof onCambio === "function") onCambio(nuevaCuenta);
  };

  const cargar = async () => {
    setEstado("cargando");
    setError("");

    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/cuenta");
      if (!respuesta.ok || !payload?.ok) {
        throw new Error(payload?.error || "No se pudo comprobar tu cuenta de Catapult.");
      }
      aplicar(payload.cuenta);
    } catch (errorCarga) {
      setEstado("error");
      setError(errorCarga?.message || "No se pudo comprobar tu cuenta de Catapult.");
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conectar = async (event) => {
    event.preventDefault();

    const usuarioLimpio = username.trim();
    if (!usuarioLimpio || !password) {
      setError("Completá tu usuario y contraseña de Catapult.");
      return;
    }

    setEstado("guardando");
    setError("");
    setMensaje("");

    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/cuenta", {
        method: "POST",
        body: { username: usuarioLimpio, password },
      });
      setPassword("");

      if (!respuesta.ok || !payload?.ok) {
        throw new Error(payload?.error || "No se pudo conectar la cuenta de Catapult.");
      }

      setMensaje(payload.message || "Cuenta conectada.");
      setUsername("");
      aplicar(payload.cuenta);
    } catch (errorConexion) {
      setPassword("");
      setEstado("sin-cuenta");
      setError(errorConexion?.message || "No se pudo conectar la cuenta de Catapult.");
    }
  };

  const desconectar = async () => {
    if (typeof window !== "undefined" && !window.confirm("¿Desconectar tu cuenta de Catapult de la app?")) {
      return;
    }

    setEstado("borrando");
    setError("");
    setMensaje("");

    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/cuenta", { method: "DELETE" });
      if (!respuesta.ok || !payload?.ok) {
        throw new Error(payload?.error || "No se pudo desconectar la cuenta.");
      }
      setMensaje("Cuenta desconectada. Podés volver a conectarla cuando quieras.");
      aplicar({ configurada: false });
    } catch (errorBorrado) {
      setEstado("conectada");
      setError(errorBorrado?.message || "No se pudo desconectar la cuenta.");
    }
  };

  if (estado === "cargando") {
    return (
      <div className="entrenamiento-ajustes-resultado" aria-live="polite">
        <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
        <div>
          <strong>Comprobando tu cuenta…</strong>
          <span>Un momento.</span>
        </div>
      </div>
    );
  }

  if (estado === "error") {
    return (
      <>
        <div className="entrenamiento-ajustes-resultado error" aria-live="polite">
          <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
          <div>
            <strong>No se pudo comprobar tu cuenta</strong>
            <span>{error}</span>
          </div>
        </div>
        <button type="button" className="entrenamiento-boton-secundario entrenamiento-ajustes-boton-ancho" onClick={cargar}>
          Reintentar
        </button>
      </>
    );
  }

  if (estado === "conectada" || estado === "borrando") {
    return (
      <>
        <div className="entrenamiento-ajustes-resultado correcto" aria-live="polite">
          <span className="entrenamiento-ajustes-estado-punto" aria-hidden="true" />
          <div>
            <strong>Conectado como {cuenta?.usuario}</strong>
            <span>
              {cuenta?.verificado_en
                ? `Acceso comprobado el ${formatearFecha(cuenta.verificado_en)}.`
                : "Cuenta guardada."}{" "}
              La app entra sola cuando hace falta.
            </span>
          </div>
        </div>

        {mensaje && <div className="entrenamiento-estado correcto">{mensaje}</div>}
        {error && <div className="entrenamiento-estado error">{error}</div>}

        <button
          type="button"
          className="entrenamiento-boton-secundario entrenamiento-ajustes-boton-ancho"
          onClick={desconectar}
          disabled={estado === "borrando"}
        >
          {estado === "borrando" ? "Desconectando…" : "Desconectar cuenta"}
        </button>
      </>
    );
  }

  return (
    <>
      {mensaje && <div className="entrenamiento-estado correcto">{mensaje}</div>}

      <form onSubmit={conectar}>
        <label>
          Usuario de Catapult
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="El que usás para entrar a OpenField"
            disabled={estado === "guardando"}
          />
        </label>

        <label>
          Contraseña de Catapult
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contraseña de OpenField"
            disabled={estado === "guardando"}
          />
        </label>

        {error && <div className="entrenamiento-estado error">{error}</div>}

        <button type="submit" className="entrenamiento-boton-principal" disabled={estado === "guardando"}>
          {estado === "guardando" ? "Comprobando con Catapult…" : "Conectar mi cuenta de Catapult"}
        </button>
      </form>

      <div className="entrenamiento-ajustes-seguridad">
        <strong>Una sola vez</strong>
        <span>
          La app comprueba que Catapult acepte la cuenta y la guarda cifrada. No hace falta volver a
          cargarla, y podés desconectarla cuando quieras.
        </span>
      </div>
    </>
  );
}
