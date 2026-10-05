import React, { useEffect, useState } from "react";
import { Icono } from "./components/AppChrome";
import { EscudoDeClub } from "./components/ClubCrest";
import { CuerpoConCalor, partirDespuesDeBarras } from "./components/CuerpoConCalor.jsx";
import { manchasDe } from "./components/manchasCuerpo.js";
import { CuadroCadaMil, tituloDeVariante } from "./components/CuadroCadaMil.jsx";
import { tonosDeGrupos } from "./components/TablaDatos.jsx";
import ReporteCadaMil from "./ReporteCadaMil.jsx";
import ReporteGraficos from "./ReporteGraficos.jsx";
import { calcular, claveDeQuien, esFechaISO, normalizarTexto, tieneFecha } from "./domain/lesiones.js";
import { actualesPrimero, esActual } from "./domain/plantel.js";
import { sacarFondo } from "./domain/recorteFoto.js";
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
  nombresDeQuien,
  periodoDe,
  porMes,
  resumenDeLesiones,
  tramosDeLaTabla,
} from "./domain/reportes.js";
import { t, useIdioma } from "./idioma/index.js";
import { enLista, fechaCorta } from "./idioma/formatos.js";
// La letra angosta de los títulos y los números del reporte (solo la latina,
// que alcanza para el castellano y el portugués).
import "@fontsource/roboto-condensed/latin-400.css";
import "@fontsource/roboto-condensed/latin-500.css";
import "@fontsource/roboto-condensed/latin-700.css";

// Los reportes de Lesiones. "Ver reportes": el individual (la hoja "Reporte
// de Lesiones IND" del Excel, con las mismas cuentas y mejor presentada), el
// grupal y "Lesiones c/1000h y días perdidos" (el contador por período de
// "Antecedentes BD", ReporteCadaMil.jsx); "Crear reportes", lo que sigue. Las cuentas cada 1000 horas usan
// los minutos del GPS: gps es [{ jugadorId, fecha, minutos }], o null
// mientras la app no los tenga. estado: los avisos de la carga (sin conexión,
// error, cargando), como en las otras pantallas; sin datosListos no se
// muestra ningún reporte (serían ceros que no son).

// Los colores de la severidad (como en los gráficos del Excel: amarillo,
// naranja, rojo, violeta).
const COLOR_SEVERIDAD = { registro: "#94a3b8", leve: "#facc15", menor: "#fb923c", moderado: "#ef4444", mayor: "#7c3aed", abierta: "#64748b" };
const ORDEN_SEVERIDAD = ["registro", "leve", "menor", "moderado", "mayor", "abierta"];

// La tabla del jugador: todas las columnas de la base que el club tiene a la
// vista, en tramos por grupo del Excel, una tabla debajo de la otra
// (TABLA_DEL_INDIVIDUAL en domain/reportes.js). Las columnas cortas
// (números, fechas, sí o no, la severidad) no se parten en renglones: el
// lugar que sobra queda para los textos. La fecha y hora de la imagen sí se
// parte (la hora abajo), para que las tablas entren a lo ancho.
const COLUMNAS_CORTAS = new Set([
  "numero_caso",
  "numero_registro",
  "fecha_nacimiento",
  "edad",
  "lado_habil",
  "horas_imagen",
  "fecha_lesion",
  "fecha_transicion",
  "recup_1",
  "fecha_retorno_entrenamiento",
  "recup_2",
  "fecha_alta",
  "recuperacion",
  "severidad",
  "recurrencia",
  "recidiva",
]);

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

