// Las columnas del Excel original de lesiones, en su orden, con el nombre y
// las opciones de cada desplegable en los dos idiomas. Es lo que se siembra
// en la base para cada club la primera vez (lesiones_campos y
// lesiones_opciones); después cada club las cambia desde Ajustes y manda lo
// que haya en la base.
//
// Tipos: auto (lo pone la base), jugador (quién), dato_jugador (viene del
// jugador), calculado (sale de otras columnas), lista (desplegable), fecha,
// fecha_hora, texto, texto_largo. Las fechas con `columna: true` van en su
// propia columna de la tabla; el resto, en `datos`.

const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });
const op = (codigo, es, pt) => ({ codigo, etiquetas: et(es, pt) });

export const CAMPOS = [
  { clave: "numero_caso", tipo: "auto", grupo: "registro", etiquetas: et("N° de caso", "N° de Caso") },
  { clave: "numero_registro", tipo: "dato_jugador", grupo: "jugador", etiquetas: et("N° de registro", "N° de Registro") },
  { clave: "jugador", tipo: "jugador", grupo: "jugador", obligatorio: true, etiquetas: et("Nombre y apellido", "Nome e Sobrenome") },
  { clave: "categoria", tipo: "dato_jugador", lista: true, grupo: "jugador", etiquetas: et("Categoría", "Categoria") },
  { clave: "fecha_nacimiento", tipo: "dato_jugador", grupo: "jugador", etiquetas: et("Fecha de nacimiento", "D. Nac. (DD/MM/AAAA)") },
  { clave: "pie_dominante", tipo: "dato_jugador", lista: true, grupo: "jugador", etiquetas: et("Pie dominante", "P. Dominante") },
  { clave: "posicion", tipo: "dato_jugador", grupo: "jugador", etiquetas: et("Posición", "Posicao") },
  { clave: "edad", tipo: "calculado", grupo: "jugador", etiquetas: et("Edad", "Idade") },
  { clave: "tipo_lesion", tipo: "lista", grupo: "lesion", etiquetas: et("Tipo de lesión", "Tipo de lesão") },
  { clave: "parte_cuerpo", tipo: "lista", grupo: "lesion", obligatorio: true, etiquetas: et("Parte del cuerpo lesionada", "Parte do Corpo Lesionada") },
  { clave: "lado", tipo: "lista", grupo: "lesion", obligatorio: true, etiquetas: et("Lado", "Lado") },
  { clave: "hora_imagen", tipo: "fecha_hora", grupo: "imagen", etiquetas: et("Hora de la imagen", "HORA DA IMAGEM") },
  { clave: "imagenes", tipo: "lista", grupo: "imagen", etiquetas: et("Imágenes", "IMAGENS") },
  { clave: "horas_imagen", tipo: "calculado", grupo: "imagen", etiquetas: et("Horas entre la lesión y la imagen", 'Horas Passadas e/ "Imagem" e "Lesão"') },
  { clave: "ligamento", tipo: "lista", grupo: "lesion", etiquetas: et("Ligamento específico", "Lig Específico") },
  { clave: "musculo", tipo: "lista", grupo: "lesion", etiquetas: et("Músculo afectado", "Músculo afetado") },
  { clave: "musculo_especifico", tipo: "lista", grupo: "lesion", etiquetas: et("Músculo específico", "Músculo Específico") },
  { clave: "area", tipo: "lista", grupo: "lesion", etiquetas: et("Área", "Área") },
  { clave: "producto", tipo: "lista", grupo: "lesion", etiquetas: et("Producto", "Produto") },
  { clave: "mecanismo", tipo: "lista", grupo: "lesion", etiquetas: et("Mecanismo", "Mecanismo") },
  { clave: "cuando", tipo: "lista", grupo: "lesion", etiquetas: et("Cuándo", "Quando") },
  { clave: "localizacion", tipo: "lista", grupo: "lesion", etiquetas: et("Localización", "Localização") },
  { clave: "fecha_lesion", tipo: "fecha", grupo: "fechas", obligatorio: true, columna: true, etiquetas: et("Fecha de inicio de la lesión", "Data de Início da Lesão (DD/MM/YYYY)") },
  { clave: "fecha_transicion", tipo: "fecha", grupo: "fechas", columna: true, etiquetas: et("Pase a transición", "Passagem para o Transicao (DD/MM/YYYY)") },
  { clave: "recup_1", tipo: "calculado", grupo: "fechas", etiquetas: et("Recup 1", "Recup 1") },
  { clave: "fecha_retorno_entrenamiento", tipo: "fecha", grupo: "fechas", columna: true, etiquetas: et("Retorno al entrenamiento", "Retorno à Data de Treinamento (DD/MM/YYYY)") },
  { clave: "recup_2", tipo: "calculado", grupo: "fechas", etiquetas: et("Recup 2", "Recup 2") },
  { clave: "fecha_alta", tipo: "fecha", grupo: "fechas", columna: true, etiquetas: et("Retorno a la competencia (alta)", "Retorno à Data da Competição (DD/MM/YYYY)") },
  { clave: "recuperacion", tipo: "calculado", grupo: "fechas", etiquetas: et("Recuperación", "Recuperação") },
  { clave: "severidad", tipo: "lista", grupo: "fechas", etiquetas: et("Severidad", "Severidade") },
  { clave: "recurrencia", tipo: "lista", grupo: "fechas", etiquetas: et("Recurrencia", "Recorrência") },
  { clave: "recidiva", tipo: "lista", grupo: "fechas", etiquetas: et("Recidiva", "Recidiva") },
  { clave: "diagnostico", tipo: "texto", grupo: "notas", etiquetas: et("Diagnóstico", "Diagnóstico") },
  { clave: "comentarios", tipo: "texto_largo", grupo: "notas", etiquetas: et("Comentarios adicionales", "Comentários adicionais") },
  { clave: "medico", tipo: "texto", grupo: "notas", etiquetas: et("Médico", "Médico") },
];

