import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AccessGate from "./AccessGate.jsx";
import { CLAVE_PERFIL_LOCAL } from "./domain/perfilesDb.js";

// La sesión de Supabase que hay al abrir, el perfil de esa cuenta en la
// base y lo que se le pidió a Supabase.
const supa = vi.hoisted(() => ({
  sesion: null,
  errorSesion: null,
  perfil: null,
  errorPerfil: null,
  signInWithPassword: null,
  resetPasswordForEmail: null,
  signUp: null,
  signOut: null,
  consultas: [],
}));

vi.mock("./supabase.js", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: supa.sesion }, error: supa.errorSesion }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: (...args) => supa.signInWithPassword(...args),
      resetPasswordForEmail: (...args) => supa.resetPasswordForEmail(...args),
      signUp: (...args) => supa.signUp(...args),
      signOut: (...args) => supa.signOut(...args),
      updateUser: async () => ({ error: null }),
    },
    from: (tabla) => {
      const cadena = {
        select: (columnas) => {
          supa.consultas.push({ tabla, columnas });
          return cadena;
        },
        eq: () => cadena,
        maybeSingle: async () => ({ data: supa.perfil, error: supa.errorPerfil }),
      };
      return cadena;
    },
  },
}));

const SESION = { access_token: "tok", user: { id: "u1", email: "dt@club.com" } };
const AUTORIZADO = { user_id: "u1", email: "dt@club.com", estado: "autorizado", partido: true, flujo: false, admin: false, confirmado_en: "2026-09-01" };

