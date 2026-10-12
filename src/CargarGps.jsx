import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { ListaParaMarcar } from "./components/ListaParaMarcar.jsx";
import { HojaInferior } from "./components/SheetPanel.js";
import { TablaDatos } from "./components/TablaDatos.jsx";
import { opcionesDeLista } from "./domain/evaluaciones/ajustes.js";
import { configGpsVacia } from "./domain/gps/ajustes.js";
import { REGLAS_CARGA, bloquesDelCsv, calcularCarga, leerCsvCatapult, microcicloDe } from "./domain/gps/cargar.js";
import { LISTAS_GPS } from "./domain/gps/columnas.js";
import { COMO_PERSONA, NO_CARGAR, buscadorDelGps, leerSegundos } from "./domain/gps/importar.js";
import { textoDeSegundos } from "./domain/gps/valores.js";
import { crearFilasGps, listarGps } from "./domain/gpsDb.js";
import { DUDOSO, nombreIgual } from "./domain/importarPersonas.js";
import { actualesPrimero, cargarPlantelConCatapult, esActual } from "./domain/plantel.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// GPS › Cargar (paso 2, Santiago 10/10): lo de cada día con la lógica de la
// plantilla «Suma de Bloques» (las cuentas, en domain/gps/cargar.js). Se sube
// (o se pega) el CSV de Catapult y se completa, en pasos: la sesión, el
// partido (si hay), cada tarea una vez («Una vez por tarea»), quién hizo
// regenerativo y quién no entrenó. Antes de guardar se ven las filas que van
// a la Base, como en la Base; ahí se cambia cualquier número de un jugador
// (los totales y promedios se recalculan) y el «Va» de cada total.
// Toda lista se elige en un desplegable, nunca con todas las opciones a la
// vista (Santiago, 01/10 y 12/10); varios jugadores, en un desplegable con
// casillas, como el filtro de las bases.

// La duración del regenerativo, si no se escribe otra (la plantilla).
const REGENERATIVO_AL_EMPEZAR = 30 * 60;

// Los días del microciclo (0, 1, +1, -1 …), sin la mañana ni la tarde.
const DIAS = [...new Set(LISTAS_GPS.clasificacion_dias.map((opcion) => opcion.etiquetas["es-AR"].replace(/_[MT]$/, "")))];

// La clave de una fila del CSV en su bloque (para lo que se cambia a mano).
const claveDeFila = (bloque, indice) => `${bloque}|${indice}`;
// La clave de una fila que va a la Base (para lo que se cambia en la tabla).
const claveDeSalida = (fila) => `${fila._seccion}|${fila._quien || ""}|${fila._fila ?? ""}`;

const estadoInicial = () => ({
  csv: [],
  fecha: "",
  tipoMicrociclo: "",
  dia: "",
  dispositivo: "",
  sesion: { tipoSesion: "", zona: "", codigo: "" },
  partido: { nombre: "", tareaPartido: "partido_oficial_torneo", primer: {}, segundo: {}, completo: {}, banco: { jugadores: [] } },
  tareas: {},
  orden: [],
  adicional: null,
  regenerativo: { hubo: false, duracion: REGENERATIVO_AL_EMPEZAR, jugadores: [] },
  noEntrenaron: {},
  elegidos: {},
  ediciones: {},
  agregados: {},
  vaTarea: {},
  va: {},
  posteriores: {},
});

