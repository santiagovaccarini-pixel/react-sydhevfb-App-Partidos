import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cambiarIdioma } from "./idioma/index.js";

// La base de mentira: las notas y lo que se le pidió. Cada prueba la arma a su
// gusto.
const datos = vi.hoisted(() => ({ notas: [], llamadas: [], errorLeer: null, errorGuardar: null }));

vi.mock("./domain/notasDb.js", async () => {
  const real = await vi.importActual("./domain/notasDb.js");
  let siguiente = 100;
  return {
    ...real,
    listarNotas: async (equipoId) => {
      datos.llamadas.push({ que: "listar", equipoId });
      if (datos.errorLeer) throw new Error(datos.errorLeer);
      return real.ordenarNotas(datos.notas);
    },
    agregarNota: async (equipoId, texto) => {
      datos.llamadas.push({ que: "agregar", equipoId, texto });
      if (datos.errorGuardar) throw new Error(datos.errorGuardar);
      siguiente += 1;
      const nota = { id: `n-${siguiente}`, equipo_id: equipoId, texto: texto.trim(), hecha: false, creado_por: "u-juana", creado_email: "juana@prueba.com", creado_en: "2026-10-06T15:00:00Z" };
      datos.notas = [nota, ...datos.notas];
      return nota;
    },
    cambiarNota: async (id, cambios) => {
      datos.llamadas.push({ que: "cambiar", id, cambios });
      if (datos.errorGuardar) throw new Error(datos.errorGuardar);
      datos.notas = datos.notas.map((nota) => (nota.id === id ? { ...nota, ...cambios, texto: (cambios.texto ?? nota.texto).trim() } : nota));
      return datos.notas.find((nota) => nota.id === id);
    },
    borrarNota: async (id) => {
      datos.llamadas.push({ que: "borrar", id });
      datos.notas = datos.notas.filter((nota) => nota.id !== id);
    },
  };
});

// Realtime de mentira: deja mandar "alguien cambió las notas".
const realtime = vi.hoisted(() => ({ canales: [] }));
vi.mock("./supabase.js", () => ({
  supabase: {
    channel: (nombre) => {
      const canal = {
        nombre,
        escuchas: [],
        on(tipo, filtro, alLlegar) {
          canal.escuchas.push({ filtro, alLlegar });
          return canal;
        },
        subscribe(alCambiarEstado) {
          alCambiarEstado("SUBSCRIBED");
          return canal;
        },
      };
      realtime.canales.push(canal);
      return canal;
    },
    removeChannel: () => {},
  },
}));

import Notas from "./Notas.jsx";
import { enVivo } from "./domain/enVivo.js";

