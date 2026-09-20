import {
  MODO_PARCIAL,
  MODO_TOTAL,
  planificarBatch,
  prepararTarea,
  resumirPausas,
  resumirVerificacion,
  tareaAPeriodos,
  ventanasDeTarea,
  verificarPeriodos,
} from "./openfieldTareas.js";

const T0 = 1779822600000; // 2026-05-26 14:30:00 UTC
const MIN = 60 * 1000;

const base = (extra = {}) => ({
  id: "t1",
  nombre: "2. POSSE",
  inicio: T0,
  fin: T0 + 15 * MIN,
  participantes: [{ atletaId: "a1" }, { atletaId: "a2" }],
  ...extra,
});

let contador = 0;
const generarId = () => `gen-${(contador += 1)}`;
beforeEach(() => {
  contador = 0;
});

describe("prepararTarea", () => {
  it("normaliza tiempos, pausas y participantes", () => {
    const tarea = prepararTarea(
      base({
        pausas: [
          { inicio: T0 + 6 * MIN, fin: T0 + 8 * MIN },
          { inicio: T0 + 2 * MIN, fin: T0 + 2 * MIN + 30_000 },
        ],
        participantes: [
          { atletaId: "a1" },
          { atletaId: "a2", modo: MODO_PARCIAL, inicio: T0 + 5 * MIN, fin: T0 + 15 * MIN },
        ],
      }),
    );

    expect(tarea.duracionBrutaSegundos).toBe(900);
    expect(tarea.pausas.map((p) => p.segundos)).toEqual([30, 120]);
    expect(tarea.pausasSegundos).toBe(150);
    expect(tarea.duracionEfectivaSegundos).toBe(750);
    expect(tarea.participantes).toEqual([
      { atletaId: "a1", modo: MODO_TOTAL, inicioMs: T0, finMs: T0 + 15 * MIN, segundos: 900 },
      { atletaId: "a2", modo: MODO_PARCIAL, inicioMs: T0 + 5 * MIN, finMs: T0 + 15 * MIN, segundos: 600 },
    ]);
    expect(resumirPausas(tarea)).toEqual({ cantidad: 2, segundosPorPausa: [30, 120], segundosTotales: 150 });
  });

  it("acepta fechas ISO, Date y segundos, y alinea a centésimas", () => {
    const tarea = prepararTarea(
      base({
        inicio: new Date(T0 + 4),
        fin: new Date(T0 + 15 * MIN + 7).toISOString(),
        participantes: [],
      }),
    );
    expect(tarea.inicioMs).toBe(T0);
    expect(tarea.finMs).toBe(T0 + 15 * MIN + 10);
    expect(tarea.finMs % 10).toBe(0);
    expect(prepararTarea(base({ inicio: T0 / 1000, fin: T0 / 1000 + 60 })).inicioMs).toBe(T0);
  });

  it("un parcial que cubre toda la tarea pasa a ser total", () => {
    const tarea = prepararTarea(
      base({ participantes: [{ atletaId: "a1", modo: MODO_PARCIAL, inicio: T0, fin: T0 + 15 * MIN }] }),
    );
    expect(tarea.participantes[0].modo).toBe(MODO_TOTAL);
  });

  it("rechaza lo que no puede escribirse bien", () => {
    expect(() => prepararTarea(base({ id: "" }))).toThrow("necesita un id");
    expect(() => prepararTarea(base({ nombre: "  " }))).toThrow("necesita un nombre");
    expect(() => prepararTarea(base({ fin: T0 }))).toThrow("posterior al inicio");
    expect(() => prepararTarea(base({ pausas: [{ inicio: T0 - 1000, fin: T0 + 1000 }] }))).toThrow(
      "fuera de los límites",
    );
    expect(() =>
      prepararTarea(
        base({
          pausas: [
            { inicio: T0 + 1 * MIN, fin: T0 + 3 * MIN },
            { inicio: T0 + 2 * MIN, fin: T0 + 4 * MIN },
          ],
        }),
      ),
    ).toThrow("se superponen");
    expect(() => prepararTarea(base({ participantes: [{ atletaId: "a1" }, { atletaId: "a1" }] }))).toThrow(
      "repetido",
    );
    expect(() => prepararTarea(base({ participantes: [{ atletaId: "" }] }))).toThrow("identificador");
    expect(() =>
      prepararTarea(base({ participantes: [{ atletaId: "a1", modo: MODO_PARCIAL }] })),
    ).toThrow("no es una fecha/hora válida");
    expect(() =>
      prepararTarea(
        base({
          participantes: [{ atletaId: "a1", modo: MODO_PARCIAL, inicio: T0 + 10 * MIN, fin: T0 + 20 * MIN }],
        }),
      ),
    ).toThrow("fuera de la tarea");
  });
});

