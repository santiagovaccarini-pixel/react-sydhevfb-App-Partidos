import { describe, expect, test } from "vitest";
import {
  AREAS_POR_TERCIO,
  ESTRUCTURAS,
  PARTES,
  REGIONES,
  crearMapa,
  especificoQueNoEsDe,
  especificosDe,
  estructurasDe,
  estructurasQueNoSonDe,
  gruposDe,
  partesDeOpcion,
  partesPorNombre,
  regionDe,
  tercioDeArea,
  tercioPorNombre,
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
  });

  test("en cada parte también está lo que se inserta o nace ahí", () => {
    // En la rodilla: los tendones de los isquiotibiales, el origen de los gemelos, el rotuliano.
    expect(estructurasDe("joelho").musculos).toEqual(["quadriceps", "isquiotibiais", "panturrilha", "triceps_sural"]);
    expect(estructurasDe("joelho").especificos).toEqual(expect.arrayContaining(["semitendinoso", "biceps_femoral", "gastrocnemio_medial", "tendao_patelar", "tendao_quadriceps"]));
    // En la cadera: el origen de los isquiotibiales y la pared del abdomen que llega al pubis.
    expect(estructurasDe("quadril_virilha").especificos).toEqual(expect.arrayContaining(["biceps_femoral_longa", "abdominal", "reto_femoral"]));
    // El tendón de Aquiles es de la pantorrilla (tríceps sural) y se inserta en el tobillo.
    expect(especificosDe("perna_aquiles", "triceps_sural")).toContain("tendao_aquiles");
    expect(estructurasDe("tornozelo_pe").especificos).toContain("tendao_aquiles");
    // De espaldas, en la rodilla van primero los de atrás.
    expect(estructurasDe("joelho", { vista: "espalda" }).musculos.slice(0, 3)).toEqual(["isquiotibiais", "panturrilha", "triceps_sural"]);
  });

  test("una parte que el mapa no conoce ofrece todo: no queda nada afuera", () => {
    const todo = estructurasDe("inventada");
    expect(todo.musculos.sort()).toEqual(codigos("musculo").sort());
    expect(todo.especificos.sort()).toEqual(codigos("musculo_especifico").sort());
    expect(todo.ligamentos.sort()).toEqual(codigos("ligamento").sort());
  });

  test("al cambiar de parte se borra lo que era de la otra; lo que el mapa no conoce queda", () => {
    const delMuslo = { musculo: "isquiotibiais", musculo_especifico: "biceps_femoral_longa", area: "proximal_umtc_com", ligamento: null };
    expect(estructurasQueNoSonDe("tornozelo_pe", delMuslo)).toEqual({ musculo: null, musculo_especifico: null, area: null });
    // En la rodilla también están los isquiotibiales: queda todo.
    expect(estructurasQueNoSonDe("joelho", delMuslo)).toEqual({});
    // De la cadera al muslo, los aductores siguen valiendo.
    expect(estructurasQueNoSonDe("coxa", { musculo: "adutores", musculo_especifico: "adutor_longo", area: "medio_umtp" })).toEqual({});
    // El ligamento de la rodilla no es del tobillo; una opción que el mapa no conoce queda.
    expect(estructurasQueNoSonDe("tornozelo_pe", { ligamento: "lca", musculo: "propio_del_club" })).toEqual({ ligamento: null });
    // Si queda un músculo, el área también.
    expect(estructurasQueNoSonDe("joelho", { musculo: "quadriceps", musculo_especifico: "vasto_lateral", area: "distal_umtp" })).toEqual({ musculo_especifico: null });
  });

  test("al cambiar de grupo, el músculo de otro grupo de esa parte se borra", () => {
    expect(especificoQueNoEsDe("coxa", "isquiotibiais", "reto_femoral")).toBe(true);
    expect(especificoQueNoEsDe("coxa", "quadriceps", "reto_femoral")).toBe(false);
    expect(especificoQueNoEsDe("coxa", null, "reto_femoral")).toBe(false);
    // Uno que el mapa no conoce en esa parte queda.
    expect(especificoQueNoEsDe("coxa", "isquiotibiais", "propio_del_club")).toBe(false);
  });

  test("los grupos de un músculo en una parte: uno solo completa el grupo; dos, no", () => {
    expect(gruposDe("coxa", "biceps_femoral_longa")).toEqual(["isquiotibiais"]);
    expect(gruposDe("joelho", "gastrocnemio_medial")).toEqual(["panturrilha", "triceps_sural"]);
    expect(gruposDe("joelho", "tendao_patelar")).toEqual([]);
  });

  test("el área va por tercio del músculo", () => {
    expect(tercioDeArea("proximal_umtc_com")).toBe("proximal");
    expect(tercioDeArea("insercao_distal")).toBe("distal");
    expect(tercioDeArea("muscular")).toBe("general");
    expect(tercioDeArea("inventada")).toBe(null);
  });
});

