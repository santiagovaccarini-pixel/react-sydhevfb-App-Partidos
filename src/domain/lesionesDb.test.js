import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  CAMBIOS_EN_LA_FICHA,
  actualizarLesion,
  agregarJugadorBasico,
  cargarPlantelLesiones,
  crearLesion,
  guardarCategoriaDeLesiones,
  guardarDatosJugador,
  historialDeLesion,
  importarLesion,
  leerLesionesPorJugador,
  leerMinutosDeEntrenamiento,
  listarLesiones,
} from "./lesionesDb.js";

// Un doble de Supabase que anota la consulta y contesta lo configurado (o,
// si hay, la próxima de "respuestas", una por consulta).
const doble = vi.hoisted(() => ({ llamadas: [], filas: [], error: null, alta: null, respuestas: [] }));

// El alta de jugadores es la de Partido: contesta lo que diga la prueba.
vi.mock("./plantel.js", () => ({
  agregarJugador: async (nombre) => doble.alta(nombre),
  cargarPlantel: async () => ({ plantel: [] }),
  normalizarJugador: (fila) => ({ id: fila?.id, nombre: fila?.nombre || "", roles: [], puestos: [] }),
  quitarJugador: async () => ({}),
}));

vi.mock("../supabase.js", () => {
  const cadena = () => {
    const c = {};
    ["select", "eq", "not", "order", "limit", "insert", "update", "single", "range"].forEach((metodo) => {
      c[metodo] = (...args) => {
        doble.llamadas.push([metodo, ...args]);
        return c;
      };
    });
    c.then = (resolver, rechazar) =>
      Promise.resolve(doble.respuestas.length ? doble.respuestas.shift() : { data: doble.error ? null : doble.filas, error: doble.error }).then(resolver, rechazar);
    return c;
  };
  return {
    supabase: {
      from: (tabla) => {
        doble.llamadas.push(["from", tabla]);
        return cadena();
      },
      rpc: (nombre, argumentos) => {
        doble.llamadas.push(["rpc", nombre, argumentos]);
        return cadena();
      },
    },
  };
});

// Las columnas pedidas a una tabla, en orden.
const selectsDe = (tabla) => {
  let actual = null;
  return doble.llamadas.flatMap(([metodo, valor]) => {
    if (metodo === "from") actual = valor;
    return metodo === "select" && actual === tabla ? [valor] : [];
  });
};

beforeEach(() => {
  doble.llamadas.length = 0;
  doble.filas = [];
  doble.error = null;
  doble.respuestas = [];
});

describe("los cambios de una lesión en la ficha", () => {
  test("se piden solo los últimos 5, del más nuevo al más viejo", async () => {
    await historialDeLesion("les-1");
    expect(CAMBIOS_EN_LA_FICHA).toBe(5);
    expect(doble.llamadas).toEqual([
      ["from", "lesiones_historial"],
      ["select", "id, accion, quien_email, cuando, antes, despues"],
      ["eq", "lesion_id", "les-1"],
      ["order", "cuando", { ascending: false }],
      ["order", "id", { ascending: false }],
      ["limit", 5],
    ]);
  });

  test("cada edición dice qué columnas cambió, sin mandar la lesión entera a la pantalla", async () => {
    const vieja = { jugador_id: 7, fecha_lesion: "2026-09-20", fecha_alta: null, datos: { parte_cuerpo: "coxa", lado: "direito" } };
    doble.filas = [
      { id: 2, accion: "editada", quien_email: "medico@club.com", cuando: "2026-09-22T10:00:00Z", antes: vieja, despues: { ...vieja, fecha_alta: "2026-09-22", datos: { ...vieja.datos, medico: "Dr. X" } } },
      { id: 1, accion: "creada", quien_email: "medico@club.com", cuando: "2026-09-20T10:00:00Z", antes: null, despues: vieja },
    ];
    const { cambios, error } = await historialDeLesion("les-1");
    expect(error).toBe("");
    expect(cambios).toEqual([
      { id: 2, accion: "editada", quien_email: "medico@club.com", cuando: "2026-09-22T10:00:00Z", campos: ["fecha_alta", "medico"] },
      { id: 1, accion: "creada", quien_email: "medico@club.com", cuando: "2026-09-20T10:00:00Z", campos: [] },
    ]);
  });

  test("si la base no deja leer, se dice", async () => {
    doble.error = { code: "42501", message: "permission denied for table lesiones_historial" };
    expect(await historialDeLesion("les-1")).toMatchObject({ cambios: [], error: "lesiones.error.sinPermiso" });
  });
});

