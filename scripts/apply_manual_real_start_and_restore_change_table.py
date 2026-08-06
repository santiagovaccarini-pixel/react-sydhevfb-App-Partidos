from pathlib import Path

APP_PATH = Path("src/App.js")
CSS_PATH = Path("src/style.css")
VERSION_PATH = Path("public/version.json")

app = APP_PATH.read_text(encoding="utf-8")
css = CSS_PATH.read_text(encoding="utf-8")
version = VERSION_PATH.read_text(encoding="utf-8")

app = app.replace(
    'const APP_VERSION = "2026.08.06.5";',
    'const APP_VERSION = "2026.08.06.6";',
    1,
)
version = version.replace("2026.08.06.5", "2026.08.06.6", 1)

anchor_logic = '''  const obtenerPeriodoActivo = (estado = registro) => {
'''
if app.count(anchor_logic) != 1:
    raise RuntimeError("No se encontró el punto de inserción de la hora real")

manual_logic = '''  const actualizarHoraInicioRealPeriodo = (tipo, valor) => {
    if (tipo !== "PT" && tipo !== "ST") return;

    setRegistro((prev) => {
      const config = obtenerConfigPeriodo(tipo);
      const siguiente = {
        ...prev,
        [config.horaInicioReal]: valor || "",
      };

      // La guía MMM:SS sigue corriendo desde el toque original. Solo cambia
      // la hora base que se utiliza para convertir todos los eventos al guardar.
      siguiente[config.horaFinalReal] = prev[config.final]
        ? convertirGuiaAHoraReal(tipo, prev[config.final], siguiente)
        : "";

      return siguiente;
    });
  };

  const obtenerHoraRealEditable = (tipo) => {
    const config = obtenerConfigPeriodo(tipo);
    return (
      registro[config.horaInicioReal] ||
      horaDesdeTimestamp(registro[config.referencia]) ||
      ""
    );
  };

'''
app = app.replace(anchor_logic, manual_logic + anchor_logic, 1)

editor_pt = '''          {registro.modoTiempo === "transmision" && (
            <div className="editor-hora-real-inicio">
              <span>Hora real de inicio</span>
              <SelectorHoraEnVivo
                value={obtenerHoraRealEditable("PT")}
                onChange={(valor) =>
                  actualizarHoraInicioRealPeriodo("PT", valor)
                }
                compacto
              />
            </div>
          )}

          <h2>Primer tiempo</h2>'''

needle_pt = '''          <h2>Primer tiempo</h2>'''
if app.count(needle_pt) != 1:
    raise RuntimeError("No se encontró la cabecera de Primer tiempo")
app = app.replace(needle_pt, editor_pt, 1)

editor_st = '''          {registro.modoTiempo === "transmision" && (
            <div className="editor-hora-real-inicio">
              <span>Hora real de inicio</span>
              <SelectorHoraEnVivo
                value={obtenerHoraRealEditable("ST")}
                onChange={(valor) =>
                  actualizarHoraInicioRealPeriodo("ST", valor)
                }
                compacto
              />
            </div>
          )}

          <h2>Segundo tiempo</h2>'''

needle_st = '''          <h2>Segundo tiempo</h2>'''
if app.count(needle_st) != 1:
    raise RuntimeError("No se encontró la cabecera de Segundo tiempo")
app = app.replace(needle_st, editor_st, 1)

css_extra = r'''

/* Restaura la apariencia original de la tabla de cambios */
.encabezado-cambios {
  border-radius: 17px 17px 0 0;
  overflow: hidden;
}

.tabla-cambios > .fila-cambio:last-child > div:first-child {
  border-bottom-left-radius: 17px;
}

.tabla-cambios > .fila-cambio:last-child > div:last-child {
  border-bottom-right-radius: 17px;
}

.celda-hora-cambio .selector-tiempo-transmision,
.celda-hora-detalle-editable .selector-tiempo-transmision {
  width: 100%;
  min-width: 0;
}

.celda-hora-cambio .selector-tiempo-disparador {
  width: 100%;
  height: 30px;
  padding: 0 4px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 11px;
  font-weight: bold;
  letter-spacing: 0;
  text-align: center;
}

.celda-hora-cambio .selector-tiempo-valor,
.celda-hora-detalle-editable .selector-tiempo-valor {
  flex: 1;
  text-align: center;
}

.celda-hora-cambio .selector-tiempo-reloj {
  width: 12px;
  height: 12px;
  flex-basis: 12px;
}

.celda-hora-detalle-editable .selector-tiempo-disparador {
  width: 100%;
  height: 32px;
  padding: 0 4px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 12px;
  letter-spacing: 0;
}

/* Hora real editable dentro de las tarjetas PT y ST */
.editor-hora-real-inicio {
  position: relative;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-height: 32px;
  margin: -3px 0 7px;
}

.editor-hora-real-inicio > span {
  color: #64748b;
  font-size: 10px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
}

.editor-hora-real-inicio .selector-hora-en-vivo {
  flex: 0 0 142px;
  width: 142px;
}

.editor-hora-real-inicio .selector-tiempo-disparador {
  height: 30px;
  padding: 0 7px;
  border-radius: 10px;
  font-size: 11px;
  letter-spacing: 0;
}

.editor-hora-real-inicio .selector-tiempo-panel {
  left: auto;
  right: 0;
  width: min(300px, calc(100vw - 24px));
}

@media (max-width: 430px) {
  .editor-hora-real-inicio {
    gap: 6px;
  }

  .editor-hora-real-inicio > span {
    font-size: 9px;
  }

  .editor-hora-real-inicio .selector-hora-en-vivo {
    flex-basis: 132px;
    width: 132px;
  }
}
'''

if "/* Hora real editable dentro de las tarjetas PT y ST */" in css:
    raise RuntimeError("Los estilos de hora real ya existen")
css = css.rstrip() + css_extra + "\n"

checks = {
    'const APP_VERSION = "2026.08.06.6";': app,
    "actualizarHoraInicioRealPeriodo": app,
    'obtenerHoraRealEditable("PT")': app,
    'obtenerHoraRealEditable("ST")': app,
    "editor-hora-real-inicio": css,
    "Restaura la apariencia original de la tabla de cambios": css,
    '"version": "2026.08.06.6"': version,
}
for needle, haystack in checks.items():
    if needle not in haystack:
        raise RuntimeError(f"Validación fallida: {needle}")

if app.count('className="editor-hora-real-inicio"') != 2:
    raise RuntimeError("La hora real debe aparecer exactamente en PT y ST")

APP_PATH.write_text(app, encoding="utf-8")
CSS_PATH.write_text(css, encoding="utf-8")
VERSION_PATH.write_text(version, encoding="utf-8")

print("Hora real editable y estética de cambios aplicadas correctamente.")
