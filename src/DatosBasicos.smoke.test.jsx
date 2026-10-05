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
}));
// La base de mentira: el plantel cambia con lo que se agrega y se guarda.
vi.mock("./domain/lesionesDb.js", () => ({
  // Como la de verdad: ordenado por nombre.
  cargarPlantelLesiones: async () => ({
    plantel: registro.plantel.map((jugador) => ({ ...jugador })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    error: "",
  }),
  leerConfig: async () => ({ config: { campos: {}, listas: {} }, error: "" }),
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
  quitarJugadorBasico: async (id) => {
    registro.borrados.push(id);
    return { error: "" };
  },
}));

const { default: DatosBasicos } = await import("./DatosBasicos.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");

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

  test("los chalecos de Catapult están acá para quien tiene Flujo diario", async () => {
    await montar({ partido: true, flujo: true, lesiones: false, datos: true });
    await irA(contenedor, "Catapult");
    expect(texto(contenedor)).toContain("Chalecos de Catapult");
    expect(texto(contenedor)).toContain("2 jugadores · 0 con chaleco");
    await act(async () => raiz.unmount());
    raiz = createRoot(contenedor);
    await montar({ partido: true, flujo: false, lesiones: true, datos: true });
    expect([...contenedor.querySelectorAll(".navegacion-movil button")].map((b) => b.textContent)).toEqual(["Jugadores", "Posiciones"]);
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

  test("Actual: un toque marca o desmarca al jugador y se guarda al toque; el filtro deja solo el plantel de hoy", async () => {
    await montar();
    expect(texto(contenedor)).toContain("2 jugadores · 2 en el plantel actual");
    const casilla = (fila) => celda(contenedor, fila, 1).querySelector("input[type=checkbox]");
    expect(casilla(0).checked).toBe(true);
    await tocar(casilla(0));
    expect(registro.guardados).toEqual([{ id: 7, actual: false }]);
    expect(casilla(0).checked).toBe(false);
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

    // Se vuelve a marcar.
    await tocar(casilla(0));
    expect(registro.guardados).toEqual([
      { id: 7, actual: false },
      { id: 7, actual: true },
    ]);
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
    // Mientras se guarda, ya se ve: el color, la leyenda y el contador.
    expect(registro.guardados).toEqual([{ id: 7, actual: false }]);
    expect(fila(0).classList.contains("apagada")).toBe(true);
    expect(fila(1).classList.contains("apagada")).toBe(false);
    expect(contenedor.querySelector(".tabla-datos-leyenda").textContent).toBe("En este color, los que ya no están en el plantel actual (Datos básicos › Actual).");
    expect(contenedor.querySelector(".tabla-datos-leyenda").classList.contains("oculta")).toBe(false);
    expect(fila(0).title).toBe("Ya no está");
    expect(texto(contenedor)).toContain("2 jugadores · 1 en el plantel actual");
    await act(async () => soltar());
    registro.esperaGuardar = null;
    expect(fila(0).classList.contains("apagada")).toBe(true);

    // Sin el SQL, marcarlo de nuevo no se guarda: vuelve a como estaba.
    registro.fallarGuardar = "datos.error.faltaActual";
    await tocar(casilla(0));
    expect(casilla(0).checked).toBe(false);
    expect(fila(0).classList.contains("apagada")).toBe(true);
    expect(texto(contenedor)).toContain("2 jugadores · 1 en el plantel actual");
    expect(texto(contenedor)).toContain("20261011_jugadores_actual.sql");
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
    // En la base quedó false: la pantalla también.
    expect(casilla(0).checked).toBe(false);
    expect(fila(0).classList.contains("apagada")).toBe(true);
    expect(texto(contenedor)).toContain("2 jugadores · 1 en el plantel actual");
  });

  test("las horas previas se escriben como en el Excel (30:14:20) y se guardan como horas", async () => {
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
    expect(texto(contenedor)).toContain("Las horas se escriben como en el Excel");
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

  test("se cambia el pie dominante desde la celda, se agrega un jugador y se borra otro", async () => {
    await montar();
    // Dos toques en una celda de lista abren la hoja de opciones.
    await tocar(celda(contenedor, 1, 5));
    await tocar(celda(contenedor, 1, 5));
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Derecho"));
    expect(registro.guardados).toEqual([{ id: 8, pie_dominante: "direito" }]);
    expect(celda(contenedor, 1, 5).textContent).toBe("Derecho");

    await escribir(contenedor.querySelector(".datos-agregar input"), "lemos");
    await tocar(boton(contenedor, "Agregar jugador"));
    await act(async () => Promise.resolve());
    expect(registro.agregados).toEqual([{ equipoId: "eq-1", nombre: "lemos" }]);
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
    expect(boton(contenedor, "Cargar 2 jugadores")).toBeTruthy();
    await tocar(boton(contenedor, "Sí, es SCARPA"));
    expect(destinos()[1]).toBe("Es SCARPA");
    expect(filas()[1].textContent).toContain("Cambia: Categoría, Fecha de nacimiento, Pie dominante, Posición, Foto (enlace)");
    expect(texto(contenedor)).toContain("2 nuevos · 1 con cambios · 1 sin cambios");
    expect(boton(contenedor, "Cargar 3 jugadores")).toBeTruthy();

    // Quién es cada fila se corrige a mano: la última no se carga.
    await tocar(filas()[3].querySelector(".datos-importar-destino"));
    expect(texto(contenedor)).toContain("¿Quién es Otro Nuevo en la app?");
    // HULK y SCARPA ya son de otras filas: no se ofrecen.
    expect([...contenedor.querySelectorAll(".opcion-hoja")].map((b) => b.textContent.trim())).toEqual(["Jugador nuevo", "No cargar"]);
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "No cargar"));
    expect(destinos()[3]).toBe("No cargar");

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
      "Nome e Sobrenome\tCategoria\nAna Rara\tSub-20\nBea Bien\tSub-20\nHulk Paraíba\tSub-20",
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
    expect(registro.guardados).toEqual([{ id: 9 + 1, categoria: "sub20" }]);
    await tocar(boton(contenedor, "Volver"));
    expect(texto(contenedor)).toContain("3 jugadores");
  });

  test("un nombre que ya está en la lista no se agrega dos veces (y se dice en el idioma de la app)", async () => {
    registro.fallarAgregar = "HULK";
    await montar();
    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    await escribir(contenedor.querySelector(".datos-agregar input"), "HULK");
    await tocar(boton(contenedor, "Adicionar jogador"));
    await act(async () => Promise.resolve());
    expect(texto(contenedor)).toContain("Esse jogador já está na lista.");
  });
});
