import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import OpenFieldSession from "./OpenFieldSession.jsx";

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

  const montar = async (onVolver = () => {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(
        <OpenFieldSession onVolver={onVolver}>{({ rol }) => <div className="modulo">Flujo diario como {rol}</div>}</OpenFieldSession>,
      );
    });
    await act(async () => Promise.resolve());
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

  test("si el servidor falla, avisa y Reintentar vuelve a probar", async () => {
    api.respuesta = { respuesta: { ok: false, status: 503 }, payload: { ok: false, code: "PERFIL_NO_LEGIBLE", error: "No se pudo comprobar tu cuenta." } };
    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe("No pudimos conectar con OpenField");

    api.respuesta = { respuesta: { ok: true, status: 200 }, payload: { ok: true, rol: "usuario" } };
    const reintentar = Array.from(contenedor.querySelectorAll("button")).find((b) => b.textContent.trim() === "Reintentar");
    await act(async () => reintentar.click());
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".modulo").textContent).toBe("Flujo diario como usuario");
  });
});
