import { describe, expect, test } from "vitest";
import {
  LOCALIA,
  RESULTADO,
  comoTermino,
  enOrdenDeCancha,
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

describe("de local o de visitante", () => {
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
    // Cualquier otra cosa cae en local, que es el caso de siempre.
    expect(leerLocalia("cualquiera")).toBe(LOCALIA.LOCAL);
  });

  test("el botón alterna entre los dos", () => {
    expect(otraLocalia(LOCALIA.LOCAL)).toBe(LOCALIA.VISITANTE);
    expect(otraLocalia(LOCALIA.VISITANTE)).toBe(LOCALIA.LOCAL);
    expect(etiquetaLocalia(LOCALIA.VISITANTE)).toBe("Visitante");
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
    // El mismo 2-1 es victoria jugando de local y de visitante.
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
