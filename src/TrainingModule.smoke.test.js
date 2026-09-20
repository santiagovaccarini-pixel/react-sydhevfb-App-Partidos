import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TrainingModule from "./TrainingModule";
import { CLAVE_ACTIVIDAD, leerActividadElegida } from "./domain/sesionEntrenamiento.js";

vi.mock("./TrainingSettings", () => ({ default: () => <div>Ajustes de prueba</div> }));

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => ({ id: "eq-1", nombre: "Atlético Mineiro" }),
}));

vi.mock("./domain/plantel.js", () => ({
  cargarPlantelConCatapult: async () => ({ plantel: [] }),
}));

vi.mock("./supabase.js", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));

const respuesta = (status, cuerpo) => ({ ok: status < 300, status, json: async () => cuerpo });

const ACTIVIDAD = {
  id: "9dffa100-99e5-4ce6-921f-226e9e01e264",
  name: "26-05 T",
  start_time: 1779800400,
  end_time: 1779807600,
  period_count: 8,
  venue: "",
};

const fetchDeLectura = () =>
  vi.fn(async (url) => {
    if (url === "/api/openfield/activities") return respuesta(200, { ok: true, activities: [ACTIVIDAD] });
    if (String(url).startsWith("/api/openfield/periods")) {
      return respuesta(200, { ok: true, periods: [{ id: "p1", name: "WARM UP", start_ms: 1779800400000, end_ms: 1779801000000, duration_seconds: 600 }] });
    }
    return respuesta(500, { ok: false, error: "sin ruta" });
  });

describe("TrainingModule", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    window.localStorage.clear();
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    contenedor.remove();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  const montar = async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<TrainingModule onVolver={() => {}} />);
    });
    await act(async () => Promise.resolve());
  };

  const botonMovil = (texto) =>
    [...contenedor.querySelectorAll(".navegacion-movil button")].find((boton) => boton.textContent.trim() === texto);
  const botonPorTexto = (texto) =>
    [...contenedor.querySelectorAll("button")].find((boton) => boton.textContent.trim() === texto);

  test("usa el marco de Partido con Sesión, Tareas y Ajustes", async () => {
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    expect([...contenedor.querySelectorAll(".navegacion-movil button")].map((b) => b.textContent.trim())).toEqual([
      "Sesión",
      "Tareas",
      "Ajustes",
    ]);
    expect(contenedor.querySelector(".marca-aplicacion strong").textContent).toBe("Entrenamiento");
    expect(contenedor.querySelector(".marco-aplicacion").classList.contains("entrenamiento-marco")).toBe(true);
    expect(contenedor.textContent).toContain("Sesión de OpenField");
    expect(contenedor.textContent).toContain("Todavía no elegiste la sesión");

    await act(async () => botonMovil("Tareas").click());
    expect(contenedor.textContent).toContain("Primero elegí la sesión");
    expect(botonMovil("Tareas").classList.contains("activo")).toBe(true);

    await act(async () => botonPorTexto("Ir a Sesión").click());
    expect(contenedor.textContent).toContain("Sesión de OpenField");

    await act(async () => botonMovil("Ajustes").click());
    expect(contenedor.textContent).toContain("Ajustes de prueba");
  });

  test("elegir una sesión la guarda en el celular y habilita Tareas", async () => {
    const fetchMock = fetchDeLectura();
    vi.stubGlobal("fetch", fetchMock);
    await montar();

    await act(async () => botonPorTexto("Buscar sesiones en OpenField").click());
    expect(contenedor.textContent).toContain("1 en total");

    await act(async () => contenedor.querySelector(".entrenamiento-actividad").click());
    expect(leerActividadElegida()).toEqual({ id: ACTIVIDAD.id, name: "26-05 T", start_time: 1779800400, end_time: 1779807600 });
    expect(contenedor.textContent).toContain("Sesión elegida");
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/openfield/periods?activityId="))).toBe(true);
    expect(contenedor.textContent).toContain("WARM UP");

    await act(async () => botonPorTexto("Ir a Tareas").click());
    expect(contenedor.querySelector(".tareas-sesion-chip").textContent).toBe("26-05 T");
    expect(botonPorTexto("+ Nueva tarea")).toBeDefined();
  });

  test("al abrir con una sesión guardada arranca sobre ella", async () => {
    window.localStorage.setItem(CLAVE_ACTIVIDAD, JSON.stringify({ id: ACTIVIDAD.id, name: "26-05 T", start_time: 1779800400, end_time: 1779807600 }));
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    expect(contenedor.textContent).toContain("Sesión elegida");
    expect(contenedor.textContent).toContain("26-05 T");
    expect(botonPorTexto("Cambiar de sesión")).toBeDefined();
  });
});
