import {
  METODOS_SONDA,
  describirCuerpo,
  interpretarRespuesta,
  parsearMetodos,
  resumirSonda,
  rutasSonda,
} from "./openfieldProbe.js";

describe("rutasSonda", () => {
  it("solo consulta con GET y OPTIONS, nunca con métodos de escritura", () => {
    const rutas = rutasSonda({ activityId: "abc", periodId: "p1" });
    expect(rutas.length).toBeGreaterThan(0);
    rutas.forEach((ruta) => expect(METODOS_SONDA).toContain(ruta.metodo));
  });

  it("omite las rutas de período puntual cuando no hay periodId", () => {
    const rutas = rutasSonda({ activityId: "abc" });
    expect(rutas.filter((ruta) => /\/periods\/./.test(ruta.ruta))).toEqual([]);
    expect(rutas.some((ruta) => ruta.ruta === "/periods")).toBe(true);
    expect(rutas.some((ruta) => ruta.ruta === "/activities")).toBe(true);
    expect(rutas.some((ruta) => ruta.ruta === "/activities/abc/athletes")).toBe(true);
  });

  it("incluye la ruta de inyección con y sin periodId, siempre en modo lectura", () => {
    const sin = rutasSonda({ activityId: "abc" }).filter((ruta) =>
      ruta.ruta.startsWith("/injection/"),
    );
    const con = rutasSonda({ activityId: "abc", periodId: "p1" }).filter((ruta) =>
      ruta.ruta.startsWith("/injection/"),
    );
    expect(sin.map((ruta) => `${ruta.metodo} ${ruta.ruta}`)).toEqual([
      "GET /injection/activities/abc",
      "OPTIONS /injection/activities/abc",
    ]);
    expect(con.map((ruta) => ruta.ruta)).toEqual(sin.map((ruta) => ruta.ruta));
  });

  it("con periodId suma participantes del período y la ruta anidada", () => {
    const rutas = rutasSonda({ activityId: "abc", periodId: "p1" });
    const paths = rutas.map((ruta) => ruta.ruta);
    expect(paths).toContain("/periods/p1/athletes");
    expect(paths).toContain("/activities/abc/periods/p1");

    // Cada path se consulta con GET y con OPTIONS: lo único que no puede
    // repetirse es la combinación método + ruta, ni la clave.
    const combinaciones = rutas.map((ruta) => `${ruta.metodo} ${ruta.ruta}`);
    expect(new Set(combinaciones).size).toBe(rutas.length);
    expect(new Set(rutas.map((ruta) => ruta.clave)).size).toBe(rutas.length);
  });

  it("escapa los identificadores en la ruta", () => {
    const rutas = rutasSonda({ activityId: "a/b", periodId: "c d" });
    expect(rutas.find((ruta) => ruta.clave === "actividad-get").ruta).toBe("/activities/a%2Fb");
    expect(rutas.find((ruta) => ruta.clave === "periodo-get").ruta).toBe("/periods/c%20d");
  });
});

describe("parsearMetodos", () => {
  it("normaliza, deduplica y tolera vacíos", () => {
    expect(parsearMetodos("get, Post ,POST,,delete")).toEqual(["GET", "POST", "DELETE"]);
    expect(parsearMetodos("")).toEqual([]);
    expect(parsearMetodos(null)).toEqual([]);
  });
});

describe("interpretarRespuesta", () => {
  it("un 405 prueba que la ruta existe aunque no haya Allow", () => {
    const r = interpretarRespuesta({ status: 405, allow: "", corsMethods: "" });
    expect(r.clasificacion).toBe("metodo-no-permitido");
    expect(r.rutaExiste).toBe(true);
    expect(r.escrituraAnunciada).toEqual([]);
  });

  it("un 404 prueba que la ruta no existe", () => {
    const r = interpretarRespuesta({ status: 404, allow: "", corsMethods: "" });
    expect(r.clasificacion).toBe("ruta-inexistente");
    expect(r.rutaExiste).toBe(false);
  });

  it("un 403 no permite afirmar ni negar la existencia", () => {
    const r = interpretarRespuesta({ status: 403, allow: "", corsMethods: "" });
    expect(r.clasificacion).toBe("prohibido");
    expect(r.rutaExiste).toBeNull();
  });

  it("Allow anuncia escritura; CORS queda solo informativo", () => {
    const r = interpretarRespuesta({
      status: 204,
      allow: "GET, POST, OPTIONS",
      corsMethods: "GET,POST,PUT,DELETE",
    });
    expect(r.allow).toEqual(["GET", "POST", "OPTIONS"]);
    expect(r.escrituraAnunciada).toEqual(["POST"]);
    expect(r.corsMethods).toEqual(["GET", "POST", "PUT", "DELETE"]);
    expect(r.rutaExiste).toBe(true);
  });

  it("CORS por sí solo no cuenta como escritura anunciada", () => {
    const r = interpretarRespuesta({ status: 404, allow: "", corsMethods: "GET,POST,PUT" });
    expect(r.escrituraAnunciada).toEqual([]);
    expect(r.rutaExiste).toBe(false);
  });
});

