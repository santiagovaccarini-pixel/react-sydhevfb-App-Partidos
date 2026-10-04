import React, { useEffect, useMemo, useRef, useState } from "react";
import { EscudoDeClub } from "./components/ClubCrest";
import { HojaDeFiltro, elegidosAlAbrir } from "./components/ListaParaMarcar.jsx";
import { BarrasApiladas, Columnas, Torta, coloresDeSeries } from "./components/GraficosReporte.jsx";
import { tituloDeVariante } from "./components/CuadroCadaMil.jsx";
import { listarPeriodos } from "./domain/periodosDb.js";
import { OPCIONES } from "./domain/lesionesCampos.js";
import {
  REGLAS_GRAFICOS,
  VARIANTES,
  aniosDeMomentos,
  aniosDePeriodos,
  cuantasPorValor,
  elegidosDelFiltro,
  graficosPorPeriodo,
  lesionesPorJugador,
  momentosPorParte,
  nombresDeQuien,
  opcionesDeFiltro,
  ordenarPorEtiqueta,
  serieCadaMil,
  tortaPorParte,
} from "./domain/reportes.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// "Informes gráficos": la hoja "Informes Graficos" del Excel, los reportes
// del plantel que no son de un jugador. Cinco bloques:
//   1 y 2. Lesiones y días perdidos c/1000 h de los períodos guardados (en
//      "Lesiones c/1000h y días perdidos"), los cuatro gráficos de cada uno
//      (severidad todas o sin leves, tipos todos o solo LM), con el filtro
//      del año. Sin los minutos del GPS, las lesiones y los días, sin barras.
//   3. Partes del cuerpo: una torta por cada producto (no traumáticas y
//      traumáticas), con los filtros del Excel.
//   4. Lesiones por jugador, apiladas por parte del cuerpo.
//   5. Entrenamiento y partidos: cuándo, por parte del cuerpo, del año.
// Qué cuenta cada uno está en REGLAS_GRAFICOS (domain/reportes.js).
//
// numero: cómo se escriben los números; criterio: qué lesiones cuentan en
// los bloques 1 y 2, en palabras del club; etiqueta(campo) y
// textoDeOpcion(campo, código): los textos del club; onIrA(modo): ir a otro
// reporte (para guardar períodos).

const BLOQUES = ["lesiones", "dias", "partes", "jugador", "momentos"];

