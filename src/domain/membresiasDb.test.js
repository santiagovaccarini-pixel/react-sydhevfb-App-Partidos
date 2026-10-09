import { beforeEach, describe, expect, it, vi } from "vitest";

// Una base de mentira que anota cada pedido y contesta lo que diga la prueba.
const base = vi.hoisted(() => ({ pedidos: [], responder: () => ({ data: [], error: null }) }));
vi.mock("../supabase.js", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "tok-admin" } } }) },
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
  cancelarInvitacion,
  claveDeError,
  correoValido,
  darDeBaja,
  enviarInvitacionPorMail,
  estadoDeMembresia,
  invitacionVencida,
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
    expect(claveDeError({ code: "P0001", message: "dueno_protegido" })).toBe("cuentas.errorDuenoProtegido");
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

  it("lee de la vista quién es dueño de la app (protegido); sin esa columna, nadie", async () => {
    base.responder = () => ({
      data: [
        { equipo_id: "c1", user_id: "u1", email: "duenio@prueba.com", rol: "staff", protegido: true },
        { equipo_id: "c1", user_id: "u2", email: "beto@prueba.com", rol: "staff", protegido: false },
        { equipo_id: "c1", user_id: "u3", email: "cata@prueba.com", rol: "staff" },
      ],
      error: null,
    });
    const lista = await listarMiembros("c1");
    expect(lista.map((m) => [m.email, m.protegido])).toEqual([
      ["beto@prueba.com", false],
      ["cata@prueba.com", false],
      ["duenio@prueba.com", true],
    ]);
  });

  it("módulos, baja y reincorporación cambian la fila justa (el rol no se toca desde la app)", async () => {
    base.responder = (pedido) => ({ data: [{ equipo_id: "c1", user_id: "u2", ...pedido.datos }], error: null });
    await cambiarModulo("u2", "c1", "lesiones", true);
    await darDeBaja("u2", "c1", "2026-09-25");
    const vuelto = await reincorporar("u2", "c1");
    expect(base.pedidos.map((p) => p.datos)).toEqual([
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
    expect(() => cambiarModulo("u2", "c1", "rol", "admin")).toThrow("cuentas.errorClub");
  });

  it("si la base no deja, avisa con la razón", async () => {
    // Otro admin, la fila propia o un dueño de la app: 0 filas o el aviso de la base.
    base.responder = () => ({ data: [], error: null });
    await expect(darDeBaja("u2", "c1", "2026-10-01")).rejects.toThrow("cuentas.errorSinPermiso");
    base.responder = () => ({ data: null, error: { message: "dueno_protegido", code: "P0001" } });
    await expect(cambiarModulo("u2", "c1", "flujo", false)).rejects.toThrow("cuentas.errorDuenoProtegido");
    base.responder = () => ({ data: null, error: { message: "ultimo_admin", code: "P0001" } });
    await expect(darDeBaja("u1", "c1", "2026-10-01")).rejects.toThrow("cuentas.errorUltimoAdmin");
  });
});

