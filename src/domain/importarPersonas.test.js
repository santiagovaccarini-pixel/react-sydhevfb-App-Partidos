import { describe, expect, test } from "vitest";
import { DUDOSO, buscadorDeJugadores } from "./importarPersonas.js";

// Quién es cada nombre al pegar una planilla o cargar el CSV del GPS (Lesiones,
// Evaluaciones y GPS): también un nombre que tuvo el jugador (nota del 12/10).
describe("quién es cada nombre", () => {
  const plantel = [
    { id: 7, nombre: "HULK" },
    { id: 8, nombre: "G. SCARPA", nombres_anteriores: ["Scarpa", "Gustavo Scárpa"] },
    { id: 9, nombre: "PÉREZ", nombres_anteriores: ["Gómez"] },
    { id: 10, nombre: "GOMEZ" },
    { id: 11, nombre: "SILVA", nombres_anteriores: ["Lateral"] },
    { id: 12, nombre: "SOSA", nombres_anteriores: ["Lateral"] },
  ];
  const buscar = buscadorDeJugadores(plantel);

  test("el nombre de hoy, sin mayúsculas ni acentos", () => {
    expect(buscar("hulk").id).toBe(7);
    expect(buscar("g. scarpa").id).toBe(8);
    expect(buscar("Perez").id).toBe(9);
  });

  test("un nombre que tuvo el jugador también es él", () => {
    expect(buscar("SCARPA").id).toBe(8);
    expect(buscar("gustavo scarpa").id).toBe(8);
  });

  test("si hoy otro jugador se llama así, es el de hoy", () => {
    expect(buscar("Gómez").id).toBe(10);
  });

  test("un nombre que tuvieron dos no se adivina", () => {
    expect(buscar("lateral")).toBe(DUDOSO);
    expect(buscar("Nadie")).toBeNull();
  });

  test("sin nombres anteriores, como siempre", () => {
    expect(buscadorDeJugadores([{ id: 1, nombre: "Ana" }, { id: 2, nombre: "ana" }])("ANA")).toBe(DUDOSO);
  });
});
