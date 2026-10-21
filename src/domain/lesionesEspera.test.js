import { describe, expect, test } from "vitest";
import { conBorrada, conCambio, conCreadas, conLoHechoMientras, conLoQueEspera, esLocal, idsEnEspera, numerosDeCaso, subirLaEspera } from "./lesionesEspera.js";
import { cambiosDeLaLesion } from "./lesionesDb.js";

// Paso 3b de «cargar sin señal y a la vez que otra persona» (Santiago, 21/10).
// Todo inventado.
const lesion = (id, extra = {}) => ({
  id,
  equipo_id: "eq-1",
  jugador_id: 7,
  persona: null,
  numero_caso: 1,
  fecha_lesion: "2026-06-01",
  fecha_transicion: null,
  fecha_retorno_entrenamiento: null,
  fecha_alta: null,
  datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "muscular_1a" },
  ...extra,
});
const nueva = (extra = {}) => {
  const { id: _, ...sinId } = lesion(null, { numero_caso: null, ...extra });
  return sinId;
};

describe("lo que entra en la fila de espera", () => {
  test("una nueva tiene su id propio hasta que sube; lo que se le cambia (el alta) queda en ella y, si se borra, sale", () => {
    let cola = conCreadas([], [nueva({ jugador_id: 8 })]);
    const [creada] = cola;
    expect(creada).toMatchObject({ tipo: "crear", lesion: { jugador_id: 8, numero_caso: null } });
    expect(creada.lesion.id).toBeUndefined();
    expect(esLocal(creada.id)).toBe(true);
    cola = conCambio(cola, { id: creada.id, cambios: { fecha_alta: "2026-06-20", "datos.medico": "Dr. Inventado" }, antes: { fecha_alta: null, "datos.medico": null } });
    expect(cola).toHaveLength(1);
    expect(cola[0].lesion).toMatchObject({ fecha_alta: "2026-06-20", datos: { medico: "Dr. Inventado" } });
    expect(conBorrada(cola, creada.id)).toEqual([]);
  });

  test("los cambios a una de la base se juntan (lo que se veía antes del primero queda); borrarla los saca", () => {
    let cola = conCambio([], { id: "l1", cambios: { "datos.medico": "A" }, antes: { "datos.medico": null } });
    cola = conCambio(cola, { id: "l1", cambios: { "datos.medico": "B", fecha_alta: "2026-06-20" }, antes: { "datos.medico": "A", fecha_alta: null } });
    expect(cola).toEqual([{ tipo: "cambiar", id: "l1", cambios: { "datos.medico": "B", fecha_alta: "2026-06-20" }, antes: { "datos.medico": null, fecha_alta: null } }]);
    expect(conBorrada(cola, "l1")).toEqual([{ tipo: "borrar", id: "l1" }]);
  });
});

describe("cómo se ve con lo que espera", () => {
  test("nuevas, cambiadas y borradas encima de la copia; las que esperan, para pintarlas; da lo mismo aplicarlo dos veces", () => {
    let cola = conCreadas([], [nueva({ jugador_id: 8, fecha_lesion: "2026-06-05" })]);
    cola = conCambio(cola, { id: "l1", cambios: { fecha_alta: "2026-06-10" }, antes: { fecha_alta: null } });
    cola = conBorrada(cola, "l2");
    const una = conLoQueEspera([lesion("l1"), lesion("l2", { numero_caso: 2 })], cola);
    expect(una.map((l) => [esLocal(l.id) ? "nueva" : l.id, l.fecha_alta, l.numero_caso])).toEqual([
      ["l1", "2026-06-10", 1],
      ["nueva", null, null],
    ]);
    expect(conLoQueEspera(una, cola)).toEqual(una);
    expect(idsEnEspera(cola)).toEqual(new Set([cola[0].id, "l1"]));
  });
});

describe("el N° de caso al subir", () => {
  test("las nuevas, después del último de la Base, de la fecha más vieja a la más nueva (las sin fecha al final); los de la Base no cambian", () => {
    const cola = conCreadas([], [nueva({ fecha_lesion: "2026-06-10" }), nueva({ fecha_lesion: null }), nueva({ fecha_lesion: "2026-06-02" })]);
    const numeros = numerosDeCaso(cola, [lesion("l1", { numero_caso: 40 }), lesion("l2", { numero_caso: 3, fecha_lesion: "2026-07-01" })]);
    expect(cola.map((uno) => numeros.get(uno.id))).toEqual([42, 43, 41]);
  });

  test("un N° del Excel queda si está libre; si está ocupado, toma el que le toca por su fecha", () => {
    const cola = conCreadas([], [nueva({ numero_caso: 50, fecha_lesion: "2026-06-03" }), nueva({ numero_caso: 40, fecha_lesion: "2026-06-01" }), nueva({ fecha_lesion: "2026-06-02" })]);
    const numeros = numerosDeCaso(cola, [lesion("l1", { numero_caso: 40 })]);
    expect(cola.map((uno) => numeros.get(uno.id))).toEqual([50, 51, 52]);
  });
});

