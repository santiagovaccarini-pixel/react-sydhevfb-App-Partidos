import { beforeEach, describe, expect, test } from "vitest";
import { fijarIdiomaParaPruebas, t } from "../idioma/index.js";
import { hojasDeLaExportacion, jsonDeLaExportacion, nombreDeArchivo } from "./exportarAtleta.js";
import { etiquetaDeCampo } from "./lesionesCampos.js";

// Todo inventado.
const DATOS = {
  generado_en: "2026-10-19T12:00:00Z",
  club: "Club de Prueba",
  jugador: { id: 1, nombre: "Ana Prueba", actual: true, categoria: "sub20", fecha_nacimiento: "2005-03-04", horas_previas: 12.5, puestos: ["LAT"], creado_en: "2026-01-01T12:00:00Z" },
  nombres_anteriores: [{ nombre: "Ana Vieja", hasta: "2026-05-01T12:00:00Z" }],
  lesiones: [
    {
      numero_caso: 1,
      fecha_lesion: "2026-07-01",
      fecha_alta: "2026-07-20",
      datos: { parte_cuerpo: "coxa", lado: "direito", categoria: "sub20" },
      creado_por: "medico@prueba.com",
      creado_en: "2026-07-01T12:00:00Z",
      actualizado_por: "medico@prueba.com",
      actualizado_en: "2026-07-20T12:00:00Z",
    },
  ],
  evaluaciones: [{ test: "zona_media", fecha: "2026-07-02", datos: { seleccion: "sub20", lumbar: 200 }, creado_por: "pf@prueba.com", creado_en: "2026-07-02T12:00:00Z" }],
  gps: [{ fecha: "2026-07-03", datos: { d: 5000, tiempo: 3600 } }],
  partidos: [{ fecha: "2026-07-05", rival: "Rival de Prueba", resultado: "2-1", localia: "visitante", convocado: true, titular: true, entro: [], salio: ["60:00"] }],
  historial: [
    { base: "lesiones", accion: "editada", cuando: "2026-07-20T12:00:00Z", quien: "medico@prueba.com", numero_caso: 1, antes: { numero_caso: 1, fecha_alta: null, datos: {} }, despues: { numero_caso: 1, fecha_alta: "2026-07-20", datos: {} } },
    { base: "evaluaciones", accion: "creada", cuando: "2026-07-02T12:00:00Z", quien: "pf@prueba.com", test: "zona_media", fecha: "2026-07-02" },
  ],
  ajustes: {
    lesiones_campos: [],
    lesiones_opciones: [{ campo: "lado", codigo: "direito", etiqueta_es: "Derecho (del club)", etiqueta_pt: "Direito", oculto: false, orden: 0 }],
    evaluaciones_campos: [],
    evaluaciones_opciones: [],
    gps_campos: [],
    gps_opciones: [],
  },
};

const hojas = () => hojasDeLaExportacion(DATOS, { idioma: "es-AR", t });
const hoja = (nombre) => hojas().find((una) => una.nombre === nombre);
const columna = (unaHoja, titulo) => unaHoja.filas.slice(1).map((fila) => fila[unaHoja.filas[0].indexOf(titulo)]);

