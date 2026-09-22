import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import PortalApp, { Portada, TIEMPOS_PORTADA, fotoDePortada, lugarEnPantalla } from "./PortalApp.jsx";

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
    // ...con la foto ya pedida tapando la pantalla entera (el zoom desde la
    // tarjeta lo hace la hoja de estilos).
    expect(cubierta.classList.contains("llena")).toBe(true);
    expect(cubierta.classList.contains("de-una")).toBe(false);
    const lugar = lugarEnPantalla(window.innerWidth, window.innerHeight);
    const caja = cubierta.querySelector(".portal-portada-foto");
    expect(parseFloat(caja.style.width)).toBeCloseTo(lugar.width, 1);
    expect(parseFloat(caja.style.height)).toBeCloseTo(lugar.height, 1);
    expect(parseFloat(caja.style.left)).toBeCloseTo(lugar.left, 1);
    expect(lugar.width).toBeGreaterThanOrEqual(window.innerWidth);
    expect(lugar.height).toBeGreaterThanOrEqual(window.innerHeight);
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
  test("en el celular parado la foto apaisada se agranda hasta tapar la pantalla", () => {
    const lugar = lugarEnPantalla(390, 844);
    // Tan alta como la pantalla y, por la forma de la foto, mucho más ancha:
    // lo que sobra queda afuera, mitad de cada lado.
    expect(lugar.height).toBe(844);
    expect(lugar.width).toBeCloseTo(1500.4, 0);
    expect(lugar.top).toBe(0);
    expect(lugar.left).toBeCloseTo(-555.2, 0);
    expect(lugar.left + lugar.width).toBeCloseTo(390 + 555.2, 0);
  });

  test("el foco elige qué parte queda a la vista", () => {
    // Con el foco a la izquierda casi no se corta de ese lado.
    const lugar = lugarEnPantalla(390, 844, { foco: [0.18, 0.5] });
    expect(lugar.left).toBeCloseTo(-(1500.4 - 390) * 0.18, 0);
    expect(lugarEnPantalla(390, 844, { foco: [0, 0] }).left).toBe(0);
  });

  test("una foto parada tapa la pantalla del celular casi sin recortar", () => {
    const lugar = lugarEnPantalla(390, 844, { proporcion: 9 / 16 });
    expect(lugar.height).toBe(844);
    expect(lugar.width).toBeCloseTo(474.75, 1);
    expect(lugar.left).toBeCloseTo(-42.4, 0);
  });

  test("en la computadora tapa la pantalla entera con un recorte chico", () => {
    const lugar = lugarEnPantalla(1280, 860);
    expect(lugar.height).toBe(860);
    expect(lugar.width).toBeCloseTo(1528.9, 0);
    expect(lugar.top).toBe(0);
    expect(lugar.left).toBeCloseTo(-124.4, 0);
  });
});

describe("la foto de la portada", () => {
  const tarjeta = { foto: "/portal/x.webp", fotoParada: "/portal/x-parada.webp" };

  test("en el celular parado usa la foto parada si la tarjeta la tiene", () => {
    expect(fotoDePortada(tarjeta, 390, 844)).toEqual({ src: "/portal/x-parada.webp", parada: true });
    expect(fotoDePortada({ ...tarjeta, fotoParada: null }, 390, 844)).toEqual({ src: "/portal/x.webp", parada: false });
  });

  test("apaisado usa siempre la foto de la tarjeta", () => {
    expect(fotoDePortada(tarjeta, 1280, 860)).toEqual({ src: "/portal/x.webp", parada: false });
  });
});

describe("la portada con foto parada", () => {
  let contenedor;
  let raiz;
  let tamano;

  beforeEach(() => {
    vi.useFakeTimers();
    tamano = [window.innerWidth, window.innerHeight];
    window.innerWidth = 390;
    window.innerHeight = 844;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    [window.innerWidth, window.innerHeight] = tamano;
    vi.useRealTimers();
  });

  test("arranca desde la foto de la tarjeta y se funde con la parada, que tapa la pantalla", async () => {
    const tarjeta = {
      clase: "tarjeta-prueba",
      foto: "/portal/x.webp",
      fotoParada: "/portal/x-parada.webp",
      foco: [0.5, 0.5],
      focoParada: [0.2, 0.5],
      Arte: () => <svg className="portal-arte" />,
      Icono: () => <svg />,
      titulo: "Prueba",
    };
    const terminar = vi.fn();
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<Portada tarjeta={tarjeta} desde={{ top: 100, left: 14, width: 362, height: 204 }} onTerminar={terminar} />);
    });

    const cubierta = contenedor.querySelector(".portal-portada");
    expect(cubierta.classList.contains("llena")).toBe(true);
    // Abajo la foto de la tarjeta (de donde arranca el zoom), arriba la parada.
    const fotos = cubierta.querySelectorAll(".portal-portada-foto .portal-foto");
    expect(fotos).toHaveLength(2);
    expect(fotos[0].querySelector("img").getAttribute("src")).toBe("/portal/x.webp");
    expect(fotos[1].classList.contains("foto-parada")).toBe(true);
    expect(fotos[1].querySelector("img").getAttribute("src")).toBe("/portal/x-parada.webp");
    // Y atrás, borrosa, la parada.
    expect(cubierta.querySelector(".portal-portada-fondo img").getAttribute("src")).toBe("/portal/x-parada.webp");
    // La caja termina tan alta como la pantalla y apenas más ancha, corrida
    // según el foco de la foto parada.
    const caja = cubierta.querySelector(".portal-portada-foto");
    expect(parseFloat(caja.style.height)).toBe(844);
    expect(parseFloat(caja.style.width)).toBeCloseTo(474.75, 1);
    expect(parseFloat(caja.style.left)).toBeCloseTo(-(474.75 - 390) * 0.2, 1);

    await act(async () =>
      vi.advanceTimersByTime(TIEMPOS_PORTADA.zoom + TIEMPOS_PORTADA.quieta + TIEMPOS_PORTADA.salida),
    );
    expect(terminar).toHaveBeenCalledTimes(1);
  });
});

describe("el portal en el celular, parado", () => {
  let contenedor;
  let raiz;
  let tamano;

  beforeEach(() => {
    vi.useFakeTimers();
    tamano = [window.innerWidth, window.innerHeight];
    window.innerWidth = 390;
    window.innerHeight = 844;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    [window.innerWidth, window.innerHeight] = tamano;
    vi.useRealTimers();
  });

  test("la portada de cada tarjeta usa su foto parada", async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<PortalApp />);
    });
    await act(async () => contenedor.querySelector('button[aria-label="Entrar a Flujo diario"]').click());

    const cubierta = contenedor.querySelector(".portal-portada");
    expect(cubierta.querySelector(".portal-portada-foto .foto-parada img").getAttribute("src")).toBe("/portal/flujo-parada.webp");
    expect(cubierta.querySelector(".portal-portada-fondo img").getAttribute("src")).toBe("/portal/flujo-parada.webp");
    const caja = cubierta.querySelector(".portal-portada-foto");
    expect(parseFloat(caja.style.height)).toBe(844);
    expect(parseFloat(caja.style.width)).toBeCloseTo(474.75, 1);
  });
});
