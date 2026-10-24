import { describe, expect, test } from "vitest";
import { diasPorTipo, familiaDeTipo, masAfectadosDe, resumenDelMapa, zonaConMas, zonaDeLesion } from "./mapaDelJugador.js";
import { FORMAS, LADO_A_LA_IZQUIERDA, TAMANO, ZONAS, paresDe, puntosDe } from "./zonasDeLaFigura.js";
import { OPCIONES } from "../domain/lesionesCampos.js";

// El mapa corporal del individual (Santiago, 23/10). Todo inventado.
const hoy = "2026-10-23";
const lesion = (id, fecha, alta, datos) => ({ id, fecha_lesion: fecha, fecha_alta: alta, datos });

describe("la zona de cada lesión", () => {
  test("el músculo si está dibujado; si no, la parte del cuerpo; si tampoco, ninguna", () => {
    expect(zonaDeLesion(lesion("a", hoy, null, { parte_cuerpo: "coxa", musculo: "isquiotibiais" }))).toMatchObject({ campo: "musculo", codigo: "isquiotibiais" });
    expect(zonaDeLesion(lesion("b", hoy, null, { parte_cuerpo: "joelho", ligamento: "lca" }))).toMatchObject({ campo: "parte_cuerpo", codigo: "joelho" });
    // Un músculo que el club agregó (sin dibujo): va a su parte.
    expect(zonaDeLesion(lesion("c", hoy, null, { parte_cuerpo: "coxa", musculo: "uno_del_club" }))).toMatchObject({ campo: "parte_cuerpo", codigo: "coxa" });
    expect(zonaDeLesion(lesion("d", hoy, null, { parte_cuerpo: "otra_del_club" }))).toBeNull();
  });

  test("la familia del tipo de lesión (la dona)", () => {
    expect(["muscular_2b", "sobrecarga_caibra", "tendinea", "entorse", "meniscal", "fratura", "hematoma", "del_club"].map(familiaDeTipo)).toEqual([
      "muscular",
      "muscular",
      "tendinosa",
      "articular",
      "articular",
      "osea",
      "otras",
      "otras",
    ]);
  });
});

describe("el resumen del mapa", () => {
  const LESIONES = [
    lesion("1", "2026-04-12", "2026-05-10", { parte_cuerpo: "coxa", lado: "direito", musculo: "isquiotibiais", musculo_especifico: "biceps_femoral", tipo_lesion: "muscular_2b" }),
    lesion("2", "2025-10-18", "2025-11-25", { parte_cuerpo: "coxa", lado: "esquerdo", musculo: "isquiotibiais", musculo_especifico: "semitendinoso", tipo_lesion: "muscular_1b" }),
    lesion("3", "2026-10-13", null, { parte_cuerpo: "coxa", lado: "direito", musculo: "isquiotibiais", musculo_especifico: "biceps_femoral", tipo_lesion: "muscular_1a" }),
    lesion("4", "2022-04-04", "2022-08-20", { parte_cuerpo: "joelho", lado: "nao_se_aplica", ligamento: "lca", tipo_lesion: "entorse" }),
    lesion("5", "2021-05-05", "2021-05-12", { parte_cuerpo: "parte_del_club", tipo_lesion: "luxacao" }),
  ];

  test("por zona: cuántas, los días perdidos (la abierta, hasta hoy) y de qué lado; lo que no tiene dónde, aparte", () => {
    const { zonas, sinZona, maximo } = resumenDelMapa(LESIONES, hoy);
    const isquios = zonas.get("musculo:isquiotibiais");
    expect(isquios).toMatchObject({ cantidad: 3, dias: 28 + 38 + 10, porLado: { direito: 2, esquerdo: 1, ambos: 0 } });
    expect(zonas.get("parte_cuerpo:joelho")).toMatchObject({ cantidad: 1, porLado: { direito: 0, esquerdo: 0, ambos: 1 } });
    expect(sinZona).toBe(1);
    // Lo más que se pinta en un lado.
    expect(maximo).toBe(2);
    expect(zonaConMas(zonas)).toBe("musculo:isquiotibiais");
  });

  test("la dona: el % de cada familia sobre todas las del período", () => {
    expect(resumenDelMapa(LESIONES, hoy).tipos).toEqual([
      { familia: "muscular", cantidad: 3, porcentaje: 60 },
      { familia: "articular", cantidad: 2, porcentaje: 40 },
    ]);
    expect(resumenDelMapa([], hoy)).toMatchObject({ tipos: [], sinZona: 0, maximo: 0 });
    expect(zonaConMas(resumenDelMapa([], hoy).zonas)).toBe("");
  });

  test("los días perdidos de cada tipo de lesión, de más a menos (la abierta, hasta hoy)", () => {
    expect(diasPorTipo(LESIONES, hoy)).toEqual([
      { codigo: "entorse", dias: 138, cantidad: 1 },
      { codigo: "muscular_1b", dias: 38, cantidad: 1 },
      { codigo: "muscular_2b", dias: 28, cantidad: 1 },
      { codigo: "muscular_1a", dias: 10, cantidad: 1 },
      { codigo: "luxacao", dias: 7, cantidad: 1 },
    ]);
    expect(diasPorTipo([], hoy)).toEqual([]);
  });

  test("lo más afectado: lo más preciso de cada lesión, de más a menos", () => {
    expect(masAfectadosDe(LESIONES)).toEqual([
      { campo: "musculo_especifico", codigo: "biceps_femoral", cantidad: 2 },
      { campo: "musculo_especifico", codigo: "semitendinoso", cantidad: 1 },
      { campo: "ligamento", codigo: "lca", cantidad: 1 },
    ]);
  });
});

describe("las zonas de la figura", () => {
  test("cada código existe en la lista de su campo y cada forma está dibujada en su vista", () => {
    ZONAS.forEach((zona) => {
      expect(OPCIONES[zona.campo].map((opcion) => opcion.codigo)).toContain(zona.codigo);
      Object.entries(zona.formas).forEach(([vista, formas]) => formas.forEach((forma) => expect(FORMAS[vista][forma], `${zona.codigo} ${vista} ${forma}`).toBeTruthy()));
    });
  });

  test("los puntos caen adentro de la imagen; el otro lado es el espejo sobre el eje", () => {
    Object.entries(FORMAS).forEach(([vista, formas]) =>
      Object.keys(formas).forEach((forma) =>
        ["direito", "esquerdo"].forEach((lado) =>
          paresDe(vista, forma, lado).forEach(([x, y]) => {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(TAMANO[vista].ancho);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(TAMANO[vista].alto);
          }),
        ),
      ),
    );
    // De frente, la derecha del jugador queda a la izquierda de quien mira.
    expect(LADO_A_LA_IZQUIERDA).toEqual({ frente: "direito", espalda: "esquerdo" });
    const derecha = paresDe("frente", "rodilla", "direito");
    const izquierda = paresDe("frente", "rodilla", "esquerdo");
    expect(izquierda.map(([x, y]) => [2 * FORMAS.frente.rodilla.eje - x, y])).toEqual(derecha);
    // Lo del medio no tiene lado.
    expect(puntosDe("frente", "abdomen", "direito")).toBe(puntosDe("frente", "abdomen", "esquerdo"));
  });
});
