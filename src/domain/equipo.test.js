import { beforeEach, describe, expect, it, vi } from "vitest";

// La base de mentira: la vista con la membresía y la lista pelada de clubes.
const base = vi.hoisted(() => ({ vista: null, errorVista: null, equipos: [], errorEquipos: null }));
vi.mock("../supabase.js", () => ({
  supabase: {
    from: (tabla) => {
      const consulta = {
        select: () => consulta,
        order: async () =>
          tabla === "v_mis_clubes" ? { data: base.vista, error: base.errorVista } : { data: base.equipos, error: base.errorEquipos },
      };
      return consulta;
    },
  },
}));

import { EQUIPO_POR_DEFECTO, cargarEquipos, elegirEquipoInicial, esElCam, esSoloLectura, guardarEquipoElegido, leerEquipoElegido } from "./equipo.js";

beforeEach(() => {
  base.vista = null;
  base.errorVista = null;
  base.equipos = [];
  base.errorEquipos = null;
  localStorage.clear();
});

describe("esElCam", () => {
  it("reconoce el nombre de siempre", () => {
    expect(esElCam(EQUIPO_POR_DEFECTO)).toBe(true);
  });

  it("no se pierde por acentos, mayúsculas ni espacios de más", () => {
    expect(esElCam("atletico mineiro")).toBe(true);
    expect(esElCam("  ATLÉTICO MINEIRO  ")).toBe(true);
  });

  it("dice que no para cualquier otro equipo", () => {
    ["Cruzeiro", "Estudiantes de La Plata", "", null, undefined].forEach(
      (nombre) => expect(esElCam(nombre)).toBe(false),
    );
  });
});

describe("elegirEquipoInicial", () => {
  const CAM = { id: "uno", nombre: "Atlético Mineiro" };
  const EDLP = { id: "dos", nombre: "Estudiantes de La Plata" };

  it("usa el que eligió este teléfono", () => {
    expect(elegirEquipoInicial([CAM, EDLP], { id: "dos" })).toEqual(EDLP);
  });

  it("adopta el único que hay, sin hacer elegir", () => {
    // Es el caso de siempre: un equipo y varios teléfonos.
    expect(elegirEquipoInicial([CAM], null)).toEqual(CAM);
    expect(
      elegirEquipoInicial([CAM], { id: "un-id-que-ya-no-existe" }),
    ).toEqual(CAM);
  });

  it("no elige por vos cuando hay más de uno y no hay nada guardado", () => {
    expect(elegirEquipoInicial([CAM, EDLP], null)).toBeNull();
    expect(elegirEquipoInicial([CAM, EDLP], { id: "borrado" })).toBeNull();
  });

  it("aguanta una base sin equipos", () => {
    expect(elegirEquipoInicial([], { id: "uno" })).toBeNull();
    expect(elegirEquipoInicial(null, null)).toBeNull();
  });

  it("sin señal se queda con el equipo que ya sabía", () => {
    // La lista viene vacía porque la base no contestó, no porque no haya
    // equipos: preguntar de nuevo dejaría la app muda justo en la cancha.
    expect(elegirEquipoInicial([], EDLP, { huboError: true })).toEqual(EDLP);
    expect(elegirEquipoInicial([], null, { huboError: true })).toBeNull();
  });
});

describe("cargarEquipos y la membresía", () => {
  it("lee la vista con hasta cuándo ve cada club quien entró", async () => {
    base.vista = [
      { id: "uno", nombre: "Atlético Mineiro", desde: "2026-09-01", hasta: null },
      { id: "dos", nombre: "Cruzeiro", desde: "2026-08-01", hasta: "2026-09-25" },
      { id: "tres", nombre: "América", desde: null, hasta: null },
    ];
    const { equipos, error } = await cargarEquipos();
    expect(error).toBeUndefined();
    expect(equipos).toEqual([
      { id: "uno", nombre: "Atlético Mineiro", hasta: null, miembro: true },
      { id: "dos", nombre: "Cruzeiro", hasta: "2026-09-25", miembro: true },
      { id: "tres", nombre: "América", hasta: null, miembro: false },
    ]);
    expect(esSoloLectura(equipos[0])).toBe(false);
    expect(esSoloLectura(equipos[1])).toBe(true);
  });

  it("sin la vista en la base, lee la lista pelada como siempre", async () => {
    base.errorVista = { code: "42P01", message: 'relation "public.v_mis_clubes" does not exist' };
    base.equipos = [{ id: "uno", nombre: " Atlético Mineiro " }];
    const { equipos } = await cargarEquipos();
    expect(equipos).toEqual([{ id: "uno", nombre: "Atlético Mineiro", hasta: null, miembro: true }]);
  });

  it("si nada contesta, devuelve el error", async () => {
    base.errorVista = { message: "sin señal" };
    base.errorEquipos = { message: "sin señal" };
    const { equipos, error } = await cargarEquipos();
    expect(equipos).toEqual([]);
    expect(error).toBe("sin señal");
  });

  it("el club elegido guarda hasta cuándo se ve, y lo devuelve", () => {
    guardarEquipoElegido({ id: "dos", nombre: "Cruzeiro", hasta: "2026-09-25" });
    expect(leerEquipoElegido()).toEqual({ id: "dos", nombre: "Cruzeiro", hasta: "2026-09-25" });
    guardarEquipoElegido({ id: "uno", nombre: "Atlético Mineiro" });
    expect(leerEquipoElegido()).toEqual({ id: "uno", nombre: "Atlético Mineiro", hasta: null });
    guardarEquipoElegido(null);
    expect(leerEquipoElegido()).toBeNull();
  });
});
