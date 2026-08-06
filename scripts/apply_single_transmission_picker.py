from pathlib import Path

APP_PATH = Path("src/App.js")
CSS_PATH = Path("src/style.css")
VERSION_PATH = Path("public/version.json")

app = APP_PATH.read_text(encoding="utf-8")
css = CSS_PATH.read_text(encoding="utf-8")
version = VERSION_PATH.read_text(encoding="utf-8")

app = app.replace(
    'const APP_VERSION = "2026.08.06.3";',
    'const APP_VERSION = "2026.08.06.4";',
    1,
)

inicio = app.find("const SelectorTiempoTransmision = ({")
fin = app.find("const CampoTiempo = ({", inicio)
if inicio < 0 or fin < 0:
    raise RuntimeError("No se encontró el componente SelectorTiempoTransmision")

selector_nuevo = r'''const SelectorTiempoTransmision = ({
  value,
  onChange,
  compacto = false,
  onKeyDown,
}) => {
  const contenedorRef = useRef(null);
  const listaMinutosRef = useRef(null);
  const listaSegundosRef = useRef(null);
  const [abierto, setAbierto] = useState(false);
  const { minutos, segundos } = descomponerTiempoTransmision(value);
  const minutoSeleccionado = minutos || "000";
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
      centrarSeleccion(listaMinutosRef.current, minutoSeleccionado);
      centrarSeleccion(listaSegundosRef.current, segundoSeleccionado);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [abierto, minutoSeleccionado, segundoSeleccionado]);

  const cambiarMinutos = (nuevoMinuto) => {
    onChange(`${nuevoMinuto}:${segundos || "00"}`);
  };

  const cambiarSegundos = (nuevoSegundo) => {
    onChange(`${minutos || "000"}:${nuevoSegundo}`);
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
      className={`selector-tiempo-transmision ${
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
        aria-label="Elegir minutos y segundos"
      >
        <span
          className={`selector-tiempo-valor ${value ? "" : "vacio"}`}
        >
          {value || "---:--"}
        </span>
        <span className="selector-tiempo-reloj" aria-hidden="true" />
      </button>

      {abierto && (
        <div className="selector-tiempo-panel">
          <div className="selector-tiempo-cabecera">
            <span>Minutos</span>
            <span>Segundos</span>
          </div>

          <div className="selector-tiempo-columnas">
            <div
              ref={listaMinutosRef}
              className="selector-tiempo-columna"
              role="listbox"
              aria-label="Minutos"
            >
              {opcionesMinutosTransmision.map((minuto) => (
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

app = app[:inicio] + selector_nuevo + app[fin:]

inicio_css = css.find(".fila-hora .selector-tiempo-transmision {")
fin_css = css.find(".selector-nombre {", inicio_css)
if inicio_css < 0 or fin_css < 0:
    raise RuntimeError("No se encontró el bloque CSS del selector de transmisión")

css_nuevo = r'''.fila-hora .selector-tiempo-transmision {
  flex: 1;
  min-width: 0;
}

.selector-tiempo-transmision {
  position: relative;
  width: 100%;
  min-width: 0;
  z-index: 1;
}

.selector-tiempo-transmision.abierto {
  z-index: 240;
}

.selector-tiempo-disparador {
  width: 100%;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 13px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 15px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  box-shadow: none;
}

.selector-tiempo-disparador:hover {
  transform: none;
  box-shadow: none;
}

.selector-tiempo-disparador:focus,
.selector-tiempo-transmision.abierto .selector-tiempo-disparador {
  outline: none;
  border-color: #334155;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(51, 65, 85, 0.12);
}

.selector-tiempo-valor.vacio {
  color: #64748b;
  letter-spacing: 0.02em;
}

.selector-tiempo-reloj {
  position: relative;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  border: 1.8px solid currentColor;
  border-radius: 999px;
  opacity: 0.9;
}

.selector-tiempo-reloj::before,
.selector-tiempo-reloj::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1.5px;
  border-radius: 999px;
  background: currentColor;
  transform-origin: 50% 100%;
}

.selector-tiempo-reloj::before {
  height: 4px;
  transform: translate(-50%, -100%);
}

.selector-tiempo-reloj::after {
  height: 3px;
  transform: translate(-50%, -100%) rotate(120deg);
}

.selector-tiempo-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 500;
  width: min(240px, calc(100vw - 28px));
  padding: 8px;
  border: 1px solid #94a3b8;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.3);
}

.selector-tiempo-cabecera {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 2px 4px 7px;
  color: #475569;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;
}

.selector-tiempo-columnas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.selector-tiempo-columna {
  height: 216px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 3px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  scrollbar-width: thin;
}

.selector-tiempo-opcion {
  width: 100%;
  min-height: 36px;
  padding: 5px 4px;
  border-radius: 8px;
  background: transparent;
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
  font-variant-numeric: tabular-nums;
  text-align: center;
  box-shadow: none;
}

.selector-tiempo-opcion:hover,
.selector-tiempo-opcion:active {
  transform: none;
  box-shadow: none;
  background: #e2e8f0;
}

.selector-tiempo-opcion.activa,
.selector-tiempo-opcion.activa:hover {
  background: linear-gradient(135deg, #000000, #16a34a);
  color: #ffffff;
}

.selector-tiempo-acciones {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  margin-top: 8px;
}

.selector-tiempo-acciones button {
  min-height: 34px;
  border-radius: 9px;
  font-size: 11px;
}

.selector-tiempo-limpiar {
  background: #e2e8f0;
  color: #334155;
}

.selector-tiempo-listo {
  background: linear-gradient(135deg, #000000, #16a34a);
  color: #ffffff;
}

.selector-tiempo-transmision.compacto .selector-tiempo-disparador {
  height: 30px;
  padding: 0 5px;
  border-radius: 10px;
  font-size: 10px;
  gap: 3px;
}

.selector-tiempo-transmision.compacto .selector-tiempo-reloj {
  width: 11px;
  height: 11px;
  flex-basis: 11px;
}

.selector-tiempo-transmision.compacto .selector-tiempo-panel {
  left: auto;
  right: 0;
  width: min(218px, calc(100vw - 20px));
}

@media (max-width: 600px) {
  .selector-tiempo-panel {
    width: min(230px, calc(100vw - 20px));
  }

  .selector-tiempo-columna {
    height: 198px;
  }

  .selector-tiempo-opcion {
    min-height: 38px;
  }
}

'''

css = css[:inicio_css] + css_nuevo + css[fin_css:]

version = version.replace("2026.08.06.3", "2026.08.06.4", 1)

if "selector-tiempo-panel" not in app:
    raise RuntimeError("No se agregó el desplegable único")

bloque_selector = app[
    app.find("const SelectorTiempoTransmision = ({") : app.find("const CampoTiempo = ({")
]
if "<select" in bloque_selector:
    raise RuntimeError("El selector todavía contiene desplegables separados")

if 'const APP_VERSION = "2026.08.06.4";' not in app:
    raise RuntimeError("No se actualizó APP_VERSION")

APP_PATH.write_text(app, encoding="utf-8")
CSS_PATH.write_text(css, encoding="utf-8")
VERSION_PATH.write_text(version, encoding="utf-8")

print("Selector único de minutos y segundos aplicado correctamente.")
