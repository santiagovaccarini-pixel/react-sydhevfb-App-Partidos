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

// El bloque de reglas que solo valen en el teléfono.
const enElTelefono = (() => {
  const desde = estilos.indexOf("@media (max-width: 720px) {");
  return estilos.slice(desde, estilos.indexOf("\n@media", desde + 1));
})();

// Busca una regla por uno de sus selectores sin depender de en qué renglón lo
// haya cortado el formateador.
const reglaCon = (selector, dentroDe = estilos) => {
  const plano = dentroDe.replace(/\s+/g, " ");
  const desde = plano.indexOf(selector);
  if (desde === -1) return null;
  const abre = plano.indexOf("{", desde);
  return plano.slice(abre, plano.indexOf("}", abre));
};

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

describe("la barra de acciones queda a mano en el teléfono", () => {
  it("va fija justo arriba de la navegación", () => {
    const regla = reglaCon(
      ".acciones-dobles, .acciones-formacion",
      enElTelefono,
    );
    expect(regla).toContain("position: fixed");
    // La misma cuenta que ya usa la app para despejar la navegación.
    expect(regla).toContain(
      "bottom: calc(67px + env(safe-area-inset-bottom, 0px))",
    );
  });

  it("deja abajo el lugar que la barra ocupa", () => {
    // Si esto se queda corto, la barra tapa la última tarjeta de la pantalla:
    // a los 88px que despejaban la navegación hay que sumarles los 71 de la
    // barra (10 de aire + 50 de botón + 10 de aire + el borde de arriba).
    const regla = reglaCon(".app:has(.acciones-dobles)", enElTelefono);
    expect(regla).toContain("padding-bottom: 159px");
  });

  it("en la computadora la fila sigue donde estaba", () => {
    // Ahí no hay navegación abajo contra la que pegarla, y la pantalla es
    // larga: fijarla sería tapar contenido sin ganar nada.
    expect(bloque(".acciones-dobles")).not.toContain("position: fixed");
  });
});

describe("el botón de volver", () => {
  it("dibuja la flecha en vez de usar el caracter", () => {
    // Con "←" el botón se leía como un renglón de texto: en el teléfono ese
    // caracter sale demasiado fino.
    const app = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "App.js"),
      "utf8",
    );
    expect(app).not.toContain("← Volver");
    expect(bloque(".flecha-volver")).toContain("border-radius: 50%");
  });
});
