import { describe, expect, test } from "vitest";
import {
  COLORES_INFORME,
  cargasCronicas,
  colorDeCargaCronica,
  colorDeUa,
  cuentasDeGrupo,
  entraEnElInforme,
  filasPorMicrociclo,
  franjasDe,
  franjasDelVr,
  franjasDeTabla,
  indicesDe,
  informePorMicrociclo,
  opcionesDeFiltro,
  ordenarFilas,
  pasaLosFiltros,
  porcentajesDeFila,
  referenciaDeFila,
  valorDeVariable,
} from "./porMicrociclo.js";

// Filas inventadas: el promedio del equipo de cada sesión y jugadores.
let siguiente = 0;
const fila = ({ promedio = null, jugador_id = null, persona = null, fecha = "2026-05-04", ...datos }) => ({
  id: `f${(siguiente += 1)}`,
  fecha,
  promedio,
  jugador_id,
  persona,
  datos: { condicion: "total", dispositivo: "catapult", ...datos },
});
const sesion = (microciclo, fecha, datos = {}) => fila({ promedio: "sesion", microciclo, fecha, clasificacion_dias: "mas1_m", tipo_sesion: "din_colectiva", ...datos });
const nombreDe = (una) => (una.promedio === "sesion" ? "Team Average Sesion" : una.promedio === "parcial" ? "Team Average Parcial" : `Jugador ${una.jugador_id ?? una.persona}`);

describe("qué entra y los filtros (como la tabla dinámica del Excel)", () => {
  test("Condición Total y Va vacío, No o Si", () => {
    expect(entraEnElInforme(fila({ microciclo: 1 }))).toBe(true);
    expect(entraEnElInforme(fila({ microciclo: 1, va: "si" }))).toBe(true);
    expect(entraEnElInforme(fila({ microciclo: 1, va: "no" }))).toBe(true);
    expect(entraEnElInforme(fila({ microciclo: 1, va: "readaptacion" }))).toBe(false);
    expect(entraEnElInforme(fila({ microciclo: 1, condicion: "parcial" }))).toBe(false);
  });
  test("sin nada elegido, todos; con varios, cualquiera de ellos", () => {
    const una = sesion(17, "2026-05-04");
    const jugador = fila({ jugador_id: 7, microciclo: 18 });
    expect(pasaLosFiltros(una, {})).toBe(true);
    expect(pasaLosFiltros(una, { microciclo: [17, 18] })).toBe(true);
    expect(pasaLosFiltros(una, { microciclo: [18] })).toBe(false);
    expect(pasaLosFiltros(una, { microciclo_jugador: ["sesion"] })).toBe(true);
    expect(pasaLosFiltros(jugador, { microciclo_jugador: ["sesion"] })).toBe(false);
    expect(pasaLosFiltros(jugador, { nombre: ["jugador:7"] })).toBe(true);
    expect(pasaLosFiltros(una, { nombre: ["promedio:sesion"], fecha: ["2026-05-04"] })).toBe(true);
  });
  test("las opciones de un filtro: solo las que tienen datos, en orden", () => {
    const filas = [sesion(18, "2026-05-11"), sesion(17, "2026-05-04"), sesion(9, "2026-04-27"), fila({ microciclo: 30, condicion: "parcial" })];
    expect(opcionesDeFiltro(filas, "microciclo")).toEqual([9, 17, 18]);
    expect(opcionesDeFiltro(filas, "microciclo_jugador")).toEqual(["sesion"]);
  });
});

