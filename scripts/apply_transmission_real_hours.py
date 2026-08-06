from pathlib import Path

APP_PATH = Path("src/App.js")
VERSION_PATH = Path("public/version.json")
STYLE_PATH = Path("src/style.css")
NEW_VERSION = "2026.08.06.1"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)


text = APP_PATH.read_text(encoding="utf-8")

text = replace_once(
    text,
    'const APP_VERSION = "2026.08.03.8";',
    f'const APP_VERSION = "{NEW_VERSION}";',
    "version App.js",
)

old_lista = '''const ListaJugadores = () => (
  <datalist id="lista-jugadores">
    {jugadores
      .filter((jugador) => jugador !== "")
      .map((jugador, index) => (
        <option key={index} value={jugador} />
      ))}
  </datalist>
);'''
new_lista = '''const opcionesTiempoTransmision = Array.from(
  { length: 121 },
  (_, minuto) => `${String(minuto).padStart(3, "0")}:00`
);

const ListaJugadores = () => (
  <>
    <datalist id="lista-jugadores">
      {jugadores
        .filter((jugador) => jugador !== "")
        .map((jugador, index) => (
          <option key={index} value={jugador} />
        ))}
    </datalist>

    <datalist id="lista-tiempos-transmision">
      {opcionesTiempoTransmision.map((tiempo) => (
        <option key={tiempo} value={tiempo} />
      ))}
    </datalist>
  </>
);'''
text = replace_once(text, old_lista, new_lista, "datalist de transmisión")

text = replace_once(
    text,
    '''    extraMinuto: "",
  });''',
    '''    extraMinuto: "",
    periodo: "",
  });''',
    "periodo en cambios",
)

text = replace_once(
    text,
    '''    referenciaRealPTE: null,
    referenciaRealSTE: null,
    inicioPTE: "",''',
    '''    referenciaRealPTE: null,
    referenciaRealSTE: null,
    horaInicioRealPTE: "",
    horaFinalRealPTE: "",
    horaInicioRealSTE: "",
    horaFinalRealSTE: "",
    inicioPTE: "",''',
    "horas reales de prórroga",
)

text = replace_once(
    text,
    '''    referenciaRealPT: null,
    referenciaRealST: null,
    ...crearProrrogaVacia(),''',
    '''    referenciaRealPT: null,
    referenciaRealST: null,
    horaInicioRealPT: "",
    horaFinalRealPT: "",
    horaInicioRealST: "",
    horaFinalRealST: "",
    ...crearProrrogaVacia(),''',
    "horas reales PT ST",
)

text = replace_once(
    text,
    '''    const cambiosRivalExtra = Array.isArray(fila.cambios_rival_extra)
      ? fila.cambios_rival_extra
      : [];

    const registroConvertido = {''',
    '''    const cambiosRivalExtra = Array.isArray(fila.cambios_rival_extra)
      ? fila.cambios_rival_extra
      : [];
    const guiaTransmision = fila.guia_transmision || {};
    const esTransmisionConHorasReales =
      guiaTransmision.modo === "transmision";
    const modoDetectado = detectarModoTiempoFila(fila);

    const registroConvertido = {''',
    "lectura guía transmisión",
)

text = replace_once(
    text,
    '''      resultado: fila.resultado || "",
      modoTiempo: detectarModoTiempoFila(fila),
  
      inicioPT: fila.inicio_pt || "",''',
    '''      resultado: fila.resultado || "",
      // Los registros nuevos de Transmisión ya están persistidos como horas reales.
      modoTiempo: esTransmisionConHorasReales ? "enVivo" : modoDetectado,
      modoCaptura: esTransmisionConHorasReales ? "transmision" : modoDetectado,
      guiaTransmision,
      horaInicioRealPT: guiaTransmision.horaInicioRealPT || "",
      horaFinalRealPT: guiaTransmision.horaFinalRealPT || "",
      horaInicioRealST: guiaTransmision.horaInicioRealST || "",
      horaFinalRealST: guiaTransmision.horaFinalRealST || "",
  
      inicioPT: fila.inicio_pt || "",''',
    "modo de registros guardados",
)

