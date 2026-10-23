import { describe, expect, test, vi } from "vitest";
import { aplanarPartido, diferenciasDelPartido } from "./partidoEnCurso.js";

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
const { cambiarPartidoEnCurso } = await import("./partidoEnCursoDb.js");

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
    expect(await cambiarPartidoEnCurso("eq-1", { cambios: {} })).toEqual({ error: "partido.enCurso.noSubio", detalle: "TypeError: Failed to fetch" });
    llamadas.respuesta = { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
    expect((await cambiarPartidoEnCurso("eq-1", { cambios: {} })).error).toBe("partido.enCurso.sinPermiso");
  });
});
