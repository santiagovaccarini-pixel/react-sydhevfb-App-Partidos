from pathlib import Path

app_path = Path('src/App.js')
style_path = Path('src/style.css')

app = app_path.read_text(encoding='utf-8')
style = style_path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str):
    global app
    count = app.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: se esperaba 1 coincidencia y se encontraron {count}')
    app = app.replace(old, new, 1)


replace_once(
    'const imagenIntro =\n',
    'const APP_VERSION = "2026.08.03.1";\n\nconst imagenIntro =\n',
    'constante de versión',
)

replace_once(
    '  const [mensajeGuardado, setMensajeGuardado] = useState("");\n',
    '  const [mensajeGuardado, setMensajeGuardado] = useState("");\n  const [actualizacionDisponible, setActualizacionDisponible] = useState(false);\n',
    'estado de actualización',
)

replace_once(
    '''  useEffect(() => {
    cargarRegistrosSupabase();
  
    const timerIntro = setTimeout(() => {
      setMostrarApp(true);
    }, 1800);
  
    return () => clearTimeout(timerIntro);
  }, []);''',
    '''  useEffect(() => {
    cargarRegistrosSupabase();
  
    const timerIntro = setTimeout(() => {
      setMostrarApp(true);
    }, 1800);
  
    return () => clearTimeout(timerIntro);
  }, []);

  useEffect(() => {
    let activo = true;

    const verificarActualizacion = async () => {
      try {
        const respuesta = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });

        if (!respuesta.ok) return;

        const datos = await respuesta.json();

        if (activo && datos.version && datos.version !== APP_VERSION) {
          setActualizacionDisponible(true);
        }
      } catch (error) {
        console.warn("No se pudo comprobar la versión de la app:", error);
      }
    };

    const verificarAlVolver = () => {
      if (document.visibilityState === "visible") {
        verificarActualizacion();
      }
    };

    verificarActualizacion();
    const intervalo = setInterval(verificarActualizacion, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", verificarAlVolver);

    return () => {
      activo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", verificarAlVolver);
    };
  }, []);''',
    'verificación de actualización',
)

replace_once(
    '''  const DatoDetalle = ({ label, valor }) => (
    <div className="dato-detalle">''',
    '''  const actualizarAplicacion = () => {
    window.location.reload();
  };

  const AvisoActualizacion = () =>
    actualizacionDisponible ? (
      <div className="aviso-actualizacion-app">
        <div>
          <strong>Nueva versión disponible</strong>
          <span>Actualizá para usar los últimos cambios.</span>
        </div>
        <button type="button" onClick={actualizarAplicacion}>
          Actualizar ahora
        </button>
      </div>
    ) : null;

  const IndicadorModoTiempo = () => {
    const esTransmision = registro.modoTiempo === "transmision";

    return (
      <div
        className={`indicador-modo-activo ${
          esTransmision ? "transmision" : "en-vivo"
        }`}
      >
        <span className="indicador-modo-punto" aria-hidden="true" />
        <div className="indicador-modo-texto">
          <strong>
            Modo activo: {esTransmision ? "Transmisión" : "En Vivo"}
          </strong>
          <span>
            {esTransmision
              ? "Minutos de juego · formato MMM:SS · PT 000:00 · ST 045:00"
              : "Hora actual del dispositivo · formato HH:MM:SS"}
          </span>
        </div>
        <small>v{APP_VERSION}</small>
      </div>
    );
  };

  const DatoDetalle = ({ label, valor }) => (
    <div className="dato-detalle">''',
    'componentes de actualización e indicador',
)

# Formación manual/revisión: mostrar aviso de nueva versión.
replace_once(
    '''      <div className="contenedor">
        <header className="encabezado">''',
    '''      <div className="contenedor">
        <AvisoActualizacion />
        <header className="encabezado">''',
    'aviso en formulario de formación',
)

# Pantalla rival: aviso + indicador luego del encabezado.
replace_once(
    '''          <header className="encabezado">
            <h1>Cambios Rival</h1>
            <p>
              {registro.fecha} · Atlético Mineiro vs{" "}
              {registro.rival || "Rival"}
            </p>
          </header>
  
          <section className="tarjeta">''',
    '''          <AvisoActualizacion />
          <header className="encabezado">
            <h1>Cambios Rival</h1>
            <p>
              {registro.fecha} · Atlético Mineiro vs{" "}
              {registro.rival || "Rival"}
            </p>
          </header>

          <IndicadorModoTiempo />
  
          <section className="tarjeta">''',
    'indicador en rival',
)

# Pantalla principal: aviso + indicador luego del encabezado.
replace_once(
    '''        <header className="encabezado">
          <h1>Registro Partido</h1>
          <p>Atlético Mineiro · PT, ST, VAR e hidratación</p>
        </header>

        <section className="tarjeta">''',
    '''        <AvisoActualizacion />
        <header className="encabezado">
          <h1>Registro Partido</h1>
          <p>Atlético Mineiro · PT, ST, VAR e hidratación</p>
        </header>

        <IndicadorModoTiempo />

        <section className="tarjeta">''',
    'indicador en pantalla principal',
)

style += '''

/* Estado visible del modo de registro */
.indicador-modo-activo {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 11px;
  margin: -4px 0 16px;
  padding: 13px 15px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.14);
}

.indicador-modo-activo.transmision {
  border-color: rgba(22, 163, 74, 0.5);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.97), rgba(22, 163, 74, 0.96));
  color: #ffffff;
}

.indicador-modo-activo.en-vivo {
  color: #0f172a;
}

.indicador-modo-punto {
  width: 11px;
  height: 11px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
}

.indicador-modo-texto {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.indicador-modo-texto strong {
  font-size: 14px;
}

.indicador-modo-texto span {
  font-size: 11px;
  opacity: 0.82;
  line-height: 1.35;
}

.indicador-modo-activo small {
  font-size: 10px;
  font-weight: 800;
  opacity: 0.72;
}

.aviso-actualizacion-app {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  color: #78350f;
  box-shadow: 0 8px 20px rgba(120, 53, 15, 0.16);
}

.aviso-actualizacion-app div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aviso-actualizacion-app strong {
  font-size: 13px;
}

.aviso-actualizacion-app span {
  font-size: 11px;
}

.aviso-actualizacion-app button {
  flex: 0 0 auto;
  min-height: 38px;
  padding: 0 12px;
  background: #78350f;
  color: #ffffff;
  font-size: 11px;
}

@media (max-width: 520px) {
  .indicador-modo-activo {
    grid-template-columns: auto 1fr;
  }

  .indicador-modo-activo small {
    grid-column: 2;
  }

  .aviso-actualizacion-app {
    align-items: stretch;
    flex-direction: column;
  }

  .aviso-actualizacion-app button {
    width: 100%;
  }
}
'''

app_path.write_text(app, encoding='utf-8')
style_path.write_text(style, encoding='utf-8')
print('Indicador de modo y aviso de actualización agregados')
