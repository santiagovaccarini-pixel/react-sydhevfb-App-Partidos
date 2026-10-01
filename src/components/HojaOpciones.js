import React, { useEffect, useMemo, useState } from "react";
import { normalizarTextoBase as normalizarTexto } from "../domain/match";
import { t } from "../idioma/index.js";

/**
 * Hoja que sube desde abajo para elegir una opción de una lista. Es la misma
 * forma que la hoja de confirmar, y ocupa el lugar que antes ocupaba el
 * desplegable del sistema: las opciones aparecen sobre la pantalla, grandes y
 * al alcance del pulgar, sin tener que abrir nada más.
 *
 * Con muchas opciones (más de ocho, o si se pide), arriba hay un buscador que
 * acerca lo escrito: primero las que empiezan así, después las que lo
 * contienen, como el buscador de nombres de Partido. La lista se desplaza
 * adentro de la hoja, que nunca es más alta que la pantalla.
 */
export const HojaOpciones = ({
  abierta,
  titulo,
  opciones = [],
  elegida,
  onElegir,
  onCerrar,
  buscador,
}) => {
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (abierta) setBusqueda("");
  }, [abierta]);

  useEffect(() => {
    if (!abierta) return undefined;

    const alPresionar = (evento) => {
      if (evento.key === "Escape") onCerrar();
    };

    const desbordeOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alPresionar);

    return () => {
      document.body.style.overflow = desbordeOriginal;
      window.removeEventListener("keydown", alPresionar);
    };
  }, [abierta, onCerrar]);

  const conBuscador = buscador ?? opciones.length > 8;

  const visibles = useMemo(() => {
    const consulta = normalizarTexto(busqueda);
    if (!consulta) return opciones;

    const comienzan = [];
    const contienen = [];
    opciones.forEach((opcion) => {
      const texto = normalizarTexto(opcion.etiqueta);
      if (texto.startsWith(consulta)) comienzan.push(opcion);
      else if (texto.includes(consulta)) contienen.push(opcion);
    });
    return [...comienzan, ...contienen];
  }, [opciones, busqueda]);

  if (!abierta) return null;

  return (
    <div
      className="velo-dialogo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <div
        className="hoja-confirmar hoja-opciones"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className="tirador-hoja" />

        <h3>{titulo}</h3>

        {conBuscador && (
          <div className="buscador-hoja">
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder={t("comun.buscar", {}, "Escribir para buscar...")}
              aria-label={t("comun.buscar", {}, "Escribir para buscar...")}
              autoComplete="off"
            />
          </div>
        )}

        <div className="lista-opciones-hoja">
          {visibles.map(({ valor, etiqueta }) => (
            <button
              key={valor}
              type="button"
              className={`opcion-hoja ${valor === elegida ? "activa" : ""}`}
              aria-pressed={valor === elegida}
              onClick={() => onElegir(valor)}
            >
              {etiqueta}
            </button>
          ))}
          {visibles.length === 0 && (
            <p className="sin-resultados">{t("comun.sinCoincidencias", {}, "Sin coincidencias.")}</p>
          )}
        </div>

        <button
          type="button"
          className="boton-cancelar-hoja"
          onClick={onCerrar}
        >
          {t("comun.cancelar", {}, "Cancelar")}
        </button>
      </div>
    </div>
  );
};
