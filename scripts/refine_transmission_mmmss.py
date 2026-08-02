from pathlib import Path

APP = Path("src/App.js")
app = APP.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global app
    count = app.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    app = app.replace(old, new, 1)


replace_once(
    '''  const detectarModoTiempoFila = (fila) => {
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
    ];''',
    '''  const detectarModoTiempoFila = (fila) => {
    const valoresTiempo = [
      fila.inicio_pt,
      fila.final_pt,
      fila.inicio_st,
      fila.final_st,
      fila.inicio_var_pt_1,
      fila.final_var_pt_1,
      fila.inicio_var_pt_2,
      fila.final_var_pt_2,
      fila.inicio_var_pt_3,
      fila.final_var_pt_3,
      fila.inicio_var_st_1,
      fila.final_var_st_1,
      fila.inicio_var_st_2,
      fila.final_var_st_2,
      fila.inicio_var_st_3,
      fila.final_var_st_3,
      fila.inicio_hid_pt,
      fila.final_hid_pt,
      fila.inicio_hid_st,
      fila.final_hid_st,
      fila.cambio_1_tiempo,
      fila.cambio_2_tiempo,
      fila.cambio_3_tiempo,
      fila.cambio_4_tiempo,
      fila.cambio_5_tiempo,
      fila.rival_cambio_horario1,
      fila.rival_cambio_horario2,
      fila.rival_cambio_horario3,
      fila.rival_cambio_horario4,
      fila.rival_cambio_horario5,
    ];''',
    "detección completa de transmisión",
)

replace_once(
    '''  const obtenerMarcaActual = (tipo, estado = registro) => {
    if (estado.modoTiempo !== "transmision") return horaActual();
    return obtenerMarcaTransmision(tipo, estado);
  };

  const obtenerPeriodoActivo = () =>''',
    '''  const obtenerMarcaActual = (tipo, estado = registro) => {
    if (estado.modoTiempo !== "transmision") return horaActual();
    return obtenerMarcaTransmision(tipo, estado);
  };

  const actualizarCampoTiempo = (campo, valor) => {
    setRegistro((prev) => {
      const siguiente = {
        ...prev,
        [campo]: valor,
      };

      if (
        prev.modoTiempo === "transmision" &&
        (campo === "inicioPT" || campo === "inicioST")
      ) {
        const normalizado = normalizarEntradaTiempoTransmision(valor);

        if (normalizado) {
          const tipo = campo === "inicioST" ? "ST" : "PT";
          const claveReferencia =
            tipo === "ST" ? "referenciaRealST" : "referenciaRealPT";
          const baseSegundos = tipo === "ST" ? 45 * 60 : 0;
          const marcaSegundos = segundosDesdeHora(normalizado);
          const transcurridos = Math.max(0, marcaSegundos - baseSegundos);

          siguiente[claveReferencia] = Date.now() - transcurridos * 1000;
        }
      }

      return siguiente;
    });
  };

  const obtenerPeriodoActivo = () =>''',
    "referencia al cargar inicio manual",
)

replace_once(
    '''          {...obtenerPropsInputTiempo(
            registro[campo],
            (valor) => actualizar(campo, valor),
            registro.modoTiempo
          )}''',
    '''          {...obtenerPropsInputTiempo(
            registro[campo],
            (valor) => actualizarCampoTiempo(campo, valor),
            registro.modoTiempo
          )}''',
    "CampoHora con referencia manual",
)

replace_once(
    '''  const CampoDetalleEditable = ({ label, type = "text", value, onChange }) => {
    const usarTransmision =
      type === "time" &&
      (esFormatoTransmision(value) || registro.modoTiempo === "transmision");''',
    '''  const CampoDetalleEditable = ({ label, type = "text", value, onChange }) => {
    const modoDetalle =
      registroSeleccionado?.item?.modoTiempo || registro.modoTiempo;
    const usarTransmision =
      type === "time" &&
      (esFormatoTransmision(value) || modoDetalle === "transmision");''',
    "modo de edición de detalle",
)

app = app.replace(
    '''<div>{registro.modoTiempo === "transmision" ? "Minuto" : "Hora"}</div>''',
    '''<div>{editado.modoTiempo === "transmision" ? "Minuto" : "Hora"}</div>''',
    2,
)

replace_once(
    '''                        <input
                          className="input-hora-cambio-detalle"
                          type={esFormatoTransmision(cambio.hora) ? "text" : "time"}
                          step={esFormatoTransmision(cambio.hora) ? undefined : "1"}
                          inputMode={esFormatoTransmision(cambio.hora) ? "numeric" : undefined}
                          value={cambio.hora || ""}
                          onChange={(e) =>
                            actualizarCambioEditado(
                              cambioIndex,
                              "hora",
                              e.target.value
                            )
                          }
                        />''',
    '''                        <input
                          className="input-hora-cambio-detalle"
                          {...obtenerPropsInputTiempo(
                            cambio.hora || "",
                            (valor) =>
                              actualizarCambioEditado(
                                cambioIndex,
                                "hora",
                                valor
                              ),
                            editado.modoTiempo
                          )}
                        />''',
    "edición cambio Atlético",
)

replace_once(
    '''    <input
      className="input-hora-cambio-detalle"
      type={esFormatoTransmision(cambio.hora) ? "text" : "time"}
      step={esFormatoTransmision(cambio.hora) ? undefined : "1"}
      inputMode={esFormatoTransmision(cambio.hora) ? "numeric" : undefined}
      value={cambio.hora || ""}
      onChange={(e) =>
        actualizarCambioRivalEditado(
          cambioIndex,
          "hora",
          e.target.value
        )
      }
    />''',
    '''    <input
      className="input-hora-cambio-detalle"
      {...obtenerPropsInputTiempo(
        cambio.hora || "",
        (valor) =>
          actualizarCambioRivalEditado(
            cambioIndex,
            "hora",
            valor
          ),
        editado.modoTiempo
      )}
    />''',
    "edición cambio rival",
)

APP.write_text(app, encoding="utf-8")
print("Refinamiento de transmisión aplicado")
