from pathlib import Path

APP_PATH = Path("src/App.js")
CSS_PATH = Path("src/style.css")
VERSION_PATH = Path("public/version.json")

app = APP_PATH.read_text(encoding="utf-8")
css = CSS_PATH.read_text(encoding="utf-8")
version = VERSION_PATH.read_text(encoding="utf-8")

app = app.replace(
    'const APP_VERSION = "2026.08.06.4";',
    'const APP_VERSION = "2026.08.06.5";',
    1,
)

needle = '''const opcionesSegundosTransmision = Array.from(
  { length: 60 },
  (_, segundo) => String(segundo).padStart(2, "0")
);
'''
replacement = needle + '''
const opcionesHorasEnVivo = Array.from(
  { length: 24 },
  (_, hora) => String(hora).padStart(2, "0")
);
'''
if needle not in app:
    raise RuntimeError("No se encontró el bloque de opciones de segundos")
app = app.replace(needle, replacement, 1)

insert_at = app.find("const CampoTiempo = ({")
if insert_at < 0:
    raise RuntimeError("No se encontró CampoTiempo")

selector_hora = r'''const descomponerHoraEnVivo = (valor) => {
  const coincidencia = String(valor || "").match(
    /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/
  );

  if (!coincidencia) {
    return { horas: "", minutos: "", segundos: "" };
  }

  return {
    horas: coincidencia[1].padStart(2, "0"),
    minutos: coincidencia[2].padStart(2, "0"),
    segundos: (coincidencia[3] || "00").padStart(2, "0"),
  };
};

const SelectorHoraEnVivo = ({
  value,
  onChange,
  compacto = false,
  onKeyDown,
}) => {
  const contenedorRef = useRef(null);
  const listaHorasRef = useRef(null);
  const listaMinutosRef = useRef(null);
  const listaSegundosRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const { horas, minutos, segundos } = descomponerHoraEnVivo(value);
  const horaSeleccionada = horas || "00";
  const minutoSeleccionado = minutos || "00";
  const segundoSeleccionado = segundos || "00";

  useEffect(() => {
    const cerrarAlTocarAfuera = (evento) => {
      if (!contenedorRef.current?.contains(evento.target)) {
        setAbierto(false);
      }
    };

    document.addEventListener("pointerdown", cerrarAlTocarAfuera);
    return () => document.removeEventListener("pointerdown", cerrarAlTocarAfuera);
  }, []);

  useLayoutEffect(() => {
    if (!abierto) return undefined;

    const centrarSeleccion = (lista, valor) => {
      const opcion = lista?.querySelector(`[data-valor="${valor}"]`);
      if (!lista || !opcion) return;

      lista.scrollTop =
        opcion.offsetTop - lista.clientHeight / 2 + opcion.clientHeight / 2;
    };

    const frame = window.requestAnimationFrame(() => {
      centrarSeleccion(listaHorasRef.current, horaSeleccionada);
      centrarSeleccion(listaMinutosRef.current, minutoSeleccionado);
      centrarSeleccion(listaSegundosRef.current, segundoSeleccionado);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [abierto, horaSeleccionada, minutoSeleccionado, segundoSeleccionado]);

  const cambiarHora = (nuevaHora) => {
    onChange(`${nuevaHora}:${minutos || "00"}:${segundos || "00"}`);
  };

  const cambiarMinutos = (nuevoMinuto) => {
    onChange(`${horas || "00"}:${nuevoMinuto}:${segundos || "00"}`);
  };

  const cambiarSegundos = (nuevoSegundo) => {
    onChange(`${horas || "00"}:${minutos || "00"}:${nuevoSegundo}`);
  };

  const manejarTecladoInterno = (evento) => {
    if (evento.key === "Escape") {
      evento.preventDefault();
      setAbierto(false);
      return;
    }

    if (evento.key === "Enter" && abierto) {
      evento.preventDefault();
      setAbierto(false);
      return;
    }

    onKeyDown?.(evento);
  };

  return (
    <div
      ref={contenedorRef}
      className={`selector-tiempo-transmision selector-hora-en-vivo ${
        compacto ? "compacto" : ""
      } ${abierto ? "abierto" : ""}`}
      onKeyDown={manejarTecladoInterno}
    >
      <button
        type="button"
        className="selector-tiempo-disparador"
        onClick={() => setAbierto((actual) => !actual)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label="Elegir hora, minutos y segundos"
      >
        <span className={`selector-tiempo-valor ${value ? "" : "vacio"}`}>
          {value || "--:--:--"}
        </span>
        <span className="selector-tiempo-reloj" aria-hidden="true" />
      </button>

      {abierto && (
        <div className="selector-tiempo-panel">
          <div className="selector-tiempo-cabecera">
            <span>Hora</span>
            <span>Minutos</span>
            <span>Segundos</span>
          </div>

          <div className="selector-tiempo-columnas">
            <div
              ref={listaHorasRef}
              className="selector-tiempo-columna"
              role="listbox"
              aria-label="Hora"
            >
              {opcionesHorasEnVivo.map((hora) => (
                <button
                  key={hora}
                  type="button"
                  role="option"
                  data-valor={hora}
                  aria-selected={horaSeleccionada === hora}
                  className={`selector-tiempo-opcion ${
                    horaSeleccionada === hora ? "activa" : ""
                  }`}
                  onClick={() => cambiarHora(hora)}
                >
                  {hora}
                </button>
              ))}
            </div>

            <div
              ref={listaMinutosRef}
              className="selector-tiempo-columna"
              role="listbox"
              aria-label="Minutos"
            >
              {opcionesSegundosTransmision.map((minuto) => (
                <button
                  key={minuto}
                  type="button"
                  role="option"
                  data-valor={minuto}
                  aria-selected={minutoSeleccionado === minuto}
                  className={`selector-tiempo-opcion ${
                    minutoSeleccionado === minuto ? "activa" : ""
                  }`}
                  onClick={() => cambiarMinutos(minuto)}
                >
                  {minuto}
                </button>
              ))}
            </div>

            <div
              ref={listaSegundosRef}
              className="selector-tiempo-columna"
              role="listbox"
              aria-label="Segundos"
            >
              {opcionesSegundosTransmision.map((segundo) => (
                <button
                  key={segundo}
                  type="button"
                  role="option"
                  data-valor={segundo}
                  aria-selected={segundoSeleccionado === segundo}
                  className={`selector-tiempo-opcion ${
                    segundoSeleccionado === segundo ? "activa" : ""
                  }`}
                  onClick={() => cambiarSegundos(segundo)}
                >
                  {segundo}
                </button>
              ))}
            </div>
          </div>

          <div className="selector-tiempo-acciones">
            <button
              type="button"
              className="selector-tiempo-limpiar"
              onClick={() => {
                onChange("");
                setAbierto(false);
              }}
            >
              Limpiar
            </button>

            <button
              type="button"
              className="selector-tiempo-listo"
              onClick={() => setAbierto(false)}
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

'''
app = app[:insert_at] + selector_hora + app[insert_at:]

