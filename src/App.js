import { supabase } from "./supabase.js";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import jugadores from "./jugadores";
import "./style.css";
const imagenIntro =
  "https://i.postimg.cc/dt4zFZ2K/ey-Jp-ZCI6Im1f-Nm-Ew-Nzc0ODg3MThj-ODE5MWFi-ODU1Njcz-Mm-I1Y2M3Nj-Y6c2Vka-W1lbn-Q6Ly80Mz-E1Zj-Bh-ZDYw.jpg";

const ListaJugadores = () => (
  <datalist id="lista-jugadores">
    {jugadores
      .filter((jugador) => jugador !== "")
      .map((jugador, index) => (
        <option key={index} value={jugador} />
      ))}
  </datalist>
);

const InputJugador = ({ value, onChange }) => (
  <input
    className="input-jugador"
    list="lista-jugadores"
    value={value || ""}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Escribir o elegir"
  />
);

export default function App() {
  const crearCambiosVacios = () =>
  Array.from({ length: 5 }, () => ({
    sale: "",
    entra: "",
    hora: "",
    minuto: "",
    extraMinuto: "",
  }));

  const crearFormacionVacia = () => ({
    titulares: Array.from({ length: 10 }, () => ""),
    convocados: Array.from({ length: 12 }, () => ""),
  });

  const crearRegistroVacio = () => ({
    fecha: new Date().toISOString().split("T")[0],
    rival: "",
    resultado: "",
  
    // Modo de registro de los horarios
    modoTiempo: "enVivo",
  
    // Se usarán para calcular los minutos de transmisión.
    // Guardarán Date.now(), no una hora escrita.
    referenciaRealPT: null,
    referenciaRealST: null,
  
    inicioPT: "",
    finalPT: "",
    inicioVarPT: "",
    finalVarPT: "",
    varsPT: [{ inicio: "", final: "" }],
varPTActivo: 0,
    inicioHidratacionPT: "",
    finalHidratacionPT: "",
    inicioST: "",
    finalST: "",
    inicioVarST: "",
    finalVarST: "",
    varsST: [{ inicio: "", final: "" }],
varSTActivo: 0,
    inicioHidratacionST: "",
    finalHidratacionST: "",
    cambios: crearCambiosVacios(),
    cambiosRival: crearCambiosVacios(),
    jugadoresRival: [],
    formacion: crearFormacionVacia(),
  });

  const obtenerRegistroInicial = () => {
    const registroVacio = crearRegistroVacio();

    try {
      const datosGuardados = localStorage.getItem("registro_actual_partido");

      if (!datosGuardados) return registroVacio;

      const registroRecuperado = JSON.parse(datosGuardados);

      return {
        ...registroVacio,
        ...registroRecuperado,
        cambios:
          registroRecuperado.cambios && registroRecuperado.cambios.length > 0
            ? registroRecuperado.cambios
            : registroVacio.cambios,
            cambiosRival:
  registroRecuperado.cambiosRival &&
  registroRecuperado.cambiosRival.length > 0
    ? registroRecuperado.cambiosRival
    : registroVacio.cambiosRival,
    jugadoresRival:
  registroRecuperado.jugadoresRival &&
  registroRecuperado.jugadoresRival.length > 0
    ? registroRecuperado.jugadoresRival
    : registroVacio.jugadoresRival,
            varsPT:
  registroRecuperado.varsPT && registroRecuperado.varsPT.length > 0
    ? registroRecuperado.varsPT
    : registroVacio.varsPT,
varPTActivo: registroRecuperado.varPTActivo || 0,
varsST:
  registroRecuperado.varsST && registroRecuperado.varsST.length > 0
    ? registroRecuperado.varsST
    : registroVacio.varsST,
varSTActivo: registroRecuperado.varSTActivo || 0,
        formacion: {
          titulares:
            registroRecuperado.formacion?.titulares?.length > 0
              ? registroRecuperado.formacion.titulares
              : registroVacio.formacion.titulares,
          convocados:
            registroRecuperado.formacion?.convocados?.length > 0
              ? registroRecuperado.formacion.convocados
              : registroVacio.formacion.convocados,
        },
      };
    } catch (error) {
      return registroVacio;
    }
  };

  const [registro, setRegistro] = useState(obtenerRegistroInicial);
  const [guardados, setGuardados] = useState([]);
  const [mostrarApp, setMostrarApp] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState(null);
  const [pantalla, setPantalla] = useState("principal");
  const [busquedaRegistros, setBusquedaRegistros] = useState("");
  const [ordenRegistros, setOrdenRegistros] = useState("reciente");
  const [mostrarFormacionPartido, setMostrarFormacionPartido] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState("");
  const formacionInicial = registro.formacion || crearFormacionVacia();
  const hayFormacionInicial =
    (formacionInicial.titulares || []).some((j) => String(j || "").trim()) ||
    (formacionInicial.convocados || []).some((j) => String(j || "").trim());

  const [pantallaFormacion, setPantallaFormacion] = useState(
    hayFormacionInicial ? "lista" : "inicio"
  );

  const [fechaFormacion, setFechaFormacion] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formacionTemporal, setFormacionTemporal] = useState(
    registro.formacion || crearFormacionVacia()
  );

  const [mensajeFormacion, setMensajeFormacion] = useState("");
  const ListaJugadoresRival = () => (
    <datalist id="lista-jugadores-rival">
  {[
    ...(registro.jugadoresRival || []),
    ...(registro.titularesRival || []),
    ...(registro.convocadosRival || []),
    ...(registro.cambiosRival || []).map((cambio) => cambio.sale),
    ...(registro.cambiosRival || []).map((cambio) => cambio.entra),
  ]
    .filter((jugador) => jugador && String(jugador).trim() !== "")
    .filter((jugador, index, array) => array.indexOf(jugador) === index)
    .map((jugador, index) => (
      <option key={`jugador-rival-${index}`} value={jugador} />
    ))}
</datalist>
  );
  
  const InputJugadorRival = ({ value, onChange }) => {
    return (
      <input
        className="input-jugador"
        list="lista-jugadores-rival"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={manejarEnter}
        placeholder="Escribir o elegir"
      />
    );
  };
  const posicionScrollPendiente = useRef(null);
  const convertirSupabaseARegistro = (fila) => {
    const registroConvertido = {
      fecha: fila.fecha || "",
      rival: fila.rival || "",
      resultado: fila.resultado || "",
      modoTiempo: detectarModoTiempoFila(fila),
  
      inicioPT: fila.inicio_pt || "",
finalPT: fila.final_pt || "",
tiempoPT: fila.tiempo_pt || "",

inicioST: fila.inicio_st || "",
finalST: fila.final_st || "",
tiempoST: fila.tiempo_st || "",
  
      inicioHidratacionPT: fila.inicio_hid_pt || "",
      finalHidratacionPT: fila.final_hid_pt || "",
      inicioHidratacionST: fila.inicio_hid_st || "",
      finalHidratacionST: fila.final_hid_st || "",
  
      varsPT: [
        {
          inicio: fila.inicio_var_pt_1 || "",
          final: fila.final_var_pt_1 || "",
        },
        {
          inicio: fila.inicio_var_pt_2 || "",
          final: fila.final_var_pt_2 || "",
        },
        {
          inicio: fila.inicio_var_pt_3 || "",
          final: fila.final_var_pt_3 || "",
        },
      ].filter((v) => v.inicio || v.final),
  
      varsST: [
        {
          inicio: fila.inicio_var_st_1 || "",
          final: fila.final_var_st_1 || "",
        },
        {
          inicio: fila.inicio_var_st_2 || "",
          final: fila.final_var_st_2 || "",
        },
        {
          inicio: fila.inicio_var_st_3 || "",
          final: fila.final_var_st_3 || "",
        },
      ].filter((v) => v.inicio || v.final),
  
      varPTActivo: 0,
      varSTActivo: 0,
  
      cambios: [
        {
          sale: fila.cambio_1_sale || "",
          entra: fila.cambio_1_entra || "",
          hora: fila.cambio_1_tiempo || "",
        },
        {
          sale: fila.cambio_2_sale || "",
          entra: fila.cambio_2_entra || "",
          hora: fila.cambio_2_tiempo || "",
        },
        {
          sale: fila.cambio_3_sale || "",
          entra: fila.cambio_3_entra || "",
          hora: fila.cambio_3_tiempo || "",
        },
        {
          sale: fila.cambio_4_sale || "",
          entra: fila.cambio_4_entra || "",
          hora: fila.cambio_4_tiempo || "",
        },
        {
          sale: fila.cambio_5_sale || "",
          entra: fila.cambio_5_entra || "",
          hora: fila.cambio_5_tiempo || "",
        },
      ],
  
      cambiosRival: [
        {
          sale: fila.rival_cambio_sale1 || "",
          entra: fila.rival_cambio_entra1 || "",
          hora: fila.rival_cambio_horario1 || "",
        },
        {
          sale: fila.rival_cambio_sale2 || "",
          entra: fila.rival_cambio_entra2 || "",
          hora: fila.rival_cambio_horario2 || "",
        },
        {
          sale: fila.rival_cambio_sale3 || "",
          entra: fila.rival_cambio_entra3 || "",
          hora: fila.rival_cambio_horario3 || "",
        },
        {
          sale: fila.rival_cambio_sale4 || "",
          entra: fila.rival_cambio_entra4 || "",
          hora: fila.rival_cambio_horario4 || "",
        },
        {
          sale: fila.rival_cambio_sale5 || "",
          entra: fila.rival_cambio_entra5 || "",
          hora: fila.rival_cambio_horario5 || "",
        },
      ],
  
      formacion: {
        titulares: fila.titulares || [],
        convocados: fila.convocados || [],
      },
  
      idSupabase: fila.id,
      guardadoEn: fila.created_at || fila.fecha || "",
    };
  
    return {
      ...registroConvertido,
      ...calcularTiemposRegistro(registroConvertido),
      noIngresaron: calcularNoIngresaron(
        registroConvertido.formacion,
        registroConvertido.cambios
      ),
    };
  };
  
  const cargarRegistrosSupabase = async () => {
    const { data, error } = await supabase
      .from("registros_partido")
      .select("*")
      .order("fecha", { ascending: false });
  
    if (error) {
      console.error("Error cargando registros desde Supabase:", error);
      alert("No se pudieron cargar los registros desde Supabase");
      return;
    }
  
    const registrosConvertidos = (data || []).map(convertirSupabaseARegistro);
    setGuardados(registrosConvertidos);
  };
  useEffect(() => {
    cargarRegistrosSupabase();
  
    const timerIntro = setTimeout(() => {
      setMostrarApp(true);
    }, 1800);
  
    return () => clearTimeout(timerIntro);
  }, []);

  useEffect(() => {
    localStorage.setItem("backup_registros_partidos", JSON.stringify(guardados));
  }, [guardados]);

  useEffect(() => {
    localStorage.setItem("registro_actual_partido", JSON.stringify(registro));
  }, [registro]);

  useLayoutEffect(() => {
    if (posicionScrollPendiente.current !== null) {
      window.scrollTo(0, posicionScrollPendiente.current);
      posicionScrollPendiente.current = null;
    }
  });
  const normalizarTextoBase = (valor) =>
  String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  const equivalenciasJugadores = {
    "alan minda": "A MINDA",
    "angelo preciado": "A PRECIADO",
    "alan franco": "ALAN FRANCO",
    "alexsander": "ALEXSANDER",
    "junior alonso": "ALONSO",
    "bernard": "BERNARD",
    "caua soares": "CAUA SOARES",
    "mamady cisse": "CISSE",
    "tomas cuello": "CUELLO",
    "dudu": "DUDU",
    "ivan roman": "I ROMAN",
    "igor gomes": "IGOR GOMES",
    "indio": "INDIO",
    "mateus iseppe": "M ISEPPE",
    "kaua pascini": "KAUA PASCINI",
    "lyanco": "LYANCO",
    "mateo cassierra": "M CASSIERRA",
    "maycon": "MAYCON",
    "natanael": "NATANAEL",
    "patrick": "PATRICK",
    "reinier": "REINIER",
    "renan lodi": "RENAN LODI",
    "ruan": "RUAN",
    "gustavo scarpa": "SCARPA",
    "scarpa": "SCARPA",
    "tomas perez": "T PEREZ",
    "vitor hugo": "V HUGO",
    "victor": "VICTOR",
    "victor hugo": "VICTOR",
    "vitao": "VITAO",
    "luis gustavo": "LUIS GUSTAVO",
    "veneno": "VENENO"
  };
  const normalizarTexto = (valor) => {
    const limpio = normalizarTextoBase(valor);
    return equivalenciasJugadores[limpio] || limpio;
  };
  const limpiarLista = (lista) =>
    (lista || []).map((j) => String(j || "").trim()).filter(Boolean);

  const jugadoresQueEntraron = (cambios) =>
    limpiarLista((cambios || []).map((cambio) => cambio.entra));

  const calcularNoIngresaron = (formacion, cambios) => {
    const convocados = limpiarLista(formacion?.convocados || []);
    const entraron = jugadoresQueEntraron(cambios).map(normalizarTexto);

    return convocados.filter(
      (jugador) => !entraron.includes(normalizarTexto(jugador))
    );
  };

  const noIngresaronActuales = useMemo(
    () => calcularNoIngresaron(registro.formacion, registro.cambios),
    [registro.formacion, registro.cambios]
  );

  const textoRegistroParaBusqueda = (item) => {
    const cambios = item.cambios || [];
    const titulares = item.formacion?.titulares || [];
    const convocados = item.formacion?.convocados || [];
    const noIngresaron = calcularNoIngresaron(item.formacion, item.cambios);

    return [
      item.fecha,
      item.rival,
      item.resultado,
      item.inicioPT,
      item.finalPT,
      item.tiempoPT,
      item.inicioVarPT,
      item.finalVarPT,
      item.tiempoVarPT,
      item.inicioHidratacionPT,
      item.finalHidratacionPT,
      item.tiempoHidratacionPT,
      item.inicioST,
      item.finalST,
      item.tiempoST,
      item.inicioVarST,
      item.finalVarST,
      item.tiempoVarST,
      item.inicioHidratacionST,
      item.finalHidratacionST,
      item.tiempoHidratacionST,
      ...titulares,
      ...convocados,
      ...noIngresaron,
      ...cambios.flatMap((cambio) => [
        cambio.sale,
        cambio.entra,
        cambio.hora,
      ]),
    ].join(" ");
  };

  const registrosVisibles = useMemo(() => {
    const textoBuscado = normalizarTexto(busquedaRegistros);

    return guardados
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (!textoBuscado) return true;

        const textoRegistro = normalizarTexto(textoRegistroParaBusqueda(item));
        return textoRegistro.includes(textoBuscado);
      })
      .sort((a, b) => {
        if (ordenRegistros === "reciente") return a.index - b.index;
        return b.index - a.index;
      });
  }, [guardados, busquedaRegistros, ordenRegistros]);

  const actualizar = (campo, valor) => {
    setRegistro((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  };
  const seleccionarModoTiempo = (nuevoModo) => {
    setRegistro((prev) => ({
      ...prev,
      modoTiempo: nuevoModo,
      referenciaRealPT: null,
      referenciaRealST: null,
    }));

    setTimeout(quitarFoco, 0);
  };
  const actualizarCambio = (index, campo, valor) => {
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
  };
  
  const limpiarCambiosRival = () => {
    setRegistro((prev) => ({
      ...prev,
      cambiosRival: crearCambiosVacios(),
    }));
  };
  const importarJugadoresRival = async () => {
    
    if (!registro.fecha) {
      alert("Primero cargá la fecha del partido.");
      return;
    }
  
    try {
      const url =
  "https://script.google.com/macros/s/AKfycbxK9paHAC-hsydI_7ylKXuQs_FJD3pH0ACyCII83LODvCBGQoZdxa1YBF8Iz8Uu-i7K/exec" +
  "?action=jugadoresRival&fecha=" +
  encodeURIComponent(registro.fecha);
  
      const data = await cargarJsonp(url);
  
      if (!data.ok) {
        alert(data.error || "No se pudieron importar los jugadores del rival.");
        return;
      }
  
      setRegistro((prev) => ({
        ...prev,
        rival: data.rival || prev.rival,
        jugadoresRival: [
          ...(data.jugadoresRival || []),
          ...(data.titularesRival || []),
          ...(data.convocadosRival || []),
          ...(data.titulares || []),
          ...(data.convocados || []),
        ].filter((jugador, index, array) =>
          jugador && array.indexOf(jugador) === index
        ),
      }));
  
      alert("Jugadores del rival importados correctamente.");
    } catch (error) {
      console.error("ERROR IMPORTANDO JUGADORES RIVAL:", error);
      alert("Error conectando con jugadores del rival.");
    }
  };
  const recomendarHorariosCambioRival = async () => {
      if (!registro.fecha) {
        alert("Primero cargá la fecha del partido.");
        return;
      }
    
      if (!registro.inicioPT || !registro.inicioST) {
        alert("Primero cargá Inicio PT e Inicio ST para poder calcular horarios.");
        return;
      }
    
      try {
        const url =
          "https://script.google.com/macros/s/AKfycby_KZfB2Qccm2VMn4oUMnjbYpgyJbdTOzs4NqMH3izdAC6HLwiJT62_1WPklWC4BmJ_/exec" +
          "?action=cambiosRival&fecha=" +
          encodeURIComponent(registro.fecha);
    
        const data = await cargarJsonp(url);
    
        if (!data.ok) {
          alert(data.error || "No se pudieron recomendar horarios.");
          return;
        }
    
        const cambiosApi = data.cambiosRival || [];
    
        if (cambiosApi.length === 0) {
          alert("No se encontraron cambios del rival en Sportradar.");
          return;
        }
    
        setRegistro((prev) => {
          const cambiosActuales = prev.cambiosRival || crearCambiosVacios();
          const nuevosCambios = crearCambiosVacios();
    
          cambiosApi.slice(0, 5).forEach((cambioApi, index) => {
            const cambioActual = cambiosActuales[index] || {};
    
            const matchClock = cambioApi.matchClock || "";
            const horaSugerida = calcularHoraCambioDesdeMinuto(matchClock);
    
            nuevosCambios[index] = {
              ...cambioActual,
              sale: cambioActual.sale || String(cambioApi.sale || "").toUpperCase(),
              entra: cambioActual.entra || String(cambioApi.entra || "").toUpperCase(),
              minuto: matchClock,
              hora: cambioActual.hora || horaSugerida,
            };
          });
    
          return {
            ...prev,
            rival: data.rival || prev.rival,
            cambiosRival: nuevosCambios,
          };
        });
    
        alert("Horarios recomendados cargados. Revisalos antes de guardar.");
      } catch (error) {
        console.error("ERROR RECOMENDANDO HORARIOS RIVAL:", error);
        alert("Error conectando con Sportradar.");
      }
    };
  const agregarVar = (tipo) => {
    setRegistro((prev) => {
      const claveVars = tipo === "PT" ? "varsPT" : "varsST";
      const claveActivo = tipo === "PT" ? "varPTActivo" : "varSTActivo";
  
      const varsActuales = [...prev[claveVars]];
  
      if (varsActuales.length >= 3) return prev;
  
      varsActuales.push({
        inicio: "",
        final: "",
      });
  
      return {
        ...prev,
        [claveVars]: varsActuales,
        [claveActivo]: varsActuales.length - 1,
      };
    });
  };
  
  const cambiarVarActivo = (tipo, index) => {
    setRegistro((prev) => ({
      ...prev,
      [tipo === "PT" ? "varPTActivo" : "varSTActivo"]: index,
    }));
  };
  
  const actualizarVar = (tipo, campo, valor) => {
    setRegistro((prev) => {
      const claveVars = tipo === "PT" ? "varsPT" : "varsST";
      const claveActivo = tipo === "PT" ? "varPTActivo" : "varSTActivo";
  
      const varsActuales = [...prev[claveVars]];
      const activo = prev[claveActivo];
  
      varsActuales[activo] = {
        ...varsActuales[activo],
        [campo]: valor,
      };
  
      return {
        ...prev,
        [claveVars]: varsActuales,
      };
    });
  };
  
  const ponerAhoraVar = (tipo, campo) => {
    const valor = obtenerMarcaActual(tipo);

    if (!valor) {
      alert(`Primero marcá Inicio ${tipo}.`);
      return;
    }

    actualizarVar(tipo, campo, valor);
    setTimeout(quitarFoco, 0);
  };

  const actualizarFormacion = (nuevaFormacion) => {
    setRegistro((prev) => ({
      ...prev,
      fecha: fechaFormacion || prev.fecha,
      formacion: nuevaFormacion,
    }));
  };

  const horaActual = () => {
    const ahora = new Date();
    return ahora.toTimeString().slice(0, 8);
  };

  const esFormatoTransmision = (valor) =>
    /^\d{3,}:\d{2}$/.test(String(valor || "").trim());

  const formatearTiempoTransmision = (totalSegundos) => {
    const segundosSeguros = Math.max(0, Math.floor(Number(totalSegundos) || 0));
    const minutos = Math.floor(segundosSeguros / 60);
    const segundos = segundosSeguros % 60;

    return `${String(minutos).padStart(3, "0")}:${String(segundos).padStart(2, "0")}`;
  };

  const limpiarEntradaTiempoTransmision = (valor) => {
    const limpio = String(valor || "").replace(/[^\d:]/g, "");
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

    const coincidencia = texto.match(/^(\d{1,3}):([0-5]?\d)$/);
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

  const obtenerPeriodoActivo = () =>
    registro.referenciaRealST ? "ST" : "PT";

  const quitarFoco = () => {
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  };

  const mantenerPosicion = (accion) => {
    posicionScrollPendiente.current = window.scrollY;
    accion();
  };

  const ponerAhora = (campo) => {
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
  };
  const ponerHoraEntreTiempo = (index) => {
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
  };
  const sumarMinutosAHora = (horaBase, minutosASumar) => {
    if (!horaBase && horaBase !== "") return "";
  
    const partes = horaBase.split(":").map(Number);
    const h = partes[0] || 0;
    const m = partes[1] || 0;
    const s = partes[2] || 0;
  
    const fecha = new Date();
    fecha.setHours(h, m, s, 0);
    fecha.setMinutes(fecha.getMinutes() + minutosASumar);
  
    return fecha.toTimeString().slice(0, 8);
  };
  
  const calcularHoraCambioDesdeMinuto = (matchClock) => {
    if (!matchClock) return "";
  
    const partes = String(matchClock).split(":").map(Number);
    const minuto = partes[0] || 0;
    const segundo = partes[1] || 0;

    if (registro.modoTiempo === "transmision") {
      return formatearTiempoTransmision(minuto * 60 + segundo);
    }
  
    let horaBase = "";
    let minutosASumar = 0;
  
    if (minuto <= 45) {
      horaBase = registro.inicioPT;
      minutosASumar = minuto;
    } else {
      horaBase = registro.inicioST;
      minutosASumar = minuto - 45;
    }
  
    if (!horaBase) return "";
  
    const partesHora = horaBase.split(":").map(Number);
    const h = partesHora[0] || 0;
    const m = partesHora[1] || 0;
    const s = partesHora[2] || 0;
  
    const fecha = new Date();
    fecha.setHours(h, m, s, 0);
    fecha.setMinutes(fecha.getMinutes() + minutosASumar);
    fecha.setSeconds(fecha.getSeconds() + segundo);
  
    return fecha.toTimeString().slice(0, 8);
  };
  
  const convertirNombreJugador = (nombre) => {
    const limpio = normalizarTextoBase(nombre);
    const equivalente = equivalenciasJugadores[limpio];
  
    return equivalente ? equivalente.toUpperCase() : String(nombre || "").trim().toUpperCase();
  };
  const manejarEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  };

  const segundosDesdeHora = (hora) => {
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
  };

  const segundosEntre = (inicio, final) => {
    if (!inicio || !final) return "";

    const totalInicio = segundosDesdeHora(inicio);
    let totalFinal = segundosDesdeHora(final);

    if (totalInicio === null || totalFinal === null) return "";

    if (totalFinal < totalInicio) {
      totalFinal += 24 * 3600;
    }

    return totalFinal - totalInicio;
  };

  const formatearDuracion = (totalSegundos) => {
    if (
      totalSegundos === "" ||
      totalSegundos === null ||
      totalSegundos === undefined
    ) {
      return "";
    }

    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    const mm = String(minutos).padStart(2, "0");
    const ss = String(segundos).padStart(2, "0");

    if (horas > 0) {
      const hh = String(horas).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    }

    return `${mm}:${ss}`;
  };

  const calcularTiemposRegistro = (item) => ({
    tiempoPT: formatearDuracion(segundosEntre(item.inicioPT, item.finalPT)),
    tiempoVarPT: formatearDuracion(
      segundosEntre(item.inicioVarPT, item.finalVarPT)
    ),
    tiempoHidratacionPT: formatearDuracion(
      segundosEntre(item.inicioHidratacionPT, item.finalHidratacionPT)
    ),
    tiempoST: formatearDuracion(segundosEntre(item.inicioST, item.finalST)),
    tiempoVarST: formatearDuracion(
      segundosEntre(item.inicioVarST, item.finalVarST)
    ),
    tiempoHidratacionST: formatearDuracion(
      segundosEntre(item.inicioHidratacionST, item.finalHidratacionST)
    ),
  });

  const resumen = useMemo(() => {
    return {
      tiempoPT: segundosEntre(registro.inicioPT, registro.finalPT),
      tiempoVarPT: segundosEntre(registro.inicioVarPT, registro.finalVarPT),
      tiempoHidratacionPT: segundosEntre(
        registro.inicioHidratacionPT,
        registro.finalHidratacionPT
      ),
      tiempoST: segundosEntre(registro.inicioST, registro.finalST),
      tiempoVarST: segundosEntre(registro.inicioVarST, registro.finalVarST),
      tiempoHidratacionST: segundosEntre(
        registro.inicioHidratacionST,
        registro.finalHidratacionST
      ),
    };
  }, [registro]);

  const guardarRegistro = async () => {
    const nuevoRegistro = {
      ...registro,
      ...calcularTiemposRegistro(registro),
      varsPT: registro.varsPT || [{ inicio: "", final: "" }],
      varsST: registro.varsST || [{ inicio: "", final: "" }],
      noIngresaron: calcularNoIngresaron(registro.formacion, registro.cambios),
      guardadoEn: new Date().toISOString(),
    };
    const cambiosRival = nuevoRegistro.cambiosRival || crearCambiosVacios();
  
    const registroSupabase = {
      fecha: nuevoRegistro.fecha,
      rival: nuevoRegistro.rival,
      resultado: nuevoRegistro.resultado || "",
      inicio_pt: nuevoRegistro.inicioPT,
final_pt: nuevoRegistro.finalPT,
tiempo_pt: nuevoRegistro.tiempoPT || "",

inicio_st: nuevoRegistro.inicioST,
final_st: nuevoRegistro.finalST,
tiempo_st: nuevoRegistro.tiempoST || "",
  
      inicio_var_pt_1: nuevoRegistro.varsPT?.[0]?.inicio || "",
      final_var_pt_1: nuevoRegistro.varsPT?.[0]?.final || "",
      inicio_var_pt_2: nuevoRegistro.varsPT?.[1]?.inicio || "",
      final_var_pt_2: nuevoRegistro.varsPT?.[1]?.final || "",
      inicio_var_pt_3: nuevoRegistro.varsPT?.[2]?.inicio || "",
      final_var_pt_3: nuevoRegistro.varsPT?.[2]?.final || "",
  
      inicio_var_st_1: nuevoRegistro.varsST?.[0]?.inicio || "",
      final_var_st_1: nuevoRegistro.varsST?.[0]?.final || "",
      inicio_var_st_2: nuevoRegistro.varsST?.[1]?.inicio || "",
      final_var_st_2: nuevoRegistro.varsST?.[1]?.final || "",
      inicio_var_st_3: nuevoRegistro.varsST?.[2]?.inicio || "",
      final_var_st_3: nuevoRegistro.varsST?.[2]?.final || "",
  
      inicio_hid_pt: nuevoRegistro.inicioHidratacionPT,
      final_hid_pt: nuevoRegistro.finalHidratacionPT,
      inicio_hid_st: nuevoRegistro.inicioHidratacionST,
      final_hid_st: nuevoRegistro.finalHidratacionST,
  
      cambio_1_tiempo: nuevoRegistro.cambios?.[0]?.hora || "",
      cambio_1_sale: nuevoRegistro.cambios?.[0]?.sale || "",
      cambio_1_entra: nuevoRegistro.cambios?.[0]?.entra || "",
  
      cambio_2_tiempo: nuevoRegistro.cambios?.[1]?.hora || "",
      cambio_2_sale: nuevoRegistro.cambios?.[1]?.sale || "",
      cambio_2_entra: nuevoRegistro.cambios?.[1]?.entra || "",
  
      cambio_3_tiempo: nuevoRegistro.cambios?.[2]?.hora || "",
      cambio_3_sale: nuevoRegistro.cambios?.[2]?.sale || "",
      cambio_3_entra: nuevoRegistro.cambios?.[2]?.entra || "",
  
      cambio_4_tiempo: nuevoRegistro.cambios?.[3]?.hora || "",
      cambio_4_sale: nuevoRegistro.cambios?.[3]?.sale || "",
      cambio_4_entra: nuevoRegistro.cambios?.[3]?.entra || "",
  
      cambio_5_tiempo: nuevoRegistro.cambios?.[4]?.hora || "",
      cambio_5_sale: nuevoRegistro.cambios?.[4]?.sale || "",
      cambio_5_entra: nuevoRegistro.cambios?.[4]?.entra || "",
      
      rival_cambio_sale1: cambiosRival[0]?.sale || "",
rival_cambio_entra1: cambiosRival[0]?.entra || "",
rival_cambio_horario1: cambiosRival[0]?.hora || "",

rival_cambio_sale2: cambiosRival[1]?.sale || "",
rival_cambio_entra2: cambiosRival[1]?.entra || "",
rival_cambio_horario2: cambiosRival[1]?.hora || "",

rival_cambio_sale3: cambiosRival[2]?.sale || "",
rival_cambio_entra3: cambiosRival[2]?.entra || "",
rival_cambio_horario3: cambiosRival[2]?.hora || "",

rival_cambio_sale4: cambiosRival[3]?.sale || "",
rival_cambio_entra4: cambiosRival[3]?.entra || "",
rival_cambio_horario4: cambiosRival[3]?.hora || "",

rival_cambio_sale5: cambiosRival[4]?.sale || "",
rival_cambio_entra5: cambiosRival[4]?.entra || "",
rival_cambio_horario5: cambiosRival[4]?.hora || "",
      
      titulares: nuevoRegistro.formacion?.titulares || [],
      convocados: nuevoRegistro.formacion?.convocados || [],
    };
  
    const { error } = await supabase
      .from("registros_partido")
      .insert([registroSupabase]);
  
    if (error) {
      console.error("ERROR COMPLETO SUPABASE:");
      console.log(error);
      alert(JSON.stringify(error, null, 2));
      setMensajeGuardado("Registro guardado localmente, pero falló Supabase");
      return;
    }
  
    console.log("INSERT OK");
    console.log(registroSupabase);
    await cargarRegistrosSupabase();
    setMensajeGuardado("Registro guardado con éxito");
  
    setTimeout(() => {
      setMensajeGuardado("");
    }, 2500);
  };

  const limpiarCarga = () => {
    const nuevoRegistro = crearRegistroVacio();

    setRegistro(nuevoRegistro);
    setFormacionTemporal(nuevoRegistro.formacion);
    setFechaFormacion(nuevoRegistro.fecha);
    setPantallaFormacion("lista");
    setMostrarFormacionPartido(false);

    localStorage.setItem("registro_actual_partido", JSON.stringify(nuevoRegistro));
  };

  const volverAPantallaFormacion = () => {
    setFormacionTemporal(registro.formacion || crearFormacionVacia());
    setFechaFormacion(registro.fecha || new Date().toISOString().slice(0, 10));
    setPantallaFormacion("inicio");
    setMostrarFormacionPartido(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const convertirRegistroASupabase = (registroEditado) => {
    const cambiosRival = registroEditado.cambiosRival || crearCambiosVacios();
  
    return {
      fecha: registroEditado.fecha,
      rival: registroEditado.rival,
      resultado: registroEditado.resultado || "",
  
      inicio_pt: registroEditado.inicioPT || "",
final_pt: registroEditado.finalPT || "",
tiempo_pt: registroEditado.tiempoPT || "",

inicio_st: registroEditado.inicioST || "",
final_st: registroEditado.finalST || "",
tiempo_st: registroEditado.tiempoST || "",
  
      inicio_var_pt_1: registroEditado.varsPT?.[0]?.inicio || "",
      final_var_pt_1: registroEditado.varsPT?.[0]?.final || "",
      inicio_var_pt_2: registroEditado.varsPT?.[1]?.inicio || "",
      final_var_pt_2: registroEditado.varsPT?.[1]?.final || "",
      inicio_var_pt_3: registroEditado.varsPT?.[2]?.inicio || "",
      final_var_pt_3: registroEditado.varsPT?.[2]?.final || "",
  
      inicio_var_st_1: registroEditado.varsST?.[0]?.inicio || "",
      final_var_st_1: registroEditado.varsST?.[0]?.final || "",
      inicio_var_st_2: registroEditado.varsST?.[1]?.inicio || "",
      final_var_st_2: registroEditado.varsST?.[1]?.final || "",
      inicio_var_st_3: registroEditado.varsST?.[2]?.inicio || "",
      final_var_st_3: registroEditado.varsST?.[2]?.final || "",
  
      inicio_hid_pt: registroEditado.inicioHidratacionPT || "",
      final_hid_pt: registroEditado.finalHidratacionPT || "",
      inicio_hid_st: registroEditado.inicioHidratacionST || "",
      final_hid_st: registroEditado.finalHidratacionST || "",
  
      cambio_1_tiempo: registroEditado.cambios?.[0]?.hora || "",
      cambio_1_sale: registroEditado.cambios?.[0]?.sale || "",
      cambio_1_entra: registroEditado.cambios?.[0]?.entra || "",
  
      cambio_2_tiempo: registroEditado.cambios?.[1]?.hora || "",
      cambio_2_sale: registroEditado.cambios?.[1]?.sale || "",
      cambio_2_entra: registroEditado.cambios?.[1]?.entra || "",
  
      cambio_3_tiempo: registroEditado.cambios?.[2]?.hora || "",
      cambio_3_sale: registroEditado.cambios?.[2]?.sale || "",
      cambio_3_entra: registroEditado.cambios?.[2]?.entra || "",
  
      cambio_4_tiempo: registroEditado.cambios?.[3]?.hora || "",
      cambio_4_sale: registroEditado.cambios?.[3]?.sale || "",
      cambio_4_entra: registroEditado.cambios?.[3]?.entra || "",
  
      cambio_5_tiempo: registroEditado.cambios?.[4]?.hora || "",
      cambio_5_sale: registroEditado.cambios?.[4]?.sale || "",
      cambio_5_entra: registroEditado.cambios?.[4]?.entra || "",
  
      rival_cambio_sale1: cambiosRival[0]?.sale || "",
      rival_cambio_entra1: cambiosRival[0]?.entra || "",
      rival_cambio_horario1: cambiosRival[0]?.hora || "",
  
      rival_cambio_sale2: cambiosRival[1]?.sale || "",
      rival_cambio_entra2: cambiosRival[1]?.entra || "",
      rival_cambio_horario2: cambiosRival[1]?.hora || "",
  
      rival_cambio_sale3: cambiosRival[2]?.sale || "",
      rival_cambio_entra3: cambiosRival[2]?.entra || "",
      rival_cambio_horario3: cambiosRival[2]?.hora || "",
  
      rival_cambio_sale4: cambiosRival[3]?.sale || "",
      rival_cambio_entra4: cambiosRival[3]?.entra || "",
      rival_cambio_horario4: cambiosRival[3]?.hora || "",
  
      rival_cambio_sale5: cambiosRival[4]?.sale || "",
      rival_cambio_entra5: cambiosRival[4]?.entra || "",
      rival_cambio_horario5: cambiosRival[4]?.hora || "",
  
      titulares: registroEditado.formacion?.titulares || [],
      convocados: registroEditado.formacion?.convocados || [],
    };
  };
  const borrarHistorial = async () => {
    const confirmar = window.confirm(
      "¿Seguro que querés borrar todos los registros? Esta acción también borra los datos de Supabase."
    );
  
    if (!confirmar) return;
  
    const ids = guardados
      .map((registro) => registro.idSupabase)
      .filter(Boolean);
  
    if (ids.length > 0) {
      const { error } = await supabase
        .from("registros_partido")
        .delete()
        .in("id", ids);
  
      if (error) {
        console.error("Error borrando historial en Supabase:", error);
        alert("No se pudo borrar el historial en Supabase");
        return;
      }
    }
  
    setGuardados([]);
    localStorage.removeItem("registro_partidos_tiempos");
    setRegistroSeleccionado(null);
  };
  
  const eliminarRegistro = async (indexAEliminar) => {
    const confirmar = window.confirm(
      "¿Querés eliminar este registro? También se va a borrar de Supabase."
    );
  
    if (!confirmar) return;
  
    const registroAEliminar = guardados[indexAEliminar];
  
    if (!registroAEliminar?.idSupabase) {
      alert("Este registro no tiene ID de Supabase. No se puede borrar de la base.");
      return;
    }
  
    const { error } = await supabase
      .from("registros_partido")
      .delete()
      .eq("id", registroAEliminar.idSupabase);
  
    if (error) {
      console.error("Error eliminando registro en Supabase:", error);
      alert("No se pudo eliminar el registro en Supabase");
      return;
    }
  
    await cargarRegistrosSupabase();
    setRegistroSeleccionado(null);
  };
  
  const actualizarRegistroGuardado = async (indexAEditar, registroEditado) => {
    const idRegistro =
      registroEditado.idSupabase || guardados[indexAEditar]?.idSupabase;
  
    if (!idRegistro) {
      alert("Este registro no tiene ID de Supabase. No se puede editar.");
      return false;
    }
  
    const registroConTiempos = {
      ...registroEditado,
      ...calcularTiemposRegistro(registroEditado),
      noIngresaron: calcularNoIngresaron(
        registroEditado.formacion,
        registroEditado.cambios
      ),
      editadoEn: new Date().toISOString(),
      idSupabase: idRegistro,
    };
  
    const registroSupabase = convertirRegistroASupabase(registroConTiempos);
  
    console.log("ID A EDITAR:", idRegistro);
    console.log("DATOS QUE SE MANDAN A SUPABASE:", registroSupabase);
  
    const { data, error } = await supabase
      .from("registros_partido")
      .update(registroSupabase)
      .eq("id", idRegistro)
      .select();
  
    if (error) {
      console.error("Error editando registro en Supabase:", error);
      alert("No se pudieron guardar los cambios en Supabase");
      return false;
    }
  
    if (!data || data.length === 0) {
      alert(
        "Supabase no actualizó ninguna fila. Revisá las políticas RLS de UPDATE."
      );
      console.warn("UPDATE sin filas modificadas:", data);
      return false;
    }
  
    const registroActualizado = convertirSupabaseARegistro(data[0]);
  
    setGuardados((prev) =>
      prev.map((item) =>
        item.idSupabase === idRegistro ? registroActualizado : item
      )
    );
  
    setRegistroSeleccionado({
      item: registroActualizado,
      index: indexAEditar,
    });
  
    return true;
  };
  const cargarJsonp = (url) => {
    return new Promise((resolve, reject) => {
      const callbackName = `jsonpCallback_${Date.now()}_${Math.floor(
        Math.random() * 100000
      )}`;
  
      const script = document.createElement("script");
  
      const limpiar = () => {
        try {
          delete window[callbackName];
        } catch (e) {}
  
        if (script && script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
  
      window[callbackName] = (data) => {
        limpiar();
        resolve(data);
      };
  
      script.src =
        url + (url.includes("?") ? "&" : "?") + "callback=" + callbackName;
  
      script.onerror = () => {
        limpiar();
        reject(new Error("No se pudo conectar con Apps Script"));
      };
  
      document.body.appendChild(script);
    });
  };
 const importarFormacionAutomatica = async () => {
  setMensajeFormacion("Buscando formación oficial...");

  try {
    const url =
      "https://script.google.com/macros/s/AKfycbxK9paHAC-hsydI_7ylKXuQs_FJD3pH0ACyCII83LODvCBGQoZdxa1YBF8Iz8Uu-i7K/exec" +
      "?fecha=" +
      encodeURIComponent(fechaFormacion);

    const data = await cargarJsonp(url);

    if (!data.ok) {
      setMensajeFormacion(data.error || "No se encontró formación oficial.");
      return;
    }

    const convertirNombreJugador = (nombre) => {
      const limpio = normalizarTextoBase(nombre);
      const equivalente = equivalenciasJugadores[limpio];
    
      return equivalente ? equivalente.toUpperCase() : String(nombre || "").toUpperCase();
    };
    
    const nuevaFormacion = {
      titulares: (data.titulares || [])
        .slice(1, 11)
        .map(convertirNombreJugador),
    
      convocados: (data.convocados || [])
        .map(convertirNombreJugador),
    };

    setFormacionTemporal(nuevaFormacion);
    actualizar("fecha", data.fecha || fechaFormacion);
    actualizar("rival", data.rival || "");
    setPantallaFormacion("revision");
    setMensajeFormacion("");
  } catch (error) {
    console.error("ERROR IMPORTANDO FORMACIÓN:", error);
    setMensajeFormacion("Error conectando con la formación automática.");
  }
};
  const abrirCargaManual = () => {
    setMensajeFormacion("");
    setPantallaFormacion("manual");
  };

  const continuarConFormacion = () => {
    actualizarFormacion(formacionTemporal);
    setPantallaFormacion("lista");
  
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  };

  const actualizarTitularTemporal = (index, valor) => {
    setFormacionTemporal((prev) => {
      const nuevosTitulares = [...prev.titulares];
      nuevosTitulares[index] = valor;

      return {
        ...prev,
        titulares: nuevosTitulares,
      };
    });
  };

  const actualizarConvocadoTemporal = (index, valor) => {
    setFormacionTemporal((prev) => {
      const nuevosConvocados = [...prev.convocados];
      nuevosConvocados[index] = valor;

      return {
        ...prev,
        convocados: nuevosConvocados,
      };
    });
  };

  const agregarConvocadoTemporal = () => {
    setFormacionTemporal((prev) => ({
      ...prev,
      convocados: [...prev.convocados, ""],
    }));
  };

  const modificarFormacionActual = () => {
    setFormacionTemporal(registro.formacion || crearFormacionVacia());
    setFechaFormacion(registro.fecha || new Date().toISOString().slice(0, 10));
    setPantallaFormacion("manual");
    setMostrarFormacionPartido(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const CampoHora = ({ label, campo }) => (
    <div className="campo-hora">
      <label>{label}</label>

      <div className="fila-hora">
        <input
          {...obtenerPropsInputTiempo(
            registro[campo],
            (valor) => actualizarCampoTiempo(campo, valor),
            registro.modoTiempo
          )}
        />

        <button
          type="button"
          className="boton-ahora"
          onClick={() => ponerAhora(campo)}
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={quitarFoco}
        >
          Ahora
        </button>
      </div>
    </div>
  );

  const BloqueEvento = ({ titulo, inicioCampo, finalCampo, duracion }) => (
    <div className="bloque-evento">
      <div className="titulo-evento">
        <h3>{titulo}</h3>
        <span>{duracion || "-"}</span>
      </div>

      <CampoHora label="Inicio" campo={inicioCampo} />
      <CampoHora label="Final" campo={finalCampo} />
    </div>
  );

  const ListaSimple = ({
    titulo,
    lista,
    vacio = "Sin datos cargados",
    cantidadPrimeraColumna = 5,
  }) => {
    const datos = limpiarLista(lista);
  
    const columna1 = datos.slice(0, cantidadPrimeraColumna);
    const columna2 = datos.slice(cantidadPrimeraColumna);
  
    return (
      <div className="lista-formacion">
        <h3>{titulo}</h3>
  
        {datos.length === 0 ? (
          <p>{vacio}</p>
        ) : (
          <div className="formacion-grid">
            <div className="columna-formacion">
              {columna1.map((jugador, index) => (
                <div
                  className="item-formacion"
                  key={`${jugador}-${index}`}
                >
                  {index + 1}. {jugador}
                </div>
              ))}
            </div>
  
            <div className="columna-formacion">
              {columna2.map((jugador, index) => (
                <div
                  className="item-formacion"
                  key={`${jugador}-2-${index}`}
                >
                  {index + cantidadPrimeraColumna + 1}. {jugador}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const FormularioFormacion = ({ modo }) => (
    <div className="app">
      <ListaJugadores />

      <div className="contenedor">
        <header className="encabezado">
          <h1>
            {modo === "revision" ? "Formación encontrada" : "Cargar formación"}
          </h1>
          <p>
            Revisá los 10 titulares de campo y la lista interna de convocados.
          </p>
        </header>

        <section className="tarjeta">
          <label>Fecha del partido</label>
          <input
            type="date"
            value={fechaFormacion}
            onChange={(e) => setFechaFormacion(e.target.value)}
          />

          {mensajeFormacion && (
            <div className="aviso-formacion">{mensajeFormacion}</div>
          )}
<div className="selector-modo-tiempo">
  <button
    type="button"
    className={`boton-modo-tiempo ${
      registro.modoTiempo === "transmision" ? "activo" : ""
    }`}
    onClick={() => seleccionarModoTiempo("transmision")}
  >
    <span className="titulo-modo-tiempo">Transmisión</span>
    <span className="descripcion-modo-tiempo">
      Minutos de juego
    </span>
  </button>

  <button
    type="button"
    className={`boton-modo-tiempo ${
      (registro.modoTiempo || "enVivo") === "enVivo" ? "activo" : ""
    }`}
    onClick={() => seleccionarModoTiempo("enVivo")}
  >
    <span className="titulo-modo-tiempo">En Vivo</span>
    <span className="descripcion-modo-tiempo">
      Hora actual
    </span>
  </button>
</div>

{modo === "revision" ? (
  <>
    <ListaSimple
      titulo="10 titulares de campo"
      lista={formacionTemporal.titulares}
      cantidadPrimeraColumna={5}
    />

    <ListaSimple
      titulo="Convocados no titulares"
      lista={formacionTemporal.convocados}
      cantidadPrimeraColumna={6}
    />

    <div className="acciones-dobles">
      <button
        type="button"
        className="boton-secundario"
        onClick={() => setPantallaFormacion("inicio")}
      >
        ← Volver
      </button>

      <button
        type="button"
        className="boton-secundario boton-formacion-grande"
        onClick={abrirCargaManual}
      >
        Cargar manual
      </button>
    </div>

    <div className="contenedor-continuar-full">
      <button
        type="button"
        className="boton-principal boton-continuar-full"
        onClick={continuarConFormacion}
      >
        Continuar
      </button>
    </div>
  </>
) : (
            <>
              <h2>10 titulares de campo</h2>

<div className="formacion-grid">
  {[0, 5].map((inicioColumna) => (
    <div className="columna-formacion" key={`titulares-col-${inicioColumna}`}>
      {formacionTemporal.titulares
        .slice(inicioColumna, inicioColumna + 5)
        .map((jugador, index) => {
          const indexReal = inicioColumna + index;

          return (
            <div className="campo-formacion" key={`titular-${indexReal}`}>
              <label>Titular {indexReal + 1}</label>
              <InputJugador
                value={jugador}
                onChange={(valor) =>
                  actualizarTitularTemporal(indexReal, valor)
                }
              />
            </div>
          );
        })}
    </div>
  ))}
</div>

<h2>Convocados no titulares</h2>

<div className="formacion-grid">
  {[0, 6].map((inicioColumna) => (
    <div className="columna-formacion" key={`convocados-col-${inicioColumna}`}>
      {formacionTemporal.convocados
        .slice(inicioColumna, inicioColumna + 6)
        .map((jugador, index) => {
          const indexReal = inicioColumna + index;

          return (
            <div className="campo-formacion" key={`convocado-${indexReal}`}>
              <label>Convocado {indexReal + 1}</label>
              <InputJugador
                value={jugador}
                onChange={(valor) =>
                  actualizarConvocadoTemporal(indexReal, valor)
                }
              />
            </div>
          );
        })}
    </div>
  ))}
</div>

              <button
                type="button"
                className="boton-agregar-jugador"
                onClick={agregarConvocadoTemporal}
              >
                + Agregar jugador
              </button>

              <div className="acciones-dobles">
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={() => setPantallaFormacion("inicio")}
                >
                  ←  Volver
                </button>

                <button
                  type="button"
                  className="boton-principal"
                  onClick={continuarConFormacion}
                >
                  Guardar formación
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );

  const PantallaInicioFormacion = () => (
    <div className="app">
      <ListaJugadores />

      <div className="contenedor">
        <header className="encabezado">
          <h1>Formación del partido</h1>
          <p>Elegí la fecha e importá o cargá los datos manualmente.</p>
        </header>
        <button
  type="button"
  className="boton-registros-inicio"
  onClick={() => setPantallaFormacion("registros")}
>
  Ingresar a Registros
</button>
        <section className="tarjeta">
          <label>Fecha del partido</label>
          <input
            type="date"
            value={fechaFormacion}
            onChange={(e) => setFechaFormacion(e.target.value)}
          />

          {mensajeFormacion && (
            <div className="aviso-formacion">{mensajeFormacion}</div>
          )}

          <button
            type="button"
            className="boton-principal boton-formacion-grande"
            onClick={importarFormacionAutomatica}
          >
            Importar formación automática
          </button>

          <button
            type="button"
            className="boton-secundario boton-formacion-grande"
            onClick={abrirCargaManual}
          >
            Cargar manual
          </button>

          <p className="texto-ayuda-formacion">
          La formación se importa automáticamente desde SportMonks usando la fecha seleccionada.
          </p>

          {hayFormacionInicial && (
            <button
              type="button"
              className="boton-secundario boton-formacion-grande"
              onClick={() => setPantallaFormacion("lista")}
            >
              Volver al partido
            </button>
          )}
        </section>
      </div>
    </div>
  );

  const DatoDetalle = ({ label, valor }) => (
    <div className="dato-detalle">
      <span>{label}</span>
      <strong>{valor || "-"}</strong>
    </div>
  );

  const CampoDetalleEditable = ({ label, type = "text", value, onChange }) => {
    const modoDetalle =
      registroSeleccionado?.item?.modoTiempo || registro.modoTiempo;
    const usarTransmision =
      type === "time" &&
      (esFormatoTransmision(value) || modoDetalle === "transmision");

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
  };

  const DetalleRegistro = ({ item, index }) => {
    const [editando, setEditando] = useState(false);

    const [editado, setEditado] = useState({
      ...item,
      cambios: item.cambios || crearCambiosVacios(),
      cambiosRival: item.cambiosRival || crearCambiosVacios(),
      formacion: item.formacion || crearFormacionVacia(),
    });

    const tiemposEditados = calcularTiemposRegistro(editado);
    const cambios = editado.cambios || crearCambiosVacios();
    const cambiosRival = editado.cambiosRival || crearCambiosVacios();
    const noIngresaronDetalle = calcularNoIngresaron(
      editado.formacion,
      editado.cambios
    );

    const actualizarEditado = (campo, valor) => {
      setEditado((prev) => ({
        ...prev,
        [campo]: valor,
      }));
    };

    const actualizarCambioEditado = (cambioIndex, campo, valor) => {
      setEditado((prev) => {
        const nuevosCambios = [...(prev.cambios || crearCambiosVacios())];

        nuevosCambios[cambioIndex] = {
          ...nuevosCambios[cambioIndex],
          [campo]: valor,
        };

        return {
          ...prev,
          cambios: nuevosCambios,
        };
      });
    };
    const actualizarCambioRivalEditado = (cambioIndex, campo, valor) => {
      setEditado((prev) => {
        const nuevosCambiosRival = [
          ...(prev.cambiosRival || crearCambiosVacios()),
        ];
    
        nuevosCambiosRival[cambioIndex] = {
          ...nuevosCambiosRival[cambioIndex],
          [campo]: valor,
        };
    
        return {
          ...prev,
          cambiosRival: nuevosCambiosRival,
        };
      });
    };
    const ponerHoraEntreTiempoEditado = (cambioIndex) => {
      if (!editado.inicioST) {
        alert("Primero cargá Inicio ST.");
        return;
      }

      actualizarCambioEditado(cambioIndex, "hora", editado.inicioST);
    };

    const cancelarEdicion = () => {
      setEditado({
        ...item,
        cambios: item.cambios || crearCambiosVacios(),
        cambiosRival: item.cambiosRival || crearCambiosVacios(),
        formacion: item.formacion || crearFormacionVacia(),
      });
      setEditando(false);
    };

    const guardarCambiosEdicion = async () => {
      const ok = await actualizarRegistroGuardado(index, editado);
    
      if (ok) {
        setMensajeGuardado("Cambios guardados correctamente");
setEditando(false);

setTimeout(() => {
  setMensajeGuardado("");
}, 2500);
      }
    };
    return (
      <div className="app">
        <ListaJugadores />

        <div className="contenedor">
          <header className="encabezado">
            <h1>{editando ? "Editar registro" : "Detalle registro"}</h1>
            <p>
              {editado.fecha} · Atlético Mineiro vs{" "}
              {editado.rival || "Sin rival"}
              {editado.resultado ? ` · ${editado.resultado}` : ""}
            </p>
          </header>

          <section className="tarjeta">
            <h2>Datos del partido</h2>

            {editando ? (
              <>
                <CampoDetalleEditable
                  label="Fecha"
                  type="date"
                  value={editado.fecha}
                  onChange={(valor) => actualizarEditado("fecha", valor)}
                />

                <CampoDetalleEditable
                  label="Rival"
                  value={editado.rival}
                  onChange={(valor) => actualizarEditado("rival", valor)}
                />

                <CampoDetalleEditable
                  label="Resultado"
                  value={editado.resultado}
                  onChange={(valor) => actualizarEditado("resultado", valor)}
                />
              </>
            ) : (
              <>
                <DatoDetalle label="Fecha" valor={editado.fecha} />
                <DatoDetalle label="Rival" valor={editado.rival} />
                <DatoDetalle label="Resultado" valor={editado.resultado} />
              </>
            )}
          </section>

          <section className="tarjeta">
  <h2>Formación</h2>

  {editando && (
    <button
      type="button"
      className="boton-secundario boton-formacion-grande"
      onClick={() => {
        setEditado((prev) => ({
          ...prev,
          formacion: prev.formacion || crearFormacionVacia(),
        }));
      }}
    >
      Editar formación y no ingresados
    </button>
  )}

  {editando ? (
    <>
      <h3>10 titulares de campo</h3>

<div className="formacion-grid">
  {[0, 5].map((inicioColumna) => (
    <div className="columna-formacion" key={`edit-titulares-col-${inicioColumna}`}>
      {(editado.formacion?.titulares || [])
        .slice(inicioColumna, inicioColumna + 5)
        .map((jugador, index) => {
          const jugadorIndex = inicioColumna + index;

          return (
            <div className="campo-formacion" key={`edit-titular-${jugadorIndex}`}>
              <label>Titular {jugadorIndex + 1}</label>
              <InputJugador
                value={jugador}
                onChange={(valor) => {
                  setEditado((prev) => {
                    const nuevaFormacion = prev.formacion || crearFormacionVacia();
                    const nuevosTitulares = [...(nuevaFormacion.titulares || [])];

                    nuevosTitulares[jugadorIndex] = valor;

                    return {
                      ...prev,
                      formacion: {
                        ...nuevaFormacion,
                        titulares: nuevosTitulares,
                      },
                    };
                  });
                }}
              />
            </div>
          );
        })}
    </div>
  ))}
</div>

<h3>Convocados no titulares</h3>

<div className="formacion-grid">
  {[0, 6].map((inicioColumna) => (
    <div className="columna-formacion" key={`edit-convocados-col-${inicioColumna}`}>
      {(editado.formacion?.convocados || [])
        .slice(inicioColumna, inicioColumna + 6)
        .map((jugador, index) => {
          const jugadorIndex = inicioColumna + index;

          return (
            <div className="campo-formacion" key={`edit-convocado-${jugadorIndex}`}>
              <label>Convocado {jugadorIndex + 1}</label>
              <InputJugador
                value={jugador}
                onChange={(valor) => {
                  setEditado((prev) => {
                    const nuevaFormacion = prev.formacion || crearFormacionVacia();
                    const nuevosConvocados = [...(nuevaFormacion.convocados || [])];

                    nuevosConvocados[jugadorIndex] = valor;

                    return {
                      ...prev,
                      formacion: {
                        ...nuevaFormacion,
                        convocados: nuevosConvocados,
                      },
                    };
                  });
                }}
              />
            </div>
          );
        })}
    </div>
  ))}
</div>

      <button
        type="button"
        className="boton-agregar-jugador"
        onClick={() => {
          setEditado((prev) => {
            const nuevaFormacion = prev.formacion || crearFormacionVacia();

            return {
              ...prev,
              formacion: {
                ...nuevaFormacion,
                convocados: [...(nuevaFormacion.convocados || []), ""],
              },
            };
          });
        }}
      >
        + Agregar convocado
      </button>

      <ListaSimple
  titulo="No ingresaron"
  lista={noIngresaronDetalle}
  cantidadPrimeraColumna={6}
/>
    </>
  ) : (
    <>
      <ListaSimple
        titulo="10 titulares de campo"
        lista={editado.formacion?.titulares || []}
        cantidadPrimeraColumna={5}
      />
      <ListaSimple
  titulo="No ingresaron"
  lista={noIngresaronDetalle}
  cantidadPrimeraColumna={6}
/>
    </>
  )}
</section>

          <section className="tarjeta">
            <h2>Primer tiempo</h2>

            {editando ? (
              <>
                <CampoDetalleEditable
                  label="Inicio PT"
                  type="time"
                  value={editado.inicioPT}
                  onChange={(valor) => actualizarEditado("inicioPT", valor)}
                />
                <CampoDetalleEditable
                  label="Final PT"
                  type="time"
                  value={editado.finalPT}
                  onChange={(valor) => actualizarEditado("finalPT", valor)}
                />
                <DatoDetalle
                  label="Tiempo PT"
                  valor={tiemposEditados.tiempoPT}
                />

<CampoDetalleEditable
  label="Inicio VAR PT"
  type="time"
  value={editado.varsPT?.[0]?.inicio || ""}
  onChange={(valor) => {
    const nuevasVars = [...(editado.varsPT || [{ inicio: "", final: "" }])];
    nuevasVars[0] = {
      ...(nuevasVars[0] || {}),
      inicio: valor,
    };
    actualizarEditado("varsPT", nuevasVars);
  }}
/>

<CampoDetalleEditable
  label="Final VAR PT"
  type="time"
  value={editado.varsPT?.[0]?.final || ""}
  onChange={(valor) => {
    const nuevasVars = [...(editado.varsPT || [{ inicio: "", final: "" }])];
    nuevasVars[0] = {
      ...(nuevasVars[0] || {}),
      final: valor,
    };
    actualizarEditado("varsPT", nuevasVars);
  }}
/>
                <DatoDetalle
                  label="Tiempo VAR PT"
                  valor={tiemposEditados.tiempoVarPT}
                />

                <CampoDetalleEditable
                  label="Inicio Hidratación PT"
                  type="time"
                  value={editado.inicioHidratacionPT}
                  onChange={(valor) =>
                    actualizarEditado("inicioHidratacionPT", valor)
                  }
                />
                <CampoDetalleEditable
                  label="Final Hidratación PT"
                  type="time"
                  value={editado.finalHidratacionPT}
                  onChange={(valor) =>
                    actualizarEditado("finalHidratacionPT", valor)
                  }
                />
                <DatoDetalle
                  label="Tiempo Hidratación PT"
                  valor={tiemposEditados.tiempoHidratacionPT}
                />
              </>
            ) : (
              <>
                <DatoDetalle label="Inicio PT" valor={editado.inicioPT} />
                <DatoDetalle label="Final PT" valor={editado.finalPT} />
                <DatoDetalle label="Tiempo PT" valor={editado.tiempoPT} />

                {(editado.varsPT || [{ inicio: editado.inicioVarPT, final: editado.finalVarPT }])
  .filter((v) => v.inicio || v.final)
  .map((v, i) => (
    <div className="var-detalle" key={`var-pt-${i}`}>
      <div className="var-detalle-header">
        <span>VAR PT {i + 1}</span>

        <span className="var-detalle-tempo">
          {formatearDuracion(segundosEntre(v.inicio, v.final))}
        </span>
      </div>

      <div className="var-detalle-info">
        <span>Inicio: {v.inicio || "--:--"}</span>
        <span>Final: {v.final || "--:--"}</span>
      </div>
    </div>
  ))}

{(editado.inicioHidratacionPT || editado.finalHidratacionPT) && (
  <>
    <DatoDetalle
      label="Inicio Hidratación PT"
      valor={editado.inicioHidratacionPT}
    />
    <DatoDetalle
      label="Final Hidratación PT"
      valor={editado.finalHidratacionPT}
    />
    <DatoDetalle
      label="Tiempo Hidratación PT"
      valor={editado.tiempoHidratacionPT}
    />
  </>
)}
              </>
            )}
          </section>

          <section className="tarjeta">
            <h2>Segundo tiempo</h2>

            {editando ? (
              <>
                <CampoDetalleEditable
                  label="Inicio ST"
                  type="time"
                  value={editado.inicioST}
                  onChange={(valor) => actualizarEditado("inicioST", valor)}
                />
                <CampoDetalleEditable
                  label="Final ST"
                  type="time"
                  value={editado.finalST}
                  onChange={(valor) => actualizarEditado("finalST", valor)}
                />
                <DatoDetalle
                  label="Tiempo ST"
                  valor={tiemposEditados.tiempoST}
                />

<CampoDetalleEditable
  label="Inicio VAR ST"
  type="time"
  value={editado.varsST?.[0]?.inicio || ""}
  onChange={(valor) => {
    const nuevasVars = [...(editado.varsST || [{ inicio: "", final: "" }])];
    nuevasVars[0] = {
      ...(nuevasVars[0] || {}),
      inicio: valor,
    };
    actualizarEditado("varsST", nuevasVars);
  }}
/>

<CampoDetalleEditable
  label="Final VAR ST"
  type="time"
  value={editado.varsST?.[0]?.final || ""}
  onChange={(valor) => {
    const nuevasVars = [...(editado.varsST || [{ inicio: "", final: "" }])];
    nuevasVars[0] = {
      ...(nuevasVars[0] || {}),
      final: valor,
    };
    actualizarEditado("varsST", nuevasVars);
  }}
/>
                <DatoDetalle
                  label="Tiempo VAR ST"
                  valor={tiemposEditados.tiempoVarST}
                />

                <CampoDetalleEditable
                  label="Inicio Hidratación ST"
                  type="time"
                  value={editado.inicioHidratacionST}
                  onChange={(valor) =>
                    actualizarEditado("inicioHidratacionST", valor)
                  }
                />
                <CampoDetalleEditable
                  label="Final Hidratación ST"
                  type="time"
                  value={editado.finalHidratacionST}
                  onChange={(valor) =>
                    actualizarEditado("finalHidratacionST", valor)
                  }
                />
                <DatoDetalle
                  label="Tiempo Hidratación ST"
                  valor={tiemposEditados.tiempoHidratacionST}
                />
              </>
            ) : (
              <>
                <DatoDetalle label="Inicio ST" valor={editado.inicioST} />
                <DatoDetalle label="Final ST" valor={editado.finalST} />
                <DatoDetalle label="Tiempo ST" valor={editado.tiempoST} />

                {(editado.varsST || [{ inicio: editado.inicioVarST, final: editado.finalVarST }])
  .filter((v) => v.inicio || v.final)
  .map((v, i) => (
    <div className="var-detalle" key={`var-st-${i}`}>
      <div className="var-detalle-header">
        <span>VAR ST {i + 1}</span>

        <span className="var-detalle-tempo">
          {formatearDuracion(segundosEntre(v.inicio, v.final))}
        </span>
      </div>

      <div className="var-detalle-info">
        <span>Inicio: {v.inicio || "--:--"}</span>
        <span>Final: {v.final || "--:--"}</span>
      </div>
    </div>
  ))}

{(editado.inicioHidratacionST || editado.finalHidratacionST) && (
  <>
    <DatoDetalle
      label="Inicio Hidratación ST"
      valor={editado.inicioHidratacionST}
    />
    <DatoDetalle
      label="Final Hidratación ST"
      valor={editado.finalHidratacionST}
    />
    <DatoDetalle
      label="Tiempo Hidratación ST"
      valor={editado.tiempoHidratacionST}
    />
  </>
)}
              </>
            )}
          </section>

          <section className="tarjeta">
            <h2>Cambios</h2>

            <div className="tabla-detalle-cambios">
              <div className="fila-detalle-cambio encabezado-detalle-cambios">
                <div>Cambio</div>
                <div>Sale</div>
                <div>Entra</div>
                <div>{editado.modoTiempo === "transmision" ? "Minuto" : "Hora"}</div>
              </div>

              {cambios.map((cambio, cambioIndex) => (
                <div className="fila-detalle-cambio" key={cambioIndex}>
                  <div>{cambioIndex + 1}</div>

                  <div>
                    {editando ? (
                      <InputJugador
                        value={cambio.sale}
                        onChange={(valor) =>
                          actualizarCambioEditado(cambioIndex, "sale", valor)
                        }
                      />
                    ) : (
                      cambio.sale || "-"
                    )}
                  </div>

                  <div>
                    {editando ? (
                      <InputJugador
                        value={cambio.entra}
                        onChange={(valor) =>
                          actualizarCambioEditado(cambioIndex, "entra", valor)
                        }
                      />
                    ) : (
                      cambio.entra || "-"
                    )}
                  </div>

                  <div>
                    {editando ? (
                      <div className="celda-hora-detalle-editable">
                        <input
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
                        />

                        <button
                          type="button"
                          className="boton-entretiempo-detalle"
                          onClick={() =>
                            ponerHoraEntreTiempoEditado(cambioIndex)
                          }
                        >
                          ET
                        </button>
                      </div>
                    ) : (
                      cambio.hora || "-"
                    )}
                  </div>
                </div>
              ))}
            </div>
                    </section>

          <section className="tarjeta">
            <h2>Cambios Rival</h2>

            <div className="tabla-detalle-cambios">
              <div className="fila-detalle-cambio encabezado-detalle-cambios">
                <div>Cambio</div>
                <div>Sale</div>
                <div>Entra</div>
                <div>{editado.modoTiempo === "transmision" ? "Minuto" : "Hora"}</div>
              </div>

              {cambiosRival.map((cambio, cambioIndex) => (
                <div className="fila-detalle-cambio" key={`rival-${cambioIndex}`}>
                  <div>{cambioIndex + 1}</div>

                  <div>
                    {editando ? (
                      <input
                      className="input-jugador"
                      list="lista-jugadores-rival"
                      value={cambio.sale || ""}
                      onChange={(e) =>
                        actualizarCambioRivalEditado(cambioIndex, "sale", e.target.value)
                      }
                      onKeyDown={manejarEnter}
                      placeholder="Escribir o elegir"
                    />
                    ) : (
                      cambio.sale || "-"
                    )}
                  </div>

                  <div>
                    {editando ? (
                      <input
                      className="input-jugador"
                      list="lista-jugadores-rival"
                      value={cambio.entra || ""}
                      onChange={(e) =>
                        actualizarCambioRivalEditado(cambioIndex, "entra", e.target.value)
                      }
                      onKeyDown={manejarEnter}
                      placeholder="Escribir o elegir"
                    />
                    ) : (
                      cambio.entra || "-"
                    )}
                  </div>

                  <div>
                  {editando ? (
  <div className="celda-hora-detalle-editable">
    <input
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
    />

    <button
      type="button"
      className="boton-entretiempo-detalle"
      onClick={() => {
        if (!editado.inicioST) {
          alert("Primero cargá Inicio ST.");
          return;
        }

        actualizarCambioRivalEditado(cambioIndex, "hora", editado.inicioST);
      }}
    >
      ET
    </button>
  </div>
) : (
  cambio.hora || "-"
)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {editando ? (
            <div className="acciones-dobles">
              <button
                type="button"
                className="boton-secundario"
                onClick={cancelarEdicion}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="boton-principal"
                onClick={guardarCambiosEdicion}
              >
                Guardar cambios
              </button>
            </div>
          ) : (
            <div className="acciones-dobles">
              <button
                type="button"
                className="boton-secundario"
                onClick={() => setRegistroSeleccionado(null)}
              >
                 ← Volver
              </button>

              <button
                type="button"
                className="boton-principal"
                onClick={() => setEditando(true)}
              >
                Editar registro
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!mostrarApp) {
    return (
      <div
        className="intro-pantalla"
        style={{
          backgroundImage: `url(${imagenIntro})`,
        }}
      >
        <div className="overlay-intro">
        </div>
      </div>
    );
  }

  if (pantallaFormacion === "inicio") {
    return PantallaInicioFormacion();
  }

  if (pantallaFormacion === "revision") {
    return FormularioFormacion({ modo: "revision" });
  }

  if (pantallaFormacion === "manual") {
    return FormularioFormacion({ modo: "manual" });
  }if (registroSeleccionado !== null) {
    return (
      <DetalleRegistro
        item={registroSeleccionado.item}
        index={registroSeleccionado.index}
      />
    );
  }
  if (pantallaFormacion === "registros") {
    return (
      <div className="app">
        <div className="contenedor">
          <button
            type="button"
            className="boton-volver-formacion"
            onClick={() => setPantallaFormacion("inicio")}
          >
            ← Volver
          </button>
  
          <header className="encabezado">
            <h1>Registros Guardados</h1>
            <p>Buscá y revisá partidos cargados.</p>
          </header>
  
          {guardados.length > 0 && (
  <section className="tarjeta">
    <h2>Buscar registros</h2>

    <div className="buscador-registros">
      <input
        value={busquedaRegistros}
        onChange={(e) => setBusquedaRegistros(e.target.value)}
        onKeyDown={manejarEnter}
        placeholder="Buscar por rival, resultado, fecha, jugador..."
      />

      <select
        value={ordenRegistros}
        onChange={(e) => setOrdenRegistros(e.target.value)}
      >
        <option value="reciente">Más reciente primero</option>
        <option value="antiguo">Más antiguo primero</option>
      </select>
    </div>
  </section>
)}

<section className="tarjeta">
  <div className="historial-titulo">
    <h2>Registros Guardados</h2>

    {guardados.length > 0 && (
      <button type="button" onClick={borrarHistorial}>
        Borrar historial
      </button>
    )}
  </div>

  {guardados.length === 0 ? (
    <div className="sin-resultados">
      No hay registros guardados todavía.
    </div>
  ) : (
    <>
      <p className="contador-registros">
        Mostrando {registrosVisibles.length} de {guardados.length} registros
      </p>

      {registrosVisibles.length === 0 && (
        <div className="sin-resultados">
          No se encontraron registros con esa búsqueda.
        </div>
      )}

      {registrosVisibles.map(({ item, index }) => (
        <div className="registro-guardado" key={index}>
          <strong>
            {item.fecha} · Atlético Mineiro vs {item.rival || "Sin rival"}
            {item.resultado ? ` · ${item.resultado}` : ""}
          </strong>

          <p>
            PT: {item.inicioPT || "-"} a {item.finalPT || "-"} ·{" "}
            {item.tiempoPT || "-"}
          </p>

          <p>
            ST: {item.inicioST || "-"} a {item.finalST || "-"} ·{" "}
            {item.tiempoST || "-"}
          </p>

          <div className="acciones-registro">
            <button
              type="button"
              className="boton-detalle"
              onClick={() => setRegistroSeleccionado({ item, index })}
            >
              Ver detalle
            </button>

            <button
              type="button"
              className="boton-eliminar-registro"
              onClick={() => eliminarRegistro(item.index)}
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </>
  )}
</section>
        </div>
      </div>
    );
  }
  if (registroSeleccionado !== null) {
    return (
      <DetalleRegistro
        item={registroSeleccionado.item}
        index={registroSeleccionado.index}
      />
    );
  }
  if (pantalla === "rival") {
    return (
      <div className="app pantalla-rival">
  <ListaJugadores />

  <datalist id="lista-jugadores-rival">
  {[
    ...(registro.jugadoresRival || []),
    ...(registro.cambiosRival || []).map((cambio) => cambio.sale),
    ...(registro.cambiosRival || []).map((cambio) => cambio.entra),
  ]
    .filter((jugador) => jugador && String(jugador).trim() !== "")
    .filter((jugador, index, array) => array.indexOf(jugador) === index)
    .map((jugador, index) => (
      <option key={`jugador-rival-${index}`} value={jugador} />
    ))}
</datalist>
  
        <div className="contenedor">
          <div className="barra-superior">
            <button
              type="button"
              className="boton-volver-formacion"
              onClick={() => setPantalla("principal")}
            >
              ← Volver a Atlético
            </button>
          </div>
  
          <header className="encabezado">
            <h1>Cambios Rival</h1>
            <p>
              {registro.fecha} · Atlético Mineiro vs{" "}
              {registro.rival || "Rival"}
            </p>
          </header>
  
          <section className="tarjeta">
          <h2 className="titulo-cambios-rival">Cambios del rival</h2>
  
            <button
              type="button"
              className="boton-secundario boton-formacion-grande"
              onClick={async () => {
                try {
                  await importarJugadoresRival();
  
                  setTimeout(async () => {
                    await recomendarHorariosCambioRival();
                  }, 300);
                } catch (error) {
                  console.error("Error importando rival:", error);
                  alert("No se pudieron importar los datos del rival.");
                }
              }}
            >
              Importar jugadores y recomendar horarios
            </button>
  
            <div className="tabla-cambios">
              <div className="fila-cambio encabezado-cambios">
                <div>Sale</div>
                <div>Entra</div>
                <div>Hora</div>
              </div>
  
              {(registro.cambiosRival || crearCambiosVacios()).map(
                (cambio, index) => (
                  <div className="fila-cambio" key={`cambio-rival-${index}`}>
                    <div>
                    <input
  className="input-jugador"
  list="lista-jugadores-rival"
  value={cambio.sale || ""}
  onChange={(e) =>
    actualizarCambioRival(index, "sale", e.target.value)
  }
  placeholder="Escribir o elegir"
/>
                    </div>
  
                    <div>
                    <input
  className="input-jugador"
  list="lista-jugadores-rival"
  value={cambio.entra || ""}
  onChange={(e) =>
    actualizarCambioRival(index, "entra", e.target.value)
  }
  placeholder="Escribir o elegir"
/>
                    </div>
  
                    <div className="celda-hora-cambio">
                      <input
                        className="input-hora-cambio"
                        {...obtenerPropsInputTiempo(
                          cambio.hora || "",
                          (valor) => actualizarCambioRival(index, "hora", valor),
                          registro.modoTiempo
                        )}
                      />
  
                      <button
                        type="button"
                        onClick={() => ponerHoraCambioRival(index)}
                        onMouseDown={(e) => e.preventDefault()}
                        onTouchStart={quitarFoco}
                      >
                        Cambio {index + 1}
                      </button>
  
                      <button
                        type="button"
                        className="boton-entretiempo"
                        onClick={() => ponerHoraEntreTiempoRival(index)}
                        onMouseDown={(e) => e.preventDefault()}
                        onTouchStart={quitarFoco}
                      >
                        Entre Tiempo
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
  
            <div className="contenedor-limpiar-rival">
              <button
                type="button"
                className="boton-limpiar-rival"
                onClick={limpiarCambiosRival}
              >
                Limpiar cambios rival
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }
  return (
    <div className="app">
      <ListaJugadores />

      <div className="contenedor">
      <div className="barra-superior">
  <button
    type="button"
    className="boton-volver-formacion"
    onClick={volverAPantallaFormacion}
  >
     ← Volver
  </button>

  <button
  type="button"
  className="lengueta-rival"
  onClick={() => setPantalla("rival")}
>
  Rival
</button>
</div>
        {mensajeGuardado && (
  <div className="mensaje-guardado">
    <span>✓</span>
    {mensajeGuardado}
  </div>
)}
        <header className="encabezado">
          <h1>Registro Partido</h1>
          <p>Atlético Mineiro · PT, ST, VAR e hidratación</p>
        </header>

        <section className="tarjeta">
          <label>Fecha</label>
          <input
            type="date"
            value={registro.fecha}
            onChange={(e) => actualizar("fecha", e.target.value)}
          />

          <label>Rival</label>
          <input
            value={registro.rival}
            onChange={(e) => actualizar("rival", e.target.value)}
            onKeyDown={manejarEnter}
            placeholder="Ej: Santos"
          />

          <label>Resultado</label>
          <input
            value={registro.resultado}
            onChange={(e) => actualizar("resultado", e.target.value)}
            onKeyDown={manejarEnter}
            placeholder="Ej: 2-1"
          />
        </section>

        <section className="tarjeta">
          <h2>Primer tiempo</h2>

          <BloqueEvento
            titulo="PT"
            inicioCampo="inicioPT"
            finalCampo="finalPT"
            duracion={formatearDuracion(resumen.tiempoPT)}
          />
<div className="bloque-evento">
  <div className="vars-header">
    {registro.varsPT.map((v, index) => (
      <button
        key={index}
        type="button"
        className={`var-chip ${
          registro.varPTActivo === index ? "activo" : ""
        }`}
        onClick={() => cambiarVarActivo("PT", index)}
      >
        {formatearDuracion(
  segundosEntre(v.inicio, v.final)
) || `VAR ${index + 1}`}
      </button>
    ))}
  </div>
  <div className="campo-hora">
    <label>Inicio</label>
    <div className="fila-hora">
      <input
        {...obtenerPropsInputTiempo(
          registro.varsPT[registro.varPTActivo]?.inicio || "",
          (valor) => actualizarVar("PT", "inicio", valor),
          registro.modoTiempo
        )}
      />

      <button
        type="button"
        className="boton-ahora"
        onClick={() => ponerAhoraVar("PT", "inicio")}
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
          registro.varsPT[registro.varPTActivo]?.final || "",
          (valor) => actualizarVar("PT", "final", valor),
          registro.modoTiempo
        )}
      />

      <button
        type="button"
        className="boton-ahora"
        onClick={() => ponerAhoraVar("PT", "final")}
      >
        Ahora
      </button>
    </div>
    {registro.varsPT.length < 3 && (
  <button
    type="button"
    className="boton-agregar-var"
    onClick={() => agregarVar("PT")}
  >
    Agregar +
  </button>
)}
  </div>
</div>

          <BloqueEvento
            titulo="Hidratación PT"
            inicioCampo="inicioHidratacionPT"
            finalCampo="finalHidratacionPT"
            duracion={formatearDuracion(resumen.tiempoHidratacionPT)}
          />
        </section>

        <section className="tarjeta">
          <h2>Segundo tiempo</h2>

          <BloqueEvento
            titulo="ST"
            inicioCampo="inicioST"
            finalCampo="finalST"
            duracion={formatearDuracion(resumen.tiempoST)}
          />

<div className="bloque-evento">
  <div className="vars-header">
    {registro.varsST.map((v, index) => (
      <button
        key={index}
        type="button"
        className={`var-chip ${
          registro.varSTActivo === index ? "activo" : ""
        }`}
        onClick={() => cambiarVarActivo("ST", index)}
      >
        {formatearDuracion(segundosEntre(v.inicio, v.final)) ||
          `VAR ${index + 1}`}
      </button>
    ))}
  </div>

  <div className="campo-hora">
    <label>Inicio</label>

    <div className="fila-hora">
      <input
        {...obtenerPropsInputTiempo(
          registro.varsST[registro.varSTActivo]?.inicio || "",
          (valor) => actualizarVar("ST", "inicio", valor),
          registro.modoTiempo
        )}
      />

      <button
        type="button"
        className="boton-ahora"
        onClick={() => ponerAhoraVar("ST", "inicio")}
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
          registro.varsST[registro.varSTActivo]?.final || "",
          (valor) => actualizarVar("ST", "final", valor),
          registro.modoTiempo
        )}
      />

      <button
        type="button"
        className="boton-ahora"
        onClick={() => ponerAhoraVar("ST", "final")}
      >
        Ahora
      </button>
    </div>
  </div>

  {registro.varsST.length < 3 && (
    <button
      type="button"
      className="boton-agregar-var"
      onClick={() => agregarVar("ST")}
    >
      Agregar +
    </button>
  )}
</div>

          <BloqueEvento
            titulo="Hidratación ST"
            inicioCampo="inicioHidratacionST"
            finalCampo="finalHidratacionST"
            duracion={formatearDuracion(resumen.tiempoHidratacionST)}
          />
        </section>

        <section className="tarjeta">
  <h2>Cambios</h2>
  <div className="tabla-cambios">
            <div className="fila-cambio encabezado-cambios">
              <div>Sale</div>
              <div>Entra</div>
              <div>Hora</div>
            </div>

            {registro.cambios.map((cambio, index) => (
              <div className="fila-cambio" key={`cambio-rival-${index}`}>
                <div>
                  <InputJugador
                    value={cambio.sale}
                    onChange={(valor) => actualizarCambio(index, "sale", valor)}
                  />
                </div>

                <div>
                  <InputJugador
                    value={cambio.entra}
                    onChange={(valor) => actualizarCambio(index, "entra", valor)}
                  />
                </div>

                <div className="celda-hora-cambio">
                  <input
                    className="input-hora-cambio"
                    {...obtenerPropsInputTiempo(
                      cambio.hora || "",
                      (valor) => actualizarCambio(index, "hora", valor),
                      registro.modoTiempo
                    )}
                  />

                  <button
                    type="button"
                    onClick={() => ponerHoraCambio(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onTouchStart={quitarFoco}
                  >
                    Cambio {index + 1}
                  </button>

                  <button
                    type="button"
                    className="boton-entretiempo"
                    onClick={() => ponerHoraEntreTiempo(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onTouchStart={quitarFoco}
                  >
                    ET
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <div className="historial-titulo">
            <h2>Formación cargada</h2>

            <button
              type="button"
              onClick={() => setMostrarFormacionPartido((prev) => !prev)}
            >
              {mostrarFormacionPartido ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {mostrarFormacionPartido && (
            <>
              <ListaSimple
                titulo="10 titulares de campo"
                lista={registro.formacion?.titulares || []}
                cantidadPrimeraColumna={5}
              />

              <ListaSimple titulo="No ingresaron" lista={noIngresaronActuales} />

              <button
                type="button"
                className="boton-modificar-formacion"
                onClick={modificarFormacionActual}
              >
                Modificar formación
              </button>
            </>
          )}
        </section>

        <div className="acciones-dobles">
          <button
            type="button"
            className="boton-secundario"
            onClick={limpiarCarga}
          >
            Limpiar
          </button>

          <button
            type="button"
            className="boton-principal"
            onClick={guardarRegistro}
          >
            Guardar
          </button>
        </div>

        <section className="tarjeta">
  <button
    type="button"
    className="boton-ir-registros"
    onClick={() => setPantallaFormacion("registros")}
  >
    Ir a Registros
  </button>
</section>
    </div>
    </div>);}