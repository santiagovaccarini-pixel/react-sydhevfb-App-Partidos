import React, { useEffect, useMemo, useRef, useState } from "react";
import { EscudoDeClub } from "./components/ClubCrest";
import { Icono } from "./components/AppChrome";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaDeFiltro, elegidosAlAbrir } from "./components/ListaParaMarcar.jsx";
import { BarrasApiladas, Columnas, Torta, coloresDeSeries } from "./components/GraficosReporte.jsx";
import { tituloDeVariante } from "./components/CuadroCadaMil.jsx";
import { listarPeriodos } from "./domain/periodosDb.js";
import { OPCIONES } from "./domain/lesionesCampos.js";
import { claveDeQuien, tieneFecha } from "./domain/lesiones.js";
import { normalizarTextoBase } from "./domain/match";
import {
  REGLAS_GRAFICOS,
  VARIANTES,
  anioDelPeriodo,
  aniosDeMomentos,
  aniosDePeriodos,
  cumpleVariante,
  graficosPorPeriodo,
  lesionesDelBloque,
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
//      (severidad todas o sin leves, tipos todos o solo LM). Sin los minutos
//      del GPS, las lesiones y los días, sin barras.
//   3. Partes del cuerpo: una torta por cada producto (no traumáticas y
//      traumáticas).
//   4. Lesiones por jugador, apiladas por parte del cuerpo.
//   5. Entrenamiento y partidos: cuándo, por parte del cuerpo, del año.
// Qué cuenta cada uno está en REGLAS_GRAFICOS (domain/reportes.js).
//
// Cada gráfico tiene su filtro: un embudo arriba a la derecha que deja
// filtrarlo por cualquier cabecera de la Base de Lesiones y por el año
// (Santiago, 11/10: en lugar de los filtros de arriba de cada bloque). En los
// c/1000 h no se ofrece lo que es de la persona (nombre, posición, edad…):
// las horas son las de todo el plantel.
//
// numero: cómo se escriben los números; queCuenta: qué lesiones cuentan en
// los bloques 1 y 2 y cuáles son las LM, en palabras del club; etiqueta(campo) y
// textoDeOpcion(campo, código): los textos del club; camposVisibles y
// enPantalla(campo, lesion): las cabeceras de la Base y lo que dice cada
// celda; onIrA(modo): ir a otro reporte (para guardar períodos).

const BLOQUES = ["lesiones", "dias", "partes", "jugador", "momentos"];

// El año va en el filtro de cada gráfico como una cabecera más.
const ANIO = "__anio";

// Los gráficos: los cuatro de cada c/1000 h, una torta por producto, el de
// jugadores y el de entrenamiento y partidos.
const GRAFICOS = Object.freeze([
  ...["lesiones", "dias"].flatMap((medida) => VARIANTES.map((variante) => ({ id: `${medida}:${variante.id}`, bloque: medida, cadaMil: true, variante }))),
  ...REGLAS_GRAFICOS.tortas.valores.map((valor) => ({ id: `partes:${valor}`, bloque: "partes", valor })),
  { id: "jugador", bloque: "jugador" },
  { id: "momentos", bloque: "momentos" },
]);
const GRAFICO_POR_ID = Object.fromEntries(GRAFICOS.map((grafico) => [grafico.id, grafico]));

// Lo que es de la persona y no de la lesión.
const esDeLaPersona = (campo) => campo.tipo === "jugador" || campo.tipo === "dato_jugador" || campo.clave === "edad";
const anioDeLaLesion = (lesion) => String(lesion?.fecha_lesion || "").slice(0, 4);
// Como la lista del filtro de la Base: por cómo se lee, los números en orden.
const compararTextos = (a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

export default function ReporteGraficos({ lesiones, plantel, gps, hoy, equipo, acciones, estado, numero, queCuenta, etiqueta, textoDeOpcion, camposVisibles = [], enPantalla = () => "", onIrA }) {
  const { idioma, plural } = useIdioma();
  const equipoId = equipo?.id || null;
  const soloLectura = Boolean(equipo?.hasta);
  const [periodos, setPeriodos] = useState([]);
  const [errorPeriodos, setErrorPeriodos] = useState("");
  const [cargandoPeriodos, setCargandoPeriodos] = useState(true);
  // Los filtros de cada gráfico: { gráfico: { cabecera: [lo elegido] } }
  // (sin ninguno, todo). Se marcan varios, como en el filtro de la Base.
  const [filtros, setFiltros] = useState({});
  // El filtro abierto: { grafico, buscada } (la lista de cabeceras, con lo
  // escrito en su buscador) o, con una cabecera elegida, { grafico, campo,
  // elegidos, busqueda } (sus valores).
  const [hoja, setHoja] = useState(null);
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

  // ------------------------------------------------------- Filtros --
  const campoPorClave = useMemo(() => new Map(camposVisibles.map((campo) => [campo.clave, campo])), [camposVisibles]);
  // Las cabeceras de cada gráfico: el año y las de la Base (las que el club
  // tiene a la vista); en los c/1000 h, sin las de la persona.
  const camposDe = (grafico) => [ANIO, ...camposVisibles.filter((campo) => !grafico.cadaMil || !esDeLaPersona(campo)).map((campo) => campo.clave)];
  const tituloDeCampo = (campo) => (campo === ANIO ? t("lesiones.graficos.anio") : etiqueta(campo));
  // Las de una lista se filtran por lo cargado (como en el Excel); el jugador,
  // por quién es; la posición, por la del plantel; lo demás, por lo que dice
  // la celda de la Base.
  const porCodigo = (campo) => campo === "jugador" || campo === "posicion" || campoPorClave.get(campo)?.tipo === "lista";
  const claveDe = (campo, lesion) => {
    if (campo === ANIO) return anioDeLaLesion(lesion);
    if (campo === "jugador") return claveDeQuien(lesion) ?? "";
    if (campo === "posicion") return posicionDe(lesion) ?? "";
    const definicion = campoPorClave.get(campo);
    if (!definicion) return "";
    if (definicion.tipo === "lista") return lesion.datos?.[campo] ?? "";
    return String(enPantalla(definicion, lesion) ?? "").trim();
  };
  const textoDeClave = (campo, clave) => {
    if (clave === "" || clave === null || clave === undefined) return "";
    return porCodigo(campo) ? textoDe(campo, clave) : String(clave);
  };

  // El año de Entrenamiento y partidos, de entrada: como en el Excel, el de
  // hoy si tiene lesiones; si no, el último.
  const aniosMomentos = aniosDeMomentos(lesiones, { posicionDe });
  const anioDeHoy = Number(String(hoy || "").slice(0, 4));
  const anioMomentosDeEntrada = aniosMomentos.includes(anioDeHoy) ? anioDeHoy : aniosMomentos.at(-1) ?? null;
  const filtrosDe = (id) => filtros[id] ?? (id === "momentos" && anioMomentosDeEntrada !== null ? { [ANIO]: [String(anioMomentosDeEntrada)] } : {});

  // Una lesión pasa los filtros de un gráfico (salvo el de una cabecera, para
  // armar su lista). En los c/1000 h el año es el del período, no el de la lesión.
  const pasa = (grafico, lesion, delGrafico, salvo = null) =>
    Object.entries(delGrafico).every(([campo, elegidos]) => campo === salvo || (campo === ANIO && grafico.cadaMil) || elegidos.includes(claveDe(campo, lesion)));
  const filtradas = (grafico) => {
    const delGrafico = filtrosDe(grafico.id);
    return lesiones.filter((lesion) => pasa(grafico, lesion, delGrafico));
  };
  // Las que cuenta un gráfico, con sus reglas (sin sus filtros).
  const lasQueCuenta = (grafico, lista) => {
    if (grafico.cadaMil) return lista.filter((lesion) => tieneFecha(lesion) && cumpleVariante(lesion, grafico.variante));
    const delBloque = lesionesDelBloque(grafico.bloque, lista, { posicionDe });
    return grafico.bloque === "partes" ? delBloque.filter((lesion) => lesion.datos?.[REGLAS_GRAFICOS.tortas.campo] === grafico.valor) : delBloque;
  };

  // Lo que ofrece la lista de una cabecera: los valores de las lesiones que
  // cuenta el gráfico y que dejan pasar sus otros filtros, con cuántas tiene
  // cada uno (también "Sin dato"). En los c/1000 h, los años de los períodos.
  const valoresDe = (id, campo) => {
    const grafico = GRAFICO_POR_ID[id];
    if (campo === ANIO && grafico.cadaMil) return aniosDePeriodos(periodos).map((anio) => ({ clave: String(anio), texto: String(anio) }));
    const delGrafico = filtrosDe(id);
    const cuantas = new Map();
    lasQueCuenta(
      grafico,
      lesiones.filter((lesion) => pasa(grafico, lesion, delGrafico, campo)),
    ).forEach((lesion) => {
      const clave = claveDe(campo, lesion);
      cuantas.set(clave, (cuantas.get(clave) || 0) + 1);
    });
    const lista = [...cuantas.entries()].map(([valor, cantidad]) => ({ valor, cantidad }));
    const ordenada =
      campo !== ANIO && porCodigo(campo)
        ? ordenarPorEtiqueta(lista, (valor) => textoDe(campo, valor), idioma)
        : lista.sort((a, b) => Number(!a.valor) - Number(!b.valor) || compararTextos(String(a.valor), String(b.valor)));
    return ordenada.map(({ valor, cantidad }) => ({ clave: valor, texto: textoDeClave(campo, valor), cantidad }));
  };

  // Lo elegido en una cabecera, en palabras: "Todos", el elegido o cuántos
  // (completo: todos los nombres, para lo que se imprime).
  const textoDeLoElegido = (campo, elegidos, { completo = false } = {}) => {
    if (!elegidos?.length) return t("lesiones.graficos.todos");
    const textos = elegidos.map((clave) => textoDeClave(campo, clave) || t("lesiones.graficos.sinDato"));
    if (elegidos.length === 1 || completo) return textos.join(", ");
    return plural("lesiones.graficos.elegidos", elegidos.length);
  };
  // Lo elegido en un gráfico, debajo de su título (también impreso).
  const filtradoDe = (id, { sinAnio = false } = {}) =>
    Object.entries(filtrosDe(id))
      .filter(([campo]) => !(sinAnio && campo === ANIO))
      .map(([campo, elegidos]) => t("lesiones.graficos.filtro", { campo: tituloDeCampo(campo), valor: textoDeLoElegido(campo, elegidos, { completo: true }) }))
      .join(" · ");

  const cambiarFiltro = (id, campo, elegidos) =>
    setFiltros((antes) => {
      const delGrafico = { ...filtrosDe(id) };
      if (elegidos?.length) delGrafico[campo] = elegidos;
      else delete delGrafico[campo];
      return { ...antes, [id]: delGrafico };
    });
  const abrirCabecera = (id, campo) => {
    const valores = valoresDe(id, campo);
    setHoja({ grafico: id, campo, elegidos: elegidosAlAbrir(filtrosDe(id)[campo], valores), busqueda: "" });
  };
  const valoresDeLaHoja = hoja?.campo ? valoresDe(hoja.grafico, hoja.campo) : [];
  // marcados: null con todo marcado (no filtra). Después, vuelve a la lista
  // de cabeceras de ese gráfico.
  const aplicarFiltro = (marcados) => {
    if (!hoja?.campo) return;
    cambiarFiltro(hoja.grafico, hoja.campo, marcados || []);
    setHoja({ grafico: hoja.grafico });
  };
  const quitarFiltro = () => {
    if (!hoja?.campo) return;
    cambiarFiltro(hoja.grafico, hoja.campo, []);
    setHoja({ grafico: hoja.grafico });
  };

  // El embudo de un gráfico: prendido si filtra algo.
  const embudo = (id, titulo) => {
    const activo = Object.keys(filtrosDe(id)).length > 0;
    return (
      <button
        type="button"
        className={`reporte-grafico-embudo no-imprimir ${activo ? "activo" : ""}`.trim()}
        aria-label={t("lesiones.graficos.filtrarGrafico", { grafico: titulo })}
        aria-pressed={activo}
        aria-haspopup="dialog"
        onClick={() => setHoja({ grafico: id })}
      >
        <Icono nombre="filtro" size={16} />
      </button>
    );
  };

  const bloque = (id, titulo, contenido) => (
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
      </div>
      {contenido}
    </section>
  );
  // La tarjeta de un gráfico: el título, su embudo y, debajo, lo filtrado.
  const tarjeta = ({ id, titulo, contenido, clase = "", filtrado = filtradoDe(id) }) => (
    <section className={`tarjeta tarjeta-ficha ${clase}`.trim()} key={id}>
      <div className="cabeza-ficha reporte-grafico-cabeza">
        <b>{titulo}</b>
        {embudo(id, titulo)}
      </div>
      {filtrado && <small className="reporte-grafico-filtrado">{filtrado}</small>}
      {contenido}
    </section>
  );

  // -------------------------------------------- Bloques 1 y 2 --
  const bloqueCadaMil = (medida) => {
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
          <div className="reporte-graficos-cuatro">
            {VARIANTES.map((variante) => {
              const grafico = GRAFICO_POR_ID[`${medida}:${variante.id}`];
              const anios = filtrosDe(grafico.id)[ANIO];
              const suyos = anios ? periodos.filter((periodo) => anios.includes(String(anioDelPeriodo(periodo)))) : periodos;
              const porPeriodo = graficosPorPeriodo(filtradas(grafico), gps, suyos);
              return tarjeta({
                id: grafico.id,
                titulo: tituloDeVariante(variante),
                contenido: porPeriodo.length ? (
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
                  />
                ) : (
                  <p className="vacio-ficha">{t("lesiones.graficos.sinPeriodosDelAnio", { anio: anios.join(", ") })}</p>
                ),
              });
            })}
          </div>
          <div className="reporte-graficos-notas">
            {!gps && <p className="informe-aviso">{t("lesiones.cadaMil.faltaGps")}</p>}
            <p className="informe-criterio">{queCuenta}</p>
            <p className="informe-criterio">{t(`lesiones.graficos.anioNota.${REGLAS_GRAFICOS.anioDelPeriodo}`)}</p>
          </div>
        </>
      );
    return bloque(medida, t(`lesiones.graficos.secciones.${medida}`), contenido);
  };

  // ------------------------------------------------- Bloque 3 --
  const porcionesDe = (grafico) => {
    const filas = tortaPorParte(filtradas(grafico), grafico.valor, { posicionDe });
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
    <>
      <div className="reporte-dos">
        {REGLAS_GRAFICOS.tortas.valores.map((valor) => {
          const grafico = GRAFICO_POR_ID[`partes:${valor}`];
          const titulo = textoDeOpcion(REGLAS_GRAFICOS.tortas.campo, valor);
          return tarjeta({ id: grafico.id, titulo, contenido: <Torta titulo={titulo} porciones={porcionesDe(grafico)} vacio={t("lesiones.graficos.sinLesiones")} /> });
        })}
      </div>
      <div className="reporte-graficos-notas">
        <p className="informe-criterio">{t("lesiones.graficos.cuentanTodas", { campo: etiqueta(REGLAS_GRAFICOS.campoContado) })}</p>
      </div>
    </>,
  );

  // ------------------------------------------------- Bloque 4 --
  const porJugador = lesionesPorJugador(filtradas(GRAFICO_POR_ID.jugador), { posicionDe });
  const filasJugador = ordenarPorEtiqueta(porJugador, (valor) => textoDe("jugador", valor), idioma).map((fila) => ({
    clave: fila.valor,
    etiqueta: textoDe("jugador", fila.valor),
    total: fila.total,
    valores: fila.porSerie,
  }));
  const bloqueJugador = bloque(
    "jugador",
    t("lesiones.graficos.secciones.jugador"),
    <>
      {/* Puede ser más alta que una hoja: impresa, se corta entre jugadores. */}
      {tarjeta({
        id: "jugador",
        titulo: etiqueta(REGLAS_GRAFICOS.porJugador.series),
        contenido: <BarrasApiladas filas={filasJugador} series={seriesDe(porJugador.flatMap((fila) => Object.keys(fila.porSerie)))} vacio={t("lesiones.graficos.sinLesiones")} />,
        clase: "reporte-graficos-larga",
      })}
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
  // El año va en su filtro (de entrada, el de arriba); el título lo dice.
  const momentos = momentosPorParte(filtradas(GRAFICO_POR_ID.momentos), { posicionDe });
  const { categoria } = REGLAS_GRAFICOS.momentos;
  const seriesMomentos = seriesDe(momentos.flatMap((fila) => Object.keys(fila.porSerie)));
  const filasMomentos = ordenarPorEtiqueta(momentos, (valor) => textoDe(categoria, valor), idioma).map((fila) => ({
    clave: fila.valor,
    etiqueta: textoDe(categoria, fila.valor),
    detalle: plural("lesiones.historial.cantidad", fila.total),
    // Una parte sin lesiones en ese momento no lleva columna (ni una raya en cero).
    valores: Object.fromEntries(seriesMomentos.map((serie) => [serie.clave, fila.porSerie[serie.clave] || null])),
  }));
  const aniosDeMomentosElegidos = filtrosDe("momentos")[ANIO];
  const tituloMomentos = aniosDeMomentosElegidos?.length ? aniosDeMomentosElegidos.join(", ") : t("lesiones.graficos.todosLosAnios");
  const bloqueMomentos = bloque(
    "momentos",
    t("lesiones.graficos.secciones.momentos"),
    <>
      {tarjeta({
        id: "momentos",
        titulo: tituloMomentos,
        filtrado: filtradoDe("momentos", { sinAnio: true }),
        contenido: <Columnas titulo={tituloMomentos} filas={filasMomentos} series={seriesMomentos} formato={(valor) => (valor ? String(valor) : "")} vacio={t("lesiones.graficos.sinLesiones")} leyenda />,
      })}
      <div className="reporte-graficos-notas">
        <p className="informe-criterio">{t("lesiones.graficos.cuentanMomentos", { campo: etiqueta(categoria), contado: etiqueta(REGLAS_GRAFICOS.campoContado) })}</p>
      </div>
    </>,
  );

  // El título del gráfico del filtro abierto.
  const tituloDelGrafico = (id) => {
    const grafico = GRAFICO_POR_ID[id];
    if (!grafico) return "";
    const seccion = t(`lesiones.graficos.secciones.${grafico.bloque}`);
    if (grafico.cadaMil) return `${seccion} · ${tituloDeVariante(grafico.variante)}`;
    if (grafico.bloque === "partes") return `${seccion} · ${textoDeOpcion(REGLAS_GRAFICOS.tortas.campo, grafico.valor)}`;
    return seccion;
  };
  const graficoDeLaHoja = hoja ? GRAFICO_POR_ID[hoja.grafico] : null;
  const filtrosDeLaHoja = hoja ? filtrosDe(hoja.grafico) : {};
  // Las cabeceras son muchas (las de la Base): arriba, un buscador.
  const buscada = normalizarTextoBase(hoja?.buscada || "");
  const cabecerasDeLaHoja = graficoDeLaHoja ? camposDe(graficoDeLaHoja).filter((campo) => !buscada || normalizarTextoBase(tituloDeCampo(campo)).includes(buscada)) : [];

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

        {bloqueCadaMil("lesiones")}
        {bloqueCadaMil("dias")}
        {bloqueTortas}
        {bloqueJugador}
        {bloqueMomentos}
      </div>

      {/* El filtro de un gráfico: primero sus cabeceras (con lo elegido en
          cada una); al tocar una, sus valores para marcar, como el filtro de
          las columnas de la Base. */}
      <HojaInferior
        abierta={Boolean(hoja && !hoja.campo)}
        className="reporte-graficos-hoja-cabeceras"
        titulo={hoja ? t("lesiones.graficos.filtrarGrafico", { grafico: tituloDelGrafico(hoja.grafico) }) : ""}
        onCerrar={() => setHoja(null)}
        acciones={
          <>
            <button
              type="button"
              className="boton-cancelar-hoja"
              disabled={!Object.keys(filtrosDeLaHoja).length}
              onClick={() => {
                setFiltros((antes) => ({ ...antes, [hoja.grafico]: {} }));
              }}
            >
              {t("lesiones.graficos.quitarFiltros")}
            </button>
            <button type="button" className="boton-confirmar-hoja" onClick={() => setHoja(null)}>
              {t("lesiones.graficos.listo")}
            </button>
          </>
        }
      >
        {graficoDeLaHoja && (
          <div className="buscador-hoja">
            <input
              type="search"
              value={hoja.buscada || ""}
              onChange={(evento) => {
                const texto = evento.target.value;
                setHoja((actual) => ({ ...actual, buscada: texto }));
              }}
              placeholder={t("comun.buscar", {}, "Escribir para buscar...")}
              aria-label={t("comun.buscar", {}, "Escribir para buscar...")}
              autoComplete="off"
            />
          </div>
        )}
        {graficoDeLaHoja && (
          <div className="lista-opciones-hoja reporte-graficos-cabeceras">
            {cabecerasDeLaHoja.length === 0 && <p className="sin-resultados">{t("comun.sinCoincidencias", {}, "Sin coincidencias.")}</p>}
            {cabecerasDeLaHoja.map((campo) => {
              const elegidos = filtrosDeLaHoja[campo];
              return (
                <button type="button" key={campo} className={`opcion-hoja ${elegidos?.length ? "activa" : ""}`.trim()} aria-pressed={Boolean(elegidos?.length)} onClick={() => abrirCabecera(hoja.grafico, campo)}>
                  {tituloDeCampo(campo)}
                  <small className="opcion-hoja-detalle">{textoDeLoElegido(campo, elegidos)}</small>
                </button>
              );
            })}
          </div>
        )}
      </HojaInferior>
      <HojaDeFiltro
        abierta={Boolean(hoja?.campo)}
        className="reporte-graficos-hoja-filtro"
        columna={hoja?.campo ? tituloDeCampo(hoja.campo) : ""}
        valores={valoresDeLaHoja}
        elegidos={hoja?.elegidos || []}
        busqueda={hoja?.busqueda || ""}
        textoVacio={t("lesiones.graficos.sinDato")}
        onCambiar={(elegidos) => setHoja((actual) => ({ ...actual, elegidos }))}
        onBuscar={(busqueda) => setHoja((actual) => ({ ...actual, busqueda }))}
        onAplicar={aplicarFiltro}
        onQuitar={quitarFiltro}
        onCerrar={() => setHoja((actual) => (actual ? { grafico: actual.grafico } : null))}
      />
    </div>
  );
}
