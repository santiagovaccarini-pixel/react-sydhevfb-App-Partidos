from pathlib import Path
import re

APP_PATH = Path("src/App.js")
CSS_PATH = Path("src/style.css")
VERSION_PATH = Path("public/version.json")

app = APP_PATH.read_text(encoding="utf-8")
css = CSS_PATH.read_text(encoding="utf-8")


def replace_section(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f"No se encontró el inicio de {label}")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"No se encontró el final de {label}")
    return text[:start] + replacement + text[end:]


componentes_superiores = r'''const opcionesMinutosTransmision = Array.from(
  { length: 121 },
  (_, minuto) => String(minuto).padStart(3, "0")
);

const opcionesSegundosTransmision = Array.from(
  { length: 60 },
  (_, segundo) => String(segundo).padStart(2, "0")
);

const normalizarNombreBusqueda = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const SelectorNombre = ({
  value,
  onChange,
  opciones = [],
  placeholder = "Escribir o elegir",
}) => {
  const contenedorRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);

  const opcionesUnicas = useMemo(() => {
    const vistos = new Set();

    return (opciones || [])
      .map((opcion) => String(opcion || "").trim())
      .filter(Boolean)
      .filter((opcion) => {
        const clave = normalizarNombreBusqueda(opcion);
        if (!clave || vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      });
  }, [opciones]);

  const resultados = useMemo(() => {
    const consulta = normalizarNombreBusqueda(value);

    if (!consulta) return opcionesUnicas.slice(0, 30);

    const comienzan = [];
    const contienen = [];

    opcionesUnicas.forEach((opcion) => {
      const normalizado = normalizarNombreBusqueda(opcion);
      if (normalizado.startsWith(consulta)) comienzan.push(opcion);
      else if (normalizado.includes(consulta)) contienen.push(opcion);
    });

    return [...comienzan, ...contienen].slice(0, 30);
  }, [opcionesUnicas, value]);

  useEffect(() => {
    const cerrarAlTocarAfuera = (evento) => {
      if (!contenedorRef.current?.contains(evento.target)) {
        setAbierto(false);
        setIndiceActivo(-1);
      }
    };

    document.addEventListener("pointerdown", cerrarAlTocarAfuera);
    return () => document.removeEventListener("pointerdown", cerrarAlTocarAfuera);
  }, []);

  const seleccionar = (opcion) => {
    onChange(opcion);
    setAbierto(false);
    setIndiceActivo(-1);
  };

  const manejarTeclado = (evento) => {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAbierto(true);
      setIndiceActivo((actual) =>
        resultados.length === 0 ? -1 : Math.min(actual + 1, resultados.length - 1)
      );
      return;
    }

    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setAbierto(true);
      setIndiceActivo((actual) =>
        resultados.length === 0
          ? -1
          : actual <= 0
          ? resultados.length - 1
          : actual - 1
      );
      return;
    }

    if (evento.key === "Enter" && abierto && resultados.length > 0) {
      evento.preventDefault();
      seleccionar(resultados[indiceActivo >= 0 ? indiceActivo : 0]);
      return;
    }

    if (evento.key === "Escape") {
      setAbierto(false);
      setIndiceActivo(-1);
    }
  };

  return (
    <div
      className={`selector-nombre ${abierto ? "abierto" : ""}`}
      ref={contenedorRef}
    >
      <input
        className="input-jugador"
        value={value || ""}
        onChange={(evento) => {
          onChange(evento.target.value);
          setAbierto(true);
          setIndiceActivo(-1);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => {
          window.setTimeout(() => setAbierto(false), 120);
        }}
        onKeyDown={manejarTeclado}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
      />

      {abierto && resultados.length > 0 && (
        <div className="selector-nombre-lista" role="listbox">
          {resultados.map((opcion, index) => (
            <button
              key={`${opcion}-${index}`}
              type="button"
              role="option"
              aria-selected={indiceActivo === index}
              className={`selector-nombre-opcion ${
                indiceActivo === index ? "activa" : ""
              }`}
              onPointerDown={(evento) => {
                evento.preventDefault();
                seleccionar(opcion);
              }}
            >
              {opcion}
            </button>
          ))}
        </div>
      )}

      {abierto && value && resultados.length === 0 && (
        <div className="selector-nombre-lista selector-nombre-sin-resultados">
          Sin coincidencias. Podés conservar el nombre escrito.
        </div>
      )}
    </div>
  );
};

const descomponerTiempoTransmision = (valor) => {
  const coincidencia = String(valor || "").match(/^(\d{1,3}):([0-5]\d)$/);
  if (!coincidencia) return { minutos: "", segundos: "" };

  return {
    minutos: coincidencia[1].padStart(3, "0"),
    segundos: coincidencia[2].padStart(2, "0"),
  };
};

const SelectorTiempoTransmision = ({
  value,
  onChange,
  compacto = false,
  onKeyDown,
}) => {
  const { minutos, segundos } = descomponerTiempoTransmision(value);

  const cambiarMinutos = (nuevoMinuto) => {
    if (!nuevoMinuto) {
      onChange("");
      return;
    }

    onChange(`${nuevoMinuto}:${segundos || "00"}`);
  };

  const cambiarSegundos = (nuevoSegundo) => {
    if (!nuevoSegundo && !minutos) {
      onChange("");
      return;
    }

    onChange(`${minutos || "000"}:${nuevoSegundo || "00"}`);
  };

  return (
    <div
      className={`selector-tiempo-transmision ${compacto ? "compacto" : ""}`}
      onKeyDown={onKeyDown}
    >
      <select
        value={minutos}
        onChange={(evento) => cambiarMinutos(evento.target.value)}
        aria-label="Minutos"
      >
        <option value="">Min</option>
        {opcionesMinutosTransmision.map((minuto) => (
          <option key={minuto} value={minuto}>
            {minuto}
          </option>
        ))}
      </select>

      <span className="selector-tiempo-separador">:</span>

      <select
        value={segundos}
        onChange={(evento) => cambiarSegundos(evento.target.value)}
        aria-label="Segundos"
      >
        <option value="">Seg</option>
        {opcionesSegundosTransmision.map((segundo) => (
          <option key={segundo} value={segundo}>
            {segundo}
          </option>
        ))}
      </select>
    </div>
  );
};

const CampoTiempo = ({
  value,
  onChange,
  modoTiempo,
  className = "",
  onKeyDown,
}) => {
  if (modoTiempo === "transmision") {
    return (
      <SelectorTiempoTransmision
        value={value}
        onChange={onChange}
        compacto={className.includes("input-hora-cambio")}
        onKeyDown={onKeyDown}
      />
    );
  }

  return (
    <input
      className={className}
      type="time"
      step="1"
      value={value || ""}
      onChange={(evento) => onChange(evento.target.value)}
      onKeyDown={onKeyDown}
    />
  );
};

const ListaJugadores = () => null;

const InputJugador = ({ value, onChange }) => (
  <SelectorNombre value={value} onChange={onChange} opciones={jugadores} />
);
'''

