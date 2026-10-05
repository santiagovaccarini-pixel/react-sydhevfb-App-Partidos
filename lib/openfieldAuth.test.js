import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Supabase de mentira: quién es el usuario del token, qué dice su perfil y
// qué contesta la base a puede_usar('flujo') (sus membresías).
const supabaseFalso = vi.hoisted(() => ({
  usuario: null,
  errorUsuario: null,
  perfil: null,
  errorPerfil: null,
  flujo: false,
  errorFlujo: null,
  consultas: [],
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: async () => ({ data: { user: supabaseFalso.usuario }, error: supabaseFalso.errorUsuario }),
    },
    rpc: async (funcion, argumentos) => {
      supabaseFalso.consultas.push({ funcion, argumentos });
      return { data: supabaseFalso.errorFlujo ? null : supabaseFalso.flujo, error: supabaseFalso.errorFlujo };
    },
    from: (tabla) => {
      const cadena = {
        select: (columnas) => {
          supabaseFalso.consultas.push({ tabla, columnas });
          return cadena;
        },
        eq: () => cadena,
        maybeSingle: async () => ({ data: supabaseFalso.perfil, error: supabaseFalso.errorPerfil }),
      };
      return cadena;
    },
  })),
}));

const {
  SESSION_DEFAULT_SECONDS,
  SESSION_MARGEN_SECONDS,
  SESSION_MAX_SECONDS,
  SESSION_MIN_SECONDS,
  VERSION_COOKIE,
  autenticarBearerSupabase,
  autenticarCookieOpenField,
  crearCookieSesionOpenField,
  exigirAdmin,
  exigirDiagnostico,
  expDelJwt,
  responderNoAutenticado,
  secretoSesionPropio,
} = await import("./openfieldAuth.js");

const SECRETO = "una frase larga y aburrida que nadie va a adivinar 2026";

const jwt = (claims) =>
  `${Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url")}.${Buffer.from(
    JSON.stringify(claims),
  ).toString("base64url")}.firma`;

const ahora = () => Math.floor(Date.now() / 1000);

// De "openfield_session=valor; Path=/; ..." a la cabecera Cookie del pedido.
const pedidoConCookie = (setCookie) => ({ headers: { cookie: setCookie.split(";")[0] } });

const cuerpoDeCookie = (setCookie) => {
  const valor = setCookie.split(";")[0].split("=")[1];
  const codificado = valor.slice(0, valor.lastIndexOf("."));
  return JSON.parse(Buffer.from(codificado, "base64url").toString("utf8"));
};

const maxAge = (setCookie) => Number(setCookie.match(/Max-Age=(\d+)/)[1]);

