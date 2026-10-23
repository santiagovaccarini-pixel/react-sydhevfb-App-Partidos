import { describe, expect, test } from "vitest";
import { REGLAS_CARGA, bloquesDelCsv, calcularCarga, esArquero, faltaLoObligatorio, filasDeLaMismaSesion, filasEnOtroCsv, filasYaEnLaBase, leerCsvCatapult, limpiarNombre, llegaAlCorte, metrosPorJugador, microcicloDe, reglasDelClub, vrPartidoDeLasReglas, vrPartidoDelDispositivo, vsPartido } from "./cargar.js";

// Datos inventados: ningún nombre ni valor del club.

const CABECERA =
  "Player Name,Period Name,Period Number,Total Distance,Velocity Distance 14-25km/h,Acceleration B2 Efforts (Gen 2),Deceleration B2 Efforts (Gen 2),Metabolic Power Band 2 Total Distance,Velocity Band 6 Total Distance,Acceleration B3 Efforts (Gen 2),Deceleration B3 Efforts (Gen 2),Metabolic Power Band 3 Total Distance,Velocity Band 6 Total Distance (Set 2),Total Duration,Maximum Velocity,Max Acceleration,Velocity Band 5 Total Distance,RHIE Effort Duration - Min,RHIE Effort Duration - Max,Start Time,End Time,Average GNSS Quality,Average HDOP,";
const csv = (...filas) => ["Date:,09/10/2026", "Start Time:,16:00:00", "Num Periods:,3", "", CABECERA, ...filas].join("\n");

describe("el CSV de Catapult", () => {
  test("se lee por el título de cada columna, sin las filas de la sesión entera", () => {
    const leido = leerCsvCatapult(
      csv(
        "Ana Uno.,Session,0,5000,1,1,1,1,1,1,1,1,1,01:00:00,25,4,1,1,1,16:00:00,17:00:00,70,0.8,",
        "Ana Uno.,1. Rondo,1,1200.5,300,10,9,250,0,2,3,40,0,00:10:30,22.5,3.1,50,0.5,18,16:05:00,16:15:30,69.5,0.75,",
        "  Beto   Dos ,1. Rondo,1,1100,280,8,7,230,0,1,2,35,0,00:10:30,21,2.9,45,0.4,17,16:05:00,16:15:30,70,0.7,",
      ),
    );
    expect(leido.error).toBe("");
    expect(leido.fecha).toBe("2026-10-09");
    expect(leido.faltan).toEqual([]);
    expect(leido.filas.map((fila) => fila.nombre)).toEqual(["Ana Uno", "Beto Dos"]);
    expect(leido.filas[0]).toMatchObject({ periodo: "1. Rondo", numero: 1 });
    expect(leido.filas[0].valores).toMatchObject({ d: 1200.5, d_shi: 300, mts90: 0, tiempo: 630, smax: 22.5, amax: 3.1, v5: 50, rhie_min: 0.5, rhie_max: 18, inicio: 57900, fin: 58530, gnss: 69.5, hdop: 0.75 });
    // Los títulos con paréntesis distintos son columnas distintas.
    expect(leido.filas[0].valores.d_s6).toBe(0);
  });

  test("copiado de una planilla (con tabuladores) también", () => {
    const texto = [CABECERA.split(",").join("\t"), ["Ana", "PRIMER TIEMPO", "1", "4000", ...Array(9).fill("0"), "00:45:00"].join("\t")].join("\n");
    const leido = leerCsvCatapult(texto);
    expect(leido.filas[0]).toMatchObject({ nombre: "Ana", periodo: "PRIMER TIEMPO" });
    expect(leido.filas[0].valores).toMatchObject({ d: 4000, tiempo: 2700 });
  });

  test("dice qué columnas faltan y avisa si no es un CSV de Catapult", () => {
    const leido = leerCsvCatapult("Player Name,Period Name,Total Distance\nAna,1. Rondo,100");
    expect(leido.faltan).toContain("tiempo");
    expect(leido.filas[0].valores).toEqual({ d: 100 });
    expect(leerCsvCatapult("hola,chau").error).toBe("gps.cargar.sinCabeceras");
    expect(leerCsvCatapult(CABECERA).error).toBe("gps.cargar.sinFilas");
  });

  test("los nombres, como los limpiaba la plantilla", () => {
    expect(limpiarNombre("  Ana  Uno. ")).toBe("Ana Uno");
  });

  test("los bloques: el partido por su nombre, las tareas ordenadas y un mismo nombre con otro número es un bloque", () => {
    const fila = (nombre, periodo, numero) => ({ nombre, periodo, numero, valores: {} });
    const bloques = bloquesDelCsv([fila("A", "2. Posesión", 2), fila("A", "Segundo Tiempo", 2), fila("B", "SEGUNDO TIEMPO", 3), fila("A", "1. Rondo", 1), fila("C", "PRIMER TIEMPO", 1)]);
    expect(bloques.primer.filas).toHaveLength(1);
    expect(bloques.segundo.filas.map((f) => f.nombre)).toEqual(["A", "B"]);
    expect(bloques.tareas.map((tarea) => tarea.nombre)).toEqual(["1. Rondo", "2. Posesión"]);
  });
});

