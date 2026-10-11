import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ReportesLesiones from "./ReportesLesiones.jsx";
import { CAMPOS, etiquetaDeCampo, etiquetaDeGrupo, etiquetaDeOpcion } from "./domain/lesionesCampos.js";
import { tonosDeGrupos } from "./components/TablaDatos.jsx";
import { crearMapa } from "./domain/mapaCorporal.js";
import { fijarIdiomaParaPruebas } from "./idioma/index.js";

// El escudo se busca por internet: acá, uno quieto.
vi.mock("./components/ClubCrest", () => ({ EscudoDeClub: () => <span className="escudo-club" /> }));

// Los períodos guardados de Lesiones c/1000h: en memoria.
const periodosGuardados = vi.hoisted(() => ({ lista: [], guardados: [] }));
vi.mock("./domain/periodosDb.js", () => ({
  listarPeriodos: async () => ({ periodos: [...periodosGuardados.lista], error: "" }),
  guardarPeriodo: async (equipoId, periodo) => {
    periodosGuardados.guardados.push({ equipoId, ...periodo });
    return { periodo: { id: `p-${periodosGuardados.guardados.length}`, nombre: periodo.nombre.trim(), desde: periodo.desde || "", hasta: periodo.hasta }, error: "" };
  },
  borrarPeriodo: async () => ({ error: "" }),
}));

// Los reportes con minutos de GPS: los números del cuadro cada 1000 horas,
// sus colores y la tabla con las columnas que se cambian.
const hoy = "2026-10-02";
const DEL_CUADRO = { producto: "nao_traumatica", cuando: "treinamento", localizacion: "profissional" };
const PLANTEL = [
  { id: 7, nombre: "HULK", fecha_nacimiento: "1986-07-25", pie_dominante: "esquerdo", posicion: "centroavante", foto_url: "" },
  { id: 8, nombre: "SCARPA", fecha_nacimiento: "", pie_dominante: "", posicion: "", foto_url: "" },
];
const LESIONES = [
  // HULK: una muscular moderada (20 días) y una traumática (no entra en el cuadro).
  { id: "les-1", jugador_id: 7, numero_caso: 1, fecha_lesion: "2026-03-01", fecha_alta: "2026-03-21", datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "muscular_1a", ...DEL_CUADRO } },
  { id: "les-2", jugador_id: 7, numero_caso: 3, fecha_lesion: "2026-06-01", fecha_alta: "2026-06-11", datos: { parte_cuerpo: "joelho", lado: "direito", tipo_lesion: "entorse", ...DEL_CUADRO, producto: "traumatica" } },
  // SCARPA: un esguince leve (3 días).
  { id: "les-3", jugador_id: 8, numero_caso: 2, fecha_lesion: "2026-04-01", fecha_alta: "2026-04-04", datos: { parte_cuerpo: "tornozelo_pe", lado: "esquerdo", tipo_lesion: "entorse", ...DEL_CUADRO } },
];
// 100 horas de cada uno.
const GPS = [
  { jugadorId: "7", fecha: "2026-02-10", minutos: 3000 },
  { jugadorId: "7", fecha: "2026-05-10", minutos: 3000 },
  { jugadorId: "8", fecha: "2026-02-10", minutos: 6000 },
];