app = replace_section(
    app,
    "const opcionesTiempoTransmision = Array.from(",
    "\n\nexport default function App()",
    componentes_superiores,
    "componentes superiores",
)

rival_nuevo = r'''  const opcionesJugadoresRival = useMemo(
    () =>
      [
        ...(registro.jugadoresRival || []),
        ...(registro.titularesRival || []),
        ...(registro.convocadosRival || []),
        ...(registro.cambiosRival || []).map((cambio) => cambio.sale),
        ...(registro.cambiosRival || []).map((cambio) => cambio.entra),
      ].filter((jugador) => jugador && String(jugador).trim() !== ""),
    [
      registro.jugadoresRival,
      registro.titularesRival,
      registro.convocadosRival,
      registro.cambiosRival,
    ]
  );

  const ListaJugadoresRival = () => null;

  const InputJugadorRival = ({ value, onChange }) => (
    <SelectorNombre
      value={value}
      onChange={onChange}
      opciones={opcionesJugadoresRival}
    />
  );
'''

app = replace_section(
    app,
    "  const ListaJugadoresRival = () => (",
    "  const posicionScrollPendiente = useRef(null);",
    rival_nuevo,
    "selector de jugadores rival",
)

# El campo libre de transmisión deja de ser necesario, pero se conserva el
# normalizador porque participa de la lógica de referencias horarias.
start_limpiar = app.find("  const limpiarEntradaTiempoTransmision = (valor) => {")
end_limpiar = app.find("  const normalizarEntradaTiempoTransmision = (valor) => {", start_limpiar)
if start_limpiar < 0 or end_limpiar < 0:
    raise RuntimeError("No se encontró el limpiador de tiempos de transmisión")
