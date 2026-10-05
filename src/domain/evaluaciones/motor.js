import { esBlanco, subtotal } from "./excel.js";
import { cssDeEstilo, estiloDeCelda, ordenarReglas } from "./formatoCondicional.js";

// Lo común a todos los tests del Excel de evaluaciones, en dos pasos, como
// en la hoja:
//   1. Cada fila con lo que el Excel calcula de ella, mirando todas las
//      filas del test (el n° de evaluación del jugador, su evaluación
//      anterior, cuántas tiene). No depende del filtro.
//   2. El informe de arriba (promedio, desvío, n, máximo y mínimo, como
//      SUBTOTAL) y los colores, con las filas que deja ver el filtro.
// Lo propio de cada test (columnas, fórmulas, informe y reglas de color)
// está en su archivo de tests/.

// Quién es cada evaluado: el jugador de Datos básicos o, si no está, el
// nombre (sin importar mayúsculas ni espacios de más), como en Lesiones.
export const quienEs = (fila) =>
  fila?.jugador_id
    ? `j:${fila.jugador_id}`
    : `p:${String(fila?.persona ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase()}`;

// El orden de las filas, que en el Excel decide cuál es la evaluación
// anterior y el n° de evaluación: por fecha (las sin fecha, al final) y, con
// la misma fecha, en el orden en que se cargaron (Santiago, 05/10: en el
// Excel era el lugar de la fila; hoy da lo mismo, la hoja está por fecha).
export const ordenDelExcel = (filas) =>
  [...(filas || [])].sort((a, b) => {
    const fechaA = a.fecha || "";
    const fechaB = b.fecha || "";
    if (fechaA !== fechaB) {
      if (!fechaA) return 1;
      if (!fechaB) return -1;
      return fechaA < fechaB ? -1 : 1;
    }
    return Number(a.orden ?? 0) - Number(b.orden ?? 0);
  });

// Paso 1. Devuelve las filas en el orden del Excel: { fila, quien, celdas }.
// En `celdas` está lo cargado (en la unidad del Excel) y lo calculado, por
// clave de columna. El test da `entrada(fila)` (lo cargado, como lo cuenta
// el Excel) y `calcularFila({ entrada, numero, total, anterior, referencias })`;
// anterior(clave) es esa medida en la evaluación anterior del jugador que la
// tenga (sin límite de cuántas atrás: Santiago, 05/10).
export const calcularFilas = (test, filas, referencias) => {
  const ordenadas = ordenDelExcel(filas);
  const totales = new Map();
  ordenadas.forEach((fila) => {
    const quien = quienEs(fila);
    totales.set(quien, (totales.get(quien) || 0) + 1);
  });
  const anteriores = new Map();
  return ordenadas.map((fila) => {
    const quien = quienEs(fila);
    const previas = anteriores.get(quien) || [];
    const entrada = test.entrada(fila);
    const anterior = (clave) => {
      for (let i = previas.length - 1; i >= 0; i -= 1) {
        if (!esBlanco(previas[i][clave])) return previas[i][clave];
      }
      return null;
    };
    const calculadas = test.calcularFila({ entrada, numero: previas.length + 1, total: totales.get(quien), anterior, referencias });
    previas.push(entrada);
    anteriores.set(quien, previas);
    return { fila, quien, celdas: { ...entrada, ...calculadas } };
  });
};

// Paso 2. Las estadísticas de cada columna del informe con las filas que se
// ven: { clave: { promedio, desvio, n, maximo, minimo } }.
export const estadisticas = (columnas, celdasVisibles) =>
  Object.fromEntries(
    columnas.map((clave) => {
      const valores = celdasVisibles.map((celdas) => celdas[clave]);
      return [
        clave,
        {
          promedio: subtotal(1, valores),
          desvio: subtotal(7, valores),
          n: subtotal(2, valores),
          maximo: subtotal(4, valores),
          minimo: subtotal(5, valores),
        },
      ];
    }),
  );

const reglasOrdenadas = new WeakMap();
const ordenadasDe = (reglas) => {
  if (!reglasOrdenadas.has(reglas)) reglasOrdenadas.set(reglas, ordenarReglas(reglas));
  return reglasOrdenadas.get(reglas);
};

// Las columnas que alguna regla pinta.
const columnasConReglas = (reglas) => [...new Set(reglas.flatMap((regla) => regla.columnas))];

// Los colores de las filas que se ven: { id de la fila: { clave: css } }.
// filas: [{ id, celdas }]; est: las estadísticas de esas mismas filas.
export const estilosDeFilas = (reglas, filas, est) => {
  const ordenadas = ordenadasDe(reglas);
  const columnas = columnasConReglas(ordenadas);
  const estilos = {};
  filas.forEach(({ id, celdas }) => {
    const deLaFila = {};
    columnas.forEach((clave) => {
      const css = cssDeEstilo(
        estiloDeCelda(ordenadas, clave, {
          clave,
          valor: celdas[clave],
          celda: (otra) => celdas[otra],
          promedio: est[clave]?.promedio,
          desvio: est[clave]?.desvio,
        }),
      );
      if (css) deLaFila[clave] = css;
    });
    estilos[id] = deLaFila;
  });
  return estilos;
};

// Los colores de una fila del informe (sus celdas: { clave: valor }).
export const estilosDeUnaFila = (reglas, celdas) => {
  const ordenadas = ordenadasDe(reglas);
  return Object.fromEntries(
    columnasConReglas(ordenadas)
      .map((clave) => [clave, cssDeEstilo(estiloDeCelda(ordenadas, clave, { clave, valor: celdas[clave], celda: (otra) => celdas[otra] }))])
      .filter(([, css]) => css),
  );
};
