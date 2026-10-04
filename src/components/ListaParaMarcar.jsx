import React from "react";
import { normalizarTextoBase } from "../domain/match";
import { t } from "../idioma/index.js";
import "./tablaDatos.css";

// Una lista para marcar varios valores, como el filtro de Excel: un buscador,
// Todos / Ninguno (sobre los que se ven con la búsqueda) y una casilla por
// valor, con cuántos hay de cada uno. La usan el filtro de las columnas de las
// bases y los filtros de los informes gráficos: se ven y se tocan igual.
//
// valores: [{ clave, texto, cantidad? }] (texto vacío: "(Vacías)")
// elegidos: las claves marcadas; onCambiar(elegidos) con las nuevas.
// busqueda / onBuscar(texto): lo escrito en el buscador.

export const valoresBuscados = (valores, busqueda) => {
  const buscado = normalizarTextoBase(busqueda || "");
  if (!buscado) return valores;
  return valores.filter((valor) => normalizarTextoBase(valor.texto || t("tabla.vacias")).includes(buscado));
};

export const ListaParaMarcar = ({ valores, elegidos, onCambiar, busqueda = "", onBuscar }) => {
  const visibles = valoresBuscados(valores, busqueda);
  const alternar = (clave) => onCambiar(elegidos.includes(clave) ? elegidos.filter((una) => una !== clave) : [...elegidos, clave]);
  const marcarLosVisibles = (prender) => {
    const claves = visibles.map((valor) => valor.clave);
    const resto = elegidos.filter((clave) => !claves.includes(clave));
    onCambiar(prender ? [...resto, ...claves] : resto);
  };
  return (
    <>
      <input
        type="search"
        className="tabla-datos-buscar-valor"
        value={busqueda}
        placeholder={t("tabla.buscarValor")}
        aria-label={t("tabla.buscarValor")}
        onChange={(evento) => onBuscar(evento.target.value)}
      />
      <div className="tabla-datos-todos">
        <button type="button" onClick={() => marcarLosVisibles(true)}>
          {t("tabla.todos")}
        </button>
        <button type="button" onClick={() => marcarLosVisibles(false)}>
          {t("tabla.ninguno")}
        </button>
      </div>
      <ul className="tabla-datos-valores">
        {visibles.length === 0 && <li className="tabla-datos-sin-valores">{t("tabla.nadaEnLista")}</li>}
        {visibles.map((valor) => (
          <li key={valor.clave || "__vacias"}>
            <label>
              <input type="checkbox" checked={elegidos.includes(valor.clave)} onChange={() => alternar(valor.clave)} />
              <span className={valor.texto ? "" : "vacias"}>{valor.texto || t("tabla.vacias")}</span>
              {valor.cantidad !== undefined && <small>{valor.cantidad}</small>}
            </label>
          </li>
        ))}
      </ul>
    </>
  );
};
