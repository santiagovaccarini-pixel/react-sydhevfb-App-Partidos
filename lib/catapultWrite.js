// Lógica pura del write test sobre el servicio interno de actividad: cómo se
// arma el período de prueba, cómo se normaliza la lectura interna al mismo
// formato que el snapshot de Connect, y cómo se valida lo escrito.
// Sin red. La única escritura real vive en api/openfield/cloud-write-test.js.

import { compararSnapshots, validarCorteEscrito } from "./openfieldPeriods.js";

export const NOMBRE_BASE_PRUEBA = "TEST APP";

const idAtleta = (atleta) => {
  if (typeof atleta === "string") return atleta;
  return String(atleta?.athlete_id ?? atleta?.id ?? "");
};

export const idsAtletas = (athletes) =>
  (Array.isArray(athletes) ? athletes : []).map(idAtleta).filter(Boolean);

// El servicio interno devuelve la actividad con start_time_ms / end_time_ms y
// los participantes adentro de cada período (el formato del batch). Se lo
// lleva a la misma forma que el snapshot de Connect para poder comparar con
// compararSnapshots y validarCorteEscrito.
export const normalizarInterno = (actividad) => {
  const numero = (valor) => {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  };

  return {
    activity: {
      id: String(actividad?.id || ""),
      name: String(actividad?.name || ""),
      start_ms: numero(actividad?.start_time_ms),
      end_ms: numero(actividad?.end_time_ms),
    },
    periods: (Array.isArray(actividad?.periods) ? actividad.periods : [])
      .map((periodo) => ({
        id: String(periodo?.id || ""),
        name: String(periodo?.name || ""),
        start_ms: numero(periodo?.start_time_ms),
        end_ms: numero(periodo?.end_time_ms),
        athletes: idsAtletas(periodo?.athletes).map((id) => ({ id })),
        is_deleted: false,
      }))
      .filter((periodo) => periodo.id),
  };
};

export const elegirNombreLibre = (periodos, base = NOMBRE_BASE_PRUEBA) => {
  const usados = new Set(
    (Array.isArray(periodos) ? periodos : []).map((periodo) =>
      String(periodo?.name || "")
        .trim()
        .toUpperCase(),
    ),
  );

  for (let numero = 1; numero <= 99; numero += 1) {
    const nombre = `${base} ${String(numero).padStart(2, "0")}`;
    if (!usados.has(nombre.toUpperCase())) return nombre;
  }

  return null;
};

const alSegundoArriba = (ms) => Math.ceil(ms / 1000) * 1000;
const alSegundoAbajo = (ms) => Math.floor(ms / 1000) * 1000;

// Ubica el corte de prueba dentro de la actividad: 10 minutos después del
// inicio y de 10 minutos, alineado a segundos enteros. Si la actividad es
// corta, se achica; si no entra un mínimo, no se escribe.
export const elegirVentanaPrueba = ({
  inicioActividadMs,
  finActividadMs,
  duracionMs = 10 * 60 * 1000,
  desplazamientoMs = 10 * 60 * 1000,
  minimoMs = 60 * 1000,
}) => {
  const inicio = Number(inicioActividadMs);
  const fin = Number(finActividadMs);

  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
    return { error: "La actividad no tiene un inicio y un fin válidos." };
  }

  const largo = fin - inicio;
  const duracion = Math.min(duracionMs, Math.floor(largo / 3));
  const desplazamiento = Math.min(desplazamientoMs, Math.floor(largo / 3));
  const startMs = alSegundoArriba(inicio + desplazamiento);
  const endMs = alSegundoAbajo(Math.min(startMs + duracion, fin));

  if (endMs - startMs < minimoMs) {
    return {
      error: `La actividad es demasiado corta para un corte de prueba de al menos ${minimoMs / 1000} segundos.`,
    };
  }

  return { startMs, endMs };
};

// Mismo formato que el batch observado en el editor: id, name, start_time_ms,
// end_time_ms y athletes tal cual vienen del servicio interno.
export const armarPeriodoNuevo = ({ id, nombre, startMs, endMs, athletes }) => ({
  id,
  name: nombre,
  start_time_ms: startMs,
  end_time_ms: endMs,
  athletes: Array.isArray(athletes) ? athletes : [],
});

export const armarBatch = (periodo) => ({ periods: [periodo] });

// Compara antes/después y valida el corte. Los participantes se validan aparte
// para que una diferencia de identificadores entre servicios no tape un
// resultado de tiempos exacto.
export const validarEscrituraBatch = ({ antes, despues, esperado }) => {
  const diff = compararSnapshots(antes, despues);
  const { athleteIds, ...sinAtletas } = esperado || {};
  const corte = validarCorteEscrito({ snapshot: despues, esperado: sinAtletas });
  const conAtletas = Array.isArray(athleteIds)
    ? validarCorteEscrito({ snapshot: despues, esperado })
    : null;

  const soloElNuevo =
    diff.agregados.length === 1 &&
    diff.agregados[0].name === esperado?.nombre &&
    diff.eliminados.length === 0 &&
    diff.modificados.length === 0;

  return {
    valido: soloElNuevo && corte.valido,
    soloElNuevo,
    diff,
    corte,
    participantes: conAtletas
      ? {
          valido: conAtletas.valido,
          detalle: conAtletas.participantes || null,
          problemas: conAtletas.problemas || [],
        }
      : null,
  };
};

export const veredictoEscritura = ({ putStatus, interna, connect }) => {
  const putOk = putStatus >= 200 && putStatus < 300;

  if (!putOk) {
    const intacto = Boolean(interna?.diff?.sinCambios) && Boolean(connect?.diff?.sinCambios);
    return {
      codigo: "escritura-rechazada",
      detalle: `OpenField rechazó el batch (${putStatus || "sin respuesta"}).${
        intacto ? " Nada cambió." : " ATENCIÓN: hubo cambios igual; revisá el detalle."
      }`,
    };
  }

  if (interna?.valido && connect?.valido) {
    return {
      codigo: "escritura-validada",
      detalle:
        "El corte apareció exactamente como se pidió, en el servicio interno y en la API oficial, sin tocar los demás períodos.",
    };
  }

  if (interna?.diff?.sinCambios && connect?.diff?.sinCambios) {
    return {
      codigo: "sin-cambios",
      detalle: "OpenField aceptó el batch pero no cambió nada: ignoró el período.",
    };
  }

  return {
    codigo: "escritura-con-diferencias",
    detalle:
      "OpenField cambió algo, pero no exactamente lo pedido. Revisá agregados, eliminados y modificados antes de seguir.",
  };
};
