import { describe, expect, test } from "vitest";
import { COLORES_INFORME, colorDeMayorMejor } from "./porMicrociclo.js";
import { FILTROS_POR_JUGADOR, informePorJugador, soloDeJugadores } from "./porJugador.js";

// Filas inventadas: sesiones con el promedio del equipo y dos jugadores.
let siguiente = 0;
const fila = ({ promedio = null, jugador_id = null, fecha, ...datos }) => ({
  id: `j${(siguiente += 1)}`,
  fecha,
  promedio,
  jugador_id,
  persona: null,
  datos: { condicion: "total", dispositivo: "catapult", clasificacion_dias: "mas1_m", tipo_sesion: "din_colectiva", ...datos },
});
// En cada microciclo, un día: el promedio del equipo y los jugadores 1 y 2.
const FILAS = () =>
  [
    [17, "2026-05-04", 1000, 800, 1200],
    [18, "2026-05-11", 2000, 1500, 2500],
    [19, "2026-05-18", 3000, 3300, 2700],
    [20, "2026-05-25", 4000, 4400, 3600],
  ].flatMap(([microciclo, fecha, equipo, uno, dos]) => [
    fila({ promedio: "sesion", fecha, microciclo, d: equipo, ua: 300 }),
    fila({ jugador_id: 1, fecha, microciclo, d: uno, ua: 100 * microciclo, va: "si" }),
    fila({ jugador_id: 2, fecha, microciclo, d: dos, ua: 200, va: "si" }),
  ]);
const vr = { id: "c", dispositivo: "catapult", promedio: { d: 2000 }, desvio: { d: 500 } };
const asignaciones = [{ referencia: vr, microciclos: null }];

describe("Por jugador", () => {
  test("los filtros de cada comparación (como sus segmentaciones del archivo)", () => {
    expect(FILTROS_POR_JUGADOR).toEqual(["nombre", "microciclo", "fecha", "tipo_sesion", "condicion", "clasificacion_dias"]);
  });
  test("una fila por microciclo del jugador y la de la comparación con el promedio de todos (también los de antes del 17)", () => {
    const filas = [...FILAS(), fila({ jugador_id: 1, fecha: "2026-03-02", microciclo: 10, d: 600, ua: 50, va: "si", dispositivo: "sport" })];
    const informe = informePorJugador(filas, { comparaciones: [{ filtros: { nombre: ["jugador:1"] } }], asignaciones });
    const [a] = informe.comparaciones;
    expect(a.letra).toBe("A");
    expect(a.filas.map((una) => [una.microciclo, una.variables.d, una.sesiones])).toEqual([
      [10, 600, 1],
      [17, 800, 1],
      [18, 1500, 1],
      [19, 3300, 1],
      [20, 4400, 1],
    ]);
    expect(a.resumen.variables.d).toBe((600 + 800 + 1500 + 3300 + 4400) / 5);
    expect([a.resumen.cantidad, a.resumen.sesiones]).toEqual([5, 5]);
  });
  test("la carga crónica del jugador en cada microciclo, si la comparación es de uno solo", () => {
    const uno = informePorJugador(FILAS(), { comparaciones: [{ filtros: { nombre: ["jugador:1"] } }] });
    // En el 20: su U.A. (2000) ÷ el promedio de la del 17 al 20 (1700, 1800, 1900, 2000).
    expect(uno.comparaciones[0].filas.map((una) => una.cargaCronica.suma)).toEqual([null, null, null, 2000 / 1850]);
    const dos = informePorJugador(FILAS(), { comparaciones: [{ filtros: { nombre: ["jugador:1", "jugador:2"] } }] });
    expect(dos.comparaciones[0].filas.every((una) => una.cargaCronica.suma === null)).toBe(true);
  });
  test("Mi selección: las franjas de cada comparación, con sus microciclos (cada jugador contra sí mismo, a 2 desvíos)", () => {
    const informe = informePorJugador(FILAS(), { comparaciones: [{ filtros: { nombre: ["jugador:1"] } }, { filtros: { nombre: ["jugador:2"] } }], asignaciones });
    const [a, b] = informe.comparaciones;
    expect(a.franjas.variables.d.bueno).toBe(2500);
    expect(b.franjas.variables.d.bueno).toBe(2500);
    const desvioA = a.franjas.variables.d.desvio;
    expect(a.franjas.variables.d.excelente).toBeCloseTo(2500 + 2 * desvioA, 9);
    expect(b.franjas.variables.d.desvio).not.toBeCloseTo(desvioA, 3);
    // La U.A., al revés (lo bajo es Excelente).
    expect(a.franjas.ua.suma.excelente).toBeLessThan(a.franjas.ua.suma.bueno);
  });
  test("Valor referencial: las del V.R. de cada fila; la fila de la comparación, con el de su último microciclo", () => {
    const informe = informePorJugador(FILAS(), { categorizacion: "valorReferencial", comparaciones: [{ filtros: { nombre: ["jugador:1"] } }], asignaciones });
    expect(informe.comparaciones[0].franjas).toBeNull();
    expect(informe.tablas[0].variables.d.bueno).toBe(2000);
    expect(informe.comparaciones[0].resumen.asignacion).toBe(0);
  });
  test("Objetivo, por microciclo: el promedio del equipo en ese microciclo y el desvío de los jugadores; solo con jugadores", () => {
    const informe = informePorJugador(FILAS(), { categorizacion: "objetivo", comparaciones: [{ filtros: { nombre: ["jugador:1"] } }], asignaciones });
    const [del17, del18] = informe.comparaciones[0].filas;
    expect(del17.franjas.variables.d.bueno).toBe(1000);
    expect(del17.franjas.variables.d.desvio).toBeCloseTo(Math.sqrt(80000), 9);
    expect(del18.franjas.variables.d.bueno).toBe(2000);
    // 800 contra 1000 ± 282,8: Regular (naranja).
    expect(colorDeMayorMejor(del17.variables.d, del17.franjas.variables.d)).toBe(COLORES_INFORME.naranja);
    // La fila de la comparación: el objetivo promedio de sus microciclos.
    expect(informe.comparaciones[0].resumen.franjas.variables.d.bueno).toBe(2500);
    // Con el promedio del equipo en Nombre (o sin nadie elegido), no hay Objetivo: queda Mi selección.
    expect(soloDeJugadores([{ filtros: { nombre: ["promedio:sesion"] } }])).toBe(false);
    expect(soloDeJugadores([{ filtros: {} }])).toBe(false);
    expect(soloDeJugadores([{ filtros: { nombre: ["jugador:1"] } }, { filtros: { nombre: ["jugador:2"] } }])).toBe(true);
    const sinJugador = informePorJugador(FILAS(), { categorizacion: "objetivo", comparaciones: [{ filtros: {} }], asignaciones });
    expect(sinJugador.categorizacion).toBe("miSeleccion");
  });
});
