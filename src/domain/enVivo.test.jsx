import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Realtime de mentira: guarda los canales, lo que escuchan y deja mandar cambios.
const realtime = vi.hoisted(() => ({ canales: [], quitados: [] }));
vi.mock("../supabase.js", () => ({
  supabase: {
    channel: (nombre) => {
      const canal = {
        nombre,
        escuchas: [],
        on(tipo, filtro, alLlegar) {
          canal.escuchas.push({ tipo, filtro, alLlegar });
          return canal;
        },
        subscribe(alCambiarEstado) {
          canal.estado = alCambiarEstado;
          alCambiarEstado("SUBSCRIBED");
          return canal;
        },
      };
      realtime.canales.push(canal);
      return canal;
    },
    removeChannel: (canal) => realtime.quitados.push(canal),
  },
}));

import { enVivo, useEnVivo } from "./enVivo.js";

const Pantalla = (props) => {
  useEnVivo(props);
  return null;
};

describe("useEnVivo: lo nuevo de otros, sin recargar", () => {
  let contenedor;
  let raiz;
  beforeEach(() => {
    vi.useFakeTimers();
    enVivo.prendido = true;
    realtime.canales = [];
    realtime.quitados = [];
    contenedor = document.createElement("div");
    raiz = createRoot(contenedor);
  });
  afterEach(async () => {
    await act(async () => raiz.unmount());
    enVivo.prendido = false;
    vi.useRealTimers();
  });
  const montar = (props) => act(async () => raiz.render(<Pantalla {...props} />));
  const llega = (tabla, evento = "INSERT") =>
    act(async () => {
      const escucha = realtime.canales.at(-1).escuchas.find((una) => una.filtro.table === tabla && (evento === "DELETE" ? una.filtro.event === "DELETE" : una.filtro.event === "*"));
      escucha.alLlegar({ eventType: evento, ...(evento === "DELETE" ? { old: { id: 7 } } : {}) });
    });

  test("escucha sus tablas, solo las filas de su club, y vuelve a leer una sola vez después de varios cambios", async () => {
    const alCambiar = vi.fn();
    await montar({ nombre: "lesiones", tablas: ["lesiones", "jugadores"], equipoId: "eq-1", alCambiar });
    const [canal] = realtime.canales;
    expect(canal.nombre).toBe("en-vivo:lesiones:eq-1");
    expect(canal.escuchas.map((una) => [una.tipo, una.filtro])).toEqual([
      ["postgres_changes", { event: "*", schema: "public", table: "lesiones", filter: "equipo_id=eq.eq-1" }],
      // Los borrados no se pueden filtrar por club: se escuchan todos.
      ["postgres_changes", { event: "DELETE", schema: "public", table: "lesiones" }],
      ["postgres_changes", { event: "*", schema: "public", table: "jugadores", filter: "equipo_id=eq.eq-1" }],
      ["postgres_changes", { event: "DELETE", schema: "public", table: "jugadores" }],
    ]);
    // Un pegado de muchas filas: se lee una vez, al terminar.
    await llega("lesiones");
    await llega("lesiones", "UPDATE");
    await llega("jugadores", "DELETE");
    expect(alCambiar).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(900));
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });

  test("las lecturas van de a una: lo que cambia mientras se lee se lee otra vez al terminar", async () => {
    const pendientes = [];
    const alCambiar = vi.fn(() => new Promise((terminar) => pendientes.push(terminar)));
    await montar({ nombre: "evaluaciones", tablas: ["evaluaciones"], equipoId: "eq-1", alCambiar });
    await llega("evaluaciones");
    await act(async () => vi.advanceTimersByTime(900));
    expect(alCambiar).toHaveBeenCalledTimes(1);
    // Mientras lee, llegan dos cambios más: no arranca otra lectura encima.
    await llega("evaluaciones", "UPDATE");
    await act(async () => vi.advanceTimersByTime(900));
    await llega("evaluaciones", "DELETE");
    await act(async () => vi.advanceTimersByTime(900));
    expect(alCambiar).toHaveBeenCalledTimes(1);
    // Al terminar, lee una vez más (con lo de recién).
    await act(async () => pendientes[0]());
    expect(alCambiar).toHaveBeenCalledTimes(2);
    await act(async () => pendientes[1]());
    await act(async () => vi.advanceTimersByTime(900));
    expect(alCambiar).toHaveBeenCalledTimes(2);
  });

  test("al volver la conexión después de un corte, lee (pudo haber cambios en el medio)", async () => {
    const alCambiar = vi.fn();
    await montar({ nombre: "notas", tablas: ["notas"], equipoId: "eq-1", alCambiar });
    // La primera conexión no lee (la pantalla ya leyó al abrir).
    await act(async () => vi.advanceTimersByTime(900));
    expect(alCambiar).not.toHaveBeenCalled();
    await act(async () => {
      realtime.canales[0].estado("CHANNEL_ERROR");
      realtime.canales[0].estado("SUBSCRIBED");
    });
    await act(async () => vi.advanceTimersByTime(900));
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });

  test("quien ya se fue del club (solo lectura), sin club o sin Realtime: no escucha nada", async () => {
    const alCambiar = vi.fn();
    await montar({ nombre: "lesiones", tablas: ["lesiones"], equipoId: "eq-1", activo: false, alCambiar });
    await montar({ nombre: "lesiones", tablas: ["lesiones"], equipoId: null, alCambiar });
    expect(realtime.canales).toHaveLength(0);
    enVivo.prendido = false;
    await montar({ nombre: "lesiones", tablas: ["lesiones"], equipoId: "eq-1", alCambiar });
    expect(realtime.canales).toHaveLength(0);
  });

  test("al salir de la pantalla (o cambiar de club) deja de escuchar, y lo que estaba por leer no se lee", async () => {
    const alCambiar = vi.fn();
    await montar({ nombre: "gps", tablas: ["gps"], equipoId: "eq-1", alCambiar });
    await llega("gps");
    await montar({ nombre: "gps", tablas: ["gps"], equipoId: "eq-2", alCambiar });
    expect(realtime.quitados.map((canal) => canal.nombre)).toEqual(["en-vivo:gps:eq-1"]);
    expect(realtime.canales.at(-1).nombre).toBe("en-vivo:gps:eq-2");
    await act(async () => vi.advanceTimersByTime(900));
    expect(alCambiar).not.toHaveBeenCalled();
  });
});
