// Las cuentas de los reportes de Lesiones, con la lógica del Excel: el
// "Reporte de Lesiones IND" (el cuadro cada 1000 horas del jugador contra el
// VR, el valor de referencia del plantel) y el contador por período de
// "Antecedentes BD", que arma la hoja "Incidencias c 1000h". Las horas son
// las del GPS. Además, los conteos del reporte grupal.
import { calcular, claveDeQuien, diasEntre, esFechaISO, estaActiva, tieneFecha } from "./lesiones.js";

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

// ------------------------------------- Lesiones c/1000h y días perdidos --

// El contador de "Antecedentes BD" para un período: los minutos de
// entrenamiento (todos los del GPS en esas fechas, como la hoja "BD GPS"), las
// horas y el cuadro (lesiones y días perdidos, y cada 1000 horas, como
// "Incidencias c 1000h"). gps null: la app todavía no tiene los minutos, y
// minutos y horas quedan null. Sin "desde", desde la primera lesión.
export const contadorDelPeriodo = (lesiones, gps, { desde = "", hasta }) => {
  const minutos = gps ? minutosGps(gps, { desde, hasta }) : null;
  return {
    minutos,
    horas: minutos === null ? null : minutos / 60,
    filas: cuadroCadaMil(lesiones, minutos || 0, { desde, hasta }),
  };
};

