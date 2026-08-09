from pathlib import Path
import re

APP = Path("src/App.js")
CSS = Path("src/style.css")
INDEX = Path("src/index.js")
VERSION = Path("public/version.json")
RIVAL_FIX = Path("src/rivalTimeCellFix.css")

app = APP.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")
index = INDEX.read_text(encoding="utf-8")
version = VERSION.read_text(encoding="utf-8")

old_version = "2026.08.06.6"
new_version = "2026.08.08.1"

if f'const APP_VERSION = "{old_version}";' in app:
    app = app.replace(
        f'const APP_VERSION = "{old_version}";',
        f'const APP_VERSION = "{new_version}";',
        1,
    )
elif f'const APP_VERSION = "{new_version}";' not in app:
    raise RuntimeError("No se encontró la versión esperada en App.js")

if old_version in version:
    version = version.replace(old_version, new_version, 1)
elif new_version not in version:
    raise RuntimeError("No se encontró la versión esperada en version.json")

# 1) Selector de nombres: evita cierres prematuros de foco.
old_blur = '''        onBlur={() => {\n          window.setTimeout(() => setAbierto(false), 120);\n        }}'''
new_blur = '''        onBlur={(evento) => {\n          const siguienteFoco = evento.relatedTarget;\n          if (siguienteFoco && contenedorRef.current?.contains(siguienteFoco)) {\n            return;\n          }\n\n          window.requestAnimationFrame(() => {\n            if (!contenedorRef.current?.contains(document.activeElement)) {\n              setAbierto(false);\n              setIndiceActivo(-1);\n            }\n          });\n        }}'''
if old_blur in app:
    app = app.replace(old_blur, new_blur, 1)
elif new_blur not in app:
    raise RuntimeError("No se encontró el onBlur del selector de nombres")

# 2) Input Rival estable: fuera de App para que React no lo remonte en cada tecla.
anchor_input = '''const InputJugador = ({ value, onChange }) => (\n  <SelectorNombre value={value} onChange={onChange} opciones={jugadores} />\n);\n'''
stable_rival = '''\nconst InputJugadorRival = ({ value, onChange, opciones = [] }) => (\n  <SelectorNombre value={value} onChange={onChange} opciones={opciones} />\n);\n'''
if stable_rival.strip() not in app:
    if anchor_input not in app:
        raise RuntimeError("No se encontró InputJugador global")
    app = app.replace(anchor_input, anchor_input + stable_rival, 1)

nested_rival = '''  const ListaJugadoresRival = () => null;\n\n  const InputJugadorRival = ({ value, onChange }) => (\n    <SelectorNombre\n      value={value}\n      onChange={onChange}\n      opciones={opcionesJugadoresRival}\n    />\n  );\n'''
if nested_rival in app:
    app = app.replace(nested_rival, "", 1)
elif "  const InputJugadorRival = ({ value, onChange }) => (" in app:
    raise RuntimeError("Quedó una definición interna inesperada de InputJugadorRival")

# Pasa explícitamente las opciones Rival en cada uso.
pattern = re.compile(r'(<InputJugadorRival\s*\n)(\s*)(?!opciones=)(value=)')
app, rival_usages = pattern.subn(
    r'\1\2opciones={opcionesJugadoresRival}\n\2\3',
    app,
)
if rival_usages == 0 and "<InputJugadorRival" in app and "opciones={opcionesJugadoresRival}" not in app:
    raise RuntimeError("No se pudieron actualizar los usos de InputJugadorRival")

# 3) La hora real editada también cambia la referencia del cronómetro visual.
helper_anchor = '''  const horaDesdeTimestamp = (timestamp) => {\n    if (timestamp === null || timestamp === undefined || timestamp === "") {\n      return "";\n    }\n\n    const fecha = new Date(Number(timestamp));\n    return Number.isNaN(fecha.getTime()) ? "" : fecha.toTimeString().slice(0, 8);\n  };\n'''
helper = '''\n  const timestampDesdeHoraReal = (hora, referenciaExistente = null) => {\n    const coincidencia = String(hora || "").match(\n      /^([01]\\d|2[0-3]):([0-5]\\d):([0-5]\\d)$/\n    );\n    if (!coincidencia) return null;\n\n    const referenciaNumerica = Number(referenciaExistente);\n    const baseValida =\n      referenciaExistente !== null &&\n      referenciaExistente !== "" &&\n      Number.isFinite(referenciaNumerica)\n        ? referenciaNumerica\n        : Date.now();\n\n    const fecha = new Date(baseValida);\n    fecha.setHours(\n      Number(coincidencia[1]),\n      Number(coincidencia[2]),\n      Number(coincidencia[3]),\n      0\n    );\n\n    // En cruces de medianoche conserva el día más cercano a la referencia previa.\n    const medioDia = 12 * 60 * 60 * 1000;\n    const unDia = 24 * 60 * 60 * 1000;\n    let timestamp = fecha.getTime();\n\n    if (timestamp - baseValida > medioDia) timestamp -= unDia;\n    if (baseValida - timestamp > medioDia) timestamp += unDia;\n\n    return timestamp;\n  };\n'''
if "const timestampDesdeHoraReal" not in app:
    if helper_anchor not in app:
        raise RuntimeError("No se encontró horaDesdeTimestamp")
    app = app.replace(helper_anchor, helper_anchor + helper, 1)