describe("las cuentas de cada fila", () => {
  test("suma y promedio sin los vacíos; los minutos, al segundo; el por minuto, promedio ÷ minutos", () => {
    const cuentas = cuentasDeGrupo([
      sesion(17, "a", { d: 1000, tiempo: 600.4, ua: 300 }),
      sesion(17, "b", { d: 3000, tiempo: 1200.4, ua: 500 }),
      sesion(17, "c", { tiempo: 900.2 }),
    ]);
    expect(cuentas.sumas.d).toBe(4000);
    expect(cuentas.promedios.d).toBe(2000);
    expect(cuentas.sumas.ua).toBe(800);
    // (600,4 + 1200,4 + 900,2) / 3 = 900,333… s → 900 s → 15 min.
    expect(cuentas.minutos).toBe(15);
    expect(cuentas.promedios.d_min).toBeCloseTo(2000 / 15, 12);
    // Sin la medida, vacío; sin minutos, 0 (como el Excel).
    expect(cuentas.promedios.d_shi_min).toBeNull();
    expect(cuentasDeGrupo([sesion(17, "a", { d: 10 })]).promedios.d_min).toBe(0);
  });

  test("una fila por microciclo del promedio del equipo; los días salen también de las filas parciales; los descansos cuentan como sesión", () => {
    const filas = [
      sesion(17, "2026-05-04", { d: 100 }),
      sesion(17, "2026-05-05", { d: 200, tipo_sesion: "descanso" }),
      sesion(17, "2026-05-06", { d: 300, condicion: "parcial" }),
      sesion(18, "2026-05-11", { d: 400 }),
      fila({ jugador_id: 7, microciclo: 17, d: 50 }),
      fila({ jugador_id: 7, microciclo: 18, d: 70 }),
    ];
    const lista = ordenarFilas(filasPorMicrociclo(filas, { microciclo_jugador: ["sesion"] }), nombreDe);
    expect(lista.map((una) => [una.promedio, una.microciclo, una.sumas.d, una.sesiones, una.descansos])).toEqual([
      ["sesion", 17, 300, 3, 1],
      ["sesion", 18, 400, 1, 0],
    ]);
    // Los jugadores: una fila cada uno con todo lo elegido (como el Excel).
    const jugadores = filasPorMicrociclo(filas, { microciclo_jugador: ["jugador"] });
    expect(jugadores.map((una) => [una.jugador_id, una.sumas.d, una.microciclos])).toEqual([[7, 120, [17, 18]]]);
  });

  test("el orden: por el nombre que se ve, con el microciclo como número", () => {
    const lista = ordenarFilas(filasPorMicrociclo([sesion(10, "x"), sesion(9, "y"), fila({ jugador_id: 2, microciclo: 9 })], {}), nombreDe);
    expect(lista.map((una) => (una.promedio ? `${nombreDe(una)}${una.microciclo}` : nombreDe(una)))).toEqual(["Jugador 2", "Team Average Sesion9", "Team Average Sesion10"]);
  });
});

describe("los %, los índices y las variables", () => {
  const vr = { dispositivo: "catapult", promedio: { d: 1000, d_shi: 100, d_acchi: 10, d_dechi: 10, d_mphi: 100, d_s6: 10, d_a8: 10, d_a1: 10, d_mp5: 10, d_min: 10, tiempo: 3600 } };
  const una = cuentasDeGrupo([sesion(17, "a", { d: 800, d_shi: 90, d_acchi: 11, d_dechi: 9, d_mphi: 100, d_s6: 5, d_a8: 5, d_a1: 5, d_mp5: 5, tiempo: 4800 })]);
  test("cada medida ÷ su V.R.; sin V.R., vacío", () => {
    const porcentajes = porcentajesDeFila(una, vr);
    expect(porcentajes.promedios.d).toBe(0.8);
    expect(porcentajes.sumas.tiempo).toBeCloseTo(4800 / 3600, 12);
    expect(porcentajes.promedios.d_min).toBeCloseTo(800 / 80 / 10, 12);
    expect(porcentajes.promedios.d_shi_min).toBeNull();
    expect(porcentajesDeFila(una, null).promedios.d).toBeNull();
  });
  test("Promedio % Vol. = (Total + 4 Alta + 4 Máxima) ÷ 9; con uno de los cuatro vacío, vacío", () => {
    const indices = indicesDe(porcentajesDeFila(una, vr).promedios);
    expect(indices.total).toBe(0.8);
    expect(indices.alta).toBeCloseTo((0.9 + 1.1 + 0.9 + 1) / 4, 12);
    expect(indices.maxima).toBeCloseTo(0.5, 12);
    expect(indices.volumen).toBeCloseTo((0.8 + 4 * indices.alta + 4 * 0.5) / 9, 12);
    expect(indices.relativo).toBeNull();
    expect(indicesDe({ d: 1, d_shi: 1, d_acchi: 1, d_dechi: null, d_mphi: 1, d_s6: 1, d_a8: 1, d_a1: 1, d_mp5: 1 }).volumen).toBeNull();
  });
  test("las variables según «Tipo variable» y «Visualización»; Relativas no tiene suma", () => {
    const porcentajes = porcentajesDeFila(una, vr);
    expect(valorDeVariable(una, porcentajes, "d", "absolutas", "suma")).toBe(800);
    expect(valorDeVariable(una, porcentajes, "d", "absolutas", "porcentajePromedio")).toBe(0.8);
    expect(valorDeVariable(una, porcentajes, "d_min", "relativas", "promedio")).toBe(10);
    expect(valorDeVariable(una, porcentajes, "d_min", "relativas", "suma")).toBeNull();
    expect(valorDeVariable(una, porcentajes, "tiempo", "relativas", "promedio")).toBe(4800);
  });
});