describe("la cookie de sesión de OpenField", () => {
  beforeEach(() => {
    vi.stubEnv("OPENFIELD_SESSION_SECRET", SECRETO);
    vi.stubEnv("OPENFIELD_API_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("no se emite sin ningún secreto", () => {
    vi.stubEnv("OPENFIELD_SESSION_SECRET", "");
    expect(secretoSesionPropio()).toBe("");
    expect(crearCookieSesionOpenField({ id: "u1", email: "a@b.c" })).toBeNull();
  });

  it("un secreto propio corto no cuenta; cae al token de Catapult si está", () => {
    vi.stubEnv("OPENFIELD_SESSION_SECRET", "corto");
    expect(secretoSesionPropio()).toBe("");
    expect(crearCookieSesionOpenField({ id: "u1", email: "a@b.c" })).toBeNull();

    vi.stubEnv("OPENFIELD_API_TOKEN", "token-de-catapult");
    const cookie = crearCookieSesionOpenField({ id: "u1", email: "a@b.c" });
    expect(cookie).not.toBeNull();
    expect(autenticarCookieOpenField(pedidoConCookie(cookie)).ok).toBe(true);
  });

  it("ida y vuelta: lleva versión, rol y correo en minúsculas", () => {
    const cookie = crearCookieSesionOpenField({ id: "u1", email: "Santi@Club.com", rol: "admin" });
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cuerpoDeCookie(cookie).v).toBe(VERSION_COOKIE);

    const auth = autenticarCookieOpenField(pedidoConCookie(cookie));
    expect(auth).toEqual({ ok: true, user: { id: "u1", email: "santi@club.com", rol: "admin" } });
  });

  it("sin rol admin, el rol es usuario", () => {
    const cookie = crearCookieSesionOpenField({ id: "u1", email: "a@b.c", rol: "cualquiera" });
    expect(autenticarCookieOpenField(pedidoConCookie(cookie)).user.rol).toBe("usuario");
  });

  it("dura poco: 10 minutos como mucho, aunque el token de Supabase dure más", () => {
    // Así, a quien le sacan Flujo diario (o se va del club) la cookie le dura
    // poco: la app la renueva sola y la base vuelve a decidir.
    expect(SESSION_MAX_SECONDS).toBe(10 * 60);
    const enUnaHora = ahora() + 3600;
    const cookie = crearCookieSesionOpenField({ id: "u1", email: "a@b.c" }, { jwtExp: enUnaHora });
    expect(cuerpoDeCookie(cookie).exp).toBeLessThanOrEqual(ahora() + SESSION_MAX_SECONDS);
    expect(maxAge(cookie)).toBeGreaterThanOrEqual(SESSION_MAX_SECONDS - 2);
    expect(maxAge(cookie)).toBeLessThanOrEqual(SESSION_MAX_SECONDS);

    // Nunca más allá del vencimiento del token más el margen.
    const casiVencido = ahora() - SESSION_MARGEN_SECONDS + 7 * 60;
    const corta = crearCookieSesionOpenField({ id: "u1", email: "a@b.c" }, { jwtExp: casiVencido });
    expect(cuerpoDeCookie(corta).exp).toBe(casiVencido + SESSION_MARGEN_SECONDS);

    const yaVencido = crearCookieSesionOpenField({ id: "u1", email: "a@b.c" }, { jwtExp: ahora() - 3600 });
    expect(maxAge(yaVencido)).toBeGreaterThanOrEqual(SESSION_MIN_SECONDS - 2);
    expect(maxAge(yaVencido)).toBeLessThanOrEqual(SESSION_MIN_SECONDS);

    const enUnaSemana = crearCookieSesionOpenField({ id: "u1", email: "a@b.c" }, { jwtExp: ahora() + 7 * 24 * 3600 });
    expect(maxAge(enUnaSemana)).toBeLessThanOrEqual(SESSION_MAX_SECONDS);
    expect(maxAge(enUnaSemana)).toBeGreaterThanOrEqual(SESSION_MAX_SECONDS - 2);

    const sinToken = crearCookieSesionOpenField({ id: "u1", email: "a@b.c" });
    expect(maxAge(sinToken)).toBeGreaterThanOrEqual(SESSION_DEFAULT_SECONDS - 2);
    expect(maxAge(sinToken)).toBeLessThanOrEqual(SESSION_DEFAULT_SECONDS);
  });

  it("rechaza la cookie tocada, la de otro secreto, la vencida y la de la versión vieja", () => {
    const cookie = crearCookieSesionOpenField({ id: "u1", email: "a@b.c" });
    const valor = cookie.split(";")[0];

    const tocada = { headers: { cookie: valor.slice(0, -3) + "AAA" } };
    expect(autenticarCookieOpenField(tocada)).toMatchObject({ ok: false, status: 401, code: "SESION_INVALIDA" });

    vi.stubEnv("OPENFIELD_SESSION_SECRET", "otro secreto igual de largo y de aburrido 2026 xx");
    expect(autenticarCookieOpenField(pedidoConCookie(cookie))).toMatchObject({ ok: false, code: "SESION_INVALIDA" });
    vi.stubEnv("OPENFIELD_SESSION_SECRET", SECRETO);

    const vencida = crearCookieSesionOpenField({ id: "u1", email: "a@b.c" }, { jwtExp: ahora() - 10 * 3600 });
    // El piso de 5 minutos la mantiene viva: se simula el paso del tiempo.
    const ahoraReal = Date.now;
    Date.now = () => ahoraReal() + 6 * 60 * 1000;
    try {
      expect(autenticarCookieOpenField(pedidoConCookie(vencida))).toMatchObject({ ok: false, code: "SESION_VENCIDA" });
    } finally {
      Date.now = ahoraReal;
    }

    expect(autenticarCookieOpenField({ headers: {} })).toMatchObject({ ok: false, status: 401, code: "SIN_SESION" });
    expect(autenticarCookieOpenField({ headers: { cookie: "openfield_session=basura" } })).toMatchObject({ code: "SESION_INVALIDA" });
  });

  it("una cookie del formato anterior (sin versión) queda vencida", async () => {
    const { createHmac, createHash } = await import("node:crypto");
    const payload = Buffer.from(
      JSON.stringify({ sub: "u1", email: "a@b.c", iat: ahora(), exp: ahora() + 3600 }),
    ).toString("base64url");
    const clave = createHash("sha256").update(`openfield-session:${SECRETO}`).digest();
    const firma = createHmac("sha256", clave).update(payload).digest("base64url");
    const auth = autenticarCookieOpenField({ headers: { cookie: `openfield_session=${payload}.${firma}` } });
    expect(auth).toMatchObject({ ok: false, status: 401, code: "SESION_VENCIDA" });
  });

  it("una cookie de la versión 2 (la que miraba los permisos viejos de perfiles) queda vencida", async () => {
    const { createHmac, createHash } = await import("node:crypto");
    expect(VERSION_COOKIE).toBe(3);
    const payload = Buffer.from(
      JSON.stringify({ v: 2, sub: "u1", email: "a@b.c", rol: "usuario", iat: ahora(), exp: ahora() + 3600 }),
    ).toString("base64url");
    const clave = createHash("sha256").update(`openfield-session:${SECRETO}`).digest();
    const firma = createHmac("sha256", clave).update(payload).digest("base64url");
    const auth = autenticarCookieOpenField({ headers: { cookie: `openfield_session=${payload}.${firma}` } });
    expect(auth).toMatchObject({ ok: false, status: 401, code: "SESION_VENCIDA" });
  });
});

