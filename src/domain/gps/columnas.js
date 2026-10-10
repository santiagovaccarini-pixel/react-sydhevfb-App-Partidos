// GPS (en Bases de Datos): las columnas de la hoja BD_GPS del Excel, en su
// orden, con todo lo de cada una en un solo lugar: el nombre (el del Excel;
// el club lo cambia en Ajustes), qué es, cómo se muestra, cómo se reconoce
// al pegar y si va en el informe de arriba y con colores. Las del club (las
// que suma en Ajustes) se agregan al final.
//
// Los nombres: en las medidas, los de la fila 17 del Excel (los que se leen:
// "14,4-25Km/h"); en lo demás, los de la fila 18 (la de los filtros). Al
// pegar valen los de las dos filas. Las que el Excel nombra distinto de lo
// que guarda (por ejemplo, "Esfuerzo Explosivo/min" guarda "RHIE Effort
// Duration - Max" de Catapult) quedan con el nombre del Excel: el club las
// renombra en Ajustes (anotado en docs/PENDIENTES.md, «GPS»).
//
// tipo:
//   · jugador: de quién es la fila (un jugador, una persona o el promedio
//     del equipo).
//   · fecha: el día (la columna fecha de la tabla).
//   · numero: un número (formato: como lo muestra el Excel).
//   · porMinuto: un número que es `de` ÷ minutos (Tiempo). Se trae como está
//     en el Excel; si se cambia `de` o el Tiempo de la fila, se recalcula.
//   · tiempo: una duración; se guarda en segundos y se ve h:mm:ss.
//   · hora: una hora del día; se guarda en segundos desde las 0 y se ve
//     h:mm:ss.
//   · lista: una opción de una lista (se guarda el código; el texto está en
//     las listas y en Ajustes).
//   · texto: un texto.
// informe: va en el informe de arriba (Excelente … Mín, de lo que se ve).
// colores: se pinta contra promedio ± desvío de lo que se ve (Excelente a
// Malo), como el formato condicional del Excel (D19:X30002).

const t = (es, pt = es) => Object.freeze({ "es-AR": es, "pt-BR": pt });

// Una medida de Catapult y su "por minuto", como en el Excel (D a M y N a W).
const MEDIDAS = [
  { clave: "d", titulo: "D", pegar: ["D"], porMinuto: { clave: "d_min", titulo: "D/min", pegar: ["D/min", "Drel"] } },
  {
    clave: "d_shi",
    titulo: "14,4-25Km/h",
    pegar: ["14,4-25Km/h", "D_SHI"],
    porMinuto: { clave: "d_shi_min", titulo: "14,4-25Km/h/min", pegar: ["14,4-25Km/h/min", "D_SHI/min"] },
  },
  {
    clave: "d_acchi",
    titulo: "n° 1,7 a 2,7m/s2",
    pegar: ["n° 1,7 a 2,7m/s2", "D_AccHI"],
    porMinuto: { clave: "d_acchi_min", titulo: "n° 1,7 a 2,7m/s2/min", pegar: ["n° 1,7 a 2,7m/s2/min", "D_AccHI/min"] },
  },
  {
    clave: "d_dechi",
    titulo: "n° .-1,7 a -2,7m/s2",
    pegar: ["n° .-1,7 a -2,7m/s2", "D_DecHI"],
    porMinuto: { clave: "d_dechi_min", titulo: "n° .-1,7 a -2,7m/s2/min", pegar: ["n° .-1,7 a -2,7m/s2/min", "D_DecHI/min"] },
  },
  {
    clave: "d_mphi",
    titulo: "20-45 W/PC",
    pegar: ["20-45 W/PC", "D_MPHI"],
    porMinuto: { clave: "d_mphi_min", titulo: "20-45 W/PC/min", pegar: ["20-45 W/PC/min", "D_MPHI/min"] },
  },
  {
    clave: "d_s6",
    titulo: "> 25,2 Km/h",
    pegar: ["> 25,2 Km/h", "D_S6"],
    porMinuto: { clave: "d_s6_min", titulo: "> 25,2 Km/h/min", pegar: ["> 25,2 Km/h/min", "D_S6/min"] },
  },
  {
    clave: "d_a8",
    titulo: "n° Acel. >2,7 m/seg2",
    pegar: ["n° Acel. >2,7 m/seg2", "D_A8"],
    porMinuto: { clave: "d_a8_min", titulo: "n° Acel. >2,7 m/seg2/min", pegar: ["n° Acel. >2,7 m/seg2/min", "D_A8/min"] },
  },
  {
    clave: "d_a1",
    titulo: "n° Desacel. <-2,7 m/seg2",
    pegar: ["n° Desacel. <-2,7 m/seg2", "D_A1"],
    porMinuto: { clave: "d_a1_min", titulo: "n° Desacel. <-2,7 m/seg2/min", pegar: ["n° Desacel. <-2,7 m/seg2/min", "D_A1/min"] },
  },
  {
    clave: "d_mp5",
    titulo: "> 45 W/PC",
    pegar: ["> 45 W/PC", "D_MP5"],
    porMinuto: { clave: "d_mp5_min", titulo: "> 45 W/PC/min", pegar: ["> 45 W/PC/min", "D_MP5/min"] },
  },
  {
    clave: "mts90",
    titulo: "Mts >= 90% Pico",
    pegar: ["Mts >= 90% Pico", "Mts >= 90% Pico."],
    porMinuto: { clave: "mts90_min", titulo: "Mts >= 90% Pico/Min", pegar: ["Mts >= 90% Pico/Min", "Mts >= 90% Pico/Min."] },
  },
];

