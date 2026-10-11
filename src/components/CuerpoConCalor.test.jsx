import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CuerpoConCalor, colorDeCalor, partirDespuesDeBarras } from "./CuerpoConCalor.jsx";
import { manchasDe } from "./manchasCuerpo.js";
import { crearMapa } from "../domain/mapaCorporal.js";

// El mapa corporal: las dos vistas y lo lesionado pintado, nada más
// (Santiago, 11/10: sin nombres, líneas ni puntos).
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
  const mapa = crearMapa();
  const lesion = (datos, id) => ({ id, datos });

  test("se pinta lo lesionado, recortado a la parte, y nada más: ni nombres, ni líneas, ni puntos", async () => {
    const manchas = manchasDe(
      [
        lesion({ parte_cuerpo: "coxa", lado: "direito", musculo_especifico: "biceps_femoral_longa" }, "1"),
        lesion({ parte_cuerpo: "coxa", lado: "direito", musculo_especifico: "biceps_femoral_longa" }, "2"),
        lesion({ parte_cuerpo: "joelho", lado: "direito" }, "3"),
      ],
      mapa,
    );
    await montar({ manchas });
    const primero = contenedor.querySelector("svg");
    const espalda = primero.querySelector('[data-vista="espalda"]');
    const [biceps] = espalda.querySelectorAll(".cuerpo-calor-mancha");
    expect(biceps.getAttribute("data-cantidad")).toBe("2");
    // El músculo (su forma), adentro de la parte lesionada (el muslo).
    expect(biceps.querySelectorAll("path").length).toBeGreaterThan(0);
    const recorte = biceps.getAttribute("clip-path").match(/url\(#(.+)\)/)[1];
    expect(document.getElementById(recorte).tagName.toLowerCase()).toBe("clippath");
    expect(biceps.querySelector("title").textContent).toBe("biceps_femoral_longa ×2");
    // La rodilla, de frente: la parte entera.
    expect(primero.querySelectorAll('[data-vista="frente"] .cuerpo-calor-mancha')).toHaveLength(1);
    // Nada más que las manchas y el nombre de cada vista.
    expect([...primero.querySelectorAll("text")].map((texto) => texto.textContent)).toEqual(["Anterior", "Posterior"]);
    expect(primero.querySelectorAll("line, circle")).toHaveLength(0);
    // Lo que se lee sin ver el mapa.
    expect(primero.getAttribute("aria-label")).toBe("Mapa: joelho, biceps_femoral_longa ×2");
    // Cada mapa con sus propios recortes y filtros.
    const ids = [...contenedor.querySelectorAll("[id]")].map((elemento) => elemento.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("más lesiones, color más intenso: de amarillo (una) a rojo oscuro (el lugar con más)", () => {
    expect(colorDeCalor(1, 1)).toBe("rgb(250, 204, 21)");
    expect(colorDeCalor(4, 4)).toBe("rgb(127, 29, 29)");
    expect(colorDeCalor(2, 2)).toBe("rgb(249, 115, 22)");
    // Con muchas lesiones, la escala llega hasta el lugar con más.
    expect(colorDeCalor(12, 12)).toBe("rgb(127, 29, 29)");
    expect(colorDeCalor(1, 12)).toBe("rgb(250, 204, 21)");
    const rojo = (color) => Number(color.match(/\d+/)[0]);
    const verde = (color) => Number(color.match(/\d+/g)[1]);
    expect(verde(colorDeCalor(6, 12))).toBeLessThan(verde(colorDeCalor(3, 12)));
    expect(rojo(colorDeCalor(3, 3))).toBeGreaterThan(rojo(colorDeCalor(2, 3)) - 40);
  });

  test("en el tronco sin músculo, la mitad del lado del jugador", async () => {
    const manchas = manchasDe([lesion({ parte_cuerpo: "abdomen", lado: "esquerdo" }, "1")], mapa);
    expect(manchas.frente[0].pintar).toMatchObject({ mitad: "derecha" });
    await montar({ manchas });
    const mancha = contenedor.querySelector('[data-vista="frente"] .cuerpo-calor-mancha');
    const mitad = mancha.querySelector("g[clip-path]").getAttribute("clip-path").match(/url\(#(.+)\)/)[1];
    const rect = document.getElementById(mitad).querySelector("rect");
    expect(Number(rect.getAttribute("x"))).toBe(100);
  });

  test("partir después de cada barra da lo mismo que la expresión con lookbehind que había antes", () => {
    // La de antes se arma acá (en Node anda); en la app no puede estar.
    const conLookbehind = new RegExp("(?<=\\/)");
    ["", "A", "/", "//", "A/", "/A", "A/B", "A//B", "ENTORSE/LESÃO LIGAMENTAR", "QUADRIL/VIRILHA/", "TORNOZELO/PÉ", "a / b"].forEach((texto) => {
      expect(partirDespuesDeBarras(texto), texto).toEqual(texto.split(conLookbehind));
    });
  });
});
