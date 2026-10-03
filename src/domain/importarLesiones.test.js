import { describe, expect, test } from "vitest";
import {
  COMO_PERSONA,
  ESTADOS,
  EQUIVALENCIAS_DEL_EXCEL,
  NO_CARGAR,
  fechaDelExcel,
  fechaHoraDelExcel,
  leerLesionesPegadas,
  listasParaImportar,
  ordenDeCarga,
  planDeImportacion,
} from "./importarLesiones.js";
import { OPCIONES } from "./lesionesCampos.js";

const HOY = "2026-10-03";
const PLANTEL = [
  { id: 1, nombre: "Ana Uno", categoria: "profissional" },
  { id: 2, nombre: "Bea Dos", categoria: "sub20" },
];

// Como sale del Excel al copiar la hoja Antecedentes BD: la fila de los
// grupos, la de los títulos, la del filtro (que dice algunas cabeceras
// distinto) y las lesiones. Las columnas calculadas vienen con lo que
// calcula el Excel y no se leen.
const CABECERAS = [
  "N° de Caso",
  "N° de Registro",
  "Nome e Sobrenome",
  "Categoria",
  "Idade",
  "Tipo de lesão",
  "Parte do Corpo Lesionada",
  "Lado",
  "HORA DA IMAGEM",
  "Músculo afetado",
  "Mecanismo",
  "Quando",
  "Data de Início da Lesão (DD/MM/YYYY)",
  "Passagem para o Transicao (DD/MM/YYYY)",
  "Recup 1",
  "Retorno à Data de Treinamento (DD/MM/YYYY)",
  "Retorno à Data da Competição (DD/MM/YYYY)",
  "Severidade",
  "Comentários adicionais",
  "Médico",
];
const FILTRO = CABECERAS.map((cabecera) =>
  cabecera === "Parte do Corpo Lesionada" ? "Parte do Corpo Ferida" : cabecera === "Lado" ? "Side" : cabecera === "HORA DA IMAGEM" ? "HORA DA FOTO" : cabecera,
);
const fila = (valores) => CABECERAS.map((cabecera) => valores[cabecera] ?? "").join("\t");
const LESION_1 = {
  "N° de Caso": "1",
  "N° de Registro": "1",
  "Nome e Sobrenome": "ANA UNO",
  Categoria: "Profissional",
  Idade: "39",
  "Tipo de lesão": "LESÃO MUSCULAR GRAU 2 A",
  "Parte do Corpo Lesionada": "COXA",
  Lado: "Direito",
  "HORA DA IMAGEM": "22/01/2026 18:30",
  "Músculo afetado": "ISQUIOTIBIAIS",
  Mecanismo: "SPRINT",
  Quando: "Treinamento",
  "Data de Início da Lesão (DD/MM/YYYY)": "21/01/2026",
  "Passagem para o Transicao (DD/MM/YYYY)": "30/01/2026 00:00",
  "Recup 1": "9",
  "Retorno à Data de Treinamento (DD/MM/YYYY)": "05/02/2026 00:00",
  "Retorno à Data da Competição (DD/MM/YYYY)": "10/02/2026 00:00",
  Severidade: "Moderada",
  "Comentários adicionais": "Sentiu no fim do treino",
  Médico: "Dr. X",
};
const PEGADO = [
  "\t\tDados Gerais\t\t\tDescrição Geral",
  CABECERAS.join("\t"),
  FILTRO.join("\t"),
  fila(LESION_1),
  fila({ "N° de Caso": "2", "Nome e Sobrenome": "Bea  Dos", "Tipo de lesão": "TENDINOPATIA", "Parte do Corpo Lesionada": "PE", Lado: "Esquerdo", "Data de Início da Lesão (DD/MM/YYYY)": "14/03/2026", Mecanismo: "BAILE" }),
  fila({ "N° de Caso": "3", "Nome e Sobrenome": "Cata Tres", "Tipo de lesão": "ENTORSE/LESÃO LIGAMENTAR", "Parte do Corpo Lesionada": "TORNOZELO/PÉ", Lado: "Direito", "Data de Início da Lesão (DD/MM/YYYY)": "01/04/2026" }),
  fila({ "N° de Caso": "4", "Nome e Sobrenome": "Ana Uno" }),
  fila({}),
].join("\n");

