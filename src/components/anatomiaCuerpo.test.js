import { describe, expect, test } from "vitest";
import { ESQUEMAS, cajaDeParte, codigosDibujados, esquemasDe, estructurasDe } from "./anatomiaCuerpo.js";
import { ALTO, ANCHO, ORDEN_DE_REGIONES } from "./siluetaCuerpo.js";
import { OPCIONES } from "../domain/lesionesCampos.js";
import { PARTES, crearMapa } from "../domain/mapaCorporal.js";
import esAR from "../idioma/es-AR.js";
import ptBR from "../idioma/pt-BR.js";

const VISTAS = ["frente", "espalda"];
const todas = () => ORDEN_DE_REGIONES.flatMap((region) => VISTAS.flatMap((vista) => estructurasDe(region, vista).map((una) => ({ ...una, region, vista }))));

describe("los músculos, tendones y ligamentos de la figura", () => {
  test("todo lo dibujado es una opción del catálogo, en su columna, y va en alguna parte del cuerpo", () => {
    const mapa = crearMapa();
    const ofrecidas = new Set(
      PARTES.flatMap((parte) => {
        const { musculos, especificos, ligamentos } = mapa.estructurasDe(parte);
        return [...musculos.map((c) => `musculo:${c}`), ...especificos.map((c) => `musculo_especifico:${c}`), ...ligamentos.map((c) => `ligamento:${c}`)];
      }),
    );
    Object.entries(codigosDibujados()).forEach(([campo, codigos]) => {
      const delCatalogo = OPCIONES[campo].map((opcion) => opcion.codigo);
      codigos.forEach((codigo) => {
        expect(delCatalogo, `${campo}:${codigo}`).toContain(codigo);
        expect(ofrecidas.has(`${campo}:${codigo}`), `${campo}:${codigo} no va en ninguna parte`).toBe(true);
      });
    });
  });

  test("cada una es un contorno cerrado dentro del lienzo, con clave única por región y vista", () => {
    todas().forEach((una) => {
      expect(una.camino, una.clave).toMatch(/^M.* Z$/);
      una.camino
        .match(/-?\d+(\.\d+)?/g)
        .map(Number)
        .forEach((valor, i) => {
          expect(valor, una.clave).toBeGreaterThanOrEqual(-1);
          expect(valor, una.clave).toBeLessThanOrEqual((i % 2 === 0 ? ANCHO : ALTO) + 1);
        });
    });
    ORDEN_DE_REGIONES.forEach((region) =>
      VISTAS.forEach((vista) => {
        const claves = estructurasDe(region, vista).map((una) => una.clave);
        expect(new Set(claves).size, `${region} ${vista}`).toBe(claves.length);
      }),
    );
    expect(estructurasDe("cabeza")).toEqual([]);
  });

  test("en el tronco, cada mitad dice de qué lado del jugador es (de espaldas, al revés)", () => {
    const pectorales = estructurasDe("tronco", "frente").filter((una) => una.codigo === "peitoral_maior");
    expect(pectorales.map((una) => una.lado)).toEqual(["direito", "esquerdo"]);
    // El derecho del jugador, de frente, a la izquierda de la pantalla.
    const xDe = (una) => Number(una.camino.slice(1).split(",")[0]);
    expect(xDe(pectorales[0])).toBeLessThan(ANCHO / 2);
    const dorsales = estructurasDe("tronco", "espalda").filter((una) => una.codigo === "dorsal");
    expect(dorsales.map((una) => una.lado)).toEqual(["esquerdo", "direito"]);
    expect(estructurasDe("tronco", "frente").find((una) => una.codigo === "abdominal").lado).toBe(null);
  });

  test("los profundos son músculos específicos en su propia capa", () => {
    const profundos = todas().filter((una) => una.capa === "profunda");
    expect([...new Set(profundos.map((una) => una.codigo))].sort()).toEqual(
      ["adutor_curto", "gluteo_minimo", "obliquo_interno", "obturador_externo", "obturador_interno", "peitoral_menor", "piriforme", "vasto_intermedio"],
    );
    profundos.forEach((una) => expect(una.campo).toBe("musculo_especifico"));
  });

  test("cada parte se ve de cerca, espejada del otro lado", () => {
    expect(cajaDeParte("joelho", "pierna_derecha", "frente")).toEqual([64, 280, 38, 70]);
    expect(cajaDeParte("joelho", "pierna_izquierda", "frente")).toEqual([ANCHO - 64 - 38, 280, 38, 70]);
    expect(cajaDeParte("joelho", "pierna_derecha", "espalda")).toEqual([ANCHO - 64 - 38, 280, 38, 70]);
    expect(cajaDeParte("inventada", "pierna_derecha")).toBe(null);
    PARTES.forEach((parte) => expect(cajaDeParte(parte, "tronco"), parte).toBeTruthy());
  });

  test("los esquemas: rodilla, tobillo por fuera y por dentro, y planta del pie, con sus rótulos en los dos idiomas", () => {
    expect(esquemasDe("joelho")).toEqual(["rodilla"]);
    expect(esquemasDe("tornozelo_pe")).toEqual(["tobilloAfuera", "tobilloAdentro"]);
    expect(esquemasDe("pe_dedo")).toEqual(["planta"]);
    expect(esquemasDe("coxa")).toEqual([]);
    Object.entries(ESQUEMAS).forEach(([cual, esquema]) => {
      [esAR, ptBR].forEach((diccionario) => expect(diccionario.lesiones.cuerpo.esquemas[cual], cual).toBeTruthy());
      esquema.piezas
        .filter((pieza) => pieza.rotulo)
        .forEach((pieza) => {
          [esAR, ptBR].forEach((diccionario) => expect(diccionario.lesiones.cuerpo.rotulos[pieza.rotulo], pieza.rotulo).toBeTruthy());
          // El rótulo, adentro de la caja.
          const [x, y, w, h] = esquema.caja;
          expect(pieza.en[0]).toBeGreaterThan(x);
          expect(pieza.en[0]).toBeLessThan(x + w);
          expect(pieza.en[1]).toBeGreaterThan(y);
          expect(pieza.en[1]).toBeLessThan(y + h);
        });
    });
  });
});