describe("describirCuerpo", () => {
  it("describe un objeto con períodos sin copiar los valores", () => {
    const descripcion = describirCuerpo(
      JSON.stringify({
        id: "x",
        name: "26-05 T",
        periods: [{ id: "p1", name: "Calentamiento", start_time: 1779822758, end_time: 1779823172 }],
      }),
    );

    expect(descripcion.tipo).toBe("objeto");
    expect(descripcion.claves).toEqual(["id", "name", "periods"]);
    expect(descripcion.periodos).toBe(1);
    expect(descripcion.muestraPeriodo).toEqual({
      claves: ["id", "name", "start_time", "end_time"],
      start_time: 1779822758,
      end_time: 1779823172,
    });
    expect(JSON.stringify(descripcion)).not.toContain("Calentamiento");
  });

  it("conserva el mensaje de error de OpenField", () => {
    const descripcion = describirCuerpo(JSON.stringify({ message: "Insufficient scope" }));
    expect(descripcion.message).toBe("Insufficient scope");
  });

  it("recorta texto no JSON y distingue cuerpos vacíos", () => {
    expect(describirCuerpo("")).toEqual({ tipo: "vacio" });
    const largo = describirCuerpo("<html>".repeat(200), { maximoSnippet: 12 });
    expect(largo.tipo).toBe("texto");
    expect(largo.snippet).toHaveLength(12);
  });

  it("describe arrays por largo y claves del primer elemento", () => {
    const descripcion = describirCuerpo(JSON.stringify([{ id: 1, name: "a" }, { id: 2 }]));
    expect(descripcion).toEqual({ tipo: "array", largo: 2, clavesPrimero: ["id", "name"] });
  });
});

describe("resumirSonda", () => {
  const base = (extra) => ({
    metodo: "GET",
    ruta: "/periods",
    clasificacion: "responde",
    rutaExiste: true,
    allow: [],
    escrituraAnunciada: [],
    ...extra,
  });

  it("prioriza la escritura anunciada por Allow", () => {
    const resumen = resumirSonda([
      base({ clasificacion: "ruta-inexistente", rutaExiste: false }),
      base({ metodo: "OPTIONS", allow: ["GET", "POST"], escrituraAnunciada: ["POST"] }),
    ]);
    expect(resumen.veredicto).toBe("escritura-anunciada");
    expect(resumen.rutas).toEqual(["/periods"]);
  });

  it("detecta el token rechazado en todas las rutas", () => {
    const resumen = resumirSonda([
      base({ clasificacion: "token-rechazado", rutaExiste: null }),
      base({ clasificacion: "token-rechazado", rutaExiste: null }),
    ]);
    expect(resumen.veredicto).toBe("token-rechazado");
  });

  it("no da por descartada la escritura cuando las rutas existen sin Allow", () => {
    const resumen = resumirSonda([base(), base({ metodo: "OPTIONS" })]);
    expect(resumen.veredicto).toBe("sin-escritura-anunciada");
    expect(resumen.detalle).toMatch(/no descarta/);
  });

  it("señala el 403 como pendiente de leer el cuerpo", () => {
    const resumen = resumirSonda([
      base({ clasificacion: "prohibido", rutaExiste: null }),
      base({ clasificacion: "ruta-inexistente", rutaExiste: false }),
    ]);
    expect(resumen.veredicto).toBe("prohibido");
  });

  it("concluye rutas inexistentes solo si todas dieron 404", () => {
    const resumen = resumirSonda([
      base({ clasificacion: "ruta-inexistente", rutaExiste: false }),
      base({ clasificacion: "ruta-inexistente", rutaExiste: false }),
    ]);
    expect(resumen.veredicto).toBe("rutas-inexistentes");
  });

  it("sin resultados no inventa un veredicto", () => {
    expect(resumirSonda([]).veredicto).toBe("sin-datos");
  });
});
