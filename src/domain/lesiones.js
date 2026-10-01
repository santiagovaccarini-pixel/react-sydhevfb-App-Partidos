// Lesiones: lo que se calcula sin tocar la base. Los códigos son los de la
// tabla public.lesiones (consenso IOC 2020); el texto de cada uno sale del
// diccionario de idioma (lesiones.opciones.*).
import { hoyISO } from "../idioma/formatos.js";

export const CONTEXTOS = ["entrenamiento", "partido", "otro"];
export const MODOS_INICIO = ["subito", "gradual"];
export const MECANISMOS = ["contacto_directo", "contacto_indirecto", "sin_contacto"];
export const LADOS = ["derecho", "izquierdo", "bilateral", "no_aplica"];
export const TEJIDOS = ["muscular", "tendon", "ligamento", "hueso", "articular", "contusion", "otro"];
export const REGIONES = [
  "cabeza_cuello",
  "hombro",
  "brazo_codo",
  "antebrazo_mano",
  "torax_espalda",
  "lumbar",
  "cadera_ingle",
  "muslo_anterior",
  "muslo_posterior",
  "aductores",
  "rodilla",
  "pierna",
  "tobillo",
  "pie",
];

// Una recaída "temprana" (IOC): misma región y lado, dentro de los dos meses
// del alta anterior.
export const DIAS_RECIDIVA = 60;

const limpiar = (valor) => String(valor ?? "").trim();

const esFechaISO = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ""));

const diasEntre = (desde, hasta) => {
  if (!esFechaISO(desde) || !esFechaISO(hasta)) return 0;
  const a = new Date(`${desde}T00:00:00`);
  const b = new Date(`${hasta}T00:00:00`);
  return Math.round((b - a) / 86400000);
};

export const lesionVacia = (extra = {}) => ({
  id: null,
  jugador_id: null,
  fecha_lesion: hoyISO(),
  fecha_alta: null,
  contexto: "entrenamiento",
  modo_inicio: "subito",
  mecanismo: null,
  region: "",
  lado: "",
  tejido: null,
  diagnostico: "",
  observaciones: "",
  recidiva_de: null,
  ...extra,
});

// Lo que llega de la base, con los vacíos normalizados.
export const normalizarLesion = (fila) => ({
  ...lesionVacia(),
  ...fila,
  jugador_id: fila?.jugador_id ?? null,
  fecha_alta: fila?.fecha_alta || null,
  mecanismo: fila?.mecanismo || null,
  tejido: fila?.tejido || null,
  diagnostico: limpiar(fila?.diagnostico),
  observaciones: limpiar(fila?.observaciones),
});

export const estaActiva = (lesion) => !lesion?.fecha_alta;

// Días de baja: hasta el alta, o hasta hoy si sigue activa.
export const diasDeBaja = (lesion, hoy = hoyISO()) =>
  Math.max(0, diasEntre(lesion.fecha_lesion, lesion.fecha_alta || hoy));

// Mínima (0 días), leve (1-7), moderada (8-28), grave (más de 28). Mientras
// sigue activa no se sabe: "activa".
export const gravedad = (lesion) => {
  if (estaActiva(lesion)) return "activa";
  const dias = diasDeBaja(lesion);
  if (dias === 0) return "minima";
  if (dias <= 7) return "leve";
  if (dias <= 28) return "moderada";
  return "grave";
};

// Lo que hay que corregir antes de guardar, como clave del diccionario.
// Devuelve "" si está todo bien.
export const validarLesion = (lesion, { hoy = hoyISO(), otras = [] } = {}) => {
  if (!lesion.jugador_id) return "lesiones.error.jugador";
  if (!esFechaISO(lesion.fecha_lesion)) return "lesiones.error.fecha";
  if (lesion.fecha_lesion > hoy) return "lesiones.error.fechaFutura";
  if (lesion.fecha_alta) {
    if (!esFechaISO(lesion.fecha_alta)) return "lesiones.error.altaAntes";
    if (lesion.fecha_alta < lesion.fecha_lesion) return "lesiones.error.altaAntes";
    if (lesion.fecha_alta > hoy) return "lesiones.error.altaFutura";
  }
  if (!REGIONES.includes(lesion.region)) return "lesiones.error.region";
  if (!LADOS.includes(lesion.lado)) return "lesiones.error.lado";
  if (seSolapa(lesion, otras)) return "lesiones.error.solapada";
  return "";
};

