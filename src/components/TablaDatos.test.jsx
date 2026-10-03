import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TablaDatos } from "./TablaDatos.jsx";
import { fijarIdiomaParaPruebas } from "../idioma/index.js";

const columnas = [
  { clave: "nombre", titulo: "Nombre", tipo: "texto", editable: true },
  { clave: "edad", titulo: "Edad", tipo: "calculado", editable: false },
  { clave: "pie", titulo: "Pie", tipo: "lista", editable: true, opciones: [{ valor: "direito", etiqueta: "Derecho" }, { valor: "esquerdo", etiqueta: "Izquierdo" }] },
];
const filas = [
  { id: 1, valores: { nombre: "HULK", edad: 40, pie: "esquerdo" }, textos: { nombre: "HULK", edad: "40 años", pie: "Izquierdo" } },
  { id: 2, valores: { nombre: "SCARPA", edad: 33, pie: "" }, textos: { nombre: "SCARPA", edad: "33 años", pie: "" } },
];

const celda = (contenedor, fila, columna) => contenedor.querySelectorAll("tbody tr")[fila].querySelectorAll("td")[columna];
const cabeceras = (contenedor) => [...contenedor.querySelectorAll("th[data-columna]")].map((th) => th.textContent);
const tocar = async (elemento) => act(async () => elemento.click());
const puntero = (elemento, tipo, extra = {}) => {
  const evento = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: extra.x ?? 0, clientY: extra.y ?? 0, button: 0 });
  Object.defineProperty(evento, "pointerType", { value: extra.pointerType || "mouse" });
  Object.defineProperty(evento, "pointerId", { value: 1 });
  return act(async () => elemento.dispatchEvent(evento));
};

