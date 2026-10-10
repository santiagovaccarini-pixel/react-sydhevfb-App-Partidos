import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icono } from "./components/AppChrome";
import { BotonVolver } from "./components/BotonVolver.jsx";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { opcionesDeLista, tituloDeColumna } from "./domain/evaluaciones/ajustes.js";
import { configGpsVacia } from "./domain/gps/ajustes.js";
import { COMO_PERSONA, ESTADOS, NO_CARGAR, leerGpsPegado, ordenDeCarga, planDelGps } from "./domain/gps/importar.js";
import { crearFilasGps, listarGps } from "./domain/gpsDb.js";
import { fechaDelExcel, formatoDeLasFechas } from "./domain/importarLesiones.js";
import { nombreIgual } from "./domain/importarPersonas.js";
import { actualesPrimero, cargarPlantelConCatapult, esActual } from "./domain/plantel.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// Pegar desde Excel, en GPS › Base: la hoja BD_GPS (con su fila de títulos)
// se trae una vez tal como está (Santiago, 10/10): también los promedios del
// equipo y los "por minuto". Antes de guardar se ve qué pasa con lo pegado,
// como en Evaluaciones: cuántas filas se cargan, cuántas ya están, los
// nombres que no están en Datos básicos (se elige qué es cada uno, una vez
// por nombre) y lo que no se entendió. Son miles de filas: no se listan una
// por una, se resumen.

// Cuántas filas con problemas se muestran (las demás se cuentan).
const PROBLEMAS_A_LA_VISTA = 30;
// Cuántos ejemplos de lo que no se entendió en una columna.
const EJEMPLOS = 3;
// El navegador muestra "Leyendo…" antes de cada cuenta larga.
const ESPERA_PARA_PINTAR = 30;

