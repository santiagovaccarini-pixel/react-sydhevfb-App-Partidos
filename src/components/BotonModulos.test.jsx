import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import BotonModulos from "./BotonModulos.jsx";

// El botón para volver a los módulos: al bajar, cuando el del encabezado
// empieza a taparse por arriba, el mismo botón queda fijo arriba (Santiago,
// 18/10: «Tmb deja fijo los botones para volver a modulo»).
describe("BotonModulos", () => {
  let contenedor;
  let raiz;
  let avisar;
  const IntersectionObserverOriginal = globalThis.IntersectionObserver;

  beforeEach(() => {
    contenedor = document.createElement("div");
    contenedor.className = "contenedor";
    document.body.appendChild(contenedor);
    // El navegador de las pruebas no lo trae: uno de mentira que avisa
    // cuando se le dice.
    globalThis.IntersectionObserver = class {
      constructor(callback) {
        avisar = (entrada) => callback([entrada]);
      }
      observe() {}
      disconnect() {}
    };
  });
  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    globalThis.IntersectionObserver = IntersectionObserverOriginal;
  });

  const montar = async (onClick) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<BotonModulos onClick={onClick}>Bases de Datos</BotonModulos>);
    });
  };
  const fija = () => document.body.querySelector(".barra-modulos-fija");

  test("sin bajar, solo el del encabezado; al bajar, también fijo arriba; al volver, se va", async () => {
    const onClick = vi.fn();
    await montar(onClick);
    expect(contenedor.querySelectorAll(".boton-modulos")).toHaveLength(1);
    expect(contenedor.querySelector(".boton-modulos").textContent).toBe("Bases de Datos");
    expect(fija()).toBeNull();

    // Todavía no se llegó (está abajo): nada.
    await act(async () => avisar({ intersectionRatio: 0, boundingClientRect: { top: 900 } }));
    expect(fija()).toBeNull();

    // Se bajó y empezó a taparse por arriba: la franja, con el mismo botón.
    await act(async () => avisar({ intersectionRatio: 0.5, boundingClientRect: { top: -20 } }));
    expect(fija()).not.toBeNull();
    expect(fija().textContent).toBe("Bases de Datos");
    await act(async () => fija().querySelector("button").click());
    expect(onClick).toHaveBeenCalledTimes(1);

    // Se volvió a ver entero: la franja se va.
    await act(async () => avisar({ intersectionRatio: 1, boundingClientRect: { top: 20 } }));
    expect(fija()).toBeNull();
  });

  test("sin IntersectionObserver, el botón de siempre", async () => {
    globalThis.IntersectionObserver = undefined;
    const onClick = vi.fn();
    await montar(onClick);
    await act(async () => contenedor.querySelector(".boton-modulos").click());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(fija()).toBeNull();
  });
});
