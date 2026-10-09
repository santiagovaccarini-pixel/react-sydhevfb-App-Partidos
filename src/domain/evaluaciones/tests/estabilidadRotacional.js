import { dividir, esVacio, siError } from "../excel.js";
import { AYUDA_FUNCIONAL, bloqueDeFuncional, enSuBloque } from "./movilidad.js";

// Estabilidad rotacional: el último bloque de la hoja "Funcional" del Excel
// BD_evaluaciones, como su propio test (Santiago, 09/10: en el Excel va en la
// fila del jugador, pero se toma en otro día, con su fecha y su n° de
// evaluación). Se elige una opción en ocho listas: cuatro con la pierna
// derecha en apoyo y cuatro con la izquierda. No tiene clases, ni valores de
// referencia, ni colores. Arriba, el informe dice qué parte de las filas que
// se ven tiene cada opción.

const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });

const ID = "estabilidad_rotacional";

// Las listas del Excel, con sus opciones como están en la hoja (cada club les
// cambia el nombre o suma otras en Ajustes).
export const LISTAS = Object.freeze({
  estabilidad_cifosis: Object.freeze([
    { codigo: "no", etiquetas: et("NO", "NÃO") },
    { codigo: "alta", etiquetas: et("ALTA", "ALTA") },
    { codigo: "baja", etiquetas: et("BAJA", "BAIXA") },
    { codigo: "alta_y_baja", etiquetas: et("ALTA Y BAJA", "ALTA E BAIXA") },
  ]),
  estabilidad_si_no: Object.freeze([
    { codigo: "si", etiquetas: et("SI", "SIM") },
    { codigo: "no", etiquetas: et("NO", "NÃO") },
  ]),
  estabilidad_recorrido: Object.freeze([
    { codigo: "si", etiquetas: et("SI", "SIM") },
    { codigo: "no_1", etiquetas: et("NO 1", "NÃO 1") },
    { codigo: "no_2", etiquetas: et("NO 2", "NÃO 2") },
    { codigo: "no_1_y_2", etiquetas: et("NO 1 y 2", "NÃO 1 e 2") },
  ]),
});

// El nombre de cada lista en Ajustes › Listas (Cifosis la usan cuatro columnas).
const TITULOS_DE_LISTAS = Object.freeze({
  estabilidad_cifosis: et("Cifosis", "Cifose"),
  estabilidad_si_no: et("Inestabilidad", "Instabilidade"),
  estabilidad_recorrido: et("Completa recorrido", "Completa o percurso"),
});

export const GRUPOS = Object.freeze([
  { clave: "derecha", titulo: et("Pierna derecha en apoyo", "Perna direita em apoio") },
  { clave: "izquierda", titulo: et("Pierna izquierda en apoyo", "Perna esquerda em apoio") },
]);

// Las cuatro preguntas, con la pierna derecha y con la izquierda en apoyo.
// En el Excel las de la derecha terminan en punto ("Cifosis Derecha.") para
// distinguirlas: acá las distingue el bloque de arriba.
const PREGUNTAS = Object.freeze([
  { clave: "cifosis_derecha", titulo: et("Cifosis Derecha", "Cifose Direita"), lista: "estabilidad_cifosis", pegar: "cifosis derecha" },
  { clave: "cifosis_izquierda", titulo: et("Cifosis Izquierda", "Cifose Esquerda"), lista: "estabilidad_cifosis", pegar: "cifosis izquierda" },
  { clave: "inestabilidad", titulo: et("Inestabilidad", "Instabilidade"), lista: "estabilidad_si_no", pegar: "inestabilidad" },
  { clave: "completa_recorrido", titulo: et("Completa recorrido", "Completa o percurso"), lista: "estabilidad_recorrido", pegar: "completa recorrido" },
]);

const claveDe = (pregunta, grupo) => `${pregunta.clave}_${grupo.clave}`;

const RESPUESTAS = GRUPOS.flatMap((grupo) => PREGUNTAS.map((pregunta) => ({ ...pregunta, grupo: grupo.clave, clave: claveDe(pregunta, grupo), vez: grupo.clave === "derecha" ? 1 : 2 })));

export const COLUMNAS = Object.freeze([
  { clave: "jugador", titulo: et("Jugador", "Jogador"), tipo: "jugador", fija: true, ancho: 168 },
  { clave: "fecha", titulo: et("Fecha", "Data"), tipo: "fecha", fija: true, ancho: 140 },
  { clave: "numero", titulo: et("Evaluacion", "Avaliação"), tipo: "calculado", formato: "General", fija: true, ancho: 104 },
  { clave: "fecha_nac", titulo: et("Fecha Nac", "Data Nasc."), tipo: "dato_jugador", fija: true, ancho: 120 },
  { clave: "seleccion", titulo: et("Seleccion", "Seleção"), tipo: "lista", fija: true, ancho: 120 },
  ...RESPUESTAS.map(({ clave, titulo, lista, grupo }) => ({ clave, titulo, tipo: "lista", lista, grupo })),
]);

