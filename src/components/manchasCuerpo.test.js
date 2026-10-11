import { describe, expect, test } from "vitest";
import { ANCHO } from "./siluetaCuerpo.js";
import { dondeVa, manchasDe } from "./manchasCuerpo.js";
import { crearMapa } from "../domain/mapaCorporal.js";

// Dónde va cada lesión en el mapa corporal de los reportes.
const mapa = crearMapa();
const lesion = (datos, id = "l") => ({ id, datos });
// De frente, la derecha del jugador queda a la izquierda de quien mira; de
// espaldas, a la derecha.
const aLaIzquierda = (donde) => donde.x < ANCHO / 2;

describe("dondeVa", () => {
  test("un músculo específico dibujado: en ese músculo, en la vista donde se ve y del lado del jugador", () => {
    const bicepsDerecho = dondeVa(lesion({ parte_cuerpo: "coxa", lado: "direito", musculo: "isquiotibiais", musculo_especifico: "biceps_femoral_longa" }), mapa);
    expect(bicepsDerecho).toMatchObject({ vista: "espalda", campo: "musculo_especifico", codigo: "biceps_femoral_longa" });
    expect(aLaIzquierda(bicepsDerecho)).toBe(false);
    // El muslo va de y = 250 a 300 (la rodilla, más abajo).
    expect(bicepsDerecho.y).toBeGreaterThan(240);
    expect(bicepsDerecho.y).toBeLessThan(310);

    const aductorIzquierdo = dondeVa(lesion({ parte_cuerpo: "quadril_virilha", lado: "esquerdo", musculo: "adutores", musculo_especifico: "adutor_longo" }), mapa);
    expect(aductorIzquierdo).toMatchObject({ vista: "frente", codigo: "adutor_longo" });
    expect(aLaIzquierda(aductorIzquierdo)).toBe(false);
    const aductorDerecho = dondeVa(lesion({ parte_cuerpo: "quadril_virilha", lado: "direito", musculo_especifico: "adutor_longo" }), mapa);
    expect(aductorDerecho.x).toBeCloseTo(ANCHO - aductorIzquierdo.x, 5);
  });

  test("un tendón y un músculo de frente", () => {
    expect(dondeVa(lesion({ parte_cuerpo: "joelho", lado: "direito", musculo_especifico: "tendao_patelar" }), mapa)).toMatchObject({ vista: "frente", campo: "musculo_especifico" });
    expect(dondeVa(lesion({ parte_cuerpo: "coxa", lado: "esquerdo", musculo_especifico: "reto_femoral" }), mapa)).toMatchObject({ vista: "frente" });
  });

  test("solo el grupo muscular: en el medio de sus músculos de esa parte", () => {
    const isquios = dondeVa(lesion({ parte_cuerpo: "coxa", lado: "direito", musculo: "isquiotibiais" }), mapa);
    expect(isquios).toMatchObject({ vista: "espalda", campo: "musculo", codigo: "isquiotibiais" });
    const deltoides = dondeVa(lesion({ parte_cuerpo: "ombro", lado: "esquerdo", musculo: "deltoide" }), mapa);
    expect(deltoides).toMatchObject({ vista: "frente", campo: "musculo", codigo: "deltoide" });
    expect(aLaIzquierda(deltoides)).toBe(false);
  });

  test("un ligamento dibujado, o si no, en el medio de la parte", () => {
    expect(dondeVa(lesion({ parte_cuerpo: "joelho", lado: "esquerdo", ligamento: "lli" }), mapa)).toMatchObject({ vista: "frente", campo: "ligamento", codigo: "lli" });
    // El cruzado no se ve desde afuera: la rodilla.
    const cruzado = dondeVa(lesion({ parte_cuerpo: "joelho", lado: "direito", ligamento: "lca" }), mapa);
    expect(cruzado).toMatchObject({ vista: "frente", campo: "parte_cuerpo", codigo: "joelho" });
    expect(aLaIzquierda(cruzado)).toBe(true);
    expect(cruzado.y).toBeGreaterThan(295);
    expect(cruzado.y).toBeLessThan(335);
  });

  test("el tronco: cada lado en su mitad, y lo de atrás de espaldas", () => {
    const pectoralDerecho = dondeVa(lesion({ parte_cuerpo: "esterno", lado: "direito", musculo_especifico: "peitoral_maior" }), mapa);
    const pectoralIzquierdo = dondeVa(lesion({ parte_cuerpo: "esterno", lado: "esquerdo", musculo_especifico: "peitoral_maior" }), mapa);
    expect(aLaIzquierda(pectoralDerecho)).toBe(true);
    expect(aLaIzquierda(pectoralIzquierdo)).toBe(false);
    expect(dondeVa(lesion({ parte_cuerpo: "coluna_lombar" }), mapa)).toMatchObject({ vista: "espalda", campo: "parte_cuerpo" });
    expect(dondeVa(lesion({ parte_cuerpo: "abdomen", musculo_especifico: "abdominal" }), mapa)).toMatchObject({ vista: "frente", codigo: "abdominal" });
  });

  test("un grupo cargado en otra parte va en esa parte: los isquiotibiales en la rodilla, no en el medio del muslo", () => {
    const enLaRodilla = dondeVa(lesion({ parte_cuerpo: "joelho", lado: "direito", musculo: "isquiotibiais" }), mapa);
    expect(enLaRodilla).toMatchObject({ vista: "espalda", campo: "musculo", codigo: "isquiotibiais" });
    expect(enLaRodilla.y).toBeGreaterThan(295);
    expect(enLaRodilla.y).toBeLessThan(335);
    const enElMuslo = dondeVa(lesion({ parte_cuerpo: "coxa", lado: "direito", musculo: "isquiotibiais" }), mapa);
    expect(enElMuslo.y).toBeLessThan(enLaRodilla.y - 15);
  });

  test("el tronco sin músculo cargado: del lado del jugador, no en el medio", () => {
    const abdomenIzquierdo = dondeVa(lesion({ parte_cuerpo: "abdomen", lado: "esquerdo" }), mapa);
    expect(abdomenIzquierdo).toMatchObject({ vista: "frente", campo: "parte_cuerpo" });
    expect(abdomenIzquierdo.x).toBeGreaterThan(ANCHO / 2 + 5);
    // De espaldas, la derecha del jugador queda a la derecha.
    const lumbarDerecha = dondeVa(lesion({ parte_cuerpo: "coluna_lombar", lado: "direito" }), mapa);
    expect(lumbarDerecha.vista).toBe("espalda");
    expect(lumbarDerecha.x).toBeGreaterThan(ANCHO / 2 + 5);
    expect(dondeVa(lesion({ parte_cuerpo: "coluna_lombar" }), mapa).x).toBeCloseTo(ANCHO / 2, 0);
  });

  test("lo que se pinta: el músculo (o la parte) y la parte que lo recorta", () => {
    const biceps = dondeVa(lesion({ parte_cuerpo: "coxa", lado: "direito", musculo_especifico: "biceps_femoral_longa" }), mapa);
    expect(biceps.pintar.formas.length).toBeGreaterThan(0);
    expect(biceps.pintar.parte).toEqual(expect.any(String));
    expect(biceps.pintar.mitad).toBeNull();
    // La derecha del jugador, de espaldas, va espejada (del lado derecho de la pantalla).
    expect(biceps.pintar.espejada).toBe(true);
    const rodilla = dondeVa(lesion({ parte_cuerpo: "joelho", lado: "direito" }), mapa);
    expect(rodilla.pintar.formas).toEqual([rodilla.pintar.parte]);
    expect(rodilla.pintar.espejada).toBe(false);
    // El tronco sin músculo: la mitad del lado del jugador.
    expect(dondeVa(lesion({ parte_cuerpo: "abdomen", lado: "direito" }), mapa).pintar.mitad).toBe("izquierda");
    expect(dondeVa(lesion({ parte_cuerpo: "coluna_lombar", lado: "direito" }), mapa).pintar.mitad).toBe("derecha");
    expect(dondeVa(lesion({ parte_cuerpo: "coluna_lombar" }), mapa).pintar.mitad).toBeNull();
  });

  test("sin parte, o una pierna sin lado: no se sabe dónde va", () => {
    expect(dondeVa(lesion({}), mapa)).toBe(null);
    expect(dondeVa(lesion({ parte_cuerpo: "coxa" }), mapa)).toBe(null);
    expect(dondeVa({ id: "x" }, mapa)).toBe(null);
  });
});

describe("manchasDe", () => {
  test("las del mismo lugar se juntan; por vista y con más lesiones primero", () => {
    const manchas = manchasDe(
      [
        lesion({ parte_cuerpo: "coxa", lado: "direito", musculo_especifico: "biceps_femoral_longa" }, "1"),
        lesion({ parte_cuerpo: "coxa", lado: "direito", musculo_especifico: "biceps_femoral_longa" }, "2"),
        lesion({ parte_cuerpo: "coxa", lado: "esquerdo", musculo_especifico: "biceps_femoral_longa" }, "3"),
        lesion({ parte_cuerpo: "joelho", lado: "direito" }, "4"),
        lesion({ parte_cuerpo: "coxa" }, "5"),
      ],
      mapa,
    );
    expect(manchas.espalda.map((mancha) => [mancha.codigo, mancha.cantidad, aLaIzquierda(mancha)])).toEqual([
      ["biceps_femoral_longa", 2, false],
      ["biceps_femoral_longa", 1, true],
    ]);
    expect(manchas.frente.map((mancha) => [mancha.codigo, mancha.cantidad])).toEqual([["joelho", 1]]);
  });
});
