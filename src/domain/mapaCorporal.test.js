import { describe, expect, test } from "vitest";
import {
  AREAS_POR_TERCIO,
  ESTRUCTURAS,
  REGIONES,
  especificoQueNoEsDe,
  especificosDe,
  estructurasDe,
  estructurasQueNoSonDe,
  regionDe,
  tercioDeArea,
} from "./mapaCorporal.js";
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
    // Una rodilla sin lado derecho o izquierdo no se dibuja como la derecha.
    expect(regionDe("joelho", "nao_se_aplica")).toBe(null);
    expect(regionDe("joelho", null)).toBe(null);
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

  test("la rodilla y el tobillo tienen sus ligamentos; el codo, los tendones del bíceps y del tríceps; la mano, nada en el catálogo", () => {
    expect(estructurasDe("joelho").ligamentos).toEqual(["lca", "lcp", "lli", "lle", "menisco_medial", "menisco_lateral"]);
    expect(estructurasDe("tornozelo_pe").ligamentos).toContain("lli_deltoide");
    expect(estructurasDe("cotovelo").musculos).toEqual(["biceps", "triceps_braquial"]);
    expect(estructurasDe("mao")).toEqual({ musculos: [], especificos: [], ligamentos: [] });
    expect(estructurasDe("inventada")).toEqual({ musculos: [], especificos: [], ligamentos: [] });
  });

  test("al cambiar de parte se borra lo que era de la otra; lo que el mapa no conoce queda", () => {
    const delMuslo = { musculo: "isquiotibiais", musculo_especifico: "biceps_femoral_longa", area: "proximal_umtc_com", ligamento: null };
    expect(estructurasQueNoSonDe("joelho", delMuslo)).toEqual({ musculo: null, musculo_especifico: null, area: null });
    // De la cadera al muslo, los aductores siguen valiendo.
    expect(estructurasQueNoSonDe("coxa", { musculo: "adutores", musculo_especifico: "adutor_longo", area: "medio_umtp" })).toEqual({});
    // El ligamento de la rodilla no es del tobillo; una opción del club queda.
    expect(estructurasQueNoSonDe("tornozelo_pe", { ligamento: "lca", musculo: "propio_del_club" })).toEqual({ ligamento: null });
    // Si queda un músculo, el área también.
    expect(estructurasQueNoSonDe("joelho", { musculo: "quadriceps", musculo_especifico: "vasto_lateral", area: "distal_umtp" })).toEqual({ musculo_especifico: null });
  });

  test("al cambiar de grupo, el músculo de otro grupo de esa parte se borra", () => {
    expect(especificoQueNoEsDe("coxa", "isquiotibiais", "reto_femoral")).toBe(true);
    expect(especificoQueNoEsDe("coxa", "quadriceps", "reto_femoral")).toBe(false);
    expect(especificoQueNoEsDe("coxa", null, "reto_femoral")).toBe(false);
    // Uno que el mapa no conoce en esa parte (del club, o de "Otro…") queda.
    expect(especificoQueNoEsDe("coxa", "isquiotibiais", "propio_del_club")).toBe(false);
  });

  test("el área va por tercio del músculo", () => {
    expect(tercioDeArea("proximal_umtc_com")).toBe("proximal");
    expect(tercioDeArea("insercao_distal")).toBe("distal");
    expect(tercioDeArea("muscular")).toBe("general");
    expect(tercioDeArea("inventada")).toBe(null);
  });
});
