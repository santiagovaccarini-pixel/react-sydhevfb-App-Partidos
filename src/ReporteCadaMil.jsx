import React, { useEffect, useMemo, useState } from "react";
import { Icono } from "./components/AppChrome";
import { EscudoDeClub } from "./components/ClubCrest";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { CuadroCadaMil } from "./components/CuadroCadaMil.jsx";
import { esFechaISO } from "./domain/lesiones.js";
import { borrarPeriodo, guardarPeriodo, listarPeriodos } from "./domain/periodosDb.js";
import { contadorDelPeriodo, ordenarPeriodos } from "./domain/reportes.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta } from "./idioma/formatos.js";

// "Lesiones c/1000h y días perdidos": el contador de la derecha de
// "Antecedentes BD" en el Excel. Se eligen la fecha de inicio, la final y un
// nombre, y salen las lesiones y los días perdidos del período (las cuatro
// columnas: severidad todas o sin leves, tipos todos o solo LM), los minutos
// de entrenamiento y, con ellos, las cuentas cada 1000 horas (lo que el Excel
// arma en "Incidencias c 1000h"). El período se guarda con su nombre (en el
// Excel, las letras A a P) para compararlo después; se guardan el nombre y
// las fechas, y los números se calculan cada vez. "Base completa" es el
// botón ATUALIZAR VR: desde la primera lesión hasta hoy.
//
// gps: los minutos ([{ jugadorId, fecha, minutos }]) o null mientras la app
// no los tenga; numero: cómo se escriben los números en los reportes;
// queCuenta: qué lesiones cuentan y cuáles son las LM, en palabras del club.

