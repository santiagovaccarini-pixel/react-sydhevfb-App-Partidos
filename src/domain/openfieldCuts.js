const MILISEGUNDOS_SEGUNDO = 1000;

const asegurarFecha = (valor, etiqueta) => {
  const fecha = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`${etiqueta} no es una fecha/hora válida.`);
  }
  return fecha;
};

const ordenarPorInicio = (a, b) => a.inicio.getTime() - b.inicio.getTime();

export const prepararCorteOpenField = ({ nombre, inicio, fin, pausas = [] }) => {
  const inicioFecha = asegurarFecha(inicio, "El inicio");
  const finFecha = asegurarFecha(fin, "El fin");

  if (finFecha <= inicioFecha) {
    throw new Error("El fin de la tarea debe ser posterior al inicio.");
  }

  const pausasNormalizadas = pausas
    .map((pausa, indice) => {
      const pausaInicio = asegurarFecha(
        pausa.inicio,
        `El inicio de la pausa ${indice + 1}`,
      );
      const pausaFin = asegurarFecha(
        pausa.fin,
        `El fin de la pausa ${indice + 1}`,
      );

      if (pausaFin <= pausaInicio) {
        throw new Error(`La pausa ${indice + 1} debe terminar después de comenzar.`);
      }

      if (pausaInicio < inicioFecha || pausaFin > finFecha) {
        throw new Error(`La pausa ${indice + 1} está fuera de los límites de la tarea.`);
      }

      return { inicio: pausaInicio, fin: pausaFin };
    })
    .sort(ordenarPorInicio);

  for (let i = 1; i < pausasNormalizadas.length; i += 1) {
    if (pausasNormalizadas[i].inicio < pausasNormalizadas[i - 1].fin) {
      throw new Error(`Las pausas ${i} y ${i + 1} se superponen.`);
    }
  }

  const duracionBrutaMs = finFecha.getTime() - inicioFecha.getTime();
  const pausaMs = pausasNormalizadas.reduce(
    (total, pausa) => total + pausa.fin.getTime() - pausa.inicio.getTime(),
    0,
  );

  return {
    nombre: String(nombre || "").trim(),
    inicio: inicioFecha,
    fin: finFecha,
    pausas: pausasNormalizadas,
    duracionBrutaSegundos: duracionBrutaMs / MILISEGUNDOS_SEGUNDO,
    pausasSegundos: pausaMs / MILISEGUNDOS_SEGUNDO,
    duracionEfectivaSegundos:
      (duracionBrutaMs - pausaMs) / MILISEGUNDOS_SEGUNDO,
  };
};

export const segmentosActivos = (corte) => {
  const tarea = prepararCorteOpenField(corte);
  const segmentos = [];
  let cursor = tarea.inicio;

  tarea.pausas.forEach((pausa) => {
    if (cursor < pausa.inicio) {
      segmentos.push({ inicio: new Date(cursor), fin: new Date(pausa.inicio) });
    }
    cursor = pausa.fin;
  });

  if (cursor < tarea.fin) {
    segmentos.push({ inicio: new Date(cursor), fin: new Date(tarea.fin) });
  }

  return segmentos;
};

export const timestampAPosicionTimeline = ({
  timestamp,
  visibleInicio,
  visibleFin,
  xInicio,
  xFin,
}) => {
  const objetivo = asegurarFecha(timestamp, "El timestamp objetivo").getTime();
  const inicio = asegurarFecha(visibleInicio, "El inicio visible").getTime();
  const fin = asegurarFecha(visibleFin, "El fin visible").getTime();

  if (fin <= inicio) {
    throw new Error("El rango temporal visible de OpenField no es válido.");
  }

  if (!Number.isFinite(xInicio) || !Number.isFinite(xFin) || xFin <= xInicio) {
    throw new Error("Los límites visuales de la timeline no son válidos.");
  }

  if (objetivo < inicio || objetivo > fin) {
    throw new Error("El timestamp está fuera del rango visible de la timeline.");
  }

  const proporcion = (objetivo - inicio) / (fin - inicio);
  return xInicio + proporcion * (xFin - xInicio);
};

export const compararCorteConOpenField = ({ esperado, encontrado, toleranciaMs = 0 }) => {
  const esperadoNormalizado = prepararCorteOpenField(esperado);
  const encontradoNormalizado = prepararCorteOpenField(encontrado);

  const diferenciaInicioMs = Math.abs(
    encontradoNormalizado.inicio.getTime() - esperadoNormalizado.inicio.getTime(),
  );
  const diferenciaFinMs = Math.abs(
    encontradoNormalizado.fin.getTime() - esperadoNormalizado.fin.getTime(),
  );

  const pausasCoinciden =
    esperadoNormalizado.pausas.length === encontradoNormalizado.pausas.length &&
    esperadoNormalizado.pausas.every((pausa, indice) => {
      const otra = encontradoNormalizado.pausas[indice];
      return (
        Math.abs(otra.inicio.getTime() - pausa.inicio.getTime()) <= toleranciaMs &&
        Math.abs(otra.fin.getTime() - pausa.fin.getTime()) <= toleranciaMs
      );
    });

  return {
    valido:
      diferenciaInicioMs <= toleranciaMs &&
      diferenciaFinMs <= toleranciaMs &&
      pausasCoinciden,
    diferenciaInicioMs,
    diferenciaFinMs,
    pausasCoinciden,
  };
};
