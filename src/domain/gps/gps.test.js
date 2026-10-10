import { describe, expect, test } from "vitest";
import { COLUMNAS_GPS, GPS, LISTAS_GPS, POR_MINUTO, columnaGps } from "./columnas.js";
import { armarConfigGps, claveDeColumnaPropia, gpsDelClub } from "./ajustes.js";
import { COLORES_GPS, colorDeValor, estadisticasDeColumna, vistaDelGps } from "./informe.js";
import { ESTADOS, COMO_PERSONA, NO_CARGAR, leerGpsPegado, leerSegundos, nombresSinElegir, ordenDeCarga, planDelGps, promedioDeNombre } from "./importar.js";
import { datosConCambio, periodoInicial, porMinuto, textoDeCelda, textoDeSegundos } from "./valores.js";

// Datos inventados: ningún nombre ni valor del club.

describe("las columnas de BD_GPS", () => {
  test("en el orden del Excel, sin claves repetidas, con el Dispositivo al final", () => {
    const claves = COLUMNAS_GPS.map((columna) => columna.clave);
    expect(new Set(claves).size).toBe(claves.length);
    expect(claves.slice(0, 4)).toEqual(["microciclo", "jugador", "puesto", "d"]);
    expect(claves[claves.length - 1]).toBe("dispositivo");
    // D a M, sus "por minuto" (N a W), Tiempo y de Maxima Velocidad a HDOP.
    expect(COLUMNAS_GPS.filter((columna) => columna.tipo === "porMinuto")).toHaveLength(10);
    expect(COLUMNAS_GPS.filter((columna) => columna.colores).map((columna) => columna.clave)).toHaveLength(21);
    expect(COLUMNAS_GPS.filter((columna) => columna.informe)).toHaveLength(31);
  });

  test("cada por minuto sale de su medida", () => {
    expect(POR_MINUTO.d).toBe("d_min");
    expect(columnaGps("mts90_min").de).toBe("mts90");
  });

  test("las listas del Excel tienen códigos sin repetir (los días, de 0 a ±10, mañana y tarde)", () => {
    Object.values(LISTAS_GPS).forEach((opciones) => expect(new Set(opciones.map((opcion) => opcion.codigo)).size).toBe(opciones.length));
    expect(LISTAS_GPS.clasificacion_dias).toHaveLength(62);
    expect(LISTAS_GPS.clasificacion_dias.slice(0, 6).map((opcion) => opcion.etiquetas["es-AR"])).toEqual(["0_M", "0_T", "1_M", "1_T", "+1_M", "+1_T"]);
    expect(LISTAS_GPS.dispositivo).toEqual([]);
  });
});

describe("las columnas que suma el club", () => {
  test("van al final, en su orden, con su tipo", () => {
    const config = armarConfigGps(
      [
        { campo: "d", etiqueta_es: "Distancia", etiqueta_pt: "Distância", oculto: false, orden: 3, tipo: null },
        { campo: "propia_b", etiqueta_es: "B", etiqueta_pt: "", oculto: false, orden: 2, tipo: "texto" },
        { campo: "propia_a", etiqueta_es: "A", etiqueta_pt: "", oculto: true, orden: 1, tipo: "numero" },
        { campo: "propia_mala", etiqueta_es: "Mala", etiqueta_pt: "", oculto: false, orden: 0, tipo: "formula" },
      ],
      [],
    );
    expect(config.campos.gps.d.etiquetas["es-AR"]).toBe("Distancia");
    expect(config.propias.map((columna) => columna.clave)).toEqual(["propia_a", "propia_b"]);
    const columnas = gpsDelClub(config).columnas;
    expect(columnas.slice(-2).map((columna) => columna.clave)).toEqual(["propia_a", "propia_b"]);
    expect(columnas.find((columna) => columna.clave === "propia_b").titulo["pt-BR"]).toBe("B");
  });

  test("una clave nueva no repite otra", () => {
    expect(claveDeColumnaPropia("Sprints > 30")).toBe("propia_sprints_30");
    expect(claveDeColumnaPropia("Sprints", ["propia_sprints", "propia_sprints_2"])).toBe("propia_sprints_3");
  });
});

