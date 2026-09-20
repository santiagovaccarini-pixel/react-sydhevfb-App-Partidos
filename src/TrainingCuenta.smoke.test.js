import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TrainingCuenta from "./TrainingCuenta";

vi.mock("./supabase.js", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "token-supabase" } } }),
    },
  },
}));

const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
});

describe("TrainingCuenta", () => {
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

  const montar = async (onCambio = () => {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<TrainingCuenta onCambio={onCambio} />);
    });
    await act(async () => Promise.resolve());
  };

  const botonPorTexto = (texto) =>
    [...contenedor.querySelectorAll("button")].find((boton) => boton.textContent.trim() === texto);

  const escribir = (input, valor) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  test("sin cuenta muestra el formulario, manda el token de la app y conecta", async () => {
    const llamadas = [];
    const fetchMock = vi.fn(async (url, opciones) => {
      llamadas.push({ url, metodo: opciones?.method || "GET", auth: opciones?.headers?.Authorization });
      if (opciones?.method === "POST") {
        return respuesta(200, {
          ok: true,
          cuenta: { configurada: true, usuario: "santi", verificado_en: "2026-09-20T12:00:00Z" },
          message: "Cuenta de Catapult conectada como santi.",
        });
      }
      return respuesta(200, { ok: true, cuenta: { configurada: false } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onCambio = vi.fn();

    await montar(onCambio);

    expect(llamadas[0]).toEqual({ url: "/api/openfield/cuenta", metodo: "GET", auth: "Bearer token-supabase" });
    expect(botonPorTexto("Conectar mi cuenta de Catapult")).toBeDefined();
    expect(onCambio).toHaveBeenLastCalledWith({ configurada: false });

    const usuario = contenedor.querySelector("input[autocomplete='username']");
    const clave = contenedor.querySelector("input[autocomplete='current-password']");
    await act(async () => {
      escribir(usuario, "santi");
      escribir(clave, "secreta");
    });
    await act(async () => botonPorTexto("Conectar mi cuenta de Catapult").click());

    expect(llamadas[1].metodo).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ username: "santi", password: "secreta" });
    expect(contenedor.textContent).toContain("Conectado como santi");
    expect(contenedor.textContent).toContain("Acceso comprobado el");
    expect(botonPorTexto("Desconectar cuenta")).toBeDefined();
    expect(contenedor.querySelector("input[autocomplete='current-password']")).toBeNull();
    expect(onCambio).toHaveBeenLastCalledWith(expect.objectContaining({ configurada: true, usuario: "santi" }));
  });

  test("con cuenta muestra conectado y permite desconectar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opciones) =>
        opciones?.method === "DELETE"
          ? respuesta(200, { ok: true, cuenta: { configurada: false } })
          : respuesta(200, { ok: true, cuenta: { configurada: true, usuario: "santi", verificado_en: null } }),
      ),
    );
    vi.stubGlobal("confirm", vi.fn(() => true));
    const onCambio = vi.fn();

    await montar(onCambio);
    expect(contenedor.textContent).toContain("Conectado como santi");
    expect(contenedor.textContent).toContain("Cuenta guardada.");

    await act(async () => botonPorTexto("Desconectar cuenta").click());

    expect(window.confirm).toHaveBeenCalled();
    expect(contenedor.textContent).toContain("Cuenta desconectada");
    expect(botonPorTexto("Conectar mi cuenta de Catapult")).toBeDefined();
    expect(onCambio).toHaveBeenLastCalledWith({ configurada: false });
  });

  test("si Catapult rechaza la cuenta lo dice y no la da por conectada", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opciones) =>
        opciones?.method === "POST"
          ? respuesta(401, { ok: false, code: "CATAPULT_LOGIN_REJECTED", error: "Catapult no aceptó ese usuario y contraseña. No se guardó nada." })
          : respuesta(200, { ok: true, cuenta: { configurada: false } }),
      ),
    );

    await montar();
    await act(async () => {
      escribir(contenedor.querySelector("input[autocomplete='username']"), "santi");
      escribir(contenedor.querySelector("input[autocomplete='current-password']"), "mala");
    });
    await act(async () => botonPorTexto("Conectar mi cuenta de Catapult").click());

    expect(contenedor.textContent).toContain("Catapult no aceptó ese usuario y contraseña");
    expect(botonPorTexto("Conectar mi cuenta de Catapult")).toBeDefined();
    expect(contenedor.querySelector("input[autocomplete='current-password']").value).toBe("");
  });

  test("si falta la migración lo explica y ofrece reintentar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respuesta(502, {
          ok: false,
          error: "La tabla de cuentas de Catapult no existe todavía: falta ejecutar la migración 20260920_cuenta_catapult.sql en Supabase.",
        }),
      ),
    );

    await montar();
    expect(contenedor.textContent).toContain("No se pudo comprobar tu cuenta");
    expect(contenedor.textContent).toContain("falta ejecutar la migración");
    expect(botonPorTexto("Reintentar")).toBeDefined();
  });
});
