import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { HojaOpciones } from "./components/HojaOpciones.js";
import { FlechaVolver } from "./components/PortalTarjetas.jsx";
import { cargarEquipos } from "./domain/equipo.js";
import {
  MODULOS_DEL_CLUB,
  cambiarModulo,
  cambiarRol,
  cancelarInvitacion,
  correoValido,
  darDeBaja,
  enviarInvitacionPorMail,
  historialDeMiembro,
  invitacionVencida,
  invitar,
  listarInvitaciones,
  listarMembresias,
  listarMiembros,
  reincorporar,
} from "./domain/membresiasDb.js";
import { agruparPerfiles, decidirPerfil, listarPerfiles } from "./domain/perfilesDb.js";
import { idiomaActual, t, useIdioma } from "./idioma/index.js";
import { fechaCorta, fechaYHora, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// Cuentas. Dos partes:
//  · La gente del club (para su administrador y para el dueño): invitar por
//    correo, rol, módulos, dar de baja con el último día, reincorporar y la
//    historia de cada uno. Quien se va sigue viendo lo cargado hasta su
//    último día, sin cambiar nada (eso lo cuida la base).
//  · Las cuentas de la app (solo el dueño de la plataforma): quién pidió
//    entrar, quién tiene acceso y quién no.
// Todo va directo a la base con la sesión de quien entra; la base decide.

// Lo que se marca por defecto al invitar.
export const INVITACION_INICIAL = Object.freeze({ rol: "staff", partido: true, flujo: true, lesiones: false, evaluaciones: false });

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
    default:
      return t("cuentas.movimientos.borrado");
  }
};

// ------------------------------------------------- La gente del club --

const FilaMiembro = ({ miembro, esMio, ocupada, onRol, onModulo, onBaja, onReincorporar, onHistoria }) => {
  const activo = !miembro.hasta;
  return (
    <li className={`cuenta-fila${esMio ? " propia" : ""}${activo ? "" : " se-fue"}`}>
      <div className="cuenta-encabezado">
        <span className="cuenta-correo">{miembro.email || t("cuentas.sinCorreo")}</span>
        {esMio && <span className="cuenta-etiqueta">{t("cuentas.tuCuenta")}</span>}
        {activo && miembro.rol === "admin" && <span className="cuenta-etiqueta">{t("cuentas.roles.admin")}</span>}
        {miembro.estado === "bloqueado" && <span className="cuenta-etiqueta alerta">{t("cuentas.cuentaBloqueada")}</span>}
        {miembro.estado === "pendiente" && <span className="cuenta-etiqueta alerta">{t("cuentas.cuentaPendiente")}</span>}
      </div>
      <div className="cuenta-meta">
        {activo ? (
          miembro.desde && <span>{t("cuentas.desdeEl", { fecha: fechaCorta(miembro.desde) })}</span>
        ) : (
          <span className="cuenta-meta-hasta">{t("cuentas.hastaEl", { fecha: fechaCorta(miembro.hasta) })}</span>
        )}
      </div>
      <div className="cuenta-permisos" role="group" aria-label={t("cuentas.quePuedeUsar", { correo: miembro.email })}>
        {activo && (
          <button type="button" className="cuenta-chip" aria-pressed={miembro.rol === "admin"} disabled={ocupada} onClick={() => onRol(miembro)}>
            {t("cuentas.roles.admin")}
          </button>
        )}
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
      <div className="cuenta-acciones">
        {activo ? (
          <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onBaja(miembro)}>
            {t("cuentas.darBaja")}
          </button>
        ) : (
          <button type="button" className="cuenta-autorizar" disabled={ocupada} onClick={() => onReincorporar(miembro)}>
            {ocupada ? t("comun.guardando") : t("cuentas.reincorporar")}
          </button>
        )}
        <button type="button" className="cuenta-quitar" onClick={() => onHistoria(miembro)}>
          {t("cuentas.verHistoria")}
        </button>
      </div>
    </li>
  );
};

