import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { HojasDeOcultar, OcultasArriba, useOcultar } from "./Ocultar.jsx";
import { TablaDeReferencia } from "./TablaDeReferencia.jsx";
import { fijarIdiomaParaPruebas } from "../idioma/index.js";

// Santiago, 15/10: «EN TODO EL SOFT DE PODER OCULTAR MANUALMENTE UN COLUMNA Y
// FILAS SIN NECESIDAD DE ENTRAR A AJUSTES»; «Cuando toco un columna o fila en
// cierto lugar tiene que preguntarme si la quiero ocultar».
const COLUMNAS = [
  { clave: "a", titulo: "Salto" },
  { clave: "b", titulo: "Carrera" },
];
const FILAS = [
  { clave: "bueno", titulo: "Bueno" },
  { clave: "malo", titulo: "Malo" },
];

// Dos tablas con el mismo «ocultar», como los V.R. de cada categoría.
const DosTablas = ({ id = "prueba" }) => {
  const ocultar = useOcultar(id);
  const tabla = (
    <TablaDeReferencia ocultar={ocultar} columnas={COLUMNAS} filas={FILAS} texto={(fila, columna) => `${fila.clave}-${columna.clave}`} interpretar={() => undefined} />
  );
  return (
    <>
      <OcultasArriba ocultar={ocultar} columnas={COLUMNAS.map(({ clave, titulo }) => ({ clave, texto: titulo }))} filas={FILAS.map(({ clave, titulo }) => ({ clave, texto: titulo }))} />
      <div className="una">{tabla}</div>
      <div className="otra">{tabla}</div>
      <HojasDeOcultar ocultar={ocultar} />
    </>
  );
};

describe("ocultar columnas y filas en los reportes y los V.R.", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    localStorage.clear();
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    contenedor.remove();
  });

  const montar = (id) => act(async () => raiz.render(<DosTablas id={id} />));
  const tocar = async (elemento) => {
    if (!elemento) throw new Error("no está");
    await act(async () => elemento.click());
  };
  const cabeceras = (donde) => [...contenedor.querySelectorAll(`.${donde} thead th`)].map((th) => th.textContent).filter(Boolean);
  const filas = (donde) => [...contenedor.querySelectorAll(`.${donde} tbody th`)].map((th) => th.textContent);
  const pregunta = () => document.body.querySelector(".hoja-confirmar h3")?.textContent;
  const confirmar = () => tocar(document.body.querySelector(".hoja-confirmar .boton-confirmar-hoja"));
  const arriba = () => [...contenedor.querySelectorAll(".ocultar-arriba button")].map((boton) => boton.textContent);

  test("tocar el nombre pregunta antes; al confirmar, se va de todas las tablas que comparten «ocultar», con cada dato en su lugar", async () => {
    await montar();
    expect(arriba()).toEqual(["ColumnasTodas", "FilasTodas"]);
    await tocar(contenedor.querySelector(".una thead th .ocultar-al-tocar"));
    expect(pregunta()).toBe("¿Ocultar «Salto»?");
    expect(document.body.querySelector(".hoja-confirmar p").textContent).toContain("No se borra nada");
    await tocar(document.body.querySelector(".hoja-confirmar .boton-cancelar-hoja"));
    expect(cabeceras("una")).toEqual(["Salto", "Carrera"]);
    await tocar(contenedor.querySelector(".una thead th .ocultar-al-tocar"));
    await confirmar();
    expect(cabeceras("una")).toEqual(["Carrera"]);
    expect(cabeceras("otra")).toEqual(["Carrera"]);
    expect([...contenedor.querySelectorAll(".otra tbody td")].map((td) => td.textContent)).toEqual(["bueno-b", "malo-b"]);
    // Con una sola columna, su nombre ya no oculta (al menos una queda).
    expect(contenedor.querySelector(".una thead th .ocultar-al-tocar")).toBeNull();
    // Una fila, tocando su nombre.
    await tocar(contenedor.querySelectorAll(".otra tbody th .ocultar-al-tocar")[1]);
    expect(pregunta()).toBe("¿Ocultar «Malo»?");
    await confirmar();
    expect(filas("una")).toEqual(["Bueno"]);
    expect(filas("otra")).toEqual(["Bueno"]);
    expect(arriba()).toEqual(["Columnas1 oculta", "Filas1 oculta"]);
    // La columna queda guardada en el aparato; la fila, no.
    expect(JSON.parse(localStorage.getItem("reporte_ocultas:prueba"))).toEqual(["a"]);
    await act(async () => raiz.unmount());
    raiz = createRoot(contenedor);
    await montar();
    expect(cabeceras("una")).toEqual(["Carrera"]);
    expect(filas("una")).toEqual(["Bueno", "Malo"]);
  });

  test("«Columnas» y «Filas» abren la lista para volver a mostrar; sin ninguna columna marcada, «Listo» no se puede tocar", async () => {
    await montar();
    await tocar(contenedor.querySelectorAll(".una tbody th .ocultar-al-tocar")[0]);
    await confirmar();
    expect(filas("una")).toEqual(["Malo"]);
    const casilla = (texto) => [...document.body.querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent === texto).querySelector("input");
    const listo = () => [...document.body.querySelectorAll("button")].find((boton) => boton.textContent === "Listo");
    await tocar(contenedor.querySelectorAll(".ocultar-arriba button")[1]);
    expect(document.body.textContent).toContain("Filas a la vista");
    expect(casilla("Bueno").checked).toBe(false);
    await tocar(casilla("Bueno"));
    await tocar(listo());
    expect(filas("una")).toEqual(["Bueno", "Malo"]);
    await tocar(contenedor.querySelectorAll(".ocultar-arriba button")[0]);
    await tocar(casilla("Salto"));
    await tocar(casilla("Carrera"));
    expect(listo().disabled).toBe(true);
    await tocar(casilla("Carrera"));
    await tocar(listo());
    expect(cabeceras("una")).toEqual(["Carrera"]);
  });

  test("lo de una tabla no pisa lo de otra: al cambiar de tabla (otro id) se lee lo suyo", async () => {
    await montar("uno");
    await tocar(contenedor.querySelector(".una thead th .ocultar-al-tocar"));
    await confirmar();
    expect(cabeceras("una")).toEqual(["Carrera"]);
    await montar("dos");
    expect(cabeceras("una")).toEqual(["Salto", "Carrera"]);
    expect(localStorage.getItem("reporte_ocultas:dos")).toBeNull();
    expect(JSON.parse(localStorage.getItem("reporte_ocultas:uno"))).toEqual(["a"]);
    await montar("uno");
    expect(cabeceras("una")).toEqual(["Carrera"]);
  });
});