describe("las cuentas de la sesión", () => {
  test("el microciclo: semanas de lunes a domingo desde el lunes de la semana de inicio", () => {
    expect(microcicloDe("2026-10-09", "2026-01-01")).toBe(41);
    // Sin inicio, el 1 de enero del año de la sesión.
    expect(microcicloDe("2026-10-09")).toBe(41);
    // 2026-01-01 es jueves: su semana empieza el lunes 29/12.
    expect(microcicloDe("2026-01-04", "2026-01-01")).toBe(1);
    expect(microcicloDe("2026-01-05", "2026-01-01")).toBe(2);
    expect(microcicloDe("", "2026-01-01")).toBe(null);
  });

  test("los m² por jugador (con base, un trapecio) se redondean a dos decimales", () => {
    expect(metrosPorJugador({ largo: 19, ancho: 19, jugadores: 11 })).toBe(32.82);
    expect(metrosPorJugador({ largo: 40, ancho: 30, base: 20, jugadores: 10 })).toBe(100);
    expect(metrosPorJugador({ largo: 40, ancho: 30 })).toBe(null);
  });
});

// Un jugador (de Datos básicos) y una fila de una tarea.
const j = (id) => ({ clave: `j:${id}`, jugador_id: id });
const fila = (id, valores) => ({ quien: j(id), valores: { d: 100, d_shi: 10, d_acchi: 1, d_dechi: 1, d_mphi: 5, d_s6: 0, d_a8: 0, d_a1: 0, d_mp5: 2, mts90: 0, ...valores } });
const tarea = (id, nombre, filas, extra = {}) => ({ id, nombre, tipoSesion: "analitica", zona: "fuerza", codigo: null, filas, ...extra });
const cargaBase = (extra = {}) => ({ fecha: "2026-10-09", tipoMicrociclo: "competitivo", dia: "+1", dispositivo: "catapult", partido: null, tareas: [], sesion: { tipoSesion: "din_compleja" }, regenerativo: null, noEntrenaron: [], va: {}, ...extra });
const deQuien = (filas, id) => filas.filter((f) => f.jugador_id === id);
const promedios = (filas) => filas.filter((f) => f.promedio);
// Cada jugador tiene una sola fila «Total» en el día.
const unTotalPorJugador = (filas) => {
  const totales = new Map();
  filas.filter((f) => !f.promedio).forEach((f) => totales.set(f.jugador_id ?? f.persona, (totales.get(f.jugador_id ?? f.persona) || 0) + (f.datos.condicion === "total" ? 1 : 0)));
  return [...totales.values()].every((cantidad) => cantidad === 1);
};