describe("guardar una lesión", () => {
  test("lo calculado no se guarda, pero las horas que se cargaron a mano antes quedan", async () => {
    doble.filas = { id: "les-1", jugador_id: 7, fecha_lesion: "2026-09-01", datos: {} };
    await actualizarLesion("les-1", {
      jugador_id: 7,
      fecha_lesion: "2026-09-01",
      fecha_alta: "2026-09-20",
      datos: { parte_cuerpo: "coxa", lado: "direito", horas_imagen: "12", diagnostico: "viejo", edad: 30, medico: " " },
    });
    const [, enviado] = doble.llamadas.find(([metodo]) => metodo === "update");
    expect(enviado.datos).toEqual({ parte_cuerpo: "coxa", lado: "direito", horas_imagen: "12" });
    expect(enviado.fecha_alta).toBe("2026-09-20");
  });

  test("la categoría del jugador ese día queda en la lesión (Santiago, 17/10)", async () => {
    doble.filas = { id: "les-1", jugador_id: 7, fecha_lesion: "2026-09-01", datos: {} };
    await actualizarLesion("les-1", { jugador_id: 7, fecha_lesion: "2026-09-01", datos: { parte_cuerpo: "coxa", categoria: "sub20", edad: 19 } });
    const [, enviado] = doble.llamadas.find(([metodo]) => metodo === "update");
    expect(enviado.datos).toEqual({ parte_cuerpo: "coxa", categoria: "sub20" });
  });
});

