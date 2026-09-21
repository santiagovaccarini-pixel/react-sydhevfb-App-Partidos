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

  const montar = async (onCambio = () => {}, props = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<TrainingCuenta onCambio={onCambio} {...props} />);
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
          message: "Cuenta conectada.",
        });
      }
      return respuesta(200, { ok: true, cuenta: { configurada: false } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onCambio = vi.fn();

    await montar(onCambio);

    expect(llamadas[0]).toEqual({ url: "/api/openfield/cuenta", metodo: "GET", auth: "Bearer token-supabase" });
    expect(contenedor.querySelector("h1").textContent).toBe("Usuario y contraseña");
    expect(botonPorTexto("Conectar")).toBeDefined();
    expect(onCambio).toHaveBeenLastCalledWith({ configurada: false });

    const usuario = contenedor.querySelector("input[autocomplete='username']");
    const clave = contenedor.querySelector("input[autocomplete='current-password']");
    await act(async () => {
      escribir(usuario, "santi");
      escribir(clave, "secreta");
    });
    await act(async () => botonPorTexto("Conectar").click());

    expect(llamadas[1].metodo).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ username: "santi", password: "secreta" });
    expect(contenedor.querySelector(".equipo-propio").textContent).toContain("santi");
    expect(contenedor.textContent).toContain("Comprobada el");
    expect(contenedor.querySelector(".notificacion-guardado").textContent).toContain("Cuenta conectada.");
    expect(botonPorTexto("Desconectar")).toBeDefined();
    expect(contenedor.querySelector("input[autocomplete='current-password']")).toBeNull();
    expect(onCambio).toHaveBeenLastCalledWith(expect.objectContaining({ configurada: true, usuario: "santi" }));
  });

  test("con cuenta muestra conectado y permite desconectar con confirmación", async () => {
    const fetchMock = vi.fn(async (url, opciones) =>
      opciones?.method === "DELETE"
        ? respuesta(200, { ok: true, cuenta: { configurada: false } })
        : respuesta(200, { ok: true, cuenta: { configurada: true, usuario: "santi", verificado_en: null } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onCambio = vi.fn();

    await montar(onCambio);
    expect(contenedor.querySelector(".equipo-propio").textContent).toContain("santi");
    expect(contenedor.textContent).toContain("Cuenta guardada.");

    await act(async () => botonPorTexto("Desconectar").click());
    expect(contenedor.querySelector(".hoja-confirmar h3").textContent).toBe("¿Desconectar tu usuario?");
    expect(fetchMock.mock.calls.some(([, opciones]) => opciones?.method === "DELETE")).toBe(false);

    await act(async () => contenedor.querySelector(".boton-cancelar-hoja").click());
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(botonPorTexto("Desconectar")).toBeDefined();

    await act(async () => botonPorTexto("Desconectar").click());
    await act(async () => contenedor.querySelector(".boton-confirmar-hoja").click());

    const borrado = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === "DELETE");
    expect(borrado[0]).toBe("/api/openfield/cuenta");
    expect(borrado[1].headers.Authorization).toBe("Bearer token-supabase");
    expect(contenedor.textContent).toContain("Cuenta desconectada.");
    expect(botonPorTexto("Conectar")).toBeDefined();
    expect(onCambio).toHaveBeenLastCalledWith({ configurada: false });
  });

  test("con cuentaInicial no vuelve a pedir la cuenta", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const onVolver = vi.fn();

    await montar(() => {}, {
      cuentaInicial: { configurada: true, usuario: "santi", verificado_en: "2026-09-20T12:00:00Z" },
      onVolver,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(contenedor.querySelector(".equipo-propio").textContent).toContain("santi");
    expect(botonPorTexto("Desconectar")).toBeDefined();

    await act(async () => botonPorTexto("Volver a Ajustes").click());
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  test("si rechazan la cuenta lo dice y no la da por conectada", async () => {
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
    await act(async () => botonPorTexto("Conectar").click());

    expect(contenedor.textContent).toContain("Catapult no aceptó ese usuario y contraseña");
    expect(botonPorTexto("Conectar")).toBeDefined();
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