describe("un día de entrenamiento", () => {
  // Rondo: 5 jugadores (el 5 hizo poco: no va en el promedio); Posesión: 4 (el
  // 1 al 4); Readaptación: solo el 6. Empiezan a las 16:00 (tarde).
  const rondo = [1, 2, 3, 4].map((id) => fila(id, { d: 1000 + id * 100, tiempo: 600, inicio: 57600, fin: 58200, smax: 20 + id, gnss: 70, hdop: 0.8 }));
  rondo.push(fila(5, { d: 200, tiempo: 120, inicio: 57600, fin: 57720, smax: 15, gnss: 60, hdop: 1 }));
  const posesion = [1, 2, 3, 4].map((id) => fila(id, { d: 500, tiempo: 300, inicio: 58500, fin: 58800, smax: 18, gnss: 70, hdop: 0.8 }));
  const readaptacion = [fila(6, { d: 900, tiempo: 1200, inicio: 57000, fin: 58200, smax: 17, gnss: 65, hdop: 0.9 })];
  const carga = cargaBase({
    tareas: [
      tarea(0, "Rondo", rondo, { codigo: "pc", largo: 19, ancho: 19, jugadores: 11, pausa: 60 }),
      tarea(1, "Posesión", posesion),
      tarea(2, "Readaptación", readaptacion),
    ],
  });
  const { filas, microciclo } = calcularCarga(carga, { reglas: { ...REGLAS_CARGA, inicioMicrociclo: "2026-01-01" } });

  test("cada tarea: su promedio (con los que hicieron el 75 % del tiempo) y sus jugadores, en orden", () => {
    expect(microciclo).toBe(41);
    const ta = filas[0];
    expect(ta.promedio).toBe("parcial");
    // Los 4 primeros (el 5 hizo 120 s, menos del 75 % de 504 s).
    expect(ta.datos.d).toBe(1250);
    expect(ta.datos.tiempo).toBe(600);
    expect(ta.datos.d_min).toBeCloseTo(5000 / 40, 10);
    expect(ta.datos.smax).toBe(22.5);
    expect(ta.datos).toMatchObject({ microciclo: 41, condicion: "parcial", numero_tarea: "m1", descripcion: "2026_10_09_PC Rondo", clasificacion_dias: "mas1_t", m2: 32.82, codigo_estrategia: "pc", dispositivo: "catapult" });
    expect(ta.datos.cp_tarea).toBeCloseTo(60 / 540, 10);
    // La calidad GNSS, pesada por el tiempo de todos.
    expect(ta.datos.gnss).toBeCloseTo((70 * 2400 + 60 * 120) / 2520, 10);
    // Inicio y fin, los del primero de la lista.
    expect(ta.datos.inicio).toBe(57600);
    const delRondo = filas.slice(1, 6);
    expect(delRondo.map((f) => f.jugador_id)).toEqual([1, 2, 3, 4, 5]);
    expect(delRondo[0].datos).toMatchObject({ d: 1100, d_min: 110, numero_tarea: "m1", condicion: "parcial" });
    // La segunda tarea de cada uno es su M2.
    expect(filas.find((f) => f.jugador_id === 1 && f.datos.descripcion === "2026_10_09_ Posesión").datos.numero_tarea).toBe("m2");
  });

  test("con menos de 4 jugadores no hay promedio ni número de tarea; si es lo único que hizo, esa fila es su total", () => {
    const delSeis = deQuien(filas, 6);
    expect(delSeis).toHaveLength(1);
    expect(delSeis[0].datos).toMatchObject({ condicion: "total", min_campo: 20, descripcion: "2026_10_09_ Readaptación" });
    expect(delSeis[0].datos.numero_tarea).toBeUndefined();
    expect(promedios(filas).filter((f) => f.datos.descripcion === "2026_10_09_ Readaptación")).toHaveLength(0);
  });

  test("el total de cada uno: la suma, el tiempo del inicio de la primera tarea al final de la última y su descripción", () => {
    const total = deQuien(filas, 1).find((f) => f.datos.condicion === "total");
    expect(total.datos.d).toBe(1100 + 500);
    // De 16:00 a 16:15 (58500 + 300).
    expect(total.datos.tiempo).toBe(1200);
    expect(total.datos.min_campo).toBe(20);
    expect(total.datos.d_min).toBe(80);
    expect(total.datos.smax).toBe(21);
    expect(total.datos.amax).toBeUndefined();
    expect(total.datos.descripcion).toBe("2026_10_09  + PC Rondo +  Posesión + ");
    expect(total.datos).toMatchObject({ tipo_sesion: "din_compleja", tarea_partido: "otra_tarea", va: "si" });
    expect(unTotalPorJugador(filas)).toBe(true);
  });

  test("el promedio de la sesión: el de los totales que llegaron al 75 % del tiempo promedio", () => {
    const sesion = filas.find((f) => f.promedio === "sesion");
    // Totales: 1 a 4 (1200 s), 5 (120 s, solo el rondo) y 6 (1200 s): van
    // los que llegan al 75 % de 1020 s.
    const delCinco = deQuien(filas, 5)[0];
    expect(delCinco.datos).toMatchObject({ condicion: "total", va: "no" });
    expect(sesion.datos.tiempo).toBe(1200);
    expect(sesion.datos.d).toBe((1600 + 1700 + 1800 + 1900 + 900) / 5);
    expect(sesion.datos).toMatchObject({ condicion: "total", descripcion: "2026_10_09_PC Rondo + Posesión", min_campo: 20 });
  });

  test("el «Va» del total se cambia a mano y cambia el promedio de la sesión", () => {
    const otra = calcularCarga({ ...carga, va: { "j:6": "no" } }, { reglas: { ...REGLAS_CARGA, inicioMicrociclo: "2026-01-01" } }).filas;
    expect(deQuien(otra, 6)[0].datos.va).toBe("no");
    expect(otra.find((f) => f.promedio === "sesion").datos.d).toBe(1750);
  });
});

