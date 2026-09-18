import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TrainingSettings from "./TrainingSettings";
import { interpretarRespuesta, resumirSonda } from "../lib/openfieldProbe.js";

const ACTIVIDAD = "9dffa100-99e5-4ce6-921f-226e9e01e264";
const PERIODO = "11111111-2222-4333-8444-555555555555";

// Arma cada fila como lo haría el endpoint: la interpretación sale de la
// misma lógica pura, así el test no inventa un formato paralelo.
const fila = (clave, metodo, ruta, respuesta) => ({
  clave,
  metodo,
  ruta,
  status: respuesta.status,
  ms: 12,
  contentType: "application/json",
  ...interpretarRespuesta(respuesta),
  cuerpo: respuesta.cuerpo || { tipo: "vacio" },
});

const armarSonda = () => {
  const resultados = [
    fila("actividad-get", "GET", `/activities/${ACTIVIDAD}`, {
      status: 404,
      allow: "",
      corsMethods: "",
      cuerpo: { tipo: "objeto", claves: ["message"], message: "Not Found" },
    }),
    fila("periodos-options", "OPTIONS", "/periods", {
      status: 204,
      allow: "GET, POST, OPTIONS",
      corsMethods: "",
    }),
    fila("periodo-get", "GET", `/periods/${PERIODO}`, {
      status: 200,
      allow: "",
      corsMethods: "",
      cuerpo: { tipo: "objeto", claves: ["id", "name", "start_time"] },
    }),
  ];

  return {
    ok: true,
    probe: "capability-read-only",
    version: "capability-probe-v1",
    metodosEnviados: ["GET", "OPTIONS"],
    baseUrl: "https://connect-us.catapultsports.com/api/v6",
    activityId: ACTIVIDAD,
    periodId: PERIODO,
    tokens: [
      { clave: "principal", env: "OPENFIELD_API_TOKEN", configurado: true },
      { clave: "alternativo", env: "OPENFIELD_API_TOKEN_WRITE", configurado: false },
    ],
    control: {
      token: "principal",
      ruta: "/activities",
      status: 200,
      ms: 800,
      ok: true,
      actividadEncontrada: true,
      actividadNombre: "26-05 T",
      periodos: 7,
      primerPeriodoId: PERIODO,
    },
    sondas: { principal: { resultados, resumen: resumirSonda(resultados) } },
  };
};

const respuestaJson = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
});

describe("TrainingSettings · sonda de capacidades", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    contenedor.remove();
    vi.unstubAllGlobals();
  });

  const montar = async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<TrainingSettings onVolverRegistro={() => {}} onVolverModulos={() => {}} />);
    });
  };

  const botonPorTexto = (texto) =>
    [...contenedor.querySelectorAll("button")].find((boton) => boton.textContent.trim() === texto);

  test("muestra cuenta, acceso y write test arriba y pliega los diagnósticos", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await montar();

    expect(botonPorTexto("Verificar acceso (solo lectura)")).toBeDefined();
    expect(botonPorTexto("Escribir TEST APP en 26-05 T")).toBeDefined();
    expect(botonPorTexto("Probar login del editor (solo lectura)")).toBeDefined();
    expect(botonPorTexto("Sondear capacidades")).toBeDefined();
    expect(contenedor.querySelector(".entrenamiento-ajustes-avanzado")?.open).toBe(false);
    expect(contenedor.textContent).toContain("Solo envía GET y OPTIONS");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("ejecuta la sonda y muestra veredicto, tokens y rutas abreviadas", async () => {
    const fetchMock = vi.fn(async () => respuestaJson(200, armarSonda()));
    vi.stubGlobal("fetch", fetchMock);

    await montar();
    await act(async () => botonPorTexto("Sondear capacidades").click());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/openfield/capability-probe");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      credentials: "same-origin",
    });

    const texto = contenedor.textContent;
    expect(texto).toContain("La API anuncia escritura");
    expect(texto).toContain("OPENFIELD_API_TOKEN: configurado");
    expect(texto).toContain("OPENFIELD_API_TOKEN_WRITE: no configurado");
    expect(texto).toContain("26-05 T encontrada · 7 períodos");
    expect(texto).toContain("Allow: GET, POST, OPTIONS");
    expect(texto).toContain("Ruta inexistente (404)");
    expect(texto).toContain("Not Found");

    const rutas = [...contenedor.querySelectorAll(".entrenamiento-sonda-rutas code")].map(
      (nodo) => nodo.textContent,
    );
    expect(rutas).toEqual([
      "GET /activities/{actividad}",
      "OPTIONS /periods",
      "GET /periods/{período}",
    ]);

    expect(botonPorTexto("Copiar resultado")).toBeDefined();
  });

  test("informa cuando la sonda no puede ejecutarse", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respuestaJson(503, {
          ok: false,
          error: "El acceso a OpenField todavía no tiene usuarios autorizados configurados.",
        }),
      ),
    );

    await montar();
    await act(async () => botonPorTexto("Sondear capacidades").click());

    expect(contenedor.textContent).toContain("La sonda no pudo ejecutarse");
    expect(contenedor.textContent).toContain("no tiene usuarios autorizados");
    expect(contenedor.querySelector(".entrenamiento-sonda-token")).toBeNull();
  });
});

