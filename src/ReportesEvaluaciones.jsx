import React, { useMemo, useState } from "react";
import { Icono } from "./components/AppChrome";
import { EscudoDeClub } from "./components/ClubCrest";
import { COMPARAR_AL_ABRIR } from "./domain/evaluaciones/categorias.js";
import {
  LISTA_SELECCION,
  columnasVisibles,
  esCategoriaDelClub,
  etiquetaDeOpcion,
  opcionesDeLista,
  textoDeComparar,
  tituloDeColumna,
  tituloDeGrupo,
} from "./domain/evaluaciones/ajustes.js";
import { celdasDeLaFila } from "./domain/evaluaciones/celdas.js";
import { textoDeValor } from "./domain/evaluaciones/excel.js";
import { calcularFilas, quienEs, vistaDeFilas } from "./domain/evaluaciones/motor.js";
import { TESTS } from "./domain/evaluaciones/tests/index.js";
import { actualesPrimero, esActual } from "./domain/plantel.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// Los reportes de Evaluaciones (Santiago, 09/10), como los de Lesiones: se
// elige cuál ver y se imprime.
//   · Individual: un jugador, todos sus tests; cada test con sus
//     evaluaciones en el tiempo (valores, clases con sus colores y % de
//     mejora) y el informe del Excel de esas filas, como si en la hoja se
//     filtrara por el jugador.
//   · Grupal: un test, el informe del Excel (promedio, desvío, n, máximo,
//     mínimo y la comparación con los V.R.) por categoría y fechas, con sus
//     evaluaciones.
// Los gráficos se definen más adelante (Santiago, 09/10: "después lo vemos").
// Todo se calcula con lo mismo que la Base (motor.js y celdas.js).

