import { describe, expect, it } from "vitest";
import {
  LISTA_SELECCION,
  armarConfig,
  categoriaDeTextoDelClub,
  columnaOculta,
  columnasVisibles,
  esCategoriaDelClub,
  etiquetaDeOpcion,
  opcionesDeLista,
  textoDeComparar,
  tituloDeColumna,
} from "./ajustes.js";
import { ZONA_MEDIA } from "./tests/zonaMedia.js";
import { pasosDeCarga } from "../../Evaluaciones.jsx";

// Lo que el club cambió en Ajustes (inventado).
const config = armarConfig(
  [
    { test: "zona_media", campo: "lumbar", etiqueta_es: "Lumbar (min)", etiqueta_pt: "", oculto: false, orden: 5 },
    { test: "zona_media", campo: "prono", etiqueta_es: "", etiqueta_pt: "", oculto: true, orden: 16 },
    { test: "zona_media", campo: "seleccion", etiqueta_es: "", etiqueta_pt: "", oculto: true, orden: 3 },
  ],
  [
    { lista: "seleccion", codigo: "mayor", etiqueta_es: "Primera", etiqueta_pt: "", oculto: false, orden: 5 },
    { lista: "seleccion", codigo: "sub15", etiqueta_es: "", etiqueta_pt: "", oculto: true, orden: 0 },
    { lista: "seleccion", codigo: "reserva_x", etiqueta_es: "Reserva", etiqueta_pt: "Reserva", oculto: false, orden: 6 },
  ],
);
const columna = (clave) => ZONA_MEDIA.columnas.find((una) => una.clave === clave);

describe("Evaluaciones › Ajustes", () => {
  it("el nombre de una cabecera: el del club, en el otro idioma si falta, y si no el del Excel", () => {
    expect(tituloDeColumna(ZONA_MEDIA, columna("lumbar"), config, "es-AR")).toBe("Lumbar (min)");
    expect(tituloDeColumna(ZONA_MEDIA, columna("lumbar"), config, "pt-BR")).toBe("Lumbar (min)");
    expect(tituloDeColumna(ZONA_MEDIA, columna("prono"), config, "pt-BR")).toBe("Prono");
    expect(tituloDeColumna(ZONA_MEDIA, columna("lateral_i"), armarConfig(), "pt-BR")).toBe("Lateral E");
  });

  it("esconder: Fecha, Jugador y Selección no se esconden nunca", () => {
    expect(columnaOculta(ZONA_MEDIA, "prono", config)).toBe(true);
    expect(columnaOculta(ZONA_MEDIA, "seleccion", config)).toBe(false);
    const claves = columnasVisibles(ZONA_MEDIA, config).map((una) => una.clave);
    expect(claves).not.toContain("prono");
    expect(claves).toContain("seleccion");
    // Lo calculado con Prono no se esconde solo.
    expect(claves).toContain("ratio");
  });

  it("Selección: las del Excel con el nombre del club, las escondidas aparte y las que sumó el club al final", () => {
    expect(opcionesDeLista(LISTA_SELECCION, config, "es-AR").map((una) => una.etiqueta)).toEqual(["Sub-17", "Sub-18", "Sub-20", "Sub-23", "Primera", "Reserva"]);
    expect(opcionesDeLista(LISTA_SELECCION, config, "pt-BR", { conOcultas: true }).map((una) => una.etiqueta)).toEqual([
      "Sub-15",
      "Sub-17",
      "Sub-18",
      "Sub-20",
      "Sub-23",
      "Primera",
      "Reserva",
    ]);
    // Sin cambios, las del Excel (en portugués, Mayor es Profissional).
    expect(opcionesDeLista(LISTA_SELECCION, armarConfig(), "pt-BR").map((una) => una.etiqueta).at(-1)).toBe("Profissional");
    // Una escondida se sigue viendo en lo cargado.
    expect(etiquetaDeOpcion(LISTA_SELECCION, "sub15", config, "es-AR")).toBe("Sub-15");
    expect(etiquetaDeOpcion(LISTA_SELECCION, "borrada", config, "es-AR")).toBe("borrada");
  });

  it("una categoría del club vale como categoría (sus clases quedan vacías sin V.R.)", () => {
    expect(esCategoriaDelClub("reserva_x", config)).toBe(true);
    expect(esCategoriaDelClub("sub15", config)).toBe(true);
    expect(esCategoriaDelClub("otra", config)).toBe(false);
  });

  it("el selector del informe: el texto del Excel o «Vs» y el nombre del club", () => {
    expect(textoDeComparar("sub17", config, "es-AR")).toBe("Vs Sub 17");
    expect(textoDeComparar("mayor", armarConfig(), "pt-BR")).toBe("Vs Profissional");
    expect(textoDeComparar("mayor", config, "es-AR")).toBe("Vs Primera");
    expect(textoDeComparar("reserva_x", config, "es-AR")).toBe("Vs Reserva");
  });

  it("al pegar, la Selección se reconoce como en el Excel y con los nombres del club", () => {
    expect(categoriaDeTextoDelClub("Sub-20", config)).toBe("sub20");
    expect(categoriaDeTextoDelClub("Profissional", config)).toBe("mayor");
    expect(categoriaDeTextoDelClub("primera", config)).toBe("mayor");
    expect(categoriaDeTextoDelClub("RESERVA", config)).toBe("reserva_x");
    expect(categoriaDeTextoDelClub("", config)).toBe(null);
    expect(categoriaDeTextoDelClub("Juveniles", config)).toBe(undefined);
  });
});

describe("Evaluaciones › los pasos de la carga", () => {
  it("Zona Media: de quién y cuándo (con Selección) y después las medidas con la nota al final", () => {
    expect(pasosDeCarga(ZONA_MEDIA, armarConfig()).map((paso) => paso.columnas)).toEqual([
      ["jugador", "fecha", "seleccion"],
      ["lumbar", "lateral_d", "lateral_i", "prono", "nota"],
    ]);
  });

  it("una columna escondida no se pide", () => {
    expect(pasosDeCarga(ZONA_MEDIA, config)[1].columnas).toEqual(["lumbar", "lateral_d", "lateral_i", "nota"]);
  });

  it("un test con bloques: un paso por bloque", () => {
    const conBloques = {
      ...ZONA_MEDIA,
      columnas: [
        ...ZONA_MEDIA.columnas.filter((una) => ["fecha", "jugador", "seleccion"].includes(una.clave)),
        { clave: "a1", tipo: "numero", grupo: "a", titulo: { "es-AR": "A1" } },
        { clave: "a2", tipo: "numero", grupo: "a", titulo: { "es-AR": "A2" } },
        { clave: "b1", tipo: "numero", grupo: "b", titulo: { "es-AR": "B1" } },
        { clave: "nota", tipo: "texto", titulo: { "es-AR": "Nota" } },
      ],
    };
    expect(pasosDeCarga(conBloques, armarConfig()).map((paso) => [paso.grupo, paso.columnas])).toEqual([
      [null, ["jugador", "fecha", "seleccion"]],
      ["a", ["a1", "a2"]],
      ["b", ["b1", "nota"]],
    ]);
  });
});
