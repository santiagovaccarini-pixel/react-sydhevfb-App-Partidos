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

const {
  agruparPerfiles,
  contarPendientes,
  decidirPerfil,
  leerMiPerfil,
  listarPerfiles,
  permisosDePerfil,
  permisosEnClub,
  situacionDePerfil,
} = await import("./perfilesDb.js");

describe("permisos y situación de una cuenta", () => {
  it("el administrador puede todo; los demás, lo marcado", () => {
    expect(permisosDePerfil({ admin: true })).toEqual({ partido: true, flujo: true, lesiones: true, evaluaciones: true, datos: true, admin: true });
    expect(permisosDePerfil({ partido: true, flujo: false, admin: false })).toEqual({
      partido: true,
      flujo: false,
      lesiones: false,
      evaluaciones: false,
      datos: true,
      admin: false,
    });
    expect(permisosDePerfil({ lesiones: true })).toMatchObject({ lesiones: true, datos: true });
    expect(permisosDePerfil(null)).toEqual({ partido: false, flujo: false, lesiones: false, evaluaciones: false, datos: false, admin: false });
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
      datos: true,
      admin: false,
      adminClub: false,
    });
    // Solo Evaluaciones (una preparadora física): también ve Datos básicos.
    expect(permisosEnClub(cuenta, { id: "c1", rol: "staff", partido: false, flujo: false, lesiones: false, evaluaciones: true })).toMatchObject({
      lesiones: false,
      evaluaciones: true,
      datos: true,
    });
    expect(permisosEnClub(cuenta, { id: "c1", rol: "admin", partido: true, flujo: false, lesiones: false }).adminClub).toBe(true);
    // Quien ya se fue no administra.
    expect(permisosEnClub(cuenta, { id: "c1", rol: "admin", hasta: "2026-09-25", partido: true }).adminClub).toBe(false);
    // Base vieja (sin rol ni módulos en el club): vale lo de la cuenta.
    expect(permisosEnClub(cuenta, { id: "c1" })).toMatchObject({ partido: true, flujo: true, lesiones: false, datos: true, adminClub: false });
    // El dueño administra cualquier club de la base vieja; sin club, nada.
    expect(permisosEnClub(permisosDePerfil({ admin: true }), { id: "c1" }).adminClub).toBe(true);
    expect(permisosEnClub(cuenta, null)).toMatchObject({ partido: false, datos: false, adminClub: false });
  });
});

describe("las cuentas para el administrador", () => {
  beforeEach(() => {
    supa.pedidos = [];
    supa.respuesta = { data: null, error: null, count: null };
  });

  it("agrupa por estado y marca la propia", () => {
    const grupos = agruparPerfiles(
      [
        { user_id: "a", estado: "autorizado" },
        { user_id: "b", estado: "pendiente" },
        { user_id: "c", estado: "bloqueado" },
        { user_id: "d" },
      ],
      "a",
    );
    expect(grupos.conAcceso.map((p) => [p.user_id, p.esMia])).toEqual([["a", true]]);
    expect(grupos.pendientes.map((p) => p.user_id)).toEqual(["b", "d"]);
    expect(grupos.sinAcceso.map((p) => p.user_id)).toEqual(["c"]);
    expect(agruparPerfiles(null, "a")).toEqual({ pendientes: [], conAcceso: [], sinAcceso: [] });
  });

  it("lista y cuenta con las consultas justas", async () => {
    supa.respuesta = { data: [{ user_id: "a" }], error: null, count: null };
    expect(await listarPerfiles()).toEqual([{ user_id: "a" }]);
    expect(supa.pedidos[0].tabla).toBe("perfiles");
    expect(supa.pedidos[0].pasos[1]).toEqual(["order", "creado_en", { ascending: true }]);

    supa.respuesta = { data: null, error: null, count: 3 };
    expect(await contarPendientes()).toBe(3);
    expect(supa.pedidos[1].pasos).toEqual([
      ["select", "user_id", { count: "exact", head: true }],
      ["eq", "estado", "pendiente"],
    ]);

    // Los errores de la base, como clave del diccionario (Supabase contesta en
    // inglés); el de red, marcado como de red.
    supa.respuesta = { data: null, error: { message: "permission denied" }, count: null };
    await expect(listarPerfiles()).rejects.toThrow("cuentas.errorLeer");
    await expect(contarPendientes()).rejects.toThrow("cuentas.errorLeer");
    await expect(leerMiPerfil("a")).rejects.toThrow("acceso.error.noComprobar");
    supa.respuesta = { data: null, error: { message: "TypeError: Failed to fetch" }, count: null };
    await expect(leerMiPerfil("a")).rejects.toMatchObject({ message: "comun.sinConexion", deRed: true });
  });

  it("lee la propia cuenta por user_id", async () => {
    supa.respuesta = { data: { user_id: "a", estado: "autorizado" }, error: null };
    expect(await leerMiPerfil("a")).toEqual({ user_id: "a", estado: "autorizado" });
    expect(supa.pedidos[0].pasos[1]).toEqual(["eq", "user_id", "a"]);
    supa.respuesta = { data: null, error: null };
    expect(await leerMiPerfil("a")).toBeNull();
  });

  it("decide solo estado y módulos, y avisa si la base no cambió nada", async () => {
    supa.respuesta = { data: [{ user_id: "b", estado: "autorizado", partido: true }], error: null };
    const fila = await decidirPerfil("b", { estado: "autorizado", partido: true, email: "no@va.com", rol: "x" });
    expect(fila.estado).toBe("autorizado");
    expect(supa.pedidos[0].pasos[0]).toEqual(["update", { estado: "autorizado", partido: true }]);
    expect(supa.pedidos[0].pasos[1]).toEqual(["eq", "user_id", "b"]);

    supa.respuesta = { data: [], error: null };
    await expect(decidirPerfil("b", { estado: "bloqueado" })).rejects.toThrow("cuentas.errorCambiarSinPermiso");

    supa.respuesta = { data: null, error: { message: "permission denied for table perfiles" } };
    await expect(decidirPerfil("b", { admin: true })).rejects.toThrow("cuentas.errorCambiar");
  });
});
