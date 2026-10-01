import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const datos = vi.hoisted(() => ({
  lesiones: [],
  guardadas: [],
  actualizadas: [],
  borradas: [],
  cabeceras: [],
  opciones: [],
  jugadores: [],
}));

const lesionHulk = () => ({
  id: "les-1",
  equipo_id: "eq-1",
  jugador_id: 7,
  numero_caso: 1,
  fecha_lesion: "2026-09-20",
  fecha_transicion: null,
  fecha_retorno_entrenamiento: null,
  fecha_alta: null,
  datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "muscular_1a", diagnostico: "Desgarro" },
});

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => ({ id: "eq-1", nombre: "Atlético Mineiro" }),
  cargarEquipos: async () => ({ equipos: [] }),
  elegirEquipoInicial: () => null,
  guardarEquipoElegido: () => {},
  esElCam: (nombre) => nombre === "Atlético Mineiro",
}));
vi.mock("./domain/lesionesDb.js", () => ({
  listarLesiones: async () => ({ lesiones: datos.lesiones.map((l) => ({ ...l, datos: { ...l.datos } })), error: "" }),
  cargarPlantelLesiones: async () => ({
    plantel: [
      { id: 7, nombre: "HULK", roles: [], puestos: ["DEL"], numero_registro: "10", categoria: "profissional", fecha_nacimiento: "1986-07-25", pie_dominante: "esquerdo" },
      { id: 8, nombre: "SCARPA", roles: [], puestos: ["VOL"], numero_registro: "", categoria: "", fecha_nacimiento: "", pie_dominante: "" },
    ],
    error: "",
  }),
  leerConfig: async () => ({ config: { campos: {}, listas: {} }, error: "" }),
  crearLesion: async (equipoId, lesion) => {
    datos.guardadas.push({ equipoId, lesion });
    return { lesion: { ...lesion, id: "les-nueva", numero_caso: 2 }, error: "" };
  },
  actualizarLesion: async (id, lesion) => {
    datos.actualizadas.push({ id, lesion });
    return { lesion: { ...lesion, id }, error: "" };
  },
  borrarLesion: async (id) => {
    datos.borradas.push(id);
    return { error: "" };
  },
  historialDeLesion: async () => ({ cambios: [], error: "" }),
  guardarCampo: async (equipoId, campo, cambios) => {
    datos.cabeceras.push({ campo, ...cambios });
    return { error: "" };
  },
  guardarOpcion: async (equipoId, campo, opcion) => {
    datos.opciones.push({ campo, ...opcion });
    return { error: "" };
  },
  guardarDatosJugador: async (id, cambios) => {
    datos.jugadores.push({ id, ...cambios });
    return { jugador: { id, nombre: "SCARPA", roles: [], puestos: ["VOL"], ...cambios }, error: "" };
  },
}));

const { default: Lesiones } = await import("./Lesiones.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");
const { diasEntre, severidadPorDias } = await import("./domain/lesiones.js");
const { hoyISO } = await import("./idioma/formatos.js");

const texto = (contenedor) => contenedor.textContent;
const botones = (contenedor) => [...contenedor.querySelectorAll("button")];
const boton = (contenedor, etiqueta) => botones(contenedor).find((b) => b.textContent.trim() === etiqueta);
const botonQueEmpieza = (contenedor, etiqueta) => botones(contenedor).find((b) => b.textContent.trim().startsWith(etiqueta));
const tocar = async (elemento) => {
  expect(elemento, "no se encontró el botón").toBeTruthy();
  await act(async () => elemento.click());
};
const escribir = async (input, valor) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value").set;
    setter.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
// El selector negro con hoja: se toca el botón del campo y después la opción.
const elegirEnHoja = async (contenedor, etiquetaCampo, etiquetaOpcion) => {
  await tocar(contenedor.querySelector(`.selector-hoja[aria-label="${etiquetaCampo}"]`));
  await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === etiquetaOpcion));
};
const navegar = async (contenedor, etiqueta) =>
  tocar([...contenedor.querySelectorAll(".navegacion-movil button")].find((b) => b.textContent.includes(etiqueta)));

