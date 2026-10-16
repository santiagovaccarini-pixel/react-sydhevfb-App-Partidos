import { esNumero } from "./valores.js";
import { CATEGORIAS_DE_UN_VR } from "./informe.js";
import { COLORES_SUAVES } from "../colores.js";

// GPS › Reportes › Por microciclo: la parte «Por microciclo» de la hoja
// «INFORME GPS» del Excel (filas 7 a 69), con la tabla dinámica que la arma
// (hoja TD, «Tabla dinámica1») y las hojas que la acompañan (Micro_Sesión y
// TD2). Santiago, 15/10: «cada una tiene que replicar exactamente lo que
// hace la logica de cada una»; lo que decidió ese día está en
// docs/PENDIENTES.md («Informe: Por microciclo, Por tarea y Por jugador»).
//
// Una fila del informe por cada «Nombre1» de lo filtrado (como la tabla
// dinámica): el promedio del equipo de cada microciclo («Team Average
// Sesion17») o cada jugador. Entran las filas con Condición Total y Va
// vacío, No o Si (la tabla dinámica deja afuera, por ejemplo, Readaptación).
// En cada fila:
//   · N° de sesiones: los días (fecha y clasificación de días) de las filas
//     de esa fila del informe, también los de descanso; N° de descansos: los
//     de Tipo de Sesión «Descanso» (Santiago, 15/10: «Los descansos si
//     cuentan como sesion y los n de descansos se cuentan a partir de que en
//     tipo de sesion siga descanso»; el Excel contaba los de Tipo de Sesión
//     vacío y daba siempre 0).
//   · U.A. suma y promedio.
//   · Carga crónica: la U.A. ÷ el promedio de la U.A. de esa fila y las 3 de
//     arriba, tal como se ven (las 4 del promedio del equipo; Santiago,
//     15/10: «A», como el Excel). Las 3 primeras, vacías. La de un jugador,
//     la de su último microciclo elegido (15/10, «3. B»; ver
//     cargaCronicaDeJugador).
//   · Las medidas: suma y promedio de cada una; las por minuto, el promedio
//     de la medida ÷ el promedio de los minutos (sin minutos, 0, como el
//     Excel); los %, cada una ÷ su V.R.
//   · Índices: Promedio % Vol. = (Total + 4 Alta + 4 Máxima) ÷ 9 y Promedio
//     % Relat., lo mismo con las por minuto. Alta intensidad, el promedio
//     de los % de D_SHI, D_AccHI, D_DecHI y D_MPHI; Máxima, el de D_S6,
//     D_A8, D_A1 y D_MP5. Si falta uno de los cuatro, vacío (en el Excel, un
//     vacío hace fallar el promedio).
// El V.R. de cada fila es el elegido para su dispositivo (Santiago, 15/10:
// «4. B»); sin V.R., los % quedan vacíos. Un jugador con microciclos de dos
// dispositivos, el de su último microciclo (16/10, como el archivo: a los
// jugadores les pone el V.R. de los microciclos del 17 en adelante, el del
// dispositivo de ahora).

// Las columnas de las variables (S a AC del Excel), según «Tipo variable».
// La décima, «>30km/h», es Mts >= 90% Pico (Santiago, 15/10: «2. B»).
// «Extras» no va (15/10: «por ahora lo sacas»).
export const ABSOLUTAS = Object.freeze(["d", "d_shi", "d_acchi", "d_dechi", "d_mphi", "d_s6", "d_a8", "d_a1", "d_mp5", "mts90", "tiempo"]);
export const RELATIVAS = Object.freeze(["d_min", "d_shi_min", "d_acchi_min", "d_dechi_min", "d_mphi_min", "d_s6_min", "d_a8_min", "d_a1_min", "d_mp5_min", "mts90_min", "tiempo"]);
export const TIPOS_DE_VARIABLE = Object.freeze({ absolutas: ABSOLUTAS, relativas: RELATIVAS });

// «Visualización», en el orden del Excel.
export const VISUALIZACIONES = Object.freeze(["promedio", "suma", "porcentajePromedio", "porcentajeSuma"]);
// Con Relativas no hay suma (Santiago, 16/10: «si se filtra por relativo no
// puede haber en el filtro Suma y % Suma»).
export const visualizacionesDe = (tipoVariable) => (tipoVariable === "relativas" ? VISUALIZACIONES.filter((una) => una !== "suma" && una !== "porcentajeSuma") : VISUALIZACIONES);
// La que corresponde al pasar a Relativas: la suma pasa a promedio.
export const visualizacionPara = (tipoVariable, visualizacion) =>
  visualizacionesDe(tipoVariable).includes(visualizacion) ? visualizacion : visualizacion === "porcentajeSuma" ? "porcentajePromedio" : "promedio";
// «Categorización» (la forma de analizar).
export const CATEGORIZACIONES = Object.freeze(["miSeleccion", "valorReferencial", "objetivo"]);

// Los filtros de «Por microciclo» (las segmentaciones de la hoja FILTROS).
export const FILTROS_POR_MICROCICLO = Object.freeze(["microciclo", "fecha", "tipo_sesion", "tipo_microciclo", "clasificacion_dias", "microciclo_jugador", "nombre"]);

// Las medidas con su por minuto; Drel es el de D.
const MEDIDAS = Object.freeze(["d", "d_shi", "d_acchi", "d_dechi", "d_mphi", "d_s6", "d_a8", "d_a1", "d_mp5", "mts90"]);
const ALTA = Object.freeze(["d_shi", "d_acchi", "d_dechi", "d_mphi"]);
const MAXIMA = Object.freeze(["d_s6", "d_a8", "d_a1", "d_mp5"]);
const conMin = (clave) => `${clave}_min`;

// --------------------------------------------------------- Qué entra --
// La tabla dinámica del Excel: Condición Total y Va vacío, No o Si.
export const entraEnElInforme = (fila) => fila?.datos?.condicion === "total" && ["", "si", "no"].includes(String(fila?.datos?.va ?? ""));