// Una invitación vencida ya no sirve para entrar: va aparte, sin el mensaje
// para copiar ni el mail (para volver a invitar ese correo, se lo invita de nuevo).
const FilaInvitacion = ({ invitacion, vencida = false, ocupada, onCopiar, onReenviar, onCancelar }) => (
  <li className="cuenta-fila invitacion">
    <div className="cuenta-encabezado">
      <span className="cuenta-correo">{invitacion.email}</span>
      {invitacion.rol === "admin" && <span className="cuenta-etiqueta">{t("cuentas.roles.admin")}</span>}
      {vencida && <span className="cuenta-etiqueta alerta">{t("cuentas.vencida")}</span>}
    </div>
    <div className="cuenta-meta">
      <span>{nombresDeModulos(invitacion)}</span>
      <span>{t(vencida ? "cuentas.vencioEl" : "cuentas.venceEl", { fecha: fechaCorta(invitacion.vence_en) })}</span>
    </div>
    <div className="cuenta-acciones">
      {!vencida && (
        <>
          <button type="button" className="cuenta-autorizar" onClick={() => onCopiar(invitacion)}>
            {t("cuentas.copiarMensaje")}
          </button>
          <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onReenviar(invitacion)}>
            {ocupada ? t("cuentas.enviandoMail") : t("cuentas.reenviarMail")}
          </button>
        </>
      )}
      <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onCancelar(invitacion)}>
        {t("cuentas.cancelarInvitacion")}
      </button>
    </div>
  </li>
);

// ------------------------------------------- Las cuentas de la app --

const FilaCuenta = ({ perfil, clubesDeLaCuenta, ocupada, clubParaSumar, onSumar, onBloquear, onDevolver }) => {
  const pendiente = perfil.estado === "pendiente";
  const autorizada = perfil.estado === "autorizado";
  return (
    <li className={`cuenta-fila${perfil.esMia ? " propia" : ""}`}>
      <div className="cuenta-encabezado">
        <span className="cuenta-correo">{perfil.email || t("cuentas.sinCorreo")}</span>
        {perfil.esMia && <span className="cuenta-etiqueta">{t("cuentas.tuCuenta")}</span>}
        {!perfil.esMia && perfil.admin && autorizada && <span className="cuenta-etiqueta">{t("cuentas.dueno")}</span>}
        {!perfil.confirmado_en && <span className="cuenta-etiqueta alerta">{t("cuentas.correoSinConfirmar")}</span>}
      </div>
      <div className="cuenta-meta">
        {fechaCorta(perfil.creado_en) && <span>{t("cuentas.creadaEl", { fecha: fechaCorta(perfil.creado_en) })}</span>}
        <span>{clubesDeLaCuenta || t("cuentas.sinClub")}</span>
      </div>
      {!perfil.esMia && (
        <div className="cuenta-acciones">
          {pendiente && clubParaSumar && (
            <button type="button" className="cuenta-autorizar" disabled={ocupada} onClick={() => onSumar(perfil)}>
              {ocupada ? t("comun.guardando") : t("cuentas.sumarA", { club: clubParaSumar.nombre })}
            </button>
          )}
          {(autorizada || pendiente) && (
            <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onBloquear(perfil)}>
              {pendiente ? t("cuentas.rechazar") : t("cuentas.quitarAcceso")}
            </button>
          )}
          {perfil.estado === "bloqueado" && (
            <button type="button" className="cuenta-autorizar" disabled={ocupada} onClick={() => onDevolver(perfil)}>
              {ocupada ? t("comun.guardando") : t("cuentas.devolverAcceso")}
            </button>
          )}
        </div>
      )}
    </li>
  );
};

const Grupo = ({ titulo, cantidad, vacio, children }) => (
  <section className="cuentas-grupo">
    <h2>
      {titulo} <span className="cuentas-cantidad">{cantidad}</span>
    </h2>
    {cantidad === 0 ? <p className="cuentas-vacio">{vacio}</p> : <ul className="cuentas-lista">{children}</ul>}
  </section>
);

