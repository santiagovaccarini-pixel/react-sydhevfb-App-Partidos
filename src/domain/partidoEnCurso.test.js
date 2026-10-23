import { describe, expect, test, vi } from "vitest";
import {
  aplanarPartido,
  armarPartido,
  celularesQueFaltan,
  conLoEnviado,
  diferenciasDelPartido,
  guardadoEnOtroCelular,
  juntarConLaBase,
  loQueSeVio,
  nombreDelDato,
  otrosCelulares,
  paraSumarse,
  partidoTerminado,
  pisadasParaAvisar,
} from "./partidoEnCurso.js";

// Paso 4a de «cargar sin señal y a la vez que otra persona» (Santiago, 23/10:
// «Varios cargan a la vez»). Todo inventado.
const vacio = (id) => ({ id, sale: "", entra: "", hora: "", minuto: "", extraMinuto: "", periodo: "" });
const partido = (extra = {}) => ({
  idLocal: "local-1",
  idSupabase: 7,
  idEnCurso: "en-curso-1",
  fecha: "2026-10-23",
  rival: "Rival de Prueba",
  resultado: "",
  localia: "local",
  modoTiempo: "enVivo",
  referenciaRealPT: 1761256800000,
  inicioPT: "21:00:00",
  finalPT: "",
  varsPT: [{ inicio: "21:10:00", final: "21:12:00" }, { inicio: "", final: "" }],
  varPTActivo: 1,
  prorrogaActiva: false,
  cambios: [{ ...vacio("c1"), sale: "JUGADOR UNO", entra: "JUGADOR DOS", hora: "21:30:00", periodo: "PT" }, vacio("c2"), vacio("c3")],
  cambiosRival: [vacio("r1"), { ...vacio("r2"), entra: "RIVAL OCHO" }],
  jugadoresRival: [],
  formacion: { titulares: ["JUGADOR UNO", ""], convocados: ["", ""], cancha: { esquema: "4-4-2" } },
  ...extra,
});

describe("el partido en curso, dato por dato", () => {
  test("se desarma en datos sueltos: sin lo de este celular ni lo vacío; los cambios por su id y con su lugar, los VAR por su lugar", () => {
    expect(aplanarPartido(partido())).toEqual({
      fecha: "2026-10-23",
      rival: "Rival de Prueba",
      localia: "local",
      modoTiempo: "enVivo",
      referenciaRealPT: 1761256800000,
      inicioPT: "21:00:00",
      "varsPT.0.inicio": "21:10:00",
      "varsPT.0.final": "21:12:00",
      "cambios.c1.sale": "JUGADOR UNO",
      "cambios.c1.entra": "JUGADOR DOS",
      "cambios.c1.hora": "21:30:00",
      "cambios.c1.periodo": "PT",
      "cambios.c1.lugar": 0,
      "cambiosRival.r2.entra": "RIVAL OCHO",
      "cambiosRival.r2.lugar": 1,
      "formacion.titulares": ["JUGADOR UNO", ""],
      "formacion.cancha": { esquema: "4-4-2" },
    });
  });

  test("un cambio sin id (o con un nombre que la base no acepta) no va; uno con solo el tiempo en que iba, tampoco", () => {
    const plano = aplanarPartido(partido({ cambios: [{ sale: "SIN ID" }, { ...vacio("c9"), periodo: "ST" }, { ...vacio("mal id"), sale: "X" }] }));
    expect(Object.keys(plano).filter((clave) => clave.startsWith("cambios."))).toEqual([]);
  });

  test("lo que cambió: lo nuevo, lo cambiado y lo sacado (en null), con lo que había", () => {
    const antes = aplanarPartido(partido());
    const despues = aplanarPartido(
      partido({
        inicioPT: "",
        finalPT: "21:47:00",
        cambios: [{ ...vacio("c1"), sale: "JUGADOR UNO", entra: "JUGADOR TRES", hora: "21:30:00", periodo: "PT" }, { ...vacio("c2"), sale: "JUGADOR CUATRO" }, vacio("c3")],
      }),
    );
    expect(diferenciasDelPartido(antes, despues)).toEqual({
      cambios: { inicioPT: null, finalPT: "21:47:00", "cambios.c1.entra": "JUGADOR TRES", "cambios.c2.sale": "JUGADOR CUATRO", "cambios.c2.lugar": 1 },
      antes: { inicioPT: "21:00:00", finalPT: null, "cambios.c1.entra": "JUGADOR DOS", "cambios.c2.sale": null, "cambios.c2.lugar": null },
    });
    expect(diferenciasDelPartido(antes, aplanarPartido(partido()))).toEqual({ cambios: {}, antes: {} });
    // La primera vez, todo.
    expect(diferenciasDelPartido({}, antes).cambios).toEqual(antes);
  });

  test("dos celulares que anotan un cambio a la vez suman dos (no van al mismo lugar)", () => {
    const deUno = aplanarPartido(partido({ cambios: [{ ...vacio("de-uno"), sale: "A" }] }));
    const deOtro = aplanarPartido(partido({ cambios: [{ ...vacio("de-otro"), sale: "B" }] }));
    const juntos = { ...deUno, ...deOtro };
    expect(Object.keys(juntos).filter((clave) => clave.endsWith(".sale"))).toEqual(["cambios.de-uno.sale", "cambios.de-otro.sale"]);
  });
});

