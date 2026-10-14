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
  plantel: [],
  reglas: {},
  faltanReglas: false,
  reglasGuardadas: [],
  partidos: [],
  // Las cargas sin terminar: las filas (con lo hecho) y lo que pidió la app.
  enCurso: [],
  dejadas: [],
  // La copia del GPS en el aparato (null: no hay) y lo que se guardó en ella.
  copia: null,
  copiasGuardadas: [],
  // Las puestas al día pedidas (con la copia o después de cargar).
  alDia: [],
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
  leerAjustesGps: async () => ({ campos: [...datos.ajustes.campos], opciones: [...datos.ajustes.opciones], error: "" }),
  guardarCabeceraGps: async (equipoId, campo, { etiquetas = {}, oculto = false, orden = 0, tipo = null }) => {
    datos.cabeceras.push({ equipoId, campo, etiquetas, oculto, orden, tipo });
    datos.ajustes.campos = [
      ...datos.ajustes.campos.filter((fila) => fila.campo !== campo),
      { campo, etiqueta_es: etiquetas["es-AR"] || "", etiqueta_pt: etiquetas["pt-BR"] || "", oculto, orden, tipo },
    ];
    return { error: "" };
  },
  leerReglasGps: async () => ({ reglas: { ...datos.reglas }, faltaTabla: datos.faltanReglas, error: "" }),
  partidoDelDia: async (equipoId, fecha) => datos.partidos.find((partido) => partido.fecha === fecha) || null,
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
    datos.opciones = [];
    datos.plantel = PLANTEL.map((jugador) => ({ ...jugador }));
    datos.reglas = {};
    datos.faltanReglas = false;
    datos.reglasGuardadas = [];
    datos.partidos = [];
    datos.enCurso = [];
    datos.dejadas = [];
    datos.copia = null;
    datos.copiasGuardadas = [];
    datos.alDia = [];
    datos.errorHistorial = "";
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

    // El informe, con lo que se ve: promedio 4500 y desvío 500.
    expect(filasDeArriba(contenedor).map((tr) => tr.querySelector("th").textContent)).toEqual(["Excelente", "Muy Bueno", "Promedio/Bueno", "Regular", "Malo", "Desvío", "n", "Máx.", "Mín."]);
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Excelente"), "D").textContent).toBe("5500,0");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Promedio/Bueno"), "D").textContent).toBe("4500,0");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "n"), "D").textContent).toBe("3");
    // Por minuto: el promedio de D ÷ el de los minutos (50).
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Promedio/Bueno"), "D/min").textContent).toBe("90,0");
    // Una columna sin números queda vacía.
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Promedio/Bueno"), "HDOP").textContent).toBe("");

    // Los colores del Excel: verde claro, naranja y amarillo.
    expect(celda(contenedor, 1, "D").style.background).toBe("rgb(200, 231, 167)");
    expect(celda(contenedor, 0, "D").style.background).toBe("rgb(241, 181, 132)");
    expect(celda(contenedor, 2, "D").style.background).toBe("rgb(255, 255, 127)");
    // El promedio de un partido oficial, en gris en la columna Nombre.
    expect(celda(contenedor, 2, "Nombre").style.background).toBe("rgb(191, 191, 191)");

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
    expect(filasDeArriba(contenedor)).toHaveLength(18);
    expect(filasDeArriba(contenedor)[0].querySelector("th").textContent).toBe("CatapultExcelente");
    expect(filasDeArriba(contenedor)[9].querySelector("th").textContent).toBe("SportExcelente");
    // La de Sport es la única de su dispositivo: sin desvío, sin colores; las
    // de Catapult siguen como antes.
    const vieja = filas(contenedor).findIndex((tr) => tr.querySelectorAll("td")[columna(contenedor, "Nombre")].textContent === "GAMA");
    expect(celda(contenedor, vieja, "D").style.background).toBe("");
    expect(filas(contenedor)[vieja].className).toContain("apagada");
    const beta = filas(contenedor).findIndex((tr) => tr.querySelectorAll("td")[columna(contenedor, "Nombre")].textContent === "BETA");
    expect(celda(contenedor, beta, "D").style.background).toBe("rgb(200, 231, 167)");
    expect(datos.lecturas).toHaveLength(1);
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
    expect(celda(contenedor, 1, "Nombre").style.background).toBe("rgb(217, 150, 148)");
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
    expect(filasDeArriba(contenedor)).toHaveLength(18);

    // El embudo de Dispositivo: solo Catapult. Un informe, el de Catapult.
    await tocar(contenedor.querySelector('.tabla-datos-filtro[aria-label="Filtrar u ordenar Dispositivo"]'));
    const valores = () => [...document.body.querySelectorAll(".tabla-datos-valores label")];
    expect(valores().map((label) => label.textContent)).toEqual(["Catapult3", "Sport1"]);
    await tocar(boton("Ninguno"));
    await tocar(valores()[0].querySelector("input"));
    await tocar(boton("Aplicar"));
    expect(filas(contenedor)).toHaveLength(3);
    expect(filasDeArriba(contenedor)).toHaveLength(9);
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

  test("Pegar desde Excel: se resume lo pegado, se elige qué es cada nombre y se carga con el dispositivo", async () => {
    await montarEnLaBase();
    await tocar(boton("Pegar desde Excel"));
    expect(contenedor.textContent).toContain("15 decimales");
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
    expect(boton("Pegar desde Excel")).toBeUndefined();
    expect(boton("Borrar fila")).toBeUndefined();
    expect(filas(contenedor)).toHaveLength(3);
    await tocar(celda(contenedor, 0, "D"));
    await tocar(celda(contenedor, 0, "D"));
    expect(celda(contenedor, 0, "D").querySelector("input")).toBeNull();
  });

  test("sin la migración, avisa qué SQL falta", async () => {
    datos.errorAlLeer = "gps.error.faltaMigracion";
    await montarEnLaBase();
    expect(contenedor.textContent).toContain("falta correr el SQL 20261016_gps.sql");
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
  const pegarCsv = async (texto) => escribir(contenedor.querySelector(".datos-importar-pegado textarea"), texto);
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

  test("Cargar un día: el CSV, un paso por tarea con sus jugadores y todos sus datos, y la sesión al final", async () => {
    datos.plantel = CON_DELTA_Y_EPSILON();
    // Un V.R. de partido inventado: D/min 100.
    datos.reglas = { vrPartido: { d_min: 100 } };
    await montar();
    await tocar(boton("Cargar un día"));
    expect(titulo()).toBe("El CSV de Catapult");
    // Sin CSV no se sigue; lo que no es un CSV de Catapult no se suma.
    await tocar(boton("Siguiente"));
    expect(contenedor.textContent).toContain("Primero subí o pegá el CSV de Catapult.");
    await pegarCsv("hola");
    expect(contenedor.textContent).toContain("No encontré los títulos del CSV de Catapult");
    await pegarCsv(CSV_TAREAS(AYER));
    expect(contenedor.textContent).toContain("6 filas leídas");
    expect(contenedor.textContent).toContain("1. Rondo: 4 jugadores");
    expect(contenedor.textContent).toContain("2. Juego: 2 jugadores");
    expect(contenedor.textContent).toContain("El CSV no trae");
    // La fecha sale del CSV y se revisa si ya está en la Base: ese día hay
    // filas, pero de otra sesión.
    expect(contenedor.querySelector("input[type=date]").value).toBe(AYER);
    await esperar(() => contenedor.textContent.includes("No está en la Base: podés seguir."));
    expect(contenedor.textContent).toContain("Ese día ya hay 3 filas de otra sesión.");
    // A. Alfa es ALFA (su nombre en Catapult); Invitado X no está en Datos básicos.
    await tocar(boton("Siguiente"));
    expect(contenedor.textContent).toContain("Falta elegir qué hacer con 1 nombre que no está en Datos básicos.");
    await tocar(boton("Guardar igual el que no está en Datos básicos"));
    await tocar(boton("Siguiente"));

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
    await tocar(boton("Siguiente"));
    expect(titulo()).toBe("1. Rondo");
    expect(aviso()).toBe("Falta el tipo de sesión: 1. Rondo.");
    await elegirTipo();
    await tocar(boton("Siguiente"));

    expect(titulo()).toBe("2. Juego");
    expect(nombres()).toEqual(["ALFA", "BETA"]);
    await elegirTipo();
    await tocar(boton("Siguiente"));

    // EPSILON no está en el CSV: no entrenó (con su tipo de sesión).
    expect(titulo()).toBe("Regenerativo y no entrenaron");
    expect(contenedor.textContent).toContain("EPSILON");
    await escribir(contenedor.querySelector('input[aria-label="Motivo (por ejemplo, Lesionado)"]'), "Lesionado");
    await tocar(boton("Siguiente"));
    expect(aviso()).toBe("Falta el tipo de sesión de 1 que no entrenó.");
    await elegirTipo("Descanso");
    await tocar(boton("Siguiente"));

    // La sesión, al final: lo del día, su encabezado, qué tareas van en su
    // descripción y el «Va» de cada uno.
    expect(titulo()).toBe("La sesión");
    // Sin día, dispositivo y tipo de sesión no se sigue.
    await tocar(boton("Siguiente"));
    expect(aviso()).toBe("Falta el día del microciclo.");
    await elegirDelDesplegable("Tipo Microciclo", "Competitivo");
    await elegirDelDesplegable("Día del microciclo", "-1");
    await tocar(boton("Siguiente"));
    expect(aviso()).toBe("Falta el dispositivo.");
    await elegirDelDesplegable("Dispositivo", "Catapult");
    await tocar(boton("Siguiente"));
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
    await tocar(boton("Siguiente"));

    // Revisar: todo lo que va a la Base, en el orden de la plantilla.
    expect(titulo()).toBe("Revisar y guardar");
    expect(nombres()).toEqual(["Team Average Parcial", "ALFA", "BETA", "Invitado X", "DELTA", "ALFA", "BETA", "Team Average Sesion", "ALFA", "BETA", "EPSILON"]);
    await tocar(boton("Guardar 11 filas"));
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
    datos.reglas = { vrPartido: { d_min: 100 } };
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await esperar(() => contenedor.textContent.includes("No está en la Base: podés seguir."));
    await tocar(boton("Guardar igual el que no está en Datos básicos"));
    await tocar(boton("Siguiente"));
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
    await tocar(boton("Siguiente"));
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
    await tocar(boton("Siguiente"));
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
    await tocar(boton("Siguiente"));
    await elegirTipo("Descanso");
    await tocar(boton("Siguiente"));
    expect(titulo()).toBe("La sesión");
    await elegirDelDesplegable("Tipo Microciclo", "Competitivo");
    await elegirDelDesplegable("Día del microciclo", "-1");
    await elegirDelDesplegable("Dispositivo", "Catapult");
    await elegirTipo("Din. General");
    await tocar(boton("Siguiente"));
    expect(titulo()).toBe("Revisar y guardar");
    await tocar(boton("Guardar 11 filas"));
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
    await tocar(boton("Siguiente"));
    expect(titulo()).toBe("El CSV de Catapult");
    expect(aviso()).toContain(`Ya hay una carga en curso del ${fechaCorta(AYER)}`);
    expect(aviso()).toContain("Seguila desde «Sin terminar», en Cargar.");
    // Tampoco se deja otra de ese día para revisar.
    await tocar(boton("Dejar para revisar"));
    expect(datos.dejadas).toHaveLength(0);
    // Con otra fecha, sí se sigue.
    await escribir(contenedor.querySelector("input[type=date]"), diasAntes(2));
    await esperar(() => contenedor.textContent.includes("No está en la Base: podés seguir."));
    await tocar(boton("Siguiente"));
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
    await tocar(boton("Siguiente"));
    expect(titulo()).toBe("El CSV de Catapult");
    expect(contenedor.querySelector(".aviso-hoja").textContent).toContain("No se puede cargar de nuevo.");
    // Tampoco se deja para revisar: no se podría guardar.
    await tocar(boton("Dejar para revisar"));
    expect(datos.dejadas).toHaveLength(0);
    expect(contenedor.querySelector(".aviso-hoja").textContent).toContain("No se puede cargar de nuevo.");
    // Con otra fecha (otro día), no está.
    await escribir(contenedor.querySelector("input[type=date]"), diasAntes(2));
    await esperar(() => contenedor.textContent.includes("No está en la Base: podés seguir."));
    await tocar(boton("Siguiente"));
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
    await tocar(boton("Siguiente"));

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
    await tocar(boton("Siguiente"));

    expect(titulo()).toBe("Segundo tiempo");
    expect(nombres()).toEqual(["ALFA", "BETA"]);
    await elegirTipo();
    await tocar(boton("Siguiente"));

    // El partido completo: la suma de cada uno y los que no ingresaron, que
    // salen de Partido (en un desplegable con casillas, para cambiarlos).
    expect(titulo()).toBe("Partido completo");
    expect(contenedor.querySelector(".chip-criterio")).toBeNull();
    expect(contenedor.querySelector('[aria-label="Sin ingresar"]').textContent).toBe("DELTA");
    expect(contenedor.textContent).toContain("Salen de Partido");
    expect(nombres()).toEqual(["ALFA", "BETA", "DELTA"]);
    await elegirTipo();
    await tocar(boton("Siguiente"));
    expect(aviso()).toBe("Falta el tipo de sesión: Sin ingresar.");
    await elegirTipo("Descanso", "Sin ingresar: Tipo de Sesión");
    await tocar(boton("Siguiente"));
    expect(titulo()).toBe("Regenerativo y no entrenaron");
    await elegirTipo("Descanso");
    await tocar(boton("Siguiente"));
    expect(titulo()).toBe("La sesión");
    await elegirDelDesplegable("Día del microciclo", "0");
    await elegirDelDesplegable("Dispositivo", "Catapult");
    await elegirTipo();
    await tocar(boton("Siguiente"));
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
    datos.reglas = { vrPartido: { d_min: 200 } };
    await montar();
    await tocar(boton("Cargar un día"));
    await pegarCsv(CSV_TAREAS(AYER));
    await esperar(() => contenedor.textContent.includes("No está en la Base"));
    await guardarIgual();
    await tocar(boton("Siguiente"));
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
    await tocar(boton("Siguiente"));
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
    await tocar(boton("Siguiente"));
    expect(aviso()).toBe("ALFA está dos veces en 1. Rondo: cambiá uno de los nombres.");
    await elegirEnLaCelda(4, "Nombre", "DELTA");
    await tocar(boton("Siguiente"));

    expect(titulo()).toBe("2. Juego");
    expect(nombres()).toEqual(["ALFA", "BETA"]);
    // En algunas: se eligen en la lista.
    await elegirEnLaCelda(1, "Nombre", "EPSILON");
    await tocar(opcionDeHoja("Cambiar en algunas (elegís cuáles)"));
    expect(document.body.textContent).toContain("¿Dónde va EPSILON en lugar de BETA?");
    await tocar(boton("Listo"));
    expect(nombres()).toEqual(["ALFA", "EPSILON"]);
    await elegirTipo();
    await tocar(boton("Siguiente"));

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
    await tocar(boton("Siguiente"));
    await elegirTipo();
    await tocar(boton("Siguiente"));
    await elegirTipo();
    await tocar(boton("Siguiente"));
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
    await tocar(boton("Siguiente"));
    expect(nombres()).toEqual(["ALFA"]);
    await elegirTipo();
    await tocar(boton("Siguiente"));
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
    expect(document.body.textContent).toContain("En la plantilla: 75 %.");
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
    await tocar(boton("Siguiente"));
    expect(contenedor.textContent).toContain("hizo al menos el 80 % del tiempo promedio");
    await elegirTipo();
    await tocar(boton("Siguiente"));
    await elegirTipo();
    await tocar(boton("Siguiente"));
    await tocar(boton("Siguiente"));
    expect(contenedor.textContent).toContain("desde las 14:30, tarde");
  });

  test("Ajustes › Reglas de carga: los V.R. de partido, lo que se ve en el partido y los arqueros", async () => {
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar(ajuste("Reglas de carga"));
    expect(ajuste("V.R. de partido").textContent).toContain("Sin cargar");
    expect(ajuste("Lo que se ve en los bloques del partido").textContent).toContain("Se ve: Zona de Impacto, Pausa");
    expect(ajuste("Arqueros en la carga").textContent).toContain("Apagado");
    // Los V.R.: un número por medida (los vacíos no van).
    await tocar(ajuste("V.R. de partido"));
    const vr = (rotulo) => [...document.body.querySelectorAll(".gps-regla-vr label")].find((label) => label.querySelector("span").textContent === rotulo).querySelector("input");
    await escribir(vr("D/min"), "-3");
    await tocar(boton("Guardar"));
    expect(document.body.textContent).toContain("Escribí números mayores que 0");
    await escribir(vr("D/min"), "101,5");
    await escribir(vr("Mts >= 90% Pico/min"), "2");
    await tocar(boton("Guardar"));
    expect(datos.reglasGuardadas.at(-1).reglas).toEqual({ vrPartido: { d_min: 101.5, mts90_min: 2 } });
    expect(ajuste("V.R. de partido").textContent).toContain("2 de 10 cargados");
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
    expect(contenedor.textContent).toContain("falta correr el SQL 20261020_gps_reglas.sql");
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
  });
});
