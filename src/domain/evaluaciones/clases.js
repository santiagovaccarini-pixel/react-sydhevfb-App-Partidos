import { esError, esNumero, mayor, mayorIgual, menor, menorIgual } from "./excel.js";

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

// O y Y de Excel: si alguno es un error, el resultado es el error.
const o = (...valores) => valores.find(esError) || valores.some(Boolean);
const y = (...valores) => valores.find(esError) || valores.every(Boolean);

// El ratio, a los dos lados (de 1 a 3: lo mejor es estar cerca del Bueno):
// IF(OR(x>=Exc,x<=Malo),1,IF(OR(x>=MB,x<=Reg),2,IF(AND(x>Reg,x<MB),3,""))).
// En Isocinecia el último es OR(x<MB,x>Reg): después de los dos primeros, da
// lo mismo.
export const claseRatio = (valor, [excelente, muyBueno, , regular, malo]) => {
  const uno = o(mayorIgual(valor, excelente), menorIgual(valor, malo));
  if (esError(uno)) return uno;
  if (uno) return 1;
  const dos = o(mayorIgual(valor, muyBueno), menorIgual(valor, regular));
  if (esError(dos)) return dos;
  if (dos) return 2;
  const tres = y(mayor(valor, regular), menor(valor, muyBueno));
  if (esError(tres)) return tres;
  return tres ? 3 : "";
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
