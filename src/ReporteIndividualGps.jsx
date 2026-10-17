import React, { useEffect, useMemo, useState } from "react";
import { Icono } from "./components/AppChrome";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { ListaParaMarcar } from "./components/ListaParaMarcar.jsx";
import { COLORES_INFORME, claveDeNombre, valorDeFiltro } from "./domain/gps/porMicrociclo.js";
import { fuerte, rellenoDe } from "./domain/colores.js";
import { COLUMNAS_POR_MINUTO, COLUMNAS_TOTALES, CUANTAS, FILTROS_DEL_REPORTE, entraEnElReporte, esDelEquipo, jugadoresDelReporte, pasaLosFiltrosDelReporte, reporteIndividual } from "./domain/gps/reporteIndividual.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// GPS › Informe › Reporte individual (la hoja «Reporte Individual» del
// Excel; el cálculo, en domain/gps/reporteIndividual.js). Va en «Ver
// informes», en dos pasos como los demás (Santiago, 16/10: «Dentro de
// Informe»): el jugador y los filtros, y el reporte, con «Filtros» adentro.
// Cuatro tablas (Por jugador y Por equipo, en Totales y Por minuto) y, abajo,
// qué es cada variable. Las columnas se ocultan tocando su nombre (en las
// cuatro a la vez), como en el Informe; las filas, no.

const SIN_ELEGIR = [];
const SIN_FILTROS = Object.freeze({});
// Las columnas ocultas, mientras se está en el reporte: al salir vuelven a
// verse (Santiago, 17/10: «Hasta salir de esa base», «Bases e informes»).
// Hasta el 17/10 quedaban guardadas en el aparato: lo guardado se borra.
const olvidarLasGuardadas = () => {
  try {
    localStorage.removeItem("gps_reporte_individual_columnas_ocultas");
  } catch {
    // Sin localStorage no había nada guardado.
  }
};
// Las medidas de la explicación de abajo (sin rangos: el rango está en el
// nombre de cada columna; Santiago, 16/10, «Explicación de variables»).
const MEDIDAS = COLUMNAS_TOTALES.filter((clave) => clave !== "tiempo");
const FRANJAS = ["excelente", "muyBueno", "bueno", "regular", "malo"];
const COLOR_DE_FRANJA = { excelente: COLORES_INFORME.excelente, muyBueno: COLORES_INFORME.muyBueno, bueno: COLORES_INFORME.bueno, regular: COLORES_INFORME.naranja, malo: COLORES_INFORME.malo };

