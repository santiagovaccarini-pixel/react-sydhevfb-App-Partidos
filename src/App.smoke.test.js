import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

const doblesSupabase = vi.hoisted(() => ({
  insertar: vi.fn(),
}));

vi.mock("./supabase.js", () => ({
  supabase: {
    from: () => {
      const consulta = {
        select: () => consulta,
        order: async () => ({ data: [], error: null }),
        insert: (filas) => {
          doblesSupabase.insertar(filas);
          return {
            select: async () => ({ data: [{ id: 7 }], error: null }),
          };
        },
        update: () => consulta,
        delete: () => consulta,
        eq: () => consulta,
        in: async () => ({ data: [], error: null }),
      };
      return consulta;
    },
  },
}));

describe("interfaz operativa", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 8, 21, 25, 34));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ version: "2026.08.12.1" }),
      })),
    );
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("scrollTo", vi.fn());
    doblesSupabase.insertar.mockClear();
    localStorage.clear();
    localStorage.setItem(
      "registro_actual_partido",
      JSON.stringify({
        version: 2,
        registro: {
          fecha: "2026-09-08",
          rival: "Cruzeiro",
          resultado: "1-0",
          formacion: {
            titulares: ["ALONSO", "SCARPA"],
            convocados: ["BERNARD"],
          },
        },
      }),
    );
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    contenedor.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("renderiza PC y móvil y registra acciones rápidas sin perder datos", async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App />);
    });
    await act(async () => Promise.resolve());

    expect(contenedor.textContent).toContain("Registro de partido");
    expect(contenedor.textContent).toContain("Atlético Mineiro");
    expect(contenedor.textContent).toContain("Cruzeiro");
    expect(
      contenedor.querySelectorAll(".navegacion-movil button"),
    ).toHaveLength(3);
    expect(
      contenedor.querySelectorAll(".navegacion-escritorio button"),
    ).toHaveLength(3);

    const accionPeriodo = contenedor.querySelector(".accion-periodo");
    await act(async () => accionPeriodo.click());
    expect(accionPeriodo.textContent).toContain("Finalizar PT");
    expect(contenedor.textContent).toContain("Inicio de PT");

    const botonVar = Array.from(
      contenedor.querySelectorAll(".acciones-rapidas button"),
    ).find((boton) => boton.textContent.includes("Iniciar VAR"));
    await act(async () => botonVar.click());
    expect(contenedor.textContent).toContain("Inicio de VAR 1");

    const marcador = contenedor.querySelectorAll(".resultado-marcador input");
    expect(marcador[0].value).toBe("1");
    expect(marcador[1].value).toBe("0");

    const selectorHora = contenedor.querySelector(
      ".contenido-ajustes-periodo .selector-tiempo-disparador",
    );
    await act(async () => selectorHora.click());
    const opcionHora = contenedor.querySelector(
      '.contenido-ajustes-periodo [aria-label="Hora"] [data-valor="21"]',
    );
    await act(async () => opcionHora.click());

    expect(
      contenedor.querySelector(
        ".contenido-ajustes-periodo .selector-tiempo-disparador",
      ),
    ).toBe(selectorHora);
    expect(
      contenedor.querySelector(
        ".contenido-ajustes-periodo .selector-tiempo-panel",
      ),
    ).not.toBeNull();
  });

  test("bloquea el doble guardado y confirma la sincronización", async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App />);
    });
    await act(async () => Promise.resolve());

    const guardar = Array.from(contenedor.querySelectorAll("button")).find(
      (boton) => boton.textContent.includes("Guardar partido"),
    );

    await act(async () => {
      guardar.click();
      guardar.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(doblesSupabase.insertar).toHaveBeenCalledTimes(1);
    expect(contenedor.textContent).toContain("Partido guardado con éxito");
  });
});
