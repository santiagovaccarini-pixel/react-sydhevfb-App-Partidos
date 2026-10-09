import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase de mentira: anota cada RPC y contesta lo que diga la prueba.
const base = vi.hoisted(() => ({ llamadas: [], responder: () => ({ data: null, error: null }) }));
vi.mock("../supabase.js", () => ({
  supabase: {
    rpc: (funcion, parametros) => {
      base.llamadas.push({ funcion, parametros });
      return Promise.resolve(base.responder(funcion, parametros));
    },
  },
}));

const {
  aceptarPedido,
  cancelarPedido,
  claveDeError,
  misPedidos,
  pedidoAbierto,
  pedidosDelClub,
  pedirAcceso,
  rechazarPedido,
  salirDelClub,
} = await import("./pedidosDb.js");

beforeEach(() => {
  base.llamadas = [];
  base.responder = () => ({ data: null, error: null });
});

describe("pedir acceso a un club", () => {
  it("manda el club como lo escribió (sin espacios de más) y el país si hay", async () => {
    base.responder = () => ({ data: "p1", error: null });
    expect(await pedirAcceso("  Club   Uno ", " Brasil ")).toBe("p1");
    expect(await pedirAcceso("Club Uno")).toBe("p1");
    expect(base.llamadas).toEqual([
      { funcion: "pedir_acceso", parametros: { p_club: "Club Uno", p_pais: "Brasil" } },
      { funcion: "pedir_acceso", parametros: { p_club: "Club Uno", p_pais: null } },
    ]);
  });

  it("un nombre muy corto o muy largo ni llega a la base", async () => {
    await expect(pedirAcceso("x")).rejects.toThrow("pedidos.error.clubInvalido");
    await expect(pedirAcceso("x".repeat(81))).rejects.toThrow("pedidos.error.clubInvalido");
    expect(base.llamadas).toHaveLength(0);
  });

  it("los errores de la base, en claves del diccionario", async () => {
    base.responder = () => ({ data: null, error: { code: "P0001", message: "ya_hay_un_pedido" } });
    await expect(pedirAcceso("Club Uno")).rejects.toThrow("pedidos.error.yaHayUnPedido");
    expect(claveDeError({ code: "42501", message: "solo_admin" })).toBe("pedidos.error.soloAdmin");
    expect(claveDeError({ code: "P0001", message: "no_es_miembro_activo" })).toBe("pedidos.error.noEsMiembro");
    expect(claveDeError({ code: "P0001", message: "dueno_protegido" })).toBe("pedidos.error.duenoProtegido");
    expect(claveDeError({ code: "PGRST202", message: "Could not find the function public.mis_pedidos" })).toBe("pedidos.error.faltaMigracion");
    expect(claveDeError({ message: "Failed to fetch" })).toBe("comun.sinConexion");
    expect(claveDeError({ message: "otra cosa" })).toBe("pedidos.error.generico");
  });

  it("los propios, el más nuevo primero, y cuál está abierto", async () => {
    base.responder = () => ({
      data: [
        { id: "viejo", club_escrito: "Club Uno", estado: "rechazado", creado_en: "2026-10-01T10:00:00Z" },
        { id: "nuevo", club_escrito: "Club Dos", estado: "abierto", creado_en: "2026-10-05T10:00:00Z" },
      ],
      error: null,
    });
    const pedidos = await misPedidos();
    expect(pedidos.map((p) => p.id)).toEqual(["nuevo", "viejo"]);
    expect(pedidoAbierto(pedidos).id).toBe("nuevo");
    expect(pedidoAbierto([{ estado: "cancelado" }])).toBeNull();
    expect(pedidoAbierto(null)).toBeNull();
    await cancelarPedido("nuevo");
    expect(base.llamadas.at(-1)).toEqual({ funcion: "cancelar_pedido", parametros: { p_id: "nuevo" } });
  });
});

describe("los pedidos para el administrador del club", () => {
  it("lista los del club y acepta con los módulos elegidos", async () => {
    base.responder = () => ({ data: [{ id: "p1", email: "nuevo@uno.com", creado_en: "2026-10-05T10:00:00Z" }], error: null });
    expect(await pedidosDelClub("c1")).toHaveLength(1);
    await aceptarPedido("p1", { partido: true, lesiones: 1 });
    await rechazarPedido("p2");
    expect(base.llamadas).toEqual([
      { funcion: "pedidos_del_club", parametros: { p_equipo: "c1" } },
      { funcion: "aceptar_pedido", parametros: { p_id: "p1", p_partido: true, p_flujo: false, p_lesiones: true, p_evaluaciones: false } },
      { funcion: "rechazar_pedido", parametros: { p_id: "p2" } },
    ]);
  });

  it("si el pedido ya se decidió o no es su club, lo dice", async () => {
    base.responder = () => ({ data: null, error: { code: "P0001", message: "pedido_cerrado" } });
    await expect(aceptarPedido("p1")).rejects.toThrow("pedidos.error.pedidoCerrado");
    base.responder = () => ({ data: null, error: { code: "42501", message: "solo_admin" } });
    await expect(pedidosDelClub("c2")).rejects.toThrow("pedidos.error.soloAdmin");
  });

  it("salir del club es por cuenta propia y respeta al último administrador", async () => {
    await salirDelClub("c1");
    expect(base.llamadas).toEqual([{ funcion: "salir_del_club", parametros: { p_equipo: "c1" } }]);
    base.responder = () => ({ data: null, error: { code: "P0001", message: "ultimo_admin" } });
    await expect(salirDelClub("c1")).rejects.toThrow("pedidos.error.ultimoAdmin");
  });
});