old_update = '''  const actualizarHoraInicioRealPeriodo = (tipo, valor) => {\n    if (tipo !== "PT" && tipo !== "ST") return;\n\n    setRegistro((prev) => {\n      const config = obtenerConfigPeriodo(tipo);\n      const siguiente = {\n        ...prev,\n        [config.horaInicioReal]: valor || "",\n      };\n\n      // La guía MMM:SS sigue corriendo desde el toque original. Solo cambia\n      // la hora base que se utiliza para convertir todos los eventos al guardar.\n      siguiente[config.horaFinalReal] = prev[config.final]\n        ? convertirGuiaAHoraReal(tipo, prev[config.final], siguiente)\n        : "";\n\n      return siguiente;\n    });\n  };'''
new_update = '''  const actualizarHoraInicioRealPeriodo = (tipo, valor) => {\n    if (tipo !== "PT" && tipo !== "ST") return;\n\n    setRegistro((prev) => {\n      const config = obtenerConfigPeriodo(tipo);\n      const referenciaCorregida = timestampDesdeHoraReal(\n        valor,\n        prev[config.referencia]\n      );\n      const siguiente = {\n        ...prev,\n        [config.horaInicioReal]: valor || "",\n        ...(referenciaCorregida !== null\n          ? { [config.referencia]: referenciaCorregida }\n          : {}),\n      };\n\n      // La hora corregida pasa a ser también la referencia de los próximos\n      // botones Ahora. Los minutos siguen siendo una guía visual del período.\n      siguiente[config.horaFinalReal] = prev[config.final]\n        ? convertirGuiaAHoraReal(tipo, prev[config.final], siguiente)\n        : "";\n\n      return siguiente;\n    });\n  };'''
if old_update in app:
    app = app.replace(old_update, new_update, 1)
elif new_update not in app:
    raise RuntimeError("No se encontró actualizarHoraInicioRealPeriodo")

# 4) Los estilos de los botones de acción no deben pintar botones internos del picker.
css = css.replace(".celda-hora-cambio button {", ".celda-hora-cambio > button {", 1)
css = css.replace(
    ".pantalla-rival .celda-hora-cambio button:not(.boton-entretiempo) {",
    ".pantalla-rival .celda-hora-cambio > button:not(.boton-entretiempo) {",
    1,
)

old_active = '''.selector-tiempo-opcion.activa,\n.selector-tiempo-opcion.activa:hover {\n  background: linear-gradient(135deg, #000000, #16a34a);\n  color: #ffffff;\n}'''
new_active = '''.selector-tiempo-opcion.activa,\n.selector-tiempo-opcion.activa:hover {\n  background: #e2e8f0;\n  color: #0f172a;\n  box-shadow: inset 0 0 0 1px #94a3b8;\n}'''
if old_active in css:
    css = css.replace(old_active, new_active, 1)
elif new_active not in css:
    raise RuntimeError("No se encontró el estilo activo del selector de tiempo")

old_listo = '''.selector-tiempo-listo {\n  background: linear-gradient(135deg, #000000, #16a34a);\n  color: #ffffff;\n}'''
new_listo = '''.selector-tiempo-listo {\n  background: #0f172a;\n  color: #ffffff;\n}'''
if old_listo in css:
    css = css.replace(old_listo, new_listo, 1)
elif new_listo not in css:
    raise RuntimeError("No se encontró el estilo del botón Listo")

# La excepción Rival agregada en la versión anterior ya no es necesaria:
# la regla raíz ahora solo afecta a botones hijos directos.
index = index.replace('import "./rivalTimeCellFix.css";\n', "")
if RIVAL_FIX.exists():
    RIVAL_FIX.unlink()

# Validaciones finales.
checks = [
    (f'const APP_VERSION = "{new_version}";', app),
    ("const InputJugadorRival = ({ value, onChange, opciones = [] })", app),
    ("opciones={opcionesJugadoresRival}", app),
    ("const timestampDesdeHoraReal", app),
    ("[config.referencia]: referenciaCorregida", app),
    (".celda-hora-cambio > button {", css),
    (".pantalla-rival .celda-hora-cambio > button:not(.boton-entretiempo) {", css),
    ("background: #e2e8f0;", css),
    (f'"version": "{new_version}"', version),
]
for needle, haystack in checks:
    if needle not in haystack:
        raise RuntimeError(f"Validación fallida: {needle}")

if "  const InputJugadorRival = ({ value, onChange }) => (" in app:
    raise RuntimeError("InputJugadorRival sigue anidado dentro de App")
if 'import "./rivalTimeCellFix.css";' in index:
    raise RuntimeError("Sigue importándose el parche CSS Rival anterior")

APP.write_text(app, encoding="utf-8")
CSS.write_text(css, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")
VERSION.write_text(version, encoding="utf-8")

print(f"Correcciones aplicadas. Usos Rival actualizados: {rival_usages}")
