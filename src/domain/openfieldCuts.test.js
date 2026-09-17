import {
  compararCorteConOpenField,
  prepararCorteOpenField,
  segmentosActivos,
  timestampAPosicionTimeline,
} from "./openfieldCuts.js";

describe("prepararCorteOpenField", () => {
  it("calcula duración bruta, pausas y duración efectiva", () => {
    const corte = prepararCorteOpenField({
      nombre: "Juego reducido",
      inicio: "2026-09-17T13:20:00.000Z",
      fin: "2026-09-17T13:35:00.000Z",
      pausas: [
        {
          inicio: "2026-09-17T13:27:00.000Z",
          fin: "2026-09-17T13:29:00.000Z",
        },
      ],
    });

    expect(corte.duracionBrutaSegundos).toBe(900);
    expect(corte.pausasSegundos).toBe(120);
    expect(corte.duracionEfectivaSegundos).toBe(780);
  });

  it("rechaza pausas fuera de la tarea", () => {
    expect(() =>
      prepararCorteOpenField({
        inicio: "2026-09-17T13:20:00.000Z",
        fin: "2026-09-17T13:35:00.000Z",
        pausas: [
          {
            inicio: "2026-09-17T13:34:00.000Z",
            fin: "2026-09-17T13:36:00.000Z",
          },
        ],
      }),
    ).toThrow("fuera de los límites");
  });

  it("rechaza pausas superpuestas", () => {
    expect(() =>
      prepararCorteOpenField({
        inicio: "2026-09-17T13:20:00.000Z",
        fin: "2026-09-17T13:35:00.000Z",
        pausas: [
          {
            inicio: "2026-09-17T13:25:00.000Z",
            fin: "2026-09-17T13:28:00.000Z",
          },
          {
            inicio: "2026-09-17T13:27:00.000Z",
            fin: "2026-09-17T13:29:00.000Z",
          },
        ],
      }),
    ).toThrow("se superponen");
  });
});

describe("segmentosActivos", () => {
  it("divide la tarea alrededor de las pausas", () => {
    const segmentos = segmentosActivos({
      inicio: "2026-09-17T13:20:00.000Z",
      fin: "2026-09-17T13:35:00.000Z",
      pausas: [
        {
          inicio: "2026-09-17T13:27:00.000Z",
          fin: "2026-09-17T13:29:00.000Z",
        },
      ],
    });

    expect(segmentos).toHaveLength(2);
    expect(segmentos[0].inicio.toISOString()).toBe("2026-09-17T13:20:00.000Z");
    expect(segmentos[0].fin.toISOString()).toBe("2026-09-17T13:27:00.000Z");
    expect(segmentos[1].inicio.toISOString()).toBe("2026-09-17T13:29:00.000Z");
    expect(segmentos[1].fin.toISOString()).toBe("2026-09-17T13:35:00.000Z");
  });
});

describe("timestampAPosicionTimeline", () => {
  it("convierte el punto medio temporal en el punto medio visual", () => {
    const x = timestampAPosicionTimeline({
      timestamp: "2026-09-17T13:30:00.000Z",
      visibleInicio: "2026-09-17T13:20:00.000Z",
      visibleFin: "2026-09-17T13:40:00.000Z",
      xInicio: 100,
      xFin: 1100,
    });

    expect(x).toBe(600);
  });
});

describe("compararCorteConOpenField", () => {
  const esperado = {
    inicio: "2026-09-17T13:20:00.000Z",
    fin: "2026-09-17T13:35:00.000Z",
    pausas: [
      {
        inicio: "2026-09-17T13:27:00.000Z",
        fin: "2026-09-17T13:29:00.000Z",
      },
    ],
  };

  it("exige coincidencia exacta por defecto", () => {
    const encontrado = {
      ...esperado,
      fin: "2026-09-17T13:35:01.000Z",
    };

    expect(compararCorteConOpenField({ esperado, encontrado }).valido).toBe(false);
  });

  it("permite una tolerancia explícita cuando se configure", () => {
    const encontrado = {
      ...esperado,
      fin: "2026-09-17T13:35:00.400Z",
    };

    expect(
      compararCorteConOpenField({
        esperado,
        encontrado,
        toleranciaMs: 500,
      }).valido,
    ).toBe(true);
  });
});
