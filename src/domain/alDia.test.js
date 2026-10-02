import { beforeEach, describe, expect, test, vi } from "vitest";
import { esSoloLectura, leerAlDia, masNuevasPrimero } from "./alDia.js";
import { guardarEquipoElegido } from "./equipo.js";
import { cargarPlantel, cargarPlantelConCatapult } from "./plantel.js";
import { cargarPlantelLesiones, listarLesiones } from "./lesionesDb.js";
import { leerEntrenamientoDb, listarEntrenamientosDb } from "./entrenamientosDb.js";

// Un doble de Supabase: anota qué se pidió (tablas o la foto) y contesta lo
// que cada prueba configure.
const doble = vi.hoisted(() => ({ llamadas: [], foto: {}, error: null, tablas: {} }));

vi.mock("../supabase.js", () => {
  const cadena = (tabla) => {
    const c = {};
    ["select", "eq", "order", "limit"].forEach((metodo) => {
      c[metodo] = (...args) => {
        doble.llamadas.push([metodo, ...args]);
        return c;
      };
    });
    c.then = (resolver, rechazar) => Promise.resolve({ data: doble.tablas[tabla] || [], error: null }).then(resolver, rechazar);
    return c;
  };
  return {
    supabase: {
      from: (tabla) => {
        doble.llamadas.push(["from", tabla]);
        return cadena(tabla);
      },
      rpc: async (funcion, parametros) => {
        doble.llamadas.push(["rpc", funcion, parametros]);
        if (doble.error) return { data: null, error: doble.error };
        return { data: doble.foto[parametros.p_tabla] ?? [], error: null };
      },
    },
  };
});

const UNO = "00000000-0000-0000-0000-0000000000c1";
const DOS = "00000000-0000-0000-0000-0000000000c2";

const pidioTabla = () => doble.llamadas.some(([paso]) => paso === "from");
const pidioFoto = (tabla) =>
  doble.llamadas.some(([paso, funcion, parametros]) => paso === "rpc" && funcion === "datos_al_dia" && parametros.p_tabla === tabla);

beforeEach(() => {
  localStorage.clear();
  doble.llamadas.length = 0;
  doble.foto = {};
  doble.error = null;
  doble.tablas = {};
});

describe("quién lee la foto", () => {
  test("solo el club elegido, y solo si ya se fue", () => {
    guardarEquipoElegido({ id: UNO, nombre: "Uno", hasta: "2026-03-31" });
    expect(esSoloLectura(UNO)).toBe(true);
    expect(esSoloLectura(DOS)).toBe(false);
    expect(esSoloLectura(null)).toBe(false);

    guardarEquipoElegido({ id: UNO, nombre: "Uno", hasta: null });
    expect(esSoloLectura(UNO)).toBe(false);
  });

  test("la foto se pide a la base con la tabla y el club, y se descarta lo roto", async () => {
    doble.foto.jugadores = [{ id: 1, nombre: "VIEJO" }, null, "x"];
    expect(await leerAlDia("jugadores", UNO)).toEqual([{ id: 1, nombre: "VIEJO" }]);
    expect(doble.llamadas).toContainEqual(["rpc", "datos_al_dia", { p_tabla: "jugadores", p_equipo: UNO }]);
  });

  test("un error de la base no se disimula", async () => {
    doble.error = { message: "permission denied" };
    await expect(leerAlDia("jugadores", UNO)).rejects.toEqual({ message: "permission denied" });
  });

  test("lo más nuevo primero", () => {
    const filas = [{ fecha: "2026-01-02" }, { fecha: "2026-03-01" }, { fecha: "" }, { fecha: "2026-02-10" }];
    expect(masNuevasPrimero(filas, "fecha").map((fila) => fila.fecha)).toEqual(["2026-03-01", "2026-02-10", "2026-01-02", ""]);
    expect(filas[0].fecha).toBe("2026-01-02");
  });
});

