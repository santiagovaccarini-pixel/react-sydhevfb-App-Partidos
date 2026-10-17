// Los colores de las franjas y de los semáforos de la app (Santiago, 15/10:
// eligió «B. Los mismos colores, más suaves» para el Informe de GPS y pidió
// «suaviza todos los colores en todos los lugares donde se use»). Son los
// mismos colores de los archivos del club (verde oscuro, verde, amarillo,
// naranja y rojo), en un tono más suave: se leen mejor con muchas celdas
// pintadas juntas y la letra oscura se lee igual en todos.
export const COLORES_SUAVES = Object.freeze({
  verdeOscuro: "#8FC79B",
  verde: "#D3EDC9",
  amarillo: "#FBF0A6",
  naranjaClaro: "#FBDCC2",
  naranja: "#F7C79A",
  rojo: "#F4A7A7",
  gris: "#D5D9DF",
});

// El relleno de una celda pintada: un degradé de blanco a su color, en un tono
// más fuerte que el suave (Santiago, nota del 16/10: «Degradar los colores
// mitad blanco y el color que corresponda»; el 17/10, viendo capturas, «B
// fuerte pero un poco mas degradado»). El blanco llega hasta el 30 % y el
// color lleno va desde el 70 %; la letra sigue oscura y se lee igual.
export const COLORES_FUERTES = Object.freeze({
  verdeOscuro: "#4FA866",
  verde: "#9FD68A",
  amarillo: "#F5DC3F",
  naranjaClaro: "#F7B47F",
  naranja: "#EE9447",
  rojo: "#E86060",
});
const FUERTE_DE = Object.freeze(Object.fromEntries(Object.entries(COLORES_FUERTES).map(([nombre, fuerte]) => [COLORES_SUAVES[nombre], fuerte])));
// El tono fuerte de un color de franja (para una muestra chica, como la de una
// leyenda); otro color queda igual.
export const fuerte = (color) => (typeof color === "string" ? FUERTE_DE[color.toUpperCase()] || color : color);
// El fondo de una celda: el degradé, si es un color de franja; otro color
// (el gris de las clases, el de la fila del equipo), liso.
export const rellenoDe = (color) => {
  const tono = typeof color === "string" ? FUERTE_DE[color.toUpperCase()] : null;
  return tono ? `linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 30%, ${tono} 70%, ${tono} 100%)` : color;
};

// Cada color fuerte de los archivos del club, con su versión suave. Los
// colores de la letra no pasan por acá: más suaves no se leerían (por ejemplo,
// el número de una clase sobre gris).
const SUAVE_DE = Object.freeze({
  // GPS (la Base y el Informe).
  "#7FAD94": COLORES_SUAVES.verdeOscuro,
  "#A7B093": COLORES_SUAVES.verdeOscuro,
  "#C8E7A7": COLORES_SUAVES.verde,
  "#FFFF7F": COLORES_SUAVES.amarillo,
  "#FBCAA2": COLORES_SUAVES.naranjaClaro,
  "#F1B584": COLORES_SUAVES.naranja,
  "#FF7F7F": COLORES_SUAVES.rojo,
  "#D99694": COLORES_SUAVES.rojo,
  "#BFBFBF": COLORES_SUAVES.gris,
  // Evaluaciones (y el amarillo puro, también en GPS).
  "#4F6228": COLORES_SUAVES.verdeOscuro,
  "#92D050": COLORES_SUAVES.verde,
  "#FFFF00": COLORES_SUAVES.amarillo,
  "#F79646": COLORES_SUAVES.naranja,
  "#FF0000": COLORES_SUAVES.rojo,
});

// La versión suave de un color de relleno (uno que no es de los archivos,
// como el gris de las clases o el negro, queda igual).
export const suave = (color) => (typeof color === "string" ? SUAVE_DE[color.toUpperCase()] || color : color);
