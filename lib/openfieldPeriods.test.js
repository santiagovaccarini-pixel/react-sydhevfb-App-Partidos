import {
  RESOLUCION_MS,
  aMilisegundos,
  alineadoACentesimas,
  centesimas,
  compararSnapshots,
  huellaSnapshot,
  limpiarAtleta,
  limpiarPeriodo,
  ordenarPeriodos,
  validarCorteEscrito,
} from "./openfieldPeriods.js";

const periodo = (extra = {}) => ({
  id: "p1",
  name: "Posesión",
  start_ms: 1779822758000,
  end_ms: 1779823172000,
  athletes: [{ id: "a1" }, { id: "a2" }],
  ...extra,
});

describe("centésimas", () => {
  it("acepta solo enteros entre 0 y 99", () => {
    expect(centesimas(0)).toBe(0);
    expect(centesimas("37")).toBe(37);
    expect(centesimas(99)).toBe(99);
    expect(centesimas(100)).toBeNull();
    expect(centesimas(-1)).toBeNull();
    expect(centesimas(1.5)).toBeNull();
    expect(centesimas(undefined)).toBeNull();
  });

  it("suma segundos y centésimas en milisegundos", () => {
    expect(aMilisegundos(1779822758, 37)).toBe(1779822758370);
    expect(aMilisegundos(1779822758, undefined)).toBe(1779822758000);
    expect(aMilisegundos("x", 5)).toBeNull();
    expect(RESOLUCION_MS).toBe(10);
  });

  it("detecta tiempos que OpenField no puede representar", () => {
    expect(alineadoACentesimas(1779822758370)).toBe(true);
    expect(alineadoACentesimas(1779822758375)).toBe(false);
    expect(alineadoACentesimas(1779822758370.5)).toBe(false);
  });
});

describe("limpiarPeriodo", () => {
  it("expone tiempos con centésimas y duración a la centésima", () => {
    const limpio = limpiarPeriodo({
      id: "e37e",
      name: "Calentamiento",
      start_time: 1779822758,
      start_centiseconds: 25,
      end_time: 1779823172,
      end_centiseconds: 75,
      period_depth_id: "d1",
      lft: 2,
      rgt: 3,
      is_deleted: false,
    });

    expect(limpio.start_ms).toBe(1779822758250);
    expect(limpio.end_ms).toBe(1779823172750);
    expect(limpio.duration_seconds).toBe(414.5);
    expect(limpio.start_centiseconds).toBe(25);
    expect(limpio.is_deleted).toBe(false);
    expect(limpio.lft).toBe(2);
  });

  it("marca como borrado tanto true como 1", () => {
    expect(limpiarPeriodo({ id: "x", is_deleted: 1 }).is_deleted).toBe(true);
    expect(limpiarPeriodo({ id: "x", is_deleted: true }).is_deleted).toBe(true);
    expect(limpiarPeriodo({ id: "x" }).is_deleted).toBe(false);
  });

  it("ordena por inicio y desempata por lft (el padre antes que el hijo)", () => {
    const lista = [
      { id: "hijo", start_ms: 100, lft: 2 },
      { id: "tarde", start_ms: 200, lft: 4 },
      { id: "padre", start_ms: 100, lft: 1 },
    ].sort(ordenarPeriodos);
    expect(lista.map((p) => p.id)).toEqual(["padre", "hijo", "tarde"]);
  });
});

describe("limpiarAtleta", () => {
  it("arma el nombre y cae al apodo o al id", () => {
    expect(limpiarAtleta({ id: 7, first_name: "Juan", last_name: "Pérez", jersey: 10 })).toEqual({
      id: "7",
      nombre: "Juan Pérez",
      jersey: 10,
    });
    expect(limpiarAtleta({ id: 8, nickname: "Chino" }).nombre).toBe("Chino");
    expect(limpiarAtleta({ id: 9 }).nombre).toBe("9");
  });
});

describe("huellaSnapshot", () => {
  it("no depende del orden de períodos ni de participantes", () => {
    const a = { periods: [periodo(), periodo({ id: "p2", name: "Otro" })] };
    const b = {
      periods: [
        periodo({ id: "p2", name: "Otro" }),
        periodo({ athletes: [{ id: "a2" }, { id: "a1" }] }),
      ],
    };
    expect(huellaSnapshot(a)).toBe(huellaSnapshot(b));
  });

  it("cambia con nombre, tiempos, participantes, y omite borrados", () => {
    const base = huellaSnapshot({ periods: [periodo()] });
    expect(huellaSnapshot({ periods: [periodo({ name: "X" })] })).not.toBe(base);
    expect(huellaSnapshot({ periods: [periodo({ end_ms: 1779823172010 })] })).not.toBe(base);
    expect(huellaSnapshot({ periods: [periodo({ athletes: [{ id: "a1" }] })] })).not.toBe(base);
    expect(
      huellaSnapshot({ periods: [periodo(), periodo({ id: "p9", is_deleted: true })] }),
    ).toBe(base);
  });
});

