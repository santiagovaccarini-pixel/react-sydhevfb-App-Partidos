// Lesiones: lo que se calcula sin tocar la base. Una lesión tiene las fechas
// en columnas propias (inicio, transición, retorno al entrenamiento y retorno
// a la competencia = alta) y el resto de las columnas del Excel en `datos`,
// por clave de campo (ver lesionesCampos.js).
import { hoyISO } from "../idioma/formatos.js";
import { CAMPOS, TIPOS_MANUALES, campoPorClave } from "./lesionesCampos.js";

export const ETAPAS = ["lesionado", "transicion", "entrenando", "alta"];


const limpiar = (valor) => String(valor ?? "").trim();

export const esFechaISO = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ""));

export const diasEntre = (desde, hasta) => {
  if (!esFechaISO(desde) || !esFechaISO(hasta)) return null;
  const a = new Date(`${desde}T00:00:00`);
  const b = new Date(`${hasta}T00:00:00`);
  return Math.round((b - a) / 86400000);
};

export const lesionVacia = (extra = {}) => ({
  id: null,
  equipo_id: null,
  jugador_id: null,
  numero_caso: null,
  fecha_lesion: hoyISO(),
  fecha_transicion: null,
  fecha_retorno_entrenamiento: null,
  fecha_alta: null,
  datos: {},
  ...extra,
});

// Lo que llega de la base, con los vacíos normalizados.
export const normalizarLesion = (fila) => ({
  ...lesionVacia(),
  ...fila,
  jugador_id: fila?.jugador_id ?? null,
  fecha_transicion: fila?.fecha_transicion || null,
  fecha_retorno_entrenamiento: fila?.fecha_retorno_entrenamiento || null,
  fecha_alta: fila?.fecha_alta || null,
  datos: fila?.datos && typeof fila.datos === "object" ? { ...fila.datos } : {},
});

// Leer y escribir una columna del Excel en la lesión, esté en su propia
// columna o adentro de `datos`.
export const valorDe = (lesion, clave) => {
  if (clave === "jugador") return lesion?.jugador_id ?? null;
  const campo = campoPorClave(clave);
  if (campo?.columna || clave === "numero_caso") return lesion?.[clave] ?? null;
  return lesion?.datos?.[clave] ?? null;
};

export const conValor = (lesion, clave, valor) => {
  if (clave === "jugador") return { ...lesion, jugador_id: valor || null };
  const campo = campoPorClave(clave);
  if (campo?.columna) return { ...lesion, [clave]: valor || null };
  return { ...lesion, datos: { ...(lesion.datos || {}), [clave]: valor ?? null } };
};

// En qué etapa está: lesionado → en transición → entrenando → con alta.
export const etapaDe = (lesion) => {
  if (lesion?.fecha_alta) return "alta";
  if (lesion?.fecha_retorno_entrenamiento) return "entrenando";
  if (lesion?.fecha_transicion) return "transicion";
  return "lesionado";
};

export const estaActiva = (lesion) => etapaDe(lesion) !== "alta";

// Sin retorno al entrenamiento no puede entrenar: para el plantel sigue
// lesionado. Entrenando pero sin competir, se está reintegrando.
export const sinEntrenar = (lesion) => ["lesionado", "transicion"].includes(etapaDe(lesion));

// Días de baja: hasta el alta, o hasta hoy si sigue activa.
export const diasDeBaja = (lesion, hoy = hoyISO()) =>
  Math.max(0, diasEntre(lesion.fecha_lesion, lesion.fecha_alta || hoy) ?? 0);

// Ventanas, en días desde el fin de la lesión anterior (alta, o hoy si sigue
// abierta) hasta el inicio de la nueva: recurrencia hasta 60 (celda J5 de la
// tabla dinámica del Excel), recidiva hasta 30 (pedido del 02/10).
export const DIAS_RECURRENCIA = 60;
export const DIAS_RECIDIVA = 30;

// Si el fin de `anterior` fue hace `maximo` días o menos respecto del inicio
// de `lesion`.
const dentroDe = (anterior, lesion, maximo, hoy) => {
  const dias = diasEntre(anterior.fecha_alta || hoy, lesion.fecha_lesion);
  return dias !== null && dias <= maximo;
};

const mismo = (a, b) => String(a ?? "") === String(b ?? "");

// Las lesiones anteriores del mismo jugador (inicio anterior), de la más
// reciente a la más vieja.
const anterioresDe = (lesion, lesiones = []) =>
  lesiones
    .filter(
      (otra) =>
        otra &&
        otra.id !== lesion.id &&
        String(otra.jugador_id) === String(lesion.jugador_id) &&
        esFechaISO(otra.fecha_lesion) &&
        otra.fecha_lesion < lesion.fecha_lesion,
    )
    .sort((a, b) => (a.fecha_lesion < b.fecha_lesion ? 1 : -1));

