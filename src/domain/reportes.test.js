import { describe, expect, test } from "vitest";
import {
  VARIANTES,
  contadorDelPeriodo,
  contarPor,
  contraVR,
  cuadroCadaMil,
  cumpleVariante,
  diasEnPeriodo,
  entraEnElCuadro,
  esLeve,
  esMuscular,
  lesionesDelReporte,
  mesesEntre,
  minutosGps,
  ordenarPeriodos,
  periodoDe,
  porMes,
  resumenDeLesiones,
} from "./reportes.js";

const hoy = "2026-10-02";
// Una lesión que entra en el cuadro del Excel: no traumática, en un
// entrenamiento, del profesional.
const DEL_CUADRO = { producto: "nao_traumatica", cuando: "treinamento", localizacion: "profissional" };
const lesion = (extra = {}) => ({
  id: extra.id || "a",
  jugador_id: 7,
  fecha_lesion: "2026-09-01",
  fecha_alta: "2026-09-21",
  fecha_transicion: null,
  fecha_retorno_entrenamiento: null,
  ...extra,
  datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "muscular_1a", ...DEL_CUADRO, ...(extra.datos || {}) },
});

describe("las reglas del Excel", () => {
  test("leve es solo la severidad leve (1 a 4 días): las de registro y las abiertas no son leves", () => {
    expect(esLeve(lesion({ fecha_alta: "2026-09-03" }))).toBe(true);
    expect(esLeve(lesion({ fecha_alta: "2026-09-01" }))).toBe(false);
    expect(esLeve(lesion({ fecha_alta: "2026-09-10" }))).toBe(false);
    expect(esLeve(lesion({ fecha_alta: null }))).toBe(false);
  });

  test("LM son los grados 1A a 3C y la sobrecarga muscular / calambre", () => {
    expect(esMuscular(lesion())).toBe(true);
    expect(esMuscular(lesion({ datos: { tipo_lesion: "muscular_3c" } }))).toBe(true);
    expect(esMuscular(lesion({ datos: { tipo_lesion: "sobrecarga_caibra" } }))).toBe(true);
    expect(esMuscular(lesion({ datos: { tipo_lesion: "entorse" } }))).toBe(false);
    expect(esMuscular(lesion({ datos: { tipo_lesion: "x_del_club" } }))).toBe(false);
  });

  test("entran las no traumáticas de partidos oficiales, amistosos y entrenamientos del profesional", () => {
    expect(entraEnElCuadro(lesion())).toBe(true);
    expect(entraEnElCuadro(lesion({ datos: { cuando: "partida_oficial" } }))).toBe(true);
    expect(entraEnElCuadro(lesion({ datos: { cuando: "partida_amistoso" } }))).toBe(true);
    expect(entraEnElCuadro(lesion({ datos: { producto: "traumatica" } }))).toBe(false);
    expect(entraEnElCuadro(lesion({ datos: { cuando: "fora" } }))).toBe(false);
    expect(entraEnElCuadro(lesion({ datos: { localizacion: "cat_base" } }))).toBe(false);
    expect(entraEnElCuadro(lesion({ datos: { producto: "" } }))).toBe(false);
  });

  test("las cuatro columnas: todas, sin leves, solo LM y LM sin leves", () => {
    expect(VARIANTES.map((variante) => variante.id)).toEqual(["todas", "sinLeves", "musculares", "muscularesSinLeves"]);
    const leveMuscular = lesion({ fecha_alta: "2026-09-03" });
    const esguince = lesion({ datos: { tipo_lesion: "entorse" } });
    expect(VARIANTES.map((variante) => cumpleVariante(leveMuscular, variante))).toEqual([true, false, true, false]);
    expect(VARIANTES.map((variante) => cumpleVariante(esguince, variante))).toEqual([true, true, false, false]);
    expect(VARIANTES.map((variante) => cumpleVariante(lesion({ datos: { producto: "traumatica" } }), variante))).toEqual([false, false, false, false]);
  });
});

