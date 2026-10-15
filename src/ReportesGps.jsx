import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { ListaParaMarcar } from "./components/ListaParaMarcar.jsx";
import { TerminoDe } from "./components/Guia.jsx";
import { textoDeValor } from "./domain/evaluaciones/excel.js";
import { esNumero } from "./domain/gps/valores.js";
import {
  FILTROS_POR_MICROCICLO,
  TIPOS_DE_VARIABLE,
  VISUALIZACIONES,
  colorDeCargaCronica,
  colorDeMayorMejor,
  colorDeUa,
  colorDeVariable,
  entraEnElInforme,
  filasPorMicrociclo,
  informePorMicrociclo,
  pasaLosFiltros,
  valorDeFiltro,
} from "./domain/gps/porMicrociclo.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// GPS › Reportes (Santiago, 15/10): «Cuando se entra hay 3 opciones Por
// microciclo, Por tarea o Por jugador … Una ves elegido alguna de las 3
// opciones, entra a los filtros … y despues se le da a siguiente», con «LOS
// MISMOS BOTONES Y LOGICAS QUE TIENE EL ARCHIVO». Lo que decidió está en
// docs/PENDIENTES.md («Informe: Por microciclo, Por tarea y Por jugador»).
// Por tarea y Por jugador, todavía no.
//
// Por microciclo, en dos pasos:
//   1. Los filtros: un desplegable con casillas por filtro (15/10, D2); sin
//      nada elegido, todo; solo las opciones con datos con lo elegido en los
//      demás. Al entrar, «Microciclo/Jugador» en Sesión, como abre el
//      archivo; «Limpiar filtros» los vacía todos.
//   2. El informe (domain/gps/porMicrociclo.js): Tipo de variable,
//      Visualización y Categorización; el V.R. de los colores y «+ Otro
//      V.R.» para los microciclos de otro dispositivo o los que se elijan
//      (D1); un solo botón para ver las franjas de cada V.R. (15/10, «solo
//      deja un boton»); la tabla con la primera columna fija (D3).

const FRANJAS = ["excelente", "muyBueno", "bueno", "regular", "malo", "desvio"];
const SIN_ELEGIR = [];
// Al entrar a los filtros: el promedio del equipo de cada microciclo.
const FILTROS_AL_ENTRAR = Object.freeze({ microciclo_jugador: ["sesion"] });
// «Categorización», en el orden del archivo.
const CATEGORIZACIONES_DEL_INFORME = ["miSeleccion", "valorReferencial", "objetivo"];

// Los grupos de columnas con su «?».
const TERMINOS_DE_GRUPOS = { ua: "gps.terminos.unidadArbitraria", cronica: "gps.terminos.cargaCronica" };

const nombreDeReferencia = (referencia) => [referencia.tipo, referencia.tabla, referencia.grupo].filter(Boolean).join(" · ");

// Unos números de microciclo, de corrido: «10 a 16, 18» (dos seguidos van
// sueltos: «15, 16»).
const tramos = (numeros, unir) => {
  const lista = [...new Set(numeros.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  const partes = [];
  lista.forEach((numero) => {
    const ultimo = partes[partes.length - 1];
    if (ultimo && numero === ultimo[1] + 1) ultimo[1] = numero;
    else partes.push([numero, numero]);
  });
  return partes.map(([desde, hasta]) => (desde === hasta ? String(desde) : hasta === desde + 1 ? `${desde}, ${hasta}` : unir(desde, hasta))).join(", ");
};

// Las columnas ocultadas a mano se recuerdan en el aparato (como las columnas
// fijas de las bases); las filas, mientras se está en el informe.
const CLAVE_COLUMNAS_OCULTAS = "gps_informe_columnas_ocultas";
const leerColumnasOcultas = () => {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_COLUMNAS_OCULTAS) || "null");
    return Array.isArray(guardadas) ? guardadas.filter((una) => typeof una === "string") : [];
  } catch {
    return [];
  }
};
const guardarColumnasOcultas = (columnas) => {
  try {
    localStorage.setItem(CLAVE_COLUMNAS_OCULTAS, JSON.stringify(columnas));
  } catch {
    // Sin localStorage, quedan ocultas mientras se está en el informe.
  }
};

// El microciclo de una fila del informe: el suyo (el promedio del equipo) o
// el último de los suyos (un jugador).
const microcicloDe = (fila) => (fila.microciclo ?? fila.microciclos[fila.microciclos.length - 1] ?? null);

