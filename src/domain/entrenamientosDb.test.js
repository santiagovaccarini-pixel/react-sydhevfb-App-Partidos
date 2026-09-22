import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  borrarEntrenamientoDb,
  entrenamientoDeFila,
  filaDeEntrenamiento,
  guardarEntrenamientoDb,
  leerEntrenamientoDb,
  listarEntrenamientosDb,
} from "./entrenamientosDb.js";
import { nuevoEntrenamiento } from "./entrenamiento.js";

// Un doble de Supabase que anota cada paso de la cadena y devuelve lo que se
// le configure al final.
const doble = vi.hoisted(() => ({ llamadas: [], resultado: { data: [], error: null } }));

vi.mock("../supabase.js", () => {
  const cadena = () => {
    const c = {};
    ["select", "eq", "order", "limit", "upsert", "delete", "maybeSingle"].forEach((metodo) => {
      c[metodo] = (...args) => {
        doble.llamadas.push([metodo, ...args]);
        return c;
      };
    });
    c.then = (resolver, rechazar) => Promise.resolve(doble.resultado).then(resolver, rechazar);
    return c;
  };
  return { supabase: { from: (tabla) => { doble.llamadas.push(["from", tabla]); return cadena(); } } };
});

const tarea = { id: "t1", nombre: "Rondo", fecha: "2026-09-22", inicio: "10:10:00", fin: "10:20:00", pausas: [], participantes: { 1: { modo: "total", inicio: "", fin: "" } }, envio: null };

describe("entrenamientosDb", () => {
  beforeEach(() => {
    doble.llamadas.length = 0;
    doble.resultado = { data: [], error: null };
  });

  test("la fila lleva las columnas para listar y las tareas adentro, y vuelve a ser entrenamiento", () => {
    const entrenamiento = {
      ...nuevoEntrenamiento({ id: "11111111-2222-4333-8444-555555555555", fecha: "2026-09-22", nombre: "Turno tarde", equipoId: "eq-1", ahora: new Date("2026-09-22T10:00:00Z") }),
      tareas: [tarea],
      actividad: { id: "act-1", name: "26-05 T", start_time: 1, end_time: 2 },
      asignaciones: { "t1|a": "p1" },
    };
    const fila = filaDeEntrenamiento(entrenamiento, { actualizadoPor: "santi@ejemplo.com" });
    expect(fila).toMatchObject({
      id: "11111111-2222-4333-8444-555555555555",
      equipo_id: "eq-1",
      fecha: "2026-09-22",
      nombre: "Turno tarde",
      actividad_id: "act-1",
      actividad_nombre: "26-05 T",
      estado: "sin-enviar",
      tareas_cantidad: 1,
      actualizado_en: "2026-09-22T10:00:00.000Z",
      actualizado_por: "santi@ejemplo.com",
    });
    expect(fila.datos.tareas).toEqual([tarea]);
    expect(fila.datos.asignaciones).toEqual({ "t1|a": "p1" });

    const vuelta = entrenamientoDeFila({ ...fila, creado_en: "2026-09-22T09:00:00.000Z" });
    expect(vuelta).toMatchObject({ id: fila.id, equipoId: "eq-1", fecha: "2026-09-22", nombre: "Turno tarde", asignaciones: { "t1|a": "p1" } });
    expect(vuelta.actividad).toEqual({ id: "act-1", name: "26-05 T", start_time: 1, end_time: 2 });
    expect(vuelta.tareas[0].nombre).toBe("Rondo");
    // Lo leído de la base ya está guardado.
    expect(vuelta.guardadoEn).toBe("2026-09-22T10:00:00.000Z");
  });

  test("listar pide solo las columnas livianas del equipo, de la más nueva a la más vieja", async () => {
    doble.resultado = { data: [{ id: "e1", equipo_id: "eq-1", fecha: "2026-09-22", nombre: "", actividad_id: "", actividad_nombre: "", estado: "en-curso", tareas_cantidad: 3, actualizado_en: "2026-09-22T10:00:00.000Z" }], error: null };
    const lista = await listarEntrenamientosDb("eq-1");
    expect(lista).toEqual([{ id: "e1", equipoId: "eq-1", fecha: "2026-09-22", nombre: "", actividadId: "", actividadNombre: "", estado: "en-curso", tareas: 3, actualizadoEn: "2026-09-22T10:00:00.000Z", guardadoEn: "2026-09-22T10:00:00.000Z" }]);
    expect(doble.llamadas[0]).toEqual(["from", "entrenamientos"]);
    expect(doble.llamadas.find(([metodo]) => metodo === "select")[1]).toContain("tareas_cantidad");
    expect(doble.llamadas.find(([metodo]) => metodo === "select")[1]).not.toContain("datos");
    expect(doble.llamadas).toContainEqual(["eq", "equipo_id", "eq-1"]);
    expect(doble.llamadas).toContainEqual(["order", "fecha", { ascending: false }]);
    expect(doble.llamadas).toContainEqual(["limit", 100]);
  });

  test("leer, guardar y borrar hablan con la tabla por id, y un error de la base se avisa", async () => {
    doble.resultado = { data: { id: "e1", fecha: "2026-09-22", nombre: "", datos: { tareas: [tarea] }, actualizado_en: "2026-09-22T10:00:00.000Z" }, error: null };
    const leido = await leerEntrenamientoDb("e1");
    expect(leido.tareas).toHaveLength(1);
    expect(doble.llamadas).toContainEqual(["eq", "id", "e1"]);
    expect(doble.llamadas.some(([metodo]) => metodo === "maybeSingle")).toBe(true);

    doble.llamadas.length = 0;
    doble.resultado = { data: null, error: null };
    expect(await leerEntrenamientoDb("nada")).toBeNull();

    doble.llamadas.length = 0;
    const entrenamiento = nuevoEntrenamiento({ id: "11111111-2222-4333-8444-555555555555", fecha: "2026-09-22" });
    expect(await guardarEntrenamientoDb(entrenamiento)).toBe(true);
    const upsert = doble.llamadas.find(([metodo]) => metodo === "upsert");
    expect(upsert[1].id).toBe(entrenamiento.id);
    expect(upsert[2]).toEqual({ onConflict: "id" });

    doble.llamadas.length = 0;
    expect(await borrarEntrenamientoDb("e1")).toBe(true);
    expect(doble.llamadas.some(([metodo]) => metodo === "delete")).toBe(true);
    expect(doble.llamadas).toContainEqual(["eq", "id", "e1"]);

    doble.resultado = { data: null, error: { message: "sin permiso" } };
    await expect(guardarEntrenamientoDb(entrenamiento)).rejects.toEqual({ message: "sin permiso" });
  });
});
