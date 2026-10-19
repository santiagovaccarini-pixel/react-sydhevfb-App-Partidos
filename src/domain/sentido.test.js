import { describe, expect, test } from "vitest";
import {
  CAMPOS_CON_SENTIDO_LESIONES,
  COLUMNAS_CON_SENTIDO_DATOS,
  MAS_ES_MEJOR,
  MENOS_ES_MEJOR,
  conSentidoEvaluaciones,
  conSentidoGps,
  faltaSentido,
  sentidoDe,
  sentidoGuardado,
  sentidoPorDefecto,
} from "./sentido.js";
import { COLUMNAS_GPS, columnaGps } from "./gps/columnas.js";

describe("«Más es mejor» o «Menos es mejor» de cada medida", () => {
  test("se guarda solo uno de los dos; lo demás es vacío (lo de la app)", () => {
    expect(sentidoGuardado("mas")).toBe(MAS_ES_MEJOR);
    expect(sentidoGuardado("menos")).toBe(MENOS_ES_MEJOR);
    expect(sentidoGuardado("x")).toBe(null);
    expect(sentidoGuardado(null)).toBe(null);
  });

  test("lo de la app: más es mejor, salvo los déficits (como sus clases)", () => {
    expect(sentidoPorDefecto("d")).toBe(MAS_ES_MEJOR);
    expect(sentidoPorDefecto("lumbar")).toBe(MAS_ES_MEJOR);
    ["deficit", "def_lat", "ad_deficit", "curl_def_max", "altura_deficit"].forEach((clave) => expect(sentidoPorDefecto(clave)).toBe(MENOS_ES_MEJOR));
    // Que diga «def» en otra palabra no lo hace déficit.
    expect(sentidoPorDefecto("defensa")).toBe(MAS_ES_MEJOR);
    expect(sentidoDe("menos", "d")).toBe(MENOS_ES_MEJOR);
    expect(sentidoDe(null, "deficit")).toBe(MENOS_ES_MEJOR);
    expect(sentidoDe("mas", "deficit")).toBe(MAS_ES_MEJOR);
  });

  test("GPS: las medidas, sus por minuto y los tiempos; no las listas, las horas ni las fijas", () => {
    expect(conSentidoGps(columnaGps("d"))).toBe(true);
    expect(conSentidoGps(columnaGps("d_min"))).toBe(true);
    expect(conSentidoGps(columnaGps("tiempo"))).toBe(true);
    expect(conSentidoGps(columnaGps("pse"))).toBe(true);
    expect(conSentidoGps(columnaGps("microciclo"))).toBe(false);
    expect(conSentidoGps(columnaGps("jugador"))).toBe(false);
    expect(conSentidoGps(columnaGps("inicio"))).toBe(false);
    expect(conSentidoGps(columnaGps("dispositivo"))).toBe(false);
    expect(conSentidoGps({ clave: "propia_sprints", tipo: "numero", propia: true })).toBe(true);
    expect(conSentidoGps({ clave: "propia_notas", tipo: "texto", propia: true })).toBe(false);
    expect(COLUMNAS_GPS.filter(conSentidoGps).every((columna) => ["numero", "porMinuto", "tiempo"].includes(columna.tipo))).toBe(true);
  });

  test("Evaluaciones: lo que se carga con números o tiempos y lo calculado que tiene V.R.", () => {
    const test_ = { metricas: [{ clave: "rel" }, { clave: "deficit" }] };
    expect(conSentidoEvaluaciones(test_, { clave: "kg", tipo: "numero" })).toBe(true);
    expect(conSentidoEvaluaciones(test_, { clave: "lumbar", tipo: "tiempo" })).toBe(true);
    expect(conSentidoEvaluaciones(test_, { clave: "deficit", tipo: "calculado" })).toBe(true);
    expect(conSentidoEvaluaciones(test_, { clave: "deficit_clas", tipo: "calculado" })).toBe(false);
    expect(conSentidoEvaluaciones(test_, { clave: "seleccion", tipo: "lista" })).toBe(false);
    expect(conSentidoEvaluaciones(test_, { clave: "numero", tipo: "calculado", fija: true })).toBe(false);
  });

  test("Lesiones y Datos básicos: las de números", () => {
    expect(CAMPOS_CON_SENTIDO_LESIONES).toEqual(["edad", "horas_imagen", "recup_1", "recup_2", "recuperacion"]);
    expect(COLUMNAS_CON_SENTIDO_DATOS).toEqual(["edad", "horas_previas"]);
  });

  test("sin la columna en la base (antes de 20261107) se reconoce el error", () => {
    expect(faltaSentido({ code: "42703", message: "column gps_campos.sentido does not exist" })).toBe(true);
    expect(faltaSentido({ code: "PGRST204", message: "Could not find the 'sentido' column of 'gps_campos' in the schema cache" })).toBe(true);
    expect(faltaSentido({ code: "42P01", message: 'relation "public.gps_campos" does not exist' })).toBe(false);
    expect(faltaSentido(null)).toBe(false);
  });
});
