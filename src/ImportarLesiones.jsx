import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { COMO_PERSONA, ESTADOS, NO_CARGAR, leerLesionesPegadas, ordenDeCarga, planDeImportacion } from "./domain/importarLesiones.js";
import { etiquetaDeCampo, etiquetaDeOpcion } from "./domain/lesionesCampos.js";
import { importarLesion } from "./domain/lesionesDb.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// Pegar desde Excel, en Lesiones › Base: se pega la tabla de la hoja
// "Antecedentes BD" (con su fila de cabeceras) y antes de guardar nada se ve
// qué pasa con cada fila: si se carga (y qué le falta para estar completa,
// como la fecha de inicio), si ya está en la app o qué le impide cargarse.
// Un nombre que no está en Datos básicos se elige qué es: se guarda con ese
// nombre (sin agregarlo a Datos básicos), es un jugador de la lista o no se
// carga. Se ve igual que Pegar desde Excel en Datos básicos
// (ImportarJugadores.jsx).

// Cómo se ve cada estado (las clases del de Datos básicos).
const CLASE_DEL_ESTADO = {
  [ESTADOS.nueva]: "nuevo",
  [ESTADOS.yaEsta]: "existe",
  [ESTADOS.sinJugador]: "dudoso",
  [ESTADOS.noVa]: "fuera",
  [ESTADOS.conProblemas]: "problema",
};

