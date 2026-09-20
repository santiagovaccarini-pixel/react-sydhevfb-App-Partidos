import { evaluarEnvio, planificarCortes } from "./openfieldEnvio.js";
import { MODO_PARCIAL } from "./openfieldTareas.js";

const MIN = 60 * 1000;
const T0 = 1779822600000;

let contador = 0;
const generarId = () => `gen-${(contador += 1)}`;
beforeEach(() => {
  contador = 0;
});

const actividad = () => ({
  id: "act",
  name: "26-05 T",
  start_time_ms: T0,
  end_time_ms: T0 + 90 * MIN,
  periods: [
    { id: "ajeno", name: "Calentamiento", start_time_ms: T0, end_time_ms: T0 + 10 * MIN, athletes: [{ id: "x" }] },
    { id: "viejo", name: "2. POSSE", start_time_ms: T0 + 20 * MIN, end_time_ms: T0 + 30 * MIN, athletes: [{ id: "a1" }] },
  ],
});

const tareas = () => [
  {
    id: "t1",
    nombre: "2. POSSE",
    inicio: T0 + 20 * MIN,
    fin: T0 + 35 * MIN,
    pausas: [{ inicio: T0 + 25 * MIN, fin: T0 + 26 * MIN }],
    participantes: [
      { atletaId: "a1" },
      { atletaId: "a2", modo: MODO_PARCIAL, inicio: T0 + 25 * MIN, fin: T0 + 35 * MIN },
    ],
  },
  { id: "t2", nombre: "3. PJ RED", inicio: T0 + 40 * MIN, fin: T0 + 50 * MIN, participantes: [{ atletaId: "a1" }, { atletaId: "a2" }] },
];

describe("planificarCortes", () => {
  it("convierte las tareas en períodos, reutiliza ids y preserva lo ajeno", () => {
    const plan = planificarCortes({
      tareas: tareas(),
      asignaciones: { [`t1|${T0 + 20 * MIN}-${T0 + 35 * MIN}`]: "viejo" },
      actividadInterna: actividad(),
      periodosConnect: [{ id: "ajeno", period_depth_id: "d1" }],
      generarId,
    });

    expect(plan.ok).toBe(true);
    expect(plan.batch.periods.map((p) => p.id)).toEqual(["ajeno", "viejo", "gen-1", "gen-2"]);
    expect(plan.batch.periods[0]).toMatchObject({ name: "Calentamiento", period_depth_id: "d1", athletes: [{ id: "x" }] });
    expect(plan.batch.periods[1]).toMatchObject({ name: "2. POSSE", start_time_ms: T0 + 20 * MIN, end_time_ms: T0 + 35 * MIN, athletes: [{ id: "a1" }] });
    // a1 ya figura en la actividad: se copia su objeto interno. a2 no: va como { athlete_id }.
    expect(plan.batch.periods[2]).toMatchObject({ name: "2. POSSE", start_time_ms: T0 + 25 * MIN, athletes: [{ athlete_id: "a2" }] });
    expect(plan.resumen).toEqual({ actuales: 2, preservados: 1, reemplazados: 1, nuevos: 2, eliminados: 0, total: 4 });
    expect(plan.tareas[0]).toMatchObject({
      tareaId: "t1",
      pausas: { cantidad: 1, segundosTotales: 60 },
      duracionEfectivaSegundos: 840,
    });
    expect(plan.tareas[0].periodos.map((p) => p.participantes)).toEqual([1, 1]);
    expect(Object.keys(plan.asignaciones)).toHaveLength(3);
  });

  it("rechaza tareas inválidas sin armar batch", () => {
    const plan = planificarCortes({
      tareas: [
        { id: "t1", nombre: "", inicio: T0, fin: T0 + MIN, participantes: [] },
        { id: "t3", nombre: "Bien", inicio: T0 + MIN, fin: T0 + 2 * MIN, participantes: [] },
      ],
      actividadInterna: actividad(),
      generarId,
    });
    expect(plan.ok).toBe(false);
    expect(plan.errores.map((e) => e.tareaId)).toEqual(["t1"]);
    expect(plan.errores[0].error).toMatch(/nombre/);
    expect(plan.batch).toBeUndefined();
  });

  // En 26-05 T la actividad "dura" 7 minutos según OpenField y tiene períodos
  // 20 minutos después: el horario informado no es un límite real.
  it("una tarea fuera del horario informado de la actividad se avisa, pero se envía", () => {
    const plan = planificarCortes({
      tareas: [
        { id: "t2", nombre: "Tarde", inicio: T0 + 80 * MIN, fin: T0 + 100 * MIN, participantes: [{ atletaId: "a1" }] },
        { id: "t3", nombre: "Bien", inicio: T0 + MIN, fin: T0 + 2 * MIN, participantes: [{ atletaId: "a1" }] },
      ],
      actividadInterna: actividad(),
      generarId,
    });
    expect(plan.ok).toBe(true);
    expect(plan.avisos).toEqual([
      { tareaId: "t2", nombre: "Tarde", aviso: "Queda fuera del horario que OpenField informa para la actividad." },
    ]);
    expect(plan.batch.periods.map((p) => p.name)).toEqual(["Calentamiento", "2. POSSE", "Tarde", "Bien"]);
  });

  it("sin un fin válido de la actividad no avisa nada", () => {
    const plan = planificarCortes({
      tareas: [{ id: "t2", nombre: "Tarde", inicio: T0 + 80 * MIN, fin: T0 + 100 * MIN, participantes: [{ atletaId: "a1" }] }],
      actividadInterna: { ...actividad(), end_time_ms: null },
      generarId,
    });
    expect(plan.ok).toBe(true);
    expect(plan.avisos).toEqual([]);
  });

  it("nunca vacía la actividad", () => {
    const plan = planificarCortes({
      tareas: [],
      asignaciones: { "t9|1-2": "ajeno", "t9|3-4": "viejo" },
      actividadInterna: actividad(),
      generarId,
    });
    // Sin tareas no hay gestionados; las asignaciones ajenas no se tocan y
    // el batch devuelve exactamente los actuales.
    expect(plan.ok).toBe(true);
    expect(plan.batch.periods.map((p) => p.id)).toEqual(["ajeno", "viejo"]);
  });

  it("retira las ventanas que desaparecen y lo cuenta como eliminado", () => {
    const plan = planificarCortes({
      tareas: [{ id: "t1", nombre: "2. POSSE", inicio: T0 + 20 * MIN, fin: T0 + 30 * MIN, participantes: [{ atletaId: "a1" }] }],
      asignaciones: {
        [`t1|${T0 + 20 * MIN}-${T0 + 30 * MIN}`]: "viejo",
        [`t1|${T0 + 25 * MIN}-${T0 + 30 * MIN}`]: "ajeno",
      },
      actividadInterna: actividad(),
      generarId,
    });
    expect(plan.ok).toBe(true);
    expect(plan.idsObsoletos).toEqual(["ajeno"]);
    expect(plan.batch.periods.map((p) => p.id)).toEqual(["viejo"]);
    expect(plan.resumen).toMatchObject({ preservados: 0, reemplazados: 1, eliminados: 1, nuevos: 0 });
  });
});

