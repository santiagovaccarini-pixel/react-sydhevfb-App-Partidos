import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Icono, MarcoAplicacion } from "./components/AppChrome";
import { EscudoDeClub } from "./components/ClubCrest";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { TablaDatos } from "./components/TablaDatos.jsx";
import { AvisoSoloLectura } from "./components/SoloLectura.jsx";
import ImportarJugadores from "./ImportarJugadores.jsx";
import { cargarEquipos, elegirEquipoInicial, guardarEquipoElegido, leerEquipoElegido } from "./domain/equipo.js";
import { diasEntre } from "./domain/lesiones.js";
import { campoPorClave, etiquetaDeCampo, etiquetaDeOpcion, opcionesDeCampo } from "./domain/lesionesCampos.js";
import { agregarJugadorBasico, cargarPlantelLesiones, guardarDatosJugador, leerConfig, quitarJugadorBasico } from "./domain/lesionesDb.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import "./lesiones.css";

// Datos básicos: los jugadores del club con lo que cada módulo necesita (la
// hoja "Datos Básicos" del Excel), en la tabla estilo Excel que se copia y se
// pega. Es la misma lista de jugadores de Partido y Flujo diario. La hoja
// entera del Excel se trae con "Pegar desde Excel" (ImportarJugadores.jsx).

export const DESTINOS_DATOS = [{ id: "jugadores", etiqueta: "Jugadores", icono: "usuario" }];

// Las columnas: el nombre, los datos del Excel y la edad de hoy.
const COLUMNAS = [
  { clave: "nombre", tipo: "texto", editable: true, rotulo: "jugador" },
  { clave: "categoria", tipo: "lista", editable: true },
  { clave: "fecha_nacimiento", tipo: "fecha", editable: true },
  { clave: "edad", tipo: "calculado", editable: false },
  { clave: "pie_dominante", tipo: "lista", editable: true },
  { clave: "posicion", tipo: "lista", editable: true },
  { clave: "foto_url", tipo: "texto", editable: true, rotulo: "foto" },
];

const edadHoy = (nacimiento) => {
  const dias = diasEntre(nacimiento, hoyISO());
  return dias === null ? null : Math.floor(dias / 365.25);
};

