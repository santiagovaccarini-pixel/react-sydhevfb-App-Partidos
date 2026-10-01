import { describe, expect, test } from "vitest";
import {
  claveDeErrorDeBase,
  diasDeBaja,
  estadoDelPlantel,
  gravedad,
  lesionVacia,
  lesionesActivas,
  posibleRecidiva,
  seSolapa,
  validarLesion,
} from "./lesiones.js";

const base = (extra = {}) =>
  lesionVacia({ id: "a", jugador_id: 7, fecha_lesion: "2026-09-01", region: "muslo_posterior", lado: "derecho", ...extra });

describe("días de baja y gravedad", () => {
  test("cuenta hasta el alta, o hasta hoy si sigue activa", () => {
    expect(diasDeBaja(base({ fecha_alta: "2026-09-11" }))).toBe(10);
    expect(diasDeBaja(base(), "2026-09-04")).toBe(3);
    expect(diasDeBaja(base({ fecha_alta: "2026-09-01" }))).toBe(0);
  });

  test("mínima, leve, moderada, grave; activa mientras no hay alta", () => {
    expect(gravedad(base())).toBe("activa");
    expect(gravedad(base({ fecha_alta: "2026-09-01" }))).toBe("minima");
    expect(gravedad(base({ fecha_alta: "2026-09-08" }))).toBe("leve");
    expect(gravedad(base({ fecha_alta: "2026-09-29" }))).toBe("moderada");
    expect(gravedad(base({ fecha_alta: "2026-09-30" }))).toBe("grave");
  });
});

describe("validar", () => {
  const hoy = "2026-10-01";
  test("pide jugador, fecha, región y lado, y no acepta fechas raras", () => {
    expect(validarLesion(base({ jugador_id: null }), { hoy })).toBe("lesiones.error.jugador");
    expect(validarLesion(base({ fecha_lesion: "" }), { hoy })).toBe("lesiones.error.fecha");
    expect(validarLesion(base({ fecha_lesion: "2026-10-02" }), { hoy })).toBe("lesiones.error.fechaFutura");
    expect(validarLesion(base({ fecha_alta: "2026-08-30" }), { hoy })).toBe("lesiones.error.altaAntes");
    expect(validarLesion(base({ fecha_alta: "2026-10-05" }), { hoy })).toBe("lesiones.error.altaFutura");
    expect(validarLesion(base({ region: "" }), { hoy })).toBe("lesiones.error.region");
    expect(validarLesion(base({ lado: "" }), { hoy })).toBe("lesiones.error.lado");
    expect(validarLesion(base(), { hoy })).toBe("");
  });

  test("no deja dos lesiones a la vez en la misma región y lado", () => {
    const activa = base({ id: "otra" });
    expect(seSolapa(base({ id: "nueva", fecha_lesion: "2026-09-20" }), [activa])).toBe(true);
    expect(seSolapa(base({ id: "nueva", fecha_lesion: "2026-09-20", lado: "izquierdo" }), [activa])).toBe(false);
    const cerrada = base({ id: "otra", fecha_alta: "2026-09-10" });
    expect(seSolapa(base({ id: "nueva", fecha_lesion: "2026-09-10" }), [cerrada])).toBe(false);
    expect(seSolapa(base({ id: "nueva", fecha_lesion: "2026-09-09" }), [cerrada])).toBe(true);
    expect(validarLesion(base({ id: "nueva", fecha_lesion: "2026-09-20" }), { hoy, otras: [activa] })).toBe("lesiones.error.solapada");
    // Editarse a sí misma no cuenta como solaparse.
    expect(seSolapa(activa, [activa])).toBe(false);
  });
});

describe("recidiva y plantel", () => {
  test("avisa si hubo una lesión igual con alta hace menos de dos meses", () => {
    const anterior = base({ id: "vieja", fecha_lesion: "2026-07-01", fecha_alta: "2026-08-01" });
    expect(posibleRecidiva(base({ id: null, fecha_lesion: "2026-09-15" }), [anterior])?.id).toBe("vieja");
    expect(posibleRecidiva(base({ id: null, fecha_lesion: "2026-10-15" }), [anterior])).toBe(null);
    expect(posibleRecidiva(base({ id: null, fecha_lesion: "2026-09-15", lado: "izquierdo" }), [anterior])).toBe(null);
  });

  test("el plantel dice quién está lesionado hoy", () => {
    const plantel = [{ id: 7, nombre: "Hulk" }, { id: 8, nombre: "Scarpa" }];
    const lesiones = [base(), base({ id: "b", jugador_id: 8, fecha_alta: "2026-09-05" })];
    expect(lesionesActivas(lesiones).map((lesion) => lesion.id)).toEqual(["a"]);
    expect(estadoDelPlantel(plantel, lesiones).map((fila) => fila.lesiones.length)).toEqual([1, 0]);
  });

  test("los errores de la base se traducen a claves", () => {
    expect(claveDeErrorDeBase({ code: "42P01", message: "relation public.lesiones does not exist" })).toBe("lesiones.error.faltaMigracion");
    expect(claveDeErrorDeBase({ message: "Could not find the table 'public.lesiones' in the schema cache" })).toBe("lesiones.error.faltaMigracion");
    expect(claveDeErrorDeBase({ code: "42501", message: "new row violates row-level security policy" })).toBe("lesiones.error.sinPermiso");
    expect(claveDeErrorDeBase({ code: "23P01", message: "conflicting key value violates exclusion constraint lesiones_sin_solapar" })).toBe("lesiones.error.solapada");
    expect(claveDeErrorDeBase({ message: "otra cosa" })).toBe("");
  });
});
