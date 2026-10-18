import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEnVivo } from "./domain/enVivo.js";
import { Icono, MarcoAplicacion } from "./components/AppChrome";
import BotonModulos from "./components/BotonModulos.jsx";
import { EscudoDeClub } from "./components/ClubCrest";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { TablaDatos } from "./components/TablaDatos.jsx";
import { AvisoSoloLectura } from "./components/SoloLectura.jsx";
import ImportarJugadores from "./ImportarJugadores.jsx";
import { PosicionesJugadores } from "./components/PosicionesPartido.jsx";
import AjustesDatosBasicos from "./AjustesDatosBasicos.jsx";
import { esActual, guardarPuestos } from "./domain/plantel.js";
import { cargarEquipos, elegirEquipoInicial, guardarEquipoElegido, leerEquipoElegido, soloParaMirar } from "./domain/equipo.js";
import { categoriasAlCambiar, edadAl } from "./domain/lesiones.js";
import { conLaMismaFecha } from "./domain/importarJugadores.js";
import { textoDeHoras } from "./domain/tabla.js";
import { campoPorClave, esDeDatosBasicos, etiquetaDeCampo, etiquetaDeOpcion, opcionesDeCampo } from "./domain/lesionesCampos.js";
import {
  agregarJugadorBasico,
  cargarPlantelLesiones,
  guardarCategoriaDeLesiones,
  guardarDatosJugador,
  leerConfigDatos,
  leerLesionesPorJugador,
  quitarJugadorBasico,
} from "./domain/lesionesDb.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import "./lesiones.css";

// Datos básicos: los jugadores del club con lo que cada módulo necesita (la
// hoja "Datos Básicos" del Excel), en la tabla estilo Excel que se copia y se
// pega. Es la única lista de jugadores: la usan Partido, Flujo diario y
// Lesiones. La hoja entera del Excel se trae con "Pegar desde Excel"
// (ImportarJugadores.jsx). Además, dónde juega cada uno en Partido
// (Posiciones) y, en Ajustes, el nombre de cada columna, las listas y su
// dispositivo de Catapult para Flujo diario (AjustesDatosBasicos.jsx).

