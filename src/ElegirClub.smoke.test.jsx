import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// La base de mentira: los clubes de la cuenta, cuántas veces se leyeron, el
// error con el que contesta salir del club (si la prueba pone uno), los
// pedidos de acceso de la cuenta y si leerlos falla.
const datos = vi.hoisted(() => ({ clubes: [], lecturas: 0, llamadas: [], errorSalir: null, errorClubes: null, pedidos: [], errorPedidos: null }));

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
    return datos.errorClubes ? { equipos: [], error: datos.errorClubes } : { equipos: datos.clubes };
  },
  guardarEquipoElegido: () => {},
  esElCam: () => false,
}));
// Como la base: salir deja hoy como último día; el pedido de acceso queda
// abierto (uno por cuenta) hasta que se cancela, y nunca dice si el club
// está en la app.
vi.mock("./domain/pedidosDb.js", () => ({
  salirDelClub: async (equipoId) => {
    datos.llamadas.push({ que: "salir", equipoId });
    if (datos.errorSalir) throw new Error(datos.errorSalir);
    datos.clubes = datos.clubes.map((club) => (club.id === equipoId ? { ...club, hasta: "2026-10-08" } : club));
    return true;
  },
  misPedidos: async () => {
    if (datos.errorPedidos) throw new Error(datos.errorPedidos);
    return datos.pedidos.map((pedido) => ({ ...pedido }));
  },
  pedidoAbierto: (pedidos) => (pedidos || []).find((pedido) => pedido.estado === "abierto") || null,
  pedirAcceso: async (club, pais) => {
    datos.llamadas.push({ que: "pedir", club, pais });
    datos.pedidos = [{ id: "p1", club_escrito: club, pais_escrito: pais || null, estado: "abierto", creado_en: "2026-10-09T12:00:00Z" }, ...datos.pedidos];
    return "p1";
  },
  cancelarPedido: async (id) => {
    datos.llamadas.push({ que: "cancelar", id });
    datos.pedidos = datos.pedidos.map((pedido) => (pedido.id === id ? { ...pedido, estado: "cancelado" } : pedido));
    return true;
  },
}));

const { default: ElegirClub } = await import("./ElegirClub.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");

const UNO = { id: "c1", nombre: "Club Uno", rol: "staff", hasta: null, miembro: true };
const DOS = { id: "c2", nombre: "Club Dos", rol: "admin", hasta: null, miembro: true };

