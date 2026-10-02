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
  config: { campos: {}, listas: {} },
  equipo: { id: "eq-1", nombre: "Atlético Mineiro" },
  historialesPedidos: [],
  cambios: [],
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
  leerEquipoElegido: () => datos.equipo,
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
      // El id más chico con el nombre más alto: ordenar por nombre no es ordenar por id.
      { id: 5, nombre: "ZAGUEIRO", roles: [], puestos: ["DEF"], categoria: "", fecha_nacimiento: "2001-12-02", pie_dominante: "", posicion: "defensor_central", foto_url: "" },
    ],
    error: "",
  }),
  leerConfig: async () => ({ config: datos.config, error: "" }),
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
  historialDeLesion: async (id) => {
    datos.historialesPedidos.push(id);
    return { cambios: datos.cambios, error: "" };
  },
  guardarCampo: async (equipoId, campo, cambios) => {
    datos.cabeceras.push({ campo, ...cambios });
    return { error: "" };
  },
  guardarOpcion: async (equipoId, campo, opcion) => {
    datos.opciones.push({ campo, ...opcion });
    return { error: "" };
  },
}));

const { default: Lesiones } = await import("./Lesiones.jsx");
const { fijarIdiomaParaPruebas } = await import("./idioma/index.js");
const { CAMPOS, PASOS, etiquetaDeCampo, etiquetaDeOpcion } = await import("./domain/lesionesCampos.js");
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
const tituloDelPaso = (contenedor) => contenedor.querySelector(".lesiones-paso-titulo h2").textContent;
const pestanas = (contenedor) => [...contenedor.querySelectorAll('.lesiones-secciones [role="tab"]')];
const pestana = (contenedor, nombre) => pestanas(contenedor).find((b) => b.textContent === nombre);
const GRUPOS_DEL_EXCEL = ["Datos generales", "Descripción general", "Descripción específica", "Descripción contextual", "Evolución y continuación", "Diagnóstico", "Observaciones"];

