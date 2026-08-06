from pathlib import Path

path = Path("scripts/apply_scroll_time_name_selectors.py")
script = path.read_text(encoding="utf-8")

script = script.replace(
    "    return (opciones || [])\n      .map((opcion)",
    "    return [value, ...(opciones || [])]\n      .map((opcion)",
    1,
)
script = script.replace("  }, [opciones]);", "  }, [opciones, value]);", 1)

marker = (
    "app = app.replace('const APP_VERSION = \"2026.08.06.2\";', "
    "'const APP_VERSION = \"2026.08.06.3\";')"
)
if marker not in script:
    raise RuntimeError("No se encontró el punto de inserción para Rival")

extension = r'''
# Rival tenía algunos inputs directos que no usaban InputJugadorRival.
# Se eliminan todos los datalist antiguos y se migran esos campos al selector estable.
app = re.sub(
    r'\s*<datalist id="lista-jugadores-rival">.*?</datalist>\s*',
    '\n',
    app,
    flags=re.S,
)


def extraer_prop_jsx(etiqueta, nombre):
    marcador = f"{nombre}={{"
    inicio = etiqueta.find(marcador)
    if inicio < 0:
        raise RuntimeError(f"No se encontró la propiedad {nombre} en {etiqueta}")

    posicion = inicio + len(marcador)
    profundidad = 1
    quote = None
    escape = False

    for indice in range(posicion, len(etiqueta)):
        caracter = etiqueta[indice]

        if quote:
            if escape:
                escape = False
            elif caracter == "\\":
                escape = True
            elif caracter == quote:
                quote = None
            continue

        if caracter in ('"', "'", "`"):
            quote = caracter
        elif caracter == "{":
            profundidad += 1
        elif caracter == "}":
            profundidad -= 1
            if profundidad == 0:
                return etiqueta[posicion:indice].strip()

    raise RuntimeError(f"No se pudo cerrar la propiedad {nombre}")


def adaptar_onchange_rival(expresion):
    coincidencia = re.match(r'\s*\(?([A-Za-z_$][\w$]*)\)?\s*=>', expresion)
    if not coincidencia:
        raise RuntimeError(f"Formato de onChange rival no reconocido: {expresion}")

    parametro = coincidencia.group(1)
    cuerpo = expresion[coincidencia.end():]
    cuerpo = cuerpo.replace(f"{parametro}.target.value", "valor")
    return f"(valor) =>{cuerpo}"


def reemplazar_inputs_rival(texto):
    posicion = 0
    reemplazos = 0

    while True:
        inicio = texto.find('<input', posicion)
        if inicio < 0:
            break

        final = texto.find('/>', inicio)
        if final < 0:
            break

        etiqueta = texto[inicio:final + 2]
        if 'list="lista-jugadores-rival"' not in etiqueta:
            posicion = final + 2
            continue

        valor = extraer_prop_jsx(etiqueta, 'value')
        onchange = adaptar_onchange_rival(extraer_prop_jsx(etiqueta, 'onChange'))
        linea_inicio = texto.rfind('\n', 0, inicio) + 1
        indentacion = texto[linea_inicio:inicio]

        nueva = '\n'.join([
            f"{indentacion}<InputJugadorRival",
            f"{indentacion}  value={{{valor}}}",
            f"{indentacion}  onChange={{{onchange}}}",
            f"{indentacion}/>",
        ])

        texto = texto[:inicio] + nueva + texto[final + 2:]
        posicion = inicio + len(nueva)
        reemplazos += 1

    return texto, reemplazos


app, cantidad_inputs_rival = reemplazar_inputs_rival(app)
if cantidad_inputs_rival < 4:
    raise RuntimeError(
        f"Solo se reemplazaron {cantidad_inputs_rival} campos directos de Rival"
    )

'''

script = script.replace(marker, extension + marker, 1)
path.write_text(script, encoding="utf-8")
print("Cobertura completa de Rival agregada al parche")