text = replace_once(
    text,
    '''      referenciaRealPTE: null,
      referenciaRealSTE: null,
      inicioPTE: prorroga.inicioPTE || "",''',
    '''      referenciaRealPTE: null,
      referenciaRealSTE: null,
      horaInicioRealPTE: guiaTransmision.horaInicioRealPTE || "",
      horaFinalRealPTE: guiaTransmision.horaFinalRealPTE || "",
      horaInicioRealSTE: guiaTransmision.horaInicioRealSTE || "",
      horaFinalRealSTE: guiaTransmision.horaFinalRealSTE || "",
      inicioPTE: prorroga.inicioPTE || "",''',
    "horas reales de prórroga al cargar",
)

text = replace_once(
    text,
    '''      referenciaRealPT: null,
      referenciaRealST: null,
      referenciaRealPTE: null,
      referenciaRealSTE: null,
    }));''',
    '''      referenciaRealPT: null,
      referenciaRealST: null,
      referenciaRealPTE: null,
      referenciaRealSTE: null,
      horaInicioRealPT: "",
      horaFinalRealPT: "",
      horaInicioRealST: "",
      horaFinalRealST: "",
      horaInicioRealPTE: "",
      horaFinalRealPTE: "",
      horaInicioRealSTE: "",
      horaFinalRealSTE: "",
    }));''',
    "reinicio al cambiar modo",
)

old_actualizar_cambios = '''  const actualizarCambio = (index, campo, valor) => {
    setRegistro((prev) => {
      const cambiosActualizados = [...prev.cambios];
  
      cambiosActualizados[index] = {
        ...cambiosActualizados[index],
        [campo]: valor,
      };
  
      return {
        ...prev,
        cambios: cambiosActualizados,
      };
    });
  };
  const actualizarCambioRival = (index, campo, valor) => {
    setRegistro((prev) => {
      const cambiosActualizados = [
        ...(prev.cambiosRival || crearCambiosVacios()),
      ];
  
      cambiosActualizados[index] = {
        ...cambiosActualizados[index],
        [campo]: valor,
      };
  
      return {
        ...prev,
        cambiosRival: cambiosActualizados,
      };
    });
  };'''
new_actualizar_cambios = '''  const actualizarCambio = (index, campo, valor) => {
    setRegistro((prev) => {
      const cambiosActualizados = [...(prev.cambios || crearCambiosVacios())];
      const cambioActual = cambiosActualizados[index] || crearCambioVacio();
  
      cambiosActualizados[index] = {
        ...cambioActual,
        [campo]: valor,
        periodo:
          campo === "hora" && prev.modoTiempo === "transmision"
            ? cambioActual.periodo || obtenerPeriodoActivo(prev)
            : cambioActual.periodo || "",
      };
  
      return {
        ...prev,
        cambios: cambiosActualizados,
      };
    });
  };
  const actualizarCambioRival = (index, campo, valor) => {
    setRegistro((prev) => {
      const cambiosActualizados = [
        ...(prev.cambiosRival || crearCambiosVacios()),
      ];
      const cambioActual = cambiosActualizados[index] || crearCambioVacio();
  
      cambiosActualizados[index] = {
        ...cambioActual,
        [campo]: valor,
        periodo:
          campo === "hora" && prev.modoTiempo === "transmision"
            ? cambioActual.periodo || obtenerPeriodoActivo(prev)
            : cambioActual.periodo || "",
      };
  
      return {
        ...prev,
        cambiosRival: cambiosActualizados,
      };
    });
  };'''
text = replace_once(text, old_actualizar_cambios, new_actualizar_cambios, "periodo automático cambios")

text = replace_once(
    text,
    '''            const horaSugerida = calcularHoraCambioDesdeMinuto(matchClock);
    
            nuevosCambios[index] = {''',
    '''            const sugerenciaTiempo = calcularHoraCambioDesdeMinuto(matchClock);
    
            nuevosCambios[index] = {''',
    "sugerencia rival objeto",
)
text = replace_once(
    text,
    '''              minuto: matchClock,
              hora: cambioActual.hora || horaSugerida,
            };''',
    '''              minuto: matchClock,
              hora: cambioActual.hora || sugerenciaTiempo.hora,
              periodo: cambioActual.periodo || sugerenciaTiempo.periodo,
            };''',
    "periodo recomendación rival",
)

