import React from "react";
import { act } from "react";
import { pdfDePrueba } from "./domain/evaluaciones/pdfIsocineciaDePrueba.js";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Todo inventado: ningún nombre ni valor sale del Excel del club.
const datos = vi.hoisted(() => ({
  equipo: { id: "eq-1", nombre: "Club de Prueba" },
  evaluaciones: [],
  referencias: null,
  // Los V.R. que se pidió cambiar, el historial y si a la base le falta la
  // actualización para cambiarlos.
  cambiosVr: [],
  historialVr: [],
  faltaHistorial: false,
  errorAlLeer: "",
  creadas: [],
  // Si está, el guardado que sigue a esa cantidad de creadas falla.
  fallaAlCrear: null,
  // Guardar varias de una vez (20261113): lo que se pidió, si a la base le
  // falta esa actualización y si la próxima falla (todas o ninguna).
  deUnaVez: [],
  sinGuardarVarias: false,
  fallaAlGuardar: "",
  // Cambiar solo lo cambiado (20261114): lo que se pidió y si a la base le
  // falta esa actualización.
  cambiadas: [],
  sinCambiar: false,
  actualizadas: [],
  borradas: [],
  // Si está, cada guardado espera a que se abra (una conexión lenta).
  compuerta: null,
  // Si está, la próxima lectura falla (una recarga que no llega).
  fallaLaProxima: "",
  // Lo que el club cambió en Ajustes (las filas de la base).
  ajustes: { campos: [], opciones: [] },
  // Las categorías del club en Datos básicos (null: no se pudieron leer).
  categorias: null,
  cabeceras: [],
  opciones: [],
  referenciasCurl: null,
  referenciasIso: null,
  referenciasTobillo: null,
  referenciasAductor: null,
  referenciasSentadilla: null,
  referenciasPress: null,
  referenciasSaltos: null,
  referenciasSingleLeg: null,
}));

// Los V.R. de prueba, en la unidad del Excel (los tiempos, segundos ÷ 1440).
const s = (segundos) => segundos / 1440;
const REFERENCIAS = {
  categorias: {
    mayor: {
      titulo: "V.R. de prueba",
      rotulo: "Prueba",
      n: { lumbar: 10, lateral_d: 10, lateral_i: 10, def_lat: 10, prono: 10, ratio: 10 },
      excelente: { lumbar: s(240), lateral_d: s(120), lateral_i: s(120), def_lat: 2, prono: s(180), ratio: 0.9 },
      muy_bueno: { lumbar: s(210), lateral_d: s(100), lateral_i: s(100), def_lat: 5, prono: s(150), ratio: 0.8 },
      bueno: { lumbar: s(180), lateral_d: s(80), lateral_i: s(80), def_lat: 10, prono: s(120), ratio: 0.7 },
      regular: { lumbar: s(150), lateral_d: s(60), lateral_i: s(60), def_lat: 15, prono: s(90), ratio: 0.6 },
      malo: { lumbar: s(120), lateral_d: s(40), lateral_i: s(40), def_lat: 20, prono: s(60), ratio: 0.5 },
    },
  },
  resumen: { n: { mayor: 12 } },
};

const evaluacion = (id, orden, jugador_id, fecha, tiempos, extra = {}) => ({
  id,
  equipo_id: "eq-1",
  test: "zona_media",
  orden,
  jugador_id,
  persona: null,
  fecha,
  datos: { seleccion: "mayor", ...tiempos },
  ...extra,
});

const EVALUACIONES = () => [
  evaluacion("e1", 1, 1, "2026-06-01", { lumbar: 240, lateral_d: 100, lateral_i: 80, prono: 130 }),
  evaluacion("e2", 2, 2, "2026-06-01", { lumbar: 150 }),
  evaluacion("e3", 3, 1, "2026-07-01", { lumbar: 252 }),
];

// La copia para ver sin señal (copiaSinSenal.js), en memoria: en las
// pruebas no hay IndexedDB.
const copias = vi.hoisted(() => ({ guardadas: {} }));
vi.mock("./domain/copiaSinSenal.js", () => {
  const clave = (modulo, cuenta, equipoId) => `${equipoId}|${modulo}|${cuenta}`;
  return {
    cuentaDelAparato: async () => "cuenta-1",
    guardarCopiaSinSenal: async (modulo, cuenta, equipoId, datos) => {
      const guardadaEn = "2026-10-20T14:32:00.000Z";
      copias.guardadas[clave(modulo, cuenta, equipoId)] = { datos: JSON.parse(JSON.stringify(datos)), guardadaEn };
      return guardadaEn;
    },
    leerCopiaSinSenal: async (modulo, cuenta, equipoId) => copias.guardadas[clave(modulo, cuenta, equipoId)] || null,
    borrarCopiasSinSenal: async () => null,
  };
});

// La fila de espera de lo hecho sin señal (filaDeEspera.js), en memoria.
const esperas = vi.hoisted(() => ({ guardadas: {} }));
vi.mock("./domain/filaDeEspera.js", () => ({
  leerEspera: async (modulo, cuenta, equipoId) => JSON.parse(JSON.stringify(esperas.guardadas[`${equipoId}|${modulo}|${cuenta}`] || [])),
  guardarEspera: async (modulo, cuenta, equipoId, cola) => {
    const clave = `${equipoId}|${modulo}|${cuenta}`;
    if (cola.length) esperas.guardadas[clave] = JSON.parse(JSON.stringify(cola));
    else delete esperas.guardadas[clave];
    return true;
  },
}));

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => datos.equipo,
  cargarEquipos: async () => ({ equipos: [] }),
  elegirEquipoInicial: () => null,
  guardarEquipoElegido: () => {},
  esElCam: () => false,
  soloParaMirar: (equipo, modulo) => Array.isArray(equipo?.solo_lectura) && equipo.solo_lectura.includes(modulo),
}));
vi.mock("./domain/lesionesDb.js", () => ({
  cargarPlantelLesiones: async () => ({
    plantel: [
      { id: 1, nombre: "ALFA", roles: [], puestos: [], actual: true, fecha_nacimiento: "2000-03-15", posicion: "delantero_central", categoria: "profissional" },
      { id: 2, nombre: "BETA", roles: [], puestos: [], actual: true, fecha_nacimiento: "", posicion: "", categoria: "sub20" },
      { id: 3, nombre: "GAMA", roles: [], puestos: [], actual: false, fecha_nacimiento: "", posicion: "" },
    ],
    error: "",
  }),
}));
vi.mock("./domain/referenciasDb.js", () => ({
  leerHistorialDeReferencias: async () => ({ cambios: datos.historialVr.map((una) => ({ ...una })), faltaTabla: datos.faltaHistorial, error: "" }),
}));
vi.mock("./domain/evaluacionesDb.js", async (importOriginal) => ({
  // Qué cambió de una evaluación: la de la app.
  cambiosDeLaEvaluacion: (await importOriginal()).cambiosDeLaEvaluacion,
  // Como la base (20261114): solo lo cambiado; en la misma celda gana el
  // último y dice qué había; si ya no está, borrada.
  cambiarEvaluacion: async (id, { cambios, antes }) => {
    datos.cambiadas.push({ id, cambios, antes });
    if (datos.sinCambiar) return { sinFuncion: true, error: "" };
    if (datos.compuerta) await datos.compuerta;
    const actual = datos.evaluaciones.find((una) => una.id === id);
    if (!actual) return { borrada: true, error: "" };
    const pisadas = [];
    const nueva = { ...actual, datos: { ...actual.datos } };
    Object.entries(cambios).forEach(([clave, valor]) => {
      const habia = (clave.startsWith("datos.") ? actual.datos[clave.slice(6)] : actual[clave]) ?? null;
      if (clave in antes && JSON.stringify(habia) !== JSON.stringify(antes[clave]) && JSON.stringify(habia) !== JSON.stringify(valor)) pisadas.push({ clave, habia });
      if (!clave.startsWith("datos.")) nueva[clave] = valor;
      else if (valor === null) delete nueva.datos[clave.slice(6)];
      else nueva.datos[clave.slice(6)] = valor;
    });
    datos.evaluaciones = datos.evaluaciones.map((una) => (una.id === id ? nueva : una));
    return { evaluacion: nueva, pisadas, error: "" };
  },
  cambiarReferencia: async (equipoId, test, ruta, valor) => {
    datos.cambiosVr.push({ test, ruta, valor });
    const actual = JSON.parse(JSON.stringify((test === "zona_media" && datos.referencias) || {}));
    let nodo = actual;
    ruta.slice(0, -1).forEach((parte) => {
      if (!nodo[parte] || typeof nodo[parte] !== "object") nodo[parte] = {};
      nodo = nodo[parte];
    });
    if (valor === null) delete nodo[ruta.at(-1)];
    else nodo[ruta.at(-1)] = valor;
    if (test === "zona_media") datos.referencias = actual;
    return { datos: actual, error: "" };
  },
  listarEvaluaciones: async () => {
    // Sin señal, la base no contesta.
    if (navigator.onLine === false) return { evaluaciones: [], error: "evaluaciones.error.noLeer", detalle: "TypeError: Failed to fetch" };
    if (datos.fallaLaProxima) {
      const error = datos.fallaLaProxima;
      datos.fallaLaProxima = "";
      return { evaluaciones: [], error };
    }
    return datos.errorAlLeer ? { evaluaciones: [], error: datos.errorAlLeer } : { evaluaciones: datos.evaluaciones.map((una) => ({ ...una, datos: { ...una.datos } })), error: "" };
  },
  leerReferencias: async () => ({
    referencias: {
      ...(datos.referencias ? { zona_media: datos.referencias } : {}),
      ...(datos.referenciasCurl ? { curl_nordico_isoprone: datos.referenciasCurl } : {}),
      ...(datos.referenciasIso ? { isocinecia: datos.referenciasIso } : {}),
      ...(datos.referenciasTobillo ? { movilidad_tobillo: datos.referenciasTobillo } : {}),
      ...(datos.referenciasAductor ? { iso_aductor_abductor: datos.referenciasAductor } : {}),
      ...(datos.referenciasSentadilla ? { sentadilla_incremental: datos.referenciasSentadilla } : {}),
      ...(datos.referenciasPress ? { press_plano: datos.referenciasPress } : {}),
      ...(datos.referenciasSaltos ? { salto_countermovement: datos.referenciasSaltos } : {}),
      ...(datos.referenciasSingleLeg ? { salto_single_leg: datos.referenciasSingleLeg } : {}),
    },
    error: "",
  }),
  leerAjustes: async () => ({ campos: [...datos.ajustes.campos], opciones: [...datos.ajustes.opciones], error: "" }),
  leerCategorias: async () => ({ filas: datos.categorias ? datos.categorias.map((fila) => ({ ...fila })) : null, error: "" }),
  guardarCabecera: async (equipoId, test, campo, { etiquetas, oculto, orden, sentido }) => {
    datos.cabeceras.push({ equipoId, test, campo, etiquetas, oculto, orden, ...(sentido ? { sentido } : {}) });
    datos.ajustes.campos = [
      ...datos.ajustes.campos.filter((fila) => !(fila.test === test && fila.campo === campo)),
      { test, campo, etiqueta_es: etiquetas["es-AR"] || "", etiqueta_pt: etiquetas["pt-BR"] || "", oculto, orden, sentido },
    ];
    return { error: "" };
  },
  guardarOpcionDeLista: async (equipoId, lista, { codigo, etiquetas, oculto, orden }) => {
    datos.opciones.push({ equipoId, lista, codigo, etiquetas, oculto, orden });
    datos.ajustes.opciones = [
      ...datos.ajustes.opciones.filter((fila) => !(fila.lista === lista && fila.codigo === codigo)),
      { lista, codigo, etiqueta_es: etiquetas["es-AR"] || "", etiqueta_pt: etiquetas["pt-BR"] || "", oculto, orden },
    ];
    return { error: "" };
  },
  crearEvaluacion: async (equipoId, test, ev) => {
    if (datos.fallaAlCrear && datos.creadas.length >= datos.fallaAlCrear.despues) {
      const { error } = datos.fallaAlCrear;
      datos.fallaAlCrear = null;
      return { evaluacion: null, error };
    }
    datos.creadas.push({ equipoId, test, ev });
    const nueva = { ...ev, id: `nueva-${datos.creadas.length}`, equipo_id: equipoId, test, orden: 100 + datos.creadas.length, persona: ev.persona ?? null };
    datos.evaluaciones.push(nueva);
    return { evaluacion: nueva, error: "" };
  },
  // Como la base (20261113): todas o ninguna; las iguales en todo no entran;
  // la de alguien que ese día ya tiene otra del test, con otros datos, no se
  // guarda (Regla 1); con reemplazar, cambia esas.
  guardarEvaluaciones: async (equipoId, test, { evaluaciones: lista = [], reemplazar = false } = {}) => {
    datos.deUnaVez.push({ test, n: lista.length, reemplazar });
    const nada = { evaluaciones: [], borradas: [], yaEstaban: 0 };
    if (datos.sinGuardarVarias) return { ...nada, sinFuncion: true, error: "" };
    if (datos.fallaAlGuardar) {
      const error = datos.fallaAlGuardar;
      datos.fallaAlGuardar = "";
      return { ...nada, error };
    }
    const { conOtrosDatos, igualEnTodo, quienDeLaEvaluacion } = await import("./domain/evaluaciones/importar.js");
    const delTest = datos.evaluaciones.filter((una) => una.test === test);
    const choques = conOtrosDatos(lista, delTest);
    if (choques.length && !reemplazar) return { ...nada, conOtras: true, error: "" };
    const par = (una) => `${quienDeLaEvaluacion(una)}|${una.fecha || "-"}`;
    const pares = new Set(choques.map(({ evaluacion }) => par(evaluacion)));
    const borradas = delTest.filter((una) => pares.has(par(una))).map((una) => una.id);
    datos.evaluaciones = datos.evaluaciones.filter((una) => !borradas.includes(una.id));
    const entran = lista.filter((ev) => pares.has(par(ev)) || !delTest.some((otra) => igualEnTodo(otra, ev)));
    const nuevas = entran.map((ev) => {
      datos.creadas.push({ equipoId, test, ev });
      const nueva = { ...ev, id: `nueva-${datos.creadas.length}`, equipo_id: equipoId, test, orden: 100 + datos.creadas.length, persona: ev.persona ?? null };
      datos.evaluaciones.push(nueva);
      return nueva;
    });
    return { evaluaciones: nuevas, borradas, yaEstaban: lista.length - nuevas.length, error: "" };
  },
  actualizarEvaluacion: async (id, ev) => {
    datos.actualizadas.push({ id, ev });
    if (datos.compuerta) await datos.compuerta;
    return { evaluacion: { ...ev, id, test: "zona_media" }, error: "" };
  },
  borrarEvaluacion: async (id) => {
    datos.borradas.push(id);
    datos.evaluaciones = datos.evaluaciones.filter((una) => una.id !== id);
    return { error: "" };
  },
}));

const { default: Evaluaciones } = await import("./Evaluaciones.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");
const { fechaCorta, hoyISO } = await import("./idioma/formatos.js");

const botones = (contenedor) => [...document.body.querySelectorAll("button")];
const boton = (contenedor, etiqueta) => botones(contenedor).find((b) => b.textContent.trim() === etiqueta);
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
const cabeceras = (contenedor) => [...contenedor.querySelectorAll("th[data-columna]")].map((th) => th.textContent);
const columna = (contenedor, titulo) => cabeceras(contenedor).indexOf(titulo);
const filas = (contenedor) => [...contenedor.querySelectorAll("tbody tr")];
const celda = (contenedor, fila, titulo) => filas(contenedor)[fila].querySelectorAll("td")[columna(contenedor, titulo)];
const filaDeArriba = (contenedor, rotulo) => [...contenedor.querySelectorAll("tr.tabla-datos-arriba")].find((tr) => tr.querySelector("th.tabla-datos-arriba-rotulo")?.textContent.includes(rotulo));
// Las celdas del informe van debajo de la misma columna que en la tabla:
// después del rótulo (que ocupa las fijas).
const fijas = (contenedor) => contenedor.querySelectorAll("thead tr.tabla-datos-cabeceras th.inmovil").length;
const celdaDeArriba = (contenedor, tr, titulo) => tr.querySelectorAll("td")[columna(contenedor, titulo) - fijas(contenedor)];

