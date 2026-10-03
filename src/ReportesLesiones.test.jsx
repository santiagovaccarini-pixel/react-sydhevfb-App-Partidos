import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ReportesLesiones from "./ReportesLesiones.jsx";
import { CAMPOS, etiquetaDeCampo } from "./domain/lesionesCampos.js";
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

  const montar = async (gps = GPS, plantel = PLANTEL) => {
    await act(async () => {
      raiz = createRoot(contenedor);
      raiz.render(
        <ReportesLesiones
          lesiones={LESIONES}
          plantel={plantel}
          equipo={{ id: "eq-1", nombre: "Atlético Mineiro" }}
          mapa={crearMapa()}
          hoy={hoy}
          etiqueta={(clave) => etiquetaDeCampo(clave, null, "es-AR")}
          textoDeOpcion={(campo, codigo) => codigo || ""}
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
    expect([...contenedor.querySelectorAll(".informe-tabla tbody tr td:first-child")].map((td) => td.textContent)).toEqual(["numero_registro:les-1", "numero_registro:les-2"]);
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

  test("el historial: las doce columnas del reporte a la vista, menos las que el club escondió", async () => {
    await montar();
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    const cabeceras = () => [...contenedor.querySelectorAll(".informe-tabla th")].map((th) => th.textContent);
    const etiquetas = ["numero_registro", "parte_cuerpo", "tipo_lesion", "mecanismo", "recurrencia", "recidiva", "severidad", "fecha_lesion", "fecha_alta", "recuperacion", "musculo", "musculo_especifico"].map((clave) => etiquetaDeCampo(clave, null, "es-AR"));
    expect(cabeceras()).toEqual(etiquetas);
    expect(contenedor.querySelectorAll(".informe-tabla select")).toHaveLength(0);
    // La severidad, en una píldora.
    expect(contenedor.querySelector(".informe-tabla tbody tr .informe-severidad").textContent).toBe("severidad:les-1");
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
          textoDeOpcion={(campo, codigo) => codigo || ""}
          enPantalla={(campo, lesion) => (campo.clave === "musculo" ? "" : campo.clave === "tipo_lesion" ? "ENTORSE/LESÃO" : campo.clave === "fecha_lesion" ? "01/03/2026" : `${campo.clave}:${lesion.id}`)}
          camposVisibles={CAMPOS.filter((campo) => campo.clave !== "musculo_especifico")}
          gps={GPS}
        />,
      );
    });
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    expect(cabeceras()).toEqual(etiquetas.slice(0, 11));
    // Lo vacío, con una raya.
    const fila = contenedor.querySelector(".informe-tabla tbody tr").children;
    expect(fila[10].textContent).toBe("—");
    // Lo pegado con barras se puede partir después de la barra (sin cambiar
    // el texto); las fechas, no.
    expect(fila[2].textContent).toBe("ENTORSE/LESÃO");
    expect(fila[2].querySelectorAll("wbr")).toHaveLength(1);
    expect(fila[7].textContent).toBe("01/03/2026");
    expect(fila[7].querySelectorAll("wbr")).toHaveLength(0);
  });

  test("el mapa corporal: una mancha donde se lesionó, con el nombre de lo lesionado", async () => {
    await montar(GPS, PLANTEL);
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    const mapa = contenedor.querySelector(".informe-mapa");
    // El muslo y la rodilla derechos, de frente (sin músculo cargado, en el
    // medio de la parte).
    const frente = mapa.querySelector('[data-vista="frente"]');
    expect(frente.querySelectorAll(".cuerpo-calor-mancha")).toHaveLength(2);
    expect([...frente.querySelectorAll(".cuerpo-calor-nombre")].map((nombre) => nombre.textContent)).toEqual(["COXA", "JOELHO"]);
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
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(nombre, "Temporada 2026");
      nombre.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await tocar(botonQueEmpieza("Guardar el período"));
    expect(periodosGuardados.guardados).toEqual([{ equipoId: "eq-1", nombre: "Temporada 2026", desde: "", hasta: hoy }]);
    expect([...contenedor.querySelectorAll(".reporte-periodo b")].map((b) => b.textContent)).toEqual(["Temporada 2026", "Primer trimestre"]);
    // Tocar uno guardado lo vuelve a calcular con sus fechas.
    await tocar(contenedor.querySelectorAll(".reporte-periodo")[1]);
    expect(contenedor.querySelector(".reporte-portada small").textContent).toBe("01/01/2026 – 31/03/2026");
    // En el primer trimestre, solo la muscular de HULK (moderada).
    expect(filas(contenedor.querySelector(".informe-cuadro"))[0]).toEqual(["1", "1", "1", "1"]);
  });

  test("Lesiones c/1000h sin los minutos del GPS: los números del período y un aviso", async () => {
    periodosGuardados.lista = [];
    await montar(null);
    await tocar(botonQueEmpieza("Lesiones c/1000h y días perdidos"));
    expect([...contenedor.querySelectorAll(".reporte-kpis-dos b")].map((b) => b.textContent)).toEqual(["—", "—"]);
    expect(filas(contenedor.querySelector(".informe-cuadro"))[1]).toEqual(["—", "—", "—", "—"]);
    expect(contenedor.querySelector(".informe-aviso").textContent).toContain("Faltan los minutos del GPS");
  });

  const texto = () => contenedor.textContent;
});