// El valor de una fila para un filtro (el que se elige en su desplegable).
// «Microciclo/Jugador»: Sesión para el promedio del equipo, Jugador para el
// resto. «Nombre»: el promedio del equipo (parcial o sesión) o la persona.
export const valorDeFiltro = (fila, filtro) => {
  const datos = fila?.datos || {};
  if (filtro === "fecha") return fila?.fecha || "";
  if (filtro === "microciclo_jugador") return fila?.promedio ? "sesion" : "jugador";
  if (filtro === "nombre") return claveDeNombre(fila);
  const valor = datos[filtro];
  return valor === null || valor === undefined ? "" : valor;
};

export const claveDeNombre = (fila) => {
  if (fila?.promedio) return `promedio:${fila.promedio}`;
  if (fila?.jugador_id !== null && fila?.jugador_id !== undefined) return `jugador:${fila.jugador_id}`;
  return `persona:${String(fila?.persona || "").trim()}`;
};

// Las opciones de un filtro: solo las que tienen datos (15/10, D2), sin
// repetir, en orden (los números de menor a mayor; lo demás, como texto).
export const opcionesDeFiltro = (filas, filtro) => {
  const vistos = new Set();
  filas.forEach((fila) => {
    if (entraEnElInforme(fila)) vistos.add(valorDeFiltro(fila, filtro));
  });
  return [...vistos].sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "es", { numeric: true })));
};

// filtros: { filtro: [valores elegidos] }; sin nada elegido, todos.
export const pasaLosFiltros = (fila, filtros = {}) =>
  FILTROS_POR_MICROCICLO.every((filtro) => {
    const elegidos = filtros[filtro];
    if (!elegidos || !elegidos.length) return true;
    const valor = valorDeFiltro(fila, filtro);
    return elegidos.some((elegido) => elegido === valor || String(elegido) === String(valor));
  });

// ------------------------------------------------------------- Cuentas --
const suma = (numeros) => {
  let total = 0;
  for (const x of numeros) total += x;
  return total;
};
const promedio = (numeros) => (numeros.length ? suma(numeros) / numeros.length : null);
// El desvío de la muestra (DESVEST): con menos de dos números no hay.
export const desvio = (numeros) => {
  if (numeros.length < 2) return null;
  const media = promedio(numeros);
  let total = 0;
  for (const x of numeros) total += (x - media) ** 2;
  return Math.sqrt(total / (numeros.length - 1));
};
const numerosDe = (filas, clave) => filas.map((fila) => fila.datos?.[clave]).filter(esNumero);
const dividir = (a, b) => (esNumero(a) && esNumero(b) && b !== 0 ? a / b : null);
// El promedio de unos % que el Excel arma con valores sueltos: con uno
// vacío, vacío.
const promedioDeTodos = (valores) => (valores.length && valores.every(esNumero) ? promedio(valores) : null);

// Las cuentas de un grupo de filas (una fila del informe): suma y promedio
// de cada medida, de la U.A. y del tiempo; los minutos (el promedio del
// tiempo); cada por minuto y Drel (el promedio ÷ los minutos; sin minutos,
// 0, como el IFERROR(…;0) del Excel; sin promedio, vacío).
export const cuentasDeGrupo = (filas) => {
  const sumas = {};
  const promedios = {};
  [...MEDIDAS, "tiempo", "ua"].forEach((clave) => {
    const numeros = numerosDe(filas, clave);
    sumas[clave] = numeros.length ? suma(numeros) : null;
    promedios[clave] = promedio(numeros);
  });
  // Los minutos, como el Excel (DIA, HORA, MINUTO y SEGUNDO del promedio del
  // tiempo): al segundo más cercano.
  const minutos = esNumero(promedios.tiempo) ? Math.round(promedios.tiempo) / 60 : null;
  const porMinutoDe = (clave) => {
    if (!esNumero(promedios[clave])) return null;
    return esNumero(minutos) && minutos !== 0 ? promedios[clave] / minutos : 0;
  };
  MEDIDAS.forEach((clave) => {
    promedios[conMin(clave)] = porMinutoDe(clave);
  });
  return { sumas, promedios, minutos };
};

// ---------------------------------------------------------------- V.R. --
// El V.R. de una fila: el primero de los elegidos que es para su
// microciclo (los que se sumaron con «+», para unos microciclos) o, si no,
// el elegido para su dispositivo. asignaciones: [{ referencia,
// microciclos: [números] | null }] (null: todos los de su dispositivo).
export const referenciaDeFila = (asignaciones = [], { microciclo, dispositivo }) => {
  const porMicrociclo = asignaciones.find((una) => Array.isArray(una.microciclos) && una.microciclos.some((m) => Number(m) === Number(microciclo)));
  if (porMicrociclo) return porMicrociclo;
  return asignaciones.find((una) => !Array.isArray(una.microciclos) && una.referencia?.dispositivo === dispositivo) || null;
};

// --------------------------------------------------------- Las filas --
// El «Nombre1» de una fila del GPS: el promedio del equipo con su
// microciclo, o la persona.
const grupoDe = (fila) => (fila.promedio ? `${claveDeNombre(fila)}|${fila.datos?.microciclo ?? ""}` : claveDeNombre(fila));

// El dispositivo de un grupo: el de sus filas (el primero que aparece).
const dispositivoDe = (filas) => filas.find((fila) => fila.datos?.dispositivo)?.datos?.dispositivo || "";
// El de un jugador: el de su último microciclo (si ahí no hay, el de todas).
const dispositivoDelUltimo = (filas) => {
  const microciclos = filas.map((fila) => fila.datos?.microciclo).filter(esNumero);
  const ultimo = microciclos.length ? Math.max(...microciclos) : null;
  return dispositivoDe(filas.filter((fila) => fila.datos?.microciclo === ultimo)) || dispositivoDe(filas);
};

// Los días de un grupo: fecha y clasificación de días (las filas del
// promedio del equipo de ese microciclo, sin mirar la Condición, como la hoja
// Micro_Sesión). Los de descanso: Tipo de Sesión «Descanso».
export const TIPO_DESCANSO = "descanso";
const diasDe = (filas, soloDescanso) => {
  const dias = new Set();
  filas.forEach((fila) => {
    if (soloDescanso && fila.datos?.tipo_sesion !== TIPO_DESCANSO) return;
    dias.add(`${fila.fecha || ""}|${fila.datos?.clasificacion_dias ?? ""}`);
  });
  return dias.size;
};

