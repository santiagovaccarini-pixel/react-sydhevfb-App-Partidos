import { esError, esNumero, mayorIgual, menorIgual } from "./excel.js";

// Las clases del Excel de evaluaciones contra los cortes de los V.R.
// ([Excelente, Muy Bueno, Bueno, Regular, Malo]; Malo no se usa: lo que no
// llega a Regular es 1). Un error al comparar se devuelve como error.

// "Más es mejor": IF(x>=Exc,5,IF(x>=MB,4,IF(x>=Bueno,3,IF(x>=Reg,2,1)))).
export const claseMas = (valor, cortes) => {
  for (let i = 0; i < 4; i += 1) {
    const cumple = mayorIgual(valor, cortes[i]);
    if (esError(cumple)) return cumple;
    if (cumple) return 5 - i;
  }
  return 1;
};

// "Menos es mejor" (los déficits): lo mismo con <=.
export const claseMenos = (valor, cortes) => {
  for (let i = 0; i < 4; i += 1) {
    const cumple = menorIgual(valor, cortes[i]);
    if (esError(cumple)) return cumple;
    if (cumple) return 5 - i;
  }
  return 1;
};

const CORTES = ["excelente", "muy_bueno", "bueno", "regular", "malo"];

// Los cortes de una medida en una categoría: [Excelente, Muy Bueno, Bueno,
// Regular, Malo], o null si el club todavía no tiene esos V.R. (sin V.R.,
// las clases quedan vacías: Santiago, 05/10; el Excel les daba 5 o 1 a
// todos).
export const cortesDe = (referencias, categoria, metrica) => {
  const bloque = referencias?.categorias?.[categoria];
  if (!bloque) return null;
  const cortes = CORTES.map((fila) => bloque[fila]?.[metrica]);
  return cortes.every(esNumero) ? cortes : null;
};
