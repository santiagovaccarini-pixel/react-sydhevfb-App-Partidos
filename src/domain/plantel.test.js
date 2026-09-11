import { describe, expect, test, vi } from "vitest";
import {
  MAXIMO_PUESTOS,
  PUESTOS,
  nombrePuesto,
  nombresDelPlantel,
  normalizarJugador,
  plantelDeRespaldo,
} from "./plantel";

vi.mock("../supabase.js", () => ({ supabase: {} }));

describe("plantel", () => {
  test("descarta roles y puestos que no existen", () => {
    const jugador = normalizarJugador({
      id: 3,
      nombre: "  ALONSO  ",
      roles: ["Mediocampo", "Arquero", "Defensa"],
      puestos: ["VM", "XX", "LAT"],
    });

    expect(jugador).toEqual({
      id: 3,
      nombre: "ALONSO",
      roles: ["Mediocampo", "Defensa"],
      puestos: ["VM", "LAT"],
    });
  });

  test("corta en cuatro puestos, que es lo que entra en pantalla", () => {
    const { puestos } = normalizarJugador({
      nombre: "ZARACHO",
      puestos: ["VO", "VM", "MP", "EXT", "DEL"],
    });

    expect(puestos).toHaveLength(MAXIMO_PUESTOS);
    expect(puestos).not.toContain("DEL");
  });

  test("una fila rota no rompe nada", () => {
    expect(normalizarJugador(null)).toEqual({
      id: null,
      nombre: "",
      roles: [],
      puestos: [],
    });
    expect(normalizarJugador({ nombre: "FRED", roles: "no es lista" }).roles).toEqual([]);
  });

  test("los desplegables llevan el vacío adelante, como antes", () => {
    const nombres = nombresDelPlantel([
      { nombre: "ALONSO" },
      { nombre: "" },
      { nombre: "HULK" },
    ]);

    expect(nombres).toEqual(["", "ALONSO", "HULK"]);
  });

  test("el respaldo del código trae el plantel entero", () => {
    const respaldo = plantelDeRespaldo();

    expect(respaldo.length).toBeGreaterThan(30);
    expect(respaldo.map((j) => j.nombre)).toContain("ALONSO");
    // Sin el vacío del principio: eso lo agrega nombresDelPlantel.
    expect(respaldo.map((j) => j.nombre)).not.toContain("");
  });

  test("no hay arquero entre los puestos", () => {
    expect(PUESTOS.map((p) => p.nombre)).not.toContain("Arquero");
    expect(nombrePuesto("VM")).toBe("Volante Mixto");
    // Una sigla desconocida se muestra tal cual antes que romper.
    expect(nombrePuesto("XX")).toBe("XX");
  });
});