old_config = '''  const configuracionPeriodos = {
    PT: {
      vars: "varsPT",
      activo: "varPTActivo",
      inicio: "inicioPT",
      referencia: "referenciaRealPT",
      baseSegundos: 0,
      etiqueta: "PT",
    },
    ST: {
      vars: "varsST",
      activo: "varSTActivo",
      inicio: "inicioST",
      referencia: "referenciaRealST",
      baseSegundos: 45 * 60,
      etiqueta: "ST",
    },
    PTE: {
      vars: "varsPTE",
      activo: "varPTEActivo",
      inicio: "inicioPTE",
      referencia: "referenciaRealPTE",
      baseSegundos: 90 * 60,
      etiqueta: "PTE",
    },
    STE: {
      vars: "varsSTE",
      activo: "varSTEActivo",
      inicio: "inicioSTE",
      referencia: "referenciaRealSTE",
      baseSegundos: 105 * 60,
      etiqueta: "STE",
    },
  };'''
new_config = '''  const configuracionPeriodos = {
    PT: {
      vars: "varsPT",
      activo: "varPTActivo",
      inicio: "inicioPT",
      final: "finalPT",
      referencia: "referenciaRealPT",
      horaInicioReal: "horaInicioRealPT",
      horaFinalReal: "horaFinalRealPT",
      baseSegundos: 0,
      etiqueta: "PT",
    },
    ST: {
      vars: "varsST",
      activo: "varSTActivo",
      inicio: "inicioST",
      final: "finalST",
      referencia: "referenciaRealST",
      horaInicioReal: "horaInicioRealST",
      horaFinalReal: "horaFinalRealST",
      // El segundo tiempo también usa una guía independiente desde 000:00.
      baseSegundos: 0,
      etiqueta: "ST",
    },
    PTE: {
      vars: "varsPTE",
      activo: "varPTEActivo",
      inicio: "inicioPTE",
      final: "finalPTE",
      referencia: "referenciaRealPTE",
      horaInicioReal: "horaInicioRealPTE",
      horaFinalReal: "horaFinalRealPTE",
      baseSegundos: 90 * 60,
      etiqueta: "PTE",
    },
    STE: {
      vars: "varsSTE",
      activo: "varSTEActivo",
      inicio: "inicioSTE",
      final: "finalSTE",
      referencia: "referenciaRealSTE",
      horaInicioReal: "horaInicioRealSTE",
      horaFinalReal: "horaFinalRealSTE",
      baseSegundos: 105 * 60,
      etiqueta: "STE",
    },
  };'''
text = replace_once(text, old_config, new_config, "configuración de períodos")

text = replace_once(
    text,
    '''  const horaActual = () => {
    const ahora = new Date();
    return ahora.toTimeString().slice(0, 8);
  };

  const esFormatoTransmision = (valor) =>''',
    '''  const horaActual = () => {
    const ahora = new Date();
    return ahora.toTimeString().slice(0, 8);
  };

  const horaDesdeTimestamp = (timestamp) => {
    const fecha = new Date(Number(timestamp));
    return Number.isNaN(fecha.getTime()) ? "" : fecha.toTimeString().slice(0, 8);
  };

  const sumarSegundosAHoraExacta = (horaBase, segundosASumar) => {
    if (!horaBase) return "";

    const [horas = 0, minutos = 0, segundos = 0] = String(horaBase)
      .split(":")
      .map(Number);
    const totalDia = 24 * 3600;
    const total =
      ((horas * 3600 + minutos * 60 + segundos + Number(segundosASumar || 0)) %
        totalDia +
        totalDia) %
      totalDia;

    const hh = String(Math.floor(total / 3600)).padStart(2, "0");
    const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  const obtenerHoraInicioRealPeriodo = (tipo, estado = registro) => {
    const config = obtenerConfigPeriodo(tipo);
    return (
      estado[config.horaInicioReal] ||
      horaDesdeTimestamp(estado[config.referencia]) ||
      ""
    );
  };

  const convertirGuiaAHoraReal = (tipo, guia, estado = registro) => {
    if (!guia) return "";
    const config = obtenerConfigPeriodo(tipo);
    const horaInicioReal = obtenerHoraInicioRealPeriodo(tipo, estado);
    if (!horaInicioReal || !esFormatoTransmision(guia)) return guia;

    const segundosGuia = segundosDesdeHora(guia);
    const segundosTranscurridos = Math.max(
      0,
      Number(segundosGuia || 0) - config.baseSegundos
    );
    return sumarSegundosAHoraExacta(horaInicioReal, segundosTranscurridos);
  };

  const esFormatoTransmision = (valor) =>''',
    "helpers de horas reales",
)

