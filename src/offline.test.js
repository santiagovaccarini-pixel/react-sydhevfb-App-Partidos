import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El service worker no corre en las pruebas —no hay navegador— así que lo que
// se cuida acá son las dos reglas que, si se rompen, dejan la app pegada a una
// versión vieja sin que nadie se entere.
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const sw = readFileSync(join(raiz, "public", "sw.js"), "utf8");
const arranque = readFileSync(join(raiz, "src", "index.js"), "utf8");

describe("la app guardada para usar sin señal", () => {
  it("nunca sirve version.json desde el cache", () => {
    // Es el archivo con el que la app pregunta si hay una versión nueva: si se
    // guardara, contestaría siempre lo mismo y el aviso no saldría nunca.
    expect(sw).toContain('url.pathname === "/version.json"');
  });

  it("deja que el nombre del cache lo ponga la compilación", () => {
    // Un nombre fijo no se renovaría con cada versión y los archivos viejos
    // quedarían para siempre.
    expect(sw).toContain('const CACHE = "__CACHE__"');
    expect(sw).toContain('const PRECARGA = ["__PRECARGA__"]');
  });

  it("borra los caches de versiones anteriores al activarse", () => {
    expect(sw).toContain("caches.delete");
  });

  it("nunca guarda ni sirve desde el cache lo que contesta /api/", () => {
    // Son respuestas de cada cuenta y de cada momento: servirlas guardadas
    // mostraría datos viejos (o de otra cuenta) como si fueran de ahora.
    expect(sw).toContain('url.pathname.startsWith("/api/")) return;');
  });

  it("abre la app sin señal desde la portada precargada, no desde /index.html", () => {
    // El servidor redirige /index.html a "/", y el navegador no acepta una
    // respuesta redirigida para abrir la página: la reserva tiene que ser "/".
    expect(sw).toContain('reserva: "/"');
    expect(sw).not.toContain("/index.html");
    expect(sw).toContain("respuesta.redirected");
    const precache = readFileSync(join(raiz, "scripts", "precache.js"), "utf8");
    expect(precache).not.toContain('"/index.html"');
  });

  it("no se registra en desarrollo", () => {
    // Si no, serviría archivos viejos y ningún cambio se vería.
    expect(arranque).toContain("import.meta.env.PROD");
    expect(arranque).toContain('navigator.serviceWorker.register("/sw.js")');
  });
});

// El service worker corrido aparte, con un cache y una red de mentira.
describe("el service worker al abrir la página", () => {
  const ORIGEN = "https://app.prueba";
  let guardados;
  let puestos;
  let red;

  const cargar = () => {
    const oyentes = {};
    const cache = {
      addAll: async () => {},
      put: async (clave, respuesta) => {
        puestos.push([typeof clave === "string" ? clave : clave.url, respuesta]);
      },
    };
    runInNewContext(sw, {
      self: {
        location: { origin: ORIGEN },
        addEventListener: (tipo, oyente) => {
          oyentes[tipo] = oyente;
        },
        skipWaiting: () => {},
        clients: { claim: () => {} },
      },
      caches: {
        open: async () => cache,
        keys: async () => [],
        delete: async () => true,
        match: async (clave) => guardados[typeof clave === "string" ? clave : clave.url],
      },
      fetch: (...args) => red(...args),
      setTimeout,
      clearTimeout,
      URL,
      Promise,
    });
    return oyentes;
  };

  const pedir = (oyentes, url, mode = "navigate") => {
    let respuesta = null;
    oyentes.fetch({ request: { method: "GET", url, mode }, respondWith: (promesa) => (respuesta = promesa) });
    return respuesta;
  };

  const RED = { ok: true, type: "basic", redirected: false, de: "red", clone() { return this; } };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    guardados = { [`${ORIGEN}/`]: { de: "cache" }, "/": { de: "portada" } };
    puestos = [];
  });

  afterEach(() => vi.useRealTimers());

  it("con red, abre la página nueva y la guarda", async () => {
    red = async () => RED;
    const respuesta = await pedir(cargar(), `${ORIGEN}/?actualizar=1`);
    expect(respuesta.de).toBe("red");
    expect(puestos.map(([clave]) => clave)).toEqual([`${ORIGEN}/`]);
  });

  it("con barras pero sin datos (la red no contesta), a los 3 segundos abre la guardada", async () => {
    red = () => new Promise(() => {});
    const respuesta = pedir(cargar(), `${ORIGEN}/?actualizar=1`);
    let abierta = null;
    respuesta.then((una) => (abierta = una));
    await vi.advanceTimersByTimeAsync(2900);
    expect(abierta).toBeNull();
    await vi.advanceTimersByTimeAsync(100);
    expect(abierta.de).toBe("cache");
  });

  it("si la red contesta tarde, eso no se guarda (la página ya abrió con lo guardado)", async () => {
    let contestar;
    red = () => new Promise((resolver) => (contestar = resolver));
    const respuesta = pedir(cargar(), `${ORIGEN}/`);
    await vi.advanceTimersByTimeAsync(3000);
    expect((await respuesta).de).toBe("cache");
    contestar(RED);
    await vi.advanceTimersByTimeAsync(0);
    expect(puestos).toEqual([]);
  });

  it("sin nada guardado, espera a la red aunque tarde", async () => {
    guardados = {};
    let contestar;
    red = () => new Promise((resolver) => (contestar = resolver));
    const respuesta = pedir(cargar(), `${ORIGEN}/`);
    let abierta = null;
    respuesta.then((una) => (abierta = una));
    await vi.advanceTimersByTimeAsync(10000);
    expect(abierta).toBeNull();
    contestar(RED);
    await vi.advanceTimersByTimeAsync(0);
    expect(abierta.de).toBe("red");
  });

  it("sin señal, abre la guardada o la portada precargada", async () => {
    red = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect((await pedir(cargar(), `${ORIGEN}/`)).de).toBe("cache");
    delete guardados[`${ORIGEN}/`];
    expect((await pedir(cargar(), `${ORIGEN}/`)).de).toBe("portada");
  });

  it("lo de /api/ y lo de otros dominios no pasa por el service worker", () => {
    red = async () => RED;
    const oyentes = cargar();
    expect(pedir(oyentes, `${ORIGEN}/api/openfield/session`, "cors")).toBeNull();
    expect(pedir(oyentes, "https://otro.dominio/algo", "cors")).toBeNull();
    expect(pedir(oyentes, `${ORIGEN}/version.json`, "cors")).toBeNull();
  });
});
