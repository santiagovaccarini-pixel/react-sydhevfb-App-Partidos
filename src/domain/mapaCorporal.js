// El cuerpo para cargar una lesión, de lo grande a lo chico y solo con las
// opciones del catálogo (lesionesCampos.js): región (lo que se toca en la
// figura) → parte del cuerpo → estructura (grupo muscular, músculo o tendón,
// ligamento) → área. Qué estructura va con cada parte es anatomía que el
// Excel no tiene: este es el mapa por defecto y, como el resto del
// protocolo, más adelante se va a poder cambiar por club (regla del 02/10).

// Las regiones de la figura. `lado` es el que queda cargado al tocarla; las
// del medio no tienen y dejan elegirlo.
export const REGIONES = [
  { clave: "cabeza", lado: null, partes: ["cabeca_face", "pescoco"] },
  { clave: "tronco", lado: null, partes: ["esterno", "abdomen", "coluna_lombar"] },
  { clave: "brazo_derecho", lado: "direito", partes: ["ombro", "braco", "cotovelo", "antebraco", "punho", "mao"] },
  { clave: "brazo_izquierdo", lado: "esquerdo", partes: ["ombro", "braco", "cotovelo", "antebraco", "punho", "mao"] },
  { clave: "pierna_derecha", lado: "direito", partes: ["quadril_virilha", "coxa", "joelho", "perna_aquiles", "tornozelo_pe", "pe_dedo"] },
  { clave: "pierna_izquierda", lado: "esquerdo", partes: ["quadril_virilha", "coxa", "joelho", "perna_aquiles", "tornozelo_pe", "pe_dedo"] },
];

// Lo que tiene cada parte. `musculos`: por grupo muscular (la columna
// "Músculo afectado"), sus músculos específicos; la clave "" son músculos o
// tendones del catálogo que no tienen grupo. `ligamentos`: la columna
// "Ligamento específico" (los meniscos están ahí en el Excel).
export const ESTRUCTURAS = {
  cabeca_face: { musculos: {}, ligamentos: [] },
  pescoco: { musculos: {}, ligamentos: [] },
  esterno: { musculos: { peitoral: ["peitoral_maior", "peitoral_menor"], dorsal: [] }, ligamentos: [] },
  abdomen: { musculos: { "": ["abdominal", "obliquo_externo", "obliquo_interno"] }, ligamentos: [] },
  coluna_lombar: { musculos: { psoas_iliaco: ["psoas"], dorsal: [] }, ligamentos: [] },
  ombro: { musculos: { deltoide: [], peitoral: ["peitoral_maior"], "": ["manguito_rotador"] }, ligamentos: [] },
  braco: { musculos: { biceps: [], triceps_braquial: [] }, ligamentos: [] },
  cotovelo: { musculos: {}, ligamentos: [] },
  antebraco: { musculos: {}, ligamentos: [] },
  punho: { musculos: {}, ligamentos: [] },
  mao: { musculos: {}, ligamentos: [] },
  quadril_virilha: {
    musculos: {
      adutores: ["adutor_longo", "adutor_curto", "adutor_magno"],
      psoas_iliaco: ["psoas"],
      quadriceps: ["reto_femoral"],
      gluteos: ["gluteo_maximo", "gluteo_medio", "gluteo_minimo"],
      rotadores_quadril: ["piriforme", "obturador_interno", "obturador_externo"],
      "": ["sartorio", "tensor_fascia_lata"],
    },
    ligamentos: [],
  },
  coxa: {
    musculos: {
      quadriceps: ["reto_femoral", "vasto_lateral", "vasto_medial", "vasto_intermedio", "tendao_quadriceps"],
      isquiotibiais: [
        "biceps_femoral",
        "biceps_femoral_longa",
        "biceps_femoral_curta",
        "semitendinoso",
        "semimembranoso",
        "tendao_conjunto",
        "tendao_conjunto_livre",
        "tendao_conjunto_bf_st",
      ],
      adutores: ["adutor_longo", "adutor_curto", "adutor_magno"],
      "": ["sartorio", "tensor_fascia_lata"],
    },
    ligamentos: [],
  },
  joelho: {
    musculos: { quadriceps: ["tendao_quadriceps"], "": ["tendao_patelar"] },
    ligamentos: ["lca", "lcp", "lli", "lle", "menisco_medial", "menisco_lateral"],
  },
  perna_aquiles: {
    musculos: {
      panturrilha: ["gastrocnemio_medial", "gastrocnemio_lateral", "soleo", "plantar"],
      triceps_sural: ["gastrocnemio_medial", "gastrocnemio_lateral", "soleo"],
      soleo: ["soleo"],
      "": ["tendao_aquiles"],
    },
    ligamentos: ["membrana_interossea"],
  },
  tornozelo_pe: {
    musculos: { "": ["tendao_aquiles"] },
    ligamentos: [
      "lle_anterior",
      "lle_medio",
      "lle_posterior",
      "lle_anterior_medio",
      "lle_medio_posterior",
      "lle_anterior_medio_posterior",
      "lli_deltoide",
      "tibiofibular_anterior",
      "tibiofibular_anterior_posterior",
      "membrana_interossea",
    ],
  },
  pe_dedo: {
    musculos: { musculos_pe: ["adutor_halux"], fascia_plantar_insercao: [], fascia_plantar_nao_insercao: [] },
    ligamentos: [],
  },
};

