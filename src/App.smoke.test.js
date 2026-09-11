import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

const doblesSupabase = vi.hoisted(() => ({
  insertar: vi.fn(),
  // Con error, la app cae al respaldo local: es la forma de sembrar el
  // historial sin tener que armar filas con los nombres de columna de la base.
  errorHistorial: null,
  errorGuardado: null,
  filasHistorial: [],
  actualizar: vi.fn(),
}));

vi.mock("./supabase.js", () => ({
  supabase: {
    from: () => {
      const consulta = {
        select: () => consulta,
        order: async () => ({
          data: doblesSupabase.filasHistorial,
          error: doblesSupabase.errorHistorial,
        }),
        insert: (filas) => {
          doblesSupabase.insertar(filas);
          return {
            select: async () => ({
              data: doblesSupabase.errorGuardado ? null : [{ id: 7 }],
              error: doblesSupabase.errorGuardado,
            }),
          };
        },
        update: (fila) => {
          doblesSupabase.actualizar(fila);
          return {
            eq: () => ({
              select: async () => ({
                data: [{ id: 9, ...fila }],
                error: null,
              }),
            }),
          };
        },
        delete: () => consulta,
        eq: () => consulta,
        in: async () => ({ data: [], error: null }),
      };
      return consulta;
    },
  },
}));

// Una transmisión ya guardada: en las columnas quedan los horarios, y aparte
// una captura con la guía en minutos con la que se anotó el partido.
const filaTransmisionGuardada = () => ({
  id: 9,
  fecha: "2026-09-10",
  rival: "Santos",
  resultado: "2-1",
  modo_tiempo: "transmision",

  inicio_pt: "21:00:00",
  final_pt: "21:47:30",
  inicio_st: "22:03:00",
  final_st: "22:50:10",
  inicio_var_pt_1: "21:12:00",
  final_var_pt_1: "21:14:30",
  inicio_hid_pt: "21:25:00",
  final_hid_pt: "21:27:00",
  cambio_1_tiempo: "21:23:14",
  cambio_1_sale: "ALONSO",
  cambio_1_entra: "BERNARD",
  cambio_2_tiempo: "22:18:00",
  cambio_2_sale: "SCARPA",
  cambio_2_entra: "DUDU",
  rival_cambio_horario1: "21:35:00",
  rival_cambio_sale1: "JOAO PAULO",
  rival_cambio_entra1: "GIL",
  titulares: ["ALONSO", "SCARPA", "ARANA"],
  convocados: ["BERNARD", "DUDU"],

  captura_tiempo: {
    modoTiempo: "transmision",
    horaInicioRealPT: "21:00:00",
    horaFinalRealPT: "21:47:30",
    horaInicioRealST: "22:03:00",
    horaFinalRealST: "22:50:10",
    inicioPT: "000:00",
    finalPT: "047:30",
    inicioST: "000:00",
    finalST: "047:10",
    varsPT: [{ inicio: "012:00", final: "014:30" }],
    inicioHidratacionPT: "025:00",
    finalHidratacionPT: "027:00",
    cambios: [
      { sale: "ALONSO", entra: "BERNARD", hora: "023:14", periodo: "PT" },
      { sale: "SCARPA", entra: "DUDU", hora: "015:00", periodo: "ST" },
    ],
    cambiosRival: [
      { sale: "JOAO PAULO", entra: "GIL", hora: "035:00", periodo: "PT" },
    ],
    prorrogaActiva: false,
  },
});