describe("evaluarEnvio", () => {
  const gestionados = [
    { id: "g1", tareaId: "t1", name: "2. POSSE", start_time_ms: 1000, end_time_ms: 2000, athletes: [{ id: "a1" }] },
    { id: "g2", tareaId: "t2", name: "3. PJ RED", start_time_ms: 3000, end_time_ms: 4000, athletes: [] },
  ];
  const ajeno = { id: "ajeno", name: "Calentamiento", start_ms: 0, end_ms: 500, athletes: [{ id: "x" }] };
  const ok = (extra = {}) => ({
    periods: [
      ajeno,
      { id: "g1", name: "2. POSSE", start_ms: 1000, end_ms: 2000, athletes: [{ id: "a1" }] },
      { id: "g2", name: "3. PJ RED", start_ms: 3000, end_ms: 4000, athletes: [] },
      ...(extra.periods || []),
    ],
  });

  it("valida cuando todo quedó exacto por las dos vías y lo ajeno intacto", () => {
    const r = evaluarEnvio({
      periodosGestionados: gestionados,
      idsObsoletos: ["obs"],
      internoAntes: { periods: [ajeno, { id: "obs", name: "viejo", start_ms: 1, end_ms: 2, athletes: [] }] },
      internoDespues: ok(),
      connectDespues: ok(),
    });
    expect(r.ok).toBe(true);
    expect(r.veredicto.codigo).toBe("cortes-validados");
    expect(r.preservadosIntactos).toBe(true);
    expect(r.obsoletosRetirados).toBe(true);
    expect(r.tareas).toEqual([
      { tareaId: "t1", ok: true, fallidos: [] },
      { tareaId: "t2", ok: true, fallidos: [] },
    ]);
  });

  it("marca la tarea con un período corrido y mantiene ok las demás", () => {
    const corrido = ok();
    corrido.periods[2] = { ...corrido.periods[2], end_ms: 4010 };
    const r = evaluarEnvio({ periodosGestionados: gestionados, internoAntes: { periods: [ajeno] }, internoDespues: ok(), connectDespues: corrido });
    expect(r.ok).toBe(false);
    expect(r.veredicto.codigo).toBe("cortes-con-diferencias");
    expect(r.tareas.find((t) => t.tareaId === "t1").ok).toBe(true);
    expect(r.tareas.find((t) => t.tareaId === "t2")).toEqual({ tareaId: "t2", ok: false, fallidos: [{ periodId: "g2", motivo: "diferencias" }] });
  });

  it("detecta que se tocó un período ajeno aunque los cortes estén bien", () => {
    const tocado = ok();
    tocado.periods[0] = { ...ajeno, athletes: [] };
    const r = evaluarEnvio({ periodosGestionados: gestionados, internoAntes: { periods: [ajeno] }, internoDespues: tocado, connectDespues: ok() });
    expect(r.ok).toBe(false);
    expect(r.veredicto.codigo).toBe("ajenos-tocados");
    expect(r.diffAjenos.modificados[0].id).toBe("ajeno");
  });

  it("sin relectura no da nada por bueno", () => {
    const r = evaluarEnvio({ periodosGestionados: gestionados, internoAntes: { periods: [] }, internoDespues: null, connectDespues: null });
    expect(r.ok).toBe(false);
    expect(r.veredicto.codigo).toBe("sin-relectura");
  });
});
