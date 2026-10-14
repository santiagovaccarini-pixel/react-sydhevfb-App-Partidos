import { describe, expect, test } from "vitest";
import { cambiosDeEntrada, diferencias, iguales, normalizarEntrada } from "./referencias.js";

describe("los cambios de los V.R. (el historial con volver atrás)", () => {
  test("iguales sin importar el orden de las claves", () => {
    expect(iguales({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(iguales({ a: 1 }, { a: 1, b: null })).toBe(false);
    expect(iguales([1, 2], [1, 2])).toBe(true);
    expect(iguales(1, "1")).toBe(false);
  });

  test("un número cambiado, sumado o vaciado", () => {
    expect(diferencias({ promedio: { d: 1, t: 5 } }, { promedio: { d: 2, t: 5 } })).toEqual([{ ruta: ["promedio", "d"], antes: 1, despues: 2 }]);
    expect(diferencias({ promedio: {} }, { promedio: { d: 2 } })).toEqual([{ ruta: ["promedio", "d"], antes: null, despues: 2 }]);
    expect(diferencias({ promedio: { d: 2 } }, { promedio: {} })).toEqual([{ ruta: ["promedio", "d"], antes: 2, despues: null }]);
  });

  test("una categoría que se va o vuelve entera es un solo cambio", () => {
    const bloque = { bueno: { lumbar: 0.12 }, n: { lumbar: 29 } };
    expect(diferencias({ categorias: { mayor: bloque } }, { categorias: {} })).toEqual([{ ruta: ["categorias", "mayor"], antes: bloque, despues: null }]);
    expect(diferencias({ categorias: {} }, { categorias: { mayor: bloque } })).toEqual([{ ruta: ["categorias", "mayor"], antes: null, despues: bloque }]);
  });

  test("de una entrada editada, sin lo que pone la base", () => {
    const entrada = normalizarEntrada({
      id: 7,
      tabla: "gps_referencias",
      fila_id: "r1",
      accion: "editada",
      quien_email: "pf@club.com",
      cuando: "2026-10-14T19:30:00Z",
      antes: { id: "r1", equipo_id: "c", actualizado_en: "a", tabla: "FUTBOL 2", de_partido: false, promedio: { d: 1 } },
      despues: { id: "r1", equipo_id: "c", actualizado_en: "b", tabla: "FUTBOL 3", de_partido: true, promedio: { d: 1 } },
    });
    expect(entrada.quien).toBe("pf@club.com");
    expect(cambiosDeEntrada(entrada)).toEqual([
      { ruta: ["tabla"], antes: "FUTBOL 2", despues: "FUTBOL 3" },
      { ruta: ["de_partido"], antes: false, despues: true },
    ]);
  });

  test("creadas y borradas no tienen cambios sueltos; lo raro se normaliza", () => {
    expect(cambiosDeEntrada(normalizarEntrada({ accion: "creada", despues: { promedio: { d: 1 } } }))).toEqual([]);
    expect(normalizarEntrada({ accion: "otra", antes: [1], despues: "x" })).toMatchObject({ accion: "editada", antes: null, despues: null, quien: "" });
  });
});
