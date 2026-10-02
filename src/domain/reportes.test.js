import { describe, expect, test } from "vitest";
import {
  cadaMilHoras,
  comparadoConEquipo,
  contarPor,
  diasLesionadoEnPeriodo,
  esLeve,
  esMuscular,
  horasEnPeriodo,
  incidencia,
  lesionesDelReporte,
  mesesEntre,
  periodoDe,
  porMes,
  resumenDeLesiones,
} from "./reportes.js";
import { exposicionDeEntrenamientos, exposicionDePartidos, partidoDeFila } from "./exposicion.js";

const hoy = "2026-10-02";
const lesion = (extra = {}) => ({
  id: extra.id || "a",
  jugador_id: 7,
  fecha_lesion: "2026-09-01",
  fecha_alta: "2026-09-21",
  fecha_transicion: null,
  fecha_retorno_entrenamiento: null,
  ...extra,
  datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "muscular_1a", ...(extra.datos || {}) },
});

describe("qué lesiones entran en un reporte", () => {
  test("leve es menos de 5 días (registro y leve); sin alta todavía no es leve", () => {
    expect(esLeve(lesion({ fecha_alta: "2026-09-03" }))).toBe(true);
    expect(esLeve(lesion({ fecha_alta: "2026-09-01" }))).toBe(true);
    expect(esLeve(lesion({ fecha_alta: "2026-09-10" }))).toBe(false);
    expect(esLeve(lesion({ fecha_alta: null }))).toBe(false);
  });

  test("musculares: las de lesión muscular del catálogo y las del club con ese nombre", () => {
    expect(esMuscular(lesion())).toBe(true);
    expect(esMuscular(lesion({ datos: { tipo_lesion: "entorse" } }), () => "Esguince")).toBe(false);
    expect(esMuscular(lesion({ datos: { tipo_lesion: "x_club" } }), () => "Lesión muscular grado 4")).toBe(true);
    expect(esMuscular(lesion({ datos: { tipo_lesion: "x_club" } }), () => "LESÃO MUSCULAR GRAU 4")).toBe(true);
    expect(esMuscular(lesion({ datos: { tipo_lesion: "sobrecarga_caibra" } }), () => "Sobrecarga muscular / calambre")).toBe(false);
  });

  test("por período, jugador, sin leves y solo musculares", () => {
    const lesiones = [
      lesion({ id: "a" }),
      lesion({ id: "b", fecha_lesion: "2026-01-10", fecha_alta: "2026-01-12" }),
      lesion({ id: "c", jugador_id: 8, datos: { tipo_lesion: "entorse" } }),
      lesion({ id: "d", fecha_lesion: "2026-09-25", fecha_alta: "2026-09-26" }),
    ];
    const ids = (lista) => lista.map((una) => una.id);
    expect(ids(lesionesDelReporte(lesiones, { desde: "2026-09-01", hasta: "2026-09-30" }))).toEqual(["a", "c", "d"]);
    expect(ids(lesionesDelReporte(lesiones, { jugadorId: 7 }))).toEqual(["a", "b", "d"]);
    expect(ids(lesionesDelReporte(lesiones, { sinLeves: true }))).toEqual(["a", "c"]);
    expect(ids(lesionesDelReporte(lesiones, { soloMusculares: true, texto: () => "" }))).toEqual(["a", "b", "d"]);
  });
});

