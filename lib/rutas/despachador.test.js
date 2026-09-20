import { afterEach, describe, expect, it, vi } from "vitest";
import handler, { nombreDeAccion } from "../../api/openfield/[accion].js";

const respuestaFalsa = () => ({
  cabeceras: {},
  codigo: 0,
  cuerpo: null,
  setHeader(clave, valor) {
    this.cabeceras[clave] = valor;
  },
  status(codigo) {
    this.codigo = codigo;
    return this;
  },
  json(cuerpo) {
    this.cuerpo = cuerpo;
    return this;
  },
  end() {
    return this;
  },
});

const pedido = (accion, extra = {}) => ({
  method: "GET",
  headers: {},
  query: { accion },
  url: `/api/openfield/${accion}`,
  ...extra,
});

describe("despachador de /api/openfield", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("saca la acción del segmento dinámico o, si no viene, del final de la URL", () => {
    expect(nombreDeAccion({ query: { accion: "cortes" }, url: "/api/openfield/cortes" })).toBe("cortes");
    expect(nombreDeAccion({ url: "/api/openfield/periods?activityId=x" })).toBe("periods");
    expect(nombreDeAccion({})).toBe("");
  });

  it("responde 404 a una ruta que no existe y no confunde nombres del prototipo con rutas", async () => {
    for (const accion of ["otra", "constructor", "__proto__", ""]) {
      const respuesta = respuestaFalsa();
      await handler(pedido(accion), respuesta);
      expect(respuesta.codigo).toBe(404);
      expect(respuesta.cuerpo).toEqual({ ok: false, error: "Ruta inexistente." });
    }
  });

  it("delega en el módulo de la ruta: sin sesión, la lectura de actividades contesta 401", async () => {
    vi.stubEnv("OPENFIELD_ALLOWED_EMAILS", "alguien@ejemplo.com");
    const respuesta = respuestaFalsa();
    await handler(pedido("activities"), respuesta);
    expect(respuesta.codigo).toBe(401);
    expect(respuesta.cabeceras["Cache-Control"]).toBe("private, no-store");
  });

  it("respeta el método que exige cada ruta", async () => {
    const respuesta = respuestaFalsa();
    await handler(pedido("cortes", { method: "GET" }), respuesta);
    expect(respuesta.codigo).toBe(405);
  });
});
