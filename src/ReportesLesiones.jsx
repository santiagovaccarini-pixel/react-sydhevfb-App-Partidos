import React, { useEffect, useMemo, useState } from "react";
import { Icono } from "./components/AppChrome";
import { EscudoDeClub } from "./components/ClubCrest";
import { FiguraCuerpo } from "./components/FiguraCuerpo.jsx";
import { calcular, diasEntre, esFechaISO, normalizarTexto } from "./domain/lesiones.js";
import { CAMPOS } from "./domain/lesionesCampos.js";
import { leerExposicion } from "./domain/lesionesDb.js";
import { exposicionDeEntrenamientos, exposicionDePartidos } from "./domain/exposicion.js";
import {
  PERIODOS,
  contarPor,
  diasLesionadoEnPeriodo,
  horasEnPeriodo,
  incidencia,
  lesionesDelReporte,
  periodoDe,
  porMes,
  resumenDeLesiones,
} from "./domain/reportes.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// Los reportes de Lesiones. "Ver reportes": el individual (el "Relatório
// Lesões" del Excel, mejorado) y el grupal; "Crear reportes", lo que sigue.
// Todo sale de las lesiones cargadas y, para las cuentas cada 1000 horas, de
// los minutos de los partidos y de los entrenamientos (exposicion.js).

// Los colores de la severidad (como en los gráficos del Excel: amarillo,
// naranja, rojo, violeta).
const COLOR_SEVERIDAD = { registro: "#94a3b8", leve: "#facc15", menor: "#fb923c", moderado: "#ef4444", mayor: "#7c3aed", abierta: "#64748b" };
const ORDEN_SEVERIDAD = ["registro", "leve", "menor", "moderado", "mayor", "abierta"];

const redondear = (valor, decimales = 1) => (valor === null || valor === undefined ? "—" : Number(valor).toLocaleString(undefined, { maximumFractionDigits: decimales, minimumFractionDigits: 0 }));

// Las columnas de la tabla de lesiones del jugador (como en el Excel) y las
// que se pueden sumar ("cabeceras móviles").
const COLUMNAS_FIJAS = ["numero_registro", "parte_cuerpo", "lado", "tipo_lesion", "severidad", "fecha_lesion", "recuperacion", "fecha_alta"];
const COLUMNAS_OPCIONALES = ["mecanismo", "cuando", "producto", "musculo", "musculo_especifico", "ligamento", "area", "recurrencia", "recidiva", "fecha_transicion", "fecha_retorno_entrenamiento", "medico"];

// ---------------------------------------------------------------- Piezas --

const Kpi = ({ valor, rotulo, detalle = null, tono = "" }) => (
  <div className={`reporte-kpi ${tono}`.trim()}>
    <b>{valor}</b>
    <span>{rotulo}</span>
    {detalle && <small>{detalle}</small>}
  </div>
);

// Barras horizontales: [{ etiqueta, valor, detalle? }].
const Barras = ({ filas, maximo = null, color = "#16a34a", vacio }) => {
  if (!filas.length) return <p className="vacio-ficha">{vacio}</p>;
  const tope = maximo || Math.max(...filas.map((fila) => fila.valor), 1);
  return (
    <ul className="reporte-barras">
      {filas.map((fila) => (
        <li key={fila.etiqueta}>
          <span className="reporte-barras-etiqueta">{fila.etiqueta}</span>
          <span className="reporte-barras-pista">
            <span style={{ width: `${Math.max(2, (fila.valor / tope) * 100)}%`, background: fila.color || color }} />
          </span>
          <b>{fila.valor}</b>
          {fila.detalle && <small>{fila.detalle}</small>}
        </li>
      ))}
    </ul>
  );
};

