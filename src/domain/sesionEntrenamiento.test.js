import {
  MODO_PARCIAL,
  armarEnvio,
  cargarSesion,
  estadoEnvioTarea,
  fechaDeActividad,
  guardarActividadElegida,
  guardarSesion,
  horaAMs,
  huellaTarea,
  leerActividadElegida,
  msAHora,
  normalizarTarea,
  nuevaTarea,
  problemasDeTarea,
  resumenTarea,
  segundosATexto,
  sesionVacia,
} from "./sesionEntrenamiento.js";

const plantel = [
  { id: 1, nombre: "A MINDA", catapult_id: "a1" },
  { id: 2, nombre: "IGOR GOMES", catapult_id: "a2" },
  { id: 3, nombre: "LEMOS", catapult_id: null },
];

const tarea = (extra = {}) =>
  normalizarTarea({
    id: "t1",
    nombre: "2. POSSE",
    fecha: "2026-09-20",
    inicio: "10:10:00",
    fin: "10:25:00",
    pausas: [{ inicio: "10:16:20", fin: "10:17:10" }],
    participantes: { 1: { modo: "total" }, 2: { modo: MODO_PARCIAL, inicio: "10:15:00", fin: "10:25:00" } },
    ...extra,
  });

describe("horas locales", () => {
  it("convierte fecha + hora local a milisegundos y vuelve", () => {
    const ms = horaAMs("2026-09-20", "10:10");
    expect(ms).toBe(new Date("2026-09-20T10:10:00").getTime());
    expect(horaAMs("2026-09-20", "10:10:30")).toBe(ms + 30_000);
    expect(msAHora(ms)).toBe("10:10:00");
    expect(horaAMs("", "10:10")).toBeNull();
    expect(horaAMs("2026-09-20", "1010")).toBeNull();
  });

  it("formatea segundos como m:ss", () => {
    expect(segundosATexto(414)).toBe("6:54");
    expect(segundosATexto(0)).toBe("0:00");
  });
});

describe("resumenTarea y problemasDeTarea", () => {
  it("calcula bruta, pausas y efectiva", () => {
    const resumen = resumenTarea(tarea());
    expect(resumen.valida).toBe(true);
    expect(resumen.duracionBrutaSegundos).toBe(900);
    expect(resumen.pausas).toEqual([50]);
    expect(resumen.pausasSegundos).toBe(50);
    expect(resumen.duracionEfectivaSegundos).toBe(850);
    expect(resumen.participantes).toBe(2);
  });

  it("una tarea completa y con jugadores vinculados no tiene problemas", () => {
    expect(problemasDeTarea(tarea(), plantel)).toEqual([]);
  });

  it("señala cada cosa que falta, en criollo", () => {
    const rota = tarea({
      nombre: "",
      fin: "10:05:00",
      pausas: [{ inicio: "10:16:20", fin: "" }],
      participantes: { 3: { modo: "total" }, 9: { modo: "total" }, 2: { modo: MODO_PARCIAL, inicio: "", fin: "" } },
    });
    const problemas = problemasDeTarea(rota, plantel);
    expect(problemas).toContain("Falta el nombre.");
    expect(problemas).toContain("Falta el inicio o el fin, o el fin no es posterior al inicio.");
    expect(problemas).toContain("La pausa 1 está incompleta.");
    expect(problemas).toContain("LEMOS no está vinculado con Catapult.");
    expect(problemas).toContain("jugador 9 ya no está en la lista.");
    expect(problemas).toContain("IGOR GOMES: falta el inicio o el fin parcial.");
  });

  it("con el plantel de la sesión conocido, un jugador sin datos ahí es un problema", () => {
    expect(problemasDeTarea(tarea(), plantel, { atletasActividad: new Set(["a1"]) })).toEqual([
      "IGOR GOMES no tiene datos en esta sesión.",
    ]);
    expect(problemasDeTarea(tarea(), plantel, { atletasActividad: new Set() })).toEqual([]);
    expect(armarEnvio({ tareas: [tarea()], plantel, atletasActividad: new Set(["a1"]) }).tareas).toEqual([]);
  });

  it("sin participantes también es un problema", () => {
    expect(problemasDeTarea(tarea({ participantes: {} }), plantel)).toContain("No hay participantes.");
  });
});