export default function CuentasAdmin({ miUserId, esDueno = false, club = null, onVolver }) {
  useIdioma();
  const [pestana, setPestana] = useState("club");
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [ocupada, setOcupada] = useState("");

  // Los clubes que administra quien entró (el dueño: todos) y el elegido.
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
  // Se está leyendo el club recién elegido.
  const [leyendoClub, setLeyendoClub] = useState(false);

  // La invitación que se está armando.
  const [correo, setCorreo] = useState("");
  const [nueva, setNueva] = useState({ ...INVITACION_INICIAL });

  // Hojas: dar de baja, historia, quitar acceso.
  const [aDarBaja, setADarBaja] = useState(null);
  const [fechaBaja, setFechaBaja] = useState(hoyISO());
  const [historia, setHistoria] = useState(null);
  const [aBloquear, setABloquear] = useState(null);

  // Las cuentas de la app (solo el dueño).
  const [perfiles, setPerfiles] = useState([]);
  const [membresias, setMembresias] = useState([]);

  const clubElegido = clubes.find((uno) => uno.id === clubId) || null;

  const cargarClub = useCallback(async (id) => {
    if (!id) {
      setMiembros([]);
      setInvitaciones([]);
      return;
    }
    const [lista, abiertas] = await Promise.all([listarMiembros(id), listarInvitaciones(id)]);
    // Si mientras tanto se eligió otro club, esto ya no es lo que se ve.
    if (clubIdRef.current !== id) return;
    setMiembros(lista);
    setInvitaciones(abiertas);
  }, []);

  // La gente del club y las cuentas de la app se leen por separado: si una
  // parte falla (por ejemplo, falta actualizar la base), la otra sigue.
  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    setErrorClub("");
    try {
      const { equipos } = await cargarEquipos();
      // El admin de un club administra los suyos; el dueño, todos.
      const propios = (equipos || []).filter((uno) => esDueno || (uno.rol === "admin" && !uno.hasta));
      setClubes(propios);
      const elegido = propios.find((uno) => uno.id === clubIdRef.current) || propios[0] || null;
      ponerClub(elegido?.id || null);
      try {
        await cargarClub(elegido?.id || null);
      } catch (errorLectura) {
        if (clubIdRef.current === (elegido?.id || null)) setErrorClub(mensajeDe(errorLectura, "cuentas.errorClubes"));
      }
      if (esDueno) {
        const [cuentas, todas] = await Promise.all([listarPerfiles(), listarMembresias().catch(() => [])]);
        setPerfiles(cuentas);
        setMembresias(todas);
      }
    } catch (errorLectura) {
      setError(mensajeDe(errorLectura, "cuentas.errorLeer"));
    } finally {
      setCargando(false);
    }
  }, [esDueno, cargarClub]);

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
      if (avisoBien) setAviso(avisoBien);
    } catch (errorCambio) {
      setAviso(mensajeDe(errorCambio, "cuentas.errorClub"));
    } finally {
      setOcupada("");
    }
  };

  const alternarRol = (miembro) =>
    aplicar(miembro, () => cambiarRol(miembro.user_id, clubId, miembro.rol === "admin" ? "staff" : "admin"));
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
      // Si la cuenta ya existía, entró en el acto; si no, le llega el mail.
      if (usada) setAviso(t("cuentas.entroYa", { correo: limpio }));
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
    setAviso(t(clave, { correo: invitacion.email }));
    return clave;
  };

  const reenviarMail = async (invitacion) => {
    const delClub = clubIdRef.current;
    setOcupada(invitacion.id);
    setAviso("");
    try {
      const clave = await mandarMail(invitacion);
      // Si ya no estaba abierta (se usó, se canceló, venció o la cuenta ya
      // existe), la lista se pone al día.
      if (["cuentas.mail.cerrada", "cuentas.mail.vencida", "cuentas.mail.yaTieneCuenta"].includes(clave)) {
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
      setAviso(t("cuentas.copiado"));
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
      setAviso(t("cuentas.invitacionCancelada"));
    } catch (errorCancelar) {
      setAviso(mensajeDe(errorCancelar, "cuentas.errorInvitar"));
    } finally {
      setOcupada("");
    }
  };

  // ------------------------------------------ Cuentas de la app (dueño) --

  const decidir = async (perfil, cambios) => {
    setOcupada(perfil.user_id);
    setAviso("");
    try {
      const fila = await decidirPerfil(perfil.user_id, cambios);
      setPerfiles((lista) => lista.map((uno) => (uno.user_id === fila.user_id ? fila : uno)));
    } catch (errorCambio) {
      setAviso(mensajeDe(errorCambio, "cuentas.errorCambiar"));
    } finally {
      setOcupada("");
    }
  };

  // Sumar una cuenta pendiente al club elegido es invitarla: si ya confirmó
  // su correo entra en el acto (y queda autorizada); si no, al confirmarlo.
  const sumarAlClub = async (perfil) => {
    if (!clubElegido) return;
    setOcupada(perfil.user_id);
    setAviso("");
    try {
      const { usada } = await invitar(clubElegido.id, { email: perfil.email, ...INVITACION_INICIAL });
      setAviso(usada ? t("cuentas.entroYa", { correo: perfil.email }) : t("cuentas.invitado", { correo: perfil.email }));
      await cargar();
    } catch (errorSumar) {
      setAviso(mensajeDe(errorSumar, "cuentas.errorInvitar"));
    } finally {
      setOcupada("");
    }
  };

  const confirmarBloqueo = async () => {
    const perfil = aBloquear;
    setABloquear(null);
    if (perfil) await decidir(perfil, { estado: "bloqueado" });
  };

  const clubesDe = useMemo(() => {
    const nombres = new Map(clubes.map((uno) => [uno.id, uno.nombre]));
    return (userId) =>
      membresias
        .filter((m) => m.user_id === userId && nombres.has(m.equipo_id))
        .map((m) => {
          const nombre = nombres.get(m.equipo_id);
          if (m.hasta) return t("cuentas.clubHasta", { club: nombre, fecha: fechaCorta(m.hasta) });
          return m.rol === "admin" ? t("cuentas.clubAdmin", { club: nombre }) : nombre;
        })
        .join(" · ");
  }, [clubes, membresias]);

  const activos = miembros.filter((uno) => !uno.hasta);
  const seFueron = miembros.filter((uno) => uno.hasta);
  const vencidas = invitaciones.filter((una) => invitacionVencida(una));
  const abiertas = invitaciones.filter((una) => !invitacionVencida(una));
  const grupos = agruparPerfiles(perfiles, miUserId);

  const accionesMiembro = {
    onRol: alternarRol,
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
                <button
                  type="button"
                  className="cuenta-chip"
                  aria-pressed={nueva.rol === "admin"}
                  onClick={() => setNueva((actual) => ({ ...actual, rol: actual.rol === "admin" ? "staff" : "admin" }))}
                >
                  {t("cuentas.roles.admin")}
                </button>
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
                ocupada={ocupada === invitacion.id}
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

  const accionesCuenta = {
    clubParaSumar: clubElegido,
    onSumar: sumarAlClub,
    onBloquear: setABloquear,
    onDevolver: (perfil) => decidir(perfil, { estado: "autorizado" }),
  };

  const partePlataforma = (
    <>
      <p className="cuentas-ayuda">{t("cuentas.plataformaTexto")}</p>
      <Grupo titulo={t("cuentas.porAutorizar")} cantidad={grupos.pendientes.length} vacio={cargando ? t("comun.cargando") : t("cuentas.vacioPendientes")}>
        {grupos.pendientes.map((perfil) => (
          <FilaCuenta key={perfil.user_id} perfil={perfil} clubesDeLaCuenta={clubesDe(perfil.user_id)} ocupada={ocupada === perfil.user_id} {...accionesCuenta} />
        ))}
      </Grupo>
      <Grupo titulo={t("cuentas.conAcceso")} cantidad={grupos.conAcceso.length} vacio={cargando ? t("comun.cargando") : t("cuentas.vacioConAcceso")}>
        {grupos.conAcceso.map((perfil) => (
          <FilaCuenta key={perfil.user_id} perfil={perfil} clubesDeLaCuenta={clubesDe(perfil.user_id)} ocupada={ocupada === perfil.user_id} {...accionesCuenta} />
        ))}
      </Grupo>
      <Grupo titulo={t("cuentas.sinAcceso")} cantidad={grupos.sinAcceso.length} vacio={cargando ? t("comun.cargando") : t("cuentas.vacioSinAcceso")}>
        {grupos.sinAcceso.map((perfil) => (
          <FilaCuenta key={perfil.user_id} perfil={perfil} clubesDeLaCuenta={clubesDe(perfil.user_id)} ocupada={ocupada === perfil.user_id} {...accionesCuenta} />
        ))}
      </Grupo>
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

        {esDueno && (
          <div className="cuentas-pestanas" role="tablist">
            <button type="button" role="tab" className="cuenta-chip" aria-pressed={pestana === "club"} aria-selected={pestana === "club"} onClick={() => setPestana("club")}>
              {t("cuentas.pestanaClub")}
            </button>
            <button
              type="button"
              role="tab"
              className="cuenta-chip"
              aria-pressed={pestana === "plataforma"}
              aria-selected={pestana === "plataforma"}
              onClick={() => setPestana("plataforma")}
            >
              {t("cuentas.pestanaPlataforma")}
              {grupos.pendientes.length > 0 && <span className="portal-pendientes">{grupos.pendientes.length}</span>}
            </button>
          </div>
        )}

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

        {!error && (pestana === "plataforma" && esDueno ? partePlataforma : parteClub)}
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
        abierta={Boolean(aBloquear)}
        icono="usuario"
        titulo={aBloquear?.estado === "pendiente" ? t("cuentas.rechazarTitulo") : t("cuentas.quitarTitulo")}
        descripcion={
          aBloquear?.estado === "pendiente"
            ? t("cuentas.rechazarTexto", { correo: aBloquear?.email || t("cuentas.laCuenta") })
            : t("cuentas.quitarTexto", { correo: aBloquear?.email || t("cuentas.laCuenta") })
        }
        etiquetaConfirmar={aBloquear?.estado === "pendiente" ? t("cuentas.siRechazar") : t("cuentas.siQuitar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarBloqueo}
        onCancelar={() => setABloquear(null)}
      />
    </main>
  );
}
