import {
  nombreVisibleAtleta,
  normalizarNombre,
  proponerVinculos,
  resumirVinculos,
  variantesAtleta,
} from "./vinculoJugadores.js";

const atleta = (id, first_name, last_name, extra = {}) => ({ id, first_name, last_name, ...extra });

describe("normalizarNombre y variantes", () => {
  it("quita acentos, puntos y espacios de más", () => {
    expect(normalizarNombre("Kauã Pascini")).toBe("KAUA PASCINI");
    expect(normalizarNombre("VITAO .")).toBe("VITAO");
    expect(normalizarNombre("  a   minda ")).toBe("A MINDA");
    expect(normalizarNombre(null)).toBe("");
  });

  it("arma las formas posibles de un atleta", () => {
    expect(variantesAtleta(atleta("1", "A MINDA", "."))).toEqual(["A MINDA"]);
    expect(variantesAtleta(atleta("2", "Igor", "Gomes", { nickname: "Gomes" }))).toEqual([
      "IGOR GOMES",
      "GOMES IGOR",
      "IGOR",
      "GOMES",
    ]);
    expect(nombreVisibleAtleta(atleta("3", "T PEREZ", ".", { jersey: "PER" }))).toBe("T PEREZ (PER)");
    expect(nombreVisibleAtleta({ nombre: "CISSE ." })).toBe("CISSE");
  });
});

describe("proponerVinculos", () => {
  const atletas = [
    atleta("a1", "A MINDA", ".", { jersey: "MIN" }),
    atleta("a2", "Igor", "Gomes"),
    atleta("a3", "Reinier", "Jesus"),
    atleta("a4", "Victor", "Hugo"),
    atleta("a5", "Kaua", "Pascini"),
  ];

  it("propone exactos por nombre completo, sin importar orden ni acentos", () => {
    const filas = proponerVinculos({
      jugadores: [
        { id: 1, nombre: "A MINDA" },
        { id: 2, nombre: "IGOR GOMES" },
        { id: 3, nombre: "Gomes Igor" },
        { id: 4, nombre: "KAUÃ PASCINI" },
      ],
      atletas,
    });
    expect(filas.map((f) => [f.propuesta?.atletaId, f.propuesta?.nivel])).toEqual([
      ["a1", "exacto"],
      ["a2", "exacto"],
      ["a2", "exacto"],
      ["a5", "exacto"],
    ]);
    expect(filas[0].propuesta.nombre).toBe("A MINDA (MIN)");
    // Dos jugadores con el mismo atleta propuesto: conflicto en los dos.
    expect(filas[1].conflicto).toBe(true);
    expect(filas[2].conflicto).toBe(true);
    expect(filas[0].conflicto).toBe(false);
  });

  it("un solo nombre que coincide con el nombre o el apellido es exacto", () => {
    const filas = proponerVinculos({ jugadores: [{ id: 1, nombre: "REINIER" }], atletas });
    expect(filas[0].propuesta).toMatchObject({ atletaId: "a3", nivel: "exacto" });
  });

  it("propone probables cuando un nombre está contenido en el otro, y nada si no hay pista", () => {
    const filas = proponerVinculos({
      jugadores: [
        { id: 1, nombre: "KAUA PASCINI SILVA" },
        { id: 2, nombre: "V HUGO" },
        { id: 3, nombre: "LEMOS" },
      ],
      atletas,
    });
    expect(filas[0].propuesta).toMatchObject({ atletaId: "a5", nivel: "probable" });
    // "V HUGO" comparte "HUGO" con "VICTOR HUGO": se propone, pero como probable.
    expect(filas[1].propuesta).toMatchObject({ atletaId: "a4", nivel: "probable" });
    expect(filas[2].propuesta).toBeNull();
  });

  it("no propone si dos atletas empatan", () => {
    const filas = proponerVinculos({
      jugadores: [{ id: 1, nombre: "GOMES" }],
      atletas: [atleta("x", "Igor", "Gomes"), atleta("y", "Pedro", "Gomes")],
    });
    expect(filas[0].propuesta).toBeNull();
    expect(filas[0].empate).toBe(true);
  });

  it("respeta el vínculo guardado y marca si el atleta ya no está en Catapult", () => {
    const filas = proponerVinculos({
      jugadores: [
        { id: 1, nombre: "A MINDA", catapult_id: "a1" },
        { id: 2, nombre: "CUELLO", catapult_id: "zz", catapult_nombre: "CUELLO (CUE)" },
      ],
      atletas,
    });
    expect(filas[0].vinculo).toEqual({ atletaId: "a1", nombre: "A MINDA (MIN)" });
    expect(filas[1].vinculo).toEqual({ atletaId: "zz", nombre: "CUELLO (CUE)", ausente: true });
  });

  it("resume el estado de la lista", () => {
    const filas = proponerVinculos({
      jugadores: [
        { id: 1, nombre: "A MINDA", catapult_id: "a1" },
        { id: 2, nombre: "IGOR GOMES" },
        { id: 3, nombre: "KAUA PASCINI SILVA" },
        { id: 4, nombre: "LEMOS" },
        { id: 5, nombre: "CUELLO", catapult_id: "zz" },
      ],
      atletas,
    });
    expect(resumirVinculos(filas)).toEqual({
      total: 5,
      vinculados: 1,
      ausentes: 1,
      exactos: 1,
      probables: 1,
      sinPropuesta: 1,
      conflictos: 0,
    });
  });
});
