import { esError, multiplicar, seCumple, sumar } from "./excel.js";

// El formato condicional del Excel de evaluaciones, como datos: cada regla
// dice a qué columnas se aplica, su prioridad (la del Excel: el número más
// chico manda), cuándo se cumple y qué pinta. En cada celda, para cada cosa
// (relleno, color de la letra, negrita) gana la regla de más prioridad que
// se cumple; una regla "sin relleno" también se queda con el relleno, como en
// Excel (así las celdas vacías no se pintan). Con `detener` ("Detener si es
// verdad"), las de menos prioridad ya no se miran.
//
// Una regla: { prioridad, columnas: [claves], cumple(ctx), estilo, detener? }
// ctx: { valor (el de la celda), celda(clave) (otra celda de la misma fila),
// promedio y desvio (los de la columna en el informe, con el filtro) }.
// estilo: { relleno?: { tipo: "ninguno" | "solido" | "degradado", color },
// letra?: color, negrita?: true }.

// Los colores del Excel (los del tema, ya resueltos).
export const COLORES = Object.freeze({
  blanco: "#FFFFFF",
  verdeOscuro: "#4F6228",
  verde: "#92D050",
  amarillo: "#FFFF00",
  naranja: "#F79646",
  rojo: "#FF0000",
  gris: "#D9D9D9",
});

// Las clases van de 5 (Excelente) a 1 (Malo), siempre con estos colores
// (Santiago, 05/10): 5 verde oscuro, 4 verde, 3 amarillo, 2 naranja, 1 rojo.
export const COLOR_DE_CLASE = Object.freeze({
  5: COLORES.verdeOscuro,
  4: COLORES.verde,
  3: COLORES.amarillo,
  2: COLORES.naranja,
  1: COLORES.rojo,
});

export const SIN_RELLENO = Object.freeze({ relleno: Object.freeze({ tipo: "ninguno" }) });

// El degradé del Excel: de blanco, a la izquierda, al color, a la derecha.
export const degrade = (color) => ({ relleno: { tipo: "degradado", color } });

// Una clase, igual en todos lados (Santiago, 09/10: "que se vean bien y sea
// lo mismo para todas las clasificaciones en todos lados"): el número en
// negrita sobre el color de su clase, con la letra que mejor se lee (blanca
// sobre el verde oscuro y el rojo). En el Excel era el número del color de
// la clase sobre gris, y el 3 amarillo casi no se leía.
const LETRA_SOBRE_CLASE = Object.freeze({ 5: COLORES.blanco, 4: "#111827", 3: "#111827", 2: "#111827", 1: COLORES.blanco });
export const estiloDeClase = (clase) => ({ relleno: { tipo: "solido", color: COLOR_DE_CLASE[clase] }, letra: LETRA_SOBRE_CLASE[clase], negrita: true });

// Una letra de color en negrita sobre gris (como en el Excel, por ejemplo
// PD / PI / Sin Deficit en Curl Nórdico e Isoprone).
export const letraSobreGris = (color) => ({ relleno: { tipo: "solido", color: COLORES.gris }, letra: color, negrita: true });

// promedio + k × desvío, con las cuentas de Excel (un error se arrastra).
export const masDesvios = (promedio, desvio, k) => sumar(promedio, multiplicar(desvio, k));

export const ordenarReglas = (reglas) => [...reglas].sort((a, b) => a.prioridad - b.prioridad);

// El estilo de una celda con las reglas (ya ordenadas por prioridad).
export const estiloDeCelda = (reglas, clave, contexto) => {
  const estilo = {};
  for (const regla of reglas) {
    if (!regla.columnas.includes(clave)) continue;
    const resultado = regla.cumple(contexto);
    if (esError(resultado) || !seCumple(resultado)) continue;
    for (const [propiedad, valor] of Object.entries(regla.estilo)) {
      if (!(propiedad in estilo)) estilo[propiedad] = valor;
    }
    if (regla.detener) break;
  }
  return estilo;
};

// El estilo como lo pinta la pantalla (el de la hoja de estilos, si no hay
// nada que pintar).
export const cssDeEstilo = (estilo) => {
  const css = {};
  if (estilo?.relleno?.tipo === "degradado") css.background = `linear-gradient(90deg, ${COLORES.blanco}, ${estilo.relleno.color})`;
  else if (estilo?.relleno?.tipo === "solido") css.background = estilo.relleno.color;
  if (estilo?.letra) css.color = estilo.letra;
  if (estilo?.negrita) css.fontWeight = 700;
  return Object.keys(css).length ? css : null;
};
