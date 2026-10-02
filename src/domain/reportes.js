// Las cuentas de los reportes de Lesiones (individual y grupal), sin tocar
// la base: qué lesiones entran (período, sin leves, solo musculares), los días
// perdidos, la disponibilidad, los conteos por parte, tipo, mecanismo…, la
// incidencia cada 1000 horas y la comparación de un jugador con el equipo
// (en el Excel, "VR": el valor de referencia).
import { calcular, diasEntre, esFechaISO } from "./lesiones.js";

// Lo leve (como en el Excel, "SEM LEVES"): severidad registro (menos de un
// día) y leve (1 a 4 días). Una lesión sin alta no es leve todavía.
const SEVERIDADES_LEVES = ["registro", "leve"];
export const esLeve = (lesion) => SEVERIDADES_LEVES.includes(calcular("severidad", lesion));

// Lesión muscular ("LM" en el Excel): los tipos "Lesión muscular grado…" del
// catálogo, y los que agregue el club con ese nombre.
const MUSCULAR = /les(i[oó]n|[aã]o)\s+muscular/i;
export const esMuscular = (lesion, texto = () => "") => {
  const tipo = lesion?.datos?.tipo_lesion;
  if (!tipo) return false;
  return String(tipo).startsWith("muscular_") || MUSCULAR.test(texto("tipo_lesion", tipo) || "");
};

// Las que entran en el reporte: empezadas en el período [desde, hasta] (las
// dos puntas incluidas; sin una punta, sin límite de ese lado), y según los
// filtros del Excel.
export const lesionesDelReporte = (lesiones, { desde = "", hasta = "", sinLeves = false, soloMusculares = false, jugadorId = null, texto } = {}) =>
  (lesiones || []).filter((lesion) => {
    if (!lesion || !esFechaISO(lesion.fecha_lesion)) return false;
    if (jugadorId !== null && String(lesion.jugador_id) !== String(jugadorId)) return false;
    if (desde && lesion.fecha_lesion < desde) return false;
    if (hasta && lesion.fecha_lesion > hasta) return false;
    if (sinLeves && esLeve(lesion)) return false;
    if (soloMusculares && !esMuscular(lesion, texto)) return false;
    return true;
  });

// Días perdidos por una lesión: del inicio al alta (sin alta, hasta hoy).
export const diasPerdidos = (lesion, hoy) => Math.max(0, diasEntre(lesion.fecha_lesion, lesion.fecha_alta || hoy) ?? 0);

// Los días de [desde, hasta] que un jugador estuvo lesionado (sin alta: hasta
// hoy). Para la disponibilidad: los días que pudo jugar sobre los del período.
export const diasLesionadoEnPeriodo = (lesiones, desde, hasta, hoy) => {
  const dias = new Set();
  lesiones.forEach((lesion) => {
    const fin = lesion.fecha_alta || hoy;
    let dia = lesion.fecha_lesion < desde ? desde : lesion.fecha_lesion;
    const ultimo = fin > hasta ? hasta : fin;
    // Hasta el día anterior al alta: el día del alta ya está disponible.
    while (dia < ultimo) {
      dias.add(dia);
      dia = diaSiguiente(dia);
    }
  });
  return dias.size;
};

export const diaSiguiente = (iso) => {
  const [anio, mes, dia] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + 1));
  return fecha.toISOString().slice(0, 10);
};

// Cada 1000 horas: null si no hay horas.
export const cadaMilHoras = (cantidad, horas) => (horas > 0 ? (cantidad / horas) * 1000 : null);

// Cuánto más (o menos) que el equipo, en %, como en el Excel ("+50.8% Vs VR").
// null si no se puede comparar.
export const comparadoConEquipo = (delJugador, delEquipo) => {
  if (delJugador === null || delEquipo === null || delEquipo === undefined || delEquipo === 0) return null;
  return ((delJugador - delEquipo) / delEquipo) * 100;
};

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

