import React, { useCallback, useMemo, useState } from "react";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { BotonGuia } from "./components/Guia.jsx";
import { ListaParaMarcar } from "./components/ListaParaMarcar.jsx";
import { HojaInferior } from "./components/SheetPanel.js";
import { TablaDatos } from "./components/TablaDatos.jsx";
import { textoDeValor } from "./domain/evaluaciones/excel.js";
import { AUTOMATICO, CATEGORIAS_CON_CORTE, MANUAL, MAS_ES_MEJOR, MENOS_ES_MEJOR, cortesValidos, opcionesDeCorte, sumaCompleta, sumaDePorcentajes } from "./domain/valorReferencial.js";
import { armarPlanilla, calcularPlanilla, eleccionDeEntrada, muestraDeLosFiltros, numerosParaGuardar } from "./domain/gps/planillaVr.js";
import { filtrarFilas } from "./domain/tabla.js";
import { t, useIdioma } from "./idioma/index.js";
import { hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// GPS › Valores de referencia › «Agregar V.R.» con la planilla del club
// (nota 2 de la planilla de valor referencial; la maqueta del 19/10, con lo
// que pidió Santiago al verla). Dos pasos:
//   1. El nombre (uno solo, libre) y la muestra: todas las filas del
//      dispositivo en la Base, como en la Base (también las del promedio del
//      equipo: «Se ven y se filtran»), filtradas con el embudo de cada
//      columna. Arriba, cuántas filas, jugadores y fechas quedan.
//   2. El V.R.: arriba, qué medidas entran (las columnas de números; de
//      entrada, todas: «Vienen todas las numericas»); por medida, el sentido
//      (el de Ajustes › Cabeceras) y Automático o Manual, que se pueden
//      cambiar; en Manual, los desvíos de Excelente, Muy bueno, Regular y
//      Malo, de entrada los de Automático, con lo que ofrece la planilla, y
//      la suma de los %, que tiene que dar 100 % para guardar; los cinco
//      valores con qué parte de la muestra cae en cada uno; y cuántos datos
//      se usaron, con los atípicos a la vista («agregale alguna manera de
//      poder ver que datos se descartaron como atipicos»). En la compu, una
//      tabla; en el celular, una tarjeta por medida.
// Al guardar, el V.R. queda como uno por jugador (sus cinco filas) y con qué
// se calculó, para «Recalcular» (domain/gps/planillaVr.js).
//
// filas: las del dispositivo, armadas como en la Base ({ id, valores,
// textos, gps }); columnas: las de la Base (sin editar); medidas: las
// columnas de números que se pueden elegir; textoDe(columna, valor): cómo se
// ve un número;
// onGuardar({ nombre, promedio, desvio, categorias, planilla }) → { error }.

const CATEGORIAS = ["excelente", "muy_bueno", "bueno", "regular", "malo"];
const SENTIDOS = [
  [MAS_ES_MEJOR, "lesiones.ajustes.masEsMejor"],
  [MENOS_ES_MEJOR, "lesiones.ajustes.menosEsMejor"],
];
const MODOS = [
  [AUTOMATICO, "gps.vr.planilla.automatico"],
  [MANUAL, "gps.vr.planilla.manual"],
];

const Elegir = ({ etiqueta, valor, opciones, onCambiar }) => (
  <select className="planilla-vr-elegir" aria-label={etiqueta} value={valor} onChange={(evento) => onCambiar(evento.target.value)}>
    {opciones.map(([opcion, clave]) => (
      <option key={opcion} value={opcion}>
        {t(clave)}
      </option>
    ))}
  </select>
);

export default function PlanillaVrGps({ dispositivo, filas, columnas, fijas, medidas, tituloDe, textoDe, sentidoDeAjustes, onGuardar, onCancelar, onGuia }) {
  const { idioma, plural } = useIdioma();
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState("");
  const [filtros, setFiltros] = useState({});
  const [eleccion, setEleccion] = useState(() => eleccionDeEntrada(medidas, sentidoDeAjustes));
  // Las medidas que entran (de entrada, todas) y la hoja para elegirlas.
  const [elegidas, setElegidas] = useState(() => medidas.map((columna) => columna.clave));
  const [hojaMedidas, setHojaMedidas] = useState(null);
  const [verAtipicos, setVerAtipicos] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const muestra = useMemo(() => filtrarFilas(filas, filtros), [filas, filtros]);
  const resumen = useCallback(
    (lista) => {
      const jugadores = new Set(lista.filter((fila) => fila.gps?.jugador_id).map((fila) => String(fila.gps.jugador_id)));
      const fechas = lista
        .map((fila) => fila.valores?.fecha)
        .filter(Boolean)
        .sort();
      return [
        plural("gps.vr.planilla.filas", lista.length),
        plural("gps.vr.planilla.jugadores", jugadores.size),
        fechas.length ? t("gps.vr.planilla.fechas", { desde: lista.find((fila) => fila.valores?.fecha === fechas[0])?.textos?.fecha, hasta: lista.find((fila) => fila.valores?.fecha === fechas.at(-1))?.textos?.fecha }) : "",
      ]
        .filter(Boolean)
        .join(" · ");
    },
    [plural],
  );
  const vista = useCallback(
    (lista) => ({
      estilos: {},
      encima: (
        <p className="planilla-vr-muestra" role="status">
          <b>{t("gps.vr.planilla.muestra")}</b> {resumen(lista)}
        </p>
      ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resumen, idioma],
  );

  const medidasElegidas = useMemo(() => medidas.filter((columna) => elegidas.includes(columna.clave)), [medidas, elegidas]);
  const calculos = useMemo(
    () => (paso === 1 ? calcularPlanilla(muestra.map((fila) => fila.gps), medidasElegidas, eleccion) : null),
    [paso, muestra, medidasElegidas, eleccion],
  );
  const cambiar = (clave, campo, valor) => setEleccion((antes) => ({ ...antes, [clave]: { ...antes[clave], [campo]: valor } }));
  // A Manual: los desvíos arrancan como los de Automático (Santiago, 19/10).
  const cambiarModo = (clave, modo) =>
    setEleccion((antes) => ({
      ...antes,
      [clave]: { ...antes[clave], modo, ...(modo === MANUAL ? { cortes: cortesValidos(calculos?.[clave]?.resultado?.desvios || antes[clave]?.cortes || {}) } : {}) },
    }));
  const cambiarCorte = (clave, categoria, valor) =>
    setEleccion((antes) => ({ ...antes, [clave]: { ...antes[clave], cortes: cortesValidos({ ...antes[clave]?.cortes, [categoria]: Number(valor) }) } }));
  const porcentaje = (valor) => textoDeValor(valor, "0.0%", idioma);
  const desvios = (valor) => new Intl.NumberFormat(idioma, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);

  const siguiente = () => {
    if (!nombre.trim()) {
      setError(t("gps.vr.planilla.faltaNombre"));
      return;
    }
    if (!muestra.length) {
      setError(t("gps.vr.planilla.sinFilas"));
      return;
    }
    setError("");
    setPaso(1);
    window.scrollTo?.(0, 0);
  };
  const atras = () => {
    setError("");
    setPaso(0);
    window.scrollTo?.(0, 0);
  };
  const guardar = async () => {
    if (guardando) return;
    const numeros = numerosParaGuardar(calculos);
    if (!Object.keys(numeros.promedio).length) {
      setError(t("gps.vr.planilla.ningunaMedida"));
      return;
    }
    // La suma de los % de cada medida tiene que dar 100 % (Santiago, 19/10:
    // «si no es 100% no se deja avanzar»).
    const sinCien = medidasElegidas.find((columna) => calculos[columna.clave]?.resultado && !sumaCompleta(calculos[columna.clave].resultado));
    if (sinCien) {
      setError(t("gps.vr.planilla.sumaMal", { medida: tituloDe(sinCien.clave), suma: porcentaje(sumaDePorcentajes(calculos[sinCien.clave].resultado)) }));
      return;
    }
    setError("");
    setGuardando(true);
    const deLasElegidas = Object.fromEntries(medidasElegidas.map((columna) => [columna.clave, eleccion[columna.clave]]));
    const planilla = armarPlanilla({ muestra: muestraDeLosFiltros(filas, filtros), eleccion: deLasElegidas, filas: muestra.length, calculado: hoyISO() });
    const respuesta = await onGuardar({ nombre: nombre.trim(), ...numeros, planilla });
    setGuardando(false);
    if (respuesta?.error) setError(t(respuesta.error));
  };

  const datos = (clave) => {
    const resultado = calculos?.[clave]?.resultado;
    if (!resultado) return t("gps.vr.planilla.sinDatos");
    return (
      <>
        {t("gps.vr.planilla.usados", { usados: resultado.usados, n: resultado.n })}
        {resultado.descartados > 0 && (
          <>
            {" · "}
            <button type="button" className="planilla-vr-ver-atipicos" onClick={() => setVerAtipicos(clave)}>
              {plural("gps.vr.planilla.verAtipicos", resultado.descartados)}
            </button>
          </>
        )}
      </>
    );
  };
  const tituloDeCategoria = (categoria) => t(`gps.vr.${categoria}`);

  // En Manual: los desvíos de cada categoría (lo que ofrece la planilla) y la
  // suma de los %.
  const cortesManuales = (columna, titulo) => {
    const elegido = eleccion[columna.clave];
    if (elegido?.modo !== MANUAL) return null;
    const cortes = cortesValidos(elegido.cortes || {});
    const resultado = calculos?.[columna.clave]?.resultado;
    const completa = sumaCompleta(resultado);
    return (
      <div className="planilla-vr-cortes">
        <span className="planilla-vr-cortes-titulo">{t("gps.vr.planilla.desvios")}</span>
        <div className="planilla-vr-cortes-grilla">
          {CATEGORIAS_CON_CORTE.map((categoria) => (
            <label key={categoria} className={`cat-${categoria}`}>
              <span>{tituloDeCategoria(categoria)}</span>
              <select
                className="planilla-vr-elegir"
                aria-label={t("gps.vr.planilla.desviosDe", { categoria: tituloDeCategoria(categoria), medida: titulo })}
                value={cortes[categoria]}
                onChange={(evento) => cambiarCorte(columna.clave, categoria, evento.target.value)}
              >
                {opcionesDeCorte(categoria, cortes).map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {desvios(opcion)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {resultado && (
          <small className={`planilla-vr-suma ${completa ? "" : "mal"}`.trim()} role={completa ? undefined : "alert"}>
            {t(completa ? "gps.vr.planilla.suma" : "gps.vr.planilla.sumaMalCorta", { suma: porcentaje(sumaDePorcentajes(resultado)) })}
          </small>
        )}
      </div>
    );
  };

  const columnaAtipica = verAtipicos ? medidas.find((columna) => columna.clave === verAtipicos) : null;
  const calculoAtipico = verAtipicos ? calculos?.[verAtipicos] : null;
  const filaDe = (gps) => muestra.find((fila) => fila.gps === gps);

  return (
    <div className="app planilla-vr">
      <div className="contenedor contenedor-base">
        <header className="encabezado lesiones-encabezado">
          <div className="lesiones-encabezado-texto">
            <h1>{t("gps.vr.planilla.titulo", { dispositivo: dispositivo.etiqueta })}</h1>
            <p>{paso === 0 ? t("gps.vr.planilla.texto") : `${nombre.trim()} · ${resumen(muestra)}`}</p>
            <div className="lesiones-progreso" role="tablist" aria-label={t("lesiones.pasos.paso", { n: paso + 1, total: 2 })}>
              {[0, 1].map((indice) => (
                <button
                  type="button"
                  role="tab"
                  key={indice}
                  aria-selected={indice === paso}
                  className={`${indice === paso ? "actual" : ""} ${indice < paso ? "hecho" : ""}`.trim()}
                  onClick={() => (indice === 0 ? atras() : siguiente())}
                  disabled={guardando}
                  aria-label={indice === 0 ? t("gps.vr.planilla.muestraTitulo") : t("gps.vr.planilla.vrTitulo")}
                />
              ))}
            </div>
            <p className="lesiones-paso-numero">{t("lesiones.pasos.paso", { n: paso + 1, total: 2 })}</p>
          </div>
          <div className="guia-e-idioma">
            {onGuia && <BotonGuia onClick={onGuia} />}
            <SelectorIdioma className="lesiones-idioma" />
          </div>
        </header>

        {paso === 0 ? (
          <>
            <section className="tarjeta tarjeta-ficha planilla-vr-nombre">
              <div className="campo-inicio">
                <label htmlFor="planilla-vr-nombre">{t("gps.vr.planilla.nombre")}</label>
                <input id="planilla-vr-nombre" type="text" maxLength={120} value={nombre} onChange={(evento) => setNombre(evento.target.value)} autoComplete="off" />
                <small className="lesiones-ayuda">{t("gps.vr.planilla.nombreAyuda")}</small>
              </div>
            </section>
            <section className="lesiones-paso-titulo">
              <h2>{t("gps.vr.planilla.muestraTitulo")}</h2>
              <p>{t("gps.vr.planilla.muestraTexto", { dispositivo: dispositivo.etiqueta })}</p>
            </section>
            {error && <div className="aviso-hoja">{error}</div>}
            <section className="tarjeta evaluaciones-tabla planilla-vr-tabla-muestra">
              <TablaDatos id="gps-planilla-vr" columnas={columnas} filas={filas} fijas={fijas} muchasFilas vista={vista} ocultar={false} abrirAlFinal={false} onFiltros={setFiltros} />
            </section>
          </>
        ) : (
          <>
            <section className="lesiones-paso-titulo">
              <h2>{t("gps.vr.planilla.vrTitulo")}</h2>
              <p>{t("gps.vr.planilla.vrTexto")}</p>
            </section>
            {error && <div className="aviso-hoja">{error}</div>}
            <div className="planilla-vr-medidas-barra">
              <span>{t("gps.vr.planilla.medidasElegidas", { n: medidasElegidas.length, total: medidas.length })}</span>
              <button type="button" className="boton-secundario" onClick={() => setHojaMedidas({ elegidos: [...elegidas], busqueda: "" })}>
                {t("gps.vr.planilla.elegirMedidas")}
              </button>
            </div>
            <div className="tarjeta planilla-vr-tabla-marco">
              <table className="planilla-vr-tabla">
                <thead>
                  <tr>
                    <th className="fija" scope="col">
                      {t("gps.vr.planilla.medida")}
                    </th>
                    <th scope="col">{t("gps.vr.planilla.sentido")}</th>
                    <th scope="col">{t("gps.vr.planilla.cortes")}</th>
                    <th scope="col">{t("gps.vr.planilla.datos")}</th>
                    {CATEGORIAS.map((categoria) => (
                      <th key={categoria} scope="col" className={`cat-${categoria}`}>
                        {tituloDeCategoria(categoria)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {medidasElegidas.map((columna) => {
                    const resultado = calculos?.[columna.clave]?.resultado;
                    const titulo = tituloDe(columna.clave);
                    const manual = cortesManuales(columna, titulo);
                    return (
                      <React.Fragment key={columna.clave}>
                      <tr data-medida={columna.clave} className={manual ? "con-cortes" : undefined}>
                        <th className="fija" scope="row">
                          {titulo}
                        </th>
                        <td>
                          <Elegir etiqueta={t("gps.vr.planilla.sentidoDe", { medida: titulo })} valor={eleccion[columna.clave]?.sentido} opciones={SENTIDOS} onCambiar={(valor) => cambiar(columna.clave, "sentido", valor)} />
                        </td>
                        <td>
                          <Elegir etiqueta={t("gps.vr.planilla.cortesDe", { medida: titulo })} valor={eleccion[columna.clave]?.modo} opciones={MODOS} onCambiar={(valor) => cambiarModo(columna.clave, valor)} />
                        </td>
                        <td className="datos">{datos(columna.clave)}</td>
                        {CATEGORIAS.map((categoria) => (
                          <td key={categoria} className={`valor cat-${categoria}`}>
                            {resultado ? (
                              <>
                                <b>{textoDe(columna, resultado.valores[categoria])}</b>
                                <small>{porcentaje(resultado.porcentajes[categoria])}</small>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        ))}
                      </tr>
                      {manual && (
                        <tr className="planilla-vr-fila-cortes" data-cortes={columna.clave}>
                          <td colSpan={4 + CATEGORIAS.length}>{manual}</td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="planilla-vr-tarjetas">
              {medidasElegidas.map((columna) => {
                const resultado = calculos?.[columna.clave]?.resultado;
                const titulo = tituloDe(columna.clave);
                return (
                  <section className="tarjeta planilla-vr-tarjeta" key={columna.clave} data-medida={columna.clave}>
                    <div className="planilla-vr-medida">{titulo}</div>
                    <div className="planilla-vr-eleccion">
                      <Elegir etiqueta={t("gps.vr.planilla.sentidoDe", { medida: titulo })} valor={eleccion[columna.clave]?.sentido} opciones={SENTIDOS} onCambiar={(valor) => cambiar(columna.clave, "sentido", valor)} />
                      <Elegir etiqueta={t("gps.vr.planilla.cortesDe", { medida: titulo })} valor={eleccion[columna.clave]?.modo} opciones={MODOS} onCambiar={(valor) => cambiarModo(columna.clave, valor)} />
                    </div>
                    {cortesManuales(columna, titulo)}
                    <ul className="planilla-vr-categorias">
                      {CATEGORIAS.map((categoria) => (
                        <li key={categoria} className={`cat-${categoria}`}>
                          <span>{tituloDeCategoria(categoria)}</span>
                          <b>{resultado ? textoDe(columna, resultado.valores[categoria]) : "—"}</b>
                          <small>{resultado ? porcentaje(resultado.porcentajes[categoria]) : ""}</small>
                        </li>
                      ))}
                    </ul>
                    <p className="planilla-vr-datos">
                      {t("gps.vr.planilla.datos")}: {datos(columna.clave)}
                    </p>
                  </section>
                );
              })}
            </div>
          </>
        )}

        <div className="acciones-dobles">
          <BotonVolver onClick={() => (paso === 0 ? onCancelar() : atras())} disabled={guardando}>
            {paso === 0 ? t("comun.cancelar") : t("lesiones.pasos.atras")}
          </BotonVolver>
          {paso === 0 ? (
            <button type="button" className="boton-principal" onClick={siguiente}>
              {t("lesiones.pasos.siguienteA", { paso: t("gps.vr.planilla.vrTitulo") })}
            </button>
          ) : (
            <button type="button" className="boton-principal" onClick={guardar} disabled={guardando}>
              {guardando ? t("gps.vr.planilla.guardando") : t("gps.vr.planilla.guardar")}
            </button>
          )}
        </div>
      </div>

      <HojaInferior
        abierta={Boolean(hojaMedidas)}
        className="lesiones-hoja planilla-vr-hoja-medidas"
        titulo={t("gps.vr.planilla.medidasTitulo")}
        descripcion={t("gps.vr.planilla.medidasAyuda")}
        onCerrar={() => setHojaMedidas(null)}
        acciones={
          <>
            <button type="button" className="boton-cancelar-hoja" onClick={() => setHojaMedidas(null)}>
              {t("comun.cancelar")}
            </button>
            <button
              type="button"
              className="boton-confirmar-hoja"
              disabled={!hojaMedidas?.elegidos.length}
              onClick={() => {
                setElegidas(medidas.map((columna) => columna.clave).filter((clave) => hojaMedidas.elegidos.includes(clave)));
                setHojaMedidas(null);
              }}
            >
              {t("comun.listo")}
            </button>
          </>
        }
      >
        {hojaMedidas && (
          <div className="tabla-datos-filtro-cuerpo">
            <ListaParaMarcar
              valores={medidas.map((columna) => ({ clave: columna.clave, texto: tituloDe(columna.clave) }))}
              elegidos={hojaMedidas.elegidos}
              onCambiar={(elegidos) => setHojaMedidas((antes) => ({ ...antes, elegidos }))}
              busqueda={hojaMedidas.busqueda}
              onBuscar={(busqueda) => setHojaMedidas((antes) => ({ ...antes, busqueda }))}
            />
          </div>
        )}
      </HojaInferior>

      <HojaInferior
        abierta={Boolean(columnaAtipica && calculoAtipico?.resultado)}
        className="lesiones-hoja planilla-vr-hoja-atipicos"
        titulo={columnaAtipica ? t("gps.vr.planilla.atipicosTitulo", { medida: tituloDe(columnaAtipica.clave), n: calculoAtipico?.atipicos.length || 0 }) : ""}
        onCerrar={() => setVerAtipicos(null)}
        acciones={
          <button type="button" className="boton-cancelar-hoja" onClick={() => setVerAtipicos(null)}>
            {t("gps.vr.planilla.cerrar")}
          </button>
        }
      >
        {columnaAtipica && calculoAtipico?.resultado && (
          <>
            <p className="lesiones-ayuda">
              {t(calculoAtipico.resultado.veces === 3 ? "gps.vr.planilla.atipicosTexto3" : "gps.vr.planilla.atipicosTexto15", {
                desde: textoDe(columnaAtipica, calculoAtipico.resultado.atipicos.desde),
                hasta: textoDe(columnaAtipica, calculoAtipico.resultado.atipicos.hasta),
              })}
            </p>
            <ul className="planilla-vr-atipicos">
              {calculoAtipico.atipicos.map(({ fila, valor, bajo }) => {
                const armada = filaDe(fila);
                return (
                  <li key={armada?.id ?? fila.id}>
                    <span>{armada?.textos?.fecha || ""}</span>
                    <span>{armada?.textos?.jugador || ""}</span>
                    <b>{textoDe(columnaAtipica, valor)}</b>
                    <small>{t(bajo ? "gps.vr.planilla.muyBajo" : "gps.vr.planilla.muyAlto")}</small>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </HojaInferior>
    </div>
  );
}