describe("regenerativo y los que no entrenaron", () => {
  const tareas = [tarea(0, "Rondo", [1, 2, 3, 4].map((id) => fila(id, { d: 1000, tiempo: 600, inicio: 36000, fin: 36600 })))];

  test("con 7 o más en el regenerativo, cuentan; quien además entrenó tiene la sesión + regenerativo como su total", () => {
    const quienes = [4, 10, 11, 12, 13, 14, 15].map(j);
    const { filas } = calcularCarga(cargaBase({ tareas, regenerativo: { duracion: 1800, jugadores: quienes } }));
    const regenerativo = filas.filter((f) => f.datos.tipo_sesion === "regeneracion");
    expect(regenerativo).toHaveLength(7);
    expect(regenerativo[0].datos).toMatchObject({ d: 0, d_min: 0, tiempo: 1800, va: "si", descripcion: "2026_10_09_Regenerativo 7 Jug", clasificacion_dias: "mas1_m" });
    // Solo regenerativo: esa fila es su total.
    expect(deQuien(filas, 10)[0].datos).toMatchObject({ condicion: "total", min_campo: 30 });
    // Entrenó y regenerativo: la fila de los dos juntos es el total y va.
    const delCuatro = deQuien(filas, 4);
    const juntas = delCuatro.find((f) => f.datos.descripcion.includes("Regenerativo"));
    expect(juntas.datos).toMatchObject({ condicion: "total", va: "si", tiempo: 2400, d: 1000, descripcion: "2026_10_09  Rondo + Regenerativo 7 Jug", min_campo: 40 });
    expect(delCuatro.filter((f) => f.datos.condicion === "total")).toHaveLength(1);
    // El promedio de la sesión pasa a «Parcial» y el de la sesión es el de todos los «Va».
    expect(filas.filter((f) => f.promedio === "parcial" && f.datos.descripcion === "2026_10_09_ Rondo")).toHaveLength(2);
    const final = filas[filas.length - 1];
    expect(final).toMatchObject({ promedio: "sesion" });
    expect(final.datos.descripcion).toBe("2026_10_09_ Rondo+Regenerativo 7 Jug+");
    expect(unTotalPorJugador(filas)).toBe(true);
  });

  test("con menos de 7 no cuentan; los que no entrenaron, en 0 con su motivo y sin contar", () => {
    const { filas } = calcularCarga(
      cargaBase({
        tareas,
        regenerativo: { duracion: 1800, jugadores: [j(10), j(11)] },
        noEntrenaron: [
          { quien: j(20), motivo: "Kine", tipoSesion: "rehabilitacion" },
          { quien: j(21), motivo: "" },
        ],
      }),
    );
    expect(deQuien(filas, 10)[0].datos.va).toBe("no");
    expect(deQuien(filas, 20)[0].datos).toMatchObject({ d: 0, tiempo: 0, va: "no", condicion: "total", min_campo: 0, tipo_sesion: "rehabilitacion", descripcion: "2026_10_09_Kine" });
    expect(deQuien(filas, 21)[0].datos.descripcion).toBe("2026_10_09_No Entreno");
    // Sin nadie que cuente abajo, el promedio de la sesión es el de arriba.
    expect(filas.filter((f) => f.promedio === "sesion")).toHaveLength(1);
    expect(unTotalPorJugador(filas)).toBe(true);
  });
});

describe("un día de partido", () => {
  const tiempoCompleto = (id, valores) => fila(id, { inicio: 69600, fin: 72300, gnss: 50, hdop: 1, mts90: 0, ...valores });
  // Primer tiempo: 1 a 4 (45 min); segundo: 1 a 3 y entra el 5 (20 min).
  const primer = [1, 2, 3, 4].map((id) => tiempoCompleto(id, { d: 5000, tiempo: 2700, smax: 30 }));
  const segundo = [1, 2, 3].map((id) => tiempoCompleto(id, { d: 4000, tiempo: 2700, smax: 28, inicio: 73200, fin: 75900, mts90: 3 }));
  segundo.push(tiempoCompleto(5, { d: 2000, tiempo: 1200, smax: 31, inicio: 74700, fin: 75900 }));
  const carga = cargaBase({
    dia: "0",
    partido: {
      nombre: "Vs Rival",
      tareaPartido: "partido_oficial_torneo",
      primer: { tipoSesion: "din_colectiva", zona: "fuerza", filas: primer },
      segundo: { tipoSesion: "din_colectiva", filas: segundo },
      completo: { tipoSesion: "din_compleja" },
      banco: { tipoSesion: "din_compleja", jugadores: [j(9)] },
    },
  });
  const { filas } = calcularCarga(carga);

  test("cada tiempo: el promedio es la suma ÷ 10 (Mts >= 90% Pico, el promedio)", () => {
    const pt = filas[0];
    expect(pt.promedio).toBe("parcial");
    expect(pt.datos.d).toBe(2000);
    expect(pt.datos.tiempo).toBe(1080);
    expect(pt.datos).toMatchObject({ descripcion: "2026_10_09_ Vs Rival PT ", tarea_partido: "partido_oficial_torneo", clasificacion_dias: "0_t", zona_impacto: "fuerza" });
    const st = filas.find((f) => f.promedio && f.datos.descripcion.endsWith(" ST "));
    expect(st.datos.mts90).toBe(2.25);
    expect(st.datos.d).toBe(1400);
  });

  test("el partido completo de quien jugó los dos tiempos es su total; quien jugó uno, esa fila", () => {
    const delUno = deQuien(filas, 1);
    expect(delUno.map((f) => f.datos.condicion)).toEqual(["parcial", "parcial", "total"]);
    expect(delUno[2].datos).toMatchObject({ d: 9000, tiempo: 5400, smax: 30, inicio: 69600, fin: 75900, descripcion: "2026_10_09_ Vs Rival TOTAL ", min_campo: 90, va: "si" });
    expect(deQuien(filas, 4)).toHaveLength(1);
    expect(deQuien(filas, 4)[0].datos).toMatchObject({ condicion: "total", min_campo: 45, va: "si" });
    expect(deQuien(filas, 5)[0].datos).toMatchObject({ condicion: "total", va: "si" });
    // El promedio del completo: la suma de todos ÷ 10; las máximas, la mayor de los dos tiempos.
    const completo = filas.find((f) => f.promedio && f.datos.descripcion.endsWith(" TOTAL "));
    expect(completo.datos.d).toBe(3400);
    expect(completo.datos.smax).toBe(Math.max(filas[0].datos.smax, filas.find((f) => f.promedio && f.datos.descripcion.endsWith(" ST ")).datos.smax));
  });

  test("los que no ingresaron: todo en 0, con el inicio del partido, y van en el promedio", () => {
    const banco = deQuien(filas, 9);
    expect(banco).toHaveLength(1);
    expect(banco[0].datos).toMatchObject({ d: 0, tiempo: 0, smax: 0, inicio: 69600, condicion: "total", va: "si", descripcion: "2026_10_09_ Vs Rival SIN INGRESAR ", tipo_sesion: "din_compleja" });
    expect(banco[0].datos.zona_impacto).toBeUndefined();
    expect(unTotalPorJugador(filas)).toBe(true);
  });

  test("el promedio de la sesión, con la descripción del partido", () => {
    const sesion = filas.find((f) => f.promedio === "sesion");
    expect(sesion.datos.descripcion).toBe("2026_10_09_ Vs Rival TOTAL");
    // Todos los del partido van: 1 a 3 (9000), 4 (5000), 5 (2000) y el banco (0).
    expect(sesion.datos.d).toBe((27000 + 5000 + 2000) / 6);
  });

  test("lo que se escribe en el encabezado de un tiempo va en su descripción y sus m², como en la plantilla", () => {
    const conEncabezado = calcularCarga({
      ...carga,
      partido: { ...carga.partido, primer: { ...carga.partido.primer, codigo: "pc", jugadores: 11, series: 1, bloques: 2, pausa: "2'", largo: 105, ancho: 68, m2: 324.5 } },
    }).filas;
    const pt = conEncabezado.filter((f) => f.datos.descripcion?.includes(" PT"));
    expect(pt.map((f) => f.datos.descripcion)).toEqual(Array(5).fill("2026_10_09_PC Vs Rival PT, 11 jug, 1 series x 2 bloques, pausa: 2' 105 x 68"));
    expect(pt.every((f) => f.datos.m2 === 324.5)).toBe(true);
    // El segundo tiempo, sin nada escrito, como antes.
    expect(conEncabezado.find((f) => f.promedio && f.datos.descripcion.endsWith(" ST ")).datos.m2).toBeUndefined();
  });
});

