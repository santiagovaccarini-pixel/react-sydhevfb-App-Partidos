import { supabase } from "./supabase.js";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import jugadores from "./jugadores";
import {
  calcularNoIngresaron,
  clavePartido,
  convertirNombreJugador,
  esFormatoHoraReal,
  esFormatoTransmision,
  fechaLocalISO,
  formatearDuracion,
  formatearTiempoTransmision,
  jugadoresParaCambio,
  limpiarLista,
  normalizarEntradaTiempoTransmision,
  normalizarTexto,
  normalizarTextoBase,
  periodoDesdeMinutoPartido,
  segundosDesdeHora,
  segundosEntre,
  sumarDuracionesEventos,
  validarRegistroBasico,
} from "./domain/match";
import {
  cambiosDelRival,
  cortesDePeriodo,
  formatearMinutosSegundos,
  periodosDelRegistro,
  resumenDeTiempos,
  tiempoJugado,
} from "./domain/tiempos";
import { Icono, MarcoAplicacion } from "./components/AppChrome";
import { HoraActual, RelojPartido } from "./components/MatchClock";
import { HojaConfirmar } from "./components/ConfirmSheet";
import {
  EscudoClub,
  EscudoDeClub,
  NOMBRE_CAM,
  useEscudoClub,
} from "./components/ClubCrest";
import "./style.css";
// Pantalla de intro: la imagen del estadio que la app mostraba al abrirse
// desde el primer commit, hasta que el rediseño del 8 de septiembre la sacó
// sin querer junto con el resto de la pantalla.
const IMAGEN_INTRO =
  "https://i.postimg.cc/dt4zFZ2K/ey-Jp-ZCI6Im1f-Nm-Ew-Nzc0ODg3MThj-ODE5MWFi-ODU1Njcz-Mm-I1Y2M3Nj-Y6c2Vka-W1lbn-Q6Ly80Mz-E1Zj-Bh-ZDYw.jpg";
const DURACION_INTRO = 1800;

const NOMBRES_PERIODO = {
  PT: "Primer tiempo",
  ST: "Segundo tiempo",
  PTE: "Primer tiempo extra",
  STE: "Segundo tiempo extra",
};

const nombrePeriodo = (tipo) => NOMBRES_PERIODO[tipo] || tipo;

const APP_VERSION = "2026.09.10.6";
const VERSION_BORRADOR = 2;
const CLAVE_BORRADOR = "registro_actual_partido";
const CLAVE_RESPALDO = "backup_registros_partidos";
const CLAVE_PENDIENTES = "registros_sin_sincronizar";
// Los cinco cambios reglamentarios se muestran siempre, aunque estén vacíos.
const CAMBIOS_SIEMPRE_VISIBLES = 5;

const opcionesMinutosTransmision = Array.from({ length: 121 }, (_, minuto) =>
  String(minuto).padStart(3, "0"),
);

const opcionesSegundosTransmision = Array.from({ length: 60 }, (_, segundo) =>
  String(segundo).padStart(2, "0"),
);

const opcionesHorasEnVivo = Array.from({ length: 24 }, (_, hora) =>
  String(hora).padStart(2, "0"),
);

const normalizarNombreBusqueda = normalizarTextoBase;

