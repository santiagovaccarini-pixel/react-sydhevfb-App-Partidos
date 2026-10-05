import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

// Una base en memoria que se comporta como la de verdad: insert agrega la
// fila con su id, update cambia la fila y la devuelve, select trae lo que hay.
// Con ella se prueban los caminos de guardado que el doble más simple de
// App.smoke.test.js no puede mostrar (qué termina quedando en la base).
const db = vi.hoisted(() => ({
  filas: [],
  siguienteId: 100,
  errorGuardado: null,
  errorHistorial: null,
  inserts: [],
  updates: [],
  equipos: [],
  renombres: 0,
  bloquearRenombre: false,
  errorCrearEquipo: null,
  retenerRival: null,
  fallarRival: null,
  soltar: null,
  lecturasHistorial: 0,
  retenerHistorialDe: null,
  soltarHistorial: null,
}));

vi.mock("./supabase.js", () => ({
  supabase: {
    rpc: async () => ({ data: [], error: null }),
    from: (tablaPedida) => {
      const tabla = tablaPedida === "v_mis_clubes" ? "equipos" : tablaPedida;
      if (tabla === "equipos") {
        const c = {
          select: () => c,
          eq: () => c,
          order: async () => ({ data: db.equipos.map((e) => ({ ...e })), error: null }),
          update: (cambios) => ({
            eq: (campo, valor) => ({
              // Como la base con RLS para quien no administra el club: no
              // cambia nada, no da error y no devuelve ninguna fila.
              select: async () => {
                db.renombres += 1;
                if (db.bloquearRenombre) return { data: [], error: null };
                const equipo = db.equipos.find((e) => e.id === valor);
                if (!equipo) return { data: [], error: null };
                equipo.nombre = cambios.nombre;
                return { data: [{ id: equipo.id }], error: null };
              },
            }),
          }),
          insert: (filas) => ({
            select: async () => {
              if (db.errorCrearEquipo) return { data: null, error: db.errorCrearEquipo };
              const equipo = { id: `eq-${db.equipos.length + 1}`, ...filas[0] };
              db.equipos.push(equipo);
              return { data: [equipo], error: null };
            },
          }),
        };
        return c;
      }
      if (tabla === "jugadores") {
        const c = { select: () => c, eq: () => c, order: async () => ({ data: [], error: null }) };
        return c;
      }
      let filtroEquipo = null;
      const c = {
        select: () => c,
        order: async () => {
          db.lecturasHistorial += 1;
          if (db.retenerHistorialDe && filtroEquipo === db.retenerHistorialDe) {
            await new Promise((resolver) => {
              db.soltarHistorial = resolver;
            });
          }
          return {
            data: db.errorHistorial
              ? null
              : db.filas
                  .filter((f) => !filtroEquipo || f.equipo_id === filtroEquipo)
                  .map((f) => ({ ...f }))
                  .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))),
            error: db.errorHistorial,
          };
        },
        insert: (filas) => ({
          select: async () => {
            if (db.retenerRival && filas[0].rival === db.retenerRival) {
              await new Promise((resolver) => {
                db.soltar = resolver;
              });
            }
            if (db.fallarRival && filas[0].rival === db.fallarRival) return { data: null, error: { message: "timeout" } };
            if (db.errorGuardado) return { data: null, error: db.errorGuardado };
            const fila = { ...filas[0], id: db.siguienteId++ };
            db.filas.push(fila);
            db.inserts.push({ ...fila });
            return { data: [{ ...fila }], error: null };
          },
        }),
        update: (cambios) => ({
          eq: (campo, valor) => ({
            select: async () => {
              if (db.errorGuardado) return { data: null, error: db.errorGuardado };
              const fila = db.filas.find((f) => String(f.id) === String(valor));
              if (!fila) return { data: [], error: null };
              Object.assign(fila, cambios);
              db.updates.push({ id: valor, ...cambios });
              return { data: [{ ...fila }], error: null };
            },
          }),
        }),
        delete: () => ({
          eq: async (campo, valor) => {
            db.filas = db.filas.filter((f) => String(f[campo]) !== String(valor));
            return { data: null, error: null };
          },
          in: async (campo, valores) => {
            db.filas = db.filas.filter((f) => !valores.map(String).includes(String(f[campo])));
            return { data: null, error: null };
          },
        }),
        eq: (campo, valor) => {
          if (campo === "equipo_id") filtroEquipo = valor;
          return c;
        },
        in: async () => ({ data: [], error: null }),
      };
      return c;
    },
  },
}));