// Las opciones de cada desplegable, tal como están en el Excel (portugués) y
// su traducción. Las que el Excel no mostró completas (tipo de lesión,
// músculo específico, imágenes) se completan cuando lleguen.
export const OPCIONES = {
  categoria: [
    op("profissional", "Profesional", "Profissional"),
    op("sub23", "Sub-23", "Sub-23"),
    op("sub20", "Sub-20", "Sub-20"),
    op("sub17", "Sub-17", "Sub-17"),
    op("sub15", "Sub-15", "Sub-15"),
    op("outro", "Otra", "Outro"),
  ],
  pie_dominante: [op("direito", "Derecho", "Direito"), op("esquerdo", "Izquierdo", "Esquerdo"), op("ambos", "Ambos", "Ambos")],
  tipo_lesion: [
    op("abrasao", "Abrasión", "ABRASÃO"),
    op("concussao", "Conmoción cerebral con o sin pérdida de conciencia", "CONCUSSÃO CEREBRAL COM OU SEM PERDA DE CONSCIÊNCIA"),
    op("sobrecarga_caibra", "Sobrecarga muscular / calambre", "SOBRECARGA MUSCULAR/CÃIBRA"),
    op("luxacao", "Luxación / subluxación", "LUXAÇÃO/SUBLUXAÇÃO"),
    op("entorse", "Esguince / lesión ligamentaria", "ENTORSE/LESÃO LIGAMENTAR"),
    op("fratura", "Fractura", "FRATURA"),
    op("hematoma", "Hematoma / contusión / equimosis", "HEMATOMA/CONTUSÃO/EQUIMOSE"),
    op("laceracao", "Laceración", "LACERAÇÃO"),
    op("dentaria", "Lesión dental", "LESÃO DENTÁRIA"),
    op("meniscal", "Lesión meniscal o del cartílago", "LESÃO MENISCAL OU DA CARTILAGEM"),
    op("nervosa", "Lesión nerviosa", "LESÃO NERVOSA"),
    op("tendinea", "Lesión tendinosa / ruptura / tendinosis / bursitis", "LESÃO TENDÍNEA/RUPTURA/TENDINOSE/BURSITE"),
    op("outra", "Otra lesión", "OUTRA LESÃO"),
    op("osseas", "Otras lesiones óseas", "OUTRAS LESÕES ÓSSEAS"),
    op("muscular_1a", "Lesión muscular grado 1 A", "LESÃO MUSCULAR GRAU 1 A"),
    op("muscular_1b", "Lesión muscular grado 1 B", "LESÃO MUSCULAR GRAU 1 B"),
    op("muscular_1c", "Lesión muscular grado 1 C", "LESÃO MUSCULAR GRAU 1 C"),
    op("muscular_2a", "Lesión muscular grado 2 A", "LESÃO MUSCULAR GRAU 2 A"),
    op("muscular_2b", "Lesión muscular grado 2 B", "LESÃO MUSCULAR GRAU 2 B"),
    op("muscular_2c", "Lesión muscular grado 2 C", "LESÃO MUSCULAR GRAU 2 C"),
    op("muscular_3a", "Lesión muscular grado 3 A", "LESÃO MUSCULAR GRAU 3 A"),
    op("muscular_3b", "Lesión muscular grado 3 B", "LESÃO MUSCULAR GRAU 3 B"),
    op("muscular_3c", "Lesión muscular grado 3 C", "LESÃO MUSCULAR GRAU 3 C"),
    op("lombalgia", "Lumbalgia", "LOMBALGIA"),
    op("infecciosa", "Enfermedad infecciosa", "DOENÇA INFECCIOSA"),
  ],
  parte_cuerpo: [
    op("abdomen", "Abdomen", "ABDÔMEN"),
    op("antebraco", "Antebrazo", "ANTEBRAÇO"),
    op("braco", "Brazo", "BRAÇO"),
    op("cabeca_face", "Cabeza / cara", "CABEÇA/FACE"),
    op("quadril_virilha", "Cadera / ingle", "QUADRIL/VIRILHA"),
    op("cotovelo", "Codo", "COTOVELO"),
    op("coluna_lombar", "Columna lumbar / sacro / pelvis", "COLUNA LOMBAR/SACRO/PELVE"),
    op("pescoco", "Cuello / columna cervical", "PESCOÇO/COLUNA CERVICAL"),
    op("esterno", "Esternón / costillas / columna torácica", "ESTERNO/COSTELAS/COLUNA TORÁCICA"),
    op("ombro", "Hombro / clavícula", "OMBRO/CLAVÍCULA"),
    op("mao", "Mano / dedo / pulgar", "MÃO/DEDO/POLEGAR"),
    op("punho", "Muñeca", "PUNHO"),
    op("coxa", "Muslo", "COXA"),
    op("pe_dedo", "Pie / dedo", "PÉ/DEDO"),
    op("perna_aquiles", "Pierna / tendón de Aquiles", "PERNA/TENDÃO DE AQUILES"),
    op("joelho", "Rodilla", "JOELHO"),
    op("tornozelo_pe", "Tobillo / pie", "TORNOZELO/PÉ"),
  ],
  lado: [op("direito", "Derecho", "Direito"), op("esquerdo", "Izquierdo", "Esquerdo"), op("nao_se_aplica", "No se aplica", "Não se aplica")],
  imagenes: [
    op("rm", "Resonancia magnética", "Ressonância magnética"),
    op("eco", "Ecografía", "Ultrassonografia"),
    op("rx", "Radiografía", "Raio-X"),
    op("tc", "Tomografía", "Tomografia"),
    op("sem", "Sin imagen", "Sem imagem"),
  ],
  ligamento: [
    op("lle_anterior", "Ligamento lateral externo anterior", "LIGAMENTO LATERAL EXTERNO ANTERIOR"),
    op("lle_medio", "Ligamento lateral externo medio", "LIGAMENTO LATERAL EXTERNO MÉDIO"),
    op("lle_posterior", "Ligamento lateral externo posterior", "LIGAMENTO LATERAL EXTERNO POSTERIOR"),
    op("lle_anterior_medio", "Ligamento lateral externo anterior / medio", "LIGAMENTO LATERAL EXTERNO ANTERIOR/MÉDIO"),
    op("lle_medio_posterior", "Ligamento lateral externo medio / posterior", "LIGAMENTO LATERAL EXTERNO MÉDIO/POSTERIOR"),
    op("lle_anterior_medio_posterior", "Ligamento lateral externo anterior / medio / posterior", "LIGAMENTO LATERAL EXTERNO ANTERIOR/MÉDIO/POSTERIOR"),
    op("lli_deltoide", "Ligamento lateral interno (deltoideo)", "LIGAMENTO LATERAL INTERNO (DELTOIDE)"),
    op("tibiofibular_anterior", "Ligamento tibioperoneo anterior (sindesmosis)", "LIGAMENTO TIBIOFIBULAR ANTERIOR (SINDESMOSE)"),
    op("tibiofibular_anterior_posterior", "Ligamento tibioperoneo anterior / posterior (sindesmosis)", "LIGAMENTO TIBIOFIBULAR ANTERIOR/POSTERIOR (SINDESMOSE)"),
    op("membrana_interossea", "Membrana interósea", "MEMBRANA INTERÓSSEA"),
    op("lli", "Ligamento lateral interno", "LIGAMENTO LATERAL INTERNO"),
    op("lle", "Ligamento lateral externo", "LIGAMENTO LATERAL EXTERNO"),
    op("lca", "Ligamento cruzado anterior", "LIGAMENTO CRUZADO ANTERIOR"),
    op("lcp", "Ligamento cruzado posterior", "LIGAMENTO CRUZADO POSTERIOR"),
    op("menisco_lateral", "Menisco lateral", "MENISCO LATERAL"),
    op("menisco_medial", "Menisco medial", "MENISCO MEDIAL"),
  ],
  musculo: [
    op("adutores", "Aductores", "ADUTORES"),
    op("biceps", "Bíceps", "BÍCEPS"),
    op("quadriceps", "Cuádriceps", "QUADRÍCEPS"),
    op("deltoide", "Deltoides", "DELTOIDE"),
    op("dorsal", "Dorsal", "DORSAL"),
    op("panturrilha", "Pantorrilla", "PANTURRILHA"),
    op("gluteos", "Glúteos", "GLÚTEOS"),
    op("isquiotibiais", "Isquiotibiales", "ISQUIOTIBIAIS"),
    op("peitoral", "Pectoral", "PEITORAL"),
    op("psoas_iliaco", "Psoas ilíaco", "PSOAS-ILÍACO"),
    op("triceps_braquial", "Tríceps braquial", "TRÍCEPS BRAQUIAL"),
    op("soleo", "Sóleo", "SÓLEO"),
    op("musculos_pe", "Músculos del pie", "MÚSCULOS DO PÉ"),
    op("rotadores_quadril", "Rotadores de la cadera", "ROTADORES DO QUADRIL"),
    op("fascia_plantar_insercao", "Fascia plantar (inserción)", "FÁSCIA PLANTAR (INSERÇÃO)"),
    op("fascia_plantar_nao_insercao", "Fascia plantar (no inserción)", "FÁSCIA PLANTAR (NÃO INSERÇÃO)"),
    op("triceps_sural", "Tríceps sural", "TRÍCEPS SURAL"),
  ],
  musculo_especifico: [
    op("plantar", "Plantar", "PLANTAR"),
    op("soleo", "Sóleo", "SÓLEO"),
    op("gastrocnemio_medial", "Gastrocnemio medial", "GASTROCNÊMIO MEDIAL"),
    op("gastrocnemio_lateral", "Gastrocnemio lateral", "GASTROCNÊMIO LATERAL"),
    op("biceps_femoral", "Bíceps femoral", "BÍCEPS FEMORAL"),
    op("semimembranoso", "Semimembranoso", "SEMIMEMBRANOSO"),
    op("semitendinoso", "Semitendinoso", "SEMITENDÍNEO"),
    op("tendao_conjunto", "Tendón conjunto del bíceps femoral (cabeza larga) y semitendinoso", "TENDÃO CONJUNTO DO BÍCEPS FEMORAL (CABEÇA LONGA) E SEMITENDÍNEO"),
    op("reto_femoral", "Recto femoral", "RETO FEMORAL"),
    op("sartorio", "Sartorio", "SARTÓRIO"),
    op("tensor_fascia_lata", "Tensor de la fascia lata", "TENSOR DA FÁSCIA LATA"),
    op("psoas", "Psoas", "PSOAS"),
    op("abdominal", "Abdominal", "ABDOMINAL"),
    op("obliquo_interno", "Oblicuo interno", "OBLÍQUO INTERNO"),
    op("obliquo_externo", "Oblicuo externo", "OBLÍQUO EXTERNO"),
    op("manguito_rotador", "Manguito rotador", "MANGUITO ROTADOR"),
    op("adutor_magno", "Aductor mayor", "ADUTOR MAGNO"),
    op("adutor_longo", "Aductor largo", "ADUTOR LONGO"),
    op("adutor_curto", "Aductor corto", "ADUTOR CURTO"),
    op("obturador_externo", "Obturador externo", "OBTURADOR EXTERNO"),
    op("obturador_interno", "Obturador interno", "OBTURADOR INTERNO"),
    op("adutor_halux", "Aductor del hallux", "ADUTOR DO HÁLUX"),
    op("piriforme", "Piriforme", "PIRIFORME"),
    op("vasto_medial", "Vasto medial", "VASTO MEDIAL"),
    op("vasto_lateral", "Vasto lateral", "VASTO LATERAL"),
  ],
  area: [
    op("proximal_umtp", "Proximal – UMTP", "PROXIMAL – UMTP"),
    op("proximal_umtc_com", "Proximal – UMTC con compromiso del tendón", "PROXIMAL – UMTC COM COMPROMETIMENTO DO TENDÃO"),
    op("proximal_umtc_sem", "Proximal – UMTC sin compromiso del tendón", "PROXIMAL – UMTC SEM COMPROMETIMENTO DO TENDÃO"),
    op("proximal_tendao_livre", "Proximal – tendón libre", "PROXIMAL – TENDÃO LIVRE"),
    op("proximal_umtm", "Proximal – UMTM", "PROXIMAL – UMTM"),
    op("medio_umtp", "Medio – UMTP", "MÉDIO – UMTP"),
    op("medio_umtc_com", "Medio – UMTC con compromiso del tendón", "MÉDIO – UMTC COM COMPROMETIMENTO DO TENDÃO"),
    op("medio_umtc_sem", "Medio – UMTC sin compromiso del tendón", "MÉDIO – UMTC SEM COMPROMETIMENTO DO TENDÃO"),
    op("medio_umtm", "Medio – UMTM", "MÉDIO – UMTM"),
    op("distal_umtp", "Distal – UMTP", "DISTAL – UMTP"),
    op("distal_umtc_com", "Distal – UMTC con compromiso del tendón", "DISTAL – UMTC COM COMPROMETIMENTO DO TENDÃO"),
    op("distal_umtc_sem", "Distal – UMTC sin compromiso del tendón", "DISTAL – UMTC SEM COMPROMETIMENTO DO TENDÃO"),
    op("distal_tendao_livre", "Distal – tendón libre", "DISTAL – TENDÃO LIVRE"),
    op("distal_umtm", "Distal – UMTM", "DISTAL – UMTM"),
    op("muscular", "Muscular", "MUSCULAR"),
    op("mioaponeurotica", "Mioaponeurótica", "MIOAPONEURÓTICA"),
    op("insercao_proximal", "Inserción proximal", "INSERÇÃO PROXIMAL"),
    op("insercao_distal", "Inserción distal", "INSERÇÃO DISTAL"),
    op("proximal_umf", "Proximal – UMF", "PROXIMAL – UMF"),
    op("medio_umf", "Medio – UMF", "MÉDIO – UMF"),
    op("distal_umf", "Distal – UMF", "DISTAL – UMF"),
  ],
  producto: [
    op("traumatica", "Traumática", "Traumatica"),
    op("nao_traumatica", "No traumática", "Nao Traumatica"),
    op("trauma_indireto", "Trauma indirecto", "Trauma Indireto"),
    op("outro", "Otro", "Outro"),
  ],
  mecanismo: [
    op("sprint", "Sprint", "SPRINT"),
    op("frenagem", "Frenada", "FRENAGEM"),
    op("chute", "Remate", "CHUTE"),
    op("salto", "Salto", "SALTO"),
    op("passe", "Pase", "PASSE"),
    op("sobrecarga_progressiva", "Sobrecarga progresiva", "SOBRECARGA PROGRESSIVA"),
    op("carrinho", "Barrida", "CARRINHO"),
    op("alongamento", "Elongación", "ALONGAMENTO"),
    op("queda", "Caída", "QUEDA"),
    op("mudanca_direcao", "Cambio de dirección (COD)", "MUDANÇA DE DIREÇÃO (COD)"),
    op("inversao", "Inversión", "INVERSÃO"),
    op("eversao", "Eversión", "EVERSÃO"),
    op("trava_chuteira", "Traba del botín", "TRAVA DA CHUTEIRA"),
    op("metabolico", "Metabólico", "METABÓLICO"),
    op("academia_forca", "Gimnasio (fuerza)", "ACADEMIA (FORÇA)"),
  ],
  cuando: [
    op("partida_oficial", "Partido oficial", "Partida Oficial"),
    op("partida_amistoso", "Partido amistoso", "Partida Amistoso"),
    op("treinamento", "Entrenamiento", "Treinamento"),
    op("transicao", "Transición", "Transição"),
    op("fora", "Fuera", "Fora"),
  ],
  localizacion: [
    op("profissional", "Profesional", "Profissional"),
    op("cat_base", "Categorías de base", "Cat. Base"),
    op("selecao", "Selección", "Seleção"),
    op("outro", "Otro", "Outro"),
  ],
  severidad: [
    op("registro", "Registro", "REGISTRO"),
    op("leve", "Leve", "LEVE"),
    op("menor", "Menor", "MENOR"),
    op("moderado", "Moderado", "MODERADO"),
    op("mayor", "Mayor", "MAYOR"),
  ],
  recurrencia: [op("sim", "Sí", "Sim"), op("nao", "No", "Não")],
  recidiva: [op("sim", "Sí", "Sim"), op("nao", "No", "Não")],
};