describe("interfaz operativa", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 8, 21, 25, 34));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ version: "2026.08.12.1" }),
      })),
    );
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("scrollTo", vi.fn());
    doblesSupabase.insertar.mockClear();
    doblesSupabase.actualizar.mockClear();
    doblesSupabase.errorHistorial = null;
    doblesSupabase.errorGuardado = null;
    doblesSupabase.filasHistorial = [];
    localStorage.clear();
    localStorage.setItem(
      "registro_actual_partido",
      JSON.stringify({
        version: 2,
        registro: {
          fecha: "2026-09-08",
          rival: "Cruzeiro",
          resultado: "1-0",
          formacion: {
            titulares: ["ALONSO", "SCARPA"],
            convocados: ["BERNARD"],
          },
        },
      }),
    );
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  // La app arranca con la pantalla de intro; los tests la saltan avanzando el
  // reloj, que ya está congelado.
  const abrirFicha = async () => {
    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );
    await act(async () => irA("Registros").click());
    await act(async () =>
      contenedor.querySelector(".registro-guardado button").click(),
    );
  };

  const abrirInfo = async () => {
    await act(async () => contenedor.querySelector(".boton-info-ficha").click());
  };

  const elegirTiempo = async (etiqueta) => {
    const boton = Array.from(
      contenedor.querySelectorAll('.selector-periodos.en-ficha button[role="tab"]'),
    ).find((item) => item.textContent.trim().startsWith(etiqueta));
    await act(async () => boton.click());
  };

  const montarApp = async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App />);
    });
    await act(async () => Promise.resolve());
    // runOnlyPendingTimers y no advanceTimersByTime: la app tiene un reloj que
    // se reprograma cada segundo, y avanzar el tiempo lo dispara sin fin.
    await act(async () => vi.runOnlyPendingTimers());
  };

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    contenedor.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("la app abre con la pantalla del estadio y después entra", async () => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(<App />);
    });
    await act(async () => Promise.resolve());

    // Antes que nada, la intro: la foto a pantalla completa con su velo.
    const intro = contenedor.querySelector(".intro-pantalla");
    expect(intro).not.toBeNull();
    expect(intro.style.backgroundImage).toContain("i.postimg.cc");
    expect(intro.querySelector(".overlay-intro")).not.toBeNull();
    // Todavía no se ve nada de la app.
    expect(contenedor.querySelector(".navegacion-movil")).toBeNull();

    await act(async () => vi.runOnlyPendingTimers());

    // Y al ratito, la app.
    expect(contenedor.querySelector(".intro-pantalla")).toBeNull();
    expect(contenedor.querySelector(".navegacion-movil")).not.toBeNull();
  });

  test("renderiza PC y móvil y registra acciones rápidas sin perder datos", async () => {
    await montarApp();

    // Guardar el partido vive en la cabecera, no en una barra flotante.
    expect(
      contenedor.querySelector(".cabecera-tablero .boton-guardar-cabecera")
        .textContent,
    ).toContain("Guardar partido");
    expect(contenedor.querySelector(".barra-guardado")).toBeNull();
    expect(contenedor.textContent).toContain("Atlético Mineiro");

    // El marcador 1-0 deja el cero como marca de fondo, para reemplazarlo
    // escribiendo sin tener que borrarlo antes.
    const marcadorInicial = contenedor.querySelectorAll(
      ".resultado-marcador input",
    );
    expect(marcadorInicial[0].value).toBe("1");
    expect(marcadorInicial[1].value).toBe("");
    expect(marcadorInicial[1].placeholder).toBe("0");
    expect(
      contenedor.querySelectorAll(".navegacion-movil button"),
    ).toHaveLength(3);
    expect(
      contenedor.querySelectorAll(".navegacion-escritorio button"),
    ).toHaveLength(3);

    const accionPeriodo = contenedor.querySelector(".accion-periodo");
    await act(async () => accionPeriodo.click());
    expect(accionPeriodo.textContent).toContain("Finalizar PT");
    expect(
      contenedor.querySelector(".selector-periodos p").textContent,
    ).not.toContain("--:--");

    const botonVar = Array.from(
      contenedor.querySelectorAll(".acciones-rapidas button"),
    ).find((boton) => boton.textContent.includes("Iniciar VAR"));
    await act(async () => botonVar.click());
    expect(botonVar.textContent).toContain("Finalizar VAR");

    const marcador = contenedor.querySelectorAll(".resultado-marcador input");
    expect(marcador[0].value).toBe("1");
    expect(marcador[1].value).toBe("");

    const selectorHora = contenedor.querySelector(
      ".contenido-ajustes-periodo .selector-tiempo-disparador",
    );
    await act(async () => selectorHora.click());
    const opcionHora = contenedor.querySelector(
      '.contenido-ajustes-periodo [aria-label="Hora"] [data-valor="21"]',
    );
    await act(async () => opcionHora.click());

    expect(
      contenedor.querySelector(
        ".contenido-ajustes-periodo .selector-tiempo-disparador",
      ),
    ).toBe(selectorHora);
    expect(
      contenedor.querySelector(
        ".contenido-ajustes-periodo .selector-tiempo-panel",
      ),
    ).not.toBeNull();
  });

  test("muestra los cinco cambios y el botón Cambio lleva a Atlético", async () => {
    await montarApp();

    expect(contenedor.querySelectorAll(".ranura-cambio")).toHaveLength(5);

    // El manejador de "Cambio" no debe romperse: si lanza, React lo atrapa y
    // la pantalla queda igual, así que hay que escuchar el error del navegador.
    const fallos = [];
    const anotarFallo = (evento) =>
      fallos.push(evento.message || String(evento));
    window.addEventListener("error", anotarFallo);

    const botonCambio = contenedor.querySelector(
      ".acciones-rapidas .accion-cambio",
    );
    await act(async () => botonCambio.click());

    window.removeEventListener("error", anotarFallo);
    expect(fallos).toEqual([]);

    const pestanaAtletico = contenedor.querySelector(".selector-equipo button");
    expect(pestanaAtletico.getAttribute("aria-selected")).toBe("true");
    expect(contenedor.querySelectorAll(".ranura-cambio")).toHaveLength(5);
  });

  test("permite reanudar el período si se finalizó por error", async () => {
    await montarApp();

    const accionPeriodo = contenedor.querySelector(".accion-periodo");
    await act(async () => accionPeriodo.click());
    await act(async () => accionPeriodo.click());

    expect(accionPeriodo.textContent).toContain("Reanudar PT");
    expect(accionPeriodo.disabled).toBe(false);
    expect(accionPeriodo.className).toContain("finalizar");

    await act(async () => accionPeriodo.click());

    expect(accionPeriodo.textContent).toContain("Finalizar PT");
    expect(
      contenedor.querySelector(".selector-periodos p").textContent,
    ).toContain("en curso");
  });

  test("ir a Registros y volver a Formación no inventa un partido", async () => {
    localStorage.removeItem("registro_actual_partido");

    await montarApp();

    const destinos = () =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).map(
        (boton) => boton.textContent.trim(),
      );
    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );

    expect(destinos()).toEqual(["Formación", "Registros"]);

    await act(async () => irA("Registros").click());
    await act(async () => irA("Formación").click());

    expect(destinos()).toEqual(["Formación", "Registros"]);
    expect(contenedor.textContent).not.toContain("Volver al partido");
  });

  test("Limpiar confirma en una hoja propia, no en el confirm del navegador", async () => {
    const confirmNativo = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmNativo);

    await montarApp();

    const limpiar = contenedor.querySelector(".boton-limpiar-cabecera");
    const hoja = () => contenedor.querySelector(".hoja-confirmar");
    const rival = () =>
      contenedor.querySelector(".equipo-visitante strong").textContent;

    expect(hoja()).toBeNull();

    await act(async () => limpiar.click());

    expect(hoja()).not.toBeNull();
    expect(confirmNativo).not.toHaveBeenCalled();
    expect(contenedor.querySelector(".detalle-hoja").textContent).toContain(
      "Cruzeiro",
    );

    // Cancelar cierra la hoja sin tocar el partido.
    await act(async () => contenedor.querySelector(".boton-cancelar-hoja").click());

    expect(hoja()).toBeNull();
    expect(rival()).toBe("Cruzeiro");

    // Confirmar sí lo borra y deja de haber partido en curso.
    await act(async () => limpiar.click());
    await act(async () =>
      contenedor.querySelector(".boton-confirmar-hoja").click(),
    );

    expect(hoja()).toBeNull();
    expect(
      contenedor.querySelectorAll(".navegacion-movil button"),
    ).toHaveLength(2);
  });

  test("la pantalla principal muestra el enfrentamiento y lleva al partido", async () => {
    await montarApp();

    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );

    await act(async () => irA("Formación").click());

    // Los dos clubes, con la fecha en texto y no en formato de máquina.
    const lados = contenedor.querySelectorAll(".lado-enfrentamiento strong");
    expect(lados).toHaveLength(2);
    expect(lados[0].textContent).toContain("Atlético");
    expect(lados[1].textContent).toBe("Cruzeiro");
    expect(contenedor.querySelector(".fecha-hero").textContent).toContain(
      "septiembre",
    );

    // Sin escudo remoto todavía, quedan los dibujados: nunca un hueco vacío.
    expect(
      contenedor.querySelectorAll(".lado-enfrentamiento svg").length,
    ).toBe(2);

    // La tarjeta del partido en curso copia la estética de un registro: el
    // enfrentamiento con los dos escudos y el rival, no una línea de texto.
    const enCurso = contenedor.querySelector(".tarjeta-en-curso");
    const cruce = enCurso.querySelector(".enfrentamiento-registro");
    expect(cruce.textContent).toContain("Atlético Mineiro");
    expect(cruce.textContent).toContain("Cruzeiro");
    expect(
      cruce.querySelectorAll(".escudo-cam, .escudo-rival, .escudo-club"),
    ).toHaveLength(2);
    // Sin período arrancado no se anuncia nada en vivo.
    expect(enCurso.querySelector(".pastilla-vivo").textContent.trim()).toBe(
      "SIN EMPEZAR",
    );
    expect(contenedor.querySelector(".bloque-version-app")).not.toBeNull();

    await act(async () => enCurso.click());
    expect(contenedor.querySelector(".tablero-partido")).not.toBeNull();
  });

  test("sin rival cargado la pantalla principal no queda rota", async () => {
    localStorage.removeItem("registro_actual_partido");

    await montarApp();

    expect(contenedor.querySelector(".tarjeta-en-curso")).toBeNull();
    expect(
      contenedor.querySelectorAll(".lado-enfrentamiento strong")[1].textContent,
    ).toBe("Elegí el rival");
    // El pie del escudo aparece recién cuando hay algo que informar.
    expect(contenedor.querySelector(".pie-escudo")).toBeNull();
    expect(contenedor.querySelector("#campo-rival-inicio").value).toBe("");
  });

  test("los escudos aparecen en el marcador y en la lista de registros", async () => {
    doblesSupabase.errorHistorial = { message: "sin conexión en la prueba" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(
      "backup_registros_partidos",
      JSON.stringify([
        { fecha: "2026-09-01", rival: "Flamengo", resultado: "2-2" },
      ]),
    );

    await montarApp();

    // Marcador: los dos clubes tienen escudo, sea real o dibujado.
    const marcador = contenedor.querySelectorAll(".equipo-marcador");
    expect(marcador).toHaveLength(2);
    marcador.forEach((equipo) =>
      expect(
        equipo.querySelector(".escudo-cam, .escudo-rival, .escudo-club"),
      ).not.toBeNull(),
    );

    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );
    await act(async () => irA("Registros").click());

    // Lista de registros: la fila de afuera también los trae.
    const fila = contenedor.querySelector(".enfrentamiento-registro");
    expect(fila).not.toBeNull();
    expect(
      fila.querySelectorAll(".escudo-cam, .escudo-rival, .escudo-club"),
    ).toHaveLength(2);
    expect(fila.textContent).toContain("Flamengo");
  });

  test("el nombre se elige al levantar el dedo, no al apoyarlo", async () => {
    await montarApp();

    const campoSale = contenedor.querySelector(
      ".ranura-cambio .selector-nombre.sale input",
    );
    await act(async () => campoSale.focus());

    const opcion = contenedor.querySelector(".selector-nombre-opcion");
    expect(opcion).not.toBeNull();
    const nombre = opcion.textContent.trim();

    // Apoyar el dedo no puede elegir ni cerrar la lista: si se cerrara acá, el
    // click que el navegador manda al levantar caería en el control de abajo.
    await act(async () =>
      opcion.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })),
    );

    expect(campoSale.value).toBe("");
    expect(contenedor.querySelector(".selector-nombre-lista")).not.toBeNull();

    // Recién al levantarlo se elige.
    await act(async () =>
      opcion.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );

    expect(campoSale.value).toBe(nombre);
    expect(contenedor.querySelector(".selector-nombre-lista")).toBeNull();
  });

  test("el desplegable ofrece primero a los que pueden salir y entrar", async () => {
    await montarApp();

    const abrir = async (campo) => {
      const entrada = contenedor.querySelector(
        `.ranura-cambio .selector-nombre.${campo} input`,
      );
      await act(async () => entrada.focus());

      // Buscar dentro del campo: la lista del otro sigue abierta, porque solo
      // se cierra al tocar afuera.
      const propio = entrada.closest(".selector-nombre");
      return {
        titulo: propio
          .querySelector(".titulo-grupo-nombres")
          ?.textContent.trim(),
        primera: propio
          .querySelector(".selector-nombre-opcion")
          ?.textContent.trim(),
      };
    };

    // El borrador tiene a ALONSO y SCARPA de titulares y BERNARD convocado.
    const sale = await abrir("sale");
    expect(sale.titulo).toBe("En cancha");
    expect(sale.primera).toBe("ALONSO");

    const entra = await abrir("entra");
    expect(entra.titulo).toBe("En el banco");
    expect(entra.primera).toBe("BERNARD");
  });

  test("borrar registros confirma en la hoja, no en el confirm del navegador", async () => {
    doblesSupabase.errorHistorial = { message: "sin conexión en la prueba" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem(
      "backup_registros_partidos",
      JSON.stringify([
        { fecha: "2026-09-01", rival: "Flamengo", resultado: "2-2" },
        { fecha: "2026-08-24", rival: "Palmeiras", resultado: "0-1" },
      ]),
    );

    const confirmNativo = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmNativo);

    await montarApp();

    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );
    await act(async () => irA("Registros").click());

    const filas = () => contenedor.querySelectorAll(".registro-guardado");
    expect(filas()).toHaveLength(2);

    const borrarTodo = Array.from(
      contenedor.querySelectorAll("button"),
    ).find((boton) => boton.textContent.includes("Borrar historial"));

    await act(async () => borrarTodo.click());

    const hoja = contenedor.querySelector(".hoja-confirmar");
    expect(hoja).not.toBeNull();
    expect(confirmNativo).not.toHaveBeenCalled();
    expect(hoja.querySelector("h3").textContent).toContain(
      "¿Borrar todos los registros?",
    );
    // El detalle dice cuántos se van, para no borrar de más sin querer.
    expect(hoja.querySelector(".detalle-hoja").textContent).toContain(
      "2 partidos guardados",
    );

    // Cancelar no borra nada.
    await act(async () =>
      contenedor.querySelector(".boton-cancelar-hoja").click(),
    );
    expect(contenedor.querySelector(".hoja-confirmar")).toBeNull();
    expect(filas()).toHaveLength(2);
  });

  test("la pantalla de formación es una planilla, no una lista de etiquetas", async () => {
    localStorage.removeItem("registro_actual_partido");

    await montarApp();

    const ingresar = Array.from(contenedor.querySelectorAll("button")).find(
      (boton) => boton.textContent.includes("Ingresar Formación"),
    );
    await act(async () => ingresar.click());

    // Dos grupos: titulares y convocados, cada uno con su contador.
    const grillas = contenedor.querySelectorAll(".grilla-plantel");
    expect(grillas).toHaveLength(2);
    expect(grillas[0].querySelectorAll(".fila-plantel")).toHaveLength(10);
    // El banco arranca con diez lugares; los que falten se agregan a mano.
    expect(grillas[1].querySelectorAll(".fila-plantel")).toHaveLength(10);

    const contadores = contenedor.querySelectorAll(".contador-plantel");
    expect(contadores[0].textContent).toBe("0/10");
    expect(contadores[0].className).not.toContain("completo");

    // El número va adentro del campo: una línea por jugador, sin etiqueta aparte.
    const fila = grillas[0].querySelector(".fila-plantel");
    expect(fila.querySelector(".numero-plantel").textContent).toBe("1");
    expect(fila.querySelector("label")).toBeNull();

    // Los títulos son texto, no los botones verdes que parecían tocables.
    const titulo = contenedor.querySelector(".titulo-plantel h2");
    expect(titulo.textContent).toBe("Titulares de campo");
    expect(titulo.tagName).toBe("H2");

    // Al completar los diez, el contador lo celebra.
    const campos = grillas[0].querySelectorAll(".input-jugador");
    await act(async () => {
      campos.forEach((campo, i) => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        ).set;
        setter.call(campo, `JUGADOR ${i + 1}`);
        campo.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });

    const contadorFinal = contenedor.querySelectorAll(".contador-plantel")[0];
    expect(contadorFinal.textContent).toBe("10/10");
    expect(contadorFinal.className).toContain("completo");
  });

  test("un borrador viejo con doce lugares de banco se recorta sin perder nombres", async () => {
    const conBanco = (convocados) => {
      localStorage.setItem(
        "registro_actual_partido",
        JSON.stringify({
          version: 2,
          registro: {
            fecha: "2026-09-08",
            rival: "Cruzeiro",
            formacion: {
              titulares: Array.from({ length: 10 }, () => ""),
              convocados,
            },
          },
        }),
      );
    };

    const lugaresDelBanco = async () => {
      await montarApp();

      // Con algún nombre cargado la app abre en el partido, no en Formación.
      const irAFormacion = Array.from(
        contenedor.querySelectorAll(".navegacion-movil button"),
      ).find((boton) => boton.textContent.includes("Formación"));
      await act(async () => irAFormacion.click());

      const ingresar = Array.from(contenedor.querySelectorAll("button")).find(
        (boton) => boton.textContent.includes("Ingresar Formación"),
      );
      await act(async () => ingresar.click());
      const banco = contenedor.querySelectorAll(".grilla-plantel")[1];
      return Array.from(banco.querySelectorAll(".input-jugador")).map(
        (campo) => campo.value,
      );
    };

    // Doce vacíos: se recortan a diez.
    conBanco(Array.from({ length: 12 }, () => ""));
    expect(await lugaresDelBanco()).toHaveLength(10);

    await act(async () => raiz.unmount());
    raiz = null;
    contenedor.innerHTML = "";

    // Doce con el último cargado: no se puede recortar nada sin perderlo.
    conBanco([...Array.from({ length: 11 }, () => ""), "LEMOS"]);
    const conNombre = await lugaresDelBanco();
    expect(conNombre).toHaveLength(12);
    expect(conNombre[11]).toBe("LEMOS");
  });

  test("si la base falla, el partido no se pierde y el cartel se va solo", async () => {
    doblesSupabase.errorGuardado = { message: "la base dijo que no" };
    vi.spyOn(console, "error").mockImplementation(() => {});

    await montarApp();

    const guardar = Array.from(contenedor.querySelectorAll("button")).find(
      (boton) => boton.textContent.includes("Guardar partido"),
    );
    await act(async () => {
      guardar.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const cartel = contenedor.querySelector(".notificacion-guardado");
    expect(cartel.textContent).toContain("sin sincronizar");

    // El partido queda guardado en el celular, no se pierde.
    expect(
      JSON.parse(localStorage.getItem("registros_sin_sincronizar")),
    ).toHaveLength(1);

    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );
    await act(async () => irA("Registros").click());

    // Y se ve en la lista, marcado.
    expect(contenedor.querySelectorAll(".registro-guardado")).toHaveLength(1);
    expect(
      contenedor.querySelector(".marca-sin-sincronizar").textContent,
    ).toContain("Sin sincronizar");

    // El cartel se borra solo: antes se quedaba pegado para siempre.
    await act(async () => vi.runOnlyPendingTimers());
    expect(contenedor.querySelector(".notificacion-guardado")).toBeNull();
  });

  test("una respuesta vacía de la base no borra el historial del celular", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(
      "backup_registros_partidos",
      JSON.stringify({
        version: 2,
        registros: [
          { fecha: "2026-09-01", rival: "Flamengo", resultado: "2-2" },
          { fecha: "2026-08-24", rival: "Palmeiras", resultado: "0-1" },
        ],
      }),
    );

    // La base contesta bien, pero sin ningún partido: puede ser un permiso o
    // una tabla que cambió. Antes eso pisaba el respaldo y se perdía todo.
    await montarApp();

    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );
    await act(async () => irA("Registros").click());

    expect(contenedor.querySelectorAll(".registro-guardado")).toHaveLength(2);
    expect(contenedor.textContent).toContain("Flamengo");

    // Y sobre todo: el respaldo del celular sigue entero.
    const respaldo = JSON.parse(
      localStorage.getItem("backup_registros_partidos"),
    );
    expect(respaldo.registros).toHaveLength(2);
  });

  test("cuando la base vuelve, sube sola lo que había quedado pendiente", async () => {
    doblesSupabase.filasHistorial = [
      { id: 1, fecha: "2026-09-01", rival: "Flamengo", resultado: "2-2" },
    ];
    localStorage.setItem(
      "registros_sin_sincronizar",
      JSON.stringify([
        {
          fecha: "2026-09-10",
          rival: "Santos",
          resultado: "2-1",
          sinSincronizar: true,
        },
      ]),
    );

    await montarApp();

    // El partido que había quedado en el celular se sube solo.
    expect(doblesSupabase.insertar).toHaveBeenCalledTimes(1);
    expect(doblesSupabase.insertar.mock.calls[0][0][0].rival).toBe("Santos");

    // Y deja de estar pendiente.
    expect(
      JSON.parse(localStorage.getItem("registros_sin_sincronizar")),
    ).toHaveLength(0);
  });

  test("en transmisión se guardan horarios reales, no minutos de juego", async () => {
    // El partido se anota en minutos de juego, pero lo que tiene que quedar
    // guardado son horarios, calculados desde la hora en que arrancó cada
    // período. Es la regla de siempre y conviene que un test la sostenga.
    localStorage.setItem(
      "registro_actual_partido",
      JSON.stringify({
        version: 2,
        registro: {
          fecha: "2026-09-10",
          rival: "Santos",
          resultado: "2-1",
          modoTiempo: "transmision",

          horaInicioRealPT: "21:00:00",
          inicioPT: "000:00",
          finalPT: "047:30",

          horaInicioRealST: "22:03:00",
          inicioST: "000:00",
          finalST: "047:10",

          varsPT: [{ inicio: "012:00", final: "014:30" }],
          inicioHidratacionPT: "025:00",
          finalHidratacionPT: "027:00",

          cambios: [
            { sale: "ALONSO", entra: "BERNARD", hora: "023:14", periodo: "PT" },
            { sale: "SCARPA", entra: "DUDU", hora: "015:00", periodo: "ST" },
          ],
          formacion: {
            titulares: ["ALONSO", "SCARPA"],
            convocados: ["BERNARD", "DUDU"],
          },
        },
      }),
    );

    await montarApp();

    const guardar = Array.from(contenedor.querySelectorAll("button")).find(
      (boton) => boton.textContent.includes("Guardar partido"),
    );
    await act(async () => {
      guardar.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const fila = doblesSupabase.insertar.mock.calls[0][0][0];

    // Cada uno es la hora de arranque de su período más lo transcurrido.
    expect(fila.inicio_pt).toBe("21:00:00");
    expect(fila.final_pt).toBe("21:47:30");
    expect(fila.inicio_st).toBe("22:03:00");
    expect(fila.final_st).toBe("22:50:10");
    expect(fila.inicio_var_pt_1).toBe("21:12:00");
    expect(fila.final_var_pt_1).toBe("21:14:30");
    expect(fila.inicio_hid_pt).toBe("21:25:00");
    expect(fila.final_hid_pt).toBe("21:27:00");
    expect(fila.cambio_1_tiempo).toBe("21:23:14");
    expect(fila.cambio_2_tiempo).toBe("22:18:00");

    // Y que no se escape ninguno en formato de minutos.
    const enMinutos = Object.entries(fila).filter(([, valor]) =>
      /^\d{3}:\d{2}$/.test(String(valor || "")),
    );
    expect(enMinutos).toEqual([]);

    // El modo queda anotado, para saber cómo se cargó.
    expect(fila.modo_tiempo).toBe("transmision");
  });

  test("el registro guardado de una transmisión se lee en horarios", async () => {
    // La fila guarda además una captura con la guía en minutos, para no perder
    // el período de cada cambio. Esa captura no tiene que volver a la pantalla:
    // al abrir el registro hay que ver el horario, no el minuto de juego.
    doblesSupabase.filasHistorial = [filaTransmisionGuardada()];

    await montarApp();

    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );
    await act(async () => irA("Registros").click());

    const detalle = contenedor.querySelector(".registro-guardado button");
    await act(async () => detalle.click());

    // La ficha muestra un tiempo por vez, así que se revisan los dos.
    // Se miran los valores uno por uno y no el texto entero: dos horarios
    // pegados forman por casualidad algo con pinta de guía.
    const sinGuias = () => {
      const horas = Array.from(
        contenedor.querySelectorAll(".corte .hora-corte"),
      ).map((celda) => celda.textContent.trim());
      expect(horas.length).toBeGreaterThan(0);
      horas.forEach((hora) => expect(hora).toMatch(/^\d{2}:\d{2}:\d{2}$/));
    };

    await elegirTiempo("PT");
    const enPT = contenedor.textContent;
    for (const horario of [
      "21:00:00",
      "21:12:00",
      "21:14:30",
      "21:23:14",
      "21:25:00",
      "21:27:00",
      "21:47:30",
    ]) {
      expect(enPT).toContain(horario);
    }
    expect(enPT).toContain("47:30");
    sinGuias();

    await elegirTiempo("ST");

    const enST = contenedor.textContent;
    for (const horario of ["22:03:00", "22:18:00", "22:50:10"]) {
      expect(enST).toContain(horario);
    }
    expect(enST).toContain("47:10");
    sinGuias();
  });

  test("una corrección a mano sobre un horario guardado no se pisa", async () => {
    // Al editar un registro de transmisión los campos ya vienen en horario. Si
    // la conversión los recalculara igual desde la referencia de arranque, la
    // corrección se perdería sin aviso.
    doblesSupabase.filasHistorial = [filaTransmisionGuardada()];

    await montarApp();

    const irA = (etiqueta) =>
      Array.from(contenedor.querySelectorAll(".navegacion-movil button")).find(
        (boton) => boton.textContent.includes(etiqueta),
      );
    await act(async () => irA("Registros").click());
    await act(async () => contenedor.querySelector(".registro-guardado button").click());

    const boton = (etiqueta) =>
      Array.from(contenedor.querySelectorAll("button")).find((item) =>
        item.textContent.includes(etiqueta),
      );
    await act(async () => boton("Editar registro").click());

    const campoFinalPT = Array.from(
      contenedor.querySelectorAll(".campo-detalle-editable"),
    ).find((campo) => campo.querySelector("label")?.textContent === "Final PT");

    // Se edita como hora real, no como guía en minutos.
    const entrada = campoFinalPT.querySelector("input");
    expect(entrada.type).toBe("time");
    expect(entrada.value).toBe("21:47:30");

    const escribir = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    await act(async () => {
      escribir.call(entrada, "21:48:00");
      entrada.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      boton("Guardar cambios").click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const fila = doblesSupabase.actualizar.mock.calls[0][0];

    // La corrección llega tal cual, y el resto sigue en horario.
    expect(fila.final_pt).toBe("21:48:00");
    expect(fila.inicio_pt).toBe("21:00:00");
    expect(fila.inicio_st).toBe("22:03:00");
    expect(fila.final_st).toBe("22:50:10");
    expect(fila.cambio_1_tiempo).toBe("21:23:14");
  });

  test("el botón de bruto/neto cambia todos los números a la vez", async () => {
    doblesSupabase.filasHistorial = [filaTransmisionGuardada()];

    await montarApp();
    await abrirFicha();

    const valores = () =>
      Array.from(
        contenedor.querySelectorAll(
          ".total-ficha b, .cabeza-ficha em, .valor-jugado",
        ),
      ).map((celda) => celda.textContent.trim());

    // Arranca mostrando todo el partido: el total arriba y el de la tarjeta.
    expect(valores()).toEqual(["94:40", "94:40"]);

    const interruptor = contenedor.querySelector(".boton-modo-ficha");
    expect(interruptor.textContent).toContain("Bruto");
    await act(async () => interruptor.click());

    expect(contenedor.querySelector(".boton-modo-ficha").textContent).toContain(
      "Neto",
    );
    expect(valores()).toEqual(["90:10", "90:10"]);

    // Y lo mismo adentro de Info, donde está lo que jugó cada uno: a cada uno
    // se le descuenta solo lo que se detuvo con él adentro, así que DUDU, que
    // entró en el segundo tiempo, no cambia.
    await abrirInfo();
    expect(valores()).toEqual([
      "90:10",
      "20:44",
      "69:26",
      "58:00",
      "32:10",
    ]);

    await act(async () => contenedor.querySelector(".boton-modo-ficha").click());
    expect(valores()).toEqual([
      "94:40",
      "23:14",
      "71:26",
      "62:30",
      "32:10",
    ]);
  });

  test("el interruptor del rival cambia los cambios y deja los hitos", async () => {
    doblesSupabase.filasHistorial = [filaTransmisionGuardada()];

    await montarApp();
    await abrirFicha();
    await elegirTiempo("PT");

    const horarios = () =>
      Array.from(contenedor.querySelectorAll(".corte .hora-corte")).map((h) =>
        h.textContent.trim(),
      );

    // Con los nuestros: el cambio del PT está en su horario.
    expect(horarios()).toEqual([
      "21:00:00",
      "21:12:00",
      "21:23:14",
      "21:25:00",
      "21:47:30",
    ]);
    expect(contenedor.textContent).not.toContain("JOAO PAULO");

    await act(async () => contenedor.querySelector(".boton-rival-ficha").click());

    // Arranque, VAR, hidratación y final son del partido y no se mueven; el
    // cambio pasa a ser el del rival, en su propio horario.
    expect(horarios()).toEqual([
      "21:00:00",
      "21:12:00",
      "21:25:00",
      "21:35:00",
      "21:47:30",
    ]);
    // La tabla de tiempo jugado es nuestra y no se toca, así que se mira solo
    // la línea de tiempo.
    const linea = contenedor.querySelector(".tarjeta-ficha").textContent;
    expect(linea).toContain("JOAO PAULO");
    expect(linea).toContain("Inicio PT");
    expect(linea).not.toContain("BERNARD");

    // Y el escudo del rival avisa de quién es lo que se está mirando.
    expect(contenedor.querySelector(".marca-rival")).toBeTruthy();
  });

  test("en el total, el descanso separa un tiempo del otro", async () => {
    doblesSupabase.filasHistorial = [filaTransmisionGuardada()];

    await montarApp();
    await abrirFicha();

    // Va una sola vez, justo entre el final del primero y el inicio del segundo.
    const descansos = contenedor.querySelectorAll(".descanso");
    expect(descansos).toHaveLength(1);
    expect(descansos[0].textContent.trim()).toBe("DESCANSO");

    const filas = Array.from(contenedor.querySelectorAll(".cortes > *")).map(
      (fila) =>
        fila.className.includes("descanso")
          ? "DESCANSO"
          : fila.querySelector(".hora-corte").textContent.trim(),
    );
    // Justo después del final del primero y antes del arranque del segundo.
    const corte = filas.indexOf("DESCANSO");
    expect(filas[corte - 1]).toBe("21:47:30");
    expect(filas[corte + 1]).toBe("22:03:00");

    // Mirando un solo tiempo no hay nada que separar.
    await elegirTiempo("PT");
    expect(contenedor.querySelectorAll(".descanso")).toHaveLength(0);
  });

  test("en un cambio los jugadores van al lado del horario", async () => {
    const fila = filaTransmisionGuardada();
    fila.cambio_3_tiempo = "22:18:00";
    fila.cambio_3_sale = "ARANA";
    fila.cambio_3_entra = "HULK";
    fila.captura_tiempo.cambios.push({
      sale: "ARANA",
      entra: "HULK",
      hora: "015:00",
      periodo: "ST",
    });
    doblesSupabase.filasHistorial = [fila];

    await montarApp();
    await abrirFicha();
    await elegirTiempo("ST");

    const cambio = contenedor.querySelector(".corte-cambio");

    // Un solo horario, y los dos cambios apilados a su derecha.
    expect(cambio.querySelectorAll(".hora-corte")).toHaveLength(1);
    expect(cambio.querySelectorAll(".par-corte")).toHaveLength(2);

    // El horario es hijo directo del corte, como en los demás: así todos
    // quedan en la misma columna.
    expect(cambio.firstElementChild.className).toContain("hora-corte");
  });

  test("el tiempo jugado sigue al tiempo elegido", async () => {
    doblesSupabase.filasHistorial = [filaTransmisionGuardada()];

    await montarApp();
    await abrirFicha();
    await abrirInfo();

    // El nombre viene con la flecha del cambio adelante, que acá no interesa.
    const tabla = () =>
      Array.from(contenedor.querySelectorAll(".fila-jugado")).map((fila) => [
        fila.querySelector(".quien-jugado").textContent.replace(/^[↓↑]\s*/, "").trim(),
        fila.querySelector(".valor-jugado").textContent.trim(),
      ]);

    // En el total, lo que jugó cada uno en todo el partido. Los que nunca
    // salieron viven en Info. General, no acá.
    expect(tabla()).toEqual([
      ["ALONSO", "23:14"],
      ["BERNARD", "71:26"],
      ["SCARPA", "62:30"],
      ["DUDU", "32:10"],
    ]);

    await elegirTiempo("PT");

    // En el primero, solo lo de ese tiempo. DUDU entró en el segundo, así que
    // no pisó la cancha acá y desaparece de la lista.
    // Solo el cambio del primer tiempo: el de SCARPA fue en el segundo.
    expect(tabla()).toEqual([
      ["ALONSO", "23:14"],
      ["BERNARD", "24:16"],
    ]);

    await elegirTiempo("ST");

    expect(tabla()).toEqual([
      ["SCARPA", "15:00"],
      ["DUDU", "32:10"],
    ]);
  });

  test("en tiempo jugado, un horario por cambio y los jugadores al lado", async () => {
    const fila = filaTransmisionGuardada();
    fila.cambio_3_tiempo = "22:18:00";
    fila.cambio_3_sale = "ARANA";
    fila.cambio_3_entra = "HULK";
    fila.captura_tiempo.cambios.push({
      sale: "ARANA",
      entra: "HULK",
      hora: "015:00",
      periodo: "ST",
    });
    doblesSupabase.filasHistorial = [fila];

    await montarApp();
    await abrirFicha();
    await abrirInfo();

    const grupos = Array.from(contenedor.querySelectorAll(".jugado")).map(
      (grupo) => [
        grupo.querySelector(".hora-corte").textContent.trim(),
        Array.from(grupo.querySelectorAll(".quien-jugado")).map((quien) =>
          quien.textContent.trim(),
        ),
      ],
    );

    // Los cuatro del doble cambio comparten un solo horario, como en la línea.
    expect(grupos).toEqual([
      ["21:23:14", ["↓ ALONSO", "↑ BERNARD"]],
      ["22:18:00", ["↓ SCARPA", "↑ DUDU", "↓ ARANA", "↑ HULK"]],
    ]);

    // Y el horario vive en la misma columna que en la línea de tiempo.
    const primero = contenedor.querySelector(".jugado");
    expect(primero.firstElementChild.className).toContain("hora-corte");
  });

  test("al que entra y más tarde sale se le muestran las dos puntas", async () => {
    const fila = filaTransmisionGuardada();
    fila.cambio_2_sale = "BERNARD";
    fila.captura_tiempo.cambios[1].sale = "BERNARD";
    doblesSupabase.filasHistorial = [fila];

    await montarApp();
    await abrirFicha();
    await abrirInfo();

    const bernard = Array.from(contenedor.querySelectorAll(".fila-jugado")).find(
      (fila2) => fila2.textContent.includes("BERNARD"),
    );

    // Va agrupado bajo el horario en que entró, con su salida al costado.
    expect(bernard.querySelector(".quien-jugado").textContent.trim()).toBe(
      "↑ BERNARD",
    );
    expect(bernard.querySelector(".hasta-jugado").textContent.trim()).toBe(
      "↓ 22:18:00",
    );
  });

  test("con el rival prendido, el tiempo jugado es el de sus jugadores", async () => {
    doblesSupabase.filasHistorial = [filaTransmisionGuardada()];

    await montarApp();
    await abrirFicha();
    await abrirInfo();
    await act(async () => contenedor.querySelector(".boton-rival-ficha").click());

    const nombres = Array.from(
      contenedor.querySelectorAll(".quien-jugado"),
    ).map((celda) => celda.textContent.replace(/^[↓↑]\s*/, "").trim());

    expect(nombres).toEqual(["JOAO PAULO", "GIL"]);
    expect(nombres).not.toContain("ALONSO");

    // De ellos no se guarda la formación: no va nada nuestro en esa pantalla.
    expect(contenedor.querySelector(".grupo-plantel")).toBeNull();
    expect(contenedor.textContent).not.toContain("NUESTRO PLANTEL");
    expect(
      Array.from(
        contenedor.querySelectorAll(".tarjeta-ficha .cabeza-ficha b"),
      ).map((titulo) => titulo.textContent.trim()),
    ).toEqual(["Tiempo jugado"]);

    // Y al apagar el rival vuelve el plantel nuestro.
    await act(async () => contenedor.querySelector(".boton-rival-ficha").click());
    expect(contenedor.querySelector(".grupo-plantel")).toBeTruthy();
  });

  test("Info. General reparte el plantel y saca el resto de tiempo jugado", async () => {
    const fila = filaTransmisionGuardada();
    fila.convocados = ["BERNARD", "DUDU", "IGOR"];
    fila.captura_tiempo.convocados = fila.convocados;
    doblesSupabase.filasHistorial = [fila];

    await montarApp();
    await abrirFicha();

    // En la vista de tiempo solo está la línea: ni el plantel ni lo jugado.
    expect(contenedor.querySelector(".grupo-plantel")).toBeNull();
    expect(contenedor.querySelector(".fila-jugado")).toBeNull();
    expect(contenedor.textContent).not.toContain("partido completo");

    const info = Array.from(
      contenedor.querySelectorAll(".interruptores button"),
    ).find((boton) => boton.textContent.includes("Info"));
    await act(async () => info.click());

    const grupos = Array.from(contenedor.querySelectorAll(".grupo-plantel")).map(
      (grupo) => [
        grupo.querySelector("b").textContent.trim(),
        Array.from(grupo.querySelectorAll(".chip-plantel")).map((chip) =>
          chip.textContent.trim(),
        ),
      ],
    );

    // Sin los del banco, que no se piden: titulares, los que jugaron enteros
    // y los que se quedaron sin entrar.
    expect(grupos).toEqual([
      ["Titulares", ["1ALONSO", "2SCARPA", "3ARANA"]],
      // ALONSO y SCARPA salieron; ARANA jugó de principio a fin.
      ["Nunca salieron", ["ARANA"]],
      // IGOR se quedó en el banco: es el único que no llegó a entrar.
      ["No ingresaron", ["IGOR"]],
    ]);

    // Y al lado de los que nunca salieron va lo que duró el partido.
    const nunca = contenedor.querySelectorAll(".grupo-plantel")[1];
    expect(nunca.querySelector("em").textContent.trim()).toBe("94:40");

    // Es su propia pantalla: la línea de tiempo deja lugar y quedan el tiempo
    // jugado y el plantel.
    const titulos = () =>
      Array.from(
        contenedor.querySelectorAll(".tarjeta-ficha .cabeza-ficha b"),
      ).map((titulo) => titulo.textContent.trim());

    expect(titulos()).toEqual(["Tiempo jugado", "Info. General"]);

    // Pero las opciones siguen todas ahí: el tiempo elegido acota lo jugado.
    expect(
      contenedor.querySelectorAll(".selector-periodos.en-ficha"),
    ).toHaveLength(2);
    expect(
      Array.from(contenedor.querySelectorAll(".interruptores button")).map(
        (boton) => boton.textContent.trim().replace("Info. GeneralInfo", "Info"),
      ),
    ).toEqual(["SRival", "Bruto", "Cambios", "Info"]);

    // Y al apagarlo vuelve la línea de tiempo.
    await act(async () => contenedor.querySelector(".boton-info-ficha").click());
    expect(titulos()).toEqual(["Todo el partido"]);
  });

  test("el interruptor de cambios sube esa tarjeta arriba de la línea", async () => {
    doblesSupabase.filasHistorial = [filaTransmisionGuardada()];

    await montarApp();
    await abrirFicha();

    const titulos = () =>
      Array.from(contenedor.querySelectorAll(".tarjeta-ficha")).map((tarjeta) =>
        tarjeta.querySelector(".cabeza-ficha b")?.textContent.trim(),
      );

    // Apagado no hay tarjeta de cambios: repetiría lo que ya está en la línea.
    expect(titulos()).toEqual(["Todo el partido"]);

    const interruptor = Array.from(
      contenedor.querySelectorAll(".interruptores button"),
    ).find((boton) => boton.textContent.includes("Cambios"));
    await act(async () => interruptor.click());

    expect(titulos()).toEqual(["Todos los cambios", "Todo el partido"]);
  });

  test("dos cambios en el mismo horario comparten el corte", async () => {
    const fila = filaTransmisionGuardada();
    fila.cambio_3_tiempo = "22:18:00";
    fila.cambio_3_sale = "ARANA";
    fila.cambio_3_entra = "HULK";
    fila.captura_tiempo.cambios.push({
      sale: "ARANA",
      entra: "HULK",
      hora: "015:00",
      periodo: "ST",
    });
    doblesSupabase.filasHistorial = [fila];

    await montarApp();
    await abrirFicha();

    const irAlST = Array.from(
      contenedor.querySelectorAll('.selector-periodos.en-ficha button[role="tab"]'),
    ).find((boton) => boton.textContent.trim().startsWith("ST"));
    await act(async () => irAlST.click());

    const cortes = contenedor.querySelectorAll(".corte-cambio");
    expect(cortes).toHaveLength(1);

    // Un solo horario arriba de los dos cambios.
    expect(cortes[0].querySelectorAll(".hora-corte")).toHaveLength(1);

    // Y cada cambio en su renglón, con el que sale y el que entra juntos.
    const renglones = cortes[0].querySelectorAll(".par-corte");
    expect(renglones).toHaveLength(2);
    renglones.forEach((renglon) => {
      expect(renglon.querySelectorAll(".sale-corte")).toHaveLength(1);
      expect(renglon.querySelectorAll(".entra-corte")).toHaveLength(1);
    });
    expect(renglones[0].textContent).toBe("↓ SCARPA↑ DUDU");
    expect(renglones[1].textContent).toBe("↓ ARANA↑ HULK");
  });

  test("bloquea el doble guardado y confirma la sincronización", async () => {
    await montarApp();

    const guardar = Array.from(contenedor.querySelectorAll("button")).find(
      (boton) => boton.textContent.includes("Guardar partido"),
    );

    await act(async () => {
      guardar.click();
      guardar.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(doblesSupabase.insertar).toHaveBeenCalledTimes(1);
    expect(contenedor.textContent).toContain("Partido guardado con éxito");
  });
});
