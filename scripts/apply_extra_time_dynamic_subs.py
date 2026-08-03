from pathlib import Path
import re

APP = Path("src/App.js")
STYLE = Path("src/style.css")
VERSION = Path("public/version.json")
MIGRATION = Path("supabase/migrations/20260803_prorroga_y_cambios_extra.sql")

app = APP.read_text(encoding="utf-8")
style = STYLE.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global app
    count = app.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")
    app = app.replace(old, new, 1)


def regex_once(pattern: str, replacement: str, label: str) -> None:
    global app
    app, count = re.subn(pattern, replacement, app, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: se esperaba 1 coincidencia y se encontraron {count}")


replace_once(
    'const APP_VERSION = "2026.08.03.6";',
    'const APP_VERSION = "2026.08.03.7";',
    "versión",
)

replace_once(
    '''  const crearCambiosVacios = () =>
  Array.from({ length: 5 }, () => ({
    sale: "",
    entra: "",
    hora: "",
    minuto: "",
    extraMinuto: "",
  }));''',
    '''  const crearCambioVacio = () => ({
    sale: "",
    entra: "",
    hora: "",
    minuto: "",
    extraMinuto: "",
  });

  const crearCambiosVacios = () =>
    Array.from({ length: 5 }, () => crearCambioVacio());

  const crearProrrogaVacia = () => ({
    prorrogaActiva: false,
    referenciaRealPTE: null,
    referenciaRealSTE: null,
    inicioPTE: "",
    finalPTE: "",
    varsPTE: [{ inicio: "", final: "" }],
    varPTEActivo: 0,
    inicioHidratacionPTE: "",
    finalHidratacionPTE: "",
    inicioSTE: "",
    finalSTE: "",
    varsSTE: [{ inicio: "", final: "" }],
    varSTEActivo: 0,
    inicioHidratacionSTE: "",
    finalHidratacionSTE: "",
  });''',
    "constructores",
)

replace_once(
    '''    referenciaRealPT: null,
    referenciaRealST: null,
  
    inicioPT: "",''',
    '''    referenciaRealPT: null,
    referenciaRealST: null,
    ...crearProrrogaVacia(),
  
    inicioPT: "",''',
    "registro vacío con prórroga",
)

replace_once(
    '''varsST:
  registroRecuperado.varsST && registroRecuperado.varsST.length > 0
    ? registroRecuperado.varsST
    : registroVacio.varsST,
varSTActivo: registroRecuperado.varSTActivo || 0,
        formacion:''',
    '''varsST:
  registroRecuperado.varsST && registroRecuperado.varsST.length > 0
    ? registroRecuperado.varsST
    : registroVacio.varsST,
varSTActivo: registroRecuperado.varSTActivo || 0,
varsPTE:
  registroRecuperado.varsPTE && registroRecuperado.varsPTE.length > 0
    ? registroRecuperado.varsPTE
    : registroVacio.varsPTE,
varPTEActivo: registroRecuperado.varPTEActivo || 0,
varsSTE:
  registroRecuperado.varsSTE && registroRecuperado.varsSTE.length > 0
    ? registroRecuperado.varsSTE
    : registroVacio.varsSTE,
varSTEActivo: registroRecuperado.varSTEActivo || 0,
        formacion:''',
    "recuperación local de prórroga",
)

replace_once(
    '''  const convertirSupabaseARegistro = (fila) => {
    const registroConvertido = {''',
    '''  const convertirSupabaseARegistro = (fila) => {
    const prorroga = fila.prorroga || {};
    const cambiosExtra = Array.isArray(fila.cambios_extra)
      ? fila.cambios_extra
      : [];
    const cambiosRivalExtra = Array.isArray(fila.cambios_rival_extra)
      ? fila.cambios_rival_extra
      : [];

    const registroConvertido = {''',
    "lectura JSONB",
)

replace_once(
    '''inicioST: fila.inicio_st || "",
finalST: fila.final_st || "",
tiempoST: fila.tiempo_st || "",
  
      inicioHidratacionPT:''',
    '''inicioST: fila.inicio_st || "",
finalST: fila.final_st || "",
tiempoST: fila.tiempo_st || "",

      prorrogaActiva: Boolean(prorroga.activa),
      referenciaRealPTE: null,
      referenciaRealSTE: null,
      inicioPTE: prorroga.inicioPTE || "",
      finalPTE: prorroga.finalPTE || "",
      varsPTE:
        Array.isArray(prorroga.varsPTE) && prorroga.varsPTE.length > 0
          ? prorroga.varsPTE
          : [{ inicio: "", final: "" }],
      varPTEActivo: 0,
      inicioHidratacionPTE: prorroga.inicioHidratacionPTE || "",
      finalHidratacionPTE: prorroga.finalHidratacionPTE || "",
      inicioSTE: prorroga.inicioSTE || "",
      finalSTE: prorroga.finalSTE || "",
      varsSTE:
        Array.isArray(prorroga.varsSTE) && prorroga.varsSTE.length > 0
          ? prorroga.varsSTE
          : [{ inicio: "", final: "" }],
      varSTEActivo: 0,
      inicioHidratacionSTE: prorroga.inicioHidratacionSTE || "",
      finalHidratacionSTE: prorroga.finalHidratacionSTE || "",
      tiempoPTE: prorroga.tiempoPTE || "",
      tiempoHidratacionPTE: prorroga.tiempoHidratacionPTE || "",
      tiempoSTE: prorroga.tiempoSTE || "",
      tiempoHidratacionSTE: prorroga.tiempoHidratacionSTE || "",
  
      inicioHidratacionPT:''',
    "campos de prórroga desde Supabase",
)

replace_once(
    '''        {
          sale: fila.cambio_5_sale || "",
          entra: fila.cambio_5_entra || "",
          hora: fila.cambio_5_tiempo || "",
        },
      ],''',
    '''        {
          sale: fila.cambio_5_sale || "",
          entra: fila.cambio_5_entra || "",
          hora: fila.cambio_5_tiempo || "",
        },
        ...cambiosExtra,
      ],''',
    "cambios extra Atlético",
)

replace_once(
    '''        {
          sale: fila.rival_cambio_sale5 || "",
          entra: fila.rival_cambio_entra5 || "",
          hora: fila.rival_cambio_horario5 || "",
        },
      ],''',
    '''        {
          sale: fila.rival_cambio_sale5 || "",
          entra: fila.rival_cambio_entra5 || "",
          hora: fila.rival_cambio_horario5 || "",
        },
        ...cambiosRivalExtra,
      ],''',
    "cambios extra Rival",
)

replace_once(
    '''      referenciaRealPT: null,
      referenciaRealST: null,
    }));''',
    '''      referenciaRealPT: null,
      referenciaRealST: null,
      referenciaRealPTE: null,
      referenciaRealSTE: null,
    }));''',
    "reinicio de referencias",
)

replace_once(
    '''  const actualizarCambioRival = (index, campo, valor) => {
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
  };
  
  const limpiarCambiosRival = () => {''',
    '''  const actualizarCambioRival = (index, campo, valor) => {
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
  };

  const agregarCambio = (tipo) => {
    const clave = tipo === "rival" ? "cambiosRival" : "cambios";

    setRegistro((prev) => ({
      ...prev,
      [clave]: [...(prev[clave] || crearCambiosVacios()), crearCambioVacio()],
    }));

    setTimeout(() => window.scrollBy({ top: 180, behavior: "smooth" }), 0);
  };

  const activarProrroga = () => {
    setRegistro((prev) => ({
      ...prev,
      prorrogaActiva: true,
    }));

    setTimeout(() => {
      document
        .getElementById("seccion-prorroga")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const quitarProrroga = () => {
    const confirmar = window.confirm(
      "¿Querés quitar la prórroga y borrar todos sus horarios?"
    );

    if (!confirmar) return;

    setRegistro((prev) => ({
      ...prev,
      ...crearProrrogaVacia(),
    }));
  };
  
  const limpiarCambiosRival = () => {''',
    "acciones dinámicas",
)

replace_once(
    '''          const cambiosActuales = prev.cambiosRival || crearCambiosVacios();
          const nuevosCambios = crearCambiosVacios();
    
          cambiosApi.slice(0, 5).forEach((cambioApi, index) => {''',
    '''          const cambiosActuales = prev.cambiosRival || crearCambiosVacios();
          const cantidadCambios = Math.max(
            5,
            cambiosActuales.length,
            cambiosApi.length
          );
          const nuevosCambios = Array.from(
            { length: cantidadCambios },
            (_, index) => ({
              ...crearCambioVacio(),
              ...(cambiosActuales[index] || {}),
            })
          );
    
          cambiosApi.forEach((cambioApi, index) => {''',
    "recomendaciones dinámicas",
)

regex_once(
    r'''  const agregarVar = \(tipo\) => \{.*?  const ponerAhoraVar = \(tipo, campo\) => \{''',
    '''  const configuracionPeriodos = {
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
  };

  const obtenerConfigPeriodo = (tipo) =>
    configuracionPeriodos[tipo] || configuracionPeriodos.PT;

  const agregarVar = (tipo) => {
    setRegistro((prev) => {
      const config = obtenerConfigPeriodo(tipo);
      const varsActuales = [...(prev[config.vars] || [{ inicio: "", final: "" }])];
  
      if (varsActuales.length >= 3) return prev;
  
      varsActuales.push({ inicio: "", final: "" });
  
      return {
        ...prev,
        [config.vars]: varsActuales,
        [config.activo]: varsActuales.length - 1,
      };
    });
  };
  
  const cambiarVarActivo = (tipo, index) => {
    const config = obtenerConfigPeriodo(tipo);
    setRegistro((prev) => ({
      ...prev,
      [config.activo]: index,
    }));
  };
  
  const actualizarVar = (tipo, campo, valor) => {
    setRegistro((prev) => {
      const config = obtenerConfigPeriodo(tipo);
      const varsActuales = [...(prev[config.vars] || [{ inicio: "", final: "" }])];
      const activo = prev[config.activo] || 0;
  
      varsActuales[activo] = {
        ...varsActuales[activo],
        [campo]: valor,
      };
  
      return {
        ...prev,
        [config.vars]: varsActuales,
      };
    });
  };
  
  const ponerAhoraVar = (tipo, campo) => {''',
    "VAR genérico",
)

regex_once(
    r'''  const detectarModoTiempoFila = \(fila\) => \{.*?  const obtenerPeriodoCampo = \(campo\) =>\n    String\(campo \|\| ""\)\.toUpperCase\(\)\.includes\("ST"\) \? "ST" : "PT";''',
    '''  const detectarModoTiempoFila = (fila) => {
    const prorroga = fila.prorroga || {};
    const cambiosExtra = Array.isArray(fila.cambios_extra)
      ? fila.cambios_extra
      : [];
    const cambiosRivalExtra = Array.isArray(fila.cambios_rival_extra)
      ? fila.cambios_rival_extra
      : [];

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
      prorroga.inicioPTE,
      prorroga.finalPTE,
      prorroga.inicioSTE,
      prorroga.finalSTE,
      ...(prorroga.varsPTE || []).flatMap((item) => [item.inicio, item.final]),
      ...(prorroga.varsSTE || []).flatMap((item) => [item.inicio, item.final]),
      ...cambiosExtra.map((item) => item.hora),
      ...cambiosRivalExtra.map((item) => item.hora),
    ];

    return valoresTiempo.some(esFormatoTransmision)
      ? "transmision"
      : "enVivo";
  };

  const obtenerPeriodoCampo = (campo) => {
    const texto = String(campo || "").toUpperCase();
    if (texto.includes("STE")) return "STE";
    if (texto.includes("PTE")) return "PTE";
    if (texto.includes("ST")) return "ST";
    return "PT";
  };''',
    "detección de períodos",
)

regex_once(
    r'''  const obtenerMarcaTransmision = \(tipo, estado = registro\) => \{.*?  const obtenerMarcaActual = \(tipo, estado = registro\) => \{''',
    '''  const obtenerMarcaTransmision = (tipo, estado = registro) => {
    const config = obtenerConfigPeriodo(tipo);
    const referencia = Number(estado[config.referencia]);

    if (!referencia) return "";

    const transcurridos = Math.max(
      0,
      Math.floor((Date.now() - referencia) / 1000)
    );

    return formatearTiempoTransmision(
      config.baseSegundos + transcurridos
    );
  };

  const obtenerMarcaActual = (tipo, estado = registro) => {''',
    "marca de transmisión genérica",
)

regex_once(
    r'''  const actualizarCampoTiempo = \(campo, valor\) => \{.*?  const obtenerPeriodoActivo = \(\) =>\n    registro\.referenciaRealST \? "ST" : "PT";''',
    '''  const actualizarCampoTiempo = (campo, valor) => {
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
  };''',
    "campo de tiempo genérico",
)

regex_once(
    r'''  const ponerAhora = \(campo\) => \{.*?  const ponerHoraCambio = \(index\) => \{''',
    '''  const ponerAhora = (campo) => {
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
  };

  const ponerHoraCambio = (index) => {''',
    "Ahora genérico",
)

replace_once(
    '''  const ponerHoraEntreTiempo = (index) => {
    quitarFoco();

    if (!registro.inicioST) {
      alert("Primero cargá Inicio ST.");
      return;
    }

    mantenerPosicion(() => {
      actualizarCambio(index, "hora", registro.inicioST);
    });

    setTimeout(quitarFoco, 0);
  };
  const ponerHoraEntreTiempoRival = (index) => {
    quitarFoco();
  
    if (!registro.inicioST) {
      alert("Primero cargá Inicio ST.");
      return;
    }
  
    mantenerPosicion(() => {
      actualizarCambioRival(index, "hora", registro.inicioST);
    });
  
    setTimeout(quitarFoco, 0);
  };''',
    '''  const obtenerMarcaEntreTiempos = () =>
    registro.inicioSTE || registro.inicioPTE || registro.inicioST || "";

  const ponerHoraEntreTiempo = (index) => {
    quitarFoco();
    const marcaEntreTiempos = obtenerMarcaEntreTiempos();

    if (!marcaEntreTiempos) {
      alert("Primero cargá el inicio del período siguiente.");
      return;
    }

    mantenerPosicion(() => {
      actualizarCambio(index, "hora", marcaEntreTiempos);
    });

    setTimeout(quitarFoco, 0);
  };
  const ponerHoraEntreTiempoRival = (index) => {
    quitarFoco();
    const marcaEntreTiempos = obtenerMarcaEntreTiempos();
  
    if (!marcaEntreTiempos) {
      alert("Primero cargá el inicio del período siguiente.");
      return;
    }
  
    mantenerPosicion(() => {
      actualizarCambioRival(index, "hora", marcaEntreTiempos);
    });
  
    setTimeout(quitarFoco, 0);
  };''',
    "entretiempos",
)

replace_once(
    '''    tiempoHidratacionST: formatearDuracion(
      segundosEntre(item.inicioHidratacionST, item.finalHidratacionST)
    ),
  });''',
    '''    tiempoHidratacionST: formatearDuracion(
      segundosEntre(item.inicioHidratacionST, item.finalHidratacionST)
    ),
    tiempoPTE: formatearDuracion(segundosEntre(item.inicioPTE, item.finalPTE)),
    tiempoHidratacionPTE: formatearDuracion(
      segundosEntre(item.inicioHidratacionPTE, item.finalHidratacionPTE)
    ),
    tiempoSTE: formatearDuracion(segundosEntre(item.inicioSTE, item.finalSTE)),
    tiempoHidratacionSTE: formatearDuracion(
      segundosEntre(item.inicioHidratacionSTE, item.finalHidratacionSTE)
    ),
  });''',
    "duraciones de prórroga",
)

replace_once(
    '''      tiempoHidratacionST: segundosEntre(
        registro.inicioHidratacionST,
        registro.finalHidratacionST
      ),
    };''',
    '''      tiempoHidratacionST: segundosEntre(
        registro.inicioHidratacionST,
        registro.finalHidratacionST
      ),
      tiempoPTE: segundosEntre(registro.inicioPTE, registro.finalPTE),
      tiempoHidratacionPTE: segundosEntre(
        registro.inicioHidratacionPTE,
        registro.finalHidratacionPTE
      ),
      tiempoSTE: segundosEntre(registro.inicioSTE, registro.finalSTE),
      tiempoHidratacionSTE: segundosEntre(
        registro.inicioHidratacionSTE,
        registro.finalHidratacionSTE
      ),
    };''',
    "resumen de prórroga",
)

replace_once(
    '''  const guardarRegistro = async () => {''',
    '''  const serializarProrroga = (item) => ({
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
  });

  const tieneDatosExtendidos = (item) =>
    Boolean(
      item.prorrogaActiva ||
        (item.cambios || []).length > 5 ||
        (item.cambiosRival || []).length > 5
    );

  const esErrorColumnasExtendidas = (error) =>
    /prorroga|cambios_extra|cambios_rival_extra/i.test(
      String(error?.message || error?.details || "")
    );

  const quitarCamposExtendidos = (payload) => {
    const {
      prorroga,
      cambios_extra,
      cambios_rival_extra,
      ...payloadBase
    } = payload;
    return payloadBase;
  };

  const guardarRegistro = async () => {''',
    "serialización extendida",
)

replace_once(
    '''      varsPT: registro.varsPT || [{ inicio: "", final: "" }],
      varsST: registro.varsST || [{ inicio: "", final: "" }],''',
    '''      varsPT: registro.varsPT || [{ inicio: "", final: "" }],
      varsST: registro.varsST || [{ inicio: "", final: "" }],
      varsPTE: registro.varsPTE || [{ inicio: "", final: "" }],
      varsSTE: registro.varsSTE || [{ inicio: "", final: "" }],''',
    "arrays de prórroga al guardar",
)

replace_once(
    '''rival_cambio_horario5: cambiosRival[4]?.hora || "",
      
      titulares: nuevoRegistro.formacion?.titulares || [],''',
    '''rival_cambio_horario5: cambiosRival[4]?.hora || "",

      prorroga: serializarProrroga(nuevoRegistro),
      cambios_extra: (nuevoRegistro.cambios || []).slice(5),
      cambios_rival_extra: cambiosRival.slice(5),
      
      titulares: nuevoRegistro.formacion?.titulares || [],''',
    "payload extendido de inserción",
)

replace_once(
    '''    const { error } = await supabase
      .from("registros_partido")
      .insert([registroSupabase]);
  
    if (error) {''',
    '''    let { error } = await supabase
      .from("registros_partido")
      .insert([registroSupabase]);

    if (
      error &&
      esErrorColumnasExtendidas(error) &&
      !tieneDatosExtendidos(nuevoRegistro)
    ) {
      const reintento = await supabase
        .from("registros_partido")
        .insert([quitarCamposExtendidos(registroSupabase)]);
      error = reintento.error;
    }
  
    if (error) {
      if (esErrorColumnasExtendidas(error)) {
        alert(
          "Falta ejecutar la migración de prórroga en Supabase. Abrí el archivo SQL incluido en el repositorio y ejecutalo en SQL Editor."
        );
        setMensajeGuardado("Falta actualizar la base de datos");
        return;
      }''',
    "inserción compatible",
)

replace_once(
    '''      rival_cambio_horario5: cambiosRival[4]?.hora || "",
  
      titulares: registroEditado.formacion?.titulares || [],''',
    '''      rival_cambio_horario5: cambiosRival[4]?.hora || "",

      prorroga: serializarProrroga(registroEditado),
      cambios_extra: (registroEditado.cambios || []).slice(5),
      cambios_rival_extra: cambiosRival.slice(5),
  
      titulares: registroEditado.formacion?.titulares || [],''',
    "payload extendido de edición",
)

replace_once(
    '''  const BloqueEvento = ({ titulo, inicioCampo, finalCampo, duracion }) => (
    <div className="bloque-evento">
      <div className="titulo-evento">
        <h3>{titulo}</h3>
        <span>{duracion || "-"}</span>
      </div>

      <CampoHora label="Inicio" campo={inicioCampo} />
      <CampoHora label="Final" campo={finalCampo} />
    </div>
  );''',
    '''  const BloqueEvento = ({ titulo, inicioCampo, finalCampo, duracion }) => (
    <div className="bloque-evento">
      <div className="titulo-evento">
        <h3>{titulo}</h3>
        <span>{duracion || "-"}</span>
      </div>

      <CampoHora label="Inicio" campo={inicioCampo} />
      <CampoHora label="Final" campo={finalCampo} />
    </div>
  );

  const BloqueVarPeriodo = ({ tipo, titulo }) => {
    const config = obtenerConfigPeriodo(tipo);
    const vars = registro[config.vars] || [{ inicio: "", final: "" }];
    const activo = registro[config.activo] || 0;

    return (
      <div className="bloque-evento bloque-var-prorroga">
        <div className="titulo-evento">
          <h3>{titulo}</h3>
          <span>
            {formatearDuracion(
              segundosEntre(vars[activo]?.inicio, vars[activo]?.final)
            ) || "-"}
          </span>
        </div>

        <div className="vars-header">
          {vars.map((item, index) => (
            <button
              key={`${tipo}-var-${index}`}
              type="button"
              className={`var-chip ${activo === index ? "activo" : ""}`}
              onClick={() => cambiarVarActivo(tipo, index)}
            >
              {formatearDuracion(segundosEntre(item.inicio, item.final)) ||
                `VAR ${index + 1}`}
            </button>
          ))}
        </div>

        <div className="campo-hora">
          <label>Inicio</label>
          <div className="fila-hora">
            <input
              {...obtenerPropsInputTiempo(
                vars[activo]?.inicio || "",
                (valor) => actualizarVar(tipo, "inicio", valor),
                registro.modoTiempo
              )}
            />
            <button
              type="button"
              className="boton-ahora"
              onClick={() => ponerAhoraVar(tipo, "inicio")}
            >
              Ahora
            </button>
          </div>
        </div>

        <div className="campo-hora">
          <label>Final</label>
          <div className="fila-hora">
            <input
              {...obtenerPropsInputTiempo(
                vars[activo]?.final || "",
                (valor) => actualizarVar(tipo, "final", valor),
                registro.modoTiempo
              )}
            />
            <button
              type="button"
              className="boton-ahora"
              onClick={() => ponerAhoraVar(tipo, "final")}
            >
              Ahora
            </button>
          </div>
        </div>

        {vars.length < 3 && (
          <button
            type="button"
            className="boton-agregar-var"
            onClick={() => agregarVar(tipo)}
          >
            Agregar +
          </button>
        )}
      </div>
    );
  };''',
    "componente VAR de prórroga",
)

replace_once(
    '''          <IndicadorModoTiempo variante="rival" />
  
          <section className="tarjeta">''',
    '''          <IndicadorModoTiempo variante="rival" />
  
          <section className="tarjeta">''',
    "ancla Rival",
)

replace_once(
    '''            </div>
  
            <div className="contenedor-limpiar-rival">''',
    '''            </div>

            <button
              type="button"
              className="boton-agregar-cambio boton-agregar-cambio-rival"
              onClick={() => agregarCambio("rival")}
            >
              + Agregar cambio
            </button>
  
            <div className="contenedor-limpiar-rival">''',
    "botón agregar cambio Rival",
)

replace_once(
    '''          <BloqueEvento
            titulo="Hidratación ST"
            inicioCampo="inicioHidratacionST"
            finalCampo="finalHidratacionST"
            duracion={formatearDuracion(resumen.tiempoHidratacionST)}
          />
        </section>

        <section className="tarjeta">
  <h2>Cambios</h2>''',
    '''          <BloqueEvento
            titulo="Hidratación ST"
            inicioCampo="inicioHidratacionST"
            finalCampo="finalHidratacionST"
            duracion={formatearDuracion(resumen.tiempoHidratacionST)}
          />
        </section>

        {registro.prorrogaActiva && (
          <section
            className="tarjeta tarjeta-prorroga"
            id="seccion-prorroga"
          >
            <div className="cabecera-prorroga">
              <div>
                <span className="etiqueta-prorroga">TIEMPO EXTRA</span>
                <h2>Prórroga</h2>
                <p>
                  Primer tiempo desde 090:00 · Segundo tiempo desde 105:00
                </p>
              </div>

              <button
                type="button"
                className="boton-quitar-prorroga"
                onClick={quitarProrroga}
              >
                Quitar
              </button>
            </div>

            <div className="grid-prorroga">
              <div className="periodo-prorroga">
                <div className="titulo-periodo-prorroga">
                  <span>1</span>
                  <div>
                    <strong>Primer tiempo de prórroga</strong>
                    <small>Inicio de transmisión: 090:00</small>
                  </div>
                </div>

                <BloqueEvento
                  titulo="PTE"
                  inicioCampo="inicioPTE"
                  finalCampo="finalPTE"
                  duracion={formatearDuracion(resumen.tiempoPTE)}
                />
                <BloqueVarPeriodo tipo="PTE" titulo="VAR PTE" />
                <BloqueEvento
                  titulo="Hidratación PTE"
                  inicioCampo="inicioHidratacionPTE"
                  finalCampo="finalHidratacionPTE"
                  duracion={formatearDuracion(
                    resumen.tiempoHidratacionPTE
                  )}
                />
              </div>

              <div className="periodo-prorroga">
                <div className="titulo-periodo-prorroga">
                  <span>2</span>
                  <div>
                    <strong>Segundo tiempo de prórroga</strong>
                    <small>Inicio de transmisión: 105:00</small>
                  </div>
                </div>

                <BloqueEvento
                  titulo="STE"
                  inicioCampo="inicioSTE"
                  finalCampo="finalSTE"
                  duracion={formatearDuracion(resumen.tiempoSTE)}
                />
                <BloqueVarPeriodo tipo="STE" titulo="VAR STE" />
                <BloqueEvento
                  titulo="Hidratación STE"
                  inicioCampo="inicioHidratacionSTE"
                  finalCampo="finalHidratacionSTE"
                  duracion={formatearDuracion(
                    resumen.tiempoHidratacionSTE
                  )}
                />
              </div>
            </div>
          </section>
        )}

        <section className="tarjeta">
  <h2>Cambios</h2>''',
    "sección de prórroga",
)

replace_once(
    '''            ))}
          </div>
        </section>

        <section className="tarjeta">
          <div className="historial-titulo">''',
    '''            ))}
          </div>

          <button
            type="button"
            className="boton-agregar-cambio"
            onClick={() => agregarCambio("atletico")}
          >
            + Agregar cambio
          </button>
        </section>

        <section className="tarjeta">
          <div className="historial-titulo">''',
    "botón agregar cambio Atlético",
)

replace_once(
    '''        <section className="tarjeta">
  <button
    type="button"
    className="boton-ir-registros"''',
    '''        <section className="tarjeta tarjeta-accion-prorroga">
          <button
            type="button"
            className={`boton-cargar-prorroga ${
              registro.prorrogaActiva ? "activa" : ""
            }`}
            onClick={activarProrroga}
          >
            <strong>
              {registro.prorrogaActiva ? "Ver Prórroga" : "Cargar Prórroga"}
            </strong>
            <span>
              {registro.prorrogaActiva
                ? "La sección ya está disponible dentro del partido"
                : "Agrega dos tiempos de 15 minutos, VAR e hidratación"}
            </span>
          </button>
        </section>

        <section className="tarjeta">
  <button
    type="button"
    className="boton-ir-registros"''',
    "botón cargar prórroga",
)

replace_once(
    '''          <section className="tarjeta">
            <h2>Cambios</h2>''',
    '''          {editado.prorrogaActiva && (
            <section className="tarjeta tarjeta-prorroga detalle-prorroga">
              <div className="cabecera-prorroga">
                <div>
                  <span className="etiqueta-prorroga">TIEMPO EXTRA</span>
                  <h2>Prórroga</h2>
                </div>
              </div>

              <div className="grid-prorroga">
                <div className="periodo-prorroga">
                  <h3>Primer tiempo de prórroga</h3>
                  <DatoDetalle label="Inicio PTE" valor={editado.inicioPTE} />
                  <DatoDetalle label="Final PTE" valor={editado.finalPTE} />
                  <DatoDetalle
                    label="Tiempo PTE"
                    valor={tiemposEditados.tiempoPTE}
                  />
                  {(editado.varsPTE || [])
                    .filter((item) => item.inicio || item.final)
                    .map((item, varIndex) => (
                      <div className="var-detalle" key={`detalle-pte-${varIndex}`}>
                        <div className="var-detalle-header">
                          <span>VAR PTE {varIndex + 1}</span>
                          <span className="var-detalle-tempo">
                            {formatearDuracion(
                              segundosEntre(item.inicio, item.final)
                            )}
                          </span>
                        </div>
                        <div className="var-detalle-info">
                          <span>Inicio: {item.inicio || "--:--"}</span>
                          <span>Final: {item.final || "--:--"}</span>
                        </div>
                      </div>
                    ))}
                  <DatoDetalle
                    label="Inicio Hidratación PTE"
                    valor={editado.inicioHidratacionPTE}
                  />
                  <DatoDetalle
                    label="Final Hidratación PTE"
                    valor={editado.finalHidratacionPTE}
                  />
                </div>

                <div className="periodo-prorroga">
                  <h3>Segundo tiempo de prórroga</h3>
                  <DatoDetalle label="Inicio STE" valor={editado.inicioSTE} />
                  <DatoDetalle label="Final STE" valor={editado.finalSTE} />
                  <DatoDetalle
                    label="Tiempo STE"
                    valor={tiemposEditados.tiempoSTE}
                  />
                  {(editado.varsSTE || [])
                    .filter((item) => item.inicio || item.final)
                    .map((item, varIndex) => (
                      <div className="var-detalle" key={`detalle-ste-${varIndex}`}>
                        <div className="var-detalle-header">
                          <span>VAR STE {varIndex + 1}</span>
                          <span className="var-detalle-tempo">
                            {formatearDuracion(
                              segundosEntre(item.inicio, item.final)
                            )}
                          </span>
                        </div>
                        <div className="var-detalle-info">
                          <span>Inicio: {item.inicio || "--:--"}</span>
                          <span>Final: {item.final || "--:--"}</span>
                        </div>
                      </div>
                    ))}
                  <DatoDetalle
                    label="Inicio Hidratación STE"
                    valor={editado.inicioHidratacionSTE}
                  />
                  <DatoDetalle
                    label="Final Hidratación STE"
                    valor={editado.finalHidratacionSTE}
                  />
                </div>
              </div>
            </section>
          )}

          <section className="tarjeta">
            <h2>Cambios</h2>''',
    "detalle de prórroga",
)

# Estilos de la ampliación.
style += '''

/* Prórroga y cambios dinámicos */
.boton-agregar-cambio {
  width: 100%;
  min-height: 46px;
  margin-top: 14px;
  border: 1px dashed rgba(22, 163, 74, 0.65);
  background: rgba(240, 253, 244, 0.96);
  color: #166534;
  font-size: 14px;
}

.boton-agregar-cambio-rival {
  border-color: rgba(245, 158, 11, 0.78);
  background: rgba(255, 247, 237, 0.98);
  color: #9a3412;
}

.tarjeta-prorroga {
  border: 1px solid rgba(245, 158, 11, 0.6);
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.98),
    rgba(255, 247, 237, 0.98)
  );
  scroll-margin-top: 14px;
}

.cabecera-prorroga {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.cabecera-prorroga h2 {
  margin: 4px 0 3px;
  color: #431407;
}

.cabecera-prorroga p {
  margin: 0;
  color: #9a3412;
  font-size: 12px;
  font-weight: 700;
}

.etiqueta-prorroga {
  display: inline-flex;
  padding: 5px 9px;
  border-radius: 999px;
  background: linear-gradient(135deg, #111827, #d97706);
  color: #ffffff;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.boton-quitar-prorroga {
  flex: 0 0 auto;
  min-height: 38px;
  padding: 0 13px;
  background: rgba(127, 29, 29, 0.09);
  color: #991b1b;
  border: 1px solid rgba(185, 28, 28, 0.24);
}

.grid-prorroga {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.periodo-prorroga {
  min-width: 0;
  padding: 14px;
  border-radius: 22px;
  border: 1px solid rgba(251, 146, 60, 0.34);
  background: rgba(255, 255, 255, 0.82);
}

.titulo-periodo-prorroga {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 13px;
}

.titulo-periodo-prorroga > span {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 12px;
  background: linear-gradient(135deg, #111827, #d97706);
  color: #ffffff;
  font-weight: 900;
}

.titulo-periodo-prorroga div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.titulo-periodo-prorroga strong {
  color: #431407;
  font-size: 14px;
}

.titulo-periodo-prorroga small {
  color: #9a3412;
  font-size: 10px;
  font-weight: 700;
}

.periodo-prorroga .bloque-evento {
  background: rgba(255, 251, 235, 0.72);
  border-color: rgba(251, 146, 60, 0.28);
}

.periodo-prorroga .titulo-evento span,
.periodo-prorroga .var-chip.activo {
  background: linear-gradient(135deg, #111827, #d97706);
}

.tarjeta-accion-prorroga {
  padding: 12px;
  background: rgba(255, 255, 255, 0.9);
}

.boton-cargar-prorroga {
  width: 100%;
  min-height: 70px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  background: linear-gradient(135deg, #111827, #d97706);
  color: #ffffff;
  text-align: left;
  box-shadow: 0 10px 24px rgba(217, 119, 6, 0.26);
}

.boton-cargar-prorroga.activa {
  background: linear-gradient(135deg, #431407, #f59e0b);
}

.boton-cargar-prorroga strong {
  font-size: 15px;
}

.boton-cargar-prorroga span {
  font-size: 11px;
  opacity: 0.86;
  line-height: 1.35;
}

.detalle-prorroga .periodo-prorroga h3 {
  margin: 0 0 12px;
  color: #431407;
}

@media (max-width: 760px) {
  .grid-prorroga {
    grid-template-columns: 1fr;
  }

  .periodo-prorroga {
    padding: 12px;
  }

  .cabecera-prorroga {
    align-items: center;
  }
}
'''

VERSION.write_text('{\n  "version": "2026.08.03.7"\n}\n', encoding="utf-8")
MIGRATION.parent.mkdir(parents=True, exist_ok=True)
MIGRATION.write_text(
    '''-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Agrega almacenamiento flexible para prórroga y cambios posteriores al quinto.

alter table public.registros_partido
  add column if not exists prorroga jsonb not null default '{}'::jsonb,
  add column if not exists cambios_extra jsonb not null default '[]'::jsonb,
  add column if not exists cambios_rival_extra jsonb not null default '[]'::jsonb;

comment on column public.registros_partido.prorroga is
  'Datos de los dos tiempos de prórroga, VAR e hidrataciones.';
comment on column public.registros_partido.cambios_extra is
  'Cambios de Atlético Mineiro posteriores al quinto.';
comment on column public.registros_partido.cambios_rival_extra is
  'Cambios del rival posteriores al quinto.';
''',
    encoding="utf-8",
)

APP.write_text(app, encoding="utf-8")
STYLE.write_text(style, encoding="utf-8")
print("Prórroga y cambios dinámicos aplicados")
