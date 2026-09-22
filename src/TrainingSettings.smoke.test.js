import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TrainingSettings from "./TrainingSettings";
import { interpretarRespuesta, resumirSonda } from "../lib/openfieldProbe.js";

// La lista de jugadores tiene sus propios tests; acá se aísla.
vi.mock("./TrainingJugadores", () => ({ default: () => null }));

// Como en el módulo: la subpantalla de Ajustes vive en el padre.
const Ajustes = ({ onVolverModulos = () => {}, onCerrarSesion = () => {} }) => {
  const [vista, setVista] = useState("inicio");
  return (
    <TrainingSettings
      vista={vista}
      onCambiarVista={setVista}
      onVolverModulos={onVolverModulos}
      email="x@y"
      onCerrarSesion={onCerrarSesion}
    />
  );
};

vi.mock("./supabase.js", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "token-supabase" } } }),
    },
  },
}));

const ACTIVIDAD = "9dffa100-99e5-4ce6-921f-226e9e01e264";
const PERIODO = "11111111-2222-4333-8444-555555555555";

const respuestaJson = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
});

const CUENTA_CONECTADA = { configurada: true, usuario: "santi", verificado_en: "2026-09-20T12:00:00Z" };
const SIN_CUENTA = { configurada: false };

// fetch de prueba: responde el estado de la cuenta en el montaje y delega el
// resto en `resto(url, opciones)`.
const fetchRuteado = (cuenta, resto = () => respuestaJson(500, { ok: false, error: "sin ruta" })) =>
  vi.fn(async (url, opciones) => {
    if (url === "/api/openfield/cuenta" && (!opciones?.method || opciones.method === "GET")) {
      return respuestaJson(200, { ok: true, cuenta });
    }
    return resto(url, opciones);
  });

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