describe("cómo se ven y se recalculan los valores", () => {
  test("los tiempos y las horas en h:mm:ss, al segundo más cercano", () => {
    expect(textoDeSegundos(2937)).toBe("0:48:57");
    expect(textoDeSegundos(72004)).toBe("20:00:04");
    expect(textoDeSegundos(4719.6)).toBe("1:18:40");
    expect(textoDeSegundos(null)).toBe("");
  });

  test("los números con el formato de su columna (con coma)", () => {
    expect(textoDeCelda(columnaGps("d"), 4155.15, "es-AR")).toBe("4155,2");
    expect(textoDeCelda(columnaGps("min_campo"), 48.95, "es-AR")).toBe("49");
    expect(textoDeCelda(columnaGps("m2"), 0.1666666666666, "es-AR")).toBe("0,1666666667");
    expect(textoDeCelda(columnaGps("tiempo"), 2937, "es-AR")).toBe("0:48:57");
  });

  test("por minuto: el valor ÷ los minutos; sin tiempo, 0 si el valor es 0", () => {
    expect(porMinuto(600, 300)).toBe(120);
    expect(porMinuto(0, 0)).toBe(0);
    expect(porMinuto(50, 0)).toBe(null);
    expect(porMinuto(null, 300)).toBe(null);
  });

  test("al cambiar una medida o el tiempo se recalcula su por minuto; lo demás queda", () => {
    const datos = { d: 600, d_min: 99, d_shi: 60, d_shi_min: 7, tiempo: 300 };
    expect(datosConCambio(datos, "d", 900)).toEqual({ d: 900, d_min: 180, d_shi: 60, d_shi_min: 7, tiempo: 300 });
    expect(datosConCambio(datos, "tiempo", 600)).toEqual({ d: 600, d_min: 60, d_shi: 60, d_shi_min: 6, tiempo: 600 });
    expect(datosConCambio(datos, "d_min", 1)).toEqual({ ...datos, d_min: 1 });
    expect(datosConCambio(datos, "d", null)).toEqual({ d_shi: 60, d_shi_min: 7, tiempo: 300 });
  });

  test("al abrir se ven las últimas 4 semanas, hoy incluido", () => {
    expect(periodoInicial("2026-10-10")).toEqual({ desde: "2026-09-13", hasta: "2026-10-10" });
    expect(periodoInicial("2026-03-01")).toEqual({ desde: "2026-02-02", hasta: "2026-03-01" });
    expect(periodoInicial("2026-01-05", 1)).toEqual({ desde: "2025-12-30", hasta: "2026-01-05" });
  });
});