describe("la carga crónica (como se ven las filas)", () => {
  test("la U.A. ÷ el promedio de esa fila y las 3 de arriba; las 3 primeras, vacías; el promedio salta las vacías", () => {
    const filas = [100, 200, 300, 400, null, 600].map((ua, i) => ({ promedio: "sesion", sumas: { ua }, promedios: { ua: ua === null ? null : ua / 2 } }));
    const cronicas = cargasCronicas(filas);
    expect(cronicas.slice(0, 3)).toEqual([
      { suma: null, promedio: null },
      { suma: null, promedio: null },
      { suma: null, promedio: null },
    ]);
    expect(cronicas[3].suma).toBeCloseTo(400 / 250, 12);
    expect(cronicas[4].suma).toBeNull();
    expect(cronicas[5].suma).toBeCloseTo(600 / ((300 + 400 + 600) / 3), 12);
  });
  test("solo si las 4 son del promedio del equipo", () => {
    const filas = [{ promedio: "sesion" }, { promedio: null }, { promedio: "sesion" }, { promedio: "sesion" }].map((una) => ({ ...una, sumas: { ua: 100 }, promedios: { ua: 50 } }));
    expect(cargasCronicas(filas)[3]).toEqual({ suma: null, promedio: null });
  });
});

describe("las franjas", () => {
  test("promedio ± 1 y 2 desvíos; al revés en la U.A.", () => {
    expect(franjasDe(10, 2)).toEqual({ excelente: 14, muyBueno: 12, bueno: 10, regular: 8, malo: 6, desvio: 2 });
    expect(franjasDe(10, 2, { alReves: true })).toEqual({ excelente: 6, muyBueno: 8, bueno: 10, regular: 12, malo: 14, desvio: 2 });
    expect(franjasDe(10, null)).toBeNull();
  });
  test("de un V.R.: sus cinco categorías si las tiene (los de jugador), si no, Bueno ± desvío", () => {
    const deJugador = { promedio: { d: 100 }, desvio: {}, categorias: { excelente: { d: 130 }, muy_bueno: { d: 110 }, regular: { d: 90 }, malo: { d: 80 } } };
    expect(franjasDelVr(deJugador, "d")).toEqual({ excelente: 130, muyBueno: 110, bueno: 100, regular: 90, malo: 80, desvio: null });
    expect(franjasDelVr({ promedio: { d: 100 }, desvio: { d: 5 } }, "d")).toEqual({ excelente: 110, muyBueno: 105, bueno: 100, regular: 95, malo: 90, desvio: 5 });
    expect(franjasDelVr({ promedio: {}, desvio: {} }, "d")).toBeNull();
  });
  test("Mi selección: cada fila una vez en el desvío; en un por minuto, promedio de la medida ÷ promedio de los minutos", () => {
    const filas = [
      { sumas: { d: 100 }, promedios: { d: 10, d_min: 1, tiempo: 600 }, minutos: 10 },
      { sumas: { d: 300 }, promedios: { d: 30, d_min: 1.5, tiempo: 1200 }, minutos: 20 },
    ];
    const vr = { promedio: { d: 20, d_min: 2 } };
    const comoExcel = franjasDeTabla(filas, vr, { categorizacion: "miSeleccion", tipoVariable: "absolutas", visualizacion: "promedio" });
    // Desvío de [10, 30] (el Excel contaba cada fila dos veces: [10, 30, 10, 30]).
    expect(comoExcel.variables.d.desvio).toBeCloseTo(Math.sqrt(200), 12);
    expect(comoExcel.variables.d.bueno).toBe(20);
    // Drel: (10 + 30)/2 ÷ (10 + 20)/2 = 20 / 15; en % del V.R. (2).
    const relativas = franjasDeTabla(filas, vr, { categorizacion: "miSeleccion", tipoVariable: "relativas", visualizacion: "porcentajePromedio" });
    expect(relativas.variables.d_min.bueno).toBeCloseTo(20 / 15 / 2, 12);
    expect(comoExcel.indices.total.bueno).toBe(1);
    // Relativas no tiene suma.
    expect(franjasDeTabla(filas, vr, { categorizacion: "miSeleccion", tipoVariable: "relativas", visualizacion: "suma" }).variables.d_min).toBeNull();
  });
  test("Valor referencial: en %, el Bueno es 1", () => {
    const vr = { promedio: { d: 200 }, desvio: { d: 20 } };
    const franjas = franjasDeTabla([], vr, { categorizacion: "valorReferencial", tipoVariable: "absolutas", visualizacion: "porcentajePromedio" });
    expect(franjas.variables.d).toEqual({ excelente: 1.2, muyBueno: 1.1, bueno: 1, regular: 0.9, malo: 0.8, desvio: 0.1 });
    expect(franjasDeTabla([], vr, { categorizacion: "valorReferencial", tipoVariable: "absolutas", visualizacion: "promedio" }).variables.d.bueno).toBe(200);
  });
});

