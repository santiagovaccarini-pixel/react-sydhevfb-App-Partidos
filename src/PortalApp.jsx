import React, { useCallback, useEffect, useRef, useState } from "react";
import App from "./App";
import TrainingModule from "./TrainingModule";
import AccessGate from "./AccessGate.jsx";
import OpenFieldSession from "./OpenFieldSession.jsx";
import CuentasAdmin from "./CuentasAdmin.jsx";
import BasesDeDatos from "./BasesDeDatos.jsx";
import DatosBasicos from "./DatosBasicos.jsx";
import ElegirClub from "./ElegirClub.jsx";
import { contarPendientes, permisosEnClub } from "./domain/perfilesDb.js";
import { limpiarCopiasDelClub } from "./domain/copiasLocales.js";
import { ArteBases, ArteDatos, ArteFlujo, ArtePartido, IconoBases, IconoDatos, IconoFlujo, IconoPartido } from "./components/PortalArt.jsx";
import { ClubDelPortal, Portada, TarjetasDelPortal } from "./components/PortalTarjetas.jsx";
import { t, useIdioma } from "./idioma/index.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import { cargarEquipos, guardarEquipoElegido, leerEquipoElegido } from "./domain/equipo.js";
import "./portal.css";
import "./training.css";

const MODOS = {
  PORTAL: "portal",
  PARTIDO: "partido",
  ENTRENAMIENTO: "entrenamiento",
  BASES: "bases",
  DATOS: "datos",
  CUENTAS: "cuentas",
};

// Los módulos de la app, contados en una línea: lo esencial de cada uno. Qué
// lleva cada tarjeta (foto, foco, dibujo...) está en components/PortalTarjetas.jsx.
const TARJETAS = [
  {
    modo: MODOS.PARTIDO,
    permiso: "partido",
    clase: "tarjeta-partido",
    foto: "/portal/partido.webp",
    fotoParada: "/portal/partido-parada.webp",
    foco: [0.5, 0.5],
    focoParada: [0.2, 0.5],
    Arte: ArtePartido,
    Icono: IconoPartido,
    // Títulos y textos: claves del diccionario de idioma.
    titulo: "portal.partidoTitulo",
    texto: "portal.partidoTexto",
  },
  {
    modo: MODOS.ENTRENAMIENTO,
    permiso: "flujo",
    clase: "tarjeta-flujo",
    foto: "/portal/flujo.webp",
    fotoParada: "/portal/flujo-parada.webp",
    foco: [0.18, 0.5],
    focoParada: [0.3, 0.5],
    Arte: ArteFlujo,
    Icono: IconoFlujo,
    titulo: "portal.flujoTitulo",
    etiqueta: "portal.enPrueba",
    texto: "portal.flujoTexto",
  },
  {
    // Las bases del club (Lesiones y las que vengan): adentro, una tarjeta por
    // base (BasesDeDatos.jsx). El permiso es la columna `lesiones` de la
    // membresía, que hoy abre Bases de Datos entero.
    modo: MODOS.BASES,
    permiso: "lesiones",
    clase: "tarjeta-bases",
    foto: "/portal/bases.webp",
    fotoParada: "/portal/bases-parada.webp",
    foco: [0.4, 0.5],
    focoParada: [0.5, 0.55],
    Arte: ArteBases,
    Icono: IconoBases,
    titulo: "portal.basesTitulo",
    etiqueta: "portal.nuevo",
    texto: "portal.basesTexto",
  },
  {
    modo: MODOS.DATOS,
    permiso: "datos",
    clase: "tarjeta-datos",
    foto: null,
    fotoParada: null,
    foco: [0.5, 0.5],
    Arte: ArteDatos,
    Icono: IconoDatos,
    titulo: "portal.datosTitulo",
    etiqueta: "portal.nuevo",
    texto: "portal.datosTexto",
  },
];