// filas: las del GPS (las del club); filtros: { filtro: [valores] }.
// Devuelve las filas del informe en el orden del Excel: { clave, promedio
// (parcial o sesion, si es del equipo), microciclo (si es del equipo),
// jugador_id, persona, dispositivo, sesiones, descansos, sumas, promedios,
// minutos, filas }.
export const filasPorMicrociclo = (filas, filtros = {}) => {
  const grupos = new Map();
  const deTodas = new Map();
  filas.forEach((fila) => {
    if (!pasaLosFiltros(fila, filtros)) return;
    const clave = grupoDe(fila);
    // Los días salen de todas las filas filtradas (también Condición Parcial).
    if (!deTodas.has(clave)) deTodas.set(clave, []);
    deTodas.get(clave).push(fila);
    if (!entraEnElInforme(fila)) return;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(fila);
  });
  const lista = [...grupos.entries()].map(([clave, suyas]) => {
    const primera = suyas[0];
    const cuentas = cuentasDeGrupo(suyas);
    const delDia = deTodas.get(clave) || suyas;
    return {
      clave,
      promedio: primera.promedio || null,
      microciclo: primera.promedio ? (primera.datos?.microciclo ?? null) : null,
      jugador_id: primera.promedio ? null : (primera.jugador_id ?? null),
      persona: primera.promedio ? null : primera.persona || null,
      dispositivo: primera.promedio ? dispositivoDe(suyas) : dispositivoDelUltimo(suyas),
      microciclos: [...new Set(suyas.map((fila) => fila.datos?.microciclo).filter((m) => m !== null && m !== undefined))].sort((a, b) => a - b),
      sesiones: diasDe(delDia, false),
      descansos: diasDe(delDia, true),
      ...cuentas,
      filas: suyas,
    };
  });
  return lista;
};

// El orden de la tabla dinámica: por «Nombre1», como texto (el promedio
// del equipo con su microciclo, «Team Average Sesion17»; los jugadores, por
// su nombre). nombreDe(fila del informe) → el nombre que se ve.
export const ordenarFilas = (lista, nombreDe) =>
  [...lista].sort((a, b) => etiquetaDe(a, nombreDe).localeCompare(etiquetaDe(b, nombreDe), "es", { sensitivity: "base", numeric: true }));

export const etiquetaDe = (fila, nombreDe) => (fila.promedio ? `${nombreDe(fila)}${fila.microciclo ?? ""}` : nombreDe(fila));

// ------------------------------------------------------ Los valores --
// Los % de una fila contra su V.R. (promedio): el de la suma y el del
// promedio de cada medida y del tiempo, y el de cada por minuto (Drel, el
// de D).
export const porcentajesDeFila = (fila, vr) => {
  const valores = vr?.promedio || {};
  const sumas = {};
  const promedios = {};
  [...MEDIDAS, "tiempo"].forEach((clave) => {
    sumas[clave] = dividir(fila.sumas[clave], valores[clave]);
    promedios[clave] = dividir(fila.promedios[clave], valores[clave]);
  });
  MEDIDAS.forEach((clave) => {
    promedios[conMin(clave)] = dividir(fila.promedios[conMin(clave)], valores[conMin(clave)]);
  });
  return { sumas, promedios };
};

// Los índices (K a R del Excel) con los % del promedio.
export const indicesDe = (porcentajes) => {
  const total = porcentajes.d ?? null;
  const totalRel = porcentajes.d_min ?? null;
  const alta = promedioDeTodos(ALTA.map((clave) => porcentajes[clave] ?? null));
  const altaRel = promedioDeTodos(ALTA.map((clave) => porcentajes[conMin(clave)] ?? null));
  const maxima = promedioDeTodos(MAXIMA.map((clave) => porcentajes[clave] ?? null));
  const maximaRel = promedioDeTodos(MAXIMA.map((clave) => porcentajes[conMin(clave)] ?? null));
  const ponderado = (a, b, c) => ([a, b, c].every(esNumero) ? (a + 4 * b + 4 * c) / 9 : null);
  return {
    volumen: ponderado(total, alta, maxima),
    relativo: ponderado(totalRel, altaRel, maximaRel),
    total,
    totalRel,
    alta,
    altaRel,
    maxima,
    maximaRel,
  };
};

// El valor de una variable (S a AC) según «Tipo variable» y
// «Visualización». Relativas no tiene suma (vacío, como el Excel). El
// tiempo de Relativas es el promedio del tiempo.
export const valorDeVariable = (fila, porcentajes, clave, tipoVariable, visualizacion) => {
  const relativa = tipoVariable === "relativas";
  if (relativa && (visualizacion === "suma" || visualizacion === "porcentajeSuma")) return null;
  if (visualizacion === "suma") return fila.sumas[clave] ?? null;
  if (visualizacion === "promedio") return fila.promedios[clave] ?? null;
  if (visualizacion === "porcentajeSuma") return porcentajes.sumas[clave] ?? null;
  if (visualizacion === "porcentajePromedio") return porcentajes.promedios[clave] ?? null;
  return null;
};

// ------------------------------------------------ La carga crónica --
// La U.A. (suma y promedio) ÷ el promedio de la de esa fila y las 3 de
// arriba, cuando las 4 son del promedio del equipo (como se ven). El
// promedio salta las vacías (PROMEDIO del Excel). Las 3 primeras y las de
// los jugadores, vacías.
export const cargasCronicas = (lista) =>
  lista.map((fila, i) => {
    if (!fila.promedio || i < 3) return { suma: null, promedio: null };
    const cuatro = lista.slice(i - 3, i + 1);
    if (!cuatro.every((una) => una.promedio)) return { suma: null, promedio: null };
    const de = (clave) => dividir(fila[clave].ua, promedio(cuatro.map((una) => una[clave].ua).filter(esNumero)));
    return { suma: de("sumas"), promedio: de("promedios") };
  });