describe("las cuentas", () => {
  test("los días dentro de un período, como la columna CQ de Antecedentes BD", () => {
    // Con alta, adentro del período: del inicio al alta.
    expect(diasEnPeriodo(lesion(), "2026-01-01", "2026-12-31")).toBe(20);
    // Empezada antes del período: desde el comienzo del período.
    expect(diasEnPeriodo(lesion({ fecha_lesion: "2026-08-25", fecha_alta: "2026-09-05" }), "2026-09-01", "2026-09-30")).toBe(4);
    // Con alta después del período: hasta el final del período.
    expect(diasEnPeriodo(lesion({ fecha_lesion: "2026-09-25", fecha_alta: "2026-10-10" }), "2026-09-01", "2026-09-30")).toBe(5);
    // Con alta antes del período, o empezada después: nada.
    expect(diasEnPeriodo(lesion({ fecha_lesion: "2026-07-01", fecha_alta: "2026-07-20" }), "2026-09-01", "2026-09-30")).toBe(null);
    expect(diasEnPeriodo(lesion({ fecha_lesion: "2026-10-05" }), "2026-09-01", "2026-09-30")).toBe(null);
    // Sin alta: desde su inicio, aunque sea de antes del período, hasta el final.
    expect(diasEnPeriodo(lesion({ fecha_lesion: "2026-08-20", fecha_alta: null }), "2026-09-01", "2026-09-30")).toBe(41);
    // Sin "desde": desde siempre (la base completa).
    expect(diasEnPeriodo(lesion({ fecha_alta: null }), "", hoy)).toBe(31);
    // Sin días (alta el mismo día): nada.
    expect(diasEnPeriodo(lesion({ fecha_alta: "2026-09-01" }), "", hoy)).toBe(null);
  });

  test("los minutos del GPS, de un jugador o de todos, entre fechas", () => {
    const gps = [
      { jugadorId: "7", fecha: "2026-09-01", minutos: 90 },
      { jugadorId: 7, fecha: "2026-09-02", minutos: "30" },
      { jugadorId: "8", fecha: "2026-09-02", minutos: 60 },
      { jugadorId: "7", fecha: "2026-10-05", minutos: 45 },
      { jugadorId: "7", fecha: "2026-10-06", minutos: "x" },
    ];
    expect(minutosGps(gps, { jugadorId: 7 })).toBe(165);
    expect(minutosGps(gps, { hasta: "2026-09-30" })).toBe(180);
    expect(minutosGps(gps, { desde: "2026-09-02", hasta: "2026-09-30" })).toBe(90);
    expect(minutosGps(null)).toBe(0);
  });

  test("el cuadro cada 1000 horas: cuántas, cuántos días y cada 1000 horas, por columna", () => {
    const lesiones = [
      lesion({ id: "leve", fecha_lesion: "2026-09-01", fecha_alta: "2026-09-04" }),
      lesion({ id: "esguince", fecha_lesion: "2026-08-01", fecha_alta: "2026-08-21", datos: { tipo_lesion: "entorse" } }),
      lesion({ id: "traumatica", datos: { producto: "traumatica" } }),
      lesion({ id: "abierta", fecha_lesion: "2026-09-22", fecha_alta: null, datos: { tipo_lesion: "sobrecarga_caibra" } }),
    ];
    // 6000 minutos = 100 horas.
    const cuadro = cuadroCadaMil(lesiones, 6000, { hasta: hoy });
    expect(cuadro.map((fila) => fila.cantidad)).toEqual([3, 2, 2, 1]);
    expect(cuadro.map((fila) => fila.dias)).toEqual([3 + 20 + 10, 20 + 10, 3 + 10, 10]);
    expect(cuadro.map((fila) => fila.lesionesCadaMil)).toEqual([30, 20, 20, 10]);
    expect(cuadro.map((fila) => fila.diasCadaMil)).toEqual([330, 300, 130, 100]);
    // Sin minutos, no hay cuentas (en el Excel, la celda vacía).
    expect(cuadroCadaMil(lesiones, 0, { hasta: hoy }).map((fila) => fila.lesionesCadaMil)).toEqual([null, null, null, null]);
    // En un período cuentan las empezadas adentro; los días, los que caen adentro.
    const septiembre = cuadroCadaMil(lesiones, 6000, { desde: "2026-09-01", hasta: "2026-09-30" });
    expect(septiembre[0].cantidad).toBe(2);
    expect(septiembre[0].dias).toBe(3 + 8);
  });

  test("jugador vs VR como en el Excel: el signo y la diferencia sobre el valor del jugador", () => {
    expect(contraVR(8, 6)).toEqual({ signo: "+", porcentaje: 25 });
    expect(contraVR(4, 6)).toEqual({ signo: "-", porcentaje: 50 });
    expect(contraVR(6, 6)).toEqual({ signo: "+", porcentaje: 0 });
    // El jugador en cero: el Excel muestra "0 %".
    expect(contraVR(0, 6)).toEqual({ signo: "", porcentaje: 0 });
    expect(contraVR(null, 6)).toBe(null);
    expect(contraVR(8, null)).toBe(null);
  });
});

