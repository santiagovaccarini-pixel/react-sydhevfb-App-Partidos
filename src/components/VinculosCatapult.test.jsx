import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { VinculosCatapult } from "./VinculosCatapult.jsx";
import { fijarIdiomaParaPruebas } from "../idioma/index.js";

// Los chalecos de Catapult de cada jugador, en Datos básicos (antes estaban
// en Flujo diario › Ajustes › Lista de jugadores).
const dobles = vi.hoisted(() => ({
  plantel: [],
  cargar: vi.fn(),
  guardar: vi.fn(),
  aviso: vi.fn(),
}));

vi.mock("../domain/plantel.js", async (importOriginal) => ({
  ...(await importOriginal()),
  cargarPlantelConCatapult: (...args) => dobles.cargar(...args),
  guardarVinculoCatapult: (...args) => dobles.guardar(...args),
}));

vi.mock("../supabase.js", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));

const respuesta = (status, cuerpo) => ({ ok: status < 300, status, json: async () => cuerpo });

const ATLETAS = [
  { id: "a1", first_name: "A MINDA", last_name: ".", jersey: "MIN", nombre: "A MINDA ." },
  { id: "a2", first_name: "Igor", last_name: "Gomes", jersey: "GOM", nombre: "Igor Gomes" },
  { id: "a3", first_name: "Cisse", last_name: ".", jersey: "CIS", nombre: "Cisse ." },
];

describe("los chalecos de Catapult en Datos básicos", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    dobles.plantel = [
      { id: 1, nombre: "A MINDA", roles: [], puestos: [], catapult_id: null, catapult_nombre: null },
      { id: 2, nombre: "IGOR GOMES", roles: [], puestos: [], catapult_id: "a2", catapult_nombre: "IGOR GOMES (GOM)" },
      { id: 3, nombre: "LEMOS", roles: [], puestos: [], catapult_id: null, catapult_nombre: null },
    ];
    dobles.cargar.mockReset().mockImplementation(async () => ({ plantel: dobles.plantel }));
    dobles.guardar.mockReset().mockResolvedValue({});
    dobles.aviso.mockReset();
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    contenedor.remove();
    vi.unstubAllGlobals();
  });

  const montar = async (soloLectura = false) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<VinculosCatapult equipoId="eq-1" soloLectura={soloLectura} onAviso={dobles.aviso} />);
    });
    await act(async () => Promise.resolve());
  };

  const botonPorTexto = (texto) =>
    [...contenedor.querySelectorAll("button")].find((boton) => boton.textContent.trim() === texto);

  test("en un club del que ya se fue, la lista se mira y no se cambia", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await montar(true);

    expect([...contenedor.querySelectorAll(".nombre-lista")]).toHaveLength(3);
    expect(contenedor.textContent).toContain("Chaleco: IGOR GOMES (GOM)");
    expect(contenedor.querySelector(".agregar-jugador")).toBeNull();
    expect(botonPorTexto("Buscar chalecos")).toBeUndefined();
    expect(contenedor.textContent).not.toContain("Emparejar con los chalecos");
  });

  test("muestra la lista compartida con su estado de vínculo", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await montar();

    expect(dobles.cargar).toHaveBeenCalledWith("eq-1");
    const texto = contenedor.textContent;
    expect(contenedor.querySelector(".cabeza-ficha b").textContent).toBe("Chalecos de Catapult");
    expect(texto).toContain("3 jugadores · 1 con chaleco");
    expect(texto).toContain("Chaleco: IGOR GOMES (GOM)");
    expect(texto).toContain("Sin chaleco");
    expect([...contenedor.querySelectorAll(".nombre-lista")].map((n) => n.textContent)).toEqual([
      "A MINDA",
      "IGOR GOMES",
      "LEMOS",
    ]);
    expect(botonPorTexto("Buscar chalecos")).toBeDefined();
    // Los jugadores se agregan en la tabla de Datos básicos, no acá.
    expect(contenedor.querySelector(".agregar-jugador")).toBeNull();
  });

  test("propone vínculos, deja corregirlos y guarda solo los cambios", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respuesta(200, { ok: true, fuente: "athletes", atletas: ATLETAS })),
    );
    await montar();

    await act(async () => botonPorTexto("Buscar chalecos").click());

    const texto = contenedor.textContent;
    expect(texto).toContain("Chalecos encontrados: 3");
    expect(texto).toContain("Coincide solo");
    expect(texto).toContain("Guardado");
    expect(botonPorTexto("Guardar 1 cambio")).toBeDefined();

    // LEMOS no tiene propuesta: se elige a mano.
    const selects = contenedor.querySelectorAll("select");
    expect(selects).toHaveLength(3);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
      setter.call(selects[2], "a3");
      selects[2].dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(selects[2].getAttribute("aria-label")).toBe("Chaleco de LEMOS");
    expect(botonPorTexto("Guardar 2 cambios")).toBeDefined();
    expect(contenedor.textContent).toContain("Elegido a mano");

    await act(async () => botonPorTexto("Guardar 2 cambios").click());

    expect(dobles.guardar).toHaveBeenCalledTimes(2);
    expect(dobles.guardar).toHaveBeenCalledWith(1, { catapultId: "a1", catapultNombre: "A MINDA (MIN)" });
    expect(dobles.guardar).toHaveBeenCalledWith(3, { catapultId: "a3", catapultNombre: "CISSE (CIS)" });
    expect(dobles.aviso).toHaveBeenCalledWith("2 cambios guardados.");
    expect(dobles.cargar).toHaveBeenCalledTimes(2);
  });

  test("a quien ya no está en el plantel actual no se le propone chaleco, y va abajo marcado", async () => {
    dobles.plantel = dobles.plantel.map((jugador) => (jugador.id === 1 ? { ...jugador, actual: false } : jugador));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respuesta(200, { ok: true, fuente: "athletes", atletas: ATLETAS })),
    );
    await montar();
    await act(async () => botonPorTexto("Buscar chalecos").click());

    const nombres = [...contenedor.querySelectorAll(".nombre-lista")].map((nombre) => nombre.textContent);
    expect(nombres).toEqual(["IGOR GOMES", "LEMOS", "A MINDA · Ya no está"]);
    // A MINDA coincide con un chaleco, pero no se le propone: nada para guardar.
    expect(contenedor.querySelector('select[aria-label="Chaleco de A MINDA"]').value).toBe("");
    expect(botonPorTexto("Sin cambios para guardar")).toBeDefined();
  });

  test("bloquea el guardado si dos jugadores eligen el mismo chaleco", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respuesta(200, { ok: true, fuente: "athletes", atletas: ATLETAS })),
    );
    await montar();
    await act(async () => botonPorTexto("Buscar chalecos").click());

    const selects = contenedor.querySelectorAll("select");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
      setter.call(selects[2], "a1");
      selects[2].dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(contenedor.textContent).toContain("Hay un chaleco elegido para más de un jugador");
    expect(botonPorTexto("Guardar 2 cambios").disabled).toBe(true);
    expect(dobles.guardar).not.toHaveBeenCalled();
  });

  test("si falta la migración lo explica", async () => {
    vi.stubGlobal("fetch", vi.fn());
    dobles.cargar.mockResolvedValue({ plantel: [], error: "La lista de jugadores todavía no tiene el vínculo con Catapult: falta ejecutar la migración 20260920_jugadores_catapult.sql en Supabase." });
    await montar();
    expect(contenedor.textContent).toContain("falta ejecutar la migración");
    expect(botonPorTexto("Reintentar")).toBeDefined();
  });
});
