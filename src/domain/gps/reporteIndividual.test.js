import { describe, expect, test } from "vitest";
import { COLORES_INFORME } from "./porMicrociclo.js";
import { COLUMNAS_POR_MINUTO, COLUMNAS_TOTALES, colorDelReporte, jugadoresDelReporte, minutosDe, reporteIndividual } from "./reporteIndividual.js";

// Filas inventadas: 12 días con el promedio del equipo de la sesión y dos
// jugadores; el 1, con 12 sesiones; el 2, con todas.
let siguiente = 0;
const fila = ({ promedio = null, jugador_id = null, fecha, ...datos }) => ({
  id: `r${(siguiente += 1)}`,
  orden: siguiente,
  fecha,
  promedio,
  jugador_id,
  persona: null,
  datos: { condicion: "total", dispositivo: "catapult", tipo_sesion: "din_colectiva", ...datos },
});
const dia = (n) => `2026-05-${String(n).padStart(2, "0")}`;
const FILAS = () =>
  Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    return [
      fila({ promedio: "sesion", fecha: dia(n), microciclo: 17, tiempo: 3600, d: 1000 * n, d_min: (1000 * n) / 60, pse: 5, ua: 300 }),
      fila({ jugador_id: 1, fecha: dia(n), microciclo: 17, tiempo: 3600, d: 1000 * n - 200, d_min: (1000 * n - 200) / 60, pse: 6, ua: 360, va: "si", descripcion: `Día ${n}` }),
      fila({ jugador_id: 2, fecha: dia(n), microciclo: 17, tiempo: 3600, d: 1000 * n + 200, d_min: (1000 * n + 200) / 60, pse: 4, ua: 240, va: "si" }),
    ];
  }).flat();

