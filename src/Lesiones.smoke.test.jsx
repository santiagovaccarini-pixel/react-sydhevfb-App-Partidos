import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const datos = vi.hoisted(() => ({
  lesiones: [
    { id: "les-1", equipo_id: "eq-1", jugador_id: 7, fecha_lesion: "2026-09-20", fecha_alta: null, contexto: "partido", modo_inicio: "subito", mecanismo: null, region: "muslo_posterior", lado: "derecho", tejido: "muscular", diagnostico: "Desgarro", observaciones: "", recidiva_de: null },
  ],
  guardadas: [],
}));

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => ({ id: "eq-1", nombre: "Atlético Mineiro" }),
  cargarEquipos: async () => ({ equipos: [] }),
  elegirEquipoInicial: () => null,
  guardarEquipoElegido: () => {},
}));
vi.mock("./domain/plantel.js", () => ({
  cargarPlantel: async () => ({ plantel: [{ id: 7, nombre: "HULK" }, { id: 8, nombre: "SCARPA" }], desde: "base" }),
}));
vi.mock("./domain/lesionesDb.js", () => ({
  listarLesiones: async () => ({ lesiones: datos.lesiones, error: "" }),
  crearLesion: async (equipoId, lesion) => {
    datos.guardadas.push({ equipoId, lesion });
    return { lesion: { ...lesion, id: "les-nueva" }, error: "" };
  },
  actualizarLesion: async (id, lesion) => ({ lesion: { ...lesion, id }, error: "" }),
  darAltaLesion: async (id, fecha) => ({ lesion: { ...datos.lesiones[0], fecha_alta: fecha }, error: "" }),
  historialDeLesion: async () => ({ cambios: [], error: "" }),
}));

const { default: Lesiones } = await import("./Lesiones.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");

const texto = (contenedor) => contenedor.textContent;
const boton = (contenedor, etiqueta) =>
  [...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === etiqueta);

describe("el módulo Lesiones", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    contenedor.remove();
    datos.guardadas.length = 0;
  });

  const montar = async () => {
    await act(async () => raiz.render(<Lesiones email="dt@club.com" onVolver={() => {}} onCerrarSesion={() => {}} />));
    await act(async () => Promise.resolve());
  };

  test("muestra las lesiones activas con el jugador y los días, y cambia de idioma sin romperse", async () => {
    await montar();
    expect(texto(contenedor)).toContain("HULK");
    expect(texto(contenedor)).toContain("1 lesión activa");
    expect(texto(contenedor)).toContain("Muslo posterior (isquios)");
    expect(boton(contenedor, "Dar alta")).toBeTruthy();

    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    expect(texto(contenedor)).toContain("1 lesão ativa");
    expect(texto(contenedor)).toContain("Coxa posterior (isquiotibiais)");
    expect(boton(contenedor, "Dar alta")).toBeTruthy();
  });

  test("carga una lesión nueva: jugador, región y lado, y la manda a la base", async () => {
    await montar();
    await act(async () => boton(contenedor, "+ Nueva lesión").click());
    await act(async () => boton(contenedor, "SCARPA").click());
    await act(async () => boton(contenedor, "Guardar").click());
    // Sin región no se guarda: avisa.
    expect(texto(contenedor)).toContain("Elegí la región.");
    await act(async () => boton(contenedor, "Rodilla").click());
    await act(async () => boton(contenedor, "Izquierdo").click());
    await act(async () => boton(contenedor, "Guardar").click());
    await act(async () => Promise.resolve());
    expect(datos.guardadas).toHaveLength(1);
    expect(datos.guardadas[0]).toMatchObject({ equipoId: "eq-1", lesion: { jugador_id: 8, region: "rodilla", lado: "izquierdo", fecha_alta: null } });
    expect(texto(contenedor)).toContain("SCARPA");
    expect(texto(contenedor)).toContain("2 lesiones activas");
  });

  test("dar el alta saca la lesión de la lista de hoy", async () => {
    await montar();
    await act(async () => boton(contenedor, "Dar alta").click());
    await act(async () => boton(contenedor, "Sí, dar el alta").click());
    await act(async () => Promise.resolve());
    expect(texto(contenedor)).toContain("Alta guardada");
    expect(texto(contenedor)).toContain("No hay lesiones activas");
  });
});
