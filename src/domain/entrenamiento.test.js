import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  CLAVE_ENTRENAMIENTOS,
  CLAVE_ENTRENAMIENTO_ACTUAL,
  etiquetaEntrenamiento,
  fechaCorta,
  fechaLarga,
  generarIdEntrenamiento,
  guardarEntrenamientoActualId,
  guardarEntrenamientosLocales,
  leerEntrenamientoActualId,
  leerEntrenamientosLocales,
  masNuevo,
  migrarSesionesViejas,
  normalizarEntrenamiento,
  nuevoEntrenamiento,
  recortarLocales,
  resumenEntrenamiento,
  resumenLocal,
  sinSubir,
  vincularActividad,
} from "./entrenamiento.js";
import { CLAVE_ACTIVIDAD, CLAVE_SESION } from "./sesionEntrenamiento.js";

const tarea = (extra = {}) => ({
  id: "t1",
  nombre: "Rondo",
  fecha: "2026-09-22",
  inicio: "10:10:00",
  fin: "10:20:00",
  pausas: [],
  participantes: { 1: { modo: "total", inicio: "", fin: "" } },
  envio: null,
  ...extra,
});

const ACTIVIDAD = { id: "9dffa100-99e5-4ce6-921f-226e9e01e264", name: "26-05 T", start_time: 1779822758, end_time: 1779824460 };