// Misma regla que el índice de exclusión de la base: el mismo jugador no
// puede tener dos lesiones a la vez en la misma región y lado. Rango
// [lesión, alta); sin alta, abierto hacia adelante.
export const seSolapa = (lesion, otras = []) =>
  otras.some((otra) => {
    if (!otra || otra.id === lesion.id) return false;
    if (String(otra.jugador_id) !== String(lesion.jugador_id)) return false;
    if (otra.region !== lesion.region || otra.lado !== lesion.lado) return false;
    const finA = lesion.fecha_alta || "9999-12-31";
    const finB = otra.fecha_alta || "9999-12-31";
    return lesion.fecha_lesion < finB && otra.fecha_lesion < finA;
  });

// Si es una recaída: la lesión anterior del mismo jugador, región y lado
// cuya alta fue hace menos de DIAS_RECIDIVA días. Devuelve esa lesión o null.
export const posibleRecidiva = (lesion, anteriores = []) => {
  if (!lesion?.jugador_id || !lesion.region || !lesion.lado || !esFechaISO(lesion.fecha_lesion)) return null;
  const candidatas = anteriores
    .filter(
      (otra) =>
        otra &&
        otra.id !== lesion.id &&
        String(otra.jugador_id) === String(lesion.jugador_id) &&
        otra.region === lesion.region &&
        otra.lado === lesion.lado &&
        otra.fecha_alta &&
        otra.fecha_alta <= lesion.fecha_lesion &&
        diasEntre(otra.fecha_alta, lesion.fecha_lesion) <= DIAS_RECIDIVA,
    )
    .sort((a, b) => (a.fecha_alta < b.fecha_alta ? 1 : -1));
  return candidatas[0] || null;
};

export const lesionesActivas = (lesiones = []) =>
  lesiones.filter(estaActiva).sort((a, b) => (a.fecha_lesion < b.fecha_lesion ? -1 : 1));

export const ordenarHistorial = (lesiones = []) =>
  [...lesiones].sort((a, b) => {
    if (a.fecha_lesion !== b.fecha_lesion) return a.fecha_lesion < b.fecha_lesion ? 1 : -1;
    return String(a.creado_en || "") < String(b.creado_en || "") ? 1 : -1;
  });

// El plantel con su situación de hoy: disponible o lesionado (y con qué).
export const estadoDelPlantel = (plantel = [], lesiones = []) => {
  const activas = lesionesActivas(lesiones);
  return plantel.map((jugador) => ({
    jugador,
    lesiones: activas.filter((lesion) => String(lesion.jugador_id) === String(jugador.id)),
  }));
};

// Lo que dice la base, traducido a una clave del diccionario.
export const claveDeErrorDeBase = (error) => {
  const mensaje = String(error?.message || "");
  const codigo = String(error?.code || "");
  if (codigo === "42P01" || /relation .*lesiones.* does not exist|Could not find the table/i.test(mensaje)) {
    return "lesiones.error.faltaMigracion";
  }
  if (codigo === "42501" || /row-level security|permission denied/i.test(mensaje)) {
    return "lesiones.error.sinPermiso";
  }
  if (codigo === "23P01" || /lesiones_sin_solapar/i.test(mensaje)) return "lesiones.error.solapada";
  if (codigo === "23514" && /sin_futuro/i.test(mensaje)) return "lesiones.error.fechaFutura";
  if (codigo === "23514" && /alta_despues/i.test(mensaje)) return "lesiones.error.altaAntes";
  return "";
};