describe("la sesión de la app (token de Supabase + perfil)", () => {
  const usuario = { id: "u1", email: "Santi@Club.com" };
  const token = jwt({ sub: "u1", exp: ahora() + 3600 });
  const pedido = { headers: { authorization: `Bearer ${token}` } };

  beforeEach(() => {
    supabaseFalso.usuario = usuario;
    supabaseFalso.errorUsuario = null;
    supabaseFalso.perfil = { estado: "autorizado", admin: false };
    supabaseFalso.errorPerfil = null;
    supabaseFalso.flujo = true;
    supabaseFalso.errorFlujo = null;
    supabaseFalso.consultas = [];
  });

  it("sin token pide iniciar sesión", async () => {
    expect(await autenticarBearerSupabase({ headers: {} })).toMatchObject({ ok: false, status: 401, code: "SIN_SESION" });
  });

  it("con un token que Supabase rechaza, la sesión no es válida", async () => {
    supabaseFalso.errorUsuario = new Error("invalid");
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 401, code: "SESION_INVALIDA" });
  });

  it("con su propio token lee el estado de la cuenta y le pregunta a la base por Flujo diario en sus clubes", async () => {
    const auth = await autenticarBearerSupabase(pedido);
    expect(auth).toMatchObject({ ok: true, user: { id: "u1", email: "santi@club.com", rol: "usuario" } });
    expect(auth.jwtExp).toBe(expDelJwt(token));
    expect(supabaseFalso.consultas).toEqual([
      { tabla: "perfiles", columnas: "estado, admin" },
      { funcion: "puede_usar", argumentos: { modulo: "flujo" } },
    ]);
  });

  it("entra quien llegó por invitación con Flujo diario, aunque los permisos viejos de su perfil no lo digan", async () => {
    supabaseFalso.perfil = { estado: "autorizado", partido: false, flujo: false, admin: false };
    supabaseFalso.flujo = true;
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: true, user: { rol: "usuario" } });
  });

  it("quien se fue del club (o le sacaron Flujo diario) no entra, aunque su perfil viejo diga flujo (403 SIN_PERMISO)", async () => {
    supabaseFalso.perfil = { estado: "autorizado", partido: true, flujo: true, admin: false };
    supabaseFalso.flujo = false;
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "SIN_PERMISO" });
  });

  it("solo un true de la base deja pasar: cualquier otra respuesta no", async () => {
    for (const respuesta of [null, "true", 1, [true], {}]) {
      supabaseFalso.flujo = respuesta;
      expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "SIN_PERMISO" });
    }
  });

  it("el dueño de la plataforma pasa con rol admin aunque no tenga Flujo diario en ningún club", async () => {
    supabaseFalso.perfil = { estado: "autorizado", admin: true };
    supabaseFalso.flujo = false;
    expect((await autenticarBearerSupabase(pedido)).user.rol).toBe("admin");
  });

  it("sin fila de perfil, o pendiente, no entra (403 PENDIENTE)", async () => {
    supabaseFalso.perfil = null;
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "PENDIENTE" });
    supabaseFalso.perfil = { estado: "pendiente", admin: false };
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "PENDIENTE" });
  });

  it("bloqueada no entra (403 BLOQUEADO), aunque tenga Flujo diario en su club", async () => {
    supabaseFalso.perfil = { estado: "bloqueado", admin: false };
    supabaseFalso.flujo = true;
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "BLOQUEADO" });
  });

  it("si la tabla no se puede leer, no deja pasar y avisa que reintente (503)", async () => {
    supabaseFalso.errorPerfil = { message: "relation perfiles does not exist" };
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 503, code: "PERFIL_NO_LEGIBLE" });
  });

  it("si la base no contesta por Flujo diario, tampoco (503)", async () => {
    supabaseFalso.errorFlujo = { message: "Could not find the function public.puede_usar" };
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 503, code: "PERFIL_NO_LEGIBLE" });
  });
});

