import { beforeEach, describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({ filas: [], error: null, escrituras: [] }));
vi.mock("../supabase.js", () => ({
  supabase: {
    from: () => ({
      select: async () => ({ data: base.filas, error: base.error }),
      upsert: (fila, opciones) => {
        base.escrituras.push({ fila, opciones });
        return { select: async () => ({ data: base.error ? null : [fila], error: base.error }) };
      },
    }),
  },
}));

import { darDeBaja, estadoDeMembresia, listarMembresias, membresiaDe, reincorporar, sumarAlClub } from "./membresiasDb.js";
import { hoyISO } from "../idioma/formatos.js";

beforeEach(() => {
  base.filas = [];
  base.error = null;
  base.escrituras = [];
});

describe("la membresía de una cuenta en un club", () => {
  it("está, se fue o nunca estuvo", () => {
    expect(estadoDeMembresia(null)).toBe("ninguno");
    expect(estadoDeMembresia({ hasta: null })).toBe("activo");
    expect(estadoDeMembresia({ hasta: "2026-09-25" })).toBe("hasta");
    const lista = [{ user_id: "u1", equipo_id: "eq-1", desde: "2026-09-01", hasta: null }];
    expect(membresiaDe(lista, "u1", "eq-1")).toEqual(lista[0]);
    expect(membresiaDe(lista, "u1", "eq-2")).toBeNull();
  });

  it("lee las filas y avisa si la base no contesta", async () => {
    base.filas = [{ equipo_id: "eq-1", user_id: "u1", desde: "2026-09-01", hasta: undefined }];
    expect(await listarMembresias()).toEqual([{ equipo_id: "eq-1", user_id: "u1", desde: "2026-09-01", hasta: null }]);
    base.error = { message: "permission denied" };
    await expect(listarMembresias()).rejects.toThrow("permission denied");
  });

  it("sumar, dar de baja y reincorporar escriben la fila justa", async () => {
    await sumarAlClub("u1", "eq-1");
    await darDeBaja("u1", "eq-1", "2026-09-25");
    await reincorporar("u1", "eq-1");
    expect(base.escrituras.map(({ fila }) => fila)).toEqual([
      { equipo_id: "eq-1", user_id: "u1", desde: hoyISO(), hasta: null },
      { equipo_id: "eq-1", user_id: "u1", hasta: "2026-09-25" },
      { equipo_id: "eq-1", user_id: "u1", hasta: null },
    ]);
    expect(base.escrituras[0].opciones).toEqual({ onConflict: "equipo_id,user_id" });
  });

  it("si la base no deja (no sos administrador), avisa con la clave del diccionario", async () => {
    base.error = { message: "" };
    await expect(sumarAlClub("u1", "eq-1")).rejects.toThrow("cuentas.errorClub");
  });
});