export default function ReporteGraficos({ lesiones, plantel, gps, hoy, equipo, acciones, estado, numero, criterio, etiqueta, textoDeOpcion, onIrA }) {
  const { idioma, plural } = useIdioma();
  const equipoId = equipo?.id || null;
  const soloLectura = Boolean(equipo?.hasta);
  const [periodos, setPeriodos] = useState([]);
  const [errorPeriodos, setErrorPeriodos] = useState("");
  const [cargandoPeriodos, setCargandoPeriodos] = useState(true);
  // El año de cada bloque (null: todos), como los filtros AÑO del Excel.
  const [anioLesiones, setAnioLesiones] = useState(null);
  const [anioDias, setAnioDias] = useState(null);
  const [anioMomentos, setAnioMomentos] = useState(undefined);
  // Los filtros de cada bloque: { campo: [valores] } (sin ninguno, todos),
  // como las segmentaciones del Excel: se marcan varios.
  const [filtros, setFiltros] = useState({ partes: {}, jugador: {}, momentos: {} });
  const [hoja, setHoja] = useState(null); // { bloque, campo, elegidos, busqueda }
  const lugares = useRef({});

  useEffect(() => {
    let vigente = true;
    listarPeriodos(equipoId).then((respuesta) => {
      if (!vigente) return;
      setPeriodos(respuesta.periodos);
      setErrorPeriodos(respuesta.error);
      setCargandoPeriodos(false);
    });
    return () => {
      vigente = false;
    };
  }, [equipoId]);

  // La posición sale del plantel (en el Excel, de Datos Básicos).
  const posicionDe = (lesion) => plantel.find((uno) => String(uno.id) === String(lesion.jugador_id))?.posicion || null;
  const nombres = useMemo(() => nombresDeQuien(lesiones, plantel), [lesiones, plantel]);
  const textoDe = (campo, valor) => {
    if (valor === "" || valor === null || valor === undefined) return t("lesiones.graficos.sinDato");
    if (campo === "jugador") return nombres.get(valor) || "—";
    return textoDeOpcion(campo, valor);
  };
  const tituloDeCampo = (campo) => etiqueta(campo);
  const { series: campoSeries } = REGLAS_GRAFICOS.momentos;

  // Un color por parte del cuerpo, igual en todos los gráficos, con cualquier
  // filtro, en los dos idiomas y aunque aparezca una parte nueva: va por el
  // catálogo (los códigos) de abajo para arriba, así las de las piernas, las
  // más comunes, toman los primeros colores; las que agregó el club, después.
  const colorDe = useMemo(() => {
    const catalogo = (OPCIONES[campoSeries] || []).map((opcion) => opcion.codigo).reverse();
    const otras = opcionesDeFiltro(lesiones, campoSeries)
      .filter((valor) => !catalogo.includes(valor))
      .sort();
    return coloresDeSeries([...catalogo, ...otras, ""]);
  }, [lesiones, campoSeries]);
  const seriesDe = (valores) =>
    ordenarPorEtiqueta([...new Set(valores)].map((valor) => ({ valor })), (valor) => textoDe(campoSeries, valor), idioma).map(({ valor }) => ({
      clave: valor,
      etiqueta: textoDe(campoSeries, valor),
      color: colorDe(valor),
    }));

  // El año del bloque 5 (lo usan su gráfico y las listas de sus filtros).
  // Como el Excel: el de hoy si tiene lesiones; si no, el último.
  const aniosMomentos = aniosDeMomentos(lesiones, { posicionDe });
  const anioDeHoy = Number(String(hoy || "").slice(0, 4));
  const anioMomentosElegido = anioMomentos !== undefined ? anioMomentos : aniosMomentos.includes(anioDeHoy) ? anioDeHoy : aniosMomentos.at(-1) ?? null;

  // ------------------------------------------------------- Filtros --
  const filtrosDe = (bloque) => filtros[bloque] || {};
  const elegidosEn = (bloque, campo) => elegidosDelFiltro(filtrosDe(bloque)[campo]);
  // Sin ninguno elegido, el campo no filtra.
  const cambiarFiltro = (bloque, campo, valores) =>
    setFiltros((antes) => {
      const delBloque = { ...antes[bloque] };
      if (valores.length) delBloque[campo] = valores;
      else delete delBloque[campo];
      return { ...antes, [bloque]: delBloque };
    });
  // En el botón: "Todos", el elegido o cuántos; impreso, todos los elegidos.
  const textoDelFiltro = (bloque, campo, { completo = false } = {}) => {
    const valores = elegidosEn(bloque, campo);
    if (!valores.length) return t("lesiones.graficos.todos");
    if (valores.length === 1 || completo) return valores.map((valor) => textoDe(campo, valor)).join(", ");
    return plural("lesiones.graficos.elegidos", valores.length);
  };
  // Lo que ofrece la lista de un filtro: los valores de las lesiones que
  // cuenta su gráfico (con el año del bloque 5) y que dejan pasar los otros
  // filtros del bloque, con cuántas tiene cada uno (también "Sin dato").
  const valoresDelFiltro = (bloque, campo) => {
    const cuantas = cuantasPorValor(lesiones, campo, { bloque, anio: bloque === "momentos" ? anioMomentosElegido : null, filtros: filtrosDe(bloque), posicionDe });
    return ordenarPorEtiqueta(
      Object.keys(cuantas).map((valor) => ({ valor })),
      (valor) => textoDe(campo, valor),
      idioma,
    ).map(({ valor }) => ({ clave: valor, texto: valor === "" ? "" : textoDe(campo, valor), cantidad: cuantas[valor] }));
  };
  const abrirFiltro = (bloque, campo) =>
    setHoja({ bloque, campo, elegidos: elegidosAlAbrir(elegidosEn(bloque, campo), valoresDelFiltro(bloque, campo)), busqueda: "" });
  const valoresDeLaHoja = hoja ? valoresDelFiltro(hoja.bloque, hoja.campo) : [];
  // marcados: null con todo marcado (no filtra).
  const aplicarFiltro = (marcados) => {
    const actual = hoja;
    setHoja(null);
    if (actual) cambiarFiltro(actual.bloque, actual.campo, marcados || []);
  };
  const quitarFiltro = () => {
    const actual = hoja;
    setHoja(null);
    if (actual) cambiarFiltro(actual.bloque, actual.campo, []);
  };
  const lineaDeFiltros = (bloque, campos) => (
    <div className="grilla-criterios reporte-graficos-filtros no-imprimir" role="group" aria-label={t("lesiones.graficos.filtros")}>
      {campos.map((campo) => (
        <button
          type="button"
          key={campo}
          className={`chip-criterio ${elegidosEn(bloque, campo).length ? "prendido" : ""}`}
          aria-pressed={elegidosEn(bloque, campo).length > 0}
          aria-haspopup="dialog"
          onClick={() => abrirFiltro(bloque, campo)}
        >
          {t("lesiones.graficos.filtro", { campo: tituloDeCampo(campo), valor: textoDelFiltro(bloque, campo) })}
        </button>
      ))}
    </div>
  );
  // Lo elegido, también en lo impreso (con todos los nombres).
  const elegidos = (bloque, campos, anio) =>
    [
      anio !== undefined ? (anio === null ? t("lesiones.graficos.todosLosAnios") : String(anio)) : "",
      ...campos
        .filter((campo) => elegidosEn(bloque, campo).length)
        .map((campo) => t("lesiones.graficos.filtro", { campo: tituloDeCampo(campo), valor: textoDelFiltro(bloque, campo, { completo: true }) })),
    ]
      .filter(Boolean)
      .join(" · ");

  const chipsDeAnios = (anios, elegido, elegir) => (
    <div className="grilla-criterios reporte-graficos-filtros no-imprimir" role="group" aria-label={t("lesiones.graficos.anio")}>
      {[null, ...anios].map((anio) => (
        <button type="button" key={anio ?? "todos"} className={`chip-criterio ${elegido === anio ? "prendido" : ""}`} aria-pressed={elegido === anio} onClick={() => elegir(anio)}>
          {anio === null ? t("lesiones.graficos.todosLosAnios") : anio}
        </button>
      ))}
    </div>
  );

  const bloque = (id, titulo, filtrado, contenido) => (
    <section
      className="reporte-graficos-bloque"
      key={id}
      ref={(nodo) => {
        lugares.current[id] = nodo;
      }}
      aria-label={titulo}
    >
      <div className="reporte-graficos-cabeza">
        <h2>{titulo}</h2>
        {filtrado && <small className="reporte-graficos-filtrado">{filtrado}</small>}
      </div>
      {contenido}
    </section>
  );
  const tarjeta = (titulo, contenido, clave = titulo, clase = "") => (
    <section className={`tarjeta tarjeta-ficha ${clase}`.trim()} key={clave}>
      <div className="cabeza-ficha">
        <b>{titulo}</b>
      </div>
      {contenido}
    </section>
  );

  // -------------------------------------------- Bloques 1 y 2 --
  const aniosPeriodos = aniosDePeriodos(periodos);
  const bloqueCadaMil = (id, medida, anio, elegirAnio) => {
    const porPeriodo = graficosPorPeriodo(lesiones, gps, periodos, { anio });
    const detalle = (cantidad) => (medida === "dias" ? plural("lesiones.dias", cantidad) : plural("lesiones.historial.cantidad", cantidad));
    let contenido;
    if (cargandoPeriodos) contenido = <p className="vacio-ficha">{t("comun.cargando")}</p>;
    else if (errorPeriodos) contenido = <div className="lesiones-estado error">{t(errorPeriodos)}</div>;
    else if (!periodos.length)
      contenido = (
        <div className="reporte-graficos-sin-periodos">
          <p className="vacio-ficha">{t("lesiones.graficos.sinPeriodos")}</p>
          {!soloLectura && (
            <button type="button" className="boton-secundario no-imprimir" onClick={() => onIrA?.("cadaMil")}>
              {t("lesiones.graficos.irAPeriodos")}
            </button>
          )}
        </div>
      );
    else
      contenido = (
        <>
          {chipsDeAnios(aniosPeriodos, anio, elegirAnio)}
          {porPeriodo.length === 0 ? (
            <p className="vacio-ficha">{t("lesiones.graficos.sinPeriodosDelAnio", { anio })}</p>
          ) : (
            <div className="reporte-graficos-cuatro">
              {VARIANTES.map((variante) =>
                tarjeta(
                  tituloDeVariante(variante),
                  <Columnas
                    titulo={tituloDeVariante(variante)}
                    filas={serieCadaMil(porPeriodo, variante.id, medida).map((fila) => ({
                      clave: fila.clave,
                      etiqueta: fila.etiqueta,
                      detalle: detalle(fila.detalle),
                      valores: { valor: fila.valor },
                    }))}
                    series={[{ clave: "valor", etiqueta: tituloDeVariante(variante), color: "#2a78d6" }]}
                    formato={(valor) => numero(valor)}
                  />,
                  variante.id,
                ),
              )}
            </div>
          )}
          <div className="reporte-graficos-notas">
            {!gps && <p className="informe-aviso">{t("lesiones.cadaMil.faltaGps")}</p>}
            <p className="informe-criterio">{t("lesiones.reportes.cuentan", { criterio })}</p>
            <p className="informe-criterio">{t(`lesiones.graficos.anioNota.${REGLAS_GRAFICOS.anioDelPeriodo}`)}</p>
          </div>
        </>
      );
    return bloque(id, t(`lesiones.graficos.secciones.${id}`), elegidos(id, [], anio), contenido);
  };

  // ------------------------------------------------- Bloque 3 --
  const camposTortas = REGLAS_GRAFICOS.filtros.tortas;
  const porcionesDe = (valorDeLaTorta) => {
    const filas = tortaPorParte(lesiones, valorDeLaTorta, { filtros: filtrosDe("partes"), posicionDe });
    return ordenarPorEtiqueta(filas, (valor) => textoDe(REGLAS_GRAFICOS.tortas.porcion, valor), idioma).map((fila) => ({
      clave: fila.valor,
      etiqueta: textoDe(REGLAS_GRAFICOS.tortas.porcion, fila.valor),
      valor: fila.cantidad,
      porcentaje: fila.porcentaje,
      color: colorDe(fila.valor),
      detalle: plural("lesiones.historial.cantidad", fila.cantidad),
    }));
  };
  const bloqueTortas = bloque(
    "partes",
    t("lesiones.graficos.secciones.partes"),
    elegidos("partes", camposTortas),
    <>
      {lineaDeFiltros("partes", camposTortas)}
      <div className="reporte-dos">
        {REGLAS_GRAFICOS.tortas.valores.map((valor) =>
          tarjeta(textoDeOpcion(REGLAS_GRAFICOS.tortas.campo, valor), <Torta titulo={textoDeOpcion(REGLAS_GRAFICOS.tortas.campo, valor)} porciones={porcionesDe(valor)} vacio={t("lesiones.graficos.sinLesiones")} />, valor),
        )}
      </div>
      <div className="reporte-graficos-notas">
        <p className="informe-criterio">{t("lesiones.graficos.cuentanTodas", { campo: etiqueta(REGLAS_GRAFICOS.campoContado) })}</p>
      </div>
    </>,
  );

  // ------------------------------------------------- Bloque 4 --
  const camposJugador = REGLAS_GRAFICOS.filtros.porJugador;
  const porJugador = lesionesPorJugador(lesiones, { filtros: filtrosDe("jugador"), posicionDe });
  const filasJugador = ordenarPorEtiqueta(porJugador, (valor) => textoDe("jugador", valor), idioma).map((fila) => ({
    clave: fila.valor,
    etiqueta: textoDe("jugador", fila.valor),
    total: fila.total,
    valores: fila.porSerie,
  }));
  const bloqueJugador = bloque(
    "jugador",
    t("lesiones.graficos.secciones.jugador"),
    elegidos("jugador", camposJugador),
    <>
      {lineaDeFiltros("jugador", camposJugador)}
      {/* Puede ser más alta que una hoja: impresa, se corta entre jugadores. */}
      {tarjeta(
        etiqueta(REGLAS_GRAFICOS.porJugador.series),
        <BarrasApiladas filas={filasJugador} series={seriesDe(porJugador.flatMap((fila) => Object.keys(fila.porSerie)))} vacio={t("lesiones.graficos.sinLesiones")} />,
        "jugador",
        "reporte-graficos-larga",
      )}
      <div className="reporte-graficos-notas">
        <p className="informe-criterio">
          {REGLAS_GRAFICOS.porJugador.vaciaCuenta
            ? t("lesiones.graficos.cuentanTodas", { campo: etiqueta(REGLAS_GRAFICOS.campoContado) })
            : t("lesiones.graficos.cuentanConSerie", { contado: etiqueta(REGLAS_GRAFICOS.campoContado), campo: etiqueta(REGLAS_GRAFICOS.porJugador.series) })}
        </p>
      </div>
    </>,
  );

  // ------------------------------------------------- Bloque 5 --
  const camposMomentos = REGLAS_GRAFICOS.filtros.momentos;
  const momentos = momentosPorParte(lesiones, { anio: anioMomentosElegido, filtros: filtrosDe("momentos"), posicionDe });
  const { categoria } = REGLAS_GRAFICOS.momentos;
  const seriesMomentos = seriesDe(momentos.flatMap((fila) => Object.keys(fila.porSerie)));
  const filasMomentos = ordenarPorEtiqueta(momentos, (valor) => textoDe(categoria, valor), idioma).map((fila) => ({
    clave: fila.valor,
    etiqueta: textoDe(categoria, fila.valor),
    detalle: plural("lesiones.historial.cantidad", fila.total),
    // Una parte sin lesiones en ese momento no lleva columna (ni una raya en cero).
    valores: Object.fromEntries(seriesMomentos.map((serie) => [serie.clave, fila.porSerie[serie.clave] || null])),
  }));
  const tituloMomentos = anioMomentosElegido === null ? t("lesiones.graficos.todosLosAnios") : String(anioMomentosElegido);
  const bloqueMomentos = bloque(
    "momentos",
    t("lesiones.graficos.secciones.momentos"),
    elegidos("momentos", camposMomentos, anioMomentosElegido),
    <>
      {chipsDeAnios(aniosMomentos, anioMomentosElegido, setAnioMomentos)}
      {lineaDeFiltros("momentos", camposMomentos)}
      {tarjeta(tituloMomentos, <Columnas titulo={tituloMomentos} filas={filasMomentos} series={seriesMomentos} formato={(valor) => (valor ? String(valor) : "")} vacio={t("lesiones.graficos.sinLesiones")} leyenda />)}
      <div className="reporte-graficos-notas">
        <p className="informe-criterio">{t("lesiones.graficos.cuentanMomentos", { campo: etiqueta(categoria), contado: etiqueta(REGLAS_GRAFICOS.campoContado) })}</p>
      </div>
    </>,
  );

  return (
    <div className="app reporte">
      <div className="contenedor contenedor-base">
        {acciones}
        {estado}
        <header className="reporte-portada">
          <div className="reporte-portada-club">
            <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
            <div>
              <span>{t("lesiones.graficos.titulo")}</span>
              <b>{equipo?.nombre || ""}</b>
              <small>{t("lesiones.graficos.alDia", { fecha: fechaCorta(hoy) })}</small>
            </div>
          </div>
        </header>

        <nav className="grilla-criterios reporte-graficos-nav no-imprimir" aria-label={t("lesiones.graficos.ir")}>
          {BLOQUES.map((id) => (
            <button type="button" key={id} className="chip-criterio" onClick={() => lugares.current[id]?.scrollIntoView?.({ behavior: "smooth", block: "start" })}>
              {t(`lesiones.graficos.secciones.${id}`)}
            </button>
          ))}
        </nav>

        {bloqueCadaMil("lesiones", "lesiones", anioLesiones, setAnioLesiones)}
        {bloqueCadaMil("dias", "dias", anioDias, setAnioDias)}
        {bloqueTortas}
        {bloqueJugador}
        {bloqueMomentos}
      </div>

      {/* El filtro: se marcan varios, como en el Excel (y como el filtro de
          las columnas de la Base). */}
      <HojaDeFiltro
        abierta={Boolean(hoja)}
        className="reporte-graficos-hoja-filtro"
        columna={hoja ? tituloDeCampo(hoja.campo) : ""}
        valores={valoresDeLaHoja}
        elegidos={hoja?.elegidos || []}
        busqueda={hoja?.busqueda || ""}
        textoVacio={t("lesiones.graficos.sinDato")}
        onCambiar={(elegidos) => setHoja((actual) => ({ ...actual, elegidos }))}
        onBuscar={(busqueda) => setHoja((actual) => ({ ...actual, busqueda }))}
        onAplicar={aplicarFiltro}
        onQuitar={quitarFiltro}
        onCerrar={() => setHoja(null)}
      />
    </div>
  );
}