const escribir = (input, valor) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("TrainingSettings", () => {
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

  const montar = async (props = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<Ajustes {...props} />);
    });
    await act(async () => Promise.resolve());
  };

  const botonPorTexto = (texto) =>
    [...contenedor.querySelectorAll("button")].find((boton) => boton.textContent.trim() === texto);

  const opcion = (titulo) =>
    [...contenedor.querySelectorAll(".opcion-ajuste")].find((boton) =>
      boton.querySelector(".texto-ajuste b")?.textContent === titulo,
    );

  const entrarA = async (titulo) => {
    await act(async () => opcion(titulo).click());
    await act(async () => Promise.resolve());
  };

  test("sin cuenta: pide conectarla y deja bloqueados el acceso y el write test", async () => {
    const fetchMock = fetchRuteado(SIN_CUENTA);
    vi.stubGlobal("fetch", fetchMock);

    await montar();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/openfield/cuenta");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token-supabase");

    expect(contenedor.querySelector("h1").textContent).toBe("Ajustes");
    expect([...contenedor.querySelectorAll(".opcion-ajuste .texto-ajuste b")].map((b) => b.textContent)).toEqual([
      "Usuario y contraseña",
      "Lista de jugadores",
      "Pruebas técnicas",
      "Cerrar sesión",
    ]);
    expect(opcion("Usuario y contraseña").textContent).toContain("Todavía no conectaste tu usuario");
    expect(opcion("Cerrar sesión").textContent).toContain("x@y");

    // La cuenta ya se leyó: entrar a "Usuario y contraseña" no la vuelve a pedir.
    await entrarA("Usuario y contraseña");
    expect(contenedor.querySelector("h1").textContent).toBe("Usuario y contraseña");
    expect(botonPorTexto("Conectar")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => botonPorTexto("Volver a Ajustes").click());
    expect(contenedor.querySelector("h1").textContent).toBe("Ajustes");

    await entrarA("Pruebas técnicas");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(contenedor.querySelector("h1").textContent).toBe("Pruebas técnicas");
    expect(botonPorTexto("Volver a Ajustes")).toBeDefined();
    expect(botonPorTexto("Probar conexión (solo lectura)").disabled).toBe(true);
    expect(botonPorTexto("Escribir TEST APP en 26-05 T").disabled).toBe(true);
    expect(contenedor.textContent).toContain("Primero conectá tu cuenta de Catapult");

    expect(botonPorTexto("Probar login del editor (solo lectura)")).toBeDefined();
    expect(botonPorTexto("Sondear capacidades")).toBeDefined();
    expect(contenedor.querySelector(".entrenamiento-ajustes-avanzado")?.open).toBe(false);
  });

  test("con cuenta: prueba la conexión sin pedir contraseña y muestra el resultado", async () => {
    const fetchMock = fetchRuteado(CUENTA_CONECTADA, (url) =>
      url === "/api/openfield/cloud-token-probe"
        ? respuestaJson(200, {
            ok: true,
            usuario: "santi",
            origenPase: "cache",
            pase: { capturado: true, tipo: "Bearer", formato: "JWT", largo: 1816, expira: "2026-09-20T13:00:00Z" },
            resultados: [
              {
                clave: "servicio-actividad",
                descripcion: "Servicio interno de actividad, con el pase",
                metodo: "GET",
                host: "of-uw1-prod-activity-service.openfield.catapultsports.com",
                path: `/activities/${ACTIVIDAD}`,
                conCookies: false,
                status: 200,
                contentType: "application/json",
                cuerpo: { tipo: "objeto", claves: ["id", "name", "periods"] },
              },
            ],
            resumen: { veredicto: "pase-abre-servicio", detalle: "El pase abre el servicio interno." },
          })
        : respuestaJson(500, { ok: false, error: "sin ruta" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await montar();
    expect(opcion("Usuario y contraseña").textContent).toContain("Conectado como santi");
    await entrarA("Pruebas técnicas");

    const boton = botonPorTexto("Probar conexión (solo lectura)");
    expect(boton.disabled).toBe(false);
    await act(async () => boton.click());

    const llamada = fetchMock.mock.calls.find(([url]) => url === "/api/openfield/cloud-token-probe");
    expect(llamada[1].method).toBe("POST");
    expect(llamada[1].headers.Authorization).toBe("Bearer token-supabase");
    expect(JSON.parse(llamada[1].body)).toEqual({});

    const texto = contenedor.textContent;
    expect(texto).toContain("El pase abre el servicio interno de actividad");
    expect(texto).toContain("Pase capturado");
  });

  test("con cuenta: el write test solo necesita la confirmación exacta", async () => {
    const fetchMock = fetchRuteado(CUENTA_CONECTADA, (url) =>
      url === "/api/openfield/cloud-write-test"
        ? respuestaJson(200, {
            ok: true,
            result: "cloud-write-tested",
            usuario: "santi",
            origenPase: "cache",
            veredicto: { codigo: "escritura-validada", detalle: "Quedó exacto." },
            enviado: {
              periodo: { name: "TEST APP 02", start_time_ms: 1779823358000, end_time_ms: 1779823958000, participantes: 13 },
            },
            put: { status: 200 },
            antes: { interno: { periods: [{}] }, connect: { count: 1 } },
            despues: { interno: { periods: [{}, {}] }, connect: { count: 2 } },
            validacion: {
              interna: { valido: true, diff: { agregados: [{}], eliminados: [], modificados: [] }, corte: { motivo: "ok" }, participantes: { valido: true } },
              connect: { valido: true, diff: { agregados: [{}], eliminados: [], modificados: [] }, corte: { motivo: "ok" }, participantes: { valido: true } },
            },
          })
        : respuestaJson(500, { ok: false, error: "sin ruta" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await montar();
    await entrarA("Pruebas técnicas");
    const confirmacion = contenedor.querySelector("input[placeholder='26-05 T']");
    expect(botonPorTexto("Escribir TEST APP en 26-05 T").disabled).toBe(true);

    await act(async () => escribir(confirmacion, "26-05 T"));
    expect(botonPorTexto("Escribir TEST APP en 26-05 T").disabled).toBe(false);

    await act(async () => botonPorTexto("Escribir TEST APP en 26-05 T").click());

    const llamada = fetchMock.mock.calls.find(([url]) => url === "/api/openfield/cloud-write-test");
    expect(JSON.parse(llamada[1].body)).toEqual({ confirmacion: "26-05 T" });
    expect(llamada[1].headers.Authorization).toBe("Bearer token-supabase");

    const texto = contenedor.textContent;
    expect(texto).toContain("Escritura validada");
    expect(texto).toContain("PUT batch → 200");
    expect(texto).toContain("Interno: 1 → 2 períodos");
    expect(confirmacion.value).toBe("");
  });

  test("la sonda de la Connect API sigue funcionando desde el diagnóstico avanzado", async () => {
    const fetchMock = fetchRuteado(SIN_CUENTA, (url) =>
      url === "/api/openfield/capability-probe"
        ? respuestaJson(200, armarSonda())
        : respuestaJson(500, { ok: false, error: "sin ruta" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await montar();
    await entrarA("Pruebas técnicas");
    await act(async () => botonPorTexto("Sondear capacidades").click());

    const llamada = fetchMock.mock.calls.find(([url]) => url === "/api/openfield/capability-probe");
    expect(llamada[1]).toMatchObject({ method: "GET", credentials: "same-origin" });

    const texto = contenedor.textContent;
    expect(texto).toContain("La API anuncia escritura");
    expect(texto).toContain("26-05 T encontrada · 7 períodos");
    expect(texto).toContain("Allow: GET, POST, OPTIONS");

    const rutas = [...contenedor.querySelectorAll(".entrenamiento-sonda-rutas code")].map(
      (nodo) => nodo.textContent,
    );
    expect(rutas).toEqual(["GET /activities/{actividad}", "OPTIONS /periods", "GET /periods/{período}"]);
  });

  test("la inspección avanzada usa las credenciales del bloque avanzado y las descarta", async () => {
    const fetchMock = fetchRuteado(CUENTA_CONECTADA, (url) =>
      url === "/api/openfield/cloud-editor-inspect"
        ? respuestaJson(200, {
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
                autorizacion: { esquema: "Bearer", formato: "JWT", largo: 912, expira: "2027-01-01T00:00:00.000Z", claims: {}, headersEspeciales: [] },
                cuerpo: { tipo: "objeto", claves: ["id", "periods"] },
              },
            ],
            almacenamiento: { localStorage: [], sessionStorage: [] },
            cookies: [],
            resumen: {
              veredicto: "credencial-observada",
              detalle: "El servicio interno recibe Authorization Bearer (JWT).",
              solicitudesCatapult: 1,
              esquemas: ["Bearer (JWT)"],
              proveedorAuth: [],
              autorizacionEjemplo: { esquema: "Bearer", formato: "JWT", largo: 912, expira: "2027-01-01T00:00:00.000Z", claims: {} },
            },
          })
        : respuestaJson(500, { ok: false, error: "sin ruta" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await montar();
    await entrarA("Pruebas técnicas");

    // En Pruebas técnicas los únicos campos de usuario/contraseña son los del bloque avanzado.
    const usuario = contenedor.querySelector("input[autocomplete='username']");
    const clave = contenedor.querySelector("input[autocomplete='current-password']");
    await act(async () => {
      escribir(usuario, "santi");
      escribir(clave, "secreta");
    });
    await act(async () => botonPorTexto("Inspeccionar Cloud Editor (solo lectura)").click());

    const llamada = fetchMock.mock.calls.find(([url]) => url === "/api/openfield/cloud-editor-inspect");
    expect(JSON.parse(llamada[1].body)).toEqual({ username: "santi", password: "secreta" });

    expect(contenedor.textContent).toContain("Credencial del editor identificada");
    expect(clave.value).toBe("");
  });

  test("informa etapa y detalle cuando una prueba falla", async () => {
    const fetchMock = fetchRuteado(CUENTA_CONECTADA, (url) =>
      url === "/api/openfield/cloud-token-probe"
        ? respuestaJson(502, {
            ok: false,
            code: "CATAPULT_LOGIN_REJECTED",
            error: "Catapult no aceptó la cuenta guardada.",
            etapa: "login",
          })
        : respuestaJson(500, { ok: false, error: "sin ruta" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await montar();
    await entrarA("Pruebas técnicas");
    await act(async () => botonPorTexto("Probar conexión (solo lectura)").click());

    const texto = contenedor.textContent;
    expect(texto).toContain("La prueba del pase no pudo completarse");
    expect(texto).toContain("Catapult no aceptó la cuenta guardada");
    expect(texto).toContain("Etapa: login");
    expect(botonPorTexto("Copiar detalle del error")).toBeDefined();
  });

  test("conectar desde Usuario y contraseña actualiza el subtexto del menú", async () => {
    const fetchMock = fetchRuteado(SIN_CUENTA, (url, opciones) =>
      url === "/api/openfield/cuenta" && opciones?.method === "POST"
        ? respuestaJson(200, { ok: true, cuenta: CUENTA_CONECTADA, message: "Cuenta conectada." })
        : respuestaJson(500, { ok: false, error: "sin ruta" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await montar();
    await entrarA("Usuario y contraseña");

    await act(async () => {
      escribir(contenedor.querySelector("input[autocomplete='username']"), "santi");
      escribir(contenedor.querySelector("input[autocomplete='current-password']"), "secreta");
    });
    await act(async () => botonPorTexto("Conectar").click());

    const llamada = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "POST");
    expect(llamada[0]).toBe("/api/openfield/cuenta");
    expect(JSON.parse(llamada[1].body)).toEqual({ username: "santi", password: "secreta" });
    expect(contenedor.querySelector(".equipo-propio").textContent).toContain("santi");
    expect(botonPorTexto("Desconectar")).toBeDefined();

    await act(async () => botonPorTexto("Volver a Ajustes").click());
    expect(opcion("Usuario y contraseña").textContent).toContain("Conectado como santi");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("cerrar sesión sale por Ajustes con confirmación", async () => {
    vi.stubGlobal("fetch", fetchRuteado(SIN_CUENTA));
    const onCerrarSesion = vi.fn();

    await montar({ onCerrarSesion });

    await act(async () => opcion("Cerrar sesión").click());
    expect(contenedor.querySelector(".hoja-confirmar h3").textContent).toBe("¿Cerrar sesión?");
    await act(async () => contenedor.querySelector(".boton-cancelar-hoja").click());
    expect(onCerrarSesion).not.toHaveBeenCalled();
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();

    await act(async () => opcion("Cerrar sesión").click());
    await act(async () => contenedor.querySelector(".boton-confirmar-hoja").click());
    expect(onCerrarSesion).toHaveBeenCalledTimes(1);
  });
});
