import React, { useEffect, useMemo, useState } from "react";
import { Icono } from "./components/AppChrome";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { ListaParaMarcar } from "./components/ListaParaMarcar.jsx";
import { TerminoDe } from "./components/Guia.jsx";
import { valorDeFiltro } from "./domain/gps/porMicrociclo.js";
import { rellenoDe } from "./domain/colores.js";
import { FILTROS_DEL_REPORTE, entraEnElReporte, pasaLosFiltrosDelReporte } from "./domain/gps/reporteIndividual.js";
import { CASILLAS, CATEGORIZACIONES_DEL_GRUPAL, COLUMNAS_JUGADORES, colorDeColumna, conTiempo, reporteGrupal } from "./domain/gps/reporteGrupal.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// GPS › Informe › Reporte grupal (la hoja «Reporte Grupal» del Excel, que es
// un borrador; el contenido, la propuesta que pidió Santiago el 16/10; el
// cálculo, en domain/gps/reporteGrupal.js). Dos pasos, como el Reporte
// individual: los filtros y el reporte, con «Filtros» adentro. Arriba,
// Período, Grupo y Sesiones; después, «Rendimiento y carga» con 10 casillas
// y «Jugadores en el informe», una tabla con el promedio por sesión de cada
// jugador, pintada con las tres categorizaciones del Informe (Santiago,
// 16/10: «Los 3 tipos de categorizacion»), con las franjas arriba y su botón,
// como el Informe. Las columnas se ocultan tocando su nombre.

const SIN_ELEGIR = [];
const SIN_FILTROS = Object.freeze({});
const CLAVE_COLUMNAS_OCULTAS = "gps_reporte_grupal_columnas_ocultas";
const leerOcultas = () => {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_COLUMNAS_OCULTAS) || "null");
    return Array.isArray(guardadas) ? guardadas.filter((clave) => typeof clave === "string") : [];
  } catch {
    return [];
  }
};
const guardarOcultas = (ocultas) => {
  try {
    localStorage.setItem(CLAVE_COLUMNAS_OCULTAS, JSON.stringify(ocultas));
  } catch {
    // Sin dónde guardar, quedan ocultas mientras se está acá.
  }
};
const FRANJAS = ["excelente", "muyBueno", "bueno", "regular", "malo", "desvio"];
const nombreDeReferencia = (referencia) => [referencia.tipo, referencia.tabla, referencia.grupo].filter(Boolean).join(" · ");