// Cuántas veces aparece cada cosa: [{ clave, cantidad }], de más a menos.
const contar = (claves) => {
  const cuantas = new Map();
  claves.forEach((clave) => cuantas.set(clave, (cuantas.get(clave) || 0) + 1));
  return [...cuantas.entries()].map(([clave, cantidad]) => ({ clave, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
};

export default function ImportarGps({ gps, config = configGpsVacia(), equipoId, plantel, plantelSinLeer = false, onVolver, onRecargar, onListo }) {
  const { idioma, plural } = useIdioma();
  const hoy = hoyISO();
  const [texto, setTexto] = useState("");
  const [leido, setLeido] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  // Las filas que ya están en la app en las fechas de lo pegado (null:
  // todavía no se leyeron).
  const [existentes, setExistentes] = useState(null);
  const [errorExistentes, setErrorExistentes] = useState("");
  const [intento, setIntento] = useState(0);
  const [plan, setPlan] = useState([]);
  const [calculando, setCalculando] = useState(false);
  // El dispositivo con que se tomaron las filas pegadas ("": ninguno).
  const [dispositivo, setDispositivo] = useState("");
  // Lo elegido para cada nombre que no está en Datos básicos: { nombre
  // normalizado: destino } (vale para todas sus filas).
  const [elegidos, setElegidos] = useState({});
  const [hojaNombre, setHojaNombre] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [falla, setFalla] = useState("");
  const [cargadasAntes, setCargadasAntes] = useState(null);
  // Los nombres en Catapult de cada jugador (el vínculo de Datos básicos):
  // el Excel nombra a cada uno como Catapult.
  const [enCatapult, setEnCatapult] = useState({});
  // Si se sale de la pantalla en medio de la carga, la carga se corta ahí: lo
  // cargado queda y lo que falta se ve al volver a pegar.
  const enPantalla = useRef(true);
  useEffect(() => {
    enPantalla.current = true;
    return () => {
      enPantalla.current = false;
    };
  }, []);

  useEffect(() => {
    let vigente = true;
    cargarPlantelConCatapult(equipoId).then(({ plantel: lista }) => {
      if (!vigente) return;
      setEnCatapult(Object.fromEntries((lista || []).filter((jugador) => jugador.catapult_nombre).map((jugador) => [String(jugador.id), jugador.catapult_nombre])));
    });
    return () => {
      vigente = false;
    };
  }, [equipoId]);

  const conCatapult = useMemo(() => plantel.map((jugador) => (enCatapult[String(jugador.id)] ? { ...jugador, catapult_nombre: enCatapult[String(jugador.id)] } : jugador)), [plantel, enCatapult]);

  const columna = (clave) => {
    const suya = gps.columnas.find((una) => una.clave === clave);
    return suya ? tituloDeColumna(gps, suya, config, idioma) : clave;
  };

  // Los títulos se reconocen como en el Excel y también con el nombre que
  // les puso el club en Ajustes (en los dos idiomas).
  const titulos = useMemo(
    () => Object.fromEntries(gps.columnas.map((una) => [una.clave, ["es-AR", "pt-BR"].map((uno) => tituloDeColumna(gps, una, config, uno))])),
    [gps, config],
  );

  // Leer lo pegado (son miles de filas): después de mostrar "Leyendo…".
  useEffect(() => {
    if (!texto.trim()) {
      setLeido(null);
      setLeyendo(false);
      return undefined;
    }
    setLeyendo(true);
    const temporizador = setTimeout(() => {
      setLeido(leerGpsPegado(texto, gps.columnas, titulos));
      setLeyendo(false);
    }, ESPERA_PARA_PINTAR);
    return () => clearTimeout(temporizador);
  }, [texto, gps, titulos]);

  // De qué fechas es lo pegado: con eso se busca lo que ya está en la app.
  const rango = useMemo(() => {
    if (!leido || leido.error) return null;
    const textos = leido.filas.map((fila) => fila.textos.fecha);
    const formato = formatoDeLasFechas(textos);
    let desde = null;
    let hasta = null;
    textos.forEach((uno) => {
      const fecha = fechaDelExcel(uno, formato);
      if (!fecha) return;
      if (!desde || fecha < desde) desde = fecha;
      if (!hasta || fecha > hasta) hasta = fecha;
    });
    return { desde, hasta };
  }, [leido]);

  useEffect(() => {
    if (!rango) {
      setExistentes(null);
      return undefined;
    }
    if (!rango.desde) {
      setExistentes([]);
      return undefined;
    }
    let vigente = true;
    setExistentes(null);
    setErrorExistentes("");
    listarGps(equipoId, rango).then(({ filas, error }) => {
      if (!vigente) return;
      if (error) setErrorExistentes(error);
      else setExistentes(filas);
    });
    return () => {
      vigente = false;
    };
  }, [rango, equipoId, intento]);

  // El plan, con lo que ya está, lo elegido y el dispositivo.
  useEffect(() => {
    if (!leido || leido.error || plantelSinLeer || existentes === null) {
      setPlan([]);
      setCalculando(false);
      return undefined;
    }
    setCalculando(true);
    const temporizador = setTimeout(() => {
      setPlan(planDelGps(leido.filas, { columnas: gps.columnas, plantel: conCatapult, existentes, hoy, elegidos, config, gps, dispositivo: dispositivo || null }));
      setCalculando(false);
    }, ESPERA_PARA_PINTAR);
    return () => clearTimeout(temporizador);
  }, [leido, existentes, elegidos, dispositivo, config, gps, conCatapult, plantelSinLeer, hoy]);

  const aCargar = useMemo(() => ordenDeCarga(plan), [plan]);
  const cuantas = useMemo(() => {
    const porEstado = {};
    plan.forEach((fila) => {
      porEstado[fila.estado] = (porEstado[fila.estado] || 0) + 1;
    });
    return porEstado;
  }, [plan]);

  // Los nombres que no están en Datos básicos (o que se eligieron a mano),
  // uno por nombre: [{ llave, nombre, filas, destino, dudoso, jugador }].
  const nombres = useMemo(() => {
    const porNombre = new Map();
    plan
      .filter((fila) => fila.nombre && !fila.promedio && fila.estado !== ESTADOS.yaEsta && (fila.destino !== null || !fila.jugador || fila.dudoso))
      .forEach((fila) => {
        const llave = nombreIgual(fila.nombre);
        if (!porNombre.has(llave)) porNombre.set(llave, { llave, nombre: fila.nombre, filas: 0, destino: fila.destino, dudoso: fila.dudoso, jugador: fila.jugador });
        porNombre.get(llave).filas += 1;
      });
    return [...porNombre.values()].sort((a, b) => b.filas - a.filas || a.nombre.localeCompare(b.nombre));
  }, [plan]);
  const sinElegir = nombres.filter((uno) => uno.destino === null);
  // "Guardar igual" no toca los dudosos (los que se parecen a dos jugadores):
  // esos se eligen uno por uno.
  const fueraDeDatos = sinElegir.filter((uno) => !uno.dudoso);

  // Lo que no se entendió (queda vacío) y los textos que no están en su
  // lista (se guardan como vinieron), por columna, en las filas que se cargan.
  const { avisos, fueraDeLista } = useMemo(() => {
    const conocidas = {};
    const listas = gps.columnas.filter((una) => una.tipo === "lista");
    listas.forEach((una) => {
      conocidas[una.clave] = new Set(opcionesDeLista(una.lista, config, "es-AR", { test: gps, conOcultas: true }).map((opcion) => opcion.valor));
    });
    const deAvisos = [];
    const deListas = [];
    aCargar.forEach((fila) => {
      fila.avisos.forEach((aviso) => deAvisos.push(`${aviso.campo}\u0000${aviso.valor}`));
      listas.forEach((una) => {
        const valor = fila.fila.datos[una.clave];
        if (valor !== undefined && una.clave !== "dispositivo" && !conocidas[una.clave].has(valor)) deListas.push(`${una.clave}\u0000${valor}`);
      });
    });
    const porColumna = (claves) => {
      const columnas = new Map();
      contar(claves).forEach(({ clave, cantidad }) => {
        const [campo, valor] = clave.split("\u0000");
        if (!columnas.has(campo)) columnas.set(campo, { campo, cantidad: 0, valores: [] });
        const suya = columnas.get(campo);
        suya.cantidad += cantidad;
        suya.valores.push({ valor, cantidad });
      });
      return [...columnas.values()];
    };
    return { avisos: porColumna(deAvisos), fueraDeLista: porColumna(deListas) };
  }, [aCargar, gps, config]);

  const conProblemas = plan.filter((fila) => fila.estado === ESTADOS.conProblemas);
  const dispositivos = opcionesDeLista("dispositivo", config, idioma, { test: gps });

  const pegarTexto = (nuevo) => {
    setTexto(nuevo);
    setFalla("");
    setCargadasAntes(null);
    setElegidos({});
  };

  // Qué puede ser un nombre que no está en Datos básicos.
  const nombreDeLaHoja = nombres.find((uno) => uno.llave === hojaNombre) || null;
  const opcionesDeLaHoja = nombreDeLaHoja
    ? [
        { valor: COMO_PERSONA, etiqueta: t("gps.importar.comoPersona") },
        { valor: NO_CARGAR, etiqueta: t("gps.importar.noCargar") },
        ...actualesPrimero(plantel).map((jugador) => ({ valor: String(jugador.id), etiqueta: esActual(jugador) ? jugador.nombre : `${jugador.nombre} · ${t("datos.yaNoEsta")}` })),
      ]
    : [];
  const elegidoDeLaHoja = nombreDeLaHoja ? (nombreDeLaHoja.destino ?? (nombreDeLaHoja.jugador ? String(nombreDeLaHoja.jugador.id) : null)) : null;
  const textoDelDestino = (uno) => {
    if (uno.destino === COMO_PERSONA) return t("gps.importar.estado.comoPersona");
    if (uno.destino === NO_CARGAR) return t("gps.importar.estado.noVa");
    if (uno.destino) return t("gps.importar.es", { jugador: uno.jugador?.nombre || "—" });
    return t(uno.dudoso ? "gps.importar.estado.dudoso" : "gps.importar.estado.sinJugador");
  };
  const claseDelDestino = (uno) => (uno.destino === NO_CARGAR ? "fuera" : uno.destino ? "nuevo" : "dudoso");

  // De qué día es: la fecha, o como vino si no se entiende.
  const fechaDe = (fila) => (fila.fila.fecha ? fechaCorta(fila.fila.fecha) : fila.textos.fecha || t("gps.sinFecha"));

  const cargar = async () => {
    const lista = aCargar;
    if (lista.length === 0) return;
    // Los nombres que siguen sin elegir no se cargan: la pantalla queda
    // abierta con ellos.
    const quedanSinElegir = sinElegir.length;
    setFalla("");
    setCargadasAntes(null);
    setProgreso({ n: 0, total: lista.length });
    const { creadas, error } = await crearFilasGps(
      equipoId,
      lista.map((fila) => fila.fila),
      {
        alAvanzar: (n, total) => enPantalla.current && setProgreso({ n, total }),
        seguir: () => enPantalla.current,
      },
    );
    // Lo cargado ya cuenta como "Ya está en la app": al volver a intentar no
    // se carga dos veces.
    if (enPantalla.current && creadas.length) setExistentes((previas) => [...(previas || []), ...creadas]);
    await onRecargar();
    if (!enPantalla.current) return;
    setProgreso(null);
    if (!error && quedanSinElegir === 0) {
      onListo({ cargadas: creadas.length });
      return;
    }
    setFalla(error);
    setCargadasAntes(creadas.length);
  };

  const ocupado = Boolean(progreso);
  const resumen = [
    plural("gps.importar.nuevas", cuantas[ESTADOS.nueva] || 0),
    plural("gps.importar.yaEstan", cuantas[ESTADOS.yaEsta] || 0),
    ...(cuantas[ESTADOS.sinJugador] ? [plural("gps.importar.porElegir", cuantas[ESTADOS.sinJugador])] : []),
    ...(cuantas[ESTADOS.noVa] ? [plural("gps.importar.noVan", cuantas[ESTADOS.noVa])] : []),
    ...(cuantas[ESTADOS.conProblemas] ? [plural("gps.importar.conProblemas", cuantas[ESTADOS.conProblemas])] : []),
  ].join(" · ");
  const ejemplos = (valores) =>
    valores
      .slice(0, EJEMPLOS)
      .map((uno) => `«${uno.valor}»`)
      .join(", ") + (valores.length > EJEMPLOS ? "…" : "");

  return (
    <div className="app">
      <div className="contenedor datos-importar">
        <header className="encabezado lesiones-encabezado">
          <div className="lesiones-encabezado-texto">
            <h1>{t("gps.importar.titulo")}</h1>
            <p>{t("gps.importar.texto")}</p>
            <p>{t("gps.importar.decimales")}</p>
          </div>
          <SelectorIdioma className="lesiones-idioma" />
        </header>

        <section className="tarjeta datos-importar-pegado">
          {/* Lo pegado no se escribe en el cuadro (son megas de texto): se lee y se resume abajo. */}
          <textarea
            rows={4}
            defaultValue=""
            placeholder={texto ? t("gps.importar.pegarOtraVez") : t("gps.importar.pegarAca")}
            aria-label={t("gps.importar.pegarAca")}
            spellCheck={false}
            disabled={ocupado}
            onPaste={(evento) => {
              const pegado = evento.clipboardData?.getData("text/plain") || evento.clipboardData?.getData("text") || "";
              if (!pegado) return;
              evento.preventDefault();
              pegarTexto(pegado);
            }}
            onChange={(evento) => {
              const escrito = evento.target.value;
              if (!escrito.trim()) return;
              evento.target.value = "";
              pegarTexto(escrito);
            }}
          />
          {texto && (
            <div className="gps-pegado">
              <span>{leyendo ? t("gps.importar.leyendo") : leido && !leido.error ? plural("gps.importar.filas", leido.filas.length) : ""}</span>
              <button type="button" className="boton-secundario" onClick={() => pegarTexto("")} disabled={ocupado}>
                <Icono nombre="borrar" size={15} />
                {t("gps.importar.borrar")}
              </button>
            </div>
          )}
        </section>

        <section className="tarjeta gps-dispositivo">
          <label className="campo-inicio">
            <span>{t("gps.importar.dispositivo")}</span>
            <select value={dispositivo} onChange={(evento) => setDispositivo(evento.target.value)} disabled={ocupado}>
              <option value="">{t("gps.sinDispositivo")}</option>
              {dispositivos.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <p className="lesiones-ayuda">{dispositivos.length ? t("gps.importar.dispositivoAyuda") : t("gps.importar.sinDispositivos")}</p>
        </section>

        {plantelSinLeer && texto.trim() && <div className="lesiones-estado error">{t("gps.importar.plantelSinLeer")}</div>}
        {leido?.error && <div className="lesiones-estado error">{t(leido.error)}</div>}
        {errorExistentes && (
          <div className="lesiones-estado error">
            {t(errorExistentes)}{" "}
            <button type="button" onClick={() => setIntento((antes) => antes + 1)}>
              {t("comun.reintentar")}
            </button>
          </div>
        )}
        {leido && !leido.error && !plantelSinLeer && !errorExistentes && (existentes === null || calculando) && !ocupado && (
          <p className="lesiones-estado" role="status">
            {existentes === null ? t("gps.importar.buscando") : t("gps.importar.revisando")}
          </p>
        )}

        {cargadasAntes > 0 && (
          <p className="lesiones-estado" role="status">
            {plural("gps.importar.listo", cargadasAntes)}
          </p>
        )}
        {falla && (
          <div className="lesiones-estado error" role="alert">
            {t("gps.importar.fallo", { error: t(falla) })}
          </div>
        )}

        {plan.length > 0 && (
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{plural("gps.importar.filas", plan.length)}</b>
            </div>
            {rango?.desde && <p className="datos-importar-resumen">{t("gps.importar.fechas", { desde: fechaCorta(rango.desde), hasta: fechaCorta(rango.hasta) })}</p>}
            <p className="datos-importar-resumen">{resumen}</p>
          </section>
        )}

        {nombres.length > 0 && (
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{plural("gps.importar.nombres", nombres.length)}</b>
            </div>
            {fueraDeDatos.length > 0 && (
              <div className="datos-importar-elegir-todos">
                <p className="lesiones-ayuda">{plural("gps.importar.fueraDeDatos", fueraDeDatos.length)}</p>
                <button
                  type="button"
                  className="boton-secundario datos-importar-confirmar"
                  onClick={() => setElegidos((previos) => ({ ...previos, ...Object.fromEntries(fueraDeDatos.map((uno) => [uno.llave, COMO_PERSONA])) }))}
                  disabled={ocupado}
                >
                  {plural("gps.importar.guardarTodosIgual", fueraDeDatos.length)}
                </button>
              </div>
            )}
            <ul className="datos-importar-lista">
              {nombres.map((uno) => (
                <li key={uno.llave} className={uno.destino === NO_CARGAR ? "apagada" : ""}>
                  <div className="datos-importar-fila">
                    <b>
                      {uno.nombre} <span className="gps-cuantas">· {plural("gps.importar.filasDelNombre", uno.filas)}</span>
                    </b>
                    <button type="button" className={`datos-importar-destino ${claseDelDestino(uno)}`} onClick={() => setHojaNombre(uno.llave)} disabled={ocupado}>
                      <span>{textoDelDestino(uno)}</span>
                      <Icono nombre="flecha" size={13} />
                    </button>
                  </div>
                  {uno.destino === null && <p className="datos-importar-aviso">{t(uno.dudoso ? "gps.importar.jugadorDudoso" : "gps.importar.sinJugador")}</p>}
                </li>
              ))}
            </ul>
            {sinElegir.length > 0 && aCargar.length > 0 && (
              <p className="datos-importar-aviso datos-importar-sin-elegir">{plural("gps.importar.quedanSinElegir", sinElegir.length)}</p>
            )}
          </section>
        )}

        {conProblemas.length > 0 && (
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{plural("gps.importar.conProblemas", conProblemas.length)}</b>
            </div>
            <ul className="datos-importar-lista">
              {conProblemas.slice(0, PROBLEMAS_A_LA_VISTA).map((fila) => (
                <li key={fila.indice}>
                  <b className="gps-fila-problema">
                    {fechaDe(fila)} · {fila.nombre || t("gps.importar.sinNombreFila")}
                  </b>
                  {fila.problemas.map((clave) => (
                    <p className="datos-importar-problema" key={clave}>
                      {t(clave)}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            {conProblemas.length > PROBLEMAS_A_LA_VISTA && <p className="datos-importar-resumen">{plural("gps.importar.yMas", conProblemas.length - PROBLEMAS_A_LA_VISTA)}</p>}
          </section>
        )}

        {(avisos.length > 0 || fueraDeLista.length > 0) && (
          <section className="tarjeta tarjeta-ficha">
            <div className="cabeza-ficha">
              <b>{t("gps.importar.revisar")}</b>
            </div>
            <ul className="datos-importar-lista">
              {avisos.map((uno) => (
                <li key={`aviso-${uno.campo}`}>
                  <p className="datos-importar-aviso">{plural("gps.importar.avisoColumna", uno.cantidad, { columna: columna(uno.campo), valores: ejemplos(uno.valores) })}</p>
                </li>
              ))}
              {fueraDeLista.map((uno) => (
                <li key={`lista-${uno.campo}`}>
                  <p className="datos-importar-detalle">{plural("gps.importar.fueraDeLista", uno.cantidad, { columna: columna(uno.campo), valores: ejemplos(uno.valores) })}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="acciones-dobles">
          <BotonVolver onClick={onVolver} disabled={ocupado}>
            {t("comun.volver")}
          </BotonVolver>
          <button type="button" className="boton-principal" onClick={cargar} disabled={ocupado || calculando || aCargar.length === 0}>
            {progreso ? t("gps.importar.cargando", progreso) : aCargar.length === 0 ? t("gps.importar.nadaQueCargar") : plural("gps.importar.cargar", aCargar.length)}
          </button>
        </div>
      </div>

      <HojaOpciones
        abierta={Boolean(nombreDeLaHoja)}
        titulo={nombreDeLaHoja ? t("gps.importar.quienEs", { nombre: nombreDeLaHoja.nombre }) : ""}
        opciones={opcionesDeLaHoja}
        elegida={elegidoDeLaHoja}
        buscador
        onElegir={(destino) => {
          const llave = nombreDeLaHoja?.llave;
          setHojaNombre(null);
          if (llave === undefined) return;
          setElegidos((previos) => ({ ...previos, [llave]: destino }));
        }}
        onCerrar={() => setHojaNombre(null)}
      />
    </div>
  );
}
