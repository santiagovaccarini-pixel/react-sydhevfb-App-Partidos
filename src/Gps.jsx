import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icono, MarcoAplicacion } from "./components/AppChrome";
import { EscudoDeClub } from "./components/ClubCrest";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { TablaDatos } from "./components/TablaDatos.jsx";
import { AvisoSoloLectura } from "./components/SoloLectura.jsx";
import ImportarGps from "./ImportarGps.jsx";
import { COLUMNAS_FIJAS, codigoNuevo, columnaOculta, columnasVisibles, opcionesDeLista, opcionesDelExcel, tituloDeColumna } from "./domain/evaluaciones/ajustes.js";
import { TIPOS_PROPIOS, armarConfigGps, claveDeColumnaPropia, configGpsVacia, gpsDelClub } from "./domain/gps/ajustes.js";
import { PROMEDIOS } from "./domain/gps/columnas.js";
import { FILAS_DEL_INFORME, vistaDelGps } from "./domain/gps/informe.js";
import { datosConCambio, esNumero, periodoInicial, textoDeCelda } from "./domain/gps/valores.js";
import { actualizarFilaGps, borrarFilaGps, guardarCabeceraGps, guardarOpcionGps, leerAjustesGps, listarGps } from "./domain/gpsDb.js";
import { cargarEquipos, elegirEquipoInicial, guardarEquipoElegido, leerEquipoElegido } from "./domain/equipo.js";
import { cargarPlantelLesiones } from "./domain/lesionesDb.js";
import { actualesPrimero, esActual } from "./domain/plantel.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import "./lesiones.css";
import "./evaluaciones.css";
import "./gps.css";

// GPS (en Bases de Datos): la hoja BD_GPS del Excel, paso 1 (Santiago,
// 10/10): la Base y sus Ajustes. Lo de cada columna está en
// domain/gps/columnas.js; el informe y los colores, en domain/gps/informe.js.
//   · Base: las filas de un período (al abrir, las últimas 4 semanas; se
//     cambia arriba), con el informe del Excel arriba (promedio, desvío,
//     n, máximo y mínimo de lo que deja ver el filtro) y los mismos colores,
//     cada dispositivo contra lo suyo. Se corrige en la tabla y el historial
//     se trae una vez con Pegar desde Excel.
//   · Ajustes: el nombre de cada columna, esconderla, sumar columnas del
//     club y las opciones de cada lista (también los dispositivos).
// La carga de cada día (la plantilla Suma de Bloques), los reportes y los
// V.R. son los pasos que siguen (docs/PENDIENTES.md, «GPS»).

