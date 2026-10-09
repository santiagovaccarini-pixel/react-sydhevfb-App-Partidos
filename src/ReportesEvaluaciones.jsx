import React, { useMemo, useState } from "react";
import { Icono } from "./components/AppChrome";
import { EscudoDeClub } from "./components/ClubCrest";
import { FotoDelJugador } from "./ReportesLesiones.jsx";
import { AREAS } from "./domain/evaluaciones/areas.js";
import { COMPARAR_AL_ABRIR } from "./domain/evaluaciones/categorias.js";
import {
  LISTA_SELECCION,
  VISTA_TODAS,
  columnasDeLaVista,
  columnasVisibles,
  esCategoriaDelClub,
  etiquetaDeOpcion,
  opcionesDeLista,
  textoDeComparar,
  tituloDeColumna,
  tituloDeGrupo,
} from "./domain/evaluaciones/ajustes.js";
import { celdasDeLaFila, textoDeCeldaDelInforme } from "./domain/evaluaciones/celdas.js";
import { calcularFilas, estadisticas, estilosDeFilas, quienEs, vistaDeFilas } from "./domain/evaluaciones/motor.js";
import { TESTS } from "./domain/evaluaciones/tests/index.js";
import { actualesPrimero, esActual } from "./domain/plantel.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// El test que se ve, en un desplegable (Santiago, 09/10: «Que la eleccion de
// test sea un desplegable, no pongas todas las evaluaciones como opciones
// sueltas»), igual en todas las pantallas de Evaluaciones. Con un solo test,
// nada. conRotulo: con «Test» arriba (si el lugar no tiene ya su rótulo);
// tests: cuáles (en Cargar, solo los que se cargan a mano).
export const SelectorDeTest = ({ elegido, alElegir, idioma, conRotulo = true, tests = TESTS }) => {
  if (tests.length < 2) return null;
  const lista = (
    <select className="evaluaciones-elegir-test-lista" value={elegido} aria-label={t("evaluaciones.form.test")} onChange={(evento) => alElegir(evento.target.value)}>
      {tests.map((uno) => (
        <option key={uno.id} value={uno.id}>
          {uno.pestana[idioma]}
        </option>
      ))}
    </select>
  );
  if (!conRotulo) return lista;
  return (
    <label className="campo-inicio evaluaciones-elegir-test">
      <span>{t("evaluaciones.form.test")}</span>
      {lista}
    </label>
  );
};

// Qué parte de un test se ve, si el test tiene vistas (Isocinecia: 60°, 180°,
// 300° o todas, como los botones del Excel). Con el mismo aspecto que el
// desplegable del test.
export const SelectorDeVista = ({ test, elegida, alElegir, idioma }) => {
  if (!test.vistas) return null;
  return (
    <label className="campo-inicio evaluaciones-elegir-test evaluaciones-elegir-vista">
      <span>{test.vistas.rotulo[idioma]}</span>
      <select className="evaluaciones-elegir-vista-lista" value={elegida} onChange={(evento) => alElegir(evento.target.value)}>
        {test.vistas.opciones.map((opcion) => (
          <option key={opcion.clave} value={opcion.clave}>
            {opcion.titulo[idioma]}
          </option>
        ))}
        <option value={VISTA_TODAS}>{test.vistas.todas[idioma]}</option>
      </select>
    </label>
  );
};

// La vista al abrir un test: la primera (en Isocinecia, 60°).
export const vistaInicial = (test) => test.vistas?.opciones?.[0]?.clave || VISTA_TODAS;

// Los reportes de Evaluaciones (Santiago, 09/10), como los de Lesiones: se
// elige cuál ver y se imprime.
//   · Individual: un jugador, todos sus tests. Arriba, como la imagen que
//     mandó Santiago (09/10): el club, la categoría, la última evaluación,
//     cuántas tiene y su foto. Abajo, por área, cada test con sus
//     evaluaciones y todas sus columnas: las últimas 5, y cada lugar se
//     cambia por otra con el desplegable (regla del 09/10). La
//     clasificación general y el puntaje de cada área faltan: Santiago va a
//     explicar cómo salen (09/10).
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
  const texto = (celda) => textoDeCeldaDelInforme(celda, idioma);
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

// Regla para todas las bases (Santiago, 09/10): si un atleta puede tener
// varios registros, el reporte individual los muestra con todas sus
// cabeceras, como Lesiones; se ven los últimos 5 y cada uno de esos 5
// lugares se cambia por otro registro suyo con el desplegable (nunca más de
// 5 a la vez).
export const REGISTROS_A_LA_VISTA = 5;

