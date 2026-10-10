import { textoDeValor } from "../evaluaciones/excel.js";
import { POR_MINUTO } from "./columnas.js";

// Cómo se ve y cómo se recalcula cada valor de una fila del GPS.

export const esNumero = (valor) => typeof valor === "number" && Number.isFinite(valor);

// Una duración o una hora en segundos, como la muestra el Excel (h:mm:ss):
// 2937 → "0:48:57", 72004 → "20:00:04". Al segundo más cercano.
export const textoDeSegundos = (segundos) => {
  if (!esNumero(segundos)) return "";
  const total = Math.round(Math.abs(segundos));
  const dos = (numero) => String(numero).padStart(2, "0");
  return `${segundos < 0 && total > 0 ? "-" : ""}${Math.floor(total / 3600)}:${dos(Math.floor((total % 3600) / 60))}:${dos(total % 60)}`;
};

// El texto de una celda con el formato de su columna (como el Excel). Las
// listas los da la pantalla (con el nombre que les puso el club).
export const textoDeCelda = (columna, valor, idioma) => {
  if (valor === null || valor === undefined || valor === "") return "";
  if (columna.tipo === "tiempo" || columna.tipo === "hora") return textoDeSegundos(valor);
  if (columna.tipo === "numero" || columna.tipo === "porMinuto") return esNumero(valor) ? textoDeValor(valor, columna.formato || "General", idioma) : String(valor);
  return String(valor);
};

// Un "por minuto": el valor ÷ los minutos de la fila, como la plantilla de
// carga (=F/(Z*1440)). Sin tiempo: 0 si el valor es 0 (las filas de quien
// no entrenó, que la plantilla llena con 0) y vacío si no.
export const porMinuto = (valor, segundos) => {
  if (!esNumero(valor)) return null;
  if (esNumero(segundos) && segundos > 0) return valor / (segundos / 60);
  return valor === 0 ? 0 : null;
};

// Los datos de una fila después de cambiar una celda: si se cambió una
// medida o el Tiempo, se recalcula su "por minuto" (Santiago, 10/10: lo
// traído del Excel queda como está; lo que se cambia, se recalcula).
export const datosConCambio = (datos, clave, valor) => {
  const nuevos = { ...datos, [clave]: valor };
  if (valor === null || valor === undefined || valor === "") delete nuevos[clave];
  const recalcular = clave === "tiempo" ? Object.keys(POR_MINUTO) : POR_MINUTO[clave] ? [clave] : [];
  recalcular.forEach((de) => {
    if (!(de in nuevos) && !(POR_MINUTO[de] in nuevos)) return;
    const calculado = porMinuto(nuevos[de], nuevos.tiempo);
    if (calculado === null) delete nuevos[POR_MINUTO[de]];
    else nuevos[POR_MINUTO[de]] = calculado;
  });
  return nuevos;
};

// El período que se ve al abrir la Base: las últimas 4 semanas, hoy
// incluido (Santiago, 10/10). hoy: ISO.
export const SEMANAS_AL_ABRIR = 4;
export const periodoInicial = (hoy, semanas = SEMANAS_AL_ABRIR) => {
  const [anio, mes, dia] = String(hoy).split("-").map(Number);
  const desde = new Date(Date.UTC(anio, mes - 1, dia - (semanas * 7 - 1)));
  return { desde: desde.toISOString().slice(0, 10), hasta: hoy };
};
