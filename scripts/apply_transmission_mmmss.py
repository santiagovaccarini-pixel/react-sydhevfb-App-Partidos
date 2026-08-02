from pathlib import Path

APP = Path("src/App.js")
STYLE = Path("src/style.css")

app = APP.read_text(encoding="utf-8")
style = STYLE.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


# 1) Detectar automáticamente registros de transmisión al leer Supabase.
app = replace_once(
    app,
    '''      fecha: fila.fecha || "",
      rival: fila.rival || "",
      resultado: fila.resultado || "",
  
      inicioPT: fila.inicio_pt || "",''',
    '''      fecha: fila.fecha || "",
      rival: fila.rival || "",
      resultado: fila.resultado || "",
      modoTiempo: detectarModoTiempoFila(fila),
  
      inicioPT: fila.inicio_pt || "",''',
    "modoTiempo en conversión Supabase",
)

# 2) Lógica de botones Ahora, VAR, cambios y referencias reales.
app = replace_once(
    app,
    '''  const ponerAhoraVar = (tipo, campo) => {
    actualizarVar(tipo, campo, horaActual());
  };''',
    '''  const ponerAhoraVar = (tipo, campo) => {
    const valor = obtenerMarcaActual(tipo);

    if (!valor) {
      alert(`Primero marcá Inicio ${tipo}.`);
      return;
    }

    actualizarVar(tipo, campo, valor);
    setTimeout(quitarFoco, 0);
  };''',
    "ponerAhoraVar",
)

app = replace_once(
    app,
    '''  const horaActual = () => {
    const ahora = new Date();
    return ahora.toTimeString().slice(0, 8);
  };

  const quitarFoco = () => {''',
    '''  const horaActual = () => {
    const ahora = new Date();
    return ahora.toTimeString().slice(0, 8);
  };

  const esFormatoTransmision = (valor) =>
    /^\\d{3,}:\\d{2}$/.test(String(valor || "").trim());

  const formatearTiempoTransmision = (totalSegundos) => {
    const segundosSeguros = Math.max(0, Math.floor(Number(totalSegundos) || 0));
    const minutos = Math.floor(segundosSeguros / 60);
    const segundos = segundosSeguros % 60;

    return `${String(minutos).padStart(3, "0")}:${String(segundos).padStart(2, "0")}`;
  };

  const limpiarEntradaTiempoTransmision = (valor) => {
    const limpio = String(valor || "").replace(/[^\\d:]/g, "");
    const tieneDosPuntos = limpio.includes(":");

    if (tieneDosPuntos) {
      const [minutos = "", segundos = ""] = limpio.split(":");
      return `${minutos.slice(0, 3)}:${segundos.slice(0, 2)}`;
    }

    if (limpio.length <= 3) return limpio;

    return `${limpio.slice(0, 3)}:${limpio.slice(3, 5)}`;
  };

  const normalizarEntradaTiempoTransmision = (valor) => {
    const texto = String(valor || "").trim();
    if (!texto) return "";

    const coincidencia = texto.match(/^(\\d{1,3}):([0-5]?\\d)$/);
    if (!coincidencia) return null;

    return `${coincidencia[1].padStart(3, "0")}:${coincidencia[2].padStart(2, "0")}`;
  };

  const obtenerPropsInputTiempo = (
    valor,
    onChange,
    modoTiempo = registro.modoTiempo
  ) => {
    if (modoTiempo !== "transmision") {
      return {
        type: "time",
        step: "1",
        value: valor || "",
        onChange: (e) => onChange(e.target.value),
      };
    }

    return {
      type: "text",
      inputMode: "numeric",
      placeholder: "000:00",
      maxLength: 6,
      value: valor || "",
      onChange: (e) => onChange(limpiarEntradaTiempoTransmision(e.target.value)),
      onBlur: (e) => {
        const normalizado = normalizarEntradaTiempoTransmision(e.target.value);
        if (normalizado !== null) onChange(normalizado);
      },
    };
  };

  const detectarModoTiempoFila = (fila) => {
    const valoresTiempo = [
      fila.inicio_pt,
      fila.final_pt,
      fila.inicio_st,
      fila.final_st,
      fila.inicio_var_pt_1,
      fila.final_var_pt_1,
      fila.inicio_var_st_1,
      fila.final_var_st_1,
      fila.inicio_hid_pt,
      fila.final_hid_pt,
      fila.inicio_hid_st,
      fila.final_hid_st,
      fila.cambio_1_tiempo,
      fila.rival_cambio_horario1,
    ];

    return valoresTiempo.some(esFormatoTransmision)
      ? "transmision"
      : "enVivo";
  };

  const obtenerPeriodoCampo = (campo) =>
    String(campo || "").toUpperCase().includes("ST") ? "ST" : "PT";

  const obtenerMarcaTransmision = (tipo, estado = registro) => {
    const claveReferencia = tipo === "ST" ? "referenciaRealST" : "referenciaRealPT";
    const referencia = Number(estado[claveReferencia]);

    if (!referencia) return "";

    const baseSegundos = tipo === "ST" ? 45 * 60 : 0;
    const transcurridos = Math.max(
      0,
      Math.floor((Date.now() - referencia) / 1000)
    );

    return formatearTiempoTransmision(baseSegundos + transcurridos);
  };

  const obtenerMarcaActual = (tipo, estado = registro) => {
    if (estado.modoTiempo !== "transmision") return horaActual();
    return obtenerMarcaTransmision(tipo, estado);
  };

  const obtenerPeriodoActivo = () =>
    registro.referenciaRealST ? "ST" : "PT";

  const quitarFoco = () => {''',
    "helpers de transmisión",
)

