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
  errorAlLeer: "",
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
  listarLesiones: async () => (datos.errorAlLeer ? { lesiones: [], error: datos.errorAlLeer } : { lesiones: datos.lesiones.map((l) => ({ ...l, datos: { ...l.datos } })), error: "" }),
  cargarPlantelLesiones: async () => ({
    plantel: datos.plantel || [
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
  importarLesion: async () => ({ error: "" }),
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
const { CAMPOS, OPCIONES, PASOS, etiquetaDeCampo, etiquetaDeOpcion } = await import("./domain/lesionesCampos.js");
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
// La figura del cuerpo: las zonas y las partes son botones dibujados (SVG).
const tocarFigura = async (elemento) => {
  expect(elemento, "no se encontró la zona").toBeTruthy();
  await act(async () => elemento.dispatchEvent(new MouseEvent("click", { bubbles: true })));
};
const parteDeLaLista = (contenedor, nombre) => [...contenedor.querySelectorAll(".mapa-cuerpo-partes button")].find((b) => b.querySelector("b").textContent === nombre);
// Se toca la zona en la figura y después la parte en la lista de al lado. Si
// la figura está acercada a otra zona, primero se vuelve al cuerpo entero.
const volverAlCuerpo = (contenedor) => tocar([...contenedor.querySelectorAll(".mapa-cuerpo-camino button")].find((b) => b.textContent === "Cuerpo"));
const elegirZona = async (contenedor, region, parte) => {
  if (contenedor.querySelector(".mapa-cuerpo-partes")) await volverAlCuerpo(contenedor);
  await tocarFigura(contenedor.querySelector(`.figura-cuerpo [data-region="${region}"]`));
  await tocar(parteDeLaLista(contenedor, parte));
};
// El tipo de lesión es obligatorio: los recorridos que pasan por Descripción
// general lo eligen.
const elegirTipo = (contenedor, tipo = "Lesión muscular grado 1 A") => elegirEnHoja(contenedor, "Tipo de lesión", tipo);
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
    datos.errorAlLeer = "";
    datos.plantel = null;
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
    expect([...contenedor.querySelectorAll(".navegacion-movil button")].map((b) => b.textContent.trim())).toEqual(["Lesionados", "Historial", "Base", "Reportes", "Ajustes"]);

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
    // El resumen: la figura con la parte lesionada, el diagnóstico y los días de baja.
    const resumen = contenedor.querySelector(".lesiones-marcador");
    expect(resumen.textContent).toContain("Lesión muscular grado 1 A Muslo Derecho");
    expect(resumen.textContent).toContain("DÍAS DE BAJA");
    expect(resumen.querySelector('.lesiones-marcador-figura [data-region="pierna_derecha"] .figura-cuerpo-pieza.elegida')).toBeTruthy();
    expect(resumen.querySelectorAll(".figura-cuerpo-pieza.elegida")).toHaveLength(1);
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
    // El tipo de lesión no es opcional: sin él no se sigue.
    expect(campoDeFormulario(contenedor, etiqueta("tipo_lesion")).textContent).not.toContain("Opcional");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Elegí el tipo de lesión.");
    expect(tituloDelPaso(contenedor)).toBe("Descripción general");
    await elegirEnHoja(contenedor, "Tipo de lesión", "Esguince / lesión ligamentaria");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Elegí la parte del cuerpo lesionada.");
    // Dónde fue: la figura. Una parte del medio pide el lado.
    await elegirZona(contenedor, "tronco", "Abdomen");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("Elegí el lado.");
    expect(texto(contenedor)).toContain("¿De qué lado?");
    // Una de una pierna lo trae de la figura.
    await elegirZona(contenedor, "pierna_izquierda", "Rodilla");
    expect(contenedor.querySelector(".mapa-cuerpo-elegido").textContent).toBe("Rodilla · Izquierdo");
    expect(contenedor.querySelector('.figura-cuerpo [data-parte="joelho"]').getAttribute("aria-pressed")).toBe("true");
    // Las listas largas siguen con el selector con hoja.
    expect(contenedor.querySelector('.selector-hoja[aria-label="Tipo de lesión"]')).toBeTruthy();
    // Las imágenes van en Descripción general, como en el Excel; las horas
    // desde la lesión hasta la imagen salen solas, cuando ya se cargó el día
    // de la lesión (va después, en Evolución).
    expect(campoDeFormulario(contenedor, etiqueta("horas_imagen"))).toBeUndefined();
    await escribir(campoDeFormulario(contenedor, etiqueta("hora_imagen")).querySelector("input"), `${hoyISO()}T03:00`);
    expect(campoDeFormulario(contenedor, etiqueta("hora_imagen")).textContent).not.toContain("Horas entre la lesión y la imagen");
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Descripción específica");
    // En la rodilla: sus ligamentos y lo que el catálogo tiene de ella.
    expect(texto(contenedor)).toContain("Rodilla · Izquierdo");
    await tocar(chip(contenedor, "Ligamento cruzado anterior"));
    expect(chip(contenedor, "Músculos del pie")).toBeUndefined();
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Descripción contextual");
    await elegirEnHoja(contenedor, "Mecanismo", "Sprint");
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Evolución y continuación");
    // La fecha de inicio viene con la de hoy; con ella, las horas hasta la imagen.
    expect(campoDeFormulario(contenedor, etiqueta("fecha_lesion")).querySelector("input").value).toBe(hoyISO());
    expect(campoDeFormulario(contenedor, etiqueta("fecha_lesion")).textContent).toContain("Horas entre la lesión y la imagen: 3 horas");
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
      lesion: { jugador_id: 8, fecha_alta: null, datos: { tipo_lesion: "entorse", parte_cuerpo: "joelho", lado: "esquerdo", ligamento: "lca", mecanismo: "sprint", hora_imagen: `${hoyISO()}T03:00` } },
    });
    expect(datos.guardadas[0].lesion.datos.diagnostico).toBeUndefined();
    expect(datos.guardadas[0].lesion.datos.horas_imagen).toBeUndefined();
    // Después de guardar queda abierta la ficha, en su primera pestaña.
    expect(texto(contenedor)).toContain("Caso 2");
    expect(texto(contenedor)).toContain("SCARPA");
    expect(pestanas(contenedor)[0].getAttribute("aria-selected")).toBe("true");
  });

  test("el cuerpo: de la zona a la parte, y en la parte el músculo y el área, solo con opciones de las listas", async () => {
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    await siguiente(contenedor);
    await elegirTipo(contenedor);
    // La figura entera: cada zona es un botón.
    const zonas = () => [...contenedor.querySelectorAll('.figura-cuerpo [role="button"][data-region]')].map((g) => g.getAttribute("aria-label"));
    expect(zonas()).toEqual(["Cabeza y cuello", "Tronco", "Brazo derecho", "Pierna derecha", "Brazo izquierdo", "Pierna izquierda"]);
    expect(contenedor.querySelector(".mapa-cuerpo-partes")).toBeNull();
    // La pierna derecha: se acerca y aparecen sus partes, con lo que tiene cada una.
    await tocarFigura(contenedor.querySelector('.figura-cuerpo [data-region="pierna_derecha"]'));
    expect(contenedor.querySelector(".mapa-cuerpo-camino").textContent).toBe("Cuerpo›Pierna derecha");
    // El foco pasa a las partes (con el teclado se sigue de ahí).
    expect(document.activeElement).toBe(contenedor.querySelector(".mapa-cuerpo-partes button"));
    expect([...contenedor.querySelectorAll(".mapa-cuerpo-partes b")].map((b) => b.textContent)).toEqual([
      "Cadera / ingle",
      "Muslo",
      "Rodilla",
      "Pierna / tendón de Aquiles",
      "Tobillo / pie",
      "Pie / dedo",
    ]);
    expect(parteDeLaLista(contenedor, "Muslo").textContent).toContain("Cuádriceps, Isquiotibiales, Aductores");
    // "Cuerpo" vuelve a la figura entera.
    await volverAlCuerpo(contenedor);
    expect(contenedor.querySelector(".mapa-cuerpo-partes")).toBeNull();
    // La columna lumbar se ve de espaldas: la figura se da vuelta sola.
    await elegirZona(contenedor, "tronco", "Columna lumbar / sacro / pelvis");
    expect(chip(contenedor, "De espaldas").getAttribute("aria-pressed")).toBe("true");
    await tocar(chip(contenedor, "No se aplica"));
    expect(texto(contenedor)).toContain("¿De qué lado?");
    // Al final, el muslo derecho.
    await elegirZona(contenedor, "pierna_derecha", "Muslo");
    expect(contenedor.querySelector(".mapa-cuerpo-elegido").textContent).toBe("Muslo · Derecho");
    await siguiente(contenedor);

    // Descripción específica: lo que va en el muslo. La figura quedó de
    // espaldas (por la columna lumbar): los isquiotibiales primero.
    expect(tituloDelPaso(contenedor)).toBe("Descripción específica");
    const chipsDe = (campo) => [...campoDeFormulario(contenedor, etiqueta(campo)).querySelectorAll(".chip-criterio")].map((b) => b.textContent);
    expect(chipsDe("musculo")).toEqual(["Isquiotibiales", "Cuádriceps", "Aductores"]);
    // Solo opciones de las listas: nada de «Otro…», y en el muslo no hay ligamentos.
    expect(chip(contenedor, "Otro…")).toBeUndefined();
    expect(campoDeFormulario(contenedor, etiqueta("ligamento"))).toBeUndefined();
    // Un músculo específico de un solo grupo completa el grupo.
    await tocar(chip(contenedor, "Bíceps femoral (cabeza larga)"));
    expect(chip(contenedor, "Isquiotibiales").getAttribute("aria-pressed")).toBe("true");
    // Con el grupo elegido, solo sus músculos.
    expect(chipsDe("musculo_especifico")).not.toContain("Recto femoral");
    // El área: todas las de la lista, ordenadas por tercio con su título
    // (los títulos no son opciones: no hay botón «Proximal» ni «General»).
    const area = campoDeFormulario(contenedor, etiqueta("area"));
    expect([...area.querySelectorAll(".mapa-cuerpo-tercio-titulo")].map((p) => p.textContent)).toEqual(["Proximal", "Medio", "Distal"]);
    expect(chipsDe("area")).toHaveLength(21);
    expect(chipsDe("area").slice(0, 2)).toEqual(["Muscular", "Mioaponeurótica"]);
    expect(chip(contenedor, "Proximal")).toBeUndefined();
    expect(chip(contenedor, "General")).toBeUndefined();
    await tocar(chip(contenedor, "Proximal – UMTC con compromiso del tendón"));
    // Con "Elegir de la lista" se elige de la lista entera, y vuelto a la
    // figura lo cargado se ve prendido para poder sacarlo.
    await tocar(boton(contenedor, "Elegir de la lista"));
    await elegirEnHoja(contenedor, etiqueta("ligamento"), "Ligamento lateral interno");
    await tocar(boton(contenedor, "Elegir con la figura"));
    expect(chip(contenedor, "Ligamento lateral interno").getAttribute("aria-pressed")).toBe("true");

    for (let i = 0; i < 3; i++) await siguiente(contenedor); // eslint-disable-line no-await-in-loop
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.guardadas[0].lesion.datos).toMatchObject({
      parte_cuerpo: "coxa",
      lado: "direito",
      musculo: "isquiotibiais",
      musculo_especifico: "biceps_femoral_longa",
      area: "proximal_umtc_com",
      ligamento: "lli",
    });
  });

  // La parte de cerca: lo que se toca en la figura (o en un esquema).
  const enLaFigura = (contenedor, codigo, extra = "") => contenedor.querySelector(`.mapa-cuerpo-anatomia .figura-anatomia-tocable[data-codigo="${codigo}"]${extra}`);
  const pintadas = (contenedor, clase) => [...contenedor.querySelectorAll(`.mapa-cuerpo-anatomia .figura-anatomia-tocable > path.${clase}`)].map((camino) => camino.parentNode.getAttribute("data-codigo"));
  const irAEstructura = async (contenedor, region, parte, lado = null) => {
    await tocar(boton(contenedor, "Nueva lesión"));
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    await siguiente(contenedor);
    await elegirTipo(contenedor);
    await elegirZona(contenedor, region, parte);
    if (lado) await tocar(chip(contenedor, lado));
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Descripción específica");
  };

  test("en la parte de cerca se toca el músculo, el tendón o el ligamento, y queda elegido abajo", async () => {
    await montar();
    await irAEstructura(contenedor, "pierna_derecha", "Muslo");
    // De frente y de espaldas, con lo de la otra pierna apagado.
    expect([...contenedor.querySelectorAll(".mapa-cuerpo-anatomia figcaption")].map((f) => f.textContent)).toEqual(["De frente", "De espaldas"]);
    expect(contenedor.querySelectorAll('.figura-anatomia [data-region="pierna_derecha"] .figura-anatomia-tocable').length).toBeGreaterThan(10);
    expect(contenedor.querySelectorAll('.figura-anatomia [data-region="pierna_izquierda"] .figura-anatomia-tocable')).toHaveLength(0);
    // Un músculo: se elige con su grupo, y el resto del grupo se pinta suave.
    await tocarFigura(enLaFigura(contenedor, "semitendinoso"));
    expect(chip(contenedor, "Semitendinoso").getAttribute("aria-pressed")).toBe("true");
    expect(chip(contenedor, "Isquiotibiales").getAttribute("aria-pressed")).toBe("true");
    expect(pintadas(contenedor, "elegida")).toContain("semitendinoso");
    expect(pintadas(contenedor, "del-grupo")).toEqual(expect.arrayContaining(["biceps_femoral_longa", "semimembranoso"]));
    // Uno de otro grupo cambia el grupo.
    await tocarFigura(enLaFigura(contenedor, "reto_femoral"));
    expect(chip(contenedor, "Cuádriceps").getAttribute("aria-pressed")).toBe("true");
    expect(chip(contenedor, "Recto femoral").getAttribute("aria-pressed")).toBe("true");
    // Tocarlo otra vez lo saca.
    await tocarFigura(enLaFigura(contenedor, "reto_femoral"));
    expect(chip(contenedor, "Recto femoral").getAttribute("aria-pressed")).toBe("false");
    expect(chip(contenedor, "Cuádriceps").getAttribute("aria-pressed")).toBe("true");
    // Lo que no está en las listas de esta parte se ve apagado y no se toca.
    expect(enLaFigura(contenedor, "gastrocnemio_lateral")).toBeNull();
    expect(contenedor.querySelector(".mapa-cuerpo-anatomia .figura-anatomia-musculo.apagada")).toBeTruthy();
    // Los músculos de debajo, en "Profundos".
    expect(enLaFigura(contenedor, "vasto_intermedio")).toBeNull();
    await tocar(chip(contenedor, "Profundos"));
    await tocarFigura(enLaFigura(contenedor, "vasto_intermedio"));
    expect(chip(contenedor, "Vasto intermedio").getAttribute("aria-pressed")).toBe("true");
    // Con uno de encima elegido, en "Profundos" se ve verde (como sombra).
    await tocar(chip(contenedor, "Recto femoral"));
    expect(contenedor.querySelector(".mapa-cuerpo-anatomia path.encima.elegida")).toBeTruthy();
    // Y elegido abajo uno profundo, la figura pasa sola a los profundos.
    await tocar(chip(contenedor, "Superficiales"));
    await tocar(chip(contenedor, "Vasto intermedio"));
    expect(chip(contenedor, "Profundos").getAttribute("aria-pressed")).toBe("true");
    expect(pintadas(contenedor, "elegida")).toContain("vasto_intermedio");
    for (let i = 0; i < 3; i++) await siguiente(contenedor); // eslint-disable-line no-await-in-loop
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.guardadas[0].lesion.datos).toMatchObject({ parte_cuerpo: "coxa", lado: "direito", musculo: "quadriceps", musculo_especifico: "vasto_intermedio" });
  });

  test("la rodilla y el tobillo tienen su esquema por dentro, espejado del lado izquierdo", async () => {
    await montar();
    await irAEstructura(contenedor, "pierna_izquierda", "Rodilla");
    const esquema = contenedor.querySelector('.figura-anatomia-esquema[data-esquema="rodilla"]');
    expect(esquema.querySelector("figcaption").textContent).toBe("Rodilla por dentro");
    expect([...esquema.querySelectorAll("text")].map((texto) => texto.textContent).sort()).toEqual(["LCA", "LCP", "LLE", "LLI", "ML", "MM"]);
    // Del lado izquierdo, lo lateral (LLE) queda a la derecha.
    const xDe = (rotulo) => Number([...esquema.querySelectorAll("text")].find((texto) => texto.textContent === rotulo).getAttribute("x"));
    expect(xDe("LLE")).toBeGreaterThan(xDe("LLI"));
    await tocarFigura(enLaFigura(contenedor, "lca"));
    expect(chip(contenedor, "Ligamento cruzado anterior").getAttribute("aria-pressed")).toBe("true");
    await tocarFigura(enLaFigura(contenedor, "menisco_medial"));
    expect(chip(contenedor, "Menisco medial").getAttribute("aria-pressed")).toBe("true");
    expect(chip(contenedor, "Ligamento cruzado anterior").getAttribute("aria-pressed")).toBe("false");
  });

  test("en el tronco se tocan los dos lados, y el lado tocado queda como el lado de la lesión", async () => {
    await montar();
    await irAEstructura(contenedor, "tronco", "Abdomen", "Derecho");
    // El abdomen se ve de frente nada más.
    expect([...contenedor.querySelectorAll(".mapa-cuerpo-anatomia figcaption")].map((f) => f.textContent)).toEqual(["De frente"]);
    await tocarFigura(enLaFigura(contenedor, "obliquo_externo", '[data-lado="direito"]'));
    expect(contenedor.querySelector(".mapa-cuerpo-ubicacion b").textContent).toBe("Abdomen · Derecho");
    expect(enLaFigura(contenedor, "obliquo_externo", '[data-lado="direito"]').querySelector("path").classList.contains("elegida")).toBe(true);
    expect(enLaFigura(contenedor, "obliquo_externo", '[data-lado="esquerdo"]').querySelector("path").classList.contains("elegida")).toBe(false);
    // El del otro lado cambia el lado.
    await tocarFigura(enLaFigura(contenedor, "obliquo_externo", '[data-lado="esquerdo"]'));
    expect(contenedor.querySelector(".mapa-cuerpo-ubicacion b").textContent).toBe("Abdomen · Izquierdo");
    expect(chip(contenedor, "Oblicuo externo").getAttribute("aria-pressed")).toBe("true");
  });

  test("en el tronco, con el lado en «No se aplica», tocar un lado no lo cambia", async () => {
    await montar();
    await irAEstructura(contenedor, "tronco", "Abdomen", "No se aplica");
    await tocarFigura(enLaFigura(contenedor, "obliquo_externo", '[data-lado="esquerdo"]'));
    expect(contenedor.querySelector(".mapa-cuerpo-ubicacion b").textContent).toBe("Abdomen");
    expect(pintadas(contenedor, "elegida")).toEqual(["obliquo_externo", "obliquo_externo"]);
  });

  test("un músculo que agregó el club, elegido abajo, no le cambia el grupo", async () => {
    const op = (codigo, es) => ({ codigo, etiquetas: { "es-AR": es, "pt-BR": "" }, oculto: false, orden: 99 });
    const conLasDelExcel = (campo, ...agregadas) => [...OPCIONES[campo].map((opcion, orden) => ({ ...opcion, oculto: false, orden })), ...agregadas];
    datos.config = { campos: {}, listas: { musculo_especifico: conLasDelExcel("musculo_especifico", op("recto_proximal_x", "Recto femoral proximal")) } };
    await montar();
    await irAEstructura(contenedor, "pierna_derecha", "Muslo");
    await tocar(chip(contenedor, "Cuádriceps"));
    await tocar(chip(contenedor, "Recto femoral proximal"));
    expect(chip(contenedor, "Recto femoral proximal").getAttribute("aria-pressed")).toBe("true");
    expect(chip(contenedor, "Cuádriceps").getAttribute("aria-pressed")).toBe("true");
    // Lo del grupo se pinta suave solo si de verdad es del grupo.
    expect(pintadas(contenedor, "del-grupo")).not.toContain("semitendinoso");
  });

  test("con una columna escondida, lo suyo no se toca en la figura", async () => {
    datos.config = { campos: { musculo_especifico: { oculto: true } }, listas: {} };
    await montar();
    await irAEstructura(contenedor, "pierna_derecha", "Rodilla");
    expect(enLaFigura(contenedor, "semitendinoso")).toBeNull();
    expect(enLaFigura(contenedor, "lca")).toBeTruthy();
  });

  test("una parte sin nada para tocar sigue con la figura chica y los botones", async () => {
    await montar();
    await irAEstructura(contenedor, "cabeza", "Cabeza / cara", "No se aplica");
    expect(contenedor.querySelector(".mapa-cuerpo-anatomia")).toBeNull();
    expect(contenedor.querySelector(".mapa-cuerpo-ubicacion .figura-cuerpo")).toBeTruthy();
  });

  test("el cuerpo no deja datos viejos: al cambiar de grupo o de parte, y con columnas escondidas", async () => {
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    await siguiente(contenedor);
    await elegirTipo(contenedor);
    // Acercada una zona, las otras quedan de fondo: no se tocan.
    await tocarFigura(contenedor.querySelector('.figura-cuerpo [data-region="pierna_derecha"]'));
    expect(contenedor.querySelectorAll('.figura-cuerpo [role="button"][data-region]')).toHaveLength(0);
    // Elegido de espaldas, en el muslo van primero los isquiotibiales.
    await volverAlCuerpo(contenedor);
    await tocar(chip(contenedor, "De espaldas"));
    await elegirZona(contenedor, "pierna_derecha", "Muslo");
    await siguiente(contenedor);
    const chipsDe = (campo) => [...campoDeFormulario(contenedor, etiqueta(campo)).querySelectorAll(".chip-criterio")].map((b) => b.textContent);
    expect(chipsDe("musculo")[0]).toBe("Isquiotibiales");
    // Otro grupo: el músculo de otro grupo se borra.
    await tocar(chip(contenedor, "Recto femoral"));
    expect(chip(contenedor, "Cuádriceps").getAttribute("aria-pressed")).toBe("true");
    await tocar(chip(contenedor, "Isquiotibiales"));
    expect(contenedor.querySelector('.mapa-cuerpo-seccion .chip-criterio[aria-pressed="true"]').textContent).toBe("Isquiotibiales");
    expect(chip(contenedor, "Recto femoral")).toBeUndefined();
    await tocar(chip(contenedor, "Semitendinoso"));
    await tocar(chip(contenedor, "Distal – UMTP"));
    const prendidos = () => [...contenedor.querySelectorAll('.mapa-cuerpo-seccion .chip-criterio[aria-pressed="true"]')].map((b) => b.textContent);
    // Otra parte donde también están (en la rodilla se insertan los isquiotibiales): queda.
    await tocar(boton(contenedor, "Atrás"));
    await volverAlCuerpo(contenedor);
    await elegirZona(contenedor, "pierna_izquierda", "Rodilla");
    await siguiente(contenedor);
    expect(prendidos()).toEqual(["Isquiotibiales", "Semitendinoso", "Distal – UMTP"]);
    // Una parte donde no están (el tobillo): lo del muslo se borra.
    await tocar(boton(contenedor, "Atrás"));
    await volverAlCuerpo(contenedor);
    await elegirZona(contenedor, "pierna_izquierda", "Tobillo / pie");
    await siguiente(contenedor);
    expect(prendidos()).toHaveLength(0);
    for (let i = 0; i < 3; i++) await siguiente(contenedor); // eslint-disable-line no-await-in-loop
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    const guardados = datos.guardadas[0].lesion.datos;
    expect(guardados).toMatchObject({ parte_cuerpo: "tornozelo_pe", lado: "esquerdo" });
    expect(guardados.musculo ?? null).toBe(null);
    expect(guardados.musculo_especifico ?? null).toBe(null);
    expect(guardados.area ?? null).toBe(null);
  });

  test("con el grupo muscular escondido, elegir un músculo no lo completa", async () => {
    datos.config = { campos: { musculo: { oculto: true } }, listas: {} };
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    await siguiente(contenedor);
    await elegirTipo(contenedor);
    await elegirZona(contenedor, "pierna_derecha", "Muslo");
    await siguiente(contenedor);
    expect(campoDeFormulario(contenedor, etiqueta("musculo"))).toBeUndefined();
    await tocar(chip(contenedor, "Bíceps femoral (cabeza larga)"));
    // Siguen todos los músculos del muslo a la vista.
    expect(chip(contenedor, "Recto femoral")).toBeTruthy();
    for (let i = 0; i < 3; i++) await siguiente(contenedor); // eslint-disable-line no-await-in-loop
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.guardadas[0].lesion.datos.musculo_especifico).toBe("biceps_femoral_longa");
    expect(datos.guardadas[0].lesion.datos.musculo ?? null).toBe(null);
  });

  test("una rodilla sin lado derecho o izquierdo no se dibuja como la derecha y deja elegir el lado", async () => {
    datos.lesiones = [{ ...lesionHulk(), datos: { parte_cuerpo: "joelho", lado: "nao_se_aplica" } }];
    await montar();
    await tocar(boton(contenedor, "Ver detalle"));
    // En la ficha no va la figura: no se sabe qué rodilla es.
    expect(contenedor.querySelector(".lesiones-marcador-figura")).toBeNull();
    await tocar(pestana(contenedor, "Descripción general"));
    await tocar(boton(contenedor, "Editar"));
    expect(tituloDelPaso(contenedor)).toBe("Descripción general");
    expect(contenedor.querySelector(".figura-cuerpo-pieza.elegida")).toBeNull();
    expect(texto(contenedor)).toContain("¿De qué lado?");
    await tocar(chip(contenedor, "Izquierdo"));
    expect(contenedor.querySelector(".figura-cuerpo-pieza.elegida")).toBeTruthy();
  });

  test("lo que agrega el club va en el cuerpo donde dice su nombre, y Ajustes lo muestra", async () => {
    const op = (codigo, es) => ({ codigo, etiquetas: { "es-AR": es, "pt-BR": "" }, oculto: false, orden: 99 });
    const conLasDelExcel = (campo, ...agregadas) => [...OPCIONES[campo].map((opcion, orden) => ({ ...opcion, oculto: false, orden })), ...agregadas];
    datos.config = {
      campos: {},
      listas: {
        parte_cuerpo: conLasDelExcel("parte_cuerpo", op("rotula_x", "Rótula")),
        musculo_especifico: conLasDelExcel("musculo_especifico", op("gemelo_interno_x", "Gemelo interno"), op("raro_x", "Músculo raro")),
      },
    };
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    await siguiente(contenedor);
    await elegirTipo(contenedor);
    // La parte del club va en la pierna, al lado de la rodilla, y se pinta la rodilla.
    await tocarFigura(contenedor.querySelector('.figura-cuerpo [data-region="pierna_derecha"]'));
    expect([...contenedor.querySelectorAll(".mapa-cuerpo-partes b")].map((b) => b.textContent).slice(2, 4)).toEqual(["Rodilla", "Rótula"]);
    await tocar(parteDeLaLista(contenedor, "Rótula"));
    expect(contenedor.querySelector('.figura-cuerpo [data-parte="joelho"] .figura-cuerpo-pieza.elegida')).toBeTruthy();
    expect(contenedor.querySelector(".mapa-cuerpo-elegido").textContent).toBe("Rótula · Derecho");
    await siguiente(contenedor);
    // En la rótula: lo de la rodilla y el gemelo del club; el que no se
    // reconoce, también (va en todas las partes).
    const especificos = () => [...campoDeFormulario(contenedor, etiqueta("musculo_especifico")).querySelectorAll(".chip-criterio")].map((b) => b.textContent);
    expect(especificos()).toEqual(expect.arrayContaining(["Semitendinoso", "Gemelo interno", "Músculo raro"]));
    // En el muslo, el gemelo no.
    await tocar(boton(contenedor, "Atrás"));
    await elegirZona(contenedor, "pierna_derecha", "Muslo");
    await siguiente(contenedor);
    expect(especificos()).not.toContain("Gemelo interno");
    expect(especificos()).toContain("Músculo raro");

    // En Ajustes, cada opción dice dónde va, y al escribir una nueva se ve en el momento.
    await navegar(contenedor, "Ajustes");
    await tocar(botonQueEmpieza(contenedor, "Listas"));
    await tocar(botonQueEmpieza(contenedor, etiqueta("musculo_especifico")));
    const detalleDe = (nombre) => [...contenedor.querySelectorAll(".opcion-ajuste")].find((b) => b.querySelector("b").textContent === nombre).textContent;
    expect(detalleDe("Semitendinoso")).toContain("En el cuerpo: Cadera / ingle, Muslo, Rodilla");
    expect(detalleDe("Gemelo interno")).toContain("En el cuerpo: Rodilla, Pierna / tendón de Aquiles");
    expect(detalleDe("Músculo raro")).toContain("No se reconoce en qué parte del cuerpo va: aparece en todas");
    await tocar(boton(contenedor, "Agregar una opción"));
    // El aviso está desde que se abre la hoja (vacío), para que el lector de pantalla lo lea.
    expect(contenedor.querySelector('.lesiones-hoja [aria-live="polite"]')).toBeTruthy();
    expect(contenedor.querySelector(".lesiones-donde-va")).toBeNull();
    await escribir(contenedor.querySelector(".lesiones-hoja .campo-inicio input"), "Peroneo largo");
    expect(contenedor.querySelector(".lesiones-donde-va").textContent).toBe("En el cuerpo: Pierna / tendón de Aquiles, Tobillo / pie");
    await escribir(contenedor.querySelector(".lesiones-hoja .campo-inicio input"), "Algo nuevo");
    expect(contenedor.querySelector(".lesiones-donde-va").textContent).toBe("No se reconoce en qué parte del cuerpo va: aparece en todas");
  });

  test("una parte del club que puede estar en dos lugares queda donde se tocó", async () => {
    const op = (codigo, es) => ({ codigo, etiquetas: { "es-AR": es, "pt-BR": "" }, oculto: false, orden: 99 });
    const lasDelExcel = (campo) => OPCIONES[campo].map((opcion, orden) => ({ ...opcion, oculto: false, orden }));
    datos.config = {
      campos: {},
      listas: {
        parte_cuerpo: [...lasDelExcel("parte_cuerpo"), op("dedo_x", "Dedo"), op("gluteo_x", "Glúteo")],
        // El club escondió los isquiotibiales: no se adelantan en la parte.
        musculo: lasDelExcel("musculo").map((opcion) => ({ ...opcion, oculto: opcion.codigo === "isquiotibiais" })),
      },
    };
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    await siguiente(contenedor);
    await elegirTipo(contenedor);
    // Lo que se adelanta de cada parte es lo que el club tiene a la vista.
    await tocarFigura(contenedor.querySelector('.figura-cuerpo [data-region="pierna_derecha"]'));
    expect(parteDeLaLista(contenedor, "Muslo").textContent).toContain("Cuádriceps, Aductores");
    expect(parteDeLaLista(contenedor, "Muslo").textContent).not.toContain("Isquiotibiales");
    // El dedo elegido en la pierna es del pie: se marca ahí y se pinta el pie.
    await tocar(parteDeLaLista(contenedor, "Dedo"));
    expect(parteDeLaLista(contenedor, "Dedo").getAttribute("aria-pressed")).toBe("true");
    expect(contenedor.querySelector(".mapa-cuerpo-camino").textContent).toBe("Cuerpo›Pierna derecha›Dedo");
    expect(contenedor.querySelector('.figura-cuerpo [data-region="pierna_derecha"] [data-parte="pe_dedo"] .figura-cuerpo-pieza.elegida')).toBeTruthy();
    expect(contenedor.querySelector(".mapa-cuerpo-elegido").textContent).toBe("Dedo · Derecho");
    // El glúteo elegido en el tronco: el lado se elige a mano y se puede cambiar.
    await elegirZona(contenedor, "tronco", "Glúteo");
    expect(texto(contenedor)).toContain("¿De qué lado?");
    await tocar(chip(contenedor, "Derecho"));
    expect(texto(contenedor)).toContain("¿De qué lado?");
    expect(parteDeLaLista(contenedor, "Glúteo").getAttribute("aria-pressed")).toBe("true");
    await tocar(chip(contenedor, "Izquierdo"));
    for (let i = 0; i < 4; i++) await siguiente(contenedor); // eslint-disable-line no-await-in-loop
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.guardadas[0].lesion.datos).toMatchObject({ parte_cuerpo: "gluteo_x", lado: "esquerdo" });
  });

  test("una fecha mal puesta frena el paso de la evolución", async () => {
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    await siguiente(contenedor);
    await elegirTipo(contenedor);
    await elegirZona(contenedor, "pierna_izquierda", "Rodilla");
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

  test("la imagen se compara con el día de la lesión recién cuando ese día ya se cargó", async () => {
    const hace = (dias) => {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - dias);
      return hoyISO(fecha);
    };
    await montar();
    await tocar(boton(contenedor, "Nueva lesión"));
    await tocar(botonQueEmpieza(contenedor, "SCARPA"));
    await siguiente(contenedor);
    await elegirTipo(contenedor);
    await elegirZona(contenedor, "pierna_izquierda", "Rodilla");
    // Una imagen de hace dos días: el día de la lesión todavía no se cargó
    // (viene el de hoy), así que no frena acá.
    await escribir(campoDeFormulario(contenedor, etiqueta("hora_imagen")).querySelector("input"), `${hace(2)}T20:00`);
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Descripción específica");
    await siguiente(contenedor);
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Evolución y continuación");
    // Con el día de hoy, la lesión quedaría después de la imagen: frena acá.
    expect(campoDeFormulario(contenedor, etiqueta("fecha_lesion")).textContent).not.toContain("Horas entre la lesión y la imagen");
    await siguiente(contenedor);
    expect(texto(contenedor)).toContain("La lesión no puede empezar después de la imagen (");
    expect(tituloDelPaso(contenedor)).toBe("Evolución y continuación");
    await escribir(campoDeFormulario(contenedor, etiqueta("fecha_lesion")).querySelector("input"), hace(3));
    expect(campoDeFormulario(contenedor, etiqueta("fecha_lesion")).textContent).toContain("Horas entre la lesión y la imagen: 44 horas");
    await siguiente(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Observaciones");
    // Ya cargado el día, las horas también se ven al volver a la imagen.
    await tocar(contenedor.querySelectorAll(".lesiones-progreso button")[1]);
    expect(tituloDelPaso(contenedor)).toBe("Descripción general");
    expect(campoDeFormulario(contenedor, etiqueta("hora_imagen")).textContent).toContain("Horas entre la lesión y la imagen: 44 horas");
    await tocar(contenedor.querySelectorAll(".lesiones-progreso button")[5]);
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.guardadas).toHaveLength(1);
    expect(datos.guardadas[0].lesion).toMatchObject({ fecha_lesion: hace(3), datos: { hora_imagen: `${hace(2)}T20:00` } });
  });

  test("al guardar, lo que falta se muestra en el paso donde se corrige", async () => {
    // Una lesión de antes de que el tipo fuera obligatorio.
    datos.lesiones = [{ ...lesionHulk(), datos: { parte_cuerpo: "coxa", lado: "direito" } }];
    await montar();
    await tocar(boton(contenedor, "Ver detalle"));
    await tocar(pestana(contenedor, "Observaciones"));
    await tocar(boton(contenedor, "Editar"));
    await escribir(campoDeFormulario(contenedor, etiqueta("medico")).querySelector("input"), "Dr. X");
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.actualizadas).toHaveLength(0);
    expect(tituloDelPaso(contenedor)).toBe("Descripción general");
    expect(texto(contenedor)).toContain("Elegí el tipo de lesión.");
    await elegirTipo(contenedor);
    await tocar(contenedor.querySelectorAll(".lesiones-progreso button")[5]);
    expect(campoDeFormulario(contenedor, etiqueta("medico")).querySelector("input").value).toBe("Dr. X");
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.actualizadas).toHaveLength(1);
    expect(datos.actualizadas[0].lesion.datos).toMatchObject({ tipo_lesion: "muscular_1a", medico: "Dr. X" });
  });

  test("con la hora de la imagen escondida, una imagen vieja no frena el guardado", async () => {
    datos.config = { campos: { hora_imagen: { oculto: true } }, listas: {} };
    datos.lesiones = [{ ...lesionHulk(), datos: { ...lesionHulk().datos, hora_imagen: "2026-09-20T10:00" } }];
    await montar();
    await tocar(boton(contenedor, "Ver detalle"));
    await tocar(pestana(contenedor, "Evolución y continuación"));
    await tocar(boton(contenedor, "Editar"));
    await escribir(campoDeFormulario(contenedor, etiqueta("fecha_lesion")).querySelector("input"), "2026-09-21");
    await tocar(contenedor.querySelectorAll(".lesiones-progreso button")[5]);
    await tocar(boton(contenedor, "Guardar la lesión"));
    await act(async () => Promise.resolve());
    expect(datos.actualizadas).toHaveLength(1);
    expect(datos.actualizadas[0].lesion.fecha_lesion).toBe("2026-09-21");
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

  test("los reportes: el individual como el del Excel y el grupal", async () => {
    // Fechas contadas desde hoy, para que la prueba ande cualquier día del año.
    const haceDias = (dias) => {
      const fecha = new Date(`${hoyISO()}T12:00:00Z`);
      fecha.setUTCDate(fecha.getUTCDate() - dias);
      return fecha.toISOString().slice(0, 10);
    };
    const contexto = { producto: "nao_traumatica", cuando: "treinamento", localizacion: "profissional" };
    datos.lesiones = [
      { ...lesionHulk(), fecha_lesion: haceDias(20), fecha_alta: haceDias(10), datos: { ...lesionHulk().datos, ...contexto } },
      { ...lesionHulk(), id: "les-2", numero_caso: 2, jugador_id: 8, fecha_lesion: haceDias(15), fecha_alta: haceDias(13), datos: { parte_cuerpo: "joelho", lado: "esquerdo", tipo_lesion: "entorse", cuando: "treinamento" } },
    ];
    await montar();
    await navegar(contenedor, "Reportes");
    expect(texto(contenedor)).toContain("Ver reportes");
    expect(texto(contenedor)).toContain("Crear reportes");

    await tocar(botonQueEmpieza(contenedor, "Reporte individual"));
    await tocar(botonQueEmpieza(contenedor, "HULK"));
    // La cabecera: el título, el jugador, su posición, nacimiento y pie.
    expect(contenedor.querySelector(".informe-cabecera h1").textContent).toBe("HULK");
    expect(contenedor.querySelector(".informe-subtitulo").textContent).toBe("Reporte individual de lesiones");
    const datosDelJugador = [...contenedor.querySelectorAll(".informe-dato dt")].map((dt) => dt.textContent);
    expect(datosDelJugador).toEqual(["Nacimiento", "Pie dominante"]);
    // Los indicadores cada 1000 horas: las cuatro columnas del Excel en cada
    // medida y, sin los minutos del GPS, sin números y con el aviso.
    const medidas = contenedor.querySelectorAll(".informe-medida");
    expect([...medidas].map((medida) => medida.querySelector("h2").textContent)).toEqual(["Lesiones / 1000 h", "Días perdidos / 1000 h"]);
    expect([...medidas[1].querySelectorAll(".informe-indicador-titulo")].map((titulo) => titulo.textContent)).toEqual([
      "Severidad (TODAS) y Tipos (TODOS)",
      "Severidad (SIN LEVES) y Tipos (TODOS)",
      "Severidad (TODAS) y Tipos (SOLO LM)",
      "Severidad (SIN LEVES) y Tipos (SOLO LM)",
    ]);
    expect([...contenedor.querySelectorAll(".informe-indicador-valor")].every((valor) => valor.textContent === "—")).toBe(true);
    expect(contenedor.querySelectorAll(".informe-indicador-contra")).toHaveLength(0);
    expect(texto(contenedor)).toContain("Faltan los minutos del GPS");
    expect(texto(contenedor)).toContain("Superior a la referencia");
    // El mapa corporal: una mancha donde se lesionó, con su nombre.
    expect(contenedor.querySelectorAll(".informe-mapa .cuerpo-calor-mancha")).toHaveLength(1);
    expect(contenedor.querySelectorAll(".informe-mapa .cuerpo-calor-nombre")).toHaveLength(1);
    // El historial: sus lesiones, con las doce columnas del reporte a la vista.
    expect(contenedor.querySelectorAll(".informe-tabla tbody tr")).toHaveLength(1);
    const cabeceras = [...contenedor.querySelectorAll(".informe-tabla th")].map((th) => th.textContent);
    expect(cabeceras).toHaveLength(12);
    expect(cabeceras.slice(0, 3)).toEqual([etiqueta("numero_registro"), etiqueta("parte_cuerpo"), etiqueta("tipo_lesion")]);
    expect(contenedor.querySelectorAll(".informe-tabla select")).toHaveLength(0);

    await tocar(contenedor.querySelector(".reporte-volver"));
    await tocar(botonQueEmpieza(contenedor, "Reporte grupal"));
    await tocar(chip(contenedor, "Todo"));
    const kpis = () => [...contenedor.querySelectorAll(".reporte-kpi")].map((kpi) => kpi.textContent);
    expect(kpis().slice(0, 3)).toEqual(["2Lesiones", "2Jugadores lesionados", "12Días perdidos"]);
    // El cuadro del plantel: entra solo la de HULK (no traumática, en
    // entrenamiento, del profesional), que es muscular y no es leve.
    const cuadro = contenedor.querySelector(".informe-cuadro");
    expect([...cuadro.querySelector("tbody tr").querySelectorAll("td")].map((td) => td.textContent)).toEqual(["1", "1", "1", "1"]);
    expect(texto(contenedor)).toContain("Lesiones por mes");
    expect(texto(contenedor)).toContain("Quiénes perdieron más días");
    // El mismo mapa corporal que el individual, con las dos lesiones.
    expect(contenedor.querySelectorAll(".reporte-mapa .cuerpo-calor-mancha")).toHaveLength(2);
  });

  test("los reportes no muestran ceros si las lesiones no se pudieron leer", async () => {
    datos.errorAlLeer = "lesiones.error.noLeer";
    await montar();
    await navegar(contenedor, "Reportes");
    expect(contenedor.querySelector(".lesiones-estado.error")).not.toBe(null);
    await tocar(botonQueEmpieza(contenedor, "Reporte individual"));
    expect(contenedor.querySelector(".lesiones-estado.error")).not.toBe(null);
    expect(contenedor.querySelector(".lesiones-elegir-jugador")).toBe(null);
    expect(contenedor.querySelector(".informe")).toBe(null);
    expect(texto(contenedor)).not.toContain("Imprimir o guardar en PDF");
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

  test("una lesión sin fecha de inicio queda para completar, y la de alguien fuera de Datos básicos se ve con su nombre", async () => {
    datos.lesiones = [
      lesionHulk(),
      { ...lesionHulk(), id: "les-sin-fecha", jugador_id: 8, numero_caso: 29, fecha_lesion: null, datos: {} },
      { ...lesionHulk(), id: "les-persona", jugador_id: null, persona: "Cata Tres", numero_caso: 30, fecha_lesion: "2026-09-22", datos: { parte_cuerpo: "joelho", lado: "direito", tipo_lesion: "entorse" } },
    ];
    await montar();
    // Activas: la de HULK y la de la persona; la sin fecha no cuenta.
    expect(contenedor.querySelector(".estado-hero").textContent).toBe("2 lesiones activas");
    const nombresActivas = [...contenedor.querySelectorAll(".lesiones-lista")[0].querySelectorAll(".lesiones-registro-cuerpo strong")].map((nombre) => nombre.textContent);
    expect(nombresActivas).toContain("Cata Tres");
    const sinFecha = contenedor.querySelector(".lesiones-sin-fecha");
    expect(sinFecha.querySelector("h2").textContent).toBe("1 lesión sin fecha de inicio");
    expect(sinFecha.querySelector(".lesiones-registro-cuerpo strong").textContent).toBe("SCARPA");
    expect(sinFecha.querySelector(".lesiones-etapa").textContent).toBe("Sin fecha de inicio");
    expect(boton(sinFecha, "Alta médica")).toBeUndefined();
    // Su ficha: sin días de baja inventados.
    await tocar(boton(sinFecha, "Ver detalle"));
    expect(contenedor.querySelector(".total-ficha b").textContent).toBe("—");
    // En el historial, la persona fuera de Datos básicos también está.
    await navegar(contenedor, "Historial");
    await escribir(contenedor.querySelector(".lesiones-buscador-jugador"), "cata");
    const encontrados = [...contenedor.querySelectorAll(".lesiones-lista-jugadores button")];
    expect(encontrados.map((uno) => uno.textContent)).toEqual(["Cata Tres1 lesión · No está en Datos básicos"]);
    await tocar(encontrados[0]);
    expect(contenedor.querySelector(".lesiones-cantidad").textContent).toBe("1 lesión");
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

  test("los del plantel actual van primero; los que se fueron, abajo y marcados (y sin lesiones no están en el historial)", async () => {
    datos.plantel = [
      { id: 7, nombre: "HULK", roles: [], puestos: [], actual: false, categoria: "", fecha_nacimiento: "", pie_dominante: "", posicion: "", foto_url: "" },
      { id: 8, nombre: "SCARPA", roles: [], puestos: [], actual: true, categoria: "", fecha_nacimiento: "", pie_dominante: "", posicion: "", foto_url: "" },
      { id: 5, nombre: "ZAGUEIRO", roles: [], puestos: [], actual: false, categoria: "", fecha_nacimiento: "", pie_dominante: "", posicion: "", foto_url: "" },
    ];
    await montar();
    // Historial: el de HULK (se fue, con lesiones) se sigue abriendo; ZAGUEIRO (se fue, sin lesiones) no está.
    await navegar(contenedor, "Historial");
    const lista = () => [...contenedor.querySelectorAll(".lesiones-lista-jugadores button")].map((b) => b.textContent);
    expect(lista()).toEqual(["SCARPA0 lesiones", "HULK1 lesión · Ya no está"]);
    // Una lesión nueva: primero el plantel actual; también se puede cargar una vieja de quien se fue.
    await navegar(contenedor, "Lesionados");
    await tocar(boton(contenedor, "Nueva lesión"));
    const candidatos = [...contenedor.querySelectorAll(".lesiones-lista-jugadores button")].map((b) => b.textContent);
    expect(candidatos).toEqual(["SCARPA", "HULKYa no está", "ZAGUEIROYa no está"]);
    await tocar(boton(contenedor, "Cancelar"));
    // En la Base, la lesión de quien se fue va en otro color, con la leyenda.
    await navegar(contenedor, "Base");
    const filas = [...contenedor.querySelectorAll(".tabla-datos-tabla tbody tr")];
    expect(filas.map((fila) => [fila.querySelectorAll("td")[2].textContent, fila.classList.contains("apagada")])).toEqual([["HULK", true]]);
    expect(contenedor.querySelector(".tabla-datos-leyenda").textContent).toContain("ya no están en el plantel actual");
  });

  test("en la Base, solo va en otro color la lesión de quien desmarcaron en Actual", async () => {
    datos.lesiones = [
      ...datos.lesiones,
      { ...datos.lesiones[0], id: "les-scarpa", jugador_id: 8, numero_caso: 2 },
      { ...datos.lesiones[0], id: "les-persona", jugador_id: null, persona: "ALGUIEN DE AFUERA", numero_caso: 3 },
    ];
    await montar();
    await navegar(contenedor, "Base");
    const filas = [...contenedor.querySelectorAll(".tabla-datos-tabla tbody tr")];
    expect(filas.map((fila) => fila.classList.contains("apagada"))).toEqual([false, false, false]);
    expect(contenedor.querySelector(".tabla-datos-leyenda").classList.contains("oculta")).toBe(true);
  });

  test("en la Base y en el historial, cada lesión va en el color de su jugador", async () => {
    datos.plantel = [
      { id: 7, nombre: "HULK", roles: [], puestos: [], actual: false, categoria: "", fecha_nacimiento: "", pie_dominante: "", posicion: "", foto_url: "" },
      { id: 8, nombre: "SCARPA", roles: [], puestos: [], actual: true, categoria: "", fecha_nacimiento: "", pie_dominante: "", posicion: "", foto_url: "" },
    ];
    datos.lesiones = [...datos.lesiones, { ...datos.lesiones[0], id: "les-scarpa", jugador_id: 8, numero_caso: 2 }];
    await montar();
    await navegar(contenedor, "Base");
    const apagadas = () => [...contenedor.querySelectorAll(".tabla-datos-tabla tbody tr")].map((fila) => [fila.querySelectorAll("td")[2].textContent, fila.classList.contains("apagada")]);
    expect(apagadas()).toEqual([
      ["HULK", true],
      ["SCARPA", false],
    ]);
    // El historial de cada uno, igual.
    await navegar(contenedor, "Historial");
    await tocar([...contenedor.querySelectorAll(".lesiones-lista-jugadores button")].find((b) => b.textContent.startsWith("SCARPA")));
    expect(apagadas()).toEqual([["SCARPA", false]]);
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

  test("en la base las lesiones nuevas van abajo, y a una vieja se le cambia una celda aunque le falte el tipo", async () => {
    datos.lesiones = [
      { ...lesionHulk(), id: "les-3", numero_caso: 3, fecha_lesion: "2026-09-25" },
      { ...lesionHulk(), id: "les-2", numero_caso: 2, jugador_id: 8, fecha_lesion: "2026-09-28", datos: { parte_cuerpo: "joelho", lado: "esquerdo" } },
      lesionHulk(),
    ];
    await montar();
    await navegar(contenedor, "Base");
    const filas = () => [...contenedor.querySelectorAll(".tabla-datos-tabla tbody tr")];
    expect(filas().map((tr) => tr.querySelector("td").textContent)).toEqual(["1", "2", "3"]);
    // El caso 2 no tiene tipo de lesión: igual se le carga el médico.
    const cabeceras = [...contenedor.querySelectorAll(".tabla-datos-tabla th[data-columna]")];
    const indiceMedico = cabeceras.findIndex((th) => th.textContent === etiqueta("medico"));
    const celda = () => filas()[1].querySelectorAll("td")[indiceMedico];
    await tocar(celda());
    await tocar(celda());
    const input = celda().querySelector("input");
    await escribir(input, "Dra. Pérez");
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(datos.actualizadas).toHaveLength(1);
    expect(datos.actualizadas[0]).toMatchObject({ id: "les-2", lesion: { datos: { medico: "Dra. Pérez" } } });
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
    await elegirTipo(contenedor);
    expect(tituloDelPaso(contenedor)).toBe("Qué pasó");
    // También se puede elegir de la lista, como antes de la figura. Parte del
    // cuerpo es obligatoria: sigue a la vista aunque la configuración diga que no.
    await tocar(botonQueEmpieza(contenedor, "Elegir de la lista"));
    expect(contenedor.querySelector(".mapa-cuerpo")).toBeNull();
    expect(contenedor.querySelector('.selector-hoja[aria-label="Parte del cuerpo lesionada"]')).toBeTruthy();
    await elegirEnHoja(contenedor, "Parte del cuerpo lesionada", "Rodilla");
    await tocar(chip(contenedor, "Izquierdo"));
    // Y se vuelve a la figura con lo elegido.
    await tocar(botonQueEmpieza(contenedor, "Elegir con la figura"));
    expect(contenedor.querySelector(".mapa-cuerpo-elegido").textContent).toBe("Rodilla · Izquierdo");
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
    await elegirZona(contenedor, "pierna_derecha", "Muslo");
    expect(texto(contenedor)).toContain("Puede contar como recurrencia o recidiva");
  });
});
