import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AccessGate from "./AccessGate.jsx";
import { CLAVE_PERFIL_LOCAL } from "./domain/perfilesDb.js";
import { fijarIdiomaParaPruebas } from "./idioma/index.js";

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
  updateUser: null,
  consultas: [],
  // Los avisos de sesión de Supabase (onAuthStateChange) que la puerta escucha.
  cambios: [],
  // Lo que trajo la URL al abrirse (enlace del correo), cambiable por prueba.
  enlace: { tipo: "", error: "", descripcion: "" },
  // Con barras pero sin datos: el pedido sale y no contesta nunca.
  colgarSesion: false,
  colgarPerfil: false,
}));

const nunca = () => new Promise(() => {});

vi.mock("./supabase.js", () => ({
  get ENLACE_DE_ACCESO() {
    return supa.enlace;
  },
  supabase: {
    auth: {
      getSession: () => (supa.colgarSesion ? nunca() : Promise.resolve({ data: { session: supa.sesion }, error: supa.errorSesion })),
      onAuthStateChange: (cb) => {
        supa.cambios.push(cb);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signInWithPassword: (...args) => supa.signInWithPassword(...args),
      resetPasswordForEmail: (...args) => supa.resetPasswordForEmail(...args),
      signUp: (...args) => supa.signUp(...args),
      signOut: (...args) => supa.signOut(...args),
      updateUser: (...args) => supa.updateUser(...args),
    },
    from: (tabla) => {
      const cadena = {
        select: (columnas) => {
          supa.consultas.push({ tabla, columnas });
          return cadena;
        },
        eq: () => cadena,
        maybeSingle: () => (supa.colgarPerfil ? nunca() : Promise.resolve({ data: supa.perfil, error: supa.errorPerfil })),
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
    supa.cambios = [];
    supa.colgarSesion = false;
    supa.colgarPerfil = false;
    supa.signInWithPassword = vi.fn(async () => ({ data: { session: SESION }, error: null }));
    supa.resetPasswordForEmail = vi.fn(async () => ({ error: null }));
    supa.signUp = vi.fn(async () => ({ data: { session: null }, error: null }));
    // Como Supabase de verdad: cerrar la sesión la deja en nada.
    supa.signOut = vi.fn(async () => {
      supa.sesion = null;
      return { error: null };
    });
    supa.cambios = [];
    supa.updateUser = vi.fn(async () => ({ error: null }));
    supa.enlace = { tipo: "", error: "", descripcion: "" };
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
    vi.useRealTimers();
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
    expect(contenedor.querySelector(".adentro").textContent).toContain('{"partido":true,"flujo":false,"lesiones":false,"evaluaciones":false,"datos":true,"admin":false}');
    expect(contenedor.querySelector(".adentro").textContent).toContain("en línea");
    expect(supa.consultas).toEqual([{ tabla: "perfiles", columnas: "*" }]);
    // Y guarda la copia para la próxima vez sin señal.
    expect(JSON.parse(localStorage.getItem(CLAVE_PERFIL_LOCAL)).user_id).toBe("u1");
  });

  test("el administrador puede todo aunque no tenga módulos marcados", async () => {
    supa.sesion = SESION;
    supa.perfil = { ...AUTORIZADO, partido: false, flujo: false, admin: true };
    await montar();
    expect(contenedor.querySelector(".adentro").textContent).toContain('{"partido":true,"flujo":true,"lesiones":true,"evaluaciones":true,"datos":true,"admin":true}');
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

    expect(contenedor.querySelector("h1").textContent).toBe("Tu cuenta está pendiente de autorización");
    expect(contenedor.querySelector(".training-access-card p").textContent).toContain("dt@club.com");
    expect(contenedor.querySelector(".adentro")).toBeNull();

    // La autorizan: Volver a comprobar la deja pasar.
    supa.perfil = AUTORIZADO;
    await act(async () => boton("Volver a comprobar").click());
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".adentro")).not.toBeNull();
  });

  test("bloqueada no entra; autorizada entra aunque la cuenta no tenga módulos (los da cada club)", async () => {
    supa.sesion = SESION;
    supa.perfil = { ...AUTORIZADO, estado: "bloqueado" };
    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe("Tu cuenta no tiene acceso");

    await act(async () => raiz.unmount());
    raiz = null;
    supa.perfil = { ...AUTORIZADO, partido: false, flujo: false };
    await montar();
    expect(contenedor.querySelector(".adentro").textContent).toContain("Adentro dt@club.com");
  });

  test("Salir cierra la sesión de OpenField y la de Supabase, y borra la copia", async () => {
    supa.sesion = SESION;
    supa.perfil = null;
    await montar();
    localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(AUTORIZADO));
    // Copias de clubes que quedaron en el celular, y trabajo sin subir.
    localStorage.setItem("equipo_elegido", JSON.stringify({ id: "eq-1", nombre: "Club" }));
    localStorage.setItem("backup_registros_partidos:eq-1", "[]");
    localStorage.setItem("plantel_jugadores:eq-1", "[]");
    localStorage.setItem("registros_sin_sincronizar:eq-1", '[{"rival":"X"}]');

    await act(async () => boton("Salir").click());
    await act(async () => Promise.resolve());

    expect(fetch).toHaveBeenCalledWith("/api/openfield/session", expect.objectContaining({ method: "DELETE" }));
    expect(supa.signOut).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(CLAVE_PERFIL_LOCAL)).toBeNull();
    // Se van el club elegido y las copias de los clubes; lo que no se subió queda.
    expect(localStorage.getItem("equipo_elegido")).toBeNull();
    expect(localStorage.getItem("backup_registros_partidos:eq-1")).toBeNull();
    expect(localStorage.getItem("plantel_jugadores:eq-1")).toBeNull();
    expect(localStorage.getItem("registros_sin_sincronizar:eq-1")).not.toBeNull();
    expect(contenedor.querySelector("h1").textContent).toBe("Entrá con tu cuenta");
  });

  test("sin señal, con la copia guardada, entra igual", async () => {
    supa.sesion = SESION;
    supa.errorPerfil = { message: "Failed to fetch" };
    localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(AUTORIZADO));
    await montar();

    expect(contenedor.querySelector(".adentro").textContent).toContain("sin señal");
  });

  test("si la base no deja leer la cuenta, lo dice en el idioma de la app (no el error en inglés)", async () => {
    supa.sesion = SESION;
    supa.errorPerfil = { message: "permission denied for table perfiles" };
    fijarIdiomaParaPruebas("pt-BR");
    try {
      await montar();
      expect(contenedor.querySelector("h1").textContent).toBe("Não conseguimos verificar sua conta");
      expect(contenedor.querySelector(".training-access-card p").textContent).toBe("Não foi possível verificar sua conta. Tente de novo.");
      expect(contenedor.textContent).not.toContain("permission denied");
    } finally {
      fijarIdiomaParaPruebas("es-AR");
    }
  });

  test("sin señal y sin copia, avisa y deja reintentar", async () => {
    supa.sesion = SESION;
    supa.errorPerfil = { message: "Failed to fetch" };
    await montar();

    expect(contenedor.querySelector("h1").textContent).toBe("No pudimos comprobar tu cuenta");
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
    expect(contenedor.querySelector(".training-access-message.error").textContent).toBe("Primero escribí tu correo, así te mandamos el enlace.");

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
    expect(supa.signOut).not.toHaveBeenCalled();
  });

  test("el enlace de recuperación se reconoce por su marca aunque Supabase pierda el parámetro, y guardar la contraseña entra", async () => {
    supa.enlace = { tipo: "recovery", error: "", descripcion: "" };
    supa.sesion = SESION;
    supa.perfil = AUTORIZADO;
    await montar();

    expect(contenedor.querySelector("h1").textContent).toBe("Elegí una contraseña nueva");
    expect(boton("Guardar contraseña").disabled).toBe(false);
    expect(contenedor.querySelector(".adentro")).toBeNull();

    const [nueva, repetida] = contenedor.querySelectorAll('input[type="password"]');
    await escribir(nueva, "nuevaclave123");
    await escribir(repetida, "nuevaclave123");
    await act(async () => {
      contenedor.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => Promise.resolve());

    expect(supa.updateUser).toHaveBeenCalledWith({ password: "nuevaclave123" });
    expect(contenedor.querySelector(".adentro").textContent).toContain("Adentro dt@club.com");
  });

  test("si la contraseña nueva es igual a la anterior, Supabase lo objeta y se avisa en castellano", async () => {
    supa.enlace = { tipo: "recovery", error: "", descripcion: "" };
    supa.sesion = SESION;
    supa.updateUser = vi.fn(async () => ({
      error: { code: "same_password", message: "New password should be different from the old password." },
    }));
    await montar();

    const [nueva, repetida] = contenedor.querySelectorAll('input[type="password"]');
    await escribir(nueva, "lamismadesiempre1");
    await escribir(repetida, "lamismadesiempre1");
    await act(async () => {
      contenedor.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => Promise.resolve());

    expect(contenedor.querySelector(".training-access-message.error").textContent).toBe(
      "La contraseña nueva tiene que ser distinta de la anterior.",
    );
    expect(contenedor.querySelector(".adentro")).toBeNull();
    expect(contenedor.querySelector(".training-access-card p").textContent).toBe(
      "De ahora en más vas a entrar con esta contraseña.",
    );
  });

  test("si las contraseñas no coinciden, no guarda y avisa", async () => {
    supa.enlace = { tipo: "recovery", error: "", descripcion: "" };
    supa.sesion = SESION;
    await montar();

    const [nueva, repetida] = contenedor.querySelectorAll('input[type="password"]');
    await escribir(nueva, "nuevaclave123");
    await escribir(repetida, "otraclave123");
    await act(async () => {
      contenedor.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(supa.updateUser).not.toHaveBeenCalled();
    expect(contenedor.querySelector(".training-access-message.error").textContent).toBe("Las contraseñas no coinciden.");
  });

  test("Volver desde la recuperación descarta la sesión que abrió el enlace", async () => {
    supa.enlace = { tipo: "recovery", error: "", descripcion: "" };
    supa.sesion = SESION;
    await montar();

    await act(async () => boton("Volver").click());
    await act(async () => Promise.resolve());
    expect(supa.signOut).toHaveBeenCalledTimes(1);
    expect(contenedor.querySelector("h1").textContent).toBe("Entrá con tu cuenta");
  });

  test("un enlace vencido lo dice claro en la puerta", async () => {
    supa.enlace = { tipo: "", error: "otp_expired", descripcion: "Email link is invalid or has expired" };
    await montar();

    expect(contenedor.querySelector("h1").textContent).toBe("Entrá con tu cuenta");
    expect(contenedor.querySelector(".training-access-message.error").textContent).toBe(
      "El enlace del correo venció o ya se usó. Pedí uno nuevo.",
    );
  });

  const avisar = async (evento, session) => {
    await act(async () => {
      supa.cambios.forEach((cb) => cb(evento, session));
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

  test("sin señal, el aviso inicial vacío de Supabase no echa a quien entró con la copia", async () => {
    supa.errorSesion = { name: "AuthRetryableFetchError", message: "Failed to fetch" };
    localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(AUTORIZADO));
    await conSenal(false, async () => {
      await montar();
      expect(contenedor.querySelector(".adentro").textContent).toContain("sin señal");

      // Supabase manda este aviso después de rendirse con la renovación.
      await avisar("INITIAL_SESSION", null);
      expect(contenedor.querySelector(".adentro").textContent).toContain("Adentro dt@club.com");
    });
  });

  const pasar = async (milisegundos) => {
    await act(async () => {
      vi.advanceTimersByTime(milisegundos);
    });
    await act(async () => Promise.resolve());
  };

  test("con barras pero sin datos y Supabase sin contestar, ofrece entrar con la copia y al rato entra sola", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    supa.colgarSesion = true;
    localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(AUTORIZADO));
    await conSenal(true, async () => {
      await montar();
      expect(contenedor.querySelector("h1").textContent).toBe("Un momento…");
      expect(boton("Entrar sin conexión")).toBeUndefined();

      await pasar(3000);
      expect(contenedor.textContent).toContain("podés entrar con la cuenta guardada en este celular");
      expect(boton("Entrar sin conexión")).toBeTruthy();

      await pasar(4000);
      expect(contenedor.querySelector(".adentro").textContent).toContain("Adentro dt@club.com");
      expect(contenedor.querySelector(".adentro").textContent).toContain("sin señal");
    });
  });

  test("Entrar sin conexión entra enseguida con la cuenta guardada", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    supa.colgarSesion = true;
    localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(AUTORIZADO));
    await conSenal(true, async () => {
      await montar();
      await pasar(3000);
      await act(async () => boton("Entrar sin conexión").click());
      expect(contenedor.querySelector(".adentro").textContent).toContain("sin señal");
    });
  });

  test("la sesión contesta pero la cuenta no: con copia entra con ella, sin copia deja reintentar", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    supa.sesion = SESION;
    supa.colgarPerfil = true;
    await conSenal(true, async () => {
      await montar();
      await pasar(3000);
      // Sin cuenta guardada no hay con qué entrar.
      expect(boton("Entrar sin conexión")).toBeUndefined();
      expect(contenedor.textContent).toContain("Está tardando más de lo normal");
      await pasar(5000);
      expect(contenedor.querySelector("h1").textContent).toBe("No pudimos comprobar tu cuenta");
      expect(boton("Reintentar")).toBeTruthy();
    });

    await act(async () => raiz.unmount());
    raiz = null;
    localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(AUTORIZADO));
    await conSenal(true, async () => {
      await montar();
      await pasar(7000);
      expect(contenedor.querySelector(".adentro").textContent).toContain("sin señal");
      // Si la base contesta después, vale lo que contestó.
      supa.colgarPerfil = false;
      supa.perfil = { ...AUTORIZADO, flujo: true };
      await act(async () => window.dispatchEvent(new Event("online")));
      await act(async () => Promise.resolve());
      expect(contenedor.querySelector(".adentro").textContent).toContain("en línea");
      expect(contenedor.querySelector(".adentro").textContent).toContain('"flujo":true');
    });
  });

  test("con barras pero sin datos (el celular se cree conectado), la copia también vale", async () => {
    supa.errorSesion = { name: "AuthRetryableFetchError", message: "Failed to fetch" };
    localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(AUTORIZADO));
    await conSenal(true, async () => {
      await montar();
      expect(contenedor.querySelector(".adentro").textContent).toContain("sin señal");
    });
  });

  test("sin señal y sin copia, la puerta lo dice en castellano", async () => {
    supa.errorSesion = { name: "AuthRetryableFetchError", message: "Failed to fetch" };
    await montar();

    expect(contenedor.querySelector("h1").textContent).toBe("Entrá con tu cuenta");
    expect(contenedor.querySelector(".training-access-message.error").textContent).toBe(
      "No hay conexión. Fijate la señal y probá de nuevo.",
    );
  });

  test("al volver la señal, la cuenta que entró con la copia se vuelve a comprobar", async () => {
    supa.errorSesion = { name: "AuthRetryableFetchError", message: "Failed to fetch" };
    localStorage.setItem(CLAVE_PERFIL_LOCAL, JSON.stringify(AUTORIZADO));
    await conSenal(false, async () => {
      await montar();
      expect(contenedor.querySelector(".adentro").textContent).toContain("sin señal");
      expect(supa.consultas).toHaveLength(0);
    });

    supa.errorSesion = null;
    supa.sesion = SESION;
    supa.perfil = { ...AUTORIZADO, flujo: true };
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());

    expect(supa.consultas).toHaveLength(1);
    expect(contenedor.querySelector(".adentro").textContent).toContain("en línea");
    expect(contenedor.querySelector(".adentro").textContent).toContain('"flujo":true');
  });

  test("después de cambiar la contraseña, los avisos de sesión no vuelven a pedirla", async () => {
    supa.enlace = { tipo: "recovery", error: "", descripcion: "" };
    supa.sesion = SESION;
    supa.perfil = AUTORIZADO;
    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe("Elegí una contraseña nueva");

    const [nueva, repetida] = contenedor.querySelectorAll('input[type="password"]');
    await escribir(nueva, "nuevaclave123");
    await escribir(repetida, "nuevaclave123");
    await act(async () => {
      contenedor.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".adentro")).not.toBeNull();

    // Al volver a la pestaña o al renovarse el token, Supabase avisa así.
    await avisar("SIGNED_IN", SESION);
    expect(contenedor.querySelector(".adentro")).not.toBeNull();
    await avisar("TOKEN_REFRESHED", SESION);
    expect(contenedor.querySelector(".adentro")).not.toBeNull();
  });

  test("un enlace vencido con otra sesión abierta no deja cambiarle la contraseña a esa cuenta", async () => {
    window.history.replaceState({}, "", "/?training_recovery=1");
    supa.enlace = { tipo: "", error: "otp_expired", descripcion: "Email link is invalid or has expired" };
    supa.sesion = SESION;
    supa.perfil = AUTORIZADO;
    await montar();

    expect(contenedor.querySelector("h1").textContent).toBe("Elegí una contraseña nueva");
    expect(boton("Guardar contraseña").disabled).toBe(true);
    expect(contenedor.querySelector(".training-access-message.error").textContent).toContain("venció");

    // Volver no cierra la sesión que ya había: sigue adentro con ella.
    await act(async () => boton("Volver").click());
    await act(async () => Promise.resolve());
    expect(supa.signOut).not.toHaveBeenCalled();
    expect(contenedor.querySelector(".adentro").textContent).toContain("Adentro dt@club.com");
  });

  test("Salir cierra solo en este celular y, si Supabase no pudo, borra la sesión guardada igual", async () => {
    supa.sesion = SESION;
    // Sin perfil legible queda la pantalla de "no pudimos comprobar", que
    // tiene el botón Salir a mano.
    supa.perfil = null;
    await montar();
    localStorage.setItem("sb-proyecto-auth-token", JSON.stringify({ access_token: "tok" }));
    // Sin señal Supabase no llega a cerrar nada y contesta con error.
    supa.signOut = vi.fn(async () => ({ error: { name: "AuthRetryableFetchError" } }));

    await act(async () => boton("Salir").click());
    await act(async () => Promise.resolve());

    expect(supa.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(localStorage.getItem("sb-proyecto-auth-token")).toBeNull();
    expect(contenedor.querySelector("h1").textContent).toBe("Entrá con tu cuenta");

    // Un token renovado tarde, con nadie adentro, no abre nada.
    await avisar("TOKEN_REFRESHED", SESION);
    expect(contenedor.querySelector("h1").textContent).toBe("Entrá con tu cuenta");
  });

  test("entrar lee la cuenta una sola vez aunque Supabase avise que entró", async () => {
    supa.perfil = AUTORIZADO;
    supa.signInWithPassword = vi.fn(async () => {
      supa.cambios.forEach((cb) => cb("SIGNED_IN", SESION));
      return { data: { session: SESION }, error: null };
    });
    await montar();

    await escribir(contenedor.querySelector('input[type="email"]'), "dt@club.com");
    await escribir(contenedor.querySelector('input[type="password"]'), "clave1234");
    await act(async () => {
      contenedor.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => Promise.resolve());

    expect(contenedor.querySelector(".adentro")).not.toBeNull();
    expect(supa.consultas).toHaveLength(1);
  });

  test("un enlace de recuperación vencido, con el parámetro de la app, lo dice en la pantalla de contraseña nueva", async () => {
    window.history.replaceState({}, "", "/?training_recovery=1");
    supa.enlace = { tipo: "", error: "otp_expired", descripcion: "Email link is invalid or has expired" };
    await montar();

    expect(contenedor.querySelector("h1").textContent).toBe("Elegí una contraseña nueva");
    expect(contenedor.querySelector(".training-access-message.error").textContent).toBe(
      "El enlace del correo venció o ya se usó. Pedí uno nuevo.",
    );
    expect(boton("Guardar contraseña").disabled).toBe(true);
  });
});
