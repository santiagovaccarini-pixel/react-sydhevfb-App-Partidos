import React, { useEffect, useMemo, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { SelectorDeTest } from "./ReportesEvaluaciones.jsx";
import { LISTA_SELECCION, opcionesDeLista, tituloDeColumna, tituloDeGrupo } from "./domain/evaluaciones/ajustes.js";
import { deDatosBasicos } from "./domain/evaluaciones/categorias.js";
import { listaDeColumna } from "./domain/evaluaciones/celdas.js";
import { esActual } from "./domain/plantel.js";
import { interpretarMinutos } from "./domain/tabla.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";

// Evaluaciones › Cargar: varios jugadores en la misma evaluación (Santiago,
// 18/10: «que aprietes cargar, elijas el test y cuando le das a siguiente te
// lleva a una fila con las cabeceras del test elegido entonces a la isquierda
// elegis el nombre del jugador y abajo de esa fila un boton que te deje añadir
// un jugador»). En cuestionarios, con maquetas de datos inventados: «Una para
// todos» (la fecha), «Solo el plantel actual y la categoria se rellena con lo
// que tiene en datos basicos con la opcion de cambiarla», en el celular
// «Tarjetas» que «se puedan cerrar y abrir con una flechita al costado
// inferior derecho», y Dispositivo y Medio «Uno para todos pero se puede
// modificar individual».
//   · Paso 1: el test, la fecha y las listas para todos (las sueltas que no
//     son la Selección: en Sentadilla Incremental, Dispositivo y Medio).
//   · Paso 2: en la compu, una tabla con una fila por jugador (el jugador fijo
//     a la izquierda, la tabla se corre de costado); en el celular, una
//     tarjeta por jugador. Abajo, «+ Agregar jugador». Se guarda una
//     evaluación por fila con algo cargado, todas con la misma fecha.
// La carga es de Evaluaciones (para preguntar antes de salir):
// { paso, test, fecha, comunes, filas, siguiente }; cada fila,
// { id, jugador_id, datos, textos, cerrada } (textos: los números y los
// tiempos como se escriben, hasta guardar).

// En el celular, tarjetas (el mismo corte que la barra de abajo).
const CELULAR = "(max-width: 720px)";
// Una lista corta se elige con botones en el paso 1, como en la carga por pasos.
const MAXIMO_CHIPS = 6;
// Desde cuántos bloques seguidos con las mismas columnas (las series de
// Sentadilla Incremental) van en una grilla en la tarjeta.
const BLOQUES_EN_GRILLA = 3;

const sinMatchMedia = () => typeof window === "undefined" || typeof window.matchMedia !== "function";
const esCelular = () => !sinMatchMedia() && window.matchMedia(CELULAR).matches;
const useCelular = () => {
  const [celular, setCelular] = useState(esCelular);
  useEffect(() => {
    if (sinMatchMedia()) return undefined;
    const consulta = window.matchMedia(CELULAR);
    const alCambiar = () => setCelular(Boolean(consulta.matches));
    alCambiar();
    // Al girar el celular o achicar la ventana.
    if (consulta.addEventListener) consulta.addEventListener("change", alCambiar);
    else consulta.addListener?.(alCambiar);
    return () => {
      if (consulta.removeEventListener) consulta.removeEventListener("change", alCambiar);
      else consulta.removeListener?.(alCambiar);
    };
  }, []);
  return celular;
};

const esSeleccion = (columna) => columna.tipo === "lista" && listaDeColumna(columna) === LISTA_SELECCION;
const escrito = (texto) => String(texto ?? "").trim() !== "";

export const cargaNueva = (test) => ({ paso: 0, test, fecha: hoyISO(), comunes: {}, filas: [], siguiente: 1 });

// Lo que la persona cargó en una fila: lo escrito y lo elegido, menos lo que
// se completa solo (la Selección y las listas para todos).
const valoresPropios = (fila, comunes) => [
  ...Object.values(fila.textos || {}).filter(escrito),
  ...Object.entries(fila.datos || {})
    .filter(([clave, valor]) => clave !== LISTA_SELECCION && !(clave in comunes && valor === comunes[clave]))
    .map(([, valor]) => valor)
    .filter(escrito),
];
const tieneDatos = (fila, comunes) => valoresPropios(fila, comunes).length > 0;

// Si hay algo que se perdería al salir.
export const hayAlgoCargado = (carga) => Boolean(carga?.filas?.some((fila) => fila.jugador_id || tieneDatos(fila, carga.comunes || {})));

// Las filas que se guardan: con jugador y algo cargado.
export const filasParaGuardar = (carga) => (carga?.filas || []).filter((fila) => fila.jugador_id && tieneDatos(fila, carga.comunes || {}));

// Cuántas medidas tiene cargadas una fila, de cuántas (en la tarjeta cerrada;
// la nota no es una medida).
const medidasDe = (fila, columnas, comunes) => {
  const propias = columnas.filter((columna) => columna.tipo !== "texto" && !esSeleccion(columna) && !comunes.some((comun) => comun.clave === columna.clave));
  const cargadas = propias.filter((columna) => escrito(["tiempo", "numero"].includes(columna.tipo) ? fila.textos?.[columna.clave] : fila.datos?.[columna.clave])).length;
  return { cargadas, total: propias.length };
};

// Las evaluaciones de la carga: { evaluaciones: [{ filaId, evaluacion }] } o
// { error } (lo que falta, con el jugador o la fila).
export const evaluacionesDeLaCarga = (carga, { columnas, nombreDe, titulo }) => {
  if (!carga.fecha) return { error: t("evaluaciones.form.faltaFecha") };
  if (carga.fecha > hoyISO()) return { error: t("evaluaciones.error.fechaFutura") };
  const evaluaciones = [];
  for (const [indice, fila] of carga.filas.entries()) {
    const quien = fila.jugador_id ? nombreDe(fila.jugador_id) : t("evaluaciones.varios.fila", { n: indice + 1 });
    if (!fila.jugador_id) {
      if (tieneDatos(fila, carga.comunes)) return { error: t("evaluaciones.varios.faltaJugador", { n: indice + 1 }) };
    } else if (tieneDatos(fila, carga.comunes)) {
      const datos = {};
      for (const columna of columnas) {
        const clave = columna.clave;
        if (["tiempo", "numero"].includes(columna.tipo)) {
          const limpio = String(fila.textos?.[clave] ?? "").trim();
          if (!limpio) continue;
          const valor = columna.tipo === "tiempo" ? interpretarMinutos(limpio) : Number(limpio.replace(",", "."));
          const bien = columna.tipo === "tiempo" ? typeof valor === "number" : Number.isFinite(valor);
          if (!bien) return { error: `${quien}: ${t(columna.tipo === "tiempo" ? "evaluaciones.form.tiempoMal" : "evaluaciones.form.numeroMal", { columna: titulo(columna), valor: limpio })}` };
          datos[clave] = valor;
        } else if (escrito(fila.datos?.[clave])) {
          datos[clave] = fila.datos[clave];
        }
      }
      evaluaciones.push({ filaId: fila.id, evaluacion: { jugador_id: fila.jugador_id, persona: null, fecha: carga.fecha, datos } });
    }
  }
  return { evaluaciones };
};

// Los tramos de columnas seguidas del mismo bloque (o sin bloque).
const tramosDe = (columnas) =>
  columnas.reduce((tramos, columna) => {
    const grupo = columna.grupo || null;
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.grupo === grupo) ultimo.columnas.push(columna);
    else tramos.push({ grupo, columnas: [columna] });
    return tramos;
  }, []);

