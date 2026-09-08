import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HoraActual, RelojPartido } from "./MatchClock";

describe("relojes aislados", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 8, 21, 25, 34));
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    contenedor.remove();
    vi.useRealTimers();
  });

  test("actualiza el reloj de transmisión sin depender del formulario", async () => {
    const referencia = Date.now();

    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(
        <RelojPartido
          periodo="ST"
          modoTiempo="transmision"
          referencia={referencia}
          baseSegundos={45 * 60}
          inicio="045:00"
          final=""
        />,
      );
    });

    expect(contenedor.textContent).toContain("45:00");
    expect(contenedor.textContent).toContain("En vivo");

    await act(async () => vi.advanceTimersByTime(2000));
    expect(contenedor.textContent).toContain("45:02");
  });

  test("libera sus intervalos al desmontarse", async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<HoraActual />);
    });

    expect(vi.getTimerCount()).toBe(1);
    await act(async () => raiz.unmount());
    raiz = null;
    expect(vi.getTimerCount()).toBe(0);
  });
});
