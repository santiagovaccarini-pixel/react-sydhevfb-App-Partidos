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
  datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "muscular_1a" },
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
      { id: 7, nombre: "HULK", roles: [], puestos: ["DEL"], categoria: "profissional", fecha_nacimiento: "1986-07-25", pie_dominante: "esquerdo", posicion: "delantero_central", foto_url: "" },
      { id: 8, nombre: "SCARPA", roles: [], puestos: ["VOL"], categoria: "", fecha_nacimiento: "", pie_dominante: "", posicion: "volante_central", foto_url: "" },
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
}));

const { default: Lesiones, PASOS } = await import("./Lesiones.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");
const { CAMPOS, etiquetaDeCampo, etiquetaDeOpcion } = await import("./domain/lesionesCampos.js");
const { hoyISO } = await import("./idioma/formatos.js");

const texto = (contenedor) => contenedor.textContent;
const botones = (contenedor) => [...contenedor.querySelectorAll("button")];
const boton = (contenedor, etiqueta) => botones(contenedor).find((b) => b.textContent.trim() === etiqueta);
const botonQueEmpieza = (contenedor, etiqueta) => botones(contenedor).find((b) => b.textContent.trim().startsWith(etiqueta));
const chip = (contenedor, etiqueta) => [...contenedor.querySelectorAll(".chip-criterio")].find((b) => b.textContent.trim() === etiqueta);
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
const campoDeFormulario = (contenedor, etiqueta) => [...contenedor.querySelectorAll(".campo-inicio")].find((campo) => campo.textContent.startsWith(etiqueta));
const navegar = async (contenedor, etiqueta) =>
  tocar([...contenedor.querySelectorAll(".navegacion-movil button")].find((b) => b.textContent.includes(etiqueta)));
const siguiente = (contenedor) => tocar(boton(contenedor, "Siguiente"));
const etiqueta = (clave) => etiquetaDeCampo(clave, null, "es-AR");

