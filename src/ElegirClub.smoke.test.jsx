import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// La base de mentira: los clubes de la cuenta, cuántas veces se leyeron y el
// error con el que contesta salir del club (si la prueba pone uno).
const datos = vi.hoisted(() => ({ clubes: [], lecturas: 0, llamadas: [], errorSalir: null }));

vi.mock("./AccessGate.jsx", () => ({
  PantallaAcceso: ({ titulo, texto, children }) => (
    <main className="training-access-page">
      <h1>{titulo}</h1>
      <p>{texto}</p>
      {children}
    </main>
  ),
}));
vi.mock("./domain/equipo.js", () => ({
  cargarEquipos: async () => {
    datos.lecturas += 1;
    return { equipos: datos.clubes };
  },
  guardarEquipoElegido: () => {},
  esElCam: () => false,
}));
// Como la base: salir deja hoy como último día; el pedido de acceso, sin pedidos.
vi.mock("./domain/pedidosDb.js", () => ({
  salirDelClub: async (equipoId) => {
    datos.llamadas.push({ que: "salir", equipoId });
    if (datos.errorSalir) throw new Error(datos.errorSalir);
    datos.clubes = datos.clubes.map((club) => (club.id === equipoId ? { ...club, hasta: "2026-10-08" } : club));
    return true;
  },
  misPedidos: async () => [],
  pedidoAbierto: () => null,
  pedirAcceso: async () => "p1",
  cancelarPedido: async () => true,
}));

const { default: ElegirClub } = await import("./ElegirClub.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");

const UNO = { id: "c1", nombre: "Club Uno", rol: "staff", hasta: null, miembro: true };
const DOS = { id: "c2", nombre: "Club Dos", rol: "admin", hasta: null, miembro: true };

describe("elegir club: salir del club elegido", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    datos.clubes = [UNO, DOS];
    datos.lecturas = 0;
    datos.llamadas = [];
    datos.errorSalir = null;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    fijarIdiomaParaPruebas("es-AR");
  });

  const montar = async (props = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<ElegirClub club={UNO} onElegir={() => {}} onSalir={() => {}} email="ana@uno.com" {...props} />);
    });
    await act(async () => Promise.resolve());
  };

  const texto = () => contenedor.textContent;
  const boton = (dentro, etiqueta) => [...dentro.querySelectorAll("button")].find((b) => b.textContent.trim() === etiqueta);
  const hoja = () => document.querySelector(".hoja-confirmar");
  const tocar = async (elemento) => {
    expect(elemento, "no se encontró el botón").toBeTruthy();
    await act(async () => elemento.click());
    await act(async () => Promise.resolve());
  };

  test("abajo, como enlace, sale del club elegido: confirma, llama, relee y avisa al portal", async () => {
    const onSalioDelClub = vi.fn();
    await montar({ onSalioDelClub });
    const salir = boton(contenedor, "Salir de Club Uno");
    // Una acción secundaria, debajo de la lista: no compite con elegir.
    expect(salir.className).toBe("training-access-enlace");
    expect(salir.closest(".elegir-club-salir")).toBeTruthy();
    expect(contenedor.querySelector(".elegir-club-lista").compareDocumentPosition(salir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Solo el club elegido, no los demás.
    expect(boton(contenedor, "Salir de Club Dos")).toBeUndefined();

    // Cancelar no cambia nada.
    await tocar(salir);
    expect(hoja().textContent).toContain("¿Salir de Club Uno?");
    expect(hoja().textContent).toContain("Hoy es tu último día");
    await tocar(boton(hoja(), "Cancelar"));
    expect(hoja()).toBeNull();
    expect(datos.llamadas).toEqual([]);

    await tocar(boton(contenedor, "Salir de Club Uno"));
    await tocar(boton(hoja(), "Sí, salir"));
    expect(datos.llamadas).toEqual([{ que: "salir", equipoId: "c1" }]);
    // Se vuelve a leer la lista y se avisa al portal para que relea su club.
    expect(datos.lecturas).toBe(2);
    expect(onSalioDelClub).toHaveBeenCalledTimes(1);
    expect(texto()).toContain("Saliste de Club Uno.");
    // Queda en solo lectura hasta hoy, como cualquiera que se fue; ya no hay de qué salir.
    const uno = [...contenedor.querySelectorAll(".elegir-club-opcion")].find((b) => b.textContent.includes("Club Uno"));
    expect(uno.querySelector(".elegir-club-detalle").textContent).toBe("Hasta el 08/10/2026 · solo lectura");
    expect(boton(contenedor, "Salir de Club Uno")).toBeUndefined();
  });

  test("sin un club elegido donde siga activo, no aparece", async () => {
    // Sin club elegido (lo primero después de entrar).
    await montar({ club: null });
    expect(contenedor.querySelector(".elegir-club-lista")).toBeTruthy();
    expect(texto()).not.toContain("Salir de");
    await act(async () => raiz.unmount());

    // Ya se fue de ese club.
    datos.clubes = [{ ...UNO, hasta: "2026-09-30" }, DOS];
    await montar();
    expect(texto()).not.toContain("Salir de");
    await act(async () => raiz.unmount());

    // Una base de antes le muestra un club donde no está.
    datos.clubes = [{ ...UNO, miembro: false }, DOS];
    await montar();
    expect(texto()).not.toContain("Salir de");
    await act(async () => raiz.unmount());

    // Ya no figura en la lista.
    datos.clubes = [DOS];
    await montar();
    expect(texto()).not.toContain("Salir de");
  });

  test("si es el único administrador, no sale y lo dice; lo mismo si ya no está o no hay señal", async () => {
    const onSalioDelClub = vi.fn();
    datos.errorSalir = "pedidos.error.ultimoAdmin";
    await montar({ onSalioDelClub });
    await tocar(boton(contenedor, "Salir de Club Uno"));
    await tocar(boton(hoja(), "Sí, salir"));
    expect(texto()).toContain("Sos el único administrador del club: por ahora no podés salir.");
    expect(contenedor.querySelector(".elegir-club-salir .training-access-message.error")).toBeTruthy();
    expect(onSalioDelClub).not.toHaveBeenCalled();
    expect(datos.lecturas).toBe(1);
    // Sigue en el club: el enlace sigue ahí.
    expect(boton(contenedor, "Salir de Club Uno")).toBeTruthy();

    datos.errorSalir = "pedidos.error.noEsMiembro";
    await tocar(boton(contenedor, "Salir de Club Uno"));
    await tocar(boton(hoja(), "Sí, salir"));
    expect(texto()).toContain("Ya no estás en ese club.");

    datos.errorSalir = "comun.sinConexion";
    await tocar(boton(contenedor, "Salir de Club Uno"));
    await tocar(boton(hoja(), "Sí, salir"));
    expect(texto()).toContain("No hay conexión. Fijate la señal y probá de nuevo.");
    expect(onSalioDelClub).not.toHaveBeenCalled();
  });

  test("en portugués", async () => {
    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    await montar();
    await tocar(boton(contenedor, "Sair de Club Uno"));
    expect(hoja().textContent).toContain("Sair de Club Uno?");
    expect(boton(hoja(), "Sim, sair")).toBeTruthy();
  });
});
