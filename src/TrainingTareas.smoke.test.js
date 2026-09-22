import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TrainingTareas from "./TrainingTareas";
import { etiquetaEntrenamiento } from "./domain/entrenamiento.js";
import { horaAMs } from "./domain/sesionEntrenamiento.js";

const dobles = vi.hoisted(() => ({ plantel: [], cargar: vi.fn() }));

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => ({ id: "eq-1", nombre: "Atlético Mineiro" }),
  esElCam: (nombre) => /mineiro/i.test(String(nombre || "")),
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
    if (url === "/api/openfield/activities") {
      return respuesta(200, { ok: true, activities: [{ ...ACTIVIDAD, period_count: 3, venue: "Cidade do Galo" }] });
    }
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

// El entrenamiento sobre el que trabaja la pantalla, con la sesión 26-05 T ya
// vinculada salvo que se diga otra cosa.
const entrenamientoDePrueba = (tareas = [], extra = {}) => ({
  id: "11111111-2222-4333-8444-555555555555",
  equipoId: "eq-1",
  fecha: "2026-05-26",
  nombre: "",
  tareas,
  actividad: { id: ACTIVIDAD.id, name: "26-05 T", start_time: ACTIVIDAD.start_time, end_time: ACTIVIDAD.end_time },
  asignaciones: {},
  ultimoEnvio: null,
  creadoEn: "2026-05-26T12:00:00.000Z",
  actualizadoEn: "2026-05-26T12:00:00.000Z",
  guardadoEn: "",
  ...extra,
});

const TITULO = etiquetaEntrenamiento({ fecha: "2026-05-26", nombre: "" });

const hora = (texto) => new Date(`2026-05-26T${texto}`);

// La pantalla recibe el entrenamiento y avisa los cambios; acá los guarda un
// estado de prueba y `ultimo` deja ver el último valor.
const ultimo = { current: null };
function Arnes({ entrenamiento, ...resto }) {
  const [estado, setEstado] = useState(entrenamiento);
  ultimo.current = estado;
  return (
    <TrainingTareas
      entrenamiento={estado}
      onCambiar={(cambio) => setEstado((previo) => (typeof cambio === "function" ? cambio(previo) : { ...previo, ...cambio }))}
      onIrAInicio={() => {}}
      {...resto}
    />
  );
}

