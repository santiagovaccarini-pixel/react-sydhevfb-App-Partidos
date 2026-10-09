import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_URL_POR_DEFECTO,
  atenderInvitar,
  claveDelServidor,
  enviarInvitacion,
  leerAjustesDeAuth,
  leerCuerpo,
  urlDeLaApp,
} from "./invitacionMail.js";

// Supabase de mentira. Con el token de quien pide: quién es, qué
// invitación ve (la base decide) y el nombre del club. Con la clave del
// servidor: el perfil de ese correo, la cuenta como la ve Supabase, el cambio
// de datos y contraseña, y el envío (en `orden`, qué pasó antes).
const ID = "0b9c7f1e-3a52-4c1d-9e8f-2b6a4d0c1e7f";
const DIA_MS = 86400000;
const AHORA = Date.parse("2026-10-09T12:00:00Z");

let mundo;

const fila = (extra = {}) => ({
  id: ID,
  email: "nueva@club.com",
  equipo_id: "c1",
  vence_en: new Date(AHORA + 7 * DIA_MS).toISOString(),
  usada_en: null,
  cancelada_en: null,
  ...extra,
});

const consulta = (tabla, contestar, anotar) => {
  const pedido = { tabla, filtros: [] };
  anotar.push(pedido);
  const cadena = {
    select: (columnas) => {
      pedido.columnas = columnas;
      return cadena;
    },
    eq: (columna, valor) => {
      pedido.filtros.push([columna, valor]);
      return cadena;
    },
    limit: () => Promise.resolve(contestar(pedido)),
    maybeSingle: () => Promise.resolve(contestar(pedido)),
  };
  return cadena;
};

const comoUsuario = (token) => {
  mundo.tokensUsados.push(token);
  return {
    auth: { getUser: async () => ({ data: { user: mundo.usuario }, error: mundo.usuario ? null : { message: "invalid JWT" } }) },
    from: (tabla) =>
      consulta(
        tabla,
        (pedido) => {
          if (tabla === "club_invitaciones") return { data: mundo.invitacion, error: mundo.errorInvitacion };
          if (tabla === "equipos") return { data: mundo.club, error: null };
          throw new Error(`tabla inesperada ${pedido.tabla}`);
        },
        mundo.consultasUsuario,
      ),
  };
};

const comoServidor = (clave) => {
  mundo.clavesUsadas.push(clave);
  return {
    from: (tabla) => consulta(tabla, () => ({ data: mundo.perfilesServidor, error: mundo.errorPerfiles }), mundo.consultasServidor),
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(async (correo, opciones) => {
          mundo.orden.push("invitar");
          mundo.invitaciones.push({ correo, opciones });
          if (mundo.lanzar) throw mundo.lanzar;
          return { data: { user: mundo.errorInvitar ? null : { id: "u-nueva" } }, error: mundo.errorInvitar };
        }),
        getUserById: vi.fn(async (id) => {
          mundo.orden.push("leer-cuenta");
          if (mundo.errorCuenta) return { data: { user: null }, error: mundo.errorCuenta };
          return { data: { user: mundo.cuentaAuth || { id, email: "nueva@club.com", email_confirmed_at: null } }, error: null };
        }),
        updateUserById: vi.fn(async (id, cambios) => {
          mundo.orden.push("cambiar-cuenta");
          mundo.cambiosDeDatos.push({ id, cambios });
          if (mundo.errorCambio) return { data: { user: null }, error: mundo.errorCambio };
          return { data: { user: { id } }, error: null };
        }),
      },
    },
  };
};

const pedir = (extra = {}) =>
  enviarInvitacion({
    token: "tok-admin",
    cuerpo: { invitacion: ID, idioma: "pt-BR" },
    env: { SUPABASE_SECRET_KEY: "sb_secret_prueba" },
    comoUsuario,
    comoServidor,
    leerAjustes: async () => mundo.ajustes,
    ahora: () => AHORA,
    avisar: (...args) => mundo.avisos.push(args),
    ...extra,
  });

