from pathlib import Path

app_path = Path("src/App.js")
style_path = Path("src/style.css")
version_path = Path("public/version.json")

app = app_path.read_text(encoding="utf-8")
style = style_path.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"{label}: se esperaba 1 coincidencia y se encontraron {count}"
        )
    return text.replace(old, new, 1)


app = replace_once(
    app,
    'const APP_VERSION = "2026.08.03.3";',
    'const APP_VERSION = "2026.08.03.4";',
    "versión de la aplicación",
)

app = replace_once(
    app,
    '''        <IndicadorModoTiempo />''',
    '''        <EstadoVersionApp />''',
    "estado de versión en la pantalla principal",
)

app = replace_once(
    app,
    '''
        <VersionApp />''',
    '''''',
    "pie de versión anterior",
)

old_components = '''  const IndicadorModoTiempo = () => {
    const esTransmision = registro.modoTiempo === "transmision";

    return (
      <div className="bloque-modo-activo">
        <div
          className={`indicador-modo-activo ${
            esTransmision ? "transmision" : "en-vivo"
          } ${actualizacionDisponible ? "actualizacion-pendiente" : ""}`}
        >
          <span className="indicador-modo-punto" aria-hidden="true" />
          <div className="indicador-modo-texto">
            <strong>Modo {esTransmision ? "Transmisión" : "En Vivo"}</strong>
            <span>{esTransmision ? "Minutos de juego" : "Hora actual"}</span>
          </div>
        </div>

        {actualizacionDisponible && (
          <button
            type="button"
            className="boton-actualizar-version"
            onClick={actualizarAplicacion}
          >
            Actualizar Versión
          </button>
        )}
      </div>
    );
  };

  const VersionApp = () => (
    <div className="version-app-pie">Versión {APP_VERSION}</div>
  );'''

new_components = '''  const IndicadorModoTiempo = () => {
    const esTransmision = registro.modoTiempo === "transmision";

    return (
      <div className="bloque-modo-activo">
        <div
          className={`indicador-modo-activo ${
            esTransmision ? "transmision" : "en-vivo"
          }`}
        >
          <span className="indicador-modo-punto" aria-hidden="true" />
          <div className="indicador-modo-texto">
            <strong>Modo {esTransmision ? "Transmisión" : "En Vivo"}</strong>
            <span>{esTransmision ? "Minutos de juego" : "Hora actual"}</span>
          </div>
        </div>
      </div>
    );
  };

  const EstadoVersionApp = () => (
    <div className="bloque-version-app">
      <div
        className={`indicador-version-app ${
          actualizacionDisponible ? "actualizacion-pendiente" : ""
        }`}
      >
        <span className="indicador-modo-punto" aria-hidden="true" />
        <div className="indicador-modo-texto">
          <strong>
            {actualizacionDisponible
              ? "Nueva versión disponible"
              : "Aplicación actualizada"}
          </strong>
          <span>Versión {APP_VERSION}</span>
        </div>
      </div>

      {actualizacionDisponible && (
        <button
          type="button"
          className="boton-actualizar-version"
          onClick={actualizarAplicacion}
        >
          Actualizar Versión
        </button>
      )}
    </div>
  );'''

app = replace_once(
    app,
    old_components,
    new_components,
    "separación de componentes de modo y versión",
)

app = replace_once(
    app,
    '''          </header>

  
          <section className="tarjeta">''',
    '''          </header>

          <IndicadorModoTiempo />
  
          <section className="tarjeta">''',
    "modo en la pantalla Rival",
)

app = replace_once(
    app,
    '''        </header>


        <section className="tarjeta">''',
    '''        </header>

        <IndicadorModoTiempo />

        <section className="tarjeta">''',
    "modo en Registro Partido",
)

old_css = '''/* Estado visible del modo y actualización */
.bloque-modo-activo {
  margin: -4px 0 16px;
}

.indicador-modo-activo {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 15px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.14);
}

.indicador-modo-activo.transmision {
  border-color: rgba(22, 163, 74, 0.5);
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.97),
    rgba(22, 163, 74, 0.96)
  );
  color: #ffffff;
}

.indicador-modo-punto {
  flex: 0 0 auto;
  width: 11px;
  height: 11px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
}

.indicador-modo-activo.actualizacion-pendiente .indicador-modo-punto {
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.22);
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
  opacity: 0.84;
  line-height: 1.35;
}

.boton-actualizar-version {
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  background: linear-gradient(135deg, #7f1d1d, #dc2626);
  color: #ffffff;
  font-size: 13px;
  box-shadow: 0 8px 18px rgba(220, 38, 38, 0.28);
}

.version-app-pie {
  margin: 10px 0 2px;
  color: rgba(203, 213, 225, 0.62);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-align: center;
}'''

new_css = '''/* Estado visible del modo y de la versión */
.bloque-modo-activo,
.bloque-version-app {
  margin: -4px 0 16px;
}

.indicador-modo-activo,
.indicador-version-app {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 15px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(255, 255, 255, 0.96);
  color: #0f172a;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.14);
}

.indicador-modo-activo.transmision,
.indicador-version-app {
  border-color: rgba(22, 163, 74, 0.5);
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.97),
    rgba(22, 163, 74, 0.96)
  );
  color: #ffffff;
}

.indicador-modo-punto {
  flex: 0 0 auto;
  width: 11px;
  height: 11px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
}

.indicador-version-app.actualizacion-pendiente .indicador-modo-punto {
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.22);
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
  opacity: 0.84;
  line-height: 1.35;
}

.boton-actualizar-version {
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  background: linear-gradient(135deg, #7f1d1d, #dc2626);
  color: #ffffff;
  font-size: 13px;
  box-shadow: 0 8px 18px rgba(220, 38, 38, 0.28);
}'''

style = replace_once(
    style,
    old_css,
    new_css,
    "estilos separados de modo y versión",
)

version_path.write_text(
    '{\n  "version": "2026.08.03.4"\n}\n',
    encoding="utf-8",
)
app_path.write_text(app, encoding="utf-8")
style_path.write_text(style, encoding="utf-8")

print("Modo restaurado y versión separada en la pantalla principal")