// La carga crónica de un jugador (Santiago, 15/10, «3. B»: «la carga crónica
// del último microciclo que elegiste»), como la tabla de carga de cada
// jugador del archivo: la U.A. de ese microciclo (la suma o la media de sus
// filas) ÷ el promedio de la de ese y los 3 microciclos anteriores que hay
// en la base. Vacía si le falta alguno de los cuatro o si no hay 3
// anteriores (en el archivo, los microciclos 10, 11 y 12). La tabla no mira
// los filtros, como la del archivo.
export const indiceDeCargas = (filasGps) => {
  const porPersona = new Map();
  const microciclos = new Set();
  filasGps.forEach((fila) => {
    const microciclo = fila?.datos?.microciclo;
    if (fila?.promedio || !esNumero(microciclo)) return;
    microciclos.add(microciclo);
    const clave = claveDeNombre(fila);
    if (!porPersona.has(clave)) porPersona.set(clave, new Map());
    const suyas = porPersona.get(clave);
    if (!suyas.has(microciclo)) suyas.set(microciclo, []);
    if (esNumero(fila.datos.ua)) suyas.get(microciclo).push(fila.datos.ua);
  });
  return { porPersona, microciclos: [...microciclos].sort((a, b) => a - b) };
};

export const cargaCronicaDeJugador = ({ porPersona, microciclos }, clave, microciclo) => {
  const vacia = { suma: null, promedio: null };
  const i = microciclos.indexOf(microciclo);
  const suyas = porPersona.get(clave);
  if (i < 3 || !suyas) return vacia;
  const cuatro = microciclos.slice(i - 3, i + 1).map((uno) => suyas.get(uno) || []);
  if (cuatro.some((uas) => !uas.length)) return vacia;
  const sumas = cuatro.map((uas) => suma(uas));
  const medias = cuatro.map((uas) => promedio(uas));
  return { suma: dividir(sumas[3], promedio(sumas)), promedio: dividir(medias[3], promedio(medias)) };
};

// --------------------------------------------------- Las franjas --
// Las cinco franjas de una medida con su promedio y su desvío: Excelente =
// promedio + 2 desvíos … Malo = promedio − 2 desvíos (al revés en la U.A. y
// la carga crónica: lo bajo es Excelente).
export const franjasDe = (media, desv, { alReves = false } = {}) => {
  if (!esNumero(media) || !esNumero(desv)) return null;
  const k = alReves ? -1 : 1;
  return { excelente: media + 2 * k * desv, muyBueno: media + k * desv, bueno: media, regular: media - k * desv, malo: media - 2 * k * desv, desvio: desv };
};

// Las franjas de un V.R. para una clave (en su unidad): las cinco
// categorías si las tiene (los V.R. por jugador; Santiago, 15/10: «en el
// caso de jugador ya tiene las 5 categorias entonces no se usa desvio»); si
// no, el promedio ± el desvío (el Bueno es su promedio).
export const franjasDelVr = (vr, clave) => {
  const bueno = vr?.promedio?.[clave];
  if (!esNumero(bueno)) return null;
  const categorias = vr?.categorias || {};
  if (CATEGORIAS_DE_UN_VR.every((categoria) => esNumero(categorias[categoria]?.[clave]))) {
    return {
      excelente: categorias.excelente[clave],
      muyBueno: categorias.muy_bueno[clave],
      bueno,
      regular: categorias.regular[clave],
      malo: categorias.malo[clave],
      desvio: esNumero(vr?.desvio?.[clave]) ? vr.desvio[clave] : null,
    };
  }
  return franjasDe(bueno, vr?.desvio?.[clave]);
};

// Las franjas divididas por el V.R. (para los %).
export const franjasEnPorcentaje = (franjas, vr) => {
  if (!franjas || !esNumero(vr) || vr === 0) return null;
  const en = (valor) => (esNumero(valor) ? valor / vr : null);
  return { excelente: en(franjas.excelente), muyBueno: en(franjas.muyBueno), bueno: en(franjas.bueno), regular: en(franjas.regular), malo: en(franjas.malo), desvio: en(franjas.desvio) };
};

// Las franjas de los índices: el de cada franja, con la misma cuenta que las
// filas (con promedio ± desvío da lo mismo que el Excel: promedio de los
// índices ± desvío de los índices).
export const franjasDeIndices = (porClave) => {
  const NOMBRES = ["excelente", "muyBueno", "bueno", "regular", "malo", "desvio"];
  const resultado = {};
  NOMBRES.forEach((nombre) => {
    const porcentajes = Object.fromEntries(Object.entries(porClave).map(([clave, franjas]) => [clave, franjas?.[nombre] ?? null]));
    const indices = indicesDe(porcentajes);
    Object.entries(indices).forEach(([indice, valor]) => {
      resultado[indice] = resultado[indice] || {};
      resultado[indice][nombre] = valor;
    });
  });
  return resultado;
};

// --------------------------------------------- Las franjas del informe --
// «Mi selección»: el promedio y el desvío de las filas, de todas las que se
// ven (16/10: ver franjasDeTodo; hasta entonces los índices y las variables
// salían de las filas de cada V.R., como las dos tablas del Excel para los
// microciclos 10 a 16 y los demás). Cada fila cuenta una vez (Santiago,
// 15/10: «2. B»; el Excel contaba cada microciclo dos veces en el desvío de
// los índices y las variables).
const franjasDeFilas = (filas, valorDe, alReves = false) => {
  const numeros = filas.map(valorDe).filter(esNumero);
  return franjasDe(promedio(numeros), desvio(numeros), { alReves });
};