export default function CargarGps({
  gps,
  config = configGpsVacia(),
  equipoId,
  plantel = [],
  plantelSinLeer = false,
  reglas = REGLAS_CARGA,
  columnas = [],
  fijas = [],
  armarFila,
  conCambio,
  enLinea = true,
  onListo,
  onCancelar,
  onSinGuardar,
}) {
  const { idioma, plural } = useIdioma();
  const hoy = hoyISO();
  const [paso, setPaso] = useState(0);
  const [estado, setEstado] = useState(estadoInicial);
  const [errorPaso, setErrorPaso] = useState("");
  const [hoja, setHoja] = useState(null);
  // El desplegable de varios jugadores abierto: { titulo, valores, elegidos, busqueda, alAplicar }.
  const [hojaVarios, setHojaVarios] = useState(null);
  const [existentes, setExistentes] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [falla, setFalla] = useState("");
  const [abierta, setAbierta] = useState(null);
  // Un guardado que se cortó: { lista (lo que se estaba guardando), hechas }.
  const [aMedias, setAMedias] = useState(null);
  const archivo = useRef(null);
  const enPantalla = useRef(true);
  useEffect(() => {
    enPantalla.current = true;
    return () => {
      enPantalla.current = false;
    };
  }, []);

  // Los nombres en Catapult de cada jugador (el vínculo de Datos básicos).
  const [enCatapult, setEnCatapult] = useState({});
  useEffect(() => {
    let vigente = true;
    cargarPlantelConCatapult(equipoId).then(({ plantel: lista }) => {
      if (!vigente) return;
      setEnCatapult(Object.fromEntries((lista || []).filter((jugador) => jugador.catapult_nombre).map((jugador) => [String(jugador.id), jugador.catapult_nombre])));
    });
    return () => {
      vigente = false;
    };
  }, [equipoId]);
  const conCatapult = useMemo(() => plantel.map((jugador) => (enCatapult[String(jugador.id)] ? { ...jugador, catapult_nombre: enCatapult[String(jugador.id)] } : jugador)), [plantel, enCatapult]);
  const buscar = useMemo(() => buscadorDelGps(conCatapult), [conCatapult]);
  const jugadorDe = (id) => plantel.find((jugador) => String(jugador.id) === String(id)) || null;
  const actuales = useMemo(() => actualesPrimero(plantel).filter(esActual), [plantel]);

  // Con un CSV leído hay algo sin guardar (la barra de abajo pregunta antes
  // de salir).
  useEffect(() => {
    onSinGuardar?.(estado.csv.length > 0);
  }, [estado.csv.length, onSinGuardar]);
  useEffect(() => () => onSinGuardar?.(false), [onSinGuardar]);

  const cambiar = (cambios) => setEstado((antes) => ({ ...antes, ...(typeof cambios === "function" ? cambios(antes) : cambios) }));

  // ------------------------------------------------------------- El CSV --
  const leido = useMemo(() => {
    if (!estado.csv.length) return null;
    const partes = estado.csv.map((uno) => leerCsvCatapult(uno.texto, gps.columnas));
    const conError = partes.find((parte) => parte.error);
    return {
      fecha: partes.find((parte) => parte.fecha)?.fecha || null,
      filas: partes.flatMap((parte) => parte.filas),
      faltan: [...new Set(partes.flatMap((parte) => parte.faltan))],
      error: conError?.error || "",
    };
  }, [estado.csv, gps]);
  const bloques = useMemo(() => (leido && !leido.error ? bloquesDelCsv(leido.filas) : null), [leido]);
  // Los pasos: el del partido, si el CSV tiene sus tiempos; el de las
  // tareas, si tiene tareas.
  const hayPartido = Boolean(bloques?.primer || bloques?.segundo);
  const PASOS = ["csv", "sesion", ...(hayPartido ? ["partido"] : []), ...(bloques?.tareas?.length ? ["tareas"] : []), "jugadores", "revisar"];
  const actual = PASOS[Math.min(paso, PASOS.length - 1)];
  const ultimo = paso === PASOS.length - 1;

  const sumarCsv = (nombre, texto) => {
    if (!String(texto || "").trim()) return;
    // Lo que no es un CSV de Catapult no se suma: se avisa.
    const prueba = leerCsvCatapult(texto, gps.columnas);
    if (prueba.error) {
      setErrorPaso(t(prueba.error));
      return;
    }
    setErrorPaso("");
    setFalla("");
    setEstado((antes) => {
      const csv = [...antes.csv, { nombre, texto }];
      const nuevo = { ...antes, csv };
      // Las tareas nuevas se suman con su nombre del CSV.
      const todos = bloquesDelCsv(csv.flatMap((uno) => leerCsvCatapult(uno.texto, gps.columnas).filas));
      const tareas = { ...antes.tareas };
      todos.tareas.forEach((bloque) => {
        if (!tareas[bloque.nombre]) tareas[bloque.nombre] = { nombre: bloque.nombre, enLaDescripcion: true, quitada: false };
      });
      nuevo.tareas = tareas;
      nuevo.orden = todos.tareas.map((bloque) => bloque.nombre);
      if (!antes.fecha) nuevo.fecha = csv.map((uno) => leerCsvCatapult(uno.texto, gps.columnas).fecha).find(Boolean) || "";
      return nuevo;
    });
  };

  const leerArchivos = async (lista) => {
    const archivos = [...(lista || [])];
    for (const uno of archivos) {
      // eslint-disable-next-line no-await-in-loop
      const texto = await uno.text();
      sumarCsv(uno.name, texto);
    }
  };

  // Quién es cada nombre del CSV: el jugador con ese nombre en Catapult o en
  // Datos básicos; si no, lo que se eligió (guardarlo con su nombre, un
  // jugador de la lista o no cargarlo).
  const quienDeNombre = (nombre) => {
    const llave = nombreIgual(nombre);
    const destino = estado.elegidos[llave];
    if (destino === NO_CARGAR) return null;
    if (destino === COMO_PERSONA) return { clave: `p:${llave}`, persona: nombre };
    if (destino) return { clave: `j:${destino}`, jugador_id: Number(destino) };
    const jugador = buscar(nombre);
    if (jugador && jugador !== DUDOSO) return { clave: `j:${jugador.id}`, jugador_id: jugador.id };
    return { clave: `p:${llave}`, persona: nombre, sinElegir: true, dudoso: jugador === DUDOSO };
  };
  const quienDeJugador = (jugador) => ({ clave: `j:${jugador.id}`, jugador_id: jugador.id });
  const nombreDeQuien = (quien) => (quien?.jugador_id ? jugadorDe(quien.jugador_id)?.nombre || "—" : quien?.persona || "—");

  // Los nombres del CSV que no están en Datos básicos: se elige qué es cada uno.
  const nombresAElegir = useMemo(() => {
    if (!leido || leido.error) return [];
    const porNombre = new Map();
    leido.filas.forEach((fila) => {
      const llave = nombreIgual(fila.nombre);
      const jugador = buscar(fila.nombre);
      const destino = estado.elegidos[llave] ?? null;
      if (jugador && jugador !== DUDOSO && destino === null) return;
      if (!porNombre.has(llave)) porNombre.set(llave, { llave, nombre: fila.nombre, filas: 0, destino, dudoso: jugador === DUDOSO });
      porNombre.get(llave).filas += 1;
    });
    return [...porNombre.values()];
  }, [leido, buscar, estado.elegidos]);
  const sinElegir = nombresAElegir.filter((uno) => uno.destino === null);

  // --------------------------------------------------- Lo que se calcula --
  const opciones = (lista) => opcionesDeLista(lista, config, idioma, { test: gps });
  const etiqueta = (lista, codigo) => opcionesDeLista(lista, config, "es-AR", { test: gps, conOcultas: true }).find((opcion) => opcion.valor === codigo)?.etiqueta || null;

  // Las filas de un bloque para el cálculo, con lo cambiado a mano y los
  // jugadores que se agregaron; y de dónde sale cada una.
  const filasDeBloque = (id, filasCsv) => {
    const filas = [];
    const fuentes = [];
    filasCsv.forEach((fila, i) => {
      const quien = quienDeNombre(fila.nombre);
      if (!quien) return;
      const clave = claveDeFila(id, i);
      filas.push({ quien, valores: { ...fila.valores, ...(estado.ediciones[clave] || {}) }, vaTarea: estado.vaTarea[clave] });
      fuentes.push(clave);
    });
    (estado.agregados[id] || []).forEach((agregado) => {
      const clave = claveDeFila(id, `+${agregado.quien.clave}`);
      filas.push({ quien: agregado.quien, valores: { ...(estado.ediciones[clave] || {}) }, vaTarea: estado.vaTarea[clave] });
      fuentes.push(clave);
    });
    return { filas, fuentes };
  };

  const armado = useMemo(() => {
    if (!bloques) return null;
    const fuentes = {};
    const deBloque = (id, filasCsv, seccion) => {
      const { filas, fuentes: suyas } = filasDeBloque(id, filasCsv);
      fuentes[seccion] = suyas;
      return filas;
    };
    const conPartido = Boolean(bloques.primer || bloques.segundo);
    const partido = conPartido
      ? {
          nombre: estado.partido.nombre.trim(),
          tareaPartido: estado.partido.tareaPartido || null,
          primer: { ...estado.partido.primer, filas: bloques.primer ? deBloque("primer", bloques.primer.filas, "partido:0") : [] },
          segundo: { ...estado.partido.segundo, filas: bloques.segundo ? deBloque("segundo", bloques.segundo.filas, "partido:1") : [] },
          completo: estado.partido.completo,
          banco: { ...estado.partido.banco, jugadores: estado.partido.banco.jugadores.map((id) => quienDeJugador({ id })) },
        }
      : null;
    const tareas = [];
    let adicional = null;
    bloques.tareas.forEach((bloque) => {
      const suya = estado.tareas[bloque.nombre] || { nombre: bloque.nombre };
      if (suya.quitada) return;
      const tarea = { ...suya, id: bloque.nombre, nombre: (suya.nombre ?? bloque.nombre).trim() };
      const seccion = estado.adicional === bloque.nombre ? "adicional" : `tarea:${bloque.nombre}`;
      tarea.filas = deBloque(`t:${bloque.nombre}`, bloque.filas, seccion);
      if (seccion === "adicional") adicional = tarea;
      else tareas.push(tarea);
    });
    const regenerativo = estado.regenerativo.hubo ? { duracion: estado.regenerativo.duracion, jugadores: estado.regenerativo.jugadores.map((clave) => quienDeClave(clave)).filter(Boolean) } : null;
    const noEntrenaron = Object.entries(estado.noEntrenaron)
      .filter(([, uno]) => uno.va !== false)
      .map(([id, uno]) => ({ quien: quienDeJugador({ id: Number(id) }), motivo: uno.motivo?.trim() || "", tipoSesion: uno.tipoSesion || null }));
    const carga = {
      fecha: estado.fecha,
      tipoMicrociclo: estado.tipoMicrociclo || null,
      dia: estado.dia || null,
      dispositivo: estado.dispositivo || null,
      partido,
      tareas,
      adicional,
      sesion: estado.sesion,
      regenerativo,
      noEntrenaron,
      va: estado.va,
      plantel: actuales.length,
    };
    return { carga, fuentes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloques, estado, buscar, actuales]);

  // Quién es una clave (de un jugador, j:id; de alguien del CSV, p:nombre).
  function quienDeClave(clave) {
    if (clave.startsWith("j:")) return { clave, jugador_id: Number(clave.slice(2)) };
    const delCsv = leido?.filas.map((fila) => quienDeNombre(fila.nombre)).find((quien) => quien?.clave === clave);
    return delCsv || null;
  }

  // Los que aparecen en el CSV (ya con quién es cada uno).
  const enElCsv = useMemo(() => {
    if (!leido || leido.error) return [];
    const vistos = new Map();
    leido.filas.forEach((fila) => {
      const quien = quienDeNombre(fila.nombre);
      if (quien && !vistos.has(quien.clave)) vistos.set(quien.clave, quien);
    });
    return [...vistos.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leido, estado.elegidos, buscar]);
  const enElPartido = useMemo(() => {
    if (!bloques) return new Set();
    return new Set(
      [
        ...[...(bloques.primer?.filas || []), ...(bloques.segundo?.filas || [])].map((fila) => quienDeNombre(fila.nombre)?.clave),
        ...[...(estado.agregados.primer || []), ...(estado.agregados.segundo || [])].map((uno) => uno.quien.clave),
      ].filter(Boolean),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloques, estado.elegidos, estado.agregados, buscar]);

  // Los del plantel actual que no aparecen en ningún lado: no entrenaron (se
  // les pone el motivo o se sacan de la lista).
  const propuestosNoEntrenaron = useMemo(() => {
    const aparecen = new Set([...enElCsv.map((quien) => quien.clave), ...estado.partido.banco.jugadores.map((id) => `j:${id}`), ...(estado.regenerativo.hubo ? estado.regenerativo.jugadores : [])]);
    Object.values(estado.agregados).forEach((lista) => lista.forEach((uno) => aparecen.add(uno.quien.clave)));
    return actuales.filter((jugador) => !aparecen.has(`j:${jugador.id}`));
  }, [actuales, enElCsv, estado.partido.banco.jugadores, estado.regenerativo, estado.agregados]);

  // Cada propuesto entra (sin motivo) hasta que se lo saque.
  useEffect(() => {
    setEstado((antes) => {
      const ids = new Set(propuestosNoEntrenaron.map((jugador) => String(jugador.id)));
      const noEntrenaron = {};
      ids.forEach((id) => {
        noEntrenaron[id] = antes.noEntrenaron[id] || { va: true, motivo: "", tipoSesion: "" };
      });
      const iguales = Object.keys(noEntrenaron).length === Object.keys(antes.noEntrenaron).length && Object.keys(noEntrenaron).every((id) => antes.noEntrenaron[id]);
      return iguales ? antes : { ...antes, noEntrenaron };
    });
  }, [propuestosNoEntrenaron]);

  const resultado = useMemo(() => {
    if (!armado) return null;
    const { filas } = calcularCarga(armado.carga, { reglas, columnas: gps.columnas, etiqueta });
    // Lo cambiado a mano en la tabla (lo que no es una medida de un jugador).
    return filas.map((fila, i) => {
      const cambios = estado.posteriores[claveDeSalida(fila)];
      const conCambios = cambios ? { ...fila, datos: { ...fila.datos, ...cambios } } : fila;
      Object.keys(cambios || {}).forEach((clave) => {
        if (conCambios.datos[clave] === null || conCambios.datos[clave] === undefined || conCambios.datos[clave] === "") delete conCambios.datos[clave];
      });
      return { ...conCambios, id: `cargar-${i}` };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armado, reglas, gps, config, estado.posteriores]);

  // Lo que ya está en la Base ese día (se avisa antes de guardar).
  useEffect(() => {
    if (!ultimo || !estado.fecha || !equipoId) return undefined;
    let vigente = true;
    setExistentes(null);
    listarGps(equipoId, { desde: estado.fecha, hasta: estado.fecha }).then((respuesta) => {
      if (vigente) setExistentes(respuesta.error ? null : respuesta.total);
    });
    return () => {
      vigente = false;
    };
  }, [ultimo, estado.fecha, equipoId]);

  // ------------------------------------------------------- Los controles --
  const elegir = ({ rotulo, lista, valor, alElegir, sinDato = true }) => {
    const suyas = opciones(lista);
    const lasDeLaHoja = [...(sinDato ? [{ valor: "", etiqueta: t("comun.sinDato") }] : []), ...suyas];
    const elegida = lasDeLaHoja.find((opcion) => opcion.valor === valor);
    return (
      <button type="button" className="selector-hoja" aria-label={rotulo} onClick={() => setHoja({ titulo: rotulo, opciones: lasDeLaHoja, valor, alElegir })}>
        <b>{elegida && elegida.valor !== "" ? elegida.etiqueta : rotulo}</b>
        <Icono nombre="flecha" size={15} />
      </button>
    );
  };
  const campo = (rotulo, control, clave = rotulo) => (
    <div className="campo-inicio lesiones-campo-paso" key={clave}>
      <label>{rotulo}</label>
      {control}
    </div>
  );
  const titulo = (clave) => gps.columnas.find((columna) => columna.clave === clave)?.titulo?.[idioma] || clave;
  const numero = (valor, alCambiar, { paso: incremento = "any" } = {}) => (
    <input type="number" inputMode="decimal" min="0" step={incremento} value={valor ?? ""} onChange={(evento) => alCambiar(evento.target.value === "" ? null : Number(evento.target.value))} />
  );

  // Tipo de sesión, zona de impacto y código, los tres de un bloque.
  const deUnBloque = (valores, alCambiar, { zona = true, codigo = true } = {}) => (
    <>
      {campo(titulo("tipo_sesion"), elegir({ rotulo: titulo("tipo_sesion"), lista: "tipo_sesion", valor: valores.tipoSesion || "", alElegir: (valor) => alCambiar({ tipoSesion: valor }) }), "tipo")}
      {zona && campo(titulo("zona_impacto"), elegir({ rotulo: titulo("zona_impacto"), lista: "zona_impacto", valor: valores.zona || "", alElegir: (valor) => alCambiar({ zona: valor }) }), "zona")}
      {codigo && campo(titulo("codigo_estrategia"), elegir({ rotulo: titulo("codigo_estrategia"), lista: "codigo_estrategia", valor: valores.codigo || "", alElegir: (valor) => alCambiar({ codigo: valor }) }), "codigo")}
    </>
  );

  // Elegir varios jugadores: el desplegable dice quiénes van y abre la lista
  // con casillas (la del filtro de las bases).
  const elegirJugadores = (rotulo, lista, elegidos, alCambiar) => {
    const suyos = lista.filter((uno) => elegidos.includes(uno.valor));
    return (
      <button
        type="button"
        className="selector-hoja"
        aria-label={rotulo}
        onClick={() => setHojaVarios({ titulo: rotulo, valores: lista.map((uno) => ({ clave: uno.valor, texto: uno.etiqueta })), elegidos: [...elegidos], busqueda: "", alAplicar: alCambiar })}
      >
        <b>{suyos.length ? suyos.map((uno) => uno.etiqueta).join(", ") : t("gps.cargar.elegirJugadores")}</b>
        <Icono nombre="flecha" size={15} />
      </button>
    );
  };

  // Un jugador agregado a mano a un bloque (un tiempo del partido o una
  // tarea; en el historial pasó: Santiago, 10/10). Sus números se escriben al
  // revisar. Se elige en un desplegable, sin los que ya están en el bloque.
  const agregarEn = (id, filasCsv) => {
    const agregados = estado.agregados[id] || [];
    const yaEstan = new Set([...filasCsv.map((fila) => quienDeNombre(fila.nombre)?.clave), ...agregados.map((uno) => uno.quien.clave)].filter(Boolean));
    return (
      <>
        {agregados.length > 0 && (
          <ul className="datos-importar-lista gps-cargar-agregados">
            {agregados.map((uno) => (
              <li key={uno.quien.clave}>
                <div className="datos-importar-fila">
                  <b>
                    {nombreDeQuien(uno.quien)} <span className="gps-cuantas">· {t("gps.cargar.agregado")}</span>
                  </b>
                  <button
                    type="button"
                    className="boton-detalle"
                    onClick={() => cambiar((antes) => ({ agregados: { ...antes.agregados, [id]: (antes.agregados[id] || []).filter((otro) => otro.quien.clave !== uno.quien.clave) } }))}
                  >
                    {t("gps.cargar.sacar")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="selector-hoja"
          aria-label={t("gps.cargar.agregarJugador")}
          onClick={() =>
            setHoja({
              titulo: t("gps.cargar.agregarJugador"),
              opciones: actualesPrimero(plantel)
                .filter((jugador) => !yaEstan.has(`j:${jugador.id}`))
                .map((jugador) => ({ valor: String(jugador.id), etiqueta: esActual(jugador) ? jugador.nombre : `${jugador.nombre} · ${t("datos.yaNoEsta")}` })),
              valor: null,
              buscador: true,
              alElegir: (valor) =>
                valor && cambiar((antes) => ({ agregados: { ...antes.agregados, [id]: [...(antes.agregados[id] || []), { quien: quienDeJugador({ id: Number(valor) }) }] } })),
            })
          }
        >
          <b>{t("gps.cargar.agregarJugador")}</b>
          <Icono nombre="flecha" size={15} />
        </button>
        {agregados.length > 0 && <p className="lesiones-ayuda">{t("gps.cargar.agregadoAyuda")}</p>}
      </>
    );
  };

  // ---------------------------------------------------------- Los pasos --
  const faltaEnPaso = (id) => {
    if (id === "csv") {
      if (!leido) return t("gps.cargar.faltaCsv");
      if (leido.error) return t(leido.error);
      if (sinElegir.length) return plural("gps.cargar.faltanNombres", sinElegir.length);
      if (!bloques || (!bloques.primer && !bloques.segundo && !bloques.tareas.length)) return t("gps.cargar.sinFilas");
    }
    if (id === "sesion") {
      if (!estado.fecha) return t("gps.cargar.faltaFecha");
      if (estado.fecha > hoy) return t("gps.error.fechaFutura");
    }
    return "";
  };
  const irAlPaso = (indice) => {
    for (let uno = paso; uno < indice; uno += 1) {
      const falta = faltaEnPaso(PASOS[uno]);
      if (falta) {
        setErrorPaso(falta);
        setPaso(uno);
        return;
      }
    }
    setErrorPaso("");
    setPaso(indice);
    window.scrollTo?.(0, 0);
  };

  const pasoCsv = (
    <>
      <section className="tarjeta datos-importar-pegado">
        <input ref={archivo} type="file" accept=".csv,text/csv,text/plain" multiple hidden onChange={(evento) => leerArchivos(evento.target.files).then(() => (evento.target.value = ""))} />
        <button type="button" className={`${estado.csv.length ? "boton-secundario" : "boton-principal"} gps-cargar-archivo`} onClick={() => archivo.current?.click()} disabled={Boolean(progreso)}>
          <Icono nombre="documento" size={16} />
          {estado.csv.length ? t("gps.cargar.otroArchivo") : t("gps.cargar.elegirArchivo")}
        </button>
        <textarea
          rows={3}
          defaultValue=""
          placeholder={t("gps.cargar.pegarAca")}
          aria-label={t("gps.cargar.pegarAca")}
          spellCheck={false}
          onPaste={(evento) => {
            const pegado = evento.clipboardData?.getData("text/plain") || evento.clipboardData?.getData("text") || "";
            if (!pegado) return;
            evento.preventDefault();
            sumarCsv(t("gps.cargar.pegado"), pegado);
          }}
          onChange={(evento) => {
            const escrito = evento.target.value;
            if (!escrito.trim()) return;
            evento.target.value = "";
            sumarCsv(t("gps.cargar.pegado"), escrito);
          }}
        />
        {estado.csv.length > 0 && (
          <div className="gps-pegado">
            <span>{estado.csv.map((uno) => uno.nombre).join(" · ")}</span>
            <button type="button" className="boton-secundario" onClick={() => setEstado(estadoInicial())}>
              <Icono nombre="borrar" size={15} />
              {t("gps.cargar.empezarDeNuevo")}
            </button>
          </div>
        )}
      </section>
      {bloques && (
        <section className="tarjeta tarjeta-ficha">
          <div className="cabeza-ficha">
            <b>{plural("gps.cargar.filasLeidas", leido.filas.length)}</b>
          </div>
          <ul className="datos-importar-lista">
            {bloques.primer && <li>{plural("gps.cargar.bloque", bloques.primer.filas.length, { nombre: t("gps.cargar.primerTiempo") })}</li>}
            {bloques.segundo && <li>{plural("gps.cargar.bloque", bloques.segundo.filas.length, { nombre: t("gps.cargar.segundoTiempo") })}</li>}
            {bloques.tareas.map((bloque) => (
              <li key={bloque.nombre}>{plural("gps.cargar.bloque", bloque.filas.length, { nombre: bloque.nombre })}</li>
            ))}
          </ul>
          {leido.faltan.length > 0 && <p className="datos-importar-aviso">{t("gps.cargar.faltanColumnas", { columnas: leido.faltan.map(titulo).join(", ") })}</p>}
        </section>
      )}
      {plantelSinLeer && <div className="lesiones-estado error">{t("gps.importar.plantelSinLeer")}</div>}
      {nombresAElegir.length > 0 && (
        <section className="tarjeta tarjeta-ficha">
          <div className="cabeza-ficha">
            <b>{plural("gps.importar.nombres", nombresAElegir.length)}</b>
          </div>
          {sinElegir.some((uno) => !uno.dudoso) && (
            <div className="datos-importar-elegir-todos">
              <p className="lesiones-ayuda">{plural("gps.importar.fueraDeDatos", sinElegir.filter((uno) => !uno.dudoso).length)}</p>
              <button
                type="button"
                className="boton-secundario datos-importar-confirmar"
                onClick={() => cambiar((antes) => ({ elegidos: { ...antes.elegidos, ...Object.fromEntries(sinElegir.filter((uno) => !uno.dudoso).map((uno) => [uno.llave, COMO_PERSONA])) } }))}
              >
                {plural("gps.importar.guardarTodosIgual", sinElegir.filter((uno) => !uno.dudoso).length)}
              </button>
            </div>
          )}
          <ul className="datos-importar-lista">
            {nombresAElegir.map((uno) => (
              <li key={uno.llave} className={uno.destino === NO_CARGAR ? "apagada" : ""}>
                <div className="datos-importar-fila">
                  <b>
                    {uno.nombre} <span className="gps-cuantas">· {plural("gps.importar.filasDelNombre", uno.filas)}</span>
                  </b>
                  <button
                    type="button"
                    className={`datos-importar-destino ${uno.destino === NO_CARGAR ? "fuera" : uno.destino ? "nuevo" : "dudoso"}`}
                    onClick={() =>
                      setHoja({
                        titulo: t("gps.importar.quienEs", { nombre: uno.nombre }),
                        opciones: [
                          { valor: COMO_PERSONA, etiqueta: t("gps.importar.comoPersona") },
                          { valor: NO_CARGAR, etiqueta: t("gps.importar.noCargar") },
                          ...actualesPrimero(plantel).map((jugador) => ({ valor: String(jugador.id), etiqueta: esActual(jugador) ? jugador.nombre : `${jugador.nombre} · ${t("datos.yaNoEsta")}` })),
                        ],
                        valor: uno.destino,
                        buscador: true,
                        alElegir: (destino) => cambiar((antes) => ({ elegidos: { ...antes.elegidos, [uno.llave]: destino } })),
                      })
                    }
                  >
                    <span>
                      {uno.destino === COMO_PERSONA
                        ? t("gps.importar.estado.comoPersona")
                        : uno.destino === NO_CARGAR
                          ? t("gps.importar.estado.noVa")
                          : uno.destino
                            ? t("gps.importar.es", { jugador: jugadorDe(uno.destino)?.nombre || "—" })
                            : t(uno.dudoso ? "gps.importar.estado.dudoso" : "gps.importar.estado.sinJugador")}
                    </span>
                    <Icono nombre="flecha" size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  const microciclo = microcicloDe(estado.fecha, reglas.inicioMicrociclo);
  const pasoSesion = (
    <>
      <section className="tarjeta tarjeta-ficha lesiones-grupo">
        {campo(t("gps.cargar.fecha"), <input type="date" value={estado.fecha} max={hoy} onChange={(evento) => cambiar({ fecha: evento.target.value })} />, "fecha")}
        {microciclo !== null && <p className="lesiones-ayuda gps-cargar-microciclo">{t("gps.cargar.microciclo", { n: microciclo })}</p>}
        {campo(titulo("tipo_microciclo"), elegir({ rotulo: titulo("tipo_microciclo"), lista: "tipo_microciclo", valor: estado.tipoMicrociclo, alElegir: (valor) => cambiar({ tipoMicrociclo: valor }) }), "tmic")}
        {campo(
          t("gps.cargar.dia"),
          <>
            <button
              type="button"
              className="selector-hoja"
              aria-label={t("gps.cargar.dia")}
              onClick={() =>
                setHoja({ titulo: t("gps.cargar.dia"), opciones: [{ valor: "", etiqueta: t("comun.sinDato") }, ...DIAS.map((dia) => ({ valor: dia, etiqueta: dia }))], valor: estado.dia, alElegir: (valor) => cambiar({ dia: valor }) })
              }
            >
              <b>{estado.dia || t("gps.cargar.dia")}</b>
              <Icono nombre="flecha" size={15} />
            </button>
            <small className="lesiones-ayuda">{t("gps.cargar.diaAyuda", { hora: `${Math.floor(reglas.horaDeLaTarde / 3600)}:${String(Math.floor((reglas.horaDeLaTarde % 3600) / 60)).padStart(2, "0")}` })}</small>
          </>,
          "dia",
        )}
        {campo(titulo("dispositivo"), opciones("dispositivo").length ? elegir({ rotulo: titulo("dispositivo"), lista: "dispositivo", valor: estado.dispositivo, alElegir: (valor) => cambiar({ dispositivo: valor }) }) : <p className="lesiones-ayuda">{t("gps.importar.sinDispositivos")}</p>, "disp")}
      </section>
      <section className="lesiones-paso-titulo">
        <h2>{t("gps.cargar.promedioSesion")}</h2>
        <p>{t("gps.cargar.promedioSesionAyuda")}</p>
      </section>
      <section className="tarjeta tarjeta-ficha lesiones-grupo">{deUnBloque(estado.sesion, (cambios) => cambiar((antes) => ({ sesion: { ...antes.sesion, ...cambios } })))}</section>
    </>
  );

  const cambiarPartido = (parte, cambios) => cambiar((antes) => ({ partido: { ...antes.partido, [parte]: { ...antes.partido[parte], ...cambios } } }));
  const pasoPartido = (
    <>
      <section className="tarjeta tarjeta-ficha lesiones-grupo">
        {campo(
          t("gps.cargar.nombrePartido"),
          <>
            <input type="text" maxLength={120} value={estado.partido.nombre} placeholder={t("gps.cargar.nombrePartidoEjemplo")} onChange={(evento) => cambiar((antes) => ({ partido: { ...antes.partido, nombre: evento.target.value } }))} />
            <small className="lesiones-ayuda">{t("gps.cargar.nombrePartidoAyuda")}</small>
          </>,
          "nombre",
        )}
        {campo(titulo("tarea_partido"), elegir({ rotulo: titulo("tarea_partido"), lista: "tarea_partido", valor: estado.partido.tareaPartido, alElegir: (valor) => cambiar((antes) => ({ partido: { ...antes.partido, tareaPartido: valor } })) }), "tp")}
      </section>
      {[
        ["primer", t("gps.cargar.primerTiempo")],
        ["segundo", t("gps.cargar.segundoTiempo")],
        ["completo", t("gps.cargar.partidoCompleto")],
      ]
        .filter(([parte]) => parte === "completo" || bloques?.[parte])
        .map(([parte, rotulo]) => (
          <details key={parte} className="tarjeta tarjeta-ficha gps-cargar-bloque" open={abierta === parte} onToggle={(evento) => evento.currentTarget.open && setAbierta(parte)}>
            <summary>
              <b>{rotulo}</b>
              {bloques?.[parte] && <span className="gps-cuantas">{plural("gps.cargar.jugadores", bloques[parte].filas.length + (estado.agregados[parte]?.length || 0))}</span>}
            </summary>
            <div className="lesiones-grupo">
              {deUnBloque(estado.partido[parte], (cambios) => cambiarPartido(parte, cambios))}
              {bloques?.[parte] && agregarEn(parte, bloques[parte].filas)}
            </div>
          </details>
        ))}
      <details className="tarjeta tarjeta-ficha gps-cargar-bloque" open={abierta === "banco"} onToggle={(evento) => evento.currentTarget.open && setAbierta("banco")}>
        <summary>
          <b>{t("gps.cargar.sinIngresar")}</b>
          <span className="gps-cuantas">{estado.partido.banco.jugadores.length || ""}</span>
        </summary>
        <div className="lesiones-grupo">
          <p className="lesiones-ayuda">{t("gps.cargar.sinIngresarAyuda")}</p>
          {elegirJugadores(
            t("gps.cargar.sinIngresar"),
            actuales.filter((jugador) => !enElPartido.has(`j:${jugador.id}`)).map((jugador) => ({ valor: jugador.id, etiqueta: jugador.nombre })),
            estado.partido.banco.jugadores,
            (jugadores) => cambiarPartido("banco", { jugadores }),
          )}
          {deUnBloque(estado.partido.banco, (cambios) => cambiarPartido("banco", cambios), { zona: false })}
        </div>
      </details>
    </>
  );

  // Cada tarea: sus datos (una vez por tarea) y sus jugadores, con su «Va».
  const cambiarTarea = (nombre, cambios) => cambiar((antes) => ({ tareas: { ...antes.tareas, [nombre]: { ...(antes.tareas[nombre] || { nombre }), ...cambios } } }));
  const filasDeLaTarea = (bloque) => {
    const seccion = estado.adicional === bloque.nombre ? "adicional" : `tarea:${bloque.nombre}`;
    return (resultado || []).filter((fila) => fila._seccion === seccion && !fila.promedio);
  };
  const pasoTareas = (
    <>
      {(bloques?.tareas || []).map((bloque) => {
        const suya = estado.tareas[bloque.nombre] || { nombre: bloque.nombre };
        const esAdicional = estado.adicional === bloque.nombre;
        const id = `t:${bloque.nombre}`;
        const suyas = filasDeLaTarea(bloque);
        return (
          <details key={bloque.nombre} className={`tarjeta tarjeta-ficha gps-cargar-bloque ${suya.quitada ? "apagada" : ""}`} open={abierta === bloque.nombre} onToggle={(evento) => evento.currentTarget.open && setAbierta(bloque.nombre)}>
            <summary>
              <b>{suya.nombre || bloque.nombre}</b>
              <span className="gps-cuantas">
                {plural("gps.cargar.jugadores", bloque.filas.length + (estado.agregados[id]?.length || 0))}
                {esAdicional ? ` · ${t("gps.cargar.adicional")}` : ""}
                {suya.quitada ? ` · ${t("gps.cargar.quitada")}` : ""}
              </span>
            </summary>
            {!suya.quitada && (
              <div className="lesiones-grupo">
                {campo(t("gps.cargar.nombreTarea"), <input type="text" maxLength={200} value={suya.nombre ?? bloque.nombre} onChange={(evento) => cambiarTarea(bloque.nombre, { nombre: evento.target.value })} />, "nombre")}
                {deUnBloque(suya, (cambios) => cambiarTarea(bloque.nombre, cambios))}
                <div className="gps-cargar-medidas">
                  {campo(t("gps.cargar.nroJugadores"), numero(suya.jugadores, (valor) => cambiarTarea(bloque.nombre, { jugadores: valor }), { paso: 1 }), "jug")}
                  {campo(t("gps.cargar.pausa"), numero(suya.pausa, (valor) => cambiarTarea(bloque.nombre, { pausa: valor }), { paso: 1 }), "pausa")}
                  {campo(titulo("cp_jug"), numero(suya.cpJug, (valor) => cambiarTarea(bloque.nombre, { cpJug: valor })), "cpjug")}
                  {campo(titulo("largo"), numero(suya.largo, (valor) => cambiarTarea(bloque.nombre, { largo: valor })), "largo")}
                  {campo(titulo("ancho"), numero(suya.ancho, (valor) => cambiarTarea(bloque.nombre, { ancho: valor })), "ancho")}
                  {campo(titulo("base"), numero(suya.base, (valor) => cambiarTarea(bloque.nombre, { base: valor })), "base")}
                </div>
                <label className="gps-cargar-casilla">
                  <input type="checkbox" checked={suya.enLaDescripcion !== false} onChange={(evento) => cambiarTarea(bloque.nombre, { enLaDescripcion: evento.target.checked })} />
                  {t("gps.cargar.enLaDescripcion")}
                </label>
                <p className="lesiones-ayuda">{t("gps.cargar.vaTareaAyuda", { parte: Math.round(reglas.parteDelTiempo * 100) })}</p>
                <ul className="datos-importar-lista gps-cargar-filas">
                  {suyas.map((fila) => {
                    const fuente = armado?.fuentes?.[fila._seccion]?.[fila._fila];
                    const va = fila._vaTarea === "si";
                    return (
                      <li key={fuente}>
                        <div className="datos-importar-fila">
                          <b>
                            {nombreDeQuien({ jugador_id: fila.jugador_id, persona: fila.persona })} <span className="gps-cuantas">· {textoDeSegundos(fila.datos.tiempo)}</span>
                          </b>
                          <button
                            type="button"
                            className="selector-hoja gps-cargar-va"
                            aria-label={`${t("gps.cargar.va")}: ${nombreDeQuien({ jugador_id: fila.jugador_id, persona: fila.persona })}`}
                            onClick={() =>
                              setHoja({
                                titulo: `${t("gps.cargar.va")}: ${nombreDeQuien({ jugador_id: fila.jugador_id, persona: fila.persona })}`,
                                opciones: [
                                  { valor: "si", etiqueta: t("gps.cargar.va") },
                                  { valor: "no", etiqueta: t("gps.cargar.noVa") },
                                ],
                                valor: va ? "si" : "no",
                                alElegir: (elegido) => elegido && cambiar((antes) => ({ vaTarea: { ...antes.vaTarea, [fuente]: elegido } })),
                              })
                            }
                          >
                            <b>{va ? t("gps.cargar.va") : t("gps.cargar.noVa")}</b>
                            <Icono nombre="flecha" size={13} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {agregarEn(id, bloque.filas)}
              </div>
            )}
            <div className="acciones-registro gps-cargar-acciones">
              {!suya.quitada && (!estado.adicional || esAdicional) && (
                <button type="button" className="boton-detalle" onClick={() => cambiar({ adicional: esAdicional ? null : bloque.nombre })}>
                  {esAdicional ? t("gps.cargar.volverATareas") : t("gps.cargar.pasarAAdicional")}
                </button>
              )}
              <button
                type="button"
                className="boton-detalle"
                onClick={() => {
                  cambiarTarea(bloque.nombre, { quitada: !suya.quitada });
                  if (esAdicional) cambiar({ adicional: null });
                }}
              >
                {suya.quitada ? t("gps.cargar.volverAPoner") : t("gps.cargar.quitar")}
              </button>
            </div>
          </details>
        );
      })}
    </>
  );

  const regenerativo = estado.regenerativo;
  const posiblesRegenerativo = useMemo(() => {
    const lista = new Map();
    actuales.forEach((jugador) => lista.set(`j:${jugador.id}`, jugador.nombre));
    enElCsv.forEach((quien) => !lista.has(quien.clave) && lista.set(quien.clave, nombreDeQuien(quien)));
    return [...lista.entries()].map(([valor, etiqueta]) => ({ valor, etiqueta }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actuales, enElCsv]);
  const motivos = [...new Set(Object.values(estado.noEntrenaron).map((uno) => uno.motivo?.trim()).filter(Boolean))];
  const pasoJugadores = (
    <>
      <section className="tarjeta tarjeta-ficha lesiones-grupo">
        <label className="gps-cargar-casilla">
          <input type="checkbox" checked={regenerativo.hubo} onChange={(evento) => cambiar((antes) => ({ regenerativo: { ...antes.regenerativo, hubo: evento.target.checked } }))} />
          <b>{t("gps.cargar.huboRegenerativo")}</b>
        </label>
        {regenerativo.hubo && (
          <>
            {campo(
              t("gps.cargar.duracion"),
              <input
                type="text"
                inputMode="numeric"
                defaultValue={textoDeSegundos(regenerativo.duracion)}
                onBlur={(evento) => {
                  const segundos = leerSegundos(evento.target.value);
                  if (typeof segundos === "number") cambiar((antes) => ({ regenerativo: { ...antes.regenerativo, duracion: segundos } }));
                  else evento.target.value = textoDeSegundos(regenerativo.duracion);
                }}
              />,
              "duracion",
            )}
            <p className="lesiones-ayuda">{t("gps.cargar.regenerativoAyuda", { n: reglas.minimoRegenerativo })}</p>
            {elegirJugadores(t("gps.cargar.quienesRegenerativo"), posiblesRegenerativo, regenerativo.jugadores, (jugadores) => cambiar((antes) => ({ regenerativo: { ...antes.regenerativo, jugadores } })))}
          </>
        )}
      </section>
      <section className="lesiones-paso-titulo">
        <h2>{t("gps.cargar.noEntrenaron")}</h2>
        <p>{t("gps.cargar.noEntrenaronAyuda")}</p>
      </section>
      {propuestosNoEntrenaron.length === 0 ? (
        <p className="lesiones-vacio">{t("gps.cargar.todosEntrenaron")}</p>
      ) : (
        <section className="tarjeta tarjeta-ficha">
          <datalist id="gps-cargar-motivos">
            {motivos.map((motivo) => (
              <option key={motivo} value={motivo} />
            ))}
          </datalist>
          <ul className="datos-importar-lista">
            {propuestosNoEntrenaron.map((jugador) => {
              const suyo = estado.noEntrenaron[String(jugador.id)] || { va: true, motivo: "", tipoSesion: "" };
              const cambiarSuyo = (cambios) => cambiar((antes) => ({ noEntrenaron: { ...antes.noEntrenaron, [String(jugador.id)]: { ...suyo, ...cambios } } }));
              return (
                <li key={jugador.id} className={suyo.va === false ? "apagada" : ""}>
                  <div className="datos-importar-fila">
                    <b>{jugador.nombre}</b>
                    <button type="button" className="boton-detalle" onClick={() => cambiarSuyo({ va: suyo.va === false })}>
                      {suyo.va === false ? t("gps.cargar.volverAPoner") : t("gps.cargar.sacar")}
                    </button>
                  </div>
                  {suyo.va !== false && (
                    <div className="gps-cargar-motivo">
                      <input type="text" maxLength={120} list="gps-cargar-motivos" placeholder={t("gps.cargar.motivo")} aria-label={t("gps.cargar.motivo")} value={suyo.motivo} onChange={(evento) => cambiarSuyo({ motivo: evento.target.value })} />
                      {elegir({ rotulo: titulo("tipo_sesion"), lista: "tipo_sesion", valor: suyo.tipoSesion || "", alElegir: (valor) => cambiarSuyo({ tipoSesion: valor }) })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );

  // Lo que se cambia en la tabla: una medida de Catapult de un jugador (se
  // recalculan los totales y los Team Average), el «Va» de un total (cambia
  // el Team Average de la sesión) o cualquier otra celda que no sale del CSV
  // (PSE, una lista, un texto, una columna del club…), que queda como se
  // escribió. Las medidas de un total o de un Team Average se calculan.
  const editarCelda = async (filaId, clave, valor) => {
    if (aMedias) return { error: "gps.cargar.yaEmpezo" };
    const fila = resultado?.find((una) => una.id === filaId);
    if (!fila) return { error: "gps.cargar.seCalcula" };
    const columna = gps.columnas.find((una) => una.clave === clave);
    if (!columna || ["jugador", "fecha", "porMinuto"].includes(columna.tipo)) return { error: "gps.cargar.seCalcula" };
    const { fila: nueva, error } = conCambio(fila, clave, valor);
    if (error) return { error };
    if (!nueva) return {};
    const nuevo = nueva.datos?.[clave] ?? null;
    if (columna.catapult) {
      const fuente = fila._fila !== undefined && !fila.promedio ? armado?.fuentes?.[fila._seccion]?.[fila._fila] : null;
      if (!fuente) return { error: "gps.cargar.seCalcula" };
      cambiar((antes) => ({ ediciones: { ...antes.ediciones, [fuente]: { ...(antes.ediciones[fuente] || {}), [clave]: nuevo } } }));
      return {};
    }
    if (clave === "va" && fila._total && fila._quien) {
      cambiar((antes) => ({ va: { ...antes.va, [fila._quien]: nuevo || "" } }));
      return {};
    }
    const llave = claveDeSalida(fila);
    cambiar((antes) => ({ posteriores: { ...antes.posteriores, [llave]: { ...(antes.posteriores[llave] || {}), [clave]: nuevo } } }));
    return {};
  };

  const filasDeLaTabla = useMemo(() => (resultado || []).map((fila) => armarFila(fila)), [resultado, armarFila]);
  const columnasDeLaTabla = useMemo(() => columnas.map((columna) => (["jugador", "fecha"].includes(columna.clave) ? { ...columna, editable: false } : columna)), [columnas]);
  const deJugadores = (resultado || []).filter((fila) => !fila.promedio).length;

  const pasoRevisar = (
    <>
      <p className="datos-importar-resumen">
        {plural("gps.cargar.resumen", resultado?.length || 0, { jugadores: deJugadores, promedios: (resultado?.length || 0) - deJugadores, fecha: estado.fecha ? fechaCorta(estado.fecha) : "—" })}
      </p>
      {existentes > 0 && !aMedias && <p className="lesiones-estado error">{plural("gps.cargar.yaHay", existentes, { fecha: fechaCorta(estado.fecha) })}</p>}
      {aMedias && <p className="lesiones-estado error">{t("gps.cargar.aMedias", { n: aMedias.hechas, total: aMedias.lista.length })}</p>}
      <p className="lesiones-ayuda">{t("gps.cargar.revisarAyuda")}</p>
      <section className="tarjeta evaluaciones-tabla">
        <TablaDatos id="gps-cargar" recordar="gps:cargar" columnas={columnasDeLaTabla} filas={filasDeLaTabla} fijas={fijas} onEditar={editarCelda} />
      </section>
      {falla && <div className="lesiones-estado error">{t(falla)}</div>}
    </>
  );

  // Se guarda en el orden de la plantilla, de a tandas. Si se corta, lo
  // guardado queda y lo que falta se guarda al volver a tocar (lo de la
  // tabla ya no se cambia: sería otro día distinto del que se empezó).
  const guardar = async () => {
    const lista =
      aMedias?.lista ||
      (resultado || []).map((fila) => Object.fromEntries(Object.entries(fila).filter(([clave]) => !clave.startsWith("_") && clave !== "id")));
    const desde = aMedias?.hechas || 0;
    const quedan = lista.slice(desde);
    if (!quedan.length) return;
    setFalla("");
    setProgreso({ n: desde, total: lista.length });
    const { creadas, error } = await crearFilasGps(equipoId, quedan, {
      alAvanzar: (n) => enPantalla.current && setProgreso({ n: desde + n, total: lista.length }),
      seguir: () => enPantalla.current,
    });
    if (!enPantalla.current) return;
    setProgreso(null);
    const hechas = desde + creadas.length;
    if (error) {
      setFalla(error);
      if (hechas) setAMedias({ lista, hechas });
      return;
    }
    setAMedias(null);
    onListo?.({ cargadas: lista.length, fecha: estado.fecha });
  };

  const titulos = {
    csv: t("gps.cargar.pasoCsv"),
    sesion: t("gps.cargar.pasoSesion"),
    partido: t("gps.cargar.pasoPartido"),
    tareas: t("gps.cargar.pasoTareas"),
    jugadores: t("gps.cargar.pasoJugadores"),
    revisar: t("gps.cargar.pasoRevisar"),
  };
  const ayudas = {
    csv: t("gps.cargar.csvAyuda"),
    tareas: t("gps.cargar.tareasAyuda"),
    jugadores: t("gps.cargar.jugadoresAyuda"),
  };
  const contenido = { csv: pasoCsv, sesion: pasoSesion, partido: pasoPartido, tareas: pasoTareas, jugadores: pasoJugadores, revisar: pasoRevisar }[actual];

  return (
    <div className="app">
      <div className={`contenedor ${actual === "revisar" ? "contenedor-base" : ""}`}>
        <header className="encabezado lesiones-encabezado">
          <div className="lesiones-encabezado-texto">
            <h1>{t("gps.cargar.titulo")}</h1>
            <p>{t("gps.cargar.texto")}</p>
            <div className="lesiones-progreso" role="tablist" aria-label={t("lesiones.pasos.paso", { n: paso + 1, total: PASOS.length })}>
              {PASOS.map((id, indice) => (
                <button
                  type="button"
                  role="tab"
                  key={id}
                  aria-selected={indice === paso}
                  className={`${indice === paso ? "actual" : ""} ${indice < paso ? "hecho" : ""}`.trim()}
                  onClick={() => irAlPaso(indice)}
                  disabled={Boolean(progreso || aMedias)}
                  aria-label={titulos[id]}
                />
              ))}
            </div>
            <p className="lesiones-paso-numero">{t("lesiones.pasos.paso", { n: paso + 1, total: PASOS.length })}</p>
          </div>
          <SelectorIdioma className="lesiones-idioma" />
        </header>

        <section className="lesiones-paso-titulo">
          <h2>{titulos[actual]}</h2>
          {ayudas[actual] && <p>{ayudas[actual]}</p>}
        </section>

        {!enLinea && <p className="lesiones-estado">{t("gps.estado.sinConexion")}</p>}
        {errorPaso && <div className="aviso-hoja">{errorPaso}</div>}
        {contenido}

        <div className="acciones-dobles">
          {aMedias ? (
            <span />
          ) : (
            <BotonVolver onClick={() => (paso === 0 ? onCancelar?.() : irAlPaso(paso - 1))} disabled={Boolean(progreso)}>
              {paso === 0 ? t("comun.cancelar") : t("lesiones.pasos.atras")}
            </BotonVolver>
          )}
          {ultimo ? (
            <button type="button" className="boton-principal" onClick={guardar} disabled={Boolean(progreso) || !enLinea || !resultado?.length}>
              {progreso
                ? t("gps.cargar.guardando", { n: progreso.n, total: progreso.total })
                : aMedias
                  ? plural("gps.cargar.guardarFaltan", aMedias.lista.length - aMedias.hechas)
                  : plural("gps.cargar.guardar", resultado?.length || 0)}
            </button>
          ) : (
            <button type="button" className="boton-principal" onClick={() => irAlPaso(paso + 1)}>
              {t("lesiones.pasos.siguiente")}
            </button>
          )}
        </div>
      </div>

      <HojaOpciones
        abierta={Boolean(hoja)}
        titulo={hoja?.titulo || ""}
        opciones={hoja?.opciones || []}
        elegida={hoja?.valor ?? null}
        buscador={hoja?.buscador || (hoja?.opciones?.length || 0) > 8}
        onElegir={(valor) => {
          hoja?.alElegir(valor);
          setHoja(null);
        }}
        onCerrar={() => setHoja(null)}
      />

      <HojaInferior
        abierta={Boolean(hojaVarios)}
        className="tabla-datos-hoja-filtro"
        titulo={hojaVarios?.titulo || ""}
        onCerrar={() => setHojaVarios(null)}
        acciones={
          <>
            <button type="button" className="boton-cancelar-hoja" onClick={() => setHojaVarios(null)}>
              {t("comun.cancelar")}
            </button>
            <button
              type="button"
              className="boton-confirmar-hoja"
              onClick={() => {
                hojaVarios?.alAplicar(hojaVarios.valores.map((uno) => uno.clave).filter((clave) => hojaVarios.elegidos.includes(clave)));
                setHojaVarios(null);
              }}
            >
              {t("comun.listo")}
            </button>
          </>
        }
      >
        {hojaVarios && (
          <div className="tabla-datos-filtro-cuerpo">
            <ListaParaMarcar
              valores={hojaVarios.valores}
              elegidos={hojaVarios.elegidos}
              onCambiar={(elegidos) => setHojaVarios((antes) => ({ ...antes, elegidos }))}
              busqueda={hojaVarios.busqueda}
              onBuscar={(busqueda) => setHojaVarios((antes) => ({ ...antes, busqueda }))}
            />
          </div>
        )}
      </HojaInferior>
    </div>
  );
}

