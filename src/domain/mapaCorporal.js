import { OPCIONES } from "./lesionesCampos.js";

// El cuerpo para cargar una lesión, de lo grande a lo chico y solo con las
// opciones de las listas: región (lo que se toca en la figura) → parte del
// cuerpo → estructura (grupo muscular, músculo o tendón, ligamento) → área.
// Qué estructura va con cada parte es anatomía que el Excel no tiene: este
// es el mapa por defecto y, como el resto del protocolo, más adelante se va
// a poder cambiar por club (regla del 02/10). Las opciones que agrega un club
// se ubican solas por su nombre (crearMapa).

const unicos = (lista) => [...new Set(lista)];

// Los campos de la lesión que se eligen en el cuerpo.
export const CAMPOS_DEL_CUERPO = ["parte_cuerpo", "musculo", "musculo_especifico", "ligamento", "area"];

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

// Las partes del cuerpo del catálogo, de la cabeza a los pies.
export const PARTES = unicos(REGIONES.flatMap((region) => region.partes));

// Lo que tiene cada parte: lo que está en ella y lo que se inserta o nace
// ahí. `musculos`: por grupo muscular (la columna "Músculo afectado"), sus
// músculos y tendones específicos; la clave "" son los del catálogo que no
// tienen grupo. `ligamentos`: la columna "Ligamento específico" (los
// meniscos están ahí en el Excel).
export const ESTRUCTURAS = {
  cabeca_face: { musculos: {}, ligamentos: [] },
  pescoco: { musculos: {}, ligamentos: [] },
  // El pecho y la espalda alta: el pectoral adelante, el dorsal atrás.
  esterno: { musculos: { peitoral: ["peitoral_maior", "peitoral_menor"], dorsal: [] }, ligamentos: [] },
  abdomen: { musculos: { "": ["abdominal", "obliquo_externo", "obliquo_interno"] }, ligamentos: [] },
  // En la columna lumbar, el sacro y la pelvis nacen el psoas, el dorsal,
  // los glúteos y el piriforme.
  coluna_lombar: {
    musculos: { psoas_iliaco: ["psoas"], dorsal: [], gluteos: ["gluteo_maximo", "gluteo_medio", "gluteo_minimo"], rotadores_quadril: ["piriforme"] },
    ligamentos: [],
  },
  // El hombro: el deltoides y el manguito rotador; ahí se insertan el
  // pectoral y el dorsal, y nacen el bíceps y el tríceps.
  ombro: {
    musculos: { deltoide: [], peitoral: ["peitoral_maior", "peitoral_menor"], dorsal: [], biceps: [], triceps_braquial: [], "": ["manguito_rotador"] },
    ligamentos: [],
  },
  // En el brazo, el bíceps, el tríceps y donde se inserta el deltoides.
  braco: { musculos: { biceps: [], triceps_braquial: [], deltoide: [] }, ligamentos: [] },
  // En el codo se insertan los tendones del bíceps y del tríceps.
  cotovelo: { musculos: { biceps: [], triceps_braquial: [] }, ligamentos: [] },
  antebraco: { musculos: {}, ligamentos: [] },
  punho: { musculos: {}, ligamentos: [] },
  mao: { musculos: {}, ligamentos: [] },
  // La cadera y la ingle: aductores, psoas, glúteos y rotadores; el origen
  // del recto femoral y de los isquiotibiales (en el isquion), el sartorio,
  // el tensor de la fascia lata y la pared del abdomen que llega al pubis.
  quadril_virilha: {
    musculos: {
      adutores: ["adutor_longo", "adutor_curto", "adutor_magno"],
      psoas_iliaco: ["psoas"],
      quadriceps: ["reto_femoral"],
      gluteos: ["gluteo_maximo", "gluteo_medio", "gluteo_minimo"],
      rotadores_quadril: ["piriforme", "obturador_interno", "obturador_externo"],
      isquiotibiais: ["biceps_femoral", "biceps_femoral_longa", "semitendinoso", "semimembranoso", "tendao_conjunto", "tendao_conjunto_livre", "tendao_conjunto_bf_st"],
      "": ["sartorio", "tensor_fascia_lata", "abdominal", "obliquo_externo", "obliquo_interno"],
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
  // La rodilla: el tendón del cuádriceps y el rotuliano; los tendones de
  // los isquiotibiales, del sartorio y la cintilla del tensor que llegan a
  // la tibia; el origen de los gemelos y del plantar; ligamentos y meniscos.
  joelho: {
    musculos: {
      quadriceps: ["tendao_quadriceps"],
      isquiotibiais: ["biceps_femoral", "biceps_femoral_longa", "biceps_femoral_curta", "semitendinoso", "semimembranoso"],
      panturrilha: ["gastrocnemio_medial", "gastrocnemio_lateral", "plantar"],
      triceps_sural: ["gastrocnemio_medial", "gastrocnemio_lateral"],
      "": ["tendao_patelar", "sartorio", "tensor_fascia_lata"],
    },
    ligamentos: ["lca", "lcp", "lli", "lle", "menisco_medial", "menisco_lateral"],
  },
  // La pierna: la pantorrilla y su tendón, el de Aquiles.
  perna_aquiles: {
    musculos: {
      panturrilha: ["gastrocnemio_medial", "gastrocnemio_lateral", "soleo", "plantar", "tendao_aquiles"],
      triceps_sural: ["gastrocnemio_medial", "gastrocnemio_lateral", "soleo", "tendao_aquiles"],
      soleo: ["soleo"],
    },
    ligamentos: ["membrana_interossea"],
  },
  // El tobillo y el pie: donde se inserta el tendón de Aquiles, los músculos
  // del pie y la fascia plantar (que se inserta en el talón).
  tornozelo_pe: {
    musculos: {
      triceps_sural: ["tendao_aquiles"],
      panturrilha: ["tendao_aquiles"],
      musculos_pe: ["adutor_halux"],
      fascia_plantar_insercao: [],
      fascia_plantar_nao_insercao: [],
    },
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
// pantorrilla en la pierna, los glúteos en la cadera…).
export const DE_ESPALDAS_PRIMERO = {
  esterno: ["dorsal"],
  coluna_lombar: ["dorsal", "gluteos", "rotadores_quadril"],
  ombro: ["dorsal", "triceps_braquial"],
  braco: ["triceps_braquial"],
  cotovelo: ["triceps_braquial"],
  quadril_virilha: ["gluteos", "rotadores_quadril", "isquiotibiais"],
  coxa: ["isquiotibiais"],
  joelho: ["isquiotibiais", "panturrilha", "triceps_sural"],
  perna_aquiles: ["panturrilha", "triceps_sural", "soleo"],
  tornozelo_pe: ["triceps_sural", "panturrilha"],
};

// El área de una lesión muscular, por tercio del músculo (de lo grande a lo
// chico: tercio → unión). `general` son las del músculo entero, sin tercio.
export const AREAS_POR_TERCIO = {
  proximal: ["proximal_umtp", "proximal_umtc_com", "proximal_umtc_sem", "proximal_tendao_livre", "proximal_umtm", "proximal_umf", "insercao_proximal"],
  medio: ["medio_umtp", "medio_umtc_com", "medio_umtc_sem", "medio_umtm", "medio_umf"],
  distal: ["distal_umtp", "distal_umtc_com", "distal_umtc_sem", "distal_tendao_livre", "distal_umtm", "distal_umf", "insercao_distal"],
  general: ["muscular", "mioaponeurotica"],
};
export const TERCIOS = ["proximal", "medio", "distal"];

export const regionPorClave = (clave) => REGIONES.find((region) => region.clave === clave) || null;

// Lo que el mapa del catálogo sabe de cada opción: en qué partes está.
const PARTES_DE_OPCION = { parte_cuerpo: {}, musculo: {}, musculo_especifico: {}, ligamento: {} };
const anotar = (campo, codigo, parte) => {
  const lista = PARTES_DE_OPCION[campo][codigo] || [];
  if (!lista.includes(parte)) PARTES_DE_OPCION[campo][codigo] = [...lista, parte];
};
Object.entries(ESTRUCTURAS).forEach(([parte, mapa]) => {
  anotar("parte_cuerpo", parte, parte);
  Object.entries(mapa.musculos).forEach(([grupo, lista]) => {
    if (grupo) anotar("musculo", grupo, parte);
    lista.forEach((codigo) => anotar("musculo_especifico", codigo, parte));
  });
  mapa.ligamentos.forEach((codigo) => anotar("ligamento", codigo, parte));
});

// Lo que se ofrece en una parte del catálogo, en orden: de espaldas, lo de
// atrás primero.
const estructurasDeLaParte = (parte, vista) => {
  const mapa = ESTRUCTURAS[parte];
  if (!mapa) return { musculos: [], especificos: [], ligamentos: [] };
  const grupos = Object.keys(mapa.musculos).filter(Boolean);
  const atras = vista === "espalda" ? DE_ESPALDAS_PRIMERO[parte] || [] : [];
  const musculos = [...atras.filter((grupo) => grupos.includes(grupo)), ...grupos.filter((grupo) => !atras.includes(grupo))];
  const especificos = unicos([...musculos.flatMap((grupo) => mapa.musculos[grupo]), ...(mapa.musculos[""] || [])]);
  return { musculos, especificos, ligamentos: [...mapa.ligamentos] };
};

// ----------------------------------------- Las opciones que agrega el club --

// Dónde va una opción que agregó el club, por las palabras de su nombre (en
// castellano o en portugués, sin tildes). Una palabra con * vale por todas
// las que empiezan así; sin *, también en plural; varias palabras, seguidas.
// `salvo`: la pista no vale si aparece alguna de esas; `con`: tiene que
// aparecer además alguna de esas.
const POSICIONES = ["anterior", "posterior", "lateral", "medial", "interna", "interno", "externa", "externo", "dorsal", "plantar", "palmar", "superior", "inferior"];
const PISTAS = [
  // Cabeza y cuello. "Cabeza larga" o "cara anterior" no son la cabeza.
  { partes: ["cabeca_face"], palabras: ["cabeza", "cabeca"], salvo: ["larga", "corta", "longa", "curta", "humero", "humeral", "femur", "femoral", "radio", "perone", "fibula", "metatars*", "metacarp*", "biceps", "triceps", "gastrocnem*", "gemelo", "cuadricep*", "quadricep*"] },
  { partes: ["cabeca_face"], palabras: ["cara", "face"], salvo: POSICIONES },
  {
    partes: ["cabeca_face"],
    palabras: ["rostro", "rosto", "craneo", "cranio", "ojo", "olho", "orbita", "nariz", "nasal", "boca", "labio", "diente", "dente", "dental", "mandibul*", "maxilar*", "oreja", "orelha", "oido", "ouvido", "pomulo", "malar", "temporal", "masetero", "masseter"],
  },
  { partes: ["pescoco"], palabras: ["cuello", "pescoco", "cervical*", "nuca", "esternocleido*", "escalen*"], salvo: ["femur", "femoral", "humero", "pie", "pe"] },
  { partes: ["pescoco", "esterno", "ombro"], palabras: ["trapecio", "trapezio"] },
  // Tronco.
  {
    partes: ["esterno"],
    palabras: ["esternon", "esterno", "costilla", "costela", "costal*", "toracic*", "torax", "intercostal*", "serrato", "romboide*", "xifoide*", "pecho", "peito", "columna dorsal", "coluna dorsal"],
    salvo: ["pie", "pe"],
  },
  { partes: ["esterno", "coluna_lombar", "ombro"], palabras: ["dorsal", "dorsais", "latissimo", "latissimus"], salvo: ["pie", "pe", "mano", "mao", "dedo", "columna", "coluna", "vertebra*"] },
  { partes: ["esterno", "ombro"], palabras: ["pectoral*", "peitora*"] },
  { partes: ["abdomen"], palabras: ["abdom*", "oblicu*", "obliqu*", "transverso", "umbilic*", "umbig*"], salvo: ["ligamento"] },
  {
    partes: ["coluna_lombar"],
    palabras: ["lumbar*", "lombar*", "lumbalgia", "lombalgia", "sacro", "sacra", "sacral", "sacroiliac*", "coccix", "coccige", "pelvis", "pelve", "pelvic*", "multifido*", "erector*", "eretor*"],
  },
  { partes: ["pescoco", "esterno", "coluna_lombar"], palabras: ["columna", "coluna", "vertebra*", "paravertebral*", "espinal", "disco", "discal"], salvo: ["cervical*", "toracic*", "lumbar*", "lombar*", "dorsal", "sacr*"] },
  { partes: ["coluna_lombar", "quadril_virilha", "coxa"], palabras: ["ciatic*"] },
  // Brazos.
  {
    partes: ["ombro"],
    palabras: ["hombro", "ombro", "clavicul*", "acromi*", "manguito", "supraespin*", "supraspin*", "infraespin*", "subescapular*", "glenoid*", "glenohumeral", "glenoumeral", "coracoid*", "escapula*", "omoplato", "omoplata"],
  },
  { partes: ["ombro"], palabras: ["labrum", "labral"], salvo: ["acetabul*", "cadera", "quadril", "coxofemoral"] },
  { partes: ["quadril_virilha"], palabras: ["labrum", "labral"], salvo: ["glenoid*", "hombro", "ombro"] },
  { partes: ["ombro", "braco"], palabras: ["deltoid*"], salvo: ["ligamento", "lig"] },
  { partes: ["ombro", "braco", "cotovelo"], palabras: ["biceps", "triceps"], salvo: ["femoral", "sural", "crural"] },
  { partes: ["braco"], palabras: ["brazo", "braco", "humero", "humeral"] },
  { partes: ["braco", "cotovelo"], palabras: ["braquial"] },
  { partes: ["cotovelo"], palabras: ["codo", "cotovelo", "olecran*", "epicondil*", "epitrocle*"] },
  { partes: ["antebraco", "cotovelo"], palabras: ["braquiorradial*", "pronador*", "supinador*"] },
  { partes: ["antebraco"], palabras: ["antebrazo", "antebraco"] },
  { partes: ["antebraco", "punho"], palabras: ["radio", "radial", "cubito", "cubital", "ulna", "ulnar"] },
  { partes: ["punho"], palabras: ["muneca", "punho", "carpo", "carpiano", "carpal", "escafoide*", "semilunar"] },
  { partes: ["mao"], palabras: ["mano", "mao", "pulgar", "polegar", "metacarp*", "palma", "tenar", "hipotenar"] },
  { partes: ["mao", "pe_dedo"], palabras: ["dedo", "falange*", "interfalang*", "interose*", "interosse*"], salvo: ["mano", "mao", "pie", "pe", "pulgar", "polegar", "halux", "hallux", "membrana"] },
  // Piernas.
  {
    partes: ["quadril_virilha"],
    palabras: ["cadera", "quadril", "ingle", "virilha", "inguinal*", "pubi*", "pubalgia", "acetabul*", "trocanter*", "isquio", "isquion", "isquiatic*", "pectineo", "gemino*", "gemeo*", "obturador*", "coxofemoral"],
  },
  { partes: ["quadril_virilha", "coluna_lombar"], palabras: ["glute*", "piriform*", "psoas", "iliopsoas", "iliaco", "iliaca"] },
  { partes: ["quadril_virilha", "coxa"], palabras: ["aductor*", "adutor*", "abductor*", "abdutor*"], salvo: ["halux", "hallux", "pulgar", "polegar", "dedo"] },
  { partes: ["quadril_virilha", "coxa"], palabras: ["recto femoral", "reto femoral", "recto anterior", "reto anterior"], salvo: ["abdom*"] },
  {
    partes: ["quadril_virilha", "coxa", "joelho"],
    palabras: ["isquiotib*", "isquiosural*", "isquios", "semitendin*", "semimembran*", "sartori*", "gracil*", "recto interno", "reto interno", "tensor", "fascia lata", "iliotibial*", "cintilla", "biceps femoral", "cuadricep*", "quadricep*"],
  },
  { partes: ["coxa"], palabras: ["muslo", "coxa", "femur", "femoral", "vast*", "crural"] },
  { partes: ["joelho"], palabras: ["rodilla", "joelho", "rotul*", "patel*", "menisc*", "cruzad*", "poplite*", "anserin*", "pata de ganso", "hoffa", "osgood*", "meseta tibial", "plato tibial"] },
  { partes: ["joelho"], palabras: ["colateral*"], salvo: ["cubit*", "ulnar", "codo", "cotovelo", "pulgar", "polegar", "mano", "mao", "dedo", "tobillo", "tornozelo"] },
  { partes: ["joelho", "perna_aquiles"], palabras: ["gastrocnem*", "gemelo"] },
  { partes: ["perna_aquiles"], palabras: ["pierna", "perna", "pantorrill*", "panturrilh*", "soleo", "sural", "tibia", "perone", "fibula", "canilla", "canela"] },
  { partes: ["perna_aquiles", "tornozelo_pe"], palabras: ["aquiles", "aquileo", "aquiliano", "peroneo*", "fibular*", "tibial", "membrana interose*", "membrana interosse*"] },
  { partes: ["perna_aquiles", "tornozelo_pe", "pe_dedo"], palabras: ["plantar"], salvo: ["fascia", "fascitis", "fascite", "planta"] },
  {
    partes: ["tornozelo_pe"],
    palabras: ["tobillo", "tornozelo", "maleol*", "astragal*", "talus", "talo", "tarso", "tarsal", "calcane*", "sindesm*", "tibioperone*", "tibiofibular*", "peroneoastragal*", "peroneocalcane*", "talofibular*", "calcaneofibular*", "subastragal*", "subtalar*"],
  },
  { partes: ["tornozelo_pe"], palabras: ["deltoid*"], con: ["ligamento", "lig"] },
  { partes: ["tornozelo_pe", "pe_dedo"], palabras: ["fascia plantar", "fascitis plantar", "fascite plantar", "planta", "talon", "calcanhar", "empeine", "peito do pe"] },
  { partes: ["pe_dedo"], palabras: ["pie", "pe", "halux", "hallux", "metatars*", "sesamoid*", "juanete", "joanete", "morton"] },
];

// El tercio del músculo que nombra un área.
const PISTAS_DE_TERCIO = [
  { tercio: "proximal", palabras: ["proxim*"] },
  { tercio: "medio", palabras: ["medio", "media", "meio"] },
  { tercio: "distal", palabras: ["distal*"] },
];

const palabrasDe = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
const esLaPalabra = (palabra, patron) => (patron.endsWith("*") ? palabra.startsWith(patron.slice(0, -1)) : [patron, `${patron}s`, `${patron}es`].includes(palabra));
const aparece = (palabras, patron) => {
  const buscadas = patron.split(" ");
  return palabras.some((_, i) => buscadas.every((buscada, j) => i + j < palabras.length && esLaPalabra(palabras[i + j], buscada)));
};
const vale = (palabras, pista) =>
  pista.palabras.some((patron) => aparece(palabras, patron)) &&
  !(pista.salvo || []).some((patron) => aparece(palabras, patron)) &&
  (!pista.con || pista.con.some((patron) => aparece(palabras, patron)));

// Las partes del cuerpo que nombra una opción (sus textos en los dos
// idiomas), de la cabeza a los pies; [] si no nombra ninguna.
export const partesPorNombre = (...textos) => {
  const halladas = new Set(
    textos.flatMap((texto) => {
      const palabras = palabrasDe(texto);
      return PISTAS.filter((pista) => vale(palabras, pista)).flatMap((pista) => pista.partes);
    }),
  );
  return PARTES.filter((parte) => halladas.has(parte));
};

// El tercio que nombra un área; null si no nombra ninguno o nombra más de uno.
export const tercioPorNombre = (...textos) => {
  const hallados = new Set(
    textos.flatMap((texto) => {
      const palabras = palabrasDe(texto);
      return PISTAS_DE_TERCIO.filter((pista) => vale(palabras, pista)).map((pista) => pista.tercio);
    }),
  );
  return hallados.size === 1 ? [...hallados][0] : null;
};

// ------------------------------------------------------------- El mapa --

// El mapa de un club: el del catálogo más las opciones que el club agregó,
// cada una donde dice su nombre; las que no se sabe dónde van, en todas las
// partes, así ninguna queda afuera. listas: las del club, como vienen de la
// configuración ({ campo: [{ codigo, etiquetas }] }); sin listas, el catálogo.
export const crearMapa = (listas = {}) => {
  const delCatalogo = (campo, codigo) => OPCIONES[campo].some((opcion) => opcion.codigo === codigo);
  const agregadas = Object.fromEntries(
    CAMPOS_DEL_CUERPO.map((campo) => [
      campo,
      (listas?.[campo] || [])
        .filter((opcion) => !delCatalogo(campo, opcion.codigo))
        .map((opcion) => {
          const textos = Object.values(opcion.etiquetas || {});
          return campo === "area" ? { codigo: opcion.codigo, partes: [], tercio: tercioPorNombre(...textos) } : { codigo: opcion.codigo, partes: partesPorNombre(...textos) };
        }),
    ]),
  );
  const agregada = (campo, codigo) => agregadas[campo].find((opcion) => opcion.codigo === codigo) || null;
  // Lo del club que va en alguna de esas partes (o en todas).
  const agregadasEn = (campo, partes) => agregadas[campo].filter((opcion) => !opcion.partes.length || opcion.partes.some((una) => partes.includes(una))).map((opcion) => opcion.codigo);

  // Las partes del catálogo donde está una parte del cuerpo: ella misma, o
  // las que nombra la que agregó el club ([] si no se sabe).
  const partesReconocidas = (parte) => (ESTRUCTURAS[parte] ? [parte] : agregada("parte_cuerpo", parte)?.partes || []);
  // Para ofrecer estructuras, una parte que no se sabe dónde va vale por todas.
  const partesParaOfrecer = (parte) => {
    const reconocidas = partesReconocidas(parte);
    return reconocidas.length ? reconocidas : PARTES;
  };

  // Lo que se ofrece en una parte, en orden: de espaldas, lo de atrás
  // primero; lo que agregó el club, al final.
  const estructurasDe = (parte, { vista = "frente" } = {}) => {
    const partes = partesParaOfrecer(parte);
    const delCatalogo = partes.map((una) => estructurasDeLaParte(una, vista));
    return {
      musculos: unicos([...delCatalogo.flatMap((una) => una.musculos), ...agregadasEn("musculo", partes)]),
      especificos: unicos([...delCatalogo.flatMap((una) => una.especificos), ...agregadasEn("musculo_especifico", partes)]),
      ligamentos: unicos([...delCatalogo.flatMap((una) => una.ligamentos), ...agregadasEn("ligamento", partes)]),
    };
  };

  // Los músculos específicos de un grupo en esa parte, más los que agregó el
  // club (de los que no se sabe el grupo). Si el grupo no está en esa parte
  // (o lo agregó el club), todos los de la parte.
  const especificosDe = (parte, grupo) => {
    const partes = partesParaOfrecer(parte);
    const conElGrupo = partes.filter((una) => grupo && ESTRUCTURAS[una].musculos[grupo]);
    if (!conElGrupo.length) return estructurasDe(parte).especificos;
    return unicos([...conElGrupo.flatMap((una) => ESTRUCTURAS[una].musculos[grupo]), ...agregadasEn("musculo_especifico", partes)]);
  };

  // Los grupos musculares del catálogo de un músculo específico en esa parte
  // (para completar el grupo cuando se elige el músculo).
  const gruposDe = (parte, especifico) =>
    unicos(
      partesParaOfrecer(parte).flatMap((una) =>
        Object.entries(ESTRUCTURAS[una].musculos)
          .filter(([grupo, lista]) => grupo && lista.includes(especifico))
          .map(([grupo]) => grupo),
      ),
    );

  // Al cambiar de grupo muscular, un músculo específico de esa parte que es
  // de otro grupo se borra.
  const especificoQueNoEsDe = (parte, grupo, especifico) => {
    if (!grupo || !especifico) return false;
    return estructurasDe(parte).especificos.includes(especifico) && !especificosDe(parte, grupo).includes(especifico);
  };

  // Al cambiar de parte del cuerpo, lo cargado que el mapa sabe que es de
  // otra parte ya no vale y se borra ({ campo: null }); lo que no se sabe
  // dónde va queda. El área es de un músculo: si el músculo se borra y no
  // queda ninguno, se borra también.
  const sabeDondeVa = (campo, codigo) => Boolean(PARTES_DE_OPCION[campo][codigo] || agregada(campo, codigo)?.partes.length);
  const estructurasQueNoSonDe = (parte, valores = {}) => {
    const deLaParte = estructurasDe(parte);
    const tiene = { musculo: deLaParte.musculos, musculo_especifico: deLaParte.especificos, ligamento: deLaParte.ligamentos };
    const cambios = {};
    Object.keys(tiene).forEach((campo) => {
      const valor = valores[campo];
      if (valor && sabeDondeVa(campo, valor) && !tiene[campo].includes(valor)) cambios[campo] = null;
    });
    const quedaMusculo = ["musculo", "musculo_especifico"].some((campo) => valores[campo] && !(campo in cambios));
    if (valores.area && ("musculo" in cambios || "musculo_especifico" in cambios) && !quedaMusculo) cambios.area = null;
    return cambios;
  };

  // En qué región de la figura está una parte del cuerpo con su lado: el
  // brazo o la pierna de ese lado, o la del medio (cabeza y tronco). Una
  // parte de un brazo o una pierna sin lado derecho o izquierdo no está en
  // ninguna (null): no se sabe cuál dibujar.
  const regionDe = (parte, lado) => {
    const partes = partesReconocidas(parte);
    const candidatas = REGIONES.filter((region) => region.partes.some((una) => partes.includes(una)));
    return (candidatas.find((region) => region.lado && region.lado === lado) || candidatas.find((region) => !region.lado))?.clave || null;
  };

  // La parte de la figura que se pinta para una parte del cuerpo en esa
  // región (la del club, la de la figura donde va).
  const piezaDe = (parte, region) => partesReconocidas(parte).find((una) => regionPorClave(region)?.partes.includes(una)) || null;

  // Las partes del cuerpo de una región: las del catálogo, cada una seguida
  // de las del club que van ahí; al final, las del club que no se sabe
  // dónde van (están en todas).
  const partesDeRegion = (clave) => {
    const region = regionPorClave(clave);
    if (!region) return [];
    const lista = [];
    region.partes.forEach((parte) => {
      lista.push(parte);
      agregadas.parte_cuerpo.forEach((opcion) => opcion.partes.includes(parte) && !lista.includes(opcion.codigo) && lista.push(opcion.codigo));
    });
    agregadas.parte_cuerpo.forEach((opcion) => !opcion.partes.length && lista.push(opcion.codigo));
    return lista;
  };

  // El tercio de un área ("proximal", "medio", "distal"; "general" las del
  // músculo entero), o null si no tiene.
  const tercioDeArea = (codigo) => Object.entries(AREAS_POR_TERCIO).find(([, areas]) => areas.includes(codigo))?.[0] || agregada("area", codigo)?.tercio || null;

  // Dónde va una opción (para mostrarlo en Ajustes): las partes del cuerpo,
  // o null si va en todas porque no se sabe.
  const partesDeOpcion = (campo, codigo) => {
    if (campo === "parte_cuerpo") return partesReconocidas(codigo).length ? partesReconocidas(codigo) : null;
    if (PARTES_DE_OPCION[campo]?.[codigo]) return PARTES.filter((parte) => PARTES_DE_OPCION[campo][codigo].includes(parte));
    return agregada(campo, codigo)?.partes.length ? agregada(campo, codigo).partes : null;
  };

  return { estructurasDe, especificosDe, gruposDe, especificoQueNoEsDe, estructurasQueNoSonDe, regionDe, piezaDe, partesDeRegion, tercioDeArea, partesDeOpcion };
};

// El mapa del catálogo, sin lo que agregue cada club.
export const { estructurasDe, especificosDe, gruposDe, especificoQueNoEsDe, estructurasQueNoSonDe, regionDe, piezaDe, partesDeRegion, tercioDeArea, partesDeOpcion } = crearMapa();