// Lesiones por mes, apiladas por severidad.
const BarrasPorMes = ({ meses, textoSeveridad }) => {
  const tope = Math.max(...meses.map((mes) => mes.total), 1);
  const nombreDelMes = (mes) => new Date(`${mes}-15T12:00:00`).toLocaleDateString(undefined, { month: "short", year: meses.length > 12 ? "2-digit" : undefined });
  const presentes = ORDEN_SEVERIDAD.filter((severidad) => meses.some((mes) => mes.porSeveridad[severidad]));
  return (
    <div className="reporte-meses">
      <div className="reporte-meses-grafico" role="img" aria-label={t("lesiones.reportes.porMes")}>
        {meses.map((mes) => (
          <div className="reporte-meses-columna" key={mes.mes} title={`${nombreDelMes(mes.mes)}: ${mes.total}`}>
            <span className="reporte-meses-total">{mes.total || ""}</span>
            <div className="reporte-meses-pila" style={{ height: `${(mes.total / tope) * 100}%` }}>
              {ORDEN_SEVERIDAD.filter((severidad) => mes.porSeveridad[severidad]).map((severidad) => (
                <span key={severidad} style={{ flexGrow: mes.porSeveridad[severidad], background: COLOR_SEVERIDAD[severidad] }} />
              ))}
            </div>
            <small>{nombreDelMes(mes.mes)}</small>
          </div>
        ))}
      </div>
      {presentes.length > 0 && <Leyenda claves={presentes} texto={textoSeveridad} />}
    </div>
  );
};

const Leyenda = ({ claves, texto }) => (
  <p className="reporte-leyenda">
    {claves.map((clave) => (
      <span key={clave}>
        <i style={{ background: COLOR_SEVERIDAD[clave] }} />
        {texto(clave)}
      </span>
    ))}
  </p>
);

// La figura de frente y de espaldas, con cada parte más roja cuantas más
// lesiones tuvo.
const FiguraDeCalor = ({ lesiones, mapa, textoDeOpcion }) => {
  const conteo = new Map();
  lesiones.forEach((lesion) => {
    const parte = lesion.datos?.parte_cuerpo;
    if (!parte) return;
    const region = mapa.regionDe(parte, lesion.datos?.lado);
    if (!region) return;
    const clave = `${region}:${mapa.piezaDe(parte, region) || parte}`;
    conteo.set(clave, (conteo.get(clave) || 0) + 1);
  });
  const maximo = Math.max(...conteo.values(), 1);
  const colorDe = (region, pieza) => {
    const cantidad = conteo.get(`${region}:${pieza}`);
    if (!cantidad) return null;
    const fuerza = 0.35 + 0.65 * (cantidad / maximo);
    return `rgba(239, 68, 68, ${fuerza.toFixed(2)})`;
  };
  return (
    <div className="reporte-figuras">
      {["frente", "espalda"].map((vista) => (
        <div className="reporte-figura" key={vista}>
          <FiguraCuerpo chica={false} vista={vista} colorDe={colorDe} nombreDeParte={(codigo) => textoDeOpcion("parte_cuerpo", codigo)} etiquetas={{ figura: t(`lesiones.cuerpo.${vista}`) }} />
          <small>{t(`lesiones.cuerpo.${vista}`)}</small>
        </div>
      ))}
    </div>
  );
};

