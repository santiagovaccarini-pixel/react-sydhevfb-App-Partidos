import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Todo inventado: ningún nombre ni valor sale del Excel del club.
const datos = vi.hoisted(() => ({
  equipo: { id: "eq-1", nombre: "Club de Prueba" },
  evaluaciones: [],
  referencias: null,
  errorAlLeer: "",
  creadas: [],
  actualizadas: [],
  borradas: [],
  // Si está, cada guardado espera a que se abra (una conexión lenta).
  compuerta: null,
  // Si está, la próxima lectura falla (una recarga que no llega).
  fallaLaProxima: "",
  // Lo que el club cambió en Ajustes (las filas de la base).
  ajustes: { campos: [], opciones: [] },
  cabeceras: [],
  opciones: [],
  referenciasCurl: null,
  referenciasIso: null,
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

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => datos.equipo,
  cargarEquipos: async () => ({ equipos: [] }),
  elegirEquipoInicial: () => null,
  guardarEquipoElegido: () => {},
  esElCam: () => false,
}));
vi.mock("./domain/lesionesDb.js", () => ({
  cargarPlantelLesiones: async () => ({
    plantel: [
      { id: 1, nombre: "ALFA", roles: [], puestos: [], actual: true, fecha_nacimiento: "2000-03-15", posicion: "delantero_central" },
      { id: 2, nombre: "BETA", roles: [], puestos: [], actual: true, fecha_nacimiento: "", posicion: "" },
      { id: 3, nombre: "GAMA", roles: [], puestos: [], actual: false, fecha_nacimiento: "", posicion: "" },
    ],
    error: "",
  }),
}));
vi.mock("./domain/evaluacionesDb.js", () => ({
  listarEvaluaciones: async () => {
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
    },
    error: "",
  }),
  leerAjustes: async () => ({ campos: [...datos.ajustes.campos], opciones: [...datos.ajustes.opciones], error: "" }),
  guardarCabecera: async (equipoId, test, campo, { etiquetas, oculto, orden }) => {
    datos.cabeceras.push({ equipoId, test, campo, etiquetas, oculto, orden });
    datos.ajustes.campos = [
      ...datos.ajustes.campos.filter((fila) => !(fila.test === test && fila.campo === campo)),
      { test, campo, etiqueta_es: etiquetas["es-AR"] || "", etiqueta_pt: etiquetas["pt-BR"] || "", oculto, orden },
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
    datos.creadas.push({ equipoId, test, ev });
    const nueva = { ...ev, id: `nueva-${datos.creadas.length}`, equipo_id: equipoId, test, orden: 100 + datos.creadas.length, persona: ev.persona ?? null };
    datos.evaluaciones.push(nueva);
    return { evaluacion: nueva, error: "" };
  },
  actualizarEvaluacion: async (id, ev) => {
    datos.actualizadas.push({ id, ev });
    if (datos.compuerta) await datos.compuerta;
    return { evaluacion: { ...ev, id, test: "zona_media" }, error: "" };
  },
  borrarEvaluacion: async (id) => {
    datos.borradas.push(id);
    return { error: "" };
  },
}));