// Recorrência (Excel): otra lesión anterior del mismo jugador, músculo, lado
// y parte del cuerpo, cuyo fin (alta, o hoy si sigue abierta) fue hace 60
// días o menos. "sim" / "nao"; vacío si faltan datos.
export const recurrenciaDe = (lesion, lesiones = [], hoy = hoyISO()) => {
  if (!lesion?.jugador_id || !esFechaISO(lesion?.fecha_lesion)) return "";
  const d = lesion.datos || {};
  const hay = anterioresDe(lesion, lesiones).some((otra) => {
    const o = otra.datos || {};
    if (!mismo(o.musculo, d.musculo) || !mismo(o.lado, d.lado) || !mismo(o.parte_cuerpo, d.parte_cuerpo)) return false;
    return dentroDe(otra, lesion, DIAS_RECURRENCIA, hoy);
  });
  return hay ? "sim" : "nao";
};

// Recidiva: otra lesión anterior del mismo jugador en exactamente la misma
// estructura (músculo, área, lado, músculo específico y parte), cuyo fin fue
// hace 30 días o menos.
export const recidivaDe = (lesion, lesiones = [], hoy = hoyISO()) => {
  if (!lesion?.jugador_id || !esFechaISO(lesion?.fecha_lesion)) return "";
  const d = lesion.datos || {};
  const hay = anterioresDe(lesion, lesiones).some((otra) => {
    const o = otra.datos || {};
    return (
      mismo(o.musculo, d.musculo) &&
      mismo(o.area, d.area) &&
      mismo(o.lado, d.lado) &&
      mismo(o.musculo_especifico, d.musculo_especifico) &&
      mismo(o.parte_cuerpo, d.parte_cuerpo) &&
      dentroDe(otra, lesion, DIAS_RECIDIVA, hoy)
    );
  });
  return hay ? "sim" : "nao";
};

// Diagnóstico (Excel): tipo + (ligamento, o si no el músculo específico) +
// (músculo afectado, o si no la parte del cuerpo) + área + lado, en el idioma
// que se esté mirando. `texto(clave, codigo)` da el texto de cada opción.
export const diagnosticoDe = (lesion, texto = (clave, codigo) => codigo || "") => {
  const d = lesion?.datos || {};
  const partes = [
    texto("tipo_lesion", d.tipo_lesion),
    d.ligamento ? texto("ligamento", d.ligamento) : texto("musculo_especifico", d.musculo_especifico),
    d.musculo ? texto("musculo", d.musculo) : texto("parte_cuerpo", d.parte_cuerpo),
    texto("area", d.area),
    texto("lado", d.lado),
  ];
  return partes.filter(Boolean).join(" ");
};

// La fecha y hora de la imagen ("2026-10-01T18:30"), si existe de verdad:
// año desde 1900, día que existe (no 30 de febrero) y hora hasta 23:59. Igual
// que lesiones_horas_imagen en la base (20261006). { dia, ms } o null.
const HORA = /^((?:19|20)\d{2})-(\d{2})-(\d{2})[T ]([01]\d|2[0-3]):([0-5]\d)/;
const leerHoraImagen = (valor) => {
  const partes = HORA.exec(String(valor || ""));
  if (!partes) return null;
  const [anio, mes, dia, hora, minuto] = partes.slice(1).map(Number);
  const ms = Date.UTC(anio, mes - 1, dia, hora, minuto);
  const fecha = new Date(ms);
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return { dia: `${partes[1]}-${partes[2]}-${partes[3]}`, ms };
};

// Horas entre la lesión y la imagen (Excel): desde el comienzo del día de
// la lesión (la lesión tiene fecha, no hora) hasta la hora de la imagen,
// redondeadas como en la base: floor(x + 0,5).
export const horasHastaLaImagen = (fechaLesion, horaImagen) => {
  const imagen = leerHoraImagen(horaImagen);
  if (!imagen || !esFechaISO(fechaLesion)) return null;
  const [anio, mes, dia] = fechaLesion.split("-").map(Number);
  return Math.floor((imagen.ms - Date.UTC(anio, mes - 1, dia)) / 3600000 + 0.5);
};

