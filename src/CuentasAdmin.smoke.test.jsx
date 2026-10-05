import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// La base de mentira: clubes, gente de cada club, invitaciones, historia y
// las cuentas de la app. Cada prueba la arma a su gusto.
const datos = vi.hoisted(() => ({
  clubes: [],
  miembros: {},
  invitaciones: {},
  historia: [],
  perfiles: [],
  membresias: [],
  llamadas: [],
  errorCambio: null,
  errorLeer: null,
  usada: false,
  // Lecturas lentas: la de un club (o la historia) vuelve cuando se abre su compuerta.
  lenta: {},
}));

// Las invitaciones de las pruebas vencen después de hoy (salvo las vencidas a propósito).
const DIA_MS = 86400000;
const EN_UNA_SEMANA = new Date(Date.now() + 7 * DIA_MS).toISOString();
const EN_DOS_SEMANAS = new Date(Date.now() + 14 * DIA_MS).toISOString();

vi.mock("./domain/equipo.js", () => ({
  cargarEquipos: async () => ({ equipos: datos.clubes }),
}));

vi.mock("./domain/membresiasDb.js", async () => {
  const real = await vi.importActual("./domain/membresiasDb.js");
  const cambiar = async (userId, equipoId, cambios) => {
    datos.llamadas.push({ que: "cambiar", userId, equipoId, cambios });
    // Una conexión lenta: el cambio vuelve cuando se abre la compuerta.
    if (datos.compuerta) await datos.compuerta;
    if (datos.errorCambio) throw new Error(datos.errorCambio);
    const fila = { ...datos.miembros[equipoId].find((m) => m.user_id === userId), ...cambios };
    datos.miembros[equipoId] = datos.miembros[equipoId].map((m) => (m.user_id === userId ? fila : m));
    return fila;
  };
  return {
    ...real,
    listarMiembros: async (equipoId) => {
      const lista = real.ordenarMiembros(datos.miembros[equipoId] || []);
      if (datos.lenta[equipoId]) await datos.lenta[equipoId];
      if (datos.errorLeer) throw new Error(datos.errorLeer);
      return lista;
    },
    listarInvitaciones: async (equipoId) => datos.invitaciones[equipoId] || [],
    listarMembresias: async () => datos.membresias,
    cambiarRol: async (userId, equipoId, rol) => cambiar(userId, equipoId, { rol }),
    cambiarModulo: async (userId, equipoId, modulo, valor) => cambiar(userId, equipoId, { [modulo]: valor }),
    darDeBaja: async (userId, equipoId, hasta) => cambiar(userId, equipoId, { hasta }),
    reincorporar: async (userId, equipoId) => cambiar(userId, equipoId, { hasta: null, desde: "2026-10-02" }),
    historialDeMiembro: async (equipoId, userId) => {
      datos.llamadas.push({ que: "historia", equipoId, userId });
      const historia = datos.historia;
      if (datos.lenta.historia) await datos.lenta.historia;
      return historia;
    },
    invitar: async (equipoId, invitacion) => {
      datos.llamadas.push({ que: "invitar", equipoId, invitacion });
      if (datos.errorCambio) throw new Error(datos.errorCambio);
      if (!datos.usada) {
        datos.invitaciones[equipoId] = [
          { id: `i-${invitacion.email}`, ...invitacion, vence_en: EN_DOS_SEMANAS },
          ...(datos.invitaciones[equipoId] || []),
        ];
      }
      return { usada: datos.usada };
    },
    cancelarInvitacion: async (id) => {
      datos.llamadas.push({ que: "cancelar", id });
      return true;
    },
  };
});

vi.mock("./domain/perfilesDb.js", async () => {
  const real = await vi.importActual("./domain/perfilesDb.js");
  return {
    ...real,
    listarPerfiles: async () => datos.perfiles,
    decidirPerfil: async (userId, cambios) => {
      datos.llamadas.push({ que: "decidir", userId, cambios });
      const fila = { ...datos.perfiles.find((p) => p.user_id === userId), ...cambios };
      datos.perfiles = datos.perfiles.map((p) => (p.user_id === userId ? fila : p));
      return fila;
    },
  };
});