describe("los reportes con los minutos del GPS", () => {
  let contenedor;
  let raiz;

  beforeEach(() => {
    fijarIdiomaParaPruebas("es-AR");
    window.localStorage.clear();
    contenedor = document.createElement("div");
    document.body.appendChild(contenedor);
  });

  afterEach(async () => {
    if (raiz) await act(async () => raiz.unmount());
    raiz = null;
    contenedor.remove();
  });

  const montar = async (gps = GPS, plantel = PLANTEL, lesiones = LESIONES, textoDeOpcion = (campo, codigo) => codigo || "") => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(
        <ReportesLesiones
          lesiones={lesiones}
          plantel={plantel}
          equipo={{ id: "eq-1", nombre: "Atlético Mineiro" }}
          mapa={crearMapa()}
          hoy={hoy}
          etiqueta={(clave) => etiquetaDeCampo(clave, null, "es-AR")}
          etiquetaDeGrupo={(grupo) => etiquetaDeGrupo(grupo, null, "es-AR")}
          textoDeOpcion={textoDeOpcion}
          enPantalla={(campo, lesion) => `${campo.clave}:${lesion.id}`}
          camposVisibles={CAMPOS}
          gps={gps}
        />,
      );
    });
  };
  const tocar = async (elemento) => {
    if (!elemento) throw new Error("no se encontró el botón");
    await act(async () => elemento.click());
  };
  const botonQueEmpieza = (etiqueta) => [...contenedor.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(etiqueta));
  const filas = (cuadro) => [...cuadro.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent));
  // Los indicadores del individual, de una medida: los valores del jugador,
  // las referencias, el "vs" y el tono de cada tarjeta.
  const indicadores = (cual) => {
    const tarjetas = [...contenedor.querySelectorAll(".informe-medida")[cual].querySelectorAll(".informe-indicador")];
    return {
      valores: tarjetas.map((tarjeta) => tarjeta.querySelector(".informe-indicador-valor").textContent),
      referencias: tarjetas.map((tarjeta) => tarjeta.querySelector(".informe-indicador-ref b").textContent),
      contra: tarjetas.map((tarjeta) => {
        const contra = tarjeta.querySelector(".informe-indicador-contra");
        return contra ? `${contra.querySelector("span").textContent} | ${contra.querySelector("small").textContent}` : null;
      }),
      tonos: tarjetas.map((tarjeta) => tarjeta.className.replace("informe-indicador", "").trim()),
    };
  };

  test("el individual: el jugador contra la referencia del plantel, con el signo y el color del Excel", async () => {
    await montar();
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    // HULK: 1 lesión en 100 h en las cuatro columnas. El plantel (200 h): 2,
    // 1 sin leves (la de SCARPA es leve), 1 LM y 1 LM sin leves.
    expect(indicadores(0)).toEqual({
      valores: ["10,00", "10,00", "10,00", "10,00"],
      referencias: ["10,00", "5,00", "5,00", "5,00"],
      contra: ["Igual a la referencia | +0,0% vs referencia", "Superior a la referencia | +50,0% vs referencia", "Superior a la referencia | +50,0% vs referencia", "Superior a la referencia | +50,0% vs referencia"],
      tonos: ["", "peor", "peor", "peor"],
    });
    // Días: HULK 20 en 100 h; el plantel 23 (o 20) en 200 h.
    expect(indicadores(1)).toEqual({
      valores: ["200,00", "200,00", "200,00", "200,00"],
      referencias: ["115,00", "100,00", "100,00", "100,00"],
      contra: ["Superior a la referencia | +42,5% vs referencia", "Superior a la referencia | +50,0% vs referencia", "Superior a la referencia | +50,0% vs referencia", "Superior a la referencia | +50,0% vs referencia"],
      tonos: ["peor", "peor", "peor", "peor"],
    });
    expect(texto()).not.toContain("Faltan los minutos del GPS");
    // Las columnas, con los nombres del Excel.
    expect([...contenedor.querySelectorAll(".informe-medida")[0].querySelectorAll(".informe-indicador-titulo")].map((titulo) => titulo.textContent)).toEqual([
      "Severidad (TODAS) y Tipos (TODOS)",
      "Severidad (SIN LEVES) y Tipos (TODOS)",
      "Severidad (TODAS) y Tipos (SOLO LM)",
      "Severidad (SIN LEVES) y Tipos (SOLO LM)",
    ]);
    expect([...contenedor.querySelectorAll(".informe-medida .informe-seccion h2")].map((h2) => h2.textContent)).toEqual(["Lesiones / 1000 h", "Días perdidos / 1000 h"]);
    // Sus datos y sus dos lesiones (la traumática también), por n° de registro.
    expect(contenedor.querySelector(".informe-posicion").textContent).toBe("centroavante");
    expect([...contenedor.querySelectorAll(".informe-dato dd")].map((dd) => dd.textContent)).toEqual(["25/07/1986", "esquerdo"]);
    // Cada tabla arranca con el n° de registro.
    expect([...contenedor.querySelectorAll(".informe-tabla")].map((tabla) => [...tabla.querySelectorAll("tbody tr td:first-child")].map((td) => td.textContent))).toEqual([
      ["numero_registro:les-1", "numero_registro:les-2"],
      ["numero_registro:les-1", "numero_registro:les-2"],
    ]);
  });

  test("un jugador sin lesiones del cuadro: 0 y \"0%\", como el Excel", async () => {
    await montar();
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("SCARPA"));
    const { valores, contra, tonos } = indicadores(0);
    expect(valores).toEqual(["10,00", "0,00", "0,00", "0,00"]);
    expect(contra).toEqual(["Igual a la referencia | +0,0% vs referencia", "Inferior a la referencia | 0% vs referencia", "Inferior a la referencia | 0% vs referencia", "Inferior a la referencia | 0% vs referencia"]);
    expect(tonos).toEqual(["", "mejor", "mejor", "mejor"]);
  });

  test("a las horas del GPS del jugador se le suman sus horas previas (de antes del cuerpo técnico); a la referencia, no", async () => {
    await montar(GPS, PLANTEL.map((jugador) => (jugador.id === 7 ? { ...jugador, horas_previas: 100 } : jugador)));
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    // 100 horas del GPS y 100 previas: 1 lesión en 200 horas.
    expect(indicadores(0).valores).toEqual(["5,00", "5,00", "5,00", "5,00"]);
    expect(indicadores(0).referencias).toEqual(["10,00", "5,00", "5,00", "5,00"]);
    // Sin minutos del GPS en la app, no hay cuentas aunque haya horas previas.
    await act(async () => raiz.unmount());
    await montar(null, PLANTEL.map((jugador) => ({ ...jugador, horas_previas: 100 })));
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    expect(indicadores(0)).toEqual({ valores: ["—", "—", "—", "—"], referencias: ["—", "—", "—", "—"], contra: [null, null, null, null], tonos: ["", "", "", ""] });
    expect(texto()).toContain("Faltan los minutos del GPS");
  });

  test("el historial: todas las columnas a la vista, en dos tablas por grupo del Excel, menos las que el club escondió", async () => {
    await montar();
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    const tablas = () => [...contenedor.querySelectorAll(".informe-tabla")];
    const grupos = (tabla) => [...tabla.querySelectorAll(".informe-grupos th[data-grupo]")].map((th) => `${th.textContent}:${th.colSpan}`);
    const cabeceras = (tabla) => [...tabla.querySelectorAll("th[data-columna]")].map((th) => th.dataset.columna);
    const celdas = (tabla) => [...tabla.querySelector("tbody tr").querySelectorAll("td")].map((td) => td.dataset.columna);
    const deGrupos = (...lista) => CAMPOS.filter((campo) => lista.includes(campo.grupo)).map((campo) => campo.clave);

    expect(tablas()).toHaveLength(2);
    // Arriba: Datos generales, Descripción general y Descripción específica,
    // con el n° de registro primero.
    const [arriba, abajo] = tablas();
    expect(grupos(arriba)).toEqual(["Datos generales:7", "Descripción general:7", "Descripción específica:4"]);
    const deArriba = ["numero_registro", ...deGrupos("dados_gerais", "descricao_geral", "descricao_especifica").filter((clave) => clave !== "numero_registro")];
    expect(cabeceras(arriba)).toEqual(deArriba);
    expect(celdas(arriba)).toEqual(deArriba);
    // Abajo: de Descripción contextual a Observaciones, con el n° de
    // registro repetido adelante.
    expect(grupos(abajo)).toEqual(["Descripción contextual:4", "Evolución y continuación:10", "Diagnóstico:1", "Observaciones:2"]);
    const deAbajo = ["numero_registro", ...deGrupos("descricao_contextual", "evolucao", "diagnostico", "observacoes")];
    expect(cabeceras(abajo)).toEqual(deAbajo);
    expect(celdas(abajo)).toEqual(deAbajo);
    // En las dos, el n° de registro va adelante fuera de los grupos (las dos
    // filas de la cabecera), fijo y en negrita.
    for (const tabla of tablas()) {
      expect(tabla.querySelector('.informe-grupos th[data-columna="numero_registro"]').rowSpan).toBe(2);
      expect(tabla.querySelector('.informe-grupos th[data-columna="numero_registro"]').classList.contains("informe-id")).toBe(true);
      expect([...tabla.querySelectorAll("tbody tr")].every((tr) => tr.firstElementChild.classList.contains("informe-id"))).toBe(true);
    }
    // Cada grupo con el tono que tiene en la base.
    const tonos = (tabla) => [...tabla.querySelectorAll(".informe-grupos th[data-grupo]")].map((th) => `${th.dataset.grupo}:${th.className}`);
    const tonosDeLaBase = tonosDeGrupos(CAMPOS);
    expect([...tonos(arriba), ...tonos(abajo)]).toEqual(Object.entries(tonosDeLaBase).map(([grupo, tono]) => `${grupo}:tono-${tono}`));
    expect(tonos(arriba)).toEqual(["dados_gerais:tono-0", "descricao_geral:tono-1", "descricao_especifica:tono-2"]);
    // Todas las columnas de la base están, una sola vez (menos el n° de registro, que se repite).
    expect([...deArriba, ...deAbajo.slice(1)].sort()).toEqual(CAMPOS.map((campo) => campo.clave).sort());
    expect(contenedor.querySelectorAll(".informe-tabla select")).toHaveLength(0);
    // La severidad, en una píldora.
    expect(contenedor.querySelector('.informe-tabla tbody tr td[data-columna="severidad"] .informe-severidad').textContent).toBe("severidad:les-1");

    // Lo que el club escondió no está: una columna, y un grupo entero (Diagnóstico).
    await act(async () => raiz.unmount());
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(
        <ReportesLesiones
          lesiones={LESIONES}
          plantel={PLANTEL}
          equipo={{ id: "eq-1", nombre: "Atlético Mineiro" }}
          mapa={crearMapa()}
          hoy={hoy}
          etiqueta={(clave) => etiquetaDeCampo(clave, null, "es-AR")}
          etiquetaDeGrupo={(grupo) => etiquetaDeGrupo(grupo, null, "es-AR")}
          textoDeOpcion={(campo, codigo) => codigo || ""}
          enPantalla={(campo, lesion) => (campo.clave === "musculo" ? "" : campo.clave === "tipo_lesion" ? "ENTORSE/LESÃO" : campo.clave === "fecha_lesion" ? "01/03/2026" : `${campo.clave}:${lesion.id}`)}
          camposVisibles={CAMPOS.filter((campo) => !["musculo_especifico", "diagnostico"].includes(campo.clave))}
          gps={GPS}
        />,
      );
    });
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    expect(cabeceras(tablas()[0])).not.toContain("musculo_especifico");
    expect(grupos(tablas()[0]).at(-1)).toBe("Descripción específica:3");
    expect(grupos(tablas()[1])).toEqual(["Descripción contextual:4", "Evolución y continuación:10", "Observaciones:2"]);
    // Sin Diagnóstico, Observaciones toma el tono que le da la base con esas columnas.
    const visibles = CAMPOS.filter((campo) => !["musculo_especifico", "diagnostico"].includes(campo.clave));
    expect(tablas()[1].querySelector('th[data-grupo="observacoes"]').className).toBe(`tono-${tonosDeGrupos(visibles).observacoes}`);
    expect(tonosDeGrupos(visibles).observacoes).toBe(5);
    const celda = (clave) => contenedor.querySelector(`.informe-tabla tbody tr td[data-columna="${clave}"]`);
    // Lo vacío, con una raya.
    expect(celda("musculo").textContent).toBe("—");
    // Lo pegado con barras se puede partir después de la barra (sin cambiar
    // el texto); las fechas, no.
    expect(celda("tipo_lesion").textContent).toBe("ENTORSE/LESÃO");
    expect(celda("tipo_lesion").querySelectorAll("wbr")).toHaveLength(1);
    expect(celda("fecha_lesion").textContent).toBe("01/03/2026");
    expect(celda("fecha_lesion").querySelectorAll("wbr")).toHaveLength(0);
    // Las cortas no se parten en renglones; los textos, sí.
    expect(celda("fecha_lesion").classList.contains("informe-corta")).toBe(true);
    expect(celda("tipo_lesion").classList.contains("informe-corta")).toBe(false);
  });

  test("el mapa corporal: lo lesionado pintado, sin nombres (se leen al pasar el mouse)", async () => {
    await montar(GPS, PLANTEL);
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    const mapa = contenedor.querySelector(".informe-mapa");
    // El muslo y la rodilla derechos, de frente (sin músculo cargado: la parte).
    const frente = mapa.querySelector('[data-vista="frente"]');
    expect(frente.querySelectorAll(".cuerpo-calor-mancha")).toHaveLength(2);
    expect(mapa.querySelectorAll("text")).toHaveLength(2);
    expect(mapa.querySelectorAll("line, circle")).toHaveLength(0);
    expect([...frente.querySelectorAll(".cuerpo-calor-mancha title")].map((nombre) => nombre.textContent).sort()).toEqual(["coxa", "joelho"]);
    expect(mapa.querySelector("svg").getAttribute("aria-label")).toContain("coxa");
    expect(mapa.querySelectorAll('[data-vista="espalda"] .cuerpo-calor-mancha')).toHaveLength(0);
    expect(mapa.querySelectorAll(".cuerpo-calor-vista text")[0].textContent).toBe("Anterior");
  });

  test("el grupal: el cuadro del plantel en el período", async () => {
    await montar();
    await tocar(botonQueEmpieza("Reporte grupal"));
    const cuadro = contenedor.querySelector(".informe-cuadro");
    expect(filas(cuadro)).toEqual([
      ["2", "1", "1", "1"],
      ["10,00", "5,00", "5,00", "5,00"],
      ["23", "20", "20", "20"],
      ["115,00", "100,00", "100,00", "100,00"],
    ]);
  });

  test("Lesiones c/1000h y días perdidos: el período, los minutos, el cuadro y guardarlo con un nombre", async () => {
    periodosGuardados.lista = [{ id: "p-0", nombre: "Primer trimestre", desde: "2026-01-01", hasta: "2026-03-31" }];
    periodosGuardados.guardados = [];
    await montar();
    await tocar(botonQueEmpieza("Lesiones c/1000h y días perdidos"));
    // Arranca con la base completa: desde la primera lesión hasta hoy.
    expect(contenedor.querySelector(".reporte-portada small").textContent).toBe("01/03/2026 – 02/10/2026");
    expect([...contenedor.querySelectorAll(".reporte-kpis-dos b")].map((b) => b.textContent)).toEqual(["12.000", "200,0"]);
    expect(filas(contenedor.querySelector(".informe-cuadro"))).toEqual([
      ["2", "1", "1", "1"],
      ["10,00", "5,00", "5,00", "5,00"],
      ["23", "20", "20", "20"],
      ["115,00", "100,00", "100,00", "100,00"],
    ]);
    // Sin nombre no se guarda (como el Excel).
    await tocar(botonQueEmpieza("Guardar el período"));
    expect(contenedor.querySelector(".reporte-contador-guardar [role=alert]").textContent).toBe("Falta el nombre del período.");
    expect(periodosGuardados.guardados).toEqual([]);
    const nombre = contenedor.querySelector(".reporte-contador-nombre input");
    await act(async () => {
      // Con el espacio que deja el teclado del celular.
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(nombre, "Temporada 2026 ");
      nombre.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await tocar(botonQueEmpieza("Guardar el período"));
    expect(periodosGuardados.guardados).toEqual([{ equipoId: "eq-1", nombre: "Temporada 2026 ", desde: "", hasta: hoy }]);
    // Queda reconocido como guardado: no se ofrece guardarlo otra vez.
    const guardar = contenedor.querySelector(".reporte-contador-guardar .boton-principal");
    expect(guardar.textContent).toBe("Período guardado");
    expect(guardar.disabled).toBe(true);
    expect([...contenedor.querySelectorAll(".reporte-periodo b")].map((b) => b.textContent)).toEqual(["Temporada 2026", "Primer trimestre"]);
    // Tocar uno guardado lo vuelve a calcular con sus fechas.
    await tocar(contenedor.querySelectorAll(".reporte-periodo")[1]);
    expect(contenedor.querySelector(".reporte-portada small").textContent).toBe("01/01/2026 – 31/03/2026");
    // En el primer trimestre, solo la muscular de HULK (moderada).
    expect(filas(contenedor.querySelector(".informe-cuadro"))[0]).toEqual(["1", "1", "1", "1"]);
  });

  test("debajo de cada cuadro cada 1000 h dice qué lesiones cuentan y cuáles son las LM, con los textos del club", async () => {
    const LM =
      "En «Tipos (SOLO LM)», de esas, las de tipo Lesión muscular grado 1 A, Lesión muscular grado 1 B, Lesión muscular grado 1 C, Lesión muscular grado 2 A, Lesión muscular grado 2 B, Lesión muscular grado 2 C, Lesión muscular grado 3 A, Lesión muscular grado 3 B, Lesión muscular grado 3 C y Sobrecarga muscular / calambre.";
    periodosGuardados.lista = [{ id: "p-0", nombre: "Primer trimestre", desde: "2026-01-01", hasta: "2026-03-31" }];
    // Con los textos de las opciones, como en la app.
    await montar(GPS, PLANTEL, LESIONES, (campo, codigo) => etiquetaDeOpcion(campo, codigo, null, "es-AR"));
    await tocar(botonQueEmpieza("Reporte grupal"));
    const nota = contenedor.querySelector(".informe-criterio").textContent;
    expect(nota).toMatch(/^Cuentan las lesiones con Producto: No traumática · .+\. En «Tipos \(SOLO LM\)»/);
    expect(nota.slice(nota.indexOf("En «"))).toBe(LM);
    // La misma nota en el individual, en Lesiones c/1000h y en Informes gráficos.
    await tocar(contenedor.querySelector(".reporte-volver"));
    await tocar(botonQueEmpieza("Lesiones c/1000h y días perdidos"));
    expect(contenedor.querySelector(".informe-criterio").textContent).toBe(nota);
    await tocar(contenedor.querySelector(".reporte-volver"));
    await tocar(botonQueEmpieza("Informes gráficos"));
    expect(contenedor.querySelector(".reporte-graficos-notas .informe-criterio").textContent).toBe(nota);
  });

  test("Lesiones c/1000h sin los minutos del GPS: los números del período y un aviso", async () => {
    periodosGuardados.lista = [];
    await montar(null);
    await tocar(botonQueEmpieza("Lesiones c/1000h y días perdidos"));
    expect([...contenedor.querySelectorAll(".reporte-kpis-dos b")].map((b) => b.textContent)).toEqual(["—", "—"]);
    expect(filas(contenedor.querySelector(".informe-cuadro"))[1]).toEqual(["—", "—", "—", "—"]);
    expect(contenedor.querySelector(".informe-aviso").textContent).toContain("Faltan los minutos del GPS");
  });

  test("las sin fecha no cuentan en los reportes; las de alguien fuera de Datos básicos, sí (cada persona aparte)", async () => {
    const conMas = [
      ...LESIONES,
      // Un caso sin terminar de HULK: no cuenta en nada.
      { id: "les-sin-fecha", jugador_id: 7, numero_caso: 9, fecha_lesion: null, fecha_alta: null, datos: { parte_cuerpo: "joelho", lado: "direito", ...DEL_CUADRO } },
      // Dos personas que no están en Datos básicos.
      { id: "les-p1", jugador_id: null, persona: "Persona Uno", numero_caso: 10, fecha_lesion: "2026-05-01", fecha_alta: "2026-05-31", datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "entorse", ...DEL_CUADRO } },
      { id: "les-p2", jugador_id: null, persona: "Persona Dos", numero_caso: 11, fecha_lesion: "2026-05-02", fecha_alta: "2026-05-04", datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "entorse", ...DEL_CUADRO } },
    ];
    await montar(GPS, PLANTEL, conMas);
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    // Sus lesiones con fecha: las dos de antes, no la sin fecha.
    expect(contenedor.querySelector(".informe-tabla").querySelectorAll("tbody tr")).toHaveLength(2);
    await tocar(botonQueEmpieza("Reportes"));
    await tocar(botonQueEmpieza("Reporte grupal"));
    await tocar([...contenedor.querySelectorAll(".chip-criterio")].find((chip) => chip.textContent === "Todo"));
    // Cada persona por su lado en "Quiénes perdieron más días".
    const masDias = [...contenedor.querySelectorAll(".tarjeta")].find((tarjeta) => tarjeta.textContent.startsWith("Quiénes perdieron más días"));
    expect(masDias.textContent).toContain("Persona Uno");
    expect(masDias.textContent).toContain("Persona Dos");
    expect([...contenedor.querySelectorAll(".reporte-kpi")].find((kpi) => kpi.textContent.includes("Jugadores lesionados")).querySelector("b").textContent).toBe("4");
  });

  // ------------------------------------------------- Informes gráficos --
  const PERIODOS = [
    { id: "p1", nombre: "1º semestre", desde: "2026-01-01", hasta: "2026-06-30" },
    { id: "p2", nombre: "2º semestre", desde: "2026-07-01", hasta: "2026-12-31" },
  ];
  const bloqueDe = (titulo) => contenedor.querySelector(`section.reporte-graficos-bloque[aria-label="${titulo}"]`);
  const graficosDe = (titulo) => [...bloqueDe(titulo).querySelectorAll(".reporte-graficos-cuatro > .tarjeta")];
  const valores = (grafico) => [...grafico.querySelectorAll(".reporte-columnas-valor")].map((valor) => valor.textContent);
  const detalles = (grafico) => [...grafico.querySelectorAll(".reporte-columnas-detalle")].map((detalle) => detalle.textContent);
  const leyendaDeTorta = (indice) =>
    [...bloqueDe("Partes del cuerpo").querySelectorAll(".reporte-dos > .tarjeta")[indice].querySelectorAll(".reporte-torta-leyenda li")].map((li) => `${li.querySelector("span").textContent} ${li.querySelector("b").textContent}`);
  // El filtro de cada gráfico (Santiago, 11/10): el embudo de su tarjeta
  // abre sus cabeceras; una cabecera, sus valores para marcar.
  const tarjetasDe = (bloque) => [...bloqueDe(bloque).querySelectorAll(".tarjeta")];
  const hojaDeCabeceras = () => document.querySelector(".reporte-graficos-hoja-cabeceras");
  const hojaDelFiltro = () => document.querySelector(".reporte-graficos-hoja-filtro");
  const cabecerasOfrecidas = () => [...hojaDeCabeceras().querySelectorAll(".opcion-hoja")].map((boton) => boton.firstChild.textContent);
  const opcionDe = (campo) => [...hojaDeCabeceras().querySelectorAll(".opcion-hoja")].find((boton) => boton.firstChild.textContent === campo);
  const botonDeHoja = (hoja, texto) => [...hoja.querySelectorAll("button")].find((boton) => boton.textContent.trim() === texto);
  const abrirCabecera = async (tarjeta, campo) => {
    await tocar(tarjeta.querySelector(".reporte-grafico-embudo"));
    await tocar(opcionDe(campo));
  };
  const filtrar = async (tarjeta, campo, valores) => {
    await abrirCabecera(tarjeta, campo);
    await tocar([...hojaDelFiltro().querySelectorAll(".tabla-datos-todos button")].find((boton) => boton.textContent === "Ninguno"));
    for (const valor of valores) {
      // eslint-disable-next-line no-await-in-loop
      await tocar([...hojaDelFiltro().querySelectorAll(".tabla-datos-valores label")].find((label) => label.querySelector("span").textContent === valor).querySelector("input"));
    }
    await tocar(botonDeHoja(hojaDelFiltro(), "Aplicar"));
    // Vuelve a las cabeceras del gráfico; Listo la cierra.
    await tocar(botonDeHoja(hojaDeCabeceras(), "Listo"));
  };
  const abrirGraficos = async (gps = GPS, plantel = PLANTEL, lesiones = LESIONES) => {
    await montar(gps, plantel, lesiones);
    await tocar(botonQueEmpieza("Informes gráficos"));
  };

  test("Informes gráficos: el menú lo abre con sus cinco bloques, y se imprime", async () => {
    periodosGuardados.lista = [...PERIODOS];
    await abrirGraficos();
    expect(texto()).toContain("INFORMES GRÁFICOS DE LESIONES");
    expect([...contenedor.querySelectorAll(".reporte-graficos-nav button")].map((boton) => boton.textContent)).toEqual([
      "N° de lesiones c/1000 h",
      "N° de días perdidos c/1000 h",
      "Partes del cuerpo",
      "Lesiones por jugador",
      "Entrenamiento y partidos",
    ]);
    expect(botonQueEmpieza("Imprimir")).toBeTruthy();
  });

  test("Informes gráficos, bloques 1 y 2: cada período guardado, con los minutos del GPS", async () => {
    periodosGuardados.lista = [...PERIODOS];
    await abrirGraficos();
    const [todas, sinLeves] = graficosDe("N° de lesiones c/1000 h");
    // 1º semestre: 2 lesiones del cuadro en 200 h; el 2º, sin minutos.
    expect(valores(todas)).toEqual(["10,00", "—"]);
    expect(detalles(todas)).toEqual(["2 lesiones", "0 lesiones"]);
    expect(todas.querySelectorAll(".reporte-columnas-barra")).toHaveLength(1);
    expect(valores(sinLeves)).toEqual(["5,00", "—"]);
    const [diasTodas, diasSinLeves] = graficosDe("N° de días perdidos c/1000 h");
    expect(valores(diasTodas)).toEqual(["115,00", "—"]);
    expect(detalles(diasTodas)).toEqual(["23 días", "0 días"]);
    expect(valores(diasSinLeves)).toEqual(["100,00", "—"]);
    expect(texto()).not.toContain("Faltan los minutos del GPS");
  });

  test("Informes gráficos: arriba no hay filtros; cada gráfico tiene su embudo, con el año adentro y por separado", async () => {
    periodosGuardados.lista = [...PERIODOS, { id: "p0", nombre: "2025", desde: "2025-01-01", hasta: "2025-12-31" }];
    await abrirGraficos();
    expect(contenedor.querySelectorAll(".reporte-graficos-filtros")).toHaveLength(0);
    // Un embudo por gráfico: 4 + 4 + 2 tortas + jugador + momentos.
    expect(contenedor.querySelectorAll(".reporte-grafico-embudo")).toHaveLength(12);
    const [todas, sinLeves] = graficosDe("N° de lesiones c/1000 h");
    expect(todas.querySelector(".reporte-grafico-embudo").getAttribute("aria-label")).toBe(`Filtrar: ${todas.querySelector(".cabeza-ficha b").textContent}`);
    await tocar(todas.querySelector(".reporte-grafico-embudo"));
    // En los c/1000 h: el año (de los períodos) y las cabeceras de la lesión,
    // sin las de la persona (las horas son de todo el plantel).
    const ofrecidas = cabecerasOfrecidas();
    expect(ofrecidas[0]).toBe("Año");
    expect(ofrecidas).toContain("Parte del cuerpo lesionada");
    expect(ofrecidas).toContain("Fecha de inicio de la lesión");
    for (const dePersona of ["Nombre y apellido", "Posición", "Edad", "Categoría", "Pie dominante", "Fecha de nacimiento"]) expect(ofrecidas).not.toContain(dePersona);
    await tocar(opcionDe("Año"));
    expect([...hojaDelFiltro().querySelectorAll(".tabla-datos-valores label span")].map((span) => span.textContent)).toEqual(["2025", "2026"]);
    await tocar([...hojaDelFiltro().querySelectorAll(".tabla-datos-todos button")].find((boton) => boton.textContent === "Ninguno"));
    await tocar([...hojaDelFiltro().querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent.startsWith("2025")).querySelector("input"));
    await tocar(botonDeHoja(hojaDelFiltro(), "Aplicar"));
    expect(opcionDe("Año").querySelector("small").textContent).toBe("2025");
    await tocar(botonDeHoja(hojaDeCabeceras(), "Listo"));
    expect(hojaDeCabeceras()).toBeNull();
    // Solo ese gráfico: los otros siguen con los tres períodos.
    expect(valores(graficosDe("N° de lesiones c/1000 h")[0])).toHaveLength(1);
    expect(graficosDe("N° de lesiones c/1000 h")[0].querySelector(".reporte-grafico-filtrado").textContent).toBe("Año: 2025");
    expect(graficosDe("N° de lesiones c/1000 h")[0].querySelector(".reporte-grafico-embudo").getAttribute("aria-pressed")).toBe("true");
    expect(valores(sinLeves)).toHaveLength(3);
    expect(sinLeves.querySelector(".reporte-grafico-filtrado")).toBeNull();
    expect(valores(graficosDe("N° de días perdidos c/1000 h")[0])).toHaveLength(3);
    // Quitar filtros vuelve a todo.
    await tocar(graficosDe("N° de lesiones c/1000 h")[0].querySelector(".reporte-grafico-embudo"));
    await tocar(botonDeHoja(hojaDeCabeceras(), "Quitar filtros"));
    await tocar(botonDeHoja(hojaDeCabeceras(), "Listo"));
    expect(valores(graficosDe("N° de lesiones c/1000 h")[0])).toHaveLength(3);
  });

  test("Informes gráficos sin los minutos del GPS: las lesiones y los días, sin barras, y el aviso", async () => {
    periodosGuardados.lista = [...PERIODOS];
    await abrirGraficos(null);
    [...graficosDe("N° de lesiones c/1000 h"), ...graficosDe("N° de días perdidos c/1000 h")].forEach((grafico) => {
      expect(valores(grafico)).toEqual(["—", "—"]);
      expect(grafico.querySelectorAll(".reporte-columnas-barra")).toHaveLength(0);
    });
    expect(detalles(graficosDe("N° de lesiones c/1000 h")[0])).toEqual(["2 lesiones", "0 lesiones"]);
    expect(detalles(graficosDe("N° de días perdidos c/1000 h")[0])).toEqual(["23 días", "0 días"]);
    expect([...contenedor.querySelectorAll(".informe-aviso")].filter((aviso) => aviso.textContent.includes("Faltan los minutos del GPS"))).toHaveLength(2);
  });

  test("Informes gráficos sin períodos guardados: se dice dónde se guardan, y se va", async () => {
    periodosGuardados.lista = [];
    await abrirGraficos();
    expect(bloqueDe("N° de lesiones c/1000 h").textContent).toContain("Todavía no hay períodos guardados");
    await tocar(bloqueDe("N° de lesiones c/1000 h").querySelector("button"));
    expect(texto()).toContain("LESIONES C/1000 H Y DÍAS PERDIDOS");
  });

  test("Informes gráficos: las tortas por parte del cuerpo y sus filtros", async () => {
    periodosGuardados.lista = [];
    await abrirGraficos();
    expect(leyendaDeTorta(0)).toEqual(["coxa 50%", "tornozelo_pe 50%"]);
    expect(leyendaDeTorta(1)).toEqual(["joelho 100%"]);
    expect(bloqueDe("Partes del cuerpo").querySelectorAll(".reporte-dos > .tarjeta")[1].querySelector("svg circle")).not.toBeNull();
    // Lado: izquierdo, en la torta de no traumáticas.
    await filtrar(tarjetasDe("Partes del cuerpo")[0], "Lado", ["esquerdo"]);
    expect(leyendaDeTorta(0)).toEqual(["tornozelo_pe 100%"]);
    expect(tarjetasDe("Partes del cuerpo")[0].querySelector(".reporte-grafico-filtrado").textContent).toBe("Lado: esquerdo");
    // La otra torta tiene su propio filtro: no cambia.
    expect(leyendaDeTorta(1)).toEqual(["joelho 100%"]);
    expect(tarjetasDe("Partes del cuerpo")[1].querySelector(".reporte-grafico-filtrado")).toBeNull();
    // Y su lista ofrece lo de sus lesiones: en las traumáticas no hay izquierdas.
    await abrirCabecera(tarjetasDe("Partes del cuerpo")[1], "Lado");
    expect([...hojaDelFiltro().querySelectorAll(".tabla-datos-valores label span")].map((span) => span.textContent)).toEqual(["direito"]);
  });

  test("Informes gráficos: lesiones por jugador y entrenamiento y partidos", async () => {
    periodosGuardados.lista = [];
    await abrirGraficos();
    const filasJugador = [...bloqueDe("Lesiones por jugador").querySelectorAll(".reporte-barras li")].map((li) => [li.querySelector(".reporte-barras-etiqueta").textContent, li.querySelector("b").textContent]);
    expect(filasJugador).toEqual([
      ["HULK", "2"],
      ["SCARPA", "1"],
    ]);
    const momentos = bloqueDe("Entrenamiento y partidos");
    expect(momentos.querySelector(".cabeza-ficha b").textContent).toBe("2026");
    expect([...momentos.querySelectorAll(".reporte-columnas-etiqueta")].map((etiqueta) => etiqueta.textContent)).toEqual(["treinamento"]);
    expect(valores(momentos)).toEqual(["1", "1", "1"]);
    // El año va en su filtro; el título lo dice (y no se repite debajo).
    expect(momentos.querySelector(".reporte-grafico-filtrado")).toBeNull();
    await abrirCabecera(momentos.querySelector(".tarjeta"), "Año");
    await tocar([...hojaDelFiltro().querySelectorAll(".tabla-datos-todos button")].find((boton) => boton.textContent === "Todos"));
    await tocar(botonDeHoja(hojaDelFiltro(), "Aplicar"));
    await tocar(botonDeHoja(hojaDeCabeceras(), "Listo"));
    expect(momentos.querySelector(".cabeza-ficha b").textContent).toBe("Todos los años");
  });

  test("Informes gráficos: las sin fecha no cuentan; las de alguien fuera de Datos básicos, sí", async () => {
    periodosGuardados.lista = [...PERIODOS];
    const sinFecha = { id: "les-sf", jugador_id: 7, numero_caso: 9, fecha_lesion: null, fecha_alta: null, datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "muscular_1a", ...DEL_CUADRO } };
    const deAfuera = { id: "les-af", jugador_id: null, persona: "Persona De Afuera", numero_caso: 10, fecha_lesion: "2026-05-01", fecha_alta: "2026-05-03", datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "entorse", ...DEL_CUADRO } };
    await abrirGraficos(GPS, PLANTEL, [...LESIONES, sinFecha, deAfuera]);
    expect(valores(graficosDe("N° de lesiones c/1000 h")[0])[0]).toBe("15,00");
    expect(valores(graficosDe("N° de lesiones c/1000 h")[1])[0]).toBe("5,00");
    expect(valores(graficosDe("N° de días perdidos c/1000 h")[0])[0]).toBe("125,00");
    expect(leyendaDeTorta(0)).toEqual(["coxa 67%", "tornozelo_pe 33%"]);
    const filasJugador = [...bloqueDe("Lesiones por jugador").querySelectorAll(".reporte-barras li")].map((li) => [li.querySelector(".reporte-barras-etiqueta").textContent, li.querySelector("b").textContent]);
    expect(filasJugador).toEqual([
      ["HULK", "2"],
      ["Persona De Afuera", "1"],
      ["SCARPA", "1"],
    ]);
  });

  test("Informes gráficos: la posición sale del plantel, y el año del bloque 5 es el último si hoy no tiene", async () => {
    periodosGuardados.lista = [];
    const plantel = [PLANTEL[0], { ...PLANTEL[1], posicion: "goleiro" }];
    const lesiones = [
      { ...LESIONES[0], fecha_lesion: "2024-03-01", fecha_alta: "2024-03-21" },
      { ...LESIONES[1], fecha_lesion: "2025-06-01", fecha_alta: "2025-06-11" },
      { ...LESIONES[2], fecha_lesion: "2025-04-01", fecha_alta: "2025-04-04" },
    ];
    await abrirGraficos(GPS, plantel, lesiones);
    // Sin lesiones de 2026 (el año de hoy): el último año con lesiones.
    expect(bloqueDe("Entrenamiento y partidos").querySelector(".cabeza-ficha b").textContent).toBe("2025");
    // Posición: la del plantel (en el Excel, el Puesto de Datos Básicos).
    await filtrar(tarjetasDe("Partes del cuerpo")[0], "Posición", ["goleiro"]);
    expect(leyendaDeTorta(0)).toEqual(["tornozelo_pe 100%"]);
    // Por jugador, el filtro del jugador (como el del Excel): solo SCARPA.
    await filtrar(tarjetasDe("Lesiones por jugador")[0], "Nombre y apellido", ["SCARPA"]);
    expect([...bloqueDe("Lesiones por jugador").querySelectorAll(".reporte-barras li .reporte-barras-etiqueta")].map((etiqueta) => etiqueta.textContent)).toEqual(["SCARPA"]);
  });

  test("Informes gráficos: en los filtros se marcan varios (los jugadores que van y los que no), con cuántas tiene cada uno", async () => {
    periodosGuardados.lista = [];
    const deAfuera = { id: "les-af", jugador_id: null, persona: "Persona De Afuera", numero_caso: 10, fecha_lesion: "2026-05-01", fecha_alta: "2026-05-03", datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "entorse", ...DEL_CUADRO } };
    await abrirGraficos(GPS, PLANTEL, [...LESIONES, deAfuera]);
    const filas = () => [...bloqueDe("Lesiones por jugador").querySelectorAll(".reporte-barras li .reporte-barras-etiqueta")].map((etiqueta) => etiqueta.textContent);
    expect(filas()).toEqual(["HULK", "Persona De Afuera", "SCARPA"]);
    // La lista: todos marcados al abrir, con cuántas lesiones tiene cada uno.
    const grafico = () => tarjetasDe("Lesiones por jugador")[0];
    const detalle = async () => {
      await tocar(grafico().querySelector(".reporte-grafico-embudo"));
      const texto = opcionDe("Nombre y apellido").querySelector("small").textContent;
      await tocar(botonDeHoja(hojaDeCabeceras(), "Listo"));
      return texto;
    };
    await abrirCabecera(grafico(), "Nombre y apellido");
    const lista = () => [...hojaDelFiltro().querySelectorAll(".tabla-datos-valores label")].map((label) => [label.querySelector("span").textContent, label.querySelector("input").checked, label.querySelector("small").textContent]);
    expect(lista()).toEqual([
      ["HULK", true, "2"],
      ["Persona De Afuera", true, "1"],
      ["SCARPA", true, "1"],
    ]);
    await tocar(botonDeHoja(hojaDelFiltro(), "Aplicar"));
    await tocar(botonDeHoja(hojaDeCabeceras(), "Listo"));
    // Con todo marcado no filtra.
    expect(await detalle()).toBe("Todos");
    expect(grafico().querySelector(".reporte-grafico-embudo").getAttribute("aria-pressed")).toBe("false");
    // Dos de tres: van esos dos.
    await filtrar(grafico(), "Nombre y apellido", ["HULK", "SCARPA"]);
    expect(filas()).toEqual(["HULK", "SCARPA"]);
    expect(await detalle()).toBe("2 elegidos");
    expect(grafico().querySelector(".reporte-grafico-embudo").getAttribute("aria-pressed")).toBe("true");
    // Impreso se leen todos los elegidos.
    expect(grafico().querySelector(".reporte-grafico-filtrado").textContent).toBe("Nombre y apellido: HULK, SCARPA");
    // Al volver a abrir, lo elegido sigue marcado; Ninguno solo toca lo buscado.
    await abrirCabecera(grafico(), "Nombre y apellido");
    expect(lista().map(([nombre, marcado]) => [nombre, marcado])).toEqual([
      ["HULK", true],
      ["Persona De Afuera", false],
      ["SCARPA", true],
    ]);
    const buscar = async (texto) =>
      act(async () => {
        const campo = hojaDelFiltro().querySelector(".tabla-datos-buscar-valor");
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(campo, texto);
        campo.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await buscar("scar");
    await tocar([...hojaDelFiltro().querySelectorAll(".tabla-datos-todos button")].find((boton) => boton.textContent === "Ninguno"));
    await buscar("");
    expect(lista().map(([nombre, marcado]) => [nombre, marcado])).toEqual([
      ["HULK", true],
      ["Persona De Afuera", false],
      ["SCARPA", false],
    ]);
    await tocar(botonDeHoja(hojaDelFiltro(), "Aplicar"));
    await tocar(botonDeHoja(hojaDeCabeceras(), "Listo"));
    expect(filas()).toEqual(["HULK"]);
    await filtrar(grafico(), "Nombre y apellido", ["HULK", "SCARPA"]);
    // Con otro filtro, la lista ofrece solo a quienes les queda alguna.
    await filtrar(grafico(), "Producto", ["traumatica"]);
    expect(filas()).toEqual(["HULK"]);
    await abrirCabecera(grafico(), "Nombre y apellido");
    expect(lista()).toEqual([["HULK", true, "1"]]);
    // Quitar el filtro: vuelven todos los que deja el otro filtro.
    await tocar(botonDeHoja(hojaDelFiltro(), "Quitar filtro"));
    expect(opcionDe("Nombre y apellido").querySelector("small").textContent).toBe("Todos");
    // Ninguno marcado: no se puede aplicar.
    await tocar(opcionDe("Nombre y apellido"));
    await tocar([...hojaDelFiltro().querySelectorAll(".tabla-datos-todos button")].find((boton) => boton.textContent === "Ninguno"));
    expect(botonDeHoja(hojaDelFiltro(), "Aplicar").disabled).toBe(true);
  });

  test("Informes gráficos: las listas ofrecen Sin dato y cuentan lo de su gráfico (el año de Entrenamiento y partidos)", async () => {
    periodosGuardados.lista = [];
    const sinMusculo = { id: "les-sm", jugador_id: 8, numero_caso: 4, fecha_lesion: "2026-05-01", fecha_alta: "2026-05-03", datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "entorse", ...DEL_CUADRO, musculo: "" } };
    const conMusculo = { ...LESIONES[0], datos: { ...LESIONES[0].datos, musculo: "isquiotibiais" } };
    const otroAnio = { id: "les-25", jugador_id: 7, numero_caso: 5, fecha_lesion: "2025-05-01", fecha_alta: "2025-05-03", datos: { parte_cuerpo: "pe_dedo", lado: "direito", tipo_lesion: "entorse", ...DEL_CUADRO } };
    await abrirGraficos(GPS, PLANTEL, [conMusculo, sinMusculo, otroAnio]);
    // Músculo: con "Sin dato" (las que no lo tienen), que se puede dejar marcado.
    await abrirCabecera(tarjetasDe("Partes del cuerpo")[0], "Músculo afectado");
    const lista = () => [...hojaDelFiltro().querySelectorAll(".tabla-datos-valores label")].map((label) => [label.querySelector("span").textContent, label.querySelector("small").textContent]);
    expect(lista()).toEqual([
      ["isquiotibiais", "1"],
      ["Sin dato", "2"],
    ]);
    await tocar(hojaDelFiltro().querySelector(".tabla-datos-valores input"));
    await tocar(botonDeHoja(hojaDelFiltro(), "Aplicar"));
    await tocar(botonDeHoja(hojaDeCabeceras(), "Listo"));
    // Sin isquiotibiais: quedan las sin músculo (no se pierden).
    expect(leyendaDeTorta(0)).toEqual(["coxa 50%", "pe_dedo 50%"]);
    // Entrenamiento y partidos (2026): la lista de partes no ofrece la de 2025.
    await abrirCabecera(tarjetasDe("Entrenamiento y partidos")[0], "Parte del cuerpo lesionada");
    expect(lista()).toEqual([["coxa", "2"]]);
    await tocar(botonDeHoja(hojaDelFiltro(), "Quitar filtro"));
    // Y el año, de las lesiones que cuenta: 2025 y 2026, de entrada 2026.
    await tocar(opcionDe("Año"));
    expect(lista()).toEqual([
      ["2025", "1"],
      ["2026", "2"],
    ]);
    expect([...hojaDelFiltro().querySelectorAll(".tabla-datos-valores input")].map((input) => input.checked)).toEqual([false, true]);
  });

  test("Informes gráficos: cualquier cabecera de la Base filtra un gráfico, con lo que dice su celda", async () => {
    periodosGuardados.lista = [];
    await abrirGraficos();
    // Lo que no es una lista se filtra por lo que dice la celda de la Base (acá, de prueba: "campo:lesión").
    await abrirCabecera(tarjetasDe("Lesiones por jugador")[0], "Fecha de inicio de la lesión");
    const lista = () => [...hojaDelFiltro().querySelectorAll(".tabla-datos-valores label")].map((label) => label.querySelector("span").textContent);
    expect(lista()).toEqual(["fecha_lesion:les-1", "fecha_lesion:les-2", "fecha_lesion:les-3"]);
    await tocar([...hojaDelFiltro().querySelectorAll(".tabla-datos-todos button")].find((boton) => boton.textContent === "Ninguno"));
    await tocar([...hojaDelFiltro().querySelectorAll(".tabla-datos-valores label")].find((label) => label.textContent.startsWith("fecha_lesion:les-3")).querySelector("input"));
    await tocar(botonDeHoja(hojaDelFiltro(), "Aplicar"));
    // En las demás cabeceras está todo: el jugador, la posición, la edad (no es un c/1000 h).
    expect(cabecerasOfrecidas()).toEqual(expect.arrayContaining(["Año", "Nombre y apellido", "Posición", "Edad", "Fecha de inicio de la lesión"]));
    await tocar(botonDeHoja(hojaDeCabeceras(), "Listo"));
    expect([...bloqueDe("Lesiones por jugador").querySelectorAll(".reporte-barras li .reporte-barras-etiqueta")].map((etiqueta) => etiqueta.textContent)).toEqual(["SCARPA"]);
    expect(tarjetasDe("Lesiones por jugador")[0].querySelector(".reporte-grafico-filtrado").textContent).toBe("Fecha de inicio de la lesión: fecha_lesion:les-3");
    // Escape (o tocar afuera) cierra la lista de valores y vuelve a las cabeceras.
    await abrirCabecera(tarjetasDe("Lesiones por jugador")[0], "Lado");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(hojaDelFiltro()).toBeNull();
    expect(hojaDeCabeceras()).not.toBeNull();
  });

  test("Informes gráficos: por jugador, el título es el campo, con su leyenda aunque sea una parte, y la nota dice qué cuenta", async () => {
    periodosGuardados.lista = [];
    const sinParte = { id: "les-sp", jugador_id: 8, numero_caso: 4, fecha_lesion: "2026-05-01", fecha_alta: "2026-05-03", datos: { lado: "direito", tipo_lesion: "entorse", ...DEL_CUADRO } };
    await abrirGraficos(GPS, PLANTEL, [LESIONES[0], sinParte]);
    const porJugador = bloqueDe("Lesiones por jugador");
    expect(porJugador.querySelector(".cabeza-ficha b").textContent).toBe("Parte del cuerpo lesionada");
    // Una sola parte (la lesión sin parte no cuenta acá): igual va la leyenda.
    expect(porJugador.querySelector(".reporte-leyenda").textContent).toBe("coxa");
    expect([...porJugador.querySelectorAll(".reporte-barras li .reporte-barras-etiqueta")].map((etiqueta) => etiqueta.textContent)).toEqual(["HULK"]);
    expect(porJugador.querySelector(".reporte-graficos-notas").textContent).toBe("Cuentan las lesiones con fecha de inicio, «Tipo de lesión» y «Parte del cuerpo lesionada» cargados, de cualquier fecha.");
    // En la torta, la de sin parte sí cuenta (Sin dato).
    expect(leyendaDeTorta(0)).toEqual(["coxa 50%", "Sin dato 50%"]);
    // Entrenamiento y partidos: una sola parte, con su leyenda.
    expect(bloqueDe("Entrenamiento y partidos").querySelector(".reporte-leyenda")).not.toBeNull();
  });

  test("Informes gráficos: el color de cada parte no cambia cuando aparece otra parte", async () => {
    periodosGuardados.lista = [];
    const colorDeLaParte = (parte) =>
      [...bloqueDe("Partes del cuerpo").querySelectorAll(".reporte-torta-leyenda li")].find((li) => li.querySelector("span").textContent === parte).querySelector("i").style.background;
    await abrirGraficos();
    const muslo = colorDeLaParte("coxa");
    const tobillo = colorDeLaParte("tornozelo_pe");
    expect(muslo).not.toBe(tobillo);
    await act(async () => raiz.unmount());
    const abdomen = { id: "les-ab", jugador_id: 8, numero_caso: 5, fecha_lesion: "2026-05-01", fecha_alta: "2026-05-03", datos: { parte_cuerpo: "abdomen", lado: "direito", tipo_lesion: "muscular_1a", ...DEL_CUADRO } };
    await abrirGraficos(GPS, PLANTEL, [...LESIONES, abdomen]);
    expect(colorDeLaParte("coxa")).toBe(muslo);
    expect(colorDeLaParte("tornozelo_pe")).toBe(tobillo);
  });

  const texto = () => contenedor.textContent;
});