const medida = ({ clave, titulo, pegar }) => ({ clave, titulo: t(titulo), tipo: "numero", formato: "0.0", pegar, informe: true, colores: true });
const porMinutoDe = (de) => ({
  clave: de.porMinuto.clave,
  titulo: t(de.porMinuto.titulo),
  tipo: "porMinuto",
  de: de.clave,
  formato: "0.0",
  pegar: de.porMinuto.pegar,
  informe: true,
  colores: true,
});

export const COLUMNAS_GPS = Object.freeze([
  { clave: "microciclo", titulo: t("Microciclo"), tipo: "numero", formato: "General", pegar: ["Microciclo"], fija: true, ancho: 132 },
  { clave: "jugador", titulo: t("Nombre", "Nome"), tipo: "jugador", pegar: ["Nombre", "Nome"], fija: true, ancho: 190 },
  { clave: "puesto", titulo: t("Puesto", "Posição"), tipo: "texto", pegar: ["Puesto", "Posição"], fija: true, ancho: 112 },
  ...MEDIDAS.map(medida),
  ...MEDIDAS.map(porMinutoDe),
  { clave: "tiempo", titulo: t("Tiempo", "Tempo"), tipo: "tiempo", pegar: ["Tiempo", "T", "Tempo"], informe: true, colores: true },
  { clave: "smax", titulo: t("Maxima Velocidad", "Velocidade Máxima"), tipo: "numero", formato: "0.0", pegar: ["Maxima Velocidad", "Smax"], informe: true },
  { clave: "amax", titulo: t("Aceleracion Maxima", "Aceleração Máxima"), tipo: "numero", formato: "0.0", pegar: ["Aceleracion Maxima", "Amax"], informe: true },
  { clave: "dist_explosiva", titulo: t("Distancia Explosiva", "Distância Explosiva"), tipo: "numero", formato: "0.0", pegar: ["Distancia Explosiva", "EEE"], informe: true },
  { clave: "v5", titulo: t("19,8-25,2Km/h/min"), tipo: "numero", formato: "0.0", pegar: ["19,8-25,2Km/h/min", "Imbalance"], informe: true },
  { clave: "rhie_min", titulo: t("Esfuerzo Explosivo", "Esforço Explosivo"), tipo: "numero", formato: "0.0", pegar: ["Esfuerzo Explosivo", "Running Symmetry"], informe: true },
  {
    clave: "rhie_max",
    titulo: t("Esfuerzo Explosivo/min", "Esforço Explosivo/min"),
    tipo: "numero",
    formato: "0.0",
    pegar: ["Esfuerzo Explosivo/min", "Explosive Symmetry"],
    informe: true,
  },
  { clave: "inicio", titulo: t("Inicio de tarea", "Início da tarefa"), tipo: "hora", pegar: ["Inicio de tarea", "Brake Symmetry"], informe: true },
  { clave: "fin", titulo: t("Finalizacion de tarea", "Fim da tarefa"), tipo: "hora", pegar: ["Finalizacion de tarea", "Extra10"], informe: true },
  { clave: "gnss", titulo: t("GNSS Quality"), tipo: "numero", formato: "0.0", pegar: ["GNSS Quality", "Alta Des/Acel"], informe: true },
  { clave: "hdop", titulo: t("HDOP"), tipo: "numero", formato: "0.0", pegar: ["HDOP", "Max. Des/Acel"], informe: true },
  { clave: "fecha", titulo: t("Fecha", "Data"), tipo: "fecha", pegar: ["Fecha", "Data"] },
  {
    clave: "min_fuerza",
    titulo: t("Minutos Fuerza Metabólico", "Minutos Força Metabólico"),
    tipo: "numero",
    formato: "General",
    pegar: ["Minutos Fuerza Metabólico", "Entrenamietos Fuerza o Metabólico"],
  },
  {
    clave: "min_activacion",
    titulo: t("Minutos Activación y/o regeneración", "Minutos Ativação e/ou regeneração"),
    tipo: "numero",
    formato: "General",
    pegar: ["Minutos Activación y/o regeneración", "Activación y/o regeneración"],
  },
  { clave: "min_campo", titulo: t("Minutos Campo"), tipo: "numero", formato: "0", pegar: ["Minutos Campo", "Tareas especificas"] },
  { clave: "pse", titulo: t("PSE"), tipo: "numero", formato: "General", pegar: ["PSE"] },
  { clave: "ua", titulo: t("Unidad Arbitraria", "Unidade Arbitrária"), tipo: "numero", formato: "0", pegar: ["Unidad Arbitraria"] },
  { clave: "condicion", titulo: t("Condicion", "Condição"), tipo: "lista", lista: "condicion", pegar: ["Condicion", "Condición"] },
  {
    clave: "tipo_sesion",
    titulo: t("Tipo de Sesión (Densidad)", "Tipo de Sessão (Densidade)"),
    tipo: "lista",
    lista: "tipo_sesion",
    pegar: ["Tipo de Sesión (Densidad)", "Tipo de Tarea o Dinamica"],
  },
  { clave: "zona_impacto", titulo: t("Zona de Impacto"), tipo: "lista", lista: "zona_impacto", pegar: ["Zona de Impacto"] },
  { clave: "numero_tarea", titulo: t("Número de Tarea", "Número da Tarefa"), tipo: "lista", lista: "numero_tarea", pegar: ["Número de Tarea", "Orden de Tarea en la sesión"] },
  { clave: "tipo_microciclo", titulo: t("Tipo Microciclo", "Tipo de Microciclo"), tipo: "lista", lista: "tipo_microciclo", pegar: ["Tipo Microciclo"] },
  { clave: "clasificacion_dias", titulo: t("Clasificación Días", "Classificação dos Dias"), tipo: "lista", lista: "clasificacion_dias", pegar: ["Clasificación Días"] },
  { clave: "tarea_partido", titulo: t("Tarea o Partido", "Tarefa ou Jogo"), tipo: "lista", lista: "tarea_partido", pegar: ["Tarea o Partido"] },
  { clave: "codigo_estrategia", titulo: t("Código Estrategia", "Código de Estratégia"), tipo: "lista", lista: "codigo_estrategia", pegar: ["Código Estrategia"] },
  { clave: "descripcion", titulo: t("Descripción", "Descrição"), tipo: "texto", pegar: ["Descripción"], ancho: 280 },
  { clave: "va", titulo: t("Va"), tipo: "lista", lista: "va", pegar: ["Va", "Si incluye al Average Sesión Si/NO"] },
  { clave: "m2", titulo: t("m2"), tipo: "numero", formato: "General", pegar: ["m2", "m2xJugxDin"] },
  { clave: "cp_tarea", titulo: t("C/P Tarea"), tipo: "numero", formato: "General", pegar: ["C/P Tarea"] },
  { clave: "cp_jug", titulo: t("C/P Jug"), tipo: "numero", formato: "General", pegar: ["C/P Jug"] },
  { clave: "base", titulo: t("Base"), tipo: "numero", formato: "General", pegar: ["Base"] },
  { clave: "largo", titulo: t("Largo", "Comprimento"), tipo: "numero", formato: "General", pegar: ["Largo"] },
  { clave: "ancho", titulo: t("Ancho", "Largura"), tipo: "numero", formato: "General", pegar: ["Ancho"] },
  // La columna que pidió Santiago (10/10) en lugar del corte microciclo
  // ≤16 / ≥17 del Excel: con qué dispositivo se tomó la fila. Cada
  // dispositivo se pinta contra lo suyo (y tendrá sus V.R.).
  { clave: "dispositivo", titulo: t("Dispositivo"), tipo: "lista", lista: "dispositivo", pegar: ["Dispositivo"] },
]);