app = replace_once(
    app,
    '''  const ponerAhora = (campo) => {
    quitarFoco();

    mantenerPosicion(() => {
      actualizar(campo, horaActual());
    });

    setTimeout(quitarFoco, 0);
  };

  const ponerHoraCambio = (index) => {
    quitarFoco();

    mantenerPosicion(() => {
      actualizarCambio(index, "hora", horaActual());
    });

    setTimeout(quitarFoco, 0);
  };
  const ponerHoraCambioRival = (index) => {
    quitarFoco();
  
    mantenerPosicion(() => {
      actualizarCambioRival(index, "hora", horaActual());
    });
  
    setTimeout(quitarFoco, 0);
  };''',
    '''  const ponerAhora = (campo) => {
    quitarFoco();

    if (registro.modoTiempo === "transmision") {
      const tipo = obtenerPeriodoCampo(campo);
      const esInicioPeriodo = campo === "inicioPT" || campo === "inicioST";

      if (esInicioPeriodo) {
        const claveReferencia =
          tipo === "ST" ? "referenciaRealST" : "referenciaRealPT";
        const valorInicial = formatearTiempoTransmision(
          tipo === "ST" ? 45 * 60 : 0
        );
        const referencia = Date.now();

        mantenerPosicion(() => {
          setRegistro((prev) => ({
            ...prev,
            [claveReferencia]: referencia,
            [campo]: valorInicial,
          }));
        });
      } else {
        const valor = obtenerMarcaTransmision(tipo);

        if (!valor) {
          alert(`Primero marcá Inicio ${tipo}.`);
          return;
        }

        mantenerPosicion(() => actualizar(campo, valor));
      }
    } else {
      mantenerPosicion(() => actualizar(campo, horaActual()));
    }

    setTimeout(quitarFoco, 0);
  };

  const ponerHoraCambio = (index) => {
    quitarFoco();

    const tipo = obtenerPeriodoActivo();
    const valor = obtenerMarcaActual(tipo);

    if (!valor) {
      alert(`Primero marcá Inicio ${tipo}.`);
      return;
    }

    mantenerPosicion(() => actualizarCambio(index, "hora", valor));
    setTimeout(quitarFoco, 0);
  };
  const ponerHoraCambioRival = (index) => {
    quitarFoco();

    const tipo = obtenerPeriodoActivo();
    const valor = obtenerMarcaActual(tipo);

    if (!valor) {
      alert(`Primero marcá Inicio ${tipo}.`);
      return;
    }
  
    mantenerPosicion(() => actualizarCambioRival(index, "hora", valor));
    setTimeout(quitarFoco, 0);
  };''',
    "ponerAhora y cambios",
)

