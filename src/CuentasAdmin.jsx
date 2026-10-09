import React, { useCallback, useEffect, useRef, useState } from "react";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { FlechaVolver } from "./components/PortalTarjetas.jsx";
import { cargarEquipos } from "./domain/equipo.js";
import {
  MODULOS_DEL_CLUB,
  cambiarModulo,
  cancelarInvitacion,
  correoValido,
  darDeBaja,
  enviarInvitacionPorMail,
  historialDeMiembro,
  invitacionVencida,
  invitar,
  listarInvitaciones,
  listarMiembros,
  reincorporar,
} from "./domain/membresiasDb.js";
import { aceptarPedido, pedidosDelClub, rechazarPedido } from "./domain/pedidosDb.js";
import { idiomaActual, t, useIdioma } from "./idioma/index.js";
import { fechaCorta, fechaYHora, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// Cuentas: la gente del club, para su administrador. Arriba, los pedidos de
// acceso (aceptar eligiendo módulos, o rechazar); después invitar por correo
// (siempre como staff), módulos, dar de baja con el último día, reincorporar
// y la historia de cada uno. Quien se va sigue viendo lo cargado hasta su
// último día, sin cambiar nada (eso lo cuida la base). El admin no toca a
// otro admin ni su propia fila, y a los dueños de la app (principal o sub) la
// base no deja sacarlos ni cambiarlos: solo ellos se van. Salir del club, para
// cualquiera, está en Cambiar club (ElegirClub.jsx).
// Todo va directo a la base con la sesión de quien entra; la base decide.

// Lo que se marca por defecto al invitar y al aceptar un pedido. El rol es
// siempre staff: la app no nombra administradores.
export const INVITACION_INICIAL = Object.freeze({ rol: "staff", partido: true, flujo: true, lesiones: false, evaluaciones: false });
const MODULOS_INICIALES = Object.freeze(Object.fromEntries(MODULOS_DEL_CLUB.map((clave) => [clave, INVITACION_INICIAL[clave]])));

// Un mensaje de error: una clave del diccionario o el texto de la base.
const mensajeDe = (error, porDefecto) => {
  const texto = error?.message || "";
  return /^[a-z]+(\.[a-zA-Z]+)+$/.test(texto) ? t(texto) : texto || t(porDefecto);
};

const nombresDeModulos = (fila) => {
  const lista = MODULOS_DEL_CLUB.filter((clave) => fila?.[clave]).map((clave) => t(`cuentas.modulos.${clave}`));
  return lista.length ? lista.join(", ") : t("cuentas.ningunModulo");
};

// Una línea de la historia de una membresía, en criollo.
export const textoDeMovimiento = (movimiento) => {
  const d = movimiento.detalle || {};
  switch (movimiento.accion) {
    case "alta":
      return t("cuentas.movimientos.alta", { rol: t(`cuentas.roles.${d.rol || "staff"}`), modulos: nombresDeModulos(d) });
    case "baja":
      return t("cuentas.movimientos.baja", { fecha: fechaCorta(d.hasta) });
    case "reincorporacion":
      return t("cuentas.movimientos.reincorporacion");
    case "rol":
      return t("cuentas.movimientos.rol", { rol: t(`cuentas.roles.${d.rol || "staff"}`) });
    case "modulos":
      return t("cuentas.movimientos.modulos", { modulos: nombresDeModulos(d) });
    // Lo anota la base cuando un dueño de la app le cambia el nombre al club
    // (sin decir cuál de ellos).
    case "club_renombrado":
      return t("cuentas.movimientos.clubRenombrado", { nombre: d.nombre || "" });
    default:
      return t("cuentas.movimientos.borrado");
  }
};

// ------------------------------------------------- La gente del club --

// Las filas de otro admin, de un dueño de la app y la propia no tienen
// acciones (la base tampoco las deja cambiar): sus módulos se leen, no se
// tocan. La historia se mira en todas.
const FilaMiembro = ({ miembro, esMio, ocupada, onModulo, onBaja, onReincorporar, onHistoria }) => {
  const activo = !miembro.hasta;
  const editable = !esMio && miembro.rol !== "admin" && !miembro.protegido;
  return (
    <li className={`cuenta-fila${esMio ? " propia" : ""}${activo ? "" : " se-fue"}`}>
      <div className="cuenta-encabezado">
        <span className="cuenta-correo">{miembro.email || t("cuentas.sinCorreo")}</span>
        {esMio && <span className="cuenta-etiqueta">{t("cuentas.tuCuenta")}</span>}
        {activo && miembro.rol === "admin" && <span className="cuenta-etiqueta">{t("cuentas.roles.admin")}</span>}
        {miembro.protegido && <span className="cuenta-etiqueta">{t("cuentas.dueno")}</span>}
        {miembro.estado === "bloqueado" && <span className="cuenta-etiqueta alerta">{t("cuentas.cuentaBloqueada")}</span>}
        {miembro.estado === "pendiente" && <span className="cuenta-etiqueta alerta">{t("cuentas.cuentaPendiente")}</span>}
      </div>
      {/* Los datos en un renglón, separados con « · » como en el resto de la app. */}
      <div className="cuenta-meta">
        {activo ? (
          (miembro.desde || !editable) && (
            <span>
              {[miembro.desde && t("cuentas.desdeEl", { fecha: fechaCorta(miembro.desde) }), !editable && nombresDeModulos(miembro)]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )
        ) : (
          <span>
            <span className="cuenta-meta-hasta">{t("cuentas.hastaEl", { fecha: fechaCorta(miembro.hasta) })}</span>
            {!editable && ` · ${nombresDeModulos(miembro)}`}
          </span>
        )}
      </div>
      {editable && (
        <div className="cuenta-permisos" role="group" aria-label={t("cuentas.quePuedeUsar", { correo: miembro.email })}>
          {MODULOS_DEL_CLUB.map((clave) => (
            <button
              key={clave}
              type="button"
              className="cuenta-chip"
              aria-pressed={Boolean(miembro[clave])}
              disabled={ocupada}
              onClick={() => onModulo(miembro, clave)}
            >
              {t(`cuentas.modulos.${clave}`)}
            </button>
          ))}
        </div>
      )}
      <div className="cuenta-acciones">
        {editable &&
          (activo ? (
            <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onBaja(miembro)}>
              {t("cuentas.darBaja")}
            </button>
          ) : (
            <button type="button" className="cuenta-autorizar" disabled={ocupada} onClick={() => onReincorporar(miembro)}>
              {ocupada ? t("comun.guardando") : t("cuentas.reincorporar")}
            </button>
          ))}
        <button type="button" className="cuenta-quitar" onClick={() => onHistoria(miembro)}>
          {t("cuentas.verHistoria")}
        </button>
      </div>
    </li>
  );
};

// Una invitación vencida ya no sirve para entrar: va aparte, sin el mensaje
// para copiar ni el mail (para volver a invitar ese correo, se lo invita de nuevo).
// Mientras se manda el mail o se cancela, los dos botones quedan ocupados;
// "Enviando…" solo mientras sale el mail.
const FilaInvitacion = ({ invitacion, vencida = false, ocupada, enviando = false, onCopiar, onReenviar, onCancelar }) => (
  <li className="cuenta-fila invitacion">
    <div className="cuenta-encabezado">
      <span className="cuenta-correo">{invitacion.email}</span>
      {invitacion.rol === "admin" && <span className="cuenta-etiqueta">{t("cuentas.roles.admin")}</span>}
      {vencida && <span className="cuenta-etiqueta alerta">{t("cuentas.vencida")}</span>}
    </div>
    <div className="cuenta-meta">
      <span>{`${nombresDeModulos(invitacion)} · ${t(vencida ? "cuentas.vencioEl" : "cuentas.venceEl", { fecha: fechaCorta(invitacion.vence_en) })}`}</span>
    </div>
    <div className="cuenta-acciones">
      {!vencida && (
        <>
          <button type="button" className="cuenta-autorizar" onClick={() => onCopiar(invitacion)}>
            {t("cuentas.copiarMensaje")}
          </button>
          <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onReenviar(invitacion)}>
            {enviando ? t("cuentas.enviandoMail") : t("cuentas.reenviarMail")}
          </button>
        </>
      )}
      <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onCancelar(invitacion)}>
        {t("cuentas.cancelarInvitacion")}
      </button>
    </div>
  </li>
);

