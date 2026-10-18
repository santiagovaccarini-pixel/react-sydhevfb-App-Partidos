import { describe, expect, test, vi } from "vitest";
import { claveDeErrorConsentimiento, normalizarPersona, personasSinConfirmar } from "./consentimiento.js";

const base = vi.hoisted(() => ({ respuesta: null, insertadas: [] }));
vi.mock("../supabase.js", () => ({
  supabase: {
    from: () => ({
      insert: (filas) => {
        base.insertadas.push(...filas);
        return { select: async () => base.respuesta };
      },
    }),
  },
}));

const { agregarJugador } = await import("./plantel.js");

describe("consentimiento de los atletas", () => {
  test("una persona se compara como la base: sin mayúsculas ni espacios de más", () => {
    expect(normalizarPersona("  Ana   Pérez ")).toBe("ana pérez");
    expect(normalizarPersona(null)).toBe("");
  });

  test("lo que todavía no está confirmado, una vez cada persona y como se escribió primero", () => {
    const confirmadas = new Set(["beto ya"]);
    expect(personasSinConfirmar([" Ana  Pérez", "ANA PÉREZ", "Beto Ya", "", null, "Caro"], confirmadas)).toEqual(["Ana Pérez", "Caro"]);
    // Sin poder leer lo confirmado (null), se pregunta por todas.
    expect(personasSinConfirmar(["Ana", "Beto Ya"], null)).toEqual(["Ana", "Beto Ya"]);
  });

  test("lo que contesta la base al cargar sin confirmar, en palabras", () => {
    expect(claveDeErrorConsentimiento({ message: "falta_consentimiento" })).toBe("consentimiento.error.club");
    expect(claveDeErrorConsentimiento({ message: "falta_consentimiento_persona" })).toBe("consentimiento.error.persona");
    expect(claveDeErrorConsentimiento({ message: "duplicate key" })).toBe("");
  });

  test("agregar un jugador sin la confirmación del club dice qué falta", async () => {
    base.respuesta = { data: null, error: { code: "P0001", message: "falta_consentimiento" } };
    expect(await agregarJugador("Nuevo", "eq-1")).toEqual({ error: "consentimiento.error.club" });
    expect(base.insertadas).toEqual([{ nombre: "Nuevo", roles: [], puestos: [], equipo_id: "eq-1" }]);
  });
});
