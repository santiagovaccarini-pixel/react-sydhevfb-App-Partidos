import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { categoriaPorCodigo } from "./domain/evaluaciones/categorias.js";
import { COMO_PERSONA, ESTADOS, NO_CARGAR, leerEvaluacionesPegadas, ordenDeCarga, planDeEvaluaciones } from "./domain/evaluaciones/importar.js";
import { crearEvaluacion } from "./domain/evaluacionesDb.js";
import { actualesPrimero, esActual } from "./domain/plantel.js";
import { textoDeMinutos } from "./domain/tabla.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// Pegar desde Excel, en Evaluaciones › Base: se pega la tabla de la hoja del
// test (con su fila de títulos) y antes de guardar nada se ve qué pasa con
// cada fila, igual que en Lesiones (ImportarLesiones.jsx): si se carga, si ya
// está en la app o qué le impide cargarse. Un nombre que no está en Datos
// básicos se elige qué es. Lo que el Excel calcula no se trae: lo calcula la
// app. Es para traer una vez lo que ya está en el Excel; lo nuevo se carga en
// la tabla.

// Cómo se ve cada estado (las clases del de Datos básicos).
const CLASE_DEL_ESTADO = {
  [ESTADOS.nueva]: "nuevo",
  [ESTADOS.yaEsta]: "existe",
  [ESTADOS.sinJugador]: "dudoso",
  [ESTADOS.noVa]: "fuera",
  [ESTADOS.conProblemas]: "problema",
};

// Los años que se pueden elegir para las fechas que vienen sin año.
const PRIMER_ANIO = 2000;

