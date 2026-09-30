import React, { useCallback, useEffect, useState } from "react";
import { HojaConfirmar } from "./components/ConfirmSheet.js";
import { agruparPerfiles, decidirPerfil, listarPerfiles } from "./domain/perfilesDb.js";

// La pantalla Cuentas, solo para el administrador: quién pidió entrar, quién
// tiene acceso y quién no, y qué puede usar cada uno (Partido, Flujo diario,
// administrador). Todo va directo a la base con la sesión del administrador;
// la base es la que decide si puede.

export const MODULOS = [
  { clave: "partido", etiqueta: "Partido" },
  { clave: "flujo", etiqueta: "Flujo diario" },
  { clave: "admin", etiqueta: "Administrador" },
];

// Lo que se marca al autorizar una cuenta nueva si no se eligió otra cosa.
export const PERMISOS_INICIALES = Object.freeze({ partido: true, flujo: true, admin: false });

// Qué tiene marcado una fila: lo elegido a mano, o lo que dice la base, o
// (cuenta nueva sin nada) lo inicial.
export const permisosDeFila = (perfil, seleccion) => {
  if (seleccion) return seleccion;
  if (perfil.estado === "pendiente" && !perfil.partido && !perfil.flujo && !perfil.admin) {
    return PERMISOS_INICIALES;
  }
  return { partido: Boolean(perfil.partido), flujo: Boolean(perfil.flujo), admin: Boolean(perfil.admin) };
};

const fechaCorta = (valor) => {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(fecha);
};

const FlechaVolver = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
);

const Fila = ({ perfil, seleccion, ocupada, onCambiarModulo, onAutorizar, onQuitar }) => {
  const permisos = permisosDeFila(perfil, seleccion);
  const pendiente = perfil.estado === "pendiente";
  const autorizada = perfil.estado === "autorizado";

  return (
    <li className={`cuenta-fila${perfil.esMia ? " propia" : ""}`}>
      <div className="cuenta-encabezado">
        <span className="cuenta-correo">{perfil.email || "(sin correo)"}</span>
        {perfil.esMia && <span className="cuenta-etiqueta">Vos</span>}
        {!perfil.esMia && perfil.admin && autorizada && <span className="cuenta-etiqueta">Administrador</span>}
        {!perfil.confirmado_en && <span className="cuenta-etiqueta alerta">Correo sin confirmar</span>}
      </div>
      {(fechaCorta(perfil.creado_en) || fechaCorta(perfil.decidido_en)) && (
        <div className="cuenta-meta">
          {fechaCorta(perfil.creado_en) && <span>Creada el {fechaCorta(perfil.creado_en)}</span>}
          {fechaCorta(perfil.decidido_en) && <span>· Última decisión el {fechaCorta(perfil.decidido_en)}</span>}
        </div>
      )}

      {!perfil.esMia && (
        <>
          <div className="cuenta-permisos" role="group" aria-label={`Qué puede usar ${perfil.email}`}>
            {MODULOS.map(({ clave, etiqueta }) => (
              <button
                key={clave}
                type="button"
                className="cuenta-chip"
                aria-pressed={Boolean(permisos[clave])}
                disabled={ocupada}
                onClick={() => onCambiarModulo(perfil, clave, !permisos[clave])}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <div className="cuenta-acciones">
            {!autorizada && (
              <button type="button" className="cuenta-autorizar" disabled={ocupada} onClick={() => onAutorizar(perfil)}>
                {ocupada ? "Guardando…" : "Autorizar"}
              </button>
            )}
            {(autorizada || pendiente) && (
              <button type="button" className="cuenta-quitar" disabled={ocupada} onClick={() => onQuitar(perfil)}>
                {pendiente ? "Rechazar" : "Quitar acceso"}
              </button>
            )}
          </div>
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
  const [perfiles, setPerfiles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupada, setOcupada] = useState("");
  // Para las cuentas pendientes o sin acceso: qué se va a habilitar al
  // autorizarlas (se elige antes de tocar Autorizar).
  const [seleccion, setSeleccion] = useState({});
  const [aQuitar, setAQuitar] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setPerfiles(await listarPerfiles());
    } catch (errorLectura) {
      setError(errorLectura?.message || "No se pudieron leer las cuentas.");
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
    } catch (errorCambio) {
      setAviso(errorCambio?.message || "No se pudo cambiar la cuenta.");
    } finally {
      setOcupada("");
    }
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

  const autorizar = (perfil) => {
    const permisos = permisosDeFila(perfil, seleccion[perfil.user_id]);
    if (!permisos.partido && !permisos.flujo && !permisos.admin) {
      setAviso("Marcá al menos un módulo antes de autorizar.");
      return;
    }
    aplicar(perfil, { estado: "autorizado", ...permisos });
  };

  const confirmarQuitar = async () => {
    const perfil = aQuitar;
    setAQuitar(null);
    if (perfil) await aplicar(perfil, { estado: "bloqueado" });
  };

  const grupos = agruparPerfiles(perfiles, miUserId);
  const acciones = { seleccion, ocupada, onCambiarModulo: cambiarModulo, onAutorizar: autorizar, onQuitar: setAQuitar };

  return (
    <main className="cuentas-pantalla">
      <div className="cuentas-contenido">
        <div className="cuentas-cabecera">
          <button type="button" className="portal-salir cuentas-volver" onClick={onVolver}>
            <FlechaVolver /> Volver al portal
          </button>
          <button type="button" className="portal-salir" onClick={cargar} disabled={cargando}>
            {cargando ? "Actualizando…" : "Actualizar"}
          </button>
        </div>

        <header className="cuentas-titulo">
          <span className="portal-kicker">Administración</span>
          <h1>Cuentas</h1>
          <p>Quién puede entrar a la app y qué puede usar. Los cambios valen al toque.</p>
        </header>

        {error && (
          <div className="cuentas-aviso">
            {error}{" "}
            <button type="button" className="cuentas-reintentar" onClick={cargar}>
              Reintentar
            </button>
          </div>
        )}
        {aviso && <div className="cuentas-aviso">{aviso}</div>}

        {!error && (
          <>
            <Grupo
              titulo="Por autorizar"
              vacio={cargando ? "Cargando…" : "No hay cuentas esperando."}
              perfiles={grupos.pendientes}
              {...acciones}
            />
            <Grupo
              titulo="Con acceso"
              vacio={cargando ? "Cargando…" : "Todavía no hay cuentas con acceso."}
              perfiles={grupos.conAcceso}
              {...acciones}
            />
            <Grupo
              titulo="Sin acceso"
              vacio={cargando ? "Cargando…" : "Ninguna cuenta bloqueada."}
              perfiles={grupos.sinAcceso}
              {...acciones}
            />
          </>
        )}
      </div>

      <HojaConfirmar
        abierta={Boolean(aQuitar)}
        icono="usuario"
        titulo={aQuitar?.estado === "pendiente" ? "¿Rechazar esta cuenta?" : "¿Quitar el acceso?"}
        descripcion={
          aQuitar?.estado === "pendiente"
            ? `${aQuitar?.email || "La cuenta"} no va a poder entrar. La podés autorizar más adelante desde "Sin acceso".`
            : `${aQuitar?.email || "La cuenta"} deja de entrar a la app al toque. La podés volver a autorizar cuando quieras.`
        }
        etiquetaConfirmar={aQuitar?.estado === "pendiente" ? "Sí, rechazar" : "Sí, quitar"}
        onConfirmar={confirmarQuitar}
        onCancelar={() => setAQuitar(null)}
      />
    </main>
  );
}
