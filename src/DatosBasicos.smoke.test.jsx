import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const plantelInicial = () => [
  { id: 7, nombre: "HULK", roles: [], puestos: ["DEL"], categoria: "profissional", fecha_nacimiento: "1986-07-25", pie_dominante: "esquerdo", posicion: "delantero_central", foto_url: "" },
  { id: 8, nombre: "SCARPA", roles: [], puestos: ["VOL"], categoria: "", fecha_nacimiento: "", pie_dominante: "", posicion: "", foto_url: "" },
];
const registro = vi.hoisted(() => ({ guardados: [], agregados: [], borrados: [], puestos: [], plantel: [], fallarAgregar: "", fallarPuestos: false, fallarGuardar: "", esperaGuardar: null, plan: [], equipo: { id: "eq-1", nombre: "Atlético Mineiro" } }));

// Las posiciones de Partido y los chalecos de Catapult (plantel.js).
vi.mock("./domain/plantel.js", async (importOriginal) => ({
  ...(await importOriginal()),
  MAXIMO_PUESTOS: 4,
  ROLES: ["Defensa", "Mediocampo", "Ataque"],
  PUESTOS: ["LAT", "CAR", "DEF", "VD", "VC", "VM", "VOL", "VO", "EXT", "MP", "DEL"].map((sigla) => ({ sigla, nombre: sigla })),
  guardarPuestos: async (id, cambios) => {
    registro.puestos.push({ id, ...cambios });
    return registro.fallarPuestos ? { error: "sin conexión" } : {};
  },
  cargarPlantelConCatapult: async () => ({ plantel: registro.plantel.map((jugador) => ({ ...jugador, catapult_id: null, catapult_nombre: null })), error: "" }),
  guardarVinculoCatapult: async () => ({}),
}));

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => registro.equipo,
  cargarEquipos: async () => ({ equipos: [] }),
  elegirEquipoInicial: () => null,
  guardarEquipoElegido: () => {},
  esElCam: (nombre) => nombre === "Atlético Mineiro",
  soloParaMirar: (equipo, modulo) => Array.isArray(equipo?.solo_lectura) && equipo.solo_lectura.includes(modulo),
}));
// La base de mentira: el plantel cambia con lo que se agrega y se guarda.
vi.mock("./domain/lesionesDb.js", () => ({
  // Como la de verdad: ordenado por nombre.
  cargarPlantelLesiones: async () => ({
    plantel: registro.plantel.map((jugador) => ({ ...jugador })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    error: "",
  }),
  // Datos básicos › Ajustes: lo de Lesiones que comparte (nombre y listas de
  // las columnas del jugador) y lo propio.
  leerConfigDatos: async () => ({ config: JSON.parse(JSON.stringify(registro.config)), columnas: JSON.parse(JSON.stringify(registro.columnas)), error: "" }),
  guardarCampo: async (equipoId, campo, datos) => {
    registro.ajustes.push({ tabla: "campos", campo, ...datos });
    registro.config.campos[campo] = { etiquetas: { ...datos.etiquetas }, oculto: datos.oculto, orden: datos.orden };
    return { error: "" };
  },
  guardarOpcion: async (equipoId, campo, datos) => {
    registro.ajustes.push({ tabla: "opciones", campo, ...datos });
    const lista = (registro.config.listas[campo] = registro.config.listas[campo] || []);
    const otra = lista.findIndex((una) => una.codigo === datos.codigo);
    const fila = { codigo: datos.codigo, etiquetas: { ...datos.etiquetas }, oculto: datos.oculto, orden: datos.orden };
    if (otra >= 0) lista[otra] = fila;
    else lista.push(fila);
    return { error: "" };
  },
  guardarColumnaDatos: async (equipoId, columna, datos) => {
    registro.ajustes.push({ tabla: "columnas", columna, ...datos });
    if (registro.faltaSqlAjustes) return { error: "datos.ajustes.faltaSql" };
    registro.columnas[columna] = { etiquetas: { ...datos.etiquetas }, oculto: datos.oculto };
    return { error: "" };
  },
  guardarDatosJugador: async (id, cambios) => {
    registro.guardados.push({ id, ...cambios });
    // Un plan por llamada (esperar y/o fallar), para probar guardados cruzados.
    const paso = registro.plan.shift();
    if (paso?.esperar) await paso.esperar;
    if (paso?.error) return { error: paso.error };
    if (registro.esperaGuardar) await registro.esperaGuardar;
    if (registro.fallarGuardar) return { error: registro.fallarGuardar };
    const jugador = registro.plantel.find((uno) => uno.id === id);
    Object.assign(jugador, cambios);
    return { jugador: { ...jugador }, error: "" };
  },
  agregarJugadorBasico: async (equipoId, nombre) => {
    registro.agregados.push({ equipoId, nombre });
    if (registro.fallarAgregar && nombre === registro.fallarAgregar) return { error: "datos.error.repetido" };
    const jugador = { id: 9 + registro.agregados.length - 1, nombre: nombre.trim().toUpperCase(), roles: [], puestos: [], categoria: "", fecha_nacimiento: "", pie_dominante: "", posicion: "", foto_url: "" };
    registro.plantel.push(jugador);
    return { jugador: { ...jugador }, error: "" };
  },
  // Las lesiones de cada jugador (para la categoría) y su categoría guardada.
  leerLesionesPorJugador: async () => ({ porJugador: JSON.parse(JSON.stringify(registro.lesiones)), error: "" }),
  guardarCategoriaDeLesiones: async (cambios) => {
    registro.categoriasDeLesiones.push(...cambios);
    return { hechas: cambios.map((cambio) => cambio.id), error: "" };
  },
  quitarJugadorBasico: async (id) => {
    // Uno con lesiones o evaluaciones cargadas no se puede borrar.
    if (registro.noSeBorran?.includes(id)) return { error: "datos.error.borrarConDatos" };
    registro.borrados.push(id);
    return { error: "" };
  },
}));

const { default: DatosBasicos } = await import("./DatosBasicos.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");
const { hoyISO } = await import("./idioma/formatos.js");

const texto = (contenedor) => contenedor.textContent;
const boton = (contenedor, etiqueta) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === etiqueta);
const tocar = async (elemento) => {
  expect(elemento, "no se encontró el botón").toBeTruthy();
  await act(async () => elemento.click());
};
const escribir = async (input, valor) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value").set.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const celda = (contenedor, fila, columna) => contenedor.querySelectorAll("tbody tr")[fila].querySelectorAll("td")[columna];

