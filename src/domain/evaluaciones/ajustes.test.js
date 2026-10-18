import { describe, expect, it } from "vitest";
import {
  LISTA_SELECCION,
  absolutaDe,
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
import { aDatosBasicos, deDatosBasicos, seleccionesAlCambiar } from "./categorias.js";
import { ZONA_MEDIA } from "./tests/zonaMedia.js";
import { CURL_NORDICO_ISOPRONE } from "./tests/curlNordicoIsoprone.js";
import { PRESS_PLANO } from "./tests/pressPlano.js";
import { TESTS } from "./tests/index.js";
import { GPS } from "../gps/columnas.js";
import { armarConfigGps } from "../gps/ajustes.js";
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
// Las categorías del club en Datos básicos (inventadas): Mayor renombrada,
// Sub-18 escondida y una sumada; y una que el club había sumado antes en
// Evaluaciones.
const categoriasDelClub = armarConfig(
  [],
  [{ lista: "seleccion", codigo: "juveniles_v", etiqueta_es: "Juveniles", etiqueta_pt: "", oculto: false, orden: 6 }],
  [
    { campo: "categoria", codigo: "profissional", etiqueta_es: "Primera", etiqueta_pt: "Profissional", oculto: false, orden: 0 },
    { campo: "categoria", codigo: "sub23", etiqueta_es: "Sub-23", etiqueta_pt: "Sub-23", oculto: false, orden: 1 },
    { campo: "categoria", codigo: "sub20", etiqueta_es: "Sub-20", etiqueta_pt: "Sub-20", oculto: false, orden: 2 },
    { campo: "categoria", codigo: "sub18", etiqueta_es: "Sub-18", etiqueta_pt: "Sub-18", oculto: true, orden: 3 },
    { campo: "categoria", codigo: "sub17", etiqueta_es: "Sub-17", etiqueta_pt: "Sub-17", oculto: false, orden: 4 },
    { campo: "categoria", codigo: "sub15", etiqueta_es: "Sub-15", etiqueta_pt: "Sub-15", oculto: false, orden: 5 },
    { campo: "categoria", codigo: "reserva_x", etiqueta_es: "Reserva", etiqueta_pt: "Reserva", oculto: false, orden: 6 },
  ],
);

describe("Evaluaciones › Ajustes", () => {
  it("el nombre de una cabecera: el del club, en el otro idioma si falta, y si no el del Excel", () => {
    expect(tituloDeColumna(ZONA_MEDIA, columna("lumbar"), config, "es-AR")).toBe("Lumbar (min)");
    expect(tituloDeColumna(ZONA_MEDIA, columna("lumbar"), config, "pt-BR")).toBe("Lumbar (min)");
    expect(tituloDeColumna(ZONA_MEDIA, columna("prono"), config, "pt-BR")).toBe("Prono");
    expect(tituloDeColumna(ZONA_MEDIA, columna("lateral_i"), armarConfig(), "pt-BR")).toBe("Lateral E");
  });

  // Santiago, 13/10: «solo se puede cambiar el nombre de las absolutas y las
  // relativas pasan a tomar el nombre del absoluto pero dependiendo que sea
  // se le agrega /Min o /PC».
  it("una relativa no tiene nombre propio: el de su absoluta con /PC (y lo que se le haya puesto, no cuenta)", () => {
    const curl = (clave) => CURL_NORDICO_ISOPRONE.columnas.find((una) => una.clave === clave);
    expect(tituloDeColumna(CURL_NORDICO_ISOPRONE, curl("curl_l_max_rel"), armarConfig(), "es-AR")).toBe("L MÁX/PC");
    const delClub = armarConfig([
      { test: "curl_nordico_isoprone", campo: "curl_l_max", etiqueta_es: "Izq. máx.", etiqueta_pt: "Esq. máx.", oculto: false, orden: 5 },
      { test: "curl_nordico_isoprone", campo: "curl_l_max_rel", etiqueta_es: "Un nombre viejo", etiqueta_pt: "", oculto: false, orden: 6 },
    ]);
    expect(tituloDeColumna(CURL_NORDICO_ISOPRONE, curl("curl_l_max_rel"), delClub, "es-AR")).toBe("Izq. máx./PC");
    expect(tituloDeColumna(CURL_NORDICO_ISOPRONE, curl("curl_l_max_rel"), delClub, "pt-BR")).toBe("Esq. máx./PC");
    const press = PRESS_PLANO.columnas.find((una) => una.clave === "rel");
    expect(tituloDeColumna(PRESS_PLANO, press, armarConfig(), "es-AR")).toBe("RM/PC");
  });

  it("una relativa de GPS (por minuto): el de su medida con /min", () => {
    const dMin = GPS.columnas.find((una) => una.clave === "d_min");
    expect(tituloDeColumna(GPS, dMin, armarConfigGps([], []), "es-AR")).toBe("D/min");
    const delClub = armarConfigGps([{ campo: "d", etiqueta_es: "Distancia", etiqueta_pt: "", oculto: false, orden: 3, tipo: null }], []);
    expect(tituloDeColumna(GPS, dMin, delClub, "es-AR")).toBe("Distancia/min");
    expect(tituloDeColumna(GPS, GPS.columnas.find((una) => una.clave === "mts90_min"), armarConfigGps([], []), "es-AR")).toBe("Mts >= 90% Pico/min");
  });

  it("toda relativa apunta a una absoluta de su mismo test, que no es relativa", () => {
    const relativas = [GPS, ...TESTS].flatMap((test) => test.columnas.filter((una) => una.relativa).map((columna) => ({ test, columna })));
    // GPS: las 10 por minuto; Evaluaciones: Curl (8), Aductor-Abductor (4), Sentadilla (2) y Press (1).
    expect(relativas.filter(({ test }) => test.id === "gps")).toHaveLength(10);
    expect(relativas.filter(({ test }) => test.id !== "gps")).toHaveLength(15);
    relativas.forEach(({ test, columna }) => {
      const absoluta = absolutaDe(test, columna);
      expect(absoluta, `${test.id}: ${columna.clave}`).toBeTruthy();
      expect(absoluta.relativa).toBeUndefined();
      expect(["/min", "/PC"]).toContain(columna.relativa.sufijo);
    });
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

  // Santiago, 18/10: las categorías son las de Datos básicos («La de Datos
  // básicos»), con sus nombres; lo cargado antes no se pierde.
  it("Selección: las de Datos básicos, con sus nombres y su orden; lo cargado con otra se sigue viendo", () => {
    expect(opcionesDeLista(LISTA_SELECCION, categoriasDelClub, "es-AR").map((una) => [una.valor, una.etiqueta])).toEqual([
      ["mayor", "Primera"],
      ["sub23", "Sub-23"],
      ["sub20", "Sub-20"],
      ["sub17", "Sub-17"],
      ["sub15", "Sub-15"],
      ["reserva_x", "Reserva"],
    ]);
    // La escondida en Datos básicos y la que el club había sumado acá, solo para lo cargado.
    expect(opcionesDeLista(LISTA_SELECCION, categoriasDelClub, "es-AR", { conOcultas: true }).map((una) => una.etiqueta)).toEqual([
      "Primera",
      "Sub-23",
      "Sub-20",
      "Sub-18",
      "Sub-17",
      "Sub-15",
      "Reserva",
      "Juveniles",
    ]);
    // Sin lo del club, las de Datos básicos de la app (en portugués, Profissional).
    expect(opcionesDeLista(LISTA_SELECCION, armarConfig(), "es-AR").map((una) => una.etiqueta)).toEqual(["Mayor (profesional)", "Sub-23", "Sub-20", "Sub-18", "Sub-17", "Sub-15"]);
    expect(opcionesDeLista(LISTA_SELECCION, armarConfig(), "pt-BR")[0]).toMatchObject({ valor: "mayor", etiqueta: "Profissional" });
    expect(etiquetaDeOpcion(LISTA_SELECCION, "juveniles_v", categoriasDelClub, "es-AR")).toBe("Juveniles");
    expect(etiquetaDeOpcion(LISTA_SELECCION, "borrada", categoriasDelClub, "es-AR")).toBe("borrada");
  });

  it("una categoría del club vale como categoría (sus clases quedan vacías sin V.R.)", () => {
    expect(esCategoriaDelClub("reserva_x", categoriasDelClub)).toBe(true);
    expect(esCategoriaDelClub("sub18", categoriasDelClub)).toBe(true);
    expect(esCategoriaDelClub("juveniles_v", categoriasDelClub)).toBe(true);
    expect(esCategoriaDelClub("otra", categoriasDelClub)).toBe(false);
  });

  it("el selector del informe: el texto del Excel o «Vs» y el nombre de Datos básicos", () => {
    expect(textoDeComparar("sub17", categoriasDelClub, "es-AR")).toBe("Vs Sub 17");
    expect(textoDeComparar("mayor", armarConfig(), "pt-BR")).toBe("Vs Profissional");
    expect(textoDeComparar("mayor", armarConfig(), "es-AR")).toBe("Vs Mayor (profesional)");
    expect(textoDeComparar("mayor", categoriasDelClub, "es-AR")).toBe("Vs Primera");
    expect(textoDeComparar("reserva_x", categoriasDelClub, "es-AR")).toBe("Vs Reserva");
  });

  it("al pegar, la Selección se reconoce como en el Excel y con los nombres de Datos básicos", () => {
    expect(categoriaDeTextoDelClub("Sub-20", categoriasDelClub)).toBe("sub20");
    expect(categoriaDeTextoDelClub("Profissional", categoriasDelClub)).toBe("mayor");
    expect(categoriaDeTextoDelClub("primera", categoriasDelClub)).toBe("mayor");
    expect(categoriaDeTextoDelClub("Mayor (profesional)", armarConfig())).toBe("mayor");
    expect(categoriaDeTextoDelClub("RESERVA", categoriasDelClub)).toBe("reserva_x");
    expect(categoriaDeTextoDelClub("Juveniles", categoriasDelClub)).toBe("juveniles_v");
    expect(categoriaDeTextoDelClub("", categoriasDelClub)).toBe(null);
    expect(categoriaDeTextoDelClub("Infantiles", categoriasDelClub)).toBe(undefined);
  });
});

// Santiago, 18/10: al cambiarle la categoría a un jugador en Datos básicos,
// la misma pregunta que en Lesiones, también para sus evaluaciones.
describe("Evaluaciones › la categoría al cambiarla en Datos básicos", () => {
  const evaluaciones = [
    { id: "e1", fecha: "2026-03-01", datos: { seleccion: "sub20", lumbar: 200 } },
    { id: "e2", fecha: "2026-05-01", datos: { lumbar: 210 } },
    { id: "e3", fecha: "2026-08-01", datos: { seleccion: "sub20" } },
  ];
  it("Datos básicos llama «profissional» a Mayor; las demás, igual", () => {
    expect(deDatosBasicos("profissional")).toBe("mayor");
    expect(deDatosBasicos("sub20")).toBe("sub20");
    expect(deDatosBasicos("")).toBe(null);
    expect(aDatosBasicos("mayor")).toBe("profissional");
    expect(aDatosBasicos("reserva_x")).toBe("reserva_x");
  });
  it("«En todo su historial»: todas pasan a la nueva", () => {
    expect(seleccionesAlCambiar(evaluaciones, { anterior: "sub20", nueva: "profissional", desde: null })).toEqual([
      { id: "e1", datos: { seleccion: "mayor", lumbar: 200 } },
      { id: "e2", datos: { seleccion: "mayor", lumbar: 210 } },
      { id: "e3", datos: { seleccion: "mayor" } },
    ]);
  });
  it("«Desde esa fecha»: las de antes quedan con la suya (o la anterior); desde esa fecha, la nueva", () => {
    expect(seleccionesAlCambiar(evaluaciones, { anterior: "sub20", nueva: "profissional", desde: "2026-06-01" })).toEqual([
      { id: "e2", datos: { seleccion: "sub20", lumbar: 210 } },
      { id: "e3", datos: { seleccion: "mayor" } },
    ]);
    // Sin categoría nueva, las de esa fecha en adelante quedan sin Selección.
    expect(seleccionesAlCambiar(evaluaciones, { anterior: "sub20", nueva: "", desde: "2026-06-01" })).toEqual([
      { id: "e2", datos: { seleccion: "sub20", lumbar: 210 } },
      { id: "e3", datos: {} },
    ]);
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