// «Objetivo sesión/microciclo» (Santiago, 15/10, «6»: como el archivo). El
// archivo lo explica así: «la media es tomada desde el Average Sesión y el
// Desvío Estándar se calcula solo con los jugadores». En cada sesión (fecha
// y microciclo): el valor del promedio del equipo de la sesión y el desvío
// de los jugadores (Condición Total; Va vacío, No o Si). El Bueno es el
// promedio de las sesiones y el desvío, el promedio de sus desvíos (con
// «Valor suma», las sumas). Las sesiones salen de los filtros, menos Nombre y
// Microciclo/Jugador (el archivo fija el promedio del equipo y los
// jugadores). Una sesión con menos de dos jugadores no tiene desvío y no
// cuenta en él (en el archivo, daría error). En un por minuto, el Bueno es el
// promedio de la medida ÷ el promedio de los minutos de las sesiones (cada
// una al segundo), como hace el archivo (y como en Mi selección). Comprobado
// con los datos del club: el promedio de cada sesión da igual en las 150 y el
// desvío, en 148 (las otras dos el archivo las tenía sin actualizar).
export const sesionesDelObjetivo = (filasGps, filtros = {}) => {
  const sinQuien = { ...filtros, nombre: [], microciclo_jugador: [] };
  const sesiones = new Map();
  filasGps.forEach((fila) => {
    if (!entraEnElInforme(fila) || !pasaLosFiltros(fila, sinQuien)) return;
    if (fila.promedio && fila.promedio !== "sesion") return;
    const clave = `${fila.datos?.microciclo ?? ""}|${fila.fecha || ""}`;
    if (!sesiones.has(clave)) sesiones.set(clave, { microciclo: fila.datos?.microciclo ?? null, fecha: fila.fecha || "", equipo: [], jugadores: [] });
    const sesion = sesiones.get(clave);
    (fila.promedio ? sesion.equipo : sesion.jugadores).push(fila);
  });
  return [...sesiones.values()].filter((sesion) => sesion.equipo.length).map((sesion) => ({ ...sesion, dispositivo: dispositivoDe(sesion.equipo) }));
};

// Las franjas del objetivo de una clave, en su unidad (tipo: "promedio" o
// "suma").
export const franjasDelObjetivo = (sesiones, clave, tipo = "promedio") => {
  const delEquipo = (una) => sesiones.map((sesion) => promedio(numerosDe(sesion.equipo, una))).filter(esNumero);
  const desvios = sesiones.map((sesion) => desvio(numerosDe(sesion.jugadores, clave))).filter(esNumero);
  const medida = MEDIDAS.find((una) => conMin(una) === clave);
  if (medida && tipo === "promedio") {
    const minutos = promedio(delEquipo("tiempo").map((segundos) => Math.round(segundos) / 60));
    return franjasDe(dividir(promedio(delEquipo(medida)), minutos), promedio(desvios));
  }
  const juntar = tipo === "suma" ? (numeros) => (numeros.length ? suma(numeros) : null) : promedio;
  return franjasDe(juntar(delEquipo(clave)), juntar(desvios));
};

// Las franjas de cada clave en su unidad (para las variables y, ÷ el V.R.,
// para los %): de las filas (Mi selección), del V.R. (Valor referencial) o de
// las sesiones (Objetivo).
// tipo: "promedio" o "suma". En un por minuto (y Drel), el Bueno es el
// promedio de la medida ÷ el promedio de los minutos de las filas (no el
// promedio de los por minuto) y el desvío, el de los por minuto de las filas
// (la hoja TD del Excel).
const franjasDeClave = (filas, vr, clave, tipo, categorizacion, sesiones) => {
  if (categorizacion === "valorReferencial") return franjasDelVr(vr, clave);
  if (categorizacion === "objetivo") return sesiones ? franjasDelObjetivo(sesiones, clave, tipo) : null;
  if (categorizacion !== "miSeleccion") return null;
  const medida = MEDIDAS.find((una) => conMin(una) === clave);
  if (tipo === "promedio" && medida) {
    const porMinuto = filas.map((fila) => fila.promedios[clave]).filter(esNumero);
    const media = dividir(promedio(filas.map((fila) => fila.promedios[medida]).filter(esNumero)), promedio(filas.map((fila) => fila.minutos).filter(esNumero)));
    return franjasDe(media, desvio(porMinuto));
  }
  return franjasDeFilas(filas, (fila) => (tipo === "suma" ? fila.sumas[clave] : fila.promedios[clave]));
};

// Las franjas de una tabla (las filas de un V.R.): los índices y las
// variables de lo elegido en «Tipo variable» y «Visualización». Con
// Objetivo: sesiones (las de esa tabla).
export const franjasDeTabla = (filas, vr, { categorizacion, tipoVariable, visualizacion, sesiones = null }) => {
  const valores = vr?.promedio || {};
  const enSuUnidad = (clave, tipo) => franjasDeClave(filas, vr, clave, tipo, categorizacion, sesiones);
  return armarFranjas({
    enSuUnidad,
    enPorcentaje: (clave, tipo) => franjasEnPorcentaje(enSuUnidad(clave, tipo), valores[clave]),
    tipoVariable,
    visualizacion,
  });
};

// Los índices y las variables de unas franjas: enSuUnidad(clave, tipo) y
// enPorcentaje(clave, tipo) dan las franjas de una clave en su unidad o en %
// del V.R. (tipo: "promedio" o "suma").
const armarFranjas = ({ enSuUnidad, enPorcentaje, tipoVariable, visualizacion }) => {
  // Los índices: con los % del promedio de cada medida y por minuto.
  const porClave = {};
  [...MEDIDAS, ...MEDIDAS.map(conMin)].forEach((clave) => {
    porClave[clave] = enPorcentaje(clave, "promedio");
  });
  const indices = franjasDeIndices(porClave);
  // Las variables.
  const relativa = tipoVariable === "relativas";
  const variables = {};
  TIPOS_DE_VARIABLE[tipoVariable].forEach((clave) => {
    if (relativa && (visualizacion === "suma" || visualizacion === "porcentajeSuma")) {
      variables[clave] = null;
      return;
    }
    const tipo = visualizacion === "suma" || visualizacion === "porcentajeSuma" ? "suma" : "promedio";
    variables[clave] = visualizacion === "porcentajePromedio" || visualizacion === "porcentajeSuma" ? enPorcentaje(clave, tipo) : enSuUnidad(clave, tipo);
  });
  return { indices, variables };
};

