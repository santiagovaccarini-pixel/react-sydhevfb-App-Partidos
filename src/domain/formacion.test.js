import { describe, expect, it } from "vitest";

import {
  FRANJAS,
  MAXIMO_EN_CANCHA,
  cambiarLinea,
  canchaDesdeTitulares,
  hayPuestosAMano,
  moverPuesto,
  nombreDeFormacion,
  normalizarCancha,
  ponerJugador,
  puestosDeCancha,
  reacomodarCancha,
  repartirFranja,
  titularesDeCancha,
  totalEnCancha,
} from "./formacion.js";

const franja = (id) => FRANJAS.find((f) => f.id === id);

describe("repartirFranja", () => {
  it("pone hasta cuatro en una sola línea", () => {
    const puntos = repartirFranja(4, franja("def"));
    expect(puntos).toHaveLength(4);
    expect(new Set(puntos.map((p) => p.y)).size).toBe(1);

    // Abierta hacia las bandas y simétrica respecto del medio.
    const x = puntos.map((p) => p.x);
    expect(x[0]).toBeLessThan(20);
    expect(x[3]).toBeGreaterThan(80);
    expect(x[0] + x[3]).toBeCloseTo(100);
    expect(x[1] + x[2]).toBeCloseTo(100);

    // Y con el aire justo para que dos no se pisen.
    expect(puntos[0].ancho).toBeLessThan(x[1] - x[0]);
  });

  it("abre dos filas desde cinco, con la más numerosa atrás", () => {
    const puntos = repartirFranja(5, franja("def"));
    expect(puntos).toHaveLength(5);

    const adelante = puntos.filter((p) => p.y === franja("def").desde);
    const atras = puntos.filter((p) => p.y === franja("def").hasta);
    expect(adelante).toHaveLength(2);
    expect(atras).toHaveLength(3);
  });

  it("achica el ancho de cada puesto cuando hay más en la fila", () => {
    const [dos] = repartirFranja(2, franja("med"));
    const [cuatro] = repartirFranja(4, franja("med"));
    expect(dos.ancho).toBeGreaterThan(cuatro.ancho);
  });

  it("no deja ningún puesto fuera de la cancha", () => {
    FRANJAS.forEach((f) => {
      for (let cantidad = 1; cantidad <= 8; cantidad += 1) {
        repartirFranja(cantidad, f).forEach((punto) => {
          // La ficha se dibuja centrada en su punto: lo que no puede pasarse
          // del borde es el punto más media ficha.
          expect(punto.x - punto.ancho / 2).toBeGreaterThanOrEqual(0);
          expect(punto.x + punto.ancho / 2).toBeLessThanOrEqual(100);
          expect(punto.y).toBeGreaterThanOrEqual(f.desde);
          expect(punto.y).toBeLessThanOrEqual(f.hasta);
        });
      }
    });
  });

  it("no devuelve nada para una línea vacía", () => {
    expect(repartirFranja(0, franja("ata"))).toEqual([]);
  });
});

describe("normalizarCancha", () => {
  it("arma la formación por defecto cuando no hay nada guardado", () => {
    expect(totalEnCancha(normalizarCancha(null))).toBe(MAXIMO_EN_CANCHA);
  });

  it("recorta lo que pase de diez entre las tres líneas", () => {
    const cancha = normalizarCancha({ lineas: { def: 8, med: 8, ata: 8 } });
    expect(totalEnCancha(cancha)).toBe(MAXIMO_EN_CANCHA);
    expect(cancha.lineas).toEqual({ def: 8, med: 2, ata: 0 });
  });

  it("descarta los puestos que ya no existen en la formación", () => {
    const cancha = normalizarCancha({
      lineas: { def: 2, med: 0, ata: 0 },
      puestos: { "def-0": { nombre: "VITAO" }, "def-5": { nombre: "LYANCO" } },
    });

    expect(cancha.puestos["def-0"]).toEqual({ nombre: "VITAO" });
    expect(cancha.puestos["def-5"]).toBeUndefined();
  });

  it("ignora una posición que no sean números", () => {
    const cancha = normalizarCancha({
      lineas: { def: 1, med: 0, ata: 0 },
      puestos: { "def-0": { nombre: "VITAO", x: "no", y: null } },
    });

    expect(cancha.puestos["def-0"]).toEqual({ nombre: "VITAO" });
  });
});

