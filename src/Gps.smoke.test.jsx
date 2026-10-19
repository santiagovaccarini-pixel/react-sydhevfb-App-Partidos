import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Todo inventado: ningún nombre ni valor sale del Excel del club.
const datos = vi.hoisted(() => ({
  equipo: { id: "eq-1", nombre: "Club de Prueba" },
  filas: [],
  errorAlLeer: "",
  // Si está, cuántas filas dice la base que tiene el período (para probar
  // el aviso de demasiadas sin armar 20.000 filas).
  totalFalso: null,
  lecturas: [],
  creadas: [],
  actualizadas: [],
  borradas: [],
  ajustes: { campos: [], opciones: [] },
  cabeceras: [],
  opciones: [],
  // Lo que se pidió cambiar en las descripciones ya guardadas (nota del 12/10).
  descripciones: [],
  plantel: [],
  reglas: {},
  faltanReglas: false,
  reglasGuardadas: [],
  // Los V.R. de cada dispositivo (gps_referencias), si falta la tabla o la
  // actualización para cambiarlos, lo que se pidió cambiar y el historial.
  referencias: [],
  faltanReferencias: false,
  sinEdicionVr: false,
  // Sin la actualización 20261108: «Agregar V.R.» sin la planilla.
  sinPlanilla: true,
  cambiosVr: [],
  historialVr: [],
  partidos: [],
  // Las cargas sin terminar: las filas (con lo hecho) y lo que pidió la app.
  enCurso: [],
  dejadas: [],
  // La copia del GPS en el aparato (null: no hay) y lo que se guardó en ella.
  copia: null,
  copiasGuardadas: [],
  // Las puestas al día pedidas (con la copia o después de cargar).
  alDia: [],
  // El consentimiento de las personas fuera de Datos básicos (20261103): las
  // ya confirmadas y las que se confirmaron al guardar.
  personasConfirmadas: [],
  confirmaciones: [],
}));

const PLANTEL = [
  { id: 1, nombre: "ALFA", roles: [], puestos: [], actual: true },
  { id: 2, nombre: "BETA", roles: [], puestos: [], actual: true },
  { id: 3, nombre: "GAMA", roles: [], puestos: [], actual: false },
];

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => datos.equipo,
  cargarEquipos: async () => ({ equipos: [] }),
  elegirEquipoInicial: () => null,
  guardarEquipoElegido: () => {},
  esElCam: () => false,
  soloParaMirar: (equipo, modulo) => Array.isArray(equipo?.solo_lectura) && equipo.solo_lectura.includes(modulo),
}));
vi.mock("./domain/lesionesDb.js", () => ({
  cargarPlantelLesiones: async () => ({ plantel: datos.plantel.map((jugador) => ({ ...jugador })), error: "" }),
}));
vi.mock("./domain/plantel.js", async (importOriginal) => ({
  ...(await importOriginal()),
  // El nombre de ALFA en Catapult (el vínculo de Datos básicos).
  cargarPlantelConCatapult: async () => ({ plantel: [{ id: 1, nombre: "ALFA", catapult_nombre: "A. Alfa" }], error: "" }),
}));
// Como la base: por fecha y en el orden de carga.
const porFechaYOrden = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.orden - b.orden);
const copiar = (filas) => filas.map((fila) => ({ ...fila, datos: { ...fila.datos } }));
vi.mock("./domain/copiaGps.js", () => ({
  leerCopiaGps: async () => (datos.copia ? { filas: copiar(datos.copia.filas), hasta: datos.copia.hasta } : null),
  guardarCopiaGps: async (cuenta, equipoId, copia) => {
    datos.copiasGuardadas.push({ cuenta, equipoId, filas: copia.filas.length, hasta: copia.hasta });
    return true;
  },
  borrarCopiasGps: async () => true,
}));
vi.mock("./domain/consentimientoDb.js", () => ({
  leerPersonasConfirmadas: async () => ({ personas: new Set(datos.personasConfirmadas), sinTabla: false, error: "" }),
  confirmarPersonas: async (equipoId, base, personas) => {
    datos.confirmaciones.push({ equipoId, base, personas });
    datos.personasConfirmadas.push(...personas.map((nombre) => nombre.toLowerCase()));
    return { error: "" };
  },
}));
vi.mock("./domain/referenciasDb.js", () => ({
  leerHistorialDeReferencias: async () => ({ cambios: datos.historialVr.map((una) => ({ ...una })), faltaTabla: false, error: "" }),
}));
vi.mock("./domain/gpsDb.js", () => ({
  SOLO_PROMEDIOS: "promedio",
  SIN_DISPOSITIVO: "-",
  cuentaDeLaSesion: async () => "cuenta-1",
  unirFilasGps: (viejas, recientes) => [...viejas.filter((fila) => !recientes.some((una) => una.id === fila.id)), ...recientes].sort(porFechaYOrden),
  // La primera vez: las últimas semanas y después las demás.
  traerTodoGps: async (equipoId, { desdeReciente, alPrimeraParte, alAvanzar } = {}) => {
    datos.lecturas.push({ equipoId, desde: desdeReciente, todo: true });
    if (datos.errorAlLeer) return { recientes: [], viejas: [], hasta: null, error: datos.errorAlLeer };
    const todas = [...datos.filas].sort(porFechaYOrden);
    const recientes = copiar(todas.filter((fila) => fila.fecha >= desdeReciente));
    alPrimeraParte?.(recientes);
    const viejas = copiar(todas.filter((fila) => fila.fecha < desdeReciente));
    alAvanzar?.(viejas.length, viejas.length);
    if (datos.errorHistorial) return { recientes, viejas: [], hasta: null, error: datos.errorHistorial };
    return { recientes, viejas, hasta: "2026-10-13T12:00:00Z", error: "" };
  },
  // Al día: lo que tiene la base ahora.
  ponerAlDiaGps: async (equipoId, { filas = [], hasta = null } = {}) => {
    datos.alDia.push({ equipoId, filas: filas.length, hasta });
    const ahora = copiar([...datos.filas].sort(porFechaYOrden));
    const cambio = JSON.stringify(ahora) !== JSON.stringify(filas);
    return { filas: cambio ? ahora : filas, hasta: "2026-10-13T13:00:00Z", cambio, error: "" };
  },
  listarGps: async (equipoId, { desde = null, hasta = null, jugador = "", dispositivo = "", maximo = null } = {}) => {
    datos.lecturas.push({ equipoId, desde, hasta, jugador, dispositivo, maximo });
    if (datos.errorAlLeer) return { filas: [], total: 0, demasiadas: false, error: datos.errorAlLeer };
    // Como la base: lo pedido, por fecha y en el orden de carga.
    const filas = datos.filas
      .filter((fila) => (!desde || fila.fecha >= desde) && (!hasta || fila.fecha <= hasta))
      .filter((fila) => (!jugador ? true : jugador === "promedio" ? Boolean(fila.promedio) : String(fila.jugador_id) === jugador))
      .filter((fila) => (!dispositivo ? true : dispositivo === "-" ? !fila.datos.dispositivo : fila.datos.dispositivo === dispositivo))
      .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.orden - b.orden));
    const total = datos.totalFalso ?? filas.length;
    if (maximo && total > maximo) return { filas: [], total, demasiadas: true, error: "" };
    return { filas: filas.map((fila) => ({ ...fila, datos: { ...fila.datos } })), total, demasiadas: false, error: "" };
  },
  crearFilasGps: async (equipoId, filas, { alAvanzar } = {}) => {
    const creadas = filas.map((fila, i) => ({ id: `nueva-${datos.creadas.length + i + 1}`, equipo_id: equipoId, orden: 100 + datos.creadas.length + i, jugador_id: null, persona: null, promedio: null, ...fila }));
    datos.creadas.push(...filas);
    datos.filas.push(...creadas);
    alAvanzar?.(filas.length, filas.length);
    return { creadas, error: "" };
  },
  actualizarFilaGps: async (id, fila) => {
    datos.actualizadas.push({ id, fila });
    const guardada = { ...datos.filas.find((una) => una.id === id), ...fila, id };
    datos.filas = datos.filas.map((una) => (una.id === id ? guardada : una));
    return { fila: guardada, error: "" };
  },
  borrarFilasGps: async (ids) => {
    datos.borradas.push(...ids);
    datos.filas = datos.filas.filter((una) => !ids.includes(una.id));
    return { borradas: [...ids], error: "" };
  },
  leerAjustesGps: async () => ({ campos: [...datos.ajustes.campos], opciones: [...datos.ajustes.opciones], sinSentido: datos.sinSentido, error: "" }),
  guardarCabeceraGps: async (equipoId, campo, { etiquetas = {}, oculto = false, orden = 0, tipo = null, sentido = null }) => {
    datos.cabeceras.push({ equipoId, campo, etiquetas, oculto, orden, tipo, sentido });
    datos.ajustes.campos = [
      ...datos.ajustes.campos.filter((fila) => fila.campo !== campo),
      { campo, etiqueta_es: etiquetas["es-AR"] || "", etiqueta_pt: etiquetas["pt-BR"] || "", oculto, orden, tipo, sentido },
    ];
    return { error: "" };
  },
  leerReglasGps: async () => ({ reglas: { ...datos.reglas }, faltaTabla: datos.faltanReglas, error: "" }),
  leerReferenciasGps: async () => ({
    referencias: datos.referencias.map((una) => ({ ...una, promedio: { ...una.promedio }, desvio: { ...una.desvio }, categorias: JSON.parse(JSON.stringify(una.categorias || {})) })),
    faltaTabla: datos.faltanReferencias,
    sinEdicion: datos.sinEdicionVr,
    sinPlanilla: datos.sinPlanilla,
    error: "",
  }),
  // «Recalcular» (o volver atrás un recálculo): todo de un saque.
  recalcularReferenciaGps: async (id, nuevos) => {
    datos.cambiosVr.push({ que: "recalcular", id, ...JSON.parse(JSON.stringify(nuevos)) });
    const referencia = datos.referencias.find((una) => una.id === id);
    if (!referencia) return { error: "gps.error.sinPermiso" };
    Object.assign(referencia, JSON.parse(JSON.stringify(nuevos)));
    return { referencia: { ...referencia }, error: "" };
  },
  // Como la base: el promedio, el desvío o una categoría (las de los V.R. por jugador).
  cambiarValorDeReferenciaGps: async (id, cual, clave, valor) => {
    datos.cambiosVr.push({ que: "valor", id, cual, clave, valor });
    const referencia = datos.referencias.find((una) => una.id === id);
    if (!referencia) return { error: "gps.error.sinPermiso" };
    const enCategoria = ["excelente", "muy_bueno", "regular", "malo"].includes(cual);
    const nuevos = { ...(enCategoria ? referencia.categorias?.[cual] : referencia[cual]), [clave]: valor };
    if (valor === null) delete nuevos[clave];
    if (enCategoria) referencia.categorias = { ...referencia.categorias, [cual]: nuevos };
    else referencia[cual] = nuevos;
    return { referencia: { ...referencia }, error: "" };
  },
  marcarDePartidoGps: async (id, marcar) => {
    datos.cambiosVr.push({ que: "partido", id, marcar });
    const referencia = datos.referencias.find((una) => una.id === id);
    datos.referencias = datos.referencias.map((una) => (una.dispositivo === referencia.dispositivo ? { ...una, dePartido: una.id === id ? marcar : marcar ? false : una.dePartido } : una));
    return { referencias: datos.referencias.filter((una) => una.dispositivo === referencia.dispositivo).map((una) => ({ ...una })), error: "" };
  },
  sumarReferenciaGps: async (equipoId, nueva) => {
    datos.cambiosVr.push({ que: "sumar", ...nueva });
    const referencia = { id: `n${datos.referencias.length + 1}`, dePartido: false, promedio: {}, desvio: {}, ...nueva };
    datos.referencias.push(referencia);
    return { referencia: { ...referencia }, error: "" };
  },
  renombrarReferenciaGps: async (id, { tipo, tabla, grupo }) => {
    datos.cambiosVr.push({ que: "nombre", id, tipo, tabla, grupo });
    const referencia = datos.referencias.find((una) => una.id === id);
    Object.assign(referencia, { tipo, tabla, grupo });
    return { referencia: { ...referencia }, error: "" };
  },
  borrarReferenciaGps: async (id) => {
    datos.cambiosVr.push({ que: "borrar", id });
    datos.referencias = datos.referencias.filter((una) => una.id !== id);
    return { error: "" };
  },
  partidoDelDia: async (equipoId, fecha) => datos.partidos.find((partido) => partido.fecha === fecha) || null,
  // El último dispositivo que eligió la cuenta al pegar y al cargar un CSV.
  leerDispositivosRecordados: async () => ({ ...datos.recordados }),
  recordarDispositivo: async (equipoId, lugar, dispositivo) => {
    datos.recordar.push({ equipoId, lugar, dispositivo });
    datos.recordados = { ...datos.recordados, [lugar]: dispositivo };
    return { error: "" };
  },
  listarEnCurso: async () => ({ enCurso: datos.enCurso.map(({ datos: hecho, ...fila }) => ({ ...fila })), faltaTabla: false, error: "" }),
  enCursoDelDia: async (equipoId, fecha) => {
    const fila = datos.enCurso.find((una) => una.fecha === fecha);
    if (!fila) return { enCurso: null, error: "" };
    const { datos: hecho, ...resto } = fila;
    return { enCurso: { ...resto }, error: "" };
  },
  leerEnCurso: async (id) => {
    const fila = datos.enCurso.find((una) => una.id === id);
    return fila ? { enCurso: JSON.parse(JSON.stringify(fila)), error: "" } : { enCurso: null, error: "gps.enCurso.noEsta" };
  },
  // Como la base: una por día; con id, solo si la versión es la que se abrió.
  dejarEnCurso: async (equipoId, { id, version, fecha, paso, resumen, datos: hecho }) => {
    datos.dejadas.push({ id, version, fecha, paso, resumen, datos: JSON.parse(JSON.stringify(hecho)) });
    const quien = { actualizado_email: "yo@club.com", actualizado_en: "2026-10-13T13:49:00Z" };
    if (!id) {
      if (datos.enCurso.some((una) => una.fecha === fecha)) return { id: null, version: null, error: "gps.enCurso.yaEnCurso" };
      const nueva = { id: `ec${datos.enCurso.length + 1}`, fecha, paso, resumen, version: 1, creado_email: "yo@club.com", creado_en: quien.actualizado_en, ...quien, datos: JSON.parse(JSON.stringify(hecho)) };
      datos.enCurso.push(nueva);
      return { id: nueva.id, version: 1, error: "" };
    }
    const fila = datos.enCurso.find((una) => una.id === id);
    if (!fila) return { id: null, version: null, error: "gps.enCurso.noEsta" };
    if (fila.version !== version) return { id: null, version: null, error: "gps.enCurso.otroAparato" };
    Object.assign(fila, { fecha, paso, resumen, version: fila.version + 1, ...quien, datos: JSON.parse(JSON.stringify(hecho)) });
    return { id, version: fila.version, error: "" };
  },
  borrarEnCurso: async (id) => {
    datos.enCurso = datos.enCurso.filter((una) => una.id !== id);
    return { error: "" };
  },
  guardarReglasGps: async (equipoId, reglas) => {
    datos.reglasGuardadas.push({ equipoId, reglas });
    datos.reglas = { ...reglas };
    return { error: "" };
  },
  guardarOpcionGps: async (equipoId, lista, { codigo, etiquetas = {}, oculto = false, orden = 0 }) => {
    datos.opciones.push({ equipoId, lista, codigo, etiquetas, oculto, orden });
    datos.ajustes.opciones = [
      ...datos.ajustes.opciones.filter((fila) => !(fila.lista === lista && fila.codigo === codigo)),
      { lista, codigo, etiqueta_es: etiquetas["es-AR"] || "", etiqueta_pt: etiquetas["pt-BR"] || "", oculto, orden },
    ];
    return { error: "" };
  },
  cambiarEnDescripcionesGps: async (equipoId, antes, despues) => {
    datos.descripciones.push({ equipoId, antes, despues });
    return { cambiadas: 1, error: "" };
  },
}));

const { default: Gps } = await import("./Gps.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");
const { fechaCorta, fechaLarga, hoyISO } = await import("./idioma/formatos.js");

const diasAntes = (dias) => {
  const [anio, mes, dia] = hoyISO().split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia - dias)).toISOString().slice(0, 10);
};
const HOY = hoyISO();
const AYER = diasAntes(1);

const fila = (id, orden, quien, fecha, valores) => ({ id, equipo_id: "eq-1", orden, fecha, jugador_id: null, persona: null, promedio: null, ...quien, datos: valores });
// Tres filas de Catapult de ayer (dos jugadores y el promedio de un partido
// oficial) y una vieja, fuera del período.
const FILAS = () => [
  fila("g1", 1, { jugador_id: 1 }, AYER, { microciclo: 30, puesto: "DEL", d: 4000, d_min: 80, tiempo: 3000, dispositivo: "catapult" }),
  fila("g2", 2, { jugador_id: 2 }, AYER, { microciclo: 30, d: 5000, d_min: 100, tiempo: 3000, dispositivo: "catapult" }),
  fila("g3", 3, { promedio: "parcial" }, AYER, { microciclo: 30, d: 4500, d_min: 90, tiempo: 3000, tarea_partido: "partido_oficial_torneo", dispositivo: "catapult" }),
];
// Una del historial (de hace dos meses, con el otro dispositivo).
const VIEJA = () => fila("g0", 0, { jugador_id: 3 }, diasAntes(60), { microciclo: 20, d: 1000, dispositivo: "sport" });
const DISPOSITIVOS = [
  { lista: "dispositivo", codigo: "catapult", etiqueta_es: "Catapult", etiqueta_pt: "", oculto: false, orden: 0 },
  { lista: "dispositivo", codigo: "sport", etiqueta_es: "Sport", etiqueta_pt: "", oculto: false, orden: 1 },
];