// Los lugares al abrir: las últimas 5 evaluaciones, de la más vieja a la
// más nueva (como en la Base).
export const ultimosLugares = (suyas) => suyas.slice(-REGISTROS_A_LA_VISTA).map(({ fila }) => fila.id);

// Las evaluaciones de un jugador en un test: una fila por lugar, con todas
// las columnas que el club tiene a la vista. Los colores, como en la Base
// filtrada por el jugador (con todas sus evaluaciones de ese test).
const RegistrosDelJugador = ({ test, suyas, lugares, onElegir, config, idioma, jugadorDe, plural }) => {
  const est = estadisticas(
    test.columnasDelInforme,
    suyas.map(({ celdas }) => celdas),
  );
  const estilos = estilosDeFilas(
    test.reglas,
    suyas.map(({ fila, celdas }) => ({ id: fila.id, celdas })),
    est,
  );
  const titulo = (clave) => {
    const columna = test.columnas.find((una) => una.clave === clave);
    return columna ? tituloDeColumna(test, columna, config, idioma) : clave;
  };
  // El n° y la fecha van juntos en el desplegable de cada fila; el nombre y
  // la fecha de nacimiento ya están arriba.
  const columnas = columnasVisibles(test, config).filter((columna) => !["numero", "fecha", "jugador", "fecha_nac"].includes(columna.clave));
  const etiqueta = ({ fila, celdas }) => [celdas.numero, fila.fecha ? fechaCorta(fila.fecha) : t("evaluaciones.sinFecha")].join(" · ");
  const grupos = [];
  columnas.forEach((columna) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.clave === (columna.grupo || "")) ultimo.cantidad += 1;
    else grupos.push({ clave: columna.grupo || "", cantidad: 1 });
  });
  const conGrupos = grupos.some((grupo) => grupo.clave);
  const elegidas = lugares.map((id) => suyas.find(({ fila }) => fila.id === id)).filter(Boolean);
  return (
    <section className="evaluaciones-registros">
      <header>
        <h3>{test.titulo[idioma]}</h3>
        <p>
          {suyas.length > REGISTROS_A_LA_VISTA
            ? t("evaluaciones.reportes.seVen", { cantidad: plural("evaluaciones.reportes.cantidad", suyas.length), n: REGISTROS_A_LA_VISTA })
            : plural("evaluaciones.reportes.cantidad", suyas.length)}
        </p>
      </header>
      <div className="informe-tabla-marco">
        <table className="informe-tabla evaluaciones-registros-tabla" style={{ "--columnas": columnas.length + 1 }}>
          <thead>
            {conGrupos && (
              <tr className="informe-grupos">
                <th scope="col" rowSpan={2} className="evaluaciones-registros-lugar">
                  {`${titulo("numero")} · ${titulo("fecha")}`}
                </th>
                {grupos.map((grupo, indice) => (
                  <th scope="colgroup" colSpan={grupo.cantidad} key={`${grupo.clave}-${indice}`}>
                    {grupo.clave ? tituloDeGrupo(test, test.grupos?.find((uno) => uno.clave === grupo.clave) || { clave: grupo.clave }, config, idioma) : ""}
                  </th>
                ))}
              </tr>
            )}
            <tr className="informe-cabeceras">
              {!conGrupos && (
                <th scope="col" className="evaluaciones-registros-lugar">
                  {`${titulo("numero")} · ${titulo("fecha")}`}
                </th>
              )}
              {columnas.map((columna) => (
                <th scope="col" key={columna.clave} data-columna={columna.clave}>
                  {titulo(columna.clave)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {elegidas.map((elegida, lugar) => {
              const { fila, celdas } = elegida;
              const { textos } = celdasDeLaFila({ test, columnas, fila, celdas, jugador: jugadorDe(fila.jugador_id), config, idioma });
              return (
                <tr key={lugar}>
                  <td className="evaluaciones-registros-lugar">
                    {/* En pantalla se elige; en papel va el texto. */}
                    <select
                      className="no-imprimir"
                      value={fila.id}
                      aria-label={t("evaluaciones.reportes.queEvaluacion", { n: lugar + 1 })}
                      onChange={(evento) => onElegir(lugar, evento.target.value)}
                    >
                      {suyas.map((una) => (
                        <option key={una.fila.id} value={una.fila.id} disabled={una.fila.id !== fila.id && lugares.includes(una.fila.id)}>
                          {etiqueta(una)}
                        </option>
                      ))}
                    </select>
                    <span className="evaluaciones-solo-papel">{etiqueta(elegida)}</span>
                  </td>
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
    </section>
  );
};

export default function ReportesEvaluaciones({ evaluaciones, referenciasPorTest, plantel, config, equipo, hoy, estado, datosListos }) {
  const { idioma, plural } = useIdioma();
  const [modo, setModo] = useState("menu");
  const [quien, setQuien] = useState("");
  // Qué evaluación va en cada uno de los 5 lugares de cada test, por
  // jugador ("jugador|test": [ids]); sin elegir, las últimas 5.
  const [lugaresPorTest, setLugaresPorTest] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [comparar, setComparar] = useState(COMPARAR_AL_ABRIR);
  const [testId, setTestId] = useState(TESTS[0].id);
  // La vista de cada test en el grupal (Isocinecia: qué velocidad).
  const [vistaPorTest, setVistaPorTest] = useState({});
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

    // Las evaluaciones del jugador en cada test, en el orden del Excel (por
    // fecha y, con la misma fecha, en el orden de carga).
    const ultimas = TESTS.map((test) => {
      const suyas = calculadasPorTest[test.id].filter(({ quien: suyo }) => suyo === elegido.clave);
      return { test, suyas, ultima: suyas[suyas.length - 1] || null };
    }).filter(({ ultima }) => ultima);
    const deUltima = [...ultimas].sort((a, b) => String(a.ultima.fila.fecha || "").localeCompare(String(b.ultima.fila.fecha || ""))).at(-1)?.ultima || null;
    const fechas = new Set(
      evaluaciones.filter((evaluacion) => quienEs(evaluacion) === elegido.clave && evaluacion.fecha).map((evaluacion) => evaluacion.fecha),
    );
    const areas = AREAS.map((area) => ({ area, tests: ultimas.filter(({ test }) => test.area === area.clave) })).filter(({ tests }) => tests.length > 0);
    const seleccion = deUltima?.fila.datos?.seleccion;
    return (
      <div className="app reporte">
        <div className="contenedor contenedor-base">
          {acciones}
          {estado}
          <article className="informe evaluaciones-informe evaluaciones-individual">
            <header className="informe-cabecera">
              <div className="informe-marca-agua" aria-hidden="true">
                <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
              </div>
              <div className="informe-escudo">
                <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
              </div>
              <div className="informe-identidad">
                <p className="informe-subtitulo">{[equipo?.nombre, t("evaluaciones.reportes.performance")].filter(Boolean).join(" · ")}</p>
                <h1>{elegido.nombre}</h1>
                <dl className="informe-datos">
                  {[
                    { clave: "categoria", rotulo: t("evaluaciones.reportes.categoria"), valor: seleccion ? etiquetaDeOpcion(LISTA_SELECCION, seleccion, config, idioma) : "—" },
                    { clave: "ultima", rotulo: t("evaluaciones.reportes.ultima"), valor: deUltima?.fila.fecha ? fechaCorta(deUltima.fila.fecha) : "—" },
                    { clave: "evaluaciones", rotulo: t("evaluaciones.reportes.numeroEvaluaciones"), valor: String(fechas.size) },
                  ].map((dato) => (
                    <div className="informe-dato" key={dato.clave}>
                      <dt>{dato.rotulo}</dt>
                      <dd>{dato.valor}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {elegido.jugador ? <FotoDelJugador jugador={elegido.jugador} /> : <FotoDelJugador jugador={{ nombre: elegido.nombre }} />}
            </header>
            {areas.length === 0 && <p className="vacio-ficha">{t("evaluaciones.reportes.sinEvaluaciones")}</p>}
            {areas.map(({ area, tests }) => (
              <section className="evaluaciones-area" key={area.clave}>
                <h2 className="evaluaciones-area-titulo">{area.titulo[idioma]}</h2>
                {tests.map(({ test, suyas }) => {
                  const clave = `${elegido.clave}|${test.id}`;
                  const lugares = (lugaresPorTest[clave] || ultimosLugares(suyas)).filter((id) => suyas.some(({ fila }) => fila.id === id));
                  return (
                    <RegistrosDelJugador
                      key={test.id}
                      test={test}
                      suyas={suyas}
                      lugares={lugares}
                      onElegir={(lugar, id) => setLugaresPorTest((previos) => ({ ...previos, [clave]: lugares.map((otro, cual) => (cual === lugar ? id : otro)) }))}
                      config={config}
                      idioma={idioma}
                      jugadorDe={jugadorDe}
                      plural={plural}
                    />
                  );
                })}
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
          <SelectorDeTest elegido={test.id} alElegir={setTestId} idioma={idioma} />
          <SelectorDeVista test={test} elegida={vistaPorTest[test.id] || vistaInicial(test)} alElegir={(vista) => setVistaPorTest((antes) => ({ ...antes, [test.id]: vista }))} idioma={idioma} />
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
                columnas={columnasDeLaVista(columnasVisibles(test, config), vistaPorTest[test.id] || vistaInicial(test))}
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
