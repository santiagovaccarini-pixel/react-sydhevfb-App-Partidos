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
    'const APP_VERSION = "2026.08.03.1";',
    'const APP_VERSION = "2026.08.03.2";',
    "versión de la app",
)

app = replace_once(
    app,
    '''        if (activo && datos.version && datos.version !== APP_VERSION) {
          setActualizacionDisponible(true);
        }''',
    '''        if (activo && datos.version) {
          setActualizacionDisponible(datos.version !== APP_VERSION);
        }''',
    "estado de actualización",
)

old_components = '''  const actualizarAplicacion = () => {
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
  };'''

new_components = '''  const actualizarAplicacion = async () => {
    try {
      if ("caches" in window) {
        const nombresCache = await window.caches.keys();
        await Promise.all(
          nombresCache.map((nombreCache) => window.caches.delete(nombreCache))
        );
      }
    } catch (error) {
      console.warn("No se pudo limpiar la caché antes de actualizar:", error);
    }

    const urlActualizada = new URL(window.location.href);
    urlActualizada.searchParams.set("actualizar", Date.now().toString());
    window.location.replace(urlActualizada.toString());
  };

  const IndicadorModoTiempo = () => {
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

app = replace_once(
    app,
    old_components,
    new_components,
    "componentes del modo y actualización",
)

cantidad_avisos = app.count("          <AvisoActualizacion />\n")
if cantidad_avisos != 2:
    raise RuntimeError(
        f"avisos separados: se esperaban 2 y se encontraron {cantidad_avisos}"
    )
app = app.replace("          <AvisoActualizacion />\n", "")

app = replace_once(
    app,
    '''</section>
    </div>
    </div>);}''',
    '''</section>

        <VersionApp />
    </div>
    </div>);}''',
    "versión al pie de la pantalla principal",
)

marker = "/* Estado visible del modo de registro */"
if marker not in style:
    raise RuntimeError("No se encontró el bloque CSS del indicador de modo")
style = style.split(marker, 1)[0].rstrip()
style += '''

/* Estado visible del modo y actualización */
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
}
'''

version_path.write_text('{\n  "version": "2026.08.03.2"\n}\n', encoding="utf-8")
app_path.write_text(app, encoding="utf-8")
style_path.write_text(style, encoding="utf-8")

print("Indicador simplificado y actualización integrada")
