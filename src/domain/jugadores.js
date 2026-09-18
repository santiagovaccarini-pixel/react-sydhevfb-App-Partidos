import { limpiarLista, normalizarTexto } from "./match";
import { COMPARADOR, pasaPorMinutos } from "./minutos";
import { tiempoJugado } from "./tiempos";

// Se reexporta para no obligar a los que ya lo importaban de acá a cambiar de
// puerta: la pregunta sigue siendo de este módulo, la cuenta es compartida.
export { COMPARADOR };

/**
 * Qué hizo un jugador en un partido y todo lo que hizo alguno a lo largo del
 * historial. Es lo que hace falta para buscar por jugador en vez de por rival:
 * en qué partidos estuvo, desde dónde y cuántos minutos.
 *
 * "Estuvo" incluye al que se sentó en el banco y no llegó a entrar: el partido
 * es suyo igual, solo que sin minutos.
 */

const PAPELES = {
  COMPLETO: "completo",
  SALIO: "salio",
  ENTRO: "entro",
  BANCO: "banco",
};

export const PAPEL = PAPELES;

const mismoJugador = (uno, otro) =>
  Boolean(uno) && normalizarTexto(uno) === normalizarTexto(otro);

const enLaLista = (lista, nombre) =>
  limpiarLista(lista).some((quien) => mismoJugador(quien, nombre));

/**
 * El horario de un corte sin los segundos: "22:18:04" se lee "22:18". Esta
 * pantalla cuenta minutos jugados, no marca puntos de corte; para eso está el
 * detalle del partido, que sigue mostrando el horario entero.
 *
 * Solo se recorta cuando hay tres partes: un minuto de juego como "62:15" se
 * deja tal cual, porque ahí los segundos son el dato.
 */
export const horaCorta = (hora) => {
  const texto = String(hora ?? "").trim();
  const partes = texto.split(":");
  return partes.length === 3 ? `${partes[0]}:${partes[1]}` : texto;
};

/**
 * Lo que le pasó a un jugador en un partido, o null si no estuvo.
 *
 * Los minutos salen de tiempoJugado, que es lo que ya usa la ficha: al que
 * entró o salió lo devuelve con sus tramos medidos, y al titular que jugó de
 * principio a fin lo deja en "resto", con la duración del partido entero.
 */
export const participacionEnPartido = (registro, nombre) => {
  if (!String(nombre ?? "").trim()) return null;

  const titulares = registro?.formacion?.titulares;
  const convocados = registro?.formacion?.convocados;
  const cambios = Array.isArray(registro?.cambios) ? registro.cambios : [];

  const esTitular = enLaLista(titulares, nombre);
  const enElBanco = enLaLista(convocados, nombre);
  const entroEnUnCambio = cambios.some((cambio) =>
    mismoJugador(cambio?.entra, nombre),
  );
  const salioEnUnCambio = cambios.some((cambio) =>
    mismoJugador(cambio?.sale, nombre),
  );

  // Un partido viejo puede no tener formación cargada: si el nombre aparece en
  // un cambio, estuvo igual.
  if (!esTitular && !enElBanco && !entroEnUnCambio && !salioEnUnCambio) {
    return null;
  }

  const medido = tiempoJugado(registro);
  const suyo = medido.jugadores.find((jugador) =>
    mismoJugador(jugador.nombre, nombre),
  );

  // El titular que no participó de ningún cambio jugó la ventana entera, que
  // es justo lo que mide "resto".
  const completo = medido.resto || { bruto: 0, neto: 0 };

  if (!esTitular && !entroEnUnCambio && !salioEnUnCambio) {
    return { papel: PAPELES.BANCO, entro: "", salio: "", bruto: 0, neto: 0 };
  }

  if (!suyo) {
    return {
      papel: PAPELES.COMPLETO,
      entro: "",
      salio: "",
      bruto: completo.bruto,
      neto: completo.neto,
    };
  }

  const arrancoDeTitular = esTitular || salioEnUnCambio;
  const papel =
    arrancoDeTitular && !entroEnUnCambio
      ? suyo.salio
        ? PAPELES.SALIO
        : PAPELES.COMPLETO
      : PAPELES.ENTRO;

  return {
    papel,
    entro: horaCorta(suyo.entro),
    salio: horaCorta(suyo.salio),
    bruto: suyo.bruto,
    neto: suyo.neto,
  };
};

