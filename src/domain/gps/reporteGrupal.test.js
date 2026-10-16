import { describe, expect, test } from "vitest";
import { COLORES_INFORME, franjasDelObjetivo, sesionesDelObjetivo } from "./porMicrociclo.js";
import { CASILLAS, COLUMNAS_JUGADORES, reporteGrupal } from "./reporteGrupal.js";

// Filas inventadas: 4 días con el promedio del equipo de la sesión y tres
// jugadores, y un descanso (sin tiempo).
let siguiente = 0;
const fila = ({ promedio = null, jugador_id = null, fecha, ...datos }) => ({
  id: `g${(siguiente += 1)}`,
  orden: siguiente,
  fecha,
  promedio,
  jugador_id,
  persona: null,
  datos: { condicion: "total", dispositivo: "catapult", tipo_sesion: "din_colectiva", microciclo: 17, tiempo: 3600, ...datos },
});
const dia = (n) => `2026-05-${String(n).padStart(2, "0")}`;
const FILAS = () => [
  ...[1, 2, 3, 4].flatMap((n) => [
    fila({ promedio: "sesion", fecha: dia(n), d: 1000 * n, ua: 300 }),
    fila({ jugador_id: 1, fecha: dia(n), d: 1000 * n - 300, ua: 200, va: "si" }),
    fila({ jugador_id: 2, fecha: dia(n), d: 1000 * n, ua: 300, va: "si" }),
    fila({ jugador_id: 3, fecha: dia(n), d: 1000 * n + 300, ua: 400, va: "si" }),
  ]),
  fila({ promedio: "sesion", fecha: dia(5), tipo_sesion: "descanso", d: 0, tiempo: 0, ua: 0 }),
  fila({ jugador_id: 1, fecha: dia(5), tipo_sesion: "descanso", d: 0, tiempo: 0, ua: 0 }),
];

describe("Reporte grupal", () => {
  test("las 10 casillas: las 9 medidas del Reporte individual y la U.A.; en la tabla de jugadores, también el tiempo", () => {
    expect(CASILLAS).toEqual(["d", "d_shi", "d_acchi", "d_dechi", "d_mphi", "d_s6", "d_a8", "d_a1", "d_mp5", "ua"]);
    expect(COLUMNAS_JUGADORES).toEqual(["tiempo", ...CASILLAS]);
  });

  test("las sesiones del equipo con tiempo (el descanso no cuenta), el período y el dispositivo de la última", () => {
    const reporte = reporteGrupal(FILAS());
    expect(reporte.sesiones).toBe(4);
    expect([reporte.desde, reporte.hasta]).toEqual([dia(1), dia(4)]);
    expect(reporte.dispositivo).toBe("catapult");
  });

  test("cada casilla: el promedio del equipo por sesión y el total del período", () => {
    const { casillas } = reporteGrupal(FILAS());
    expect(casillas.d).toEqual({ promedio: 2500, total: 10000 });
    expect(casillas.ua).toEqual({ promedio: 300, total: 1200 });
    // Una medida que no se cargó: vacía.
    expect(casillas.d_shi).toEqual({ promedio: null, total: null });
  });

  test("los jugadores: sus sesiones con tiempo y su promedio por sesión", () => {
    const { jugadores } = reporteGrupal(FILAS());
    expect(jugadores.map((uno) => [uno.clave, uno.sesiones, uno.valores.d, uno.valores.ua])).toEqual([
      ["jugador:1", 4, 2200, 200],
      ["jugador:2", 4, 2500, 300],
      ["jugador:3", 4, 2800, 400],
    ]);
  });

  test("Mi selección: contra los jugadores que se ven (promedio ± desvío); la U.A., al revés (lo bajo es Excelente)", () => {
    const { jugadores, franjas } = reporteGrupal(FILAS(), { categorizacion: "miSeleccion" });
    // D: 2200, 2500 y 2800: promedio 2500 y desvío 300.
    expect(franjas.d).toMatchObject({ excelente: 3100, muyBueno: 2800, bueno: 2500, regular: 2200, malo: 1900, desvio: 300 });
    expect(jugadores.map((uno) => uno.colores.d)).toEqual([COLORES_INFORME.naranja, COLORES_INFORME.bueno, COLORES_INFORME.muyBueno]);
    // U.A.: 200, 300 y 400; el que menos carga, verde (la regla de la U.A. del Informe).
    expect(franjas.ua.excelente).toBeLessThan(franjas.ua.malo);
    expect(jugadores.map((uno) => uno.colores.ua)).toEqual([COLORES_INFORME.muyBueno, COLORES_INFORME.bueno, COLORES_INFORME.regularUa]);
  });

  test("Valor referencial: las franjas del V.R. elegido; la U.A. no se pinta", () => {
    const vr = { id: "c1", dispositivo: "catapult", promedio: { d: 2500, ua: 300 }, desvio: { d: 100, ua: 50 } };
    const { jugadores, franjas } = reporteGrupal(FILAS(), { categorizacion: "valorReferencial", vr });
    expect(franjas.d).toMatchObject({ excelente: 2700, muyBueno: 2600, bueno: 2500, regular: 2400, malo: 2300 });
    expect(jugadores.map((uno) => uno.colores.d)).toEqual([COLORES_INFORME.malo, COLORES_INFORME.bueno, COLORES_INFORME.excelente]);
    expect(franjas.ua).toBeNull();
    expect(jugadores.every((uno) => uno.colores.ua === null)).toBe(true);
    // Sin V.R., sin color.
    expect(reporteGrupal(FILAS(), { categorizacion: "valorReferencial", vr: null }).franjas.d).toBeNull();
  });

  test("Objetivo: el equipo en las sesiones del período con GPS (su Team Average y el desvío de sus jugadores)", () => {
    const filas = FILAS();
    const { franjas } = reporteGrupal(filas, { categorizacion: "objetivo" });
    const sesiones = sesionesDelObjetivo(filas, {}).filter((sesion) => sesion.fecha !== dia(5));
    expect(sesiones).toHaveLength(4);
    expect(franjas.d).toEqual(franjasDelObjetivo(sesiones, "d"));
    // Bueno: el promedio del Team Average (2500); el desvío, el de los jugadores de cada sesión (300).
    expect(franjas.d).toMatchObject({ bueno: 2500, desvio: 300 });
    expect(franjas.ua).toBeNull();
  });

  test("los filtros valen para todo: sesiones, casillas y jugadores", () => {
    const filas = FILAS();
    filas.filter((una) => una.fecha === dia(2)).forEach((una) => (una.datos.tipo_sesion = "din_compleja"));
    const reporte = reporteGrupal(filas, { filtros: { tipo_sesion: ["din_compleja"] } });
    expect(reporte.sesiones).toBe(1);
    expect(reporte.casillas.d.total).toBe(2000);
    expect(reporte.jugadores.map((uno) => uno.sesiones)).toEqual([1, 1, 1]);
  });
});
