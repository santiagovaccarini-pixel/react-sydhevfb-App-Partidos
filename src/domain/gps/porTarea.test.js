import { describe, expect, test } from "vitest";
import { MAXIMO_DE_COMPARACIONES, entraEnPorTarea, filasDeComparacion, informePorTarea, pasaLosFiltrosDeTarea } from "./porTarea.js";

// Filas inventadas: tareas del promedio del equipo (Parcial) y de jugadores.
let siguiente = 0;
const fila = ({ promedio = null, jugador_id = null, fecha = "2026-05-04", ...datos }) => ({
  id: `t${(siguiente += 1)}`,
  fecha,
  promedio,
  jugador_id,
  persona: null,
  datos: { condicion: "parcial", dispositivo: "catapult", clasificacion_dias: "mas1_m", ...datos },
});
const tarea = (microciclo, fecha, datos = {}) => fila({ promedio: "parcial", microciclo, fecha, tipo_sesion: "tarea_mixta", ...datos });

describe("qué entra y los filtros de cada comparación", () => {
  test("Va vacío, No o Si (sin mirar la Condición); los filtros: Tipo de Sesión, Microciclo, Fecha, Nombre y Condición", () => {
    expect(entraEnPorTarea(tarea(17, "a"))).toBe(true);
    expect(entraEnPorTarea(tarea(17, "a", { va: "no" }))).toBe(true);
    expect(entraEnPorTarea(tarea(17, "a", { va: "readaptacion" }))).toBe(false);
    expect(entraEnPorTarea(tarea(17, "a", { condicion: "total" }))).toBe(true);
    const una = tarea(17, "2026-05-04", { condicion: "total" });
    expect(pasaLosFiltrosDeTarea(una, {})).toBe(true);
    expect(pasaLosFiltrosDeTarea(una, { tipo_sesion: ["tarea_mixta"], microciclo: [17, 18], fecha: ["2026-05-04"], nombre: ["promedio:parcial"], condicion: ["total"] })).toBe(true);
    expect(pasaLosFiltrosDeTarea(una, { tipo_sesion: ["din_compleja"] })).toBe(false);
    expect(pasaLosFiltrosDeTarea(una, { condicion: ["parcial"] })).toBe(false);
    expect(pasaLosFiltrosDeTarea(una, { nombre: ["jugador:3"] })).toBe(false);
  });
  test("una fila por microciclo, de menor a mayor; N° de sesiones, los días de ese microciclo (también los de Va Readaptación)", () => {
    const filas = [
      tarea(18, "2026-05-11", { d: 300 }),
      tarea(10, "2026-03-02", { d: 100 }),
      tarea(10, "2026-03-03", { d: 200 }),
      tarea(10, "2026-03-03", { d: 900, tipo_sesion: "din_compleja" }),
      fila({ jugador_id: 3, microciclo: 18, fecha: "2026-05-12", d: 500, va: "readaptacion", tipo_sesion: "tarea_mixta" }),
    ];
    const deTareaMixta = filasDeComparacion(filas, { tipo_sesion: ["tarea_mixta"] });
    expect(deTareaMixta.map((una) => [una.microciclo, una.sumas.d, una.promedios.d, una.sesiones])).toEqual([
      [10, 300, 150, 2],
      [18, 300, 300, 2],
    ]);
  });
});

