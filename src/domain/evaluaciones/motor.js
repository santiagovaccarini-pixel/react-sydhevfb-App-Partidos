import { categoriaPorCodigo } from "./categorias.js";
import { esVacio, subtotal } from "./excel.js";
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
// el Excel) y `calcularFila({ entrada, numero, total, anterior, referencias,
// esCategoria })`; anterior(clave) es esa medida en la evaluación anterior
// del jugador que la tenga (sin límite de cuántas atrás: Santiago, 05/10).
// esCategoria(codigo): si la Selección es una de la lista (la del Excel o
// una que sumó el club en Ajustes).
const esCategoriaDelExcel = (codigo) => Boolean(categoriaPorCodigo(codigo));

export const calcularFilas = (test, filas, referencias, { esCategoria = esCategoriaDelExcel } = {}) => {
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
        if (!esVacio(previas[i][clave])) return previas[i][clave];
      }
      return null;
    };
    const calculadas = test.calcularFila({ entrada, numero: previas.length + 1, total: totales.get(quien), anterior, referencias, esCategoria });
    // La anterior también con lo calculado: hay % de mejora sobre una
    // columna calculada (en Curl Nórdico, sobre la fuerza relativa).
    previas.push({ ...entrada, ...calculadas });
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

// Paso 2 entero, con las filas que se ven ({ id, celdas }) y la categoría
// del "Vs …": el informe del test (sus filas, cada celda con valor y
// formato), los colores de cada fila y los de la fila de la comparación. Lo
// usan la Base y los reportes: lo mismo se calcula igual en los dos.
export const vistaDeFilas = (test, filasVista, referencias, comparar) => {
  const est = estadisticas(test.columnasDelInforme, filasVista.map((fila) => fila.celdas));
  // El test recibe también las filas que se ven, para lo que no es SUBTOTAL
  // (en Curl Nórdico, cuántas PD / PI hay con el filtro).
  const informe = test.informe({ est, referencias, comparar, filas: filasVista.map((fila) => fila.celdas) });
  const estilos = estilosDeFilas(test.reglas, filasVista, est);
  const comparacion = informe.find((fila) => fila.id === "comparacion");
  const estilosComparacion = comparacion
    ? estilosDeUnaFila(test.reglasDelInforme, Object.fromEntries(Object.entries(comparacion.celdas).map(([clave, celda]) => [clave, celda.valor])))
    : {};
  return { est, informe, estilos, estilosComparacion };
};