describe("el módulo Lesiones", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    localStorage.clear();
    datos.lesiones = [lesionHulk()];
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    raiz = createRoot(contenedor);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    contenedor.remove();
    ["guardadas", "actualizadas", "borradas", "cabeceras", "opciones"].forEach((clave) => {
      datos[clave].length = 0;
    });
  });

  const montar = async () => {
    await act(async () => raiz.render(<Lesiones onVolver={() => {}} />));
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
  };

  test("muestra las lesiones activas como fichas de Partido, con el diagnóstico calculado, y cambia de idioma", async () => {
    await montar();
    expect(texto(contenedor)).toContain("HULK");
    expect(texto(contenedor)).toContain("1 lesión activa");
    expect(texto(contenedor)).toContain("Lesión muscular grado 1 A Muslo Derecho");
    expect(contenedor.querySelector(".registro-guardado .lesiones-etapa").textContent).toBe("Lesionado");
    expect(boton(contenedor, "Ver detalle")).toBeTruthy();
    expect(boton(contenedor, "Alta médica")).toBeTruthy();
    // Sin pantalla de plantel: la barra tiene Lesionados, Historial, Base y Ajustes.
    expect([...contenedor.querySelectorAll(".navegacion-movil button")].map((b) => b.textContent.trim())).toEqual(["Lesionados", "Historial", "Base", "Ajustes"]);

    await act(async () => fijarIdiomaParaPruebas("pt-BR"));
    expect(texto(contenedor)).toContain("1 lesão ativa");
    expect(texto(contenedor)).toContain("LESÃO MUSCULAR GRAU 1 A COXA Direito");
    expect(boton(contenedor, "Ver detalhes")).toBeTruthy();
  });

  test("la ficha muestra las columnas del Excel, las calculadas incluidas, y desde ahí se edita por pasos", async () => {
    await montar();
    await tocar(boton(contenedor, "Ver detalle"));
    expect(texto(contenedor)).toContain("Caso 1");
    expect(texto(contenedor)).toContain(`${etiqueta("numero_registro")}1`);
    expect(texto(contenedor)).toContain(`${etiqueta("edad")}40 años`);
    expect(texto(contenedor)).toContain(`${etiqueta("pie_dominante")}Izquierdo`);
    expect(texto(contenedor)).toContain(`${etiqueta("posicion")}${etiquetaDeOpcion("posicion", "delantero_central", null, "es-AR")}`);
    expect(texto(contenedor)).toContain(`${etiqueta("lado_habil")}No`);
    expect(texto(contenedor)).toContain(`${etiqueta("recurrencia")}No`);
    expect(texto(contenedor)).toContain(`${etiqueta("diagnostico")}Lesión muscular grado 1 A Muslo Derecho`);

    await tocar(boton(contenedor, "Editar"));
    expect(texto(contenedor)).toContain("Editar lesión");
    expect(texto(contenedor)).toContain("Paso 2 de 6");
    // Al editar se puede saltar directo a cualquier paso.
    await tocar(contenedor.querySelector('.lesiones-progreso button[aria-label="Notas y resumen"]'));
    expect(texto(contenedor)).toContain("Paso 6 de 6");
    expect(texto(contenedor)).toContain("Se calcula solo");
    await escribir(campoDeFormulario(contenedor, etiqueta("medico")).querySelector("input"), "Dr. X");
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.actualizadas).toHaveLength(1);
    expect(datos.actualizadas[0].lesion.datos.medico).toBe("Dr. X");
    expect(texto(contenedor)).toContain("Lesión guardada");
  });

  test("una lesión nueva se carga de a un paso, solo con lo que el Excel no calcula", async () => {
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    expect(texto(contenedor)).toContain("¿Quién se lesionó?");
    expect(texto(contenedor)).toContain("Paso 1 de 6");
    expect(PASOS.flatMap((paso) => paso.campos).every((clave) => !["calculado", "auto", "dato_jugador"].includes(CAMPOS.find((campo) => campo.clave === clave).tipo))).toBe(true);

    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Elegí al jugador para seguir.");
    await escribir(contenedor.querySelector(".lesiones-buscador-jugador"), "sca");
    expect([...contenedor.querySelectorAll(".lesiones-lista-jugadores button")].map((b) => b.querySelector("b").textContent)).toEqual(["SCARPA"]);
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    // Los datos del jugador aparecen solos.
    expect(texto(contenedor)).toContain(etiquetaDeOpcion("posicion", "volante_central", null, "es-AR"));

    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("¿Qué pasó?");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Elegí la parte del cuerpo lesionada.");
    await elegirEnHoja(contenedor, "Parte del cuerpo lesionada", "Rodilla");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Elegí el lado.");
    // Las listas cortas son botones a la vista; las largas, el selector con hoja.
    await tocar(chip(contenedor, "Izquierdo"));
    expect(contenedor.querySelector('.selector-hoja[aria-label="Tipo de lesión"]')).toBeTruthy();
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("¿Dónde exactamente?");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("¿Cómo y cuándo?");
    await elegirEnHoja(contenedor, "Mecanismo", "Sprint");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Evolución e imágenes");
    await escribir(campoDeFormulario(contenedor, etiqueta("horas_imagen")).querySelector("input"), "12");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Notas y resumen");
    expect(texto(contenedor)).toContain(`${etiqueta("numero_registro")}1`);
    expect(texto(contenedor)).toContain(`${etiqueta("diagnostico")}Rodilla Izquierdo`);
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.guardadas).toHaveLength(1);
    expect(datos.guardadas[0]).toMatchObject({
      equipoId: "eq-1",
      lesion: { jugador_id: 8, fecha_alta: null, datos: { parte_cuerpo: "joelho", lado: "esquerdo", mecanismo: "sprint", horas_imagen: "12" } },
    });
    expect(datos.guardadas[0].lesion.datos.diagnostico).toBeUndefined();
    // Después de guardar queda abierta la ficha.
    expect(texto(contenedor)).toContain("Caso 2");
    expect(texto(contenedor)).toContain("SCARPA");
  });

  test("el alta médica cierra la lesión; la severidad sale sola de las fechas", async () => {
    await montar();
    await tocar(boton(contenedor, "Alta médica"));
    expect(texto(contenedor)).toContain("¿Dar el alta médica?");
    await tocar(boton(contenedor, "Sí, dar el alta"));
    await act(async () => Promise.resolve());
    expect(datos.actualizadas).toHaveLength(1);
    expect(datos.actualizadas[0].lesion.fecha_alta).toBe(hoyISO());
    expect(datos.actualizadas[0].lesion.datos.severidad).toBeUndefined();
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
    await tocar(chip(contenedor, "Con alta"));
    expect(texto(contenedor)).toContain("1 lesión");
    expect(texto(contenedor)).toContain("SCARPA");
    expect(texto(contenedor)).not.toContain("HULK");
    // El icono prendido borra todo.
    await tocar(contenedor.querySelector(".boton-filtro"));
    expect(texto(contenedor)).toContain("2 lesiones");
    // Multi-Filtro: parte del cuerpo y jugador a la vez.
    await tocar(contenedor.querySelector(".boton-filtro"));
    await tocar([...contenedor.querySelectorAll(".opcion-hoja")].find((b) => b.textContent.trim() === "Multi-Filtro"));
    await tocar(chip(contenedor, "Parte del cuerpo lesionada"));
    await tocar(chip(contenedor, "Rodilla"));
    expect(texto(contenedor)).toContain("SCARPA");
    expect(texto(contenedor)).not.toContain("HULK");
    // El buscador de texto.
    const buscador = contenedor.querySelector(".linea-buscador input");
    await escribir(buscador, "hulk");
    expect(texto(contenedor)).toContain("Ninguna lesión entra en ese filtro.");
  });

  test("la base muestra las lesiones como el Excel y se edita y se pega en las celdas", async () => {
    await montar();
    await navegar(contenedor, "Base");
    const cabeceras = [...contenedor.querySelectorAll(".tabla-datos-tabla th[data-columna]")];
    expect(cabeceras.map((th) => th.textContent).slice(0, 3)).toEqual(["N° de caso", "N° de registro", "Nombre y apellido"]);
    expect(cabeceras).toHaveLength(36);
    // Lo calculado se ve pero no se toca.
    expect(cabeceras[1].classList.contains("fija")).toBe(true);
    const fila = contenedor.querySelector(".tabla-datos-tabla tbody tr");
    expect(fila.textContent).toContain("HULK");
    expect(fila.textContent).toContain("Muslo");
    expect(fila.textContent).toContain("40 años");

    // Dos toques en la celda del médico y se escribe ahí mismo.
    const indiceMedico = cabeceras.findIndex((th) => th.textContent === etiqueta("medico"));
    const celdaMedico = () => fila.querySelectorAll("td")[indiceMedico];
    await tocar(celdaMedico());
    await tocar(celdaMedico());
    const input = celdaMedico().querySelector("input");
    await escribir(input, "Dra. Pérez");
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(datos.actualizadas).toHaveLength(1);
    expect(datos.actualizadas[0].lesion.datos.medico).toBe("Dra. Pérez");

    // Pegar un texto de Excel en la columna del lado.
    const indiceLado = cabeceras.findIndex((th) => th.textContent === "Lado");
    await tocar(fila.querySelectorAll("td")[indiceLado]);
    const evento = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(evento, "clipboardData", { value: { getData: () => "Izquierdo" } });
    await act(async () => contenedor.querySelector(".tabla-datos-marco").dispatchEvent(evento));
    expect(datos.actualizadas).toHaveLength(2);
    expect(datos.actualizadas[1].lesion.datos.lado).toBe("esquerdo");
    expect(texto(contenedor)).toContain("1 celda pegada");

    await tocar(boton(contenedor, "Ver ficha"));
    expect(texto(contenedor)).toContain("Caso 1 · 20/09/2026 · Lesionado");
  });

  test("en Ajustes se renombran cabeceras y opciones en el idioma que se está usando", async () => {
    await montar();
    await navegar(contenedor, "Ajustes");
    expect(texto(contenedor)).not.toContain("Cambiar de módulo");
    await tocar(botonQueEmpieza(contenedor, "Cabeceras"));
    await tocar(botonQueEmpieza(contenedor, "Parte del cuerpo lesionada"));
    expect(texto(contenedor)).toContain("Cabecera: Parte del cuerpo lesionada");
    const campos = [...contenedor.querySelectorAll(".lesiones-hoja .campo-inicio input")];
    expect(campos.map((input) => input.value)).toEqual(["Parte del cuerpo lesionada"]);
    await escribir(campos[0], "Zona lesionada");
    await tocar(boton(contenedor, "Guardar"));
    await act(async () => Promise.resolve());
    // El otro idioma queda como estaba.
    expect(datos.cabeceras[0]).toMatchObject({ campo: "parte_cuerpo", etiquetas: { "es-AR": "Zona lesionada", "pt-BR": "Parte do Corpo Lesionada" }, oculto: false });

    await tocar(boton(contenedor, "Volver a Ajustes"));
    await tocar(botonQueEmpieza(contenedor, "Listas"));
    await tocar(botonQueEmpieza(contenedor, "Mecanismo"));
    expect(texto(contenedor)).toContain("15 opciones");
    await tocar(boton(contenedor, "Agregar una opción"));
    const nuevos = [...contenedor.querySelectorAll(".lesiones-hoja .campo-inicio input")];
    expect(nuevos).toHaveLength(1);
    await tocar(boton(contenedor, "Guardar"));
    expect(texto(contenedor)).toContain("Escribí el nombre.");
    await escribir(nuevos[0], "Cabezazo");
    await tocar(boton(contenedor, "Guardar"));
    await act(async () => Promise.resolve());
    expect(datos.opciones[0]).toMatchObject({ campo: "mecanismo", etiquetas: { "es-AR": "Cabezazo", "pt-BR": "" }, oculto: false });
    expect(datos.opciones[0].codigo).toMatch(/^cabezazo_/);
  });

  test("la hoja de opciones larga tiene buscador que acerca lo escrito", async () => {
    // HULK ya tuvo el alta hace poco: una lesión igual es una posible recidiva.
    datos.lesiones = [{ ...lesionHulk(), fecha_alta: "2026-09-28" }];
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    await tocar(botonQueEmpieza(contenedor, "HULK"));
    await siguiente(contenedor);
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
    // Si ya tuvo una lesión igual, avisa.
    await elegirEnHoja(contenedor, "Parte del cuerpo lesionada", "Muslo");
    await tocar(chip(contenedor, "Derecho"));
    expect(texto(contenedor)).toContain("Posible recidiva");
  });
});