export const GRUPOS = ["registro", "jugador", "lesion", "imagen", "fechas", "notas"];

export const campoPorClave = (clave) => CAMPOS.find((campo) => campo.clave === clave) || null;

export const CAMPOS_CON_LISTA = CAMPOS.filter((campo) => campo.tipo === "lista" || campo.lista);

// Las columnas del Excel que el jugador trae puestas (se guardan en jugadores).
export const DATOS_DEL_JUGADOR = ["numero_registro", "categoria", "fecha_nacimiento", "pie_dominante"];

// Lo que se puede cargar a mano en una lesión (va en `datos` o en su columna).
export const CAMPOS_EDITABLES = CAMPOS.filter((campo) =>
  ["lista", "fecha", "fecha_hora", "texto", "texto_largo"].includes(campo.tipo),
);

const idiomaCorto = (idioma) => (String(idioma || "").startsWith("pt") ? "pt" : "es");
const idiomaLargo = (idioma) => (idiomaCorto(idioma) === "pt" ? "pt-BR" : "es-AR");

// Las filas con las que se siembra un club: las cabeceras y las opciones del
// Excel, en los dos idiomas.
export const filasParaSembrar = (equipoId) => ({
  campos: CAMPOS.map((campo, orden) => ({
    equipo_id: equipoId,
    campo: campo.clave,
    etiqueta_es: campo.etiquetas["es-AR"],
    etiqueta_pt: campo.etiquetas["pt-BR"],
    oculto: false,
    orden,
  })),
  opciones: Object.entries(OPCIONES).flatMap(([campo, lista]) =>
    lista.map((opcion, orden) => ({
      equipo_id: equipoId,
      campo,
      codigo: opcion.codigo,
      etiqueta_es: opcion.etiquetas["es-AR"],
      etiqueta_pt: opcion.etiquetas["pt-BR"],
      oculto: false,
      orden,
    })),
  ),
});

