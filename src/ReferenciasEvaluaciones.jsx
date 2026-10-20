import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojasDeOcultar, OcultasArriba, useOcultar } from "./components/Ocultar.jsx";
import { HistorialDeReferencias, TablaDeReferencia } from "./components/TablaDeReferencia.jsx";
import { textoDeValor, tiempoParaExcel } from "./domain/evaluaciones/excel.js";
import { COMPARAR_AL_ABRIR } from "./domain/evaluaciones/categorias.js";
import { bloqueDeLaPlanilla, calculoDeEvaluaciones, filasDeLaPlanilla, filtrosDeLaCategoria, medidasDeEvaluaciones } from "./domain/evaluaciones/planillaVr.js";
import { cambiarReferencia } from "./domain/evaluacionesDb.js";
import { armarPlanilla, calcularPlanilla, eleccionDeLaPlanilla, filasDeLaMuestra, leerPlanilla, medidasDeLaPlanillaGuardada, numerosParaGuardar } from "./domain/gps/planillaVr.js";
import { cambiosDeEntrada, iguales } from "./domain/referencias.js";
import { leerHistorialDeReferencias } from "./domain/referenciasDb.js";
import { interpretarMinutos, interpretarValor } from "./domain/tabla.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";
import PlanillaVr from "./PlanillaVr.jsx";

// Evaluaciones › Valores de referencia: un bloque por categoría y el
// resumen, como siempre (Santiago, 09/10: «Quinta pantalla aparte»). Desde
// el 14/10 se cambian («pero no puedo editar nada del vr»): un número con
// dos toques; agregar y borrar una categoría; abajo, los últimos cambios,
// con «Volver». Los cambia quien tiene Evaluaciones y sigue en el club.
// Desde el 19/10, «Calcular con la planilla» arriba (nota 3 de la planilla de
// valor referencial; PlanillaVr.jsx y domain/evaluaciones/planillaVr.js):
// se elige la categoría, las variables y la muestra (de entrada, las filas
// de esa Selección); el resultado va al bloque de la categoría, que dice
// cuándo y con qué filas se calculó y suma «Recalcular».
// planilla: lo de la Base para la planilla ({ columnas, fijas, armarFilas,
// textoDe, sentidoDe }; ver Evaluaciones.jsx).

const esObjeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);

// Lo que se escribe, en la unidad que guardan los V.R.: los tiempos (m:ss)
// en la del Excel; los porcentajes, sin el %.
export const valorDeReferencia = (formato = "General", escrito = "") => {
  const texto = String(escrito ?? "").trim();
  if (!texto) return null;
  if (formato === "tiempo") {
    const segundos = interpretarMinutos(texto);
    return segundos === null || segundos === undefined ? segundos : tiempoParaExcel(segundos);
  }
  const numero = interpretarValor({ tipo: "numero" }, texto.replace(/%$/, "").trim());
  if (numero === null || numero === undefined) return numero;
  return /%$/.test(formato) ? numero / 100 : numero;
};

// Las hojas de un valor (un bloque entero es varios números).
const hojas = (valor, ruta = []) => {
  if (valor === null || valor === undefined) return [];
  return esObjeto(valor) ? Object.entries(valor).flatMap(([clave, uno]) => hojas(uno, [...ruta, clave])) : [{ ruta, valor }];
};