app = app[:start_limpiar] + app[end_limpiar:]

start_props = app.find("  const obtenerPropsInputTiempo = (")
end_props = app.find("  const detectarModoTiempoFila = (fila) => {", start_props)
if start_props < 0 or end_props < 0:
    raise RuntimeError("No se encontró obtenerPropsInputTiempo")
app = app[:start_props] + app[end_props:]


def split_top_level(argumentos):
    partes = []
    inicio = 0
    niveles = {"(": 0, "[": 0, "{": 0}
    pares = {")": "(", "]": "[", "}": "{"}
    quote = None
    escape = False

    for indice, caracter in enumerate(argumentos):
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
            continue

        if caracter in niveles:
            niveles[caracter] += 1
            continue

        if caracter in pares:
            niveles[pares[caracter]] -= 1
            continue

        if caracter == "," and all(valor == 0 for valor in niveles.values()):
            partes.append(argumentos[inicio:indice].strip())
            inicio = indice + 1

    partes.append(argumentos[inicio:].strip())
    return partes


def encontrar_cierre_parentesis(texto, inicio):
    profundidad = 1
    quote = None
    escape = False

    for indice in range(inicio, len(texto)):
        caracter = texto[indice]

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
        elif caracter == "(":
            profundidad += 1
        elif caracter == ")":
            profundidad -= 1
            if profundidad == 0:
                return indice

    raise RuntimeError("Paréntesis sin cerrar en obtenerPropsInputTiempo")


def reemplazar_inputs_tiempo(texto):
    posicion = 0
    reemplazos = 0

    while True:
        inicio = texto.find("<input", posicion)
        if inicio < 0:
            break

        final = texto.find("/>", inicio)
        if final < 0:
            break

        etiqueta = texto[inicio : final + 2]
        marcador = "{...obtenerPropsInputTiempo("

        if marcador not in etiqueta or "{...(usarTransmision" in etiqueta:
            posicion = final + 2
            continue

        llamada = etiqueta.find("obtenerPropsInputTiempo(")
        argumentos_inicio = llamada + len("obtenerPropsInputTiempo(")
        argumentos_fin = encontrar_cierre_parentesis(etiqueta, argumentos_inicio)
        argumentos = split_top_level(etiqueta[argumentos_inicio:argumentos_fin])

        if len(argumentos) != 3:
            raise RuntimeError(
                f"Se esperaban 3 argumentos y se encontraron {len(argumentos)} en: {etiqueta}"
            )

        linea_inicio = texto.rfind("\n", 0, inicio) + 1
        indentacion = texto[linea_inicio:inicio]
        clase = re.search(r'className="([^"]+)"', etiqueta)

        lineas = [
            f"{indentacion}<CampoTiempo",
            f"{indentacion}  value={{{argumentos[0]}}}",
            f"{indentacion}  onChange={{{argumentos[1]}}}",
            f"{indentacion}  modoTiempo={{{argumentos[2]}}}",
        ]

        if clase:
            lineas.append(f'{indentacion}  className="{clase.group(1)}"')

        lineas.append(f"{indentacion}/>")
        nueva_etiqueta = "\n".join(lineas)

        texto = texto[:inicio] + nueva_etiqueta + texto[final + 2 :]
        posicion = inicio + len(nueva_etiqueta)
        reemplazos += 1

    return texto, reemplazos


app, cantidad_inputs = reemplazar_inputs_tiempo(app)
if cantidad_inputs < 10:
    raise RuntimeError(f"Solo se reemplazaron {cantidad_inputs} campos de tiempo")

campo_detalle_nuevo = r'''  const CampoDetalleEditable = ({ label, type = "text", value, onChange }) => {
    const modoDetalle =
      registroSeleccionado?.item?.modoTiempo || registro.modoTiempo;
    const usarTransmision =
      type === "time" &&
      (esFormatoTransmision(value) || modoDetalle === "transmision");

    return (
      <div className="campo-detalle-editable">
        <label>{label}</label>
        {usarTransmision ? (
          <CampoTiempo
            value={value}
            onChange={onChange}
            modoTiempo="transmision"
            onKeyDown={manejarEnter}
          />
        ) : (
          <input
            type={type}
            step={type === "time" ? "1" : undefined}
            value={value || ""}
            onChange={(evento) => onChange(evento.target.value)}
            onKeyDown={manejarEnter}
          />
        )}
      </div>
    );
  };
'''