describe("la puerta de la app", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    supa.sesion = null;
    supa.errorSesion = null;
    supa.perfil = null;
    supa.errorPerfil = null;
    supa.consultas = [];
    supa.signInWithPassword = vi.fn(async () => ({ data: { session: SESION }, error: null }));
    supa.resetPasswordForEmail = vi.fn(async () => ({ error: null }));
    supa.signUp = vi.fn(async () => ({ data: { session: null }, error: null }));
    supa.signOut = vi.fn(async () => ({ error: null }));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })));
    localStorage.clear();
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

  const montar = async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(
        <AccessGate>
          {({ email, permisos, desdeCache }) => (
            <div className="adentro">
              Adentro {email} {JSON.stringify(permisos)} {desdeCache ? "sin señal" : "en línea"}
            </div>
          )}
        </AccessGate>,
      );
    });
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

  test("sin sesión muestra la puerta: la foto atrás, el ícono de la app y el formulario", async () => {
    await montar();

    expect(contenedor.querySelector(".training-access-fondo img").getAttribute("src")).toBe("/portal/partido.webp");
    expect(contenedor.querySelector(".training-access-logo img").getAttribute("src")).toBe("/icono-app-192.png");
    expect(contenedor.querySelector(".training-access-kicker").textContent).toBe("Registro Partido");
    expect(contenedor.querySelector("h1").textContent).toBe("Entrá con tu cuenta");
    expect(contenedor.querySelector('input[type="email"]')).not.toBeNull();
    expect(boton("Entrar")).not.toBeNull();
    expect(boton("Olvidé mi contraseña")).not.toBeNull();
    expect(boton("Crear una cuenta")).not.toBeNull();
    expect(contenedor.querySelector(".training-access-volver")).toBeNull();
    expect(contenedor.querySelector(".adentro")).toBeNull();
  });

  test("con sesión y cuenta autorizada entra directo, con sus permisos", async () => {
    supa.sesion = SESION;
    supa.perfil = AUTORIZADO;
    await montar();

    expect(contenedor.querySelector(".adentro").textContent).toContain("Adentro dt@club.com");
    expect(contenedor.querySelector(".adentro").textContent).toContain('{"partido":true,"flujo":false,"admin":false}');
    expect(contenedor.querySelector(".adentro").textContent).toContain("en línea");
    expect(supa.consultas).toEqual([{ tabla: "perfiles", columnas: "user_id, email, estado, partido, flujo, admin, confirmado_en" }]);
    // Y guarda la copia para la próxima vez sin señal.
    expect(JSON.parse(localStorage.getItem(CLAVE_PERFIL_LOCAL)).user_id).toBe("u1");
  });

  test("el administrador puede todo aunque no tenga módulos marcados", async () => {
    supa.sesion = SESION;
    supa.perfil = { ...AUTORIZADO, partido: false, flujo: false, admin: true };
    await montar();
    expect(contenedor.querySelector(".adentro").textContent).toContain('{"partido":true,"flujo":true,"admin":true}');
  });

  test("entrar con correo y contraseña lee la cuenta y deja pasar", async () => {
    supa.perfil = AUTORIZADO;
    await montar();

    await escribir(contenedor.querySelector('input[type="email"]'), "dt@club.com");
    await escribir(contenedor.querySelector('input[type="password"]'), "secreta123");
    await act(async () => {
      contenedor.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => Promise.resolve());

    expect(supa.signInWithPassword).toHaveBeenCalledWith({ email: "dt@club.com", password: "secreta123" });
    expect(contenedor.querySelector(".adentro").textContent).toContain("Adentro dt@club.com");
  });

  test("una cuenta sin fila o pendiente ve que falta autorizarla, y puede volver a comprobar", async () => {
    supa.sesion = SESION;
    supa.perfil = null;
    await montar();

    expect(contenedor.querySelector("h1").textContent).toBe("Tu cuenta está pendiente");
    expect(contenedor.querySelector(".training-access-card p").textContent).toContain("dt@club.com");
    expect(contenedor.querySelector(".adentro")).toBeNull();

    // La autorizan: Volver a comprobar la deja pasar.
    supa.perfil = AUTORIZADO;
    await act(async () => boton("Volver a comprobar").click());
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".adentro")).not.toBeNull();
  });

  test("bloqueada y autorizada sin módulos no entran", async () => {
    supa.sesion = SESION;
    supa.perfil = { ...AUTORIZADO, estado: "bloqueado" };
    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe("Tu cuenta no tiene acceso");

    await act(async () => raiz.unmount());
    raiz = null;
    supa.perfil = { ...AUTORIZADO, partido: false, flujo: false };
    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe("Tu cuenta no tiene nada habilitado");
  });

  test("Salir cierra la sesión de OpenField y la de Supabase, y borra la copia", async () => {
    supa.sesion = SESION;
    supa.perfil = null;
    await montar();
    localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(AUTORIZADO));

    await act(async () => boton("Salir").click());
    await act(async () => Promise.resolve());

    expect(fetch).toHaveBeenCalledWith("/api/openfield/session", expect.objectContaining({ method: "DELETE" }));
    expect(supa.signOut).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(CLAVE_PERFIL_LOCAL)).toBeNull();
    expect(contenedor.querySelector("h1").textContent).toBe("Entrá con tu cuenta");
  });

  test("sin señal, con la copia guardada, entra igual", async () => {
    supa.sesion = SESION;
    supa.errorPerfil = { message: "Failed to fetch" };
    localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(AUTORIZADO));
    await montar();

    expect(contenedor.querySelector(".adentro").textContent).toContain("sin señal");
  });

  test("sin señal y sin copia, avisa y deja reintentar", async () => {
    supa.sesion = SESION;
    supa.errorPerfil = { message: "Failed to fetch" };
    await montar();

    expect(contenedor.querySelector("h1").textContent).toBe("No se pudo comprobar tu cuenta");
    expect(boton("Reintentar")).not.toBeNull();

    supa.errorPerfil = null;
    supa.perfil = AUTORIZADO;
    await act(async () => boton("Reintentar").click());
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".adentro")).not.toBeNull();
  });

  test("sin señal y con la sesión vencida, vale la última cuenta que entró en este celular", async () => {
    supa.errorSesion = { message: "AuthRetryableFetchError" };
    localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(AUTORIZADO));
    const enLinea = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      await montar();
      expect(contenedor.querySelector(".adentro").textContent).toContain("Adentro dt@club.com");
      expect(contenedor.querySelector(".adentro").textContent).toContain("sin señal");
    } finally {
      if (enLinea) Object.defineProperty(navigator, "onLine", enLinea);
      else delete navigator.onLine;
    }
  });

  test("Olvidé mi contraseña sin correo avisa, y con correo manda el enlace", async () => {
    await montar();

    await act(async () => boton("Olvidé mi contraseña").click());
    expect(contenedor.querySelector(".training-access-message.error").textContent).toBe("Escribí tu correo primero.");

    await escribir(contenedor.querySelector('input[type="email"]'), "dt@club.com");
    await act(async () => boton("Olvidé mi contraseña").click());
    expect(supa.resetPasswordForEmail).toHaveBeenCalledWith("dt@club.com", {
      redirectTo: expect.stringContaining("training_recovery=1"),
    });
    expect(contenedor.querySelector(".training-access-message.ok").textContent).toContain("enlace");
  });

  test("Crear una cuenta avisa que hay que confirmar el correo y esperar la autorización", async () => {
    await montar();
    await escribir(contenedor.querySelector('input[type="email"]'), "nuevo@club.com");
    await escribir(contenedor.querySelector('input[type="password"]'), "secreta123");
    await act(async () => boton("Crear una cuenta").click());

    expect(supa.signUp).toHaveBeenCalledWith({ email: "nuevo@club.com", password: "secreta123" });
    expect(contenedor.querySelector(".training-access-message.ok").textContent).toContain("autorizarla");
  });

  test("volviendo del enlace de recuperación sin sesión, pide uno nuevo y deja volver", async () => {
    window.history.replaceState({}, "", "/?training_recovery=1");
    await montar();

    expect(contenedor.querySelector("h1").textContent).toBe("Elegí una contraseña nueva");
    expect(contenedor.querySelector(".training-access-message.error").textContent).toContain("Pedí uno nuevo");
    expect(boton("Guardar contraseña").disabled).toBe(true);

    await act(async () => boton("Volver").click());
    expect(contenedor.querySelector("h1").textContent).toBe("Entrá con tu cuenta");
    expect(window.location.search).toBe("");
  });
});