describe("el módulo Lesiones", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    datos.lesiones = [lesionHulk()];
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    contenedor.remove();
    ["guardadas", "actualizadas", "borradas", "cabeceras", "opciones", "jugadores"].forEach((clave) => {
      datos[clave].length = 0;
    });
  });

  const montar = async () => {
    await act(async () => raiz.render(<Lesiones onVolver={() => {}} />));
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
  };

  test("muestra las lesiones activas como fichas de Partido y cambia de idioma sin romperse", async () => {
    await montar();
    expect(texto(contenedor)).toContain("HULK");
    expect(texto(contenedor)).toContain("1 lesión activa");
    expect(texto(contenedor)).toContain("Muslo · Derecho · Lesión muscular grado 1 A");
    expect(contenedor.querySelector(".registro-guardado .lesiones-etapa").textContent).toBe("Lesionado");
    expect(boton(contenedor, "Ver detalle")).toBeTruthy();
    expect(boton(contenedor, "Alta médica")).toBeTruthy();

    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    expect(texto(contenedor)).toContain("1 lesão ativa");
    expect(texto(contenedor)).toContain("COXA · Direito · LESÃO MUSCULAR GRAU 1 A");
    expect(boton(contenedor, "Ver detalhes")).toBeTruthy();
  });

  test("la ficha muestra las columnas del Excel y desde ahí se edita", async () => {
    await montar();
    await tocar(boton(contenedor, "Ver detalle"));
    expect(texto(contenedor)).toContain("Caso 1");
    expect(texto(contenedor)).toContain("N° de registro10");
    expect(texto(contenedor)).toContain("Edad40 años");
    expect(texto(contenedor)).toContain("Pie dominanteIzquierdo");
    expect(texto(contenedor)).toContain("DiagnósticoDesgarro");
    await tocar(boton(contenedor, "Editar"));
    expect(texto(contenedor)).toContain("Editar lesión");
    const diagnostico = [...contenedor.querySelectorAll(".campo-inicio")].find((campo) => campo.textContent.startsWith("Diagnóstico")).querySelector("input");
    await escribir(diagnostico, "Desgarro grado 2");
    await tocar(boton(contenedor, "Guardar"));
    await act(async () => Promise.resolve());
    expect(datos.actualizadas).toHaveLength(1);
    expect(datos.actualizadas[0].lesion.datos.diagnostico).toBe("Desgarro grado 2");
    expect(texto(contenedor)).toContain("Lesión guardada");
  });

  test("carga una lesión nueva con los desplegables de Partido y la manda a la base", async () => {
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    expect(texto(contenedor)).toContain("Nueva lesión");
    await elegirEnHoja(contenedor, "Jugador", "SCARPA");
    // Los datos del jugador aparecen solos.
    expect(texto(contenedor)).toContain("Posición");
    await tocar(boton(contenedor, "Guardar"));
    expect(texto(contenedor)).toContain("Elegí la parte del cuerpo lesionada.");
    await elegirEnHoja(contenedor, "Parte del cuerpo lesionada", "Rodilla");
    await elegirEnHoja(contenedor, "Lado", "Izquierdo");
    await elegirEnHoja(contenedor, "Mecanismo", "Sprint");
    await tocar(boton(contenedor, "Guardar"));
    await act(async () => Promise.resolve());
    expect(datos.guardadas).toHaveLength(1);
    expect(datos.guardadas[0]).toMatchObject({
      equipoId: "eq-1",
      lesion: { jugador_id: 8, fecha_alta: null, datos: { parte_cuerpo: "joelho", lado: "esquerdo", mecanismo: "sprint" } },
    });
    // Después de guardar queda abierta la ficha.
    expect(texto(contenedor)).toContain("Caso 2");
    expect(texto(contenedor)).toContain("SCARPA");
  });

  test("el alta médica cierra la lesión y sugiere la severidad", async () => {
    await montar();
    await tocar(boton(contenedor, "Alta médica"));
    expect(texto(contenedor)).toContain("¿Dar el alta médica?");
    await tocar(boton(contenedor, "Sí, dar el alta"));
    await act(async () => Promise.resolve());
    expect(datos.actualizadas).toHaveLength(1);
    expect(datos.actualizadas[0].lesion.fecha_alta).toBeTruthy();
    expect(datos.actualizadas[0].lesion.fecha_alta).toBe(hoyISO());
    expect(datos.actualizadas[0].lesion.datos.severidad).toBe(severidadPorDias(diasEntre("2026-09-20", hoyISO())));
    expect(texto(contenedor)).toContain("Alta guardada");
    expect(texto(contenedor)).toContain("No hay lesiones activas");
  });

  test("una lesión se borra desde la ficha con confirmación", async () => {
    await montar();
    await tocar(contenedor.querySelector(".boton-eliminar-registro"));
    expect(texto(contenedor)).toContain("¿Borrar esta lesión?");
    await tocar(boton(contenedor, "Sí, borrar"));
    await act(async () => Promise.resolve());
    expect(datos.borradas).toEqual(["les-1"]);
    expect(texto(contenedor)).toContain("Lesión borrada");
  });

  test("el historial tiene el filtro de Partido: hoja de criterios y chips", async () => {
    datos.lesiones = [lesionHulk(), { ...lesionHulk(), id: "les-2", numero_caso: 2, jugador_id: 8, fecha_lesion: "2026-08-01", fecha_alta: "2026-08-20", datos: { parte_cuerpo: "joelho", lado: "esquerdo" } }];
    await montar();
    await navegar(contenedor, "Historial");
    expect(texto(contenedor)).toContain("2 lesiones");
    await tocar(contenedor.querySelector(".boton-filtro"));
    expect(texto(contenedor)).toContain("Filtrar por");
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Etapa"));
    expect(contenedor.querySelector(".criterio-elegido b").textContent).toBe("Etapa");
    await tocar([...contenedor.querySelectorAll(".chip-criterio")].find((b) => b.textContent.trim() === "Con alta"));
    expect(texto(contenedor)).toContain("1 lesión");
    expect(texto(contenedor)).toContain("SCARPA");
    expect(texto(contenedor)).not.toContain("HULK");
    // El icono prendido borra todo.
    await tocar(contenedor.querySelector(".boton-filtro"));
    expect(texto(contenedor)).toContain("2 lesiones");
    // Multi-Filtro: parte del cuerpo y jugador a la vez.
    await tocar(contenedor.querySelector(".boton-filtro"));
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Multi-Filtro"));
    await tocar([...contenedor.querySelectorAll(".chip-criterio")].find((b) => b.textContent.trim() === "Parte del cuerpo lesionada"));
    await tocar([...contenedor.querySelectorAll(".chip-criterio")].find((b) => b.textContent.trim() === "Rodilla"));
    expect(texto(contenedor)).toContain("SCARPA");
    expect(texto(contenedor)).not.toContain("HULK");
    // El buscador de texto.
    const buscador = contenedor.querySelector(".linea-buscador input");
    await escribir(buscador, "hulk");
    expect(texto(contenedor)).toContain("Ninguna lesión entra en ese filtro.");
  });

  test("el plantel abre los datos del Excel de cada jugador", async () => {
    await montar();
    await navegar(contenedor, "Plantel");
    expect(texto(contenedor)).toContain("1 de 2 disponibles");
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    expect(texto(contenedor)).toContain("Datos del jugador");
    const registro = [...contenedor.querySelectorAll(".campo-inicio")].find((campo) => campo.textContent.startsWith("N° de registro")).querySelector("input");
    await escribir(registro, "22");
    await elegirEnHoja(contenedor, "Pie dominante", "Derecho");
    await tocar(boton(contenedor, "Guardar"));
    await act(async () => Promise.resolve());
    expect(datos.jugadores[0]).toMatchObject({ id: 8, numero_registro: "22", pie_dominante: "direito" });
    expect(texto(contenedor)).toContain("Datos guardados");
  });

  test("en Ajustes se renombran cabeceras y se agregan opciones a las listas", async () => {
    await montar();
    await navegar(contenedor, "Ajustes");
    await tocar(botonQueEmpieza(contenedor, "Cabeceras"));
    await tocar(botonQueEmpieza(contenedor, "Parte del cuerpo lesionada"));
    expect(texto(contenedor)).toContain("Cabecera: Parte del cuerpo lesionada");
    const campos = [...contenedor.querySelectorAll(".lesiones-hoja .campo-inicio input")];
    expect(campos.map((input) => input.value)).toEqual(["Parte del cuerpo lesionada", "Parte do Corpo Lesionada"]);
    await escribir(campos[0], "Zona lesionada");
    await tocar(boton(contenedor, "Guardar"));
    await act(async () => Promise.resolve());
    expect(datos.cabeceras[0]).toMatchObject({ campo: "parte_cuerpo", etiquetas: { "es-AR": "Zona lesionada", "pt-BR": "Parte do Corpo Lesionada" }, oculto: false });

    await tocar(boton(contenedor, "Volver a Ajustes"));
    await tocar(botonQueEmpieza(contenedor, "Listas"));
    await tocar(botonQueEmpieza(contenedor, "Mecanismo"));
    expect(texto(contenedor)).toContain("15 opciones");
    await tocar(boton(contenedor, "Agregar una opción"));
    const nuevos = [...contenedor.querySelectorAll(".lesiones-hoja .campo-inicio input")];
    await tocar(boton(contenedor, "Guardar"));
    expect(texto(contenedor)).toContain("Escribí el nombre en al menos un idioma.");
    await escribir(nuevos[0], "Cabezazo");
    await tocar(boton(contenedor, "Guardar"));
    await act(async () => Promise.resolve());
    expect(datos.opciones[0]).toMatchObject({ campo: "mecanismo", etiquetas: { "es-AR": "Cabezazo", "pt-BR": "" }, oculto: false });
    expect(datos.opciones[0].codigo).toMatch(/^cabezazo_/);
  });

  test("la hoja de opciones larga tiene buscador que acerca lo escrito, y el historial se ve como tabla", async () => {
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    await tocar(contenedor.querySelector('.selector-hoja[aria-label="Tipo de lesión"]'));
    const buscador = contenedor.querySelector(".hoja-opciones .buscador-hoja input");
    expect(buscador).toBeTruthy();
    expect(contenedor.querySelectorAll(".opcion-hoja").length).toBeGreaterThan(20);
    await escribir(buscador, "fract");
    expect([...contenedor.querySelectorAll(".opcion-hoja")].map((b) => b.textContent)).toEqual(["Fractura"]);
    await escribir(buscador, "muscular grado 2");
    expect(contenedor.querySelectorAll(".opcion-hoja")).toHaveLength(3);
    await tocar(contenedor.querySelector(".opcion-hoja"));
    expect(contenedor.querySelector('.selector-hoja[aria-label="Tipo de lesión"] b').textContent).toBe("Lesión muscular grado 2 A");
    // Una hoja corta (Lado) no tiene buscador.
    await tocar(contenedor.querySelector('.selector-hoja[aria-label="Lado"]'));
    expect(contenedor.querySelector(".hoja-opciones .buscador-hoja")).toBeNull();
    await tocar(boton(contenedor, "Cancelar"));

    await navegar(contenedor, "Historial");
    await tocar([...contenedor.querySelectorAll(".cambiar-vista button")].find((b) => b.textContent === "Tabla"));
    const cabeceras = [...contenedor.querySelectorAll(".lesiones-tabla th")].map((th) => th.textContent);
    expect(cabeceras.slice(0, 3)).toEqual(["N° de caso", "N° de registro", "Nombre y apellido"]);
    expect(cabeceras).toHaveLength(35);
    const fila = contenedor.querySelector(".lesiones-tabla tbody tr");
    expect(fila.textContent).toContain("HULK");
    expect(fila.textContent).toContain("Muslo");
    await tocar(fila);
    expect(texto(contenedor)).toContain("Caso 1 · 20/09/2026 · Lesionado");
  });
});
