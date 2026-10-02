import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const plantelInicial = () => [
  { id: 7, nombre: "HULK", roles: [], puestos: ["DEL"], categoria: "profissional", fecha_nacimiento: "1986-07-25", pie_dominante: "esquerdo", posicion: "delantero_central", foto_url: "" },
  { id: 8, nombre: "SCARPA", roles: [], puestos: ["VOL"], categoria: "", fecha_nacimiento: "", pie_dominante: "", posicion: "", foto_url: "" },
];
const registro = vi.hoisted(() => ({ guardados: [], agregados: [], borrados: [], plantel: [], fallarAgregar: "", equipo: { id: "eq-1", nombre: "Atlético Mineiro" } }));

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => registro.equipo,
  cargarEquipos: async () => ({ equipos: [] }),
  elegirEquipoInicial: () => null,
  guardarEquipoElegido: () => {},
  esElCam: (nombre) => nombre === "Atlético Mineiro",
}));
// La base de mentira: el plantel cambia con lo que se agrega y se guarda.
vi.mock("./domain/lesionesDb.js", () => ({
  // Como la de verdad: ordenado por nombre.
  cargarPlantelLesiones: async () => ({
    plantel: registro.plantel.map((jugador) => ({ ...jugador })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    error: "",
  }),
  leerConfig: async () => ({ config: { campos: {}, listas: {} }, error: "" }),
  guardarDatosJugador: async (id, cambios) => {
    registro.guardados.push({ id, ...cambios });
    const jugador = registro.plantel.find((uno) => uno.id === id);
    Object.assign(jugador, cambios);
    return { jugador: { ...jugador }, error: "" };
  },
  agregarJugadorBasico: async (equipoId, nombre) => {
    registro.agregados.push({ equipoId, nombre });
    if (registro.fallarAgregar && nombre === registro.fallarAgregar) return { error: "Ese jugador ya está en la lista." };
    const jugador = { id: 9 + registro.agregados.length - 1, nombre: nombre.trim().toUpperCase(), roles: [], puestos: [], categoria: "", fecha_nacimiento: "", pie_dominante: "", posicion: "", foto_url: "" };
    registro.plantel.push(jugador);
    return { jugador: { ...jugador }, error: "" };
  },
  quitarJugadorBasico: async (id) => {
    registro.borrados.push(id);
    return { error: "" };
  },
}));

const { default: DatosBasicos } = await import("./DatosBasicos.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");

const texto = (contenedor) => contenedor.textContent;
const boton = (contenedor, etiqueta) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === etiqueta);
const tocar = async (elemento) => {
  expect(elemento, "no se encontró el botón").toBeTruthy();
  await act(async () => elemento.click());
};
const escribir = async (input, valor) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value").set.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const celda = (contenedor, fila, columna) => contenedor.querySelectorAll("tbody tr")[fila].querySelectorAll("td")[columna];