app = replace_section(
    app,
    "  const CampoDetalleEditable = ({ label, type = \"text\", value, onChange }) => {",
    "\n\n  const DetalleRegistro = ({ item, index }) => {",
    campo_detalle_nuevo,
    "CampoDetalleEditable",
)

app = app.replace('const APP_VERSION = "2026.08.06.2";', 'const APP_VERSION = "2026.08.06.3";')

for prohibido in (
    "obtenerPropsInputTiempo",
    "lista-tiempos-transmision",
    '<datalist id="lista-jugadores"',
    '<datalist id="lista-jugadores-rival"',
):
    if prohibido in app:
        raise RuntimeError(f"Todavía queda una referencia obsoleta: {prohibido}")

if app.count("<CampoTiempo") < 11:
    raise RuntimeError("No se aplicó CampoTiempo en todos los controles esperados")

css_nuevo = r'''

/* Selectores desplazables de tiempo y nombres */
.fila-hora .selector-tiempo-transmision {
  flex: 1;
  min-width: 0;
}

.selector-tiempo-transmision {
  width: 100%;
  height: 46px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr);
  align-items: center;
  padding: 0 6px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  background: #f8fafc;
  transition: border-color 0.15s ease, box-shadow 0.15s ease,
    background 0.15s ease;
}

.selector-tiempo-transmision:focus-within {
  border-color: #334155;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(51, 65, 85, 0.12);
}

.selector-tiempo-transmision select {
  width: 100%;
  height: 42px;
  border: 0;
  border-radius: 10px;
  padding: 0 3px;
  background: transparent;
  color: #0f172a;
  font-size: 14px;
  font-weight: 900;
  text-align: center;
  text-align-last: center;
  box-shadow: none;
}

.selector-tiempo-transmision select:focus {
  border: 0;
  background: rgba(226, 232, 240, 0.55);
  box-shadow: none;
}

.selector-tiempo-separador {
  color: #0f172a;
  font-size: 17px;
  font-weight: 900;
  text-align: center;
}

.selector-tiempo-transmision.compacto {
  height: 30px;
  grid-template-columns: minmax(0, 1fr) 7px minmax(0, 1fr);
  padding: 0 1px;
  border-radius: 10px;
}

.selector-tiempo-transmision.compacto select {
  height: 27px;
  padding: 0;
  border-radius: 8px;
  font-size: 10px;
}

.selector-tiempo-transmision.compacto .selector-tiempo-separador {
  font-size: 11px;
}

.selector-nombre {
  position: relative;
  width: 100%;
  min-width: 0;
}

.selector-nombre.abierto,
.fila-cambio:focus-within {
  z-index: 80;
}

.selector-nombre-lista {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  right: 0;
  z-index: 300;
  max-height: 230px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 5px;
  border: 1px solid #94a3b8;
  border-radius: 13px;
  background: #ffffff;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.28);
}

.selector-nombre-opcion {
  width: 100%;
  min-height: 39px;
  padding: 8px 10px;
  border-radius: 9px;
  background: #ffffff;
  color: #0f172a;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.25;
  text-align: left;
  touch-action: manipulation;
}

.selector-nombre-opcion:hover,
.selector-nombre-opcion:active,
.selector-nombre-opcion.activa {
  transform: none;
  box-shadow: none;
  background: #dcfce7;
  color: #14532d;
}

.selector-nombre-sin-resultados {
  padding: 11px;
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.35;
}

.tabla-cambios {
  overflow: visible;
}

.fila-cambio {
  position: relative;
}

@media (max-width: 600px) {
  .selector-nombre-lista {
    max-height: 190px;
  }

  .selector-nombre-opcion {
    min-height: 42px;
    font-size: 12px;
  }
}
'''

if "/* Selectores desplazables de tiempo y nombres */" not in css:
    css = css.rstrip() + css_nuevo + "\n"

APP_PATH.write_text(app, encoding="utf-8")
CSS_PATH.write_text(css, encoding="utf-8")
VERSION_PATH.write_text('{\n  "version": "2026.08.06.3"\n}\n', encoding="utf-8")

print(f"Campos de tiempo reemplazados: {cantidad_inputs}")
print("Selectores de tiempo y nombres aplicados correctamente")