describe("compararSnapshots", () => {
  it("detecta agregados, eliminados y modificados", () => {
    const antes = { periods: [periodo(), periodo({ id: "p2", name: "Se va" })] };
    const despues = {
      periods: [
        periodo({ end_ms: 1779823172010, athletes: [{ id: "a1" }] }),
        periodo({ id: "p3", name: "Nuevo" }),
      ],
    };

    const diff = compararSnapshots(antes, despues);
    expect(diff.sinCambios).toBe(false);
    expect(diff.agregados.map((p) => p.id)).toEqual(["p3"]);
    expect(diff.eliminados.map((p) => p.id)).toEqual(["p2"]);
    expect(diff.modificados).toHaveLength(1);
    expect(diff.modificados[0].cambios.end_ms).toEqual({
      antes: 1779823172000,
      despues: 1779823172010,
    });
    expect(diff.modificados[0].cambios.athletes).toEqual({ antes: ["a1", "a2"], despues: ["a1"] });
    expect(diff.modificados[0].cambios.name).toBeUndefined();
  });

  it("no inventa cambios de participantes cuando no se leyeron", () => {
    const diff = compararSnapshots(
      { periods: [periodo({ athletes: null })] },
      { periods: [periodo()] },
    );
    expect(diff.sinCambios).toBe(true);
    expect(diff.iguales).toBe(1);
  });
});

describe("validarCorteEscrito", () => {
  const snapshot = { periods: [periodo({ name: "TEST APP 01" })] };
  const esperado = { nombre: "TEST APP 01", inicioMs: 1779822758000, finMs: 1779823172000 };

  it("valida un corte idéntico", () => {
    const resultado = validarCorteEscrito({ snapshot, esperado });
    expect(resultado.valido).toBe(true);
    expect(resultado.motivo).toBe("ok");
    expect(resultado.periodo.id).toBe("p1");
  });

  it("rechaza una diferencia de una sola centésima", () => {
    const resultado = validarCorteEscrito({
      snapshot,
      esperado: { ...esperado, finMs: 1779823172010 },
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.motivo).toBe("diferencias");
    expect(resultado.diferenciaFinMs).toBe(-10);
  });

  it("rechaza un esperado que OpenField no puede representar", () => {
    const resultado = validarCorteEscrito({
      snapshot,
      esperado: { ...esperado, inicioMs: 1779822758005 },
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.motivo).toBe("esperado-invalido");
    expect(resultado.problemas[0]).toMatch(/centésimas/);
  });

  it("informa cuando el período no existe o está borrado", () => {
    expect(validarCorteEscrito({ snapshot, esperado: { ...esperado, nombre: "Otro" } }).motivo).toBe(
      "no-encontrado",
    );
    const borrado = { periods: [periodo({ name: "TEST APP 01", is_deleted: true })] };
    expect(validarCorteEscrito({ snapshot: borrado, esperado }).motivo).toBe("no-encontrado");
  });

  it("compara participantes cuando se pidieron", () => {
    const ok = validarCorteEscrito({ snapshot, esperado: { ...esperado, athleteIds: ["a2", "a1"] } });
    expect(ok.valido).toBe(true);

    const mal = validarCorteEscrito({ snapshot, esperado: { ...esperado, athleteIds: ["a1", "a3"] } });
    expect(mal.valido).toBe(false);
    expect(mal.participantes).toEqual({ faltantes: ["a3"], sobrantes: ["a2"] });
  });

  it("detecta un corte escrito dos veces", () => {
    const duplicado = {
      periods: [periodo({ name: "TEST APP 01" }), periodo({ id: "p2", name: "TEST APP 01" })],
    };
    const resultado = validarCorteEscrito({ snapshot: duplicado, esperado });
    expect(resultado.valido).toBe(false);
    expect(resultado.motivo).toBe("duplicado");
  });

  it("no valida sobre un snapshot incompleto", () => {
    const resultado = validarCorteEscrito({ snapshot: { ...snapshot, incompleto: true }, esperado });
    expect(resultado.valido).toBe(false);
    expect(resultado.motivo).toBe("esperado-invalido");
    expect(resultado.problemas[0]).toMatch(/incompleto/);
  });
});