describe("las cuentas", () => {
  test("los días lesionado dentro del período, sin contar dos veces los que se superponen", () => {
    const lesiones = [lesion({ fecha_lesion: "2026-08-25", fecha_alta: "2026-09-05" }), lesion({ fecha_lesion: "2026-09-03", fecha_alta: "2026-09-08" })];
    // Del 01/09 al 07/09 (el 08 ya está de alta): 7 días.
    expect(diasLesionadoEnPeriodo(lesiones, "2026-09-01", "2026-09-30", hoy)).toBe(7);
    // Sin alta: hasta hoy.
    expect(diasLesionadoEnPeriodo([lesion({ fecha_lesion: "2026-09-28", fecha_alta: null })], "2026-09-01", "2026-10-31", hoy)).toBe(4);
  });

  test("cada 1000 horas y contra el equipo", () => {
    expect(cadaMilHoras(1, 80)).toBe(12.5);
    expect(cadaMilHoras(1, 0)).toBe(null);
    expect(comparadoConEquipo(12, 8)).toBe(50);
    expect(comparadoConEquipo(4, 8)).toBe(-50);
    expect(comparadoConEquipo(null, 8)).toBe(null);
    expect(comparadoConEquipo(4, 0)).toBe(null);
    const tabla = incidencia({ delJugador: [lesion()], delEquipo: [lesion(), lesion({ id: "b" })], horasJugador: 100, horasEquipo: 1000, hoy });
    expect(tabla.lesiones).toEqual({ jugador: 10, equipo: 2, diferencia: 400 });
    expect(tabla.dias.jugador).toBe(200);
    expect(tabla.dias.equipo).toBe(40);
  });

  test("las horas del período, de partidos y entrenamientos", () => {
    const tramos = [
      { jugadorId: "7", fecha: "2026-09-01", segundos: 3600, tipo: "entrenamiento" },
      { jugadorId: "7", fecha: "2026-09-02", segundos: 5400, tipo: "partido" },
      { jugadorId: "8", fecha: "2026-09-02", segundos: 1800, tipo: "partido" },
      { jugadorId: "7", fecha: "2026-10-05", segundos: 3600, tipo: "entrenamiento" },
    ];
    expect(horasEnPeriodo(tramos, { desde: "2026-09-01", hasta: "2026-09-30", jugadorId: 7 })).toEqual({ partido: 1.5, entrenamiento: 1, total: 2.5 });
    expect(horasEnPeriodo(tramos, { desde: "2026-09-01", hasta: "2026-09-30" }).total).toBe(3);
  });

  test("conteos, meses y resumen", () => {
    const lesiones = [lesion({ id: "a" }), lesion({ id: "b", datos: { parte_cuerpo: "joelho" } }), lesion({ id: "c", fecha_lesion: "2026-07-03", fecha_alta: null })];
    expect(contarPor(lesiones, (una) => una.datos.parte_cuerpo, hoy).map((fila) => [fila.valor, fila.cantidad])).toEqual([
      ["coxa", 2],
      ["joelho", 1],
    ]);
    expect(mesesEntre("2025-11-15", "2026-02-01")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    const meses = porMes(lesiones, "2026-07-01", "2026-09-30");
    expect(meses.map((mes) => mes.total)).toEqual([1, 0, 2]);
    expect(meses[0].porSeveridad).toEqual({ abierta: 1 });
    expect(meses[2].porSeveridad).toEqual({ moderado: 2 });
    const resumen = resumenDeLesiones(lesiones, { hoy });
    expect(resumen).toMatchObject({ cantidad: 3, activas: 1, jugadores: 1, promedioDias: 20 });
    expect(resumen.dias).toBe(20 + 20 + 91);
  });

  test("los períodos: este año, los últimos 12 meses y todo", () => {
    expect(periodoDe("anio", hoy)).toEqual({ desde: "2026-01-01", hasta: hoy });
    expect(periodoDe("doce", hoy)).toEqual({ desde: "2025-10-03", hasta: hoy });
    expect(periodoDe("todo", hoy, [lesion({ fecha_lesion: "2024-03-01" })])).toEqual({ desde: "2024-03-01", hasta: hoy });
  });
});

describe("las horas de cada jugador", () => {
  const plantel = [
    { id: 1, nombre: "ALONSO" },
    { id: 2, nombre: "HULK" },
    { id: 3, nombre: "SCARPA" },
    { id: 4, nombre: "LEMOS" },
  ];
  const fila = {
    fecha: "2026-09-02",
    inicio_pt: "16:00:00",
    final_pt: "16:45:00",
    inicio_st: "17:00:00",
    final_st: "17:45:00",
    inicio_var_st_1: "17:10:00",
    final_var_st_1: "17:12:00",
    titulares: ["ALONSO", "HULK"],
    convocados: ["SCARPA", "LEMOS"],
    cambio_1_sale: "HULK",
    cambio_1_entra: "SCARPA",
    cambio_1_tiempo: "17:15:00",
  };

  test("en un partido: el titular entero, el que salió y el que entró, sin el VAR; el que no entró, nada", () => {
    expect(partidoDeFila(fila).cambios[0]).toEqual({ sale: "HULK", entra: "SCARPA", hora: "17:15:00" });
    const tramos = exposicionDePartidos([fila], plantel);
    const minutos = Object.fromEntries(tramos.map((tramo) => [tramo.jugadorId, tramo.segundos / 60]));
    expect(minutos).toEqual({ 1: 88, 2: 58, 3: 30 });
    expect(tramos.every((tramo) => tramo.tipo === "partido" && tramo.fecha === "2026-09-02")).toBe(true);
  });

  test("en un entrenamiento: la tarea entera o su tramo, sin las pausas", () => {
    const entrenamiento = {
      fecha: "2026-09-03",
      datos: {
        tareas: [
          {
            fecha: "2026-09-03",
            inicio: "10:00:00",
            fin: "10:30:00",
            pausas: [{ inicio: "10:10:00", fin: "10:15:00" }],
            participantes: { 1: { modo: "total" }, 2: { modo: "parcial", inicio: "10:12:00", fin: "10:30:00" } },
          },
          { fecha: "2026-09-03", inicio: "11:00:00", fin: "", pausas: [], participantes: { 1: { modo: "total" } } },
        ],
      },
    };
    const tramos = exposicionDeEntrenamientos([entrenamiento]);
    expect(tramos.map((tramo) => [tramo.jugadorId, tramo.segundos / 60])).toEqual([
      ["1", 25],
      ["2", 15],
    ]);
  });
});