describe("entrenamiento: modelo", () => {
  test("nuevoEntrenamiento arranca en la fecha pedida (o la de hoy) y sin sesión de OpenField", () => {
    const ahora = new Date("2026-09-22T10:00:00");
    const nuevo = nuevoEntrenamiento({ fecha: "2026-09-21", nombre: "  Turno tarde ", equipoId: "eq-1", ahora });
    expect(nuevo.fecha).toBe("2026-09-21");
    expect(nuevo.nombre).toBe("Turno tarde");
    expect(nuevo.equipoId).toBe("eq-1");
    expect(nuevo.actividad).toBeNull();
    expect(nuevo.tareas).toEqual([]);
    expect(nuevo.guardadoEn).toBe("");
    expect(nuevo.actualizadoEn).toBe(ahora.toISOString());
    expect(nuevo.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(generarIdEntrenamiento()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    // Fecha inválida: la de hoy.
    expect(nuevoEntrenamiento({ fecha: "ayer", ahora }).fecha).toBe("2026-09-22");
  });

  test("normalizarEntrenamiento limpia lo guardado y descarta lo que no tiene id", () => {
    expect(normalizarEntrenamiento(null)).toBeNull();
    expect(normalizarEntrenamiento({ id: "" })).toBeNull();
    const limpio = normalizarEntrenamiento({
      id: "e1",
      fecha: "2026-09-22",
      nombre: " Turno ",
      tareas: [tarea(), { id: "" }],
      actividad: ACTIVIDAD,
      asignaciones: { "t1|a": "p1" },
      ultimoEnvio: { ok: true },
      creadoEn: "2026-09-22T10:00:00.000Z",
    });
    expect(limpio.nombre).toBe("Turno");
    expect(limpio.tareas).toHaveLength(1);
    expect(limpio.actividad).toEqual({ id: ACTIVIDAD.id, name: "26-05 T", start_time: 1779822758, end_time: 1779824460 });
    expect(limpio.asignaciones).toEqual({ "t1|a": "p1" });
    expect(limpio.actualizadoEn).toBe("2026-09-22T10:00:00.000Z");
    expect(limpio.guardadoEn).toBe("");
  });

  test("resumenEntrenamiento dice si está vacío, en curso, sin enviar o enviado", () => {
    expect(resumenEntrenamiento({ tareas: [] }).estado).toBe("vacio");
    expect(resumenEntrenamiento({ tareas: [tarea({ fin: "" })] })).toMatchObject({ estado: "en-curso", enCurso: true, tareas: 1 });
    expect(resumenEntrenamiento({ tareas: [tarea()] })).toMatchObject({ estado: "sin-enviar", pendientes: 1, sinEnviar: 1 });
    const enviada = tarea();
    const conEnvio = { ...enviada, envio: { ok: true, huella: JSON.stringify({ nombre: "Rondo", fecha: "2026-09-22", inicio: "10:10:00", fin: "10:20:00", pausas: [], participantes: { 1: { modo: "total", inicio: "", fin: "" } } }), fallidos: [] } };
    expect(resumenEntrenamiento({ tareas: [conEnvio] }).estado).toBe("enviado");
    expect(resumenLocal({ ...nuevoEntrenamiento({ fecha: "2026-09-22" }), actividad: ACTIVIDAD, tareas: [tarea()] })).toMatchObject({ actividadNombre: "26-05 T", estado: "sin-enviar", tareas: 1 });
  });

  test("las fechas se escriben sin que el huso las corra", () => {
    expect(fechaCorta("2026-09-22")).toBe("22/09");
    expect(fechaLarga("2026-09-22")).toMatch(/martes.*22.*septiembre/);
    expect(etiquetaEntrenamiento({ fecha: "2026-09-22", nombre: "Turno tarde" })).toMatch(/22\/09 · Turno tarde$/);
    expect(etiquetaEntrenamiento({ fecha: "2026-09-22", nombre: "" })).toMatch(/22\/09$/);
  });

  test("vincular otra sesión de OpenField deja las tareas como sin enviar; la misma no toca nada", () => {
    const base = { ...nuevoEntrenamiento({ fecha: "2026-09-22" }), actividad: ACTIVIDAD, asignaciones: { "t1|a": "p1" }, ultimoEnvio: { ok: true }, tareas: [tarea({ envio: { ok: true, huella: "x", fallidos: [] } })] };
    const igual = vincularActividad(base, ACTIVIDAD);
    expect(igual.asignaciones).toEqual({ "t1|a": "p1" });
    expect(igual.tareas[0].envio).not.toBeNull();

    const otra = vincularActividad(base, { id: "otra", name: "27-05 T" });
    expect(otra.actividad.id).toBe("otra");
    expect(otra.asignaciones).toEqual({});
    expect(otra.ultimoEnvio).toBeNull();
    expect(otra.tareas[0].envio).toBeNull();
  });

  test("recortarLocales conserva los últimos y nunca suelta uno que no subió a la base", () => {
    const lista = Array.from({ length: 5 }, (_, i) => ({
      ...nuevoEntrenamiento({ fecha: `2026-09-0${i + 1}`, ahora: new Date(`2026-09-0${i + 1}T10:00:00`) }),
      id: `e${i + 1}`,
      guardadoEn: i === 0 ? "" : `2026-09-0${i + 1}T10:00:00.000Z`,
    }));
    const recortada = recortarLocales(lista, 3);
    expect(recortada.map((e) => e.id)).toEqual(["e5", "e4", "e1"]);
    expect(sinSubir(lista[0])).toBe(true);
    expect(sinSubir(lista[1])).toBe(false);
    expect(sinSubir({ ...lista[1], actualizadoEn: "2026-09-02T11:00:00.000Z" })).toBe(true);
  });

  test("masNuevo elige la copia más reciente", () => {
    const local = { id: "e1", actualizadoEn: "2026-09-22T10:00:00.000Z" };
    const remoto = { id: "e1", actualizadoEn: "2026-09-22T10:05:00.000Z" };
    expect(masNuevo(local, remoto)).toBe(remoto);
    expect(masNuevo(remoto, local)).toBe(remoto);
    expect(masNuevo(null, remoto)).toBe(remoto);
    expect(masNuevo(local, null)).toBe(local);
  });
});

describe("entrenamiento: lo guardado en el celular", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  test("la lista y el actual van y vuelven del celular", () => {
    const uno = { ...nuevoEntrenamiento({ fecha: "2026-09-22" }), tareas: [tarea()] };
    expect(guardarEntrenamientosLocales([uno])).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(CLAVE_ENTRENAMIENTOS))).toHaveLength(1);
    expect(leerEntrenamientosLocales()[0]).toMatchObject({ id: uno.id, fecha: "2026-09-22" });
    expect(leerEntrenamientosLocales()[0].tareas[0].nombre).toBe("Rondo");

    guardarEntrenamientoActualId(uno.id);
    expect(window.localStorage.getItem(CLAVE_ENTRENAMIENTO_ACTUAL)).toBe(uno.id);
    expect(leerEntrenamientoActualId()).toBe(uno.id);
    guardarEntrenamientoActualId("");
    expect(leerEntrenamientoActualId()).toBe("");

    window.localStorage.setItem(CLAVE_ENTRENAMIENTOS, "basura");
    expect(leerEntrenamientosLocales()).toEqual([]);
  });

  test("las sesiones del formato viejo pasan a entrenamientos con la sesión vinculada", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-22T10:00:00"));
    window.localStorage.setItem(CLAVE_ACTIVIDAD, JSON.stringify(ACTIVIDAD));
    window.localStorage.setItem(
      `${CLAVE_SESION}:${ACTIVIDAD.id}`,
      JSON.stringify({ activityId: ACTIVIDAD.id, activityName: "26-05 T", tareas: [tarea({ fecha: "2026-05-26" })], asignaciones: { "t1|a": "p1" }, ultimoEnvio: { ok: true, codigo: "cortes-validados" } }),
    );
    // Una sesión vieja sin tareas no vale la pena migrar, pero igual se limpia.
    window.localStorage.setItem(`${CLAVE_SESION}:otra`, JSON.stringify({ activityId: "otra", tareas: [] }));

    const migrados = migrarSesionesViejas({ equipoId: "eq-1" });
    expect(migrados).toHaveLength(1);
    expect(migrados[0]).toMatchObject({ fecha: "2026-05-26", equipoId: "eq-1", asignaciones: { "t1|a": "p1" } });
    expect(migrados[0].actividad).toEqual({ id: ACTIVIDAD.id, name: "26-05 T", start_time: 1779822758, end_time: 1779824460 });
    expect(migrados[0].tareas[0].nombre).toBe("Rondo");
    expect(migrados[0].ultimoEnvio.codigo).toBe("cortes-validados");
    expect(window.localStorage.getItem(`${CLAVE_SESION}:${ACTIVIDAD.id}`)).toBeNull();
    expect(window.localStorage.getItem(`${CLAVE_SESION}:otra`)).toBeNull();
    expect(window.localStorage.getItem(CLAVE_ACTIVIDAD)).toBeNull();

    // Sin nada viejo no hay nada que migrar.
    expect(migrarSesionesViejas()).toEqual([]);
  });
});
