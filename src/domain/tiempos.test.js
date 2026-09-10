import { describe, expect, test } from "vitest";
import {
  cambiosDelRival,
  formatearMinutosSegundos,
  cortesDePeriodo,
  lineaDeTiempo,
  resumenDeTiempos,
  tiempoJugado,
} from "./tiempos";

// El partido de referencia. Las cuentas esperadas están hechas a mano:
// PT 21:00:00 → 21:47:30 son 47:30, con un VAR de 02:30 y una hidratación de
// 02:00 adentro; ST 22:03:00 → 22:50:10 son 47:10, sin paradas.
const PARTIDO = {
  modoTiempo: "transmision",
  inicioPT: "21:00:00",
  finalPT: "21:47:30",
  inicioST: "22:03:00",
  finalST: "22:50:10",
  varsPT: [{ inicio: "21:12:00", final: "21:14:30" }],
  varsST: [],
  inicioHidratacionPT: "21:25:00",
  finalHidratacionPT: "21:27:00",
  cambios: [
    { sale: "ALONSO", entra: "BERNARD", hora: "21:23:14", periodo: "PT" },
    { sale: "SCARPA", entra: "DUDU", hora: "22:18:00", periodo: "ST" },
  ],
  cambiosRival: [],
  formacion: {
    titulares: [
      "ALONSO",
      "SCARPA",
      "ARANA",
      "HULK",
      "ZARACHO",
      "PAULINHO",
      "GUILHERME",
      "BATTAGLIA",
      "FUCHS",
      "MAURICIO",
    ],
    convocados: ["BERNARD", "DUDU"],
  },
};

const porNombre = (jugadores, nombre) =>
  jugadores.find((jugador) => jugador.nombre === nombre);

