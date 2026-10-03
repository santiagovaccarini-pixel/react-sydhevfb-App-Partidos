import React, { useEffect, useState } from "react";
import { Icono } from "./components/AppChrome";
import { EscudoDeClub } from "./components/ClubCrest";
import { FiguraCuerpo } from "./components/FiguraCuerpo.jsx";
import { calcular, esFechaISO, normalizarTexto } from "./domain/lesiones.js";
import { CAMPOS } from "./domain/lesionesCampos.js";
import {
  PERIODOS,
  REGLAS_INCIDENCIA,
  VARIANTES,
  contarPor,
  contraVR,
  cuadroCadaMil,
  lesionesDelReporte,
  minutosGps,
  periodoDe,
  porMes,
  resumenDeLesiones,
} from "./domain/reportes.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// Los reportes de Lesiones. "Ver reportes": el individual (la hoja "Reporte
// de Lesiones IND" del Excel, con las mismas cuentas y mejor presentada) y el
// grupal; "Crear reportes", lo que sigue. Las cuentas cada 1000 horas usan
// los minutos del GPS: gps es [{ jugadorId, fecha, minutos }], o null
// mientras la app no los tenga.

// Los colores de la severidad (como en los gráficos del Excel: amarillo,
// naranja, rojo, violeta).
const COLOR_SEVERIDAD = { registro: "#94a3b8", leve: "#facc15", menor: "#fb923c", moderado: "#ef4444", mayor: "#7c3aed", abierta: "#64748b" };
const ORDEN_SEVERIDAD = ["registro", "leve", "menor", "moderado", "mayor", "abierta"];

// La tabla del jugador, como en el Excel ("cabeceras móviles"): doce columnas
// que se cambian desde su cabecera. Lo elegido queda en el celular.
const COLUMNAS_DEL_EXCEL = ["numero_registro", "parte_cuerpo", "tipo_lesion", "mecanismo", "recurrencia", "recidiva", "severidad", "fecha_lesion", "fecha_transicion", "recuperacion", "fecha_alta", "musculo"];
const CLAVE_COLUMNAS = "lesiones_reporte_columnas";
const leerColumnas = () => {
  try {
    const guardadas = JSON.parse(window.localStorage.getItem(CLAVE_COLUMNAS) || "null");
    return Array.isArray(guardadas) && guardadas.length === COLUMNAS_DEL_EXCEL.length ? guardadas : COLUMNAS_DEL_EXCEL;
  } catch {
    return COLUMNAS_DEL_EXCEL;
  }
};
const guardarColumnas = (columnas) => {
  try {
    window.localStorage.setItem(CLAVE_COLUMNAS, JSON.stringify(columnas));
  } catch {
    // Sin dónde guardarlas, duran hasta cerrar la app.
  }
};

const CAMPO_POR_CLAVE = Object.fromEntries(CAMPOS.map((campo) => [campo.clave, campo]));

// Más que el VR, en rojo; menos, en verde (la leyenda del Excel).
const tonoContraVR = (delJugador, vr) => {
  if (delJugador === null || vr === null) return "";
  if (delJugador > vr) return "peor";
  return delJugador < vr ? "mejor" : "";
};

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
      {presentes.length > 0 && (
        <p className="reporte-leyenda">
          {presentes.map((clave) => (
            <span key={clave}>
              <i style={{ background: COLOR_SEVERIDAD[clave] }} />
              {textoSeveridad(clave)}
            </span>
          ))}
        </p>
      )}
    </div>
  );
};

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
          <FiguraCuerpo vista={vista} colorDe={colorDe} nombreDeParte={(codigo) => textoDeOpcion("parte_cuerpo", codigo)} etiquetas={{ figura: t(`lesiones.cuerpo.${vista}`) }} />
          <small>{t(`lesiones.cuerpo.${vista}`)}</small>
        </div>
      ))}
    </div>
  );
};

