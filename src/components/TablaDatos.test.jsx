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
  Object.defineProperty(evento, "pointerId", { value: extra.pointerId ?? 1 });
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

  test("arriba dice cuántas filas hay y la tabla no lleva una columna que las cuente", async () => {
    await montar();
    expect(contenedor.querySelector(".tabla-datos-cuantas").textContent).toBe("2 filas");
    // Cada fila tiene solo sus celdas: nada de número de fila.
    expect(contenedor.querySelectorAll("thead tr.tabla-datos-cabeceras th")).toHaveLength(3);
    expect([...contenedor.querySelectorAll("tbody tr")].every((tr) => tr.children.length === 3 && !tr.querySelector("th"))).toBe(true);
    expect(contenedor.textContent).not.toContain("#");
    // Una sola fila, en singular; sin filas, cero.
    await montar({ filas: [filas[0]] });
    expect(contenedor.querySelector(".tabla-datos-cuantas").textContent).toBe("1 fila");
    await montar({ filas: [] });
    expect(contenedor.querySelector(".tabla-datos-cuantas").textContent).toBe("0 filas");
    expect(contenedor.querySelector(".tabla-datos-vacia").getAttribute("colspan")).toBe("3");
    // En portugués.
    fijarIdiomaParaPruebas("pt-BR");
    await montar();
    expect(contenedor.querySelector(".tabla-datos-cuantas").textContent).toBe("2 linhas");
  });

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
    // Mayúscula + espacio elige la fila entera, como en Excel.
    await tocar(celda(contenedor, 0, 1));
    await act(async () => contenedor.querySelector(".tabla-datos-marco").dispatchEvent(new KeyboardEvent("keydown", { key: " ", shiftKey: true, bubbles: true })));
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
    expect(grupos.map((th) => th.textContent)).toEqual(["Jugador", "Cuerpo"]);
    expect(grupos.map((th) => th.getAttribute("colspan"))).toEqual(["2", "1"]);
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
    // Arriba, cuántas se ven de cuántas.
    const cuantas = () => contenedor.querySelector(".tabla-datos-cuantas").textContent;
    expect(cuantas()).toBe("1 de 2 filas");

    // Al volver a abrir, lo elegido sigue marcado; con todo marcado, el filtro se quita.
    const marcados = () => valores().map((label) => [label.textContent, label.querySelector("input").checked]);
    await tocar(filtro("Pie"));
    expect(marcados()).toEqual([
      ["Izquierdo1", false],
      ["(Vacías)1", true],
    ]);
    await tocar(botonDe("Todos"));
    await tocar(botonDe("Aplicar"));
    expect(nombres()).toEqual(["SCARPA", "HULK"]);
    expect(cuantas()).toBe("2 filas");
    // De nuevo solo las vacías, para lo que sigue.
    await tocar(filtro("Pie"));
    await tocar(botonDe("Ninguno"));
    await tocar(valores()[1].querySelector("input"));
    await tocar(botonDe("Aplicar"));
    expect(nombres()).toEqual(["SCARPA"]);

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
    expect(cuantas()).toBe("2 filas");
  });

  test("una fila que se pide a la vista se ve aunque el filtro la deje afuera, hasta que se cambian los filtros", async () => {
    await montar();
    const filtro = (columna) => contenedor.querySelector(`.tabla-datos-filtro[aria-label="Filtrar u ordenar ${columna}"]`);
    const botonDe = (texto) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === texto);
    const nombres = () => [...contenedor.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent);
    const soloVacias = async () => {
      await tocar(filtro("Pie"));
      await tocar(botonDe("Ninguno"));
      await tocar([...contenedor.querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent.startsWith("(Vacías)")).querySelector("input"));
      await tocar(botonDe("Aplicar"));
    };
    // Solo las de Pie vacío: HULK (izquierdo) queda afuera.
    await soloVacias();
    expect(nombres()).toEqual(["SCARPA"]);
    // Se pide a la vista (como una recién agregada): se ve con el filtro puesto.
    await montar({ siempreAVista: [1] });
    expect(nombres()).toEqual(["HULK", "SCARPA"]);
    // Al cambiar los filtros vuelven a mandar los filtros, aunque se siga pidiendo.
    await tocar(botonDe("Quitar filtros"));
    await soloVacias();
    expect(nombres()).toEqual(["SCARPA"]);
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
    expect(contenedor.querySelector(".tabla-datos-cuantas").textContent).toBe("1 de 2 filas");
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

  test("«Borrar fila» borra todas las filas de lo elegido: con Shift, varias", async () => {
    const borradas = [];
    const tres = [...filas, { id: 3, valores: { nombre: "ALAN", edad: 25, pie: "" }, textos: { nombre: "ALAN", edad: "25 años", pie: "" } }];
    await montar({ filas: tres, onBorrarFilas: (ids) => borradas.push(ids) });
    const boton = () => [...contenedor.querySelectorAll("button")].find((uno) => uno.textContent.includes("Borrar"));
    expect(boton().textContent).toBe("Borrar fila");
    expect(boton().disabled).toBe(true);
    await tocar(celda(contenedor, 0, 1));
    expect(boton().textContent).toBe("Borrar fila");
    await tocar(boton());
    expect(borradas).toEqual([[1]]);
    // Con Shift, de la primera a la tercera (en el orden en que se ven).
    await act(async () => celda(contenedor, 2, 0).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true })));
    expect(boton().textContent).toBe("Borrar 3 filas");
    await tocar(boton());
    expect(borradas).toEqual([[1], [1, 2, 3]]);
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

  test("una fila apagada va en otro color, con la leyenda arriba; sin ninguna a la vista, la leyenda guarda su lugar", async () => {
    const leyenda = "En este color, los que ya no están";
    await montar({ leyenda, rotuloApagada: "Ya no está" });
    expect(contenedor.querySelector(".tabla-datos-leyenda").classList.contains("oculta")).toBe(true);
    // No se ve pero guarda su lugar (visibility, no display: la tabla no se corre).
    expect(getComputedStyle(contenedor.querySelector(".tabla-datos-leyenda")).visibility).toBe("hidden");
    expect(getComputedStyle(contenedor.querySelector(".tabla-datos-leyenda")).display).not.toBe("none");
    expect(contenedor.querySelectorAll("tbody tr.apagada")).toHaveLength(0);

    await montar({ leyenda, rotuloApagada: "Ya no está", filas: [filas[0], { ...filas[1], apagada: true }] });
    expect(contenedor.querySelector(".tabla-datos-leyenda").classList.contains("oculta")).toBe(false);
    expect(getComputedStyle(contenedor.querySelector(".tabla-datos-leyenda")).visibility).toBe("visible");
    expect(contenedor.querySelector(".tabla-datos-leyenda").textContent).toBe(leyenda);
    const [hulk, scarpa] = contenedor.querySelectorAll("tbody tr");
    expect(hulk.classList.contains("apagada")).toBe(false);
    expect(scarpa.classList.contains("apagada")).toBe(true);
    // Al pasar el mouse por la fila, lo dice.
    expect(scarpa.title).toBe("Ya no está");
    expect(hulk.title).toBe("");
    const fondo = (elemento) => getComputedStyle(elemento).backgroundColor;
    // Una celda fija (Edad) de la fila apagada va en su tono, distinto del de
    // una fija de una fila común. (jsdom no resuelve var(): el color de las
    // que se cambian se mira en el navegador.)
    expect(fondo(celda(contenedor, 1, 1))).toBe("rgb(219, 212, 201)");
    expect(fondo(celda(contenedor, 0, 1))).toBe("rgb(250, 250, 250)");
    // Elegida, la celda se ve elegida (no del color de la fila).
    await tocar(celda(contenedor, 1, 0));
    expect(celda(contenedor, 1, 0).classList.contains("elegida")).toBe(true);
    expect(fondo(celda(contenedor, 1, 0))).toBe("rgb(220, 252, 231)");
    expect(scarpa.classList.contains("activa")).toBe(true);

    // Un filtro que deja afuera a las apagadas: la leyenda no se ve (y no corre la tabla).
    await tocar(contenedor.querySelector('.tabla-datos-filtro[aria-label="Filtrar u ordenar Nombre"]'));
    await tocar([...document.querySelectorAll(".tabla-datos-todos button")].find((boton) => boton.textContent === "Ninguno"));
    await tocar([...document.querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent.startsWith("HULK")).querySelector("input"));
    await tocar([...document.querySelectorAll("button")].find((boton) => boton.textContent.trim() === "Aplicar"));
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(contenedor.querySelector(".tabla-datos-leyenda").classList.contains("oculta")).toBe(true);
  });

  test("las columnas fijas van primero, con su lugar, y no se arrastran ni reciben otra", async () => {
    localStorage.setItem("tabla_columnas:prueba", JSON.stringify(["pie", "edad", "nombre"]));
    await montar({ fijas: ["nombre"], columnas: [{ ...columnas[0], ancho: 150 }, columnas[1], columnas[2]] });
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Pie", "Edad"]);
    const [nombre, pie, edad] = contenedor.querySelectorAll("th[data-columna]");
    expect(nombre.classList.contains("inmovil")).toBe(true);
    // Su ancho, de borde a borde, y pegada al borde izquierdo (no hay número de fila).
    expect(contenedor.querySelector("table").style.getPropertyValue("--tabla-ancho-nombre")).toBe("150px");
    expect(nombre.style.width).toBe("var(--tabla-ancho-nombre)");
    expect(nombre.style.boxSizing).toBe("border-box");
    expect(nombre.style.left).toBe("0px");
    expect(celda(contenedor, 0, 0).style.width).toBe("var(--tabla-ancho-nombre)");
    expect(celda(contenedor, 0, 0).classList.contains("inmovil")).toBe(true);
    expect(celda(contenedor, 0, 1).classList.contains("inmovil")).toBe(false);
    // Arrastrar: apretar y mover dos veces (la primera arranca el arrastre).
    const arrastrar = async (desde) => {
      await puntero(desde, "pointerdown", { x: 10, y: 10 });
      await puntero(desde, "pointermove", { x: 40, y: 10 });
      await puntero(desde, "pointermove", { x: 200, y: 10 });
    };
    // Una fija no se arrastra.
    document.elementFromPoint = () => edad;
    await arrastrar(nombre);
    expect(contenedor.querySelector("table").classList.contains("arrastrando")).toBe(false);
    await puntero(nombre, "pointerup", { x: 200, y: 10 });
    // Ni recibe otra columna.
    document.elementFromPoint = () => nombre;
    await arrastrar(edad);
    expect(contenedor.querySelector("table").classList.contains("arrastrando")).toBe(true);
    expect(nombre.classList.contains("destino")).toBe(false);
    await puntero(edad, "pointerup", { x: 200, y: 10 });
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Pie", "Edad"]);
    // Las demás, sí.
    document.elementFromPoint = () => pie;
    await arrastrar(edad);
    expect(pie.classList.contains("destino")).toBe(true);
    await puntero(edad, "pointerup", { x: 200, y: 10 });
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);
    expect(JSON.parse(localStorage.getItem("tabla_columnas:prueba"))).toEqual(["edad", "pie", "nombre"]);
    expect(celda(contenedor, 0, 1).textContent).toBe("40 años");

    // Con dos fijas, la segunda queda a la derecha de la primera, con el
    // ancho que tenga esa (aunque se cambie a mano).
    await montar({ fijas: ["nombre", "edad"], columnas: [{ ...columnas[0], ancho: 150 }, { ...columnas[1], ancho: 90 }, columnas[2]] });
    const [, segunda] = contenedor.querySelectorAll("th[data-columna]");
    expect(segunda.style.left).toBe("calc(var(--tabla-ancho-nombre))");
    expect(segunda.classList.contains("ultima-inmovil")).toBe(true);
    expect(contenedor.querySelector("table").style.getPropertyValue("--tabla-ancho-edad")).toBe("90px");
  });

  const dobleClic = (elemento) => act(async () => elemento.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true })));

  test("dos clics en una cabecera la dejan fija (al final de las fijas) o la sueltan, y queda guardado en el aparato", async () => {
    // Santiago, 11/10: «si hago doble click en esa cabecera pasa a estar fija
    // y se recuerda por dispositivo».
    await montar({ fijas: ["nombre"], columnas: [{ ...columnas[0], ancho: 150 }, columnas[1], columnas[2]] });
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);
    let [, , pie] = contenedor.querySelectorAll("th[data-columna]");
    expect(pie.title).toBe("Pie\nDos clics: queda fija al correr la tabla");
    // Pie se fija: va después de Nombre y queda con el ancho que medía.
    pie.getBoundingClientRect = () => ({ width: 104, height: 30, top: 0, left: 0, right: 104, bottom: 30, x: 0, y: 0 });
    await dobleClic(pie);
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Pie", "Edad"]);
    const [, fijada] = contenedor.querySelectorAll("th[data-columna]");
    expect(fijada.classList.contains("inmovil")).toBe(true);
    expect(fijada.classList.contains("ultima-inmovil")).toBe(true);
    expect(fijada.style.left).toBe("calc(var(--tabla-ancho-nombre))");
    expect(contenedor.querySelector("table").style.getPropertyValue("--tabla-ancho-pie")).toBe("104px");
    expect(fijada.title).toBe("Pie\nDos clics: deja de estar fija");
    expect(contenedor.querySelector(".tabla-datos-estado").textContent).toContain("Pie queda fija");
    expect(JSON.parse(localStorage.getItem("tabla_fijas:prueba"))).toEqual(["nombre", "pie"]);
    expect(JSON.parse(localStorage.getItem("tabla_anchos:prueba"))).toEqual({ pie: 104 });

    // Al volver a abrir la tabla en este aparato, sigue así.
    await act(async () => raiz.unmount());
    raiz = createRoot(contenedor);
    await montar({ fijas: ["nombre"], columnas: [{ ...columnas[0], ancho: 150 }, columnas[1], columnas[2]] });
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Pie", "Edad"]);

    // Nombre (la de entrada) se suelta: vuelve a su lugar entre las demás.
    const [nombre] = contenedor.querySelectorAll("th[data-columna]");
    await dobleClic(nombre);
    expect(cabeceras(contenedor)).toEqual(["Pie", "Nombre", "Edad"]);
    expect(contenedor.querySelectorAll("th[data-columna]")[1].classList.contains("inmovil")).toBe(false);
    expect(contenedor.querySelector(".tabla-datos-estado").textContent).toContain("Nombre ya no está fija");
    expect(JSON.parse(localStorage.getItem("tabla_fijas:prueba"))).toEqual(["pie"]);
    // Y sin ninguna fija, todas corren.
    [pie] = contenedor.querySelectorAll("th[data-columna]");
    await dobleClic(pie);
    expect(contenedor.querySelectorAll("th.inmovil")).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem("tabla_fijas:prueba"))).toEqual([]);
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);
  });

  test("lo elegido es de cada tabla; dos clics en el filtro o en el borde no fijan nada", async () => {
    await montar();
    const [, edad] = contenedor.querySelectorAll("th[data-columna]");
    await dobleClic(edad.querySelector(".tabla-datos-filtro"));
    await dobleClic(edad.querySelector(".tabla-datos-borde"));
    expect(contenedor.querySelectorAll("th.inmovil")).toHaveLength(0);
    expect(localStorage.getItem("tabla_fijas:prueba")).toBeNull();
    await dobleClic(edad);
    expect(JSON.parse(localStorage.getItem("tabla_fijas:prueba"))).toEqual(["edad"]);
    // Otra tabla (otra base) sigue con las suyas.
    await act(async () => raiz.unmount());
    raiz = createRoot(contenedor);
    await montar({ id: "otra" });
    expect(contenedor.querySelectorAll("th.inmovil")).toHaveLength(0);
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);
  });

  // Un toque con el dedo (por defecto, quieto).
  const toque = async (elemento, { x = 10, y = 10, hastaX = x } = {}) => {
    await puntero(elemento, "pointerdown", { pointerType: "touch", x, y });
    await puntero(elemento, "pointerup", { pointerType: "touch", x: hastaX, y });
  };
  const comoCelular = () => {
    const consulta = { matches: false, oyentes: [], addEventListener: (tipo, fn) => consulta.oyentes.push(fn), removeEventListener: () => {} };
    window.matchMedia = vi.fn(() => consulta);
    return consulta;
  };
  const quietas = () => [...contenedor.querySelectorAll("th[data-columna].inmovil")].map((th) => th.textContent);

  test("en el celular, dos toques en una cabecera la dejan fija; las de entrada siguen corriendo con las demás", async () => {
    // Santiago, 11/10: «revisa que en celular cuando hago doble click sobre
    // una columna no se fija». El celular no avisa el doble clic: se cuentan
    // los dos toques.
    const consulta = comoCelular();
    try {
      await montar({ fijas: ["nombre"], columnas: [{ ...columnas[0], ancho: 150 }, columnas[1], columnas[2]] });
      expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 900px)");
      // Nombre (la de entrada) va primero, pero corre con las demás.
      expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);
      expect(quietas()).toEqual([]);

      // Un toque solo no fija nada; correr el dedo (desplazar la tabla), tampoco.
      let [, , pie] = contenedor.querySelectorAll("th[data-columna]");
      await toque(pie);
      expect(quietas()).toEqual([]);
      await toque(pie, { hastaX: 60 });
      await toque(pie, { hastaX: 60 });
      expect(quietas()).toEqual([]);

      // Dos toques: Pie queda fija y va primero (como las fijas en la compu).
      conAncho(pie, 104);
      await toque(pie);
      await toque(pie);
      expect(cabeceras(contenedor)).toEqual(["Pie", "Nombre", "Edad"]);
      expect(quietas()).toEqual(["Pie"]);
      const [fijada] = contenedor.querySelectorAll("th[data-columna]");
      expect(fijada.style.left).toBe("0px");
      expect(contenedor.querySelector("table").style.getPropertyValue("--tabla-ancho-pie")).toBe("104px");
      expect(contenedor.querySelector(".tabla-datos-estado").textContent).toContain("Pie queda fija");
      // Queda guardado aparte: las de la compu no se tocan.
      expect(JSON.parse(localStorage.getItem("tabla_fijas_celular:prueba"))).toEqual(["pie"]);
      expect(localStorage.getItem("tabla_fijas:prueba")).toBeNull();
      // Si el navegador avisa igual el doble clic, no se suelta de nuevo.
      await dobleClic(fijada);
      expect(quietas()).toEqual(["Pie"]);

      // Nombre, la de entrada, también se fija en el celular: después de Pie.
      const [, nombre] = contenedor.querySelectorAll("th[data-columna]");
      await toque(nombre);
      await toque(nombre);
      expect(cabeceras(contenedor)).toEqual(["Pie", "Nombre", "Edad"]);
      expect(quietas()).toEqual(["Pie", "Nombre"]);
      expect(contenedor.querySelectorAll("th[data-columna]")[1].style.left).toBe("calc(var(--tabla-ancho-pie))");

      // Al volver a abrir, sigue así; dos toques más la sueltan.
      await act(async () => raiz.unmount());
      raiz = createRoot(contenedor);
      await montar({ fijas: ["nombre"], columnas: [{ ...columnas[0], ancho: 150 }, columnas[1], columnas[2]] });
      expect(quietas()).toEqual(["Pie", "Nombre"]);
      [pie] = contenedor.querySelectorAll("th[data-columna]");
      await toque(pie);
      await toque(pie);
      expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);
      expect(quietas()).toEqual(["Nombre"]);
      expect(contenedor.querySelector(".tabla-datos-estado").textContent).toContain("Pie ya no está fija");
      expect(JSON.parse(localStorage.getItem("tabla_fijas_celular:prueba"))).toEqual(["nombre"]);
      expect(contenedor.querySelectorAll("th[data-columna]")[0].style.left).toBe("0px");

      // Al pasar a una pantalla grande (girar la tableta), van las de la compu.
      consulta.matches = true;
      await act(async () => consulta.oyentes.forEach((fn) => fn()));
      expect(quietas()).toEqual(["Nombre"]);
      expect(JSON.parse(localStorage.getItem("tabla_fijas_celular:prueba"))).toEqual(["nombre"]);
    } finally {
      delete window.matchMedia;
    }
  });

  test("si con otra fija casi no quedaría lugar para las demás columnas, no se fija y lo dice", async () => {
    await montar({ fijas: ["nombre"], columnas: [{ ...columnas[0], ancho: 150 }, columnas[1], columnas[2]] });
    // Una tabla de 300 px: con Nombre (150) y Pie (104) quedarían 46 px (tiene
    // que entrar al lado una columna de las más angostas, 56).
    Object.defineProperty(contenedor.querySelector(".tabla-datos-marco"), "clientWidth", { configurable: true, value: 300 });
    const [, , pie] = contenedor.querySelectorAll("th[data-columna]");
    conAncho(pie, 104);
    await dobleClic(pie);
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);
    expect(quietas()).toEqual(["Nombre"]);
    expect(contenedor.querySelector(".tabla-datos-estado").textContent).toContain("Pie no entra fija: soltá otra columna fija antes");
    expect(localStorage.getItem("tabla_fijas:prueba")).toBeNull();
    // Soltar una siempre se puede; con lugar, se fija.
    const [nombre] = contenedor.querySelectorAll("th[data-columna]");
    await dobleClic(nombre);
    expect(quietas()).toEqual([]);
    await dobleClic(contenedor.querySelectorAll("th[data-columna]")[2]);
    expect(quietas()).toEqual(["Pie"]);
  });

  // Medidas de mentira: jsdom no dibuja.
  const conAncho = (elemento, ancho) => {
    elemento.getBoundingClientRect = () => ({ width: ancho, height: 30, top: 0, left: 0, right: ancho, bottom: 30, x: 0, y: 0 });
  };

  test("el ancho de una columna se cambia arrastrando el borde de su cabecera y queda guardado", async () => {
    await montar();
    const tabla = () => contenedor.querySelector("table");
    const cabecera = () => contenedor.querySelectorAll("th[data-columna]")[0];
    const borde = () => cabecera().querySelector(".tabla-datos-borde");
    // Sin ancho elegido, la columna se acomoda a lo que tiene.
    expect(cabecera().style.width).toBe("");
    expect(celda(contenedor, 0, 0).style.width).toBe("");
    conAncho(cabecera(), 120);

    await puntero(borde(), "pointerdown", { x: 200 });
    // Agarrar el borde no arrastra la cabecera.
    await puntero(borde(), "pointermove", { x: 150 });
    expect(tabla().classList.contains("arrastrando")).toBe(false);
    expect(tabla().classList.contains("ajustando")).toBe(true);
    // Mientras se arrastra, cambia la variable de la columna: 120 − 50.
    expect(tabla().style.getPropertyValue("--tabla-ancho-nombre")).toBe("70px");
    expect(cabecera().style.width).toBe("var(--tabla-ancho-nombre)");
    expect(celda(contenedor, 1, 0).style.maxWidth).toBe("var(--tabla-ancho-nombre)");
    // No se achica menos que el botón del filtro y el borde.
    await puntero(borde(), "pointermove", { x: -400 });
    expect(tabla().style.getPropertyValue("--tabla-ancho-nombre")).toBe("56px");
    await puntero(borde(), "pointermove", { x: 260 });
    await puntero(borde(), "pointerup", { x: 260 });
    expect(tabla().classList.contains("ajustando")).toBe(false);
    expect(tabla().style.getPropertyValue("--tabla-ancho-nombre")).toBe("180px");
    expect(JSON.parse(localStorage.getItem("tabla_anchos:prueba"))).toEqual({ nombre: 180 });
    // El orden de las columnas no se tocó, y nada se eligió ni se editó.
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);
    expect(contenedor.querySelector("td.activa")).toBeNull();

    // Al volver a la tabla, sigue con ese ancho.
    await act(async () => raiz.render(<div />));
    await montar();
    expect(tabla().style.getPropertyValue("--tabla-ancho-nombre")).toBe("180px");
    expect(celda(contenedor, 0, 0).style.width).toBe("var(--tabla-ancho-nombre)");

    // Dos clics en el borde: vuelve a acomodarse sola.
    await act(async () => borde().dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(tabla().style.getPropertyValue("--tabla-ancho-nombre")).toBe("");
    expect(celda(contenedor, 0, 0).style.width).toBe("");
    expect(JSON.parse(localStorage.getItem("tabla_anchos:prueba"))).toEqual({});
  });

  test("un toque en el borde sin moverlo no le fija el ancho; lo guardado que no se entiende no cuenta", async () => {
    localStorage.setItem("tabla_anchos:prueba", JSON.stringify({ edad: "mucho", pie: 10 }));
    await montar();
    const tabla = contenedor.querySelector("table");
    // Un ancho que no es número no va; uno muy chico queda en el mínimo.
    expect(tabla.style.getPropertyValue("--tabla-ancho-edad")).toBe("");
    expect(tabla.style.getPropertyValue("--tabla-ancho-pie")).toBe("56px");
    const nombre = contenedor.querySelectorAll("th[data-columna]")[0];
    conAncho(nombre, 120);
    const borde = nombre.querySelector(".tabla-datos-borde");
    await puntero(borde, "pointerdown", { x: 200 });
    await puntero(borde, "pointerup", { x: 200 });
    expect(tabla.style.getPropertyValue("--tabla-ancho-nombre")).toBe("");
    expect(nombre.style.width).toBe("");
    // Ni abre el filtro ni elige nada.
    expect(contenedor.querySelector(".tabla-datos-valores")).toBeNull();
    expect(contenedor.querySelector("td.activa")).toBeNull();
  });

  test("con una columna achicada a mano, el título de su grupo no la ensancha", async () => {
    localStorage.setItem("tabla_anchos:prueba", JSON.stringify({ edad: 50 }));
    const conGrupos = columnas.map((columna, i) => ({ ...columna, grupo: i < 2 ? "jugador" : "cuerpo", grupoTitulo: i < 2 ? "Jugador" : "Cuerpo" }));
    await montar({ columnas: conGrupos });
    const [jugador, cuerpo] = contenedor.querySelectorAll(".tabla-datos-grupos th");
    expect(jugador.firstElementChild.classList.contains("tabla-datos-envoltura")).toBe(true);
    expect(cuerpo.firstElementChild.classList.contains("tabla-datos-envoltura")).toBe(false);
    expect(jugador.textContent).toBe("Jugador");
  });

  test("con todas las columnas con su ancho la tabla no se estira, y el arrastre sale del ancho guardado", async () => {
    localStorage.setItem("tabla_anchos:prueba", JSON.stringify({ nombre: 80, edad: 80 }));
    await montar();
    const tabla = contenedor.querySelector("table");
    // Pie se acomoda sola: la tabla puede ocupar todo el ancho.
    expect(tabla.classList.contains("con-anchos")).toBe(false);
    const [nombre, , pie] = contenedor.querySelectorAll("th[data-columna]");
    conAncho(pie, 90);
    await puntero(pie.querySelector(".tabla-datos-borde"), "pointerdown", { x: 100 });
    await puntero(pie.querySelector(".tabla-datos-borde"), "pointermove", { x: 110 });
    await puntero(pie.querySelector(".tabla-datos-borde"), "pointerup", { x: 110 });
    // Ahora las tres tienen ancho: la tabla mide lo que suman.
    expect(tabla.classList.contains("con-anchos")).toBe(true);
    // Aunque el navegador la muestre más ancha, se arrastra desde la guardada.
    conAncho(nombre, 114);
    await puntero(nombre.querySelector(".tabla-datos-borde"), "pointerdown", { x: 100 });
    await puntero(nombre.querySelector(".tabla-datos-borde"), "pointermove", { x: 90 });
    await puntero(nombre.querySelector(".tabla-datos-borde"), "pointerup", { x: 90 });
    expect(JSON.parse(localStorage.getItem("tabla_anchos:prueba"))).toEqual({ nombre: 70, edad: 80, pie: 100 });
  });

  test("un segundo dedo no le cambia la columna al primero, y si se corta el arrastre queda lo que había", async () => {
    await montar();
    const tabla = contenedor.querySelector("table");
    const [nombre, edad] = contenedor.querySelectorAll("th[data-columna]");
    conAncho(nombre, 120);
    conAncho(edad, 100);
    const bordeNombre = nombre.querySelector(".tabla-datos-borde");
    const bordeEdad = edad.querySelector(".tabla-datos-borde");
    await puntero(bordeNombre, "pointerdown", { x: 200, pointerId: 1, pointerType: "touch" });
    // Otro dedo en otro borde: no hace nada.
    await puntero(bordeEdad, "pointerdown", { x: 300, pointerId: 2, pointerType: "touch" });
    await puntero(bordeEdad, "pointermove", { x: 250, pointerId: 2, pointerType: "touch" });
    await puntero(bordeEdad, "pointerup", { x: 250, pointerId: 2, pointerType: "touch" });
    expect(tabla.style.getPropertyValue("--tabla-ancho-edad")).toBe("");
    // El primero sigue, y el navegador corta el arrastre: queda lo último.
    await puntero(bordeNombre, "pointermove", { x: 230, pointerId: 1, pointerType: "touch" });
    await puntero(bordeNombre, "lostpointercapture", { x: 230, pointerId: 1, pointerType: "touch" });
    expect(tabla.classList.contains("ajustando")).toBe(false);
    expect(JSON.parse(localStorage.getItem("tabla_anchos:prueba"))).toEqual({ nombre: 150 });
    // Ya terminado, mover sobre el borde no cambia nada.
    await puntero(bordeNombre, "pointermove", { x: 400, pointerId: 1 });
    expect(tabla.style.getPropertyValue("--tabla-ancho-nombre")).toBe("150px");
  });

  test("Mayúscula + espacio con varias filas elegidas elige esas filas enteras", async () => {
    await montar();
    await tocar(celda(contenedor, 0, 1));
    await act(async () => celda(contenedor, 1, 1).dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })));
    expect(contenedor.textContent).toContain("2 celdas elegidas");
    await act(async () => contenedor.querySelector(".tabla-datos-marco").dispatchEvent(new KeyboardEvent("keydown", { key: " ", shiftKey: true, bubbles: true })));
    expect(contenedor.textContent).toContain("6 celdas elegidas");
  });

  test("el título del grupo de una columna fija no la ensancha", async () => {
    const conGrupos = columnas.map((columna, i) => ({ ...columna, ancho: i === 0 ? 60 : undefined, grupo: i < 2 ? "jugador" : "cuerpo", grupoTitulo: i < 2 ? "Un título de grupo bien largo" : "Cuerpo" }));
    await montar({ columnas: conGrupos, fijas: ["nombre"] });
    // El grupo sigue después de la fija: ahí, con su tono y sin repetir el título.
    const [jugador, sigue, cuerpo] = contenedor.querySelectorAll(".tabla-datos-grupos th");
    expect(jugador.firstElementChild.classList.contains("tabla-datos-envoltura")).toBe(true);
    expect([jugador, sigue, cuerpo].map((th) => th.textContent)).toEqual(["Un título de grupo bien largo", "", "Cuerpo"]);
    expect(sigue.className).toBe(jugador.className.replace(" inmovil ultima-inmovil", ""));
    expect(cuerpo.firstElementChild.classList.contains("tabla-datos-envoltura")).toBe(false);
  });

  test("en la fila de los grupos, las fijas van en una celda fija como ellas", async () => {
    // Como Curl Nórdico: las fijas sin grupo y después los grupos.
    const conGrupos = columnas.map((columna, i) => ({ ...columna, ancho: i === 0 ? 150 : undefined, grupo: i === 0 ? undefined : "cuerpo", grupoTitulo: i === 0 ? undefined : "Cuerpo" }));
    await montar({ columnas: conGrupos, fijas: ["nombre"] });
    const grupos = [...contenedor.querySelectorAll(".tabla-datos-grupos th")];
    expect(grupos.map((th) => th.textContent)).toEqual(["", "Cuerpo"]);
    expect(grupos.map((th) => th.getAttribute("colspan"))).toEqual(["1", String(columnas.length - 1)]);
    // La de las fijas queda fija (como las cabeceras de las fijas), desde el borde.
    expect(grupos[0].classList.contains("inmovil")).toBe(true);
    expect(grupos[0].classList.contains("ultima-inmovil")).toBe(true);
    expect(grupos[0].style.left).toBe("0px");
    expect(grupos[1].classList.contains("inmovil")).toBe(false);
    // El título de un grupo se corre hasta la derecha de las fijas.
    expect(contenedor.querySelector(".tabla-datos-tabla").style.getPropertyValue("--tabla-datos-ancho-fijas")).toBe("calc(var(--tabla-ancho-nombre))");
  });

  test("una columna fija también se achica, y las fijas de al lado la siguen", async () => {
    await montar({ fijas: ["nombre", "edad"], columnas: [{ ...columnas[0], ancho: 150 }, { ...columnas[1], ancho: 90 }, columnas[2]] });
    const tabla = contenedor.querySelector("table");
    const [nombre, edad] = contenedor.querySelectorAll("th[data-columna]");
    conAncho(nombre, 150);
    const borde = nombre.querySelector(".tabla-datos-borde");
    await puntero(borde, "pointerdown", { x: 300 });
    await puntero(borde, "pointermove", { x: 240 });
    await puntero(borde, "pointerup", { x: 240 });
    expect(tabla.style.getPropertyValue("--tabla-ancho-nombre")).toBe("90px");
    // La segunda fija se corre sola: su lugar sale del ancho de la primera.
    expect(edad.style.left).toBe("calc(var(--tabla-ancho-nombre))");
    expect(JSON.parse(localStorage.getItem("tabla_anchos:prueba"))).toEqual({ nombre: 90 });
  });

  test("con las filas que se ven: los colores de cada celda y las filas de arriba, alineadas con su columna", async () => {
    const vista = (visibles) => ({
      estilos: Object.fromEntries(visibles.map((fila) => [fila.id, fila.valores.edad > 35 ? { edad: { background: "rgb(255, 0, 0)" } } : {}])),
      arriba: [
        { id: "cuenta", rotulo: "Filas", alto: 2, celdas: { edad: { texto: String(visibles.length), estilo: { color: "rgb(0, 128, 0)" } } } },
        { id: "debajo", rotulo: null, celdas: { pie: { texto: "abajo" } } },
      ],
    });
    await montar({ fijas: ["nombre"], vista });
    const arriba = [...contenedor.querySelectorAll("thead tr.tabla-datos-arriba")];
    expect(arriba).toHaveLength(2);
    const rotulo = arriba[0].querySelector(".tabla-datos-arriba-rotulo");
    expect(rotulo.textContent).toBe("Filas");
    expect(rotulo.getAttribute("rowspan")).toBe("2");
    expect(arriba[1].querySelector(".tabla-datos-arriba-rotulo")).toBeNull();
    // Cada celda de arriba, sobre su columna (después del rótulo de las fijas).
    expect([...arriba[0].querySelectorAll("td")].map((td) => td.textContent)).toEqual(["2", ""]);
    expect([...arriba[1].querySelectorAll("td")].map((td) => td.textContent)).toEqual(["", "abajo"]);
    expect(arriba[0].querySelector("td").style.color).toBe("rgb(0, 128, 0)");
    expect(celda(contenedor, 0, 1).style.background).toBe("rgb(255, 0, 0)");
    expect(celda(contenedor, 0, 1).classList.contains("con-formato")).toBe(true);
    expect(celda(contenedor, 1, 1).style.background).toBe("");

    // Con un filtro, todo se recalcula con lo que queda a la vista.
    await tocar(contenedor.querySelector('.tabla-datos-filtro[aria-label="Filtrar u ordenar Nombre"]'));
    await tocar([...document.querySelectorAll(".tabla-datos-todos button")].find((boton) => boton.textContent === "Ninguno"));
    await tocar([...document.querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent.startsWith("SCARPA")).querySelector("input"));
    await tocar([...document.querySelectorAll("button")].find((boton) => boton.textContent.trim() === "Aplicar"));
    expect(contenedor.querySelector("thead tr.tabla-datos-arriba td").textContent).toBe("1");
  });

  test("una columna fijada con dos clics muestra su dato arriba: el rótulo ocupa solo las fijas de entrada", async () => {
    const vista = () => ({
      estilos: {},
      arriba: [{ id: "media", rotulo: "Promedio", celdas: { edad: { texto: "36,5" }, pie: { texto: "—" } } }],
    });
    await montar({ fijas: ["nombre"], vista, columnas: [{ ...columnas[0], ancho: 150 }, { ...columnas[1], ancho: 90 }, columnas[2]] });
    const [, edad] = contenedor.querySelectorAll("th[data-columna]");
    await dobleClic(edad);
    expect(cabeceras(contenedor)).toEqual(["Nombre", "Edad", "Pie"]);
    const fila = contenedor.querySelector("thead tr.tabla-datos-arriba");
    const rotulo = fila.querySelector(".tabla-datos-arriba-rotulo");
    // El rótulo, sobre Nombre (la de entrada), fijo pero sin ser la última fija.
    expect(rotulo.getAttribute("colspan")).toBe("1");
    expect(rotulo.classList.contains("inmovil")).toBe(true);
    expect(rotulo.classList.contains("ultima-inmovil")).toBe(false);
    // El promedio de Edad se ve, fijo como su columna y en su lugar.
    const [deEdad, dePie] = fila.querySelectorAll("td");
    expect(deEdad.textContent).toBe("36,5");
    expect(deEdad.classList.contains("inmovil")).toBe(true);
    expect(deEdad.classList.contains("ultima-inmovil")).toBe(true);
    expect(deEdad.style.left).toBe("calc(var(--tabla-ancho-nombre))");
    expect(dePie.classList.contains("inmovil")).toBe(false);

    // Sin las de entrada (Nombre suelta), el rótulo va sobre la primera fija.
    const [nombre] = contenedor.querySelectorAll("th[data-columna]");
    await dobleClic(nombre);
    expect(cabeceras(contenedor)).toEqual(["Edad", "Nombre", "Pie"]);
    const otroRotulo = contenedor.querySelector("thead tr.tabla-datos-arriba .tabla-datos-arriba-rotulo");
    expect(otroRotulo.getAttribute("colspan")).toBe("1");
    expect(otroRotulo.classList.contains("inmovil")).toBe(true);
    expect(otroRotulo.classList.contains("ultima-inmovil")).toBe(true);
  });

  test("en el celular, el dato de arriba de una fijada con dos toques queda fijo con ella; el rótulo corre con las de entrada", async () => {
    comoCelular();
    try {
      const vista = () => ({
        estilos: {},
        arriba: [{ id: "media", rotulo: "Promedio", celdas: { edad: { texto: "36,5" }, pie: { texto: "—" } } }],
      });
      await montar({ fijas: ["nombre"], vista, columnas: [{ ...columnas[0], ancho: 150 }, { ...columnas[1], ancho: 90 }, columnas[2]] });
      let fila = contenedor.querySelector("thead tr.tabla-datos-arriba");
      let rotulo = fila.querySelector(".tabla-datos-arriba-rotulo");
      // Sin fijadas: el rótulo sobre Nombre (la de entrada), sin quedar fijo.
      expect(rotulo.getAttribute("colspan")).toBe("1");
      expect(rotulo.classList.contains("inmovil")).toBe(false);
      expect(fila.querySelectorAll("td.inmovil")).toHaveLength(0);

      // Pie se fija: va primero, con su dato arriba, fijo como ella.
      const [, , pie] = contenedor.querySelectorAll("th[data-columna]");
      await toque(pie);
      await toque(pie);
      expect(cabeceras(contenedor)).toEqual(["Pie", "Nombre", "Edad"]);
      fila = contenedor.querySelector("thead tr.tabla-datos-arriba");
      const [dePie, deEdad] = fila.querySelectorAll("td");
      expect(fila.firstElementChild).toBe(dePie);
      expect(dePie.textContent).toBe("—");
      expect(dePie.classList.contains("inmovil")).toBe(true);
      expect(dePie.style.left).toBe("0px");
      // Después, el rótulo sobre Nombre, que sigue corriendo, y el dato de Edad.
      rotulo = fila.querySelector(".tabla-datos-arriba-rotulo");
      expect(rotulo.previousElementSibling).toBe(dePie);
      expect(rotulo.getAttribute("colspan")).toBe("1");
      expect(rotulo.classList.contains("inmovil")).toBe(false);
      expect(deEdad.textContent).toBe("36,5");
      expect(deEdad.classList.contains("inmovil")).toBe(false);
    } finally {
      delete window.matchMedia;
    }
  });

  test("un tiempo se escribe en minutos y segundos y se guarda en segundos", async () => {
    const conTiempo = [...columnas, { clave: "plancha", titulo: "Plancha", tipo: "tiempo", editable: true }];
    const filasConTiempo = filas.map((fila, i) => ({ ...fila, valores: { ...fila.valores, plancha: i === 0 ? 184 : null }, textos: { ...fila.textos, plancha: i === 0 ? "3:04" : "" } }));
    await montar({ columnas: conTiempo, filas: filasConTiempo });
    const escribir = async (input, valor) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, valor);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    };
    await tocar(celda(contenedor, 0, 3));
    await tocar(celda(contenedor, 0, 3));
    let input = celda(contenedor, 0, 3).querySelector("input");
    expect(input.value).toBe("3:04");
    expect(input.placeholder).toBe("0:00");
    await escribir(input, "3:10");
    expect(editados).toEqual([{ filaId: 1, clave: "plancha", valor: 190 }]);

    await tocar(celda(contenedor, 1, 3));
    await tocar(celda(contenedor, 1, 3));
    input = celda(contenedor, 1, 3).querySelector("input");
    await escribir(input, "3:99");
    expect(editados).toHaveLength(1);
    expect(contenedor.textContent).toContain("Los tiempos se escriben en minutos y segundos");
  });

  let medidas = [];
  afterEach(() => {
    medidas.forEach((medida) => medida.mockRestore());
    medidas = [];
    delete navigator.clipboard;
  });

  test("con muchasFilas se dibujan las filas que se ven (y unas más); elegir, copiar y el informe siguen con todas", async () => {
    // jsdom no mide: el marco mide 340 px, cada fila 34 y las cabeceras 40.
    medidas = [
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function alto() {
        return this.classList?.contains("tabla-datos-marco") ? 340 : 0;
      }),
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function alto() {
        return this.tagName === "TR" ? 34 : 0;
      }),
      vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function arriba() {
        return this.tagName === "TBODY" ? 40 : 0;
      }),
    ];
    const muchas = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, valores: { nombre: `N${i + 1}`, edad: i, pie: "" }, textos: { nombre: `N${i + 1}`, edad: String(i), pie: "" } }));
    let vistas = 0;
    await montar({
      filas: muchas,
      muchasFilas: true,
      vista: (filasVista) => {
        vistas = filasVista.length;
        return { estilos: {}, arriba: [] };
      },
    });
    const dibujadas = () => [...contenedor.querySelectorAll("tbody tr:not(.tabla-datos-hueco)")];
    // Debajo de las cabeceras entran 300 px: 9 filas, más 8 abajo; el resto
    // es un hueco del mismo alto.
    expect(dibujadas()).toHaveLength(17);
    expect(dibujadas()[0].textContent).toContain("N1");
    expect(contenedor.querySelector(".tabla-datos-cuantas").textContent).toBe("1000 filas");
    expect(vistas).toBe(1000);
    const huecos = contenedor.querySelectorAll("tbody tr.tabla-datos-hueco");
    expect(huecos).toHaveLength(1);
    expect(huecos[0].style.height).toBe(`${983 * 34}px`);

    // Al correr la tabla, se dibujan las de ahí.
    const marco = contenedor.querySelector(".tabla-datos-marco");
    marco.scrollTop = 40 + 500 * 34;
    await act(async () => {
      marco.dispatchEvent(new Event("scroll"));
      await new Promise((resolver) => setTimeout(resolver, 40));
    });
    expect(dibujadas()[0].textContent).toContain("N493");
    expect(dibujadas()).toHaveLength(26);
    expect(contenedor.querySelectorAll("tbody tr.tabla-datos-hueco")).toHaveLength(2);

    // Elegir y copiar hablan de la fila de verdad, aunque haya filas sin dibujar arriba.
    await tocar(dibujadas()[8].querySelectorAll("td")[0]);
    expect(dibujadas()[8].querySelectorAll("td")[0].className).toContain("activa");
    const escrito = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (texto) => escrito.push(texto) } });
    await act(async () => marco.dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true })));
    expect(escrito).toEqual(["N501"]);
  });

  test("sin poder medir (o sin muchasFilas), se dibujan todas", async () => {
    const muchas = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, valores: { nombre: `N${i + 1}` }, textos: { nombre: `N${i + 1}` } }));
    await montar({ filas: muchas, muchasFilas: true });
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(120);
    await montar({ filas: muchas });
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(120);
  });
});
