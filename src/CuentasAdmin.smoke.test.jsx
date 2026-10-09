import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// La base de mentira: clubes, gente de cada club, invitaciones, historia y
// pedidos de acceso. Cada prueba la arma a su gusto.
const datos = vi.hoisted(() => ({
  clubes: [],
  miembros: {},
  invitaciones: {},
  historia: [],
  // Pedidos de acceso por club; null: la base todavía no los tiene.
  pedidos: {},
  errorPedido: null,
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

vi.mock("./domain/pedidosDb.js", async () => {
  const real = await vi.importActual("./domain/pedidosDb.js");
  return {
    ...real,
    pedidosDelClub: async (equipoId) => {
      const lista = datos.pedidos[equipoId];
      if (lista === null) throw new Error("pedidos.error.faltaMigracion");
      return lista || [];
    },
    // Como la base: aceptar suma la cuenta al club como staff y el pedido se va.
    aceptarPedido: async (id, modulos) => {
      datos.llamadas.push({ que: "aceptar", id, modulos });
      if (datos.errorPedido) throw new Error(datos.errorPedido);
      const [equipoId, lista] = Object.entries(datos.pedidos).find(([, pedidos]) => pedidos?.some((p) => p.id === id));
      const pedido = lista.find((p) => p.id === id);
      datos.pedidos[equipoId] = lista.filter((p) => p.id !== id);
      datos.miembros[equipoId].push({ equipo_id: equipoId, user_id: `u-${id}`, email: pedido.email, estado: "autorizado", rol: "staff", desde: "2026-10-06", hasta: null, ...modulos });
      return true;
    },
    rechazarPedido: async (id) => {
      datos.llamadas.push({ que: "rechazar", id });
      return true;
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
    datos.pedidos = { c1: [] };
    datos.errorPedido = null;
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

  test("el admin del club ve a su gente: pedidos, activos, los que se fueron, invitaciones y etiquetas", async () => {
    await montar();
    expect(contenedor.querySelector(".cuentas-pestanas")).toBeNull();
    expect(contenedor.querySelector(".cuentas-club-elegido strong").textContent).toBe("Club Uno");
    expect(grupos()).toEqual(["Pedidos de acceso 0", "Invitar a alguien", "Invitaciones abiertas 1", "En el club 3", "Se fueron 1"]);
    // Nada de las cuentas de toda la app.
    expect(texto()).not.toContain("Cuentas de la app");

    // La fila propia: sus módulos se leen, no se tocan.
    const ana = fila("ana@uno.com");
    expect([...ana.querySelectorAll(".cuenta-etiqueta")].map((e) => e.textContent)).toEqual(["Tu cuenta", "Administrador del club"]);
    expect(ana.querySelector(".cuenta-chip")).toBeNull();
    expect(ana.querySelector(".cuenta-meta").textContent).toContain("Partido, Flujo diario, Lesiones");
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

    // Con el punto del mensaje pegado al final no se invita: nunca llegaría.
    await escribir(correo, "nuevo@prueba.com.");
    await tocar(invitarBoton);
    expect(texto()).toContain("Escribí un correo válido.");
    expect(datos.llamadas).toEqual([]);

    await escribir(correo, "nuevo@uno.com");
    await tocar(chip(contenedor.querySelector(".cuentas-invitar"), "Lesiones"));
    await tocar(chip(contenedor.querySelector(".cuentas-invitar"), "Evaluaciones"));
    await tocar(chip(contenedor.querySelector(".cuentas-invitar"), "Flujo diario"));
    await tocar(invitarBoton);
    // Sin chip de administrador: se invita siempre como staff.
    expect(chip(contenedor.querySelector(".cuentas-invitar"), "Administrador del club")).toBeUndefined();
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

  test("los módulos van a la base al toque; el rol no se toca y otro admin no tiene acciones", async () => {
    datos.miembros.c1.push(miembro({ user_id: "cata", email: "cata@uno.com", rol: "admin" }));
    await montar();
    await tocar(chip(fila("beto@uno.com"), "Lesiones"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "cambiar", userId: "beto", equipoId: "c1", cambios: { lesiones: true } });
    expect(chip(fila("beto@uno.com"), "Lesiones").getAttribute("aria-pressed")).toBe("true");
    // Evaluaciones es un permiso aparte.
    await tocar(chip(fila("beto@uno.com"), "Evaluaciones"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "cambiar", userId: "beto", equipoId: "c1", cambios: { evaluaciones: true } });
    expect(chip(fila("beto@uno.com"), "Evaluaciones").getAttribute("aria-pressed")).toBe("true");

    // Ningún chip de rol en ninguna fila.
    expect(chip(contenedor, "Administrador del club")).toBeUndefined();
    // Otro admin: sin módulos para tocar, sin baja; la historia se mira.
    const cata = fila("cata@uno.com");
    expect(cata.querySelector(".cuenta-chip")).toBeNull();
    expect(boton(cata, "Dar de baja")).toBeUndefined();
    expect(boton(cata, "Salir del club")).toBeUndefined();
    expect(boton(cata, "Historia")).toBeTruthy();
    // La fila propia queda sin acciones (solo la historia): salir del club
    // está en Cambiar club, para todos igual.
    expect([...fila("ana@uno.com").querySelectorAll(".cuenta-acciones button")].map((b) => b.textContent)).toEqual(["Historia"]);
    expect(boton(contenedor, "Salir del club")).toBeUndefined();
  });

  test("la fila de un dueño de la app no tiene acciones (como la de otro admin) y lo dice", async () => {
    datos.miembros.c1.push(
      miembro({ user_id: "duenio", email: "duenio@uno.com", protegido: true }),
      miembro({ user_id: "sub", email: "sub@uno.com", protegido: true, hasta: "2026-08-31" }),
    );
    await montar();
    const duenio = fila("duenio@uno.com");
    expect([...duenio.querySelectorAll(".cuenta-etiqueta")].map((e) => e.textContent)).toEqual(["Dueño de la app"]);
    expect(duenio.querySelector(".cuenta-chip")).toBeNull();
    expect(duenio.querySelector(".cuenta-meta").textContent).toContain("Partido, Flujo diario");
    expect([...duenio.querySelectorAll(".cuenta-acciones button")].map((b) => b.textContent)).toEqual(["Historia"]);
    // Aunque se haya ido: nadie del club lo reincorpora ni le cambia qué ve.
    const sub = fila("sub@uno.com");
    expect(sub.classList.contains("se-fue")).toBe(true);
    expect(sub.querySelector(".cuenta-chip")).toBeNull();
    expect(boton(sub, "Reincorporar")).toBeUndefined();
    expect([...sub.querySelectorAll(".cuenta-etiqueta")].map((e) => e.textContent)).toEqual(["Dueño de la app"]);
    // El resto sigue igual.
    expect(boton(fila("beto@uno.com"), "Dar de baja")).toBeTruthy();
    expect(chip(fila("beto@uno.com"), "Partido")).toBeTruthy();

    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    expect(fila("duenio@uno.com").querySelector(".cuenta-etiqueta").textContent).toBe("Dono do app");
    fijarIdiomaParaPruebas("es-AR");
  });

  test("si la base protege la cuenta (un dueño de la app), lo dice en el idioma de la app", async () => {
    datos.errorCambio = "cuentas.errorDuenoProtegido";
    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    await montar();
    await tocar(chip(fila("beto@uno.com"), "Lesões"));
    expect(texto()).toContain("Essa conta não pode ser removida nem alterada pelo clube: só ela pode sair.");
    expect(chip(fila("beto@uno.com"), "Lesões").getAttribute("aria-pressed")).toBe("false");
    fijarIdiomaParaPruebas("es-AR");
  });

  test("pedidos de acceso: aceptar eligiendo módulos (entra como staff) y rechazar con confirmación", async () => {
    datos.pedidos.c1 = [
      { id: "p1", email: "pide@uno.com", creado_en: "2026-10-05T12:00:00Z" },
      { id: "p2", email: "otro@uno.com", creado_en: "2026-10-04T12:00:00Z" },
    ];
    await montar();
    expect(grupos()[0]).toBe("Pedidos de acceso 2");
    const pedido = fila("pide@uno.com");
    expect(pedido.querySelector(".cuenta-meta").textContent).toBe("Pidió el 05/10/2026");

    await tocar(boton(pedido, "Aceptar"));
    const hoja = contenedor.querySelector(".cuentas-hoja");
    expect(hoja.textContent).toContain("¿Qué puede usar pide@uno.com?");
    // Los mismos chips de la invitación, con lo de siempre marcado.
    expect([...hoja.querySelectorAll(".cuenta-chip")].map((c) => [c.textContent, c.getAttribute("aria-pressed")])).toEqual([
      ["Partido", "true"],
      ["Flujo diario", "true"],
      ["Lesiones", "false"],
      ["Evaluaciones", "false"],
    ]);
    await tocar(chip(hoja, "Flujo diario"));
    await tocar(chip(hoja, "Lesiones"));
    await tocar(boton(hoja, "Sí, aceptar"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "aceptar", id: "p1", modulos: { partido: true, flujo: false, lesiones: true, evaluaciones: false } });
    expect(texto()).toContain("pide@uno.com ya está en el club.");
    expect(fila("pide@uno.com").closest(".cuentas-grupo").querySelector("h2").textContent).toContain("En el club");
    expect(grupos()[0]).toBe("Pedidos de acceso 1");

    await tocar(boton(fila("otro@uno.com"), "Rechazar"));
    expect(datos.llamadas.some((l) => l.que === "rechazar")).toBe(false);
    expect(contenedor.querySelector(".hoja-confirmar").textContent).toContain("otro@uno.com no entra a Club Uno");
    await tocar(boton(contenedor.querySelector(".hoja-confirmar"), "Sí, rechazar"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "rechazar", id: "p2" });
    expect(fila("otro@uno.com")).toBeUndefined();
    expect(texto()).toContain("Pedido rechazado.");
  });

  test("con una base sin pedidos, Cuentas sigue sin esa parte", async () => {
    datos.pedidos.c1 = null;
    await montar();
    expect(grupos()).toEqual(["Invitar a alguien", "Invitaciones abiertas 1", "En el club 3", "Se fueron 1"]);
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

  test("un cambio de nombre del club (lo hace un dueño de la app) se lee como tal, no como una membresía borrada", async () => {
    const renombre = { accion: "club_renombrado", detalle: { antes: "Club Uno", nombre: "Club Unido" }, quien_email: "" };
    expect(textoDeMovimiento(renombre)).toBe("El club pasó a llamarse Club Unido");
    expect(textoDeMovimiento(renombre)).not.toBe(textoDeMovimiento({ accion: "otra", detalle: {} }));
    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    expect(textoDeMovimiento(renombre)).toBe("O clube passou a se chamar Club Unido");
  });

  test("la invitación se copia como mensaje y se cancela", async () => {
    const escrito = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => escrito.push(t) } });
    await montar();
    await tocar(boton(fila("espera@uno.com"), "Copiar mensaje"));
    expect(escrito[0]).toContain("Te invité a Club Uno");
    // El enlace y el correo, cada uno solo en su renglón: nada se les pega.
    const renglones = escrito[0].split("\n");
    expect(renglones[renglones.indexOf("Entrá a este enlace:") + 1]).toBe(window.location.origin);
    expect(window.location.origin).toMatch(/^https?:\/\/\S+$/);
    expect(renglones.at(-1)).toBe("espera@uno.com");
    expect(texto()).toContain("Mensaje copiado.");

    await tocar(boton(fila("espera@uno.com"), "Cancelar"));
    expect(datos.llamadas.at(-1)).toEqual({ que: "cancelar", id: "i1" });
    expect(fila("espera@uno.com")).toBeUndefined();
    expect(texto()).toContain("Invitación cancelada.");
  });

  test("sin portapapeles, el mensaje queda a la vista con el correo solo en el último renglón", async () => {
    await montar();
    await tocar(boton(fila("espera@uno.com"), "Copiar mensaje"));
    const aviso = contenedor.querySelector(".cuentas-aviso").textContent;
    expect(aviso).toContain("Te invité a Club Uno");
    expect(aviso.split("\n").at(-1)).toBe("espera@uno.com");
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
    expect(texto()).toContain("Cargando…");
    expect(texto()).not.toContain("Todavía no hay nadie en el club.");
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
    expect(contenedor.querySelector(".cuentas-aviso").textContent).toContain("Falta actualizar la base (cuentas v2)");
    datos.errorLeer = null;
    await tocar(boton(contenedor, "Reintentar"));
    expect(fila("ana@uno.com")).toBeTruthy();
    await tocar(contenedor.querySelector(".cuentas-volver"));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });
});