describe("el reporte grupal", () => {
  test("por período y con los filtros del Excel", () => {
    const lesiones = [
      lesion({ id: "a" }),
      lesion({ id: "b", fecha_lesion: "2026-01-10", fecha_alta: "2026-01-12" }),
      lesion({ id: "c", jugador_id: 8, datos: { tipo_lesion: "entorse" } }),
      lesion({ id: "d", fecha_lesion: "2026-09-25", fecha_alta: "2026-09-25" }),
    ];
    const ids = (lista) => lista.map((una) => una.id);
    expect(ids(lesionesDelReporte(lesiones, { desde: "2026-09-01", hasta: "2026-09-30" }))).toEqual(["a", "c", "d"]);
    // "Sin leves" saca la leve (b) pero no la de registro (d).
    expect(ids(lesionesDelReporte(lesiones, { sinLeves: true }))).toEqual(["a", "c", "d"]);
    expect(ids(lesionesDelReporte(lesiones, { soloMusculares: true }))).toEqual(["a", "b", "d"]);
  });

  test("conteos, meses y resumen", () => {
    const lesiones = [lesion({ id: "a" }), lesion({ id: "b", datos: { parte_cuerpo: "joelho" } }), lesion({ id: "c", fecha_lesion: "2026-07-03", fecha_alta: null })];
    expect(contarPor(lesiones, (una) => una.datos.parte_cuerpo, hoy).map((fila) => [fila.valor, fila.cantidad])).toEqual([
      ["coxa", 2],
      ["joelho", 1],
    ]);
    expect(mesesEntre("2025-11-15", "2026-02-01")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    // Con un período muy largo quedan los últimos veinte años, hasta el final.
    const largo = mesesEntre("1990-01-01", "2026-10-02");
    expect(largo).toHaveLength(240);
    expect(largo[239]).toBe("2026-10");
    expect(largo[0]).toBe("2006-11");
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
    expect(periodoDe("doce", "2028-02-29")).toEqual({ desde: "2027-03-01", hasta: "2028-02-29" });
    expect(periodoDe("todo", hoy, [lesion({ fecha_lesion: "2024-03-01" })])).toEqual({ desde: "2024-03-01", hasta: hoy });
  });
});

describe("Lesiones c/1000h y días perdidos", () => {
  const lesiones = [lesion({ id: "a" }), lesion({ id: "b", fecha_lesion: "2026-03-01", fecha_alta: "2026-03-04", datos: { tipo_lesion: "entorse" } })];
  const gps = [
    { jugadorId: "7", fecha: "2026-02-10", minutos: 3000 },
    { jugadorId: "99", fecha: "2026-09-10", minutos: 3000 },
    { jugadorId: "7", fecha: "2026-11-01", minutos: 600 },
  ];

  test("el contador del período: los minutos de todos (también de quien no está en el plantel), las horas y el cuadro", () => {
    const contador = contadorDelPeriodo(lesiones, gps, { desde: "2026-01-01", hasta: hoy });
    expect(contador.minutos).toBe(6000);
    expect(contador.horas).toBe(100);
    expect(contador.filas[0]).toMatchObject({ variante: "todas", cantidad: 2, dias: 23, lesionesCadaMil: 20, diasCadaMil: 230 });
    // Solo LM: el esguince no cuenta.
    expect(contador.filas[2]).toMatchObject({ variante: "musculares", cantidad: 1, dias: 20 });
  });

  test("sin los minutos del GPS: minutos y horas vacíos, y lo cada 1000 horas también", () => {
    const contador = contadorDelPeriodo(lesiones, null, { hasta: hoy });
    expect(contador.minutos).toBeNull();
    expect(contador.horas).toBeNull();
    expect(contador.filas[0]).toMatchObject({ cantidad: 2, dias: 23, lesionesCadaMil: null, diasCadaMil: null });
  });

  test("los períodos guardados, por fecha: los que no tienen inicio primero", () => {
    const periodos = [
      { id: 3, nombre: "Segundo semestre", desde: "2026-07-01", hasta: "2026-12-31" },
      { id: 1, nombre: "Base completa", desde: "", hasta: "2026-10-01" },
      { id: 2, nombre: "Primer semestre", desde: "2026-01-01", hasta: "2026-06-30" },
    ];
    expect(ordenarPeriodos(periodos).map((periodo) => periodo.id)).toEqual([1, 2, 3]);
  });
});

describe("lesiones sin fecha y de personas fuera de Datos básicos en los reportes", () => {
  test("el resumen cuenta a cada persona una vez, y las activas solo con fecha", () => {
    const lesiones = [
      lesion({ id: "a", fecha_alta: null }),
      lesion({ id: "b", jugador_id: null, persona: "Persona Uno", fecha_alta: null }),
      lesion({ id: "c", jugador_id: null, persona: "Persona Dos" }),
      lesion({ id: "d", jugador_id: null, persona: "persona uno " }),
      lesion({ id: "e", fecha_lesion: null, fecha_alta: null }),
    ];
    const resumen = resumenDeLesiones(lesiones, { hoy });
    expect(resumen.jugadores).toBe(3);
    expect(resumen.activas).toBe(2);
  });

  test("contar por algo no cuenta las sin fecha", () => {
    const lesiones = [lesion({ id: "a" }), lesion({ id: "b", fecha_lesion: null })];
    expect(contarPor(lesiones, (una) => una.datos.parte_cuerpo, hoy)).toEqual([{ valor: "coxa", cantidad: 1, dias: 20 }]);
    expect(lesionesDelReporte(lesiones, { hasta: hoy }).map((una) => una.id)).toEqual(["a"]);
  });
});

