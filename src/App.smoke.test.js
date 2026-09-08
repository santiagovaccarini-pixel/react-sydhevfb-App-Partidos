import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

const doblesSupabase = vi.hoisted(() => ({
  insertar: vi.fn(),
  // Con error, la app cae al respaldo local: es la forma de sembrar el
  // historial sin tener que armar filas con los nombres de columna de la base.
  errorHistorial: null,
}));

vi.mock("./supabase.js", () => ({
  supabase: {
    from: () => {
      const consulta = {
        select: () => consulta,
        order: async () => ({ data: [], error: doblesSupabase.errorHistorial }),
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
    doblesSupabase.errorHistorial = null;
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

    // Guardar el partido vive en la cabecera, no en una barra flotante.
    expect(
      contenedor.querySelector(".cabecera-tablero .boton-guardar-cabecera")
        .textContent,
    ).toContain("Guardar partido");
    expect(contenedor.querySelector(".barra-guardado")).toBeNull();
    expect(contenedor.textContent).toContain("Atlético Mineiro");

    // El marcador 1-0 deja el cero como marca de fondo, para reemplazarlo
    // escribiendo sin tener que borrarlo antes.
    const marcadorInicial = contenedor.querySelectorAll(
      ".resultado-marcador input",
    );
    expect(marcadorInicial[0].value).toBe("1");
    expect(marcadorInicial[1].value).toBe("");
    expect(marcadorInicial[1].placeholder).toBe("0");
    expect(
      contenedor.querySelectorAll(".navegacion-movil button"),
    ).toHaveLength(3);
    expect(
      contenedor.querySelectorAll(".navegacion-escritorio button"),
    ).toHaveLength(3);

    const accionPeriodo = contenedor.querySelector(".accion-periodo");
    await act(async () => accionPeriodo.click());
    expect(accionPeriodo.textContent).toContain("Finalizar PT");
    expect(
      contenedor.querySelector(".selector-periodos p").textContent,
    ).not.toContain("--:--");

    const botonVar = Array.from(
      contenedor.querySelectorAll(".acciones-rapidas button"),
    ).find((boton) => boton.textContent.includes("Iniciar VAR"));
    await act(async () => botonVar.click());
    expect(botonVar.textContent).toContain("Finalizar VAR");

    const marcador = contenedor.querySelectorAll(".resultado-marcador input");
    expect(marcador[0].value).toBe("1");
    expect(marcador[1].value).toBe("");

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

  test("muestra los cinco cambios y el botón Cambio lleva a Atlético", async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App />);
    });
    await act(async () => Promise.resolve());

    expect(contenedor.querySelectorAll(".ranura-cambio")).toHaveLength(5);

    // El manejador de "Cambio" no debe romperse: si lanza, React lo atrapa y
    // la pantalla queda igual, así que hay que escuchar el error del navegador.
    const fallos = [];
    const anotarFallo = (evento) =>
      fallos.push(evento.message || String(evento));
    window.addEventListener("error", anotarFallo);

    const botonCambio = contenedor.querySelector(
      ".acciones-rapidas .accion-cambio",
    );
    await act(async () => botonCambio.click());

    window.removeEventListener("error", anotarFallo);
    expect(fallos).toEqual([]);

    const pestanaAtletico = contenedor.querySelector(".selector-equipo button");
    expect(pestanaAtletico.getAttribute("aria-selected")).toBe("true");
    expect(contenedor.querySelectorAll(".ranura-cambio")).toHaveLength(5);
  });

  test("permite reanudar el período si se finalizó por error", async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App />);
    });
    await act(async () => Promise.resolve());

    const accionPeriodo = contenedor.querySelector(".accion-periodo");
    await act(async () => accionPeriodo.click());
    await act(async () => accionPeriodo.click());

    expect(accionPeriodo.textContent).toContain("Reanudar PT");
    expect(accionPeriodo.disabled).toBe(false);
    expect(accionPeriodo.className).toContain("finalizar");

    await act(async () => accionPeriodo.click());

    expect(accionPeriodo.textContent).toContain("Finalizar PT");
    expect(
      contenedor.querySelector(".selector-periodos p").textContent,
    ).toContain("en curso");
  });

  test("ir a Registros y volver a Formación no inventa un partido", async () => {
    localStorage.removeItem("registro_actual_partido");

    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App />);
    });
    await act(async () => Promise.resolve());

    const destinos = () =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).map(
        (boton) => boton.textContent.trim(),
      );
    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );

    expect(destinos()).toEqual(["Formación", "Registros"]);

    await act(async () => irA("Registros").click());
    await act(async () => irA("Formación").click());

    expect(destinos()).toEqual(["Formación", "Registros"]);
    expect(contenedor.textContent).not.toContain("Volver al partido");
  });

  test("Limpiar confirma en una hoja propia, no en el confirm del navegador", async () => {
    const confirmNativo = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmNativo);

    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App />);
    });
    await act(async () => Promise.resolve());

    const limpiar = contenedor.querySelector(".boton-limpiar-cabecera");
    const hoja = () => contenedor.querySelector(".hoja-confirmar");
    const rival = () =>
      contenedor.querySelector(".equipo-visitante strong").textContent;

    expect(hoja()).toBeNull();

    await act(async () => limpiar.click());

    expect(hoja()).not.toBeNull();
    expect(confirmNativo).not.toHaveBeenCalled();
    expect(contenedor.querySelector(".detalle-hoja").textContent).toContain(
      "Cruzeiro",
    );

    // Cancelar cierra la hoja sin tocar el partido.
    await act(async () => contenedor.querySelector(".boton-cancelar-hoja").click());

    expect(hoja()).toBeNull();
    expect(rival()).toBe("Cruzeiro");

    // Confirmar sí lo borra y deja de haber partido en curso.
    await act(async () => limpiar.click());
    await act(async () =>
      contenedor.querySelector(".boton-confirmar-hoja").click(),
    );

    expect(hoja()).toBeNull();
    expect(
      contenedor.querySelectorAll(".navegacion-movil button"),
    ).toHaveLength(2);
  });

  test("la pantalla principal muestra el enfrentamiento y lleva al partido", async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App />);
    });
    await act(async () => Promise.resolve());

    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );

    await act(async () => irA("Formación").click());

    // Los dos clubes, con la fecha en texto y no en formato de máquina.
    const lados = contenedor.querySelectorAll(".lado-enfrentamiento strong");
    expect(lados).toHaveLength(2);
    expect(lados[0].textContent).toContain("Atlético");
    expect(lados[1].textContent).toBe("Cruzeiro");
    expect(contenedor.querySelector(".fecha-hero").textContent).toContain(
      "septiembre",
    );

    // Sin escudo remoto todavía, quedan los dibujados: nunca un hueco vacío.
    expect(
      contenedor.querySelectorAll(".lado-enfrentamiento svg").length,
    ).toBe(2);

    // La tarjeta de partido en curso no es el cartel verde de actualización.
    const enCurso = contenedor.querySelector(".tarjeta-en-curso");
    expect(enCurso.textContent).toContain("vs Cruzeiro");
    expect(contenedor.querySelector(".bloque-version-app")).not.toBeNull();

    await act(async () => enCurso.click());
    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();
  });

  test("sin rival cargado la pantalla principal no queda rota", async () => {
    localStorage.removeItem("registro_actual_partido");

    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App />);
    });
    await act(async () => Promise.resolve());

    expect(contenedor.querySelector(".tarjeta-en-curso")).toBeNull();
    expect(
      contenedor.querySelectorAll(".lado-enfrentamiento strong")[1].textContent,
    ).toBe("Elegí el rival");
    // El pie del escudo aparece recién cuando hay algo que informar.
    expect(contenedor.querySelector(".pie-escudo")).toBeNull();
    expect(contenedor.querySelector("#campo-rival-inicio").value).toBe("");
  });

  test("los escudos aparecen en el marcador y en la lista de registros", async () => {
    doblesSupabase.errorHistorial = { message: "sin conexión en la prueba" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(
      "backup_registros_partidos",
      JSON.stringify([
        { fecha: "2026-09-01", rival: "Flamengo", resultado: "2-2" },
      ]),
    );

    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App />);
    });
    await act(async () => Promise.resolve());

    // Marcador: los dos clubes tienen escudo, sea real o dibujado.
    const marcador = contenedor.querySelectorAll(".equipo-marcador");
    expect(marcador).toHaveLength(2);
    marcador.forEach((equipo) =>
      expect(
        equipo.querySelector(".escudo-cam, .escudo-rival, .escudo-club"),
      ).not.toBeNull(),
    );

    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );
    await act(async () => irA("Registros").click());

    // Lista de registros: la fila de afuera también los trae.
    const fila = contenedor.querySelector(".enfrentamiento-registro");
    expect(fila).not.toBeNull();
    expect(
      fila.querySelectorAll(".escudo-cam, .escudo-rival, .escudo-club"),
    ).toHaveLength(2);
    expect(fila.textContent).toContain("Flamengo");
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