describe("puestosDeCancha", () => {
  it("numera de atrás hacia adelante", () => {
    const puestos = puestosDeCancha({ lineas: { def: 4, med: 4, ata: 2 } });
    expect(puestos).toHaveLength(10);
    expect(puestos.map((p) => p.numero)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(puestos.slice(0, 4).every((p) => p.franja === "def")).toBe(true);
    expect(puestos.slice(8).every((p) => p.franja === "ata")).toBe(true);
  });

  it("respeta la posición de los que moviste a mano", () => {
    const cancha = moverPuesto(
      { lineas: { def: 4, med: 4, ata: 2 } },
      "med-1",
      12.5,
      44,
    );
    const movido = puestosDeCancha(cancha).find((p) => p.id === "med-1");

    expect(movido.aMano).toBe(true);
    expect(movido.x).toBe(12.5);
    expect(movido.y).toBe(44);
    expect(hayPuestosAMano(cancha)).toBe(true);
  });

  it("no deja que una posición a mano se vaya de la cancha", () => {
    const cancha = moverPuesto(
      { lineas: { def: 1, med: 0, ata: 0 } },
      "def-0",
      -40,
      320,
    );
    const movido = puestosDeCancha(cancha)[0];

    expect(movido.x).toBe(0);
    expect(movido.y).toBe(100);
  });
});

describe("ponerJugador", () => {
  const vacia = { lineas: { def: 4, med: 4, ata: 2 }, puestos: {} };

  it("pone y saca un jugador", () => {
    const con = ponerJugador(vacia, "def-0", "  VITAO  ");
    expect(con.puestos["def-0"]).toEqual({ nombre: "VITAO" });

    const sin = ponerJugador(con, "def-0", "");
    expect(sin.puestos["def-0"]).toBeUndefined();
  });

  it("lo saca del puesto anterior, porque no puede estar dos veces", () => {
    const una = ponerJugador(vacia, "def-0", "VITAO");
    const otra = ponerJugador(una, "ata-0", "VITAO");

    expect(otra.puestos["def-0"]).toBeUndefined();
    expect(otra.puestos["ata-0"]).toEqual({ nombre: "VITAO" });
    expect(titularesDeCancha(otra).filter((n) => n === "VITAO")).toHaveLength(
      1,
    );
  });

  it("al mudarlo no le roba la posición al puesto que deja", () => {
    const movido = moverPuesto(
      ponerJugador(vacia, "def-0", "VITAO"),
      "def-0",
      30,
      80,
    );
    const mudado = ponerJugador(movido, "ata-0", "VITAO");

    expect(mudado.puestos["def-0"]).toEqual({ x: 30, y: 80 });
    expect(puestosDeCancha(mudado).find((p) => p.id === "def-0").nombre).toBe(
      "",
    );
  });

  it("le deja la posición al jugador que llega a un puesto ya movido", () => {
    const movido = moverPuesto(vacia, "med-2", 70, 50);
    const conJugador = ponerJugador(movido, "med-2", "SCARPA");

    expect(conJugador.puestos["med-2"]).toEqual({
      nombre: "SCARPA",
      x: 70,
      y: 50,
    });
  });
});

describe("cambiarLinea", () => {
  const base = { lineas: { def: 4, med: 4, ata: 2 }, puestos: {} };

  it("no pasa de diez entre las tres", () => {
    const igual = cambiarLinea(base, "med", 1);
    expect(totalEnCancha(igual)).toBe(10);
    expect(igual.lineas.med).toBe(4);
  });

  it("deja sumar después de restar en otra línea", () => {
    const menos = cambiarLinea(base, "ata", -1);
    const mas = cambiarLinea(menos, "def", 1);

    expect(nombreDeFormacion(mas)).toBe("5-4-1");
    expect(totalEnCancha(mas)).toBe(10);
  });

  it("no baja de cero", () => {
    const vacia = cambiarLinea(
      { lineas: { def: 0, med: 4, ata: 2 } },
      "def",
      -1,
    );
    expect(vacia.lineas.def).toBe(0);
  });

  it("suelta los movidos a mano de esa línea y respeta los de las otras", () => {
    const movida = moverPuesto(
      moverPuesto(base, "def-1", 10, 70),
      "ata-0",
      50,
      20,
    );
    const cambiada = cambiarLinea(movida, "def", -1);

    expect(puestosDeCancha(cambiada).find((p) => p.id === "def-1").aMano).toBe(
      false,
    );
    expect(puestosDeCancha(cambiada).find((p) => p.id === "ata-0").aMano).toBe(
      true,
    );
  });

  it("se lleva puestos al achicar una línea", () => {
    const llena = ponerJugador(base, "ata-1", "CUELLO");
    const chica = cambiarLinea(llena, "ata", -1);

    expect(titularesDeCancha(chica)).not.toContain("CUELLO");
    expect(totalEnCancha(chica)).toBe(9);
  });
});

describe("reacomodarCancha", () => {
  it("devuelve todo a la grilla sin perder los nombres", () => {
    const cancha = moverPuesto(
      ponerJugador(
        { lineas: { def: 4, med: 4, ata: 2 }, puestos: {} },
        "def-0",
        "VITAO",
      ),
      "def-0",
      5,
      95,
    );

    const derecha = reacomodarCancha(cancha);
    expect(hayPuestosAMano(derecha)).toBe(false);
    expect(titularesDeCancha(derecha)[0]).toBe("VITAO");
  });
});

describe("canchaDesdeTitulares", () => {
  it("acomoda un registro viejo respetando el orden que tenía", () => {
    const nombres = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const cancha = canchaDesdeTitulares(nombres);

    expect(nombreDeFormacion(cancha)).toBe("4-4-2");
    expect(titularesDeCancha(cancha)).toEqual(nombres);
  });

  it("aguanta una lista corta o con huecos", () => {
    const cancha = canchaDesdeTitulares(["VITAO", "", null, "SCARPA"]);
    expect(titularesDeCancha(cancha).filter(Boolean)).toEqual([
      "VITAO",
      "SCARPA",
    ]);
  });
});
