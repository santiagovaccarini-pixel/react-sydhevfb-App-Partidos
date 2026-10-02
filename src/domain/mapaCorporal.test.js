import { describe, expect, test } from "vitest";
import { AREAS_POR_TERCIO, ESTRUCTURAS, REGIONES, especificosDe, estructurasDe, regionDe, tercioDeArea } from "./mapaCorporal.js";
import { OPCIONES } from "./lesionesCampos.js";

const codigos = (campo) => OPCIONES[campo].map((opcion) => opcion.codigo);

describe("el cuerpo usa solo las opciones del catálogo, y todas", () => {
  test("cada parte del cuerpo está en una región de la figura", () => {
    const enLaFigura = new Set(REGIONES.flatMap((region) => region.partes));
    expect([...enLaFigura].sort()).toEqual(codigos("parte_cuerpo").sort());
    expect(Object.keys(ESTRUCTURAS).sort()).toEqual(codigos("parte_cuerpo").sort());
  });

  test("cada músculo, músculo específico, ligamento y área del catálogo tiene su lugar", () => {
    const mapas = Object.values(ESTRUCTURAS);
    const grupos = new Set(mapas.flatMap((mapa) => Object.keys(mapa.musculos).filter(Boolean)));
    const especificos = new Set(mapas.flatMap((mapa) => Object.values(mapa.musculos).flat()));
    const ligamentos = new Set(mapas.flatMap((mapa) => mapa.ligamentos));
    expect([...grupos].sort()).toEqual(codigos("musculo").sort());
    expect([...especificos].sort()).toEqual(codigos("musculo_especifico").sort());
    expect([...ligamentos].sort()).toEqual(codigos("ligamento").sort());
    expect(Object.values(AREAS_POR_TERCIO).flat().sort()).toEqual(codigos("area").sort());
  });

  test("nada inventado: todo código del mapa existe en el catálogo", () => {
    const todos = (campo) => new Set(codigos(campo));
    Object.entries(ESTRUCTURAS).forEach(([parte, mapa]) => {
      Object.entries(mapa.musculos).forEach(([grupo, lista]) => {
        if (grupo) expect(todos("musculo").has(grupo), `${parte}: ${grupo}`).toBe(true);
        lista.forEach((codigo) => expect(todos("musculo_especifico").has(codigo), `${parte}: ${codigo}`).toBe(true));
      });
      mapa.ligamentos.forEach((codigo) => expect(todos("ligamento").has(codigo), `${parte}: ${codigo}`).toBe(true));
    });
    REGIONES.forEach((region) => region.lado && expect(todos("lado").has(region.lado)).toBe(true));
  });
});

describe("de lo grande a lo chico", () => {
  test("una parte con su lado cae en el brazo o la pierna de ese lado; lo del medio, en su región", () => {
    expect(regionDe("joelho", "direito")).toBe("pierna_derecha");
    expect(regionDe("joelho", "esquerdo")).toBe("pierna_izquierda");
    expect(regionDe("ombro", "esquerdo")).toBe("brazo_izquierdo");
    expect(regionDe("abdomen", "direito")).toBe("tronco");
    expect(regionDe("cabeca_face", null)).toBe("cabeza");
    expect(regionDe("inventada", "direito")).toBe(null);
  });

  test("en el muslo: grupos, músculos y nada de ligamentos; de espaldas, los isquiotibiales primero", () => {
    const deFrente = estructurasDe("coxa");
    expect(deFrente.musculos).toEqual(["quadriceps", "isquiotibiais", "adutores"]);
    expect(deFrente.ligamentos).toEqual([]);
    expect(deFrente.especificos).toContain("biceps_femoral_longa");
    expect(deFrente.especificos).toContain("sartorio");
    expect(estructurasDe("coxa", { vista: "espalda" }).musculos[0]).toBe("isquiotibiais");
    expect(especificosDe("coxa", "quadriceps")).toEqual(["reto_femoral", "vasto_lateral", "vasto_medial", "vasto_intermedio", "tendao_quadriceps"]);
    // Sin grupo (o uno que el mapa no tiene), todos los de la parte.
    expect(especificosDe("coxa", null)).toEqual(deFrente.especificos);
    expect(especificosDe("coxa", "biceps")).toEqual(deFrente.especificos);
  });

  test("la rodilla y el tobillo tienen sus ligamentos; el codo, nada en el catálogo", () => {
    expect(estructurasDe("joelho").ligamentos).toEqual(["lca", "lcp", "lli", "lle", "menisco_medial", "menisco_lateral"]);
    expect(estructurasDe("tornozelo_pe").ligamentos).toContain("lli_deltoide");
    expect(estructurasDe("cotovelo")).toEqual({ musculos: [], especificos: [], ligamentos: [] });
    expect(estructurasDe("inventada")).toEqual({ musculos: [], especificos: [], ligamentos: [] });
  });

  test("el área va por tercio del músculo", () => {
    expect(tercioDeArea("proximal_umtc_com")).toBe("proximal");
    expect(tercioDeArea("insercao_distal")).toBe("distal");
    expect(tercioDeArea("muscular")).toBe("general");
    expect(tercioDeArea("inventada")).toBe(null);
  });
});
