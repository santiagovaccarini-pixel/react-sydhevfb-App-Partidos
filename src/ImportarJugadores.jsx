import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { CAMPOS_IMPORTABLES, NO_CARGAR, NUEVO, cambiosPara, emparejar, formatoDeFechas, interpretarFila, leerPegado } from "./domain/importarJugadores.js";
import { etiquetaDeCampo, etiquetaDeOpcion, opcionesDeCampo } from "./domain/lesionesCampos.js";
import { agregarJugadorBasico, guardarDatosJugador } from "./domain/lesionesDb.js";
import { t, useIdioma } from "./idioma/index.js";
import { hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// Pegar desde Excel, en Datos básicos: se pega la tabla de la hoja "Datos
// Básicos" (con su fila de cabeceras) y antes de guardar nada se ve qué pasa
// con cada fila: si es un jugador nuevo, si ya está en la app (y qué le
// cambia) o si no se carga. Quién es cada fila se puede corregir a mano, y
// un nombre solo parecido no se carga hasta que alguien confirma quién es.

const LISTAS = ["categoria", "pie_dominante", "posicion"];

// Las columnas que no son de Lesiones tienen su propio texto.
const TEXTOS_PROPIOS = { foto_url: "datos.foto", horas_previas: "datos.horasPrevias" };

export default function ImportarJugadores({ equipoId, plantel, config, onVolver, onRecargar, onListo }) {
  const { idioma, plural } = useIdioma();
  const [texto, setTexto] = useState("");
  // Lo que se cambió a mano: { índice de la fila: destino }.
  const [elegidos, setElegidos] = useState({});
  const [hojaFila, setHojaFila] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [fallas, setFallas] = useState([]);
  // Si se sale de la pantalla en medio de la carga, la carga se corta ahí
  // (como en Pegar lesiones): lo cargado queda.
  const enPantalla = useRef(true);
  useEffect(() => {
    enPantalla.current = true;
    return () => {
      enPantalla.current = false;
    };
  }, []);

  const columna = (campo) => (TEXTOS_PROPIOS[campo] ? t(TEXTOS_PROPIOS[campo]) : etiquetaDeCampo(campo, config, idioma));

  // Las opciones de cada lista, con el texto de los dos idiomas: el Excel
  // escribe en portugués o en español.
  const listas = useMemo(
    () =>
      Object.fromEntries(
        LISTAS.map((campo) => [
          campo,
          opcionesDeCampo(campo, config, idioma).map((opcion) => ({
            ...opcion,
            alias: [etiquetaDeOpcion(campo, opcion.valor, config, idioma === "pt-BR" ? "es-AR" : "pt-BR")],
          })),
        ]),
      ),
    [config, idioma],
  );

  // Las cabeceras también valen con el nombre que el club les puso (en los
  // dos idiomas); el del nombre es la cabecera del jugador en Lesiones.
  const alias = useMemo(
    () => ({
      nombre: [etiquetaDeCampo("jugador", config, "es-AR"), etiquetaDeCampo("jugador", config, "pt-BR")],
      ...Object.fromEntries(
        CAMPOS_IMPORTABLES.filter((campo) => !["foto_url", "horas_previas"].includes(campo)).map((campo) => [
          campo,
          [etiquetaDeCampo(campo, config, "es-AR"), etiquetaDeCampo(campo, config, "pt-BR")],
        ]),
      ),
    }),
    [config],
  );

  const leido = useMemo(() => (texto.trim() ? leerPegado(texto, { alias }) : null), [texto, alias]);
  const hoy = hoyISO();
  // Las fechas se leen igual en toda la columna (día/mes o mes/día).
  const formatoFecha = useMemo(() => formatoDeFechas((leido?.filas || []).map((fila) => fila.textos.fecha_nacimiento)), [leido]);

  const filas = useMemo(() => {
    if (!leido || leido.error) return [];
    const sugeridos = emparejar(leido.filas, plantel);
    return leido.filas.map((fila, i) => {
      const { datos, avisos } = interpretarFila(fila, { listas, hoy, formatoFecha });
      const destino = elegidos[fila.indice] ?? sugeridos[i].destino;
      const jugador = destino !== NUEVO && destino !== NO_CARGAR ? plantel.find((uno) => String(uno.id) === destino) || null : null;
      const cambios = destino === NUEVO ? datos : jugador ? cambiosPara(datos, jugador) : {};
      // Lo sugerido sin tocar: "igual", "parecido", "nuevo" o "repetido".
      const como = fila.indice in elegidos ? "elegido" : sugeridos[i].como;
      // Un nombre solo parecido no se carga hasta confirmar quién es.
      const porConfirmar = como === "parecido";
      const hayQueHacer = !porConfirmar && (destino === NUEVO || Object.keys(cambios).length > 0);
      return { ...fila, datos, avisos, destino, jugador, cambios, hayQueHacer, como, porConfirmar };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leido, plantel, listas, elegidos, formatoFecha]);

  const aCargar = filas.filter((fila) => fila.destino !== NO_CARGAR && fila.hayQueHacer);
  const nuevos = filas.filter((fila) => fila.destino === NUEVO).length;
  const conCambios = filas.filter((fila) => fila.jugador && !fila.porConfirmar && fila.hayQueHacer).length;
  const iguales = filas.filter((fila) => fila.jugador && !fila.porConfirmar && !fila.hayQueHacer).length;
  const porConfirmar = filas.filter((fila) => fila.porConfirmar).length;

  const pegarTexto = (nuevo) => {
    setTexto(nuevo);
    setElegidos({});
    setFallas([]);
  };

  const textoDelDestino = (fila) => {
    if (fila.destino === NUEVO) return t("datos.importar.nuevo");
    if (fila.destino === NO_CARGAR) return fila.como === "repetido" ? t("datos.importar.repetido") : t("datos.importar.noCargar");
    const nombre = fila.jugador?.nombre || "—";
    return fila.como === "parecido" ? t("datos.importar.pareceSer", { jugador: nombre }) : t("datos.importar.es", { jugador: nombre });
  };

  const detalleDe = (fila) => {
    if (fila.destino === NO_CARGAR) return "";
    const columnas = Object.keys(fila.cambios).map(columna).join(", ");
    if (fila.porConfirmar) return columnas ? t("datos.importar.cambiaria", { columnas }) : t("datos.importar.sinCambios");
    if (fila.destino === NUEVO) return columnas ? t("datos.importar.trae", { columnas }) : t("datos.importar.sinDatos");
    return columnas ? t("datos.importar.cambia", { columnas }) : t("datos.importar.sinCambios");
  };

  // Quién puede ser una fila: nuevo, no cargarla, o un jugador de la app que
  // no esté ya elegido para otra fila.
  const filaDeLaHoja = filas.find((fila) => fila.indice === hojaFila) || null;
  const opcionesDeLaHoja = useMemo(() => {
    if (!filaDeLaHoja) return [];
    const tomados = new Set(filas.filter((fila) => fila.indice !== filaDeLaHoja.indice && fila.jugador).map((fila) => String(fila.jugador.id)));
    return [
      { valor: NUEVO, etiqueta: t("datos.importar.nuevo") },
      { valor: NO_CARGAR, etiqueta: t("datos.importar.noCargar") },
      ...plantel.filter((jugador) => !tomados.has(String(jugador.id))).map((jugador) => ({ valor: String(jugador.id), etiqueta: jugador.nombre })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filaDeLaHoja, filas, plantel, idioma]);

  const cargar = async () => {
    const lista = aCargar;
    if (lista.length === 0) return;
    const errores = [];
    // Las filas que ya quedaron en la app (aunque sea sin sus datos).
    const hechas = new Set();
    let creados = 0;
    let actualizados = 0;
    // Si la base todavía no tiene las horas previas, lo demás se guarda igual
    // y se avisa una vez.
    let sinHoras = false;
    setFallas([]);
    for (let i = 0; i < lista.length; i++) {
      if (!enPantalla.current) break;
      const fila = lista[i];
      setProgreso({ n: i + 1, total: lista.length });
      if (fila.destino === NUEVO) {
        const creado = await agregarJugadorBasico(equipoId, fila.nombre); // eslint-disable-line no-await-in-loop
        if (creado.error) {
          errores.push({ nombre: fila.nombre, error: t(creado.error) });
          continue;
        }
        creados += 1;
        hechas.add(fila.indice);
        if (Object.keys(fila.datos).length > 0) {
          const guardado = await guardarDatosJugador(creado.jugador.id, fila.datos); // eslint-disable-line no-await-in-loop
          if (guardado.error) errores.push({ nombre: fila.nombre, error: t("datos.importar.sinDatosGuardados", { error: t(guardado.error) }) });
          if (guardado.aviso) sinHoras = true;
        }
      } else {
        const guardado = await guardarDatosJugador(fila.jugador.id, fila.cambios); // eslint-disable-line no-await-in-loop
        if (guardado.error) {
          errores.push({ nombre: fila.nombre, error: t(guardado.error) });
          continue;
        }
        if (guardado.aviso) sinHoras = true;
        actualizados += 1;
        hechas.add(fila.indice);
      }
    }
    // Con el plantel nuevo, lo que ya se cargó se reconoce solo ("Ya tiene
    // estos datos"); lo elegido a mano en las filas que fallaron se respeta
    // para volver a intentar.
    await onRecargar();
    if (!enPantalla.current) return;
    setProgreso(null);
    setElegidos((previos) => Object.fromEntries(Object.entries(previos).filter(([indice]) => !hechas.has(Number(indice)))));
    if (sinHoras) errores.push({ nombre: t("datos.horasPrevias"), error: t("datos.error.faltanHorasPrevias") });
    if (errores.length === 0) {
      onListo({ nuevos: creados, actualizados });
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
            <h1>{t("datos.importar.titulo")}</h1>
            <p>{t("datos.importar.texto")}</p>
          </div>
          <SelectorIdioma className="lesiones-idioma" />
        </header>

        <section className="tarjeta datos-importar-pegado">
          <textarea
            rows={5}
            value={texto}
            placeholder={t("datos.importar.pegarAca")}
            aria-label={t("datos.importar.pegarAca")}
            spellCheck={false}
            disabled={ocupado}
            onChange={(evento) => pegarTexto(evento.target.value)}
          />
          {texto && (
            <button type="button" className="boton-secundario" onClick={() => pegarTexto("")} disabled={ocupado}>
              <Icono nombre="borrar" size={15} />
              {t("datos.importar.borrar")}
            </button>
          )}
        </section>

        {leido?.error && <div className="lesiones-estado error">{t(leido.error)}</div>}

        {fallas.length > 0 && (
          <div className="lesiones-estado error datos-importar-fallas" role="alert">
            <b>{plural("datos.importar.fallaron", fallas.length)}</b>
            <ul>
              {fallas.map((falla, i) => (
                <li key={`${falla.nombre}-${i}`}>{t("datos.importar.fallo", falla)}</li>
              ))}
            </ul>
          </div>
        )}

        {filas.length > 0 && (
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{plural("datos.importar.jugadores", filas.length)}</b>
            </div>
            <p className="datos-importar-resumen">
              {[
                plural("datos.importar.nuevos", nuevos),
                t("datos.importar.conCambios", { n: conCambios }),
                t("datos.importar.iguales", { n: iguales }),
                ...(porConfirmar ? [plural("datos.importar.porConfirmar", porConfirmar)] : []),
              ].join(" · ")}
            </p>
            <ul className="datos-importar-lista">
              {filas.map((fila) => (
                <li key={fila.indice} className={fila.destino === NO_CARGAR ? "apagada" : ""}>
                  <div className="datos-importar-fila">
                    <b>{fila.nombre}</b>
                    <button
                      type="button"
                      className={`datos-importar-destino ${fila.destino === NUEVO ? "nuevo" : fila.destino === NO_CARGAR ? "fuera" : fila.como === "parecido" ? "dudoso" : "existe"}`}
                      onClick={() => setHojaFila(fila.indice)}
                      disabled={ocupado}
                    >
                      <span>{textoDelDestino(fila)}</span>
                      <Icono nombre="flecha" size={13} />
                    </button>
                  </div>
                  {detalleDe(fila) && <p className="datos-importar-detalle">{detalleDe(fila)}</p>}
                  {fila.porConfirmar && fila.destino !== NO_CARGAR && (
                    <button
                      type="button"
                      className="boton-secundario datos-importar-confirmar"
                      onClick={() => setElegidos((previos) => ({ ...previos, [fila.indice]: fila.destino }))}
                      disabled={ocupado}
                    >
                      {t("datos.importar.confirmar", { jugador: fila.jugador?.nombre || "—" })}
                    </button>
                  )}
                  {fila.destino !== NO_CARGAR &&
                    fila.avisos.map((aviso) => (
                      <p className="datos-importar-aviso" key={aviso.campo}>
                        {t("datos.importar.aviso", { valor: aviso.valor, columna: columna(aviso.campo) })}
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
              ? t("datos.importar.cargando", progreso)
              : aCargar.length === 0
                ? t("datos.importar.nadaQueCargar")
                : plural("datos.importar.cargar", aCargar.length)}
          </button>
        </div>
      </div>

      <HojaOpciones
        abierta={Boolean(filaDeLaHoja)}
        titulo={filaDeLaHoja ? t("datos.importar.quienEs", { nombre: filaDeLaHoja.nombre }) : ""}
        opciones={opcionesDeLaHoja}
        elegida={filaDeLaHoja?.destino}
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
