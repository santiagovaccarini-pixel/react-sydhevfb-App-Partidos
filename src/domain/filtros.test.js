import { describe, expect, test } from "vitest";
import {
  FILTRO_EQUIPO,
  MODO_RESULTADO,
  PENALES,
  filtrarRegistros,
  rivalesDelHistorial,
} from "./filtros";

const partido = (fecha, rival, resultado, localia) => ({
  item: { fecha, rival, resultado, localia },
  index: 0,
});

// Cinco partidos: dos con Cruzeiro, y uno sin localía cargada, como los que
// vienen de antes de la migración.
const HISTORIAL = [
  partido("2026-09-08", "Cruzeiro", "2-1", "local"),
  partido("2026-09-01", "Palmeiras", "0-2", "visitante"),
  partido("2026-08-24", "Cruzeiro", "1-1", "visitante"),
  partido("2026-08-17", "Flamengo", "3-0", undefined),
  partido("2026-08-10", "Gremio", "", "local"),
  partido("2026-08-03", "Boca", "1-1", "neutral"),
  // Dos de copa: uno ganado en los penales y otro perdido.
  partido("2026-07-27", "River", "1-1 (4-3)", "neutral"),
  partido("2026-07-20", "Racing", "2-2 (3-5)", "local"),
];

const rivales = (opciones) =>
  filtrarRegistros(HISTORIAL, opciones).map((fila) => fila.item.rival);

