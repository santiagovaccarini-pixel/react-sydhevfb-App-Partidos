// Lesiones: lo que se calcula sin tocar la base. Una lesión tiene las fechas
// en columnas propias (inicio, transición, retorno al entrenamiento y retorno
// a la competencia = alta) y el resto de las columnas del Excel en `datos`,
// por clave de campo (ver lesionesCampos.js).
import { hoyISO } from "../idioma/formatos.js";
import { campoPorClave, etiquetaDeOpcion } from "./lesionesCampos.js";

export const ETAPAS = ["lesionado", "transicion", "entrenando", "alta"];

// Una recaída "temprana": misma parte del cuerpo y lado, dentro de los dos
// meses del alta anterior.
export const DIAS_RECIDIVA = 60;

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

// Días de ventana para la recurrencia (celda J5 de la tabla dinámica del Excel).
export const DIAS_RECURRENCIA = 60;

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
    const fin = otra.fecha_alta || hoy;
    const dias = diasEntre(fin, lesion.fecha_lesion);
    return dias !== null && dias <= DIAS_RECURRENCIA;
  });
  return hay ? "sim" : "nao";
};

// Recidiva (Excel): otra lesión anterior del mismo jugador en exactamente la
// misma estructura (músculo, área, lado, músculo específico y parte), en
// cualquier momento.
export const recidivaDe = (lesion, lesiones = []) => {
  if (!lesion?.jugador_id || !esFechaISO(lesion?.fecha_lesion)) return "";
  const d = lesion.datos || {};
  const hay = anterioresDe(lesion, lesiones).some((otra) => {
    const o = otra.datos || {};
    return (
      mismo(o.musculo, d.musculo) &&
      mismo(o.area, d.area) &&
      mismo(o.lado, d.lado) &&
      mismo(o.musculo_especifico, d.musculo_especifico) &&
      mismo(o.parte_cuerpo, d.parte_cuerpo)
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
    case "severidad":
      return lesion?.fecha_alta ? severidadPorDias(diasEntre(lesion.fecha_lesion, lesion.fecha_alta)) : "";
    case "recurrencia":
      return recurrenciaDe(lesion, lesiones, contexto.hoy);
    case "recidiva":
      return recidivaDe(lesion, lesiones);
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

// Las horas entre la lesión y la imagen las escribe el médico (el Excel no las calcula).
const esNumeroValido = (valor) => valor === null || valor === undefined || valor === "" || (Number.isFinite(Number(valor)) && Number(valor) >= 0);

// Lo que hay que corregir antes de guardar, como clave del diccionario.
// Devuelve "" si está todo bien.
export const validarLesion = (lesion, { hoy = hoyISO(), otras = [] } = {}) => {
  if (!lesion.jugador_id) return "lesiones.error.jugador";
  if (!esFechaISO(lesion.fecha_lesion)) return "lesiones.error.fecha";
  if (lesion.fecha_lesion > hoy) return "lesiones.error.fechaFutura";
  for (const clave of FECHAS_POSTERIORES) {
    const valor = lesion[clave];
    if (!valor) continue;
    if (!esFechaISO(valor) || valor < lesion.fecha_lesion) return "lesiones.error.fechaAntes";
    if (valor > hoy) return "lesiones.error.fechaFuturaOtra";
  }
  if (!lesion.datos?.parte_cuerpo) return "lesiones.error.parte";
  if (!lesion.datos?.lado) return "lesiones.error.lado";
  if (!esNumeroValido(lesion.datos?.horas_imagen)) return "lesiones.error.horas";
  if (seSolapa(lesion, otras)) return "lesiones.error.solapada";
  return "";
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

// Si es una recaída: la lesión anterior del mismo jugador, parte del cuerpo y
// lado cuya alta fue hace menos de DIAS_RECIDIVA días. Devuelve esa lesión o null.
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
        (diasEntre(otra.fecha_alta, lesion.fecha_lesion) ?? Infinity) <= DIAS_RECIDIVA,
    )
    .sort((a, b) => (a.fecha_alta < b.fecha_alta ? 1 : -1));
  return candidatas[0] || null;
};

export const lesionesActivas = (lesiones = []) =>
  lesiones.filter(estaActiva).sort((a, b) => (a.fecha_lesion < b.fecha_lesion ? -1 : 1));

export const ordenarHistorial = (lesiones = []) =>
  [...lesiones].sort((a, b) => {
    if (a.fecha_lesion !== b.fecha_lesion) return a.fecha_lesion < b.fecha_lesion ? 1 : -1;
    return (b.numero_caso ?? 0) - (a.numero_caso ?? 0);
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

// --------------------------------------------------------------- Filtro --
// Igual que el de Registros de Partido: se eligen criterios y la lesión tiene
// que cumplir todos. Los criterios fijos son el jugador, la etapa y la fecha
// de inicio; el resto son los desplegables del Excel, por su clave.

export const FILTRO = Object.freeze({ TODOS: "todos", JUGADOR: "jugador", ETAPA: "etapa", FECHA: "fecha" });

export const filtrarLesiones = (lesiones = [], { criterios = [], jugador = "", etapas = [], desde = "", hasta = "", listas = {} } = {}) =>
  lesiones.filter((lesion) =>
    criterios.every((cual) => {
      if (cual === FILTRO.JUGADOR) return !jugador || String(lesion.jugador_id) === String(jugador);
      if (cual === FILTRO.ETAPA) return etapas.length === 0 || etapas.includes(etapaDe(lesion));
      if (cual === FILTRO.FECHA) {
        return (!desde || lesion.fecha_lesion >= desde) && (!hasta || lesion.fecha_lesion <= hasta);
      }
      const elegidas = listas[cual] || [];
      return elegidas.length === 0 || elegidas.includes(valorDe(lesion, cual));
    }),
  );

export const normalizarTexto = (texto) =>
  limpiar(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// El buscador de texto: por jugador, diagnóstico, comentarios, médico y los
// textos de los desplegables.
export const buscarEnLesiones = (lesiones = [], texto, { nombreDe = () => "", config = null, idioma = "es-AR" } = {}) => {
  const buscado = normalizarTexto(texto);
  if (!buscado) return lesiones;
  return lesiones.filter((lesion) => {
    const partes = [
      nombreDe(lesion.jugador_id),
      lesion.datos?.diagnostico,
      lesion.datos?.comentarios,
      lesion.datos?.medico,
      String(lesion.numero_caso ?? ""),
      ...Object.entries(lesion.datos || {}).map(([clave, valor]) =>
        campoPorClave(clave)?.tipo === "lista" ? etiquetaDeOpcion(clave, valor, config, idioma) : "",
      ),
    ];
    return normalizarTexto(partes.filter(Boolean).join(" ")).includes(buscado);
  });
};

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
