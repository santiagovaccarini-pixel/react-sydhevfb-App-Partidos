import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import OpenFieldSession from "./OpenFieldSession.jsx";
import { fijarIdiomaParaPruebas } from "./idioma/index.js";

const api = vi.hoisted(() => ({ respuesta: null, cambios: [] }));

vi.mock("./supabase.js", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb) => {
        api.cambios.push(cb);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  },
}));

vi.mock("./trainingApi.js", async () => {
  const real = await vi.importActual("./trainingApi.js");
  return { ...real, abrirSesionOpenField: vi.fn(async () => api.respuesta) };
});

const { abrirSesionOpenField } = await import("./trainingApi.js");

describe("la sesión de OpenField antes de Flujo diario", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    api.cambios = [];
    api.respuesta = { respuesta: { ok: true, status: 200 }, payload: { ok: true, email: "dt@club.com", rol: "admin" } };
    abrirSesionOpenField.mockClear();
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
  });

  const montar = async (onVolver = () => {}, props = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(
        <OpenFieldSession onVolver={onVolver} {...props}>
          {({ rol, sinSenal }) => (
            <div className="modulo">
              Flujo diario como {rol}
              {sinSenal ? " (sin señal)" : ""}
            </div>
          )}
        </OpenFieldSession>,
      );
    });
    await act(async () => Promise.resolve());
  };

  const conSenal = async (valor, prueba) => {
    const enLinea = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: valor });
    try {
      await prueba();
    } finally {
      if (enLinea) Object.defineProperty(navigator, "onLine", enLinea);
      else delete navigator.onLine;
    }
  };

  test("abre la sesión en el servidor y muestra el módulo con el rol", async () => {
    await montar();
    expect(abrirSesionOpenField).toHaveBeenCalledTimes(1);
    expect(contenedor.querySelector(".modulo").textContent).toBe("Flujo diario como admin");
  });

  test("cuando Supabase renueva el token, renueva la cookie sin tocar el módulo", async () => {
    await montar();
    await act(async () => {
      api.cambios.forEach((cb) => cb("TOKEN_REFRESHED", {}));
    });
    expect(abrirSesionOpenField).toHaveBeenCalledTimes(2);
    expect(contenedor.querySelector(".modulo")).not.toBeNull();
  });

  test("si el servidor dice que la cuenta no tiene Flujo diario, lo muestra y deja volver al portal", async () => {
    api.respuesta = { respuesta: { ok: false, status: 403 }, payload: { ok: false, code: "SIN_PERMISO", error: "Tu cuenta no tiene habilitado Flujo diario." } };
    const onVolver = vi.fn();
    await montar(onVolver);

    expect(contenedor.querySelector("h1").textContent).toBe("Sin acceso a Flujo diario");
    expect(contenedor.querySelector(".training-access-card p").textContent).toBe("Tu cuenta no tiene habilitado Flujo diario.");
    await act(async () => contenedor.querySelector(".training-access-volver").click());
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  test("si su club no tiene Catapult en la app, lo dice en el idioma de la app", async () => {
    api.respuesta = { respuesta: { ok: false, status: 403 }, payload: { ok: false, code: "SIN_CATAPULT", error: "Tu club todavía no conectó Catapult en la app." } };
    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe("Sin acceso a Flujo diario");
    expect(contenedor.querySelector(".training-access-card p").textContent).toBe("Tu club todavía no conectó Catapult en la app.");

    await act(async () => raiz.unmount());
    fijarIdiomaParaPruebas("pt-BR");
    try {
      await montar();
      expect(contenedor.querySelector(".training-access-card p").textContent).toBe("Seu clube ainda não conectou o Catapult no app.");
    } finally {
      fijarIdiomaParaPruebas("es-AR");
    }
  });

  test("sin señal no espera al servidor: entra como usuario y avisa, y abre la sesión al volver la conexión", async () => {
    await conSenal(false, async () => {
      await montar(undefined, {});
      expect(abrirSesionOpenField).not.toHaveBeenCalled();
      expect(contenedor.querySelector(".modulo").textContent).toBe("Flujo diario como usuario (sin señal)");
    });

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await act(async () => Promise.resolve());
    expect(abrirSesionOpenField).toHaveBeenCalledTimes(1);
    expect(contenedor.querySelector(".modulo").textContent).toBe("Flujo diario como admin");
  });

  test("quien entró con la copia de su cuenta tampoco espera al servidor", async () => {
    await montar(undefined, { sinSenal: true });
    expect(abrirSesionOpenField).not.toHaveBeenCalled();
    expect(contenedor.querySelector(".modulo").textContent).toContain("(sin señal)");
  });

  test("si el pedido falla por la red (hay barras pero no pasan datos), entra igual", async () => {
    abrirSesionOpenField.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await montar();
    expect(contenedor.querySelector(".modulo").textContent).toBe("Flujo diario como usuario (sin señal)");
  });

  test("sin token y sin señal entra igual; sin token con señal pide entrar", async () => {
    api.respuesta = { respuesta: null, payload: null };
    await conSenal(false, async () => {
      await montar();
      expect(contenedor.querySelector(".modulo")).not.toBeNull();
    });
    await act(async () => raiz.unmount());
    raiz = null;

    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe("No pudimos conectar con OpenField");
    expect(contenedor.querySelector(".training-access-card p").textContent).toBe("Iniciá sesión para acceder a OpenField.");
  });

  test("si el servidor se cae (5xx), entra como sin señal con un aviso, y Reintentar vuelve a probar sin sacar el módulo", async () => {
    api.respuesta = { respuesta: { ok: false, status: 503 }, payload: { ok: false, code: "PERFIL_NO_LEGIBLE", error: "No se pudo comprobar tu cuenta." } };
    await montar();
    expect(contenedor.querySelector(".modulo").textContent).toBe("Flujo diario como usuario (sin señal)");
    const modulo = contenedor.querySelector(".modulo");
    expect(contenedor.querySelector(".aviso-openfield-caido").textContent).toContain("OpenField no responde");
    const reintentar = () => Array.from(contenedor.querySelectorAll(".aviso-openfield-caido button")).find((b) => b.textContent.trim() === "Reintentar");

    // Sigue caído: el aviso queda.
    await act(async () => reintentar().click());
    await act(async () => Promise.resolve());
    expect(abrirSesionOpenField).toHaveBeenCalledTimes(2);
    expect(contenedor.querySelector(".aviso-openfield-caido")).not.toBeNull();

    api.respuesta = { respuesta: { ok: true, status: 200 }, payload: { ok: true, rol: "admin" } };
    await act(async () => reintentar().click());
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".aviso-openfield-caido")).toBeNull();
    expect(contenedor.querySelector(".modulo").textContent).toBe("Flujo diario como admin");
    // El mismo módulo (no se volvió a armar).
    expect(contenedor.querySelector(".modulo")).toBe(modulo);
  });

  test("otro error del servidor (no 5xx) avisa en pantalla y Reintentar vuelve a probar", async () => {
    api.respuesta = { respuesta: { ok: false, status: 400 }, payload: { ok: false, code: "OTRO", error: "Algo no anduvo." } };
    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe("No pudimos conectar con OpenField");

    api.respuesta = { respuesta: { ok: true, status: 200 }, payload: { ok: true, rol: "usuario" } };
    const reintentar = Array.from(contenedor.querySelectorAll("button")).find((b) => b.textContent.trim() === "Reintentar");
    await act(async () => reintentar.click());
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".modulo").textContent).toBe("Flujo diario como usuario");
  });
});
