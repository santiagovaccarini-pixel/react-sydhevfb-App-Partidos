import {
  LARGO_MINIMO_CLAVE,
  MARGEN_PASE_MS,
  cifrar,
  claveConfigurada,
  descifrar,
  errorDeTabla,
  obtenerPase,
  paseVigente,
  vencimientoPase,
} from "./catapultCuenta.js";

const CLAVE = "el arquero del 98 tomaba mate frío los martes 4417";
const OTRA = "la volanta del 2004 pedía la pelota al pie siempre 9821";

const jwt = (claims) =>
  `${Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url")}.${Buffer.from(
    JSON.stringify(claims),
  ).toString("base64url")}.firma`;

describe("cifrado de la cuenta", () => {
  it("cifra y descifra con la misma clave, con un resultado distinto cada vez", () => {
    const a = cifrar("secreta", CLAVE);
    const b = cifrar("secreta", CLAVE);
    expect(a).not.toBe(b);
    expect(a.startsWith("v1.")).toBe(true);
    expect(a).not.toContain("secreta");
    expect(descifrar(a, CLAVE)).toBe("secreta");
    expect(descifrar(b, CLAVE)).toBe("secreta");
    expect(descifrar(cifrar("ñandú con acento y 🔒", CLAVE), CLAVE)).toBe("ñandú con acento y 🔒");
  });

  it("con otra clave o con el dato tocado no descifra", () => {
    const blob = cifrar("secreta", CLAVE);
    expect(() => descifrar(blob, OTRA)).toThrow("No se pudo descifrar");
    const partes = blob.split(".");
    partes[3] = partes[3].slice(0, -2) + "AA";
    expect(() => descifrar(partes.join("."), CLAVE)).toThrow("No se pudo descifrar");
    expect(() => descifrar("v0.a.b.c", CLAVE)).toThrow("formato");
    expect(() => descifrar("", CLAVE)).toThrow("formato");
  });

  it("exige una clave configurada y suficientemente larga", () => {
    expect(claveConfigurada("corta")).toBe(false);
    expect(claveConfigurada("x".repeat(LARGO_MINIMO_CLAVE))).toBe(true);
    expect(claveConfigurada(undefined)).toBe(false);
    expect(() => cifrar("x", "corta")).toThrow("CATAPULT_SESSION_KEY");
    expect(() => descifrar("v1.a.b.c", "")).toThrow("CATAPULT_SESSION_KEY");
  });
});

describe("vigencia del pase", () => {
  const ahora = Date.parse("2026-09-20T12:00:00Z");

  it("un pase es vigente solo si le queda más que el margen", () => {
    expect(paseVigente(new Date(ahora + MARGEN_PASE_MS + 1000).toISOString(), ahora)).toBe(true);
    expect(paseVigente(new Date(ahora + MARGEN_PASE_MS - 1000).toISOString(), ahora)).toBe(false);
    expect(paseVigente(null, ahora)).toBe(false);
    expect(paseVigente("no es fecha", ahora)).toBe(false);
  });

  it("toma el vencimiento del claim exp y si no de expires_in", () => {
    const conExp = { accessToken: jwt({ exp: 1789748550 }), expiresIn: 3600 };
    expect(vencimientoPase(conExp, ahora)).toBe("2026-09-18T16:22:30.000Z");

    const opaco = { accessToken: "opaco", expiresIn: 60 };
    expect(vencimientoPase(opaco, ahora)).toBe(new Date(ahora + 60_000).toISOString());

    expect(vencimientoPase({ accessToken: "opaco" }, ahora)).toBe(new Date(ahora + 3_600_000).toISOString());
  });
});

describe("errorDeTabla", () => {
  it("explica la migración faltante y deja pasar otros errores", () => {
    expect(errorDeTabla({ error: 'relation "public.catapult_cuentas" does not exist' })).toMatch(/migración/);
    expect(errorDeTabla({ error: "permission denied" })).toBe("permission denied");
    expect(errorDeTabla({})).toMatch(/No se pudo acceder/);
  });
});