describe("la categoría de las lesiones al cambiarla en Datos básicos", () => {
  test("se leen las de cada jugador, de a 1000, sin las de personas fuera de Datos básicos", async () => {
    const muchas = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}`, jugador_id: 7, fecha_lesion: "2026-01-10", datos: {} }));
    doble.respuestas = [
      { data: muchas, error: null },
      { data: [{ id: "b1", jugador_id: 8, fecha_lesion: null, datos: null }], error: null },
    ];
    const { porJugador, error } = await leerLesionesPorJugador("eq-1");
    expect(error).toBe("");
    expect(porJugador[7]).toHaveLength(1000);
    expect(porJugador[8]).toEqual([{ id: "b1", fecha_lesion: null, datos: {} }]);
    expect(doble.llamadas.filter(([metodo]) => metodo === "range").map(([, desde, hasta]) => [desde, hasta])).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(doble.llamadas).toContainEqual(["not", "jugador_id", "is", null]);
  });

  test("si la base no deja leer, no se pregunta y se dice por qué", async () => {
    doble.error = { code: "42501", message: "permission denied" };
    const { porJugador, error } = await leerLesionesPorJugador("eq-1");
    expect(porJugador).toEqual({});
    expect(error).not.toBe("");
  });

  test("se guardan de a una; si una falla, se siguen las demás y se avisa", async () => {
    doble.respuestas = [{ data: null, error: null }, { data: null, error: { code: "42501", message: "permission denied" } }, { data: null, error: null }];
    const respuesta = await guardarCategoriaDeLesiones([
      { id: "l1", datos: { categoria: "profissional" } },
      { id: "l2", datos: { categoria: "sub20" } },
      { id: "l3", datos: { categoria: "sub20", parte_cuerpo: "coxa" } },
    ]);
    expect(respuesta.hechas).toEqual(["l1", "l3"]);
    expect(respuesta.error).not.toBe("");
    expect(doble.llamadas.filter(([metodo]) => metodo === "update").map(([, datos]) => datos)).toEqual([
      { datos: { categoria: "profissional" } },
      { datos: { categoria: "sub20" } },
      { datos: { categoria: "sub20", parte_cuerpo: "coxa" } },
    ]);
  });
});

describe("cargar una lesión del Excel", () => {
  test("va con su N° de caso, y lo calculado no se guarda", async () => {
    doble.filas = { id: "les-1", numero_caso: 12, jugador_id: 7, fecha_lesion: "2026-02-03", datos: {} };
    const { lesion, error } = await importarLesion("eq-1", {
      id: null,
      numero_caso: 12,
      jugador_id: 7,
      fecha_lesion: "2026-02-03",
      fecha_alta: "2026-02-20",
      datos: { parte_cuerpo: "coxa", lado: "direito", severidad: "moderada" },
    });
    expect(error).toBe("");
    expect(lesion).toMatchObject({ id: "les-1", numero_caso: 12 });
    const [, enviado] = doble.llamadas.find(([metodo]) => metodo === "insert");
    expect(enviado).toEqual({
      equipo_id: "eq-1",
      numero_caso: 12,
      jugador_id: 7,
      persona: null,
      fecha_lesion: "2026-02-03",
      fecha_transicion: null,
      fecha_retorno_entrenamiento: null,
      fecha_alta: "2026-02-20",
      datos: { parte_cuerpo: "coxa", lado: "direito" },
    });
  });

  test("de alguien que no está en Datos básicos: va con su nombre y sin jugador; sin fecha, vacía", async () => {
    doble.filas = { id: "les-3", numero_caso: 14, jugador_id: null, persona: "Cata Tres", fecha_lesion: null, datos: {} };
    const { lesion } = await importarLesion("eq-1", { numero_caso: 14, jugador_id: null, persona: "  Cata   Tres ", fecha_lesion: null, datos: {} });
    const [, enviado] = doble.llamadas.find(([metodo]) => metodo === "insert");
    expect(enviado).toMatchObject({ jugador_id: null, persona: "Cata Tres", fecha_lesion: null });
    expect(lesion).toMatchObject({ persona: "Cata Tres", fecha_lesion: null });
  });

  test("sin N° de caso lo pone la base", async () => {
    doble.filas = { id: "les-2", numero_caso: 13, jugador_id: 7, fecha_lesion: "2026-02-03", datos: {} };
    await importarLesion("eq-1", { numero_caso: null, jugador_id: 7, fecha_lesion: "2026-02-03", datos: {} });
    const [, enviado] = doble.llamadas.find(([metodo]) => metodo === "insert");
    expect(enviado).not.toHaveProperty("numero_caso");
  });

  test("un N° de caso ocupado o la misma lesión vuelven como claves del diccionario", async () => {
    doble.error = { code: "23505", message: 'duplicate key value violates unique constraint "lesiones_sin_repetir"' };
    expect(await importarLesion("eq-1", { numero_caso: 3, jugador_id: 7, fecha_lesion: "2026-02-03", datos: {} })).toMatchObject({ error: "lesiones.error.repetida" });
    doble.error = { code: "23505", message: 'duplicate key value violates unique constraint "lesiones_numero_caso_unico"' };
    expect(await importarLesion("eq-1", { numero_caso: 3, jugador_id: 7, fecha_lesion: "2026-02-03", datos: {} })).toMatchObject({ error: "lesiones.importar.casoOcupado" });
  });
});

describe("agregar un jugador desde Datos básicos", () => {
  test("los errores del alta de Partido vuelven como claves del diccionario", async () => {
    doble.alta = async () => ({ error: "datos.error.repetido" });
    expect(await agregarJugadorBasico("eq-1", "HULK")).toEqual({ error: "datos.error.repetido" });
    doble.alta = async () => ({ error: "datos.error.nombre" });
    expect(await agregarJugadorBasico("eq-1", " ")).toEqual({ error: "datos.error.nombre" });
    doble.alta = async () => ({ error: "datos.error.guardar", detalle: "new row violates row-level security policy" });
    expect(await agregarJugadorBasico("eq-1", "LEMOS")).toEqual({ error: "datos.error.guardar", detalle: "new row violates row-level security policy" });
    // Un texto que no es clave no llega a la pantalla: va el genérico.
    doble.alta = async () => ({ error: "new row violates row-level security policy" });
    expect(await agregarJugadorBasico("eq-1", "LEMOS")).toMatchObject({ error: "datos.error.guardar" });
    doble.alta = async (nombre) => ({ jugador: { id: 9, nombre } });
    expect(await agregarJugadorBasico("eq-1", "LEMOS")).toMatchObject({ jugador: { id: 9, nombre: "LEMOS", categoria: "" }, error: "" });
  });
});

describe("la fecha de nacimiento de Datos básicos", () => {
  test("una fecha futura no se guarda", async () => {
    doble.llamadas.length = 0;
    expect(await guardarDatosJugador(7, { fecha_nacimiento: "2999-01-01" })).toEqual({ error: "datos.error.nacimientoFuturo" });
    expect(doble.llamadas.some(([metodo]) => metodo === "update")).toBe(false);
    doble.filas = { id: 7, nombre: "HULK", fecha_nacimiento: "1986-07-25" };
    expect(await guardarDatosJugador(7, { fecha_nacimiento: "1986-07-25" })).toMatchObject({ error: "" });
    // Vaciarla, sí.
    expect(await guardarDatosJugador(7, { fecha_nacimiento: null })).toMatchObject({ error: "" });
  });
});

describe("las horas previas de cada jugador", () => {
  const sinColumna = { data: null, error: { code: "42703", message: "column jugadores.horas_previas does not exist" } };
  // Las lecturas del plantel (después se leen sus nombres anteriores, aparte).
  const selects = () => selectsDe("jugadores");

  test("se leen con el plantel, como número", async () => {
    doble.filas = [{ id: 7, nombre: "HULK", horas_previas: "30.25" }];
    const { plantel } = await cargarPlantelLesiones("eq-1");
    expect(plantel[0].horas_previas).toBe(30.25);
    expect(selects()[0]).toContain("horas_previas");
  });

  test("mientras no se corra el SQL nuevo, el plantel se lee sin ellas", async () => {
    doble.respuestas = [sinColumna, { data: [{ id: 7, nombre: "HULK", categoria: "profissional" }], error: null }];
    const { plantel, error } = await cargarPlantelLesiones("eq-1");
    expect(error).toBe("");
    expect(plantel[0]).toMatchObject({ nombre: "HULK", categoria: "profissional", horas_previas: null });
    expect(selects()).toHaveLength(2);
    expect(selects()[1]).not.toContain("horas_previas");
  });

  test("se guardan como horas; sin el SQL nuevo se avisa, y lo demás se sigue guardando", async () => {
    doble.filas = { id: 7, nombre: "HULK", horas_previas: 30.25 };
    expect(await guardarDatosJugador(7, { horas_previas: 30.25 })).toMatchObject({ jugador: { horas_previas: 30.25 }, error: "" });
    expect(doble.llamadas.find(([metodo]) => metodo === "update")[1]).toMatchObject({ horas_previas: 30.25 });
    expect(await guardarDatosJugador(7, { horas_previas: -2 })).toEqual({ error: "datos.error.horas" });
    doble.respuestas = [sinColumna];
    expect(await guardarDatosJugador(7, { horas_previas: 12 })).toEqual({ error: "datos.error.faltanHorasPrevias" });
    doble.respuestas = [sinColumna, { data: { id: 7, nombre: "HULK", categoria: "sub20" }, error: null }];
    expect(await guardarDatosJugador(7, { categoria: "sub20" })).toEqual({ jugador: expect.objectContaining({ categoria: "sub20", horas_previas: null }), error: "" });
    // Las horas con otros datos (el Excel pegado): lo demás se guarda y se avisa.
    doble.llamadas.length = 0;
    doble.respuestas = [sinColumna, { data: { id: 7, nombre: "HULK", categoria: "sub20" }, error: null }];
    expect(await guardarDatosJugador(7, { categoria: "sub20", horas_previas: 12 })).toMatchObject({ jugador: { categoria: "sub20" }, error: "", aviso: "datos.error.faltanHorasPrevias" });
    const updates = doble.llamadas.filter(([metodo]) => metodo === "update").map(([, valores]) => valores);
    expect(updates[1]).not.toHaveProperty("horas_previas");
    expect(updates[1]).toMatchObject({ categoria: "sub20" });
    // Celdas de horas vacías junto a otras: se guarda lo demás sin aviso.
    doble.respuestas = [sinColumna, { data: { id: 7, nombre: "HULK", foto_url: "http://b" }, error: null }];
    expect(await guardarDatosJugador(7, { foto_url: "http://b", horas_previas: null })).toEqual({ jugador: expect.objectContaining({ foto_url: "http://b" }), error: "" });
    // Vaciar la celda borra las horas.
    doble.filas = { id: 7, nombre: "HULK", horas_previas: null };
    doble.llamadas.length = 0;
    await guardarDatosJugador(7, { horas_previas: null });
    expect(doble.llamadas.find(([metodo]) => metodo === "update")[1]).toMatchObject({ horas_previas: null });
  });
});

// Una base que todavía no tiene la columna persona: cada prueba con el
// módulo recién cargado (recuerda si a la base le falta la columna).
describe("con una base que todavía no tiene la columna persona (falta 20261010)", () => {
  const moduloNuevo = async () => {
    vi.resetModules();
    return import("./lesionesDb.js");
  };
  const sinColumna = { data: null, error: { code: "42703", message: "column lesiones.persona does not exist" } };

  test("las lesiones se leen igual, sin ella", async () => {
    const { listarLesiones: listar } = await moduloNuevo();
    doble.respuestas = [sinColumna, { data: [{ id: "les-1", jugador_id: 7, fecha_lesion: "2026-02-03", datos: {} }], error: null }];
    const { lesiones, error } = await listar("eq-1");
    expect(error).toBe("");
    expect(lesiones).toHaveLength(1);
    const selects = doble.llamadas.filter(([metodo]) => metodo === "select").map(([, columnas]) => columnas);
    expect(selects[0]).toContain("persona");
    expect(selects[1]).not.toContain("persona");
    // Las sin fecha, al final.
    expect(doble.llamadas).toContainEqual(["order", "fecha_lesion", { ascending: false, nullsFirst: false }]);
  });

  test("una lesión de un jugador se guarda igual; una de alguien fuera de Datos básicos o sin fecha avisa qué SQL falta", async () => {
    const { crearLesion: crear, listarLesiones: listar } = await moduloNuevo();
    doble.respuestas = [sinColumna, { data: [], error: null }];
    await listar("eq-1");
    doble.llamadas.length = 0;
    doble.filas = { id: "les-2", jugador_id: 7, fecha_lesion: "2026-02-03", datos: {} };
    expect(await crear("eq-1", { jugador_id: 7, fecha_lesion: "2026-02-03", datos: {} })).toMatchObject({ error: "" });
    const [, enviado] = doble.llamadas.find(([metodo]) => metodo === "insert");
    expect(enviado).not.toHaveProperty("persona");
    doble.error = { code: "PGRST204", message: "Could not find the 'persona' column of 'lesiones' in the schema cache" };
    expect(await crear("eq-1", { jugador_id: null, persona: "Cata Tres", fecha_lesion: "2026-02-03", datos: {} })).toMatchObject({ error: "lesiones.error.faltaMigracionPersonas" });
    doble.error = { code: "23502", message: 'null value in column "fecha_lesion" of relation "lesiones" violates not-null constraint' };
    expect(await crear("eq-1", { jugador_id: 7, fecha_lesion: null, datos: {} })).toMatchObject({ error: "lesiones.error.faltaMigracionPersonas" });
  });

  test("si el SQL se corre con la app abierta, la lesión de una persona se guarda y la columna vuelve", async () => {
    const { crearLesion: crear, listarLesiones: listar } = await moduloNuevo();
    doble.respuestas = [sinColumna, { data: [], error: null }];
    await listar("eq-1");
    doble.llamadas.length = 0;
    doble.filas = { id: "les-3", jugador_id: null, persona: "Cata Tres", fecha_lesion: "2026-02-03", datos: {} };
    expect(await crear("eq-1", { jugador_id: null, persona: "Cata Tres", fecha_lesion: "2026-02-03", datos: {} })).toMatchObject({ lesion: { persona: "Cata Tres" }, error: "" });
    doble.llamadas.length = 0;
    doble.filas = [];
    await listar("eq-1");
    expect(doble.llamadas.find(([metodo]) => metodo === "select")[1]).toContain("persona");
  });

  test("si el SQL se corre con la app abierta, al recargar la lista ya trae los nombres", async () => {
    const { listarLesiones: listar } = await moduloNuevo();
    doble.respuestas = [sinColumna, { data: [], error: null }];
    await listar("eq-1");
    doble.llamadas.length = 0;
    doble.filas = [{ id: "les-4", jugador_id: null, persona: "Cata Tres", fecha_lesion: "2026-02-03", datos: {} }];
    const { lesiones } = await listar("eq-1");
    expect(doble.llamadas.filter(([metodo]) => metodo === "select")).toHaveLength(1);
    expect(doble.llamadas.find(([metodo]) => metodo === "select")[1]).toContain("persona");
    expect(lesiones[0]).toMatchObject({ persona: "Cata Tres" });
  });
});

describe("Datos básicos sin leer", () => {
  test("si la base no contesta, el plantel es la copia de respaldo y se avisa", async () => {
    doble.error = { code: "08000", message: "sin conexión" };
    const respuesta = await cargarPlantelLesiones("eq-1");
    expect(respuesta).toMatchObject({ plantel: [], error: "", deRespaldo: true });
  });

  test("leído de la base, no es de respaldo", async () => {
    doble.filas = [{ id: 7, nombre: "HULK" }];
    expect((await cargarPlantelLesiones("eq-1")).deRespaldo).toBeFalsy();
  });
});

describe("si está en el plantel actual (Datos básicos › Actual)", () => {
  const sinActual = { data: null, error: { code: "42703", message: "column jugadores.actual does not exist" } };
  // Las lecturas del plantel (después se leen sus nombres anteriores, aparte).
  const selects = () => selectsDe("jugadores");

  test("se lee con el plantel; sin el dato, está", async () => {
    doble.filas = [
      { id: 7, nombre: "HULK", actual: false },
      { id: 8, nombre: "SCARPA" },
    ];
    const { plantel } = await cargarPlantelLesiones("eq-1");
    expect(plantel.map((jugador) => [jugador.nombre, jugador.actual])).toEqual([
      ["HULK", false],
      ["SCARPA", true],
    ]);
    expect(selects()[0]).toMatch(/\bactual\b/);
  });

  test("mientras no se corra el SQL, se lee sin la columna (todos están)", async () => {
    doble.respuestas = [sinActual, { data: [{ id: 7, nombre: "HULK", horas_previas: 3 }], error: null }];
    const { plantel, error } = await cargarPlantelLesiones("eq-1");
    expect(error).toBe("");
    expect(plantel[0]).toMatchObject({ nombre: "HULK", actual: true, horas_previas: 3 });
    expect(selects()[1]).not.toMatch(/\bactual\b/);
    expect(selects()[1]).toContain("horas_previas");
  });

  test("sin ninguna de las dos columnas nuevas, también", async () => {
    const sinHoras = { data: null, error: { code: "42703", message: "column jugadores.horas_previas does not exist" } };
    doble.respuestas = [sinHoras, sinActual, { data: [{ id: 7, nombre: "HULK" }], error: null }];
    const { plantel } = await cargarPlantelLesiones("eq-1");
    expect(plantel[0]).toMatchObject({ nombre: "HULK", actual: true, horas_previas: null });
    expect(selects()).toHaveLength(3);
    expect(selects()[2]).not.toMatch(/horas_previas|\bactual\b/);
  });

  test("se guarda al marcar o desmarcar; sin el SQL se dice cuál falta y no se guarda nada", async () => {
    doble.filas = { id: 7, nombre: "HULK", actual: false };
    expect(await guardarDatosJugador(7, { actual: false })).toMatchObject({ jugador: { actual: false }, error: "" });
    expect(doble.llamadas.find(([metodo]) => metodo === "update")[1]).toMatchObject({ actual: false });

    doble.llamadas.length = 0;
    doble.respuestas = [{ data: null, error: { code: "PGRST204", message: "Could not find the 'actual' column of 'jugadores' in the schema cache" } }];
    expect(await guardarDatosJugador(7, { actual: true })).toEqual({ error: "datos.error.faltaActual" });
    expect(doble.llamadas.filter(([metodo]) => metodo === "update")).toHaveLength(1);
  });

  test("sin los dos SQL, lo demás se guarda y se avisa lo primero que faltó (y cuántos datos no se guardaron)", async () => {
    const sinHoras = { data: null, error: { code: "PGRST204", message: "Could not find the 'horas_previas' column of 'jugadores' in the schema cache" } };
    const sinActualAlGuardar = { data: null, error: { code: "PGRST204", message: "Could not find the 'actual' column of 'jugadores' in the schema cache" } };
    doble.respuestas = [sinHoras, sinActualAlGuardar, { data: { id: 7, nombre: "HULK", categoria: "sub20" }, error: null }];
    expect(await guardarDatosJugador(7, { categoria: "sub20", horas_previas: 12, actual: false })).toMatchObject({
      jugador: { categoria: "sub20" },
      error: "",
      aviso: "datos.error.faltanHorasPrevias",
      sinGuardar: 2,
    });
    const updates = doble.llamadas.filter(([metodo]) => metodo === "update").map(([, valores]) => valores);
    expect(updates[2]).not.toHaveProperty("horas_previas");
    expect(updates[2]).not.toHaveProperty("actual");
  });

  test("actualizado_en no es la columna actual: un error de otra cosa no se confunde", async () => {
    doble.error = { code: "23514", message: 'new row for relation "jugadores" violates check constraint "jugadores_actualizado_en_check"' };
    expect(await guardarDatosJugador(7, { nombre: "HULK" })).toMatchObject({ error: "datos.error.guardar" });
    expect(doble.llamadas.filter(([metodo]) => metodo === "update")).toHaveLength(1);
  });
});

describe("los minutos de entrenamiento para Lesiones c/1000h (del GPS)", () => {
  test("se piden a la base de a 1000, ya sumados por jugador, día y selección", async () => {
    const pagina = Array.from({ length: 1000 }, (_, i) => ({ jugador_id: 7, persona: null, fecha: "2026-09-01", seleccion: false, minutos: i % 2 ? "60.5" : 30 }));
    doble.respuestas = [
      { data: pagina, error: null },
      { data: [{ jugador_id: null, persona: "Juvenil", fecha: "2026-09-02", seleccion: false, minutos: 40 }, { jugador_id: 7, persona: null, fecha: "2026-09-24", seleccion: true, minutos: 98 }, { jugador_id: 8, fecha: null, minutos: 5 }], error: null },
    ];
    const { minutos, error } = await leerMinutosDeEntrenamiento("eq-1");
    expect(error).toBe("");
    expect(doble.llamadas).toEqual([
      ["rpc", "minutos_de_entrenamiento", { p_equipo: "eq-1" }],
      ["range", 0, 999],
      ["rpc", "minutos_de_entrenamiento", { p_equipo: "eq-1" }],
      ["range", 1000, 1999],
    ]);
    expect(minutos).toHaveLength(1002);
    expect(minutos[1]).toEqual({ jugadorId: 7, persona: null, fecha: "2026-09-01", minutos: 60.5, seleccion: false });
    expect(minutos.slice(-2)).toEqual([
      { jugadorId: null, persona: "Juvenil", fecha: "2026-09-02", minutos: 40, seleccion: false },
      { jugadorId: 7, persona: null, fecha: "2026-09-24", minutos: 98, seleccion: true },
    ]);
  });

  test("sin la migración o sin minutos cargados, no hay minutos (los reportes avisan) y no es un error", async () => {
    doble.respuestas = [{ data: null, error: { code: "PGRST202", message: "Could not find the function public.minutos_de_entrenamiento(p_equipo)" } }];
    expect(await leerMinutosDeEntrenamiento("eq-1")).toEqual({ minutos: null, error: "" });
    doble.respuestas = [{ data: [], error: null }];
    expect(await leerMinutosDeEntrenamiento("eq-1")).toEqual({ minutos: null, error: "" });
    expect(await leerMinutosDeEntrenamiento(null)).toEqual({ minutos: null, error: "" });
    // Sin señal: tampoco hay minutos, y se sabe por qué.
    doble.respuestas = [{ data: null, error: { message: "Failed to fetch" } }];
    const { minutos, error } = await leerMinutosDeEntrenamiento("eq-1");
    expect(minutos).toBe(null);
    expect(error).not.toBe("");
  });
});

describe("los nombres que tuvo cada jugador (nota del 12/10)", () => {
  test("se leen después del plantel y van con cada jugador", async () => {
    doble.respuestas = [
      { data: [{ id: 7, nombre: "G. SCARPA" }, { id: 8, nombre: "HULK" }], error: null },
      { data: [{ jugador_id: 7, nombre: "Scarpa" }, { jugador_id: 7, nombre: " Gustavo Scarpa " }, { jugador_id: 9, nombre: "" }], error: null },
    ];
    const { plantel, error } = await cargarPlantelLesiones("eq-1");
    expect(error).toBe("");
    expect(plantel.find((jugador) => jugador.id === 7).nombres_anteriores).toEqual(["Scarpa", "Gustavo Scarpa"]);
    expect(plantel.find((jugador) => jugador.id === 8).nombres_anteriores).toBeUndefined();
    expect(selectsDe("jugadores_nombres_anteriores")).toEqual(["jugador_id, nombre"]);
  });

  test("sin la tabla (antes del SQL), el plantel se lee igual, sin ellos", async () => {
    doble.respuestas = [
      { data: [{ id: 7, nombre: "HULK" }], error: null },
      { data: null, error: { code: "42P01", message: 'relation "public.jugadores_nombres_anteriores" does not exist' } },
    ];
    const { plantel, error } = await cargarPlantelLesiones("eq-1");
    expect(error).toBe("");
    expect(plantel).toEqual([expect.objectContaining({ id: 7, nombre: "HULK" })]);
    expect(plantel[0].nombres_anteriores).toBeUndefined();
  });
});