describe("armarEnvio", () => {
  it("arma el formato del envío con ids de Catapult y milisegundos", () => {
    const { tareas, problemas } = armarEnvio({ tareas: [tarea()], plantel });
    expect(problemas).toEqual([]);
    expect(tareas).toHaveLength(1);
    expect(tareas[0]).toMatchObject({
      id: "t1",
      nombre: "2. POSSE",
      inicio: horaAMs("2026-09-20", "10:10:00"),
      fin: horaAMs("2026-09-20", "10:25:00"),
      pausas: [{ inicio: horaAMs("2026-09-20", "10:16:20"), fin: horaAMs("2026-09-20", "10:17:10") }],
    });
    expect(tareas[0].participantes).toEqual([
      { atletaId: "a1", modo: "total" },
      { atletaId: "a2", modo: MODO_PARCIAL, inicio: horaAMs("2026-09-20", "10:15:00"), fin: horaAMs("2026-09-20", "10:25:00") },
    ]);
  });

  it("deja afuera la tarea con problemas y los informa", () => {
    const { tareas, problemas } = armarEnvio({ tareas: [tarea(), tarea({ id: "t2", nombre: "" })], plantel });
    expect(tareas.map((t) => t.id)).toEqual(["t1"]);
    expect(problemas).toEqual([{ tareaId: "t2", nombre: "", problemas: ["Falta el nombre."] }]);
  });
});

describe("sesión guardada en el celular", () => {
  beforeEach(() => localStorage.clear());

  it("guarda y vuelve a cargar por actividad, normalizando", () => {
    const sesion = { ...sesionVacia("act-1", "26-05 T"), tareas: [nuevaTarea({ id: "t1", nombre: "Calentamiento" })], asignaciones: { "t1|1-2": "p1" } };
    expect(guardarSesion(sesion)).toBe(true);

    const cargada = cargarSesion("act-1");
    expect(cargada.activityName).toBe("26-05 T");
    expect(cargada.tareas).toHaveLength(1);
    expect(cargada.tareas[0]).toMatchObject({ id: "t1", nombre: "Calentamiento", pausas: [], participantes: {} });
    expect(cargada.asignaciones).toEqual({ "t1|1-2": "p1" });

    expect(cargarSesion("otra").tareas).toEqual([]);
  });

  it("con basura guardada arranca de cero", () => {
    localStorage.setItem("entrenamiento_sesion:act-1", "{no es json");
    expect(cargarSesion("act-1", "X")).toEqual(sesionVacia("act-1", "X"));
  });
});

describe("actividad elegida y estado de envío", () => {
  beforeEach(() => localStorage.clear());

  it("guarda la actividad elegida y la vuelve a leer limpia", () => {
    expect(leerActividadElegida()).toBeNull();
    expect(guardarActividadElegida({ id: " act-1 ", name: "26-05 T", start_time: "1779820000", end_time: 1779830000, extra: 1 })).toBe(true);
    expect(leerActividadElegida()).toEqual({ id: "act-1", name: "26-05 T", start_time: 1779820000, end_time: 1779830000 });
    guardarActividadElegida(null);
    expect(leerActividadElegida()).toBeNull();
  });

  it("la fecha de la actividad sale de su inicio, en segundos o milisegundos", () => {
    const inicio = new Date("2026-05-26T10:00:00");
    expect(fechaDeActividad({ start_time: inicio.getTime() / 1000 })).toBe("2026-05-26");
    expect(fechaDeActividad({ start_time: inicio.getTime() })).toBe("2026-05-26");
    expect(fechaDeActividad({}, new Date("2026-09-20T08:00:00"))).toBe("2026-09-20");
  });

  it("distingue tarea pendiente, enviada y modificada después del envío", () => {
    const base = tarea();
    expect(estadoEnvioTarea(base)).toBe("pendiente");

    const enviada = { ...base, envio: { ok: true, huella: huellaTarea(base) } };
    expect(estadoEnvioTarea(enviada)).toBe("enviada");
    expect(estadoEnvioTarea({ ...enviada, fin: "10:26:00" })).toBe("modificada");
    expect(estadoEnvioTarea({ ...base, envio: { ok: false, huella: huellaTarea(base) } })).toBe("pendiente");

    // El orden de los participantes no cambia la huella.
    const alReves = { ...base, participantes: Object.fromEntries(Object.entries(base.participantes).reverse()) };
    expect(huellaTarea(alReves)).toBe(huellaTarea(base));
  });
});