const normalizarTexto = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// La tabla de un test con sus filas: arriba el informe (las filas 2 a 8 del
// Excel, con su rótulo sobre las primeras columnas) y abajo las evaluaciones
// con los colores del Excel. filas: las calculadas que entran ({ fila, celdas }).
const TablaDelTest = ({ test, columnas, filas, referencias, comparar, config, idioma, jugadorDe }) => {
  const { informe, estilos, estilosComparacion } = vistaDeFilas(
    test,
    filas.map(({ fila, celdas }) => ({ id: fila.id, celdas })),
    referencias,
    comparar,
  );
  // Las primeras columnas, hasta la primera con datos en el informe, quedan
  // para el rótulo de cada fila (como las fijas en la Base).
  const conInforme = new Set(test.columnasDelInforme.filter((clave) => clave !== "numero"));
  const primera = columnas.findIndex((columna) => conInforme.has(columna.clave));
  const antes = Math.max(1, primera < 0 ? columnas.length : primera);
  const resto = columnas.slice(antes);
  const texto = (celda) => (celda ? textoDeValor(celda.valor, celda.formato, idioma) : "");
  const rotulo = (fila) => {
    if (fila.id === "comparacion") return textoDeComparar(comparar, config, idioma);
    if (fila.id === "n")
      return (
        <span className="evaluaciones-rotulo-n">
          <b>{texto({ ...fila.celdas.numero, formato: "General" })}</b>
          <span>{fila.rotulo[idioma]}</span>
        </span>
      );
    return fila.rotulo?.[idioma] || "";
  };
  const grupos = [];
  columnas.forEach((columna) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.clave === (columna.grupo || "")) ultimo.cantidad += 1;
    else grupos.push({ clave: columna.grupo || "", cantidad: 1 });
  });
  const conGrupos = grupos.some((grupo) => grupo.clave);
  return (
    <div className="informe-tabla-marco evaluaciones-informe-marco">
      <table className="informe-tabla evaluaciones-informe-tabla" style={{ "--columnas": columnas.length }}>
        <thead>
          {informe.map((fila) => (
            <tr key={fila.id} className={`evaluaciones-informe-arriba informe-${fila.id}`}>
              {fila.id !== "referencia" && (
                <th scope="row" colSpan={antes} rowSpan={fila.id === "comparacion" ? 2 : 1}>
                  {rotulo(fila)}
                </th>
              )}
              {resto.map((columna) => (
                <td key={columna.clave} style={fila.id === "comparacion" ? estilosComparacion[columna.clave] || undefined : undefined}>
                  {texto(fila.celdas[columna.clave])}
                </td>
              ))}
            </tr>
          ))}
          {conGrupos && (
            <tr className="informe-grupos">
              {grupos.map((grupo, indice) => (
                <th scope="colgroup" colSpan={grupo.cantidad} key={`${grupo.clave}-${indice}`}>
                  {grupo.clave ? tituloDeGrupo(test, test.grupos?.find((uno) => uno.clave === grupo.clave) || { clave: grupo.clave }, config, idioma) : ""}
                </th>
              ))}
            </tr>
          )}
          <tr className="informe-cabeceras">
            {columnas.map((columna) => (
              <th scope="col" key={columna.clave} data-columna={columna.clave}>
                {tituloDeColumna(test, columna, config, idioma)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ fila, celdas }) => {
            const { textos } = celdasDeLaFila({ test, columnas, fila, celdas, jugador: jugadorDe(fila.jugador_id), config, idioma });
            return (
              <tr key={fila.id}>
                {columnas.map((columna) => (
                  <td key={columna.clave} data-columna={columna.clave} style={estilos[fila.id]?.[columna.clave] || undefined}>
                    {textos[columna.clave] || ""}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default function ReportesEvaluaciones({ evaluaciones, referenciasPorTest, plantel, config, equipo, hoy, estado, datosListos }) {
  const { idioma, plural } = useIdioma();
  const [modo, setModo] = useState("menu");
  const [quien, setQuien] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [comparar, setComparar] = useState(COMPARAR_AL_ABRIR);
  const [testId, setTestId] = useState(TESTS[0].id);
  const [categoria, setCategoria] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const jugadorDe = (id) => plantel.find((jugador) => String(jugador.id) === String(id)) || null;
  const esCategoria = (codigo) => esCategoriaDelClub(codigo, config);
  const categorias = opcionesDeLista(LISTA_SELECCION, config, idioma);

  // Cada test con lo que el Excel calcula de cada fila, con todas sus
  // evaluaciones (el n° de evaluación y el % de mejora miran todo).
  const calculadasPorTest = useMemo(
    () =>
      Object.fromEntries(
        TESTS.map((test) => [
          test.id,
          calcularFilas(
            test,
            evaluaciones.filter((evaluacion) => evaluacion.test === test.id),
            referenciasPorTest[test.id] || null,
            { esCategoria: (codigo) => esCategoriaDelClub(codigo, config) },
          ),
        ]),
      ),
    [evaluaciones, referenciasPorTest, config],
  );

  const acciones = (
    <div className="reporte-acciones no-imprimir">
      <button type="button" className="boton-secundario reporte-volver" onClick={() => setModo("menu")}>
        <Icono nombre="flecha" size={14} />
        {t("lesiones.reportes.volver")}
      </button>
      <div className="reporte-acciones-derecha">
        {modo === "individual" && quien && (
          <button type="button" className="boton-secundario" onClick={() => setQuien("")}>
            <Icono nombre="cambio" size={16} />
            {t("lesiones.reportes.cambiarJugador")}
          </button>
        )}
        {datosListos && (modo === "grupal" || quien) && (
          <button type="button" className="boton-principal" onClick={() => window.print()}>
            <Icono nombre="documento" size={16} />
            {t("lesiones.reportes.imprimir")}
          </button>
        )}
      </div>
    </div>
  );

  const selectorComparar = (
    <label className="evaluaciones-comparar">
      <span>{t("evaluaciones.comparar")}</span>
      <select value={comparar} onChange={(evento) => setComparar(evento.target.value)}>
        {categorias.map((una) => (
          <option key={una.valor} value={una.valor}>
            {textoDeComparar(una.valor, config, idioma)}
          </option>
        ))}
      </select>
    </label>
  );

  const cabecera = (subtitulo, titulo, datos) => (
    <header className="informe-cabecera evaluaciones-informe-cabecera">
      <div className="informe-marca-agua" aria-hidden="true">
        <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
      </div>
      <div className="informe-escudo">
        <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
      </div>
      <div className="informe-identidad">
        <p className="informe-subtitulo">{subtitulo}</p>
        <h1>{titulo}</h1>
        <dl className="informe-datos">
          {datos.map((dato) => (
            <div className="informe-dato" key={dato.clave}>
              <dt>{dato.rotulo}</dt>
              <dd>{dato.valor}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );

  const pie = (cual) => (
    <footer className="informe-pie">
      <span>{[equipo?.nombre, cual].filter(Boolean).join(" · ")}</span>
      <span>{fechaCorta(hoy)}</span>
    </footer>
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
              <p>{t("evaluaciones.reportes.texto")}</p>
            </div>
          </header>
          {estado}
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{t("lesiones.reportes.ver")}</b>
            </div>
            {tarjeta("individual", "usuario", t("lesiones.reportes.individual"), t("evaluaciones.reportes.individualTexto"))}
            {tarjeta("grupal", "formacion", t("lesiones.reportes.grupal"), t("evaluaciones.reportes.grupalTexto"))}
          </section>
        </div>
      </div>
    );
  }

  // Mientras se cargan las evaluaciones, o si no se pudieron leer, ningún
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

  // --------------------------------------------------------- Individual --
  if (modo === "individual") {
    // Cuántas evaluaciones tiene cada uno (por quién es: el jugador o, fuera
    // de Datos básicos, el nombre).
    const cuantas = new Map();
    const personas = new Map();
    evaluaciones.forEach((evaluacion) => {
      const clave = quienEs(evaluacion);
      cuantas.set(clave, (cuantas.get(clave) || 0) + 1);
      if (!evaluacion.jugador_id && evaluacion.persona && !personas.has(clave)) personas.set(clave, evaluacion.persona);
    });
    // El plantel actual primero; de los que se fueron, los que tienen
    // evaluaciones; al final, quienes no están en Datos básicos.
    const todos = [
      ...actualesPrimero(plantel)
        .filter((jugador) => esActual(jugador) || cuantas.get(quienEs({ jugador_id: jugador.id })))
        .map((jugador) => ({ clave: quienEs({ jugador_id: jugador.id }), nombre: jugador.nombre, jugador })),
      ...[...personas.entries()].map(([clave, nombre]) => ({ clave, nombre, jugador: null })),
    ];
    const elegido = todos.find((uno) => uno.clave === quien) || null;

    if (!elegido) {
      const buscado = normalizarTexto(busqueda);
      const lista = todos.filter((uno) => !buscado || normalizarTexto(uno.nombre).includes(buscado));
      return (
        <div className="app reporte">
          <div className="contenedor contenedor-base">
            {acciones}
            {estado}
            <section className="tarjeta lesiones-elegir-jugador">
              <p className="rotulo-criterio">{t("lesiones.reportes.elegirJugador")}</p>
              <input
                className="lesiones-buscador-jugador"
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder={t("lesiones.historial.buscar")}
                aria-label={t("lesiones.historial.buscar")}
                autoComplete="off"
              />
              <div className="lista-rivales lesiones-lista-jugadores">
                {lista.length === 0 ? (
                  <p className="sin-resultados">{t("lesiones.pasos.ningunJugador")}</p>
                ) : (
                  lista.map((uno) => (
                    <button type="button" key={uno.clave} onClick={() => setQuien(uno.clave)}>
                      <b>{uno.nombre}</b>
                      <span>
                        {[
                          plural("evaluaciones.reportes.cantidad", cuantas.get(uno.clave) || 0),
                          uno.jugador && !esActual(uno.jugador) ? t("datos.yaNoEsta") : "",
                          uno.jugador ? "" : t("evaluaciones.reportes.fueraDeDatos"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      );
    }

    const tests = TESTS.map((test) => ({ test, filas: calculadasPorTest[test.id].filter(({ quien: suyo }) => suyo === elegido.clave) })).filter(({ filas }) => filas.length > 0);
    const total = tests.reduce((suma, { filas }) => suma + filas.length, 0);
    return (
      <div className="app reporte">
        <div className="contenedor contenedor-base">
          {acciones}
          {estado}
          <section className="tarjeta evaluaciones-reporte-filtros no-imprimir">{selectorComparar}</section>
          <article className="informe evaluaciones-informe">
            {cabecera(t("evaluaciones.reportes.individualTitulo"), elegido.nombre, [
              { clave: "nacimiento", rotulo: t("lesiones.reportes.nacimiento"), valor: elegido.jugador?.fecha_nacimiento ? fechaCorta(elegido.jugador.fecha_nacimiento) : "—" },
              { clave: "evaluaciones", rotulo: t("evaluaciones.titulo"), valor: String(total) },
            ])}
            {tests.length === 0 && <p className="vacio-ficha">{t("evaluaciones.reportes.sinEvaluaciones")}</p>}
            {tests.map(({ test, filas }) => (
              <section className="informe-lesiones evaluaciones-informe-test" key={test.id}>
                <div className="informe-seccion">
                  <h2>{test.titulo[idioma]}</h2>
                  <span>{plural("evaluaciones.reportes.cantidad", filas.length)}</span>
                </div>
                <TablaDelTest
                  test={test}
                  // De un jugador: sin su nombre ni su fecha de nacimiento en cada fila.
                  columnas={columnasVisibles(test, config).filter((columna) => !["jugador", "fecha_nac"].includes(columna.clave))}
                  filas={filas}
                  referencias={referenciasPorTest[test.id] || null}
                  comparar={comparar}
                  config={config}
                  idioma={idioma}
                  jugadorDe={jugadorDe}
                />
              </section>
            ))}
            {pie(t("lesiones.reportes.individual"))}
          </article>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- Grupal --
  const test = TESTS.find((uno) => uno.id === testId) || TESTS[0];
  const filas = calculadasPorTest[test.id].filter(({ fila }) => {
    if (categoria && fila.datos?.seleccion !== categoria) return false;
    if ((desde || hasta) && !fila.fecha) return false;
    if (desde && fila.fecha < desde) return false;
    if (hasta && fila.fecha > hasta) return false;
    return true;
  });
  const periodo = desde || hasta ? [desde ? fechaCorta(desde) : "…", hasta ? fechaCorta(hasta) : "…"].join(" – ") : t("lesiones.reportes.periodos.todo");
  return (
    <div className="app reporte">
      <div className="contenedor contenedor-base">
        {acciones}
        {estado}
        <section className="tarjeta evaluaciones-reporte-filtros no-imprimir">
          {TESTS.length > 1 && (
            <div className="grilla-criterios evaluaciones-tests" role="tablist">
              {TESTS.map((uno) => (
                <button key={uno.id} type="button" role="tab" aria-selected={uno.id === test.id} className={`chip-criterio ${uno.id === test.id ? "prendido" : ""}`} onClick={() => setTestId(uno.id)}>
                  {uno.pestana[idioma]}
                </button>
              ))}
            </div>
          )}
          <div className="evaluaciones-reporte-campos">
            <label className="campo-inicio">
              <span>{t("evaluaciones.reportes.categoria")}</span>
              <select value={categoria} onChange={(evento) => setCategoria(evento.target.value)}>
                <option value="">{t("evaluaciones.reportes.todas")}</option>
                {categorias.map((una) => (
                  <option key={una.valor} value={una.valor}>
                    {una.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo-inicio">
              <span>{t("lesiones.reportes.desde")}</span>
              <input type="date" value={desde} max={hasta || undefined} onChange={(evento) => setDesde(evento.target.value)} />
            </label>
            <label className="campo-inicio">
              <span>{t("lesiones.reportes.hasta")}</span>
              <input type="date" value={hasta} min={desde || undefined} onChange={(evento) => setHasta(evento.target.value)} />
            </label>
          </div>
          {selectorComparar}
        </section>
        <article className="informe evaluaciones-informe">
          {cabecera(t("evaluaciones.reportes.grupalTitulo"), test.titulo[idioma], [
            { clave: "categoria", rotulo: t("evaluaciones.reportes.categoria"), valor: categoria ? etiquetaDeOpcion(LISTA_SELECCION, categoria, config, idioma) : t("evaluaciones.reportes.todas") },
            { clave: "periodo", rotulo: t("lesiones.reportes.periodo"), valor: periodo },
            { clave: "evaluaciones", rotulo: t("evaluaciones.titulo"), valor: String(filas.length) },
          ])}
          <section className="informe-lesiones evaluaciones-informe-test">
            {filas.length === 0 ? (
              <p className="vacio-ficha">{t("evaluaciones.reportes.sinFiltradas")}</p>
            ) : (
              <TablaDelTest
                test={test}
                columnas={columnasVisibles(test, config)}
                filas={filas}
                referencias={referenciasPorTest[test.id] || null}
                comparar={comparar}
                config={config}
                idioma={idioma}
                jugadorDe={jugadorDe}
              />
            )}
            <p className="informe-criterio">{test.nota[idioma]}</p>
          </section>
          {pie(t("lesiones.reportes.grupal"))}
        </article>
      </div>
    </div>
  );
}