describe("el partido armado otra vez con lo de la base (4b)", () => {
  const vacioDeLaApp = () => ({
    idLocal: "nuevo",
    fecha: "",
    rival: "",
    resultado: "",
    localia: "local",
    inicioPT: "",
    finalPT: "",
    finalST: "",
    varsPT: [{ inicio: "", final: "" }],
    varPTActivo: 0,
    prorrogaActiva: false,
    cambios: [vacio("v1"), vacio("v2"), vacio("v3")],
    cambiosRival: [vacio("w1"), vacio("w2"), vacio("w3")],
    jugadoresRival: [],
    formacion: { titulares: ["", ""], convocados: ["", ""], cancha: { esquema: "" } },
  });
  let numero = 0;
  const nuevoId = () => `n${(numero += 1)}`;

  test("de los datos sueltos vuelve el mismo partido, con lo de este celular como estaba", () => {
    const original = partido();
    const armado = armarPartido(aplanarPartido(original), { vacio: vacioDeLaApp(), local: { idLocal: "local-9", varPTActivo: 1, idEnCurso: "e1" }, nuevoId });
    expect(aplanarPartido(armado)).toEqual(aplanarPartido(original));
    expect(armado).toMatchObject({ idLocal: "local-9", idEnCurso: "e1", varPTActivo: 0, rival: "Rival de Prueba", finalPT: "" });
    expect(armado.cambios[0]).toEqual({ id: "c1", sale: "JUGADOR UNO", entra: "JUGADOR DOS", hora: "21:30:00", minuto: "", extraMinuto: "", periodo: "PT" });
    expect(armado.cambios).toHaveLength(3);
    expect(armado.cambiosRival[1]).toMatchObject({ id: "r2", entra: "RIVAL OCHO" });
    expect(armado.varsPT).toEqual([{ inicio: "21:10:00", final: "21:12:00" }]);
    expect(armado.formacion).toEqual({ titulares: ["JUGADOR UNO", ""], convocados: ["", ""], cancha: { esquema: "4-4-2" } });
  });

  test("dos cambios que quieren el mismo lugar: el segundo va al siguiente libre", () => {
    const armado = armarPartido(
      { "cambios.b.sale": "B", "cambios.b.lugar": 0, "cambios.a.sale": "A", "cambios.a.lugar": 0, "cambios.z.sale": "Z", "cambios.z.lugar": 7 },
      { vacio: vacioDeLaApp(), nuevoId },
    );
    expect(armado.cambios.map((cambio) => cambio.sale)).toEqual(["A", "B", "", "", "", "", "", "Z"]);
  });

  test("lo de la base con lo de acá que todavía no subió encima: gana lo de acá", () => {
    const subido = { rival: "Rival de Prueba", inicioPT: "21:00:00" };
    const ahora = { rival: "Rival de Prueba", inicioPT: "21:00:05", finalPT: "21:46:00" };
    const servidor = { rival: "Rival de Prueba", inicioPT: "21:00:00", "cambios.x.sale": "OTRO", resultado: "1-0" };
    expect(juntarConLaBase(servidor, { subido, ahora })).toEqual({ rival: "Rival de Prueba", inicioPT: "21:00:05", finalPT: "21:46:00", "cambios.x.sale": "OTRO", resultado: "1-0" });
    // Lo que se borró acá, se borra.
    expect(juntarConLaBase(servidor, { subido, ahora: { rival: "Rival de Prueba" } })).toEqual({ rival: "Rival de Prueba", "cambios.x.sale": "OTRO", resultado: "1-0" });
  });

  test("terminado, a cuáles se ofrece «Sumarme» y el nombre de cada dato", () => {
    expect(partidoTerminado({ finalST: "22:50:00" })).toBe(true);
    expect(partidoTerminado({ finalST: "22:50:00", prorrogaActiva: true })).toBe(false);
    expect(partidoTerminado({ finalPT: "21:47:00" })).toBe(false);
    const filas = [
      { id: "a", datos: { rival: "Uno" } },
      { id: "b", datos: { rival: "Dos", guardadoTerminado: true } },
      { id: "c", datos: {} },
      { id: "d", datos: { rival: "Propio" } },
    ];
    expect(paraSumarse(filas, { propio: "d" }).map((fila) => fila.id)).toEqual(["a"]);
    expect(["rival", "inicioST", "finalHidratacionPT", "varsPTE.0.inicio", "cambios.x.sale", "cambiosRival.y.hora", "formacion.titulares", "otro"].map(nombreDelDato)).toEqual([
      "Rival",
      "Inicio ST",
      "Final hidratación PT",
      "VAR PTE (inicio)",
      "Cambio (sale)",
      "Cambio del rival (hora)",
      "Formación",
      "otro",
    ]);
  });
});

