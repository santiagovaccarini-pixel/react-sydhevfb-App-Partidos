// Lógica pura sobre períodos de OpenField: normalización con centésimas,
// participantes, huella del estado y comparación esperado vs. real.
// Sin red: la usan periods.js, snapshot.js y, más adelante, la escritura.

// OpenField guarda cada tiempo como segundos Unix + centésimas (0-99).
// La resolución real es 10 ms: cualquier comparación exacta se hace sobre
// esa suma y nunca sobre start_time solo, que trunca al segundo.
export const RESOLUCION_MS = 10;

export const centesimas = (valor) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 && numero < 100 ? numero : null;
};

export const aMilisegundos = (segundos, centi) => {
  const base = Number(segundos);
  if (!Number.isFinite(base)) return null;
  return base * 1000 + (centesimas(centi) ?? 0) * RESOLUCION_MS;
};

export const alineadoACentesimas = (ms) => Number.isInteger(ms) && ms % RESOLUCION_MS === 0;

export const limpiarPeriodo = (periodo) => {
  const startMs = aMilisegundos(periodo?.start_time, periodo?.start_centiseconds);
  const endMs = aMilisegundos(periodo?.end_time, periodo?.end_centiseconds);
  const duracionValida = startMs !== null && endMs !== null && endMs >= startMs;

  return {
    id: String(periodo?.id || ""),
    name: String(periodo?.name || periodo?.period_name || "Sin nombre"),
    start_time: periodo?.start_time ?? null,
    end_time: periodo?.end_time ?? null,
    start_centiseconds: centesimas(periodo?.start_centiseconds),
    end_centiseconds: centesimas(periodo?.end_centiseconds),
    start_ms: startMs,
    end_ms: endMs,
    duration_seconds: duracionValida ? (endMs - startMs) / 1000 : null,
    // Los períodos forman un árbol (nested set): lft/rgt ordenan padres e hijos.
    period_depth_id: periodo?.period_depth_id ?? null,
    lft: periodo?.lft ?? null,
    rgt: periodo?.rgt ?? null,
    is_deleted: periodo?.is_deleted === true || periodo?.is_deleted === 1,
    modified_at: periodo?.modified_at ?? null,
  };
};

export const ordenarPeriodos = (a, b) =>
  Number(a.start_ms || 0) - Number(b.start_ms || 0) || Number(a.lft || 0) - Number(b.lft || 0);

export const nombreAtleta = (atleta) => {
  const completo = [atleta?.first_name, atleta?.last_name]
    .map((valor) => String(valor || "").trim())
    .filter(Boolean)
    .join(" ");

  return completo || String(atleta?.nickname || "").trim() || String(atleta?.id || "");
};

export const limpiarAtleta = (atleta) => ({
  id: String(atleta?.id || ""),
  nombre: nombreAtleta(atleta),
  jersey: atleta?.jersey ?? null,
});

const idsOrdenados = (atletas) =>
  (Array.isArray(atletas) ? atletas : [])
    .map((atleta) => String(atleta?.id || ""))
    .filter(Boolean)
    .sort();

const mismosIds = (a, b) => {
  const x = idsOrdenados(a);
  const y = idsOrdenados(b);
  return x.length === y.length && x.every((valor, indice) => valor === y[indice]);
};

const activos = (snapshot) =>
  (Array.isArray(snapshot?.periods) ? snapshot.periods : []).filter(
    (periodo) => periodo?.id && !periodo.is_deleted,
  );

// Huella determinística del estado: mismos períodos (nombre, tiempos con
// centésimas y participantes) → misma huella, sin importar el orden. Sirve
// para detectar que alguien editó la actividad entre tomar el snapshot y
// escribir.
export const huellaSnapshot = (snapshot) =>
  activos(snapshot)
    .map(
      (periodo) =>
        `${periodo.id}|${periodo.name}|${periodo.start_ms}|${periodo.end_ms}|${idsOrdenados(
          periodo.athletes,
        ).join(",")}`,
    )
    .sort()
    .join("\n");

const resumirPeriodo = (periodo) => ({
  id: periodo.id,
  name: periodo.name,
  start_ms: periodo.start_ms,
  end_ms: periodo.end_ms,
});