text = replace_once(
    text,
    '''      inputMode: "numeric",
      placeholder: "000:00",
      maxLength: 6,
      value: valor || "",''',
    '''      inputMode: "numeric",
      placeholder: "000:00",
      maxLength: 6,
      list: "lista-tiempos-transmision",
      autoComplete: "off",
      value: valor || "",''',
    "desplegable transmisión",
)

text = replace_once(
    text,
    '''  const detectarModoTiempoFila = (fila) => {
    const prorroga = fila.prorroga || {};''',
    '''  const detectarModoTiempoFila = (fila) => {
    if (fila.guia_transmision?.modo === "transmision") {
      return "transmision";
    }

    const prorroga = fila.prorroga || {};''',
    "detección guía persistida",
)

old_actualizar_campo = '''  const actualizarCampoTiempo = (campo, valor) => {
    setRegistro((prev) => {
      const siguiente = {
        ...prev,
        [campo]: valor,
      };

      const tipo = obtenerPeriodoCampo(campo);
      const config = obtenerConfigPeriodo(tipo);
      const esInicioPeriodo = campo === config.inicio;

      if (prev.modoTiempo === "transmision" && esInicioPeriodo) {
        const normalizado = normalizarEntradaTiempoTransmision(valor);

        if (normalizado) {
          const marcaSegundos = segundosDesdeHora(normalizado);
          const transcurridos = Math.max(
            0,
            marcaSegundos - config.baseSegundos
          );

          siguiente[config.referencia] = Date.now() - transcurridos * 1000;
        } else if (!String(valor || "").trim()) {
          siguiente[config.referencia] = null;
        }
      }

      return siguiente;
    });
  };

  const obtenerPeriodoActivo = () => {
    if (registro.referenciaRealSTE) return "STE";
    if (registro.referenciaRealPTE) return "PTE";
    if (registro.referenciaRealST) return "ST";
    return "PT";
  };'''
new_actualizar_campo = '''  const actualizarCampoTiempo = (campo, valor) => {
    setRegistro((prev) => {
      const siguiente = {
        ...prev,
        [campo]: valor,
      };

      const tipo = obtenerPeriodoCampo(campo);
      const config = obtenerConfigPeriodo(tipo);
      const esInicioPeriodo = campo === config.inicio;
      const esFinalPeriodo = campo === config.final;

      if (prev.modoTiempo === "transmision" && esInicioPeriodo) {
        const normalizado = normalizarEntradaTiempoTransmision(valor);

        if (normalizado) {
          const marcaSegundos = segundosDesdeHora(normalizado);
          const transcurridos = Math.max(
            0,
            marcaSegundos - config.baseSegundos
          );
          const referencia = Date.now() - transcurridos * 1000;

          siguiente[config.referencia] = referencia;
          siguiente[config.horaInicioReal] = horaDesdeTimestamp(referencia);
          siguiente[config.horaFinalReal] = "";
        } else if (!String(valor || "").trim()) {
          siguiente[config.referencia] = null;
          siguiente[config.horaInicioReal] = "";
          siguiente[config.horaFinalReal] = "";
        }
      }

      if (prev.modoTiempo === "transmision" && esFinalPeriodo) {
        const normalizado = normalizarEntradaTiempoTransmision(valor);
        siguiente[config.horaFinalReal] = normalizado
          ? convertirGuiaAHoraReal(tipo, normalizado, siguiente)
          : "";
      }

      return siguiente;
    });
  };

  const obtenerPeriodoActivo = (estado = registro) => {
    if (estado.referenciaRealSTE) return "STE";
    if (estado.referenciaRealPTE) return "PTE";
    if (estado.referenciaRealST) return "ST";
    return "PT";
  };'''
text = replace_once(text, old_actualizar_campo, new_actualizar_campo, "actualización campos transmisión")

old_poner_ahora = '''  const ponerAhora = (campo) => {
    quitarFoco();

    if (registro.modoTiempo === "transmision") {
      const tipo = obtenerPeriodoCampo(campo);
      const config = obtenerConfigPeriodo(tipo);
      const esInicioPeriodo = campo === config.inicio;

      if (esInicioPeriodo) {
        const valorInicial = formatearTiempoTransmision(config.baseSegundos);
        const referencia = Date.now();

        mantenerPosicion(() => {
          setRegistro((prev) => ({
            ...prev,
            [config.referencia]: referencia,
            [campo]: valorInicial,
          }));
        });
      } else {
        const valor = obtenerMarcaTransmision(tipo);

        if (!valor) {
          alert(`Primero marcá Inicio ${config.etiqueta}.`);
          return;
        }

        mantenerPosicion(() => actualizar(campo, valor));
      }
    } else {
      mantenerPosicion(() => actualizar(campo, horaActual()));
    }

    setTimeout(quitarFoco, 0);
  };'''
