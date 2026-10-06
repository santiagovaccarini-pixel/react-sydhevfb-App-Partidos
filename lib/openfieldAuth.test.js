import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Supabase de mentira: quién es el usuario del token y qué contesta la base a
// mi_cuenta() (estado, dueno, flujo, catapult, tecnico de quien llama). Anota
// cada consulta, para comprobar que el servidor hace una sola y de a una fila.
const supabaseFalso = vi.hoisted(() => ({
  usuario: null,
  errorUsuario: null,
  cuenta: null,
  errorCuenta: null,
  consultas: [],
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: async () => ({ data: { user: supabaseFalso.usuario }, error: supabaseFalso.errorUsuario }),
    },
    rpc: (funcion, argumentos) => {
      const consulta = { funcion, argumentos, unaFila: false };
      supabaseFalso.consultas.push(consulta);
      return {
        maybeSingle: async () => {
          consulta.unaFila = true;
          return { data: supabaseFalso.errorCuenta ? null : supabaseFalso.cuenta, error: supabaseFalso.errorCuenta };
        },
      };
    },
    from: (tabla) => {
      supabaseFalso.consultas.push({ tabla });
      const cadena = {
        select: () => cadena,
        eq: () => cadena,
        maybeSingle: async () => ({ data: null, error: { message: "no se lee ninguna tabla" } }),
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
    const cookie = crearCookieSesionOpenField({ id: "u1", email: "Persona@Prueba.com", rol: "admin" });
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cuerpoDeCookie(cookie).v).toBe(VERSION_COOKIE);

    const auth = autenticarCookieOpenField(pedidoConCookie(cookie));
    expect(auth).toEqual({ ok: true, user: { id: "u1", email: "persona@prueba.com", rol: "admin" } });
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

  it("las cookies de las versiones 2 y 3 (rol de dueño por perfiles.admin, sin el club de Catapult) quedan vencidas", async () => {
    const { createHmac, createHash } = await import("node:crypto");
    expect(VERSION_COOKIE).toBe(4);
    const clave = createHash("sha256").update(`openfield-session:${SECRETO}`).digest();
    for (const v of [2, 3]) {
      const payload = Buffer.from(
        JSON.stringify({ v, sub: "u1", email: "a@b.c", rol: "admin", iat: ahora(), exp: ahora() + 3600 }),
      ).toString("base64url");
      const firma = createHmac("sha256", clave).update(payload).digest("base64url");
      const auth = autenticarCookieOpenField({ headers: { cookie: `openfield_session=${payload}.${firma}` } });
      expect(auth).toMatchObject({ ok: false, status: 401, code: "SESION_VENCIDA" });
    }
  });
});

describe("la sesión de la app (token de Supabase + mi_cuenta)", () => {
  const usuario = { id: "u1", email: "Persona@Prueba.com" };
  const token = jwt({ sub: "u1", exp: ahora() + 3600 });
  const pedido = { headers: { authorization: `Bearer ${token}` } };
  // Staff con Flujo diario en el club del token de Catapult: entra como usuario.
  const STAFF_DEL_CLUB_DEL_TOKEN = { estado: "autorizado", dueno: null, flujo: true, catapult: true, tecnico: false };

  beforeEach(() => {
    supabaseFalso.usuario = usuario;
    supabaseFalso.errorUsuario = null;
    supabaseFalso.cuenta = { ...STAFF_DEL_CLUB_DEL_TOKEN };
    supabaseFalso.errorCuenta = null;
    supabaseFalso.consultas = [];
  });

  it("sin token pide iniciar sesión", async () => {
    expect(await autenticarBearerSupabase({ headers: {} })).toMatchObject({ ok: false, status: 401, code: "SIN_SESION" });
  });

  it("con un token que Supabase rechaza, la sesión no es válida", async () => {
    supabaseFalso.errorUsuario = new Error("invalid");
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 401, code: "SESION_INVALIDA" });
  });

  it("con su propio token hace una sola consulta: mi_cuenta(), de a una fila (ni perfiles ni puede_usar)", async () => {
    const auth = await autenticarBearerSupabase(pedido);
    expect(auth).toMatchObject({ ok: true, user: { id: "u1", email: "persona@prueba.com", rol: "usuario" } });
    expect(auth.jwtExp).toBe(expDelJwt(token));
    expect(supabaseFalso.consultas).toEqual([{ funcion: "mi_cuenta", argumentos: undefined, unaFila: true }]);
  });

  it("con Flujo diario en un club, pero no en el del token de Catapult: 403 SIN_CATAPULT con su texto", async () => {
    supabaseFalso.cuenta = { ...STAFF_DEL_CLUB_DEL_TOKEN, catapult: false };
    expect(await autenticarBearerSupabase(pedido)).toEqual({
      ok: false,
      status: 403,
      code: "SIN_CATAPULT",
      error: "Tu club todavía no conectó Catapult en la app.",
    });
  });

  it("quien se fue del club (o le sacaron Flujo diario) no entra (403 SIN_PERMISO)", async () => {
    supabaseFalso.cuenta = { ...STAFF_DEL_CLUB_DEL_TOKEN, flujo: false, catapult: false };
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "SIN_PERMISO" });
  });

  it("ser dueño no abre nada: sin Flujo diario no entra, y con Flujo en otro club tampoco", async () => {
    for (const dueno of ["principal", "sub"]) {
      supabaseFalso.cuenta = { estado: "autorizado", dueno, flujo: false, catapult: false, tecnico: false };
      expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "SIN_PERMISO" });
      supabaseFalso.cuenta = { estado: "autorizado", dueno, flujo: true, catapult: false, tecnico: false };
      expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "SIN_CATAPULT" });
    }
  });

  it("el técnico (dueño principal con Flujo diario en el club del token) sale con rol admin", async () => {
    supabaseFalso.cuenta = { estado: "autorizado", dueno: "principal", flujo: true, catapult: true, tecnico: true };
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: true, user: { rol: "admin" } });
  });

  it("el rol admin sale solo de tecnico: un dueño (principal o sub) con Flujo diario en ese club, sin tecnico, es usuario", async () => {
    for (const dueno of ["principal", "sub"]) {
      supabaseFalso.cuenta = { estado: "autorizado", dueno, flujo: true, catapult: true, tecnico: false };
      expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: true, user: { rol: "usuario" } });
    }
  });

  it("tecnico no saltea el corte de Catapult: sin catapult no entra", async () => {
    supabaseFalso.cuenta = { estado: "autorizado", dueno: "principal", flujo: true, catapult: false, tecnico: true };
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "SIN_CATAPULT" });
  });

  it("solo un true de la base deja pasar: cualquier otra respuesta no", async () => {
    for (const respuesta of [null, undefined, "true", 1, [true], {}]) {
      supabaseFalso.cuenta = { ...STAFF_DEL_CLUB_DEL_TOKEN, flujo: respuesta };
      expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "SIN_PERMISO" });
      supabaseFalso.cuenta = { ...STAFF_DEL_CLUB_DEL_TOKEN, catapult: respuesta };
      expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "SIN_CATAPULT" });
      supabaseFalso.cuenta = { ...STAFF_DEL_CLUB_DEL_TOKEN, tecnico: respuesta };
      expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: true, user: { rol: "usuario" } });
    }
  });

  it("sin fila, o pendiente, no entra (403 PENDIENTE), aunque diga Flujo diario y Catapult", async () => {
    supabaseFalso.cuenta = null;
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "PENDIENTE" });
    supabaseFalso.cuenta = { ...STAFF_DEL_CLUB_DEL_TOKEN, estado: "pendiente" };
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "PENDIENTE" });
  });

  it("bloqueada no entra (403 BLOQUEADO), aunque tenga Flujo diario en el club del token o sea el técnico", async () => {
    supabaseFalso.cuenta = { estado: "bloqueado", dueno: null, flujo: true, catapult: true, tecnico: true };
    expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 403, code: "BLOQUEADO" });
  });

  it("si la base no tiene mi_cuenta (sin actualizar) o no contesta, no deja pasar y avisa que reintente (503)", async () => {
    for (const error of [
      { code: "PGRST202", message: "Could not find the function public.mi_cuenta without parameters" },
      { code: "42501", message: "permission denied for function mi_cuenta" },
      { message: "TypeError: fetch failed" },
    ]) {
      supabaseFalso.errorCuenta = error;
      expect(await autenticarBearerSupabase(pedido)).toMatchObject({ ok: false, status: 503, code: "PERFIL_NO_LEGIBLE" });
    }
    // No cae a la consulta vieja: ni perfiles ni puede_usar.
    expect(supabaseFalso.consultas.every((consulta) => consulta.funcion === "mi_cuenta")).toBe(true);
  });
});

describe("ayudas para las rutas", () => {
  it("exigirAdmin deja pasar solo al técnico (rol admin) y propaga un fallo previo", () => {
    const admin = { ok: true, user: { id: "u1", email: "a@b.c", rol: "admin" } };
    const usuario = { ok: true, user: { id: "u2", email: "b@b.c", rol: "usuario" } };
    const fallo = { ok: false, status: 401, code: "SIN_SESION", error: "x" };
    expect(exigirAdmin(admin)).toBe(admin);
    expect(exigirAdmin(usuario)).toEqual({
      ok: false,
      status: 403,
      code: "SOLO_ADMIN",
      error: "Solo el dueño principal puede hacer esto.",
    });
    expect(exigirAdmin(fallo)).toBe(fallo);
  });

  it("exigirDiagnostico: el técnico siempre; el resto, solo con OPENFIELD_DIAGNOSTICO prendida", () => {
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
