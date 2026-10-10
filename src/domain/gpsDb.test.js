import { beforeEach, describe, expect, test, vi } from "vitest";
import { POR_TANDA, actualizarFilaGps, borrarFilaGps, claveDeErrorGps, crearFilasGps, guardarCabeceraGps, guardarOpcionGps, leerAjustesGps, listarGps } from "./gpsDb.js";

// Un doble de Supabase que anota cada consulta y contesta, una por consulta,
// lo que haya en "respuestas" (si no hay, lo de "filas").
const doble = vi.hoisted(() => ({ llamadas: [], filas: [], respuestas: [], soloLectura: false }));

vi.mock("./alDia.js", () => ({ esSoloLectura: () => doble.soloLectura }));

vi.mock("../supabase.js", () => {
  const cadena = () => {
    const c = {};
    ["select", "eq", "gte", "lte", "order", "range", "insert", "update", "upsert", "delete", "single"].forEach((metodo) => {
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