describe("TrainingSettings · inspección del Cloud Editor", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    contenedor.remove();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  const montar = async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<TrainingSettings onVolverRegistro={() => {}} onVolverModulos={() => {}} />);
    });
  };

  const botonPorTexto = (texto) =>
    [...contenedor.querySelectorAll("button")].find((boton) => boton.textContent.trim() === texto);

  // React escucha el evento nativo "input"; hay que pasar por el setter del
  // prototipo para que el valor controlado se entere del cambio.
  const escribir = (input, valor) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const inspeccionFalsa = () => ({
    ok: true,
    result: "cloud-editor-inspected",
    editor: { alcanzado: true, nombreVisible: true, path: "/editor/x" },
    solicitudes: [
      {
        id: 1,
        metodo: "GET",
        host: "of-uw1-prod-activity-service.openfield.catapultsports.com",
        path: "/activities/abc",
        status: 200,
        responseType: "application/json",
        tipo: "fetch",
        autorizacion: {
          esquema: "Bearer",
          formato: "JWT",
          largo: 912,
          expira: "2027-01-01T00:00:00.000Z",
          claims: { iss: "https://login.catapultsports.com/" },
          headersEspeciales: [],
        },
        cuerpo: { tipo: "objeto", claves: ["id", "periods"] },
      },
      { id: 2, metodo: "GET", host: "cdn.segment.com", path: "/x", status: 200, tipo: "fetch" },
    ],
    almacenamiento: { localStorage: ["auth"], sessionStorage: [] },
    cookies: [{ name: "sid", httpOnly: true }],
    resumen: {
      veredicto: "credencial-observada",
      detalle: "El servicio interno de actividad recibe Authorization Bearer (JWT).",
      solicitudesCatapult: 1,
      esquemas: ["Bearer (JWT)"],
      proveedorAuth: ["catapult.auth0.com"],
      autorizacionEjemplo: {
        esquema: "Bearer",
        formato: "JWT",
        largo: 912,
        expira: "2027-01-01T00:00:00.000Z",
        claims: { iss: "https://login.catapultsports.com/" },
      },
    },
  });

  test("pide credenciales antes de inspeccionar y no llama al backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await montar();
    await act(async () => botonPorTexto("Inspeccionar Cloud Editor (solo lectura)").click());

    expect(contenedor.textContent).toContain("Completá usuario y contraseña de Catapult en el panel 01");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("inspecciona, muestra la credencial observada y descarta la contraseña", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => inspeccionFalsa(),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await montar();

    const usuario = contenedor.querySelector("input[autocomplete='username']");
    const clave = contenedor.querySelector("input[autocomplete='current-password']");
    await act(async () => {
      escribir(usuario, "santi");
      escribir(clave, "secreta");
    });

    await act(async () => botonPorTexto("Inspeccionar Cloud Editor (solo lectura)").click());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/openfield/cloud-editor-inspect");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      username: "santi",
      password: "secreta",
    });

    const texto = contenedor.textContent;
    expect(texto).toContain("Credencial del editor identificada");
    expect(texto).toContain("Authorization: Bearer (JWT)");
    expect(texto).toContain("Editor de 26-05 T abierto");
    expect(texto).toContain("Identidad vía catapult.auth0.com");

    const rutas = [...contenedor.querySelectorAll(".entrenamiento-sonda-rutas code")].map(
      (nodo) => nodo.textContent,
    );
    expect(rutas).toEqual([
      "GET of-uw1-prod-activity-service.openfield.catapultsports.com/activities/abc",
    ]);

    expect(clave.value).toBe("");
    expect(window.localStorage.getItem("catapult_openfield_username")).toBe("santi");
  });
  test("muestra etapa, detalle y captura cuando el backend informa la falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => ({
          ok: false,
          code: "CATAPULT_BROWSER_ERROR",
          error: "No se pudo completar la inspección del Cloud Editor (etapa: login).",
          etapa: "login",
          detalle: { tipo: "TimeoutError", mensaje: "page.goto: net::ERR_FAILED" },
          paginaActual: "https://us.openfield.catapultsports.com/login",
          captura: "data:image/jpeg;base64,AAAA",
        }),
      })),
    );

    await montar();
    const usuario = contenedor.querySelector("input[autocomplete='username']");
    const clave = contenedor.querySelector("input[autocomplete='current-password']");
    await act(async () => {
      escribir(usuario, "santi");
      escribir(clave, "secreta");
    });
    await act(async () => botonPorTexto("Inspeccionar Cloud Editor (solo lectura)").click());

    const texto = contenedor.textContent;
    expect(texto).toContain("La inspección no pudo completarse");
    expect(texto).toContain("Etapa: login");
    expect(texto).toContain("CATAPULT_BROWSER_ERROR");
    expect(texto).toContain("page.goto: net::ERR_FAILED");
    const imagen = contenedor.querySelector(".entrenamiento-inspeccion-captura img");
    expect(imagen?.getAttribute("src")).toBe("data:image/jpeg;base64,AAAA");
    expect(botonPorTexto("Copiar detalle del error")).toBeDefined();
    expect(clave.value).toBe("");
  });
  test("el write test exige credenciales y la confirmación exacta antes de habilitarse", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: "cloud-write-tested",
        veredicto: { codigo: "escritura-validada", detalle: "Quedó exacto." },
        enviado: {
          periodo: { name: "TEST APP 01", start_time_ms: 1779823358000, end_time_ms: 1779823958000, participantes: 13 },
        },
        put: { status: 200 },
        antes: { interno: { periods: [{}, {}] }, connect: { count: 2 } },
        despues: { interno: { periods: [{}, {}, {}] }, connect: { count: 3 } },
        validacion: {
          interna: { valido: true, diff: { agregados: [{}], eliminados: [], modificados: [] }, corte: { motivo: "ok" }, participantes: { valido: true } },
          connect: { valido: true, diff: { agregados: [{}], eliminados: [], modificados: [] }, corte: { motivo: "ok" }, participantes: { valido: false, detalle: { faltantes: ["a"], sobrantes: [] } } },
        },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await montar();
    const boton = botonPorTexto("Escribir TEST APP en 26-05 T");
    expect(boton).toBeDefined();
    expect(boton.disabled).toBe(true);

    const usuario = contenedor.querySelector("input[autocomplete='username']");
    const clave = contenedor.querySelector("input[autocomplete='current-password']");
    const confirmacion = contenedor.querySelector("input[placeholder='26-05 T']");
    await act(async () => {
      escribir(usuario, "santi");
      escribir(clave, "secreta");
      escribir(confirmacion, "26-05 t");
    });
    expect(botonPorTexto("Escribir TEST APP en 26-05 T").disabled).toBe(true);

    await act(async () => escribir(confirmacion, "26-05 T"));
    expect(botonPorTexto("Escribir TEST APP en 26-05 T").disabled).toBe(false);

    await act(async () => botonPorTexto("Escribir TEST APP en 26-05 T").click());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/openfield/cloud-write-test");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      username: "santi",
      password: "secreta",
      confirmacion: "26-05 T",
    });

    const texto = contenedor.textContent;
    expect(texto).toContain("Escritura validada");
    expect(texto).toContain("PUT batch → 200");
    expect(texto).toContain("TEST APP 01");
    expect(texto).toContain("Interno: 2 → 3 períodos");
    expect(texto).toContain("Participantes: faltan 1, sobran 0");
    expect(clave.value).toBe("");
    expect(confirmacion.value).toBe("");
  });
});
