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