// Las listas del Excel (las hojas «Valores (2)» y «Datos Básicos» de la
// plantilla de carga). El club las renombra, esconde y suma en Ajustes. Los
// dispositivos los suma el club.
const opciones = (...textos) => textos.map((texto) => ({ codigo: codigoDeTexto(texto), etiquetas: t(...(Array.isArray(texto) ? texto : [texto])) }));

function codigoDeTexto(texto) {
  const es = Array.isArray(texto) ? texto[0] : texto;
  return String(es)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\+/g, "mas")
    .replace(/(^|_)-/g, "$1menos")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Los días del microciclo: 0, 1, +1, -1 … ±10, a la mañana (_M) o a la
// tarde (_T), en el orden del Excel.
const DIAS = ["0", "1", "+1", "-1", ...Array.from({ length: 9 }, (_, i) => [`${i + 2}`, `+${i + 2}`, `-${i + 2}`]).flat()];

export const LISTAS_GPS = Object.freeze({
  condicion: opciones("Parcial", "Total"),
  tipo_sesion: opciones(
    ["Tarea Mixta", "Tarefa Mista"],
    ["Din. Intensiva de Acción", "Din. Intensiva de Ação"],
    ["Din. Intensiva de Interacción", "Din. Intensiva de Interação"],
    ["Din. Colectiva", "Din. Coletiva"],
    ["Analítica", "Analítica"],
    ["Din. Compleja", "Din. Complexa"],
    ["Din. General", "Din. Geral"],
    ["Descanso", "Descanso"],
    ["Regeneración", "Regeneração"],
    ["Rehabilitación", "Reabilitação"],
  ),
  zona_impacto: opciones(["Fuerza", "Força"], "F-M", ["Velocidad", "Velocidade"], "V-M", ["Metabolica", "Metabólica"], "F-V"),
  numero_tarea: opciones(...Array.from({ length: 10 }, (_, i) => `M${i + 1}`)),
  tipo_microciclo: opciones(["Competitivo", "Competitivo"], ["Precompetitivo", "Pré-competitivo"], ["Entrenamiento", "Treinamento"]),
  clasificacion_dias: opciones(...DIAS.flatMap((dia) => [`${dia}_M`, `${dia}_T`])),
  tarea_partido: opciones(
    ["Partido Amistoso", "Jogo Amistoso"],
    ["Partido Interno", "Jogo Interno"],
    ["Partido Oficial Amistoso", "Jogo Oficial Amistoso"],
    ["Partido Oficial Torneo", "Jogo Oficial Torneio"],
    ["Otra Tarea", "Outra Tarefa"],
  ),
  codigo_estrategia: opciones("CPS", "CPT", "PR", "PC", "PA", "JC1", "JC2", "JC3", "FEI", "FEP", "FEL", "FELS", "FEC"),
  va: opciones(["Si", "Sim"], ["No", "Não"]),
  dispositivo: [],
});

// GPS con la forma de un test de Evaluaciones (id, columnas, listas): así
// usa los mismos Ajustes (domain/evaluaciones/ajustes.js).
export const GPS = Object.freeze({ id: "gps", columnas: COLUMNAS_GPS, listas: LISTAS_GPS });

export const columnaGps = (clave) => COLUMNAS_GPS.find((columna) => columna.clave === clave) || null;

// Las medidas con su "por minuto": { de: clave del por minuto }.
export const POR_MINUTO = Object.freeze(Object.fromEntries(COLUMNAS_GPS.filter((columna) => columna.tipo === "porMinuto").map((columna) => [columna.de, columna.clave])));

// El promedio del equipo (Team Average): lo dice la columna Nombre.
export const PROMEDIOS = Object.freeze({
  parcial: t("Team Average Parcial"),
  sesion: t("Team Average Sesion"),
});
