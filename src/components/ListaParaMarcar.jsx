import React from "react";
import { HojaInferior } from "./SheetPanel.js";
import { normalizarTextoBase } from "../domain/match";
import { t } from "../idioma/index.js";
import "./tablaDatos.css";

// Una lista para marcar varios valores, como el filtro de Excel: un buscador,
// Todos / Ninguno (sobre los que se ven con la búsqueda) y una casilla por
// valor, con cuántos hay de cada uno. La usan el filtro de las columnas de las
// bases y los filtros de los informes gráficos: se ven y se tocan igual.
//
// valores: [{ clave, texto, cantidad? }] (texto vacío: el que no tiene dato,
// que se lee textoVacio: "(Vacías)" en las bases)
// elegidos: las claves marcadas; onCambiar(elegidos) con las nuevas.
// busqueda / onBuscar(texto): lo escrito en el buscador.

export const valoresBuscados = (valores, busqueda, textoVacio = t("tabla.vacias")) => {
  const buscado = normalizarTextoBase(busqueda || "");
  if (!buscado) return valores;
  return valores.filter((valor) => normalizarTextoBase(valor.texto || textoVacio).includes(buscado));
};

export const ListaParaMarcar = ({ valores, elegidos, onCambiar, busqueda = "", onBuscar, textoVacio = t("tabla.vacias") }) => {
  const visibles = valoresBuscados(valores, busqueda, textoVacio);
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
              <span className={valor.texto ? "" : "vacias"}>{valor.texto || textoVacio}</span>
              {valor.cantidad !== undefined && <small>{valor.cantidad}</small>}
            </label>
          </li>
        ))}
      </ul>
    </>
  );
};

// Al abrir un filtro: lo ya elegido o, sin filtro, todo lo que se ofrece.
export const elegidosAlAbrir = (ya, valores) => (ya && ya.length ? [...ya] : valores.map((valor) => valor.clave));

// La hoja de un filtro (la de las columnas de las bases y la de los informes
// gráficos): el título, la lista para marcar y Quitar filtro / Aplicar. Aplicar
// no se puede sin nada marcado de lo que se ofrece, y con todo marcado el
// filtro se quita: onAplicar(null). Si no, onAplicar(marcados).
// children: lo que va arriba de la lista (en las bases, el orden).
export const HojaDeFiltro = ({ abierta, columna, className = "", valores, elegidos, busqueda, onCambiar, onBuscar, onAplicar, onQuitar, onCerrar, textoVacio, children = null }) => {
  const hayAlguno = elegidos.some((clave) => valores.some((valor) => valor.clave === clave));
  const aplicar = () => {
    const marcados = valores.map((valor) => valor.clave).filter((clave) => elegidos.includes(clave));
    onAplicar(marcados.length === valores.length ? null : marcados);
  };
  return (
    <HojaInferior
      abierta={abierta}
      className={`tabla-datos-hoja-filtro ${className}`.trim()}
      titulo={abierta ? t("tabla.filtroTitulo", { columna }) : ""}
      onCerrar={onCerrar}
      acciones={
        <>
          <button type="button" className="boton-cancelar-hoja" onClick={onQuitar}>
            {t("tabla.quitarFiltro")}
          </button>
          <button type="button" className="boton-confirmar-hoja" onClick={aplicar} disabled={!hayAlguno}>
            {t("tabla.aplicar")}
          </button>
        </>
      }
    >
      {abierta && (
        <div className="tabla-datos-filtro-cuerpo">
          {children}
          <ListaParaMarcar valores={valores} elegidos={elegidos} onCambiar={onCambiar} busqueda={busqueda} onBuscar={onBuscar} textoVacio={textoVacio} />
        </div>
      )}
    </HojaInferior>
  );
};