describe("el V.R. de cada fila y el informe entero", () => {
  const sport = { id: "s", dispositivo: "sport", promedio: { d: 100 } };
  const catapult = { id: "c", dispositivo: "catapult", promedio: { d: 200 } };
  const otroCatapult = { id: "c2", dispositivo: "catapult", promedio: { d: 400 } };
  test("el sumado para unos microciclos gana; si no, el de su dispositivo", () => {
    const asignaciones = [{ referencia: catapult, microciclos: null }, { referencia: sport, microciclos: null }, { referencia: otroCatapult, microciclos: [20] }];
    expect(referenciaDeFila(asignaciones, { microciclo: 17, dispositivo: "catapult" }).referencia).toBe(catapult);
    expect(referenciaDeFila(asignaciones, { microciclo: 12, dispositivo: "sport" }).referencia).toBe(sport);
    expect(referenciaDeFila(asignaciones, { microciclo: 20, dispositivo: "catapult" }).referencia).toBe(otroCatapult);
    expect(referenciaDeFila([], { microciclo: 20, dispositivo: "catapult" })).toBeNull();
  });
  test("cada fila con el V.R. de su dispositivo y una tabla de franjas por V.R.; la U.A. solo con Mi selección", () => {
    const filas = [sesion(12, "a", { d: 100, ua: 10, dispositivo: "sport" }), sesion(17, "b", { d: 200, ua: 30 }), sesion(18, "c", { d: 300, ua: 50 })];
    const informe = informePorMicrociclo(filas, {
      asignaciones: [{ referencia: catapult, microciclos: null }, { referencia: sport, microciclos: null }],
      nombreDe,
    });
    expect(informe.filas.map((una) => [una.etiqueta, una.asignacion, una.porcentajes.promedios.d])).toEqual([
      ["Team Average Sesion12", 1, 1],
      ["Team Average Sesion17", 0, 1],
      ["Team Average Sesion18", 0, 1.5],
    ]);
    // Con una sola fila no hay desvío (ni franjas).
    expect(informe.tablas[0].variables.d.bueno).toBe(250);
    expect(informe.tablas[0].variables.d.desvio).toBeCloseTo(Math.sqrt(5000), 12);
    expect(informe.tablas[1].variables.d).toBeNull();
    expect(informe.ua.suma.bueno).toBe(30);
    expect(informePorMicrociclo(filas, { categorizacion: "valorReferencial", asignaciones: [], nombreDe }).ua).toBeNull();
  });
});

describe("los colores del Excel en Por microciclo", () => {
  test("U.A.: lo bajo es Excelente", () => {
    const franjas = franjasDe(100, 10, { alReves: true });
    expect([70, 80, 85, 100, 105, 115].map((valor) => colorDeUa(valor, franjas))).toEqual([
      COLORES_INFORME.excelente,
      COLORES_INFORME.excelente,
      COLORES_INFORME.muyBueno,
      COLORES_INFORME.bueno,
      COLORES_INFORME.regularUa,
      COLORES_INFORME.malo,
    ]);
    expect(colorDeUa(100, null)).toBeNull();
  });
  test("carga crónica: rojo en los dos extremos", () => {
    const franjas = franjasDe(1, 0.25, { alReves: true });
    expect([0.4, 0.6, 0.9, 1.1, 1.4].map((valor) => colorDeCargaCronica(valor, franjas))).toEqual([
      COLORES_INFORME.malo,
      COLORES_INFORME.naranja,
      COLORES_INFORME.bueno,
      COLORES_INFORME.naranja,
      COLORES_INFORME.malo,
    ]);
  });
});

