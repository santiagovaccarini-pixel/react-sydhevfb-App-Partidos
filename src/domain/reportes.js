// Las cuentas de los reportes de Lesiones, con la lógica del Excel: el
// "Reporte de Lesiones IND" (el cuadro cada 1000 horas del jugador contra el
// VR, el valor de referencia del plantel) y el contador por período de
// "Antecedentes BD", que arma la hoja "Incidencias c 1000h". Las horas son
// las del GPS. Además, los conteos del reporte grupal.
import { calcular, diasEntre, esFechaISO } from "./lesiones.js";

// Las reglas del cuadro, como están en el Excel: qué lesiones entran (las
// celdas de Datos Básicos P8, R7:R9 y S7), qué es leve para "sin leves" (T8:
// solo la severidad leve; las de registro quedan) y cuáles son lesión
// muscular, "LM" (la lista fija de las fórmulas). Están juntas y con nombre
// para mudarlas a la configuración del club (regla del 02/10).
export const REGLAS_INCIDENCIA = Object.freeze({
  producto: ["nao_traumatica"],
  cuando: ["partida_oficial", "partida_amistoso", "treinamento"],
  localizacion: ["profissional"],
  severidadLeve: "leve",
  tiposMusculares: ["muscular_1a", "muscular_1b", "muscular_1c", "muscular_2a", "muscular_2b", "muscular_2c", "muscular_3a", "muscular_3b", "muscular_3c", "sobrecarga_caibra"],
});

// Las cuatro columnas del cuadro, en el orden del Excel: severidad (todas o
// sin leves) y tipos (todos o solo LM).
export const VARIANTES = Object.freeze([
  { id: "todas", sinLeves: false, soloMusculares: false },
  { id: "sinLeves", sinLeves: true, soloMusculares: false },
  { id: "musculares", sinLeves: false, soloMusculares: true },
  { id: "muscularesSinLeves", sinLeves: true, soloMusculares: true },
]);

export const esLeve = (lesion) => calcular("severidad", lesion) === REGLAS_INCIDENCIA.severidadLeve;
export const esMuscular = (lesion) => REGLAS_INCIDENCIA.tiposMusculares.includes(lesion?.datos?.tipo_lesion);

// Las que cuentan para el cuadro: producto, cuándo y localización del Excel.
export const entraEnElCuadro = (lesion) => {
  const datos = lesion?.datos || {};
  return REGLAS_INCIDENCIA.producto.includes(datos.producto) && REGLAS_INCIDENCIA.cuando.includes(datos.cuando) && REGLAS_INCIDENCIA.localizacion.includes(datos.localizacion);
};

export const cumpleVariante = (lesion, variante) =>
  entraEnElCuadro(lesion) && (!variante.sinLeves || !esLeve(lesion)) && (!variante.soloMusculares || esMuscular(lesion));

// Los días de una lesión dentro de [desde, hasta], como la columna CQ de
// "Antecedentes BD": del inicio (o del comienzo del período) al alta (o al
// final del período). Una lesión sin alta cuenta desde su inicio, aunque sea
// de antes del período. Sin días, null. Sin "desde", desde siempre.
export const diasEnPeriodo = (lesion, desde, hasta) => {
  const inicio = lesion?.fecha_lesion;
  if (!esFechaISO(inicio) || !esFechaISO(hasta) || inicio > hasta) return null;
  const alta = esFechaISO(lesion.fecha_alta) ? lesion.fecha_alta : null;
  let dias;
  if (!alta) dias = diasEntre(inicio, hasta);
  else {
    if (desde && alta < desde) return null;
    dias = diasEntre(desde && inicio <= desde ? desde : inicio, alta <= hasta ? alta : hasta);
  }
  return dias > 0 ? dias : null;
};

// Los minutos del GPS: [{ jugadorId, fecha, minutos }]. Los de un jugador o
// los de todos, entre dos fechas (sin una punta, sin límite de ese lado).
export const minutosGps = (registros, { jugadorId = null, desde = "", hasta = "" } = {}) =>
  (registros || []).reduce((suma, registro) => {
    if (jugadorId !== null && String(registro.jugadorId) !== String(jugadorId)) return suma;
    if (desde && registro.fecha < desde) return suma;
    if (hasta && registro.fecha > hasta) return suma;
    const minutos = Number(registro.minutos);
    return Number.isFinite(minutos) ? suma + minutos : suma;
  }, 0);

// El cuadro cada 1000 horas de un grupo de lesiones (las de un jugador o las
// del plantel) con sus minutos de GPS, como el contador por período del
// Excel: cuentan las empezadas en [desde, hasta] y los días que caen adentro.
// Sin minutos, los valores son null (en el Excel, la celda vacía).
export const cuadroCadaMil = (lesiones, minutos, { desde = "", hasta }) => {
  const horas = minutos > 0 ? minutos / 60 : 0;
  return VARIANTES.map((variante) => {
    const delCuadro = (lesiones || []).filter((lesion) => cumpleVariante(lesion, variante));
    const cantidad = delCuadro.filter((lesion) => esFechaISO(lesion.fecha_lesion) && (!desde || lesion.fecha_lesion >= desde) && lesion.fecha_lesion <= hasta).length;
    const dias = delCuadro.reduce((suma, lesion) => suma + (diasEnPeriodo(lesion, desde, hasta) || 0), 0);
    return {
      variante: variante.id,
      cantidad,
      dias,
      lesionesCadaMil: horas ? (cantidad / horas) * 1000 : null,
      diasCadaMil: horas ? (dias / horas) * 1000 : null,
    };
  });
};

