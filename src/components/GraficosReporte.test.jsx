import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { BarrasApiladas, COLORES_DE_SERIE, COLOR_SIN_DATO, Columnas, Torta, arcosDeTorta, coloresDeSeries } from "./GraficosReporte.jsx";
import { OPCIONES } from "../domain/lesionesCampos.js";

describe("los gráficos de los informes", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    contenedor.remove();
  });

  const dibujar = (elemento) => act(async () => raiz.render(elemento));

  test("la torta: desde las 12 en el sentido del reloj; una sola porción es el círculo", () => {
    expect(arcosDeTorta([1, 1])).toEqual(["M90 90 L90 10 A80 80 0 0 1 90 170 Z", "M90 90 L90 170 A80 80 0 0 1 90 10 Z"]);
    const [chica, grande] = arcosDeTorta([1, 3]);
    expect(chica).toBe("M90 90 L90 10 A80 80 0 0 1 170 90 Z");
    expect(grande).toContain(" 0 1 1 ");
    expect(arcosDeTorta([5])).toEqual([null]);
    expect(arcosDeTorta([])).toEqual([]);
  });

  test("las columnas: sin valor no hay columna (dice —), un cero sí; con varias series, la leyenda", async () => {
    const formato = (valor) => (valor === null ? "—" : valor.toFixed(2).replace(".", ","));
    await dibujar(
      <Columnas
        titulo="Lesiones"
        formato={formato}
        series={[{ clave: "valor", etiqueta: "Lesiones", color: "#2a78d6" }]}
        filas={[
          { clave: "a", etiqueta: "A", valores: { valor: 20 } },
          { clave: "b", etiqueta: "B", valores: { valor: null } },
          { clave: "c", etiqueta: "C", valores: { valor: 0 } },
        ]}
      />,
    );
    expect([...contenedor.querySelectorAll(".reporte-columnas-valor")].map((valor) => valor.textContent)).toEqual(["20,00", "—", "0,00"]);
    const barras = [...contenedor.querySelectorAll(".reporte-columnas-barra")];
    expect(barras).toHaveLength(2);
    expect(barras[0].style.height).toBe("100%");
    expect(contenedor.querySelector(".reporte-leyenda")).toBeNull();

    await dibujar(
      <Columnas
        series={[
          { clave: "coxa", etiqueta: "Muslo", color: "#2a78d6" },
          { clave: "joelho", etiqueta: "Rodilla", color: "#eb6834" },
        ]}
        filas={[{ clave: "t", etiqueta: "Entrenamiento", valores: { coxa: 2, joelho: 1 } }]}
      />,
    );
    expect(contenedor.querySelector(".reporte-leyenda").textContent).toBe("MusloRodilla");
    await dibujar(<Columnas series={[]} filas={[]} vacio="Nada" />);
    expect(contenedor.querySelector(".vacio-ficha").textContent).toBe("Nada");
  });

  test("valores cada 1000 horas menores que 1 también se ven", async () => {
    await dibujar(
      <Columnas
        series={[{ clave: "valor", etiqueta: "x", color: "#2a78d6" }]}
        filas={[
          { clave: "a", etiqueta: "A", valores: { valor: 0.5 } },
          { clave: "b", etiqueta: "B", valores: { valor: 0.25 } },
        ]}
      />,
    );
    expect([...contenedor.querySelectorAll(".reporte-columnas-barra")].map((barra) => barra.style.height)).toEqual(["100%", "50%"]);
  });

  test("la torta con su leyenda, y las barras apiladas con el total", async () => {
    await dibujar(
      <Torta
        titulo="No traumática"
        porciones={[
          { clave: "coxa", etiqueta: "Muslo", valor: 1, porcentaje: 50, color: "#2a78d6" },
          { clave: "joelho", etiqueta: "Rodilla", valor: 1, porcentaje: 50, color: "#eb6834" },
        ]}
      />,
    );
    expect(contenedor.querySelectorAll("svg path")).toHaveLength(2);
    expect([...contenedor.querySelectorAll(".reporte-torta-leyenda li b")].map((b) => b.textContent)).toEqual(["50%", "50%"]);

    await dibujar(
      <BarrasApiladas
        series={[
          { clave: "coxa", etiqueta: "Muslo", color: "#2a78d6" },
          { clave: "joelho", etiqueta: "Rodilla", color: "#eb6834" },
        ]}
        filas={[{ clave: "j:7", etiqueta: "HULK", total: 3, valores: { coxa: 2, joelho: 1 } }]}
      />,
    );
    const tramos = [...contenedor.querySelectorAll(".reporte-apiladas-tramo")];
    expect(tramos.map((tramo) => [tramo.textContent, tramo.style.width])).toEqual([
      ["2", "66.66666666666666%"],
      ["1", "33.33333333333333%"],
    ]);
    expect(contenedor.querySelector(".reporte-barras b").textContent).toBe("3");
  });

  test("las columnas: todas en una grilla; cada una se lee entera; un valor vacío no se nombra", async () => {
    await dibujar(
      <Columnas
        titulo="2026"
        formato={(valor) => (valor ? String(valor) : "")}
        leyenda
        series={[
          { clave: "coxa", etiqueta: "Muslo", color: "#2a78d6" },
          { clave: "joelho", etiqueta: "Rodilla", color: "#eb6834" },
        ]}
        filas={[{ clave: "t", etiqueta: "Entrenamiento", detalle: "3 lesiones", valores: { coxa: null, joelho: 3 } }]}
      />,
    );
    const grafico = contenedor.querySelector(".reporte-columnas-grafico");
    expect(grafico.getAttribute("role")).toBe("group");
    expect(grafico.getAttribute("aria-label")).toBe("2026");
    // Las barras, el nombre y el detalle de cada columna van directo en la grilla.
    expect([...grafico.children].map((hijo) => hijo.className)).toEqual(["reporte-columnas-barras", "reporte-columnas-etiqueta", "reporte-columnas-detalle"]);
    const columna = grafico.querySelector(".reporte-columnas-barras");
    expect(columna.getAttribute("role")).toBe("img");
    expect(columna.getAttribute("aria-label")).toBe("Entrenamiento · Rodilla: 3 · 3 lesiones");
    expect(columna.title).toBe("Entrenamiento · Rodilla: 3 · 3 lesiones");
    // El número va dentro de su barra (arriba de ella): no le quita alto.
    expect(contenedor.querySelector(".reporte-columnas-barra .reporte-columnas-valor").textContent).toBe("3");
    expect(contenedor.querySelector(".reporte-columnas-barra").style.height).toBe("100%");
    // Una sola serie, con leyenda si se pide.
    await dibujar(<Columnas leyenda series={[{ clave: "coxa", etiqueta: "Muslo", color: "#2a78d6" }]} filas={[{ clave: "t", etiqueta: "T", valores: { coxa: 1 } }]} />);
    expect(contenedor.querySelector(".reporte-leyenda").textContent).toBe("Muslo");
  });

  test("las barras apiladas llevan leyenda aunque sea una sola parte", async () => {
    await dibujar(<BarrasApiladas series={[{ clave: "coxa", etiqueta: "Muslo", color: "#2a78d6" }]} filas={[{ clave: "j:7", etiqueta: "HULK", total: 2, valores: { coxa: 2 } }]} />);
    expect(contenedor.querySelector(".reporte-leyenda").textContent).toBe("Muslo");
  });

  test("los colores no se repiten: las 17 partes del catálogo y más", () => {
    const partes = OPCIONES.parte_cuerpo.map((opcion) => opcion.codigo);
    expect(partes.length).toBeGreaterThanOrEqual(17);
    const colorDe = coloresDeSeries(["", ...partes]);
    const deLasPartes = partes.map(colorDe);
    expect(new Set(deLasPartes).size).toBe(partes.length);
    expect(deLasPartes).not.toContain(COLOR_SIN_DATO);
    const muchas = Array.from({ length: 40 }, (_, i) => `parte${i}`);
    const colorDeMuchas = coloresDeSeries(muchas);
    expect(new Set(muchas.map(colorDeMuchas)).size).toBe(40);
  });

  test("los colores: uno por clave, en el orden en que llegan; Sin dato en gris; después de los ocho, otros", () => {
    const colorDe = coloresDeSeries(["coxa", "", "joelho", ...Array.from({ length: 8 }, (_, i) => `parte${i}`)]);
    expect(colorDe("coxa")).toBe(COLORES_DE_SERIE[0]);
    expect(colorDe("joelho")).toBe(COLORES_DE_SERIE[1]);
    expect(colorDe("")).toBe(COLOR_SIN_DATO);
    // La novena parte no repite el color de la primera.
    expect(colorDe("parte6")).not.toBe(COLORES_DE_SERIE[0]);
    const todos = ["coxa", "joelho", ...Array.from({ length: 8 }, (_, i) => `parte${i}`)].map(colorDe);
    expect(new Set(todos).size).toBe(todos.length);
  });
});
