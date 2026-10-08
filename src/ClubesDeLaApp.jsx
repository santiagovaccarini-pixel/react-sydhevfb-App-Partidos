import React, { useCallback, useEffect, useState } from "react";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { FlechaVolver } from "./components/PortalTarjetas.jsx";
import {
  ZONAS_DE_CLUB,
  ZONA_POR_DEFECTO,
  agregarSubdueno,
  asignarEntidad,
  crearClub,
  derivarPedido,
  nombreDeZona,
  panelClubes,
  panelDuenos,
  panelHistorial,
  pedidosSinClub,
  quitarSubdueno,
  rechazarPedidoSinClub,
  traspasarPrincipal,
} from "./domain/plataformaDb.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, fechaYHora } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// Clubes de la app: el panel de los dueños de la plataforma. De cada club,
// solo el nombre, el correo de la entidad, el del administrador y cuánta
// gente tiene (lo garantiza la base: el panel no ve nada más). Desde acá se
// crean clubes y se asigna la entidad; no se entra a ningún club ni se
// acepta a nadie. Los pedidos a un club que no está (o que todavía no tiene
// administrador) se mandan a un club con administrador (ahí decide él) o se
// rechazan. Sumar, quitar y pasar dueños es solo del dueño principal.

// Un mensaje de error: una clave del diccionario o el texto de la base.
const mensajeDe = (error) => {
  const texto = error?.message || "";
  return /^[a-z]+(\.[a-zA-Z]+)+$/.test(texto) ? t(texto) : t("panel.error.generico");
};

const aCamello = (codigo) => String(codigo || "").replace(/_([a-z])/g, (_, letra) => letra.toUpperCase());

const Grupo = ({ titulo, cantidad, vacio, children }) => (
  <section className="cuentas-grupo">
    <h2>
      {titulo} {cantidad !== undefined && <span className="cuentas-cantidad">{cantidad}</span>}
    </h2>
    {cantidad === 0 ? <p className="cuentas-vacio">{vacio}</p> : children}
  </section>
);

