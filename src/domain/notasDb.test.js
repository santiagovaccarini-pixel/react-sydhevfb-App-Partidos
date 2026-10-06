import { describe, expect, test } from "vitest";
import { claveDeError, ordenarNotas } from "./notasDb.js";

describe("notas en la base", () => {
  test("cada error de la base tiene su clave del diccionario", () => {
    expect(claveDeError({ message: "TypeError: Failed to fetch" })).toBe("comun.sinConexion");
    expect(claveDeError({ message: 'new row for relation "notas" violates check constraint "notas_texto_check"' })).toBe("notas.errorTexto");
    expect(claveDeError({ code: "42501", message: "new row violates row-level security policy" })).toBe("notas.errorSinPermiso");
    expect(claveDeError({ code: "PGRST205", message: "Could not find the table 'public.notas' in the schema cache" })).toBe("notas.errorFaltaMigracion");
    expect(claveDeError({ code: "42P01", message: 'relation "public.notas" does not exist' })).toBe("notas.errorFaltaMigracion");
    expect(claveDeError({ message: "otra cosa" }, "notas.errorBorrar")).toBe("notas.errorBorrar");
  });

  test("primero las que faltan hacer y, en cada grupo, la más nueva arriba", () => {
    const lista = [
      { id: "a", hecha: true, creado_en: "2026-10-06T10:00:00Z" },
      { id: "b", hecha: false, creado_en: "2026-10-01T10:00:00Z" },
      { id: "c", hecha: false, creado_en: "2026-10-05T10:00:00Z" },
      { id: "d", hecha: true, creado_en: "2026-10-02T10:00:00Z" },
    ];
    expect(ordenarNotas(lista).map((nota) => nota.id)).toEqual(["c", "b", "a", "d"]);
  });
});
