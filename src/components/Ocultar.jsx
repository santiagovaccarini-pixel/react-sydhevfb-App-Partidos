import React, { useEffect, useState } from "react";
import { Icono } from "./AppChrome";
import { HojaConfirmar } from "./ConfirmSheet.js";
import { HojaInferior } from "./SheetPanel.js";
import { ListaParaMarcar } from "./ListaParaMarcar.jsx";
import { t, useIdioma } from "../idioma/index.js";
import "./ocultar.css";

// Ocultar columnas y filas a mano en las tablas de los reportes y de los
// valores de referencia (Santiago, 15/10: «EN TODO EL SOFT DE PODER OCULTAR
// MANUALMENTE UN COLUMNA Y FILAS SIN NECESIDAD DE ENTRAR A AJUSTES»; «Cuando
// toco un columna o fila en cierto lugar tiene que preguntarme si la quiero
// ocultar»), como en GPS › Informe: tocar el nombre de una columna (su
// cabecera) o de una fila pregunta si se oculta, y «Columnas» y «Filas»,
// arriba de la tabla, dicen cuántas hay ocultas y abren la lista para
// volver a mostrarlas. Solo dejan de verse (tampoco salen al imprimir): las
// cuentas, los promedios y los colores se calculan igual, con todo. Las
// columnas y las filas quedan ocultas mientras se está en esa pantalla: al
// salir, vuelven a verse (Santiago, nota del 16/10: «Hacer que las columnas
// que se oculten en las bases y/o filas sean temporales»; 17/10: «Hasta salir
// de esa base», «Bases e informes»). Las bases tienen lo suyo en TablaDatos
// (ahí tocar la cabecera fija y mueve la columna).

// Hasta el 17/10 las columnas ocultas quedaban guardadas en el aparato
// (`reporte_ocultas:<id>`): lo guardado se borra, así no vuelve.
const olvidar = (id) => {
  try {
    localStorage.removeItem(`reporte_ocultas:${id}`);
  } catch {
    // Sin localStorage no había nada guardado.
  }
};

// Lo oculto de una tabla (o de varias con las mismas columnas, como los
// V.R. de cada categoría). id: de qué tabla son las columnas guardadas.
export const useOcultar = (id) => {
  // Las de cada tabla, aparte: las de una no pisan las de otra.
  const [columnasDe, setColumnasDe] = useState({});
  const columnas = columnasDe[id] || [];
  useEffect(() => olvidar(id), [id]);
  const [filas, setFilas] = useState([]);
  // La pregunta ({ tipo: "columna" | "fila", claves, titulo }) y la lista
  // para volver a mostrar ({ tipo: "columnas" | "filas", valores, elegidos, busqueda }).
  const [pregunta, setPregunta] = useState(null);
  const [lista, setLista] = useState(null);

  const cambiarColumnas = (claves) => setColumnasDe((antes) => ({ ...antes, [id]: claves }));
  const ocultas = (tipo) => (tipo === "columnas" ? columnas : filas);
  // Las claves de la lista que no se marcaron quedan ocultas; las ocultas
  // que no están en la lista (de otra vista de la tabla), también.
  const aplicar = (tipo, valores, elegidos) => {
    const enLista = new Set(valores.map((valor) => valor.clave));
    const nuevas = [...ocultas(tipo).filter((clave) => !enLista.has(clave)), ...valores.map((valor) => valor.clave).filter((clave) => !elegidos.includes(clave))];
    if (tipo === "columnas") cambiarColumnas(nuevas);
    else setFilas(nuevas);
  };

  return {
    columnaOculta: (clave) => columnas.includes(clave),
    filaOculta: (clave) => filas.includes(clave),
    // Cuántas de estas (las de la tabla que se ve) están ocultas.
    cuantas: (tipo, valores) => valores.filter((valor) => ocultas(tipo).includes(valor.clave)).length,
    preguntar: setPregunta,
    pregunta,
    confirmar: () => {
      const actual = pregunta;
      setPregunta(null);
      if (!actual) return;
      if (actual.tipo === "columna") cambiarColumnas([...columnas.filter((clave) => !actual.claves.includes(clave)), ...actual.claves]);
      else setFilas((antes) => [...antes.filter((clave) => !actual.claves.includes(clave)), ...actual.claves]);
    },
    cancelar: () => setPregunta(null),
    abrirLista: (tipo, valores) => setLista({ tipo, valores, elegidos: valores.map((valor) => valor.clave).filter((clave) => !ocultas(tipo).includes(clave)), busqueda: "" }),
    lista,
    cambiarLista: (cambios) => setLista((actual) => (actual ? { ...actual, ...cambios } : actual)),
    cerrarLista: () => setLista(null),
    aplicarLista: () => {
      const actual = lista;
      setLista(null);
      if (actual) aplicar(actual.tipo, actual.valores, actual.elegidos);
    },
  };
};