describe("el módulo Datos básicos", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    localStorage.clear();
    registro.equipo = { id: "eq-1", nombre: "Atlético Mineiro" };
    registro.plantel = plantelInicial();
    registro.fallarAgregar = "";
    registro.lesiones = {};
    registro.categoriasDeLesiones = [];
    registro.config = { campos: {}, listas: {} };
    registro.columnas = {};
    registro.ajustes = [];
    registro.faltaSqlAjustes = false;
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    contenedor.remove();
    registro.fallarPuestos = false;
    registro.fallarGuardar = "";
    registro.esperaGuardar = null;
    registro.plan = [];
    ["guardados", "agregados", "borrados", "puestos"].forEach((clave) => {
      registro[clave].length = 0;
    });
  });

  const montar = async (permisos = null) => {
    await act(async () => raiz.render(<DatosBasicos onVolver={() => {}} permisos={permisos} />));
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
  };

  const irA = (contenedor, nombre) => tocar([...contenedor.querySelectorAll(".navegacion-movil button")].find((b) => b.textContent.includes(nombre)));

  test("las posiciones de Partido se cargan acá: un rol se guarda al toque y con cuatro puestos no se suma otro", async () => {
    registro.plantel = [
      { ...plantelInicial()[0], puestos: ["VO", "VM", "MP", "EXT"], roles: [] },
      { ...plantelInicial()[1], puestos: ["VM"], roles: [] },
    ];
    await montar();
    await irA(contenedor, "Posiciones");
    expect(texto(contenedor)).toContain("Dónde juega cada uno");
    expect(contenedor.querySelector("table")).toBeNull();
    const bloques = () => [...contenedor.querySelectorAll(".jugador-puestos")];
    const puestosDe = (bloque) => [...bloque.querySelectorAll(".boton-puesto")].map((b) => b.textContent.trim());
    expect(puestosDe(bloques()[0])).toEqual(["VO", "VM", "MP", "EXT"]);
    expect(puestosDe(bloques()[1])).toEqual(["VM", "+"]);
    // Un rol se guarda sin botón de guardar y queda marcado.
    const mediocampo = [...bloques()[1].querySelectorAll(".chip-rol")].find((b) => b.textContent === "Mediocampo");
    await tocar(mediocampo);
    expect(registro.puestos).toEqual([{ id: 8, roles: ["Mediocampo"], puestos: ["VM"] }]);
    expect([...bloques()[1].querySelectorAll(".chip-rol.activo")].map((b) => b.textContent)).toEqual(["Mediocampo"]);
    // Un puesto nuevo, desde el "+".
    await tocar(bloques()[1].querySelector(".boton-puesto.vacio"));
    await tocar([...bloques()[1].querySelectorAll(".lista-puestos button")].find((b) => b.textContent.startsWith("DEL")));
    expect(registro.puestos[1]).toEqual({ id: 8, roles: ["Mediocampo"], puestos: ["VM", "DEL"] });
    // El buscador.
    await escribir(contenedor.querySelector(".buscador-plantel"), "scar");
    expect(bloques()).toHaveLength(1);
  });

  test("si un puesto no se puede guardar, se avisa y se vuelve a leer lo de la base", async () => {
    registro.fallarPuestos = true;
    await montar();
    await irA(contenedor, "Posiciones");
    const ataque = [...contenedor.querySelectorAll(".jugador-puestos")[0].querySelectorAll(".chip-rol")].find((b) => b.textContent === "Ataque");
    await tocar(ataque);
    await act(async () => Promise.resolve());
    expect(texto(contenedor)).toContain("No se pudo guardar.");
    expect(contenedor.querySelectorAll(".jugador-puestos")[0].querySelectorAll(".chip-rol.activo")).toHaveLength(0);
  });

  // Datos básicos › Ajustes (Santiago, 17/10: Listas, Cabeceras y Catapult).
  const menu = () => [...contenedor.querySelectorAll(".navegacion-movil button")].map((b) => b.textContent);
  const filasDeAjustes = () => [...contenedor.querySelectorAll(".opcion-ajuste b")].map((b) => b.textContent);
  const filaDeAjuste = (titulo) => [...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b")?.textContent === titulo);
  const hojaDeAjuste = () => document.body.querySelector(".lesiones-hoja");
  const cabeceras = () => [...contenedor.querySelectorAll("th[data-columna]")].map((th) => th.textContent);

  test("los dispositivos de Catapult están en Ajustes para quien tiene Flujo diario", async () => {
    await montar({ partido: true, flujo: true, lesiones: false, datos: true });
    expect(menu()).toEqual(["Jugadores", "Posiciones", "Ajustes"]);
    await irA(contenedor, "Ajustes");
    expect(filasDeAjustes()).toEqual(["Cabeceras", "Listas", "Catapult"]);
    await tocar(filaDeAjuste("Catapult"));
    expect(texto(contenedor)).toContain("Dispositivos de Catapult");
    expect(texto(contenedor)).toContain("2 jugadores · 0 con dispositivo");
    await tocar(boton(contenedor, "Volver a Ajustes"));
    expect(filasDeAjustes()).toEqual(["Cabeceras", "Listas", "Catapult"]);
    await act(async () => raiz.unmount());
    raiz = createRoot(contenedor);
    await montar({ partido: true, flujo: false, lesiones: true, datos: true });
    expect(menu()).toEqual(["Jugadores", "Posiciones", "Ajustes"]);
    await irA(contenedor, "Ajustes");
    expect(filasDeAjustes()).toEqual(["Cabeceras", "Listas"]);
    // Ser dueño de la app no abre Catapult: hace falta Flujo diario en el club.
    await act(async () => raiz.unmount());
    raiz = createRoot(contenedor);
    await montar({ partido: true, flujo: false, lesiones: false, datos: true, admin: true, dueno: "principal", esDueno: true });
    await irA(contenedor, "Ajustes");
    expect(filasDeAjustes()).toEqual(["Cabeceras", "Listas"]);
  });

  test("Ajustes › Cabeceras: una columna propia se renombra y una del jugador se esconde solo de esta tabla", async () => {
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar(filaDeAjuste("Cabeceras"));
    expect(filasDeAjustes()).toEqual(["Nombre y apellido", "Actual", "Categoría", "Fecha de nacimiento", "Edad", "Pie dominante", "Posición", "Foto (enlace)", "Horas previas"]);
    expect(filaDeAjuste("Categoría").textContent).toContain("También en Lesiones");
    expect(filaDeAjuste("Foto (enlace)").textContent).not.toContain("También en Lesiones");
    // Una propia: el nombre va a lo de Datos básicos, en el idioma que se usa.
    await tocar(filaDeAjuste("Foto (enlace)"));
    const nombre = () => hojaDeAjuste().querySelector("input[type=text]");
    expect(nombre().value).toBe("Foto (enlace)");
    await escribir(nombre(), "Foto carnet");
    await tocar(boton(document.body, "Guardar"));
    expect(registro.ajustes).toEqual([{ tabla: "columnas", columna: "foto_url", etiquetas: { "es-AR": "Foto carnet", "pt-BR": "" }, oculto: false }]);
    expect(hojaDeAjuste()).toBeNull();
    expect(filaDeAjuste("Foto carnet")).toBeTruthy();
    // Una del jugador: esconderla no toca la configuración de Lesiones.
    await tocar(filaDeAjuste("Pie dominante"));
    expect(hojaDeAjuste().textContent).toContain("Este nombre también se usa en Lesiones. Esconderla acá no la saca de Lesiones.");
    await tocar(boton(document.body, "Oculta"));
    await tocar(boton(document.body, "Guardar"));
    expect(registro.ajustes.slice(1)).toEqual([{ tabla: "columnas", columna: "pie_dominante", etiquetas: {}, oculto: true }]);
    expect(filaDeAjuste("Pie dominante").textContent).toContain("Oculta");
    await irA(contenedor, "Jugadores");
    expect(cabeceras()).toEqual(["Nombre y apellido", "Actual", "Categoría", "Fecha de nacimiento", "Edad", "Posición", "Foto carnet", "Horas previas"]);
    // En portugués, sin nombre propio, el de la app.
    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    expect(cabeceras()).toContain("Foto (link)");
  });

  test("Ajustes › Cabeceras: renombrar una columna del jugador la renombra también en Lesiones; el nombre no se esconde", async () => {
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar(filaDeAjuste("Cabeceras"));
    await tocar(filaDeAjuste("Categoría"));
    await escribir(hojaDeAjuste().querySelector("input[type=text]"), "Categoría actual");
    await tocar(boton(document.body, "Guardar"));
    expect(registro.ajustes).toEqual([{ tabla: "campos", campo: "categoria", etiquetas: { "es-AR": "Categoría actual", "pt-BR": "Categoria" }, oculto: false, orden: 0 }]);
    expect(filaDeAjuste("Categoría actual")).toBeTruthy();
    await tocar(filaDeAjuste("Nombre y apellido"));
    expect(hojaDeAjuste().textContent).toContain("Es el nombre de cada jugador: siempre se muestra.");
    expect(boton(document.body, "Oculta")).toBeUndefined();
    await tocar(boton(document.body, "Cancelar"));
    await irA(contenedor, "Jugadores");
    expect(cabeceras()[2]).toBe("Categoría actual");
  });

  test("Ajustes › Listas: se suma una opción a la categoría y se puede elegir en la tabla", async () => {
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar(filaDeAjuste("Listas"));
    expect(filasDeAjustes()).toEqual(["Categoría", "Pie dominante", "Posición"]);
    await tocar(filaDeAjuste("Categoría"));
    expect(filasDeAjustes()).toContain("Sub-20");
    await tocar(boton(contenedor, "Agregar una opción"));
    await escribir(hojaDeAjuste().querySelector("input[type=text]"), "Sub-21");
    await tocar(boton(document.body, "Guardar"));
    expect(registro.ajustes).toEqual([
      expect.objectContaining({ tabla: "opciones", campo: "categoria", codigo: expect.stringMatching(/^sub_21_/), etiquetas: { "es-AR": "Sub-21", "pt-BR": "" }, oculto: false }),
    ]);
    expect(filasDeAjustes()).toContain("Sub-21");
    await irA(contenedor, "Jugadores");
    await tocar(celda(contenedor, 1, 2));
    await tocar(celda(contenedor, 1, 2));
    expect([...document.body.querySelectorAll(".opcion-hoja")].map((b) => b.textContent.trim())).toContain("Sub-21");
  });

  test("Ajustes: sin el SQL nuevo, esconder una columna dice qué falta; en solo lectura no se cambia nada", async () => {
    registro.faltaSqlAjustes = true;
    await montar();
    await irA(contenedor, "Ajustes");
    await tocar(filaDeAjuste("Cabeceras"));
    await tocar(filaDeAjuste("Horas previas"));
    await tocar(boton(document.body, "Oculta"));
    await tocar(boton(document.body, "Guardar"));
    expect(hojaDeAjuste().textContent).toContain("Falta correr el SQL de los Ajustes de Datos básicos (20261028_datos_basicos_ajustes.sql).");
    await tocar(boton(document.body, "Cancelar"));
    await act(async () => raiz.unmount());
    raiz = createRoot(contenedor);
    registro.equipo = { id: "eq-1", nombre: "Atlético Mineiro", hasta: "2026-09-25" };
    await montar({ partido: true, flujo: true, lesiones: false, datos: true });
    await irA(contenedor, "Ajustes");
    expect(filaDeAjuste("Cabeceras").disabled).toBe(true);
    expect(filaDeAjuste("Listas").disabled).toBe(true);
    // Los dispositivos se miran igual.
    expect(filaDeAjuste("Catapult").disabled).toBe(false);
  });

  test("muestra los jugadores en la tabla estilo Excel con los datos que piden los módulos", async () => {
    await montar();
    expect(texto(contenedor)).toContain("2 jugadores");
    const cabeceras = [...contenedor.querySelectorAll("th[data-columna]")].map((th) => th.textContent);
    expect(cabeceras).toEqual(["Nombre y apellido", "Actual", "Categoría", "Fecha de nacimiento", "Edad", "Pie dominante", "Posición", "Foto (enlace)", "Horas previas"]);
    const hulk = contenedor.querySelector("tbody tr");
    expect(hulk.textContent).toContain("HULK");
    expect(hulk.textContent).toContain("25/07/1986");
    expect(hulk.textContent).toContain("Izquierdo");
    expect(hulk.textContent).toMatch(/\d\d años/);
    // La edad se calcula sola.
    expect(celda(contenedor, 0, 4).classList.contains("fija")).toBe(true);

    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    expect(texto(contenedor)).toContain("2 jogadores");
    expect(contenedor.querySelector("tbody tr").textContent).toContain("Esquerdo");
  });

  test("la edad se cumple el día del cumpleaños, como en Lesiones", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T12:00:00"));
    try {
      registro.plantel = [
        { ...plantelInicial()[0], fecha_nacimiento: "2000-10-06" },
        { ...plantelInicial()[1], fecha_nacimiento: "2000-10-07" },
      ];
      await montar();
      expect(celda(contenedor, 0, 4).textContent).toBe("26 años");
      expect(celda(contenedor, 1, 4).textContent).toBe("25 años");
    } finally {
      vi.useRealTimers();
    }
  });

  test("Actual: un toque marca o desmarca al jugador y se guarda al toque; el filtro deja solo el plantel de hoy", async () => {
    await montar();
    expect(texto(contenedor)).toContain("2 jugadores · 2 en el plantel actual");
    const casilla = (fila) => celda(contenedor, fila, 1).querySelector("input[type=checkbox]");
    const nombres = () => [...contenedor.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent);
    expect(casilla(0).checked).toBe(true);
    await tocar(casilla(0));
    expect(registro.guardados).toEqual([{ id: 7, actual: false }]);
    // Quien ya no está baja al final en el momento (Santiago, 17/10).
    expect(nombres()).toEqual(["SCARPA", "HULK"]);
    expect(casilla(1).checked).toBe(false);
    expect(texto(contenedor)).toContain("2 jugadores · 1 en el plantel actual");

    // El filtro de la cabecera: Sí / No.
    const filtro = contenedor.querySelector('.tabla-datos-filtro[aria-label="Filtrar u ordenar Actual"]');
    const valores = () => [...contenedor.querySelectorAll(".tabla-datos-valores label")];
    const botonDe = (etiqueta) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === etiqueta);
    await tocar(filtro);
    expect(valores().map((label) => label.textContent)).toEqual(["No1", "Sí1"]);
    await tocar(botonDe("Ninguno"));
    await tocar(valores()[1].querySelector("input"));
    await tocar(botonDe("Aplicar"));
    expect([...contenedor.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent)).toEqual(["SCARPA"]);
    await tocar(botonDe("Quitar filtros"));

    // Se vuelve a marcar: vuelve a su lugar.
    await tocar(casilla(1));
    expect(registro.guardados).toEqual([
      { id: 7, actual: false },
      { id: 7, actual: true },
    ]);
    expect(nombres()).toEqual(["HULK", "SCARPA"]);
    expect(casilla(0).checked).toBe(true);
  });

  test("Actual: quien ya no está va en otro color al toque, con la leyenda; si no se guarda, vuelve como estaba", async () => {
    await montar();
    const fila = (n) => contenedor.querySelectorAll("tbody tr")[n];
    const casilla = (n) => celda(contenedor, n, 1).querySelector("input[type=checkbox]");
    // Sin nadie desmarcado, la leyenda no se ve pero guarda su lugar.
    expect(contenedor.querySelector(".tabla-datos-leyenda").classList.contains("oculta")).toBe(true);
    expect(fila(0).classList.contains("apagada")).toBe(false);

    let soltar;
    registro.esperaGuardar = new Promise((resolver) => {
      soltar = resolver;
    });
    await tocar(casilla(0));
    // Mientras se guarda, ya se ve: el color, la leyenda, el contador y que
    // baja al final (ahora es la segunda fila).
    expect(registro.guardados).toEqual([{ id: 7, actual: false }]);
    expect(fila(1).textContent).toContain("HULK");
    expect(fila(1).classList.contains("apagada")).toBe(true);
    expect(fila(0).classList.contains("apagada")).toBe(false);
    expect(contenedor.querySelector(".tabla-datos-leyenda").textContent).toBe("En este color, los que ya no están en el plantel actual (Datos básicos › Actual).");
    expect(contenedor.querySelector(".tabla-datos-leyenda").classList.contains("oculta")).toBe(false);
    expect(fila(1).title).toBe("Ya no está");
    expect(texto(contenedor)).toContain("2 jugadores · 1 en el plantel actual");
    await act(async () => soltar());
    registro.esperaGuardar = null;
    expect(fila(1).classList.contains("apagada")).toBe(true);

    // Sin el SQL, marcarlo de nuevo no se guarda: vuelve a como estaba.
    registro.fallarGuardar = "datos.error.faltaActual";
    await tocar(casilla(1));
    expect(casilla(1).checked).toBe(false);
    expect(fila(1).textContent).toContain("HULK");
    expect(fila(1).classList.contains("apagada")).toBe(true);
    expect(texto(contenedor)).toContain("2 jugadores · 1 en el plantel actual");
    expect(texto(contenedor)).toContain("20261011_jugadores_actual.sql");
  });

  // Nota de Santiago (17/10, en un cuestionario: «Siempre al final», «Sí, en
  // el momento», «Solo Datos básicos»).
  test("los que ya no están van al final, también al ordenar por una columna", async () => {
    const jugador = (id, nombre, fecha_nacimiento, actual) => ({ ...plantelInicial()[1], id, nombre, fecha_nacimiento, actual });
    registro.plantel = [jugador(21, "ALFA", "1985-03-01", false), jugador(22, "BETA", "1990-03-01", true), jugador(23, "GAMA", "1995-03-01", true)];
    await montar();
    const nombres = () => [...contenedor.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent);
    expect(nombres()).toEqual(["BETA", "GAMA", "ALFA"]);
    const ordenar = async (sentido) => {
      await tocar(contenedor.querySelector('.tabla-datos-filtro[aria-label="Filtrar u ordenar Fecha de nacimiento"]'));
      await tocar([...contenedor.querySelectorAll(".chip-criterio")].find((b) => b.textContent === sentido));
    };
    // ALFA es el mayor, pero ya no está: sigue abajo.
    await ordenar("De menor a mayor");
    expect(nombres()).toEqual(["BETA", "GAMA", "ALFA"]);
    await ordenar("De mayor a menor");
    expect(nombres()).toEqual(["GAMA", "BETA", "ALFA"]);
    // La tabla recuerda el orden mientras la app está abierta: se saca.
    await tocar([...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim() === "Quitar filtros"));
    expect(nombres()).toEqual(["BETA", "GAMA", "ALFA"]);
  });

  test("Actual: si no se guarda pero mientras tanto se pegó y guardó lo mismo, no vuelve atrás", async () => {
    await montar();
    const fila = (n) => contenedor.querySelectorAll("tbody tr")[n];
    const casilla = (n) => celda(contenedor, n, 1).querySelector("input[type=checkbox]");
    let soltar;
    const esperar = new Promise((resolver) => {
      soltar = resolver;
    });
    // El toque tarda y falla; lo pegado (No) se guarda bien.
    registro.plan = [{ esperar, error: "datos.error.guardar" }, {}];
    await tocar(casilla(0));
    const pegado = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pegado, "clipboardData", { value: { getData: () => "No" } });
    await act(async () => contenedor.querySelector(".tabla-datos-marco").dispatchEvent(pegado));
    expect(registro.guardados).toEqual([
      { id: 7, actual: false },
      { id: 7, actual: false },
    ]);
    await act(async () => soltar());
    // En la base quedó false: la pantalla también (la fila bajó al final y
    // lo pegado fue igual a la suya).
    expect(fila(1).textContent).toContain("HULK");
    expect(casilla(1).checked).toBe(false);
    expect(fila(1).classList.contains("apagada")).toBe(true);
    expect(texto(contenedor)).toContain("2 jugadores · 1 en el plantel actual");
  });

  test("una fecha de nacimiento pegada con el año en dos cifras es del siglo pasado, no del que viene", async () => {
    await montar();
    // SCARPA, sin fecha de nacimiento todavía.
    await tocar(celda(contenedor, 1, 3));
    const pegado = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pegado, "clipboardData", { value: { getData: () => "25/07/86" } });
    await act(async () => contenedor.querySelector(".tabla-datos-marco").dispatchEvent(pegado));
    expect(registro.guardados).toEqual([{ id: 8, fecha_nacimiento: "1986-07-25" }]);
    expect(celda(contenedor, 1, 3).textContent).toBe("25/07/1986");
  });

  test("las horas previas se escriben como 30:14:20 y se guardan como horas", async () => {
    await montar();
    const horas = () => celda(contenedor, 0, 8);
    await tocar(horas());
    await tocar(horas());
    const entrada = horas().querySelector("input");
    expect(entrada.placeholder).toBe("0:00");
    await escribir(entrada, "30:14:20");
    await act(async () => entrada.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(registro.guardados).toHaveLength(1);
    expect(registro.guardados[0].id).toBe(7);
    expect(registro.guardados[0].horas_previas).toBeCloseTo(30 + 14 / 60 + 20 / 3600, 10);
    expect(horas().textContent).toBe("30:14:20");
    // Lo que no son horas no se guarda (la celda ya está elegida: un toque la abre).
    await tocar(horas());
    await escribir(horas().querySelector("input"), "muchas");
    await act(async () => horas().querySelector("input").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(registro.guardados).toHaveLength(1);
    expect(horas().textContent).toBe("30:14:20");
    expect(texto(contenedor)).toContain("Las horas se escriben así: 30:14:20, 30:14 o 30,5.");
  });

  test("quien ya se fue del club ve a los jugadores y no puede cambiar nada", async () => {
    registro.equipo = { id: "eq-1", nombre: "Atlético Mineiro", hasta: "2026-09-25" };
    await montar();
    expect(texto(contenedor)).toContain("Dejaste este club el 25/09/2026.");
    expect(texto(contenedor)).toContain("HULK");
    expect(boton(contenedor, "Agregar jugador")).toBeUndefined();
    expect(boton(contenedor, "Borrar fila")).toBeUndefined();
    expect(boton(contenedor, "Pegar")).toBeUndefined();
    expect(boton(contenedor, "Pegar desde Excel")).toBeUndefined();
    expect(boton(contenedor, "Copiar")).toBeTruthy();
    expect([...contenedor.querySelectorAll("th[data-columna]")].every((th) => th.classList.contains("fija"))).toBe(true);
    // Actual se ve, pero no se cambia.
    expect(celda(contenedor, 0, 1).querySelector("input[type=checkbox]").disabled).toBe(true);
    await tocar(celda(contenedor, 1, 5));
    await tocar(celda(contenedor, 1, 5));
    expect(contenedor.querySelector(".opcion-hoja")).toBeNull();
    expect(registro.guardados).toEqual([]);
  });

  test("con Datos básicos en «Solo lectura» ve a los jugadores al día y no puede cambiar nada", async () => {
    registro.equipo = { id: "eq-1", nombre: "Atlético Mineiro", hasta: null, solo_lectura: ["datos"] };
    await montar();
    expect(texto(contenedor)).toContain("Tenés Datos básicos en solo lectura.");
    expect(texto(contenedor)).not.toContain("Dejaste este club");
    expect(texto(contenedor)).toContain("HULK");
    expect(boton(contenedor, "Agregar jugador")).toBeUndefined();
    expect(boton(contenedor, "Borrar fila")).toBeUndefined();
    expect(boton(contenedor, "Pegar desde Excel")).toBeUndefined();
    expect(celda(contenedor, 0, 1).querySelector("input[type=checkbox]").disabled).toBe(true);
    await tocar(celda(contenedor, 1, 5));
    await tocar(celda(contenedor, 1, 5));
    expect(contenedor.querySelector(".opcion-hoja")).toBeNull();
    await irA(contenedor, "Ajustes");
    expect(texto(contenedor)).toContain("Tenés Datos básicos en solo lectura.");
    expect(filaDeAjuste("Cabeceras").disabled).toBe(true);
    expect(filaDeAjuste("Listas").disabled).toBe(true);
    expect(registro.guardados).toEqual([]);
  });

  test("se cambia el pie dominante desde la celda, se agrega un jugador y se borra otro", async () => {
    await montar();
    // Dos toques en una celda de lista abren la hoja de opciones.
    await tocar(celda(contenedor, 1, 5));
    await tocar(celda(contenedor, 1, 5));
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Derecho"));
    expect(registro.guardados).toEqual([{ id: 8, pie_dominante: "direito" }]);
    expect(celda(contenedor, 1, 5).textContent).toBe("Derecho");

    await escribir(contenedor.querySelector(".datos-agregar input"), "lemos");
    // Sin la fecha de nacimiento no se agrega (es obligatoria).
    expect(boton(contenedor, "Agregar jugador").disabled).toBe(true);
    await escribir(contenedor.querySelector('.datos-agregar input[type="date"]'), "2001-04-02");
    await tocar(boton(contenedor, "Agregar jugador"));
    await act(async () => Promise.resolve());
    expect(registro.agregados).toEqual([{ equipoId: "eq-1", nombre: "lemos" }]);
    expect(registro.guardados.at(-1)).toEqual({ id: 9, fecha_nacimiento: "2001-04-02" });
    expect(texto(contenedor)).toContain("Jugador agregado");
    expect(texto(contenedor)).toContain("3 jugadores");
    expect([...contenedor.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent)).toEqual(["HULK", "LEMOS", "SCARPA"]);

    await tocar(celda(contenedor, 1, 0));
    await tocar(boton(contenedor, "Borrar fila"));
    expect(texto(contenedor)).toContain("¿Borrar al jugador?");
    expect(texto(contenedor)).toContain("LEMOS sale de la lista");
    await tocar(boton(contenedor, "Sí, borrar"));
    await act(async () => Promise.resolve());
    expect(registro.borrados).toEqual([9]);
    expect(texto(contenedor)).toContain("2 jugadores");

    // Con Shift, las dos filas: se pregunta una vez; el que no se puede borrar, queda.
    registro.noSeBorran = [7];
    await tocar(celda(contenedor, 0, 0));
    await act(async () => celda(contenedor, 1, 0).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true })));
    await tocar(boton(contenedor, "Borrar 2 filas"));
    expect(texto(contenedor)).toContain("¿Borrar 2 jugadores?");
    await tocar(boton(contenedor, "Sí, borrar"));
    await act(async () => Promise.resolve());
    expect(texto(contenedor)).toContain("Tiene lesiones, evaluaciones o datos del GPS cargados y no se puede borrar: si ya no está en el club, desmarcá Actual. Filas borradas: 1 de 2.");
    expect(texto(contenedor)).toContain("1 jugador");
  });

  test("se pega la hoja Datos Básicos del Excel: antes de cargar se ve qué pasa con cada jugador", async () => {
    await montar();
    await tocar(boton(contenedor, "Pegar desde Excel"));
    expect(texto(contenedor)).toContain("copiá la tabla de Datos Básicos junto con la fila de cabeceras");
    expect(boton(contenedor, "Nada para cargar").disabled).toBe(true);
    const textarea = contenedor.querySelector(".datos-importar-pegado textarea");

    // Sin cabeceras no se adivina.
    await escribir(textarea, "Ana Uno\tProfissional");
    expect(texto(contenedor)).toContain("No encontré la fila de cabeceras");

    await escribir(
      textarea,
      [
        "Voltar ao menu inicial\tNome e Sobrenome\tCategoria\tD. Nac. (DD/MM/AAAA)\tP. Dominante\tPosicao\tLinks das fotos",
        "\tHulk\tProfissional\t25/07/1986\tEsquerdo\tDELANTERO CENTRAL\t",
        "\tGustavo Scarpa\tProfissional\t05/01/1994\tEsquerdo\tVOLANTE OFENSIVO\thttps://fotos.example/scarpa.jpg",
        "\tLemos Nuevo\tSub-20\t10/03/2006\tDireito\tCARRILERO\t",
        "\tOtro Nuevo\tProfissional\t\t\t\t",
      ].join("\n"),
    );
    expect(texto(contenedor)).toContain("4 jugadores en lo pegado");
    expect(texto(contenedor)).toContain("2 nuevos · 0 con cambios · 1 sin cambios · 1 para confirmar");
    const filas = () => [...contenedor.querySelectorAll(".datos-importar-lista li")];
    const destinos = () => filas().map((li) => li.querySelector(".datos-importar-destino").textContent);
    // HULK ya tiene todo; SCARPA se sugiere por el apellido; los otros dos son nuevos.
    expect(destinos()).toEqual(["Es HULK", "¿Es SCARPA?", "Jugador nuevo", "Jugador nuevo"]);
    expect(filas()[0].textContent).toContain("Ya tiene estos datos.");
    expect(filas()[2].textContent).toContain("Trae: Categoría, Fecha de nacimiento, Pie dominante");
    expect(filas()[2].textContent).toContain("«CARRILERO» no se entendió en Posición: queda como está.");
    // Un nombre solo parecido no se carga hasta que alguien confirma quién es.
    expect(filas()[1].textContent).toContain("Si es él, cambia: Categoría, Fecha de nacimiento, Pie dominante, Posición, Foto (enlace)");
    // Otro Nuevo no trae fecha de nacimiento (obligatoria): en rojo y, hasta
    // completarla, no se carga nada.
    expect(filas()[3].classList.contains("falta-fecha")).toBe(true);
    expect(filas()[3].textContent).toContain("Falta la fecha de nacimiento: es obligatoria. Cargala acá.");
    expect(texto(contenedor)).toContain("Falta la fecha de nacimiento de 1 jugador nuevo");
    expect(boton(contenedor, "Cargar 1 jugador").disabled).toBe(true);
    await tocar(boton(contenedor, "Sí, es SCARPA"));
    expect(destinos()[1]).toBe("Es SCARPA");
    expect(filas()[1].textContent).toContain("Cambia: Categoría, Fecha de nacimiento, Pie dominante, Posición, Foto (enlace)");
    expect(texto(contenedor)).toContain("2 nuevos · 1 con cambios · 1 sin cambios");
    expect(boton(contenedor, "Cargar 2 jugadores").disabled).toBe(true);

    // Quién es cada fila se corrige a mano: la última no se carga.
    await tocar(filas()[3].querySelector(".datos-importar-destino"));
    expect(texto(contenedor)).toContain("¿Quién es Otro Nuevo en la app?");
    // HULK y SCARPA ya son de otras filas: no se ofrecen.
    expect([...contenedor.querySelectorAll(".opcion-hoja")].map((b) => b.textContent.trim())).toEqual(["Jugador nuevo", "No cargar"]);
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "No cargar"));
    expect(destinos()[3]).toBe("No cargar");
    // Sin cargarlo, ya no hace falta su fecha.
    expect(texto(contenedor)).not.toContain("Falta la fecha de nacimiento de");
    expect(boton(contenedor, "Cargar 2 jugadores").disabled).toBe(false);

    await tocar(boton(contenedor, "Cargar 2 jugadores"));
    await act(async () => Promise.resolve());
    expect(registro.agregados).toEqual([{ equipoId: "eq-1", nombre: "Lemos Nuevo" }]);
    expect(registro.guardados).toEqual([
      { id: 8, categoria: "profissional", fecha_nacimiento: "1994-01-05", pie_dominante: "esquerdo", posicion: "volante_ofensivo", foto_url: "https://fotos.example/scarpa.jpg" },
      { id: 9, categoria: "sub20", fecha_nacimiento: "2006-03-10", pie_dominante: "direito" },
    ]);
    // Termina en la tabla, con el plantel nuevo.
    expect(texto(contenedor)).toContain("Listo: 1 nuevo y 1 actualizado.");
    expect(texto(contenedor)).toContain("3 jugadores");
    expect([...contenedor.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent)).toEqual(["HULK", "LEMOS NUEVO", "SCARPA"]);
  });

  test("si una fila no se puede cargar, se dice cuál y por qué; lo cargado y lo elegido a mano quedan", async () => {
    registro.fallarAgregar = "Ana Rara";
    await montar();
    await tocar(boton(contenedor, "Pegar desde Excel"));
    await escribir(
      contenedor.querySelector(".datos-importar-pegado textarea"),
      "Nome e Sobrenome\tCategoria\tD. Nac. (DD/MM/AAAA)\nAna Rara\tSub-20\t01/02/2003\nBea Bien\tSub-20\t02/03/2004\nHulk Paraíba\tSub-20\t03/04/2005",
    );
    const destinos = () => [...contenedor.querySelectorAll(".datos-importar-destino")].map((b) => b.textContent);
    // "Hulk Paraíba" parece HULK: alguien decide que no es él y que no se carga.
    expect(destinos()).toEqual(["Jugador nuevo", "Jugador nuevo", "¿Es HULK?"]);
    await tocar(contenedor.querySelectorAll(".datos-importar-destino")[2]);
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "No cargar"));
    await tocar(boton(contenedor, "Cargar 2 jugadores"));
    await act(async () => Promise.resolve());
    expect(texto(contenedor)).toContain("1 jugador no se pudo cargar:");
    expect(texto(contenedor)).toContain("Ana Rara: Ese jugador ya está en la lista.");
    // Bea ya está; lo elegido a mano para la otra fila se respeta: solo queda Ana.
    expect(destinos()).toEqual(["Jugador nuevo", "Es BEA BIEN", "No cargar"]);
    expect(boton(contenedor, "Cargar 1 jugador")).toBeTruthy();
    expect(registro.guardados).toEqual([{ id: 9 + 1, categoria: "sub20", fecha_nacimiento: "2004-03-02" }]);
    await tocar(boton(contenedor, "Volver"));
    expect(texto(contenedor)).toContain("3 jugadores");
  });

  // Santiago, 17/10: nombre y fecha de nacimiento obligatorios; con la misma
  // fecha que otro, «¿Es el mismo jugador?» por cada uno con esa fecha.
  const conFechas = () => [
    { ...plantelInicial()[1], id: 31, nombre: "ALFA", fecha_nacimiento: "1990-01-01" },
    { ...plantelInicial()[1], id: 32, nombre: "BETA", fecha_nacimiento: "1990-01-01", actual: false },
    { ...plantelInicial()[1], id: 33, nombre: "GAMA", fecha_nacimiento: "1995-05-05" },
  ];
  const agregarA = async (nombre, fecha) => {
    await escribir(contenedor.querySelector(".datos-agregar input"), nombre);
    await escribir(contenedor.querySelector('.datos-agregar input[type="date"]'), fecha);
    await tocar(boton(contenedor, "Agregar jugador"));
    await act(async () => Promise.resolve());
  };
  const hoja = () => document.body.querySelector(".hoja-confirmar");

  test("al pegar: la fecha que falta se carga ahí y, con la misma fecha que otro, se pregunta si es el mismo", async () => {
    registro.plantel = conFechas();
    await montar();
    await tocar(boton(contenedor, "Pegar desde Excel"));
    await escribir(
      contenedor.querySelector(".datos-importar-pegado textarea"),
      "Nome e Sobrenome\tD. Nac. (DD/MM/AAAA)\nDELTA\t\nEPSILON\t05/05/1995",
    );
    const filas = () => [...contenedor.querySelectorAll(".datos-importar-lista li")];
    const destinos = () => [...contenedor.querySelectorAll(".datos-importar-destino")].map((b) => b.textContent);
    // DELTA no trae fecha: en rojo; EPSILON tiene la de GAMA: la pregunta.
    expect(filas()[0].classList.contains("falta-fecha")).toBe(true);
    expect(filas()[1].textContent).toContain("Esta fecha de nacimiento ya está registrada con este nombre: GAMA. ¿Es el mismo jugador?");
    expect(texto(contenedor)).toContain("Falta responder en 1 fila si es el mismo jugador.");
    expect(boton(contenedor, "Nada para cargar").disabled).toBe(true);
    // La fecha de DELTA, cargada en la web: también tiene la de otros dos.
    await escribir(filas()[0].querySelector('input[type="date"]'), "1990-01-01");
    expect(filas()[0].classList.contains("falta-fecha")).toBe(false);
    expect(filas()[0].textContent).toContain("ya está registrada con este nombre: ALFA.");
    await tocar([...filas()[0].querySelectorAll("button")].find((b) => b.textContent === "No, es otro"));
    expect(filas()[0].textContent).toContain("ya está registrada con este nombre: BETA · Ya no está.");
    await tocar([...filas()[0].querySelectorAll("button")].find((b) => b.textContent === "No, es otro"));
    // EPSILON es GAMA: no se carga.
    await tocar([...filas()[1].querySelectorAll("button")].find((b) => b.textContent === "Sí, es el mismo"));
    expect(destinos()).toEqual(["Jugador nuevo", "No se carga: es GAMA"]);
    expect(texto(contenedor)).not.toContain("Falta responder");
    await tocar(boton(contenedor, "Cargar 1 jugador"));
    await act(async () => Promise.resolve());
    expect(registro.agregados).toEqual([{ equipoId: "eq-1", nombre: "DELTA" }]);
    expect(registro.guardados).toEqual([{ id: 9, fecha_nacimiento: "1990-01-01" }]);
  });

  test("con la misma fecha de nacimiento que otro, pregunta si es el mismo: «Sí» no lo agrega", async () => {
    registro.plantel = conFechas();
    await montar();
    await agregarA("DELTA", "1990-01-01");
    expect(registro.agregados).toEqual([]);
    expect(hoja().textContent).toContain("¿Es el mismo jugador?");
    expect(hoja().textContent).toContain("Esta fecha de nacimiento (01/01/1990) ya está registrada con este nombre: ALFA.");
    expect(hoja().textContent).toContain("Estás agregando a DELTA.");
    await tocar(boton(document.body, "Sí, es el mismo"));
    expect(hoja()).toBeNull();
    expect(registro.agregados).toEqual([]);
    expect(texto(contenedor)).toContain("No se agregó: ALFA ya está en la lista.");
    expect(texto(contenedor)).toContain("3 jugadores");
  });

  test("con la misma fecha: «No» pregunta por el siguiente (aunque ya no esté) y, sin más, lo agrega", async () => {
    registro.plantel = conFechas();
    await montar();
    await agregarA("DELTA", "1990-01-01");
    await tocar(boton(document.body, "No, es otro"));
    expect(hoja().textContent).toContain("ya está registrada con este nombre: BETA · Ya no está.");
    expect(registro.agregados).toEqual([]);
    await tocar(boton(document.body, "No, es otro"));
    await act(async () => Promise.resolve());
    expect(hoja()).toBeNull();
    expect(registro.agregados).toEqual([{ equipoId: "eq-1", nombre: "DELTA" }]);
    expect(registro.guardados.at(-1)).toMatchObject({ fecha_nacimiento: "1990-01-01" });
    expect(texto(contenedor)).toContain("Jugador agregado");
    // Cerrar la pregunta no agrega ni descarta: el formulario queda.
    await agregarA("EPSILON", "1995-05-05");
    await act(async () => document.body.querySelector(".velo-dialogo").dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    expect(hoja()).toBeNull();
    expect(registro.agregados).toHaveLength(1);
    expect(contenedor.querySelector(".datos-agregar input").value).toBe("EPSILON");
  });

  test("la fecha de nacimiento no se borra; los que no la tienen se avisan y se ven aparte", async () => {
    await montar();
    // SCARPA no tiene fecha: el aviso y, al tocarlo, solo él.
    expect(contenedor.querySelector(".datos-sin-fecha").textContent).toContain("1 jugador sin fecha de nacimiento, que es obligatoria.");
    await tocar(boton(contenedor, "Ver cuál"));
    expect([...contenedor.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent)).toEqual(["SCARPA"]);
    await tocar(boton(contenedor, "Ver todos"));
    expect(contenedor.querySelectorAll("tbody tr")).toHaveLength(2);
    // La de HULK no se puede dejar vacía.
    const fecha = () => celda(contenedor, 0, 3);
    await tocar(fecha());
    await tocar(fecha());
    await escribir(fecha().querySelector("input"), "");
    await act(async () => fecha().querySelector("input").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(registro.guardados).toEqual([]);
    expect(texto(contenedor)).toContain("La fecha de nacimiento es obligatoria.");
    expect(fecha().textContent).toBe("25/07/1986");
  });

  // Santiago, 17/10: al cambiar la categoría de alguien con lesiones, ¿en todo
  // su historial o desde una fecha? (solo Lesiones; de entrada, desde hoy).
  const conLesiones = () => ({
    7: [
      { id: "l1", fecha_lesion: "2026-01-10", datos: {} },
      { id: "l2", fecha_lesion: "2026-09-01", datos: { categoria: "profissional" } },
    ],
  });
  const cambiarCategoria = async (texto) => {
    await tocar(celda(contenedor, 0, 2));
    await tocar(celda(contenedor, 0, 2));
    await tocar([...document.body.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === texto));
  };

  test("cambiar la categoría de alguien con lesiones: «Desde esa fecha» deja las de antes con la que tenía", async () => {
    registro.lesiones = conLesiones();
    await montar();
    await cambiarCategoria("Sub-20");
    expect(registro.guardados).toEqual([]);
    expect(hoja().textContent).toContain("¿Cambia en todo su historial o desde una fecha?");
    expect(hoja().textContent).toContain("HULK pasa de Mayor (profesional) a Sub-20 y tiene 2 lesiones cargadas.");
    const fecha = hoja().querySelector('input[type="date"]');
    expect(fecha.value).toBe(hoyISO());
    await escribir(fecha, "2026-06-01");
    await tocar(boton(document.body, "Desde esa fecha"));
    await act(async () => Promise.resolve());
    expect(hoja()).toBeNull();
    expect(registro.guardados).toEqual([{ id: 7, categoria: "sub20" }]);
    expect(registro.categoriasDeLesiones).toEqual([
      { id: "l1", datos: { categoria: "profissional" } },
      { id: "l2", datos: { categoria: "sub20" } },
    ]);
    expect(celda(contenedor, 0, 2).textContent).toBe("Sub-20");
  });

  test("cambiar la categoría: «En todo su historial» la cambia en todas; cerrar no cambia nada", async () => {
    registro.lesiones = conLesiones();
    await montar();
    await cambiarCategoria("Sub-20");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    await act(async () => Promise.resolve());
    expect(hoja()).toBeNull();
    expect(registro.guardados).toEqual([]);
    expect(celda(contenedor, 0, 2).textContent).toBe("Mayor (profesional)");
    await cambiarCategoria("Sub-20");
    await tocar(boton(document.body, "En todo su historial"));
    await act(async () => Promise.resolve());
    expect(registro.guardados).toEqual([{ id: 7, categoria: "sub20" }]);
    expect(registro.categoriasDeLesiones).toEqual([
      { id: "l1", datos: { categoria: "sub20" } },
      { id: "l2", datos: { categoria: "sub20" } },
    ]);
  });

  test("con Lesiones en «Solo lectura» la categoría cambia sin preguntar y sus lesiones quedan como estaban", async () => {
    registro.lesiones = conLesiones();
    registro.equipo = { id: "eq-1", nombre: "Atlético Mineiro", hasta: null, lesiones: true, solo_lectura: ["lesiones"] };
    await montar();
    await cambiarCategoria("Sub-20");
    expect(hoja()).toBeNull();
    expect(registro.guardados).toEqual([{ id: 7, categoria: "sub20" }]);
    expect(registro.categoriasDeLesiones).toEqual([]);
  });

  test("cambiar la categoría de alguien sin lesiones no pregunta", async () => {
    await montar();
    await cambiarCategoria("Sub-20");
    expect(hoja()).toBeNull();
    expect(registro.guardados).toEqual([{ id: 7, categoria: "sub20" }]);
    expect(registro.categoriasDeLesiones).toEqual([]);
  });

  test("al pegar: si cambia la categoría de alguien con lesiones, se elige en su fila y hasta entonces no se carga", async () => {
    registro.lesiones = conLesiones();
    await montar();
    await tocar(boton(contenedor, "Pegar desde Excel"));
    await escribir(contenedor.querySelector(".datos-importar-pegado textarea"), "Nome e Sobrenome\tCategoria\nHulk\tSub-20");
    const fila = () => contenedor.querySelector(".datos-importar-lista li");
    expect(fila().textContent).toContain("Cambia la categoría de HULK: de Mayor (profesional) a Sub-20, y tiene 2 lesiones. ¿En todo su historial o desde una fecha?");
    expect(texto(contenedor)).toContain("0 nuevos · 1 con cambios · 0 sin cambios");
    expect(texto(contenedor)).toContain("Falta elegir en 1 fila desde cuándo cambia la categoría.");
    expect(boton(contenedor, "Nada para cargar").disabled).toBe(true);
    await tocar([...fila().querySelectorAll("button")].find((b) => b.textContent === "En todo su historial"));
    expect(fila().textContent).toContain("Categoría: en todo su historial.");
    await tocar(boton(contenedor, "Cargar 1 jugador"));
    await act(async () => Promise.resolve());
    expect(registro.guardados).toEqual([{ id: 7, categoria: "sub20" }]);
    expect(registro.categoriasDeLesiones).toEqual([
      { id: "l1", datos: { categoria: "sub20" } },
      { id: "l2", datos: { categoria: "sub20" } },
    ]);
  });

  test("un nombre que ya está en la lista no se agrega dos veces (y se dice en el idioma de la app)", async () => {
    registro.fallarAgregar = "HULK";
    await montar();
    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    await escribir(contenedor.querySelector(".datos-agregar input"), "HULK");
    await escribir(contenedor.querySelector('.datos-agregar input[type="date"]'), "2001-04-02");
    await tocar(boton(contenedor, "Adicionar jogador"));
    await act(async () => Promise.resolve());
    expect(texto(contenedor)).toContain("Esse jogador já está na lista.");
  });
});
