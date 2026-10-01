import { describe, expect, test } from "vitest";
import { aTexto, aplicarPegado, desdeTexto, interpretarFecha, interpretarFechaHora, interpretarValor, ordenDeColumnas, reordenar } from "./tabla.js";

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