describe("ayudas para las rutas", () => {
  it("exigirAdmin deja pasar solo al administrador y propaga un fallo previo", () => {
    const admin = { ok: true, user: { id: "u1", email: "a@b.c", rol: "admin" } };
    const usuario = { ok: true, user: { id: "u2", email: "b@b.c", rol: "usuario" } };
    const fallo = { ok: false, status: 401, code: "SIN_SESION", error: "x" };
    expect(exigirAdmin(admin)).toBe(admin);
    expect(exigirAdmin(usuario)).toMatchObject({ ok: false, status: 403, code: "SOLO_ADMIN" });
    expect(exigirAdmin(fallo)).toBe(fallo);
  });

  it("exigirDiagnostico: el dueño siempre; el resto, solo con OPENFIELD_DIAGNOSTICO prendida", () => {
    const admin = { ok: true, user: { id: "u1", email: "a@b.c", rol: "admin" } };
    const usuario = { ok: true, user: { id: "u2", email: "b@b.c", rol: "usuario" } };
    const fallo = { ok: false, status: 401, code: "SIN_SESION", error: "x" };
    try {
      vi.stubEnv("OPENFIELD_DIAGNOSTICO", "");
      expect(exigirDiagnostico(admin)).toBe(admin);
      expect(exigirDiagnostico(usuario)).toMatchObject({ ok: false, status: 403, code: "SOLO_ADMIN" });
      expect(exigirDiagnostico(fallo)).toBe(fallo);
      vi.stubEnv("OPENFIELD_DIAGNOSTICO", "no");
      expect(exigirDiagnostico(usuario)).toMatchObject({ ok: false, code: "SOLO_ADMIN" });
      for (const prendida of ["1", "si", "Sí", "true", " on "]) {
        vi.stubEnv("OPENFIELD_DIAGNOSTICO", prendida);
        expect(exigirDiagnostico(usuario)).toBe(usuario);
      }
      expect(exigirDiagnostico(fallo)).toBe(fallo);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("responderNoAutenticado manda el código junto con el texto", () => {
    const enviado = {};
    const response = { status: (s) => ({ json: (cuerpo) => Object.assign(enviado, { status: s, cuerpo }) }) };
    responderNoAutenticado(response, { ok: false, status: 403, code: "PENDIENTE", error: "Todavía no." });
    expect(enviado).toEqual({ status: 403, cuerpo: { ok: false, code: "PENDIENTE", error: "Todavía no." } });
  });

  it("expDelJwt lee el vencimiento y devuelve null ante basura", () => {
    expect(expDelJwt(jwt({ exp: 1234 }))).toBe(1234);
    expect(expDelJwt("no.es.jwt")).toBeNull();
    expect(expDelJwt("")).toBeNull();
  });
});
