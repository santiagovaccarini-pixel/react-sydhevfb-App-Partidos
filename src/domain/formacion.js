/**
 * La formación sobre la cancha: cuántos van en cada línea, quién ocupa cada
 * puesto y dónde quedó cada uno si lo corriste a mano.
 *
 * La cancha se dibuja vertical, con nuestro arco abajo: un `y` chico está más
 * cerca del arco rival. Por eso la franja de defensa tiene los números más
 * altos y la de ataque los más bajos.
 */

export const MAXIMO_EN_CANCHA = 10;

// El `rol` es el que se le carga a cada jugador en Ajustes › Posiciones, y es
// lo que decide a quién ofrece el desplegable de cada línea. Va aparte del
// nombre a propósito: cambiarle el título a una franja no tiene por qué
// romper el filtro.
export const FRANJAS = [
  { id: "def", nombre: "Defensa", rol: "Defensa", desde: 67, hasta: 85 },
  { id: "med", nombre: "Mediocampo", rol: "Mediocampo", desde: 39, hasta: 59 },
  { id: "ata", nombre: "Ataque", rol: "Ataque", desde: 12, hasta: 29 },
];

export const LINEAS_POR_DEFECTO = { def: 4, med: 4, ata: 2 };

// Lo que ocupa un puesto movido a mano. Sin fila que lo limite necesita un
// tope propio para que un nombre largo no se desborde de la cancha.
const ANCHO_A_MANO = 26;

const entre = (valor, minimo, maximo) =>
  Math.min(maximo, Math.max(minimo, valor));

/**
 * Reparte N puestos dentro de una franja. Hasta cuatro entran en una línea; de
 * cinco en adelante se abren en dos, con la fila más numerosa atrás: cinco
 * defensores son tres centrales y dos carrileros adelantados, no al revés.
 */
export const repartirFranja = (cantidad, franja) => {
  if (!cantidad || cantidad < 1) return [];

  const filas =
    cantidad <= 4
      ? [cantidad]
      : [Math.floor(cantidad / 2), Math.ceil(cantidad / 2)];

  const puntos = [];

  filas.forEach((enLaFila, fila) => {
    const y =
      filas.length === 1
        ? (franja.desde + franja.hasta) / 2
        : franja.desde +
          ((franja.hasta - franja.desde) * fila) / (filas.length - 1);

    // La fila se abre hacia las líneas de banda en vez de repartir el ancho en
    // partes iguales con aire de sobra a los costados: una línea de cuatro se
    // estira como en la cancha y a cada nombre le queda un 15% más de lugar.
    const paso = 100 / (enLaFila + 0.4);
    // Y ninguno puede pasar de lo suyo, si no dos nombres largos se pisan.
    const ancho = paso - 1.5;

    for (let lugar = 0; lugar < enLaFila; lugar += 1) {
      puntos.push({ x: 50 + (lugar - (enLaFila - 1) / 2) * paso, y, ancho });
    }
  });

  return puntos;
};

const lineasNormalizadas = (lineas) => {
  const limpias = {};
  let acumulado = 0;

  FRANJAS.forEach((franja) => {
    const pedido = Number(lineas?.[franja.id]);
    const cantidad = Number.isFinite(pedido)
      ? Math.max(0, Math.trunc(pedido))
      : 0;
    // El tope es de los tres juntos: si una línea se pasa, se recorta acá y no
    // al dibujar, para que lo guardado y lo que se ve sean lo mismo.
    const cabe = Math.min(cantidad, MAXIMO_EN_CANCHA - acumulado);
    limpias[franja.id] = cabe;
    acumulado += cabe;
  });

  return limpias;
};

const posicionGuardada = (puesto) => {
  const x = Number(puesto?.x);
  const y = Number(puesto?.y);
  return Number.isFinite(x) && Number.isFinite(y)
    ? { x: entre(x, 0, 100), y: entre(y, 0, 100) }
    : null;
};

/**
 * Deja la formación con la forma que espera la app, venga de la base, de un
 * registro viejo sin cancha o de nada.
 */
export const normalizarCancha = (cancha) => {
  const lineas = lineasNormalizadas(cancha?.lineas || LINEAS_POR_DEFECTO);
  const puestos = {};

  FRANJAS.forEach((franja) => {
    for (let indice = 0; indice < lineas[franja.id]; indice += 1) {
      const id = `${franja.id}-${indice}`;
      const guardado = cancha?.puestos?.[id];
      const nombre = String(guardado?.nombre || "").trim();
      const aMano = posicionGuardada(guardado);

      // Un puesto sin nada que guardar no ocupa lugar en el JSON.
      if (nombre || aMano)
        puestos[id] = { ...(nombre ? { nombre } : {}), ...(aMano || {}) };
    }
  });

  return { lineas, puestos };
};

export const totalEnCancha = (cancha) =>
  FRANJAS.reduce(
    (suma, franja) => suma + (cancha?.lineas?.[franja.id] || 0),
    0,
  );

/**
 * Los puestos ya ubicados y listos para dibujar, en orden de defensa a ataque.
 */
