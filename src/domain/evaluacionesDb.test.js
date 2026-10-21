import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  actualizarEvaluacion,
  borrarEvaluacion,
  cambiarEvaluacion,
  cambiosDeLaEvaluacion,
  claveDeErrorEvaluaciones,
  crearEvaluacion,
  guardarCabecera,
  guardarEvaluaciones,
  guardarOpcionDeLista,
  guardarSeleccionDeEvaluaciones,
  leerAjustes,
  leerReferencias,
  listarEvaluaciones,
} from "./evaluacionesDb.js";

// Un doble de Supabase que anota cada consulta y contesta, una por consulta,
// lo que haya en "respuestas" (si no hay, lo de "filas").
const doble = vi.hoisted(() => ({ llamadas: [], filas: [], respuestas: [], soloLectura: false }));

vi.mock("./alDia.js", () => ({ esSoloLectura: () => doble.soloLectura }));

vi.mock("../supabase.js", () => {
  const cadena = () => {
    const c = {};
    ["select", "eq", "order", "range", "insert", "update", "upsert", "delete", "single", "maybeSingle"].forEach((metodo) => {
      c[metodo] = (...args) => {
        doble.llamadas.push([metodo, ...args]);
        return c;
      };
    });
    c.then = (resolver, rechazar) => Promise.resolve(doble.respuestas.length ? doble.respuestas.shift() : { data: doble.filas, error: null }).then(resolver, rechazar);
    return c;
  };
  return {
    supabase: {
      from: (tabla) => {
        doble.llamadas.push(["from", tabla]);
        return cadena();
      },
      rpc: (funcion, argumentos) => {
        doble.llamadas.push(["rpc", funcion, argumentos]);
        return cadena();
      },
    },
  };
});

beforeEach(() => {
  doble.llamadas.length = 0;
  doble.filas = [];
  doble.respuestas = [];
  doble.soloLectura = false;
});

const evaluacion = (n, extra = {}) => ({ id: `e${n}`, equipo_id: "eq-1", test: "zona_media", orden: n, jugador_id: 7, persona: null, fecha: "2026-06-12", datos: { lumbar: 184 }, ...extra });

describe("leer las evaluaciones", () => {
  test("las de un test, en el orden de carga, de a 1000 hasta el final", async () => {
    doble.respuestas = [{ data: Array.from({ length: 1000 }, (_, i) => evaluacion(i + 1)), error: null }, { data: [evaluacion(1001), evaluacion(1002)], error: null }];
    const { evaluaciones, error } = await listarEvaluaciones("eq-1", "zona_media");
    expect(error).toBe("");
    expect(evaluaciones).toHaveLength(1002);
    expect(evaluaciones[1001]).toEqual({ id: "e1002", equipo_id: "eq-1", test: "zona_media", orden: 1002, jugador_id: 7, persona: null, fecha: "2026-06-12", datos: { lumbar: 184 } });
    expect(doble.llamadas.filter(([metodo]) => metodo === "range")).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
    ]);
    expect(doble.llamadas).toContainEqual(["eq", "test", "zona_media"]);
    expect(doble.llamadas).toContainEqual(["order", "orden", { ascending: true }]);
  });

  test("las de todos los tests del club, sin pedir un test", async () => {
    doble.respuestas = [{ data: [evaluacion(1), evaluacion(2, { test: "otro_test" })], error: null }];
    const { evaluaciones } = await listarEvaluaciones("eq-1");
    expect(evaluaciones.map((una) => una.test)).toEqual(["zona_media", "otro_test"]);
    expect(doble.llamadas).toContainEqual(["eq", "equipo_id", "eq-1"]);
    expect(doble.llamadas.some(([metodo, campo]) => metodo === "eq" && campo === "test")).toBe(false);
  });

  test("sin club no se pide nada", async () => {
    expect(await listarEvaluaciones(null, "zona_media")).toEqual({ evaluaciones: [], error: "" });
    expect(await leerReferencias(null)).toEqual({ referencias: {}, error: "" });
    expect(await leerAjustes(null)).toEqual({ campos: [], opciones: [], sinSentido: false, error: "" });
    expect(doble.llamadas).toEqual([]);
  });

  test("quien ya se fue del club lee la foto de su último día, también de a 1000", async () => {
    doble.soloLectura = true;
    doble.respuestas = [
      { data: [evaluacion(3), evaluacion(1), evaluacion(2, { test: "otro_test" }), "basura"].concat(Array.from({ length: 996 }, (_, i) => evaluacion(10 + i, { test: "otro_test" }))), error: null },
      { data: [evaluacion(2)], error: null },
    ];
    const { evaluaciones, error } = await listarEvaluaciones("eq-1", "zona_media");
    expect(error).toBe("");
    expect(evaluaciones.map((una) => una.orden)).toEqual([1, 2, 3]);
    expect(doble.llamadas[0]).toEqual(["rpc", "datos_al_dia", { p_tabla: "evaluaciones", p_equipo: "eq-1" }]);
    expect(doble.llamadas.filter(([metodo]) => metodo === "range")).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
    ]);
  });

  test("los valores de referencia del club, por test (el que no los tiene no está)", async () => {
    doble.respuestas = [{ data: [{ test: "zona_media", datos: { categorias: { mayor: {} } } }, { test: "otro_test", datos: null }], error: null }];
    expect(await leerReferencias("eq-1")).toEqual({ referencias: { zona_media: { categorias: { mayor: {} } } }, error: "" });
    expect(doble.llamadas).toContainEqual(["from", "evaluaciones_referencias"]);
    expect(doble.llamadas).toContainEqual(["select", "test, datos"]);

    doble.soloLectura = true;
    doble.respuestas = [{ data: [{ test: "otro_test", datos: { x: 1 } }, { test: "zona_media", datos: { y: 2 } }, "basura"], error: null }];
    expect(await leerReferencias("eq-1")).toEqual({ referencias: { otro_test: { x: 1 }, zona_media: { y: 2 } }, error: "" });
    expect(doble.llamadas).toContainEqual(["rpc", "datos_al_dia", { p_tabla: "evaluaciones_referencias", p_equipo: "eq-1" }]);
  });

  test("si la base no deja leer, se dice", async () => {
    doble.respuestas = [{ data: null, error: { code: "42501", message: "permission denied for table evaluaciones" } }];
    expect(await listarEvaluaciones("eq-1", "zona_media")).toMatchObject({ evaluaciones: [], error: "evaluaciones.error.sinPermiso" });
  });
});