# 3) Recomendaciones Sportradar: conservar minuto de partido en Transmisión.
app = replace_once(
    app,
    '''  const calcularHoraCambioDesdeMinuto = (matchClock) => {
    if (!matchClock) return "";
  
    const partes = String(matchClock).split(":").map(Number);
    const minuto = partes[0] || 0;
    const segundo = partes[1] || 0;
  
    let horaBase = "";''',
    '''  const calcularHoraCambioDesdeMinuto = (matchClock) => {
    if (!matchClock) return "";
  
    const partes = String(matchClock).split(":").map(Number);
    const minuto = partes[0] || 0;
    const segundo = partes[1] || 0;

    if (registro.modoTiempo === "transmision") {
      return formatearTiempoTransmision(minuto * 60 + segundo);
    }
  
    let horaBase = "";''',
    "Sportradar en transmisión",
)

# 4) Interpretar correctamente MMM:SS en cálculos de duración.
app = replace_once(
    app,
    '''  const segundosDesdeHora = (hora) => {
    if (!hora) return null;

    const partes = hora.split(":").map(Number);
    const horas = partes[0] || 0;
    const minutos = partes[1] || 0;
    const segundos = partes[2] || 0;

    return horas * 3600 + minutos * 60 + segundos;
  };''',
    '''  const segundosDesdeHora = (hora) => {
    if (!hora) return null;

    const texto = String(hora).trim();

    if (esFormatoTransmision(texto)) {
      const [minutos, segundos] = texto.split(":").map(Number);
      return minutos * 60 + segundos;
    }

    const partes = texto.split(":").map(Number);
    const horas = partes[0] || 0;
    const minutos = partes[1] || 0;
    const segundos = partes[2] || 0;

    return horas * 3600 + minutos * 60 + segundos;
  };''',
    "parser de tiempos",
)

# 5) Inputs generales PT/ST e hidrataciones.
app = replace_once(
    app,
    '''        <input
          type="time"
          step="1"
          value={registro[campo]}
          onChange={(e) => actualizar(campo, e.target.value)}
        />''',
    '''        <input
          {...obtenerPropsInputTiempo(
            registro[campo],
            (valor) => actualizar(campo, valor),
            registro.modoTiempo
          )}
        />''',
    "CampoHora dinámico",
)

# 6) VAR PT: inputs MMM:SS y botón centralizado.
app = replace_once(
    app,
    '''      <input
        type="time"
        step="1"
        value={
          registro.varsPT[registro.varPTActivo]?.inicio || ""
        }
        onChange={(e) =>
          actualizarVar("PT", "inicio", e.target.value)
        }
      />''',
    '''      <input
        {...obtenerPropsInputTiempo(
          registro.varsPT[registro.varPTActivo]?.inicio || "",
          (valor) => actualizarVar("PT", "inicio", valor),
          registro.modoTiempo
        )}
      />''',
    "input inicio VAR PT",
)

app = replace_once(
    app,
    '''        onClick={() =>
          actualizarVar("PT", "inicio", horaActual())
        }''',
    '''        onClick={() => ponerAhoraVar("PT", "inicio")}''',
    "botón inicio VAR PT",
)

app = replace_once(
    app,
    '''      <input
        type="time"
        step="1"
        value={
          registro.varsPT[registro.varPTActivo]?.final || ""
        }
        onChange={(e) =>
          actualizarVar("PT", "final", e.target.value)
        }
      />''',
    '''      <input
        {...obtenerPropsInputTiempo(
          registro.varsPT[registro.varPTActivo]?.final || "",
          (valor) => actualizarVar("PT", "final", valor),
          registro.modoTiempo
        )}
      />''',
    "input final VAR PT",
)

app = replace_once(
    app,
    '''        onClick={() =>
          actualizarVar("PT", "final", horaActual())
        }''',
    '''        onClick={() => ponerAhoraVar("PT", "final")}''',
    "botón final VAR PT",
)

# 7) VAR ST.
app = replace_once(
    app,
    '''      <input
        type="time"
        step="1"
        value={registro.varsST[registro.varSTActivo]?.inicio || ""}
        onChange={(e) => actualizarVar("ST", "inicio", e.target.value)}
      />''',
    '''      <input
        {...obtenerPropsInputTiempo(
          registro.varsST[registro.varSTActivo]?.inicio || "",
          (valor) => actualizarVar("ST", "inicio", valor),
          registro.modoTiempo
        )}
      />''',
    "input inicio VAR ST",
)