// El cuadro del Excel: las cuatro columnas (severidad todas o sin leves, de
// todos los tipos o solo LM) y una fila por medida: [{ id, rotulo, clase?,
// celdas: [{ texto, tono? }] }].
const CuadroCadaMil = ({ titulo, filas }) => (
  <div className="informe-bloque">
    <h3 className="informe-cuadro-titulo">{titulo}</h3>
    <div className="informe-cuadro-marco">
      <table className="informe-cuadro" aria-label={titulo}>
        <thead>
          <tr>
            <td rowSpan={2} />
            <th scope="colgroup" colSpan={2}>
              {t("lesiones.reportes.tiposTodos")}
            </th>
            <th scope="colgroup" colSpan={2} className="informe-lm">
              {t("lesiones.reportes.tiposLM")}
            </th>
          </tr>
          <tr>
            {VARIANTES.map((variante) => (
              <th scope="col" key={variante.id}>
                {t(variante.sinLeves ? "lesiones.reportes.severidadSinLeves" : "lesiones.reportes.severidadTodas")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} className={fila.clase}>
              <th scope="row">{fila.rotulo}</th>
              {fila.celdas.map((celda, indice) => (
                <td key={VARIANTES[indice].id} className={celda.tono || undefined}>
                  {celda.texto}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// La foto del jugador (la de Datos básicos); si no hay o no carga, sus
// iniciales.
const FotoDelJugador = ({ jugador }) => {
  const [fallo, setFallo] = useState(false);
  useEffect(() => setFallo(false), [jugador.foto_url]);
  const iniciales = String(jugador.nombre || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0])
    .join("")
    .toUpperCase();
  return (
    <div className="informe-foto">
      {jugador.foto_url && !fallo ? <img src={jugador.foto_url} alt="" onError={() => setFallo(true)} /> : <span className="informe-iniciales">{iniciales}</span>}
    </div>
  );
};

// ------------------------------------------------------------- Reportes --

export default function ReportesLesiones({ lesiones, plantel, equipo, mapa, hoy, etiqueta, textoDeOpcion, enPantalla, camposVisibles, gps = null }) {
  const { idioma, plural } = useIdioma();
  const [modo, setModo] = useState("menu");
  const [jugadorId, setJugadorId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [columnas, setColumnas] = useState(leerColumnas);
  // El período y los filtros del grupal.
  const [periodo, setPeriodo] = useState("anio");
  const [rango, setRango] = useState(() => periodoDe("anio", hoy, lesiones));
  const [sinLeves, setSinLeves] = useState(false);
  const [soloMusculares, setSoloMusculares] = useState(false);

  const texto = textoDeOpcion;
  const numero = (valor, decimales = 2, minimo = decimales) =>
    valor === null || valor === undefined ? "—" : Number(valor).toLocaleString(idioma, { minimumFractionDigits: minimo, maximumFractionDigits: decimales });
  const textoSeveridad = (clave) => (clave === "abierta" ? t("lesiones.reportes.abierta") : texto("severidad", clave));
  const jugador = plantel.find((uno) => String(uno.id) === String(jugadorId)) || null;
  // Qué lesiones entran en el cuadro, dicho con las opciones del club.
  const criterio = ["producto", "cuando", "localizacion"].map((clave) => `${etiqueta(clave)}: ${REGLAS_INCIDENCIA[clave].map((codigo) => texto(clave, codigo)).join(", ")}`).join(" · ");

  const acciones = (
    <div className="reporte-acciones no-imprimir">
      <button type="button" className="boton-secundario reporte-volver" onClick={() => setModo("menu")}>
        <Icono nombre="flecha" size={14} />
        {t("lesiones.reportes.volver")}
      </button>
      <div className="reporte-acciones-derecha">
        {modo === "individual" && jugador && (
          <button type="button" className="boton-secundario" onClick={() => setJugadorId("")}>
            <Icono nombre="cambio" size={16} />
            {t("lesiones.reportes.cambiarJugador")}
          </button>
        )}
        {(modo === "grupal" || jugador) && (
          <button type="button" className="boton-principal" onClick={() => window.print()}>
            <Icono nombre="documento" size={16} />
            {t("lesiones.reportes.imprimir")}
          </button>
        )}
      </div>
    </div>
  );

  // --------------------------------------------------------------- Menú --
  if (modo === "menu") {
    const tarjeta = (cual, icono, titulo, detalle) => (
      <button type="button" key={cual} className="opcion-ajuste reporte-opcion" onClick={() => setModo(cual)}>
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
    if (!jugador) {
      const buscado = normalizarTexto(busqueda);
      const lista = plantel.filter((uno) => !buscado || normalizarTexto(uno.nombre).includes(buscado));
      return (
        <div className="app reporte">
          <div className="contenedor contenedor-base">
            {acciones}
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
          </div>
        </div>
      );
    }

    // El cuadro: el jugador con sus minutos de GPS contra el plantel entero
    // hasta hoy (en el Excel, la fila "BASE COMPLETA" de "Incidencias c 1000h").
    const deJugador = lesiones.filter((lesion) => String(lesion.jugador_id) === String(jugador.id));
    const delJugador = cuadroCadaMil(deJugador, minutosGps(gps, { jugadorId: jugador.id }), { hasta: hoy });
    const delPlantel = cuadroCadaMil(lesiones, minutosGps(gps, { hasta: hoy }), { hasta: hoy });
    const filasDe = (medida) => {
      const tonos = delJugador.map((fila, indice) => tonoContraVR(fila[medida], delPlantel[indice][medida]));
      const textoContra = (fila, indice) => {
        const contra = contraVR(fila[medida], delPlantel[indice][medida]);
        if (!contra) return "—";
        return t("lesiones.reportes.valorVsVR", { valor: contra.signo ? `${contra.signo}${numero(contra.porcentaje, 1)}%` : "0%" });
      };
      return [
        { id: "jugador", clase: "informe-fila-jugador", rotulo: t("lesiones.reportes.jugador"), celdas: delJugador.map((fila, indice) => ({ texto: numero(fila[medida]), tono: tonos[indice] })) },
        { id: "vr", rotulo: t("lesiones.reportes.vr"), celdas: delPlantel.map((fila) => ({ texto: numero(fila[medida]) })) },
        { id: "contra", clase: "informe-fila-contra", rotulo: t("lesiones.reportes.jugadorVsVR"), celdas: delJugador.map((fila, indice) => ({ texto: textoContra(fila, indice), tono: tonos[indice] })) },
      ];
    };

    const datosDelJugador = [
      { icono: "calendario", rotulo: t("lesiones.reportes.nacimiento"), valor: esFechaISO(jugador.fecha_nacimiento) ? fechaCorta(jugador.fecha_nacimiento) : "—" },
      { icono: "huellas", rotulo: t("lesiones.reportes.pie"), valor: jugador.pie_dominante ? texto("pie_dominante", jugador.pie_dominante) : "—" },
      { icono: "cancha", rotulo: t("lesiones.reportes.posicion"), valor: jugador.posicion ? texto("posicion", jugador.posicion) : "—" },
    ];

    // La tabla: todas sus lesiones, por n° de registro.
    const opciones = camposVisibles.filter((campo) => campo.clave !== "jugador");
    const hay = new Set(opciones.map((campo) => campo.clave));
    const columnasAVer = columnas.map((clave, indice) => (hay.has(clave) ? clave : hay.has(COLUMNAS_DEL_EXCEL[indice]) ? COLUMNAS_DEL_EXCEL[indice] : opciones[0]?.clave)).filter(Boolean);
    const cambiarColumna = (indice, clave) => {
      const nuevas = columnasAVer.map((actual, cual) => (cual === indice ? clave : actual));
      setColumnas(nuevas);
      guardarColumnas(nuevas);
    };
    const registro = (lesion) => calcular("numero_registro", lesion, null, { lesiones }) ?? 0;
    const ordenadas = [...deJugador].sort((a, b) => registro(a) - registro(b) || String(a.fecha_lesion).localeCompare(String(b.fecha_lesion)));

    return (
      <div className="app reporte">
        <div className="contenedor contenedor-base">
          {acciones}
          <article className="informe">
            <header className="informe-cabecera">
              <div className="informe-identidad">
                <div className="informe-club">
                  <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} compacto />
                  <span>{equipo?.nombre || ""}</span>
                </div>
                <h1>{jugador.nombre}</h1>
                <p className="informe-subtitulo">{t("lesiones.reportes.individualTitulo")}</p>
              </div>
              <FotoDelJugador jugador={jugador} />
            </header>

            <div className="informe-cuerpo">
              <dl className="informe-datos">
                {datosDelJugador.map((dato) => (
                  <div className="informe-dato" key={dato.icono}>
                    <span className="informe-dato-icono" aria-hidden="true">
                      <Icono nombre={dato.icono} size={20} />
                    </span>
                    <div>
                      <dt>{dato.rotulo}</dt>
                      <dd>{dato.valor}</dd>
                    </div>
                  </div>
                ))}
              </dl>

              <div className="informe-indices">
                <CuadroCadaMil titulo={t("lesiones.reportes.lesionesMil")} filas={filasDe("lesionesCadaMil")} />
                <CuadroCadaMil titulo={t("lesiones.reportes.diasMil")} filas={filasDe("diasCadaMil")} />
                {!gps && <p className="informe-aviso">{t("lesiones.reportes.faltaGps")}</p>}
                <ul className="informe-leyenda">
                  <li>
                    <i className="peor" />
                    {t("lesiones.reportes.superiorVR")}
                  </li>
                  <li>
                    <i className="mejor" />
                    {t("lesiones.reportes.inferiorVR")}
                  </li>
                  <li>
                    <i className="lm" />
                    {t("lesiones.reportes.queEsLM")}
                  </li>
                  <li>{t("lesiones.reportes.queEsVR")}</li>
                </ul>
                <p className="informe-criterio">{t("lesiones.reportes.cuentan", { criterio })}</p>
              </div>
            </div>

            <section className="informe-lesiones">
              <h2>
                {t("lesiones.reportes.susLesiones")}
                <span>{deJugador.length}</span>
              </h2>
              {deJugador.length === 0 ? (
                <p className="vacio-ficha">{t("lesiones.reportes.sinLesionesJugador")}</p>
              ) : (
                <div className="informe-tabla-marco">
                  <table className="informe-tabla">
                    <thead>
                      <tr>
                        {columnasAVer.map((clave, indice) => (
                          <th scope="col" key={indice}>
                            <label className="informe-columna">
                              <span>{etiqueta(clave)}</span>
                              <svg className="no-imprimir" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                                <path d="m2 4 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <select value={clave} onChange={(evento) => cambiarColumna(indice, evento.target.value)} aria-label={t("lesiones.reportes.columna", { n: indice + 1 })}>
                                {opciones.map((campo) => (
                                  <option key={campo.clave} value={campo.clave}>
                                    {etiqueta(campo.clave)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ordenadas.map((lesion) => (
                        <tr key={lesion.id}>
                          {columnasAVer.map((clave, indice) => (
                            <td key={indice}>{CAMPO_POR_CLAVE[clave] ? enPantalla(CAMPO_POR_CLAVE[clave], lesion) : ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </article>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- Grupal --
  if (modo === "grupal") {
    const { desde, hasta } = rango;
    const elegirPeriodo = (cual) => {
      setPeriodo(cual);
      if (cual !== "medida") setRango(periodoDe(cual, hoy, lesiones));
    };
    const delEquipo = lesionesDelReporte(lesiones, { desde, hasta, sinLeves, soloMusculares });
    const resumen = resumenDeLesiones(delEquipo, { hoy, todas: lesiones });
    // El cuadro del plantel en el período, como el contador de "Antecedentes BD".
    const cuadro = cuadroCadaMil(lesiones, minutosGps(gps, { desde, hasta }), { desde, hasta });
    const filasCuadro = [
      { id: "cantidad", rotulo: t("lesiones.reportes.kpiLesiones"), celdas: cuadro.map((fila) => ({ texto: numero(fila.cantidad, 0) })) },
      { id: "lesionesMil", clase: "informe-fila-jugador", rotulo: t("lesiones.reportes.lesionesMil"), celdas: cuadro.map((fila) => ({ texto: numero(fila.lesionesCadaMil) })) },
      { id: "dias", rotulo: t("lesiones.reportes.kpiDias"), celdas: cuadro.map((fila) => ({ texto: numero(fila.dias, 0) })) },
      { id: "diasMil", clase: "informe-fila-jugador", rotulo: t("lesiones.reportes.diasMil"), celdas: cuadro.map((fila) => ({ texto: numero(fila.diasCadaMil) })) },
    ];
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
    const condiciones = [sinLeves && t("lesiones.reportes.sinLeves"), soloMusculares && t("lesiones.reportes.soloMusculares")].filter(Boolean).join(" · ") || t("lesiones.reportes.todas");
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
                  {fechaCorta(desde)} – {fechaCorta(hasta)} · {condiciones}
                </small>
              </div>
            </div>
          </header>

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

          <section className="reporte-kpis">
            <Kpi valor={resumen.cantidad} rotulo={t("lesiones.reportes.kpiLesiones")} />
            <Kpi valor={resumen.jugadores} rotulo={t("lesiones.reportes.kpiJugadores")} />
            <Kpi valor={resumen.dias} rotulo={t("lesiones.reportes.kpiDias")} />
            <Kpi valor={resumen.activas} rotulo={t("lesiones.reportes.kpiActivas")} tono={resumen.activas ? "peor" : ""} />
            <Kpi valor={numero(resumen.promedioDias, 1, 0)} rotulo={t("lesiones.reportes.kpiPromedio")} />
            <Kpi valor={resumen.recurrentes} rotulo={t("lesiones.reportes.kpiRecurrentes")} />
          </section>

          {bloque(
            t("lesiones.reportes.cadaMil"),
            <div className="informe-indices">
              <CuadroCadaMil titulo={`${fechaCorta(desde)} – ${fechaCorta(hasta)}`} filas={filasCuadro} />
              {!gps && <p className="informe-aviso">{t("lesiones.reportes.faltaGps")}</p>}
              <p className="informe-criterio">{t("lesiones.reportes.cuentan", { criterio })}</p>
            </div>,
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