describe("guardar una evaluación", () => {
  test("se manda solo lo cargado: de quién es, la fecha y los datos sin vacíos", async () => {
    doble.respuestas = [{ data: evaluacion(5, { datos: { lumbar: 184, nota: "molestia" } }), error: null }];
    const { evaluacion: guardada, error } = await crearEvaluacion("eq-1", "zona_media", {
      jugador_id: 7,
      persona: "no va",
      fecha: "2026-06-12",
      datos: { lumbar: 184, lateral_d: null, prono: undefined, seleccion: "", nota: "  molestia  " },
    });
    expect(error).toBe("");
    expect(guardada.orden).toBe(5);
    expect(doble.llamadas).toContainEqual([
      "insert",
      { equipo_id: "eq-1", test: "zona_media", jugador_id: 7, persona: null, fecha: "2026-06-12", datos: { lumbar: 184, nota: "molestia" } },
    ]);
  });

  test("alguien fuera de Datos básicos va con su nombre, sin espacios de más", async () => {
    doble.respuestas = [{ data: evaluacion(6, { jugador_id: null, persona: "Zeta Prueba" }), error: null }];
    await crearEvaluacion("eq-1", "zona_media", { jugador_id: null, persona: "  Zeta   Prueba ", fecha: null, datos: {} });
    expect(doble.llamadas).toContainEqual(["insert", { equipo_id: "eq-1", test: "zona_media", jugador_id: null, persona: "Zeta Prueba", fecha: null, datos: {} }]);
  });

  test("cambiar y borrar van por el id; el test y el club no se tocan", async () => {
    doble.respuestas = [{ data: evaluacion(5), error: null }, { data: null, error: null }];
    await actualizarEvaluacion("e5", { ...evaluacion(5), test: "otro_test", equipo_id: "eq-2" });
    expect(doble.llamadas).toContainEqual(["update", { jugador_id: 7, persona: null, fecha: "2026-06-12", datos: { lumbar: 184 } }]);
    expect(doble.llamadas).toContainEqual(["eq", "id", "e5"]);
    expect(await borrarEvaluacion("e5")).toEqual({ error: "" });
    expect(doble.llamadas).toContainEqual(["delete"]);
  });

  test("cada error de la base, en palabras", () => {
    const clave = (error) => claveDeErrorEvaluaciones(error);
    expect(clave({ code: "42P01", message: 'relation "public.evaluaciones" does not exist' })).toBe("evaluaciones.error.faltaMigracion");
    expect(clave({ code: "PGRST205", message: "Could not find the table 'public.evaluaciones' in the schema cache" })).toBe("evaluaciones.error.faltaMigracion");
    expect(clave({ code: "P0001", message: "jugador_de_otro_club" })).toBe("evaluaciones.error.jugadorDeOtroClub");
    expect(clave({ code: "23514", message: 'new row for relation "evaluaciones" violates check constraint "evaluaciones_sin_futuro"' })).toBe("evaluaciones.error.fechaFutura");
    expect(clave({ code: "23514", message: 'violates check constraint "evaluaciones_de_quien"' })).toBe("evaluaciones.error.sinJugador");
    expect(clave({ code: "42501", message: 'new row violates row-level security policy for table "evaluaciones"' })).toBe("evaluaciones.error.sinPermiso");
    expect(clave({ message: "TypeError: Failed to fetch" })).toBe("evaluaciones.error.sinConexion");
    // Sin señal al leer o al borrar, no dice "no se pudo guardar".
    expect(claveDeErrorEvaluaciones({ message: "TypeError: Failed to fetch" }, "evaluaciones.error.noLeer")).toBe("evaluaciones.error.noLeer");
    expect(claveDeErrorEvaluaciones({ message: "TypeError: Load failed" }, "evaluaciones.error.noBorrar")).toBe("evaluaciones.error.noBorrar");
    expect(clave({ code: "XX000", message: "otra cosa" })).toBe("evaluaciones.error.noGuardar");
    expect(claveDeErrorEvaluaciones({ code: "XX000" }, "evaluaciones.error.noBorrar")).toBe("evaluaciones.error.noBorrar");
  });
});

