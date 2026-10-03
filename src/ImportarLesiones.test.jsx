import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fijarIdiomaParaPruebas } from "./idioma/index.js";

// Lo que se manda a la base, en memoria.
const base = vi.hoisted(() => ({ cargadas: [] }));
vi.mock("./domain/lesionesDb.js", () => ({
  importarLesion: async (equipoId, lesion) => {
    base.cargadas.push(lesion);
    return { lesion: { ...lesion, id: `les-${base.cargadas.length}` }, error: "" };
  },
}));

const { default: ImportarLesiones } = await import("./ImportarLesiones.jsx");

const PLANTEL = [
  { id: 1, nombre: "Ana Uno" },
  { id: 2, nombre: "Joao Silva" },
  { id: 3, nombre: "João Silva" },
];
const CABECERAS = ["N° de Caso", "Nome e Sobrenome", "Tipo de lesão", "Parte do Corpo Lesionada", "Lado", "Data de Início da Lesão (DD/MM/YYYY)"];
const PEGADO = [
  CABECERAS.join("\t"),
  ["1", "Ana Uno", "LESÃO MUSCULAR GRAU 1 A", "COXA", "Direito", "21/01/2026"].join("\t"),
  // Fuera de Datos básicos.
  ["2", "Persona De Afuera", "ENTORSE/LESÃO LIGAMENTAR", "JOELHO", "Esquerdo", "05/02/2026"].join("\t"),
  // Se parece a dos jugadores: no se adivina.
  ["3", "JOAO  SILVA.", "ENTORSE/LESÃO LIGAMENTAR", "JOELHO", "Direito", "06/02/2026"].join("\t"),
  // Un caso sin terminar: sin fecha.
  ["4", "Ana Uno", "", "", "", ""].join("\t"),
].join("\n");

describe("pegar lesiones: nombres fuera de Datos básicos y casos sin fecha", () => {
  let contenedor;
  let raiz;
  let listo;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    base.cargadas = [];
    listo = null;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    contenedor.remove();
  });

  const montar = () =>
    act(async () =>
      raiz.render(
        <ImportarLesiones
          equipoId="eq-1"
          plantel={PLANTEL}
          lesiones={[]}
          config={null}
          onVolver={() => {}}
          onRecargar={async () => {}}
          onListo={(resultado) => {
            listo = resultado;
          }}
        />,
      ),
    );
  const pegar = async (texto) => {
    const area = contenedor.querySelector("textarea");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(area, texto);
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const tocar = (elemento) => act(async () => elemento.click());
  const destinos = () => [...contenedor.querySelectorAll(".datos-importar-destino")].map((destino) => destino.textContent);

  test("se elige qué hacer con cada nombre de afuera, y las sin fecha entran para completar", async () => {
    await montar();
    await pegar(PEGADO);
    expect(contenedor.querySelector(".datos-importar-resumen").textContent).toBe("2 para cargar · 1 sin fecha de inicio · 0 ya están en la app · 2 para elegir");
    expect(destinos()).toEqual(["Se carga", "No está en Datos básicos", "¿Quién es?", "Se carga"]);
    expect(contenedor.textContent).toContain("Se carga sin Fecha de inicio de la lesión, Tipo de lesión, Parte del cuerpo lesionada, Lado: queda para completar.");

    // "Guardar igual" es solo para el de afuera: el dudoso se elige aparte.
    const todos = contenedor.querySelector(".datos-importar-elegir-todos button");
    expect(todos.textContent).toBe("Guardar igual la que no está en Datos básicos");
    await tocar(todos);
    expect(destinos()).toEqual(["Se carga", "Se guarda con este nombre", "¿Quién es?", "Se carga"]);

    // El dudoso: es uno de los dos.
    await tocar(contenedor.querySelectorAll(".datos-importar-destino")[2]);
    await tocar([...document.querySelectorAll(".opcion-hoja")].find((opcion) => opcion.textContent.trim() === "João Silva"));
    expect(destinos()[2]).toBe("Es João Silva");

    await tocar(contenedor.querySelector(".acciones-dobles .boton-principal"));
    expect(listo).toEqual({ cargadas: 4 });
    expect(base.cargadas.map((lesion) => [lesion.numero_caso, lesion.jugador_id, lesion.persona, lesion.fecha_lesion])).toEqual([
      [1, 1, null, "2026-01-21"],
      [2, null, "Persona De Afuera", "2026-02-05"],
      [3, 3, null, "2026-02-06"],
      [4, 1, null, null],
    ]);
  });

  test("un nombre de afuera también se puede no cargar", async () => {
    await montar();
    await pegar(PEGADO);
    await tocar(contenedor.querySelectorAll(".datos-importar-destino")[1]);
    await tocar([...document.querySelectorAll(".opcion-hoja")].find((opcion) => opcion.textContent.trim() === "No cargar"));
    expect(destinos()[1]).toBe("No se carga");
    expect(contenedor.querySelector(".acciones-dobles .boton-principal").textContent).toBe("Cargar 2 lesiones");
  });
});
