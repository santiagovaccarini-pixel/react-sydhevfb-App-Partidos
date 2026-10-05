import { describe, expect, it } from "vitest";
import { COMO_PERSONA, ESTADOS, NO_CARGAR, fechaConMes, leerEvaluacionesPegadas, leerFecha, ordenDeCarga, planDeEvaluaciones } from "./importar.js";
import { ZONA_MEDIA } from "./tests/zonaMedia.js";

// Todo inventado: ningún nombre ni valor sale del Excel del club.
const plantel = [
  { id: 1, nombre: "ALFA" },
  { id: 2, nombre: "Beto Gómez" },
  // Dos que, sin acentos ni signos, se escriben igual: no se adivina.
  { id: 3, nombre: "Ñandú" },
  { id: 4, nombre: "Nandu" },
];

const HOY = "2026-10-05";

// Como se copia la hoja: arriba el informe, la fila de títulos repetida
// (con "Apellido"), la de títulos y las evaluaciones; columnas ocultas
// (las de ayuda para buscar) incluidas.
const pegado = (...filas) =>
  [
    "\t\t\tEvaluación de prueba",
    "\t\t\t\t\t\t\t\tPromedios\t2:00",
    "\t\t\tnº Eva\tFecha\tApellido\tSelección\tFecha Nac\tPosición\tLumbar",
    "x\ty\t\tnº Eva\tFecha\tJugador\tSeleccion\tFecha Nac\tPosición\tLumbar\tL. Clas\t% mejora\t\tLateral D\tL.D. Clas\t% mejora \tLateral I\tL.I. Clas\t % mejora\tA\tDeficit Lateral %\tDeficit. Clas\tProno\tP. Clas\t% mejora  \tRatio\tRatio. Clas\tVa\tPRO??\tNota",
    ...filas,
  ].join("\n");

// Una fila de la tabla: lo cargado a mano en su lugar y lo calculado con
// cualquier cosa (no se lee).
const fila = ({ fecha = "12/06/2026", jugador = "ALFA", seleccion = "Mayor", lumbar = "3:04", lateralD = "1:20", lateralI = "1:25", prono = "2:10", nota = "" } = {}) =>
  ["k1", "k2", "9", "1", fecha, jugador, seleccion, "01/01/2000", "Volante", lumbar, "5", "", "", lateralD, "4", "", lateralI, "3", "", "6,3", "6,3", "4", prono, "2", "", "0,71", "3", "1", "3,5", nota].join("\t");

const plan = (filas, extra = {}) => planDeEvaluaciones(filas, { test: ZONA_MEDIA, plantel, evaluaciones: [], hoy: HOY, anio: 2026, ...extra });

