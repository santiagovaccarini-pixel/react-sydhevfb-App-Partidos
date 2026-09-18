import { describe, expect, test } from "vitest";
import {
  COMPARADOR,
  FILTRO,
  PAPEL,
  filtrarPartidosDeJugador,
  horaCorta,
  jugadoresDelHistorial,
  participacionEnPartido,
  partidosDeJugador,
  resumenDeJugador,
} from "./jugadores";

// El partido de referencia dura 5680 segundos: PT 21:00:00 → 21:47:30 y ST
// 22:03:00 → 22:50:10. ALONSO sale a los 23:14 del primero y SCARPA a los
// 15:00 del segundo; BERNARD y DUDU entran por ellos. ARANA y FRED se quedan
// en el banco.
const partido = (extra = {}) => ({
  inicioPT: "21:00:00",
  finalPT: "21:47:30",
  inicioST: "22:03:00",
  finalST: "22:50:10",
  varsPT: [],
  varsST: [],
  cambios: [
    { sale: "ALONSO", entra: "BERNARD", hora: "21:23:14", periodo: "PT" },
    { sale: "SCARPA", entra: "DUDU", hora: "22:18:00", periodo: "ST" },
  ],
  cambiosRival: [],
  formacion: {
    titulares: ["ALONSO", "SCARPA", "HULK"],
    convocados: ["BERNARD", "DUDU", "ARANA", "FRED"],
  },
  ...extra,
});

describe("qué hizo un jugador en un partido", () => {
  test("el titular que no salió jugó el partido entero", () => {
    expect(participacionEnPartido(partido(), "HULK")).toMatchObject({
      papel: PAPEL.COMPLETO,
      bruto: 5680,
    });
  });

  test("el titular que salió queda con su horario y sus minutos", () => {
    expect(participacionEnPartido(partido(), "ALONSO")).toMatchObject({
      papel: PAPEL.SALIO,
      salio: "21:23",
      bruto: 1394,
    });
  });

  test("el que entró desde el banco cuenta desde que entró", () => {
    // De 22:18:00 al final del partido.
    expect(participacionEnPartido(partido(), "DUDU")).toMatchObject({
      papel: PAPEL.ENTRO,
      entro: "22:18",
      bruto: 1930,
    });
  });

  test("el que fue al banco y no entró estuvo igual, con cero minutos", () => {
    // Es lo que pedía la pantalla: el partido es suyo aunque no haya jugado.
    expect(participacionEnPartido(partido(), "ARANA")).toEqual({
      papel: PAPEL.BANCO,
      entro: "",
      salio: "",
      bruto: 0,
      neto: 0,
    });
  });

  test("el que no estuvo en el partido no devuelve nada", () => {
    expect(participacionEnPartido(partido(), "CUELLO")).toBeNull();
    expect(participacionEnPartido(partido(), "")).toBeNull();
  });

  test("no distingue mayúsculas ni acentos", () => {
    expect(participacionEnPartido(partido(), "hulk")).toMatchObject({
      papel: PAPEL.COMPLETO,
    });
  });

  test("un partido sin formación cargada igual ubica al que figura en un cambio", () => {
    // Los registros viejos no tienen titulares: si el nombre aparece en un
    // cambio, el partido tiene que salir igual.
    const viejo = partido({ formacion: {} });

    expect(participacionEnPartido(viejo, "ALONSO")).toMatchObject({
      papel: PAPEL.SALIO,
    });
    expect(participacionEnPartido(viejo, "HULK")).toBeNull();
  });

  test("le descuenta al jugador solo las paradas que lo agarraron en cancha", () => {
    const conVar = partido({
      varsST: [{ inicio: "22:30:00", final: "22:32:00" }],
    });

    // SCARPA ya había salido a las 22:18: el VAR posterior no es suyo.
    expect(participacionEnPartido(conVar, "SCARPA")).toMatchObject({
      bruto: 3750,
      neto: 3750,
    });
    // DUDU estaba en cancha, así que pierde esos dos minutos.
    expect(participacionEnPartido(conVar, "DUDU")).toMatchObject({
      bruto: 1930,
      neto: 1810,
    });
  });
});

