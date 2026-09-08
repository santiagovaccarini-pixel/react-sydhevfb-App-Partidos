export const MODO_EN_VIVO = "enVivo";
export const MODO_TRANSMISION = "transmision";

export const equivalenciasJugadores = Object.freeze({
  "alan minda": "A MINDA",
  "a minda": "A MINDA",
  "angelo preciado": "A PRECIADO",
  "a preciado": "A PRECIADO",
  "alan franco": "ALAN FRANCO",
  alexsander: "ALEXSANDER",
  "junior alonso": "ALONSO",
  alonso: "ALONSO",
  bernard: "BERNARD",
  "caua soares": "CAUA SOARES",
  "mamady cisse": "CISSE",
  cisse: "CISSE",
  "tomas cuello": "CUELLO",
  cuello: "CUELLO",
  dudu: "DUDU",
  "ivan roman": "I ROMAN",
  "i roman": "I ROMAN",
  "igor gomes": "IGOR GOMES",
  indio: "INDIO",
  "mateus iseppe": "M ISEPPE",
  "m iseppe": "M ISEPPE",
  "kaua pascini": "KAUA PASCINI",
  lyanco: "LYANCO",
  "mateo cassierra": "M CASSIERRA",
  "m cassierra": "M CASSIERRA",
  maycon: "MAYCON",
  natanael: "NATANAEL",
  patrick: "PATRICK",
  reinier: "REINIER",
  "renan lodi": "RENAN LODI",
  ruan: "RUAN",
  "gustavo scarpa": "SCARPA",
  scarpa: "SCARPA",
  "tomas perez": "T PEREZ",
  "t perez": "T PEREZ",
  "vitor hugo": "V HUGO",
  "v hugo": "V HUGO",
  victor: "VICTOR",
  "victor hugo": "VICTOR",
  vitao: "VITAO",
  "luis gustavo": "LUIS GUSTAVO",
  veneno: "VENENO",
  "thiago borbas": "THIAGO BORBAS",
  "kevin castano": "KEVIN CASTANO",
  fred: "FRED",
  lemos: "LEMOS",
});

export const normalizarTextoBase = (valor) =>
  String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const normalizarTexto = (valor) => {
  const limpio = normalizarTextoBase(valor);
  return equivalenciasJugadores[limpio] || limpio.toUpperCase();
};

export const convertirNombreJugador = (nombre) => normalizarTexto(nombre);

export const limpiarLista = (lista) =>
  (Array.isArray(lista) ? lista : [])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

export const calcularNoIngresaron = (formacion, cambios) => {
  const convocados = limpiarLista(formacion?.convocados);
  const entraron = new Set(
    (Array.isArray(cambios) ? cambios : [])
      .map((cambio) => normalizarTexto(cambio?.entra))
      .filter(Boolean),
  );

  return convocados.filter(
    (jugador) => !entraron.has(normalizarTexto(jugador)),
  );
};

export const fechaLocalISO = (fecha = new Date()) => {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

export const esFormatoTransmision = (valor) => {
  const coincidencia = String(valor ?? "")
    .trim()
    .match(/^(\d{1,3}):([0-5]\d)$/);
  if (!coincidencia) return false;

  // HH:mm es una hora real válida. La guía interna siempre se normaliza a
  // tres dígitos (020:00), o resulta inequívoca a partir del minuto 24.
  const minutos = Number(coincidencia[1]);
  return minutos <= 120 && (coincidencia[1].length === 3 || minutos > 23);
};

export const esFormatoHoraReal = (valor) =>
  /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(valor ?? "").trim());

export const normalizarEntradaTiempoTransmision = (valor) => {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";

  const coincidencia = texto.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!coincidencia) return null;

  const minuto = Number(coincidencia[1]);
  const segundo = Number(coincidencia[2]);
  if (!Number.isInteger(minuto) || minuto > 120 || segundo > 59) return null;

  return `${String(minuto).padStart(3, "0")}:${String(segundo).padStart(
    2,
    "0",
  )}`;
};

export const segundosDesdeHora = (valor) => {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;

  if (esFormatoTransmision(texto)) {
    const [minutos, segundos] = texto.split(":").map(Number);
    return minutos * 60 + segundos;
  }

  if (!esFormatoHoraReal(texto)) return null;
  const [horas, minutos, segundos = 0] = texto.split(":").map(Number);
  return horas * 3600 + minutos * 60 + segundos;
};

export const segundosEntre = (inicio, final) => {
  if (!inicio || !final) return null;

  const inicioTransmision = esFormatoTransmision(inicio);
  const finalTransmision = esFormatoTransmision(final);
  if (inicioTransmision !== finalTransmision) return null;

  const totalInicio = segundosDesdeHora(inicio);
  let totalFinal = segundosDesdeHora(final);
  if (totalInicio === null || totalFinal === null) return null;

  if (inicioTransmision && totalFinal < totalInicio) return null;
  if (!inicioTransmision && totalFinal < totalInicio) totalFinal += 24 * 3600;

  const duracion = totalFinal - totalInicio;
  return duracion <= 4 * 3600 ? duracion : null;
};

export const formatearDuracion = (totalSegundos) => {
  if (
    totalSegundos === null ||
    totalSegundos === undefined ||
    totalSegundos === ""
  ) {
    return "";
  }

  const valor = Number(totalSegundos);
  if (!Number.isFinite(valor) || valor < 0) return "";

  const entero = Math.floor(valor);
  const horas = Math.floor(entero / 3600);
  const minutos = Math.floor((entero % 3600) / 60);
  const segundos = entero % 60;
  const mm = String(minutos).padStart(2, "0");
  const ss = String(segundos).padStart(2, "0");

  return horas > 0
    ? `${String(horas).padStart(2, "0")}:${mm}:${ss}`
    : `${mm}:${ss}`;
};