new_poner_ahora = '''  const ponerAhora = (campo) => {
    quitarFoco();

    if (registro.modoTiempo === "transmision") {
      const tipo = obtenerPeriodoCampo(campo);
      const config = obtenerConfigPeriodo(tipo);
      const esInicioPeriodo = campo === config.inicio;

      if (esInicioPeriodo) {
        const valorInicial = formatearTiempoTransmision(config.baseSegundos);
        const referencia = Date.now();
        const horaInicioReal = horaDesdeTimestamp(referencia);

        mantenerPosicion(() => {
          setRegistro((prev) => ({
            ...prev,
            [config.referencia]: referencia,
            [config.horaInicioReal]: horaInicioReal,
            [config.horaFinalReal]: "",
            [campo]: valorInicial,
          }));
        });
      } else {
        const valor = obtenerMarcaTransmision(tipo);

        if (!valor) {
          alert(`Primero marcá Inicio ${config.etiqueta}.`);
          return;
        }

        mantenerPosicion(() => {
          setRegistro((prev) => ({
            ...prev,
            [campo]: valor,
            ...(campo === config.final
              ? {
                  [config.horaFinalReal]: convertirGuiaAHoraReal(
                    tipo,
                    valor,
                    prev
                  ),
                }
              : {}),
          }));
        });
      }
    } else {
      mantenerPosicion(() => actualizar(campo, horaActual()));
    }

    setTimeout(quitarFoco, 0);
  };'''
text = replace_once(text, old_poner_ahora, new_poner_ahora, "botón Ahora con hora interna")

start_calc = text.index("  const calcularHoraCambioDesdeMinuto = (matchClock) => {")
end_calc = text.index("  const convertirNombreJugador = (nombre) => {", start_calc)
old_calc = text[start_calc:end_calc]
new_calc = '''  const calcularHoraCambioDesdeMinuto = (matchClock) => {
    if (!matchClock) return { hora: "", periodo: "" };
  
    const partes = String(matchClock).split(":").map(Number);
    const minuto = partes[0] || 0;
    const segundo = partes[1] || 0;
    const totalSegundos = minuto * 60 + segundo;

    if (registro.modoTiempo === "transmision") {
      let periodo = "PT";
      let segundosGuia = totalSegundos;

      if (totalSegundos >= 105 * 60) {
        periodo = "STE";
      } else if (totalSegundos >= 90 * 60) {
        periodo = "PTE";
      } else if (totalSegundos > 45 * 60) {
        periodo = "ST";
        segundosGuia = Math.max(0, totalSegundos - 45 * 60);
      }

      return {
        hora: formatearTiempoTransmision(segundosGuia),
        periodo,
      };
    }
  
    let horaBase = "";
    let minutosASumar = 0;
    let periodo = "PT";
  
    if (minuto <= 45) {
      horaBase = registro.inicioPT;
      minutosASumar = minuto;
    } else {
      horaBase = registro.inicioST;
      minutosASumar = minuto - 45;
      periodo = "ST";
    }
  
    if (!horaBase) return { hora: "", periodo };
  
    const partesHora = horaBase.split(":").map(Number);
    const h = partesHora[0] || 0;
    const m = partesHora[1] || 0;
    const s = partesHora[2] || 0;
  
    const fecha = new Date();
    fecha.setHours(h, m, s, 0);
    fecha.setMinutes(fecha.getMinutes() + minutosASumar);
    fecha.setSeconds(fecha.getSeconds() + segundo);
  
    return { hora: fecha.toTimeString().slice(0, 8), periodo };
  };
  
'''
text = text[:start_calc] + new_calc + text[end_calc:]

