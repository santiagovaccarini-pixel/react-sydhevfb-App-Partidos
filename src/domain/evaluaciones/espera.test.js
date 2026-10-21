import { describe, expect, test } from "vitest";
import { conBorrada, conCambio, conCreadas, conLoQueEspera, conReferencia, conValorEnRuta, esLocal, idsEnEspera, subirLaEspera } from "./espera.js";
import { conOtrosDatos } from "./importar.js";

// Paso 3 de «cargar sin señal y a la vez que otra persona» (Santiago, 21/10).
// Todo inventado.
const ev = (id, extra = {}) => ({ id, equipo_id: "eq-1", test: "zona_media", orden: 1, jugador_id: 1, persona: null, fecha: "2026-06-01", datos: { lumbar: 150 }, ...extra });

describe("lo que entra en la fila de espera", () => {
  test("una nueva tiene su id propio hasta que sube; lo que se le cambia queda en ella y, si se borra, sale", () => {
    let cola = conCreadas([], "zona_media", [{ jugador_id: 2, persona: null, fecha: "2026-06-02", datos: { lumbar: 160 } }]);
    const [nueva] = cola;
    expect(nueva).toMatchObject({ tipo: "crear", test: "zona_media", evaluacion: { jugador_id: 2, datos: { lumbar: 160 } } });
    expect(esLocal(nueva.id)).toBe(true);
    cola = conCambio(cola, { id: nueva.id, cambios: { "datos.lumbar": 170, "datos.lateral_d": 90 }, antes: { "datos.lumbar": 160, "datos.lateral_d": null } });
    expect(cola).toHaveLength(1);
    expect(cola[0].evaluacion.datos).toEqual({ lumbar: 170, lateral_d: 90 });
    expect(conBorrada(cola, nueva.id)).toEqual([]);
  });

  test("los cambios a una de la base se juntan; lo que se veía antes del primero queda", () => {
    let cola = conCambio([], { id: "e1", cambios: { "datos.lumbar": 160 }, antes: { "datos.lumbar": 150 } });
    cola = conCambio(cola, { id: "e1", cambios: { "datos.lumbar": 170, fecha: "2026-06-02" }, antes: { "datos.lumbar": 160, fecha: "2026-06-01" } });
    expect(cola).toEqual([{ tipo: "cambiar", id: "e1", cambios: { "datos.lumbar": 170, fecha: "2026-06-02" }, antes: { "datos.lumbar": 150, fecha: "2026-06-01" } }]);
    // Borrarla: los cambios que esperaban ya no hacen falta.
    expect(conBorrada(cola, "e1")).toEqual([{ tipo: "borrar", id: "e1" }]);
  });

  test("un valor de los V.R. cambiado dos veces en el mismo lugar: queda el último", () => {
    let cola = conReferencia([], { test: "zona_media", ruta: ["categorias", "mayor", "lumbar", "bueno"], valor: 1 });
    cola = conReferencia(cola, { test: "zona_media", ruta: ["categorias", "sub20"], valor: {} });
    cola = conReferencia(cola, { test: "zona_media", ruta: ["categorias", "mayor", "lumbar", "bueno"], valor: 2 });
    expect(cola.map((uno) => [uno.ruta.join("."), uno.valor])).toEqual([
      ["categorias.sub20", {}],
      ["categorias.mayor.lumbar.bueno", 2],
    ]);
    expect(conValorEnRuta({ categorias: { mayor: { lumbar: { bueno: 1 } } } }, ["categorias", "mayor", "lumbar", "bueno"], null)).toEqual({ categorias: { mayor: { lumbar: {} } } });
  });
});

describe("cómo se ve con lo que espera", () => {
  test("la copia con la cola encima: nuevas al final, cambiadas, borradas y V.R.; las que esperan, para pintarlas", () => {
    let cola = conCreadas([], "zona_media", [{ jugador_id: 3, persona: null, fecha: "2026-06-03", datos: { lumbar: 200 } }]);
    cola = conCambio(cola, { id: "e1", cambios: { "datos.lumbar": 155 }, antes: { "datos.lumbar": 150 } });
    cola = conBorrada(cola, "e2");
    cola = conReferencia(cola, { test: "zona_media", ruta: ["categorias", "mayor"], valor: { lumbar: { bueno: 1 } } });
    const { evaluaciones, referencias } = conLoQueEspera({ evaluaciones: [ev("e1"), ev("e2", { orden: 2 })], referencias: { zona_media: { categorias: {} } } }, cola);
    expect(evaluaciones.map((una) => [una.id === cola[0].id ? "nueva" : una.id, una.datos.lumbar, una.orden])).toEqual([
      ["e1", 155, 1],
      ["nueva", 200, 3],
    ]);
    expect(referencias.zona_media).toEqual({ categorias: { mayor: { lumbar: { bueno: 1 } } } });
    expect(idsEnEspera(cola)).toEqual(new Set([cola[0].id, "e1"]));
  });
});

