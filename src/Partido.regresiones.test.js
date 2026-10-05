import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

// Una base en memoria que se comporta como la de verdad: insert agrega la
// fila con su id, update cambia la fila y la devuelve, select trae lo que hay.
// Con ella se prueban los caminos de guardado que el doble más simple de
// App.smoke.test.js no puede mostrar (qué termina quedando en la base).
const db = vi.hoisted(() => ({
  filas: [],
  siguienteId: 100,
  errorGuardado: null,
  errorHistorial: null,
  inserts: [],
  updates: [],
  equipos: [],
  renombres: 0,
  bloquearRenombre: false,
  errorCrearEquipo: null,
  retenerRival: null,
  fallarRival: null,
  soltar: null,
  lecturasHistorial: 0,
  retenerHistorialDe: null,
  soltarHistorial: null,
}));

vi.mock("./supabase.js", () => ({
  supabase: {
    rpc: async () => ({ data: [], error: null }),
    from: (tablaPedida) => {
      const tabla = tablaPedida === "v_mis_clubes" ? "equipos" : tablaPedida;
      if (tabla === "equipos") {
        const c = {
          select: () => c,
          eq: () => c,
          order: async () => ({ data: db.equipos.map((e) => ({ ...e })), error: null }),
          update: (cambios) => ({
            eq: (campo, valor) => ({
              // Como la base con RLS para quien no administra el club: no
              // cambia nada, no da error y no devuelve ninguna fila.
              select: async () => {
                db.renombres += 1;
                if (db.bloquearRenombre) return { data: [], error: null };
                const equipo = db.equipos.find((e) => e.id === valor);
                if (!equipo) return { data: [], error: null };
                equipo.nombre = cambios.nombre;
                return { data: [{ id: equipo.id }], error: null };
              },
            }),
          }),
          insert: (filas) => ({
            select: async () => {
              if (db.errorCrearEquipo) return { data: null, error: db.errorCrearEquipo };
              const equipo = { id: `eq-${db.equipos.length + 1}`, ...filas[0] };
              db.equipos.push(equipo);
              return { data: [equipo], error: null };
            },
          }),
        };
        return c;
      }
      if (tabla === "jugadores") {
        const c = { select: () => c, eq: () => c, order: async () => ({ data: [], error: null }) };
        return c;
      }
      let filtroEquipo = null;
      const c = {
        select: () => c,
        order: async () => {
          db.lecturasHistorial += 1;
          if (db.retenerHistorialDe && filtroEquipo === db.retenerHistorialDe) {
            await new Promise((resolver) => {
              db.soltarHistorial = resolver;
            });
          }
          return {
            data: db.errorHistorial
              ? null
              : db.filas
                  .filter((f) => !filtroEquipo || f.equipo_id === filtroEquipo)
                  .map((f) => ({ ...f }))
                  .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))),
            error: db.errorHistorial,
          };
        },
        insert: (filas) => ({
          select: async () => {
            if (db.retenerRival && filas[0].rival === db.retenerRival) {
              await new Promise((resolver) => {
                db.soltar = resolver;
              });
            }
            if (db.fallarRival && filas[0].rival === db.fallarRival) return { data: null, error: { message: "timeout" } };
            if (db.errorGuardado) return { data: null, error: db.errorGuardado };
            const fila = { ...filas[0], id: db.siguienteId++ };
            db.filas.push(fila);
            db.inserts.push({ ...fila });
            return { data: [{ ...fila }], error: null };
          },
        }),
        update: (cambios) => ({
          eq: (campo, valor) => ({
            select: async () => {
              if (db.errorGuardado) return { data: null, error: db.errorGuardado };
              const fila = db.filas.find((f) => String(f.id) === String(valor));
              if (!fila) return { data: [], error: null };
              Object.assign(fila, cambios);
              db.updates.push({ id: valor, ...cambios });
              return { data: [{ ...fila }], error: null };
            },
          }),
        }),
        delete: () => c,
        eq: (campo, valor) => {
          if (campo === "equipo_id") filtroEquipo = valor;
          return c;
        },
        in: async () => ({ data: [], error: null }),
      };
      return c;
    },
  },
}));

const borradorCruzeiro = (extra = {}) => ({
  version: 2,
  registro: {
    fecha: "2026-09-08",
    rival: "Cruzeiro",
    resultado: "1-0",
    formacion: { titulares: ["ALONSO", "SCARPA"], convocados: ["BERNARD"] },
    ...extra,
  },
});