describe("el módulo Datos básicos", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    localStorage.clear();
    registro.equipo = { id: "eq-1", nombre: "Atlético Mineiro" };
    registro.plantel = plantelInicial();
    registro.fallarAgregar = "";
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    contenedor.remove();
    ["guardados", "agregados", "borrados"].forEach((clave) => {
      registro[clave].length = 0;
    });
  });

  const montar = async () => {
    await act(async () => raiz.render(<DatosBasicos onVolver={() => {}} />));
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
  };

  test("muestra los jugadores en la tabla estilo Excel con los datos que piden los módulos", async () => {
    await montar();
    expect(texto(contenedor)).toContain("2 jugadores");
    const cabeceras = [...contenedor.querySelectorAll("th[data-columna]")].map((th) => th.textContent);
    expect(cabeceras).toEqual(["Nombre y apellido", "Categoría", "Fecha de nacimiento", "Edad", "Pie dominante", "Posición", "Foto (enlace)"]);
    const hulk = contenedor.querySelector("tbody tr");
    expect(hulk.textContent).toContain("HULK");
    expect(hulk.textContent).toContain("25/07/1986");
    expect(hulk.textContent).toContain("Izquierdo");
    expect(hulk.textContent).toMatch(/\d\d años/);
    // La edad se calcula sola.
    expect(celda(contenedor, 0, 3).classList.contains("fija")).toBe(true);

    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    expect(texto(contenedor)).toContain("2 jogadores");
    expect(contenedor.querySelector("tbody tr").textContent).toContain("Esquerdo");
  });

  test("quien ya se fue del club ve a los jugadores y no puede cambiar nada", async () => {
    registro.equipo = { id: "eq-1", nombre: "Atlético Mineiro", hasta: "2026-09-25" };
    await montar();
    expect(texto(contenedor)).toContain("Dejaste este club el 25/09/2026.");
    expect(texto(contenedor)).toContain("HULK");
    expect(boton(contenedor, "Agregar jugador")).toBeUndefined();
    expect(boton(contenedor, "Borrar fila")).toBeUndefined();
    expect(boton(contenedor, "Pegar")).toBeUndefined();
    expect(boton(contenedor, "Pegar desde Excel")).toBeUndefined();
    expect(boton(contenedor, "Copiar")).toBeTruthy();
    expect([...contenedor.querySelectorAll("th[data-columna]")].every((th) => th.classList.contains("fija"))).toBe(true);
    await tocar(celda(contenedor, 1, 4));
    await tocar(celda(contenedor, 1, 4));
    expect(contenedor.querySelector(".opcion-hoja")).toBeNull();
    expect(registro.guardados).toEqual([]);
  });

  test("se cambia el pie dominante desde la celda, se agrega un jugador y se borra otro", async () => {
    await montar();
    // Dos toques en una celda de lista abren la hoja de opciones.
    await tocar(celda(contenedor, 1, 4));
    await tocar(celda(contenedor, 1, 4));
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Derecho"));
    expect(registro.guardados).toEqual([{ id: 8, pie_dominante: "direito" }]);
    expect(celda(contenedor, 1, 4).textContent).toBe("Derecho");

    await escribir(contenedor.querySelector(".datos-agregar input"), "lemos");
    await tocar(boton(contenedor, "Agregar jugador"));
    await act(async () => Promise.resolve());
    expect(registro.agregados).toEqual([{ equipoId: "eq-1", nombre: "lemos" }]);
    expect(texto(contenedor)).toContain("Jugador agregado");
    expect(texto(contenedor)).toContain("3 jugadores");
    expect([...contenedor.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent)).toEqual(["HULK", "LEMOS", "SCARPA"]);

    await tocar(contenedor.querySelectorAll("tbody th")[1]);
    await tocar(boton(contenedor, "Borrar fila"));
    expect(texto(contenedor)).toContain("¿Borrar al jugador?");
    expect(texto(contenedor)).toContain("LEMOS sale de la lista");
    await tocar(boton(contenedor, "Sí, borrar"));
    await act(async () => Promise.resolve());
    expect(registro.borrados).toEqual([9]);
    expect(texto(contenedor)).toContain("2 jugadores");
  });

  test("se pega la hoja Datos Básicos del Excel: antes de cargar se ve qué pasa con cada jugador", async () => {
    await montar();
    await tocar(boton(contenedor, "Pegar desde Excel"));
    expect(texto(contenedor)).toContain("copiá la tabla de Datos Básicos junto con la fila de cabeceras");
    expect(boton(contenedor, "Nada para cargar").disabled).toBe(true);
    const textarea = contenedor.querySelector(".datos-importar-pegado textarea");

    // Sin cabeceras no se adivina.
    await escribir(textarea, "Ana Uno\tProfissional");
    expect(texto(contenedor)).toContain("No encontré la fila de cabeceras");

    await escribir(
      textarea,
      [
        "Voltar ao menu inicial\tNome e Sobrenome\tCategoria\tD. Nac. (DD/MM/AAAA)\tP. Dominante\tPosicao\tLinks das fotos",
        "\tHulk\tProfissional\t25/07/1986\tEsquerdo\tDELANTERO CENTRAL\t",
        "\tGustavo Scarpa\tProfissional\t05/01/1994\tEsquerdo\tVOLANTE OFENSIVO\thttps://fotos.example/scarpa.jpg",
        "\tLemos Nuevo\tSub-20\t10/03/2006\tDireito\tCARRILERO\t",
        "\tOtro Nuevo\tProfissional\t\t\t\t",
      ].join("\n"),
    );
    expect(texto(contenedor)).toContain("4 jugadores en lo pegado");
    expect(texto(contenedor)).toContain("2 nuevos · 1 con cambios · 1 sin cambios");
    const filas = () => [...contenedor.querySelectorAll(".datos-importar-lista li")];
    const destinos = () => filas().map((li) => li.querySelector(".datos-importar-destino").textContent);
    // HULK ya tiene todo; SCARPA se sugiere por el apellido; los otros dos son nuevos.
    expect(destinos()).toEqual(["Es HULK", "¿Es SCARPA?", "Jugador nuevo", "Jugador nuevo"]);
    expect(filas()[0].textContent).toContain("Ya tiene estos datos.");
    expect(filas()[1].textContent).toContain("Cambia: Categoría, Fecha de nacimiento, Pie dominante, Posición, Foto (enlace)");
    expect(filas()[2].textContent).toContain("Trae: Categoría, Fecha de nacimiento, Pie dominante");
    expect(filas()[2].textContent).toContain("«CARRILERO» no se entendió en Posición: queda como está.");
    expect(boton(contenedor, "Cargar 3 jugadores")).toBeTruthy();

    // Quién es cada fila se corrige a mano: la última no se carga.
    await tocar(filas()[3].querySelector(".datos-importar-destino"));
    expect(texto(contenedor)).toContain("¿Quién es Otro Nuevo en la app?");
    // HULK y SCARPA ya son de otras filas: no se ofrecen.
    expect([...contenedor.querySelectorAll(".opcion-hoja")].map((b) => b.textContent.trim())).toEqual(["Jugador nuevo", "No cargar"]);
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "No cargar"));
    expect(destinos()[3]).toBe("No cargar");

    await tocar(boton(contenedor, "Cargar 2 jugadores"));
    await act(async () => Promise.resolve());
    expect(registro.agregados).toEqual([{ equipoId: "eq-1", nombre: "Lemos Nuevo" }]);
    expect(registro.guardados).toEqual([
      { id: 8, categoria: "profissional", fecha_nacimiento: "1994-01-05", pie_dominante: "esquerdo", posicion: "volante_ofensivo", foto_url: "https://fotos.example/scarpa.jpg" },
      { id: 9, categoria: "sub20", fecha_nacimiento: "2006-03-10", pie_dominante: "direito" },
    ]);
    // Termina en la tabla, con el plantel nuevo.
    expect(texto(contenedor)).toContain("Listo: 1 nuevo y 1 actualizado.");
    expect(texto(contenedor)).toContain("3 jugadores");
    expect([...contenedor.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent)).toEqual(["HULK", "LEMOS NUEVO", "SCARPA"]);
  });

  test("si una fila no se puede cargar, se dice cuál y por qué, y el resto queda cargado", async () => {
    registro.fallarAgregar = "Ana Rara";
    await montar();
    await tocar(boton(contenedor, "Pegar desde Excel"));
    await escribir(contenedor.querySelector(".datos-importar-pegado textarea"), "Nome e Sobrenome\tCategoria\nAna Rara\tSub-20\nBea Bien\tSub-20");
    await tocar(boton(contenedor, "Cargar 2 jugadores"));
    await act(async () => Promise.resolve());
    expect(texto(contenedor)).toContain("1 jugador no se pudo cargar:");
    expect(texto(contenedor)).toContain("Ana Rara: Ese jugador ya está en la lista.");
    // Bea ya está: si se vuelve a cargar, solo queda Ana.
    expect([...contenedor.querySelectorAll(".datos-importar-destino")].map((b) => b.textContent)).toEqual(["Jugador nuevo", "Es BEA BIEN"]);
    expect(boton(contenedor, "Cargar 1 jugador")).toBeTruthy();
    await tocar(boton(contenedor, "Volver"));
    expect(texto(contenedor)).toContain("3 jugadores");
  });
});
