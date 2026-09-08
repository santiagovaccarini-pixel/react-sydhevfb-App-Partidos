import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import AuthGate from "./AuthGate";

const dobles = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
  renderApp: vi.fn(),
  callbackAuth: null,
  unsubscribe: vi.fn(),
}));

vi.mock("../App", () => ({
  default: ({ session }) => {
    dobles.renderApp(session);
    return <div>Aplicación privada</div>;
  },
}));

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      getSession: dobles.getSession,
      onAuthStateChange: dobles.onAuthStateChange,
      signInWithOtp: dobles.signInWithOtp,
      signOut: dobles.signOut,
    },
  },
}));

describe("acceso a la aplicación", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    dobles.getSession.mockReset();
    dobles.onAuthStateChange.mockReset();
    dobles.signInWithOtp.mockReset();
    dobles.signOut.mockReset();
    dobles.renderApp.mockReset();
    dobles.unsubscribe.mockReset();
    dobles.callbackAuth = null;

    dobles.onAuthStateChange.mockImplementation((callback) => {
      dobles.callbackAuth = callback;
      return { data: { subscription: { unsubscribe: dobles.unsubscribe } } };
    });
    dobles.signInWithOtp.mockResolvedValue({ error: null });
    dobles.signOut.mockResolvedValue({ error: null });

    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    contenedor.remove();
  });

  const renderizar = async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<AuthGate />);
      await Promise.resolve();
    });
  };

  test("no monta la app sin sesión y permite solicitar un enlace", async () => {
    dobles.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await renderizar();

    expect(contenedor.textContent).toContain("Entrá a tu cuenta");
    expect(dobles.renderApp).not.toHaveBeenCalled();

    const input = contenedor.querySelector('input[type="email"]');
    await act(async () => {
      input.value = "  Usuario@Ejemplo.com ";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      contenedor
        .querySelector("form")
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await Promise.resolve();
    });

    expect(dobles.signInWithOtp).toHaveBeenCalledWith({
      email: "usuario@ejemplo.com",
      options: {
        emailRedirectTo: "http://localhost:3000/",
        shouldCreateUser: true,
      },
    });
    expect(contenedor.textContent).toContain("Te enviamos un enlace");
  });

  test("monta la app únicamente después de autenticar", async () => {
    const session = {
      user: { id: "usuario-1", email: "usuario@ejemplo.com" },
    };
    dobles.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    await renderizar();

    expect(contenedor.textContent).toContain("Aplicación privada");
    expect(contenedor.textContent).toContain("usuario@ejemplo.com");
    expect(dobles.renderApp).toHaveBeenCalledWith(session);
  });

  test("cierra la sesión desde la barra de cuenta", async () => {
    dobles.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "usuario-1", email: "usuario@ejemplo.com" },
        },
      },
      error: null,
    });

    await renderizar();

    const boton = Array.from(contenedor.querySelectorAll("button")).find(
      (item) => item.textContent === "Cerrar sesión",
    );
    await act(async () => {
      boton.click();
      await Promise.resolve();
    });

    expect(dobles.signOut).toHaveBeenCalledTimes(1);
  });
});
