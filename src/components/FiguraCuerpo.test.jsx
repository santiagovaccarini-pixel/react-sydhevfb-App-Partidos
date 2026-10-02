import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { FiguraCuerpo } from "./FiguraCuerpo.jsx";

// Las zonas y las partes son dibujos (SVG): se tocan con un clic de verdad.
const tocar = (elemento) => act(async () => elemento.dispatchEvent(new MouseEvent("click", { bubbles: true })));

describe("la figura del cuerpo", () => {
  let contenedor;
  let raiz;
  let tocadas;

  beforeEach(() => {
    tocadas = [];
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    contenedor.remove();
  });

  const dibujar = (props) =>
    act(async () =>
      raiz.render(<FiguraCuerpo onRegion={(region) => tocadas.push(["region", region])} onParte={(parte, region) => tocadas.push(["parte", parte, region])} {...props} />),
    );
  const botones = (selector) => [...contenedor.querySelectorAll(`${selector}[role="button"]`)];

  test("entera, cada región es un botón; de espaldas, el lado derecho va a la derecha", async () => {
    await dibujar({});
    expect(botones("[data-region]").map((g) => g.dataset.region)).toEqual(["cabeza", "tronco", "brazo_derecho", "pierna_derecha", "brazo_izquierdo", "pierna_izquierda"]);
    expect(contenedor.querySelector('[data-region="pierna_derecha"]').getAttribute("transform")).toBe(null);
    expect(contenedor.querySelector('[data-region="pierna_izquierda"]').getAttribute("transform")).toBe("matrix(-1 0 0 1 200 0)");
    await tocar(contenedor.querySelector('[data-region="pierna_derecha"]'));
    expect(tocadas).toEqual([["region", "pierna_derecha"]]);
    await dibujar({ vista: "espalda" });
    expect(contenedor.querySelector('[data-region="pierna_derecha"]').getAttribute("transform")).toBe("matrix(-1 0 0 1 200 0)");
  });

  test("acercada a una región, se tocan sus partes (las que están a la vista)", async () => {
    await dibujar({ region: "pierna_izquierda", disponibles: ["quadril_virilha", "coxa", "perna_aquiles", "tornozelo_pe", "pe_dedo"], elegida: { parte: "coxa", region: "pierna_izquierda" } });
    expect(botones("[data-region]")).toHaveLength(0);
    expect(botones("[data-parte]").map((g) => g.dataset.parte)).toEqual(["quadril_virilha", "coxa", "perna_aquiles", "tornozelo_pe", "pe_dedo"]);
    expect(contenedor.querySelector('[data-parte="coxa"]').getAttribute("aria-pressed")).toBe("true");
    // La rodilla no está a la vista en el club: se ve apagada y no se toca.
    expect(contenedor.querySelector('[data-region="pierna_izquierda"] .figura-cuerpo-pieza.sin-opcion')).toBeTruthy();
    await tocar(contenedor.querySelector('[data-parte="perna_aquiles"]'));
    expect(tocadas).toEqual([["parte", "perna_aquiles", "pierna_izquierda"]]);
  });

  test("se pueden tocar solo las regiones que tienen algo para elegir", async () => {
    await dibujar({ regionesDisponibles: ["tronco", "cabeza"] });
    expect(botones("[data-region]").map((g) => g.dataset.region)).toEqual(["cabeza", "tronco"]);
  });

  test("chica, es solo para mirar: sin botones ni líneas, con la parte pintada", async () => {
    await dibujar({ chica: true, elegida: { parte: "joelho", region: "pierna_derecha" } });
    expect(contenedor.querySelectorAll('[role="button"]')).toHaveLength(0);
    expect(contenedor.querySelectorAll(".figura-cuerpo-detalle")).toHaveLength(0);
    expect(contenedor.querySelectorAll(".figura-cuerpo-pieza.elegida")).toHaveLength(1);
  });
});