// Las franjas de todo lo que se ve, para «Mi selección» y «Objetivo»
// (Santiago, 16/10: «Mi Seleccion: pinta por todo, no importa los
// microciclos (Su definicion es: Promedio de todo lo que estoy viendo y las
// categorias se arman con el desvio estandar de los datos que estoy
// viendo)»; «Objetivo Sesion: El promedio es el de el microciclo
// seleccionado y las demas categorias se arman con el desvio de los
// jugadores que esten filtrados»; solo con Valor referencial «importan los
// microciclos»). Unas solas franjas con todas las filas del informe (o
// todas las sesiones), sin separar por V.R. Las de los % salen de cada fila
// (o sesión) dividida por su propio V.R.; las que no tienen V.R. no tienen
// %. Con un solo V.R. da lo mismo que dividir las franjas por él (como el
// archivo). vrDeSesion(sesión): el V.R. de una sesión de Objetivo.
export const franjasDeTodo = (filas, { categorizacion, tipoVariable, visualizacion, sesiones = null, vrDeSesion = () => null }) => {
  const objetivo = categorizacion === "objetivo";
  // Las franjas en % de cada V.R., con unas filas (o sesiones).
  const enPorcentajeCon = (lasFilas, lasSesiones) => (clave, tipo) =>
    objetivo
      ? lasSesiones && franjasDelObjetivo(sesionesEnPorcentaje(lasSesiones, clave, vrDeSesion), clave, tipo)
      : franjasDeClave(filasEnPorcentaje(lasFilas, clave), null, clave, tipo, categorizacion, null);
  const franjas = armarFranjas({
    enSuUnidad: (clave, tipo) => franjasDeClave(filas, null, clave, tipo, categorizacion, sesiones),
    enPorcentaje: enPorcentajeCon(filas, sesiones),
    tipoVariable,
    visualizacion,
  });
  // Cada índice, con las filas (o sesiones) cuyo V.R. tiene todas sus
  // medidas, así todas salen de las mismas filas (una fila sin una de ellas
  // tampoco tiene ese índice). Con un solo V.R. da lo mismo que antes.
  const indices = {};
  Object.entries(MEDIDAS_DE_INDICE).forEach(([indice, claves]) => {
    const completo = (vr) => claves.every((clave) => baseDe(vr, clave) !== null);
    const enPorcentaje = enPorcentajeCon(
      filas.filter((fila) => completo(fila.vr)),
      sesiones && sesiones.filter((sesion) => completo(vrDeSesion(sesion))),
    );
    indices[indice] = franjasDeIndices(Object.fromEntries(claves.map((clave) => [clave, enPorcentaje(clave, "promedio")])))[indice];
  });
  return { ...franjas, indices };
};

// Las medidas de cada índice (ver indicesDe).
const MEDIDAS_DE_INDICE = Object.freeze({
  volumen: ["d", ...ALTA, ...MAXIMA],
  relativo: [conMin("d"), ...ALTA.map(conMin), ...MAXIMA.map(conMin)],
  total: ["d"],
  totalRel: [conMin("d")],
  alta: ALTA,
  altaRel: ALTA.map(conMin),
  maxima: MAXIMA,
  maximaRel: MAXIMA.map(conMin),
});

// El V.R. de una clave, si sirve para dividir (como dividir()).
const baseDe = (vr, clave) => {
  const base = vr?.promedio?.[clave];
  return esNumero(base) && base !== 0 ? base : null;
};
// La medida de un por minuto (d de d_min), o null.
const medidaDe = (clave) => MEDIDAS.find((una) => conMin(una) === clave) || null;

// Las filas del informe con una clave en % de su V.R. (las que no tienen
// V.R. para esa clave no van). En un por minuto también la medida, así el
// Bueno sigue siendo el promedio de la medida ÷ el de los minutos.
const filasEnPorcentaje = (filas, clave) => {
  const medida = medidaDe(clave);
  return filas.flatMap((fila) => {
    const base = baseDe(fila.vr, clave);
    if (base === null) return [];
    const en = (valor) => (esNumero(valor) ? valor / base : valor);
    const promedios = { ...fila.promedios, [clave]: en(fila.promedios[clave]) };
    if (medida) promedios[medida] = en(fila.promedios[medida]);
    return [{ ...fila, promedios, sumas: { ...fila.sumas, [clave]: en(fila.sumas[clave]) } }];
  });
};

// Las sesiones de Objetivo con una clave en % del V.R. de cada una (el
// promedio del equipo y los jugadores; en un por minuto, también la medida).
const sesionesEnPorcentaje = (sesiones, clave, vrDeSesion) => {
  const medida = medidaDe(clave);
  return sesiones.flatMap((sesion) => {
    const base = baseDe(vrDeSesion(sesion), clave);
    if (base === null) return [];
    const en = (valor) => (esNumero(valor) ? valor / base : valor);
    const escalar = (fila) => ({ ...fila, datos: { ...fila.datos, [clave]: en(fila.datos?.[clave]), ...(medida ? { [medida]: en(fila.datos?.[medida]) } : {}) } });
    return [{ ...sesion, equipo: sesion.equipo.map(escalar), jugadores: sesion.jugadores.map(escalar) }];
  });
};

// --------------------------------------------------------- VS RIVAL --
// Los partidos oficiales de cada fila (Santiago, 15/10: «toma la descripción
// donde la condicion sea total, asi se va si entro o jugo el partido
// completo»). El Excel toma la 3.ª y la 6.ª descripción del promedio del
// equipo de los partidos oficiales del microciclo, en el orden en que se
// cargaron, contando con que son las del TOTAL; si se cargaron en otro
// orden, muestra otra (en el 17 del club, un ST). Acá, en orden de fecha:
//   · el promedio del equipo: el TOTAL de cada partido oficial del
//     microciclo (la descripción que dice TOTAL; un partido sin TOTAL no va,
//     como en el Excel);
//   · un jugador: lo suyo en cada partido oficial de sus microciclos: su fila
//     del partido con Condición Total (TOTAL, PT, ST o SIN INGRESAR); si su
//     Total junta el partido con otra cosa, su fila del partido de más tiempo.
// Sin la fecha del principio, unidas con « - ». Como en el Excel, no miran
// los filtros.
export const PARTIDO_OFICIAL = "partido_oficial_torneo";
const sinFecha = (descripcion) => String(descripcion ?? "").slice(11).trim();
const DICE_TOTAL = /(^|[^a-z])total([^a-z]|$)/i;
const masLarga = (filas) => filas.reduce((mejor, fila) => ((fila.datos?.tiempo ?? -1) > (mejor.datos?.tiempo ?? -1) ? fila : mejor));