const CLAVES = RESPUESTAS.map(({ clave }) => clave);

// Lo cargado de una fila: el código de cada opción elegida.
const entrada = (fila) => {
  const datos = fila?.datos || {};
  const opcion = (clave) => (typeof datos[clave] === "string" && datos[clave] !== "" ? datos[clave] : null);
  return {
    fecha: fila?.fecha || null,
    seleccion: datos.seleccion || null,
    ...Object.fromEntries(CLAVES.map((clave) => [clave, opcion(clave)])),
  };
};

const calcularFila = ({ numero }) => ({ numero });

// ------------------------------------------------------------ El informe --
// Las filas 12 a 15 del Excel, con las filas que se ven: N° (cuántas tienen
// la respuesta) y qué parte tiene cada opción, con su nombre adelante ("Baja
// 40,5%"; en el Excel, el nombre estaba arriba, en las filas 1 a 3). En el
// Excel, algunas columnas dividían por el N° de otra (Cifosis Izquierda y la
// pierna izquierda, por el de la primera Cifosis; la segunda Inestabilidad,
// por el de la primera): acá cada una, por el suyo.
const OPCIONES_DEL_INFORME = Object.freeze({
  estabilidad_cifosis: [
    { codigo: "baja", rotulo: et("Baja", "Baixa") },
    { codigo: "alta_y_baja", rotulo: et("Baja/Alta", "Baixa/Alta") },
    { codigo: "alta", rotulo: et("Alta", "Alta") },
  ],
  estabilidad_si_no: [{ codigo: "si", rotulo: et("SI", "SIM") }],
  estabilidad_recorrido: [
    { codigo: "no_1", rotulo: et("NO 1", "NÃO 1") },
    { codigo: "no_1_y_2", rotulo: et("NO 1 y NO 2", "NÃO 1 e NÃO 2") },
    { codigo: "no_2", rotulo: et("NO 2", "NÃO 2") },
  ],
});

const COLUMNAS_DEL_INFORME = Object.freeze(["numero", ...CLAVES]);

const informe = ({ est, filas = [] }) => {
  const n = { numero: { valor: est.numero.n, formato: "General" } };
  const partes = [{}, {}, {}];
  RESPUESTAS.forEach(({ clave, lista }) => {
    const cuantas = filas.filter((celdas) => !esVacio(celdas[clave])).length;
    n[clave] = { valor: cuantas, formato: "0" };
    OPCIONES_DEL_INFORME[lista].forEach(({ codigo, rotulo }, i) => {
      const conEsa = filas.filter((celdas) => celdas[clave] === codigo).length;
      partes[i][clave] = { valor: siError(dividir(conEsa, cuantas), ""), formato: "0.0%", rotulo };
    });
  });
  return [
    { id: "n", rotulo: et("N°", "N°"), celdas: n },
    ...partes.map((celdas, i) => ({ id: `parte${i + 1}`, rotulo: et("%", "%"), celdas })),
  ];
};

// ---------------------------------------------------------------- Pegar --
// Su bloque de la hoja Funcional es el que empieza en su Fecha y tiene las
// Cifosis (movilidad.js, bloqueDeFuncional); adentro, cada pregunta está dos
// veces: primero con la pierna derecha en apoyo y después con la izquierda.
export const CABECERAS_PARA_PEGAR = Object.freeze({
  jugador: ["jugador"],
  seleccion: ["seleccion", "selección"],
  fecha: enSuBloque("fecha"),
  ...Object.fromEntries(RESPUESTAS.map(({ clave, pegar, vez }) => [clave, enSuBloque(pegar, vez)])),
});

export const ESTABILIDAD_ROTACIONAL = Object.freeze({
  id: ID,
  // El área del reporte individual (src/domain/evaluaciones/areas.js).
  area: "zona_media",
  pestana: et("Estabilidad rotacional", "Estabilidade rotacional"),
  titulo: et("Estabilidad rotacional", "Estabilidade rotacional"),
  nota: et("", ""),
  grupos: GRUPOS,
  columnas: COLUMNAS,
  listas: LISTAS,
  titulosDeListas: TITULOS_DE_LISTAS,
  tiempos: [],
  numeros: [],
  // No tiene valores de referencia: no se avisa que faltan.
  conReferencias: false,
  metricas: [],
  filasDeReferencia: [],
  entrada,
  calcularFila,
  columnasDelInforme: COLUMNAS_DEL_INFORME,
  informe,
  reglas: [],
  reglasDelInforme: [],
  // Al pegar la hoja Funcional entera, la fila sin ninguna respuesta es de
  // otro test y no se lee.
  saltearFilasSinMedidas: true,
  ayudaParaPegar: AYUDA_FUNCIONAL,
  bloqueParaPegar: bloqueDeFuncional("estabilidad"),
  cabecerasParaPegar: CABECERAS_PARA_PEGAR,
});

export default ESTABILIDAD_ROTACIONAL;