describe("el encabezado de la sesión", () => {
  test("los m² por jugador, la relación pausa / trabajo y la cancha van en el promedio de la sesión; los m², también en cada total", () => {
    const tareas = [0, 1].map((t) => tarea(t, `Tarea ${t + 1}`, [1, 2, 3, 4].map((id) => fila(id, { d: 1000, tiempo: 600, inicio: 57600 + t * 900, fin: 58200 + t * 900 }))));
    const { filas } = calcularCarga(cargaBase({ tareas, sesion: { tipoSesion: "din_colectiva", base: 20, largo: 40, ancho: 30, jugadores: 10, pausa: 300, cpJug: 2 } }));
    const promedioSesion = filas.find((f) => f.promedio === "sesion");
    // Con base, un trapecio: (30 × 40 − ((30 − 20) / 2) × 40) / 10 = 100.
    expect(promedioSesion.datos).toMatchObject({ m2: 100, cp_jug: 2, base: 20, largo: 40, ancho: 30 });
    // La pausa sobre el total más largo (25 min) menos la pausa.
    expect(promedioSesion.datos.cp_tarea).toBeCloseTo(300 / (1500 - 300), 10);
    const totales = filas.filter((f) => f._seccion === "sesion:total");
    expect(totales).toHaveLength(4);
    expect(totales.every((f) => f.datos.m2 === 100 && f.datos.base === undefined)).toBe(true);
    // Sin nada escrito, nada (como los días comparados con el historial).
    const sinNada = calcularCarga(cargaBase({ tareas })).filas.find((f) => f.promedio === "sesion");
    expect(sinNada.datos.m2).toBeUndefined();
    expect(sinNada.datos.cp_tarea).toBeUndefined();
  });
});

