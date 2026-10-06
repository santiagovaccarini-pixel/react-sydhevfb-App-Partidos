import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";
import { cambiarIdioma } from "./idioma/index.js";

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
  // El pedido de ese rival vence (mala señal), o la base lo rechaza con su
  // código (un permiso, una columna que falta).
  fallarRival: null,
  rechazarRival: null,
  soltar: null,
  lecturasHistorial: 0,
  retenerHistorialDe: null,
  soltarHistorial: null,
  // Con esto, la lectura retenida contesta lo que había en la base al
  // pedirla (como la de verdad), y no lo que haya al soltarla.
  fotoAlPedirHistorial: false,
  lecturasRetenidas: [],
  // Un UPDATE de ese resultado queda en viaje (una sola vez): antes de llegar
  // a la base, o ya aplicado y con la respuesta demorada.
  retenerUpdate: null,
  demorarRespuestaUpdate: null,
  retenidos: [],
}));

// Deja un pedido en viaje hasta que la prueba lo suelte (db.soltar, o todos
// juntos al terminar).
const retener = (alSoltar) =>
  new Promise((resolver) => {
    alSoltar(resolver);
    db.retenidos.push(resolver);
  });

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
          const foto = () =>
            db.filas
              .filter((f) => !filtroEquipo || f.equipo_id === filtroEquipo)
              .map((f) => ({ ...f }))
              .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
          const alPedir = db.fotoAlPedirHistorial ? foto() : null;
          if (db.retenerHistorialDe && filtroEquipo === db.retenerHistorialDe) {
            await retener((resolver) => {
              db.soltarHistorial = resolver;
              db.lecturasRetenidas.push(resolver);
            });
          }
          return {
            data: db.errorHistorial ? null : alPedir || foto(),
            error: db.errorHistorial,
          };
        },
        insert: (filas) => ({
          select: async () => {
            if (db.retenerRival && filas[0].rival === db.retenerRival) {
              await retener((resolver) => {
                db.soltar = resolver;
              });
            }
            if (db.fallarRival && filas[0].rival === db.fallarRival) return { data: null, error: { message: "timeout" } };
            if (db.rechazarRival && filas[0].rival === db.rechazarRival) {
              return { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
            }
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
              if (db.retenerUpdate && cambios.resultado === db.retenerUpdate) {
                db.retenerUpdate = null;
                await retener((resolver) => {
                  db.soltar = resolver;
                });
              }
              if (db.errorGuardado) return { data: null, error: db.errorGuardado };
              const fila = db.filas.find((f) => String(f.id) === String(valor));
              if (!fila) return { data: [], error: null };
              Object.assign(fila, cambios);
              db.updates.push({ id: valor, ...cambios });
              if (db.demorarRespuestaUpdate && cambios.resultado === db.demorarRespuestaUpdate) {
                db.demorarRespuestaUpdate = null;
                await retener((resolver) => {
                  db.soltar = resolver;
                });
              }
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
      rechazarRival: null,
      soltar: null,
      lecturasHistorial: 0,
      retenerHistorialDe: null,
      soltarHistorial: null,
      fotoAlPedirHistorial: false,
      lecturasRetenidas: [],
      retenerUpdate: null,
      demorarRespuestaUpdate: null,
      retenidos: [],
    });
    localStorage.clear();
    localStorage.setItem("registro_actual_partido", JSON.stringify(borradorCruzeiro()));
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    // Lo que quedó en viaje se suelta: los candados de la cola viven fuera de
    // la pantalla, y una subida colgada pasaría a la prueba siguiente.
    Object.assign(db, { retenerRival: null, retenerHistorialDe: null, retenerUpdate: null, demorarRespuestaUpdate: null });
    for (let vuelta = 0; vuelta < 5 && db.retenidos.length > 0; vuelta += 1) {
      await act(async () => db.retenidos.splice(0).forEach((soltar) => soltar()));
      await vaciarPromesas();
    }
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

  test("un doble toque en Iniciar PT no termina el período en el mismo segundo; un Finalizar después sí", async () => {
    await montar();
    const accion = () => contenedor.querySelector(".accion-periodo");
    expect(accion().textContent).toContain("Iniciar PT");

    // Dos toques seguidos, como un pulgar nervioso.
    await act(async () => accion().click());
    await act(async () => vi.advanceTimersByTime(120));
    await act(async () => accion().click());
    expect(borrador().inicioPT).toMatch(/^\d\d:\d\d:\d\d$/);
    expect(borrador().finalPT || "").toBe("");
    expect(accion().textContent).toContain("Finalizar PT");

    // Un rato después, Finalizar cierra el PT como siempre.
    await act(async () => vi.advanceTimersByTime(3000));
    await act(async () => accion().click());
    expect(borrador().finalPT).not.toBe("");
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

  test("volver a la versión anterior y otra vez a esta, con dos clubes, no cambia el partido en curso por el borrador vacío del otro club", async () => {
    dosClubes();
    elegirClub("eq-1", "Atlético Mineiro");
    enElSegundoTiempo();
    vi.setSystemTime(new Date(2026, 8, 8, 22, 30, 0));
    await montar();

    // Se pasa al otro club: la copia común queda con su borrador vacío.
    await irA("Ajustes");
    await act(async () => Array.from(contenedor.querySelectorAll(".opcion-ajuste")).find((b) => b.textContent.includes("Equipo")).click());
    await act(async () => Array.from(contenedor.querySelectorAll(".lista-equipos button")).find((b) => b.textContent.includes("Otro Club")).click());
    await vaciarPromesas();
    await act(async () => raiz.unmount());
    raiz = null;

    // La versión anterior abre en el club 1 y reescribe la común tal cual, sin club.
    const comun = JSON.parse(localStorage.getItem("registro_actual_partido"));
    expect(comun.equipoId).toBe("eq-2");
    localStorage.setItem("registro_actual_partido", JSON.stringify({ version: 2, registro: comun.registro }));
    elegirClub("eq-1", "Atlético Mineiro");

    // De vuelta en esta versión, el partido del club 1 sigue ahí.
    await montar();
    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();
    expect(contenedor.textContent).toContain("Cruzeiro");
    expect(JSON.parse(localStorage.getItem("registro_actual_partido:eq-1")).registro.inicioST).toBe("22:03:00");
  });

  test("guardar y cambiar de club antes de la respuesta: al volver, Guardar no pregunta si reemplazar el propio partido", async () => {
    dosClubes();
    elegirClub("eq-1", "Atlético Mineiro");
    await montar();

    // El INSERT tarda; mientras tanto se pasa a Otro Club, y después llega.
    db.retenerRival = "Cruzeiro";
    await guardar();
    const irAlClub = async (nombre) => {
      await irA("Ajustes");
      await act(async () => Array.from(contenedor.querySelectorAll(".opcion-ajuste")).find((b) => b.textContent.includes("Equipo")).click());
      await act(async () => Array.from(contenedor.querySelectorAll(".lista-equipos button")).find((b) => b.textContent.includes(nombre)).click());
      await vaciarPromesas();
    };
    await irAlClub("Otro Club");
    db.retenerRival = null;
    await act(async () => db.soltar?.());
    await vaciarPromesas();
    expect(JSON.parse(localStorage.getItem("registro_actual_partido:eq-1")).registro.idSupabase).toBe(100);
    expect(JSON.parse(localStorage.getItem("registro_actual_partido:eq-2")).registro.idSupabase).toBeUndefined();

    // De vuelta en su club, el final va a la misma fila sin preguntar.
    await irAlClub("Atlético");
    await irA("Partido");
    await escribirGolesRival("2");
    await guardar();
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(db.filas.map((f) => `${f.id}:${f.equipo_id}:${f.resultado}`)).toEqual(["100:eq-1:1-2"]);
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

  test("Ajustes › Equipo dice que se ven los clubes donde se está y avisa el cambio de club en el idioma de la app", async () => {
    dosClubes();
    elegirClub("eq-1", "Atlético Mineiro");
    await montar();
    await irA("Ajustes");
    await act(async () => Array.from(contenedor.querySelectorAll(".opcion-ajuste")).find((b) => b.textContent.includes("Equipo")).click());
    expect(Array.from(contenedor.querySelectorAll(".pista-equipo")).map((p) => p.textContent)).toContain("Cada equipo ve solo sus partidos y su plantel. Acá aparecen los clubes en los que estás.");
    await act(async () => Array.from(contenedor.querySelectorAll(".lista-equipos button")).find((b) => b.textContent.includes("Otro Club")).click());
    await vaciarPromesas();
    expect(contenedor.textContent).toContain("Ahora estás en Otro Club");

    // El idioma se elige en el portal, antes de entrar a Partido.
    await act(async () => raiz.unmount());
    raiz = null;
    cambiarIdioma("pt-BR");
    try {
      await montar();
      await irA("Ajustes");
      await act(async () => Array.from(contenedor.querySelectorAll(".opcion-ajuste")).find((b) => b.textContent.includes("Equipo")).click());
      expect(Array.from(contenedor.querySelectorAll(".pista-equipo")).map((p) => p.textContent)).toContain("Cada equipe vê só as suas partidas e o seu elenco. Aqui aparecem os clubes dos quais você faz parte.");
      await act(async () => Array.from(contenedor.querySelectorAll(".lista-equipos button")).find((b) => b.textContent.includes("Atlético")).click());
      await vaciarPromesas();
      expect(contenedor.textContent).toContain("Agora você está em Atlético Mineiro");
    } finally {
      cambiarIdioma("es-AR");
    }
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

  test("agregar una fila vacía al editar un registro no cuenta como cambio sin guardar", async () => {
    db.filas = [{ id: 50, equipo_id: "eq-1", fecha: "2026-09-01", rival: "Bahia", resultado: "3-0", titulares: ["ALONSO"], convocados: ["BERNARD"] }];
    await montar();
    await irA("Registros");
    await act(async () => contenedor.querySelector(".registro-guardado .boton-detalle").click());
    await act(async () => boton("Editar registro").click());
    const pestanaFormacion = Array.from(contenedor.querySelectorAll('.en-ficha [role="tab"]')).find((b) => b.textContent.includes("Formación"));
    await act(async () => pestanaFormacion.click());

    // Una fila nueva sin escribir nada: se sale sin preguntar.
    await act(async () => boton("+ Agregar jugador").click());
    await irA("Registros");
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();

    // Con un nombre escrito en esa fila, sí pregunta.
    await act(async () => contenedor.querySelector(".registro-guardado .boton-detalle").click());
    await act(async () => boton("Editar registro").click());
    const otraVez = Array.from(contenedor.querySelectorAll('.en-ficha [role="tab"]')).find((b) => b.textContent.includes("Formación"));
    await act(async () => otraVez.click());
    await act(async () => boton("+ Agregar jugador").click());
    const lugares = contenedor.querySelectorAll('input[placeholder^="Convocado"]');
    await escribir(lugares[lugares.length - 1], "SCARPA");
    await irA("Registros");
    expect(contenedor.querySelector(".hoja-confirmar h3").textContent).toBe("¿Salir sin guardar los cambios?");
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

  test("cerrar la hoja de la formación sin guardar tocando afuera o con Escape deja en el tablero", async () => {
    vi.setSystemTime(new Date(2026, 8, 8, 22, 30, 0));
    enElSegundoTiempo();
    await montar();
    await irA("Formación");
    await act(async () => boton("Ingresar Formación").click());
    const primerConvocado = () => contenedor.querySelectorAll(".contenedor-formacion .grilla-plantel input")[0];
    await escribir(primerConvocado(), "SUPLENTE NUEVO");
    await irA("Partido");
    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();

    // Un toque de más en Formación abre la hoja; tocar afuera la cierra y
    // queda el tablero.
    await irA("Formación");
    const velo = contenedor.querySelector(".velo-dialogo");
    await act(async () => velo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();

    // Lo mismo con Escape.
    await irA("Formación");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();

    // "Seguir editando" sí lleva a la formación, con lo escrito.
    await irA("Formación");
    await act(async () => contenedor.querySelector(".hoja-confirmar .boton-cancelar-hoja").click());
    expect(primerConvocado().value).toBe("SUPLENTE NUEVO");
  });

  test("volver a los módulos con una formación sin guardar pregunta antes de tirarla", async () => {
    const onVolver = vi.fn();
    await montar({ onVolver });
    await irA("Formación");
    await act(async () => boton("Ingresar Formación").click());
    const primerConvocado = () => contenedor.querySelectorAll(".contenedor-formacion .grilla-plantel input")[0];
    await escribir(primerConvocado(), "SUPLENTE NUEVO");

    // "Volver" no tira nada; "Módulos" pregunta.
    await act(async () => contenedor.querySelector(".boton-volver").click());
    await act(async () => contenedor.querySelector(".boton-modulos").click());
    expect(contenedor.querySelector(".hoja-confirmar h3").textContent).toBe("¿Descartar la formación sin guardar?");
    expect(onVolver).not.toHaveBeenCalled();

    // "Seguir editando" vuelve a la formación, con lo escrito.
    await act(async () => contenedor.querySelector(".hoja-confirmar .boton-cancelar-hoja").click());
    expect(primerConvocado().value).toBe("SUPLENTE NUEVO");

    // Descartando, sale.
    await act(async () => contenedor.querySelector(".boton-volver").click());
    await act(async () => contenedor.querySelector(".boton-modulos").click());
    await act(async () => boton("Descartar").click());
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  test("sin nada sin guardar, Módulos sale derecho", async () => {
    const onVolver = vi.fn();
    await montar({ onVolver });
    await irA("Formación");
    await act(async () => contenedor.querySelector(".boton-modulos").click());
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(onVolver).toHaveBeenCalledTimes(1);
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

  test("para cambiar de club no se ofrecen los clubes donde la cuenta no tiene Partido", async () => {
    db.equipos = [
      { id: "eq-1", nombre: "Atlético Mineiro", rol: "staff", desde: "2026-01-01", partido: true },
      { id: "eq-2", nombre: "Club sin Partido", rol: "staff", desde: "2026-01-01", partido: false, flujo: true },
      { id: "eq-3", nombre: "Club con Partido", rol: "staff", desde: "2026-01-01", partido: true },
    ];
    elegirClub("eq-1", "Atlético Mineiro");
    await montar({ permisos: { admin: false } });
    await abrirAjustesEquipo();

    const ofrecidos = Array.from(contenedor.querySelectorAll(".lista-equipos button")).map((b) => b.textContent.trim());
    expect(ofrecidos).toHaveLength(1);
    expect(ofrecidos[0]).toContain("Club con Partido");
  });

  test("quien no administra y no tiene ningún club ve por qué y puede volver a los módulos", async () => {
    db.equipos = [];
    localStorage.setItem("equipo_elegido", JSON.stringify({ id: "eq-1", nombre: "Atlético Mineiro", rol: "usuario", partido: true }));
    const onVolver = vi.fn();
    await montar({ permisos: { admin: false }, onVolver });

    expect(contenedor.querySelector("h1").textContent).toBe("¿De qué equipo sos?");
    expect(contenedor.textContent).toContain("No tenés ningún club con Partido habilitado");
    // Crear un club sigue siendo solo del dueño de la plataforma.
    expect(contenedor.querySelector('input[placeholder="Nombre del equipo nuevo"]')).toBeNull();
    await act(async () => boton("Módulos").click());
    expect(onVolver).toHaveBeenCalledTimes(1);
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

  test("si la base contesta pero rechaza siempre un pendiente, el reintento se espacia y lo nuevo igual sube al minuto", async () => {
    localStorage.setItem(
      "registros_sin_sincronizar:eq-1",
      JSON.stringify([{ fecha: "2026-09-07", rival: "Flamengo", resultado: "2-2", sinSincronizar: true }]),
    );
    db.rechazarRival = "Flamengo";
    await montar();

    // Un partido entero (90 minutos): antes eran 90 lecturas del historial.
    const minuto = async () => {
      await act(async () => vi.advanceTimersByTime(60000));
      await vaciarPromesas();
    };
    const lecturasAntes = db.lecturasHistorial;
    for (let i = 0; i < 90; i += 1) await minuto();
    expect(db.lecturasHistorial - lecturasAntes).toBeLessThanOrEqual(15);

    // El partido en vivo, guardado sin señal, sube al minuto de volver la base.
    db.errorGuardado = { message: "sin señal" };
    await guardar();
    db.errorGuardado = null;
    expect(cola().map((p) => p.rival)).toContain("Cruzeiro");
    await minuto();
    expect(resultados()).toEqual(["Cruzeiro:1-0"]);
    expect(cola().map((p) => p.rival)).toEqual(["Flamengo"]);
  });

  test("con mala señal, que la subida venza no espacia el reintento: al volver la señal, el partido sube al minuto", async () => {
    await montar();
    db.errorGuardado = { message: "sin señal" };
    await guardar();
    db.errorGuardado = null;
    expect(cola().map((p) => p.rival)).toEqual(["Cruzeiro"]);

    // Mala señal: el historial contesta, pero la subida vence.
    db.fallarRival = "Cruzeiro";
    const minuto = async () => {
      await act(async () => vi.advanceTimersByTime(60000));
      await vaciarPromesas();
    };
    const lecturasAntes = db.lecturasHistorial;
    for (let i = 0; i < 8; i += 1) await minuto();
    expect(db.lecturasHistorial - lecturasAntes).toBe(8);

    // Vuelve la señal, sin aviso de 'online': sube en la vuelta siguiente.
    db.fallarRival = null;
    await minuto();
    expect(resultados()).toEqual(["Cruzeiro:1-0"]);
    expect(cola()).toHaveLength(0);
  });

  // ----------------------------------------------------------------- 13 --
  test("al editar un registro, los jugadores del rival que se ofrecen son los de ese partido", async () => {
    // El borrador (Cruzeiro) tiene sus propios cambios del rival.
    localStorage.setItem(
      "registro_actual_partido",
      JSON.stringify(borradorCruzeiro({ cambiosRival: [{ sale: "MATHEUS PEREIRA", entra: "KAIO JORGE", hora: "" }] })),
    );
    db.filas = [
      {
        id: 50,
        equipo_id: "eq-1",
        fecha: "2026-09-01",
        rival: "Bahia",
        resultado: "3-0",
        rival_cambio_sale1: "EVERTON RIBEIRO",
        rival_cambio_entra1: "CAULY",
        rival_cambio_horario1: "21:30:00",
      },
    ];
    await montar();
    await irA("Registros");
    await act(async () => contenedor.querySelector(".registro-guardado .boton-detalle").click());
    await act(async () => boton("Editar registro").click());
    await act(async () =>
      Array.from(contenedor.querySelectorAll('.selector-periodos.en-ficha [role="tab"]')).find((b) => b.textContent.includes("Cambios")).click(),
    );
    await act(async () => contenedor.querySelectorAll(".selector-equipo button")[1].click());

    // El segundo cambio está vacío: al tocar "Sale" se ofrecen los nombres.
    const sale = contenedor.querySelectorAll(".ranura-cambio")[1].querySelector(".sale input");
    await act(async () => sale.focus());
    const ofrecidos = Array.from(contenedor.querySelectorAll(".selector-nombre-lista button")).map((b) => b.textContent);

    expect(ofrecidos).toEqual(expect.arrayContaining(["EVERTON RIBEIRO", "CAULY"]));
    expect(ofrecidos).not.toContain("MATHEUS PEREIRA");
    expect(ofrecidos).not.toContain("KAIO JORGE");
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

  // ------------------------------------------------- segunda revisión --
  const resultados = () => db.filas.map((f) => `${f.rival}:${f.resultado}`);

  test("un pedido colgado de la cola, de otro partido, no frena el Guardar del partido en vivo", async () => {
    localStorage.setItem(
      "registros_sin_sincronizar:eq-1",
      JSON.stringify([{ fecha: "2026-09-07", rival: "Flamengo", resultado: "2-2", sinSincronizar: true }]),
    );
    // Barras sin datos: el INSERT de Flamengo no contesta.
    db.retenerRival = "Flamengo";
    await montar();

    // Sin esperar 8 s: el partido llega a la base y el botón queda libre.
    await guardar();
    expect(resultados()).toEqual(["Cruzeiro:1-0"]);
    expect(contenedor.textContent).toContain("Partido guardado con éxito");
    expect(boton("Guardar partido").disabled).toBe(false);

    // El final va derecho a la misma fila.
    await escribirGolesRival("2");
    await guardar();
    expect(resultados()).toEqual(["Cruzeiro:1-2"]);

    // Cuando Flamengo contesta, sube también.
    await act(async () => db.soltar?.());
    await vaciarPromesas();
    expect(resultados().sort()).toEqual(["Cruzeiro:1-2", "Flamengo:2-2"]);
    expect(cola()).toHaveLength(0);
  });

  test("si la relectura de después de guardar no contesta, Guardar no queda trabado en 'Guardando…'", async () => {
    await montar();
    db.retenerHistorialDe = "eq-1";

    await guardar();
    expect(resultados()).toEqual(["Cruzeiro:1-0"]);
    expect(contenedor.textContent).toContain("Partido guardado con éxito");
    expect(boton("Guardar partido").disabled).toBe(false);

    await escribirGolesRival("2");
    await guardar();
    expect(resultados()).toEqual(["Cruzeiro:1-2"]);
  });

  test("dos Guardar seguidos con el historial lento: si la relectura del primero llega última, no vuelve atrás el resultado", async () => {
    await montar();
    // La base guarda enseguida, pero el historial tarda en contestar (y
    // contesta lo que había cuando se lo pidió).
    db.retenerHistorialDe = "eq-1";
    db.fotoAlPedirHistorial = true;

    await escribirGolesRival("1");
    await guardar();
    await escribirGolesRival("2");
    await guardar();
    expect(resultados()).toEqual(["Cruzeiro:1-2"]);
    expect(db.lecturasRetenidas).toHaveLength(2);

    // Contesta primero la relectura del segundo Guardar, y después la del primero.
    const [primera, segunda] = db.lecturasRetenidas;
    db.retenerHistorialDe = null;
    await act(async () => segunda());
    await vaciarPromesas();
    await act(async () => primera());
    await vaciarPromesas();

    await irA("Registros");
    const filas = Array.from(contenedor.querySelectorAll(".registro-guardado")).map((f) => f.textContent);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toContain("1-2");
    const respaldo = JSON.parse(localStorage.getItem("backup_registros_partidos:eq-1")).registros;
    expect(respaldo.map((r) => r.resultado)).toEqual(["1-2"]);

    // Corregir el rival desde Registros no le devuelve a la base el 1-1.
    await act(async () => contenedor.querySelector(".registro-guardado .boton-detalle").click());
    await act(async () => boton("Editar registro").click());
    const rival = Array.from(contenedor.querySelectorAll(".campo-detalle-editable")).find(
      (campo) => campo.querySelector("label").textContent === "Rival",
    );
    await escribir(rival.querySelector("input"), "Cruzeiro EC");
    await act(async () => {
      boton("Guardar cambios").click();
    });
    await vaciarPromesas();
    expect(db.filas.map((f) => `${f.id}:${f.rival}:${f.resultado}`)).toEqual(["100:Cruzeiro EC:1-2"]);
  });

  test("una versión vieja de este mismo partido que está subiendo se espera, y no pisa el guardado final", async () => {
    await montar();
    db.errorGuardado = { message: "sin señal" };
    await guardar();
    db.errorGuardado = null;

    // Vuelve la señal y el 1-0 del entretiempo empieza a subir, lento.
    db.retenerRival = "Cruzeiro";
    await act(async () => window.dispatchEvent(new Event("online")));
    await vaciarPromesas();

    // Final 1-2: espera esa subida y, como no termina, queda en el celular.
    await escribirGolesRival("2");
    await guardar();
    expect(db.filas).toHaveLength(0);
    await act(async () => vi.advanceTimersByTime(8100));
    await vaciarPromesas();
    expect(contenedor.textContent).toContain("Guardado en el celular");

    // Llega el 1-0 viejo, y el 1-2 sube después, encima.
    db.retenerRival = null;
    await act(async () => db.soltar?.());
    await vaciarPromesas();
    await act(async () => vi.advanceTimersByTime(61000));
    await vaciarPromesas();
    await vaciarPromesas();
    expect(resultados()).toEqual(["Cruzeiro:1-2"]);
    expect(cola()).toHaveLength(0);
  });

  test("una versión de este borrador que quedó en la cola mientras subía otra no hace preguntar si reemplazar el propio partido", async () => {
    await montar();
    // Entretiempo sin señal: el 1-0 queda en la cola, sin fila.
    db.errorGuardado = { message: "sin señal" };
    await guardar();
    db.errorGuardado = null;

    // Vuelve la señal y el 1-0 sube lento; el 1-1 espera y va al celular.
    db.retenerRival = "Cruzeiro";
    await act(async () => window.dispatchEvent(new Event("online")));
    await vaciarPromesas();
    await escribirGolesRival("1");
    await guardar();
    await act(async () => vi.advanceTimersByTime(8100));
    await vaciarPromesas();

    // Termina el INSERT del 1-0: el borrador recibe la fila, el 1-1 sigue en la cola.
    db.retenerRival = null;
    await act(async () => db.soltar?.());
    await vaciarPromesas();
    await vaciarPromesas();
    expect(borrador().idSupabase).toBe(100);

    // Final 1-2: no pregunta nada y queda en esa fila.
    await escribirGolesRival("2");
    await guardar();
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(resultados()).toEqual(["Cruzeiro:1-2"]);
    expect(cola()).toHaveLength(0);

    // Y el reintento no sube nada viejo encima.
    await act(async () => vi.advanceTimersByTime(61000));
    await vaciarPromesas();
    expect(resultados()).toEqual(["Cruzeiro:1-2"]);
  });

  // Entretiempo con señal (fila 100) y minuto 70 sin señal: el 1-1 queda en
  // la cola con el número de fila.
  const conElMinuto70EnLaCola = async () => {
    await montar();
    await guardar();
    await escribirGolesRival("1");
    db.errorGuardado = { message: "sin señal" };
    await guardar();
    db.errorGuardado = null;
    expect(cola()).toHaveLength(1);
  };

  test("salir al portal y volver mientras sube la cola: el pendiente viejo en viaje no pisa el guardado final", async () => {
    await conElMinuto70EnLaCola();

    // Se abre Partido y la cola manda el 1-1, que queda en viaje.
    db.retenerUpdate = "1-1";
    await remontar();
    // Se vuelve al portal y se entra de nuevo antes de que llegue.
    await remontar();

    await escribirGolesRival("2");
    await guardar();
    await act(async () => vi.advanceTimersByTime(8100));
    await vaciarPromesas();

    // Llega el 1-1 viejo; el 1-2 sube después, encima.
    await act(async () => db.soltar?.());
    await vaciarPromesas();
    await act(async () => vi.advanceTimersByTime(61000));
    await vaciarPromesas();
    await vaciarPromesas();

    expect(resultados()).toEqual(["Cruzeiro:1-2"]);
    expect(cola()).toHaveLength(0);
  });

  test("salir al portal y volver con el guardado final en viaje: la App nueva no sube encima el pendiente viejo", async () => {
    await conElMinuto70EnLaCola();

    // Final 1-2: la base lo aplica, pero la respuesta tarda.
    await escribirGolesRival("2");
    db.demorarRespuestaUpdate = "1-2";
    await guardar();
    expect(resultados()).toEqual(["Cruzeiro:1-2"]);

    // Se sale y se entra con esa respuesta todavía en viaje.
    await remontar();
    await act(async () => db.soltar?.());
    await vaciarPromesas();
    await act(async () => vi.advanceTimersByTime(61000));
    await vaciarPromesas();

    expect(resultados()).toEqual(["Cruzeiro:1-2"]);
    expect(cola()).toHaveLength(0);
  });

  test("salir al portal y volver con un Guardar en viaje: el Guardar de la App nueva lo espera y el viejo no pisa el final", async () => {
    await montar();
    await guardar();
    expect(resultados()).toEqual(["Cruzeiro:1-0"]);

    // Minuto 70: el UPDATE del 1-1 queda en viaje, y se sale y se entra.
    await escribirGolesRival("1");
    db.retenerUpdate = "1-1";
    await guardar();
    await remontar();

    // Final 1-2 en la App nueva: espera a que conteste el 1-1, y va después.
    await escribirGolesRival("2");
    await guardar();
    await act(async () => db.soltar?.());
    await vaciarPromesas();
    await act(async () => vi.advanceTimersByTime(61000));
    await vaciarPromesas();

    expect(resultados()).toEqual(["Cruzeiro:1-2"]);
    expect(db.updates.map((u) => u.resultado)).toEqual(["1-1", "1-2"]);
    expect(cola()).toHaveLength(0);
  });

  test("si el Guardar en viaje de la App anterior no contesta a tiempo, el final queda en el celular y sube después, encima", async () => {
    await montar();
    await guardar();
    await escribirGolesRival("1");
    db.retenerUpdate = "1-1";
    await guardar();
    await remontar();

    await escribirGolesRival("2");
    await guardar();
    await act(async () => vi.advanceTimersByTime(8100));
    await vaciarPromesas();
    expect(contenedor.textContent).toContain("Guardado en el celular");
    expect(resultados()).toEqual(["Cruzeiro:1-0"]);

    // Llega tarde el 1-1: el final que quedó en el celular no se tira, y sube.
    await act(async () => db.soltar?.());
    await vaciarPromesas();
    await act(async () => vi.advanceTimersByTime(61000));
    await vaciarPromesas();
    await vaciarPromesas();

    expect(resultados()).toEqual(["Cruzeiro:1-2"]);
    expect(cola()).toHaveLength(0);
  });

  test("si el Guardar en viaje de la App anterior falla tarde, no reemplaza en el celular el final que dejó la App nueva", async () => {
    await montar();
    await guardar();
    await escribirGolesRival("1");
    db.retenerUpdate = "1-1";
    await guardar();
    await remontar();

    await escribirGolesRival("2");
    await guardar();
    await act(async () => vi.advanceTimersByTime(8100));
    await vaciarPromesas();
    expect(cola().map((p) => p.resultado)).toEqual(["1-2"]);

    // Se corta la señal y el 1-1 viejo falla: no le gana al 1-2 en la cola.
    db.errorGuardado = { message: "sin señal" };
    await act(async () => db.soltar?.());
    await vaciarPromesas();
    expect(cola().map((p) => p.resultado)).toEqual(["1-2"]);

    db.errorGuardado = null;
    await act(async () => vi.advanceTimersByTime(61000));
    await vaciarPromesas();
    expect(resultados()).toEqual(["Cruzeiro:1-2"]);
    expect(cola()).toHaveLength(0);
  });

  test("salir al portal y volver con el primer Guardar en viaje: el partido no queda repetido", async () => {
    await montar();
    // El INSERT del 1-0 tarda, y mientras tanto se sale y se entra.
    db.retenerRival = "Cruzeiro";
    await guardar();
    db.retenerRival = null;
    await remontar();

    await escribirGolesRival("2");
    await guardar();
    await act(async () => db.soltar?.());
    await vaciarPromesas();
    await act(async () => vi.advanceTimersByTime(61000));
    await vaciarPromesas();

    expect(db.filas.map((f) => `${f.id}:${f.rival}:${f.resultado}`)).toEqual(["100:Cruzeiro:1-2"]);
    expect(cola()).toHaveLength(0);
  });

  test("un Guardar que no contesta nunca no deja la cola del club sin subir después de salir al portal y volver", async () => {
    await montar();
    // El INSERT del partido en vivo no contesta, y queda "Guardando…".
    db.retenerRival = "Cruzeiro";
    await guardar();
    // En la cola hay un partido de ayer.
    localStorage.setItem(
      "registros_sin_sincronizar:eq-1",
      JSON.stringify([{ fecha: "2026-09-07", rival: "Flamengo", resultado: "2-2", sinSincronizar: true }]),
    );
    await remontar();

    for (let vuelta = 0; vuelta < 5; vuelta += 1) {
      await act(async () => vi.advanceTimersByTime(61000));
      await vaciarPromesas();
    }
    await act(async () => window.dispatchEvent(new Event("online")));
    await vaciarPromesas();

    expect(resultados()).toEqual(["Flamengo:2-2"]);
    expect(cola()).toHaveLength(0);
  });

  test("si el Guardar de la App anterior no contesta nunca, el final de ese partido que quedó en el celular sube igual al rato", async () => {
    await montar();
    db.retenerRival = "Cruzeiro";
    await guardar();
    db.retenerRival = null;
    await remontar();

    // El final espera al pedido viejo, no llega a tiempo y queda en el celular.
    await escribirGolesRival("2");
    await guardar();
    await act(async () => vi.advanceTimersByTime(8100));
    await vaciarPromesas();
    expect(cola().map((p) => `${p.rival}:${p.resultado}`)).toEqual(["Cruzeiro:1-2"]);

    // Mientras el pedido viejo puede llegar, no se sube encima…
    await act(async () => vi.advanceTimersByTime(61000));
    await vaciarPromesas();
    expect(resultados()).toEqual([]);

    // …pero no se lo espera para siempre.
    for (let vuelta = 0; vuelta < 10; vuelta += 1) {
      await act(async () => vi.advanceTimersByTime(61000));
      await vaciarPromesas();
    }
    expect(resultados()).toEqual(["Cruzeiro:1-2"]);
    expect(cola()).toHaveLength(0);
  });

  test("si la cola de la App anterior sube el partido en curso, el borrador de la App nueva se entera de su fila y Guardar no pregunta", async () => {
    // Como lo deja la versión de producción: el borrador sin club ni idLocal,
    // y el mismo 1-0 en la cola, sin número propio.
    localStorage.setItem(
      "registros_sin_sincronizar:eq-1",
      JSON.stringify([{ ...borradorCruzeiro().registro, sinSincronizar: true }]),
    );
    // Se abre esta versión y la subida del pendiente queda en viaje.
    db.retenerRival = "Cruzeiro";
    await montar();
    db.retenerRival = null;

    // Se sale al portal y se vuelve; mientras tanto llega (fila 100).
    await remontar();
    await act(async () => db.soltar?.());
    await vaciarPromesas();
    expect(resultados()).toEqual(["Cruzeiro:1-0"]);

    // Otra vuelta por el portal, y el final.
    await remontar();
    await escribirGolesRival("2");
    await guardar();
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(db.filas.map((f) => `${f.id}:${f.rival}:${f.resultado}`)).toEqual(["100:Cruzeiro:1-2"]);
  });

  test("si se cambia de club mientras Guardar espera, la lista del club nuevo no se llena con los partidos del anterior", async () => {
    dosClubes();
    elegirClub("eq-1", "Atlético Mineiro");
    db.filas = [
      { id: 1, equipo_id: "eq-1", fecha: "2026-09-01", rival: "Bahia", resultado: "3-0" },
      { id: 2, equipo_id: "eq-2", fecha: "2026-09-02", rival: "Santos", resultado: "1-0" },
    ];
    // El 1-0 del entretiempo quedó en la cola y su subida tarda.
    localStorage.setItem(
      "registros_sin_sincronizar:eq-1",
      JSON.stringify([{ ...borradorCruzeiro().registro, sinSincronizar: true }]),
    );
    db.retenerRival = "Cruzeiro";
    await montar();

    // Guardar 1-1 espera esa subida, y mientras tanto se pasa a Otro Club.
    await escribirGolesRival("1");
    await guardar();
    await abrirAjustesEquipo();
    await act(async () => Array.from(contenedor.querySelectorAll(".lista-equipos button")).find((b) => b.textContent.includes("Otro Club")).click());
    await vaciarPromesas();
    await act(async () => vi.advanceTimersByTime(8100));
    await vaciarPromesas();

    await irA("Registros");
    const filas = Array.from(contenedor.querySelectorAll(".registro-guardado")).map((f) => f.textContent);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toContain("Santos");
    // El partido quedó a salvo en la cola de su club.
    expect(cola("eq-1").map((p) => `${p.rival}:${p.resultado}`)).toEqual(["Cruzeiro:1-1"]);
    expect(cola("eq-2")).toHaveLength(0);
  });

  test.each([
    ["el rival", { rival: "Cruzeiro EC" }],
    ["la fecha", { fecha: "2026-09-07" }],
  ])("corregir sin señal %s de un pendiente que ya tenía fila actualiza esa fila, sin repetir el partido", async (_, correccion) => {
    localStorage.removeItem("registro_actual_partido");
    db.filas = [{ id: 100, equipo_id: "eq-1", fecha: "2026-09-08", rival: "Cruzeiro", resultado: "1-0" }];
    localStorage.setItem(
      "registros_sin_sincronizar:eq-1",
      JSON.stringify([
        { fecha: "2026-09-08", rival: "Cruzeiro", resultado: "1-1", idSupabase: 100, sinSincronizar: true, ...correccion },
      ]),
    );
    await montar();

    expect(db.inserts).toHaveLength(0);
    expect(db.filas).toEqual([expect.objectContaining({ id: 100, resultado: "1-1", ...correccion })]);
    expect(cola()).toHaveLength(0);
  });

  // La cola del celular no entra: hay lugar para todo lo demás.
  const colaSinLugar = () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (clave, valor) {
      if (String(clave).startsWith("registros_sin_sincronizar")) throw new DOMException("lleno", "QuotaExceededError");
      return original.call(this, clave, valor);
    });
  };

  test("si la cola del celular no entra, Guardar sin señal no dice 'Guardado en el celular'", async () => {
    await montar();
    colaSinLugar();
    db.errorGuardado = { message: "sin señal" };
    await guardar();

    expect(contenedor.textContent).toContain("No se pudo guardar en el celular");
    expect(contenedor.textContent).not.toContain("Guardado en el celular");
    expect(cola()).toHaveLength(0);
    // El partido sigue entero en el borrador, para volver a guardarlo.
    expect(borrador().rival).toBe("Cruzeiro");
    await irA("Registros");
    expect(contenedor.querySelectorAll(".registro-guardado")).toHaveLength(0);
  });

  test("si la cola del celular no entra, corregir un pendiente no lo saca de la cola y deja seguir editando", async () => {
    sembrarSabadoYMiercoles();
    await montar();
    await irA("Registros");
    const santos = Array.from(contenedor.querySelectorAll(".registro-guardado")).find((f) => f.textContent.includes("Santos"));
    await act(async () => santos.querySelector(".boton-detalle").click());
    await act(async () => boton("Editar registro").click());
    await escribir(contenedor.querySelectorAll(".resultado-ficha input")[0], "2");

    colaSinLugar();
    await act(async () => {
      boton("Guardar cambios").click();
    });
    await vaciarPromesas();

    expect(contenedor.textContent).toContain("No se pudieron guardar los cambios en el celular");
    expect(boton("Guardar cambios")).toBeDefined();
    expect(cola().map((p) => `${p.rival}:${p.resultado}`)).toEqual(["Santos:1-1"]);
  });

  // Hay lugar para reescribir una clave que ya existe, pero no para crear otra.
  const sinLugarParaClavesNuevas = () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (clave, valor) {
      if (this.getItem(clave) === null) throw new DOMException("lleno", "QuotaExceededError");
      return original.call(this, clave, valor);
    });
  };

  test("con el celular casi lleno, la formación cargada en el otro club no se pierde porque la copia común guarde un borrador vacío", async () => {
    // La versión de producción dejó un borrador vacío, sin club.
    localStorage.setItem("registro_actual_partido", JSON.stringify({ version: 2, registro: { fecha: "2026-09-08", rival: "" } }));
    dosClubes();
    elegirClub("eq-1", "Atlético Mineiro");
    sinLugarParaClavesNuevas();
    await montar();
    expect(localStorage.getItem("registro_actual_partido:eq-1")).toBeNull();

    // Se pasa al otro club y se carga la formación.
    await abrirAjustesEquipo();
    await act(async () => Array.from(contenedor.querySelectorAll(".lista-equipos button")).find((b) => b.textContent.includes("Otro Club")).click());
    await vaciarPromesas();
    await irA("Formación");
    await act(async () => boton("Ingresar Formación").click());
    await escribir(contenedor.querySelectorAll(".contenedor-formacion .grilla-plantel input")[0], "SUPLENTE CLUB DOS");
    await act(async () => boton("Guardar formación").click());
    await vaciarPromesas();

    // Se cierra la app y se vuelve a abrir en ese club: la formación sigue.
    await act(async () => raiz.unmount());
    raiz = null;
    await montar();
    expect(JSON.parse(localStorage.getItem("equipo_elegido")).id).toBe("eq-2");
    await irA("Formación");
    await act(async () => boton("Ingresar Formación").click());
    expect(contenedor.querySelectorAll(".contenedor-formacion .grilla-plantel input")[0].value).toBe("SUPLENTE CLUB DOS");
  });

  test("con el celular casi lleno y un solo club, el partido que quedó en la copia común no muestra el aviso de que se pierde", async () => {
    vi.setSystemTime(new Date(2026, 8, 8, 22, 30, 0));
    enElSegundoTiempo();
    sinLugarParaClavesNuevas();
    await montar();
    expect(localStorage.getItem("registro_actual_partido:eq-1")).toBeNull();
    await escribirGolesRival("2");

    expect(contenedor.querySelector(".aviso-sin-lugar")).toBeNull();
    expect(borrador().resultado).toBe("1-2");

    // Y de verdad está a salvo: al reabrir, ahí sigue.
    await remontar();
    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();
    expect(contenedor.querySelectorAll(".resultado-marcador input")[1].value).toBe("2");
    expect(contenedor.querySelector(".aviso-sin-lugar")).toBeNull();
  });

  test("si el celular no tiene lugar para el borrador, lo avisa y el aviso queda a la vista", async () => {
    const original = Storage.prototype.setItem;
    const sinLugar = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (clave, valor) {
      if (String(clave).startsWith("registro_actual_partido")) throw new DOMException("lleno", "QuotaExceededError");
      return original.call(this, clave, valor);
    });
    await montar();

    const aviso = () => contenedor.querySelector(".aviso-sin-lugar");
    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();
    expect(aviso().textContent).toContain("No hay lugar en el celular");
    await irA("Formación");
    expect(aviso()).not.toBeNull();

    // Vuelve a haber lugar: con el próximo cambio el aviso se va.
    sinLugar.mockRestore();
    await irA("Partido");
    await escribirGolesRival("2");
    expect(aviso()).toBeNull();
    expect(borrador().resultado).toBe("1-2");
  });
});
