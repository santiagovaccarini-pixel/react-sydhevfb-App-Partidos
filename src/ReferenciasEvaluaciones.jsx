import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HistorialDeReferencias, TablaDeReferencia } from "./components/TablaDeReferencia.jsx";
import { textoDeValor, tiempoParaExcel } from "./domain/evaluaciones/excel.js";
import { cambiarReferencia } from "./domain/evaluacionesDb.js";
import { cambiosDeEntrada } from "./domain/referencias.js";
import { leerHistorialDeReferencias } from "./domain/referenciasDb.js";
import { interpretarMinutos, interpretarValor } from "./domain/tabla.js";
import { t } from "./idioma/index.js";

// Evaluaciones › Valores de referencia: un bloque por categoría y el
// resumen, como siempre (Santiago, 09/10: «Quinta pantalla aparte»). Desde
// el 14/10 se cambian («pero no puedo editar nada del vr»): un número con
// dos toques; agregar y borrar una categoría; abajo, los últimos cambios,
// con «Volver». Los cambia quien tiene Evaluaciones y sigue en el club.

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
  enLinea,
  cargando,
  error,
  selector,
  encabezado,
  arriba = null,
  onCambiadas,
  onRecargar,
  onAviso,
}) {
  const bloques = referencias?.categorias || {};
  const sinReferencias = test.conReferencias !== false && !cargando && !error && !referencias;
  const tablas = test.tablasDeReferencia || [{ id: "", titulo: null, metricas: test.metricas }];
  const filasDe = (tabla) => tabla.filas || test.filasDeReferencia || [];
  const etiquetaDe = (codigo) => categoriasConOcultas.find((categoria) => categoria.valor === codigo)?.etiqueta || codigo;

  // ------------------------------------------------------------ Historial --
  const [historial, setHistorial] = useState({ cambios: [], faltaTabla: false, error: "", leido: false });
  const leerHistorial = useCallback(async () => {
    if (soloLectura || !equipoId) return;
    const respuesta = await leerHistorialDeReferencias(equipoId, "evaluaciones_referencias");
    setHistorial({ cambios: respuesta.cambios, faltaTabla: respuesta.faltaTabla, error: respuesta.error, leido: true });
  }, [equipoId, soloLectura]);
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
  const todasLasFilas = useMemo(() => [...new Map(tablas.flatMap((tabla) => filasDe(tabla)).map((fila) => [fila.clave, fila])).values()], [test]); // eslint-disable-line react-hooks/exhaustive-deps
  const metricaDe = (clave) => test.metricas.find((metrica) => metrica.clave === clave) || null;
  const formatoDe = (filaClave, metricaClave) => todasLasFilas.find((fila) => fila.clave === filaClave)?.formato || metricaDe(metricaClave)?.formato || "General";

  // ----------------------------------------------- Categorías: sumar y borrar --
  const sinBloque = categoriasConOcultas.filter((categoria) => !bloques[categoria.valor]);
  const [nueva, setNueva] = useState("");
  const [aBorrar, setABorrar] = useState(null);
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
        : entrada.cambios.map((cambio) => [cambio.ruta.slice(1), cambio.antes]);
    for (const [ruta, valor] of pasos) {
      const respuesta = await cambiar(ruta, valor); // eslint-disable-line no-await-in-loop
      if (respuesta.error) return respuesta;
    }
    await onRecargar();
    onAviso(t("referencias.historial.volvio"));
    return { error: "" };
  };

  // ------------------------------------------------------------ Pantalla --
  const titulo = (bloque, tabla, categoria) => (tabla.id ? bloque.titulos?.[tabla.id] : bloque.titulo) || [tabla.titulo?.[idioma], categoria.etiqueta].filter(Boolean).join(" · ");
  const columnasDe = (tabla) => tabla.metricas.map((metrica) => ({ clave: metrica.clave, titulo: metrica.titulo[idioma], teclado: metrica.formato === "tiempo" ? "text" : "decimal", formato: metrica.formato }));
  const filasDeTabla = (tabla) => filasDe(tabla).map((fila) => ({ clave: fila.clave, titulo: fila.titulo[idioma], formato: fila.formato }));
  const interpretar = (fila, columna, escrito) => valorDeReferencia(fila.formato || columna.formato || "General", escrito);
  const conPro = test.resumenConPro !== false;
  const columnasDelResumen = [
    { clave: "n", titulo: "n", formato: "General" },
    ...(test.resumen || []).map((clave) => ({ clave, titulo: metricaDe(clave)?.titulo?.[idioma] || clave, formato: metricaDe(clave)?.formato, teclado: metricaDe(clave)?.formato === "tiempo" ? "text" : "decimal" })),
    // «Pro»: en el Excel da #REF! (la celda de la que salía ya no existe).
    ...(conPro ? [{ clave: "_pro", titulo: t("evaluaciones.referencias.pro"), editable: false }] : []),
  ];

  return (
    <div className="app">
      <div className="contenedor contenedor-base">
        {selector}
        {encabezado(t("evaluaciones.referencias.titulo"), t("evaluaciones.referencias.texto"))}
        {arriba}
        {sinEdicion && !soloLectura && <p className="lesiones-estado evaluaciones-sin-referencias">{t("evaluaciones.referencias.faltaActualizacion")}</p>}
        {sinReferencias && <p className="lesiones-estado">{t(puedeCambiar ? "evaluaciones.referencias.sinDatosCargar" : "evaluaciones.referencias.sinDatos")}</p>}
        {test.conReferencias === false && !cargando && !error && <p className="lesiones-estado">{t("evaluaciones.referencias.noTiene")}</p>}
        {puedeCambiar && Object.keys(bloques).length > 0 && <p className="lesiones-ayuda referencias-ayuda">{t("referencias.comoSeCambia")}</p>}
        {!cargando &&
          !error &&
          categoriasConOcultas
            .filter((categoria) => bloques[categoria.valor])
            .flatMap((categoria) => {
              const bloque = bloques[categoria.valor];
              // Un test puede tener sus V.R. en varias tablas (Curl Nórdico e
              // Isoprone: una por evaluación); si no, una sola.
              return tablas.map((tabla, indice) => (
                <section key={`${categoria.valor}-${tabla.id}`} className="tarjeta evaluaciones-bloque referencias-bloque">
                  <div className="evaluaciones-bloque-cabeza">
                    <h2>{titulo(bloque, tabla, categoria)}</h2>
                    {bloque.rotulo && <span>{bloque.rotulo}</span>}
                  </div>
                  <TablaDeReferencia
                    columnas={columnasDe(tabla)}
                    filas={filasDeTabla(tabla)}
                    texto={(fila, columna) => textoDeValor(bloque[fila.clave]?.[columna.clave] ?? null, fila.formato || columna.formato, idioma)}
                    interpretar={interpretar}
                    onCambiar={puedeCambiar ? (fila, columna, valor) => cambiar(["categorias", categoria.valor, fila.clave, columna.clave], valor) : undefined}
                  />
                  {/* Borrar la categoría: en la última de sus tablas. */}
                  {puedeCambiar && indice === tablas.length - 1 && (
                    <div className="referencias-acciones">
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
            <TablaDeReferencia
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
        {historial.leido && !sinEdicion && test.conReferencias !== false && <HistorialDeReferencias entradas={entradas} onVolver={enLinea ? volver : undefined} error={historial.error} />}
      </div>

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