describe("Reporte individual", () => {
  test("las columnas, como el archivo (Tiempo y las 9 medidas; en Por minuto, sus por minuto)", () => {
    expect(COLUMNAS_TOTALES).toEqual(["tiempo", "d", "d_shi", "d_acchi", "d_dechi", "d_mphi", "d_s6", "d_a8", "d_a1", "d_mp5"]);
    expect(COLUMNAS_POR_MINUTO).toEqual(["tiempo", "d_min", "d_shi_min", "d_acchi_min", "d_dechi_min", "d_mphi_min", "d_s6_min", "d_a8_min", "d_a1_min", "d_mp5_min"]);
  });

  test("los últimos 10 del jugador y del equipo, de la fecha más nueva para atrás; solo Condición Total", () => {
    const filas = [...FILAS(), fila({ jugador_id: 1, fecha: dia(13), microciclo: 17, condicion: "parcial", tiempo: 600, d: 99 })];
    const reporte = reporteIndividual(filas, { jugador: "jugador:1" });
    expect(reporte.jugador.filas.map((una) => una.fecha)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map(dia));
    expect(reporte.jugador.cuantas).toBe(12);
    expect(reporte.equipo.filas.map((una) => una.valores.d)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((n) => 1000 * n));
    expect(reporte.jugador.filas[0].descripcion).toBe("Día 12");
    expect(jugadoresDelReporte(filas)).toEqual(["jugador:1", "jugador:2"]);
  });

  test("Promedio y Suma de Totales; el Promedio de Por minuto, la suma de cada medida ÷ los minutos de las filas que la tienen", () => {
    const filas = FILAS();
    // Al día 12 le falta D: no suma ni sus minutos.
    filas.find((una) => una.jugador_id === 1 && una.fecha === dia(12)).datos.d = null;
    const { jugador } = reporteIndividual(filas, { jugador: "jugador:1" });
    const conD = [11, 10, 9, 8, 7, 6, 5, 4, 3].map((n) => 1000 * n - 200);
    expect(jugador.totales.promedio.d).toBeCloseTo(conD.reduce((a, b) => a + b, 0) / 9, 9);
    expect(jugador.totales.suma.d).toBe(conD.reduce((a, b) => a + b, 0));
    expect(jugador.totales.suma.ua).toBe(3600);
    expect(jugador.totales.promedio.pse).toBe(6);
    expect(jugador.porMinuto.promedio.d_min).toBeCloseTo(conD.reduce((a, b) => a + b, 0) / (9 * 60), 9);
    expect(jugador.porMinuto.promedio.tiempo).toBe(3600);
  });

  test("los minutos, en segundos enteros; con más de 24 h juntas, también bien (el archivo contaba los días × 24)", () => {
    expect(minutosDe(5400)).toBe(90);
    expect(minutosDe(5400.4)).toBe(90);
    expect(minutosDe(90061)).toBe(1440 + 60 + 1 + 1 / 60);
    expect(minutosDe(null)).toBeNull();
  });

  test("el Promedio de Por minuto, con más de 24 h juntas: la suma ÷ todos los minutos", () => {
    // 10 sesiones de 3 h (30 h juntas) y 9000 m cada una: 50 m por minuto.
    const filas = Array.from({ length: 10 }, (_, i) => fila({ jugador_id: 1, fecha: dia(i + 1), microciclo: 17, tiempo: 10800, d: 9000, d_min: 50 }));
    const { jugador } = reporteIndividual(filas, { jugador: "jugador:1" });
    expect(jugador.porMinuto.promedio.d_min).toBeCloseTo(50, 9);
  });

  test("la regla de los colores: + 2 desvíos verde oscuro, + 1 verde, el promedio amarillo, − 1 naranja, más abajo rojo", () => {
    expect([120, 110, 100, 95, 89].map((valor) => colorDelReporte(valor, 100, 5))).toEqual([COLORES_INFORME.excelente, COLORES_INFORME.excelente, COLORES_INFORME.bueno, COLORES_INFORME.naranja, COLORES_INFORME.malo]);
    expect(colorDelReporte(106, 100, 5)).toBe(COLORES_INFORME.muyBueno);
    // Con el techo del amarillo más corto que el desvío (Por minuto), entre los dos no se pinta.
    expect(colorDelReporte(103, 100, 5, 2)).toBeNull();
    expect(colorDelReporte(101, 100, 5, 2)).toBe(COLORES_INFORME.bueno);
    expect(colorDelReporte(null, 100, 5)).toBeNull();
    expect(colorDelReporte(100, 100, null)).toBeNull();
  });

  test("Por equipo: cada valor contra el promedio y el desvío de su tabla", () => {
    const { equipo } = reporteIndividual(FILAS(), { jugador: "jugador:1" });
    // D de los 10: 3000 a 12000; promedio 7500 y desvío de la muestra.
    expect(equipo.totales.promedio.d).toBe(7500);
    const desv = equipo.totales.desvio.d;
    expect(desv).toBeCloseTo(Math.sqrt([3, 4, 5, 6, 7, 8, 9, 10, 11, 12].reduce((total, n) => total + (1000 * n - 7500) ** 2, 0) / 9), 9);
    const deD = (n) => equipo.filas.find((una) => una.valores.d === 1000 * n).colores.totales.d;
    expect(deD(12)).toBe(COLORES_INFORME.muyBueno);
    expect(deD(8)).toBe(COLORES_INFORME.bueno);
    expect(deD(7)).toBe(COLORES_INFORME.naranja);
    expect(deD(3)).toBe(COLORES_INFORME.malo);
  });

  test("Por jugador: cada valor contra el equipo ese día (el Team Average de la sesión ± el desvío de los jugadores)", () => {
    const { jugador } = reporteIndividual(FILAS(), { jugador: "jugador:1" });
    // Día 12: equipo 12000, jugadores 11800 y 12200 (desvío 282,8): 11800 cae entre − 1 desvío y el promedio.
    expect(jugador.filas[0].colores.totales.d).toBe(COLORES_INFORME.naranja);
    expect(jugador.filas[0].colores.porMinuto.d_min).toBe(COLORES_INFORME.naranja);
    // El tiempo, igual al del equipo y con desvío 0 entre los jugadores: con la regla del archivo, verde oscuro.
    expect(jugador.filas[0].colores.totales.tiempo).toBe(COLORES_INFORME.excelente);
    // Un día sin sesión del equipo: sin color.
    const sinEquipo = reporteIndividual(FILAS().filter((una) => !(una.promedio && una.fecha === dia(12))), { jugador: "jugador:1" });
    expect(sinEquipo.jugador.filas[0].colores.totales.d).toBeNull();
  });

  test("los filtros (Tipo de Sesión, Fecha y Microciclo) valen para las dos tablas", () => {
    const filas = FILAS();
    filas.filter((una) => una.fecha === dia(5)).forEach((una) => (una.datos.tipo_sesion = "din_compleja"));
    const reporte = reporteIndividual(filas, { jugador: "jugador:1", filtros: { tipo_sesion: ["din_compleja"] } });
    expect(reporte.jugador.filas.map((una) => una.fecha)).toEqual([dia(5)]);
    expect(reporte.equipo.filas.map((una) => una.fecha)).toEqual([dia(5)]);
  });
});