export default function ClubesDeLaApp({ miUserId = "", esPrincipal = false, onVolver }) {
  const { plural } = useIdioma();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState("");

  const [clubes, setClubes] = useState([]);
  const [duenos, setDuenos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  // El club que se está creando.
  const [nombre, setNombre] = useState("");
  const [correoEntidad, setCorreoEntidad] = useState("");
  const [zona, setZona] = useState(ZONA_POR_DEFECTO);

  // Hojas: la entidad (escribir y, si cambia una que ya había, confirmar),
  // sacarla, mandar un pedido a un club, rechazarlo, quitar un dueño y pasar
  // el rol de principal (se confirma escribiendo el correo).
  const [entidad, setEntidad] = useState(null);
  const [cambioEntidad, setCambioEntidad] = useState(null);
  const [sacarEntidad, setSacarEntidad] = useState(null);
  const [aDerivar, setADerivar] = useState(null);
  const [aRechazar, setARechazar] = useState(null);
  const [correoSub, setCorreoSub] = useState("");
  const [aQuitar, setAQuitar] = useState(null);
  const [traspaso, setTraspaso] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [listaClubes, listaDuenos, listaPedidos, listaMovimientos] = await Promise.all([
        panelClubes(),
        panelDuenos(),
        pedidosSinClub(),
        panelHistorial(),
      ]);
      setClubes(listaClubes);
      setDuenos(listaDuenos);
      setPedidos(listaPedidos);
      setMovimientos(listaMovimientos);
    } catch (errorLectura) {
      setError(mensajeDe(errorLectura));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Hace algo contra la base, avisa cómo salió y vuelve a leer el panel.
  const hacer = async (clave, accion, avisoBien) => {
    setOcupado(clave);
    setAviso("");
    try {
      await accion();
      setAviso(avisoBien);
      await cargar();
      return true;
    } catch (errorAccion) {
      setAviso(mensajeDe(errorAccion));
      return false;
    } finally {
      setOcupado("");
    }
  };

  // Después de un traspaso, quien era principal pasa a sub: lo que dice la
  // base manda sobre lo que se sabía al entrar.
  const miFila = duenos.find((dueno) => dueno.es_mia || dueno.user_id === miUserId);
  const soyPrincipal = miFila ? miFila.principal : esPrincipal;
  const nombreDelClub = (equipoId) => clubes.find((club) => club.equipo_id === equipoId)?.nombre || "";

  // ------------------------------------------------------------ Acciones --

  const crear = async (evento) => {
    evento.preventDefault();
    const club = nombre.trim();
    const listo = await hacer("crear", () => crearClub({ nombre: club, correoEntidad, zona }), t("panel.creado", { club }));
    if (listo) {
      setNombre("");
      setCorreoEntidad("");
      setZona(ZONA_POR_DEFECTO);
    }
  };

  const abrirEntidad = (club) => setEntidad({ club, correo: club.correo_entidad || "" });

  // Asignar va directo; cambiar una que ya había pide confirmar con los dos correos.
  const guardarEntidad = async () => {
    const { club, correo } = entidad;
    const nuevo = correo.trim().toLowerCase();
    if (club.correo_entidad && nuevo && nuevo !== club.correo_entidad) {
      setEntidad(null);
      setCambioEntidad({ club, anterior: club.correo_entidad, nuevo });
      return;
    }
    setEntidad(null);
    if (!nuevo || nuevo === club.correo_entidad) return;
    await hacer(club.equipo_id, () => asignarEntidad(club.equipo_id, nuevo), t("panel.entidadGuardada", { club: club.nombre, correo: nuevo }));
  };

  const confirmarCambioEntidad = async () => {
    const { club, nuevo } = cambioEntidad;
    setCambioEntidad(null);
    await hacer(club.equipo_id, () => asignarEntidad(club.equipo_id, nuevo), t("panel.entidadGuardada", { club: club.nombre, correo: nuevo }));
  };

  const confirmarSacarEntidad = async () => {
    const club = sacarEntidad;
    setSacarEntidad(null);
    await hacer(club.equipo_id, () => asignarEntidad(club.equipo_id, null), t("panel.entidadSacada", { club: club.nombre }));
  };

  const derivarA = async (equipoId) => {
    const pedido = aDerivar;
    setADerivar(null);
    if (!pedido) return;
    await hacer(pedido.id, () => derivarPedido(pedido.id, equipoId), t("panel.derivado", { correo: pedido.email, club: nombreDelClub(equipoId) }));
  };

  const confirmarRechazo = async () => {
    const pedido = aRechazar;
    setARechazar(null);
    await hacer(pedido.id, () => rechazarPedidoSinClub(pedido.id), t("panel.rechazado"));
  };

  const sumarSub = async (evento) => {
    evento.preventDefault();
    const correo = correoSub.trim().toLowerCase();
    if (await hacer("sumar", () => agregarSubdueno(correo), t("panel.sumado", { correo }))) setCorreoSub("");
  };

  const confirmarQuitar = async () => {
    const dueno = aQuitar;
    setAQuitar(null);
    await hacer(dueno.user_id, () => quitarSubdueno(dueno.user_id), t("panel.quitado", { correo: dueno.email }));
  };

  const traspasoConfirmado = traspaso && traspaso.escrito.trim().toLowerCase() === traspaso.dueno.email.toLowerCase();
  const confirmarTraspaso = async () => {
    if (!traspasoConfirmado) return;
    const { dueno } = traspaso;
    setTraspaso(null);
    await hacer(dueno.user_id, () => traspasarPrincipal(dueno.user_id), t("panel.traspasado", { correo: dueno.email }));
  };

  // Una línea de Movimientos: qué pasó, sobre qué club y qué correo.
  const textoDeMovimiento = (movimiento) => {
    const que = t(`panel.movimientos.${aCamello(movimiento.accion)}`, {}, movimiento.accion);
    const club = nombreDelClub(movimiento.equipo_id) || movimiento.detalle?.nombre || "";
    return [que, club, movimiento.email].filter(Boolean).join(" · ");
  };

  // ------------------------------------------------------------ Pantalla --

  return (
    <main className="cuentas-pantalla panel-clubes">
      <div className="cuentas-contenido">
        <div className="cuentas-cabecera">
          <button type="button" className="portal-salir cuentas-volver" onClick={onVolver}>
            <FlechaVolver /> {t("acceso.volverPortal")}
          </button>
          <div className="cuentas-cabecera-derecha">
            <button type="button" className="portal-salir cuentas-actualizar" onClick={cargar} disabled={cargando}>
              {cargando ? t("comun.actualizando") : t("comun.actualizar")}
            </button>
            <SelectorIdioma />
          </div>
        </div>

        <header className="cuentas-titulo">
          <span className="portal-kicker">{t("panel.kicker")}</span>
          <h1>{t("panel.titulo")}</h1>
          <p>{t("panel.texto")}</p>
        </header>

        {error && (
          <div className="cuentas-aviso">
            {error}{" "}
            <button type="button" className="cuentas-reintentar" onClick={cargar}>
              {t("comun.reintentar")}
            </button>
          </div>
        )}
        {aviso && (
          <div className="cuentas-aviso" role="status">
            {aviso}
          </div>
        )}

        {!error && (
          <>
            <Grupo titulo={t("panel.crearTitulo")}>
              <form className="cuentas-invitar panel-crear" onSubmit={crear} noValidate>
                <input
                  type="text"
                  value={nombre}
                  maxLength={60}
                  placeholder={t("panel.nombre")}
                  aria-label={t("panel.nombre")}
                  onChange={(evento) => setNombre(evento.target.value)}
                />
                <input
                  type="email"
                  value={correoEntidad}
                  placeholder={t("panel.correoEntidad")}
                  aria-label={t("panel.correoEntidad")}
                  autoComplete="off"
                  onChange={(evento) => setCorreoEntidad(evento.target.value)}
                />
                <label className="panel-zona">
                  <span>{t("panel.zona")}</span>
                  <select value={zona} onChange={(evento) => setZona(evento.target.value)}>
                    {ZONAS_DE_CLUB.map((una) => (
                      <option key={una} value={una}>
                        {nombreDeZona(una)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="cuenta-autorizar" disabled={ocupado === "crear" || !nombre.trim()}>
                  {ocupado === "crear" ? t("panel.creando") : t("panel.crear")}
                </button>
                <p className="cuentas-ayuda">{t("panel.crearAyuda")}</p>
              </form>
            </Grupo>

            <Grupo titulo={t("panel.clubesTitulo")} cantidad={clubes.length} vacio={cargando ? t("comun.cargando") : t("panel.vacioClubes")}>
              <ul className="cuentas-lista">
                {clubes.map((club) => (
                  <li key={club.equipo_id} className="cuenta-fila panel-club">
                    <div className="cuenta-encabezado">
                      <span className="cuenta-correo">{club.nombre}</span>
                    </div>
                    <div className="panel-club-datos">
                      <span className="panel-club-entidad">{club.correo_entidad ? t("panel.entidad", { correo: club.correo_entidad }) : t("panel.sinEntidad")}</span>
                      <span className="panel-club-admin">{club.correo_admin ? t("panel.administrador", { correo: club.correo_admin }) : t("panel.sinAdministrador")}</span>
                      <span className="panel-club-personas">{plural("panel.personas", club.personas)}</span>
                    </div>
                    <div className="cuenta-acciones">
                      {club.correo_entidad ? (
                        <>
                          <button type="button" className="cuenta-autorizar" disabled={ocupado === club.equipo_id} onClick={() => abrirEntidad(club)}>
                            {t("panel.cambiar")}
                          </button>
                          <button type="button" className="cuenta-quitar" disabled={ocupado === club.equipo_id} onClick={() => setSacarEntidad(club)}>
                            {t("panel.sacar")}
                          </button>
                        </>
                      ) : (
                        <button type="button" className="cuenta-autorizar" disabled={ocupado === club.equipo_id} onClick={() => abrirEntidad(club)}>
                          {t("panel.asignar")}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Grupo>

            <Grupo titulo={t("panel.pedidosTitulo")} cantidad={pedidos.length} vacio={cargando ? t("comun.cargando") : t("panel.vacioPedidos")}>
              <p className="cuentas-ayuda panel-ayuda-arriba">{t("panel.pedidosTexto")}</p>
              <ul className="cuentas-lista">
                {pedidos.map((pedido) => (
                  <li key={pedido.id} className="cuenta-fila panel-pedido">
                    <div className="cuenta-encabezado">
                      <span className="cuenta-correo">{pedido.email}</span>
                    </div>
                    <div className="cuenta-meta">
                      <span>{t("panel.clubEscrito", { club: pedido.club_escrito })}</span>
                      {pedido.pais_escrito && <span>{t("panel.pais", { pais: pedido.pais_escrito })}</span>}
                      <span>{t("panel.pedidoDel", { fecha: fechaCorta(pedido.creado_en) })}</span>
                    </div>
                    <div className="cuenta-acciones">
                      <button type="button" className="cuenta-autorizar" disabled={ocupado === pedido.id || clubes.length === 0} onClick={() => setADerivar(pedido)}>
                        {t("panel.mandarAClub")}
                      </button>
                      <button type="button" className="cuenta-quitar" disabled={ocupado === pedido.id} onClick={() => setARechazar(pedido)}>
                        {t("panel.rechazar")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Grupo>

            <Grupo titulo={t("panel.duenosTitulo")}>
              <ul className="cuentas-lista">
                {duenos.map((dueno) => (
                  <li key={dueno.user_id} className={`cuenta-fila panel-dueno${dueno.es_mia ? " propia" : ""}`}>
                    <div className="cuenta-encabezado">
                      <span className="cuenta-correo">{dueno.email}</span>
                      {dueno.principal && <span className="cuenta-etiqueta">{t("panel.principal")}</span>}
                      {dueno.es_mia && <span className="cuenta-etiqueta">{t("panel.tuCuenta")}</span>}
                    </div>
                    {soyPrincipal && !dueno.principal && (
                      <div className="cuenta-acciones">
                        <button type="button" className="cuenta-autorizar" disabled={ocupado === dueno.user_id} onClick={() => setTraspaso({ dueno, escrito: "" })}>
                          {t("panel.traspasar")}
                        </button>
                        <button type="button" className="cuenta-quitar" disabled={ocupado === dueno.user_id} onClick={() => setAQuitar(dueno)}>
                          {t("panel.quitar")}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {soyPrincipal ? (
                <form className="cuentas-invitar panel-sumar" onSubmit={sumarSub} noValidate>
                  <b className="panel-sumar-titulo">{t("panel.sumarTitulo")}</b>
                  <input
                    type="email"
                    value={correoSub}
                    placeholder={t("panel.correo")}
                    aria-label={t("panel.sumarTitulo")}
                    autoComplete="off"
                    onChange={(evento) => setCorreoSub(evento.target.value)}
                  />
                  <button type="submit" className="cuenta-autorizar" disabled={ocupado === "sumar" || !correoSub.trim()}>
                    {ocupado === "sumar" ? t("panel.sumando") : t("panel.sumar")}
                  </button>
                  <p className="cuentas-ayuda">{t("panel.sumarTexto")}</p>
                </form>
              ) : (
                <p className="cuentas-ayuda panel-solo-principal">{t("panel.soloPrincipal")}</p>
              )}
            </Grupo>

            <Grupo
              titulo={t("panel.movimientosTitulo")}
              cantidad={movimientos.length}
              vacio={cargando ? t("comun.cargando") : t("panel.vacioMovimientos")}
            >
              <ul className="cuentas-lista panel-movimientos">
                {movimientos.map((movimiento) => (
                  <li key={movimiento.id} className="cuenta-fila">
                    <b>{textoDeMovimiento(movimiento)}</b>
                    <span className="cuenta-meta">
                      {fechaYHora(movimiento.cuando)} · {movimiento.quien_email ? t("panel.porQuien", { correo: movimiento.quien_email }) : t("panel.automatico")}
                    </span>
                  </li>
                ))}
              </ul>
            </Grupo>
          </>
        )}
      </div>

      {entidad && (
        <HojaInferior
          abierta
          className="cuentas-hoja"
          titulo={t("panel.entidadTitulo", { club: entidad.club.nombre })}
          descripcion={t("panel.entidadTexto")}
          onCerrar={() => setEntidad(null)}
          acciones={
            <>
              <button type="button" className="boton-cancelar-hoja" onClick={() => setEntidad(null)}>
                {t("comun.cancelar")}
              </button>
              <button type="button" className="boton-confirmar-hoja" onClick={guardarEntidad} disabled={!entidad.correo.trim()}>
                {t("panel.guardar")}
              </button>
            </>
          }
        >
          <div className="campo-inicio">
            <label htmlFor="panel-correo-entidad">{t("panel.entidadCorreo")}</label>
            <input
              id="panel-correo-entidad"
              type="email"
              value={entidad.correo}
              autoComplete="off"
              onChange={(evento) => setEntidad((actual) => ({ ...actual, correo: evento.target.value }))}
            />
          </div>
        </HojaInferior>
      )}

      <HojaConfirmar
        abierta={Boolean(cambioEntidad)}
        icono="usuario"
        titulo={t("panel.cambiarTitulo", { club: cambioEntidad?.club.nombre || "" })}
        descripcion={t("panel.cambiarTexto", { anterior: cambioEntidad?.anterior || "", nuevo: cambioEntidad?.nuevo || "" })}
        etiquetaConfirmar={t("panel.siCambiar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarCambioEntidad}
        onCancelar={() => setCambioEntidad(null)}
      />

      <HojaConfirmar
        abierta={Boolean(sacarEntidad)}
        icono="usuario"
        titulo={t("panel.sacarTitulo", { club: sacarEntidad?.nombre || "" })}
        descripcion={t("panel.sacarTexto", { correo: sacarEntidad?.correo_entidad || "" })}
        etiquetaConfirmar={t("panel.siSacar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarSacarEntidad}
        onCancelar={() => setSacarEntidad(null)}
      />

      {/* Un club sin administrador se ve, pero no se elige: no habría quién decida. */}
      <HojaOpciones
        abierta={Boolean(aDerivar)}
        titulo={t("panel.elegirClub")}
        opciones={clubes.map((club) => ({
          valor: club.equipo_id,
          etiqueta: club.nombre,
          ...(club.correo_admin ? {} : { detalle: t("panel.sinAdministrador"), deshabilitada: true }),
        }))}
        onElegir={derivarA}
        onCerrar={() => setADerivar(null)}
      />

      <HojaConfirmar
        abierta={Boolean(aRechazar)}
        icono="usuario"
        titulo={t("panel.rechazarTitulo")}
        descripcion={t("panel.rechazarTexto", { correo: aRechazar?.email || "" })}
        etiquetaConfirmar={t("panel.siRechazar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarRechazo}
        onCancelar={() => setARechazar(null)}
      />

      <HojaConfirmar
        abierta={Boolean(aQuitar)}
        icono="usuario"
        titulo={t("panel.quitarTitulo", { correo: aQuitar?.email || "" })}
        descripcion={t("panel.quitarTexto")}
        etiquetaConfirmar={t("panel.siQuitar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarQuitar}
        onCancelar={() => setAQuitar(null)}
      />

      {traspaso && (
        <HojaInferior
          abierta
          className="cuentas-hoja"
          titulo={t("panel.traspasarTitulo", { correo: traspaso.dueno.email })}
          descripcion={t("panel.traspasarTexto")}
          onCerrar={() => setTraspaso(null)}
          acciones={
            <>
              <button type="button" className="boton-cancelar-hoja" onClick={() => setTraspaso(null)}>
                {t("comun.cancelar")}
              </button>
              <button type="button" className="boton-confirmar-hoja" onClick={confirmarTraspaso} disabled={!traspasoConfirmado}>
                {t("panel.siTraspasar")}
              </button>
            </>
          }
        >
          <div className="campo-inicio">
            <label htmlFor="panel-traspaso">{t("panel.traspasarConfirmar", { correo: traspaso.dueno.email })}</label>
            <input
              id="panel-traspaso"
              type="email"
              value={traspaso.escrito}
              autoComplete="off"
              onChange={(evento) => setTraspaso((actual) => ({ ...actual, escrito: evento.target.value }))}
            />
          </div>
        </HojaInferior>
      )}
    </main>
  );
}
