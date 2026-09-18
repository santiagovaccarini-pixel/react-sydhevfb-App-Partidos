import {
  describirAutorizacion,
  describirEnvio,
  esHostAuth,
  esHostCatapult,
  resumirCapturas,
} from "./catapultInspect.js";

const base64url = (objeto) => Buffer.from(JSON.stringify(objeto)).toString("base64url");
const jwtFalso = (claims) => `${base64url({ alg: "RS256" })}.${base64url(claims)}.firma`;

describe("hosts", () => {
  it("reconoce los hosts de Catapult y los proveedores de identidad", () => {
    expect(esHostCatapult("of-uw1-prod-activity-service.openfield.catapultsports.com")).toBe(true);
    expect(esHostCatapult("us.openfield.catapultsports.com")).toBe(true);
    expect(esHostCatapult("catapultsports.com.evil.com")).toBe(false);
    expect(esHostAuth("catapult.auth0.com")).toBe(true);
    expect(esHostAuth("cognito-idp.us-west-1.amazonaws.com")).toBe(true);
    expect(esHostAuth("us.openfield.catapultsports.com")).toBe(false);
  });
});

describe("describirAutorizacion", () => {
  it("describe un Bearer JWT sin copiar el token", () => {
    const token = jwtFalso({
      iss: "https://login.catapultsports.com/",
      aud: ["activity-service"],
      exp: 1800000000,
      iat: 1799996400,
      sub: "usuario-secreto",
      email: "alguien@club.com",
      scope: "openid profile",
    });
    const descripcion = describirAutorizacion({ authorization: `Bearer ${token}` });

    expect(descripcion.esquema).toBe("Bearer");
    expect(descripcion.formato).toBe("JWT");
    expect(descripcion.largo).toBe(token.length);
    expect(descripcion.claims).toEqual({
      iss: "https://login.catapultsports.com/",
      aud: ["activity-service"],
      exp: 1800000000,
      iat: 1799996400,
      scope: "openid profile",
    });
    expect(descripcion.claimNombres).toContain("email");
    expect(descripcion.expira).toBe("2027-01-15T08:00:00.000Z");
    expect(JSON.stringify(descripcion)).not.toContain("usuario-secreto");
    expect(JSON.stringify(descripcion)).not.toContain("alguien@club.com");
    expect(JSON.stringify(descripcion)).not.toContain(token);
  });

  it("marca como opaco un token que no es JWT y lista headers especiales", () => {
    const descripcion = describirAutorizacion({
      Authorization: "Bearer abc123",
      "x-api-key": "k",
      "x-tenant-id": "t",
      accept: "application/json",
    });
    expect(descripcion.formato).toBe("opaco");
    expect(descripcion.largo).toBe(6);
    expect(descripcion.headersEspeciales).toEqual(["x-api-key", "x-tenant-id"]);
    expect(JSON.stringify(descripcion)).not.toContain("abc123");
  });

  it("sin Authorization devuelve null, salvo que haya headers especiales", () => {
    expect(describirAutorizacion({ accept: "*/*" })).toBeNull();
    expect(describirAutorizacion({ "x-auth-token": "z" })).toEqual({
      esquema: null,
      headersEspeciales: ["x-auth-token"],
    });
  });
});

describe("describirEnvio", () => {
  it("nunca incluye el contenido: solo claves o largo", () => {
    expect(describirEnvio(JSON.stringify({ username: "u", password: "p" }))).toEqual({
      tipo: "objeto",
      claves: ["username", "password"],
    });
    const formulario = describirEnvio("username=u&password=secreta");
    expect(formulario).toEqual({ tipo: "texto", largo: 27 });
    expect(JSON.stringify(formulario)).not.toContain("secreta");
    expect(describirEnvio("")).toBeNull();
    expect(describirEnvio("[1,2]")).toEqual({ tipo: "array", largo: 2 });
  });
});

describe("resumirCapturas", () => {
  const solicitud = (extra) => ({
    metodo: "GET",
    host: "us.openfield.catapultsports.com",
    path: "/editor/x",
    status: 200,
    autorizacion: null,
    ...extra,
  });

  it("sin tráfico a Catapult lo dice", () => {
    expect(resumirCapturas([solicitud({ host: "cdn.segment.com" })]).veredicto).toBe("sin-trafico");
  });

  it("detecta que el editor no llamó al servicio interno", () => {
    expect(resumirCapturas([solicitud()]).veredicto).toBe("sin-servicio-interno");
  });

  it("identifica la credencial que recibe el servicio de actividad", () => {
    const resumen = resumirCapturas([
      solicitud(),
      solicitud({
        host: "of-uw1-prod-activity-service.openfield.catapultsports.com",
        path: "/activities/abc",
        autorizacion: { esquema: "Bearer", formato: "JWT", largo: 900, expira: "2027-01-01T00:00:00.000Z" },
      }),
      solicitud({ host: "catapult.auth0.com", path: "/oauth/token", metodo: "POST" }),
    ]);
    expect(resumen.veredicto).toBe("credencial-observada");
    expect(resumen.esquemas).toEqual(["Bearer (JWT)"]);
    expect(resumen.proveedorAuth).toEqual(["catapult.auth0.com"]);
    expect(resumen.servicioActividad).toEqual(["GET /activities/abc → 200"]);
    expect(resumen.autorizacionEjemplo.esquema).toBe("Bearer");
  });

  it("avisa cuando el servicio interno no lleva Authorization", () => {
    const resumen = resumirCapturas([
      solicitud({
        host: "of-uw1-prod-activity-service.openfield.catapultsports.com",
        path: "/activities/abc",
        autorizacion: { esquema: null, headersEspeciales: ["x-session-id"] },
      }),
    ]);
    expect(resumen.veredicto).toBe("sin-authorization-visible");
    expect(resumen.detalle).toContain("x-session-id");
  });
});
