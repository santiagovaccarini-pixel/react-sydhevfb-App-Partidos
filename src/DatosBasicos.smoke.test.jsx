import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const registro = vi.hoisted(() => ({ guardados: [], agregados: [], borrados: [], equipo: { id: "eq-1", nombre: "Atlético Mineiro" } }));

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => registro.equipo,
  cargarEquipos: async () => ({ equipos: [] }),
  elegirEquipoInicial: () => null,
  guardarEquipoElegido: () => {},
  esElCam: (nombre) => nombre === "Atlético Mineiro",
}));
vi.mock("./domain/lesionesDb.js", () => ({
  cargarPlantelLesiones: async () => ({
    plantel: [
      { id: 7, nombre: "HULK", roles: [], puestos: ["DEL"], categoria: "profissional", fecha_nacimiento: "1986-07-25", pie_dominante: "esquerdo", posicion: "delantero_central", foto_url: "" },
      { id: 8, nombre: "SCARPA", roles: [], puestos: ["VOL"], categoria: "", fecha_nacimiento: "", pie_dominante: "", posicion: "", foto_url: "" },
    ],
    error: "",
  }),
  leerConfig: async () => ({ config: { campos: {}, listas: {} }, error: "" }),
  guardarDatosJugador: async (id, cambios) => {
    registro.guardados.push({ id, ...cambios });
    return { jugador: { id, nombre: id === 7 ? "HULK" : "SCARPA", roles: [], puestos: [], ...cambios }, error: "" };
  },
  agregarJugadorBasico: async (equipoId, nombre) => {
    registro.agregados.push({ equipoId, nombre });
    return { jugador: { id: 9, nombre: nombre.trim().toUpperCase(), roles: [], puestos: [] }, error: "" };
  },
  quitarJugadorBasico: async (id) => {
    registro.borrados.push(id);
    return { error: "" };
  },
}));

const { default: DatosBasicos } = await import("./DatosBasicos.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");

const texto = (contenedor) => contenedor.textContent;
const boton = (contenedor, etiqueta) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === etiqueta);
const tocar = async (elemento) => {
  expect(elemento, "no se encontró el botón").toBeTruthy();
  await act(async () => elemento.click());
};
const escribir = async (input, valor) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const celda = (contenedor, fila, columna) => contenedor.querySelectorAll("tbody tr")[fila].querySelectorAll("td")[columna];

describe("el módulo Datos básicos", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    localStorage.clear();
    registro.equipo = { id: "eq-1", nombre: "Atlético Mineiro" };
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    contenedor.remove();
    ["guardados", "agregados", "borrados"].forEach((clave) => {
      registro[clave].length = 0;
    });
  });

  const montar = async () => {
    await act(async () => raiz.render(<DatosBasicos onVolver={() => {}} />));
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
  };

  test("muestra los jugadores en la tabla estilo Excel con los datos que piden los módulos", async () => {
    await montar();
    expect(texto(contenedor)).toContain("2 jugadores");
    const cabeceras = [...contenedor.querySelectorAll("th[data-columna]")].map((th) => th.textContent);
    expect(cabeceras).toEqual(["Nombre y apellido", "Categoría", "Fecha de nacimiento", "Edad", "Pie dominante", "Posición", "Foto (enlace)"]);
    const hulk = contenedor.querySelector("tbody tr");
    expect(hulk.textContent).toContain("HULK");
    expect(hulk.textContent).toContain("25/07/1986");
    expect(hulk.textContent).toContain("Izquierdo");
    expect(hulk.textContent).toMatch(/\d\d años/);
    // La edad se calcula sola.
    expect(celda(contenedor, 0, 3).classList.contains("fija")).toBe(true);

    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    expect(texto(contenedor)).toContain("2 jogadores");
    expect(contenedor.querySelector("tbody tr").textContent).toContain("Esquerdo");
  });

  test("quien ya se fue del club ve a los jugadores y no puede cambiar nada", async () => {
    registro.equipo = { id: "eq-1", nombre: "Atlético Mineiro", hasta: "2026-09-25" };
    await montar();
    expect(texto(contenedor)).toContain("Dejaste este club el 25/09/2026.");
    expect(texto(contenedor)).toContain("HULK");
    expect(boton(contenedor, "Agregar jugador")).toBeUndefined();
    expect(boton(contenedor, "Borrar fila")).toBeUndefined();
    expect(boton(contenedor, "Pegar")).toBeUndefined();
    expect(boton(contenedor, "Copiar")).toBeTruthy();
    expect([...contenedor.querySelectorAll("th[data-columna]")].every((th) => th.classList.contains("fija"))).toBe(true);
    await tocar(celda(contenedor, 1, 4));
    await tocar(celda(contenedor, 1, 4));
    expect(contenedor.querySelector(".opcion-hoja")).toBeNull();
    expect(registro.guardados).toEqual([]);
  });

  test("se cambia el pie dominante desde la celda, se agrega un jugador y se borra otro", async () => {
    await montar();
    // Dos toques en una celda de lista abren la hoja de opciones.
    await tocar(celda(contenedor, 1, 4));
    await tocar(celda(contenedor, 1, 4));
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Derecho"));
    expect(registro.guardados).toEqual([{ id: 8, pie_dominante: "direito" }]);
    expect(celda(contenedor, 1, 4).textContent).toBe("Derecho");

    await escribir(contenedor.querySelector(".datos-agregar input"), "lemos");
    await tocar(boton(contenedor, "Agregar jugador"));
    await act(async () => Promise.resolve());
    expect(registro.agregados).toEqual([{ equipoId: "eq-1", nombre: "lemos" }]);
    expect(texto(contenedor)).toContain("Jugador agregado");
    expect(texto(contenedor)).toContain("3 jugadores");
    expect([...contenedor.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent)).toEqual(["HULK", "LEMOS", "SCARPA"]);

    await tocar(contenedor.querySelectorAll("tbody th")[1]);
    await tocar(boton(contenedor, "Borrar fila"));
    expect(texto(contenedor)).toContain("¿Borrar al jugador?");
    expect(texto(contenedor)).toContain("LEMOS sale de la lista");
    await tocar(boton(contenedor, "Sí, borrar"));
    await act(async () => Promise.resolve());
    expect(registro.borrados).toEqual([9]);
    expect(texto(contenedor)).toContain("2 jugadores");
  });
});
