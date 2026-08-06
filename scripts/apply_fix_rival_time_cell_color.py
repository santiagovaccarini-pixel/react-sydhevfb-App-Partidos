# Parche visual aislado para el selector horario del Rival.
from pathlib import Path

APP_PATH = Path("src/App.js")
CSS_PATH = Path("src/style.css")
VERSION_PATH = Path("public/version.json")

app = APP_PATH.read_text(encoding="utf-8")
css = CSS_PATH.read_text(encoding="utf-8")
version = VERSION_PATH.read_text(encoding="utf-8")

old_version = "2026.08.06.6"
new_version = "2026.08.06.7"

if f'const APP_VERSION = "{new_version}";' not in app:
    if f'const APP_VERSION = "{old_version}";' not in app:
        raise RuntimeError("No se encontró la versión esperada en App.js")
    app = app.replace(
        f'const APP_VERSION = "{old_version}";',
        f'const APP_VERSION = "{new_version}";',
        1,
    )

if f'"version": "{new_version}"' not in version:
    if f'"version": "{old_version}"' not in version:
        raise RuntimeError("No se encontró la versión esperada en version.json")
    version = version.replace(old_version, new_version, 1)

marker = "/* Corrige el color del selector de tiempo en Rival */"
css_fix = r'''

/* Corrige el color del selector de tiempo en Rival */
.pantalla-rival
  .celda-hora-cambio
  button.selector-tiempo-disparador:not(.boton-entretiempo) {
  background: #f8fafc;
  color: #0f172a;
  border: 1px solid rgba(0, 0, 0, 0.45);
  box-shadow: none;
}

.pantalla-rival
  .celda-hora-cambio
  button.selector-tiempo-disparador:not(.boton-entretiempo):hover {
  background: #f8fafc;
  color: #0f172a;
  transform: none;
  box-shadow: none;
}

.pantalla-rival
  .celda-hora-cambio
  .selector-tiempo-transmision.abierto
  button.selector-tiempo-disparador:not(.boton-entretiempo),
.pantalla-rival
  .celda-hora-cambio
  button.selector-tiempo-disparador:not(.boton-entretiempo):focus {
  background: #ffffff;
  color: #0f172a;
  border-color: #111827;
  box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.12);
}
'''

if marker not in css:
    css = css.rstrip() + css_fix + "\n"

checks = {
    f'const APP_VERSION = "{new_version}";': app,
    f'"version": "{new_version}"': version,
    marker: css,
    "button.selector-tiempo-disparador:not(.boton-entretiempo)": css,
    "background: #f8fafc;": css,
}
for needle, haystack in checks.items():
    if needle not in haystack:
        raise RuntimeError(f"Validación fallida: {needle}")

APP_PATH.write_text(app, encoding="utf-8")
CSS_PATH.write_text(css, encoding="utf-8")
VERSION_PATH.write_text(version, encoding="utf-8")

print("Color del selector de tiempo Rival corregido correctamente.")