// Parte A3 de «cargar sin señal y a la vez que otra persona» (20261113).
describe("guardar varias de una vez", () => {
  const nueva = (jugador_id, fecha, datos = { lumbar: 180 }) => ({ jugador_id, persona: null, fecha, datos });

  test("de a tandas; las del mismo jugador y el mismo día, en la misma tanda; junta lo guardado y lo borrado", async () => {
    const evaluaciones = [...Array.from({ length: 499 }, (_, i) => nueva(i + 1, "2026-06-12")), nueva(9000, "2026-06-12"), nueva(9000, "2026-06-12", { lumbar: 190 }), nueva(9001, "2026-06-12")];
    doble.respuestas = [
      { data: { filas: [evaluacion(1)], borradas: ["v1"], yaEstaban: 497 }, error: null },
      { data: { filas: [evaluacion(2), evaluacion(3)], borradas: [], yaEstaban: 1 }, error: null },
    ];
    const avance = [];
    const respuesta = await guardarEvaluaciones("eq-1", "zona_media", { evaluaciones, reemplazar: true, alAvanzar: (n, total) => avance.push([n, total]) });
    const tandas = doble.llamadas.filter(([metodo]) => metodo === "rpc");
    expect(tandas.map(([, funcion, argumentos]) => [funcion, argumentos.p_filas.length, argumentos.p_test, argumentos.p_reemplazar])).toEqual([
      ["evaluaciones_guardar", 499, "zona_media", true],
      ["evaluaciones_guardar", 3, "zona_media", true],
    ]);
    expect(tandas[1][2].p_filas.map((fila) => fila.jugador_id)).toEqual([9000, 9000, 9001]);
    expect(respuesta).toEqual({ evaluaciones: [evaluacion(1), evaluacion(2), evaluacion(3)].map(({ id, equipo_id, test, orden, jugador_id, persona, fecha, datos }) => ({ id, equipo_id, test, orden, jugador_id, persona, fecha, datos })), borradas: ["v1"], yaEstaban: 498, error: "" });
    expect(avance).toEqual([
      [499, 502],
      [502, 502],
    ]);
  });

  test("sin la actualización de la base, sinFuncion; la Regla 1, conOtras; dos iguales, el error que lo dice", async () => {
    doble.respuestas = [{ data: null, error: { code: "PGRST202", message: "Could not find the function public.evaluaciones_guardar" } }];
    expect(await guardarEvaluaciones("eq-1", "zona_media", { evaluaciones: [nueva(1, "2026-06-12")] })).toMatchObject({ sinFuncion: true, error: "" });
    doble.respuestas = [{ data: null, error: { code: "P0001", message: "evaluaciones_con_otras", details: "1" } }];
    expect(await guardarEvaluaciones("eq-1", "zona_media", { evaluaciones: [nueva(1, "2026-06-12")] })).toMatchObject({ conOtras: true, error: "" });
    doble.respuestas = [{ data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "evaluaciones_sin_repetir"' } }];
    expect(await guardarEvaluaciones("eq-1", "zona_media", { evaluaciones: [nueva(1, "2026-06-12")] })).toMatchObject({ error: "evaluaciones.error.repetida" });
    expect(claveDeErrorEvaluaciones({ code: "23505", message: 'duplicate key value violates unique constraint "evaluaciones_sin_repetir"' })).toBe("evaluaciones.error.repetida");
  });
});

// Paso 2 de «cargar sin señal y a la vez que otra persona» (20261114;
// Santiago, 21/10, la misma celda: «Gana el último, con aviso»).
describe("cambiar solo lo cambiado", () => {
  test("se manda cada celda cambiada con lo que se veía; lo vacío va como null", () => {
    const vieja = evaluacion(1, { datos: { lumbar: 184, lateral_d: 90, nota: "" } });
    const nueva = { ...vieja, fecha: "2026-06-13", datos: { lumbar: 190, lateral_d: 90, nota: "", lateral_i: "", seleccion: "sub20" } };
    expect(cambiosDeLaEvaluacion(vieja, nueva)).toEqual({
      cambios: { fecha: "2026-06-13", "datos.lumbar": 190, "datos.seleccion": "sub20" },
      antes: { fecha: "2026-06-12", "datos.lumbar": 184, "datos.seleccion": null },
    });
    expect(cambiosDeLaEvaluacion(vieja, { ...vieja, datos: { lateral_d: 90 } })).toEqual({ cambios: { "datos.lumbar": null }, antes: { "datos.lumbar": 184 } });
    expect(cambiosDeLaEvaluacion(vieja, { ...vieja })).toEqual({ cambios: {}, antes: {} });
  });

  test("de un jugador a alguien fuera de Datos básicos: los dos campos, con el nombre limpio", () => {
    const vieja = evaluacion(1);
    expect(cambiosDeLaEvaluacion(vieja, { ...vieja, jugador_id: null, persona: "  Ana   Prueba " })).toEqual({
      cambios: { jugador_id: null, persona: "Ana Prueba" },
      antes: { jugador_id: 7, persona: null },
    });
  });

  test("va por la función de la base; devuelve cómo quedó y qué pisó", async () => {
    doble.respuestas = [{ data: { fila: evaluacion(1, { datos: { lumbar: 190 } }), pisadas: [{ clave: "datos.lumbar", habia: 186 }] }, error: null }];
    const respuesta = await cambiarEvaluacion("e1", { cambios: { "datos.lumbar": 190 }, antes: { "datos.lumbar": 184 } });
    expect(doble.llamadas).toEqual([["rpc", "evaluaciones_cambiar", { p_id: "e1", p_cambios: { "datos.lumbar": 190 }, p_antes: { "datos.lumbar": 184 } }]]);
    expect(respuesta).toMatchObject({ evaluacion: { id: "e1", datos: { lumbar: 190 } }, pisadas: [{ clave: "datos.lumbar", habia: 186 }], error: "" });
  });

  test("sin la actualización de la base, sinFuncion; si otra persona la borró, borrada; lo demás, en palabras", async () => {
    doble.respuestas = [{ data: null, error: { code: "PGRST202", message: "Could not find the function public.evaluaciones_cambiar" } }];
    expect(await cambiarEvaluacion("e1", { cambios: { "datos.lumbar": 190 } })).toEqual({ sinFuncion: true, error: "" });
    doble.respuestas = [{ data: null, error: { code: "P0001", message: "fila_borrada" } }];
    expect(await cambiarEvaluacion("e1", { cambios: { "datos.lumbar": 190 } })).toEqual({ borrada: true, error: "" });
    doble.respuestas = [{ data: null, error: { code: "P0001", message: "evaluaciones_sin_futuro" } }];
    expect((await cambiarEvaluacion("e1", { cambios: { fecha: "2099-01-01" } })).error).toBe(claveDeErrorEvaluaciones({ code: "P0001", message: "evaluaciones_sin_futuro" }, "evaluaciones.error.noGuardar"));
  });
});

describe("la Selección de las evaluaciones al cambiar la categoría en Datos básicos", () => {
  test("solo la Selección, con la que tenía; sin la actualización de la base, los datos enteros", async () => {
    doble.respuestas = [
      { data: { fila: evaluacion(1, { datos: { seleccion: "sub20", lumbar: 190 } }), pisadas: [{ clave: "datos.seleccion", habia: "sub23" }] }, error: null },
      { data: null, error: { code: "P0001", message: "fila_borrada" } },
    ];
    const respuesta = await guardarSeleccionDeEvaluaciones([
      { id: "e1", datos: { seleccion: "sub20", lumbar: 184 }, antes: "mayor" },
      { id: "e2", datos: { seleccion: "sub20" }, antes: "mayor" },
    ]);
    expect(doble.llamadas.map(([, funcion, argumentos]) => [funcion, argumentos.p_cambios, argumentos.p_antes])).toEqual([
      ["evaluaciones_cambiar", { "datos.seleccion": "sub20" }, { "datos.seleccion": "mayor" }],
      ["evaluaciones_cambiar", { "datos.seleccion": "sub20" }, { "datos.seleccion": "mayor" }],
    ]);
    expect(respuesta).toEqual({ hechas: ["e1"], datos: { e1: { seleccion: "sub20", lumbar: 190 } }, pisadas: 1, error: "" });

    doble.llamadas.length = 0;
    doble.respuestas = [{ data: null, error: { code: "PGRST202", message: "Could not find the function public.evaluaciones_cambiar" } }, { data: null, error: null }];
    expect(await guardarSeleccionDeEvaluaciones([{ id: "e1", datos: { seleccion: "sub20", lumbar: 184 }, antes: "mayor" }])).toMatchObject({ hechas: ["e1"], error: "" });
    expect(doble.llamadas.find(([metodo]) => metodo === "update")).toEqual(["update", { datos: { seleccion: "sub20", lumbar: 184 } }]);
  });
});

describe("Ajustes: cabeceras y listas del club", () => {
  test("se leen las dos tablas del club", async () => {
    doble.respuestas = [
      { data: [{ test: "zona_media", campo: "lumbar", etiqueta_es: "Lumbar (min)", etiqueta_pt: "", oculto: false, orden: 5 }], error: null },
      { data: [{ lista: "seleccion", codigo: "reserva_1", etiqueta_es: "Reserva", etiqueta_pt: "Reserva", oculto: false, orden: 6 }], error: null },
    ];
    const { campos, opciones, error } = await leerAjustes("eq-1");
    expect(error).toBe("");
    expect(campos).toHaveLength(1);
    expect(opciones[0].codigo).toBe("reserva_1");
    expect(doble.llamadas).toContainEqual(["from", "evaluaciones_campos"]);
    expect(doble.llamadas).toContainEqual(["from", "evaluaciones_opciones"]);
  });

  test("sin la migración de Ajustes, siguen los nombres del Excel (sin error)", async () => {
    doble.respuestas = [
      { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.evaluaciones_campos' in the schema cache" } },
      { data: null, error: { code: "PGRST205", message: "Could not find the table 'public.evaluaciones_opciones' in the schema cache" } },
    ];
    expect(await leerAjustes("eq-1")).toEqual({ campos: [], opciones: [], sinSentido: false, error: "" });
  });

  test("guardar una cabecera y una opción: los textos limpios, por club", async () => {
    doble.respuestas = [{ data: null, error: null }, { data: null, error: null }];
    expect(await guardarCabecera("eq-1", "zona_media", "lumbar", { etiquetas: { "es-AR": "  Lumbar (min) ", "pt-BR": "" }, oculto: true, orden: 5 })).toEqual({ error: "" });
    const cabecera = doble.llamadas.find(([metodo]) => metodo === "upsert");
    expect(cabecera[1]).toMatchObject({ equipo_id: "eq-1", test: "zona_media", campo: "lumbar", etiqueta_es: "Lumbar (min)", etiqueta_pt: "", oculto: true, orden: 5 });
    expect(cabecera[2]).toEqual({ onConflict: "equipo_id,test,campo" });
    expect(await guardarOpcionDeLista("eq-1", "seleccion", { codigo: "reserva_1", etiquetas: { "es-AR": "Reserva", "pt-BR": "Reserva" }, orden: 6 })).toEqual({ error: "" });
    const opcion = doble.llamadas.filter(([metodo]) => metodo === "upsert")[1];
    expect(opcion[1]).toMatchObject({ equipo_id: "eq-1", lista: "seleccion", codigo: "reserva_1", etiqueta_es: "Reserva", oculto: false, orden: 6 });
    expect(opcion[2]).toEqual({ onConflict: "equipo_id,lista,codigo" });
  });

  test("si falta la migración o la base no deja, se dice al guardar", async () => {
    doble.respuestas = [{ data: null, error: { code: "42P01", message: 'relation "public.evaluaciones_campos" does not exist' } }];
    expect(await guardarCabecera("eq-1", "zona_media", "lumbar", { etiquetas: { "es-AR": "X" } })).toEqual({ error: "evaluaciones.ajustes.faltaMigracion" });
    doble.respuestas = [{ data: null, error: { code: "42501", message: 'new row violates row-level security policy for table "evaluaciones_opciones"' } }];
    expect(await guardarOpcionDeLista("eq-1", "seleccion", { codigo: "x", etiquetas: { "es-AR": "X" } })).toEqual({ error: "evaluaciones.error.sinPermiso" });
  });
});
