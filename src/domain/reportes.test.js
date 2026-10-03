import { describe, expect, test } from "vitest";
import {
  REGLAS_GRAFICOS,
  VARIANTES,
  aniosDeMomentos,
  aniosDePeriodos,
  contadorDelPeriodo,
  contarPor,
  contraVR,
  cuadroCadaMil,
  cumpleVariante,
  diasEnPeriodo,
  entraEnElCuadro,
  esLeve,
  esMuscular,
  graficosPorPeriodo,
  lesionesDeLosGraficos,
  lesionesDelReporte,
  lesionesPorJugador,
  mesesEntre,
  minutosGps,
  momentosPorParte,
  nombresDeQuien,
  opcionesDeFiltro,
  ordenarPeriodos,
  ordenarPorEtiqueta,
  periodoDe,
  porMes,
  resumenDeLesiones,
  serieCadaMil,
  tortaPorParte,
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

describe("Informes gráficos: bloques 1 y 2 (c/1000 h por período guardado)", () => {
  const lesiones = [
    lesion({ id: "l1" }),
    lesion({ id: "l2", fecha_lesion: "2026-03-10", fecha_alta: "2026-03-13", datos: { tipo_lesion: "entorse_ligamentar" } }),
    lesion({ id: "l3", fecha_lesion: "2026-05-01", fecha_alta: null, datos: { tipo_lesion: "muscular_2a" } }),
    lesion({ id: "l4", fecha_lesion: "2026-04-01", fecha_alta: "2026-04-11", datos: { producto: "traumatica" } }),
    lesion({ id: "l5", fecha_lesion: null, fecha_alta: null }),
  ];
  const periodos = [
    { id: "p1", nombre: "1º semestre", desde: "2026-01-01", hasta: "2026-06-30" },
    { id: "p2", nombre: "2º semestre", desde: "2026-07-01", hasta: "2026-12-31" },
    { id: "p3", nombre: "2025", desde: "2025-01-01", hasta: "2025-12-31" },
    { id: "p4", nombre: "Base completa", desde: null, hasta: "2026-10-02" },
  ];
  const gps = [
    { jugadorId: 7, fecha: "2026-02-01", minutos: 6000 },
    { jugadorId: 8, fecha: "2026-08-01", minutos: 12000 },
  ];
  const columna = (fila, medida) => fila.filas.map((una) => una[medida]);

  test("los períodos en el orden de las fechas, y los de un año (el de su fecha final)", () => {
    expect(aniosDePeriodos(periodos)).toEqual([2025, 2026]);
    expect(graficosPorPeriodo(lesiones, gps, periodos).map((fila) => fila.periodo.id)).toEqual(["p4", "p3", "p1", "p2"]);
    expect(graficosPorPeriodo(lesiones, gps, periodos, { anio: 2026 }).map((fila) => fila.periodo.id)).toEqual(["p4", "p1", "p2"]);
    expect(REGLAS_GRAFICOS.anioDelPeriodo).toBe("hasta");
  });

  test("cada período se calcula como el contador del Excel (sin las sin fecha ni las traumáticas)", () => {
    const [p4, p3, p1, p2] = graficosPorPeriodo(lesiones, gps, periodos);
    expect(columna(p1, "cantidad")).toEqual([2, 1, 1, 1]);
    expect(columna(p1, "dias")).toEqual([63, 60, 60, 60]);
    expect(columna(p1, "lesionesCadaMil")).toEqual([20, 10, 10, 10]);
    expect(columna(p1, "diasCadaMil")).toEqual([630, 600, 600, 600]);
    // Una abierta cuenta desde su inicio (la columna CQ del Excel).
    expect(columna(p2, "dias")).toEqual([264, 264, 264, 264]);
    expect(columna(p2, "lesionesCadaMil")).toEqual([5, 5, 5, 5]);
    // Sin minutos: los números, sin cada 1000 horas.
    expect(columna(p3, "cantidad")).toEqual([0, 0, 0, 0]);
    expect(columna(p3, "lesionesCadaMil")).toEqual([null, null, null, null]);
    expect(columna(p4, "cantidad")).toEqual([3, 2, 2, 2]);
    expect(columna(p4, "dias")).toEqual([177, 174, 174, 174]);
    expect(columna(p4, "diasCadaMil")).toEqual([590, 580, 580, 580]);
    expect(p4.horas).toBe(300);
  });

  test("sin GPS, las lesiones y los días; cada 1000 horas, nada", () => {
    const [, , p1] = graficosPorPeriodo(lesiones, null, periodos);
    expect(columna(p1, "cantidad")).toEqual([2, 1, 1, 1]);
    expect(columna(p1, "lesionesCadaMil")).toEqual([null, null, null, null]);
    expect(p1.horas).toBe(null);
  });

  test("la serie de un gráfico: una columna por período", () => {
    const porPeriodo = graficosPorPeriodo(lesiones, gps, periodos, { anio: 2026 });
    expect(serieCadaMil(porPeriodo, "todas", "dias")[1]).toEqual({ clave: "p1", etiqueta: "1º semestre", valor: 630, detalle: 63 });
    expect(serieCadaMil(porPeriodo, "sinLeves", "lesiones")[1]).toEqual({ clave: "p1", etiqueta: "1º semestre", valor: 10, detalle: 1 });
  });
});

describe("Informes gráficos: bloques 3 a 5 (partes del cuerpo, por jugador, entrenamiento y partidos)", () => {
  const POSICIONES = { 7: "extremo", 8: "goleiro" };
  const posicionDe = (una) => POSICIONES[una.jugador_id] || null;
  const lesiones = [
    lesion({ id: "A" }),
    lesion({ id: "B", jugador_id: 8, fecha_lesion: "2026-03-01", datos: { parte_cuerpo: "joelho", lado: "esquerdo", cuando: "partida_oficial", tipo_lesion: "entorse_ligamentar" } }),
    lesion({ id: "C", jugador_id: 8, fecha_lesion: "2025-11-10", datos: { cuando: "partida_oficial" } }),
    lesion({ id: "D", fecha_lesion: "2026-06-01", datos: { parte_cuerpo: "joelho", producto: "traumatica", cuando: "partida_oficial" } }),
    lesion({ id: "E", jugador_id: null, persona: "Persona Externa", fecha_lesion: "2026-02-01", datos: { parte_cuerpo: "tornozelo_pe", producto: "traumatica", cuando: "" } }),
    lesion({ id: "F", fecha_lesion: "2026-04-01", datos: { parte_cuerpo: "", cuando: "partida_oficial" } }),
    // Sin fecha: nunca cuenta, aunque tenga todo lo demás.
    lesion({ id: "G", fecha_lesion: null, fecha_alta: null }),
    // Sin tipo de lesión: no cuenta ("Cuenta de Tipo de lesão").
    lesion({ id: "H", fecha_lesion: "2026-05-01", datos: { tipo_lesion: "" } }),
    lesion({ id: "I", jugador_id: 8, fecha_lesion: "2026-07-01", datos: { producto: "trauma_indireto" } }),
    // De la Selección: no entra en el cuadro c/1000 h, pero sí acá.
    lesion({ id: "J", fecha_lesion: "2026-08-01", datos: { localizacion: "selecao", cuando: "partida_oficial" } }),
  ];
  const ids = (lista) => lista.map((una) => una.id);
  const torta = (filas) => Object.fromEntries(filas.map((fila) => [fila.valor, [fila.cantidad, Math.round(fila.porcentaje)]]));
  const porValor = (filas) => Object.fromEntries(filas.map((fila) => [fila.valor, { total: fila.total, ...fila.porSerie }]));

  test("cuentan las que tienen fecha y tipo de lesión, de cualquier localización", () => {
    expect(ids(lesionesDeLosGraficos(lesiones))).toEqual(["A", "B", "C", "D", "E", "F", "I", "J"]);
  });

  test("las tortas por parte del cuerpo, con sus filtros (también la posición del plantel)", () => {
    expect(torta(tortaPorParte(lesiones, "nao_traumatica"))).toEqual({ coxa: [3, 60], joelho: [1, 20], "": [1, 20] });
    expect(torta(tortaPorParte(lesiones, "traumatica"))).toEqual({ joelho: [1, 50], tornozelo_pe: [1, 50] });
    expect(torta(tortaPorParte(lesiones, "nao_traumatica", { filtros: { lado: "esquerdo" } }))).toEqual({ joelho: [1, 100] });
    expect(torta(tortaPorParte(lesiones, "nao_traumatica", { filtros: { posicion: "goleiro" }, posicionDe }))).toEqual({ joelho: [1, 50], coxa: [1, 50] });
    // Fuera de Datos básicos no hay posición.
    expect(tortaPorParte(lesiones, "traumatica", { filtros: { posicion: "goleiro" }, posicionDe })).toEqual([]);
    expect(REGLAS_GRAFICOS.tortas.valores).toEqual(["nao_traumatica", "traumatica"]);
    expect(Object.isFrozen(REGLAS_GRAFICOS)).toBe(true);
  });

  test("por jugador: cada persona (también fuera de Datos básicos), apilada por parte; sin parte no cuenta", () => {
    expect(porValor(lesionesPorJugador(lesiones))).toEqual({
      "j:7": { total: 3, coxa: 2, joelho: 1 },
      "j:8": { total: 3, joelho: 1, coxa: 2 },
      "p:persona externa": { total: 1, tornozelo_pe: 1 },
    });
    expect(porValor(lesionesPorJugador(lesiones, { filtros: { producto: "traumatica" } }))).toEqual({
      "j:7": { total: 1, joelho: 1 },
      "p:persona externa": { total: 1, tornozelo_pe: 1 },
    });
    expect(Object.keys(porValor(lesionesPorJugador(lesiones, { filtros: { jugador: "j:8" } })))).toEqual(["j:8"]);
  });

  test("entrenamiento y partidos: por el año de la fecha de inicio, sin las que no dicen cuándo", () => {
    expect(aniosDeMomentos(lesiones)).toEqual([2025, 2026]);
    expect(porValor(momentosPorParte(lesiones, { anio: 2026 }))).toEqual({
      treinamento: { total: 2, coxa: 2 },
      partida_oficial: { total: 4, joelho: 2, "": 1, coxa: 1 },
    });
    expect(porValor(momentosPorParte(lesiones))).toEqual({
      treinamento: { total: 2, coxa: 2 },
      partida_oficial: { total: 5, joelho: 2, coxa: 2, "": 1 },
    });
    const bordes = [lesion({ id: "fin", fecha_lesion: "2026-12-31" }), lesion({ id: "inicio", fecha_lesion: "2027-01-01" })];
    expect(momentosPorParte(bordes, { anio: 2026 })[0].total).toBe(1);
    expect(momentosPorParte(bordes, { anio: 2027 })[0].total).toBe(1);
  });

  test("las opciones de un filtro, el orden por cómo se lee y el nombre de cada quien", () => {
    expect(opcionesDeFiltro(lesiones, "lado")).toEqual(["direito", "esquerdo"]);
    expect(opcionesDeFiltro(lesiones, "posicion", posicionDe).sort()).toEqual(["extremo", "goleiro"]);
    const PT = { coxa: "COXA", joelho: "JOELHO", pe_dedo: "PÉ/DEDO", tornozelo_pe: "TORNOZELO/PÉ", perna_aquiles: "PERNA/TENDÃO DE AQUILES" };
    const ES = { coxa: "Muslo", joelho: "Rodilla", pe_dedo: "Pie / dedo", tornozelo_pe: "Tobillo / pie", perna_aquiles: "Pierna / tendón de Aquiles" };
    const filas = ["tornozelo_pe", "", "joelho", "pe_dedo", "coxa", "perna_aquiles"].map((valor) => ({ valor }));
    expect(ordenarPorEtiqueta(filas, (valor) => PT[valor] || "", "pt-BR").map((fila) => fila.valor)).toEqual(["coxa", "joelho", "pe_dedo", "perna_aquiles", "tornozelo_pe", ""]);
    expect(ordenarPorEtiqueta(filas, (valor) => ES[valor] || "", "es-AR").map((fila) => fila.valor)).toEqual(["coxa", "pe_dedo", "perna_aquiles", "joelho", "tornozelo_pe", ""]);
    const nombres = nombresDeQuien([...lesiones, lesion({ id: "otro", jugador_id: 99 })], [{ id: 7, nombre: "HULK" }]);
    expect([nombres.get("j:7"), nombres.get("p:persona externa"), nombres.get("j:99")]).toEqual(["HULK", "Persona Externa", "—"]);
  });
});