// "Jugador vs VR", como en el Excel: el signo dice si el jugador está arriba
// (o igual) del VR y el porcentaje es la diferencia sobre el valor del
// jugador. Si el jugador está en cero, el Excel muestra "0 %": porcentaje 0.
// Sin alguno de los dos valores, null.
export const contraVR = (delJugador, vr) => {
  if (delJugador === null || delJugador === undefined || vr === null || vr === undefined) return null;
  if (!(delJugador > 0)) return { signo: "", porcentaje: 0 };
  return { signo: delJugador >= vr ? "+" : "-", porcentaje: Math.abs((delJugador - vr) / delJugador) * 100 };
};

// ------------------------------------------------------- Reporte grupal --

// Las que entran en el reporte grupal: empezadas en el período [desde, hasta]
// (sin una punta, sin límite de ese lado) y con los filtros "sin leves" y
// "solo LM" del Excel.
export const lesionesDelReporte = (lesiones, { desde = "", hasta = "", sinLeves = false, soloMusculares = false } = {}) =>
  (lesiones || []).filter((lesion) => {
    if (!lesion || !esFechaISO(lesion.fecha_lesion)) return false;
    if (desde && lesion.fecha_lesion < desde) return false;
    if (hasta && lesion.fecha_lesion > hasta) return false;
    if (sinLeves && esLeve(lesion)) return false;
    if (soloMusculares && !esMuscular(lesion)) return false;
    return true;
  });

// Días perdidos por una lesión: del inicio al alta (sin alta, hasta hoy).
export const diasPerdidos = (lesion, hoy) => Math.max(0, diasEntre(lesion.fecha_lesion, lesion.fecha_alta || hoy) ?? 0);

// Cuántas hay de cada valor de una columna (o de lo que diga `valor`), de
// mayor a menor: [{ valor, cantidad, dias }]. Las vacías no cuentan.
export const contarPor = (lesiones, valor, hoy) => {
  const mapa = new Map();
  lesiones.forEach((lesion) => {
    const clave = valor(lesion);
    if (clave === null || clave === undefined || clave === "") return;
    const actual = mapa.get(clave) || { valor: clave, cantidad: 0, dias: 0 };
    actual.cantidad += 1;
    actual.dias += diasPerdidos(lesion, hoy);
    mapa.set(clave, actual);
  });
  return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad || b.dias - a.dias || String(a.valor).localeCompare(String(b.valor)));
};

// Los meses del período ("2026-01"…), en orden. Con un período muy largo,
// los últimos 240 (veinte años).
export const mesesEntre = (desde, hasta) => {
  if (!esFechaISO(desde) || !esFechaISO(hasta) || desde > hasta) return [];
  const meses = [];
  let [anio, mes] = hasta.split("-").map(Number);
  const [anioInicio, mesInicio] = desde.split("-").map(Number);
  while ((anio > anioInicio || (anio === anioInicio && mes >= mesInicio)) && meses.length < 240) {
    meses.unshift(`${anio}-${String(mes).padStart(2, "0")}`);
    mes -= 1;
    if (mes < 1) {
      mes = 12;
      anio -= 1;
    }
  }
  return meses;
};

// Lesiones por mes de inicio, y por severidad dentro de cada mes:
// [{ mes, total, porSeveridad: { leve: 2, … } }]. Sin alta, "abierta".
export const porMes = (lesiones, desde, hasta) =>
  mesesEntre(desde, hasta).map((mes) => {
    const delMes = lesiones.filter((lesion) => lesion.fecha_lesion.slice(0, 7) === mes);
    const porSeveridad = {};
    delMes.forEach((lesion) => {
      const severidad = calcular("severidad", lesion) || "abierta";
      porSeveridad[severidad] = (porSeveridad[severidad] || 0) + 1;
    });
    return { mes, total: delMes.length, porSeveridad };
  });

// El resumen de un grupo de lesiones. todas: las del club, para la
// recurrencia (que mira las anteriores).
export const resumenDeLesiones = (lesiones, { hoy, todas = lesiones } = {}) => {
  const conAlta = lesiones.filter((lesion) => lesion.fecha_alta);
  return {
    cantidad: lesiones.length,
    dias: lesiones.reduce((suma, lesion) => suma + diasPerdidos(lesion, hoy), 0),
    activas: lesiones.filter((lesion) => !lesion.fecha_alta).length,
    jugadores: new Set(lesiones.map((lesion) => String(lesion.jugador_id))).size,
    promedioDias: conAlta.length ? conAlta.reduce((suma, lesion) => suma + diasPerdidos(lesion, hoy), 0) / conAlta.length : null,
    recurrentes: lesiones.filter((lesion) => calcular("recurrencia", lesion, null, { lesiones: todas, hoy }) === "sim").length,
  };
};

// El período del reporte grupal: este año, los últimos 12 meses o todo.
export const PERIODOS = ["anio", "doce", "todo"];
export const periodoDe = (cual, hoy, lesiones = []) => {
  if (cual === "anio") return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
  if (cual === "doce") {
    // El día siguiente al de hace un año (del 29/02, el 01/03).
    const [anio, mes, dia] = hoy.split("-").map(Number);
    const ultimoDelMes = new Date(Date.UTC(anio - 1, mes, 0)).getUTCDate();
    const desde = new Date(Date.UTC(anio - 1, mes - 1, Math.min(dia, ultimoDelMes) + 1)).toISOString().slice(0, 10);
    return { desde, hasta: hoy };
  }
  const primera = (lesiones || []).map((lesion) => lesion.fecha_lesion).filter(esFechaISO).sort()[0];
  return { desde: primera || `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
};
