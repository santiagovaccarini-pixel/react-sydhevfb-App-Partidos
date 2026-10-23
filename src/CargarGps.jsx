import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { ListaParaMarcar } from "./components/ListaParaMarcar.jsx";
import { HojaInferior } from "./components/SheetPanel.js";
import { TablaDatos } from "./components/TablaDatos.jsx";
import { useConsentimientoPersonas } from "./components/Consentimiento.jsx";
import { AvisoDeEspera, falloDeRed } from "./components/SinSenal.jsx";
import { opcionesDeLista, tituloDeColumna } from "./domain/evaluaciones/ajustes.js";
import { configGpsVacia } from "./domain/gps/ajustes.js";
import {
  REGLAS_CARGA,
  VS_PARTIDO,
  bloquesDelCsv,
  calcularCarga,
  esArquero,
  faltaLoObligatorio,
  filasDeLaMismaSesion,
  filasEnOtroCsv,
  filasYaEnLaBase,
  leerCsvCatapult,
  llegaAlCorte,
  microcicloDe,
  vrPartidoDelDispositivo,
  vsPartido,
} from "./domain/gps/cargar.js";
import { LISTAS_GPS } from "./domain/gps/columnas.js";
import { esLocal } from "./domain/gps/espera.js";
import { COMO_PERSONA, NO_CARGAR, buscadorDelGps, leerSegundos } from "./domain/gps/importar.js";
import { esNumero, textoDeSegundos } from "./domain/gps/valores.js";
import { borrarEnCurso, crearFilasGps, dejarEnCurso, enCursosDelDia, guardarDiaGps, leerDispositivosRecordados, leerEnCurso, listarGps, partidoDelDia, recordarDispositivo } from "./domain/gpsDb.js";
import { DUDOSO, nombreIgual } from "./domain/importarPersonas.js";
import { actualesPrimero, cargarPlantelConCatapult, esActual } from "./domain/plantel.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, fechaYHora, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import { BotonGuia, TerminoDe, TextoConPasos } from "./components/Guia.jsx";

// GPS › Cargar (paso 2): lo de cada día con la lógica de la plantilla «Suma
// de Bloques» (las cuentas, en domain/gps/cargar.js). Un paso por cada
// bloque de la plantilla (Santiago, 12/10: «Cada paso a completar tienen que
// ser las tareas del día»): el CSV (y si ya está en la Base, no se sigue),
// cada tiempo del partido, el partido completo, cada tarea, el regenerativo
// y los que no entrenaron y, al final, la sesión («la sesion tiene que ser la
// final», sale de todas las tareas y el partido). Cada bloque se ve como en
// la plantilla: arriba lo que se escribe del bloque y abajo todos sus
// jugadores con todos sus datos, en una tabla como la de la Base, donde se
// corrige. Antes de guardar se ve todo lo que va a la Base.
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

// Lo que se escribe arriba de cada bloque. lista: se elige en un
// desplegable; numero / texto: se escribe; columna: el nombre es el de esa
// columna de la Base (como lo llame el club). grupo: en qué parte de la
// tarjeta va (Santiago, 13/10: «hay que encontrar una manera de darle orden
// visual y separar las cosas»): el nombre (la tarea, el partido o la
// sesión, con el tipo de sesión: «tiene que ir con la tarea», 13/10), las
// medidas (con los m²) y la pausa (con las C/P).
const ENCABEZADO_DEL_PARTIDO = [
  { campo: "tipoSesion", lista: "tipo_sesion", columna: "tipo_sesion", grupo: "nombre" },
  { campo: "codigo", lista: "codigo_estrategia", columna: "codigo_estrategia", grupo: "nombre" },
  { campo: "zona", lista: "zona_impacto", columna: "zona_impacto", grupo: "nombre" },
  { campo: "largo", tipo: "numero", columna: "largo", grupo: "medidas" },
  { campo: "ancho", tipo: "numero", columna: "ancho", grupo: "medidas" },
  { campo: "jugadores", tipo: "numero", rotulo: "gps.cargar.nroJugadores", paso: 1, grupo: "medidas" },
  { campo: "m2", tipo: "numero", columna: "m2", grupo: "medidas" },
  { campo: "series", tipo: "numero", rotulo: "gps.cargar.series", paso: 1, grupo: "pausa" },
  { campo: "bloques", tipo: "numero", rotulo: "gps.cargar.bloques", paso: 1, grupo: "pausa" },
  { campo: "pausa", tipo: "texto", rotulo: "gps.cargar.pausaDelPartido", grupo: "pausa" },
];
const ENCABEZADO_DE_TAREA = [
  { campo: "nombre", tipo: "texto", rotulo: "gps.cargar.nombreTarea", largo: true, grupo: "nombre" },
  { campo: "tipoSesion", lista: "tipo_sesion", columna: "tipo_sesion", grupo: "nombre" },
  { campo: "codigo", lista: "codigo_estrategia", columna: "codigo_estrategia", grupo: "nombre" },
  { campo: "zona", lista: "zona_impacto", columna: "zona_impacto", grupo: "nombre" },
  { campo: "base", tipo: "numero", columna: "base", grupo: "medidas" },
  { campo: "largo", tipo: "numero", columna: "largo", grupo: "medidas" },
  { campo: "ancho", tipo: "numero", columna: "ancho", grupo: "medidas" },
  { campo: "jugadores", tipo: "numero", rotulo: "gps.cargar.nroJugadores", paso: 1, grupo: "medidas" },
  { campo: "pausa", tipo: "numero", rotulo: "gps.cargar.pausa", paso: 1, grupo: "pausa" },
  { campo: "cpJug", tipo: "numero", columna: "cp_jug", grupo: "pausa" },
];
const ENCABEZADO_DE_LA_SESION = ENCABEZADO_DE_TAREA.filter((uno) => uno.campo !== "nombre");

const estadoInicial = () => ({
  csv: [],
  fecha: "",
  tipoMicrociclo: "",
  dia: "",
  dispositivo: "",
  sesion: { tipoSesion: "", zona: "", codigo: "" },
  // nombreAMano: el nombre del partido se escribió (ya no lo cambia el de Partido).
  // banco.aMano: los que no ingresaron se eligieron (ya no los cambia Partido).
  partido: { nombre: "", nombreAMano: false, tareaPartido: "partido_oficial_torneo", primer: {}, segundo: {}, completo: {}, banco: { jugadores: [], aMano: false } },
  tareas: {},
  adicional: null,
  regenerativo: { hubo: false, duracion: REGENERATIVO_AL_EMPEZAR, jugadores: [] },
  noEntrenaron: {},
  elegidos: {},
  // Quién es un nombre del CSV en un bloque (usó el GPS de otro): { [bloque]: { [nombre]: id } }.
  renombres: {},
  ediciones: {},
  agregados: {},
  vaTarea: {},
  va: {},
  posteriores: {},
});

// Lo que se guarda de una carga sin terminar: todo lo hecho (el CSV, lo
// elegido y lo corregido). Lo demás sale de ahí.
export const FORMATO_EN_CURSO = 1;
const estadoDeEnCurso = (datos) => (datos?.formato === FORMATO_EN_CURSO && datos.estado && typeof datos.estado === "object" ? { ...estadoInicial(), ...datos.estado } : estadoInicial());
// Las filas del CSV de una carga sin terminar (para ver si es el mismo CSV).
export const filasDelCsvEnCurso = (datos, columnas) => estadoDeEnCurso(datos).csv.flatMap((uno) => leerCsvCatapult(uno.texto, columnas).filas);

