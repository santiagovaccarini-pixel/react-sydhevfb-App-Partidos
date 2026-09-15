import { describe, expect, test } from "vitest";
import {
  LOCALIA,
  LOCALIAS,
  RESULTADO,
  comoTermino,
  enOrdenDeCancha,
  esNeutral,
  esVisitante,
  etiquetaLocalia,
  golesDelRegistro,
  golesEnPantalla,
  leerLocalia,
  marcadorEnPantalla,
  otraLocalia,
} from "./localia";

const local = { localia: LOCALIA.LOCAL, resultado: "2-1" };
const visitante = { localia: LOCALIA.VISITANTE, resultado: "0-2" };
const neutral = { localia: LOCALIA.NEUTRAL, resultado: "1-3" };

describe("de local, de visitante o en cancha neutral", () => {
  test("lo que no dice nada es local", () => {
    // Todo lo cargado antes de que esto existiera no tiene el dato.
    expect(leerLocalia(undefined)).toBe(LOCALIA.LOCAL);
    expect(leerLocalia("")).toBe(LOCALIA.LOCAL);
    expect(esVisitante({})).toBe(false);
    expect(esVisitante(null)).toBe(false);
  });

  test("lee el dato sin importar cómo venga escrito", () => {
    expect(leerLocalia(" VISITANTE ")).toBe(LOCALIA.VISITANTE);
    expect(leerLocalia("Local")).toBe(LOCALIA.LOCAL);
    expect(leerLocalia(" Neutral ")).toBe(LOCALIA.NEUTRAL);
    // Cualquier otra cosa cae en local, que es el caso de siempre.
    expect(leerLocalia("cualquiera")).toBe(LOCALIA.LOCAL);
  });

  test("el botón da la vuelta por las tres y vuelve a empezar", () => {
    expect(otraLocalia(LOCALIA.LOCAL)).toBe(LOCALIA.VISITANTE);
    expect(otraLocalia(LOCALIA.VISITANTE)).toBe(LOCALIA.NEUTRAL);
    expect(otraLocalia(LOCALIA.NEUTRAL)).toBe(LOCALIA.LOCAL);
    // Y desde un partido viejo, que no trae el dato, arranca igual.
    expect(otraLocalia(undefined)).toBe(LOCALIA.VISITANTE);
  });

  test("cada una con su nombre", () => {
    expect(LOCALIAS.map(etiquetaLocalia)).toEqual([
      "Local",
      "Visitante",
      "Neutral",
    ]);
  });

  test("neutral no es visitante", () => {
    // Importa porque el vuelco de escudos y goles cuelga de esVisitante.
    expect(esVisitante(neutral)).toBe(false);
    expect(esNeutral(neutral)).toBe(true);
    expect(esNeutral(local)).toBe(false);
  });
});

describe("el orden en que se muestra el partido", () => {
  test("de local vamos primero; de visitante, el rival", () => {
    expect(enOrdenDeCancha(local, "NOSOTROS", "ELLOS")).toEqual([
      "NOSOTROS",
      "ELLOS",
    ]);
    expect(enOrdenDeCancha(visitante, "NOSOTROS", "ELLOS")).toEqual([
      "ELLOS",
      "NOSOTROS",
    ]);
  });

  test("en cancha neutral no hay local: queda el orden de siempre", () => {
    expect(enOrdenDeCancha(neutral, "NOSOTROS", "ELLOS")).toEqual([
      "NOSOTROS",
      "ELLOS",
    ]);
    // Y el marcador no se da vuelta: se lee como está guardado.
    expect(marcadorEnPantalla(neutral.resultado, neutral)).toBe("1-3");
    expect(golesEnPantalla(neutral.resultado, neutral)).toEqual(["1", "3"]);
  });

  test("el marcador sigue a los escudos", () => {
    // Guardado hay un 0-2 nuestro; de visitante se lee "2-0" porque adelante
    // va el local, que en ese partido es el rival.
    expect(golesDelRegistro(visitante.resultado)).toEqual(["0", "2"]);
    expect(golesEnPantalla(visitante.resultado, visitante)).toEqual(["2", "0"]);
    expect(marcadorEnPantalla(visitante.resultado, visitante)).toBe("2-0");

    expect(marcadorEnPantalla(local.resultado, local)).toBe("2-1");
  });

  test("un partido sin resultado no inventa un cero a cero", () => {
    expect(marcadorEnPantalla("", local)).toBe("");
    expect(marcadorEnPantalla(null, visitante)).toBe("");
  });

  test("separa el marcador escrito con guion, raya o dos puntos", () => {
    expect(golesDelRegistro("3 – 1")).toEqual(["3", "1"]);
    expect(golesDelRegistro("3:1")).toEqual(["3", "1"]);
  });
});

describe("cómo terminó el partido", () => {
  test("se mira contra lo guardado, no contra la localía", () => {
    // El mismo 2-1 es victoria de local, de visitante y en cancha neutral.
    expect(comoTermino("2-1")).toBe(RESULTADO.GANADO);
    expect(comoTermino("1-1")).toBe(RESULTADO.EMPATADO);
    expect(comoTermino("0-2")).toBe(RESULTADO.PERDIDO);
  });

  test("sin marcador cargado no dice nada", () => {
    expect(comoTermino("")).toBeNull();
    expect(comoTermino("2")).toBeNull();
    expect(comoTermino("a-b")).toBeNull();
  });
});
