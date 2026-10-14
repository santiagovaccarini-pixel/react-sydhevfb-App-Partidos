// Los cambios de los valores de referencia (V.R.), para el historial de la
// solapa «Valores de referencia» de cada base (Santiago, 14/10: «Sí, con
// volver atrás»). La base anota cada cambio con cómo estaba la fila y cómo
// quedó (migración 20261025_referencias_editables.sql); acá se ve qué
// cambió, para mostrarlo y para volver atrás.

const esObjeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);

// Igual, sin importar el orden de las claves (la base no lo guarda).
export const iguales = (a, b) => {
  if (a === b) return true;
  if (esObjeto(a) && esObjeto(b)) {
    const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...claves].every((clave) => iguales(a[clave], b[clave]));
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((uno, i) => iguales(uno, b[i]));
  return false;
};

// Qué cambió entre dos valores: [{ ruta, antes, despues }]. Se entra en los
// objetos que están en los dos lados; un objeto que aparece o se va entero
// (una categoría que se suma o se borra) es un solo cambio. Lo que no está,
// null.
export const diferencias = (antes, despues, ruta = []) => {
  if (esObjeto(antes) && esObjeto(despues)) {
    const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];
    return claves.flatMap((clave) => diferencias(antes[clave], despues[clave], [...ruta, clave]));
  }
  const a = antes === undefined ? null : antes;
  const d = despues === undefined ? null : despues;
  return iguales(a, d) ? [] : [{ ruta, antes: a, despues: d }];
};

// Lo que la base pone sola (no es un cambio de los V.R.).
const NO_CUENTAN = ["id", "equipo_id", "actualizado_en"];
const sinLoDeLaBase = (fila) => Object.fromEntries(Object.entries(esObjeto(fila) ? fila : {}).filter(([clave]) => !NO_CUENTAN.includes(clave)));

// Qué cambió en una entrada del historial que dice «editada».
export const cambiosDeEntrada = (entrada) => (entrada?.accion === "editada" ? diferencias(sinLoDeLaBase(entrada.antes), sinLoDeLaBase(entrada.despues)) : []);

// Una entrada del historial como la devuelve la base.
export const normalizarEntrada = (fila) => ({
  id: fila?.id ?? null,
  tabla: fila?.tabla || "",
  filaId: fila?.fila_id ?? null,
  accion: ["creada", "editada", "borrada"].includes(fila?.accion) ? fila.accion : "editada",
  quien: String(fila?.quien_email || ""),
  cuando: fila?.cuando || null,
  antes: esObjeto(fila?.antes) ? fila.antes : null,
  despues: esObjeto(fila?.despues) ? fila.despues : null,
});