export default function ReferenciasEvaluaciones({
  test,
  referencias,
  categorias,
  categoriasConOcultas,
  idioma,
  equipoId,
  soloLectura,
  seFue = soloLectura,
  enLinea,
  cargando,
  error,
  selector,
  encabezado,
  arriba = null,
  planilla: base = null,
  onCambiadas,
  onRecargar,
  onAviso,
}) {
  const { plural } = useIdioma();
  const bloques = referencias?.categorias || {};
  const sinReferencias = test.conReferencias !== false && !cargando && !error && !referencias;
  const tablas = test.tablasDeReferencia || [{ id: "", titulo: null, metricas: test.metricas }];
  const filasDe = (tabla) => tabla.filas || test.filasDeReferencia || [];
  const etiquetaDe = (codigo) => categoriasConOcultas.find((categoria) => categoria.valor === codigo)?.etiqueta || codigo;

  // ------------------------------------------------------------ Historial --
  const [historial, setHistorial] = useState({ cambios: [], faltaTabla: false, error: "", leido: false });
  const leerHistorial = useCallback(async () => {
    if (seFue || !equipoId) return;
    const respuesta = await leerHistorialDeReferencias(equipoId, "evaluaciones_referencias");
    setHistorial({ cambios: respuesta.cambios, faltaTabla: respuesta.faltaTabla, error: respuesta.error, leido: true });
  }, [equipoId, seFue]);
  // Cada vez que cambian los V.R. (acá o en otro aparato), el historial también.
  useEffect(() => {
    leerHistorial();
  }, [leerHistorial, referencias]);

  // Sin la actualización de la base, se miran y no se cambian.
  const sinEdicion = historial.faltaTabla;
  const puedeCambiar = !soloLectura && !sinEdicion && enLinea && test.conReferencias !== false && historial.leido;

  const cambiar = async (ruta, valor) => {
    const respuesta = await cambiarReferencia(equipoId, test.id, ruta, valor);
    if (!respuesta.error) onCambiadas(test.id, respuesta.datos);
    return respuesta;
  };

  // El formato de un valor (para mostrarlo y para leer lo escrito).
  // (Con las de los bloques de la planilla: n y Desvío, aunque el test no las tenga.)
  const todasLasFilas = useMemo(() => [...new Map([...tablas.flatMap((tabla) => filasDeLaPlanilla(test, tabla)), ...tablas.flatMap((tabla) => filasDe(tabla))].map((fila) => [fila.clave, fila])).values()], [test]); // eslint-disable-line react-hooks/exhaustive-deps
  const metricaDe = (clave) => test.metricas.find((metrica) => metrica.clave === clave) || null;
  const formatoDe = (filaClave, metricaClave) => todasLasFilas.find((fila) => fila.clave === filaClave)?.formato || metricaDe(metricaClave)?.formato || "General";

  // ----------------------------------------------- Categorías: sumar y borrar --
  const sinBloque = categoriasConOcultas.filter((categoria) => !bloques[categoria.valor]);
  const [nueva, setNueva] = useState("");
  const [aBorrar, setABorrar] = useState(null);
  // Ocultar a mano (Santiago, 15/10): lo mismo en las tablas de todas las
  // categorías (tienen las mismas columnas y filas); el resumen, aparte.
  const ocultarCategorias = useOcultar(`vr-evaluaciones:${test.id}`);
  const ocultarResumen = useOcultar(`vr-evaluaciones-resumen:${test.id}`);
  const sumarCategoria = async () => {
    const codigo = nueva || sinBloque[0]?.valor;
    if (!codigo) return;
    const respuesta = await cambiar(["categorias", codigo], {});
    if (respuesta.error) onAviso(t(respuesta.error));
    else {
      setNueva("");
      onAviso(t("evaluaciones.referencias.categoriaSumada", { categoria: etiquetaDe(codigo) }));
    }
  };
  const borrarCategoria = async () => {
    const codigo = aBorrar;
    setABorrar(null);
    if (!codigo) return;
    const respuesta = await cambiar(["categorias", codigo], null);
    onAviso(respuesta.error ? t(respuesta.error) : t("evaluaciones.referencias.categoriaBorrada", { categoria: etiquetaDe(codigo) }));
  };

  // --------------------------------------------- Los cambios, en palabras --
  const vacio = t("referencias.historial.vacioValor");
  const textoDe = (filaClave, metricaClave, valor) => (valor === null || valor === undefined ? vacio : textoDeValor(valor, formatoDe(filaClave, metricaClave), idioma) || String(valor));
  const tituloDeFila = (clave) => todasLasFilas.find((fila) => fila.clave === clave)?.titulo?.[idioma] || clave;
  const lineasDe = (cambio) => {
    const [, parte, ...resto] = cambio.ruta;
    if (parte === "categorias" && resto.length === 1) {
      return [t(cambio.antes === null ? "evaluaciones.referencias.cambio.categoriaSumada" : cambio.despues === null ? "evaluaciones.referencias.cambio.categoriaBorrada" : "evaluaciones.referencias.cambio.categoria", { categoria: etiquetaDe(resto[0]) })];
    }
    // Lo que apareció o se fue entero, número por número.
    const antes = new Map(hojas(cambio.antes).map((hoja) => [hoja.ruta.join("|"), hoja.valor]));
    const despues = new Map(hojas(cambio.despues).map((hoja) => [hoja.ruta.join("|"), hoja.valor]));
    const claves = [...new Set([...antes.keys(), ...despues.keys()])];
    return claves.map((clave) => {
      const ruta = [...resto, ...(clave ? clave.split("|") : [])];
      const a = antes.get(clave) ?? null;
      const d = despues.get(clave) ?? null;
      if (parte === "categorias" && ruta.length === 3) {
        const [categoria, fila, metrica] = ruta;
        return t("evaluaciones.referencias.cambio.valor", { categoria: etiquetaDe(categoria), fila: tituloDeFila(fila), medida: metricaDe(metrica)?.titulo?.[idioma] || metrica, antes: textoDe(fila, metrica, a), despues: textoDe(fila, metrica, d) });
      }
      if (parte === "resumen" && ruta[0] === "n" && ruta.length === 2) {
        return t("evaluaciones.referencias.cambio.n", { categoria: etiquetaDe(ruta[1]), antes: a === null ? vacio : String(a), despues: d === null ? vacio : String(d) });
      }
      return `${[parte, ...ruta].join(" · ")}: ${a === null ? vacio : String(a)} → ${d === null ? vacio : String(d)}`;
    });
  };
  const entradas = useMemo(
    () =>
      historial.cambios
        .filter((entrada) => (entrada.despues || entrada.antes)?.test === test.id)
        .map((entrada) => {
          if (entrada.accion === "borrada") return { ...entrada, cambios: [], lineas: [t("evaluaciones.referencias.cambio.todoBorrado")], volver: true };
          if (entrada.accion === "creada") {
            const datos = entrada.despues?.datos;
            return { ...entrada, cambios: [], lineas: esObjeto(datos) && Object.keys(datos).length ? [t("evaluaciones.referencias.cambio.cargados")] : [], volver: false };
          }
          const cambios = cambiosDeEntrada(entrada).filter((cambio) => cambio.ruta[0] === "datos" && cambio.ruta.length >= 3);
          // Calcular o recalcular con la planilla cambia todo el bloque de un
          // saque: una sola línea por categoría, y «Volver» lo deja entero
          // como estaba.
          const bloquesAntes = entrada.antes?.datos?.categorias || {};
          const bloquesDespues = entrada.despues?.datos?.categorias || {};
          const conPlanilla = Object.keys(bloquesDespues).filter((codigo) => bloquesDespues[codigo]?.planilla && !iguales(bloquesAntes[codigo]?.planilla ?? null, bloquesDespues[codigo].planilla));
          if (conPlanilla.length)
            return {
              ...entrada,
              cambios,
              bloques: conPlanilla.map((codigo) => [codigo, bloquesAntes[codigo] ?? null]),
              lineas: conPlanilla.map((codigo) => t(bloquesAntes[codigo]?.planilla ? "evaluaciones.referencias.cambio.recalculo" : "evaluaciones.referencias.cambio.planilla", { categoria: etiquetaDe(codigo) })),
              volver: true,
            };
          return { ...entrada, cambios, lineas: cambios.flatMap(lineasDe), volver: cambios.length > 0 };
        })
        .filter((entrada) => entrada.lineas.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historial.cambios, test, idioma, categoriasConOcultas],
  );
  // Volver atrás: cada valor, a como estaba; si se borraron todos, otra vez.
  const volver = async (id) => {
    const entrada = entradas.find((una) => una.id === id);
    if (!entrada) return { error: "" };
    const pasos =
      entrada.accion === "borrada"
        ? Object.entries(entrada.antes?.datos || {}).flatMap(([parte, valor]) => (esObjeto(valor) && ["categorias", "resumen"].includes(parte) ? Object.entries(valor).map(([clave, uno]) => [[parte, clave], uno]) : []))
        : entrada.bloques
          ? entrada.bloques.map(([codigo, bloque]) => [["categorias", codigo], bloque])
          : entrada.cambios.map((cambio) => [cambio.ruta.slice(1), cambio.antes]);
    for (const [ruta, valor] of pasos) {
      const respuesta = await cambiar(ruta, valor); // eslint-disable-line no-await-in-loop
      if (respuesta.error) return respuesta;
    }
    await onRecargar();
    onAviso(t("referencias.historial.volvio"));
    return { error: "" };
  };

  // ------------------------------------------------- La planilla del club --
  const [calculando, setCalculando] = useState(false);
  const [aRecalcular, setARecalcular] = useState(null);
  const [recalculando, setRecalculando] = useState(false);
  const medidas = useMemo(() => medidasDeEvaluaciones(test), [test]);
  const calculo = useMemo(() => calculoDeEvaluaciones(test, idioma), [test, idioma]);
  const tituloDeMedida = (clave) => {
    const metrica = medidas.find((una) => una.clave === clave);
    const nombre = metrica?.titulo?.[idioma] || clave;
    return metrica?.tituloDeTabla?.[idioma] ? `${metrica.tituloDeTabla[idioma]} · ${nombre}` : nombre;
  };
  // Las filas del test, armadas como en la Base, solo mientras se calcula.
  const conFilas = calculando || Boolean(aRecalcular);
  const filasDelTest = useMemo(() => (conFilas && base ? base.armarFilas() : []), [conFilas, base]);
  const puedeCalcular = puedeCambiar && Boolean(base) && !cargando && medidas.length > 0;
  const categoriasParaCalcular = categoriasConOcultas.map((categoria) => ({ valor: categoria.valor, etiqueta: categoria.etiqueta }));
  const filtrosDe = useCallback((codigo) => filtrosDeLaCategoria(filasDelTest, codigo, etiquetaDe(codigo)), [filasDelTest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lo calculado va al bloque de la categoría (y su n, al resumen).
  const guardarEnLaCategoria = async (codigo, calculos, planilla) => {
    const bloque = bloqueDeLaPlanilla({ test, anterior: bloques[codigo], calculos, planilla });
    const respuesta = await cambiar(["categorias", codigo], bloque);
    if (respuesta.error) return respuesta;
    if (referencias?.resumen || test.resumen?.length) {
      const otra = await cambiar(["resumen", "n", codigo], planilla.filas);
      if (otra.error) return otra;
    }
    return { error: "" };
  };
  const guardarDeLaPlanilla = async ({ categoria, calculos, planilla }) => {
    const respuesta = await guardarEnLaCategoria(categoria, calculos, planilla);
    if (respuesta.error) return respuesta;
    setCalculando(false);
    onAviso(t("evaluaciones.referencias.planilla.calculado", { categoria: etiquetaDe(categoria) }));
    return { error: "" };
  };

  // Cómo se armó la muestra: cada filtro con lo elegido (hasta tres, con su
  // nombre; más, cuántos).
  const textoDeLaMuestra = (planilla) => {
    const filtros = Object.entries(planilla?.muestra || {});
    if (!filtros.length) return t("evaluaciones.referencias.planilla.conTodas");
    return filtros
      .map(([clave, valores]) => {
        const columna = base?.columnas.find((una) => una.clave === clave);
        const textos = valores.map((valor) => (valor === "" || valor === null ? t("gps.vr.planilla.vacio") : base ? base.textoDe(clave, valor) : String(valor)));
        return t("gps.vr.planilla.filtro", { columna: columna?.titulo || clave, valores: textos.length <= 3 ? textos.join(", ") : plural("gps.vr.planilla.elegidos", textos.length) });
      })
      .join(" · ");
  };
  const textoDelCalculo = (planilla) =>
    [t("gps.vr.planilla.calculado", { fecha: planilla.calculado ? fechaCorta(planilla.calculado) : "—", filas: plural("gps.vr.planilla.filas", planilla.filas ?? 0) }), textoDeLaMuestra(planilla)].join(" · ");

  // «Recalcular»: la misma muestra, las mismas variables y lo elegido en cada
  // una, con los datos de hoy.
  const recalculo = useMemo(() => {
    const planilla = aRecalcular ? leerPlanilla(bloques[aRecalcular]?.planilla) : null;
    if (!planilla) return null;
    const muestra = filasDeLaMuestra(filasDelTest, planilla.muestra);
    return { planilla, muestra, medidas: medidasDeLaPlanillaGuardada(planilla, medidas), eleccion: eleccionDeLaPlanilla(planilla, medidas) };
  }, [aRecalcular, bloques, filasDelTest, medidas]);
  const textoDeLaDiferencia = (antes, ahora) => {
    if (antes === null || antes === undefined || antes === ahora) return t("gps.vr.planilla.igualQueAntes");
    return ahora > antes ? plural("gps.vr.planilla.masQueAntes", ahora - antes) : plural("gps.vr.planilla.menosQueAntes", antes - ahora);
  };
  const recalcular = async () => {
    const codigo = aRecalcular;
    if (!codigo || !recalculo || recalculando) return;
    const calculos = calcularPlanilla(recalculo.muestra.map(calculo.crudaDe), recalculo.medidas, recalculo.eleccion, calculo);
    if (!Object.values(calculos).some(({ resultado }) => resultado)) {
      setARecalcular(null);
      onAviso(t("gps.vr.planilla.ningunaMedida"));
      return;
    }
    setRecalculando(true);
    const planilla = armarPlanilla({ muestra: recalculo.planilla.muestra, eleccion: recalculo.eleccion, filas: recalculo.muestra.length, calculado: hoyISO(), n: numerosParaGuardar(calculos).n });
    const respuesta = await guardarEnLaCategoria(codigo, calculos, planilla);
    setRecalculando(false);
    setARecalcular(null);
    onAviso(respuesta.error ? t(respuesta.error) : t("evaluaciones.referencias.planilla.recalculado", { categoria: etiquetaDe(codigo) }));
  };

  if (calculando && puedeCalcular)
    return (
      <PlanillaVr
        titulo={t("evaluaciones.referencias.planilla.titulo", { test: test.pestana[idioma] })}
        texto={t("evaluaciones.referencias.planilla.texto")}
        muestraTexto={t("evaluaciones.referencias.planilla.muestraTexto", { test: test.pestana[idioma] })}
        filas={filasDelTest}
        columnas={base.columnas}
        fijas={base.fijas}
        medidas={medidas}
        tituloDe={tituloDeMedida}
        textoDe={(metrica, valor) => textoDeValor(valor, metrica.formato, idioma)}
        sentidoDeAjustes={base.sentidoDe}
        categorias={categoriasParaCalcular}
        categoriaInicial={(categorias.find((categoria) => bloques[categoria.valor]) || categorias.find((categoria) => categoria.valor === COMPARAR_AL_ABRIR) || categorias[0])?.valor || ""}
        filtrosDe={filtrosDe}
        calculo={calculo}
        onGuardar={guardarDeLaPlanilla}
        onCancelar={() => setCalculando(false)}
      />
    );

  // ------------------------------------------------------------ Pantalla --
  const titulo = (bloque, tabla, categoria) => (tabla.id ? bloque.titulos?.[tabla.id] : bloque.titulo) || [tabla.titulo?.[idioma], categoria.etiqueta].filter(Boolean).join(" · ");
  const columnasDe = (tabla) => tabla.metricas.map((metrica) => ({ clave: metrica.clave, titulo: metrica.titulo[idioma], teclado: metrica.formato === "tiempo" ? "text" : "decimal", formato: metrica.formato }));
  // Un bloque calculado con la planilla: n, Desvío y las cinco (sin Promedio).
  const filasDeTabla = (tabla, bloque = null) => (bloque?.planilla ? filasDeLaPlanilla(test, tabla) : filasDe(tabla)).map((fila) => ({ clave: fila.clave, titulo: fila.titulo[idioma], formato: fila.formato }));
  const interpretar = (fila, columna, escrito) => valorDeReferencia(fila.formato || columna.formato || "General", escrito);
  const conPro = test.resumenConPro !== false;
  const columnasDelResumen = [
    { clave: "n", titulo: "n", formato: "General" },
    ...(test.resumen || []).map((clave) => ({ clave, titulo: metricaDe(clave)?.titulo?.[idioma] || clave, formato: metricaDe(clave)?.formato, teclado: metricaDe(clave)?.formato === "tiempo" ? "text" : "decimal" })),
    // «Pro»: en el Excel da #REF! (la celda de la que salía ya no existe).
    ...(conPro ? [{ clave: "_pro", titulo: t("evaluaciones.referencias.pro"), editable: false }] : []),
  ];
  // Lo que se puede ocultar en las tablas de las categorías (sin repetir).
  const unaVez = (lista) => lista.filter((uno, indice) => lista.findIndex((otro) => otro.clave === uno.clave) === indice).map(({ clave, titulo }) => ({ clave, texto: titulo }));
  const columnasDeCategorias = unaVez(tablas.flatMap(columnasDe));
  const conPlanilla = Object.values(bloques).some((bloque) => bloque?.planilla);
  const filasDeCategorias = unaVez([...tablas.flatMap((tabla) => filasDeTabla(tabla)), ...(conPlanilla ? tablas.flatMap((tabla) => filasDeTabla(tabla, { planilla: true })) : [])]);

  return (
    <div className="app">
      <div className="contenedor contenedor-base">
        {selector}
        {encabezado(t("evaluaciones.referencias.titulo"), t("evaluaciones.referencias.texto"))}
        {arriba}
        {sinEdicion && !soloLectura && <p className="lesiones-estado evaluaciones-sin-referencias">{t("evaluaciones.referencias.faltaActualizacion")}</p>}
        {sinReferencias && <p className="lesiones-estado">{t(puedeCambiar ? "evaluaciones.referencias.sinDatosCargar" : "evaluaciones.referencias.sinDatos")}</p>}
        {test.conReferencias === false && !cargando && !error && <p className="lesiones-estado">{t("evaluaciones.referencias.noTiene")}</p>}
        {/* «Calcular con la planilla» (Santiago, 19/10: «Un botón arriba»). */}
        {puedeCalcular && (
          <div className="referencias-calcular">
            <button type="button" className="boton-principal" onClick={() => setCalculando(true)}>
              {t("evaluaciones.referencias.planilla.boton")}
            </button>
          </div>
        )}
        {puedeCambiar && Object.keys(bloques).length > 0 && <p className="lesiones-ayuda referencias-ayuda">{t("referencias.comoSeCambia")}</p>}
        {!cargando && !error && Object.keys(bloques).length > 0 && <OcultasArriba ocultar={ocultarCategorias} columnas={columnasDeCategorias} filas={filasDeCategorias} />}
        {!cargando &&
          !error &&
          categoriasConOcultas
            .filter((categoria) => bloques[categoria.valor])
            .flatMap((categoria) => {
              const bloque = bloques[categoria.valor];
              // Un test puede tener sus V.R. en varias tablas (Curl Nórdico e
              // Isoprone: una por evaluación); si no, una sola. Uno calculado
              // con la planilla muestra solo las variables que se usaron (y
              // sus «DE»); una tabla sin ninguna, no va (Santiago, 20/10:
              // «En el vr solo dejas las columnas que se hayan usado»).
              const columnasDelBloque = (tabla) => {
                if (!bloque.planilla) return columnasDe(tabla);
                const usadas = (clave) => typeof bloque.bueno?.[clave] === "number";
                return columnasDe(tabla).filter((columna) => usadas(columna.clave) || (columna.clave.endsWith("_de") && usadas(columna.clave.slice(0, -3))));
              };
              const suyas = tablas.filter((tabla) => columnasDelBloque(tabla).length > 0);
              return (suyas.length ? suyas : tablas.slice(0, 1)).map((tabla, indice, lista) => (
                <section key={`${categoria.valor}-${tabla.id}`} className="tarjeta evaluaciones-bloque referencias-bloque">
                  <div className="evaluaciones-bloque-cabeza">
                    <h2>{titulo(bloque, tabla, categoria)}</h2>
                    {bloque.rotulo && <span>{bloque.rotulo}</span>}
                  </div>
                  {indice === 0 && bloque.planilla && <p className="lesiones-ayuda referencias-calculado">{textoDelCalculo(leerPlanilla(bloque.planilla))}</p>}
                  <TablaDeReferencia
                    ocultar={ocultarCategorias}
                    columnas={columnasDelBloque(tabla)}
                    filas={filasDeTabla(tabla, bloque)}
                    texto={(fila, columna) => textoDeValor(bloque[fila.clave]?.[columna.clave] ?? null, fila.formato || columna.formato, idioma)}
                    interpretar={interpretar}
                    onCambiar={puedeCambiar ? (fila, columna, valor) => cambiar(["categorias", categoria.valor, fila.clave, columna.clave], valor) : undefined}
                  />
                  {/* Borrar la categoría: en la última de sus tablas. */}
                  {puedeCambiar && indice === lista.length - 1 && (
                    <div className="referencias-acciones">
                      {bloque.planilla && puedeCalcular && (
                        <button type="button" className="boton-secundario" onClick={() => setARecalcular(categoria.valor)}>
                          {t("gps.vr.planilla.recalcular")}
                        </button>
                      )}
                      <button type="button" className="boton-secundario boton-peligro" onClick={() => setABorrar(categoria.valor)}>
                        {t("evaluaciones.referencias.borrarCategoria", { categoria: categoria.etiqueta })}
                      </button>
                    </div>
                  )}
                </section>
              ));
            })}
        {puedeCambiar && sinBloque.length > 0 && (
          <section className="tarjeta evaluaciones-bloque referencias-sumar-categoria">
            <label className="campo-inicio evaluaciones-elegir-test">
              <span>{t("evaluaciones.referencias.sumarCategoria")}</span>
              <select className="evaluaciones-elegir-test-lista" value={nueva || sinBloque[0].valor} onChange={(evento) => setNueva(evento.target.value)}>
                {sinBloque.map((categoria) => (
                  <option key={categoria.valor} value={categoria.valor}>
                    {categoria.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="boton-principal" onClick={sumarCategoria}>
              {t("evaluaciones.referencias.sumar")}
            </button>
          </section>
        )}
        {!cargando && !error && referencias?.resumen && (
          <section className="tarjeta evaluaciones-bloque">
            <h2>{t("evaluaciones.referencias.resumen")}</h2>
            <OcultasArriba
              ocultar={ocultarResumen}
              columnas={columnasDelResumen.map(({ clave, titulo }) => ({ clave, texto: titulo }))}
              filas={categorias.map((categoria) => ({ clave: categoria.valor, texto: categoria.etiqueta }))}
            />
            <TablaDeReferencia
              ocultar={ocultarResumen}
              primera={t("evaluaciones.referencias.categoria")}
              columnas={columnasDelResumen}
              filas={categorias.map((categoria) => ({ clave: categoria.valor, titulo: categoria.etiqueta }))}
              texto={(fila, columna) => {
                if (columna.clave === "_pro") return "";
                if (columna.clave === "n") return textoDeValor(referencias.resumen.n?.[fila.clave] ?? null, "General", idioma);
                return textoDeValor(bloques[fila.clave]?.bueno?.[columna.clave] ?? null, columna.formato, idioma);
              }}
              interpretar={(_fila, columna, escrito) => valorDeReferencia(columna.formato || "General", escrito)}
              onCambiar={puedeCambiar ? (fila, columna, valor) => cambiar(columna.clave === "n" ? ["resumen", "n", fila.clave] : ["categorias", fila.clave, "bueno", columna.clave], valor) : undefined}
            />
          </section>
        )}
        {historial.leido && !sinEdicion && test.conReferencias !== false && <HistorialDeReferencias entradas={entradas} onVolver={enLinea && !soloLectura ? volver : undefined} error={historial.error} />}
      </div>
      <HojasDeOcultar ocultar={ocultarCategorias} />
      <HojasDeOcultar ocultar={ocultarResumen} />

      <HojaConfirmar
        abierta={Boolean(aRecalcular && recalculo)}
        titulo={aRecalcular ? t("gps.vr.planilla.recalcularTitulo", { nombre: etiquetaDe(aRecalcular) }) : ""}
        descripcion={
          aRecalcular && recalculo
            ? t("gps.vr.planilla.recalcularTexto", {
                muestra: textoDeLaMuestra(recalculo.planilla),
                filas: plural("gps.vr.planilla.filas", recalculo.muestra.length),
                diferencia: textoDeLaDiferencia(recalculo.planilla.filas, recalculo.muestra.length),
              })
            : ""
        }
        etiquetaConfirmar={recalculando ? t("gps.vr.planilla.guardando") : t("gps.vr.planilla.recalcular")}
        etiquetaCancelar={t("comun.cancelar")}
        icono="documento"
        onConfirmar={recalcular}
        onCancelar={() => setARecalcular(null)}
      />
      <HojaConfirmar
        abierta={Boolean(aBorrar)}
        titulo={t("evaluaciones.referencias.borrarTitulo")}
        descripcion={t("evaluaciones.referencias.borrarTexto", { categoria: etiquetaDe(aBorrar) })}
        etiquetaConfirmar={t("referencias.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={borrarCategoria}
        onCancelar={() => setABorrar(null)}
      />
    </div>
  );
}
