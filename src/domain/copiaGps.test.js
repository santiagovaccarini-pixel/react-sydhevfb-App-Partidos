import { describe, expect, test } from "vitest";
import { borrarCopiasGps, guardarCopiaGps, leerCopiaGps } from "./copiaGps.js";

// En las pruebas no hay IndexedDB (como en un navegador que no lo deja): no
// hay copia y nada falla; la Base trae todo de la base.
describe("la copia del GPS en el aparato, sin IndexedDB", () => {
  test("no hay copia, guardar y borrar no hacen nada y no fallan", async () => {
    expect(await leerCopiaGps("cuenta-1", "eq-1")).toBeNull();
    expect(await guardarCopiaGps("cuenta-1", "eq-1", { filas: [], hasta: null })).toBeNull();
    expect(await borrarCopiasGps("eq-1")).toBeNull();
    expect(await borrarCopiasGps()).toBeNull();
  });

  test("sin cuenta o sin club, ni la busca", async () => {
    expect(await leerCopiaGps(null, "eq-1")).toBeNull();
    expect(await leerCopiaGps("cuenta-1", null)).toBeNull();
    expect(await guardarCopiaGps("cuenta-1", "eq-1", { filas: null })).toBeNull();
  });
});
