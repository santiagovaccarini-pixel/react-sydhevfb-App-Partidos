import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLAVE_BORRADOR,
  CLAVE_RESPALDO_BORRADOR,
  claveBorrador,
  escribirBorrador,
  interpretarBorrador,
  leerBorradorDelClub,
} from "./borrador.js";

const partido = (rival, extra = {}) => ({ fecha: "2026-09-08", rival, resultado: "1-0", ...extra });
const respaldos = () => JSON.parse(localStorage.getItem(CLAVE_RESPALDO_BORRADOR) || "[]");

beforeEach(() => {
  localStorage.clear();
});

describe("interpretarBorrador", () => {
  it("entiende el formato de ahora y el de la primera versión", () => {
    expect(interpretarBorrador(null).estado).toBe("vacio");
    expect(interpretarBorrador(JSON.stringify({ version: 2, registro: partido("Santos") }))).toMatchObject({
      estado: "ok",
      registro: { rival: "Santos" },
      conClub: false,
    });
    expect(interpretarBorrador(JSON.stringify({ version: 2, registro: partido("Santos"), equipoId: "eq-1" }))).toMatchObject({
      estado: "ok",
      conClub: true,
      equipoId: "eq-1",
    });
    // La primera versión guardaba el registro pelado.
    expect(interpretarBorrador(JSON.stringify(partido("Bahia")))).toMatchObject({ estado: "ok", registro: { rival: "Bahia" } });
  });

  it("no toma por viejo un borrador de otra versión", () => {
    // Antes, uno de una versión más nueva se leía como el registro pelado: el
    // envoltorio no tiene fecha ni rival y el partido aparecía vacío.
    const nuevo = interpretarBorrador(JSON.stringify({ version: 3, registro: partido("Santos"), extra: true }));
    expect(nuevo.estado).toBe("otraVersion");
    expect(nuevo.registro.rival).toBe("Santos");
    expect(interpretarBorrador(JSON.stringify({ version: 3, datos: "otra forma" }))).toMatchObject({
      estado: "otraVersion",
      registro: null,
    });
    expect(interpretarBorrador("{roto").estado).toBe("ilegible");
    expect(interpretarBorrador("[1,2]").estado).toBe("ilegible");
  });
});

describe("un borrador por club", () => {
  it("el de antes de esta versión (sin club) es del club donde se abre primero", () => {
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ version: 2, registro: partido("Cruzeiro") }));
    expect(leerBorradorDelClub("eq-1").rival).toBe("Cruzeiro");

    escribirBorrador(partido("Cruzeiro"), "eq-1");
    // Ya tiene dueño: en otro club no aparece.
    expect(leerBorradorDelClub("eq-2")).toBeNull();
    expect(leerBorradorDelClub("eq-1").rival).toBe("Cruzeiro");
  });

  it("cada club tiene el suyo y la copia común dice de qué club es", () => {
    escribirBorrador(partido("Cruzeiro"), "eq-1");
    escribirBorrador(partido("Santos"), "eq-2");

    expect(leerBorradorDelClub("eq-1").rival).toBe("Cruzeiro");
    expect(leerBorradorDelClub("eq-2").rival).toBe("Santos");
    expect(JSON.parse(localStorage.getItem(claveBorrador("eq-1"))).equipoId).toBe("eq-1");
    // La común queda con el último usado, para una versión anterior de la app.
    expect(JSON.parse(localStorage.getItem(CLAVE_BORRADOR))).toMatchObject({ equipoId: "eq-2", registro: { rival: "Santos" } });
  });

  it("sin club se usa la clave de siempre, sin club anotado", () => {
    escribirBorrador(partido("Bahia"), null);
    expect(JSON.parse(localStorage.getItem(CLAVE_BORRADOR))).toEqual({ version: 2, registro: partido("Bahia") });
    expect(leerBorradorDelClub(null).rival).toBe("Bahia");
    // Y pasa a ser del primer club que se elija.
    expect(leerBorradorDelClub("eq-3").rival).toBe("Bahia");
  });

  it("si una versión anterior escribió la común después, manda esa, y el del club queda respaldado", () => {
    escribirBorrador(partido("Cruzeiro", { resultado: "1-0" }), "eq-1");
    // Se volvió a la versión anterior un rato: escribió la común sin club.
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ version: 2, registro: partido("Cruzeiro", { resultado: "2-0" }) }));

    expect(leerBorradorDelClub("eq-1").resultado).toBe("2-0");
    expect(respaldos()).toHaveLength(1);
    expect(JSON.parse(respaldos()[0].texto).registro.resultado).toBe("1-0");
  });
});

describe("con el celular casi lleno", () => {
  // Hay lugar para reescribir una clave que ya existe, pero no para crear otra.
  const sinLugarParaClavesNuevas = () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (clave, valor) {
      if (this.getItem(clave) === null) throw new DOMException("lleno", "QuotaExceededError");
      return original.call(this, clave, valor);
    });
  };

  afterEach(() => vi.restoreAllMocks());

  it("la copia común no se pisa si es la única copia del borrador de otro club", () => {
    // El partido del club 1 quedó solo en la común: su clave propia no entró.
    const delClub1 = JSON.stringify({ version: 2, registro: partido("Cruzeiro", { inicioST: "22:03:00" }), equipoId: "eq-1" });
    localStorage.setItem(CLAVE_BORRADOR, delClub1);
    sinLugarParaClavesNuevas();

    // Se abre el club 2 y su borrador vacío tampoco entra: lo dice, y no
    // borra el partido del club 1.
    expect(escribirBorrador(partido(""), "eq-2")).toBe(false);
    expect(localStorage.getItem(CLAVE_BORRADOR)).toBe(delClub1);
    expect(leerBorradorDelClub("eq-1").inicioST).toBe("22:03:00");
  });
});

describe("un borrador que no se puede leer no se pierde", () => {
  it("se respalda antes de que se escriba otro encima", () => {
    const deOtraVersion = JSON.stringify({ version: 3, registro: partido("Santos"), equipoId: "eq-1" });
    localStorage.setItem(claveBorrador("eq-1"), deOtraVersion);

    // Se lee lo que se puede…
    expect(leerBorradorDelClub("eq-1").rival).toBe("Santos");
    // …y queda una copia tal cual estaba, aunque después se escriba encima.
    escribirBorrador(partido("Santos"), "eq-1");
    expect(respaldos().map((item) => item.texto)).toContain(deOtraVersion);

    // Leerlo otra vez no llena los respaldos de copias iguales.
    localStorage.setItem(claveBorrador("eq-1"), deOtraVersion);
    leerBorradorDelClub("eq-1");
    expect(respaldos().filter((item) => item.texto === deOtraVersion)).toHaveLength(1);
  });

  it("uno roto también queda respaldado", () => {
    localStorage.setItem(CLAVE_BORRADOR, "{roto");
    expect(leerBorradorDelClub(null)).toBeNull();
    expect(respaldos()[0]).toMatchObject({ texto: "{roto", motivo: "ilegible" });
  });
});
