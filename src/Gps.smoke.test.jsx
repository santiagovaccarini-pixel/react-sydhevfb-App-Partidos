import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Todo inventado: ningún nombre ni valor sale del Excel del club.
const datos = vi.hoisted(() => ({
  equipo: { id: "eq-1", nombre: "Club de Prueba" },
  filas: [],
  errorAlLeer: "",
  lecturas: [],
  creadas: [],
  actualizadas: [],
  borradas: [],
  ajustes: { campos: [], opciones: [] },
  cabeceras: [],
  opciones: [],
}));

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
      { id: 1, nombre: "ALFA", roles: [], puestos: [], actual: true },
      { id: 2, nombre: "BETA", roles: [], puestos: [], actual: true },
      { id: 3, nombre: "GAMA", roles: [], puestos: [], actual: false },
    ],
    error: "",
  }),
}));
vi.mock("./domain/plantel.js", async (importOriginal) => ({
  ...(await importOriginal()),
  // El nombre de ALFA en Catapult (el vínculo de Datos básicos).
  cargarPlantelConCatapult: async () => ({ plantel: [{ id: 1, nombre: "ALFA", catapult_nombre: "A. Alfa" }], error: "" }),
}));
vi.mock("./domain/gpsDb.js", () => ({
  listarGps: async (equipoId, { desde = null, hasta = null } = {}) => {
    datos.lecturas.push({ equipoId, desde, hasta });
    if (datos.errorAlLeer) return { filas: [], error: datos.errorAlLeer };
    // Como la base: por fecha y en el orden de carga.
    const filas = datos.filas
      .filter((fila) => (!desde || fila.fecha >= desde) && (!hasta || fila.fecha <= hasta))
      .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.orden - b.orden));
    return { filas: filas.map((fila) => ({ ...fila, datos: { ...fila.datos } })), error: "" };
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
  borrarFilaGps: async (id) => {
    datos.borradas.push(id);
    datos.filas = datos.filas.filter((una) => una.id !== id);
    return { error: "" };
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
const { fechaCorta, hoyISO } = await import("./idioma/formatos.js");

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
  fila("g0", 0, { jugador_id: 3 }, diasAntes(60), { microciclo: 20, d: 1000, dispositivo: "sport" }),
];
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
    datos.lecturas = [];
    datos.creadas = [];
    datos.actualizadas = [];
    datos.borradas = [];
    datos.ajustes = { campos: [], opciones: [...DISPOSITIVOS] };
    datos.cabeceras = [];
    datos.opciones = [];
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

  test("abre en la Base con las últimas 4 semanas, el informe del Excel arriba y sus colores", async () => {
    await montar();
    expect(contenedor.querySelector(".etiqueta-hero").textContent).toBe("GPS");
    expect(contenedor.querySelector(".estado-hero").textContent).toBe("3 filas");
    // El período: de hace 27 días a hoy (4 semanas con hoy).
    const [desde, hasta] = contenedor.querySelectorAll(".gps-periodo input[type=date]");
    expect(desde.value).toBe(diasAntes(27));
    expect(hasta.value).toBe(HOY);
    expect(datos.lecturas.at(-1)).toEqual({ equipoId: "eq-1", desde: diasAntes(27), hasta: HOY });

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

  test("al cambiar el período se leen esas fechas; cada dispositivo con su informe y sus colores", async () => {
    await montar();
    const [desde] = contenedor.querySelectorAll(".gps-periodo input[type=date]");
    await escribir(desde, diasAntes(90));
    expect(datos.lecturas.at(-1)).toEqual({ equipoId: "eq-1", desde: diasAntes(90), hasta: HOY });
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
  });

  test("al cambiar una medida o el Tiempo en la tabla se recalcula su por minuto", async () => {
    await montar();
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
    await montar();
    await tocar(celda(contenedor, 1, "Nombre"));
    await tocar(celda(contenedor, 1, "Nombre"));
    await tocar([...document.body.querySelectorAll(".opcion-hoja")].find((b) => b.textContent === "Team Average Sesion"));
    expect(datos.actualizadas[0]).toMatchObject({ id: "g2", fila: { jugador_id: null, persona: null, promedio: "sesion" } });
    expect(celda(contenedor, 1, "Nombre").textContent).toBe("Team Average Sesion");
    expect(celda(contenedor, 1, "Nombre").style.background).toBe("rgb(217, 150, 148)");
  });

  test("borrar una fila pide confirmación", async () => {
    await montar();
    await tocar(celda(contenedor, 1, "D"));
    await tocar(boton("Borrar fila"));
    expect(document.body.textContent).toContain("¿Borrar esta fila?");
    expect(document.body.textContent).toContain(`La de BETA del ${fechaCorta(AYER)}.`);
    await tocar(boton("Sí, borrar"));
    expect(datos.borradas).toEqual(["g2"]);
    expect(filas(contenedor)).toHaveLength(2);
  });

  test("Pegar desde Excel: se resume lo pegado, se elige qué es cada nombre y se carga con el dispositivo", async () => {
    await montar();
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
    expect(datos.lecturas.at(-1)).toEqual({ equipoId: "eq-1", desde: AYER, hasta: HOY });
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
    await montar();
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
    await montar();
    expect(contenedor.textContent).toContain("falta correr el SQL 20261016_gps.sql");
  });
});
