from pathlib import Path
import re

APP_PATH = Path("src/App.js")
app = APP_PATH.read_text(encoding="utf-8")

pattern_pt = re.compile(
    r'\n\s*\{registro\.modoTiempo === "transmision" && \(\s*'
    r'<div className="editor-hora-real-inicio">.*?'
    r'obtenerHoraRealEditable\("PT"\).*?'
    r'</div>\s*\)\}\s*<h2>Primer tiempo</h2>',
    re.DOTALL,
)
app, removed_pt = pattern_pt.subn(
    '\n            <h2>Primer tiempo</h2>', app, count=1
)
if removed_pt != 1:
    raise RuntimeError("No se pudo retirar el editor PT de Detalle registro")

pattern_st = re.compile(
    r'\n\s*\{registro\.modoTiempo === "transmision" && \(\s*'
    r'<div className="editor-hora-real-inicio">.*?'
    r'obtenerHoraRealEditable\("ST"\).*?'
    r'</div>\s*\)\}\s*<h2>Segundo tiempo</h2>',
    re.DOTALL,
)
app, removed_st = pattern_st.subn(
    '\n            <h2>Segundo tiempo</h2>', app, count=1
)
if removed_st != 1:
    raise RuntimeError("No se pudo retirar el editor ST de Detalle registro")

anchor_pt = '''        <section className="tarjeta">
          <h2>Primer tiempo</h2>

          <BloqueEvento
            titulo="PT"
            inicioCampo="inicioPT"'''
if app.count(anchor_pt) != 1:
    raise RuntimeError("No se encontró la tarjeta principal de Primer tiempo")

main_pt = '''        <section className="tarjeta">
          {registro.modoTiempo === "transmision" && (
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

          <h2>Primer tiempo</h2>

          <BloqueEvento
            titulo="PT"
            inicioCampo="inicioPT"'''
app = app.replace(anchor_pt, main_pt, 1)

anchor_st = '''        <section className="tarjeta">
          <h2>Segundo tiempo</h2>

          <BloqueEvento
            titulo="ST"
            inicioCampo="inicioST"'''
if app.count(anchor_st) != 1:
    raise RuntimeError("No se encontró la tarjeta principal de Segundo tiempo")

main_st = '''        <section className="tarjeta">
          {registro.modoTiempo === "transmision" && (
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

          <h2>Segundo tiempo</h2>

          <BloqueEvento
            titulo="ST"
            inicioCampo="inicioST"'''
app = app.replace(anchor_st, main_st, 1)

if app.count('className="editor-hora-real-inicio"') != 2:
    raise RuntimeError("Deben existir exactamente dos editores de hora real")

main_start = app.find('<h1>Registro Partido</h1>')
pt_editor = app.find('value={obtenerHoraRealEditable("PT")}', main_start)
st_editor = app.find('value={obtenerHoraRealEditable("ST")}', main_start)
if main_start < 0 or pt_editor < main_start or st_editor < main_start:
    raise RuntimeError("Los editores no quedaron dentro de Registro Partido")

APP_PATH.write_text(app, encoding="utf-8")
print("Editores PT/ST movidos correctamente a Registro Partido.")
