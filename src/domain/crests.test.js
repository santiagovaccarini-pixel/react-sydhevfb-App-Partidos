import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  CLAVE_ESCUDOS,
  ESPERA_REINTENTO,
  buscarEscudo,
  claveEscudo,
  entradaVencida,
  escudoGuardado,
  guardarEnCacheEscudos,
  incrustarImagen,
  leerCacheEscudos,
  obtenerEscudo,
} from "./crests";

const respuesta = (cuerpo, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => cuerpo,
});

describe("clave del escudo", () => {
  test("un mismo club escrito de distintas formas cae en la misma clave", () => {
    const esperada = claveEscudo("Cruzeiro");

    expect(claveEscudo("Cruzeiro EC")).toBe(esperada);
    expect(claveEscudo("cruzeiro esporte clube")).toBe(esperada);
    expect(claveEscudo("  CRUZEIRO  ")).toBe(esperada);
  });

  test("no confunde clubes distintos", () => {
    expect(claveEscudo("Flamengo")).not.toBe(claveEscudo("Fluminense"));
    expect(claveEscudo("São Paulo")).not.toBe(claveEscudo("Santos"));
  });

  test("aguanta acentos y nombres vacíos", () => {
    expect(claveEscudo("Grêmio")).toBe(claveEscudo("Gremio"));
    expect(claveEscudo("")).toBe("");
    expect(claveEscudo(null)).toBe("");
  });

  test("no se queda sin nada cuando el nombre es todo palabras genéricas", () => {
    // "Atlético" solo se vacía, pero con apellido tiene que quedar algo.
    expect(claveEscudo("Atlético Paranaense")).toBe("paranaense");
    expect(claveEscudo("Club Atlético River Plate")).toBe("river plate");
  });
});

describe("cache de escudos", () => {
  beforeEach(() => localStorage.clear());

  test("guarda y lee", () => {
    guardarEnCacheEscudos("cruzeiro", { url: "u", ts: 1 });
    expect(leerCacheEscudos().cruzeiro).toEqual({ url: "u", ts: 1 });
  });

  test("un localStorage con basura no rompe nada", () => {
    localStorage.setItem(CLAVE_ESCUDOS, "no soy json");
    expect(leerCacheEscudos()).toEqual({});
  });

  test("un fallido se reintenta recién al día siguiente", () => {
    const ahora = 1_000_000_000;
    const fallido = { url: "", ts: ahora };

    expect(entradaVencida(fallido, ahora + 60_000)).toBe(false);
    expect(entradaVencida(fallido, ahora + ESPERA_REINTENTO + 1)).toBe(true);
    // Un escudo encontrado no vence nunca.
    expect(
      entradaVencida({ url: "u", ts: 0 }, ahora + ESPERA_REINTENTO * 10),
    ).toBe(false);
  });
});