// filasGps: todas las del club; referencias: los V.R.; elegidos: los V.R.
// elegidos en la Base (de cada dispositivo); nombreDe(fila) y
// nombreDelDispositivo(código): cómo se llaman; tituloDe(clave) y
// textoDe(clave, valor): el nombre y el formato de cada columna;
// textosDeListas: el texto de cada opción de cada lista; encabezado y
// arriba: los de las demás solapas.
export default function ReportesGps({ filasGps, referencias, elegidos, nombreDe, nombreDelDispositivo, tituloDe, textoDe, textosDeListas, encabezado, arriba = null, cargando = false }) {
  const { idioma, plural } = useIdioma();
  const [modo, setModo] = useState("menu");
  const [filtros, setFiltros] = useState(FILTROS_AL_ENTRAR);
  const [hoja, setHoja] = useState(null);
  const [tipoVariable, setTipoVariable] = useState("absolutas");
  const [visualizacion, setVisualizacion] = useState("promedio");
  const [categorizacion, setCategorizacion] = useState("miSeleccion");
  // Los V.R. elegidos: [{ id, microciclos }]; el primero, el de los colores
  // (sin microciclos: los de su dispositivo). null: el de entrada.
  const [vrs, setVrs] = useState(null);
  const [verFranjas, setVerFranjas] = useState(0);
  // Lo que se ocultó a mano (Santiago, 15/10: «poder ocultar manualmente un
  // columna y filas sin necesidad de entrar a ajustes»; «Cuando toco un
  // columna o fila en cierto lugar tiene que preguntarme si la quiero
  // ocultar»): solo deja de verse, los números no cambian. aOcultar: la
  // columna o la fila tocada, mientras se pregunta.
  const [ocultas, setOcultas] = useState(() => ({ columnas: leerColumnasOcultas(), filas: SIN_ELEGIR }));
  const [aOcultar, setAOcultar] = useState(null);
  useEffect(() => guardarColumnasOcultas(ocultas.columnas), [ocultas.columnas]);
  // El alto de la fila de los grupos (puede tener dos renglones): la de las
  // cabeceras queda pegada debajo al bajar por la tabla.
  const filaDeGrupos = useRef(null);
  useLayoutEffect(() => {
    const fila = filaDeGrupos.current;
    if (!fila) return undefined;
    const medir = () => fila.closest("table")?.style.setProperty("--alto-grupos", `${fila.getBoundingClientRect().height}px`);
    medir();
    if (typeof ResizeObserver !== "function") return undefined;
    const observador = new ResizeObserver(medir);
    observador.observe(fila);
    return () => observador.disconnect();
  });

  // ------------------------------------------------------- Los filtros --
  // Las opciones de cada filtro: las de las filas que entran con lo elegido
  // en los demás filtros (como las segmentaciones del archivo, que esconden
  // lo que no tiene datos). Lo elegido sigue a la vista aunque no tenga.
  const opciones = useMemo(() => {
    const porFiltro = Object.fromEntries(FILTROS_POR_MICROCICLO.map((filtro) => [filtro, new Set(filtros[filtro] || SIN_ELEGIR)]));
    filasGps.forEach((fila) => {
      if (!entraEnElInforme(fila)) return;
      const fallan = FILTROS_POR_MICROCICLO.filter((filtro) => !pasaLosFiltros(fila, { [filtro]: filtros[filtro] }));
      if (fallan.length > 1) return;
      (fallan.length ? fallan : FILTROS_POR_MICROCICLO).forEach((filtro) => porFiltro[filtro].add(valorDeFiltro(fila, filtro)));
    });
    return porFiltro;
  }, [filasGps, filtros]);

  const textoDeOpcion = (filtro, valor) => {
    if (valor === "" || valor === null || valor === undefined) return "";
    if (filtro === "fecha") return fechaCorta(valor);
    if (filtro === "microciclo_jugador") return t(`gps.reportes.microcicloJugador.${valor}`);
    if (filtro === "nombre") {
      const [tipo, ...resto] = String(valor).split(":");
      const quien = resto.join(":");
      if (tipo === "promedio") return nombreDe({ promedio: quien });
      if (tipo === "jugador") return nombreDe({ jugador_id: Number(quien) }) || quien;
      return quien;
    }
    if (filtro === "microciclo") return String(valor);
    return textosDeListas[filtro]?.get(valor) || String(valor);
  };
  // En orden: los números de menor a mayor, las fechas por día, las listas
  // como en Ajustes y los nombres con el promedio del equipo primero.
  const valoresDe = (filtro) => {
    const valores = [...(opciones[filtro] || [])];
    if (filtro === "microciclo") valores.sort((a, b) => Number(a) - Number(b));
    else if (filtro === "fecha") valores.sort((a, b) => String(a).localeCompare(String(b)));
    else if (textosDeListas[filtro]) {
      const orden = [...textosDeListas[filtro].keys()];
      const lugar = (valor) => (orden.includes(valor) ? orden.indexOf(valor) : orden.length);
      valores.sort((a, b) => lugar(a) - lugar(b));
    } else {
      const primero = (valor) => (String(valor).startsWith("promedio:") ? 0 : 1);
      valores.sort((a, b) => primero(a) - primero(b) || textoDeOpcion(filtro, a).localeCompare(textoDeOpcion(filtro, b), idioma, { sensitivity: "base", numeric: true }));
    }
    return valores.map((valor) => ({ clave: valor, texto: textoDeOpcion(filtro, valor) }));
  };

  const tituloDeFiltro = (filtro) => {
    if (filtro === "microciclo_jugador") return t("gps.reportes.filtros.microcicloJugador");
    if (filtro === "nombre") return tituloDe("jugador");
    return tituloDe(filtro);
  };

  const cambiarVr = (indice, cambio) => setVrs((antes) => (antes || []).map((uno, i) => (i === indice ? { ...uno, ...cambio } : uno)));

  // La lista con casillas abierta: la de un filtro o la de los microciclos de
  // un V.R. ({ filtro } o { vr: índice }).
  const abrirFiltro = (filtro) => setHoja({ filtro, titulo: tituloDeFiltro(filtro), valores: valoresDe(filtro), elegidos: [...(filtros[filtro] || SIN_ELEGIR)], busqueda: "" });
  const aplicarHoja = () => {
    if (!hoja) return;
    const marcados = hoja.valores.map((valor) => valor.clave).filter((clave) => hoja.elegidos.includes(clave));
    if (hoja.vr !== undefined) cambiarVr(hoja.vr, { microciclos: marcados });
    // Lo que se ve: lo que quedó sin marcar se oculta.
    else if (hoja.ocultar) setOcultas((antes) => ({ ...antes, [hoja.ocultar]: hoja.valores.map((valor) => valor.clave).filter((clave) => !marcados.includes(clave)) }));
    // En un filtro, todo marcado es lo mismo que nada: todos.
    else setFiltros((antes) => ({ ...antes, [hoja.filtro]: marcados.length === hoja.valores.length ? SIN_ELEGIR : marcados }));
    setHoja(null);
  };

  // Las filas del informe con estos filtros (sin V.R. todavía).
  const grupos = useMemo(() => (modo === "menu" ? [] : filasPorMicrociclo(filasGps, filtros)), [modo, filasGps, filtros]);

  // ----------------------------------------------------------- Los V.R. --
  // El de entrada: el del dispositivo del último microciclo, el elegido en
  // la Base (o el primero de ese dispositivo).
  const vrsAlEntrar = () => {
    const ultimo = [...grupos].sort((a, b) => (microcicloDe(a) ?? -Infinity) - (microcicloDe(b) ?? -Infinity)).pop();
    const dispositivo = ultimo?.dispositivo || referencias[0]?.dispositivo || "";
    const suyas = referencias.filter((referencia) => referencia.dispositivo === dispositivo);
    const referencia = suyas.find((una) => una.id === elegidos?.vr?.[dispositivo]) || suyas[0] || referencias[0];
    return referencia ? [{ id: referencia.id, microciclos: SIN_ELEGIR }] : [];
  };
  const elegidosVr = (vrs || []).filter((uno) => referencias.some((referencia) => referencia.id === uno.id));
  const asignaciones = useMemo(
    () =>
      elegidosVr.map((uno) => ({
        referencia: referencias.find((referencia) => referencia.id === uno.id),
        microciclos: uno.microciclos.length ? uno.microciclos : null,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(elegidosVr), referencias],
  );

  const informe = useMemo(
    () => (modo === "informe" ? informePorMicrociclo(filasGps, { filtros, tipoVariable, visualizacion, categorizacion, asignaciones, nombreDe }) : null),
    [modo, filasGps, filtros, tipoVariable, visualizacion, categorizacion, asignaciones, nombreDe],
  );

  // Al pasar al informe: los V.R. elegidos siguen si alguno vale para lo
  // filtrado (su dispositivo o sus microciclos); si no, los de entrada.
  const irAlInforme = () => {
    const dispositivosFiltrados = new Set(grupos.map((grupo) => grupo.dispositivo));
    const sirve = (uno) => {
      const referencia = referencias.find((una) => una.id === uno.id);
      return Boolean(referencia) && (uno.microciclos.length > 0 || dispositivosFiltrados.has(referencia.dispositivo));
    };
    if (!vrs || !vrs.some(sirve)) setVrs(vrsAlEntrar());
    setVerFranjas(0);
    setModo("informe");
  };

  // ----------------------------------------------------------- Formatos --
  const porciento = (valor) => (esNumero(valor) ? textoDeValor(valor, "0%", idioma) : "");
  const entero = (valor) => (esNumero(valor) ? textoDeValor(valor, "0", idioma) : "");
  const conDos = (valor) => (esNumero(valor) ? textoDeValor(valor, "0.00", idioma) : "");
  const enPorcentaje = visualizacion === "porcentajePromedio" || visualizacion === "porcentajeSuma";
  const textoDeVariable = (clave, valor) => (enPorcentaje ? porciento(valor) : textoDe(clave, valor));

  // ------------------------------------------------------------- Partes --
  const botonVolver = (texto, alTocar) => (
    <div className="reporte-acciones">
      <button type="button" className="boton-secundario reporte-volver" onClick={alTocar}>
        <Icono nombre="flecha" size={14} />
        {texto}
      </button>
    </div>
  );

  // Elegir varios: el desplegable dice cuáles van y abre la lista con
  // casillas (la del filtro de las bases), como en Cargar.
  const desplegableDeVarios = (rotulo, elegidosAhora, textoDe1, alAbrir, vacio) => (
    <button type="button" className="selector-hoja" aria-label={rotulo} onClick={alAbrir}>
      <b>{elegidosAhora.length ? elegidosAhora.map(textoDe1).join(", ") : vacio}</b>
      <Icono nombre="flecha" size={15} />
    </button>
  );

  const hojaDeVarios = (
    <HojaInferior
      abierta={Boolean(hoja)}
      className="tabla-datos-hoja-filtro"
      titulo={hoja ? hoja.titulo : ""}
      onCerrar={() => setHoja(null)}
      acciones={
        <>
          <button type="button" className="boton-cancelar-hoja" onClick={() => setHoja(null)}>
            {t("comun.cancelar")}
          </button>
          <button type="button" className="boton-confirmar-hoja" onClick={aplicarHoja}>
            {t("comun.listo")}
          </button>
        </>
      }
    >
      {hoja && (
        <div className="tabla-datos-filtro-cuerpo">
          <ListaParaMarcar
            valores={hoja.valores}
            elegidos={hoja.elegidos}
            onCambiar={(elegidosNuevos) => setHoja((antes) => ({ ...antes, elegidos: elegidosNuevos }))}
            busqueda={hoja.busqueda}
            onBuscar={(busqueda) => setHoja((antes) => ({ ...antes, busqueda }))}
          />
        </div>
      )}
    </HojaInferior>
  );

  // --------------------------------------------------------------- Menú --
  if (modo === "menu") {
    const opcion = (cual, icono, hecho) => (
      <button type="button" key={cual} className="opcion-ajuste reporte-opcion" onClick={() => hecho && setModo("filtros")} disabled={!hecho}>
        <span className="icono-ajuste">
          <Icono nombre={icono} size={18} />
        </span>
        <span className="texto-ajuste">
          <b>{t(`gps.reportes.${cual}`)}</b>
          <span>{hecho ? t(`gps.reportes.${cual}Texto`) : t("gps.reportes.todaviaNo")}</span>
        </span>
        {hecho && <span className="flecha-ajuste">›</span>}
      </button>
    );
    return (
      <div className="app">
        <div className="contenedor contenedor-base">
          {encabezado(t("gps.reportes.titulo"), t("gps.reportes.texto"))}
          {arriba}
          <section className="tarjeta tarjeta-ficha gps-reportes-menu">
            <div className="cabeza-ficha">
              <b>{t("gps.reportes.ver")}</b>
            </div>
            {opcion("porMicrociclo", "calendario", true)}
            {opcion("porTarea", "registros", false)}
            {opcion("porJugador", "usuario", false)}
          </section>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ Filtros --
  if (modo === "filtros") {
    const hayFiltros = FILTROS_POR_MICROCICLO.some((filtro) => filtros[filtro]?.length);
    return (
      <div className="app">
        <div className="contenedor contenedor-base">
          {botonVolver(t("gps.reportes.titulo"), () => setModo("menu"))}
          {encabezado(t("gps.reportes.porMicrociclo"), t("gps.reportes.filtrosTexto"))}
          {arriba}
          <section className="tarjeta gps-reportes-filtros">
            <div className="gps-reportes-filtros-cabeza">
              <b>{t("gps.reportes.filtrosTitulo")}</b>
              <button type="button" className="boton-secundario" onClick={() => setFiltros({})} disabled={!hayFiltros}>
                {t("gps.reportes.limpiar")}
              </button>
            </div>
            <div className="gps-reportes-grilla">
              {FILTROS_POR_MICROCICLO.map((filtro) => (
                <div className="campo-inicio" key={filtro}>
                  <span className="gps-reportes-rotulo">{tituloDeFiltro(filtro)}</span>
                  {desplegableDeVarios(tituloDeFiltro(filtro), filtros[filtro] || SIN_ELEGIR, (valor) => textoDeOpcion(filtro, valor) || t("tabla.vacias"), () => abrirFiltro(filtro), t("gps.reportes.todos"))}
                </div>
              ))}
            </div>
            <div className="gps-reportes-siguiente">
              <p className="lesiones-ayuda" role="status">
                {cargando && !filasGps.length ? t("gps.estado.cargando") : grupos.length ? plural("gps.reportes.cuantas", grupos.length) : t("gps.reportes.sinFilas")}
              </p>
              <button type="button" className="boton-principal" onClick={irAlInforme} disabled={!grupos.length}>
                {t("gps.reportes.siguiente")}
              </button>
            </div>
          </section>
        </div>
        {hojaDeVarios}
      </div>
    );
  }

  // ------------------------------------------------------------ Informe --
  const { filas, ua, tablas } = informe;
  const actual = tablas.length ? Math.min(verFranjas, tablas.length - 1) : -1;
  const tabla = actual >= 0 ? tablas[actual] : null;
  const variables = TIPOS_DE_VARIABLE[tipoVariable];
  const unirTramo = (desde, hasta) => t("gps.reportes.tramo", { desde, hasta });
  const nombreDeVr = (referencia) => (referencia ? `${nombreDelDispositivo(referencia.dispositivo)} · ${nombreDeReferencia(referencia)}` : "");

  // Lo elegido en los filtros, en una línea.
  const resumenDeFiltros = FILTROS_POR_MICROCICLO.filter((filtro) => filtros[filtro]?.length)
    .map((filtro) => {
      const elegidosAhora = filtros[filtro];
      const texto = filtro === "microciclo" ? tramos(elegidosAhora, unirTramo) : elegidosAhora.map((valor) => textoDeOpcion(filtro, valor) || t("tabla.vacias")).join(", ");
      return `${tituloDeFiltro(filtro)}: ${texto}`;
    })
    .join(" · ");

  // Los microciclos del informe (para el «+ Otro V.R.») y los que quedaron
  // sin V.R.
  const microciclosDelInforme = [...new Set(filas.flatMap((fila) => (fila.promedio ? [fila.microciclo] : fila.microciclos)).filter((m) => m !== null && m !== undefined))].sort((a, b) => a - b);
  const sinVr = filas.filter((fila) => !fila.vr).flatMap((fila) => (fila.promedio ? [fila.microciclo] : fila.microciclos));

  const quitarVr = (indice) => {
    setVrs((antes) => (antes || []).filter((_, i) => i !== indice));
    setVerFranjas(0);
  };
  const sumarVr = () => {
    // De entrada, uno del dispositivo de lo que quedó sin V.R. (o el primero que no se usa).
    const sinVrDispositivo = filas.find((fila) => !fila.vr && fila.dispositivo)?.dispositivo;
    const libre =
      referencias.find((referencia) => referencia.dispositivo === sinVrDispositivo && !elegidosVr.some((uno) => uno.id === referencia.id)) ||
      referencias.find((referencia) => !elegidosVr.some((uno) => uno.id === referencia.id)) ||
      referencias[0];
    if (libre) setVrs((antes) => [...(antes || []), { id: libre.id, microciclos: SIN_ELEGIR }]);
  };
  // Con V.R. de más de un dispositivo, cada uno dice de cuál es (también con
  // la lista cerrada).
  const dispositivos = [...new Set(referencias.map((referencia) => referencia.dispositivo))];
  const textoDeVr = (referencia) => (dispositivos.length > 1 ? nombreDeVr(referencia) : nombreDeReferencia(referencia));
  const selectorDeVr = (uno, indice) => (
    <select value={uno.id} onChange={(evento) => cambiarVr(indice, { id: evento.target.value })} aria-label={indice ? t("gps.reportes.otroVr") : t("gps.reportes.vr")}>
      {dispositivos.map((dispositivo) => (
        <optgroup key={dispositivo} label={nombreDelDispositivo(dispositivo)}>
          {referencias
            .filter((referencia) => referencia.dispositivo === dispositivo)
            .map((referencia) => (
              <option key={referencia.id} value={referencia.id}>
                {textoDeVr(referencia)}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
  // «+ Otro V.R.»: al lado del primer V.R. (o solo, si no hay ninguno elegido).
  const botonSumarVr =
    referencias.length > 0 ? (
      <button type="button" className="boton-secundario gps-reportes-sumar" onClick={sumarVr}>
        {t("gps.reportes.sumarVr")}
      </button>
    ) : null;

  // Las columnas de la tabla, con su grupo (y su tono, como en la base). La
  // U.A. y la carga crónica se pintan como el archivo; los índices y las
  // variables, con la regla que el archivo usa para esas columnas en «Por
  // jugador» (en «Por microciclo» no las pinta).
  const tablaDe = (fila) => tablas.find((una) => una.asignacion === fila.asignacion) || null;
  const COLUMNAS = [
    { clave: "sesiones", titulo: t("gps.reportes.columnas.sesiones"), valor: (fila) => fila.sesiones, texto: entero },
    { clave: "descansos", titulo: t("gps.reportes.columnas.descansos"), valor: (fila) => fila.descansos, texto: entero },
    { clave: "uaSuma", grupo: "ua", titulo: t("gps.reportes.columnas.suma"), valor: (fila) => fila.sumas.ua, texto: entero, franjas: ua?.suma, color: colorDeUa },
    { clave: "uaPromedio", grupo: "ua", titulo: t("gps.reportes.columnas.promedio"), valor: (fila) => fila.promedios.ua, texto: entero, franjas: ua?.promedio, color: colorDeUa },
    { clave: "ccSuma", grupo: "cronica", titulo: t("gps.reportes.columnas.suma"), valor: (fila) => fila.cargaCronica.suma, texto: conDos, franjas: ua?.cronicaSuma, color: colorDeCargaCronica },
    { clave: "ccPromedio", grupo: "cronica", titulo: t("gps.reportes.columnas.promedio"), valor: (fila) => fila.cargaCronica.promedio, texto: conDos, franjas: ua?.cronicaPromedio, color: colorDeCargaCronica },
    ...[
      ["volumen", "indices", t("gps.reportes.columnas.volumen")],
      ["relativo", "indices", t("gps.reportes.columnas.relativo")],
      ["total", "total", tituloDe("d")],
      ["totalRel", "total", tituloDe("d_min")],
      ["alta", "alta", t("gps.reportes.columnas.abs")],
      ["altaRel", "alta", t("gps.reportes.columnas.rel")],
      ["maxima", "maxima", t("gps.reportes.columnas.abs")],
      ["maximaRel", "maxima", t("gps.reportes.columnas.rel")],
    ].map(([clave, grupo, titulo]) => ({ clave, grupo, titulo, valor: (fila) => fila.indices[clave], texto: porciento, franjas: tabla?.indices?.[clave], franjasDeFila: (fila) => tablaDe(fila)?.indices?.[clave], color: colorDeMayorMejor })),
    ...variables.map((clave) => ({
      clave: `variable:${clave}`,
      grupo: "variables",
      titulo: tituloDe(clave),
      valor: (fila) => fila.variables[clave],
      texto: (valor) => textoDeVariable(clave, valor),
      franjas: tabla?.variables?.[clave],
      franjasDeFila: (fila) => tablaDe(fila)?.variables?.[clave],
      color: colorDeVariable,
      vr: (referencia) => textoDe(clave, referencia?.promedio?.[clave]),
    })),
    { clave: "vsRival", titulo: t("gps.reportes.columnas.vsRival"), valor: (fila) => fila.vsRival, texto: (valor) => valor || "", rival: true },
  ];
  const TITULOS_DE_GRUPOS = {
    ua: t("gps.reportes.columnas.ua"),
    cronica: t("gps.reportes.columnas.cronica"),
    indices: t("gps.reportes.columnas.indices"),
    total: t("gps.reportes.columnas.total"),
    alta: t("gps.reportes.columnas.alta"),
    maxima: t("gps.reportes.columnas.maxima"),
    variables: t(`gps.reportes.tipos.${tipoVariable}`),
  };
  const tonos = Object.fromEntries(Object.keys(TITULOS_DE_GRUPOS).map((clave, i) => [clave, i]));
  const tituloCompleto = (columna) => (columna.grupo ? `${TITULOS_DE_GRUPOS[columna.grupo]} · ${columna.titulo}` : columna.titulo);

  // Lo que se ve: sin lo ocultado a mano.
  const columnas = COLUMNAS.filter((columna) => !ocultas.columnas.includes(columna.clave));
  const gruposDeColumnas = [];
  columnas.forEach((columna) => {
    const ultimo = gruposDeColumnas[gruposDeColumnas.length - 1];
    if (columna.grupo && ultimo?.clave === columna.grupo) ultimo.cantidad += 1;
    else gruposDeColumnas.push({ clave: columna.grupo || null, columna, cantidad: 1 });
  });

  // La primera columna dice qué es cada fila: solo microciclos del equipo,
  // solo jugadores o las dos cosas.
  const soloEquipo = filas.every((fila) => fila.promedio);
  const soloJugadores = filas.every((fila) => !fila.promedio);
  const tituloDeLaPrimera = soloEquipo ? t("gps.reportes.columnas.microciclo") : soloJugadores ? t("gps.reportes.columnas.jugador") : t("gps.reportes.columnas.nombre");
  const textoDeFila = (fila) => (fila.promedio ? (soloEquipo ? t("gps.reportes.microcicloN", { n: fila.microciclo ?? "" }) : `${nombreDe(fila)} ${fila.microciclo ?? ""}`) : nombreDe(fila));
  const nombreDeFila = (fila) =>
    fila.promedio ? (
      <span className="gps-informe-nombre">
        {!soloEquipo && <span>{nombreDe(fila)}</span>}
        <b>{fila.microciclo}</b>
      </span>
    ) : (
      <span className="gps-informe-nombre">
        <b>{nombreDe(fila)}</b>
        {fila.microciclos.length > 0 && <span>{tramos(fila.microciclos, unirTramo)}</span>}
      </span>
    );

  // Las filas de arriba: el V.R. y las franjas (cada una se puede ocultar).
  const FILAS_DE_FRANJAS = [...(tabla?.vr ? ["vr"] : []), ...FRANJAS].map((franja) => ({ clave: `franja:${franja}`, franja, texto: t(`gps.reportes.franjas.${franja}`) }));
  const franjasAVista = FILAS_DE_FRANJAS.filter((una) => !ocultas.filas.includes(una.clave));
  const filasAVista = filas.filter((fila) => !ocultas.filas.includes(fila.clave));
  const cuantasOcultas = (cual) => ocultas[cual].filter((clave) => (cual === "columnas" ? COLUMNAS.some((columna) => columna.clave === clave) : [...FILAS_DE_FRANJAS, ...filas].some((una) => una.clave === clave))).length;

  const abrirLoQueSeVe = (cual) => {
    const valores =
      cual === "columnas"
        ? COLUMNAS.map((columna) => ({ clave: columna.clave, texto: tituloCompleto(columna) }))
        : [...FILAS_DE_FRANJAS.map((una) => ({ clave: una.clave, texto: una.texto })), ...filas.map((fila) => ({ clave: fila.clave, texto: textoDeFila(fila) }))];
    setHoja({ ocultar: cual, titulo: t(`gps.reportes.aLaVista.${cual}`), valores, elegidos: valores.map((valor) => valor.clave).filter((clave) => !ocultas[cual].includes(clave)), busqueda: "" });
  };
  const ocultar = ({ tipo, clave }) => setOcultas((antes) => ({ ...antes, [tipo]: [...antes[tipo].filter((una) => una !== clave), clave] }));

  const vacio = <span className="gps-informe-vacio">–</span>;
  const celda = (columna, fila) => {
    const valor = columna.valor(fila);
    const texto = columna.texto(valor);
    const color = columna.color ? columna.color(valor, columna.franjasDeFila ? columna.franjasDeFila(fila) : columna.franjas) : null;
    return (
      <td key={columna.clave} className={`${columna.rival ? "gps-informe-rival" : ""} ${color ? "pintada" : ""}`} style={color ? { background: color } : undefined} title={columna.rival && texto ? texto : undefined}>
        {texto === "" ? vacio : texto}
      </td>
    );
  };
  // En las franjas, cada número pintado con el color que toma lo que cae ahí
  // (Santiago, 15/10, con una imagen: la celda entera, no un punto al lado).
  const celdaDeFranja = (columna, franja) => {
    if (franja === "vr") return <td key={columna.clave}>{columna.vr ? columna.vr(tabla.vr) || vacio : ""}</td>;
    const valor = columna.franjas ? columna.franjas[franja] : null;
    if (!columna.franjas) return <td key={columna.clave} />;
    const color = franja !== "desvio" && columna.color ? columna.color(valor, columna.franjas) : null;
    const texto = columna.texto(valor);
    return (
      <td key={columna.clave} className={color ? "pintada" : undefined} style={color ? { background: color } : undefined}>
        {texto === "" ? vacio : texto}
      </td>
    );
  };

  return (
    <div className="app">
      <div className="contenedor contenedor-base">
        {botonVolver(t("gps.reportes.volverAFiltros"), () => setModo("filtros"))}
        {encabezado(t("gps.reportes.porMicrociclo"), t("gps.reportes.informeTexto"))}
        {arriba}
        <p className="pantalla-donde gps-reportes-resumen">{resumenDeFiltros ? t("gps.reportes.filtrosElegidos", { filtros: resumenDeFiltros }) : t("gps.reportes.sinFiltros")}</p>

        <section className="tarjeta gps-reportes-controles">
          <div className="gps-reportes-grilla">
            <label className="campo-inicio">
              <span className="gps-reportes-rotulo">{t("gps.reportes.tipoVariable")}</span>
              <span className="gps-reportes-campo">
                <Icono nombre="grafico" size={18} />
                <select value={tipoVariable} onChange={(evento) => setTipoVariable(evento.target.value)}>
                  {Object.keys(TIPOS_DE_VARIABLE).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {t(`gps.reportes.tipos.${tipo}`)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="campo-inicio">
              <span className="gps-reportes-rotulo">{t("gps.reportes.visualizacion")}</span>
              <span className="gps-reportes-campo">
                <Icono nombre="tendencia" size={18} />
                <select value={visualizacion} onChange={(evento) => setVisualizacion(evento.target.value)}>
                  {VISUALIZACIONES.map((una) => (
                    <option key={una} value={una}>
                      {t(`gps.reportes.visualizaciones.${una}`)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="campo-inicio">
              <span className="gps-reportes-rotulo">
                {t("gps.reportes.categorizacion")}
                <TerminoDe clave="gps.terminos.categorizacion" />
              </span>
              <span className="gps-reportes-campo">
                <Icono nombre="cuadros" size={18} />
                <select value={categorizacion} onChange={(evento) => setCategorizacion(evento.target.value)}>
                  {CATEGORIZACIONES_DEL_INFORME.map((una) => (
                    <option key={una} value={una}>
                      {t(`gps.reportes.categorizaciones.${una}`)}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </div>
          {categorizacion === "objetivo" && !(filtros.microciclo_jugador?.length === 1 && filtros.microciclo_jugador[0] === "jugador") && (
            <p className="lesiones-ayuda gps-reportes-objetivo">{t("gps.reportes.objetivoSinJugador")}</p>
          )}

          <div className="gps-reportes-vrs">
            <span className="gps-reportes-rotulo">
              {t("gps.reportes.vr")}
              <TerminoDe clave="gps.terminos.vrInforme" />
            </span>
            {elegidosVr.length === 0 && <p className="lesiones-ayuda">{t(referencias.length ? "gps.reportes.sinVrElegido" : "gps.reportes.sinVrs")}</p>}
            {elegidosVr.map((uno, indice) => (
              <div className={`gps-reportes-vr ${indice ? "otro" : ""}`} key={`${indice}:${uno.id}`}>
                <span className="gps-reportes-campo">
                  <Icono nombre="objetivo" size={18} />
                  {selectorDeVr(uno, indice)}
                </span>
                {indice > 0 &&
                  desplegableDeVarios(
                    t("gps.reportes.microciclosDelVr"),
                    uno.microciclos,
                    (valor) => String(valor),
                    () =>
                      setHoja({
                        vr: indice,
                        titulo: t("gps.reportes.microciclosDelVr"),
                        valores: microciclosDelInforme.map((m) => ({ clave: m, texto: String(m) })),
                        elegidos: [...uno.microciclos],
                        busqueda: "",
                      }),
                    t("gps.reportes.todosLosDe", { dispositivo: nombreDelDispositivo(referencias.find((referencia) => referencia.id === uno.id)?.dispositivo) }),
                  )}
                {indice > 0 && (
                  <button type="button" className="boton-secundario gps-reportes-quitar" onClick={() => quitarVr(indice)} aria-label={t("gps.reportes.quitarVr")}>
                    <Icono nombre="borrar" size={15} />
                  </button>
                )}
                {indice === 0 && botonSumarVr}
              </div>
            ))}
            {sinVr.length > 0 && elegidosVr.length > 0 && <p className="lesiones-ayuda gps-reportes-sin-vr">{t("gps.reportes.sinVrFilas", { microciclos: tramos(sinVr, unirTramo) })}</p>}
            {elegidosVr.length === 0 && botonSumarVr}
          </div>
        </section>

        {filas.length === 0 ? (
          <p className="lesiones-estado">{t("gps.reportes.sinFilas")}</p>
        ) : (
          <section className="tarjeta gps-reportes-tabla">
            <div className="gps-informe-barra">
              <div className="gps-informe-titulo">
                <Icono nombre="grafico" size={20} />
                <span className="gps-informe-titulo-texto">
                  <b>{tabla?.vr ? t("gps.reportes.franjasDe", { vr: nombreDeVr(tabla.vr) }) : t("gps.reportes.franjasSinVr")}</b>
                  <span>{plural(soloEquipo ? "gps.reportes.cuantosMicrociclos" : soloJugadores ? "gps.reportes.cuantosJugadores" : "gps.reportes.cuantasFilas", filas.length)}</span>
                </span>
              </div>
              <div className="gps-informe-acciones">
                {tablas.length > 1 && (
                  <button type="button" className="boton-secundario gps-informe-otras" onClick={() => setVerFranjas((actual + 1) % tablas.length)}>
                    <Icono nombre="cambio" size={15} />
                    {t("gps.reportes.verFranjasDe", { vr: nombreDeVr(tablas[(actual + 1) % tablas.length].vr) })}
                  </button>
                )}
                {["columnas", "filas"].map((cual) => {
                  const cuantas = cuantasOcultas(cual);
                  return (
                    <button key={cual} type="button" className={`selector-hoja gps-informe-ver ${cuantas ? "con-ocultas" : ""}`} onClick={() => abrirLoQueSeVe(cual)}>
                      <span>{t(`gps.reportes.ocultas.${cual}`)}</span>
                      <b>{cuantas ? plural("gps.reportes.ocultas.cuantas", cuantas) : t("gps.reportes.ocultas.todas")}</b>
                      <Icono nombre="flecha" size={15} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="gps-informe-marco" tabIndex={0} role="region" aria-label={t("gps.reportes.porMicrociclo")}>
              <table className={`gps-informe-tabla ${soloEquipo ? "solo-equipo" : ""}`}>
                <thead>
                  <tr className="gps-informe-grupos" ref={filaDeGrupos}>
                    <th scope="col" rowSpan={2} className="gps-informe-id">
                      {tituloDeLaPrimera}
                    </th>
                    {gruposDeColumnas.map((grupo) =>
                      grupo.clave ? (
                        <th key={grupo.clave} scope="colgroup" colSpan={grupo.cantidad} className={`tono-${tonos[grupo.clave]}`}>
                          <span className="gps-informe-grupo">
                            {TITULOS_DE_GRUPOS[grupo.clave]}
                            {TERMINOS_DE_GRUPOS[grupo.clave] && <TerminoDe clave={TERMINOS_DE_GRUPOS[grupo.clave]} />}
                          </span>
                        </th>
                      ) : (
                        <th key={grupo.columna.clave} scope="col" rowSpan={2} className={`gps-informe-suelta ${grupo.columna.rival ? "gps-informe-rival" : ""}`}>
                          <button type="button" className="gps-informe-cabecera" onClick={() => setAOcultar({ tipo: "columnas", clave: grupo.columna.clave, titulo: tituloCompleto(grupo.columna) })} title={t("gps.reportes.tocarParaOcultar")} aria-haspopup="dialog">
                            {grupo.columna.titulo}
                          </button>
                        </th>
                      ),
                    )}
                  </tr>
                  <tr className="gps-informe-cabeceras">
                    {columnas
                      .filter((columna) => columna.grupo)
                      .map((columna) => (
                        <th key={columna.clave} scope="col" className={`tono-${tonos[columna.grupo]}`}>
                          <button type="button" className="gps-informe-cabecera" onClick={() => setAOcultar({ tipo: "columnas", clave: columna.clave, titulo: tituloCompleto(columna) })} title={t("gps.reportes.tocarParaOcultar")} aria-haspopup="dialog">
                            {columna.titulo}
                          </button>
                        </th>
                      ))}
                  </tr>
                </thead>
                {franjasAVista.length > 0 && (
                  <tbody className="gps-informe-franjas">
                    {franjasAVista.map((una) => (
                      <tr key={una.clave} className={`franja-${una.franja}`}>
                        <th scope="row" className="gps-informe-id">
                          <button type="button" className="gps-informe-fila" onClick={() => setAOcultar({ tipo: "filas", clave: una.clave, titulo: una.texto })} title={t("gps.reportes.tocarParaOcultarFila")} aria-haspopup="dialog">
                            {una.texto}
                          </button>
                        </th>
                        {columnas.map((columna) => celdaDeFranja(columna, una.franja))}
                      </tr>
                    ))}
                  </tbody>
                )}
                <tbody className="gps-informe-filas">
                  {filasAVista.map((fila) => (
                    <tr key={fila.clave}>
                      <th scope="row" className="gps-informe-id">
                        <button type="button" className="gps-informe-fila" onClick={() => setAOcultar({ tipo: "filas", clave: fila.clave, titulo: textoDeFila(fila) })} title={`${textoDeFila(fila)}\n${t("gps.reportes.tocarParaOcultarFila")}`} aria-haspopup="dialog">
                          {nombreDeFila(fila)}
                        </button>
                      </th>
                      {columnas.map((columna) => celda(columna, fila))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      {hojaDeVarios}
      <HojaConfirmar
        abierta={Boolean(aOcultar)}
        icono="ocultar"
        titulo={aOcultar ? t("gps.reportes.ocultarTitulo", { nombre: aOcultar.titulo }) : ""}
        descripcion={aOcultar ? t(aOcultar.tipo === "filas" ? "gps.reportes.ocultarFilaTexto" : "gps.reportes.ocultarColumnaTexto") : ""}
        etiquetaConfirmar={t("gps.reportes.ocultar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={() => {
          ocultar(aOcultar);
          setAOcultar(null);
        }}
        onCancelar={() => setAOcultar(null)}
      />
    </div>
  );
}
