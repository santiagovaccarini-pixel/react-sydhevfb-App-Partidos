from pathlib import Path

APP = Path("src/App.js")
VERSION = Path("public/version.json")
MIGRATION = Path("supabase/migrations/20260806_guia_transmision_horas_reales.sql")

text = APP.read_text(encoding="utf-8")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(
            f"{label}: se esperaba 1 coincidencia y se encontraron {count}"
        )
    return source.replace(old, new, 1)


text = replace_once(
    text,
    'const APP_VERSION = "2026.08.06.1";',
    'const APP_VERSION = "2026.08.06.2";',
    "versión de App.js",
)

text = replace_once(
    text,
    '''    const guiaTransmision = fila.guia_transmision || {};
    const esTransmisionConHorasReales =
      guiaTransmision.modo === "transmision";
    const modoDetectado = detectarModoTiempoFila(fila);
''',
    "",
    "lectura de guía de transmisión",
)

text = replace_once(
    text,
    '''      // Los registros nuevos de Transmisión ya están persistidos como horas reales.
      modoTiempo: esTransmisionConHorasReales ? "enVivo" : modoDetectado,
      modoCaptura: esTransmisionConHorasReales ? "transmision" : modoDetectado,
      guiaTransmision,
      horaInicioRealPT: guiaTransmision.horaInicioRealPT || "",
      horaFinalRealPT: guiaTransmision.horaFinalRealPT || "",
      horaInicioRealST: guiaTransmision.horaInicioRealST || "",
      horaFinalRealST: guiaTransmision.horaFinalRealST || "",
''',
    '''      // Los registros guardados contienen únicamente horas reales.
      modoTiempo: detectarModoTiempoFila(fila),
''',
    "modo de registros guardados",
)

text = replace_once(
    text,
    '''      horaInicioRealPTE: guiaTransmision.horaInicioRealPTE || "",
      horaFinalRealPTE: guiaTransmision.horaFinalRealPTE || "",
      horaInicioRealSTE: guiaTransmision.horaInicioRealSTE || "",
      horaFinalRealSTE: guiaTransmision.horaFinalRealSTE || "",
''',
    "",
    "horas internas de prórroga recuperadas",
)

text = replace_once(
    text,
    '''  const detectarModoTiempoFila = (fila) => {
    if (fila.guia_transmision?.modo === "transmision") {
      return "transmision";
    }

''',
    '''  const detectarModoTiempoFila = (fila) => {
''',
    "detección por guía persistida",
)

start = text.index("  const serializarGuiaTransmision = (item) => {")
end = text.index("  const obtenerPeriodoCambioParaGuardar =", start)
text = text[:start] + text[end:]

text = replace_once(
    text,
    '''      item.modoTiempo === "transmision" ||
        item.prorrogaActiva ||''',
    '''      item.prorrogaActiva ||''',
    "compatibilidad sin columna de transmisión",
)

text = replace_once(
    text,
    '''    /prorroga|cambios_extra|cambios_rival_extra|guia_transmision/i.test(''',
    '''    /prorroga|cambios_extra|cambios_rival_extra/i.test(''',
    "detección de columnas extendidas",
)

text = replace_once(
    text,
    '''      cambios_rival_extra,
      guia_transmision,
      ...payloadBase''',
    '''      cambios_rival_extra,
      ...payloadBase''',
    "limpieza de payload extendido",
)

text = replace_once(
    text,
    '''      guia_transmision: serializarGuiaTransmision(nuevoRegistro),
      prorroga: serializarProrroga(registroConHorasReales),''',
    '''      prorroga: serializarProrroga(registroConHorasReales),''',
    "payload de guardado",
)

text = replace_once(
    text,
    '"Falta ejecutar la migración de transmisión y prórroga en Supabase. Abrí el archivo SQL incluido en el repositorio y ejecutalo en SQL Editor."',
    '"Falta ejecutar la migración de prórroga y cambios extra en Supabase. Abrí el archivo SQL incluido en el repositorio y ejecutalo en SQL Editor."',
    "mensaje de guardado",
)

text = replace_once(
    text,
    '''      guia_transmision:
        registroEditado.guiaTransmision || serializarGuiaTransmision(registroEditado),
      prorroga: serializarProrroga(registroParaGuardar),''',
    '''      prorroga: serializarProrroga(registroParaGuardar),''',
    "payload de edición",
)

text = replace_once(
    text,
    '"Falta ejecutar la migración de transmisión y prórroga en Supabase antes de guardar estos datos."',
    '"Falta ejecutar la migración de prórroga y cambios extra en Supabase antes de guardar estos datos."',
    "mensaje de edición",
)

for forbidden in ("guia_transmision", "guiaTransmision", "serializarGuiaTransmision"):
    if forbidden in text:
        raise RuntimeError(f"Todavía queda una referencia no deseada: {forbidden}")

APP.write_text(text, encoding="utf-8")
VERSION.write_text('{\n  "version": "2026.08.06.2"\n}\n', encoding="utf-8")
MIGRATION.unlink(missing_ok=True)

print("Parche aplicado: Supabase guarda solo horas reales y no requiere SQL nuevo.")
