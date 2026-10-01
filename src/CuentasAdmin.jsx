import React, { useCallback, useEffect, useState } from "react";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { HojaInferior } from "./components/SheetPanel.js";
import { cargarEquipos, leerEquipoElegido } from "./domain/equipo.js";
import { darDeBaja, estadoDeMembresia, listarMembresias, membresiaDe, reincorporar, sumarAlClub } from "./domain/membresiasDb.js";
import { agruparPerfiles, decidirPerfil, listarPerfiles } from "./domain/perfilesDb.js";
import { t, useIdioma } from "./idioma/index.js";
import { fechaCorta, hoyISO } from "./idioma/formatos.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";

// La pantalla Cuentas, solo para el administrador: quién pidió entrar, quién
// tiene acceso y quién no, y qué puede usar cada uno (Partido, Flujo diario,
// administrador). Todo va directo a la base con la sesión del administrador;
// la base es la que decide si puede.

export const MODULOS = [
  { clave: "partido" },
  { clave: "flujo" },
  { clave: "lesiones" },
  { clave: "admin" },
];

// Lo que se marca al autorizar una cuenta nueva si no se eligió otra cosa.
export const PERMISOS_INICIALES = Object.freeze({ partido: true, flujo: true, lesiones: false, admin: false });

// Qué tiene marcado una fila: lo elegido a mano, o lo que dice la base, o
// (cuenta nueva sin nada) lo inicial.
export const permisosDeFila = (perfil, seleccion) => {
  if (seleccion) return seleccion;
  if (perfil.estado === "pendiente" && !perfil.partido && !perfil.flujo && !perfil.lesiones && !perfil.admin) {
    return PERMISOS_INICIALES;
  }
  return {
    partido: Boolean(perfil.partido),
    flujo: Boolean(perfil.flujo),
    lesiones: Boolean(perfil.lesiones),
    admin: Boolean(perfil.admin),
  };
};


const FlechaVolver = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
);

// Un error de la base viene como texto; uno nuestro, como clave del diccionario.
const mensajeDe = (error, porDefecto) => {
  const texto = error?.message || "";
  return /^[a-z]+(\.[a-zA-Z]+)+$/.test(texto) ? t(texto) : texto || t(porDefecto);
};