const SelectorNombre = ({
  value,
  onChange,
  opciones = [],
  relevantes = 0,
  etiquetaRelevantes = "",
  placeholder = "Escribir o elegir",
  className = "",
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

  // El corte entre "los que importan" y el resto del plantel solo tiene
  // sentido con la lista entera: apenas se escribe, manda la coincidencia.
  const corteRelevantes = normalizarNombreBusqueda(value)
    ? 0
    : Math.min(relevantes, resultados.length);

  useEffect(() => {
    const cerrarAlTocarAfuera = (evento) => {
      if (!contenedorRef.current?.contains(evento.target)) {
        setAbierto(false);
        setIndiceActivo(-1);
      }
    };

    document.addEventListener("pointerdown", cerrarAlTocarAfuera);
    return () =>
      document.removeEventListener("pointerdown", cerrarAlTocarAfuera);
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
        resultados.length === 0
          ? -1
          : Math.min(actual + 1, resultados.length - 1),
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
            : actual - 1,
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
      className={`selector-nombre ${className} ${abierto ? "abierto" : ""}`}
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
        onBlur={(evento) => {
          const siguienteFoco = evento.relatedTarget;
          if (siguienteFoco && contenedorRef.current?.contains(siguienteFoco)) {
            return;
          }

          window.requestAnimationFrame(() => {
            if (!contenedorRef.current?.contains(document.activeElement)) {
              setAbierto(false);
              setIndiceActivo(-1);
            }
          });
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
          {corteRelevantes > 0 && etiquetaRelevantes && (
            <span className="titulo-grupo-nombres">{etiquetaRelevantes}</span>
          )}

          {resultados.map((opcion, index) => (
            <React.Fragment key={`${opcion}-${index}`}>
              {corteRelevantes > 0 && index === corteRelevantes && (
                <span className="titulo-grupo-nombres">Resto del plantel</span>
              )}

              <button
                type="button"
                role="option"
                aria-selected={indiceActivo === index}
                className={`selector-nombre-opcion ${
                  indiceActivo === index ? "activa" : ""
                }`}
                // Elegir al apoyar el dedo sacaba la lista antes de
                // levantarlo, y el click que el navegador manda después caía
                // en el control que quedaba debajo. Al apoyar solo se evita
                // que el campo pierda el foco; se elige al levantar.
                onPointerDown={(evento) => evento.preventDefault()}
                onClick={() => seleccionar(opcion)}
              >
                {opcion}
              </button>
            </React.Fragment>
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
    return () =>
      document.removeEventListener("pointerdown", cerrarAlTocarAfuera);
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
        <span className={`selector-tiempo-valor ${value ? "" : "vacio"}`}>
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

const descomponerHoraEnVivo = (valor) => {
  const coincidencia = String(valor || "").match(
    /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/,
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
    return () =>
      document.removeEventListener("pointerdown", cerrarAlTocarAfuera);
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
    <SelectorHoraEnVivo
      value={value}
      onChange={onChange}
      compacto={className.includes("input-hora-cambio")}
      onKeyDown={onKeyDown}
    />
  );
};

const InputJugador = ({
  value,
  onChange,
  className,
  placeholder,
  opciones = jugadores,
  relevantes = 0,
  etiquetaRelevantes = "",
}) => (
  <SelectorNombre
    value={value}
    onChange={onChange}
    opciones={opciones}
    relevantes={relevantes}
    etiquetaRelevantes={etiquetaRelevantes}
    className={className}
    placeholder={placeholder}
  />
);

const InputJugadorRival = ({
  value,
  onChange,
  opciones = [],
  className,
  placeholder,
}) => {
  const valorNormalizado = normalizarNombreBusqueda(value);
  const opcionesFiltradas = valorNormalizado
    ? opciones.filter(
        (opcion) => normalizarNombreBusqueda(opcion) !== valorNormalizado,
      )
    : opciones;

  return (
    <SelectorNombre
      value={value}
      onChange={onChange}
      opciones={opcionesFiltradas}
      className={className}
      placeholder={placeholder}
    />
  );
};

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
              <div className="item-formacion" key={`${jugador}-${index}`}>
                {index + 1}. {jugador}
              </div>
            ))}
          </div>

          <div className="columna-formacion">
            {columna2.map((jugador, index) => (
              <div className="item-formacion" key={`${jugador}-2-${index}`}>
                {index + cantidadPrimeraColumna + 1}. {jugador}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DatoDetalle = ({ label, valor }) => (
  <div className="dato-detalle">
    <span>{label}</span>
    <strong>{valor || "-"}</strong>
  </div>
);

const EstadoVersionApp = ({ actualizacionDisponible, onActualizar }) => (
  <div className="bloque-version-app">
    <div
      className={`indicador-version-app ${
        actualizacionDisponible ? "actualizacion-pendiente" : ""
      }`}
    >
      <span className="indicador-modo-punto" aria-hidden="true" />
      <div className="indicador-modo-texto">
        <strong>
          {actualizacionDisponible
            ? "Nueva versión disponible"
            : "Aplicación actualizada"}
        </strong>
        <span>Versión {APP_VERSION}</span>
      </div>
    </div>

    {actualizacionDisponible && (
      <button
        type="button"
        className="boton-actualizar-version"
        onClick={onActualizar}
      >
        Actualizar Versión
      </button>
    )}
  </div>
);

export default function App() {
  const crearCambioVacio = () => ({
    sale: "",
    entra: "",
    hora: "",
    minuto: "",
    extraMinuto: "",
    periodo: "",
  });

  const crearCambiosVacios = () =>
    Array.from({ length: 5 }, () => crearCambioVacio());

  const crearProrrogaVacia = () => ({
    prorrogaActiva: false,
    referenciaRealPTE: null,
    referenciaRealSTE: null,
    horaInicioRealPTE: "",
    horaFinalRealPTE: "",
    horaInicioRealSTE: "",
    horaFinalRealSTE: "",
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
  });

  const crearFormacionVacia = () => ({
    titulares: Array.from({ length: 10 }, () => ""),
    // Diez lugares de banco: los que faltan se suman con "Agregar jugador".
    convocados: Array.from({ length: 10 }, () => ""),
  });

  const crearRegistroVacio = () => ({
    fecha: fechaLocalISO(),
    rival: "",
    resultado: "",

    // Modo de registro de los horarios
    modoTiempo: "enVivo",

    // Se usarán para calcular los minutos de transmisión.
    // Guardarán Date.now(), no una hora escrita.
    referenciaRealPT: null,
    referenciaRealST: null,
    horaInicioRealPT: "",
    horaFinalRealPT: "",
    horaInicioRealST: "",
    horaFinalRealST: "",
    ...crearProrrogaVacia(),

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
      const datosGuardados = localStorage.getItem(CLAVE_BORRADOR);

      if (!datosGuardados) return registroVacio;

      const datosRecuperados = JSON.parse(datosGuardados);
      const registroRecuperado =
        datosRecuperados?.version === VERSION_BORRADOR
          ? datosRecuperados.registro
          : datosRecuperados;
      if (!registroRecuperado || typeof registroRecuperado !== "object") {
        return registroVacio;
      }

      const arregloSeguro = (valor, respaldo) =>
        Array.isArray(valor) && valor.length > 0 ? valor : respaldo;

      // Un borrador guardado antes puede traer más lugares de los que se usan
      // hoy. Se recortan los del final que estén vacíos, sin bajar del mínimo
      // y sin tocar nunca un nombre cargado.
      const recortarLugaresLibres = (valor, minimo) => {
        if (!Array.isArray(valor) || valor.length === 0) {
          return Array.from({ length: minimo }, () => "");
        }

        const lista = [...valor];
        while (
          lista.length > minimo &&
          !String(lista[lista.length - 1] || "").trim()
        ) {
          lista.pop();
        }

        return lista;
      };

      return {
        ...registroVacio,
        ...registroRecuperado,
        cambios: arregloSeguro(
          registroRecuperado.cambios,
          registroVacio.cambios,
        ),
        cambiosRival: arregloSeguro(
          registroRecuperado.cambiosRival,
          registroVacio.cambiosRival,
        ),
        jugadoresRival: Array.isArray(registroRecuperado.jugadoresRival)
          ? registroRecuperado.jugadoresRival
          : registroVacio.jugadoresRival,
        varsPT: arregloSeguro(registroRecuperado.varsPT, registroVacio.varsPT),
        varPTActivo: Number.isInteger(registroRecuperado.varPTActivo)
          ? registroRecuperado.varPTActivo
          : 0,
        varsST: arregloSeguro(registroRecuperado.varsST, registroVacio.varsST),
        varSTActivo: Number.isInteger(registroRecuperado.varSTActivo)
          ? registroRecuperado.varSTActivo
          : 0,
        varsPTE: arregloSeguro(
          registroRecuperado.varsPTE,
          registroVacio.varsPTE,
        ),
        varPTEActivo: Number.isInteger(registroRecuperado.varPTEActivo)
          ? registroRecuperado.varPTEActivo
          : 0,
        varsSTE: arregloSeguro(
          registroRecuperado.varsSTE,
          registroVacio.varsSTE,
        ),
        varSTEActivo: Number.isInteger(registroRecuperado.varSTEActivo)
          ? registroRecuperado.varSTEActivo
          : 0,
        formacion: {
          titulares: recortarLugaresLibres(
            registroRecuperado.formacion?.titulares,
            registroVacio.formacion.titulares.length,
          ),
          convocados: recortarLugaresLibres(
            registroRecuperado.formacion?.convocados,
            registroVacio.formacion.convocados.length,
          ),
        },
      };
    } catch (error) {
      return registroVacio;
    }
  };

  const [registro, setRegistro] = useState(obtenerRegistroInicial);
  const [guardados, setGuardados] = useState([]);
  const [historialCargado, setHistorialCargado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState(null);
  const [detalleEditando, setDetalleEditando] = useState(false);
  const [detalleBorrador, setDetalleBorrador] = useState(null);
  const [busquedaRegistros, setBusquedaRegistros] = useState("");
  const [ordenRegistros, setOrdenRegistros] = useState("reciente");
  const [mensajeGuardado, setMensajeGuardado] = useState("");
  const [actualizacionDisponible, setActualizacionDisponible] = useState(false);
  const [periodoVista, setPeriodoVista] = useState("PT");
  // Qué muestra la ficha de un registro guardado. El tiempo es una elección;
  // los otros tres son interruptores independientes.
  const [vistaFicha, setVistaFicha] = useState("PT");
  const [fichaEnNeto, setFichaEnNeto] = useState(false);
  const [fichaDelRival, setFichaDelRival] = useState(false);
  const [fichaCambiosArriba, setFichaCambiosArriba] = useState(false);
  const [equipoCambios, setEquipoCambios] = useState("atletico");
  const formacionInicial = registro.formacion || crearFormacionVacia();
  const hayFormacionInicial =
    (formacionInicial.titulares || []).some((j) => String(j || "").trim()) ||
    (formacionInicial.convocados || []).some((j) => String(j || "").trim());

  const [partidoEnCurso, setPartidoEnCurso] = useState(hayFormacionInicial);

  // Una sola hoja para todas las confirmaciones: la que esté pedida en el
  // momento. Reemplaza a los window.confirm del navegador.
  const [mostrarApp, setMostrarApp] = useState(false);

  useEffect(() => {
    const temporizador = window.setTimeout(
      () => setMostrarApp(true),
      DURACION_INTRO,
    );
    return () => window.clearTimeout(temporizador);
  }, []);

  const [confirmacion, setConfirmacion] = useState(null);

  const cerrarConfirmacion = () => setConfirmacion(null);

  const confirmarAccion = () => {
    const accion = confirmacion?.onConfirmar;
    setConfirmacion(null);
    accion?.();
  };

  // Escudos reales. El nuestro es siempre el mismo, así que no hay nada que
  // esperar; el del rival se busca mientras se escribe el nombre.
  const escudoCam = useEscudoClub(NOMBRE_CAM, { demora: 0 });
  const escudoRival = useEscudoClub(registro.rival);

  const [pantallaFormacion, setPantallaFormacion] = useState(
    hayFormacionInicial ? "lista" : "inicio",
  );

  const [fechaFormacion, setFechaFormacion] = useState(fechaLocalISO());
  const [formacionTemporal, setFormacionTemporal] = useState(
    registro.formacion || crearFormacionVacia(),
  );

  const [mensajeFormacion, setMensajeFormacion] = useState("");

  const opcionesJugadoresRival = useMemo(
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
    ],
  );

  const posicionScrollPendiente = useRef(null);
  const convertirSupabaseARegistro = (fila) => {
    const prorroga = fila.prorroga || {};
    const capturaTiempo =
      fila.captura_tiempo &&
      typeof fila.captura_tiempo === "object" &&
      !Array.isArray(fila.captura_tiempo)
        ? fila.captura_tiempo
        : null;
    const cambiosExtra = Array.isArray(fila.cambios_extra)
      ? fila.cambios_extra
      : [];
    const cambiosRivalExtra = Array.isArray(fila.cambios_rival_extra)
      ? fila.cambios_rival_extra
      : [];

    const registroConvertido = {
      fecha: fila.fecha || "",
      rival: fila.rival || "",
      resultado: fila.resultado || "",
      modoTiempo:
        fila.modo_tiempo ||
        capturaTiempo?.modoTiempo ||
        detectarModoTiempoFila(fila),

      referenciaRealPT: null,
      referenciaRealST: null,
      horaInicioRealPT: esFormatoHoraReal(fila.inicio_pt) ? fila.inicio_pt : "",
      horaFinalRealPT: esFormatoHoraReal(fila.final_pt) ? fila.final_pt : "",
      horaInicioRealST: esFormatoHoraReal(fila.inicio_st) ? fila.inicio_st : "",
      horaFinalRealST: esFormatoHoraReal(fila.final_st) ? fila.final_st : "",

      inicioPT: fila.inicio_pt || "",
      finalPT: fila.final_pt || "",
      tiempoPT: fila.tiempo_pt || "",

      inicioST: fila.inicio_st || "",
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
        ...cambiosExtra,
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
        ...cambiosRivalExtra,
      ],

      formacion: {
        titulares: fila.titulares || [],
        convocados: fila.convocados || [],
      },

      idSupabase: fila.id,
      guardadoEn: fila.created_at || fila.fecha || "",
    };

    // La captura guarda la guía en minutos con la que se anotó el partido:
    // hace falta para no perder el período de cada cambio ni las referencias
    // de arranque. Pero en el registro lo que tiene que verse es el horario,
    // así que se le vuelve a aplicar la misma conversión que se hizo al
    // guardar. Es a prueba de repeticiones: lo que ya es horario pasa de largo.
    const registroRestaurado =
      registroConvertido.modoTiempo === "transmision" && capturaTiempo
        ? convertirRegistroAHorasReales({
            ...registroConvertido,
            ...capturaTiempo,
            fecha: registroConvertido.fecha,
            rival: registroConvertido.rival,
            resultado: registroConvertido.resultado,
            idSupabase: registroConvertido.idSupabase,
            guardadoEn: registroConvertido.guardadoEn,
            modoTiempo: "transmision",
          })
        : registroConvertido;

    return {
      ...registroRestaurado,
      ...calcularTiemposRegistro(registroRestaurado),
      noIngresaron: calcularNoIngresaron(
        registroRestaurado.formacion,
        registroRestaurado.cambios,
      ),
    };
  };

  const leerRespaldoHistorial = () => {
    try {
      const datos = JSON.parse(localStorage.getItem(CLAVE_RESPALDO) || "[]");
      const lista =
        datos?.version === VERSION_BORRADOR ? datos.registros : datos;
      return Array.isArray(lista) ? lista : [];
    } catch (error) {
      return [];
    }
  };

  // Partidos que no se pudieron subir. Viven aparte del respaldo del
  // historial, porque ese se pisa entero cada vez que la base responde.
  const leerPendientes = () => {
    try {
      const guardado = JSON.parse(
        localStorage.getItem(CLAVE_PENDIENTES) || "[]",
      );
      return Array.isArray(guardado) ? guardado : [];
    } catch (error) {
      return [];
    }
  };

  const escribirPendientes = (lista) => {
    try {
      localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(lista));
    } catch (error) {
      console.warn("No se pudo guardar la lista de partidos sin sincronizar.");
    }
  };

  const guardarPendiente = (registroNuevo) => {
    const clave = clavePartido(registroNuevo);
    const pendientes = leerPendientes().filter(
      (item) => clavePartido(item) !== clave,
    );
    const actualizados = [
      { ...registroNuevo, sinSincronizar: true },
      ...pendientes,
    ];

    escribirPendientes(actualizados);
    return actualizados;
  };

  // Guardar un partido con la base caída lo dejaba a salvo, pero nadie lo
  // volvía a intentar: quedaba marcado "sin sincronizar" para siempre. Cuando
  // la base contesta, se suben los que faltan.
  const subirPendientes = async (registrosDeLaBase) => {
    const clavesEnLaBase = new Set(registrosDeLaBase.map(clavePartido));
    const porSubir = leerPendientes().filter(
      (item) => !clavesEnLaBase.has(clavePartido(item)),
    );

    if (porSubir.length === 0) return { subioAlguno: false };

    const quedan = [];
    let subioAlguno = false;

    for (const pendiente of porSubir) {
      try {
        const { error } = await supabase
          .from("registros_partido")
          .insert([construirFilaSupabase(pendiente)])
          .select();

        if (error) {
          console.warn(
            "Sigue sin poder subirse un partido:",
            error.message || error,
          );
          quedan.push(pendiente);
          continue;
        }

        subioAlguno = true;
      } catch (error) {
        console.warn("Sigue sin poder subirse un partido:", error);
        quedan.push(pendiente);
      }
    }

    escribirPendientes(quedan);
    return { subioAlguno };
  };

  // Al volver la base, los que ya llegaron dejan de estar pendientes; los que
  // no, se muestran igual arriba de la lista.
  const mezclarPendientes = (registrosDeLaBase) => {
    const clavesEnLaBase = new Set(registrosDeLaBase.map(clavePartido));
    const pendientes = leerPendientes().filter(
      (item) => !clavesEnLaBase.has(clavePartido(item)),
    );

    escribirPendientes(pendientes);
    return [...pendientes, ...registrosDeLaBase];
  };

  const cargarRegistrosSupabase = async ({ reintentar = true } = {}) => {
    const { data, error } = await supabase
      .from("registros_partido")
      .select("*")
      .order("fecha", { ascending: false });

    if (error) {
      console.error("Error cargando registros desde Supabase:", error);

      setGuardados(leerRespaldoHistorial());

      // El respaldo local se muestra sin avisar: el cartel tapaba el marcador.
      setHistorialCargado(true);
      return;
    }

    const registrosConvertidos = (data || []).map(convertirSupabaseARegistro);

    // Si la base contesta bien pero sin nada, y en el celular hay historial,
    // NO se pisa: una respuesta vacía puede ser un permiso o una tabla que
    // cambió, y antes eso borraba todos los partidos guardados.
    if (registrosConvertidos.length === 0) {
      const respaldo = leerRespaldoHistorial();

      if (respaldo.length > 0) {
        console.warn(
          "La base no devolvió ningún partido. Se conserva el historial del celular.",
        );
        setGuardados(respaldo);
        setHistorialCargado(true);
        return;
      }
    }

    // Con la base respondiendo, se aprovecha para subir lo que había quedado.
    if (reintentar) {
      const { subioAlguno } = await subirPendientes(registrosConvertidos);

      if (subioAlguno) {
        // Se vuelve a leer para traerlos ya con su id, sin reintentar de nuevo.
        await cargarRegistrosSupabase({ reintentar: false });
        return;
      }
    }

    setGuardados(mezclarPendientes(registrosConvertidos));
    setHistorialCargado(true);
  };
  useEffect(() => {
    cargarRegistrosSupabase();
  }, []);

  useEffect(() => {
    let activo = true;

    const verificarActualizacion = async () => {
      try {
        const respuesta = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });

        if (!respuesta.ok) return;

        const datos = await respuesta.json();

        if (activo && datos.version) {
          setActualizacionDisponible(datos.version !== APP_VERSION);
        }
      } catch (error) {
        console.warn("No se pudo comprobar la versión de la app:", error);
      }
    };

    const verificarAlVolver = () => {
      if (document.visibilityState === "visible") {
        verificarActualizacion();
      }
    };

    verificarActualizacion();
    const intervalo = setInterval(verificarActualizacion, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", verificarAlVolver);

    return () => {
      activo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", verificarAlVolver);
    };
  }, []);

  useEffect(() => {
    if (!historialCargado) return;

    try {
      localStorage.setItem(
        CLAVE_RESPALDO,
        JSON.stringify({ version: VERSION_BORRADOR, registros: guardados }),
      );
    } catch (error) {
      console.warn("No se pudo actualizar el respaldo local del historial.");
    }
  }, [guardados, historialCargado]);

  useEffect(() => {
    try {
      localStorage.setItem(
        CLAVE_BORRADOR,
        JSON.stringify({ version: VERSION_BORRADOR, registro }),
      );
    } catch (error) {
      console.warn("No se pudo guardar el borrador local.");
    }
  }, [registro]);

  useLayoutEffect(() => {
    if (posicionScrollPendiente.current !== null) {
      window.scrollTo(0, posicionScrollPendiente.current);
      posicionScrollPendiente.current = null;
    }
  });
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
      ...cambios.flatMap((cambio) => [cambio.sale, cambio.entra, cambio.hora]),
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
    }));

    setTimeout(quitarFoco, 0);
  };
  const actualizarCambio = (index, campo, valor, periodoForzado = "") => {
    setRegistro((prev) => {
      const cambiosActualizados = [...(prev.cambios || crearCambiosVacios())];
      const cambioActual = cambiosActualizados[index] || crearCambioVacio();

      cambiosActualizados[index] = {
        ...cambioActual,
        [campo]: valor,
        periodo:
          campo === "hora"
            ? periodoForzado || obtenerPeriodoActivo(prev)
            : cambioActual.periodo || "",
      };

      return {
        ...prev,
        cambios: cambiosActualizados,
      };
    });
  };
  const actualizarCambioRival = (index, campo, valor, periodoForzado = "") => {
    setRegistro((prev) => {
      const cambiosActualizados = [
        ...(prev.cambiosRival || crearCambiosVacios()),
      ];
      const cambioActual = cambiosActualizados[index] || crearCambioVacio();

      cambiosActualizados[index] = {
        ...cambioActual,
        [campo]: valor,
        periodo:
          campo === "hora"
            ? periodoForzado || obtenerPeriodoActivo(prev)
            : cambioActual.periodo || "",
      };

      return {
        ...prev,
        cambiosRival: cambiosActualizados,
      };
    });
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
    setConfirmacion({
      titulo: "¿Quitar la prórroga?",
      descripcion:
        "Se borran los horarios de los dos tiempos suplementarios. El resto del partido queda igual.",
      etiquetaConfirmar: "Sí, quitar",
      onConfirmar: () => {
        setRegistro((prev) => ({
          ...prev,
          ...crearProrrogaVacia(),
        }));
        // La vista vuelve al primer tiempo recién cuando la prórroga se fue.
        setPeriodoVista("PT");
      },
    });
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
        ].filter(
          (jugador, index, array) =>
            jugador && array.indexOf(jugador) === index,
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
      alert(
        "Primero cargá Inicio PT e Inicio ST para poder calcular horarios.",
      );
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
        const cantidadCambios = Math.max(
          5,
          cambiosActuales.length,
          cambiosApi.length,
        );
        const nuevosCambios = Array.from(
          { length: cantidadCambios },
          (_, index) => ({
            ...crearCambioVacio(),
            ...(cambiosActuales[index] || {}),
          }),
        );

        cambiosApi.forEach((cambioApi, index) => {
          const cambioActual = cambiosActuales[index] || {};

          const matchClock = cambioApi.matchClock || "";
          const sugerenciaTiempo = calcularHoraCambioDesdeMinuto(
            matchClock,
            cambioApi.periodo ||
              cambioApi.period ||
              cambioApi.matchPeriod ||
              "",
          );

          nuevosCambios[index] = {
            ...cambioActual,
            sale:
              cambioActual.sale || String(cambioApi.sale || "").toUpperCase(),
            entra:
              cambioActual.entra || String(cambioApi.entra || "").toUpperCase(),
            minuto: matchClock,
            hora: cambioActual.hora || sugerenciaTiempo.hora,
            periodo: cambioActual.periodo || sugerenciaTiempo.periodo,
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
  const configuracionPeriodos = {
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
  };

  const obtenerConfigPeriodo = (tipo) =>
    configuracionPeriodos[tipo] || configuracionPeriodos.PT;

  const agregarVar = (tipo) => {
    setRegistro((prev) => {
      const config = obtenerConfigPeriodo(tipo);
      const varsActuales = [
        ...(prev[config.vars] || [{ inicio: "", final: "" }]),
      ];

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
      const varsActuales = [
        ...(prev[config.vars] || [{ inicio: "", final: "" }]),
      ];
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

  const horaDesdeTimestamp = (timestamp) => {
    if (timestamp === null || timestamp === undefined || timestamp === "") {
      return "";
    }

    const fecha = new Date(Number(timestamp));
    return Number.isNaN(fecha.getTime())
      ? ""
      : fecha.toTimeString().slice(0, 8);
  };

  const timestampDesdeHoraReal = (hora, referenciaExistente = null) => {
    const coincidencia = String(hora || "").match(
      /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/,
    );
    if (!coincidencia) return null;

    const referenciaNumerica = Number(referenciaExistente);
    const baseValida =
      referenciaExistente !== null &&
      referenciaExistente !== "" &&
      Number.isFinite(referenciaNumerica)
        ? referenciaNumerica
        : Date.now();

    const fecha = new Date(baseValida);
    fecha.setHours(
      Number(coincidencia[1]),
      Number(coincidencia[2]),
      Number(coincidencia[3]),
      0,
    );

    // En cruces de medianoche conserva el día más cercano a la referencia previa.
    const medioDia = 12 * 60 * 60 * 1000;
    const unDia = 24 * 60 * 60 * 1000;
    let timestamp = fecha.getTime();

    if (timestamp - baseValida > medioDia) timestamp -= unDia;
    if (baseValida - timestamp > medioDia) timestamp += unDia;

    return timestamp;
  };

  const sumarSegundosAHoraExacta = (horaBase, segundosASumar) => {
    if (!horaBase) return "";

    const [horas = 0, minutos = 0, segundos = 0] = String(horaBase)
      .split(":")
      .map(Number);
    const totalDia = 24 * 3600;
    const total =
      (((horas * 3600 + minutos * 60 + segundos + Number(segundosASumar || 0)) %
        totalDia) +
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
      Number(segundosGuia || 0) - config.baseSegundos,
    );
    return sumarSegundosAHoraExacta(horaInicioReal, segundosTranscurridos);
  };

  const detectarModoTiempoFila = (fila) => {
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

    return valoresTiempo.some(esFormatoTransmision) ? "transmision" : "enVivo";
  };

  const obtenerPeriodoCampo = (campo) => {
    const texto = String(campo || "").toUpperCase();
    if (texto.includes("STE")) return "STE";
    if (texto.includes("PTE")) return "PTE";
    if (texto.includes("ST")) return "ST";
    return "PT";
  };

  const obtenerMarcaTransmision = (tipo, estado = registro) => {
    const config = obtenerConfigPeriodo(tipo);
    const referencia = Number(estado[config.referencia]);

    if (!referencia) return "";

    const transcurridos = Math.max(
      0,
      Math.floor((Date.now() - referencia) / 1000),
    );

    return formatearTiempoTransmision(config.baseSegundos + transcurridos);
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
            marcaSegundos - config.baseSegundos,
          );
          const referenciaManual = timestampDesdeHoraReal(
            prev[config.horaInicioReal],
            prev[config.referencia],
          );
          const referencia =
            referenciaManual ?? Date.now() - transcurridos * 1000;

          siguiente[config.referencia] = referencia;
          siguiente[config.horaInicioReal] =
            prev[config.horaInicioReal] || horaDesdeTimestamp(referencia);
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

  const actualizarHoraInicioRealPeriodo = (tipo, valor) => {
    if (!configuracionPeriodos[tipo]) return;

    setRegistro((prev) => {
      const config = obtenerConfigPeriodo(tipo);
      const referenciaCorregida = timestampDesdeHoraReal(
        valor,
        prev[config.referencia],
      );
      const siguiente = {
        ...prev,
        [config.horaInicioReal]: valor || "",
        ...(referenciaCorregida !== null
          ? { [config.referencia]: referenciaCorregida }
          : {}),
      };

      // La hora corregida pasa a ser también la referencia de los próximos
      // botones Ahora. Los minutos siguen siendo una guía visual del período.
      siguiente[config.horaFinalReal] = prev[config.final]
        ? convertirGuiaAHoraReal(tipo, prev[config.final], siguiente)
        : "";

      return siguiente;
    });
  };

  const obtenerHoraRealEditable = (tipo) => {
    const config = obtenerConfigPeriodo(tipo);
    return (
      registro[config.horaInicioReal] ||
      horaDesdeTimestamp(registro[config.referencia]) ||
      ""
    );
  };

  const obtenerPeriodoActivo = (estado = registro) => {
    if (estado.inicioSTE && !estado.finalSTE) return "STE";
    if (estado.inicioPTE && !estado.finalPTE) return "PTE";
    if (estado.inicioST && !estado.finalST) return "ST";
    if (estado.inicioPT && !estado.finalPT) return "PT";
    if (estado.inicioSTE || estado.referenciaRealSTE) return "STE";
    if (estado.inicioPTE || estado.referenciaRealPTE) return "PTE";
    if (estado.inicioST || estado.referenciaRealST) return "ST";
    return "PT";
  };

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
                    prev,
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
  };

  const ponerHoraCambio = (index, periodoForzado = "") => {
    quitarFoco();

    const tipo = periodoForzado || obtenerPeriodoActivo();
    const valor = obtenerMarcaActual(tipo);

    if (!valor) {
      alert(`Primero marcá Inicio ${tipo}.`);
      return;
    }

    mantenerPosicion(() => actualizarCambio(index, "hora", valor, tipo));
    setTimeout(quitarFoco, 0);
  };
  const ponerHoraCambioRival = (index, periodoForzado = "") => {
    quitarFoco();

    const tipo = periodoForzado || obtenerPeriodoActivo();
    const valor = obtenerMarcaActual(tipo);

    if (!valor) {
      alert(`Primero marcá Inicio ${tipo}.`);
      return;
    }

    mantenerPosicion(() => actualizarCambioRival(index, "hora", valor, tipo));
    setTimeout(quitarFoco, 0);
  };
  const obtenerMarcaEntreTiempos = () =>
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
  };
  const calcularHoraCambioDesdeMinuto = (matchClock, periodoApi = "") => {
    if (!matchClock) return { hora: "", periodo: "" };

    const { periodo, segundosGuia } = periodoDesdeMinutoPartido(matchClock, {
      prorrogaActiva: registro.prorrogaActiva,
      periodoApi,
    });

    if (!periodo || segundosGuia === null) return { hora: "", periodo: "" };

    if (registro.modoTiempo === "transmision") {
      return {
        hora: formatearTiempoTransmision(segundosGuia),
        periodo,
      };
    }

    const horaBase = {
      PT: registro.inicioPT,
      ST: registro.inicioST,
      PTE: registro.inicioPTE,
      STE: registro.inicioSTE,
    }[periodo];

    if (!horaBase) return { hora: "", periodo };
    return {
      hora: sumarSegundosAHoraExacta(horaBase, segundosGuia),
      periodo,
    };
  };
  const manejarEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  };

  const calcularTiemposRegistro = (item) => ({
    tiempoPT: formatearDuracion(segundosEntre(item.inicioPT, item.finalPT)),
    tiempoVarPT: formatearDuracion(sumarDuracionesEventos(item.varsPT)),
    tiempoHidratacionPT: formatearDuracion(
      segundosEntre(item.inicioHidratacionPT, item.finalHidratacionPT),
    ),
    tiempoST: formatearDuracion(segundosEntre(item.inicioST, item.finalST)),
    tiempoVarST: formatearDuracion(sumarDuracionesEventos(item.varsST)),
    tiempoHidratacionST: formatearDuracion(
      segundosEntre(item.inicioHidratacionST, item.finalHidratacionST),
    ),
    tiempoPTE: formatearDuracion(segundosEntre(item.inicioPTE, item.finalPTE)),
    tiempoVarPTE: formatearDuracion(sumarDuracionesEventos(item.varsPTE)),
    tiempoHidratacionPTE: formatearDuracion(
      segundosEntre(item.inicioHidratacionPTE, item.finalHidratacionPTE),
    ),
    tiempoSTE: formatearDuracion(segundosEntre(item.inicioSTE, item.finalSTE)),
    tiempoVarSTE: formatearDuracion(sumarDuracionesEventos(item.varsSTE)),
    tiempoHidratacionSTE: formatearDuracion(
      segundosEntre(item.inicioHidratacionSTE, item.finalHidratacionSTE),
    ),
  });

  const resumen = useMemo(() => {
    return {
      tiempoPT: segundosEntre(registro.inicioPT, registro.finalPT),
      tiempoVarPT: sumarDuracionesEventos(registro.varsPT),
      tiempoHidratacionPT: segundosEntre(
        registro.inicioHidratacionPT,
        registro.finalHidratacionPT,
      ),
      tiempoST: segundosEntre(registro.inicioST, registro.finalST),
      tiempoVarST: sumarDuracionesEventos(registro.varsST),
      tiempoHidratacionST: segundosEntre(
        registro.inicioHidratacionST,
        registro.finalHidratacionST,
      ),
      tiempoPTE: segundosEntre(registro.inicioPTE, registro.finalPTE),
      tiempoVarPTE: sumarDuracionesEventos(registro.varsPTE),
      tiempoHidratacionPTE: segundosEntre(
        registro.inicioHidratacionPTE,
        registro.finalHidratacionPTE,
      ),
      tiempoSTE: segundosEntre(registro.inicioSTE, registro.finalSTE),
      tiempoVarSTE: sumarDuracionesEventos(registro.varsSTE),
      tiempoHidratacionSTE: segundosEntre(
        registro.inicioHidratacionSTE,
        registro.finalHidratacionSTE,
      ),
    };
  }, [registro]);

  const serializarProrroga = (item) => ({
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
    tiempoVarPTE: item.tiempoVarPTE || "",
    tiempoHidratacionPTE: item.tiempoHidratacionPTE || "",
    tiempoSTE: item.tiempoSTE || "",
    tiempoVarSTE: item.tiempoVarSTE || "",
    tiempoHidratacionSTE: item.tiempoHidratacionSTE || "",
  });

  const serializarCapturaTiempo = (item) => {
    const campos = [
      "modoTiempo",
      "referenciaRealPT",
      "referenciaRealST",
      "referenciaRealPTE",
      "referenciaRealSTE",
      "horaInicioRealPT",
      "horaFinalRealPT",
      "horaInicioRealST",
      "horaFinalRealST",
      "horaInicioRealPTE",
      "horaFinalRealPTE",
      "horaInicioRealSTE",
      "horaFinalRealSTE",
      "inicioPT",
      "finalPT",
      "inicioST",
      "finalST",
      "inicioPTE",
      "finalPTE",
      "inicioSTE",
      "finalSTE",
      "varsPT",
      "varsST",
      "varsPTE",
      "varsSTE",
      "inicioHidratacionPT",
      "finalHidratacionPT",
      "inicioHidratacionST",
      "finalHidratacionST",
      "inicioHidratacionPTE",
      "finalHidratacionPTE",
      "inicioHidratacionSTE",
      "finalHidratacionSTE",
      "cambios",
      "cambiosRival",
      "prorrogaActiva",
    ];

    return campos.reduce((captura, campo) => {
      captura[campo] = item[campo] ?? null;
      return captura;
    }, {});
  };

  const obtenerPeriodoCambioParaGuardar = (cambio, item) => {
    if (cambio?.periodo) return cambio.periodo;
    if (!esFormatoTransmision(cambio?.hora)) return "";

    return periodoDesdeMinutoPartido(cambio.hora, {
      prorrogaActiva: Boolean(item?.prorrogaActiva),
    }).periodo;
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

    // Un registro que vuelve de la base ya tiene horarios. Si el valor es una
    // hora real se deja como está: así una corrección hecha a mano en el
    // detalle no se pisa con la referencia vieja del arranque. Sobre una guía
    // en minutos, en cambio, se hace la cuenta de siempre.
    const inicioReal = (tipo, valor) =>
      esFormatoHoraReal(valor) ? valor : obtenerHoraInicioRealPeriodo(tipo, item);

    const finalReal = (tipo, valor, horaFinalGuardada) =>
      esFormatoHoraReal(valor)
        ? valor
        : horaFinalGuardada || convertirGuiaAHoraReal(tipo, valor, item);

    const convertirVars = (tipo, vars) =>
      (vars || []).map((evento) => ({
        ...evento,
        inicio: convertirGuiaAHoraReal(tipo, evento.inicio, item),
        final: convertirGuiaAHoraReal(tipo, evento.final, item),
      }));

    return {
      ...item,
      inicioPT: inicioReal("PT", item.inicioPT),
      finalPT: finalReal("PT", item.finalPT, item.horaFinalRealPT),
      varsPT: convertirVars("PT", item.varsPT),
      inicioHidratacionPT: convertirGuiaAHoraReal(
        "PT",
        item.inicioHidratacionPT,
        item,
      ),
      finalHidratacionPT: convertirGuiaAHoraReal(
        "PT",
        item.finalHidratacionPT,
        item,
      ),
      inicioST: inicioReal("ST", item.inicioST),
      finalST: finalReal("ST", item.finalST, item.horaFinalRealST),
      varsST: convertirVars("ST", item.varsST),
      inicioHidratacionST: convertirGuiaAHoraReal(
        "ST",
        item.inicioHidratacionST,
        item,
      ),
      finalHidratacionST: convertirGuiaAHoraReal(
        "ST",
        item.finalHidratacionST,
        item,
      ),
      inicioPTE: item.prorrogaActiva
        ? inicioReal("PTE", item.inicioPTE)
        : item.inicioPTE,
      finalPTE: item.prorrogaActiva
        ? finalReal("PTE", item.finalPTE, item.horaFinalRealPTE)
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
        ? inicioReal("STE", item.inicioSTE)
        : item.inicioSTE,
      finalSTE: item.prorrogaActiva
        ? finalReal("STE", item.finalSTE, item.horaFinalRealSTE)
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
      (vars || []).some(
        (evento) => tieneDato(evento.inicio) || tieneDato(evento.final),
      );

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
      if (
        tieneDato(item.inicioPTE) ||
        tieneDato(item.finalPTE) ||
        varsConDatos(item.varsPTE) ||
        tieneDato(item.inicioHidratacionPTE) ||
        tieneDato(item.finalHidratacionPTE)
      ) {
        periodosNecesarios.add("PTE");
      }
      if (
        tieneDato(item.inicioSTE) ||
        tieneDato(item.finalSTE) ||
        varsConDatos(item.varsSTE) ||
        tieneDato(item.inicioHidratacionSTE) ||
        tieneDato(item.finalHidratacionSTE)
      ) {
        periodosNecesarios.add("STE");
      }
    }

    [...(item.cambios || []), ...(item.cambiosRival || [])]
      .filter((cambio) => tieneDato(cambio.hora))
      .forEach((cambio) =>
        periodosNecesarios.add(obtenerPeriodoCambioParaGuardar(cambio, item)),
      );

    const faltantes = [...periodosNecesarios].filter(
      (tipo) => tipo && !obtenerHoraInicioRealPeriodo(tipo, item),
    );

    return faltantes.length > 0
      ? `Falta marcar Inicio ${faltantes.join(", Inicio ")} con el botón Ahora.`
      : "";
  };

  const tieneDatosExtendidos = (item) =>
    Boolean(
      item.prorrogaActiva ||
      item.modoTiempo === "transmision" ||
      (item.cambios || []).length > 5 ||
      (item.cambiosRival || []).length > 5,
    );

  const esErrorColumnasExtendidas = (error) =>
    /prorroga|cambios_extra|cambios_rival_extra|modo_tiempo|captura_tiempo/i.test(
      String(error?.message || error?.details || ""),
    );

  const quitarCamposExtendidos = (payload) => {
    const {
      prorroga,
      cambios_extra,
      cambios_rival_extra,
      modo_tiempo,
      captura_tiempo,
      ...payloadBase
    } = payload;
    return payloadBase;
  };

  // El cartel de guardado siempre se borra solo: antes solo lo hacía el
  // camino exitoso, así que un fallo dejaba el aviso pegado para siempre.
  const avisarGuardado = (texto, milisegundos = 2500) => {
    setMensajeGuardado(texto);
    window.setTimeout(() => setMensajeGuardado(""), milisegundos);
  };

  // Arma la fila que espera Supabase. Vive afuera de guardarRegistro para
  // que el reintento de los pendientes use exactamente la misma.
  const construirFilaSupabase = (registroBase) => {
  const registroConHorasReales = convertirRegistroAHorasReales(registroBase);
  const cambiosRival =
    registroConHorasReales.cambiosRival || crearCambiosVacios();

  return {
    fecha: registroConHorasReales.fecha,
    rival: registroConHorasReales.rival,
    resultado: registroConHorasReales.resultado || "",
    inicio_pt: registroConHorasReales.inicioPT,
    final_pt: registroConHorasReales.finalPT,
    tiempo_pt: registroConHorasReales.tiempoPT || "",

    inicio_st: registroConHorasReales.inicioST,
    final_st: registroConHorasReales.finalST,
    tiempo_st: registroConHorasReales.tiempoST || "",

    inicio_var_pt_1: registroConHorasReales.varsPT?.[0]?.inicio || "",
    final_var_pt_1: registroConHorasReales.varsPT?.[0]?.final || "",
    inicio_var_pt_2: registroConHorasReales.varsPT?.[1]?.inicio || "",
    final_var_pt_2: registroConHorasReales.varsPT?.[1]?.final || "",
    inicio_var_pt_3: registroConHorasReales.varsPT?.[2]?.inicio || "",
    final_var_pt_3: registroConHorasReales.varsPT?.[2]?.final || "",

    inicio_var_st_1: registroConHorasReales.varsST?.[0]?.inicio || "",
    final_var_st_1: registroConHorasReales.varsST?.[0]?.final || "",
    inicio_var_st_2: registroConHorasReales.varsST?.[1]?.inicio || "",
    final_var_st_2: registroConHorasReales.varsST?.[1]?.final || "",
    inicio_var_st_3: registroConHorasReales.varsST?.[2]?.inicio || "",
    final_var_st_3: registroConHorasReales.varsST?.[2]?.final || "",

    inicio_hid_pt: registroConHorasReales.inicioHidratacionPT,
    final_hid_pt: registroConHorasReales.finalHidratacionPT,
    inicio_hid_st: registroConHorasReales.inicioHidratacionST,
    final_hid_st: registroConHorasReales.finalHidratacionST,

    cambio_1_tiempo: registroConHorasReales.cambios?.[0]?.hora || "",
    cambio_1_sale: registroConHorasReales.cambios?.[0]?.sale || "",
    cambio_1_entra: registroConHorasReales.cambios?.[0]?.entra || "",

    cambio_2_tiempo: registroConHorasReales.cambios?.[1]?.hora || "",
    cambio_2_sale: registroConHorasReales.cambios?.[1]?.sale || "",
    cambio_2_entra: registroConHorasReales.cambios?.[1]?.entra || "",

    cambio_3_tiempo: registroConHorasReales.cambios?.[2]?.hora || "",
    cambio_3_sale: registroConHorasReales.cambios?.[2]?.sale || "",
    cambio_3_entra: registroConHorasReales.cambios?.[2]?.entra || "",

    cambio_4_tiempo: registroConHorasReales.cambios?.[3]?.hora || "",
    cambio_4_sale: registroConHorasReales.cambios?.[3]?.sale || "",
    cambio_4_entra: registroConHorasReales.cambios?.[3]?.entra || "",

    cambio_5_tiempo: registroConHorasReales.cambios?.[4]?.hora || "",
    cambio_5_sale: registroConHorasReales.cambios?.[4]?.sale || "",
    cambio_5_entra: registroConHorasReales.cambios?.[4]?.entra || "",

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

    prorroga: serializarProrroga(registroConHorasReales),
    cambios_extra: (registroConHorasReales.cambios || []).slice(5),
    cambios_rival_extra: cambiosRival.slice(5),
    modo_tiempo: registroBase.modoTiempo || "enVivo",
    captura_tiempo: serializarCapturaTiempo(registroBase),

    titulares: registroConHorasReales.formacion?.titulares || [],
    convocados: registroConHorasReales.formacion?.convocados || [],
  };
  };

  const guardarRegistro = async () => {
    if (guardandoRef.current) return;

    const erroresBasicos = validarRegistroBasico(registro);
    if (erroresBasicos.length > 0) {
      alert(erroresBasicos.join("\n"));
      return;
    }

    const nuevoRegistro = {
      ...registro,
      ...calcularTiemposRegistro(registro),
      varsPT: registro.varsPT || [{ inicio: "", final: "" }],
      varsST: registro.varsST || [{ inicio: "", final: "" }],
      varsPTE: registro.varsPTE || [{ inicio: "", final: "" }],
      varsSTE: registro.varsSTE || [{ inicio: "", final: "" }],
      noIngresaron: calcularNoIngresaron(registro.formacion, registro.cambios),
      guardadoEn: new Date().toISOString(),
    };
    const errorHorasInicio = validarHorasInicioTransmision(nuevoRegistro);
    if (errorHorasInicio) {
      alert(errorHorasInicio);
      return;
    }

    guardandoRef.current = true;
    setGuardando(true);

    const registroSupabase = construirFilaSupabase(nuevoRegistro);

    try {
      const coincidente = guardados.find(
        (item) => clavePartido(item) === clavePartido(nuevoRegistro),
      );
      const idExistente = nuevoRegistro.idSupabase || coincidente?.idSupabase;

      let respuesta = idExistente
        ? await supabase
            .from("registros_partido")
            .update(registroSupabase)
            .eq("id", idExistente)
            .select()
        : await supabase
            .from("registros_partido")
            .insert([registroSupabase])
            .select();

      if (
        respuesta.error &&
        esErrorColumnasExtendidas(respuesta.error) &&
        !tieneDatosExtendidos(nuevoRegistro)
      ) {
        const payloadBase = quitarCamposExtendidos(registroSupabase);
        respuesta = idExistente
          ? await supabase
              .from("registros_partido")
              .update(payloadBase)
              .eq("id", idExistente)
              .select()
          : await supabase
              .from("registros_partido")
              .insert([payloadBase])
              .select();
      }

      if (respuesta.error) {
        if (esErrorColumnasExtendidas(respuesta.error)) {
          console.error(
            "Faltan columnas en Supabase:",
            respuesta.error?.message || respuesta.error,
          );
          setGuardados(guardarPendiente(nuevoRegistro));
          avisarGuardado("Falta actualizar la base de datos", 6000);
          alert(
            "Falta ejecutar la migración de captura de tiempos en Supabase. El partido quedó guardado en este dispositivo.",
          );
          return;
        }

        // Antes se tiraba el error sin mirarlo, así que no había forma de
        // saber por qué fallaba.
        console.error(
          "No se pudo guardar el registro en Supabase:",
          respuesta.error?.message || respuesta.error,
          respuesta.error,
        );
        setGuardados(guardarPendiente(nuevoRegistro));
        avisarGuardado("Guardado en el celular · sin sincronizar", 6000);
        return;
      }

      const idGuardado = respuesta.data?.[0]?.id || idExistente;
      if (idGuardado) {
        setRegistro((prev) => ({ ...prev, idSupabase: idGuardado }));
      }

      await cargarRegistrosSupabase();
      avisarGuardado(
        idExistente ? "Partido actualizado" : "Partido guardado con éxito",
      );
    } catch (error) {
      console.error("Error de red al guardar el partido:", error);
      setGuardados(guardarPendiente(nuevoRegistro));
      avisarGuardado("Guardado en el celular · sin sincronizar", 6000);
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  };

  // Detalle de lo que está por borrarse, para no limpiar un partido por error.
  const resumenPartidoEnCurso = () => {
    const cambiosCargados = [
      ...(registro.cambios || []),
      ...(registro.cambiosRival || []),
    ].filter((cambio) => cambio?.sale?.trim() || cambio?.entra?.trim()).length;
    const rivalCargado = (registro.rival || "").trim();

    return (
      <>
        <Icono nombre="cambio" size={15} />
        {rivalCargado ? `vs ${rivalCargado}` : "Sin rival cargado"}
        <span>
          ·{" "}
          {cambiosCargados === 0
            ? "sin cambios"
            : cambiosCargados === 1
              ? "1 cambio cargado"
              : `${cambiosCargados} cambios cargados`}
        </span>
      </>
    );
  };

  const limpiarCarga = () => {
    setConfirmacion({
      titulo: "¿Borrar el partido en curso?",
      descripcion:
        "Se pierden la formación, los horarios y los cambios que cargaste. Los partidos ya guardados no se tocan.",
      detalle: resumenPartidoEnCurso(),
      onConfirmar: confirmarLimpiarCarga,
    });
  };

  const confirmarLimpiarCarga = () => {
    const nuevoRegistro = crearRegistroVacio();

    setRegistro(nuevoRegistro);
    setFormacionTemporal(nuevoRegistro.formacion);
    setFechaFormacion(nuevoRegistro.fecha);
    setPartidoEnCurso(false);
    setPantallaFormacion("inicio");

    try {
      localStorage.setItem(
        CLAVE_BORRADOR,
        JSON.stringify({ version: VERSION_BORRADOR, registro: nuevoRegistro }),
      );
    } catch (error) {
      console.warn("No se pudo limpiar el borrador local.");
    }
  };

  const volverAPantallaFormacion = () => {
    setFormacionTemporal(registro.formacion || crearFormacionVacia());
    setFechaFormacion(registro.fecha || fechaLocalISO());
    // No se marca partido en curso: ir a Formación no crea uno. El estado ya
    // viene en true si hay una formación cargada.
    setPantallaFormacion("inicio");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const convertirRegistroASupabase = (registroEditado) => {
    const registroParaGuardar = convertirRegistroAHorasReales(registroEditado);
    const cambiosRival =
      registroParaGuardar.cambiosRival || crearCambiosVacios();

    return {
      fecha: registroParaGuardar.fecha,
      rival: registroParaGuardar.rival,
      resultado: registroParaGuardar.resultado || "",

      inicio_pt: registroParaGuardar.inicioPT || "",
      final_pt: registroParaGuardar.finalPT || "",
      tiempo_pt: registroParaGuardar.tiempoPT || "",

      inicio_st: registroParaGuardar.inicioST || "",
      final_st: registroParaGuardar.finalST || "",
      tiempo_st: registroParaGuardar.tiempoST || "",

      inicio_var_pt_1: registroParaGuardar.varsPT?.[0]?.inicio || "",
      final_var_pt_1: registroParaGuardar.varsPT?.[0]?.final || "",
      inicio_var_pt_2: registroParaGuardar.varsPT?.[1]?.inicio || "",
      final_var_pt_2: registroParaGuardar.varsPT?.[1]?.final || "",
      inicio_var_pt_3: registroParaGuardar.varsPT?.[2]?.inicio || "",
      final_var_pt_3: registroParaGuardar.varsPT?.[2]?.final || "",

      inicio_var_st_1: registroParaGuardar.varsST?.[0]?.inicio || "",
      final_var_st_1: registroParaGuardar.varsST?.[0]?.final || "",
      inicio_var_st_2: registroParaGuardar.varsST?.[1]?.inicio || "",
      final_var_st_2: registroParaGuardar.varsST?.[1]?.final || "",
      inicio_var_st_3: registroParaGuardar.varsST?.[2]?.inicio || "",
      final_var_st_3: registroParaGuardar.varsST?.[2]?.final || "",

      inicio_hid_pt: registroParaGuardar.inicioHidratacionPT || "",
      final_hid_pt: registroParaGuardar.finalHidratacionPT || "",
      inicio_hid_st: registroParaGuardar.inicioHidratacionST || "",
      final_hid_st: registroParaGuardar.finalHidratacionST || "",

      cambio_1_tiempo: registroParaGuardar.cambios?.[0]?.hora || "",
      cambio_1_sale: registroParaGuardar.cambios?.[0]?.sale || "",
      cambio_1_entra: registroParaGuardar.cambios?.[0]?.entra || "",

      cambio_2_tiempo: registroParaGuardar.cambios?.[1]?.hora || "",
      cambio_2_sale: registroParaGuardar.cambios?.[1]?.sale || "",
      cambio_2_entra: registroParaGuardar.cambios?.[1]?.entra || "",

      cambio_3_tiempo: registroParaGuardar.cambios?.[2]?.hora || "",
      cambio_3_sale: registroParaGuardar.cambios?.[2]?.sale || "",
      cambio_3_entra: registroParaGuardar.cambios?.[2]?.entra || "",

      cambio_4_tiempo: registroParaGuardar.cambios?.[3]?.hora || "",
      cambio_4_sale: registroParaGuardar.cambios?.[3]?.sale || "",
      cambio_4_entra: registroParaGuardar.cambios?.[3]?.entra || "",

      cambio_5_tiempo: registroParaGuardar.cambios?.[4]?.hora || "",
      cambio_5_sale: registroParaGuardar.cambios?.[4]?.sale || "",
      cambio_5_entra: registroParaGuardar.cambios?.[4]?.entra || "",

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

      prorroga: serializarProrroga(registroParaGuardar),
      cambios_extra: (registroParaGuardar.cambios || []).slice(5),
      cambios_rival_extra: cambiosRival.slice(5),
      modo_tiempo: registroEditado.modoTiempo || "enVivo",
      captura_tiempo: serializarCapturaTiempo(registroEditado),

      titulares: registroParaGuardar.formacion?.titulares || [],
      convocados: registroParaGuardar.formacion?.convocados || [],
    };
  };
  const borrarHistorial = () => {
    setConfirmacion({
      titulo: "¿Borrar todos los registros?",
      descripcion:
        "Se borran de este teléfono y también de la base. No hay forma de recuperarlos.",
      detalle: (
        <>
          <Icono nombre="registros" size={15} />
          {guardados.length}{" "}
          {guardados.length === 1 ? "partido guardado" : "partidos guardados"}
        </>
      ),
      etiquetaConfirmar: "Sí, borrar todo",
      onConfirmar: confirmarBorrarHistorial,
    });
  };

  const confirmarBorrarHistorial = async () => {
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
    localStorage.removeItem(CLAVE_RESPALDO);
    localStorage.removeItem(CLAVE_PENDIENTES);
    setRegistroSeleccionado(null);
  };

  const eliminarRegistro = (indexAEliminar) => {
    const registro = guardados[indexAEliminar];

    setConfirmacion({
      titulo: "¿Eliminar este registro?",
      descripcion:
        "Se borra de este teléfono y también de la base. No hay forma de recuperarlo.",
      detalle: (
        <>
          <Icono nombre="cambio" size={15} />
          {registro?.rival?.trim() || "Sin rival"}
          <span>· {formatearFechaPantalla(registro?.fecha)}</span>
        </>
      ),
      etiquetaConfirmar: "Sí, eliminar",
      onConfirmar: () => confirmarEliminarRegistro(indexAEliminar),
    });
  };

  const confirmarEliminarRegistro = async (indexAEliminar) => {
    const registroAEliminar = guardados[indexAEliminar];

    if (!registroAEliminar?.idSupabase) {
      alert(
        "Este registro no tiene ID de Supabase. No se puede borrar de la base.",
      );
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

    const clave = clavePartido(registroAEliminar);
    escribirPendientes(
      leerPendientes().filter((item) => clavePartido(item) !== clave),
    );
    try {
      localStorage.setItem(
        CLAVE_RESPALDO,
        JSON.stringify({
          version: VERSION_BORRADOR,
          registros: leerRespaldoHistorial().filter(
            (item) => clavePartido(item) !== clave,
          ),
        }),
      );
    } catch (error) {
      console.warn("No se pudo actualizar el respaldo local del historial.");
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
        registroEditado.cambios,
      ),
      editadoEn: new Date().toISOString(),
      idSupabase: idRegistro,
    };

    const registroSupabase = convertirRegistroASupabase(registroConTiempos);

    let { data, error } = await supabase
      .from("registros_partido")
      .update(registroSupabase)
      .eq("id", idRegistro)
      .select();

    if (
      error &&
      esErrorColumnasExtendidas(error) &&
      !tieneDatosExtendidos(registroConTiempos)
    ) {
      const reintento = await supabase
        .from("registros_partido")
        .update(quitarCamposExtendidos(registroSupabase))
        .eq("id", idRegistro)
        .select();

      data = reintento.data;
      error = reintento.error;
    }

    if (error) {
      if (esErrorColumnasExtendidas(error)) {
        alert(
          "Falta ejecutar la migración de prórroga y cambios extra en Supabase antes de guardar estos datos.",
        );
        return false;
      }

      console.error("Error editando registro en Supabase:", error);
      alert("No se pudieron guardar los cambios en Supabase");
      return false;
    }

    if (!data || data.length === 0) {
      alert(
        "Supabase no actualizó ninguna fila. Revisá las políticas RLS de UPDATE.",
      );
      console.warn("UPDATE sin filas modificadas:", data);
      return false;
    }

    const registroActualizado = convertirSupabaseARegistro(data[0]);

    setGuardados((prev) =>
      prev.map((item) =>
        item.idSupabase === idRegistro ? registroActualizado : item,
      ),
    );

    setRegistroSeleccionado({
      item: registroActualizado,
      index: indexAEditar,
    });
    setDetalleBorrador(registroActualizado);
    setDetalleEditando(false);

    return true;
  };
  const cargarJsonp = (url, timeoutMs = 12000) => {
    return new Promise((resolve, reject) => {
      let urlSegura;
      try {
        urlSegura = new URL(url, window.location.href);
      } catch (error) {
        reject(new Error("La URL de integración no es válida"));
        return;
      }

      if (
        urlSegura.protocol !== "https:" ||
        urlSegura.hostname !== "script.google.com"
      ) {
        reject(new Error("Origen de integración no permitido"));
        return;
      }

      const callbackName = `jsonpCallback_${Date.now()}_${Math.floor(
        Math.random() * 100000,
      )}`;
      const script = document.createElement("script");
      let completado = false;
      let temporizador;

      const limpiar = () => {
        window.clearTimeout(temporizador);
        try {
          delete window[callbackName];
        } catch (error) {
          window[callbackName] = undefined;
        }
        script.remove();
      };

      const finalizar = (accion) => {
        if (completado) return;
        completado = true;
        limpiar();
        accion();
      };

      window[callbackName] = (data) => {
        const esRespuestaValida =
          data && typeof data === "object" && !Array.isArray(data);
        finalizar(() =>
          esRespuestaValida
            ? resolve(data)
            : reject(new Error("La integración devolvió datos inválidos")),
        );
      };

      urlSegura.searchParams.set("callback", callbackName);
      script.src = urlSegura.toString();
      script.async = true;
      script.referrerPolicy = "no-referrer";

      script.onerror = () => {
        finalizar(() =>
          reject(new Error("No se pudo conectar con Apps Script")),
        );
      };

      temporizador = window.setTimeout(
        () =>
          finalizar(() =>
            reject(new Error("La integración tardó demasiado en responder")),
          ),
        timeoutMs,
      );

      document.body.appendChild(script);
    });
  };
  const abrirCargaManual = () => {
    setMensajeFormacion("");
    setPantallaFormacion("manual");
  };

  const continuarConFormacion = () => {
    actualizarFormacion(formacionTemporal);
    setPartidoEnCurso(true);
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

  const renderCampoHora = ({ label, campo }) => (
    <div className="campo-hora">
      <label>{label}</label>

      <div className="fila-hora">
        <CampoTiempo
          value={registro[campo]}
          onChange={(valor) => actualizarCampoTiempo(campo, valor)}
          modoTiempo={registro.modoTiempo}
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

  const renderBloqueEvento = ({
    titulo,
    inicioCampo,
    finalCampo,
    duracion,
  }) => (
    <div className="bloque-evento">
      <div className="titulo-evento">
        <h3>{titulo}</h3>
        <span>{duracion || "-"}</span>
      </div>

      {renderCampoHora({ label: "Inicio", campo: inicioCampo })}
      {renderCampoHora({ label: "Final", campo: finalCampo })}
    </div>
  );

  const renderBloqueVarPeriodo = ({ tipo, titulo }) => {
    const config = obtenerConfigPeriodo(tipo);
    const vars = registro[config.vars] || [{ inicio: "", final: "" }];
    const activo = registro[config.activo] || 0;

    return (
      <div className="bloque-evento bloque-var-prorroga">
        <div className="titulo-evento">
          <h3>{titulo}</h3>
          <span>
            {formatearDuracion(
              segundosEntre(vars[activo]?.inicio, vars[activo]?.final),
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
            <CampoTiempo
              value={vars[activo]?.inicio || ""}
              onChange={(valor) => actualizarVar(tipo, "inicio", valor)}
              modoTiempo={registro.modoTiempo}
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
            <CampoTiempo
              value={vars[activo]?.final || ""}
              onChange={(valor) => actualizarVar(tipo, "final", valor)}
              modoTiempo={registro.modoTiempo}
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
  };

  const renderFormularioFormacion = () => {
    const cargados = (lista) =>
      (lista || []).filter((jugador) => String(jugador || "").trim()).length;

    // Dos columnas que se llenan hacia abajo, como una planilla: 1 a 5 a la
    // izquierda y 6 a 10 a la derecha. Las filas se calculan según cuántos
    // hay, para que no quede una columna vacía.
    const renderGrupo = (lista, prefijo, alCambiar) => (
      <div
        className="grilla-plantel"
        style={{
          gridTemplateRows: `repeat(${Math.max(1, Math.ceil(lista.length / 2))}, auto)`,
        }}
      >
        {lista.map((jugador, indice) => (
          <div className="fila-plantel" key={`${prefijo}-${indice}`}>
            <span className="numero-plantel" aria-hidden="true">
              {indice + 1}
            </span>
            <InputJugador
              value={jugador}
              placeholder={`${prefijo} ${indice + 1}`}
              onChange={(valor) => alCambiar(indice, valor)}
            />
          </div>
        ))}
      </div>
    );

    const titulares = cargados(formacionTemporal.titulares);
    const convocados = cargados(formacionTemporal.convocados);

    return (
      <div className="app app-formacion">
        <div className="contenedor contenedor-formacion">
          <header className="encabezado">
            <h1>Ingresar formación</h1>
            <p>Los 10 titulares de campo y los convocados que van al banco.</p>
          </header>

          <section className="tarjeta tarjeta-datos-partido">
            <div className="campo-inicio">
              <label htmlFor="fecha-formacion">Fecha del partido</label>
              <input
                id="fecha-formacion"
                type="date"
                value={fechaFormacion}
                onChange={(e) => setFechaFormacion(e.target.value)}
              />
            </div>

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
                <span className="descripcion-modo-tiempo">Hora actual</span>
              </button>
            </div>

            {mensajeFormacion && (
              <div className="aviso-formacion">{mensajeFormacion}</div>
            )}
          </section>

          <section className="tarjeta">
            <div className="titulo-plantel">
              <h2>Titulares de campo</h2>
              <span
                className={`contador-plantel ${
                  titulares === formacionTemporal.titulares.length
                    ? "completo"
                    : ""
                }`}
              >
                {titulares}/{formacionTemporal.titulares.length}
              </span>
            </div>

            {renderGrupo(
              formacionTemporal.titulares,
              "Titular",
              actualizarTitularTemporal,
            )}
          </section>

          <section className="tarjeta">
            <div className="titulo-plantel">
              <h2>Convocados al banco</h2>
              <span className="contador-plantel">{convocados}</span>
            </div>

            {renderGrupo(
              formacionTemporal.convocados,
              "Convocado",
              actualizarConvocadoTemporal,
            )}

            <button
              type="button"
              className="boton-agregar-jugador"
              onClick={agregarConvocadoTemporal}
            >
              + Agregar jugador
            </button>
          </section>

          <div className="acciones-formacion">
            <button
              type="button"
              className="boton-secundario"
              onClick={() => setPantallaFormacion("inicio")}
            >
              ← Volver
            </button>

            <button
              type="button"
              className="boton-principal"
              onClick={continuarConFormacion}
            >
              Guardar formación
            </button>
          </div>
        </div>
      </div>
    );
  };

  const fechaLargaFormacion = (() => {
    const fecha = new Date(`${fechaFormacion}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) return "";

    const texto = fecha.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  })();

  // Datos del partido en curso, con la misma forma que una fila de registros:
  // el enfrentamiento con los escudos, el resultado y los tiempos.
  const partidoEnCursoResumen = (() => {
    const periodos = ["PT", "ST", "PTE", "STE"];
    const enMarcha = periodos.find(
      (periodo) => registro[`inicio${periodo}`] && !registro[`final${periodo}`],
    );

    const cambiosCargados = [
      ...(registro.cambios || []),
      ...(registro.cambiosRival || []),
    ].filter((cambio) => cambio?.sale?.trim() || cambio?.entra?.trim()).length;

    // Un período todavía en juego no tiene duración: se avisa que está en
    // curso en vez de mostrar 00:00.
    const tiempos = periodos
      .filter((periodo) => registro[`inicio${periodo}`])
      .map((periodo) => ({
        periodo,
        valor:
          periodo === enMarcha
            ? "en curso"
            : formatearDuracion(resumen[`tiempo${periodo}`]) || "-",
      }));

    const [golesLocal = "", golesVisitante = ""] = String(
      registro.resultado || "",
    ).split("-");

    return {
      enMarcha,
      cambiosCargados,
      tiempos,
      marcador:
        golesLocal.trim() || golesVisitante.trim()
          ? `${golesLocal.trim() || "0"}-${golesVisitante.trim() || "0"}`
          : "",
    };
  })();

  const renderPantallaInicioFormacion = () => (
    <div className="app app-inicio">
      <div className="contenedor contenedor-inicio-formacion">
        <header className="hero-partido">
          <span className="etiqueta-hero">Próximo partido</span>

          <div className="enfrentamiento">
            <div className="lado-enfrentamiento">
              <EscudoClub
                equipo="cam"
                nombre={NOMBRE_CAM}
                url={escudoCam.url}
              />
              <strong>
                Atlético
                <br />
                Mineiro
              </strong>
            </div>

            <span className="separador-enfrentamiento">VS</span>

            <div
              className={`lado-enfrentamiento ${
                registro.rival?.trim() ? "" : "sin-cargar"
              }`}
            >
              <EscudoClub nombre={registro.rival} url={escudoRival.url} />
              <strong>{registro.rival?.trim() || "Elegí el rival"}</strong>
            </div>
          </div>

          {fechaLargaFormacion && (
            <p className="fecha-hero">{fechaLargaFormacion}</p>
          )}
        </header>

        <section className="tarjeta tarjeta-inicio">
          <div className="campo-inicio">
            <label htmlFor="campo-rival-inicio">Rival</label>
            <div className="campo-con-escudo">
              <EscudoClub
                nombre={registro.rival}
                url={escudoRival.url}
                mini
              />
              <input
                id="campo-rival-inicio"
                value={registro.rival}
                onChange={(evento) => actualizar("rival", evento.target.value)}
                placeholder="Nombre del rival"
              />
            </div>
          </div>

          <div className="campo-inicio">
            <label htmlFor="campo-fecha-inicio">Fecha del partido</label>
            <input
              id="campo-fecha-inicio"
              type="date"
              value={fechaFormacion}
              onChange={(e) => setFechaFormacion(e.target.value)}
            />
          </div>

          {mensajeFormacion && (
            <div className="aviso-formacion">{mensajeFormacion}</div>
          )}

          <div className="acciones-inicio">
            <button
              type="button"
              className="boton-principal boton-formacion-grande"
              onClick={abrirCargaManual}
            >
              Ingresar Formación
            </button>
          </div>
        </section>

        {partidoEnCurso && (
          <button
            type="button"
            className="tarjeta-en-curso"
            onClick={() => setPantallaFormacion("lista")}
          >
            <span className="cabecera-en-curso">
              <span
                className={`pastilla-vivo ${
                  partidoEnCursoResumen.enMarcha ? "" : "sin-empezar"
                }`}
              >
                <i aria-hidden="true" />
                {partidoEnCursoResumen.enMarcha ? "EN VIVO" : "SIN EMPEZAR"}
              </span>
              <span className="fecha-registro">
                {formatearFechaPantalla(registro.fecha)}
              </span>
            </span>

            <span className="enfrentamiento-registro">
              <EscudoClub
                equipo="cam"
                nombre={NOMBRE_CAM}
                url={escudoCam.url}
                compacto
              />
              <strong>Atlético Mineiro</strong>
              {partidoEnCursoResumen.marcador && (
                <span className="resultado-registro">
                  {partidoEnCursoResumen.marcador}
                </span>
              )}
              <strong>{registro.rival?.trim() || "Sin rival"}</strong>
              <EscudoClub nombre={registro.rival} url={escudoRival.url} mini />
            </span>

            {(partidoEnCursoResumen.tiempos.length > 0 ||
              partidoEnCursoResumen.cambiosCargados > 0) && (
              <span className="tiempos-registro">
                {partidoEnCursoResumen.tiempos.map(({ periodo, valor }) => (
                  <span key={periodo}>
                    {periodo} <strong>{valor}</strong>
                  </span>
                ))}
                {partidoEnCursoResumen.cambiosCargados > 0 && (
                  <span>
                    CAMBIOS{" "}
                    <strong>{partidoEnCursoResumen.cambiosCargados}</strong>
                  </span>
                )}
              </span>
            )}

            <span className="ir-al-partido">
              Volver al partido
              <span aria-hidden="true">›</span>
            </span>
          </button>
        )}

        <EstadoVersionApp
          actualizacionDisponible={actualizacionDisponible}
          onActualizar={actualizarAplicacion}
        />
      </div>
    </div>
  );

  const actualizarAplicacion = async () => {
    try {
      if ("caches" in window) {
        const nombresCache = await window.caches.keys();
        await Promise.all(
          nombresCache.map((nombreCache) => window.caches.delete(nombreCache)),
        );
      }
    } catch (error) {
      console.warn("No se pudo limpiar la caché antes de actualizar:", error);
    }

    const urlActualizada = new URL(window.location.href);
    urlActualizada.searchParams.set("actualizar", Date.now().toString());
    window.location.replace(urlActualizada.toString());
  };

  const renderCampoDetalleEditable = ({
    label,
    type = "text",
    value,
    onChange,
  }) => {
    // Un partido de transmisión guardado ya tiene horarios, así que se edita
    // con el campo de hora común. La guía en minutos solo aparece mientras el
    // valor todavía es una guía.
    const usarTransmision =
      type === "time" &&
      esFormatoTransmision(value) &&
      !esFormatoHoraReal(value);

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

  /**
   * La ficha de un registro guardado. Está pensada para leer los horarios de
   * corte de un vistazo: el tiempo elegido manda una lista cronológica, y el
   * botón de bruto/neto cambia todos los números a la vez.
   */
  /**
   * La ficha de un registro guardado. Está pensada para leer los horarios de
   * corte de un vistazo.
   *
   * Arriba se elige qué tiempo mirar; abajo van tres interruptores que no se
   * pisan entre sí: de quién son los cambios, si los números van en bruto o en
   * neto, y si la tarjeta de cambios se adelanta a la línea de tiempo.
   */
  const renderFichaRegistro = ({ item, alVolver, alEditar }) => {
    const resumen = resumenDeTiempos(item);
    const { jugadores, resto } = tiempoJugado(item);

    const [golesCam = "", golesContra = ""] = String(item.resultado || "")
      .split(/\s*[-\u2013:]\s*/)
      .slice(0, 2);

    // Los botones de tiempo están siempre, aunque uno no tenga datos: si no, un
    // registro viejo a medio cargar se queda sin nada que tocar.
    const tiempos = periodosDelRegistro(item);
    const vista = tiempos.includes(vistaFicha) ? vistaFicha : "PT";
    const periodo = resumen.periodos.find((item2) => item2.tipo === vista);

    const lista = fichaDelRival ? "cambiosRival" : "cambios";
    const cortes = cortesDePeriodo(item, vista, lista);
    const cambios = cortes.filter((corte) => corte.clase === "cambio");

    const etiquetaModo = fichaEnNeto ? "Neto" : "Bruto";
    const enModo = (valores) => (fichaEnNeto ? valores.neto : valores.bruto);
    const duracion = (segundos) => formatearMinutosSegundos(segundos) || "--:--";
    const nombreRival = item.rival || "Rival";

    // Deja claro de quién es lo que se está mirando cuando no son los nuestros.
    const marcaRival = fichaDelRival ? (
      <span className="marca-rival">
        <EscudoDeClub nombre={item.rival} mini />
        {nombreRival}
      </span>
    ) : null;

    // Cada cambio es un renglón: el que sale y el que entra pegados, como se
    // lee un cambio. Si no entran, se recortan antes que partirse en dos.
    const renderPares = (pares, llave) => (
      <span className="pares-corte">
        {pares.map((par, i) => (
          <span className="par-corte" key={`${llave}-${i}`}>
            <span className="sale-corte">↓ {par.sale || "-"}</span>
            <span className="entra-corte">↑ {par.entra || "-"}</span>
          </span>
        ))}
      </span>
    );

    const renderCorte = (corte, i) => {
      if (corte.clase === "cambio") {
        return (
          <li className="corte corte-cambio" key={`corte-${i}`}>
            <span className="cabeza-corte">
              <span className="punto-corte cambio" />
              <span className="hora-corte">{corte.hora}</span>
            </span>
            {renderPares(corte.pares, i)}
          </li>
        );
      }

      const hasta = corte.hasta ? `→ ${corte.hasta}` : "";
      const medida = formatearMinutosSegundos(corte.duracion);

      return (
        <li className={`corte corte-${corte.clase}`} key={`corte-${i}`}>
          <span className="hora-corte">{corte.hora || "--:--:--"}</span>
          <span className="punto-corte" />
          <span className="nombre-corte">{corte.etiqueta}</span>
          {(hasta || medida) && (
            <span className="detalle-corte">
              {[hasta, medida].filter(Boolean).join(" · ")}
            </span>
          )}
        </li>
      );
    };

    const tarjetaLinea = (
      <section className="tarjeta tarjeta-ficha" key="linea">
        <div className="cabeza-ficha">
          <b>{nombrePeriodo(vista)}</b>
          <span className="et">{etiquetaModo.toUpperCase()}</span>
          {marcaRival}
          <em className={fichaEnNeto ? "neto" : ""}>
            {periodo ? duracion(enModo(periodo)) : "--:--"}
          </em>
        </div>

        {periodo ? (
          <ul className="cortes">{cortes.map(renderCorte)}</ul>
        ) : (
          <p className="vacio-ficha">Este tiempo no se cargó.</p>
        )}
      </section>
    );

    // La tarjeta de cambios solo aparece cuando se la pide: apagada repetiría
    // tal cual lo que ya está en la línea de tiempo.
    const tarjetaCambios = fichaCambiosArriba ? (
      <section className="tarjeta tarjeta-ficha" key="cambios">
        <div className="cabeza-ficha">
          <b>Cambios del {vista}</b>
          {marcaRival || (
            <span className="et cuenta-cambios">
              {cambios.length === 0
                ? "SIN CAMBIOS"
                : `${cambios.reduce((total, c) => total + c.pares.length, 0)} CAMBIOS`}
            </span>
          )}
        </div>

        {cambios.length === 0 ? (
          <p className="vacio-ficha">
            {fichaDelRival
              ? `No se cargó ningún cambio de ${nombreRival} en este tiempo.`
              : "No hubo cambios en este tiempo."}
          </p>
        ) : (
          <ul className="cortes">{cambios.map(renderCorte)}</ul>
        )}
      </section>
    ) : null;

    return (
      <div className="app">
        <div className="contenedor ficha-registro">
          <section className="marcador-ficha" aria-label="Resultado del partido">
            <div className="equipos-ficha">
              <div className="equipo-ficha">
                <EscudoDeClub equipo="cam" nombre={NOMBRE_CAM} />
                <strong>Atlético Mineiro</strong>
              </div>

              <div className="resultado-ficha">
                <b>{golesCam.trim() || "0"}</b>
                <span>—</span>
                <b>{golesContra.trim() || "0"}</b>
              </div>

              <div className="equipo-ficha">
                <EscudoDeClub nombre={item.rival} />
                <strong>{nombreRival}</strong>
              </div>
            </div>

            <div className={`total-ficha ${fichaEnNeto ? "neto" : ""}`}>
              <b>{duracion(enModo(resumen.total))}</b>
              <small>{etiquetaModo.toUpperCase()}</small>
            </div>
          </section>

          {/* Qué tiempo mirar: uno a la vez. */}
          <section className="selector-periodos en-ficha" aria-label="Qué tiempo">
            <div role="tablist">
              {tiempos.map((tipo) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={vista === tipo}
                  className={vista === tipo ? "activo" : ""}
                  onClick={() => setVistaFicha(tipo)}
                  key={tipo}
                >
                  {tipo}
                  {Boolean(item[`inicio${tipo}`] && item[`final${tipo}`]) && (
                    <Icono nombre="check" size={15} />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Cómo mirarlo: tres interruptores que no se pisan entre sí. */}
          <section
            className="selector-periodos en-ficha interruptores"
            aria-label="Cómo mirarlo"
          >
            <div>
              <button
                type="button"
                className={`boton-rival-ficha ${fichaDelRival ? "activo" : ""}`}
                onClick={() => setFichaDelRival((previo) => !previo)}
                aria-pressed={fichaDelRival}
              >
                <EscudoDeClub nombre={item.rival} mini />
                Rival
              </button>

              <button
                type="button"
                className={`boton-modo-ficha ${fichaEnNeto ? "neto" : ""}`}
                onClick={() => setFichaEnNeto((previo) => !previo)}
                aria-pressed={fichaEnNeto}
              >
                <Icono nombre="cambio" size={14} />
                {etiquetaModo}
              </button>

              <button
                type="button"
                className={fichaCambiosArriba ? "activo" : ""}
                onClick={() => setFichaCambiosArriba((previo) => !previo)}
                aria-pressed={fichaCambiosArriba}
              >
                <Icono nombre="subir" size={14} />
                Cambios
              </button>
            </div>
          </section>

          {[tarjetaCambios, tarjetaLinea].filter(Boolean)}

          {(jugadores.length > 0 || resto) && (
            <section className="tarjeta tarjeta-ficha">
              <table className="tabla-jugados">
                <thead>
                  <tr>
                    <th>TIEMPO JUGADO</th>
                    <th>{etiquetaModo.toUpperCase()}</th>
                  </tr>
                </thead>
                <tbody>
                  {jugadores.map((jugador, i) => (
                    <tr key={`jugado-${i}`}>
                      <td>
                        <span className="quien-jugado">{jugador.nombre}</span>
                        {jugador.salio && (
                          <span className="cuando-jugado sale-corte">
                            ↓ {jugador.salio}
                          </span>
                        )}
                        {jugador.entro && (
                          <span className="cuando-jugado entra-corte">
                            ↑ {jugador.entro}
                          </span>
                        )}
                      </td>
                      <td className={`valor-jugado ${fichaEnNeto ? "neto" : ""}`}>
                        {duracion(enModo(jugador))}
                      </td>
                    </tr>
                  ))}

                  {resto && (
                    <tr className="fila-resto">
                      <td>
                        <span className="quien-jugado">
                          {resto.cantidad === 1
                            ? "El otro titular"
                            : `Los otros ${resto.cantidad} titulares`}
                        </span>
                        <span className="cuando-jugado">partido completo</span>
                      </td>
                      <td className={`valor-jugado ${fichaEnNeto ? "neto" : ""}`}>
                        {duracion(enModo(resto))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          <div className="acciones-dobles">
            <button type="button" className="boton-secundario" onClick={alVolver}>
              ← Volver
            </button>

            <button type="button" className="boton-principal" onClick={alEditar}>
              Editar registro
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDetalleRegistro = ({ item, index }) => {
    const registroDetalleBase = {
      ...item,
      cambios: item.cambios || crearCambiosVacios(),
      cambiosRival: item.cambiosRival || crearCambiosVacios(),
      formacion: item.formacion || crearFormacionVacia(),
    };
    const editando = detalleEditando;
    const setEditando = setDetalleEditando;
    const editado = detalleBorrador || registroDetalleBase;
    const setEditado = setDetalleBorrador;

    if (!editando) {
      return renderFichaRegistro({
        item: registroDetalleBase,
        alVolver: () => {
          setRegistroSeleccionado(null);
          setDetalleBorrador(null);
          setDetalleEditando(false);
        },
        alEditar: () => {
          setEditado(registroDetalleBase);
          setEditando(true);
        },
      });
    }

    const tiemposEditados = calcularTiemposRegistro(editado);
    const cambios = editado.cambios || crearCambiosVacios();
    const cambiosRival = editado.cambiosRival || crearCambiosVacios();
    const noIngresaronDetalle = calcularNoIngresaron(
      editado.formacion,
      editado.cambios,
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
                {renderCampoDetalleEditable({
                  label: "Fecha",
                  type: "date",
                  value: editado.fecha,
                  onChange: (valor) => actualizarEditado("fecha", valor),
                })}

                {renderCampoDetalleEditable({
                  label: "Rival",
                  value: editado.rival,
                  onChange: (valor) => actualizarEditado("rival", valor),
                })}

                {renderCampoDetalleEditable({
                  label: "Resultado",
                  value: editado.resultado,
                  onChange: (valor) => actualizarEditado("resultado", valor),
                })}
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
                    <div
                      className="columna-formacion"
                      key={`edit-titulares-col-${inicioColumna}`}
                    >
                      {(editado.formacion?.titulares || [])
                        .slice(inicioColumna, inicioColumna + 5)
                        .map((jugador, index) => {
                          const jugadorIndex = inicioColumna + index;

                          return (
                            <div
                              className="campo-formacion"
                              key={`edit-titular-${jugadorIndex}`}
                            >
                              <label>Titular {jugadorIndex + 1}</label>
                              <InputJugador
                                value={jugador}
                                onChange={(valor) => {
                                  setEditado((prev) => {
                                    const nuevaFormacion =
                                      prev.formacion || crearFormacionVacia();
                                    const nuevosTitulares = [
                                      ...(nuevaFormacion.titulares || []),
                                    ];

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
                    <div
                      className="columna-formacion"
                      key={`edit-convocados-col-${inicioColumna}`}
                    >
                      {(editado.formacion?.convocados || [])
                        .slice(inicioColumna, inicioColumna + 6)
                        .map((jugador, index) => {
                          const jugadorIndex = inicioColumna + index;

                          return (
                            <div
                              className="campo-formacion"
                              key={`edit-convocado-${jugadorIndex}`}
                            >
                              <label>Convocado {jugadorIndex + 1}</label>
                              <InputJugador
                                value={jugador}
                                onChange={(valor) => {
                                  setEditado((prev) => {
                                    const nuevaFormacion =
                                      prev.formacion || crearFormacionVacia();
                                    const nuevosConvocados = [
                                      ...(nuevaFormacion.convocados || []),
                                    ];

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
                      const nuevaFormacion =
                        prev.formacion || crearFormacionVacia();

                      return {
                        ...prev,
                        formacion: {
                          ...nuevaFormacion,
                          convocados: [
                            ...(nuevaFormacion.convocados || []),
                            "",
                          ],
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
                {renderCampoDetalleEditable({
                  label: "Inicio PT",
                  type: "time",
                  value: editado.inicioPT,
                  onChange: (valor) => actualizarEditado("inicioPT", valor),
                })}
                {renderCampoDetalleEditable({
                  label: "Final PT",
                  type: "time",
                  value: editado.finalPT,
                  onChange: (valor) => actualizarEditado("finalPT", valor),
                })}
                <DatoDetalle
                  label="Tiempo PT"
                  valor={tiemposEditados.tiempoPT}
                />

                {renderCampoDetalleEditable({
                  label: "Inicio VAR PT",
                  type: "time",
                  value: editado.varsPT?.[0]?.inicio || "",
                  onChange: (valor) => {
                    const nuevasVars = [
                      ...(editado.varsPT || [{ inicio: "", final: "" }]),
                    ];
                    nuevasVars[0] = {
                      ...(nuevasVars[0] || {}),
                      inicio: valor,
                    };
                    actualizarEditado("varsPT", nuevasVars);
                  },
                })}

                {renderCampoDetalleEditable({
                  label: "Final VAR PT",
                  type: "time",
                  value: editado.varsPT?.[0]?.final || "",
                  onChange: (valor) => {
                    const nuevasVars = [
                      ...(editado.varsPT || [{ inicio: "", final: "" }]),
                    ];
                    nuevasVars[0] = {
                      ...(nuevasVars[0] || {}),
                      final: valor,
                    };
                    actualizarEditado("varsPT", nuevasVars);
                  },
                })}
                <DatoDetalle
                  label="Tiempo VAR PT"
                  valor={tiemposEditados.tiempoVarPT}
                />

                {renderCampoDetalleEditable({
                  label: "Inicio Hidratación PT",
                  type: "time",
                  value: editado.inicioHidratacionPT,
                  onChange: (valor) =>
                    actualizarEditado("inicioHidratacionPT", valor),
                })}
                {renderCampoDetalleEditable({
                  label: "Final Hidratación PT",
                  type: "time",
                  value: editado.finalHidratacionPT,
                  onChange: (valor) =>
                    actualizarEditado("finalHidratacionPT", valor),
                })}
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

                {(
                  editado.varsPT || [
                    { inicio: editado.inicioVarPT, final: editado.finalVarPT },
                  ]
                )
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

                {(editado.inicioHidratacionPT ||
                  editado.finalHidratacionPT) && (
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
                {renderCampoDetalleEditable({
                  label: "Inicio ST",
                  type: "time",
                  value: editado.inicioST,
                  onChange: (valor) => actualizarEditado("inicioST", valor),
                })}
                {renderCampoDetalleEditable({
                  label: "Final ST",
                  type: "time",
                  value: editado.finalST,
                  onChange: (valor) => actualizarEditado("finalST", valor),
                })}
                <DatoDetalle
                  label="Tiempo ST"
                  valor={tiemposEditados.tiempoST}
                />

                {renderCampoDetalleEditable({
                  label: "Inicio VAR ST",
                  type: "time",
                  value: editado.varsST?.[0]?.inicio || "",
                  onChange: (valor) => {
                    const nuevasVars = [
                      ...(editado.varsST || [{ inicio: "", final: "" }]),
                    ];
                    nuevasVars[0] = {
                      ...(nuevasVars[0] || {}),
                      inicio: valor,
                    };
                    actualizarEditado("varsST", nuevasVars);
                  },
                })}

                {renderCampoDetalleEditable({
                  label: "Final VAR ST",
                  type: "time",
                  value: editado.varsST?.[0]?.final || "",
                  onChange: (valor) => {
                    const nuevasVars = [
                      ...(editado.varsST || [{ inicio: "", final: "" }]),
                    ];
                    nuevasVars[0] = {
                      ...(nuevasVars[0] || {}),
                      final: valor,
                    };
                    actualizarEditado("varsST", nuevasVars);
                  },
                })}
                <DatoDetalle
                  label="Tiempo VAR ST"
                  valor={tiemposEditados.tiempoVarST}
                />

                {renderCampoDetalleEditable({
                  label: "Inicio Hidratación ST",
                  type: "time",
                  value: editado.inicioHidratacionST,
                  onChange: (valor) =>
                    actualizarEditado("inicioHidratacionST", valor),
                })}
                {renderCampoDetalleEditable({
                  label: "Final Hidratación ST",
                  type: "time",
                  value: editado.finalHidratacionST,
                  onChange: (valor) =>
                    actualizarEditado("finalHidratacionST", valor),
                })}
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

                {(
                  editado.varsST || [
                    { inicio: editado.inicioVarST, final: editado.finalVarST },
                  ]
                )
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

                {(editado.inicioHidratacionST ||
                  editado.finalHidratacionST) && (
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

          {editado.prorrogaActiva && (
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
                      <div
                        className="var-detalle"
                        key={`detalle-pte-${varIndex}`}
                      >
                        <div className="var-detalle-header">
                          <span>VAR PTE {varIndex + 1}</span>
                          <span className="var-detalle-tempo">
                            {formatearDuracion(
                              segundosEntre(item.inicio, item.final),
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
                      <div
                        className="var-detalle"
                        key={`detalle-ste-${varIndex}`}
                      >
                        <div className="var-detalle-header">
                          <span>VAR STE {varIndex + 1}</span>
                          <span className="var-detalle-tempo">
                            {formatearDuracion(
                              segundosEntre(item.inicio, item.final),
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
            <h2>Cambios</h2>

            <div className="tabla-detalle-cambios">
              <div className="fila-detalle-cambio encabezado-detalle-cambios">
                <div>Cambio</div>
                <div>Sale</div>
                <div>Entra</div>
                <div>Hora</div>
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
                        <CampoTiempo
                          value={cambio.hora || ""}
                          onChange={(valor) =>
                            actualizarCambioEditado(cambioIndex, "hora", valor)
                          }
                          modoTiempo={editado.modoTiempo}
                          className="input-hora-cambio-detalle"
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
                <div>Hora</div>
              </div>

              {cambiosRival.map((cambio, cambioIndex) => (
                <div
                  className="fila-detalle-cambio"
                  key={`rival-${cambioIndex}`}
                >
                  <div>{cambioIndex + 1}</div>

                  <div>
                    {editando ? (
                      <InputJugadorRival
                        opciones={opcionesJugadoresRival}
                        value={cambio.sale || ""}
                        onChange={(valor) =>
                          actualizarCambioRivalEditado(
                            cambioIndex,
                            "sale",
                            valor,
                          )
                        }
                      />
                    ) : (
                      cambio.sale || "-"
                    )}
                  </div>

                  <div>
                    {editando ? (
                      <InputJugadorRival
                        opciones={opcionesJugadoresRival}
                        value={cambio.entra || ""}
                        onChange={(valor) =>
                          actualizarCambioRivalEditado(
                            cambioIndex,
                            "entra",
                            valor,
                          )
                        }
                      />
                    ) : (
                      cambio.entra || "-"
                    )}
                  </div>

                  <div>
                    {editando ? (
                      <div className="celda-hora-detalle-editable">
                        <CampoTiempo
                          value={cambio.hora || ""}
                          onChange={(valor) =>
                            actualizarCambioRivalEditado(
                              cambioIndex,
                              "hora",
                              valor,
                            )
                          }
                          modoTiempo={editado.modoTiempo}
                          className="input-hora-cambio-detalle"
                        />

                        <button
                          type="button"
                          className="boton-entretiempo-detalle"
                          onClick={() => {
                            if (!editado.inicioST) {
                              alert("Primero cargá Inicio ST.");
                              return;
                            }

                            actualizarCambioRivalEditado(
                              cambioIndex,
                              "hora",
                              editado.inicioST,
                            );
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
                onClick={() => {
                  setRegistroSeleccionado(null);
                  setDetalleBorrador(null);
                  setDetalleEditando(false);
                }}
              >
                ← Volver
              </button>

              <button
                type="button"
                className="boton-principal"
                onClick={() => {
                  setEditado(registroDetalleBase);
                  setEditando(true);
                }}
              >
                Editar registro
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const navegarAplicacion = (destino) => {
    setRegistroSeleccionado(null);
    setDetalleBorrador(null);
    setDetalleEditando(false);

    if (destino === "partido") {
      setPantallaFormacion("lista");
    } else if (destino === "formacion") {
      volverAPantallaFormacion();
    } else if (destino === "registros") {
      setPantallaFormacion("registros");
    }
  };

  const formatearFechaPantalla = (fecha) => {
    if (!fecha) return "Sin fecha";
    const valor = new Date(`${fecha}T12:00:00`);
    if (Number.isNaN(valor.getTime())) return fecha;
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
      .format(valor)
      .replace(".", "");
  };

  const [golesAtletico = "", golesRival = ""] = String(registro.resultado || "")
    .split(/\s*[-–:]\s*/)
    .slice(0, 2);

  const actualizarMarcador = (equipo, valor) => {
    const goles = String(valor || "")
      .replace(/\D/g, "")
      .slice(0, 2);
    const local = equipo === "atletico" ? goles : golesAtletico || "0";
    const visita = equipo === "rival" ? goles : golesRival || "0";
    actualizar("resultado", `${local || 0}-${visita || 0}`);
  };

  const datosPeriodoVista = obtenerConfigPeriodo(periodoVista);
  const periodoIniciado = Boolean(registro[datosPeriodoVista.inicio]);
  const periodoFinalizado = Boolean(registro[datosPeriodoVista.final]);
  // Borra el final del período para que el reloj vuelva a correr, por si se
  // tocó "Finalizar" sin querer.
  const reanudarPeriodo = () => {
    mantenerPosicion(() =>
      setRegistro((prev) => ({
        ...prev,
        [datosPeriodoVista.final]: "",
        [datosPeriodoVista.horaFinalReal]: "",
      })),
    );
  };

  const ejecutarAccionPeriodo = () => {
    if (!periodoIniciado) {
      ponerAhora(datosPeriodoVista.inicio);
      return;
    }

    if (periodoFinalizado) {
      reanudarPeriodo();
      return;
    }

    ponerAhora(datosPeriodoVista.final);
  };

  const varActual =
    registro[datosPeriodoVista.vars]?.[
      registro[datosPeriodoVista.activo] || 0
    ] || {};

  const alternarVarRapido = () => {
    const marca = obtenerMarcaActual(periodoVista);
    if (!marca) {
      alert(`Primero marcá Inicio ${periodoVista}.`);
      return;
    }

    setRegistro((prev) => {
      const config = obtenerConfigPeriodo(periodoVista);
      const eventos = [...(prev[config.vars] || [{ inicio: "", final: "" }])];
      let activo = prev[config.activo] || 0;
      let evento = eventos[activo] || { inicio: "", final: "" };

      if (evento.inicio && evento.final && eventos.length < 3) {
        eventos.push({ inicio: marca, final: "" });
        activo = eventos.length - 1;
      } else if (!evento.inicio) {
        eventos[activo] = { ...evento, inicio: marca };
      } else if (!evento.final) {
        eventos[activo] = { ...evento, final: marca };
      }

      return { ...prev, [config.vars]: eventos, [config.activo]: activo };
    });
    setTimeout(quitarFoco, 0);
  };

  const campoInicioHidratacion = `inicioHidratacion${periodoVista}`;
  const campoFinalHidratacion = `finalHidratacion${periodoVista}`;
  const hidratacionIniciada = Boolean(registro[campoInicioHidratacion]);
  const hidratacionFinalizada = Boolean(registro[campoFinalHidratacion]);

  const alternarHidratacionRapida = () => {
    if (hidratacionFinalizada) return;
    ponerAhora(
      hidratacionIniciada ? campoFinalHidratacion : campoInicioHidratacion,
    );
  };

  // Los dos ítems del período: el VAR (con sus hasta tres marcas) y la
  // hidratación, con inicio, fin y duración a la vista.
  const renderItemsPeriodo = () => {
    const vacio = registro.modoTiempo === "transmision" ? "---:--" : "--:--:--";

    const renderRango = (inicio, final) => (
      <span className="rango-item">
        {inicio ? (
          <strong>{inicio}</strong>
        ) : (
          <span className="pendiente">{vacio}</span>
        )}
        <span className="flecha">→</span>
        {final ? (
          <strong>{final}</strong>
        ) : (
          <span className="pendiente">{vacio}</span>
        )}
      </span>
    );

    const vars = registro[datosPeriodoVista.vars] || [
      { inicio: "", final: "" },
    ];
    const varActivo = registro[datosPeriodoVista.activo] || 0;
    const varMostrado = vars[varActivo] || { inicio: "", final: "" };

    return (
      <div className="items-periodo">
        <section className="item-periodo var">
          <span className="cabecera-item">
            <span className="rotulo-item">
              <span className="ico">
                <Icono nombre="var" size={14} />
              </span>{" "}
              VAR
            </span>
          </span>

          {vars.length > 1 && (
            <span
              className="chips-var"
              role="tablist"
              aria-label="Marcas de VAR"
            >
              {vars.map((marca, indice) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={varActivo === indice}
                  className={`${varActivo === indice ? "activo" : ""} ${
                    marca.inicio && !marca.final ? "corriendo" : ""
                  }`}
                  onClick={() => cambiarVarActivo(periodoVista, indice)}
                  key={`var-${periodoVista}-${indice}`}
                >
                  {indice + 1}
                </button>
              ))}
            </span>
          )}

          {renderRango(varMostrado.inicio, varMostrado.final)}

          <span className="duracion-item">
            {formatearDuracion(
              segundosEntre(varMostrado.inicio, varMostrado.final),
            ) || "--:--"}
          </span>
        </section>

        <section className="item-periodo hidratacion">
          <span className="cabecera-item">
            <span className="rotulo-item">
              <span className="ico">
                <Icono nombre="hidratacion" size={14} />
              </span>{" "}
              HIDRATACIÓN
            </span>
          </span>

          {renderRango(
            registro[campoInicioHidratacion],
            registro[campoFinalHidratacion],
          )}

          <span className="duracion-item">
            {formatearDuracion(
              segundosEntre(
                registro[campoInicioHidratacion],
                registro[campoFinalHidratacion],
              ),
            ) || "--:--"}
          </span>
        </section>
      </div>
    );
  };

  const mostrarPanelCambios = () => {
    setEquipoCambios("atletico");
    window.setTimeout(
      () =>
        document
          .getElementById("panel-cambios")
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      0,
    );
  };

  const limpiarFilaCambio = (tipo, index) => {
    const clave = tipo === "rival" ? "cambiosRival" : "cambios";
    setRegistro((prev) => {
      const cambios = [...(prev[clave] || crearCambiosVacios())];
      cambios[index] = crearCambioVacio();
      return { ...prev, [clave]: cambios };
    });
  };

  const renderPanelCambiosOperativo = () => {
    const esRival = equipoCambios === "rival";
    const lista = esRival ? registro.cambiosRival : registro.cambios;
    const ultimoConDatos = (lista || []).reduce(
      (ultimo, cambio, index) =>
        cambio.sale || cambio.entra || cambio.hora ? index : ultimo,
      -1,
    );
    // Cinco cambios reglamentarios, más el sexto habilitado por la prórroga.
    // Si un registro viejo trae más, se muestran igual para no esconder datos.
    const minimoRanuras =
      CAMBIOS_SIEMPRE_VISIBLES + (registro.prorrogaActiva ? 1 : 0);
    const cantidad = Math.max(minimoRanuras, ultimoConDatos + 1);
    const ranuras = Array.from(
      { length: cantidad },
      (_, indice) => (lista || [])[indice] || crearCambioVacio(),
    );

    // Quién puede salir y quién puede entrar, según cómo viene el partido.
    // Se calcula una vez para todas las filas, no una por fila.
    const enCancha = jugadoresParaCambio({
      campo: "sale",
      formacion: registro.formacion,
      cambios: registro.cambios,
      plantel: jugadores,
    });
    const enBanco = jugadoresParaCambio({
      campo: "entra",
      formacion: registro.formacion,
      cambios: registro.cambios,
      plantel: jugadores,
    });

    return (
      <section
        className={`panel-operativo panel-cambios-operativo ${
          esRival ? "cambios-rival" : ""
        }`}
        id="panel-cambios"
      >
        <div className="panel-titulo">
          <div>
            <span className="sobrelinea">PARTIDO</span>
            <h2>Cambios</h2>
          </div>
          {esRival && (
            <button
              type="button"
              className="boton-texto"
              onClick={async () => {
                await importarJugadoresRival();
                await recomendarHorariosCambioRival();
              }}
            >
              Importar rival
            </button>
          )}
        </div>

        <div
          className="selector-equipo"
          role="tablist"
          aria-label="Equipo de los cambios"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!esRival}
            className={!esRival ? "activo" : ""}
            onClick={() => setEquipoCambios("atletico")}
          >
            <EscudoClub
              equipo="cam"
              nombre={NOMBRE_CAM}
              url={escudoCam.url}
              compacto
            />{" "}
            Atlético Mineiro
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={esRival}
            className={esRival ? "activo rival" : ""}
            onClick={() => setEquipoCambios("rival")}
          >
            <EscudoClub nombre={registro.rival} url={escudoRival.url} mini />{" "}
            {registro.rival || "Rival"}
          </button>
        </div>

        <div className="lista-cambios-operativa">
          {ranuras.map((cambio, index) => {
            const cargado = Boolean(cambio.sale || cambio.entra || cambio.hora);

            return (
              <div
                className={`ranura-cambio ${cargado ? "cargada" : ""}`}
                key={`${equipoCambios}-${index}`}
              >
                <div className="columna-ranura">
                  <span className="numero-ranura">{index + 1}</span>
                  {cargado && (
                    <button
                      type="button"
                      className="limpiar-ranura"
                      aria-label={`Limpiar cambio ${index + 1}`}
                      onClick={() =>
                        limpiarFilaCambio(esRival ? "rival" : "atletico", index)
                      }
                    >
                      <Icono nombre="borrar" size={14} />
                    </button>
                  )}
                </div>

                <div className="par-jugadores">
                  {esRival ? (
                    <InputJugadorRival
                      className="sale"
                      placeholder="Sale"
                      opciones={opcionesJugadoresRival}
                      value={cambio.sale}
                      onChange={(valor) =>
                        actualizarCambioRival(index, "sale", valor)
                      }
                    />
                  ) : (
                    <InputJugador
                      className="sale"
                      placeholder="Sale"
                      value={cambio.sale}
                      opciones={enCancha.opciones}
                      relevantes={enCancha.relevantes}
                      etiquetaRelevantes="En cancha"
                      onChange={(valor) =>
                        actualizarCambio(index, "sale", valor)
                      }
                    />
                  )}

                  <Icono nombre="cambio" size={18} className="flecha-cambio" />

                  {esRival ? (
                    <InputJugadorRival
                      className="entra"
                      placeholder="Entra"
                      opciones={opcionesJugadoresRival}
                      value={cambio.entra}
                      onChange={(valor) =>
                        actualizarCambioRival(index, "entra", valor)
                      }
                    />
                  ) : (
                    <InputJugador
                      className="entra"
                      placeholder="Entra"
                      value={cambio.entra}
                      opciones={enBanco.opciones}
                      relevantes={enBanco.relevantes}
                      etiquetaRelevantes="En el banco"
                      onChange={(valor) =>
                        actualizarCambio(index, "entra", valor)
                      }
                    />
                  )}
                </div>

                <div className="fila-hora-cambio">
                  <div className="hora-ranura">
                    <CampoTiempo
                      value={cambio.hora || ""}
                      onChange={(valor) =>
                        esRival
                          ? actualizarCambioRival(
                              index,
                              "hora",
                              valor,
                              periodoVista,
                            )
                          : actualizarCambio(index, "hora", valor, periodoVista)
                      }
                      modoTiempo={registro.modoTiempo}
                      className="input-hora-cambio"
                    />
                  </div>

                  <button
                    type="button"
                    className="boton-ahora-cambio"
                    onClick={() =>
                      esRival
                        ? ponerHoraCambioRival(index, periodoVista)
                        : ponerHoraCambio(index, periodoVista)
                    }
                  >
                    <Icono nombre="reloj" size={17} /> Ahora
                  </button>

                  <button
                    type="button"
                    className="boton-et-cambio"
                    onClick={() =>
                      esRival
                        ? ponerHoraEntreTiempoRival(index)
                        : ponerHoraEntreTiempo(index)
                    }
                  >
                    ET
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const renderHojaConfirmar = () => (
    <HojaConfirmar
      abierta={Boolean(confirmacion)}
      titulo={confirmacion?.titulo || ""}
      descripcion={confirmacion?.descripcion}
      detalle={confirmacion?.detalle}
      etiquetaConfirmar={confirmacion?.etiquetaConfirmar}
      onConfirmar={confirmarAccion}
      onCancelar={cerrarConfirmacion}
    />
  );

  const enMarcoAplicacion = (activo, contenido) => (
    <MarcoAplicacion
      activo={activo}
      onNavigate={navegarAplicacion}
      hayPartido={partidoEnCurso}
    >
      {contenido}
      {renderHojaConfirmar()}
    </MarcoAplicacion>
  );

  if (!mostrarApp) {
    return (
      <div
        className="intro-pantalla"
        style={{ backgroundImage: `url(${IMAGEN_INTRO})` }}
      >
        <div className="overlay-intro" />
      </div>
    );
  }

  if (pantallaFormacion === "inicio") {
    return enMarcoAplicacion("formacion", renderPantallaInicioFormacion());
  }

  if (pantallaFormacion === "manual") {
    return enMarcoAplicacion(
      "formacion",
      renderFormularioFormacion(),
    );
  }
  if (registroSeleccionado !== null) {
    return enMarcoAplicacion(
      "registros",
      renderDetalleRegistro({
        item: registroSeleccionado.item,
        index: registroSeleccionado.index,
      }),
    );
  }
  if (pantallaFormacion === "registros") {
    return enMarcoAplicacion(
      "registros",
      <div className="app">
        <div className="contenedor">
          <header className="encabezado">
            <h1>Registros Guardados</h1>
            <p>Buscá y revisá partidos cargados.</p>
          </header>

          {guardados.length > 0 && (
            <section className="tarjeta">
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
            {guardados.length === 0 ? (
              <div className="sin-resultados">
                No hay registros guardados todavía.
              </div>
            ) : (
              <>
                <div className="historial-titulo">
                  <p className="contador-registros">
                    Mostrando {registrosVisibles.length} de {guardados.length}{" "}
                    registros
                  </p>

                  <button type="button" onClick={borrarHistorial}>
                    Borrar historial
                  </button>
                </div>

                {registrosVisibles.length === 0 && (
                  <div className="sin-resultados">
                    No se encontraron registros con esa búsqueda.
                  </div>
                )}

                {registrosVisibles.map(({ item, index }) => (
                  <div className="registro-guardado" key={index}>
                    <span className="cabecera-registro">
                      <span className="fecha-registro">
                        {formatearFechaPantalla(item.fecha)}
                      </span>
                      {item.sinSincronizar && (
                        <span className="marca-sin-sincronizar">
                          Sin sincronizar
                        </span>
                      )}
                    </span>

                    <div className="enfrentamiento-registro">
                      <EscudoDeClub equipo="cam" nombre={NOMBRE_CAM} compacto />
                      <strong>Atlético Mineiro</strong>
                      <span className="resultado-registro">
                        {item.resultado || "–"}
                      </span>
                      <strong>{item.rival || "Sin rival"}</strong>
                      <EscudoDeClub nombre={item.rival} mini />
                    </div>

                    <div className="tiempos-registro">
                      <span>
                        PT <strong>{item.tiempoPT || "-"}</strong>
                      </span>
                      <span>
                        ST <strong>{item.tiempoST || "-"}</strong>
                      </span>
                    </div>

                    <div className="acciones-registro">
                      <button
                        type="button"
                        className="boton-detalle"
                        onClick={() => {
                          setRegistroSeleccionado({ item, index });
                          setDetalleBorrador(null);
                          setDetalleEditando(false);
                          // Cada registro se abre igual: primer tiempo, en
                          // bruto y con los cambios nuestros.
                          setVistaFicha("PT");
                          setFichaEnNeto(false);
                          setFichaDelRival(false);
                          setFichaCambiosArriba(false);
                        }}
                      >
                        Ver detalle
                      </button>

                      <button
                        type="button"
                        className="boton-eliminar-registro"
                        onClick={() => eliminarRegistro(index)}
                        aria-label="Eliminar registro"
                      >
                        <Icono nombre="borrar" size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
      </div>,
    );
  }
  const etiquetaAccionPeriodo = !periodoIniciado
    ? `Iniciar ${periodoVista}`
    : !periodoFinalizado
      ? `Finalizar ${periodoVista}`
      : `Reanudar ${periodoVista}`;
  const etiquetaVar = !varActual.inicio
    ? "Iniciar VAR"
    : !varActual.final
      ? "Finalizar VAR"
      : "Nuevo VAR";
  const etiquetaHidratacion = !hidratacionIniciada
    ? "Hidratación"
    : !hidratacionFinalizada
      ? "Finalizar hidratación"
      : "Hidratación registrada";
  const tiempoPeriodoGuardado = resumen[`tiempo${periodoVista}`];
  const tiempoHidratacionGuardado = resumen[`tiempoHidratacion${periodoVista}`];

  return (
    <MarcoAplicacion activo="partido" onNavigate={navegarAplicacion} hayPartido>
      <div className="tablero-partido">
        {mensajeGuardado && (
          <div className="notificacion-guardado" role="status">
            <Icono nombre="check" size={18} /> {mensajeGuardado}
          </div>
        )}

        <header className="cabecera-tablero">
          <div className="titulo-estado-partido">
            <span className="marca-movil-cabecera">
              <EscudoClub
                equipo="cam"
                nombre={NOMBRE_CAM}
                url={escudoCam.url}
                compacto
              />
            </span>
            <span
              className={`punto-estado ${periodoIniciado && !periodoFinalizado ? "en-curso" : ""}`}
            />
            <div className="estado-sincronizacion">
              <time>{formatearFechaPantalla(registro.fecha)}</time>
              <HoraActual />
            </div>
          </div>

          <div className="acciones-cabecera">
            <button
              type="button"
              className="boton-limpiar-cabecera"
              onClick={limpiarCarga}
            >
              <Icono nombre="borrar" size={17} />
              <span>Limpiar</span>
            </button>

            <button
              type="button"
              className="boton-guardar-cabecera"
              onClick={guardarRegistro}
              disabled={guardando}
            >
              <Icono nombre={guardando ? "reloj" : "check"} size={18} />
              {guardando ? "Guardando…" : "Guardar partido"}
            </button>
          </div>
        </header>

        <section className="marcador-partido" aria-label="Marcador del partido">
          <div className="equipo-marcador equipo-local">
            <EscudoClub equipo="cam" nombre={NOMBRE_CAM} url={escudoCam.url} />
            <strong>Atlético Mineiro</strong>
          </div>
          <div className="resultado-marcador">
            <input
              inputMode="numeric"
              aria-label="Goles de Atlético Mineiro"
              value={golesAtletico === "0" ? "" : golesAtletico}
              placeholder="0"
              onChange={(evento) =>
                actualizarMarcador("atletico", evento.target.value)
              }
            />
            <span>—</span>
            <input
              inputMode="numeric"
              aria-label={`Goles de ${registro.rival || "rival"}`}
              value={golesRival === "0" ? "" : golesRival}
              placeholder="0"
              onChange={(evento) =>
                actualizarMarcador("rival", evento.target.value)
              }
            />
          </div>
          <div className="equipo-marcador equipo-visitante">
            <strong>{registro.rival || "Rival"}</strong>
            <EscudoClub nombre={registro.rival} url={escudoRival.url} />
          </div>
        </section>

        <div className="resumen-operativo">
          <div className="columna-reloj">
            <RelojPartido
              periodo={periodoVista}
              modoTiempo={registro.modoTiempo}
              referencia={registro[datosPeriodoVista.referencia]}
              baseSegundos={datosPeriodoVista.baseSegundos}
              inicio={registro[datosPeriodoVista.inicio]}
              final={registro[datosPeriodoVista.final]}
            />

            {renderItemsPeriodo()}
          </div>

          <section
            className="selector-periodos"
            aria-label="Períodos del partido"
          >
            <div role="tablist">
              {[
                "PT",
                "ST",
                ...(registro.prorrogaActiva ? ["PTE", "STE"] : []),
              ].map((periodo) => {
                const config = obtenerConfigPeriodo(periodo);
                const completo = Boolean(
                  registro[config.inicio] && registro[config.final],
                );
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={periodoVista === periodo}
                    className={periodoVista === periodo ? "activo" : ""}
                    onClick={() => setPeriodoVista(periodo)}
                    key={periodo}
                  >
                    {periodo} {completo && <Icono nombre="check" size={16} />}
                  </button>
                );
              })}
              {registro.prorrogaActiva ? (
                <button
                  type="button"
                  className="agregar-prorroga quitar"
                  onClick={quitarProrroga}
                  aria-label="Quitar prórroga"
                >
                  <Icono nombre="borrar" size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  className="agregar-prorroga"
                  onClick={() => {
                    activarProrroga();
                    setPeriodoVista("PTE");
                  }}
                  aria-label="Agregar prórroga"
                >
                  <Icono nombre="plus" size={20} />
                </button>
              )}
            </div>
            <p>
              {registro[datosPeriodoVista.inicio] || "--:--"}
              <span> → </span>
              {registro[datosPeriodoVista.final] || "en curso"}
              {tiempoPeriodoGuardado
                ? ` · ${formatearDuracion(tiempoPeriodoGuardado)}`
                : ""}
            </p>
          </section>
        </div>

        <div className="grilla-operativa">
          <section className="panel-operativo panel-periodo-operativo">
            <div className="panel-titulo">
              <div>
                <span className="sobrelinea">PERÍODO ACTIVO</span>
                <h2>
                  {
                    {
                      PT: "Primer tiempo",
                      ST: "Segundo tiempo",
                      PTE: "Primer tiempo de prórroga",
                      STE: "Segundo tiempo de prórroga",
                    }[periodoVista]
                  }
                </h2>
              </div>
              <span className="modo-captura">
                {registro.modoTiempo === "transmision"
                  ? "Transmisión"
                  : "En vivo"}
              </span>
            </div>

            <button
              type="button"
              className={`accion-periodo ${periodoIniciado ? "finalizar" : ""}`}
              onClick={ejecutarAccionPeriodo}
            >
              <span className="simbolo-accion-periodo" />{" "}
              {etiquetaAccionPeriodo}
            </button>

            <div className="acciones-rapidas">
              <button
                type="button"
                className="accion-cambio"
                onClick={mostrarPanelCambios}
              >
                <Icono nombre="cambio" />
                <span>Cambio</span>
              </button>
              <button
                type="button"
                onClick={alternarVarRapido}
                disabled={!periodoIniciado || periodoFinalizado}
              >
                <Icono nombre="var" />
                <span>{etiquetaVar}</span>
              </button>
              <button
                type="button"
                onClick={alternarHidratacionRapida}
                disabled={
                  !periodoIniciado || periodoFinalizado || hidratacionFinalizada
                }
              >
                <Icono nombre="hidratacion" />
                <span>{etiquetaHidratacion}</span>
              </button>
            </div>

            <details className="ajustes-periodo">
              <summary>Ajustar horarios y eventos</summary>
              <div className="contenido-ajustes-periodo">
                {registro.modoTiempo === "transmision" && (
                  <div className="editor-hora-real-inicio">
                    <span>Hora real de inicio</span>
                    <SelectorHoraEnVivo
                      value={obtenerHoraRealEditable(periodoVista)}
                      onChange={(valor) =>
                        actualizarHoraInicioRealPeriodo(periodoVista, valor)
                      }
                      compacto
                    />
                  </div>
                )}
                {renderBloqueEvento({
                  titulo: periodoVista,
                  inicioCampo: datosPeriodoVista.inicio,
                  finalCampo: datosPeriodoVista.final,
                  duracion: formatearDuracion(tiempoPeriodoGuardado),
                })}
                {renderBloqueVarPeriodo({
                  tipo: periodoVista,
                  titulo: `VAR ${periodoVista}`,
                })}
                {renderBloqueEvento({
                  titulo: `Hidratación ${periodoVista}`,
                  inicioCampo: campoInicioHidratacion,
                  finalCampo: campoFinalHidratacion,
                  duracion: formatearDuracion(tiempoHidratacionGuardado),
                })}
              </div>
            </details>
          </section>

          {renderPanelCambiosOperativo()}
        </div>
      </div>

      {renderHojaConfirmar()}
    </MarcoAplicacion>
  );
}
