import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TrainingModule from "./TrainingModule";
import { CLAVE_ENTRENAMIENTOS, CLAVE_ENTRENAMIENTO_ACTUAL, leerEntrenamientosLocales } from "./domain/entrenamiento.js";

// Flujo diario en un club del que la cuenta ya se fue: ve la foto de su último
// día y no cambia nada. Y en el club donde sigue, solo los de ese club.
const base = vi.hoisted(() => ({ lista: [], completo: null, guardados: [], borrados: [], leidos: [], equipo: null }));

vi.mock("./domain/entrenamientosDb.js", () => ({
  listarEntrenamientosDb: vi.fn(async () => base.lista),
  leerEntrenamientoDb: vi.fn(async (id, equipoId) => {
    base.leidos.push([id, equipoId]);
    return base.completo;
  }),
  guardarEntrenamientoDb: vi.fn(async (entrenamiento) => {
    base.guardados.push(entrenamiento);
    return true;
  }),
  borrarEntrenamientoDb: vi.fn(async (id) => {
    base.borrados.push(id);
    return true;
  }),
}));

vi.mock("./TrainingSettings", () => ({ default: () => <div>Ajustes de prueba</div> }));

vi.mock("./domain/equipo.js", () => ({
  leerEquipoElegido: () => base.equipo,
  esElCam: (nombre) => /mineiro/i.test(String(nombre || "")),
}));

vi.mock("./domain/plantel.js", () => ({
  cargarPlantelConCatapult: async () => ({ plantel: [] }),
}));

vi.mock("./supabase.js", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));

const tarea = (id, nombre) => ({
  id,
  nombre,
  fecha: "2026-03-10",
  inicio: "10:10:00",
  fin: "10:25:00",
  pausas: [],
  participantes: {},
  envio: null,
});

const entrenamiento = (extra = {}) => ({
  id: "11111111-2222-4333-8444-555555555555",
  equipoId: "eq-1",
  fecha: "2026-03-10",
  nombre: "",
  tareas: [],
  actividad: null,
  asignaciones: {},
  ultimoEnvio: null,
  creadoEn: "2026-03-10T12:00:00.000Z",
  actualizadoEn: "2026-03-10T12:00:00.000Z",
  guardadoEn: "2026-03-10T12:00:00.000Z",
  ...extra,
});

const guardarLocal = (lista, actualId = "") => {
  window.localStorage.setItem(CLAVE_ENTRENAMIENTOS, JSON.stringify(lista));
  if (actualId) window.localStorage.setItem(CLAVE_ENTRENAMIENTO_ACTUAL, actualId);
};

describe("Flujo diario de un club del que ya se fue", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
    window.localStorage.clear();
    base.lista = [];
    base.completo = null;
    base.guardados.length = 0;
    base.borrados.length = 0;
    base.leidos.length = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ ok: false }) })));
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  const montar = async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<TrainingModule onVolver={() => {}} email="x@y.z" onCerrarSesion={() => {}} />);
    });
    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
  };

  const filas = () => [...contenedor.querySelectorAll(".fila-entrenamiento")];

  test("ve la foto, la abre y no puede cambiar ni subir nada", async () => {
    base.equipo = { id: "eq-1", nombre: "Uno", hasta: "2026-03-31" };
    guardarLocal(
      [
        entrenamiento({ id: "local-1", nombre: "Del celular" }),
        entrenamiento({ id: "local-2", equipoId: "eq-2", nombre: "De otro club" }),
      ],
      "local-1",
    );
    base.lista = [
      { id: "foto-1", equipoId: "eq-1", fecha: "2026-03-10", nombre: "De la foto", actividadId: "", actividadNombre: "", estado: "sin-enviar", tareas: 1, actualizadoEn: "2026-03-10T12:00:00.000Z", guardadoEn: "2026-03-10T12:00:00.000Z" },
    ];
    base.completo = entrenamiento({ id: "foto-1", nombre: "De la foto", tareas: [tarea("t1", "Rondo")] });
    await montar();

    // Inicio: el aviso, solo lo de la foto y nada para empezar uno nuevo.
    expect(contenedor.querySelector(".etiqueta-hero").textContent).toBe("SOLO LECTURA");
    expect(contenedor.querySelector(".nombre-sesion").textContent).toBe("Uno");
    expect(contenedor.textContent).not.toContain("Empezá el de hoy");
    expect(contenedor.textContent).toContain("Dejaste este club el");
    expect(filas()).toHaveLength(1);
    expect(filas()[0].textContent).toContain("De la foto");
    expect(contenedor.querySelector("#fecha-entrenamiento")).toBeNull();
    expect(contenedor.textContent).not.toContain("Seguir registrando");

    // Abrirlo lo trae de la foto de ese club y lleva a Tareas.
    await act(async () => filas()[0].click());
    await act(async () => Promise.resolve());
    expect(base.leidos).toEqual([["foto-1", "eq-1"]]);
    expect(contenedor.querySelector(".aviso-solo-lectura-tablero")).not.toBeNull();
    expect(contenedor.querySelector(".boton-guardar-cabecera").disabled).toBe(true);
    const solapas = () => contenedor.querySelectorAll(".cinta-solapas button[role='tab']").length;
    expect(solapas()).toBe(1);
    expect(contenedor.querySelector(".aviso-lectura-flotante")).toBeNull();

    // Intentar sumar una tarea no cambia nada y avisa.
    await act(async () => contenedor.querySelector("[aria-label='Nueva tarea']").click());
    expect(contenedor.querySelector(".aviso-lectura-flotante").textContent).toBe("Solo lectura: dejaste este club.");
    expect(solapas()).toBe(1);

    // Al cerrar no sube nada, y lo del celular sigue como estaba.
    await act(async () => raiz.unmount());
    raiz = null;
    expect(base.guardados).toHaveLength(0);
    expect(base.borrados).toHaveLength(0);
    expect(leerEntrenamientosLocales().map((uno) => uno.id).sort()).toEqual(["local-1", "local-2"]);
    expect(window.localStorage.getItem(CLAVE_ENTRENAMIENTO_ACTUAL)).toBe("local-1");
  });

  test("en el club donde sigue no aparecen los de otro club guardados en el celular", async () => {
    base.equipo = { id: "eq-1", nombre: "Uno", hasta: null };
    guardarLocal(
      [
        entrenamiento({ id: "local-1", nombre: "Del club" }),
        entrenamiento({ id: "local-2", equipoId: "eq-2", nombre: "De otro club" }),
        entrenamiento({ id: "local-3", equipoId: null, nombre: "De antes de los clubes" }),
      ],
      "local-2",
    );
    await montar();

    const textos = filas().map((fila) => fila.textContent);
    expect(textos.some((texto) => texto.includes("Del club"))).toBe(true);
    expect(textos.some((texto) => texto.includes("De antes de los clubes"))).toBe(true);
    expect(textos.some((texto) => texto.includes("De otro club"))).toBe(false);
    // El que estaba abierto era del otro club: acá no hay uno en curso.
    expect(contenedor.textContent).toContain("SIN ENTRENAMIENTO");
    // Pero sigue en el celular, para cuando se vuelva a ese club.
    expect(leerEntrenamientosLocales().map((uno) => uno.id).sort()).toEqual(["local-1", "local-2", "local-3"]);
  });
});
