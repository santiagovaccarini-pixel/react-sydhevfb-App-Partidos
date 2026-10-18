import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MarcoAplicacion } from "./AppChrome";
import { fijarIdiomaParaPruebas } from "../idioma/index.js";

// Las barras se esconden para dejar más lugar (Santiago, 18/10, en un
// cuestionario: «Achicar a íconos», «Se va al bajar», «En toda la app»).
const DESTINOS = [
  { id: "base", etiqueta: "Base", icono: "registros" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "ajustes" },
];

describe("MarcoAplicacion: esconder las barras", () => {
  let contenedor;
  let raiz;
  let esCelular;
  const matchMediaOriginal = window.matchMedia;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    window.localStorage.clear();
    esCelular = true;
    window.matchMedia = vi.fn(() => ({ get matches() { return esCelular; } }));
    window.scrollY = 0;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });
  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    window.matchMedia = matchMediaOriginal;
    window.scrollY = 0;
  });

  const montar = async (activo = "base") => {
    await act(async () => {
      raiz = raiz || createRoot(contenedor);
      raiz.render(
        <MarcoAplicacion activo={activo} destinos={DESTINOS} onNavigate={() => {}} marca="Lesiones">
          <p>Contenido</p>
        </MarcoAplicacion>,
      );
    });
  };
  const marco = () => contenedor.querySelector(".marco-aplicacion");
  const bajarA = async (y) => {
    window.scrollY = y;
    await act(async () => window.dispatchEvent(new Event("scroll")));
  };

  test("en la compu, el botón achica la barra lateral a íconos, la abre y el aparato lo recuerda", async () => {
    await montar();
    const boton = contenedor.querySelector(".barra-lateral-cambiar");
    expect(boton.getAttribute("aria-label")).toBe("Achicar la barra");
    expect(boton.getAttribute("aria-expanded")).toBe("true");
    expect(marco().classList.contains("barra-achicada")).toBe(false);

    const medir = vi.fn();
    window.addEventListener("resize", medir);
    await act(async () => boton.click());
    window.removeEventListener("resize", medir);
    expect(marco().classList.contains("barra-achicada")).toBe(true);
    expect(boton.getAttribute("aria-label")).toBe("Abrir la barra");
    expect(boton.getAttribute("aria-expanded")).toBe("false");
    // Achicada, cada solapa conserva su nombre para quien no ve el texto.
    expect([...contenedor.querySelectorAll(".navegacion-escritorio nav button")].map((b) => b.getAttribute("aria-label"))).toEqual(["Base", "Ajustes"]);
    // Lo que se ubica según el ancho se vuelve a medir.
    expect(medir).toHaveBeenCalled();

    // Al volver a entrar, sigue achicada.
    await act(async () => raiz.unmount());
    raiz = null;
    await montar();
    expect(marco().classList.contains("barra-achicada")).toBe(true);
    await act(async () => contenedor.querySelector(".barra-lateral-cambiar").click());
    expect(marco().classList.contains("barra-achicada")).toBe(false);
    expect(window.localStorage.getItem("barra_lateral_achicada")).toBeNull();
  });

  test("en el celular, la barra de abajo se va al bajar, vuelve al subir y al cambiar de solapa", async () => {
    await montar();
    // Un poquito no alcanza.
    await bajarA(40);
    expect(marco().classList.contains("barra-abajo-escondida")).toBe(false);
    await bajarA(300);
    expect(marco().classList.contains("barra-abajo-escondida")).toBe(true);
    // Apenas se sube, vuelve.
    await bajarA(280);
    expect(marco().classList.contains("barra-abajo-escondida")).toBe(false);
    await bajarA(600);
    expect(marco().classList.contains("barra-abajo-escondida")).toBe(true);
    // En otra solapa, se ve.
    await montar("ajustes");
    expect(marco().classList.contains("barra-abajo-escondida")).toBe(false);
  });

  test("en la compu, bajar no esconde nada", async () => {
    esCelular = false;
    await montar();
    await bajarA(300);
    await bajarA(900);
    expect(marco().classList.contains("barra-abajo-escondida")).toBe(false);
  });
});