export default function ImportarLesiones({ equipoId, plantel, lesiones, config, onVolver, onRecargar, onListo }) {
  const { idioma, plural } = useIdioma();
  const [texto, setTexto] = useState("");
  const [progreso, setProgreso] = useState(null);
  const [fallas, setFallas] = useState([]);
  // Lo elegido para los nombres que no están en Datos básicos: { indice de
  // la fila: destino }.
  const [elegidos, setElegidos] = useState({});
  const [hojaFila, setHojaFila] = useState(null);
  // Si se sale de la pantalla en medio de la carga (otra pestaña de la
  // barra), la carga se corta ahí: lo cargado queda y lo que falta se ve al
  // volver a pegar.
  const enPantalla = useRef(true);
  useEffect(() => {
    enPantalla.current = true;
    return () => {
      enPantalla.current = false;
    };
  }, []);

  const columna = (campo) => etiquetaDeCampo(campo, config, idioma);
  const textoDeOpcion = (campo, codigo) => etiquetaDeOpcion(campo, codigo, config, idioma);

  const leido = useMemo(() => (texto.trim() ? leerLesionesPegadas(texto, { config }) : null), [texto, config]);
  const hoy = hoyISO();
  const plan = useMemo(
    () => (leido && !leido.error ? planDeImportacion(leido.filas, { plantel, lesiones, config, hoy, elegidos }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leido, plantel, lesiones, config, elegidos],
  );
  const aCargar = useMemo(() => ordenDeCarga(plan), [plan]);
  const cuantas = (estado) => plan.filter((fila) => fila.estado === estado).length;

  // Los nombres que no están en Datos básicos y todavía no se eligió qué son.
  // "Guardar igual" no toca los dudosos (los que se parecen a dos jugadores):
  // esos se eligen uno por uno.
  const sinElegir = plan.filter((fila) => fila.estado === ESTADOS.sinJugador);
  const fueraDeDatos = sinElegir.filter((fila) => !fila.dudoso);
  const sinFecha = aCargar.filter((fila) => fila.faltan.includes("fecha_lesion")).length;

  const pegarTexto = (nuevo) => {
    setTexto(nuevo);
    setFallas([]);
    setElegidos({});
  };

  // Qué puede ser una fila con un nombre que no está en Datos básicos.
  const filaDeLaHoja = plan.find((fila) => fila.indice === hojaFila) || null;
  const opcionesDeLaHoja = filaDeLaHoja
    ? [
        { valor: COMO_PERSONA, etiqueta: t("lesiones.importar.comoPersona") },
        { valor: NO_CARGAR, etiqueta: t("lesiones.importar.noCargar") },
        ...plantel.map((jugador) => ({ valor: String(jugador.id), etiqueta: jugador.nombre })),
      ]
    : [];
  const elegidoDeLaHoja = filaDeLaHoja ? (filaDeLaHoja.destino ?? (filaDeLaHoja.jugador ? String(filaDeLaHoja.jugador.id) : null)) : null;
  // Qué dice el botón de una fila que se puede elegir.
  const textoDelDestino = (fila) => {
    if (fila.estado === ESTADOS.sinJugador) return t(fila.dudoso ? "lesiones.importar.estado.dudoso" : "lesiones.importar.estado.sinJugador");
    if (fila.estado === ESTADOS.noVa) return t("lesiones.importar.estado.noVa");
    if (fila.estado === ESTADOS.conProblemas) return t("lesiones.importar.estado.conProblemas");
    if (fila.fueraDeDatos) return t("lesiones.importar.estado.comoPersona");
    if (fila.destino) return t("lesiones.importar.es", { jugador: fila.jugador?.nombre || "—" });
    return t(`lesiones.importar.estado.${fila.estado}`);
  };
  // Se puede elegir qué es una fila si su nombre no está en Datos básicos
  // (o se eligió a mano), mientras no esté ya en la app.
  const sePuedeElegir = (fila) => fila.estado !== ESTADOS.yaEsta && (fila.destino !== null || !fila.jugador || fila.dudoso);

  // Un problema en palabras: los de la carga a mano dicen la parte y el lado.
  const textoDelProblema = (fila, clave) =>
    t(clave, {
      parte: textoDeOpcion("parte_cuerpo", fila.lesion.datos.parte_cuerpo),
      lado: textoDeOpcion("lado", fila.lesion.datos.lado),
    });

  const casoDe = (fila) => (fila.numeroCaso !== null ? t("lesiones.importar.caso", { n: fila.numeroCaso }) : t("lesiones.importar.sinCaso"));

  // Qué lesión es: la parte, el lado y desde cuándo.
  const detalleDe = (fila) => {
    const { datos, fecha_lesion: fecha } = fila.lesion;
    return [
      [textoDeOpcion("parte_cuerpo", datos.parte_cuerpo), datos.lado ? `(${textoDeOpcion("lado", datos.lado)})` : ""].filter(Boolean).join(" "),
      textoDeOpcion("tipo_lesion", datos.tipo_lesion),
      fecha ? t("lesiones.desde", { fecha: fechaCorta(fecha) }) : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const cargar = async () => {
    const lista = aCargar;
    if (lista.length === 0) return;
    const errores = [];
    let cargadas = 0;
    setFallas([]);
    for (let i = 0; i < lista.length; i++) {
      if (!enPantalla.current) break;
      const fila = lista[i];
      setProgreso({ n: i + 1, total: lista.length });
      const guardado = await importarLesion(equipoId, fila.lesion); // eslint-disable-line no-await-in-loop
      if (guardado.error) errores.push({ caso: casoDe(fila), nombre: fila.nombre, error: textoDelProblema(fila, guardado.error) });
      else cargadas += 1;
    }
    // Con las lesiones de nuevo, las que ya quedaron se ven como "Ya está en
    // la app" y las que fallaron se pueden volver a intentar (con lo elegido).
    await onRecargar();
    if (!enPantalla.current) return;
    setProgreso(null);
    if (errores.length === 0) {
      onListo({ cargadas });
      return;
    }
    setFallas(errores);
  };

  const ocupado = Boolean(progreso);

  return (
    <div className="app">
      <div className="contenedor datos-importar">
        <header className="encabezado lesiones-encabezado">
          <div className="lesiones-encabezado-texto">
            <h1>{t("lesiones.importar.titulo")}</h1>
            <p>{t("lesiones.importar.texto")}</p>
          </div>
          <SelectorIdioma className="lesiones-idioma" />
        </header>

        <section className="tarjeta datos-importar-pegado">
          <textarea
            rows={5}
            value={texto}
            placeholder={t("lesiones.importar.pegarAca")}
            aria-label={t("lesiones.importar.pegarAca")}
            spellCheck={false}
            disabled={ocupado}
            onChange={(evento) => pegarTexto(evento.target.value)}
          />
          {texto && (
            <button type="button" className="boton-secundario" onClick={() => pegarTexto("")} disabled={ocupado}>
              <Icono nombre="borrar" size={15} />
              {t("lesiones.importar.borrar")}
            </button>
          )}
        </section>

        {leido?.error && <div className="lesiones-estado error">{t(leido.error)}</div>}

        {fallas.length > 0 && (
          <div className="lesiones-estado error datos-importar-fallas" role="alert">
            <b>{plural("lesiones.importar.fallaron", fallas.length)}</b>
            <ul>
              {fallas.map((falla, i) => (
                <li key={`${falla.caso}-${i}`}>{t("lesiones.importar.fallo", falla)}</li>
              ))}
            </ul>
          </div>
        )}

        {plan.length > 0 && (
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{plural("lesiones.importar.filas", plan.length)}</b>
            </div>
            <p className="datos-importar-resumen">
              {[
                plural("lesiones.importar.nuevas", cuantas(ESTADOS.nueva)),
                ...(sinFecha ? [plural("lesiones.importar.sinFechas", sinFecha)] : []),
                plural("lesiones.importar.yaEstan", cuantas(ESTADOS.yaEsta)),
                ...(sinElegir.length ? [plural("lesiones.importar.porElegir", sinElegir.length)] : []),
                ...(cuantas(ESTADOS.noVa) ? [plural("lesiones.importar.noVan", cuantas(ESTADOS.noVa))] : []),
                ...(cuantas(ESTADOS.conProblemas) ? [plural("lesiones.importar.conProblemas", cuantas(ESTADOS.conProblemas))] : []),
              ].join(" · ")}
            </p>
            {fueraDeDatos.length > 0 && (
              <div className="datos-importar-elegir-todos">
                <p className="lesiones-ayuda">{plural("lesiones.importar.fueraDeDatos", fueraDeDatos.length)}</p>
                <button
                  type="button"
                  className="boton-secundario datos-importar-confirmar"
                  onClick={() => setElegidos((previos) => ({ ...previos, ...Object.fromEntries(fueraDeDatos.map((fila) => [fila.indice, COMO_PERSONA])) }))}
                  disabled={ocupado}
                >
                  {plural("lesiones.importar.guardarTodasIgual", fueraDeDatos.length)}
                </button>
              </div>
            )}
            <ul className="datos-importar-lista">
              {plan.map((fila) => (
                <li key={fila.indice} className={fila.estado === ESTADOS.noVa || fila.estado === ESTADOS.yaEsta ? "apagada" : ""}>
                  <div className="datos-importar-fila">
                    <b>
                      {casoDe(fila)} · {fila.nombre}
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
                        <span>{t(`lesiones.importar.estado.${fila.estado}`)}</span>
                      </span>
                    )}
                  </div>
                  {detalleDe(fila) && <p className="datos-importar-detalle">{detalleDe(fila)}</p>}
                  {fila.estado === ESTADOS.sinJugador && (
                    <p className="datos-importar-aviso">{t(fila.dudoso ? "lesiones.importar.jugadorDudoso" : "lesiones.importar.sinJugador")}</p>
                  )}
                  {fila.estado === ESTADOS.nueva && fila.fueraDeDatos && <p className="datos-importar-detalle">{t("lesiones.importar.seGuardaComoPersona")}</p>}
                  {fila.problemas.map((clave) => (
                    <p className="datos-importar-problema" key={clave}>
                      {textoDelProblema(fila, clave)}
                    </p>
                  ))}
                  {fila.estado === ESTADOS.nueva && fila.faltan.length > 0 && (
                    <p className="datos-importar-aviso">{t("lesiones.importar.faltaCompletar", { columnas: fila.faltan.map(columna).join(", ") })}</p>
                  )}
                  {fila.estado !== ESTADOS.yaEsta &&
                    fila.estado !== ESTADOS.noVa &&
                    fila.avisos.map((aviso) => (
                      <p className="datos-importar-aviso" key={aviso.campo}>
                        {t("lesiones.importar.aviso", { valor: aviso.valor, columna: columna(aviso.campo) })}
                      </p>
                    ))}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="acciones-dobles">
          <BotonVolver onClick={onVolver} disabled={ocupado}>
            {t("comun.volver")}
          </BotonVolver>
          <button type="button" className="boton-principal" onClick={cargar} disabled={ocupado || aCargar.length === 0}>
            {progreso
              ? t("lesiones.importar.cargando", progreso)
              : aCargar.length === 0
                ? t("lesiones.importar.nadaQueCargar")
                : plural("lesiones.importar.cargar", aCargar.length)}
          </button>
        </div>
      </div>

      <HojaOpciones
        abierta={Boolean(filaDeLaHoja)}
        titulo={filaDeLaHoja ? t("lesiones.importar.quienEs", { nombre: filaDeLaHoja.nombre }) : ""}
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