describe("tiempos del partido", () => {
  test("el segundo tiempo arranca donde terminó el primero, sin entretiempo", () => {
    const linea = lineaDeTiempo(PARTIDO);

    expect(linea.map((periodo) => periodo.tipo)).toEqual(["PT", "ST"]);
    expect(linea[0]).toMatchObject({ desde: 0, hasta: 2850 });
    // Entre 21:47:30 y 22:03:00 pasaron 15 minutos que no cuentan.
    expect(linea[1]).toMatchObject({ desde: 2850, hasta: 5680 });
  });

  test("bruto, neto y detenido de cada tiempo y del partido", () => {
    const { periodos, total } = resumenDeTiempos(PARTIDO);

    expect(periodos[0]).toMatchObject({ bruto: 2850, detenido: 270, neto: 2580 });
    expect(periodos[1]).toMatchObject({ bruto: 2830, detenido: 0, neto: 2830 });
    expect(total).toEqual({ bruto: 5680, detenido: 270, neto: 5410 });
  });

  test("a cada jugador se le descuenta solo lo que se detuvo con él en cancha", () => {
    const { jugadores, resto } = tiempoJugado(PARTIDO);

    // Salió antes de la hidratación, así que solo carga el VAR.
    expect(porNombre(jugadores, "ALONSO")).toMatchObject({
      bruto: 1394,
      neto: 1244,
      salio: "21:23:14",
    });

    // Entró después del VAR: le toca la hidratación y nada más.
    expect(porNombre(jugadores, "BERNARD")).toMatchObject({
      bruto: 4286,
      neto: 4166,
      entro: "21:23:14",
    });

    // Jugó todo el primero, así que carga las dos paradas.
    expect(porNombre(jugadores, "SCARPA")).toMatchObject({ bruto: 3750, neto: 3480 });

    // Entró en el segundo, donde no hubo ninguna: bruto y neto coinciden.
    expect(porNombre(jugadores, "DUDU")).toMatchObject({ bruto: 1930, neto: 1930 });

    // Y los ocho que jugaron el partido entero quedan resumidos.
    expect(resto).toEqual({ cantidad: 8, bruto: 5680, neto: 5410 });
  });

  test("solo lista a los que entraron o salieron, en orden de cambio", () => {
    const { jugadores } = tiempoJugado(PARTIDO);

    expect(jugadores.map((jugador) => jugador.nombre)).toEqual([
      "ALONSO",
      "BERNARD",
      "SCARPA",
      "DUDU",
    ]);
  });

  test("un jugador que entra y después sale suma solo su tramo", () => {
    const { jugadores } = tiempoJugado({
      ...PARTIDO,
      cambios: [
        { sale: "ALONSO", entra: "BERNARD", hora: "21:23:14", periodo: "PT" },
        { sale: "BERNARD", entra: "DUDU", hora: "22:18:00", periodo: "ST" },
      ],
    });

    // De 21:23:14 al final del PT son 24:16, más 15:00 del ST: 39:16.
    expect(porNombre(jugadores, "BERNARD")).toMatchObject({
      bruto: 2356,
      neto: 2236,
      entro: "21:23:14",
      salio: "22:18:00",
    });
  });

  test("un partido que cruza la medianoche no descoloca las cuentas", () => {
    const { total } = resumenDeTiempos({
      ...PARTIDO,
      inicioPT: "23:30:00",
      finalPT: "00:17:30",
      inicioST: "00:33:00",
      finalST: "01:20:10",
      varsPT: [{ inicio: "23:42:00", final: "23:44:30" }],
      inicioHidratacionPT: "23:55:00",
      finalHidratacionPT: "23:57:00",
    });

    expect(total).toEqual({ bruto: 5680, detenido: 270, neto: 5410 });
  });

  test("un cambio sin período anotado se ubica por su horario", () => {
    // Las columnas de la base guardan el horario pero no el período. Sin
    // deducirlo, un cambio del segundo tiempo caía en la lista del primero.
    const sinPeriodo = {
      ...PARTIDO,
      cambios: [
        { sale: "ALONSO", entra: "BERNARD", hora: "21:23:14" },
        { sale: "SCARPA", entra: "DUDU", hora: "22:18:00" },
      ],
    };

    expect(
      cortesDePeriodo(sinPeriodo, "PT").filter((c) => c.clase === "cambio"),
    ).toHaveLength(1);
    expect(
      cortesDePeriodo(sinPeriodo, "ST").filter((c) => c.clase === "cambio"),
    ).toHaveLength(1);

    // Y las cuentas dan lo mismo que con el período anotado.
    const { jugadores } = tiempoJugado(sinPeriodo);
    expect(porNombre(jugadores, "DUDU")).toMatchObject({ bruto: 1930 });
    expect(porNombre(jugadores, "SCARPA")).toMatchObject({ bruto: 3750 });
  });

  test("un cambio hecho en el entretiempo queda en el tiempo que terminó", () => {
    const { jugadores } = tiempoJugado({
      ...PARTIDO,
      cambios: [{ sale: "ALONSO", entra: "BERNARD", hora: "21:55:00" }],
    });

    // 21:55 cae entre el final del PT y el inicio del ST: se toma el final
    // del primero, así que ALONSO jugó los 47:30 completos.
    expect(porNombre(jugadores, "ALONSO")).toMatchObject({ bruto: 2850 });
    expect(porNombre(jugadores, "BERNARD")).toMatchObject({ bruto: 2830 });
  });

  test("los cortes de un tiempo salen en orden de horario", () => {
    const cortes = cortesDePeriodo(PARTIDO, "PT");

    expect(cortes.map((corte) => corte.clase)).toEqual([
      "inicio",
      "var",
      "cambio",
      "hidratacion",
      "final",
    ]);
    expect(cortes.map((corte) => corte.hora)).toEqual([
      "21:00:00",
      "21:12:00",
      "21:23:14",
      "21:25:00",
      "21:47:30",
    ]);
  });

  test("la línea del rival mantiene los hitos y cambia solo los cambios", () => {
    const registro = {
      ...PARTIDO,
      cambiosRival: [
        { sale: "JOAO PAULO", entra: "GIL", hora: "21:35:00", periodo: "PT" },
      ],
    };

    const nuestra = cortesDePeriodo(registro, "PT");
    const suya = cortesDePeriodo(registro, "PT", "cambiosRival");

    // El arranque, el VAR, la hidratación y el final son del partido: iguales.
    const hitos = (cortes) =>
      cortes.filter((c) => c.clase !== "cambio").map((c) => c.hora);
    expect(hitos(suya)).toEqual(hitos(nuestra));

    // Lo único distinto es de quién es el cambio, y queda en su horario.
    const cambio = suya.find((c) => c.clase === "cambio");
    expect(cambio).toMatchObject({ hora: "21:35:00" });
    expect(cambio.pares).toEqual([{ sale: "JOAO PAULO", entra: "GIL" }]);
    expect(suya.map((c) => c.clase)).toEqual([
      "inicio",
      "var",
      "hidratacion",
      "cambio",
      "final",
    ]);
  });

  test("dos cambios en el mismo horario quedan bajo un solo corte", () => {
    const cortes = cortesDePeriodo(
      {
        ...PARTIDO,
        cambios: [
          { sale: "SCARPA", entra: "DUDU", hora: "22:18:00", periodo: "ST" },
          { sale: "ZARACHO", entra: "PAULINHO", hora: "22:18:00", periodo: "ST" },
        ],
      },
      "ST",
    );

    const cambios = cortes.filter((corte) => corte.clase === "cambio");
    expect(cambios).toHaveLength(1);
    expect(cambios[0].pares).toEqual([
      { sale: "SCARPA", entra: "DUDU" },
      { sale: "ZARACHO", entra: "PAULINHO" },
    ]);
  });

  test("una parada sin cerrar se muestra igual, aunque no se pueda medir", () => {
    const registro = { ...PARTIDO, varsPT: [{ inicio: "21:12:00", final: "" }] };

    const var1 = cortesDePeriodo(registro, "PT").find((c) => c.clase === "var");
    expect(var1).toMatchObject({ hora: "21:12:00", duracion: null });

    // Pero no se le resta nada al neto: no hay nada que restar.
    expect(resumenDeTiempos(registro).periodos[0]).toMatchObject({
      detenido: 120,
      neto: 2730,
    });
  });

  test("los cambios del rival vienen agrupados y con su tiempo", () => {
    const rival = cambiosDelRival({
      ...PARTIDO,
      cambiosRival: [
        { sale: "SOTELDO", entra: "M. LEONARDO", hora: "22:10:00", periodo: "ST" },
        { sale: "JOÃO PAULO", entra: "GIL", hora: "21:35:00", periodo: "PT" },
        { sale: "LUCAS LIMA", entra: "ANGELO", hora: "22:10:00", periodo: "ST" },
      ],
    });

    expect(rival).toHaveLength(2);
    expect(rival[0]).toMatchObject({ hora: "21:35:00", periodo: "PT" });
    expect(rival[1]).toMatchObject({ hora: "22:10:00", periodo: "ST" });
    expect(rival[1].pares).toHaveLength(2);
  });

  test("sin formación cargada, el que sale igual cuenta desde el arranque", () => {
    const { jugadores } = tiempoJugado({
      ...PARTIDO,
      formacion: { titulares: [], convocados: [] },
    });

    expect(porNombre(jugadores, "ALONSO")).toMatchObject({ bruto: 1394 });
  });

  test("las duraciones se leen en minutos, sin pasar a horas", () => {
    // Un partido entero son 94:40, no 01:34:40.
    expect(formatearMinutosSegundos(5680)).toBe("94:40");
    expect(formatearMinutosSegundos(2850)).toBe("47:30");
    expect(formatearMinutosSegundos(270)).toBe("04:30");
    expect(formatearMinutosSegundos(null)).toBe("");
  });

  test("un registro sin tiempos cargados no rompe nada", () => {
    expect(resumenDeTiempos({}).total).toEqual({ bruto: 0, detenido: 0, neto: 0 });
    expect(tiempoJugado({})).toEqual({ jugadores: [], resto: null });
    expect(cortesDePeriodo({}, "PT")).toEqual([]);
  });
});