// Los meses del período ("2026-01"…), en orden.
export const mesesEntre = (desde, hasta) => {
  if (!esFechaISO(desde) || !esFechaISO(hasta) || desde > hasta) return [];
  const meses = [];
  let [anio, mes] = desde.split("-").map(Number);
  const [anioFin, mesFin] = hasta.split("-").map(Number);
  while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
    meses.push(`${anio}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
    if (meses.length > 240) break;
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

// El resumen de un grupo de lesiones (las de un jugador o las del equipo).
// todas: las del club, para la recurrencia (que mira las anteriores).
export const resumenDeLesiones = (lesiones, { hoy, desde, hasta, todas = lesiones } = {}) => {
  const dias = lesiones.reduce((suma, lesion) => suma + diasPerdidos(lesion, hoy), 0);
  const activas = lesiones.filter((lesion) => !lesion.fecha_alta).length;
  const conAlta = lesiones.filter((lesion) => lesion.fecha_alta);
  const jugadores = new Set(lesiones.map((lesion) => String(lesion.jugador_id)));
  const recurrentes = lesiones.filter((lesion) => calcular("recurrencia", lesion, null, { lesiones: todas, hoy }) === "sim").length;
  return {
    cantidad: lesiones.length,
    dias,
    activas,
    jugadores: jugadores.size,
    promedioDias: conAlta.length ? conAlta.reduce((suma, lesion) => suma + diasPerdidos(lesion, hoy), 0) / conAlta.length : null,
    recurrentes,
    desde,
    hasta,
  };
};

// Las horas de un jugador (o del equipo) en el período, de la lista de
// exposición [{ jugadorId, fecha, segundos, tipo: "partido" | "entrenamiento" }].
export const horasEnPeriodo = (exposicion, { desde = "", hasta = "", jugadorId = null } = {}) => {
  const suma = { partido: 0, entrenamiento: 0 };
  (exposicion || []).forEach((tramo) => {
    if (jugadorId !== null && String(tramo.jugadorId) !== String(jugadorId)) return;
    if (desde && tramo.fecha < desde) return;
    if (hasta && tramo.fecha > hasta) return;
    suma[tramo.tipo] = (suma[tramo.tipo] || 0) + tramo.segundos;
  });
  const partido = suma.partido / 3600;
  const entrenamiento = suma.entrenamiento / 3600;
  return { partido, entrenamiento, total: partido + entrenamiento };
};

// La tabla de incidencia, como el cuadro del Excel: lesiones y días perdidos
// cada 1000 horas, del jugador y del equipo (las mismas condiciones), y cuánto
// más o menos es el jugador.
export const incidencia = ({ delJugador, delEquipo, horasJugador, horasEquipo, hoy }) => {
  const dias = (lista) => lista.reduce((suma, lesion) => suma + diasPerdidos(lesion, hoy), 0);
  const fila = (cantidadJugador, cantidadEquipo) => {
    const jugador = cadaMilHoras(cantidadJugador, horasJugador);
    const equipo = cadaMilHoras(cantidadEquipo, horasEquipo);
    return { jugador, equipo, diferencia: comparadoConEquipo(jugador, equipo) };
  };
  return {
    lesiones: fila(delJugador.length, delEquipo.length),
    dias: fila(dias(delJugador), dias(delEquipo)),
  };
};

// El período por defecto y los atajos: este año, los últimos 12 meses y todo.
export const PERIODOS = ["anio", "doce", "todo"];
export const periodoDe = (cual, hoy, lesiones = []) => {
  if (cual === "anio") return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
  if (cual === "doce") {
    const [anio, mes, dia] = hoy.split("-").map(Number);
    const desde = new Date(Date.UTC(anio - 1, mes - 1, dia + 1)).toISOString().slice(0, 10);
    return { desde, hasta: hoy };
  }
  const primera = (lesiones || []).map((lesion) => lesion.fecha_lesion).filter(esFechaISO).sort()[0];
  return { desde: primera || `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
};