// La imagen no puede ser de antes del día de la lesión (las horas darían
// negativas). Va aparte de errorDeCampo: compara dos columnas que se pueden
// cargar en pasos distintos.
export const errorImagenAntes = (lesion) => {
  const imagen = leerHoraImagen(lesion?.datos?.hora_imagen);
  if (!imagen || !esFechaISO(lesion?.fecha_lesion)) return "";
  return imagen.dia < lesion.fecha_lesion ? "lesiones.error.imagenAntes" : "";
};

// Las horas que se cargaban a mano antes de que se calcularan solas: se
// muestran si no hay hora de la imagen.
// Lo que aceptaba el campo numérico de antes (".5", "12,5", "1e3"); igual
// que en la vista de la base (20261006).
const NUMERO = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/;
const horasCargadasAMano = (lesion) => {
  const texto = String(lesion?.datos?.horas_imagen ?? "").trim();
  const numero = NUMERO.test(texto) ? Number(texto.replace(",", ".")) : NaN;
  return Number.isFinite(numero) ? numero : null;
};

// N° de registro (Excel): la enésima lesión del jugador, contando por n° de
// caso (o por fecha si todavía no tiene).
export const numeroDeRegistro = (lesion, lesiones = []) => {
  if (!lesion?.jugador_id) return null;
  const suyas = lesiones
    .filter((otra) => otra && String(otra.jugador_id) === String(lesion.jugador_id))
    .sort((a, b) => (a.numero_caso ?? Infinity) - (b.numero_caso ?? Infinity) || (a.fecha_lesion < b.fecha_lesion ? -1 : 1));
  const indice = suyas.findIndex((otra) => otra.id === lesion.id);
  return indice >= 0 ? indice + 1 : suyas.length + 1;
};

// Las columnas que el Excel calcula solo. `contexto` trae las demás lesiones
// del club (para n° de registro, recurrencia y recidiva) y cómo leer el texto
// de una opción (para el diagnóstico).
export const calcular = (clave, lesion, jugador = null, contexto = {}) => {
  const lesiones = contexto.lesiones || [];
  switch (clave) {
    case "numero_caso":
      return lesion?.numero_caso ?? null;
    case "numero_registro":
      return numeroDeRegistro(lesion, lesiones);
    case "edad": {
      const nacimiento = jugador?.fecha_nacimiento;
      if (!esFechaISO(nacimiento) || !esFechaISO(lesion?.fecha_lesion)) return null;
      const [an, mn, dn] = nacimiento.split("-").map(Number);
      const [al, ml, dl] = lesion.fecha_lesion.split("-").map(Number);
      let edad = al - an;
      if (ml < mn || (ml === mn && dl < dn)) edad -= 1;
      return edad >= 0 ? edad : null;
    }
    case "lado_habil": {
      const lado = lesion?.datos?.lado;
      const pie = jugador?.pie_dominante;
      if (!lado || !pie) return "";
      return lado === pie ? "sim" : "nao";
    }
    case "recup_1":
      return lesion?.fecha_transicion ? diasEntre(lesion.fecha_lesion, lesion.fecha_transicion) : null;
    case "recup_2":
      return lesion?.fecha_retorno_entrenamiento ? diasEntre(lesion.fecha_lesion, lesion.fecha_retorno_entrenamiento) : null;
    case "recuperacion":
      return esFechaISO(lesion?.fecha_lesion) ? diasEntre(lesion.fecha_lesion, lesion.fecha_alta || contexto.hoy || hoyISO()) : null;
    case "horas_imagen":
      return horasHastaLaImagen(lesion?.fecha_lesion, lesion?.datos?.hora_imagen) ?? horasCargadasAMano(lesion);
    case "severidad":
      return lesion?.fecha_alta ? severidadPorDias(diasEntre(lesion.fecha_lesion, lesion.fecha_alta)) : "";
    case "recurrencia":
      return recurrenciaDe(lesion, lesiones, contexto.hoy);
    case "recidiva":
      return recidivaDe(lesion, lesiones, contexto.hoy);
    case "diagnostico":
      return diagnosticoDe(lesion, contexto.texto);
    default:
      return null;
  }
};

// Severidad según los días de recuperación, con la escala del Excel:
// registro (menos de 1), leve (1-4), menor (5-7), moderado (8-28), mayor (29 o más).
export const severidadPorDias = (dias) => {
  if (dias === null || dias === undefined) return "";
  if (dias <= 0.99) return "registro";
  if (dias <= 4) return "leve";
  if (dias <= 7) return "menor";
  if (dias <= 28) return "moderado";
  return "mayor";
};

export const severidadSugerida = (lesion) => calcular("severidad", lesion);

const FECHAS_POSTERIORES = ["fecha_transicion", "fecha_retorno_entrenamiento", "fecha_alta"];