export default function CargarGps({
  gps,
  config = configGpsVacia(),
  equipoId,
  plantel = [],
  plantelSinLeer = false,
  reglas = REGLAS_CARGA,
  // Los V.R. de cada dispositivo: el % vs V.R. de partido usa el marcado «de
  // partido» del dispositivo de la carga (Santiago, 14/10). vrPartidoViejo:
  // el de las reglas, mientras la base no tenga la actualización 20261025.
  referencias = [],
  vrPartidoViejo = null,
  columnas = [],
  fijas = [],
  armarFila,
  conCambio,
  enLinea = true,
  // La carga sin terminar que se sigue: { id, version, paso, datos } (sin ella, una nueva).
  enCurso = null,
  // Sin señal (paso 3c.2b de «cargar sin señal…»; Santiago, 23/10): lo
  // guardado y lo dejado para revisar quedan en este aparato y se suben solos
  // cuando vuelve la señal. { filas: las que se ven en la Base, enCurso: las
  // dejadas en este aparato, alGuardar(día), alDejar(carga) → su id,
  // quitar(id) → la que estaba }. Sin él, todo con señal.
  delAparato = null,
  onListo,
  onCancelar,
  onSinGuardar,
  // Se dejó para revisar: ({ fecha }).
  onDejado,
  // Regla 1, «Ir a la Base»: quedó para revisar y se ven las filas de esa
  // sesión que ya estaban ({ fecha, dispositivo, filas, enCursoId }).
  onVerEnLaBase,
  // La siguieron en otro aparato: abrir la última (su id).
  onAbrirEnCurso,
  // Abre «Cómo se usa» de GPS.
  onGuia,
}) {
  const { idioma, plural } = useIdioma();
  const hoy = hoyISO();
  const [paso, setPaso] = useState(() => (enCurso?.datos ? enCurso.paso || 0 : 0));
  const [estado, setEstado] = useState(() => (enCurso?.datos ? estadoDeEnCurso(enCurso.datos) : estadoInicial()));
  // Dejar para revisar (Santiago, 13/10): la carga sin terminar que es esta
  // ({ id, version }; sin id, todavía no se dejó), si se está dejando y si la
  // siguieron en otro aparato en el medio.
  const [deEnCurso, setDeEnCurso] = useState(() => (enCurso?.id ? { id: enCurso.id, version: enCurso.version } : null));
  const esEnCurso = useRef(deEnCurso);
  esEnCurso.current = deEnCurso;
  const [dejando, setDejando] = useState(false);
  const [otroAparato, setOtroAparato] = useState(false);
  const [errorPaso, setErrorPaso] = useState("");
  const consentimiento = useConsentimientoPersonas(equipoId, "gps");
  const [hoja, setHoja] = useState(null);
  // El desplegable de varios abierto: { titulo, valores, elegidos, busqueda, alAplicar }.
  const [hojaVarios, setHojaVarios] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [falla, setFalla] = useState("");
  // Un guardado que se cortó: { lista (lo que se estaba guardando), hechas }.
  const [aMedias, setAMedias] = useState(null);
  // ¿El CSV ya está en la Base? { clave, estado: revisando | esta | noEsta | error, iguales, delDia }.
  const [revision, setRevision] = useState(null);
  // Regla 1: la sesión ya está ese día con otros datos: { filas } (las que se
  // reemplazarían), mientras se pregunta.
  const [otraSesion, setOtraSesion] = useState(null);
  const [intento, setIntento] = useState(0);
  const [intentoPartido, setIntentoPartido] = useState(0);
  // El partido de ese día en Partido: { fecha, estado: buscando | hay | noHay
  // | error, rival, noIngresaron } o null.
  const [delPartido, setDelPartido] = useState(null);
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
  // Los que se pueden elegir (los del plantel actual primero; sin los
  // arqueros si el club no los carga) y los del plantel actual.
  const elegibles = useMemo(() => actualesPrimero(plantel).filter((jugador) => reglas.conArqueros || !esArquero(jugador)), [plantel, reglas.conArqueros]);
  const actuales = useMemo(() => elegibles.filter(esActual), [elegibles]);
  const opcionDeJugador = (jugador) => ({ valor: String(jugador.id), etiqueta: esActual(jugador) ? jugador.nombre : `${jugador.nombre} · ${t("datos.yaNoEsta")}` });

  // Con un CSV leído hay algo sin guardar (la barra de abajo pregunta antes
  // de salir).
  useEffect(() => {
    onSinGuardar?.(estado.csv.length > 0);
  }, [estado.csv.length, onSinGuardar]);
  useEffect(() => () => onSinGuardar?.(false), [onSinGuardar]);

  const cambiar = (cambios) => setEstado((antes) => ({ ...antes, ...(typeof cambios === "function" ? cambios(antes) : cambios) }));

  // El dispositivo: de entrada, el último que eligió la cuenta al cargar un
  // CSV (nota del 17/10), si sigue en la lista y la carga todavía no tiene.
  const elegidoAMano = useRef(false);
  const listaDeDispositivos = useRef([]);
  useEffect(() => {
    let vigente = true;
    leerDispositivosRecordados(equipoId).then(({ csv }) => {
      if (!vigente || !csv || elegidoAMano.current || !listaDeDispositivos.current.some((opcion) => opcion.valor === csv)) return;
      setEstado((antes) => (antes.dispositivo ? antes : { ...antes, dispositivo: csv }));
    });
    return () => {
      vigente = false;
    };
  }, [equipoId]);
  const elegirDispositivo = (valor) => {
    elegidoAMano.current = true;
    cambiar({ dispositivo: valor });
    recordarDispositivo(equipoId, "csv", valor);
  };
  // Ese día ya tiene una carga sin terminar: quién la dejó y cuándo.
  const textoEnCurso = (otra) =>
    otra?.local
      ? t("gps.enCurso.enCursoEnEsteAparato", { fecha: fechaCorta(otra.fecha || estado.fecha) })
      : t("gps.enCurso.enCursoDelDia", {
          fecha: fechaCorta(otra?.fecha || estado.fecha),
          quien: otra?.actualizado_email || "—",
          cuando: otra?.actualizado_en ? fechaYHora(otra.actualizado_en) : "—",
        });

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
  // Los bloques del CSV con su clave (la de lo que se cambia a mano en cada uno).
  const bloquesConId = useMemo(
    () =>
      bloques
        ? [
            ...(bloques.primer ? [{ id: "primer", filas: bloques.primer.filas }] : []),
            ...(bloques.segundo ? [{ id: "segundo", filas: bloques.segundo.filas }] : []),
            ...bloques.tareas.map((bloque) => ({ id: `t:${bloque.nombre}`, nombre: bloque.nombre, filas: bloque.filas })),
          ]
        : [],
    [bloques],
  );

  // Los pasos: el CSV, cada tiempo del partido y el partido completo (si el
  // CSV los tiene), cada tarea, el regenerativo y los que no entrenaron, la
  // sesión y revisar.
  const hayPartido = Boolean(bloques?.primer || bloques?.segundo);
  const PASOS = [
    "csv",
    ...(bloques?.primer ? ["primer"] : []),
    ...(bloques?.segundo ? ["segundo"] : []),
    ...(hayPartido ? ["completo"] : []),
    ...(bloques?.tareas || []).map((bloque) => `tarea:${bloque.nombre}`),
    "jugadores",
    "sesion",
    "revisar",
  ];
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

  // ¿Ya está en la Base? Apenas se sabe la fecha (Santiago, 12/10: «si esta
  // avisa y no deja seguir, si no esta avisa y deja seguir»).
  const claveDeRevision = leido && !leido.error && /^\d{4}-\d{2}-\d{2}$/.test(estado.fecha) ? `${estado.fecha}|${estado.csv.length}|${leido.filas.length}|${intento}|${enLinea ? "" : "aparato"}` : "";
  useEffect(() => {
    if (!claveDeRevision || !equipoId) {
      setRevision(null);
      return undefined;
    }
    let vigente = true;
    setRevision({ clave: claveDeRevision, estado: "revisando" });
    // También si ese CSV ya está en otra carga sin terminar (que no sea esta).
    // Un día puede tener varias (otro turno); la del mismo CSV se frena y se
    // dice cuál es (Santiago, 23/10: «Deja que hayas mas de una por dia, pero
    // si cumple con las reglas de validacion avisa y lo descarta», con el
    // «Mismo CSV»; antes, 13/10, una por día: «lo frena y dice que ya esta en
    // curso ese cargado»).
    // Lo de este aparato que todavía no subió: los días guardados sin señal
    // (sin señal, todo lo que se ve en la Base) y las cargas dejadas acá.
    const filasDeAca = (todas) => (delAparato?.filas || []).filter((fila) => fila.fecha === estado.fecha && (todas || esLocal(fila.id)));
    const enCursoDeAca = () =>
      (delAparato?.enCurso || []).find((otra) => otra.fecha === estado.fecha && otra.id !== esEnCurso.current?.id && filasEnOtroCsv(leido.filas, filasDelCsvEnCurso(otra.datos, gps.columnas))) || null;
    // Sin señal, con lo de este aparato (al subir se mira otra vez).
    const conLoDeAca = () => {
      const filas = filasDeAca(true);
      const iguales = filasYaEnLaBase(leido.filas, filas);
      const deAca = iguales ? null : enCursoDeAca();
      if (deAca) setRevision({ clave: claveDeRevision, estado: "enCurso", enCurso: { ...deAca, local: true } });
      else setRevision({ clave: claveDeRevision, estado: iguales ? "esta" : "noEsta", iguales, delDia: filas.length, sinSenal: true });
    };
    const revisar = async () => {
      if (!enLinea && delAparato) {
        conLoDeAca();
        return;
      }
      const [respuesta, delDia] = await Promise.all([listarGps(equipoId, { desde: estado.fecha, hasta: estado.fecha }), enCursosDelDia(equipoId, estado.fecha)]);
      if (!vigente) return;
      if (delAparato && (falloDeRed(respuesta) || falloDeRed(delDia))) {
        conLoDeAca();
        return;
      }
      if (respuesta.error || delDia.error) {
        setRevision({ clave: claveDeRevision, estado: "error" });
        return;
      }
      const iguales = filasYaEnLaBase(leido.filas, [...respuesta.filas, ...filasDeAca(false)]);
      if (!iguales) {
        for (const otra of delDia.enCurso.filter((una) => una.id !== esEnCurso.current?.id)) {
          const abierta = await leerEnCurso(otra.id); // eslint-disable-line no-await-in-loop
          if (!vigente) return;
          if (abierta.error) {
            setRevision({ clave: claveDeRevision, estado: "error" });
            return;
          }
          if (filasEnOtroCsv(leido.filas, filasDelCsvEnCurso(abierta.enCurso.datos, gps.columnas))) {
            setRevision({ clave: claveDeRevision, estado: "enCurso", enCurso: otra });
            return;
          }
        }
        const deAca = enCursoDeAca();
        if (deAca) {
          setRevision({ clave: claveDeRevision, estado: "enCurso", enCurso: { ...deAca, local: true } });
          return;
        }
      }
      setRevision({ clave: claveDeRevision, estado: iguales ? "esta" : "noEsta", iguales, delDia: respuesta.total });
    };
    revisar();
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDeRevision, equipoId]);

  // El partido de ese día en Partido (Santiago, 12/10): «Vs el rival de
  // turno» y los convocados que no ingresaron. Se mira apenas se sabe la
  // fecha (también si el CSV no trae los tiempos del partido) y se dice qué
  // pasó; sin partido, el nombre se escribe a mano. Sin señal no se mira:
  // el «Vs» va a mano (Santiago, 23/10); al volver la señal, se mira.
  const hayBloques = Boolean(bloques);
  useEffect(() => {
    const fecha = estado.fecha;
    if (!hayBloques || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !equipoId) {
      setDelPartido(null);
      return undefined;
    }
    if (!enLinea && delAparato) {
      setDelPartido({ fecha, estado: "sinSenal" });
      return undefined;
    }
    let vigente = true;
    setDelPartido({ fecha, estado: "buscando" });
    partidoDelDia(equipoId, fecha).then((encontrado) => {
      if (!vigente) return;
      if (encontrado?.error) {
        setDelPartido({ fecha, estado: delAparato && falloDeRed(encontrado) ? "sinSenal" : "error" });
        return;
      }
      setDelPartido(encontrado ? { fecha, estado: "hay", rival: encontrado.rival, noIngresaron: encontrado.noIngresaron || [] } : { fecha, estado: "noHay" });
      // El nombre que no se escribió a mano sale de Partido (o se borra).
      setEstado((antes) => {
        if (antes.partido.nombreAMano) return antes;
        const nombre = encontrado?.rival ? `Vs ${encontrado.rival}` : "";
        return nombre === antes.partido.nombre ? antes : { ...antes, partido: { ...antes.partido, nombre } };
      });
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayBloques, estado.fecha, equipoId, intentoPartido, enLinea]);

  // Quién es cada nombre del CSV: el jugador con ese nombre en Catapult o en
  // Datos básicos; si no, lo que se eligió (guardarlo con su nombre, un
  // jugador de la lista o no cargarlo).
  // En un bloque, el nombre puede ser de otro (usó el GPS de ese: se cambia
  // en la tabla). Los arqueros van solo si el club los prende (Santiago,
  // 12/10; Ajustes › Reglas de carga).
  const deJugador = (id) => (!reglas.conArqueros && esArquero(jugadorDe(id)) ? null : { clave: `j:${id}`, jugador_id: Number(id) });
  const quienDeNombre = (nombre, bloque = null) => {
    const llave = nombreIgual(nombre);
    const cambiado = bloque ? estado.renombres[bloque]?.[llave] : null;
    if (cambiado) return deJugador(cambiado);
    const destino = estado.elegidos[llave];
    if (destino === NO_CARGAR) return null;
    if (destino === COMO_PERSONA) return { clave: `p:${llave}`, persona: nombre };
    if (destino) return deJugador(destino);
    const jugador = buscar(nombre);
    if (jugador && jugador !== DUDOSO) return deJugador(jugador.id);
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
  // Los nombres del CSV que son arqueros y no se cargan (Santiago, 12/10: se
  // prenden en Ajustes › Reglas de carga).
  const arquerosFuera = useMemo(() => {
    if (!leido || leido.error || reglas.conArqueros) return 0;
    const llaves = new Set();
    leido.filas.forEach((fila) => {
      const llave = nombreIgual(fila.nombre);
      const destino = estado.elegidos[llave];
      const jugador = destino === COMO_PERSONA || destino === NO_CARGAR ? null : destino ? jugadorDe(destino) : buscar(fila.nombre);
      if (jugador && jugador !== DUDOSO && esArquero(jugador)) llaves.add(llave);
    });
    return llaves.size;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leido, estado.elegidos, buscar, plantel, reglas.conArqueros]);

  // --------------------------------------------------- Lo que se calcula --
  const opciones = (lista) => opcionesDeLista(lista, config, idioma, { test: gps });
  listaDeDispositivos.current = opciones("dispositivo");
  const etiqueta = (lista, codigo) => opcionesDeLista(lista, config, "es-AR", { test: gps, conOcultas: true }).find((opcion) => opcion.valor === codigo)?.etiqueta || null;

  // Las filas de un bloque para el cálculo, con lo cambiado a mano y los
  // jugadores que se agregaron; y de dónde sale cada una.
  const filasDeBloque = (id, filasCsv) => {
    const filas = [];
    const fuentes = [];
    filasCsv.forEach((fila, i) => {
      const quien = quienDeNombre(fila.nombre, id);
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

  // Quién es una clave (de un jugador, j:id; de alguien del CSV, p:nombre).
  function quienDeClave(clave) {
    if (clave.startsWith("j:")) return { clave, jugador_id: Number(clave.slice(2)) };
    const delCsv = leido?.filas.map((fila) => quienDeNombre(fila.nombre)).find((quien) => quien?.clave === clave);
    return delCsv || null;
  }

  // Los que aparecen en el CSV (ya con quién es cada uno en cada bloque).
  const enElCsv = useMemo(() => {
    const vistos = new Map();
    bloquesConId.forEach((bloque) =>
      bloque.filas.forEach((fila) => {
        const quien = quienDeNombre(fila.nombre, bloque.id);
        if (quien && !vistos.has(quien.clave)) vistos.set(quien.clave, quien);
      }),
    );
    return [...vistos.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloquesConId, estado.elegidos, estado.renombres, buscar, reglas.conArqueros]);
  const enElPartido = useMemo(
    () =>
      new Set(
        [
          ...bloquesConId.filter((bloque) => bloque.id === "primer" || bloque.id === "segundo").flatMap((bloque) => bloque.filas.map((fila) => quienDeNombre(fila.nombre, bloque.id)?.clave)),
          ...[...(estado.agregados.primer || []), ...(estado.agregados.segundo || [])].map((uno) => uno.quien.clave),
        ].filter(Boolean),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bloquesConId, estado.elegidos, estado.renombres, estado.agregados, buscar, reglas.conArqueros],
  );

  // Los del plantel actual que no aparecen en el CSV, en el banco ni
  // agregados: no entrenaron (se les pone el motivo o se sacan de la lista).
  // El regenerativo se elige entre ellos (Santiago, 12/10: «La lista de
  // desplegable de regenerativo tienen que ser los que esten en no
  // entrenaron») y quien lo hizo deja de estar en la lista.
  const sinEntrenar = useMemo(() => {
    const aparecen = new Set([...enElCsv.map((quien) => quien.clave), ...estado.partido.banco.jugadores.map((id) => `j:${id}`)]);
    Object.values(estado.agregados).forEach((lista) => lista.forEach((uno) => aparecen.add(uno.quien.clave)));
    return actuales.filter((jugador) => !aparecen.has(`j:${jugador.id}`));
  }, [actuales, enElCsv, estado.partido.banco.jugadores, estado.agregados]);
  const delRegenerativo = useMemo(() => {
    if (!estado.regenerativo.hubo) return [];
    const posibles = new Set(sinEntrenar.map((jugador) => `j:${jugador.id}`));
    return estado.regenerativo.jugadores.filter((clave) => posibles.has(clave));
  }, [sinEntrenar, estado.regenerativo]);
  const propuestosNoEntrenaron = useMemo(() => {
    const delRegen = new Set(delRegenerativo);
    return sinEntrenar.filter((jugador) => !delRegen.has(`j:${jugador.id}`));
  }, [sinEntrenar, delRegenerativo]);
  const sacado = (jugador) => estado.noEntrenaron[String(jugador.id)]?.va === false;

  const armado = useMemo(() => {
    if (!bloques) return null;
    const fuentes = {};
    const deBloque = (id, filasCsv, seccion) => {
      const { filas, fuentes: suyas } = filasDeBloque(id, filasCsv);
      fuentes[seccion] = suyas;
      return filas;
    };
    const conPartido = Boolean(bloques.primer || bloques.segundo);
    // Lo que el club oculta en los bloques del partido no cuenta.
    const sinOcultos = (bloque) => Object.fromEntries(Object.entries(bloque || {}).filter(([campo]) => !reglas.ocultosDelPartido.includes(campo)));
    const banco = estado.partido.banco;
    const partido = conPartido
      ? {
          nombre: estado.partido.nombre.trim(),
          tareaPartido: estado.partido.tareaPartido || null,
          primer: { ...sinOcultos(estado.partido.primer), filas: bloques.primer ? deBloque("primer", bloques.primer.filas, "partido:0") : [] },
          segundo: { ...sinOcultos(estado.partido.segundo), filas: bloques.segundo ? deBloque("segundo", bloques.segundo.filas, "partido:1") : [] },
          completo: sinOcultos(estado.partido.completo),
          banco: {
            tipoSesion: banco.tipoSesion || null,
            codigo: reglas.ocultosDelPartido.includes("codigo") ? null : banco.codigo || null,
            jugadores: banco.jugadores.map((id) => deJugador(id)).filter(Boolean),
          },
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
    const regenerativo = estado.regenerativo.hubo ? { duracion: estado.regenerativo.duracion, jugadores: delRegenerativo.map((clave) => quienDeClave(clave)).filter(Boolean) } : null;
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
  }, [bloques, estado, buscar, actuales, delRegenerativo, reglas]);

  // Los que no ingresaron salen de Partido (Santiago, 12/10: «los jugadores
  // que no ingresaron tmb podes sacarlos del partido cargado») hasta que se
  // elijan a mano: los convocados que no entraron, con su jugador de Datos
  // básicos (sin los que están en el CSV del partido).
  const bancoDePartido = useMemo(() => {
    if (delPartido?.estado !== "hay" || delPartido.fecha !== estado.fecha) return null;
    const ids = [];
    const sinEncontrar = [];
    delPartido.noIngresaron.forEach((nombre) => {
      const jugador = buscar(nombre);
      if (!jugador || jugador === DUDOSO) sinEncontrar.push(nombre);
      else if (esActual(jugador) && (reglas.conArqueros || !esArquero(jugador)) && !enElPartido.has(`j:${jugador.id}`) && !ids.includes(jugador.id)) ids.push(jugador.id);
    });
    return { ids, sinEncontrar };
  }, [delPartido, estado.fecha, buscar, reglas.conArqueros, enElPartido]);
  useEffect(() => {
    if (!hayPartido) return;
    const ids = bancoDePartido?.ids || [];
    setEstado((antes) => {
      const banco = antes.partido.banco;
      if (banco.aMano || (ids.length === banco.jugadores.length && ids.every((id, i) => banco.jugadores[i] === id))) return antes;
      return { ...antes, partido: { ...antes.partido, banco: { ...banco, jugadores: ids } } };
    });
  }, [bancoDePartido, hayPartido]);

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

  // ------------------------------------------------------- Los controles --
  // El nombre de una columna, el mismo que en la Base: el que le puso el club
  // en Ajustes (una relativa, el de su absoluta con «/min»).
  const titulo = (clave) => {
    const columna = gps.columnas.find((una) => una.clave === clave);
    return columna ? tituloDeColumna(gps, columna, config, idioma) : clave;
  };
  // Lo que muestra un desplegable a medida: del ancho del más largo de
  // todos (el navegador los mide escondidos, con la misma letra).
  const aMedida = (texto, todos) => (
    <span className="gps-cargar-molde" data-molde={todos.join("\n")}>
      <b>{texto}</b>
    </span>
  );
  // rotulo: el nombre del desplegable (y el título de su hoja); vacio: lo que
  // dice sin nada elegido (si no, el rótulo). ajustado: del ancho de su
  // opción más larga (Santiago, 13/10); sin nada elegido dice «Elegí…»,
  // porque el rótulo ya está arriba.
  const elegir = ({ rotulo, lista, valor, alElegir, sinDato = true, vacio = rotulo, ajustado = false }) => {
    const suyas = opciones(lista);
    const lasDeLaHoja = [...(sinDato ? [{ valor: "", etiqueta: t("comun.sinDato") }] : []), ...suyas];
    const elegida = lasDeLaHoja.find((opcion) => opcion.valor === valor);
    const sinNada = ajustado ? t("comun.elegir") : vacio;
    const texto = elegida && elegida.valor !== "" ? elegida.etiqueta : sinNada;
    return (
      <button type="button" className="selector-hoja" aria-label={rotulo} onClick={() => setHoja({ titulo: rotulo, opciones: lasDeLaHoja, valor, alElegir })}>
        {ajustado ? aMedida(texto, [sinNada, ...suyas.map((opcion) => opcion.etiqueta)]) : <b>{texto}</b>}
        <Icono nombre="flecha" size={15} />
      </button>
    );
  };
  // tamano (arriba de cada bloque; Santiago, 13/10: «No hace falta que cosas
  // que no van a ocupar mucho espacio tengan tanto espacio»): chico (un
  // número o lo calculado), ajustado (un desplegable) o largo (el nombre,
  // que va en la descripción).
  const campo = (rotulo, control, clave = rotulo, tamano = "") => (
    <div className={`campo-inicio lesiones-campo-paso${tamano ? ` gps-cargar-${tamano}` : ""}`} key={clave}>
      <label>{rotulo}</label>
      {control}
    </div>
  );
  // El nombre: cada vez que lo escrito llega al borde, crece un renglón
  // hacia abajo, sin tope de letras (Santiago, 13/10: «no puede tener limite
  // de caracteres»). Es una sola línea: Enter no corta.
  const crece = ({ valor, alCambiar, rotulo, placeholder }) => (
    <span className="gps-cargar-crece" data-valor={valor || placeholder || ""}>
      <textarea
        rows={1}
        cols={1}
        value={valor ?? ""}
        placeholder={placeholder}
        aria-label={rotulo}
        onKeyDown={(evento) => evento.key === "Enter" && evento.preventDefault()}
        onChange={(evento) => alCambiar(evento.target.value.replace(/[\r\n]+/g, " "))}
      />
    </span>
  );
  const numero = (valor, alCambiar, { paso: incremento = "any", rotulo = "" } = {}) => (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      step={incremento}
      value={valor ?? ""}
      aria-label={rotulo || undefined}
      onChange={(evento) => alCambiar(evento.target.value === "" ? null : Number(evento.target.value))}
    />
  );
  const conDosDecimales = (valor) => (esNumero(valor) ? (Math.round(valor * 100) / 100).toLocaleString(idioma) : "—");

  // El % vs V.R. de partido del bloque (con su Team Average), como arriba de
  // cada bloque en la plantilla: con esto se elige la densidad (Santiago,
  // 12/10: «No estan los % vs vr de partido con los que se decide la densidad
  // de la sesion»).
  // Los colores, como la plantilla (Santiago, 13/10): verde desde el corte y
  // rojo abajo (cada medida y los grupos, 90 %; el promedio, 70 %; los dos en
  // Ajustes › Reglas de carga). Los decimales, también: las medidas y el
  // promedio sin decimales; la metabólica, la fuerza y la velocidad, con uno.
  const vrPartido = vrPartidoViejo || vrPartidoDelDispositivo(referencias, estado.dispositivo);
  const enPorcentaje = (numero, decimales = 0) =>
    esNumero(numero) ? `${(Math.round(numero * 100 * 10 ** decimales) / 10 ** decimales).toLocaleString(idioma, { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} %` : "—";
  const colorDe = (numero, corte) => {
    const llega = llegaAlCorte(numero, corte);
    return llega === null ? "" : llega ? "bien" : "bajo";
  };
  // La barra va de 0 a 150 %, con una marca en el corte.
  const largoDe = (numero) => (esNumero(numero) ? Math.min(Math.max(numero / 1.5, 0), 1) * 100 : 0);
  const panelVs = (datos) => {
    if (!vrPartido) {
      const nombre = estado.dispositivo ? opciones("dispositivo").find((opcion) => opcion.valor === estado.dispositivo)?.etiqueta || estado.dispositivo : "";
      return <p className="lesiones-ayuda gps-cargar-vs-aviso">{nombre ? t("gps.cargar.sinVr", { dispositivo: nombre }) : t("gps.cargar.vsSinDispositivo")}</p>;
    }
    if (!datos) return <p className="lesiones-ayuda gps-cargar-vs-aviso">{t("gps.cargar.vsSinPromedio", { n: reglas.minimoParaPromedio })}</p>;
    const vs = vsPartido(datos, vrPartido);
    // Los cortes, como en Ajustes (con su decimal, si tienen).
    const textoDeCorte = (parte) => `${(Math.round(parte * 1000) / 10).toLocaleString(idioma)} %`;
    const corte = textoDeCorte(reglas.corteVsPartido);
    const cortePromedio = textoDeCorte(reglas.corteVsPartidoPromedio);
    return (
      <div className="gps-cargar-vs" role="group" aria-label={t("gps.cargar.vsPartido")}>
        <div className="gps-cargar-vs-cabeza">
          <span className="gps-cargar-vs-titulo">
            {t("gps.cargar.vsPartido")}
            <TerminoDe clave="gps.terminos.vsPartido" />
          </span>
          <span className="gps-cargar-vs-leyenda">
            <span className="bien">{t("gps.cargar.vsLeyendaBien", { corte })}</span>
            <span className="bajo">{t("gps.cargar.vsLeyendaBajo", { corte })}</span>
            {cortePromedio !== corte && <span>{t("gps.cargar.vsLeyendaPromedio", { corte: cortePromedio })}</span>}
          </span>
        </div>
        <div className="gps-cargar-vs-grupos">
          {[
            ["metabolica", vs.metabolica, reglas.corteVsPartido, 1],
            ["fuerza", vs.fuerza, reglas.corteVsPartido, 1],
            ["velocidad", vs.velocidad, reglas.corteVsPartido, 1],
            ["promedio", vs.promedio, reglas.corteVsPartidoPromedio, 0],
          ].map(([grupo, numero, suCorte, decimales]) => (
            <div key={grupo} className={`gps-cargar-vs-grupo ${colorDe(numero, suCorte)}`.trim()} data-grupo={grupo}>
              <span>{t(`gps.cargar.vs.${grupo}`)}</span>
              <b>{enPorcentaje(numero, decimales)}</b>
              <span className="gps-cargar-vs-barra" aria-hidden="true">
                <i style={{ width: `${largoDe(numero)}%` }} />
                <em style={{ left: `${largoDe(suCorte)}%` }} />
              </span>
            </div>
          ))}
        </div>
        <ul className="gps-cargar-vs-medidas">
          {VS_PARTIDO.medidas.map((clave) => (
            <li key={clave} className={colorDe(vs.medidas[clave], reglas.corteVsPartido) || undefined} data-medida={clave}>
              <span>{titulo(clave)}</span>
              <b>{enPorcentaje(vs.medidas[clave])}</b>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Una parte de la tarjeta de un bloque, con su título arriba (como el
  // recuadro de los %): si no tiene nada, no va.
  const grupo = (clave, rotulo, contenido) => {
    const hay = [contenido].flat().filter(Boolean);
    if (!hay.length) return null;
    return (
      <div className={`gps-cargar-grupo gps-cargar-grupo-${clave}`} role="group" aria-label={rotulo} key={clave}>
        <span className="gps-cargar-grupo-titulo">{rotulo}</span>
        <div className="gps-cargar-grupo-campos">
          {hay.map((uno, i) => (uno?.key != null ? uno : <React.Fragment key={`suelto-${i}`}>{uno}</React.Fragment>))}
        </div>
      </div>
    );
  };

  // Partes una debajo de la otra (Santiago, 13/10: «pasa el bloque de pausa
  // abajo de las medidas»); sin ninguna, nada.
  const columna = (...partes) => {
    const hay = partes.filter(Boolean);
    return hay.length ? <div className="gps-cargar-columna">{hay}</div> : null;
  };

  // Lo de arriba de un bloque (como en la plantilla), con lo que se calcula
  // al final (los m², la relación pausa / trabajo) y, si se pasa el Team
  // Average del bloque (o null, si no tiene), su % vs V.R. de partido.
  // antes / despues: lo demás del bloque, en la misma tarjeta (Santiago, 12/10:
  // «Hay demasiado espacio como para juntar las cosas»). Va en partes, cada
  // una con su título (Santiago, 13/10: «hay que encontrar una manera de
  // darle orden visual y separar las cosas para que se entienda bien, por
  // ejemplo poner los 2 CPJ y CPT por un lado, Todas las mediciones y m2 por
  // otro»): de: tarea, partido o sesion (el título de la primera); antes va
  // en la primera; descripcion, en la última (la de la sesión). El % vs
  // V.R. de partido, en su recuadro, después de las partes.
  const encabezado = (definiciones, valores, alCambiar, calculados = [], promedioDelBloque, { antes = null, despues = null, de = "tarea", descripcion = null } = {}) => {
    const control = (def) => {
      const rotulo = def.columna ? titulo(def.columna) : t(def.rotulo);
      const valor = valores?.[def.campo];
      if (def.lista) return campo(rotulo, elegir({ rotulo, lista: def.lista, valor: valor || "", alElegir: (elegido) => alCambiar({ [def.campo]: elegido }), ajustado: true }), def.campo, "ajustado");
      if (def.largo) return campo(rotulo, crece({ valor, alCambiar: (nuevo) => alCambiar({ [def.campo]: nuevo }), rotulo }), def.campo, "largo");
      if (def.tipo === "texto")
        return campo(rotulo, <input type="text" maxLength={200} value={valor ?? ""} aria-label={rotulo} onChange={(evento) => alCambiar({ [def.campo]: evento.target.value })} />, def.campo, "chico");
      return campo(rotulo, numero(valor, (nuevo) => alCambiar({ [def.campo]: nuevo }), { paso: def.paso || "any", rotulo }), def.campo, "chico");
    };
    const calculado = ({ rotulo, valor }) => (
      <div className="campo-inicio lesiones-campo-paso gps-cargar-calculado gps-cargar-chico" key={rotulo}>
        <label>{rotulo}</label>
        <b>{conDosDecimales(valor)}</b>
      </div>
    );
    const delGrupo = (clave) => [...definiciones.filter((def) => def.grupo === clave).map(control), ...calculados.filter((uno) => uno.grupo === clave).map(calculado)];
    return (
      <section className="tarjeta tarjeta-ficha gps-cargar-encabezado">
        {grupo("nombre", t(`gps.cargar.grupos.${de}`), [antes, ...delGrupo("nombre")])}
        {columna(grupo("medidas", t("gps.cargar.grupos.medidas"), delGrupo("medidas")), grupo("pausa", t("gps.cargar.grupos.pausa"), delGrupo("pausa")))}
        {promedioDelBloque !== undefined && panelVs(promedioDelBloque)}
        {descripcion && grupo("descripcion", t("gps.cargar.grupos.descripcion"), descripcion)}
        {despues}
      </section>
    );
  };

  // Elegir varios: el desplegable dice cuáles van y abre la lista con
  // casillas (la del filtro de las bases).
  const elegirVarios = (rotulo, lista, elegidos, alCambiar, vacio = t("gps.cargar.elegirJugadores")) => {
    const suyos = lista.filter((uno) => elegidos.includes(uno.valor));
    return (
      <button
        type="button"
        className="selector-hoja"
        aria-label={rotulo}
        onClick={() => setHojaVarios({ titulo: rotulo, valores: lista.map((uno) => ({ clave: uno.valor, texto: uno.etiqueta })), elegidos: [...elegidos], busqueda: "", alAplicar: alCambiar })}
      >
        <b>{suyos.length ? suyos.map((uno) => uno.etiqueta).join(", ") : vacio}</b>
        <Icono nombre="flecha" size={15} />
      </button>
    );
  };

  // Un jugador agregado a mano a un bloque (un tiempo del partido o una
  // tarea; en el historial pasó: Santiago, 10/10). Sus números se escriben en
  // la tabla. Se elige en un desplegable, sin los que ya están en el bloque.
  const agregarEn = (id, filasCsv) => {
    const agregados = estado.agregados[id] || [];
    const yaEstan = new Set([...filasCsv.map((fila) => quienDeNombre(fila.nombre, id)?.clave), ...agregados.map((uno) => uno.quien.clave)].filter(Boolean));
    return (
      <div className="gps-cargar-agregar">
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
              opciones: elegibles.filter((jugador) => !yaEstan.has(`j:${jugador.id}`)).map(opcionDeJugador),
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
      </div>
    );
  };

  // El nombre de un bloque (para elegir dónde se cambia un nombre).
  const nombreDeBloque = (id) => (id === "primer" ? t("gps.cargar.primerTiempo") : id === "segundo" ? t("gps.cargar.segundoTiempo") : tituloDe(`tarea:${id.slice(2)}`));
  // Alguien usó el GPS de otro (Santiago, 12/10: «tengo que poder modificarlo
  // y que la web me pregunte si quiero cambiar todos los nombres de ese
  // jugador en las tareas y partido o solo en esa tarea»): el nombre de una
  // fila del CSV pasa a ser el elegido en ese bloque, en todos los bloques
  // donde está o en los que se elijan. Sus números siguen siendo los de esa
  // fila.
  const cambiarNombre = (fuente, valor) => {
    if (!fuente) return { error: "gps.cargar.nombreNoSeCambia" };
    const corte = fuente.lastIndexOf("|");
    const bloqueId = fuente.slice(0, corte);
    const lugar = fuente.slice(corte + 1);
    if (lugar.startsWith("+")) return { error: "gps.cargar.agregadoSeCambiaArriba" };
    const filaCsv = bloquesConId.find((bloque) => bloque.id === bloqueId)?.filas?.[Number(lugar)];
    if (!filaCsv || !valor || !jugadorDe(valor)) return { error: "gps.cargar.nombreNoSeCambia" };
    const llave = nombreIgual(filaCsv.nombre);
    const donde = bloquesConId.filter((bloque) => bloque.filas.some((otra) => nombreIgual(otra.nombre) === llave)).map((bloque) => bloque.id);
    const aplicar = (ids) =>
      cambiar((antes) => {
        const renombres = { ...antes.renombres };
        ids.forEach((id) => {
          renombres[id] = { ...(renombres[id] || {}), [llave]: String(valor) };
        });
        return { renombres };
      });
    if (donde.length <= 1) {
      aplicar([bloqueId]);
      return {};
    }
    const textos = { nombre: filaCsv.nombre, jugador: jugadorDe(valor)?.nombre || "—" };
    setHoja({
      titulo: t("gps.cargar.cambiarNombreTitulo", textos),
      opciones: [
        { valor: "todas", etiqueta: t("gps.cargar.cambiarEnTodas", { n: donde.length }) },
        { valor: "esta", etiqueta: t("gps.cargar.cambiarSoloEsta", { bloque: nombreDeBloque(bloqueId) }) },
        { valor: "algunas", etiqueta: t("gps.cargar.cambiarEnAlgunas") },
      ],
      valor: null,
      alElegir: (como) => {
        if (como === "todas") aplicar(donde);
        else if (como === "esta") aplicar([bloqueId]);
        else if (como === "algunas")
          setHojaVarios({
            titulo: t("gps.cargar.cambiarEnCuales", textos),
            valores: donde.map((id) => ({ clave: id, texto: nombreDeBloque(id) })),
            elegidos: [bloqueId],
            busqueda: "",
            alAplicar: (ids) => ids.length > 0 && aplicar(ids),
          });
      },
    });
    return {};
  };

  // Lo que se cambia en una tabla: una medida de Catapult de un jugador (se
  // recalculan los totales y los Team Average), el «Va Tarea» de un jugador
  // en su tarea, el «Va» de un total (cambia el Team Average de la sesión) o
  // cualquier otra celda que no sale del CSV (PSE, una lista, un texto, una
  // columna del club…), que queda como se escribió. Las medidas de un total
  // o de un Team Average se calculan.
  const editarCelda = async (filaId, clave, valor) => {
    if (aMedias) return { error: "gps.cargar.yaEmpezo" };
    const fila = resultado?.find((una) => una.id === filaId);
    if (!fila) return { error: "gps.cargar.seCalcula" };
    const fuente = fila._fila !== undefined && !fila.promedio ? armado?.fuentes?.[fila._seccion]?.[fila._fila] : null;
    if (clave === "va_tarea") {
      if (!fuente || !fila._vaTarea) return { error: "gps.cargar.seCalcula" };
      if (valor === "si" || valor === "no") cambiar((antes) => ({ vaTarea: { ...antes.vaTarea, [fuente]: valor } }));
      return {};
    }
    if (clave === "jugador") return cambiarNombre(fuente, valor);
    const columna = gps.columnas.find((una) => una.clave === clave);
    if (!columna || ["jugador", "fecha", "porMinuto"].includes(columna.tipo)) return { error: "gps.cargar.seCalcula" };
    const { fila: nueva, error } = conCambio(fila, clave, valor);
    if (error) return { error };
    if (!nueva) return {};
    const nuevo = nueva.datos?.[clave] ?? null;
    if (columna.catapult) {
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

  // --------------------------------------------------- Las tablas --
  // Las columnas de la Base (como las tiene el club) y, en las tareas, el «Va
  // Tarea» después de m2, como en la plantilla.
  const columnasDeLaTabla = useMemo(() => columnas.map((columna) => (["jugador", "fecha"].includes(columna.clave) ? { ...columna, editable: false } : columna)), [columnas]);
  // En la tabla de un tiempo del partido o de una tarea, el nombre de cada
  // fila del CSV se cambia (alguien usó el GPS de otro: Santiago, 12/10).
  const columnasDeBloque = useMemo(
    () => columnas.map((columna) => (columna.clave === "fecha" ? { ...columna, editable: false } : columna.clave === "jugador" ? { ...columna, opciones: elegibles.map(opcionDeJugador) } : columna)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnas, elegibles, idioma],
  );
  const columnaVaTarea = useMemo(
    () => ({
      clave: "va_tarea",
      titulo: t("gps.cargar.vaTarea"),
      tipo: "lista",
      editable: true,
      alinear: "centro",
      opciones: [
        { valor: "si", etiqueta: t("gps.cargar.va") },
        { valor: "no", etiqueta: t("gps.cargar.noVa") },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idioma],
  );
  const columnasConVaTarea = useMemo(() => {
    const lugar = columnasDeBloque.findIndex((columna) => columna.clave === "m2");
    const copia = [...columnasDeBloque];
    copia.splice(lugar === -1 ? copia.length : lugar + 1, 0, columnaVaTarea);
    return copia;
  }, [columnasDeBloque, columnaVaTarea]);
  const filaDeLaTabla = (fila) => {
    const armada = armarFila(fila);
    if (!fila._vaTarea) return armada;
    return { ...armada, valores: { ...armada.valores, va_tarea: fila._vaTarea }, textos: { ...armada.textos, va_tarea: fila._vaTarea === "si" ? t("gps.cargar.va") : t("gps.cargar.noVa") } };
  };
  const tablaDe = (id, filas, { conVaTarea = false, conNombre = false } = {}) => (
    <section className="tarjeta evaluaciones-tabla gps-cargar-tabla">
      <TablaDatos
        id="gps-bloque"
        recordar={`gps:bloque:${id}`}
        columnas={conVaTarea ? columnasConVaTarea : conNombre ? columnasDeBloque : columnasDeLaTabla}
        filas={filas.map(filaDeLaTabla)}
        fijas={fijas}
        onEditar={editarCelda}
        abrirAlFinal={false}
      />
    </section>
  );
  const filasDeSeccion = (...secciones) => (resultado || []).filter((fila) => secciones.includes(fila._seccion));
  const promedioDeSeccion = (seccion) => filasDeSeccion(seccion).find((fila) => fila.promedio)?.datos || null;

  // ---------------------------------------------------------- Los pasos --
  const faltaEnPaso = (id) => {
    if (id === "csv") {
      if (!leido) return t("gps.cargar.faltaCsv");
      if (leido.error) return t(leido.error);
      if (!estado.fecha) return t("gps.cargar.faltaFecha");
      if (estado.fecha > hoy) return t("gps.error.fechaFutura");
      // El dispositivo, ya acá: el % vs V.R. de partido de cada bloque es el
      // suyo (Santiago, 14/10: «Al subir el CSV»).
      if (!opciones("dispositivo").length) return t("gps.cargar.faltanDispositivos");
      if (!estado.dispositivo) return t("gps.cargar.faltaDispositivo");
      if (sinElegir.length) return plural("gps.cargar.faltanNombres", sinElegir.length);
      if (!bloques || (!bloques.primer && !bloques.segundo && !bloques.tareas.length)) return t("gps.cargar.sinFilas");
      if (!revision || revision.estado === "revisando") return t("gps.cargar.revisandoBase");
      if (revision.estado === "error") return t("gps.cargar.noSeRevisoBase");
      if (revision.estado === "esta") return plural("gps.cargar.yaEsta", revision.iguales, { fecha: fechaCorta(estado.fecha) });
      if (revision.estado === "enCurso") return textoEnCurso(revision.enCurso);
    }
    // Sin tipo de sesión, día o dispositivo no se carga nada (Santiago, 12/10);
    // nadie puede estar dos veces en un bloque (un nombre cambiado).
    const sinTipo = (bloque) => t("gps.cargar.faltaTipoSesion", { bloque });
    if (id === "primer" || id === "segundo") {
      if (!estado.partido[id].tipoSesion) return sinTipo(tituloDe(id));
      const repetido = repetidoEn(id, bloques?.[id]?.filas || []);
      if (repetido) return t("gps.cargar.repetido", { nombre: repetido, bloque: tituloDe(id) });
    }
    if (id === "completo") {
      if (!estado.partido.completo.tipoSesion) return sinTipo(tituloDe(id));
      if (estado.partido.banco.jugadores.length && !estado.partido.banco.tipoSesion) return sinTipo(t("gps.cargar.sinIngresar"));
    }
    if (id.startsWith("tarea:")) {
      const nombre = id.slice("tarea:".length);
      const bloque = bloques?.tareas.find((uno) => uno.nombre === nombre);
      const suya = estado.tareas[nombre] || {};
      if (bloque && !suya.quitada) {
        if (!suya.tipoSesion) return sinTipo(tituloDe(id));
        const repetido = repetidoEn(`t:${nombre}`, bloque.filas);
        if (repetido) return t("gps.cargar.repetido", { nombre: repetido, bloque: tituloDe(id) });
      }
    }
    if (id === "jugadores") {
      const faltan = propuestosNoEntrenaron.filter((jugador) => !sacado(jugador) && !estado.noEntrenaron[String(jugador.id)]?.tipoSesion).length;
      if (faltan) return plural("gps.cargar.faltaTipoNoEntrenaron", faltan);
    }
    if (id === "sesion") {
      if (!estado.dia) return t("gps.cargar.faltaDia");
      if (!opciones("dispositivo").length) return t("gps.cargar.faltanDispositivos");
      if (!estado.dispositivo) return t("gps.cargar.faltaDispositivo");
      if (!estado.sesion.tipoSesion) return sinTipo(t("gps.cargar.pasoSesion"));
    }
    return "";
  };
  // ¿Alguien está dos veces en un bloque? Su nombre.
  const repetidoEn = (bloqueId, filasCsv) => {
    const vistos = new Set();
    const quienes = [...filasCsv.map((fila) => quienDeNombre(fila.nombre, bloqueId)), ...(estado.agregados[bloqueId] || []).map((uno) => uno.quien)].filter(Boolean);
    const repetido = quienes.find((quien) => {
      if (vistos.has(quien.clave)) return true;
      vistos.add(quien.clave);
      return false;
    });
    return repetido ? nombreDeQuien(repetido) : null;
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

  const microciclo = microcicloDe(estado.fecha, reglas.inicioMicrociclo);
  // Qué pasó con el partido de ese día en Partido (Santiago, 12/10: no
  // apareció el rival y no se sabía por qué).
  const avisoDelPartido = () => {
    if (!delPartido || delPartido.fecha !== estado.fecha) return null;
    const fecha = fechaCorta(estado.fecha);
    if (delPartido.estado === "buscando") return <p className="lesiones-ayuda gps-cargar-partido">{t("gps.cargar.buscandoPartido", { fecha })}</p>;
    if (delPartido.estado === "sinSenal") return hayPartido ? <p className="lesiones-estado gps-cargar-partido">{t("gps.cargar.partidoSinSenal", { fecha })}</p> : null;
    if (delPartido.estado === "error")
      return (
        <div className="lesiones-estado error gps-cargar-partido">
          {t("gps.cargar.partidoNoSeLeyo")}{" "}
          <button type="button" onClick={() => setIntentoPartido((n) => n + 1)}>
            {t("comun.reintentar")}
          </button>
        </div>
      );
    if (delPartido.estado === "noHay") return hayPartido ? <p className="lesiones-estado gps-cargar-partido">{t("gps.cargar.sinPartidoEseDia", { fecha })}</p> : null;
    const nombre = delPartido.rival ? `Vs ${delPartido.rival}` : "";
    if (!hayPartido) return <p className="lesiones-estado gps-cargar-partido">{t("gps.cargar.partidoSinTiempos", { fecha, nombre: nombre || "—" })}</p>;
    if (!nombre) return <p className="lesiones-estado gps-cargar-partido">{t("gps.cargar.partidoSinRival", { fecha })}</p>;
    return <p className="lesiones-estado gps-cargar-revision gps-cargar-bien gps-cargar-partido">{t("gps.cargar.partidoEncontrado", { fecha, nombre })}</p>;
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
        <>
          <section className="tarjeta tarjeta-ficha lesiones-grupo">
            {campo(t("gps.cargar.fecha"), <input type="date" value={estado.fecha} max={hoy} onChange={(evento) => cambiar({ fecha: evento.target.value })} />, "fecha")}
            {/* El dispositivo, al subir el CSV: el % vs V.R. de partido de cada bloque usa el suyo (Santiago, 14/10). En la sesión se ve y se puede cambiar. */}
            {campo(
              titulo("dispositivo"),
              opciones("dispositivo").length ? (
                elegir({ rotulo: titulo("dispositivo"), lista: "dispositivo", valor: estado.dispositivo, alElegir: elegirDispositivo, ajustado: true })
              ) : (
                <p className="lesiones-ayuda">{t("gps.importar.sinDispositivos")}</p>
              ),
              "disp-csv",
              "ajustado",
            )}
            {microciclo !== null && (
              <p className="lesiones-ayuda gps-cargar-microciclo">
                {t("gps.cargar.microciclo", { n: microciclo })}
                <TerminoDe clave="gps.terminos.microciclo" />
              </p>
            )}
            {revision?.estado === "revisando" && (
              <p className="lesiones-estado" role="status">
                {t("gps.cargar.revisandoBase")}
              </p>
            )}
            {revision?.estado === "esta" && (
              <p className="lesiones-estado error gps-cargar-revision" role="status">
                {plural("gps.cargar.yaEsta", revision.iguales, { fecha: fechaCorta(estado.fecha) })}
              </p>
            )}
            {revision?.estado === "enCurso" && (
              <p className="lesiones-estado error gps-cargar-revision" role="status">
                {textoEnCurso(revision.enCurso)}
              </p>
            )}
            {revision?.estado === "noEsta" && (
              <p className="lesiones-estado gps-cargar-revision gps-cargar-bien" role="status">
                {t(revision.sinSenal ? "gps.cargar.noEstaSinSenal" : "gps.cargar.noEsta")}
                {revision.delDia > 0 ? ` ${plural("gps.cargar.otraSesion", revision.delDia)}` : ""}
              </p>
            )}
            {revision?.estado === "error" && (
              <div className="lesiones-estado error">
                {t("gps.cargar.noSeRevisoBase")}{" "}
                <button type="button" onClick={() => setIntento((n) => n + 1)}>
                  {t("comun.reintentar")}
                </button>
              </div>
            )}
            {avisoDelPartido()}
          </section>
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
            {arquerosFuera > 0 && <p className="lesiones-ayuda gps-cargar-arqueros">{plural("gps.cargar.arquerosFuera", arquerosFuera)}</p>}
          </section>
        </>
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
                          ...elegibles.map(opcionDeJugador),
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

  // Un tiempo del partido (y el partido completo, con los que no ingresaron).
  const cambiarPartido = (parte, cambios) => cambiar((antes) => ({ partido: { ...antes.partido, [parte]: { ...antes.partido[parte], ...cambios } } }));
  const primerPasoDelPartido = bloques?.primer ? "primer" : "segundo";
  const pasoDelPartido = (parte) => {
    const secciones = { primer: ["partido:0"], segundo: ["partido:1"], completo: ["partido:completo", "partido:banco"] }[parte];
    return (
      <>
        {encabezado(
          ENCABEZADO_DEL_PARTIDO.filter((def) => !reglas.ocultosDelPartido.includes(def.campo)),
          estado.partido[parte],
          (cambios) => cambiarPartido(parte, cambios),
          [],
          promedioDeSeccion(secciones[0]),
          {
            de: "partido",
            antes: parte === primerPasoDelPartido && (
              <>
                {campo(
                  t("gps.cargar.nombrePartido"),
                  <>
                    {crece({
                      valor: estado.partido.nombre,
                      alCambiar: (nombre) => cambiar((antes) => ({ partido: { ...antes.partido, nombre, nombreAMano: true } })),
                      rotulo: t("gps.cargar.nombrePartido"),
                      placeholder: t("gps.cargar.nombrePartidoEjemplo"),
                    })}
                    <small className="lesiones-ayuda">
                      {delPartido?.fecha === estado.fecha && delPartido.estado === "hay" && delPartido.rival && !estado.partido.nombreAMano ? t("gps.cargar.nombreDePartido") : t("gps.cargar.nombrePartidoAyuda")}
                    </small>
                  </>,
                  "nombre",
                  "largo",
                )}
                {campo(titulo("tarea_partido"), elegir({ rotulo: titulo("tarea_partido"), lista: "tarea_partido", valor: estado.partido.tareaPartido, alElegir: (valor) => cambiar((antes) => ({ partido: { ...antes.partido, tareaPartido: valor } })), ajustado: true }), "tp", "ajustado")}
              </>
            ),
            despues: parte !== "completo" && agregarEn(parte, bloques?.[parte]?.filas || []),
          },
        )}
        {parte === "completo" && (
          <section className="tarjeta tarjeta-ficha gps-cargar-encabezado">
            {campo(
              <>
                {t("gps.cargar.sinIngresar")}
                <TerminoDe clave="gps.terminos.sinIngresar" />
              </>,
              <>
                {elegirVarios(
                  t("gps.cargar.sinIngresar"),
                  actuales.filter((jugador) => !enElPartido.has(`j:${jugador.id}`)).map((jugador) => ({ valor: jugador.id, etiqueta: jugador.nombre })),
                  estado.partido.banco.jugadores,
                  (jugadores) => cambiarPartido("banco", { jugadores, aMano: true }),
                  t("gps.cargar.nadieSinIngresar"),
                )}
                <small className="lesiones-ayuda">{bancoDePartido && !estado.partido.banco.aMano ? t("gps.cargar.sinIngresarDePartido") : t("gps.cargar.sinIngresarAyuda")}</small>
                {bancoDePartido?.sinEncontrar.length > 0 && !estado.partido.banco.aMano && (
                  <small className="lesiones-ayuda">{plural("gps.cargar.sinIngresarSinEncontrar", bancoDePartido.sinEncontrar.length, { nombres: bancoDePartido.sinEncontrar.join(", ") })}</small>
                )}
              </>,
              "banco",
              "largo",
            )}
            {campo(
              titulo("tipo_sesion"),
              elegir({ rotulo: `${t("gps.cargar.sinIngresar")}: ${titulo("tipo_sesion")}`, lista: "tipo_sesion", valor: estado.partido.banco.tipoSesion || "", alElegir: (valor) => cambiarPartido("banco", { tipoSesion: valor }), ajustado: true }),
              "bancoTipo",
              "ajustado",
            )}
            {!reglas.ocultosDelPartido.includes("codigo") &&
              campo(
                titulo("codigo_estrategia"),
                elegir({ rotulo: `${t("gps.cargar.sinIngresar")}: ${titulo("codigo_estrategia")}`, lista: "codigo_estrategia", valor: estado.partido.banco.codigo || "", alElegir: (valor) => cambiarPartido("banco", { codigo: valor }), ajustado: true }),
                "bancoCodigo",
                "ajustado",
              )}
          </section>
        )}
        {tablaDe(parte, filasDeSeccion(...secciones), { conNombre: parte !== "completo" })}
      </>
    );
  };

  // Una tarea: lo de la tarea una vez («Una vez por tarea») y sus jugadores
  // con todos sus datos y su «Va Tarea».
  const cambiarTarea = (nombre, cambios) => cambiar((antes) => ({ tareas: { ...antes.tareas, [nombre]: { ...(antes.tareas[nombre] || { nombre }), ...cambios } } }));
  const pasoDeTarea = (nombreDelBloque) => {
    const bloque = bloques?.tareas.find((uno) => uno.nombre === nombreDelBloque);
    if (!bloque) return null;
    const suya = estado.tareas[bloque.nombre] || { nombre: bloque.nombre };
    const esAdicional = estado.adicional === bloque.nombre;
    const seccion = esAdicional ? "adicional" : `tarea:${bloque.nombre}`;
    const suyas = filasDeSeccion(seccion);
    const calculada = suyas.find((fila) => fila.promedio) || suyas[0];
    return (
      <>
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
        {suya.quitada ? (
          <p className="lesiones-vacio">{t("gps.cargar.tareaQuitada")}</p>
        ) : (
          <>
            {encabezado(
              ENCABEZADO_DE_TAREA,
              { ...suya, nombre: suya.nombre ?? bloque.nombre },
              (cambios) => cambiarTarea(bloque.nombre, cambios),
              [
                { rotulo: titulo("cp_tarea"), valor: calculada?.datos?.cp_tarea, grupo: "pausa" },
                { rotulo: titulo("m2"), valor: calculada?.datos?.m2, grupo: "medidas" },
              ],
              promedioDeSeccion(seccion),
              { despues: agregarEn(`t:${bloque.nombre}`, bloque.filas) },
            )}
            <p className="lesiones-ayuda gps-cargar-va-ayuda">{t("gps.cargar.vaTareaAyuda", { parte: Math.round(reglas.parteDelTiempo * 100) })}</p>
            {tablaDe(`t:${bloque.nombre}`, suyas, { conVaTarea: true })}
          </>
        )}
      </>
    );
  };

  const regenerativo = estado.regenerativo;
  // El regenerativo, de los que no entrenaron (Santiago, 12/10).
  const posiblesRegenerativo = sinEntrenar.map((jugador) => ({ valor: `j:${jugador.id}`, etiqueta: jugador.nombre }));
  // Los que se sacaron de la lista quedan abajo de todo (Santiago, 12/10: «Si
  // saco a alguien de los que no entrenaron tienen que quedar abajo del todo y
  // subir a los que si estan»).
  const listaNoEntrenaron = [...propuestosNoEntrenaron].sort((a, b) => Number(sacado(a)) - Number(sacado(b)));
  const motivos = [...new Set(Object.values(estado.noEntrenaron).map((uno) => uno.motivo?.trim()).filter(Boolean))];
  const pasoJugadores = (
    <>
      <section className="tarjeta tarjeta-ficha lesiones-grupo">
        <label className="gps-cargar-casilla">
          <input type="checkbox" checked={regenerativo.hubo} onChange={(evento) => cambiar((antes) => ({ regenerativo: { ...antes.regenerativo, hubo: evento.target.checked } }))} />
          <b>{t("gps.cargar.huboRegenerativo")}</b>
          <TerminoDe clave="gps.terminos.regenerativo" />
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
            {elegirVarios(t("gps.cargar.quienesRegenerativo"), posiblesRegenerativo, delRegenerativo, (jugadores) => cambiar((antes) => ({ regenerativo: { ...antes.regenerativo, jugadores } })))}
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
          <ul className="datos-importar-lista gps-cargar-no-entrenaron">
            {listaNoEntrenaron.map((jugador) => {
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

  // La sesión, al final: lo del día, el Team Average de la sesión (como su
  // encabezado en la plantilla), qué tareas van en su descripción y el «Va»
  // de cada uno.
  const promedioDeLaSesion = filasDeSeccion("sesion:promedio")[0] || null;
  const tareasParaLaDescripcion = (bloques?.tareas || []).filter((bloque) => !estado.tareas[bloque.nombre]?.quitada && estado.adicional !== bloque.nombre);
  const pasoSesion = (
    <>
      <section className="tarjeta tarjeta-ficha gps-cargar-encabezado">
        {campo(titulo("tipo_microciclo"), elegir({ rotulo: titulo("tipo_microciclo"), lista: "tipo_microciclo", valor: estado.tipoMicrociclo, alElegir: (valor) => cambiar({ tipoMicrociclo: valor }), ajustado: true }), "tmic", "ajustado")}
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
              {aMedida(estado.dia || t("comun.elegir"), [t("comun.elegir"), ...DIAS])}
              <Icono nombre="flecha" size={15} />
            </button>
            <small className="lesiones-ayuda">{t("gps.cargar.diaAyuda", { hora: `${Math.floor(reglas.horaDeLaTarde / 3600)}:${String(Math.floor((reglas.horaDeLaTarde % 3600) / 60)).padStart(2, "0")}` })}</small>
          </>,
          "dia",
          "ajustado",
        )}
        {campo(
          titulo("dispositivo"),
          opciones("dispositivo").length ? elegir({ rotulo: titulo("dispositivo"), lista: "dispositivo", valor: estado.dispositivo, alElegir: elegirDispositivo, ajustado: true }) : <p className="lesiones-ayuda">{t("gps.importar.sinDispositivos")}</p>,
          "disp",
          "ajustado",
        )}
      </section>
      <section className="lesiones-paso-titulo">
        <h2>
          {t("gps.cargar.promedioSesion")}
          <TerminoDe clave="gps.terminos.teamAverage" />
        </h2>
        <p>{t("gps.cargar.promedioSesionAyuda")}</p>
      </section>
      {encabezado(
        ENCABEZADO_DE_LA_SESION,
        estado.sesion,
        (cambios) => cambiar((antes) => ({ sesion: { ...antes.sesion, ...cambios } })),
        [
          { rotulo: titulo("cp_tarea"), valor: promedioDeLaSesion?.datos?.cp_tarea, grupo: "pausa" },
          { rotulo: titulo("m2"), valor: promedioDeLaSesion?.datos?.m2, grupo: "medidas" },
        ],
        promedioDeLaSesion?.datos || null,
        {
          de: "sesion",
          descripcion: tareasParaLaDescripcion.length > 0 && (
            <>
              {campo(
                t("gps.cargar.tareasEnLaDescripcion"),
                <>
                  {elegirVarios(
                    t("gps.cargar.tareasEnLaDescripcion"),
                    tareasParaLaDescripcion.map((bloque) => ({ valor: bloque.nombre, etiqueta: (estado.tareas[bloque.nombre]?.nombre ?? bloque.nombre).trim() || bloque.nombre })),
                    tareasParaLaDescripcion.filter((bloque) => estado.tareas[bloque.nombre]?.enLaDescripcion !== false).map((bloque) => bloque.nombre),
                    (elegidas) =>
                      cambiar((antes) => ({
                        tareas: Object.fromEntries(Object.entries(antes.tareas).map(([nombre, tarea]) => [nombre, { ...tarea, enLaDescripcion: elegidas.includes(nombre) }])),
                      })),
                    t("gps.cargar.ningunaTarea"),
                  )}
                  <small className="lesiones-ayuda">{t("gps.cargar.tareasEnLaDescripcionAyuda")}</small>
                </>,
                "descripcion",
                "largo",
              )}
              <div className="campo-inicio lesiones-campo-paso gps-cargar-calculado gps-cargar-descripcion">
                <label>{titulo("descripcion")}</label>
                <b>{promedioDeLaSesion?.datos?.descripcion || "—"}</b>
              </div>
            </>
          ),
        },
      )}
      <section className="lesiones-paso-titulo">
        <h2>
          {t("gps.cargar.vaDeCadaUno")}
          <TerminoDe clave="gps.terminos.va" />
        </h2>
        <p>{t("gps.cargar.vaDeCadaUnoAyuda", { parte: Math.round(reglas.parteDelTiempo * 100) })}</p>
      </section>
      {tablaDe("sesion", [...filasDeSeccion("sesion:promedio"), ...(resultado || []).filter((fila) => fila._total)])}
    </>
  );

  const filasDeLaTabla = useMemo(() => (resultado || []).map((fila) => armarFila(fila)), [resultado, armarFila]);
  const deJugadores = (resultado || []).filter((fila) => !fila.promedio).length;

  const pasoRevisar = (
    <>
      <p className="datos-importar-resumen">
        {plural("gps.cargar.resumen", resultado?.length || 0, { jugadores: deJugadores, promedios: (resultado?.length || 0) - deJugadores, fecha: estado.fecha ? fechaCorta(estado.fecha) : "—" })}
      </p>
      {aMedias && <p className="lesiones-estado error">{t("gps.cargar.aMedias", { n: aMedias.hechas, total: aMedias.lista.length })}</p>}
      <p className="lesiones-ayuda">{t("gps.cargar.revisarAyuda")}</p>
      <section className="tarjeta evaluaciones-tabla">
        <TablaDatos id="gps" recordar="gps:cargar" columnas={columnasDeLaTabla} filas={filasDeLaTabla} fijas={fijas} onEditar={editarCelda} abrirAlFinal={false} />
      </section>
      {falla && <div className="lesiones-estado error">{t(falla, { fecha: estado.fecha ? fechaCorta(estado.fecha) : "—" })}</div>}
    </>
  );

  // Regla 1: quiénes ya tienen esa sesión ese día, con cuántas filas, y el
  // nombre del dispositivo.
  const deLaMismaSesion = [];
  (otraSesion?.filas || []).forEach((fila) => {
    const clave = fila.jugador_id ? `j:${fila.jugador_id}` : `p:${String(fila.persona || "").toLowerCase()}`;
    const ya = deLaMismaSesion.find((uno) => uno.clave === clave);
    if (ya) ya.filas += 1;
    else deLaMismaSesion.push({ clave, nombre: fila.jugador_id ? jugadorDe(fila.jugador_id)?.nombre || String(fila.jugador_id) : fila.persona || "—", filas: 1 });
  });
  const nombreDelDispositivo = otraSesion ? opcionesDeLista("dispositivo", config, idioma, { test: gps, conOcultas: true }).find((opcion) => opcion.valor === estado.dispositivo)?.etiqueta || estado.dispositivo || "—" : "";

  // Se guarda en el orden de la plantilla, todo de una vez (20261111). Justo
  // antes, se vuelve a mirar que el CSV no esté ya en la Base (otra persona
  // pudo cargarlo mientras tanto) y la Regla 1: si es una sesión que ya está
  // ese día con otros datos, se pregunta («Ir a la Base» o «Reemplazar y
  // cargar»). La base revisa lo mismo con el día bloqueado. Sin esa
  // actualización, de a tandas, como antes: si se corta, lo guardado queda y
  // lo que falta se guarda al volver a tocar (lo de la tabla ya no se cambia).
  // Sin señal (o si se corta en el camino), las mismas reglas con lo de este
  // aparato y el día queda en él: se sube solo cuando vuelve la señal (paso
  // 3c.2b; al subir se miran otra vez).
  const guardar = async ({ reemplazar = false } = {}) => {
    setOtraSesion(null);
    const lista =
      aMedias?.lista ||
      (resultado || []).map((fila) => Object.fromEntries(Object.entries(fila).filter(([clave]) => !clave.startsWith("_") && clave !== "id")));
    const desde = aMedias?.hechas || 0;
    const quedan = lista.slice(desde);
    if (!quedan.length) return;
    // Todo lo de antes, completo (también lo cambiado en la tabla).
    if (!aMedias) {
      for (let uno = 0; uno < PASOS.length - 1; uno += 1) {
        const falta = faltaEnPaso(PASOS[uno]);
        if (falta) {
          setErrorPaso(falta);
          setPaso(uno);
          return;
        }
      }
      const faltan = faltaLoObligatorio(resultado || []);
      if (faltan.length) {
        setErrorPaso(t("gps.cargar.faltaObligatorio", { columnas: faltan.map(titulo).join(", ") }));
        return;
      }
    }
    setErrorPaso("");
    setFalla("");
    const alAparato = !enLinea && Boolean(delAparato);
    const personas = quedan.filter((fila) => !fila.jugador_id && !fila.promedio).map((fila) => fila.persona);
    // Su consentimiento se confirma con señal.
    if (alAparato && personas.some((nombre) => String(nombre ?? "").trim())) {
      setFalla("gps.espera.personasConSenal");
      return;
    }
    // Las personas que no están en Datos básicos: antes de guardar, quien
    // carga confirma su consentimiento (20261103).
    const permiso = alAparato ? { sigue: true } : await consentimiento.pedir(personas);
    if (!enPantalla.current) return;
    if (!permiso.sigue) {
      if (permiso.error) setFalla(permiso.error);
      return;
    }
    setProgreso({ n: desde, total: lista.length });
    // Al aparato: lo de este aparato, con las mismas reglas.
    const enElAparato = () => {
      const delDia = (delAparato.filas || []).filter((fila) => fila.fecha === estado.fecha);
      setProgreso(null);
      if (filasYaEnLaBase(leido?.filas || [], delDia)) {
        setFalla("gps.cargar.yaEstaAlGuardar");
        return;
      }
      const otras = reemplazar ? [] : filasDeLaMismaSesion(quedan, delDia, estado.dispositivo);
      if (otras.length) {
        setOtraSesion({ filas: otras });
        return;
      }
      delAparato.alGuardar({ fecha: estado.fecha, dispositivo: estado.dispositivo, filas: quedan, enCurso: deEnCurso, reemplazar });
      onListo?.({ cargadas: quedan.length, fecha: estado.fecha, alAparato: true });
    };
    if (alAparato && !aMedias) {
      enElAparato();
      return;
    }
    if (!aMedias) {
      // Las otras cargas sin terminar de ese día ya no frenan (Santiago,
      // 23/10: varias por día; la del mismo CSV se frena al leerlo).
      const respuesta = await listarGps(equipoId, { desde: estado.fecha, hasta: estado.fecha });
      if (!enPantalla.current) return;
      if (delAparato && falloDeRed(respuesta)) {
        enElAparato();
        return;
      }
      if (respuesta.error || filasYaEnLaBase(leido?.filas || [], [...respuesta.filas, ...(delAparato?.filas || []).filter((fila) => fila.fecha === estado.fecha && esLocal(fila.id))])) {
        setProgreso(null);
        setFalla(respuesta.error ? "gps.cargar.noSeRevisoBase" : "gps.cargar.yaEstaAlGuardar");
        return;
      }
      const otras = reemplazar ? [] : filasDeLaMismaSesion(quedan, respuesta.filas, estado.dispositivo);
      if (otras.length) {
        setProgreso(null);
        setOtraSesion({ filas: otras });
        return;
      }
      const dia = await guardarDiaGps(equipoId, { fecha: estado.fecha, dispositivo: estado.dispositivo, filas: quedan, reemplazar });
      if (!enPantalla.current) return;
      if (delAparato && falloDeRed(dia)) {
        enElAparato();
        return;
      }
      if (!dia.sinFuncion) {
        setProgreso(null);
        // Otra persona guardó esa sesión mientras tanto: se pregunta con lo de ahora.
        if (dia.conOtras) {
          const ahora = await listarGps(equipoId, { desde: estado.fecha, hasta: estado.fecha });
          if (!enPantalla.current) return;
          const deAhora = ahora.error ? [] : filasDeLaMismaSesion(quedan, ahora.filas, estado.dispositivo);
          if (deAhora.length) setOtraSesion({ filas: deAhora });
          else setFalla("gps.cargar.noSeRevisoBase");
          return;
        }
        if (dia.error) {
          setFalla(dia.error);
          return;
        }
        const quitada = await terminarEnCurso();
        onListo?.({ cargadas: dia.creadas, reemplazadas: dia.reemplazadas, fecha: estado.fecha, quedoEnCurso: Boolean(quitada.error) });
        return;
      }
      // Sin la actualización 20261111 no se reemplaza.
      if (reemplazar) {
        setProgreso(null);
        setFalla("gps.error.faltaMigracion");
        return;
      }
    }
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
    const quitada = await terminarEnCurso();
    onListo?.({ cargadas: lista.length, fecha: estado.fecha, quedoEnCurso: Boolean(quitada.error) });
  };
  // Ya está en la Base: deja de estar «Sin terminar» (la de este aparato,
  // y la de la base que había seguido ella).
  const terminarEnCurso = async () => {
    if (!deEnCurso?.id) return { error: "" };
    if (!esLocal(deEnCurso.id)) return borrarEnCurso(deEnCurso.id);
    const deAca = delAparato?.quitar(deEnCurso.id);
    return deAca?.base?.id ? borrarEnCurso(deAca.base.id) : { error: "" };
  };

  // Dejar para revisar: todo lo hecho va a la base y se sigue desde
  // «Sin terminar», en este aparato o en otro, en el paso donde quedó. Con
  // verEnLaBase (la Regla 1, «Ir a la Base»), después se ven en la Base las
  // filas de esa sesión que ya estaban. Sin señal (o si se corta), queda en
  // este aparato (Santiago, 23/10: «Queda en el aparato») y se sube sola
  // cuando vuelve la señal.
  const dejar = async ({ verEnLaBase = null } = {}) => {
    if (!estado.csv.length || dejando) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(estado.fecha)) {
      setErrorPaso(t("gps.enCurso.faltaFecha"));
      return;
    }
    if (revision?.estado === "enCurso") {
      setErrorPaso(textoEnCurso(revision.enCurso));
      return;
    }
    // Lo que ya está en la Base no se deja para después: no se podría guardar.
    if (revision?.estado === "esta") {
      setErrorPaso(plural("gps.cargar.yaEsta", revision.iguales, { fecha: fechaCorta(estado.fecha) }));
      return;
    }
    const donde = Math.min(paso, PASOS.length - 1);
    const hecho = {
      fecha: estado.fecha,
      paso: donde,
      resumen: { titulo: String(tituloDe(actual) || "").slice(0, 160), paso: donde + 1, pasos: PASOS.length },
      datos: { formato: FORMATO_EN_CURSO, estado },
    };
    setErrorPaso("");
    setOtroAparato(false);
    const listo = (id, alAparato = false) => {
      if (verEnLaBase) onVerEnLaBase?.({ fecha: estado.fecha, dispositivo: estado.dispositivo, filas: verEnLaBase.filas, enCursoId: id });
      else onDejado?.({ fecha: estado.fecha, alAparato });
    };
    const enElAparato = () => {
      const id = delAparato.alDejar({ id: deEnCurso?.id || null, version: deEnCurso?.version || null, ...hecho });
      setDeEnCurso({ id, version: null });
      listo(id, true);
    };
    if (!enLinea && delAparato) {
      enElAparato();
      return;
    }
    // Una de este aparato se deja en la base como la que había seguido (o nueva).
    const deAca = esLocal(deEnCurso?.id) ? (delAparato?.enCurso || []).find((una) => una.id === deEnCurso.id) || null : null;
    const enLaBase = esLocal(deEnCurso?.id) ? deAca?.base || null : deEnCurso;
    setDejando(true);
    let respuesta = await dejarEnCurso(equipoId, { id: enLaBase?.id || null, version: enLaBase?.version || null, ...hecho });
    // La que había seguido la de este aparato ya no está: queda como nueva (como al subirla).
    if (deAca && enLaBase && respuesta.error === "gps.enCurso.noEsta") respuesta = await dejarEnCurso(equipoId, { id: null, version: null, ...hecho });
    if (!enPantalla.current) return;
    setDejando(false);
    if (delAparato && falloDeRed(respuesta)) {
      enElAparato();
      return;
    }
    if (respuesta.error === "gps.enCurso.otroAparato") {
      // La última es la de la base (también si se seguía una de este aparato).
      setOtroAparato({ id: enLaBase?.id ?? null });
      return;
    }
    if (respuesta.error === "gps.enCurso.noEsta") setDeEnCurso(null);
    if (respuesta.error) {
      setErrorPaso(t(respuesta.error));
      return;
    }
    if (deAca) delAparato.quitar(deAca.id);
    setDeEnCurso({ id: respuesta.id, version: respuesta.version });
    listo(respuesta.id);
  };

  // El título y la ayuda de cada paso.
  const deTarea = actual.startsWith("tarea:") ? actual.slice("tarea:".length) : null;
  const numeroDeTarea = deTarea ? (bloques?.tareas || []).findIndex((bloque) => bloque.nombre === deTarea) + 1 : 0;
  const tituloDe = (id) => {
    if (id.startsWith("tarea:")) {
      const nombre = id.slice("tarea:".length);
      return (estado.tareas[nombre]?.nombre ?? nombre).trim() || nombre;
    }
    return {
      csv: t("gps.cargar.pasoCsv"),
      primer: t("gps.cargar.primerTiempo"),
      segundo: t("gps.cargar.segundoTiempo"),
      completo: t("gps.cargar.partidoCompleto"),
      jugadores: t("gps.cargar.pasoJugadores"),
      sesion: t("gps.cargar.pasoSesion"),
      revisar: t("gps.cargar.pasoRevisar"),
    }[id];
  };
  const ayuda = deTarea
    ? `${t("gps.cargar.tareaDe", { n: numeroDeTarea, total: bloques?.tareas.length || 0 })}${estado.adicional === deTarea ? ` · ${t("gps.cargar.adicional")}` : ""}. ${t("gps.cargar.tareasAyuda")}`
    : {
        csv: t("gps.cargar.csvAyuda"),
        primer: t("gps.cargar.bloqueAyuda"),
        segundo: t("gps.cargar.bloqueAyuda"),
        completo: t("gps.cargar.completoAyuda"),
        jugadores: t("gps.cargar.jugadoresAyuda"),
        sesion: t("gps.cargar.sesionAyuda"),
      }[actual];
  let contenido;
  if (actual === "csv") contenido = pasoCsv;
  else if (["primer", "segundo", "completo"].includes(actual)) contenido = pasoDelPartido(actual);
  else if (deTarea) contenido = pasoDeTarea(deTarea);
  else if (actual === "jugadores") contenido = pasoJugadores;
  else if (actual === "sesion") contenido = pasoSesion;
  else contenido = pasoRevisar;
  const ancho = actual !== "csv" && actual !== "jugadores";

  return (
    <div className="app gps-cargar">
      <div className={`contenedor ${ancho ? "contenedor-base" : ""}`}>
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
                  aria-label={tituloDe(id)}
                />
              ))}
            </div>
            <p className="lesiones-paso-numero">{t("lesiones.pasos.paso", { n: paso + 1, total: PASOS.length })}</p>
          </div>
          <div className="guia-e-idioma">
            {onGuia && <BotonGuia onClick={onGuia} />}
            <SelectorIdioma className="lesiones-idioma" />
          </div>
        </header>

        <section className="lesiones-paso-titulo">
          <div className="gps-cargar-titulo-fila">
            <h2>{tituloDe(actual)}</h2>
            {estado.csv.length > 0 && !aMedias && (
              <button type="button" className="boton-secundario gps-cargar-dejar" onClick={() => dejar()} disabled={dejando || Boolean(progreso) || (!enLinea && !delAparato)}>
                <Icono nombre="reloj" size={15} />
                {dejando ? t("gps.enCurso.dejando") : t("gps.enCurso.dejar")}
              </button>
            )}
          </div>
          {ayuda && <TextoConPasos texto={ayuda} />}
        </section>

        {!enLinea && (delAparato ? <AvisoDeEspera sinSenal /> : <p className="lesiones-estado">{t("gps.estado.sinConexion")}</p>)}
        {errorPaso && <div className="aviso-hoja">{errorPaso}</div>}
        {otroAparato && (
          <div className="lesiones-estado error" role="status">
            {t("gps.enCurso.otroAparato")}{" "}
            <button type="button" onClick={() => onAbrirEnCurso?.(otroAparato.id)}>
              {t("gps.enCurso.abrirUltima")}
            </button>
          </div>
        )}
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
            <button type="button" className="boton-principal" onClick={() => guardar()} disabled={Boolean(progreso) || (!enLinea && (!delAparato || Boolean(aMedias))) || !resultado?.length}>
              {progreso
                ? t("gps.cargar.guardando", { n: progreso.n, total: progreso.total })
                : aMedias
                  ? plural("gps.cargar.guardarFaltan", aMedias.lista.length - aMedias.hechas)
                  : plural("gps.cargar.guardar", resultado?.length || 0)}
            </button>
          ) : (
            <button type="button" className="boton-principal" onClick={() => irAlPaso(paso + 1)}>
              {t("gps.cargar.siguienteA", { paso: tituloDe(PASOS[paso + 1]) })}
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
      <HojaConfirmar
        abierta={Boolean(otraSesion)}
        icono="refrescar"
        titulo={t("gps.cargar.mismaSesion.titulo")}
        descripcion={plural("gps.cargar.mismaSesion.texto", deLaMismaSesion.length, { fecha: estado.fecha ? fechaCorta(estado.fecha) : "—", dispositivo: nombreDelDispositivo })}
        detalle={
          <div className="gps-misma-sesion">
            <ul className="consentimiento-personas">
              {deLaMismaSesion.map((uno) => (
                <li key={uno.clave}>{t("gps.cargar.mismaSesion.quien", { nombre: uno.nombre, filas: plural("gps.cargar.mismaSesion.filas", uno.filas) })}</li>
              ))}
            </ul>
            <p>{t("gps.cargar.mismaSesion.queHace", { dispositivo: nombreDelDispositivo })}</p>
          </div>
        }
        etiquetaCancelar={t("gps.cargar.mismaSesion.irALaBase")}
        etiquetaConfirmar={t("gps.cargar.mismaSesion.reemplazar")}
        onCancelar={() => {
          const filas = otraSesion?.filas || [];
          setOtraSesion(null);
          dejar({ verEnLaBase: { filas } });
        }}
        onConfirmar={() => guardar({ reemplazar: true })}
        onCerrar={() => setOtraSesion(null)}
      />
      {consentimiento.hoja}
    </div>
  );
}