describe("Partido: guardado, cola del celular y lo que queda en la base", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 8, 21, 25, 34));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ version: "x" }) })));
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("scrollTo", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    Object.assign(db, {
      filas: [],
      siguienteId: 100,
      errorGuardado: null,
      errorHistorial: null,
      inserts: [],
      updates: [],
      equipos: [{ id: "eq-1", nombre: "Atlético Mineiro" }],
      renombres: 0,
      bloquearRenombre: false,
      errorCrearEquipo: null,
      retenerRival: null,
      fallarRival: null,
      soltar: null,
      lecturasHistorial: 0,
      retenerHistorialDe: null,
      soltarHistorial: null,
    });
    localStorage.clear();
    localStorage.setItem("registro_actual_partido", JSON.stringify(borradorCruzeiro()));
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const vaciarPromesas = async (vueltas = 40) => {
    await act(async () => {
      for (let i = 0; i < vueltas; i += 1) await Promise.resolve();
    });
  };

  const montar = async (props = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App intro={false} {...props} />);
    });
    await act(async () => Promise.resolve());
    await act(async () => vi.runOnlyPendingTimers());
    await vaciarPromesas();
  };

  const boton = (texto) =>
    Array.from(contenedor.querySelectorAll("button")).find((b) => b.textContent.includes(texto));

  const guardar = async () => {
    await act(async () => {
      boton("Guardar partido").click();
      for (let i = 0; i < 20; i += 1) await Promise.resolve();
    });
    await vaciarPromesas(20);
  };

  const escribir = async (elemento, valor) => {
    const poner = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    await act(async () => {
      poner.call(elemento, valor);
      elemento.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  const escribirGolesRival = async (valor) =>
    escribir(contenedor.querySelectorAll(".resultado-marcador input")[1], valor);

  const irA = async (etiqueta) => {
    const destino = Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find((b) =>
      b.textContent.includes(etiqueta),
    );
    await act(async () => destino.click());
  };

  const borrador = () => JSON.parse(localStorage.getItem("registro_actual_partido")).registro;
  const cola = (equipo = "eq-1") => JSON.parse(localStorage.getItem(`registros_sin_sincronizar:${equipo}`) || "[]");

  // ------------------------------------------------------------------ 1 --
  test("un guardado viejo que quedó en la cola no pisa el guardado final del mismo partido", async () => {
    await montar();

    // Entretiempo: 1-0 y la base no contesta → queda en la cola del celular.
    db.errorGuardado = { message: "sin señal" };
    await guardar();
    expect(cola()).toHaveLength(1);

    // Final: 1-2 y vuelve la señal.
    await escribirGolesRival("2");
    db.errorGuardado = null;
    await guardar();

    expect(db.filas).toHaveLength(1);
    expect(db.filas[0].resultado).toBe("1-2");
    expect(cola()).toHaveLength(0);
  });

  test("tampoco lo pisa si el guardado viejo ya tenía el número de fila", async () => {
    await montar();

    // Entretiempo con señal: 1-0 queda en la base y el borrador sabe su fila.
    await guardar();
    expect(db.filas).toHaveLength(1);
    const id = db.filas[0].id;
    expect(borrador().idSupabase).toBe(id);

    // Minuto 70 sin señal: 1-1 queda en la cola, con el número de fila.
    await escribirGolesRival("1");
    db.errorGuardado = { message: "sin señal" };
    await guardar();
    expect(cola()).toHaveLength(1);

    // Final con señal: 1-2.
    await escribirGolesRival("2");
    db.errorGuardado = null;
    await guardar();

    expect(db.filas).toHaveLength(1);
    expect(db.filas[0].resultado).toBe("1-2");
    expect(cola()).toHaveLength(0);
  });

  test("cuando la cola sube sola, el borrador se entera del número de fila y el próximo guardado no pregunta", async () => {
    await montar();
    db.errorGuardado = { message: "sin señal" };
    await guardar();
    db.errorGuardado = null;

    // Vuelve la señal: el pendiente sube solo.
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await vaciarPromesas();
    await vaciarPromesas();

    expect(db.filas).toHaveLength(1);
    expect(borrador().idSupabase).toBe(db.filas[0].id);

    await escribirGolesRival("2");
    await guardar();
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(db.filas).toHaveLength(1);
    expect(db.filas[0].resultado).toBe("1-2");
  });

  // ------------------------------------------------------------------ 2 --
  test("un partido que se guarda sin señal mientras se suben los pendientes no se pierde de la cola", async () => {
    // Un pendiente de ayer (Flamengo). La base responde, pero lenta.
    localStorage.setItem(
      "registros_sin_sincronizar:eq-1",
      JSON.stringify([{ fecha: "2026-09-07", rival: "Flamengo", resultado: "2-2", sinSincronizar: true }]),
    );
    db.retenerRival = "Flamengo";
    await montar(); // arranca la carga y queda subiendo Flamengo

    // Mientras tanto se guarda el partido de hoy (Cruzeiro) y ese pedido falla.
    db.fallarRival = "Cruzeiro";
    await guardar();
    await act(async () => vi.advanceTimersByTime(10000));
    await vaciarPromesas();
    expect(cola().map((p) => p.rival)).toContain("Cruzeiro");

    // Termina de subir Flamengo.
    await act(async () => {
      db.soltar?.();
    });
    await vaciarPromesas();
    await vaciarPromesas();

    expect(cola().map((p) => p.rival)).toEqual(["Cruzeiro"]);
    expect(db.filas.map((f) => f.rival)).toEqual(["Flamengo"]);
  });
});