describe("al volver la señal", () => {
  const llamadas = [];
  const funciones = (respuestas = {}) => ({
    guardar: async (equipoId, test, { evaluaciones, reemplazar }) => {
      llamadas.push(["guardar", test, evaluaciones.map((una) => una.jugador_id), Boolean(reemplazar)]);
      return respuestas.guardar || { evaluaciones, borradas: [], yaEstaban: 0, error: "" };
    },
    crear: async () => ({ error: "" }),
    cambiar: async (id, { cambios }) => {
      llamadas.push(["cambiar", id, cambios]);
      return (respuestas.cambiar || {})[id] || { evaluacion: {}, pisadas: [], error: "" };
    },
    actualizar: async (id, evaluacion) => {
      llamadas.push(["actualizar", id, evaluacion.datos]);
      return { evaluacion, error: "" };
    },
    borrar: async (id) => {
      llamadas.push(["borrar", id]);
      return (respuestas.borrar || {})[id] || { error: "" };
    },
    referencia: async (equipoId, test, ruta) => {
      llamadas.push(["referencia", test, ruta.join(".")]);
      return { datos: {}, error: "" };
    },
  });
  const esDeRed = (respuesta) => /Failed to fetch/.test(`${respuesta?.detalle || ""}`);
  const subir = (cola, { servidor = [], respuestas, conChocadas = false } = {}) => {
    llamadas.length = 0;
    return subirLaEspera(cola, { equipoId: "eq-1", servidor, funciones: funciones(respuestas), esDeRed, conChocadas, conOtrosDatos });
  };

  test("sube todo en orden: las nuevas del mismo test juntas; dice cuántas subieron y qué pisó", async () => {
    let cola = conCreadas([], "zona_media", [
      { jugador_id: 2, persona: null, fecha: "2026-06-02", datos: { lumbar: 160 } },
      { jugador_id: 3, persona: null, fecha: "2026-06-02", datos: { lumbar: 170 } },
    ]);
    cola = conCambio(cola, { id: "e1", cambios: { "datos.lumbar": 155 }, antes: { "datos.lumbar": 150 } });
    cola = conBorrada(cola, "e9");
    cola = conReferencia(cola, { test: "zona_media", ruta: ["categorias", "mayor"], valor: {} });
    const respuesta = await subir(cola, { respuestas: { cambiar: { e1: { evaluacion: {}, pisadas: [{ clave: "datos.lumbar", habia: 152 }], error: "" } } } });
    expect(llamadas).toEqual([
      ["guardar", "zona_media", [2, 3], false],
      ["cambiar", "e1", { "datos.lumbar": 155 }],
      ["borrar", "e9"],
      ["referencia", "zona_media", "categorias.mayor"],
    ]);
    expect(respuesta).toMatchObject({ subidos: 5, pisadas: [{ clave: "datos.lumbar", habia: 152, id: "e1" }], quedan: [], chocadas: [], cortado: false, errores: [] });
  });

  test("la que choca con otra del mismo jugador y día no sube: queda esperando para preguntar; las demás suben", async () => {
    const cola = conCreadas([], "zona_media", [
      { jugador_id: 1, persona: null, fecha: "2026-06-01", datos: { lumbar: 999 } },
      { jugador_id: 2, persona: null, fecha: "2026-06-01", datos: { lumbar: 160 } },
    ]);
    const respuesta = await subir(cola, { servidor: [ev("e1")] });
    expect(llamadas).toEqual([["guardar", "zona_media", [2], false]]);
    expect(respuesta.quedan).toEqual([{ ...cola[0], chocan: true }]);
    expect(respuesta.chocadas.map((una) => [una.id, una.existentes.map((otra) => otra.id)])).toEqual([[cola[0].id, ["e1"]]]);
    // Sola no se vuelve a intentar; cuando se pide, sí.
    expect((await subir(respuesta.quedan, { servidor: [ev("e1")] })).chocadas).toEqual([]);
    expect((await subir(respuesta.quedan, { servidor: [ev("e1")], conChocadas: true })).chocadas).toHaveLength(1);
  });

  test("igual en todo a una que ya está, no choca (la base no la repite)", async () => {
    const cola = conCreadas([], "zona_media", [{ jugador_id: 1, persona: null, fecha: "2026-06-01", datos: { lumbar: 150 } }]);
    expect(await subir(cola, { servidor: [ev("e1")] })).toMatchObject({ chocadas: [], quedan: [], subidos: 1 });
  });

  test("sin señal en el camino se corta y lo que falta queda; un error de la base no se reintenta; una que otro borró se cuenta", async () => {
    let cola = conCambio([], { id: "e1", cambios: { "datos.lumbar": 155 } });
    cola = conCambio(cola, { id: "e2", cambios: { "datos.lumbar": 156 } });
    cola = conBorrada(cola, "e3");
    cola = conBorrada(cola, "e4");
    const respuesta = await subir(cola, {
      respuestas: {
        cambiar: { e1: { borrada: true, error: "" }, e2: { error: "evaluaciones.error.sinPermiso" } },
        borrar: { e3: { error: "evaluaciones.error.noBorrar", detalle: "TypeError: Failed to fetch" } },
      },
    });
    expect(respuesta).toMatchObject({ subidos: 0, borradasPorOtra: 1, errores: ["evaluaciones.error.sinPermiso"], cortado: true });
    expect(respuesta.quedan).toEqual([
      { tipo: "borrar", id: "e3" },
      { tipo: "borrar", id: "e4" },
    ]);
  });

  test("sin la actualización de la base, el cambio va sobre la fila de la base", async () => {
    const cola = conCambio([], { id: "e1", cambios: { "datos.lumbar": 155 } });
    const respuesta = await subir(cola, { servidor: [ev("e1", { datos: { lumbar: 150, lateral_d: 90 } })], respuestas: { cambiar: { e1: { sinFuncion: true, error: "" } } } });
    expect(llamadas.at(-1)).toEqual(["actualizar", "e1", { lumbar: 155, lateral_d: 90 }]);
    expect(respuesta.subidos).toBe(1);
  });
});