describe("quien ya se fue del club lee la foto, no las tablas", () => {
  beforeEach(() => {
    guardarEquipoElegido({ id: UNO, nombre: "Uno", hasta: "2026-03-31" });
    doble.foto = {
      jugadores: [
        { id: 2, nombre: "ZETA", roles: ["Ataque"], puestos: ["DEL"], catapult_id: 77, catapult_nombre: "Zeta" },
        { id: 1, nombre: "ALFA", roles: [], puestos: [] },
      ],
      lesiones: [
        { id: "l1", equipo_id: UNO, jugador_id: 1, fecha_lesion: "2026-01-05", datos: {} },
        { id: "l2", equipo_id: UNO, jugador_id: 2, fecha_lesion: "2026-03-20", datos: {} },
      ],
      entrenamientos: [
        { id: "e1", equipo_id: UNO, fecha: "2026-02-01", nombre: "Mañana", estado: "enviado", tareas_cantidad: 2, actualizado_en: "2026-02-01T12:00:00Z", datos: { tareas: [] } },
        { id: "e2", equipo_id: UNO, fecha: "2026-03-10", nombre: "Tarde", estado: "vacio", tareas_cantidad: 0, actualizado_en: "2026-03-10T20:00:00Z", datos: { tareas: [] } },
      ],
    };
  });

  test("el plantel de Partido, ordenado y sin guardarse en el celular", async () => {
    const { plantel, desde } = await cargarPlantel(UNO);
    expect(plantel.map((jugador) => jugador.nombre)).toEqual(["ALFA", "ZETA"]);
    expect(desde).toBe("base");
    expect(pidioFoto("jugadores")).toBe(true);
    expect(pidioTabla()).toBe(false);
    expect(localStorage.getItem(`plantel_jugadores:${UNO}`)).toBeNull();
  });

  test("si la foto no se puede leer, el plantel queda vacío: nada de la copia del celular", async () => {
    localStorage.setItem(`plantel_jugadores:${UNO}`, JSON.stringify([{ id: 9, nombre: "NUEVO", roles: [], puestos: [] }]));
    doble.error = { message: "Failed to fetch" };
    const { plantel } = await cargarPlantel(UNO);
    expect(plantel).toEqual([]);
    expect(pidioTabla()).toBe(false);
  });

  test("la lista con chalecos, si falla, avisa sin el error crudo", async () => {
    doble.error = { message: "Could not find the function public.datos_al_dia" };
    const { plantel, error } = await cargarPlantelConCatapult(UNO);
    expect(plantel).toEqual([]);
    expect(error).toBe("No se pudo leer la lista de jugadores de este club. Probá de nuevo en un rato.");
  });

  test("la lista con chalecos de Flujo diario, también de la foto", async () => {
    const { plantel, error } = await cargarPlantelConCatapult(UNO);
    expect(error).toBe("");
    expect(plantel.find((jugador) => jugador.nombre === "ZETA").catapult_id).toBe("77");
    expect(pidioTabla()).toBe(false);
    expect(localStorage.getItem(`plantel_catapult:${UNO}`)).toBeNull();
  });

  test("las lesiones, de la más nueva a la más vieja", async () => {
    const { lesiones, error } = await listarLesiones(UNO);
    expect(error).toBe("");
    expect(lesiones.map((lesion) => lesion.id)).toEqual(["l2", "l1"]);
    expect(pidioFoto("lesiones")).toBe(true);
    expect(pidioTabla()).toBe(false);
  });

  test("el plantel de Lesiones y Datos básicos", async () => {
    const { plantel } = await cargarPlantelLesiones(UNO);
    expect(plantel.map((jugador) => jugador.nombre)).toEqual(["ALFA", "ZETA"]);
    expect(pidioTabla()).toBe(false);
  });

  test("si la base no deja leer la foto, se dice", async () => {
    doble.error = { message: "permission denied for function datos_al_dia" };
    const { lesiones, error } = await listarLesiones(UNO);
    expect(lesiones).toEqual([]);
    expect(error).toBeTruthy();
  });

  test("los entrenamientos: la lista y uno abierto entero", async () => {
    const lista = await listarEntrenamientosDb(UNO);
    expect(lista.map((resumen) => resumen.id)).toEqual(["e2", "e1"]);
    expect(lista[0]).toMatchObject({ nombre: "Tarde", equipoId: UNO });

    const abierto = await leerEntrenamientoDb("e1", UNO);
    expect(abierto).toMatchObject({ id: "e1", nombre: "Mañana", fecha: "2026-02-01", equipoId: UNO });
    expect(await leerEntrenamientoDb("otro", UNO)).toBeNull();
    expect(pidioTabla()).toBe(false);
  });

  test("en el club donde sigue, las tablas como siempre", async () => {
    doble.tablas.jugadores = [{ id: 9, nombre: "DE DOS" }];
    guardarEquipoElegido({ id: DOS, nombre: "Dos", hasta: null });
    const { plantel } = await cargarPlantel(DOS);
    expect(plantel.map((jugador) => jugador.nombre)).toEqual(["DE DOS"]);
    expect(doble.llamadas).toContainEqual(["from", "jugadores"]);
    expect(doble.llamadas.some(([paso]) => paso === "rpc")).toBe(false);
  });
});
