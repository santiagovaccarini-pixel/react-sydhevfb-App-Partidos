import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase de mentira: anota cada RPC y contesta lo que diga la prueba.
const base = vi.hoisted(() => ({ llamadas: [], responder: () => ({ data: null, error: null }) }));
vi.mock("../supabase.js", () => ({
  supabase: {
    rpc: (funcion, parametros) => {
      base.llamadas.push({ funcion, parametros });
      const respuesta = () => Promise.resolve(base.responder(funcion, parametros));
      return { maybeSingle: respuesta, then: (bien, mal) => respuesta().then(bien, mal) };
    },
  },
}));

const {
  ZONAS_DE_CLUB,
  ZONA_POR_DEFECTO,
  agregarSubdueno,
  asignarEntidad,
  claveDeError,
  crearClub,
  derivarPedido,
  leerMiCuenta,
  limpiarNombreDeClub,
  nombreDeZona,
  panelClubes,
  panelDuenos,
  panelHistorial,
  pedidosSinClub,
  quitarSubdueno,
  rechazarPedidoSinClub,
  renombrarClub,
  traspasarPrincipal,
} = await import("./plataformaDb.js");

beforeEach(() => {
  base.llamadas = [];
  base.responder = () => ({ data: null, error: null });
});

describe("los errores de la plataforma", () => {
  it("cada código de la base pasa a su clave del diccionario", () => {
    expect(claveDeError({ code: "P0001", message: "nombre_repetido" })).toBe("panel.error.nombreRepetido");
    expect(claveDeError({ code: "P0001", message: "nombre_invalido" })).toBe("panel.error.nombreInvalido");
    expect(claveDeError({ code: "P0001", message: "club_sin_admin" })).toBe("panel.error.clubSinAdmin");
    expect(claveDeError({ code: "P0001", message: "entidad_es_dueno" })).toBe("panel.error.entidadEsDueno");
    expect(claveDeError({ code: "P0001", message: "zona_horaria_invalida" })).toBe("panel.error.zonaHorariaInvalida");
    // Los largos antes que los cortos que los contienen.
    expect(claveDeError({ code: "P0001", message: "dueno_principal_invalido" })).toBe("panel.error.duenoPrincipalInvalido");
    expect(claveDeError({ code: "P0001", message: "dueno_principal" })).toBe("panel.error.duenoPrincipal");
    expect(claveDeError({ code: "42501", message: "solo_dueno_principal" })).toBe("panel.error.soloDuenoPrincipal");
    expect(claveDeError({ code: "42501", message: "solo_duenos" })).toBe("panel.error.soloDuenos");
  });

  it("sin la función en la base, sin permiso, sin red o algo raro", () => {
    expect(claveDeError({ code: "PGRST202", message: "Could not find the function public.panel_clubes without parameters" })).toBe(
      "panel.error.faltaMigracion",
    );
    expect(claveDeError({ code: "42883", message: "function public.mi_cuenta() does not exist" })).toBe("panel.error.faltaMigracion");
    expect(claveDeError({ code: "42501", message: "permission denied for function panel_clubes" })).toBe("panel.error.sinPermiso");
    expect(claveDeError({ message: "TypeError: Failed to fetch" })).toBe("comun.sinConexion");
    expect(claveDeError({ message: "otra cosa" })).toBe("panel.error.generico");
  });
});

describe("la cuenta de quien entró", () => {
  it("lee mi_cuenta una vez y entiende si es dueño", async () => {
    base.responder = () => ({ data: { estado: "autorizado", dueno: "sub", flujo: true, catapult: false, tecnico: false }, error: null });
    expect(await leerMiCuenta()).toEqual({ estado: "autorizado", dueno: "sub", flujo: true, catapult: false, tecnico: false });
    expect(base.llamadas).toEqual([{ funcion: "mi_cuenta", parametros: undefined }]);

    base.responder = () => ({ data: { estado: "autorizado", dueno: "cualquiera" }, error: null });
    expect((await leerMiCuenta()).dueno).toBeNull();
    base.responder = () => ({ data: null, error: null });
    expect(await leerMiCuenta()).toBeNull();
    base.responder = () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function public.mi_cuenta" } });
    await expect(leerMiCuenta()).rejects.toThrow("panel.error.faltaMigracion");
  });
});