describe("exportar los datos de un atleta", () => {
  beforeEach(() => fijarIdiomaParaPruebas("es-AR"));

  test("una hoja por base con datos, en el orden de la app", () => {
    expect(hojas().map((una) => una.nombre)).toEqual(["Datos básicos", "Lesiones", 'Evaluación Zona Media "CORE"', "GPS", "Partidos", "Historial de cambios"]);
  });

  test("Datos básicos: su ficha, con sus nombres de antes", () => {
    const filas = hoja("Datos básicos").filas;
    expect(filas[0]).toEqual(["Dato", "Valor"]);
    expect(filas).toContainEqual([etiquetaDeCampo("jugador", null, "es-AR"), "Ana Prueba"]);
    expect(filas).toContainEqual(["Horas previas", 12.5]);
    expect(filas).toContainEqual(["Puestos (Partido)", "Lateral"]);
    expect(filas).toContainEqual(["Nombres anteriores", "Ana Vieja (hasta el 01/05/2026)"]);
  });

  test("Lesiones: los nombres de columnas y listas del club, y quién la cargó", () => {
    const lesiones = hoja("Lesiones");
    expect(columna(lesiones, etiquetaDeCampo("lado", null, "es-AR"))).toEqual(["Derecho (del club)"]);
    expect(columna(lesiones, etiquetaDeCampo("fecha_alta", null, "es-AR"))).toEqual(["20/07/2026"]);
    expect(columna(lesiones, "Cargado por")).toEqual(["medico@prueba.com"]);
  });

  test("Evaluaciones: lo cargado de cada test, con los tiempos como en la app", () => {
    const evaluaciones = hoja('Evaluación Zona Media "CORE"');
    expect(evaluaciones.filas[0].slice(0, 3)).toEqual(["Fecha", "Seleccion", "Lumbar"]);
    expect(evaluaciones.filas[1].slice(0, 3)).toEqual(["02/07/2026", "Sub-20", "3:20"]);
  });

  test("GPS: solo las columnas con algo, los números como números", () => {
    const gps = hoja("GPS");
    expect(columna(gps, "Fecha")).toEqual(["03/07/2026"]);
    expect(columna(gps, "Tiempo")).toEqual(["1:00:00"]);
    expect(gps.filas[1]).toContain(5000);
  });

  test("Partidos: solo lo suyo en cada uno", () => {
    expect(hoja("Partidos").filas).toEqual([
      ["Fecha", "Rival", "Resultado", "Localía", "Convocado", "Titular", "Entró", "Salió"],
      ["05/07/2026", "Rival de Prueba", "2-1", "Visitante", "Sí", "Sí", "", "60:00"],
    ]);
  });

  test("Historial: cuándo, qué, quién y qué cambió en cada lesión", () => {
    const filas = hoja("Historial de cambios").filas;
    expect(filas[0]).toEqual(["Cuándo", "Base", "Qué", "Registro", "Quién", "Qué cambió"]);
    expect(filas[1].slice(1)).toEqual(["Lesiones", "Cambio", "Caso 1", "medico@prueba.com", etiquetaDeCampo("fecha_alta", null, "es-AR")]);
    expect(filas[2].slice(1)).toEqual(["Evaluaciones", "Alta", 'Evaluación Zona Media "CORE" · 02/07/2026', "pf@prueba.com", ""]);
  });

  test("el JSON lleva lo guardado tal cual, sin los ajustes del club", () => {
    const json = JSON.parse(jsonDeLaExportacion(DATOS));
    expect(Object.keys(json)).toEqual(["generado_en", "club", "atleta", "lesiones", "evaluaciones", "gps", "partidos", "historial"]);
    expect(json.atleta.nombres_anteriores).toEqual(DATOS.nombres_anteriores);
    expect(json.lesiones[0].datos.lado).toBe("direito");
  });

  test("los archivos se llaman con el nombre del atleta, sin tildes ni espacios", () => {
    expect(nombreDeArchivo("datos-de", "  Ana Pérez Ñuñez ", "2026-10-19")).toBe("datos-de-ana-perez-nunez-2026-10-19");
    expect(nombreDeArchivo("datos-de", "", "2026-10-19")).toBe("datos-de-atleta-2026-10-19");
  });

  test("en portugués, con los textos del app", () => {
    fijarIdiomaParaPruebas("pt-BR");
    const enPortugues = hojasDeLaExportacion(DATOS, { idioma: "pt-BR", t });
    expect(enPortugues.map((una) => una.nombre)).toEqual(["Dados básicos", "Lesões", 'Avaliação Zona Média "CORE"', "GPS", "Jogos", "Histórico de alterações"]);
  });
});