describe("el módulo Lesiones", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    localStorage.clear();
    datos.lesiones = [lesionHulk()];
    datos.config = { campos: {}, listas: {} };
    datos.equipo = { id: "eq-1", nombre: "Atlético Mineiro" };
    datos.historialesPedidos = [];
    datos.cambios = [];
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

  test("la ficha es como la de Partido: resumen arriba, una pestaña por grupo del Excel y los últimos cambios", async () => {
    datos.cambios = [
      { id: 3, accion: "editada", quien_email: "medico@club.com", cuando: "2026-09-22T14:30:00Z", campos: ["lado", "medico"] },
      { id: 1, accion: "creada", quien_email: "medico@club.com", cuando: "2026-09-20T10:00:00Z", campos: [] },
    ];
    await montar();
    await tocar(boton(contenedor, "Ver detalle"));
    expect(texto(contenedor)).toContain("Caso 1 · 20/09/2026 · Lesionado");
    // El resumen: el diagnóstico y los días de baja.
    const resumen = contenedor.querySelector(".lesiones-marcador");
    expect(resumen.textContent).toContain("Lesión muscular grado 1 A Muslo Derecho");
    expect(resumen.textContent).toContain("DÍAS DE BAJA");
    // Una pestaña por grupo del Excel, y la de los cambios al final.
    expect(pestanas(contenedor).map((b) => b.textContent)).toEqual([...GRUPOS_DEL_EXCEL, "Cambios"]);
    expect(pestanas(contenedor)[0].getAttribute("aria-selected")).toBe("true");
    // Se mira un grupo a la vez: el primero muestra al jugador.
    expect(texto(contenedor)).toContain(`${etiqueta("numero_registro")}1`);
    expect(texto(contenedor)).toContain(`${etiqueta("edad")}40 años`);
    expect(texto(contenedor)).toContain(`${etiqueta("pie_dominante")}Izquierdo`);
    expect(texto(contenedor)).toContain(`${etiqueta("posicion")}${etiquetaDeOpcion("posicion", "delantero_central", null, "es-AR")}`);
    expect(texto(contenedor)).not.toContain(etiqueta("lado_habil"));
    await tocar(pestana(contenedor, "Descripción general"));
    expect(texto(contenedor)).toContain(`${etiqueta("lado_habil")}No`);
    expect(texto(contenedor)).not.toContain(etiqueta("edad"));
    await tocar(pestana(contenedor, "Evolución y continuación"));
    expect(texto(contenedor)).toContain(`${etiqueta("recurrencia")}No`);
    await tocar(pestana(contenedor, "Diagnóstico"));
    expect(texto(contenedor)).toContain(`${etiqueta("diagnostico")}Lesión muscular grado 1 A Muslo Derecho`);

    // Los cambios: los últimos que manda la base, con qué columnas tocó cada uno.
    expect(datos.historialesPedidos).toEqual(["les-1"]);
    await tocar(pestana(contenedor, "Cambios"));
    expect(texto(contenedor)).toContain("Últimos cambios");
    expect(texto(contenedor)).toContain("LOS 5 MÁS RECIENTES");
    expect(texto(contenedor)).toContain("Edición");
    expect(texto(contenedor)).toContain("medico@club.com");
    expect(texto(contenedor)).toContain(`Cambió: Lado, ${etiqueta("medico")}`);
    expect(contenedor.querySelectorAll(".lesiones-cambios li")).toHaveLength(2);

    // Editar desde una pestaña abre el paso de ese grupo.
    await tocar(pestana(contenedor, "Observaciones"));
    await tocar(boton(contenedor, "Editar"));
    expect(texto(contenedor)).toContain("Editar lesión");
    expect(texto(contenedor)).toContain("Paso 6 de 6");
    expect(tituloDelPaso(contenedor)).toBe("Observaciones");
    // Al final de la carga ya no está lo que se calcula solo.
    expect(texto(contenedor)).not.toContain(etiqueta("numero_registro"));
    expect(texto(contenedor)).not.toContain(etiqueta("severidad"));
    await escribir(campoDeFormulario(contenedor, etiqueta("medico")).querySelector("input"), "Dr. X");
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.actualizadas).toHaveLength(1);
    expect(datos.actualizadas[0].lesion.datos.medico).toBe("Dr. X");
    expect(texto(contenedor)).toContain("Lesión guardada");
    // Vuelve a la ficha, en la misma pestaña, y los cambios se piden de nuevo.
    expect(pestana(contenedor, "Observaciones").getAttribute("aria-selected")).toBe("true");
    expect(datos.historialesPedidos).toEqual(["les-1", "les-1"]);
  });

  test("una lesión nueva se carga por los grupos del Excel, solo con lo que el Excel no calcula", async () => {
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    expect(tituloDelPaso(contenedor)).toBe("Datos generales");
    expect(texto(contenedor)).toContain("¿Quién se lesionó? Buscá al jugador por el nombre.");
    expect(texto(contenedor)).toContain("Paso 1 de 6");
    // Un paso por grupo con algo para cargar a mano (Diagnóstico es todo calculado).
    expect(PASOS.map((paso) => paso.id)).toEqual(["dados_gerais", "descricao_geral", "descricao_especifica", "descricao_contextual", "evolucao", "observacoes"]);
    expect(PASOS.flatMap((paso) => paso.campos).every((clave) => !["calculado", "auto", "dato_jugador"].includes(CAMPOS.find((campo) => campo.clave === clave).tipo))).toBe(true);

    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Elegí al jugador para seguir.");
    await escribir(contenedor.querySelector(".lesiones-buscador-jugador"), "sca");
    expect([...contenedor.querySelectorAll(".lesiones-lista-jugadores button")].map((b) => b.querySelector("b").textContent)).toEqual(["SCARPA"]);
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    // Elegido, la lista se retrae: queda el nombre con "Cambiar" y sus datos.
    expect(contenedor.querySelector(".lesiones-lista-jugadores")).toBeNull();
    expect(contenedor.querySelector(".lesiones-buscador-jugador")).toBeNull();
    expect(contenedor.querySelector(".rival-elegido").textContent).toBe("SCARPACambiar");
    expect(texto(contenedor)).toContain(etiquetaDeOpcion("posicion", "volante_central", null, "es-AR"));
    // "Cambiar" la vuelve a abrir, entera.
    await tocar(contenedor.querySelector(".rival-elegido"));
    expect(contenedor.querySelectorAll(".lesiones-lista-jugadores button")).toHaveLength(3);
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));

    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Descripción general");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Elegí la parte del cuerpo lesionada.");
    await elegirEnHoja(contenedor, "Parte del cuerpo lesionada", "Rodilla");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Elegí el lado.");
    // Las listas cortas son botones a la vista; las largas, el selector con hoja.
    await tocar(chip(contenedor, "Izquierdo"));
    expect(contenedor.querySelector('.selector-hoja[aria-label="Tipo de lesión"]')).toBeTruthy();
    // Las imágenes van en Descripción general, como en el Excel.
    await escribir(campoDeFormulario(contenedor, etiqueta("horas_imagen")).querySelector("input"), "12");
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Descripción específica");
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Descripción contextual");
    await elegirEnHoja(contenedor, "Mecanismo", "Sprint");
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Evolución y continuación");
    // La fecha de inicio viene con la de hoy.
    expect(campoDeFormulario(contenedor, etiqueta("fecha_lesion")).querySelector("input").value).toBe(hoyISO());
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Observaciones");
    // Lo que se calcula solo ya no aparece al final del formulario.
    expect(texto(contenedor)).not.toContain("Se calcula solo");
    expect(texto(contenedor)).not.toContain(etiqueta("numero_registro"));
    expect(texto(contenedor)).not.toContain(etiqueta("diagnostico"));
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.guardadas).toHaveLength(1);
    expect(datos.guardadas[0]).toMatchObject({
      equipoId: "eq-1",
      lesion: { jugador_id: 8, fecha_alta: null, datos: { parte_cuerpo: "joelho", lado: "esquerdo", mecanismo: "sprint", horas_imagen: "12" } },
    });
    expect(datos.guardadas[0].lesion.datos.diagnostico).toBeUndefined();
    // Después de guardar queda abierta la ficha, en su primera pestaña.
    expect(texto(contenedor)).toContain("Caso 2");
    expect(texto(contenedor)).toContain("SCARPA");
    expect(pestanas(contenedor)[0].getAttribute("aria-selected")).toBe("true");
  });

  test("una fecha mal puesta frena el paso de la evolución", async () => {
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    await siguiente(contenedor);
    await elegirEnHoja(contenedor, "Parte del cuerpo lesionada", "Rodilla");
    await tocar(chip(contenedor, "Izquierdo"));
    await siguiente(contenedor);
    await siguiente(contenedor);
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Evolución y continuación");
    await escribir(campoDeFormulario(contenedor, etiqueta("fecha_lesion")).querySelector("input"), "2026-09-10");
    await escribir(campoDeFormulario(contenedor, etiqueta("fecha_transicion")).querySelector("input"), "2026-09-01");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Las fechas de transición, retorno y alta no pueden ser anteriores al inicio.");
    expect(tituloDelPaso(contenedor)).toBe("Evolución y continuación");
    await escribir(campoDeFormulario(contenedor, etiqueta("fecha_transicion")).querySelector("input"), "2026-09-12");
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Observaciones");
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

  test("el historial es de un jugador: se lo busca por el nombre y queda su base", async () => {
    datos.lesiones = [
      { ...lesionHulk(), id: "les-2", numero_caso: 2, jugador_id: 8, fecha_lesion: "2026-08-01", fecha_alta: "2026-08-20", datos: { parte_cuerpo: "joelho", lado: "esquerdo" } },
      { ...lesionHulk(), id: "les-3", numero_caso: 3, jugador_id: 8, fecha_lesion: "2026-06-01", fecha_alta: "2026-06-10", datos: { parte_cuerpo: "tornozelo_pe", lado: "direito" } },
    ];
    await montar();
    await navegar(contenedor, "Historial");
    // Primero se elige el jugador: todavía no hay tabla.
    expect(contenedor.querySelector(".tabla-datos")).toBeNull();
    const lista = () => [...contenedor.querySelectorAll(".lesiones-lista-jugadores button")];
    expect(lista().map((b) => b.textContent)).toEqual(["HULK0 lesiones", "SCARPA2 lesiones", "ZAGUEIRO0 lesiones"]);
    await escribir(contenedor.querySelector(".lesiones-buscador-jugador"), "scar");
    expect(lista().map((b) => b.querySelector("b").textContent)).toEqual(["SCARPA"]);
    await tocar(lista()[0]);
    // Elegido, la lista se retrae como en Partido.
    expect(contenedor.querySelector(".lesiones-lista-jugadores")).toBeNull();
    expect(contenedor.querySelector(".rival-elegido").textContent).toBe("SCARPACambiar");
    // Su base: solo sus lesiones, con la fila de grupos y los filtros de las cabeceras.
    const filas = () => [...contenedor.querySelectorAll(".tabla-datos-tabla tbody tr")];
    expect(filas()).toHaveLength(2);
    expect(filas().every((fila) => fila.textContent.includes("SCARPA"))).toBe(true);
    expect(texto(contenedor)).toContain("2 lesiones");
    expect([...contenedor.querySelectorAll(".tabla-datos-grupos th")].map((th) => th.textContent).filter(Boolean)).toEqual(GRUPOS_DEL_EXCEL);
    expect(contenedor.querySelectorAll(".tabla-datos-filtro").length).toBeGreaterThan(30);
    // La ficha se abre desde la tabla, y al volver sigue el mismo jugador.
    await tocar(filas()[1].querySelector("td"));
    await tocar(boton(contenedor, "Ver ficha"));
    expect(texto(contenedor)).toContain("Caso 3");
    await tocar(boton(contenedor, "Volver"));
    expect(contenedor.querySelector(".rival-elegido b").textContent).toBe("SCARPA");
    // "Cambiar" vuelve a la lista; un jugador sin lesiones lo dice.
    await tocar(contenedor.querySelector(".rival-elegido"));
    expect(lista()).toHaveLength(3);
    await tocar(lista()[0]);
    expect(texto(contenedor)).toContain("Este jugador no tiene lesiones cargadas.");
    expect(contenedor.querySelector(".tabla-datos")).toBeNull();
  });

  test("la base muestra las lesiones como el Excel y se edita y se pega en las celdas", async () => {
    await montar();
    await navegar(contenedor, "Base");
    const cabeceras = [...contenedor.querySelectorAll(".tabla-datos-tabla th[data-columna]")];
    expect(cabeceras.map((th) => th.textContent).slice(0, 3)).toEqual(["N° de caso", "N° de registro", "Nombre y apellido"]);
    expect(cabeceras).toHaveLength(36);
    // Arriba de las cabeceras, la fila de los grupos del Excel, cada uno sobre sus columnas.
    const grupos = [...contenedor.querySelectorAll(".tabla-datos-grupos th")].slice(1);
    expect(grupos.map((th) => th.textContent)).toEqual(GRUPOS_DEL_EXCEL);
    expect(grupos.map((th) => Number(th.getAttribute("colspan")))).toEqual([8, 7, 4, 4, 10, 1, 2]);
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

  test("las cabeceras de la base filtran y ordenan como en Excel", async () => {
    datos.lesiones = [
      lesionHulk(),
      { ...lesionHulk(), id: "les-2", numero_caso: 2, jugador_id: 8, fecha_lesion: "2026-08-01", fecha_alta: "2026-08-20", datos: { parte_cuerpo: "joelho", lado: "esquerdo" } },
      { ...lesionHulk(), id: "les-3", numero_caso: 3, jugador_id: 8, fecha_lesion: "2026-06-01", fecha_alta: "2026-06-10", datos: { parte_cuerpo: "tornozelo_pe", lado: "direito" } },
      { ...lesionHulk(), id: "les-4", numero_caso: 4, jugador_id: 5, fecha_lesion: "2026-05-01", fecha_alta: "2026-05-10", datos: { parte_cuerpo: "coxa", lado: "nao_se_aplica" } },
    ];
    await montar();
    await navegar(contenedor, "Base");
    const casos = () => [...contenedor.querySelectorAll(".tabla-datos-tabla tbody tr")].map((tr) => tr.querySelector("td").textContent);
    expect(casos()).toEqual(["1", "2", "3", "4"]);
    const filtroDe = (columna) => contenedor.querySelector(`.tabla-datos-filtro[aria-label="Filtrar u ordenar ${columna}"]`);
    const valores = () => [...contenedor.querySelectorAll(".tabla-datos-valores label")];

    // El filtro de una columna: sus valores con cuántas filas tiene cada uno.
    await tocar(filtroDe("Lado"));
    expect(texto(contenedor)).toContain("Filtrar: Lado");
    expect(valores().map((label) => label.textContent)).toEqual(["Derecho2", "Izquierdo1", "No se aplica1"]);
    await tocar(boton(contenedor, "Ninguno"));
    expect(boton(contenedor, "Aplicar").disabled).toBe(true);
    await tocar(valores()[1].querySelector("input"));
    await tocar(boton(contenedor, "Aplicar"));
    expect(casos()).toEqual(["2"]);
    expect(texto(contenedor)).toContain("Mostrando 1 de 4");
    expect(filtroDe("Lado").classList.contains("activo")).toBe(true);

    // Otro filtro ofrece solo lo que deja pasar el primero.
    await tocar(filtroDe("Nombre y apellido"));
    expect(valores().map((label) => label.textContent)).toEqual(["SCARPA1"]);
    await tocar(contenedor.querySelector(".tabla-datos-hoja-filtro .boton-cancelar-hoja"));

    // Quitar filtros vuelve a todas; ordenar de mayor a menor da vuelta el caso.
    await tocar(botonQueEmpieza(contenedor, "Quitar filtros"));
    expect(casos()).toEqual(["1", "2", "3", "4"]);
    await tocar(filtroDe("N° de caso"));
    await tocar(chip(contenedor, "De mayor a menor"));
    expect(casos()).toEqual(["4", "3", "2", "1"]);
    expect(filtroDe("N° de caso").textContent).toContain("↓");

    // El nombre se ordena por el nombre (no por el id) y la fecha de
    // nacimiento por la fecha (no por el texto, que empieza con el día).
    await tocar(filtroDe("Nombre y apellido"));
    await tocar(chip(contenedor, "De menor a mayor"));
    expect(casos()).toEqual(["1", "2", "3", "4"]);
    await tocar(filtroDe("Fecha de nacimiento"));
    await tocar(chip(contenedor, "De menor a mayor"));
    expect(casos()).toEqual(["1", "4", "2", "3"]);

    // Al abrir una ficha y volver, el orden y los filtros siguen.
    await tocar(contenedor.querySelector(".tabla-datos-tabla tbody td"));
    await tocar(boton(contenedor, "Ver ficha"));
    await tocar(boton(contenedor, "Volver"));
    expect(casos()).toEqual(["1", "4", "2", "3"]);
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

    // Cada grupo del Excel encabeza sus columnas y también se renombra.
    const filasDeCabeceras = [...contenedor.querySelectorAll(".opcion-ajuste")].map((b) => b.querySelector("b").textContent);
    expect(filasDeCabeceras.slice(0, 3)).toEqual(["Datos generales", "N° de caso", "N° de registro"]);
    expect([...contenedor.querySelectorAll(".lesiones-ajuste-grupo b")].map((b) => b.textContent)).toEqual(GRUPOS_DEL_EXCEL);
    expect(filasDeCabeceras).toHaveLength(36 + 7);
    await tocar(botonQueEmpieza(contenedor, "Descripción general"));
    expect(texto(contenedor)).toContain("Grupo: Descripción general");
    expect(texto(contenedor)).toContain("Es la fila de arriba de las cabeceras");
    expect(chip(contenedor, "Oculta")).toBeUndefined();
    await escribir(contenedor.querySelector(".lesiones-hoja .campo-inicio input"), "Qué pasó");
    await tocar(boton(contenedor, "Guardar"));
    await act(async () => Promise.resolve());
    expect(datos.cabeceras[1]).toMatchObject({ campo: "grupo:descricao_geral", etiquetas: { "es-AR": "Qué pasó", "pt-BR": "Descrição Geral" }, oculto: false, orden: 1001 });

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

  test("una columna escondida no aparece, un paso sin columnas se saltea y las obligatorias no se esconden", async () => {
    datos.config = {
      campos: {
        producto: { oculto: true },
        mecanismo: { oculto: true },
        cuando: { oculto: true },
        localizacion: { oculto: true },
        medico: { oculto: true },
        parte_cuerpo: { oculto: true },
        // El club le cambió el nombre a un grupo.
        "grupo:descricao_geral": { etiquetas: { "es-AR": "Qué pasó", "pt-BR": "" } },
      },
      listas: {},
    };
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    expect(texto(contenedor)).toContain("Paso 1 de 5");
    await tocar(botonQueEmpieza(contenedor, "HULK"));
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Qué pasó");
    // Parte del cuerpo es obligatoria: sigue a la vista aunque la configuración diga que no.
    expect(contenedor.querySelector('.selector-hoja[aria-label="Parte del cuerpo lesionada"]')).toBeTruthy();
    await elegirEnHoja(contenedor, "Parte del cuerpo lesionada", "Rodilla");
    await tocar(chip(contenedor, "Izquierdo"));
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Descripción específica");
    await siguiente(contenedor);
    // "Descripción contextual" quedó sin columnas y se saltea.
    expect(tituloDelPaso(contenedor)).toBe("Evolución y continuación");
    expect(texto(contenedor)).toContain("Paso 4 de 5");
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Observaciones");
    expect(campoDeFormulario(contenedor, etiqueta("medico"))).toBeUndefined();
    expect(campoDeFormulario(contenedor, etiqueta("comentarios"))).toBeTruthy();

    // En la base tampoco está la columna escondida (la barra de abajo cierra la carga),
    // y el grupo vacío no tiene lugar en la fila de los grupos.
    await navegar(contenedor, "Base");
    const cabeceras = [...contenedor.querySelectorAll(".tabla-datos-tabla th[data-columna]")].map((th) => th.textContent);
    expect(cabeceras).not.toContain("Mecanismo");
    expect(cabeceras).toContain("Parte del cuerpo lesionada");
    const grupos = [...contenedor.querySelectorAll(".tabla-datos-grupos th")].map((th) => th.textContent);
    expect(grupos).toContain("Qué pasó");
    expect(grupos).not.toContain("Descripción contextual");

    // Y en Ajustes, la cabecera obligatoria no ofrece esconderse.
    await navegar(contenedor, "Ajustes");
    await tocar(botonQueEmpieza(contenedor, "Cabeceras"));
    await tocar(botonQueEmpieza(contenedor, "Lado"));
    expect(texto(contenedor)).toContain("Esta columna hace falta para registrar la lesión");
    expect(chip(contenedor, "Oculta")).toBeUndefined();
    await tocar(boton(contenedor, "Cancelar"));
    await tocar(botonQueEmpieza(contenedor, "Producto"));
    expect(chip(contenedor, "Oculta")).toBeTruthy();
  });

  test("quien ya se fue del club ve las lesiones hasta su último día y no puede cambiar nada", async () => {
    datos.equipo = { id: "eq-1", nombre: "Atlético Mineiro", hasta: "2026-09-25" };
    await montar();
    expect(texto(contenedor)).toContain("Dejaste este club el 25/09/2026.");
    expect(texto(contenedor)).toContain("HULK");
    expect(boton(contenedor, "Nueva lesión")).toBeUndefined();
    expect(boton(contenedor, "Alta médica")).toBeUndefined();
    expect(contenedor.querySelector(".boton-eliminar-registro")).toBeNull();
    await tocar(boton(contenedor, "Ver detalle"));
    expect(boton(contenedor, "Editar")).toBeUndefined();
    expect(boton(contenedor, "Volver")).toBeTruthy();
    // Los cambios tendrían lo que se tocó después de su último día: ni se piden.
    expect(pestanas(contenedor).map((b) => b.textContent)).toEqual(GRUPOS_DEL_EXCEL);
    expect(datos.historialesPedidos).toEqual([]);

    await navegar(contenedor, "Base");
    const cabeceras = [...contenedor.querySelectorAll(".tabla-datos-tabla th[data-columna]")];
    expect(cabeceras.every((th) => th.classList.contains("fija"))).toBe(true);
    expect(boton(contenedor, "Borrar fila")).toBeUndefined();
    expect(boton(contenedor, "Pegar")).toBeUndefined();

    await navegar(contenedor, "Ajustes");
    expect(texto(contenedor)).toContain("Dejaste este club el 25/09/2026.");
    expect([...contenedor.querySelectorAll(".opcion-ajuste")].every((b) => b.disabled)).toBe(true);
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
    expect(texto(contenedor)).toContain("Puede contar como recurrencia o recidiva");
  });
});
