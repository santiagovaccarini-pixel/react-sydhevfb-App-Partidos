import { beforeEach, describe, expect, test, vi } from "vitest";
import { actualizarEvaluacion, borrarEvaluacion, claveDeErrorEvaluaciones, crearEvaluacion, leerReferencias, listarEvaluaciones } from "./evaluacionesDb.js";

// Un doble de Supabase que anota cada consulta y contesta, una por consulta,
// lo que haya en "respuestas" (si no hay, lo de "filas").
const doble = vi.hoisted(() => ({ llamadas: [], filas: [], respuestas: [], soloLectura: false }));

vi.mock("./alDia.js", () => ({ esSoloLectura: () => doble.soloLectura }));

vi.mock("../supabase.js", () => {
  const cadena = () => {
    const c = {};
    ["select", "eq", "order", "range", "insert", "update", "delete", "single", "maybeSingle"].forEach((metodo) => {
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

  test("sin club no se pide nada", async () => {
    expect(await listarEvaluaciones(null, "zona_media")).toEqual({ evaluaciones: [], error: "" });
    expect(await leerReferencias(null, "zona_media")).toEqual({ referencias: null, error: "" });
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

  test("los valores de referencia del test (null si todavía no están)", async () => {
    doble.respuestas = [{ data: { datos: { categorias: { mayor: {} } } }, error: null }, { data: null, error: null }];
    expect(await leerReferencias("eq-1", "zona_media")).toEqual({ referencias: { categorias: { mayor: {} } }, error: "" });
    expect(doble.llamadas).toContainEqual(["from", "evaluaciones_referencias"]);
    expect(doble.llamadas).toContainEqual(["maybeSingle"]);
    expect(await leerReferencias("eq-1", "zona_media")).toEqual({ referencias: null, error: "" });

    doble.soloLectura = true;
    doble.respuestas = [{ data: [{ test: "otro_test", datos: { x: 1 } }, { test: "zona_media", datos: { y: 2 } }], error: null }];
    expect(await leerReferencias("eq-1", "zona_media")).toEqual({ referencias: { y: 2 }, error: "" });
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
    expect(clave({ code: "XX000", message: "otra cosa" })).toBe("evaluaciones.error.noGuardar");
    expect(claveDeErrorEvaluaciones({ code: "XX000" }, "evaluaciones.error.noBorrar")).toBe("evaluaciones.error.noBorrar");
  });
});
