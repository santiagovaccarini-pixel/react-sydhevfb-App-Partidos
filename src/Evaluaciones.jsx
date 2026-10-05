import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icono, MarcoAplicacion } from "./components/AppChrome";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { TablaDatos } from "./components/TablaDatos.jsx";
import { AvisoSoloLectura } from "./components/SoloLectura.jsx";
import ImportarEvaluaciones from "./ImportarEvaluaciones.jsx";
import { CATEGORIAS, COMPARAR_AL_ABRIR, categoriaPorCodigo } from "./domain/evaluaciones/categorias.js";
import { textoDeValor } from "./domain/evaluaciones/excel.js";
import { calcularFilas, estadisticas, estilosDeFilas, estilosDeUnaFila } from "./domain/evaluaciones/motor.js";
import { TESTS } from "./domain/evaluaciones/tests/index.js";
import { actualizarEvaluacion, borrarEvaluacion, crearEvaluacion, leerReferencias, listarEvaluaciones } from "./domain/evaluacionesDb.js";
import { cargarEquipos, elegirEquipoInicial, guardarEquipoElegido, leerEquipoElegido } from "./domain/equipo.js";
import { etiquetaDeOpcion } from "./domain/lesionesCampos.js";
import { cargarPlantelLesiones, leerConfig } from "./domain/lesionesDb.js";
import { actualesPrimero, esActual } from "./domain/plantel.js";
import { textoDeMinutos } from "./domain/tabla.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import "./lesiones.css";
import "./evaluaciones.css";

// Evaluaciones (en Bases de Datos): las hojas del Excel BD_evaluaciones, un
// test por pestaña (hoy Zona Media; los demás se suman de a uno en
// domain/evaluaciones/tests/). Cada test es su hoja: arriba el informe
// (promedio, desvío, n, máximo y mínimo de las filas que deja ver el filtro,
// y la comparación con los valores de referencia de la categoría elegida),
// abajo la base con los mismos colores del Excel. Se carga en la app: una
// evaluación nueva es una fila más (se elige el jugador y se completa en la
// tabla), y lo viejo se trae una vez con Pegar desde Excel. Los valores de
// referencia (V.R.) se cargan aparte, con los valores exactos del Excel.

export const DESTINOS_EVALUACIONES = [
  { id: "base", etiqueta: "Base", icono: "documento" },
  { id: "referencias", etiqueta: "Valores de referencia", icono: "grafico" },
];

// Cómo va cada tipo de columna del test en la tabla.
const TIPO_EN_LA_TABLA = { calculado: "calculado", dato_jugador: "calculado", fecha: "fecha", jugador: "lista", lista: "lista", tiempo: "tiempo", texto: "texto" };
// Lo que se carga a mano (lo demás lo calcula la app o sale de Datos básicos).
const SE_CARGAN = ["fecha", "jugador", "lista", "tiempo", "texto"];
// Van alineadas a la izquierda, como en el Excel; el resto, centrado.
const A_LA_IZQUIERDA = ["jugador", "posicion", "nota"];

const textoDeCategoria = (codigo, idioma) => categoriaPorCodigo(codigo)?.etiquetas[idioma] || codigo || "";

