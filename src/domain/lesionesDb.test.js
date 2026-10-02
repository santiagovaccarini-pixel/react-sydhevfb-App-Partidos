import { beforeEach, describe, expect, test, vi } from "vitest";
import { CAMBIOS_EN_LA_FICHA, actualizarLesion, agregarJugadorBasico, historialDeLesion } from "./lesionesDb.js";

// Un doble de Supabase que anota la consulta y contesta lo configurado.
const doble = vi.hoisted(() => ({ llamadas: [], filas: [], error: null, alta: null }));

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
    ["select", "eq", "order", "limit", "update", "single"].forEach((metodo) => {
      c[metodo] = (...args) => {
        doble.llamadas.push([metodo, ...args]);
        return c;
      };
    });
    c.then = (resolver, rechazar) => Promise.resolve({ data: doble.error ? null : doble.filas, error: doble.error }).then(resolver, rechazar);
    return c;
  };
  return {
    supabase: {
      from: (tabla) => {
        doble.llamadas.push(["from", tabla]);
        return cadena();
      },
    },
  };
});

beforeEach(() => {
  doble.llamadas.length = 0;
  doble.filas = [];
  doble.error = null;
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
});

describe("agregar un jugador desde Datos básicos", () => {
  test("los errores del alta de Partido vuelven como claves del diccionario", async () => {
    doble.alta = async () => ({ error: "Ese jugador ya está en la lista." });
    expect(await agregarJugadorBasico("eq-1", "HULK")).toEqual({ error: "datos.error.repetido" });
    doble.alta = async () => ({ error: "Escribí un nombre." });
    expect(await agregarJugadorBasico("eq-1", " ")).toEqual({ error: "datos.error.nombre" });
    doble.alta = async () => ({ error: "new row violates row-level security policy" });
    expect(await agregarJugadorBasico("eq-1", "LEMOS")).toMatchObject({ error: "datos.error.guardar" });
    doble.alta = async (nombre) => ({ jugador: { id: 9, nombre } });
    expect(await agregarJugadorBasico("eq-1", "LEMOS")).toMatchObject({ jugador: { id: 9, nombre: "LEMOS", categoria: "" }, error: "" });
  });
});