describe("el panel de los dueños", () => {
  it("de cada club, solo los cuatro datos, ordenados por nombre", async () => {
    base.responder = () => ({
      data: [
        { equipo_id: "c1", nombre: " Club Uno ", correo_entidad: "ent@uno.com", correo_admin: null, personas: 3 },
        { equipo_id: "c2", nombre: "Club Dos", correo_entidad: null, correo_admin: "eva@dos.com", personas: "2" },
      ],
      error: null,
    });
    expect(await panelClubes()).toEqual([
      { equipo_id: "c2", nombre: "Club Dos", correo_entidad: null, correo_admin: "eva@dos.com", personas: 2 },
      { equipo_id: "c1", nombre: "Club Uno", correo_entidad: "ent@uno.com", correo_admin: null, personas: 3 },
    ]);
    expect(base.llamadas[0].funcion).toBe("panel_clubes");
  });

  it("los dueños con el principal arriba, y los movimientos con su límite", async () => {
    base.responder = () => ({
      data: [
        { user_id: "s", email: "sub@prueba.com", principal: false, es_mia: true },
        { user_id: "p", email: "duenio@prueba.com", principal: true, es_mia: false },
      ],
      error: null,
    });
    expect((await panelDuenos()).map((d) => d.user_id)).toEqual(["p", "s"]);
    base.responder = () => ({ data: [{ id: 1, accion: "crear_club" }], error: null });
    expect(await panelHistorial()).toEqual([{ id: 1, accion: "crear_club" }]);
    expect(base.llamadas.at(-1)).toEqual({ funcion: "panel_historial", parametros: { p_limite: 50 } });
  });

  it("crear un club: nombre y correo limpios, la zona de por defecto, y lo que no sirve ni llega", async () => {
    base.responder = () => ({ data: "nuevo-id", error: null });
    expect(await crearClub({ nombre: "  Club Tres ", correoEntidad: " Ent@Tres.com " })).toBe("nuevo-id");
    expect(base.llamadas[0]).toEqual({
      funcion: "crear_club",
      parametros: { p_nombre: "Club Tres", p_correo_entidad: "ent@tres.com", p_zona: ZONA_POR_DEFECTO },
    });
    await crearClub({ nombre: "Club Cuatro", zona: "America/Montevideo" });
    expect(base.llamadas[1].parametros).toEqual({ p_nombre: "Club Cuatro", p_correo_entidad: null, p_zona: "America/Montevideo" });

    await expect(crearClub({ nombre: "  " })).rejects.toThrow("panel.error.nombreInvalido");
    await expect(crearClub({ nombre: "x".repeat(61) })).rejects.toThrow("panel.error.nombreInvalido");
    await expect(crearClub({ nombre: "Club", correoEntidad: "cualquiera" })).rejects.toThrow("panel.error.correoInvalido");
    expect(base.llamadas).toHaveLength(2);

    // La base compara sin tildes, mayúsculas ni espacios de más, y mide el nombre limpio.
    base.responder = () => ({ data: null, error: { code: "P0001", message: "nombre_repetido" } });
    await expect(crearClub({ nombre: "Club Uno" })).rejects.toThrow("panel.error.nombreRepetido");
    await expect(crearClub({ nombre: "CLUB  úno" })).rejects.toThrow("panel.error.nombreRepetido");
    base.responder = () => ({ data: null, error: { code: "P0001", message: "nombre_invalido" } });
    await expect(crearClub({ nombre: "Club Cinco" })).rejects.toThrow("panel.error.nombreInvalido");
  });

  it("cambiar el nombre de un club: limpio, con las reglas de crear, y los errores de la base a su clave", async () => {
    expect(await renombrarClub("c1", "  Club Unido ")).toBe(true);
    expect(base.llamadas).toEqual([{ funcion: "renombrar_club", parametros: { p_equipo: "c1", p_nombre: "Club Unido" } }]);

    await expect(renombrarClub("c1", "  ")).rejects.toThrow("panel.error.nombreInvalido");
    await expect(renombrarClub("c1", "x".repeat(61))).rejects.toThrow("panel.error.nombreInvalido");
    expect(base.llamadas).toHaveLength(1);

    // Los espacios de más del medio se juntan como en la base.
    expect(limpiarNombreDeClub("  Club   Unido ")).toBe("Club Unido");
    await renombrarClub("c1", " Club   Unido ");
    expect(base.llamadas.at(-1)).toEqual({ funcion: "renombrar_club", parametros: { p_equipo: "c1", p_nombre: "Club Unido" } });

    const errores = {
      nombre_repetido: "panel.error.nombreRepetido",
      nombre_invalido: "panel.error.nombreInvalido",
      club_inexistente: "panel.error.clubInexistente",
    };
    for (const [codigo, clave] of Object.entries(errores)) {
      base.responder = () => ({ data: null, error: { code: "P0001", message: codigo } });
      await expect(renombrarClub("c1", "Club Dos")).rejects.toThrow(clave);
    }
    // Solo los dueños: ni el administrador del club ni nadie más.
    base.responder = () => ({ data: null, error: { code: "42501", message: "solo_duenos" } });
    await expect(renombrarClub("c1", "Club Dos")).rejects.toThrow("panel.error.soloDuenos");
    // Una base sin la función nueva.
    base.responder = () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function public.renombrar_club" } });
    await expect(renombrarClub("c1", "Club Dos")).rejects.toThrow("panel.error.faltaMigracion");
  });

  it("la entidad se asigna, se cambia o se saca con el correo vacío", async () => {
    await asignarEntidad("c1", " Nueva@Uno.com ");
    await asignarEntidad("c1", "");
    expect(base.llamadas.map((l) => l.parametros)).toEqual([
      { p_equipo: "c1", p_correo: "nueva@uno.com" },
      { p_equipo: "c1", p_correo: null },
    ]);
    await expect(asignarEntidad("c1", "mal")).rejects.toThrow("panel.error.correoInvalido");
    base.responder = () => ({ data: null, error: { code: "P0001", message: "entidad_repetida" } });
    await expect(asignarEntidad("c2", "nueva@uno.com")).rejects.toThrow("panel.error.entidadRepetida");
  });

  it("sumar, quitar y traspasar dueños llaman a su función", async () => {
    await agregarSubdueno(" Otro@Prueba.com ");
    await quitarSubdueno("u2");
    await traspasarPrincipal("u3");
    expect(base.llamadas).toEqual([
      { funcion: "agregar_subdueno", parametros: { p_correo: "otro@prueba.com" } },
      { funcion: "quitar_subdueno", parametros: { p_user: "u2" } },
      { funcion: "traspasar_principal", parametros: { p_user: "u3" } },
    ]);
    base.responder = () => ({ data: null, error: { code: "42501", message: "solo_dueno_principal" } });
    await expect(quitarSubdueno("u2")).rejects.toThrow("panel.error.soloDuenoPrincipal");
  });

  it("los pedidos de clubes que no están: listar, mandar a un club y rechazar", async () => {
    base.responder = () => ({ data: [{ id: "p1", email: "nadie@prueba.com", club_escrito: "Club Seis" }], error: null });
    expect(await pedidosSinClub()).toHaveLength(1);
    await derivarPedido("p1", "c1");
    await rechazarPedidoSinClub("p1");
    expect(base.llamadas.slice(1)).toEqual([
      { funcion: "derivar_pedido", parametros: { p_id: "p1", p_equipo: "c1" } },
      { funcion: "rechazar_pedido_sin_club", parametros: { p_id: "p1" } },
    ]);
    // A un club sin administrador no se manda: la base no cambia nada y lo dice.
    base.responder = () => ({ data: null, error: { code: "P0001", message: "club_sin_admin" } });
    await expect(derivarPedido("p1", "c2")).rejects.toThrow("panel.error.clubSinAdmin");
  });

  it("las zonas que se ofrecen, con nombres legibles", () => {
    expect(ZONAS_DE_CLUB[0]).toBe(ZONA_POR_DEFECTO);
    expect(nombreDeZona("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
  });
});
