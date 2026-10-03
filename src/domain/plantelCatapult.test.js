import { beforeEach, describe, expect, it, vi } from "vitest";

// La base de mentira: contesta lo que diga `respuesta`.
// respuestas: una por consulta, antes de `respuesta`; selects: lo pedido.
const doble = vi.hoisted(() => ({ respuesta: { data: [], error: null }, respuestas: [], selects: [] }));

vi.mock("../supabase.js", () => ({
  supabase: {
    from: () => {
      const cadena = {
        select: (columnas) => {
          doble.selects.push(columnas);
          return cadena;
        },
        eq: () => cadena,
        order: async () => (doble.respuestas.length ? doble.respuestas.shift() : doble.respuesta),
      };
      return cadena;
    },
  },
}));

const { cargarPlantelConCatapult, leerPlantelCatapultGuardado } = await import("./plantel.js");

const filas = [
  { id: 2, nombre: "IGOR GOMES", roles: [], puestos: [], catapult_id: "a2", catapult_nombre: "IGOR GOMES (GOM)" },
  { id: 1, nombre: "A MINDA", roles: ["Defensa"], puestos: [], catapult_id: "a1", catapult_nombre: "A MINDA (MIN)" },
];

describe("la lista con chalecos sin señal", () => {
  beforeEach(() => {
    localStorage.clear();
    doble.respuesta = { data: filas, error: null };
    doble.respuestas = [];
    doble.selects = [];
  });

  it("trae si cada uno está en el plantel actual; sin el SQL de Actual, se lee sin él (todos están)", async () => {
    doble.respuesta = { data: [{ ...filas[0], actual: false }, filas[1]], error: null };
    const { plantel } = await cargarPlantelConCatapult("eq-1");
    expect(plantel.map((j) => [j.nombre, j.actual])).toEqual([
      ["A MINDA", true],
      ["IGOR GOMES", false],
    ]);
    expect(doble.selects[0]).toMatch(/\bactual\b/);

    doble.selects = [];
    doble.respuestas = [{ data: null, error: { code: "42703", message: "column jugadores.actual does not exist" } }];
    doble.respuesta = { data: filas, error: null };
    const sinColumna = await cargarPlantelConCatapult("eq-1");
    expect(sinColumna.desde).toBe("base");
    expect(sinColumna.plantel.every((j) => j.actual)).toBe(true);
    expect(doble.selects[1]).not.toMatch(/\bactual\b/);
  });

  it("con la base a mano, la lee, la ordena y deja una copia por club", async () => {
    const { plantel, desde } = await cargarPlantelConCatapult("eq-1");
    expect(desde).toBe("base");
    expect(plantel.map((j) => j.nombre)).toEqual(["A MINDA", "IGOR GOMES"]);
    expect(plantel[0].catapult_id).toBe("a1");
    expect(leerPlantelCatapultGuardado("eq-1").map((j) => j.nombre)).toEqual(["A MINDA", "IGOR GOMES"]);
    expect(leerPlantelCatapultGuardado("eq-2")).toBeNull();
  });

  it("sin señal devuelve la copia del club, con sus chalecos", async () => {
    await cargarPlantelConCatapult("eq-1");
    doble.respuesta = { data: null, error: { message: "TypeError: Failed to fetch" } };

    const { plantel, desde, error } = await cargarPlantelConCatapult("eq-1");
    expect(desde).toBe("respaldo");
    expect(error).toBe("");
    expect(plantel.map((j) => j.catapult_id)).toEqual(["a1", "a2"]);
  });

  it("sin señal y sin copia, avisa; y la migración faltante se sigue explicando", async () => {
    doble.respuesta = { data: null, error: { message: "TypeError: Failed to fetch" } };
    expect(await cargarPlantelConCatapult("eq-1")).toMatchObject({ plantel: [], error: "TypeError: Failed to fetch" });

    localStorage.setItem("plantel_catapult:eq-1", JSON.stringify(filas));
    doble.respuesta = { data: null, error: { message: 'column jugadores.catapult_id does not exist' } };
    const { plantel, error } = await cargarPlantelConCatapult("eq-1");
    expect(plantel).toEqual([]);
    expect(error).toMatch(/migración/);
  });
});