describe("los partidos de un jugador", () => {
  const historial = [
    partido(),
    // En el segundo miró el partido desde el banco: ni titular ni cambios.
    partido({
      cambios: [],
      formacion: { titulares: ["HULK"], convocados: ["ALONSO"] },
    }),
    { formacion: { titulares: ["CUELLO"], convocados: [] }, cambios: [] },
  ];

  test("devuelve solo los suyos, con el índice del registro original", () => {
    const suyos = partidosDeJugador(historial, "ALONSO");

    expect(suyos.map((fila) => fila.index)).toEqual([0, 1]);
    expect(suyos[1].participacion.papel).toBe(PAPEL.BANCO);
  });

  test("el resumen cuenta el banco como partido pero no como minutos", () => {
    const resumen = resumenDeJugador(partidosDeJugador(historial, "ALONSO"));

    expect(resumen).toMatchObject({
      partidos: 2,
      titular: 1,
      entro: 0,
      banco: 1,
      bruto: 1394,
    });
  });
});

describe("recortar los partidos de un jugador", () => {
  // Tres partidos suyos: uno entero (94:40), uno en el que salió (62:30) y uno
  // desde el banco sin entrar.
  const suyos = [
    { participacion: { papel: PAPEL.COMPLETO, bruto: 5680 } },
    { participacion: { papel: PAPEL.SALIO, bruto: 3750 } },
    { participacion: { papel: PAPEL.ENTRO, bruto: 1930 } },
    { participacion: { papel: PAPEL.BANCO, bruto: 0 } },
  ];

  const papeles = (filtro, opciones = {}) =>
    filtrarPartidosDeJugador(suyos, { filtro, ...opciones }).map(
      (fila) => fila.participacion.papel,
    );
  const porMinutos = (comparador, desde, hasta) =>
    papeles(FILTRO.MINUTOS, { comparador, desde, hasta });

  test("sin filtro no recorta nada", () => {
    expect(papeles(FILTRO.TODOS)).toHaveLength(4);
    expect(papeles(undefined)).toHaveLength(4);
  });

  test("titular junta al que jugó todo y al que salió", () => {
    expect(papeles(FILTRO.TITULAR)).toEqual([PAPEL.COMPLETO, PAPEL.SALIO]);
  });

  test("ingresó y no ingresó son cada uno el suyo", () => {
    expect(papeles(FILTRO.ENTRO)).toEqual([PAPEL.ENTRO]);
    expect(papeles(FILTRO.BANCO)).toEqual([PAPEL.BANCO]);
  });

  test("varios criterios a la vez se cumplen todos", () => {
    // Titular Y más de una hora: el que jugó todo (5680) entra, el que salió
    // (3750) también, el que ingresó no es titular.
    expect(
      papeles(undefined, {
        filtros: [FILTRO.TITULAR, FILTRO.MINUTOS],
        comparador: COMPARADOR.MAYOR,
        desde: "60",
      }),
    ).toEqual([PAPEL.COMPLETO, PAPEL.SALIO]);

    // Subiendo el piso queda sólo el que jugó el partido entero.
    expect(
      papeles(undefined, {
        filtros: [FILTRO.TITULAR, FILTRO.MINUTOS],
        comparador: COMPARADOR.MAYOR,
        desde: "90",
      }),
    ).toEqual([PAPEL.COMPLETO]);

    expect(papeles(undefined, { filtros: [] })).toHaveLength(4);
  });

  test("no salió deja sólo al que jugó el partido entero", () => {
    // Arrancó de titular y no lo cambiaron. No entra el que ingresó, ni el que
    // salió, ni el que miró desde el banco.
    expect(papeles(FILTRO.NO_SALIO)).toEqual([PAPEL.COMPLETO]);
  });

  test("mayor deja los que pasaron ese piso, sin contarlo", () => {
    // Los partidos duran 94:40, 62:30, 32:10 y 00:00.
    expect(porMinutos(COMPARADOR.MAYOR, 60)).toEqual([
      PAPEL.COMPLETO,
      PAPEL.SALIO,
    ]);
    expect(porMinutos(COMPARADOR.MAYOR, 90)).toEqual([PAPEL.COMPLETO]);
  });

  test("mayor o igual sí cuenta al que dio justo", () => {
    // El de 62:30 no llega a 63 pero sí a 62; el borde es lo que cambia.
    expect(porMinutos(COMPARADOR.MAYOR, 62.5)).toEqual([PAPEL.COMPLETO]);
    expect(porMinutos(COMPARADOR.MAYOR_IGUAL, 62.5)).toEqual([
      PAPEL.COMPLETO,
      PAPEL.SALIO,
    ]);
  });

  test("menor y menor o igual miran para el otro lado", () => {
    // El que no ingresó jugó cero, así que entra en cualquier techo.
    expect(porMinutos(COMPARADOR.MENOR, 62.5)).toEqual([
      PAPEL.ENTRO,
      PAPEL.BANCO,
    ]);
    expect(porMinutos(COMPARADOR.MENOR_IGUAL, 62.5)).toEqual([
      PAPEL.SALIO,
      PAPEL.ENTRO,
      PAPEL.BANCO,
    ]);
  });

  test("entre toma las dos puntas, incluidas por defecto", () => {
    expect(porMinutos(COMPARADOR.ENTRE, 30, 70)).toEqual([
      PAPEL.SALIO,
      PAPEL.ENTRO,
    ]);
  });

  test("cada punta del entre dice si se incluye o no", () => {
    // Minutos redondos, que es lo que se escribe: así las puntas caen justo
    // encima de un partido y se ve qué hace cada símbolo.
    const redondos = [
      { participacion: { papel: PAPEL.COMPLETO, bruto: 90 * 60 } },
      { participacion: { papel: PAPEL.SALIO, bruto: 60 * 60 } },
      { participacion: { papel: PAPEL.ENTRO, bruto: 30 * 60 } },
    ];
    const entre = (opciones) =>
      filtrarPartidosDeJugador(redondos, {
        filtro: FILTRO.MINUTOS,
        comparador: COMPARADOR.ENTRE,
        desde: 30,
        hasta: 60,
        ...opciones,
      }).map((fila) => fila.participacion.papel);

    expect(entre({})).toEqual([PAPEL.SALIO, PAPEL.ENTRO]);
    expect(entre({ desdeIgual: false })).toEqual([PAPEL.SALIO]);
    expect(entre({ hastaIgual: false })).toEqual([PAPEL.ENTRO]);
    expect(entre({ desdeIgual: false, hastaIgual: false })).toEqual([]);
  });

  test("entre con una sola casilla no filtra nada, porque no es un entre", () => {
    expect(porMinutos(COMPARADOR.ENTRE, 60, "")).toHaveLength(4);
    expect(porMinutos(COMPARADOR.ENTRE, "", 60)).toHaveLength(4);
  });

  test("entre al revés se respeta tal cual y no deja nada", () => {
    // Los símbolos están a la vista: dar vuelta los números por atrás
    // mostraría partidos que contradicen lo que dice la pantalla.
    expect(porMinutos(COMPARADOR.ENTRE, 70, 30)).toEqual([]);
  });

  test("un número a medio escribir no vacía la pantalla", () => {
    expect(porMinutos(COMPARADOR.MAYOR, "")).toHaveLength(4);
    expect(porMinutos(COMPARADOR.MAYOR, "pepe")).toHaveLength(4);
    expect(porMinutos(COMPARADOR.ENTRE, "", "")).toHaveLength(4);
  });

  test("el resumen se rehace sobre lo que quedó", () => {
    const recortado = filtrarPartidosDeJugador(suyos, {
      filtro: FILTRO.TITULAR,
    });

    expect(resumenDeJugador(recortado)).toMatchObject({
      partidos: 2,
      titular: 2,
      entro: 0,
      banco: 0,
      bruto: 9430,
    });
  });
});

