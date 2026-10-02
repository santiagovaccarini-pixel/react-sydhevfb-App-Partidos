import { describe, expect, test } from "vitest";
import { NO_CARGAR, NUEVO, cambiosPara, emparejar, fechaDeNacimiento, formatoDeFechas, interpretarFila, leerPegado, normalizarCabecera } from "./importarJugadores.js";
import { OPCIONES } from "./lesionesCampos.js";

// Las listas como las arma la pantalla: el texto en español y, de alias, el
// del Excel en portugués.
const listas = Object.fromEntries(
  ["categoria", "pie_dominante", "posicion"].map((campo) => [
    campo,
    OPCIONES[campo].map((opcion) => ({ valor: opcion.codigo, etiqueta: opcion.etiquetas["es-AR"], alias: [opcion.etiquetas["pt-BR"]] })),
  ]),
);
const HOY = "2026-10-02";

// Como sale del Excel al copiar: títulos arriba, la fila de cabeceras y los
// jugadores (con columnas que no interesan en el medio).
const PEGADO = [
  "\tDatos Básicos",
  "",
  "Voltar ao menu inicial\tNome e Sobrenome\tCategoria\tD. Nac. (DD/MM/AAAA)\tP. Dominante\tPosicao\tLinks das fotos",
  "\tAna Uno\tProfissional\t25/07/1986\tEsquerdo\tDELANTERO CENTRAL\thttps://fotos.example/ana.jpg",
  "\tBea  Dos\tProfissional\t03/02/2004\tDireito\tGOLEIRO\t",
  "\t\t\t\t\t\t",
  "\tCata Tres\tSub-20\t31/02/2005\tAmbos\tCARRILERO\tsin foto",
].join("\n");

describe("leer lo pegado del Excel", () => {
  test("las cabeceras se reconocen como vengan escritas", () => {
    expect(normalizarCabecera("D. Nac. (DD/MM/AAAA)")).toBe("d nac");
    expect(normalizarCabecera("  Posição ")).toBe("posicao");
    expect(normalizarCabecera("Links das fotos")).toBe("links das fotos");
  });

  test("busca la fila de cabeceras debajo de los títulos y lee cada jugador", () => {
    const leido = leerPegado(PEGADO);
    expect(leido.error).toBe("");
    expect(leido.columnas).toEqual({ nombre: 1, categoria: 2, fecha_nacimiento: 3, pie_dominante: 4, posicion: 5, foto_url: 6 });
    // La fila vacía no cuenta; los espacios de más del nombre se van.
    expect(leido.filas.map((fila) => fila.nombre)).toEqual(["Ana Uno", "Bea Dos", "Cata Tres"]);
    expect(leido.filas[0].textos).toEqual({
      categoria: "Profissional",
      fecha_nacimiento: "25/07/1986",
      pie_dominante: "Esquerdo",
      posicion: "DELANTERO CENTRAL",
      foto_url: "https://fotos.example/ana.jpg",
    });
  });

  test("la fila de cabeceras es la que más cabeceras tiene, aunque arriba haya un título parecido", () => {
    const leido = leerPegado(["JUGADOR", "Nome e Sobrenome\tCategoria\tPosicao", "Ana Uno\tSub-20\tGOLEIRO"].join("\n"));
    expect(leido.columnas).toEqual({ nombre: 0, categoria: 1, posicion: 2 });
    expect(leido.filas.map((fila) => fila.nombre)).toEqual(["Ana Uno"]);
  });

  test("sin la fila de cabeceras no adivina", () => {
    expect(leerPegado("Ana Uno\tProfissional\t25/07/1986").error).toBe("datos.importar.sinCabeceras");
    expect(leerPegado("Nome e Sobrenome\tCategoria\n\t\n").error).toBe("datos.importar.sinFilas");
  });

  test("también entiende las cabeceras en español y las que el club renombró", () => {
    const leido = leerPegado("Nombre y apellido\tPuesto\tFecha de nacimiento\nAna Uno\tArquero\t1/2/1999");
    expect(leido.columnas).toEqual({ nombre: 0, posicion: 1, fecha_nacimiento: 2 });
    expect(leerPegado("Atleta\tNivel\nAna Uno\tSub-20", { alias: { nombre: ["Atleta"], categoria: ["Nivel"] } }).columnas).toEqual({ nombre: 0, categoria: 1 });
  });
});