// onVolver: el botón de arriba a la izquierda (vuelve a Bases de Datos);
// volverA: la clave de su texto.
export default function Evaluaciones({ onVolver, volverA = "portal.basesTitulo" }) {
  const { idioma, plural } = useIdioma();
  const [equipo, setEquipo] = useState(() => leerEquipoElegido());
  const [vista, setVista] = useState("base");
  const [testId, setTestId] = useState(TESTS[0].id);
  const test = TESTS.find((uno) => uno.id === testId) || TESTS[0];
  const [plantel, setPlantel] = useState([]);
  const [plantelSinLeer, setPlantelSinLeer] = useState(false);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [referencias, setReferencias] = useState(null);
  // La configuración de Lesiones del club: los nombres de las posiciones,
  // como en Datos básicos.
  const [config, setConfig] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // Contra qué categoría compara el informe (el "Vs Mayor" del Excel).
  const [comparar, setComparar] = useState(COMPARAR_AL_ABRIR);
  const [importando, setImportando] = useState(false);
  const [eligiendoJugador, setEligiendoJugador] = useState(false);
  const [aBorrar, setABorrar] = useState(null);
  // Las agregadas recién: se ven aunque el filtro las deje afuera, para
  // completarlas en la tabla.
  const [recienAgregadas, setRecienAgregadas] = useState([]);
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));

  const equipoId = equipo?.id || null;
  // Quien ya se fue del club ve lo cargado hasta su último día y no cambia nada.
  const soloLectura = Boolean(equipo?.hasta);

  // Sin club elegido en este celular, se adopta el que diga la base.
  useEffect(() => {
    if (equipoId) return undefined;
    let vigente = true;
    cargarEquipos().then(({ equipos, error: falla }) => {
      const elegido = elegirEquipoInicial(equipos, null, { huboError: Boolean(falla) });
      if (vigente && elegido) {
        guardarEquipoElegido(elegido);
        setEquipo(elegido);
      }
    });
    return () => {
      vigente = false;
    };
  }, [equipoId]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    const [respuestaPlantel, respuestaEvaluaciones, respuestaReferencias, respuestaConfig] = await Promise.all([
      cargarPlantelLesiones(equipoId),
      listarEvaluaciones(equipoId, testId),
      leerReferencias(equipoId, testId),
      leerConfig(equipoId),
    ]);
    setPlantel(respuestaPlantel.plantel || []);
    setPlantelSinLeer(Boolean(respuestaPlantel.error || respuestaPlantel.deRespaldo));
    // Sin la configuración (o sin permiso de Lesiones), valen los textos del Excel.
    setConfig(respuestaConfig.error ? null : respuestaConfig.config);
    if (respuestaEvaluaciones.error || respuestaReferencias.error) {
      setError(respuestaEvaluaciones.error || respuestaReferencias.error);
    } else {
      setEvaluaciones(respuestaEvaluaciones.evaluaciones);
      setReferencias(respuestaReferencias.referencias);
    }
    setCargando(false);
  }, [equipoId, testId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const alCambiar = () => setEnLinea(navigator.onLine !== false);
    window.addEventListener("online", alCambiar);
    window.addEventListener("offline", alCambiar);
    return () => {
      window.removeEventListener("online", alCambiar);
      window.removeEventListener("offline", alCambiar);
    };
  }, []);

  useEffect(() => {
    if (!aviso) return undefined;
    const temporizador = setTimeout(() => setAviso(""), 2600);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  const jugadorDe = useCallback((id) => plantel.find((jugador) => String(jugador.id) === String(id)) || null, [plantel]);
  const nombreDe = (evaluacion) => jugadorDe(evaluacion?.jugador_id)?.nombre || evaluacion?.persona || "";

  // Los jugadores para elegir: los del plantel actual primero; quien ya no
  // está, con su aviso (al pegar, también vale el nombre solo).
  const opcionesDeJugadores = useMemo(
    () =>
      actualesPrimero(plantel).map((jugador) => ({
        valor: String(jugador.id),
        etiqueta: esActual(jugador) ? jugador.nombre : `${jugador.nombre} · ${t("datos.yaNoEsta")}`,
        alias: [jugador.nombre],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plantel, idioma],
  );

  // Paso 1: lo que el Excel calcula de cada fila, con todas las del test.
  const calculadas = useMemo(() => calcularFilas(test, evaluaciones, referencias), [test, evaluaciones, referencias]);

  const columnas = useMemo(
    () =>
      test.columnas.map((columna) => ({
        clave: columna.clave,
        titulo: columna.titulo[idioma],
        tipo: TIPO_EN_LA_TABLA[columna.tipo] || "calculado",
        editable: !soloLectura && SE_CARGAN.includes(columna.tipo),
        ancho: columna.ancho,
        alinear: A_LA_IZQUIERDA.includes(columna.clave) ? undefined : "centro",
        opciones:
          columna.tipo === "jugador"
            ? opcionesDeJugadores
            : columna.tipo === "lista"
              ? CATEGORIAS.map((categoria) => ({
                  valor: categoria.codigo,
                  etiqueta: categoria.etiquetas[idioma],
                  // Para pegar: también vale como lo escribe el Excel y en el otro idioma.
                  alias: [categoria.excel, ...Object.values(categoria.etiquetas)],
                }))
              : undefined,
      })),
    [test, idioma, soloLectura, opcionesDeJugadores],
  );
  const fijas = useMemo(() => test.columnas.filter((columna) => columna.fija).map((columna) => columna.clave), [test]);

  // Cómo se ve cada celda (como en el Excel, con su formato) y qué se edita.
  const filas = useMemo(
    () =>
      calculadas.map(({ fila, celdas }) => {
        const jugador = jugadorDe(fila.jugador_id);
        const valores = {};
        const textos = {};
        const orden = {};
        test.columnas.forEach((columna) => {
          const { clave } = columna;
          switch (columna.tipo) {
            case "fecha":
              valores[clave] = fila.fecha;
              textos[clave] = fechaCorta(fila.fecha);
              break;
            case "jugador":
              valores[clave] = fila.jugador_id ? String(fila.jugador_id) : "";
              textos[clave] = jugador?.nombre || fila.persona || "";
              orden[clave] = textos[clave];
              break;
            case "lista":
              valores[clave] = fila.datos?.[clave] || "";
              textos[clave] = textoDeCategoria(fila.datos?.[clave], idioma);
              break;
            case "dato_jugador":
              if (clave === "fecha_nac") {
                textos[clave] = fechaCorta(jugador?.fecha_nacimiento);
                orden[clave] = jugador?.fecha_nacimiento || "";
              } else textos[clave] = jugador?.posicion ? etiquetaDeOpcion("posicion", jugador.posicion, config, idioma) : "";
              break;
            case "tiempo":
              valores[clave] = typeof fila.datos?.[clave] === "number" ? fila.datos[clave] : null;
              textos[clave] = textoDeMinutos(valores[clave]);
              if (valores[clave] !== null) orden[clave] = valores[clave];
              break;
            case "texto":
              valores[clave] = fila.datos?.[clave] || "";
              textos[clave] = valores[clave];
              break;
            default:
              textos[clave] = textoDeValor(celdas[clave], columna.formato, idioma);
              if (typeof celdas[clave] === "number") orden[clave] = celdas[clave];
          }
        });
        return {
          id: fila.id,
          valores,
          textos,
          orden,
          celdas,
          // Quien ya no está en el plantel actual, en otro color (como en Lesiones).
          apagada: Boolean(jugador && !esActual(jugador)),
        };
      }),
    [calculadas, test, jugadorDe, config, idioma],
  );

  // Paso 2, con las filas que se ven: el informe de arriba y los colores.
  const informeYColores = useCallback(
    (filasVista) => {
      const est = estadisticas(test.columnasDelInforme, filasVista.map((fila) => fila.celdas));
      const informe = test.informe({ est, referencias, comparar });
      const estilos = estilosDeFilas(
        test.reglas,
        filasVista.map((fila) => ({ id: fila.id, celdas: fila.celdas })),
        est,
      );
      const comparacion = informe.find((fila) => fila.id === "comparacion");
      const estilosComparacion = estilosDeUnaFila(test.reglasDelInforme, Object.fromEntries(Object.entries(comparacion.celdas).map(([clave, celda]) => [clave, celda.valor])));
      const rotulo = (fila) => {
        // Las filas 2 y 3 del Excel: a la izquierda, el selector "Vs …".
        if (fila.id === "comparacion")
          return (
            <label className="evaluaciones-comparar">
              <span>{t("evaluaciones.comparar")}</span>
              <select value={comparar} onChange={(evento) => setComparar(evento.target.value)}>
                {CATEGORIAS.map((categoria) => (
                  <option key={categoria.codigo} value={categoria.codigo}>
                    {categoria.contra[idioma]}
                  </option>
                ))}
              </select>
            </label>
          );
        if (fila.id === "referencia") return null;
        // El nº de evaluaciones (D6 del Excel) va a la izquierda del rótulo.
        if (fila.id === "n")
          return (
            <span className="evaluaciones-rotulo-n">
              <b title={t("evaluaciones.totalEvaluaciones")}>{textoDeValor(fila.celdas.numero?.valor, "General", idioma)}</b>
              <span>{fila.rotulo[idioma]}</span>
            </span>
          );
        return fila.rotulo[idioma];
      };
      return {
        estilos,
        arriba: informe.map((fila) => ({
          id: fila.id,
          rotulo: rotulo(fila),
          alto: fila.id === "comparacion" ? 2 : 1,
          celdas: Object.fromEntries(
            Object.entries(fila.celdas).map(([clave, celda]) => [
              clave,
              { texto: textoDeValor(celda.valor, celda.formato, idioma), estilo: fila.id === "comparacion" ? estilosComparacion[clave] : undefined },
            ]),
          ),
        })),
      };
    },
    [test, referencias, comparar, idioma],
  );

  const reemplazar = (evaluacion) => setEvaluaciones((previas) => previas.map((una) => (una.id === evaluacion.id ? evaluacion : una)));

  // Lo último de cada evaluación (lo que ya devolvió la base, aunque la
  // pantalla todavía no se haya redibujado) y una cola por fila: dos celdas
  // de la misma fila guardadas seguidas no se pisan, la segunda sale de lo
  // que dejó la primera.
  const ultimas = useRef(evaluaciones);
  ultimas.current = evaluaciones;
  const colas = useRef(new Map());
  const guardarFila = (id, cambiar) => {
    const paso = async () => {
      const evaluacion = ultimas.current.find((una) => una.id === id);
      if (!evaluacion) return { error: "evaluaciones.error.noGuardar" };
      const { evaluacion: nueva, error: falta } = cambiar(evaluacion);
      if (falta) return { error: falta };
      if (!nueva) return {};
      const respuesta = await actualizarEvaluacion(id, nueva);
      if (respuesta.error) return { error: respuesta.error };
      ultimas.current = ultimas.current.map((una) => (una.id === id ? respuesta.evaluacion : una));
      reemplazar(respuesta.evaluacion);
      return {};
    };
    const siguiente = (colas.current.get(id) || Promise.resolve()).then(paso, paso);
    colas.current.set(id, siguiente);
    return siguiente;
  };

  // Una celda cambiada, sobre la evaluación: { evaluacion } o { error } (y
  // nada si no es de las que se cargan).
  const conCambio = (evaluacion, clave, valor) => {
    const columna = test.columnas.find((una) => una.clave === clave);
    if (!columna || !SE_CARGAN.includes(columna.tipo)) return {};
    if (columna.tipo === "fecha") return { evaluacion: { ...evaluacion, fecha: valor || null } };
    // Una evaluación es siempre de alguien.
    if (columna.tipo === "jugador") return valor ? { evaluacion: { ...evaluacion, jugador_id: Number(valor), persona: null } } : { error: "evaluaciones.error.sinJugador" };
    return { evaluacion: { ...evaluacion, datos: { ...evaluacion.datos, [clave]: valor === "" ? null : valor } } };
  };

  const editarCelda = (id, clave, valor) => guardarFila(id, (evaluacion) => conCambio(evaluacion, clave, valor));

  const pegarEnTabla = async (cambios) => {
    const porFila = new Map();
    cambios.forEach((cambio) => porFila.set(cambio.filaId, [...(porFila.get(cambio.filaId) || []), cambio]));
    let hechos = 0;
    let ultimoError = "";
    for (const [id, suyos] of porFila) {
      // eslint-disable-next-line no-await-in-loop
      const resultado = await guardarFila(id, (evaluacion) => {
        let falta = "";
        const nueva = suyos.reduce((acumulada, cambio) => {
          const uno = conCambio(acumulada, cambio.clave, cambio.valor);
          if (uno.error) falta = uno.error;
          return uno.evaluacion || acumulada;
        }, evaluacion);
        return falta ? { error: falta } : { evaluacion: nueva };
      });
      if (resultado.error) ultimoError = resultado.error;
      else hechos += suyos.length;
    }
    return { hechos, error: ultimoError };
  };

  // Una evaluación nueva: primero el jugador; va con la fecha de hoy al final
  // de la tabla, y se completa ahí.
  const agregar = async (jugadorId) => {
    setEligiendoJugador(false);
    if (!jugadorId) return;
    setOcupado(true);
    const respuesta = await crearEvaluacion(equipoId, test.id, { jugador_id: Number(jugadorId), fecha: hoyISO(), datos: {} });
    setOcupado(false);
    if (respuesta.error) {
      setAviso(t(respuesta.error));
      return;
    }
    setEvaluaciones((previas) => [...previas, respuesta.evaluacion]);
    setRecienAgregadas((previas) => [...previas, respuesta.evaluacion.id]);
    setAviso(t("evaluaciones.agregada"));
  };

  const confirmarBorrar = async () => {
    const evaluacion = aBorrar;
    setABorrar(null);
    if (!evaluacion) return;
    setOcupado(true);
    const respuesta = await borrarEvaluacion(evaluacion.id);
    setOcupado(false);
    if (respuesta.error) {
      setAviso(t(respuesta.error));
      return;
    }
    setEvaluaciones((previas) => previas.filter((una) => una.id !== evaluacion.id));
    setAviso(t("evaluaciones.borrada"));
  };

  // ------------------------------------------------------------ Pantallas --

  const estado = !enLinea ? (
    <p className="lesiones-estado">{t("evaluaciones.estado.sinConexion")}</p>
  ) : error ? (
    <div className="lesiones-estado error">
      {t(error)}{" "}
      <button type="button" onClick={cargar}>
        {t("comun.reintentar")}
      </button>
    </div>
  ) : cargando ? (
    <p className="lesiones-estado">{t("evaluaciones.estado.cargando")}</p>
  ) : null;

  // Los tests, si hay más de uno: el de la pestaña elegida es el que se ve.
  const elegirTest = TESTS.length > 1 && (
    <div className="grilla-criterios evaluaciones-tests" role="tablist">
      {TESTS.map((uno) => (
        <button
          key={uno.id}
          type="button"
          role="tab"
          aria-selected={uno.id === test.id}
          className={`chip-criterio ${uno.id === test.id ? "prendido" : ""}`}
          onClick={() => {
            setTestId(uno.id);
            setImportando(false);
          }}
        >
          {uno.pestana[idioma]}
        </button>
      ))}
    </div>
  );

  // Título a la izquierda y el idioma a la derecha, como en Lesiones.
  const encabezado = (titulo, texto) => (
    <header className="encabezado lesiones-encabezado">
      <div className="lesiones-encabezado-texto">
        <h1>{titulo}</h1>
        {texto && <p>{texto}</p>}
      </div>
      <SelectorIdioma className="lesiones-idioma" />
    </header>
  );

  const sinReferencias = !cargando && !error && !referencias;

  const pantallaBase = (
    <div className="app">
      <div className="contenedor contenedor-base">
        {/* Es la primera pantalla: arriba, volver a Bases de Datos (como en la
            primera de Lesiones). */}
        {onVolver && (
          <div className="evaluaciones-barra">
            <button type="button" className="boton-modulos" onClick={onVolver}>
              <Icono nombre="flecha" size={14} />
              {t(volverA)}
            </button>
          </div>
        )}
        {elegirTest}
        {encabezado(test.titulo[idioma], test.nota[idioma])}
        <AvisoSoloLectura hasta={equipo?.hasta} />
        {estado}
        {sinReferencias && <p className="lesiones-estado evaluaciones-sin-referencias">{t("evaluaciones.sinReferencias")}</p>}
        {!soloLectura && (
          <section className="tarjeta tarjeta-inicio evaluaciones-acciones">
            <button type="button" className="boton-principal" onClick={() => setEligiendoJugador(true)} disabled={!enLinea || cargando || Boolean(error) || ocupado}>
              {t("evaluaciones.agregar")}
            </button>
            <button type="button" className="boton-secundario datos-pegar-excel" onClick={() => setImportando(true)} disabled={!enLinea || cargando || Boolean(error)}>
              <Icono nombre="documento" size={16} />
              {t("evaluaciones.importar.boton")}
            </button>
          </section>
        )}
        <section className="tarjeta evaluaciones-tabla">
          <TablaDatos
            key={test.id}
            id={`evaluaciones-${test.id}`}
            recordar={`evaluaciones:${test.id}`}
            columnas={columnas}
            filas={filas}
            fijas={fijas}
            vista={informeYColores}
            siempreAVista={recienAgregadas}
            onEditar={editarCelda}
            onPegar={pegarEnTabla}
            leyenda={t("datos.leyendaYaNoEsta")}
            rotuloApagada={t("datos.yaNoEsta")}
            onBorrarFila={
              soloLectura
                ? undefined
                : (id) => {
                    const evaluacion = evaluaciones.find((una) => una.id === id);
                    if (evaluacion) setABorrar(evaluacion);
                  }
            }
          />
        </section>
      </div>
    </div>
  );

  // Los valores de referencia, como a la derecha de la hoja del Excel: un
  // bloque por categoría y el resumen.
  const bloques = referencias?.categorias || {};
  const pantallaReferencias = (
    <div className="app">
      <div className="contenedor contenedor-base">
        {elegirTest}
        {encabezado(t("evaluaciones.referencias.titulo"), t("evaluaciones.referencias.texto"))}
        <AvisoSoloLectura hasta={equipo?.hasta} />
        {estado}
        {sinReferencias && <p className="lesiones-estado">{t("evaluaciones.referencias.sinDatos")}</p>}
        {!cargando &&
          !error &&
          CATEGORIAS.filter((categoria) => bloques[categoria.codigo]).map((categoria) => {
            const bloque = bloques[categoria.codigo];
            return (
              <section key={categoria.codigo} className="tarjeta evaluaciones-bloque">
                <div className="evaluaciones-bloque-cabeza">
                  <h2>{bloque.titulo || categoria.etiquetas[idioma]}</h2>
                  {bloque.rotulo && <span>{bloque.rotulo}</span>}
                </div>
                <div className="evaluaciones-bloque-marco">
                  <table className="evaluaciones-vr">
                    <thead>
                      <tr>
                        <td />
                        {test.metricas.map((metrica) => (
                          <th key={metrica.clave} scope="col">
                            {metrica.titulo[idioma]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {test.filasDeReferencia.map((fila) => (
                        <tr key={fila.clave}>
                          <th scope="row">{fila.titulo[idioma]}</th>
                          {test.metricas.map((metrica) => (
                            <td key={metrica.clave}>{textoDeValor(bloque[fila.clave]?.[metrica.clave] ?? null, fila.formato || metrica.formato, idioma)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        {!cargando && !error && referencias?.resumen && (
          <section className="tarjeta evaluaciones-bloque">
            <h2>{t("evaluaciones.referencias.resumen")}</h2>
            <div className="evaluaciones-bloque-marco">
              <table className="evaluaciones-vr">
                <thead>
                  <tr>
                    <th scope="col">{t("evaluaciones.referencias.categoria")}</th>
                    <th scope="col">n</th>
                    {test.resumen.map((clave) => (
                      <th key={clave} scope="col">
                        {test.metricas.find((metrica) => metrica.clave === clave)?.titulo[idioma]}
                      </th>
                    ))}
                    <th scope="col">{t("evaluaciones.referencias.pro")}</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIAS.map((categoria) => (
                    <tr key={categoria.codigo}>
                      <th scope="row">{categoria.etiquetas[idioma]}</th>
                      <td>{textoDeValor(referencias.resumen.n?.[categoria.codigo] ?? null, "General", idioma)}</td>
                      {test.resumen.map((clave) => (
                        <td key={clave}>
                          {textoDeValor(bloques[categoria.codigo]?.bueno?.[clave] ?? null, test.metricas.find((metrica) => metrica.clave === clave)?.formato, idioma)}
                        </td>
                      ))}
                      {/* En el Excel da #REF!: la celda de la que salía ya no existe. */}
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );

  let contenido;
  if (vista === "referencias") contenido = pantallaReferencias;
  else if (importando && !soloLectura)
    contenido = (
      <ImportarEvaluaciones
        test={test}
        equipoId={equipoId}
        plantel={plantel}
        plantelSinLeer={plantelSinLeer}
        evaluaciones={evaluaciones}
        onVolver={() => setImportando(false)}
        onRecargar={cargar}
        // Las cargadas quedan en la lista antes de recargar: si la recarga
        // falla, al reintentar se ven como "Ya está" y no se duplican.
        onGuardadas={(nuevas) =>
          setEvaluaciones((previas) => {
            const yaEstan = new Set(previas.map((una) => una.id));
            return [...previas, ...nuevas.filter((una) => !yaEstan.has(una.id))];
          })
        }
        onListo={({ cargadas }) => {
          setImportando(false);
          setAviso(plural("evaluaciones.importar.listo", cargadas));
        }}
      />
    );
  else contenido = pantallaBase;

  const navegar = (id) => {
    setImportando(false);
    setVista(id);
  };

  return (
    <MarcoAplicacion activo={vista} onNavigate={navegar} destinos={DESTINOS_EVALUACIONES} marca={t("evaluaciones.titulo")} className="entrenamiento-marco lesiones-marco evaluaciones-marco">
      {contenido}

      {aviso && (
        <div className="lesiones-toast" role="status">
          {aviso}
        </div>
      )}

      <HojaOpciones
        abierta={eligiendoJugador}
        titulo={t("evaluaciones.agregarTitulo")}
        opciones={opcionesDeJugadores}
        elegida={null}
        buscador
        onElegir={agregar}
        onCerrar={() => setEligiendoJugador(false)}
      />

      <HojaConfirmar
        abierta={Boolean(aBorrar)}
        titulo={t("evaluaciones.borrarTitulo")}
        descripcion={t("evaluaciones.borrarTexto", { jugador: nombreDe(aBorrar), fecha: aBorrar?.fecha ? fechaCorta(aBorrar.fecha) : t("evaluaciones.sinFecha") })}
        icono="borrar"
        etiquetaConfirmar={t("evaluaciones.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBorrar}
        onCancelar={() => setABorrar(null)}
      />
    </MarcoAplicacion>
  );
}