const { default: CuentasAdmin, textoDeMovimiento } = await import("./CuentasAdmin.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");
const { hoyISO } = await import("./idioma/formatos.js");

const UNO = { id: "c1", nombre: "Club Uno", rol: "admin", hasta: null, miembro: true };
const DOS = { id: "c2", nombre: "Club Dos", rol: "admin", hasta: null, miembro: true };
const miembro = (extra) => ({
  equipo_id: "c1",
  estado: "autorizado",
  confirmado_en: "2026-09-01",
  desde: "2026-09-01",
  hasta: null,
  rol: "staff",
  partido: true,
  flujo: true,
  lesiones: false,
  ...extra,
});

describe("Cuentas", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    datos.clubes = [UNO];
    datos.miembros = {
      c1: [
        miembro({ user_id: "yo", email: "ana@uno.com", rol: "admin", lesiones: true }),
        miembro({ user_id: "beto", email: "beto@uno.com" }),
        miembro({ user_id: "dario", email: "dario@uno.com", hasta: "2026-03-31" }),
        miembro({ user_id: "gaby", email: "gaby@uno.com", estado: "bloqueado" }),
      ],
      c2: [miembro({ user_id: "eva", equipo_id: "c2", email: "eva@dos.com", rol: "admin" })],
    };
    datos.invitaciones = { c1: [{ id: "i1", email: "espera@uno.com", rol: "staff", partido: true, flujo: false, lesiones: false, vence_en: EN_UNA_SEMANA }] };
    datos.historia = [];
    datos.perfiles = [];
    datos.membresias = [];
    datos.llamadas = [];
    datos.errorCambio = null;
    datos.errorLeer = null;
    datos.usada = false;
    datos.compuerta = null;
    datos.lenta = {};
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    delete navigator.clipboard;
  });

  const montar = async (props = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<CuentasAdmin miUserId="yo" club={UNO} onVolver={() => {}} {...props} />);
    });
    await act(async () => Promise.resolve());
  };

  const texto = () => contenedor.textContent;
  const fila = (correo) => [...contenedor.querySelectorAll(".cuenta-fila")].find((li) => li.querySelector(".cuenta-correo").textContent === correo);
  const boton = (dentro, etiqueta) => [...dentro.querySelectorAll("button")].find((b) => b.textContent.trim() === etiqueta);
  const chip = (dentro, etiqueta) => [...dentro.querySelectorAll(".cuenta-chip")].find((b) => b.textContent.trim() === etiqueta);
  const tocar = async (elemento) => {
    expect(elemento, "no se encontró el botón").toBeTruthy();
    await act(async () => elemento.click());
    await act(async () => Promise.resolve());
  };
  const escribir = async (input, valor) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, valor);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const grupos = () => [...contenedor.querySelectorAll(".cuentas-grupo h2")].map((h) => h.textContent.replace(/\s+/g, " ").trim());

  test("el admin del club ve a su gente: activos, los que se fueron, invitaciones y etiquetas", async () => {
    await montar();
    expect(contenedor.querySelector(".cuentas-pestanas")).toBeNull();
    expect(contenedor.querySelector(".cuentas-club-elegido strong").textContent).toBe("Club Uno");
    expect(grupos()).toEqual(["Invitar a alguien", "Invitaciones abiertas 1", "En el club 3", "Se fueron 1"]);

    const ana = fila("ana@uno.com");
    expect([...ana.querySelectorAll(".cuenta-etiqueta")].map((e) => e.textContent)).toEqual(["Tu cuenta", "Administrador del club"]);
    expect(chip(ana, "Lesiones").getAttribute("aria-pressed")).toBe("true");
    expect(chip(ana, "Evaluaciones").getAttribute("aria-pressed")).toBe("false");
    expect(fila("gaby@uno.com").querySelector(".cuenta-etiqueta.alerta").textContent).toBe("Cuenta bloqueada");

    const dario = fila("dario@uno.com");
    expect(dario.classList.contains("se-fue")).toBe(true);
    expect(dario.querySelector(".cuenta-meta").textContent).toBe("Hasta el 31/03/2026 · solo lectura");
    expect(boton(dario, "Reincorporar")).toBeTruthy();
    // A quien se fue no se le cambia el rol, pero sí qué puede seguir mirando.
    expect(chip(dario, "Administrador del club")).toBeUndefined();
    expect(chip(dario, "Partido")).toBeTruthy();

    expect(fila("espera@uno.com").querySelector(".cuenta-meta").textContent).toContain("Partido");
  });

  test("invitar: correo inválido, alguien que ya está, una invitación nueva y una cuenta que entra en el acto", async () => {
    await montar();
    const correo = contenedor.querySelector(".cuentas-invitar input");
    const invitarBoton = boton(contenedor.querySelector(".cuentas-invitar"), "Invitar");

    await escribir(correo, "cualquiera");
    await tocar(invitarBoton);
    expect(texto()).toContain("Escribí un correo válido.");

    await escribir(correo, "BETO@uno.com");
    await tocar(invitarBoton);
    expect(texto()).toContain("Esa cuenta ya está en el club.");
    expect(datos.llamadas).toEqual([]);

    await escribir(correo, "nuevo@uno.com");
    await tocar(chip(contenedor.querySelector(".cuentas-invitar"), "Lesiones"));
    await tocar(chip(contenedor.querySelector(".cuentas-invitar"), "Evaluaciones"));
    await tocar(chip(contenedor.querySelector(".cuentas-invitar"), "Flujo diario"));
    await tocar(invitarBoton);
    expect(datos.llamadas.at(-1)).toEqual({
      que: "invitar",
      equipoId: "c1",
      invitacion: { email: "nuevo@uno.com", rol: "staff", partido: true, flujo: false, lesiones: true, evaluaciones: true },
    });
    expect(texto()).toContain("Invitación lista. Avisale a nuevo@uno.com que se registre con ese correo.");
    expect(grupos()).toContain("Invitaciones abiertas 2");

    datos.usada = true;
    datos.miembros.c1.push(miembro({ user_id: "fede", email: "fede@libre.com" }));
    await escribir(correo, "fede@libre.com");
    await tocar(invitarBoton);
    expect(texto()).toContain("fede@libre.com ya tenía cuenta: entró al club.");
    expect(fila("fede@libre.com")).toBeTruthy();
  });

  test("rol y módulos van a la base al toque; el último admin no se puede sacar", async () => {
    await montar();
    await tocar(chip(fila("beto@uno.com"), "Lesiones"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "cambiar", userId: "beto", equipoId: "c1", cambios: { lesiones: true } });
    expect(chip(fila("beto@uno.com"), "Lesiones").getAttribute("aria-pressed")).toBe("true");
    // Evaluaciones es un permiso aparte.
    await tocar(chip(fila("beto@uno.com"), "Evaluaciones"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "cambiar", userId: "beto", equipoId: "c1", cambios: { evaluaciones: true } });
    expect(chip(fila("beto@uno.com"), "Evaluaciones").getAttribute("aria-pressed")).toBe("true");

    await tocar(chip(fila("beto@uno.com"), "Administrador del club"));
    expect(datos.llamadas.at(-1).cambios).toEqual({ rol: "admin" });

    datos.errorCambio = "cuentas.errorUltimoAdmin";
    await tocar(chip(fila("ana@uno.com"), "Administrador del club"));
    expect(texto()).toContain("Es el último administrador del club: nombrá a otro antes.");
    expect(chip(fila("ana@uno.com"), "Administrador del club").getAttribute("aria-pressed")).toBe("true");
  });

  test("dar de baja pide el último día; quien se fue pasa abajo y se lo reincorpora", async () => {
    await montar();
    await tocar(boton(fila("beto@uno.com"), "Dar de baja"));
    expect(texto()).toContain("¿Cuál fue su último día en el club?");
    expect(texto()).toContain("beto@uno.com va a seguir viendo lo cargado en Club Uno hasta ese día");
    const fecha = contenedor.querySelector('.cuentas-hoja input[type="date"]');
    expect(fecha.value).toBe(hoyISO());
    expect(fecha.getAttribute("max")).toBe(hoyISO());
    await escribir(fecha, "2026-09-25");
    await tocar(boton(contenedor, "Sí, dar de baja"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "cambiar", userId: "beto", equipoId: "c1", cambios: { hasta: "2026-09-25" } });
    expect(texto()).toContain("beto@uno.com dejó el club. Ve lo cargado hasta su último día.");
    expect(grupos()).toContain("Se fueron 2");
    expect(fila("beto@uno.com").querySelector(".cuenta-meta").textContent).toBe("Hasta el 25/09/2026 · solo lectura");

    await tocar(boton(fila("beto@uno.com"), "Reincorporar"));
    expect(datos.llamadas.at(-1).cambios).toEqual({ hasta: null, desde: "2026-10-02" });
    expect(texto()).toContain("beto@uno.com volvió al club.");
    expect(grupos()).toContain("Se fueron 1");
  });

  test("la historia de cada uno, en criollo y con quién lo hizo", async () => {
    datos.historia = [
      { id: 3, accion: "reincorporacion", detalle: {}, quien_email: "ana@uno.com", cuando: "2026-10-01T15:00:00Z" },
      { id: 2, accion: "baja", detalle: { hasta: "2026-03-31" }, quien_email: "ana@uno.com", cuando: "2026-04-01T15:00:00Z" },
      { id: 1, accion: "alta", detalle: { rol: "staff", partido: true, flujo: true, lesiones: false }, quien_email: "", cuando: "2026-01-01T15:00:00Z" },
    ];
    await montar();
    await tocar(boton(fila("dario@uno.com"), "Historia"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "historia", equipoId: "c1", userId: "dario" });
    const lineas = [...contenedor.querySelectorAll(".cuentas-historia li b")].map((b) => b.textContent);
    expect(lineas).toEqual(["Volvió al club", "Dejó el club: último día 31/03/2026", "Entró al club (Staff; Partido, Flujo diario)"]);
    expect(contenedor.querySelector(".cuentas-historia li span").textContent).toContain("por ana@uno.com");
    expect(textoDeMovimiento({ accion: "modulos", detalle: { partido: false, flujo: false, lesiones: false } })).toBe("Módulos: ningún módulo");
  });

  test("la invitación se copia como mensaje y se cancela", async () => {
    const escrito = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => escrito.push(t) } });
    await montar();
    await tocar(boton(fila("espera@uno.com"), "Copiar mensaje"));
    expect(escrito[0]).toContain("Te invité a Club Uno");
    expect(escrito[0]).toContain("espera@uno.com");
    expect(texto()).toContain("Mensaje copiado.");

    await tocar(boton(fila("espera@uno.com"), "Cancelar"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "cancelar", id: "i1" });
    expect(fila("espera@uno.com")).toBeUndefined();
    expect(texto()).toContain("Invitación cancelada.");
  });

  test("una invitación vencida va aparte, sin el mensaje para copiar, y se puede cancelar", async () => {
    datos.invitaciones.c1.push({ id: "i-vieja", email: "tarde@uno.com", rol: "staff", partido: true, flujo: false, lesiones: false, vence_en: new Date(Date.now() - DIA_MS).toISOString() });
    await montar();
    expect(grupos()).toEqual(expect.arrayContaining(["Invitaciones abiertas 1", "Invitaciones vencidas 1"]));
    const vencida = fila("tarde@uno.com");
    expect(vencida.closest(".cuentas-grupo").querySelector("h2").textContent).toContain("Invitaciones vencidas");
    expect(vencida.textContent).toContain("Vencida");
    expect(vencida.textContent).toContain("Venció el");
    expect(boton(vencida, "Copiar mensaje")).toBeUndefined();
    expect(boton(fila("espera@uno.com"), "Copiar mensaje")).toBeTruthy();
    await tocar(boton(vencida, "Cancelar"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "cancelar", id: "i-vieja" });
    expect(grupos().some((grupo) => grupo.startsWith("Invitaciones vencidas"))).toBe(false);
  });

  test("un cambio que vuelve después de elegir otro club no toca la lista de ese club", async () => {
    datos.clubes = [UNO, DOS];
    datos.miembros.c2.push(miembro({ user_id: "beto", equipo_id: "c2", email: "beto@uno.com" }));
    await montar();
    let abrir;
    datos.compuerta = new Promise((resolver) => {
      abrir = resolver;
    });
    await tocar(chip(fila("beto@uno.com"), "Lesiones"));
    await tocar(boton(contenedor, "Cambiar"));
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Club Dos"));
    await act(async () => abrir());
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".cuentas-club-elegido strong").textContent).toBe("Club Dos");
    // En Club Dos, Beto sigue sin Lesiones: el cambio fue en Club Uno.
    expect(chip(fila("beto@uno.com"), "Lesiones").getAttribute("aria-pressed")).toBe("false");
  });

  test("elegir otro club rápido: lo que vuelve tarde del anterior no se mezcla", async () => {
    datos.clubes = [UNO, DOS];
    datos.invitaciones.c2 = [{ id: "i2", email: "otra@dos.com", rol: "staff", partido: true, flujo: false, lesiones: false, vence_en: EN_UNA_SEMANA }];
    await montar();
    let abrirDos;
    datos.lenta.c2 = new Promise((resolver) => {
      abrirDos = resolver;
    });
    const elegir = async (nombre) => {
      await tocar(boton(contenedor, "Cambiar"));
      await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === nombre));
    };
    await elegir("Club Dos");
    // Mientras se lee Club Dos no queda a la vista la gente de Club Uno.
    expect(fila("beto@uno.com")).toBeUndefined();
    await elegir("Club Uno");
    expect(fila("beto@uno.com")).toBeTruthy();
    // Club Dos contesta tarde: no pisa a Club Uno.
    await act(async () => abrirDos());
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".cuentas-club-elegido strong").textContent).toBe("Club Uno");
    expect(fila("beto@uno.com")).toBeTruthy();
    expect(fila("espera@uno.com")).toBeTruthy();
    expect(fila("eva@dos.com")).toBeUndefined();
    expect(fila("otra@dos.com")).toBeUndefined();
  });

  test("la historia que vuelve después de elegir otro club no se muestra", async () => {
    datos.clubes = [UNO, DOS];
    datos.historia = [{ id: 1, accion: "alta", detalle: { rol: "staff", partido: true, flujo: false, lesiones: false }, quien_email: "", cuando: "2026-01-01T15:00:00Z" }];
    await montar();
    let abrir;
    datos.lenta.historia = new Promise((resolver) => {
      abrir = resolver;
    });
    await tocar(boton(fila("dario@uno.com"), "Historia"));
    await tocar(boton(contenedor, "Cambiar"));
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Club Dos"));
    await act(async () => abrir());
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".cuentas-historia")).toBeNull();
    expect(texto()).not.toContain("dario@uno.com");
  });

  test("con varios clubes se elige cuál administrar", async () => {
    datos.clubes = [UNO, DOS, { id: "c3", nombre: "Club Tres", rol: "staff", hasta: null }];
    await montar();
    await tocar(boton(contenedor, "Cambiar"));
    const opciones = [...contenedor.querySelectorAll(".opcion-hoja")].map((b) => b.textContent.trim());
    // Solo los que administra.
    expect(opciones).toEqual(["Club Uno", "Club Dos"]);
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Club Dos"));
    expect(contenedor.querySelector(".cuentas-club-elegido strong").textContent).toBe("Club Dos");
    expect(fila("eva@dos.com")).toBeTruthy();
    expect(fila("beto@uno.com")).toBeUndefined();
  });

  test("el dueño tiene además las cuentas de la app: sumar a un club, quitar y devolver el acceso", async () => {
    datos.perfiles = [
      { user_id: "yo", email: "ana@uno.com", estado: "autorizado", admin: true, confirmado_en: "2026-09-01", creado_en: "2026-09-01T10:00:00Z" },
      { user_id: "nuevo", email: "nuevo@x.com", estado: "pendiente", confirmado_en: "2026-10-01", creado_en: "2026-10-01T10:00:00Z" },
      { user_id: "beto", email: "beto@uno.com", estado: "autorizado", confirmado_en: "2026-09-01", creado_en: "2026-09-01T10:00:00Z" },
      { user_id: "ex", email: "ex@uno.com", estado: "bloqueado", confirmado_en: "2026-08-01", creado_en: "2026-08-01T10:00:00Z" },
    ];
    datos.membresias = [
      { user_id: "beto", equipo_id: "c1", rol: "admin", hasta: null },
      { user_id: "ex", equipo_id: "c1", rol: "staff", hasta: "2026-08-31" },
    ];
    await montar({ esDueno: true });
    const pestanas = [...contenedor.querySelectorAll(".cuentas-pestanas button")];
    expect(pestanas.map((b) => b.textContent)).toEqual(["Gente del club", "Cuentas de la app1"]);
    await tocar(pestanas[1]);
    expect(grupos()).toEqual(["Por autorizar 1", "Con acceso 2", "Sin acceso 1"]);
    expect(fila("ana@uno.com").querySelector("button")).toBeNull();
    expect(fila("beto@uno.com").querySelector(".cuenta-meta").textContent).toContain("Club Uno (administra)");
    expect(fila("ex@uno.com").querySelector(".cuenta-meta").textContent).toContain("Club Uno (hasta el 31/08/2026)");
    expect(fila("nuevo@x.com").querySelector(".cuenta-meta").textContent).toContain("Sin club");

    await tocar(boton(fila("nuevo@x.com"), "Sumar a Club Uno"));
    expect(datos.llamadas.find((l) => l.que === "invitar")).toEqual({
      que: "invitar",
      equipoId: "c1",
      invitacion: { email: "nuevo@x.com", rol: "staff", partido: true, flujo: true, lesiones: false, evaluaciones: false },
    });

    await tocar(pestanas[1]);
    await tocar(boton(fila("beto@uno.com"), "Quitar acceso"));
    expect(texto()).toContain("deja de entrar a la app y a todos sus clubes");
    await tocar(boton(contenedor, "Sí, quitar"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "decidir", userId: "beto", cambios: { estado: "bloqueado" } });

    await tocar(boton(fila("ex@uno.com"), "Devolver acceso"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "decidir", userId: "ex", cambios: { estado: "autorizado" } });
  });

  test("si falta actualizar la base, el dueño igual maneja las cuentas de la app", async () => {
    datos.errorLeer = "cuentas.errorFaltaMigracion";
    datos.perfiles = [{ user_id: "nuevo", email: "nuevo@x.com", estado: "pendiente", confirmado_en: null, creado_en: "2026-10-01T10:00:00Z" }];
    await montar({ esDueno: true });
    expect(contenedor.querySelector(".cuentas-aviso").textContent).toContain("Falta actualizar la base (cuentas v2).");
    await tocar(contenedor.querySelectorAll(".cuentas-pestanas button")[1]);
    expect(fila("nuevo@x.com")).toBeTruthy();
  });

  test("Actualizar se queda en el club elegido", async () => {
    datos.clubes = [UNO, DOS];
    await montar();
    await tocar(boton(contenedor, "Cambiar"));
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Club Dos"));
    await tocar(contenedor.querySelector(".cuentas-actualizar"));
    expect(contenedor.querySelector(".cuentas-club-elegido strong").textContent).toBe("Club Dos");
  });

  test("si la base no contesta, lo dice y deja reintentar; Volver vuelve al portal", async () => {
    datos.errorLeer = "cuentas.errorFaltaMigracion";
    const onVolver = vi.fn();
    await montar({ onVolver });
    expect(contenedor.querySelector(".cuentas-aviso").textContent).toContain("Falta actualizar la base (cuentas v2).");
    datos.errorLeer = null;
    await tocar(boton(contenedor, "Reintentar"));
    expect(fila("ana@uno.com")).toBeTruthy();
    await tocar(contenedor.querySelector(".cuentas-volver"));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });
});
