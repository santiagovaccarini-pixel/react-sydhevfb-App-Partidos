import { esNumero } from "./valores.js";
import { COLORES_INFORME, claveDeNombre, desvio, franjasDelObjetivo, promedio, sesionesDelObjetivo, valorDeFiltro } from "./porMicrociclo.js";

// GPS › Informe › Reporte individual: la hoja «Reporte Individual» del Excel
// del GPS, con sus tablas dinámicas (hoja «Datos»). Lo que decidió Santiago
// el 16/10 está en docs/PENDIENTES.md («Reporte individual (16/10)»).
//
// Las segmentaciones del archivo: Nombre (un jugador), Tipo de Sesión,
// Fecha y Microciclo; las tablas dinámicas fijan Condición «Total» (Va,
// todas). Las cuatro tablas, cada una con los últimos 10 (de la fecha más
// nueva para atrás; en el mismo día, en el orden de carga):
//   · Por jugador, las del jugador elegido. Totales: Tiempo, las 9 medidas,
//     PSE, U.A. y Descripción, con «Promedio» y «Suma». Por minuto: Tiempo y
//     las 9 por minuto, con «Promedio» (en las medidas, la suma de cada una ÷
//     los minutos de las filas que la tienen, como el archivo).
//   · Por equipo, las del promedio del equipo de la sesión (Team Average
//     Sesion), con «Promedio», «Desv. est.» y «Suma» (Totales) y «Promedio»
//     y «Desv. est.» (Por minuto).
// Los colores, de Tiempo y de las 9 medidas:
//   · Por equipo, como el archivo: contra el promedio y el desvío de su
//     tabla (desde promedio + 2 desvíos, verde oscuro; desde + 1, verde;
//     desde el promedio, amarillo; hasta − 1, naranja; más abajo, rojo). En
//     Por minuto, el amarillo llega hasta el promedio + el desvío de la tabla
//     de Totales (así está en el archivo; Santiago, 16/10, no lo corrigió).
//   · Por jugador, contra el equipo ese día (Santiago, 16/10: «Contra el
//     equipo ese día»; el archivo lo anuncia pero no tiene la regla): el
//     Team Average de la sesión ± el desvío de los jugadores, como Objetivo
//     en Por microciclo, con la misma regla.

export const FILTROS_DEL_REPORTE = Object.freeze(["tipo_sesion", "fecha", "microciclo"]);
export const CUANTAS = 10;
export const COLUMNAS_TOTALES = Object.freeze(["tiempo", "d", "d_shi", "d_acchi", "d_dechi", "d_mphi", "d_s6", "d_a8", "d_a1", "d_mp5"]);
export const COLUMNAS_POR_MINUTO = Object.freeze(COLUMNAS_TOTALES.map((clave) => (clave === "tiempo" ? clave : `${clave}_min`)));
export const DE_LA_CARGA = Object.freeze(["pse", "ua"]);

// Lo que entra: Condición Total (las tablas dinámicas del archivo).
export const entraEnElReporte = (fila) => fila?.datos?.condicion === "total";
export const esDelEquipo = (fila) => fila?.promedio === "sesion";

// filtros: { filtro: [valores elegidos] }; sin nada elegido, todos.
export const pasaLosFiltrosDelReporte = (fila, filtros = {}) =>
  FILTROS_DEL_REPORTE.every((filtro) => {
    const elegidos = filtros[filtro];
    if (!elegidos || !elegidos.length) return true;
    const valor = valorDeFiltro(fila, filtro);
    return elegidos.some((elegido) => elegido === valor || String(elegido) === String(valor));
  });

// Los jugadores que se pueden elegir (sin el promedio del equipo).
export const jugadoresDelReporte = (filasGps) => {
  const vistos = new Set();
  filasGps.forEach((fila) => {
    if (entraEnElReporte(fila) && !fila.promedio) vistos.add(claveDeNombre(fila));
  });
  return [...vistos];
};

// Las filas de un jugador (su clave, la de Nombre) o del equipo.
export const filasDe = (filasGps, quien, filtros = {}) =>
  filasGps.filter((fila) => entraEnElReporte(fila) && pasaLosFiltrosDelReporte(fila, filtros) && (quien === "equipo" ? esDelEquipo(fila) : !fila.promedio && claveDeNombre(fila) === quien));

// Las últimas: de la fecha más nueva para atrás; en el mismo día, en el
// orden de carga (el de la tabla dinámica).
const ultimas = (filas) =>
  [...filas]
    .sort((a, b) => (a.fecha === b.fecha ? (a.orden ?? 0) - (b.orden ?? 0) : String(b.fecha || "").localeCompare(String(a.fecha || ""))))
    .slice(0, CUANTAS);

const CLAVES = [...new Set([...COLUMNAS_TOTALES, ...COLUMNAS_POR_MINUTO, ...DE_LA_CARGA])];
const filaDelReporte = (fila) => ({
  clave: fila.id,
  fecha: fila.fecha || "",
  descripcion: fila.datos?.descripcion ?? "",
  microciclo: fila.datos?.microciclo ?? null,
  valores: Object.fromEntries(CLAVES.map((clave) => [clave, esNumero(fila.datos?.[clave]) ? fila.datos[clave] : null])),
});

const numerosDe = (filas, clave) => filas.map((fila) => fila.valores[clave]).filter(esNumero);
const sumar = (numeros) => numeros.reduce((total, x) => total + x, 0);

