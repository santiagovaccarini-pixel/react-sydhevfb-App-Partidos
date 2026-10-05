import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import BasesDeDatos, { BASES, basesHabilitadas } from "./BasesDeDatos.jsx";
import { TIEMPOS_PORTADA } from "./components/PortalTarjetas.jsx";
import { DICCIONARIOS, fijarIdiomaParaPruebas } from "./idioma/index.js";

const equipo = vi.hoisted(() => ({ actual: { id: "eq-1", nombre: "Atlético Mineiro" } }));

vi.mock("./domain/equipo.js", () => ({ leerEquipoElegido: () => equipo.actual }));
vi.mock("./Lesiones.jsx", async () => {
  const { t } = await vi.importActual("./idioma/index.js");
  return {
    default: ({ onVolver, volverA }) => (
      <div className="lesiones-de-prueba">
        <button type="button" onClick={onVolver}>
          {t(volverA)}
        </button>
      </div>
    ),
  };
});

const buscar = (diccionario, clave) => clave.split(".").reduce((nodo, parte) => nodo?.[parte], diccionario);

describe("Bases de Datos", () => {
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
    fijarIdiomaParaPruebas("es-AR");
    vi.useRealTimers();
  });

  const montar = async (props) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<BasesDeDatos permisos={{ lesiones: true }} onVolver={() => {}} {...props} />);
    });
  };

  const tarjetas = () => [...contenedor.querySelectorAll(".portal-tarjeta")];

  test("tiene la cara de la pantalla principal: el club, el título y una tarjeta por base", async () => {
    equipo.actual = { id: "eq-1", nombre: "Atlético Mineiro", hasta: "2026-09-25" };
    await montar();

    expect(contenedor.querySelector("main.portal-modulos.bases-datos")).not.toBeNull();
    expect(contenedor.querySelector(".portal-kicker").textContent).toContain("Atlético Mineiro");
    // Quien ya se fue lo ve igual que en el portal, pero acá no se cambia el club.
    expect(contenedor.querySelector(".portal-club-hasta").textContent).toBe("Hasta el 25/09/2026 · solo lectura");
    expect(contenedor.querySelector(".portal-cambiar-club")).toBeNull();
    expect(contenedor.querySelector("h1").textContent).toBe("Bases de Datos");
    expect(contenedor.querySelector(".portal-encabezado p").textContent).toBe("Por ahora hay una sola; las próximas bases se suman acá.");

    expect(tarjetas()).toHaveLength(1);
    const lesiones = tarjetas()[0];
    expect(lesiones.getAttribute("aria-label")).toBe("Entrar a Lesiones");
    expect(lesiones.classList.contains("tarjeta-lesiones")).toBe(true);
    // Sin foto todavía: va su dibujo, con el ícono arriba a la izquierda.
    expect(lesiones.querySelector(".portal-foto img")).toBeNull();
    expect(lesiones.querySelector(".portal-foto .portal-arte")).not.toBeNull();
    expect(lesiones.querySelector(".portal-icono svg")).not.toBeNull();
    expect(lesiones.querySelector("strong").textContent).toBe("Lesiones");
    expect(lesiones.querySelector(".portal-entrar").textContent).toContain("Entrar");
  });

  test("al tocar una base: la portada encima, la base abajo y su botón vuelve a las bases", async () => {
    await montar();
    await act(async () => tarjetas()[0].click());

    const portada = contenedor.querySelector(".portal-portada");
    expect(portada.classList.contains("tarjeta-lesiones")).toBe(true);
    expect(portada.querySelector(".portal-portada-texto strong").textContent).toBe("Lesiones");
    expect(portada.querySelector(".portal-portada-foto .portal-arte")).not.toBeNull();
    expect(contenedor.querySelector(".lesiones-de-prueba")).not.toBeNull();
    expect(tarjetas()).toHaveLength(0);

    await act(async () => vi.advanceTimersByTime(TIEMPOS_PORTADA.zoom + TIEMPOS_PORTADA.quieta + TIEMPOS_PORTADA.salida));
    expect(contenedor.querySelector(".portal-portada")).toBeNull();

    const volver = contenedor.querySelector(".lesiones-de-prueba button");
    expect(volver.textContent).toBe("Bases");
    await act(async () => volver.click());
    expect(contenedor.querySelector(".lesiones-de-prueba")).toBeNull();
    expect(tarjetas()).toHaveLength(1);
  });

  test("el botón de arriba vuelve a los módulos", async () => {
    const onVolver = vi.fn();
    await montar({ onVolver });
    const volver = contenedor.querySelector(".bases-barra .bases-volver");
    expect(volver.textContent.trim()).toBe("Módulos");
    expect(volver.querySelector("svg")).not.toBeNull();
    expect(contenedor.querySelector(".bases-barra .selector-idioma")).not.toBeNull();
    await act(async () => volver.click());
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  test("sin permiso no hay bases para abrir, ni tocando", async () => {
    await montar({ permisos: { partido: true } });
    expect(tarjetas()).toHaveLength(0);
    expect(contenedor.querySelector(".portal-encabezado p").textContent).toBe("Tu cuenta no tiene ninguna base habilitada en este club.");
    expect(basesHabilitadas({ partido: true })).toEqual([]);
    expect(basesHabilitadas(null)).toEqual([]);
    expect(basesHabilitadas({ lesiones: true }).map((base) => base.modo)).toEqual(["lesiones"]);
  });

  test("si el permiso se va con la base abierta, vuelven las tarjetas (sin ninguna)", async () => {
    await montar();
    await act(async () => tarjetas()[0].click());
    await act(async () => vi.runAllTimers());
    expect(contenedor.querySelector(".lesiones-de-prueba")).not.toBeNull();

    await act(async () => raiz.render(<BasesDeDatos permisos={{ lesiones: false }} onVolver={() => {}} />));
    expect(contenedor.querySelector(".lesiones-de-prueba")).toBeNull();
    expect(contenedor.querySelector("h1").textContent).toBe("Bases de Datos");
    expect(tarjetas()).toHaveLength(0);
  });

  test("en portugués", async () => {
    fijarIdiomaParaPruebas("pt-BR");
    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe("Bases de Dados");
    expect(contenedor.querySelector(".bases-volver").textContent.trim()).toBe("Módulos");
    expect(tarjetas()[0].getAttribute("aria-label")).toBe("Entrar em Lesões");
    await act(async () => tarjetas()[0].click());
    await act(async () => vi.runAllTimers());
    expect(contenedor.querySelector(".lesiones-de-prueba button").textContent).toBe("Bases");
  });

  test("cada base del catálogo está completa y con sus textos en los dos idiomas", () => {
    const modos = BASES.map((base) => base.modo);
    expect(new Set(modos).size).toBe(modos.length);
    for (const base of BASES) {
      expect(typeof base.Pantalla, base.modo).toBe("function");
      expect(typeof base.Arte, base.modo).toBe("function");
      expect(typeof base.Icono, base.modo).toBe("function");
      expect(base.permiso, base.modo).toBeTruthy();
      expect(base.clase, base.modo).toMatch(/^tarjeta-/);
      for (const clave of [base.titulo, base.texto]) {
        expect(typeof buscar(DICCIONARIOS["es-AR"], clave), clave).toBe("string");
        expect(typeof buscar(DICCIONARIOS["pt-BR"], clave), clave).toBe("string");
      }
    }
  });
});
