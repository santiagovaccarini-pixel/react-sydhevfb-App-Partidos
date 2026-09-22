import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TrainingModule, { CLAVE_VISTA } from "./TrainingModule";
import { CLAVE_ACTIVIDAD, CLAVE_SESION, leerActividadElegida } from "./domain/sesionEntrenamiento.js";

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

const ACTIVIDAD_GUARDADA = { id: ACTIVIDAD.id, name: "26-05 T", start_time: 1779800400, end_time: 1779807600 };

const fetchDeLectura = () =>
  vi.fn(async (url) => {
    if (url === "/api/openfield/activities") return respuesta(200, { ok: true, activities: [ACTIVIDAD] });
    if (String(url).startsWith("/api/openfield/periods")) {
      return respuesta(200, { ok: true, periods: [{ id: "p1", name: "WARM UP", start_ms: 1779800400000, end_ms: 1779801000000, duration_seconds: 600 }] });
    }
    return respuesta(500, { ok: false, error: "sin ruta" });
  });

const tarea = (id, nombre) => ({
  id,
  nombre,
  fecha: "2026-05-26",
  inicio: "10:10:00",
  fin: "10:25:00",
  pausas: [],
  participantes: {},
  envio: null,
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
      raiz.render(<TrainingModule onVolver={() => {}} email="x@y.z" onCerrarSesion={() => {}} />);
    });
    await act(async () => Promise.resolve());
  };

  const botonMovil = (texto) =>
    [...contenedor.querySelectorAll(".navegacion-movil button")].find((boton) => boton.textContent.trim() === texto);
  const botonPorTexto = (texto) =>
    [...contenedor.querySelectorAll("button")].find((boton) => boton.textContent.trim() === texto);
  const tituloActual = () => contenedor.querySelector("h1")?.textContent.trim();

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
    expect(contenedor.textContent).toContain("SIN SESIÓN");
    expect(contenedor.textContent).toContain("Todavía no elegiste la sesión");
    expect(contenedor.textContent).not.toContain("←");

    await act(async () => botonMovil("Tareas").click());
    expect(contenedor.textContent).toContain("Primero elegí la sesión");
    expect(botonMovil("Tareas").classList.contains("activo")).toBe(true);

    await act(async () => botonPorTexto("Ir a Sesión").click());
    expect(contenedor.textContent).toContain("SIN SESIÓN");
    expect(botonMovil("Sesión").classList.contains("activo")).toBe(true);

    await act(async () => botonMovil("Ajustes").click());
    expect(contenedor.textContent).toContain("Ajustes de prueba");
  });

  test("elegir una sesión la guarda en el celular y habilita Tareas", async () => {
    const fetchMock = fetchDeLectura();
    vi.stubGlobal("fetch", fetchMock);
    await montar();

    await act(async () => botonPorTexto("Elegir la sesión").click());
    expect(fetchMock).toHaveBeenCalledWith("/api/openfield/activities", expect.anything());
    expect(tituloActual()).toBe("Elegir sesión");
    expect(botonMovil("Sesión").classList.contains("activo")).toBe(true);
    expect(contenedor.querySelector(".cuenta-ajuste").textContent).toBe("1");
    expect(contenedor.querySelector(".boton-volver").textContent.trim()).toBe("Volver a Sesión");

    await act(async () => contenedor.querySelector(".entrenamiento-actividad").click());
    expect(leerActividadElegida()).toEqual(ACTIVIDAD_GUARDADA);
    expect(contenedor.textContent).toContain("SESIÓN ELEGIDA");
    expect(contenedor.textContent).toContain("26-05 T");
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/openfield/periods?activityId="))).toBe(true);
    expect(contenedor.textContent).toContain("Bloques de la sesión");
    expect(contenedor.textContent).toContain("WARM UP");
    expect(contenedor.querySelector(".tarjeta-en-curso")).toBeNull();

    await act(async () => botonPorTexto("Registrar tareas").click());
    expect(tituloActual()).toBe("Tareas");
    expect(botonMovil("Tareas").classList.contains("activo")).toBe(true);
    expect(botonPorTexto("+ Nueva tarea")).toBeDefined();
  });

  test("desde Elegir sesión se vuelve a Sesión sin elegir nada", async () => {
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    await act(async () => botonPorTexto("Elegir la sesión").click());
    expect(tituloActual()).toBe("Elegir sesión");

    await act(async () => botonPorTexto("Volver a Sesión").click());
    expect(contenedor.textContent).toContain("SIN SESIÓN");
    expect(leerActividadElegida()).toBeNull();
  });

  test("si no se pueden leer las sesiones avisa y deja reintentar", async () => {
    const fetchMock = vi.fn(async () => respuesta(500, { ok: false, error: "sin ruta" }));
    vi.stubGlobal("fetch", fetchMock);
    await montar();

    await act(async () => botonPorTexto("Elegir la sesión").click());
    expect(contenedor.textContent).toContain("No se pudieron cargar las sesiones");
    expect(contenedor.textContent).not.toContain("sin ruta");

    fetchMock.mockImplementation(fetchDeLectura());
    await act(async () => botonPorTexto("Reintentar").click());
    expect(contenedor.querySelector(".entrenamiento-actividad")).not.toBeNull();
  });

  test("al abrir con una sesión guardada arranca sobre ella", async () => {
    window.localStorage.setItem(CLAVE_ACTIVIDAD, JSON.stringify(ACTIVIDAD_GUARDADA));
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    expect(contenedor.textContent).toContain("SESIÓN ELEGIDA");
    expect(contenedor.textContent).toContain("26-05 T");
    expect(botonPorTexto("Cambiar de sesión")).toBeDefined();
    expect(botonPorTexto("Registrar tareas")).toBeDefined();
    expect(contenedor.textContent).toContain("WARM UP");
  });

  test("con tareas registradas muestra la tarjeta que lleva a Tareas", async () => {
    window.localStorage.setItem(CLAVE_ACTIVIDAD, JSON.stringify(ACTIVIDAD_GUARDADA));
    window.localStorage.setItem(
      `${CLAVE_SESION}:${ACTIVIDAD.id}`,
      JSON.stringify({
        activityId: ACTIVIDAD.id,
        activityName: "26-05 T",
        tareas: [tarea("t1", "Rondo"), tarea("t2", "Posesión")],
        asignaciones: {},
        ultimoEnvio: null,
      }),
    );
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    const tarjeta = contenedor.querySelector(".tarjeta-en-curso");
    expect(tarjeta).not.toBeNull();
    expect(tarjeta.textContent).toContain("SIN ENVIAR");
    expect(tarjeta.textContent).toContain("26/05");
    expect(tarjeta.querySelector(".pastilla-vivo").classList.contains("sin-empezar")).toBe(true);
    expect(contenedor.querySelector(".estado-hero").textContent).toContain("SIN ENVIAR");
    expect(botonPorTexto("Ver las tareas")).toBeDefined();

    await act(async () => tarjeta.click());
    expect(tituloActual()).toBe("Tareas");
    expect(botonMovil("Tareas").classList.contains("activo")).toBe(true);
  });

  test("con una tarea en curso lo marca en el inicio", async () => {
    window.localStorage.setItem(CLAVE_ACTIVIDAD, JSON.stringify(ACTIVIDAD_GUARDADA));
    window.localStorage.setItem(
      `${CLAVE_SESION}:${ACTIVIDAD.id}`,
      JSON.stringify({
        activityId: ACTIVIDAD.id,
        activityName: "26-05 T",
        tareas: [{ ...tarea("t1", "Rondo"), fin: "" }],
        asignaciones: {},
        ultimoEnvio: null,
      }),
    );
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    expect(contenedor.querySelector(".estado-hero").classList.contains("en-curso")).toBe(true);
    expect(contenedor.querySelector(".estado-hero").textContent).toContain("EN CURSO");
    expect(contenedor.querySelector(".pastilla-vivo").classList.contains("sin-empezar")).toBe(false);
  });

  test("al reabrir arranca siempre en Sesión, aunque haya quedado una pantalla guardada", async () => {
    window.localStorage.setItem(CLAVE_VISTA, JSON.stringify({ vista: "ajustes", vistaAjustes: "cuenta" }));
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    expect(contenedor.textContent).toContain("SIN SESIÓN");
    expect(botonMovil("Sesión").classList.contains("activo")).toBe(true);
    expect(window.localStorage.getItem(CLAVE_VISTA)).toBeNull();
  });

  test("el botón Módulos del inicio vuelve al portal", async () => {
    vi.stubGlobal("fetch", fetchDeLectura());
    const onVolver = vi.fn();
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<TrainingModule onVolver={onVolver} email="x@y" onCerrarSesion={() => {}} />);
    });
    await act(async () => Promise.resolve());

    await act(async () => botonPorTexto("Módulos").click());
    expect(onVolver).toHaveBeenCalledTimes(1);
  });
});
