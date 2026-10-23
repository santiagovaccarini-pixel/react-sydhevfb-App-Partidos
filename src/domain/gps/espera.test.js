import { describe, expect, test } from "vitest";
import { conBorradas, conCambio, conLoHechoMientras, conLoQueEspera, conLosCambios, idsEnEspera, subirLaEspera } from "./espera.js";

// Paso 3c.1 de «cargar sin señal y a la vez que otra persona» (Santiago,
// 23/10). Todo inventado.
const fila = (id, datos = {}, extra = {}) => ({ id, equipo_id: "eq-1", orden: 1, fecha: "2026-06-01", jugador_id: 7, persona: null, promedio: null, datos: { dispositivo: "catapult", tiempo: 3600, d: 6000, d_min: 100, ...datos }, ...extra });

describe("lo que entra en la fila de espera", () => {
  test("los cambios a una fila se juntan; lo que se veía antes del primero queda", () => {
    let cola = conCambio([], { id: "g1", cambios: { "datos.d": 6600 }, antes: { "datos.d": 6000 } });
    cola = conCambio(cola, { id: "g1", cambios: { "datos.d": 7200, fecha: "2026-06-02" }, antes: { "datos.d": 6600, fecha: "2026-06-01" } });
    expect(cola).toEqual([{ tipo: "cambiar", id: "g1", cambios: { "datos.d": 7200, fecha: "2026-06-02" }, antes: { "datos.d": 6000, fecha: "2026-06-01" } }]);
  });

  test("borrar varias: lo que esperaba para ellas sale; una ya borrada no se repite", () => {
    let cola = conCambio([], { id: "g1", cambios: { "datos.d": 6600 } });
    cola = conCambio(cola, { id: "g2", cambios: { "datos.d": 6700 } });
    cola = conBorradas(cola, ["g1", "g3"]);
    cola = conBorradas(cola, ["g3"]);
    expect(cola).toEqual([
      { tipo: "cambiar", id: "g2", cambios: { "datos.d": 6700 }, antes: {} },
      { tipo: "borrar", id: "g1" },
      { tipo: "borrar", id: "g3" },
    ]);
  });
});

describe("cómo se ve con lo que espera", () => {
  test("lo cambiado, con su «por minuto» recalculado (y todos si cambió el Tiempo); lo borrado no está", () => {
    expect(conLosCambios(fila("g1"), { "datos.d": 7200 }).datos).toMatchObject({ d: 7200, d_min: 120 });
    expect(conLosCambios(fila("g1"), { "datos.tiempo": 1800 }).datos).toMatchObject({ tiempo: 1800, d_min: 200 });
    expect(conLosCambios(fila("g1"), { "datos.d": null, promedio: "equipo" })).toMatchObject({ promedio: "equipo", datos: { tiempo: 3600 } });
    let cola = conCambio([], { id: "g1", cambios: { "datos.d": 7200 } });
    cola = conBorradas(cola, ["g2"]);
    const filas = [fila("g1"), fila("g2"), fila("g3")];
    const vistas = conLoQueEspera(filas, cola);
    expect(vistas.map((una) => [una.id, una.datos.d])).toEqual([
      ["g1", 7200],
      ["g3", 6000],
    ]);
    expect(conLoQueEspera(vistas, cola)).toEqual(vistas);
    // Sin nada esperando, las mismas filas.
    expect(conLoQueEspera(filas, [])).toBe(filas);
    expect(idsEnEspera(cola)).toEqual(new Set(["g1"]));
  });
});