describe("ventanasDeTarea y tareaAPeriodos", () => {
  it("solo totales: un único período de punta a punta con todos", () => {
    const { periodos, asignaciones, idsObsoletos } = tareaAPeriodos(prepararTarea(base()), { generarId });
    expect(periodos).toHaveLength(1);
    expect(periodos[0]).toMatchObject({
      id: "gen-1",
      name: "2. POSSE",
      start_time_ms: T0,
      end_time_ms: T0 + 15 * MIN,
      athletes: [{ id: "a1" }, { id: "a2" }],
      tareaId: "t1",
      ventana: { principal: true },
    });
    expect(asignaciones).toEqual({ [`t1|${T0}-${T0 + 15 * MIN}`]: "gen-1" });
    expect(idsObsoletos).toEqual([]);
  });

  it("parciales: un período aparte con el mismo nombre por cada ventana distinta", () => {
    const tarea = prepararTarea(
      base({
        participantes: [
          { atletaId: "a1" },
          { atletaId: "a2", modo: MODO_PARCIAL, inicio: T0 + 5 * MIN, fin: T0 + 15 * MIN },
          { atletaId: "a3", modo: MODO_PARCIAL, inicio: T0 + 5 * MIN, fin: T0 + 15 * MIN },
          { atletaId: "a4", modo: MODO_PARCIAL, inicio: T0, fin: T0 + 10 * MIN },
        ],
      }),
    );
    const ventanas = ventanasDeTarea(tarea);
    expect(ventanas.map((v) => [v.principal, v.atletaIds])).toEqual([
      [true, ["a1"]],
      [false, ["a4"]],
      [false, ["a2", "a3"]],
    ]);

    const { periodos } = tareaAPeriodos(tarea, { generarId });
    expect(periodos).toHaveLength(3);
    expect(new Set(periodos.map((p) => p.name)).size).toBe(1);
    const todos = periodos.flatMap((p) => p.athletes.map((a) => a.id));
    expect(todos.sort()).toEqual(["a1", "a2", "a3", "a4"]);
  });

  it("solo parciales: no crea un período principal vacío; sin participantes: crea uno vacío", () => {
    const soloParciales = prepararTarea(
      base({ participantes: [{ atletaId: "a1", modo: MODO_PARCIAL, inicio: T0 + MIN, fin: T0 + 5 * MIN }] }),
    );
    expect(ventanasDeTarea(soloParciales).map((v) => v.principal)).toEqual([false]);

    const vacia = prepararTarea(base({ participantes: [] }));
    const ventanas = ventanasDeTarea(vacia);
    expect(ventanas).toHaveLength(1);
    expect(ventanas[0]).toMatchObject({ principal: true, atletaIds: [] });
  });

  it("reutiliza los ids asignados al regenerar y retira las ventanas que desaparecen", () => {
    const conParcial = prepararTarea(
      base({
        participantes: [
          { atletaId: "a1" },
          { atletaId: "a2", modo: MODO_PARCIAL, inicio: T0 + 5 * MIN, fin: T0 + 15 * MIN },
        ],
      }),
    );
    const primera = tareaAPeriodos(conParcial, { generarId });
    expect(primera.periodos.map((p) => p.id)).toEqual(["gen-1", "gen-2"]);

    // Corrección: a2 pasa a total → la ventana parcial desaparece.
    const corregida = prepararTarea(base({ participantes: [{ atletaId: "a1" }, { atletaId: "a2" }] }));
    const segunda = tareaAPeriodos(corregida, { asignaciones: primera.asignaciones, generarId });
    expect(segunda.periodos.map((p) => p.id)).toEqual(["gen-1"]);
    expect(segunda.periodos[0].athletes).toEqual([{ id: "a1" }, { id: "a2" }]);
    expect(segunda.idsObsoletos).toEqual(["gen-2"]);
    expect(Object.keys(segunda.asignaciones)).toEqual([`t1|${T0}-${T0 + 15 * MIN}`]);
  });

  it("no toca las asignaciones de otras tareas", () => {
    const ajenas = { "t9|1-2": "otro" };
    const { asignaciones, idsObsoletos } = tareaAPeriodos(prepararTarea(base()), {
      asignaciones: ajenas,
      generarId,
    });
    expect(asignaciones["t9|1-2"]).toBe("otro");
    expect(idsObsoletos).toEqual([]);
  });

  it("exige generarId", () => {
    expect(() => tareaAPeriodos(prepararTarea(base()))).toThrow("generarId");
  });
});