describe("la tabla estilo Excel", () => {
  let contenedor;
  let raiz;
  let editados;
  let pegados;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    localStorage.clear();
    editados = [];
    pegados = [];
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    contenedor.remove();
    delete document.elementFromPoint;
    vi.useRealTimers();
  });

  const montar = async (extra = {}) =>
    act(async () =>
      raiz.render(
        <TablaDatos
          id="prueba"
          columnas={columnas}
          filas={filas}
          onEditar={async (filaId, clave, valor) => {
            editados.push({ filaId, clave, valor });
            return {};
          }}
          onPegar={async (cambios) => {
            pegados.push(...cambios);
            return { hechos: cambios.length };
          }}
          {...extra}
        />,
      ),
    );

  test("se eligen celdas, se editan tocando dos veces y las listas abren la hoja de opciones", async () => {
    await montar();
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);
    expect(contenedor.textContent).toContain("Tocá una celda para empezar");

    await tocar(celda(contenedor, 0, 0));
    expect(celda(contenedor, 0, 0).classList.contains("activa")).toBe(true);
    expect(contenedor.textContent).toContain("1 celda elegida");
    // El segundo toque edita.
    await tocar(celda(contenedor, 0, 0));
    const input = celda(contenedor, 0, 0).querySelector("input");
    expect(input.value).toBe("HULK");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "HULK PARAÍBA");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(editados).toEqual([{ filaId: 1, clave: "nombre", valor: "HULK PARAÍBA" }]);

    // Una columna calculada no se edita.
    await tocar(celda(contenedor, 0, 1));
    await tocar(celda(contenedor, 0, 1));
    expect(celda(contenedor, 0, 1).querySelector("input")).toBeNull();

    // Una lista abre la hoja de opciones.
    await tocar(celda(contenedor, 1, 2));
    await tocar(celda(contenedor, 1, 2));
    const opcion = [...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Derecho");
    await tocar(opcion);
    expect(editados.at(-1)).toEqual({ filaId: 2, clave: "pie", valor: "direito" });
  });

  test("copia la selección como texto con tabulaciones y pega lo que llega", async () => {
    await montar();
    const escrito = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (texto) => escrito.push(texto), readText: async () => "SCARPA\t33\tDerecho" } });
    // El número de fila elige la fila entera.
    await tocar(contenedor.querySelectorAll("tbody th")[0]);
    expect(contenedor.textContent).toContain("3 celdas elegidas");
    await tocar([...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === "Copiar"));
    expect(escrito).toEqual(["HULK\t40 años\tIzquierdo"]);
    expect(contenedor.textContent).toContain("3 celdas copiadas");

    await tocar(celda(contenedor, 1, 0));
    await tocar([...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === "Pegar"));
    expect(pegados).toEqual([
      { filaId: 2, clave: "nombre", valor: "SCARPA" },
      { filaId: 2, clave: "pie", valor: "direito" },
    ]);
    expect(contenedor.textContent).toContain("2 celdas pegadas · 1 no se entendió o no se puede cambiar");

    // Ctrl+V dentro de la tabla manda el evento de pegado del navegador.
    pegados.length = 0;
    await tocar(celda(contenedor, 0, 2));
    const marco = contenedor.querySelector(".tabla-datos-marco");
    const evento = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(evento, "clipboardData", { value: { getData: () => "Derecho\nIzquierdo" } });
    await act(async () => marco.dispatchEvent(evento));
    expect(pegados).toEqual([
      { filaId: 1, clave: "pie", valor: "direito" },
      { filaId: 2, clave: "pie", valor: "esquerdo" },
    ]);
    delete navigator.clipboard;
  });

  test("las cabeceras se arrastran con el mouse y el orden queda guardado", async () => {
    await montar();
    const [primera, , tercera] = contenedor.querySelectorAll("th[data-columna]");
    document.elementFromPoint = () => tercera;
    await puntero(primera, "pointerdown", { x: 10, y: 10 });
    await puntero(primera, "pointermove", { x: 40, y: 10 });
    expect(contenedor.querySelector("table").classList.contains("arrastrando")).toBe(true);
    await puntero(primera, "pointermove", { x: 200, y: 10 });
    expect(tercera.classList.contains("destino")).toBe(true);
    await puntero(primera, "pointerup", { x: 200, y: 10 });
    expect(cabeceras(contenedor)).toEqual(["Edad", "Pie", "Nombre"]);
    expect(JSON.parse(localStorage.getItem("tabla_columnas:prueba"))).toEqual(["edad", "pie", "nombre"]);
    // Las celdas siguen a su columna.
    expect(celda(contenedor, 0, 2).textContent).toBe("HULK");
  });

  test("arriba de las cabeceras va la fila de los grupos, y cada cabecera filtra y ordena como Excel", async () => {
    const conGrupos = columnas.map((columna, i) => ({ ...columna, grupo: i < 2 ? "jugador" : "cuerpo", grupoTitulo: i < 2 ? "Jugador" : "Cuerpo" }));
    await montar({ columnas: conGrupos });
    const grupos = [...contenedor.querySelectorAll(".tabla-datos-grupos th")];
    expect(grupos.map((th) => th.textContent)).toEqual(["", "Jugador", "Cuerpo"]);
    expect(grupos.map((th) => th.getAttribute("colspan"))).toEqual([null, "2", "1"]);
    // El botón del filtro no arrastra la cabecera ni cambia su nombre.
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);

    const filtro = (columna) => contenedor.querySelector(`.tabla-datos-filtro[aria-label="Filtrar u ordenar ${columna}"]`);
    const valores = () => [...contenedor.querySelectorAll(".tabla-datos-valores label")];
    const nombres = () => [...contenedor.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent);
    const botonDe = (texto) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === texto);

    // Ordenar: la celda elegida sigue a su fila.
    await tocar(celda(contenedor, 1, 0));
    await tocar(filtro("Nombre"));
    await tocar([...contenedor.querySelectorAll(".chip-criterio")].find((b) => b.textContent === "De mayor a menor"));
    expect(nombres()).toEqual(["SCARPA", "HULK"]);
    expect(celda(contenedor, 0, 0).classList.contains("activa")).toBe(true);

    // Filtrar: las vacías también son un valor.
    await tocar(filtro("Pie"));
    expect(valores().map((label) => label.textContent)).toEqual(["Izquierdo1", "(Vacías)1"]);
    await tocar(botonDe("Ninguno"));
    await tocar(valores()[1].querySelector("input"));
    await tocar(botonDe("Aplicar"));
    expect(nombres()).toEqual(["SCARPA"]);
    expect(contenedor.textContent).toContain("Mostrando 1 de 2");

    // Lo que se pega cae en las filas que se ven.
    const marco = contenedor.querySelector(".tabla-datos-marco");
    await tocar(celda(contenedor, 0, 2));
    const evento = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(evento, "clipboardData", { value: { getData: () => "Derecho" } });
    await act(async () => marco.dispatchEvent(evento));
    expect(pegados).toEqual([{ filaId: 2, clave: "pie", valor: "direito" }]);

    // Un filtro que no deja nada lo dice; "Quitar filtros" vuelve a todas.
    await tocar(filtro("Nombre"));
    await act(async () => {
      const buscador = contenedor.querySelector(".tabla-datos-buscar-valor");
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(buscador, "zzz");
      buscador.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(contenedor.textContent).toContain("Ningún valor coincide.");
    await tocar(botonDe("Quitar filtro"));
    await tocar(botonDe("Quitar filtros"));
    expect(nombres()).toEqual(["HULK", "SCARPA"]);
    expect(contenedor.textContent).not.toContain("Mostrando");
  });

  test("lo que se edita va a su fila aunque la tabla se reordene mientras tanto", async () => {
    await montar();
    // Se empieza a editar el nombre de SCARPA (segunda fila).
    await tocar(celda(contenedor, 1, 0));
    await tocar(celda(contenedor, 1, 0));
    expect(celda(contenedor, 1, 0).querySelector("input").value).toBe("SCARPA");
    // Mientras tanto la tabla cambia de orden (otro guardado que terminó).
    await act(async () =>
      raiz.render(
        <TablaDatos
          id="prueba"
          columnas={columnas}
          filas={[filas[1], filas[0]]}
          onEditar={async (filaId, clave, valor) => {
            editados.push({ filaId, clave, valor });
            return {};
          }}
        />,
      ),
    );
    // La edición siguió a SCARPA, que ahora es la primera fila.
    expect(celda(contenedor, 1, 0).querySelector("input")).toBeNull();
    const input = celda(contenedor, 0, 0).querySelector("input");
    expect(input.value).toBe("SCARPA");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "SCARPA 2");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(editados).toEqual([{ filaId: 2, clave: "nombre", valor: "SCARPA 2" }]);
  });

  test("las teclas en el botón de filtro no mueven ni editan la celda elegida", async () => {
    await montar();
    await tocar(celda(contenedor, 0, 0));
    const filtro = contenedor.querySelector('.tabla-datos-filtro[aria-label="Filtrar u ordenar Pie"]');
    await act(async () => filtro.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await act(async () => filtro.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(celda(contenedor, 0, 0).querySelector("input")).toBeNull();
    expect(celda(contenedor, 0, 0).classList.contains("activa")).toBe(true);
    // En la tabla misma, Enter sí edita.
    const marco = contenedor.querySelector(".tabla-datos-marco");
    await act(async () => marco.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(celda(contenedor, 0, 0).querySelector("input")).toBeTruthy();
  });

  test("con nombre para recordar, los filtros siguen al volver a la tabla", async () => {
    await montar({ recordar: "prueba-memoria" });
    await tocar(contenedor.querySelector('.tabla-datos-filtro[aria-label="Filtrar u ordenar Nombre"]'));
    await tocar([...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === "Ninguno"));
    await tocar(contenedor.querySelectorAll(".tabla-datos-valores input")[0]);
    await tocar([...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === "Aplicar"));
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(1);
    // Se va de la tabla (se abre una ficha) y se vuelve.
    await act(async () => raiz.render(<div />));
    await montar({ recordar: "prueba-memoria" });
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(contenedor.textContent).toContain("Mostrando 1 de 2");
    // Sin nombre para recordar, empieza sin filtros.
    await act(async () => raiz.render(<div />));
    await montar();
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  test("en el celular hay que mantener apretada la cabecera; moverse antes es desplazar", async () => {
    vi.useFakeTimers();
    await montar();
    const [primera, segunda] = contenedor.querySelectorAll("th[data-columna]");
    document.elementFromPoint = () => segunda;
    // Un toque corto que se mueve: nada.
    await puntero(primera, "pointerdown", { x: 10, y: 10, pointerType: "touch" });
    await puntero(primera, "pointermove", { x: 60, y: 10, pointerType: "touch" });
    await act(async () => vi.advanceTimersByTime(500));
    expect(contenedor.querySelector("table").classList.contains("arrastrando")).toBe(false);
    await puntero(primera, "pointerup", { x: 60, y: 10, pointerType: "touch" });
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);
    // Mantener apretado y después mover: se arrastra.
    await puntero(primera, "pointerdown", { x: 10, y: 10, pointerType: "touch" });
    await act(async () => vi.advanceTimersByTime(500));
    expect(contenedor.querySelector("table").classList.contains("arrastrando")).toBe(true);
    await puntero(primera, "pointermove", { x: 90, y: 10, pointerType: "touch" });
    await puntero(primera, "pointerup", { x: 90, y: 10, pointerType: "touch" });
    expect(cabeceras(contenedor)).toEqual(["Edad", "Nombre", "Pie"]);
  });

  test("una casilla se marca y se desmarca con un toque, se ve al toque y no se guarda dos veces", async () => {
    const conCasilla = [...columnas, { clave: "actual", titulo: "Actual", tipo: "casilla", editable: true }];
    const filasConCasilla = filas.map((fila, i) => ({ ...fila, valores: { ...fila.valores, actual: i === 0 }, textos: { ...fila.textos, actual: i === 0 ? "Sí" : "No" } }));
    let terminar;
    await montar({
      columnas: conCasilla,
      filas: filasConCasilla,
      onEditar: (filaId, clave, valor) => {
        editados.push({ filaId, clave, valor });
        return new Promise((resolver) => {
          terminar = () => resolver({});
        });
      },
    });
    const casilla = (fila) => celda(contenedor, fila, 3).querySelector("input[type=checkbox]");
    expect(casilla(0).checked).toBe(true);
    expect(casilla(1).checked).toBe(false);

    // Un toque: se ve desmarcada mientras se guarda, y otro toque no manda nada.
    await tocar(casilla(0));
    expect(casilla(0).checked).toBe(false);
    expect(celda(contenedor, 0, 3).classList.contains("activa")).toBe(true);
    await tocar(casilla(0));
    expect(editados).toEqual([{ filaId: 1, clave: "actual", valor: false }]);
    await act(async () => terminar());

    // Con el teclado: la barra espaciadora (o Enter) en la celda elegida.
    const marco = contenedor.querySelector(".tabla-datos-marco");
    await tocar(celda(contenedor, 1, 3));
    await act(async () => marco.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })));
    expect(editados.at(-1)).toEqual({ filaId: 2, clave: "actual", valor: true });
    await act(async () => terminar());

    // Lo pegado: Sí / No en los dos idiomas; una celda vacía no la toca.
    const pegar = async (texto) => {
      const evento = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(evento, "clipboardData", { value: { getData: () => texto } });
      await act(async () => marco.dispatchEvent(evento));
    };
    await tocar(celda(contenedor, 0, 3));
    await pegar("Não\nSim");
    expect(pegados).toEqual([
      { filaId: 1, clave: "actual", valor: false },
      { filaId: 2, clave: "actual", valor: true },
    ]);
  });

  test("con Mayúscula, un toque en la casilla extiende la selección y no la cambia", async () => {
    const conCasilla = [...columnas, { clave: "actual", titulo: "Actual", tipo: "casilla", editable: true }];
    await montar({ columnas: conCasilla, filas: filas.map((fila) => ({ ...fila, valores: { ...fila.valores, actual: true }, textos: { ...fila.textos, actual: "Sí" } })) });
    await tocar(celda(contenedor, 0, 0));
    const casilla = celda(contenedor, 1, 3).querySelector("input[type=checkbox]");
    await act(async () => casilla.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true })));
    expect(casilla.checked).toBe(true);
    expect(editados).toEqual([]);
    expect(contenedor.querySelectorAll("td.elegida").length).toBeGreaterThan(1);
  });

  test("sin permiso, la casilla se ve pero no se cambia", async () => {
    const conCasilla = [...columnas, { clave: "actual", titulo: "Actual", tipo: "casilla", editable: false }];
    await montar({ columnas: conCasilla, filas: filas.map((fila) => ({ ...fila, valores: { ...fila.valores, actual: true }, textos: { ...fila.textos, actual: "Sí" } })) });
    const casilla = celda(contenedor, 0, 3).querySelector("input[type=checkbox]");
    expect(casilla.disabled).toBe(true);
    await tocar(celda(contenedor, 0, 3));
    await tocar(celda(contenedor, 0, 3));
    expect(editados).toEqual([]);
  });
});