export default function ReporteCadaMil({ lesiones, gps, hoy, equipo, acciones, estado, numero, queCuenta, onAviso }) {
  const { plural } = useIdioma();
  const equipoId = equipo?.id || null;
  const soloLectura = Boolean(equipo?.hasta);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState(hoy);
  const [nombre, setNombre] = useState("");
  const [periodos, setPeriodos] = useState([]);
  const [errorPeriodos, setErrorPeriodos] = useState("");
  const [errorGuardar, setErrorGuardar] = useState("");
  // El error al borrar uno va aparte del de leer la lista: se va cuando algo sale bien.
  const [errorBorrar, setErrorBorrar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  useEffect(() => {
    let vigente = true;
    listarPeriodos(equipoId).then((respuesta) => {
      if (!vigente) return;
      setPeriodos(respuesta.periodos);
      setErrorPeriodos(respuesta.error);
    });
    return () => {
      vigente = false;
    };
  }, [equipoId]);

  // Sin inicio, desde la primera lesión (como el Excel con el inicio vacío).
  const primera = useMemo(() => (lesiones || []).map((lesion) => lesion.fecha_lesion).filter(esFechaISO).sort()[0] || "", [lesiones]);
  const textoDelRango = (inicio, final) => `${inicio ? fechaCorta(inicio) : primera ? fechaCorta(primera) : "—"} – ${fechaCorta(final)}`;
  const fechasBien = esFechaISO(hasta) && (!desde || (esFechaISO(desde) && desde <= hasta));
  const errorDeFechas = !esFechaISO(hasta) ? "lesiones.cadaMil.faltaFinal" : "lesiones.periodos.error.fechas";
  const contador = fechasBien ? contadorDelPeriodo(lesiones, gps, { desde, hasta }) : null;

  const elegir = (periodo) => {
    setDesde(periodo.desde || "");
    setHasta(periodo.hasta);
    setNombre(periodo.nombre);
    setErrorGuardar("");
  };

  const guardar = async () => {
    if (!nombre.trim()) return setErrorGuardar(t("lesiones.cadaMil.faltaNombre"));
    if (!fechasBien) return setErrorGuardar(t(errorDeFechas));
    setGuardando(true);
    const respuesta = await guardarPeriodo(equipoId, { nombre, desde, hasta });
    setGuardando(false);
    if (respuesta.error) return setErrorGuardar(t(respuesta.error));
    setErrorGuardar("");
    setErrorBorrar("");
    // Como quedó guardado (sin espacios de más).
    setNombre(respuesta.periodo.nombre);
    setPeriodos((anteriores) => [...anteriores, respuesta.periodo]);
    onAviso?.(t("lesiones.cadaMil.guardado"));
    return undefined;
  };

  const confirmarBorrar = async () => {
    const periodo = aBorrar;
    setABorrar(null);
    if (!periodo) return;
    const respuesta = await borrarPeriodo(periodo.id);
    if (respuesta.error) return setErrorBorrar(respuesta.error);
    setErrorBorrar("");
    setPeriodos((anteriores) => anteriores.filter((uno) => uno.id !== periodo.id));
    onAviso?.(t("lesiones.cadaMil.borrado"));
    return undefined;
  };

  const filas = contador
    ? [
        { id: "cantidad", rotulo: t("lesiones.cadaMil.nLesiones"), celdas: contador.filas.map((fila) => ({ texto: numero(fila.cantidad, 0) })) },
        { id: "lesionesMil", clase: "informe-fila-jugador", rotulo: t("lesiones.reportes.lesionesMil"), celdas: contador.filas.map((fila) => ({ texto: numero(fila.lesionesCadaMil) })) },
        { id: "dias", rotulo: t("lesiones.cadaMil.nDias"), celdas: contador.filas.map((fila) => ({ texto: numero(fila.dias, 0) })) },
        { id: "diasMil", clase: "informe-fila-jugador", rotulo: t("lesiones.reportes.diasMil"), celdas: contador.filas.map((fila) => ({ texto: numero(fila.diasCadaMil) })) },
      ]
    : [];
  const elegido = periodos.find((periodo) => periodo.nombre === nombre.trim() && (periodo.desde || "") === desde && periodo.hasta === hasta) || null;

  return (
    <div className="app reporte">
      <div className="contenedor contenedor-base">
        {acciones}
        {estado}
        <header className="reporte-portada">
          <div className="reporte-portada-club">
            <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
            <div>
              <span>{t("lesiones.cadaMil.titulo")}</span>
              <b>{nombre.trim() || equipo?.nombre || ""}</b>
              <small>{fechasBien ? textoDelRango(desde, hasta) : "—"}</small>
            </div>
          </div>
        </header>

        <section className="tarjeta reporte-filtros reporte-contador no-imprimir">
          <p className="rotulo-criterio">{t("lesiones.cadaMil.elegir")}</p>
          <div className="grilla-criterios">
            <button
              type="button"
              className={`chip-criterio ${!desde && hasta === hoy ? "prendido" : ""}`}
              aria-pressed={!desde && hasta === hoy}
              onClick={() => elegir({ desde: "", hasta: hoy, nombre: t("lesiones.cadaMil.baseCompleta") })}
            >
              {t("lesiones.cadaMil.baseCompleta")}
            </button>
          </div>
          <div className="reporte-fechas">
            <label>
              {t("lesiones.cadaMil.inicio")}
              <input type="date" value={desde} max={hasta || undefined} onChange={(evento) => setDesde(evento.target.value)} />
            </label>
            <label>
              {t("lesiones.cadaMil.final")}
              <input type="date" value={hasta} min={desde || undefined} onChange={(evento) => setHasta(evento.target.value)} />
            </label>
          </div>
          {!desde && <p className="lesiones-ayuda">{t("lesiones.cadaMil.sinInicio")}</p>}
          <label className="reporte-contador-nombre">
            {t("lesiones.cadaMil.nombre")}
            <input type="text" value={nombre} maxLength={80} placeholder={t("lesiones.cadaMil.nombreEjemplo")} onChange={(evento) => setNombre(evento.target.value)} />
          </label>
          {!fechasBien && <div className="lesiones-estado error">{t(errorDeFechas)}</div>}
        </section>

        {contador && (
          <>
            <section className="reporte-kpis reporte-kpis-dos">
              <div className="reporte-kpi">
                <b>{contador.minutos === null ? "—" : numero(contador.minutos, 0)}</b>
                <span>{t("lesiones.cadaMil.minutos")}</span>
              </div>
              <div className="reporte-kpi">
                <b>{contador.horas === null ? "—" : numero(contador.horas, 1)}</b>
                <span>{t("lesiones.cadaMil.horas")}</span>
              </div>
            </section>
            <section className="tarjeta tarjeta-ficha">
              <div className="cabeza-ficha">
                <b>{t("lesiones.cadaMil.resultado")}</b>
              </div>
              <div className="informe-indices">
                <CuadroCadaMil titulo={textoDelRango(desde, hasta)} filas={filas} />
                {!gps && <p className="informe-aviso">{t("lesiones.cadaMil.faltaGps")}</p>}
                <p className="informe-criterio">{queCuenta}</p>
              </div>
            </section>
          </>
        )}

        {!soloLectura && (
          <section className="tarjeta reporte-contador-guardar no-imprimir">
            {errorGuardar && (
              <div className="lesiones-estado error" role="alert">
                {errorGuardar}
              </div>
            )}
            <button type="button" className="boton-principal" onClick={guardar} disabled={guardando || !equipoId || Boolean(elegido)}>
              <Icono nombre="guardar" size={16} />
              {guardando ? t("comun.guardando") : elegido ? t("lesiones.cadaMil.yaGuardado") : t("lesiones.cadaMil.guardar")}
            </button>
          </section>
        )}

        <section className="tarjeta tarjeta-ficha reporte-periodos no-imprimir">
          <div className="cabeza-ficha">
            <b>{t("lesiones.cadaMil.guardados")}</b>
          </div>
          {errorPeriodos && <div className="lesiones-estado error">{t(errorPeriodos)}</div>}
          {errorBorrar && (
            <div className="lesiones-estado error" role="alert">
              {t(errorBorrar)}
            </div>
          )}
          {!errorPeriodos && periodos.length === 0 && <p className="vacio-ficha">{t("lesiones.cadaMil.sinGuardados")}</p>}
          <ul className="reporte-periodos-lista">
            {ordenarPeriodos(periodos).map((periodo) => {
              const [todas] = contadorDelPeriodo(lesiones, null, periodo).filas;
              return (
                <li key={periodo.id} className={elegido?.id === periodo.id ? "elegido" : ""}>
                  <button type="button" className="reporte-periodo" onClick={() => elegir(periodo)} aria-pressed={elegido?.id === periodo.id}>
                    <b>{periodo.nombre}</b>
                    <span>{textoDelRango(periodo.desde, periodo.hasta)}</span>
                    <small>
                      {plural("lesiones.historial.cantidad", todas.cantidad)} · {plural("lesiones.dias", todas.dias)}
                    </small>
                  </button>
                  {!soloLectura && (
                    <button type="button" className="reporte-periodo-borrar" onClick={() => setABorrar(periodo)} aria-label={t("lesiones.cadaMil.borrar", { nombre: periodo.nombre })}>
                      <Icono nombre="borrar" size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <HojaConfirmar
        abierta={Boolean(aBorrar)}
        titulo={t("lesiones.cadaMil.borrarTitulo")}
        descripcion={t("lesiones.cadaMil.borrarTexto", { nombre: aBorrar?.nombre || "" })}
        icono="borrar"
        etiquetaConfirmar={t("lesiones.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBorrar}
        onCancelar={() => setABorrar(null)}
      />
    </div>
  );
}
