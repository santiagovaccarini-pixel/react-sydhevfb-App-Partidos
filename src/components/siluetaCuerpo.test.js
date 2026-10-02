import { describe, expect, test } from "vitest";
import { ALTO, ANCHO, ORDEN_DE_REGIONES, cajaDeRegion, dibujoDe, espejadaEn, zoomA } from "./siluetaCuerpo.js";
import { REGIONES } from "../domain/mapaCorporal.js";

const partesDe = (region, vista) => dibujoDe(region, vista).piezas.map((pieza) => pieza.parte);

describe("la silueta del cuerpo", () => {
  test("cada región se dibuja con todas sus partes: de frente y de espaldas, entre las dos, todas", () => {
    expect([...ORDEN_DE_REGIONES].sort()).toEqual(REGIONES.map((region) => region.clave).sort());
    REGIONES.forEach((region) => {
      const vistas = [...new Set([...partesDe(region.clave, "frente"), ...partesDe(region.clave, "espalda")])];
      expect(vistas.sort(), region.clave).toEqual([...region.partes].sort());
    });
    // De frente se ve el abdomen; de espaldas, la zona lumbar.
    expect(partesDe("tronco", "frente")).toEqual(["esterno", "abdomen"]);
    expect(partesDe("tronco", "espalda")).toEqual(["esterno", "coluna_lombar"]);
    expect(partesDe("pierna_derecha", "espalda")).toEqual(["quadril_virilha", "coxa", "joelho", "perna_aquiles", "tornozelo_pe", "pe_dedo"]);
    expect(dibujoDe("inventada")).toBe(null);
  });

  test("cada parte es un contorno cerrado dentro del lienzo", () => {
    REGIONES.forEach((region) =>
      ["frente", "espalda"].forEach((vista) =>
        dibujoDe(region.clave, vista).piezas.forEach((pieza) => {
          expect(pieza.camino, `${region.clave} ${pieza.parte}`).toMatch(/^M.* Z$/);
          const numeros = pieza.camino.match(/-?\d+(\.\d+)?/g).map(Number);
          numeros.forEach((valor, i) => {
            expect(valor, pieza.parte).toBeGreaterThanOrEqual(0);
            expect(valor, pieza.parte).toBeLessThanOrEqual(i % 2 === 0 ? ANCHO : ALTO);
          });
        }),
      ),
    );
  });

  test("de frente, lo derecho del jugador queda a la izquierda de quien mira; de espaldas, al revés", () => {
    expect(espejadaEn("pierna_derecha", "frente")).toBe(false);
    expect(espejadaEn("pierna_izquierda", "frente")).toBe(true);
    expect(espejadaEn("brazo_derecho", "espalda")).toBe(true);
    expect(espejadaEn("brazo_izquierdo", "espalda")).toBe(false);
    expect(espejadaEn("tronco", "espalda")).toBe(false);
    const derecha = cajaDeRegion("pierna_derecha", "frente");
    const izquierda = cajaDeRegion("pierna_izquierda", "frente");
    expect(derecha.x + derecha.w).toBeLessThanOrEqual(ANCHO / 2 + 0.5);
    expect(izquierda.x).toBeGreaterThanOrEqual(ANCHO / 2 - 0.5);
    expect(cajaDeRegion("pierna_derecha", "espalda").x).toBeCloseTo(izquierda.x);
  });

  test("acercar una región la agranda y la deja entera adentro de la figura", () => {
    expect(zoomA(null)).toEqual({ x: 0, y: 0, escala: 1 });
    REGIONES.forEach((region) =>
      ["frente", "espalda"].forEach((vista) => {
        const zoom = zoomA(region.clave, vista);
        const caja = cajaDeRegion(region.clave, vista);
        expect(zoom.escala, region.clave).toBeGreaterThan(1);
        expect(zoom.x + caja.x * zoom.escala).toBeGreaterThanOrEqual(0);
        expect(zoom.x + (caja.x + caja.w) * zoom.escala).toBeLessThanOrEqual(ANCHO);
        expect(zoom.y + caja.y * zoom.escala).toBeGreaterThanOrEqual(0);
        expect(zoom.y + (caja.y + caja.h) * zoom.escala).toBeLessThanOrEqual(ALTO);
      }),
    );
  });
});
