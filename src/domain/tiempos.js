import {
  calcularNoIngresaron,
  esFormatoHoraReal,
  limpiarLista,
  normalizarTexto,
  normalizarTextoBase,
  segundosEntre,
} from "./match";

export const PERIODOS_BASE = ["PT", "ST"];
export const PERIODOS_PRORROGA = ["PTE", "STE"];

export const periodosDelRegistro = (registro) =>
  registro?.prorrogaActiva
    ? [...PERIODOS_BASE, ...PERIODOS_PRORROGA]
    : [...PERIODOS_BASE];

const hayDato = (valor) => String(valor ?? "").trim() !== "";

/**
 * Pone los tiempos uno detrás del otro en una sola recta, medida en segundos
 * desde el arranque del primer tiempo. El entretiempo no ocupa lugar: el
 * segundo tiempo empieza justo donde terminó el primero.
 *
 * Con eso, una cuenta que cruza de un tiempo al otro —un jugador que entró en
 * el primero y salió en el segundo— sale de una resta, sin casos especiales.
 */
export const lineaDeTiempo = (registro) => {
  let acumulado = 0;

  return periodosDelRegistro(registro)
    .map((tipo) => ({
      tipo,
      inicio: registro?.[`inicio${tipo}`] || "",
      final: registro?.[`final${tipo}`] || "",
    }))
    .filter((periodo) => hayDato(periodo.inicio))
    .map((periodo) => {
      const duracion = segundosEntre(periodo.inicio, periodo.final) ?? 0;
      const desde = acumulado;
      acumulado += duracion;
      return { ...periodo, duracion, desde, hasta: acumulado };
    });
};

// Dónde cae una hora dentro de la recta del partido.
const momentoEnLaRecta = (periodo, hora) => {
  if (!periodo || !hayDato(hora)) return null;
  const desplazamiento = segundosEntre(periodo.inicio, hora);
  if (desplazamiento === null) return null;
  return periodo.desde + desplazamiento;
};

/**
 * Las paradas de un período: el VAR y la hidratación. Solo cuentan las que
 * tienen inicio y final, porque una sin cerrar no se puede medir.
 */
export const paradasDePeriodo = (registro, periodo) => {
  const vars = (registro?.[`vars${periodo.tipo}`] || []).map((evento, i) => ({
    tipo: "var",
    numero: i + 1,
    inicio: evento?.inicio || "",
    final: evento?.final || "",
  }));

  const hidratacion = {
    tipo: "hidratacion",
    numero: 0,
    inicio: registro?.[`inicioHidratacion${periodo.tipo}`] || "",
    final: registro?.[`finalHidratacion${periodo.tipo}`] || "",
  };

  return [...vars, hidratacion]
    .map((parada) => {
      const duracion = segundosEntre(parada.inicio, parada.final);
      const desde = momentoEnLaRecta(periodo, parada.inicio);
      if (duracion === null || desde === null) return null;
      return { ...parada, duracion, desde, hasta: desde + duracion };
    })
    .filter(Boolean);
};

const solapamiento = (a, b) =>
  Math.max(0, Math.min(a.hasta, b.hasta) - Math.max(a.desde, b.desde));

const descontarParadas = (tramos, paradas) =>
  tramos.reduce(
    (total, tramo) =>
      total +
      paradas.reduce((parcial, parada) => parcial + solapamiento(tramo, parada), 0),
    0,
  );

/**
 * Bruto, neto y detenido de cada tiempo y del partido entero.
 * Bruto es lo que corrió el reloj; neto le saca el VAR y la hidratación.
 */
export const resumenDeTiempos = (registro) => {
  const linea = lineaDeTiempo(registro);

  const periodos = linea.map((periodo) => {
    const paradas = paradasDePeriodo(registro, periodo);
    const detenido = paradas.reduce((total, parada) => total + parada.duracion, 0);
    return {
      ...periodo,
      paradas,
      bruto: periodo.duracion,
      detenido,
      neto: Math.max(0, periodo.duracion - detenido),
    };
  });

  const bruto = periodos.reduce((total, periodo) => total + periodo.bruto, 0);
  const detenido = periodos.reduce((total, periodo) => total + periodo.detenido, 0);

  return {
    periodos,
    total: { bruto, detenido, neto: Math.max(0, bruto - detenido) },
  };
};

