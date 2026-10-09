import { describe, expect, it } from "vitest";
import { calcularFilas, vistaDeFilas } from "../motor.js";
import { armarConfig, opcionDeTexto } from "../ajustes.js";
import { COMO_PERSONA, leerEvaluacionesPegadas, planDeEvaluaciones } from "../importar.js";
import { ESTABILIDAD_ROTACIONAL as T } from "./estabilidadRotacional.js";

// Todo inventado: ningún nombre ni valor sale del Excel del club.
let orden = 0;
const evaluacion = (datos, fecha = "2026-06-24") => {
  orden += 1;
  return { id: `r${orden}`, orden, fecha, jugador_id: null, persona: "Ana Prueba", datos: { seleccion: "mayor", ...datos } };
};

describe("Estabilidad rotacional", () => {
  it("ocho listas, cuatro con cada pierna en apoyo, y sin valores de referencia", () => {
    expect(T.columnas.filter((columna) => columna.tipo === "lista" && columna.lista).map((columna) => `${columna.grupo}:${columna.clave}`)).toEqual([
      "derecha:cifosis_derecha_derecha",
      "derecha:cifosis_izquierda_derecha",
      "derecha:inestabilidad_derecha",
      "derecha:completa_recorrido_derecha",
      "izquierda:cifosis_derecha_izquierda",
      "izquierda:cifosis_izquierda_izquierda",
      "izquierda:inestabilidad_izquierda",
      "izquierda:completa_recorrido_izquierda",
    ]);
    expect(T.conReferencias).toBe(false);
    expect(T.reglas).toEqual([]);
  });

  it("el informe: cuántas tienen la respuesta y qué parte tiene cada opción, con las filas que se ven", () => {
    const filas = [
      evaluacion({ cifosis_derecha_derecha: "baja", inestabilidad_derecha: "si", completa_recorrido_derecha: "si" }),
      evaluacion({ cifosis_derecha_derecha: "alta_y_baja", inestabilidad_derecha: "no", completa_recorrido_derecha: "no_1" }),
      evaluacion({ cifosis_derecha_derecha: "no", inestabilidad_derecha: "no" }),
      evaluacion({ cifosis_derecha_derecha: "baja" }),
    ];
    const calc = calcularFilas(T, filas, null);
    expect(calc.map((una) => una.celdas.numero)).toEqual([1, 2, 3, 4]);
    const { informe } = vistaDeFilas(T, calc.map((una) => ({ id: una.fila.id, celdas: una.celdas })), null, "mayor");
    const fila = (id) => informe.find((una) => una.id === id).celdas;
    expect(informe.map((una) => una.id)).toEqual(["n", "parte1", "parte2", "parte3"]);
    expect(fila("n").numero.valor).toBe(4);
    expect(fila("n").cifosis_derecha_derecha).toEqual({ valor: 4, formato: "0" });
    expect(fila("n").inestabilidad_derecha.valor).toBe(3);
    // Cifosis: Baja, Baja/Alta (ALTA Y BAJA) y Alta.
    expect(fila("parte1").cifosis_derecha_derecha).toMatchObject({ valor: 0.5, formato: "0.0%", rotulo: { "es-AR": "Baja" } });
    expect(fila("parte2").cifosis_derecha_derecha.valor).toBe(0.25);
    expect(fila("parte3").cifosis_derecha_derecha.valor).toBe(0);
    // Inestabilidad: solo SI, sobre las que tienen la respuesta.
    expect(fila("parte1").inestabilidad_derecha.valor).toBeCloseTo(1 / 3, 12);
    expect(fila("parte2").inestabilidad_derecha).toBeUndefined();
    // Completa recorrido: NO 1, NO 1 y NO 2, NO 2.
    expect(fila("parte1").completa_recorrido_derecha.valor).toBe(0.5);
    // Sin ninguna respuesta en la columna, vacío (no #DIV/0!).
    expect(fila("n").cifosis_derecha_izquierda.valor).toBe(0);
    expect(fila("parte1").cifosis_derecha_izquierda.valor).toBe("");
  });

  it("al pegar, la opción se entiende como la escribe el Excel, sin importar mayúsculas, o como la llamó el club", () => {
    expect(opcionDeTexto("estabilidad_cifosis", "ALTA Y BAJA", null, T)).toBe("alta_y_baja");
    expect(opcionDeTexto("estabilidad_cifosis", "baja", null, T)).toBe("baja");
    expect(opcionDeTexto("estabilidad_recorrido", "NO 1 y 2", null, T)).toBe("no_1_y_2");
    expect(opcionDeTexto("estabilidad_si_no", "Sim", null, T)).toBe("si");
    expect(opcionDeTexto("estabilidad_si_no", "", null, T)).toBeNull();
    expect(opcionDeTexto("estabilidad_si_no", "QUIZÁS", null, T)).toBeUndefined();
    const config = armarConfig([], [{ lista: "estabilidad_cifosis", codigo: "media", etiqueta_es: "MEDIA", etiqueta_pt: "", orden: 9 }]);
    expect(opcionDeTexto("estabilidad_cifosis", "media", config, T)).toBe("media");
  });

  it("al pegar la hoja Funcional, lee la quinta Fecha y cada pregunta dos veces (derecha y después izquierda)", () => {
    const titulos = [
      "Jugador", "Fecha", "Evaluacion", "Seleccion", "PD", "PI", "Fecha", "PD", "PI", "Fecha", "PD", "PI", "Fecha", "BD", "BI", "Fecha", "Evaluacion",
      "Cifosis Derecha.", "Cifosis Izquierda.", "Inestabilidad.", "Completa recorrido.", "Cifosis Derecha", "Cifosis Izquierda", "Inestabilidad", "Completa recorrido",
    ];
    const texto = [
      titulos.join("\t"),
      ["ALFA", "10/06/2026", "1", "Mayor", "40", "42", "10/06/2026", "30", "31", "", "", "", "", "", "", "25/06/2026", "1", "BAJA", "NO", "SI", "SI", "ALTA", "NO", "NO", "NO 2"].join("\t"),
      // Solo movilidad: no es de Estabilidad rotacional.
      ["BETA", "11/06/2026", "1", "Mayor", "38", "38", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""].join("\t"),
      ["GAMA", "", "", "Mayor", "", "", "", "", "", "", "", "", "", "", "", "24/06/2026", "1", "no", "ALTA Y BAJA", "QUIZÁS", "SI", "", "", "", ""].join("\t"),
    ].join("\n");
    const leidas = leerEvaluacionesPegadas(texto, T);
    expect(Object.keys(leidas.columnas)).toHaveLength(11);
    const plan = planDeEvaluaciones(leidas.filas, { test: T, hoy: "2026-10-09", elegidos: Object.fromEntries(leidas.filas.map((una) => [una.indice, COMO_PERSONA])) });
    expect(plan.map((una) => una.nombre)).toEqual(["ALFA", "GAMA"]);
    expect(plan[0].evaluacion).toMatchObject({
      fecha: "2026-06-25",
      datos: {
        seleccion: "mayor",
        cifosis_derecha_derecha: "baja",
        cifosis_izquierda_derecha: "no",
        inestabilidad_derecha: "si",
        completa_recorrido_derecha: "si",
        cifosis_derecha_izquierda: "alta",
        cifosis_izquierda_izquierda: "no",
        inestabilidad_izquierda: "no",
        completa_recorrido_izquierda: "no_2",
      },
    });
    // Lo que no es una opción de la lista queda vacío, con su aviso.
    expect(plan[1].evaluacion.datos.cifosis_izquierda_derecha).toBe("alta_y_baja");
    expect(plan[1].evaluacion.datos).not.toHaveProperty("inestabilidad_derecha");
    expect(plan[1].avisos).toEqual([{ campo: "inestabilidad_derecha", valor: "QUIZÁS" }]);
  });
});