describe("al volver la señal", () => {
  const llamadas = [];
  const funciones = (respuestas = {}) => ({
    cambiar: async (id, { cambios }) => {
      llamadas.push(["cambiar", id, cambios]);
      return (respuestas.cambiar || {})[id] || { fila: { id, devuelta: true }, pisadas: [], error: "" };
    },
    actualizar: async (id, una) => {
      llamadas.push(["actualizar", id, una.datos]);
      return { fila: una, error: "" };
    },
    borrar: async (ids) => {
      llamadas.push(["borrar", ids]);
      return respuestas.borrar || { borradas: ids, error: "" };
    },
  });
  const esDeRed = (respuesta) => /Failed to fetch/.test(`${respuesta?.detalle || ""}`);
  const subir = (cola, { respuestas, filaDe } = {}) => {
    llamadas.length = 0;
    return subirLaEspera(cola, { funciones: funciones(respuestas), filaDe, esDeRed });
  };

  test("sube todo en orden: los borrados seguidos, juntos; dice cuántos subieron y qué pisó", async () => {
    let cola = conCambio([], { id: "g1", cambios: { "datos.d": 7200 }, antes: { "datos.d": 6000 } });
    cola = conBorradas(cola, ["g2", "g3"]);
    cola = conCambio(cola, { id: "g4", cambios: { "datos.d": 5000 }, antes: { "datos.d": 4000 } });
    const respuesta = await subir(cola, { respuestas: { cambiar: { g4: { fila: {}, pisadas: [{ clave: "datos.d", habia: 4500 }], error: "" } } } });
    expect(llamadas).toEqual([
      ["cambiar", "g1", { "datos.d": 7200 }],
      ["borrar", ["g2", "g3"]],
      ["cambiar", "g4", { "datos.d": 5000 }],
    ]);
    expect(respuesta).toMatchObject({ subidos: 4, pisadas: [{ clave: "datos.d", habia: 4500, id: "g4" }], quedan: [], errores: [], cortado: false });
    // Para que la pantalla no espere a ponerse al día.
    expect(respuesta.devueltas).toEqual([{ id: "g1", devuelta: true }]);
    expect(respuesta.borradas).toEqual(["g2", "g3"]);
  });

  test("sin señal en el camino se corta y lo que falta queda; un error de la base no se reintenta; una que otro borró se cuenta", async () => {
    let cola = conCambio([], { id: "g1", cambios: { "datos.d": 7200 } });
    cola = conCambio(cola, { id: "g2", cambios: { "datos.d": 7300 } });
    cola = conBorradas(cola, ["g3"]);
    cola = conCambio(cola, { id: "g4", cambios: { "datos.d": 7400 } });
    const respuesta = await subir(cola, {
      respuestas: {
        cambiar: { g1: { borrada: true, error: "" }, g2: { error: "gps.error.sinPermiso" } },
        borrar: { borradas: [], error: "gps.error.noBorrar", detalle: "TypeError: Failed to fetch" },
      },
    });
    expect(respuesta).toMatchObject({ subidos: 0, borradasPorOtra: 1, errores: [{ error: "gps.error.sinPermiso", ids: ["g2"] }], cortado: true });
    expect(respuesta.quedan).toEqual([cola[2], cola[3]]);
  });

  test("sin la actualización de la base, el cambio va sobre la fila entera", async () => {
    const cola = conCambio([], { id: "g1", cambios: { "datos.d": 7200 } });
    const respuesta = await subir(cola, { respuestas: { cambiar: { g1: { sinFuncion: true, error: "" } } }, filaDe: (id) => fila(id) });
    expect(llamadas.at(-1)).toEqual(["actualizar", "g1", expect.objectContaining({ d: 7200, d_min: 120 })]);
    expect(respuesta.subidos).toBe(1);
  });

  test("lo que se hizo mientras subía queda; lo subido sale", async () => {
    const enviada = conBorradas(conCambio([], { id: "g1", cambios: { "datos.d": 7200 } }), ["g2"]);
    const respuesta = await subir(enviada);
    const ahora = conCambio(enviada, { id: "g5", cambios: { "datos.d": 1 } });
    expect(conLoHechoMientras(ahora, { enviada, ...respuesta })).toEqual([{ tipo: "cambiar", id: "g5", cambios: { "datos.d": 1 }, antes: {} }]);
  });
});
