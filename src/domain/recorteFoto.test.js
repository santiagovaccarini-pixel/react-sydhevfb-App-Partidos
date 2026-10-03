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

  test("el fondo encerrado entre el brazo y el cuerpo también se saca; lo blanco con textura, no", () => {
    // Un "jugador" de 40 x 40 con dos huecos adentro: uno del gris liso del
    // estudio y otro blanco con textura (como la camiseta).
    const ancho = 60;
    const datos = foto(ancho, ancho, (x, y) => {
      if (x < 10 || x > 49 || y < 8) return GRIS;
      if (x >= 15 && x <= 24 && y >= 20 && y <= 29) return GRIS;
      if (x >= 32 && x <= 41 && y >= 20 && y <= 29) return (x + y) % 2 ? [236, 236, 238] : [244, 241, 235];
      return [30, 30, 32];
    });
    sacarFondo(datos, ancho, ancho);
    expect(alfa(datos, ancho, 20, 25)).toBe(0);
    expect(alfa(datos, ancho, 36, 25)).toBe(255);
    expect(alfa(datos, ancho, 12, 40)).toBe(255);
  });

  test("donde el jugador toca el costado de la foto, se desvanece", () => {
    // Abajo, de lado a lado (como los brazos cortados por el encuadre).
    const datos = foto(60, 60, (x, y) => (y >= 55 ? [30, 30, 32] : GRIS));
    expect(sacarFondo(datos, 60, 60)).toBe(true);
    expect(alfa(datos, 60, 0, 57)).toBeLessThan(40);
    expect(alfa(datos, 60, 59, 57)).toBeLessThan(40);
    expect(alfa(datos, 60, 2, 57)).toBeGreaterThan(alfa(datos, 60, 0, 57));
    expect(alfa(datos, 60, 30, 57)).toBe(255);
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