describe("las invitaciones", () => {
  it("un correo mal escrito ni llega a la base", async () => {
    await expect(invitar("c1", { email: "cualquiera" })).rejects.toThrow("cuentas.errorCorreo");
    await expect(invitar("c1", { email: "nuevo@prueba.com." })).rejects.toThrow("cuentas.errorCorreo");
    expect(base.pedidos).toHaveLength(0);
  });

  it("acepta los correos que existen y rechaza los que nunca pueden llegar", () => {
    const buenos = [
      "nombre@prueba.com",
      " nombre@prueba.com ",
      "Nombre.Apellido@Prueba.COM",
      "nombre+club@prueba.com",
      "nombre_2@correo.prueba.com.ar",
      "a-b@mi-club.prueba.com.br",
      "123@456.museum",
      "nombre@club.xn--p1ai",
      "nombre@xn--80ak6aa92e.xn--p1ai",
    ];
    const malos = [
      "",
      "cualquiera",
      "nombre@prueba.com.",
      ".nombre@prueba.com",
      "nombre.@prueba.com",
      "nom..bre@prueba.com",
      "nombre@prueba..com",
      "nombre@.prueba.com",
      "nombre@prueba",
      "nombre@-prueba.com",
      "nombre@prueba-.com",
      "nombre@prueba.c",
      "nombre@prueba.c0m",
      "nombre@prueba.xn--",
      "nombre@prueba.xn--p1ai-",
      "nom bre@prueba.com",
      "nombre@pru eba.com",
      "nombre@@prueba.com",
      "nombre@prueba.com, otro@prueba.com",
    ];
    for (const correo of buenos) expect(correoValido(correo), correo).toBe(true);
    for (const correo of malos) expect(correoValido(correo), correo).toBe(false);
  });

  it("invita con el correo limpio, siempre como staff, y dice si la cuenta entró en el acto", async () => {
    base.responder = (pedido) => (pedido.op === "insert" ? { data: null, error: null } : { data: [{ id: "i1", usada_en: "2026-10-02T12:00:00Z" }], error: null });
    // Aunque alguien mande rol admin, va staff: la base no deja invitar administradores.
    const resultado = await invitar("c1", { email: " Nuevo@Club.com ", rol: "admin", partido: false, flujo: false, lesiones: true });
    expect(base.pedidos[0]).toMatchObject({
      tabla: "club_invitaciones",
      op: "insert",
      datos: { equipo_id: "c1", email: "nuevo@club.com", rol: "staff", partido: false, flujo: false, lesiones: true },
    });
    expect(resultado).toEqual({ usada: true, id: "i1" });

    base.responder = (pedido) => (pedido.op === "insert" ? { data: null, error: null } : { data: [{ id: "i2", usada_en: null }], error: null });
    // Vuelve el id de la invitación nueva, para mandarle el mail.
    expect(await invitar("c1", { email: "otro@club.com" })).toEqual({ usada: false, id: "i2" });
  });

  it("una invitación vencida no sirve, y a ese correo se lo puede volver a invitar", async () => {
    const ahora = Date.parse("2026-10-05T12:00:00Z");
    expect(invitacionVencida({ vence_en: "2026-10-04T12:00:00Z" }, ahora)).toBe(true);
    expect(invitacionVencida({ vence_en: "2026-10-06T12:00:00Z" }, ahora)).toBe(false);
    expect(invitacionVencida({}, ahora)).toBe(false);

    // La base no deja otra abierta al mismo correo, aunque la que hay haya
    // vencido: se cancela la vencida y se invita.
    const ayer = new Date(Date.now() - 86400000).toISOString();
    let inserciones = 0;
    base.responder = (pedido) => {
      if (pedido.op === "insert") {
        inserciones += 1;
        return inserciones === 1 ? { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "club_invitaciones_abierta_unica"' } } : { data: null, error: null };
      }
      if (pedido.op === "update") return { data: [{ id: "vieja" }], error: null };
      if (pedido.filtros.some(([, columna]) => columna === "cancelada_en")) return { data: [{ id: "vieja", vence_en: ayer }], error: null };
      return { data: [{ id: "nueva", usada_en: null }], error: null };
    };
    expect(await invitar("c1", { email: "tarde@club.com" })).toEqual({ usada: false, id: "nueva" });
    expect(base.pedidos.map((pedido) => pedido.op)).toEqual(["insert", "select", "update", "insert", "select"]);
    expect(base.pedidos[1].filtros).toEqual(expect.arrayContaining([["eq", "email", "tarde@club.com"], ["is", "usada_en", null], ["is", "cancelada_en", null]]));
    expect(base.pedidos[2]).toMatchObject({ op: "update", datos: { cancelada_en: expect.any(String) }, filtros: [["eq", "id", "vieja"]] });

    // Con una vigente, se avisa como siempre y no se cancela nada.
    base.pedidos = [];
    const manana = new Date(Date.now() + 86400000).toISOString();
    base.responder = (pedido) =>
      pedido.op === "insert" ? { data: null, error: { code: "23505", message: "duplicate key value" } } : { data: [{ id: "vigente", vence_en: manana }], error: null };
    await expect(invitar("c1", { email: "tarde@club.com" })).rejects.toThrow("cuentas.errorInvitacionRepetida");
    expect(base.pedidos.some((pedido) => pedido.op === "update")).toBe(false);
  });

  it("el mail de la invitación lo manda el servidor, con la sesión de quien invita, y dice qué pasó", async () => {
    const contestar = (status, cuerpo) => vi.fn(async () => ({ ok: status < 400, status, json: async () => cuerpo }));
    try {
      vi.stubGlobal("fetch", contestar(200, { ok: true, enviado: true }));
      expect(await enviarInvitacionPorMail("i1", "pt-BR")).toBe("cuentas.mail.enviado");
      const [ruta, pedido] = fetch.mock.calls[0];
      expect(ruta).toBe("/api/invitar");
      expect(pedido.method).toBe("POST");
      expect(pedido.headers.Authorization).toBe("Bearer tok-admin");
      // Solo la invitación y el idioma: a quién se le escribe lo decide el servidor.
      expect(JSON.parse(pedido.body)).toEqual({ invitacion: "i1", idioma: "pt-BR" });

      const casos = [
        [200, { ok: true, enviado: false, yaTieneCuenta: true }, "cuentas.mail.yaTieneCuenta"],
        [409, { ok: false, code: "CONFIRMACION_APAGADA" }, "cuentas.mail.confirmacionApagada"],
        [429, { ok: false, code: "LIMITE_DE_MAILS" }, "cuentas.mail.limite"],
        [409, { ok: false, code: "INVITACION_VENCIDA" }, "cuentas.mail.vencida"],
        [409, { ok: false, code: "INVITACION_USADA" }, "cuentas.mail.cerrada"],
        [409, { ok: false, code: "INVITACION_CANCELADA" }, "cuentas.mail.cerrada"],
        [503, { ok: false, code: "SIN_CLAVE_SERVIDOR" }, "cuentas.mail.noSalio"],
        [502, { ok: false, code: "ENVIO_FALLIDO" }, "cuentas.mail.noSalio"],
        [404, { ok: false, code: "NO_ENCONTRADA" }, "cuentas.mail.noSalio"],
        [500, null, "cuentas.mail.noSalio"],
      ];
      for (const [status, cuerpo, clave] of casos) {
        vi.stubGlobal("fetch", contestar(status, cuerpo));
        expect(await enviarInvitacionPorMail("i1", "es-AR"), JSON.stringify(cuerpo)).toBe(clave);
      }

      // Sin señal: no salió.
      vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
      expect(await enviarInvitacionPorMail("i1", "es-AR")).toBe("cuentas.mail.noSalio");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("una invitación repetida o sin permiso se explica", async () => {
    base.responder = () => ({ data: null, error: { code: "23505", message: "duplicate key value" } });
    await expect(invitar("c1", { email: "nuevo@club.com" })).rejects.toThrow("cuentas.errorInvitacionRepetida");
    base.responder = () => ({ data: [], error: null });
    await expect(cancelarInvitacion("i1")).rejects.toThrow("cuentas.errorSinPermiso");
  });

});