// Los períodos guardados en el orden de las fechas (en el Excel, el de las
// letras A a P): por inicio (los que no tienen, primero: van desde la
// primera lesión), después por final y por nombre.
export const ordenarPeriodos = (periodos = []) =>
  [...periodos].sort(
    (a, b) =>
      String(a.desde || "").localeCompare(String(b.desde || "")) ||
      String(a.hasta || "").localeCompare(String(b.hasta || "")) ||
      String(a.nombre || "").localeCompare(String(b.nombre || "")),
  );

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
// mayor a menor: [{ valor, cantidad, dias }]. Las vacías no cuentan, ni las
// lesiones sin fecha de inicio (casos sin terminar).
export const contarPor = (lesiones, valor, hoy) => {
  const mapa = new Map();
  lesiones.forEach((lesion) => {
    if (!tieneFecha(lesion)) return;
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
    const delMes = lesiones.filter((lesion) => String(lesion.fecha_lesion || "").slice(0, 7) === mes);
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
    activas: lesiones.filter(estaActiva).length,
    // Los jugadores y las personas fuera de Datos básicos, cada uno una vez.
    jugadores: new Set(lesiones.map(claveDeQuien).filter(Boolean)).size,
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

// ---------------------------------------------------- Informes gráficos --

// Los gráficos del plantel de la hoja "Informes Graficos" del Excel. Qué
// cuenta cada uno, junto y con nombre para mudarlo a la configuración del
// club (regla del 02/10):
//   · Bloques 1 y 2 (lesiones y días perdidos c/1000 h por período guardado):
//     el año de cada período, para el filtro AÑO (en el Excel era fijo por la
//     letra del período; acá, el de esta fecha del período).
//   · Bloques 3 a 5: "Cuenta de Tipo de lesão" (cuentan las que tienen este
//     campo cargado).
//   · Bloque 3: una torta por cada valor de "campo", con una porción por
//     "porcion"; bloque 4: una fila por persona, apilada por "series";
//     bloque 5: una columna por "categoria" (los valores de "valores", o
//     todos los cargados si es null), agrupadas por "series".
//   · filtros: las segmentaciones del Excel de cada bloque.
//   · vaciaCuenta: si la porción o serie vacía (sin parte del cuerpo) cuenta
//     como "Sin dato" (tortas y momentos) o no cuenta (por jugador), como
//     cada tabla del Excel.
export const REGLAS_GRAFICOS = Object.freeze({
  anioDelPeriodo: "hasta",
  campoContado: "tipo_lesion",
  tortas: Object.freeze({ campo: "producto", valores: Object.freeze(["nao_traumatica", "traumatica"]), porcion: "parte_cuerpo", vaciaCuenta: true }),
  porJugador: Object.freeze({ series: "parte_cuerpo", vaciaCuenta: false }),
  momentos: Object.freeze({ categoria: "cuando", valores: null, series: "parte_cuerpo", vaciaCuenta: true }),
  filtros: Object.freeze({
    tortas: Object.freeze(["parte_cuerpo", "musculo", "musculo_especifico", "ligamento", "area", "lado", "tipo_lesion", "posicion"]),
    porJugador: Object.freeze(["jugador", "tipo_lesion", "producto"]),
    momentos: Object.freeze(["cuando", "parte_cuerpo"]),
  }),
});

const vacio = (valor) => valor === null || valor === undefined || valor === "";

// ---- Bloques 1 y 2

export const anioDelPeriodo = (periodo) => Number(String(periodo?.[REGLAS_GRAFICOS.anioDelPeriodo] || "").slice(0, 4)) || null;
export const aniosDePeriodos = (periodos = []) => [...new Set((periodos || []).map(anioDelPeriodo).filter(Boolean))].sort((a, b) => a - b);

// Cada período guardado (los de un año, o todos) con su contador:
// [{ periodo, anio, minutos, horas, filas }] (filas: las cuatro variantes).
export const graficosPorPeriodo = (lesiones, gps, periodos, { anio = null } = {}) =>
  ordenarPeriodos(periodos || [])
    .filter((periodo) => anio === null || anioDelPeriodo(periodo) === anio)
    .map((periodo) => ({ periodo, anio: anioDelPeriodo(periodo), ...contadorDelPeriodo(lesiones, gps, periodo) }));

// Una columna por período para una variante: medida "lesiones" o "dias".
// valor: cada 1000 horas (null sin minutos); detalle: las lesiones o los días.
export const serieCadaMil = (porPeriodo, varianteId, medida) =>
  porPeriodo.map(({ periodo, filas }) => {
    const fila = filas.find((una) => una.variante === varianteId);
    return {
      clave: periodo.id ?? periodo.nombre,
      etiqueta: periodo.nombre,
      valor: medida === "dias" ? fila.diasCadaMil : fila.lesionesCadaMil,
      detalle: medida === "dias" ? fila.dias : fila.cantidad,
    };
  });

// ---- Bloques 3 a 5

// Lo que vale una lesión para un filtro o un gráfico: la posición sale del
// plantel (en el Excel, de Datos Básicos; fuera de ahí, vacía), el jugador es
// quién es (claveDeQuien) y lo demás, lo cargado.
export const valorParaGrafico = (lesion, campo, posicionDe = () => null) => {
  if (campo === "posicion") return posicionDe(lesion) ?? "";
  if (campo === "jugador") return claveDeQuien(lesion) ?? "";
  return lesion?.datos?.[campo] ?? "";
};

// Lo elegido en un filtro: varios valores, como las segmentaciones del Excel
// (también vale uno solo); sin ninguno, todos.
export const elegidosDelFiltro = (valor) => (Array.isArray(valor) ? valor : [valor]).filter((uno) => !vacio(uno));

// Las que entran en los bloques 3 a 5: con fecha de inicio (las sin fecha
// nunca), con el campo contado y con lo elegido en los filtros
// ({ campo: [valores] }; vacío = todos).
export const lesionesDeLosGraficos = (lesiones, { filtros = {}, posicionDe } = {}) =>
  (lesiones || []).filter(
    (lesion) =>
      tieneFecha(lesion) &&
      !vacio(lesion.datos?.[REGLAS_GRAFICOS.campoContado]) &&
      Object.entries(filtros).every(([campo, valor]) => {
        const elegidos = elegidosDelFiltro(valor);
        return !elegidos.length || elegidos.includes(valorParaGrafico(lesion, campo, posicionDe));
      }),
  );

// Los valores que hay para un filtro (sin los otros filtros): distintos y no vacíos.
export const opcionesDeFiltro = (lesiones, campo, posicionDe) => [
  ...new Set(lesionesDeLosGraficos(lesiones, { posicionDe }).map((lesion) => valorParaGrafico(lesion, campo, posicionDe)).filter((valor) => !vacio(valor))),
];

// Para la lista de un filtro: cuántas lesiones hay de cada valor con los otros
// filtros del bloque (como el filtro de una columna en Excel). { valor: n }.
export const cuantasPorValor = (lesiones, campo, { filtros = {}, posicionDe } = {}) => {
  const otros = Object.fromEntries(Object.entries(filtros).filter(([otro]) => otro !== campo));
  const cuenta = {};
  lesionesDeLosGraficos(lesiones, { filtros: otros, posicionDe }).forEach((lesion) => {
    const valor = valorParaGrafico(lesion, campo, posicionDe);
    if (!vacio(valor)) cuenta[valor] = (cuenta[valor] || 0) + 1;
  });
  return cuenta;
};

// Cuántas de cada valor de un campo: { valor: n } (la vacía como "", si cuenta).
const contarSeries = (lista, campo, vaciaCuenta) => {
  const cuenta = {};
  lista.forEach((lesion) => {
    const valor = lesion.datos?.[campo] ?? "";
    if (vacio(valor) && !vaciaCuenta) return;
    cuenta[valor] = (cuenta[valor] || 0) + 1;
  });
  return cuenta;
};

// Bloque 3: la torta de un valor (No traumática, Traumática):
// [{ valor: parte, cantidad, porcentaje }] (sobre el total de esa torta).
export const tortaPorParte = (lesiones, valorDeLaTorta, opciones = {}) => {
  const { campo, porcion, vaciaCuenta } = REGLAS_GRAFICOS.tortas;
  const cuenta = contarSeries(
    lesionesDeLosGraficos(lesiones, opciones).filter((lesion) => lesion.datos?.[campo] === valorDeLaTorta),
    porcion,
    vaciaCuenta,
  );
  const total = Object.values(cuenta).reduce((suma, n) => suma + n, 0);
  return Object.entries(cuenta).map(([valor, cantidad]) => ({ valor, cantidad, porcentaje: (cantidad / total) * 100 }));
};

// Bloque 4: [{ valor: quién (claveDeQuien), total, porSerie: { parte: n } }].
// Sin quién o sin parte (según la regla), no cuenta.
export const lesionesPorJugador = (lesiones, opciones = {}) => {
  const { series, vaciaCuenta } = REGLAS_GRAFICOS.porJugador;
  const porQuien = new Map();
  lesionesDeLosGraficos(lesiones, opciones).forEach((lesion) => {
    const quien = claveDeQuien(lesion);
    if (!quien) return;
    if (!porQuien.has(quien)) porQuien.set(quien, []);
    porQuien.get(quien).push(lesion);
  });
  return [...porQuien.entries()]
    .map(([valor, lista]) => {
      const porSerie = contarSeries(lista, series, vaciaCuenta);
      return { valor, total: Object.values(porSerie).reduce((suma, n) => suma + n, 0), porSerie };
    })
    .filter((fila) => fila.total > 0);
};

// Bloque 5: las que cuentan (con el campo de la categoría cargado y, si la
// regla los nombra, solo esos valores), del año de su fecha de inicio.
const deLosMomentos = (lesiones, { anio = null, ...opciones } = {}) => {
  const { categoria, valores } = REGLAS_GRAFICOS.momentos;
  return lesionesDeLosGraficos(lesiones, opciones).filter((lesion) => {
    const valor = lesion.datos?.[categoria];
    if (vacio(valor) || (valores && !valores.includes(valor))) return false;
    return anio === null || Number(lesion.fecha_lesion.slice(0, 4)) === anio;
  });
};
export const aniosDeMomentos = (lesiones, opciones = {}) =>
  [...new Set(deLosMomentos(lesiones, { ...opciones, anio: null }).map((lesion) => Number(lesion.fecha_lesion.slice(0, 4))))].sort((a, b) => a - b);
// [{ valor: cuándo, total, porSerie: { parte: n } }].
export const momentosPorParte = (lesiones, opciones = {}) => {
  const { categoria, series, vaciaCuenta } = REGLAS_GRAFICOS.momentos;
  const porCategoria = new Map();
  deLosMomentos(lesiones, opciones).forEach((lesion) => {
    const valor = lesion.datos[categoria];
    if (!porCategoria.has(valor)) porCategoria.set(valor, []);
    porCategoria.get(valor).push(lesion);
  });
  return [...porCategoria.entries()].map(([valor, lista]) => {
    const porSerie = contarSeries(lista, series, vaciaCuenta);
    return { valor, total: Object.values(porSerie).reduce((suma, n) => suma + n, 0), porSerie };
  });
};

// El orden de las categorías y las series: alfabético por cómo se lee en el
// idioma (sin importar acentos), y "" (Sin dato) al final. En portugués da
// el orden del Excel.
export const ordenarPorEtiqueta = (filas, etiquetaDe, idioma) => {
  const comparar = new Intl.Collator(idioma, { sensitivity: "base" }).compare;
  return [...filas].sort(
    (a, b) => Number(vacio(a.valor)) - Number(vacio(b.valor)) || comparar(etiquetaDe(a.valor), etiquetaDe(b.valor)) || String(a.valor).localeCompare(String(b.valor)),
  );
};

// El nombre de cada quien (claveDeQuien) de unas lesiones: el del plantel o,
// fuera de Datos básicos, el suyo. Map(clave → nombre).
export const nombresDeQuien = (lesiones, plantel = []) =>
  new Map(
    (lesiones || [])
      .filter((lesion) => claveDeQuien(lesion))
      .map((lesion) => [claveDeQuien(lesion), (plantel || []).find((uno) => String(uno.id) === String(lesion.jugador_id))?.nombre || lesion.persona || "—"]),
  );