const { default: Evaluaciones } = await import("./Evaluaciones.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");
const { hoyISO } = await import("./idioma/formatos.js");

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
    datos.errorAlLeer = "";
    datos.creadas = [];
    datos.actualizadas = [];
    datos.borradas = [];
    datos.compuerta = null;
    datos.fallaLaProxima = "";
    datos.ajustes = { campos: [], opciones: [] };
    datos.cabeceras = [];
    datos.opciones = [];
    datos.referenciasCurl = null;
    datos.referenciasIso = null;
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
    expect(celda(contenedor, 0, "Seleccion").textContent).toBe("Mayor");
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
    expect([...comparar.options].map((opcion) => opcion.textContent)).toEqual(["Vs Sub 15", "Vs Sub 17", "Vs Sub 18", "Vs Sub 20", "Vs Sub 23", "Vs Mayor"]);
    const [fila2, fila3] = contenedor.querySelectorAll("tr.tabla-datos-arriba");
    // Promedio 214 s contra el Bueno (180 s): 118,89 %, clase 4 (en verde).
    const porcentaje = celdaDeArriba(contenedor, fila2, "Lumbar");
    expect(porcentaje.textContent).toBe("118,89%");
    expect(porcentaje.style.background).toContain("146, 208, 80");
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

  test("Nueva evaluación: de quién y cuándo, después las medidas; los tiempos se guardan en segundos", async () => {
    await montar();
    await tocar(boton(contenedor, "Nueva evaluación"));
    expect(contenedor.querySelector("h1").textContent).toBe("Nueva evaluación");
    expect(contenedor.querySelector(".lesiones-paso-titulo h2").textContent).toBe("Jugador y fecha");
    // Sin jugador no se sigue.
    await tocar(boton(contenedor, "Siguiente"));
    expect(contenedor.textContent).toContain("Una evaluación tiene que ser de alguien: elegí el jugador.");
    // El plantel actual primero; quien ya no está, al final y marcado.
    const jugadores = [...contenedor.querySelectorAll(".lesiones-lista-jugadores button")];
    expect(jugadores.map((b) => b.querySelector("b").textContent)).toEqual(["ALFA", "BETA", "GAMA"]);
    await tocar(jugadores[1]);
    expect(campo(contenedor, "Fecha").querySelector("input").value).toBe(hoyISO());
    await tocar([...campo(contenedor, "Seleccion").querySelectorAll("button")].find((b) => b.textContent === "Mayor"));
    await tocar(boton(contenedor, "Siguiente"));
    expect(contenedor.querySelector(".lesiones-paso-titulo h2").textContent).toBe("Medidas");
    expect([...contenedor.querySelectorAll(".lesiones-campo-paso label")].map((label) => label.textContent)).toEqual(["Lumbar", "Lateral D", "Lateral I", "Prono", "Nota"]);
    // Un tiempo que no se entiende no se guarda.
    await escribir(campo(contenedor, "Lumbar").querySelector("input"), "3:7x");
    await tocar(boton(contenedor, "Guardar la evaluación"));
    expect(contenedor.textContent).toContain("«3:7x» no se entiende en Lumbar");
    expect(datos.creadas).toHaveLength(0);
    await escribir(campo(contenedor, "Lumbar").querySelector("input"), "3:10");
    await escribir(campo(contenedor, "Prono").querySelector("input"), "2,05");
    await escribir(campo(contenedor, "Nota").querySelector("textarea"), "con molestia");
    await tocar(boton(contenedor, "Guardar la evaluación"));
    expect(datos.creadas).toEqual([
      { equipoId: "eq-1", test: "zona_media", ev: { jugador_id: 2, persona: null, fecha: hoyISO(), datos: { seleccion: "mayor", lumbar: 190, prono: 125, nota: "con molestia" } } },
    ]);
    // Vuelve a Cargar, con la nueva entre las de hoy.
    expect(document.body.textContent).toContain("Evaluación guardada.");
    expect(contenedor.querySelector(".estado-hero").textContent).toBe("1 evaluación hoy");
    // En la Base, al final (es la más nueva) y con su cálculo.
    await irA(contenedor, "Base");
    expect(filas(contenedor)).toHaveLength(4);
    expect(celda(contenedor, 3, "Jugador").textContent).toBe("BETA");
    expect(celda(contenedor, 3, "Lumbar").textContent).toBe("3:10");
    expect(celda(contenedor, 3, "nº Eva").textContent).toBe("2");
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
    expect(datos.actualizadas).toEqual([{ id: "e4", ev: { jugador_id: 2, persona: null, fecha: hoyISO(), datos: { seleccion: "mayor", lumbar: 205 } } }]);
  });

  test("salir de una carga con algo escrito pide confirmación", async () => {
    await montar();
    await tocar(boton(contenedor, "Nueva evaluación"));
    await tocar(contenedor.querySelector(".lesiones-lista-jugadores button"));
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
    expect(datos.actualizadas).toHaveLength(1);
    expect(datos.actualizadas[0].id).toBe("e2");
    expect(datos.actualizadas[0].ev.datos).toEqual({ seleccion: "mayor", lumbar: 160 });
    expect(lumbar().textContent).toBe("2:40");
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
    expect(datos.actualizadas).toHaveLength(2);
    // La segunda sale de lo que dejó la primera.
    expect(datos.actualizadas[1].ev.datos).toEqual({ seleccion: "mayor", lumbar: 160, lateral_d: 90 });
    expect(celda(contenedor, 1, "Lumbar").textContent).toBe("2:40");
    expect(celda(contenedor, 1, "Lateral D").textContent).toBe("1:30");
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
    expect([...filaDe(resumen, "Mayor").querySelectorAll("td")].map((td) => td.textContent)).toEqual(["12", "3:00", "1:20", "1:20", "2:00", "0,70", "10,00", ""]);
    expect([...filaDe(resumen, "Sub-15").querySelectorAll("td")].map((td) => td.textContent)).toEqual(["", "", "", "", "", "", "", ""]);
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
    expect([...contenedor.querySelectorAll(".informe-dato")].map((dato) => dato.textContent)).toEqual(["CategoríaMayor", "Última evaluación06/07/2026", "Nº evaluaciones7"]);
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

  test("Ajustes: se renombra y se esconde una cabecera, y se suma una opción a Selección", async () => {
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.textContent.includes("Cabeceras")));
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b").textContent === "Lumbar"));
    const nombre = document.body.querySelector(".lesiones-hoja input[type=text]");
    expect(nombre.value).toBe("Lumbar");
    await escribir(nombre, "Lumbar (min)");
    await tocar(boton(contenedor, "Guardar"));
    expect(datos.cabeceras).toEqual([{ equipoId: "eq-1", test: "zona_media", campo: "lumbar", etiquetas: { "es-AR": "Lumbar (min)", "pt-BR": "Lombar" }, oculto: false, orden: 5 }]);
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

    await irA(contenedor, "Ajustes");
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.textContent.includes("Listas")));
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b").textContent === "Seleccion"));
    expect([...contenedor.querySelectorAll(".opcion-ajuste b")].map((b) => b.textContent)).toEqual(["Sub-15", "Sub-17", "Sub-18", "Sub-20", "Sub-23", "Mayor"]);
    await tocar(boton(contenedor, "Agregar una opción"));
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "Reserva");
    await tocar(boton(contenedor, "Guardar"));
    expect(datos.opciones).toHaveLength(1);
    expect(datos.opciones[0]).toMatchObject({ lista: "seleccion", etiquetas: { "es-AR": "Reserva" }, orden: 6 });
    expect(datos.opciones[0].codigo).toMatch(/^reserva_/);
    // Mayor pasa a llamarse Primera: el selector del informe también.
    await tocar([...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b").textContent === "Mayor"));
    await escribir(document.body.querySelector(".lesiones-hoja input[type=text]"), "Primera");
    await tocar(boton(contenedor, "Guardar"));
    await irA(contenedor, "Base");
    expect(celda(contenedor, 0, "Seleccion").textContent).toBe("Primera");
    expect([...contenedor.querySelector(".evaluaciones-comparar select").options].map((opcion) => opcion.textContent)).toEqual([
      "Vs Sub 15",
      "Vs Sub 17",
      "Vs Sub 18",
      "Vs Sub 20",
      "Vs Sub 23",
      "Vs Primera",
      "Vs Reserva",
    ]);
    // Las clases siguen contra los V.R. de esa categoría (es la misma).
    expect(celda(contenedor, 0, "L. Clas").textContent).toBe("5");
    // Con siete opciones, la carga la elige en la hoja de opciones.
    await irA(contenedor, "Cargar");
    await tocar(boton(contenedor, "Nueva evaluación"));
    expect(campo(contenedor, "Seleccion").querySelector(".selector-hoja")).not.toBeNull();
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
    expect([...contenedor.querySelector("select.evaluaciones-elegir-test-lista").options].map((opcion) => opcion.textContent)).toEqual(["Zona Media", "Curl Nórdico e Isoprone", "Isocinecia"]);
    expect(botones(contenedor).some((b) => b.textContent === "Curl Nórdico e Isoprone")).toBe(false);
    await elegirTest(contenedor, "Curl Nórdico e Isoprone");
    expect(contenedor.querySelector("h1").textContent).toBe("Curl Nórdico e Isoprone");
    expect([...contenedor.querySelectorAll(".tabla-datos-grupo-titulo")].map((titulo) => titulo.textContent).filter(Boolean)).toEqual([
      "Curl Nórdico · Máxima",
      "Curl Nórdico · Media",
      "Isoprone · Máxima",
      "Isoprone · Media",
    ]);
    expect(cabeceras(contenedor).slice(0, 8)).toEqual(["Jugador", "Fecha", "Evaluacion", "Seleccion", "P.C.", "L MÁX", "L MÁX Rel", "Clas L"]);
    expect(cabeceras(contenedor)).not.toContain("% mejora L + R");
    expect(filas(contenedor)).toHaveLength(1);
    expect(celda(contenedor, 0, "L MÁX Rel").textContent).toBe("5,50");
    expect(celda(contenedor, 0, "Clas L").textContent).toBe("4");
    expect(celda(contenedor, 0, "Deficit MAX %").textContent).toBe("10,0%");
    expect(celda(contenedor, 0, "Deficit Pierna").textContent).toBe("PD");
    // El informe: cuántas PD hay, con su rótulo.
    const promedios = filaDeArriba(contenedor, "Promedio");
    expect(celdaDeArriba(contenedor, promedios, "L MÁX Rel").textContent).toBe("5,5");
    expect(celdaDeArriba(contenedor, promedios, "Deficit Pierna").textContent).toBe("PD 1,0");

    // Los valores de referencia: una tabla por evaluación.
    await irA(contenedor, "Valores de referencia");
    expect([...contenedor.querySelectorAll(".evaluaciones-bloque h2")].map((h) => h.textContent)).toEqual(["V.R. de prueba Curl", "V.R. de prueba Isoprone"]);

    // Se carga por pasos: el peso con el jugador y la fecha; después cada bloque.
    await irA(contenedor, "Cargar");
    await tocar(boton(contenedor, "Nueva evaluación"));
    await elegirTest(contenedor, "Curl Nórdico e Isoprone");
    await tocar(contenedor.querySelector(".lesiones-lista-jugadores button"));
    await escribir(campo(contenedor, "P.C.").querySelector("input"), "80,5");
    await tocar(boton(contenedor, "Siguiente"));
    expect(contenedor.querySelector(".lesiones-paso-titulo h2").textContent).toBe("Curl Nórdico · Máxima");
    await escribir(campo(contenedor, "L MÁX").querySelector("input"), "402");
    await escribir(campo(contenedor, "R MÁX").querySelector("input"), "x");
    await tocar(boton(contenedor, "Siguiente"));
    expect(contenedor.textContent).toContain("«x» no es un número en R MÁX.");
    await escribir(campo(contenedor, "R MÁX").querySelector("input"), "398");
    await tocar(boton(contenedor, "Siguiente"));
    expect(contenedor.querySelector(".lesiones-paso-titulo h2").textContent).toBe("Curl Nórdico · Media");
    await tocar(boton(contenedor, "Siguiente"));
    await tocar(boton(contenedor, "Siguiente"));
    expect(contenedor.querySelector(".lesiones-paso-titulo h2").textContent).toBe("Isoprone · Media");
    await tocar(boton(contenedor, "Guardar la evaluación"));
    expect(datos.creadas).toEqual([{ equipoId: "eq-1", test: "curl_nordico_isoprone", ev: { jugador_id: 1, persona: null, fecha: hoyISO(), datos: { pc: 80.5, curl_l_max: 402, curl_r_max: 398 } } }]);
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

    // No se carga a mano (sale del PDF del equipo: Santiago, 09/10): en
    // Cargar no está, ni aunque sea el que se mira en la Base.
    await irA(contenedor, "Base");
    await elegirTest(contenedor, "Isocinecia");
    await irA(contenedor, "Cargar");
    await tocar(boton(contenedor, "Nueva evaluación"));
    const deLaCarga = contenedor.querySelector("select.evaluaciones-elegir-test-lista");
    expect([...deLaCarga.options].map((opcion) => opcion.textContent)).toEqual(["Zona Media", "Curl Nórdico e Isoprone"]);
    expect(deLaCarga.value).toBe("zona_media");
  });

  test("Isocinecia de hoy (pegada desde el Excel): en Cargar se ve y se borra, pero se corrige en la Base", async () => {
    datos.evaluaciones.push({ ...evaluacion("s2", 31, 2, hoyISO(), {}), test: "isocinecia", datos: { seleccion: "mayor", v60_rom_pd: 140 }, creado_en: new Date().toISOString() });
    await montar();
    const tarjeta = [...contenedor.querySelectorAll(".evaluaciones-registro")].find((una) => una.textContent.includes("Isocinecia"));
    expect(tarjeta).toBeTruthy();
    expect([...tarjeta.querySelectorAll("button")].some((b) => b.textContent === "Editar")).toBe(false);
    expect(tarjeta.querySelector(".boton-eliminar-registro")).not.toBeNull();
  });

  test("en portugués, con los textos del Excel traducidos", async () => {
    fijarIdiomaParaPruebas("pt-BR");
    await montar();
    await irA(contenedor, "Base");
    expect(contenedor.querySelector("h1").textContent).toBe('Avaliação Zona Média "CORE"');
    expect(cabeceras(contenedor).slice(0, 3)).toEqual(["nº Aval.", "Data", "Jogador"]);
    expect(celda(contenedor, 0, "Seleção").textContent).toBe("Profissional");
    expect(celda(contenedor, 2, "% melhora").textContent).toBe("5,0%");
    expect([...contenedor.querySelector(".evaluaciones-comparar select").options].at(-1).textContent).toBe("Vs Profissional");
  });
});
