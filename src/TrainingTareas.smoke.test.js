import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TrainingTareas from "./TrainingTareas";
import { CLAVE_SESION, cargarSesion, horaAMs } from "./domain/sesionEntrenamiento.js";

const dobles = vi.hoisted(() => ({ plantel: [], cargar: vi.fn() }));

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => ({ id: "eq-1", nombre: "Atlético Mineiro" }),
}));

vi.mock("./domain/plantel.js", () => ({
  cargarPlantelConCatapult: (...args) => dobles.cargar(...args),
}));

vi.mock("./supabase.js", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));

const ACTIVIDAD = {
  id: "9dffa100-99e5-4ce6-921f-226e9e01e264",
  name: "26-05 T",
  start_time: Math.floor(new Date("2026-05-26T09:00:00").getTime() / 1000),
  end_time: Math.floor(new Date("2026-05-26T11:00:00").getTime() / 1000),
};

const respuesta = (status, cuerpo) => ({ ok: status < 300, status, json: async () => cuerpo });

// Responde como el endpoint real: el plan y el envío salen de las tareas que
// llegan en el cuerpo, así el test no fija ids generados en la pantalla.
const fetchDeCortes = ({ plan, envio } = {}) =>
  vi.fn(async (url, opciones) => {
    if (url !== "/api/openfield/cortes") return respuesta(500, { ok: false, error: "sin ruta" });
    const body = JSON.parse(opciones.body);

    // Consulta: sin tareas. Lo que OpenField sabe de la sesión.
    if (body.soloPlan && body.tareas.length === 0) {
      if (plan) return plan(body);
      return respuesta(200, {
        ok: true,
        result: "consulta",
        activity: { id: ACTIVIDAD.id, name: "26-05 T", start_time_ms: horaAMs("2026-05-26", "09:00:00"), end_time_ms: horaAMs("2026-05-26", "11:00:00") },
        atletas: ["a1", "a2"],
      });
    }
    const tareasPlan = body.tareas.map((tarea) => ({
      tareaId: tarea.id,
      nombre: tarea.nombre,
      periodos: [
        { id: `p-${tarea.id}-1`, participantes: 1, principal: true },
        { id: `p-${tarea.id}-2`, participantes: 1, principal: false },
      ],
    }));

    if (body.soloPlan) {
      if (plan) return plan(body);
      return respuesta(200, {
        ok: true,
        result: "plan",
        escribio: false,
        activity: {
          id: ACTIVIDAD.id,
          name: "26-05 T",
          start_time_ms: horaAMs("2026-05-26", "10:00:00"),
          end_time_ms: horaAMs("2026-05-26", "10:07:00"),
        },
        resumen: { actuales: 8, preservados: 8, reemplazados: 0, nuevos: 2, eliminados: 0, total: 10 },
        tareas: tareasPlan,
        confirmacionRequerida: "26-05 T",
      });
    }

    if (envio) return envio(body);
    return respuesta(200, {
      ok: true,
      result: "cortes-enviados",
      escribio: true,
      resumen: { actuales: 8, preservados: 8, reemplazados: 0, nuevos: 2, eliminados: 0, total: 10 },
      asignaciones: Object.fromEntries(body.tareas.map((tarea) => [`${tarea.id}|a-b`, `p-${tarea.id}-1`])),
      tareas: tareasPlan.map((tarea) => ({ ...tarea, ok: true, fallidos: [] })),
      veredicto: { codigo: "cortes-validados", detalle: "2 período(s) exactos." },
    });
  });

const escribir = (input, valor) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const elegirOpcion = (select, valor) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
  setter.call(select, valor);
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

const tareaGuardada = (extra = {}) => ({
  id: "t1",
  nombre: "2. POSSE",
  fecha: "2026-05-26",
  inicio: "10:10:00",
  fin: "10:25:00",
  pausas: [],
  participantes: { 1: { modo: "total", inicio: "", fin: "" } },
  envio: null,
  ...extra,
});

