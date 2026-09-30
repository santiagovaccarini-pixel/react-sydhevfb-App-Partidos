import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import CuentasAdmin, { PERMISOS_INICIALES, permisosDeFila } from "./CuentasAdmin.jsx";

const datos = vi.hoisted(() => ({ lista: [], errorLista: null, decisiones: [], errorDecision: null }));

vi.mock("./domain/perfilesDb.js", async () => {
  const real = await vi.importActual("./domain/perfilesDb.js");
  return {
    ...real,
    listarPerfiles: async () => {
      if (datos.errorLista) throw new Error(datos.errorLista);
      return datos.lista;
    },
    decidirPerfil: async (userId, cambios) => {
      datos.decisiones.push({ userId, cambios });
      if (datos.errorDecision) throw new Error(datos.errorDecision);
      const perfil = datos.lista.find((p) => p.user_id === userId);
      const fila = { ...perfil, ...cambios, decidido_en: "2026-09-30T15:00:00Z" };
      datos.lista = datos.lista.map((p) => (p.user_id === userId ? fila : p));
      return fila;
    },
  };
});

const CUENTAS = () => [
  { user_id: "yo", email: "santi@club.com", estado: "autorizado", partido: true, flujo: true, admin: true, confirmado_en: "2026-09-08", creado_en: "2026-09-08T10:00:00Z" },
  { user_id: "pf", email: "pf@club.com", estado: "pendiente", partido: false, flujo: false, admin: false, confirmado_en: "2026-09-29", creado_en: "2026-09-29T10:00:00Z" },
  { user_id: "ana", email: "analista@club.com", estado: "pendiente", partido: false, flujo: false, admin: false, confirmado_en: null, creado_en: "2026-09-30T08:00:00Z" },
  { user_id: "ayu", email: "ayudante@club.com", estado: "autorizado", partido: true, flujo: false, admin: false, confirmado_en: "2026-09-20", creado_en: "2026-09-20T10:00:00Z" },
  { user_id: "ex", email: "ex@club.com", estado: "bloqueado", partido: true, flujo: true, admin: false, confirmado_en: "2026-08-01", creado_en: "2026-08-01T10:00:00Z" },
];

describe("qué queda marcado en una fila", () => {
  test("una cuenta nueva sin nada arranca con Partido y Flujo diario; las demás, lo que dice la base", () => {
    expect(permisosDeFila({ estado: "pendiente", partido: false, flujo: false, admin: false })).toBe(PERMISOS_INICIALES);
    expect(permisosDeFila({ estado: "autorizado", partido: true, flujo: false, admin: false })).toEqual({ partido: true, flujo: false, admin: false });
    expect(permisosDeFila({ estado: "pendiente" }, { partido: false, flujo: true, admin: false })).toEqual({ partido: false, flujo: true, admin: false });
  });
});

