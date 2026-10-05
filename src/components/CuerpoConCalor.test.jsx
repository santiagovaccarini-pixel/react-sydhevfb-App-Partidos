import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CuerpoConCalor, partirDespuesDeBarras } from "./CuerpoConCalor.jsx";

// El mapa corporal: las dos vistas, una mancha por lugar y los nombres.
describe("CuerpoConCalor", () => {
  let contenedor;
  let raiz;
  beforeEach(() => {
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });
  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
  });
  const montar = async (props) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(
        <>
          <CuerpoConCalor vistas={{ frente: "Anterior", espalda: "Posterior" }} titulo="Mapa" nombreDe={(mancha) => mancha.codigo} {...props} />
          <CuerpoConCalor vistas={{ frente: "Anterior", espalda: "Posterior" }} titulo="Otro" nombreDe={(mancha) => mancha.codigo} manchas={{ frente: [], espalda: [] }} />
        </>,
      );
    });
  };
  // El texto de un nombre, renglón por renglón.
  const renglones = (nombre) => [...nombre.querySelectorAll("text")].map((texto) => texto.textContent).join(" ");
  const mancha = (clave, x, y, cantidad = 1, codigo = clave) => ({ clave, x, y, cantidad, codigo, campo: "musculo_especifico" });

  test("una mancha por lugar (más grande cuantas más lesiones) y su nombre, con una línea", async () => {
    await montar({ manchas: { frente: [mancha("a", 90, 240, 3, "adutor_longo"), mancha("b", 110, 320)], espalda: [mancha("c", 120, 270, 1, "adutor_longo")] } });
    const primero = contenedor.querySelector("svg");
    const frente = primero.querySelector('[data-vista="frente"]');
    const radios = [...frente.querySelectorAll(".cuerpo-calor-mancha")].map((circulo) => Number(circulo.getAttribute("r")));
    expect(radios[0]).toBeGreaterThan(radios[1]);
    expect([...frente.querySelectorAll(".cuerpo-calor-nombre")].map(renglones)).toEqual(["ADUTOR_LONGO ×3", "B"]);
    expect(frente.querySelectorAll(".cuerpo-calor-nombre line")).toHaveLength(2);
    expect(primero.querySelectorAll('[data-vista="espalda"] .cuerpo-calor-nombre')).toHaveLength(1);
    expect([...primero.querySelectorAll(".cuerpo-calor-vista text")].map((texto) => texto.textContent)).toEqual(["Anterior", "Posterior"]);
    // Cada mapa con sus propios recortes y degradés.
    const ids = [...contenedor.querySelectorAll("[id]")].map((elemento) => elemento.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("los nombres no se pisan y los largos se angostan para entrar", async () => {
    await montar({
      manchas: {
        frente: [mancha("a", 90, 250, 1, "uno"), mancha("b", 92, 252, 1, "dos"), mancha("c", 94, 254, 1, "tres")],
        espalda: [],
      },
    });
    const textos = [...contenedor.querySelector('[data-vista="frente"]').querySelectorAll(".cuerpo-calor-nombre text")];
    const alturas = textos.map((texto) => Number(texto.getAttribute("y")));
    alturas.slice(1).forEach((altura, i) => expect(altura - alturas[i]).toBeGreaterThanOrEqual(14));
    expect(textos.some((texto) => texto.getAttribute("textLength"))).toBe(false);
    await act(async () => raiz.unmount());
    await montar({ manchas: { frente: [mancha("a", 90, 250, 1, "ESTERNOCLEIDOMASTOIDEO")], espalda: [] } });
    expect(contenedor.querySelector('[data-vista="frente"] .cuerpo-calor-nombre text').getAttribute("lengthAdjust")).toBe("spacingAndGlyphs");
  });

  test("los nombres se parten después de una barra, y si son muchos no se salen por arriba", async () => {
    const muchas = Array.from({ length: 30 }, (_, i) => mancha(`m${i}`, 90, 20 + i, 30 - i, `nombre largo numero ${i}`));
    await montar({ manchas: { frente: [mancha("q", 90, 220, 1, "QUADRIL/VIRILHA")], espalda: muchas } });
    const frente = contenedor.querySelector('[data-vista="frente"]');
    expect([...frente.querySelectorAll(".cuerpo-calor-nombre text")].map((texto) => texto.textContent)).toEqual(["QUADRIL/", "VIRILHA"]);
    const espalda = contenedor.querySelector('[data-vista="espalda"]');
    const alturas = [...espalda.querySelectorAll(".cuerpo-calor-nombre text")].map((texto) => Number(texto.getAttribute("y")));
    expect(alturas.length).toBeGreaterThan(5);
    expect(alturas.length).toBeLessThan(30);
    expect(Math.min(...alturas)).toBeGreaterThan(0);
    expect(Math.max(...alturas)).toBeLessThan(440);
    // Las 30 manchas se ven igual, aunque algunas queden sin nombre.
    expect(espalda.querySelectorAll(".cuerpo-calor-mancha")).toHaveLength(30);
  });

  test("como mucho maxNombres nombres por vista: las otras manchas, sin nombre", async () => {
    await montar({ maxNombres: 1, manchas: { frente: [mancha("a", 90, 250, 2), mancha("b", 110, 320)], espalda: [] } });
    const frente = contenedor.querySelector('[data-vista="frente"]');
    expect(frente.querySelectorAll(".cuerpo-calor-mancha")).toHaveLength(2);
    expect([...frente.querySelectorAll(".cuerpo-calor-nombre")].map(renglones)).toEqual(["A ×2"]);
  });

  test("partir después de cada barra da lo mismo que la expresión con lookbehind que había antes", () => {
    // La de antes se arma acá (en Node anda); en la app no puede estar.
    const conLookbehind = new RegExp("(?<=\\/)");
    ["", "A", "/", "//", "A/", "/A", "A/B", "A//B", "ENTORSE/LESÃO LIGAMENTAR", "QUADRIL/VIRILHA/", "TORNOZELO/PÉ", "a / b"].forEach((texto) => {
      expect(partirDespuesDeBarras(texto), texto).toEqual(texto.split(conLookbehind));
    });
  });
});
