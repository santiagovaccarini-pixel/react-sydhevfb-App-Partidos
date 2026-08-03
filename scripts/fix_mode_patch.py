from pathlib import Path

path = Path("scripts/add_mode_indicator.py")
text = path.read_text(encoding="utf-8")

old = '''# Formación manual/revisión: mostrar aviso de nueva versión.
replace_once(
    \'\'\'      <div className="contenedor">
        <header className="encabezado">\'\'\',
    \'\'\'      <div className="contenedor">
        <AvisoActualizacion />
        <header className="encabezado">\'\'\',
    \'aviso en formulario de formación\',
)'''

new = '''# Formación manual/revisión: mostrar aviso de nueva versión.
replace_once(
    \'\'\'  const FormularioFormacion = ({ modo }) => (
    <div className="app">
      <ListaJugadores />

      <div className="contenedor">
        <header className="encabezado">\'\'\',
    \'\'\'  const FormularioFormacion = ({ modo }) => (
    <div className="app">
      <ListaJugadores />

      <div className="contenedor">
        <AvisoActualizacion />
        <header className="encabezado">\'\'\',
    \'aviso en formulario de formación\',
)'''

if text.count(old) != 1:
    raise RuntimeError(f"No se encontró el bloque a corregir: {text.count(old)} coincidencias")

path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Script de indicador corregido")