describe("la pantalla Cuentas", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    datos.lista = CUENTAS();
    datos.errorLista = null;
    datos.decisiones = [];
    datos.errorDecision = null;
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
      raiz.render(<CuentasAdmin miUserId="yo" onVolver={onVolver} />);
    });
    await act(async () => Promise.resolve());
  };

  const fila = (correo) =>
    Array.from(contenedor.querySelectorAll(".cuenta-fila")).find((li) => li.querySelector(".cuenta-correo").textContent === correo);
  const botonDe = (li, texto) => Array.from(li.querySelectorAll("button")).find((b) => b.textContent.trim() === texto);
  const chip = (li, texto) => Array.from(li.querySelectorAll(".cuenta-chip")).find((b) => b.textContent.trim() === texto);

  test("agrupa las cuentas, marca la propia sin botones y avisa el correo sin confirmar", async () => {
    await montar();

    const grupos = Array.from(contenedor.querySelectorAll(".cuentas-grupo h2")).map((h) => h.textContent.replace(/\s+/g, " ").trim());
    expect(grupos).toEqual(["Por autorizar 2", "Con acceso 2", "Sin acceso 1"]);

    const propia = fila("santi@club.com");
    expect(propia.classList.contains("propia")).toBe(true);
    expect(propia.querySelector(".cuenta-etiqueta").textContent).toBe("Tu cuenta");
    expect(propia.querySelector("button")).toBeNull();

    expect(fila("analista@club.com").querySelector(".cuenta-etiqueta.alerta").textContent).toBe("Correo sin confirmar");
    expect(fila("pf@club.com").querySelector(".cuenta-etiqueta")).toBeNull();

    // Una pendiente arranca con Partido y Flujo diario marcados.
    const pf = fila("pf@club.com");
    expect(chip(pf, "Partido").getAttribute("aria-pressed")).toBe("true");
    expect(chip(pf, "Flujo diario").getAttribute("aria-pressed")).toBe("true");
    expect(chip(pf, "Administrador").getAttribute("aria-pressed")).toBe("false");
    expect(botonDe(pf, "Autorizar")).not.toBeNull();
    expect(botonDe(pf, "Rechazar")).not.toBeNull();
  });

  test("autorizar una pendiente manda el estado y los módulos elegidos, y la pasa a Con acceso", async () => {
    await montar();
    const pf = fila("pf@club.com");
    // Solo Partido.
    await act(async () => chip(pf, "Flujo diario").click());
    expect(datos.decisiones).toEqual([]);
    await act(async () => botonDe(pf, "Autorizar").click());
    await act(async () => Promise.resolve());

    expect(datos.decisiones).toEqual([{ userId: "pf", cambios: { estado: "autorizado", partido: true, flujo: false, admin: false } }]);
    const grupos = Array.from(contenedor.querySelectorAll(".cuentas-grupo h2")).map((h) => h.textContent.replace(/\s+/g, " ").trim());
    expect(grupos).toEqual(["Por autorizar 1", "Con acceso 3", "Sin acceso 1"]);
    expect(botonDe(fila("pf@club.com"), "Quitar acceso")).not.toBeNull();
  });

  test("no deja autorizar sin ningún módulo", async () => {
    await montar();
    const pf = fila("pf@club.com");
    await act(async () => chip(pf, "Partido").click());
    await act(async () => chip(pf, "Flujo diario").click());
    await act(async () => botonDe(pf, "Autorizar").click());
    expect(datos.decisiones).toEqual([]);
    expect(contenedor.querySelector(".cuentas-aviso").textContent).toContain("al menos un módulo");
  });

  test("en una cuenta con acceso, tocar un módulo va a la base al toque", async () => {
    await montar();
    const ayu = fila("ayudante@club.com");
    await act(async () => chip(ayu, "Flujo diario").click());
    await act(async () => Promise.resolve());
    expect(datos.decisiones).toEqual([{ userId: "ayu", cambios: { flujo: true } }]);
    expect(chip(fila("ayudante@club.com"), "Flujo diario").getAttribute("aria-pressed")).toBe("true");
  });

  test("quitar el acceso pide confirmación y bloquea la cuenta", async () => {
    await montar();
    await act(async () => botonDe(fila("ayudante@club.com"), "Quitar acceso").click());
    expect(contenedor.querySelector(".hoja-confirmar h3").textContent).toBe("¿Quitar el acceso?");
    await act(async () => contenedor.querySelector(".boton-confirmar-hoja").click());
    await act(async () => Promise.resolve());

    expect(datos.decisiones).toEqual([{ userId: "ayu", cambios: { estado: "bloqueado" } }]);
    expect(botonDe(fila("ayudante@club.com"), "Autorizar")).not.toBeNull();
    const grupos = Array.from(contenedor.querySelectorAll(".cuentas-grupo h2")).map((h) => h.textContent.replace(/\s+/g, " ").trim());
    expect(grupos).toEqual(["Por autorizar 2", "Con acceso 1", "Sin acceso 2"]);
  });

  test("rechazar una pendiente también pide confirmación", async () => {
    await montar();
    await act(async () => botonDe(fila("analista@club.com"), "Rechazar").click());
    expect(contenedor.querySelector(".hoja-confirmar h3").textContent).toBe("¿Rechazar esta cuenta?");
    await act(async () => contenedor.querySelector(".boton-cancelar-hoja").click());
    expect(datos.decisiones).toEqual([]);
  });

  test("una bloqueada se vuelve a autorizar con lo que tenía", async () => {
    await montar();
    await act(async () => botonDe(fila("ex@club.com"), "Autorizar").click());
    await act(async () => Promise.resolve());
    expect(datos.decisiones).toEqual([{ userId: "ex", cambios: { estado: "autorizado", partido: true, flujo: true, admin: false } }]);
  });

  test("si la base no deja, lo dice sin cambiar la lista", async () => {
    datos.errorDecision = "No se pudo guardar el cambio: no tenés permiso o la cuenta ya no existe.";
    await montar();
    await act(async () => botonDe(fila("pf@club.com"), "Autorizar").click());
    await act(async () => Promise.resolve());
    expect(contenedor.querySelector(".cuentas-aviso").textContent).toContain("no tenés permiso");
    expect(botonDe(fila("pf@club.com"), "Autorizar")).not.toBeNull();
  });

  test("si no se pueden leer las cuentas, avisa y deja reintentar; Volver llama a onVolver", async () => {
    datos.errorLista = "permission denied";
    const onVolver = vi.fn();
    await montar(onVolver);
    expect(contenedor.querySelector(".cuentas-aviso").textContent).toContain("permission denied");

    datos.errorLista = null;
    await act(async () => contenedor.querySelector(".cuentas-reintentar").click());
    await act(async () => Promise.resolve());
    expect(contenedor.querySelectorAll(".cuenta-fila")).toHaveLength(5);

    await act(async () => contenedor.querySelector(".cuentas-volver").click());
    expect(onVolver).toHaveBeenCalledTimes(1);
  });
});
