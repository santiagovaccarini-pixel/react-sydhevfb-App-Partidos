import { beforeEach, describe, expect, test, vi } from "vitest";
import { borrarPeriodo, claveDeErrorDePeriodo, guardarPeriodo, listarPeriodos } from "./periodosDb.js";

// Un doble de Supabase que anota la consulta y contesta lo configurado.
const doble = vi.hoisted(() => ({ llamadas: [], data: null, error: null }));

vi.mock("../supabase.js", () => {
  const cadena = () => {
    const c = {};
    ["select", "eq", "order", "insert", "delete", "single"].forEach((metodo) => {
      c[metodo] = (...args) => {
        doble.llamadas.push([metodo, ...args]);
        return c;
      };
    });
    c.then = (resolver, rechazar) => Promise.resolve({ data: doble.error ? null : doble.data, error: doble.error }).then(resolver, rechazar);
    return c;
  };
  return {
    supabase: {
      from: (tabla) => {
        doble.llamadas.push(["from", tabla]);
        return cadena();
      },
    },
  };
});

beforeEach(() => {
  doble.llamadas.length = 0;
  doble.data = null;
  doble.error = null;
});

describe("los períodos guardados en la base", () => {
  test("se leen los del club, en el orden en que se guardaron", async () => {
    doble.data = [{ id: "p1", equipo_id: "eq-1", nombre: "Base completa", desde: null, hasta: "2026-10-01" }];
    expect(await listarPeriodos("eq-1")).toEqual({ periodos: [{ id: "p1", nombre: "Base completa", desde: "", hasta: "2026-10-01" }], error: "" });
    expect(doble.llamadas).toContainEqual(["from", "lesiones_periodos"]);
    expect(doble.llamadas).toContainEqual(["eq", "equipo_id", "eq-1"]);
  });

  test("se guarda el nombre sin espacios de más, y sin inicio va vacío", async () => {
    doble.data = { id: "p2", nombre: "Primer semestre", desde: null, hasta: "2026-06-30" };
    const respuesta = await guardarPeriodo("eq-1", { nombre: "  Primer semestre ", desde: "", hasta: "2026-06-30" });
    expect(respuesta).toEqual({ periodo: { id: "p2", nombre: "Primer semestre", desde: "", hasta: "2026-06-30" }, error: "" });
    const [, enviado] = doble.llamadas.find(([metodo]) => metodo === "insert");
    expect(enviado).toEqual({ equipo_id: "eq-1", nombre: "Primer semestre", desde: null, hasta: "2026-06-30" });
  });

  test("lo que dice la base, en palabras de los períodos", async () => {
    expect(claveDeErrorDePeriodo({ code: "42P01", message: 'relation "public.lesiones_periodos" does not exist' })).toBe("lesiones.periodos.error.faltaMigracion");
    expect(claveDeErrorDePeriodo({ code: "PGRST205", message: "Could not find the table 'public.lesiones_periodos' in the schema cache" })).toBe("lesiones.periodos.error.faltaMigracion");
    expect(claveDeErrorDePeriodo({ code: "23505", message: 'duplicate key value violates unique constraint "lesiones_periodos_nombre_unico"' })).toBe("lesiones.periodos.error.repetido");
    expect(claveDeErrorDePeriodo({ code: "23514", message: 'new row violates check constraint "lesiones_periodos_fechas"' })).toBe("lesiones.periodos.error.fechas");
    expect(claveDeErrorDePeriodo({ code: "42501", message: "new row violates row-level security policy" })).toBe("lesiones.error.sinPermiso");
    doble.error = { code: "23505", message: "lesiones_periodos_nombre_unico" };
    expect(await guardarPeriodo("eq-1", { nombre: "x", hasta: "2026-06-30" })).toEqual({ error: "lesiones.periodos.error.repetido" });
    doble.error = { code: "XX000", message: "algo" };
    expect(await borrarPeriodo("p1")).toEqual({ error: "lesiones.periodos.error.noBorrar" });
    expect(await listarPeriodos("eq-1")).toEqual({ periodos: [], error: "lesiones.periodos.error.noLeer" });
  });

  test("sin club no se pregunta nada", async () => {
    expect(await listarPeriodos(null)).toEqual({ periodos: [], error: "" });
    expect(doble.llamadas).toEqual([]);
  });
});