const clave = (nombre) => normalizarTextoBase(nombre);

/**
 * A qué tiempo pertenece un horario. Hace falta porque las columnas de la base
 * guardan el horario del cambio pero no su período: sin esto, un cambio del
 * segundo tiempo aparecería en la lista del primero.
 *
 * Se busca el tiempo en cuya ventana cae. Si cae en el entretiempo, donde no
 * hay ninguno, se le da el último que ya había arrancado.
 */
const periodoDelHorario = (linea, hora) => {
  let anterior = null;

  for (const periodo of linea) {
    const desplazamiento = segundosEntre(periodo.inicio, hora);
    if (desplazamiento === null) continue;
    if (desplazamiento <= periodo.duracion) return periodo;
    anterior = periodo;
  }

  return anterior;
};

/**
 * Los cambios ubicados en la recta del partido y ordenados por horario.
 */
export const cambiosOrdenados = (registro, linea, lista = "cambios") =>
  (registro?.[lista] || [])
    .map((cambio, indice) => {
      const anotado = cambio?.periodo
        ? linea.find((item) => item.tipo === cambio.periodo)
        : null;
      const periodo = anotado || periodoDelHorario(linea, cambio?.hora);
      const suelto = momentoEnLaRecta(periodo, cambio?.hora);
      if (suelto === null) return null;

      // Un cambio anotado en el entretiempo cae fuera de la ventana de su
      // tiempo. Se lo lleva al borde para que no invada al siguiente: el que
      // sale jugó el tiempo entero y el que entra arranca el que viene.
      const momento = Math.min(Math.max(suelto, periodo.desde), periodo.hasta);
      return {
        indice,
        sale: cambio?.sale || "",
        entra: cambio?.entra || "",
        hora: cambio.hora,
        periodo: periodo.tipo,
        momento,
      };
    })
    .filter((cambio) => cambio && (hayDato(cambio.sale) || hayDato(cambio.entra)))
    .sort((a, b) => a.momento - b.momento);

/**
 * Cuánto jugó cada uno de los que entró o salió de cambio.
 *
 * Se recorre el partido de principio a fin llevando la cuenta de quién está en
 * cancha. Al neto de cada jugador se le descuentan solo las paradas que
 * ocurrieron mientras él estaba adentro: por eso a uno que entró faltando poco
 * no se le resta un VAR del primer tiempo.
 *
 * `periodo` acota la cuenta a un tiempo: cada tramo se recorta a esa ventana y
 * quedan afuera los que no pisaron la cancha en ese rato. Sin él se mide el
 * partido entero.
 *
 * `lista` elige de qué equipo. Del rival no se guarda la formación, solo sus
 * cambios, así que se puede medir a los que entraron o salieron pero no saber
 * quiénes fueron los demás: por eso ahí no hay fila de resto.
 */
