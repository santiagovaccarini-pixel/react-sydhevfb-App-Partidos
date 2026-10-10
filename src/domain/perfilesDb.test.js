import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase de mentira: registra qué se pidió y devuelve lo que la prueba diga.
const supa = vi.hoisted(() => ({ pedidos: [], respuesta: { data: null, error: null, count: null } }));

vi.mock("../supabase.js", () => ({
  supabase: {
    from: (tabla) => {
      const pedido = { tabla, pasos: [] };
      supa.pedidos.push(pedido);
      const cadena = {
        then: (resolver, rechazar) => Promise.resolve(supa.respuesta).then(resolver, rechazar),
      };
      for (const metodo of ["select", "eq", "order", "update", "maybeSingle"]) {
        cadena[metodo] = (...args) => {
          pedido.pasos.push([metodo, ...args]);
          return metodo === "maybeSingle" ? Promise.resolve(supa.respuesta) : cadena;
        };
      }
      return cadena;
    },
  },
}));

const { leerMiPerfil, permisosDePerfil, permisosEnClub, situacionDePerfil } = await import("./perfilesDb.js");

describe("permisos y situación de una cuenta", () => {
  it("los módulos de la cuenta son los marcados; ser dueño no da ninguno", () => {
    expect(permisosDePerfil({ partido: true, flujo: false, admin: true })).toEqual({
      partido: true,
      flujo: false,
      lesiones: false,
      evaluaciones: false,
      gps: false,
      datos: true,
      dueno: null,
      esDueno: false,
    });
    expect(permisosDePerfil({ lesiones: true })).toMatchObject({ lesiones: true, datos: true });
    // El dueño (lo dice mi_cuenta, viaja en la copia como `dueno`) no suma módulos.
    expect(permisosDePerfil({ dueno: "principal" })).toEqual({
      partido: false,
      flujo: false,
      lesiones: false,
      evaluaciones: false,
      gps: false,
      datos: false,
      dueno: "principal",
      esDueno: true,
    });
    expect(permisosDePerfil({ dueno: "sub" })).toMatchObject({ dueno: "sub", esDueno: true });
    expect(permisosDePerfil({ dueno: "otra cosa" })).toMatchObject({ dueno: null, esDueno: false });
    expect(permisosDePerfil(null)).toEqual({ partido: false, flujo: false, lesiones: false, evaluaciones: false, gps: false, datos: false, dueno: null, esDueno: false });
  });

  it("pendiente, bloqueada u ok: los módulos ya no los da la cuenta", () => {
    expect(situacionDePerfil(null)).toBe("pendiente");
    expect(situacionDePerfil({ estado: "pendiente" })).toBe("pendiente");
    expect(situacionDePerfil({ estado: "bloqueado", partido: true })).toBe("bloqueado");
    expect(situacionDePerfil({ estado: "autorizado" })).toBe("ok");
    expect(situacionDePerfil({ estado: "autorizado", admin: true })).toBe("ok");
  });

  it("en un club, manda la membresía: módulos, admin del club y solo lectura", () => {
    const cuenta = permisosDePerfil({ partido: true, flujo: true });
    // Base con cuentas v2: el club trae rol y módulos.
    expect(permisosEnClub(cuenta, { id: "c1", rol: "staff", partido: false, flujo: false, lesiones: true, evaluaciones: false })).toEqual({
      partido: false,
      flujo: false,
      lesiones: true,
      evaluaciones: false,
      gps: false,
      datos: true,
      dueno: null,
      esDueno: false,
      adminClub: false,
    });
    // Solo Evaluaciones (una preparadora física): también ve Datos básicos.
    expect(permisosEnClub(cuenta, { id: "c1", rol: "staff", partido: false, flujo: false, lesiones: false, evaluaciones: true })).toMatchObject({
      lesiones: false,
      evaluaciones: true,
      datos: true,
    });
    // Solo GPS: también ve Datos básicos (los jugadores de cada fila).
    expect(permisosEnClub(cuenta, { id: "c1", rol: "staff", partido: false, flujo: false, lesiones: false, evaluaciones: false, gps: true })).toMatchObject({
      lesiones: false,
      evaluaciones: false,
      gps: true,
      datos: true,
    });
    expect(permisosEnClub(cuenta, { id: "c1", rol: "admin", partido: true, flujo: false, lesiones: false }).adminClub).toBe(true);
    // Quien ya se fue no administra.
    expect(permisosEnClub(cuenta, { id: "c1", rol: "admin", hasta: "2026-09-25", partido: true }).adminClub).toBe(false);
    // Base vieja (sin rol ni módulos en el club): vale lo de la cuenta.
    expect(permisosEnClub(cuenta, { id: "c1" })).toMatchObject({ partido: true, flujo: true, lesiones: false, datos: true, adminClub: false });
    // El dueño de la app no administra ningún club por serlo: ni en la base vieja.
    const dueno = permisosDePerfil({ dueno: "principal" });
    expect(permisosEnClub(dueno, { id: "c1" })).toMatchObject({ adminClub: false, datos: false, esDueno: true });
    expect(permisosEnClub(dueno, { id: "c1", rol: "staff", partido: true })).toMatchObject({ adminClub: false, partido: true, dueno: "principal" });
    expect(permisosEnClub(dueno, null)).toMatchObject({ partido: false, datos: false, adminClub: false, esDueno: true });
  });
});

describe("la propia cuenta", () => {
  beforeEach(() => {
    supa.pedidos = [];
    supa.respuesta = { data: null, error: null, count: null };
  });

  it("lee la propia cuenta por user_id", async () => {
    supa.respuesta = { data: { user_id: "a", estado: "autorizado" }, error: null };
    expect(await leerMiPerfil("a")).toEqual({ user_id: "a", estado: "autorizado" });
    expect(supa.pedidos[0].tabla).toBe("perfiles");
    expect(supa.pedidos[0].pasos[1]).toEqual(["eq", "user_id", "a"]);
    supa.respuesta = { data: null, error: null };
    expect(await leerMiPerfil("a")).toBeNull();
  });

  it("los errores de la base, como clave del diccionario; el de red, marcado", async () => {
    supa.respuesta = { data: null, error: { message: "permission denied" }, count: null };
    await expect(leerMiPerfil("a")).rejects.toThrow("acceso.error.noComprobar");
    supa.respuesta = { data: null, error: { message: "TypeError: Failed to fetch" }, count: null };
    await expect(leerMiPerfil("a")).rejects.toMatchObject({ message: "comun.sinConexion", deRed: true });
  });
});