const leer = (texto = PEGADO) => leerLesionesPegadas(texto, { config: null });
const plan = (opciones = {}) => planDeImportacion(leer().filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY, ...opciones });

describe("leer lo pegado de Antecedentes BD", () => {
  test("encuentra las cabeceras debajo de los grupos y suma las de la fila del filtro", () => {
    const leido = leer();
    expect(leido.error).toBe("");
    expect(leido.columnas).toMatchObject({ numero_caso: 0, jugador: 2, tipo_lesion: 5, parte_cuerpo: 6, lado: 7, hora_imagen: 8, fecha_lesion: 12, fecha_alta: 16, medico: 19 });
    // Lo que el Excel calcula no se lee.
    expect(leido.columnas).not.toHaveProperty("numero_registro");
    expect(leido.columnas).not.toHaveProperty("severidad");
    expect(leido.columnas).not.toHaveProperty("categoria");
  });

  test("la fila del filtro y las vacías no son lesiones", () => {
    expect(leer().filas.map((una) => una.textos.numero_caso)).toEqual(["1", "2", "3", "4"]);
  });

  test("solo con la fila del filtro también se entiende", () => {
    const leido = leer([FILTRO.join("\t"), fila(LESION_1)].join("\n"));
    expect(leido.columnas).toMatchObject({ parte_cuerpo: 6, lado: 7, hora_imagen: 8 });
    expect(leido.filas).toHaveLength(1);
  });

  test("sin la cabecera del jugador no se adivina", () => {
    expect(leer("1\tANA UNO\tCOXA").error).toBe("lesiones.importar.sinCabeceras");
    expect(leer(CABECERAS.join("\t")).error).toBe("lesiones.importar.sinFilas");
  });
});

describe("las fechas del Excel", () => {
  test("con o sin la hora, día/mes o mes/día, y el número de serie", () => {
    expect(fechaDelExcel("21/01/2026")).toBe("2026-01-21");
    expect(fechaDelExcel("21/01/2026 00:00")).toBe("2026-01-21");
    expect(fechaDelExcel("1/21/26 0:00", "mes_dia")).toBe("2026-01-21");
    expect(fechaDelExcel("46043")).toBe("2026-01-21");
    expect(fechaDelExcel("2026-01-21")).toBe("2026-01-21");
    expect(fechaDelExcel("")).toBeNull();
    expect(fechaDelExcel("31/02/2026")).toBeUndefined();
    expect(fechaDelExcel("pendiente")).toBeUndefined();
  });

  test("la hora de la imagen guarda la hora", () => {
    expect(fechaHoraDelExcel("22/01/2026 18:30")).toBe("2026-01-22T18:30");
    expect(fechaHoraDelExcel("1/22/2026 18:30", "mes_dia")).toBe("2026-01-22T18:30");
    expect(fechaHoraDelExcel("46044.5")).toBe("2026-01-22T12:00");
    expect(fechaHoraDelExcel("")).toBeNull();
  });
});