// Cada lesión como una barra entre su inicio y su alta (o hoy), en la recta
// del período.
const LineaDeTiempo = ({ lesiones, desde, hasta, hoy, textoDeOpcion }) => {
  const total = Math.max(1, diasEntre(desde, hasta) ?? 1);
  const posicion = (fecha) => Math.min(100, Math.max(0, ((diasEntre(desde, fecha) ?? 0) / total) * 100));
  if (!lesiones.length) return <p className="vacio-ficha">{t("lesiones.reportes.sinLesiones")}</p>;
  return (
    <ul className="reporte-linea">
      {lesiones.map((lesion) => {
        const severidad = calcular("severidad", lesion) || "abierta";
        const inicio = posicion(lesion.fecha_lesion);
        const fin = posicion(lesion.fecha_alta || hoy);
        return (
          <li key={lesion.id}>
            <span className="reporte-linea-texto">
              {textoDeOpcion("parte_cuerpo", lesion.datos?.parte_cuerpo)} · {fechaCorta(lesion.fecha_lesion)}
            </span>
            <span className="reporte-linea-pista">
              <span style={{ left: `${inicio}%`, width: `${Math.max(1.5, fin - inicio)}%`, background: COLOR_SEVERIDAD[severidad] }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
};

// El cuadro del Excel: lesiones y días perdidos cada 1000 horas, del jugador y
// del equipo, y cuánto más o menos.
const CuadroIncidencia = ({ tabla, horasJugador, horasEquipo }) => {
  const fila = (clave, datos) => {
    const tono = datos.diferencia === null ? "" : datos.diferencia > 0 ? "peor" : datos.diferencia < 0 ? "mejor" : "";
    return (
      <tr key={clave}>
        <th scope="row">{t(`lesiones.reportes.${clave}Mil`)}</th>
        <td>{redondear(datos.jugador)}</td>
        <td>{redondear(datos.equipo)}</td>
        <td className={`reporte-diferencia ${tono}`.trim()}>
          {datos.diferencia === null ? "—" : `${datos.diferencia > 0 ? "+" : ""}${redondear(datos.diferencia)}%`}
        </td>
      </tr>
    );
  };
  return (
    <>
      <table className="reporte-incidencia">
        <thead>
          <tr>
            <th />
            <th scope="col">{t("lesiones.reportes.jugador")}</th>
            <th scope="col">{t("lesiones.reportes.equipo")}</th>
            <th scope="col">{t("lesiones.reportes.diferencia")}</th>
          </tr>
        </thead>
        <tbody>
          {fila("lesiones", tabla.lesiones)}
          {fila("dias", tabla.dias)}
        </tbody>
      </table>
      <p className="lesiones-ayuda">
        {t("lesiones.reportes.horasJugador", {
          horas: redondear(horasJugador.total, 0),
          entrenamiento: redondear(horasJugador.entrenamiento, 0),
          partido: redondear(horasJugador.partido, 0),
        })}{" "}
        {t("lesiones.reportes.horasEquipo", { horas: redondear(horasEquipo.total, 0) })}
      </p>
      <p className="reporte-leyenda">
        <span>
          <i className="peor" />
          {t("lesiones.reportes.peorQueEquipo")}
        </span>
        <span>
          <i className="mejor" />
          {t("lesiones.reportes.mejorQueEquipo")}
        </span>
      </p>
    </>
  );
};

// ------------------------------------------------------------- Reportes --

export default function ReportesLesiones({ lesiones, plantel, config, equipo, mapa, hoy, etiqueta, textoDeOpcion }) {
  const { plural } = useIdioma();
  const [modo, setModo] = useState("menu");
  const [periodo, setPeriodo] = useState("anio");
  const [rango, setRango] = useState(() => periodoDe("anio", hoy, lesiones));
  const [sinLeves, setSinLeves] = useState(false);
  const [soloMusculares, setSoloMusculares] = useState(false);
  const [jugadorId, setJugadorId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [columnasExtra, setColumnasExtra] = useState(["mecanismo", "recurrencia", "recidiva"]);
  const [exposicion, setExposicion] = useState({ estado: "sin-leer", tramos: [] });

  // Las horas se leen una vez, al entrar a un reporte.
  useEffect(() => {
    if (modo === "menu" || exposicion.estado !== "sin-leer") return undefined;
    let vigente = true;
    setExposicion({ estado: "leyendo", tramos: [] });
    leerExposicion(equipo?.id || null).then(({ partidos, entrenamientos }) => {
      if (!vigente) return;
      setExposicion({ estado: "listo", tramos: [...exposicionDePartidos(partidos, plantel), ...exposicionDeEntrenamientos(entrenamientos)] });
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, equipo?.id]);

  const elegirPeriodo = (cual) => {
    setPeriodo(cual);
    if (cual !== "medida") setRango(periodoDe(cual, hoy, lesiones));
  };
  const { desde, hasta } = rango;
  const texto = textoDeOpcion;
  const filtros = { desde, hasta, sinLeves, soloMusculares, texto };
  const delEquipo = useMemo(() => lesionesDelReporte(lesiones, filtros), [lesiones, desde, hasta, sinLeves, soloMusculares, config]); // eslint-disable-line react-hooks/exhaustive-deps
  const jugador = plantel.find((uno) => String(uno.id) === String(jugadorId)) || null;
  const delJugador = useMemo(() => (jugador ? delEquipo.filter((lesion) => String(lesion.jugador_id) === String(jugador.id)) : []), [delEquipo, jugador]);
  const textoSeveridad = (clave) => (clave === "abierta" ? t("lesiones.reportes.abierta") : texto("severidad", clave));

  // ------------------------------------------------------------ Filtros --
  const filtrosDelReporte = (
    <section className="tarjeta reporte-filtros no-imprimir">
      <div className="grilla-criterios" role="group" aria-label={t("lesiones.reportes.periodo")}>
        {[...PERIODOS, "medida"].map((cual) => (
          <button type="button" key={cual} className={`chip-criterio ${periodo === cual ? "prendido" : ""}`} aria-pressed={periodo === cual} onClick={() => elegirPeriodo(cual)}>
            {t(`lesiones.reportes.periodos.${cual}`)}
          </button>
        ))}
      </div>
      {periodo === "medida" && (
        <div className="reporte-fechas">
          <label>
            {t("lesiones.reportes.desde")}
            <input type="date" value={desde} max={hasta} onChange={(evento) => esFechaISO(evento.target.value) && setRango({ desde: evento.target.value, hasta })} />
          </label>
          <label>
            {t("lesiones.reportes.hasta")}
            <input type="date" value={hasta} min={desde} onChange={(evento) => esFechaISO(evento.target.value) && setRango({ desde, hasta: evento.target.value })} />
          </label>
        </div>
      )}
      <div className="grilla-criterios" role="group" aria-label={t("lesiones.reportes.cuales")}>
        <button type="button" className={`chip-criterio ${sinLeves ? "prendido" : ""}`} aria-pressed={sinLeves} onClick={() => setSinLeves(!sinLeves)}>
          {t("lesiones.reportes.sinLeves")}
        </button>
        <button type="button" className={`chip-criterio ${soloMusculares ? "prendido" : ""}`} aria-pressed={soloMusculares} onClick={() => setSoloMusculares(!soloMusculares)}>
          {t("lesiones.reportes.soloMusculares")}
        </button>
      </div>
    </section>
  );

  const acciones = (
    <div className="reporte-acciones no-imprimir">
      <button type="button" className="boton-secundario" onClick={() => setModo("menu")}>
        <Icono nombre="flecha" size={14} />
        {t("lesiones.reportes.volver")}
      </button>
      <button type="button" className="boton-principal" onClick={() => window.print()}>
        <Icono nombre="documento" size={16} />
        {t("lesiones.reportes.imprimir")}
      </button>
    </div>
  );

  const condiciones = [sinLeves && t("lesiones.reportes.sinLeves"), soloMusculares && t("lesiones.reportes.soloMusculares")].filter(Boolean).join(" · ") || t("lesiones.reportes.todas");
  const rotuloPeriodo = `${fechaCorta(desde)} – ${fechaCorta(hasta)}`;
  const sinHoras = exposicion.estado === "listo" && horasEnPeriodo(exposicion.tramos, { desde, hasta }).total === 0;

  // --------------------------------------------------------------- Menú --
  if (modo === "menu") {
    const tarjeta = (cual, icono, titulo, detalle, deshabilitada = false) => (
      <button type="button" key={cual} className="opcion-ajuste reporte-opcion" onClick={() => setModo(cual)} disabled={deshabilitada}>
        <span className="icono-ajuste">
          <Icono nombre={icono} size={18} />
        </span>
        <span className="texto-ajuste">
          <b>{titulo}</b>
          <span>{detalle}</span>
        </span>
        <span className="flecha-ajuste">›</span>
      </button>
    );
    return (
      <div className="app">
        <div className="contenedor">
          <header className="encabezado lesiones-encabezado">
            <div className="lesiones-encabezado-texto">
              <h1>{t("lesiones.reportes.titulo")}</h1>
              <p>{t("lesiones.reportes.texto")}</p>
            </div>
          </header>
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{t("lesiones.reportes.ver")}</b>
            </div>
            {tarjeta("individual", "usuario", t("lesiones.reportes.individual"), t("lesiones.reportes.individualTexto"))}
            {tarjeta("grupal", "formacion", t("lesiones.reportes.grupal"), t("lesiones.reportes.grupalTexto"))}
          </section>
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{t("lesiones.reportes.crear")}</b>
            </div>
            <p className="pista-equipo">{t("lesiones.reportes.crearTexto")}</p>
          </section>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------- Individual --
  if (modo === "individual") {
    const busquedaNormal = normalizarTexto(busqueda);
    const lista = plantel.filter((uno) => !busquedaNormal || normalizarTexto(uno.nombre).includes(busquedaNormal));
    const todasDelJugador = jugador ? lesiones.filter((lesion) => String(lesion.jugador_id) === String(jugador.id)) : [];
    const resumen = resumenDeLesiones(delJugador, { hoy, desde, hasta, todas: lesiones });
    const diasDelPeriodo = Math.max(1, (diasEntre(desde, hasta) ?? 0) + 1);
    const diasFuera = jugador ? diasLesionadoEnPeriodo(todasDelJugador, desde, hasta, hoy) : 0;
    const disponibilidad = ((diasDelPeriodo - diasFuera) / diasDelPeriodo) * 100;
    const horasJugador = horasEnPeriodo(exposicion.tramos, { desde, hasta, jugadorId: jugador?.id ?? null });
    const horasEquipo = horasEnPeriodo(exposicion.tramos, { desde, hasta });
    const tabla = incidencia({ delJugador, delEquipo, horasJugador: horasJugador.total, horasEquipo: horasEquipo.total, hoy });
    const edad = jugador?.fecha_nacimiento ? Math.floor((diasEntre(jugador.fecha_nacimiento, hoy) ?? 0) / 365.25) : null;
    const columnas = [...COLUMNAS_FIJAS, ...COLUMNAS_OPCIONALES.filter((clave) => columnasExtra.includes(clave))];
    const contexto = { lesiones, hoy, texto };
    const celda = (lesion, clave) => {
      const campo = CAMPOS.find((uno) => uno.clave === clave);
      if (!campo) return "";
      if (campo.tipo === "calculado") {
        const valor = calcular(clave, lesion, jugador, contexto);
        if (valor === null || valor === undefined || valor === "") return "";
        if (campo.lista) return texto(clave, valor);
        if (clave === "recuperacion") return plural("lesiones.dias", valor);
        return String(valor);
      }
      if (campo.tipo === "fecha") return fechaCorta(lesion[clave]);
      if (campo.tipo === "lista") return texto(clave, lesion.datos?.[clave]);
      return lesion.datos?.[clave] || "";
    };

    return (
      <div className="app reporte">
        <div className="contenedor contenedor-base">
          {acciones}
          {!jugador ? (
            <section className="tarjeta lesiones-elegir-jugador">
              <p className="rotulo-criterio">{t("lesiones.reportes.elegirJugador")}</p>
              <input className="lesiones-buscador-jugador" type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder={t("lesiones.historial.buscar")} aria-label={t("lesiones.historial.buscar")} autoComplete="off" />
              <div className="lista-rivales lesiones-lista-jugadores">
                {lista.length === 0 ? (
                  <p className="sin-resultados">{t("lesiones.pasos.ningunJugador")}</p>
                ) : (
                  lista.map((uno) => (
                    <button type="button" key={uno.id} onClick={() => setJugadorId(String(uno.id))}>
                      <b>{uno.nombre}</b>
                      <span>{plural("lesiones.historial.cantidad", lesiones.filter((lesion) => String(lesion.jugador_id) === String(uno.id)).length)}</span>
                    </button>
                  ))
                )}
              </div>
            </section>
          ) : (
            <>
              <header className="reporte-portada">
                <div className="reporte-portada-club">
                  <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
                  <div>
                    <span>{t("lesiones.reportes.individualTitulo")}</span>
                    <b>{equipo?.nombre || ""}</b>
                    <small>
                      {rotuloPeriodo} · {condiciones}
                    </small>
                  </div>
                </div>
                <div className="reporte-portada-jugador">
                  {jugador.foto_url ? <img src={jugador.foto_url} alt="" className="reporte-foto" /> : <span className="reporte-foto reporte-iniciales">{jugador.nombre.slice(0, 2)}</span>}
                  <div>
                    <h1>{jugador.nombre}</h1>
                    <p>
                      {[
                        jugador.categoria && texto("categoria", jugador.categoria),
                        jugador.posicion && texto("posicion", jugador.posicion),
                        jugador.pie_dominante && `${etiqueta("pie_dominante")}: ${texto("pie_dominante", jugador.pie_dominante)}`,
                        edad !== null && plural("lesiones.anios", edad),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button type="button" className="boton-texto no-imprimir" onClick={() => setJugadorId("")}>
                    {t("lesiones.pasos.cambiar")}
                  </button>
                </div>
              </header>

              {filtrosDelReporte}

              <section className="reporte-kpis">
                <Kpi valor={resumen.cantidad} rotulo={t("lesiones.reportes.kpiLesiones")} />
                <Kpi valor={resumen.dias} rotulo={t("lesiones.reportes.kpiDias")} />
                <Kpi valor={`${redondear(disponibilidad, 0)}%`} rotulo={t("lesiones.reportes.kpiDisponibilidad")} detalle={t("lesiones.reportes.diasFuera", { n: diasFuera })} />
                <Kpi valor={resumen.activas} rotulo={t("lesiones.reportes.kpiActivas")} tono={resumen.activas ? "peor" : ""} />
              </section>

              <section className="tarjeta tarjeta-ficha">
                <div className="cabeza-ficha">
                  <b>{t("lesiones.reportes.cadaMil")}</b>
                  <span className="cuenta-ajuste">{condiciones}</span>
                </div>
                {exposicion.estado !== "listo" ? (
                  <p className="vacio-ficha">{t("lesiones.reportes.leyendoHoras")}</p>
                ) : sinHoras ? (
                  <p className="vacio-ficha">{t("lesiones.reportes.sinHoras")}</p>
                ) : (
                  <CuadroIncidencia tabla={tabla} horasJugador={horasJugador} horasEquipo={horasEquipo} />
                )}
              </section>

              <section className="reporte-dos">
                <div className="tarjeta tarjeta-ficha">
                  <div className="cabeza-ficha">
                    <b>{t("lesiones.reportes.dondeSeLesiono")}</b>
                  </div>
                  <FiguraDeCalor lesiones={delJugador} mapa={mapa} textoDeOpcion={texto} />
                </div>
                <div className="tarjeta tarjeta-ficha">
                  <div className="cabeza-ficha">
                    <b>{t("lesiones.reportes.lineaDeTiempo")}</b>
                  </div>
                  <LineaDeTiempo lesiones={[...delJugador].sort((a, b) => (a.fecha_lesion < b.fecha_lesion ? -1 : 1))} desde={desde} hasta={hasta} hoy={hoy} textoDeOpcion={texto} />
                  <Leyenda claves={ORDEN_SEVERIDAD.filter((clave) => delJugador.some((lesion) => (calcular("severidad", lesion) || "abierta") === clave))} texto={textoSeveridad} />
                </div>
              </section>

              <section className="tarjeta tarjeta-ficha">
                <div className="cabeza-ficha">
                  <b>{t("lesiones.reportes.susLesiones")}</b>
                  <span className="cuenta-ajuste">{delJugador.length}</span>
                </div>
                <div className="grilla-criterios reporte-columnas no-imprimir" role="group" aria-label={t("lesiones.reportes.columnas")}>
                  {COLUMNAS_OPCIONALES.map((clave) => (
                    <button
                      type="button"
                      key={clave}
                      className={`chip-criterio ${columnasExtra.includes(clave) ? "prendido" : ""}`}
                      aria-pressed={columnasExtra.includes(clave)}
                      onClick={() => setColumnasExtra((actuales) => (actuales.includes(clave) ? actuales.filter((una) => una !== clave) : [...actuales, clave]))}
                    >
                      {etiqueta(clave)}
                    </button>
                  ))}
                </div>
                {delJugador.length === 0 ? (
                  <p className="vacio-ficha">{t("lesiones.reportes.sinLesiones")}</p>
                ) : (
                  <div className="reporte-tabla-marco">
                    <table className="reporte-tabla">
                      <thead>
                        <tr>
                          {columnas.map((clave) => (
                            <th scope="col" key={clave}>
                              {etiqueta(clave)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...delJugador]
                          .sort((a, b) => (a.fecha_lesion < b.fecha_lesion ? -1 : 1))
                          .map((lesion) => (
                            <tr key={lesion.id}>
                              {columnas.map((clave) => (
                                <td key={clave}>{celda(lesion, clave)}</td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- Grupal --
  if (modo === "grupal") {
    const resumen = resumenDeLesiones(delEquipo, { hoy, desde, hasta, todas: lesiones });
    const horas = horasEnPeriodo(exposicion.tramos, { desde, hasta });
    const enPartido = delEquipo.filter((lesion) => String(lesion.datos?.cuando || "").startsWith("partida"));
    const enEntrenamiento = delEquipo.filter((lesion) => lesion.datos?.cuando === "treinamento");
    const cadaMil = (cantidad, de) => (de > 0 ? (cantidad / de) * 1000 : null);
    const conteo = (clave) =>
      contarPor(delEquipo, (lesion) => lesion.datos?.[clave], hoy).map((fila) => ({ etiqueta: texto(clave, fila.valor), valor: fila.cantidad, detalle: plural("lesiones.dias", fila.dias) }));
    const porJugador = contarPor(delEquipo, (lesion) => String(lesion.jugador_id), hoy)
      .map((fila) => ({ ...fila, jugador: plantel.find((uno) => String(uno.id) === fila.valor) }))
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 10)
      .map((fila) => ({ etiqueta: fila.jugador?.nombre || "—", valor: fila.dias, detalle: plural("lesiones.historial.cantidad", fila.cantidad) }));
    const porPosicion = contarPor(delEquipo, (lesion) => plantel.find((uno) => String(uno.id) === String(lesion.jugador_id))?.posicion, hoy).map((fila) => ({
      etiqueta: texto("posicion", fila.valor),
      valor: fila.cantidad,
      detalle: plural("lesiones.dias", fila.dias),
    }));
    const porSeveridad = ORDEN_SEVERIDAD.map((clave) => ({
      etiqueta: textoSeveridad(clave),
      valor: delEquipo.filter((lesion) => (calcular("severidad", lesion) || "abierta") === clave).length,
      color: COLOR_SEVERIDAD[clave],
    })).filter((fila) => fila.valor);
    const bloque = (titulo, contenido, clase = "") => (
      <section className={`tarjeta tarjeta-ficha ${clase}`.trim()}>
        <div className="cabeza-ficha">
          <b>{titulo}</b>
        </div>
        {contenido}
      </section>
    );
    const vacio = t("lesiones.reportes.sinLesiones");

    return (
      <div className="app reporte">
        <div className="contenedor contenedor-base">
          {acciones}
          <header className="reporte-portada">
            <div className="reporte-portada-club">
              <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
              <div>
                <span>{t("lesiones.reportes.grupalTitulo")}</span>
                <b>{equipo?.nombre || ""}</b>
                <small>
                  {rotuloPeriodo} · {condiciones}
                </small>
              </div>
            </div>
          </header>

          {filtrosDelReporte}

          <section className="reporte-kpis">
            <Kpi valor={resumen.cantidad} rotulo={t("lesiones.reportes.kpiLesiones")} />
            <Kpi valor={resumen.jugadores} rotulo={t("lesiones.reportes.kpiJugadores")} />
            <Kpi valor={resumen.dias} rotulo={t("lesiones.reportes.kpiDias")} />
            <Kpi valor={resumen.activas} rotulo={t("lesiones.reportes.kpiActivas")} tono={resumen.activas ? "peor" : ""} />
            <Kpi valor={redondear(resumen.promedioDias)} rotulo={t("lesiones.reportes.kpiPromedio")} />
            <Kpi valor={resumen.recurrentes} rotulo={t("lesiones.reportes.kpiRecurrentes")} />
          </section>

          {bloque(
            t("lesiones.reportes.cadaMil"),
            exposicion.estado !== "listo" ? (
              <p className="vacio-ficha">{t("lesiones.reportes.leyendoHoras")}</p>
            ) : sinHoras ? (
              <p className="vacio-ficha">{t("lesiones.reportes.sinHoras")}</p>
            ) : (
              <>
                <section className="reporte-kpis reporte-kpis-chicos">
                  <Kpi valor={redondear(cadaMil(delEquipo.length, horas.total))} rotulo={t("lesiones.reportes.incidenciaTotal")} detalle={t("lesiones.reportes.enHoras", { horas: redondear(horas.total, 0) })} />
                  <Kpi
                    valor={redondear(cadaMil(enEntrenamiento.length, horas.entrenamiento))}
                    rotulo={t("lesiones.reportes.incidenciaEntrenamiento")}
                    detalle={t("lesiones.reportes.enHoras", { horas: redondear(horas.entrenamiento, 0) })}
                  />
                  <Kpi valor={redondear(cadaMil(enPartido.length, horas.partido))} rotulo={t("lesiones.reportes.incidenciaPartido")} detalle={t("lesiones.reportes.enHoras", { horas: redondear(horas.partido, 0) })} />
                  <Kpi valor={redondear(cadaMil(resumen.dias, horas.total))} rotulo={t("lesiones.reportes.cargaTotal")} />
                </section>
              </>
            ),
          )}

          {bloque(t("lesiones.reportes.porMes"), <BarrasPorMes meses={porMes(delEquipo, desde, hasta)} textoSeveridad={textoSeveridad} />)}

          <section className="reporte-dos">
            {bloque(t("lesiones.reportes.dondeSeLesionan"), <FiguraDeCalor lesiones={delEquipo} mapa={mapa} textoDeOpcion={texto} />)}
            {bloque(etiqueta("parte_cuerpo"), <Barras filas={conteo("parte_cuerpo")} vacio={vacio} color="#ef4444" />)}
          </section>

          <section className="reporte-dos">
            {bloque(etiqueta("tipo_lesion"), <Barras filas={conteo("tipo_lesion")} vacio={vacio} />)}
            {bloque(etiqueta("severidad"), <Barras filas={porSeveridad} vacio={vacio} />)}
          </section>

          <section className="reporte-dos">
            {bloque(etiqueta("mecanismo"), <Barras filas={conteo("mecanismo")} vacio={vacio} color="#0ea5e9" />)}
            {bloque(etiqueta("cuando"), <Barras filas={conteo("cuando")} vacio={vacio} color="#0ea5e9" />)}
          </section>

          <section className="reporte-dos">
            {bloque(etiqueta("producto"), <Barras filas={conteo("producto")} vacio={vacio} color="#a855f7" />)}
            {bloque(etiqueta("posicion"), <Barras filas={porPosicion} vacio={vacio} color="#a855f7" />)}
          </section>

          {bloque(t("lesiones.reportes.masDias"), <Barras filas={porJugador} vacio={vacio} color="#f97316" />)}
        </div>
      </div>
    );
  }

  return null;
}
