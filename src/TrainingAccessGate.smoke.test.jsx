import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TrainingAccessGate from "./TrainingAccessGate.jsx";

// La sesión de Supabase que hay al abrir (ninguna, salvo que la prueba ponga
// una) y lo que se le pidió a Supabase.
const auth = vi.hoisted(() => ({
  sesion: null,
  signInWithPassword: null,
  resetPasswordForEmail: null,
  signUp: null,
}));

vi.mock("./supabase.js", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: auth.sesion }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: (...args) => auth.signInWithPassword(...args),
      resetPasswordForEmail: (...args) => auth.resetPasswordForEmail(...args),
      signUp: (...args) => auth.signUp(...args),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ error: null }),
    },
  },
}));

const respuesta = (cuerpo, ok = true) => ({ ok, json: async () => cuerpo });

describe("la puerta de Flujo diario", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    auth.sesion = null;
    auth.signInWithPassword = vi.fn(async () => ({
      data: { session: { access_token: "tok", user: { email: "dt@club.com" } } },
      error: null,
    }));
    auth.resetPasswordForEmail = vi.fn(async () => ({ error: null }));
    auth.signUp = vi.fn(async () => ({ data: { session: null }, error: null }));
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ ok: true, email: "dt@club.com" })));
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
  });

  const montar = async (props = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(
        <TrainingAccessGate onVolver={props.onVolver || (() => {})}>
          {({ email }) => <div className="adentro">Adentro {email}</div>}
        </TrainingAccessGate>,
      );
    });
    // Que terminen las promesas de la comprobación de acceso.
    await act(async () => Promise.resolve());
  };

  const boton = (texto) =>
    Array.from(contenedor.querySelectorAll("button")).find((b) => b.textContent.trim() === texto);

  const escribir = async (input, valor) => {
    const poner = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    await act(async () => {
      poner.call(input, valor);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  test("sin sesión muestra la puerta: la foto atrás, la nube y el formulario", async () => {
    await montar();

    expect(contenedor.querySelector(".training-access-fondo img").getAttribute("src")).toBe("/portal/flujo.webp");
    expect(contenedor.querySelector(".training-access-card .portal-icono svg")).not.toBeNull();
    expect(contenedor.querySelector(".training-access-kicker").textContent).toBe("Flujo diario");
    expect(contenedor.querySelector("h1").textContent).toBe("Entrá con tu cuenta");
    expect(contenedor.querySelector('input[type="email"]')).not.toBeNull();
    expect(contenedor.querySelector('input[type="password"]')).not.toBeNull();
    expect(boton("Entrar")).not.toBeNull();
    expect(boton("Olvidé mi contraseña")).not.toBeNull();
    expect(boton("Crear una cuenta")).not.toBeNull();
    expect(boton("Volver al portal")).not.toBeNull();
    expect(contenedor.querySelector(".training-access-card small").textContent).toContain("hay que autorizarla");
    expect(contenedor.querySelector(".adentro")).toBeNull();
  });

  test("en el celular, parado, la foto de atrás es la parada", async () => {
    const tamano = [window.innerWidth, window.innerHeight];
    window.innerWidth = 390;
    window.innerHeight = 844;
    try {
      await montar();
      expect(contenedor.querySelector(".training-access-fondo img").getAttribute("src")).toBe("/portal/flujo-parada.webp");
    } finally {
      [window.innerWidth, window.innerHeight] = tamano;
    }
  });

  test("Volver al portal llama a onVolver", async () => {
    const onVolver = vi.fn();
    await montar({ onVolver });
    await act(async () => boton("Volver al portal").click());
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  test("Olvidé mi contraseña sin correo avisa, y con correo manda el enlace", async () => {
    await montar();

    await act(async () => boton("Olvidé mi contraseña").click());
    expect(contenedor.querySelector(".training-access-message.error").textContent).toBe("Escribí tu correo primero.");
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();

    await escribir(contenedor.querySelector('input[type="email"]'), "dt@club.com");
    await act(async () => boton("Olvidé mi contraseña").click());
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("dt@club.com", {
      redirectTo: expect.stringContaining("training_recovery=1"),
    });
    expect(contenedor.querySelector(".training-access-message.error")).toBeNull();
    expect(contenedor.querySelector(".training-access-message.ok").textContent).toContain("enlace");
  });

  test("entrar con correo y contraseña comprueba el acceso y deja pasar", async () => {
    await montar();

    await escribir(contenedor.querySelector('input[type="email"]'), "dt@club.com");
    await escribir(contenedor.querySelector('input[type="password"]'), "secreta123");
    await act(async () => {
      contenedor.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => Promise.resolve());

    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "dt@club.com", password: "secreta123" });
    // El servidor recibió la sesión y contestó que sí.
    const [url, opciones] = fetch.mock.calls.find(([u]) => String(u).endsWith("/api/openfield/session"));
    expect(url).toBe("/api/openfield/session");
    expect(opciones.method).toBe("POST");
    expect(opciones.headers.Authorization).toBe("Bearer tok");
    expect(contenedor.querySelector(".adentro").textContent).toBe("Adentro dt@club.com");
  });

  test("si el servidor no autoriza el correo, lo dice y no deja pasar", async () => {
    auth.sesion = { access_token: "tok", user: { email: "otro@club.com" } };
    fetch.mockImplementation(async () => respuesta({ ok: false, error: "Tu correo no está autorizado." }, false));
    await montar();

    expect(contenedor.querySelector(".adentro")).toBeNull();
    expect(contenedor.querySelector("h1").textContent).toBe("Entrá con tu cuenta");
    expect(contenedor.querySelector(".training-access-message.error").textContent).toBe("Tu correo no está autorizado.");
  });

  test("con una sesión guardada entra directo", async () => {
    auth.sesion = { access_token: "tok", user: { email: "dt@club.com" } };
    await montar();

    expect(contenedor.querySelector(".adentro").textContent).toBe("Adentro dt@club.com");
  });

  test("volviendo del enlace de recuperación sin sesión, pide uno nuevo", async () => {
    window.history.replaceState({}, "", "/?training_recovery=1");
    await montar();

    expect(contenedor.querySelector("h1").textContent).toBe("Elegí una contraseña nueva");
    expect(contenedor.querySelector(".training-access-message.error").textContent).toContain("Pedí uno nuevo");
    expect(boton("Guardar contraseña").disabled).toBe(true);
    expect(boton("Volver al portal")).not.toBeNull();
  });
});
