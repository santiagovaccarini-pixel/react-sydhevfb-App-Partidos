import { beforeEach, describe, expect, test, vi } from "vitest";

const sesion = vi.hoisted(() => ({ id: "cuenta-1" }));
vi.mock("../supabase.js", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: sesion.id ? { user: { id: sesion.id } } : null } }) } },
}));

const { borrarCopiasSinSenal, cuentaDelAparato, guardarCopiaSinSenal, leerCopiaSinSenal } = await import("./copiaSinSenal.js");

beforeEach(() => {
  localStorage.clear();
  sesion.id = "cuenta-1";
});

// Paso 1 de «cargar sin señal y a la vez que otra persona» (Santiago, 21/10:
// la copia «Automática en todos, sin botón»). En las pruebas no hay IndexedDB
// (como en un navegador que no lo deja): no hay copia y nada falla.
describe("la copia de este aparato para ver una base sin señal", () => {
  test("sin IndexedDB no hay copia, y guardar, leer y borrar no fallan", async () => {
    expect(await guardarCopiaSinSenal("gps", "cuenta-1", "eq-1", { filas: [] })).toBeNull();
    expect(await leerCopiaSinSenal("gps", "cuenta-1", "eq-1")).toBeNull();
    expect(await borrarCopiasSinSenal("eq-1")).toBeNull();
    expect(await borrarCopiasSinSenal()).toBeNull();
  });

  test("sin cuenta, sin club o sin datos, ni la busca", async () => {
    expect(await guardarCopiaSinSenal("lesiones", null, "eq-1", {})).toBeNull();
    expect(await guardarCopiaSinSenal("lesiones", "cuenta-1", null, {})).toBeNull();
    expect(await guardarCopiaSinSenal("lesiones", "cuenta-1", "eq-1", null)).toBeNull();
    expect(await leerCopiaSinSenal("lesiones", null, "eq-1")).toBeNull();
  });

  test("las marcas de cuando había que activarlo (20/10) se borran con las copias del club; lo demás que guarda la app queda", async () => {
    localStorage.setItem("sin_senal:eq-1:lesiones:cuenta-1", "1");
    localStorage.setItem("sin_senal:eq-1:gps:cuenta-1", "1");
    localStorage.setItem("sin_senal:eq-2:lesiones:cuenta-2", "1");
    localStorage.setItem("equipo_elegido", "{}");
    await borrarCopiasSinSenal("eq-1", "gps");
    expect(localStorage.getItem("sin_senal:eq-1:gps:cuenta-1")).toBeNull();
    expect(localStorage.getItem("sin_senal:eq-1:lesiones:cuenta-1")).toBe("1");
    await borrarCopiasSinSenal("eq-1");
    expect(localStorage.getItem("sin_senal:eq-1:lesiones:cuenta-1")).toBeNull();
    expect(localStorage.getItem("sin_senal:eq-2:lesiones:cuenta-2")).toBe("1");
    await borrarCopiasSinSenal();
    expect(localStorage.getItem("sin_senal:eq-2:lesiones:cuenta-2")).toBeNull();
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