// Regla 1 (Santiago, 20/10: «Jugador, fecha y hora de incio para preguntar si
// es duplicado»). Todo inventado.
describe("Regla 1: ¿la misma sesión, con otros datos?", () => {
  const nueva = (quien, inicio, extra = {}) => ({ fecha: "2026-10-08", ...quien, datos: { d: 3000, ...(inicio === null ? {} : { inicio }), dispositivo: "catapult", ...extra } });
  const vieja = (id, quien, inicio, dispositivo = "catapult") => ({ id, fecha: "2026-10-08", jugador_id: null, persona: null, promedio: null, ...quien, datos: { d: 2900, ...(inicio === null ? {} : { inicio }), dispositivo } });
  const nuevas = [nueva({ jugador_id: 1 }, 36000), nueva({ jugador_id: 1 }, null, { condicion: "total" }), nueva({ jugador_id: 2 }, 36000), nueva({ persona: "Invitado  X" }, 36000), nueva({ promedio: "sesion" }, 36000)];

  test("con un jugador a la misma hora de inicio (y el mismo dispositivo), es la misma: las filas de ese día de los jugadores que se cargan, también su total", () => {
    const delDia = [vieja("v1", { jugador_id: 1 }, 36000), vieja("v2", { jugador_id: 1 }, null), vieja("v3", { jugador_id: 2 }, null), vieja("v4", { jugador_id: 9 }, 36000), vieja("v5", { promedio: "sesion" }, 36000)];
    expect(filasDeLaMismaSesion(nuevas, delDia, "catapult").map((fila) => fila.id)).toEqual(["v1", "v2", "v3"]);
  });
  test("una persona fuera de Datos básicos, escrita distinto, también", () => {
    expect(filasDeLaMismaSesion(nuevas, [vieja("p1", { persona: "invitado x " }, 36000.4)], "catapult").map((fila) => fila.id)).toEqual(["p1"]);
  });
  test("otra hora de inicio es otro turno; otro dispositivo, otra cosa; un total sin hora, no alcanza", () => {
    expect(filasDeLaMismaSesion(nuevas, [vieja("t1", { jugador_id: 1 }, 61200), vieja("t2", { jugador_id: 1 }, null)], "catapult")).toEqual([]);
    expect(filasDeLaMismaSesion(nuevas, [vieja("s1", { jugador_id: 1 }, 36000, "sport")], "catapult")).toEqual([]);
    expect(filasDeLaMismaSesion(nuevas, [], "catapult")).toEqual([]);
  });
});

describe("¿ya está en la Base?", () => {
  const delCsv = [
    { valores: { d: 4213.552760034754, tiempo: 1200, inicio: 57600 } },
    { valores: { d: 3000.1, tiempo: 900, inicio: 58000 } },
  ];
  test("cuenta las filas del CSV con la misma distancia, tiempo e inicio en ese día", () => {
    expect(filasYaEnLaBase(delCsv, [{ datos: { d: 4213.55276003475, tiempo: 1200, inicio: 57600 } }])).toBe(1);
    expect(filasYaEnLaBase(delCsv, [{ datos: { d: 4213.552760034754, tiempo: 1200, inicio: 57600 } }, { datos: { d: 3000.1, tiempo: 900 } }])).toBe(2);
  });
  test("otra sesión del mismo día (otros números) no es la misma", () => {
    expect(filasYaEnLaBase(delCsv, [{ datos: { d: 4213.6, tiempo: 1200, inicio: 57600 } }, { datos: { d: 3000.1, tiempo: 950, inicio: 58000 } }])).toBe(0);
    expect(filasYaEnLaBase(delCsv, [])).toBe(0);
    // Los ceros (los que no ingresaron, los que no entrenaron) no cuentan.
    expect(filasYaEnLaBase([{ valores: { d: 0, tiempo: 0 } }], [{ datos: { d: 0, tiempo: 0 } }])).toBe(0);
  });
  // Santiago, 23/10: varias cargas sin terminar por día; la del mismo CSV se frena.
  test("el mismo CSV en otra carga sin terminar, con la misma cuenta; otro turno no", () => {
    expect(filasEnOtroCsv(delCsv, [{ valores: { d: 3000.1, tiempo: 900, inicio: 58000 } }])).toBe(1);
    expect(filasEnOtroCsv(delCsv, [{ valores: { d: 5000, tiempo: 900, inicio: 70000 } }])).toBe(0);
    expect(filasEnOtroCsv(delCsv, [])).toBe(0);
  });
});

describe("las reglas del club (Ajustes › Reglas de carga)", () => {
  test("sin nada guardado, las de la plantilla; los cortes, apagados", () => {
    expect(reglasDelClub()).toEqual(REGLAS_CARGA);
    expect(reglasDelClub({})).toMatchObject({ parteDelTiempo: 0.75, divisorDelPartido: 10, minimoParaPromedio: 4, horaDeLaTarde: 46800, minimoRegenerativo: 7, contarNoEntrenaron: false, cortarSesionMasRegenerativo: false, parteNoEntrenaron: 0.3 });
  });

  test("vale lo guardado que está bien; lo demás, como la plantilla", () => {
    const reglas = reglasDelClub({
      parteDelTiempo: 0.8,
      horaDeLaTarde: 14 * 3600,
      contarNoEntrenaron: true,
      inicioMicrociclo: "2026-01-05",
      // Mal: fuera de rango, de otro tipo o una fecha que no es fecha.
      divisorDelPartido: 0,
      minimoParaPromedio: "4",
      parteNoEntrenaron: 0,
      partidoVaEntero: "no",
      otra: 3,
    });
    expect(reglas).toEqual({ ...REGLAS_CARGA, parteDelTiempo: 0.8, horaDeLaTarde: 50400, contarNoEntrenaron: true, inicioMicrociclo: "2026-01-05" });
    expect(reglasDelClub({ inicioMicrociclo: "5/1/2026", horaDeLaTarde: 86400 })).toEqual(REGLAS_CARGA);
  });

  test("el «Va tarea» sigue la parte del tiempo del club", () => {
    const filas = leerCsvCatapult(
      csv(
        "Ana Uno,1. Rondo,1,1000,,,,,,,,,,00:10:00,,,,,,10:00:00,10:10:00,,,",
        "Beto Dos,1. Rondo,1,1000,,,,,,,,,,00:10:00,,,,,,10:00:00,10:10:00,,,",
        "Ceci Tres,1. Rondo,1,1000,,,,,,,,,,00:10:00,,,,,,10:00:00,10:10:00,,,",
        "Dani Cuatro,1. Rondo,1,800,,,,,,,,,,00:07:30,,,,,,10:00:00,10:07:30,,,",
      ),
    ).filas;
    const carga = { fecha: "2026-10-09", tareas: [{ id: "t", nombre: "Rondo", filas: filas.map((fila) => ({ quien: { clave: fila.nombre, persona: fila.nombre }, valores: fila.valores })) }], sesion: {} };
    // Promedio 9:22,5; 7:30 es el 80 %: va con 0,75, no va con 0,85.
    const va = (reglas) => calcularCarga(carga, { reglas }).filas.filter((fila) => fila._seccion === "tarea:t" && !fila.promedio).map((fila) => fila._vaTarea);
    expect(va(REGLAS_CARGA)).toEqual(["si", "si", "si", "si"]);
    expect(va(reglasDelClub({ parteDelTiempo: 0.85 }))).toEqual(["si", "si", "si", "no"]);
  });
});