describe("TrainingTareas", () => {
  let contenedor;
  let raiz;
  let inicial;

  beforeEach(() => {
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    window.localStorage.clear();
    inicial = entrenamientoDePrueba();
    ultimo.current = null;
    // LEMOS va primero en la lista para comprobar que, sin chaleco, queda al final.
    dobles.plantel = [
      { id: 3, nombre: "LEMOS", roles: [], puestos: [], catapult_id: null, catapult_nombre: null },
      { id: 1, nombre: "A MINDA", roles: [], puestos: [], catapult_id: "a1", catapult_nombre: "A MINDA (MIN)" },
      { id: 2, nombre: "IGOR GOMES", roles: [], puestos: [], catapult_id: "a2", catapult_nombre: "IGOR GOMES (GOM)" },
      // Con chaleco, pero sin datos en 26-05 T.
      { id: 4, nombre: "ZARACHO", roles: [], puestos: [], catapult_id: "a9", catapult_nombre: "ZARACHO (ZAR)" },
    ];
    dobles.cargar.mockReset().mockImplementation(async () => ({ plantel: dobles.plantel }));
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    contenedor.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  const montar = async (props = {}) => {
    const entrenamiento = "entrenamiento" in props ? props.entrenamiento : inicial;
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<Arnes {...props} entrenamiento={entrenamiento} />);
    });
    await act(async () => Promise.resolve());
  };

  const relojFalso = (texto) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(hora(texto));
  };
  const botonPorTexto = (texto) =>
    [...contenedor.querySelectorAll("button")].find((boton) => boton.textContent.trim() === texto);
  const botonQueEmpieza = (texto) =>
    [...contenedor.querySelectorAll("button")].find((boton) => boton.textContent.trim().startsWith(texto));
  const porEtiqueta = (etiqueta) => contenedor.querySelector(`[aria-label='${etiqueta}']`);
  const pastilla = () => contenedor.querySelector(".estado-tarea").textContent;
  const casillas = () => [...contenedor.querySelectorAll("input[type='checkbox']")];
  const nombresDeLaHoja = () => [...contenedor.querySelectorAll(".fila-jugador .nombre-fila-jugador")].map((n) => n.textContent);
  const participantesGuardados = (indice = 0) => ultimo.current.tareas[indice].participantes;

  test("sin entrenamiento manda a empezar uno en Inicio", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const irAInicio = vi.fn();
    await montar({ entrenamiento: null, onIrAInicio: irAInicio });

    expect(contenedor.textContent).toContain("Primero empezá un entrenamiento");
    await act(async () => botonPorTexto("Ir a Inicio").click());
    expect(irAInicio).toHaveBeenCalledTimes(1);
  });

  test("sin sesión de OpenField, Enviar pide elegirla y recién después arma el resumen", async () => {
    inicial = entrenamientoDePrueba([tareaGuardada()], { actividad: null });
    const fetchMock = fetchDeCortes();
    vi.stubGlobal("fetch", fetchMock);
    await montar({ guardado: { estado: "guardado", hora: "10:12" } });

    expect(contenedor.textContent).toContain("Sin sesión de OpenField: se elige al enviar.");
    expect(contenedor.textContent).toContain("Guardado en la base 10:12.");
    // Sin sesión no hay nada que consultar.
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/openfield/cortes")).toBe(false);

    await act(async () => botonPorTexto("Enviar 1 tarea").click());
    expect(contenedor.querySelector("h1").textContent).toBe("¿A qué sesión van los cortes?");
    expect(botonPorTexto("Volver a Tareas")).toBeDefined();

    await act(async () => contenedor.querySelector(".entrenamiento-actividad").click());
    await act(async () => Promise.resolve());
    expect(ultimo.current.actividad.id).toBe(ACTIVIDAD.id);
    const llamadaPlan = fetchMock.mock.calls.find(([url, opciones]) => {
      const cuerpo = url === "/api/openfield/cortes" ? JSON.parse(opciones.body) : null;
      return cuerpo?.soloPlan && cuerpo.tareas.length > 0;
    });
    expect(JSON.parse(llamadaPlan[1].body).activityId).toBe(ACTIVIDAD.id);
    expect(contenedor.querySelector("h1").textContent).toBe("Enviar");
    expect(contenedor.textContent).toContain("26-05 T");
  });

  test("registra una tarea con los botones, la revisa y la envía confirmando el nombre", async () => {
    relojFalso("10:10:00");
    const fetchMock = fetchDeCortes();
    vi.stubGlobal("fetch", fetchMock);
    await montar();

    expect(dobles.cargar).toHaveBeenCalledWith("eq-1");
    const consulta = fetchMock.mock.calls.find(([url, opciones]) => url === "/api/openfield/cortes" && JSON.parse(opciones.body).tareas.length === 0);
    expect(JSON.parse(consulta[1].body)).toEqual({ activityId: ACTIVIDAD.id, soloPlan: true, tareas: [] });
    expect(contenedor.querySelector("h1").textContent).toBe(TITULO);
    expect(contenedor.textContent).toContain("Todavía no hay tareas");
    expect(botonPorTexto("Enviar").disabled).toBe(true);

    // La tarea nueva nace sin nombre ni hora; el nombre sale de una sugerencia.
    await act(async () => botonPorTexto("Nueva tarea").click());
    expect(pastilla()).toBe("Nueva");
    expect(contenedor.querySelector(".valor-reloj").textContent).toBe("00:00");
    expect(contenedor.querySelector(".cinta-solapas button.activo").textContent.trim()).toBe("1");
    const nombre = porEtiqueta("Nombre de la tarea");
    expect(nombre.value).toBe("");
    await act(async () => botonPorTexto("Posesión").click());
    expect(porEtiqueta("Nombre de la tarea").value).toBe("Posesión");
    await act(async () => escribir(porEtiqueta("Nombre de la tarea"), "2. POSSE"));
    expect(contenedor.querySelector("input[type='date']").value).toBe("2026-05-26");
    expect(botonPorTexto("Pausa").disabled).toBe(true);
    expect(botonPorTexto("Entra / Sale").disabled).toBe(true);

    await act(async () => botonPorTexto("Iniciar tarea").click());
    expect(porEtiqueta("Inicio de la tarea").value).toBe("10:10:00");
    expect(contenedor.querySelector(".badge-vivo").textContent).toContain("En curso");
    expect(pastilla()).toBe("En curso");
    expect(botonPorTexto("Pausa").disabled).toBe(false);

    // Pausa con el botón chico: aparece en la tarjeta de pausas.
    vi.setSystemTime(hora("10:16:20"));
    await act(async () => botonPorTexto("Pausa").click());
    expect(contenedor.querySelector(".lista-pausas").textContent).toContain("10:16:20 → en curso");
    expect(contenedor.querySelector(".badge-vivo").textContent).toContain("En pausa");
    expect(pastilla()).toBe("En pausa");
    vi.setSystemTime(hora("10:17:10"));
    await act(async () => botonPorTexto("Terminar pausa").click());
    expect(contenedor.querySelector(".lista-pausas").textContent).toContain("10:16:20 → 10:17:10");
    expect(contenedor.querySelector(".cabeza-pausas").textContent).toContain("1 pausa · 00:50");
    expect(botonPorTexto("Pausa")).toBeDefined();

    // Jugadores, en la hoja: "Todos" marca solo a los que tienen chaleco y
    // datos en la sesión; LEMOS (sin chaleco) y ZARACHO (sin datos) quedan
    // apagados.
    await act(async () => botonQueEmpieza("Jugadores").click());
    expect(contenedor.querySelector(".hoja-inferior h3").textContent).toBe("Jugadores en 2. POSSE");
    await act(async () => botonPorTexto("Todos").click());
    // Los que se pueden tildar primero; sin chaleco o sin datos, al final.
    expect(nombresDeLaHoja()).toEqual(["A MINDA", "IGOR GOMES", "LEMOS", "ZARACHO"]);
    expect(casillas().map((casilla) => casilla.checked)).toEqual([true, true, false, false]);
    expect(casillas()[2].disabled).toBe(true);
    expect(casillas()[3].disabled).toBe(true);
    expect(contenedor.textContent).toContain("sin chaleco");
    expect(contenedor.textContent).toContain("sin datos");
    expect(contenedor.textContent).toContain("2 de 2 en la tarea");
    await act(async () => botonPorTexto("Listo").click());
    expect(contenedor.querySelector(".hoja-inferior")).toBeNull();
    expect(botonQueEmpieza("Jugadores").textContent).toContain("Jugadores · 2");

    // IGOR con menos tiempo, desde Ajustar: arranca con el horario de la tarea.
    await act(async () => elegirOpcion(porEtiqueta("Tiempo de IGOR GOMES"), "parcial"));
    expect(porEtiqueta("Desde, IGOR GOMES").value).toBe("10:10:00");
    expect(porEtiqueta("Hasta, IGOR GOMES").value).toBe("");
    await act(async () => escribir(porEtiqueta("Desde, IGOR GOMES"), "10:15:00"));

    vi.setSystemTime(hora("10:25:00"));
    await act(async () => botonPorTexto("Terminar tarea").click());
    expect(porEtiqueta("Fin de la tarea").value).toBe("10:25:00");
    // Terminar completa el fin del que tenía menos tiempo.
    expect(porEtiqueta("Hasta, IGOR GOMES").value).toBe("10:25:00");
    expect(pastilla()).toBe("Sin enviar");
    expect(contenedor.querySelector(".valor-reloj").textContent).toBe("15:00");
    expect(contenedor.querySelector(".efectivo-reloj").textContent).toContain("Efectivo 14:10");
    expect(botonPorTexto("Nueva tarea")).toBeDefined();
    expect(botonPorTexto("Enviar 1 tarea").disabled).toBe(false);

    await act(async () => botonPorTexto("Enviar 1 tarea").click());

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

    // La subpantalla de envío: qué va a pasar y la confirmación.
    expect(contenedor.querySelector("h1").textContent).toBe("Enviar");
    const datos = [...contenedor.querySelectorAll(".dato-detalle")].map((fila) => [fila.querySelector("span").textContent, fila.querySelector("strong").textContent]);
    expect(datos).toContainEqual(["Tareas nuevas", "2"]);
    expect(datos).toContainEqual(["Lo que ya estaba y queda igual", "8"]);
    expect(contenedor.textContent).toContain("2 bloques · 2 jugadores");

    const confirmacion = contenedor.querySelector("input[placeholder='26-05 T']");
    expect(botonPorTexto("Enviar").disabled).toBe(true);
    await act(async () => escribir(confirmacion, "26-05 T"));
    expect(botonPorTexto("Enviar").disabled).toBe(false);

    await act(async () => botonPorTexto("Enviar").click());

    const llamadaEnvio = fetchMock.mock.calls.find(([url, opciones]) => url === "/api/openfield/cortes" && !JSON.parse(opciones.body).soloPlan);
    const cuerpoEnvio = JSON.parse(llamadaEnvio[1].body);
    expect(cuerpoEnvio.confirmacion).toBe("26-05 T");
    expect(cuerpoEnvio.tareas[0].id).toBe(tareaId);

    expect(contenedor.textContent).toContain("Todo quedó guardado en la sesión");
    expect(contenedor.textContent).toContain("✓ 2. POSSE");
    // Después del resultado queda solo Volver.
    expect(botonPorTexto("Enviar")).toBeUndefined();

    const guardada = ultimo.current;
    expect(guardada.asignaciones).toEqual({ [`${tareaId}|a-b`]: `p-${tareaId}-1` });
    expect(guardada.tareas[0].envio.ok).toBe(true);
    expect(guardada.ultimoEnvio.codigo).toBe("cortes-validados");

    await act(async () => botonPorTexto("Volver a Tareas").click());
    expect(contenedor.querySelector("h1").textContent).toBe(TITULO);
    expect(pastilla()).toBe("Enviada");
    expect(contenedor.textContent).toContain("Último envío");

    // Tocar la tarea después del envío la marca como cambiada.
    await act(async () => escribir(porEtiqueta("Fin de la tarea"), "10:26:00"));
    expect(pastilla()).toBe("Con cambios");
  });

  test("con una tarea incompleta, Enviar abre la lista y dice qué falta", async () => {
    relojFalso("10:10:00");
    const fetchMock = fetchDeCortes();
    vi.stubGlobal("fetch", fetchMock);
    await montar();

    await act(async () => botonPorTexto("Nueva tarea").click());
    await act(async () => botonPorTexto("Iniciar tarea").click());
    vi.setSystemTime(hora("10:20:00"));
    await act(async () => botonPorTexto("Terminar tarea").click());

    // Sin nombre queda incompleta, y lo dice bajo la tarjeta.
    expect(pastilla()).toBe("Incompleta");
    expect(contenedor.textContent).toContain("Falta el nombre.");

    // La primera tarea arranca con todos los que tienen chaleco y datos.
    await act(async () => botonQueEmpieza("Jugadores").click());
    expect(casillas().map((c) => c.checked)).toEqual([true, true, false, false]);
    await act(async () => botonPorTexto("Ninguno").click());
    expect(contenedor.textContent).toContain("0 de 2 en la tarea");
    await act(async () => botonPorTexto("Listo").click());
    expect(contenedor.textContent).toContain("Elegí al menos un jugador.");

    await act(async () => botonPorTexto("Enviar 1 tarea").click());
    expect(contenedor.querySelector(".hoja-inferior h3").textContent).toBe(`Tareas de ${TITULO}`);
    expect(contenedor.textContent).toContain("Antes de enviar, completá: Tarea 1.");
    // No se pidió el resumen ni se pasó a la pantalla de envío.
    expect(fetchMock.mock.calls.some(([url, opciones]) => url === "/api/openfield/cortes" && JSON.parse(opciones.body).tareas.length > 0)).toBe(false);
    await act(async () => botonPorTexto("Cerrar").click());
    expect(contenedor.querySelector("h1").textContent).toBe(TITULO);
  });

  test("una tarea que termina después de los datos de la sesión queda incompleta y lo dice", async () => {
    inicial = entrenamientoDePrueba([tareaGuardada({ fin: "11:05:00" })]);
    vi.stubGlobal("fetch", fetchDeCortes());
    await montar();

    expect(pastilla()).toBe("Incompleta");
    expect(contenedor.textContent).toContain("Termina después de los datos de la sesión (11:00).");
    await act(async () => botonPorTexto("Enviar 1 tarea").click());
    expect(contenedor.textContent).toContain("Antes de enviar, completá: 2. POSSE.");
  });

  test("vuelve a mostrar lo guardado en el celular y traduce los errores del servidor", async () => {
    inicial = entrenamientoDePrueba([tareaGuardada()]);
    vi.stubGlobal(
      "fetch",
      fetchDeCortes({
        plan: () => respuesta(409, { ok: false, code: "SIN_CUENTA", error: "Todavía no conectaste tu cuenta de Catapult." }),
      }),
    );
    await montar();

    expect(porEtiqueta("Nombre de la tarea").value).toBe("2. POSSE");
    expect(contenedor.querySelector(".pie-solapas p").textContent).toBe("Tarea 1 de 1 · 10:10:00 → 10:25:00");
    expect(contenedor.querySelector(".valor-reloj").textContent).toBe("15:00");
    expect(botonQueEmpieza("Jugadores").textContent).toContain("Jugadores · 1");
    expect(pastilla()).toBe("Sin enviar");

    await act(async () => botonPorTexto("Enviar 1 tarea").click());
    expect(contenedor.textContent).toContain("Todavía no conectaste tu usuario. Hacelo en Ajustes › Usuario y contraseña.");
    // Con error no se pasa a la subpantalla de envío, y el aviso se puede cerrar.
    expect(contenedor.querySelector("h1").textContent).toBe(TITULO);
    await act(async () => botonPorTexto("Cerrar").click());
    expect(contenedor.textContent).not.toContain("No se pudo enviar");
  });

  test("sin señal avisa una sola vez y deja seguir registrando", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await montar();

    expect(contenedor.textContent).toContain("Sin conexión");
    expect(contenedor.textContent).toContain("Sesión de OpenField: 26-05 T");
    expect(contenedor.querySelectorAll(".aviso-base")).toHaveLength(1);
    expect(botonPorTexto("Reintentar")).toBeDefined();

    await act(async () => botonPorTexto("Nueva tarea").click());
    expect(contenedor.querySelectorAll(".aviso-base")).toHaveLength(1);
    expect(porEtiqueta("Nombre de la tarea").value).toBe("");
  });

  test("Nueva tarea no arranca sola; Iniciar y Terminar ponen la hora actual", async () => {
    // Fuera de los datos de la sesión (09:00 a 11:00) igual se registra; la
    // ventana se controla al enviar.
    relojFalso("12:00:00");
    vi.stubGlobal("fetch", fetchDeCortes());
    await montar();

    await act(async () => botonPorTexto("Nueva tarea").click());
    expect(porEtiqueta("Inicio de la tarea").value).toBe("");
    expect(botonPorTexto("Iniciar tarea")).toBeDefined();
    expect(botonPorTexto("Terminar tarea")).toBeUndefined();

    await act(async () => botonPorTexto("Iniciar tarea").click());
    expect(porEtiqueta("Inicio de la tarea").value).toBe("12:00:00");
    vi.setSystemTime(hora("12:04:30"));
    await act(async () => botonPorTexto("Terminar tarea").click());
    expect(porEtiqueta("Fin de la tarea").value).toBe("12:04:30");
    expect(botonPorTexto("Terminar tarea")).toBeUndefined();
    expect(contenedor.querySelector(".cinta-solapas button.activo").textContent).toContain("1");
    expect(contenedor.textContent).toContain("Termina después de los datos de la sesión (11:00).");
  });

  test("la segunda tarea nace con los jugadores elegibles de la primera, y Ver todas cambia de solapa", async () => {
    // La primera tarea tiene a A MINDA (elegible), LEMOS (sin chaleco) y
    // ZARACHO (sin datos en la sesión): solo el primero pasa a la siguiente.
    inicial = entrenamientoDePrueba([
      tareaGuardada({
        participantes: {
          1: { modo: "parcial", inicio: "10:12:00", fin: "10:20:00" },
          3: { modo: "total", inicio: "", fin: "" },
          4: { modo: "total", inicio: "", fin: "" },
        },
      }),
    ]);
    vi.stubGlobal("fetch", fetchDeCortes());
    await montar();

    await act(async () => botonPorTexto("Nueva tarea").click());
    expect(contenedor.querySelector(".panel-tarea .sobrelinea").textContent).toBe("TAREA 2 DE 2");
    expect(contenedor.querySelectorAll(".cinta-solapas button")).toHaveLength(2);
    expect(contenedor.querySelector(".cinta-solapas button.activo").textContent.trim()).toBe("2");
    // Entra con toda la tarea, sin arrastrar el tiempo parcial de la anterior.
    expect(participantesGuardados(1)).toEqual({ 1: { modo: "total", inicio: "", fin: "" } });

    await act(async () => botonQueEmpieza("Jugadores").click());
    expect(casillas().map((c) => c.checked)).toEqual([true, false, false, false]);
    expect(contenedor.textContent).toContain("1 de 2 en la tarea");
    // "Ninguno" y "Como la anterior" vuelven a dejar a los mismos.
    await act(async () => botonPorTexto("Ninguno").click());
    expect(contenedor.textContent).toContain("0 de 2 en la tarea");
    await act(async () => botonPorTexto("Como la anterior").click());
    expect(contenedor.textContent).toContain("1 de 2 en la tarea");
    await act(async () => botonPorTexto("Listo").click());

    // Ver todas: la lista completa, y tocar una tarea la vuelve activa.
    await act(async () => botonPorTexto("Ver todas").click());
    const filas = [...contenedor.querySelectorAll(".hoja-inferior .fila-tarea-lista")];
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain("2. POSSE");
    // LEMOS sin chaleco y ZARACHO sin datos la dejan incompleta.
    expect(filas[0].textContent).toContain("Incompleta");
    expect(filas[1].textContent).toContain("Sin nombre");
    expect(filas[1].textContent).toContain("Sin iniciar");
    await act(async () => filas[0].click());
    expect(contenedor.querySelector(".hoja-inferior")).toBeNull();
    expect(contenedor.querySelector(".panel-tarea .sobrelinea").textContent).toBe("TAREA 1 DE 2");
    expect(porEtiqueta("Nombre de la tarea").value).toBe("2. POSSE");

    // La solapa lleva a la otra tarea.
    await act(async () => porEtiqueta("Tarea 2").click());
    expect(contenedor.querySelector(".panel-tarea .sobrelinea").textContent).toBe("TAREA 2 DE 2");
  });

  test("Entra / Sale deja al jugador con menos tiempo desde o hasta ahora, y Deshacer lo revierte", async () => {
    relojFalso("10:10:00");
    vi.stubGlobal("fetch", fetchDeCortes());
    await montar();

    await act(async () => botonPorTexto("Nueva tarea").click());
    await act(async () => botonPorTexto("Iniciar tarea").click());
    vi.setSystemTime(hora("10:15:00"));
    await act(async () => botonPorTexto("Entra / Sale").click());
    expect(contenedor.querySelector(".hoja-inferior h3").textContent).toBe("Entra / Sale");

    // IGOR se va antes: queda desde el inicio de la tarea hasta ahora.
    await act(async () => porEtiqueta("Sale ahora, IGOR GOMES").click());
    expect(participantesGuardados()[2]).toEqual({ modo: "parcial", inicio: "10:10:00", fin: "10:15:00" });
    expect(contenedor.textContent).toContain("10:10 → 10:15");
    await act(async () => porEtiqueta("Deshacer, IGOR GOMES").click());
    expect(participantesGuardados()[2]).toEqual({ modo: "total", inicio: "", fin: "" });
    await act(async () => botonPorTexto("Listo").click());

    // A MINDA no estaba y se suma tarde: entra desde ahora, sin fin todavía.
    await act(async () => botonQueEmpieza("Jugadores").click());
    await act(async () => botonPorTexto("Ninguno").click());
    await act(async () => botonPorTexto("Listo").click());
    await act(async () => botonPorTexto("Entra / Sale").click());
    await act(async () => porEtiqueta("Entra ahora, A MINDA").click());
    expect(participantesGuardados()[1]).toEqual({ modo: "parcial", inicio: "10:15:00", fin: "" });
    expect(contenedor.textContent).toContain("Desde 10:15");
    await act(async () => botonPorTexto("Listo").click());

    // Al terminar la tarea, su fin se completa solo.
    vi.setSystemTime(hora("10:25:00"));
    await act(async () => botonPorTexto("Terminar tarea").click());
    expect(participantesGuardados()[1]).toEqual({ modo: "parcial", inicio: "10:15:00", fin: "10:25:00" });
  });

  test("el reloj cuenta desde la hora de hoy aunque la sesión sea de otro día, y el tachito saca la pausa", async () => {
    // Prueba sobre 26-05 T hecha otro día: la tarea guarda la fecha de la
    // sesión, pero el reloj corre con la hora de hoy.
    inicial = entrenamientoDePrueba([tareaGuardada({ fin: "", pausas: [{ inicio: "10:12:00", fin: "10:13:00" }, { inicio: "10:14:00", fin: "" }] })]);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-22T10:16:00"));
    vi.stubGlobal("fetch", fetchDeCortes());
    await montar();

    expect(contenedor.querySelector(".valor-reloj").textContent).toBe("06:00");
    expect(contenedor.querySelector(".efectivo-reloj").textContent).toContain("Efectivo 03:00 · en pausa desde 10:14:00");
    expect(contenedor.querySelector(".lista-pausas").textContent).toContain("02:00");

    // El tachito de la pausa abierta la saca: la tarea sigue en curso, sin pausa.
    await act(async () => contenedor.querySelector(".lista-pausas .quitar-pausa").click());
    expect(contenedor.querySelector(".badge-vivo").textContent).toContain("En curso");
    expect(contenedor.querySelector(".cabeza-pausas").textContent).toContain("1 pausa · 01:00");
    expect(ultimo.current.tareas[0].pausas).toEqual([{ inicio: "10:12:00", fin: "10:13:00" }]);
    await act(async () => contenedor.querySelector(".lista-pausas .quitar-pausa").click());
    expect(contenedor.textContent).toContain("Sin pausas");
    expect(contenedor.querySelector(".valor-reloj").textContent).toBe("06:00");
  });

  test("borrar una tarea pide confirmación y avisa que también se saca de la sesión", async () => {
    inicial = entrenamientoDePrueba([{ ...tareaGuardada(), envio: { ok: true, fecha: "2026-05-26T13:00:00Z", huella: "vieja", fallidos: [] } }], {
      asignaciones: { "t1|a-b": "p1" },
      ultimoEnvio: { fecha: "2026-05-26T13:00:00Z", ok: true, codigo: "cortes-validados", detalle: "" },
    });
    vi.stubGlobal("fetch", fetchDeCortes());
    await montar();

    expect(contenedor.textContent).toContain("Último envío");
    expect(contenedor.textContent).toContain("todo bien");
    await act(async () => porEtiqueta("Borrar tarea").click());
    expect(contenedor.querySelector(".hoja-confirmar h3").textContent).toBe("¿Borrar esta tarea?");
    expect(contenedor.textContent).toContain("también se saca de la sesión");
    await act(async () => botonPorTexto("No").click());
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(porEtiqueta("Nombre de la tarea").value).toBe("2. POSSE");

    await act(async () => porEtiqueta("Borrar tarea").click());
    await act(async () => botonPorTexto("Sí, borrar").click());
    expect(contenedor.textContent).toContain("Todavía no hay tareas");
    // Sin tareas, el botón de la cabecera queda apagado.
    expect(porEtiqueta("Borrar tarea").disabled).toBe(true);
    expect(ultimo.current.tareas).toEqual([]);
    // Las asignaciones se conservan: el próximo envío saca esa tarea de la sesión.
    expect(ultimo.current.asignaciones).toEqual({ "t1|a-b": "p1" });
  });
});