describe("el informe de arriba y los colores", () => {
  const fila = (id, datos, extra = {}) => ({ id, promedio: null, datos, ...extra });

  test("Excelente … Mín de una columna, como los SUBTOTAL del Excel", () => {
    const cuentas = estadisticasDeColumna([fila(1, { d: 10 }), fila(2, { d: 20 }), fila(3, { d: 30 }), fila(4, { d: "texto" }), fila(5, {})], columnaGps("d"));
    expect(cuentas.media).toBe(20);
    expect(cuentas.desvio).toBe(10);
    expect([cuentas.excelente, cuentas.muyBueno, cuentas.regular, cuentas.malo]).toEqual([40, 30, 10, 0]);
    expect([cuentas.n, cuentas.max, cuentas.min]).toEqual([3, 30, 10]);
  });

  test("el promedio de un por minuto es el de la medida ÷ el de los minutos", () => {
    const filas = [fila(1, { d: 600, tiempo: 300, d_min: 120 }), fila(2, { d: 300, tiempo: 300, d_min: 60 })];
    const cuentas = estadisticasDeColumna(filas, columnaGps("d_min"));
    expect(cuentas.media).toBe(90);
    expect(cuentas.desvio).toBeCloseTo(42.426, 3);
  });

  test("sin números, vacía; con uno solo, sin desvío ni colores", () => {
    expect(estadisticasDeColumna([fila(1, {})], columnaGps("d"))).toBe(null);
    const uno = estadisticasDeColumna([fila(1, { d: 5 })], columnaGps("d"));
    expect([uno.media, uno.desvio, uno.excelente]).toEqual([5, null, null]);
    expect(colorDeValor(5, uno)).toBe(null);
  });

  test("los cinco colores, con los bordes del Excel (justo en Excelente no se pinta)", () => {
    const cuentas = { excelente: 40, muyBueno: 30, media: 20, regular: 10 };
    expect(colorDeValor(41, cuentas)).toBe(COLORES_GPS.excelente);
    expect(colorDeValor(40, cuentas)).toBe(null);
    expect(colorDeValor(30, cuentas)).toBe(COLORES_GPS.muyBueno);
    expect(colorDeValor(20, cuentas)).toBe(COLORES_GPS.bueno);
    expect(colorDeValor(10, cuentas)).toBe(COLORES_GPS.regular);
    expect(colorDeValor(9.9, cuentas)).toBe(COLORES_GPS.malo);
  });

  test("cada fila se pinta contra las de su dispositivo; el nombre del promedio del equipo, con su color", () => {
    const columnas = [columnaGps("jugador"), columnaGps("d")];
    const filas = [
      fila("a1", { d: 10, dispositivo: "a" }),
      fila("a2", { d: 20, dispositivo: "a" }),
      fila("a3", { d: 30, dispositivo: "a" }),
      fila("b1", { d: 1000, dispositivo: "b" }),
      fila("b2", { d: 2000, dispositivo: "b" }),
      fila("p1", { d: 20, tarea_partido: "partido_oficial_torneo", dispositivo: "a" }, { promedio: "parcial" }),
      fila("p2", { d: 20, dispositivo: "a" }, { promedio: "parcial" }),
      fila("s1", { dispositivo: "a" }, { promedio: "sesion" }),
    ];
    const { grupos, estilos } = vistaDelGps(filas, columnas);
    expect(grupos.map((grupo) => [grupo.dispositivo, grupo.filas])).toEqual([
      ["a", 6],
      ["b", 2],
    ]);
    expect(grupos[0].cuentas.d.media).toBe(20);
    // 2000 sería enorme en el dispositivo a; en el b está entre el promedio y
    // un desvío más.
    expect(estilos.b2.d.background).toBe(COLORES_GPS.bueno);
    expect(estilos.a3.d.background).toBe(COLORES_GPS.muyBueno);
    expect(estilos.p1.jugador.background).toBe(COLORES_GPS.promedioPartido);
    expect(estilos.p2.jugador.background).toBe(COLORES_GPS.promedioParcial);
    expect(estilos.s1.jugador.background).toBe(COLORES_GPS.promedioSesion);
    expect(estilos.s1.d).toBeUndefined();
  });
});