// Lo que está mal en una columna, como clave del diccionario ("" si nada).
// La carga por pasos revisa así las columnas de cada paso.
export const errorDeCampo = (lesion, clave, hoy = hoyISO()) => {
  if (clave === "jugador") return lesion.jugador_id ? "" : "lesiones.error.jugador";
  if (clave === "fecha_lesion") {
    if (!esFechaISO(lesion.fecha_lesion)) return "lesiones.error.fecha";
    return lesion.fecha_lesion > hoy ? "lesiones.error.fechaFutura" : "";
  }
  if (FECHAS_POSTERIORES.includes(clave)) {
    const valor = lesion[clave];
    if (!valor) return "";
    if (!esFechaISO(valor) || (esFechaISO(lesion.fecha_lesion) && valor < lesion.fecha_lesion)) return "lesiones.error.fechaAntes";
    return valor > hoy ? "lesiones.error.fechaFuturaOtra" : "";
  }
  if (clave === "tipo_lesion") return lesion.datos?.tipo_lesion ? "" : "lesiones.error.tipo";
  if (clave === "parte_cuerpo") return lesion.datos?.parte_cuerpo ? "" : "lesiones.error.parte";
  if (clave === "lado") return lesion.datos?.lado ? "" : "lesiones.error.lado";
  // La hora de la imagen tiene que existir y no ser futura (que no sea de
  // antes de la lesión lo dice errorImagenAntes).
  if (clave === "hora_imagen") {
    const hora = lesion.datos?.hora_imagen;
    if (!hora) return "";
    const imagen = leerHoraImagen(hora);
    if (!imagen) return "lesiones.error.imagen";
    return imagen.dia > hoy ? "lesiones.error.fechaFuturaOtra" : "";
  }
  return "";
};

const ORDEN_DE_VALIDACION = ["jugador", "fecha_lesion", ...FECHAS_POSTERIORES, "tipo_lesion", "parte_cuerpo", "lado", "hora_imagen"];

// Todo lo que está mal en una lesión, en orden: [{ clave, error }] (clave:
// la columna donde se corrige; null si es de varias, como la superposición
// con otra lesión). Las columnas que el club escondió (oculto) no se
// revisan: no se ven ni se pueden corregir.
export const erroresDeLesion = (lesion, { hoy = hoyISO(), otras = [], oculto = () => false } = {}) => {
  const errores = ORDEN_DE_VALIDACION.filter((clave) => !oculto(clave)).map((clave) => ({ clave, error: errorDeCampo(lesion, clave, hoy) }));
  if (!oculto("hora_imagen")) errores.push({ clave: "hora_imagen", error: errorImagenAntes(lesion) });
  if (seSolapa(lesion, otras)) errores.push({ clave: null, error: "lesiones.error.solapada" });
  return errores.filter((uno) => uno.error);
};

// Lo que hay que corregir antes de guardar, como clave del diccionario.
// Devuelve "" si está todo bien.
export const validarLesion = (lesion, opciones = {}) => erroresDeLesion(lesion, opciones)[0]?.error || "";

// Lo que una edición rompe: los errores de después que no estaban antes. Una
// celda se puede cambiar aunque a la lesión le falte otra cosa de antes
// (por ejemplo, el tipo en una lesión vieja).
// Un error que ya estaba cuenta como nuevo si la edición cambió alguna de las
// columnas de las que depende (empeorar lo que ya estaba mal no pasa).
const DEPENDE_DE = {
  hora_imagen: ["hora_imagen", "fecha_lesion"],
  ...Object.fromEntries(FECHAS_POSTERIORES.map((clave) => [clave, [clave, "fecha_lesion"]])),
};
const huella = (lesion, uno) =>
  [uno.clave, uno.error, ...(DEPENDE_DE[uno.clave] || (uno.clave ? [uno.clave] : [])).map((clave) => String(valorDe(lesion, clave) ?? ""))].join("|");
export const erroresNuevos = (antes, despues, opciones = {}) => {
  const habia = new Set(erroresDeLesion(antes, opciones).map((uno) => huella(antes, uno)));
  return erroresDeLesion(despues, opciones).filter((uno) => !habia.has(huella(despues, uno)));
};

// Qué columnas cargadas a mano cambió una edición, comparando la lesión de
// antes y la de después (como las guarda el historial de la base).
const CAMPOS_DE_CARGA = CAMPOS.filter((campo) => campo.tipo === "jugador" || TIPOS_MANUALES.includes(campo.tipo)).map((campo) => campo.clave);
export const camposCambiados = (antes, despues) => {
  if (!antes || !despues) return [];
  const texto = (lesion, clave) => String(valorDe(lesion, clave) ?? "").trim();
  return CAMPOS_DE_CARGA.filter((clave) => texto(antes, clave) !== texto(despues, clave));
};