export const tiempoJugado = (registro, opciones = {}) => {
  const { periodo: soloPeriodo = null, lista = "cambios" } = opciones;
  const linea = lineaDeTiempo(registro);
  const vacio = { jugadores: [], resto: null };
  if (linea.length === 0) return vacio;

  const finPartido = linea[linea.length - 1].hasta;
  const ventana = soloPeriodo
    ? linea.find((item) => item.tipo === soloPeriodo)
    : { desde: 0, hasta: finPartido };
  if (!ventana) return vacio;

  const paradas = linea.flatMap((periodo) => paradasDePeriodo(registro, periodo));
  const cambios = cambiosOrdenados(registro, linea, lista);

  const titulares = limpiarLista(registro?.formacion?.titulares || []);
  const tramos = new Map();
  const enCancha = new Map();
  const nombres = new Map();

  const anotar = (nombre, tramo) => {
    const id = clave(nombre);
    if (!id) return;
    if (!tramos.has(id)) tramos.set(id, []);
    tramos.get(id).push(tramo);
  };

  const recordar = (nombre) => {
    const id = clave(nombre);
    if (id && !nombres.has(id)) nombres.set(id, String(nombre).trim());
    return id;
  };

  titulares.forEach((nombre) => {
    const id = recordar(nombre);
    if (id) enCancha.set(id, 0);
  });

  // Un mismo jugador puede entrar y más tarde salir: las dos cosas quedan
  // anotadas en su ficha, y el orden es el del cambio que lo trajo a la lista.
  const participaron = new Map();
  const anotarParticipacion = (id, datos) => {
    if (!participaron.has(id)) participaron.set(id, { id });
    Object.assign(participaron.get(id), datos);
  };

  cambios.forEach((cambio) => {
    const idSale = recordar(cambio.sale);
    const idEntra = recordar(cambio.entra);

    if (idSale) {
      // Si no venía anotado —por ejemplo, porque no se cargó la formación—
      // se asume que estaba desde el arranque.
      const desde = enCancha.has(idSale) ? enCancha.get(idSale) : 0;
      anotar(cambio.sale, { desde, hasta: cambio.momento });
      enCancha.delete(idSale);
      anotarParticipacion(idSale, { salio: cambio.hora });
    }

    if (idEntra) {
      if (!enCancha.has(idEntra)) enCancha.set(idEntra, cambio.momento);
      anotarParticipacion(idEntra, { entro: cambio.hora });
    }
  });

  enCancha.forEach((desde, id) => {
    anotar(nombres.get(id) || id, { desde, hasta: finPartido });
  });

  // Cada tramo se recorta a la ventana pedida antes de medirlo.
  const medir = (tramosDelJugador) => {
    const dentro = tramosDelJugador
      .map((tramo) => ({
        desde: Math.max(tramo.desde, ventana.desde),
        hasta: Math.min(tramo.hasta, ventana.hasta),
      }))
      .filter((tramo) => tramo.hasta > tramo.desde);

    const bruto = dentro.reduce((total, tramo) => total + (tramo.hasta - tramo.desde), 0);
    return { bruto, neto: Math.max(0, bruto - descontarParadas(dentro, paradas)) };
  };

  // Los que no pisaron la cancha en la ventana no tienen nada que mostrar.
  const jugadores = [...participaron.values()]
    .map((quien) => ({
      nombre: nombres.get(quien.id) || "",
      entro: quien.entro || "",
      salio: quien.salio || "",
      ...medir(tramos.get(quien.id) || []),
    }))
    .filter((jugador) => jugador.bruto > 0);

  const completos =
    lista === "cambios"
      ? titulares.filter((nombre) => !participaron.has(clave(nombre)))
      : [];
  const completo = medir([{ desde: ventana.desde, hasta: ventana.hasta }]);

  return {
    jugadores,
    resto:
      completos.length > 0 ? { cantidad: completos.length, ...completo } : null,
  };
};

/**
 * Los cortes de todo el partido, en orden y con la etiqueta del tiempo al que
 * pertenece cada uno. Es lo que se ve cuando se mira el total.
 */
export const cortesDelPartido = (registro, lista = "cambios") =>
  periodosDelRegistro(registro).flatMap((tipo) =>
    cortesDePeriodo(registro, tipo, lista).map((corte) => ({
      ...corte,
      tiempo: tipo,
    })),
  );

/**
 * Los puntos de corte de un tiempo, en orden de horario: arranque, VAR,
 * hidratación, cambios y final. Los cambios que comparten horario van juntos.
 *
 * `lista` elige de quién son los cambios. El arranque, el VAR y la hidratación
 * son del partido, no de un equipo, así que no cambian: mirando al rival se ve
 * la misma línea con sus cambios en lugar de los nuestros.
 *
 * A diferencia de las cuentas, acá una parada sin cerrar igual se muestra: el
 * dato está y sirve para cortar, aunque no se pueda medir.
 */