describe("pegar desde Excel la hoja BD_GPS", () => {
  const cabeceras17 = ["FUTBOL", " n", "", "D", "14,4-25Km/h", "D/min", "Tiempo", "Inicio de tarea", "Fecha", "Condicion", "Tipo de Tarea o Dinamica", "Descripción: Cantidad de jugadores", "Si incluye al Average Sesión Si/NO"];
  const cabeceras18 = ["Microciclo", "Nombre", "Puesto", "D", "D_SHI", "Drel", "T", "Brake Symmetry", "Fecha", "Condicion", "Tipo de Sesión (Densidad)", "Descripción", "Va"];
  const fila = (...celdas) => celdas.join("\t");
  const plantel = [
    { id: 1, nombre: "Ariel Uno", catapult_nombre: "A UNO", actual: true },
    { id: 2, nombre: "Bruno Dos", catapult_nombre: "", actual: true },
  ];
  const pegado = [
    fila(...cabeceras17),
    fila(...cabeceras18),
    fila("40", "A UNO", "", "4155,150000000000000", "550,330000000000000", "84,880000000000000", "0,033993055555556", "0,833379629629630", "46303", "Parcial", "Din. Colectiva", "2026_10_08_ Vs Rival PT", ""),
    fila("40", "Team Average Parcial", "", "4213,6", "500", "86,1", "0:48:57", "18:27:50", "08/10/2026", "Parcial", "Din. Colectiva", "2026_10_08_ Vs Rival PT", ""),
    fila("40", "BRUNO DOS", "", "0", "0", "0", "0", "", "8/10/2026", "Total", "Rehabilitación", "2026_10_08_Kine", "no"),
    fila("40", "OTRO NOMBRE", "", "1000", "#N/D", "50", "0:20:00", "8:00:04 p. m.", "08/10/2026", "Total", "Analitica", "2026_10_08_ Readaptacion", "Si"),
    fila("40", "OTRO NOMBRE", "", "900", "10", "45", "0:20:00", "", "09/10/2026", "Total", "Una nueva", "x", "Si"),
    fila(...cabeceras18),
    fila("", "", "", "", "", "", "", "", "", "", "", "", ""),
  ].join("\n");
  const columnas = COLUMNAS_GPS;
  const hoy = "2026-10-10";

  test("encuentra la fila de títulos (la 18) y lee cada columna por su nombre", () => {
    const leido = leerGpsPegado(pegado, columnas);
    expect(leido.error).toBe("");
    expect(leido.filas).toHaveLength(5);
    expect(Object.keys(leido.columnas)).toEqual(expect.arrayContaining(["microciclo", "jugador", "d", "d_shi", "d_min", "tiempo", "inicio", "fecha", "condicion", "tipo_sesion", "descripcion", "va"]));
  });

  test("sin Nombre y Fecha no hay tabla", () => {
    expect(leerGpsPegado("hola\tchau", columnas).error).toBe("gps.importar.sinCabeceras");
  });

  test("números con 15 decimales, horas como fracción o reloj, fechas como serie o día/mes", () => {
    const { filas } = leerGpsPegado(pegado, columnas);
    const plan = planDelGps(filas, { columnas, plantel, hoy, gps: GPS });
    const [uno, promedio] = plan;
    expect(uno.fila).toMatchObject({ fecha: "2026-10-08", jugador_id: 1, persona: null, promedio: null });
    expect(uno.fila.datos.d).toBe(4155.15);
    expect(uno.fila.datos.tiempo).toBeCloseTo(2937, 3);
    expect(uno.fila.datos.inicio).toBeCloseTo(72003.999, 2);
    expect(uno.fila.datos.microciclo).toBe(40);
    expect(uno.fila.datos.condicion).toBe("parcial");
    expect(uno.fila.datos.tipo_sesion).toBe("din_colectiva");
    expect(uno.estado).toBe(ESTADOS.nueva);
    expect(promedio.fila).toMatchObject({ promedio: "parcial", jugador_id: null, persona: null, fecha: "2026-10-08" });
    expect(promedio.fila.datos.tiempo).toBe(2937);
    expect(promedio.fila.datos.inicio).toBe(66470);
    expect(promedio.estado).toBe(ESTADOS.nueva);
  });

  test("el jugador por su nombre en Catapult o en Datos básicos; si no, se elige una vez por nombre", () => {
    const { filas } = leerGpsPegado(pegado, columnas);
    let plan = planDelGps(filas, { columnas, plantel, hoy, gps: GPS });
    expect(plan[2].fila.jugador_id).toBe(2);
    expect(plan[3].estado).toBe(ESTADOS.sinJugador);
    expect(nombresSinElegir(plan)).toEqual([{ llave: "otro nombre", nombre: "OTRO NOMBRE", filas: 2, dudoso: false }]);
    plan = planDelGps(filas, { columnas, plantel, hoy, gps: GPS, elegidos: { "otro nombre": COMO_PERSONA } });
    expect(plan.slice(3).map((una) => [una.estado, una.fila.persona])).toEqual([
      [ESTADOS.nueva, "OTRO NOMBRE"],
      [ESTADOS.nueva, "OTRO NOMBRE"],
    ]);
    plan = planDelGps(filas, { columnas, plantel, hoy, gps: GPS, elegidos: { "otro nombre": "2" } });
    expect(plan[3].fila.jugador_id).toBe(2);
    plan = planDelGps(filas, { columnas, plantel, hoy, gps: GPS, elegidos: { "otro nombre": NO_CARGAR } });
    expect(plan[3].estado).toBe(ESTADOS.noVa);
  });

  test("las listas: la opción del Excel aunque cambie un acento; una que no está, como vino; un error del Excel, vacío y avisado", () => {
    const { filas } = leerGpsPegado(pegado, columnas);
    const plan = planDelGps(filas, { columnas, plantel, hoy, gps: GPS, elegidos: { "otro nombre": COMO_PERSONA } });
    expect(plan[3].fila.datos.tipo_sesion).toBe("analitica");
    expect(plan[3].fila.datos.va).toBe("si");
    expect(plan[4].fila.datos.tipo_sesion).toBe("Una nueva");
    expect(plan[3].fila.datos.d_shi).toBeUndefined();
    expect(plan[3].avisos).toEqual([{ campo: "d_shi", valor: "#N/D" }]);
    expect(plan[3].fila.datos.inicio).toBe(72004);
  });

  test("el dispositivo elegido va en todas; lo que ya está no se vuelve a cargar (sin mirar el dispositivo)", () => {
    const { filas } = leerGpsPegado(pegado, columnas);
    const primera = planDelGps(filas, { columnas, plantel, hoy, gps: GPS, dispositivo: "catapult" });
    expect(primera[0].fila.datos.dispositivo).toBe("catapult");
    const existentes = [primera[0].fila, primera[1].fila].map((una) => ({ ...una, datos: { ...una.datos, dispositivo: "otro" } }));
    const segunda = planDelGps(filas, { columnas, plantel, hoy, gps: GPS, existentes, dispositivo: "catapult" });
    expect(segunda.slice(0, 3).map((una) => una.estado)).toEqual([ESTADOS.yaEsta, ESTADOS.yaEsta, ESTADOS.nueva]);
    expect(ordenDeCarga(segunda).map((una) => una.indice)).toEqual([4]);
  });

  test("una fecha futura o sin fecha no se carga", () => {
    const texto = [fila(...cabeceras18), fila("1", "A UNO", "", "1", "", "", "", "", "11/10/2026", "", "", "", ""), fila("1", "A UNO", "", "2", "", "", "", "", "", "", "", "", "")].join("\n");
    const plan = planDelGps(leerGpsPegado(texto, columnas).filas, { columnas, plantel, hoy, gps: GPS });
    expect(plan.map((una) => [una.estado, una.problemas])).toEqual([
      [ESTADOS.conProblemas, ["gps.importar.fechaFutura"]],
      [ESTADOS.conProblemas, ["gps.importar.sinFecha"]],
    ]);
  });

  test("en Clasificación Días el signo cuenta: -4_M no es 4_M", () => {
    const texto = [fila(...cabeceras18, "Clasificación Días"), fila("1", "A UNO", "", "1", "", "", "", "", "08/10/2026", "", "", "", "", "-4_M"), fila("1", "A UNO", "", "2", "", "", "", "", "08/10/2026", "", "", "", "", "4_m"), fila("1", "A UNO", "", "3", "", "", "", "", "08/10/2026", "", "", "", "", "+4_M")].join("\n");
    const plan = planDelGps(leerGpsPegado(texto, columnas).filas, { columnas, plantel, hoy, gps: GPS });
    expect(plan.map((una) => una.fila.datos.clasificacion_dias)).toEqual(["menos4_m", "4_m", "mas4_m"]);
  });

  test("el promedio del equipo por su nombre", () => {
    expect(promedioDeNombre("Team Average Sesion")).toBe("sesion");
    expect(promedioDeNombre("  team average  sesión ")).toBe("sesion");
    expect(promedioDeNombre("Team Average")).toBe("parcial");
    expect(promedioDeNombre("Team")).toBe(null);
  });

  test("las horas y duraciones como las copia el Excel", () => {
    expect(leerSegundos("0:48:57")).toBe(2937);
    expect(leerSegundos("1:18:39")).toBe(4719);
    expect(leerSegundos("08:00:04 a. m.")).toBe(28804);
    expect(leerSegundos("12:00:00 a.m.")).toBe(0);
    expect(leerSegundos("12:30:00 PM")).toBe(45000);
    expect(leerSegundos("0,5")).toBe(43200);
    expect(leerSegundos("")).toBe(null);
    expect(leerSegundos("ayer")).toBe(undefined);
    expect(leerSegundos("0:61:00")).toBe(undefined);
  });
});