describe("búsqueda del escudo", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("usa TheSportsDB cuando responde", async () => {
    const traer = vi.fn(async () =>
      respuesta({
        teams: [{ strTeam: "Cruzeiro", strBadge: "https://escudo/cruzeiro.png" }],
      }),
    );
    vi.stubGlobal("fetch", traer);

    expect(await buscarEscudo("Cruzeiro")).toEqual({
      url: "https://escudo/cruzeiro.png",
      fuente: "thesportsdb",
      nombreOficial: "Cruzeiro",
    });
    expect(traer).toHaveBeenCalledTimes(1);
  });

  test("cae a Wikipedia si la primera fuente falla", async () => {
    const traer = vi
      .fn()
      .mockRejectedValueOnce(new Error("sin CORS"))
      .mockResolvedValueOnce(
        respuesta({
          query: {
            pages: {
              7: {
                title: "Cruzeiro Esporte Clube",
                thumbnail: { source: "https://wiki/cruzeiro.png" },
              },
            },
          },
        }),
      );
    vi.stubGlobal("fetch", traer);

    expect(await buscarEscudo("Cruzeiro")).toEqual({
      url: "https://wiki/cruzeiro.png",
      fuente: "wikipedia-es",
      nombreOficial: "Cruzeiro Esporte Clube",
    });
  });

  test("saltea resultados sin imagen en vez de darlos por buenos", async () => {
    const traer = vi
      .fn()
      // TheSportsDB conoce al equipo pero no tiene escudo.
      .mockResolvedValueOnce(respuesta({ teams: [{ strTeam: "X" }] }))
      // Wikipedia encuentra la página pero sin foto.
      .mockResolvedValueOnce(respuesta({ query: { pages: { 1: { title: "X" } } } }))
      .mockResolvedValueOnce(
        respuesta({
          query: { pages: { 2: { title: "X", original: { source: "u" } } } },
        }),
      );
    vi.stubGlobal("fetch", traer);

    expect(await buscarEscudo("X")).toEqual({
      url: "u",
      fuente: "wikipedia-pt",
      nombreOficial: "X",
    });
  });

  test("devuelve null si ninguna fuente lo conoce", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respuesta({ teams: null })),
    );

    expect(await buscarEscudo("Club Inventado")).toBeNull();
  });

  test("un 500 no rompe: se prueba la fuente siguiente", async () => {
    const traer = vi
      .fn()
      .mockResolvedValueOnce(respuesta(null, false))
      .mockResolvedValueOnce(
        respuesta({
          query: { pages: { 1: { title: "Y", thumbnail: { source: "u" } } } },
        }),
      );
    vi.stubGlobal("fetch", traer);

    expect((await buscarEscudo("Y")).url).toBe("u");
  });

  test("no busca nada con el nombre vacío", async () => {
    const traer = vi.fn();
    vi.stubGlobal("fetch", traer);

    expect(await buscarEscudo("   ")).toBeNull();
    expect(traer).not.toHaveBeenCalled();
  });

  test("propaga la cancelación en vez de seguir probando fuentes", async () => {
    const cancelacion = Object.assign(new Error("cancelado"), {
      name: "AbortError",
    });
    const traer = vi.fn().mockRejectedValue(cancelacion);
    vi.stubGlobal("fetch", traer);

    await expect(buscarEscudo("Cruzeiro")).rejects.toThrow("cancelado");
    expect(traer).toHaveBeenCalledTimes(1);
  });
});

describe("guardado de la imagen para usarla sin internet", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("descarta una imagen demasiado pesada en vez de llenar el localStorage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob([new Uint8Array(400 * 1024)]),
      })),
    );

    expect(await incrustarImagen("https://escudo/grande.png")).toBeNull();
  });

  test("un error de red deja null y no explota", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sin red");
      }),
    );

    expect(await incrustarImagen("https://escudo/x.png")).toBeNull();
  });

  test("convierte la imagen a data URI cuando entra", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(["hola"], { type: "image/png" }),
      })),
    );

    const datos = await incrustarImagen("https://escudo/x.png");
    expect(datos).toMatch(/^data:image\/png;base64,/);
  });
});