insert_after_serializar = '''  const serializarProrroga = (item) => ({
    activa: Boolean(item.prorrogaActiva),
    inicioPTE: item.inicioPTE || "",
    finalPTE: item.finalPTE || "",
    varsPTE: item.varsPTE || [{ inicio: "", final: "" }],
    inicioHidratacionPTE: item.inicioHidratacionPTE || "",
    finalHidratacionPTE: item.finalHidratacionPTE || "",
    inicioSTE: item.inicioSTE || "",
    finalSTE: item.finalSTE || "",
    varsSTE: item.varsSTE || [{ inicio: "", final: "" }],
    inicioHidratacionSTE: item.inicioHidratacionSTE || "",
    finalHidratacionSTE: item.finalHidratacionSTE || "",
    tiempoPTE: item.tiempoPTE || "",
    tiempoHidratacionPTE: item.tiempoHidratacionPTE || "",
    tiempoSTE: item.tiempoSTE || "",
    tiempoHidratacionSTE: item.tiempoHidratacionSTE || "",
  });'''
helpers_guardado = insert_after_serializar + '''

  const serializarGuiaTransmision = (item) => {
    if (item.modoTiempo !== "transmision") {
      return item.guiaTransmision || { modo: "enVivo" };
    }

    return {
      modo: "transmision",
      version: 2,
      horaInicioRealPT: obtenerHoraInicioRealPeriodo("PT", item),
      horaFinalRealPT: item.horaFinalRealPT || "",
      horaInicioRealST: obtenerHoraInicioRealPeriodo("ST", item),
      horaFinalRealST: item.horaFinalRealST || "",
      horaInicioRealPTE: obtenerHoraInicioRealPeriodo("PTE", item),
      horaFinalRealPTE: item.horaFinalRealPTE || "",
      horaInicioRealSTE: obtenerHoraInicioRealPeriodo("STE", item),
      horaFinalRealSTE: item.horaFinalRealSTE || "",
      inicioPT: item.inicioPT || "",
      finalPT: item.finalPT || "",
      varsPT: item.varsPT || [],
      inicioHidratacionPT: item.inicioHidratacionPT || "",
      finalHidratacionPT: item.finalHidratacionPT || "",
      inicioST: item.inicioST || "",
      finalST: item.finalST || "",
      varsST: item.varsST || [],
      inicioHidratacionST: item.inicioHidratacionST || "",
      finalHidratacionST: item.finalHidratacionST || "",
      cambios: item.cambios || [],
      cambiosRival: item.cambiosRival || [],
      prorroga: serializarProrroga(item),
    };
  };

  const obtenerPeriodoCambioParaGuardar = (cambio, item) => {
    if (cambio?.periodo) return cambio.periodo;
    if (!esFormatoTransmision(cambio?.hora)) return "";

    const segundos = segundosDesdeHora(cambio.hora) || 0;
    if (segundos >= 105 * 60) return "STE";
    if (segundos >= 90 * 60) return "PTE";
    if (segundos >= 45 * 60) return "ST";
    return "PT";
  };

  const convertirCambiosAHorasReales = (cambios, item) =>
    (cambios || []).map((cambio) => {
      const periodo = obtenerPeriodoCambioParaGuardar(cambio, item);
      return {
        ...cambio,
        periodo,
        hora:
          item.modoTiempo === "transmision" && periodo
            ? convertirGuiaAHoraReal(periodo, cambio.hora, item)
            : cambio.hora || "",
      };
    });

  const convertirRegistroAHorasReales = (item) => {
    if (item.modoTiempo !== "transmision") return item;

    const convertirVars = (tipo, vars) =>
      (vars || []).map((evento) => ({
        ...evento,
        inicio: convertirGuiaAHoraReal(tipo, evento.inicio, item),
        final: convertirGuiaAHoraReal(tipo, evento.final, item),
      }));

    return {
      ...item,
      inicioPT: obtenerHoraInicioRealPeriodo("PT", item),
      finalPT:
        item.horaFinalRealPT || convertirGuiaAHoraReal("PT", item.finalPT, item),
      varsPT: convertirVars("PT", item.varsPT),
      inicioHidratacionPT: convertirGuiaAHoraReal(
        "PT",
        item.inicioHidratacionPT,
        item
      ),
      finalHidratacionPT: convertirGuiaAHoraReal(
        "PT",
        item.finalHidratacionPT,
        item
      ),
      inicioST: obtenerHoraInicioRealPeriodo("ST", item),
      finalST:
        item.horaFinalRealST || convertirGuiaAHoraReal("ST", item.finalST, item),
      varsST: convertirVars("ST", item.varsST),
      inicioHidratacionST: convertirGuiaAHoraReal(
        "ST",
        item.inicioHidratacionST,
        item
      ),
      finalHidratacionST: convertirGuiaAHoraReal(
        "ST",
        item.finalHidratacionST,
        item
      ),
      inicioPTE: item.prorrogaActiva
        ? obtenerHoraInicioRealPeriodo("PTE", item)
        : item.inicioPTE,
      finalPTE: item.prorrogaActiva
        ? item.horaFinalRealPTE ||
          convertirGuiaAHoraReal("PTE", item.finalPTE, item)
        : item.finalPTE,
      varsPTE: item.prorrogaActiva
        ? convertirVars("PTE", item.varsPTE)
        : item.varsPTE,
      inicioHidratacionPTE: item.prorrogaActiva
        ? convertirGuiaAHoraReal("PTE", item.inicioHidratacionPTE, item)
        : item.inicioHidratacionPTE,
      finalHidratacionPTE: item.prorrogaActiva
        ? convertirGuiaAHoraReal("PTE", item.finalHidratacionPTE, item)
        : item.finalHidratacionPTE,
      inicioSTE: item.prorrogaActiva
        ? obtenerHoraInicioRealPeriodo("STE", item)
        : item.inicioSTE,
      finalSTE: item.prorrogaActiva
        ? item.horaFinalRealSTE ||
          convertirGuiaAHoraReal("STE", item.finalSTE, item)
        : item.finalSTE,
      varsSTE: item.prorrogaActiva
        ? convertirVars("STE", item.varsSTE)
        : item.varsSTE,
      inicioHidratacionSTE: item.prorrogaActiva
        ? convertirGuiaAHoraReal("STE", item.inicioHidratacionSTE, item)
        : item.inicioHidratacionSTE,
      finalHidratacionSTE: item.prorrogaActiva
        ? convertirGuiaAHoraReal("STE", item.finalHidratacionSTE, item)
        : item.finalHidratacionSTE,
      cambios: convertirCambiosAHorasReales(item.cambios, item),
      cambiosRival: convertirCambiosAHorasReales(item.cambiosRival, item),
    };
  };

  const validarHorasInicioTransmision = (item) => {
    if (item.modoTiempo !== "transmision") return "";

    const periodosNecesarios = new Set();
    const tieneDato = (valor) => String(valor || "").trim() !== "";
    const varsConDatos = (vars) =>
      (vars || []).some((evento) => tieneDato(evento.inicio) || tieneDato(evento.final));

    if (
      tieneDato(item.inicioPT) ||
      tieneDato(item.finalPT) ||
      varsConDatos(item.varsPT) ||
      tieneDato(item.inicioHidratacionPT) ||
      tieneDato(item.finalHidratacionPT)
    ) {
      periodosNecesarios.add("PT");
    }

    if (
      tieneDato(item.inicioST) ||
      tieneDato(item.finalST) ||
      varsConDatos(item.varsST) ||
      tieneDato(item.inicioHidratacionST) ||
      tieneDato(item.finalHidratacionST)
    ) {
      periodosNecesarios.add("ST");
    }

    if (item.prorrogaActiva) {
      if (tieneDato(item.inicioPTE) || tieneDato(item.finalPTE) || varsConDatos(item.varsPTE)) {
        periodosNecesarios.add("PTE");
      }
      if (tieneDato(item.inicioSTE) || tieneDato(item.finalSTE) || varsConDatos(item.varsSTE)) {
        periodosNecesarios.add("STE");
      }
    }

    [...(item.cambios || []), ...(item.cambiosRival || [])]
      .filter((cambio) => tieneDato(cambio.hora))
      .forEach((cambio) =>
        periodosNecesarios.add(obtenerPeriodoCambioParaGuardar(cambio, item))
      );

    const faltantes = [...periodosNecesarios].filter(
      (tipo) => tipo && !obtenerHoraInicioRealPeriodo(tipo, item)
    );

    return faltantes.length > 0
      ? `Falta marcar Inicio ${faltantes.join(", Inicio ")} con el botón Ahora.`
      : "";
  };'''