// Un pedido de acceso al club: el correo y cuándo lo pidió.
const FilaPedido = ({ pedido, ocupada, onAceptar, onRechazar }) => (
  <li className="cuenta-fila pedido">
    <div className="cuenta-encabezado">
      <span className="cuenta-correo">{pedido.email || t("cuentas.sinCorreo")}</span>
    </div>
    <div className="cuenta-meta">
      <span>{t("pedidos.pidioEl", { fecha: fechaCorta(pedido.creado_en) })}</span>
    </div>
    <div className="cuenta-acciones">
      <button type="button" className="cuenta-autorizar" disabled={ocupada} onClick={() => onAceptar(pedido)}>
        {ocupada ? t("comun.guardando") : t("pedidos.aceptar")}
      </button>
      <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onRechazar(pedido)}>
        {t("pedidos.rechazar")}
      </button>
    </div>
  </li>
);

const Grupo = ({ titulo, cantidad, vacio, children }) => (
  <section className="cuentas-grupo">
    <h2>
      {titulo} <span className="cuentas-cantidad">{cantidad}</span>
    </h2>
    {cantidad === 0 ? <p className="cuentas-vacio">{vacio}</p> : <ul className="cuentas-lista">{children}</ul>}
  </section>
);

export default function CuentasAdmin({ miUserId, club = null, onVolver }) {
  useIdioma();
  // El aviso de arriba: rojo si algo no salió; con `ok`, algo que salió bien.
  const [aviso, ponerAviso] = useState({ texto: "", ok: false });
  const setAviso = (texto, ok = false) => ponerAviso({ texto, ok });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [ocupada, setOcupada] = useState("");

  // Los clubes que administra quien entró y el elegido.
  const [clubes, setClubes] = useState([]);
  const [clubId, setClubId] = useState(club?.id || null);
  // El club elegido para "Actualizar" (que no vuelva al primero) y para
  // saber si lo que vuelve de la base es del club que se está viendo. Se pone
  // junto con el estado: una respuesta rápida puede llegar antes de que la
  // pantalla se vuelva a dibujar.
  const clubIdRef = useRef(clubId);
  clubIdRef.current = clubId;
  const ponerClub = (id) => {
    clubIdRef.current = id;
    setClubId(id);
  };
  const [eligiendoClub, setEligiendoClub] = useState(false);
  const [errorClub, setErrorClub] = useState("");
  const [miembros, setMiembros] = useState([]);
  const [invitaciones, setInvitaciones] = useState([]);
  // Los pedidos de acceso al club (null: la base todavía no los tiene).
  const [pedidos, setPedidos] = useState(null);
  // Se está leyendo el club recién elegido.
  const [leyendoClub, setLeyendoClub] = useState(false);

  // La invitación que se está armando.
  const [correo, setCorreo] = useState("");
  const [nueva, setNueva] = useState({ ...INVITACION_INICIAL });

  // Hojas: dar de baja, historia, aceptar y rechazar un pedido.
  const [aDarBaja, setADarBaja] = useState(null);
  const [fechaBaja, setFechaBaja] = useState(hoyISO());
  const [historia, setHistoria] = useState(null);
  const [aAceptar, setAAceptar] = useState(null);
  const [aRechazar, setARechazar] = useState(null);

  const clubElegido = clubes.find((uno) => uno.id === clubId) || null;

  const cargarClub = useCallback(async (id) => {
    if (!id) {
      setMiembros([]);
      setInvitaciones([]);
      setPedidos(null);
      return;
    }
    // Si la base no tiene pedidos (o no contesta), Cuentas sigue sin esa parte.
    const [lista, abiertas, delClub] = await Promise.all([
      listarMiembros(id),
      listarInvitaciones(id),
      pedidosDelClub(id).catch(() => null),
    ]);
    // Si mientras tanto se eligió otro club, esto ya no es lo que se ve.
    if (clubIdRef.current !== id) return;
    setMiembros(lista);
    setInvitaciones(abiertas);
    setPedidos(delClub);
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    setErrorClub("");
    try {
      const { equipos } = await cargarEquipos();
      // Solo los clubes donde es administrador hoy.
      const propios = (equipos || []).filter((uno) => uno.rol === "admin" && !uno.hasta);
      setClubes(propios);
      const elegido = propios.find((uno) => uno.id === clubIdRef.current) || propios[0] || null;
      ponerClub(elegido?.id || null);
      try {
        await cargarClub(elegido?.id || null);
      } catch (errorLectura) {
        if (clubIdRef.current === (elegido?.id || null)) setErrorClub(mensajeDe(errorLectura, "cuentas.errorClubes"));
      }
    } catch (errorLectura) {
      setError(mensajeDe(errorLectura, "cuentas.errorLeer"));
    } finally {
      setCargando(false);
    }
  }, [cargarClub]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const elegirClub = async (id) => {
    setEligiendoClub(false);
    ponerClub(id);
    setAviso("");
    setErrorClub("");
    // Lo del club anterior no queda a la vista (ni para tocarlo) mientras se
    // lee el nuevo.
    setMiembros([]);
    setInvitaciones([]);
    setPedidos(null);
    setHistoria(null);
    setLeyendoClub(true);
    try {
      await cargarClub(id);
    } catch (errorLectura) {
      if (clubIdRef.current === id) setErrorClub(mensajeDe(errorLectura, "cuentas.errorClubes"));
    } finally {
      if (clubIdRef.current === id) setLeyendoClub(false);
    }
  };

  // Hace un cambio sobre un miembro y lo reemplaza en la lista.
  const aplicar = async (miembro, accion, avisoBien = "") => {
    // El club del cambio: si mientras tanto se eligió otro, la fila que vuelve
    // no es de la lista que se está viendo.
    const delClub = clubIdRef.current;
    setOcupada(miembro.user_id);
    setAviso("");
    try {
      const fila = await accion();
      if (clubIdRef.current === delClub) setMiembros((lista) => lista.map((uno) => (uno.user_id === fila.user_id ? { ...uno, ...fila } : uno)));
      if (avisoBien) setAviso(avisoBien, true);
    } catch (errorCambio) {
      setAviso(mensajeDe(errorCambio, "cuentas.errorClub"));
    } finally {
      setOcupada("");
    }
  };

  const alternarModulo = (miembro, clave) => aplicar(miembro, () => cambiarModulo(miembro.user_id, clubId, clave, !miembro[clave]));
  const volverAlClub = (miembro) =>
    aplicar(miembro, () => reincorporar(miembro.user_id, clubId), t("cuentas.reincorporado", { correo: miembro.email }));

  const confirmarBaja = async () => {
    const miembro = aDarBaja;
    setADarBaja(null);
    if (!miembro || !fechaBaja) return;
    await aplicar(miembro, () => darDeBaja(miembro.user_id, clubId, fechaBaja), t("cuentas.dadoDeBaja", { correo: miembro.email }));
  };

  const abrirHistoria = async (miembro) => {
    setHistoria({ miembro, movimientos: null, error: "" });
    // Lo que vuelve va en la hoja si sigue abierta con esa persona (y en el
    // mismo club: al elegir otro, la hoja se cierra).
    const enLaHoja = (contenido) => setHistoria((actual) => (actual?.miembro === miembro ? { miembro, ...contenido } : actual));
    try {
      const movimientos = await historialDeMiembro(clubId, miembro.user_id);
      enLaHoja({ movimientos, error: "" });
    } catch (errorLectura) {
      enLaHoja({ movimientos: [], error: mensajeDe(errorLectura, "cuentas.errorHistorial") });
    }
  };

  const enviarInvitacion = async (evento) => {
    evento.preventDefault();
    setAviso("");
    const limpio = correo.trim().toLowerCase();
    if (!correoValido(limpio)) {
      setAviso(t("cuentas.errorCorreo"));
      return;
    }
    if (miembros.some((uno) => uno.email === limpio && !uno.hasta)) {
      setAviso(t("cuentas.yaEsta"));
      return;
    }
    setOcupada("invitar");
    try {
      const { usada, id } = await invitar(clubId, { email: limpio, ...nueva });
      setCorreo("");
      setNueva({ ...INVITACION_INICIAL });
      // Si la cuenta ya existía, entró en el acto; si no, le llega el mail. La
      // invitación de un dueño de la app queda abierta, y su aviso es el de un
      // mail que no salió (el servidor no dice que la cuenta existe).
      if (usada) setAviso(t("cuentas.entroYa", { correo: limpio }), true);
      else await mandarMail({ id, email: limpio });
      await cargarClub(clubId);
    } catch (errorInvitar) {
      setAviso(mensajeDe(errorInvitar, "cuentas.errorInvitar"));
    } finally {
      setOcupada("");
    }
  };

  // El mail de la invitación (lo manda el servidor, a ese correo). Si no
  // sale, la invitación queda guardada igual y el aviso dice que se mande el
  // mensaje con "Copiar mensaje". Devuelve qué pasó.
  const mandarMail = async (invitacion) => {
    const clave = invitacion.id ? await enviarInvitacionPorMail(invitacion.id, idiomaActual()) : "cuentas.mail.noSalio";
    setAviso(t(clave, { correo: invitacion.email }), clave === "cuentas.mail.enviado");
    return clave;
  };

  const reenviarMail = async (invitacion) => {
    const delClub = clubIdRef.current;
    setOcupada(`mail:${invitacion.id}`);
    setAviso("");
    try {
      const clave = await mandarMail(invitacion);
      // Si ya no estaba abierta (se usó, se canceló o venció), la lista se
      // pone al día.
      if (["cuentas.mail.cerrada", "cuentas.mail.vencida"].includes(clave)) {
        await cargarClub(delClub).catch(() => {});
      }
    } finally {
      setOcupada("");
    }
  };

  const copiarMensaje = async (invitacion) => {
    const texto = t("cuentas.mensajeInvitacion", {
      club: clubElegido?.nombre || "",
      correo: invitacion.email,
      enlace: typeof window === "undefined" ? "" : window.location.origin,
    });
    try {
      await navigator.clipboard.writeText(texto);
      setAviso(t("cuentas.copiado"), true);
    } catch {
      // Sin acceso al portapapeles, el mensaje queda a la vista para copiarlo a mano.
      setAviso(texto);
    }
  };

  const cancelar = async (invitacion) => {
    setOcupada(invitacion.id);
    setAviso("");
    try {
      await cancelarInvitacion(invitacion.id);
      setInvitaciones((lista) => lista.filter((una) => una.id !== invitacion.id));
      setAviso(t("cuentas.invitacionCancelada"), true);
    } catch (errorCancelar) {
      setAviso(mensajeDe(errorCancelar, "cuentas.errorInvitar"));
    } finally {
      setOcupada("");
    }
  };

  // ------------------------------------------------- Pedidos de acceso --

  // Aceptar entra al club como staff con los módulos elegidos en la hoja.
  const confirmarAceptar = async () => {
    const { pedido, modulos } = aAceptar;
    setAAceptar(null);
    const delClub = clubIdRef.current;
    setOcupada(pedido.id);
    setAviso("");
    try {
      await aceptarPedido(pedido.id, modulos);
      setAviso(t("pedidos.aceptado", { correo: pedido.email }), true);
      if (clubIdRef.current === delClub) await cargarClub(delClub);
    } catch (errorAceptar) {
      setAviso(mensajeDe(errorAceptar, "pedidos.error.generico"));
    } finally {
      setOcupada("");
    }
  };

  // Rechazado: sale de la lista y la persona puede volver a pedir.
  const confirmarRechazo = async () => {
    const pedido = aRechazar;
    setARechazar(null);
    setOcupada(pedido.id);
    setAviso("");
    try {
      await rechazarPedido(pedido.id);
      setPedidos((lista) => (lista || []).filter((uno) => uno.id !== pedido.id));
      setAviso(t("pedidos.rechazadoAviso"), true);
    } catch (errorRechazar) {
      setAviso(mensajeDe(errorRechazar, "pedidos.error.generico"));
    } finally {
      setOcupada("");
    }
  };

  const activos = miembros.filter((uno) => !uno.hasta);
  const seFueron = miembros.filter((uno) => uno.hasta);
  const vencidas = invitaciones.filter((una) => invitacionVencida(una));
  const abiertas = invitaciones.filter((una) => !invitacionVencida(una));

  const accionesMiembro = {
    onModulo: alternarModulo,
    onBaja: (miembro) => {
      setFechaBaja(hoyISO());
      setADarBaja(miembro);
    },
    onReincorporar: volverAlClub,
    onHistoria: abrirHistoria,
  };

  const parteClub = (
    <>
      {clubes.length === 0 ? (
        <p className="cuentas-vacio">{cargando ? t("comun.cargando") : t("cuentas.sinClubes")}</p>
      ) : (
        <>
          <div className="cuentas-club-elegido">
            <div>
              <span className="cuentas-club-rotulo">{t("cuentas.club")}</span>
              <strong>{clubElegido?.nombre}</strong>
            </div>
            {clubes.length > 1 && (
              <button type="button" className="portal-salir" onClick={() => setEligiendoClub(true)}>
                {t("comun.cambiar")}
              </button>
            )}
          </div>
          <p className="cuentas-ayuda">{t("cuentas.clubTexto")}</p>

          {errorClub ? (
            <div className="cuentas-aviso">
              {errorClub}{" "}
              <button type="button" className="cuentas-reintentar" onClick={cargar}>
                {t("comun.reintentar")}
              </button>
            </div>
          ) : (
          <>
          {pedidos && (
            <Grupo titulo={t("pedidos.delClubTitulo")} cantidad={pedidos.length} vacio={t("pedidos.vacioDelClub")}>
              {pedidos.map((pedido) => (
                <FilaPedido
                  key={pedido.id}
                  pedido={pedido}
                  ocupada={ocupada === pedido.id}
                  onAceptar={(elegido) => setAAceptar({ pedido: elegido, modulos: { ...MODULOS_INICIALES } })}
                  onRechazar={setARechazar}
                />
              ))}
            </Grupo>
          )}

          <section className="cuentas-grupo">
            <h2>{t("cuentas.invitarTitulo")}</h2>
            <form className="cuentas-invitar" onSubmit={enviarInvitacion} noValidate>
              <input
                type="email"
                value={correo}
                placeholder={t("cuentas.correo")}
                aria-label={t("cuentas.correo")}
                autoComplete="off"
                onChange={(evento) => setCorreo(evento.target.value)}
              />
              <div className="cuenta-permisos" role="group" aria-label={t("cuentas.invitarTitulo")}>
                {MODULOS_DEL_CLUB.map((clave) => (
                  <button
                    key={clave}
                    type="button"
                    className="cuenta-chip"
                    aria-pressed={Boolean(nueva[clave])}
                    onClick={() => setNueva((actual) => ({ ...actual, [clave]: !actual[clave] }))}
                  >
                    {t(`cuentas.modulos.${clave}`)}
                  </button>
                ))}
              </div>
              <button type="submit" className="cuenta-autorizar" disabled={ocupada === "invitar" || !correo.trim()}>
                {ocupada === "invitar" ? t("cuentas.invitando") : t("cuentas.invitar")}
              </button>
              <p className="cuentas-ayuda">{t("cuentas.invitarTexto")}</p>
            </form>
          </section>

          <Grupo titulo={t("cuentas.invitacionesTitulo")} cantidad={abiertas.length} vacio={t("cuentas.vacioInvitaciones")}>
            {abiertas.map((invitacion) => (
              <FilaInvitacion
                key={invitacion.id}
                invitacion={invitacion}
                ocupada={ocupada === invitacion.id || ocupada === `mail:${invitacion.id}`}
                enviando={ocupada === `mail:${invitacion.id}`}
                onCopiar={copiarMensaje}
                onReenviar={reenviarMail}
                onCancelar={cancelar}
              />
            ))}
          </Grupo>

          {vencidas.length > 0 && (
            <Grupo titulo={t("cuentas.invitacionesVencidasTitulo")} cantidad={vencidas.length}>
              {vencidas.map((invitacion) => (
                <FilaInvitacion key={invitacion.id} invitacion={invitacion} vencida ocupada={ocupada === invitacion.id} onCopiar={copiarMensaje} onCancelar={cancelar} />
              ))}
            </Grupo>
          )}

          <Grupo titulo={t("cuentas.miembrosTitulo")} cantidad={activos.length} vacio={cargando || leyendoClub ? t("comun.cargando") : t("cuentas.vacioMiembros")}>
            {activos.map((miembro) => (
              <FilaMiembro key={miembro.user_id} miembro={miembro} esMio={miembro.user_id === miUserId} ocupada={ocupada === miembro.user_id} {...accionesMiembro} />
            ))}
          </Grupo>

          <Grupo titulo={t("cuentas.exMiembrosTitulo")} cantidad={seFueron.length} vacio={t("cuentas.vacioExMiembros")}>
            {seFueron.map((miembro) => (
              <FilaMiembro key={miembro.user_id} miembro={miembro} esMio={miembro.user_id === miUserId} ocupada={ocupada === miembro.user_id} {...accionesMiembro} />
            ))}
          </Grupo>
          </>
          )}
        </>
      )}
    </>
  );

  return (
    <main className="cuentas-pantalla">
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
          <span className="portal-kicker">{t("cuentas.kicker")}</span>
          <h1>{t("cuentas.titulo")}</h1>
          <p>{t("cuentas.texto")}</p>
        </header>

        {error && (
          <div className="cuentas-aviso">
            {error}{" "}
            <button type="button" className="cuentas-reintentar" onClick={cargar}>
              {t("comun.reintentar")}
            </button>
          </div>
        )}
        {aviso.texto && (
          <div className={`cuentas-aviso${aviso.ok ? " ok" : ""}`} role="status">
            {aviso.texto}
          </div>
        )}

        {!error && parteClub}
      </div>

      <HojaOpciones
        abierta={eligiendoClub}
        titulo={t("cuentas.club")}
        opciones={clubes.map((uno) => ({ valor: uno.id, etiqueta: uno.nombre }))}
        elegida={clubId}
        onElegir={elegirClub}
        onCerrar={() => setEligiendoClub(false)}
      />

      {aDarBaja && (
        <HojaInferior
          abierta
          className="cuentas-hoja"
          titulo={t("cuentas.bajaTitulo")}
          descripcion={t("cuentas.bajaTexto", { correo: aDarBaja.email || t("cuentas.laCuenta"), club: clubElegido?.nombre || "" })}
          onCerrar={() => setADarBaja(null)}
          acciones={
            <>
              <button type="button" className="boton-cancelar-hoja" onClick={() => setADarBaja(null)}>
                {t("comun.cancelar")}
              </button>
              <button type="button" className="boton-confirmar-hoja" onClick={confirmarBaja} disabled={!fechaBaja}>
                {t("cuentas.siBaja")}
              </button>
            </>
          }
        >
          <div className="campo-inicio">
            <label>{t("cuentas.bajaFecha")}</label>
            <input type="date" value={fechaBaja} max={hoyISO()} onChange={(evento) => setFechaBaja(evento.target.value)} />
          </div>
        </HojaInferior>
      )}

      {aAceptar && (
        <HojaInferior
          abierta
          className="cuentas-hoja"
          titulo={t("pedidos.aceptarTitulo", { correo: aAceptar.pedido.email })}
          descripcion={t("pedidos.aceptarTexto", { club: clubElegido?.nombre || "" })}
          onCerrar={() => setAAceptar(null)}
          acciones={
            <>
              <button type="button" className="boton-cancelar-hoja" onClick={() => setAAceptar(null)}>
                {t("comun.cancelar")}
              </button>
              <button type="button" className="boton-confirmar-hoja" onClick={confirmarAceptar}>
                {t("pedidos.siAceptar")}
              </button>
            </>
          }
        >
          <div className="cuenta-permisos" role="group" aria-label={t("pedidos.aceptarTitulo", { correo: aAceptar.pedido.email })}>
            {MODULOS_DEL_CLUB.map((clave) => (
              <button
                key={clave}
                type="button"
                className="cuenta-chip"
                aria-pressed={Boolean(aAceptar.modulos[clave])}
                onClick={() => setAAceptar((actual) => ({ ...actual, modulos: { ...actual.modulos, [clave]: !actual.modulos[clave] } }))}
              >
                {t(`cuentas.modulos.${clave}`)}
              </button>
            ))}
          </div>
        </HojaInferior>
      )}

      {historia && (
        <HojaInferior
          abierta
          className="cuentas-hoja"
          titulo={t("cuentas.historiaTitulo", { correo: historia.miembro.email, club: clubElegido?.nombre || "" })}
          onCerrar={() => setHistoria(null)}
          acciones={
            <button type="button" className="boton-cancelar-hoja" onClick={() => setHistoria(null)}>
              {t("comun.listo")}
            </button>
          }
        >
          {historia.error && <div className="aviso-hoja">{historia.error}</div>}
          {historia.movimientos === null ? (
            <p className="cuentas-historia-vacia">{t("comun.cargando")}</p>
          ) : historia.movimientos.length === 0 ? (
            <p className="cuentas-historia-vacia">{t("cuentas.sinHistoria")}</p>
          ) : (
            <ul className="cuentas-historia">
              {historia.movimientos.map((movimiento) => (
                <li key={movimiento.id}>
                  <b>{textoDeMovimiento(movimiento)}</b>
                  <span>
                    {fechaYHora(movimiento.cuando)}
                    {movimiento.quien_email ? ` · ${t("cuentas.porQuien", { correo: movimiento.quien_email })}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </HojaInferior>
      )}

      <HojaConfirmar
        abierta={Boolean(aRechazar)}
        icono="usuario"
        titulo={t("pedidos.rechazarTitulo")}
        descripcion={t("pedidos.rechazarTexto", { correo: aRechazar?.email || t("cuentas.laCuenta"), club: clubElegido?.nombre || "" })}
        etiquetaConfirmar={t("pedidos.siRechazar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarRechazo}
        onCancelar={() => setARechazar(null)}
      />
    </main>
  );
}