// La configuración vacía: sin filas de la base, valen los valores de acá.
export const configVacia = () => ({ campos: {}, listas: {} });

// Lo que vino de la base, en la forma que usan las pantallas.
export const armarConfig = (filasCampos = [], filasOpciones = []) => {
  const config = configVacia();
  filasCampos.forEach((fila) => {
    config.campos[fila.campo] = {
      etiquetas: { "es-AR": fila.etiqueta_es || "", "pt-BR": fila.etiqueta_pt || "" },
      oculto: Boolean(fila.oculto),
      orden: fila.orden ?? 0,
    };
  });
  [...filasOpciones]
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .forEach((fila) => {
      if (!config.listas[fila.campo]) config.listas[fila.campo] = [];
      config.listas[fila.campo].push({
        codigo: fila.codigo,
        etiquetas: { "es-AR": fila.etiqueta_es || "", "pt-BR": fila.etiqueta_pt || "" },
        oculto: Boolean(fila.oculto),
        orden: fila.orden ?? 0,
      });
    });
  return config;
};

// Un texto en el idioma pedido, y si está vacío, en el otro.
const enIdioma = (etiquetas, idioma) => {
  const principal = idiomaLargo(idioma);
  const otro = principal === "pt-BR" ? "es-AR" : "pt-BR";
  return String(etiquetas?.[principal] || etiquetas?.[otro] || "").trim();
};