describe("resolver el escudo de muchos clubes a la vez", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  const conBadge = (equipo) => ({
    ok: true,
    status: 200,
    json: async () => ({
      teams: [{ strTeam: equipo, strBadge: `https://escudo/${equipo}.png` }],
    }),
  });

  test("lo que ya está guardado sale sin tocar la red", async () => {
    guardarEnCacheEscudos(claveEscudo("Cruzeiro"), {
      url: "https://escudo/viejo.png",
      nombreOficial: "Cruzeiro EC",
      ts: Date.now(),
    });
    const traer = vi.fn();
    vi.stubGlobal("fetch", traer);

    expect(await obtenerEscudo("Cruzeiro EC")).toEqual({
      url: "https://escudo/viejo.png",
      fuente: "",
      nombreOficial: "Cruzeiro EC",
    });
    expect(traer).not.toHaveBeenCalled();
    expect(escudoGuardado("cruzeiro esporte clube")?.url).toBe(
      "https://escudo/viejo.png",
    );
  });

  test("pedir el mismo club cuatro veces busca una sola", async () => {
    // Es el caso de la lista de registros: varias filas contra el mismo rival.
    const traer = vi.fn(async (url) =>
      String(url).includes("searchteams")
        ? conBadge("Flamengo")
        : { ok: false, status: 404 },
    );
    vi.stubGlobal("fetch", traer);

    const resultados = await Promise.all([
      obtenerEscudo("Flamengo"),
      obtenerEscudo("Flamengo"),
      obtenerEscudo("Flamengo"),
      obtenerEscudo("Flamengo"),
    ]);

    expect(resultados.every((r) => r?.url === "https://escudo/Flamengo.png")).toBe(
      true,
    );
    // Una sola búsqueda; el segundo fetch es el de bajar la imagen.
    const busquedas = traer.mock.calls.filter(([url]) =>
      String(url).includes("searchteams"),
    );
    expect(busquedas).toHaveLength(1);
  });

  test("clubes distintos se buscan de a uno, no todos juntos", async () => {
    // Abrir la lista con muchos rivales no puede disparar una ráfaga: un
    // límite de la API dejaría todos guardados como "no existe" por un día.
    let enCurso = 0;
    let pico = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (!String(url).includes("searchteams")) return { ok: false, status: 404 };

        enCurso += 1;
        pico = Math.max(pico, enCurso);
        await new Promise((r) => setTimeout(r, 5));
        enCurso -= 1;

        const equipo = decodeURIComponent(String(url).split("t=")[1]);
        return conBadge(equipo);
      }),
    );

    const clubes = ["Flamengo", "Palmeiras", "Santos", "Gremio"];
    const resultados = await Promise.all(clubes.map((c) => obtenerEscudo(c)));

    expect(pico).toBe(1);
    expect(resultados.map((r) => r.nombreOficial)).toEqual(clubes);
  });

  test("un club que no existe queda anotado y no se vuelve a pedir", async () => {
    const traer = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ teams: null, query: { pages: {} } }),
    }));
    vi.stubGlobal("fetch", traer);

    expect(await obtenerEscudo("Club Inventado")).toBeNull();
    const primerIntento = traer.mock.calls.length;

    expect(await obtenerEscudo("Club Inventado")).toBeNull();
    expect(traer.mock.calls).toHaveLength(primerIntento);
  });

  test("un nombre vacío no encola nada", async () => {
    const traer = vi.fn();
    vi.stubGlobal("fetch", traer);

    expect(await obtenerEscudo("")).toBeNull();
    expect(traer).not.toHaveBeenCalled();
  });

  test("una búsqueda que falla no traba la cola de las siguientes", async () => {
    let llamada = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (!String(url).includes("searchteams")) return { ok: false, status: 404 };
        llamada += 1;
        if (llamada === 1) throw new Error("se cayó la red");
        return conBadge("Santos");
      }),
    );

    const [primero, segundo] = await Promise.all([
      obtenerEscudo("Gremio").catch(() => "explotó"),
      obtenerEscudo("Santos"),
    ]);

    expect(primero).toBeNull();
    expect(segundo?.url).toBe("https://escudo/Santos.png");
  });
});

describe("permisos del navegador", () => {
  // El CSP de index.html decide a qué se puede conectar la app. Si alguien lo
  // cierra de nuevo, los escudos dejan de cargar sin ningún error visible, así
  // que conviene que se entere un test y no el celular en la cancha.
  const csp = readFileSync("index.html", "utf8")
    .split('content="')
    .find((parte) => parte.includes("connect-src"))
    .split('"')[0];

  const directiva = (nombre) =>
    csp
      .split(";")
      .map((parte) => parte.trim())
      .find((parte) => parte.startsWith(`${nombre} `)) || "";

  test("se puede consultar a las fuentes de escudos", () => {
    const conexiones = directiva("connect-src");

    expect(conexiones).toContain("https://www.thesportsdb.com");
    expect(conexiones).toContain("https://es.wikipedia.org");
    expect(conexiones).toContain("https://pt.wikipedia.org");
    expect(conexiones).toContain("https://upload.wikimedia.org");
  });

  test("se pueden mostrar los escudos guardados y los remotos", () => {
    const imagenes = directiva("img-src");

    expect(imagenes).toContain("data:");
    expect(imagenes).toContain("https://upload.wikimedia.org");
    expect(imagenes).toContain("thesportsdb.com");
  });

  test("sigue sin permitirse cualquier origen", () => {
    expect(directiva("connect-src")).toContain("https://*.supabase.co");
    expect(directiva("img-src")).not.toContain(" https:;");
    expect(csp).toContain("object-src 'none'");
  });
});
