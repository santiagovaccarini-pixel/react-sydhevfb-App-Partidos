import { describe, expect, test, vi } from "vitest";

const base = vi.hoisted(() => ({ respuesta: null }));
vi.mock("../supabase.js", () => ({ supabase: { rpc: async () => base.respuesta } }));

const { claveDeErrorDeExportar, exportarAtleta } = await import("./privacidadDb.js");

describe("exportar los datos de un atleta: lo que contesta la base", () => {
  test("«Falta una actualización» solo si falta la función de exportar", () => {
    expect(claveDeErrorDeExportar({ code: "PGRST202", message: "Could not find the function public.exportar_atleta(p_jugador)" })).toBe("exportar.error.faltaMigracion");
    expect(claveDeErrorDeExportar({ code: "42883", message: "function public.exportar_atleta(bigint) does not exist" })).toBe("exportar.error.faltaMigracion");
    // Otra función que falla adentro (como con los partidos de antes): no es eso.
    expect(claveDeErrorDeExportar({ code: "42883", message: "function unnest(jsonb) does not exist" })).toBe("exportar.error.noSe");
  });

  test("solo el administrador, y sin señal", () => {
    expect(claveDeErrorDeExportar({ code: "42501", message: "solo_admin" })).toBe("exportar.error.soloAdmin");
    expect(claveDeErrorDeExportar({ message: "TypeError: Failed to fetch" })).toBe("comun.sinConexion");
  });

  test("lo que contesta la base llega a la ficha", async () => {
    base.respuesta = { data: { jugador: { id: 1 } }, error: null };
    expect(await exportarAtleta(1)).toEqual({ datos: { jugador: { id: 1 } }, error: "" });
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    base.respuesta = { data: null, error: { code: "42883", message: "function unnest(jsonb) does not exist" } };
    expect(await exportarAtleta(1)).toEqual({ datos: null, error: "exportar.error.noSe" });
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});