describe("el plantel que pasó por el historial", () => {
  test("lista a cada uno una vez y cuenta sus partidos", () => {
    const historial = [
      partido(),
      { formacion: { titulares: ["HULK"] }, cambios: [] },
    ];

    expect(jugadoresDelHistorial(historial)).toEqual([
      { nombre: "ALONSO", partidos: 1 },
      { nombre: "ARANA", partidos: 1 },
      { nombre: "BERNARD", partidos: 1 },
      { nombre: "DUDU", partidos: 1 },
      { nombre: "FRED", partidos: 1 },
      { nombre: "HULK", partidos: 2 },
      { nombre: "SCARPA", partidos: 1 },
    ]);
  });

  test("un jugador que sale y entra en el mismo partido cuenta una sola vez", () => {
    const ida = {
      formacion: { titulares: ["HULK"], convocados: ["HULK"] },
      cambios: [{ sale: "HULK", entra: "ARANA", hora: "21:20:00" }],
    };

    expect(jugadoresDelHistorial([ida])).toEqual([
      { nombre: "ARANA", partidos: 1 },
      { nombre: "HULK", partidos: 1 },
    ]);
  });
});

describe("el horario del corte en la ficha del jugador", () => {
  test("saca los segundos de un horario pero no de un minuto de juego", () => {
    expect(horaCorta("22:18:04")).toBe("22:18");
    expect(horaCorta("62:15")).toBe("62:15");
    expect(horaCorta("")).toBe("");
  });
});