describe("las reglas nuevas (Santiago, 12/10)", () => {
  test("de entrada: sin arqueros y ocultos los campos que no usa el partido (el V.R. de partido ya no es una regla)", () => {
    expect(REGLAS_CARGA).not.toHaveProperty("vrPartido");
    expect(REGLAS_CARGA.conArqueros).toBe(false);
    expect([...REGLAS_CARGA.ocultosDelPartido].sort()).toEqual(["ancho", "bloques", "codigo", "jugadores", "largo", "m2", "series"]);
  });

  test("vale lo guardado que está bien", () => {
    const reglas = reglasDelClub({
      vrPartido: { d_min: 100, d_shi_min: 20.5, d_acchi_min: 0, mts90_min: "3", otra: 4 },
      ocultosDelPartido: ["largo", "nada", "m2", "largo"],
      conArqueros: true,
    });
    expect(reglas).not.toHaveProperty("vrPartido");
    expect(reglas.ocultosDelPartido).toEqual(["largo", "m2"]);
    expect(reglas.conArqueros).toBe(true);
    // Sin ocultar nada: se ve todo.
    expect(reglasDelClub({ ocultosDelPartido: [] }).ocultosDelPartido).toEqual([]);
    // De otro tipo: como de entrada.
    expect(reglasDelClub({ vrPartido: [1, 2], ocultosDelPartido: "largo", conArqueros: "si" })).toEqual(REGLAS_CARGA);
  });
});

describe("el V.R. de partido de cada dispositivo (Santiago, 14/10)", () => {
  const referencias = [
    { id: "a", dispositivo: "catapult", dePartido: false, promedio: { d_min: 1 } },
    { id: "b", dispositivo: "catapult", dePartido: true, promedio: { d: 9000, d_min: 97.5, d_shi_min: 15.25, d_acchi_min: 0, mts90_min: "3", tiempo: 5400 } },
    { id: "c", dispositivo: "sport", dePartido: false, promedio: { d_min: 101 } },
  ];
  test("el marcado de partido del dispositivo de la carga, solo sus por minuto mayores que 0", () => {
    expect(vrPartidoDelDispositivo(referencias, "catapult")).toEqual({ d_min: 97.5, d_shi_min: 15.25 });
  });
  test("sin dispositivo, o sin uno marcado, no hay", () => {
    expect(vrPartidoDelDispositivo(referencias, "")).toBeNull();
    expect(vrPartidoDelDispositivo(referencias, "sport")).toBeNull();
    expect(vrPartidoDelDispositivo([], "catapult")).toBeNull();
    expect(vrPartidoDelDispositivo([{ dispositivo: "x", dePartido: true, promedio: { d: 5 } }], "x")).toBeNull();
  });
  test("el de las reglas de antes (mientras la base no tenga la actualización)", () => {
    expect(vrPartidoDeLasReglas({ vrPartido: { d_min: 100, d_shi_min: 20.5, d_acchi_min: 0, mts90_min: "3", otra: 4 } })).toEqual({ d_min: 100, d_shi_min: 20.5 });
    expect(vrPartidoDeLasReglas({})).toBeNull();
    expect(vrPartidoDeLasReglas({ vrPartido: [1] })).toBeNull();
  });
});

