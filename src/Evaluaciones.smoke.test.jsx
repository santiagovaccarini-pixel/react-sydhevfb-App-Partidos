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
  leerConfig: async () => ({ config: null, error: "" }),
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
  leerReferencias: async () => ({ referencias: datos.referencias, error: "" }),
  crearEvaluacion: async (equipoId, test, ev) => {
    datos.creadas.push({ equipoId, test, ev });
    const nueva = { ...ev, id: `nueva-${datos.creadas.length}`, equipo_id: equipoId, test, orden: 100 + datos.creadas.length, persona: ev.persona ?? null };
    datos.evaluaciones.push(nueva);
    return { evaluacion: nueva, error: "" };
  },
  actualizarEvaluacion: async (id, ev) => {
    datos.actualizadas.push({ id, ev });
    if (datos.compuerta) await datos.compuerta;
    return { evaluacion: { ...ev, id }, error: "" };
  },
  borrarEvaluacion: async (id) => {
    datos.borradas.push(id);
    return { error: "" };
  },
}));

const { default: Evaluaciones } = await import("./Evaluaciones.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");
const { etiquetaDeOpcion } = await import("./domain/lesionesCampos.js");
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
// después del número y del rótulo (que ocupa las fijas).
const celdaDeArriba = (contenedor, tr, titulo) => tr.querySelectorAll("td")[columna(contenedor, titulo) - 6];

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
    expect(contenedor.querySelector("h1").textContent).toBe('Evaluación Zona Media "CORE"');
    expect(contenedor.textContent).toContain("*Los Valores pintados corresponden a la comparación");
    expect(cabeceras(contenedor).slice(0, 8)).toEqual(["nº Eva", "Fecha", "Jugador", "Seleccion", "Fecha Nac", "Posición", "Lumbar", "L. Clas"]);
    expect(cabeceras(contenedor).at(-1)).toBe("Nota");

    // Por fecha: las dos del 01/06 en el orden de carga, después la del 01/07.
    expect(filas(contenedor).map((tr) => tr.querySelectorAll("td")[columna(contenedor, "Jugador")].textContent)).toEqual(["ALFA", "BETA", "ALFA"]);
    expect(celda(contenedor, 0, "nº Eva").textContent).toBe("1");
    expect(celda(contenedor, 2, "nº Eva").textContent).toBe("2");
    expect(celda(contenedor, 0, "Fecha Nac").textContent).toBe("15/03/2000");
    expect(celda(contenedor, 0, "Posición").textContent).toBe(etiquetaDeOpcion("posicion", "delantero_central", null, "es-AR"));
    expect(celda(contenedor, 0, "Seleccion").textContent).toBe("Mayor");
    expect(celda(contenedor, 0, "Lumbar").textContent).toBe("4:00");
    // La clase, con el número del color de su clase, en negrita, sobre gris.
    const clase = celda(contenedor, 0, "L. Clas");
    expect(clase.textContent).toBe("5");
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
    expect(promedios[mejoras[3] - 6].textContent).toBe("");
    expect(filaDeArriba(contenedor, "Mínimo").querySelectorAll("td")[mejoras[3] - 6].textContent).toBe("");
  });

  test("la comparación con los V.R. de la categoría elegida (Vs Mayor al abrir)", async () => {
    await montar();
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
    expect(contenedor.textContent).toContain("Todavía no están los valores de referencia de este test");
    expect(celda(contenedor, 0, "L. Clas").textContent).toBe("");
    // Lo que no depende de los V.R. sigue igual.
    expect(celda(contenedor, 2, "% mejora").textContent).toBe("5,0%");
  });

  test("agregar: primero el jugador; va con la fecha de hoy, al final", async () => {
    await montar();
    await tocar(boton(contenedor, "Agregar evaluación"));
    expect(document.body.textContent).toContain("¿De quién es la evaluación?");
    // Quien ya no está en el plantel actual va al final, con su aviso.
    const opciones = [...document.body.querySelectorAll(".opcion-hoja")].map((b) => b.textContent);
    expect(opciones).toEqual(["ALFA", "BETA", "GAMA · Ya no está"]);
    await tocar([...document.body.querySelectorAll(".opcion-hoja")].find((b) => b.textContent === "BETA"));
    expect(datos.creadas).toEqual([{ equipoId: "eq-1", test: "zona_media", ev: { jugador_id: 2, fecha: hoyISO(), datos: {} } }]);
    expect(filas(contenedor)).toHaveLength(4);
    expect(celda(contenedor, 3, "Jugador").textContent).toBe("BETA");
    expect(celda(contenedor, 3, "nº Eva").textContent).toBe("2");
    expect(document.body.textContent).toContain("Evaluación agregada: completala en la tabla.");
  });

  test("se edita en la tabla: un tiempo en minutos y segundos se guarda en segundos", async () => {
    await montar();
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

  test("agregar con un filtro puesto: la nueva se ve igual, para completarla", async () => {
    await montar();
    const boton = (texto) => [...document.body.querySelectorAll("button")].find((b) => b.textContent.trim() === texto);
    await tocar(contenedor.querySelector('.tabla-datos-filtro[aria-label="Filtrar u ordenar Seleccion"]'));
    await tocar(boton("Ninguno"));
    await tocar([...contenedor.querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent.startsWith("Mayor")).querySelector("input"));
    await tocar(boton("Aplicar"));
    expect(filas(contenedor)).toHaveLength(3);
    await tocar(boton("Agregar evaluación"));
    await tocar([...document.body.querySelectorAll(".opcion-hoja")].find((b) => b.textContent === "BETA"));
    // Sin Selección todavía, el filtro la dejaría afuera.
    expect(filas(contenedor)).toHaveLength(4);
    expect(celda(contenedor, 3, "Jugador").textContent).toBe("BETA");
  });

  test("borrar una fila pide confirmación", async () => {
    await montar();
    await tocar(celda(contenedor, 1, "Lumbar"));
    await tocar(boton(contenedor, "Borrar fila"));
    expect(document.body.textContent).toContain("¿Borrar esta evaluación?");
    expect(document.body.textContent).toContain("La de BETA del 01/06/2026.");
    await tocar(boton(contenedor, "Sí, borrar"));
    expect(datos.borradas).toEqual(["e2"]);
    expect(filas(contenedor)).toHaveLength(2);
  });

  test("Pegar desde Excel: se ve qué pasa con cada fila y se carga", async () => {
    await montar();
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
    expect(boton(contenedor, "Agregar evaluación")).toBeUndefined();
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

  test("en portugués, con los textos del Excel traducidos", async () => {
    fijarIdiomaParaPruebas("pt-BR");
    await montar();
    expect(contenedor.querySelector("h1").textContent).toBe('Avaliação Zona Média "CORE"');
    expect(cabeceras(contenedor).slice(0, 3)).toEqual(["nº Aval.", "Data", "Jogador"]);
    expect(celda(contenedor, 0, "Seleção").textContent).toBe("Profissional");
    expect(celda(contenedor, 2, "% melhora").textContent).toBe("5,0%");
    expect([...contenedor.querySelector(".evaluaciones-comparar select").options].at(-1).textContent).toBe("Vs Profissional");
  });
});