// Las filas de los partidos oficiales: las del promedio del equipo (Team
// Average Parcial) por microciclo y las de cada persona, por fecha.
export const indiceDeRivales = (filasGps) => {
  const equipo = new Map();
  const personas = new Map();
  const sumar = (mapa, clave, fila) => {
    if (!mapa.has(clave)) mapa.set(clave, new Map());
    const porFecha = mapa.get(clave);
    if (!porFecha.has(fila.fecha)) porFecha.set(fila.fecha, []);
    porFecha.get(fila.fecha).push(fila);
  };
  filasGps.forEach((fila) => {
    if (fila?.datos?.tarea_partido !== PARTIDO_OFICIAL || !fila.fecha) return;
    if (fila.promedio === "parcial") sumar(equipo, Number(fila.datos.microciclo), fila);
    else if (!fila.promedio) sumar(personas, claveDeNombre(fila), fila);
  });
  return { equipo, personas };
};

export const vsRivalDe = (fila, { equipo, personas }) => {
  const enOrden = (porFecha, entra = () => true) =>
    [...(porFecha?.entries() || [])]
      .filter(([, filas]) => entra(filas))
      .sort(([a], [b]) => a.localeCompare(b));
  let elegidas;
  if (fila.promedio) {
    elegidas = enOrden(equipo.get(Number(fila.microciclo)))
      .map(([, filas]) => filas.find((una) => DICE_TOTAL.test(una.datos?.descripcion ?? "")))
      .filter(Boolean);
  } else {
    const microciclos = new Set(fila.microciclos.map(Number));
    elegidas = enOrden(personas.get(fila.clave), (filas) => filas.some((una) => microciclos.has(Number(una.datos?.microciclo)))).map(
      ([, filas]) => filas.find((una) => una.datos?.condicion === "total") || masLarga(filas),
    );
  }
  return elegidas
    .map((una) => sinFecha(una.datos?.descripcion))
    .filter(Boolean)
    .join(" - ");
};

// ------------------------------------------------------- El informe --
// «Objetivo» solo pinta cuando todas las filas son de jugadores (Santiago,
// 16/10: «Solo pinta en caso de que solo haya jugadores y el color sale
// dependiendo de los microciclos elegidos y el modo de verlos (Suma: suma
// todos los valores de los microciclos seleccionados y de ahi sale el
// pintado, promedio es un promedio entre todos los microciclos
// seleccionados…)»); si no, no se ofrece (el archivo lo pintaba solo con
// «Jugador» en Microciclo/Jugador). filas: las del informe.
export const soloJugadores = (filas) => filas.length > 0 && filas.every((fila) => !fila.promedio);

// Todo «Por microciclo»: las filas en orden, con sus valores, y las franjas.
// opciones: { filtros, tipoVariable, visualizacion, categorizacion,
// asignaciones (los V.R. elegidos), nombreDe (el nombre que se ve de una
// fila: el promedio del equipo o la persona) }.
export const informePorMicrociclo = (filasGps, opciones) => {
  const { filtros = {}, tipoVariable = "absolutas", visualizacion = "promedio", asignaciones = [], nombreDe = () => "" } = opciones || {};
  const lista = ordenarFilas(filasPorMicrociclo(filasGps, filtros), nombreDe);
  // Objetivo sin que todas sean jugadores: sin franjas (la pantalla no lo ofrece).
  const pedida = opciones?.categorizacion || "miSeleccion";
  const categorizacion = pedida === "objetivo" && !soloJugadores(lista) ? null : pedida;
  const cronicas = cargasCronicas(lista);
  // Un jugador: la carga crónica del último microciclo de lo elegido.
  const cargas = indiceDeCargas(filasGps);
  const ultimoElegido = Math.max(...lista.flatMap((fila) => (fila.promedio ? [fila.microciclo] : fila.microciclos)).filter(esNumero));
  const rivales = indiceDeRivales(filasGps);
  const filas = lista.map((fila, i) => {
    const asignacion = referenciaDeFila(asignaciones, { microciclo: fila.microciclo ?? fila.microciclos[fila.microciclos.length - 1], dispositivo: fila.dispositivo });
    const vr = asignacion?.referencia || null;
    const porcentajes = porcentajesDeFila(fila, vr);
    return {
      ...fila,
      etiqueta: etiquetaDe(fila, nombreDe),
      asignacion: asignacion ? asignaciones.indexOf(asignacion) : -1,
      vr,
      porcentajes,
      indices: indicesDe(porcentajes.promedios),
      variables: Object.fromEntries(TIPOS_DE_VARIABLE[tipoVariable].map((clave) => [clave, valorDeVariable(fila, porcentajes, clave, tipoVariable, visualizacion)])),
      cargaCronica: fila.promedio ? cronicas[i] : cargaCronicaDeJugador(cargas, fila.clave, ultimoElegido),
      vsRival: vsRivalDe(fila, rivales),
    };
  });
  // La U.A. y la carga crónica: con «Mi selección», de todas las filas.
  const ua =
    categorizacion === "miSeleccion"
      ? {
          suma: franjasDeFilas(filas, (fila) => fila.sumas.ua, true),
          promedio: franjasDeFilas(filas, (fila) => fila.promedios.ua, true),
          cronicaSuma: franjasDeFilas(filas, (fila) => fila.cargaCronica.suma, true),
          cronicaPromedio: franjasDeFilas(filas, (fila) => fila.cargaCronica.promedio, true),
        }
      : null;
  // Objetivo: las sesiones de lo filtrado (los microciclos elegidos); con
  // «Valor suma», sus sumas, y con «Valor promedio», su promedio.
  const sesiones = categorizacion === "objetivo" ? sesionesDelObjetivo(filasGps, filtros) : null;
  const asignacionDeSesion = (sesion) => referenciaDeFila(asignaciones, { microciclo: sesion.microciclo, dispositivo: sesion.dispositivo });
  // Con «Mi selección» y «Objetivo», unas solas franjas de todo lo que se ve
  // (Santiago, 16/10: «no importa los microciclos»): valen para todas las
  // filas, también las que no tienen V.R.
  const general =
    categorizacion === "miSeleccion" || categorizacion === "objetivo"
      ? franjasDeTodo(filas, { categorizacion, tipoVariable, visualizacion, sesiones, vrDeSesion: (sesion) => asignacionDeSesion(sesion)?.referencia || null })
      : null;
  // Una tabla por cada V.R. elegido. Con «Valor referencial», con sus
  // franjas (ahí «importan los microciclos»: cada fila, las del V.R. de su
  // dispositivo o de sus microciclos); con las otras, las de todo.
  const tablas = asignaciones.map((asignacion, a) => ({
    asignacion: a,
    vr: asignacion.referencia || null,
    ...(general ||
      franjasDeTabla(
        filas.filter((fila) => fila.asignacion === a),
        asignacion.referencia,
        {
          categorizacion,
          tipoVariable,
          visualizacion,
          sesiones: sesiones && sesiones.filter((sesion) => asignacionDeSesion(sesion) === asignacion),
        },
      )),
  }));
  return { filas, ua, tablas, general };
};

