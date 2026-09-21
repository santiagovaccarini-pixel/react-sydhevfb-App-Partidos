import React, { useEffect, useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { mensajeDeRespuesta, pedirJson } from "./trainingApi.js";

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

const estadoDeCuenta = (cuenta) => (cuenta?.configurada ? "conectada" : "sin-cuenta");

// El usuario con el que la app entra al sistema de los chalecos. Se carga una
// vez y queda guardado; desde acá se ve, se conecta o se desconecta. Si
// Ajustes ya leyó la cuenta la recibe en `cuentaInicial` y no la vuelve a pedir.
export default function TrainingCuenta({ cuentaInicial, onCambio, onVolver }) {
  const [estado, setEstado] = useState(cuentaInicial ? estadoDeCuenta(cuentaInicial) : "cargando");
  const [cuenta, setCuenta] = useState(cuentaInicial || null);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [aviso, setAviso] = useState("");
  const [confirmarDesconexion, setConfirmarDesconexion] = useState(false);
  const temporizadorAviso = useRef(null);

  const avisar = (texto) => {
    setAviso(texto);
    if (temporizadorAviso.current) window.clearTimeout(temporizadorAviso.current);
    temporizadorAviso.current = window.setTimeout(() => setAviso(""), 2600);
  };

  useEffect(
    () => () => {
      if (temporizadorAviso.current) window.clearTimeout(temporizadorAviso.current);
    },
    [],
  );

  const aplicar = (nuevaCuenta) => {
    setCuenta(nuevaCuenta);
    setEstado(estadoDeCuenta(nuevaCuenta));
    if (typeof onCambio === "function") onCambio(nuevaCuenta);
  };

  const cargar = async () => {
    setEstado("cargando");
    setError("");

    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/cuenta");
      if (!respuesta.ok || !payload?.ok) {
        throw new Error(mensajeDeRespuesta(payload, "No se pudo comprobar tu cuenta."));
      }
      aplicar(payload.cuenta);
    } catch (errorCarga) {
      setEstado("error");
      setError(errorCarga?.message || "No se pudo comprobar tu cuenta.");
    }
  };

  useEffect(() => {
    if (!cuentaInicial) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conectar = async (event) => {
    event.preventDefault();

    const usuarioLimpio = username.trim();
    if (!usuarioLimpio || !password) {
      setError("Completá tu usuario y contraseña.");
      return;
    }

    setEstado("guardando");
    setError("");

    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/cuenta", {
        method: "POST",
        body: { username: usuarioLimpio, password },
      });
      setPassword("");

      if (!respuesta.ok || !payload?.ok) {
        throw new Error(mensajeDeRespuesta(payload, "No se pudo conectar. Probá de nuevo."));
      }

      avisar(payload.message || "Cuenta conectada.");
      setUsername("");
      aplicar(payload.cuenta);
    } catch (errorConexion) {
      setPassword("");
      setEstado("sin-cuenta");
      setError(errorConexion?.message || "No se pudo conectar. Probá de nuevo.");
    }
  };

  const desconectar = async () => {
    setConfirmarDesconexion(false);
    setEstado("borrando");
    setError("");

    try {
      const { respuesta, payload } = await pedirJson("/api/openfield/cuenta", { method: "DELETE" });
      if (!respuesta.ok || !payload?.ok) {
        throw new Error(mensajeDeRespuesta(payload, "No se pudo desconectar."));
      }
      avisar("Cuenta desconectada.");
      aplicar({ configurada: false });
    } catch (errorBorrado) {
      setEstado("conectada");
      setError(errorBorrado?.message || "No se pudo desconectar.");
    }
  };

  const renderContenido = () => {
    if (estado === "cargando") {
      return <p className="vacio-ficha">Comprobando tu cuenta…</p>;
    }

    if (estado === "error") {
      return (
        <>
          <p className="error-equipo">
            <b>No se pudo comprobar tu cuenta.</b>
            {error && error !== "No se pudo comprobar tu cuenta." ? ` ${error}` : ""}
          </p>
          <button type="button" className="boton-texto" onClick={cargar}>
            Reintentar
          </button>
        </>
      );
    }

    if (estado === "conectada" || estado === "borrando") {
      return (
        <>
          <div className="equipo-propio">
            <Icono nombre="usuario" size={22} />
            <strong>{cuenta?.usuario}</strong>
          </div>
          <p className="pista-equipo">
            {cuenta?.verificado_en
              ? `Comprobada el ${formatearFecha(cuenta.verificado_en)}. La app entra sola cuando hace falta.`
              : "Cuenta guardada. La app entra sola cuando hace falta."}
          </p>
          {error && <p className="error-equipo">{error}</p>}
          <button
            type="button"
            className="boton-principal"
            onClick={() => setConfirmarDesconexion(true)}
            disabled={estado === "borrando"}
          >
            {estado === "borrando" ? "Desconectando…" : "Desconectar"}
          </button>
        </>
      );
    }

    return (
      <form onSubmit={conectar}>
        <label className="etiqueta-equipo" htmlFor="cuenta-usuario">
          Usuario
        </label>
        <input
          id="cuenta-usuario"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="El que usás para entrar al sistema de los chalecos"
          disabled={estado === "guardando"}
        />

        <label className="etiqueta-equipo" htmlFor="cuenta-contrasena">
          Contraseña
        </label>
        <div className="campo-con-escudo">
          <span className="campo-icono">
            <Icono nombre="candado" size={18} />
          </span>
          <input
            id="cuenta-contrasena"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tu contraseña"
            disabled={estado === "guardando"}
          />
        </div>

        <p className="pista-equipo">Se guarda una sola vez. Después la app entra sola.</p>
        {error && <p className="error-equipo">{error}</p>}

        <button type="submit" className="boton-principal" disabled={estado === "guardando"}>
          {estado === "guardando" ? "Comprobando…" : "Conectar"}
        </button>
      </form>
    );
  };

  return (
    <div className="app">
      <div className="contenedor">
        <header className="encabezado">
          <h1>Usuario y contraseña</h1>
          <p>Ajustes · Usuario y contraseña</p>
        </header>

        {aviso && (
          <div className="notificacion-guardado" role="status">
            <Icono nombre="check" size={18} /> {aviso}
          </div>
        )}

        <section className="tarjeta tarjeta-ficha">
          <div className="cabeza-ficha">
            <b>Tu cuenta</b>
          </div>
          {renderContenido()}
        </section>

        {onVolver && (
          <div className="acciones-dobles">
            <BotonVolver onClick={onVolver}>Volver a Ajustes</BotonVolver>
          </div>
        )}

        <HojaConfirmar
          abierta={confirmarDesconexion}
          titulo="¿Desconectar tu usuario?"
          descripcion="Vas a tener que cargarlo de nuevo para enviar tareas."
          icono="usuario"
          etiquetaConfirmar="Sí, desconectar"
          onConfirmar={desconectar}
          onCancelar={() => setConfirmarDesconexion(false)}
        />
      </div>
    </div>
  );
}
