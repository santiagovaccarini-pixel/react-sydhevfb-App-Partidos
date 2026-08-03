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
    'const APP_VERSION = "2026.08.03.5";',
    'const APP_VERSION = "2026.08.03.6";',
    "versión de la app",
)

app = replace_once(
    app,
    '''  const hayFormacionInicial =
    (formacionInicial.titulares || []).some((j) => String(j || "").trim()) ||
    (formacionInicial.convocados || []).some((j) => String(j || "").trim());

  const [pantallaFormacion, setPantallaFormacion] = useState(''',
    '''  const hayFormacionInicial =
    (formacionInicial.titulares || []).some((j) => String(j || "").trim()) ||
    (formacionInicial.convocados || []).some((j) => String(j || "").trim());

  const [partidoEnCurso, setPartidoEnCurso] = useState(hayFormacionInicial);

  const [pantallaFormacion, setPantallaFormacion] = useState(''',
    "estado de partido en curso",
)

app = replace_once(
    app,
    '''  const continuarConFormacion = () => {
    actualizarFormacion(formacionTemporal);
    setPantallaFormacion("lista");''',
    '''  const continuarConFormacion = () => {
    actualizarFormacion(formacionTemporal);
    setPartidoEnCurso(true);
    setPantallaFormacion("lista");''',
    "activar partido al continuar",
)

app = replace_once(
    app,
    '''    setFechaFormacion(nuevoRegistro.fecha);
    setPantallaFormacion("lista");
    setMostrarFormacionPartido(false);''',
    '''    setFechaFormacion(nuevoRegistro.fecha);
    setPartidoEnCurso(false);
    setPantallaFormacion("lista");
    setMostrarFormacionPartido(false);''',
    "desactivar partido al limpiar",
)

app = replace_once(
    app,
    '''  const volverAPantallaFormacion = () => {
    setFormacionTemporal(registro.formacion || crearFormacionVacia());
    setFechaFormacion(registro.fecha || new Date().toISOString().slice(0, 10));
    setPantallaFormacion("inicio");''',
    '''  const volverAPantallaFormacion = () => {
    setFormacionTemporal(registro.formacion || crearFormacionVacia());
    setFechaFormacion(registro.fecha || new Date().toISOString().slice(0, 10));
    setPartidoEnCurso(true);
    setPantallaFormacion("inicio");''',
    "mostrar retorno al volver desde registro",
)

app = replace_once(
    app,
    '''  const PantallaInicioFormacion = () => (
    <div className="app">
      <ListaJugadores />

      <div className="contenedor">''',
    '''  const PantallaInicioFormacion = () => (
    <div className="app">
      <ListaJugadores />

      <div className="contenedor contenedor-inicio-formacion">''',
    "contenedor flexible de formación",
)

app = replace_once(
    app,
    '''          {hayFormacionInicial && (
            <button''',
    '''          {partidoEnCurso && (
            <button''',
    "condición de volver al partido",
)

css_extra = '''

/* Mantiene el estado de versión al fondo de Formación del partido */
.contenedor-inicio-formacion {
  min-height: calc(100dvh - 28px);
  display: flex;
  flex-direction: column;
}

.contenedor-inicio-formacion .bloque-version-app {
  margin-top: auto;
  margin-bottom: 0;
  padding-top: 18px;
  padding-bottom: max(2px, env(safe-area-inset-bottom));
}
'''

if "/* Mantiene el estado de versión al fondo de Formación del partido */" in style:
    raise RuntimeError("El estilo de versión al fondo ya existe")

style += css_extra

version_path.write_text(
    '{\n  "version": "2026.08.03.6"\n}\n',
    encoding="utf-8",
)
app_path.write_text(app, encoding="utf-8")
style_path.write_text(style, encoding="utf-8")

print("Versión al fondo y retorno al partido restaurado")
