import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  POR_BORRADO,
  POR_TANDA,
  SIN_DISPOSITIVO,
  SOLO_PROMEDIOS,
  actualizarFilaGps,
  borrarFilaGps,
  borrarFilasGps,
  claveDeErrorGps,
  crearFilasGps,
  guardarCabeceraGps,
  guardarOpcionGps,
  leerAjustesGps,
  listarGps,
} from "./gpsDb.js";

// Un doble de Supabase que anota cada consulta y contesta, una por consulta,
// lo que haya en "respuestas" (si no hay, lo de "filas").
const doble = vi.hoisted(() => ({ llamadas: [], filas: [], respuestas: [], soloLectura: false }));

vi.mock("./alDia.js", () => ({ esSoloLectura: () => doble.soloLectura }));

vi.mock("../supabase.js", () => {
  const cadena = () => {
    const c = {};
    ["select", "eq", "gte", "lte", "not", "is", "in", "order", "range", "insert", "update", "upsert", "delete", "single"].forEach((metodo) => {
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