// volver(siguiente): la barra de arriba, con el botón para volver a «Ver
// informes» y, si se le pasa, «Siguiente» (fija al bajar); encabezado y
// arriba: los de las demás pantallas; lo demás, como ReportesGps.
export default function ReporteIndividualGps({ filasGps, nombreDe, tituloDe, textoDe, textosDeListas, encabezado, arriba = null, volver, cargando = false }) {
  const { idioma, plural } = useIdioma();
  const [paso, setPaso] = useState("filtros");
  const [jugador, setJugador] = useState("");
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [hoja, setHoja] = useState(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [ocultas, setOcultas] = useState(SIN_ELEGIR);
  const [aOcultar, setAOcultar] = useState(null);
  useEffect(olvidarLasGuardadas, []);

  // ------------------------------------------------------- Los filtros --
  const nombreDeClave = (clave) => {
    const [tipo, ...resto] = String(clave).split(":");
    const quien = resto.join(":");
    if (tipo === "jugador") return nombreDe({ jugador_id: Number(quien) }) || quien;
    return quien;
  };
  const jugadores = useMemo(
    () => jugadoresDelReporte(filasGps).sort((a, b) => nombreDeClave(a).localeCompare(nombreDeClave(b), idioma, { sensitivity: "base", numeric: true })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filasGps, idioma],
  );
  // Las opciones de cada filtro: las de las filas del jugador y del equipo
  // que entran con lo elegido en los otros dos (como las segmentaciones).
  const opciones = useMemo(() => {
    const porFiltro = Object.fromEntries(FILTROS_DEL_REPORTE.map((filtro) => [filtro, new Set(filtros[filtro] || SIN_ELEGIR)]));
    filasGps.forEach((fila) => {
      if (!entraEnElReporte(fila) || !(esDelEquipo(fila) || (jugador && !fila.promedio && claveDeNombre(fila) === jugador))) return;
      FILTROS_DEL_REPORTE.forEach((filtro) => {
        if (pasaLosFiltrosDelReporte(fila, { ...filtros, [filtro]: SIN_ELEGIR })) porFiltro[filtro].add(valorDeFiltro(fila, filtro));
      });
    });
    return porFiltro;
  }, [filasGps, filtros, jugador]);
  const textoDeOpcion = (filtro, valor) => {
    if (valor === "" || valor === null || valor === undefined) return t("tabla.vacias");
    if (filtro === "fecha") return fechaCorta(valor);
    if (filtro === "microciclo") return String(valor);
    return textosDeListas[filtro]?.get(valor) || String(valor);
  };
  const valoresDe = (filtro) => {
    const valores = [...(opciones[filtro] || [])];
    if (filtro === "microciclo") valores.sort((a, b) => Number(a) - Number(b));
    else if (filtro === "fecha") valores.sort((a, b) => String(a).localeCompare(String(b)));
    else {
      const orden = [...(textosDeListas[filtro]?.keys() || [])];
      const lugar = (valor) => (orden.includes(valor) ? orden.indexOf(valor) : orden.length);
      valores.sort((a, b) => lugar(a) - lugar(b));
    }
    return valores.map((valor) => ({ clave: valor, texto: textoDeOpcion(filtro, valor) }));
  };
  const abrirFiltro = (filtro) => setHoja({ filtro, titulo: tituloDe(filtro), valores: valoresDe(filtro), elegidos: [...(filtros[filtro] || SIN_ELEGIR)], busqueda: "" });
  const aplicarHoja = () => {
    if (!hoja) return;
    const marcados = hoja.valores.map((valor) => valor.clave).filter((clave) => hoja.elegidos.includes(clave));
    if (hoja.ocultar) {
      const enLaLista = hoja.valores.map((valor) => valor.clave);
      setOcultas((antes) => [...antes.filter((clave) => !enLaLista.includes(clave)), ...enLaLista.filter((clave) => !marcados.includes(clave))]);
    } else setFiltros((antes) => ({ ...antes, [hoja.filtro]: marcados.length === hoja.valores.length ? SIN_ELEGIR : marcados }));
    setHoja(null);
  };
  const hayFiltros = FILTROS_DEL_REPORTE.some((filtro) => filtros[filtro]?.length);
  const limpiarFiltros = () => setFiltros(SIN_FILTROS);
  const resumenDeFiltros = FILTROS_DEL_REPORTE.filter((filtro) => filtros[filtro]?.length)
    .map((filtro) => `${tituloDe(filtro)}: ${filtros[filtro].map((valor) => textoDeOpcion(filtro, valor)).join(", ")}`)
    .join(" · ");

  const reporte = useMemo(() => reporteIndividual(filasGps, { jugador, filtros }), [filasGps, jugador, filtros]);

  // ------------------------------------------------------------- Partes --
  const desplegable = (filtro) => {
    const elegidosAhora = filtros[filtro] || SIN_ELEGIR;
    return (
      <div className="campo-inicio" key={filtro}>
        <span className="gps-reportes-rotulo">{tituloDe(filtro)}</span>
        <button type="button" className="selector-hoja" aria-label={tituloDe(filtro)} onClick={() => abrirFiltro(filtro)}>
          <b>{elegidosAhora.length ? elegidosAhora.map((valor) => textoDeOpcion(filtro, valor)).join(", ") : t("gps.reportes.todos")}</b>
          <Icono nombre="flecha" size={15} />
        </button>
      </div>
    );
  };
  const grillaDeFiltros = () => (
    <div className="gps-reportes-grilla">
      <label className="campo-inicio">
        <span className="gps-reportes-rotulo">{t("gps.reportes.individual.jugador")}</span>
        <span className="gps-reportes-campo">
          <Icono nombre="usuario" size={18} />
          <select value={jugador} onChange={(evento) => setJugador(evento.target.value)}>
            <option value="">{t("gps.reportes.individual.elegirJugador")}</option>
            {jugadores.map((clave) => (
              <option key={clave} value={clave}>
                {nombreDeClave(clave)}
              </option>
            ))}
          </select>
        </span>
      </label>
      {FILTROS_DEL_REPORTE.map(desplegable)}
    </div>
  );
  const cuantasVan = () =>
    !jugador ? t("gps.reportes.individual.sinJugador") : reporte.jugador.cuantas ? plural("gps.reportes.individual.cuantas", reporte.jugador.cuantas, { cuantas: CUANTAS }) : t("gps.reportes.individual.sinFilas");

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

  // ------------------------------------------------------------- Paso 1 --
  if (paso === "filtros") {
    return (
      <div className="app">
        <div className="contenedor contenedor-base">
          {volver(
            <button
              type="button"
              className="boton-principal"
              onClick={() => {
                setFiltrosAbiertos(false);
                setPaso("reporte");
              }}
              disabled={!jugador || !reporte.jugador.cuantas}
            >
              {t("gps.reportes.individual.siguiente")}
            </button>,
          )}
          {encabezado(t("gps.reportes.reporteIndividual"), t("gps.reportes.individual.filtrosTexto", { cuantas: CUANTAS }))}
          {arriba}
          <section className="tarjeta gps-reportes-filtros">
            <div className="gps-reportes-filtros-cabeza">
              <b>{t("gps.reportes.filtrosTitulo")}</b>
              <button type="button" className="boton-secundario" onClick={limpiarFiltros} disabled={!hayFiltros}>
                {t("gps.reportes.limpiar")}
              </button>
            </div>
            {grillaDeFiltros()}
            <div className="gps-reportes-siguiente">
              <p className="lesiones-ayuda" role="status">
                {cargando && !filasGps.length ? t("gps.estado.cargando") : cuantasVan()}
              </p>
            </div>
          </section>
        </div>
        {hojaDeVarios}
      </div>
    );
  }

  // ------------------------------------------------------------ Reporte --
  const columnasDe = (claves) => claves.filter((clave) => !ocultas.includes(clave));
  const todasLasColumnas = [...COLUMNAS_TOTALES, ...COLUMNAS_POR_MINUTO.filter((clave) => clave !== "tiempo"), "pse", "ua", "descripcion"];
  const tituloDeColumna = (clave) => tituloDe(clave);
  const cuantasOcultas = ocultas.filter((clave) => todasLasColumnas.includes(clave)).length;
  const abrirColumnas = () => {
    const valores = todasLasColumnas.map((clave) => ({ clave, texto: tituloDeColumna(clave) }));
    setHoja({ ocultar: true, titulo: t("gps.reportes.aLaVista.columnas"), valores, elegidos: todasLasColumnas.filter((clave) => !ocultas.includes(clave)), busqueda: "" });
  };
  const vacio = <span className="gps-informe-vacio">–</span>;
  const cabecera = (clave) => (
    <th key={clave} scope="col" className={clave === "descripcion" ? "gps-reporte-descripcion" : undefined}>
      <button type="button" className="gps-informe-cabecera" onClick={() => setAOcultar({ clave, titulo: tituloDeColumna(clave) })} title={t("gps.reportes.tocarParaOcultar")} aria-haspopup="dialog">
        {tituloDeColumna(clave)}
      </button>
    </th>
  );
  // Una tabla: tipo «totales» o «porMinuto»; pie: las filas de abajo
  // ([{ clave, texto, valores }]).
  const tabla = (bloque, tipo, pie) => {
    const medidas = columnasDe(tipo === "totales" ? COLUMNAS_TOTALES : COLUMNAS_POR_MINUTO);
    const deLaCarga = columnasDe(["pse", "ua"]);
    const conDescripcion = !ocultas.includes("descripcion");
    const cuantasColumnas = 1 + medidas.length + deLaCarga.length + (conDescripcion ? 1 : 0);
    const textoDeCelda = (clave, valor) => {
      const texto = textoDe(clave, valor);
      return texto === "" || texto === null || texto === undefined ? vacio : texto;
    };
    return (
      <div className="gps-informe-marco gps-reporte-marco" tabIndex={0} role="region" aria-label={`${t(`gps.reportes.individual.${bloque === reporte.jugador ? "porJugador" : "porEquipo"}`)} · ${t(`gps.reportes.individual.${tipo}`)}`}>
        <table className="gps-informe-tabla gps-reporte-tabla">
          <thead>
            <tr>
              <th scope="col" className="gps-informe-id">
                {t("gps.reportes.individual.fecha")}
              </th>
              {medidas.map(cabecera)}
              {deLaCarga.map(cabecera)}
              {conDescripcion && cabecera("descripcion")}
            </tr>
          </thead>
          <tbody className="gps-informe-filas">
            {bloque.filas.length === 0 && (
              <tr>
                <td colSpan={cuantasColumnas} className="gps-tarea-sin-filas">
                  {t("gps.reportes.individual.sinFilasTabla")}
                </td>
              </tr>
            )}
            {bloque.filas.map((fila) => (
              <tr key={fila.clave}>
                <th scope="row" className="gps-informe-id" title={fila.descripcion || undefined}>
                  {fechaCorta(fila.fecha)}
                </th>
                {medidas.map((clave) => {
                  const color = fila.colores?.[tipo]?.[clave] || null;
                  return (
                    <td key={clave} className={color ? "pintada" : undefined} style={color ? { background: rellenoDe(color) } : undefined}>
                      {textoDeCelda(clave, fila.valores[clave])}
                    </td>
                  );
                })}
                {deLaCarga.map((clave) => (
                  <td key={clave}>{textoDeCelda(clave, fila.valores[clave])}</td>
                ))}
                {conDescripcion && (
                  <td className="gps-reporte-descripcion" title={fila.descripcion || undefined}>
                    {fila.descripcion || vacio}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {bloque.filas.length > 0 && (
            <tbody className="gps-informe-filas gps-reporte-pie">
              {pie.map((una) => (
                <tr key={una.clave}>
                  <th scope="row" className="gps-informe-id">
                    {una.texto}
                  </th>
                  {medidas.map((clave) => (
                    <td key={clave}>{una.valores && clave in una.valores ? textoDeCelda(clave, una.valores[clave]) : ""}</td>
                  ))}
                  {deLaCarga.map((clave) => (
                    <td key={clave}>{una.valores && clave in una.valores ? textoDeCelda(clave, una.valores[clave]) : ""}</td>
                  ))}
                  {conDescripcion && <td />}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
    );
  };
  const seccion = (cual, bloque, conDesvio) => (
    <section className="tarjeta gps-reportes-tabla gps-reporte-seccion" key={cual}>
      <div className="gps-informe-barra">
        <div className="gps-informe-titulo">
          <Icono nombre={cual === "porJugador" ? "usuario" : "registros"} size={20} />
          <span className="gps-informe-titulo-texto">
            <b>{t(`gps.reportes.individual.${cual}`)}</b>
            <span>{t(`gps.reportes.individual.${cual}Pintado`)}</span>
          </span>
        </div>
        {cual === "porJugador" && (
          <div className="gps-informe-acciones">
            <button type="button" className={`selector-hoja gps-informe-ver ${cuantasOcultas ? "con-ocultas" : ""}`} onClick={abrirColumnas}>
              <span>{t("gps.reportes.ocultas.columnas")}</span>
              <b>{cuantasOcultas ? plural("gps.reportes.ocultas.cuantas", cuantasOcultas) : t("gps.reportes.ocultas.todas")}</b>
              <Icono nombre="flecha" size={15} />
            </button>
          </div>
        )}
      </div>
      <h3 className="gps-reporte-subtitulo">{t("gps.reportes.individual.totales")}</h3>
      {tabla(bloque, "totales", [
        { clave: "promedio", texto: t("gps.reportes.individual.promedio"), valores: bloque.totales.promedio },
        ...(conDesvio ? [{ clave: "desvio", texto: t("gps.reportes.individual.desvio"), valores: bloque.totales.desvio }] : []),
        { clave: "suma", texto: t("gps.reportes.individual.suma"), valores: bloque.totales.suma },
      ])}
      <h3 className="gps-reporte-subtitulo">{t("gps.reportes.individual.porMinuto")}</h3>
      {tabla(bloque, "porMinuto", [
        { clave: "promedio", texto: t("gps.reportes.individual.promedio"), valores: bloque.porMinuto.promedio },
        ...(conDesvio ? [{ clave: "desvio", texto: t("gps.reportes.individual.desvio"), valores: bloque.porMinuto.desvio }] : []),
      ])}
    </section>
  );
  const explicacion = (clave) => t(`gps.reportes.individual.variables.${clave}`);

  return (
    <div className="app">
      <div className="contenedor contenedor-base">
        {volver()}
        {encabezado(t("gps.reportes.reporteIndividual"), t("gps.reportes.individual.reporteTexto", { cuantas: CUANTAS }))}
        {arriba}
        <section className={`tarjeta gps-reportes-filtros gps-informe-filtros ${filtrosAbiertos ? "abiertos" : ""}`.trim()}>
          <button type="button" className="gps-informe-filtros-boton" onClick={() => setFiltrosAbiertos((antes) => !antes)} aria-expanded={filtrosAbiertos}>
            <span className="gps-informe-filtros-flecha">
              <Icono nombre="flecha" size={16} />
            </span>
            <span className="gps-informe-filtros-texto">
              <b>{t("gps.reportes.filtrosTitulo")}</b>
              <span className="gps-informe-filtros-resumen">{[nombreDeClave(jugador), resumenDeFiltros].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
          {filtrosAbiertos && (
            <div className="gps-informe-filtros-cuerpo">
              {grillaDeFiltros()}
              <div className="gps-reportes-siguiente">
                <p className="lesiones-ayuda" role="status">
                  {cuantasVan()}
                </p>
                <button type="button" className="boton-secundario" onClick={limpiarFiltros} disabled={!hayFiltros}>
                  {t("gps.reportes.limpiar")}
                </button>
              </div>
            </div>
          )}
        </section>

        {!jugador ? (
          <p className="lesiones-estado">{t("gps.reportes.individual.sinJugador")}</p>
        ) : (
          <>
            <section className="tarjeta gps-reporte-cabeza">
              <h2>{t("gps.reportes.individual.titulo", { nombre: nombreDeClave(jugador) })}</h2>
              <p>{t("gps.reportes.individual.ultimos", { cuantas: CUANTAS })}</p>
              <ul className="gps-reporte-leyenda" aria-label={t("gps.reportes.individual.leyenda")}>
                {FRANJAS.map((franja) => (
                  <li key={franja}>
                    <span className="gps-reporte-muestra" style={{ background: fuerte(COLOR_DE_FRANJA[franja]) }} aria-hidden="true" />
                    {t(`gps.reportes.franjas.${franja}`)}
                  </li>
                ))}
              </ul>
            </section>
            {seccion("porJugador", reporte.jugador, false)}
            {seccion("porEquipo", reporte.equipo, true)}
            <section className="tarjeta gps-reporte-variables">
              <b>{t("gps.reportes.individual.variablesTitulo")}</b>
              <dl>
                {["tiempo", ...MEDIDAS].map((clave) => (
                  <div key={clave}>
                    <dt>{tituloDeColumna(clave)}</dt>
                    <dd>{explicacion(clave)}</dd>
                  </div>
                ))}
                {MEDIDAS.map((clave) => (
                  <div key={`${clave}_min`}>
                    <dt>{tituloDeColumna(`${clave}_min`)}</dt>
                    <dd>{t("gps.reportes.individual.variables.porMinuto", { texto: explicacion(clave) })}</dd>
                  </div>
                ))}
                {["pse", "ua"].map((clave) => (
                  <div key={clave}>
                    <dt>{tituloDeColumna(clave)}</dt>
                    <dd>{explicacion(clave)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )}
      </div>
      {hojaDeVarios}
      <HojaConfirmar
        abierta={Boolean(aOcultar)}
        icono="ocultar"
        titulo={aOcultar ? t("gps.reportes.ocultarTitulo", { nombre: aOcultar.titulo }) : ""}
        descripcion={aOcultar ? t("gps.reportes.individual.ocultarTexto") : ""}
        etiquetaConfirmar={t("gps.reportes.ocultar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={() => {
          setOcultas((antes) => [...antes.filter((una) => una !== aOcultar.clave), aOcultar.clave]);
          setAOcultar(null);
        }}
        onCancelar={() => setAOcultar(null)}
      />
    </div>
  );
}