beforeEach(() => {
  mundo = {
    usuario: { id: "admin-1", email: "admin@club.com" },
    invitacion: fila(),
    errorInvitacion: null,
    club: { nombre: "Club Uno" },
    ajustes: { ok: true, autoconfirm: false },
    perfilesServidor: [],
    errorPerfiles: null,
    cuentaAuth: null,
    errorCuenta: null,
    errorCambio: null,
    orden: [],
    errorInvitar: null,
    lanzar: null,
    tokensUsados: [],
    clavesUsadas: [],
    consultasUsuario: [],
    consultasServidor: [],
    invitaciones: [],
    cambiosDeDatos: [],
    avisos: [],
  };
});

describe("el mail de una invitación", () => {
  it("manda la invitación al correo guardado, con el club y la vuelta a la app", async () => {
    const { status, cuerpo } = await pedir();
    expect(status).toBe(200);
    expect(cuerpo).toEqual({ ok: true, enviado: true });
    expect(mundo.invitaciones).toEqual([
      {
        correo: "nueva@club.com",
        opciones: { redirectTo: `${APP_URL_POR_DEFECTO}/?invitacion=1`, data: { club: "Club Uno", idioma: "pt-BR" } },
      },
    ]);
    // La invitación se leyó con el token de quien pidió (la base decide) y por su id.
    expect(mundo.tokensUsados).toEqual(["tok-admin"]);
    expect(mundo.consultasUsuario[0]).toMatchObject({ tabla: "club_invitaciones", filtros: [["id", ID]] });
    expect(mundo.clavesUsadas).toEqual(["sb_secret_prueba"]);
  });

  it("nunca le escribe a otro correo, aunque el pedido traiga uno", async () => {
    mundo.invitacion = fila({ email: "  Invitada@Club.com " });
    await pedir({ cuerpo: { invitacion: ID, idioma: "es-AR", email: "otro@malo.com", correo: "otro@malo.com", to: "otro@malo.com" } });
    expect(mundo.invitaciones.map((una) => una.correo)).toEqual(["invitada@club.com"]);
    expect(JSON.stringify(mundo.invitaciones)).not.toContain("malo.com");
  });

  it("sin sesión o con una sesión que no vale, no hace nada", async () => {
    expect(await pedir({ token: "" })).toMatchObject({ status: 401, cuerpo: { ok: false, code: "SIN_SESION" } });
    mundo.usuario = null;
    expect(await pedir()).toMatchObject({ status: 401, cuerpo: { code: "SESION_INVALIDA" } });
    expect(mundo.consultasUsuario).toEqual([]);
    expect(mundo.invitaciones).toEqual([]);
  });

  it("un pedido sin una invitación bien escrita no llega a la base", async () => {
    expect(await pedir({ cuerpo: { invitacion: "1; drop table" } })).toMatchObject({ status: 400, cuerpo: { code: "PEDIDO_INVALIDO" } });
    expect(await pedir({ cuerpo: {} })).toMatchObject({ status: 400 });
    expect(mundo.tokensUsados).toEqual([]);
  });

  it("si la base no le muestra la invitación (no administra ese club), es como si no existiera", async () => {
    mundo.invitacion = null;
    expect(await pedir()).toMatchObject({ status: 404, cuerpo: { ok: false, code: "NO_ENCONTRADA" } });
    expect(mundo.clavesUsadas).toEqual([]);
    expect(mundo.invitaciones).toEqual([]);

    mundo.invitacion = fila();
    mundo.errorInvitacion = { message: "boom" };
    expect(await pedir()).toMatchObject({ status: 502, cuerpo: { code: "LECTURA_FALLIDA" } });
    expect(mundo.invitaciones).toEqual([]);
  });

  it("una invitación usada, cancelada o vencida no se manda", async () => {
    mundo.invitacion = fila({ usada_en: "2026-10-08T10:00:00Z" });
    expect(await pedir()).toMatchObject({ status: 409, cuerpo: { code: "INVITACION_USADA" } });
    mundo.invitacion = fila({ cancelada_en: "2026-10-08T10:00:00Z" });
    expect(await pedir()).toMatchObject({ status: 409, cuerpo: { code: "INVITACION_CANCELADA" } });
    mundo.invitacion = fila({ vence_en: new Date(AHORA - 1000).toISOString() });
    expect(await pedir()).toMatchObject({ status: 409, cuerpo: { code: "INVITACION_VENCIDA" } });
    expect(mundo.invitaciones).toEqual([]);
  });

  it("con la confirmación de correo apagada en Supabase no manda nada (un impostor se quedaría con la cuenta)", async () => {
    mundo.ajustes = { ok: true, autoconfirm: true };
    expect(await pedir()).toMatchObject({ status: 409, cuerpo: { ok: false, code: "CONFIRMACION_APAGADA" } });
    // Si Supabase no dice nada claro, tampoco.
    mundo.ajustes = { ok: true, autoconfirm: undefined };
    expect(await pedir()).toMatchObject({ status: 409, cuerpo: { code: "CONFIRMACION_APAGADA" } });
    mundo.ajustes = { ok: false };
    expect(await pedir()).toMatchObject({ status: 502, cuerpo: { code: "AJUSTES_NO_LEGIBLES" } });
    expect(mundo.clavesUsadas).toEqual([]);
    expect(mundo.invitaciones).toEqual([]);
  });

  it("sin la clave del servidor avisa, y acepta la legacy service_role si no está la nueva", async () => {
    expect(await pedir({ env: {} })).toMatchObject({ status: 503, cuerpo: { code: "SIN_CLAVE_SERVIDOR" } });
    expect(await pedir({ env: { VITE_SUPABASE_SECRET_KEY: "sb_secret_navegador" } })).toMatchObject({ status: 503 });
    expect(mundo.invitaciones).toEqual([]);

    await pedir({ env: { SUPABASE_SERVICE_ROLE_KEY: "legacy-jwt" } });
    await pedir({ env: { SUPABASE_SECRET_KEY: "sb_secret_nueva", SUPABASE_SERVICE_ROLE_KEY: "legacy-jwt" } });
    expect(mundo.clavesUsadas).toEqual(["legacy-jwt", "sb_secret_nueva"]);
  });

  it("la clave nunca aparece en la respuesta ni en los registros", async () => {
    mundo.errorInvitar = { status: 500, code: "unexpected_failure", message: "Error sending invite email to nueva@club.com" };
    const resultado = await pedir();
    expect(resultado).toMatchObject({ status: 502, cuerpo: { ok: false, code: "ENVIO_FALLIDO" } });
    const todo = JSON.stringify([resultado, mundo.avisos]);
    expect(todo).not.toContain("sb_secret_prueba");
    // Ni el correo ni el texto del proveedor: solo el estado y el código.
    expect(todo).not.toContain("nueva@club.com");
    expect(todo).not.toContain("Error sending");
    expect(mundo.avisos).toEqual([["invitar: Supabase no mandó el mail", { status: 500, code: "unexpected_failure" }]]);
  });

  it("si el correo ya tiene una cuenta confirmada (la invitación que quedó abierta de un dueño de la app), contesta lo mismo que cuando el mail no sale", async () => {
    // Un mail que no salió de verdad (Supabase falló), a un correo sin cuenta.
    mundo.errorInvitar = { status: 500, code: "unexpected_failure", message: "Error sending invite email" };
    const noSalio = await pedir();

    // A un dueño de la app la base no lo mete con la invitación de otro: le
    // queda abierta, y Supabase no le manda el mail porque la cuenta existe.
    mundo.perfilesServidor = [{ user_id: "u-duena", confirmado_en: "2026-09-01T00:00:00Z" }];
    mundo.errorInvitar = { status: 422, code: "email_exists", message: "A user with this email address has already been registered" };
    const conCuenta = await pedir();

    // Quien invita no lo puede distinguir: mismo estado y mismo cuerpo, que no
    // dicen que se mandó el mail ni que la cuenta existe.
    expect(conCuenta).toEqual(noSalio);
    expect(conCuenta).toEqual({ status: 502, cuerpo: { ok: false, code: "ENVIO_FALLIDO", error: "El mail no salió. Probá de nuevo." } });
    expect(JSON.stringify(conCuenta)).not.toMatch(/cuenta|exist|registr|enviado/i);
    // A esa cuenta no se le cambia nada.
    expect(mundo.cambiosDeDatos).toEqual([]);
    // En los registros, solo el estado y el código de Supabase.
    expect(mundo.avisos.at(-1)).toEqual(["invitar: Supabase no mandó el mail", { status: 422, code: "email_exists" }]);
  });

  it("por la función de Vercel, la invitación abierta de una cuenta confirmada tampoco se distingue de un mail que no salió", async () => {
    const respuestaDe = async () => {
      const r = { cabeceras: {}, estado: null, cuerpo: null };
      r.setHeader = (nombre, valor) => {
        r.cabeceras[nombre] = valor;
      };
      r.status = (codigo) => {
        r.estado = codigo;
        return r;
      };
      r.json = (cuerpo) => {
        r.cuerpo = cuerpo;
        return r;
      };
      await atenderInvitar({ method: "POST", headers: { authorization: "Bearer tok-admin" }, body: { invitacion: ID, idioma: "es-AR" } }, r, {
        env: { SUPABASE_SECRET_KEY: "sb_secret_prueba" },
        comoUsuario,
        comoServidor,
        leerAjustes: async () => mundo.ajustes,
        ahora: () => AHORA,
        avisar: (...args) => mundo.avisos.push(args),
      });
      return { estado: r.estado, cuerpo: r.cuerpo, cabeceras: r.cabeceras };
    };
    mundo.errorInvitar = { status: 500, code: "unexpected_failure", message: "Error sending invite email" };
    const noSalio = await respuestaDe();
    mundo.perfilesServidor = [{ user_id: "u-duena", confirmado_en: "2026-09-01T00:00:00Z" }];
    mundo.errorInvitar = { status: 422, code: "email_exists", message: "A user with this email address has already been registered" };
    expect(await respuestaDe()).toEqual(noSalio);
    expect(noSalio.estado).toBe(502);
  });

  it("a una cuenta sin confirmar le pone el club de esta invitación antes de reenviar (si no, el mail diría el de antes)", async () => {
    mundo.perfilesServidor = [{ user_id: "u-pendiente", confirmado_en: null }];
    mundo.club = { nombre: "Club Dos" };
    expect(await pedir()).toMatchObject({ status: 200, cuerpo: { enviado: true } });
    expect(mundo.consultasServidor[0]).toMatchObject({ tabla: "perfiles", filtros: [["email", "nueva@club.com"]] });
    expect(mundo.cambiosDeDatos).toEqual([
      { id: "u-pendiente", cambios: { password: expect.any(String), user_metadata: { club: "Club Dos", idioma: "pt-BR" } } },
    ]);
    expect(mundo.invitaciones).toHaveLength(1);
  });

  it("quien registró antes el correo invitado (con una contraseña suya) no entra: antes del mail, la cuenta pasa a una contraseña al azar", async () => {
    // Alguien hizo "Crear una cuenta" con el correo de otra persona: la cuenta
    // quedó sin confirmar con su contraseña. Si al abrir el mail Supabase la
    // conservara, entraría al club sin haber abierto nunca ese buzón.
    mundo.perfilesServidor = [{ user_id: "u-ajena", confirmado_en: null }];
    expect(await pedir()).toMatchObject({ status: 200, cuerpo: { enviado: true } });
    // Primero se comprueba la cuenta con Supabase, se le cambia la contraseña
    // y recién después sale el mail (al revés, el cambio anularía el enlace).
    expect(mundo.orden).toEqual(["leer-cuenta", "cambiar-cuenta", "invitar"]);
    const clave = mundo.cambiosDeDatos[0].cambios.password;
    expect(clave).toMatch(/^[A-Za-z0-9_-]{64}aA1!$/);
    expect(clave.length).toBeLessThanOrEqual(72);
    // Cada vez una distinta, y nunca aparece en la respuesta ni en los registros.
    await pedir();
    expect(mundo.cambiosDeDatos[1].cambios.password).not.toBe(clave);
    expect(JSON.stringify([await pedir(), mundo.avisos])).not.toContain(clave);
  });

  it("si no puede cambiarle la contraseña a esa cuenta, el mail no sale", async () => {
    mundo.perfilesServidor = [{ user_id: "u-ajena", confirmado_en: null }];
    mundo.errorCambio = { status: 500, code: "unexpected_failure", message: "Database error updating user" };
    expect(await pedir()).toMatchObject({ status: 502, cuerpo: { ok: false, code: "ENVIO_FALLIDO" } });
    expect(mundo.invitaciones).toEqual([]);
    expect(mundo.avisos).toEqual([["invitar: no se preparó la cuenta sin confirmar", { status: 500, code: "unexpected_failure" }]]);

    // Ni si el cambio explota.
    mundo.errorCambio = null;
    mundo.avisos = [];
    const original = comoServidor;
    const conExplosion = (clave) => {
      const servidor = original(clave);
      servidor.auth.admin.updateUserById = async () => {
        throw new TypeError("fetch failed");
      };
      return servidor;
    };
    expect(await pedir({ comoServidor: conExplosion })).toMatchObject({ status: 502, cuerpo: { code: "ENVIO_FALLIDO" } });
    expect(mundo.invitaciones).toEqual([]);
  });

  it("si no puede comprobar si el correo ya tiene cuenta, el mail no sale", async () => {
    mundo.errorPerfiles = { code: "PGRST000", message: "boom" };
    expect(await pedir()).toMatchObject({ status: 502, cuerpo: { code: "ENVIO_FALLIDO" } });
    expect(mundo.invitaciones).toEqual([]);

    mundo.errorPerfiles = null;
    mundo.perfilesServidor = [{ user_id: "u-ajena", confirmado_en: null }];
    mundo.errorCuenta = { status: 500, code: "unexpected_failure" };
    expect(await pedir()).toMatchObject({ status: 502, cuerpo: { code: "ENVIO_FALLIDO" } });
    expect(mundo.invitaciones).toEqual([]);
    expect(mundo.cambiosDeDatos).toEqual([]);

    // Si la cuenta de ese perfil tiene otro correo (la copia no está al día), tampoco.
    mundo.errorCuenta = null;
    mundo.cuentaAuth = { id: "u-ajena", email: "otro@club.com", email_confirmed_at: null };
    expect(await pedir()).toMatchObject({ status: 502, cuerpo: { code: "ENVIO_FALLIDO" } });
    expect(mundo.invitaciones).toEqual([]);
    expect(mundo.cambiosDeDatos).toEqual([]);
  });

  it("si Supabase dice que la cuenta ya está confirmada (aunque la copia de perfiles diga que no), no le toca la contraseña", async () => {
    mundo.perfilesServidor = [{ user_id: "u-vieja", confirmado_en: null }];
    mundo.cuentaAuth = { id: "u-vieja", email: "Nueva@Club.com", email_confirmed_at: "2026-09-01T00:00:00Z" };
    mundo.errorInvitar = { status: 422, code: "email_exists", message: "A user with this email address has already been registered" };
    // Contesta como un mail que no salió (ver la prueba de la cuenta confirmada).
    expect(await pedir()).toMatchObject({ status: 502, cuerpo: { ok: false, code: "ENVIO_FALLIDO" } });
    expect(mundo.cambiosDeDatos).toEqual([]);
  });

  it("demasiados mails seguidos: avisa que espere", async () => {
    mundo.errorInvitar = { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" };
    expect(await pedir()).toMatchObject({ status: 429, cuerpo: { ok: false, code: "LIMITE_DE_MAILS" } });
  });

  it("si el envío explota (sin red, por ejemplo), contesta un código genérico", async () => {
    mundo.lanzar = Object.assign(new Error("fetch failed nueva@club.com"), { name: "TypeError" });
    const resultado = await pedir();
    expect(resultado).toMatchObject({ status: 502, cuerpo: { code: "ENVIO_FALLIDO" } });
    expect(JSON.stringify(mundo.avisos)).not.toContain("nueva@club.com");
  });

  it("sin club legible el mail sale igual, y un idioma desconocido queda en castellano", async () => {
    mundo.club = null;
    await pedir({ cuerpo: { invitacion: ID, idioma: "en-US" } });
    expect(mundo.invitaciones[0].opciones.data).toEqual({ club: "", idioma: "es-AR" });
  });

  it("la vuelta del enlace es la app publicada (APP_URL), nunca una ruta inventada", async () => {
    await pedir({ env: { SUPABASE_SECRET_KEY: "k", APP_URL: "https://ark.ejemplo.com/cualquier/cosa" } });
    expect(mundo.invitaciones[0].opciones.redirectTo).toBe("https://ark.ejemplo.com/?invitacion=1");
    expect(urlDeLaApp({ APP_URL: "javascript:alert(1)" })).toBe(APP_URL_POR_DEFECTO);
    expect(urlDeLaApp({})).toBe(APP_URL_POR_DEFECTO);
  });
});

describe("las piezas", () => {
  it("la clave del servidor: la nueva primero, sin espacios; nunca una VITE_", () => {
    expect(claveDelServidor({ SUPABASE_SECRET_KEY: " sb_secret_x ", SUPABASE_SERVICE_ROLE_KEY: "legacy" })).toBe("sb_secret_x");
    expect(claveDelServidor({ SUPABASE_SERVICE_ROLE_KEY: "legacy" })).toBe("legacy");
    expect(claveDelServidor({ VITE_SUPABASE_SECRET_KEY: "x", VITE_SUPABASE_SERVICE_ROLE_KEY: "y" })).toBe("");
  });

  it("lee el cuerpo como objeto, como texto o roto", () => {
    expect(leerCuerpo({ body: { invitacion: ID } })).toEqual({ invitacion: ID });
    expect(leerCuerpo({ body: JSON.stringify({ invitacion: ID }) })).toEqual({ invitacion: ID });
    expect(leerCuerpo({ body: "{roto" })).toEqual({});
    expect(leerCuerpo({})).toEqual({});
  });

  it("pregunta a Supabase si la confirmación está prendida, con la clave publishable", async () => {
    const pedirFalso = vi.fn(async () => ({ ok: true, json: async () => ({ mailer_autoconfirm: false, disable_signup: false }) }));
    expect(await leerAjustesDeAuth({ url: "https://proyecto.supabase.co", clave: "sb_publishable_x", pedir: pedirFalso })).toEqual({
      ok: true,
      autoconfirm: false,
    });
    expect(pedirFalso.mock.calls[0][0]).toBe("https://proyecto.supabase.co/auth/v1/settings");
    expect(pedirFalso.mock.calls[0][1].headers.apikey).toBe("sb_publishable_x");

    expect(await leerAjustesDeAuth({ pedir: async () => ({ ok: false }) })).toEqual({ ok: false });
    expect(
      await leerAjustesDeAuth({
        pedir: async () => {
          throw new Error("sin red");
        },
      }),
    ).toEqual({ ok: false });
  });
});

describe("la función de Vercel", () => {
  const respuestaFalsa = () => {
    const r = { cabeceras: {}, estado: null, cuerpo: null };
    r.setHeader = (nombre, valor) => {
      r.cabeceras[nombre] = valor;
    };
    r.status = (codigo) => {
      r.estado = codigo;
      return r;
    };
    r.json = (cuerpo) => {
      r.cuerpo = cuerpo;
      return r;
    };
    return r;
  };

  const opciones = () => ({
    env: { SUPABASE_SECRET_KEY: "sb_secret_prueba" },
    comoUsuario,
    comoServidor,
    leerAjustes: async () => mundo.ajustes,
    ahora: () => AHORA,
    avisar: (...args) => mundo.avisos.push(args),
  });

  it("solo POST, y nada queda en caché", async () => {
    const r = respuestaFalsa();
    await atenderInvitar({ method: "GET", headers: {} }, r, opciones());
    expect(r.estado).toBe(405);
    expect(r.cabeceras.Allow).toBe("POST");
    expect(r.cabeceras["Cache-Control"]).toBe("private, no-store");
    expect(mundo.invitaciones).toEqual([]);
  });

  it("toma el token del encabezado y la invitación del cuerpo", async () => {
    const r = respuestaFalsa();
    await atenderInvitar(
      { method: "POST", headers: { authorization: "Bearer tok-admin" }, body: JSON.stringify({ invitacion: ID, idioma: "es-AR" }) },
      r,
      opciones(),
    );
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({ ok: true, enviado: true });
    expect(r.cabeceras["Cache-Control"]).toBe("private, no-store");
    expect(mundo.tokensUsados).toEqual(["tok-admin"]);
  });

  it("sin encabezado de sesión no entra", async () => {
    const r = respuestaFalsa();
    await atenderInvitar({ method: "POST", headers: {}, body: { invitacion: ID } }, r, opciones());
    expect(r.estado).toBe(401);
    expect(r.cuerpo.code).toBe("SIN_SESION");
  });
});