describe("planificarBatch", () => {
  const actuales = [
    { id: "ajeno", name: "Calentamiento", start_time_ms: 1, end_time_ms: 2, athletes: [{ id: "x" }] },
    { id: "g1", name: "viejo", start_time_ms: 3, end_time_ms: 4, athletes: [] },
    { id: "obs", name: "parcial viejo", start_time_ms: 5, end_time_ms: 6, athletes: [] },
  ];
  const gestionados = [
    { id: "g1", name: "2. POSSE", start_time_ms: 10, end_time_ms: 20, athletes: [{ id: "a1" }] },
    { id: "n1", name: "2. POSSE", start_time_ms: 12, end_time_ms: 20, athletes: [{ id: "a2" }] },
  ];

  it("preserva ajenos, reemplaza por id, agrega nuevos y retira obsoletos", () => {
    const { batch, resumen } = planificarBatch({
      periodosActuales: actuales,
      periodosGestionados: gestionados,
      idsObsoletos: ["obs"],
      periodosConnect: [{ id: "ajeno", period_depth_id: "d1" }, { id: "g1", period_depth_id: "d2" }],
    });

    expect(batch.periods.map((p) => p.id)).toEqual(["ajeno", "g1", "n1"]);
    expect(batch.periods[0]).toEqual({
      id: "ajeno",
      name: "Calentamiento",
      start_time_ms: 1,
      end_time_ms: 2,
      athletes: [{ id: "x" }],
      period_depth_id: "d1",
    });
    expect(batch.periods[1]).toMatchObject({ name: "2. POSSE", start_time_ms: 10, period_depth_id: "d2" });
    expect(batch.periods[2].period_depth_id).toBeUndefined();
    expect(resumen).toEqual({ actuales: 3, preservados: 1, reemplazados: 1, nuevos: 1, eliminados: 1, total: 3 });
    expect(resumen.preservados + resumen.reemplazados + resumen.eliminados).toBe(actuales.length);
  });

  it("sin gestionados devuelve exactamente los actuales (nunca vacía la actividad por accidente)", () => {
    const { batch, resumen } = planificarBatch({ periodosActuales: actuales });
    expect(batch.periods.map((p) => p.id)).toEqual(["ajeno", "g1", "obs"]);
    expect(resumen).toMatchObject({ preservados: 3, reemplazados: 0, nuevos: 0, eliminados: 0 });
  });
});

describe("verificarPeriodos y resumirVerificacion", () => {
  const esperados = [
    { id: "p1", tareaId: "t1", name: "2. POSSE", start_time_ms: 1000, end_time_ms: 2000, athletes: [{ id: "a1" }, { id: "a2" }] },
    { id: "p2", tareaId: "t1", name: "2. POSSE", start_time_ms: 1500, end_time_ms: 2000, athletes: [{ id: "a3" }] },
    { id: "p3", tareaId: "t2", name: "3. PJ RED", start_time_ms: 3000, end_time_ms: 4000, athletes: [] },
  ];

  it("marca ok solo con nombre, tiempos exactos y mismos participantes", () => {
    const snapshot = {
      periods: [
        { id: "p1", name: "2. POSSE", start_ms: 1000, end_ms: 2000, athletes: [{ id: "a2", nombre: "B" }, { id: "a1" }] },
        { id: "p2", name: "2. POSSE", start_ms: 1500, end_ms: 2010, athletes: [{ id: "a3" }] },
        { id: "p3", name: "3. PJ RED", start_ms: 3000, end_ms: 4000, athletes: [{ id: "colado" }], is_deleted: true },
      ],
    };
    const resultados = verificarPeriodos({ esperados, snapshot });

    expect(resultados[0]).toMatchObject({ periodId: "p1", ok: true, motivo: "ok", diferenciaInicioMs: 0, diferenciaFinMs: 0 });
    expect(resultados[1]).toMatchObject({ ok: false, motivo: "diferencias", diferenciaFinMs: 10 });
    expect(resultados[2]).toMatchObject({ periodId: "p3", ok: false, motivo: "no-encontrado" });

    const resumen = resumirVerificacion(resultados);
    expect(resumen.ok).toBe(false);
    expect(resumen.periodos).toBe(3);
    expect(resumen.fallidos).toBe(2);
    expect(resumen.tareas).toEqual([
      { tareaId: "t1", ok: false, periodos: 2, fallidos: [{ periodId: "p2", motivo: "diferencias" }] },
      { tareaId: "t2", ok: false, periodos: 1, fallidos: [{ periodId: "p3", motivo: "no-encontrado" }] },
    ]);
  });

  it("detecta participantes faltantes y sobrantes aunque los tiempos sean exactos", () => {
    const snapshot = {
      periods: [{ id: "p1", name: "2. POSSE", start_ms: 1000, end_ms: 2000, athletes: [{ id: "a1" }, { id: "zz" }] }],
    };
    const [r] = verificarPeriodos({ esperados: [esperados[0]], snapshot });
    expect(r.ok).toBe(false);
    expect(r.participantes).toEqual({ faltantes: ["a2"], sobrantes: ["zz"] });
    expect(resumirVerificacion([r]).tareas[0].ok).toBe(false);
  });

  it("con todo exacto la verificación global es ok", () => {
    const snapshot = {
      periods: esperados.map((e) => ({ id: e.id, name: e.name, start_ms: e.start_time_ms, end_ms: e.end_time_ms, athletes: e.athletes })),
    };
    const resumen = resumirVerificacion(verificarPeriodos({ esperados, snapshot }));
    expect(resumen).toMatchObject({ ok: true, periodos: 3, fallidos: 0 });
    expect(resumen.tareas.map((t) => t.ok)).toEqual([true, true]);
  });
});