export default function DatosBasicos({ onVolver }) {
  const { idioma, plural } = useIdioma();
  const [equipo, setEquipo] = useState(() => leerEquipoElegido());
  const [plantel, setPlantel] = useState([]);
  const [config, setConfig] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);
  const [importando, setImportando] = useState(false);

  const equipoId = equipo?.id || null;
  // Quien ya se fue del club ve a los jugadores de entonces y no cambia nada.
  const soloLectura = Boolean(equipo?.hasta);

  useEffect(() => {
    if (equipoId) return undefined;
    let vigente = true;
    cargarEquipos().then(({ equipos, error: falla }) => {
      const elegido = elegirEquipoInicial(equipos, null, { huboError: Boolean(falla) });
      if (vigente && elegido) {
        guardarEquipoElegido(elegido);
        setEquipo(elegido);
      }
    });
    return () => {
      vigente = false;
    };
  }, [equipoId]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    const [respuestaPlantel, respuestaConfig] = await Promise.all([cargarPlantelLesiones(equipoId), leerConfig(equipoId)]);
    setPlantel(respuestaPlantel.plantel || []);
    // Sin las tablas de Lesiones todavía, valen los textos del Excel.
    setConfig(respuestaConfig.error ? null : respuestaConfig.config);
    if (respuestaPlantel.error) setError(respuestaPlantel.error);
    setCargando(false);
  }, [equipoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!aviso) return undefined;
    const temporizador = setTimeout(() => setAviso(""), 2600);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  const etiqueta = (clave) => etiquetaDeCampo(clave, config, idioma);
  const textoDeOpcion = (clave, codigo) => etiquetaDeOpcion(clave, codigo, config, idioma);

  const columnas = useMemo(
    () =>
      COLUMNAS.map((columna) => ({
        clave: columna.clave,
        titulo: columna.rotulo === "foto" ? t("datos.foto") : etiquetaDeCampo(columna.rotulo || columna.clave, config, idioma),
        tipo: columna.tipo,
        editable: columna.editable && !soloLectura,
        ancho: columna.clave === "nombre" ? 180 : undefined,
        opciones:
          columna.tipo === "lista"
            ? opcionesDeCampo(columna.clave, config, idioma).map((opcion) => ({
                ...opcion,
                alias: [etiquetaDeOpcion(columna.clave, opcion.valor, config, idioma === "pt-BR" ? "es-AR" : "pt-BR")],
              }))
            : undefined,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, idioma, soloLectura],
  );

  const filas = useMemo(
    () =>
      plantel.map((jugador) => {
        const edad = edadHoy(jugador.fecha_nacimiento);
        return {
          id: jugador.id,
          valores: {
            nombre: jugador.nombre,
            categoria: jugador.categoria || "",
            fecha_nacimiento: jugador.fecha_nacimiento || "",
            edad,
            pie_dominante: jugador.pie_dominante || "",
            posicion: jugador.posicion || "",
            foto_url: jugador.foto_url || "",
          },
          textos: {
            nombre: jugador.nombre,
            categoria: textoDeOpcion("categoria", jugador.categoria),
            fecha_nacimiento: fechaCorta(jugador.fecha_nacimiento),
            edad: edad === null ? "" : plural("lesiones.anios", edad),
            pie_dominante: textoDeOpcion("pie_dominante", jugador.pie_dominante),
            posicion: textoDeOpcion("posicion", jugador.posicion),
            foto_url: jugador.foto_url || "",
          },
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plantel, config, idioma],
  );

  const reemplazar = (jugador) => setPlantel((actual) => actual.map((uno) => (uno.id === jugador.id ? jugador : uno)));

  const editarCelda = async (jugadorId, clave, valor) => {
    const respuesta = await guardarDatosJugador(jugadorId, { [clave]: valor });
    if (respuesta.error) return { error: respuesta.error };
    reemplazar(respuesta.jugador);
    return {};
  };

  const pegar = async (cambios) => {
    const porJugador = new Map();
    cambios.forEach((cambio) => {
      if (!porJugador.has(cambio.filaId)) porJugador.set(cambio.filaId, {});
      porJugador.get(cambio.filaId)[cambio.clave] = cambio.valor;
    });
    let hechos = 0;
    let ultimoError = "";
    for (const [jugadorId, datos] of porJugador) {
      const respuesta = await guardarDatosJugador(jugadorId, datos); // eslint-disable-line no-await-in-loop
      if (respuesta.error) {
        ultimoError = respuesta.error;
        continue;
      }
      reemplazar(respuesta.jugador);
      hechos += Object.keys(datos).length;
    }
    return { hechos, error: ultimoError };
  };

  const agregar = async (evento) => {
    evento.preventDefault();
    if (!nombreNuevo.trim()) {
      setAviso(t("datos.error.nombre"));
      return;
    }
    setAgregando(true);
    const respuesta = await agregarJugadorBasico(equipoId, nombreNuevo);
    setAgregando(false);
    if (respuesta.error) {
      setAviso(respuesta.error);
      return;
    }
    setPlantel((actual) => [...actual, respuesta.jugador].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
    setNombreNuevo("");
    setAviso(t("datos.agregado"));
  };

  const confirmarBorrar = async () => {
    const jugador = aBorrar;
    setABorrar(null);
    if (!jugador) return;
    const respuesta = await quitarJugadorBasico(jugador.id);
    if (respuesta.error) {
      setAviso(respuesta.error);
      return;
    }
    setPlantel((actual) => actual.filter((uno) => uno.id !== jugador.id));
    setAviso(t("datos.borrado"));
  };

  const estado = error ? (
    <div className="lesiones-estado error">
      {t(error)}{" "}
      <button type="button" onClick={cargar}>
        {t("comun.reintentar")}
      </button>
    </div>
  ) : cargando ? (
    <p className="lesiones-estado">{t("comun.cargando")}</p>
  ) : null;

  const pantallaImportar = (
    <ImportarJugadores
      equipoId={equipoId}
      plantel={plantel}
      config={config}
      onVolver={() => setImportando(false)}
      onRecargar={cargar}
      onListo={({ nuevos, actualizados }) => {
        setImportando(false);
        setAviso(t("datos.importar.listo", { nuevos: plural("datos.importar.nuevos", nuevos), actualizados: plural("datos.importar.actualizados", actualizados) }));
      }}
    />
  );

  return (
    <MarcoAplicacion
      activo="jugadores"
      onNavigate={() => setImportando(false)}
      destinos={DESTINOS_DATOS}
      marca={t("datos.titulo")}
      className="entrenamiento-marco lesiones-marco datos-marco"
    >
      {importando && !soloLectura ? pantallaImportar : (
      <div className="app app-inicio">
        <div className="contenedor contenedor-inicio-formacion contenedor-base">
          <header className="hero-partido hero-lesiones">
            <div className="hero-lesiones-barra">
              {onVolver ? (
                <button type="button" className="boton-modulos" onClick={onVolver}>
                  <Icono nombre="flecha" size={14} />
                  {t("portal.modulos")}
                </button>
              ) : (
                <span />
              )}
              <SelectorIdioma />
            </div>
            <div className="hero-lesiones-club">
              <EscudoDeClub equipo="cam" nombre={equipo?.nombre || ""} />
              <span className="etiqueta-hero">{t("datos.titulo").toUpperCase()}</span>
              <strong className="nombre-sesion">{equipo?.nombre || t("datos.titulo")}</strong>
              <p className="fecha-hero">{t("datos.texto")}</p>
              <span className="estado-hero">{plural("datos.jugadores", plantel.length)}</span>
            </div>
          </header>

          <AvisoSoloLectura hasta={equipo?.hasta} />
          {estado}

          {!soloLectura && (
          <section className="tarjeta tarjeta-inicio">
            <form className="agregar-jugador datos-agregar" onSubmit={agregar}>
              <input
                type="text"
                value={nombreNuevo}
                placeholder={t("datos.nombre")}
                aria-label={t("datos.nombre")}
                maxLength={80}
                autoComplete="off"
                onChange={(evento) => setNombreNuevo(evento.target.value)}
              />
              <button type="submit" className="boton-principal" disabled={agregando || !nombreNuevo.trim()}>
                {agregando ? t("comun.guardando") : t("datos.agregar")}
              </button>
            </form>
            <button type="button" className="boton-secundario datos-pegar-excel" onClick={() => setImportando(true)} disabled={cargando || Boolean(error)}>
              <Icono nombre="documento" size={16} />
              {t("datos.importar.boton")}
            </button>
          </section>
          )}

          <section className="tarjeta">
            <TablaDatos
              id="jugadores"
              columnas={columnas}
              filas={filas}
              onEditar={editarCelda}
              onPegar={pegar}
              onBorrarFila={
                soloLectura
                  ? undefined
                  : (id) => {
                      const jugador = plantel.find((uno) => uno.id === id);
                      if (jugador) setABorrar(jugador);
                    }
              }
            />
          </section>
        </div>
      </div>
      )}

      {aviso && (
        <div className="lesiones-toast" role="status">
          {aviso}
        </div>
      )}

      <HojaConfirmar
        abierta={Boolean(aBorrar)}
        titulo={t("datos.borrarTitulo")}
        descripcion={t("datos.borrarTexto", { jugador: aBorrar?.nombre || "" })}
        icono="borrar"
        etiquetaConfirmar={t("datos.siBorrar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBorrar}
        onCancelar={() => setABorrar(null)}
      />
    </MarcoAplicacion>
  );
}