app = replace_once(
    app,
    '''      <input
        type="time"
        step="1"
        value={registro.varsST[registro.varSTActivo]?.final || ""}
        onChange={(e) => actualizarVar("ST", "final", e.target.value)}
      />''',
    '''      <input
        {...obtenerPropsInputTiempo(
          registro.varsST[registro.varSTActivo]?.final || "",
          (valor) => actualizarVar("ST", "final", valor),
          registro.modoTiempo
        )}
      />''',
    "input final VAR ST",
)

# 8) Cambios Atlético.
app = replace_once(
    app,
    '''                  <input
                    className="input-hora-cambio"
                    type="time"
                    step="1"
                    value={cambio.hora || ""}
                    onChange={(e) =>
                      actualizarCambio(index, "hora", e.target.value)
                    }
                  />''',
    '''                  <input
                    className="input-hora-cambio"
                    {...obtenerPropsInputTiempo(
                      cambio.hora || "",
                      (valor) => actualizarCambio(index, "hora", valor),
                      registro.modoTiempo
                    )}
                  />''',
    "input cambio Atlético",
)

# 9) Cambios rival.
app = replace_once(
    app,
    '''                      <input
                        className="input-hora-cambio"
                        type="time"
                        step="1"
                        value={cambio.hora || ""}
                        onChange={(e) =>
                          actualizarCambioRival(index, "hora", e.target.value)
                        }
                      />''',
    '''                      <input
                        className="input-hora-cambio"
                        {...obtenerPropsInputTiempo(
                          cambio.hora || "",
                          (valor) => actualizarCambioRival(index, "hora", valor),
                          registro.modoTiempo
                        )}
                      />''',
    "input cambio rival",
)

# 10) Encabezados de columnas según el modo.
app = app.replace(
    '''              <div>Hora</div>''',
    '''              <div>{registro.modoTiempo === "transmision" ? "Minuto" : "Hora"}</div>''',
    2,
)

# 11) Edición de registros: permitir valores MMM:SS ya guardados.
app = replace_once(
    app,
    '''  const CampoDetalleEditable = ({ label, type = "text", value, onChange }) => (
    <div className="campo-detalle-editable">
      <label>{label}</label>
      <input
        type={type}
        step={type === "time" ? "1" : undefined}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={manejarEnter}
      />
    </div>
  );''',
    '''  const CampoDetalleEditable = ({ label, type = "text", value, onChange }) => {
    const usarTransmision =
      type === "time" &&
      (esFormatoTransmision(value) || registro.modoTiempo === "transmision");

    return (
      <div className="campo-detalle-editable">
        <label>{label}</label>
        <input
          {...(usarTransmision
            ? obtenerPropsInputTiempo(value, onChange, "transmision")
            : {
                type,
                step: type === "time" ? "1" : undefined,
                value: value || "",
                onChange: (e) => onChange(e.target.value),
              })}
          onKeyDown={manejarEnter}
        />
      </div>
    );
  };''',
    "CampoDetalleEditable",
)

# Inputs de horas dentro de tablas de edición: detectar por valor.
app = app.replace(
    '''                          type="time"
                          step="1"
                          value={cambio.hora || ""}''',
    '''                          type={esFormatoTransmision(cambio.hora) ? "text" : "time"}
                          step={esFormatoTransmision(cambio.hora) ? undefined : "1"}
                          inputMode={esFormatoTransmision(cambio.hora) ? "numeric" : undefined}
                          value={cambio.hora || ""}''',
    1,
)
app = app.replace(
    '''      type="time"
      step="1"
      value={cambio.hora || ""}''',
    '''      type={esFormatoTransmision(cambio.hora) ? "text" : "time"}
      step={esFormatoTransmision(cambio.hora) ? undefined : "1"}
      inputMode={esFormatoTransmision(cambio.hora) ? "numeric" : undefined}
      value={cambio.hora || ""}''',
    1,
)

# Estilo mínimo para que MMM:SS permanezca legible y estable.
if "/* Inputs de transmisión MMM:SS */" not in style:
    style += '''

/* Inputs de transmisión MMM:SS */
.fila-hora input[type="text"],
.input-hora-cambio[type="text"],
.input-hora-cambio-detalle[type="text"] {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  text-align: center;
}
'''

APP.write_text(app, encoding="utf-8")
STYLE.write_text(style, encoding="utf-8")

print("Corrección MMM:SS aplicada correctamente")