describe("el informe Por tarea", () => {
  const vrCatapult = { id: "c", dispositivo: "catapult", promedio: { d: 1000, d_shi: 100, d_acchi: 10, d_dechi: 10, d_mphi: 100, d_s6: 10, d_a8: 10, d_a1: 10, d_mp5: 10, tiempo: 3600 }, desvio: { d: 100 } };
  const vrSport = { id: "s", dispositivo: "sport", promedio: { d: 500 }, desvio: { d: 50 } };
  const asignaciones = [{ referencia: vrCatapult, microciclos: null }, { referencia: vrSport, microciclos: null }];
  const FILAS = () => [
    tarea(10, "2026-03-02", { d: 400, ua: 100, dispositivo: "sport" }),
    tarea(17, "2026-05-04", { d: 800, ua: 200 }),
    tarea(18, "2026-05-11", { d: 1200, ua: 300 }),
    tarea(18, "2026-05-11", { d: 600, ua: 100, tipo_sesion: "din_compleja" }),
  ];
  test("la fila de cada comparación promedia todos los microciclos elegidos (Santiago, 16/10: «LAS SELECCIONADAS»); arriba, el promedio de las comparaciones", () => {
    const informe = informePorTarea(FILAS(), {
      comparaciones: [{ filtros: { tipo_sesion: ["tarea_mixta"] } }, { filtros: { tipo_sesion: ["din_compleja"] } }],
      asignaciones,
    });
    const [a, b] = informe.comparaciones;
    expect([a.letra, b.letra]).toEqual(["A", "B"]);
    expect(a.filas.map((una) => [una.microciclo, una.variables.d])).toEqual([
      [10, 400],
      [17, 800],
      [18, 1200],
    ]);
    // El 10 cuenta (el archivo tomaba solo los del 17 en adelante).
    expect(a.resumen.variables.d).toBe(800);
    expect([a.resumen.cantidad, a.resumen.sesiones]).toEqual([3, 3]);
    expect(a.resumen.sumas.ua).toBe(200);
    expect(b.resumen.variables.d).toBe(600);
    expect(informe.general.variables.d).toBe(700);
    expect(informe.general.cantidad).toBeNull();
  });
  test("cada fila con el V.R. de su dispositivo; los índices con D_MP5 (el archivo usaba el tiempo)", () => {
    const filas = [tarea(10, "a", { d: 400, dispositivo: "sport" }), tarea(17, "b", { d: 1000, d_shi: 100, d_acchi: 10, d_dechi: 10, d_mphi: 100, d_s6: 10, d_a8: 10, d_a1: 10, d_mp5: 20, tiempo: 1800 })];
    const informe = informePorTarea(filas, { asignaciones, visualizacion: "porcentajePromedio" });
    const [del10, del17] = informe.comparaciones[0].filas;
    expect([del10.vr.id, del10.variables.d]).toEqual(["s", 0.8]);
    expect([del17.vr.id, del17.variables.d]).toEqual(["c", 1]);
    // Máxima: el promedio de D_S6, D_A8, D_A1 y D_MP5 (1, 1, 1 y 2), no del tiempo (0,5).
    expect(del17.indices.maxima).toBe(1.25);
    expect(del17.indices.volumen).toBeCloseTo((1 + 4 * 1 + 4 * 1.25) / 9, 12);
  });
  test("no se pinta (Santiago, 16/10: «por tarea no se pinta con nada»): sin franjas; los V.R., solo para los %", () => {
    const informe = informePorTarea(FILAS(), { comparaciones: [{ filtros: { tipo_sesion: ["tarea_mixta"] } }], asignaciones, categorizacion: "valorReferencial" });
    expect(Object.keys(informe).sort()).toEqual(["comparaciones", "general", "tablas"]);
    expect(informe.tablas).toEqual([
      { asignacion: 0, vr: vrCatapult },
      { asignacion: 1, vr: vrSport },
    ]);
  });
  test("una comparación sin filas no tiene fila de promedio; como mucho, 5 comparaciones", () => {
    const informe = informePorTarea(FILAS(), { comparaciones: [{ filtros: { microciclo: [99] } }] });
    expect(informe.comparaciones[0].resumen).toBeNull();
    expect(informe.general).toBeNull();
    const muchas = informePorTarea(FILAS(), { comparaciones: Array.from({ length: 7 }, () => ({ filtros: {} })) });
    expect(muchas.comparaciones).toHaveLength(MAXIMO_DE_COMPARACIONES);
    expect(muchas.comparaciones.map((una) => una.letra)).toEqual(["A", "B", "C", "D", "E"]);
  });
});
