import { esNumero } from "./valores.js";

// El informe de arriba de BD_GPS y su formato condicional, con las filas que
// deja ver el filtro (los SUBTOTAL del Excel), por dispositivo: cada fila se
// pinta contra el promedio y el desvío de las filas a la vista de su mismo
// dispositivo (Santiago, 10/10; en el Excel, las de microciclo ≤16 contra la
// tabla «Tabla para microciclo <=16» y las demás contra todas).
//
// Arriba, por columna (filas 2 a 10 del Excel):
//   Excelente = promedio + 2 desvíos, Muy Bueno = promedio + desvío,
//   Promedio/Bueno = promedio, Regular = promedio − desvío,
//   Malo = promedio − 2 desvíos, Desvío, n, Máx. y Mín.
// En una columna "por minuto" el promedio es el del valor ÷ el de los
// minutos (=SUBTOTAL(1;D)/(SUBTOTAL(1;X)*1440)); el desvío, n, máximo y
// mínimo, los de la columna misma. Una columna sin números queda vacía (como
// se decidió en Evaluaciones; el Excel mostraba #DIV/0! y 0). En Maxima
// Velocidad a HDOP, el Excel tenía n, Máx. y Mín. una fila más abajo: acá van
// alineados (errores chicos, corregidos: Santiago, 10/10).
//
// Los colores (D19:X30002 del Excel), con el promedio y el desvío de su
// dispositivo: > Excelente, verde oscuro; de Muy Bueno a Excelente (sin
// llegar), verde claro; de Promedio a Muy Bueno, amarillo; de Regular a
// Promedio, naranja; < Regular, rojo. Justo en Excelente no se pinta (como
// en el Excel). Sin desvío (menos de dos números), sin colores.

export const FILAS_DEL_INFORME = Object.freeze([
  { id: "excelente", rotulo: { "es-AR": "Excelente", "pt-BR": "Excelente" } },
  { id: "muyBueno", rotulo: { "es-AR": "Muy Bueno", "pt-BR": "Muito Bom" } },
  { id: "media", rotulo: { "es-AR": "Promedio/Bueno", "pt-BR": "Média/Bom" } },
  { id: "regular", rotulo: { "es-AR": "Regular", "pt-BR": "Regular" } },
  { id: "malo", rotulo: { "es-AR": "Malo", "pt-BR": "Ruim" } },
  { id: "desvio", rotulo: { "es-AR": "Desvío", "pt-BR": "Desvio" } },
  { id: "n", rotulo: { "es-AR": "n", "pt-BR": "n" } },
  { id: "max", rotulo: { "es-AR": "Máx.", "pt-BR": "Máx." } },
  { id: "min", rotulo: { "es-AR": "Mín.", "pt-BR": "Mín." } },
]);

// Los colores del Excel.
export const COLORES_GPS = Object.freeze({
  excelente: "#7FAD94",
  muyBueno: "#C8E7A7",
  bueno: "#FFFF7F",
  regular: "#F1B584",
  malo: "#FF7F7F",
  // La columna Nombre: el promedio del equipo de una tarea (amarillo), el de
  // un tiempo de un partido oficial (gris) y el de la sesión (rojo claro).
  promedioParcial: "#FFFF00",
  promedioPartido: "#BFBFBF",
  promedioSesion: "#D99694",
});

// El código de "Partido Oficial Torneo" en la lista Tarea o Partido.
const PARTIDO_OFICIAL = "partido_oficial_torneo";

const promedio = (numeros) => (numeros.length ? numeros.reduce((suma, x) => suma + x, 0) / numeros.length : null);

// El desvío de la muestra (DESVEST): con menos de dos números no hay.
const desvio = (numeros) => {
  if (numeros.length < 2) return null;
  const media = promedio(numeros);
  return Math.sqrt(numeros.reduce((suma, x) => suma + (x - media) ** 2, 0) / (numeros.length - 1));
};

const numerosDe = (filas, clave) => filas.map((fila) => fila.datos?.[clave]).filter(esNumero);

// Las cuentas de una columna con las filas de un dispositivo.
export const estadisticasDeColumna = (filas, columna) => {
  const numeros = numerosDe(filas, columna.clave);
  if (!numeros.length) return null;
  let media = promedio(numeros);
  if (columna.tipo === "porMinuto") {
    const valor = promedio(numerosDe(filas, columna.de));
    const segundos = promedio(numerosDe(filas, "tiempo"));
    media = esNumero(valor) && esNumero(segundos) && segundos !== 0 ? valor / (segundos / 60) : null;
  }
  const d = desvio(numeros);
  const banda = (k) => (esNumero(media) && esNumero(d) ? media + k * d : null);
  return {
    media,
    desvio: d,
    n: numeros.length,
    max: Math.max(...numeros),
    min: Math.min(...numeros),
    excelente: banda(2),
    muyBueno: banda(1),
    regular: banda(-1),
    malo: banda(-2),
  };
};

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

// Lo que depende de las filas a la vista. filas: [{ id, promedio, datos }];
// columnas: las que se ven. Devuelve { grupos: [{ dispositivo, filas,
// cuentas: { clave: cuentas } }], estilos: { id: { clave: css } } }. Los
// grupos van en el orden en que aparece cada dispositivo (sin dispositivo,
// "").
export const vistaDelGps = (filas, columnas) => {
  const porDispositivo = new Map();
  filas.forEach((fila) => {
    const dispositivo = fila.datos?.dispositivo || "";
    if (!porDispositivo.has(dispositivo)) porDispositivo.set(dispositivo, []);
    porDispositivo.get(dispositivo).push(fila);
  });
  const delInforme = columnas.filter((columna) => columna.informe);
  const grupos = [...porDispositivo.entries()].map(([dispositivo, suyas]) => ({
    dispositivo,
    filas: suyas.length,
    cuentas: Object.fromEntries(delInforme.map((columna) => [columna.clave, estadisticasDeColumna(suyas, columna)])),
  }));
  const cuentasDe = new Map(grupos.map((grupo) => [grupo.dispositivo, grupo.cuentas]));
  const conColores = columnas.filter((columna) => columna.colores);
  const estilos = {};
  filas.forEach((fila) => {
    const cuentas = cuentasDe.get(fila.datos?.dispositivo || "");
    const suyos = {};
    conColores.forEach((columna) => {
      const color = colorDeValor(fila.datos?.[columna.clave], cuentas?.[columna.clave]);
      if (color) suyos[columna.clave] = { background: color };
    });
    const nombre = colorDelNombre(fila);
    if (nombre) suyos.jugador = { background: nombre };
    if (Object.keys(suyos).length) estilos[fila.id] = suyos;
  });
  return { grupos, estilos };
};
