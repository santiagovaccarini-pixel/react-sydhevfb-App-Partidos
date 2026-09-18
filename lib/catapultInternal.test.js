import {
  ACTIVITY_SERVICE_BASE_DEFAULT,
  BACKEND_BASE_DEFAULT,
  cabeceraCookies,
  candidatosInternos,
  extraerTokenOauth,
  resumirInterno,
} from "./catapultInternal.js";

describe("candidatosInternos", () => {
  it("arma las rutas con el id escapado y solo GET", () => {
    const lista = candidatosInternos({ activityId: "a/b" });
    expect(lista.every((c) => c.metodo === "GET")).toBe(true);
    expect(lista.map((c) => c.url)).toEqual([
      `${ACTIVITY_SERVICE_BASE_DEFAULT}/activities/a%2Fb`,
      `${ACTIVITY_SERVICE_BASE_DEFAULT}/activities/a%2Fb/periods`,
      `${BACKEND_BASE_DEFAULT}/api/v6/activities/a%2Fb`,
      `${BACKEND_BASE_DEFAULT}/api/v6/activities/a%2Fb`,
    ]);
    expect(lista.filter((c) => c.conCookies).map((c) => c.clave)).toEqual(["backend-v6-sesion"]);
  });

  it("respeta bases alternativas y les quita la barra final", () => {
    const lista = candidatosInternos({
      activityId: "x",
      backendBase: "https://b.example/",
      activityServiceBase: "https://s.example//",
    });
    expect(lista[0].url).toBe("https://s.example/activities/x");
    expect(lista[2].url).toBe("https://b.example/api/v6/activities/x");
  });
});

describe("cabeceraCookies", () => {
  const cookies = [
    { name: "openfield_cloud_session", value: "s1", domain: ".openfield.catapultsports.com" },
    { name: "XSRF-TOKEN", value: "x1", domain: ".openfield.catapultsports.com" },
    { name: "AWSALBTG", value: "a1", domain: "backend-us.openfield.catapultsports.com" },
    { name: "otra", value: "o1", domain: "us.openfield.catapultsports.com" },
  ];

  it("incluye solo las cookies cuyo dominio cubre al host", () => {
    expect(cabeceraCookies(cookies, "backend-us.openfield.catapultsports.com")).toBe(
      "openfield_cloud_session=s1; XSRF-TOKEN=x1; AWSALBTG=a1",
    );
  });

  it("no manda cookies a otros dominios", () => {
    expect(cabeceraCookies(cookies, "catapultsports.com.evil.com")).toBe("");
    expect(cabeceraCookies([], "backend-us.openfield.catapultsports.com")).toBe("");
  });
});

describe("extraerTokenOauth", () => {
  it("toma el access_token y anota si vino refresh, sin conservarlo", () => {
    const pase = extraerTokenOauth({
      access_token: "abc",
      token_type: "Bearer",
      expires_in: "3600",
      refresh_token: "secreto",
    });
    expect(pase).toEqual({ accessToken: "abc", tokenType: "Bearer", expiresIn: 3600, tieneRefresh: true });
    expect(JSON.stringify(pase)).not.toContain("secreto");
  });

  it("devuelve null sin access_token", () => {
    expect(extraerTokenOauth({ token_type: "Bearer" })).toBeNull();
    expect(extraerTokenOauth(null)).toBeNull();
    expect(extraerTokenOauth([])).toBeNull();
  });
});

describe("resumirInterno", () => {
  const r = (clave, status) => ({ clave, status });

  it("sin pase no prueba nada", () => {
    expect(resumirInterno([r("servicio-actividad", 200)], { tokenCapturado: false }).veredicto).toBe(
      "sin-pase",
    );
  });

  it("prioriza que el servicio interno abra con el pase", () => {
    const resumen = resumirInterno(
      [r("servicio-actividad", 200), r("backend-v6-pase", 401)],
      { tokenCapturado: true },
    );
    expect(resumen.veredicto).toBe("pase-abre-servicio");
    expect(resumen.rutas).toEqual(["servicio-actividad"]);
  });

  it("distingue que solo abra el backend", () => {
    const resumen = resumirInterno(
      [r("servicio-actividad", 0), r("backend-v6-sesion", 200)],
      { tokenCapturado: true },
    );
    expect(resumen.veredicto).toBe("pase-abre-backend");
    expect(resumen.detalle).toContain("sin respuesta");
  });

  it("detecta rechazo total y falta de respuesta", () => {
    expect(
      resumirInterno([r("a", 401), r("b", 403)], { tokenCapturado: true }).veredicto,
    ).toBe("pase-rechazado");
    expect(resumirInterno([r("a", 0), r("b", 0)], { tokenCapturado: true }).veredicto).toBe(
      "sin-respuesta",
    );
  });
});