export const puestosDeCancha = (cancha) => {
  const { lineas, puestos } = normalizarCancha(cancha);
  const lugares = [];

  FRANJAS.forEach((franja) => {
    repartirFranja(lineas[franja.id], franja).forEach((punto, indice) => {
      const id = `${franja.id}-${indice}`;
      const guardado = puestos[id] || {};
      const aMano = posicionGuardada(guardado);

      lugares.push({
        id,
        franja: franja.id,
        numero: lugares.length + 1,
        nombre: guardado.nombre || "",
        aMano: Boolean(aMano),
        x: aMano ? aMano.x : punto.x,
        y: aMano ? aMano.y : punto.y,
        ancho: aMano ? ANCHO_A_MANO : punto.ancho,
      });
    });
  });

  return lugares;
};

export const titularesDeCancha = (cancha) =>
  puestosDeCancha(cancha).map((puesto) => puesto.nombre);

/**
 * Para un registro viejo, que tiene titulares pero todavía no tiene cancha:
 * los acomoda en la formación por defecto respetando el orden en que estaban.
 */
export const canchaDesdeTitulares = (titulares) => {
  const nombres = (titulares || []).map((nombre) =>
    String(nombre || "").trim(),
  );
  const lineas = lineasNormalizadas(LINEAS_POR_DEFECTO);
  const puestos = {};
  let leidos = 0;

  FRANJAS.forEach((franja) => {
    for (let indice = 0; indice < lineas[franja.id]; indice += 1) {
      const nombre = nombres[leidos];
      leidos += 1;
      if (nombre) puestos[`${franja.id}-${indice}`] = { nombre };
    }
  });

  return { lineas, puestos };
};

/** Pone (o saca, con cadena vacía) un jugador en un puesto. */
export const ponerJugador = (cancha, id, nombre) => {
  const { lineas, puestos } = normalizarCancha(cancha);
  const limpio = String(nombre || "").trim();
  const resto = { ...puestos };
  const anterior = resto[id] || {};

  // Nadie puede estar dos veces en la cancha: si ya estaba en otro puesto, se
  // va de aquel.
  if (limpio) {
    Object.keys(resto).forEach((otro) => {
      if (otro !== id && resto[otro]?.nombre === limpio) {
        const { nombre: _quitado, ...posicion } = resto[otro];
        if (Object.keys(posicion).length) resto[otro] = posicion;
        else delete resto[otro];
      }
    });
  }

  const { nombre: _viejo, ...posicion } = anterior;
  const nuevo = { ...(limpio ? { nombre: limpio } : {}), ...posicion };

  if (Object.keys(nuevo).length) resto[id] = nuevo;
  else delete resto[id];

  return { lineas, puestos: resto };
};

/** Deja un puesto donde lo soltaste. */
export const moverPuesto = (cancha, id, x, y) => {
  const { lineas, puestos } = normalizarCancha(cancha);

  return {
    lineas,
    puestos: {
      ...puestos,
      [id]: {
        ...(puestos[id] || {}),
        x: entre(x, 0, 100),
        y: entre(y, 0, 100),
      },
    },
  };
};

/**
 * Suma o resta lugares en una línea. Lo que habías movido a mano en esa línea
 * vuelve a la grilla, porque las posiciones ya no son las mismas; lo de las
 * otras dos queda donde estaba.
 */
export const cambiarLinea = (cancha, franja, paso) => {
  const { lineas, puestos } = normalizarCancha(cancha);
  const pedido = (lineas[franja] || 0) + paso;

  if (pedido < 0) return { lineas, puestos };
  if (paso > 0 && totalEnCancha({ lineas }) >= MAXIMO_EN_CANCHA) {
    return { lineas, puestos };
  }

  const nuevos = {};
  Object.keys(puestos).forEach((id) => {
    if (!id.startsWith(`${franja}-`)) {
      nuevos[id] = puestos[id];
      return;
    }

    const { x: _x, y: _y, ...sinPosicion } = puestos[id];
    if (sinPosicion.nombre) nuevos[id] = sinPosicion;
  });

  return normalizarCancha({
    lineas: { ...lineas, [franja]: pedido },
    puestos: nuevos,
  });
};

/** Devuelve todos los puestos a la grilla, sin tocar los nombres. */
export const reacomodarCancha = (cancha) => {
  const { lineas, puestos } = normalizarCancha(cancha);
  const nuevos = {};

  Object.keys(puestos).forEach((id) => {
    if (puestos[id].nombre) nuevos[id] = { nombre: puestos[id].nombre };
  });

  return { lineas, puestos: nuevos };
};

export const hayPuestosAMano = (cancha) =>
  puestosDeCancha(cancha).some((puesto) => puesto.aMano);

/** Cómo se escribe la formación: 4-4-2, 5-3-2, etc. */
export const nombreDeFormacion = (cancha) => {
  const { lineas } = normalizarCancha(cancha);
  return FRANJAS.map((franja) => lineas[franja.id]).join("-");
};

/** En la cancha entra el apellido; el nombre completo queda en la lista. */
/**
 * Los del plantel que juegan en esa línea. Un jugador puede tener más de un
 * rol, así que puede aparecer en varias.
 */
export const jugadoresDeLaFranja = (plantel, franjaId) => {
  const franja = FRANJAS.find((una) => una.id === franjaId);
  if (!franja) return [];

  return (plantel || []).filter((jugador) =>
    (jugador?.roles || []).includes(franja.rol),
  );
};

export const apellido = (nombre) =>
  String(nombre || "")
    .trim()
    .split(/\s+/)
    .pop() || "";
