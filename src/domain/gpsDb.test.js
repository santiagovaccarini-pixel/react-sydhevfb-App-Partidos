import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  POR_BORRADO,
  POR_TANDA,
  SIN_DISPOSITIVO,
  SOLO_PROMEDIOS,
  actualizarFilaGps,
  borrarFilaGps,
  borrarEnCurso,
  borrarFilasGps,
  cambiarEnDescripcionesGps,
  claveDeErrorGps,
  crearFilasGps,
  dejarEnCurso,
  enCursoDelDia,
  guardarCabeceraGps,
  guardarOpcionGps,
  leerAjustesGps,
  leerEnCurso,
  listarEnCurso,
  listarGps,
  ponerAlDiaGps,
  traerTodoGps,
  unirFilasGps,
  partidoDelDia,
} from "./gpsDb.js";

// Un doble de Supabase que anota cada consulta y contesta, una por consulta,
// lo que haya en "respuestas" (si no hay, lo de "filas").
const doble = vi.hoisted(() => ({ llamadas: [], filas: [], respuestas: [], soloLectura: false }));

vi.mock("./alDia.js", () => ({ esSoloLectura: () => doble.soloLectura }));

vi.mock("../supabase.js", () => {
  const cadena = () => {
    const c = {};
    ["select", "eq", "gte", "lte", "not", "is", "in", "order", "range", "limit", "insert", "update", "upsert", "delete", "single"].forEach((metodo) => {
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

const fila = (n, extra = {}) => ({ id: `g${n}`, equipo_id: "eq-1", orden: n, fecha: "2026-10-08", jugador_id: 7, persona: null, promedio: null, datos: { d: 100 + n }, ...extra });

describe("leer el GPS", () => {
  test("las del período, por fecha y en el orden de carga, de a 1000 hasta el final", async () => {
    doble.respuestas = [{ data: Array.from({ length: 1000 }, (_, i) => fila(i + 1)), error: null }, { data: [fila(1001)], error: null }];
    const { filas, error } = await listarGps("eq-1", { desde: "2026-09-12", hasta: "2026-10-10" });
    expect(error).toBe("");
    expect(filas).toHaveLength(1001);
    expect(doble.llamadas).toContainEqual(["gte", "fecha", "2026-09-12"]);
    expect(doble.llamadas).toContainEqual(["lte", "fecha", "2026-10-10"]);
    expect(doble.llamadas).toContainEqual(["order", "fecha", { ascending: true }]);
    expect(doble.llamadas).toContainEqual(["order", "orden", { ascending: true }]);
    expect(doble.llamadas.filter((llamada) => llamada[0] === "range")).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
    ]);
  });

  test("quien se fue lee la foto de su último día y se queda con el período", async () => {
    doble.soloLectura = true;
    doble.filas = [fila(2, { fecha: "2026-10-09" }), fila(1), fila(3, { fecha: "2026-01-01" })];
    const { filas } = await listarGps("eq-1", { desde: "2026-10-01", hasta: "2026-10-31" });
    expect(doble.llamadas[0]).toEqual(["rpc", "datos_al_dia", { p_tabla: "gps", p_equipo: "eq-1" }]);
    expect(filas.map((una) => una.id)).toEqual(["g1", "g2"]);
  });

  test("sabiendo cuántas son, las páginas que faltan van de a varias a la vez y vuelven en orden", async () => {
    doble.respuestas = [
      { data: Array.from({ length: 1000 }, (_, i) => fila(i + 1)), error: null, count: 3500 },
      { data: Array.from({ length: 1000 }, (_, i) => fila(1001 + i)), error: null },
      { data: Array.from({ length: 1000 }, (_, i) => fila(2001 + i)), error: null },
      // Una que llega dos veces (se sumó una fila mientras se leía): va una vez.
      { data: [fila(3000), ...Array.from({ length: 499 }, (_, i) => fila(3001 + i))], error: null },
    ];
    const { filas, total, demasiadas } = await listarGps("eq-1", { desde: "2026-01-01" });
    expect({ total, demasiadas }).toEqual({ total: 3500, demasiadas: false });
    expect(filas).toHaveLength(3499);
    expect(filas.map((una) => una.orden)).toEqual(Array.from({ length: 3499 }, (_, i) => i + 1));
    expect(doble.llamadas.filter((llamada) => llamada[0] === "select")[0]).toEqual(["select", expect.any(String), { count: "exact" }]);
    expect(doble.llamadas.filter((llamada) => llamada[0] === "range")).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
      ["range", 2000, 2999],
      ["range", 3000, 3999],
    ]);
  });

  test("con un máximo, si son más no las trae: dice cuántas son", async () => {
    doble.respuestas = [{ data: Array.from({ length: 1000 }, (_, i) => fila(i + 1)), error: null, count: 52340 }];
    expect(await listarGps("eq-1", { maximo: 20000 })).toEqual({ filas: [], total: 52340, demasiadas: true, error: "" });
    expect(doble.llamadas.filter((llamada) => llamada[0] === "range")).toHaveLength(1);
  });

  test("la base filtra por jugador, por el Team Average y por dispositivo", async () => {
    doble.respuestas = [{ data: [fila(1)], error: null, count: 1 }];
    await listarGps("eq-1", { jugador: "7", dispositivo: "catapult" });
    expect(doble.llamadas).toContainEqual(["eq", "jugador_id", "7"]);
    expect(doble.llamadas).toContainEqual(["eq", "datos->>dispositivo", "catapult"]);
    doble.llamadas.length = 0;
    doble.respuestas = [{ data: [], error: null, count: 0 }];
    await listarGps("eq-1", { jugador: SOLO_PROMEDIOS, dispositivo: SIN_DISPOSITIVO });
    expect(doble.llamadas).toContainEqual(["not", "promedio", "is", null]);
    expect(doble.llamadas).toContainEqual(["is", "datos->dispositivo", null]);
    expect(doble.llamadas.some((llamada) => llamada[0] === "eq" && llamada[1] === "jugador_id")).toBe(false);
  });

  test("quien se fue: los mismos filtros, sobre la foto", async () => {
    doble.soloLectura = true;
    doble.filas = [
      fila(1, { datos: { dispositivo: "catapult" } }),
      fila(2, { jugador_id: null, promedio: "parcial", datos: { dispositivo: "catapult" } }),
      fila(3, { jugador_id: 8, datos: {} }),
    ];
    expect((await listarGps("eq-1", { jugador: "7" })).filas.map((una) => una.id)).toEqual(["g1"]);
    expect((await listarGps("eq-1", { jugador: SOLO_PROMEDIOS })).filas.map((una) => una.id)).toEqual(["g2"]);
    expect((await listarGps("eq-1", { dispositivo: SIN_DISPOSITIVO })).filas.map((una) => una.id)).toEqual(["g3"]);
    expect(await listarGps("eq-1", { maximo: 2 })).toMatchObject({ filas: [], total: 3, demasiadas: true });
  });

  test("sin la migración avisa que falta", async () => {
    doble.respuestas = [{ data: null, error: { code: "42P01", message: 'relation "public.gps" does not exist' } }];
    expect((await listarGps("eq-1")).error).toBe("gps.error.faltaMigracion");
  });
});

describe("guardar", () => {
  test("lo pegado va de a tandas, en su orden, y dice cuántas lleva", async () => {
    const muchas = Array.from({ length: POR_TANDA + 3 }, (_, i) => ({ fecha: "2026-10-08", persona: `  Alguien   ${i} `, datos: { d: i, vacio: "", nada: null } }));
    doble.respuestas = [
      { data: muchas.slice(0, POR_TANDA).map((_, i) => fila(i + 1)), error: null },
      { data: muchas.slice(POR_TANDA).map((_, i) => fila(POR_TANDA + i + 1)), error: null },
    ];
    const avances = [];
    const { creadas, error } = await crearFilasGps("eq-1", muchas, { alAvanzar: (hechas, total) => avances.push([hechas, total]) });
    expect(error).toBe("");
    expect(creadas).toHaveLength(POR_TANDA + 3);
    expect(avances).toEqual([
      [POR_TANDA, POR_TANDA + 3],
      [POR_TANDA + 3, POR_TANDA + 3],
    ]);
    const tandas = doble.llamadas.filter((llamada) => llamada[0] === "insert");
    expect(tandas.map((llamada) => llamada[1].length)).toEqual([POR_TANDA, 3]);
    expect(tandas[0][1][0]).toEqual({ equipo_id: "eq-1", jugador_id: null, persona: "Alguien 0", promedio: null, fecha: "2026-10-08", datos: { d: 0 } });
  });

  test("si una tanda falla, se corta ahí con las que quedaron", async () => {
    const muchas = Array.from({ length: POR_TANDA + 1 }, () => ({ fecha: "2026-10-08", promedio: "parcial", jugador_id: 5, datos: {} }));
    doble.respuestas = [{ data: [fila(1)], error: null }, { data: null, error: { message: "new row violates row-level security policy" } }];
    const { creadas, error } = await crearFilasGps("eq-1", muchas);
    expect(creadas).toHaveLength(1);
    expect(error).toBe("gps.error.sinPermiso");
    // El promedio del equipo no es de un jugador.
    expect(doble.llamadas.find((llamada) => llamada[0] === "insert")[1][0]).toMatchObject({ promedio: "parcial", jugador_id: null, persona: null });
  });

  test("una fila cambiada y una borrada", async () => {
    doble.respuestas = [{ data: fila(1, { datos: { d: 5 } }), error: null }];
    const { fila: cambiada } = await actualizarFilaGps("g1", { fecha: "2026-10-08", jugador_id: 7, datos: { d: 5 } });
    expect(cambiada.datos).toEqual({ d: 5 });
    expect(doble.llamadas).toContainEqual(["eq", "id", "g1"]);
    expect((await borrarFilaGps("g1")).error).toBe("");
  });

  test("varias filas se borran de a tandas; vuelven las que la base borró de verdad", async () => {
    const ids = Array.from({ length: POR_BORRADO + 2 }, (_, i) => `g${i + 1}`);
    doble.respuestas = [
      { data: ids.slice(0, POR_BORRADO).map((id) => ({ id })), error: null },
      // Una de la segunda tanda no se pudo (no vuelve).
      { data: [{ id: ids[POR_BORRADO] }], error: null },
    ];
    const avances = [];
    const { borradas, error } = await borrarFilasGps(ids, { alAvanzar: (hechas, total) => avances.push([hechas, total]) });
    expect(error).toBe("");
    expect(borradas).toEqual(ids.slice(0, POR_BORRADO + 1));
    expect(doble.llamadas.filter((llamada) => llamada[0] === "in").map((llamada) => llamada[2].length)).toEqual([POR_BORRADO, 2]);
    expect(avances).toEqual([
      [POR_BORRADO, POR_BORRADO + 2],
      [POR_BORRADO + 2, POR_BORRADO + 2],
    ]);
    // Si un pedido falla, se corta ahí con su error.
    doble.llamadas.length = 0;
    doble.respuestas = [{ data: null, error: { message: "Failed to fetch" } }];
    expect(await borrarFilasGps(["g1", "g2"])).toEqual({ borradas: [], error: "gps.error.noBorrar", detalle: "Failed to fetch" });
  });

  test("los errores de la base, en el idioma de la app", () => {
    expect(claveDeErrorGps({ message: "gps_sin_futuro" })).toBe("gps.error.fechaFutura");
    expect(claveDeErrorGps({ message: "jugador_de_otro_club" })).toBe("gps.error.jugadorDeOtroClub");
    expect(claveDeErrorGps({ message: 'new row for relation "gps" violates check constraint "gps_de_quien"' })).toBe("gps.error.sinJugador");
    expect(claveDeErrorGps({ message: "Failed to fetch" })).toBe("gps.error.sinConexion");
    expect(claveDeErrorGps({ message: "Failed to fetch" }, "gps.error.noLeer")).toBe("gps.error.noLeer");
  });
});

describe("los Ajustes", () => {
  test("se leen las dos tablas; sin la migración, vacías y sin error", async () => {
    doble.respuestas = [
      { data: [{ campo: "d", etiqueta_es: "Distancia" }], error: null },
      { data: [{ lista: "dispositivo", codigo: "catapult" }], error: null },
    ];
    expect(await leerAjustesGps("eq-1")).toEqual({ campos: [{ campo: "d", etiqueta_es: "Distancia" }], opciones: [{ lista: "dispositivo", codigo: "catapult" }], error: "" });
    doble.respuestas = [
      { data: null, error: { code: "42P01", message: 'relation "public.gps_campos" does not exist' } },
      { data: null, error: null },
    ];
    expect(await leerAjustesGps("eq-1")).toEqual({ campos: [], opciones: [], error: "" });
  });

  test("una columna del club lleva su tipo; una opción, su código", async () => {
    await guardarCabeceraGps("eq-1", "propia_sprints", { etiquetas: { "es-AR": " Sprints ", "pt-BR": "" }, orden: 3, tipo: "numero" });
    const cabecera = doble.llamadas.find((llamada) => llamada[0] === "upsert");
    expect(cabecera[1]).toMatchObject({ equipo_id: "eq-1", campo: "propia_sprints", etiqueta_es: "Sprints", etiqueta_pt: "", oculto: false, orden: 3, tipo: "numero" });
    expect(cabecera[2]).toEqual({ onConflict: "equipo_id,campo" });
    doble.llamadas.length = 0;
    doble.respuestas = [{ data: null, error: { code: "42P01", message: 'relation "public.gps_opciones" does not exist' } }];
    expect(await guardarOpcionGps("eq-1", "dispositivo", { codigo: "catapult", etiquetas: { "es-AR": "Catapult" } })).toEqual({ error: "gps.ajustes.faltaMigracion" });
  });
});

describe("una opción de estrategia renombrada, también en la Descripción (nota del 12/10)", () => {
  test("se pide a la base con los nombres de antes (sin repetir ni el nuevo)", async () => {
    doble.respuestas = [{ data: 3, error: null }];
    expect(await cambiarEnDescripcionesGps("eq-1", [" CPS2 ", "CPS", "CPS2", "", "Nuevo"], " Nuevo ")).toEqual({ cambiadas: 3, error: "" });
    expect(doble.llamadas).toEqual([["rpc", "gps_cambiar_en_descripciones", { p_equipo: "eq-1", p_antes: ["CPS2", "CPS"], p_despues: "Nuevo" }]]);
  });

  test("sin nada que cambiar, no se pide", async () => {
    expect(await cambiarEnDescripcionesGps("eq-1", ["CPS"], "CPS")).toEqual({ cambiadas: 0, error: "" });
    expect(await cambiarEnDescripcionesGps("eq-1", ["CPS"], "  ")).toEqual({ cambiadas: 0, error: "" });
    expect(doble.llamadas).toEqual([]);
  });

  test("sin el SQL, nada y sin error; si falla, se avisa", async () => {
    doble.respuestas = [{ data: null, error: { code: "PGRST202", message: "Could not find the function" } }];
    expect(await cambiarEnDescripcionesGps("eq-1", ["CPS"], "CPS2")).toEqual({ cambiadas: 0, error: "" });
    doble.respuestas = [{ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }];
    expect(await cambiarEnDescripcionesGps("eq-1", ["CPS"], "CPS2")).toEqual({ cambiadas: 0, error: "gps.ajustes.errorDescripciones" });
  });
});

describe("el partido del día en Partido (GPS › Cargar)", () => {
  test("el rival y los convocados que no entraron en ningún cambio", async () => {
    doble.filas = [
      {
        id: 3,
        rival: " Rival Uno ",
        convocados: ["BANCO UNO", "BANCO DOS", "BANCO TRES"],
        titulares: ["TITULAR"],
        cambio_1_entra: "Banco Uno",
        cambio_1_sale: "TITULAR",
        cambios_extra: [{ entra: "BANCO TRES", sale: "OTRO" }],
      },
    ];
    expect(await partidoDelDia("eq-1", "2026-10-12")).toEqual({ rival: "Rival Uno", noIngresaron: ["BANCO DOS"] });
    expect(doble.llamadas).toEqual(
      expect.arrayContaining([
        ["from", "registros_partido"],
        ["eq", "equipo_id", "eq-1"],
        ["eq", "fecha", "2026-10-12"],
      ]),
    );
  });

  test("sin partido ese día, null; si no se pudo mirar, un error; sin fecha o de solo lectura, ni pregunta", async () => {
    expect(await partidoDelDia("eq-1", "2026-10-12")).toBeNull();
    doble.respuestas = [{ data: null, error: { message: "permission denied" } }];
    expect(await partidoDelDia("eq-1", "2026-10-12")).toEqual({ error: "gps.cargar.partidoNoSeLeyo" });
    doble.llamadas.length = 0;
    expect(await partidoDelDia("eq-1", "12/10/2026")).toBeNull();
    doble.soloLectura = true;
    expect(await partidoDelDia("eq-1", "2026-10-12")).toBeNull();
    expect(doble.llamadas).toEqual([]);
  });
});

describe("las cargas sin terminar (GPS › Cargar)", () => {
  const una = { id: "ec1", fecha: "2026-10-12", paso: 2, resumen: { titulo: "2. Juego", paso: 3, pasos: 6 }, version: 4, creado_email: "a@club.com", creado_en: "2026-10-12T15:00:00Z", actualizado_email: "b@club.com", actualizado_en: "2026-10-13T10:49:00Z" };

  test("las del club, de la más nueva a la más vieja; sin la migración, ninguna y sin error", async () => {
    doble.respuestas = [{ data: [una], error: null }];
    const { enCurso, faltaTabla, error } = await listarEnCurso("eq-1");
    expect(error).toBe("");
    expect(faltaTabla).toBe(false);
    expect(enCurso).toEqual([una]);
    expect(doble.llamadas).toContainEqual(["from", "gps_en_curso"]);
    expect(doble.llamadas).toContainEqual(["eq", "equipo_id", "eq-1"]);
    expect(doble.llamadas).toContainEqual(["order", "fecha", { ascending: false }]);
    // Lo hecho (pesado) no viene en la lista.
    expect(doble.llamadas.find((llamada) => llamada[0] === "select")[1]).not.toContain("datos");

    doble.respuestas = [{ data: null, error: { code: "42P01", message: 'relation "public.gps_en_curso" does not exist' } }];
    expect(await listarEnCurso("eq-1")).toEqual({ enCurso: [], faltaTabla: true, error: "" });
    // Quien ya se fue del club no las ve (ni pregunta).
    doble.soloLectura = true;
    doble.llamadas.length = 0;
    expect((await listarEnCurso("eq-1")).enCurso).toEqual([]);
    expect(doble.llamadas).toEqual([]);
  });

  test("la de un día, para no empezar otra", async () => {
    doble.respuestas = [{ data: [una], error: null }];
    expect((await enCursoDelDia("eq-1", "2026-10-12")).enCurso).toEqual(una);
    expect(doble.llamadas).toContainEqual(["eq", "fecha", "2026-10-12"]);
    doble.respuestas = [{ data: [], error: null }];
    expect(await enCursoDelDia("eq-1", "2026-10-11")).toEqual({ enCurso: null, error: "" });
    // Sin fecha, ni pregunta.
    doble.llamadas.length = 0;
    expect(await enCursoDelDia("eq-1", "")).toEqual({ enCurso: null, error: "" });
    expect(doble.llamadas).toEqual([]);
  });

  test("una, con lo hecho; si ya no está, lo dice", async () => {
    doble.respuestas = [
      { data: [una], error: null },
      { data: [{ datos: { formato: 1, estado: { fecha: "2026-10-12" } } }], error: null },
    ];
    const { enCurso, error } = await leerEnCurso("ec1");
    expect(error).toBe("");
    expect(enCurso).toEqual({ ...una, datos: { formato: 1, estado: { fecha: "2026-10-12" } } });
    expect(doble.llamadas).toContainEqual(["from", "gps_en_curso_datos"]);
    expect(doble.llamadas).toContainEqual(["eq", "en_curso_id", "ec1"]);
    doble.respuestas = [
      { data: [], error: null },
      { data: [], error: null },
    ];
    expect(await leerEnCurso("ec1")).toEqual({ enCurso: null, error: "gps.enCurso.noEsta" });
  });

  test("dejarla: nueva o la misma con la versión que se abrió, en un solo pedido; los errores, en el idioma de la app", async () => {
    doble.respuestas = [{ data: { id: "ec1", version: 1 }, error: null }];
    expect(await dejarEnCurso("eq-1", { fecha: "2026-10-12", paso: 1, resumen: { titulo: "1. Rondo" }, datos: { formato: 1, estado: {} } })).toEqual({ id: "ec1", version: 1, error: "" });
    expect(doble.llamadas).toContainEqual([
      "rpc",
      "gps_dejar_en_curso",
      { p_id: null, p_version: null, p_equipo: "eq-1", p_fecha: "2026-10-12", p_paso: 1, p_resumen: { titulo: "1. Rondo" }, p_datos: { formato: 1, estado: {} } },
    ]);
    doble.respuestas = [{ data: { id: "ec1", version: 5 }, error: null }];
    expect((await dejarEnCurso("eq-1", { id: "ec1", version: 4, fecha: "2026-10-12", paso: 2, datos: {} })).version).toBe(5);
    expect(doble.llamadas.filter((llamada) => llamada[0] === "rpc").pop()[2]).toMatchObject({ p_id: "ec1", p_version: 4 });

    const conError = async (error) => {
      doble.respuestas = [{ data: null, error }];
      return (await dejarEnCurso("eq-1", { fecha: "2026-10-12", datos: {} })).error;
    };
    expect(await conError({ code: "23505", message: 'duplicate key value violates unique constraint "gps_en_curso_un_dia"' })).toBe("gps.enCurso.yaEnCurso");
    expect(await conError({ code: "P0001", message: "gps_en_curso_otro_aparato" })).toBe("gps.enCurso.otroAparato");
    expect(await conError({ code: "P0001", message: "gps_en_curso_no_esta" })).toBe("gps.enCurso.noEsta");
    expect(await conError({ code: "23514", message: 'new row violates check constraint "gps_en_curso_datos_tamano"' })).toBe("gps.enCurso.muyGrande");
    expect(await conError({ code: "PGRST202", message: "Could not find the function public.gps_dejar_en_curso in the schema cache" })).toBe("gps.enCurso.faltaMigracion");
    expect(await conError({ code: "42501", message: 'new row violates row-level security policy for table "gps_en_curso"' })).toBe("gps.error.sinPermiso");
  });

  test("borrarla", async () => {
    doble.respuestas = [{ data: null, error: null }];
    expect(await borrarEnCurso("ec1")).toEqual({ error: "" });
    expect(doble.llamadas).toContainEqual(["from", "gps_en_curso"]);
    expect(doble.llamadas).toContainEqual(["delete"]);
    expect(doble.llamadas).toContainEqual(["eq", "id", "ec1"]);
  });
});

describe("todas las filas, rápido (Santiago, 14/10)", () => {
  const conHora = (n, hora, extra = {}) => fila(n, { actualizado_en: hora, ...extra });

  test("la primera vez: las últimas semanas primero (se muestran) y después las demás, con cuántas van", async () => {
    doble.respuestas = [
      { data: [conHora(2, "2026-10-12T10:00:00Z", { fecha: "2026-10-08" })], error: null, count: 1 },
      { data: [conHora(1, "2026-10-13T09:00:00Z", { fecha: "2026-08-01" })], error: null, count: 1 },
    ];
    const mostradas = [];
    const avances = [];
    const respuesta = await traerTodoGps("eq-1", { desdeReciente: "2026-09-16", alPrimeraParte: (filas) => mostradas.push(filas.map((una) => una.id)), alAvanzar: (n, total) => avances.push([n, total]) });
    expect(respuesta.error).toBe("");
    expect(mostradas).toEqual([["g2"]]);
    expect(respuesta.recientes.map((una) => una.id)).toEqual(["g2"]);
    expect(respuesta.viejas.map((una) => una.id)).toEqual(["g1"]);
    expect(avances).toEqual([[1, 1]]);
    // Las recientes desde el día pedido; las demás, hasta el día anterior.
    expect(doble.llamadas).toContainEqual(["gte", "fecha", "2026-09-16"]);
    expect(doble.llamadas).toContainEqual(["lte", "fecha", "2026-09-15"]);
    // Lo último que se trajo: la hora más nueva de la base.
    expect(respuesta.hasta).toBe("2026-10-13T09:00:00Z");
    // Juntas, por fecha y orden; lo reciente, como esté en la pantalla.
    const cambiada = { ...respuesta.recientes[0], datos: { d: 1 } };
    expect(unirFilasGps(respuesta.viejas, [cambiada]).map((una) => [una.id, una.datos.d])).toEqual([
      ["g1", 101],
      ["g2", 1],
    ]);
  });

  test("si las demás no llegan, vuelven las recientes con el error", async () => {
    doble.respuestas = [
      { data: [fila(2)], error: null, count: 1 },
      { data: null, error: { message: "Failed to fetch" } },
    ];
    const respuesta = await traerTodoGps("eq-1", { desdeReciente: "2026-09-16" });
    expect(respuesta.recientes.map((una) => una.id)).toEqual(["g2"]);
    expect(respuesta.viejas).toEqual([]);
    expect(respuesta.error).toBe("gps.error.noLeer");
  });

  test("al día: lo cambiado desde la última vez (con margen), sin volver a traer todo", async () => {
    const enElAparato = [conHora(1, "2026-10-12T10:00:00Z"), conHora(2, "2026-10-12T10:00:00Z")];
    doble.respuestas = [
      // Lo cambiado: la 2 (otro valor) y una nueva, la 3.
      { data: [conHora(2, "2026-10-13T11:00:00Z", { datos: { d: 999 } }), conHora(3, "2026-10-13T11:05:00Z")], error: null },
      // La cuenta de la base: 3, las mismas que quedan.
      { data: null, error: null, count: 3 },
    ];
    const respuesta = await ponerAlDiaGps("eq-1", { filas: enElAparato, hasta: "2026-10-13T10:00:00Z" });
    expect(respuesta.error).toBe("");
    expect(respuesta.cambio).toBe(true);
    expect(respuesta.filas.map((una) => [una.id, una.datos.d])).toEqual([
      ["g1", 101],
      ["g2", 999],
      ["g3", 103],
    ]);
    expect(respuesta.hasta).toBe("2026-10-13T11:05:00Z");
    // Desde 10 minutos antes de lo último que se trajo.
    expect(doble.llamadas).toContainEqual(["gte", "actualizado_en", "2026-10-13T09:50:00.000Z"]);
    // La cuenta, sin traer filas.
    expect(doble.llamadas).toContainEqual(["select", "id", { count: "exact", head: true }]);
  });

  test("al día: lo borrado por otro se va (con la cuenta de la base y solo los id)", async () => {
    const enElAparato = [conHora(1, "2026-10-12T10:00:00Z"), conHora(2, "2026-10-12T10:00:00Z")];
    doble.respuestas = [
      { data: [], error: null },
      { data: null, error: null, count: 1 },
      { data: [{ id: "g1" }], error: null },
    ];
    const respuesta = await ponerAlDiaGps("eq-1", { filas: enElAparato, hasta: "2026-10-13T10:00:00Z" });
    expect(respuesta.cambio).toBe(true);
    expect(respuesta.filas.map((una) => una.id)).toEqual(["g1"]);
  });

  test("al día sin cambios: las mismas filas (la pantalla no se redibuja); si falla, quedan las que había", async () => {
    const enElAparato = [conHora(1, "2026-10-12T10:00:00Z")];
    doble.respuestas = [
      { data: [conHora(1, "2026-10-12T10:00:00Z")], error: null },
      { data: null, error: null, count: 1 },
    ];
    const igual = await ponerAlDiaGps("eq-1", { filas: enElAparato, hasta: "2026-10-12T10:00:00Z" });
    expect(igual.cambio).toBe(false);
    expect(igual.filas).toBe(enElAparato);
    doble.respuestas = [{ data: null, error: { message: "Failed to fetch" } }];
    const sinSenal = await ponerAlDiaGps("eq-1", { filas: enElAparato, hasta: "2026-10-12T10:00:00Z" });
    expect(sinSenal).toMatchObject({ filas: enElAparato, cambio: false, error: "gps.error.noLeer" });
  });
});