const Portal = ({ onElegir, permisos, email, onSalir, onCuentas, onCambiarClub }) => {
  useIdioma();
  const equipo = leerEquipoElegido();
  const tarjetas = TARJETAS.filter((tarjeta) => permisos?.[tarjeta.permiso]);
  const [pendientes, setPendientes] = useState(0);

  // El administrador ve cuántas cuentas esperan que las autorice.
  useEffect(() => {
    if (!permisos?.admin) return undefined;
    let activo = true;
    contarPendientes()
      .then((cantidad) => activo && setPendientes(cantidad))
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [permisos?.admin]);

  return (
    <main className="portal-modulos">
      <section className="portal-contenido">
        <div className="portal-cuenta">
          <span className="portal-cuenta-correo" title={email}>
            {email}
          </span>
          <SelectorIdioma className="portal-idioma" />
          <div className="portal-cuenta-acciones">
          {(permisos?.admin || permisos?.adminClub) && (
            <button
              type="button"
              className={`portal-salir portal-cuentas${pendientes > 0 ? " con-pendientes" : ""}`}
              onClick={onCuentas}
            >
              {t("portal.cuentas")}
              {pendientes > 0 && <span className="portal-pendientes">{pendientes}</span>}
            </button>
          )}
          <button type="button" className="portal-salir" onClick={onSalir}>
            {t("portal.salir")}
          </button>
          </div>
        </div>

        <div className="portal-encabezado">
          <ClubDelPortal equipo={equipo} onCambiarClub={onCambiarClub} />
          <h1>{t("portal.pregunta")}</h1>
          <p>{tarjetas.length > 1 ? t("portal.elegi") : t("portal.unSolo")}</p>
        </div>

        <TarjetasDelPortal tarjetas={tarjetas} onElegir={onElegir} />
      </section>
    </main>
  );
};

// Con la sesión abierta: el portal y los dos módulos, cada uno detrás de su
// portada. Partido entra directo (la puerta ya comprobó la cuenta); Flujo
// diario abre además su sesión de OpenField en el servidor.
const AppConSesion = ({ email, userId, permisos, cerrarSesion, desdeCache = false }) => {
  const [modo, setModo] = useState(MODOS.PORTAL);
  // El club con el que se trabaja en este celular. Sin uno elegido, lo
  // primero después de entrar es elegirlo.
  const [club, setClub] = useState(() => leerEquipoElegido());
  const [eligiendoClub, setEligiendoClub] = useState(false);
  // La portada que se está mostrando (tarjeta, desde dónde arranca el zoom y
  // un número para que cada entrada sea una portada nueva), o nada. Se
  // muestra encima del módulo mientras este se carga.
  const [portada, setPortada] = useState(null);
  const portadas = useRef(0);
  const terminarPortada = useCallback(() => setPortada(null), []);

  // Cada vez que se ven las tarjetas (las del portal o, al volver de una
  // base, las de Bases de Datos) se vuelve a leer la lista de clubes: si el
  // administrador dio de baja a esta cuenta del club (o la reincorporó, o le
  // cambió los módulos), el celular se entera acá. Sin señal se queda con lo
  // que sabía. Devuelve con qué cortarla: lo que llega después de entrar a un
  // módulo no se usa (no saca a nadie de lo que está haciendo).
  const clubActual = useRef(club);
  clubActual.current = club;
  const releerClub = useCallback(() => {
    const leido = clubActual.current;
    if (!leido?.id) return undefined;
    let vigente = true;
    cargarEquipos().then(({ equipos, error }) => {
      if (!vigente || error) return;
      const fresco = (equipos || []).find((uno) => uno.id === leido.id);
      // Ya no está en el club, o lo dejó: las copias de ese club se van del
      // celular (lo que se ve desde ahora sale de la base, hasta su último día).
      if (!fresco || fresco.miembro === false) {
        limpiarCopiasDelClub(leido.id);
        guardarEquipoElegido(null);
        setClub(null);
        return;
      }
      if (fresco.hasta && !leido.hasta) limpiarCopiasDelClub(leido.id);
      const cambio = ["hasta", "nombre", "rol", "partido", "flujo", "lesiones"].some((clave) => (fresco[clave] ?? null) !== (leido[clave] ?? null));
      if (cambio) {
        guardarEquipoElegido(fresco);
        setClub(fresco);
      }
    });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => (modo === MODOS.PORTAL ? releerClub() : undefined), [modo, club?.id, releerClub]);

  // Lo que se puede usar sale de la membresía en el club elegido (rol y
  // módulos); la cuenta solo dice si es dueña de la plataforma.
  const enClub = permisosEnClub(permisos, club);

  const elegir = (tarjeta, desde) => {
    if (!enClub?.[tarjeta.permiso]) return;
    portadas.current += 1;
    setPortada({ tarjeta, desde, numero: portadas.current });
    setModo(tarjeta.modo);
  };

  const volver = () => setModo(MODOS.PORTAL);

  let contenido;

  if (!club || eligiendoClub) {
    contenido = (
      <ElegirClub
        esDueno={Boolean(permisos?.admin)}
        email={email}
        onElegir={(elegido) => {
          setClub(elegido);
          setEligiendoClub(false);
        }}
        onSalir={eligiendoClub ? () => setEligiendoClub(false) : cerrarSesion}
      />
    );
  } else if (modo === MODOS.PARTIDO && enClub.partido) {
    // La portada ya mostró la foto: Partido entra sin su intro. Desde sus
    // Ajustes se vuelve al portal o se cierra la sesión.
    contenido = <App intro={false} onVolver={volver} onCerrarSesion={cerrarSesion} />;
  } else if (modo === MODOS.ENTRENAMIENTO && enClub.flujo) {
    contenido = (
      // Quien entró con la copia de su cuenta (sin señal) no espera a que el
      // servidor abra la sesión de OpenField: entra y se abre cuando haya red.
      <OpenFieldSession onVolver={volver} sinSenal={desdeCache}>
        {() => <TrainingModule onVolver={volver} email={email} onCerrarSesion={cerrarSesion} />}
      </OpenFieldSession>
    );
  } else if (modo === MODOS.BASES && enClub.lesiones) {
    contenido = <BasesDeDatos permisos={enClub} userId={userId} email={email} onVolver={volver} onCerrarSesion={cerrarSesion} onTarjetas={releerClub} />;
  } else if (modo === MODOS.DATOS && enClub.datos) {
    contenido = <DatosBasicos onVolver={volver} permisos={enClub} />;
  } else if (modo === MODOS.CUENTAS && (enClub.admin || enClub.adminClub)) {
    contenido = <CuentasAdmin miUserId={userId} esDueno={enClub.admin} club={club} onVolver={volver} />;
  } else {
    contenido = (
      <Portal
        onElegir={elegir}
        permisos={enClub}
        email={email}
        onSalir={cerrarSesion}
        onCuentas={() => setModo(MODOS.CUENTAS)}
        onCambiarClub={() => setEligiendoClub(true)}
      />
    );
  }

  return (
    <>
      {contenido}
      {portada && <Portada key={portada.numero} tarjeta={portada.tarjeta} desde={portada.desde} onTerminar={terminarPortada} />}
    </>
  );
};

export default function PortalApp() {
  return (
    <AccessGate>
      {({ email, userId, permisos, cerrarSesion, desdeCache }) => (
        <AppConSesion
          email={email}
          userId={userId}
          permisos={permisos}
          cerrarSesion={cerrarSesion}
          desdeCache={desdeCache}
        />
      )}
    </AccessGate>
  );
}