describe("elegir club: salir del club elegido y pedir entrar a otro", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    datos.clubes = [UNO, DOS];
    datos.lecturas = 0;
    datos.llamadas = [];
    datos.errorSalir = null;
    datos.errorClubes = null;
    datos.pedidos = [];
    datos.errorPedidos = null;
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
  const escribir = async (input, valor) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, valor);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
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

  test("con clubes activos, debajo de la lista, 'Pedir entrar a otro club' abre el pedido de siempre: manda, espera y cancela", async () => {
    await montar();
    const pedir = boton(contenedor, "Pedir entrar a otro club");
    // Una acción secundaria, debajo de la lista y antes de 'Salir de': no compite con elegir.
    expect(pedir.className).toBe("training-access-enlace");
    expect(contenedor.querySelector(".elegir-club-lista").compareDocumentPosition(pedir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pedir.compareDocumentPosition(boton(contenedor, "Salir de Club Uno")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Hasta tocarlo, ni formulario ni lectura de pedidos de más.
    expect(contenedor.querySelector(".pedido-acceso")).toBeNull();
    expect(boton(contenedor, "Mandar pedido")).toBeUndefined();

    await tocar(pedir);
    await act(async () => Promise.resolve());
    const seccion = contenedor.querySelector(".pedido-acceso");
    expect(seccion.querySelector("h2").textContent).toBe("¿A qué club querés entrar?");
    expect(boton(contenedor, "Pedir entrar a otro club")).toBeUndefined();
    // La lista sigue ahí: elegir sigue siendo lo principal.
    expect(contenedor.querySelectorAll(".elegir-club-opcion")).toHaveLength(2);
    expect(boton(seccion, "Mandar pedido").disabled).toBe(true);

    const [club, pais] = seccion.querySelectorAll("input");
    await escribir(club, "Club Tres");
    await escribir(pais, "Uruguay");
    await tocar(boton(seccion, "Mandar pedido"));
    await act(async () => Promise.resolve());
    expect(datos.llamadas).toContainEqual({ que: "pedir", club: "Club Tres", pais: "Uruguay" });
    expect(contenedor.querySelector(".pedido-acceso h2").textContent).toBe("Esperando autorización de Club Tres");

    await tocar(boton(contenedor.querySelector(".pedido-acceso"), "Cancelar pedido"));
    await act(async () => Promise.resolve());
    expect(datos.llamadas).toContainEqual({ que: "cancelar", id: "p1" });
    expect(contenedor.querySelector(".pedido-acceso h2").textContent).toBe("¿A qué club querés entrar?");
    // Salir del club elegido sigue abajo, sin cambios.
    expect(boton(contenedor, "Salir de Club Uno")).toBeTruthy();
  });

  test("con un pedido abierto, al tocar 'Pedir entrar a otro club' se ve la espera con Cancelar; Volver a comprobar relee los clubes", async () => {
    datos.pedidos = [{ id: "p9", club_escrito: "Club Nueve", pais_escrito: null, estado: "abierto", creado_en: "2026-10-08T12:00:00Z" }];
    await montar();
    await tocar(boton(contenedor, "Pedir entrar a otro club"));
    await act(async () => Promise.resolve());
    const seccion = contenedor.querySelector(".pedido-acceso");
    expect(seccion.querySelector("h2").textContent).toBe("Esperando autorización de Club Nueve");
    expect(boton(seccion, "Cancelar pedido")).toBeTruthy();
    expect(seccion.querySelector("input")).toBeNull();

    // Si lo aceptaron, el club nuevo aparece en la lista al volver a comprobar.
    datos.clubes = [UNO, DOS, { id: "c9", nombre: "Club Nueve", rol: "staff", hasta: null, miembro: true }];
    await tocar(boton(seccion, "Volver a comprobar"));
    await act(async () => Promise.resolve());
    expect(datos.lecturas).toBe(2);
    expect([...contenedor.querySelectorAll(".elegir-club-opcion")].map((b) => b.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Club Nueve")]),
    );
    expect(contenedor.querySelector(".pedido-acceso")).toBeTruthy();
  });

  test("'Pedir entrar a otro club' no aparece si no hay clubes activos (ahí el pedido ya está a la vista) ni si la lista no se pudo leer", async () => {
    // Solo clubes de los que se fue: el pedido va abierto debajo de la lista, una sola vez.
    datos.clubes = [{ ...UNO, hasta: "2026-09-30" }];
    await montar({ club: null });
    expect(boton(contenedor, "Pedir entrar a otro club")).toBeUndefined();
    expect(contenedor.querySelectorAll(".pedido-acceso")).toHaveLength(1);
    await act(async () => raiz.unmount());

    // Sin señal: no hay lista, y pedir tampoco andaría.
    datos.errorClubes = "sin señal";
    await montar();
    expect(texto()).toContain("No se pudieron leer los clubes.");
    expect(boton(contenedor, "Pedir entrar a otro club")).toBeUndefined();
  });

  test("con una base sin pedidos, no dice que la cuenta está pendiente", async () => {
    datos.errorPedidos = "pedidos.error.faltaMigracion";
    await montar();
    await tocar(boton(contenedor, "Pedir entrar a otro club"));
    await act(async () => Promise.resolve());
    const seccion = contenedor.querySelector(".pedido-acceso");
    expect(seccion.querySelector("h2").textContent).toBe("Pedir entrar a otro club");
    expect(seccion.textContent).toContain("Falta actualizar la base (pedidos de acceso).");
    expect(seccion.textContent).not.toContain("pendiente");
  });

  test("en portugués", async () => {
    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    await montar();
    await tocar(boton(contenedor, "Sair de Club Uno"));
    expect(hoja().textContent).toContain("Sair de Club Uno?");
    expect(boton(hoja(), "Sim, sair")).toBeTruthy();
    await tocar(boton(hoja(), "Cancelar"));
    await tocar(boton(contenedor, "Pedir para entrar em outro clube"));
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".pedido-acceso h2").textContent).toBe("Em qual clube você quer entrar?");
  });
});
