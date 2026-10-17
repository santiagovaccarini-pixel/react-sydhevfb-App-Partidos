import { esNumero } from "./valores.js";
import { rellenoDe, suave } from "../colores.js";

// El informe de arriba de BD_GPS y su formato condicional, con las filas que
// deja ver el filtro (los SUBTOTAL del Excel), por dispositivo: cada fila se
// pinta contra el promedio y el desvío de las filas a la vista de su mismo
// dispositivo (Santiago, 10/10; en el Excel, las de microciclo ≤16 contra la
// tabla «Tabla para microciclo <=16» y las demás contra todas).
//
// Las cuentas de cada columna (filas 2 a 10 del Excel):
//   Excelente = promedio + 2 desvíos, Muy Bueno = promedio + desvío,
//   Promedio/Bueno = promedio, Regular = promedio − desvío,
//   Malo = promedio − 2 desvíos, Desvío, n, Máx. y Mín.
// En una columna "por minuto" el promedio es el del valor ÷ el de los
// minutos (=SUBTOTAL(1;D)/(SUBTOTAL(1;X)*1440)); el desvío, n, máximo y
// mínimo, los de la columna misma. Una columna sin números queda vacía (como
// se decidió en Evaluaciones; el Excel mostraba #DIV/0! y 0).
//
// Arriba de la Base, por dispositivo, solo van tres filas (Santiago, 12/10 y
// 14/10: «solo dejar las de promedio por dispositivo y agregar todos los vr
// de gps asi como los % vs vr»; las filas 13 a 15 del Excel): el promedio, el
// V.R. del dispositivo (la hoja «Valores Referenciales», gps_referencias) y
// el promedio ÷ el V.R. (=SI.ERROR(D4/D14;"")). Debajo, las Comparaciones
// (la fila 16; ver comparaciones()).
//
// Los colores (D19:X30002 del Excel), con el promedio y el desvío de su
// dispositivo, como siempre (Santiago, 14/10: «Como hoy»; aunque las filas
// Excelente … Malo ya no se vean): > Excelente, verde oscuro; de Muy Bueno
// a Excelente (sin llegar), verde claro; de Promedio a Muy Bueno, amarillo;
// de Regular a Promedio, naranja; < Regular, rojo. Justo en Excelente no se
// pinta (como en el Excel). Sin desvío (menos de dos números), sin colores.

export const FILAS_DEL_INFORME = Object.freeze(["media", "vr", "porcentaje"]);

// Las columnas de las Comparaciones (la fila 16 del Excel): las nueve
// absolutas de D a L (el «volumen») y sus por minuto, de N a V (la
// «densidad»); Mts >= 90% Pico no entra, como en el Excel.
export const ABSOLUTAS_COMPARADAS = Object.freeze(["d", "d_shi", "d_acchi", "d_dechi", "d_mphi", "d_s6", "d_a8", "d_a1", "d_mp5"]);
export const RELATIVAS_COMPARADAS = Object.freeze(ABSOLUTAS_COMPARADAS.map((clave) => `${clave}_min`));

// Las columnas de un V.R. (GPS › Valores de referencia), como la hoja de los
// V.R. del club: las medidas (de D a Mts >= 90% Pico), sus por minuto y el
// Tiempo.
export const CLAVES_DE_LOS_VR = Object.freeze([...ABSOLUTAS_COMPARADAS, "mts90", ...RELATIVAS_COMPARADAS, "mts90_min", "tiempo"]);

// Las categorías de un V.R. por jugador (migración
// 20261026_gps_referencias_categorias.sql; Santiago, 15/10: «en el caso de
// jugador ya tiene las 5 categorias entonces no se usa desvio»): Excelente,
// Muy Bueno, Regular y Malo, cada una { columna: número }; el Bueno es su
// promedio. Un V.R. sin categorías arma las franjas con el promedio y el
// desvío.
export const CATEGORIAS_DE_UN_VR = Object.freeze(["excelente", "muy_bueno", "regular", "malo"]);
export const tieneCategorias = (referencia) => CATEGORIAS_DE_UN_VR.some((categoria) => Object.keys(referencia?.categorias?.[categoria] || {}).length > 0);

// La zona de impacto de las Comparaciones (la celda AI16 del Excel): qué
// columnas promedia cada una. Tarea Mixta, todas (el volumen y la densidad
// promedio).
export const ZONAS_DE_IMPACTO = Object.freeze([
  { id: "fuerza", claves: Object.freeze(["d_acchi", "d_dechi", "d_a8", "d_a1"]) },
  { id: "f_m", claves: Object.freeze(["d", "d_shi", "d_acchi", "d_dechi", "d_mphi", "d_a8", "d_a1"]) },
  { id: "f_v", claves: Object.freeze(["d_s6", "d_mp5", "d_acchi", "d_dechi", "d_a8", "d_a1"]) },
  { id: "metabolica", claves: Object.freeze(["d", "d_shi", "d_mphi"]) },
  { id: "v_m", claves: Object.freeze(["d", "d_shi", "d_mphi", "d_s6", "d_mp5"]) },
  { id: "velocidad", claves: Object.freeze(["d_mp5", "d_s6"]) },
  { id: "tarea_mixta", claves: null },
]);
export const ZONA_AL_ABRIR = "tarea_mixta";