describe("convertir cada fila a lo que guarda la app", () => {
  test("listas por su texto en cualquiera de los dos idiomas, fechas y enlaces", () => {
    const [ana, bea, cata] = leerPegado(PEGADO).filas.map((fila) => interpretarFila(fila, { listas, hoy: HOY }));
    expect(ana).toEqual({
      datos: { categoria: "profissional", fecha_nacimiento: "1986-07-25", pie_dominante: "esquerdo", posicion: "delantero_central", foto_url: "https://fotos.example/ana.jpg" },
      avisos: [],
    });
    expect(bea.datos).toEqual({ categoria: "profissional", fecha_nacimiento: "2004-02-03", pie_dominante: "direito", posicion: "goleiro" });
    // Lo que no se entiende no se carga y queda avisado.
    expect(cata.datos).toEqual({ categoria: "sub20" });
    expect(cata.avisos).toEqual([
      { campo: "fecha_nacimiento", valor: "31/02/2005" },
      { campo: "pie_dominante", valor: "Ambos" },
      { campo: "posicion", valor: "CARRILERO" },
      { campo: "foto_url", valor: "sin foto" },
    ]);
  });

  test("la fecha de nacimiento como venga del Excel", () => {
    expect(fechaDeNacimiento("25/07/1986", HOY)).toBe("1986-07-25");
    expect(fechaDeNacimiento("1986-07-25", HOY)).toBe("1986-07-25");
    expect(fechaDeNacimiento("25.07.1986", HOY)).toBe("1986-07-25");
    // Año con dos cifras: el siglo que no deja al jugador con menos de diez años.
    expect(fechaDeNacimiento("25/07/86", HOY)).toBe("1986-07-25");
    expect(fechaDeNacimiento("03/02/04", HOY)).toBe("2004-02-03");
    expect(fechaDeNacimiento("02/10/26", HOY)).toBe("1926-10-02");
    // La celda sin formato de fecha: el número de serie de Excel.
    expect(fechaDeNacimiento("31618", HOY)).toBe("1986-07-25");
    expect(fechaDeNacimiento("31618.0", HOY)).toBe("1986-07-25");
    expect(fechaDeNacimiento("", HOY)).toBe(null);
    // Lo que no es una fecha posible no se carga (ni rompe nada).
    ["1986", "123456789", "20000101", "25071986", "31/02/2005", "01/01/2030", "01/01/1900", "ayer"].forEach((texto) =>
      expect(fechaDeNacimiento(texto, HOY), texto).toBe(undefined),
    );
  });

  test("mes/día (un Excel en inglés) se decide por la columna entera, no fila por fila", () => {
    expect(formatoDeFechas(["07/25/1986", "05/01/1990", ""])).toBe("mes_dia");
    expect(formatoDeFechas(["25/07/1986", "05/01/1990"])).toBe("dia_mes");
    // Si unas obligan a leer día/mes y otras mes/día, queda lo del Excel (día/mes).
    expect(formatoDeFechas(["07/25/1986", "25/07/1986"])).toBe("dia_mes");
    expect(fechaDeNacimiento("07/25/1986", HOY)).toBe(undefined);
    expect(fechaDeNacimiento("07/25/1986", HOY, "mes_dia")).toBe("1986-07-25");
    expect(fechaDeNacimiento("05/01/1990", HOY, "mes_dia")).toBe("1990-05-01");
  });
});

describe("quién es cada fila en la app", () => {
  const plantel = [
    { id: 7, nombre: "HULK" },
    { id: 8, nombre: "SCARPA" },
    { id: 9, nombre: "José Pérez" },
    { id: 10, nombre: "SILVA" },
  ];
  const filas = (...nombres) => nombres.map((nombre, indice) => ({ indice, nombre, textos: {} }));

  test("el mismo nombre sin importar acentos ni mayúsculas; si no, uno que esté entero adentro", () => {
    expect(emparejar(filas("hulk", "Gustavo Scarpa", "JOSE PEREZ", "Mariano Nuevo"), plantel)).toEqual([
      { destino: "7", como: "igual" },
      { destino: "8", como: "parecido" },
      { destino: "9", como: "igual" },
      { destino: NUEVO, como: "nuevo" },
    ]);
  });

  test("lo dudoso no se sugiere y un jugador no queda para dos filas", () => {
    // SILVA le sirve a dos filas: no se sugiere para ninguna.
    expect(emparejar(filas("Ana Silva", "Bea Silva"), plantel).map((uno) => uno.como)).toEqual(["nuevo", "nuevo"]);
    // El mismo nombre dos veces en lo pegado: la segunda no se carga.
    expect(emparejar(filas("Hulk", "HULK"), plantel)).toEqual([
      { destino: "7", como: "igual" },
      { destino: NO_CARGAR, como: "repetido" },
    ]);
    // Si HULK ya es de una fila igual, otra parecida no se lo lleva.
    expect(emparejar(filas("Hulk", "Hulk Paraíba"), plantel).map((uno) => uno.destino)).toEqual(["7", NUEVO]);
  });

  test("a un jugador de la app le cambia solo lo distinto; lo vacío del Excel no borra", () => {
    const jugador = { id: 7, nombre: "HULK", categoria: "profissional", fecha_nacimiento: "1986-07-25", pie_dominante: "", posicion: "extremo", foto_url: "" };
    expect(cambiosPara({ categoria: "profissional", fecha_nacimiento: "1986-07-25", pie_dominante: "esquerdo", posicion: "delantero_central" }, jugador)).toEqual({
      pie_dominante: "esquerdo",
      posicion: "delantero_central",
    });
    expect(cambiosPara({}, jugador)).toEqual({});
  });
});