// Misma regla que el índice de exclusión de la base: el mismo jugador no
// puede tener dos lesiones a la vez en la misma parte del cuerpo y lado.
// Rango [inicio, alta); sin alta, abierto hacia adelante.
export const seSolapa = (lesion, otras = []) =>
  otras.some((otra) => {
    if (!otra || otra.id === lesion.id) return false;
    if (String(otra.jugador_id) !== String(lesion.jugador_id)) return false;
    if (otra.datos?.parte_cuerpo !== lesion.datos?.parte_cuerpo || otra.datos?.lado !== lesion.datos?.lado) return false;
    const finA = lesion.fecha_alta || "9999-12-31";
    const finB = otra.fecha_alta || "9999-12-31";
    return lesion.fecha_lesion < finB && otra.fecha_lesion < finA;
  });

// El aviso al cargar: la lesión anterior del mismo jugador, parte del cuerpo
// y lado cuya alta fue hace DIAS_RECURRENCIA días o menos (puede terminar
// contando como recurrencia o recidiva). Devuelve esa lesión o null.
export const posibleRecidiva = (lesion, anteriores = []) => {
  const parte = lesion?.datos?.parte_cuerpo;
  const lado = lesion?.datos?.lado;
  if (!lesion?.jugador_id || !parte || !lado || !esFechaISO(lesion.fecha_lesion)) return null;
  const candidatas = anteriores
    .filter(
      (otra) =>
        otra &&
        otra.id !== lesion.id &&
        String(otra.jugador_id) === String(lesion.jugador_id) &&
        otra.datos?.parte_cuerpo === parte &&
        otra.datos?.lado === lado &&
        otra.fecha_alta &&
        otra.fecha_alta <= lesion.fecha_lesion &&
        (diasEntre(otra.fecha_alta, lesion.fecha_lesion) ?? Infinity) <= DIAS_RECURRENCIA,
    )
    .sort((a, b) => (a.fecha_alta < b.fecha_alta ? 1 : -1));
  return candidatas[0] || null;
};

export const lesionesActivas = (lesiones = []) =>
  lesiones.filter(estaActiva).sort((a, b) => (a.fecha_lesion < b.fecha_lesion ? -1 : 1));

// La Base, como el Excel: por n° de caso, de menor a mayor (las nuevas
// abajo). Las que todavía no tienen n° van al final, por fecha.
export const ordenarPorCaso = (lesiones = []) =>
  [...lesiones].sort((a, b) => {
    const porCaso = (a.numero_caso ?? Infinity) - (b.numero_caso ?? Infinity);
    if (porCaso) return porCaso;
    return String(a.fecha_lesion || "").localeCompare(String(b.fecha_lesion || ""));
  });

// El plantel con su situación de hoy: disponible, reintegrándose (entrena
// pero todavía no compite) o lesionado.
export const estadoDelPlantel = (plantel = [], lesiones = []) => {
  const activas = lesionesActivas(lesiones);
  return plantel.map((jugador) => {
    const suyas = activas.filter((lesion) => String(lesion.jugador_id) === String(jugador.id));
    const situacion = suyas.some(sinEntrenar) ? "lesionado" : suyas.length ? "reintegrandose" : "disponible";
    return { jugador, lesiones: suyas, situacion };
  });
};

// Para buscar por nombre sin que importen mayúsculas ni acentos.
export const normalizarTexto = (texto) =>
  limpiar(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Lo que dice la base, traducido a una clave del diccionario.
export const claveDeErrorDeBase = (error) => {
  const mensaje = String(error?.message || "");
  const codigo = String(error?.code || "");
  if (
    codigo === "42P01" ||
    codigo === "42703" ||
    /relation .*lesiones.* does not exist|Could not find the table|column .* does not exist/i.test(mensaje)
  ) {
    return "lesiones.error.faltaMigracion";
  }
  if (codigo === "42501" || /row-level security|permission denied/i.test(mensaje)) {
    return "lesiones.error.sinPermiso";
  }
  if (codigo === "23P01" || /lesiones_sin_solapar/i.test(mensaje)) return "lesiones.error.solapada";
  if (codigo === "23514" && /sin_futuro/i.test(mensaje)) return "lesiones.error.fechaFuturaOtra";
  if (codigo === "23514" && /fechas_en_orden/i.test(mensaje)) return "lesiones.error.fechaAntes";
  return "";
};