const Fila = ({
  perfil,
  seleccion,
  ocupada,
  onCambiarModulo,
  onAutorizar,
  onQuitar,
  clubes = [],
  membresias = [],
  ocupadaClub = "",
  onSumar,
  onDarBaja,
  onReincorporar,
}) => {
  const permisos = permisosDeFila(perfil, seleccion);
  const pendiente = perfil.estado === "pendiente";
  const autorizada = perfil.estado === "autorizado";

  return (
    <li className={`cuenta-fila${perfil.esMia ? " propia" : ""}`}>
      <div className="cuenta-encabezado">
        <span className="cuenta-correo">{perfil.email || t("cuentas.sinCorreo")}</span>
        {perfil.esMia && <span className="cuenta-etiqueta">{t("cuentas.tuCuenta")}</span>}
        {!perfil.esMia && perfil.admin && autorizada && <span className="cuenta-etiqueta">{t("cuentas.administrador")}</span>}
        {!perfil.confirmado_en && <span className="cuenta-etiqueta alerta">{t("cuentas.correoSinConfirmar")}</span>}
      </div>
      {(fechaCorta(perfil.creado_en) || fechaCorta(perfil.decidido_en)) && (
        <div className="cuenta-meta">
          {fechaCorta(perfil.creado_en) && <span>{t("cuentas.creadaEl", { fecha: fechaCorta(perfil.creado_en) })}</span>}
          {fechaCorta(perfil.decidido_en) && <span>{t("cuentas.ultimoCambio", { fecha: fechaCorta(perfil.decidido_en) })}</span>}
        </div>
      )}

      {!perfil.esMia && (
        <>
          <div className="cuenta-permisos" role="group" aria-label={t("cuentas.quePuedeUsar", { correo: perfil.email })}>
            {MODULOS.map(({ clave }) => (
              <button
                key={clave}
                type="button"
                className="cuenta-chip"
                aria-pressed={Boolean(permisos[clave])}
                disabled={ocupada}
                onClick={() => onCambiarModulo(perfil, clave, !permisos[clave])}
              >
                {t(`cuentas.modulos.${clave}`)}
              </button>
            ))}
          </div>
          <div className="cuenta-acciones">
            {!autorizada && (
              <button type="button" className="cuenta-autorizar" disabled={ocupada} onClick={() => onAutorizar(perfil)}>
                {ocupada ? t("comun.guardando") : t("cuentas.autorizar")}
              </button>
            )}
            {(autorizada || pendiente) && (
              <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onQuitar(perfil)}>
                {pendiente ? t("cuentas.rechazar") : t("cuentas.quitarAcceso")}
              </button>
            )}
          </div>

          {/* En qué clubes está, y hasta cuándo. Quien se fue sigue viendo lo
              cargado hasta su último día, sin cambiar nada. */}
          {autorizada && clubes.length > 0 && (
            <div className="cuenta-clubes" role="group" aria-label={t("cuentas.clubesDe", { correo: perfil.email })}>
              <span className="cuenta-clubes-titulo">{t("cuentas.clubes")}</span>
              {clubes.map((club) => {
                const membresia = membresiaDe(membresias, perfil.user_id, club.id);
                const estado = estadoDeMembresia(membresia);
                const ocupado = ocupadaClub === `${perfil.user_id}|${club.id}`;
                const texto =
                  estado === "activo"
                    ? t("cuentas.enElClub")
                    : estado === "hasta"
                      ? t("cuentas.hastaEl", { fecha: fechaCorta(membresia.hasta) })
                      : t("cuentas.noEsta");
                const accion = estado === "activo" ? onDarBaja : estado === "hasta" ? onReincorporar : onSumar;
                const etiqueta = estado === "activo" ? t("cuentas.darBaja") : estado === "hasta" ? t("cuentas.reincorporar") : t("cuentas.sumar");
                return (
                  <div className="cuenta-club" key={club.id}>
                    <span className="cuenta-club-nombre">{club.nombre}</span>
                    <span className={`cuenta-club-estado ${estado}`}>{texto}</span>
                    <button type="button" className="cuenta-club-boton" disabled={ocupado} onClick={() => accion(perfil, club)}>
                      {ocupado ? t("comun.guardando") : etiqueta}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </li>
  );
};

const Grupo = ({ titulo, vacio, perfiles, seleccion, ocupada, ...acciones }) => (
  <section className="cuentas-grupo">
    <h2>
      {titulo} <span className="cuentas-cantidad">{perfiles.length}</span>
    </h2>
    {perfiles.length === 0 ? (
      <p className="cuentas-vacio">{vacio}</p>
    ) : (
      <ul className="cuentas-lista">
        {perfiles.map((perfil) => (
          <Fila
            key={perfil.user_id}
            perfil={perfil}
            seleccion={seleccion[perfil.user_id]}
            ocupada={ocupada === perfil.user_id}
            {...acciones}
          />
        ))}
      </ul>
    )}
  </section>
);

export default function CuentasAdmin({ miUserId, onVolver }) {
  useIdioma();
  const [perfiles, setPerfiles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupada, setOcupada] = useState("");
  // Para las cuentas pendientes o sin acceso: qué se va a habilitar al
  // autorizarlas (se elige antes de tocar Autorizar).
  const [seleccion, setSeleccion] = useState({});
  const [aQuitar, setAQuitar] = useState(null);
  // Los clubes y quién está en cada uno (y hasta cuándo).
  const [clubes, setClubes] = useState([]);
  const [membresias, setMembresias] = useState([]);
  const [ocupadaClub, setOcupadaClub] = useState("");
  const [aDarBaja, setADarBaja] = useState(null);
  const [fechaBaja, setFechaBaja] = useState(hoyISO());

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setPerfiles(await listarPerfiles());
      const [respuestaClubes, lista] = await Promise.all([cargarEquipos(), listarMembresias().catch(() => null)]);
      if (lista) {
        setClubes(respuestaClubes.equipos || []);
        setMembresias(lista);
      } else {
        setClubes([]);
        setAviso(t("cuentas.errorClubes"));
      }
    } catch (errorLectura) {
      setError(errorLectura?.message || t("cuentas.errorLeer"));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const aplicar = async (perfil, cambios) => {
    setOcupada(perfil.user_id);
    setAviso("");
    try {
      const fila = await decidirPerfil(perfil.user_id, cambios);
      setPerfiles((lista) => lista.map((actual) => (actual.user_id === fila.user_id ? fila : actual)));
      setSeleccion((actual) => {
        const { [perfil.user_id]: _descartada, ...resto } = actual;
        return resto;
      });
      return fila;
    } catch (errorCambio) {
      setAviso(errorCambio?.message || t("cuentas.errorCambiar"));
      return null;
    } finally {
      setOcupada("");
    }
  };

  const cambiarMembresia = async (perfil, club, accion) => {
    setOcupadaClub(`${perfil.user_id}|${club.id}`);
    setAviso("");
    try {
      const fila = await accion();
      setMembresias((lista) => [...lista.filter((m) => !(m.user_id === fila.user_id && m.equipo_id === fila.equipo_id)), fila]);
    } catch (errorClub) {
      setAviso(mensajeDe(errorClub, "cuentas.errorClub"));
    } finally {
      setOcupadaClub("");
    }
  };

  const confirmarBaja = async () => {
    const pedido = aDarBaja;
    setADarBaja(null);
    if (!pedido || !fechaBaja) return;
    await cambiarMembresia(pedido.perfil, pedido.club, () => darDeBaja(pedido.perfil.user_id, pedido.club.id, fechaBaja));
  };

  // En una cuenta con acceso, el cambio va a la base al toque; en una
  // pendiente o sin acceso, queda elegido hasta que se la autoriza.
  const cambiarModulo = (perfil, clave, valor) => {
    if (perfil.estado === "autorizado") {
      aplicar(perfil, { [clave]: valor });
      return;
    }
    const nuevos = { ...permisosDeFila(perfil, seleccion[perfil.user_id]), [clave]: valor };
    setSeleccion((actual) => ({ ...actual, [perfil.user_id]: nuevos }));
  };

  const autorizar = async (perfil) => {
    const permisos = permisosDeFila(perfil, seleccion[perfil.user_id]);
    if (!permisos.partido && !permisos.flujo && !permisos.lesiones && !permisos.admin) {
      setAviso(t("cuentas.marcaModulo"));
      return;
    }
    const fila = await aplicar(perfil, { estado: "autorizado", ...permisos });
    if (!fila) return;
    // Una cuenta recién autorizada queda en el club con el que se está
    // trabajando, para que no entre a una app sin clubes.
    const actual = leerEquipoElegido();
    const club = clubes.find((uno) => uno.id === actual?.id);
    const yaEsta = membresias.some((m) => m.user_id === perfil.user_id && !m.hasta);
    if (club && !yaEsta) await cambiarMembresia(perfil, club, () => sumarAlClub(perfil.user_id, club.id));
  };

  const confirmarQuitar = async () => {
    const perfil = aQuitar;
    setAQuitar(null);
    if (perfil) await aplicar(perfil, { estado: "bloqueado" });
  };

  const grupos = agruparPerfiles(perfiles, miUserId);
  const acciones = {
    seleccion,
    ocupada,
    onCambiarModulo: cambiarModulo,
    onAutorizar: autorizar,
    onQuitar: setAQuitar,
    clubes,
    membresias,
    ocupadaClub,
    onSumar: (perfil, club) => cambiarMembresia(perfil, club, () => sumarAlClub(perfil.user_id, club.id)),
    onDarBaja: (perfil, club) => {
      setFechaBaja(hoyISO());
      setADarBaja({ perfil, club });
    },
    onReincorporar: (perfil, club) => cambiarMembresia(perfil, club, () => reincorporar(perfil.user_id, club.id)),
  };

  return (
    <main className="cuentas-pantalla">
      <div className="cuentas-contenido">
        <div className="cuentas-cabecera">
          <button type="button" className="portal-salir cuentas-volver" onClick={onVolver}>
            <FlechaVolver /> {t("acceso.volverPortal")}
          </button>
          <div className="cuentas-cabecera-derecha">
            <button type="button" className="portal-salir" onClick={cargar} disabled={cargando}>
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
        {aviso && <div className="cuentas-aviso">{aviso}</div>}

        {!error && (
          <>
            <Grupo
              titulo={t("cuentas.porAutorizar")}
              vacio={cargando ? t("comun.cargando") : t("cuentas.vacioPendientes")}
              perfiles={grupos.pendientes}
              {...acciones}
            />
            <Grupo
              titulo={t("cuentas.conAcceso")}
              vacio={cargando ? t("comun.cargando") : t("cuentas.vacioConAcceso")}
              perfiles={grupos.conAcceso}
              {...acciones}
            />
            <Grupo
              titulo={t("cuentas.sinAcceso")}
              vacio={cargando ? t("comun.cargando") : t("cuentas.vacioSinAcceso")}
              perfiles={grupos.sinAcceso}
              {...acciones}
            />
          </>
        )}
      </div>

      <HojaConfirmar
        abierta={Boolean(aQuitar)}
        icono="usuario"
        titulo={aQuitar?.estado === "pendiente" ? t("cuentas.rechazarTitulo") : t("cuentas.quitarTitulo")}
        descripcion={
          aQuitar?.estado === "pendiente"
            ? t("cuentas.rechazarTexto", { correo: aQuitar?.email || t("cuentas.laCuenta") })
            : t("cuentas.quitarTexto", { correo: aQuitar?.email || t("cuentas.laCuenta") })
        }
        etiquetaConfirmar={aQuitar?.estado === "pendiente" ? t("cuentas.siRechazar") : t("cuentas.siQuitar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={confirmarQuitar}
        onCancelar={() => setAQuitar(null)}
      />

      {aDarBaja && (
        <HojaInferior
          abierta
          className="cuentas-hoja"
          titulo={t("cuentas.bajaTitulo")}
          descripcion={t("cuentas.bajaTexto", { correo: aDarBaja.perfil.email || t("cuentas.laCuenta"), club: aDarBaja.club.nombre })}
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
    </main>
  );
}
