import { beforeEach, describe, expect, it, vi } from "vitest";

// Una base de mentira que anota cada pedido y contesta lo que diga la prueba.
const base = vi.hoisted(() => ({ pedidos: [], responder: () => ({ data: [], error: null }) }));
vi.mock("../supabase.js", () => ({
  supabase: {
    from: (tabla) => {
      const pedido = { tabla, op: "select", filtros: [], datos: null };
      base.pedidos.push(pedido);
      const q = {
        select: () => q,
        insert: (datos) => {
          pedido.op = "insert";
          pedido.datos = datos;
          return q;
        },
        update: (datos) => {
          pedido.op = "update";
          pedido.datos = datos;
          return q;
        },
        eq: (columna, valor) => {
          pedido.filtros.push(["eq", columna, valor]);
          return q;
        },
        is: (columna, valor) => {
          pedido.filtros.push(["is", columna, valor]);
          return q;
        },
        order: () => q,
        limit: () => q,
        then: (bien, mal) => Promise.resolve(base.responder(pedido)).then(bien, mal),
      };
      return q;
    },
  },
}));

const {
  cambiarModulo,
  cambiarRol,
  cancelarInvitacion,
  claveDeError,
  darDeBaja,
  estadoDeMembresia,
  invitar,
  listarMiembros,
  ordenarMiembros,
  reincorporar,
} = await import("./membresiasDb.js");
const { hoyISO } = await import("../idioma/formatos.js");

beforeEach(() => {
  base.pedidos = [];
  base.responder = () => ({ data: [], error: null });
});

describe("la membresía de una cuenta en un club", () => {
  it("está, se fue o nunca estuvo", () => {
    expect(estadoDeMembresia(null)).toBe("ninguno");
    expect(estadoDeMembresia({ hasta: null })).toBe("activo");
    expect(estadoDeMembresia({ hasta: "2026-09-25" })).toBe("hasta");
  });

  it("los errores de la base se vuelven claves del diccionario", () => {
    expect(claveDeError({ message: "ultimo_admin" })).toBe("cuentas.errorUltimoAdmin");
    expect(claveDeError({ message: "hasta_futura" })).toBe("cuentas.errorHastaFutura");
    expect(claveDeError({ message: "correo_invalido" })).toBe("cuentas.errorCorreo");
    expect(claveDeError({ message: 'duplicate key value violates unique constraint "club_invitaciones_abierta_unica"' })).toBe(
      "cuentas.errorInvitacionRepetida",
    );
    expect(claveDeError({ code: "42501", message: "new row violates row-level security policy" })).toBe("cuentas.errorSinPermiso");
    expect(claveDeError({ code: "42P01", message: 'relation "public.v_miembros_club" does not exist' })).toBe("cuentas.errorFaltaMigracion");
    expect(claveDeError({ message: "otra cosa" })).toBe("cuentas.errorClub");
  });

  it("ordena: administradores, staff y al final los que se fueron (el más reciente primero)", () => {
    const lista = ordenarMiembros([
      { email: "zeta@x.com", rol: "staff", hasta: null },
      { email: "vieja@x.com", rol: "staff", hasta: "2026-01-31" },
      { email: "ana@x.com", rol: "admin", hasta: null },
      { email: "beto@x.com", rol: "staff", hasta: null },
      { email: "reciente@x.com", rol: "admin", hasta: "2026-09-25" },
    ]);
    expect(lista.map((m) => m.email)).toEqual(["ana@x.com", "beto@x.com", "zeta@x.com", "reciente@x.com", "vieja@x.com"]);
  });

  it("lee la gente del club desde la vista, y si falta la migración lo dice", async () => {
    base.responder = () => ({
      data: [{ equipo_id: "c1", user_id: "u1", email: "ana@x.com", estado: "autorizado", rol: "admin", partido: true, flujo: 1, lesiones: null }],
      error: null,
    });
    const lista = await listarMiembros("c1");
    expect(base.pedidos[0]).toMatchObject({ tabla: "v_miembros_club", filtros: [["eq", "equipo_id", "c1"]] });
    expect(lista[0]).toMatchObject({ email: "ana@x.com", rol: "admin", partido: true, flujo: true, lesiones: false, hasta: null });

    base.responder = () => ({ data: null, error: { code: "42P01", message: "relation does not exist" } });
    await expect(listarMiembros("c1")).rejects.toThrow("cuentas.errorFaltaMigracion");
  });

  it("rol, módulos, baja y reincorporación cambian la fila justa", async () => {
    base.responder = (pedido) => ({ data: [{ equipo_id: "c1", user_id: "u2", ...pedido.datos }], error: null });
    await cambiarRol("u2", "c1", "admin");
    await cambiarModulo("u2", "c1", "lesiones", true);
    await darDeBaja("u2", "c1", "2026-09-25");
    const vuelto = await reincorporar("u2", "c1");
    expect(base.pedidos.map((p) => p.datos)).toEqual([
      { rol: "admin" },
      { lesiones: true },
      { hasta: "2026-09-25" },
      { hasta: null, desde: hoyISO() },
    ]);
    expect(base.pedidos[0]).toMatchObject({ tabla: "club_miembros", op: "update", filtros: [["eq", "equipo_id", "c1"], ["eq", "user_id", "u2"]] });
    expect(vuelto.hasta).toBeNull();
    // Sin el correo ni el estado de la cuenta (no están en club_miembros):
    // así Cuentas no los borra de la lista al cambiar un módulo.
    const cambiado = await cambiarModulo("u2", "c1", "evaluaciones", true);
    expect(cambiado).toMatchObject({ user_id: "u2", evaluaciones: true });
    expect(cambiado).not.toHaveProperty("email");
    expect(cambiado).not.toHaveProperty("estado");
    expect(() => cambiarModulo("u2", "c1", "admin", true)).toThrow("cuentas.errorClub");
  });

  it("si la base no deja, avisa con la razón", async () => {
    base.responder = () => ({ data: [], error: null });
    await expect(cambiarRol("u2", "c1", "staff")).rejects.toThrow("cuentas.errorSinPermiso");
    base.responder = () => ({ data: null, error: { message: "ultimo_admin", code: "P0001" } });
    await expect(darDeBaja("u1", "c1", "2026-10-01")).rejects.toThrow("cuentas.errorUltimoAdmin");
  });
});

