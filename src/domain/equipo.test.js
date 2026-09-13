import { describe, expect, it } from "vitest";

import { EQUIPO_POR_DEFECTO, esElCam } from "./equipo.js";

describe("esElCam", () => {
  it("reconoce el nombre de siempre", () => {
    expect(esElCam(EQUIPO_POR_DEFECTO)).toBe(true);
  });

  it("no se pierde por acentos, mayúsculas ni espacios de más", () => {
    expect(esElCam("atletico mineiro")).toBe(true);
    expect(esElCam("  ATLÉTICO MINEIRO  ")).toBe(true);
  });

  it("dice que no para cualquier otro equipo", () => {
    ["Cruzeiro", "Atlético Tucumán", "", null, undefined].forEach((nombre) => {
      expect(esElCam(nombre)).toBe(false);
    });
  });
});