describe("al volver la señal", () => {
  const llamadas = [];
  const funciones = (respuestas = {}) => ({
    crear: async (equipoId, una) => {
      llamadas.push(["crear", una.jugador_id, una.numero_caso]);
      const propia = (respuestas.crear || []).shift();
      return propia || { lesion: { ...una, id: `base-${llamadas.length}` }, error: "" };
    },
    cambiar: async (id, { cambios }) => {
      llamadas.push(["cambiar", id, cambios]);
      return (respuestas.cambiar || {})[id] || { lesion: {}, pisadas: [], error: "" };
    },
    actualizar: async (id, una) => {
      llamadas.push(["actualizar", id, una.fecha_alta]);
      return { lesion: una, error: "" };
    },
    borrar: async (id) => {
      llamadas.push(["borrar", id]);
      return (respuestas.borrar || {})[id] || { error: "" };
    },
  });
  const esDeRed = (respuesta) => /Failed to fetch/.test(`${respuesta?.detalle || ""}`);
  const subir = (cola, { servidor = [], respuestas } = {}) => {
    llamadas.length = 0;
    return subirLaEspera(cola, { equipoId: "eq-1", servidor, funciones: funciones(respuestas), esDeRed });
  };

  test("sube todo en orden, con su N° de caso; dice cuántas subieron, qué pisó y cuáles son las nuevas de la base", async () => {
    let cola = conCreadas([], [nueva({ jugador_id: 8 })]);
    cola = conCambio(cola, { id: "l1", cambios: { fecha_alta: "2026-06-20" }, antes: { fecha_alta: null } });
    cola = conBorrada(cola, "l9");
    const respuesta = await subir(cola, {
      servidor: [lesion("l1", { numero_caso: 4 })],
      respuestas: { cambiar: { l1: { lesion: {}, pisadas: [{ clave: "fecha_alta", habia: "2026-06-18" }], error: "" } } },
    });
    expect(llamadas).toEqual([
      ["crear", 8, 5],
      ["cambiar", "l1", { fecha_alta: "2026-06-20" }],
      ["borrar", "l9"],
    ]);
    expect(respuesta).toMatchObject({ subidos: 3, pisadas: [{ clave: "fecha_alta", habia: "2026-06-18", id: "l1" }], quedan: [], repetidas: [], cortado: false, errores: [] });
    expect(respuesta.nuevas[cola[0].id]).toMatchObject({ id: "base-1", numero_caso: 5 });
  });

  test("la misma lesión que ya cargó otra persona se descarta (para avisar); si otra persona tomó el N°, toma el que sigue", async () => {
    const cola = conCreadas([], [nueva({ jugador_id: 7 }), nueva({ jugador_id: 8, fecha_lesion: "2026-06-03" })]);
    const respuesta = await subir(cola, {
      respuestas: { crear: [{ error: "lesiones.error.repetida" }, { error: "lesiones.importar.casoOcupado" }] },
    });
    expect(llamadas).toEqual([
      ["crear", 7, 1],
      ["crear", 8, 2],
      ["crear", 8, null],
    ]);
    expect(respuesta).toMatchObject({ subidos: 1, repetidas: [{ id: cola[0].id, lesion: { jugador_id: 7 } }], quedan: [] });
  });

  test("sin señal en el camino se corta y lo que falta queda; un error de la base no se reintenta; una que otro borró se cuenta", async () => {
    let cola = conCambio([], { id: "l1", cambios: { fecha_alta: "2026-06-20" } });
    cola = conCambio(cola, { id: "l2", cambios: { fecha_alta: "2026-06-21" } });
    cola = conBorrada(cola, "l3");
    cola = conBorrada(cola, "l4");
    const respuesta = await subir(cola, {
      respuestas: {
        cambiar: { l1: { borrada: true, error: "" }, l2: { error: "lesiones.error.sinPermiso" } },
        borrar: { l3: { error: "lesiones.error.noBorrar", detalle: "TypeError: Failed to fetch" } },
      },
    });
    expect(respuesta).toMatchObject({ subidos: 0, borradasPorOtra: 1, errores: [{ error: "lesiones.error.sinPermiso", lesion: null }], cortado: true });
    expect(respuesta.quedan).toEqual([
      { tipo: "borrar", id: "l3" },
      { tipo: "borrar", id: "l4" },
    ]);
  });

  test("sin la actualización de la base, el cambio va sobre la lesión de la base", async () => {
    const cola = conCambio([], { id: "l1", cambios: { fecha_alta: "2026-06-20" } });
    const respuesta = await subir(cola, { servidor: [lesion("l1")], respuestas: { cambiar: { l1: { sinFuncion: true, error: "" } } } });
    expect(llamadas.at(-1)).toEqual(["actualizar", "l1", "2026-06-20"]);
    expect(respuesta.subidos).toBe(1);
  });

  test("lo que se hizo mientras subía queda: lo cambiado en una nueva va sobre la de la base, y una borrada se borra", async () => {
    const enviada = conCreadas(conCreadas([], [nueva({ jugador_id: 7 })]), [nueva({ jugador_id: 8 })]);
    const respuesta = await subir(enviada);
    const [primera, segunda] = enviada;
    // Mientras subía: a la primera se le dio el alta y la segunda se borró;
    // además se cambió otra de la base.
    let ahora = conCambio(enviada, { id: primera.id, cambios: { fecha_alta: "2026-06-20" } });
    ahora = conBorrada(ahora, segunda.id);
    ahora = conCambio(ahora, { id: "l5", cambios: { "datos.medico": "B" }, antes: { "datos.medico": "A" } });
    expect(conLoHechoMientras(ahora, { enviada, ...respuesta }, cambiosDeLaLesion)).toEqual([
      { tipo: "cambiar", id: "base-1", cambios: { fecha_alta: "2026-06-20" }, antes: { fecha_alta: null } },
      { tipo: "cambiar", id: "l5", cambios: { "datos.medico": "B" }, antes: { "datos.medico": "A" } },
      { tipo: "borrar", id: "base-2" },
    ]);
    // Sin nada hecho mientras tanto, no queda nada.
    expect(conLoHechoMientras(enviada, { enviada, ...respuesta }, cambiosDeLaLesion)).toEqual([]);
  });
});