// Ir a una pantalla de la barra de abajo.
const irA = async (contenedor, nombre) => tocar([...contenedor.querySelectorAll(".navegacion-movil button")].find((b) => b.textContent.includes(nombre)));
// Un campo del formulario por su rótulo.
const campo = (contenedor, rotulo) => [...contenedor.querySelectorAll(".lesiones-campo-paso")].find((div) => div.querySelector("label")?.textContent.trim() === rotulo);
// Elegir el test en su desplegable.
const elegirTest = async (contenedor, nombre) => {
  const lista = contenedor.querySelector("select.evaluaciones-elegir-test-lista");
  expect(lista, "no se encontró el desplegable del test").toBeTruthy();
  const opcion = [...lista.options].find((una) => una.textContent === nombre);
  expect(opcion, `no está el test ${nombre}`).toBeTruthy();
  await act(async () => {
    lista.value = opcion.value;
    lista.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

// La carga nueva (Santiago, 18/10): el test y la fecha; después, una fila por
// jugador.
const empezarCarga = async (contenedor, nombreTest) => {
  await tocar(boton(contenedor, "Nueva evaluación"));
  if (nombreTest) await elegirTest(contenedor, nombreTest);
  await tocar(boton(contenedor, "Siguiente"));
};
const filasDeLaCarga = (contenedor) => [...contenedor.querySelectorAll(".evaluaciones-varios-tabla tbody tr")];
const titulosDeLaCarga = (contenedor) => [...contenedor.querySelectorAll(".evaluaciones-varios-tabla thead th")].map((th) => th.textContent);
const opcionesDeLaHoja = () => [...document.body.querySelectorAll(".opcion-hoja")].map((b) => b.textContent);
const elegirEnLaHoja = async (nombre) => tocar([...document.body.querySelectorAll(".opcion-hoja")].find((b) => b.textContent === nombre));
// El jugador de una fila, en la hoja de opciones.
const elegirJugador = async (contenedor, indice, nombre) => {
  await tocar(filasDeLaCarga(contenedor)[indice].querySelector(".evaluaciones-varios-jugador"));
  await elegirEnLaHoja(nombre);
};
// Un dato de la carga por su nombre completo (jugador · bloque · columna),
// el que lee un lector de pantalla.
const dato = (contenedor, rotulo) => {
  const encontrado = contenedor.querySelector(`[aria-label="${rotulo}"]`);
  expect(encontrado, `no está el dato ${rotulo}`).toBeTruthy();
  return encontrado;
};
const elegirOpcion = async (lista, etiqueta) => {
  const opcion = [...lista.options].find((una) => una.textContent === etiqueta);
  expect(opcion, `no está la opción ${etiqueta}`).toBeTruthy();
  await act(async () => {
    lista.value = opcion.value;
    lista.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

describe("Evaluaciones", () => {
  let contenedor;
  let raiz;
  let volvio;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    localStorage.clear();
    sessionStorage.clear();
    datos.equipo = { id: "eq-1", nombre: "Club de Prueba" };
    datos.evaluaciones = EVALUACIONES();
    datos.referencias = REFERENCIAS;
    datos.cambiosVr = [];
    datos.historialVr = [];
    datos.faltaHistorial = false;
    datos.errorAlLeer = "";
    datos.creadas = [];
    datos.fallaAlCrear = null;
    datos.deUnaVez = [];
    datos.sinGuardarVarias = false;
    datos.fallaAlGuardar = "";
    datos.cambiadas = [];
    datos.sinCambiar = false;
    datos.actualizadas = [];
    datos.borradas = [];
    datos.compuerta = null;
    datos.fallaLaProxima = "";
    datos.ajustes = { campos: [], opciones: [] };
    datos.categorias = null;
    datos.cabeceras = [];
    datos.opciones = [];
    datos.referenciasCurl = null;
    datos.referenciasIso = null;
    datos.referenciasTobillo = null;
    datos.referenciasAductor = null;
    datos.referenciasSentadilla = null;
    datos.referenciasPress = null;
    datos.referenciasSaltos = null;
    datos.referenciasSingleLeg = null;
    volvio = 0;
    copias.guardadas = {};
    esperas.guardadas = {};
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
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
      raiz.render(<Evaluaciones onVolver={() => (volvio += 1)} volverA="portal.basesTitulo" />);
    });
  };

  test("la hoja del test: título, nota, el informe arriba y la base con los formatos del Excel", async () => {
    await montar();
    await irA(contenedor, "Base");
    expect(contenedor.querySelector("h1").textContent).toBe('Evaluación Zona Media "CORE"');
    expect(contenedor.textContent).toContain("*Los Valores pintados corresponden a la comparación");
    expect(cabeceras(contenedor).slice(0, 8)).toEqual(["nº Eva", "Fecha", "Jugador", "Seleccion", "Fecha Nac", "Lumbar", "L. Clas", "% mejora"]);
    expect(cabeceras(contenedor).at(-1)).toBe("Nota");
    // Posición no se usa y la "A" del Excel queda en Deficit Lateral % (sin signo).
    expect(cabeceras(contenedor)).not.toContain("Posición");
    expect(cabeceras(contenedor)).not.toContain("A");
    expect(cabeceras(contenedor).slice(cabeceras(contenedor).indexOf("% mejora", 8) + 1, cabeceras(contenedor).indexOf("Prono"))).toEqual(["Lateral I", "L.I. Clas", "% mejora", "Deficit Lateral %", "Deficit. Clas"]);
    expect(fijas(contenedor)).toBe(5);
    // Arriba de la base, cuántas filas hay (no hay columna que las cuente).
    expect(contenedor.querySelector(".tabla-datos-cuantas").textContent).toBe("3 filas");

    // Por fecha: las dos del 01/06 en el orden de carga, después la del 01/07.
    expect(filas(contenedor).map((tr) => tr.querySelectorAll("td")[columna(contenedor, "Jugador")].textContent)).toEqual(["ALFA", "BETA", "ALFA"]);
    expect(celda(contenedor, 0, "nº Eva").textContent).toBe("1");
    expect(celda(contenedor, 2, "nº Eva").textContent).toBe("2");
    expect(celda(contenedor, 0, "Fecha Nac").textContent).toBe("15/03/2000");
    // La categoría, con el nombre de Datos básicos (18/10).
    expect(celda(contenedor, 0, "Seleccion").textContent).toBe("Mayor (profesional)");
    expect(celda(contenedor, 0, "Lumbar").textContent).toBe("4:00");
    // La clase, con el número del color de su clase, en negrita, sobre gris.
    const clase = celda(contenedor, 0, "L. Clas");
    expect(clase.textContent).toBe("5");
    expect(clase.style.background).toBe("rgb(217, 217, 217)");
    expect(clase.style.color).toBe("rgb(79, 98, 40)");
    expect(clase.style.fontWeight).toBe("700");
    // % mejora: contra la evaluación anterior del mismo jugador.
    expect(celda(contenedor, 2, "% mejora").textContent).toBe("5,0%");

    // El informe, con las tres que se ven.
    const n = filaDeArriba(contenedor, "nº");
    expect(n.querySelector(".evaluaciones-rotulo-n b").textContent).toBe("3");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Promedios"), "Lumbar").textContent).toBe("3:34");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Máximo"), "Lumbar").textContent).toBe("4:12");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Mínimo"), "Lumbar").textContent).toBe("2:30");
    expect(celdaDeArriba(contenedor, n, "Lumbar").textContent).toBe("3");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Promedios"), "Prono").textContent).toBe("2:10");
    // Sin ningún número en la columna (el % mejora de Prono), vacío: el Excel
    // mostraba #DIV/0! y 0.
    const mejoras = cabeceras(contenedor).flatMap((titulo, i) => (titulo === "% mejora" ? [i] : []));
    expect(mejoras).toHaveLength(4);
    const promedios = filaDeArriba(contenedor, "Promedios").querySelectorAll("td");
    expect(promedios[mejoras[3] - fijas(contenedor)].textContent).toBe("");
    expect(filaDeArriba(contenedor, "Mínimo").querySelectorAll("td")[mejoras[3] - fijas(contenedor)].textContent).toBe("");
  });

  test("la comparación con los V.R. de la categoría elegida (Vs Mayor al abrir)", async () => {
    await montar();
    await irA(contenedor, "Base");
    const comparar = contenedor.querySelector(".evaluaciones-comparar select");
    expect(comparar.value).toBe("mayor");
    // Las categorías de Datos básicos, en su orden; «Vs Sub 15» como el Excel, Mayor con su nombre de allá.
    expect([...comparar.options].map((opcion) => opcion.textContent)).toEqual(["Vs Mayor (profesional)", "Vs Sub 23", "Vs Sub 20", "Vs Sub 18", "Vs Sub 17", "Vs Sub 15"]);
    const [fila2, fila3] = contenedor.querySelectorAll("tr.tabla-datos-arriba");
    // Promedio 214 s contra el Bueno (180 s): 118,89 %, clase 4 (en verde).
    const porcentaje = celdaDeArriba(contenedor, fila2, "Lumbar");
    expect(porcentaje.textContent).toBe("118,89%");
    // Verde, más suave que el del Excel (Santiago, 15/10).
    expect(porcentaje.style.background).toContain("159, 214, 138");
    expect(celdaDeArriba(contenedor, fila2, "L. Clas").textContent).toBe("4");
    expect(celdaDeArriba(contenedor, fila3, "Lumbar").textContent).toBe("3:00");

    // Contra una categoría sin V.R., la comparación queda vacía.
    await act(async () => {
      comparar.value = "sub15";
      comparar.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(celdaDeArriba(contenedor, contenedor.querySelectorAll("tr.tabla-datos-arriba")[0], "Lumbar").textContent).toBe("");
    expect(celdaDeArriba(contenedor, contenedor.querySelectorAll("tr.tabla-datos-arriba")[1], "Lumbar").textContent).toBe("");
  });

  test("sin los V.R. del test, avisa y las clases quedan vacías", async () => {
    datos.referencias = null;
    await montar();
    await irA(contenedor, "Base");
    expect(contenedor.textContent).toContain("Todavía no están los valores de referencia de este test");
    expect(celda(contenedor, 0, "L. Clas").textContent).toBe("");
    // Lo que no depende de los V.R. sigue igual.
    expect(celda(contenedor, 2, "% mejora").textContent).toBe("5,0%");
  });

  test("abre en Cargar: arriba se vuelve a Bases de Datos y la carga nueva va aparte", async () => {
    datos.evaluaciones.push(evaluacion("e4", 4, 2, hoyISO(), { lumbar: 200 }));
    await montar();
    expect(contenedor.querySelector(".etiqueta-hero").textContent).toBe("EVALUACIONES");
    expect(contenedor.querySelector(".estado-hero").textContent).toBe("1 evaluación hoy");
    // Las de hoy, con su test.
    const tarjetas = [...contenedor.querySelectorAll(".evaluaciones-registro")];
    expect(tarjetas).toHaveLength(1);
    expect(tarjetas[0].textContent).toContain("BETA");
    expect(tarjetas[0].textContent).toContain("Zona Media");
    // La Base ya no tiene "Agregar evaluación": se carga en Cargar.
    await irA(contenedor, "Base");
    expect(boton(contenedor, "Agregar evaluación")).toBeUndefined();
    expect(boton(contenedor, "Nueva evaluación")).toBeUndefined();
  });

  // Santiago, 18/10: «que aprietes cargar, elijas el test y cuando le das a
  // siguiente te lleva a una fila con las cabeceras del test elegido…».
  test("Nueva evaluación: el test y la fecha, después una fila por jugador; los tiempos se guardan en segundos", async () => {
    await montar();
    await tocar(boton(contenedor, "Nueva evaluación"));
    expect(contenedor.querySelector("h1").textContent).toBe("Nueva evaluación");
    expect(contenedor.querySelector(".lesiones-paso-titulo h2").textContent).toBe("Test y fecha");
    // Una fecha para todos; posterior a hoy, no sigue.
    const fecha = campo(contenedor, "Fecha").querySelector("input");
    expect(fecha.value).toBe(hoyISO());
    await escribir(fecha, "2999-01-01");
    await tocar(boton(contenedor, "Siguiente"));
    expect(contenedor.textContent).toContain("La fecha de la evaluación no puede ser posterior a hoy.");
    await escribir(campo(contenedor, "Fecha").querySelector("input"), hoyISO());
    await tocar(boton(contenedor, "Siguiente"));
    expect(contenedor.querySelector(".lesiones-paso-titulo h2").textContent).toBe("Una fila por jugador");
    expect(contenedor.querySelector(".lesiones-encabezado p").textContent).toBe(`Zona Media · ${fechaCorta(hoyISO())}`);
    expect(titulosDeLaCarga(contenedor)).toEqual(["Jugador", "Seleccion", "Lumbar", "Lateral D", "Lateral I", "Prono", "Nota", ""]);
    // Una fila para empezar; sin nada cargado no hay qué guardar.
    expect(filasDeLaCarga(contenedor)).toHaveLength(1);
    expect(boton(contenedor, "Guardar 0 evaluaciones").disabled).toBe(true);
    // Solo el plantel actual (GAMA ya no está); la Selección sale de la categoría de Datos básicos.
    await tocar(filasDeLaCarga(contenedor)[0].querySelector(".evaluaciones-varios-jugador"));
    expect(opcionesDeLaHoja()).toEqual(["ALFA", "BETA"]);
    await elegirEnLaHoja("BETA");
    expect(dato(contenedor, "BETA · Seleccion").value).toBe("sub20");
    // Otro jugador: la hoja se abre sola y no ofrece a los que ya están.
    await tocar(boton(contenedor, "+ Agregar jugador"));
    expect(filasDeLaCarga(contenedor)).toHaveLength(2);
    expect(opcionesDeLaHoja()).toEqual(["ALFA"]);
    await elegirEnLaHoja("ALFA");
    // «Mayor (profesional)» de Datos básicos es Mayor; se puede cambiar.
    expect(dato(contenedor, "ALFA · Seleccion").value).toBe("mayor");
    await elegirOpcion(dato(contenedor, "ALFA · Seleccion"), "Sub-23");
    // Un tiempo que no se entiende no se guarda (y dice de quién es).
    await escribir(dato(contenedor, "BETA · Lumbar"), "3:7x");
    await escribir(dato(contenedor, "BETA · Prono"), "2,05");
    await escribir(dato(contenedor, "BETA · Nota"), "con molestia");
    await escribir(dato(contenedor, "ALFA · Lumbar"), "4:00");
    await tocar(boton(contenedor, "Guardar 2 evaluaciones"));
    expect(contenedor.textContent).toContain("BETA: «3:7x» no se entiende en Lumbar");
    expect(datos.creadas).toHaveLength(0);
    await escribir(dato(contenedor, "BETA · Lumbar"), "3:10");
    await tocar(boton(contenedor, "Guardar 2 evaluaciones"));
    expect(datos.creadas).toEqual([
      { equipoId: "eq-1", test: "zona_media", ev: { jugador_id: 2, persona: null, fecha: hoyISO(), datos: { seleccion: "sub20", lumbar: 190, prono: 125, nota: "con molestia" } } },
      { equipoId: "eq-1", test: "zona_media", ev: { jugador_id: 1, persona: null, fecha: hoyISO(), datos: { seleccion: "sub23", lumbar: 240 } } },
    ]);
    // Vuelve a Cargar, con las nuevas entre las de hoy.
    expect(document.body.textContent).toContain("2 evaluaciones guardadas.");
    expect(contenedor.querySelector(".estado-hero").textContent).toBe("2 evaluaciones hoy");
    // En la Base, al final (son las más nuevas) y con su cálculo.
    await irA(contenedor, "Base");
    expect(filas(contenedor)).toHaveLength(5);
    expect(celda(contenedor, 3, "Jugador").textContent).toBe("BETA");
    expect(celda(contenedor, 3, "Lumbar").textContent).toBe("3:10");
    expect(celda(contenedor, 3, "nº Eva").textContent).toBe("2");
    expect(celda(contenedor, 4, "Jugador").textContent).toBe("ALFA");
  });

  test("Nueva evaluación: una fila con algo cargado pide su jugador; sacarla pregunta si tiene algo", async () => {
    await montar();
    await empezarCarga(contenedor);
    await elegirJugador(contenedor, 0, "ALFA");
    await escribir(dato(contenedor, "ALFA · Lumbar"), "3:00");
    // Otra fila sin elegir a nadie, con algo escrito.
    await tocar(boton(contenedor, "+ Agregar jugador"));
    await tocar(boton(contenedor, "Cancelar"));
    await escribir(dato(contenedor, "Fila 2 · Prono"), "2:00");
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(contenedor.textContent).toContain("Falta elegir el jugador de la fila 2.");
    expect(datos.creadas).toHaveLength(0);
    // Sacar una fila con algo cargado pregunta; vacía, no.
    await tocar(contenedor.querySelector('[aria-label="Sacar de la carga: Fila 2"]'));
    expect(document.body.textContent).toContain("Lo que cargaste de esta fila se pierde.");
    await tocar(boton(contenedor, "Sí, sacar"));
    expect(filasDeLaCarga(contenedor)).toHaveLength(1);
    await tocar(boton(contenedor, "+ Agregar jugador"));
    await tocar(boton(contenedor, "Cancelar"));
    await tocar(contenedor.querySelector('[aria-label="Sacar de la carga: Fila 2"]'));
    expect(filasDeLaCarga(contenedor)).toHaveLength(1);
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(datos.creadas).toEqual([{ equipoId: "eq-1", test: "zona_media", ev: { jugador_id: 1, persona: null, fecha: hoyISO(), datos: { seleccion: "mayor", lumbar: 180 } } }]);
  });

  test("Nueva evaluación sin la actualización de la base: de a una; si una no se guarda, las guardadas salen de la carga y al reintentar no se repiten", async () => {
    datos.sinGuardarVarias = true;
    await montar();
    await empezarCarga(contenedor);
    await elegirJugador(contenedor, 0, "ALFA");
    await escribir(dato(contenedor, "ALFA · Lumbar"), "3:00");
    await tocar(boton(contenedor, "+ Agregar jugador"));
    await elegirEnLaHoja("BETA");
    await escribir(dato(contenedor, "BETA · Lumbar"), "2:00");
    datos.fallaAlCrear = { despues: 1, error: "evaluaciones.error.noGuardar" };
    await tocar(boton(contenedor, "Guardar 2 evaluaciones"));
    expect(datos.creadas.map((una) => una.ev.jugador_id)).toEqual([1]);
    expect(contenedor.textContent).toContain("Se guardó 1 y salió de la lista.");
    expect(filasDeLaCarga(contenedor).map((fila) => fila.querySelector(".evaluaciones-varios-jugador b").textContent)).toEqual(["BETA"]);
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(datos.creadas.map((una) => una.ev.jugador_id)).toEqual([1, 2]);
    expect(document.body.textContent).toContain("1 evaluación guardada.");
    expect(contenedor.querySelector(".estado-hero").textContent).toBe("2 evaluaciones hoy");
  });

  // Paso 1 de «cargar sin señal y a la vez que otra persona» (Santiago,
  // 21/10: la copia «Automática en todos, sin botón»).
  const unRato = () => act(async () => new Promise((listo) => setTimeout(listo, 1600)));
  const sinSenalAhora = async (sin) => {
    Object.defineProperty(window.navigator, "onLine", { value: !sin, configurable: true });
    await act(async () => window.dispatchEvent(new Event(sin ? "offline" : "online")));
  };

  test("Ver sin señal: con señal guarda sola la copia de este aparato; sin señal la Base abre con ella y se puede cambiar", async () => {
    await montar();
    await unRato();
    expect(copias.guardadas["eq-1|evaluaciones|cuenta-1"].datos.evaluaciones.map((una) => una.id)).toEqual(["e1", "e2", "e3"]);
    // No hay que activar nada: no hay botón.
    await irA(contenedor, "Base");
    expect(contenedor.textContent).not.toContain("Ver sin señal");

    // Otra vez, sin señal: la copia (paso 3, Santiago, 21/10: sin señal se
    // carga, se cambia y se borra igual).
    await act(async () => raiz.unmount());
    await sinSenalAhora(true);
    await montar();
    await irA(contenedor, "Base");
    expect(contenedor.querySelector(".aviso-sin-senal").textContent).toContain("Sin señal: ves la copia de este aparato");
    expect(contenedor.querySelector(".aviso-sin-senal").textContent).toContain("Lo que cargues, cambies o borres queda en este aparato y se sube solo cuando vuelva la señal.");
    expect(filas(contenedor)).toHaveLength(3);
    expect(boton(contenedor, "Pegar desde Excel")).toBeTruthy();
    await irA(contenedor, "Cargar");
    expect(boton(contenedor, "Nueva evaluación")).toBeTruthy();
    // Los Ajustes, con señal.
    await irA(contenedor, "Ajustes");
    expect(contenedor.textContent).toContain("Sin señal: los Ajustes se cambian cuando vuelva la señal.");

    // Vuelve la señal: lo de la base, al día.
    await sinSenalAhora(false);
    await unRato();
    expect(contenedor.querySelector(".aviso-sin-senal")).toBeNull();
  }, 20000);

  // Paso 3 de «cargar sin señal y a la vez que otra persona» (Santiago, 21/10,
  // en un cuestionario: lo que espera, con un aviso arriba y las filas «de
  // otro color»; al volver la señal «Lo sube sola y avisa»; si choca,
  // «Espera y te pregunta»; sin señal, también Pegar y los V.R.).
  const sinSenalConLaCopia = async () => {
    await montar();
    await unRato();
    await act(async () => raiz.unmount());
    await sinSenalAhora(true);
    await montar();
  };
  const avisoArriba = () => contenedor.querySelector(".aviso-sin-senal")?.textContent || "";
  const queEsperan = () => [...contenedor.querySelectorAll("tbody tr.espera")];

  test("sin señal: se cambia, se borra y se carga; queda esperando, en otro color, y al volver la señal sube sola y avisa", async () => {
    await sinSenalConLaCopia();
    await irA(contenedor, "Base");
    await editarLumbarDeBeta();
    expect(datos.cambiadas).toEqual([]);
    expect(celda(contenedor, 1, "Lumbar").textContent).toBe("2:40");
    expect(queEsperan()).toEqual([filas(contenedor)[1]]);
    expect(avisoArriba()).toContain("Sin señal: 1 cambio espera para subir");
    expect(contenedor.textContent).toContain("En este color, lo que espera para subir (se cargó o cambió sin señal).");
    // Borrar.
    await tocar(celda(contenedor, 2, "Lumbar"));
    await tocar(boton(contenedor, "Borrar fila"));
    await tocar(boton(contenedor, "Sí, borrar"));
    expect(datos.borradas).toEqual([]);
    expect(filas(contenedor)).toHaveLength(2);
    expect(document.body.textContent).toContain("1 cambio quedó en este aparato: se sube solo cuando vuelva la señal.");
    // Cargar una nueva.
    await irA(contenedor, "Cargar");
    await cargarAlfaHoy();
    expect(datos.deUnaVez).toEqual([]);
    expect(esperas.guardadas["eq-1|evaluaciones|cuenta-1"].map((uno) => uno.tipo)).toEqual(["cambiar", "borrar", "crear"]);
    await irA(contenedor, "Base");
    expect(filas(contenedor)).toHaveLength(3);
    expect(queEsperan()).toHaveLength(2);
    expect(avisoArriba()).toContain("Sin señal: 3 cambios esperan para subir");

    // Vuelve la señal: sube sola, en orden, y avisa.
    await sinSenalAhora(false);
    await unRato();
    expect(datos.cambiadas).toEqual([{ id: "e2", cambios: { "datos.lumbar": 160 }, antes: { "datos.lumbar": 150 } }]);
    expect(datos.borradas).toEqual(["e3"]);
    expect(datos.deUnaVez).toEqual([{ test: "zona_media", n: 1, reemplazar: false }]);
    expect(document.body.textContent).toContain("Se subieron 3 cambios hechos sin señal.");
    expect(esperas.guardadas).toEqual({});
    expect(queEsperan()).toEqual([]);
    expect(filas(contenedor)).toHaveLength(3);
    expect(contenedor.querySelector(".aviso-sin-senal")).toBeNull();
  }, 20000);

  test("lo que espera queda en el aparato: sin señal, al volver a abrir, se ve encima de la copia", async () => {
    await sinSenalConLaCopia();
    await irA(contenedor, "Base");
    await editarLumbarDeBeta();
    await act(async () => raiz.unmount());
    await montar();
    await irA(contenedor, "Base");
    expect(celda(contenedor, 1, "Lumbar").textContent).toBe("2:40");
    expect(queEsperan()).toHaveLength(1);
    expect(avisoArriba()).toContain("Sin señal: 1 cambio espera para subir");
  }, 20000);

  test("si lo cargado sin señal choca con otra que cargó otra persona, espera y pregunta; «Ir a la Base» y después «Reemplazar y cargar»", async () => {
    await sinSenalConLaCopia();
    await cargarAlfaHoy();
    // Mientras tanto, otra persona carga a ALFA ese día, con otros datos.
    datos.evaluaciones = [...datos.evaluaciones, evaluacion("hoy-1", 4, 1, hoyISO(), { lumbar: 170 })];
    await sinSenalAhora(false);
    await unRato();
    expect(datos.deUnaVez).toEqual([]);
    expect(hojaDelDia().querySelector("h3").textContent).toBe("Esas evaluaciones ya están en la Base, con otros datos");
    expect(hojaDelDia().textContent).toContain("1 evaluación que cargaste sin señal es de alguien que ese día ya tiene otra del mismo test, con otros datos:");
    expect([...hojaDelDia().querySelectorAll(".consentimiento-personas li")].map((li) => li.textContent)).toEqual([`${fechaCorta(hoyISO())} · ALFA · Zona Media`]);
    // «Ir a la Base»: las dos, la suya en otro color; sigue esperando.
    await tocar(boton(document.body, "Ir a la Base"));
    expect(contenedor.textContent).toContain("Estas son las evaluaciones de esos días que ya estaban y, en otro color, las que cargaste sin señal: esperan.");
    expect(filas(contenedor)).toHaveLength(2);
    expect(queEsperan()).toHaveLength(1);
    expect(avisoArriba()).toContain("1 cambio espera para subir");
    expect(avisoArriba()).toContain("1 choca con lo que cargó otra persona");
    // «Subir lo que espera»: pregunta otra vez; «Reemplazar y cargar».
    await tocar(boton(contenedor, "Subir lo que espera"));
    await unRato();
    await tocar(boton(document.body, "Reemplazar y cargar"));
    await unRato();
    expect(datos.deUnaVez).toEqual([{ test: "zona_media", n: 1, reemplazar: true }]);
    expect(esperas.guardadas).toEqual({});
    expect(document.body.textContent).toContain("Se reemplazó 1 evaluación que ya estaba.");
  }, 20000);

  test("sin señal se pega desde Excel y se cambian los V.R.: esperan y suben al volver la señal", async () => {
    await sinSenalConLaCopia();
    await irA(contenedor, "Valores de referencia");
    await cambiarVr(celdaVr(tablaVr(0), "Bueno", "Lumbar"), "3:10");
    expect(datos.cambiosVr).toEqual([]);
    expect(celdaVr(tablaVr(0), "Bueno", "Lumbar").textContent).toBe("3:10");
    await irA(contenedor, "Base");
    await tocar(boton(contenedor, "Pegar desde Excel"));
    await escribir(contenedor.querySelector(".datos-importar-pegado textarea"), ["nº Eva\tFecha\tJugador\tSeleccion\tLumbar", "1\t02/06/2026\tBETA\tMayor\t3:10"].join("\n"));
    await tocar(boton(contenedor, "Cargar 1 evaluación"));
    expect(datos.deUnaVez).toEqual([]);
    expect(document.body.textContent).toContain("1 cambio quedó en este aparato: se sube solo cuando vuelva la señal.");
    expect(avisoArriba()).toContain("Sin señal: 2 cambios esperan para subir");
    await sinSenalAhora(false);
    await unRato();
    expect(datos.cambiosVr).toEqual([{ test: "zona_media", ruta: ["categorias", "mayor", "bueno", "lumbar"], valor: 190 / 1440 }]);
    expect(datos.deUnaVez).toEqual([{ test: "zona_media", n: 1, reemplazar: false }]);
    expect(document.body.textContent).toContain("Se subieron 2 cambios hechos sin señal.");
  }, 20000);

  test("Ver sin señal: sin copia, el aviso de siempre; quien ya se fue del club no guarda copia", async () => {
    await sinSenalAhora(true);
    await montar();
    expect(contenedor.textContent).toContain("Sin conexión. Evaluaciones necesita señal para leer y guardar.");
    await act(async () => raiz.unmount());
    await sinSenalAhora(false);
    datos.equipo = { id: "eq-1", nombre: "Club de Prueba", hasta: "2026-09-25" };
    await montar();
    await unRato();
    expect(copias.guardadas).toEqual({});
  });

  // Parte A3 de «cargar sin señal y a la vez que otra persona» (Santiago,
  // 20/10): todas de una vez; una igual en todo no se carga; la Regla 1
  // (alguien que ese día ya tiene otra del test, con otros datos) pregunta.
  const cargarAlfaHoy = async () => {
    await empezarCarga(contenedor);
    await elegirJugador(contenedor, 0, "ALFA");
    await escribir(dato(contenedor, "ALFA · Lumbar"), "3:00");
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
  };
  const hojaDelDia = () => document.querySelector(".hoja-confirmar");

  test("Nueva evaluación, Regla 1: si ese día ya tiene otra con otros datos, pregunta; «Reemplazar y cargar» la cambia por la nueva", async () => {
    datos.evaluaciones = [...EVALUACIONES(), evaluacion("hoy-1", 4, 1, hoyISO(), { lumbar: 170 })];
    await montar();
    await cargarAlfaHoy();
    expect(datos.deUnaVez).toHaveLength(0);
    expect(hojaDelDia().querySelector("h3").textContent).toBe("Esas evaluaciones ya están en la Base, con otros datos");
    expect(hojaDelDia().textContent).toContain(`1 jugador de esta carga ya tiene una evaluación de Zona Media del ${fechaCorta(hoyISO())}, con otros datos:`);
    expect([...hojaDelDia().querySelectorAll(".consentimiento-personas li")].map((li) => li.textContent)).toEqual(["ALFA"]);
    expect(hojaDelDia().textContent).toContain("«Reemplazar y cargar» borra esas evaluaciones y guarda las de esta carga (lo borrado queda en el historial).");
    // El foco arranca en «Ir a la Base»: no borra.
    expect(document.activeElement.textContent).toBe("Ir a la Base");
    await tocar(boton(contenedor, "Reemplazar y cargar"));
    expect(datos.deUnaVez).toEqual([{ test: "zona_media", n: 1, reemplazar: true }]);
    expect(datos.evaluaciones.map((una) => una.id)).not.toContain("hoy-1");
    expect(document.body.textContent).toContain("1 evaluación guardada. Se reemplazó 1 evaluación que ya estaba.");
    expect(contenedor.querySelector(".estado-hero").textContent).toBe("1 evaluación hoy");
  });

  test("Nueva evaluación, Regla 1, «Ir a la Base»: la carga espera, la Base muestra la que ya estaba y «Seguir la carga» vuelve con todo", async () => {
    datos.evaluaciones = [...EVALUACIONES(), evaluacion("hoy-1", 4, 1, hoyISO(), { lumbar: 170 })];
    await montar();
    await cargarAlfaHoy();
    await tocar(boton(contenedor, "Ir a la Base"));
    expect(datos.deUnaVez).toHaveLength(0);
    expect(contenedor.querySelector(".evaluaciones-revisar").textContent).toContain(`Estas son las evaluaciones del ${fechaCorta(hoyISO())} que ya estaban. Tu carga quedó en espera.`);
    expect(filas(contenedor).map((tr) => tr.querySelectorAll("td")[columna(contenedor, "Fecha")].textContent)).toEqual([fechaCorta(hoyISO())]);
    // «Ver toda la Base» saca esos filtros; la carga sigue esperando.
    await tocar(boton(contenedor, "Ver toda la Base"));
    expect(filas(contenedor)).toHaveLength(4);
    await irA(contenedor, "Cargar");
    await tocar(boton(contenedor, "Nueva evaluación"));
    expect(dato(contenedor, "ALFA · Lumbar").value).toBe("3:00");
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(hojaDelDia().querySelector("h3").textContent).toBe("Esas evaluaciones ya están en la Base, con otros datos");
    await tocar(boton(contenedor, "Ir a la Base"));
    await tocar(boton(contenedor, "Seguir la carga"));
    expect(dato(contenedor, "ALFA · Lumbar").value).toBe("3:00");
  });

  test("Nueva evaluación: una igual en todo a una que ya está no se carga", async () => {
    datos.evaluaciones = [...EVALUACIONES(), evaluacion("hoy-1", 4, 1, hoyISO(), { lumbar: 180 })];
    await montar();
    await cargarAlfaHoy();
    expect(hojaDelDia()).toBeNull();
    expect(datos.deUnaVez).toHaveLength(0);
    expect(contenedor.textContent).toContain("ALFA: esa evaluación ya está en la Base (la misma fecha y los mismos datos).");
  });

  test("Nueva evaluación: se guardan todas o ninguna", async () => {
    await montar();
    await empezarCarga(contenedor);
    await elegirJugador(contenedor, 0, "ALFA");
    await escribir(dato(contenedor, "ALFA · Lumbar"), "3:00");
    await tocar(boton(contenedor, "+ Agregar jugador"));
    await elegirEnLaHoja("BETA");
    await escribir(dato(contenedor, "BETA · Lumbar"), "2:00");
    datos.fallaAlGuardar = "evaluaciones.error.noGuardar";
    await tocar(boton(contenedor, "Guardar 2 evaluaciones"));
    expect(datos.creadas).toHaveLength(0);
    expect(contenedor.textContent).toContain("No se pudo guardar la evaluación.");
    expect(filasDeLaCarga(contenedor)).toHaveLength(2);
    await tocar(boton(contenedor, "Guardar 2 evaluaciones"));
    expect(datos.creadas.map((una) => una.ev.jugador_id)).toEqual([1, 2]);
    expect(document.body.textContent).toContain("2 evaluaciones guardadas.");
  });

  test("Nueva evaluación: si otra persona cargó ese día mientras tanto, no se guarda, se vuelve a leer y la próxima vez pregunta", async () => {
    await montar();
    // Otra persona carga la de ALFA de hoy (la app todavía no la vio).
    datos.evaluaciones = [...datos.evaluaciones, evaluacion("otra-1", 9, 1, hoyISO(), { lumbar: 170 })];
    await cargarAlfaHoy();
    expect(datos.deUnaVez).toEqual([{ test: "zona_media", n: 1, reemplazar: false }]);
    expect(datos.creadas).toHaveLength(0);
    expect(contenedor.textContent).toContain("Mientras tanto cambiaron evaluaciones de esos jugadores en la Base. Revisá y volvé a guardar.");
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(hojaDelDia().querySelector("h3").textContent).toBe("Esas evaluaciones ya están en la Base, con otros datos");
  });

  test("Nueva evaluación sin la actualización de la base: reemplazar avisa que falta y no cambia nada", async () => {
    datos.sinGuardarVarias = true;
    datos.evaluaciones = [...EVALUACIONES(), evaluacion("hoy-1", 4, 1, hoyISO(), { lumbar: 170 })];
    await montar();
    await cargarAlfaHoy();
    await tocar(boton(contenedor, "Reemplazar y cargar"));
    expect(datos.creadas).toHaveLength(0);
    expect(datos.evaluaciones.map((una) => una.id)).toContain("hoy-1");
    expect(contenedor.textContent).toContain("Para reemplazar falta una actualización de la base de datos.");
  });

  // Santiago, 18/10: en el celular, «Tarjetas» que «se puedan cerrar y abrir
  // con una flechita al costado inferior derecho de la evaluacion».
  test("Nueva evaluación en el celular: una tarjeta por jugador que se cierra y se abre con la flecha", async () => {
    const matchMediaOriginal = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
    try {
      await montar();
      await empezarCarga(contenedor);
      expect(contenedor.querySelector(".evaluaciones-varios-tabla")).toBeNull();
      const tarjetas = () => [...contenedor.querySelectorAll(".evaluaciones-varios-tarjeta")];
      expect(tarjetas()).toHaveLength(1);
      await tocar(tarjetas()[0].querySelector(".evaluaciones-varios-jugador"));
      await elegirEnLaHoja("BETA");
      expect([...tarjetas()[0].querySelectorAll(".evaluaciones-varios-campos label > span")].map((span) => span.textContent)).toEqual(["Seleccion", "Lumbar", "Lateral D", "Lateral I", "Prono", "Nota"]);
      await escribir(dato(contenedor, "BETA · Lumbar"), "3:10");
      const flecha = tarjetas()[0].querySelector(".evaluaciones-varios-flecha");
      expect(flecha.getAttribute("aria-label")).toBe("Cerrar: BETA");
      expect(flecha.getAttribute("aria-expanded")).toBe("true");
      await tocar(flecha);
      // Cerrada: lo cargado, en una línea.
      expect(tarjetas()[0].querySelector(".evaluaciones-varios-campos")).toBeNull();
      expect(tarjetas()[0].querySelector(".evaluaciones-varios-abajo p").textContent).toBe("Sub-20 · 1 de 4 medidas");
      expect(flecha.getAttribute("aria-expanded")).toBe("false");
      await tocar(tarjetas()[0].querySelector(".evaluaciones-varios-flecha"));
      expect(dato(contenedor, "BETA · Lumbar").value).toBe("3:10");
      await tocar(boton(contenedor, "Guardar 1 evaluación"));
      expect(datos.creadas).toEqual([{ equipoId: "eq-1", test: "zona_media", ev: { jugador_id: 2, persona: null, fecha: hoyISO(), datos: { seleccion: "sub20", lumbar: 190 } } }]);
    } finally {
      window.matchMedia = matchMediaOriginal;
    }
  });

  test("editar una de hoy: el jugador no se cambia, los tiempos se ven como se escriben", async () => {
    datos.evaluaciones.push(evaluacion("e4", 4, 2, hoyISO(), { lumbar: 200 }));
    await montar();
    await tocar(boton(contenedor, "Editar"));
    expect(contenedor.querySelector("h1").textContent).toBe("Editar evaluación");
    expect(contenedor.querySelector(".evaluaciones-jugador-fijo").textContent).toBe("BETA");
    await tocar(boton(contenedor, "Siguiente"));
    const lumbar = campo(contenedor, "Lumbar").querySelector("input");
    expect(lumbar.value).toBe("3:20");
    await escribir(lumbar, "3:25");
    await tocar(boton(contenedor, "Guardar la evaluación"));
    // Solo lo cambiado, con lo que se veía (paso 2 de «cargar sin señal…»).
    expect(datos.cambiadas).toEqual([{ id: "e4", cambios: { "datos.lumbar": 205 }, antes: { "datos.lumbar": 200 } }]);
    expect(document.body.textContent).toContain("Evaluación guardada.");
  });

  test("salir de una carga con algo escrito pide confirmación", async () => {
    await montar();
    // Sin nada cargado, «Cancelar» sale sin preguntar.
    await empezarCarga(contenedor);
    await tocar(boton(contenedor, "Atrás"));
    await tocar(boton(contenedor, "Cancelar"));
    expect(boton(contenedor, "Nueva evaluación")).toBeTruthy();
    await empezarCarga(contenedor);
    await elegirJugador(contenedor, 0, "ALFA");
    await irA(contenedor, "Base");
    expect(document.body.textContent).toContain("¿Salir sin guardar?");
    await tocar(boton(contenedor, "Sí, salir"));
    expect(contenedor.querySelector(".evaluaciones-tabla")).not.toBeNull();
  });

  test("se edita en la tabla: un tiempo en minutos y segundos se guarda en segundos", async () => {
    await montar();
    await irA(contenedor, "Base");
    const lumbar = () => celda(contenedor, 1, "Lumbar");
    await tocar(lumbar());
    await tocar(lumbar());
    const input = lumbar().querySelector("input");
    expect(input.value).toBe("2:30");
    await escribir(input, "2:40");
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(datos.cambiadas).toEqual([{ id: "e2", cambios: { "datos.lumbar": 160 }, antes: { "datos.lumbar": 150 } }]);
    expect(lumbar().textContent).toBe("2:40");
    // Pegar una categoría como la escribe el Excel («Sub-20», «Mayor») vale,
    // aunque en Datos básicos se llame distinto (18/10).
    await tocar(celda(contenedor, 0, "Seleccion"));
    const evento = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(evento, "clipboardData", { value: { getData: () => "Sub-20\nMayor" } });
    await act(async () => contenedor.querySelector(".tabla-datos-marco").dispatchEvent(evento));
    // La de e2 ya era «Mayor»: no hay nada que guardar.
    expect(datos.cambiadas.slice(1).map((una) => [una.id, una.cambios])).toEqual([["e1", { "datos.seleccion": "sub20" }]]);
  });

  test("dos celdas de la misma fila guardadas seguidas, con la conexión lenta: no se pisan", async () => {
    await montar();
    await irA(contenedor, "Base");
    let abrir;
    datos.compuerta = new Promise((resolver) => {
      abrir = resolver;
    });
    const editar = async (titulo, valor) => {
      const td = () => celda(contenedor, 1, titulo);
      await tocar(td());
      await tocar(td());
      const input = td().querySelector("input");
      await escribir(input, valor);
      await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    };
    await editar("Lumbar", "2:40");
    await editar("Lateral D", "1,30");
    await act(async () => abrir());
    await act(async () => Promise.resolve());
    // Cada una manda solo su celda; la segunda sale de lo que dejó la primera.
    expect(datos.cambiadas.map((una) => una.cambios)).toEqual([{ "datos.lumbar": 160 }, { "datos.lateral_d": 90 }]);
    expect(datos.evaluaciones.find((una) => una.id === "e2").datos).toEqual({ seleccion: "mayor", lumbar: 160, lateral_d: 90 });
    expect(celda(contenedor, 1, "Lumbar").textContent).toBe("2:40");
    expect(celda(contenedor, 1, "Lateral D").textContent).toBe("1:30");
  });

  // Paso 2 de «cargar sin señal y a la vez que otra persona» (Santiago, 20/10:
  // «Se juntan; si es la misma celda, aviso»; 21/10: «Gana el último, con
  // aviso»; una fila que otro borró, «Queda borrada y te aviso»). La otra
  // persona cambia la base sin que esta pantalla se entere.
  const editarLumbarDeBeta = async () => {
    const td = () => celda(contenedor, 1, "Lumbar");
    await tocar(td());
    await tocar(td());
    const input = td().querySelector("input");
    await escribir(input, "2:40");
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  };
  const otraPersonaCambia = (cambio) => {
    datos.evaluaciones = datos.evaluaciones.map((una) => (una.id === "e2" ? { ...una, datos: { ...una.datos, ...cambio } } : una));
  };

  test("dos personas cambian celdas distintas de la misma fila a la vez: quedan las dos", async () => {
    await montar();
    await irA(contenedor, "Base");
    otraPersonaCambia({ lateral_d: 95 });
    await editarLumbarDeBeta();
    expect(datos.cambiadas).toEqual([{ id: "e2", cambios: { "datos.lumbar": 160 }, antes: { "datos.lumbar": 150 } }]);
    expect(celda(contenedor, 1, "Lumbar").textContent).toBe("2:40");
    expect(celda(contenedor, 1, "Lateral D").textContent).toBe("1:35");
    expect(document.body.textContent).not.toContain("Otra persona había cambiado");
  });

  test("dos personas cambian la misma celda a la vez: gana el último y se le avisa", async () => {
    await montar();
    await irA(contenedor, "Base");
    otraPersonaCambia({ lumbar: 170 });
    await editarLumbarDeBeta();
    expect(celda(contenedor, 1, "Lumbar").textContent).toBe("2:40");
    expect(document.body.textContent).toContain("Otra persona había cambiado «Lumbar» mientras tanto: quedó lo tuyo.");
  });

  test("una fila que otra persona borró mientras tanto: queda borrada y se avisa", async () => {
    await montar();
    await irA(contenedor, "Base");
    datos.evaluaciones = datos.evaluaciones.filter((una) => una.id !== "e2");
    await editarLumbarDeBeta();
    expect(filas(contenedor)).toHaveLength(2);
    expect(document.body.textContent).toContain("Esa evaluación la borró otra persona: queda borrada.");
  });

  test("sin la actualización de la base: se guarda la fila entera, como antes", async () => {
    datos.sinCambiar = true;
    await montar();
    await irA(contenedor, "Base");
    await editarLumbarDeBeta();
    // Lo intenta y, como la base no tiene la función nueva, guarda la fila.
    expect(datos.cambiadas).toHaveLength(1);
    expect(datos.actualizadas.map((una) => [una.id, una.ev.datos])).toEqual([["e2", { seleccion: "mayor", lumbar: 160 }]]);
    expect(celda(contenedor, 1, "Lumbar").textContent).toBe("2:40");
  });

  test("borrar una fila pide confirmación", async () => {
    await montar();
    await irA(contenedor, "Base");
    await tocar(celda(contenedor, 1, "Lumbar"));
    await tocar(boton(contenedor, "Borrar fila"));
    expect(document.body.textContent).toContain("¿Borrar esta evaluación?");
    expect(document.body.textContent).toContain("La de BETA del 01/06/2026.");
    await tocar(boton(contenedor, "Sí, borrar"));
    expect(datos.borradas).toEqual(["e2"]);
    expect(filas(contenedor)).toHaveLength(2);
  });

  test("con varias filas elegidas (Shift), «Borrar fila» pregunta una vez y borra todas", async () => {
    await montar();
    await irA(contenedor, "Base");
    await tocar(celda(contenedor, 0, "Lumbar"));
    await act(async () => celda(contenedor, 1, "Lumbar").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true })));
    await tocar(boton(contenedor, "Borrar 2 filas"));
    expect(document.body.textContent).toContain("¿Borrar 2 evaluaciones?");
    await tocar(boton(contenedor, "Sí, borrar"));
    expect(datos.borradas).toHaveLength(2);
    expect(filas(contenedor)).toHaveLength(1);
    expect(document.body.textContent).toContain("2 evaluaciones borradas.");
  });

  test("Pegar desde Excel: se ve qué pasa con cada fila y se carga", async () => {
    await montar();
    await irA(contenedor, "Base");
    await tocar(boton(contenedor, "Pegar desde Excel"));
    const pegado = [
      "nº Eva\tFecha\tJugador\tSeleccion\tFecha Nac\tPosición\tLumbar\tL. Clas\t% mejora\tLateral D\tL.D. Clas\t% mejora\tLateral I\tL.I. Clas\t% mejora\tA\tDeficit Lateral %\tDeficit. Clas\tProno\tP. Clas\t% mejora\tRatio\tRatio. Clas\tVa\tPRO??\tNota",
      "1\t1-jun\tALFA\tMayor\t\t\t4:00\t5\t\t1:40\t4\t\t1:20\t3\t\t\t\t\t2:10\t3\t\t\t\t\t\t",
      "1\t2-jun\tBETA\tMayor\t\t\t3:10\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t",
    ].join("\n");
    await escribir(contenedor.querySelector(".datos-importar-pegado textarea"), pegado);
    expect(contenedor.textContent).toContain("2 filas en lo pegado");
    // Las fechas vienen sin año: se elige de qué año son.
    expect(contenedor.textContent).toContain("Las fechas vienen sin año");
    const anio = contenedor.querySelector(".evaluaciones-anio select");
    await act(async () => {
      anio.value = "2026";
      anio.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // La de ALFA del 01/06 ya está (mismo día y mismos tiempos).
    expect(contenedor.textContent).toContain("1 para cargar · 1 ya está en la app");
    await tocar(boton(contenedor, "Cargar 1 evaluación"));
    expect(datos.creadas).toEqual([{ equipoId: "eq-1", test: "zona_media", ev: { jugador_id: 2, persona: null, fecha: "2026-06-02", datos: { seleccion: "mayor", lumbar: 190 } } }]);
    expect(document.body.textContent).toContain("Listo: se cargó 1 evaluación.");
    expect(filas(contenedor)).toHaveLength(4);
  });

  // Regla 1 al pegar: BETA ya tiene la del 01/06 con otros tiempos.
  const pegarConElMismoDia = async () => {
    await montar();
    await irA(contenedor, "Base");
    await tocar(boton(contenedor, "Pegar desde Excel"));
    const pegado = ["nº Eva\tFecha\tJugador\tSeleccion\tLumbar\tNota", "1\t01/06/2026\tBETA\tMayor\t3:10\t", "1\t02/06/2026\tALFA\tMayor\t3:20\t"].join("\n");
    await escribir(contenedor.querySelector(".datos-importar-pegado textarea"), pegado);
    expect(contenedor.textContent).toContain("2 para cargar");
    await tocar(boton(contenedor, "Cargar 2 evaluaciones"));
  };

  test("Pegar, Regla 1: la de alguien que ese día ya tiene otra con otros datos pregunta; «Reemplazar y cargar» la cambia", async () => {
    await pegarConElMismoDia();
    expect(datos.deUnaVez).toHaveLength(0);
    const hoja = document.querySelector(".hoja-confirmar");
    expect(hoja.querySelector("h3").textContent).toBe("Esas evaluaciones ya están en la Base, con otros datos");
    expect(hoja.textContent).toContain("1 evaluación de lo pegado es de alguien que ese día ya tiene otra de Zona Media, con otros datos:");
    expect([...hoja.querySelectorAll(".consentimiento-personas li")].map((li) => li.textContent)).toEqual(["01/06/2026 · BETA"]);
    expect(document.activeElement.textContent).toBe("Ir a la Base");
    await tocar(boton(contenedor, "Reemplazar y cargar"));
    expect(datos.deUnaVez).toEqual([{ test: "zona_media", n: 2, reemplazar: true }]);
    expect(datos.evaluaciones.map((una) => una.id)).not.toContain("e2");
    expect(document.body.textContent).toContain("Listo: se cargaron 2 evaluaciones. Se reemplazó 1 evaluación que ya estaba.");
    expect(filas(contenedor)).toHaveLength(4);
  });

  test("Pegar, Regla 1, «Ir a la Base»: lo pegado espera, la Base muestra la que ya estaba y «Seguir con lo pegado» vuelve con todo", async () => {
    await pegarConElMismoDia();
    await tocar(boton(contenedor, "Ir a la Base"));
    expect(datos.deUnaVez).toHaveLength(0);
    expect(contenedor.querySelector(".evaluaciones-revisar").textContent).toContain("Estas son las evaluaciones de esos días que ya estaban. Lo pegado quedó en espera.");
    expect(filas(contenedor).map((tr) => tr.querySelectorAll("td")[columna(contenedor, "Jugador")].textContent)).toEqual(["BETA"]);
    await tocar(boton(contenedor, "Seguir con lo pegado"));
    expect(contenedor.textContent).toContain("2 para cargar");
    await tocar(boton(contenedor, "Cargar 2 evaluaciones"));
    expect(document.querySelector(".hoja-confirmar h3").textContent).toBe("Esas evaluaciones ya están en la Base, con otros datos");
    // Volver sin cargar: lo pegado deja de esperar.
    await act(async () => document.querySelector(".velo-dialogo").dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    await tocar(boton(contenedor, "Volver"));
    expect(contenedor.querySelector(".evaluaciones-revisar")).toBeNull();
    await tocar(boton(contenedor, "Pegar desde Excel"));
    expect(contenedor.querySelector(".datos-importar-pegado textarea").value).toBe("");
  });

  test("Pegar desde Excel: quien no está en Datos básicos se carga sin preguntar nada más (sin consentimiento: Santiago, 23/10)", async () => {
    await montar();
    await irA(contenedor, "Base");
    await tocar(boton(contenedor, "Pegar desde Excel"));
    const pegado = ["nº Eva\tFecha\tJugador\tSeleccion\tLumbar\tNota", "1\t02/06/2026\tNombre Nuevo\tMayor\t3:20\t"].join("\n");
    await escribir(contenedor.querySelector(".datos-importar-pegado textarea"), pegado);
    await tocar(boton(contenedor, "Guardar igual la que no está en Datos básicos"));
    await tocar(boton(contenedor, "Cargar 1 evaluación"));
    expect(document.querySelector(".hoja-confirmar")).toBeNull();
    expect(datos.creadas).toEqual([{ equipoId: "eq-1", test: "zona_media", ev: { jugador_id: null, persona: "Nombre Nuevo", fecha: "2026-06-02", datos: { seleccion: "mayor", lumbar: 200 } } }]);
  });

  test("Pegar desde Excel: si falla la recarga, lo cargado igual se ve como \"Ya está\" y no se carga dos veces", async () => {
    await montar();
    await irA(contenedor, "Base");
    await tocar(boton(contenedor, "Pegar desde Excel"));
    const pegado = [
      "nº Eva\tFecha\tJugador\tSeleccion\tLumbar\tNota",
      "1\t02/06/2026\tBETA\tMayor\t3:10\t",
      "1\t02/06/2026\tNombre Nuevo\tMayor\t3:20\t",
    ].join("\n");
    await escribir(contenedor.querySelector(".datos-importar-pegado textarea"), pegado);
    expect(contenedor.textContent).toContain("1 para cargar");
    datos.fallaLaProxima = "evaluaciones.error.noLeer";
    await tocar(boton(contenedor, "Cargar 1 evaluación"));
    expect(datos.creadas).toHaveLength(1);
    // Queda abierta (falta elegir un nombre) y lo cargado ya figura como cargado.
    expect(contenedor.textContent).toContain("1 ya está en la app");
    expect(boton(contenedor, "Nada para cargar")).toBeTruthy();
  });

  test("los valores de referencia, por categoría, y el resumen con la columna Pro vacía", async () => {
    await montar();
    await tocar([...contenedor.querySelectorAll(".navegacion-movil button")].find((b) => b.textContent.includes("Valores de referencia")));
    expect(contenedor.textContent).toContain("V.R. de prueba");
    expect(contenedor.textContent).toContain("Prueba");
    const [bloque, resumen] = contenedor.querySelectorAll("table.evaluaciones-vr");
    const filaDe = (tabla, rotulo) => [...tabla.querySelectorAll("tbody tr")].find((tr) => tr.querySelector("th").textContent === rotulo);
    expect([...filaDe(bloque, "Bueno").querySelectorAll("td")].map((td) => td.textContent)).toEqual(["3:00", "1:20", "1:20", "10,00", "2:00", "0,70"]);
    expect([...filaDe(bloque, "n").querySelectorAll("td")].map((td) => td.textContent)).toEqual(["10", "10", "10", "10", "10", "10"]);
    expect([...resumen.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Categoría", "n", "Lumbar", "Lateral D", "Lateral I", "Prono", "Ratio", "Def. Lat", "Pro"]);
    expect([...filaDe(resumen, "Mayor (profesional)").querySelectorAll("td")].map((td) => td.textContent)).toEqual(["12", "3:00", "1:20", "1:20", "2:00", "0,70", "10,00", ""]);
    expect([...filaDe(resumen, "Sub-15").querySelectorAll("td")].map((td) => td.textContent)).toEqual(["", "", "", "", "", "", "", ""]);
  });

  // Santiago, 14/10: «pero no puedo editar nada del vr»; una solapa en cada
  // base, «con volver atrás».
  const tablaVr = (indice) => contenedor.querySelectorAll("table.evaluaciones-vr")[indice];
  // Cada fila empieza con su rótulo; en el resumen, la cabecera de esa
  // columna también tiene título («Categoría»).
  const celdaVr = (tabla, fila, columna) => {
    const titulos = [...tabla.querySelectorAll("thead th")].map((th) => th.textContent);
    const tr = [...tabla.querySelectorAll("tbody tr")].find((una) => una.querySelector("th").textContent === fila);
    return tr.querySelectorAll("td")[titulos.indexOf(columna) - (tabla.querySelector("thead td") ? 0 : 1)];
  };
  const cambiarVr = async (td, valor, tecla = "Enter") => {
    await act(async () => td.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    const input = td.querySelector("input");
    await escribir(input, valor);
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: tecla, bubbles: true })));
  };

  test("los valores de referencia se cambian como en las bases: tiempos, números, el n del resumen; se agrega y se borra una categoría", async () => {
    await montar();
    await irA(contenedor, "Valores de referencia");
    expect(contenedor.textContent).toContain("Tocá dos veces un número para cambiarlo");
    // Un tiempo, como se ve (m:ss), y un número.
    await cambiarVr(celdaVr(tablaVr(0), "Bueno", "Lumbar"), "3:10");
    expect(datos.cambiosVr.at(-1)).toEqual({ test: "zona_media", ruta: ["categorias", "mayor", "bueno", "lumbar"], valor: 190 / 1440 });
    expect(celdaVr(tablaVr(0), "Bueno", "Lumbar").textContent).toBe("3:10");
    await cambiarVr(celdaVr(tablaVr(0), "Bueno", "Ratio"), "0,75");
    expect(datos.cambiosVr.at(-1)).toMatchObject({ ruta: ["categorias", "mayor", "bueno", "ratio"], valor: 0.75 });
    // El resumen: el n y el Bueno (es el mismo de la categoría); «Pro» no se cambia.
    await cambiarVr(celdaVr(tablaVr(1), "Mayor (profesional)", "n"), "15");
    expect(datos.cambiosVr.at(-1)).toMatchObject({ ruta: ["resumen", "n", "mayor"], valor: 15 });
    const pro = celdaVr(tablaVr(1), "Mayor (profesional)", "Pro");
    await act(async () => pro.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(pro.querySelector("input")).toBeNull();
    // Lo que no se entiende no se guarda.
    const cuantos = datos.cambiosVr.length;
    await cambiarVr(celdaVr(tablaVr(0), "Malo", "Prono"), "mucho");
    expect(contenedor.textContent).toContain("No se entiende «mucho»: no se cambió.");
    await act(async () => contenedor.querySelector(".evaluaciones-vr-entrada").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(datos.cambiosVr).toHaveLength(cuantos);
    // Una categoría nueva, vacía, para cargarla.
    const lista = contenedor.querySelector(".referencias-sumar-categoria select");
    await act(async () => {
      lista.value = "sub17";
      lista.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await tocar(boton(contenedor, "Agregar"));
    expect(datos.cambiosVr.at(-1)).toMatchObject({ ruta: ["categorias", "sub17"], valor: {} });
    expect([...contenedor.querySelectorAll(".evaluaciones-bloque h2")].map((h) => h.textContent)).toContain("Sub-17");
    // Borrar pregunta antes.
    await tocar(boton(contenedor, "Borrar Sub-17"));
    expect(document.body.textContent).toContain("Se borran los V.R. de Sub-17 de este test");
    await tocar(boton(document.body, "Sí, borrar"));
    expect(datos.cambiosVr.at(-1)).toMatchObject({ ruta: ["categorias", "sub17"], valor: null });
  });

  test("los valores de referencia: los últimos cambios y «Volver»; sin la actualización, solo se miran", async () => {
    const fila = (datosVr) => ({ id: "vr1", equipo_id: "eq-1", test: "zona_media", datos: datosVr });
    datos.historialVr = [
      {
        id: 2,
        tabla: "evaluaciones_referencias",
        filaId: "vr1",
        accion: "editada",
        quien: "pf@club.com",
        cuando: "2026-10-14T19:30:00Z",
        antes: fila({ categorias: { mayor: { bueno: { lumbar: 170 / 1440 } } } }),
        despues: fila({ categorias: { mayor: { bueno: { lumbar: 180 / 1440 } } } }),
      },
      { id: 1, tabla: "evaluaciones_referencias", filaId: "otro", accion: "editada", quien: "x@club.com", cuando: "2026-10-14T19:00:00Z", antes: { test: "saltos", datos: {} }, despues: { test: "saltos", datos: { resumen: { n: { mayor: 3 } } } } },
    ];
    await montar();
    await irA(contenedor, "Valores de referencia");
    const items = [...contenedor.querySelectorAll(".referencias-historial-lista > li")];
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("pf@club.com");
    expect(items[0].textContent).toContain("Mayor (profesional) · Bueno · Lumbar: 2:50 → 3:00");
    await tocar([...items[0].querySelectorAll("button")].find((b) => b.textContent === "Volver"));
    expect(datos.cambiosVr.at(-1)).toEqual({ test: "zona_media", ruta: ["categorias", "mayor", "bueno", "lumbar"], valor: 170 / 1440 });
    expect(document.body.textContent).toContain("Listo: quedó como estaba.");
    act(() => raiz.unmount());

    datos.faltaHistorial = true;
    await montar();
    await irA(contenedor, "Valores de referencia");
    expect(contenedor.textContent).toContain("Para cambiar los V.R. falta una actualización de la base de datos.");
    const td = celdaVr(tablaVr(0), "Bueno", "Lumbar");
    await act(async () => td.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(td.querySelector("input")).toBeNull();
    expect(contenedor.querySelector(".referencias-historial")).toBeNull();
    expect(contenedor.querySelector(".referencias-sumar-categoria")).toBeNull();
  });

  test("Valores de referencia › «Calcular con la planilla»: la categoría, la muestra con su Selección, el V.R. en el bloque y «Recalcular»", async () => {
    // Todo inventado: diez de Mayor y dos de Sub-20 (en segundos).
    const mas = [200, 215, 230, 190, 205, 220, 210, 600].map((lumbar, i) => evaluacion(`p${i}`, 10 + i, (i % 2) + 1, `2026-08-0${i + 1}`, { lumbar, lateral_d: 90 + i * 3, lateral_i: 85 + i * 4, prono: 120 + i * 5 }));
    const sub20 = [180, 170].map((lumbar, i) => evaluacion(`q${i}`, 30 + i, 1, "2026-08-20", { lumbar, lateral_d: 70, lateral_i: 75, prono: 100 }, {}));
    sub20.forEach((una) => (una.datos.seleccion = "sub20"));
    datos.evaluaciones = [...EVALUACIONES(), ...mas, ...sub20];
    await montar();
    await irA(contenedor, "Valores de referencia");
    await tocar(boton(contenedor, "Calcular con la planilla"));
    expect(contenedor.querySelector("h1").textContent).toBe("Calcular V.R. de Zona Media");
    // De entrada, la categoría que ya tiene V.R. y sus filas (las de esa Selección).
    const categoria = () => contenedor.querySelector("#planilla-vr-categoria");
    expect(categoria().value).toBe("mayor");
    const muestra = () => contenedor.querySelector(".planilla-vr-muestra").textContent;
    expect(muestra()).toContain("Muestra: 11 filas · 2 jugadores");
    await act(async () => {
      categoria().value = "sub20";
      categoria().dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(muestra()).toContain("Muestra: 2 filas · 1 jugador");
    await act(async () => {
      categoria().value = "mayor";
      categoria().dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(muestra()).toContain("Muestra: 11 filas");
    expect(contenedor.querySelector(".planilla-vr-medidas-barra").textContent).toContain("6 de 6 elegidas");
    // Sin Ratio: no va a estar en el V.R.
    await tocar(boton(contenedor, "Elegir variables"));
    const hojaVariables = () => document.body.querySelector(".planilla-vr-hoja-medidas");
    await tocar([...hojaVariables().querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent === "Ratio").querySelector("input"));
    await tocar([...hojaVariables().querySelectorAll("button")].find((b) => b.textContent === "Listo"));
    expect(contenedor.querySelector(".planilla-vr-medidas-barra").textContent).toContain("5 de 6 elegidas");
    await tocar(botones(contenedor).find((b) => b.textContent.trim().startsWith("Siguiente")));
    expect(contenedor.querySelector(".lesiones-encabezado p").textContent).toMatch(/^Mayor \(profesional\) · 11 filas · 2 jugadores/);
    // Las variables del test; los tiempos en minutos y segundos.
    expect([...contenedor.querySelectorAll(".planilla-vr-tabla tr[data-medida]")].map((tr) => tr.dataset.medida)).toEqual(["lumbar", "lateral_d", "lateral_i", "def_lat", "prono"]);
    const lumbar = () => contenedor.querySelector('.planilla-vr-tabla tr[data-medida="lumbar"]');
    [...lumbar().querySelectorAll("td.valor b")].forEach((b) => expect(b.textContent).toMatch(/^\d+:\d\d$/));
    // Los tiempos van en la unidad del Excel (días): sin la regla del promedio
    // de 1 o menos (Santiago, 19/10), el 10:00 queda afuera.
    expect(lumbar().querySelector("td.datos").textContent).toBe("10 de 11 · Ver 1 atípico");
    await tocar(boton(contenedor, "Guardar V.R."));
    // El bloque de Mayor: lo calculado, con el título que tenía; el n del resumen.
    const [bloque, resumen] = datos.cambiosVr.slice(-2);
    expect(bloque.ruta).toEqual(["categorias", "mayor"]);
    expect(bloque.valor.titulo).toBe("V.R. de prueba");
    expect(bloque.valor.n.lumbar).toBe(10);
    expect(bloque.valor.bueno.lumbar).toBeCloseTo((240 + 150 + 252 + 200 + 215 + 230 + 190 + 205 + 220 + 210) / 10 / 1440, 10);
    expect(bloque.valor.desvio.lumbar).toBeGreaterThan(0);
    expect(bloque.valor.promedio).toBeUndefined();
    // Solo las variables usadas (Santiago, 20/10): Ratio no queda, aunque
    // tenía; Def. Lat, sin datos suficientes, tampoco.
    expect(Object.keys(bloque.valor.bueno)).toEqual(["lumbar", "lateral_d", "lateral_i", "prono"]);
    expect(bloque.valor.planilla).toMatchObject({ version: 1, muestra: { seleccion: ["mayor"] }, filas: 11, calculado: hoyISO() });
    expect(resumen).toEqual({ test: "zona_media", ruta: ["resumen", "n", "mayor"], valor: 11 });
    expect(document.body.textContent).toContain("V.R. de Mayor (profesional) calculados.");
    // El bloque: n, el desvío y las cinco, sin Promedio (Zona Media no tenía fila de desvío).
    expect([...tablaVr(0).querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual(["n", "Desv. Estándar", "Excelente", "Muy Bueno", "Bueno", "Regular", "Malo"]);
    expect([...tablaVr(0).querySelectorAll("thead th")].map((th) => th.textContent).filter(Boolean)).toEqual(["Lumbar", "Lateral D", "Lateral I", "Prono"]);
    // Dice cuándo y con qué filas; «Recalcular» pregunta y usa la misma muestra.
    expect(contenedor.querySelector(".referencias-calculado").textContent).toBe(`Calculado el ${fechaCorta(hoyISO())} con 11 filas · Seleccion: Mayor (profesional)`);
    const cuantos = datos.cambiosVr.length;
    await tocar(boton(contenedor, "Recalcular"));
    const hoja = [...document.body.querySelectorAll(".hoja-confirmar, [role='dialog']")].find((una) => una.textContent.includes("¿Recalcular «Mayor (profesional)»?"));
    expect(hoja.textContent).toContain("11 filas (las mismas que la vez anterior)");
    await tocar([...hoja.querySelectorAll("button")].find((b) => b.textContent === "Recalcular"));
    expect(datos.cambiosVr.slice(cuantos).map((cambio) => cambio.ruta)).toEqual([["categorias", "mayor"], ["resumen", "n", "mayor"]]);
    expect(document.body.textContent).toContain("V.R. de Mayor (profesional) recalculados.");
  });

  test("Valores de referencia › un cálculo con la planilla es una línea en los últimos cambios y «Volver» deja el bloque como estaba", async () => {
    const fila = (datosVr) => ({ id: "vr1", equipo_id: "eq-1", test: "zona_media", datos: datosVr });
    const antes = { titulo: "V.R. de prueba", bueno: { lumbar: 180 / 1440 } };
    const despues = { titulo: "V.R. de prueba", bueno: { lumbar: 200 / 1440 }, malo: { lumbar: 150 / 1440 }, planilla: { version: 1, muestra: {}, medidas: {}, filas: 9, calculado: "2026-10-19" } };
    datos.historialVr = [
      { id: 3, tabla: "evaluaciones_referencias", filaId: "vr1", accion: "editada", quien: "pf@club.com", cuando: "2026-10-19T19:30:00Z", antes: fila({ categorias: { mayor: despues } }), despues: fila({ categorias: { mayor: { ...despues, planilla: { ...despues.planilla, filas: 10 } } } }) },
      { id: 2, tabla: "evaluaciones_referencias", filaId: "vr1", accion: "editada", quien: "pf@club.com", cuando: "2026-10-19T19:00:00Z", antes: fila({ categorias: { mayor: antes } }), despues: fila({ categorias: { mayor: despues } }) },
    ];
    await montar();
    await irA(contenedor, "Valores de referencia");
    const items = [...contenedor.querySelectorAll(".referencias-historial-lista > li")];
    expect(items.map((item) => item.querySelector("ul").textContent)).toEqual(["Recalculó Mayor (profesional)", "Calculó Mayor (profesional) con la planilla"]);
    await tocar([...items[1].querySelectorAll("button")].find((b) => b.textContent === "Volver"));
    expect(datos.cambiosVr).toEqual([{ test: "zona_media", ruta: ["categorias", "mayor"], valor: antes }]);
  });

  test("quien ya se fue del club ve todo y no cambia nada", async () => {
    datos.equipo = { id: "eq-1", nombre: "Club de Prueba", hasta: "2026-09-25" };
    await montar();
    expect(contenedor.querySelector(".aviso-solo-lectura")).not.toBeNull();
    expect(boton(contenedor, "Nueva evaluación")).toBeUndefined();
    await irA(contenedor, "Base");
    expect(boton(contenedor, "Pegar desde Excel")).toBeUndefined();
    expect(boton(contenedor, "Borrar fila")).toBeUndefined();
    expect(filas(contenedor)).toHaveLength(3);
  });

  test("con Evaluaciones en «Solo lectura» ve todo, también los cambios de los V.R., y no cambia nada", async () => {
    datos.equipo = { id: "eq-1", nombre: "Club de Prueba", hasta: null, evaluaciones: true, solo_lectura: ["evaluaciones"] };
    datos.historialVr = [
      {
        id: 2,
        tabla: "evaluaciones_referencias",
        filaId: "vr1",
        accion: "editada",
        quien: "pf@club.com",
        cuando: "2026-10-14T19:30:00Z",
        antes: { id: "vr1", equipo_id: "eq-1", test: "zona_media", datos: { categorias: { mayor: { bueno: { lumbar: 170 / 1440 } } } } },
        despues: { id: "vr1", equipo_id: "eq-1", test: "zona_media", datos: { categorias: { mayor: { bueno: { lumbar: 180 / 1440 } } } } },
      },
    ];
    await montar();
    expect(contenedor.textContent).toContain("Tenés Evaluaciones en solo lectura.");
    expect(boton(contenedor, "Nueva evaluación")).toBeUndefined();
    await irA(contenedor, "Base");
    expect(boton(contenedor, "Pegar desde Excel")).toBeUndefined();
    expect(boton(contenedor, "Borrar fila")).toBeUndefined();
    expect(filas(contenedor)).toHaveLength(3);

    await irA(contenedor, "Valores de referencia");
    const td = celdaVr(tablaVr(0), "Bueno", "Lumbar");
    await act(async () => td.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(td.querySelector("input")).toBeNull();
    // Los últimos cambios se ven, sin «Volver».
    const items = [...contenedor.querySelectorAll(".referencias-historial-lista > li")];
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("Mayor (profesional) · Bueno · Lumbar: 2:50 → 3:00");
    expect([...items[0].querySelectorAll("button")].find((b) => b.textContent === "Volver")).toBeUndefined();
    expect(contenedor.querySelector(".referencias-historial").textContent).toContain("Quién cambió qué y cuándo.");
    expect(contenedor.querySelector(".referencias-historial").textContent).not.toContain("«Volver»");
  });

  test("sin la migración, lo dice; y arriba se vuelve a Bases de Datos", async () => {
    datos.errorAlLeer = "evaluaciones.error.faltaMigracion";
    await montar();
    expect(contenedor.textContent).toContain("La base todavía no tiene Evaluaciones");
    await tocar(boton(contenedor, "Bases de Datos"));
    expect(volvio).toBe(1);
  });

  test("Reportes › Individual: arriba como la imagen; por área, las últimas 5 evaluaciones de cada test con todas las columnas", async () => {
    // ALFA, con siete evaluaciones de Zona Media.
    ["2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05", "2026-07-06"].forEach((fecha, i) => datos.evaluaciones.push(evaluacion(`x${i}`, 10 + i, 1, fecha, { lumbar: 200 + i })));
    await montar();
    await irA(contenedor, "Reportes");
    await tocar([...contenedor.querySelectorAll(".reporte-opcion")].find((b) => b.textContent.includes("Reporte individual")));
    // El plantel actual (GAMA ya no está y no tiene evaluaciones: no va).
    const lista = [...contenedor.querySelectorAll(".lesiones-lista-jugadores button")];
    expect(lista.map((b) => b.textContent)).toEqual(["ALFA7 evaluaciones", "BETA1 evaluación"]);
    await tocar(lista[0]);
    expect(contenedor.querySelector(".informe-cabecera h1").textContent).toBe("ALFA");
    expect(contenedor.querySelector(".informe-subtitulo").textContent).toBe("Club de Prueba · Performance");
    expect([...contenedor.querySelectorAll(".informe-dato")].map((dato) => dato.textContent)).toEqual(["CategoríaMayor (profesional)", "Última evaluación06/07/2026", "Nº evaluaciones7"]);
    expect([...contenedor.querySelectorAll(".evaluaciones-area-titulo")].map((h) => h.textContent)).toEqual(["Zona Media"]);
    const seccion = contenedor.querySelector(".evaluaciones-registros");
    expect(seccion.querySelector("h3").textContent).toBe('Evaluación Zona Media "CORE"');
    expect(seccion.querySelector("header p").textContent).toBe("7 evaluaciones: se ven 5; en cada fila elegís cuál");
    // Todas las columnas: el n° y la fecha en el desplegable; sin el nombre ni la fecha de nacimiento.
    const titulos = [...seccion.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(titulos.slice(0, 4)).toEqual(["nº Eva · Fecha", "Seleccion", "Lumbar", "L. Clas"]);
    expect(titulos.at(-1)).toBe("Nota");
    expect(titulos).not.toContain("Jugador");
    // Las últimas 5: de la 3 a la 7.
    const filasDeLaTabla = () => [...seccion.querySelectorAll("tbody tr")];
    const elegida = (tr) => tr.querySelector("select").selectedOptions[0].textContent;
    expect(filasDeLaTabla()).toHaveLength(5);
    expect(filasDeLaTabla().map(elegida)).toEqual(["3 · 02/07/2026", "4 · 03/07/2026", "5 · 04/07/2026", "6 · 05/07/2026", "7 · 06/07/2026"]);
    // En cada lugar se elige otra; las que ya están a la vista no se repiten.
    const primera = filasDeLaTabla()[0].querySelector("select");
    expect([...primera.options].map((opcion) => opcion.textContent)).toHaveLength(7);
    expect([...primera.options].filter((opcion) => opcion.disabled).map((opcion) => opcion.textContent)).toEqual(["4 · 03/07/2026", "5 · 04/07/2026", "6 · 05/07/2026", "7 · 06/07/2026"]);
    await act(async () => {
      primera.value = "e1";
      primera.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(elegida(filasDeLaTabla()[0])).toBe("1 · 01/06/2026");
    const celdas = filasDeLaTabla()[0].querySelectorAll("td");
    expect(celdas[titulos.indexOf("Lumbar")].textContent).toBe("4:00");
    // La clase, como en la Base: el número del color de su clase, sobre gris.
    expect(celdas[titulos.indexOf("L. Clas")].style.background).toBe("rgb(217, 217, 217)");
    expect(celdas[titulos.indexOf("L. Clas")].style.color).toBe("rgb(79, 98, 40)");
    expect(filasDeLaTabla()).toHaveLength(5);
  });

  test("Reportes › Grupal: un test por categoría y fechas", async () => {
    await montar();
    await irA(contenedor, "Reportes");
    await tocar([...contenedor.querySelectorAll(".reporte-opcion")].find((b) => b.textContent.includes("Reporte grupal")));
    expect(contenedor.querySelector(".informe-cabecera h1").textContent).toBe('Evaluación Zona Media "CORE"');
    expect(contenedor.querySelectorAll(".evaluaciones-informe-test tbody tr")).toHaveLength(3);
    const desde = contenedor.querySelector('.evaluaciones-reporte-campos input[type="date"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(desde, "2026-06-15");
      desde.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(contenedor.querySelectorAll(".evaluaciones-informe-test tbody tr")).toHaveLength(1);
    expect([...contenedor.querySelectorAll(".informe-dato")].map((dato) => dato.textContent)).toEqual(["CategoríaTodas", "Período15/06/2026 – …", "Evaluaciones1"]);
    const categoria = contenedor.querySelector(".evaluaciones-reporte-campos select");
    await act(async () => {
      categoria.value = "sub15";
      categoria.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(contenedor.textContent).toContain("No hay evaluaciones de este test con estos filtros.");
  });

  // Santiago, 15/10: «EN TODO EL SOFT DE PODER OCULTAR MANUALMENTE UN COLUMNA
  // Y FILAS»; «tiene que preguntarme si la quiero ocultar».
  test("Reportes › Grupal: tocar el jugador oculta su evaluación y tocar el nombre de una columna, la columna; el informe no cambia", async () => {
    await montar();
    await irA(contenedor, "Reportes");
    await tocar([...contenedor.querySelectorAll(".reporte-opcion")].find((b) => b.textContent.includes("Reporte grupal")));
    const informe = () => [...contenedor.querySelectorAll(".evaluaciones-informe-test thead tr.evaluaciones-informe-arriba")].map((tr) => tr.textContent);
    const filas = () => contenedor.querySelectorAll(".evaluaciones-informe-test tbody tr");
    const pregunta = () => document.body.querySelector(".hoja-confirmar h3")?.textContent;
    const confirmar = () => tocar(document.body.querySelector(".hoja-confirmar .boton-confirmar-hoja"));
    const antes = informe();
    expect(filas()).toHaveLength(3);
    // Una evaluación, tocando su jugador: pregunta; «Cancelar» la deja.
    await tocar(filas()[0].querySelector('td[data-columna="jugador"] .ocultar-al-tocar'));
    expect(pregunta()).toMatch(/^¿Ocultar «.+ · \d\d\/\d\d\/\d{4}»\?$/);
    await tocar(document.body.querySelector(".hoja-confirmar .boton-cancelar-hoja"));
    expect(filas()).toHaveLength(3);
    await tocar(filas()[0].querySelector('td[data-columna="jugador"] .ocultar-al-tocar'));
    await confirmar();
    expect(filas()).toHaveLength(2);
    // Los números de arriba siguen con las tres.
    expect(informe()).toEqual(antes);
    // Una columna, tocando su nombre: se va de las cabeceras, mientras se está en el reporte.
    const lumbar = [...contenedor.querySelectorAll('.evaluaciones-informe-test th[data-columna="lumbar"]')][0];
    await tocar(lumbar.querySelector(".ocultar-al-tocar"));
    expect(pregunta()).toContain("Lumbar");
    await confirmar();
    expect(contenedor.querySelector('.evaluaciones-informe-test th[data-columna="lumbar"]')).toBeNull();
    expect(localStorage.getItem("reporte_ocultas:evaluaciones-grupal:zona_media")).toBeNull();
    expect([...contenedor.querySelectorAll(".ocultar-arriba button")].map((b) => b.textContent)).toEqual(["Columnas1 oculta", "Filas1 oculta"]);
  });

  // Santiago, 13/10: «solo se puede cambiar el nombre de las absolutas y las
  // relativas pasan a tomar el nombre del absoluto pero dependiendo que sea se
  // le agrega /Min o /PC».
  test("Ajustes › Cabeceras: una relativa al peso toma el nombre de su absoluta con /PC y no se renombra", async () => {
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.textContent.includes("Cabeceras")));
    await elegirTest(contenedor, "Curl Nórdico e Isoprone");
    const fila = (texto) => [...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b").textContent === texto);
    // La absoluta se renombra; su relativa la sigue.
    await tocar(fila("L MÁX"));
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "Izq. máx.");
    await tocar(boton(contenedor, "Guardar"));
    expect(fila("Izq. máx./PC").textContent).toContain("Relativa: toma el nombre de «Izq. máx.» con /PC");
    await tocar(fila("Izq. máx./PC"));
    const nombre = document.body.querySelector(".lesiones-hoja input[type=text]");
    expect(nombre.disabled).toBe(true);
    expect(nombre.value).toBe("Izq. máx./PC");
    await tocar(boton(contenedor, "Guardar"));
    expect(datos.cabeceras.at(-1)).toMatchObject({ test: "curl_nordico_isoprone", campo: "curl_l_max_rel", etiquetas: {} });
    await irA(contenedor, "Base");
    expect(cabeceras(contenedor)).toContain("Izq. máx.");
    expect(cabeceras(contenedor)).toContain("Izq. máx./PC");
  });

  test("Ajustes › Cabeceras: «Para los V.R.» en lo que se carga con números o tiempos y en lo calculado con V.R.; un déficit arranca en «Menos es mejor»", async () => {
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.textContent.includes("Cabeceras")));
    const cabecera = (titulo) => tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b")?.textContent === titulo));
    const paraLosVr = () => document.body.querySelector(".lesiones-hoja .sentido-para-vr");
    const prendido = () => paraLosVr().querySelector(".chip-criterio.prendido").textContent;
    // Zona Media: un tiempo, sí; la Selección (una lista), no.
    await cabecera("Lumbar");
    expect(prendido()).toBe("Más es mejor");
    await tocar(boton(contenedor, "Cancelar"));
    await cabecera("Seleccion");
    expect(paraLosVr()).toBe(null);
    await tocar(boton(contenedor, "Cancelar"));
    // Movilidad de Tobillo: el déficit (calculado, con V.R.) arranca en
    // «Menos es mejor», como sus clases; se cambia y se guarda.
    await elegirTest(contenedor, "Movilidad de Tobillo");
    await cabecera("% DEFICIT LATERAL");
    expect(prendido()).toBe("Menos es mejor");
    await tocar([...paraLosVr().querySelectorAll(".chip-criterio")].find((b) => b.textContent === "Más es mejor"));
    await tocar(boton(contenedor, "Guardar"));
    expect(datos.cabeceras.at(-1)).toMatchObject({ test: "movilidad_tobillo", campo: "deficit", sentido: "mas" });
    await cabecera("% DEFICIT LATERAL");
    expect(prendido()).toBe("Más es mejor");
  });

  test("Ajustes: se renombra y se esconde una cabecera; las listas, por test y sin Selección (son las categorías de Datos básicos)", async () => {
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.textContent.includes("Cabeceras")));
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b").textContent === "Lumbar"));
    const nombre = document.body.querySelector(".lesiones-hoja input[type=text]");
    expect(nombre.value).toBe("Lumbar");
    await escribir(nombre, "Lumbar (min)");
    await tocar(boton(contenedor, "Guardar"));
    expect(datos.cabeceras).toEqual([{ equipoId: "eq-1", test: "zona_media", campo: "lumbar", etiquetas: { "es-AR": "Lumbar (min)", "pt-BR": "Lombar" }, oculto: false, orden: 5, sentido: "mas" }]);
    // Selección no se esconde: hace falta para clasificar.
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b").textContent === "Seleccion"));
    expect(document.body.textContent).toContain("Esta columna hace falta para cargar la evaluación: siempre se muestra.");
    await tocar(boton(contenedor, "Cancelar"));
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b").textContent === "Prono"));
    await tocar([...document.body.querySelectorAll(".lesiones-hoja .chip-criterio")].find((b) => b.textContent === "Oculta"));
    await tocar(boton(contenedor, "Guardar"));
    await irA(contenedor, "Base");
    expect(cabeceras(contenedor)).toContain("Lumbar (min)");
    expect(cabeceras(contenedor)).not.toContain("Prono");
    // Lo calculado con Prono sigue (el ratio no se esconde solo).
    expect(cabeceras(contenedor)).toContain("Ratio");

    // Listas: primero el test, solo los que tienen listas; Selección ya no
    // está (Santiago, 18/10: son las categorías de Datos básicos).
    await irA(contenedor, "Ajustes");
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.textContent.includes("Listas")));
    expect(contenedor.textContent).toContain("Las categorías (la Selección) son las de Datos básicos: se cambian en Datos básicos › Ajustes › Listas.");
    const elegirLista = contenedor.querySelector("select.evaluaciones-elegir-test-lista");
    expect([...elegirLista.options].map((opcion) => opcion.textContent)).toEqual(["Estabilidad rotacional", "Sentadilla Incremental"]);
    expect([...contenedor.querySelectorAll(".opcion-ajuste b")].map((b) => b.textContent)).toEqual(["Cifosis", "Inestabilidad", "Completa recorrido"]);
    await elegirTest(contenedor, "Sentadilla Incremental");
    expect([...contenedor.querySelectorAll(".opcion-ajuste b")].map((b) => b.textContent)).toEqual(["Dispositivo", "Medio", "Cuenta para el RM"]);
    // Una opción nueva en Medio.
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b").textContent === "Medio"));
    await tocar(boton(contenedor, "Agregar una opción"));
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "Hack");
    await tocar(boton(contenedor, "Guardar"));
    expect(datos.opciones).toHaveLength(1);
    expect(datos.opciones[0]).toMatchObject({ lista: "sentadilla_medio", etiquetas: { "es-AR": "Hack" }, orden: 3 });
    // Volver a las listas deja el mismo test.
    await tocar(boton(contenedor, "Volver a Listas"));
    expect(contenedor.querySelector("select.evaluaciones-elegir-test-lista").value).toBe("sentadilla_incremental");

    // Las categorías salen de Datos básicos, con los nombres del club, y
    // valen en la Base, el informe y la carga.
    datos.categorias = [
      { campo: "categoria", codigo: "profissional", etiqueta_es: "Primera", etiqueta_pt: "Profissional", oculto: false, orden: 0 },
      { campo: "categoria", codigo: "sub20", etiqueta_es: "Sub-20", etiqueta_pt: "Sub-20", oculto: false, orden: 1 },
      { campo: "categoria", codigo: "reserva_x", etiqueta_es: "Reserva", etiqueta_pt: "Reserva", oculto: false, orden: 2 },
    ];
    await act(async () => raiz.unmount());
    raiz = null;
    await montar();
    await irA(contenedor, "Base");
    expect(celda(contenedor, 0, "Seleccion").textContent).toBe("Primera");
    expect([...contenedor.querySelector(".evaluaciones-comparar select").options].map((opcion) => opcion.textContent)).toEqual(["Vs Primera", "Vs Sub 20", "Vs Reserva"]);
    // Las clases siguen contra los V.R. de esa categoría (es la misma).
    expect(celda(contenedor, 0, "L. Clas").textContent).toBe("5");
    // La carga, con los nombres del club, sin la columna escondida y con las categorías de Datos básicos.
    await irA(contenedor, "Cargar");
    await empezarCarga(contenedor);
    expect(titulosDeLaCarga(contenedor)).toEqual(["Jugador", "Seleccion", "Lumbar (min)", "Lateral D", "Lateral I", "Nota", ""]);
    await elegirJugador(contenedor, 0, "BETA");
    expect([...dato(contenedor, "BETA · Seleccion").options].map((opcion) => opcion.textContent)).toEqual(["—", "Primera", "Sub-20", "Reserva"]);
    expect(dato(contenedor, "BETA · Seleccion").value).toBe("sub20");
  });

  test("Curl Nórdico e Isoprone: en la Base, sus cuatro bloques; se carga por pasos con el peso del día al principio", async () => {
    const curl = (id, orden, jugador_id, fecha, extra) => ({ ...evaluacion(id, orden, jugador_id, fecha, {}), test: "curl_nordico_isoprone", datos: { seleccion: "mayor", ...extra } });
    datos.evaluaciones.push(curl("k1", 20, 1, "2026-06-01", { pc: 80, curl_l_max: 440, curl_r_max: 400 }));
    const V = (valor) => ({ curl_l_max_rel: valor, curl_r_max_rel: valor, curl_def_max: 0.1 });
    datos.referenciasCurl = {
      categorias: {
        mayor: { titulos: { curl: "V.R. de prueba Curl", iso: "V.R. de prueba Isoprone" }, n: { curl_l_max_rel: 9 }, excelente: V(6), muy_bueno: V(5.5), bueno: V(5), regular: V(4.5), malo: V(4) },
      },
    };
    await montar();
    await irA(contenedor, "Base");
    // El test se elige en un desplegable, no con un botón por test.
    expect([...contenedor.querySelector("select.evaluaciones-elegir-test-lista").options].map((opcion) => opcion.textContent)).toEqual([
      "Zona Media",
      "Curl Nórdico e Isoprone",
      "Isocinecia",
      "Movilidad de Tobillo",
      "Movilidad de Cadera",
      "Movilidad de Isquio",
      "Estabilidad rotacional",
      "Iso Aductor-Abductor",
      "Sentadilla Incremental",
      "Press Plano",
      "Salto Countermovement",
      "Salto Drop",
      "Salto Squat",
      "Salto Single Leg",
    ]);
    expect(botones(contenedor).some((b) => b.textContent === "Curl Nórdico e Isoprone")).toBe(false);
    await elegirTest(contenedor, "Curl Nórdico e Isoprone");
    expect(contenedor.querySelector("h1").textContent).toBe("Curl Nórdico e Isoprone");
    expect([...contenedor.querySelectorAll(".tabla-datos-grupo-titulo")].map((titulo) => titulo.textContent).filter(Boolean)).toEqual([
      "Curl Nórdico · Máxima",
      "Curl Nórdico · Media",
      "Isoprone · Máxima",
      "Isoprone · Media",
    ]);
    expect(cabeceras(contenedor).slice(0, 8)).toEqual(["Jugador", "Fecha", "Evaluacion", "Seleccion", "P.C.", "L MÁX", "L MÁX/PC", "Clas L"]);
    expect(cabeceras(contenedor)).not.toContain("% mejora L + R");
    expect(filas(contenedor)).toHaveLength(1);
    expect(celda(contenedor, 0, "L MÁX/PC").textContent).toBe("5,50");
    expect(celda(contenedor, 0, "Clas L").textContent).toBe("4");
    expect(celda(contenedor, 0, "Deficit MAX %").textContent).toBe("10,0%");
    expect(celda(contenedor, 0, "Deficit Pierna").textContent).toBe("PD");
    // El informe: cuántas PD hay, con su rótulo.
    const promedios = filaDeArriba(contenedor, "Promedio");
    expect(celdaDeArriba(contenedor, promedios, "L MÁX/PC").textContent).toBe("5,5");
    expect(celdaDeArriba(contenedor, promedios, "Deficit Pierna").textContent).toBe("PD 1,0");

    // Los valores de referencia: una tabla por evaluación.
    await irA(contenedor, "Valores de referencia");
    expect([...contenedor.querySelectorAll(".evaluaciones-bloque h2")].map((h) => h.textContent)).toEqual(["V.R. de prueba Curl", "V.R. de prueba Isoprone"]);

    // Se carga una fila por jugador: el peso del día después de la Selección; cada bloque con su título arriba.
    await irA(contenedor, "Cargar");
    await empezarCarga(contenedor, "Curl Nórdico e Isoprone");
    expect(titulosDeLaCarga(contenedor)).toEqual([
      "Jugador",
      "Seleccion",
      "P.C.",
      "Curl Nórdico · Máxima",
      "Curl Nórdico · Media",
      "Isoprone · Máxima",
      "Isoprone · Media",
      "",
      "L MÁX",
      "R MÁX",
      "L MED.",
      "R MED.",
      "L MÁX",
      "R MÁX",
      "L MED.",
      "R MED.",
    ]);
    await elegirJugador(contenedor, 0, "ALFA");
    await escribir(dato(contenedor, "ALFA · P.C."), "80,5");
    await escribir(dato(contenedor, "ALFA · Curl Nórdico · Máxima · L MÁX"), "402");
    await escribir(dato(contenedor, "ALFA · Curl Nórdico · Máxima · R MÁX"), "x");
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(contenedor.textContent).toContain("ALFA: «x» no es un número en R MÁX.");
    await escribir(dato(contenedor, "ALFA · Curl Nórdico · Máxima · R MÁX"), "398");
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(datos.creadas).toEqual([{ equipoId: "eq-1", test: "curl_nordico_isoprone", ev: { jugador_id: 1, persona: null, fecha: hoyISO(), datos: { seleccion: "mayor", pc: 80.5, curl_l_max: 402, curl_r_max: 398 } } }]);
  });

  test("Isocinecia: en la Base se elige la velocidad; se carga por medida, con extensión y flexión juntas", async () => {
    const iso = (id, orden, jugador_id, fecha, extra) => ({ ...evaluacion(id, orden, jugador_id, fecha, {}), test: "isocinecia", datos: { seleccion: "mayor", ...extra } });
    datos.evaluaciones.push(iso("s1", 30, 1, "2026-06-01", { pc: 80, v60_peak_ext_pd: 300, v60_peak_ext_pi: 270, v180_rom_pd: 140, v180_rom_pi: 140 }));
    const V = (valor) => ({ v60_peak_ext_pd: valor, v60_peak_ext_pi: valor });
    datos.referenciasIso = {
      categorias: {
        mayor: { titulos: { v60: "V.R. de prueba 60", v180: "V.R. de prueba 180", v300: "V.R. de prueba 300" }, n: { v60_peak_ext_pd: 9 }, excelente: V(300), muy_bueno: V(270), bueno: V(240), regular: V(210), malo: V(180) },
      },
    };
    await montar();
    await irA(contenedor, "Base");
    await elegirTest(contenedor, "Isocinecia");
    expect(contenedor.querySelector("h1").textContent).toBe("Isocinecia");
    // Al entrar, 60°: las comunes y las de esa velocidad (como los botones del Excel).
    const velocidad = contenedor.querySelector("select.evaluaciones-elegir-vista-lista");
    expect([...velocidad.options].map((opcion) => opcion.textContent)).toEqual(["60°", "180°", "300°", "Todas"]);
    expect(velocidad.value).toBe("v60");
    expect(cabeceras(contenedor)).toHaveLength(5 + 87);
    expect(cabeceras(contenedor).slice(0, 9)).toEqual(["Jugador", "Fecha", "Nº Evaluacion", "Seleccion", "P.C.", "PD", "Clas PD", "% Mejora PD", "PI"]);
    expect([...contenedor.querySelectorAll(".tabla-datos-grupo-titulo")].map((titulo) => titulo.textContent).filter(Boolean).slice(0, 4)).toEqual([
      "Peak TQ/BW 60° · Extensión",
      "Peak TQ/BW 60° · Flexión",
      "Peak TQ/BW 60° · Flexión/Extensión",
      "Work/BW 60° · Extensión",
    ]);
    expect(celda(contenedor, 0, "Clas PD").textContent).toBe("5");
    expect(celda(contenedor, 0, "% Deficit").textContent).toBe("11,1%");
    expect(celda(contenedor, 0, "Deficit Pierna").textContent).toBe("PI");
    // El informe: el N° cuenta datos; las cuentas de PD / PI con su rótulo.
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Desvío"), "Deficit Pierna").textContent).toBe("PI 1,0");
    // 180°: otra velocidad, la misma fila.
    await act(async () => {
      velocidad.value = "v180";
      velocidad.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(cabeceras(contenedor)).toHaveLength(5 + 87);
    expect([...contenedor.querySelectorAll(".tabla-datos-grupo-titulo")].map((titulo) => titulo.textContent).filter(Boolean)[0]).toBe("Peak TQ/BW 180° · Extensión");
    expect(celda(contenedor, 0, "Clas PD").textContent).toBe("");

    // Los valores de referencia: una tabla por velocidad.
    await irA(contenedor, "Valores de referencia");
    await elegirTest(contenedor, "Isocinecia");
    expect([...contenedor.querySelectorAll(".evaluaciones-bloque h2")].map((h) => h.textContent)).toEqual(["V.R. de prueba 60", "V.R. de prueba 180", "V.R. de prueba 300"]);

    // No se carga a mano: sale del PDF del equipo (Santiago, 09/10). Desde el
    // 23/10 («Leer el PDF en Cargar»), en Cargar está y, si es el que se mira
    // en la Base, Cargar empieza con él y pide los PDF (no la fila por jugador).
    await irA(contenedor, "Base");
    await elegirTest(contenedor, "Isocinecia");
    await irA(contenedor, "Cargar");
    await tocar(boton(contenedor, "Nueva evaluación"));
    const deLaCarga = contenedor.querySelector("select.evaluaciones-elegir-test-lista");
    expect([...deLaCarga.options].map((opcion) => opcion.textContent)).toEqual([
      "Zona Media",
      "Curl Nórdico e Isoprone",
      "Isocinecia",
      "Movilidad de Tobillo",
      "Movilidad de Cadera",
      "Movilidad de Isquio",
      "Estabilidad rotacional",
      "Iso Aductor-Abductor",
      "Sentadilla Incremental",
      "Press Plano",
      "Salto Countermovement",
      "Salto Drop",
      "Salto Squat",
      "Salto Single Leg",
    ]);
    expect(deLaCarga.value).toBe("isocinecia");
    expect(contenedor.querySelector(".lesiones-paso-titulo h2").textContent).toBe("Test y PDF");
    expect(contenedor.querySelector(".evaluaciones-pdf-elegir").textContent).toBe("Elegir PDF");
    // Otro test: la fila por jugador de siempre.
    await elegirOpcion(deLaCarga, "Zona Media");
    expect(contenedor.querySelector(".lesiones-paso-titulo h2").textContent).toBe("Test y fecha");
  });

  test("Isocinecia con PDF: varios a la vez, una tarjeta por PDF para revisar y una evaluación por PDF, con su fecha", async () => {
    await montar();
    await irA(contenedor, "Base");
    await elegirTest(contenedor, "Isocinecia");
    await irA(contenedor, "Cargar");
    await tocar(boton(contenedor, "Nueva evaluación"));
    expect(boton(contenedor, "Siguiente").disabled).toBe(true);
    const archivos = [
      new File([pdfDePrueba({ nombre: "Alfa" })], "alfa.pdf", { type: "application/pdf" }),
      new File([pdfDePrueba({ nombre: "Otro Nombre", sesion: "6/24/2026 4:17:53 PM", involucrada: "Right", peso: "70.5" })], "otro.pdf", { type: "application/pdf" }),
      new File([new TextEncoder().encode("no es un pdf")], "nota.pdf", { type: "application/pdf" }),
    ];
    const elegir = contenedor.querySelector(".evaluaciones-pdf-archivo");
    await act(async () => {
      Object.defineProperty(elegir, "files", { value: archivos, configurable: true });
      elegir.dispatchEvent(new Event("change", { bubbles: true }));
    });
    for (let vuelta = 0; vuelta < 20 && contenedor.querySelector(".evaluaciones-pdf-tarjeta[aria-busy]"); vuelta += 1) {
      await act(async () => new Promise((listo) => setTimeout(listo, 5)));
    }
    expect(contenedor.querySelector(".lesiones-paso-titulo h2").textContent).toBe("Revisar lo leído");
    const tarjetas = [...contenedor.querySelectorAll(".evaluaciones-pdf-tarjeta")];
    expect(tarjetas).toHaveLength(3);
    // El primero: el jugador por el nombre del PDF, la fecha y el peso del PDF,
    // la Selección de Datos básicos y Peak TQ/BW de cada velocidad.
    expect(tarjetas[0].querySelector(".evaluaciones-varios-jugador").textContent).toBe("ALFA");
    expect(tarjetas[0].querySelector(".evaluaciones-pdf-archivo-nombre").textContent).toBe("En el PDF: Alfa · alfa.pdf");
    expect(tarjetas[0].querySelector('input[type="date"]').value).toBe("2026-07-22");
    expect(tarjetas[0].querySelector("select").value).toBe("mayor");
    expect(tarjetas[0].querySelector(".evaluaciones-pdf-peso b").textContent).toBe("80,0");
    expect([...tarjetas[0].querySelectorAll(".evaluaciones-pdf-tabla tbody tr")].map((fila) => fila.textContent)).toEqual([
      "Peak TQ/BW111,5112,5113,5114,5",
      "Peak TQ/BW211,5212,5213,5214,5",
      "Peak TQ/BW311,5312,5313,5314,5",
    ]);
    // «Ver todo»: las cinco medidas de cada velocidad.
    await tocar(tarjetas[0].querySelector(".evaluaciones-pdf-ver"));
    expect(tarjetas[0].querySelectorAll(".evaluaciones-pdf-tabla tbody tr")).toHaveLength(15);
    // El segundo: ese nombre no está en Datos básicos, se elige.
    expect(tarjetas[1].textContent).toContain("«Otro Nombre» no está en Datos básicos: elegí el jugador.");
    // El tercero no es el informe.
    expect(tarjetas[2].textContent).toContain("No es un PDF.");
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(contenedor.textContent).toContain("Falta elegir el jugador del PDF otro.pdf.");
    expect(datos.creadas).toHaveLength(0);
    await tocar(tarjetas[1].querySelector(".evaluaciones-varios-jugador"));
    await elegirEnLaHoja("BETA");
    expect(tarjetas[1].querySelector("select").value).toBe("sub20");
    await tocar(boton(contenedor, "Guardar 2 evaluaciones"));
    expect(datos.creadas.map(({ test, ev }) => [test, ev.jugador_id, ev.fecha, ev.datos.seleccion, ev.datos.pc, ev.datos.v60_peak_ext_pd, ev.datos.v300_rom_pi, Object.keys(ev.datos).length])).toEqual([
      ["isocinecia", 1, "2026-07-22", "mayor", 80, 111.5, 352.5, 56],
      ["isocinecia", 2, "2026-06-24", "sub20", 70.5, 111.5, 352.5, 56],
    ]);
    expect(document.body.textContent).toContain("2 evaluaciones guardadas.");
  });

  test("Isocinecia de hoy (pegada desde el Excel): en Cargar se ve y se borra, pero se corrige en la Base", async () => {
    datos.evaluaciones.push({ ...evaluacion("s2", 31, 2, hoyISO(), {}), test: "isocinecia", datos: { seleccion: "mayor", v60_rom_pd: 140 }, creado_en: new Date().toISOString() });
    await montar();
    const tarjeta = [...contenedor.querySelectorAll(".evaluaciones-registro")].find((una) => una.textContent.includes("Isocinecia"));
    expect(tarjeta).toBeTruthy();
    expect([...tarjeta.querySelectorAll("button")].some((b) => b.textContent === "Editar")).toBe(false);
    expect(tarjeta.querySelector(".boton-eliminar-registro")).not.toBeNull();
  });

  test("Funcional: Movilidad de Tobillo con la comparación «Vs …»; Estabilidad rotacional sin V.R. y con sus listas por pasos", async () => {
    const funcional = (id, orden, jugador_id, fecha, test, extra) => ({ ...evaluacion(id, orden, jugador_id, fecha, {}), test, datos: { seleccion: "mayor", ...extra } });
    datos.evaluaciones.push(funcional("t1", 40, 1, "2026-06-23", "movilidad_tobillo", { pd: 40, pi: 44 }));
    datos.evaluaciones.push(funcional("r1", 41, 1, "2026-06-24", "estabilidad_rotacional", { cifosis_derecha_derecha: "baja", inestabilidad_derecha: "si" }));
    datos.evaluaciones.push(funcional("r2", 42, 2, "2026-06-24", "estabilidad_rotacional", { cifosis_derecha_derecha: "no", inestabilidad_derecha: "no" }));
    const V = (medida, deficit) => ({ pd: medida, pi: medida, deficit });
    datos.referenciasTobillo = {
      categorias: { mayor: { titulo: "V.R. de prueba Tobillo", n: { pd: 9 }, excelente: V(45, 0.02), muy_bueno: V(42, 0.05), bueno: V(38, 0.08), regular: V(33, 0.12), malo: V(31, 0.2) } },
    };
    await montar();
    await irA(contenedor, "Base");
    await elegirTest(contenedor, "Movilidad de Tobillo");
    expect(contenedor.querySelector("h1").textContent).toBe("Movilidad de Tobillo");
    expect(cabeceras(contenedor)).toEqual([
      "Jugador",
      "Fecha",
      "Evaluacion",
      "Fecha Nac",
      "Seleccion",
      "PD",
      "PD Clas",
      "% Mejora PD",
      "PI",
      "PI Clas",
      "% Mejora PI",
      "% DEFICIT LATERAL",
      "Clas. Dif. Cm",
      "Deficit Pierna",
    ]);
    expect(celda(contenedor, 0, "PD Clas").textContent).toBe("3");
    expect(celda(contenedor, 0, "% DEFICIT LATERAL").textContent).toBe("10,0%");
    expect(celda(contenedor, 0, "Deficit Pierna").textContent).toBe("PD");
    // La comparación con los V.R., como en Zona Media: el promedio sobre el Bueno.
    expect(contenedor.textContent).not.toContain("Todavía no están los valores de referencia");
    const comparacion = filaDeArriba(contenedor, "Comparar con");
    expect(comparacion.querySelector("select").value).toBe("mayor");
    expect(celdaDeArriba(contenedor, comparacion, "PD").textContent).toBe("105,26%");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Promedio"), "Deficit Pierna").textContent).toBe("PD 1,0");

    // Estabilidad rotacional: sin V.R. (no avisa que faltan), dos bloques y qué parte tiene cada opción.
    await elegirTest(contenedor, "Estabilidad rotacional");
    expect(contenedor.textContent).not.toContain("Todavía no están los valores de referencia");
    expect([...contenedor.querySelectorAll(".tabla-datos-grupo-titulo")].map((titulo) => titulo.textContent).filter(Boolean)).toEqual(["Pierna derecha en apoyo", "Pierna izquierda en apoyo"]);
    expect(filas(contenedor)).toHaveLength(2);
    expect(celda(contenedor, 0, "Cifosis Derecha").textContent).toBe("BAJA");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "N°"), "Inestabilidad").textContent).toBe("2");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "%"), "Cifosis Derecha").textContent).toBe("Baja 50,0%");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "%"), "Inestabilidad").textContent).toBe("SI 50,0%");
    await irA(contenedor, "Valores de referencia");
    expect(contenedor.textContent).toContain("Este test no tiene valores de referencia");
    expect(contenedor.textContent).not.toContain("Todavía no están los valores de referencia");

    // Se carga una fila por jugador: cada pierna en apoyo es un bloque, con sus listas.
    await irA(contenedor, "Cargar");
    await empezarCarga(contenedor, "Estabilidad rotacional");
    expect(titulosDeLaCarga(contenedor).slice(0, 5)).toEqual(["Jugador", "Seleccion", "Pierna derecha en apoyo", "Pierna izquierda en apoyo", ""]);
    await elegirJugador(contenedor, 0, "ALFA");
    await elegirOpcion(dato(contenedor, "ALFA · Pierna derecha en apoyo · Cifosis Derecha"), "ALTA Y BAJA");
    await elegirOpcion(dato(contenedor, "ALFA · Pierna izquierda en apoyo · Completa recorrido"), "NO 1 y 2");
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(datos.creadas).toEqual([
      {
        equipoId: "eq-1",
        test: "estabilidad_rotacional",
        ev: { jugador_id: 1, persona: null, fecha: hoyISO(), datos: { seleccion: "mayor", cifosis_derecha_derecha: "alta_y_baja", completa_recorrido_izquierda: "no_1_y_2" } },
      },
    ]);
  });

  test("Iso Aductor-Abductor: dos bloques y el ratio, con la comparación «Vs …» y los V.R. del ratio con los nombres del Excel", async () => {
    datos.evaluaciones.push({
      ...evaluacion("a1", 50, 1, "2026-06-27", {}),
      test: "iso_aductor_abductor",
      datos: { seleccion: "mayor", pc: 80, ad_pd: 240, ad_pi: 216, ab_pd: 200, ab_pi: 200 },
    });
    const V = (rel, deficit, ratio) => ({ ad_pd_rel: rel, ad_pi_rel: rel, ad_deficit: deficit, ab_pd_rel: rel, ab_pi_rel: rel, ab_deficit: deficit, ratio_pd: ratio, ratio_pi: ratio });
    datos.referenciasAductor = {
      categorias: {
        mayor: {
          titulos: { aductor: "V.R. de prueba Aductor", abductor: "V.R. de prueba Abductor", ratio: "V.R. de prueba Ratio" },
          n: { ad_pd_rel: 9 },
          excelente: V(3.5, 0.02, 1.15),
          muy_bueno: V(3, 0.05, 1.07),
          bueno: V(2.5, 0.08, 1),
          regular: V(2, 0.12, 0.92),
          malo: V(1.8, 0.2, 0.83),
        },
      },
    };
    await montar();
    await irA(contenedor, "Base");
    await elegirTest(contenedor, "Iso Aductor-Abductor");
    expect(contenedor.querySelector("h1").textContent).toBe("Aductor y Abductor");
    expect([...contenedor.querySelectorAll(".tabla-datos-grupo-titulo")].map((titulo) => titulo.textContent).filter(Boolean)).toEqual(["ADUCTORES", "ABDUCTORES", "Ratio Aductor / Abductor"]);
    expect(cabeceras(contenedor).slice(0, 8)).toEqual(["Jugador", "Seleccion", "F.N.", "Evaluación", "Fecha", "P.C.", "PD (ABS)", "PD (ABS)/PC"]);
    expect(cabeceras(contenedor)).not.toContain("Grados");
    expect(celda(contenedor, 0, "PD (ABS)/PC").textContent).toBe("3,0");
    expect(celda(contenedor, 0, "Ant/Ago PD").textContent).toBe("1,20");
    expect(celda(contenedor, 0, "Clas Ratio PD").textContent).toBe("1");
    const comparacion = filaDeArriba(contenedor, "Comparar con");
    expect(celdaDeArriba(contenedor, comparacion, "Ant/Ago PD").textContent).toBe("120,00%");
    // Las cuentas de la pierna van en Promedios (PD), Desvíos (PI) y Mínimo (Sin Deficit), como en el Excel.
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Desvíos"), "DEFICIT PIERNA").textContent).toBe("PI 1,0");
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Mínimo"), "DEFICIT PIERNA").textContent).toBe("Sin Deficit 0,0");

    // Los V.R.: tres tablas; la del ratio, con los nombres del Excel.
    await irA(contenedor, "Valores de referencia");
    expect([...contenedor.querySelectorAll(".evaluaciones-bloque h2")].map((h) => h.textContent)).toEqual(["V.R. de prueba Aductor", "V.R. de prueba Abductor", "V.R. de prueba Ratio"]);
    const ratio = [...contenedor.querySelectorAll(".evaluaciones-bloque")][2];
    expect([...ratio.querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual(["n", "Promedio", "Desv. Estándar", "Malo", "Regular", "Bueno", "Regular", "Malo"]);
    const aductor = [...contenedor.querySelectorAll(".evaluaciones-bloque")][0];
    expect([...aductor.querySelectorAll("tbody th")].map((th) => th.textContent).slice(3)).toEqual(["Excelente", "Muy Bueno", "Bueno", "Regular", "Malo"]);
  });

  test("Sentadilla Incremental: cinco series, el RM IND con su clase, el resumen de V.R. sin «Pro» y la carga por series", async () => {
    datos.evaluaciones.push({
      ...evaluacion("si1", 60, 1, "2026-06-27", {}),
      test: "sentadilla_incremental",
      datos: { seleccion: "mayor", dispositivo: "vitruve", medio: "agachamento_trap", pc: 80, kg_1: 20, pse_1: 0, kg_2: 40, pse_2: 2, kg_3: 60, pse_3: 4, cuenta_3: "no", rm_vel: 240 },
    });
    const V = (rm, rel) => ({ rm_ind: rm, rel, rm_vel: rm, rel_vel: rel });
    datos.referenciasSentadilla = {
      categorias: {
        sub15: { titulo: "V.R. de prueba Sub 15", n: { pc: 9, rel: 9 }, excelente: { pc: 70, rel: 1 }, muy_bueno: { pc: 65, rel: 0.9 }, bueno: { pc: 60, rel: 0.8 }, regular: { pc: 55, rel: 0.7 }, malo: { pc: 50, rel: 0.6 } },
        mayor: { n: { rm_ind: 9, rel: 9 }, excelente: V(320, 3.6), muy_bueno: V(290, 3.3), bueno: V(260, 3), regular: V(230, 2.7), malo: V(200, 2.4), desvio: { rel_vel: 0.3 } },
      },
      resumen: { n: { sub15: 9, mayor: 9 } },
    };
    await montar();
    await irA(contenedor, "Base");
    await elegirTest(contenedor, "Sentadilla Incremental");
    expect(contenedor.querySelector("h1").textContent).toBe("Sentadilla Incremental");
    expect([...contenedor.querySelectorAll(".tabla-datos-grupo-titulo")].map((titulo) => titulo.textContent).filter(Boolean)).toEqual([
      "Serie 1",
      "Serie 2",
      "Serie 3",
      "Serie 4",
      "Serie 5",
      "R.M. Indirecto x PSE",
      "Valor Referencial",
    ]);
    expect(cabeceras(contenedor).slice(0, 9)).toEqual(["nº Eva", "Fecha", "Jugador", "Seleccion", "Dispositivo", "Medio", "P.C.", "Kg", "Carga"]);
    // Pot y RM IND/REL salieron (Santiago, 09/10).
    expect(cabeceras(contenedor)).not.toContain("Pot");
    expect(cabeceras(contenedor)).not.toContain("RM IND/REL");
    expect(celda(contenedor, 0, "Medio").textContent).toBe("Sentadilla con Trap");
    expect(celda(contenedor, 0, "Carga").textContent).toBe("100,0");
    // La tercera serie no cuenta: sin Fmax T.
    const fmaxes = filas(contenedor)[0].querySelectorAll("td");
    const columnasFmax = cabeceras(contenedor).flatMap((titulo, i) => (titulo === "Fmax T" ? [i] : []));
    expect(fmaxes[columnasFmax[2]].textContent).toBe("");
    expect(fmaxes[columnasFmax[0]].textContent).not.toBe("");
    expect(celda(contenedor, 0, "RM x Vel/PC").textContent).toBe("3,00");
    expect(celda(contenedor, 0, "Clas. Grupo").textContent).not.toBe("");

    // Los V.R.: una tabla por categoría y el resumen, sin la columna «Pro» de Zona Media.
    await irA(contenedor, "Valores de referencia");
    expect([...contenedor.querySelectorAll(".evaluaciones-bloque h2")].map((h) => h.textContent)).toEqual(["Mayor (profesional)", "V.R. de prueba Sub 15", "RESUMEN CATEGORIAS (Promedios)"]);
    const resumen = [...contenedor.querySelectorAll(".evaluaciones-bloque")].at(-1);
    expect([...resumen.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Categoría", "n", "P.C.", "Rep", "RM", "Kg", "Rel"]);

    // Dispositivo y Medio, para todos en el primer paso; se pueden cambiar en cada fila
    // (Santiago, 18/10: «Uno para todos pero se puede modificar individual»).
    await irA(contenedor, "Cargar");
    await tocar(boton(contenedor, "Nueva evaluación"));
    await elegirTest(contenedor, "Sentadilla Incremental");
    expect(contenedor.textContent).toContain("La fecha y lo que elijas acá valen para todos los jugadores que cargues; en cada fila se puede cambiar.");
    await tocar([...campo(contenedor, "Medio").querySelectorAll("button")].find((b) => b.textContent === "Sentadilla con Trap"));
    await tocar(boton(contenedor, "Siguiente"));
    expect(titulosDeLaCarga(contenedor).slice(0, 12)).toEqual(["Jugador", "Seleccion", "Dispositivo", "Medio", "P.C.", "Serie 1", "Serie 2", "Serie 3", "Serie 4", "Serie 5", "Valor Referencial", "Nota"]);
    await elegirJugador(contenedor, 0, "ALFA");
    expect(dato(contenedor, "ALFA · Medio").value).toBe("agachamento_trap");
    await tocar(boton(contenedor, "+ Agregar jugador"));
    await elegirEnLaHoja("BETA");
    expect(dato(contenedor, "BETA · Medio").value).toBe("agachamento_trap");
    // Uno se cambia a mano: si después se cambia para todos, ese queda como estaba.
    await elegirOpcion(dato(contenedor, "ALFA · Medio"), "Leg Press");
    await tocar(boton(contenedor, "Atrás"));
    await tocar([...campo(contenedor, "Medio").querySelectorAll("button")].find((b) => b.textContent === "Sentadilla"));
    await tocar(boton(contenedor, "Siguiente"));
    expect(dato(contenedor, "ALFA · Medio").value).toBe("prensa");
    expect(dato(contenedor, "BETA · Medio").value).toBe("agachamento");
    await escribir(dato(contenedor, "ALFA · P.C."), "80,5");
    await escribir(dato(contenedor, "ALFA · Serie 1 · Kg"), "20");
    await escribir(dato(contenedor, "ALFA · Serie 1 · PSE"), "0,5");
    await elegirOpcion(dato(contenedor, "ALFA · Serie 1 · ¿Cuenta?"), "NO");
    await escribir(dato(contenedor, "ALFA · Valor Referencial · RM x Vel"), "251");
    // BETA no tiene nada propio: no se guarda.
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(datos.creadas).toEqual([
      {
        equipoId: "eq-1",
        test: "sentadilla_incremental",
        ev: { jugador_id: 1, persona: null, fecha: hoyISO(), datos: { seleccion: "mayor", medio: "prensa", pc: 80.5, kg_1: 20, pse_1: 0.5, cuenta_1: "no", rm_vel: 251 } },
      },
    ]);
  });

  test("Press Plano: el RM con sus cargas, sus clases y la Rel; se carga con el peso, las repeticiones y los Kg", async () => {
    datos.evaluaciones.push({ ...evaluacion("pp1", 80, 1, "2026-06-24", {}), test: "press_plano", datos: { seleccion: "mayor", pc: 80, rep: 5, kg: 80 } });
    const V = (rm, rel) => ({ rm, rel });
    datos.referenciasPress = {
      categorias: { mayor: { titulo: "V.R. de prueba Press", rotulo: "Mayor", n: { rm: 9, rel: 9 }, excelente: V(100, 1.35), muy_bueno: V(92, 1.25), bueno: V(85, 1.15), regular: V(78, 1.05), malo: V(70, 0.95) } },
      resumen: { n: { mayor: 9 } },
    };
    await montar();
    await irA(contenedor, "Base");
    await elegirTest(contenedor, "Press Plano");
    expect(contenedor.querySelector("h1").textContent).toBe("Pecho Plano");
    expect(cabeceras(contenedor)).toEqual(["nº Eva", "Fecha", "Jugador", "Seleccion", "Fecha Nac", "P.C.", "0,4", "0,5", "0,6", "0,7", "0,8", "Rep", "RM", "Clas. RM", "% mejora", "Kg", "RM/PC", "Clas. Grupo (Rel)", "% mejora", "Va?", "Nota"]);
    // 80 × (1 + 0,029 × 5) = 91,6: Clas. 3; Rel 1,145: Clas. 2.
    expect(celda(contenedor, 0, "RM").textContent).toBe("92");
    expect(celda(contenedor, 0, "Clas. RM").textContent).toBe("3");
    expect(celda(contenedor, 0, "RM/PC").textContent).toBe("1,15");
    expect(celda(contenedor, 0, "Clas. Grupo (Rel)").textContent).toBe("2");
    expect(celda(contenedor, 0, "0,5").textContent).toBe("46");
    const comparacion = filaDeArriba(contenedor, "Comparar con");
    expect(celdaDeArriba(contenedor, comparacion, "RM").textContent).toBe("107,8%");

    await irA(contenedor, "Valores de referencia");
    expect([...contenedor.querySelectorAll(".evaluaciones-bloque h2")].map((h) => h.textContent)).toEqual(["V.R. de prueba Press", "RESUMEN CATEGORIAS (Promedios)"]);
    const resumen = [...contenedor.querySelectorAll(".evaluaciones-bloque")].at(-1);
    expect([...resumen.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Categoría", "n", "P.C.", "Rep", "RM", "Kg", "Rel"]);

    await irA(contenedor, "Cargar");
    await empezarCarga(contenedor, "Press Plano");
    expect(titulosDeLaCarga(contenedor)).toEqual(["Jugador", "Seleccion", "P.C.", "Rep", "Kg", "Nota", ""]);
    await elegirJugador(contenedor, 0, "ALFA");
    await escribir(dato(contenedor, "ALFA · P.C."), "80,5");
    await escribir(dato(contenedor, "ALFA · Kg"), "100");
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(datos.creadas).toEqual([{ equipoId: "eq-1", test: "press_plano", ev: { jugador_id: 1, persona: null, fecha: hoyISO(), datos: { seleccion: "mayor", pc: 80.5, kg: 100 } } }]);
  });

  test("Saltos: cuatro tests; Countermovement con sus clases y la comparación, Single Leg por medida y Drop sin V.R. todavía", async () => {
    datos.evaluaciones.push(
      { ...evaluacion("sc1", 90, 1, "2026-06-24", {}), test: "salto_countermovement", datos: { seleccion: "mayor", pc: 80, altura: 41, fuerza: 4800, potencia: 49, rsi: 0.62 } },
      { ...evaluacion("sl1", 91, 1, "2026-06-24", {}), test: "salto_single_leg", datos: { seleccion: "mayor", altura_pd: 20, altura_pi: 22 } },
    );
    const cortes = (valores) => Object.fromEntries(["excelente", "muy_bueno", "bueno", "regular", "malo"].map((cual, i) => [cual, Object.fromEntries(Object.entries(valores).map(([clave, lista]) => [clave, lista[i]]))]));
    datos.referenciasSaltos = {
      categorias: {
        mayor: { titulo: "V.R. de prueba Saltos", n: { altura: 9 }, ...cortes({ altura: [45, 42, 40, 37, 34], fuerza: [5000, 4800, 4600, 4400, 4200], potencia: [60, 57, 55, 52, 50], rsi: [0.7, 0.65, 0.6, 0.55, 0.5] }) },
      },
    };
    datos.referenciasSingleLeg = {
      categorias: {
        mayor: {
          titulos: { altura: "V.R. de prueba Altura", fuerza: "V.R. de prueba Fuerza", potencia: "V.R. de prueba Potencia", rsi: "V.R. de prueba RSI" },
          n: { altura_pd: 9 },
          ...cortes({ altura_pd: [25, 23, 21, 19, 17], altura_pi: [25, 23, 21, 19, 17], altura_deficit: [0.02, 0.05, 0.08, 0.12, 0.2] }),
        },
      },
    };
    await montar();
    await irA(contenedor, "Base");
    await elegirTest(contenedor, "Salto Countermovement");
    expect(contenedor.querySelector("h1").textContent).toBe("Evaluaciones de Salto · Countermovement");
    // Los títulos de las clases, corregidos (Santiago, 10/10).
    expect(cabeceras(contenedor)).toEqual([
      "nº Eva", "Fecha", "Selección", "Fecha Nac", "Jugador", "P.C.",
      "Altura", "Clas. Altura", "% mejora", "Pico de Fuerza", "Clas. N", "% mejora",
      "Pico de Potencia", "Pot. Clas", "% mejora", "RSI-modified [m/s]", "Clas. RSI", "% mejora", "Va?", "Nota",
    ]);
    expect(celda(contenedor, 0, "Clas. Altura").textContent).toBe("3");
    expect(celda(contenedor, 0, "Clas. N").textContent).toBe("4");
    expect(celda(contenedor, 0, "RSI-modified [m/s]").textContent).toBe("0,62");
    // La comparación «Vs …», como en Zona Media: 41 sobre el Bueno 40.
    expect(celdaDeArriba(contenedor, filaDeArriba(contenedor, "Comparar con"), "Altura").textContent).toBe("102,5%");

    await elegirTest(contenedor, "Salto Single Leg");
    expect([...contenedor.querySelectorAll(".tabla-datos-grupo-titulo")].map((titulo) => titulo.textContent).filter(Boolean)).toEqual(["Altura", "Pico de Fuerza", "Pico de Potencia", "RSI-modified"]);
    expect(celda(contenedor, 0, "Clas.PD").textContent).toBe("2");
    expect(celda(contenedor, 0, "DEFICIT LATERAL").textContent).toBe("10,0%");
    expect(celda(contenedor, 0, "DEFICIT PIERNA").textContent).toBe("PD");

    // Los V.R.: Single Leg, una tabla por medida; Drop, todavía sin V.R.
    await irA(contenedor, "Valores de referencia");
    await elegirTest(contenedor, "Salto Single Leg");
    expect([...contenedor.querySelectorAll(".evaluaciones-bloque h2")].map((h) => h.textContent)).toEqual(["V.R. de prueba Altura", "V.R. de prueba Fuerza", "V.R. de prueba Potencia", "V.R. de prueba RSI"]);
    const altura = [...contenedor.querySelectorAll(".evaluaciones-bloque")][0];
    expect([...altura.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["Altura PD", "Altura PI", "DEFICIT LATERAL"]);
    await elegirTest(contenedor, "Salto Drop");
    expect(contenedor.textContent).toContain("Todavía no hay valores de referencia de este test: agregá una categoría abajo y cargá sus números.");

    // Se carga una fila por jugador: el P.C. después de la Selección; cada medida, un bloque con sus dos piernas.
    await irA(contenedor, "Cargar");
    await empezarCarga(contenedor, "Salto Single Leg");
    expect(titulosDeLaCarga(contenedor).slice(0, 8)).toEqual(["Jugador", "Selección", "P.C.", "Altura", "Pico de Fuerza", "Pico de Potencia", "RSI-modified", ""]);
    await elegirJugador(contenedor, 0, "ALFA");
    await escribir(dato(contenedor, "ALFA · P.C."), "80,5");
    await escribir(dato(contenedor, "ALFA · Altura · Altura PD"), "21,5");
    await tocar(boton(contenedor, "Guardar 1 evaluación"));
    expect(datos.creadas).toEqual([{ equipoId: "eq-1", test: "salto_single_leg", ev: { jugador_id: 1, persona: null, fecha: hoyISO(), datos: { seleccion: "mayor", pc: 80.5, altura_pd: 21.5 } } }]);
  });

  test("en portugués, con los textos del Excel traducidos", async () => {
    fijarIdiomaParaPruebas("pt-BR");
    await montar();
    await irA(contenedor, "Base");
    expect(contenedor.querySelector("h1").textContent).toBe('Avaliação Zona Média "CORE"');
    expect(cabeceras(contenedor).slice(0, 3)).toEqual(["nº Aval.", "Data", "Jogador"]);
    expect(celda(contenedor, 0, "Seleção").textContent).toBe("Profissional");
    expect(celda(contenedor, 2, "% melhora").textContent).toBe("5,0%");
    expect(contenedor.querySelector(".evaluaciones-comparar select").selectedOptions[0].textContent).toBe("Vs Profissional");
  });
});