describe("las opciones que agrega el club se ubican solas por su nombre", () => {
  test("cada opción del catálogo, por su nombre, cae donde dice el mapa (o no se sabe)", () => {
    ["parte_cuerpo", "musculo", "musculo_especifico", "ligamento"].forEach((campo) => {
      OPCIONES[campo].forEach((opcion) => {
        const porNombre = partesPorNombre(...Object.values(opcion.etiquetas));
        const enElMapa = partesDeOpcion(campo, opcion.codigo);
        if (porNombre.length) expect(porNombre.some((parte) => enElMapa.includes(parte)), `${campo}.${opcion.codigo}: ${porNombre}`).toBe(true);
        if (campo === "parte_cuerpo") expect(porNombre, opcion.codigo).toContain(opcion.codigo);
      });
    });
    OPCIONES.area.forEach((opcion) => {
      const delMapa = tercioDeArea(opcion.codigo);
      expect(tercioPorNombre(...Object.values(opcion.etiquetas)), opcion.codigo).toBe(delMapa === "general" ? null : delMapa);
    });
  });

  test("en castellano o en portugués, con o sin tildes", () => {
    expect(partesPorNombre("Gemelo interno")).toEqual(["joelho", "perna_aquiles"]);
    expect(partesPorNombre("Rótula")).toEqual(["joelho"]);
    expect(partesPorNombre("PATELA")).toEqual(["joelho"]);
    expect(partesPorNombre("Pubalgia")).toEqual(["quadril_virilha"]);
    expect(partesPorNombre("Dedo del pie")).toEqual(["pe_dedo"]);
    expect(partesPorNombre("Dedo")).toEqual(["mao", "pe_dedo"]);
    expect(partesPorNombre("Escafoides")).toEqual(["punho"]);
    expect(partesPorNombre("Trapecio")).toEqual(["pescoco", "esterno", "ombro"]);
    expect(partesPorNombre("Supraespinoso")).toEqual(["ombro"]);
    expect(partesPorNombre("Peroneo largo")).toEqual(["perna_aquiles", "tornozelo_pe"]);
    expect(partesPorNombre("Fascite plantar")).toEqual(["tornozelo_pe", "pe_dedo"]);
    expect(partesPorNombre("Lig. deltoideo")).toEqual(["tornozelo_pe"]);
    expect(partesPorNombre("Deltoides anterior")).toEqual(["ombro", "braco"]);
    expect(partesPorNombre("Labrum acetabular")).toEqual(["quadril_virilha"]);
    expect(partesPorNombre("Columna dorsal")).toEqual(["esterno"]);
    expect(partesPorNombre("Mão"), "portugués").toEqual(["mao"]);
    expect(partesPorNombre("Glúteo médio")).toEqual(["coluna_lombar", "quadril_virilha"]);
    // "Cabeza larga" o "cara anterior" no son la cabeza.
    expect(partesPorNombre("Bíceps femoral (cabeza larga)")).toEqual(["quadril_virilha", "coxa", "joelho"]);
    expect(partesPorNombre("Cara posterior del muslo")).toEqual(["coxa"]);
    expect(partesPorNombre("Bíceps braquial")).toEqual(["ombro", "braco", "cotovelo"]);
    expect(partesPorNombre("Lesión rara")).toEqual([]);
    expect(tercioPorNombre("Unión miotendinosa distal")).toBe("distal");
    expect(tercioPorNombre("Proximal y medio")).toBe(null);
  });

  // Las listas como vienen de la configuración del club.
  const op = (codigo, es, pt = "") => ({ codigo, etiquetas: { "es-AR": es, "pt-BR": pt }, oculto: false });
  const delClub = (campo, ...agregadas) => [...OPCIONES[campo].map((opcion) => ({ ...opcion, oculto: false })), ...agregadas];
  const mapa = crearMapa({
    parte_cuerpo: delClub("parte_cuerpo", op("rotula_x", "Rótula"), op("rara_x", "Zona rara")),
    musculo: delClub("musculo", op("gemelos_x", "Gemelos")),
    musculo_especifico: delClub("musculo_especifico", op("gemelo_interno_x", "Gemelo interno", "Gastrocnêmio medial"), op("raro_x", "Músculo raro")),
    ligamento: delClub("ligamento", op("lpa_x", "Ligamento peroneoastragalino anterior")),
    area: delClub("area", op("distal_x", "Unión miotendinosa distal"), op("otra_area_x", "Cicatriz")),
  });

  test("un músculo del club va donde dice su nombre; el que no se reconoce, en todas las partes", () => {
    expect(mapa.estructurasDe("perna_aquiles").especificos).toContain("gemelo_interno_x");
    expect(mapa.estructurasDe("joelho").especificos).toContain("gemelo_interno_x");
    expect(mapa.estructurasDe("coxa").especificos).not.toContain("gemelo_interno_x");
    expect(mapa.estructurasDe("perna_aquiles").musculos).toContain("gemelos_x");
    PARTES.forEach((parte) => expect(mapa.estructurasDe(parte).especificos, parte).toContain("raro_x"));
    expect(mapa.estructurasDe("tornozelo_pe").ligamentos).toContain("lpa_x");
    expect(mapa.estructurasDe("joelho").ligamentos).not.toContain("lpa_x");
    // Con un grupo elegido, los del club (de los que no se sabe el grupo) siguen a la vista.
    expect(mapa.especificosDe("perna_aquiles", "soleo")).toEqual(["soleo", "gemelo_interno_x", "raro_x"]);
    // Y dice dónde va cada uno (para Ajustes).
    expect(mapa.partesDeOpcion("musculo_especifico", "gemelo_interno_x")).toEqual(["joelho", "perna_aquiles"]);
    expect(mapa.partesDeOpcion("musculo_especifico", "raro_x")).toBe(null);
    expect(mapa.partesDeOpcion("musculo", "isquiotibiais")).toEqual(["quadril_virilha", "coxa", "joelho"]);
  });

  test("al cambiar de parte, lo del club que va en otra se borra y lo que no se reconoce queda", () => {
    expect(mapa.estructurasQueNoSonDe("coxa", { musculo_especifico: "gemelo_interno_x" })).toEqual({ musculo_especifico: null });
    expect(mapa.estructurasQueNoSonDe("coxa", { musculo_especifico: "raro_x" })).toEqual({});
  });

  test("una parte del club va en la figura con la parte que nombra; la que no se reconoce, en todas las regiones", () => {
    expect(mapa.partesDeRegion("pierna_derecha")).toEqual(["quadril_virilha", "coxa", "joelho", "rotula_x", "perna_aquiles", "tornozelo_pe", "pe_dedo", "rara_x"]);
    expect(mapa.partesDeRegion("cabeza")).toEqual(["cabeca_face", "pescoco", "rara_x"]);
    expect(mapa.regionDe("rotula_x", "esquerdo")).toBe("pierna_izquierda");
    expect(mapa.piezaDe("rotula_x", "pierna_izquierda")).toBe("joelho");
    expect(mapa.estructurasDe("rotula_x").ligamentos).toContain("lca");
    // La que no se reconoce no se pinta en ninguna y ofrece todo.
    expect(mapa.regionDe("rara_x", "direito")).toBe(null);
    expect(mapa.piezaDe("rara_x", "pierna_derecha")).toBe(null);
    expect(mapa.estructurasDe("rara_x").ligamentos).toHaveLength(codigos("ligamento").length + 1);
  });

  test("un área del club va en el tercio que nombra", () => {
    expect(mapa.tercioDeArea("distal_x")).toBe("distal");
    expect(mapa.tercioDeArea("otra_area_x")).toBe(null);
    expect(mapa.tercioDeArea("muscular")).toBe("general");
  });
});
