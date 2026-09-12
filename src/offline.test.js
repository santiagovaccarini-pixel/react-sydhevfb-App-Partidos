import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

  it("no se registra en desarrollo", () => {
    // Si no, serviría archivos viejos y ningún cambio se vería.
    expect(arranque).toContain("import.meta.env.PROD");
    expect(arranque).toContain('navigator.serviceWorker.register("/sw.js")');
  });
});