export const compararSnapshots = (antes, despues) => {
  const previos = new Map(activos(antes).map((periodo) => [periodo.id, periodo]));
  const actuales = new Map(activos(despues).map((periodo) => [periodo.id, periodo]));

  const agregados = [...actuales.values()].filter((periodo) => !previos.has(periodo.id));
  const eliminados = [...previos.values()].filter((periodo) => !actuales.has(periodo.id));
  const modificados = [];
  let iguales = 0;

  previos.forEach((previo, id) => {
    const actual = actuales.get(id);
    if (!actual) return;

    const cambios = {};
    if (previo.name !== actual.name) cambios.name = { antes: previo.name, despues: actual.name };
    if (previo.start_ms !== actual.start_ms) {
      cambios.start_ms = { antes: previo.start_ms, despues: actual.start_ms };
    }
    if (previo.end_ms !== actual.end_ms) {
      cambios.end_ms = { antes: previo.end_ms, despues: actual.end_ms };
    }
    // Sin participantes leídos de algún lado no se puede afirmar un cambio.
    if (
      Array.isArray(previo.athletes) &&
      Array.isArray(actual.athletes) &&
      !mismosIds(previo.athletes, actual.athletes)
    ) {
      cambios.athletes = {
        antes: idsOrdenados(previo.athletes),
        despues: idsOrdenados(actual.athletes),
      };
    }

    if (Object.keys(cambios).length > 0) {
      modificados.push({ id, name: actual.name, cambios });
    } else {
      iguales += 1;
    }
  });

  return {
    agregados: agregados.map(resumirPeriodo),
    eliminados: eliminados.map(resumirPeriodo),
    modificados,
    iguales,
    sinCambios: agregados.length === 0 && eliminados.length === 0 && modificados.length === 0,
  };
};

// Comprueba, sobre un snapshot releído de OpenField, que el corte pedido quedó
// escrito exactamente: mismo nombre, mismo inicio y fin a la centésima y, si
// se pidieron, los mismos participantes. Tolerancia 0.
export const validarCorteEscrito = ({ snapshot, esperado }) => {
  const nombre = String(esperado?.nombre || "").trim();
  const inicioMs = Number(esperado?.inicioMs);
  const finMs = Number(esperado?.finMs);
  const problemas = [];

  if (!nombre) problemas.push("El corte esperado no tiene nombre.");

  if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs) || finMs <= inicioMs) {
    problemas.push("El corte esperado no tiene un inicio y un fin válidos.");
  } else {
    if (!alineadoACentesimas(inicioMs)) {
      problemas.push(
        `El inicio esperado no está alineado a centésimas: OpenField resuelve de a ${RESOLUCION_MS} ms.`,
      );
    }
    if (!alineadoACentesimas(finMs)) {
      problemas.push(
        `El fin esperado no está alineado a centésimas: OpenField resuelve de a ${RESOLUCION_MS} ms.`,
      );
    }
  }

  if (snapshot?.incompleto) {
    problemas.push("El snapshot está incompleto: faltan participantes de algún período.");
  }

  if (problemas.length > 0) {
    return { valido: false, motivo: "esperado-invalido", problemas };
  }

  const candidatos = activos(snapshot).filter((periodo) => periodo.name === nombre);

  if (candidatos.length === 0) {
    return {
      valido: false,
      motivo: "no-encontrado",
      problemas: [`OpenField no tiene ningún período llamado "${nombre}".`],
      candidatos: 0,
    };
  }

  const exactos = candidatos.filter(
    (periodo) => periodo.start_ms === inicioMs && periodo.end_ms === finMs,
  );
  const elegido =
    exactos[0] ||
    [...candidatos].sort(
      (a, b) => Math.abs(a.start_ms - inicioMs) - Math.abs(b.start_ms - inicioMs),
    )[0];

  const diferenciaInicioMs = elegido.start_ms - inicioMs;
  const diferenciaFinMs = elegido.end_ms - finMs;
  const idsEsperados = Array.isArray(esperado?.athleteIds)
    ? esperado.athleteIds.map(String).sort()
    : null;

  let participantes = null;
  if (idsEsperados) {
    const reales = idsOrdenados(elegido.athletes);
    participantes = {
      faltantes: idsEsperados.filter((id) => !reales.includes(id)),
      sobrantes: reales.filter((id) => !idsEsperados.includes(id)),
    };
  }

  const tiemposOk = diferenciaInicioMs === 0 && diferenciaFinMs === 0;
  const participantesOk =
    !participantes ||
    (participantes.faltantes.length === 0 && participantes.sobrantes.length === 0);
  const duplicado = exactos.length > 1;

  const detalle = [];
  if (!tiemposOk) {
    detalle.push(
      `El inicio difiere ${diferenciaInicioMs} ms y el fin ${diferenciaFinMs} ms respecto de lo pedido.`,
    );
  }
  if (!participantesOk) {
    detalle.push(
      `Participantes: faltan ${participantes.faltantes.length} y sobran ${participantes.sobrantes.length}.`,
    );
  }
  if (duplicado) {
    detalle.push(
      `Hay ${exactos.length} períodos idénticos llamados "${nombre}": el corte se escribió más de una vez.`,
    );
  }

  const valido = tiemposOk && participantesOk && !duplicado;

  return {
    valido,
    motivo: valido ? "ok" : duplicado ? "duplicado" : "diferencias",
    periodo: resumirPeriodo(elegido),
    diferenciaInicioMs,
    diferenciaFinMs,
    participantes,
    candidatos: candidatos.length,
    problemas: detalle,
  };
};
