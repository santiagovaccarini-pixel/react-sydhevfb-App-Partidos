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
      { clave: "lectura", env: "OPENFIELD_API_TOKEN", configurado: true },
      { clave: "escritura", env: "OPENFIELD_API_TOKEN_WRITE", configurado: false },
    ],
    control: {
      token: "lectura",
      ruta: "/activities",
      status: 200,
      ms: 800,
      ok: true,
      actividadEncontrada: true,
      actividadNombre: "26-05 T",
      periodos: 7,
      primerPeriodoId: PERIODO,
    },
    sondas: { lectura: { resultados, resumen: resumirSonda(resultados) } },
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

  test("convive con la prueba de login y no se ejecuta sola", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await montar();

    expect(botonPorTexto("Conectar Catapult")).toBeDefined();
    expect(botonPorTexto("Sondear capacidades")).toBeDefined();
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