describe("% vs V.R. de partido (la plantilla, arriba de cada bloque)", () => {
  const vr = { d_min: 100, d_shi_min: 10, d_acchi_min: 2, d_dechi_min: 2, d_mphi_min: 5, d_s6_min: 1, d_a8_min: 0.5, d_a1_min: 0.5, d_mp5_min: 2, mts90_min: 4 };

  test("cada medida por minuto del Team Average ÷ su V.R.; los grupos, el promedio de los suyos", () => {
    const datos = { d_min: 80, d_shi_min: 12, d_acchi_min: 1, d_dechi_min: 3, d_mphi_min: 5, d_s6_min: 0.5, d_a8_min: 0.5, d_a1_min: 0.25, d_mp5_min: 1, mts90_min: 6 };
    const vs = vsPartido(datos, vr);
    expect(vs.medidas.d_min).toBeCloseTo(0.8);
    expect(vs.medidas.mts90_min).toBeCloseTo(1.5);
    // Metabólica: D, D_SHI y D_MPHI.
    expect(vs.metabolica).toBeCloseTo((0.8 + 1.2 + 1) / 3);
    // Fuerza: D_AccHI, D_DecHI, D_A8 y D_A1.
    expect(vs.fuerza).toBeCloseTo((0.5 + 1.5 + 1 + 0.5) / 4);
    // Velocidad: D_S6 y D_MP5.
    expect(vs.velocidad).toBeCloseTo((0.5 + 0.5) / 2);
    // El promedio: las nueve primeras (Mts >= 90% Pico no entra).
    expect(vs.promedio).toBeCloseTo((0.8 + 1.2 + 0.5 + 1.5 + 1 + 0.5 + 1 + 0.5 + 0.5) / 9);
  });

  test("sin el dato o sin su V.R., vacío; un promedio, de los que hay", () => {
    const vs = vsPartido({ d_min: 50, d_shi_min: 5 }, { d_min: 100, d_mphi_min: 5 });
    expect(vs.medidas.d_min).toBeCloseTo(0.5);
    expect(vs.medidas.d_shi_min).toBeNull();
    expect(vs.metabolica).toBeCloseTo(0.5);
    expect(vs.fuerza).toBeNull();
    expect(vsPartido(null, vr).promedio).toBeNull();
    expect(vsPartido({ d_min: 80 }).promedio).toBeNull();
  });

  test("los colores, como la plantilla: verde desde el corte (90 % cada medida, 70 % el promedio), rojo abajo", () => {
    expect(REGLAS_CARGA.corteVsPartido).toBe(0.9);
    expect(REGLAS_CARGA.corteVsPartidoPromedio).toBe(0.7);
    expect(llegaAlCorte(0.9, 0.9)).toBe(true);
    expect(llegaAlCorte(0.8999, 0.9)).toBe(false);
    expect(llegaAlCorte(1.2, 0.9)).toBe(true);
    // Como Excel: 0,9 hecho con cuentas sigue siendo 0,9.
    expect(llegaAlCorte(0.3 * 3, 0.9)).toBe(true);
    expect(llegaAlCorte(null, 0.9)).toBeNull();
    expect(reglasDelClub({ corteVsPartido: 0.95, corteVsPartidoPromedio: 0 })).toMatchObject({ corteVsPartido: 0.95, corteVsPartidoPromedio: 0.7 });
  });

  test("sale del Team Average de cada tarea (lo de cada minuto de los que van)", () => {
    const filas = leerCsvCatapult(
      csv(
        "Ana Uno,1. Rondo,1,1000,,,,,,,,,,00:10:00,,,,,,10:00:00,10:10:00,,,",
        "Beto Dos,1. Rondo,1,1200,,,,,,,,,,00:10:00,,,,,,10:00:00,10:10:00,,,",
        "Ceci Tres,1. Rondo,1,800,,,,,,,,,,00:10:00,,,,,,10:00:00,10:10:00,,,",
        "Dani Cuatro,1. Rondo,1,1000,,,,,,,,,,00:10:00,,,,,,10:00:00,10:10:00,,,",
      ),
    ).filas;
    const carga = { fecha: "2026-10-09", tareas: [{ id: "t", nombre: "Rondo", filas: filas.map((fila) => ({ quien: { clave: fila.nombre, persona: fila.nombre }, valores: fila.valores })) }], sesion: {} };
    const promedio = calcularCarga(carga).filas.find((fila) => fila._seccion === "tarea:t" && fila.promedio);
    expect(vsPartido(promedio.datos, vr).medidas.d_min).toBeCloseTo(1);
  });
});

describe("lo que lleva toda fila (Santiago, 12/10)", () => {
  test("día, dispositivo y tipo de sesión", () => {
    const completa = { datos: { clasificacion_dias: "c", dispositivo: "d", tipo_sesion: "t" } };
    expect(faltaLoObligatorio([completa])).toEqual([]);
    expect(faltaLoObligatorio([completa, { datos: { clasificacion_dias: "c" } }])).toEqual(["dispositivo", "tipo_sesion"]);
    expect(faltaLoObligatorio([])).toEqual([]);
  });

  test("un arquero es el de Posición «Arquero» en Datos básicos", () => {
    expect(esArquero({ posicion: "goleiro" })).toBe(true);
    expect(esArquero({ posicion: "extremo" })).toBe(false);
    expect(esArquero(null)).toBe(false);
  });
});