text = replace_once(text, insert_after_serializar, helpers_guardado, "helpers persistencia horas reales")

text = replace_once(
    text,
    '''      item.prorrogaActiva ||
        (item.cambios || []).length > 5 ||''',
    '''      item.modoTiempo === "transmision" ||
        item.prorrogaActiva ||
        (item.cambios || []).length > 5 ||''',
    "transmisión requiere migración",
)
text = replace_once(
    text,
    '''    /prorroga|cambios_extra|cambios_rival_extra/i.test(''',
    '''    /prorroga|cambios_extra|cambios_rival_extra|guia_transmision/i.test(''',
    "error columna guía",
)
text = replace_once(
    text,
    '''      prorroga,
      cambios_extra,
      cambios_rival_extra,
      ...payloadBase''',
    '''      prorroga,
      cambios_extra,
      cambios_rival_extra,
      guia_transmision,
      ...payloadBase''',
    "quitar guía en fallback",
)

# Ajusta guardarRegistro dentro de su bloque únicamente.
start_guardar = text.index("  const guardarRegistro = async () => {")
end_guardar = text.index("  const limpiarCarga = () => {", start_guardar)
guardar = text[start_guardar:end_guardar]
guardar = replace_once(
    guardar,
    '''    const cambiosRival = nuevoRegistro.cambiosRival || crearCambiosVacios();''',
    '''    const errorHorasInicio = validarHorasInicioTransmision(nuevoRegistro);
    if (errorHorasInicio) {
      alert(errorHorasInicio);
      return;
    }

    const registroConHorasReales = convertirRegistroAHorasReales(nuevoRegistro);
    const cambiosRival =
      registroConHorasReales.cambiosRival || crearCambiosVacios();''',
    "validación guardar transmisión",
)
guardar = guardar.replace("nuevoRegistro.", "registroConHorasReales.")
guardar = replace_once(
    guardar,
    '''      prorroga: serializarProrroga(registroConHorasReales),
      cambios_extra:''',
    '''      guia_transmision: serializarGuiaTransmision(nuevoRegistro),
      prorroga: serializarProrroga(registroConHorasReales),
      cambios_extra:''',
    "payload guía transmisión",
)
guardar = guardar.replace(
    '"Falta ejecutar la migración de prórroga en Supabase. Abrí el archivo SQL incluido en el repositorio y ejecutalo en SQL Editor."',
    '"Falta ejecutar la migración de transmisión y prórroga en Supabase. Abrí el archivo SQL incluido en el repositorio y ejecutalo en SQL Editor."',
)
text = text[:start_guardar] + guardar + text[end_guardar:]

