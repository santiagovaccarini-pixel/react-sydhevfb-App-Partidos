import React, { useMemo, useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { SelectorDeTest } from "./ReportesEvaluaciones.jsx";
import { LISTA_SELECCION, opcionesDeLista } from "./domain/evaluaciones/ajustes.js";
import { deDatosBasicos } from "./domain/evaluaciones/categorias.js";
import { leerPdfIsocinecia } from "./domain/evaluaciones/pdfIsocinecia.js";
import { VELOCIDADES } from "./domain/evaluaciones/tests/isocinecia.js";
import { DUDOSO, buscadorDeJugadores } from "./domain/importarPersonas.js";
import { idAlAzar } from "./domain/pendientes.js";
import { esActual } from "./domain/plantel.js";
import { idiomaActual, t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";

// Evaluaciones › Cargar › Isocinecia: con los PDF del isocinético (Santiago,
// 23/10, en un cuestionario: «Leer el PDF en Cargar», «Varios a la vez», la
// fecha «La del PDF» y «Una tarjeta por PDF»).
//   · Paso 1: el test y «Elegir PDF» (varios a la vez).
//   · Paso 2: una tarjeta por PDF, para revisar antes de guardar: el jugador
//     (buscado por el nombre del PDF en Datos básicos; si no está o hay dos
//     parecidos, se elige), la fecha (la del PDF, se puede cambiar), la
//     Selección (de la categoría de Datos básicos), el peso (P.C.) y Peak
//     TQ/BW de cada velocidad; «Ver todo» abre las tres velocidades. Se
//     guarda una evaluación por PDF, con las reglas de siempre.
// La carga es la de Evaluaciones (cargaNueva); los PDF van en pdfs: [{ id,
// archivo, leyendo, error, nombre, jugador_id, aviso, fecha, datos, faltan,
// abierta }].

export const ISOCINECIA_PDF = "isocinecia";

const pdfsDe = (carga) => carga?.pdfs || [];
const listos = (carga) => pdfsDe(carga).filter((pdf) => !pdf.leyendo && !pdf.error);
export const hayPdfCargado = (carga) => pdfsDe(carga).length > 0;
export const pdfsParaGuardar = (carga) => listos(carga).filter((pdf) => pdf.jugador_id);

// Las evaluaciones de los PDF: { evaluaciones: [{ filaId, evaluacion }] } o
// { error } (lo que falta, con el PDF).
export const evaluacionesDeLosPdf = (carga, { nombreDe = () => "" } = {}) => {
  const lista = listos(carga);
  const evaluaciones = [];
  const vistas = new Set();
  for (const pdf of lista) {
    const quien = pdf.jugador_id ? nombreDe(pdf.jugador_id) : pdf.archivo;
    if (!pdf.jugador_id) return { error: t("evaluaciones.pdf.faltaJugador", { archivo: pdf.archivo }) };
    if (!pdf.fecha) return { error: `${quien}: ${t("evaluaciones.form.faltaFecha")}` };
    if (pdf.fecha > hoyISO()) return { error: `${quien}: ${t("evaluaciones.error.fechaFutura")}` };
    const clave = `${pdf.jugador_id}|${pdf.fecha}`;
    if (vistas.has(clave)) return { error: t("evaluaciones.pdf.repetido", { jugador: quien, fecha: fechaCorta(pdf.fecha) }) };
    vistas.add(clave);
    const datos = { ...pdf.datos, ...(pdf.seleccion ? { [LISTA_SELECCION]: pdf.seleccion } : {}) };
    evaluaciones.push({ filaId: pdf.id, evaluacion: { jugador_id: pdf.jugador_id, persona: null, fecha: pdf.fecha, datos } });
  }
  return { evaluaciones };
};

// Las medidas de la tarjeta, como en la Base (los nombres del equipo).
const MEDIDAS = [
  { clave: "peak", titulo: "Peak TQ/BW" },
  { clave: "work", titulo: "Work/BW" },
  { clave: "avg", titulo: "Average Power" },
  { clave: "wf", titulo: "Work Fatigue" },
  { clave: "rom", titulo: "ROM" },
];
const LADOS = [
  { mov: "ext", pierna: "pd", rotulo: "evaluaciones.pdf.extPd" },
  { mov: "ext", pierna: "pi", rotulo: "evaluaciones.pdf.extPi" },
  { mov: "flex", pierna: "pd", rotulo: "evaluaciones.pdf.flexPd" },
  { mov: "flex", pierna: "pi", rotulo: "evaluaciones.pdf.flexPi" },
];
const claveDe = (velocidad, medida, lado) => (medida === "rom" ? `${velocidad}_rom_${lado.pierna}` : `${velocidad}_${medida}_${lado.mov}_${lado.pierna}`);

export default function CargaIsocinecia({ carga, setCarga, tests, config, plantel, encabezado, error, setError, ocupado, onCancelar, onGuardar, onCambiarTest }) {
  const { idioma, plural } = useIdioma();
  const [eligiendo, setEligiendo] = useState(null);
  const [aSacar, setASacar] = useState(null);
  const archivoRef = useRef(null);
  const pdfs = pdfsDe(carga);
  const actuales = useMemo(() => plantel.filter(esActual), [plantel]);
  const buscar = useMemo(() => buscadorDeJugadores(actuales), [actuales]);
  const jugadorDe = (id) => plantel.find((jugador) => String(jugador.id) === String(id)) || null;
  const nombreDe = (id) => jugadorDe(id)?.nombre || "";
  const selecciones = opcionesDeLista(LISTA_SELECCION, config, idioma);
  const numeros = useMemo(() => new Intl.NumberFormat(idiomaActual(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }), [idioma]); // eslint-disable-line react-hooks/exhaustive-deps
  const comoNumero = (valor) => (typeof valor === "number" && Number.isFinite(valor) ? numeros.format(valor) : "—");
  const aGuardar = pdfsParaGuardar(carga).length;

  const cambiarPdf = (id, cambio) => setCarga((actual) => ({ ...actual, pdfs: pdfsDe(actual).map((pdf) => (pdf.id === id ? { ...pdf, ...(typeof cambio === "function" ? cambio(pdf) : cambio) } : pdf)) }));

  // El jugador de un PDF: su categoría de Datos básicos como Selección.
  const conJugador = (jugador) => {
    const categoria = deDatosBasicos(jugador.categoria);
    return { jugador_id: jugador.id, aviso: "", seleccion: categoria && selecciones.some((opcion) => opcion.valor === categoria) ? categoria : null };
  };

  // Leer los PDF elegidos: cada uno, una tarjeta (mientras se lee, «Leyendo…»).
  const leerArchivos = async (archivos) => {
    const lista = [...(archivos || [])];
    if (!lista.length) return;
    setError("");
    const ids = lista.map(() => `pdf-${idAlAzar()}`);
    setCarga((actual) => ({
      ...actual,
      paso: 1,
      pdfs: [...pdfsDe(actual), ...lista.map((archivo, indice) => ({ id: ids[indice], archivo: archivo.name, leyendo: true }))],
    }));
    await Promise.all(
      lista.map(async (archivo, indice) => {
        const id = ids[indice];
        let leido;
        try {
          leido = await leerPdfIsocinecia(await archivo.arrayBuffer());
        } catch {
          leido = { error: "evaluaciones.pdf.noSeLeyo" };
        }
        if (leido.error) {
          cambiarPdf(id, { leyendo: false, error: leido.error });
          return;
        }
        const encontrado = leido.nombre ? buscar(leido.nombre) : null;
        const jugador = encontrado && encontrado !== DUDOSO ? encontrado : null;
        cambiarPdf(id, {
          leyendo: false,
          nombre: leido.nombre,
          fecha: leido.fecha,
          datos: leido.datos,
          faltan: leido.faltan,
          ...(jugador ? conJugador(jugador) : { jugador_id: null, seleccion: null, aviso: encontrado === DUDOSO ? "dudoso" : "noEsta" }),
        });
      }),
    );
  };

  // El botón abre el selector de archivos del aparato (escondido).
  const elegirArchivos = (
    <>
      <button type="button" className="boton-principal evaluaciones-pdf-elegir" onClick={() => archivoRef.current?.click()}>
        <Icono nombre="subir" size={18} />
        <span>{t(pdfs.length ? "evaluaciones.pdf.agregar" : "evaluaciones.pdf.elegir")}</span>
      </button>
      <input
        ref={archivoRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        className="evaluaciones-pdf-archivo"
        onChange={(evento) => {
          leerArchivos(evento.target.files);
          evento.target.value = "";
        }}
      />
    </>
  );

  const progreso = (
    <>
      <div className="lesiones-progreso" role="tablist" aria-label={t("lesiones.pasos.paso", { n: carga.paso + 1, total: 2 })}>
        {[t("evaluaciones.pdf.paso1"), t("evaluaciones.pdf.paso2")].map((rotulo, indice) => (
          <button
            type="button"
            role="tab"
            key={rotulo}
            aria-selected={indice === carga.paso}
            aria-label={rotulo}
            className={`${indice === carga.paso ? "actual" : ""} ${indice < carga.paso ? "hecho" : ""}`.trim()}
            onClick={() => (indice === 0 || pdfs.length ? setCarga((actual) => ({ ...actual, paso: indice })) : undefined)}
          />
        ))}
      </div>
      <p className="lesiones-paso-numero">{t("lesiones.pasos.paso", { n: carga.paso + 1, total: 2 })}</p>
    </>
  );

  // ------------------------------------------------------------ Paso 1 --

  const paso1 = (
    <>
      <section className="lesiones-paso-titulo">
        <h2>{t("evaluaciones.pdf.paso1")}</h2>
        <p>{t("evaluaciones.pdf.paso1Texto")}</p>
      </section>
      {error && <div className="aviso-hoja">{error}</div>}
      <section className="tarjeta tarjeta-ficha lesiones-grupo">
        {tests.length > 1 && (
          <div className="campo-inicio lesiones-campo-paso">
            <label>{t("evaluaciones.form.test")}</label>
            <SelectorDeTest tests={tests} elegido={carga.test} alElegir={onCambiarTest} idioma={idioma} conRotulo={false} />
          </div>
        )}
        <div className="campo-inicio lesiones-campo-paso">
          <label>{t("evaluaciones.pdf.archivos")}</label>
          {elegirArchivos}
          {pdfs.length > 0 && <p className="evaluaciones-pdf-cuantos">{plural("evaluaciones.pdf.elegidos", pdfs.length)}</p>}
        </div>
      </section>
      <div className="acciones-dobles">
        <BotonVolver onClick={onCancelar}>{t("comun.cancelar")}</BotonVolver>
        <button type="button" className="boton-principal" disabled={!pdfs.length} onClick={() => setCarga((actual) => ({ ...actual, paso: 1 }))}>
          {t("lesiones.pasos.siguiente")}
        </button>
      </div>
    </>
  );

  // ------------------------------------------------------------ Paso 2 --

  const botonSacar = (pdf) => (
    <button type="button" className="evaluaciones-varios-sacar" aria-label={`${t("evaluaciones.varios.sacar")}: ${nombreDe(pdf.jugador_id) || pdf.archivo}`} title={t("evaluaciones.varios.sacar")} onClick={() => setASacar(pdf)}>
      <Icono nombre="borrar" size={16} />
    </button>
  );

  // Una velocidad: sus medidas por pierna (o solo Peak TQ/BW, cerrada).
  const tablaDeVelocidad = (pdf, { clave, grados }, medidas) => (
    <div className="evaluaciones-pdf-velocidad" key={clave}>
      <p className="evaluaciones-varios-bloque-titulo">{`${grados}°`}</p>
      <table className="evaluaciones-pdf-tabla">
        <thead>
          <tr>
            <th scope="col" aria-label={t("evaluaciones.pdf.medida")} />
            {LADOS.map((lado) => (
              <th scope="col" key={`${lado.mov}-${lado.pierna}`}>
                {t(lado.rotulo)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {medidas.map((medida) => (
            <tr key={medida.clave}>
              <th scope="row">{medida.titulo}</th>
              {medida.clave === "rom" ? (
                <>
                  <td colSpan={2}>{comoNumero(pdf.datos?.[claveDe(clave, "rom", LADOS[0])])}</td>
                  <td colSpan={2}>{comoNumero(pdf.datos?.[claveDe(clave, "rom", LADOS[1])])}</td>
                </>
              ) : (
                LADOS.map((lado) => <td key={`${lado.mov}-${lado.pierna}`}>{comoNumero(pdf.datos?.[claveDe(clave, medida.clave, lado)])}</td>)
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const tarjeta = (pdf) => {
    if (pdf.leyendo) {
      return (
        <section className="tarjeta evaluaciones-varios-tarjeta evaluaciones-pdf-tarjeta" key={pdf.id} aria-busy="true">
          <p className="evaluaciones-pdf-archivo-nombre">{pdf.archivo}</p>
          <p className="lesiones-estado">{t("evaluaciones.pdf.leyendo")}</p>
        </section>
      );
    }
    if (pdf.error) {
      return (
        <section className="tarjeta evaluaciones-varios-tarjeta evaluaciones-pdf-tarjeta con-error" key={pdf.id}>
          <div className="evaluaciones-varios-arriba">
            <p className="evaluaciones-pdf-archivo-nombre">{pdf.archivo}</p>
            {botonSacar(pdf)}
          </div>
          <div className="aviso-hoja">{t(pdf.error)}</div>
        </section>
      );
    }
    const velocidades = VELOCIDADES.filter((una) => !pdf.faltan?.includes(una.grados));
    return (
      <section className={`tarjeta evaluaciones-varios-tarjeta evaluaciones-pdf-tarjeta ${pdf.abierta ? "" : "cerrada"}`.trim()} key={pdf.id}>
        <div className="evaluaciones-varios-arriba">
          <button
            type="button"
            className={`evaluaciones-varios-jugador ${pdf.jugador_id ? "" : "vacio"}`.trim()}
            onClick={() => setEligiendo(pdf.id)}
            aria-label={pdf.jugador_id ? `${t("evaluaciones.varios.cambiarJugador")}: ${nombreDe(pdf.jugador_id)}` : `${t("evaluaciones.varios.elegirJugador")} (${pdf.archivo})`}
          >
            <b>{pdf.jugador_id ? nombreDe(pdf.jugador_id) : t("evaluaciones.varios.elegirJugador")}</b>
            <Icono nombre="flecha" size={14} />
          </button>
          {botonSacar(pdf)}
        </div>
        <p className="evaluaciones-pdf-archivo-nombre">{pdf.nombre ? t("evaluaciones.pdf.enElPdf", { nombre: pdf.nombre, archivo: pdf.archivo }) : pdf.archivo}</p>
        {pdf.aviso && !pdf.jugador_id && <div className="aviso-hoja">{t(pdf.aviso === "dudoso" ? "evaluaciones.pdf.dudoso" : "evaluaciones.pdf.noEsta", { nombre: pdf.nombre || pdf.archivo })}</div>}
        {pdf.faltan?.length > 0 && <div className="aviso-hoja">{t("evaluaciones.pdf.faltan", { velocidades: pdf.faltan.map((grados) => `${grados}°`).join(", ") })}</div>}
        <div className="evaluaciones-varios-bloque primero">
          <div className="evaluaciones-varios-campos">
            <label>
              <span>{t("evaluaciones.varios.fecha")}</span>
              <input type="date" value={pdf.fecha || ""} max={hoyISO()} onChange={(evento) => cambiarPdf(pdf.id, { fecha: evento.target.value || null })} />
            </label>
            <label>
              <span>{t("evaluaciones.pdf.seleccion")}</span>
              <select value={pdf.seleccion || ""} onChange={(evento) => cambiarPdf(pdf.id, { seleccion: evento.target.value || null })}>
                <option value="">—</option>
                {selecciones.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <p className="evaluaciones-pdf-peso">
              <span>{t("evaluaciones.pdf.peso")}</span>
              <b>{comoNumero(pdf.datos?.pc)}</b>
            </p>
          </div>
        </div>
        <div className="evaluaciones-varios-bloque">{velocidades.map((velocidad) => tablaDeVelocidad(pdf, velocidad, pdf.abierta ? MEDIDAS : MEDIDAS.slice(0, 1)))}</div>
        <div className="evaluaciones-varios-abajo">
          <button type="button" className="boton-secundario evaluaciones-pdf-ver" aria-expanded={Boolean(pdf.abierta)} onClick={() => cambiarPdf(pdf.id, (uno) => ({ abierta: !uno.abierta }))}>
            {t(pdf.abierta ? "evaluaciones.pdf.verMenos" : "evaluaciones.pdf.verTodo")}
          </button>
        </div>
      </section>
    );
  };

  const paso2 = (
    <>
      <section className="lesiones-paso-titulo">
        <h2>{t("evaluaciones.pdf.paso2")}</h2>
        <p>{t("evaluaciones.pdf.paso2Texto")}</p>
      </section>
      {error && <div className="aviso-hoja">{error}</div>}
      {!actuales.length && <p className="lesiones-estado">{t("lesiones.sinJugadores")}</p>}
      <div className="evaluaciones-varios-tarjetas evaluaciones-pdf-tarjetas">
        {pdfs.map(tarjeta)}
        <div className="evaluaciones-pdf-agregar">{elegirArchivos}</div>
      </div>
      <div className="acciones-dobles">
        <BotonVolver onClick={() => setCarga((actual) => ({ ...actual, paso: 0 }))}>{t("lesiones.pasos.atras")}</BotonVolver>
        <button type="button" className="boton-principal" onClick={onGuardar} disabled={ocupado || aGuardar === 0 || pdfs.some((pdf) => pdf.leyendo)}>
          {ocupado ? t("comun.guardando") : plural("evaluaciones.varios.guardar", aGuardar)}
        </button>
      </div>
    </>
  );

  const pdfEligiendo = pdfs.find((pdf) => pdf.id === eligiendo) || null;
  const test = tests.find((uno) => uno.id === carga.test) || tests[0];
  return (
    <div className="app">
      <div className="contenedor">
        {encabezado(t("evaluaciones.form.nueva"), carga.paso === 0 ? t("evaluaciones.pdf.texto") : `${test.pestana[idioma]} · ${plural("evaluaciones.pdf.elegidos", pdfs.length)}`, progreso)}
        {carga.paso === 0 ? paso1 : paso2}
      </div>

      <HojaOpciones
        abierta={Boolean(pdfEligiendo)}
        titulo={t("evaluaciones.varios.elegirJugador")}
        opciones={actuales.map((jugador) => ({ valor: String(jugador.id), etiqueta: jugador.nombre }))}
        elegida={pdfEligiendo?.jugador_id ? String(pdfEligiendo.jugador_id) : null}
        buscador={actuales.length > 8}
        onElegir={(valor) => {
          const jugador = jugadorDe(valor);
          if (pdfEligiendo && jugador) cambiarPdf(pdfEligiendo.id, conJugador(jugador));
          setEligiendo(null);
        }}
        onCerrar={() => setEligiendo(null)}
      />

      <HojaConfirmar
        abierta={Boolean(aSacar)}
        titulo={t("evaluaciones.pdf.sacarTitulo")}
        descripcion={t("evaluaciones.pdf.sacarTexto", { archivo: aSacar?.archivo || "" })}
        icono="borrar"
        etiquetaConfirmar={t("evaluaciones.varios.siSacar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={() => {
          const id = aSacar?.id;
          setASacar(null);
          setCarga((actual) => ({ ...actual, pdfs: pdfsDe(actual).filter((pdf) => pdf.id !== id) }));
        }}
        onCancelar={() => setASacar(null)}
      />
    </div>
  );
}
