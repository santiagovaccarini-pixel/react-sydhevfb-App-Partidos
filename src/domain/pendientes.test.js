import { describe, expect, it } from "vitest";
import {
  borradorRecibeId,
  comoPendiente,
  esVersionDelPartido,
  identidadPendiente,
  quitarSubidos,
  sigueEnLaCola,
  sinVersionesDelPartido,
} from "./pendientes.js";

describe("la cola de pendientes", () => {
  it("cada entrada lleva su número y queda marcada sin sincronizar", () => {
    const uno = comoPendiente({ fecha: "2026-09-08", rival: "Cruzeiro" });
    const otro = comoPendiente({ fecha: "2026-09-08", rival: "Cruzeiro" });
    expect(uno.sinSincronizar).toBe(true);
    expect(uno.idPendiente).toBeTruthy();
    expect(identidadPendiente(uno)).not.toBe(identidadPendiente(otro));
  });

  it("al terminar de subir saca solo lo subido, aunque se haya guardado otro en el medio", () => {
    const flamengo = comoPendiente({ fecha: "2026-09-07", rival: "Flamengo" });
    const cruzeiro = comoPendiente({ fecha: "2026-09-08", rival: "Cruzeiro" });
    // Se leyó [flamengo], se subió, y mientras tanto entró cruzeiro.
    const releida = [cruzeiro, flamengo];
    expect(quitarSubidos(releida, [identidadPendiente(flamengo)])).toEqual([cruzeiro]);
  });

  it("una versión nueva del mismo partido guardada durante la subida no se va con la vieja", () => {
    const vieja = comoPendiente({ fecha: "2026-09-08", rival: "Cruzeiro", resultado: "1-0" });
    const nueva = comoPendiente({ fecha: "2026-09-08", rival: "Cruzeiro", resultado: "1-2" });
    expect(quitarSubidos([nueva], [identidadPendiente(vieja)])).toEqual([nueva]);
    expect(sigueEnLaCola([nueva], vieja)).toBe(false);
    expect(sigueEnLaCola([nueva], nueva)).toBe(true);
  });

  it("las entradas de antes, sin número, se reconocen por su contenido", () => {
    const vieja = { fecha: "2026-09-07", rival: "Flamengo", sinSincronizar: true };
    const releida = JSON.parse(JSON.stringify([vieja]));
    expect(sigueEnLaCola(releida, vieja)).toBe(true);
    expect(quitarSubidos(releida, [identidadPendiente(vieja)])).toEqual([]);
  });
});

describe("lo que se guardó en la base reemplaza a sus versiones de la cola", () => {
  const guardado = { fecha: "2026-09-08", rival: "Cruzeiro", resultado: "1-2" };

  it("la misma fecha y rival es el mismo partido (sin importar mayúsculas ni acentos)", () => {
    expect(esVersionDelPartido({ fecha: "2026-09-08", rival: " cruzeiro " }, guardado)).toBe(true);
    expect(esVersionDelPartido({ fecha: "2026-09-07", rival: "Cruzeiro" }, guardado)).toBe(false);
    expect(esVersionDelPartido({ fecha: "2026-09-08", rival: "Santos" }, guardado)).toBe(false);
  });

  it("la misma fila también", () => {
    expect(esVersionDelPartido({ fecha: "2026-09-08", rival: "Cruzeiro EC", idSupabase: 9 }, guardado, 9)).toBe(true);
    expect(esVersionDelPartido({ fecha: "2026-09-08", rival: "Cruzeiro EC", idSupabase: 8 }, guardado, 9)).toBe(false);
  });

  it("los otros partidos de la cola se quedan", () => {
    const cola = [
      { fecha: "2026-09-08", rival: "Cruzeiro", resultado: "1-0" },
      { fecha: "2026-09-07", rival: "Flamengo", resultado: "2-2" },
    ];
    expect(sinVersionesDelPartido(cola, guardado, 100).map((p) => p.rival)).toEqual(["Flamengo"]);
  });

  it("con lo que había en la cola al empezar a escribir, una versión que entró después se queda", () => {
    // El 1-1 estaba en la cola; el 1-2 lo dejó en el celular otro Guardar
    // que esperó a este y no llegó a tiempo: es más nuevo.
    const vieja = comoPendiente({ fecha: "2026-09-08", rival: "Cruzeiro", resultado: "1-1" });
    const nueva = comoPendiente({ fecha: "2026-09-08", rival: "Cruzeiro", resultado: "1-2" });
    const anteriores = new Set([identidadPendiente(vieja)]);
    expect(sinVersionesDelPartido([nueva, vieja], guardado, 100, anteriores)).toEqual([nueva]);
  });
});

describe("el borrador se entera del número de fila de su pendiente", () => {
  const pendiente = { fecha: "2026-09-08", rival: "Cruzeiro", idLocal: "a" };

  it("si es el mismo partido y todavía no tiene número", () => {
    expect(borradorRecibeId({ fecha: "2026-09-08", rival: "Cruzeiro", idLocal: "a" }, pendiente)).toBe(true);
    // Un pendiente de antes de esta versión no sabe de qué borrador salió.
    expect(borradorRecibeId({ fecha: "2026-09-08", rival: "Cruzeiro", idLocal: "b" }, { fecha: "2026-09-08", rival: "Cruzeiro" })).toBe(true);
  });

  it("no si ya tiene uno, si es otro partido o si es otro borrador", () => {
    expect(borradorRecibeId({ fecha: "2026-09-08", rival: "Cruzeiro", idSupabase: 3 }, pendiente)).toBe(false);
    expect(borradorRecibeId({ fecha: "2026-09-08", rival: "Santos", idLocal: "a" }, pendiente)).toBe(false);
    expect(borradorRecibeId({ fecha: "2026-09-08", rival: "Cruzeiro", idLocal: "b" }, pendiente)).toBe(false);
  });
});