describe("Notas", () => {
  let contenedor;
  let raiz;
  let volver;

  beforeEach(() => {
    cambiarIdioma("es-AR");
    datos.notas = [
      { id: "n-1", texto: "Filtro por rival en Registros", hecha: false, creado_por: "u-juana", creado_email: "juana@prueba.com", creado_en: "2026-10-05T12:00:00Z" },
      { id: "n-2", texto: "Exportar el informe a PDF", hecha: true, creado_por: "u-ivan", creado_email: "ivan@prueba.com", creado_en: "2026-10-04T12:00:00Z" },
    ];
    datos.llamadas = [];
    datos.errorLeer = null;
    datos.errorGuardar = null;
    volver = vi.fn();
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    document.body.innerHTML = "";
  });

  const CLUB = { id: "eq-1", nombre: "Atlético Mineiro" };
  // Entra Juana, staff del club; con adminClub, administra el club.
  const montar = async ({ adminClub = false } = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<Notas club={CLUB} userId="u-juana" adminClub={adminClub} onVolver={volver} />);
    });
  };

  const boton = (texto, dentro = document.body) => [...dentro.querySelectorAll("button")].find((uno) => uno.textContent.trim() === texto);
  const tocar = async (elemento) => {
    await act(async () => elemento.click());
  };
  const escribir = async (campo, valor) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    await act(async () => {
      setter.call(campo, valor);
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const textos = () => [...contenedor.querySelectorAll(".nota-texto")].map((uno) => uno.textContent);

  test("muestra las del club, por hacer y hechas, con quién la escribió; Volver al portal vuelve", async () => {
    await montar();
    expect(datos.llamadas).toContainEqual({ que: "listar", equipoId: "eq-1" });
    expect(contenedor.querySelector("h1").textContent).toBe("Notas");
    expect(contenedor.querySelector(".portal-kicker").textContent).toBe("Atlético Mineiro");
    expect(contenedor.querySelector(".cuentas-titulo p").textContent).toBe("Las mejoras que querés hacer en la app. Las ve la gente de Atlético Mineiro; ningún otro club.");
    const grupos = [...contenedor.querySelectorAll(".cuentas-grupo h2")].map((uno) => uno.textContent);
    expect(grupos).toEqual(["Nueva nota", "Por hacer 1", "Hechas 1"]);
    expect(textos()).toEqual(["Filtro por rival en Registros", "Exportar el informe a PDF"]);
    expect(contenedor.querySelector(".nota-fila.hecha .cuenta-meta").textContent).toContain("ivan@prueba.com");
    await tocar(boton("Volver al portal", contenedor));
    expect(volver).toHaveBeenCalled();
  });

  test("lo que anota otra persona aparece solo, sin recargar ni mostrar «Cargando»", async () => {
    vi.useFakeTimers();
    enVivo.prendido = true;
    realtime.canales = [];
    try {
      await montar();
      expect(textos()).toEqual(["Filtro por rival en Registros", "Exportar el informe a PDF"]);
      const [canal] = realtime.canales;
      expect(canal.escuchas.map((una) => una.filtro)).toEqual([
        { event: "*", schema: "public", table: "notas", filter: "equipo_id=eq.eq-1" },
        { event: "DELETE", schema: "public", table: "notas" },
      ]);
      // Desde otro celular, alguien anota una.
      datos.notas = [{ id: "n-9", texto: "Cargar el GPS desde OpenField", hecha: false, creado_por: "u-ivan", creado_email: "ivan@prueba.com", creado_en: "2026-10-11T12:00:00Z" }, ...datos.notas];
      await act(async () => canal.escuchas[0].alLlegar({ eventType: "INSERT" }));
      await act(async () => vi.advanceTimersByTime(900));
      await act(async () => Promise.resolve());
      expect(textos()).toEqual(["Cargar el GPS desde OpenField", "Filtro por rival en Registros", "Exportar el informe a PDF"]);
      expect(contenedor.textContent).not.toContain("Cargando");
      // Si en ese momento no se puede leer, quedan las que se veían (sin error).
      datos.errorLeer = "sin señal";
      await act(async () => canal.escuchas[1].alLlegar({ eventType: "DELETE", old: { id: "n-9" } }));
      await act(async () => vi.advanceTimersByTime(900));
      await act(async () => Promise.resolve());
      expect(textos()).toHaveLength(3);
      expect(contenedor.querySelector(".cuentas-reintentar")).toBeNull();
    } finally {
      enVivo.prendido = false;
      vi.useRealTimers();
    }
  });

  test("agrega una nota arriba de las que faltan hacer y vacía el campo", async () => {
    await montar();
    const campo = contenedor.querySelector(".nota-nueva textarea");
    expect(boton("Agregar nota", contenedor).disabled).toBe(true);
    await escribir(campo, "  Avisar cuando vence una invitación  ");
    await tocar(boton("Agregar nota", contenedor));
    expect(datos.llamadas).toContainEqual({ que: "agregar", equipoId: "eq-1", texto: "  Avisar cuando vence una invitación  " });
    expect(textos()[0]).toBe("Avisar cuando vence una invitación");
    expect(campo.value).toBe("");
  });

  test("marca como hecha, la vuelve a por hacer y la corrige", async () => {
    await montar();
    const primera = contenedor.querySelector(".nota-fila");
    await tocar(boton("Marcar como hecha", primera));
    expect(datos.llamadas).toContainEqual({ que: "cambiar", id: "n-1", cambios: { hecha: true } });
    expect(contenedor.querySelectorAll(".nota-fila.hecha")).toHaveLength(2);

    const hecha = [...contenedor.querySelectorAll(".nota-fila")].find((fila) => fila.textContent.includes("Filtro por rival"));
    await tocar(boton("Volver a por hacer", hecha));
    expect(contenedor.querySelectorAll(".nota-fila.hecha")).toHaveLength(1);

    const fila = contenedor.querySelector(".nota-fila");
    await tocar(boton("Corregir", fila));
    await escribir(fila.querySelector("textarea"), "Filtro por rival y por fecha");
    await tocar(boton("Guardar", fila));
    expect(datos.llamadas).toContainEqual({ que: "cambiar", id: "n-1", cambios: { texto: "Filtro por rival y por fecha" } });
    expect(textos()[0]).toBe("Filtro por rival y por fecha");
    expect(contenedor.querySelector(".nota-fila textarea")).toBeNull();
  });

  test("la nota de otro se marca como hecha, pero no se corrige ni se borra; el administrador la puede borrar", async () => {
    await montar();
    const deIvan = contenedor.querySelector(".nota-fila.hecha");
    expect(boton("Volver a por hacer", deIvan)).toBeTruthy();
    expect(boton("Corregir", deIvan)).toBeUndefined();
    expect(boton("Borrar", deIvan)).toBeUndefined();
    const propia = contenedor.querySelector(".nota-fila:not(.hecha)");
    expect(boton("Corregir", propia)).toBeTruthy();
    expect(boton("Borrar", propia)).toBeTruthy();
    await act(async () => raiz.unmount());

    await montar({ adminClub: true });
    const comoAdmin = contenedor.querySelector(".nota-fila.hecha");
    expect(boton("Corregir", comoAdmin)).toBeUndefined();
    expect(boton("Borrar", comoAdmin)).toBeTruthy();
  });

  test("borrar pregunta antes; Cancelar no borra y Sí, borrar sí", async () => {
    await montar();
    const fila = contenedor.querySelector(".nota-fila");
    await tocar(boton("Borrar", fila));
    expect(document.body.querySelector(".hoja-confirmar")).not.toBeNull();
    expect(document.body.querySelector(".detalle-hoja").textContent).toBe("Filtro por rival en Registros");
    await tocar(boton("Cancelar"));
    expect(datos.llamadas.some((uno) => uno.que === "borrar")).toBe(false);

    await tocar(boton("Borrar", contenedor.querySelector(".nota-fila")));
    await tocar(boton("Sí, borrar"));
    expect(datos.llamadas).toContainEqual({ que: "borrar", id: "n-1" });
    expect(textos()).toEqual(["Exportar el informe a PDF"]);
  });

  test("un error al guardar se avisa y la nota sigue escrita", async () => {
    datos.errorGuardar = "notas.errorGuardar";
    await montar();
    const campo = contenedor.querySelector(".nota-nueva textarea");
    await escribir(campo, "Algo");
    await tocar(boton("Agregar nota", contenedor));
    expect(contenedor.querySelector(".cuentas-aviso").textContent).toBe("No se pudo guardar la nota. Probá de nuevo.");
    expect(campo.value).toBe("Algo");
  });

  test("sin la tabla en la base dice qué SQL falta, en portugués también", async () => {
    datos.errorLeer = "notas.errorFaltaMigracion";
    cambiarIdioma("pt-BR");
    await montar();
    expect(contenedor.querySelector(".cuentas-aviso").textContent).toContain("rode o SQL de Notas (20261013b_notas.sql)");
    expect(contenedor.querySelector(".nota-nueva")).toBeNull();
  });
});
