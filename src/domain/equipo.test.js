import { describe, expect, it } from "vitest";

import { EQUIPO_POR_DEFECTO, elegirEquipoInicial, esElCam } from "./equipo.js";

describe("esElCam", () => {
  it("reconoce el nombre de siempre", () => {
    expect(esElCam(EQUIPO_POR_DEFECTO)).toBe(true);
  });

  it("no se pierde por acentos, mayúsculas ni espacios de más", () => {
    expect(esElCam("atletico mineiro")).toBe(true);
    expect(esElCam("  ATLÉTICO MINEIRO  ")).toBe(true);
  });

  it("dice que no para cualquier otro equipo", () => {
    ["Cruzeiro", "Estudiantes de La Plata", "", null, undefined].forEach(
      (nombre) => expect(esElCam(nombre)).toBe(false),
    );
  });
});

describe("elegirEquipoInicial", () => {
  const CAM = { id: "uno", nombre: "Atlético Mineiro" };
  const EDLP = { id: "dos", nombre: "Estudiantes de La Plata" };

  it("usa el que eligió este teléfono", () => {
    expect(elegirEquipoInicial([CAM, EDLP], "dos")).toEqual(EDLP);
  });

  it("adopta el único que hay, sin hacer elegir", () => {
    // Es el caso de siempre: un equipo y varios teléfonos.
    expect(elegirEquipoInicial([CAM], null)).toEqual(CAM);
    expect(elegirEquipoInicial([CAM], "un-id-que-ya-no-existe")).toEqual(CAM);
  });

  it("no elige por vos cuando hay más de uno y no hay nada guardado", () => {
    expect(elegirEquipoInicial([CAM, EDLP], null)).toBeNull();
    expect(elegirEquipoInicial([CAM, EDLP], "borrado")).toBeNull();
  });

  it("aguanta una base sin equipos", () => {
    expect(elegirEquipoInicial([], "uno")).toBeNull();
    expect(elegirEquipoInicial(null, null)).toBeNull();
  });
});