// Los colores del Excel, más suaves (Santiago, 15/10: «suaviza todos los
// colores en todos los lugares donde se use»; en el Excel: 7FAD94, C8E7A7,
// FFFF7F, F1B584 y FF7F7F).
export const COLORES_GPS = Object.freeze({
  excelente: suave("#7FAD94"),
  muyBueno: suave("#C8E7A7"),
  bueno: suave("#FFFF7F"),
  regular: suave("#F1B584"),
  malo: suave("#FF7F7F"),
  // La columna Nombre: el promedio del equipo de una tarea (amarillo), el de
  // un tiempo de un partido oficial (gris) y el de la sesión (rojo claro).
  promedioParcial: suave("#FFFF00"),
  promedioPartido: suave("#BFBFBF"),
  promedioSesion: suave("#D99694"),
});

// El código de "Partido Oficial Torneo" en la lista Tarea o Partido.
const PARTIDO_OFICIAL = "partido_oficial_torneo";

// Las cuentas van en el orden de las filas (como antes, con reduce): dan lo
// mismo, al último decimal.
const suma = (numeros) => {
  let total = 0;
  for (const x of numeros) total += x;
  return total;
};

const promedio = (numeros) => (numeros.length ? suma(numeros) / numeros.length : null);

// El desvío de la muestra (DESVEST): con menos de dos números no hay.
const desvio = (numeros) => {
  if (numeros.length < 2) return null;
  const media = promedio(numeros);
  let total = 0;
  for (const x of numeros) total += (x - media) ** 2;
  return Math.sqrt(total / (numeros.length - 1));
};

// Las claves que necesitan las cuentas de unas columnas: la suya y, en un
// "por minuto", su medida y el Tiempo.
const clavesQueUsan = (columnas) => [...new Set(columnas.flatMap((columna) => (columna.tipo === "porMinuto" ? [columna.clave, columna.de, "tiempo"] : [columna.clave])))];

// Los números de cada clave, en el orden de las filas, en una sola pasada
// (son miles de filas y decenas de columnas).
const numerosPorClave = (filas, claves) => {
  const numeros = Object.fromEntries(claves.map((clave) => [clave, []]));
  for (const fila of filas) {
    const datos = fila.datos;
    if (!datos) continue;
    for (const clave of claves) {
      const valor = datos[clave];
      if (esNumero(valor)) numeros[clave].push(valor);
    }
  }
  return numeros;
};

// Las cuentas de una columna, con los números de cada clave.
const cuentasDeColumna = (columna, numerosDe) => {
  const numeros = numerosDe[columna.clave];
  if (!numeros.length) return null;
  let media = promedio(numeros);
  if (columna.tipo === "porMinuto") {
    const valor = promedio(numerosDe[columna.de]);
    const segundos = promedio(numerosDe.tiempo);
    media = esNumero(valor) && esNumero(segundos) && segundos !== 0 ? valor / (segundos / 60) : null;
  }
  const d = desvio(numeros);
  const banda = (k) => (esNumero(media) && esNumero(d) ? media + k * d : null);
  let max = -Infinity;
  let min = Infinity;
  for (const x of numeros) {
    if (x > max) max = x;
    if (x < min) min = x;
  }
  return {
    media,
    desvio: d,
    n: numeros.length,
    max,
    min,
    excelente: banda(2),
    muyBueno: banda(1),
    regular: banda(-1),
    malo: banda(-2),
  };
};

// Las cuentas de una columna con las filas de un dispositivo.
export const estadisticasDeColumna = (filas, columna) => cuentasDeColumna(columna, numerosPorClave(filas, clavesQueUsan([columna])));

// El color de un valor contra las cuentas de su columna (o null).
export const colorDeValor = (valor, cuentas) => {
  if (!esNumero(valor) || !cuentas || !esNumero(cuentas.excelente)) return null;
  const { excelente, muyBueno, media, regular } = cuentas;
  if (valor > excelente) return COLORES_GPS.excelente;
  if (valor < excelente && valor >= muyBueno) return COLORES_GPS.muyBueno;
  if (valor < muyBueno && valor >= media) return COLORES_GPS.bueno;
  if (valor < media && valor >= regular) return COLORES_GPS.regular;
  if (valor < regular) return COLORES_GPS.malo;
  return null;
};

