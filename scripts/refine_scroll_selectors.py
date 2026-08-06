from pathlib import Path

app_path = Path("src/App.js")
css_path = Path("src/style.css")

app = app_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")

old_options = '''    return [value, ...(opciones || [])]
      .map((opcion)'''
new_options = '''    return (opciones || [])
      .map((opcion)'''

if old_options not in app:
    raise RuntimeError("No se encontró la lista de opciones del selector de nombres")
app = app.replace(old_options, new_options, 1)

old_dependency = "  }, [opciones, value]);"
new_dependency = "  }, [opciones]);"
if old_dependency not in app:
    raise RuntimeError("No se encontró la dependencia del selector de nombres")
app = app.replace(old_dependency, new_dependency, 1)

css_extra = '''

/* Permite desplegar nombres dentro de la edición de registros */
.tabla-detalle-cambios {
  overflow: visible;
}

.fila-detalle-cambio {
  position: relative;
}

.fila-detalle-cambio:focus-within {
  z-index: 80;
}
'''

if "/* Permite desplegar nombres dentro de la edición de registros */" not in css:
    css = css.rstrip() + css_extra + "\n"

app_path.write_text(app, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")

print("Selector de nombres refinado y tablas de detalle habilitadas")
