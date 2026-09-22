import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import PortalApp, { TIEMPOS_PORTADA, lugarEnPantalla } from "./PortalApp.jsx";

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

    // La portada tapa la pantalla: atrás la foto de la tarjeta borrosa, adelante
    // la misma foto entera y el nombre...
    const cubierta = portada();
    expect(cubierta).not.toBeNull();
    expect(cubierta.classList.contains("tarjeta-partido")).toBe(true);
    expect(cubierta.querySelector(".portal-portada-fondo img").getAttribute("src")).toBe("/portal/partido.webp");
    expect(cubierta.querySelector(".portal-portada-foto img").getAttribute("src")).toBe("/portal/partido.webp");
    expect(cubierta.querySelector(".portal-portada-texto strong").textContent).toBe("Partido");
    // ...con la foto ya pedida en su lugar final, entera, de lado a lado (el
    // zoom desde la tarjeta lo hace la hoja de estilos).
    expect(cubierta.classList.contains("llena")).toBe(true);
    const lugar = lugarEnPantalla(window.innerWidth, window.innerHeight);
    const caja = cubierta.querySelector(".portal-portada-foto");
    expect(caja.style.width).toBe(`${lugar.foto.width}px`);
    expect(caja.style.top).toBe(`${lugar.foto.top}px`);
    expect(Math.round((lugar.foto.width * 9) / 16)).toBe(Math.round(lugar.foto.height));
    expect(cubierta.querySelector(".portal-portada-texto").style.top).toBe(`${lugar.texto.top}px`);
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
    expect(cubierta.querySelector(".portal-portada-foto img").getAttribute("src")).toBe("/portal/flujo.webp");
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

    const imagen = portada().querySelector(".portal-portada-foto img");
    await act(async () => imagen.dispatchEvent(new Event("error")));
    expect(portada().querySelector(".portal-portada-foto img")).toBeNull();
    expect(portada().querySelector(".portal-portada-foto .portal-arte")).not.toBeNull();
  });
});

describe("el lugar de la foto en la portada", () => {
  test("en el celular parado va de lado a lado, entera, con el nombre debajo", () => {
    const { foto, texto } = lugarEnPantalla(390, 844);
    expect(foto.left).toBe(0);
    expect(foto.width).toBe(390);
    expect(foto.height).toBeCloseTo(219.4, 0);
    expect(foto.borderRadius).toBe(0);
    // Centrada a lo alto junto con el nombre, y el nombre debajo de la foto.
    expect(foto.top).toBeGreaterThan(200);
    expect(foto.top + foto.height).toBeLessThan(texto.top);
    expect(texto.left).toBe(22);
  });

  test("en la computadora queda como una tarjeta grande, sin llegar a los bordes", () => {
    const { foto, texto } = lugarEnPantalla(1280, 860);
    expect(foto.width).toBeLessThan(1280);
    expect(foto.left).toBeGreaterThan(0);
    expect(foto.borderRadius).toBe(26);
    expect(foto.top + foto.height + 24).toBe(texto.top);
    expect(texto.top + 150).toBeLessThanOrEqual(860);
  });
});