// La llamada a la base, con un supabase de mentira.
const llamadas = vi.hoisted(() => ({ rpc: [], respuesta: null }));
vi.mock("../supabase.js", () => ({
  supabase: {
    rpc: async (funcion, parametros) => {
      llamadas.rpc.push([funcion, parametros]);
      return llamadas.respuesta;
    },
  },
}));
const { cambiarPartidoEnCurso, celularesDelPartido, partidosEnCursoDelClub } = await import("./partidoEnCursoDb.js");

describe("sin señal, se junta al volver (4c)", () => {
  test("lo que se vio: lo de la base, salvo lo de acá que todavía no subió, que sigue con lo que se veía antes", () => {
    const subido = { rival: "Rival de Prueba", inicioST: "22:00:00", "cambios.c1.sale": "JUGADOR UNO" };
    // Sin señal, acá se cambió el inicio del ST y se anotó el final del PT;
    // mientras tanto, en otro celular se cambió el inicio del ST y el rival.
    const ahora = { ...subido, inicioST: "22:01:00", finalPT: "21:47:00" };
    const servidor = { ...subido, rival: "Rival Nuevo", inicioST: "22:02:00" };
    expect(loQueSeVio(servidor, { subido, ahora })).toEqual({ rival: "Rival Nuevo", inicioST: "22:00:00", "cambios.c1.sale": "JUGADOR UNO" });
    // Al subir, lo pendiente va con lo que se veía: la base puede decir que se pisó.
    expect(diferenciasDelPartido(loQueSeVio(servidor, { subido, ahora }), juntarConLaBase(servidor, { subido, ahora }))).toEqual({
      cambios: { inicioST: "22:01:00", finalPT: "21:47:00" },
      antes: { inicioST: "22:00:00", finalPT: null },
    });
    // Lo que ya está igual en la base no queda pendiente.
    expect(loQueSeVio({ ...servidor, inicioST: "22:01:00", finalPT: "21:47:00" }, { subido, ahora })).toEqual({ ...servidor, inicioST: "22:01:00", finalPT: "21:47:00" });
    // Lo sacado acá que la base todavía tiene, sigue con lo que se veía.
    expect(loQueSeVio(subido, { subido, ahora: { rival: "Rival de Prueba", inicioST: "22:00:00" } })).toEqual(subido);
  });

  test("lo que se sabe después de subir: lo de antes con lo mandado (lo sacado, sin)", () => {
    expect(conLoEnviado({ rival: "A", inicioPT: "21:00:00" }, { rival: "B", inicioPT: null, finalPT: "21:47:00" })).toEqual({ rival: "B", finalPT: "21:47:00" });
    expect(conLoEnviado(null, { rival: "B" })).toEqual({ rival: "B" });
  });

  test("lo del guardado no se avisa como pisado; lo anotado después de que otro celular lo guardó terminado, sí", () => {
    expect(pisadasParaAvisar([{ clave: "guardadoPor", habia: "cel-a" }, { clave: "inicioST", habia: "22:00:00" }, null])).toEqual([{ clave: "inicioST", habia: "22:00:00" }]);
    const datos = { finalST: "22:50:00", guardadoTerminado: true, guardadoPor: "cel-a" };
    expect(guardadoEnOtroCelular(datos, { cambios: { "cambios.c9.sale": "JUGADOR UNO" }, propio: "cel-b" })).toBe(true);
    expect(guardadoEnOtroCelular(datos, { cambios: { "cambios.c9.sale": "JUGADOR UNO" }, propio: "cel-a" })).toBe(false);
    expect(guardadoEnOtroCelular(datos, { cambios: { guardadoTerminado: true, guardadoPor: "cel-b" }, propio: "cel-b" })).toBe(false);
    expect(guardadoEnOtroCelular({ finalST: "22:50:00" }, { cambios: { rival: "X" }, propio: "cel-b" })).toBe(false);
  });

  test("los otros celulares sumados y los que no se conectan hace más de un minuto", () => {
    const celulares = [
      { celular: "cel-a", email: "uno@prueba.com", sumado: true, segundos: 5 },
      { celular: "cel-b", email: "dos@prueba.com", sumado: true, segundos: 61 },
      { celular: "cel-c", email: "tres@prueba.com", sumado: false, segundos: 300 },
      { celular: "cel-d", email: "cuatro@prueba.com", sumado: true, segundos: 60 },
    ];
    expect(otrosCelulares(celulares, { propio: "cel-a" }).map((uno) => uno.celular)).toEqual(["cel-b", "cel-d"]);
    expect(celularesQueFaltan(celulares, { propio: "cel-a" }).map((uno) => uno.celular)).toEqual(["cel-b"]);
    expect(celularesQueFaltan(celulares, { propio: "cel-b" })).toEqual([]);
  });
});

