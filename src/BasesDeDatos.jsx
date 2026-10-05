import React, { useCallback, useEffect, useRef, useState } from "react";
import Lesiones from "./Lesiones.jsx";
import { ArteLesiones, IconoLesiones } from "./components/PortalArt.jsx";
import { ClubDelPortal, FlechaVolver, Portada, TarjetasDelPortal } from "./components/PortalTarjetas.jsx";
import { leerEquipoElegido } from "./domain/equipo.js";
import { t, useIdioma } from "./idioma/index.js";
import SelectorIdioma from "./idioma/SelectorIdioma.jsx";
import "./portal.css";

// Bases de Datos: las bases del club (Lesiones hoy; las que vengan después),
// con la cara de la pantalla principal: una tarjeta por base, con su foto o
// su dibujo, su ícono, qué hay adentro y Entrar; al tocarla, la misma portada
// que al entrar a un módulo. Desde cada base se vuelve acá.
//
// Las bases de la app, en este único lugar. Una base nueva es una tarjeta más
// (lo que lleva cada tarjeta está en components/PortalTarjetas.jsx) con su
// `Pantalla`, que recibe onVolver (vuelve acá) y volverA (el texto de ese
// botón). `permiso` es el módulo de la membresía que la abre: hoy todas van
// con `lesiones`, que es el que abre Bases de Datos; una base que no tenga que
// ver todo el que entra acá tendrá su propio permiso (qué hay que tocar para
// eso, en docs/PENDIENTES.md, "Bases de Datos").
export const BASES = [
  {
    modo: "lesiones",
    Pantalla: Lesiones,
    permiso: "lesiones",
    clase: "tarjeta-lesiones",
    foto: null,
    fotoParada: null,
    // En la portada del celular queda a la vista la figura del dibujo.
    foco: [0.85, 0.5],
    Arte: ArteLesiones,
    Icono: IconoLesiones,
    titulo: "bases.lesionesTitulo",
    texto: "bases.lesionesTexto",
  },
];

// Las bases que la cuenta puede abrir en el club elegido.
export const basesHabilitadas = (permisos) => BASES.filter((base) => Boolean(permisos?.[base.permiso]));

const Tablero = ({ bases, onElegir, onVolver }) => {
  useIdioma();
  const equipo = leerEquipoElegido();
  let texto = t("bases.elegi");
  if (bases.length === 0) texto = t("bases.ninguna");
  else if (bases.length === 1) texto = t("bases.unaSola");

  return (
    <main className="portal-modulos bases-datos">
      <section className="portal-contenido">
        <div className="bases-barra">
          <button type="button" className="portal-salir bases-volver" onClick={onVolver}>
            <FlechaVolver /> {t("acceso.volverPortal")}
          </button>
          <SelectorIdioma className="portal-idioma" />
        </div>

        <div className="portal-encabezado">
          <ClubDelPortal equipo={equipo} />
          <h1>{t("portal.basesTitulo")}</h1>
          <p>{texto}</p>
        </div>

        <TarjetasDelPortal tarjetas={bases} onElegir={onElegir} />
      </section>
    </main>
  );
};

// onTarjetas: se llama al volver de una base a las tarjetas (para releer el
// club, como el portal); devuelve con qué cortar esa lectura al entrar a otra.
export default function BasesDeDatos({ permisos, userId, email, onVolver, onCerrarSesion, onTarjetas = null }) {
  // La base abierta, o ninguna (las tarjetas).
  const [abierta, setAbierta] = useState(null);
  // Cuántas veces se volvió de una base a las tarjetas.
  const [vueltas, setVueltas] = useState(0);
  // La portada que se está mostrando (tarjeta, desde dónde arranca el zoom y
  // un número para que cada entrada sea una portada nueva).
  const [portada, setPortada] = useState(null);
  const portadas = useRef(0);
  const terminarPortada = useCallback(() => setPortada(null), []);
  const bases = basesHabilitadas(permisos);
  // Solo se abre una base habilitada: si el permiso se fue, vuelven las tarjetas.
  const base = bases.find((una) => una.modo === abierta);
  const hayBaseAbierta = Boolean(base);

  useEffect(() => {
    if (!vueltas || hayBaseAbierta || !onTarjetas) return undefined;
    return onTarjetas();
  }, [vueltas, hayBaseAbierta]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegir = (elegida, desde) => {
    if (!bases.some((una) => una.modo === elegida.modo)) return;
    portadas.current += 1;
    setPortada({ tarjeta: elegida, desde, numero: portadas.current });
    setAbierta(elegida.modo);
  };

  const volverALasBases = () => {
    setAbierta(null);
    setVueltas((cuantas) => cuantas + 1);
  };

  const contenido = base ? (
    <base.Pantalla userId={userId} email={email} permisos={permisos} onVolver={volverALasBases} volverA="portal.basesTitulo" onCerrarSesion={onCerrarSesion} />
  ) : (
    <Tablero bases={bases} onElegir={elegir} onVolver={onVolver} />
  );

  // La portada de una base va encima de la de Bases de Datos, si esa todavía
  // se está yendo.
  return (
    <>
      {contenido}
      {portada && <Portada key={portada.numero} tarjeta={portada.tarjeta} desde={portada.desde} onTerminar={terminarPortada} className="portal-portada-encima" />}
    </>
  );
}