describe("VS RIVAL: los partidos oficiales de cada fila", () => {
  const oficial = (datos) => ({ tarea_partido: "partido_oficial_torneo", condicion: "parcial", ...datos });
  const delEquipo = (fecha, datos) => fila({ promedio: "parcial", fecha, ...oficial(datos) });
  test("el equipo: el TOTAL de cada partido oficial del microciclo, en orden de fecha, aunque se haya cargado en otro orden", () => {
    const filas = [
      sesion(17, "2026-03-09", { d: 1 }),
      delEquipo("2026-03-14", { microciclo: 17, descripcion: "2026_03_14_ Vs Rival Dos PT ", tiempo: 270 }),
      delEquipo("2026-03-11", { microciclo: 17, descripcion: "2026_03_11_ Vs Rival Uno PT ", tiempo: 270 }),
      delEquipo("2026-03-11", { microciclo: 17, descripcion: "2026_03_11_ Vs Rival Uno TOTAL ", tiempo: 540 }),
      delEquipo("2026-03-11", { microciclo: 17, descripcion: "2026_03_11_ Vs Rival Uno ST ", tiempo: 270 }),
      delEquipo("2026-03-14", { microciclo: 17, descripcion: "2026_03_14_ Vs Rival Dos Total", tiempo: 530 }),
      // Ni un amistoso ni los de otro microciclo.
      fila({ promedio: "parcial", fecha: "2026-03-12", microciclo: 17, tarea_partido: "partido_amistoso", condicion: "parcial", descripcion: "2026_03_12_ Vs Amigo TOTAL" }),
      delEquipo("2026-03-17", { microciclo: 18, descripcion: "2026_03_17_ Vs Otro TOTAL" }),
    ];
    expect(informePorMicrociclo(filas, { nombreDe }).filas.map((una) => una.vsRival)).toEqual(["Vs Rival Uno TOTAL - Vs Rival Dos Total"]);
    // Un partido sin la descripción del TOTAL no va (como en el Excel); sin partidos, vacío.
    const sinTotal = [
      sesion(20, "2026-05-11"),
      delEquipo("2026-05-13", { microciclo: 20, descripcion: "2026_05_13_ Vs Uno PT", tiempo: 300 }),
      delEquipo("2026-05-16", { microciclo: 20, descripcion: "2026_05_16_ Vs Dos TOTAL", tiempo: 600 }),
      sesion(21, "2026-05-18"),
    ];
    expect(informePorMicrociclo(sinTotal, { nombreDe }).filas.map((una) => una.vsRival)).toEqual(["Vs Dos TOTAL", ""]);
  });
  test("un jugador: su fila del partido con Condición Total; si su Total junta otra cosa, la del partido de más tiempo", () => {
    const filas = [
      // Jugador 1: entró en el segundo tiempo del 23 y no ingresó el 26.
      fila({ jugador_id: 1, fecha: "2026-03-11", ...oficial({ microciclo: 17, condicion: "total", descripcion: "2026_03_11_ Vs Rival Uno ST ", tiempo: 2000 }) }),
      fila({ jugador_id: 1, fecha: "2026-03-14", ...oficial({ microciclo: 17, condicion: "total", descripcion: "2026_03_14_ Vs Rival Dos SIN INGRESAR ", tiempo: 0 }) }),
      // Jugador 2: jugó el segundo tiempo del 23 y después entrenó aparte.
      fila({ jugador_id: 2, fecha: "2026-03-11", ...oficial({ microciclo: 17, descripcion: "2026_03_11_ Vs Rival Uno ST ", tiempo: 2000 }) }),
      fila({ jugador_id: 2, fecha: "2026-03-11", microciclo: 17, tarea_partido: "otra_tarea", condicion: "total", descripcion: "2026_03_11_ Vs Rival Uno TOTAL + Fracc.", tiempo: 3000 }),
    ];
    expect(informePorMicrociclo(filas, { nombreDe }).filas.map((una) => [una.etiqueta, una.vsRival])).toEqual([
      ["Jugador 1", "Vs Rival Uno ST - Vs Rival Dos SIN INGRESAR"],
      ["Jugador 2", "Vs Rival Uno ST"],
    ]);
  });
});