describe("obtenerPase", () => {
  const ahora = Date.parse("2026-09-20T12:00:00Z");

  it("usa el pase del cache mientras esté vigente y no llama al login", async () => {
    process.env.CATAPULT_SESSION_KEY = CLAVE;
    const iniciarSesion = vi.fn();
    const fila = {
      usuario: "santi",
      secreto: cifrar("pw", CLAVE),
      pase_secreto: cifrar("token-cache", CLAVE),
      pase_expira: new Date(ahora + 30 * 60 * 1000).toISOString(),
    };

    const resultado = await obtenerPaseConFila({ fila, iniciarSesion, ahora });

    expect(resultado.ok).toBe(true);
    expect(resultado.origen).toBe("cache");
    expect(resultado.pase.accessToken).toBe("token-cache");
    expect(iniciarSesion).not.toHaveBeenCalled();
  });

  it("con el pase vencido hace login con la contraseña descifrada y guarda el pase nuevo", async () => {
    process.env.CATAPULT_SESSION_KEY = CLAVE;
    const iniciarSesion = vi.fn(async ({ username, password }) => {
      expect(username).toBe("santi");
      expect(password).toBe("pw");
      return { ok: true, pase: { tokenType: "Bearer", accessToken: "nuevo", expiresIn: 3600 } };
    });
    const guardarPase = vi.fn(async () => ({ ok: true }));
    const fila = {
      usuario: "santi",
      secreto: cifrar("pw", CLAVE),
      pase_secreto: cifrar("viejo", CLAVE),
      pase_expira: new Date(ahora - 1000).toISOString(),
    };

    const resultado = await obtenerPaseConFila({ fila, iniciarSesion, guardarPase, ahora });

    expect(resultado.ok).toBe(true);
    expect(resultado.origen).toBe("login");
    expect(resultado.pase.accessToken).toBe("nuevo");
    expect(resultado.pase.expira).toBe(new Date(ahora + 3_600_000).toISOString());
    expect(guardarPase).toHaveBeenCalledTimes(1);
    expect(resultado.paseGuardado).toBe(true);
  });

  it("sin cuenta o con login rechazado lo dice sin inventar un pase", async () => {
    process.env.CATAPULT_SESSION_KEY = CLAVE;
    expect((await obtenerPaseConFila({ fila: null, iniciarSesion: vi.fn(), ahora })).code).toBe("SIN_CUENTA");

    const rechazo = await obtenerPaseConFila({
      fila: { usuario: "santi", secreto: cifrar("pw", CLAVE), pase_secreto: null, pase_expira: null },
      iniciarSesion: vi.fn(async () => ({ ok: false, code: "CATAPULT_LOGIN_REJECTED", error: "no" })),
      ahora,
    });
    expect(rechazo.ok).toBe(false);
    expect(rechazo.code).toBe("CATAPULT_LOGIN_REJECTED");
  });

  it("si la contraseña guardada no se puede descifrar (clave cambiada) lo informa", async () => {
    process.env.CATAPULT_SESSION_KEY = OTRA;
    const resultado = await obtenerPaseConFila({
      fila: { usuario: "santi", secreto: cifrar("pw", CLAVE), pase_secreto: null, pase_expira: null },
      iniciarSesion: vi.fn(),
      ahora,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.code).toBe("SECRETO_ILEGIBLE");
  });
});

// obtenerPase lee y guarda en Supabase; acá se le inyecta la fila directamente
// simulando el cliente, para probar la decisión cache/login sin red.
async function obtenerPaseConFila({ fila, iniciarSesion, guardarPase, ahora }) {
  const supabaseFalso = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }) }),
      update: () => ({ eq: async () => (guardarPase ? guardarPase() : { error: null }) }),
    }),
  };
  vi.doMock("@supabase/supabase-js", () => ({ createClient: () => supabaseFalso }));
  vi.resetModules();
  const modulo = await import("./catapultCuenta.js");
  try {
    return await modulo.obtenerPase({ token: "t", userId: "u", iniciarSesion, ahora });
  } finally {
    vi.doUnmock("@supabase/supabase-js");
    vi.resetModules();
  }
}