// Los minutos del tiempo sumado, en segundos enteros como el archivo (HORA ×
// 60 + MINUTO + SEGUNDO ÷ 60). El archivo contaba los días × 24 y no × 1440:
// si los tiempos juntos pasaban las 24 h, daba menos minutos y el Por minuto
// más alto. Santiago, 16/10: «Corregirlo»; por debajo de las 24 h da lo mismo.
export const minutosDe = (segundos) => (esNumero(segundos) ? Math.round(segundos) / 60 : null);

// Las cuentas de abajo de cada tabla.
const totalesDe = (filas) => ({
  promedio: Object.fromEntries([...COLUMNAS_TOTALES, ...DE_LA_CARGA].map((clave) => [clave, promedio(numerosDe(filas, clave))])),
  suma: Object.fromEntries([...COLUMNAS_TOTALES, "ua"].map((clave) => [clave, filas.length ? sumar(numerosDe(filas, clave)) : null])),
  desvio: Object.fromEntries(COLUMNAS_TOTALES.map((clave) => [clave, desvio(numerosDe(filas, clave))])),
});
const porMinutoDe = (filas, totales) => ({
  promedio: Object.fromEntries([
    ...COLUMNAS_POR_MINUTO.map((clave, i) => {
      if (clave === "tiempo") return [clave, promedio(numerosDe(filas, "tiempo"))];
      const medida = COLUMNAS_TOTALES[i];
      const minutos = minutosDe(sumar(filas.filter((fila) => esNumero(fila.valores[medida])).map((fila) => fila.valores.tiempo).filter(esNumero)));
      return [clave, esNumero(totales.suma[medida]) && minutos ? totales.suma[medida] / minutos : null];
    }),
    ...DE_LA_CARGA.map((clave) => [clave, totales.promedio[clave]]),
  ]),
  desvio: Object.fromEntries(COLUMNAS_POR_MINUTO.map((clave) => [clave, desvio(numerosDe(filas, clave))])),
});

// La regla de los colores (la del archivo para «Por equipo»): techo, hasta
// dónde llega el amarillo arriba del promedio (el desvío, salvo en Por
// minuto, ver arriba).
export const colorDelReporte = (valor, media, desv, techo = desv) => {
  if (!esNumero(valor) || !esNumero(media) || !esNumero(desv)) return null;
  if (valor >= media + 2 * desv) return COLORES_INFORME.excelente;
  if (valor >= media + desv) return COLORES_INFORME.muyBueno;
  if (valor >= media) return esNumero(techo) && valor < media + techo ? COLORES_INFORME.bueno : null;
  if (valor >= media - desv) return COLORES_INFORME.naranja;
  return COLORES_INFORME.malo;
};

// Todo el reporte. opciones: { jugador (la clave de Nombre), filtros }.
export const reporteIndividual = (filasGps, { jugador, filtros = {} } = {}) => {
  const delJugador = jugador ? filasDe(filasGps, jugador, filtros) : [];
  const delEquipo = filasDe(filasGps, "equipo", filtros);
  const filasJugador = ultimas(delJugador).map(filaDelReporte);
  const filasEquipo = ultimas(delEquipo).map(filaDelReporte);

  // Por equipo: contra su tabla.
  const totalesEquipo = totalesDe(filasEquipo);
  const porMinutoEquipo = porMinutoDe(filasEquipo, totalesEquipo);
  filasEquipo.forEach((fila) => {
    fila.colores = {
      totales: Object.fromEntries(COLUMNAS_TOTALES.map((clave) => [clave, colorDelReporte(fila.valores[clave], totalesEquipo.promedio[clave], totalesEquipo.desvio[clave])])),
      porMinuto: Object.fromEntries(
        COLUMNAS_POR_MINUTO.map((clave, i) => [clave, colorDelReporte(fila.valores[clave], porMinutoEquipo.promedio[clave], porMinutoEquipo.desvio[clave], totalesEquipo.desvio[COLUMNAS_TOTALES[i]])]),
      ),
    };
  });

  // Por jugador: contra el equipo ese día (la sesión de su fecha y su
  // microciclo, como Objetivo).
  const sesiones = new Map(sesionesDelObjetivo(filasGps, filtros).map((sesion) => [`${sesion.microciclo ?? ""}|${sesion.fecha}`, sesion]));
  const totalesJugador = totalesDe(filasJugador);
  const porMinutoJugador = porMinutoDe(filasJugador, totalesJugador);
  filasJugador.forEach((fila) => {
    const sesion = sesiones.get(`${fila.microciclo ?? ""}|${fila.fecha}`);
    const contraElEquipo = (clave) => {
      const franjas = sesion ? franjasDelObjetivo([sesion], clave) : null;
      return colorDelReporte(fila.valores[clave], franjas?.bueno, franjas?.desvio);
    };
    fila.colores = {
      totales: Object.fromEntries(COLUMNAS_TOTALES.map((clave) => [clave, contraElEquipo(clave)])),
      porMinuto: Object.fromEntries(COLUMNAS_POR_MINUTO.map((clave) => [clave, contraElEquipo(clave)])),
    };
  });

  return {
    jugador: { filas: filasJugador, cuantas: delJugador.length, totales: totalesJugador, porMinuto: porMinutoJugador },
    equipo: { filas: filasEquipo, cuantas: delEquipo.length, totales: totalesEquipo, porMinuto: porMinutoEquipo },
  };
};
