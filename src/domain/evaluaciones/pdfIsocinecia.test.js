import { describe, expect, test } from "vitest";
import { inflateSync } from "node:zlib";
import { fechaDeSesion, inflarConElNavegador, leerPdfIsocinecia, textosDeLaPagina } from "./pdfIsocinecia.js";
import { pdfDePrueba, valorDePrueba } from "./pdfIsocineciaDePrueba.js";
import { NUMEROS } from "./tests/isocinecia.js";

// Isocinecia desde el PDF del isocinético (Santiago, 23/10). Todo inventado:
// cada número dice de dónde sale (pdfIsocineciaDePrueba.js).
const inflar = async (bytes) => inflateSync(bytes);
const V = ["v60", "v180", "v300"];
const M = { peak: 1, work: 2, avg: 3, wf: 4 };
const COL = { ext_pd: 0, ext_pi: 1, flex_pd: 2, flex_pi: 3 };
const esperado = () => {
  const datos = { pc: 80 };
  V.forEach((v, i) => {
    Object.entries(M).forEach(([medida, m]) => Object.entries(COL).forEach(([lado, c]) => (datos[`${v}_${medida}_${lado}`] = valorDePrueba(i, m, c))));
    datos[`${v}_rom_pd`] = valorDePrueba(i, 5, 0);
    datos[`${v}_rom_pi`] = valorDePrueba(i, 5, 1);
  });
  return datos;
};

describe("leer el PDF del isocinético", () => {
  test("de las tres páginas, las 18 medidas de cada velocidad, con el peso, el nombre y la fecha del PDF", async () => {
    const leido = await leerPdfIsocinecia(pdfDePrueba(), { inflar });
    expect(leido).toEqual({ nombre: "Jugador de Prueba", fecha: "2026-07-22", datos: esperado(), velocidades: [60, 180, 300], faltan: [] });
    // Son justo lo que se carga de Isocinecia.
    expect(Object.keys(leido.datos).sort()).toEqual([...NUMEROS].sort());
  });

  test("con la derecha como lesionada, las columnas vienen al revés: se mira la fila RIGHT / LEFT", async () => {
    const leido = await leerPdfIsocinecia(pdfDePrueba({ involucrada: "Right" }), { inflar });
    expect(leido.datos).toEqual(esperado());
    expect(leido.datos.v60_peak_ext_pd).toBe(111.5);
    expect(leido.datos.v60_peak_ext_pi).toBe(112.5);
  });

  test("también con lo que trae el navegador para descomprimir", async () => {
    const leido = await leerPdfIsocinecia(pdfDePrueba(), { inflar: inflarConElNavegador });
    expect(leido.datos).toEqual(esperado());
  });

  test("si falta una velocidad, se lee lo que vino y se dice cuál falta", async () => {
    const leido = await leerPdfIsocinecia(pdfDePrueba({ velocidades: [60, 300] }), { inflar });
    expect(leido.faltan).toEqual([180]);
    expect(leido.datos.v180_peak_ext_pd).toBeUndefined();
    expect(leido.datos.v300_rom_pi).toBe(352.5);
  });

  test("lo que no es el informe no se lee", async () => {
    expect(await leerPdfIsocinecia(new TextEncoder().encode("hola"), { inflar })).toEqual({ error: "evaluaciones.pdf.noEsPdf" });
    expect(await leerPdfIsocinecia(new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<< >>\nendobj\n"), { inflar })).toEqual({ error: "evaluaciones.pdf.noEsIsocinecia" });
    expect(await leerPdfIsocinecia(pdfDePrueba(), { inflar: async () => { throw new Error("mal"); } })).toEqual({ error: "evaluaciones.pdf.noEsIsocinecia" });
  });

  test("el peso que no es un número, y una fecha que no existe, no van", async () => {
    const leido = await leerPdfIsocinecia(pdfDePrueba({ peso: "", sesion: "2/30/2026 10:00:00 AM" }), { inflar });
    expect(leido.datos).not.toHaveProperty("pc");
    expect(leido.fecha).toBeNull();
  });

  test("los textos con su lugar: los pedazos se juntan y un hueco grande es un espacio", () => {
    expect(textosDeLaPagina("BT\n1 0 0 1 10 20 Tm\n[(PEA)-5(K)-300(TQ)]TJ\nET\nBT\n1 0 0 1 30 40 Tm\n(12\\.5)Tj\nET")).toEqual([
      { x: 10, y: 20, texto: "PEAK TQ" },
      { x: 30, y: 40, texto: "12.5" },
    ]);
    expect(fechaDeSesion("1/11/2026 12:06:40 AM")).toBe("2026-01-11");
    expect(fechaDeSesion("")).toBeNull();
  });
});