old_return = '''  return (
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
'''
new_return = '''  return (
    <SelectorHoraEnVivo
      value={value}
      onChange={onChange}
      compacto={className.includes("input-hora-cambio")}
      onKeyDown={onKeyDown}
    />
  );
};
'''
if old_return not in app:
    raise RuntimeError("No se encontró el input horario nativo")
app = app.replace(old_return, new_return, 1)

css_anchor = '''.selector-tiempo-transmision.compacto .selector-tiempo-panel {
  left: auto;
  right: 0;
  width: min(218px, calc(100vw - 20px));
}
'''
css_extra = css_anchor + '''
.selector-hora-en-vivo .selector-tiempo-panel {
  width: min(330px, calc(100vw - 28px));
}

.selector-hora-en-vivo .selector-tiempo-cabecera,
.selector-hora-en-vivo .selector-tiempo-columnas {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.selector-hora-en-vivo.compacto .selector-tiempo-panel {
  width: min(300px, calc(100vw - 20px));
}
'''
if css_anchor not in css:
    raise RuntimeError("No se encontró el ancla CSS del selector compacto")
css = css.replace(css_anchor, css_extra, 1)

version = version.replace("2026.08.06.4", "2026.08.06.5", 1)

if '<input\n      className={className}\n      type="time"' in app:
    raise RuntimeError("Sigue presente el selector horario nativo")
if "SelectorHoraEnVivo" not in app:
    raise RuntimeError("No se agregó SelectorHoraEnVivo")
if 'const APP_VERSION = "2026.08.06.5";' not in app:
    raise RuntimeError("No se actualizó la versión")

APP_PATH.write_text(app, encoding="utf-8")
CSS_PATH.write_text(css, encoding="utf-8")
VERSION_PATH.write_text(version, encoding="utf-8")

print("Selector de En Vivo unificado con Transmisión.")