describe("qué pasa con cada fila", () => {
  test("una lesión completa se carga con lo que se carga a mano", () => {
    const [primera] = plan();
    expect(primera.estado).toBe(ESTADOS.nueva);
    expect(primera.jugador).toMatchObject({ id: 1 });
    expect(primera.lesion).toEqual({
      id: null,
      jugador_id: 1,
      persona: null,
      numero_caso: 1,
      fecha_lesion: "2026-01-21",
      fecha_transicion: "2026-01-30",
      fecha_retorno_entrenamiento: "2026-02-05",
      fecha_alta: "2026-02-10",
      datos: {
        tipo_lesion: "muscular_2a",
        parte_cuerpo: "coxa",
        lado: "direito",
        hora_imagen: "2026-01-22T18:30",
        musculo: "isquiotibiais",
        mecanismo: "sprint",
        cuando: "treinamento",
        comentarios: "Sentiu no fim do treino",
        medico: "Dr. X",
      },
    });
    expect(primera.avisos).toEqual([]);
  });

  test("los valores escritos fuera de la lista van a la opción decidida; lo que no se entiende queda vacío con un aviso", () => {
    const segunda = plan()[1];
    expect(segunda.estado).toBe(ESTADOS.nueva);
    expect(segunda.lesion.datos).toMatchObject({ tipo_lesion: "tendinea", parte_cuerpo: "pe_dedo", lado: "esquerdo" });
    expect(segunda.lesion.datos).not.toHaveProperty("mecanismo");
    expect(segunda.avisos).toEqual([{ campo: "mecanismo", valor: "BAILE" }]);
  });

  test("las equivalencias apuntan a opciones que existen", () => {
    Object.entries(EQUIVALENCIAS_DEL_EXCEL).forEach(([campo, equivalencias]) =>
      Object.values(equivalencias).forEach((codigo) => expect(OPCIONES[campo].some((opcion) => opcion.codigo === codigo)).toBe(true)),
    );
    const [, , equivalencias] = listasParaImportar(null).tipo_lesion;
    expect(equivalencias).toContainEqual({ valor: "laceracao", etiqueta: "LACERAÇÃO/ ABRASÃO" });
  });

  // La configuración de un club: las listas del Excel con lo que el club cambió.
  const configCon = ({ listas = {}, campos = {} }) => ({
    campos,
    listas: Object.fromEntries(
      Object.entries(OPCIONES).map(([campo, opciones]) => [
        campo,
        [...opciones.map((opcion, orden) => ({ codigo: opcion.codigo, etiquetas: { ...opcion.etiquetas }, oculto: false, orden })), ...(listas[campo] || [])].map((opcion) =>
          listas.renombrar?.[opcion.codigo] ? { ...opcion, etiquetas: listas.renombrar[opcion.codigo] } : opcion,
        ),
      ]),
    ),
  });

  test("una opción del club con el mismo texto gana sobre las equivalencias del Excel", () => {
    const config = configCon({ listas: { tipo_lesion: [{ codigo: "tendinopatia_club", etiquetas: { "es-AR": "Tendinopatía", "pt-BR": "TENDINOPATIA" }, oculto: false, orden: 99 }] } });
    const segunda = planDeImportacion(leer().filas, { plantel: PLANTEL, lesiones: [], config, hoy: HOY })[1];
    expect(segunda.lesion.datos.tipo_lesion).toBe("tendinopatia_club");
  });

  test("si el club renombró una opción, el texto original del Excel se sigue entendiendo", () => {
    const config = configCon({ listas: { renombrar: { coxa: { "es-AR": "Muslo (cara posterior)", "pt-BR": "Coxa / posterior" } } } });
    const [primera] = planDeImportacion(leer().filas, { plantel: PLANTEL, lesiones: [], config, hoy: HOY });
    expect(primera.lesion.datos.parte_cuerpo).toBe("coxa");
    expect(primera.avisos).toEqual([]);
  });

  test("las fechas se revisan aunque el club haya escondido la columna (la base las revisa igual)", () => {
    const config = configCon({ campos: { fecha_transicion: { etiquetas: {}, oculto: true } } });
    const alReves = { ...LESION_1, "Passagem para o Transicao (DD/MM/YYYY)": "10/01/2026" };
    const leido = leer([CABECERAS.join("\t"), fila(alReves)].join("\n"));
    const [primera] = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config, hoy: HOY });
    expect(primera.problemas).toEqual(["lesiones.error.fechaAntes"]);
  });

  test("un nombre que no está en Datos básicos espera que se elija qué es; no se carga solo", () => {
    const tercera = plan()[2];
    expect(tercera.estado).toBe(ESTADOS.sinJugador);
    expect(tercera.problemas).toEqual([]);
    expect(ordenDeCarga(plan()).map((una) => una.nombre)).not.toContain("Cata Tres");
  });

  test("elegido: se guarda con ese nombre (sin agregarlo a Datos básicos), es un jugador de la lista, o no se carga", () => {
    const { indice } = plan()[2];
    const comoPersona = plan({ elegidos: { [indice]: COMO_PERSONA } })[2];
    expect(comoPersona.estado).toBe(ESTADOS.nueva);
    expect(comoPersona.fueraDeDatos).toBe(true);
    expect(comoPersona.lesion).toMatchObject({ jugador_id: null, persona: "Cata Tres", fecha_lesion: "2026-04-01", datos: { parte_cuerpo: "tornozelo_pe", lado: "direito" } });
    const esDelPlantel = plan({ elegidos: { [indice]: "2" } })[2];
    expect(esDelPlantel.estado).toBe(ESTADOS.nueva);
    expect(esDelPlantel.lesion).toMatchObject({ jugador_id: 2, persona: null });
    expect(plan({ elegidos: { [indice]: NO_CARGAR } })[2].estado).toBe(ESTADOS.noVa);
  });

  test("sin fecha de inicio también se carga, y queda para completar", () => {
    const cuarta = plan()[3];
    expect(cuarta.estado).toBe(ESTADOS.nueva);
    expect(cuarta.lesion).toMatchObject({ jugador_id: 1, fecha_lesion: null, numero_caso: 4 });
    expect(cuarta.faltan).toEqual(["fecha_lesion", "tipo_lesion", "parte_cuerpo", "lado"]);
    expect(cuarta.problemas).toEqual([]);
  });

  test("lo ya cargado con este nombre fuera de Datos básicos, o sin fecha con el mismo N° de caso, ya está", () => {
    const yaCargadas = [
      { id: "x", numero_caso: 3, jugador_id: null, persona: "cata  tres", fecha_lesion: "2026-04-01", datos: { parte_cuerpo: "tornozelo_pe", lado: "direito" } },
      { id: "y", numero_caso: 4, jugador_id: 1, fecha_lesion: null, datos: {} },
    ];
    const filas = plan({ lesiones: yaCargadas });
    expect(filas[2].estado).toBe(ESTADOS.yaEsta);
    expect(filas[3].estado).toBe(ESTADOS.yaEsta);
  });

  test("lo que ya está en la app no se vuelve a cargar", () => {
    const yaEsta = { id: "x", numero_caso: 1, jugador_id: 1, fecha_lesion: "2026-01-21", datos: { parte_cuerpo: "coxa", lado: "direito" } };
    const filas = plan({ lesiones: [yaEsta] });
    expect(filas[0].estado).toBe(ESTADOS.yaEsta);
    expect(filas[1].estado).toBe(ESTADOS.nueva);
  });

  test("un N° de caso que en la app es de otra lesión no se pisa", () => {
    const otra = { id: "x", numero_caso: 2, jugador_id: 1, fecha_lesion: "2026-05-01", datos: { parte_cuerpo: "joelho", lado: "direito" } };
    const segunda = plan({ lesiones: [otra] })[1];
    expect(segunda.estado).toBe(ESTADOS.conProblemas);
    expect(segunda.problemas).toEqual(["lesiones.importar.casoOcupado"]);
  });

  test("la misma lesión dos veces en lo pegado: la segunda no se carga", () => {
    const repetida = { ...LESION_1, "N° de Caso": "5" };
    const leido = leer([CABECERAS.join("\t"), fila(LESION_1), fila(repetida)].join("\n"));
    const filas = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(filas.map((una) => una.estado)).toEqual([ESTADOS.nueva, ESTADOS.conProblemas]);
    expect(filas[1].problemas).toEqual(["lesiones.error.repetida"]);
  });

  test("una recaída durante la recuperación sí se carga (con otra fecha)", () => {
    const recaida = { ...LESION_1, "N° de Caso": "5", "Data de Início da Lesão (DD/MM/YYYY)": "03/02/2026", "Passagem para o Transicao (DD/MM/YYYY)": "", "Retorno à Data de Treinamento (DD/MM/YYYY)": "", "Retorno à Data da Competição (DD/MM/YYYY)": "", "HORA DA IMAGEM": "" };
    const leido = leer([CABECERAS.join("\t"), fila(LESION_1), fila(recaida)].join("\n"));
    const filas = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(filas.map((una) => una.estado)).toEqual([ESTADOS.nueva, ESTADOS.nueva]);
  });

  test("lo que no pasaría al cargar a mano tampoco pasa acá", () => {
    const alReves = { ...LESION_1, "Retorno à Data da Competição (DD/MM/YYYY)": "10/01/2026" };
    const futura = { ...LESION_1, "N° de Caso": "6", "Data de Início da Lesão (DD/MM/YYYY)": "21/12/2026", "Passagem para o Transicao (DD/MM/YYYY)": "", "Retorno à Data de Treinamento (DD/MM/YYYY)": "", "Retorno à Data da Competição (DD/MM/YYYY)": "", "HORA DA IMAGEM": "" };
    const leido = leer([CABECERAS.join("\t"), fila(alReves), fila(futura)].join("\n"));
    const filas = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(filas[0].problemas).toEqual(["lesiones.error.fechaAntes"]);
    expect(filas[1].problemas).toEqual(["lesiones.error.fechaFutura"]);
  });

  test("se cargan por N° de caso, y las que no tienen número al final", () => {
    const sinNumero = { ...LESION_1, "N° de Caso": "", "Data de Início da Lesão (DD/MM/YYYY)": "01/03/2026", "Passagem para o Transicao (DD/MM/YYYY)": "", "Retorno à Data de Treinamento (DD/MM/YYYY)": "", "Retorno à Data da Competição (DD/MM/YYYY)": "", "HORA DA IMAGEM": "" };
    const tarde = { ...LESION_1, "N° de Caso": "9", "Data de Início da Lesão (DD/MM/YYYY)": "01/05/2026", "Passagem para o Transicao (DD/MM/YYYY)": "", "Retorno à Data de Treinamento (DD/MM/YYYY)": "", "Retorno à Data da Competição (DD/MM/YYYY)": "", "HORA DA IMAGEM": "" };
    const leido = leer([CABECERAS.join("\t"), fila(sinNumero), fila(tarde), fila(LESION_1)].join("\n"));
    const filas = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(ordenDeCarga(filas).map((una) => una.numeroCaso)).toEqual([1, 9, null]);
    // La que no trae número va después del más alto de lo pegado.
    expect(ordenDeCarga(filas).map((una) => una.lesion.numero_caso)).toEqual([1, 9, 10]);
  });

  test("sin N° de caso no le quita el número a un caso del Excel que todavía no se carga", () => {
    const sinNumero = { ...LESION_1, "N° de Caso": "" };
    const sinTerminar = { "N° de Caso": "40", "Nome e Sobrenome": "Ana Uno" };
    const leido = leer([CABECERAS.join("\t"), fila(sinNumero), fila(sinTerminar)].join("\n"));
    const yaEnLaApp = [{ id: "x", numero_caso: 12, jugador_id: 2, fecha_lesion: "2026-05-01", datos: { parte_cuerpo: "joelho", lado: "direito" } }];
    const [primera] = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: yaEnLaApp, config: null, hoy: HOY });
    expect(primera.lesion.numero_caso).toBe(41);
  });

  test("el mismo problema en dos columnas se dice una vez", () => {
    const dosAntes = { ...LESION_1, "Passagem para o Transicao (DD/MM/YYYY)": "10/01/2026", "Retorno à Data da Competição (DD/MM/YYYY)": "11/01/2026" };
    const leido = leer([CABECERAS.join("\t"), fila(dosAntes)].join("\n"));
    const [primera] = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(primera.problemas).toEqual(["lesiones.error.fechaAntes"]);
  });

  test("todas las fechas se leen en el mismo orden: una columna con pocas fechas sigue a las otras", () => {
    // Un Excel en inglés: el inicio dice que es mes/día (1/21); el alta solo
    // tiene fechas que podrían ser las dos cosas (2/10 = 10 de febrero).
    const enIngles = { ...LESION_1, "Data de Início da Lesão (DD/MM/YYYY)": "1/21/26", "Passagem para o Transicao (DD/MM/YYYY)": "", "Retorno à Data de Treinamento (DD/MM/YYYY)": "", "Retorno à Data da Competição (DD/MM/YYYY)": "2/10/26 0:00", "HORA DA IMAGEM": "1/22/2026 18:30" };
    const leido = leer([CABECERAS.join("\t"), fila(enIngles)].join("\n"));
    const [primera] = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(primera.lesion).toMatchObject({ fecha_lesion: "2026-01-21", fecha_alta: "2026-02-10" });
    expect(primera.lesion.datos.hora_imagen).toBe("2026-01-22T18:30");
    // Una hora escrita a mano en el otro orden también se entiende.
    expect(fechaHoraDelExcel("22/01/2026 10:00", "mes_dia")).toBe("2026-01-22T10:00");
  });

  test("el jugador: primero el nombre igual; si dos se parecen y ninguno es igual, no se adivina", () => {
    const plantel = [
      { id: 1, nombre: "Joao Silva" },
      { id: 2, nombre: "João Silva" },
      { id: 3, nombre: "Pedro-Henrique" },
      { id: 4, nombre: "Pedro Henrique" },
    ];
    const conNombre = (nombre, caso) => fila({ ...LESION_1, "N° de Caso": caso, "Nome e Sobrenome": nombre });
    const leido = leer([CABECERAS.join("\t"), conNombre("joao silva", "1"), conNombre("JOÃO SILVA", "2"), conNombre("Pedro  Henrique", "3"), conNombre("PEDRO HENRÍQUE", "4")].join("\n"));
    const filas = planDeImportacion(leido.filas, { plantel, lesiones: [], config: null, hoy: HOY });
    expect(filas.map((una) => una.jugador?.id ?? null)).toEqual([1, 2, 4, null]);
    expect(filas[3]).toMatchObject({ estado: ESTADOS.sinJugador, dudoso: true, problemas: [] });
  });

  test("las fechas de una columna en mes/día (un Excel en inglés) se leen bien", () => {
    const enIngles = (dia, mes) => ({ ...LESION_1, "Data de Início da Lesão (DD/MM/YYYY)": `${mes}/${dia}/26`, "Passagem para o Transicao (DD/MM/YYYY)": "", "Retorno à Data de Treinamento (DD/MM/YYYY)": "", "Retorno à Data da Competição (DD/MM/YYYY)": "", "HORA DA IMAGEM": "" });
    const leido = leer([CABECERAS.join("\t"), fila({ ...enIngles(21, 1), "N° de Caso": "1" }), fila({ ...enIngles(5, 3), "N° de Caso": "2" })].join("\n"));
    const filas = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(filas.map((una) => una.lesion.fecha_lesion)).toEqual(["2026-01-21", "2026-03-05"]);
  });

  test("personas fuera de Datos básicos: dos distintas con la misma lesión entran las dos; la misma dos veces, no", () => {
    const de = (nombre, caso) => fila({ ...LESION_1, "N° de Caso": caso, "Nome e Sobrenome": nombre });
    const leido = leer([CABECERAS.join("\t"), de("Persona Uno", "1"), de("Persona Dos", "2"), de("PERSONA UNO", "3")].join("\n"));
    const elegidos = Object.fromEntries(leido.filas.map((una) => [una.indice, COMO_PERSONA]));
    const filas = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY, elegidos });
    expect(filas.map((una) => una.estado)).toEqual([ESTADOS.nueva, ESTADOS.nueva, ESTADOS.conProblemas]);
    expect(filas[2].problemas).toEqual(["lesiones.error.repetida"]);
  });

  test("con fecha de inicio, sin tipo, parte o lado no se carga (como siempre); solo las sin fecha entran incompletas", () => {
    const sinTipo = { ...LESION_1, "Tipo de lesão": "" };
    const leido = leer([CABECERAS.join("\t"), fila(sinTipo)].join("\n"));
    const [primera] = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(primera.estado).toBe(ESTADOS.conProblemas);
    expect(primera.problemas).toEqual(["lesiones.error.tipo"]);
  });

  test("sin fecha ni N° de caso: pegar dos veces no la duplica", () => {
    const pendiente = { "Nome e Sobrenome": "Ana Uno", "Parte do Corpo Lesionada": "COXA" };
    const leido = leer([CABECERAS.join("\t"), fila(pendiente), fila(pendiente)].join("\n"));
    const primeraVez = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(primeraVez.map((una) => una.estado)).toEqual([ESTADOS.nueva, ESTADOS.conProblemas]);
    const cargada = { ...primeraVez[0].lesion, id: "x" };
    const segundaVez = planDeImportacion(leido.filas.slice(0, 1), { plantel: PLANTEL, lesiones: [cargada], config: null, hoy: HOY });
    expect(segundaVez[0].estado).toBe(ESTADOS.yaEsta);
  });

  test("alguien guardado con su nombre y después agregado a Datos básicos: su lesión ya está", () => {
    const yaCargada = { id: "x", numero_caso: 3, jugador_id: null, persona: "Cata Tres", fecha_lesion: "2026-04-01", datos: { parte_cuerpo: "tornozelo_pe", lado: "direito" } };
    const conCata = [...PLANTEL, { id: 9, nombre: "Cata Tres" }];
    const tercera = planDeImportacion(leer().filas, { plantel: conCata, lesiones: [yaCargada], config: null, hoy: HOY })[2];
    expect(tercera.estado).toBe(ESTADOS.yaEsta);
  });

  test("un nombre demasiado largo para la base no se guarda como persona", () => {
    const largo = "N".repeat(130);
    const leido = leer([CABECERAS.join("\t"), fila({ ...LESION_1, "Nome e Sobrenome": largo })].join("\n"));
    const [primera] = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY, elegidos: { [leido.filas[0].indice]: COMO_PERSONA } });
    expect(primera.problemas).toEqual(["lesiones.importar.nombreLargo"]);
  });

  test("una fecha de inicio que no se entiende no es un caso sin terminar: no se carga", () => {
    const rara = { ...LESION_1, "Data de Início da Lesão (DD/MM/YYYY)": "ontem" };
    const leido = leer([CABECERAS.join("\t"), fila(rara)].join("\n"));
    const [primera] = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(primera.estado).toBe(ESTADOS.conProblemas);
    expect(primera.problemas).toContain("lesiones.error.fecha");
    expect(primera.faltan).toEqual([]);
    expect(primera.avisos).toContainEqual({ campo: "fecha_lesion", valor: "ontem" });
  });

  test("una fila con datos y sin nombre se ve, y no se carga; con solo el N° de caso no se lee", () => {
    const sinNombre = { ...LESION_1, "Nome e Sobrenome": "" };
    const leido = leer([CABECERAS.join("\t"), fila(sinNombre), fila({ "N° de Caso": "7" })].join("\n"));
    expect(leido.filas).toHaveLength(1);
    const [primera] = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(primera.estado).toBe(ESTADOS.conProblemas);
    expect(primera.problemas).toEqual(["lesiones.importar.sinNombre"]);
    expect(primera.fueraDeDatos).toBe(false);
    expect(ordenDeCarga([primera])).toEqual([]);
  });

  test("el mismo nombre de afuera escrito de otra forma es la misma persona: se guarda como ya está escrito", () => {
    const de = (nombre, caso, fecha) => fila({ ...LESION_1, "N° de Caso": caso, "Nome e Sobrenome": nombre, "Data de Início da Lesão (DD/MM/YYYY)": fecha, "Passagem para o Transicao (DD/MM/YYYY)": "", "Retorno à Data de Treinamento (DD/MM/YYYY)": "", "Retorno à Data da Competição (DD/MM/YYYY)": "", "HORA DA IMAGEM": "" });
    const leido = leer([CABECERAS.join("\t"), de("João Sousa", "1", "01/02/2026"), de("JOAO SOUSA", "2", "01/03/2026")].join("\n"));
    const elegidos = Object.fromEntries(leido.filas.map((una) => [una.indice, COMO_PERSONA]));
    const filas = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY, elegidos });
    expect(filas.map((una) => una.lesion.persona)).toEqual(["João Sousa", "João Sousa"]);
    // Ya en la app, escrito de otra forma: manda el de la app, y lo mismo ya está.
    const enLaApp = { id: "x", numero_caso: 1, jugador_id: null, persona: "Joao Sousa", fecha_lesion: "2026-02-01", datos: { parte_cuerpo: "coxa", lado: "direito" } };
    const otraVez = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [enLaApp], config: null, hoy: HOY, elegidos });
    expect(otraVez.map((una) => una.estado)).toEqual([ESTADOS.yaEsta, ESTADOS.nueva]);
    expect(otraVez[1].lesion.persona).toBe("Joao Sousa");
  });

  test("sin N° de caso: primero las que tienen fecha y después las sin fecha", () => {
    const conFecha = { ...LESION_1, "N° de Caso": "", "Passagem para o Transicao (DD/MM/YYYY)": "", "Retorno à Data de Treinamento (DD/MM/YYYY)": "", "Retorno à Data da Competição (DD/MM/YYYY)": "", "HORA DA IMAGEM": "" };
    const sinFecha = { "Nome e Sobrenome": "Bea Dos", "Parte do Corpo Lesionada": "COXA" };
    const leido = leer([CABECERAS.join("\t"), fila(sinFecha), fila(conFecha)].join("\n"));
    const filas = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(ordenDeCarga(filas).map((una) => una.lesion.fecha_lesion)).toEqual(["2026-01-21", null]);
  });

  test("sin fecha ni N° de caso, cargada y después completada en la app: ya está", () => {
    const pendiente = { "Nome e Sobrenome": "Ana Uno", "Parte do Corpo Lesionada": "COXA", Lado: "Direito" };
    const leido = leer([CABECERAS.join("\t"), fila(pendiente)].join("\n"));
    const completada = { id: "x", numero_caso: 12, jugador_id: 1, fecha_lesion: "2026-02-01", datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "contusao" } };
    expect(planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [completada], config: null, hoy: HOY })[0].estado).toBe(ESTADOS.yaEsta);
    // Otra parte del cuerpo es otra lesión.
    const otra = { ...completada, datos: { ...completada.datos, parte_cuerpo: "joelho" } };
    expect(planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [otra], config: null, hoy: HOY })[0].estado).toBe(ESTADOS.nueva);
  });

  test("dos jugadores de Datos básicos con el mismo nombre son dos personas", () => {
    const mellizos = [{ id: 5, nombre: "Lucas Silva" }, { id: 6, nombre: "Lucas Silva" }];
    const leido = leer([CABECERAS.join("\t"), fila({ ...LESION_1, "Nome e Sobrenome": "Lucas Silva" })].join("\n"));
    const delOtro = { id: "x", numero_caso: 1, jugador_id: 5, fecha_lesion: "2026-01-21", datos: { parte_cuerpo: "coxa", lado: "direito" } };
    const [primera] = planDeImportacion(leido.filas, { plantel: mellizos, lesiones: [delOtro], config: null, hoy: HOY, elegidos: { [leido.filas[0].indice]: "6" } });
    expect(primera.estado).not.toBe(ESTADOS.yaEsta);
    expect(primera.problemas).toEqual(["lesiones.importar.casoOcupado"]);
  });

  test("el mismo N° de caso y la misma persona con otra fecha de inicio es otra lesión: no se pisa, se avisa", () => {
    const enLaApp = { id: "x", numero_caso: 1, jugador_id: 1, fecha_lesion: "2026-09-01", datos: { parte_cuerpo: "joelho", lado: "direito" } };
    const [primera] = plan({ lesiones: [enLaApp] });
    expect(primera.estado).toBe(ESTADOS.conProblemas);
    expect(primera.problemas).toEqual(["lesiones.importar.casoOcupado"]);
    // Cargada sin fecha y después completada en el Excel: es la misma.
    expect(plan({ lesiones: [{ ...enLaApp, fecha_lesion: null }] })[0].estado).toBe(ESTADOS.yaEsta);
  });

  test("sin fecha ni N° de caso, con otras fechas de alta son dos lesiones distintas", () => {
    const pendiente = (alta) => ({ "Nome e Sobrenome": "Ana Uno", "Parte do Corpo Lesionada": "COXA", "Retorno à Data da Competição (DD/MM/YYYY)": alta });
    const leido = leer([CABECERAS.join("\t"), fila(pendiente("10/05/2026")), fila(pendiente("20/06/2026"))].join("\n"));
    const filas = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(filas.map((una) => una.estado)).toEqual([ESTADOS.nueva, ESTADOS.nueva]);
  });

  test("sin N° de caso, cargada sin fecha y después completada en el Excel: ya está", () => {
    const completa = { ...LESION_1, "N° de Caso": "", "Passagem para o Transicao (DD/MM/YYYY)": "", "Retorno à Data de Treinamento (DD/MM/YYYY)": "", "Retorno à Data da Competição (DD/MM/YYYY)": "", "HORA DA IMAGEM": "" };
    const leido = leer([CABECERAS.join("\t"), fila(completa)].join("\n"));
    const sinFecha = { id: "x", numero_caso: 12, jugador_id: 1, fecha_lesion: null, datos: { parte_cuerpo: "coxa", lado: "direito" } };
    expect(planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [sinFecha], config: null, hoy: HOY })[0].estado).toBe(ESTADOS.yaEsta);
    // Si la de la app tiene algo distinto, es otra.
    const otra = { ...sinFecha, datos: { parte_cuerpo: "joelho" } };
    expect(planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [otra], config: null, hoy: HOY })[0].estado).toBe(ESTADOS.nueva);
  });
});