export const cortesDePeriodo = (registro, tipo, lista = "cambios") => {
  const linea = lineaDeTiempo(registro);
  const periodo = linea.find((item) => item.tipo === tipo);
  if (!periodo) return [];

  const orden = (hora) => segundosEntre(periodo.inicio, hora) ?? 0;

  const paradas = [
    ...(registro?.[`vars${tipo}`] || []).map((evento, i) => ({
      clase: "var",
      etiqueta: `VAR ${i + 1}`,
      hora: evento?.inicio || "",
      hasta: evento?.final || "",
    })),
    {
      clase: "hidratacion",
      etiqueta: "Hidratación",
      hora: registro?.[`inicioHidratacion${tipo}`] || "",
      hasta: registro?.[`finalHidratacion${tipo}`] || "",
    },
  ]
    .filter((parada) => hayDato(parada.hora) || hayDato(parada.hasta))
    .map((parada) => ({
      ...parada,
      duracion: segundosEntre(parada.hora, parada.hasta),
      orden: orden(parada.hora),
    }));

  const porHorario = new Map();
  cambiosOrdenados(registro, linea, lista)
    .filter((cambio) => cambio.periodo === tipo)
    .forEach((cambio) => {
      if (!porHorario.has(cambio.hora)) {
        porHorario.set(cambio.hora, {
          clase: "cambio",
          hora: cambio.hora,
          pares: [],
          orden: cambio.momento - periodo.desde,
        });
      }
      porHorario.get(cambio.hora).pares.push({
        sale: cambio.sale,
        entra: cambio.entra,
      });
    });

  const medio = [...paradas, ...porHorario.values()].sort(
    (a, b) => a.orden - b.orden,
  );

  return [
    ...(hayDato(periodo.inicio)
      ? [{ clase: "inicio", etiqueta: `Inicio ${tipo}`, hora: periodo.inicio }]
      : []),
    ...medio,
    ...(hayDato(periodo.final)
      ? [{ clase: "final", etiqueta: `Final ${tipo}`, hora: periodo.final }]
      : []),
  ];
};

/**
 * Los cambios del rival, agrupados por horario y con el tiempo al que
 * pertenecen, para la vista que los muestra todos juntos.
 */
export const cambiosDelRival = (registro) => {
  const linea = lineaDeTiempo(registro);
  const porHorario = new Map();

  cambiosOrdenados(registro, linea, "cambiosRival").forEach((cambio) => {
    if (!porHorario.has(cambio.hora)) {
      porHorario.set(cambio.hora, {
        hora: cambio.hora,
        periodo: cambio.periodo,
        pares: [],
        orden: cambio.momento,
      });
    }
    porHorario.get(cambio.hora).pares.push({
      sale: cambio.sale,
      entra: cambio.entra,
    });
  });

  return [...porHorario.values()].sort((a, b) => a.orden - b.orden);
};

// En "en vivo" los horarios ya son reales; en transmisión también, desde que se
// guardan convertidos. Si alguno quedó como guía, no hay recta que valga.
export const tieneHorariosReales = (registro) =>
  periodosDelRegistro(registro).some((tipo) =>
    esFormatoHoraReal(registro?.[`inicio${tipo}`]),
  );

/**
 * Duraciones en minutos y segundos, sin pasar a horas: un partido dura 94:40,
 * no 01:34:40. Es como se lee un tiempo de juego.
 */
export const formatearMinutosSegundos = (totalSegundos) => {
  if (totalSegundos === null || totalSegundos === undefined || totalSegundos === "") {
    return "";
  }

  const valor = Number(totalSegundos);
  if (!Number.isFinite(valor) || valor < 0) return "";
  const entero = Math.floor(valor);
  return `${String(Math.floor(entero / 60)).padStart(2, "0")}:${String(
    entero % 60,
  ).padStart(2, "0")}`;
};

/**
 * El plantel repartido en los grupos que interesan de un partido terminado:
 * quiénes arrancaron, quiénes esperaron en el banco, cuáles de esos no
 * llegaron a entrar y qué titulares jugaron de principio a fin.
 *
 * Se compara con la misma normalización que usa el resto de la app, así un
 * apodo y el nombre completo del mismo jugador no cuentan como dos.
 */
export const plantelDelPartido = (registro) => {
  const titulares = limpiarLista(registro?.formacion?.titulares);
  const convocados = limpiarLista(registro?.formacion?.convocados);

  const salieron = new Set(
    (registro?.cambios || [])
      .map((cambio) => normalizarTexto(cambio?.sale))
      .filter(Boolean),
  );

  return {
    titulares,
    convocados,
    noIngresaron: calcularNoIngresaron(registro?.formacion, registro?.cambios),
    nuncaSalieron: titulares.filter(
      (jugador) => !salieron.has(normalizarTexto(jugador)),
    ),
  };
};
