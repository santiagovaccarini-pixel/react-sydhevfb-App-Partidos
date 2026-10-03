import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ReportesLesiones from "./ReportesLesiones.jsx";
import { CAMPOS, etiquetaDeCampo } from "./domain/lesionesCampos.js";
import { crearMapa } from "./domain/mapaCorporal.js";
import { fijarIdiomaParaPruebas } from "./idioma/index.js";

// El escudo se busca por internet: acá, uno quieto.
vi.mock("./components/ClubCrest", () => ({ EscudoDeClub: () => <span className="escudo-club" /> }));

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

  const montar = async (gps = GPS) => {
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
  const tonos = (cuadro, fila) => [...cuadro.querySelectorAll("tbody tr")[fila].querySelectorAll("td")].map((td) => td.className);

  test("el individual: el jugador contra el VR del plantel, con el signo y el color del Excel", async () => {
    await montar();
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    const [lesionesMil, diasMil] = contenedor.querySelectorAll(".informe-cuadro");
    // HULK: 1 lesión en 100 h en las cuatro columnas. El plantel (200 h): 2,
    // 1 sin leves (la de SCARPA es leve), 1 LM y 1 LM sin leves.
    expect(filas(lesionesMil)).toEqual([
      ["10,00", "10,00", "10,00", "10,00"],
      ["10,00", "5,00", "5,00", "5,00"],
      ["+0,0% vs VR", "+50,0% vs VR", "+50,0% vs VR", "+50,0% vs VR"],
    ]);
    expect(tonos(lesionesMil, 0)).toEqual(["", "peor", "peor", "peor"]);
    // Días: HULK 20 en 100 h; el plantel 23 (o 20) en 200 h.
    expect(filas(diasMil)).toEqual([
      ["200,00", "200,00", "200,00", "200,00"],
      ["115,00", "100,00", "100,00", "100,00"],
      ["+42,5% vs VR", "+50,0% vs VR", "+50,0% vs VR", "+50,0% vs VR"],
    ]);
    expect(texto()).not.toContain("Faltan los minutos del GPS");
    // Sus datos y sus dos lesiones (la traumática también), por n° de registro.
    expect([...contenedor.querySelectorAll(".informe-dato dd")].map((dd) => dd.textContent)).toEqual(["25/07/1986", "esquerdo", "centroavante"]);
    expect([...contenedor.querySelectorAll(".informe-tabla tbody tr td:first-child")].map((td) => td.textContent)).toEqual(["numero_registro:les-1", "numero_registro:les-2"]);
  });

  test("un jugador sin lesiones del cuadro: 0 y \"0% vs VR\", como el Excel", async () => {
    await montar();
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("SCARPA"));
    const [lesionesMil] = contenedor.querySelectorAll(".informe-cuadro");
    expect(filas(lesionesMil)[0]).toEqual(["10,00", "0,00", "0,00", "0,00"]);
    expect(filas(lesionesMil)[2]).toEqual(["+0,0% vs VR", "0% vs VR", "0% vs VR", "0% vs VR"]);
    expect(tonos(lesionesMil, 0)).toEqual(["", "mejor", "mejor", "mejor"]);
  });

  test("las columnas de la tabla se cambian desde la cabecera y quedan para la próxima", async () => {
    await montar();
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    const selector = contenedor.querySelectorAll(".informe-tabla th select")[2];
    await act(async () => {
      selector.value = "medico";
      selector.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const cabeceras = () => [...contenedor.querySelectorAll(".informe-columna span")].map((span) => span.textContent);
    expect(cabeceras()[2]).toBe(etiquetaDeCampo("medico", null, "es-AR"));
    expect(contenedor.querySelector(".informe-tabla tbody tr").children[2].textContent).toBe("medico:les-1");
    await act(async () => raiz.unmount());
    await montar();
    await tocar(botonQueEmpieza("Reporte individual"));
    await tocar(botonQueEmpieza("HULK"));
    expect(cabeceras()[2]).toBe(etiquetaDeCampo("medico", null, "es-AR"));
    expect(cabeceras()).toHaveLength(12);
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

  const texto = () => contenedor.textContent;
});