// El color de la columna Nombre de una fila de promedio del equipo.
export const colorDelNombre = (fila) => {
  if (fila.promedio === "sesion") return COLORES_GPS.promedioSesion;
  if (fila.promedio === "parcial") return fila.datos?.tarea_partido === PARTIDO_OFICIAL ? COLORES_GPS.promedioPartido : COLORES_GPS.promedioParcial;
  return null;
};

// El promedio ÷ el V.R. (=SI.ERROR(D4/D14;"")): sin alguno de los dos, o con
// el V.R. en 0, vacío.
export const porcentajeVsVr = (media, vr) => (esNumero(media) && esNumero(vr) && vr !== 0 ? media / vr : null);

// Los % de un dispositivo: { clave: % } de las columnas con V.R. (las
// cuentas, las de su grupo en vistaDelGps).
export const porcentajesVsVr = (cuentas, vr = {}) =>
  Object.fromEntries(Object.keys(vr || {}).map((clave) => [clave, porcentajeVsVr(cuentas?.[clave]?.media, vr[clave])]));

// El promedio de los % que hay (PROMEDIO salta los vacíos; sin ninguno,
// vacío: el Excel mostraba #DIV/0!).
const promedioDeLos = (porcentajes, claves) => promedio(claves.map((clave) => porcentajes?.[clave]).filter(esNumero));

// Las Comparaciones de un dispositivo (la fila 16 del Excel), con sus %:
// el volumen (las absolutas) y la densidad (las por minuto), en promedio y
// en la zona de impacto elegida, y el % del tiempo.
export const comparaciones = (porcentajes, zona = ZONA_AL_ABRIR) => {
  const volumen = promedioDeLos(porcentajes, ABSOLUTAS_COMPARADAS);
  const densidad = promedioDeLos(porcentajes, RELATIVAS_COMPARADAS);
  const claves = ZONAS_DE_IMPACTO.find((una) => una.id === zona)?.claves || null;
  return {
    volumen,
    volumenZona: claves ? promedioDeLos(porcentajes, claves) : volumen,
    densidad,
    densidadZona: claves ? promedioDeLos(porcentajes, claves.map((clave) => `${clave}_min`)) : densidad,
    tiempo: esNumero(porcentajes?.tiempo) ? porcentajes.tiempo : null,
  };
};

// Lo que depende de las filas a la vista. filas: [{ id, promedio, datos }];
// columnas: las que se ven; conCuentas: otras columnas de las que hacen
// falta las cuentas aunque no se vean (las de los V.R.). Devuelve { grupos:
// [{ dispositivo, filas, cuentas: { clave: cuentas } }], estilos: { id: {
// clave: css } } }. Los grupos van en el orden en que aparece cada
// dispositivo (sin dispositivo, "").
export const vistaDelGps = (filas, columnas, conCuentas = []) => {
  const porDispositivo = new Map();
  filas.forEach((fila) => {
    const dispositivo = fila.datos?.dispositivo || "";
    if (!porDispositivo.has(dispositivo)) porDispositivo.set(dispositivo, []);
    porDispositivo.get(dispositivo).push(fila);
  });
  const vistas = new Set(columnas.map((columna) => columna.clave));
  const delInforme = [...columnas, ...conCuentas.filter((columna) => !vistas.has(columna.clave))].filter((columna) => columna.informe);
  const claves = clavesQueUsan(delInforme);
  const grupos = [...porDispositivo.entries()].map(([dispositivo, suyas]) => {
    const numeros = numerosPorClave(suyas, claves);
    return {
      dispositivo,
      filas: suyas.length,
      cuentas: Object.fromEntries(delInforme.map((columna) => [columna.clave, cuentasDeColumna(columna, numeros)])),
    };
  });
  const cuentasDe = new Map(grupos.map((grupo) => [grupo.dispositivo, grupo.cuentas]));
  const conColores = columnas.filter((columna) => columna.colores);
  const estilosDe = (fila) => {
    const cuentas = cuentasDe.get(fila.datos?.dispositivo || "");
    const suyos = {};
    conColores.forEach((columna) => {
      const color = colorDeValor(fila.datos?.[columna.clave], cuentas?.[columna.clave]);
      if (color) suyos[columna.clave] = { background: rellenoDe(color) };
    });
    const nombre = colorDelNombre(fila);
    if (nombre) suyos.jugador = { background: nombre };
    return Object.keys(suyos).length ? suyos : undefined;
  };
  // Los colores de cada fila se calculan cuando se piden (la tabla dibuja
  // unas decenas de las miles que hay a la vista) y una sola vez.
  const porId = new Map(filas.map((fila) => [String(fila.id), fila]));
  const calculados = new Map();
  const estilos = new Proxy(
    {},
    {
      get: (_, id) => {
        const fila = typeof id === "string" ? porId.get(id) : undefined;
        if (!fila) return undefined;
        if (!calculados.has(id)) calculados.set(id, estilosDe(fila));
        return calculados.get(id);
      },
    },
  );
  return { grupos, estilos };
};