export const DESTINOS_GPS = [
  { id: "base", etiqueta: "Base", icono: "documento" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

// Cómo va cada tipo de columna en la tabla. Las duraciones y las horas se
// guardan en segundos; la tabla las escribe como horas (h:mm:ss).
const TIPO_EN_LA_TABLA = { jugador: "lista", fecha: "fecha", numero: "numero", porMinuto: "numero", tiempo: "horas", hora: "horas", lista: "lista", texto: "texto" };
const EN_SEGUNDOS = ["tiempo", "hora"];
// Van alineadas a la izquierda, como en el Excel; el resto, centrado.
const A_LA_IZQUIERDA = ["jugador", "descripcion"];
// Quién es una fila del promedio del equipo, en la columna Nombre.
const PROMEDIO = "promedio:";

// onVolver: el botón de arriba a la izquierda (vuelve a Bases de Datos);
// volverA: la clave de su texto.
export default function Gps({ onVolver, volverA = "portal.basesTitulo" }) {
  const { idioma, plural } = useIdioma();
  const [equipo, setEquipo] = useState(() => leerEquipoElegido());
  const [vista, setVista] = useState("base");
  const [plantel, setPlantel] = useState([]);
  const [plantelSinLeer, setPlantelSinLeer] = useState(false);
  // Las filas del período.
  const [filasGps, setFilasGps] = useState([]);
  const [filasAjustes, setFilasAjustes] = useState({ campos: [], opciones: [] });
  const [periodo, setPeriodo] = useState(() => periodoInicial(hoyISO()));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [importando, setImportando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));

  // Ajustes: qué se mira y la hoja abierta.
  const [vistaAjustes, setVistaAjustes] = useState("inicio");
  const [hojaCabecera, setHojaCabecera] = useState(null);
  const [hojaOpcion, setHojaOpcion] = useState(null);
  const [hojaColumna, setHojaColumna] = useState(null);
  const [errorHoja, setErrorHoja] = useState("");

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

  // Datos básicos y los Ajustes: una vez por club.
  const cargarClub = useCallback(async () => {
    const [respuestaPlantel, respuestaAjustes] = await Promise.all([cargarPlantelLesiones(equipoId), leerAjustesGps(equipoId)]);
    setPlantel(respuestaPlantel.plantel || []);
    setPlantelSinLeer(Boolean(respuestaPlantel.error || respuestaPlantel.deRespaldo));
    // Sin poder leer los Ajustes, siguen los nombres del Excel.
    if (!respuestaAjustes.error) setFilasAjustes({ campos: respuestaAjustes.campos, opciones: respuestaAjustes.opciones });
  }, [equipoId]);

  // Las filas del período. Si se cambia el período mientras se leía, vale
  // la última lectura pedida.
  const lecturas = useRef(0);
  const cargarFilas = useCallback(async () => {
    lecturas.current += 1;
    const esta = lecturas.current;
    setCargando(true);
    setError("");
    const respuesta = await listarGps(equipoId, { desde: periodo.desde || null, hasta: periodo.hasta || null });
    if (esta !== lecturas.current) return;
    if (respuesta.error) setError(respuesta.error);
    else setFilasGps(respuesta.filas);
    setCargando(false);
  }, [equipoId, periodo]);

  const cargar = useCallback(() => Promise.all([cargarClub(), cargarFilas()]), [cargarClub, cargarFilas]);

  useEffect(() => {
    cargarClub();
  }, [cargarClub]);

  useEffect(() => {
    cargarFilas();
  }, [cargarFilas]);

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

  const config = useMemo(() => (filasAjustes ? armarConfigGps(filasAjustes.campos, filasAjustes.opciones) : configGpsVacia()), [filasAjustes]);
  // Las columnas del Excel y las que sumó el club.
  const gps = useMemo(() => gpsDelClub(config), [config]);
  const titulo = (columna) => tituloDeColumna(gps, columna, config, idioma);

  const jugadorDe = useCallback((id) => plantel.find((jugador) => String(jugador.id) === String(id)) || null, [plantel]);
  // De quién es una fila: el jugador, la persona o el promedio del equipo.
  const nombreDe = (fila) => (fila?.promedio ? PROMEDIOS[fila.promedio]?.[idioma] : jugadorDe(fila?.jugador_id)?.nombre || fila?.persona || "");

  // ----------------------------------------------------------------- Base --

  const visibles = useMemo(() => columnasVisibles(gps, config), [gps, config]);
  // El texto de cada opción de cada lista, una vez por lista (son miles de celdas).
  const textosDeListas = useMemo(() => {
    const listas = {};
    gps.columnas
      .filter((columna) => columna.tipo === "lista")
      .forEach((columna) => {
        listas[columna.lista] = new Map(opcionesDeLista(columna.lista, config, idioma, { test: gps, conOcultas: true }).map((opcion) => [opcion.valor, opcion.etiqueta]));
      });
    return listas;
  }, [gps, config, idioma]);

  // Para elegir de quién es una fila: el promedio del equipo o un jugador
  // (los del plantel actual primero; quien ya no está, con su aviso).
  const opcionesDeQuien = useMemo(
    () => [
      ...Object.entries(PROMEDIOS).map(([clave, texto]) => ({ valor: `${PROMEDIO}${clave}`, etiqueta: texto[idioma], alias: Object.values(texto) })),
      ...actualesPrimero(plantel).map((jugador) => ({
        valor: String(jugador.id),
        etiqueta: esActual(jugador) ? jugador.nombre : `${jugador.nombre} · ${t("datos.yaNoEsta")}`,
        alias: [jugador.nombre],
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plantel, idioma],
  );

  const columnas = useMemo(
    () =>
      visibles.map((columna) => ({
        clave: columna.clave,
        titulo: tituloDeColumna(gps, columna, config, idioma),
        tipo: TIPO_EN_LA_TABLA[columna.tipo] || "texto",
        // Un "por minuto" no se escribe: sale de su medida y del Tiempo.
        editable: !soloLectura && columna.tipo !== "porMinuto",
        ancho: columna.ancho,
        alinear: A_LA_IZQUIERDA.includes(columna.clave) ? undefined : "centro",
        opciones:
          columna.tipo === "jugador"
            ? opcionesDeQuien
            : columna.tipo === "lista"
              ? opcionesDeLista(columna.lista, config, idioma, { test: gps }).map((opcion) => ({
                  valor: opcion.valor,
                  etiqueta: opcion.etiqueta,
                  // Para pegar: también vale el texto en el otro idioma y como lo escribe el Excel.
                  alias: [
                    ...new Set(
                      ["es-AR", "pt-BR"].flatMap((uno) =>
                        [config, configGpsVacia()].map((cual) => opcionesDeLista(columna.lista, cual, uno, { test: gps, conOcultas: true }).find((una) => una.valor === opcion.valor)?.etiqueta).filter(Boolean),
                      ),
                    ),
                  ],
                }))
              : undefined,
      })),
    [gps, visibles, config, idioma, soloLectura, opcionesDeQuien],
  );
  const fijas = useMemo(() => visibles.filter((columna) => columna.fija).map((columna) => columna.clave), [visibles]);

  // Cómo se ve cada celda (con el formato del Excel) y qué se edita.
  const filas = useMemo(
    () =>
      filasGps.map((fila) => {
        const jugador = fila.jugador_id ? jugadorDe(fila.jugador_id) : null;
        const valores = {};
        const textos = {};
        const orden = {};
        visibles.forEach((columna) => {
          const { clave } = columna;
          const dato = fila.datos?.[clave];
          switch (columna.tipo) {
            case "jugador":
              valores[clave] = fila.promedio ? `${PROMEDIO}${fila.promedio}` : fila.jugador_id ? String(fila.jugador_id) : "";
              textos[clave] = fila.promedio ? PROMEDIOS[fila.promedio]?.[idioma] || "" : jugador?.nombre || fila.persona || "";
              orden[clave] = textos[clave];
              break;
            case "fecha":
              valores[clave] = fila.fecha;
              textos[clave] = fechaCorta(fila.fecha);
              orden[clave] = fila.fecha || "";
              break;
            case "lista":
              valores[clave] = dato ?? "";
              textos[clave] = dato === undefined || dato === null || dato === "" ? "" : textosDeListas[columna.lista]?.get(dato) || String(dato);
              break;
            default:
              if (EN_SEGUNDOS.includes(columna.tipo)) {
                valores[clave] = esNumero(dato) ? dato / 3600 : null;
                if (esNumero(dato)) orden[clave] = dato;
              } else if (columna.tipo === "texto") {
                valores[clave] = dato ?? "";
              } else {
                valores[clave] = esNumero(dato) ? dato : null;
                if (esNumero(dato)) orden[clave] = dato;
              }
              textos[clave] = textoDeCelda(columna, dato, idioma);
          }
        });
        // Quien ya no está en el plantel actual, en otro color (como en Lesiones).
        return { id: fila.id, valores, textos, orden, gps: fila, apagada: Boolean(jugador && !esActual(jugador)) };
      }),
    [filasGps, visibles, jugadorDe, textosDeListas, idioma],
  );

  const ordenDeDispositivos = useMemo(() => new Map([...(textosDeListas.dispositivo?.keys() || [])].map((codigo, indice) => [codigo, indice])), [textosDeListas]);

  // Con las filas que se ven: el informe de arriba y los colores, cada
  // dispositivo con lo suyo. Con más de un dispositivo a la vista, un
  // informe por dispositivo, con su nombre.
  const informeYColores = useCallback(
    (filasVista) => {
      const { grupos, estilos } = vistaDelGps(
        filasVista.map((fila) => fila.gps),
        visibles,
      );
      const delInforme = visibles.filter((columna) => columna.informe);
      // Los dispositivos en el orden de su lista (Ajustes); sin dispositivo, al final.
      const lugar = (codigo) => (codigo ? (ordenDeDispositivos.has(codigo) ? ordenDeDispositivos.get(codigo) : ordenDeDispositivos.size) : ordenDeDispositivos.size + 1);
      grupos.sort((a, b) => lugar(a.dispositivo) - lugar(b.dispositivo));
      const varios = grupos.length > 1;
      const nombreDelDispositivo = (codigo) => (codigo ? textosDeListas.dispositivo?.get(codigo) || codigo : t("gps.sinDispositivo"));
      const texto = (columna, cuentas, fila) => {
        const valor = cuentas?.[fila];
        if (!esNumero(valor)) return "";
        return fila === "n" ? String(valor) : textoDeCelda(columna, valor, idioma);
      };
      return {
        estilos,
        arriba: grupos.flatMap((grupo) =>
          FILAS_DEL_INFORME.map((fila) => ({
            id: `${grupo.dispositivo}:${fila.id}`,
            rotulo: varios ? (
              <span className="gps-rotulo">
                <b>{nombreDelDispositivo(grupo.dispositivo)}</b>
                <span>{fila.rotulo[idioma]}</span>
              </span>
            ) : (
              fila.rotulo[idioma]
            ),
            celdas: Object.fromEntries(delInforme.map((columna) => [columna.clave, { texto: texto(columna, grupo.cuentas[columna.clave], fila.id) }])),
          })),
        ),
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibles, textosDeListas, ordenDeDispositivos, idioma],
  );

  const reemplazar = (fila) => setFilasGps((previas) => previas.map((una) => (una.id === fila.id ? fila : una)));

  // Lo último de cada fila (lo que ya devolvió la base, aunque la pantalla
  // todavía no se haya redibujado) y una cola por fila: dos celdas de la
  // misma fila guardadas seguidas no se pisan, la segunda sale de lo que
  // dejó la primera.
  const ultimas = useRef(filasGps);
  ultimas.current = filasGps;
  const colas = useRef(new Map());
  const guardarFila = (id, cambiar) => {
    const unPaso = async () => {
      const fila = ultimas.current.find((una) => una.id === id);
      if (!fila) return { error: "gps.error.noGuardar" };
      const { fila: nueva, error: falta } = cambiar(fila);
      if (falta) return { error: falta };
      if (!nueva) return {};
      const respuesta = await actualizarFilaGps(id, nueva);
      if (respuesta.error) return { error: respuesta.error };
      ultimas.current = ultimas.current.map((una) => (una.id === id ? respuesta.fila : una));
      reemplazar(respuesta.fila);
      return {};
    };
    const siguiente = (colas.current.get(id) || Promise.resolve()).then(unPaso, unPaso);
    colas.current.set(id, siguiente);
    return siguiente;
  };

  // Una celda cambiada, sobre la fila: { fila } o { error } (y nada si no
  // se cambia a mano). Si se cambia una medida o el Tiempo, se recalcula su
  // "por minuto".
  const conCambio = (fila, clave, valor) => {
    const columna = gps.columnas.find((una) => una.clave === clave);
    if (!columna || columna.tipo === "porMinuto") return {};
    if (columna.tipo === "fecha") return valor ? { fila: { ...fila, fecha: valor } } : { error: "gps.error.sinFecha" };
    if (columna.tipo === "jugador") {
      // Una fila es siempre de alguien: un jugador o el promedio del equipo.
      if (!valor) return { error: "gps.error.sinJugador" };
      if (String(valor).startsWith(PROMEDIO)) return { fila: { ...fila, jugador_id: null, persona: null, promedio: String(valor).slice(PROMEDIO.length) } };
      return { fila: { ...fila, jugador_id: Number(valor), persona: null, promedio: null } };
    }
    let nuevo = valor === "" || valor === undefined ? null : valor;
    if (EN_SEGUNDOS.includes(columna.tipo)) nuevo = esNumero(nuevo) ? Math.round(nuevo * 3600) : null;
    return { fila: { ...fila, datos: datosConCambio(fila.datos, clave, nuevo) } };
  };

  const editarCelda = (id, clave, valor) => guardarFila(id, (fila) => conCambio(fila, clave, valor));

  const pegarEnTabla = async (cambios) => {
    const porFila = new Map();
    cambios.forEach((cambio) => porFila.set(cambio.filaId, [...(porFila.get(cambio.filaId) || []), cambio]));
    let hechos = 0;
    let ultimoError = "";
    for (const [id, suyos] of porFila) {
      // eslint-disable-next-line no-await-in-loop
      const resultado = await guardarFila(id, (fila) => {
        let falta = "";
        const nueva = suyos.reduce((acumulada, cambio) => {
          const uno = conCambio(acumulada, cambio.clave, cambio.valor);
          if (uno.error) falta = uno.error;
          return uno.fila || acumulada;
        }, fila);
        return falta ? { error: falta } : { fila: nueva };
      });
      if (resultado.error) ultimoError = resultado.error;
      else hechos += suyos.length;
    }
    return { hechos, error: ultimoError };
  };

  // Se borran de a una, todas las elegidas (con Shift, varias filas); si
  // alguna no se puede, se avisa cuántas se borraron.
  const confirmarBorrar = async () => {
    const elegidas = aBorrar || [];
    setABorrar(null);
    if (!elegidas.length) return;
    setOcupado(true);
    const borradas = [];
    let falla = "";
    for (const fila of elegidas) {
      const respuesta = await borrarFilaGps(fila.id); // eslint-disable-line no-await-in-loop
      if (respuesta.error) falla = falla || respuesta.error;
      else borradas.push(fila.id);
    }
    setOcupado(false);
    setFilasGps((previas) => previas.filter((una) => !borradas.includes(una.id)));
    if (falla) setAviso(elegidas.length === 1 ? t(falla) : `${t(falla)} ${t("tabla.borradasDe", { n: borradas.length, total: elegidas.length })}`);
    else setAviso(elegidas.length === 1 ? t("gps.borrada") : t("gps.borradas", { n: borradas.length }));
  };

  // ------------------------------------------------------------ Pantallas --

  const estado = !enLinea ? (
    <p className="lesiones-estado">{t("gps.estado.sinConexion")}</p>
  ) : error ? (
    <div className="lesiones-estado error">
      {t(error)}{" "}
      <button type="button" onClick={cargar}>
        {t("comun.reintentar")}
      </button>
    </div>
  ) : cargando ? (
    <p className="lesiones-estado">{t("gps.estado.cargando")}</p>
  ) : null;

  const hoy = hoyISO();
  const textoDelPeriodo =
    periodo.desde || periodo.hasta
      ? [periodo.desde ? fechaCorta(periodo.desde) : "…", periodo.hasta ? fechaCorta(periodo.hasta) : "…"].join(" – ")
      : t("lesiones.reportes.periodos.todo");

  const pantallaBase = (
    <div className="app app-inicio">
      <div className="contenedor contenedor-inicio-formacion contenedor-base">
        <header className="hero-partido hero-lesiones">
          <div className="hero-lesiones-barra">
            {onVolver ? (
              <button type="button" className="boton-modulos" onClick={onVolver}>
                <Icono nombre="flecha" size={14} />
                {t(volverA)}
              </button>
            ) : (
              <span />
            )}
            <SelectorIdioma />
          </div>
          <div className="hero-lesiones-club">
            <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
            <span className="etiqueta-hero">{t("gps.titulo").toUpperCase()}</span>
            <strong className="nombre-sesion">{equipo?.nombre || t("gps.titulo")}</strong>
            <p className="fecha-hero">{textoDelPeriodo}</p>
            <span className="estado-hero">{cargando ? t("gps.estado.leyendo") : plural("gps.filas", filasGps.length)}</span>
          </div>
        </header>

        <AvisoSoloLectura hasta={equipo?.hasta} />

        <section className="tarjeta gps-periodo">
          <div className="evaluaciones-reporte-campos gps-periodo-campos">
            <label className="campo-inicio">
              <span>{t("lesiones.reportes.desde")}</span>
              <input
                type="date"
                value={periodo.desde}
                max={periodo.hasta || hoy}
                onChange={(evento) => setPeriodo((antes) => ({ ...antes, desde: evento.target.value }))}
              />
            </label>
            <label className="campo-inicio">
              <span>{t("lesiones.reportes.hasta")}</span>
              <input
                type="date"
                value={periodo.hasta}
                min={periodo.desde || undefined}
                max={hoy}
                onChange={(evento) => setPeriodo((antes) => ({ ...antes, hasta: evento.target.value }))}
              />
            </label>
          </div>
          <p className="lesiones-ayuda">{t("gps.periodoAyuda")}</p>
        </section>

        {estado}

        {!soloLectura && (
          <button type="button" className="boton-secundario datos-pegar-excel lesiones-pegar-excel" onClick={() => setImportando(true)} disabled={!enLinea}>
            <Icono nombre="documento" size={16} />
            {t("gps.importar.boton")}
          </button>
        )}
        <section className="tarjeta evaluaciones-tabla">
          <TablaDatos
            id="gps"
            recordar="gps"
            columnas={columnas}
            filas={filas}
            fijas={fijas}
            // Un período tiene miles de filas: se dibujan las que se ven.
            muchasFilas
            vista={informeYColores}
            onEditar={editarCelda}
            onPegar={pegarEnTabla}
            leyenda={t("datos.leyendaYaNoEsta")}
            rotuloApagada={t("datos.yaNoEsta")}
            onBorrarFilas={
              soloLectura
                ? undefined
                : (ids) => {
                    const elegidas = filasGps.filter((una) => ids.includes(una.id));
                    if (elegidas.length) setABorrar(elegidas);
                  }
            }
          />
        </section>
      </div>
    </div>
  );

  // -------------------------------------------------------------- Ajustes --

  // Título a la izquierda y el idioma a la derecha, como en Evaluaciones.
  const encabezado = (textoTitulo, texto) => (
    <header className="encabezado lesiones-encabezado">
      <div className="lesiones-encabezado-texto">
        <h1>{textoTitulo}</h1>
        {texto && <p>{texto}</p>}
      </div>
      <SelectorIdioma className="lesiones-idioma" />
    </header>
  );

  const guardarHojaCabecera = async () => {
    const hoja = hojaCabecera;
    if (!hoja) return;
    if (!String(hoja.etiquetas[idioma] || "").trim()) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    setOcupado(true);
    // Una columna del club guarda también su tipo (sin él, deja de estar).
    const respuesta = await guardarCabeceraGps(equipoId, hoja.clave, hoja);
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    await cargarClub();
    setHojaCabecera(null);
    setAviso(t("lesiones.ajustes.guardado"));
  };

  const guardarHojaColumna = async () => {
    const hoja = hojaColumna;
    if (!hoja) return;
    const nombre = String(hoja.nombre || "").trim();
    if (!nombre) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    // Ni dos columnas con el mismo nombre (al pegar, no se sabría cuál es).
    const repetida = gps.columnas.some((columna) =>
      ["es-AR", "pt-BR"].some((uno) => tituloDeColumna(gps, columna, config, uno).trim().toLowerCase() === nombre.toLowerCase()),
    );
    if (repetida) {
      setErrorHoja(t("gps.ajustes.columnaRepetida"));
      return;
    }
    setOcupado(true);
    const clave = claveDeColumnaPropia(
      nombre,
      [...gps.columnas.map((columna) => columna.clave), ...filasAjustes.campos.map((fila) => fila.campo)],
    );
    const respuesta = await guardarCabeceraGps(equipoId, clave, { etiquetas: { [idioma]: nombre }, oculto: false, orden: 1000 + (config.propias?.length || 0), tipo: hoja.tipo });
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    await cargarClub();
    setHojaColumna(null);
    setAviso(t("gps.ajustes.columnaAgregada"));
  };

  const guardarHojaOpcion = async () => {
    const hoja = hojaOpcion;
    if (!hoja) return;
    const propio = String(hoja.etiquetas[idioma] || "").trim();
    if (!propio) {
      setErrorHoja(t("lesiones.ajustes.faltaTexto"));
      return;
    }
    setOcupado(true);
    const respuesta = await guardarOpcionGps(equipoId, hoja.lista, { ...hoja, codigo: hoja.codigo || codigoNuevo(propio) });
    setOcupado(false);
    if (respuesta.error) {
      setErrorHoja(t(respuesta.error));
      return;
    }
    await cargarClub();
    setHojaOpcion(null);
    setAviso(t("lesiones.ajustes.guardado"));
  };

  const filaAjuste = ({ id, icono, titulo: rotulo, detalle, alTocar, extra = null, clase = "" }) => (
    <button key={id} type="button" className={`opcion-ajuste ${clase}`.trim()} onClick={alTocar} disabled={soloLectura}>
      {icono && (
        <span className="icono-ajuste">
          <Icono nombre={icono} size={18} />
        </span>
      )}
      <span className="texto-ajuste">
        <b>{rotulo}</b>
        <span>{detalle}</span>
      </span>
      {extra}
      <span className="flecha-ajuste">›</span>
    </button>
  );

  // Las listas del GPS, una por columna de tipo lista, en el orden del Excel.
  const LISTAS = useMemo(() => gps.columnas.filter((columna) => columna.tipo === "lista").map((columna) => ({ clave: columna.lista, columna })), [gps]);
  const tituloDeLista = (lista) => (lista?.columna ? titulo(lista.columna) : lista?.clave || "");

  const tipoDeColumna = (tipo) => t(`gps.ajustes.tipos.${tipo}`);

  const pantallaAjustes = () => {
    if (vistaAjustes === "cabeceras") {
      return (
        <div className="app">
          <div className="contenedor">
            {encabezado(t("lesiones.ajustes.cabeceras"), t("gps.ajustes.cabecerasAyuda"))}
            {gps.columnas.map((columna, indice) => {
              const propio = config.campos?.[gps.id]?.[columna.clave];
              return filaAjuste({
                id: columna.clave,
                titulo: titulo(columna),
                detalle: columna.propia
                  ? t("gps.ajustes.delClub", { tipo: tipoDeColumna(columna.tipo) })
                  : t("lesiones.ajustes.porDefecto", { texto: columna.titulo[idioma] || columna.titulo["es-AR"] }),
                extra: columnaOculta(gps, columna.clave, config) ? <span className="lesiones-oculta">{t("lesiones.ajustes.oculto")}</span> : null,
                alTocar: () => {
                  setErrorHoja("");
                  setHojaCabecera({
                    clave: columna.clave,
                    etiquetas: { ...(propio?.etiquetas && Object.values(propio.etiquetas).some(Boolean) ? propio.etiquetas : columna.titulo) },
                    oculto: Boolean(propio?.oculto),
                    orden: propio?.orden ?? indice,
                    tipo: columna.propia ? columna.tipo : null,
                  });
                },
              });
            })}
            <div className="acciones-dobles">
              <BotonVolver onClick={() => setVistaAjustes("inicio")}>{t("lesiones.ajustes.volver")}</BotonVolver>
              <button
                type="button"
                className="boton-principal"
                onClick={() => {
                  setErrorHoja("");
                  setHojaColumna({ nombre: "", tipo: TIPOS_PROPIOS[0] });
                }}
                disabled={soloLectura}
              >
                {t("gps.ajustes.agregarColumna")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (vistaAjustes.startsWith("lista:")) {
      const clave = vistaAjustes.slice("lista:".length);
      const lista = LISTAS.find((una) => una.clave === clave);
      const todas = opcionesDeLista(clave, config, idioma, { test: gps, conOcultas: true });
      const abrirOpcion = (opcion) => {
        setErrorHoja("");
        const guardada = (config.listas?.[clave] || []).find((una) => una.codigo === opcion?.valor);
        const delExcel = opcion?.delExcel ? opcionesDelExcel(clave, gps).find((una) => una.codigo === opcion.valor) : null;
        const conNombre = guardada?.etiquetas && Object.values(guardada.etiquetas).some((texto) => String(texto || "").trim());
        setHojaOpcion({
          lista: clave,
          codigo: opcion?.valor || null,
          // Una del Excel sin nombre propio: se ve el del Excel, para cambiarlo.
          etiquetas: { ...(conNombre ? guardada.etiquetas : delExcel?.etiquetas || { "es-AR": "", "pt-BR": "" }) },
          oculto: Boolean(opcion?.oculto),
          orden: guardada?.orden ?? (opcion ? todas.findIndex((una) => una.valor === opcion.valor) : todas.length),
        });
      };
      return (
        <div className="app">
          <div className="contenedor">
            {encabezado(lista ? tituloDeLista(lista) : clave, plural("lesiones.ajustes.opciones", todas.length))}
            {clave === "dispositivo" && <p className="lesiones-ayuda gps-ayuda-lista">{t("gps.ajustes.dispositivosAyuda")}</p>}
            {todas.map((opcion) =>
              filaAjuste({
                id: opcion.valor,
                titulo: opcion.etiqueta,
                detalle: opcion.oculto ? t("lesiones.ajustes.oculto") : t("lesiones.ajustes.mostrar"),
                extra: opcion.oculto ? <span className="lesiones-oculta">{t("lesiones.ajustes.oculto")}</span> : null,
                alTocar: () => abrirOpcion(opcion),
              }),
            )}
            <div className="acciones-dobles">
              <BotonVolver onClick={() => setVistaAjustes("listas")}>{t("lesiones.ajustes.volverListas")}</BotonVolver>
              <button type="button" className="boton-principal" onClick={() => abrirOpcion(null)} disabled={soloLectura}>
                {t("lesiones.ajustes.nuevaOpcion")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (vistaAjustes === "listas") {
      return (
        <div className="app">
          <div className="contenedor">
            {encabezado(t("lesiones.ajustes.listas"), t("gps.ajustes.listasAyuda"))}
            {LISTAS.map((lista) =>
              filaAjuste({
                id: lista.clave,
                titulo: tituloDeLista(lista),
                detalle: plural("lesiones.ajustes.opciones", opcionesDeLista(lista.clave, config, idioma, { test: gps }).length),
                alTocar: () => setVistaAjustes(`lista:${lista.clave}`),
              }),
            )}
            <div className="acciones-dobles">
              <BotonVolver onClick={() => setVistaAjustes("inicio")}>{t("lesiones.ajustes.volver")}</BotonVolver>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="app">
        <div className="contenedor">
          {encabezado(t("lesiones.ajustes.titulo"), t("gps.ajustes.texto"))}
          <AvisoSoloLectura hasta={equipo?.hasta} />
          {filaAjuste({
            id: "cabeceras",
            icono: "documento",
            titulo: t("lesiones.ajustes.cabeceras"),
            detalle: t("gps.ajustes.cabecerasTexto"),
            alTocar: () => setVistaAjustes("cabeceras"),
          })}
          {filaAjuste({
            id: "listas",
            icono: "filtro",
            titulo: t("lesiones.ajustes.listas"),
            detalle: t("gps.ajustes.listasTexto"),
            alTocar: () => setVistaAjustes("listas"),
          })}
        </div>
      </div>
    );
  };

  // Mostrar u ocultar, como en Evaluaciones › Ajustes.
  const chipsMostrar = (hoja, setHoja) => (
    <div className="grilla-criterios">
      <button type="button" className={`chip-criterio ${!hoja.oculto ? "prendido" : ""}`} aria-pressed={!hoja.oculto} onClick={() => setHoja({ ...hoja, oculto: false })}>
        {t("lesiones.ajustes.mostrar")}
      </button>
      <button type="button" className={`chip-criterio ${hoja.oculto ? "prendido" : ""}`} aria-pressed={hoja.oculto} onClick={() => setHoja({ ...hoja, oculto: true })}>
        {t("lesiones.ajustes.oculto")}
      </button>
    </div>
  );

  // Cabeceras y opciones se renombran en el idioma que se está usando; el
  // otro idioma guarda lo que tenía.
  const hojaDeTextos = ({ abierta, titulo: rotulo, hoja, setHoja, onGuardar, onCerrar, fija = false, nota = "" }) =>
    hoja ? (
      <HojaInferior
        abierta={abierta}
        className="lesiones-hoja"
        titulo={rotulo}
        onCerrar={onCerrar}
        acciones={
          <>
            <button type="button" className="boton-cancelar-hoja" onClick={onCerrar} disabled={ocupado}>
              {t("comun.cancelar")}
            </button>
            <button type="button" className="boton-confirmar-hoja" onClick={onGuardar} disabled={ocupado}>
              {ocupado ? t("comun.guardando") : t("comun.guardar")}
            </button>
          </>
        }
      >
        {errorHoja && <div className="aviso-hoja">{errorHoja}</div>}
        <div className="campo-inicio">
          <label>{t("lesiones.ajustes.nombre")}</label>
          <input type="text" maxLength={120} value={hoja.etiquetas[idioma] || ""} onChange={(evento) => setHoja({ ...hoja, etiquetas: { ...hoja.etiquetas, [idioma]: evento.target.value } })} />
          <small className="lesiones-ayuda">{t("lesiones.ajustes.nombreAyuda")}</small>
        </div>
        {fija ? <p className="lesiones-ayuda lesiones-nota-fija">{t("gps.ajustes.noSeOculta")}</p> : chipsMostrar(hoja, setHoja)}
        {nota && <p className="lesiones-ayuda lesiones-nota-fija">{nota}</p>}
      </HojaInferior>
    ) : null;

  // --------------------------------------------------------- Navegación --

  let contenido;
  if (vista === "ajustes") contenido = pantallaAjustes();
  else if (importando && !soloLectura)
    contenido = (
      <ImportarGps
        gps={gps}
        config={config}
        equipoId={equipoId}
        plantel={plantel}
        plantelSinLeer={plantelSinLeer}
        onVolver={() => setImportando(false)}
        onRecargar={cargarFilas}
        onListo={({ cargadas }) => {
          setImportando(false);
          setAviso(plural("gps.importar.listo", cargadas));
        }}
      />
    );
  else contenido = pantallaBase;

  // Tocar un destino de la barra cierra lo que estuviera encima.
  const navegar = (id) => {
    setImportando(false);
    if (id === "ajustes") setVistaAjustes("inicio");
    setVista(id);
  };

  const columnaDeLaHoja = hojaCabecera ? gps.columnas.find((columna) => columna.clave === hojaCabecera.clave) : null;

  return (
    <MarcoAplicacion activo={vista} onNavigate={navegar} destinos={DESTINOS_GPS} marca={t("gps.titulo")} className="entrenamiento-marco lesiones-marco evaluaciones-marco gps-marco">
      {contenido}

      {aviso && (
        <div className="lesiones-toast" role="status">
          {aviso}
        </div>
      )}

      {hojaDeTextos({
        abierta: Boolean(hojaCabecera),
        titulo: hojaCabecera ? `${t("lesiones.ajustes.editarCabecera")}: ${columnaDeLaHoja ? titulo(columnaDeLaHoja) : hojaCabecera.clave}` : "",
        hoja: hojaCabecera,
        setHoja: setHojaCabecera,
        onGuardar: guardarHojaCabecera,
        onCerrar: () => !ocupado && setHojaCabecera(null),
        fija: Boolean(hojaCabecera && COLUMNAS_FIJAS.includes(hojaCabecera.clave)),
        // Quitar una columna es esconderla: lo cargado no se pierde.
        nota: hojaCabecera && !COLUMNAS_FIJAS.includes(hojaCabecera.clave) ? t("gps.ajustes.ocultarAyuda") : "",
      })}

      {hojaDeTextos({
        abierta: Boolean(hojaOpcion),
        titulo: hojaOpcion ? (hojaOpcion.codigo ? `${t("lesiones.ajustes.editarOpcion")}: ${tituloDeLista(LISTAS.find((lista) => lista.clave === hojaOpcion.lista) || { clave: hojaOpcion.lista })}` : t("lesiones.ajustes.nuevaOpcion")) : "",
        hoja: hojaOpcion,
        setHoja: setHojaOpcion,
        onGuardar: guardarHojaOpcion,
        onCerrar: () => !ocupado && setHojaOpcion(null),
      })}

      {hojaColumna && (
        <HojaInferior
          abierta
          className="lesiones-hoja"
          titulo={t("gps.ajustes.agregarColumna")}
          onCerrar={() => !ocupado && setHojaColumna(null)}
          acciones={
            <>
              <button type="button" className="boton-cancelar-hoja" onClick={() => setHojaColumna(null)} disabled={ocupado}>
                {t("comun.cancelar")}
              </button>
              <button type="button" className="boton-confirmar-hoja" onClick={guardarHojaColumna} disabled={ocupado}>
                {ocupado ? t("comun.guardando") : t("comun.guardar")}
              </button>
            </>
          }
        >
          {errorHoja && <div className="aviso-hoja">{errorHoja}</div>}
          <div className="campo-inicio">
            <label>{t("lesiones.ajustes.nombre")}</label>
            <input type="text" maxLength={120} value={hojaColumna.nombre} onChange={(evento) => setHojaColumna({ ...hojaColumna, nombre: evento.target.value })} />
            <small className="lesiones-ayuda">{t("gps.ajustes.nombreColumnaAyuda")}</small>
          </div>
          <div className="campo-inicio">
            <label>{t("gps.ajustes.tipo")}</label>
            <div className="grilla-criterios">
              {TIPOS_PROPIOS.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  className={`chip-criterio ${hojaColumna.tipo === tipo ? "prendido" : ""}`}
                  aria-pressed={hojaColumna.tipo === tipo}
                  onClick={() => setHojaColumna({ ...hojaColumna, tipo })}
                >
                  {tipoDeColumna(tipo)}
                </button>
              ))}
            </div>
            <small className="lesiones-ayuda">{t("gps.ajustes.tipoAyuda")}</small>
          </div>
        </HojaInferior>
      )}

      <HojaConfirmar
        abierta={Boolean(aBorrar?.length)}
        titulo={aBorrar?.length > 1 ? t("gps.borrarVariasTitulo", { n: aBorrar.length }) : t("gps.borrarTitulo")}
        descripcion={
          aBorrar?.length > 1
            ? t("gps.borrarVariasTexto", { n: aBorrar.length })
            : t("gps.borrarTexto", { jugador: nombreDe(aBorrar?.[0]) || "—", fecha: aBorrar?.[0]?.fecha ? fechaCorta(aBorrar[0].fecha) : "—" })
        }
        icono="borrar"
        etiquetaConfirmar={t("gps.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBorrar}
        onCancelar={() => setABorrar(null)}
      />
    </MarcoAplicacion>
  );
}