// Las mismas props que ReporteIndividualGps y, para «Valor referencial», las
// del Informe: referencias (los V.R.), elegidos (los de la Base) y
// nombreDelDispositivo.
export default function ReporteGrupalGps({ filasGps, referencias = [], elegidos = null, nombreDe, nombreDelDispositivo = (codigo) => codigo, tituloDe, textoDe, textosDeListas, encabezado, arriba = null, volver, cargando = false }) {
  const { idioma, plural } = useIdioma();
  const [paso, setPaso] = useState("filtros");
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [hoja, setHoja] = useState(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [ocultas, setOcultas] = useState(leerOcultas);
  const [aOcultar, setAOcultar] = useState(null);
  const [categorizacion, setCategorizacion] = useState("miSeleccion");
  const [vrElegido, setVrElegido] = useState("");
  const [franjasOcultas, setFranjasOcultas] = useState(false);
  useEffect(() => guardarOcultas(ocultas), [ocultas]);

  // ------------------------------------------------------- Los filtros --
  const nombreDeClave = (clave) => {
    const [tipo, ...resto] = String(clave).split(":");
    const quien = resto.join(":");
    if (tipo === "jugador") return nombreDe({ jugador_id: Number(quien) }) || quien;
    return quien;
  };
  // Las opciones de cada filtro: las de las filas con tiempo que entran con
  // lo elegido en los otros dos.
  const opciones = useMemo(() => {
    const porFiltro = Object.fromEntries(FILTROS_DEL_REPORTE.map((filtro) => [filtro, new Set(filtros[filtro] || SIN_ELEGIR)]));
    filasGps.forEach((fila) => {
      if (!entraEnElReporte(fila) || !conTiempo(fila)) return;
      FILTROS_DEL_REPORTE.forEach((filtro) => {
        if (pasaLosFiltrosDelReporte(fila, { ...filtros, [filtro]: SIN_ELEGIR })) porFiltro[filtro].add(valorDeFiltro(fila, filtro));
      });
    });
    return porFiltro;
  }, [filasGps, filtros]);
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

  // El V.R. de «Valor referencial»: el elegido acá o, de entrada, el de la
  // Base para el dispositivo de la última sesión (como el Informe).
  const sinVr = useMemo(() => reporteGrupal(filasGps, { filtros }), [filasGps, filtros]);
  const vr = useMemo(() => {
    const elegido = referencias.find((referencia) => referencia.id === vrElegido);
    if (elegido) return elegido;
    const suyas = referencias.filter((referencia) => referencia.dispositivo === sinVr.dispositivo);
    return suyas.find((una) => una.id === elegidos?.vr?.[sinVr.dispositivo]) || suyas[0] || referencias[0] || null;
  }, [referencias, vrElegido, elegidos, sinVr.dispositivo]);
  const reporte = useMemo(
    () => (categorizacion === "miSeleccion" ? sinVr : reporteGrupal(filasGps, { filtros, categorizacion, vr })),
    [sinVr, filasGps, filtros, categorizacion, vr],
  );
  const jugadores = useMemo(
    () => [...reporte.jugadores].sort((a, b) => nombreDeClave(a.clave).localeCompare(nombreDeClave(b.clave), idioma, { sensitivity: "base", numeric: true })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reporte, idioma],
  );

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
  const grillaDeFiltros = () => <div className="gps-reportes-grilla">{FILTROS_DEL_REPORTE.map(desplegable)}</div>;
  const cuantasVan = () => (reporte.sesiones ? plural("gps.reportes.grupal.cuantas", reporte.sesiones) : t("gps.reportes.grupal.sinSesiones"));

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
          {volver}
          {encabezado(t("gps.reportes.reporteGrupal"), t("gps.reportes.grupal.filtrosTexto"))}
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
              <button
                type="button"
                className="boton-principal"
                onClick={() => {
                  setFiltrosAbiertos(false);
                  setPaso("reporte");
                }}
                disabled={!reporte.sesiones}
              >
                {t("gps.reportes.grupal.siguiente")}
              </button>
            </div>
          </section>
        </div>
        {hojaDeVarios}
      </div>
    );
  }

  // ------------------------------------------------------------ Reporte --
  const vacio = <span className="gps-informe-vacio">–</span>;
  const texto = (clave, valor) => {
    const escrito = textoDe(clave, valor);
    return escrito === "" || escrito === null || escrito === undefined ? vacio : escrito;
  };
  const columnas = COLUMNAS_JUGADORES.filter((clave) => !ocultas.includes(clave));
  const cuantasOcultas = ocultas.filter((clave) => COLUMNAS_JUGADORES.includes(clave)).length;
  const abrirColumnas = () => {
    const valores = COLUMNAS_JUGADORES.map((clave) => ({ clave, texto: tituloDe(clave) }));
    setHoja({ ocultar: true, titulo: t("gps.reportes.aLaVista.columnas"), valores, elegidos: COLUMNAS_JUGADORES.filter((clave) => !ocultas.includes(clave)), busqueda: "" });
  };
  const dispositivos = [...new Set(referencias.map((referencia) => referencia.dispositivo))];
  const nombreDeVr = (referencia) => (referencia ? `${nombreDelDispositivo(referencia.dispositivo)} · ${nombreDeReferencia(referencia)}` : "");
  const textoDeVr = (referencia) => (dispositivos.length > 1 ? nombreDeVr(referencia) : nombreDeReferencia(referencia));
  const conVr = categorizacion === "valorReferencial";
  const filasDeFranjas = [
    ...(conVr && vr ? [{ clave: "franja:vr", franja: "vr", texto: t("gps.reportes.franjas.vr") }] : []),
    ...(franjasOcultas ? [] : FRANJAS.map((franja) => ({ clave: `franja:${franja}`, franja, texto: t(`gps.reportes.franjas.${franja}`) }))),
  ];
  // En las franjas, cada número con el color que toma lo que cae ahí (como
  // el Informe); el V.R., sin color.
  const celdaDeFranja = (clave, franja) => {
    if (franja === "vr") return <td key={clave}>{texto(clave, vr?.promedio?.[clave])}</td>;
    const franjas = reporte.franjas[clave];
    if (!franjas) return <td key={clave} />;
    const valor = franjas[franja];
    const color = franja !== "desvio" ? colorDeColumna(clave)(valor, franjas) : null;
    return (
      <td key={clave} className={color ? "pintada" : undefined} style={color ? { background: rellenoDe(color) } : undefined}>
        {texto(clave, valor)}
      </td>
    );
  };
  const tituloDeFranjas = conVr
    ? vr
      ? t("gps.reportes.franjasDe", { vr: nombreDeVr(vr) })
      : t("gps.reportes.franjasSinVr")
    : t("gps.reportes.franjasDe", { vr: t(`gps.reportes.categorizaciones.${categorizacion}`) });
  const periodo = reporte.desde ? (reporte.desde === reporte.hasta ? fechaCorta(reporte.desde) : t("gps.reportes.tramo", { desde: fechaCorta(reporte.desde), hasta: fechaCorta(reporte.hasta) })) : "–";
  const dato = (icono, rotulo, valor) => (
    <div className="gps-grupal-dato">
      <span className="gps-grupal-dato-icono" aria-hidden="true">
        <Icono nombre={icono} size={18} />
      </span>
      <span className="gps-grupal-dato-texto">
        <span>{rotulo}</span>
        <b>{valor}</b>
      </span>
    </div>
  );

  return (
    <div className="app">
      <div className="contenedor contenedor-base">
        {volver}
        {encabezado(t("gps.reportes.reporteGrupal"), t("gps.reportes.grupal.reporteTexto"))}
        {arriba}
        <section className={`tarjeta gps-reportes-filtros gps-informe-filtros ${filtrosAbiertos ? "abiertos" : ""}`.trim()}>
          <button type="button" className="gps-informe-filtros-boton" onClick={() => setFiltrosAbiertos((antes) => !antes)} aria-expanded={filtrosAbiertos}>
            <span className="gps-informe-filtros-flecha">
              <Icono nombre="flecha" size={16} />
            </span>
            <span className="gps-informe-filtros-texto">
              <b>{t("gps.reportes.filtrosTitulo")}</b>
              <span className="gps-informe-filtros-resumen">{resumenDeFiltros || t("gps.reportes.grupal.sinFiltros")}</span>
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

        {!reporte.sesiones ? (
          <p className="lesiones-estado">{t("gps.reportes.grupal.sinSesiones")}</p>
        ) : (
          <>
            <section className="tarjeta gps-reporte-cabeza gps-grupal-cabeza">
              <h2>{t("gps.reportes.grupal.titulo")}</h2>
              <div className="gps-grupal-datos">
                {dato("calendario", t("gps.reportes.grupal.periodo"), periodo)}
                {dato("usuario", t("gps.reportes.grupal.grupo"), t("gps.reportes.grupal.plantel"))}
                {dato("torta", t("gps.reportes.grupal.sesiones"), reporte.sesiones)}
              </div>
            </section>

            <section className="tarjeta gps-reportes-tabla gps-reporte-seccion">
              <div className="gps-informe-barra">
                <div className="gps-informe-titulo">
                  <Icono nombre="grafico" size={20} />
                  <span className="gps-informe-titulo-texto">
                    <b>{t("gps.reportes.grupal.rendimiento")}</b>
                    <span>{t("gps.reportes.grupal.rendimientoTexto")}</span>
                  </span>
                </div>
              </div>
              <ul className="gps-grupal-casillas">
                {CASILLAS.map((clave) => (
                  <li key={clave} className="gps-grupal-casilla">
                    <span className="gps-grupal-casilla-nombre">{tituloDe(clave)}</span>
                    <b className="gps-grupal-casilla-valor">{texto(clave, reporte.casillas[clave].promedio)}</b>
                    <span className="gps-grupal-casilla-total">
                      {t("gps.reportes.grupal.total")} <b>{texto(clave, reporte.casillas[clave].total)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="tarjeta gps-reportes-tabla gps-reporte-seccion">
              <div className="gps-informe-barra">
                <div className="gps-informe-titulo">
                  <Icono nombre="formacion" size={20} />
                  <span className="gps-informe-titulo-texto">
                    <b>{t("gps.reportes.grupal.jugadores", { n: jugadores.length })}</b>
                    <span>{tituloDeFranjas}</span>
                  </span>
                </div>
                <div className="gps-informe-acciones">
                  <button type="button" className={`selector-hoja gps-informe-ver ${cuantasOcultas ? "con-ocultas" : ""}`} onClick={abrirColumnas}>
                    <span>{t("gps.reportes.ocultas.columnas")}</span>
                    <b>{cuantasOcultas ? plural("gps.reportes.ocultas.cuantas", cuantasOcultas) : t("gps.reportes.ocultas.todas")}</b>
                    <Icono nombre="flecha" size={15} />
                  </button>
                  {/* Las franjas de color: un toque las oculta y otro las vuelve a mostrar (el V.R. queda). */}
                  <button
                    type="button"
                    className={`selector-hoja gps-informe-ver gps-informe-franjas-boton ${franjasOcultas ? "con-ocultas" : ""}`}
                    onClick={() => setFranjasOcultas((antes) => !antes)}
                    aria-label={t(franjasOcultas ? "gps.reportes.ocultas.mostrarFranjas" : "gps.reportes.ocultas.ocultarFranjas")}
                    title={t(franjasOcultas ? "gps.reportes.ocultas.mostrarFranjas" : "gps.reportes.ocultas.ocultarFranjas")}
                  >
                    <span>{t("gps.reportes.ocultas.franjas")}</span>
                    <b>{t(franjasOcultas ? "gps.reportes.ocultas.franjasOcultas" : "gps.reportes.ocultas.franjasALaVista")}</b>
                    <Icono nombre="ocultar" size={15} />
                  </button>
                </div>
              </div>
              <p className="lesiones-ayuda gps-grupal-ayuda">{t("gps.reportes.grupal.jugadoresTexto")}</p>
              <div className="gps-reportes-grilla gps-grupal-controles">
                <label className="campo-inicio">
                  <span className="gps-reportes-rotulo">
                    {t("gps.reportes.categorizacion")}
                    <TerminoDe clave="gps.terminos.categorizacion" />
                  </span>
                  <span className="gps-reportes-campo">
                    <Icono nombre="cuadros" size={18} />
                    <select value={categorizacion} onChange={(evento) => setCategorizacion(evento.target.value)}>
                      {CATEGORIZACIONES_DEL_GRUPAL.map((una) => (
                        <option key={una} value={una}>
                          {t(`gps.reportes.categorizaciones.${una}`)}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                {conVr && (
                  <label className="campo-inicio">
                    <span className="gps-reportes-rotulo">
                      {t("gps.reportes.vr")}
                      <TerminoDe clave="gps.terminos.vrInforme" />
                    </span>
                    {referencias.length ? (
                      <span className="gps-reportes-campo">
                        <Icono nombre="objetivo" size={18} />
                        <select value={vr?.id || ""} onChange={(evento) => setVrElegido(evento.target.value)}>
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
                      </span>
                    ) : (
                      <p className="lesiones-ayuda">{t("gps.reportes.grupal.sinVrs")}</p>
                    )}
                  </label>
                )}
              </div>
              <div className="gps-informe-marco gps-reporte-marco" tabIndex={0} role="region" aria-label={t("gps.reportes.grupal.jugadores", { n: jugadores.length })}>
                <table className="gps-informe-tabla gps-reporte-tabla gps-grupal-tabla">
                  <thead>
                    <tr>
                      <th scope="col" className="gps-informe-id">
                        {t("gps.reportes.individual.jugador")}
                      </th>
                      <th scope="col">{t("gps.reportes.grupal.sesiones")}</th>
                      {columnas.map((clave) => (
                        <th key={clave} scope="col">
                          <button type="button" className="gps-informe-cabecera" onClick={() => setAOcultar({ clave, titulo: tituloDe(clave) })} title={t("gps.reportes.tocarParaOcultar")} aria-haspopup="dialog">
                            {tituloDe(clave)}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {filasDeFranjas.length > 0 && (
                    <tbody className="gps-informe-franjas">
                      {filasDeFranjas.map((una) => (
                        <tr key={una.clave} className={`franja-${una.franja}`}>
                          <th scope="row" className="gps-informe-id">
                            {una.texto}
                          </th>
                          <td />
                          {columnas.map((clave) => celdaDeFranja(clave, una.franja))}
                        </tr>
                      ))}
                    </tbody>
                  )}
                  <tbody className="gps-informe-filas">
                    {jugadores.map((uno) => (
                      <tr key={uno.clave}>
                        <th scope="row" className="gps-informe-id">
                          {nombreDeClave(uno.clave)}
                        </th>
                        <td>{uno.sesiones}</td>
                        {columnas.map((clave) => {
                          const color = uno.colores[clave];
                          return (
                            <td key={clave} className={color ? "pintada" : undefined} style={color ? { background: rellenoDe(color) } : undefined}>
                              {texto(clave, uno.valores[clave])}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
      {hojaDeVarios}
      <HojaConfirmar
        abierta={Boolean(aOcultar)}
        icono="ocultar"
        titulo={aOcultar ? t("gps.reportes.ocultarTitulo", { nombre: aOcultar.titulo }) : ""}
        descripcion={aOcultar ? t("gps.reportes.grupal.ocultarTexto") : ""}
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
