import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import PortalApp, { TIEMPOS_PORTADA } from "./PortalApp.jsx";

// El equipo elegido, cambiable por prueba (vi.mock se iza: va con hoisted).
const equipo = vi.hoisted(() => ({ actual: { id: "eq-1", nombre: "Atlético Mineiro" } }));

vi.mock("./App", () => ({
  default: ({ intro }) => <div className="partido-de-prueba">Partido de prueba {intro === false ? "sin intro" : "con intro"}</div>,
}));
vi.mock("./TrainingModule", () => ({ default: () => <div className="flujo-de-prueba">Flujo de prueba</div> }));
vi.mock("./TrainingAccessGate", () => ({
  default: ({ children }) => <div className="acceso-de-prueba">{children({ email: "dt@club.com", cerrarSesion: () => {} })}</div>,
}));
vi.mock("./domain/equipo.js", () => ({ leerEquipoElegido: () => equipo.actual }));

describe("el portal", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    vi.useFakeTimers();
    equipo.actual = { id: "eq-1", nombre: "Atlético Mineiro" };
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    window.history.replaceState({}, "", "/");
    vi.useRealTimers();
  });

  const montar = async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<PortalApp />);
    });
  };

  const tocar = async (etiqueta) => {
    await act(async () => contenedor.querySelector(`button[aria-label="${etiqueta}"]`).click());
  };

  const portada = () => contenedor.querySelector(".portal-portada");

  test("muestra las dos tarjetas y el equipo elegido", async () => {
    await montar();

    expect(contenedor.querySelector(".portal-kicker").textContent).toBe("Atlético Mineiro");
    expect(contenedor.querySelector('button[aria-label="Entrar a Partido"]')).not.toBeNull();
    expect(contenedor.querySelector('button[aria-label="Entrar a Flujo diario"]')).not.toBeNull();
    // Cada tarjeta lleva su foto y su ícono arriba a la izquierda.
    expect(contenedor.querySelector(".tarjeta-partido .portal-foto img").getAttribute("src")).toBe("/portal/partido.webp");
    expect(contenedor.querySelector(".tarjeta-flujo .portal-foto img").getAttribute("src")).toBe("/portal/flujo.webp");
    expect(contenedor.querySelectorAll(".portal-tarjeta .portal-icono svg")).toHaveLength(2);
    expect(portada()).toBeNull();
  });

  test("sin equipo elegido no muestra el renglón del equipo", async () => {
    equipo.actual = null;
    await montar();

    expect(contenedor.querySelector(".portal-kicker")).toBeNull();
    expect(contenedor.querySelector(".portal-encabezado h1").textContent).toBe("¿Qué vas a hacer hoy?");
  });

  test("al tocar Partido muestra la portada con su foto y entra sin la intro", async () => {
    await montar();
    await tocar("Entrar a Partido");

    // La portada tapa la pantalla con la foto de la tarjeta y el nombre...
    const cubierta = portada();
    expect(cubierta).not.toBeNull();
    expect(cubierta.classList.contains("tarjeta-partido")).toBe(true);
    expect(cubierta.querySelector("img").getAttribute("src")).toBe("/portal/partido.webp");
    expect(cubierta.querySelector(".portal-portada-texto strong").textContent).toBe("Partido");
    // ...ya pedida a pantalla entera (el zoom lo hace la hoja de estilos).
    expect(cubierta.classList.contains("llena")).toBe(true);
    expect(cubierta.style.width).toBe("");
    expect(cubierta.style.top).toBe("");
    // Mientras tanto Partido ya está cargado abajo, sin su propia intro.
    expect(contenedor.querySelector(".partido-de-prueba").textContent).toContain("sin intro");
    expect(contenedor.querySelector(".portal-tarjeta")).toBeNull();

    // Pasado el zoom y la foto quieta, se va...
    await act(async () => vi.advanceTimersByTime(TIEMPOS_PORTADA.zoom + TIEMPOS_PORTADA.quieta));
    expect(portada().classList.contains("saliendo")).toBe(true);

    // ...y al terminar de irse no queda nada encima de Partido.
    await act(async () => vi.advanceTimersByTime(TIEMPOS_PORTADA.salida));
    expect(portada()).toBeNull();
    expect(contenedor.querySelector(".partido-de-prueba")).not.toBeNull();
  });

  test("al tocar Flujo diario muestra su portada y pasa por la puerta de acceso", async () => {
    await montar();
    await tocar("Entrar a Flujo diario");

    const cubierta = portada();
    expect(cubierta.classList.contains("tarjeta-flujo")).toBe(true);
    expect(cubierta.querySelector("img").getAttribute("src")).toBe("/portal/flujo.webp");
    expect(cubierta.querySelector(".portal-portada-texto strong").textContent).toBe("Flujo diario");
    expect(contenedor.querySelector(".acceso-de-prueba .flujo-de-prueba")).not.toBeNull();

    await act(async () =>
      vi.advanceTimersByTime(TIEMPOS_PORTADA.zoom + TIEMPOS_PORTADA.quieta + TIEMPOS_PORTADA.salida),
    );
    expect(portada()).toBeNull();
    expect(contenedor.querySelector(".flujo-de-prueba")).not.toBeNull();
  });

  test("si vuelve de la recuperación de OpenField entra directo a Flujo diario, sin portada", async () => {
    window.history.replaceState({}, "", "/?training_recovery=1");
    await montar();

    expect(contenedor.querySelector(".flujo-de-prueba")).not.toBeNull();
    expect(portada()).toBeNull();
    expect(contenedor.querySelector(".portal-tarjeta")).toBeNull();
  });

  test("si la foto no carga, la portada muestra el dibujo", async () => {
    await montar();
    await tocar("Entrar a Partido");

    const imagen = portada().querySelector("img");
    await act(async () => imagen.dispatchEvent(new Event("error")));
    expect(portada().querySelector("img")).toBeNull();
    expect(portada().querySelector(".portal-arte")).not.toBeNull();
  });
});