// El nombre de una columna en este club.
export const etiquetaDeCampo = (clave, config, idioma) => {
  const propio = config?.campos?.[clave]?.etiquetas;
  const texto = propio ? enIdioma(propio, idioma) : "";
  if (texto) return texto;
  return enIdioma(campoPorClave(clave)?.etiquetas, idioma) || clave;
};

export const campoOculto = (clave, config) => Boolean(config?.campos?.[clave]?.oculto);

// Las opciones de un desplegable en este club (las de la base si las hay, si
// no las del Excel), cada una con su texto en el idioma pedido.
export const opcionesDeCampo = (clave, config, idioma, { conOcultas = false } = {}) => {
  const base = config?.listas?.[clave]?.length ? config.listas[clave] : OPCIONES[clave] || [];
  return base
    .filter((opcion) => conOcultas || !opcion.oculto)
    .map((opcion) => ({ valor: opcion.codigo, etiqueta: enIdioma(opcion.etiquetas, idioma) || opcion.codigo, oculto: Boolean(opcion.oculto) }));
};

// El texto de una opción guardada. Una opción que ya no está en la lista se
// muestra igual (por su código), para no perder lo cargado.
export const etiquetaDeOpcion = (clave, codigo, config, idioma) => {
  if (!codigo) return "";
  const todas = opcionesDeCampo(clave, config, idioma, { conOcultas: true });
  return todas.find((opcion) => opcion.valor === codigo)?.etiqueta || String(codigo);
};

// Código para una opción nueva que agrega el club.
export const codigoNuevo = (texto) => {
  const base = String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${base || "opcion"}_${Date.now().toString(36)}`;
};