export const formatearTiempoTransmision = (totalSegundos) => {
  const valor = Number(totalSegundos);
  if (!Number.isFinite(valor)) return "";
  const seguros = Math.max(0, Math.min(120 * 60 + 59, Math.floor(valor)));
  const minutos = Math.floor(seguros / 60);
  const segundos = seguros % 60;
  return `${String(minutos).padStart(3, "0")}:${String(segundos).padStart(
    2,
    "0",
  )}`;
};

const normalizarPeriodo = (periodo) => {
  const valor = normalizarTextoBase(periodo).replace(/[^a-z0-9]/g, "");
  if (["pt", "1h", "firsthalf", "primeirotempo"].includes(valor)) return "PT";
  if (["st", "2h", "secondhalf", "segundotempo"].includes(valor)) return "ST";
  if (["pte", "et1", "extratime1"].includes(valor)) return "PTE";
  if (["ste", "et2", "extratime2"].includes(valor)) return "STE";
  return "";
};

export const periodoDesdeMinutoPartido = (
  matchClock,
  { prorrogaActiva = false, periodoApi = "" } = {},
) => {
  const relojNormalizado = normalizarEntradaTiempoTransmision(matchClock);
  if (!relojNormalizado) return { periodo: "", segundosGuia: null };
  const [minutos, segundos] = relojNormalizado.split(":").map(Number);
  const segundosTotales = minutos * 60 + segundos;

  const periodoExplicito = normalizarPeriodo(periodoApi);
  let periodo = periodoExplicito;

  if (!periodo) {
    if (prorrogaActiva && segundosTotales >= 105 * 60) periodo = "STE";
    else if (prorrogaActiva && segundosTotales > 90 * 60) periodo = "PTE";
    else if (segundosTotales > 45 * 60) periodo = "ST";
    else periodo = "PT";
  }

  const base = { PT: 0, ST: 45 * 60, PTE: 90 * 60, STE: 105 * 60 }[periodo];
  return {
    periodo,
    segundosGuia: Math.max(0, segundosTotales - (base ?? 0)),
  };
};

export const sumarDuracionesEventos = (eventos) => {
  const duraciones = (Array.isArray(eventos) ? eventos : []).map((evento) =>
    segundosEntre(evento?.inicio, evento?.final),
  );
  if (!duraciones.some((valor) => valor !== null)) return null;
  return duraciones.reduce((total, valor) => total + (valor ?? 0), 0);
};

export const validarRegistroBasico = (registro) => {
  const errores = [];
  const fechaTexto = String(registro?.fecha ?? "");
  const partesFecha = fechaTexto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const fechaConstruida = partesFecha
    ? new Date(
        Number(partesFecha[1]),
        Number(partesFecha[2]) - 1,
        Number(partesFecha[3]),
      )
    : null;
  const fechaValida = Boolean(
    partesFecha &&
    fechaConstruida?.getFullYear() === Number(partesFecha[1]) &&
    fechaConstruida?.getMonth() === Number(partesFecha[2]) - 1 &&
    fechaConstruida?.getDate() === Number(partesFecha[3]),
  );

  if (!fechaValida) {
    errores.push("Cargá una fecha válida.");
  }
  if (!String(registro?.rival ?? "").trim()) errores.push("Cargá el rival.");

  const pares = [
    ["PT", registro?.inicioPT, registro?.finalPT],
    ["ST", registro?.inicioST, registro?.finalST],
    ["PTE", registro?.inicioPTE, registro?.finalPTE],
    ["STE", registro?.inicioSTE, registro?.finalSTE],
  ];

  pares.forEach(([nombre, inicio, final]) => {
    // Un partido en curso puede guardarse con el período todavía abierto.
    // Cada marca debe ser válida aun cuando todavía no exista la otra.
    const formatoInvalido =
      (inicio && segundosDesdeHora(inicio) === null) ||
      (final && segundosDesdeHora(final) === null);
    if (
      formatoInvalido ||
      (inicio && final && segundosEntre(inicio, final) === null)
    ) {
      errores.push(`Revisá el orden o el formato de ${nombre}.`);
    }
  });

  const eventos = [
    ...["PT", "ST", "PTE", "STE"].flatMap((periodo) =>
      (Array.isArray(registro?.[`vars${periodo}`])
        ? registro[`vars${periodo}`]
        : []
      ).map((evento, index) => [
        `VAR ${periodo} ${index + 1}`,
        evento?.inicio,
        evento?.final,
      ]),
    ),
    ...["PT", "ST", "PTE", "STE"].map((periodo) => [
      `Hidratación ${periodo}`,
      registro?.[`inicioHidratacion${periodo}`],
      registro?.[`finalHidratacion${periodo}`],
    ]),
  ];

  eventos.forEach(([nombre, inicio, final]) => {
    const formatoInvalido =
      (inicio && segundosDesdeHora(inicio) === null) ||
      (final && segundosDesdeHora(final) === null);
    if (
      formatoInvalido ||
      (inicio && final && segundosEntre(inicio, final) === null)
    ) {
      errores.push(`Revisá el orden o el formato de ${nombre}.`);
    }
  });

  return errores;
};

export const clavePartido = (registro) =>
  `${String(registro?.fecha ?? "").trim()}::${normalizarTextoBase(
    registro?.rival,
  )}`;
