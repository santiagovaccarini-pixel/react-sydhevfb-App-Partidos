from pathlib import Path

APP = Path("src/App.js")
app = APP.read_text(encoding="utf-8")

old = '''const InputJugadorRival = ({ value, onChange, opciones = [] }) => (\n  <SelectorNombre value={value} onChange={onChange} opciones={opciones} />\n);'''
new = '''const InputJugadorRival = ({ value, onChange, opciones = [] }) => {\n  const valorNormalizado = normalizarNombreBusqueda(value);\n  const opcionesFiltradas = valorNormalizado\n    ? opciones.filter(\n        (opcion) => normalizarNombreBusqueda(opcion) !== valorNormalizado\n      )\n    : opciones;\n\n  return (\n    <SelectorNombre\n      value={value}\n      onChange={onChange}\n      opciones={opcionesFiltradas}\n    />\n  );\n};'''

if old in app:
    app = app.replace(old, new, 1)
elif new not in app:
    raise RuntimeError("No se encontró InputJugadorRival estable")

if "opciones={opcionesFiltradas}" not in app:
    raise RuntimeError("No se aplicó el filtro de opciones parciales")

APP.write_text(app, encoding="utf-8")
print("Opciones parciales del Rival excluidas correctamente.")