const botones = () => [...document.body.querySelectorAll("button")];
const boton = (etiqueta) => botones().find((b) => b.textContent.trim() === etiqueta);
// Avanzar dice a qué paso va: «Siguiente: La sesión».
const siguiente = () => botones().find((b) => b.textContent.trim().startsWith("Siguiente"));
const tocar = async (elemento) => {
  expect(elemento, "no se encontró el botón").toBeTruthy();
  await act(async () => elemento.click());
};
const escribir = async (elemento, valor) => {
  await act(async () => {
    const prototipo = elemento.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototipo, "value").set.call(elemento, valor);
    elemento.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const elegir = async (select, valor) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(select, valor);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
// Lo que se calcula después de mostrar "Leyendo…" (pegar desde Excel).
const esperar = async (condicion) => {
  for (let i = 0; i < 50 && !condicion(); i += 1) {
    await act(async () => new Promise((resolver) => setTimeout(resolver, 20))); // eslint-disable-line no-await-in-loop
  }
  expect(condicion(), "no llegó lo esperado").toBe(true);
};
const cabeceras = (contenedor) => [...contenedor.querySelectorAll("th[data-columna]")].map((th) => th.textContent);
const columna = (contenedor, titulo) => cabeceras(contenedor).indexOf(titulo);
const filas = (contenedor) => [...contenedor.querySelectorAll("tbody tr")];
const celda = (contenedor, f, titulo) => filas(contenedor)[f].querySelectorAll("td")[columna(contenedor, titulo)];
const fijas = (contenedor) => contenedor.querySelectorAll("thead tr.tabla-datos-cabeceras th.inmovil").length;
const filasDeArriba = (contenedor) => [...contenedor.querySelectorAll("tr.tabla-datos-arriba")];
const filaDeArriba = (contenedor, rotulo) => filasDeArriba(contenedor).find((tr) => tr.querySelector("th.tabla-datos-arriba-rotulo")?.textContent === rotulo);
const celdaDeArriba = (contenedor, tr, titulo) => tr.querySelectorAll("td")[columna(contenedor, titulo) - fijas(contenedor)];
const irA = async (contenedor, nombre) => tocar([...contenedor.querySelectorAll(".navegacion-movil button")].find((b) => b.textContent.includes(nombre)));
const ajuste = (titulo) => [...document.body.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b")?.textContent === titulo);
const editarCelda = async (contenedor, f, titulo, valor) => {
  const td = () => celda(contenedor, f, titulo);
  await tocar(td());
  await tocar(td());
  const input = td().querySelector("input");
  await escribir(input, valor);
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
};

describe("GPS", () => {
  let contenedor;
  let raiz;
  let volvio;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    localStorage.clear();
    sessionStorage.clear();
    // La guía ya se ofreció (se prueba aparte).
    localStorage.setItem("guia_vista:gps", "1");
    datos.equipo = { id: "eq-1", nombre: "Club de Prueba" };
    datos.filas = FILAS();
    datos.errorAlLeer = "";
    datos.totalFalso = null;
    datos.lecturas = [];
    datos.creadas = [];
    datos.actualizadas = [];
    datos.borradas = [];
    datos.ajustes = { campos: [], opciones: [...DISPOSITIVOS] };
    datos.cabeceras = [];
    datos.sinSentido = false;
    datos.opciones = [];
    datos.descripciones = [];
    datos.plantel = PLANTEL.map((jugador) => ({ ...jugador }));
    datos.reglas = {};
    datos.faltanReglas = false;
    datos.reglasGuardadas = [];
    datos.referencias = [];
    datos.faltanReferencias = false;
    datos.sinEdicionVr = false;
    datos.sinPlanilla = true;
    datos.cambiosVr = [];
    datos.historialVr = [];
    datos.partidos = [];
    datos.enCurso = [];
    datos.dejadas = [];
    datos.copia = null;
    datos.copiasGuardadas = [];
    datos.alDia = [];
    datos.personasConfirmadas = [];
    datos.confirmaciones = [];
    datos.errorHistorial = "";
    datos.recordados = { pegar: "", csv: "" };
    datos.recordar = [];
    volvio = 0;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    fijarIdiomaParaPruebas("es-AR");
  });

  const montar = async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<Gps onVolver={() => (volvio += 1)} volverA="portal.basesTitulo" />);
    });
  };
  // Abre en Cargar (como Evaluaciones): la Base, en la barra.
  const montarEnLaBase = async () => {
    await montar();
    await irA(contenedor, "Base");
  };

  test("la Base abre con todas las filas, el informe del Excel arriba y sus colores", async () => {
    await montarEnLaBase();
    expect(contenedor.querySelector(".etiqueta-hero").textContent).toBe("GPS");
    expect(contenedor.querySelector(".estado-hero").textContent).toBe("3 filas");
    // Todo el historial (Santiago, 14/10); arriba, la fecha de hoy, como en Cargar.
    const hoyLargo = fechaLarga(HOY);
    expect(contenedor.querySelector(".fecha-hero").textContent).toBe(hoyLargo.charAt(0).toUpperCase() + hoyLargo.slice(1));
    // Se trajo todo: primero desde hace 27 días (4 semanas con hoy).
    expect(datos.lecturas).toEqual([{ equipoId: "eq-1", desde: diasAntes(27), todo: true }]);

    // Las columnas del Excel en su orden, con Microciclo, Nombre y Puesto fijas.
    expect(cabeceras(contenedor).slice(0, 5)).toEqual(["Microciclo", "Nombre", "Puesto", "D", "14,4-25Km/h"]);
    expect(cabeceras(contenedor).at(-1)).toBe("Dispositivo");
    expect(fijas(contenedor)).toBe(3);
    expect(filas(contenedor).map((tr) => tr.querySelectorAll("td")[columna(contenedor, "Nombre")].textContent)).toEqual(["ALFA", "BETA", "Team Average Parcial"]);
    expect(celda(contenedor, 0, "D").textContent).toBe("4000,0");
    expect(celda(contenedor, 0, "Tiempo").textContent).toBe("0:50:00");
    expect(celda(contenedor, 0, "Dispositivo").textContent).toBe("Catapult");
    expect(celda(contenedor, 0, "Fecha").textContent).toBe(fechaCorta(AYER));

    // Arriba, solo el promedio de lo que se ve, el V.R. y el % (Santiago,
    // 12/10 y 14/10): sin Excelente … Mín. Sin V.R. cargados, esas dos vacías.
    expect(filasDeArriba(contenedor).map((tr) => tr.querySelector("th").textContent)).toEqual(["Promedio", "V.R.", "% vs V.R."]);
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Promedio"), "D").textContent).toBe("4500,0");
    // Por minuto: el promedio de D ÷ el de los minutos (50).
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Promedio"), "D/min").textContent).toBe("90,0");
    // Una columna sin números queda vacía.
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Promedio"), "HDOP").textContent).toBe("");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "V.R."), "D").textContent).toBe("");
    expect(contenedor.querySelector(".gps-comparacion-sin").textContent).toBe("Este dispositivo todavía no tiene V.R.: se cargan en Valores de referencia.");

    // Los colores del Excel, más suaves (Santiago, 15/10), contra promedio ±
    // desvío: verde claro, naranja y amarillo.
    // Las celdas, con el degradé de blanco a su color fuerte (17/10).
    expect(celda(contenedor, 1, "D").style.background).toContain("rgb(159, 214, 138)");
    expect(celda(contenedor, 0, "D").style.background).toContain("rgb(238, 148, 71)");
    expect(celda(contenedor, 2, "D").style.background).toContain("rgb(245, 220, 63)");
    // El promedio de un partido oficial, en gris en la columna Nombre.
    expect(celda(contenedor, 2, "Nombre").style.background).toBe("rgb(213, 217, 223)");

    // Arriba se vuelve a Bases de Datos.
    await tocar(boton("Bases de Datos"));
    expect(volvio).toBe(1);
  });

  test("con todo el historial, cada dispositivo con su informe y sus colores", async () => {
    datos.filas = [...FILAS(), VIEJA()];
    await montarEnLaBase();
    expect(filas(contenedor)).toHaveLength(4);
    // Dos dispositivos: un informe para cada uno, con su nombre, en el orden
    // de su lista (aunque la vieja, de Sport, vaya primero en la tabla).
    expect(filas(contenedor)[0].querySelectorAll("td")[columna(contenedor, "Nombre")].textContent).toBe("GAMA");
    expect(filasDeArriba(contenedor)).toHaveLength(6);
    expect(filasDeArriba(contenedor)[0].querySelector("th").textContent).toBe("CatapultPromedio");
    expect(filasDeArriba(contenedor)[3].querySelector("th").textContent).toBe("SportPromedio");
    // La de Sport es la única de su dispositivo: sin desvío, sin colores; las
    // de Catapult siguen como antes.
    const vieja = filas(contenedor).findIndex((tr) => tr.querySelectorAll("td")[columna(contenedor, "Nombre")].textContent === "GAMA");
    expect(celda(contenedor, vieja, "D").style.background).toBe("");
    expect(filas(contenedor)[vieja].className).toContain("apagada");
    const beta = filas(contenedor).findIndex((tr) => tr.querySelectorAll("td")[columna(contenedor, "Nombre")].textContent === "BETA");
    expect(celda(contenedor, beta, "D").style.background).toContain("rgb(159, 214, 138)");
    expect(datos.lecturas).toHaveLength(1);
  });

  test("arriba, cada dispositivo con su V.R., el % contra él y las Comparaciones, como el Excel", async () => {
    // Inventados: Catapult con dos V.R. (el de partido primero); Sport con uno.
    datos.referencias = [
      { id: "r1", dispositivo: "catapult", tipo: "FUTBOL", tabla: "Partido", grupo: "TOTAL", orden: 1, promedio: { d: 5000, d_min: 100, d_acchi: 50, tiempo: 3600 }, desvio: {} },
      { id: "r2", dispositivo: "catapult", tipo: "FUTBOL", tabla: "Otra", grupo: "TOTAL", orden: 2, promedio: { d: 4000, d_min: 120 }, desvio: {} },
      { id: "r3", dispositivo: "sport", tipo: "FUTBOL", tabla: "Vieja", grupo: "TOTAL", orden: 3, promedio: { d: 2000 }, desvio: {} },
    ];
    datos.filas = [...FILAS(), VIEJA()];
    await montarEnLaBase();
    const fila = (rotulo) => filaDeArriba(contenedor, rotulo);
    // Catapult: promedio 4500 contra 5000 (90 %); 90/min contra 100 (90 %); el
    // tiempo, 50 min contra 60 (83 %).
    expect(celdaDeArriba(contenedor, fila("CatapultV.R."), "D").textContent).toBe("5000,0");
    expect(celdaDeArriba(contenedor, fila("CatapultV.R."), "Tiempo").textContent).toBe("1:00:00");
    expect(celdaDeArriba(contenedor, fila("Catapult% vs V.R."), "D").textContent).toBe("90%");
    expect(celdaDeArriba(contenedor, fila("Catapult% vs V.R."), "D/min").textContent).toBe("90%");
    expect(celdaDeArriba(contenedor, fila("Catapult% vs V.R."), "Tiempo").textContent).toBe("83%");
    // Sin número en la columna (n° 1,7 a 2,7m/s2), sin %.
    expect(celdaDeArriba(contenedor, fila("Catapult% vs V.R."), "n° 1,7 a 2,7m/s2").textContent).toBe("");
    // Sport, contra el suyo: 1000 contra 2000.
    expect(celdaDeArriba(contenedor, fila("Sport% vs V.R."), "D").textContent).toBe("50%");

    // Las Comparaciones de cada dispositivo (Tarea Mixta: todas).
    const comparacion = (dispositivo) => [...contenedor.querySelectorAll(".gps-comparacion")].find((una) => una.querySelector(".gps-comparacion-vr > b").textContent === dispositivo);
    const numeros = (dispositivo) => [...comparacion(dispositivo).querySelectorAll(".gps-comparacion-numeros dd")].map((dd) => dd.textContent);
    expect(numeros("Catapult")).toEqual(["90%", "90%", "90%", "90%", "83%"]);
    expect(numeros("Sport")).toEqual(["50%", "50%", "—", "—", "—"]);
    expect([...comparacion("Catapult").querySelectorAll(".gps-comparacion-numeros dt")].map((dt) => dt.textContent)).toEqual([
      "Volumen promedio",
      "Volumen zona de impacto",
      "Densidad promedio",
      "Densidad zona de impacto",
      "Tiempo",
    ]);
    // Con la zona de impacto Fuerza, solo las aceleraciones y
    // desaceleraciones (acá, ninguna con número).
    const zona = contenedor.querySelector(".gps-comparaciones-zona select");
    expect(zona.value).toBe("tarea_mixta");
    await act(async () => {
      zona.value = "fuerza";
      zona.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(numeros("Catapult")).toEqual(["90%", "—", "90%", "—", "83%"]);

    // Otro V.R. para Catapult: cambia lo de arriba y queda en el aparato.
    const elegir = comparacion("Catapult").querySelector(".gps-comparacion-elegir select");
    expect([...elegir.options].map((opcion) => opcion.textContent)).toEqual(["FUTBOL · Partido · TOTAL", "FUTBOL · Otra · TOTAL"]);
    await act(async () => {
      elegir.value = "r2";
      elegir.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(celdaDeArriba(contenedor, fila("CatapultV.R."), "D").textContent).toBe("4000,0");
    expect(celdaDeArriba(contenedor, fila("Catapult% vs V.R."), "D/min").textContent).toBe("75%");
    expect(JSON.parse(localStorage.getItem("gps_vr:eq-1"))).toEqual({ zona: "fuerza", vr: { catapult: "r2" } });
  });

  test("sin la tabla de los V.R., lo dice y la Base sigue andando", async () => {
    datos.faltanReferencias = true;
    await montarEnLaBase();
    expect(filas(contenedor)).toHaveLength(3);
    expect(contenedor.querySelector(".gps-comparacion-sin").textContent).toBe("Para ver los V.R. falta una actualización de la base de datos. Avisale a quien administra la app.");
    expect(contenedor.querySelector(".gps-comparaciones-zona")).toBeNull();
  });

  test("al cambiar una medida o el Tiempo en la tabla se recalcula su por minuto", async () => {
    await montarEnLaBase();
    await editarCelda(contenedor, 0, "D", "4500");
    expect(datos.actualizadas).toHaveLength(1);
    expect(datos.actualizadas[0].id).toBe("g1");
    expect(datos.actualizadas[0].fila.datos).toEqual({ microciclo: 30, puesto: "DEL", d: 4500, d_min: 90, tiempo: 3000, dispositivo: "catapult" });
    expect(celda(contenedor, 0, "D/min").textContent).toBe("90,0");

    // El Tiempo se escribe como en el Excel (h:mm:ss) y se guarda en segundos.
    await editarCelda(contenedor, 0, "Tiempo", "1:00:00");
    expect(datos.actualizadas[1].fila.datos).toMatchObject({ d: 4500, d_min: 75, tiempo: 3600 });
    expect(celda(contenedor, 0, "Tiempo").textContent).toBe("1:00:00");
    // Un por minuto no se escribe.
    await tocar(celda(contenedor, 0, "D/min"));
    await tocar(celda(contenedor, 0, "D/min"));
    expect(celda(contenedor, 0, "D/min").querySelector("input")).toBeNull();
  });

  test("en Nombre se elige un jugador o el Team Average", async () => {
    await montarEnLaBase();
    await tocar(celda(contenedor, 1, "Nombre"));
    await tocar(celda(contenedor, 1, "Nombre"));
    await tocar([...document.body.querySelectorAll(".opcion-hoja")].find((b) => b.textContent === "Team Average Sesion"));
    expect(datos.actualizadas[0]).toMatchObject({ id: "g2", fila: { jugador_id: null, persona: null, promedio: "sesion" } });
    expect(celda(contenedor, 1, "Nombre").textContent).toBe("Team Average Sesion");
    expect(celda(contenedor, 1, "Nombre").style.background).toBe("rgb(244, 167, 167)");
  });

  // Santiago, 14/10: «saca esos 4 filtros de arriba de fechas, jugador y
  // dispositivo». Se filtra con el embudo de cada columna de la tabla.
  test("arriba no hay filtros: se filtra en la tabla y el informe sale de lo que se ve", async () => {
    datos.filas = [...FILAS(), VIEJA()];
    await montarEnLaBase();
    expect(contenedor.querySelector(".gps-periodo")).toBeNull();
    const fueraDeLaTabla = (selector) => [...contenedor.querySelectorAll(selector)].filter((elemento) => !elemento.closest(".tabla-datos"));
    expect(fueraDeLaTabla("input[type=date]")).toHaveLength(0);
    expect(fueraDeLaTabla("select")).toHaveLength(0);
    expect(filasDeArriba(contenedor)).toHaveLength(6);

    // El embudo de Dispositivo: solo Catapult. Un informe, el de Catapult.
    await tocar(contenedor.querySelector('.tabla-datos-filtro[aria-label="Filtrar u ordenar Dispositivo"]'));
    const valores = () => [...document.body.querySelectorAll(".tabla-datos-valores label")];
    expect(valores().map((label) => label.textContent)).toEqual(["Catapult3", "Sport1"]);
    await tocar(boton("Ninguno"));
    await tocar(valores()[0].querySelector("input"));
    await tocar(boton("Aplicar"));
    expect(filas(contenedor)).toHaveLength(3);
    expect(filasDeArriba(contenedor)).toHaveLength(3);
    expect(contenedor.querySelector(".tabla-datos-cuantas").textContent).toBe("3 de 4 filas");
    // Arriba, siempre cuántas tiene el club.
    expect(contenedor.querySelector(".estado-hero").textContent).toBe("4 filas");
    expect(datos.lecturas).toHaveLength(1);
    // La tabla recuerda sus filtros mientras la app está abierta: se quitan.
    await tocar(botones().find((b) => b.textContent.trim().startsWith("Quitar filtros")));
    expect(filas(contenedor)).toHaveLength(4);
  });

  // Santiago, 14/10: «Lo que sea mejor para poder abrir lo mas rapido posible
  // todas las filas que se tengan».
  const esperarLargo = async (condicion) => {
    for (let i = 0; i < 150 && !condicion(); i += 1) {
      await act(async () => new Promise((resolver) => setTimeout(resolver, 20))); // eslint-disable-line no-await-in-loop
    }
    expect(condicion(), "no llegó lo esperado").toBe(true);
  };

  test("la primera vez en un aparato: las últimas 4 semanas enseguida, después el resto del historial, y queda la copia", async () => {
    datos.filas = [...FILAS(), VIEJA()];
    await montarEnLaBase();
    expect(datos.lecturas).toEqual([{ equipoId: "eq-1", desde: diasAntes(27), todo: true }]);
    expect(filas(contenedor).map((tr) => tr.querySelectorAll("td")[columna(contenedor, "Nombre")].textContent)).toEqual(["GAMA", "ALFA", "BETA", "Team Average Parcial"]);
    expect(contenedor.querySelector(".gps-trayendo")).toBeNull();
    // Al rato, la copia del aparato, con todas.
    await esperarLargo(() => datos.copiasGuardadas.length > 0);
    expect(datos.copiasGuardadas.at(-1)).toEqual({ cuenta: "cuenta-1", equipoId: "eq-1", filas: 4, hasta: "2026-10-13T12:00:00Z" });
  });

  test("con la copia del aparato abre al instante y trae solo lo cambiado (también lo de otros)", async () => {
    // En la copia, las tres de ayer; en la base, además, una de hoy.
    datos.copia = { filas: FILAS(), hasta: "2026-10-13T10:00:00Z" };
    datos.filas = [...FILAS(), fila("h1", 9, { jugador_id: 1 }, HOY, { d: 100, dispositivo: "catapult" })];
    await montarEnLaBase();
    // No se trajo todo: se puso al día lo de la copia.
    expect(datos.lecturas).toEqual([]);
    expect(datos.alDia[0]).toEqual({ equipoId: "eq-1", filas: 3, hasta: "2026-10-13T10:00:00Z" });
    await esperar(() => filas(contenedor).length === 4);
    expect(contenedor.querySelector(".estado-hero").textContent).toBe("4 filas");
  });

  test("si no llega el resto del historial, se ven las últimas 4 semanas y avisa", async () => {
    datos.filas = [...FILAS(), VIEJA()];
    datos.errorHistorial = "gps.error.noLeer";
    await montarEnLaBase();
    expect(filas(contenedor)).toHaveLength(3);
    expect(contenedor.textContent).toContain("Se ven solo las últimas 4 semanas: no se pudo traer el resto del historial");
    // No se guarda una copia a medias.
    await act(async () => new Promise((resolver) => setTimeout(resolver, 1000)));
    expect(datos.copiasGuardadas).toEqual([]);
    datos.errorHistorial = "";
    await tocar(boton("Reintentar"));
    await esperar(() => filas(contenedor).length === 4);
    expect(contenedor.textContent).not.toContain("Se ven solo las últimas 4 semanas");
  });

  test("con varias filas elegidas (Shift), se borran todas de una vez", async () => {
    await montarEnLaBase();
    await tocar(celda(contenedor, 0, "D"));
    await act(async () => celda(contenedor, 2, "D").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true })));
    await tocar(boton("Borrar 3 filas"));
    expect(document.body.textContent).toContain("¿Borrar 3 filas?");
    await tocar(boton("Sí, borrar"));
    expect(datos.borradas).toEqual(["g1", "g2", "g3"]);
    expect(contenedor.querySelector(".tabla-datos-vacia")).not.toBeNull();
    expect(document.body.textContent).toContain("3 filas borradas.");
  });

  test("borrar una fila pide confirmación", async () => {
    await montarEnLaBase();
    await tocar(celda(contenedor, 1, "D"));
    await tocar(boton("Borrar fila"));
    expect(document.body.textContent).toContain("¿Borrar esta fila?");
    expect(document.body.textContent).toContain(`La de BETA del ${fechaCorta(AYER)}.`);
    await tocar(boton("Sí, borrar"));
    expect(datos.borradas).toEqual(["g2"]);
    expect(filas(contenedor)).toHaveLength(2);
  });

  test("Pegar desde una planilla: se resume lo pegado, se elige qué es cada nombre y se carga con el dispositivo", async () => {
    await montarEnLaBase();
    await tocar(boton("Pegar desde una planilla"));
    // Los pasos, sin nombrar ninguna planilla ni hoja (Santiago, 14/10).
    expect([...contenedor.querySelectorAll(".lesiones-encabezado .texto-guia ol li")].map((li) => li.textContent)).toHaveLength(4);
    expect(contenedor.textContent).toContain("mostrá todos sus decimales");
    const pegado = [
      // Arriba, el informe del Excel: se saltea hasta la fila de títulos.
      "\t\tExcelente\t5500",
      "Microciclo\tNombre\tPuesto\tD\tD/min\tT\tEEE\tFecha\tCódigo Estrategia",
      `31\tA. Alfa\tDEL\t4100,5\t82,01\t0:50:00\t#¡DIV/0!\t${fechaCorta(HOY)}\tCPS`,
      `31\tTeam Average Parcial\t\t4300\t86\t0:50:00\t\t${fechaCorta(HOY)}\t0`,
      `31\tNombre Nuevo\t\t3900\t78\t0:50:00\t\t${fechaCorta(HOY)}\tCPT`,
      // Igual a una que ya está (el dispositivo no cuenta).
      `30\tALFA\tDEL\t4000\t80\t0:50:00\t\t${fechaCorta(AYER)}\t`,
    ].join("\n");
    await escribir(contenedor.querySelector(".datos-importar-pegado textarea"), pegado);
    // Lo pegado no queda escrito en el cuadro (son megas): se resume.
    expect(contenedor.querySelector(".datos-importar-pegado textarea").value).toBe("");
    await esperar(() => contenedor.textContent.includes("2 para cargar · 1 ya está en la app · 1 para elegir"));
    expect(contenedor.textContent).toContain("4 filas en lo pegado");
    expect(datos.lecturas.at(-1)).toMatchObject({ equipoId: "eq-1", desde: AYER, hasta: HOY });
    expect(contenedor.textContent).toContain("1 nombre que no está en Datos básicos");
    expect(contenedor.textContent).toContain("Distancia Explosiva: 1 celda no se entendió («#¡DIV/0!») y queda vacía.");
    expect(contenedor.textContent).toContain("Código Estrategia: 1 fila con un texto que no está en la lista («0»)");

    await tocar(boton("Guardar igual el que no está en Datos básicos"));
    await esperar(() => contenedor.textContent.includes("3 para cargar"));
    await elegir(contenedor.querySelector(".gps-dispositivo select"), "catapult");
    // Queda recordado en la cuenta para la próxima vez (nota del 17/10).
    expect(datos.recordar).toEqual([{ equipoId: "eq-1", lugar: "pegar", dispositivo: "catapult" }]);
    await esperar(() => Boolean(boton("Cargar 3 filas")) && !boton("Cargar 3 filas").disabled);
    await tocar(boton("Cargar 3 filas"));
    expect(datos.creadas).toEqual([
      { fecha: HOY, jugador_id: 1, persona: null, promedio: null, datos: { microciclo: 31, puesto: "DEL", d: 4100.5, d_min: 82.01, tiempo: 3000, codigo_estrategia: "cps", dispositivo: "catapult" } },
      { fecha: HOY, jugador_id: null, persona: null, promedio: "parcial", datos: { microciclo: 31, d: 4300, d_min: 86, tiempo: 3000, codigo_estrategia: "0", dispositivo: "catapult" } },
      { fecha: HOY, jugador_id: null, persona: "Nombre Nuevo", promedio: null, datos: { microciclo: 31, d: 3900, d_min: 78, tiempo: 3000, codigo_estrategia: "cpt", dispositivo: "catapult" } },
    ]);
    expect(document.body.textContent).toContain("Listo: se cargaron 3 filas.");
    // De vuelta en la Base, con las nuevas.
    expect(filas(contenedor)).toHaveLength(6);
  });

  // Nota del 17/10: «Recordar el ultimo dispositivo seleccionado cuando se
  // copia para pegar en la base gps» (Santiago: «En mi cuenta»).
  test("Pegar desde una planilla: arranca con el último dispositivo que eligió la cuenta al pegar", async () => {
    datos.recordados = { pegar: "sport", csv: "catapult" };
    await montarEnLaBase();
    await tocar(boton("Pegar desde una planilla"));
    await esperar(() => contenedor.querySelector(".gps-dispositivo select").value === "sport");
    expect(datos.recordar).toEqual([]);
  });

  test("Pegar desde una planilla: un dispositivo recordado que ya no está en la lista no se elige solo", async () => {
    datos.recordados = { pegar: "borrado", csv: "" };
    await montarEnLaBase();
    await tocar(boton("Pegar desde una planilla"));
    await act(async () => new Promise((resolver) => setTimeout(resolver, 20)));
    expect(contenedor.querySelector(".gps-dispositivo select").value).toBe("");
  });

  // Santiago, 13/10: «solo se puede cambiar el nombre de las absolutas y las
  // relativas pasan a tomar el nombre del absoluto pero dependiendo que sea se
  // le agrega /Min o /PC».
  test("Ajustes › Cabeceras: una por minuto toma el nombre de su medida con /min y no se renombra", async () => {
    datos.ajustes = { campos: [{ campo: "d", etiqueta_es: "Distancia", etiqueta_pt: "", oculto: false, orden: 3, tipo: null }], opciones: [...DISPOSITIVOS] };
    await montarEnLaBase();
    expect(cabeceras(contenedor)).toContain("Distancia");
    expect(cabeceras(contenedor)).toContain("Distancia/min");
    await irA(contenedor, "Ajustes");
    await tocar(ajuste("Cabeceras"));
    expect(ajuste("Distancia/min").textContent).toContain("Relativa: toma el nombre de «Distancia» con /min");
    await tocar(ajuste("Distancia/min"));
    const nombre = document.body.querySelector(".lesiones-hoja input[type=text]");
    expect(nombre.disabled).toBe(true);
    expect(nombre.value).toBe("Distancia/min");
    expect(document.body.textContent).toContain("Para cambiarlo, cambiá el de «Distancia».");
    // Se esconde igual; el nombre no se guarda.
    await tocar(boton("Oculta"));
    await tocar(boton("Guardar"));
    expect(datos.cabeceras.at(-1)).toMatchObject({ campo: "d_min", oculto: true, etiquetas: {} });
    // La absoluta sí se renombra.
    await tocar(ajuste("Distancia"));
    expect(document.body.querySelector(".lesiones-hoja input[type=text]").disabled).toBe(false);
  });

  test("Ajustes › Cabeceras: «Para los V.R.» en las de números y tiempos (no en listas); se guarda y vuelve", async () => {
    await montarEnLaBase();
    await irA(contenedor, "Ajustes");
    await tocar(ajuste("Cabeceras"));
    const paraLosVr = () => document.body.querySelector(".lesiones-hoja .sentido-para-vr");
    const prendido = () => paraLosVr().querySelector(".chip-criterio.prendido").textContent;
    // Una lista no lo lleva.
    await tocar(ajuste("Dispositivo"));
    expect(paraLosVr()).toBe(null);
    await tocar(boton("Cancelar"));
    // Una medida, sí: de entrada, «Más es mejor».
    await tocar(ajuste("D"));
    expect(paraLosVr().textContent).toContain("Para los V.R.");
    expect(prendido()).toBe("Más es mejor");
    await tocar(boton("Menos es mejor"));
    await tocar(boton("Guardar"));
    expect(datos.cabeceras.at(-1)).toMatchObject({ campo: "d", sentido: "menos" });
    // Al volver a abrirla, lo guardado.
    await tocar(ajuste("D"));
    expect(prendido()).toBe("Menos es mejor");
    await tocar(boton("Cancelar"));
    // Una por minuto también (aunque su nombre no se cambie).
    await tocar(ajuste("D/min"));
    expect(prendido()).toBe("Más es mejor");
  });

  test("Ajustes › Cabeceras: sin la actualización de la base, «Para los V.R.» no aparece y se guarda como antes", async () => {
    datos.sinSentido = true;
    await montarEnLaBase();
    await irA(contenedor, "Ajustes");
    await tocar(ajuste("Cabeceras"));
    await tocar(ajuste("D"));
    expect(document.body.querySelector(".lesiones-hoja .sentido-para-vr")).toBe(null);
    await tocar(boton("Guardar"));
    expect(datos.cabeceras.at(-1)).toMatchObject({ campo: "d", sentido: null });
  });

  test("Ajustes: una estrategia renombrada cambia también en las descripciones ya guardadas (nota del 12/10)", async () => {
    await montarEnLaBase();
    await irA(contenedor, "Ajustes");
    await tocar(ajuste("Listas"));
    await tocar(ajuste("Código Estrategia"));
    await tocar(ajuste("CPS"));
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "CPS2");
    await tocar(boton("Guardar"));
    expect(datos.opciones.at(-1)).toMatchObject({ lista: "codigo_estrategia", codigo: "cps", etiquetas: { "es-AR": "CPS2" } });
    // Con el nombre de antes (el del club o el de la plantilla) y el nuevo.
    expect(datos.descripciones).toEqual([{ equipoId: "eq-1", antes: ["CPS", "CPS"], despues: "CPS2" }]);
    // Otra lista no está en la Descripción: no se pide nada.
    await tocar(boton("Volver a Listas"));
    await tocar(ajuste("Dispositivo"));
    await tocar(ajuste("Catapult"));
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "Catapult Vector");
    await tocar(boton("Guardar"));
    expect(datos.descripciones).toHaveLength(1);
  });

  test("Ajustes: renombrar, esconder y sumar columnas, y sumar un dispositivo", async () => {
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar(ajuste("Cabeceras"));
    await tocar(ajuste("D"));
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "Distancia");
    await tocar(boton("Guardar"));
    expect(datos.cabeceras.at(-1)).toMatchObject({ equipoId: "eq-1", campo: "d", etiquetas: { "es-AR": "Distancia" }, oculto: false, tipo: null });

    // Esconder: sale de la base (lo cargado no se pierde).
    await tocar(ajuste("Puesto"));
    expect(document.body.textContent).toContain("Esconder una columna la quita de la base");
    await tocar(boton("Oculta"));
    await tocar(boton("Guardar"));
    expect(datos.cabeceras.at(-1)).toMatchObject({ campo: "puesto", oculto: true });
    // Nombre y Fecha no se esconden.
    await tocar(ajuste("Nombre"));
    expect(boton("Oculta")).toBeUndefined();
    await tocar(boton("Cancelar"));

    // Una columna del club, con su tipo.
    await tocar(boton("Agregar columna"));
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "D");
    await tocar(boton("Guardar"));
    expect(document.body.textContent).toContain("Ya hay una columna con ese nombre.");
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "Sprints");
    await tocar(boton("Duración"));
    await tocar(boton("Guardar"));
    expect(datos.cabeceras.at(-1)).toMatchObject({ campo: "propia_sprints", etiquetas: { "es-AR": "Sprints" }, oculto: false, orden: 1000, tipo: "tiempo" });
    expect(ajuste("Sprints").textContent).toContain("Del club: Duración");

    // Un dispositivo nuevo.
    await tocar(boton("Volver a Ajustes"));
    await tocar(ajuste("Listas"));
    await tocar(ajuste("Dispositivo"));
    expect(ajuste("Catapult")).toBeTruthy();
    await tocar(boton("Agregar una opción"));
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "Otro GPS");
    await tocar(boton("Guardar"));
    expect(datos.opciones.at(-1)).toMatchObject({ lista: "dispositivo", etiquetas: { "es-AR": "Otro GPS" } });
    expect(datos.opciones.at(-1).codigo).toMatch(/^otro_gps_/);

    // En la Base: el nombre nuevo, sin Puesto y con la columna del club al final.
    await irA(contenedor, "Base");
    expect(cabeceras(contenedor).slice(0, 3)).toEqual(["Microciclo", "Nombre", "Distancia"]);
    expect(fijas(contenedor)).toBe(2);
    expect(cabeceras(contenedor).at(-1)).toBe("Sprints");
  });

  test("quien ya se fue del club ve la base y no cambia nada", async () => {
    datos.equipo = { id: "eq-1", nombre: "Club de Prueba", hasta: "2026-09-25" };
    await montarEnLaBase();
    expect(contenedor.querySelector(".aviso-solo-lectura")).not.toBeNull();
    expect(boton("Pegar desde una planilla")).toBeUndefined();
    expect(boton("Borrar fila")).toBeUndefined();
    expect(filas(contenedor)).toHaveLength(3);
    await tocar(celda(contenedor, 0, "D"));
    await tocar(celda(contenedor, 0, "D"));
    expect(celda(contenedor, 0, "D").querySelector("input")).toBeNull();
  });

  test("con GPS en «Solo lectura» ve la base al día (con su copia en el aparato) y no cambia nada", async () => {
    datos.equipo = { id: "eq-1", nombre: "Club de Prueba", hasta: null, gps: true, solo_lectura: ["gps"] };
    await montar();
    // En Cargar no hay nada para cargar.
    expect(contenedor.textContent).toContain("Tenés GPS en solo lectura.");
    expect(boton("Cargar un día")).toBeUndefined();
    await irA(contenedor, "Base");
    expect(contenedor.textContent).toContain("Todas las filas del GPS del club. Filtrá");
    expect(contenedor.textContent).not.toContain("Dejaste este club");
    expect(boton("Pegar desde una planilla")).toBeUndefined();
    expect(boton("Borrar fila")).toBeUndefined();
    expect(filas(contenedor)).toHaveLength(3);
    await tocar(celda(contenedor, 0, "D"));
    await tocar(celda(contenedor, 0, "D"));
    expect(celda(contenedor, 0, "D").querySelector("input")).toBeNull();
    // Lo de la base, al día: queda la copia del aparato (no es la foto de quien se fue).
    await esperarLargo(() => datos.copiasGuardadas.length > 0);
    expect(datos.copiasGuardadas.at(-1)).toMatchObject({ equipoId: "eq-1", filas: 3 });
  });

  // Sin lo técnico (Santiago, 14/10): qué falta y a quién avisarle.
  test("sin la migración, avisa que falta una actualización de la base", async () => {
    datos.errorAlLeer = "gps.error.faltaMigracion";
    await montarEnLaBase();
    expect(contenedor.textContent).toContain("Falta una actualización de la base de datos para usar GPS. Avisale a quien administra la app.");
    expect(contenedor.textContent).not.toContain("SQL");
  });

  // ------------------------------------------------------------ Cargar --

  // Un CSV de Catapult inventado: la fila de la sesión (se descarta), dos
  // tareas y alguien que no está en Datos básicos.
  const enElCsv = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const CSV = (fecha, filas) =>
    [`Date:,${enElCsv(fecha)}`, "Player Name,Period Name,Period Number,Total Distance,Total Duration,Start Time,End Time,Maximum Velocity", ...filas].join("\n");
  const CSV_TAREAS = (fecha) =>
    CSV(fecha, [
      "A. Alfa,Session,0,9000,01:10:00,10:00:00,11:10:00,30",
      "A. Alfa,1. Rondo,1,3000,00:20:00,10:00:00,10:20:00,25",
      "BETA,1. Rondo,1,2800,00:20:00,10:00:00,10:20:00,24",
      "Invitado X,1. Rondo,1,1000,00:05:00,10:00:00,10:05:00,20",
      "DELTA,1. Rondo,1,2900,00:20:00,10:00:00,10:20:00,26",
      "A. Alfa,2. Juego,2,6000,00:40:00,10:30:00,11:10:00,30",
      "BETA,2. Juego,2,5800,00:40:00,10:30:00,11:10:00,29",
    ]);
  const CON_DELTA_Y_EPSILON = () => [...PLANTEL, { id: 4, nombre: "DELTA", roles: [], puestos: [], actual: true }, { id: 5, nombre: "EPSILON", roles: [], puestos: [], actual: true }];
  const opcionDeHoja = (texto) => [...document.body.querySelectorAll(".opcion-hoja")].find((b) => b.textContent === texto);
  const elegirDelDesplegable = async (rotulo, texto) => {
    await tocar(contenedor.querySelector(`[aria-label="${rotulo}"]`));
    await tocar(opcionDeHoja(texto));
  };
  const marcarEnLaLista = async (texto) => tocar([...document.body.querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent === texto).querySelector("input"));
  const pegarCsv = async (texto, { dispositivo = "Catapult" } = {}) => {
    await escribir(contenedor.querySelector(".datos-importar-pegado textarea"), texto);
    if (dispositivo && contenedor.querySelector('[aria-label="Dispositivo"]')) await elegirDelDesplegable("Dispositivo", dispositivo);
  };
  // El V.R. de partido de Catapult (el marcado en Valores de referencia).
  const dePartido = (promedio) => [{ id: "p1", dispositivo: "catapult", tipo: "PARTIDO", tabla: "V.R. de partido", grupo: "TOTAL", orden: 1, promedio, desvio: {}, dePartido: true }];
  const guardarIgual = () => tocar(botones().find((b) => b.textContent.startsWith("Guardar igual")));
  const nombres = () => filas(contenedor).map((tr) => tr.querySelectorAll("td")[columna(contenedor, "Nombre")].textContent);
  const titulo = () => contenedor.querySelector(".lesiones-paso-titulo h2").textContent;
  const escribirEn = async (rotulo, valor) => escribir(contenedor.querySelector(`input[aria-label="${rotulo}"]`), valor);
  const calculado = (rotulo) => [...contenedor.querySelectorAll(".gps-cargar-calculado")].find((uno) => uno.querySelector("label").textContent === rotulo)?.querySelector("b").textContent;
  const elegirEnLaCelda = async (f, titulo, texto) => {
    await tocar(celda(contenedor, f, titulo));
    await tocar(celda(contenedor, f, titulo));
    await tocar(opcionDeHoja(texto));
  };
  // El tipo de sesión (la densidad): sin él no se sigue (Santiago, 12/10).
  const TIPO = "Tipo de Sesión";
  const elegirTipo = (texto = "Din. Colectiva", rotulo = TIPO) => elegirDelDesplegable(rotulo, texto);
  const aviso = () => contenedor.querySelector(".aviso-hoja")?.textContent;
  const vs = () => contenedor.querySelector(".gps-cargar-vs")?.textContent;
  const colorDeMedida = (clave) => contenedor.querySelector(`.gps-cargar-vs [data-medida="${clave}"]`).className;
  const colorDeGrupo = (grupo) => contenedor.querySelector(`.gps-cargar-vs [data-grupo="${grupo}"]`).className;
  const listaDeNoEntrenaron = () => [...contenedor.querySelectorAll(".datos-importar-lista li > .datos-importar-fila > b")].map((b) => b.textContent);

  test("abre en Cargar: el día de hoy y el botón para cargar un día", async () => {
    datos.filas = [...FILAS(), fila("h1", 9, { jugador_id: 1 }, HOY, { d: 100 })];
    await montar();
    expect(contenedor.querySelector(".etiqueta-hero").textContent).toBe("GPS");
    expect(contenedor.querySelector(".estado-hero").textContent).toBe("1 fila de hoy");
    expect(boton("Cargar un día")).toBeTruthy();
    expect(contenedor.querySelector(".tabla-datos")).toBeNull();
  });

  // Nota del 17/10: «… al igual que en la carga de un csv». Cada lugar
  // recuerda el suyo.
  test("Cargar un día: arranca con el último dispositivo que eligió la cuenta al cargar un CSV", async () => {
    datos.recordados = { pegar: "catapult", csv: "sport" };
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER), { dispositivo: null });
    expect(contenedor.querySelector('[aria-label="Dispositivo"]').textContent).toBe("Sport");
    // Si se cambia, queda recordado el nuevo.
    await elegirDelDesplegable("Dispositivo", "Catapult");
    expect(contenedor.querySelector('[aria-label="Dispositivo"]').textContent).toBe("Catapult");
    expect(datos.recordar).toEqual([{ equipoId: "eq-1", lugar: "csv", dispositivo: "catapult" }]);
  });

  test("Cargar un día: el CSV, un paso por tarea con sus jugadores y todos sus datos, y la sesión al final", async () => {
    datos.plantel = CON_DELTA_Y_EPSILON();
    // Un V.R. de partido inventado: D/min 100 (el de Catapult).
    datos.referencias = dePartido({ d_min: 100 });
    await montar();
    await tocar(boton("Cargar un día"));
    expect(titulo()).toBe("El archivo del GPS");
    // Sin CSV no se sigue; lo que no es un CSV de Catapult no se suma.
    await tocar(siguiente());
    expect(contenedor.textContent).toContain("Primero subí o pegá el CSV de Catapult.");
    await pegarCsv("hola");
    expect(contenedor.textContent).toContain("No encontré los títulos del CSV de Catapult");
    // Sin el dispositivo no se sigue: se elige ya acá (Santiago, 14/10).
    await pegarCsv(CSV_TAREAS(AYER), { dispositivo: null });
    await tocar(siguiente());
    expect(aviso()).toBe("Falta el dispositivo.");
    await elegirDelDesplegable("Dispositivo", "Catapult");
    expect(contenedor.textContent).toContain("6 filas leídas");
    // Avanzar dice a dónde va.
    expect(siguiente().textContent.trim()).toBe("Siguiente: 1. Rondo");
    expect(contenedor.textContent).toContain("1. Rondo: 4 jugadores");
    expect(contenedor.textContent).toContain("2. Juego: 2 jugadores");
    expect(contenedor.textContent).toContain("El CSV no trae");
    // La fecha sale del CSV y se revisa si ya está en la Base: ese día hay
    // filas, pero de otra sesión.
    expect(contenedor.querySelector("input[type=date]").value).toBe(AYER);
    await esperar(() => contenedor.textContent.includes("No está en la Base: podés seguir."));
    expect(contenedor.textContent).toContain("Ese día ya hay 3 filas de otra sesión.");
    // A. Alfa es ALFA (su nombre en Catapult); Invitado X no está en Datos básicos.
    await tocar(siguiente());
    expect(contenedor.textContent).toContain("Falta elegir qué hacer con 1 nombre que no está en Datos básicos.");
    await tocar(boton("Guardar igual el que no está en Datos básicos"));
    await tocar(siguiente());

    // Un paso por tarea: arriba lo de la tarea (como en la plantilla) y abajo
    // todos sus jugadores, con el Team Average, en una tabla como la Base.
    expect(titulo()).toBe("1. Rondo");
    expect(contenedor.textContent).toContain("Tarea 1 de 2");
    expect(contenedor.querySelector(".chip-criterio")).toBeNull();
    expect(nombres()).toEqual(["Team Average Parcial", "ALFA", "BETA", "Invitado X", "DELTA"]);
    expect(cabeceras(contenedor)).toContain("Va Tarea");
    expect(celda(contenedor, 3, "Va Tarea").textContent).toBe("No va");
    expect(celda(contenedor, 1, "Va Tarea").textContent).toBe("Va");
    // El % vs V.R. de partido del Team Average: 8700 m en 60 min = 145 por minuto.
    expect(vs()).toContain("D/min145 %");
    // Los grupos, con un decimal (como la plantilla); verde desde el 90 %.
    expect(vs()).toContain("Metabólica145,0 %");
    expect(colorDeMedida("d_min")).toBe("bien");
    expect(colorDeGrupo("metabolica")).toContain("bien");
    // Sin el dato, sin color.
    expect(colorDeMedida("d_shi_min")).toBe("");
    // Los m², como la plantilla: largo × ancho ÷ jugadores.
    await escribirEn("Largo", "40");
    await escribirEn("Ancho", "30");
    await escribirEn("Nro. de jugadores", "10");
    expect(calculado("m2")).toBe("120");
    expect(celda(contenedor, 1, "m2").textContent).toBe("120");
    // El «Va Tarea» de Invitado X se cambia en su celda y cambia el Team Average.
    expect(celda(contenedor, 0, "D").textContent).toBe("2900,0");
    await elegirEnLaCelda(3, "Va Tarea", "Va");
    expect(celda(contenedor, 3, "Va Tarea").textContent).toBe("Va");
    expect(celda(contenedor, 0, "D").textContent).toBe("2425,0");
    await elegirEnLaCelda(3, "Va Tarea", "No va");
    // Una medida de un jugador se corrige en la tabla.
    await editarCelda(contenedor, 1, "D", "3500");
    expect(celda(contenedor, 1, "D").textContent).toBe("3500,0");
    expect(vs()).toContain("D/min153 %");
    // Lo calculado no se escribe.
    await editarCelda(contenedor, 0, "D", "1");
    expect(document.body.textContent).toContain("Esta celda se calcula");
    // Sin el tipo de sesión no se sigue.
    await tocar(siguiente());
    expect(titulo()).toBe("1. Rondo");
    expect(aviso()).toBe("Falta el tipo de sesión: 1. Rondo.");
    await elegirTipo();
    await tocar(siguiente());

    expect(titulo()).toBe("2. Juego");
    expect(nombres()).toEqual(["ALFA", "BETA"]);
    await elegirTipo();
    await tocar(siguiente());

    // EPSILON no está en el CSV: no entrenó (con su tipo de sesión).
    expect(titulo()).toBe("Regenerativo y no entrenaron");
    expect(contenedor.textContent).toContain("EPSILON");
    await escribir(contenedor.querySelector('input[aria-label="Motivo (por ejemplo, Lesionado)"]'), "Lesionado");
    await tocar(siguiente());
    expect(aviso()).toBe("Falta el tipo de sesión de 1 que no entrenó.");
    await elegirTipo("Descanso");
    await tocar(siguiente());

    // La sesión, al final: lo del día, su encabezado, qué tareas van en su
    // descripción y el «Va» de cada uno.
    expect(titulo()).toBe("La sesión");
    // Sin día y tipo de sesión no se sigue; el dispositivo ya está (el del
    // primer paso) y acá se puede cambiar.
    await tocar(siguiente());
    expect(aviso()).toBe("Falta el día del microciclo.");
    await elegirDelDesplegable("Tipo Microciclo", "Competitivo");
    await elegirDelDesplegable("Día del microciclo", "-1");
    expect(contenedor.querySelector('[aria-label="Dispositivo"]').textContent).toContain("Catapult");
    await tocar(siguiente());
    expect(aviso()).toBe("Falta el tipo de sesión: La sesión.");
    await elegirTipo("Din. General");
    await escribirEn("Largo", "50");
    await escribirEn("Ancho", "40");
    await escribirEn("Nro. de jugadores", "20");
    expect(calculado("m2")).toBe("100");
    expect(calculado("Descripción")).toContain("1. Rondo");
    await tocar(contenedor.querySelector('[aria-label="Tareas en la descripción de la sesión"]'));
    await marcarEnLaLista("1. Rondo");
    await tocar(boton("Listo"));
    expect(calculado("Descripción")).toBe("—");
    expect(nombres()).toEqual(["Team Average Sesion", "Invitado X", "DELTA", "ALFA", "BETA"]);
    expect(celda(contenedor, 4, "Va").textContent).toBe("Si");
    await elegirEnLaCelda(4, "Va", "No");
    expect(celda(contenedor, 4, "Va").textContent).toBe("No");
    await tocar(siguiente());

    // Revisar: todo lo que va a la Base, en el orden de la plantilla.
    expect(titulo()).toBe("Revisar y guardar");
    expect(nombres()).toEqual(["Team Average Parcial", "ALFA", "BETA", "Invitado X", "DELTA", "ALFA", "BETA", "Team Average Sesion", "ALFA", "BETA", "EPSILON"]);
    await tocar(boton("Guardar 11 filas"));
    // Antes de guardar, el consentimiento de quien no está en Datos básicos.
    expect(datos.creadas).toHaveLength(0);
    expect([...document.querySelectorAll(".hoja-confirmar .consentimiento-personas li")].map((li) => li.textContent)).toEqual(["Invitado X"]);
    await tocar(document.querySelector(".hoja-confirmar .boton-confirmar-hoja"));
    expect(datos.confirmaciones).toEqual([{ equipoId: "eq-1", base: "gps", personas: ["Invitado X"] }]);
    expect(datos.creadas).toHaveLength(11);
    expect(datos.creadas.every((una) => Object.keys(una).every((clave) => !clave.startsWith("_")))).toBe(true);
    expect(datos.creadas[1]).toMatchObject({ fecha: AYER, jugador_id: 1, datos: { d: 3500, tiempo: 1200, m2: 120, largo: 40, ancho: 30, condicion: "parcial", tipo_microciclo: "competitivo", dispositivo: "catapult", clasificacion_dias: "menos1_m", tipo_sesion: "din_colectiva" } });
    // Toda fila, con día, dispositivo y tipo de sesión.
    expect(datos.creadas.every((una) => una.datos.clasificacion_dias && una.datos.dispositivo && una.datos.tipo_sesion)).toBe(true);
    expect(datos.creadas[3]).toMatchObject({ persona: "Invitado X", datos: { condicion: "total", va: "no" } });
    expect(datos.creadas[7]).toMatchObject({ promedio: "sesion", datos: { m2: 100, largo: 50, ancho: 40 } });
    expect(datos.creadas[7].datos.descripcion).toBeUndefined();
    expect(datos.creadas[8]).toMatchObject({ jugador_id: 1, datos: { d: 9500, condicion: "total", va: "si", m2: 100 } });
    expect(datos.creadas[9]).toMatchObject({ jugador_id: 2, datos: { va: "no" } });
    expect(datos.creadas[10]).toMatchObject({ jugador_id: 5, datos: { condicion: "total", va: "no", descripcion: `${AYER.replace(/-/g, "_")}_Lesionado`, tipo_sesion: "descanso" } });

    // De vuelta en la Base, con el día.
    expect(document.body.textContent).toContain(`Listo: se guardaron 11 filas del ${fechaCorta(AYER)}.`);
    expect(contenedor.querySelector(".tabla-datos")).not.toBeNull();
    expect(filas(contenedor)).toHaveLength(14);
  });

  // Santiago, 13/10: «No hace falta que cosas que no van a ocupar mucho
  // espacio tengan tanto espacio».
  test("Cargar: cada campo de arriba de un bloque, del tamaño de lo que lleva", async () => {
    datos.plantel = CON_DELTA_Y_EPSILON();
    datos.referencias = dePartido({ d_min: 100 });
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await esperar(() => contenedor.textContent.includes("No está en la Base: podés seguir."));
    await tocar(boton("Guardar igual el que no está en Datos básicos"));
    await tocar(siguiente());
    expect(titulo()).toBe("1. Rondo");
    const tamanoDe = (rotulo) => [...contenedor.querySelectorAll(".gps-cargar-encabezado .campo-inicio")].find((uno) => uno.querySelector("label").textContent === rotulo)?.className;
    // Cada cosa en su parte, con su título (Santiago, 13/10: «poner los 2 CPJ
    // y CPT por un lado, Todas las mediciones y m2 por otro»).
    const enLaParte = (titulo) => {
      const parte = contenedor.querySelector(`.gps-cargar-encabezado .gps-cargar-grupo[aria-label="${titulo}"]`);
      return [...parte.querySelectorAll(".campo-inicio > label")].map((label) => label.textContent);
    };
    expect([...contenedor.querySelectorAll(".gps-cargar-encabezado .gps-cargar-grupo-titulo")].map((uno) => uno.textContent)).toEqual(["La tarea", "Medidas", "Pausa"]);
    // El tipo de sesión, con la tarea y sin «(Densidad)»: no es la densidad.
    expect(enLaParte("La tarea")).toEqual(["Nombre de la tarea", TIPO, "Código Estrategia", "Zona de Impacto"]);
    expect(enLaParte("Medidas")).toEqual(["Base", "Largo", "Ancho", "Nro. de jugadores", "m2"]);
    expect(enLaParte("Pausa")).toEqual(["Pausa (segundos)", "C/P Jug", "C/P Tarea"]);
    // La pausa, debajo de las medidas (Santiago, 13/10).
    expect([...contenedor.querySelectorAll(".gps-cargar-columna > .gps-cargar-grupo")].map((uno) => uno.getAttribute("aria-label"))).toEqual(["Medidas", "Pausa"]);
    // Los %, en su recuadro, después de las partes.
    expect(contenedor.querySelector(".gps-cargar-encabezado > .gps-cargar-vs")).not.toBeNull();
    // Los números y lo calculado: una caja chica.
    ["Base", "Largo", "Ancho", "Nro. de jugadores", "Pausa (segundos)", "C/P Jug", "C/P Tarea", "m2"].forEach((rotulo) => expect(tamanoDe(rotulo)).toContain("gps-cargar-chico"));
    // Los desplegables, del ancho de su opción más larga; sin nada elegido, «Elegí…».
    [TIPO, "Código Estrategia", "Zona de Impacto"].forEach((rotulo) => expect(tamanoDe(rotulo)).toContain("gps-cargar-ajustado"));
    const desplegable = () => contenedor.querySelector(`[aria-label="${TIPO}"]`);
    expect(desplegable().querySelector("b").textContent).toBe("Elegí…");
    expect(desplegable().querySelector(".gps-cargar-molde").dataset.molde.split("\n")).toEqual(expect.arrayContaining(["Elegí…", "Din. Intensiva de Interacción", "Descanso"]));
    await elegirTipo();
    expect(desplegable().querySelector("b").textContent).toBe("Din. Colectiva");
    // El nombre de la tarea (va en la descripción) crece con lo escrito; es un
    // solo renglón.
    expect(tamanoDe("Nombre de la tarea")).toContain("gps-cargar-largo");
    const nombre = contenedor.querySelector('textarea[aria-label="Nombre de la tarea"]');
    expect(nombre.value).toBe("1. Rondo");
    await escribir(nombre, "1. Rondo\ncon dos toques");
    expect(nombre.value).toBe("1. Rondo con dos toques");
    expect(nombre.parentElement.dataset.valor).toBe("1. Rondo con dos toques");
    // Sin tope de letras (Santiago, 13/10: «no puede tener limite de caracteres»).
    expect(nombre.hasAttribute("maxlength")).toBe(false);
    const largo = `1. Rondo ${"g".repeat(600)}`;
    await escribir(nombre, largo);
    expect(nombre.value).toBe(largo);
  });

  // Santiago, 13/10: «Dejar un boton dentro de carga de gps donde pueda dejar
  // el entrenamiento para revisar»; «poder guardarlo en la computadora y poder
  // seguirlo desde mi celular donde lo deje o viceversa»; «que aparesca en un
  // cuadro abajo de cargar como aparecen las lesion sin fecha de retorno».
  const UNA_EN_CURSO = (extra = {}) => ({
    id: "ec9",
    fecha: AYER,
    paso: 1,
    resumen: { titulo: "1. Rondo", paso: 2, pasos: 6 },
    version: 1,
    creado_email: "otra@club.com",
    creado_en: "2026-10-12T15:00:00Z",
    actualizado_email: "otra@club.com",
    actualizado_en: "2026-10-12T15:00:00Z",
    datos: { formato: 1, estado: {} },
    ...extra,
  });
  const cuadroEnCurso = () => contenedor.querySelector(".gps-en-curso");
  const enOtroAparato = async () => {
    await act(async () => raiz.unmount());
    raiz = null;
    await montar();
  };
  // Un día hasta la primera tarea, con su tipo de sesión y el largo.
  const hastaLaPrimeraTarea = async () => {
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await esperar(() => contenedor.textContent.includes("No está en la Base: podés seguir."));
    await guardarIgual();
    await tocar(siguiente());
    expect(titulo()).toBe("1. Rondo");
    await elegirTipo();
    await escribirEn("Largo", "40");
  };

  test("Dejar para revisar: queda en «Sin terminar», abajo de Cargar, y se sigue en otro aparato desde el paso donde quedó", async () => {
    datos.plantel = CON_DELTA_Y_EPSILON();
    await montar();
    expect(cuadroEnCurso()).toBeNull();
    await tocar(boton("Cargar un día"));
    // Sin CSV no hay nada para dejar.
    expect(boton("Dejar para revisar")).toBeUndefined();
    await tocar(boton("Cancelar"));
    await hastaLaPrimeraTarea();
    await tocar(boton("Dejar para revisar"));

    // Se guarda todo lo hecho y el paso; vuelve a Cargar, con la carga en el cuadro.
    expect(datos.dejadas).toHaveLength(1);
    expect(datos.dejadas[0]).toMatchObject({ id: null, fecha: AYER, paso: 1, resumen: { titulo: "1. Rondo", paso: 2, pasos: 6 } });
    expect(datos.dejadas[0].datos.formato).toBe(1);
    expect(datos.dejadas[0].datos.estado.csv).toHaveLength(1);
    expect(document.body.textContent).toContain("Quedó en «Sin terminar»: seguila desde Cargar, en este aparato o en otro.");
    expect(boton("Cargar un día")).toBeTruthy();
    expect(cuadroEnCurso().querySelector("h2").textContent).toBe("1 carga sin terminar");
    expect(cuadroEnCurso().querySelector(".fecha-registro").textContent).toBe(fechaCorta(AYER));
    expect(cuadroEnCurso().querySelector(".lesiones-caso").textContent).toBe("Paso 2 de 6");
    expect(cuadroEnCurso().querySelector("strong").textContent).toBe("1. Rondo");
    expect(cuadroEnCurso().textContent).toContain("La dejó yo@club.com el ");

    // En otro aparato: aparece y se sigue en ese paso, con lo hecho.
    await enOtroAparato();
    expect(cuadroEnCurso().querySelector("h2").textContent).toBe("1 carga sin terminar");
    await tocar(boton("Seguir"));
    expect(titulo()).toBe("1. Rondo");
    expect(contenedor.querySelector(`[aria-label="${TIPO}"] b`).textContent).toBe("Din. Colectiva");
    expect(contenedor.querySelector('input[aria-label="Largo"]').value).toBe("40");
    expect(nombres()).toEqual(["Team Average Parcial", "ALFA", "BETA", "Invitado X", "DELTA"]);
    // Se avanza y se vuelve a dejar: la misma, con la versión que se abrió.
    await tocar(siguiente());
    expect(titulo()).toBe("2. Juego");
    await tocar(boton("Dejar para revisar"));
    expect(datos.dejadas[1]).toMatchObject({ id: "ec1", version: 1, paso: 2, resumen: { titulo: "2. Juego", paso: 3, pasos: 6 } });
    expect(datos.enCurso).toHaveLength(1);
    expect(datos.enCurso[0].version).toBe(2);

    // Y de vuelta en el primero, se termina: al guardar en la Base, deja de estar sin terminar.
    await enOtroAparato();
    await tocar(boton("Seguir"));
    expect(titulo()).toBe("2. Juego");
    await elegirTipo();
    await tocar(siguiente());
    await elegirTipo("Descanso");
    await tocar(siguiente());
    expect(titulo()).toBe("La sesión");
    await elegirDelDesplegable("Tipo Microciclo", "Competitivo");
    await elegirDelDesplegable("Día del microciclo", "-1");
    await elegirDelDesplegable("Dispositivo", "Catapult");
    await elegirTipo("Din. General");
    await tocar(siguiente());
    expect(titulo()).toBe("Revisar y guardar");
    // Quien no está en Datos básicos ya estaba confirmado: no se pregunta.
    datos.personasConfirmadas = ["invitado x"];
    await tocar(boton("Guardar 11 filas"));
    expect(document.querySelector(".hoja-confirmar")).toBeNull();
    expect(datos.creadas).toHaveLength(11);
    expect(datos.creadas[1]).toMatchObject({ jugador_id: 1, datos: { largo: 40, tipo_sesion: "din_colectiva" } });
    expect(datos.enCurso).toHaveLength(0);
    expect(document.body.textContent).toContain(`Listo: se guardaron 11 filas del ${fechaCorta(AYER)}.`);
    await irA(contenedor, "Cargar");
    expect(cuadroEnCurso()).toBeNull();
  });

  test("un día con una carga en curso: la frena, dice quién la dejó y no deja otra", async () => {
    datos.enCurso = [UNA_EN_CURSO()];
    await montar();
    expect(cuadroEnCurso().textContent).toContain("La dejó otra@club.com el ");
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await esperar(() => contenedor.textContent.includes(`Ya hay una carga en curso del ${fechaCorta(AYER)} (la dejó otra@club.com el `));
    expect(contenedor.textContent).not.toContain("No está en la Base: podés seguir.");
    await guardarIgual();
    await tocar(siguiente());
    expect(titulo()).toBe("El archivo del GPS");
    expect(aviso()).toContain(`Ya hay una carga en curso del ${fechaCorta(AYER)}`);
    expect(aviso()).toContain("Seguila desde «Sin terminar», en Cargar.");
    // Tampoco se deja otra de ese día para revisar.
    await tocar(boton("Dejar para revisar"));
    expect(datos.dejadas).toHaveLength(0);
    // Con otra fecha, sí se sigue.
    await escribir(contenedor.querySelector("input[type=date]"), diasAntes(2));
    await esperar(() => contenedor.textContent.includes("No está en la Base: podés seguir."));
    await tocar(siguiente());
    expect(titulo()).toBe("1. Rondo");
  });

  test("si la siguieron en otro aparato, no la pisa y deja abrir la última", async () => {
    datos.plantel = CON_DELTA_Y_EPSILON();
    await montar();
    await hastaLaPrimeraTarea();
    await tocar(boton("Dejar para revisar"));
    await tocar(boton("Seguir"));
    expect(titulo()).toBe("1. Rondo");
    // Mientras tanto, desde otro aparato la llevaron a la segunda tarea.
    Object.assign(datos.enCurso[0], { version: 2, paso: 2, resumen: { titulo: "2. Juego", paso: 3, pasos: 6 } });
    await escribirEn("Ancho", "30");
    await tocar(boton("Dejar para revisar"));
    expect(contenedor.textContent).toContain("La siguieron desde otro aparato y lo que hiciste acá no se guardó.");
    expect(datos.enCurso[0].version).toBe(2);
    expect(titulo()).toBe("1. Rondo");
    await tocar(boton("Abrir la última"));
    expect(titulo()).toBe("2. Juego");
    expect(contenedor.textContent).not.toContain("La siguieron desde otro aparato");
  });

  test("se borra desde el cuadro, preguntando antes", async () => {
    datos.enCurso = [UNA_EN_CURSO(), UNA_EN_CURSO({ id: "ec8", fecha: diasAntes(3), resumen: { titulo: "La sesión", paso: 5, pasos: 6 } })];
    await montar();
    expect(cuadroEnCurso().querySelector("h2").textContent).toBe("2 cargas sin terminar");
    await tocar(contenedor.querySelector(`[aria-label="Borrar la carga sin terminar del ${fechaCorta(AYER)}"]`));
    expect(document.body.textContent).toContain(`¿Borrar la carga sin terminar del ${fechaCorta(AYER)}?`);
    await tocar(boton("Cancelar"));
    expect(datos.enCurso).toHaveLength(2);
    await tocar(contenedor.querySelector(`[aria-label="Borrar la carga sin terminar del ${fechaCorta(AYER)}"]`));
    await tocar(boton("Sí, borrar"));
    expect(datos.enCurso.map((una) => una.id)).toEqual(["ec8"]);
    expect(cuadroEnCurso().querySelector("h2").textContent).toBe("1 carga sin terminar");
    expect(document.body.textContent).toContain(`Se borró la carga sin terminar del ${fechaCorta(AYER)}.`);
  });

  test("si el CSV ya está en la Base, avisa y no deja seguir", async () => {
    datos.filas = [...FILAS(), fila("y1", 10, { jugador_id: 1 }, AYER, { d: 3000, tiempo: 1200, inicio: 36000 })];
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await esperar(() => contenedor.textContent.includes("Este CSV ya está en la Base: 1 fila es igual a una del"));
    await guardarIgual();
    await tocar(siguiente());
    expect(titulo()).toBe("El archivo del GPS");
    expect(contenedor.querySelector(".aviso-hoja").textContent).toContain("No se puede cargar de nuevo.");
    // Tampoco se deja para revisar: no se podría guardar.
    await tocar(boton("Dejar para revisar"));
    expect(datos.dejadas).toHaveLength(0);
    expect(contenedor.querySelector(".aviso-hoja").textContent).toContain("No se puede cargar de nuevo.");
    // Con otra fecha (otro día), no está.
    await escribir(contenedor.querySelector("input[type=date]"), diasAntes(2));
    await esperar(() => contenedor.textContent.includes("No está en la Base: podés seguir."));
    await tocar(siguiente());
    expect(titulo()).toBe("1. Rondo");
  });

  const CSV_PARTIDO = (fecha) =>
    CSV(fecha, [
      "A. Alfa,PRIMER TIEMPO,1,5000,00:45:00,16:00:00,16:45:00,30",
      "BETA,PRIMER TIEMPO,1,4800,00:45:00,16:00:00,16:45:00,29",
      "A. Alfa,SEGUNDO TIEMPO,2,4000,00:30:00,17:00:00,17:30:00,31",
      "BETA,SEGUNDO TIEMPO,3,1500,00:15:00,17:30:00,17:45:00,28",
    ]);

  test("día de partido: el rival y los que no ingresaron salen de Partido, un paso por tiempo y un jugador agregado", async () => {
    datos.plantel = CON_DELTA_Y_EPSILON();
    // En Partido: el rival y DELTA, convocado que no entró.
    datos.partidos = [{ fecha: AYER, rival: "Rival Prueba", noIngresaron: ["DELTA"] }];
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_PARTIDO(AYER));
    await esperar(() => contenedor.textContent.includes(`Partido del ${fechaCorta(AYER)} en Partido: Vs Rival Prueba.`));
    expect(contenedor.textContent).toContain("«Vs Rival Prueba PT» y «Vs Rival Prueba ST»");
    await esperar(() => contenedor.textContent.includes("No está en la Base"));
    await tocar(siguiente());

    expect(titulo()).toBe("Primer tiempo");
    expect(contenedor.querySelector('[placeholder="Vs Rival"]').value).toBe("Vs Rival Prueba");
    expect(nombres()).toEqual(["ALFA", "BETA"]);
    // En el partido no se ve lo que no usa (Santiago, 12/10): se muestra desde Ajustes.
    ["Series", "Bloques", "Largo", "Ancho", "m2", "Nro. de jugadores"].forEach((rotulo) => expect(contenedor.querySelector(`input[aria-label="${rotulo}"]`)).toBeNull());
    expect(contenedor.querySelector('[aria-label="Código Estrategia"]')).toBeNull();
    // Lo del tiempo va en su descripción, como en la plantilla.
    await escribirEn("Pausa", "2'");
    // Un jugador agregado a mano al primer tiempo; no se ofrece a quien ya está.
    await tocar(contenedor.querySelector('[aria-label="Agregar un jugador"]'));
    expect(opcionDeHoja("ALFA")).toBeUndefined();
    await tocar(opcionDeHoja("GAMA · Ya no está"));
    expect(nombres()).toEqual(["ALFA", "BETA", "GAMA"]);
    await editarCelda(contenedor, 2, "D", "1200");
    await elegirTipo();
    await tocar(siguiente());

    expect(titulo()).toBe("Segundo tiempo");
    expect(nombres()).toEqual(["ALFA", "BETA"]);
    await elegirTipo();
    await tocar(siguiente());

    // El partido completo: la suma de cada uno y los que no ingresaron, que
    // salen de Partido (en un desplegable con casillas, para cambiarlos).
    expect(titulo()).toBe("Partido completo");
    expect(contenedor.querySelector(".chip-criterio")).toBeNull();
    expect(contenedor.querySelector('[aria-label="Sin ingresar"]').textContent).toBe("DELTA");
    expect(contenedor.textContent).toContain("Salen de Partido");
    expect(nombres()).toEqual(["ALFA", "BETA", "DELTA"]);
    await elegirTipo();
    await tocar(siguiente());
    expect(aviso()).toBe("Falta el tipo de sesión: Sin ingresar.");
    await elegirTipo("Descanso", "Sin ingresar: Tipo de Sesión");
    await tocar(siguiente());
    expect(titulo()).toBe("Regenerativo y no entrenaron");
    await elegirTipo("Descanso");
    await tocar(siguiente());
    expect(titulo()).toBe("La sesión");
    await elegirDelDesplegable("Día del microciclo", "0");
    await elegirDelDesplegable("Dispositivo", "Catapult");
    await elegirTipo();
    await tocar(siguiente());
    await tocar(botones().find((b) => /^Guardar \d+ filas$/.test(b.textContent)));

    const deAlfa = datos.creadas.filter((una) => una.jugador_id === 1);
    expect(deAlfa[0].datos.descripcion).toBe(`${AYER.replace(/-/g, "_")}_ Vs Rival Prueba PT2' `);
    // Por la hora (desde las 13:00), de la tarde.
    expect(deAlfa[0].datos.clasificacion_dias).toBe("0_t");
    expect(datos.creadas.find((una) => una.jugador_id === 3).datos).toMatchObject({ d: 1200, condicion: "total" });
    expect(datos.creadas.find((una) => una.jugador_id === 4).datos).toMatchObject({ d: 0, tiempo: 0, tipo_sesion: "descanso", descripcion: `${AYER.replace(/-/g, "_")}_ Vs Rival Prueba SIN INGRESAR ` });
  });

  test("% vs V.R. de partido: rojo abajo del 90 %, verde desde ahí; el promedio, desde el 70 % (como la plantilla)", async () => {
    // 145 por minuto contra 200: 72,5 %.
    datos.referencias = dePartido({ d_min: 200 });
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await esperar(() => contenedor.textContent.includes("No está en la Base"));
    await guardarIgual();
    await tocar(siguiente());
    expect(vs()).toContain("D/min73 %");
    expect(vs()).toContain("90 % o más");
    expect(vs()).toContain("Menos de 90 %");
    expect(vs()).toContain("Promedio: desde 70 %");
    expect(colorDeMedida("d_min")).toBe("bajo");
    expect(colorDeGrupo("metabolica")).toContain("bajo");
    expect(colorDeGrupo("promedio")).toContain("bien");
    expect(colorDeGrupo("fuerza")).not.toMatch(/bien|bajo/);
  });

  test("día de partido sin partido en Partido: avisa y el nombre se escribe a mano", async () => {
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_PARTIDO(AYER));
    await esperar(() => contenedor.textContent.includes(`No hay un partido guardado en Partido el ${fechaCorta(AYER)}`));
  });

  test("un jugador usó el GPS de otro: se cambia su nombre en esa tarea, en todas o en las que se elijan", async () => {
    datos.plantel = CON_DELTA_Y_EPSILON();
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await esperar(() => contenedor.textContent.includes("No está en la Base"));
    await guardarIgual();
    await tocar(siguiente());
    expect(titulo()).toBe("1. Rondo");
    // BETA está en dos tareas: pregunta dónde.
    await elegirEnLaCelda(2, "Nombre", "EPSILON");
    expect(document.body.textContent).toContain("EPSILON en lugar de BETA");
    await tocar(opcionDeHoja("Solo en 1. Rondo"));
    expect(nombres()).toEqual(["Team Average Parcial", "ALFA", "EPSILON", "Invitado X", "DELTA"]);
    // Sus números siguen siendo los de esa fila.
    expect(celda(contenedor, 2, "D").textContent).toBe("2800,0");
    // DELTA está en una sola: se cambia ahí. Nadie va dos veces en una tarea.
    await elegirEnLaCelda(4, "Nombre", "ALFA");
    expect(nombres()).toEqual(["Team Average Parcial", "ALFA", "EPSILON", "Invitado X", "ALFA"]);
    await elegirTipo();
    await tocar(siguiente());
    expect(aviso()).toBe("ALFA está dos veces en 1. Rondo: cambiá uno de los nombres.");
    await elegirEnLaCelda(4, "Nombre", "DELTA");
    await tocar(siguiente());

    expect(titulo()).toBe("2. Juego");
    expect(nombres()).toEqual(["ALFA", "BETA"]);
    // En algunas: se eligen en la lista.
    await elegirEnLaCelda(1, "Nombre", "EPSILON");
    await tocar(opcionDeHoja("Cambiar en algunas (elegís cuáles)"));
    expect(document.body.textContent).toContain("¿Dónde va EPSILON en lugar de BETA?");
    await tocar(boton("Listo"));
    expect(nombres()).toEqual(["ALFA", "EPSILON"]);
    await elegirTipo();
    await tocar(siguiente());

    // BETA ya no está en el CSV: no entrenó; EPSILON sí entrenó.
    expect(titulo()).toBe("Regenerativo y no entrenaron");
    expect(listaDeNoEntrenaron()).toEqual(["BETA"]);
  });

  test("regenerativo y no entrenaron: el regenerativo se elige de los que no entrenaron y quien se saca queda abajo", async () => {
    datos.plantel = [...CON_DELTA_Y_EPSILON(), { id: 6, nombre: "ETA", roles: [], puestos: [], actual: true }, { id: 7, nombre: "THETA", roles: [], puestos: [], actual: true }];
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await esperar(() => contenedor.textContent.includes("No está en la Base"));
    await guardarIgual();
    await tocar(siguiente());
    await elegirTipo();
    await tocar(siguiente());
    await elegirTipo();
    await tocar(siguiente());
    expect(titulo()).toBe("Regenerativo y no entrenaron");
    expect(listaDeNoEntrenaron()).toEqual(["EPSILON", "ETA", "THETA"]);
    // Quien se saca de la lista queda abajo de todo.
    await tocar([...contenedor.querySelectorAll(".datos-importar-lista li")][0].querySelector("button"));
    expect(listaDeNoEntrenaron()).toEqual(["ETA", "THETA", "EPSILON"]);
    // El regenerativo: solo los que no entrenaron.
    await tocar(contenedor.querySelector(".gps-cargar-casilla input"));
    await tocar(contenedor.querySelector('[aria-label="Quiénes hicieron regenerativo"]'));
    expect([...document.body.querySelectorAll(".tabla-datos-valores label")].map((label) => label.textContent)).toEqual(["EPSILON", "ETA", "THETA"]);
    await marcarEnLaLista("ETA");
    await tocar(boton("Listo"));
    expect(listaDeNoEntrenaron()).toEqual(["THETA", "EPSILON"]);
  });

  test("los arqueros no se cargan si el club no los prende", async () => {
    datos.plantel = [...CON_DELTA_Y_EPSILON(), { id: 8, nombre: "OMEGA", posicion: "goleiro", roles: [], puestos: [], actual: true }, { id: 9, nombre: "SIGMA", posicion: "goleiro", roles: [], puestos: [], actual: true }];
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV(AYER, ["A. Alfa,1. Rondo,1,3000,00:20:00,10:00:00,10:20:00,25", "OMEGA,1. Rondo,1,500,00:20:00,10:00:00,10:20:00,20"]));
    await esperar(() => contenedor.textContent.includes("No está en la Base"));
    expect(contenedor.textContent).toContain("1 arquero del CSV no se carga");
    await tocar(siguiente());
    expect(nombres()).toEqual(["ALFA"]);
    await elegirTipo();
    await tocar(siguiente());
    // SIGMA (arquero) tampoco va en los que no entrenaron.
    expect(listaDeNoEntrenaron()).toEqual(["BETA", "DELTA", "EPSILON"]);
  });

  test("Cargar: con un día a medio cargar, salir pregunta", async () => {
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await irA(contenedor, "Base");
    expect(document.body.textContent).toContain("¿Salir sin guardar?");
    await tocar(boton("Seguir cargando"));
    expect(contenedor.textContent).toContain("6 filas leídas");
    await irA(contenedor, "Base");
    await tocar(boton("Sí, salir"));
    expect(contenedor.querySelector(".tabla-datos")).not.toBeNull();
    // Al volver a Cargar, empieza de cero.
    await irA(contenedor, "Cargar");
    expect(boton("Cargar un día")).toBeTruthy();
  });

  test("Ajustes › Reglas de carga: se cambia un número y vale para la carga", async () => {
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar(ajuste("Reglas de carga"));
    expect(ajuste("Va tarea").textContent).toContain("Al menos el 75 % del tiempo promedio");
    expect(ajuste("Contar a los que no entrenaron").textContent).toContain("Apagado");
    await tocar(ajuste("Va tarea"));
    expect(document.body.textContent).toContain("Si no lo cambiás: 75 %.");
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "0");
    await tocar(boton("Guardar"));
    expect(document.body.textContent).toContain("Escribí un porcentaje mayor que 0 y hasta 100.");
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "80");
    await tocar(boton("Guardar"));
    expect(datos.reglasGuardadas).toEqual([{ equipoId: "eq-1", reglas: { parteDelTiempo: 0.8 } }]);
    expect(ajuste("Va tarea").textContent).toContain("Al menos el 80 % del tiempo promedio");
    expect(ajuste("Va tarea").textContent).toContain("Cambiada");
    // Prendido / Apagado, en un desplegable.
    await tocar(ajuste("Contar a los que no entrenaron"));
    await elegir(document.body.querySelector(".lesiones-hoja select"), "si");
    await tocar(boton("Guardar"));
    expect(datos.reglasGuardadas.at(-1).reglas).toEqual({ parteDelTiempo: 0.8, contarNoEntrenaron: true });
    expect(ajuste("Contar a los que no entrenaron").textContent).toContain("Prendido");
    // La hora de la tarde, como 13:00.
    await tocar(ajuste("Sesión de la tarde"));
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "14:30");
    await tocar(boton("Guardar"));
    expect(datos.reglasGuardadas.at(-1).reglas).toEqual({ parteDelTiempo: 0.8, contarNoEntrenaron: true, horaDeLaTarde: 52200 });

    // En la carga, el «Va Tarea» sale con el 80 % y la tarde, desde las 14:30.
    await irA(contenedor, "Cargar");
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await esperar(() => contenedor.textContent.includes("No está en la Base"));
    await guardarIgual();
    await tocar(siguiente());
    expect(contenedor.textContent).toContain("hizo al menos el 80 % del tiempo promedio");
    await elegirTipo();
    await tocar(siguiente());
    await elegirTipo();
    await tocar(siguiente());
    await tocar(siguiente());
    expect(contenedor.textContent).toContain("desde las 14:30, tarde");
  });

  test("Ajustes › Reglas de carga: lo que se ve en el partido y los arqueros (el V.R. de partido ya no está: es de cada dispositivo)", async () => {
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar(ajuste("Reglas de carga"));
    expect(ajuste("V.R. de partido")).toBeUndefined();
    expect(ajuste("Lo que se ve en los bloques del partido").textContent).toContain("Se ve: Zona de Impacto, Pausa");
    expect(ajuste("Arqueros en la carga").textContent).toContain("Apagado");
    // Lo que se ve en el partido: se marca en una lista.
    await tocar(ajuste("Lo que se ve en los bloques del partido"));
    await marcarEnLaLista("Largo");
    await marcarEnLaLista("Pausa");
    await tocar(boton("Guardar"));
    expect(datos.reglasGuardadas.at(-1).reglas.ocultosDelPartido).toEqual(["codigo", "jugadores", "series", "bloques", "pausa", "ancho", "m2"]);
    expect(ajuste("Lo que se ve en los bloques del partido").textContent).toContain("Se ve: Zona de Impacto, Largo");
    // Los arqueros, en un desplegable.
    await tocar(ajuste("Arqueros en la carga"));
    await elegir(document.body.querySelector(".lesiones-hoja select"), "si");
    await tocar(boton("Guardar"));
    expect(datos.reglasGuardadas.at(-1).reglas.conArqueros).toBe(true);
  });

  test("Ajustes › Reglas de carga sin la migración: avisa y no guarda", async () => {
    datos.faltanReglas = true;
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar(ajuste("Reglas de carga"));
    expect(contenedor.textContent).toContain("Falta una actualización de la base de datos para guardar las reglas. Avisale a quien administra la app.");
    await tocar(ajuste("Va tarea"));
    expect(boton("Guardar").disabled).toBe(true);
    await tocar(boton("Cancelar"));
    // Prendido / Apagado, en un desplegable.
    await tocar(ajuste("Contar a los que no entrenaron"));
    expect(document.body.querySelector(".lesiones-hoja select").value).toBe("no");
  });

  test("quien ya se fue del club no carga días", async () => {
    datos.equipo = { id: "eq-1", nombre: "Club de Prueba", hasta: "2026-09-25" };
    await montar();
    expect(contenedor.querySelector(".aviso-solo-lectura")).not.toBeNull();
    expect(boton("Cargar un día")).toBeUndefined();
    // Dónde estás: sin invitar a cambiar celdas que no se pueden cambiar.
    expect(contenedor.querySelector(".pantalla-donde")).toBeNull();
    await irA(contenedor, "Base");
    expect(contenedor.querySelector(".pantalla-donde").textContent).toContain("hasta el día que dejaste el club");
  });

  // ----------------------------------- Valores de referencia (14/10) --
  // Santiago, 14/10: «pero no puedo editar nada del vr»; «Todos los vr
  // tienen que tener su solapa aparte»; «Como esta en evaluaciones».
  const VR = () => [
    { id: "r1", dispositivo: "catapult", tipo: "FUTBOL", tabla: "Oficial", grupo: "TOTAL", orden: 1, promedio: { d: 8000.5, d_min: 95.123, tiempo: 5400 }, desvio: { d: 300.5 }, dePartido: true },
    { id: "r2", dispositivo: "catapult", tipo: "DINAMICA", tabla: "DINAMICA 1", grupo: "FUERZA", orden: 2, promedio: { d: 3000 }, desvio: {}, dePartido: false },
    { id: "r3", dispositivo: "sport", tipo: "FUTBOL", tabla: "FUTBOL 2", grupo: "TOTAL", orden: 3, promedio: { d: 9000 }, desvio: {}, dePartido: false },
  ];
  const tarjetasVr = () => [...contenedor.querySelectorAll(".referencias-bloque")];
  const tarjetaVr = (nombre) => tarjetasVr().find((una) => una.querySelector("h2").textContent === nombre);
  const celdaVr = (tarjeta, fila, titulo) => {
    const titulos = [...tarjeta.querySelectorAll("thead th")].map((th) => th.textContent);
    const tr = [...tarjeta.querySelectorAll("tbody tr")].find((una) => una.querySelector("th").textContent === fila);
    return tr.querySelectorAll("td")[titulos.indexOf(titulo)];
  };
  const cambiarVr = async (td, valor, tecla = "Enter") => {
    await act(async () => td.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    const input = td.querySelector("input");
    await escribir(input, valor);
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: tecla, bubbles: true })));
  };

  test("Valores de referencia: por dispositivo, un número se cambia con dos toques (como en las bases)", async () => {
    datos.referencias = VR();
    await montar();
    await irA(contenedor, "Valores de referencia");
    expect(contenedor.querySelector("h1").textContent).toBe("Valores de referencia");
    // Arriba, el dispositivo (de entrada, el primero con V.R.); una tarjeta por V.R.
    expect(contenedor.querySelector(".evaluaciones-elegir-test-lista").value).toBe("catapult");
    expect(tarjetasVr().map((una) => una.querySelector("h2").textContent)).toEqual(["FUTBOL · Oficial · TOTAL", "DINAMICA · DINAMICA 1 · FUERZA"]);
    expect(tarjetaVr("FUTBOL · Oficial · TOTAL").querySelector(".referencias-de-partido").textContent).toContain("De partido");
    // Como la hoja de los V.R.: Promedio y Desvío de cada medida, con el nombre del club.
    const oficial = tarjetaVr("FUTBOL · Oficial · TOTAL");
    expect([...oficial.querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual(["Promedio", "Desvío"]);
    expect(celdaVr(oficial, "Promedio", "D").textContent).toBe("8000,5");
    expect(celdaVr(oficial, "Promedio", "D/min").textContent).toBe("95,12");
    expect(celdaVr(oficial, "Promedio", "Tiempo").textContent).toBe("1:30:00");
    expect(celdaVr(oficial, "Desvío", "D").textContent).toBe("300,5");
    expect(contenedor.textContent).toContain("Tocá dos veces un número para cambiarlo");
    // Un número: se escribe y Enter.
    await cambiarVr(celdaVr(oficial, "Promedio", "D"), "9950");
    expect(datos.cambiosVr.at(-1)).toEqual({ que: "valor", id: "r1", cual: "promedio", clave: "d", valor: 9950 });
    expect(celdaVr(tarjetaVr("FUTBOL · Oficial · TOTAL"), "Promedio", "D").textContent).toBe("9950,0");
    // Un tiempo, como se ve.
    await cambiarVr(celdaVr(tarjetaVr("FUTBOL · Oficial · TOTAL"), "Promedio", "Tiempo"), "1:40:00");
    expect(datos.cambiosVr.at(-1)).toMatchObject({ clave: "tiempo", valor: 6000 });
    // Vaciar uno lo borra.
    await cambiarVr(celdaVr(tarjetaVr("FUTBOL · Oficial · TOTAL"), "Desvío", "D"), "");
    expect(datos.cambiosVr.at(-1)).toMatchObject({ cual: "desvio", clave: "d", valor: null });
    // Lo que no se entiende no se guarda y se avisa; Esc no cambia nada.
    const cuantos = datos.cambiosVr.length;
    await cambiarVr(celdaVr(tarjetaVr("FUTBOL · Oficial · TOTAL"), "Promedio", "D/min"), "mucho");
    expect(contenedor.textContent).toContain("No se entiende «mucho»: no se cambió.");
    await act(async () => contenedor.querySelector(".evaluaciones-vr-entrada").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await cambiarVr(celdaVr(tarjetaVr("FUTBOL · Oficial · TOTAL"), "Promedio", "D/min"), "1", "Escape");
    expect(datos.cambiosVr).toHaveLength(cuantos);
    expect(contenedor.querySelector(".evaluaciones-vr-entrada")).toBeNull();
    // El otro dispositivo, con los suyos.
    await elegir(contenedor.querySelector(".evaluaciones-elegir-test-lista"), "sport");
    expect(tarjetasVr().map((una) => una.querySelector("h2").textContent)).toEqual(["FUTBOL · FUTBOL 2 · TOTAL"]);
  });

  test("Valores de referencia: de partido, cambiar el nombre, agregar y borrar", async () => {
    datos.referencias = VR();
    await montar();
    await irA(contenedor, "Valores de referencia");
    const dentro = (nombre, texto) => [...tarjetaVr(nombre).querySelectorAll(".referencias-acciones button")].find((b) => b.textContent === texto);
    // El de partido: uno por dispositivo.
    await tocar(dentro("DINAMICA · DINAMICA 1 · FUERZA", "Usar de partido"));
    expect(datos.cambiosVr.at(-1)).toEqual({ que: "partido", id: "r2", marcar: true });
    expect(tarjetaVr("DINAMICA · DINAMICA 1 · FUERZA").querySelector(".referencias-de-partido")).not.toBeNull();
    expect(tarjetaVr("FUTBOL · Oficial · TOTAL").querySelector(".referencias-de-partido")).toBeNull();
    // El nombre: tipo, tabla y grupo.
    await tocar(dentro("DINAMICA · DINAMICA 1 · FUERZA", "Cambiar nombre"));
    await escribir(document.body.querySelector("#vr-grupo"), "VELOCIDAD");
    await tocar(boton("Guardar"));
    expect(datos.cambiosVr.at(-1)).toEqual({ que: "nombre", id: "r2", tipo: "DINAMICA", tabla: "DINAMICA 1", grupo: "VELOCIDAD" });
    expect(tarjetaVr("DINAMICA · DINAMICA 1 · VELOCIDAD")).toBeTruthy();
    // Uno nuevo, del dispositivo elegido: sin nombre no se guarda.
    await tocar(boton("Agregar V.R. de Catapult"));
    await tocar(boton("Guardar"));
    expect(document.body.textContent).toContain("Completá tipo, tabla y grupo.");
    await escribir(document.body.querySelector("#vr-tipo"), "REDUCIDO");
    await escribir(document.body.querySelector("#vr-tabla"), "REDUCIDO 2");
    await escribir(document.body.querySelector("#vr-grupo"), "DIN. ACCION");
    await tocar(boton("Guardar"));
    expect(datos.cambiosVr.at(-1)).toMatchObject({ que: "sumar", dispositivo: "catapult", tipo: "REDUCIDO", tabla: "REDUCIDO 2", grupo: "DIN. ACCION", orden: 4 });
    expect(tarjetaVr("REDUCIDO · REDUCIDO 2 · DIN. ACCION")).toBeTruthy();
    // Borrar pregunta antes.
    await tocar(dentro("REDUCIDO · REDUCIDO 2 · DIN. ACCION", "Borrar"));
    expect(document.body.textContent).toContain("Se borra «REDUCIDO · REDUCIDO 2 · DIN. ACCION» de Catapult");
    await tocar(boton("Sí, borrar"));
    expect(datos.cambiosVr.at(-1)).toMatchObject({ que: "borrar" });
    expect(tarjetaVr("REDUCIDO · REDUCIDO 2 · DIN. ACCION")).toBeUndefined();
  });

  test("Valores de referencia: los últimos cambios, con quién y cuándo, y «Volver»", async () => {
    datos.referencias = VR();
    const fila = (cambios) => ({ id: "r1", equipo_id: "eq-1", dispositivo: "catapult", tipo: "FUTBOL", tabla: "Oficial", grupo: "TOTAL", orden: 1, de_partido: true, promedio: { d: 8000.5, d_min: 95.123, tiempo: 5400 }, desvio: { d: 300.5 }, ...cambios });
    datos.historialVr = [
      { id: 3, tabla: "gps_referencias", filaId: "r9", accion: "borrada", quien: "pf@club.com", cuando: "2026-10-14T19:40:00Z", antes: { id: "r9", dispositivo: "catapult", tipo: "VIEJO", tabla: "Uno", grupo: "TOTAL", orden: 5, de_partido: false, promedio: { d: 1 }, desvio: {} }, despues: null },
      { id: 2, tabla: "gps_referencias", filaId: "r1", accion: "editada", quien: "pf@club.com", cuando: "2026-10-14T19:30:00Z", antes: fila({ promedio: { d: 9000, d_min: 95.123, tiempo: 5400 } }), despues: fila() },
      { id: 1, tabla: "gps_referencias", filaId: "r3", accion: "editada", quien: "otro@club.com", cuando: "2026-10-14T19:20:00Z", antes: { dispositivo: "sport", tabla: "X" }, despues: { dispositivo: "sport", tabla: "FUTBOL 2" } },
    ];
    await montar();
    await irA(contenedor, "Valores de referencia");
    const historial = () => contenedor.querySelector(".referencias-historial");
    expect(historial().querySelector("h2").textContent).toBe("Últimos cambios");
    // Solo los del dispositivo elegido.
    const items = () => [...historial().querySelectorAll(".referencias-historial-lista > li")];
    expect(items()).toHaveLength(2);
    expect(items()[0].textContent).toContain("pf@club.com");
    expect(items()[0].textContent).toContain("Borró «VIEJO · Uno · TOTAL»");
    expect(items()[1].textContent).toContain("FUTBOL · Oficial · TOTAL · D (Promedio): 9000,0 → 8000,5");
    // «Volver»: el número, a como estaba; lo borrado, otra vez.
    await tocar([...items()[1].querySelectorAll("button")].find((b) => b.textContent === "Volver"));
    expect(datos.cambiosVr.at(-1)).toEqual({ que: "valor", id: "r1", cual: "promedio", clave: "d", valor: 9000 });
    expect(document.body.textContent).toContain("Listo: quedó como estaba.");
    await tocar([...items()[0].querySelectorAll("button")].find((b) => b.textContent === "Volver"));
    expect(datos.cambiosVr.at(-1)).toMatchObject({ que: "sumar", dispositivo: "catapult", tipo: "VIEJO", tabla: "Uno", grupo: "TOTAL", promedio: { d: 1 } });
  });

  test("Valores de referencia: un V.R. por jugador, con sus cinco categorías; se puede ver una sola tabla", async () => {
    const categorias = { excelente: { d: 12000, d_min: 120.25, tiempo: 6570 }, muy_bueno: { d: 11000, d_min: 112.5, tiempo: 6000 }, regular: { d: 9000, d_min: 98.5, tiempo: 5700 }, malo: { d: 8000, d_min: 91, tiempo: 5700 } };
    const jugador = { id: "r4", dispositivo: "catapult", tipo: "Microciclo", tabla: "Partidos", grupo: "JUGADOR UNO", orden: 1001, promedio: { d: 10000, d_min: 105.5, tiempo: 5700 }, desvio: {}, categorias, dePartido: false };
    datos.referencias = [...VR(), jugador];
    const fila = (cambios) => ({ id: "r4", equipo_id: "eq-1", dispositivo: "catapult", tipo: "Microciclo", tabla: "Partidos", grupo: "JUGADOR UNO", orden: 1001, de_partido: false, promedio: { d: 10000 }, desvio: {}, categorias: { excelente: { d: 12000 } }, ...cambios });
    datos.historialVr = [
      { id: 6, tabla: "gps_referencias", filaId: "r8", accion: "borrada", quien: "pf@club.com", cuando: "2026-10-15T12:20:00Z", antes: { ...fila(), id: "r8", grupo: "JUGADOR DOS", categorias: { malo: { d: 7000 } } }, despues: null },
      { id: 5, tabla: "gps_referencias", filaId: "r4", accion: "editada", quien: "pf@club.com", cuando: "2026-10-15T12:10:00Z", antes: fila(), despues: fila({ categorias: { excelente: { d: 12000 }, regular: { d: 9000 } } }) },
      { id: 4, tabla: "gps_referencias", filaId: "r4", accion: "editada", quien: "pf@club.com", cuando: "2026-10-15T12:00:00Z", antes: fila({ categorias: { excelente: { d: 11800 } } }), despues: fila() },
    ];
    await montar();
    await irA(contenedor, "Valores de referencia");
    // De entrada, todas las tablas (como antes); el V.R. por jugador, con las cinco filas del Excel.
    expect(tarjetasVr().map((una) => una.querySelector("h2").textContent)).toEqual(["FUTBOL · Oficial · TOTAL", "DINAMICA · DINAMICA 1 · FUERZA", "Microciclo · Partidos · JUGADOR UNO"]);
    const deJugador = () => tarjetaVr("Microciclo · Partidos · JUGADOR UNO");
    expect([...deJugador().querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual(["Excelente", "Muy Bueno", "Bueno", "Regular", "Malo"]);
    expect(["Excelente", "Muy Bueno", "Bueno", "Regular", "Malo"].map((una) => celdaVr(deJugador(), una, "D").textContent)).toEqual(["12000,0", "11000,0", "10000,0", "9000,0", "8000,0"]);
    expect(celdaVr(deJugador(), "Excelente", "D/min").textContent).toBe("120,25");
    expect(celdaVr(deJugador(), "Excelente", "Tiempo").textContent).toBe("1:49:30");
    // Los del club siguen con Promedio y Desvío.
    expect([...tarjetaVr("FUTBOL · Oficial · TOTAL").querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual(["Promedio", "Desvío"]);
    // Una sola tabla.
    const tablas = () => contenedor.querySelectorAll(".evaluaciones-elegir-test-lista")[1];
    expect([...tablas().options].map((opcion) => opcion.textContent)).toEqual(["Todas las tablas", "FUTBOL · Oficial", "DINAMICA · DINAMICA 1", "Microciclo · Partidos"]);
    await elegir(tablas(), "Microciclo · Partidos");
    expect(tarjetasVr().map((una) => una.querySelector("h2").textContent)).toEqual(["Microciclo · Partidos · JUGADOR UNO"]);
    // Una categoría se cambia como los demás números; el Bueno es el promedio.
    await cambiarVr(celdaVr(deJugador(), "Excelente", "D"), "12500");
    expect(datos.cambiosVr.at(-1)).toEqual({ que: "valor", id: "r4", cual: "excelente", clave: "d", valor: 12500 });
    expect(celdaVr(deJugador(), "Excelente", "D").textContent).toBe("12500,0");
    await cambiarVr(celdaVr(deJugador(), "Bueno", "D"), "10100");
    expect(datos.cambiosVr.at(-1)).toEqual({ que: "valor", id: "r4", cual: "promedio", clave: "d", valor: 10100 });
    await cambiarVr(celdaVr(deJugador(), "Malo", "D"), "");
    expect(datos.cambiosVr.at(-1)).toEqual({ que: "valor", id: "r4", cual: "malo", clave: "d", valor: null });
    expect(celdaVr(deJugador(), "Malo", "D").textContent).toBe("");
    // Los últimos cambios dicen la categoría; una que aparece entera, número por número.
    const items = () => [...contenedor.querySelectorAll(".referencias-historial-lista > li")];
    const textos = items().map((item) => item.textContent);
    expect(textos.some((texto) => texto.includes("Borró «Microciclo · Partidos · JUGADOR DOS»"))).toBe(true);
    expect(textos.some((texto) => texto.includes("Microciclo · Partidos · JUGADOR UNO · D (Regular): vacío → 9000,0"))).toBe(true);
    expect(textos.some((texto) => texto.includes("Microciclo · Partidos · JUGADOR UNO · D (Excelente): 11800,0 → 12000,0"))).toBe(true);
    // «Volver»: la categoría, a como estaba; lo borrado, otra vez con sus categorías.
    const volverDe = (texto) => [...items().find((item) => item.textContent.includes(texto)).querySelectorAll("button")].find((b) => b.textContent === "Volver");
    await tocar(volverDe("D (Excelente): 11800,0 → 12000,0"));
    expect(datos.cambiosVr.at(-1)).toEqual({ que: "valor", id: "r4", cual: "excelente", clave: "d", valor: 11800 });
    await tocar(volverDe("D (Regular): vacío → 9000,0"));
    expect(datos.cambiosVr.at(-1)).toEqual({ que: "valor", id: "r4", cual: "regular", clave: "d", valor: null });
    await tocar(volverDe("Borró «Microciclo · Partidos · JUGADOR DOS»"));
    expect(datos.cambiosVr.at(-1)).toMatchObject({ que: "sumar", grupo: "JUGADOR DOS", categorias: { malo: { d: 7000 } } });
    // Otra vez todas.
    await elegir(tablas(), "");
    expect(tarjetasVr()).toHaveLength(4);
  });

  test("Valores de referencia: sin la actualización se miran y no se cambian; quien se fue, también", async () => {
    datos.referencias = VR().map(({ dePartido, ...una }) => una);
    datos.sinEdicionVr = true;
    await montar();
    await irA(contenedor, "Valores de referencia");
    expect(contenedor.textContent).toContain("Para cambiar los V.R. falta una actualización de la base de datos.");
    const td = celdaVr(tarjetaVr("FUTBOL · Oficial · TOTAL"), "Promedio", "D");
    await act(async () => td.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(td.querySelector("input")).toBeNull();
    expect(contenedor.querySelector(".referencias-acciones")).toBeNull();
    expect(contenedor.querySelector(".referencias-historial")).toBeNull();
    act(() => raiz.unmount());

    datos.sinEdicionVr = false;
    datos.referencias = VR();
    datos.equipo = { id: "eq-1", nombre: "Club de Prueba", hasta: "2026-09-25" };
    await montar();
    await irA(contenedor, "Valores de referencia");
    expect(contenedor.querySelector(".aviso-solo-lectura")).not.toBeNull();
    expect(tarjetasVr()).toHaveLength(2);
    expect(contenedor.querySelector(".referencias-acciones")).toBeNull();
    expect(boton("Agregar V.R. de Catapult")).toBeUndefined();
    act(() => raiz.unmount());

    datos.equipo = { id: "eq-1", nombre: "Club de Prueba", hasta: null };
    datos.faltanReferencias = true;
    datos.referencias = [];
    await montar();
    await irA(contenedor, "Valores de referencia");
    expect(contenedor.textContent).toContain("Para ver los V.R. falta una actualización de la base de datos.");
  });

  // Reportes › Por microciclo (Santiago, 15/10), con microciclos inventados:
  // el promedio del equipo de dos días por microciclo (en el 18, un descanso),
  // un partido oficial en el 17 cargado PT, TOTAL, ST y un jugador.
  const INFORME = () => {
    const lista = [];
    const agregar = (fecha, quien, valores) => lista.push(fila(`r${lista.length + 1}`, lista.length + 1, quien, fecha, { dispositivo: "catapult", tipo_microciclo: "competitivo", ...valores }));
    [17, 18, 19, 20].forEach((m, i) => {
      const dia = (n) => `2026-05-${String(4 + i * 7 + n).padStart(2, "0")}`;
      agregar(dia(0), { promedio: "sesion" }, { microciclo: m, condicion: "total", clasificacion_dias: "mas1_m", tipo_sesion: "din_compleja", d: 4000 + m * 10, tiempo: 3600, ua: 100 * (i + 1) });
      agregar(dia(1), { promedio: "sesion" }, { microciclo: m, condicion: "total", clasificacion_dias: "0_t", tipo_sesion: m === 18 ? "descanso" : "din_colectiva", d: 5000, tiempo: 3600, ua: 300 });
      agregar(dia(0), { jugador_id: 1 }, { microciclo: m, condicion: "total", va: "si", d: 4500, tiempo: 3600, ua: 250 });
    });
    ["PT", "TOTAL", "ST"].forEach((parte) => agregar("2026-05-05", { promedio: "parcial" }, { microciclo: 17, condicion: "parcial", tarea_partido: "partido_oficial_torneo", descripcion: `2026_05_05_ Vs Rival Uno ${parte} `, d: parte === "TOTAL" ? 9000 : 4500, tiempo: 2700 }));
    return lista;
  };
  const elegirEnLaLista = async (titulo, valores) => {
    await tocar(botones().find((b) => b.getAttribute("aria-label") === titulo));
    await tocar(boton("Ninguno"));
    for (const valor of valores) {
      // eslint-disable-next-line no-await-in-loop
      await tocar([...document.body.querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent === valor).querySelector("input"));
    }
    await tocar(boton("Listo"));
  };

  // La planilla de valor referencial (nota 2, 19/10): todo inventado.
  const FILAS_PLANILLA = () => [
    ...[4000, 4100, 4200, 3900, 4050, 3950, 4150, 4020, 3980, 9000].map((d, i) =>
      fila(`p${i}`, i + 1, { jugador_id: (i % 2) + 1 }, diasAntes(i + 2), { microciclo: 30, d, d_min: d / 50, tiempo: 3000, tarea_partido: "partido_oficial_torneo", dispositivo: "catapult" }),
    ),
    fila("t1", 20, { jugador_id: 1 }, diasAntes(3), { microciclo: 30, d: 2000, tiempo: 3000, tarea_partido: "otra_tarea", dispositivo: "catapult" }),
    fila("t2", 21, { jugador_id: 2 }, diasAntes(3), { microciclo: 30, d: 2200, tiempo: 3000, tarea_partido: "otra_tarea", dispositivo: "catapult" }),
    fila("pr", 22, { promedio: "parcial" }, diasAntes(2), { microciclo: 30, d: 4500, tiempo: 3000, tarea_partido: "partido_oficial_torneo", dispositivo: "catapult" }),
    fila("s1", 23, { jugador_id: 1 }, diasAntes(2), { microciclo: 30, d: 7000, tiempo: 3000, tarea_partido: "partido_oficial_torneo", dispositivo: "sport" }),
  ];
  const DE_LA_PLANILLA = () => ({
    id: "r9",
    dispositivo: "catapult",
    tipo: "",
    tabla: "Mi VR",
    grupo: "",
    orden: 9,
    promedio: { d: 4000 },
    desvio: {},
    categorias: { excelente: { d: 4300 }, muy_bueno: { d: 4150 }, regular: { d: 3850 }, malo: { d: 3700 } },
    dePartido: false,
    planilla: { version: 1, muestra: { tarea_partido: ["partido_oficial_torneo"] }, medidas: { d: { sentido: "mas", modo: "manual" } }, filas: 9, calculado: "2026-10-01" },
  });

  test("Valores de referencia › «Agregar V.R.» con la planilla: el nombre, la muestra con el embudo, el V.R. con sus atípicos y se guarda", async () => {
    datos.sinPlanilla = false;
    datos.referencias = VR();
    datos.filas = FILAS_PLANILLA();
    await montar();
    await irA(contenedor, "Valores de referencia");
    await tocar(boton("Agregar V.R. de Catapult"));
    expect(contenedor.querySelector("h1").textContent).toBe("Nuevo V.R. de Catapult");
    expect(contenedor.querySelector(".lesiones-paso-numero").textContent).toBe("Paso 1 de 2");
    // Qué medidas entran, en el paso 1 debajo del nombre: de entrada, todas las de números.
    const barra = () => contenedor.querySelector(".planilla-vr-medidas .planilla-vr-medidas-barra")?.textContent;
    const total = Number(/(\d+) de (\d+) elegidas/.exec(barra())[2]);
    expect(barra()).toContain(`${total} de ${total} elegidas`);
    expect(total).toBeGreaterThan(21);
    // La muestra: todas las filas de Catapult, también la del promedio del equipo; no las de Sport.
    const muestra = () => contenedor.querySelector(".planilla-vr-muestra").textContent;
    expect(muestra()).toContain("Muestra: 13 filas · 2 jugadores · del ");
    expect(filas(contenedor)).toHaveLength(13);
    // Sin nombre no sigue.
    await tocar(siguiente());
    expect(contenedor.textContent).toContain("Escribí el nombre del V.R.");
    await escribir(contenedor.querySelector("#planilla-vr-nombre"), " Partidos 2026 ");
    // El embudo de Tarea o Partido: solo los partidos.
    await tocar(contenedor.querySelector('.tabla-datos-filtro[aria-label="Filtrar u ordenar Tarea o Partido"]'));
    const valores = () => [...document.body.querySelectorAll(".tabla-datos-valores label")];
    await tocar(boton("Ninguno"));
    await tocar(valores().find((label) => label.textContent.startsWith("Partido Oficial Torneo")).querySelector("input"));
    await tocar(boton("Aplicar"));
    expect(muestra()).toContain("Muestra: 11 filas · 2 jugadores");
    await tocar(siguiente());
    expect(contenedor.querySelector(".lesiones-paso-numero").textContent).toBe("Paso 2 de 2");
    expect(contenedor.querySelector(".lesiones-encabezado p").textContent).toBe("Partidos 2026 · 11 filas · 2 jugadores · del " + fechaCorta(diasAntes(11)) + " al " + fechaCorta(diasAntes(2)));
    // Por medida, en la compu una tabla: el sentido de Ajustes, Automático, los datos y los cinco valores.
    const filaD = () => contenedor.querySelector('.planilla-vr-tabla tr[data-medida="d"]');
    expect(filaD().querySelector("th").textContent).toBe("D");
    expect(filaD().querySelector('select[aria-label="Sentido de D"]').value).toBe("mas");
    expect(filaD().querySelector('select[aria-label="Cortes de D"]').value).toBe("automatico");
    expect(filaD().querySelector("td.datos").textContent).toBe("10 de 11 · Ver 1 atípico");
    const valoresD = () => [...filaD().querySelectorAll("td.valor b")].map((b) => Number(b.textContent.replace(/\./g, "").replace(",", ".")));
    const [excelente, , bueno, , malo] = valoresD();
    expect(excelente).toBeGreaterThan(bueno);
    expect(malo).toBeLessThan(bueno);
    // Una medida sin números en la muestra.
    expect(contenedor.querySelector('.planilla-vr-tabla tr[data-medida="d_shi"] td.datos').textContent).toBe("Sin datos suficientes");
    // El celular: una tarjeta por medida, con lo mismo.
    expect(contenedor.querySelector('.planilla-vr-tarjeta[data-medida="d"] .planilla-vr-datos').textContent).toBe("Datos: 10 de 11 · Ver 1 atípico");
    // Los atípicos: qué fila, con qué valor y entre qué límites.
    await tocar(filaD().querySelector(".planilla-vr-ver-atipicos"));
    const hoja = () => document.body.querySelector(".planilla-vr-hoja-atipicos");
    expect(hoja().textContent).toContain("Atípicos de D (1)");
    expect(hoja().textContent).toContain("3 veces el rango entre el primer y el tercer cuartil");
    const atipico = hoja().querySelector(".planilla-vr-atipicos li");
    expect([...atipico.children].map((uno) => uno.textContent)).toEqual([fechaCorta(diasAntes(11)), "BETA", "9000,00", "Muy alto"]);
    await tocar(boton("Cerrar"));
    // «Menos es mejor» para este V.R.: Excelente pasa a ser lo más bajo.
    await elegir(filaD().querySelector('select[aria-label="Sentido de D"]'), "menos");
    expect(valoresD()[0]).toBeLessThan(valoresD()[2]);
    // El paso 2 es el resultado: con todas las medidas, sin elegirlas acá.
    expect(contenedor.querySelector('.planilla-vr-tabla tr[data-medida="smax"]')).toBeTruthy();
    expect(contenedor.querySelector(".planilla-vr-medidas-barra")).toBeNull();
    // Qué medidas entran se elige en el paso 1, en una hoja; lo elegido en el paso 2 sigue.
    await tocar(boton("Atrás"));
    expect(contenedor.querySelector(".lesiones-paso-numero").textContent).toBe("Paso 1 de 2");
    await tocar(boton("Elegir variables"));
    const hojaMedidas = () => document.body.querySelector(".planilla-vr-hoja-medidas");
    await tocar([...hojaMedidas().querySelectorAll("button")].find((b) => b.textContent === "Ninguno"));
    expect([...hojaMedidas().querySelectorAll("button")].find((b) => b.textContent === "Listo").disabled).toBe(true);
    const marcar = async (texto) => tocar([...hojaMedidas().querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent === texto).querySelector("input"));
    await marcar("D");
    await marcar("D/min");
    await tocar([...hojaMedidas().querySelectorAll("button")].find((b) => b.textContent === "Listo"));
    expect(barra()).toContain(`2 de ${total} elegidas`);
    expect(muestra()).toContain("Muestra: 11 filas · 2 jugadores");
    await tocar(siguiente());
    expect([...contenedor.querySelectorAll(".planilla-vr-tabla tr[data-medida]")].map((tr) => tr.dataset.medida)).toEqual(["d", "d_min"]);
    expect(filaD().querySelector('select[aria-label="Sentido de D"]').value).toBe("menos");
    // Los valores, con 2 decimales; tocando uno, todos; otra vez, 2.
    expect(contenedor.querySelector(".planilla-vr-tabla thead th").textContent).toBe("Variables");
    const excelenteMin = () => contenedor.querySelector('.planilla-vr-tabla tr[data-medida="d_min"] td.cat-excelente');
    expect(excelenteMin().querySelector("b").textContent).toMatch(/^\d+,\d{2}$/);
    await tocar(excelenteMin().querySelector(".planilla-vr-valor"));
    expect(excelenteMin().querySelector(".planilla-vr-valor").getAttribute("aria-pressed")).toBe("true");
    expect(excelenteMin().querySelector("b").textContent).toMatch(/^\d+,\d{3,}$/);
    await tocar(excelenteMin().querySelector(".planilla-vr-valor"));
    expect(excelenteMin().querySelector("b").textContent).toMatch(/^\d+,\d{2}$/);
    // Manual: los desvíos de cada categoría, de entrada los de Automático, con lo que ofrece la planilla.
    const cortesD = () => contenedor.querySelector('.planilla-vr-tabla tr[data-cortes="d"]');
    expect(cortesD()).toBeNull();
    const automaticoD = valoresD();
    await elegir(filaD().querySelector('select[aria-label="Cortes de D"]'), "manual");
    expect(valoresD()).toEqual(automaticoD);
    const desvio = (categoria) => cortesD().querySelector(`select[aria-label="Desvíos de ${categoria} en D"]`);
    // En la compu, cada desvío debajo de su columna; Bueno (el promedio) no tiene.
    expect([...cortesD().children].map((celda) => celda.className)).toEqual(["fija", "planilla-vr-cortes-suma", "cat-excelente", "cat-muy_bueno", "cat-bueno", "cat-regular", "cat-malo"]);
    expect(desvio("Excelente").closest("td").className).toBe("cat-excelente");
    expect(desvio("Malo").closest("td").className).toBe("cat-malo");
    expect(cortesD().querySelector("td.cat-bueno select")).toBeNull();
    const opciones = (select) => [...select.options].map((opcion) => opcion.textContent);
    expect(opciones(desvio("Muy Bueno"))).toEqual(["0,25", "0,50", "0,75", "1,00", "1,25", "1,50", "1,75"]);
    expect(cortesD().querySelector(".planilla-vr-suma").textContent).toBe("Suma de los %: 100,0%");
    // Excelente, solo por encima de Muy bueno y hasta 2.
    await elegir(desvio("Muy Bueno"), "1.75");
    expect(opciones(desvio("Excelente"))).toEqual(["2,00"]);
    expect(desvio("Excelente").value).toBe("2");
    await elegir(desvio("Regular"), "0.5");
    expect(Number(desvio("Malo").value)).toBeGreaterThan(0.5);
    expect(cortesD().querySelector(".planilla-vr-suma").textContent).toBe("Suma de los %: 100,0%");
    // En el celular, lo mismo en la tarjeta.
    expect(contenedor.querySelector('.planilla-vr-tarjeta[data-medida="d"] .planilla-vr-cortes select[aria-label="Desvíos de Excelente en D"]')).toBeTruthy();
    const maloElegido = Number(desvio("Malo").value);
    await tocar(boton("Guardar V.R."));
    const guardado = datos.cambiosVr.at(-1);
    expect(guardado).toMatchObject({ que: "sumar", dispositivo: "catapult", tipo: "", tabla: "Partidos 2026", grupo: "", orden: 4, desvio: {} });
    expect(guardado.planilla).toEqual({
      version: 1,
      muestra: { tarea_partido: ["partido_oficial_torneo"] },
      medidas: { d: { sentido: "menos", modo: "manual", cortes: { excelente: 2, muy_bueno: 1.75, regular: 0.5, malo: maloElegido } }, d_min: { sentido: "mas", modo: "automatico" } },
      filas: 11,
      calculado: HOY,
    });
    expect(Object.keys(guardado.promedio)).toEqual(["d", "d_min"]);
    expect(guardado.categorias.excelente.d).toBeLessThan(guardado.promedio.d);
    // De vuelta en Valores de referencia: la tarjeta, con sus cinco filas y con qué se calculó.
    expect(contenedor.querySelector("h1").textContent).toBe("Valores de referencia");
    expect(contenedor.textContent).toContain("V.R. agregado.");
    const tarjeta = tarjetaVr("Partidos 2026");
    expect([...tarjeta.querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual(["Excelente", "Muy Bueno", "Bueno", "Regular", "Malo"]);
    expect(tarjeta.querySelector(".referencias-calculado").textContent).toBe(`Calculado el ${fechaCorta(HOY)} con 11 filas · Tarea o Partido: Partido Oficial Torneo`);
    // Otro V.R. nuevo arranca sin los filtros ni las medidas del anterior.
    await tocar(boton("Agregar V.R. de Catapult"));
    expect(muestra()).toContain("Muestra: 13 filas");
    expect(barra()).toContain(`${total} de ${total} elegidas`);
  });

  test("Valores de referencia › «Agregar V.R.» con la planilla: en las por minuto, «Datos» dice cuántas filas no entran por no tener tiempo", async () => {
    datos.sinPlanilla = false;
    datos.referencias = VR();
    datos.filas = [
      ...FILAS_PLANILLA(),
      fila("z1", 30, { jugador_id: 1 }, diasAntes(4), { microciclo: 30, d: 500, tiempo: 0, tarea_partido: "partido_oficial_torneo", dispositivo: "catapult" }),
      fila("z2", 31, { jugador_id: 2 }, diasAntes(4), { microciclo: 30, d: 0, tiempo: 0, tarea_partido: "partido_oficial_torneo", dispositivo: "catapult" }),
    ];
    await montar();
    await irA(contenedor, "Valores de referencia");
    await tocar(boton("Agregar V.R. de Catapult"));
    await escribir(contenedor.querySelector("#planilla-vr-nombre"), "Con tiempo 0");
    await tocar(siguiente());
    const datosDe = (clave) => contenedor.querySelector(`.planilla-vr-tabla tr[data-medida="${clave}"] td.datos`).textContent;
    // En la planilla darían #DIV/0!: acá no entran y se dice cuántas.
    expect(datosDe("d_min")).toMatch(/ · 2 sin tiempo$/);
    // En las absolutas, no.
    expect(datosDe("d")).not.toContain("sin tiempo");
    expect(contenedor.querySelector('.planilla-vr-tarjeta[data-medida="d_min"] .planilla-vr-datos').textContent).toMatch(/ · 2 sin tiempo$/);
  });

  test("Valores de referencia › un V.R. de la planilla: «Recalcular» pregunta y usa la misma muestra con los datos de hoy; un solo nombre; «Volver»", async () => {
    datos.sinPlanilla = false;
    datos.referencias = [...VR(), DE_LA_PLANILLA()];
    datos.filas = FILAS_PLANILLA();
    datos.historialVr = [
      {
        id: 5,
        tabla: "gps_referencias",
        filaId: "r9",
        accion: "editada",
        quien: "pf@club.com",
        cuando: "2026-10-14T19:30:00Z",
        antes: { ...DE_LA_PLANILLA(), promedio: { d: 3000 }, planilla: { ...DE_LA_PLANILLA().planilla, filas: 5 } },
        despues: DE_LA_PLANILLA(),
      },
    ];
    await montar();
    await irA(contenedor, "Valores de referencia");
    const tarjeta = () => tarjetaVr("Mi VR");
    expect(tarjeta().querySelector(".referencias-calculado").textContent).toBe(`Calculado el ${fechaCorta("2026-10-01")} con 9 filas · Tarea o Partido: Partido Oficial Torneo`);
    const dentro = (texto) => [...tarjeta().querySelectorAll(".referencias-acciones button")].find((b) => b.textContent === texto);
    // Los V.R. escritos a mano no tienen «Recalcular».
    expect([...tarjetaVr("FUTBOL · Oficial · TOTAL").querySelectorAll(".referencias-acciones button")].map((b) => b.textContent)).not.toContain("Recalcular");
    await tocar(dentro("Recalcular"));
    const dialogo = () => document.body.querySelector(".hoja-confirmar");
    expect(dialogo().querySelector("h3").textContent).toBe("¿Recalcular «Mi VR»?");
    expect(dialogo().textContent).toContain("Se calcula de nuevo con la misma muestra (Tarea o Partido: Partido Oficial Torneo) y lo elegido en cada variable, con los datos de hoy: 11 filas (2 más que la vez anterior).");
    await tocar(dialogo().querySelector(".boton-confirmar-hoja"));
    const recalculado = datos.cambiosVr.at(-1);
    expect(recalculado).toMatchObject({ que: "recalcular", id: "r9", desvio: {} });
    expect(recalculado.planilla).toMatchObject({ muestra: { tarea_partido: ["partido_oficial_torneo"] }, filas: 11, calculado: HOY });
    // Solo las medidas elegidas, con lo elegido (D, Manual; sin desvíos guardados, los de Automático).
    expect(recalculado.planilla.medidas).toEqual({ d: { sentido: "mas", modo: "manual" } });
    expect(Object.keys(recalculado.promedio)).toEqual(["d"]);
    expect(contenedor.textContent).toContain("V.R. recalculado.");
    expect(tarjeta().querySelector(".referencias-calculado").textContent).toContain("con 11 filas");
    // Un solo nombre.
    await tocar(dentro("Cambiar nombre"));
    expect(document.body.querySelector("#vr-tipo")).toBeNull();
    expect(document.body.querySelector("#vr-nombre").value).toBe("Mi VR");
    await escribir(document.body.querySelector("#vr-nombre"), "");
    await tocar(boton("Guardar"));
    expect(document.body.textContent).toContain("Escribí el nombre del V.R.");
    await escribir(document.body.querySelector("#vr-nombre"), "Partidos 2027");
    await tocar(boton("Guardar"));
    expect(datos.cambiosVr.at(-1)).toEqual({ que: "nombre", id: "r9", tipo: "", tabla: "Partidos 2027", grupo: "" });
    expect(tarjetaVr("Partidos 2027")).toBeTruthy();
    // En los últimos cambios, un recálculo es una línea; «Volver» deja todo como estaba.
    const item = [...contenedor.querySelectorAll(".referencias-historial-lista > li")].find((li) => li.textContent.includes("Recalculó «Mi VR»"));
    expect(item).toBeTruthy();
    expect(item.textContent).not.toContain("→");
    await tocar([...item.querySelectorAll("button")].find((b) => b.textContent === "Volver"));
    expect(datos.cambiosVr.at(-1)).toMatchObject({ que: "recalcular", id: "r9", promedio: { d: 3000 }, planilla: { filas: 5 } });
    expect(document.body.textContent).toContain("Listo: quedó como estaba.");
  });

  test("Valores de referencia › la planilla: sin todas las filas todavía, no se calcula (lo dice)", async () => {
    datos.sinPlanilla = false;
    datos.referencias = [DE_LA_PLANILLA()];
    datos.filas = FILAS_PLANILLA();
    datos.errorHistorial = "gps.error.noLeer";
    await montar();
    await irA(contenedor, "Valores de referencia");
    expect(boton("Agregar V.R. de Catapult").disabled).toBe(true);
    expect([...tarjetaVr("Mi VR").querySelectorAll(".referencias-acciones button")].find((b) => b.textContent === "Recalcular").disabled).toBe(true);
    expect(contenedor.textContent).toContain("Para calcular un V.R. hacen falta todas las filas del GPS: todavía están llegando.");
  });

  test("Informe › Por microciclo: el menú, los filtros con casillas, el informe con sus franjas y colores, y otro V.R.", async () => {
    datos.filas = INFORME();
    datos.plantel = PLANTEL.map((jugador) => ({ ...jugador }));
    datos.referencias = [
      { id: "c1", dispositivo: "catapult", tipo: "FUTBOL", tabla: "Oficial", grupo: "TOTAL", orden: 1, promedio: { d: 5000, tiempo: 3600 }, desvio: { d: 500 }, dePartido: false },
      { id: "s1", dispositivo: "sport", tipo: "FUTBOL", tabla: "FUTBOL 2", grupo: "TOTAL", orden: 2, promedio: { d: 4000 }, desvio: {}, dePartido: false },
    ];
    await montar();
    // La solapa se llama Informe (Santiago, 15/10).
    expect([...contenedor.querySelectorAll(".navegacion-movil button")].map((b) => b.textContent)).toEqual(["Cargar", "Base", "Informe", "Valores de referencia", "Ajustes"]);
    await irA(contenedor, "Informe");
    expect(contenedor.querySelector("h1").textContent).toBe("Informe");
    // Las cinco opciones, las cinco hechas.
    const opciones = [...contenedor.querySelectorAll(".reporte-opcion")];
    expect(opciones.map((una) => una.querySelector("b").textContent)).toEqual(["Por microciclo", "Por tarea", "Por jugador", "Reporte individual", "Reporte grupal"]);
    expect(opciones.map((una) => una.disabled)).toEqual([false, false, false, false, false]);
    expect(opciones[2].textContent).toContain("Hasta 5 comparaciones por jugador");

    // Los filtros: al entrar, el promedio del equipo de cada microciclo.
    await tocar(opciones[0]);
    expect(contenedor.querySelector("h1").textContent).toBe("Por microciclo");
    expect([...contenedor.querySelectorAll(".gps-reportes-rotulo")].map((span) => span.textContent)).toEqual(["Microciclo", "Fecha", "Tipo de Sesión", "Tipo Microciclo", "Clasificación Días", "Microciclo/Jugador", "Nombre"]);
    expect(botones().find((b) => b.getAttribute("aria-label") === "Microciclo/Jugador").textContent).toBe("Sesión (promedio del equipo)");
    expect(contenedor.querySelector(".gps-reportes-siguiente").textContent).toContain("el informe tiene 4 filas");
    // Microciclo: solo los que tienen datos; se eligen del 18 al 20.
    await tocar(botones().find((b) => b.getAttribute("aria-label") === "Microciclo"));
    expect([...document.body.querySelectorAll(".tabla-datos-valores label")].map((label) => label.textContent)).toEqual(["17", "18", "19", "20"]);
    await tocar(boton("Cancelar"));
    await elegirEnLaLista("Microciclo", ["18", "19", "20"]);
    expect(contenedor.querySelector(".gps-reportes-siguiente").textContent).toContain("el informe tiene 3 filas");
    // «Siguiente» va en la barra de arriba, al lado de Volver (fija al bajar),
    // y una sola vez: abajo de los filtros queda solo cuántas filas tendrá
    // (Santiago, 17/10: «Arriba, fija al bajar»).
    expect(siguiente().closest(".reporte-acciones")).not.toBeNull();
    expect(contenedor.querySelector(".reporte-acciones .reporte-volver")).not.toBeNull();
    expect(botones().filter((b) => b.textContent.trim().startsWith("Siguiente"))).toHaveLength(1);
    expect(contenedor.querySelector(".gps-reportes-siguiente button")).toBeNull();

    // El informe.
    await tocar(siguiente());
    // Arriba, «Filtros» dice qué se filtró; de entrada, cerrado (Santiago, 16/10).
    const botonFiltros = () => contenedor.querySelector(".gps-informe-filtros-boton");
    expect(botonFiltros().textContent).toBe("FiltrosMicrociclo: 18 a 20 · Microciclo/Jugador: Sesión (promedio del equipo)");
    expect(botonFiltros().getAttribute("aria-expanded")).toBe("false");
    expect(contenedor.querySelector(".gps-informe-filtros .gps-reportes-grilla")).toBeNull();
    const tabla = contenedor.querySelector(".gps-informe-tabla");
    const filasDelInforme = [...tabla.querySelectorAll("tbody.gps-informe-filas tr")];
    // Solo microciclos del equipo: cada fila dice su número (Santiago, 15/10:
    // la presentación) y arriba, cuántos son y de dónde salen las franjas
    // (con Mi selección, de todo lo que se ve: Santiago, 16/10).
    expect(tabla.querySelector("thead th").textContent).toBe("Microciclo");
    expect(filasDelInforme.map((tr) => tr.querySelector("th").textContent)).toEqual(["18", "19", "20"]);
    expect(contenedor.querySelector(".gps-informe-titulo").textContent).toBe("Franjas de Mi selección3 microciclos");
    // N° Sesiones (con el descanso) y N° Descanso.
    expect(filasDelInforme.map((tr) => [tr.querySelectorAll("td")[0].textContent, tr.querySelectorAll("td")[1].textContent])).toEqual([["2", "1"], ["2", "0"], ["2", "0"]]);
    // Las franjas, en su bloque, cada número pintado con el color que toma
    // (Santiago, 15/10, con una imagen: la celda entera); el desvío, no.
    expect([...tabla.querySelectorAll("tbody.gps-informe-franjas th")].map((th) => th.textContent)).toEqual(["V.R.", "Excelente", "Muy bueno", "Bueno (promedio)", "Regular", "Malo", "Desvío"]);
    expect([...tabla.querySelectorAll("tbody.gps-informe-franjas tr.franja-excelente td.pintada")].every((td) => td.style.background)).toBe(true);
    expect(tabla.querySelectorAll("tbody.gps-informe-franjas tr.franja-excelente td.pintada").length).toBeGreaterThan(0);
    expect(tabla.querySelectorAll("tbody.gps-informe-franjas tr.franja-desvio td.pintada")).toHaveLength(0);
    // Todas las columnas se pintan con sus reglas (Santiago, 15/10): la U.A. y también los índices.
    expect(filasDelInforme.every((tr) => tr.querySelectorAll("td")[2].style.background)).toBe(true);
    // El % del promedio de D contra el V.R. (D 5000 → 4590 / 5000 en el 18).
    expect(filasDelInforme[0].querySelectorAll("td")[8].textContent).toBe("92%");
    expect(filasDelInforme.every((tr) => tr.querySelectorAll("td")[8].style.background)).toBe(true);
    // VS RIVAL: el 17 no entró; los demás, sin partidos oficiales («–»: sin dato).
    expect(filasDelInforme.map((tr) => tr.querySelector("td.gps-informe-rival").textContent)).toEqual(["–", "–", "–"]);

    // Visualización, Tipo de variable y Categorización: sin Objetivo, que
    // solo pinta cuando todas las filas son jugadores (Santiago, 16/10).
    const desplegables = [...contenedor.querySelectorAll(".gps-reportes-grilla select")];
    expect(desplegables.map((select) => [...select.options].map((option) => option.textContent))).toEqual([
      ["Absolutas", "Relativas"],
      ["Valor promedio", "Valor suma", "% del promedio", "% de la suma"],
      ["Mi selección", "Valor referencial"],
    ]);
    await elegir(desplegables[2], "valorReferencial");
    // Con Valor referencial, las franjas son las del V.R.; la U.A. no tiene
    // franjas ni colores (como el archivo); los índices, sí.
    expect(contenedor.querySelector(".gps-informe-titulo").textContent).toBe("Franjas de Catapult · FUTBOL · Oficial · TOTAL3 microciclos");
    const conVr = [...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-filas tr")];
    expect(conVr.every((tr) => !tr.querySelectorAll("td")[2].style.background)).toBe(true);
    expect(conVr.every((tr) => tr.querySelectorAll("td")[8].style.background)).toBe(true);

    // + Otro V.R.: el de Sport, y un solo botón para ver sus franjas.
    await tocar(boton("+ Otro V.R."));
    expect([...contenedor.querySelectorAll(".gps-reportes-vr select")].map((select) => select.options[select.selectedIndex].textContent)).toEqual(["Catapult · FUTBOL · Oficial · TOTAL", "Sport · FUTBOL · FUTBOL 2 · TOTAL"]);
    await tocar(botones().find((b) => b.textContent.startsWith("Ver las de Sport")));
    expect(contenedor.querySelector(".gps-informe-titulo").textContent).toContain("Franjas de Sport · FUTBOL · FUTBOL 2 · TOTAL");
    // Con Mi selección, unas solas franjas, sin «Ver las de …», y una fila de V.R. por
    // dispositivo con su nombre: cada fila del informe tiene el suyo (16/10).
    await elegir(contenedor.querySelectorAll(".gps-reportes-grilla select")[2], "miSeleccion");
    expect(contenedor.querySelector(".gps-informe-titulo").textContent).toBe("Franjas de Mi selección3 microciclos");
    expect(botones().some((b) => b.textContent.startsWith("Ver las de"))).toBe(false);
    expect([...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-franjas th")].map((th) => th.textContent).slice(0, 3)).toEqual(["V.R. Catapult", "V.R. Sport", "Excelente"]);
    // El valor de cada V.R. (Catapult: D 5000 y tiempo 1 h; Sport: D 4000).
    const filasVr = [...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-franjas tr.franja-vr")];
    expect(filasVr.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent).filter((texto) => texto && texto !== "–"))).toEqual([["5000,0", "1:00:00"], ["4000,0"]]);
    await elegir(contenedor.querySelectorAll(".gps-reportes-grilla select")[2], "valorReferencial");
    await tocar(botones().find((b) => b.getAttribute("aria-label") === "Quitar este V.R."));
    expect(contenedor.querySelectorAll(".gps-reportes-vr select")).toHaveLength(1);

    // «Filtros» abre acá los mismos filtros, sin salir del informe (Santiago,
    // 16/10: «eso revela los filtros pero no te saca de la pantalla»), y
    // «Limpiar filtros» cambia el informe ahí mismo: entran también los jugadores.
    await tocar(botonFiltros());
    expect(botonFiltros().getAttribute("aria-expanded")).toBe("true");
    expect([...contenedor.querySelectorAll(".gps-informe-filtros .gps-reportes-rotulo")].map((span) => span.textContent)).toEqual(["Microciclo", "Fecha", "Tipo de Sesión", "Tipo Microciclo", "Clasificación Días", "Microciclo/Jugador", "Nombre"]);
    await tocar(boton("Limpiar filtros"));
    expect(contenedor.querySelector("h1").textContent).toBe("Por microciclo");
    expect(siguiente()).toBeUndefined();
    expect(botones().find((b) => b.getAttribute("aria-label") === "Microciclo/Jugador").textContent).toBe("Todos");
    expect(contenedor.querySelector(".gps-informe-filtros .gps-reportes-siguiente").textContent).toContain("el informe tiene 5 filas");
    expect(botonFiltros().textContent).toBe("FiltrosSin filtros: entra todo.");
    // Tocándolo otra vez, se cierran.
    await tocar(botonFiltros());
    expect(botonFiltros().getAttribute("aria-expanded")).toBe("false");
    expect(contenedor.querySelector(".gps-informe-filtros .gps-reportes-grilla")).toBeNull();
    // Con jugadores y microciclos: la primera columna dice qué es cada fila.
    expect(contenedor.querySelector(".gps-informe-tabla thead th").textContent).toBe("Nombre / Microciclo");
    const etiquetas = [...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-filas th")].map((th) => th.textContent);
    // El jugador, solo con su nombre (sin sus microciclos al lado: nota del 15/10).
    expect(etiquetas).toEqual(["ALFA", "Team Average Sesion17", "Team Average Sesion18", "Team Average Sesion19", "Team Average Sesion20"]);
    // VS RIVAL del 17: el TOTAL, aunque se cargó en el medio.
    expect(contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-filas td.gps-informe-rival")[1].textContent).toBe("Vs Rival Uno TOTAL");
    // El jugador, con la carga crónica del último microciclo elegido (el 20: su U.A. ÷ la de ese y los 3 anteriores).
    expect(contenedor.querySelector(".gps-informe-tabla tbody.gps-informe-filas tr").querySelectorAll("td")[4].textContent).toBe("1,00");
    // Objetivo: con filas del equipo no está; solo con jugadores (Santiago,
    // 16/10: «Solo pinta en caso de que solo haya jugadores»).
    const categorizaciones = () => [...contenedor.querySelectorAll(".gps-reportes-grilla select")[2].options].map((option) => option.value);
    expect(categorizaciones()).toEqual(["miSeleccion", "valorReferencial"]);
    await tocar(botonFiltros());
    await elegirEnLaLista("Microciclo/Jugador", ["Jugador"]);
    expect(categorizaciones()).toEqual(["miSeleccion", "valorReferencial", "objetivo"]);
    await elegir(contenedor.querySelectorAll(".gps-reportes-grilla select")[2], "objetivo");
    expect(contenedor.querySelector(".gps-informe-titulo").textContent).toBe("Franjas de Objetivo sesión/microciclo1 jugador");
    // Si vuelven las filas del equipo, Objetivo se va y queda Mi selección.
    await elegirEnLaLista("Microciclo/Jugador", ["Sesión (promedio del equipo)"]);
    expect(categorizaciones()).toEqual(["miSeleccion", "valorReferencial"]);
    expect(contenedor.querySelectorAll(".gps-reportes-grilla select")[2].value).toBe("miSeleccion");
    expect(contenedor.querySelector(".gps-informe-titulo").textContent).toBe("Franjas de Mi selección4 microciclos");
    // «‹ Informe» vuelve a «Ver informes».
    await tocar(contenedor.querySelector(".reporte-volver"));
    expect(contenedor.querySelector("h1").textContent).toBe("Informe");
    expect(contenedor.querySelectorAll(".reporte-opcion")).toHaveLength(5);
  });

  test("Informe › «Filtros» adentro: cambiar qué entra no saca del informe y, si el V.R. elegido no vale para lo nuevo, va el de entrada", async () => {
    // Microciclos inventados: el 10 y el 11 tomados con Sport; el 17 y el 18, con Catapult.
    const lista = [];
    const agregar = (fecha, valores) =>
      lista.push(fila(`r${lista.length + 1}`, lista.length + 1, { promedio: "sesion" }, fecha, { tipo_microciclo: "competitivo", condicion: "total", clasificacion_dias: "mas1_m", tipo_sesion: "din_compleja", d: 4000, tiempo: 3600, ua: 300, ...valores }));
    agregar("2026-03-02", { dispositivo: "sport", microciclo: 10 });
    agregar("2026-03-09", { dispositivo: "sport", microciclo: 11 });
    agregar("2026-05-04", { dispositivo: "catapult", microciclo: 17 });
    agregar("2026-05-11", { dispositivo: "catapult", microciclo: 18 });
    datos.filas = lista;
    datos.referencias = [
      { id: "c1", dispositivo: "catapult", tipo: "FUTBOL", tabla: "Oficial", grupo: "TOTAL", orden: 1, promedio: { d: 5000, tiempo: 3600 }, desvio: { d: 500 }, dePartido: false },
      { id: "s1", dispositivo: "sport", tipo: "FUTBOL", tabla: "FUTBOL 2", grupo: "TOTAL", orden: 2, promedio: { d: 4000 }, desvio: {}, dePartido: false },
    ];
    await montar();
    await irA(contenedor, "Informe");
    await tocar(contenedor.querySelector(".reporte-opcion"));
    await elegirEnLaLista("Microciclo", ["17", "18"]);
    await tocar(siguiente());
    const titulo = () => contenedor.querySelector(".gps-informe-titulo").textContent;
    const vrElegido = () => [...contenedor.querySelectorAll(".gps-reportes-vr select")].map((select) => select.options[select.selectedIndex].textContent);
    const microciclos = () => [...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-filas th")].map((th) => th.textContent);
    expect(vrElegido()).toEqual(["Catapult · FUTBOL · Oficial · TOTAL"]);
    expect(titulo()).toBe("Franjas de Mi selección2 microciclos");
    // Adentro, el 10 y el 11: el informe cambia ahí mismo y, como el V.R. de
    // Catapult no vale para ellos, va el de entrada (el de Sport), igual que
    // al pasar de los filtros al informe.
    await tocar(contenedor.querySelector(".gps-informe-filtros-boton"));
    await elegirEnLaLista("Microciclo", ["10", "11"]);
    expect(contenedor.querySelector("h1").textContent).toBe("Por microciclo");
    expect(microciclos()).toEqual(["10", "11"]);
    expect(vrElegido()).toEqual(["Sport · FUTBOL · FUTBOL 2 · TOTAL"]);
    expect(titulo()).toBe("Franjas de Mi selección2 microciclos");
    // El que sigue valiendo, queda: con el 11 solo, sigue el de Sport.
    await elegirEnLaLista("Microciclo", ["11"]);
    expect(microciclos()).toEqual(["11"]);
    expect(vrElegido()).toEqual(["Sport · FUTBOL · FUTBOL 2 · TOTAL"]);
    expect(titulo()).toBe("Franjas de Mi selección1 microciclo");
  });

  test("Informe › Mi selección pinta todas las filas, también las que no tienen V.R. (Santiago, 16/10); con Relativas no hay Suma ni % Suma", async () => {
    // Microciclos inventados: el 10 y el 11 tomados con Sport, sin un V.R. de Sport; el 17 y el 18, con Catapult.
    const lista = [];
    const agregar = (fecha, valores) =>
      lista.push(fila(`r${lista.length + 1}`, lista.length + 1, { promedio: "sesion" }, fecha, { tipo_microciclo: "competitivo", condicion: "total", clasificacion_dias: "mas1_m", tipo_sesion: "din_compleja", tiempo: 3600, ua: 300, ...valores }));
    agregar("2026-03-02", { dispositivo: "sport", microciclo: 10, d: 3000 });
    agregar("2026-03-09", { dispositivo: "sport", microciclo: 11, d: 3500 });
    agregar("2026-05-04", { dispositivo: "catapult", microciclo: 17, d: 4000 });
    agregar("2026-05-11", { dispositivo: "catapult", microciclo: 18, d: 4500 });
    datos.filas = lista;
    datos.referencias = [{ id: "c1", dispositivo: "catapult", tipo: "FUTBOL", tabla: "Oficial", grupo: "TOTAL", orden: 1, promedio: { d: 5000, tiempo: 3600 }, desvio: { d: 500 }, dePartido: false }];
    await montar();
    await irA(contenedor, "Informe");
    await tocar(contenedor.querySelector(".reporte-opcion"));
    await tocar(siguiente());
    const filasDelInforme = () => [...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-filas tr")];
    // La columna de D (la primera de las variables).
    const pintadas = () => filasDelInforme().map((tr) => [tr.querySelector("th").textContent, Boolean(tr.querySelectorAll("td")[14].style.background)]);
    expect(contenedor.querySelector(".gps-informe-titulo").textContent).toBe("Franjas de Mi selección4 microciclos");
    expect(pintadas()).toEqual([["10", true], ["11", true], ["17", true], ["18", true]]);
    // Con Valor referencial, solo las que tienen V.R.
    const desplegables = () => [...contenedor.querySelectorAll(".gps-reportes-grilla select")];
    await elegir(desplegables()[2], "valorReferencial");
    expect(pintadas()).toEqual([["10", false], ["11", false], ["17", true], ["18", true]]);
    await elegir(desplegables()[2], "miSeleccion");
    // Relativas: sin Valor suma ni % de la suma; si estaba la suma, pasa al promedio.
    await elegir(desplegables()[1], "suma");
    await elegir(desplegables()[0], "relativas");
    expect([...desplegables()[1].options].map((option) => option.textContent)).toEqual(["Valor promedio", "% del promedio"]);
    expect(desplegables()[1].value).toBe("promedio");
    await elegir(desplegables()[0], "absolutas");
    expect([...desplegables()[1].options].map((option) => option.textContent)).toEqual(["Valor promedio", "Valor suma", "% del promedio", "% de la suma"]);
  });

  test("Informe › ocultar columnas (pregunta antes y se recuerdan) y «Franjas» oculta y muestra las franjas; las filas no se ocultan", async () => {
    datos.filas = INFORME();
    datos.referencias = [{ id: "c1", dispositivo: "catapult", tipo: "FUTBOL", tabla: "Oficial", grupo: "TOTAL", orden: 1, promedio: { d: 5000, tiempo: 3600 }, desvio: { d: 500 }, dePartido: false }];
    await montar();
    await irA(contenedor, "Informe");
    await tocar(contenedor.querySelector(".reporte-opcion"));
    await tocar(siguiente());
    const cabecerasDelInforme = () => [...contenedor.querySelectorAll(".gps-informe-tabla .gps-informe-cabecera")].map((b) => b.textContent);
    const filasDelInforme = () => [...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-filas th")].map((th) => th.textContent);
    const franjas = () => [...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-franjas th")].map((th) => th.textContent);
    const loQueSeVe = () => [...contenedor.querySelectorAll(".gps-informe-ver")].map((b) => b.textContent);
    // Arriba, «Columnas» y, al lado, «Franjas» (Santiago, 16/10); no hay «Filas».
    expect(loQueSeVe()).toEqual(["ColumnasTodas", "FranjasA la vista"]);
    const columnasAlEntrar = cabecerasDelInforme().length;
    // La Suma de la carga crónica: tocar su cabecera pregunta, y «Cancelar» la deja.
    const sumaDeLaCronica = () => [...contenedor.querySelectorAll(".gps-informe-tabla th.tono-1 .gps-informe-cabecera")].find((b) => b.textContent === "Suma");
    await tocar(sumaDeLaCronica());
    expect(document.body.querySelector(".hoja-confirmar h3").textContent).toBe("¿Ocultar «Carga crónica · Suma»?");
    expect(document.body.querySelector(".hoja-confirmar p").textContent).toContain("Los números no cambian");
    await tocar(boton("Cancelar"));
    expect(cabecerasDelInforme()).toHaveLength(columnasAlEntrar);
    // «Ocultar»: deja de verse, mientras se está en el informe (no se guarda).
    await tocar(sumaDeLaCronica());
    await tocar(boton("Ocultar"));
    expect(cabecerasDelInforme()).toHaveLength(columnasAlEntrar - 1);
    expect(sumaDeLaCronica()).toBeUndefined();
    expect(loQueSeVe()).toEqual(["Columnas1 oculta", "FranjasA la vista"]);
    expect(localStorage.getItem("gps_informe_columnas_ocultas")).toBeNull();
    // Las filas no se ocultan: su nombre no es un botón.
    expect(filasDelInforme()).toEqual(["17", "18", "19", "20"]);
    expect(contenedor.querySelector(".gps-informe-tabla tbody.gps-informe-filas th button")).toBeNull();
    expect(contenedor.querySelector(".gps-informe-tabla tbody.gps-informe-franjas th button")).toBeNull();
    // «Franjas»: un toque las oculta (queda la fila del V.R.) y otro las vuelve a mostrar; los colores de las filas no cambian.
    const delDiecinueve = () => {
      const td = [...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-filas tr")].find((tr) => tr.querySelector("th").textContent === "19").querySelectorAll("td")[2];
      return [td.textContent, td.style.background];
    };
    const antesDeOcultar = delDiecinueve();
    expect(franjas()).toEqual(["V.R.", "Excelente", "Muy bueno", "Bueno (promedio)", "Regular", "Malo", "Desvío"]);
    const botonFranjas = () => contenedor.querySelector(".gps-informe-franjas-boton");
    expect(botonFranjas().getAttribute("aria-label")).toBe("Ocultar las franjas");
    await tocar(botonFranjas());
    expect(franjas()).toEqual(["V.R."]);
    expect(loQueSeVe()).toEqual(["Columnas1 oculta", "FranjasOcultas"]);
    expect(botonFranjas().getAttribute("aria-label")).toBe("Mostrar las franjas");
    expect(delDiecinueve()).toEqual(antesDeOcultar);
    await tocar(botonFranjas());
    expect(franjas()).toEqual(["V.R.", "Excelente", "Muy bueno", "Bueno (promedio)", "Regular", "Malo", "Desvío"]);
    // «Columnas»: la lista con casillas vuelve a mostrarla.
    await tocar(contenedor.querySelector(".gps-informe-ver"));
    const casilla = [...document.body.querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent === "Carga crónica · Suma");
    expect(casilla.querySelector("input").checked).toBe(false);
    await tocar(casilla.querySelector("input"));
    await tocar(boton("Listo"));
    expect(sumaDeLaCronica()).toBeDefined();
    expect(cabecerasDelInforme()).toHaveLength(columnasAlEntrar);
    // Al volver a «Ver informes» y entrar otra vez, lo oculto vuelve a verse
    // (Santiago, 17/10: «Hasta salir de esa base», «Bases e informes»).
    await tocar(sumaDeLaCronica());
    await tocar(boton("Ocultar"));
    expect(sumaDeLaCronica()).toBeUndefined();
    await tocar(contenedor.querySelector(".reporte-volver"));
    await tocar(contenedor.querySelector(".reporte-opcion"));
    await tocar(siguiente());
    expect(sumaDeLaCronica()).toBeDefined();
    // Y al salir de GPS y volver, también.
    await tocar(sumaDeLaCronica());
    await tocar(boton("Ocultar"));
    act(() => raiz.unmount());
    await montar();
    await irA(contenedor, "Informe");
    await tocar(contenedor.querySelector(".reporte-opcion"));
    await tocar(siguiente());
    expect(sumaDeLaCronica()).toBeDefined();
  });

  test("Informe › Por tarea: comparaciones que se suman (hasta 5), cada una con sus filtros; arriba el promedio y, de cada una, su fila y una por microciclo", async () => {
    // Tareas inventadas del promedio del equipo (Parcial): en el 17 y el 18, dos tipos de sesión; en el 10, con Sport.
    const lista = [];
    const agregar = (fecha, valores) =>
      lista.push(fila(`r${lista.length + 1}`, lista.length + 1, { promedio: "parcial" }, fecha, { dispositivo: "catapult", condicion: "parcial", tipo_microciclo: "competitivo", clasificacion_dias: "mas1_m", tiempo: 1200, ua: 100, ...valores }));
    agregar("2026-03-02", { microciclo: 10, tipo_sesion: "din_compleja", d: 1000, dispositivo: "sport" });
    agregar("2026-05-04", { microciclo: 17, tipo_sesion: "din_compleja", d: 2000 });
    agregar("2026-05-04", { microciclo: 17, tipo_sesion: "din_colectiva", d: 3000 });
    agregar("2026-05-11", { microciclo: 18, tipo_sesion: "din_compleja", d: 4000 });
    agregar("2026-05-11", { microciclo: 18, tipo_sesion: "din_colectiva", d: 5000 });
    datos.filas = lista;
    datos.referencias = [
      { id: "c1", dispositivo: "catapult", tipo: "FUTBOL", tabla: "Oficial", grupo: "TOTAL", orden: 1, promedio: { d: 4000, tiempo: 1200 }, desvio: { d: 500 }, dePartido: false },
      { id: "s1", dispositivo: "sport", tipo: "FUTBOL", tabla: "FUTBOL 2", grupo: "TOTAL", orden: 2, promedio: { d: 1000 }, desvio: {}, dePartido: false },
    ];
    await montar();
    await irA(contenedor, "Informe");
    await tocar(contenedor.querySelectorAll(".reporte-opcion")[1]);
    expect(contenedor.querySelector("h1").textContent).toBe("Por tarea");
    // Una comparación, sin filtros (como quedó guardado el archivo), con sus cinco filtros.
    const tarjetas = () => [...contenedor.querySelectorAll(".gps-tarea-comparacion")];
    expect(tarjetas()).toHaveLength(1);
    expect([...tarjetas()[0].querySelectorAll(".gps-reportes-rotulo")].map((span) => span.textContent)).toEqual(["Tipo de Sesión", "Microciclo", "Fecha", "Nombre", "Condicion"]);
    expect(tarjetas()[0].textContent).toContain("3 microciclos");
    // A: Dinámica compleja; B (con «+ Otra comparación»): Dinámica colectiva.
    const textoDe = (valor) => [...document.body.querySelectorAll(".tabla-datos-valores label")].map((label) => label.textContent).find((texto) => texto.toLowerCase().includes(valor));
    await tocar(botones().find((b) => b.getAttribute("aria-label") === "Comparación A · Tipo de Sesión"));
    const compleja = textoDe("compleja");
    await tocar(boton("Cancelar"));
    await elegirEnLaLista("Comparación A · Tipo de Sesión", [compleja]);
    await tocar(boton("+ Otra comparación"));
    expect(tarjetas()).toHaveLength(2);
    await tocar(botones().find((b) => b.getAttribute("aria-label") === "Comparación B · Tipo de Sesión"));
    const colectiva = textoDe("colectiva");
    await tocar(boton("Cancelar"));
    await elegirEnLaLista("Comparación B · Tipo de Sesión", [colectiva]);
    expect(tarjetas().map((tarjeta) => tarjeta.querySelector(".gps-tarea-comparacion-titulo").textContent)).toEqual(["Comparación A3 microciclos", "Comparación B2 microciclos"]);
    expect(contenedor.querySelector(".gps-reportes-siguiente").textContent).toContain("las comparaciones tienen 5 microciclos");
    // Hasta 5.
    await tocar(boton("+ Otra comparación"));
    await tocar(boton("+ Otra comparación"));
    await tocar(boton("+ Otra comparación"));
    expect(tarjetas()).toHaveLength(5);
    expect(boton("Hasta 5 comparaciones").disabled).toBe(true);
    for (const letra of ["E", "D", "C"]) {
      // eslint-disable-next-line no-await-in-loop
      await tocar(botones().find((b) => b.getAttribute("aria-label") === `Quitar la comparación ${letra}`));
    }
    expect(tarjetas()).toHaveLength(2);

    // El informe: no se pinta (Santiago, 16/10: «por tarea no se pinta con nada»): sin
    // Categorización ni «Franjas»; arriba el promedio de A y B; de cada una, su fila y la de cada microciclo.
    await tocar(siguiente());
    expect(contenedor.querySelector("h1").textContent).toBe("Por tarea");
    expect([...contenedor.querySelectorAll(".gps-reportes-grilla .gps-reportes-rotulo")].map((span) => span.textContent)).toEqual(["Tipo de variable", "Visualización"]);
    expect(contenedor.querySelector(".gps-informe-franjas-boton")).toBeNull();
    expect([...contenedor.querySelectorAll(".gps-informe-ver")].map((b) => b.textContent)).toEqual(["ColumnasTodas"]);
    expect(contenedor.querySelector(".gps-informe-titulo").textContent).toBe("Comparaciones2 comparaciones · 5 microciclos");
    // Arriba, solo la fila del V.R.
    expect([...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-franjas th")].map((th) => th.textContent)).toEqual(["V.R."]);
    expect(contenedor.querySelector(".gps-informe-tabla thead th").textContent).toBe("Comparación / Microciclo");
    const filasDelInforme = () => [...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-filas tr")];
    expect(filasDelInforme().map((tr) => tr.querySelector("th").textContent)).toEqual(["Promedio", `A${compleja}`, "10", "17", "18", `B${colectiva}`, "17", "18"]);
    // D (la primera variable): A promedia el 10, el 17 y el 18 (los elegidos, también los de antes del 17); B, el 17 y el 18; arriba, el promedio de A y B.
    // (La primera «D» es la del índice Total; la de la variable, la segunda.)
    const cabeceras = [...contenedor.querySelectorAll(".gps-informe-tabla thead .gps-informe-cabecera")].map((b) => b.textContent);
    const columnaDeD = cabeceras.indexOf("D", cabeceras.indexOf("D") + 1);
    const deD = () => filasDelInforme().map((tr) => tr.querySelectorAll("td")[columnaDeD]?.textContent);
    expect(deD()).toEqual(["3166,7", "2333,3", "1000,0", "2000,0", "4000,0", "4000,0", "3000,0", "5000,0"]);
    // N° Micr. y N° Ses.: en la fila de cada comparación; en la de cada microciclo, sus sesiones.
    expect(filasDelInforme().map((tr) => [tr.querySelectorAll("td")[0].textContent, tr.querySelectorAll("td")[1].textContent])).toEqual([
      ["–", "–"],
      ["3", "3"],
      ["–", "1"],
      ["–", "1"],
      ["–", "1"],
      ["2", "2"],
      ["–", "1"],
      ["–", "1"],
    ]);
    // Nada pintado.
    expect(contenedor.querySelectorAll(".gps-informe-tabla td.pintada")).toHaveLength(0);
    // % del promedio: cada microciclo contra el V.R. de su dispositivo; el 10, sin V.R. hasta sumar el de Sport.
    await elegir(contenedor.querySelectorAll(".gps-reportes-grilla select")[1], "porcentajePromedio");
    expect(deD()).toEqual(["88%", "75%", "–", "50%", "100%", "100%", "75%", "125%"]);
    expect(contenedor.querySelector(".gps-reportes-sin-vr").textContent).toContain("10");
    await tocar(boton("+ Otro V.R."));
    expect(deD()).toEqual(["92%", "83%", "100%", "50%", "100%", "100%", "75%", "125%"]);
    // «Filtros» adentro: las mismas tarjetas, sin salir del informe.
    await tocar(contenedor.querySelector(".gps-informe-filtros-boton"));
    expect(tarjetas()).toHaveLength(2);
    await tocar(botones().find((b) => b.getAttribute("aria-label") === "Quitar la comparación B"));
    expect(filasDelInforme().map((tr) => tr.querySelector("th").textContent)).toEqual([`A${compleja}`, "10", "17", "18"]);
    await tocar(boton("Limpiar filtros"));
    expect(filasDelInforme().map((tr) => tr.querySelector("th").textContent)).toEqual(["ATodas las tareas", "10", "17", "18"]);
    // «‹ Informe» vuelve a «Ver informes».
    await tocar(contenedor.querySelector(".reporte-volver"));
    expect(contenedor.querySelectorAll(".reporte-opcion")).toHaveLength(5);
  });

  test("Informe › Por jugador: una comparación por jugador, con su fila, sus franjas y una fila por microciclo; se pinta según la categorización", async () => {
    // Inventados: en el 17, el 18 y el 19, el promedio del equipo de la sesión, ALFA (3000, 4000 y 5000) y BETA (siempre 5000).
    const lista = [];
    const agregar = (fecha, quien, valores) =>
      lista.push(fila(`r${lista.length + 1}`, lista.length + 1, quien, fecha, { dispositivo: "catapult", tipo_microciclo: "competitivo", condicion: "total", clasificacion_dias: "mas1_m", tipo_sesion: "din_compleja", tiempo: 3600, ...valores }));
    [17, 18, 19].forEach((m, i) => {
      const dia = `2026-05-${String(4 + i * 7).padStart(2, "0")}`;
      agregar(dia, { promedio: "sesion" }, { microciclo: m, d: 4000, ua: 200 });
      agregar(dia, { jugador_id: 1 }, { microciclo: m, d: 3000 + 1000 * i, ua: 100 * (i + 1) });
      agregar(dia, { jugador_id: 2 }, { microciclo: m, d: 5000, ua: 300 });
    });
    datos.filas = lista;
    datos.plantel = PLANTEL.map((jugador) => ({ ...jugador }));
    datos.referencias = [{ id: "c1", dispositivo: "catapult", tipo: "FUTBOL", tabla: "Oficial", grupo: "TOTAL", orden: 1, promedio: { d: 4000, tiempo: 3600 }, desvio: { d: 500 }, dePartido: false }];
    await montar();
    await irA(contenedor, "Informe");
    await tocar(contenedor.querySelectorAll(".reporte-opcion")[2]);
    expect(contenedor.querySelector("h1").textContent).toBe("Por jugador");
    // Una comparación con sus seis filtros; de entrada, Condición «Total».
    const tarjetas = () => [...contenedor.querySelectorAll(".gps-tarea-comparacion")];
    expect(tarjetas()).toHaveLength(1);
    expect([...tarjetas()[0].querySelectorAll(".gps-reportes-rotulo")]).toHaveLength(6);
    expect(tarjetas()[0].querySelectorAll(".gps-reportes-rotulo")[0].textContent).toBe("Nombre");
    // A: ALFA; B (con «+ Otra comparación»): BETA.
    const textoDe = (valor) => [...document.body.querySelectorAll(".tabla-datos-valores label")].map((label) => label.textContent).find((texto) => texto.toLowerCase().includes(valor));
    await tocar(botones().find((b) => b.getAttribute("aria-label") === "Comparación A · Nombre"));
    const alfa = textoDe("alfa");
    const beta = textoDe("beta");
    await tocar(boton("Cancelar"));
    await elegirEnLaLista("Comparación A · Nombre", [alfa]);
    await tocar(boton("+ Otra comparación"));
    await elegirEnLaLista("Comparación B · Nombre", [beta]);
    expect(tarjetas().map((tarjeta) => tarjeta.querySelector(".gps-tarea-comparacion-titulo").textContent)).toEqual(["Comparación A3 microciclos", "Comparación B3 microciclos"]);

    // El informe: de cada comparación, su fila (letra y jugador), sus franjas (Mi selección) y sus microciclos.
    await tocar(siguiente());
    expect(contenedor.querySelector("h1").textContent).toBe("Por jugador");
    const categorizacion = () => contenedor.querySelectorAll(".gps-reportes-grilla select")[2];
    expect([...categorizacion().options].map((opcion) => opcion.textContent)).toEqual(["Mi selección", "Valor referencial", "Objetivo sesión/microciclo"]);
    expect(contenedor.querySelector(".gps-informe-titulo").textContent).toBe("Franjas de Mi selección2 comparaciones · 6 microciclos");
    expect(contenedor.querySelector(".gps-informe-tabla thead th").textContent).toBe("Comparación / Microciclo");
    const filasDelInforme = () => [...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-filas tr")];
    expect(filasDelInforme().map((tr) => tr.querySelector("th").textContent)).toEqual([`A${alfa}`, "17", "18", "19", `B${beta}`, "17", "18", "19"]);
    // Arriba, el V.R. y unas solas franjas de todo (Santiago, 16/10: «Unas solas para todo»).
    const FRANJAS = ["Excelente", "Muy bueno", "Bueno (promedio)", "Regular", "Malo", "Desvío"];
    const arriba = () => [...contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-franjas th")].map((th) => th.textContent);
    expect(arriba()).toEqual(["V.R.", ...FRANJAS]);
    // D (la primera variable): la fila de cada comparación, el promedio de sus microciclos.
    const cabeceras = [...contenedor.querySelectorAll(".gps-informe-tabla thead .gps-informe-cabecera")].map((b) => b.textContent);
    const columnaDeD = cabeceras.indexOf("D", cabeceras.indexOf("D") + 1);
    const deD = () => filasDelInforme().map((tr) => tr.querySelectorAll("td")[columnaDeD]?.textContent);
    expect(deD()).toEqual(["4000,0", "3000,0", "4000,0", "5000,0", "5000,0", "5000,0", "5000,0", "5000,0"]);
    // El Bueno de D: el promedio de los seis microciclos de las dos comparaciones.
    const franjaDeD = (indice) => contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-franjas tr")[indice].querySelectorAll("td")[columnaDeD].textContent;
    expect(franjaDeD(3)).toBe("4500,0");
    const pintadaEnD = (indice) => filasDelInforme()[indice].querySelectorAll("td")[columnaDeD].classList.contains("pintada");
    expect([1, 3, 5].map(pintadaEnD)).toEqual([true, true, true]);
    // «Franjas» las oculta (el V.R. queda) y las vuelve a mostrar.
    await tocar(contenedor.querySelector(".gps-informe-franjas-boton"));
    expect(arriba()).toEqual(["V.R."]);
    await tocar(contenedor.querySelector(".gps-informe-franjas-boton"));
    expect(arriba()).toEqual(["V.R.", ...FRANJAS]);
    // Valor referencial: arriba, las del V.R.
    await elegir(categorizacion(), "valorReferencial");
    expect(arriba()).toEqual(["V.R.", ...FRANJAS]);
    // Objetivo: cada microciclo con el del equipo; sin franjas para mostrar ni su botón.
    await elegir(categorizacion(), "objetivo");
    expect(contenedor.querySelector(".gps-informe-franjas-boton")).toBeNull();
    expect(arriba()).toEqual(["V.R."]);
    expect(contenedor.querySelectorAll(".gps-informe-tabla tbody.gps-informe-filas td.pintada").length).toBeGreaterThan(0);
    // Sin jugador elegido, Objetivo no está y vuelve a Mi selección.
    await tocar(contenedor.querySelector(".gps-informe-filtros-boton"));
    await tocar(boton("Limpiar filtros"));
    expect([...categorizacion().options].map((opcion) => opcion.value)).toEqual(["miSeleccion", "valorReferencial"]);
    expect(categorizacion().value).toBe("miSeleccion");
    expect(filasDelInforme()[0].querySelector("th").textContent).toBe("ATodos los nombres");
  });

  test("Informe › Reporte individual: el jugador y los filtros; sus últimos 10 y los del equipo, en totales y por minuto, pintados", async () => {
    // Inventados: 12 días con el promedio del equipo de la sesión, ALFA y BETA.
    const lista = [];
    const agregar = (fecha, quien, valores) =>
      lista.push(fila(`r${lista.length + 1}`, lista.length + 1, quien, fecha, { dispositivo: "catapult", tipo_microciclo: "competitivo", condicion: "total", clasificacion_dias: "mas1_m", tipo_sesion: "din_compleja", tiempo: 3600, ...valores }));
    for (let n = 1; n <= 12; n += 1) {
      const dia = `2026-05-${String(n).padStart(2, "0")}`;
      agregar(dia, { promedio: "sesion" }, { microciclo: 17, d: 1000 * n, d_min: (1000 * n) / 60, pse: 5, ua: 300 });
      agregar(dia, { jugador_id: 1 }, { microciclo: 17, d: 1000 * n - 200, d_min: (1000 * n - 200) / 60, pse: 6, ua: 360, va: "si", descripcion: `Sesión ${n}` });
      agregar(dia, { jugador_id: 2 }, { microciclo: 17, d: 1000 * n + 200, d_min: (1000 * n + 200) / 60, pse: 4, ua: 240, va: "si" });
    }
    datos.filas = lista;
    datos.plantel = PLANTEL.map((jugador) => ({ ...jugador }));
    await montar();
    await irA(contenedor, "Informe");
    await tocar(contenedor.querySelectorAll(".reporte-opcion")[3]);
    expect(contenedor.querySelector("h1").textContent).toBe("Reporte individual");
    // Sin jugador no se sigue.
    expect(siguiente().disabled).toBe(true);
    expect([...contenedor.querySelectorAll(".gps-reportes-rotulo")].map((span) => span.textContent)).toEqual(["Jugador", "Tipo de Sesión", "Fecha", "Microciclo"]);
    const jugadores = contenedor.querySelector(".gps-reportes-grilla select");
    const alfa = [...jugadores.options].find((opcion) => opcion.textContent.toLowerCase().includes("alfa"));
    await elegir(jugadores, alfa.value);
    expect(contenedor.querySelector(".gps-reportes-siguiente").textContent).toContain("12 entrenamientos; se ven los últimos 10");
    // «Siguiente», arriba al lado de Volver (fija al bajar).
    expect(siguiente().closest(".reporte-acciones")).not.toBeNull();
    expect(siguiente().disabled).toBe(false);
    await tocar(siguiente());
    expect(contenedor.querySelector("h1").textContent).toBe("Reporte individual");
    expect(contenedor.querySelector(".gps-reporte-cabeza h2").textContent).toBe(`Reporte de GPS – ${alfa.textContent}`);
    // Cuatro tablas: Por jugador y Por equipo, en Totales y Por minuto.
    const secciones = [...contenedor.querySelectorAll(".gps-reporte-seccion")];
    expect(secciones.map((seccion) => seccion.querySelector(".gps-informe-titulo b").textContent)).toEqual(["Por jugador", "Por equipo"]);
    const tablas = [...contenedor.querySelectorAll(".gps-reporte-tabla")];
    expect(tablas).toHaveLength(4);
    const filasDe = (tabla) => [...tabla.querySelectorAll("tbody:not(.gps-reporte-pie) tr")];
    const pieDe = (tabla) => [...tabla.querySelectorAll("tbody.gps-reporte-pie th")].map((th) => th.textContent);
    expect(filasDe(tablas[0])).toHaveLength(10);
    expect(pieDe(tablas[0])).toEqual(["Promedio", "Suma"]);
    expect(pieDe(tablas[1])).toEqual(["Promedio"]);
    expect(pieDe(tablas[2])).toEqual(["Promedio", "Desv. est.", "Suma"]);
    expect(pieDe(tablas[3])).toEqual(["Promedio", "Desv. est."]);
    // D: la segunda columna; el último día, primero.
    const cabeceras = [...tablas[0].querySelectorAll("thead th")].map((th) => th.textContent);
    expect(cabeceras.slice(0, 3)).toEqual(["Fecha", "Tiempo", "D"]);
    expect(cabeceras.at(-1)).toBe("Descripción");
    const deD = (tabla) => filasDe(tabla).map((tr) => tr.querySelectorAll("td")[1].textContent);
    expect(deD(tablas[0])[0]).toContain("11800");
    expect(deD(tablas[2])[0]).toContain("12000");
    // Pintadas: las del jugador contra el equipo ese día; las del equipo, contra su tabla.
    expect(tablas[0].querySelectorAll("td.pintada").length).toBeGreaterThan(0);
    expect(tablas[2].querySelectorAll("td.pintada").length).toBeGreaterThan(0);
    // Qué es cada variable, abajo.
    expect(contenedor.querySelector(".gps-reporte-variables").textContent).toContain("Metros totales acumulados");
    // Ocultar una columna, preguntando: deja de verse en las cuatro tablas.
    await tocar([...tablas[0].querySelectorAll("thead .gps-informe-cabecera")].find((b) => b.textContent === "D"));
    await tocar(boton("Ocultar"));
    expect([...contenedor.querySelectorAll(".gps-reporte-tabla")][2].querySelectorAll("thead th")[2].textContent).not.toBe("D");
    expect(contenedor.querySelector(".gps-informe-ver").textContent).toContain("1 oculta");
    // «‹ Informe» vuelve a «Ver informes».
    await tocar(contenedor.querySelector(".reporte-volver"));
    expect(contenedor.querySelectorAll(".reporte-opcion")).toHaveLength(5);
  });

  test("Informe › Reporte grupal: período, grupo y sesiones; las 10 casillas; los jugadores con las tres categorizaciones", async () => {
    // Inventados: 12 días con el promedio del equipo de la sesión, ALFA y
    // BETA, y un descanso (sin tiempo: no cuenta).
    const lista = [];
    const agregar = (fecha, quien, valores) =>
      lista.push(fila(`g${lista.length + 1}`, lista.length + 1, quien, fecha, { dispositivo: "catapult", tipo_microciclo: "competitivo", condicion: "total", clasificacion_dias: "mas1_m", tipo_sesion: "din_compleja", microciclo: 17, tiempo: 3600, ...valores }));
    for (let n = 1; n <= 12; n += 1) {
      const dia = `2026-05-${String(n).padStart(2, "0")}`;
      agregar(dia, { promedio: "sesion" }, { d: 1000 * n, ua: 300 });
      agregar(dia, { jugador_id: 1 }, { d: 1000 * n - 200, ua: 360, va: "si" });
      agregar(dia, { jugador_id: 2 }, { d: 1000 * n + 200, ua: 240, va: "si" });
    }
    agregar("2026-05-13", { promedio: "sesion" }, { tipo_sesion: "descanso", d: 0, tiempo: 0, ua: 0 });
    datos.filas = lista;
    datos.plantel = PLANTEL.map((jugador) => ({ ...jugador }));
    datos.referencias = [{ id: "c1", dispositivo: "catapult", tipo: "FUTBOL", tabla: "Oficial", grupo: "TOTAL", orden: 1, promedio: { d: 5000, tiempo: 3600 }, desvio: { d: 500 }, dePartido: false }];
    await montar();
    await irA(contenedor, "Informe");
    await tocar(contenedor.querySelectorAll(".reporte-opcion")[4]);
    expect(contenedor.querySelector("h1").textContent).toBe("Reporte grupal");
    expect([...contenedor.querySelectorAll(".gps-reportes-rotulo")].map((span) => span.textContent)).toEqual(["Tipo de Sesión", "Fecha", "Microciclo"]);
    expect(contenedor.querySelector(".gps-reportes-siguiente").textContent).toContain("12 sesiones con GPS");
    // «Siguiente», arriba al lado de Volver (fija al bajar).
    expect(siguiente().closest(".reporte-acciones")).not.toBeNull();
    await tocar(siguiente());
    expect(contenedor.querySelector(".gps-grupal-cabeza h2").textContent).toBe("Reporte grupal de GPS");
    const datosDeArriba = [...contenedor.querySelectorAll(".gps-grupal-dato")].map((dato) => dato.textContent);
    expect(datosDeArriba[0]).toContain("Período");
    expect(datosDeArriba[0]).toContain("12/05/2026");
    expect(datosDeArriba[1]).toContain("Todo el plantel");
    expect(datosDeArriba[2]).toBe("Sesiones12");
    // Las 10 casillas: las 9 medidas y la U.A.; D primero, con el promedio
    // por sesión del equipo (6500) y el total (78000).
    const casillas = [...contenedor.querySelectorAll(".gps-grupal-casilla")];
    expect(casillas).toHaveLength(10);
    expect(casillas[0].querySelector(".gps-grupal-casilla-nombre").textContent).toBe("D");
    expect(casillas[0].querySelector(".gps-grupal-casilla-valor").textContent).toContain("6500");
    expect(casillas[0].querySelector(".gps-grupal-casilla-total").textContent).toContain("78000");
    // Los jugadores: los dos, con sus 12 sesiones, y las franjas arriba.
    const tabla = () => contenedor.querySelector(".gps-grupal-tabla");
    const jugadores = () => [...tabla().querySelectorAll("tbody.gps-informe-filas tr")];
    expect(jugadores()).toHaveLength(2);
    expect(jugadores()[0].querySelectorAll("td")[0].textContent).toBe("12");
    const franjas = () => [...tabla().querySelectorAll("tbody.gps-informe-franjas th")].map((th) => th.textContent);
    expect(franjas()).toEqual(["Excelente", "Muy bueno", "Bueno (promedio)", "Regular", "Malo", "Desvío"]);
    expect(tabla().querySelectorAll("tbody.gps-informe-filas td.pintada").length).toBeGreaterThan(0);
    // Las tres categorizaciones del Informe; con «Valor referencial», la fila del V.R.
    const categorizacion = () => contenedor.querySelector(".gps-grupal-controles select");
    expect([...categorizacion().options].map((opcion) => opcion.textContent)).toEqual(["Mi selección", "Valor referencial", "Objetivo sesión/microciclo"]);
    await elegir(categorizacion(), "valorReferencial");
    expect(franjas()[0]).toBe("V.R.");
    expect(tabla().closest("section").querySelector(".gps-informe-titulo-texto span").textContent).toContain("Oficial");
    await elegir(categorizacion(), "objetivo");
    expect(franjas()).toEqual(["Excelente", "Muy bueno", "Bueno (promedio)", "Regular", "Malo", "Desvío"]);
    expect(tabla().querySelectorAll("tbody.gps-informe-filas td.pintada").length).toBeGreaterThan(0);
    // «Franjas» las oculta.
    await tocar(contenedor.querySelector(".gps-informe-franjas-boton"));
    expect(franjas()).toEqual([]);
  });

  test("Cargar: el % vs V.R. de partido es el del dispositivo elegido al subir el CSV", async () => {
    datos.referencias = [...dePartido({ d_min: 100 }), { id: "s1", dispositivo: "sport", tipo: "FUTBOL", tabla: "FUTBOL 2", grupo: "TOTAL", orden: 2, promedio: { d_min: 200 }, desvio: {}, dePartido: false }];
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER), { dispositivo: "Sport" });
    await esperar(() => contenedor.textContent.includes("No está en la Base"));
    await guardarIgual();
    await tocar(siguiente());
    // Sport no tiene uno de partido: lo dice y dónde se marca.
    expect(contenedor.textContent).toContain("Sport no tiene V.R. de partido: marcá uno en Valores de referencia");
    expect(vs()).toBeUndefined();
    act(() => raiz.unmount());
    // Con Catapult, el suyo (8700 m en 60 min = 145 por minuto, contra 100).
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await esperar(() => contenedor.textContent.includes("No está en la Base"));
    await guardarIgual();
    await tocar(siguiente());
    expect(vs()).toContain("D/min145 %");
  });

  // ------------------------------------------- Textos que guían (14/10) --
  // Santiago, 14/10: «pensa como si lo fuese a usar por primera ves y
  // necesitas una guia exacta de lo que se necesita para saber que hacer y
  // donde estas parado».
  const hoja = () => document.body.querySelector(".hoja-guia");
  const botonPorNombre = (nombre) => botones().find((b) => b.getAttribute("aria-label") === nombre);

  test("la primera vez en el aparato se ofrece la guía una sola vez; «Ahora no» no la vuelve a ofrecer", async () => {
    localStorage.removeItem("guia_vista:gps");
    await montar();
    expect(hoja().textContent).toContain("¿Primera vez en GPS?");
    await tocar(boton("Ahora no"));
    expect(hoja()).toBeNull();
    expect(localStorage.getItem("guia_vista:gps")).toBe("1");
    act(() => raiz.unmount());
    await montar();
    expect(hoja()).toBeNull();
  });

  test("«Ver cómo se usa» abre la guía: qué se hace, los pasos numerados y las palabras propias", async () => {
    localStorage.removeItem("guia_vista:gps");
    await montar();
    await tocar(boton("Ver cómo se usa"));
    expect(hoja().querySelector("h3").textContent).toBe("Cómo se usa GPS");
    expect([...hoja().querySelectorAll(".guia-seccion h4")].map((h) => h.textContent)).toEqual(["Cargar un día", "Ver y corregir lo cargado", "Informe", "Valores de referencia", "Traer lo que ya tenías", "Ajustes", "Palabras que vas a ver"]);
    // Cargar un día: cuatro pasos, cada uno con lo que hay que hacer.
    expect(hoja().querySelectorAll(".guia-seccion")[0].querySelectorAll("li")).toHaveLength(4);
    expect([...hoja().querySelectorAll("dt")].map((dt) => dt.textContent)).toContain("Team Average");
    await tocar(boton("Entendido"));
    expect(hoja()).toBeNull();
    expect(localStorage.getItem("guia_vista:gps")).toBe("1");
  });

  test("el «?» de arriba abre la guía en cada pantalla de GPS", async () => {
    await montar();
    // Cargar.
    await tocar(botonPorNombre("Cómo se usa"));
    expect(hoja().querySelector("h3").textContent).toBe("Cómo se usa GPS");
    await tocar(boton("Entendido"));
    // Base, Pegar desde una planilla y Ajustes.
    await irA(contenedor, "Base");
    await tocar(botonPorNombre("Cómo se usa"));
    expect(hoja()).not.toBeNull();
    await tocar(boton("Entendido"));
    await tocar(boton("Pegar desde una planilla"));
    await tocar(botonPorNombre("Cómo se usa"));
    expect(hoja()).not.toBeNull();
    await tocar(boton("Entendido"));
    await irA(contenedor, "Ajustes");
    await tocar(botonPorNombre("Cómo se usa"));
    expect(hoja()).not.toBeNull();
    await tocar(boton("Entendido"));
    // Cargar un día.
    await irA(contenedor, "Cargar");
    await tocar(boton("Cargar un día"));
    await tocar(botonPorNombre("Cómo se usa"));
    expect(hoja()).not.toBeNull();
    await tocar(boton("Entendido"));
    expect(hoja()).toBeNull();
  });

  test("cada pantalla dice dónde estás y una palabra propia explica qué es con su «?»", async () => {
    datos.plantel = CON_DELTA_Y_EPSILON();
    await montar();
    expect(contenedor.querySelector(".pantalla-donde").textContent).toContain("Acá cargás lo que midió el GPS");
    await irA(contenedor, "Base");
    expect(contenedor.querySelector(".pantalla-donde").textContent).toContain("Todas las filas del GPS del club");
    await irA(contenedor, "Cargar");
    await tocar(boton("Cargar un día"));
    // El paso del archivo: qué hacer, en pasos numerados.
    expect([...contenedor.querySelectorAll(".lesiones-paso-titulo .texto-guia li")].map((li) => li.textContent)[0]).toBe("En OpenField, abrí la actividad del día.");
    await pegarCsv(CSV_TAREAS(AYER));
    await tocar(botonPorNombre("Qué es «Microciclo»"));
    expect(hoja().querySelector("h3").textContent).toBe("Microciclo");
    expect(hoja().textContent).toContain("La semana de entrenamiento");
    await tocar(boton("Entendido"));
    expect(hoja()).toBeNull();
  });

  test("ninguna pantalla de GPS nombra una planilla, una hoja ni lo técnico de la base", async () => {
    const prohibido = /\bExcel\b|plantilla|BD_GPS|\bhoja\b|solapa|SQL|Supabase/i;
    const revisar = (donde) => expect(document.body.textContent, donde).not.toMatch(prohibido);
    await montar();
    revisar("Cargar");
    await tocar(botonPorNombre("Cómo se usa"));
    revisar("la guía");
    await tocar(boton("Entendido"));
    await tocar(boton("Cargar un día"));
    revisar("el paso del archivo");
    await irA(contenedor, "Base");
    revisar("Base");
    await tocar(boton("Pegar desde una planilla"));
    revisar("Pegar desde una planilla");
    await irA(contenedor, "Valores de referencia");
    revisar("Valores de referencia");
    await irA(contenedor, "Informe");
    revisar("Informe");
    await tocar(document.body.querySelector(".reporte-opcion"));
    revisar("Por microciclo › Filtros");
    await tocar(siguiente());
    revisar("Por microciclo › el informe");
    await irA(contenedor, "Ajustes");
    revisar("Ajustes");
    await tocar(ajuste("Reglas de carga"));
    revisar("Reglas de carga");
    for (const regla of ["Inicio del microciclo 1", "Va tarea", "Lo que se ve en los bloques del partido", "Sesión de la tarde"]) {
      await tocar(ajuste(regla));
      revisar(regla);
      await tocar(boton("Cancelar"));
    }
  });
});