describe("recortar los partidos del equipo", () => {
  test("sin filtro no recorta nada", () => {
    expect(
      filtrarRegistros(HISTORIAL, { filtro: FILTRO_EQUIPO.TODOS }),
    ).toHaveLength(8);
    expect(filtrarRegistros(HISTORIAL, {})).toHaveLength(8);
  });

  test("por rival deja los de ese equipo, sin importar cómo se escriba", () => {
    expect(rivales({ filtro: FILTRO_EQUIPO.RIVAL, rival: "Cruzeiro" })).toEqual(
      ["Cruzeiro", "Cruzeiro"],
    );
    expect(
      rivales({ filtro: FILTRO_EQUIPO.RIVAL, rival: "cruzeiro" }),
    ).toHaveLength(2);
    // Sin rival elegido todavía, no recorta.
    expect(rivales({ filtro: FILTRO_EQUIPO.RIVAL, rival: "" })).toHaveLength(8);
  });

  test("por fecha, cada punta es opcional", () => {
    expect(
      rivales({ filtro: FILTRO_EQUIPO.FECHA, desde: "2026-09-01" }),
    ).toEqual(["Cruzeiro", "Palmeiras"]);
    expect(
      rivales({ filtro: FILTRO_EQUIPO.FECHA, hasta: "2026-08-17" }),
    ).toEqual(["Flamengo", "Gremio", "Boca", "River", "Racing"]);
    // Las dos puntas entran.
    expect(
      rivales({
        filtro: FILTRO_EQUIPO.FECHA,
        desde: "2026-08-17",
        hasta: "2026-09-01",
      }),
    ).toEqual(["Palmeiras", "Cruzeiro", "Flamengo"]);
  });

  test("por cómo terminó, mirando siempre nuestros goles primero", () => {
    // El 0-2 es derrota aunque de visitante se muestre "2-0".
    expect(
      rivales({ filtro: FILTRO_EQUIPO.RESULTADO, modo: MODO_RESULTADO.GANADO }),
    ).toEqual(["Cruzeiro", "Flamengo"]);
    expect(
      rivales({
        filtro: FILTRO_EQUIPO.RESULTADO,
        modo: MODO_RESULTADO.PERDIDO,
      }),
    ).toEqual(["Palmeiras"]);
    expect(
      rivales({
        filtro: FILTRO_EQUIPO.RESULTADO,
        modo: MODO_RESULTADO.EMPATADO,
      }),
    ).toEqual(["Cruzeiro", "Boca"]);
  });

  test("el botón de penales decide si los de copa entran", () => {
    const porResultado = (modo, penales) =>
      rivales({ filtro: FILTRO_EQUIPO.RESULTADO, modo, penales });

    // Sin penales, los ganados son los de los 90 y nada más.
    expect(porResultado(MODO_RESULTADO.GANADO, PENALES.SIN)).toEqual([
      "Cruzeiro",
      "Flamengo",
    ]);
    // Con penales se suma el 1-1 (4-3) contra River.
    expect(porResultado(MODO_RESULTADO.GANADO, PENALES.CON)).toEqual([
      "Cruzeiro",
      "Flamengo",
      "River",
    ]);
    // Y en "solo penales" queda únicamente ese.
    expect(porResultado(MODO_RESULTADO.GANADO, PENALES.SOLO)).toEqual(["River"]);

    // Lo mismo del otro lado: el 2-2 (3-5) contra Racing.
    expect(porResultado(MODO_RESULTADO.PERDIDO, PENALES.SIN)).toEqual([
      "Palmeiras",
    ]);
    expect(porResultado(MODO_RESULTADO.PERDIDO, PENALES.CON)).toEqual([
      "Palmeiras",
      "Racing",
    ]);
    expect(porResultado(MODO_RESULTADO.PERDIDO, PENALES.SOLO)).toEqual([
      "Racing",
    ]);

    // Sin decir nada, se comporta como "sin penales".
    expect(
      rivales({ filtro: FILTRO_EQUIPO.RESULTADO, modo: MODO_RESULTADO.GANADO }),
    ).toEqual(["Cruzeiro", "Flamengo"]);
  });

  test("un partido definido por penales nunca es un empate", () => {
    // Terminó ganado o perdido: no ensucia la lista de empatados, con el botón
    // de penales en cualquiera de sus tres posiciones.
    [PENALES.SIN, PENALES.CON, PENALES.SOLO].forEach((penales) => {
      expect(
        rivales({
          filtro: FILTRO_EQUIPO.RESULTADO,
          modo: MODO_RESULTADO.EMPATADO,
          penales,
        }),
      ).toEqual(["Cruzeiro", "Boca"]);
    });
  });

  test("el marcador exacto ignora los penales", () => {
    // Escribiendo 1-1 tiene que salir también el que se definió por penales.
    expect(
      rivales({
        filtro: FILTRO_EQUIPO.RESULTADO,
        modo: MODO_RESULTADO.EXACTO,
        marcador: "1-1",
      }),
    ).toEqual(["Cruzeiro", "Boca", "River"]);
  });

  test("por marcador exacto", () => {
    expect(
      rivales({
        filtro: FILTRO_EQUIPO.RESULTADO,
        modo: MODO_RESULTADO.EXACTO,
        marcador: "2-1",
      }),
    ).toEqual(["Cruzeiro"]);
    // A medio escribir no vacía la pantalla.
    expect(
      rivales({
        filtro: FILTRO_EQUIPO.RESULTADO,
        modo: MODO_RESULTADO.EXACTO,
        marcador: "2-",
      }),
    ).toHaveLength(8);
  });

  test("por local, visitante o neutral, y lo viejo cuenta como local", () => {
    expect(
      rivales({ filtro: FILTRO_EQUIPO.LOCALIA, localia: "local" }),
    ).toEqual(["Cruzeiro", "Flamengo", "Gremio", "Racing"]);
    expect(
      rivales({ filtro: FILTRO_EQUIPO.LOCALIA, localia: "visitante" }),
    ).toEqual(["Palmeiras", "Cruzeiro"]);
    // La cancha neutral no se mezcla con ninguna de las otras dos.
    expect(
      rivales({ filtro: FILTRO_EQUIPO.LOCALIA, localia: "neutral" }),
    ).toEqual(["Boca", "River"]);
  });
});

describe("los rivales que pasaron por el historial", () => {
  test("cada uno una vez, en orden y con sus partidos", () => {
    expect(rivalesDelHistorial(HISTORIAL.map((fila) => fila.item))).toEqual([
      { nombre: "Boca", partidos: 1 },
      { nombre: "Cruzeiro", partidos: 2 },
      { nombre: "Flamengo", partidos: 1 },
      { nombre: "Gremio", partidos: 1 },
      { nombre: "Palmeiras", partidos: 1 },
      { nombre: "Racing", partidos: 1 },
      { nombre: "River", partidos: 1 },
    ]);
  });

  test("un partido sin rival cargado no inventa una fila vacía", () => {
    expect(rivalesDelHistorial([{ rival: "" }, { rival: "  " }, {}])).toEqual(
      [],
    );
  });
});
