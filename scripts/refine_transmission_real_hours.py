from pathlib import Path

path = Path("src/App.js")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    text = text.replace(old, new, 1)


replace_once(
    '''  const horaDesdeTimestamp = (timestamp) => {
    const fecha = new Date(Number(timestamp));
    return Number.isNaN(fecha.getTime()) ? "" : fecha.toTimeString().slice(0, 8);
  };''',
    '''  const horaDesdeTimestamp = (timestamp) => {
    if (timestamp === null || timestamp === undefined || timestamp === "") {
      return "";
    }

    const fecha = new Date(Number(timestamp));
    return Number.isNaN(fecha.getTime()) ? "" : fecha.toTimeString().slice(0, 8);
  };''',
    "referencia vacía",
)

replace_once(
    '''      guia_transmision: serializarGuiaTransmision(nuevoRegistro),
      prorroga: serializarProrroga(nuevoRegistro),''',
    '''      guia_transmision: serializarGuiaTransmision(nuevoRegistro),
      prorroga: serializarProrroga(registroConHorasReales),''',
    "prórroga al guardar",
)

replace_once(
    '''      guia_transmision:
        registroEditado.guiaTransmision || serializarGuiaTransmision(registroEditado),
      prorroga: serializarProrroga(registroEditado),''',
    '''      guia_transmision:
        registroEditado.guiaTransmision || serializarGuiaTransmision(registroEditado),
      prorroga: serializarProrroga(registroParaGuardar),''',
    "prórroga al editar",
)

text = text.replace(
    '"Falta ejecutar la migración de prórroga en Supabase antes de guardar estos datos."',
    '"Falta ejecutar la migración de transmisión y prórroga en Supabase antes de guardar estos datos."',
)

path.write_text(text, encoding="utf-8")
print("Refinamiento de horas reales aplicado correctamente")