describe("las invitaciones", () => {
  it("un correo mal escrito ni llega a la base", async () => {
    await expect(invitar("c1", { email: "cualquiera" })).rejects.toThrow("cuentas.errorCorreo");
    expect(base.pedidos).toHaveLength(0);
  });

  it("invita con el correo limpio y dice si la cuenta entró en el acto", async () => {
    base.responder = (pedido) => (pedido.op === "insert" ? { data: null, error: null } : { data: [{ id: "i1", usada_en: "2026-10-02T12:00:00Z" }], error: null });
    const resultado = await invitar("c1", { email: " Nuevo@Club.com ", rol: "admin", partido: false, flujo: false, lesiones: true });
    expect(base.pedidos[0]).toMatchObject({
      tabla: "club_invitaciones",
      op: "insert",
      datos: { equipo_id: "c1", email: "nuevo@club.com", rol: "admin", partido: false, flujo: false, lesiones: true },
    });
    expect(resultado).toEqual({ usada: true });

    base.responder = (pedido) => (pedido.op === "insert" ? { data: null, error: null } : { data: [{ id: "i2", usada_en: null }], error: null });
    expect(await invitar("c1", { email: "otro@club.com" })).toEqual({ usada: false });
  });

  it("una invitación repetida o sin permiso se explica", async () => {
    base.responder = () => ({ data: null, error: { code: "23505", message: "duplicate key value" } });
    await expect(invitar("c1", { email: "nuevo@club.com" })).rejects.toThrow("cuentas.errorInvitacionRepetida");
    base.responder = () => ({ data: [], error: null });
    await expect(cancelarInvitacion("i1")).rejects.toThrow("cuentas.errorSinPermiso");
  });

});
