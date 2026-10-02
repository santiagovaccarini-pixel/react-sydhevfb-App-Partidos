import { describe, expect, test } from "vitest";
import {
  aTexto,
  aplicarPegado,
  desdeTexto,
  filtrarFilas,
  interpretarFecha,
  interpretarFechaHora,
  interpretarValor,
  ordenDeColumnas,
  ordenarFilas,
  reordenar,
  tramosDeGrupos,
  valoresDeColumna,
} from "./tabla.js";

describe("el orden de las columnas", () => {
  test("mueve una columna a otro lugar", () => {
    expect(reordenar(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(reordenar(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(reordenar(["a", "b"], 0, 0)).toEqual(["a", "b"]);
    expect(reordenar(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  test("el orden guardado se completa con las columnas nuevas y pierde las viejas", () => {
    expect(ordenDeColumnas(["a", "b", "c"], ["c", "x", "a"])).toEqual(["c", "a", "b"]);
    expect(ordenDeColumnas(["a", "b"], null)).toEqual(["a", "b"]);
  });
});

describe("copiar y pegar como Excel", () => {
  test("va y vuelve con tabulaciones, saltos y comillas", () => {
    const matriz = [
      ["HULK", "Muslo", 'con "comillas"'],
      ["SCARPA", "dos\nlíneas", ""],
    ];
    const texto = aTexto(matriz);
    expect(texto).toBe('HULK\tMuslo\t"con ""comillas"""\nSCARPA\t"dos\nlíneas"\t');
    expect(desdeTexto(texto)).toEqual(matriz);
    // Lo que manda Excel en Windows.
    expect(desdeTexto("a\tb\r\nc\td\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(desdeTexto("")).toEqual([]);
  });

  test("entiende fechas escritas de varias maneras", () => {
    expect(interpretarFecha("2026-10-01")).toBe("2026-10-01");
    expect(interpretarFecha("1/10/2026")).toBe("2026-10-01");
    expect(interpretarFecha("01-10-26")).toBe("2026-10-01");
    expect(interpretarFecha("")).toBe(null);
    expect(interpretarFecha("ayer")).toBe(undefined);
    expect(interpretarFechaHora("1/10/2026 8:05")).toBe("2026-10-01T08:05");
    expect(interpretarFechaHora("2026-10-01T18:30")).toBe("2026-10-01T18:30");
    expect(interpretarFechaHora("2026-10-01")).toBe("2026-10-01T00:00");
    // Lo que copia la app (con coma) y la hora con a. m. / p. m. o AM / PM.
    expect(interpretarFechaHora("02/09/2026, 10:30 a. m.")).toBe("2026-09-02T10:30");
    expect(interpretarFechaHora("02/09/2026, 06:30 p. m.")).toBe("2026-09-02T18:30");
    expect(interpretarFechaHora("02/09/2026, 10:30")).toBe("2026-09-02T10:30");
    expect(interpretarFechaHora("2/9/2026 6:00 PM")).toBe("2026-09-02T18:00");
    expect(interpretarFechaHora("2/9/2026 12:15 AM")).toBe("2026-09-02T00:15");
    expect(interpretarFechaHora("2/9/2026 12:15 p.m.")).toBe("2026-09-02T12:15");
    expect(interpretarFechaHora("2026-10-01 18:30:59")).toBe("2026-10-01T18:30");
    // Una fecha o una hora que no existe no se entiende (no se guarda otra).
    expect(interpretarFecha("30/02/2026")).toBe(undefined);
    expect(interpretarFecha("29/02/2024")).toBe("2024-02-29");
    expect(interpretarFecha("2026-02-30")).toBe(undefined);
    expect(interpretarFechaHora("30/02/2026 10:00")).toBe(undefined);
    expect(interpretarFechaHora("9/13/2025 10:00")).toBe(undefined);
    expect(interpretarFechaHora("1/9/2026 25:99")).toBe(undefined);
    expect(interpretarFechaHora("1/9/2026 13:00 PM")).toBe(undefined);
  });

  test("convierte el texto pegado al valor de cada columna", () => {
    const lado = { tipo: "lista", opciones: [{ valor: "esquerdo", etiqueta: "Izquierdo", alias: ["Esquerdo"] }] };
    expect(interpretarValor(lado, "izquierdo")).toBe("esquerdo");
    expect(interpretarValor(lado, "ESQUERDO")).toBe("esquerdo");
    expect(interpretarValor(lado, "esquerdo")).toBe("esquerdo");
    expect(interpretarValor(lado, "arriba")).toBe(undefined);
    expect(interpretarValor(lado, "")).toBe(null);
    expect(interpretarValor({ tipo: "numero" }, "12,5")).toBe(12.5);
    expect(interpretarValor({ tipo: "numero" }, "doce")).toBe(undefined);
    expect(interpretarValor({ tipo: "texto" }, "  Dr. X ")).toBe("Dr. X");
    expect(interpretarValor({ tipo: "calculado" }, "1")).toBe(undefined);
  });

  test("aplica un bloque pegado desde la celda activa y cuenta lo que no entra", () => {
    const columnas = [
      { clave: "nombre", tipo: "texto", editable: true },
      { clave: "edad", tipo: "calculado", editable: false },
      { clave: "pie", tipo: "lista", editable: true, opciones: [{ valor: "direito", etiqueta: "Derecho" }] },
    ];
    const filas = [{ id: 1 }, { id: 2 }];
    const { cambios, ignoradas } = aplicarPegado(
      [
        ["Ana", "30", "Derecho"],
        ["Bea", "31", "Zurdo"],
        ["Cata", "", ""],
      ],
      { filas, columnas, filaInicial: 0, columnaInicial: 0 },
    );
    expect(cambios).toEqual([
      { filaId: 1, clave: "nombre", valor: "Ana" },
      { filaId: 1, clave: "pie", valor: "direito" },
      { filaId: 2, clave: "nombre", valor: "Bea" },
    ]);
    // Dos edades (no se cambian), un "Zurdo" que no existe y la fila que no está.
    expect(ignoradas).toBe(6);
  });
});

describe("filtros y orden de las cabeceras", () => {
  const fila = (id, valores, textos) => ({ id, valores, textos });
  const filas = [
    fila(1, { caso: 1, inicio: "2026-09-20", lado: "direito" }, { caso: "1", inicio: "20/09/2026", lado: "Derecho", jugador: "HULK" }),
    fila(2, { caso: 2, inicio: "2026-08-01", lado: "esquerdo" }, { caso: "2", inicio: "01/08/2026", lado: "Izquierdo", jugador: "SCARPA" }),
    fila(3, { caso: 10, inicio: "", lado: null }, { caso: "10", inicio: "", lado: "", jugador: "SCARPA" }),
  ];

  test("los valores de una columna, con cuántas filas tiene cada uno y las vacías al final", () => {
    expect(valoresDeColumna(filas, "lado")).toEqual([
      { texto: "Derecho", cantidad: 1 },
      { texto: "Izquierdo", cantidad: 1 },
      { texto: "", cantidad: 1 },
    ]);
    expect(valoresDeColumna(filas, "jugador")).toEqual([
      { texto: "HULK", cantidad: 1 },
      { texto: "SCARPA", cantidad: 2 },
    ]);
  });

  test("cada columna filtrada deja pasar sus valores elegidos, y todas a la vez", () => {
    expect(filtrarFilas(filas, {})).toBe(filas);
    expect(filtrarFilas(filas, { jugador: ["SCARPA"] }).map((f) => f.id)).toEqual([2, 3]);
    expect(filtrarFilas(filas, { jugador: ["SCARPA"], lado: [""] }).map((f) => f.id)).toEqual([3]);
    expect(filtrarFilas(filas, { jugador: [] })).toEqual([]);
    // Para armar la lista de una columna se dejan afuera sus propios filtros.
    expect(filtrarFilas(filas, { jugador: ["SCARPA"], lado: ["Izquierdo"] }, { salvo: "lado" }).map((f) => f.id)).toEqual([2, 3]);
  });

  test("ordena números como números y fechas como fechas, con las vacías siempre al final", () => {
    expect(ordenarFilas(filas, { clave: "caso", sentido: "asc" }).map((f) => f.id)).toEqual([1, 2, 3]);
    expect(ordenarFilas(filas, { clave: "caso", sentido: "desc" }).map((f) => f.id)).toEqual([3, 2, 1]);
    expect(ordenarFilas(filas, { clave: "inicio", sentido: "asc" }).map((f) => f.id)).toEqual([2, 1, 3]);
    expect(ordenarFilas(filas, { clave: "inicio", sentido: "desc" }).map((f) => f.id)).toEqual([1, 2, 3]);
    expect(ordenarFilas(filas, { clave: "lado", sentido: "desc" }).map((f) => f.id)).toEqual([2, 1, 3]);
    expect(ordenarFilas(filas, null)).toBe(filas);
  });

  test("si la fila dice cómo ordenar una columna, manda eso (el nombre y no el id, la fecha y no el texto)", () => {
    const conOrden = [
      { id: 1, valores: { jugador: 9 }, textos: { jugador: "ALFA", nacimiento: "25/07/1986" }, orden: { jugador: "ALFA", nacimiento: "1986-07-25" } },
      { id: 2, valores: { jugador: 1 }, textos: { jugador: "ZETA", nacimiento: "02/12/2001" }, orden: { jugador: "ZETA", nacimiento: "2001-12-02" } },
      { id: 3, valores: { jugador: 5 }, textos: { jugador: "MEDIO", nacimiento: "" }, orden: { jugador: "MEDIO", nacimiento: "" } },
    ];
    expect(ordenarFilas(conOrden, { clave: "jugador", sentido: "asc" }).map((f) => f.id)).toEqual([1, 3, 2]);
    expect(ordenarFilas(conOrden, { clave: "nacimiento", sentido: "asc" }).map((f) => f.id)).toEqual([1, 2, 3]);
    expect(ordenarFilas(conOrden, { clave: "nacimiento", sentido: "desc" }).map((f) => f.id)).toEqual([2, 1, 3]);
  });

  test("la fila de grupos: tramos seguidos de columnas del mismo grupo", () => {
    const columnas = [
      { clave: "a", grupo: "uno", grupoTitulo: "Uno" },
      { clave: "b", grupo: "uno", grupoTitulo: "Uno" },
      { clave: "c", grupo: "dos", grupoTitulo: "Dos" },
      { clave: "d" },
      { clave: "e", grupo: "uno", grupoTitulo: "Uno" },
    ];
    expect(tramosDeGrupos(columnas)).toEqual([
      { grupo: "uno", titulo: "Uno", desde: 0, cantidad: 2 },
      { grupo: "dos", titulo: "Dos", desde: 2, cantidad: 1 },
      { grupo: "", titulo: "", desde: 3, cantidad: 1 },
      // Una columna movida lejos de su grupo arma su propio tramo.
      { grupo: "uno", titulo: "Uno", desde: 4, cantidad: 1 },
    ]);
  });
});