describe("TrainingTareas", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    window.localStorage.clear();
    dobles.plantel = [
      { id: 1, nombre: "A MINDA", roles: [], puestos: [], catapult_id: "a1", catapult_nombre: "A MINDA (MIN)" },
      { id: 2, nombre: "IGOR GOMES", roles: [], puestos: [], catapult_id: "a2", catapult_nombre: "IGOR GOMES (GOM)" },
      { id: 3, nombre: "LEMOS", roles: [], puestos: [], catapult_id: null, catapult_nombre: null },
      // Vinculado, pero sin datos en 26-05 T.
      { id: 4, nombre: "ZARACHO", roles: [], puestos: [], catapult_id: "a9", catapult_nombre: "ZARACHO (ZAR)" },
    ];
    dobles.cargar.mockReset().mockImplementation(async () => ({ plantel: dobles.plantel }));
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    contenedor.remove();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  const montar = async (props = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<TrainingTareas actividad={ACTIVIDAD} onIrASesion={() => {}} {...props} />);
    });
    await act(async () => Promise.resolve());
  };

  const botonPorTexto = (texto) =>
    [...contenedor.querySelectorAll("button")].find((boton) => boton.textContent.trim() === texto);
  const porEtiqueta = (etiqueta) => contenedor.querySelector(`[aria-label='${etiqueta}']`);

  test("sin sesión elegida manda a elegirla", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const irASesion = vi.fn();
    await montar({ actividad: null, onIrASesion: irASesion });

    expect(contenedor.textContent).toContain("Primero elegí la sesión");
    await act(async () => botonPorTexto("Ir a Sesión").click());
    expect(irASesion).toHaveBeenCalledTimes(1);
  });

  test("carga una tarea completa, pide la vista previa y la envía confirmando el nombre", async () => {
    const fetchMock = fetchDeCortes();
    vi.stubGlobal("fetch", fetchMock);
    await montar();

    expect(dobles.cargar).toHaveBeenCalledWith("eq-1");
    const consulta = fetchMock.mock.calls.find(([url, opciones]) => url === "/api/openfield/cortes" && JSON.parse(opciones.body).tareas.length === 0);
    expect(JSON.parse(consulta[1].body)).toEqual({ activityId: ACTIVIDAD.id, soloPlan: true, tareas: [] });
    expect(contenedor.textContent).toContain("Datos en OpenField de 09:00:00 a 11:00:00");
    expect(contenedor.textContent).toContain("Todavía no hay tareas");
    expect(botonPorTexto("Vista previa del envío").disabled).toBe(true);

    await act(async () => botonPorTexto("+ Nueva tarea").click());
    expect(contenedor.textContent).toContain("Incompleta");

    const nombre = contenedor.querySelector("input[type='text']");
    expect(nombre.value).toBe("Tarea 1");
    await act(async () => escribir(nombre, "2. POSSE"));
    expect(contenedor.querySelector("input[type='date']").value).toBe("2026-05-26");

    await act(async () => {
      escribir(porEtiqueta("Inicio de la tarea"), "10:10:00");
      escribir(porEtiqueta("Fin de la tarea"), "10:25:00");
    });

    // Pausa con los botones, después se ajusta a mano para que el test sea fijo.
    await act(async () => botonPorTexto("Empezar pausa").click());
    expect(contenedor.textContent).toContain("en curso");
    await act(async () => botonPorTexto("Terminar pausa").click());
    expect(botonPorTexto("Empezar pausa")).toBeDefined();
    await act(async () => {
      escribir(porEtiqueta("Inicio pausa 1"), "10:16:20");
      escribir(porEtiqueta("Fin pausa 1"), "10:17:10");
    });
    expect(contenedor.textContent).toContain("1 pausa · total 0:50");

    // Jugadores: "Todos" marca solo a los vinculados con datos en la sesión;
    // LEMOS (sin vincular) y ZARACHO (sin datos en 26-05 T) quedan deshabilitados.
    await act(async () => botonPorTexto("Todos").click());
    const casillas = [...contenedor.querySelectorAll("input[type='checkbox']")];
    expect(casillas.map((casilla) => casilla.checked)).toEqual([true, true, false, false]);
    expect(casillas[2].disabled).toBe(true);
    expect(casillas[3].disabled).toBe(true);
    expect(contenedor.textContent).toContain("Sin datos en esta sesión");
    expect(contenedor.textContent).toContain("2 de 2 en la tarea");

    // IGOR con menos tiempo: arranca con el horario de la tarea y se corrige el inicio.
    await act(async () => elegirOpcion(porEtiqueta("Tiempo de IGOR GOMES"), "parcial"));
    expect(porEtiqueta("Desde, IGOR GOMES").value).toBe("10:10:00");
    expect(porEtiqueta("Hasta, IGOR GOMES").value).toBe("10:25:00");
    await act(async () => escribir(porEtiqueta("Desde, IGOR GOMES"), "10:15:00"));

    expect(contenedor.textContent).toContain("✓ Lista para enviar");
    expect(contenedor.textContent).toContain("14:10");
    expect(botonPorTexto("Vista previa del envío").disabled).toBe(false);

    await act(async () => botonPorTexto("Vista previa del envío").click());

    const llamadaPlan = fetchMock.mock.calls.find(([url, opciones]) => {
      const cuerpo = url === "/api/openfield/cortes" ? JSON.parse(opciones.body) : null;
      return cuerpo?.soloPlan && cuerpo.tareas.length > 0;
    });
    expect(llamadaPlan[1].headers.Authorization).toBe("Bearer tok");
    const cuerpoPlan = JSON.parse(llamadaPlan[1].body);
    expect(cuerpoPlan.activityId).toBe(ACTIVIDAD.id);
    expect(cuerpoPlan.asignaciones).toEqual({});
    expect(cuerpoPlan.tareas).toHaveLength(1);
    expect(cuerpoPlan.tareas[0]).toMatchObject({
      nombre: "2. POSSE",
      inicio: horaAMs("2026-05-26", "10:10:00"),
      fin: horaAMs("2026-05-26", "10:25:00"),
      pausas: [{ inicio: horaAMs("2026-05-26", "10:16:20"), fin: horaAMs("2026-05-26", "10:17:10") }],
      participantes: [
        { atletaId: "a1", modo: "total" },
        { atletaId: "a2", modo: "parcial", inicio: horaAMs("2026-05-26", "10:15:00"), fin: horaAMs("2026-05-26", "10:25:00") },
      ],
    });
    const tareaId = cuerpoPlan.tareas[0].id;

    const texto = contenedor.textContent;
    expect(texto).toContain("2 períodos nuevos");
    expect(texto).toContain("8 períodos que no son de la app quedan igual");
    expect(texto).toContain("2 períodos · 2 jugadores");

    const confirmacion = contenedor.querySelector("input[placeholder='26-05 T']");
    expect(botonPorTexto("Enviar a OpenField").disabled).toBe(true);
    await act(async () => escribir(confirmacion, "26-05 T"));
    expect(botonPorTexto("Enviar a OpenField").disabled).toBe(false);

    await act(async () => botonPorTexto("Enviar a OpenField").click());

    const llamadaEnvio = fetchMock.mock.calls.find(([url, opciones]) => url === "/api/openfield/cortes" && !JSON.parse(opciones.body).soloPlan);
    const cuerpoEnvio = JSON.parse(llamadaEnvio[1].body);
    expect(cuerpoEnvio.confirmacion).toBe("26-05 T");
    expect(cuerpoEnvio.tareas[0].id).toBe(tareaId);

    expect(contenedor.textContent).toContain("Todo quedó en OpenField tal cual se pidió");
    expect(contenedor.textContent).toContain("✓ 2. POSSE");
    expect(contenedor.querySelector(".tarea-estado").textContent).toBe("Enviada");

    const guardada = cargarSesion(ACTIVIDAD.id);
    expect(guardada.asignaciones).toEqual({ [`${tareaId}|a-b`]: `p-${tareaId}-1` });
    expect(guardada.tareas[0].envio.ok).toBe(true);
    expect(guardada.ultimoEnvio.codigo).toBe("cortes-validados");

    // Tocar la tarea después del envío la marca como cambiada.
    await act(async () => escribir(porEtiqueta("Fin de la tarea"), "10:26:00"));
    expect(contenedor.querySelector(".tarea-estado").textContent).toBe("Con cambios");
  });

  test("con una tarea incompleta no deja pedir la vista previa y dice qué falta", async () => {
    vi.stubGlobal("fetch", fetchDeCortes());
    await montar();

    await act(async () => botonPorTexto("+ Nueva tarea").click());
    await act(async () => escribir(contenedor.querySelector("input[type='text']"), "Rondo"));

    const texto = contenedor.textContent;
    expect(texto).toContain("Antes de enviar, completá: Rondo (Falta el inicio o el fin");
    expect(texto).toContain("No hay participantes.");
    expect(botonPorTexto("Vista previa del envío").disabled).toBe(true);
  });

  test("una tarea que termina después de los datos de la sesión queda incompleta y lo dice", async () => {
    window.localStorage.setItem(
      `${CLAVE_SESION}:${ACTIVIDAD.id}`,
      JSON.stringify({ activityId: ACTIVIDAD.id, activityName: "26-05 T", tareas: [tareaGuardada({ fin: "11:05:00" })], asignaciones: {}, ultimoEnvio: null }),
    );
    vi.stubGlobal("fetch", fetchDeCortes());
    await montar();

    expect(contenedor.querySelector(".tarea-estado").textContent).toBe("Incompleta");
    expect(contenedor.textContent).toContain("Antes de enviar, completá: 2. POSSE (Termina después de los datos de la sesión (11:00:00).");
    expect(botonPorTexto("Vista previa del envío").disabled).toBe(true);
  });

  test("vuelve a mostrar lo guardado en el celular y traduce los errores del servidor", async () => {
    window.localStorage.setItem(
      `${CLAVE_SESION}:${ACTIVIDAD.id}`,
      JSON.stringify({ activityId: ACTIVIDAD.id, activityName: "26-05 T", tareas: [tareaGuardada()], asignaciones: {}, ultimoEnvio: null }),
    );
    vi.stubGlobal(
      "fetch",
      fetchDeCortes({
        plan: () => respuesta(409, { ok: false, code: "SIN_CUENTA", error: "Todavía no conectaste tu cuenta de Catapult." }),
      }),
    );
    await montar();

    expect(contenedor.textContent).toContain("2. POSSE");
    expect(contenedor.textContent).toContain("10:10:00 → 10:25:00 · 1 jugador");
    expect(contenedor.querySelector(".tarea-estado").textContent).toBe("Sin enviar");

    await act(async () => botonPorTexto("Vista previa del envío").click());
    expect(contenedor.textContent).toContain("Todavía no conectaste tu cuenta de Catapult. Hacelo en Ajustes.");
  });

  test("borrar una tarea pide confirmación y avisa si ya estaba en OpenField", async () => {
    const enviada = tareaGuardada();
    window.localStorage.setItem(
      `${CLAVE_SESION}:${ACTIVIDAD.id}`,
      JSON.stringify({
        activityId: ACTIVIDAD.id,
        activityName: "26-05 T",
        tareas: [{ ...enviada, envio: { ok: true, fecha: "2026-05-26T13:00:00Z", huella: "vieja", fallidos: [] } }],
        asignaciones: { "t1|a-b": "p1" },
        ultimoEnvio: { fecha: "2026-05-26T13:00:00Z", ok: true, codigo: "cortes-validados", detalle: "" },
      }),
    );
    vi.stubGlobal("fetch", fetchDeCortes());
    await montar();

    expect(contenedor.textContent).toContain("Último envío");
    await act(async () => contenedor.querySelector(".tarea-cabecera").click());
    await act(async () => botonPorTexto("Borrar tarea").click());
    expect(contenedor.textContent).toContain("también se retira de OpenField");
    await act(async () => botonPorTexto("No").click());
    expect(contenedor.textContent).toContain("2. POSSE");

    await act(async () => botonPorTexto("Borrar tarea").click());
    await act(async () => botonPorTexto("Sí, borrar").click());
    expect(contenedor.textContent).toContain("Todavía no hay tareas");
    expect(cargarSesion(ACTIVIDAD.id).tareas).toEqual([]);
    // Las asignaciones se conservan: el próximo envío retira ese período.
    expect(cargarSesion(ACTIVIDAD.id).asignaciones).toEqual({ "t1|a-b": "p1" });
  });
});
