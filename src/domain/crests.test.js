import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  CLAVE_ESCUDOS,
  ESPERA_REINTENTO,
  buscarEscudo,
  claveEscudo,
  entradaVencida,
  guardarEnCacheEscudos,
  incrustarImagen,
  leerCacheEscudos,
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
