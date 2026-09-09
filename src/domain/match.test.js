import {
  calcularNoIngresaron,
  fechaLocalISO,
  formatearDuracion,
  jugadoresParaCambio,
  normalizarEntradaTiempoTransmision,
  periodoDesdeMinutoPartido,
  segundosDesdeHora,
  segundosEntre,
  sumarDuracionesEventos,
  validarRegistroBasico,
} from "./match";

describe("motor de registro de partido", () => {
  test("unifica nombres equivalentes antes de calcular no ingresados", () => {
    expect(
      calcularNoIngresaron({ convocados: ["A MINDA", "FRED"] }, [
        { entra: "Alan Minda" },
      ]),
    ).toEqual(["FRED"]);
  });

  test("usa la fecha local y no UTC", () => {
    const fecha = new Date(2026, 8, 8, 23, 30, 0);
    expect(fechaLocalISO(fecha)).toBe("2026-09-08");
  });

  test("rechaza relojes y duraciones inválidas", () => {
    expect(segundosDesdeHora("012:99")).toBeNull();
    expect(segundosDesdeHora("999:00")).toBeNull();
    expect(segundosEntre("020:00", "015:00")).toBeNull();
    expect(normalizarEntradaTiempoTransmision("121:00")).toBeNull();
  });

  test("distingue una hora HH:mm de una guía MMM:ss", () => {
    expect(segundosDesdeHora("20:00")).toBe(20 * 3600);
    expect(segundosDesdeHora("020:00")).toBe(20 * 60);
    expect(segundosEntre("20:00", "20:30")).toBe(30 * 60);
    expect(periodoDesdeMinutoPartido("20:00")).toEqual({
      periodo: "PT",
      segundosGuia: 20 * 60,
    });
  });

  test("permite un cruce real de medianoche", () => {
    expect(segundosEntre("23:50:00", "00:10:00")).toBe(1200);
    expect(formatearDuracion(1200)).toBe("20:00");
  });

  test("minuto 90 sigue siendo ST si no hay prórroga", () => {
    expect(periodoDesdeMinutoPartido("090:00")).toEqual({
      periodo: "ST",
      segundosGuia: 45 * 60,
    });
  });

  test("respeta el período explícito de la fuente", () => {
    expect(periodoDesdeMinutoPartido("047:00", { periodoApi: "PT" })).toEqual({
      periodo: "PT",
      segundosGuia: 47 * 60,
    });
  });

  test("suma varios eventos VAR", () => {
    expect(
      sumarDuracionesEventos([
        { inicio: "010:00", final: "011:00" },
        { inicio: "020:00", final: "020:30" },
      ]),
    ).toBe(90);
  });

  test("valida datos mínimos y permite guardar un período en curso", () => {
    expect(validarRegistroBasico({ fecha: "", rival: "" })).toHaveLength(2);
    expect(
      validarRegistroBasico({ fecha: "2026-02-31", rival: "Cruzeiro" }),
    ).toContain("Cargá una fecha válida.");
    expect(
      validarRegistroBasico({
        fecha: "2026-09-08",
        rival: "Cruzeiro",
        inicioPT: "000:00",
        finalPT: "",
      }),
    ).toEqual([]);
    expect(
      validarRegistroBasico({
        fecha: "2026-09-08",
        rival: "Cruzeiro",
        inicioPT: "020:00",
        finalPT: "015:00",
      }),
    ).toContain("Revisá el orden o el formato de PT.");
    expect(
      validarRegistroBasico({
        fecha: "2026-09-08",
        rival: "Cruzeiro",
        varsPT: [{ inicio: "hora inválida", final: "" }],
      }),
    ).toContain("Revisá el orden o el formato de VAR PT 1.");
  });
});

describe("a quién ofrecer en un cambio", () => {
  const formacion = {
    titulares: ["EVERSON", "ALONSO", "SCARPA", "HULK"],
    convocados: ["BERNARD", "CUELLO", "DUDU"],
  };
  const plantel = ["", "VICTOR", "ALONSO", "BERNARD", "LYANCO", "SCARPA"];

  test("para Sale ofrece primero a los que están en cancha", () => {
    const { opciones, relevantes } = jugadoresParaCambio({
      campo: "sale",
      formacion,
      cambios: [],
      plantel,
    });

    expect(opciones.slice(0, relevantes)).toEqual([
      "EVERSON",
      "ALONSO",
      "SCARPA",
      "HULK",
    ]);
    // El resto del plantel sigue disponible, sin repetir a los de arriba.
    // BERNARD está en el banco: no puede salir, pero se lo puede escribir.
    expect(opciones.slice(relevantes)).toEqual(["VICTOR", "BERNARD", "LYANCO"]);
  });

  test("para Entra ofrece primero el banco", () => {
    const { opciones, relevantes } = jugadoresParaCambio({
      campo: "entra",
      formacion,
      cambios: [],
      plantel,
    });

    expect(opciones.slice(0, relevantes)).toEqual([
      "BERNARD",
      "CUELLO",
      "DUDU",
    ]);
  });

  test("el que ya salió deja de estar en cancha y el que entró aparece", () => {
    const cambios = [{ sale: "ALONSO", entra: "BERNARD" }];

    const sale = jugadoresParaCambio({
      campo: "sale",
      formacion,
      cambios,
      plantel,
    });
    expect(sale.opciones.slice(0, sale.relevantes)).toEqual([
      "EVERSON",
      "SCARPA",
      "HULK",
      // Bernard entró: ahora puede salir.
      "BERNARD",
    ]);

    const entra = jugadoresParaCambio({
      campo: "entra",
      formacion,
      cambios,
      plantel,
    });
    // Bernard ya entró, no puede volver a entrar.
    expect(entra.opciones.slice(0, entra.relevantes)).toEqual([
      "CUELLO",
      "DUDU",
    ]);
  });

  test("nadie desaparece: el plantel entero sigue alcanzable", () => {
    const { opciones } = jugadoresParaCambio({
      campo: "entra",
      formacion,
      cambios: [{ sale: "ALONSO", entra: "BERNARD" }],
      plantel,
    });

    ["VICTOR", "ALONSO", "BERNARD", "LYANCO", "SCARPA"].forEach((jugador) =>
      expect(opciones).toContain(jugador),
    );
    // Sin vacíos ni repetidos.
    expect(opciones).not.toContain("");
    expect(new Set(opciones).size).toBe(opciones.length);
  });

  test("sin formación cargada queda el plantel, no una lista vacía", () => {
    const { opciones, relevantes } = jugadoresParaCambio({
      campo: "sale",
      formacion: null,
      cambios: null,
      plantel,
    });

    expect(relevantes).toBe(0);
    expect(opciones).toEqual(["VICTOR", "ALONSO", "BERNARD", "LYANCO", "SCARPA"]);
  });
});