# Ajusta convertirRegistroASupabase dentro de su bloque únicamente.
start_convertir = text.index("  const convertirRegistroASupabase = (registroEditado) => {")
end_convertir = text.index("  const borrarHistorial = async () => {", start_convertir)
convertir = text[start_convertir:end_convertir]
convertir = replace_once(
    convertir,
    '''    const cambiosRival = registroEditado.cambiosRival || crearCambiosVacios();''',
    '''    const registroParaGuardar = convertirRegistroAHorasReales(registroEditado);
    const cambiosRival =
      registroParaGuardar.cambiosRival || crearCambiosVacios();''',
    "registro edición a horas reales",
)
convertir = convertir.replace("registroEditado.", "registroParaGuardar.")
convertir = replace_once(
    convertir,
    '''      prorroga: serializarProrroga(registroParaGuardar),
      cambios_extra:''',
    '''      guia_transmision:
        registroEditado.guiaTransmision || serializarGuiaTransmision(registroEditado),
      prorroga: serializarProrroga(registroParaGuardar),
      cambios_extra:''',
    "preservar guía al editar",
)
text = text[:start_convertir] + convertir + text[end_convertir:]

# La pantalla activa conserva el texto de guía, pero aclara que reinicia por período.
text = text.replace(
    'esTransmision ? "Minutos de juego" : "Hora actual"',
    'esTransmision ? "Minutos por período" : "Hora actual"',
)

APP_PATH.write_text(text, encoding="utf-8")
VERSION_PATH.write_text(f'{{\n  "version": "{NEW_VERSION}"\n}}\n', encoding="utf-8")

migration = Path("supabase/migrations/20260806_guia_transmision_horas_reales.sql")
migration.parent.mkdir(parents=True, exist_ok=True)
migration.write_text(
    '''-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Conserva la guía visual de Transmisión mientras las columnas históricas guardan HH:MM:SS.

alter table public.registros_partido
  add column if not exists guia_transmision jsonb not null default '{}'::jsonb;

comment on column public.registros_partido.guia_transmision is
  'Minutos visuales, período de cada cambio y horas internas de inicio usadas para convertir a HH:MM:SS.';
''',
    encoding="utf-8",
)

print("Parche de horas reales aplicado correctamente")
