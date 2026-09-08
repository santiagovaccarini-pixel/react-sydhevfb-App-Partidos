import {
  calcularNoIngresaron,
  fechaLocalISO,
  formatearDuracion,
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
