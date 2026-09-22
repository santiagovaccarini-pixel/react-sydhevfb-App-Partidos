import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TrainingModule, { CLAVE_VISTA } from "./TrainingModule";
import {
  CLAVE_ENTRENAMIENTOS,
  CLAVE_ENTRENAMIENTO_ACTUAL,
  etiquetaEntrenamiento,
  leerEntrenamientosLocales,
} from "./domain/entrenamiento.js";
import { CLAVE_ACTIVIDAD, CLAVE_SESION } from "./domain/sesionEntrenamiento.js";

// La base, doblada: lo que lista, lo que devuelve entero y lo que recibe.
const base = vi.hoisted(() => ({ lista: [], completo: null, guardados: [], borrados: [] }));

vi.mock("./domain/entrenamientosDb.js", () => ({
  listarEntrenamientosDb: vi.fn(async () => base.lista),
  leerEntrenamientoDb: vi.fn(async () => base.completo),
  guardarEntrenamientoDb: vi.fn(async (entrenamiento) => {
    base.guardados.push(entrenamiento);
    return true;
  }),
  borrarEntrenamientoDb: vi.fn(async (id) => {
    base.borrados.push(id);
    return true;
  }),
}));

vi.mock("./TrainingSettings", () => ({ default: () => <div>Ajustes de prueba</div> }));

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => ({ id: "eq-1", nombre: "Atlético Mineiro" }),
  esElCam: (nombre) => /mineiro/i.test(String(nombre || "")),
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

const tarea = (id, nombre, extra = {}) => ({
  id,
  nombre,
  fecha: "2026-05-26",
  inicio: "10:10:00",
  fin: "10:25:00",
  pausas: [],
  participantes: {},
  envio: null,
  ...extra,
});

const entrenamiento = (extra = {}) => ({
  id: "11111111-2222-4333-8444-555555555555",
  equipoId: "eq-1",
  fecha: "2026-05-26",
  nombre: "",
  tareas: [],
  actividad: null,
  asignaciones: {},
  ultimoEnvio: null,
  creadoEn: "2026-05-26T12:00:00.000Z",
  actualizadoEn: "2026-05-26T12:00:00.000Z",
  guardadoEn: "2026-05-26T12:00:00.000Z",
  ...extra,
});

const guardarLocal = (lista, actualId = "") => {
  window.localStorage.setItem(CLAVE_ENTRENAMIENTOS, JSON.stringify(lista));
  if (actualId) window.localStorage.setItem(CLAVE_ENTRENAMIENTO_ACTUAL, actualId);
};

