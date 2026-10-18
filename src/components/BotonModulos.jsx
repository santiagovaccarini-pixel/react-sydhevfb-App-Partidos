import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icono } from "./AppChrome";

// El botón para volver a los módulos (o a Bases de Datos), arriba a la
// izquierda del encabezado de cada módulo. Al bajar, cuando se va de la
// pantalla, aparece fijo arriba sobre el vidrio grafito de la barra de los
// reportes: siempre a la vista (Santiago, 18/10: «Tmb deja fijo los botones
// para volver a modulo»; UI-051). Sin bajar, se ve solo el del encabezado.
// La franja va a lo ancho del contenedor de la pantalla y se dibuja aparte
// (en el body) para que nada del encabezado la corra de lugar.
export default function BotonModulos({ onClick, children }) {
  const boton = useRef(null);
  // Dónde va la franja (el ancho del contenedor), o null mientras se ve el
  // botón del encabezado.
  const [lugar, setLugar] = useState(null);

  useEffect(() => {
    const elemento = boton.current;
    if (!elemento || typeof IntersectionObserver === "undefined") return undefined;
    let fuera = false;
    const medir = () => {
      const caja = (elemento.closest(".contenedor") || elemento.parentElement).getBoundingClientRect();
      return { left: caja.left, width: caja.width };
    };
    const observador = new IntersectionObserver(
      ([entrada]) => {
        // Apenas empieza a taparse por arriba (se bajó), no si todavía no se
        // llegó a él.
        fuera = entrada.intersectionRatio < 1 && entrada.boundingClientRect.top < 0;
        setLugar(fuera ? medir() : null);
      },
      { threshold: 1 },
    );
    observador.observe(elemento);
    const alCambiarElAncho = () => {
      if (fuera) setLugar(medir());
    };
    window.addEventListener("resize", alCambiarElAncho);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", alCambiarElAncho);
    };
  }, []);

  const contenido = (
    <>
      <Icono nombre="flecha" size={14} />
      {children}
    </>
  );

  return (
    <>
      <button ref={boton} type="button" className="boton-modulos" onClick={onClick}>
        {contenido}
      </button>
      {lugar &&
        createPortal(
          <div className="barra-modulos-fija" style={{ left: lugar.left, width: lugar.width }}>
            <button type="button" className="boton-modulos" onClick={onClick}>
              {contenido}
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