// De espaldas se ve primero lo de atrás (los isquiotibiales en el muslo, la
// pantorrilla en la pierna, los glúteos en la cadera).
export const DE_ESPALDAS_PRIMERO = {
  quadril_virilha: ["gluteos", "rotadores_quadril"],
  coxa: ["isquiotibiais"],
  esterno: ["dorsal"],
  coluna_lombar: ["dorsal"],
};

// El área de una lesión muscular, por tercio del músculo (de lo grande a lo
// chico: tercio → unión).
export const AREAS_POR_TERCIO = {
  proximal: ["proximal_umtp", "proximal_umtc_com", "proximal_umtc_sem", "proximal_tendao_livre", "proximal_umtm", "proximal_umf", "insercao_proximal"],
  medio: ["medio_umtp", "medio_umtc_com", "medio_umtc_sem", "medio_umtm", "medio_umf"],
  distal: ["distal_umtp", "distal_umtc_com", "distal_umtc_sem", "distal_tendao_livre", "distal_umtm", "distal_umf", "insercao_distal"],
  general: ["muscular", "mioaponeurotica"],
};

const unicos = (lista) => [...new Set(lista)];

export const regionPorClave = (clave) => REGIONES.find((region) => region.clave === clave) || null;

// En qué región de la figura está una parte del cuerpo con su lado: el brazo
// o la pierna de ese lado, o la del medio (cabeza y tronco).
export const regionDe = (parte, lado) => {
  const candidatas = REGIONES.filter((region) => region.partes.includes(parte));
  if (candidatas.length <= 1) return candidatas[0]?.clave || null;
  return (candidatas.find((region) => region.lado === lado) || candidatas[0]).clave;
};

// Lo que se ofrece en una parte, en orden: de espaldas, lo de atrás primero.
export const estructurasDe = (parte, { vista = "frente" } = {}) => {
  const mapa = ESTRUCTURAS[parte];
  if (!mapa) return { musculos: [], especificos: [], ligamentos: [] };
  const grupos = Object.keys(mapa.musculos).filter(Boolean);
  const atras = vista === "espalda" ? DE_ESPALDAS_PRIMERO[parte] || [] : [];
  const musculos = [...atras.filter((grupo) => grupos.includes(grupo)), ...grupos.filter((grupo) => !atras.includes(grupo))];
  const especificos = unicos([...musculos.flatMap((grupo) => mapa.musculos[grupo]), ...(mapa.musculos[""] || [])]);
  return { musculos, especificos, ligamentos: [...mapa.ligamentos] };
};

// Los músculos específicos de un grupo en esa parte (todos los de la parte si
// el grupo no está en el mapa).
export const especificosDe = (parte, grupo) => {
  const mapa = ESTRUCTURAS[parte];
  if (!mapa) return [];
  if (grupo && mapa.musculos[grupo]) return [...mapa.musculos[grupo]];
  return estructurasDe(parte).especificos;
};

// El tercio de un área ("proximal", "medio", "distal" o "general"), o null
// si es una opción que el mapa no conoce.
export const tercioDeArea = (codigo) => Object.entries(AREAS_POR_TERCIO).find(([, areas]) => areas.includes(codigo))?.[0] || null;