/**
 * Los partidos de un jugador, en el mismo orden en que venían los registros.
 * Cada uno se devuelve con el índice original, para poder abrir el detalle sin
 * tener que buscarlo de nuevo.
 */
export const partidosDeJugador = (registros, nombre) =>
  (Array.isArray(registros) ? registros : [])
    .map((item, index) => ({
      item,
      index,
      participacion: participacionEnPartido(item, nombre),
    }))
    .filter((fila) => fila.participacion !== null);

/**
 * El resumen que va arriba de la lista. "partidos" cuenta también los que
 * miró desde el banco: estuvo, aunque no haya sumado un minuto.
 */
export const resumenDeJugador = (partidos) => {
  const filas = Array.isArray(partidos) ? partidos : [];
  const cuantos = (papel) =>
    filas.filter((fila) => fila.participacion.papel === papel).length;

  return {
    partidos: filas.length,
    titular: cuantos(PAPELES.COMPLETO) + cuantos(PAPELES.SALIO),
    entro: cuantos(PAPELES.ENTRO),
    banco: cuantos(PAPELES.BANCO),
    bruto: filas.reduce((total, fila) => total + fila.participacion.bruto, 0),
    neto: filas.reduce((total, fila) => total + fila.participacion.neto, 0),
  };
};

/**
 * Con qué se puede recortar la lista de partidos de un jugador. "minutos" no
 * es un papel sino un piso: deja los partidos en los que jugó más que eso.
 */
export const FILTRO = {
  TODOS: "todos",
  TITULAR: "titular",
  ENTRO: "entro",
  NO_SALIO: "noSalio",
  BANCO: "banco",
  MINUTOS: "minutos",
};

const PAPELES_DEL_FILTRO = {
  [FILTRO.TITULAR]: [PAPELES.COMPLETO, PAPELES.SALIO],
  [FILTRO.ENTRO]: [PAPELES.ENTRO],
  [FILTRO.BANCO]: [PAPELES.BANCO],
};

export const filtrarPartidosDeJugador = (partidos, opciones = {}) => {
  const lista = Array.isArray(partidos) ? partidos : [];

  if (opciones.filtro === FILTRO.MINUTOS) {
    return lista.filter((fila) =>
      pasaPorMinutos(fila.participacion.bruto, opciones),
    );
  }

  // Estaba en la cancha cuando terminó el partido. No es un papel: vale para el
  // titular que jugó los noventa y también para el que entró y se quedó hasta
  // el final. El que miró desde el banco no cuenta: nunca estuvo.
  if (opciones.filtro === FILTRO.NO_SALIO) {
    return lista.filter(({ participacion }) => {
      if (participacion.papel === PAPELES.BANCO) return false;
      // Al titular que salió lo dice su papel; al que entró y después salió,
      // que también se fue, hay que mirarle el horario de salida.
      return participacion.papel !== PAPELES.SALIO && !participacion.salio;
    });
  }

  const papeles = PAPELES_DEL_FILTRO[opciones.filtro];
  if (!papeles) return lista;
  return lista.filter((fila) => papeles.includes(fila.participacion.papel));
};

/**
 * Todos los que pasaron por el historial, en orden alfabético y con cuántos
 * partidos tiene cada uno. Es lo que se ofrece cuando todavía no se escribió
 * nada: tocar un nombre evita tener que tipearlo.
 */
export const jugadoresDelHistorial = (registros) => {
  const cuenta = new Map();

  const sumar = (nombre) => {
    const limpio = String(nombre ?? "").trim();
    const id = normalizarTexto(limpio);
    if (!id) return;
    if (!cuenta.has(id)) cuenta.set(id, { nombre: limpio, partidos: 0 });
    cuenta.get(id).partidos += 1;
  };

  (Array.isArray(registros) ? registros : []).forEach((registro) => {
    const delPartido = new Set();
    const anotar = (nombre) => {
      const id = normalizarTexto(nombre);
      if (!id || delPartido.has(id)) return;
      delPartido.add(id);
      sumar(nombre);
    };

    limpiarLista(registro?.formacion?.titulares).forEach(anotar);
    limpiarLista(registro?.formacion?.convocados).forEach(anotar);
    (Array.isArray(registro?.cambios) ? registro.cambios : []).forEach(
      (cambio) => {
        anotar(cambio?.sale);
        anotar(cambio?.entra);
      },
    );
  });

  return [...cuenta.values()].sort((uno, otro) =>
    uno.nombre.localeCompare(otro.nombre, "es"),
  );
};
