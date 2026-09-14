import { describe, expect, test } from "vitest";
import {
  FILTRO_EQUIPO,
  MODO_RESULTADO,
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
];

const rivales = (opciones) =>
  filtrarRegistros(HISTORIAL, opciones).map((fila) => fila.item.rival);

describe("recortar los partidos del equipo", () => {
  test("sin filtro no recorta nada", () => {
    expect(
      filtrarRegistros(HISTORIAL, { filtro: FILTRO_EQUIPO.TODOS }),
    ).toHaveLength(5);
    expect(filtrarRegistros(HISTORIAL, {})).toHaveLength(5);
  });

  test("por rival deja los de ese equipo, sin importar cómo se escriba", () => {
    expect(rivales({ filtro: FILTRO_EQUIPO.RIVAL, rival: "Cruzeiro" })).toEqual(
      ["Cruzeiro", "Cruzeiro"],
    );
    expect(
      rivales({ filtro: FILTRO_EQUIPO.RIVAL, rival: "cruzeiro" }),
    ).toHaveLength(2);
    // Sin rival elegido todavía, no recorta.
    expect(rivales({ filtro: FILTRO_EQUIPO.RIVAL, rival: "" })).toHaveLength(5);
  });

  test("por fecha, cada punta es opcional", () => {
    expect(
      rivales({ filtro: FILTRO_EQUIPO.FECHA, desde: "2026-09-01" }),
    ).toEqual(["Cruzeiro", "Palmeiras"]);
    expect(
      rivales({ filtro: FILTRO_EQUIPO.FECHA, hasta: "2026-08-17" }),
    ).toEqual(["Flamengo", "Gremio"]);
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
    ).toEqual(["Cruzeiro"]);
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
    ).toHaveLength(5);
  });

  test("por local o visitante, y lo viejo cuenta como local", () => {
    expect(
      rivales({ filtro: FILTRO_EQUIPO.LOCALIA, localia: "local" }),
    ).toEqual(["Cruzeiro", "Flamengo", "Gremio"]);
    expect(
      rivales({ filtro: FILTRO_EQUIPO.LOCALIA, localia: "visitante" }),
    ).toEqual(["Palmeiras", "Cruzeiro"]);
  });
});

describe("los rivales que pasaron por el historial", () => {
  test("cada uno una vez, en orden y con sus partidos", () => {
    expect(rivalesDelHistorial(HISTORIAL.map((fila) => fila.item))).toEqual([
      { nombre: "Cruzeiro", partidos: 2 },
      { nombre: "Flamengo", partidos: 1 },
      { nombre: "Gremio", partidos: 1 },
      { nombre: "Palmeiras", partidos: 1 },
    ]);
  });

  test("un partido sin rival cargado no inventa una fila vacía", () => {
    expect(rivalesDelHistorial([{ rival: "" }, { rival: "  " }, {}])).toEqual(
      [],
    );
  });
});