// Barras horizontales: [{ clave, etiqueta, valor, detalle?, color? }].
const Barras = ({ filas, maximo = null, color = "#16a34a", vacio }) => {
  if (!filas.length) return <p className="vacio-ficha">{vacio}</p>;
  const tope = maximo || Math.max(...filas.map((fila) => fila.valor), 1);
  return (
    <ul className="reporte-barras">
      {filas.map((fila) => (
        <li key={fila.clave}>
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
const BarrasPorMes = ({ meses, textoSeveridad, idioma }) => {
  const tope = Math.max(...meses.map((mes) => mes.total), 1);
  const nombreDelMes = (mes) => new Date(`${mes}-15T12:00:00`).toLocaleDateString(idioma, { month: "short", year: meses.length > 12 ? "2-digit" : undefined });
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

// El mapa corporal: el cuerpo de frente y de espaldas con una mancha de
// calor donde hubo lesiones y el nombre de lo lesionado (el músculo, el
// tendón, el ligamento o la parte del cuerpo). El mismo en el individual y
// en el grupal (ahí, con los nombres de los lugares con más lesiones).
const NOMBRES_EN_EL_GRUPAL = 6;
const MapaCorporal = ({ lesiones, mapa, textoDeOpcion, maxNombres = Infinity }) => (
  <div className="reporte-mapa">
    <CuerpoConCalor
      manchas={manchasDe(lesiones, mapa)}
      nombreDe={(mancha) => textoDeOpcion(mancha.campo, mancha.codigo)}
      maxNombres={maxNombres}
      vistas={{ frente: t("lesiones.reportes.vistas.frente"), espalda: t("lesiones.reportes.vistas.espalda") }}
      titulo={t("lesiones.reportes.mapaCorporal")}
    />
    <p className="reporte-mapa-nota">
      <i aria-hidden="true" />
      {t("lesiones.reportes.mapaNota")}
    </p>
  </div>
);

// Un número del cuadro cada 1000 horas en el individual: el del jugador, la
// referencia (el VR del plantel) y cómo da contra ella (la fila "Jugador vs
// VR" del Excel: el porcentaje y el color de la leyenda).
const Indicador = ({ titulo, valor, unidad, referencia, comparado, porcentaje, tono }) => (
  <div className={`informe-indicador ${tono}`.trim()}>
    <span className="informe-indicador-titulo">{titulo}</span>
    <b className="informe-indicador-valor">{valor}</b>
    <span className="informe-indicador-unidad">{unidad}</span>
    <span className="informe-indicador-ref">
      {t("lesiones.reportes.referencia")}
      <b>{referencia}</b>
    </span>
    {comparado && (
      <span className="informe-indicador-contra">
        <span>{comparado}</span>
        <small>{porcentaje}</small>
      </span>
    )}
  </div>
);

// La foto del jugador (la de Datos básicos). Si tiene un fondo liso y claro
// (las del club) se le saca y el jugador queda parado sobre la cabecera
// negra; si no se puede (otra clase de foto, o un sitio que no deja leerla),
// va entera en un panel cortado en diagonal; si no hay o no carga, sus
// iniciales.
const ALTO_PARA_RECORTAR = 640;
const FotoDelJugador = ({ jugador }) => {
  const url = jugador.foto_url || "";
  const [estado, setEstado] = useState({ url, como: url ? "cargando" : "iniciales", recorte: "" });
  useEffect(() => {
    setEstado({ url, como: url ? "cargando" : "iniciales", recorte: "" });
    if (!url) return undefined;
    let vigente = true;
    const terminar = (como, recorte = "") => vigente && setEstado({ url, como, recorte });
    const imagen = new Image();
    imagen.crossOrigin = "anonymous";
    imagen.onload = () => {
      try {
        const escala = Math.min(1, ALTO_PARA_RECORTAR / imagen.naturalHeight);
        const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
        const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));
        const lienzo = document.createElement("canvas");
        lienzo.width = ancho;
        lienzo.height = alto;
        const contexto = lienzo.getContext("2d");
        if (!contexto) return terminar("panel");
        contexto.drawImage(imagen, 0, 0, ancho, alto);
        const puntos = contexto.getImageData(0, 0, ancho, alto);
        if (!sacarFondo(puntos.data, ancho, alto)) return terminar("panel");
        contexto.putImageData(puntos, 0, 0);
        return terminar("recorte", lienzo.toDataURL("image/png"));
      } catch {
        // Un sitio que no deja leer sus fotos: va entera.
        return terminar("panel");
      }
    };
    imagen.onerror = () => terminar("panel");
    imagen.src = url;
    return () => {
      vigente = false;
    };
  }, [url]);
  const como = estado.url === url ? estado.como : url ? "cargando" : "iniciales";
  if (como === "recorte") {
    return (
      <div className="informe-recorte">
        <img src={estado.recorte} alt="" />
      </div>
    );
  }
  if (como === "cargando") return <div className="informe-recorte" />;
  const iniciales = String(jugador.nombre || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0])
    .join("")
    .toUpperCase();
  const conFoto = como === "panel";
  return (
    <div className={`informe-foto ${conFoto ? "" : "sin-foto"}`.trim()}>
      {conFoto ? <img src={url} alt="" onError={() => setEstado({ url, como: "iniciales", recorte: "" })} /> : <span className="informe-iniciales">{iniciales}</span>}
    </div>
  );
};

// ------------------------------------------------------------- Reportes --

export default function ReportesLesiones({
  lesiones,
  plantel,
  equipo,
  mapa,
  hoy,
  etiqueta,
  etiquetaDeGrupo = (grupo) => grupo,
  textoDeOpcion,
  enPantalla,
  camposVisibles,
  gps = null,
  estado = null,
  datosListos = true,
  onAviso = null,
}) {
  const { idioma, plural } = useIdioma();
  const [modo, setModo] = useState("menu");
  const [jugadorId, setJugadorId] = useState("");
  const [busqueda, setBusqueda] = useState("");
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
  // Qué lesiones entran en el cuadro y cuáles son las LM, dicho con las
  // opciones del club (Santiago, 05/10: que se aclare cuáles van).
  const criterio = ["producto", "cuando", "localizacion"].map((clave) => `${etiqueta(clave)}: ${REGLAS_INCIDENCIA[clave].map((codigo) => texto(clave, codigo)).join(", ")}`).join(" · ");
  const queCuenta = [
    t("lesiones.reportes.cuentan", { criterio }),
    t("lesiones.reportes.cuentanLm", { lm: t("lesiones.reportes.tiposLM"), tipos: enLista(REGLAS_INCIDENCIA.tiposMusculares.map((codigo) => texto("tipo_lesion", codigo))) }),
  ].join(" ");

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
        {datosListos && (modo === "grupal" || modo === "cadaMil" || modo === "graficos" || jugador) && (
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
          {estado}
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{t("lesiones.reportes.ver")}</b>
            </div>
            {tarjeta("individual", "usuario", t("lesiones.reportes.individual"), t("lesiones.reportes.individualTexto"))}
            {tarjeta("grupal", "formacion", t("lesiones.reportes.grupal"), t("lesiones.reportes.grupalTexto"))}
            {tarjeta("cadaMil", "grafico", t("lesiones.cadaMil.opcion"), t("lesiones.cadaMil.opcionTexto"))}
            {tarjeta("graficos", "torta", t("lesiones.graficos.opcion"), t("lesiones.graficos.opcionTexto"))}
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

  // Mientras se cargan las lesiones, o si no se pudieron leer, ningún
  // reporte: solo el aviso.
  if (!datosListos) {
    return (
      <div className="app reporte">
        <div className="contenedor contenedor-base">
          {acciones}
          {estado}
        </div>
      </div>
    );
  }

  // ------------------------------------- Lesiones c/1000h y días perdidos --
  if (modo === "cadaMil") {
    return <ReporteCadaMil lesiones={lesiones} gps={gps} hoy={hoy} equipo={equipo} acciones={acciones} estado={estado} numero={numero} queCuenta={queCuenta} onAviso={onAviso} />;
  }

  // ---------------------------------------------------- Informes gráficos --
  if (modo === "graficos") {
    return (
      <ReporteGraficos
        lesiones={lesiones}
        plantel={plantel}
        gps={gps}
        hoy={hoy}
        equipo={equipo}
        acciones={acciones}
        estado={estado}
        numero={numero}
        queCuenta={queCuenta}
        etiqueta={etiqueta}
        textoDeOpcion={texto}
        onIrA={setModo}
      />
    );
  }

  // --------------------------------------------------------- Individual --
  if (modo === "individual") {
    if (!jugador) {
      const buscado = normalizarTexto(busqueda);
      const cuantasDe = (uno) => lesiones.filter((lesion) => tieneFecha(lesion) && String(lesion.jugador_id) === String(uno.id)).length;
      // El plantel actual primero; de los que se fueron, los que tienen
      // lesiones (su informe sigue valiendo como historia), marcados.
      const lista = actualesPrimero(plantel).filter((uno) => (esActual(uno) || cuantasDe(uno) > 0) && (!buscado || normalizarTexto(uno.nombre).includes(buscado)));
      return (
        <div className="app reporte">
          <div className="contenedor contenedor-base">
            {acciones}
            {estado}
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
                      <span>{[plural("lesiones.historial.cantidad", cuantasDe(uno)), esActual(uno) ? "" : t("datos.yaNoEsta")].filter(Boolean).join(" · ")}</span>
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
    // Sus lesiones con fecha de inicio (las que no tienen todavía no cuentan).
    const deJugador = lesiones.filter((lesion) => tieneFecha(lesion) && String(lesion.jugador_id) === String(jugador.id));
    // Sus horas: las del GPS más las previas (las de entrenamiento de antes de
    // que llegara el cuerpo técnico, de Datos básicos). En el Excel la columna
    // A se suma a los minutos sin pasarla a minutos, así que casi no cuenta;
    // acá cuentan como lo que son, horas de entrenamiento (Santiago, 03/10).
    const minutosDelJugador = gps ? minutosGps(gps, { jugadorId: jugador.id }) + (jugador.horas_previas || 0) * 60 : 0;
    const delJugador = cuadroCadaMil(deJugador, minutosDelJugador, { hasta: hoy });
    const delPlantel = cuadroCadaMil(lesiones, minutosGps(gps, { hasta: hoy }), { hasta: hoy });
    // Cada medida, una fila de cuatro números (las columnas del Excel): el
    // del jugador, la referencia y el "Jugador vs VR".
    const indicadoresDe = (medida) =>
      delJugador.map((fila, indice) => {
        const referencia = delPlantel[indice][medida.id];
        const tono = tonoContraVR(fila[medida.id], referencia);
        const contra = contraVR(fila[medida.id], referencia);
        return {
          id: VARIANTES[indice].id,
          titulo: tituloDeVariante(VARIANTES[indice]),
          valor: numero(fila[medida.id]),
          unidad: medida.unidad,
          referencia: numero(referencia),
          tono,
          comparado: contra && t(`lesiones.reportes.comparado.${tono || "igual"}`),
          porcentaje: contra && t("lesiones.reportes.porcentajeVsRef", { valor: contra.signo ? `${contra.signo}${numero(contra.porcentaje, 1)}%` : "0%" }),
        };
      });
    const MEDIDAS = [
      { id: "lesionesCadaMil", titulo: t("lesiones.reportes.lesionesPorMil"), unidad: t("lesiones.reportes.unidadLesiones") },
      { id: "diasCadaMil", titulo: t("lesiones.reportes.diasPorMil"), unidad: t("lesiones.reportes.unidadDias") },
    ];

    const posicion = jugador.posicion ? texto("posicion", jugador.posicion) : "";
    const datosDelJugador = [
      { clave: "nacimiento", rotulo: t("lesiones.reportes.nacimiento"), valor: esFechaISO(jugador.fecha_nacimiento) ? fechaCorta(jugador.fecha_nacimiento) : "—" },
      { clave: "pie", rotulo: t("lesiones.reportes.pie"), valor: jugador.pie_dominante ? texto("pie_dominante", jugador.pie_dominante) : "—" },
    ];

    // La tabla: todas sus lesiones, por n° de registro, con todas las columnas
    // que el club tiene a la vista, en tramos (una tabla por tramo). Cada
    // grupo con su tono, el mismo que en la base.
    const conCampo = camposVisibles.filter((campo) => CAMPO_POR_CLAVE[campo.clave]);
    const tramos = tramosDeLaTabla(conCampo);
    const tonoDeGrupo = tonosDeGrupos(conCampo);
    const tono = (grupo) => `tono-${tonoDeGrupo[grupo] ?? 0}`;
    const claseDeColumna = (clave, ...otras) => [clave === tramos[0]?.id ? "informe-id" : "", COLUMNAS_CORTAS.has(clave) ? "informe-corta" : "", ...otras].filter(Boolean).join(" ") || undefined;
    // El n° de registro va adelante en las dos tablas, fuera de los grupos y
    // fijo al deslizar.
    const registro = (lesion) => calcular("numero_registro", lesion, null, { lesiones }) ?? 0;
    const ordenadas = [...deJugador].sort((a, b) => registro(a) - registro(b) || String(a.fecha_lesion).localeCompare(String(b.fecha_lesion)));
    // Las opciones del club que vienen pegadas con barras (ENTORSE/LESÃO
    // LIGAMENTAR) se pueden partir después de cada barra (sin agregar nada al
    // texto: se copia igual). Las fechas y lo corto, no.
    const celda = (clave, lesion) => {
      const valor = enPantalla(CAMPO_POR_CLAVE[clave], lesion);
      if (valor === "" || valor === null || valor === undefined) return <span className="informe-vacio">—</span>;
      if (clave === "severidad") return <span className="informe-severidad">{valor}</span>;
      if (typeof valor !== "string" || COLUMNAS_CORTAS.has(clave) || !valor.includes("/")) return valor;
      return partirDespuesDeBarras(valor).map((pedazo, indice) => (
        <React.Fragment key={indice}>
          {indice > 0 && <wbr />}
          {pedazo}
        </React.Fragment>
      ));
    };

    return (
      <div className="app reporte">
        <div className="contenedor contenedor-base">
          {acciones}
          {estado}
          <article className="informe">
            <header className="informe-cabecera">
              <div className="informe-marca-agua" aria-hidden="true">
                <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
              </div>
              <div className="informe-escudo">
                <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
              </div>
              <div className="informe-identidad">
                <p className="informe-subtitulo">{t("lesiones.reportes.individualTitulo")}</p>
                <h1>{jugador.nombre}</h1>
                {posicion && <p className="informe-posicion">{posicion}</p>}
                <dl className="informe-datos">
                  {datosDelJugador.map((dato) => (
                    <div className="informe-dato" key={dato.clave}>
                      <dt>{dato.rotulo}</dt>
                      <dd>{dato.valor}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <FotoDelJugador jugador={jugador} />
            </header>

            <div className="informe-medio">
              <section className="informe-indicadores" aria-label={t("lesiones.reportes.indicadores")}>
                {MEDIDAS.map((medida, cual) => (
                  <div className="informe-medida" key={medida.id}>
                    <div className="informe-seccion">
                      <h2>
                        {medida.titulo} <span className="informe-por-mil">{t("lesiones.reportes.porMil")}</span>
                      </h2>
                      {cual === 0 && <span>{t("lesiones.reportes.tasas")}</span>}
                    </div>
                    <div className="informe-tarjetas">
                      {indicadoresDe(medida).map((indicador) => (
                        <Indicador key={indicador.id} {...indicador} />
                      ))}
                    </div>
                  </div>
                ))}
                {!gps && <p className="informe-aviso">{t("lesiones.reportes.faltaGps")}</p>}
                <ul className="informe-leyenda">
                  <li>
                    <i className="peor" />
                    {t("lesiones.reportes.superiorRef")}
                  </li>
                  <li>
                    <i className="mejor" />
                    {t("lesiones.reportes.inferiorRef")}
                  </li>
                  <li>{t("lesiones.reportes.queEsRef")}</li>
                </ul>
                <p className="informe-criterio">{queCuenta}</p>
              </section>

              <section className="informe-mapa">
                <div className="informe-seccion">
                  <h2>{t("lesiones.reportes.mapaCorporal")}</h2>
                </div>
                <MapaCorporal lesiones={deJugador} mapa={mapa} textoDeOpcion={texto} />
              </section>
            </div>

            <section className="informe-lesiones">
              <div className="informe-seccion">
                <h2>{t("lesiones.reportes.historialLesiones")}</h2>
                <span>{plural("lesiones.reportes.registros", deJugador.length)}</span>
              </div>
              {deJugador.length === 0 ? (
                <p className="vacio-ficha">{t("lesiones.reportes.sinLesionesJugador")}</p>
              ) : (
                tramos.map((tramo, indice) => {
                  const columnas = tramo.grupos.flatMap((grupo) => grupo.columnas.map((clave) => ({ clave, grupo: grupo.clave })));
                  return (
                    <div className="informe-tabla-marco" key={indice}>
                      <table className="informe-tabla" style={{ "--columnas": columnas.length + (tramo.id ? 1 : 0) }}>
                        <thead>
                          <tr className="informe-grupos">
                            {tramo.id && (
                              <th scope="col" rowSpan={2} className={claseDeColumna(tramo.id)} data-columna={tramo.id}>
                                {etiqueta(tramo.id)}
                              </th>
                            )}
                            {tramo.grupos.map((grupo) => (
                              <th scope="colgroup" colSpan={grupo.columnas.length} key={grupo.clave} className={tono(grupo.clave)} data-grupo={grupo.clave}>
                                <span className="informe-grupo-titulo">{etiquetaDeGrupo(grupo.clave)}</span>
                              </th>
                            ))}
                          </tr>
                          <tr className="informe-cabeceras">
                            {columnas.map(({ clave, grupo }) => (
                              <th scope="col" key={clave} className={claseDeColumna(clave, tono(grupo))} data-columna={clave}>
                                {etiqueta(clave)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ordenadas.map((lesion) => (
                            <tr key={lesion.id}>
                              {tramo.id && (
                                <td className={claseDeColumna(tramo.id)} data-columna={tramo.id}>
                                  {celda(tramo.id, lesion)}
                                </td>
                              )}
                              {columnas.map(({ clave }) => (
                                <td key={clave} className={claseDeColumna(clave)} data-columna={clave}>
                                  {celda(clave, lesion)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </section>

            <footer className="informe-pie">
              <span>{[equipo?.nombre, t("lesiones.reportes.individual")].filter(Boolean).join(" · ")}</span>
              <span>{fechaCorta(hoy)}</span>
            </footer>
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
      contarPor(delEquipo, (lesion) => lesion.datos?.[clave], hoy).map((fila) => ({ clave: fila.valor, etiqueta: texto(clave, fila.valor), valor: fila.cantidad, detalle: plural("lesiones.dias", fila.dias) }));
    // Por jugador, y también quien no está en Datos básicos (con su nombre).
    const nombreDeQuien = nombresDeQuien(delEquipo, plantel);
    const porJugador = contarPor(delEquipo, claveDeQuien, hoy)
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 10)
      .map((fila) => ({ clave: fila.valor, etiqueta: nombreDeQuien.get(fila.valor) || "—", valor: fila.dias, detalle: plural("lesiones.historial.cantidad", fila.cantidad) }));
    const porPosicion = contarPor(delEquipo, (lesion) => plantel.find((uno) => String(uno.id) === String(lesion.jugador_id))?.posicion, hoy).map((fila) => ({
      clave: fila.valor,
      etiqueta: texto("posicion", fila.valor),
      valor: fila.cantidad,
      detalle: plural("lesiones.dias", fila.dias),
    }));
    const porSeveridad = ORDEN_SEVERIDAD.map((clave) => ({
      clave,
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
          {estado}
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
              <p className="informe-criterio">{queCuenta}</p>
            </div>,
          )}

          {bloque(t("lesiones.reportes.porMes"), <BarrasPorMes meses={porMes(delEquipo, desde, hasta)} textoSeveridad={textoSeveridad} idioma={idioma} />)}

          <section className="reporte-dos">
            {bloque(t("lesiones.reportes.dondeSeLesionan"), <MapaCorporal lesiones={delEquipo} mapa={mapa} textoDeOpcion={texto} maxNombres={NOMBRES_EN_EL_GRUPAL} />)}
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
