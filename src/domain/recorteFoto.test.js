import { describe, expect, test } from "vitest";
import { fondoParejo, sacarFondo } from "./recorteFoto.js";

// Una foto de mentira: fondo gris claro, un "jugador" oscuro en el medio
// con una raya blanca adentro (como la camiseta), y lo que se pida.
const foto = (ancho, alto, pintar) => {
  const datos = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0; y < alto; y += 1) {
    for (let x = 0; x < ancho; x += 1) {
      const [r, g, b] = pintar(x, y);
      const i = (y * ancho + x) * 4;
      datos[i] = r;
      datos[i + 1] = g;
      datos[i + 2] = b;
      datos[i + 3] = 255;
    }
  }
  return datos;
};
const GRIS = [229, 229, 229];
const jugador = (x, y) => {
  if (x < 8 || x > 23 || y < 6) return GRIS;
  if (x >= 14 && x <= 16 && y < 28) return [240, 238, 232];
  return [30, 30, 32];
};
const alfa = (datos, ancho, x, y) => datos[(y * ancho + x) * 4 + 3];

describe("sacar el fondo de la foto del jugador", () => {
  test("el fondo liso y claro queda transparente; el jugador, entero (también lo blanco de la camiseta)", () => {
    const datos = foto(32, 32, jugador);
    expect(fondoParejo(datos, 32, 32)).toEqual(GRIS);
    expect(sacarFondo(datos, 32, 32)).toBe(true);
    expect(alfa(datos, 32, 2, 2)).toBe(0);
    expect(alfa(datos, 32, 30, 30)).toBe(0);
    expect(alfa(datos, 32, 12, 20)).toBe(255);
    // La raya blanca de la camiseta, aunque toque el fondo arriba: se queda.
    expect(alfa(datos, 32, 15, 15)).toBe(255);
  });

  test("el contorno queda a medias y sin el gris del fondo mezclado", () => {
    // Una columna de transición entre el fondo y el jugador.
    const datos = foto(32, 32, (x, y) => (x === 7 && y >= 6 ? [205, 205, 205] : jugador(x, y)));
    sacarFondo(datos, 32, 32);
    const i = (20 * 32 + 7) * 4;
    expect(datos[i + 3]).toBeGreaterThan(0);
    expect(datos[i + 3]).toBeLessThan(255);
    // Sin el gris: más oscuro que el punto tal como venía.
    expect(datos[i]).toBeLessThan(205);
  });

  test("una foto sin fondo liso, o con fondo oscuro, no se toca", () => {
    const rayada = foto(32, 32, (x) => (x % 2 ? [229, 229, 229] : [20, 20, 20]));
    const copia = new Uint8ClampedArray(rayada);
    expect(sacarFondo(rayada, 32, 32)).toBe(false);
    expect(rayada).toEqual(copia);
    expect(fondoParejo(foto(32, 32, () => [40, 40, 40]), 32, 32)).toBe(null);
    expect(fondoParejo(null, 0, 0)).toBe(null);
  });
});
