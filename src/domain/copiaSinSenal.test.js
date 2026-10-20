import { beforeEach, describe, expect, test, vi } from "vitest";

const sesion = vi.hoisted(() => ({ id: "cuenta-1" }));
vi.mock("../supabase.js", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: sesion.id ? { user: { id: sesion.id } } : null } }) } },
}));

const { activarSinSenal, borrarCopiasSinSenal, cuentaDelAparato, desactivarSinSenal, guardarCopiaSinSenal, leerCopiaSinSenal, sinSenalActivo } = await import("./copiaSinSenal.js");

beforeEach(() => {
  localStorage.clear();
  sesion.id = "cuenta-1";
});

// Paso 1 de «cargar sin señal y a la vez que otra persona» (Santiago, 20/10:
// «Solo donde se active»). En las pruebas no hay IndexedDB (como en un
// navegador que no lo deja): no hay copia y nada falla.
describe("ver una base sin señal en este aparato", () => {
  test("se activa por club, base y cuenta; desactivarlo lo saca", async () => {
    expect(sinSenalActivo("lesiones", "cuenta-1", "eq-1")).toBe(false);
    expect(activarSinSenal("lesiones", "cuenta-1", "eq-1")).toBe(true);
    expect(sinSenalActivo("lesiones", "cuenta-1", "eq-1")).toBe(true);
    expect(sinSenalActivo("evaluaciones", "cuenta-1", "eq-1")).toBe(false);
    expect(sinSenalActivo("lesiones", "cuenta-2", "eq-1")).toBe(false);
    expect(sinSenalActivo("lesiones", "cuenta-1", "eq-2")).toBe(false);
    await desactivarSinSenal("lesiones", "cuenta-1", "eq-1");
    expect(sinSenalActivo("lesiones", "cuenta-1", "eq-1")).toBe(false);
  });

  test("sin cuenta o sin club, no se activa", () => {
    expect(activarSinSenal("lesiones", null, "eq-1")).toBe(false);
    expect(activarSinSenal("lesiones", "cuenta-1", null)).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  test("sin IndexedDB no hay copia, y guardar y leer no fallan", async () => {
    activarSinSenal("gps", "cuenta-1", "eq-1");
    expect(await guardarCopiaSinSenal("gps", "cuenta-1", "eq-1", { filas: [] })).toBeNull();
    expect(await leerCopiaSinSenal("gps", "cuenta-1", "eq-1")).toBeNull();
    // Sin activar, ni la busca.
    expect(await leerCopiaSinSenal("lesiones", "cuenta-1", "eq-1")).toBeNull();
  });

  test("se borra lo de un club, lo de una base de un club o todo; lo demás que guarda la app queda", async () => {
    activarSinSenal("lesiones", "cuenta-1", "eq-1");
    activarSinSenal("gps", "cuenta-1", "eq-1");
    activarSinSenal("lesiones", "cuenta-2", "eq-2");
    localStorage.setItem("equipo_elegido", "{}");
    await borrarCopiasSinSenal("eq-1", "gps");
    expect([sinSenalActivo("lesiones", "cuenta-1", "eq-1"), sinSenalActivo("gps", "cuenta-1", "eq-1"), sinSenalActivo("lesiones", "cuenta-2", "eq-2")]).toEqual([true, false, true]);
    await borrarCopiasSinSenal("eq-1");
    expect([sinSenalActivo("lesiones", "cuenta-1", "eq-1"), sinSenalActivo("lesiones", "cuenta-2", "eq-2")]).toEqual([false, true]);
    await borrarCopiasSinSenal();
    expect(sinSenalActivo("lesiones", "cuenta-2", "eq-2")).toBe(false);
    expect(localStorage.getItem("equipo_elegido")).toBe("{}");
  });

  test("la cuenta del aparato: la de la sesión o, sin sesión, la última que entró", async () => {
    expect(await cuentaDelAparato()).toBe("cuenta-1");
    sesion.id = null;
    localStorage.setItem("perfil_cuenta", JSON.stringify({ user_id: "cuenta-guardada" }));
    expect(await cuentaDelAparato()).toBe("cuenta-guardada");
    localStorage.clear();
    expect(await cuentaDelAparato()).toBeNull();
  });
});