const borradorCruzeiro = (extra = {}) => ({
  version: 2,
  registro: {
    fecha: "2026-09-08",
    rival: "Cruzeiro",
    resultado: "1-0",
    formacion: { titulares: ["ALONSO", "SCARPA"], convocados: ["BERNARD"] },
    ...extra,
  },
});

describe("Partido: guardado, cola del celular y lo que queda en la base", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 8, 21, 25, 34));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ version: "x" }) })));
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("scrollTo", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    Object.assign(db, {
      filas: [],
      siguienteId: 100,
      errorGuardado: null,
      errorHistorial: null,
      inserts: [],
      updates: [],
      equipos: [{ id: "eq-1", nombre: "Atlético Mineiro" }],
      renombres: 0,
      bloquearRenombre: false,
      errorCrearEquipo: null,
      retenerRival: null,
      fallarRival: null,
      soltar: null,
      lecturasHistorial: 0,
      retenerHistorialDe: null,
      soltarHistorial: null,
    });
    localStorage.clear();
    localStorage.setItem("registro_actual_partido", JSON.stringify(borradorCruzeiro()));
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const vaciarPromesas = async (vueltas = 40) => {
    await act(async () => {
      for (let i = 0; i < vueltas; i += 1) await Promise.resolve();
    });
  };

  const montar = async (props = {}) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App intro={false} {...props} />);
    });
    await act(async () => Promise.resolve());
    await act(async () => vi.runOnlyPendingTimers());
    await vaciarPromesas();
  };

  const boton = (texto) =>
    Array.from(contenedor.querySelectorAll("button")).find((b) => b.textContent.includes(texto));

  const guardar = async () => {
    await act(async () => {
      boton("Guardar partido").click();
      for (let i = 0; i < 20; i += 1) await Promise.resolve();
    });
    await vaciarPromesas(20);
  };

  const escribir = async (elemento, valor) => {
    const poner = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    await act(async () => {
      poner.call(elemento, valor);
      elemento.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  const escribirGolesRival = async (valor) =>
    escribir(contenedor.querySelectorAll(".resultado-marcador input")[1], valor);

  const irA = async (etiqueta) => {
    const destino = Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find((b) =>
      b.textContent.includes(etiqueta),
    );
    await act(async () => destino.click());
  };

  const borrador = () => JSON.parse(localStorage.getItem("registro_actual_partido")).registro;
  const cola = (equipo = "eq-1") => JSON.parse(localStorage.getItem(`registros_sin_sincronizar:${equipo}`) || "[]");

  // ------------------------------------------------------------------ 1 --
  test("un guardado viejo que quedó en la cola no pisa el guardado final del mismo partido", async () => {
    await montar();

    // Entretiempo: 1-0 y la base no contesta → queda en la cola del celular.
    db.errorGuardado = { message: "sin señal" };
    await guardar();
    expect(cola()).toHaveLength(1);

    // Final: 1-2 y vuelve la señal.
    await escribirGolesRival("2");
    db.errorGuardado = null;
    await guardar();

    expect(db.filas).toHaveLength(1);
    expect(db.filas[0].resultado).toBe("1-2");
    expect(cola()).toHaveLength(0);
  });

  test("tampoco lo pisa si el guardado viejo ya tenía el número de fila", async () => {
    await montar();

    // Entretiempo con señal: 1-0 queda en la base y el borrador sabe su fila.
    await guardar();
    expect(db.filas).toHaveLength(1);
    const id = db.filas[0].id;
    expect(borrador().idSupabase).toBe(id);

    // Minuto 70 sin señal: 1-1 queda en la cola, con el número de fila.
    await escribirGolesRival("1");
    db.errorGuardado = { message: "sin señal" };
    await guardar();
    expect(cola()).toHaveLength(1);

    // Final con señal: 1-2.
    await escribirGolesRival("2");
    db.errorGuardado = null;
    await guardar();

    expect(db.filas).toHaveLength(1);
    expect(db.filas[0].resultado).toBe("1-2");
    expect(cola()).toHaveLength(0);
  });

  test("cuando la cola sube sola, el borrador se entera del número de fila y el próximo guardado no pregunta", async () => {
    await montar();
    db.errorGuardado = { message: "sin señal" };
    await guardar();
    db.errorGuardado = null;

    // Vuelve la señal: el pendiente sube solo.
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await vaciarPromesas();
    await vaciarPromesas();

    expect(db.filas).toHaveLength(1);
    expect(borrador().idSupabase).toBe(db.filas[0].id);

    await escribirGolesRival("2");
    await guardar();
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(db.filas).toHaveLength(1);
    expect(db.filas[0].resultado).toBe("1-2");
  });

  // ------------------------------------------------------------------ 3 --
  test("un partido que cruza la medianoche conserva su fecha al reabrir y volver a guardarlo no lo repite", async () => {
    vi.setSystemTime(new Date(2026, 9, 5, 1, 0, 0));
    db.filas = [{ id: 100, equipo_id: "eq-1", fecha: "2026-10-04", rival: "Santos", resultado: "1-0" }];
    localStorage.setItem(
      "registro_actual_partido",
      JSON.stringify({
        version: 2,
        registro: {
          fecha: "2026-10-04",
          rival: "Santos",
          resultado: "1-0",
          idSupabase: 100,
          inicioPT: "23:00:00",
          finalPT: "23:47:00",
          inicioST: "00:03:00",
          finalST: "00:50:00",
          formacion: { titulares: ["ALONSO", "SCARPA"], convocados: ["BERNARD"] },
        },
      }),
    );
    await montar();
    expect(borrador().fecha).toBe("2026-10-04");

    await guardar();
    expect(db.filas).toHaveLength(1);
    expect(db.filas[0].fecha).toBe("2026-10-04");
  });

  test("una fecha elegida a mano no se pierde al cerrar y volver a abrir la app", async () => {
    localStorage.removeItem("registro_actual_partido");
    await montar();
    await irA("Formación");
    await escribir(contenedor.querySelector("#campo-fecha-inicio"), "2026-09-05");
    expect(borrador().fecha).toBe("2026-09-05");

    await act(async () => raiz.unmount());
    raiz = null;
    await montar();
    await irA("Formación");
    expect(contenedor.querySelector("#campo-fecha-inicio").value).toBe("2026-09-05");
    expect(borrador().fecha).toBe("2026-09-05");
  });

  // ------------------------------------------------------------------ 4 --
  const enElSegundoTiempo = (extra = {}) =>
    localStorage.setItem(
      "registro_actual_partido",
      JSON.stringify(
        borradorCruzeiro({ inicioPT: "21:00:00", finalPT: "21:47:00", inicioST: "22:03:00", ...extra }),
      ),
    );

  test("al reabrir en el segundo tiempo el tablero muestra el ST y 'Ahora' anota el cambio en el ST", async () => {
    vi.setSystemTime(new Date(2026, 8, 8, 22, 30, 0));
    enElSegundoTiempo();
    await montar();

    expect(contenedor.querySelector('.selector-periodos [role="tab"][aria-selected="true"]').textContent).toContain("ST");
    expect(contenedor.querySelector(".accion-periodo").textContent).toContain("Finalizar ST");

    await act(async () => contenedor.querySelector("#panel-cambios .boton-ahora-cambio").click());
    expect(borrador().cambios[0].periodo).toBe("ST");
  });

  test("dos toques de más sobre un período terminado no pisan su final: Reanudar pregunta antes", async () => {
    vi.setSystemTime(new Date(2026, 8, 8, 22, 40, 0));
    enElSegundoTiempo();
    await montar();

    // Se mira el PT (terminado) y se toca dos veces el botón grande.
    const pt = Array.from(contenedor.querySelectorAll('.selector-periodos [role="tab"]')).find((b) => b.textContent.includes("PT"));
    await act(async () => pt.click());
    const accion = () => contenedor.querySelector(".accion-periodo");
    expect(accion().textContent).toContain("Reanudar PT");
    await act(async () => accion().click());
    expect(contenedor.querySelector(".hoja-confirmar")).not.toBeNull();
    await act(async () => contenedor.querySelector(".hoja-confirmar .boton-cancelar-hoja").click());
    await act(async () => accion().click());
    await act(async () => contenedor.querySelector(".hoja-confirmar .boton-cancelar-hoja").click());

    expect(borrador().finalPT).toBe("21:47:00");
  });

  // ------------------------------------------------------------------ 5 --
  const dosClubes = () => {
    db.equipos = [
      { id: "eq-1", nombre: "Atlético Mineiro" },
      { id: "eq-2", nombre: "Otro Club" },
    ];
  };
  const elegirClub = (id, nombre) =>
    localStorage.setItem("equipo_elegido", JSON.stringify({ id, nombre }));
  const remontar = async () => {
    await act(async () => raiz.unmount());
    raiz = null;
    await montar();
  };
  const pestanas = () =>
    Array.from(contenedor.querySelectorAll(".navegacion-movil button")).map((b) => b.textContent.trim());

  test("el partido cargado en un club no aparece en otro, y sigue en el suyo al volver", async () => {
    dosClubes();
    elegirClub("eq-1", "Atlético Mineiro");
    // El borrador de antes de esta versión (sin club) es del club donde se abre primero.
    await montar();
    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();
    expect(JSON.parse(localStorage.getItem("registro_actual_partido:eq-1")).registro.rival).toBe("Cruzeiro");

    // En el otro club no hay partido en curso, ni tablero, ni nada que guardar.
    elegirClub("eq-2", "Otro Club");
    await remontar();
    expect(contenedor.querySelector(".tablero-partido")).toBeNull();
    expect(contenedor.querySelector(".tarjeta-en-curso")).toBeNull();
    expect(pestanas()).not.toContain("Partido");
    expect(contenedor.textContent).not.toContain("Cruzeiro");
    expect(boton("Guardar partido")).toBeUndefined();

    // Volviendo a su club, ahí está.
    elegirClub("eq-1", "Atlético Mineiro");
    await remontar();
    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();
    expect(contenedor.textContent).toContain("Cruzeiro");
    await guardar();
    expect(db.inserts.map((f) => `${f.rival}:${f.equipo_id}`)).toEqual(["Cruzeiro:eq-1"]);
  });

  test("cambiar de club en Ajustes guarda el partido de uno y trae el del otro", async () => {
    dosClubes();
    elegirClub("eq-1", "Atlético Mineiro");
    await montar();
    await escribirGolesRival("2");

    await irA("Ajustes");
    await act(async () => Array.from(contenedor.querySelectorAll(".opcion-ajuste")).find((b) => b.textContent.includes("Equipo")).click());
    await act(async () => Array.from(contenedor.querySelectorAll(".lista-equipos button")).find((b) => b.textContent.includes("Otro Club")).click());
    await vaciarPromesas();

    await irA("Formación");
    expect(contenedor.querySelector(".tarjeta-en-curso")).toBeNull();
    expect(pestanas()).not.toContain("Partido");
    expect(contenedor.textContent).not.toContain("Cruzeiro");

    await irA("Ajustes");
    await act(async () => Array.from(contenedor.querySelectorAll(".opcion-ajuste")).find((b) => b.textContent.includes("Equipo")).click());
    await act(async () => Array.from(contenedor.querySelectorAll(".lista-equipos button")).find((b) => b.textContent.includes("Atlético")).click());
    await vaciarPromesas();
    await irA("Formación");
    expect(contenedor.querySelector(".tarjeta-en-curso").textContent).toContain("Cruzeiro");
    expect(contenedor.querySelector(".tarjeta-en-curso").textContent).toContain("1-2");
  });

  // ------------------------------------------------------------------ 6 --
  // En la base: el partido del miércoles (cargado desde otro celular). En
  // este celular: el del sábado, que quedó sin subir, y la copia del miércoles.
  const sabadoPendiente = () => ({
    fecha: "2026-09-27",
    rival: "Santos",
    resultado: "1-1",
    sinSincronizar: true,
    cambios: [],
    cambiosRival: [],
    formacion: { titulares: [], convocados: [] },
  });
  const sembrarSabadoYMiercoles = () => {
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0));
    localStorage.removeItem("registro_actual_partido");
    db.filas = [{ id: 50, equipo_id: "eq-1", fecha: "2026-10-01", rival: "Bahia", resultado: "3-0" }];
    localStorage.setItem("registros_sin_sincronizar:eq-1", JSON.stringify([sabadoPendiente()]));
    localStorage.setItem(
      "backup_registros_partidos:eq-1",
      JSON.stringify({
        version: 2,
        registros: [sabadoPendiente(), { fecha: "2026-10-01", rival: "Bahia", resultado: "3-0", idSupabase: 50 }],
      }),
    );
    db.errorHistorial = { message: "sin señal" };
  };
  const vuelveLaSenal = async () => {
    db.errorHistorial = null;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await vaciarPromesas();
    await vaciarPromesas();
  };

  test("editar un pendiente mientras vuelve la señal guarda la edición en ese partido y no en otro", async () => {
    sembrarSabadoYMiercoles();
    await montar();
    await irA("Registros");
    const filas = Array.from(contenedor.querySelectorAll(".registro-guardado"));
    expect(filas[0].textContent).toContain("Santos");

    // Abre el del sábado (pendiente) y lo edita: el resultado pasa a 2-1.
    await act(async () => filas[0].querySelector(".boton-detalle").click());
    await act(async () => boton("Editar registro").click());
    await escribir(contenedor.querySelectorAll(".resultado-ficha input")[0], "2");

    // Vuelve la señal mientras edita: el sábado sube y la lista se reordena.
    await vuelveLaSenal();
    expect(db.filas.map((f) => f.rival).sort()).toEqual(["Bahia", "Santos"]);

    await act(async () => {
      boton("Guardar cambios").click();
    });
    await vaciarPromesas();

    const miercoles = db.filas.find((f) => f.id === 50);
    expect(miercoles).toMatchObject({ rival: "Bahia", resultado: "3-0", fecha: "2026-10-01" });
    const sabado = db.filas.find((f) => f.rival === "Santos");
    expect(sabado.resultado).toBe("2-1");
  });

  test("borrar un partido mientras la lista se reordena borra ese y no el que quedó en su lugar", async () => {
    sembrarSabadoYMiercoles();
    await montar();
    await irA("Registros");
    const santos = Array.from(contenedor.querySelectorAll(".registro-guardado")).find((f) => f.textContent.includes("Santos"));
    await act(async () => santos.querySelector(".boton-eliminar-registro").click());

    // Con la hoja abierta vuelve la señal: el sábado sube y cambia de lugar.
    await vuelveLaSenal();
    await act(async () => boton("Sí, eliminar").click());
    await vaciarPromesas();

    // Se va el que se eligió (que ya había subido), y el otro se queda.
    expect(db.filas.map((f) => f.rival)).toEqual(["Bahia"]);
    expect(cola()).toHaveLength(0);
  });

  // ------------------------------------------------------------------ 7 --
  test("un partido en juego sin formación cargada sigue en curso al reabrir la app", async () => {
    vi.setSystemTime(new Date(2026, 8, 8, 21, 30, 0));
    localStorage.setItem(
      "registro_actual_partido",
      JSON.stringify({
        version: 2,
        registro: {
          fecha: "2026-09-08",
          rival: "Cruzeiro",
          resultado: "1-0",
          inicioPT: "21:00:00",
          cambios: [{ sale: "ALONSO", entra: "BERNARD", hora: "21:20:00", periodo: "PT" }, {}, {}, {}, {}],
          formacion: { titulares: [], convocados: [] },
        },
      }),
    );
    await montar();

    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();
    expect(pestanas()).toContain("Partido");
    expect(boton("Guardar partido")).toBeDefined();

    await irA("Formación");
    expect(contenedor.querySelector(".tarjeta-en-curso").textContent).toContain("EN VIVO");
  });

  // ------------------------------------------------------------------ 8 --
  test("salir con un registro editado sin guardar pregunta antes de tirar los cambios", async () => {
    db.filas = [{ id: 50, equipo_id: "eq-1", fecha: "2026-09-01", rival: "Bahia", resultado: "3-0" }];
    await montar();
    await irA("Registros");
    await act(async () => contenedor.querySelector(".registro-guardado .boton-detalle").click());
    await act(async () => boton("Editar registro").click());

    // Sin cambios se sale sin preguntar nada.
    await irA("Registros");
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(boton("Guardar cambios")).toBeUndefined();

    await act(async () => contenedor.querySelector(".registro-guardado .boton-detalle").click());
    await act(async () => boton("Editar registro").click());
    await escribir(contenedor.querySelectorAll(".resultado-ficha input")[0], "4");

    // Con cambios, pregunta; "No" deja seguir editando con lo cargado.
    await irA("Formación");
    expect(contenedor.querySelector(".hoja-confirmar h3").textContent).toBe("¿Salir sin guardar los cambios?");
    await act(async () => contenedor.querySelector(".hoja-confirmar .boton-cancelar-hoja").click());
    expect(boton("Guardar cambios")).toBeDefined();
    expect(contenedor.querySelectorAll(".resultado-ficha input")[0].value).toBe("4");

    // Y confirmando, sale (sin guardar).
    await irA("Formación");
    await act(async () => boton("Sí, salir").click());
    expect(boton("Guardar cambios")).toBeUndefined();
    expect(db.filas[0].resultado).toBe("3-0");
  });

  test("la pestaña Formación pregunta antes de tirar una formación sin guardar", async () => {
    await montar();
    await irA("Formación");
    // Sin cambios no pregunta nada.
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();

    await act(async () => boton("Ingresar Formación").click());
    const convocado = contenedor.querySelectorAll(".contenedor-formacion .grilla-plantel input")[0];
    await escribir(convocado, "DUDU");

    // Tocar Formación con la formación sin guardar: pregunta, y "Seguir
    // editando" la deja como estaba.
    await irA("Formación");
    expect(contenedor.querySelector(".hoja-confirmar h3").textContent).toBe("¿Descartar la formación sin guardar?");
    await act(async () => contenedor.querySelector(".hoja-confirmar .boton-cancelar-hoja").click());
    expect(contenedor.querySelectorAll(".contenedor-formacion .grilla-plantel input")[0].value).toBe("DUDU");

    // Ir al tablero y volver a Formación también pregunta; "Seguir editando"
    // vuelve a la formación con lo escrito.
    await irA("Partido");
    await irA("Formación");
    expect(contenedor.querySelector(".hoja-confirmar")).not.toBeNull();
    await act(async () => contenedor.querySelector(".hoja-confirmar .boton-cancelar-hoja").click());
    expect(contenedor.querySelectorAll(".contenedor-formacion .grilla-plantel input")[0].value).toBe("DUDU");

    // Descartando, queda la del partido.
    await irA("Formación");
    await act(async () => boton("Descartar").click());
    await act(async () => boton("Ingresar Formación").click());
    expect(contenedor.querySelectorAll(".contenedor-formacion .grilla-plantel input")[0].value).toBe("BERNARD");
    expect(borrador().formacion.convocados).toEqual(expect.not.arrayContaining(["DUDU"]));
  });

  // ------------------------------------------------------------------ 9 --
  const abrirAjustesEquipo = async () => {
    await irA("Ajustes");
    await act(async () =>
      Array.from(contenedor.querySelectorAll(".opcion-ajuste")).find((b) => b.textContent.includes("Equipo")).click(),
    );
  };

  test("renombrar el club cuando la base no lo deja no dice 'Nombre cambiado'", async () => {
    db.equipos = [{ id: "eq-1", nombre: "Atlético Mineiro", rol: "admin", desde: "2026-01-01" }];
    db.bloquearRenombre = true;
    await montar({ permisos: { admin: false } });
    await abrirAjustesEquipo();

    await escribir(contenedor.querySelector("#nombre-equipo"), "Atlético Mineiro SAF");
    await act(async () => {
      boton("Guardar nombre").click();
    });
    await vaciarPromesas();

    expect(db.renombres).toBe(1);
    expect(contenedor.textContent).not.toContain("Nombre cambiado");
    expect(contenedor.querySelector(".error-equipo").textContent).toContain("No tenés permiso");
    expect(JSON.parse(localStorage.getItem("equipo_elegido")).nombre).toBe("Atlético Mineiro");
  });

  test("Ajustes › Equipo: quien no administra no ve renombrar ni crear", async () => {
    db.equipos = [{ id: "eq-1", nombre: "Atlético Mineiro", rol: "staff", desde: "2026-01-01" }];
    await montar({ permisos: { admin: false } });
    await abrirAjustesEquipo();

    expect(contenedor.textContent).toContain("Atlético Mineiro");
    expect(contenedor.querySelector("#nombre-equipo")).toBeNull();
    expect(boton("Guardar nombre")).toBeUndefined();
    expect(contenedor.querySelector('input[placeholder="Nombre del equipo nuevo"]')).toBeNull();
    expect(contenedor.textContent).not.toContain("Agregar un equipo");
  });

  test("crear un club que la base rechaza muestra un aviso entendible, no el error crudo", async () => {
    db.equipos = [{ id: "eq-1", nombre: "Atlético Mineiro", rol: "admin", desde: "2026-01-01" }];
    db.errorCrearEquipo = { code: "42501", message: 'new row violates row-level security policy for table "equipos"' };
    await montar({ permisos: { admin: true } });
    await abrirAjustesEquipo();

    await escribir(contenedor.querySelector('input[placeholder="Nombre del equipo nuevo"]'), "Club Nuevo");
    await act(async () => {
      Array.from(contenedor.querySelectorAll("button")).find((b) => b.textContent.trim() === "Crear").click();
    });
    await vaciarPromesas();

    const error = contenedor.querySelector(".error-equipo").textContent;
    expect(error).not.toContain("row-level security");
    expect(error).toContain("No tenés permiso para crear equipos");
  });

  test("para cambiar de club se ofrecen solo los clubes en los que la cuenta está hoy", async () => {
    db.equipos = [
      { id: "eq-1", nombre: "Atlético Mineiro", rol: "admin", desde: "2026-01-01" },
      { id: "eq-2", nombre: "Club que dejé", desde: "2026-01-01", hasta: "2026-03-01" },
      { id: "eq-3", nombre: "Club ajeno", desde: null },
      { id: "eq-4", nombre: "Club de hoy", desde: "2026-02-01" },
    ];
    elegirClub("eq-1", "Atlético Mineiro");
    await montar({ permisos: { admin: true } });
    await abrirAjustesEquipo();

    // (El escudo dibujado suma la inicial al texto del botón.)
    const ofrecidos = Array.from(contenedor.querySelectorAll(".lista-equipos button")).map((b) => b.textContent.trim());
    expect(ofrecidos).toHaveLength(1);
    expect(ofrecidos[0]).toContain("Club de hoy");
  });

  // ----------------------------------------------------------------- 11 --
  test("si la base tarda y se cambia de club, los partidos del club anterior no aparecen en el nuevo", async () => {
    dosClubes();
    elegirClub("eq-1", "Atlético Mineiro");
    db.filas = [
      { id: 1, equipo_id: "eq-1", fecha: "2026-09-01", rival: "Flamengo", resultado: "2-2" },
      { id: 2, equipo_id: "eq-2", fecha: "2026-09-02", rival: "Santos", resultado: "1-0" },
    ];
    // La lectura de eq-1 queda colgada.
    db.retenerHistorialDe = "eq-1";
    await montar();

    await abrirAjustesEquipo();
    await act(async () => Array.from(contenedor.querySelectorAll(".lista-equipos button")).find((b) => b.textContent.includes("Otro Club")).click());
    await vaciarPromesas();

    // Llega tarde la respuesta de eq-1.
    await act(async () => {
      db.soltarHistorial?.();
    });
    await vaciarPromesas();

    await irA("Registros");
    const filas = Array.from(contenedor.querySelectorAll(".registro-guardado")).map((f) => f.textContent);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toContain("Santos");
    expect(contenedor.textContent).not.toContain("Flamengo");
  });

  // ----------------------------------------------------------------- 12 --
  test("con señal, la cola se vuelve a intentar sola cada tanto aunque no llegue el aviso de 'online'", async () => {
    localStorage.setItem(
      "registros_sin_sincronizar:eq-1",
      JSON.stringify([{ fecha: "2026-09-07", rival: "Flamengo", resultado: "2-2", sinSincronizar: true }]),
    );
    // En la cancha la base no contesta, pero el teléfono dice que hay red.
    db.errorHistorial = { message: "sin señal" };
    await montar();
    expect(db.filas).toHaveLength(0);

    // Vuelve la base, sin evento 'online' (navigator.onLine nunca cambió).
    db.errorHistorial = null;
    await act(async () => vi.advanceTimersByTime(61000));
    await vaciarPromesas();
    await vaciarPromesas();

    expect(db.filas.map((f) => f.rival)).toEqual(["Flamengo"]);
    expect(cola()).toHaveLength(0);

    // Sin nada en la cola no se lee la base de nuevo.
    const lecturas = db.lecturasHistorial;
    await act(async () => vi.advanceTimersByTime(61000));
    await vaciarPromesas();
    expect(db.lecturasHistorial).toBe(lecturas);
  });

  // ----------------------------------------------------------------- 14 --
  test("un borrador escrito por otra versión de la app no se abre vacío ni se pisa sin copia", async () => {
    // Como si una versión más nueva hubiera cambiado el formato y se hubiera
    // vuelto atrás: antes se lo tomaba por el formato viejo, el partido abría
    // vacío y el borrador vacío lo pisaba.
    const deOtraVersion = JSON.stringify({
      version: 3,
      registro: {
        fecha: "2026-09-08",
        rival: "Cruzeiro",
        resultado: "1-0",
        inicioPT: "21:00:00",
        formacion: { titulares: ["ALONSO", "SCARPA"], convocados: ["BERNARD"] },
      },
    });
    localStorage.setItem("registro_actual_partido", deOtraVersion);
    await montar();

    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();
    expect(contenedor.textContent).toContain("Cruzeiro");
    expect(borrador().inicioPT).toBe("21:00:00");
    const respaldos = JSON.parse(localStorage.getItem("registro_actual_partido_respaldo") || "[]");
    expect(respaldos.map((item) => item.texto)).toContain(deOtraVersion);
  });

  // ------------------------------------------------------------------ 2 --
  test("un partido que se guarda sin señal mientras se suben los pendientes no se pierde de la cola", async () => {
    // Un pendiente de ayer (Flamengo). La base responde, pero lenta.
    localStorage.setItem(
      "registros_sin_sincronizar:eq-1",
      JSON.stringify([{ fecha: "2026-09-07", rival: "Flamengo", resultado: "2-2", sinSincronizar: true }]),
    );
    db.retenerRival = "Flamengo";
    await montar(); // arranca la carga y queda subiendo Flamengo

    // Mientras tanto se guarda el partido de hoy (Cruzeiro) y ese pedido falla.
    db.fallarRival = "Cruzeiro";
    await guardar();
    await act(async () => vi.advanceTimersByTime(10000));
    await vaciarPromesas();
    expect(cola().map((p) => p.rival)).toContain("Cruzeiro");

    // Termina de subir Flamengo.
    await act(async () => {
      db.soltar?.();
    });
    await vaciarPromesas();
    await vaciarPromesas();

    expect(cola().map((p) => p.rival)).toEqual(["Cruzeiro"]);
    expect(db.filas.map((f) => f.rival)).toEqual(["Flamengo"]);
  });
});