const escribir = (input, valor) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("TrainingModule", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    window.localStorage.clear();
    base.lista = [];
    base.completo = null;
    base.guardados.length = 0;
    base.borrados.length = 0;
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    contenedor.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  const montar = async (props = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<TrainingModule onVolver={() => {}} email="x@y.z" onCerrarSesion={() => {}} {...props} />);
    });
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
  };

  const botonMovil = (texto) =>
    [...contenedor.querySelectorAll(".navegacion-movil button")].find((boton) => boton.textContent.trim() === texto);
  const botonPorTexto = (texto) =>
    [...contenedor.querySelectorAll("button")].find((boton) => boton.textContent.trim() === texto);
  const tituloActual = () => contenedor.querySelector("h1")?.textContent.trim();
  const filas = () => [...contenedor.querySelectorAll(".fila-entrenamiento")];

  test("usa el marco de Partido con Inicio, Tareas y Ajustes", async () => {
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    expect([...contenedor.querySelectorAll(".navegacion-movil button")].map((b) => b.textContent.trim())).toEqual([
      "Inicio",
      "Tareas",
      "Ajustes",
    ]);
    expect(contenedor.querySelector(".marca-aplicacion strong").textContent).toBe("Flujo diario");
    expect(contenedor.querySelector(".marco-aplicacion").classList.contains("entrenamiento-marco")).toBe(true);
    expect(contenedor.textContent).toContain("SIN ENTRENAMIENTO");
    expect(contenedor.textContent).toContain("Empezá el de hoy");
    expect(contenedor.textContent).toContain("Todavía no hay entrenamientos");
    expect(contenedor.textContent).not.toContain("←");

    await act(async () => botonMovil("Tareas").click());
    expect(contenedor.textContent).toContain("Primero empezá un entrenamiento");
    expect(botonMovil("Tareas").classList.contains("activo")).toBe(true);

    await act(async () => botonPorTexto("Ir a Inicio").click());
    expect(contenedor.textContent).toContain("SIN ENTRENAMIENTO");
    expect(botonMovil("Inicio").classList.contains("activo")).toBe(true);

    await act(async () => botonMovil("Ajustes").click());
    expect(contenedor.textContent).toContain("Ajustes de prueba");
  });

  test("empezar un entrenamiento lo guarda en el celular, lo sube a la base y abre Tareas", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-09-22T10:00:00"));
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    expect(contenedor.querySelector("#fecha-entrenamiento").value).toBe("2026-09-22");
    await act(async () => escribir(contenedor.querySelector("#nombre-entrenamiento"), "Turno tarde"));
    await act(async () => botonPorTexto("Ir a Entrenamiento").click());

    // Tareas, sobre el entrenamiento recién creado, sin sesión de OpenField.
    expect(tituloActual()).toBe(etiquetaEntrenamiento({ fecha: "2026-09-22", nombre: "Turno tarde" }));
    expect(botonMovil("Tareas").classList.contains("activo")).toBe(true);
    expect(contenedor.textContent).toContain("Sin sesión de OpenField: se elige al enviar.");
    const locales = leerEntrenamientosLocales();
    expect(locales).toHaveLength(1);
    expect(locales[0]).toMatchObject({ fecha: "2026-09-22", nombre: "Turno tarde", equipoId: "eq-1", actividad: null });
    expect(window.localStorage.getItem(CLAVE_ENTRENAMIENTO_ACTUAL)).toBe(locales[0].id);

    // Un momento después, sube a la base solo.
    expect(base.guardados).toHaveLength(0);
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    await act(async () => Promise.resolve());
    expect(base.guardados.map((e) => e.id)).toEqual([locales[0].id]);
    expect(contenedor.textContent).toContain("Guardado en la base");

    // Inicio muestra el entrenamiento actual.
    await act(async () => botonMovil("Inicio").click());
    expect(contenedor.textContent).toContain("ENTRENAMIENTO");
    expect(contenedor.textContent).toContain("Turno tarde · Sin sesión de OpenField todavía");
    expect(botonPorTexto("Ir a Entrenamiento")).toBeDefined();
    expect(botonPorTexto("Elegir la sesión de OpenField")).toBeDefined();
    expect(filas()).toHaveLength(1);
    expect(filas()[0].textContent).toContain("Sin tareas");
  });

  test("con un entrenamiento guardado en el celular arranca sobre él y Seguir registrando abre Tareas", async () => {
    guardarLocal(
      [entrenamiento({ tareas: [tarea("t1", "Rondo"), tarea("t2", "Posesión")], actividad: ACTIVIDAD_GUARDADA })],
      "11111111-2222-4333-8444-555555555555",
    );
    const fetchMock = fetchDeLectura();
    vi.stubGlobal("fetch", fetchMock);
    await montar();

    expect(contenedor.textContent).toContain("Sesión de OpenField: 26-05 T");
    const tarjeta = contenedor.querySelector(".tarjeta-en-curso");
    expect(tarjeta).not.toBeNull();
    expect(tarjeta.textContent).toContain("SIN ENVIAR");
    expect(tarjeta.textContent).toContain("26/05");
    expect(tarjeta.querySelector(".pastilla-vivo").classList.contains("sin-empezar")).toBe(true);
    expect(contenedor.querySelector(".estado-hero").textContent).toContain("SIN ENVIAR");
    expect(botonPorTexto("Seguir registrando")).toBeDefined();
    expect(botonPorTexto("Cambiar la sesión de OpenField")).toBeDefined();
    expect(filas()[0].textContent).toContain("2 tareas · Sesión 26-05 T");
    // Con sesión vinculada se leen sus bloques.
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/openfield/periods?activityId="))).toBe(true);
    expect(contenedor.textContent).toContain("WARM UP");

    await act(async () => botonPorTexto("Seguir registrando").click());
    expect(tituloActual()).toBe(etiquetaEntrenamiento({ fecha: "2026-05-26", nombre: "" }));
    expect(contenedor.querySelectorAll(".cinta-solapas button")).toHaveLength(2);
  });

  test("la lista muestra también los de la base, y abrir uno lo trae entero", async () => {
    base.lista = [
      { id: "99999999-2222-4333-8444-555555555555", equipoId: "eq-1", fecha: "2026-09-20", nombre: "Turno mañana", actividadId: "", actividadNombre: "", estado: "sin-enviar", tareas: 2, actualizadoEn: "2026-09-20T12:00:00.000Z", guardadoEn: "2026-09-20T12:00:00.000Z" },
    ];
    base.completo = entrenamiento({ id: "99999999-2222-4333-8444-555555555555", fecha: "2026-09-20", nombre: "Turno mañana", tareas: [tarea("t1", "Rondo"), tarea("t2", "Posesión")] });
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    expect(filas()).toHaveLength(1);
    expect(filas()[0].textContent).toContain("Turno mañana");
    expect(filas()[0].textContent).toContain("2 tareas");
    expect(filas()[0].textContent).toContain("en la base");

    await act(async () => filas()[0].click());
    await act(async () => Promise.resolve());
    expect(tituloActual()).toBe(etiquetaEntrenamiento({ fecha: "2026-09-20", nombre: "Turno mañana" }));
    expect(contenedor.querySelectorAll(".cinta-solapas button")).toHaveLength(2);
    // Quedó también en el celular.
    expect(leerEntrenamientosLocales().map((e) => e.nombre)).toEqual(["Turno mañana"]);
  });

  test("las sesiones del formato viejo se migran al abrir, con su sesión de OpenField", async () => {
    window.localStorage.setItem(CLAVE_ACTIVIDAD, JSON.stringify(ACTIVIDAD_GUARDADA));
    window.localStorage.setItem(
      `${CLAVE_SESION}:${ACTIVIDAD.id}`,
      JSON.stringify({ activityId: ACTIVIDAD.id, activityName: "26-05 T", tareas: [tarea("t1", "Rondo")], asignaciones: {}, ultimoEnvio: null }),
    );
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    expect(filas()).toHaveLength(1);
    expect(filas()[0].textContent).toContain("1 tarea · Sesión 26-05 T");
    expect(window.localStorage.getItem(`${CLAVE_SESION}:${ACTIVIDAD.id}`)).toBeNull();
    // Lo migrado todavía no estaba en la base: sube apenas se abre.
    await act(async () => Promise.resolve());
    expect(base.guardados.some((e) => e.actividad?.id === ACTIVIDAD.id && e.tareas.length === 1)).toBe(true);
  });

  test("desde Inicio se elige la sesión de OpenField del entrenamiento actual", async () => {
    guardarLocal([entrenamiento({ tareas: [tarea("t1", "Rondo")] })], "11111111-2222-4333-8444-555555555555");
    vi.stubGlobal("fetch", fetchDeLectura());
    await montar();

    expect(contenedor.textContent).toContain("Sin sesión de OpenField todavía");
    await act(async () => botonPorTexto("Elegir la sesión de OpenField").click());
    expect(tituloActual()).toBe("Sesión de OpenField");
    expect(botonMovil("Inicio").classList.contains("activo")).toBe(true);
    expect(contenedor.querySelector(".boton-volver").textContent.trim()).toBe("Volver a Inicio");

    await act(async () => contenedor.querySelector(".entrenamiento-actividad").click());
    expect(contenedor.textContent).toContain("Sesión de OpenField: 26-05 T");
    expect(leerEntrenamientosLocales()[0].actividad).toEqual(ACTIVIDAD_GUARDADA);
  });

  test("al reabrir arranca siempre en Inicio, y el botón Módulos vuelve al portal", async () => {
    window.localStorage.setItem(CLAVE_VISTA, JSON.stringify({ vista: "ajustes", vistaAjustes: "cuenta" }));
    vi.stubGlobal("fetch", fetchDeLectura());
    const onVolver = vi.fn();
    await montar({ onVolver });

    expect(contenedor.textContent).toContain("SIN ENTRENAMIENTO");
    expect(botonMovil("Inicio").classList.contains("activo")).toBe(true);
    expect(window.localStorage.getItem(CLAVE_VISTA)).toBeNull();

    await act(async () => botonPorTexto("Módulos").click());
    expect(onVolver).toHaveBeenCalledTimes(1);
  });
});