// ------------------------------------------------------- Los colores --
// Todas las columnas se pintan, cada una con su regla del archivo (Santiago,
// 15/10: «Todas las columnas se pintan con sus reglas»): la U.A. y la carga
// crónica, como el archivo en «Por microciclo»; los índices y las variables,
// con la regla que el archivo usa para esas columnas en «Por jugador» (en
// «Por microciclo» no las pintaba). Los colores son los del archivo, más
// suaves (Santiago, 15/10, «B»; en el archivo: A7B093, C8E7A7, FFFF7F,
// FBCAA2, F1B584 y FF7F7F).
export const COLORES_INFORME = Object.freeze({
  excelente: COLORES_SUAVES.verdeOscuro,
  muyBueno: COLORES_SUAVES.verde,
  bueno: COLORES_SUAVES.amarillo,
  regularUa: COLORES_SUAVES.naranjaClaro,
  naranja: COLORES_SUAVES.naranja,
  malo: COLORES_SUAVES.rojo,
});

// U.A.: ≤ Excelente verde oscuro; ≤ Muy Bueno verde; ≤ Bueno amarillo;
// ≤ Regular naranja claro; más, rojo.
export const colorDeUa = (valor, franjas) => {
  if (!esNumero(valor) || !franjas || !esNumero(franjas.excelente)) return null;
  if (valor <= franjas.excelente) return COLORES_INFORME.excelente;
  if (valor <= franjas.muyBueno) return COLORES_INFORME.muyBueno;
  if (valor <= franjas.bueno) return COLORES_INFORME.bueno;
  if (valor <= franjas.regular) return COLORES_INFORME.regularUa;
  return COLORES_INFORME.malo;
};

// Índices y variables, con la regla del archivo para esas columnas (en
// «Por jugador»; con «Mi selección» y «Valor referencial», contra sus
// franjas; con «Objetivo», contra el objetivo ± el desvío, que son sus
// franjas): ≥ Excelente verde oscuro; ≥ Muy Bueno verde; ≥ Bueno amarillo;
// ≥ Regular naranja; menos, rojo. Sin franjas, sin color.
export const colorDeMayorMejor = (valor, franjas) => {
  if (!esNumero(valor) || !franjas || !["excelente", "muyBueno", "bueno", "regular"].every((franja) => esNumero(franjas[franja]))) return null;
  if (valor >= franjas.excelente) return COLORES_INFORME.excelente;
  if (valor >= franjas.muyBueno) return COLORES_INFORME.muyBueno;
  if (valor >= franjas.bueno) return COLORES_INFORME.bueno;
  if (valor >= franjas.regular) return COLORES_INFORME.naranja;
  return COLORES_INFORME.malo;
};

// Las variables, además, con la primera regla del archivo para ellas: un 0
// va en rojo (también sin franjas).
export const colorDeVariable = (valor, franjas) => (valor === 0 ? COLORES_INFORME.malo : colorDeMayorMejor(valor, franjas));

// Carga crónica (en U): rojo en los dos extremos, naranja al lado y amarillo
// al medio. Con las franjas de menor a mayor (Excelente < Malo): ≤ Excelente
// rojo; ≤ Muy Bueno naranja; ≤ Bueno amarillo; ≤ Regular naranja; más, rojo.
// De mayor a menor, lo mismo dado vuelta.
export const colorDeCargaCronica = (valor, franjas) => {
  if (!esNumero(valor) || !franjas || !esNumero(franjas.excelente) || !esNumero(franjas.malo)) return null;
  const { excelente, muyBueno, bueno, regular, malo } = franjas;
  if (excelente < malo) {
    if (valor <= excelente) return COLORES_INFORME.malo;
    if (valor <= muyBueno) return COLORES_INFORME.naranja;
    if (valor <= bueno) return COLORES_INFORME.bueno;
    if (valor <= regular) return COLORES_INFORME.naranja;
    return COLORES_INFORME.malo;
  }
  if (excelente > malo) {
    if (valor >= excelente) return COLORES_INFORME.malo;
    if (valor >= muyBueno) return COLORES_INFORME.naranja;
    if (valor >= bueno) return COLORES_INFORME.bueno;
    if (valor >= regular) return COLORES_INFORME.naranja;
    return COLORES_INFORME.malo;
  }
  return null;
};

export { MEDIDAS, ALTA, MAXIMA, numerosDe, promedio, dispositivoDe, diasDe };
