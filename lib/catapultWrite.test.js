import {
  armarBatch,
  armarPeriodoNuevo,
  elegirNombreLibre,
  elegirVentanaPrueba,
  idsAtletas,
  normalizarInterno,
  validarEscrituraBatch,
  veredictoEscritura,
} from "./catapultWrite.js";

const MIN = 60 * 1000;

describe("normalizarInterno", () => {
  it("lleva la lectura interna al formato del snapshot", () => {
    const interno = normalizarInterno({
      id: "act",
      name: "26-05 T",
      start_time_ms: 1779822758000,
      end_time_ms: 1779828000000,
      periods: [
        {
          id: "p1",
          name: "Calentamiento",
          start_time_ms: 1779822758000,
          end_time_ms: 1779823172000,
          athletes: [{ athlete_id: "a2" }, { id: "a1" }, "a3", {}],
        },
        { name: "sin id" },
      ],
    });

    expect(interno.activity).toEqual({
      id: "act",
      name: "26-05 T",
      start_ms: 1779822758000,
      end_ms: 1779828000000,
    });
    expect(interno.periods).toEqual([
      {
        id: "p1",
        name: "Calentamiento",
        start_ms: 1779822758000,
        end_ms: 1779823172000,
        athletes: [{ id: "a2" }, { id: "a1" }, { id: "a3" }],
        is_deleted: false,
      },
    ]);
  });

  it("idsAtletas acepta athlete_id, id o strings", () => {
    expect(idsAtletas([{ athlete_id: "x" }, { id: "y" }, "z", null])).toEqual(["x", "y", "z"]);
    expect(idsAtletas(null)).toEqual([]);
  });
});

describe("elegirNombreLibre", () => {
  it("toma el primer TEST APP NN libre sin distinguir mayúsculas", () => {
    expect(elegirNombreLibre([])).toBe("TEST APP 01");
    expect(elegirNombreLibre([{ name: "test app 01" }, { name: "TEST APP 02 " }])).toBe(
      "TEST APP 03",
    );
  });

  it("devuelve null si están los 99 usados", () => {
    const todos = Array.from({ length: 99 }, (_, i) => ({
      name: `TEST APP ${String(i + 1).padStart(2, "0")}`,
    }));
    expect(elegirNombreLibre(todos)).toBeNull();
  });
});

describe("elegirVentanaPrueba", () => {
  it("ubica 10 minutos después del inicio, 10 minutos de largo, a segundos enteros", () => {
    const inicio = 1779822758250;
    const ventana = elegirVentanaPrueba({
      inicioActividadMs: inicio,
      finActividadMs: inicio + 90 * MIN,
    });
    expect(ventana).toEqual({ startMs: 1779823359000, endMs: 1779823959000 });
    expect(ventana.startMs % 1000).toBe(0);
  });

  it("se achica en actividades cortas y no escribe si no entra un mínimo", () => {
    const corta = elegirVentanaPrueba({ inicioActividadMs: 0, finActividadMs: 6 * MIN });
    expect(corta.endMs - corta.startMs).toBe(2 * MIN);
    expect(corta.startMs).toBe(2 * MIN);

    expect(elegirVentanaPrueba({ inicioActividadMs: 0, finActividadMs: 2 * MIN }).error).toMatch(
      /demasiado corta/,
    );
    expect(elegirVentanaPrueba({ inicioActividadMs: 5, finActividadMs: 5 }).error).toMatch(
      /válidos/,
    );
  });
});

describe("armado del batch", () => {
  it("replica el formato observado en el editor con un solo período", () => {
    const periodo = armarPeriodoNuevo({
      id: "nuevo",
      nombre: "TEST APP 01",
      startMs: 1000,
      endMs: 2000,
      athletes: [{ athlete_id: "a1" }],
    });
    expect(periodo).toEqual({
      id: "nuevo",
      name: "TEST APP 01",
      start_time_ms: 1000,
      end_time_ms: 2000,
      athletes: [{ athlete_id: "a1" }],
    });
    expect(armarBatch(periodo)).toEqual({ periods: [periodo] });
    expect(Object.keys(armarBatch(periodo))).toEqual(["periods"]);
  });
});

describe("validarEscrituraBatch", () => {
  const p = (extra) => ({
    id: "p1",
    name: "Base",
    start_ms: 1000000,
    end_ms: 2000000,
    athletes: [{ id: "a1" }],
    ...extra,
  });
  const antes = { periods: [p()] };
  const esperado = { nombre: "TEST APP 01", inicioMs: 1200000, finMs: 1800000, athleteIds: ["a1"] };

  it("acepta exactamente un período nuevo idéntico a lo pedido", () => {
    const despues = {
      periods: [p(), p({ id: "n", name: "TEST APP 01", start_ms: 1200000, end_ms: 1800000 })],
    };
    const r = validarEscrituraBatch({ antes, despues, esperado });
    expect(r.valido).toBe(true);
    expect(r.soloElNuevo).toBe(true);
    expect(r.participantes.valido).toBe(true);
  });

  it("separa tiempos exactos de participantes distintos", () => {
    const despues = {
      periods: [
        p(),
        p({
          id: "n",
          name: "TEST APP 01",
          start_ms: 1200000,
          end_ms: 1800000,
          athletes: [{ id: "otro" }],
        }),
      ],
    };
    const r = validarEscrituraBatch({ antes, despues, esperado });
    expect(r.valido).toBe(true);
    expect(r.participantes.valido).toBe(false);
    expect(r.participantes.detalle).toEqual({ faltantes: ["a1"], sobrantes: ["otro"] });
  });

  it("rechaza si tocó otro período o si el tiempo difiere", () => {
    const tocado = {
      periods: [
        p({ end_ms: 2000010 }),
        p({ id: "n", name: "TEST APP 01", start_ms: 1200000, end_ms: 1800000 }),
      ],
    };
    expect(validarEscrituraBatch({ antes, despues: tocado, esperado }).valido).toBe(false);

    const corrido = {
      periods: [p(), p({ id: "n", name: "TEST APP 01", start_ms: 1200000, end_ms: 1800010 })],
    };
    const r = validarEscrituraBatch({ antes, despues: corrido, esperado });
    expect(r.soloElNuevo).toBe(true);
    expect(r.valido).toBe(false);
    expect(r.corte.diferenciaFinMs).toBe(10);
  });
});

describe("veredictoEscritura", () => {
  const ok = { valido: true, diff: { sinCambios: false } };
  const quieto = { valido: false, diff: { sinCambios: true } };

  it("valida solo cuando las dos vías coinciden", () => {
    expect(veredictoEscritura({ putStatus: 200, interna: ok, connect: ok }).codigo).toBe(
      "escritura-validada",
    );
    expect(veredictoEscritura({ putStatus: 204, interna: ok, connect: quieto }).codigo).toBe(
      "escritura-con-diferencias",
    );
  });

  it("distingue rechazo intacto, rechazo con cambios y aceptación sin efecto", () => {
    expect(veredictoEscritura({ putStatus: 422, interna: quieto, connect: quieto })).toEqual({
      codigo: "escritura-rechazada",
      detalle: "OpenField rechazó el batch (422). Nada cambió.",
    });
    expect(
      veredictoEscritura({ putStatus: 500, interna: ok, connect: quieto }).detalle,
    ).toMatch(/ATENCIÓN/);
    expect(veredictoEscritura({ putStatus: 200, interna: quieto, connect: quieto }).codigo).toBe(
      "sin-cambios",
    );
  });
});