describe("subir el partido en curso", () => {
  test("manda lo cambiado, con lo que había y la fila del Historial; vuelve cómo quedó y qué se pisó", async () => {
    llamadas.respuesta = { data: { id: "e1", datos: { rival: "X" }, version: 3, pisadas: [{ clave: "rival", habia: "Y" }] }, error: null };
    expect(await cambiarPartidoEnCurso("eq-1", { id: "e1", cambios: { rival: "X" }, antes: { rival: "Z" }, registroId: 7 })).toEqual({
      id: "e1",
      datos: { rival: "X" },
      version: 3,
      pisadas: [{ clave: "rival", habia: "Y" }],
      error: "",
    });
    expect(llamadas.rpc.at(-1)).toEqual(["partido_en_curso_cambiar", { p_id: "e1", p_equipo: "eq-1", p_cambios: { rival: "X" }, p_antes: { rival: "Z" }, p_registro: 7 }]);
    expect(await cambiarPartidoEnCurso(null, { cambios: { rival: "X" } })).toEqual({ error: "partido.enCurso.sinClub" });
  });

  test("sin la actualización de la base, sinFuncion; si lo borraron, noEsta; sin señal, el error con su detalle", async () => {
    llamadas.respuesta = { data: null, error: { code: "PGRST202", message: "Could not find the function public.partido_en_curso_cambiar in the schema cache" } };
    expect(await cambiarPartidoEnCurso("eq-1", { cambios: {} })).toEqual({ sinFuncion: true, error: "" });
    llamadas.respuesta = { data: [], error: null };
    expect(await cambiarPartidoEnCurso("eq-1", { cambios: {} })).toEqual({ sinFuncion: true, error: "" });
    llamadas.respuesta = { data: null, error: { code: "P0001", message: "partido_en_curso_no_esta" } };
    expect(await cambiarPartidoEnCurso("eq-1", { id: "e1", cambios: {} })).toEqual({ noEsta: true, error: "" });
    llamadas.respuesta = { data: null, error: { message: "TypeError: Failed to fetch" } };
    expect(await cambiarPartidoEnCurso("eq-1", { cambios: {} })).toEqual({ sinSenal: true, error: "partido.enCurso.noSubio", detalle: "TypeError: Failed to fetch" });
    llamadas.respuesta = { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
    expect((await cambiarPartidoEnCurso("eq-1", { cambios: {} })).error).toBe("partido.enCurso.sinPermiso");
  });
});

describe("los celulares del partido (4c)", () => {
  test("este celular sigue (o se fue) y vuelven los del partido, con los segundos desde que se supo de cada uno", async () => {
    llamadas.respuesta = { data: [{ celular: "cel-a", email: "uno@prueba.com", sumado: true, segundos: 3 }, { celular: "cel-b", email: "", sumado: false, segundos: "90" }, { email: "sin celular" }], error: null };
    expect(await celularesDelPartido("e1", "cel-a")).toEqual({
      celulares: [
        { celular: "cel-a", email: "uno@prueba.com", sumado: true, segundos: 3 },
        { celular: "cel-b", email: "", sumado: false, segundos: 90 },
      ],
      error: "",
    });
    expect(llamadas.rpc.at(-1)).toEqual(["partido_en_curso_celulares", { p_id: "e1", p_celular: "cel-a", p_sumado: true }]);
    await celularesDelPartido("e1", "cel-a", { sumado: false });
    expect(llamadas.rpc.at(-1)[1].p_sumado).toBe(false);
    expect(await celularesDelPartido(null, "cel-a")).toEqual({ celulares: [], error: "" });
  });

  test("sin la actualización de la base, sinFuncion; si lo borraron, noEsta; sin señal, sinSenal", async () => {
    llamadas.respuesta = { data: null, error: { code: "PGRST202", message: "Could not find the function public.partido_en_curso_celulares in the schema cache" } };
    expect(await celularesDelPartido("e1", "cel-a")).toEqual({ celulares: [], sinFuncion: true, error: "" });
    llamadas.respuesta = { data: null, error: { code: "P0001", message: "partido_en_curso_no_esta" } };
    expect(await celularesDelPartido("e1", "cel-a")).toEqual({ celulares: [], noEsta: true, error: "" });
    llamadas.respuesta = { data: null, error: { message: "TypeError: Failed to fetch" } };
    expect(await celularesDelPartido("e1", "cel-a")).toMatchObject({ celulares: [], sinSenal: true, error: "partido.enCurso.noSeLeyo" });
    // Leer los del club sin señal, también.
    expect(await partidosEnCursoDelClub("eq-1")).toMatchObject({ partidos: [], sinSenal: true });
  });
});
