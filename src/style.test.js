import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Lo que sigue no se puede probar con el DOM de las pruebas, que no tiene ni
// dedo ni scroll: se comprueba sobre la hoja de estilos, que es donde vive la
// regla.
const estilos = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "style.css"),
  "utf8",
);

const bloque = (selector) => {
  const desde = estilos.indexOf(`\n${selector} {`);
  if (desde === -1) return null;
  return estilos.slice(desde, estilos.indexOf("}", desde));
};

describe("la cancha se puede desplazar con el dedo", () => {
  it("no le saca el gesto a la cancha entera", () => {
    // Con touch-action: none acá, el dedo no podía desplazar la pantalla: la
    // cancha ocupa casi todo el alto y no se llegaba al banco.
    expect(bloque(".pista")).not.toBeNull();
    expect(bloque(".pista")).not.toContain("touch-action");
  });

  it("se lo saca solo a la ficha que se arrastra", () => {
    // La del registro es un span y no un button: ahí no hay nada que arrastrar
    // y el dedo tiene que poder desplazar desde cualquier lado.
    expect(bloque("button.puesto-cancha")).toContain("touch-action: none");
    expect(bloque(".puesto-cancha")).not.toContain("touch-action");
  });
});