// El nombre de una columna o de una fila: tocarlo pregunta si se oculta.
// claves: lo que se oculta (una fila del informe puede ir con la de abajo);
// titulo: cómo se nombra en la pregunta. Con icono, en vez del nombre va el
// ojo tachado (donde el nombre ya es otra cosa, como un desplegable).
export const TocarParaOcultar = ({ ocultar, tipo, clave, claves = null, titulo, icono = false, children = null }) => {
  const ayuda = t(tipo === "fila" ? "tabla.tocarParaOcultarFila" : "tabla.tocarParaOcultar");
  return (
    <button
      type="button"
      className={icono ? "ocultar-al-tocar ocultar-icono no-imprimir" : "ocultar-al-tocar"}
      onClick={() => ocultar.preguntar({ tipo, claves: claves || [clave], titulo })}
      title={icono ? ayuda : `${titulo}\n${ayuda}`}
      aria-label={icono ? `${ayuda}: ${titulo}` : undefined}
      aria-haspopup="dialog"
    >
      {icono ? <Icono nombre="ocultar" size={15} /> : children}
    </button>
  );
};

// Arriba de la tabla: «Columnas» y «Filas», con cuántas hay ocultas (en
// ámbar) o «Todas». columnas y filas: [{ clave, texto }], todas las de la
// tabla (sin ninguna, ese botón no va).
export const OcultasArriba = ({ ocultar, columnas = [], filas = [] }) => {
  const { plural } = useIdioma();
  const botones = [
    ["columnas", columnas],
    ["filas", filas],
  ].filter(([, valores]) => valores.length > 0);
  if (!botones.length) return null;
  return (
    <div className="ocultar-arriba no-imprimir">
      {botones.map(([tipo, valores]) => {
        const cuantas = ocultar.cuantas(tipo, valores);
        return (
          <button key={tipo} type="button" className={`selector-hoja ocultar-ver ${cuantas ? "con-ocultas" : ""}`.trim()} onClick={() => ocultar.abrirLista(tipo, valores)}>
            <span>{t(`tabla.ocultas.${tipo}`)}</span>
            <b>{cuantas ? plural("tabla.ocultas.cuantas", cuantas) : t("tabla.ocultas.todas")}</b>
            <Icono nombre="flecha" size={15} />
          </button>
        );
      })}
    </div>
  );
};

// La pregunta antes de ocultar y la lista con casillas para volver a
// mostrar (de columnas, al menos una queda a la vista).
export const HojasDeOcultar = ({ ocultar }) => {
  const { pregunta, lista } = ocultar;
  return (
    <>
      <HojaConfirmar
        abierta={Boolean(pregunta)}
        icono="ocultar"
        titulo={pregunta ? t("tabla.ocultarTitulo", { nombre: pregunta.titulo }) : ""}
        descripcion={pregunta ? t(pregunta.tipo === "fila" ? "tabla.ocultarFilaReporte" : "tabla.ocultarColumnaReporte") : ""}
        etiquetaConfirmar={t("tabla.ocultar")}
        etiquetaCancelar={t("comun.cancelar")}
        onConfirmar={ocultar.confirmar}
        onCancelar={ocultar.cancelar}
      />
      <HojaInferior
        abierta={Boolean(lista)}
        className="tabla-datos-hoja-filtro"
        titulo={lista ? t(lista.tipo === "columnas" ? "tabla.columnasAVista" : "tabla.filasAVista") : ""}
        onCerrar={ocultar.cerrarLista}
        acciones={
          <>
            <button type="button" className="boton-cancelar-hoja" onClick={ocultar.cerrarLista}>
              {t("comun.cancelar")}
            </button>
            <button type="button" className="boton-confirmar-hoja" onClick={ocultar.aplicarLista} disabled={Boolean(lista && lista.tipo === "columnas" && !lista.elegidos.length)}>
              {t("comun.listo")}
            </button>
          </>
        }
      >
        {lista && (
          <div className="tabla-datos-filtro-cuerpo">
            <ListaParaMarcar
              valores={lista.valores}
              elegidos={lista.elegidos}
              onCambiar={(elegidos) => ocultar.cambiarLista({ elegidos })}
              busqueda={lista.busqueda}
              onBuscar={(busqueda) => ocultar.cambiarLista({ busqueda })}
            />
          </div>
        )}
      </HojaInferior>
    </>
  );
};
