import {
  calcularNoIngresaron,
  fechaAlEntrar,
  fechaLocalISO,
  formatearDuracion,
  hayDatosRegistrados,
  hayPartidoCargado,
  jugadoresParaCambio,
  normalizarEntradaTiempoTransmision,
  periodoDesdeMinutoPartido,
  periodoEnJuego,
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

  test("al entrar, la fecha es la de hoy aunque el borrador sea viejo", () => {
    expect(fechaAlEntrar({ fecha: "2026-09-08" }, { hoy: "2026-09-15" })).toBe(
      "2026-09-15",
    );
    expect(fechaAlEntrar({ fecha: "" }, { hoy: "2026-09-15" })).toBe(
      "2026-09-15",
    );
  });

  test("un partido terminado sigue siendo del día en que se jugó", () => {
    // Terminó 23:22 y se guarda 00:10: la fecha no salta al día siguiente.
    const terminado = { fecha: "2026-09-15", inicioPT: "21:30:00", finalPT: "22:17:00", inicioST: "22:33:00", finalST: "23:22:10" };
    expect(fechaAlEntrar(terminado, { hoy: "2026-09-16" })).toBe("2026-09-15");
    // Ni a la tarde siguiente: cambiarle la fecha a un partido ya registrado
    // le hacía perder su fila y el próximo Guardar lo repetía con otra fecha.
    // Para arrancar otro está Limpiar, que sí vuelve a la fecha de hoy.
    expect(fechaAlEntrar(terminado, { hoy: "2026-09-17" })).toBe("2026-09-15");
    // Con la guía de transmisión (minutos de juego) tampoco.
    expect(
      fechaAlEntrar(
        { ...terminado, finalST: "047:10", modoTiempo: "transmision" },
        { hoy: "2026-09-16" },
      ),
    ).toBe("2026-09-15");
  });

  test("un partido que cruza la medianoche no cambia de día al reabrir la app", () => {
    // PT 23:00-23:47, ST 00:03-00:50, se vuelve a abrir a la 01:00.
    const registro = {
      fecha: "2026-10-04",
      inicioPT: "23:00:00",
      finalPT: "23:47:00",
      inicioST: "00:03:00",
      finalST: "00:50:00",
    };
    expect(fechaAlEntrar(registro, { hoy: "2026-10-05" })).toBe("2026-10-04");
  });

  test("transmisión: terminó 23:50 (guía 047:10) y se guarda a las 00:10", () => {
    const registro = {
      fecha: "2026-10-04",
      modoTiempo: "transmision",
      inicioPT: "000:00",
      finalPT: "047:30",
      inicioST: "000:00",
      finalST: "047:10",
    };
    expect(fechaAlEntrar(registro, { hoy: "2026-10-05" })).toBe("2026-10-04");
  });

  test("un partido en juego no cambia de día a mitad de registro", () => {
    // Arrancó el ST a la noche y todavía no terminó: pasada la medianoche la
    // fecha tiene que seguir siendo la del arranque.
    const enJuego = {
      fecha: "2026-09-15",
      inicioPT: "000:00",
      finalPT: "047:30",
      inicioST: "000:00",
      finalST: "",
    };
    expect(periodoEnJuego(enJuego)).toBe("ST");
    expect(fechaAlEntrar(enJuego, { hoy: "2026-09-16" })).toBe("2026-09-15");

    const terminado = { ...enJuego, finalST: "047:10" };
    expect(periodoEnJuego(terminado)).toBeNull();
    expect(fechaAlEntrar(terminado, { hoy: "2026-09-16" })).toBe("2026-09-15");
  });

  test("con un cambio, un VAR o un gol anotado tampoco cambia", () => {
    const base = { fecha: "2026-09-15", rival: "Cruzeiro" };
    const hoy = "2026-09-16";
    expect(fechaAlEntrar({ ...base, resultado: "1-0" }, { hoy })).toBe("2026-09-15");
    expect(fechaAlEntrar({ ...base, cambios: [{ sale: "ALONSO", entra: "", hora: "" }] }, { hoy })).toBe("2026-09-15");
    expect(fechaAlEntrar({ ...base, varsPT: [{ inicio: "21:10:00", final: "" }] }, { hoy })).toBe("2026-09-15");
    expect(fechaAlEntrar({ ...base, inicioHidratacionST: "22:40:00" }, { hoy })).toBe("2026-09-15");
  });

  test("el borrador de un partido que ya está en la base o en la cola no cambia de fecha", () => {
    expect(fechaAlEntrar({ fecha: "2026-09-15", rival: "Santos", idSupabase: 7 }, { hoy: "2026-09-16" })).toBe("2026-09-15");
    expect(fechaAlEntrar({ fecha: "2026-09-15", rival: "Santos" }, { hoy: "2026-09-16", tienePendiente: true })).toBe("2026-09-15");
  });

  test("el rival y la formación cargados de antemano siguen a la fecha de hoy", () => {
    const deAntemano = {
      fecha: "2026-09-15",
      rival: "Santos",
      resultado: "",
      cambios: [{ sale: "", entra: "", hora: "" }],
      varsPT: [{ inicio: "", final: "" }],
      formacion: { titulares: ["ALONSO"], convocados: ["BERNARD"] },
    };
    expect(fechaAlEntrar(deAntemano, { hoy: "2026-09-16" })).toBe("2026-09-16");
  });

  test("la fecha elegida a mano manda sobre la de hoy, también al volver a abrir", () => {
    expect(
      fechaAlEntrar(
        { fecha: "2026-09-12" },
        { hoy: "2026-09-15", elegidaAMano: true },
      ),
    ).toBe("2026-09-12");
    // Queda anotado en el borrador: sobrevive a cerrar y abrir la app.
    expect(
      fechaAlEntrar({ fecha: "2026-09-12", fechaElegidaAMano: true }, { hoy: "2026-09-15" }),
    ).toBe("2026-09-12");
  });

  test("hayPartidoCargado ve un partido aunque no tenga formación", () => {
    expect(hayPartidoCargado({ formacion: { titulares: ["", ""], convocados: [""] } })).toBe(false);
    expect(hayPartidoCargado({ rival: "Cruzeiro" })).toBe(true);
    expect(hayPartidoCargado({ inicioPT: "21:00:00" })).toBe(true);
    expect(hayPartidoCargado({ cambios: [{ sale: "ALONSO", entra: "BERNARD", hora: "21:20:00" }] })).toBe(true);
    expect(hayPartidoCargado({ formacion: { titulares: ["ALONSO"], convocados: [] } })).toBe(true);
    expect(hayDatosRegistrados({ rival: "Cruzeiro", formacion: { titulares: ["ALONSO"] } })).toBe(false);
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
