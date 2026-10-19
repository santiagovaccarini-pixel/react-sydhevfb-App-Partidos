import { describe, expect, test } from "vitest";
import { armarZip, crc32, crearXlsx, letraDeColumna, nombresDeHojas } from "./xlsx.js";

const texto = (bytes) => new TextDecoder().decode(bytes);

describe("el Excel armado en la app", () => {
  test("las columnas se nombran como en Excel", () => {
    expect([0, 1, 25, 26, 27, 701, 702].map(letraDeColumna)).toEqual(["A", "B", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  test("los nombres de las hojas: hasta 31 letras, sin los caracteres prohibidos y sin repetir", () => {
    expect(nombresDeHojas(["Datos básicos", "GPS [x]:y", "datos básicos", 'Evaluación Zona Media "CORE" muy larga', ""])).toEqual([
      "Datos básicos",
      "GPS x y",
      "datos básicos 2",
      'Evaluación Zona Media "CORE" mu',
      "Hoja 5",
    ]);
  });

  test("el control de cada archivo del zip (CRC-32) es el de siempre", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });

  test("el zip tiene cada archivo con su nombre y termina con el índice", () => {
    const zip = armarZip([{ nombre: "a.txt", datos: new TextEncoder().encode("hola") }]);
    const vista = new DataView(zip.buffer);
    expect(vista.getUint32(0, true)).toBe(0x04034b50);
    expect(vista.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(texto(zip)).toContain("a.txt");
    expect(texto(zip)).toContain("hola");
  });

  test("las hojas: la primera fila en negrita y fija; los números como números; un texto con «=» no se vuelve fórmula", () => {
    const zip = crearXlsx([{ nombre: "Datos", filas: [["Dato", "Valor"], ["Horas", 12.5], ["Nota", "=1+1"], ["Raro", "a<b & \"c\""], ["Vacío", null]] }]);
    const contenido = texto(zip);
    expect(contenido).toContain('<sheet name="Datos" sheetId="1" r:id="rId1"/>');
    expect(contenido).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Dato</t></is></c>');
    expect(contenido).toContain('<c r="B2"><v>12.5</v></c>');
    expect(contenido).toContain('<c r="B3" t="inlineStr"><is><t xml:space="preserve">=1+1</t></is></c>');
    expect(contenido).not.toContain("<f>");
    expect(contenido).toContain("a&lt;b &amp; &quot;c&quot;");
    expect(contenido).toContain('state="frozen"');
    expect(contenido).not.toContain('r="B5"');
  });
});