// Lo común al principio de varios títulos, hasta un espacio («Serie 1» …
// «Serie 5»: «Serie»).
const comienzoComun = (textos) => {
  if (textos.length < 2) return "";
  let comun = textos[0];
  textos.slice(1).forEach((texto) => {
    while (comun && !texto.startsWith(comun)) comun = comun.slice(0, -1);
  });
  const corte = comun.lastIndexOf(" ");
  return corte > 0 ? comun.slice(0, corte + 1) : "";
};

export default function CargaPorJugador({ carga, setCarga, tests, columnas, comunes, config, plantel, encabezado, error, setError, ocupado, onCancelar, onGuardar }) {
  const { idioma, plural } = useIdioma();
  const celular = useCelular();
  const [eligiendo, setEligiendo] = useState(null);
  const [aSacar, setASacar] = useState(null);
  const test = tests.find((uno) => uno.id === carga.test) || tests[0];
  const titulo = (columna) => tituloDeColumna(test, columna, config, idioma);
  const tituloDelGrupo = (grupo) => tituloDeGrupo(test, test.grupos?.find((uno) => uno.clave === grupo) || { clave: grupo }, config, idioma);
  const opcionesDe = (columna) => opcionesDeLista(listaDeColumna(columna), config, idioma, { test });
  const jugadorDe = (id) => plantel.find((jugador) => String(jugador.id) === String(id)) || null;
  const nombreDe = (id) => jugadorDe(id)?.nombre || "";
  const tramos = useMemo(() => tramosDe(columnas), [columnas]);
  const hayBloques = tramos.some((tramo) => tramo.grupo);
  const conTiempos = columnas.some((columna) => columna.tipo === "tiempo");
  const aGuardar = filasParaGuardar(carga).length;

  const cambiar = (cambios) => setCarga((actual) => ({ ...actual, ...cambios }));
  const cambiarFila = (id, cambio) => setCarga((actual) => ({ ...actual, filas: actual.filas.map((fila) => (fila.id === id ? cambio(fila) : fila)) }));
  const filaNueva = (actual) => ({ id: actual.siguiente, jugador_id: null, datos: Object.fromEntries(Object.entries(actual.comunes).filter(([, valor]) => valor)), textos: {}, cerrada: false });

  // Una lista para todos: cambia también en las filas que tenían la anterior
  // (no en las que se cambiaron a mano).
  const cambiarComun = (clave, valor) =>
    setCarga((actual) => {
      const antes = actual.comunes[clave] ?? null;
      return {
        ...actual,
        comunes: { ...actual.comunes, [clave]: valor },
        filas: actual.filas.map((fila) => ((fila.datos[clave] ?? null) === antes ? { ...fila, datos: { ...fila.datos, [clave]: valor } } : fila)),
      };
    });

  // Otro test: quedan los jugadores y su Selección; lo demás es del test anterior.
  const cambiarTest = (id) =>
    setCarga((actual) => ({
      ...actual,
      test: id,
      comunes: {},
      filas: actual.filas.map((fila) => ({ ...fila, datos: fila.datos[LISTA_SELECCION] ? { [LISTA_SELECCION]: fila.datos[LISTA_SELECCION] } : {}, textos: {} })),
    }));

  const irAlPaso = (paso) => {
    if (paso === 1) {
      if (!carga.fecha) return setError(t("evaluaciones.form.faltaFecha"));
      if (carga.fecha > hoyISO()) return setError(t("evaluaciones.error.fechaFutura"));
    }
    setError("");
    setCarga((actual) => (paso === 1 && actual.filas.length === 0 ? { ...actual, paso, filas: [filaNueva(actual)], siguiente: actual.siguiente + 1 } : { ...actual, paso }));
    return undefined;
  };

  const agregarJugador = () => {
    const id = carga.siguiente;
    setCarga((actual) => ({ ...actual, filas: [...actual.filas, filaNueva(actual)], siguiente: actual.siguiente + 1 }));
    setEligiendo(id);
  };

  // El jugador de una fila: del plantel actual, sin repetir. Trae su
  // categoría de Datos básicos, que se puede cambiar.
  const elegirJugador = (filaId, valor) => {
    const jugador = jugadorDe(valor);
    if (!jugador) return;
    const categoria = deDatosBasicos(jugador.categoria);
    const deLaLista = categoria && opcionesDeLista(LISTA_SELECCION, config, idioma).some((opcion) => opcion.valor === categoria);
    cambiarFila(filaId, (fila) => ({ ...fila, jugador_id: jugador.id, datos: deLaLista ? { ...fila.datos, [LISTA_SELECCION]: categoria } : fila.datos }));
  };
  const opcionesDeJugador = (filaId) => {
    const enOtras = new Set(carga.filas.filter((fila) => fila.id !== filaId && fila.jugador_id).map((fila) => String(fila.jugador_id)));
    return plantel.filter((jugador) => esActual(jugador) && !enOtras.has(String(jugador.id))).map((jugador) => ({ valor: String(jugador.id), etiqueta: jugador.nombre }));
  };

  // Sacar una fila: si tiene algo cargado, se pregunta.
  const sacarFila = (fila) => {
    if (tieneDatos(fila, carga.comunes)) setASacar(fila);
    else setCarga((actual) => ({ ...actual, filas: actual.filas.filter((una) => una.id !== fila.id) }));
  };

  const progreso = (
    <>
      <div className="lesiones-progreso" role="tablist" aria-label={t("lesiones.pasos.paso", { n: carga.paso + 1, total: 2 })}>
        {[t("evaluaciones.varios.paso1"), t("evaluaciones.varios.paso2")].map((rotulo, indice) => (
          <button
            type="button"
            role="tab"
            key={rotulo}
            aria-selected={indice === carga.paso}
            aria-label={rotulo}
            className={`${indice === carga.paso ? "actual" : ""} ${indice < carga.paso ? "hecho" : ""}`.trim()}
            onClick={() => irAlPaso(indice)}
          />
        ))}
      </div>
      <p className="lesiones-paso-numero">{t("lesiones.pasos.paso", { n: carga.paso + 1, total: 2 })}</p>
    </>
  );

  // ------------------------------------------------------------ Paso 1 --

  const listaParaTodos = (columna) => {
    const opciones = opcionesDe(columna);
    const valor = carga.comunes[columna.clave] || null;
    return (
      <div className="campo-inicio lesiones-campo-paso" key={columna.clave}>
        <label>{titulo(columna)}</label>
        {opciones.length <= MAXIMO_CHIPS ? (
          <div className="grilla-criterios lesiones-chips">
            {opciones.map((opcion) => (
              <button
                type="button"
                key={opcion.valor}
                className={`chip-criterio ${valor === opcion.valor ? "prendido" : ""}`}
                aria-pressed={valor === opcion.valor}
                onClick={() => cambiarComun(columna.clave, valor === opcion.valor ? null : opcion.valor)}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>
        ) : (
          <select value={valor || ""} aria-label={titulo(columna)} onChange={(evento) => cambiarComun(columna.clave, evento.target.value || null)}>
            <option value="">{t("comun.sinDato")}</option>
            {opciones.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  };

  const paso1 = (
    <>
      <section className="lesiones-paso-titulo">
        <h2>{t("evaluaciones.varios.paso1")}</h2>
        <p>{comunes.length ? t("evaluaciones.varios.paso1ConListas") : t("evaluaciones.varios.paso1Texto")}</p>
      </section>
      {error && <div className="aviso-hoja">{error}</div>}
      <section className="tarjeta tarjeta-ficha lesiones-grupo">
        {tests.length > 1 && (
          <div className="campo-inicio lesiones-campo-paso">
            <label>{t("evaluaciones.form.test")}</label>
            <SelectorDeTest tests={tests} elegido={carga.test} alElegir={cambiarTest} idioma={idioma} conRotulo={false} />
          </div>
        )}
        <div className="campo-inicio lesiones-campo-paso">
          <label>{t("evaluaciones.varios.fecha")}</label>
          <input type="date" value={carga.fecha || ""} max={hoyISO()} onChange={(evento) => cambiar({ fecha: evento.target.value || null })} />
        </div>
        {comunes.map(listaParaTodos)}
      </section>
      <div className="acciones-dobles">
        <BotonVolver onClick={onCancelar}>{t("comun.cancelar")}</BotonVolver>
        <button type="button" className="boton-principal" onClick={() => irAlPaso(1)}>
          {t("lesiones.pasos.siguiente")}
        </button>
      </div>
    </>
  );

  // ------------------------------------------------------------ Paso 2 --

  const rotuloDe = (fila, indice) => nombreDe(fila.jugador_id) || t("evaluaciones.varios.fila", { n: indice + 1 });

  // Un dato de una fila: una lista, un número o un tiempo, o la nota.
  const campo = (fila, columna, rotulo) => {
    const clave = columna.clave;
    if (columna.tipo === "lista") {
      return (
        <select value={fila.datos[clave] || ""} aria-label={rotulo} onChange={(evento) => cambiarFila(fila.id, (una) => ({ ...una, datos: { ...una.datos, [clave]: evento.target.value || null } }))}>
          <option value="">—</option>
          {opcionesDe(columna).map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      );
    }
    if (columna.tipo === "texto") {
      return <input type="text" className="evaluaciones-varios-nota" value={fila.datos[clave] || ""} aria-label={rotulo} onChange={(evento) => cambiarFila(fila.id, (una) => ({ ...una, datos: { ...una.datos, [clave]: evento.target.value } }))} />;
    }
    return (
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={columna.tipo === "tiempo" ? "evaluaciones-varios-tiempo" : "evaluaciones-varios-numero"}
        placeholder={columna.tipo === "tiempo" ? "0:00" : undefined}
        value={fila.textos[clave] ?? ""}
        aria-label={rotulo}
        onChange={(evento) => cambiarFila(fila.id, (una) => ({ ...una, textos: { ...una.textos, [clave]: evento.target.value } }))}
      />
    );
  };
  // Cómo se nombra un dato para quien no ve la cabecera.
  const rotuloDelDato = (fila, indice, columna) => [rotuloDe(fila, indice), columna.grupo ? tituloDelGrupo(columna.grupo) : null, titulo(columna)].filter(Boolean).join(" · ");

  const botonJugador = (fila, indice) => (
    <button type="button" className={`evaluaciones-varios-jugador ${fila.jugador_id ? "" : "vacio"}`.trim()} onClick={() => setEligiendo(fila.id)} aria-label={fila.jugador_id ? `${t("evaluaciones.varios.cambiarJugador")}: ${nombreDe(fila.jugador_id)}` : `${t("evaluaciones.varios.elegirJugador")} (${t("evaluaciones.varios.fila", { n: indice + 1 })})`}>
      <b>{fila.jugador_id ? nombreDe(fila.jugador_id) : t("evaluaciones.varios.elegirJugador")}</b>
      <Icono nombre="flecha" size={14} />
    </button>
  );
  const botonSacar = (fila, indice) => (
    <button type="button" className="evaluaciones-varios-sacar" aria-label={`${t("evaluaciones.varios.sacar")}: ${rotuloDe(fila, indice)}`} title={t("evaluaciones.varios.sacar")} onClick={() => sacarFila(fila)}>
      <Icono nombre="borrar" size={16} />
    </button>
  );

  // En la compu: la tabla. Con bloques, sus títulos arriba de sus columnas.
  const tabla = (
    <section className="tarjeta evaluaciones-varios">
      <div className="evaluaciones-varios-marco">
        <table className="evaluaciones-varios-tabla">
          <thead>
            <tr>
              <th className="fija" rowSpan={hayBloques ? 2 : 1}>
                {t("evaluaciones.varios.jugador")}
              </th>
              {tramos.map((tramo, indice) =>
                tramo.grupo ? (
                  <th key={`g-${indice}`} colSpan={tramo.columnas.length} className={`bloque ${indice % 2 ? "" : "par"}`.trim()}>
                    {tituloDelGrupo(tramo.grupo)}
                  </th>
                ) : (
                  tramo.columnas.map((columna) => (
                    <th key={columna.clave} rowSpan={hayBloques ? 2 : 1}>
                      {titulo(columna)}
                    </th>
                  ))
                ),
              )}
              <th rowSpan={hayBloques ? 2 : 1} aria-label={t("evaluaciones.varios.sacar")} />
            </tr>
            {hayBloques && (
              <tr>
                {tramos.map((tramo, indice) =>
                  tramo.grupo
                    ? tramo.columnas.map((columna, enElTramo) => (
                        <th key={columna.clave} className={`${enElTramo === 0 ? "inicio" : ""} ${indice % 2 ? "" : "par"}`.trim() || undefined}>
                          {titulo(columna)}
                        </th>
                      ))
                    : null,
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {carga.filas.map((fila, indiceFila) => (
              <tr key={fila.id}>
                <td className="fija">{botonJugador(fila, indiceFila)}</td>
                {tramos.map((tramo, indice) =>
                  tramo.columnas.map((columna, enElTramo) => (
                    <td key={columna.clave} className={tramo.grupo ? `${enElTramo === 0 ? "inicio" : ""} ${indice % 2 ? "" : "par"}`.trim() || undefined : undefined}>
                      {campo(fila, columna, rotuloDelDato(fila, indiceFila, columna))}
                    </td>
                  )),
                )}
                <td>{botonSacar(fila, indiceFila)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="boton-secundario evaluaciones-varios-agregar" onClick={agregarJugador}>
        {t("evaluaciones.varios.agregar")}
      </button>
    </section>
  );

  // En el celular: una tarjeta por jugador, con sus datos por bloque. Los
  // bloques seguidos con las mismas columnas (las series), en una grilla.
  const tramosDeLaTarjeta = useMemo(() => {
    const juntos = [];
    tramos.forEach((tramo) => {
      const anterior = juntos[juntos.length - 1];
      const firma = tramo.grupo ? tramo.columnas.map((columna) => titulo(columna)).join("|") : null;
      if (firma && anterior?.firma === firma) anterior.tramos.push(tramo);
      else juntos.push({ firma, tramos: [tramo] });
    });
    return juntos.flatMap((junto) => (junto.firma && junto.tramos.length >= BLOQUES_EN_GRILLA ? [{ grilla: junto.tramos }] : junto.tramos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tramos, config, idioma]);

  const camposDeLaTarjeta = (fila, indiceFila, lista) => (
    <div className="evaluaciones-varios-campos">
      {lista.map((columna) => (
        <label key={columna.clave} className={(columna.tipo === "lista" && !esSeleccion(columna)) || columna.tipo === "texto" ? "ancha" : undefined}>
          <span>{titulo(columna)}</span>
          {campo(fila, columna, rotuloDelDato(fila, indiceFila, columna))}
        </label>
      ))}
    </div>
  );

  const tarjeta = (fila, indiceFila) => {
    const { cargadas, total } = medidasDe(fila, columnas, comunes);
    const seleccion = opcionesDeLista(LISTA_SELECCION, config, idioma, { conOcultas: true }).find((opcion) => opcion.valor === fila.datos[LISTA_SELECCION])?.etiqueta;
    return (
      <section className={`tarjeta evaluaciones-varios-tarjeta ${fila.cerrada ? "cerrada" : ""}`.trim()} key={fila.id}>
        <div className="evaluaciones-varios-arriba">
          {botonJugador(fila, indiceFila)}
          {botonSacar(fila, indiceFila)}
        </div>
        {!fila.cerrada &&
          tramosDeLaTarjeta.map((tramo, indice) => {
            if (tramo.grilla) {
              const titulos = tramo.grilla.map((uno) => tituloDelGrupo(uno.grupo));
              const comun = comienzoComun(titulos);
              const primeras = tramo.grilla[0].columnas;
              return (
                <div className="evaluaciones-varios-bloque" key={`grilla-${indice}`}>
                  {comun && <p className="evaluaciones-varios-bloque-titulo">{comun.trim()}</p>}
                  <div className="evaluaciones-varios-grilla" style={{ gridTemplateColumns: ["auto", ...primeras.map((columna) => (columna.tipo === "lista" ? "minmax(0, 1.25fr)" : "minmax(0, 1fr)"))].join(" ") }}>
                    <span />
                    {primeras.map((columna) => (
                      <span key={columna.clave} className="evaluaciones-varios-grilla-titulo">
                        {titulo(columna)}
                      </span>
                    ))}
                    {tramo.grilla.map((uno, enLaGrilla) => (
                      <React.Fragment key={uno.grupo}>
                        <b>{titulos[enLaGrilla].slice(comun.length) || titulos[enLaGrilla]}</b>
                        {uno.columnas.map((columna) => (
                          <React.Fragment key={columna.clave}>{campo(fila, columna, rotuloDelDato(fila, indiceFila, columna))}</React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <div className={`evaluaciones-varios-bloque ${indice === 0 ? "primero" : ""}`.trim()} key={`tramo-${indice}`}>
                {tramo.grupo && <p className="evaluaciones-varios-bloque-titulo">{tituloDelGrupo(tramo.grupo)}</p>}
                {camposDeLaTarjeta(fila, indiceFila, tramo.columnas)}
              </div>
            );
          })}
        <div className="evaluaciones-varios-abajo">
          {fila.cerrada && <p>{[seleccion, plural("evaluaciones.varios.medidas", cargadas, { total })].filter(Boolean).join(" · ")}</p>}
          <button
            type="button"
            className="evaluaciones-varios-flecha"
            aria-expanded={!fila.cerrada}
            aria-label={`${t(fila.cerrada ? "evaluaciones.varios.abrir" : "evaluaciones.varios.cerrar")}: ${rotuloDe(fila, indiceFila)}`}
            title={t(fila.cerrada ? "evaluaciones.varios.abrir" : "evaluaciones.varios.cerrar")}
            onClick={() => cambiarFila(fila.id, (una) => ({ ...una, cerrada: !una.cerrada }))}
          >
            <Icono nombre="flecha" size={16} />
          </button>
        </div>
      </section>
    );
  };

  const paso2 = (
    <>
      <section className="lesiones-paso-titulo">
        <h2>{t("evaluaciones.varios.paso2")}</h2>
        <p>
          {t(celular ? "evaluaciones.varios.paso2Celular" : "evaluaciones.varios.paso2Texto")}
          {conTiempos && ` ${t("evaluaciones.form.tiempoAyuda")}`}
        </p>
      </section>
      {error && <div className="aviso-hoja">{error}</div>}
      {!plantel.some(esActual) && <p className="lesiones-estado">{t("lesiones.sinJugadores")}</p>}
      {celular ? (
        <div className="evaluaciones-varios-tarjetas">
          {carga.filas.map(tarjeta)}
          <button type="button" className="boton-secundario evaluaciones-varios-agregar" onClick={agregarJugador}>
            {t("evaluaciones.varios.agregar")}
          </button>
        </div>
      ) : (
        tabla
      )}
      <div className="acciones-dobles">
        <BotonVolver onClick={() => irAlPaso(0)}>{t("lesiones.pasos.atras")}</BotonVolver>
        <button type="button" className="boton-principal" onClick={onGuardar} disabled={ocupado || aGuardar === 0}>
          {ocupado ? t("comun.guardando") : plural("evaluaciones.varios.guardar", aGuardar)}
        </button>
      </div>
    </>
  );

  const filaEligiendo = carga.filas.find((fila) => fila.id === eligiendo) || null;
  return (
    <div className="app">
      <div className="contenedor">
        {encabezado(t("evaluaciones.form.nueva"), carga.paso === 0 ? t("evaluaciones.varios.texto") : `${test.pestana[idioma]} · ${fechaCorta(carga.fecha)}`, progreso)}
        {carga.paso === 0 ? paso1 : paso2}
      </div>

      <HojaOpciones
        abierta={Boolean(filaEligiendo)}
        titulo={t("evaluaciones.varios.elegirJugador")}
        opciones={filaEligiendo ? opcionesDeJugador(filaEligiendo.id) : []}
        elegida={filaEligiendo?.jugador_id ? String(filaEligiendo.jugador_id) : null}
        buscador={plantel.length > 8}
        onElegir={(valor) => {
          if (filaEligiendo) elegirJugador(filaEligiendo.id, valor);
          setEligiendo(null);
        }}
        onCerrar={() => setEligiendo(null)}
      />

      <HojaConfirmar
        abierta={Boolean(aSacar)}
        titulo={t("evaluaciones.varios.sacarTitulo")}
        descripcion={t("evaluaciones.varios.sacarTexto", { jugador: aSacar ? nombreDe(aSacar.jugador_id) || t("evaluaciones.varios.estaFila") : "" })}
        icono="borrar"
        etiquetaConfirmar={t("evaluaciones.varios.siSacar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={() => {
          const id = aSacar?.id;
          setASacar(null);
          setCarga((actual) => ({ ...actual, filas: actual.filas.filter((fila) => fila.id !== id) }));
        }}
        onCancelar={() => setASacar(null)}
      />
    </div>
  );
}
