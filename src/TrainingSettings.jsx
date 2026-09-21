import React, { useEffect, useState } from "react";
import { Icono } from "./components/AppChrome";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import TrainingCuenta from "./TrainingCuenta";
import TrainingDiagnostico from "./TrainingDiagnostico";
import TrainingJugadores from "./TrainingJugadores";
import { pedirJson } from "./trainingApi.js";

// Ajustes de Entrenamiento con el mismo menú que Partido: una fila por
// opción y cada una abre su pantalla. La cuenta se lee una sola vez acá y se
// le pasa a las subpantallas, así entrar a cada una no vuelve a consultarla.
export default function TrainingSettings({
  vista = "inicio",
  onCambiarVista = () => {},
  onVolverModulos = () => {},
  email = "",
  onCerrarSesion = () => {},
}) {
  const [cuenta, setCuenta] = useState(null);
  const [estadoCuenta, setEstadoCuenta] = useState("cargando");
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  useEffect(() => {
    let vigente = true;

    const leerCuenta = async () => {
      try {
        const { respuesta, payload } = await pedirJson("/api/openfield/cuenta");
        if (!vigente) return;
        if (respuesta.ok && payload?.ok) {
          setCuenta(payload.cuenta || { configurada: false });
          setEstadoCuenta("lista");
        } else {
          setCuenta(null);
          setEstadoCuenta("error");
        }
      } catch {
        if (!vigente) return;
        setCuenta(null);
        setEstadoCuenta("error");
      }
    };

    leerCuenta();
    return () => {
      vigente = false;
    };
  }, []);

  const alCambiarCuenta = (nueva) => {
    setCuenta(nueva || { configurada: false });
    setEstadoCuenta("lista");
  };

  const volverAlMenu = () => onCambiarVista("inicio");

  if (vista === "cuenta") {
    return <TrainingCuenta cuentaInicial={cuenta} onCambio={alCambiarCuenta} onVolver={volverAlMenu} />;
  }

  if (vista === "jugadores") {
    return <TrainingJugadores onVolver={volverAlMenu} />;
  }

  if (vista === "pruebas") {
    return <TrainingDiagnostico cuenta={cuenta} onVolver={volverAlMenu} />;
  }

  const subtextoCuenta =
    estadoCuenta === "cargando"
      ? "Comprobando…"
      : estadoCuenta === "error"
        ? "No se pudo comprobar tu cuenta"
        : cuenta?.configurada
          ? `Conectado como ${cuenta.usuario}`
          : "Todavía no conectaste tu usuario";

  const opciones = [
    {
      id: "cuenta",
      icono: "usuario",
      titulo: "Usuario y contraseña",
      detalle: subtextoCuenta,
      alTocar: () => onCambiarVista("cuenta"),
    },
    {
      id: "jugadores",
      icono: "formacion",
      titulo: "Lista de jugadores",
      detalle: "La misma lista que Partido",
      alTocar: () => onCambiarVista("jugadores"),
    },
    {
      id: "pruebas",
      icono: "llave",
      titulo: "Pruebas técnicas",
      detalle: "Solo si te lo piden por chat",
      alTocar: () => onCambiarVista("pruebas"),
    },
    {
      id: "modulos",
      icono: "escudo",
      titulo: "Cambiar de módulo",
      detalle: "Volver al portal para elegir Partido",
      alTocar: onVolverModulos,
    },
    {
      id: "salir",
      icono: "candado",
      titulo: "Cerrar sesión",
      detalle: email,
      alTocar: () => setConfirmarSalida(true),
    },
  ];

  return (
    <div className="app">
      <div className="contenedor">
        <header className="encabezado">
          <h1>Ajustes</h1>
          <p>Lo que la app usa en Entrenamiento.</p>
        </header>

        {opciones.map((opcion) => (
          <button key={opcion.id} type="button" className="opcion-ajuste" onClick={opcion.alTocar}>
            <span className="icono-ajuste">
              <Icono nombre={opcion.icono} size={18} />
            </span>
            <span className="texto-ajuste">
              <b>{opcion.titulo}</b>
              <span>{opcion.detalle}</span>
            </span>
            <span className="flecha-ajuste">›</span>
          </button>
        ))}

        <HojaConfirmar
          abierta={confirmarSalida}
          titulo="¿Cerrar sesión?"
          descripcion="Vas a tener que volver a entrar con tu correo y contraseña."
          icono="candado"
          etiquetaConfirmar="Sí, cerrar"
          onConfirmar={() => {
            setConfirmarSalida(false);
            onCerrarSesion();
          }}
          onCancelar={() => setConfirmarSalida(false)}
        />
      </div>
    </div>
  );
}