export const DESTINOS_DATOS = [
  { id: "jugadores", etiqueta: "Jugadores", icono: "usuario" },
  { id: "posiciones", etiqueta: "Posiciones", icono: "formacion" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

// Las columnas: el nombre, si está hoy en el plantel, los datos del Excel y
// la edad de hoy. En Datos básicos quedan todos los que pasaron por el club:
// "Actual" marca los del plantel de hoy (al lado del nombre, para verla en el
// celular sin correr la tabla). Las horas previas son las de entrenamiento de
// antes de que llegara el cuerpo técnico (la columna A de la hoja del Excel):
// los reportes de Lesiones las suman a las del GPS.
const COLUMNAS = [
  { clave: "nombre", tipo: "texto", editable: true, rotulo: "jugador" },
  { clave: "actual", tipo: "casilla", editable: true, texto: "datos.actual" },
  { clave: "categoria", tipo: "lista", editable: true },
  { clave: "fecha_nacimiento", tipo: "fecha", editable: true, nacimiento: true },
  { clave: "edad", tipo: "calculado", editable: false, texto: "datos.edad" },
  { clave: "pie_dominante", tipo: "lista", editable: true },
  { clave: "posicion", tipo: "lista", editable: true },
  { clave: "foto_url", tipo: "texto", editable: true, texto: "datos.foto" },
  { clave: "horas_previas", tipo: "horas", editable: true, texto: "datos.horasPrevias" },
];

// En Ajustes, cada columna se guarda con su clave; el nombre es la del
// jugador en Lesiones (las compartidas se llaman igual en los dos lados).
const claveDeAjuste = (columna) => columna.rotulo || columna.clave;

// La edad de hoy, con la misma cuenta que la de Lesiones.
const edadHoy = (nacimiento) => edadAl(nacimiento, hoyISO());

// permisos: los del club (sin ellos, todo a la vista). Los dispositivos de
// Catapult se buscan con la cuenta de Flujo diario: eso de Ajustes es para quien
// tiene ese módulo en el club (ser dueño de la app no la abre).
export default function DatosBasicos({ onVolver, permisos = null }) {
  const { idioma, plural } = useIdioma();
  const conCatapult = !permisos || Boolean(permisos.flujo);
  const destinos = DESTINOS_DATOS;
  const [vista, setVista] = useState("jugadores");
  const [equipo, setEquipo] = useState(() => leerEquipoElegido());
  const [plantel, setPlantel] = useState([]);
  const [config, setConfig] = useState(null);
  // Lo propio de Datos básicos › Ajustes: { [columna]: { etiquetas, oculto } }.
  const [columnasDatos, setColumnasDatos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [fechaNueva, setFechaNueva] = useState("");
  const [agregando, setAgregando] = useState(false);
  // Al agregar a mano, si la fecha de nacimiento ya la tiene otro: ¿es el
  // mismo jugador? Se pregunta por cada uno con esa fecha (Santiago, 17/10).
  // { nombre, fecha, coincidencias, i }
  const [mismo, setMismo] = useState(null);
  // Solo los que no tienen fecha de nacimiento (para completarla).
  const [soloSinFecha, setSoloSinFecha] = useState(false);
  // Las lesiones de cada jugador (las que se ven con Lesiones), para la
  // categoría: { [jugador_id]: [{ id, fecha_lesion, datos }] }.
  const [lesionesDe, setLesionesDe] = useState({});
  // ¿La categoría nueva vale para todo su historial o desde una fecha?
  // (Santiago, 17/10) { jugador, nueva, fecha, resolver }
  const [cambioCategoria, setCambioCategoria] = useState(null);
  const [aBorrar, setABorrar] = useState(null);
  const [importando, setImportando] = useState(false);

  const equipoId = equipo?.id || null;
  // Quien ya se fue del club ve a los jugadores de entonces y no cambia nada.
  // Quien tiene Datos básicos en «Solo lectura» los ve al día y tampoco
  // cambia nada (Santiago, 17/10).
  const seFue = Boolean(equipo?.hasta);
  const mirar = soloParaMirar(equipo, "datos");
  const soloLectura = seFue || mirar;
  // Las lesiones solo se cambian con Lesiones con Edición.
  const editaLesiones = !soloParaMirar(equipo, "lesiones");

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

  // silencioso: lo nuevo de otros (useEnVivo), sin "Cargando…"; si no se pudo
  // leer, queda lo que se veía.
  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) {
      setCargando(true);
      setError("");
    }
    const [respuestaPlantel, respuestaConfig, respuestaLesiones] = await Promise.all([cargarPlantelLesiones(equipoId), leerConfigDatos(equipoId), leerLesionesPorJugador(equipoId)]);
    if (!respuestaLesiones.error) setLesionesDe(respuestaLesiones.porJugador);
    if (silencioso) {
      if (!respuestaPlantel.error && !respuestaPlantel.deRespaldo) setPlantel(respuestaPlantel.plantel || []);
      return;
    }
    setPlantel(respuestaPlantel.plantel || []);
    // Sin las tablas de Lesiones todavía, valen los textos del Excel.
    setConfig(respuestaConfig.error ? null : respuestaConfig.config);
    setColumnasDatos(respuestaConfig.columnas || {});
    if (respuestaPlantel.error) setError(respuestaPlantel.error);
    setCargando(false);
  }, [equipoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Lo que carga o cambia otra persona aparece solo (Santiago, 11/10).
  useEnVivo({ nombre: "datos", tablas: ["jugadores"], equipoId, activo: !seFue, alCambiar: () => cargar({ silencioso: true }) });

  useEffect(() => {
    if (!aviso) return undefined;
    const temporizador = setTimeout(() => setAviso(""), 2600);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  const etiqueta = (clave) => etiquetaDeCampo(clave, config, idioma);
  const textoDeOpcion = (clave, codigo) => etiquetaDeOpcion(clave, codigo, config, idioma);

  // El nombre de cada columna en este club y si se esconde en esta tabla
  // (Datos básicos › Ajustes). Las del jugador toman el de Lesiones; las
  // propias, el que puso el club en este idioma o, si no, el de la app.
  const columnasDeAjustes = useMemo(
    () =>
      COLUMNAS.map((columna) => {
        const clave = claveDeAjuste(columna);
        const compartida = esDeDatosBasicos(clave);
        const porDefecto = columna.texto ? t(columna.texto) : etiquetaDeCampo(clave, null, idioma);
        const propias = columnasDatos[clave]?.etiquetas;
        return {
          clave,
          titulo: compartida ? etiquetaDeCampo(clave, config, idioma) : String(propias?.[idioma] || "").trim() || porDefecto,
          porDefecto,
          compartida,
          // El nombre de cada jugador no se esconde.
          fija: clave === "jugador",
          oculta: clave !== "jugador" && Boolean(columnasDatos[clave]?.oculto),
          etiquetas: compartida ? undefined : propias,
        };
      }),
    [config, columnasDatos, idioma],
  );

  const columnas = useMemo(
    () =>
      COLUMNAS.map((columna, indice) => ({ columna, ajuste: columnasDeAjustes[indice] }))
        .filter(({ ajuste }) => !ajuste.oculta)
        .map(({ columna, ajuste }) => ({
          clave: columna.clave,
          titulo: ajuste.titulo,
          tipo: columna.tipo,
          // La fecha de nacimiento pegada nunca queda en el futuro ("86" es 1986).
          nacimiento: columna.nacimiento,
          editable: columna.editable && !soloLectura,
          ancho: columna.clave === "nombre" ? 180 : undefined,
          opciones:
            columna.tipo === "lista"
              ? opcionesDeCampo(columna.clave, config, idioma).map((opcion) => ({
                  ...opcion,
                  alias: [etiquetaDeOpcion(columna.clave, opcion.valor, config, idioma === "pt-BR" ? "es-AR" : "pt-BR")],
                }))
              : undefined,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, columnasDeAjustes, idioma, soloLectura],
  );

  // Después de cambiar algo en Ajustes, lo de este club otra vez.
  const recargarAjustes = async () => {
    const respuesta = await leerConfigDatos(equipoId);
    if (!respuesta.error) setConfig(respuesta.config);
    setColumnasDatos(respuesta.columnas || {});
  };

  const sinFecha = plantel.filter((jugador) => !jugador.fecha_nacimiento).length;
  useEffect(() => {
    if (!sinFecha) setSoloSinFecha(false);
  }, [sinFecha]);

  const filas = useMemo(
    () =>
      (soloSinFecha ? plantel.filter((jugador) => !jugador.fecha_nacimiento) : plantel).map((jugador) => {
        const edad = edadHoy(jugador.fecha_nacimiento);
        return {
          id: jugador.id,
          valores: {
            nombre: jugador.nombre,
            actual: esActual(jugador),
            categoria: jugador.categoria || "",
            fecha_nacimiento: jugador.fecha_nacimiento || "",
            edad,
            pie_dominante: jugador.pie_dominante || "",
            posicion: jugador.posicion || "",
            foto_url: jugador.foto_url || "",
            horas_previas: jugador.horas_previas ?? null,
          },
          textos: {
            nombre: jugador.nombre,
            actual: t(esActual(jugador) ? "comun.si" : "comun.no"),
            categoria: textoDeOpcion("categoria", jugador.categoria),
            fecha_nacimiento: fechaCorta(jugador.fecha_nacimiento),
            edad: edad === null ? "" : plural("lesiones.anios", edad),
            pie_dominante: textoDeOpcion("pie_dominante", jugador.pie_dominante),
            posicion: textoDeOpcion("posicion", jugador.posicion),
            foto_url: jugador.foto_url || "",
            horas_previas: textoDeHoras(jugador.horas_previas),
          },
          // Quien ya no está en el plantel actual, en otro color.
          apagada: !esActual(jugador),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plantel, config, idioma, soloSinFecha],
  );

  const reemplazar = (jugador) => setPlantel((antes) => antes.map((uno) => (uno.id === jugador.id ? jugador : uno)));

  // Posiciones de Partido: se guardan al toque; si no se puede, se avisa y se
  // vuelve a leer lo que quedó en la base.
  const cambiarPuestos = async (jugador, cambios) => {
    const actualizado = { ...jugador, ...cambios };
    reemplazar(actualizado);
    const respuesta = await guardarPuestos(jugador.id, { roles: actualizado.roles, puestos: actualizado.puestos });
    if (respuesta.error) {
      setAviso(t("datos.error.guardar"));
      cargar();
    }
  };

  // Cuántas veces se guardó algo de cada jugador: lo que no se pudo guardar
  // solo vuelve atrás si mientras tanto no se guardó otra cosa de él.
  const guardadosBien = useRef(new Map());

  // La categoría cambia y el jugador tenía otra y tiene lesiones: se pregunta
  // si vale para todo su historial o desde una fecha (Santiago, 17/10: solo
  // Lesiones, solo si tiene lesiones, de entrada desde hoy). Devuelve
  // { desde } (null: todo) o null si se cancela.
  // Con Lesiones en solo lectura no se pregunta: sus lesiones no se cambian.
  const pideCategoria = (jugador, nueva) => Boolean(editaLesiones && jugador?.categoria && (nueva || "") !== jugador.categoria && lesionesDe[jugador.id]?.length);
  const preguntarCategoria = (jugador, nueva) =>
    new Promise((resolver) => setCambioCategoria({ jugador, nueva: nueva || "", fecha: hoyISO(), resolver }));
  const responderCategoria = (respuesta) => {
    cambioCategoria?.resolver(respuesta);
    setCambioCategoria(null);
  };
  // Lo elegido, en sus lesiones; si algo no se guarda, se avisa.
  const aplicarCategoria = async (jugador, nueva, { desde }) => {
    const lesiones = lesionesDe[jugador.id] || [];
    const cambios = categoriasAlCambiar(lesiones, { anterior: jugador.categoria, nueva, desde });
    if (!cambios.length) return { error: "" };
    const respuesta = await guardarCategoriaDeLesiones(cambios);
    const nuevas = new Map(cambios.filter((cambio) => respuesta.hechas.includes(cambio.id)).map((cambio) => [cambio.id, cambio.datos]));
    setLesionesDe((antes) => ({ ...antes, [jugador.id]: (antes[jugador.id] || []).map((lesion) => (nuevas.has(lesion.id) ? { ...lesion, datos: nuevas.get(lesion.id) } : lesion)) }));
    if (respuesta.error) setAviso(t("datos.categoria.lesionesSinGuardar", { error: t(respuesta.error) }));
    return respuesta;
  };

  const guardar = async (jugadorId, datos) => {
    // La fecha de nacimiento es obligatoria (Santiago, 17/10): vacía no se
    // guarda; lo demás de la fila, sí.
    if ("fecha_nacimiento" in datos && !datos.fecha_nacimiento) {
      const resto = Object.fromEntries(Object.entries(datos).filter(([clave]) => clave !== "fecha_nacimiento"));
      if (!Object.keys(resto).length) return { error: "datos.error.fechaObligatoria" };
      const respuesta = await guardar(jugadorId, resto);
      return respuesta.error ? respuesta : { ...respuesta, aviso: respuesta.aviso || "datos.error.fechaObligatoria", sinGuardar: (respuesta.sinGuardar || 0) + 1 };
    }
    const jugador = plantel.find((uno) => uno.id === jugadorId);
    let categoria = null;
    if ("categoria" in datos && pideCategoria(jugador, datos.categoria)) {
      categoria = await preguntarCategoria(jugador, datos.categoria);
      // Cancelado: la categoría queda como estaba; lo demás de la fila, se guarda.
      if (!categoria) {
        const resto = Object.fromEntries(Object.entries(datos).filter(([clave]) => clave !== "categoria"));
        return Object.keys(resto).length ? guardar(jugadorId, resto) : { cancelado: true };
      }
    }
    const respuesta = await guardarDatosJugador(jugadorId, datos);
    if (!respuesta.error) guardadosBien.current.set(jugadorId, (guardadosBien.current.get(jugadorId) || 0) + 1);
    if (!respuesta.error && categoria) await aplicarCategoria(jugador, datos.categoria, categoria);
    return respuesta;
  };

  // Una casilla (Actual) se ve cambiada al toque, con el color de la fila y
  // el contador; si no se puede guardar, vuelve a como estaba.
  const editarCelda = async (jugadorId, clave, valor) => {
    const alToque = COLUMNAS.find((columna) => columna.clave === clave)?.tipo === "casilla";
    const antes = plantel.find((uno) => uno.id === jugadorId);
    const vez = guardadosBien.current.get(jugadorId) || 0;
    if (alToque && antes) setPlantel((lista) => lista.map((uno) => (uno.id === jugadorId ? { ...uno, [clave]: valor } : uno)));
    const respuesta = await guardar(jugadorId, { [clave]: valor });
    if (respuesta.cancelado) return {};
    if (respuesta.error) {
      if (alToque && antes && (guardadosBien.current.get(jugadorId) || 0) === vez)
        setPlantel((lista) => lista.map((uno) => (uno.id === jugadorId ? { ...uno, [clave]: antes[clave] } : uno)));
      return { error: respuesta.error };
    }
    reemplazar(respuesta.jugador);
    return {};
  };

  const pegar = async (cambios) => {
    const porJugador = new Map();
    cambios.forEach((cambio) => {
      if (!porJugador.has(cambio.filaId)) porJugador.set(cambio.filaId, {});
      porJugador.get(cambio.filaId)[cambio.clave] = cambio.valor;
    });
    let hechos = 0;
    let ultimoError = "";
    for (const [jugadorId, datos] of porJugador) {
      const respuesta = await guardar(jugadorId, datos); // eslint-disable-line no-await-in-loop
      if (respuesta.cancelado) continue;
      if (respuesta.error) {
        ultimoError = respuesta.error;
        continue;
      }
      reemplazar(respuesta.jugador);
      // Lo demás se guardó; las horas, no (falta el SQL de las horas previas).
      if (respuesta.aviso) ultimoError = respuesta.aviso;
      hechos += Object.keys(datos).length - (respuesta.sinGuardar || 0);
    }
    return { hechos, error: ultimoError };
  };

  // Nombre y fecha de nacimiento, los dos obligatorios (Santiago, 17/10).
  const crear = async (nombre, fecha) => {
    setAgregando(true);
    const respuesta = await agregarJugadorBasico(equipoId, nombre);
    if (respuesta.error) {
      setAgregando(false);
      setAviso(t(respuesta.error));
      return;
    }
    const guardado = await guardarDatosJugador(respuesta.jugador.id, { fecha_nacimiento: fecha });
    setAgregando(false);
    const jugador = guardado.error ? respuesta.jugador : guardado.jugador;
    setPlantel((antes) => [...antes, jugador].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
    setNombreNuevo("");
    setFechaNueva("");
    setAviso(guardado.error ? t("datos.agregadoSinFecha", { error: t(guardado.error) }) : t("datos.agregado"));
  };

  const agregar = async (evento) => {
    evento.preventDefault();
    const nombre = nombreNuevo.trim();
    if (!nombre) {
      setAviso(t("datos.error.nombre"));
      return;
    }
    if (!fechaNueva) {
      setAviso(t("datos.error.fechaObligatoria"));
      return;
    }
    if (fechaNueva > hoyISO()) {
      setAviso(t("datos.error.nacimientoFuturo"));
      return;
    }
    // La misma fecha que otro jugador: se pregunta antes de agregarlo.
    const coincidencias = conLaMismaFecha(plantel, fechaNueva);
    if (coincidencias.length) {
      setMismo({ nombre, fecha: fechaNueva, coincidencias, i: 0 });
      return;
    }
    await crear(nombre, fechaNueva);
  };
  // «Sí, es el mismo»: no se agrega y queda el que ya estaba (esté o no en
  // el plantel actual). «No, es otro»: se pregunta por el siguiente con esa
  // fecha y, sin más, se agrega.
  const esElMismo = () => {
    const jugador = mismo.coincidencias[mismo.i];
    setMismo(null);
    setNombreNuevo("");
    setFechaNueva("");
    setAviso(t("datos.mismo.noSeAgrego", { jugador: jugador.nombre }));
  };
  const esOtro = async () => {
    if (mismo.i + 1 < mismo.coincidencias.length) {
      setMismo({ ...mismo, i: mismo.i + 1 });
      return;
    }
    const { nombre, fecha } = mismo;
    setMismo(null);
    await crear(nombre, fecha);
  };
  const delMismo = mismo ? mismo.coincidencias[mismo.i] : null;

  // Se borran de a uno, todos los elegidos (con Shift, varias filas); si
  // alguno no se puede (por ejemplo, con lesiones o evaluaciones cargadas),
  // se avisa cuántos se borraron.
  const confirmarBorrar = async () => {
    const elegidos = aBorrar || [];
    setABorrar(null);
    if (!elegidos.length) return;
    const borrados = [];
    let falla = "";
    for (const jugador of elegidos) {
      const respuesta = await quitarJugadorBasico(jugador.id);
      if (respuesta.error) falla = falla || respuesta.error;
      else borrados.push(jugador.id);
    }
    setPlantel((antes) => antes.filter((uno) => !borrados.includes(uno.id)));
    if (falla) setAviso(elegidos.length === 1 ? t(falla) : `${t(falla)} ${t("tabla.borradasDe", { n: borrados.length, total: elegidos.length })}`);
    else setAviso(elegidos.length === 1 ? t("datos.borrado") : t("datos.borrados", { n: borrados.length }));
  };

  const estado = error ? (
    <div className="lesiones-estado error">
      {t(error)}{" "}
      <button type="button" onClick={cargar}>
        {t("comun.reintentar")}
      </button>
    </div>
  ) : cargando ? (
    <p className="lesiones-estado">{t("comun.cargando")}</p>
  ) : null;

  const pantallaImportar = (
    <ImportarJugadores
      equipoId={equipoId}
      plantel={plantel}
      config={config}
      // Con Lesiones en solo lectura no se pregunta por la categoría.
      lesionesDe={editaLesiones ? lesionesDe : {}}
      onCambiarCategoria={aplicarCategoria}
      onVolver={() => setImportando(false)}
      onRecargar={cargar}
      onListo={({ nuevos, actualizados }) => {
        setImportando(false);
        setAviso(t("datos.importar.listo", { nuevos: plural("datos.importar.nuevos", nuevos), actualizados: plural("datos.importar.actualizados", actualizados) }));
      }}
    />
  );

  return (
    <MarcoAplicacion
      activo={vista}
      onNavigate={(destino) => {
        setImportando(false);
        if (destinos.some((uno) => uno.id === destino)) setVista(destino);
      }}
      destinos={destinos}
      marca={t("datos.titulo")}
      className="entrenamiento-marco lesiones-marco datos-marco"
    >
      {importando && !soloLectura ? pantallaImportar : (
      <div className="app app-inicio">
        <div className="contenedor contenedor-inicio-formacion contenedor-base">
          <header className="hero-partido hero-lesiones">
            <div className="hero-lesiones-barra">
              {onVolver ? (
                <BotonModulos onClick={onVolver}>{t("portal.modulos")}</BotonModulos>
              ) : (
                <span />
              )}
              <SelectorIdioma />
            </div>
            <div className="hero-lesiones-club">
              <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
              <span className="etiqueta-hero">{t("datos.titulo").toUpperCase()}</span>
              <strong className="nombre-sesion">{equipo?.nombre || t("datos.titulo")}</strong>
              <p className="fecha-hero">{vista === "jugadores" ? t("datos.texto") : t("datos.textoCorto")}</p>
              <span className="estado-hero">
                {plural("datos.jugadores", plantel.length)} · {plural("datos.actuales", plantel.filter(esActual).length)}
              </span>
            </div>
          </header>

          <AvisoSoloLectura hasta={equipo?.hasta} mirar={mirar} modulo="datos" />
          {estado}

          {vista === "posiciones" && !cargando && !error && <PosicionesJugadores plantel={plantel} soloLectura={soloLectura} onCambiar={cambiarPuestos} />}

          {vista === "ajustes" && (
            <AjustesDatosBasicos
              equipoId={equipoId}
              config={config}
              columnas={columnasDeAjustes}
              soloLectura={soloLectura}
              conCatapult={conCatapult}
              onRecargar={recargarAjustes}
              onAviso={setAviso}
            />
          )}

          {vista === "jugadores" && !soloLectura && (
          <section className="tarjeta tarjeta-inicio">
            <form className="agregar-jugador datos-agregar" onSubmit={agregar}>
              <label className="datos-agregar-campo datos-agregar-nombre">
                <span>{t("datos.nombre")}</span>
                <input
                  type="text"
                  value={nombreNuevo}
                  placeholder={t("datos.nombre")}
                  aria-label={t("datos.nombre")}
                  maxLength={80}
                  autoComplete="off"
                  onChange={(evento) => setNombreNuevo(evento.target.value)}
                />
              </label>
              <label className="datos-agregar-campo datos-agregar-fecha">
                <span>{etiqueta("fecha_nacimiento")}</span>
                <input
                  type="date"
                  value={fechaNueva}
                  max={hoyISO()}
                  aria-label={etiqueta("fecha_nacimiento")}
                  onChange={(evento) => setFechaNueva(evento.target.value)}
                />
              </label>
              <button type="submit" className="boton-principal" disabled={agregando || !nombreNuevo.trim() || !fechaNueva}>
                {agregando ? t("comun.guardando") : t("datos.agregar")}
              </button>
            </form>
            <button type="button" className="boton-secundario datos-pegar-excel" onClick={() => setImportando(true)} disabled={cargando || Boolean(error)}>
              <Icono nombre="documento" size={16} />
              {t("datos.importar.boton")}
            </button>
          </section>
          )}

          {vista === "jugadores" && (
          <section className="tarjeta">
            {sinFecha > 0 && !soloLectura && (
              <p className="lesiones-estado datos-sin-fecha" role="status">
                {plural("datos.sinFecha.cuantos", sinFecha)}
                <button type="button" onClick={() => setSoloSinFecha((antes) => !antes)}>
                  {soloSinFecha ? t("datos.sinFecha.todos") : plural("datos.sinFecha.ver", sinFecha)}
                </button>
              </p>
            )}
            <TablaDatos
              id="jugadores"
              recordar="jugadores"
              columnas={columnas}
              filas={filas}
              onEditar={editarCelda}
              onPegar={pegar}
              leyenda={t("datos.leyendaYaNoEsta")}
              rotuloApagada={t("datos.yaNoEsta")}
              apagadasAlFinal
              // Va por nombre, con los que ya no están al final: abre arriba,
              // con el plantel actual a la vista (Santiago, 18/10: «Arriba,
              // como ahora»; UI-054).
              abrirAlFinal={false}
              onBorrarFilas={
                soloLectura
                  ? undefined
                  : (ids) => {
                      const elegidos = plantel.filter((uno) => ids.includes(uno.id));
                      if (elegidos.length) setABorrar(elegidos);
                    }
              }
            />
          </section>
          )}
        </div>
      </div>
      )}

      {aviso && (
        <div className="lesiones-toast" role="status">
          {aviso}
        </div>
      )}

      <HojaConfirmar
        abierta={Boolean(aBorrar?.length)}
        titulo={aBorrar?.length > 1 ? t("datos.borrarVariosTitulo", { n: aBorrar.length }) : t("datos.borrarTitulo")}
        descripcion={aBorrar?.length > 1 ? t("datos.borrarVariosTexto", { n: aBorrar.length }) : t("datos.borrarTexto", { jugador: aBorrar?.[0]?.nombre || "" })}
        icono="borrar"
        etiquetaConfirmar={t("datos.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBorrar}
        onCancelar={() => setABorrar(null)}
      />
      {/* Arranca en «Sí, es el mismo» (no agrega nada); cerrar no agrega ni descarta. */}
      <HojaConfirmar
        abierta={Boolean(delMismo)}
        titulo={t("datos.mismo.titulo")}
        descripcion={
          delMismo
            ? t("datos.mismo.texto", {
                fecha: fechaCorta(mismo.fecha),
                jugador: esActual(delMismo) ? delMismo.nombre : `${delMismo.nombre} · ${t("datos.yaNoEsta")}`,
              })
            : ""
        }
        detalle={mismo ? t("datos.mismo.agregando", { nombre: mismo.nombre }) : null}
        icono="usuario"
        etiquetaCancelar={t("datos.mismo.si")}
        etiquetaConfirmar={t("datos.mismo.no")}
        onCancelar={esElMismo}
        onConfirmar={esOtro}
        onCerrar={() => setMismo(null)}
      />
      {/* La categoría nueva: arranca en «Desde esa fecha» (lo anterior queda); cerrar no cambia nada. */}
      <HojaConfirmar
        abierta={Boolean(cambioCategoria)}
        titulo={t("datos.categoria.titulo")}
        descripcion={
          cambioCategoria
            ? plural("datos.categoria.texto", lesionesDe[cambioCategoria.jugador.id]?.length || 0, {
                jugador: cambioCategoria.jugador.nombre,
                anterior: textoDeOpcion("categoria", cambioCategoria.jugador.categoria),
                nueva: cambioCategoria.nueva ? textoDeOpcion("categoria", cambioCategoria.nueva) : t("datos.categoria.ninguna"),
              })
            : ""
        }
        detalle={
          cambioCategoria ? (
            <label className="datos-categoria-desde">
              <span>{t("datos.categoria.desdeFecha")}</span>
              <input
                type="date"
                value={cambioCategoria.fecha}
                max={hoyISO()}
                aria-label={t("datos.categoria.desdeFecha")}
                onChange={(evento) => setCambioCategoria((antes) => (antes ? { ...antes, fecha: evento.target.value } : antes))}
              />
            </label>
          ) : null
        }
        icono="usuario"
        etiquetaCancelar={t("datos.categoria.desde")}
        etiquetaConfirmar={t("datos.categoria.todo")}
        onCancelar={() => responderCategoria({ desde: cambioCategoria?.fecha || hoyISO() })}
        onConfirmar={() => responderCategoria({ desde: null })}
        onCerrar={() => responderCategoria(null)}
      />
    </MarcoAplicacion>
  );
}