describe("pegar evaluaciones desde Excel", () => {
  it("lee las fechas como las muestra el Excel, con o sin año", () => {
    expect(fechaConMes("12-jun")).toEqual({ dia: 12, mes: 6, anio: null });
    expect(fechaConMes("3-sept-25")).toEqual({ dia: 3, mes: 9, anio: 2025 });
    expect(fechaConMes("7-out")).toEqual({ dia: 7, mes: 10, anio: null });
    expect(fechaConMes("12-xyz")).toBeUndefined();
    expect(fechaConMes("12/06/2026")).toBeUndefined();

    expect(leerFecha("12/06/2026", "dia_mes", 2020)).toEqual({ fecha: "2026-06-12", sinAnio: false });
    expect(leerFecha("12-jun", "dia_mes", 2025)).toEqual({ fecha: "2025-06-12", sinAnio: true });
    expect(leerFecha("29-feb", "dia_mes", 2025)).toEqual({ fecha: undefined, sinAnio: true });
    expect(leerFecha("", "dia_mes", 2025)).toEqual({ fecha: null, sinAnio: false });
    expect(leerFecha("mañana", "dia_mes", 2025)).toEqual({ fecha: undefined, sinAnio: false });
  });

  it("encuentra la fila de títulos aunque arriba venga el informe, y saltea las vacías y los títulos repetidos", () => {
    const leido = leerEvaluacionesPegadas(pegado(fila(), "\t\t\t\t\t\t", pegado().split("\n")[3], fila({ jugador: "Beto Gómez", nota: "molestia" })), ZONA_MEDIA);
    expect(leido.error).toBe("");
    expect(Object.keys(leido.columnas).sort()).toEqual(["fecha", "jugador", "lateral_d", "lateral_i", "lumbar", "nota", "prono", "seleccion"]);
    expect(leido.filas.map((una) => una.nombre)).toEqual(["ALFA", "Beto Gómez"]);
    expect(leido.filas[0].textos).toEqual({ fecha: "12/06/2026", jugador: "ALFA", seleccion: "Mayor", lumbar: "3:04", lateral_d: "1:20", lateral_i: "1:25", prono: "2:10", nota: "" });
    expect(leido.filas[1].textos.nota).toBe("molestia");
    // Cada fila sabe en qué renglón de lo pegado estaba (para cargarlas en ese orden).
    expect(leido.filas[0].indice).toBeLessThan(leido.filas[1].indice);
  });

  it("sin la fila de títulos o sin evaluaciones debajo, lo dice", () => {
    expect(leerEvaluacionesPegadas("ALFA\t3:04\nBETA\t2:00", ZONA_MEDIA).error).toBe("evaluaciones.importar.sinCabeceras");
    expect(leerEvaluacionesPegadas(pegado(), ZONA_MEDIA).error).toBe("evaluaciones.importar.sinFilas");
  });

  it("cada fila: el jugador de Datos básicos, la selección como código y los tiempos en segundos", () => {
    const { filas } = leerEvaluacionesPegadas(pegado(fila({ nota: "molestia" })), ZONA_MEDIA);
    const [una] = plan(filas);
    expect(una.estado).toBe(ESTADOS.nueva);
    expect(una.evaluacion).toEqual({
      jugador_id: 1,
      persona: null,
      fecha: "2026-06-12",
      datos: { seleccion: "mayor", lumbar: 184, lateral_d: 80, lateral_i: 85, prono: 130, nota: "molestia" },
    });
    expect(una.avisos).toEqual([]);
  });

  it("lo que no se entiende queda vacío, con su aviso", () => {
    const { filas } = leerEvaluacionesPegadas(pegado(fila({ seleccion: "Reserva", lumbar: "3:99", prono: "" })), ZONA_MEDIA);
    const [una] = plan(filas);
    expect(una.estado).toBe(ESTADOS.nueva);
    expect(una.evaluacion.datos).toEqual({ lateral_d: 80, lateral_i: 85 });
    expect(una.avisos).toEqual([
      { campo: "seleccion", valor: "Reserva" },
      { campo: "lumbar", valor: "3:99" },
    ]);
  });

  it("las fechas sin año van con el año elegido; una fecha mal escrita o posterior a hoy no se carga", () => {
    const { filas } = leerEvaluacionesPegadas(pegado(fila({ fecha: "12-jun" }), fila({ fecha: "31/02/2026", jugador: "Beto Gómez" }), fila({ fecha: "12/12/2026", lumbar: "1:00" })), ZONA_MEDIA);
    const [sinAnio, mal, futura] = plan(filas, { anio: 2024 });
    expect(sinAnio.sinAnio).toBe(true);
    expect(sinAnio.evaluacion.fecha).toBe("2024-06-12");
    expect(sinAnio.estado).toBe(ESTADOS.nueva);
    expect(mal.estado).toBe(ESTADOS.conProblemas);
    expect(mal.problemas).toEqual(["evaluaciones.importar.fechaMal"]);
    expect(futura.problemas).toEqual(["evaluaciones.importar.fechaFutura"]);
  });

  it("una que ya está en la app (la misma persona, el mismo día y los mismos tiempos) no se vuelve a cargar", () => {
    const evaluaciones = [{ id: "e1", jugador_id: 1, persona: null, fecha: "2026-06-12", datos: { lumbar: 184, lateral_d: 80, lateral_i: 85, prono: 130 } }];
    const { filas } = leerEvaluacionesPegadas(pegado(fila(), fila({ lumbar: "3:05" })), ZONA_MEDIA);
    const [igual, otra] = plan(filas, { evaluaciones });
    expect(igual.estado).toBe(ESTADOS.yaEsta);
    expect(otra.estado).toBe(ESTADOS.nueva);
  });

  it("la misma evaluación dos veces en lo pegado: la segunda no se carga", () => {
    const { filas } = leerEvaluacionesPegadas(pegado(fila(), fila()), ZONA_MEDIA);
    const [primera, segunda] = plan(filas);
    expect(primera.estado).toBe(ESTADOS.nueva);
    expect(segunda.estado).toBe(ESTADOS.conProblemas);
    expect(segunda.problemas).toEqual(["evaluaciones.importar.repetida"]);
  });

  it("un nombre que no está en Datos básicos se elige qué es: con ese nombre, un jugador de la lista o no va", () => {
    const { filas } = leerEvaluacionesPegadas(pegado(fila({ jugador: "Zeta Prueba" }), fila({ jugador: "Nandu!" }), fila({ jugador: "" })), ZONA_MEDIA);
    const [afuera, dudoso, sinNombre] = plan(filas);
    expect(afuera.estado).toBe(ESTADOS.sinJugador);
    expect(afuera.dudoso).toBe(false);
    // "Nandu!" se parece a dos jugadores: no se adivina cuál es.
    expect(dudoso.estado).toBe(ESTADOS.sinJugador);
    expect(dudoso.dudoso).toBe(true);
    expect(sinNombre.estado).toBe(ESTADOS.conProblemas);
    expect(sinNombre.problemas).toEqual(["evaluaciones.importar.sinNombre"]);

    const elegidos = { [afuera.indice]: COMO_PERSONA, [dudoso.indice]: "4" };
    const [comoPersona, elegido] = plan(filas, { elegidos });
    expect(comoPersona.estado).toBe(ESTADOS.nueva);
    expect(comoPersona.evaluacion).toMatchObject({ jugador_id: null, persona: "Zeta Prueba" });
    expect(elegido.estado).toBe(ESTADOS.nueva);
    expect(elegido.evaluacion).toMatchObject({ jugador_id: 4, persona: null });

    const [noVa] = plan(filas, { elegidos: { [afuera.indice]: NO_CARGAR } });
    expect(noVa.estado).toBe(ESTADOS.noVa);
  });

  it("alguien fuera de Datos básicos escrito de otra forma se guarda como ya está en la app", () => {
    const evaluaciones = [{ id: "e1", jugador_id: null, persona: "Zeta Prueba", fecha: "2026-01-10", datos: {} }];
    const { filas } = leerEvaluacionesPegadas(pegado(fila({ jugador: "zeta  prueba" })), ZONA_MEDIA);
    const [una] = plan(filas, { evaluaciones, elegidos: { [filas[0].indice]: COMO_PERSONA } });
    expect(una.estado).toBe(ESTADOS.nueva);
    expect(una.evaluacion.persona).toBe("Zeta Prueba");
  });

  it("se cargan en el orden del Excel", () => {
    const { filas } = leerEvaluacionesPegadas(pegado(fila({ fecha: "20/06/2026" }), fila({ jugador: "Beto Gómez", fecha: "01/06/2026" })), ZONA_MEDIA);
    const orden = ordenDeCarga(plan(filas));
    expect(orden.map((una) => una.nombre)).toEqual(["ALFA", "Beto Gómez"]);
  });
});