// onGuardadas(lista): las que se cargaron, todas juntas al terminar (antes de
// recargar todo, por si la recarga falla).
export default function ImportarEvaluaciones({ test, equipoId, plantel, plantelSinLeer = false, evaluaciones, onVolver, onRecargar, onGuardadas, onListo }) {
  const { idioma, plural } = useIdioma();
  const [texto, setTexto] = useState("");
  const [progreso, setProgreso] = useState(null);
  const [fallas, setFallas] = useState([]);
  // Cuántas se cargaron, si quedaron nombres sin elegir (la pantalla sigue
  // abierta para elegirlos).
  const [cargadasAntes, setCargadasAntes] = useState(null);
  // Lo elegido para los nombres que no están en Datos básicos: { indice de
  // la fila: destino }.
  const [elegidos, setElegidos] = useState({});
  const [hojaFila, setHojaFila] = useState(null);
  const hoy = hoyISO();
  const esteAnio = Number(hoy.slice(0, 4));
  // El año de las fechas que vienen sin año ("12-jun").
  const [anio, setAnio] = useState(esteAnio);
  // Si se sale de la pantalla en medio de la carga, la carga se corta ahí: lo
  // cargado queda y lo que falta se ve al volver a pegar.
  const enPantalla = useRef(true);
  useEffect(() => {
    enPantalla.current = true;
    return () => {
      enPantalla.current = false;
    };
  }, []);

  const columna = (campo) => test.columnas.find((una) => una.clave === campo)?.titulo[idioma] || campo;

  const leido = useMemo(() => (texto.trim() ? leerEvaluacionesPegadas(texto, test) : null), [texto, test]);
  const plan = useMemo(
    () => (leido && !leido.error && !plantelSinLeer ? planDeEvaluaciones(leido.filas, { test, plantel, evaluaciones, hoy, anio, elegidos }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leido, test, plantel, plantelSinLeer, evaluaciones, anio, elegidos],
  );
  const aCargar = useMemo(() => ordenDeCarga(plan), [plan]);
  const cuantas = (estado) => plan.filter((fila) => fila.estado === estado).length;
  const sinAnio = plan.some((fila) => fila.sinAnio);

  // Los nombres que no están en Datos básicos y todavía no se eligió qué son.
  // "Guardar igual" no toca los dudosos (los que se parecen a dos jugadores):
  // esos se eligen uno por uno.
  const sinElegir = plan.filter((fila) => fila.estado === ESTADOS.sinJugador);
  const fueraDeDatos = sinElegir.filter((fila) => !fila.dudoso);

  const pegarTexto = (nuevo) => {
    setTexto(nuevo);
    setFallas([]);
    setCargadasAntes(null);
    setElegidos({});
  };

  // Qué puede ser una fila con un nombre que no está en Datos básicos.
  const filaDeLaHoja = plan.find((fila) => fila.indice === hojaFila) || null;
  const opcionesDeLaHoja = filaDeLaHoja
    ? [
        { valor: COMO_PERSONA, etiqueta: t("evaluaciones.importar.comoPersona") },
        { valor: NO_CARGAR, etiqueta: t("evaluaciones.importar.noCargar") },
        ...actualesPrimero(plantel).map((jugador) => ({ valor: String(jugador.id), etiqueta: esActual(jugador) ? jugador.nombre : `${jugador.nombre} · ${t("datos.yaNoEsta")}` })),
      ]
    : [];
  const elegidoDeLaHoja = filaDeLaHoja ? (filaDeLaHoja.destino ?? (filaDeLaHoja.jugador ? String(filaDeLaHoja.jugador.id) : null)) : null;
  // Qué dice el botón de una fila que se puede elegir.
  const textoDelDestino = (fila) => {
    if (fila.estado === ESTADOS.sinJugador) return t(fila.dudoso ? "evaluaciones.importar.estado.dudoso" : "evaluaciones.importar.estado.sinJugador");
    if (fila.estado === ESTADOS.noVa) return t("evaluaciones.importar.estado.noVa");
    if (fila.estado === ESTADOS.conProblemas) return t("evaluaciones.importar.estado.conProblemas");
    if (fila.fueraDeDatos) return t("evaluaciones.importar.estado.comoPersona");
    if (fila.destino) return t("evaluaciones.importar.es", { jugador: fila.jugador?.nombre || "—" });
    return t(`evaluaciones.importar.estado.${fila.estado}`);
  };
  // Se puede elegir qué es una fila si su nombre no está en Datos básicos
  // (o se eligió a mano), mientras no esté ya en la app.
  const sePuedeElegir = (fila) => Boolean(fila.nombre) && fila.estado !== ESTADOS.yaEsta && (fila.destino !== null || !fila.jugador || fila.dudoso);

  // De qué día es: la fecha, o como vino si no se entiende.
  const fechaDe = (fila) => (fila.evaluacion.fecha ? fechaCorta(fila.evaluacion.fecha) : fila.textos.fecha || t("evaluaciones.sinFecha"));

  // Qué evaluación es: la selección y los tiempos.
  const detalleDe = (fila) => {
    const { datos } = fila.evaluacion;
    return [
      datos.seleccion ? categoriaPorCodigo(datos.seleccion)?.etiquetas[idioma] : "",
      ...test.tiempos.map((clave) => (typeof datos[clave] === "number" ? `${columna(clave)} ${textoDeMinutos(datos[clave])}` : "")),
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const cargar = async () => {
    const lista = aCargar;
    if (lista.length === 0) return;
    // Los nombres que siguen sin elegir no se cargan: la pantalla queda
    // abierta con ellos.
    const quedanSinElegir = sinElegir.length;
    const errores = [];
    const guardadas = [];
    let cargadas = 0;
    setFallas([]);
    setCargadasAntes(null);
    for (let i = 0; i < lista.length; i++) {
      if (!enPantalla.current) break;
      const fila = lista[i];
      setProgreso({ n: i + 1, total: lista.length });
      const guardado = await crearEvaluacion(equipoId, test.id, fila.evaluacion); // eslint-disable-line no-await-in-loop
      if (guardado.error) errores.push({ fecha: fechaDe(fila), nombre: fila.nombre, error: t(guardado.error) });
      else {
        cargadas += 1;
        guardadas.push(guardado.evaluacion);
      }
    }
    // Lo cargado queda en la lista de una vez (no fila por fila: con cada
    // cambio se rearma el plan); así, aunque la recarga falle, se ve como "Ya
    // está en la app" y no se carga dos veces.
    if (guardadas.length) onGuardadas?.(guardadas);
    // Con las evaluaciones de nuevo, las que ya quedaron se ven como "Ya está
    // en la app" y las que fallaron se pueden volver a intentar.
    await onRecargar();
    if (!enPantalla.current) return;
    setProgreso(null);
    if (errores.length === 0 && quedanSinElegir === 0) {
      onListo({ cargadas });
      return;
    }
    setFallas(errores);
    setCargadasAntes(cargadas);
  };

  const ocupado = Boolean(progreso);
  const anios = Array.from({ length: esteAnio - PRIMER_ANIO + 1 }, (_, i) => esteAnio - i);

  return (
    <div className="app">
      <div className="contenedor datos-importar">
        <header className="encabezado lesiones-encabezado">
          <div className="lesiones-encabezado-texto">
            <h1>{t("evaluaciones.importar.titulo")}</h1>
            <p>{t("evaluaciones.importar.texto")}</p>
          </div>
          <SelectorIdioma className="lesiones-idioma" />
        </header>

        <section className="tarjeta datos-importar-pegado">
          <textarea
            rows={5}
            value={texto}
            placeholder={t("evaluaciones.importar.pegarAca")}
            aria-label={t("evaluaciones.importar.pegarAca")}
            spellCheck={false}
            disabled={ocupado}
            onChange={(evento) => pegarTexto(evento.target.value)}
          />
          {texto && (
            <button type="button" className="boton-secundario" onClick={() => pegarTexto("")} disabled={ocupado}>
              <Icono nombre="borrar" size={15} />
              {t("evaluaciones.importar.borrar")}
            </button>
          )}
        </section>

        {plantelSinLeer && texto.trim() && <div className="lesiones-estado error">{t("evaluaciones.importar.plantelSinLeer")}</div>}
        {leido?.error && <div className="lesiones-estado error">{t(leido.error)}</div>}

        {sinAnio && (
          <section className="tarjeta evaluaciones-anio">
            <label>
              <b>{t("evaluaciones.importar.anio")}</b>
              <select value={anio} onChange={(evento) => setAnio(Number(evento.target.value))} disabled={ocupado}>
                {anios.map((uno) => (
                  <option key={uno} value={uno}>
                    {uno}
                  </option>
                ))}
              </select>
            </label>
            <p className="lesiones-ayuda">{t("evaluaciones.importar.anioAyuda")}</p>
          </section>
        )}

        {cargadasAntes > 0 && (
          <p className="lesiones-estado" role="status">
            {plural("evaluaciones.importar.listo", cargadasAntes)}
          </p>
        )}

        {fallas.length > 0 && (
          <div className="lesiones-estado error datos-importar-fallas" role="alert">
            <b>{plural("evaluaciones.importar.fallaron", fallas.length)}</b>
            <ul>
              {fallas.map((falla, i) => (
                <li key={`${falla.nombre}-${i}`}>{t("evaluaciones.importar.fallo", falla)}</li>
              ))}
            </ul>
          </div>
        )}

        {plan.length > 0 && (
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{plural("evaluaciones.importar.filas", plan.length)}</b>
            </div>
            <p className="datos-importar-resumen">
              {[
                plural("evaluaciones.importar.nuevas", cuantas(ESTADOS.nueva)),
                plural("evaluaciones.importar.yaEstan", cuantas(ESTADOS.yaEsta)),
                ...(sinElegir.length ? [plural("evaluaciones.importar.porElegir", sinElegir.length)] : []),
                ...(cuantas(ESTADOS.noVa) ? [plural("evaluaciones.importar.noVan", cuantas(ESTADOS.noVa))] : []),
                ...(cuantas(ESTADOS.conProblemas) ? [plural("evaluaciones.importar.conProblemas", cuantas(ESTADOS.conProblemas))] : []),
              ].join(" · ")}
            </p>
            {fueraDeDatos.length > 0 && (
              <div className="datos-importar-elegir-todos">
                <p className="lesiones-ayuda">{plural("evaluaciones.importar.fueraDeDatos", fueraDeDatos.length)}</p>
                <button
                  type="button"
                  className="boton-secundario datos-importar-confirmar"
                  onClick={() => setElegidos((previos) => ({ ...previos, ...Object.fromEntries(fueraDeDatos.map((fila) => [fila.indice, COMO_PERSONA])) }))}
                  disabled={ocupado}
                >
                  {plural("evaluaciones.importar.guardarTodasIgual", fueraDeDatos.length)}
                </button>
              </div>
            )}
            <ul className="datos-importar-lista">
              {plan.map((fila) => (
                <li key={fila.indice} className={fila.estado === ESTADOS.noVa || fila.estado === ESTADOS.yaEsta ? "apagada" : ""}>
                  <div className="datos-importar-fila">
                    <b>
                      {fechaDe(fila)} · {fila.nombre || t("evaluaciones.importar.sinNombreFila")}
                    </b>
                    {sePuedeElegir(fila) ? (
                      <button
                        type="button"
                        className={`datos-importar-destino ${fila.estado === ESTADOS.nueva ? "nuevo" : CLASE_DEL_ESTADO[fila.estado]}`}
                        onClick={() => setHojaFila(fila.indice)}
                        disabled={ocupado}
                      >
                        <span>{textoDelDestino(fila)}</span>
                        <Icono nombre="flecha" size={13} />
                      </button>
                    ) : (
                      <span className={`datos-importar-destino ${CLASE_DEL_ESTADO[fila.estado]}`}>
                        <span>{t(`evaluaciones.importar.estado.${fila.estado}`)}</span>
                      </span>
                    )}
                  </div>
                  {detalleDe(fila) && <p className="datos-importar-detalle">{detalleDe(fila)}</p>}
                  {fila.estado === ESTADOS.sinJugador && (
                    <p className="datos-importar-aviso">{t(fila.dudoso ? "evaluaciones.importar.jugadorDudoso" : "evaluaciones.importar.sinJugador")}</p>
                  )}
                  {fila.estado === ESTADOS.nueva && fila.fueraDeDatos && (
                    <p className="datos-importar-detalle">
                      {fila.evaluacion.persona === fila.nombre
                        ? t("evaluaciones.importar.seGuardaComoPersona")
                        : t("evaluaciones.importar.seGuardaComo", { nombre: fila.evaluacion.persona })}
                    </p>
                  )}
                  {fila.problemas.map((clave) => (
                    <p className="datos-importar-problema" key={clave}>
                      {t(clave)}
                    </p>
                  ))}
                  {fila.estado !== ESTADOS.yaEsta &&
                    fila.estado !== ESTADOS.noVa &&
                    fila.avisos.map((aviso) => (
                      <p className="datos-importar-aviso" key={aviso.campo}>
                        {t("evaluaciones.importar.aviso", { valor: aviso.valor, columna: columna(aviso.campo) })}
                      </p>
                    ))}
                </li>
              ))}
            </ul>
            {sinElegir.length > 0 && aCargar.length > 0 && (
              <p className="datos-importar-aviso datos-importar-sin-elegir">{plural("evaluaciones.importar.quedanSinElegir", sinElegir.length)}</p>
            )}
          </section>
        )}

        <div className="acciones-dobles">
          <BotonVolver onClick={onVolver} disabled={ocupado}>
            {t("comun.volver")}
          </BotonVolver>
          <button type="button" className="boton-principal" onClick={cargar} disabled={ocupado || aCargar.length === 0}>
            {progreso
              ? t("evaluaciones.importar.cargando", progreso)
              : aCargar.length === 0
                ? t("evaluaciones.importar.nadaQueCargar")
                : plural("evaluaciones.importar.cargar", aCargar.length)}
          </button>
        </div>
      </div>

      <HojaOpciones
        abierta={Boolean(filaDeLaHoja)}
        titulo={filaDeLaHoja ? t("evaluaciones.importar.quienEs", { nombre: filaDeLaHoja.nombre }) : ""}
        opciones={opcionesDeLaHoja}
        elegida={elegidoDeLaHoja}
        buscador
        onElegir={(destino) => {
          const indice = filaDeLaHoja?.indice;
          setHojaFila(null);
          if (indice === undefined) return;
          setElegidos((previos) => ({ ...previos, [indice]: destino }));
        }}
        onCerrar={() => setHojaFila(null)}
      />
    </div>
  );
}
