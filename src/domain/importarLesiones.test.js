import { describe, expect, test } from "vitest";
import {
  ESTADOS,
  EQUIVALENCIAS_DEL_EXCEL,
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
    expect(listasParaImportar(null).tipo_lesion.find((opcion) => opcion.valor === "laceracao").alias).toContain("LACERAÇÃO/ ABRASÃO");
  });

  test("un nombre que no está en el plantel no se carga", () => {
    const tercera = plan()[2];
    expect(tercera.estado).toBe(ESTADOS.conProblemas);
    expect(tercera.problemas).toEqual(["lesiones.importar.sinJugador"]);
  });

  test("sin fecha de inicio no se carga", () => {
    expect(plan()[3].estado).toBe(ESTADOS.sinFecha);
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
  });

  test("las fechas de una columna en mes/día (un Excel en inglés) se leen bien", () => {
    const enIngles = (dia, mes) => ({ ...LESION_1, "Data de Início da Lesão (DD/MM/YYYY)": `${mes}/${dia}/26`, "Passagem para o Transicao (DD/MM/YYYY)": "", "Retorno à Data de Treinamento (DD/MM/YYYY)": "", "Retorno à Data da Competição (DD/MM/YYYY)": "", "HORA DA IMAGEM": "" });
    const leido = leer([CABECERAS.join("\t"), fila({ ...enIngles(21, 1), "N° de Caso": "1" }), fila({ ...enIngles(5, 3), "N° de Caso": "2" })].join("\n"));
    const filas = planDeImportacion(leido.filas, { plantel: PLANTEL, lesiones: [], config: null, hoy: HOY });
    expect(filas.map((una) => una.lesion.fecha_lesion)).toEqual(["2026-01-21", "2026-03-05"]);
  });
});
