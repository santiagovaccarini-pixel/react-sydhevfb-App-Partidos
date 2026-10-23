import { describe, expect, test } from "vitest";
import {
  conBorradas,
  conCambio,
  conDia,
  conEnCurso,
  conFilaCambiada,
  conLoHechoMientras,
  conLoQueEspera,
  conLosCambios,
  conPegado,
  conDePartido,
  conReemplazo,
  conValorDeVr,
  conVrQueEspera,
  cuentaDeLaEspera,
  enCursoEnEspera,
  esLocal,
  filaQueEspera,
  idsEnEspera,
  sinEnCurso,
  sinVrQueEspera,
  subirLaEspera,
  vrEnEspera,
} from "./espera.js";

// Paso 3c.1 de «cargar sin señal y a la vez que otra persona» (Santiago,
// 23/10). Todo inventado.
const fila = (id, datos = {}, extra = {}) => ({ id, equipo_id: "eq-1", orden: 1, fecha: "2026-06-01", jugador_id: 7, persona: null, promedio: null, datos: { dispositivo: "catapult", tiempo: 3600, d: 6000, d_min: 100, ...datos }, ...extra });

describe("lo que entra en la fila de espera", () => {
  test("los cambios a una fila se juntan; lo que se veía antes del primero queda", () => {
    let cola = conCambio([], { id: "g1", cambios: { "datos.d": 6600 }, antes: { "datos.d": 6000 } });
    cola = conCambio(cola, { id: "g1", cambios: { "datos.d": 7200, fecha: "2026-06-02" }, antes: { "datos.d": 6600, fecha: "2026-06-01" } });
    expect(cola).toEqual([{ tipo: "cambiar", id: "g1", cambios: { "datos.d": 7200, fecha: "2026-06-02" }, antes: { "datos.d": 6000, fecha: "2026-06-01" } }]);
  });

  test("borrar varias: lo que esperaba para ellas sale; una ya borrada no se repite", () => {
    let cola = conCambio([], { id: "g1", cambios: { "datos.d": 6600 } });
    cola = conCambio(cola, { id: "g2", cambios: { "datos.d": 6700 } });
    cola = conBorradas(cola, ["g1", "g3"]);
    cola = conBorradas(cola, ["g3"]);
    expect(cola).toEqual([
      { tipo: "cambiar", id: "g2", cambios: { "datos.d": 6700 }, antes: {} },
      { tipo: "borrar", id: "g1" },
      { tipo: "borrar", id: "g3" },
    ]);
  });
});

describe("cómo se ve con lo que espera", () => {
  test("lo cambiado, con su «por minuto» recalculado (y todos si cambió el Tiempo); lo borrado no está", () => {
    expect(conLosCambios(fila("g1"), { "datos.d": 7200 }).datos).toMatchObject({ d: 7200, d_min: 120 });
    expect(conLosCambios(fila("g1"), { "datos.tiempo": 1800 }).datos).toMatchObject({ tiempo: 1800, d_min: 200 });
    expect(conLosCambios(fila("g1"), { "datos.d": null, promedio: "equipo" })).toMatchObject({ promedio: "equipo", datos: { tiempo: 3600 } });
    let cola = conCambio([], { id: "g1", cambios: { "datos.d": 7200 } });
    cola = conBorradas(cola, ["g2"]);
    const filas = [fila("g1"), fila("g2"), fila("g3")];
    const vistas = conLoQueEspera(filas, cola);
    expect(vistas.map((una) => [una.id, una.datos.d])).toEqual([
      ["g1", 7200],
      ["g3", 6000],
    ]);
    expect(conLoQueEspera(vistas, cola)).toEqual(vistas);
    // Sin nada esperando, las mismas filas.
    expect(conLoQueEspera(filas, [])).toBe(filas);
    expect(idsEnEspera(cola)).toEqual(new Set(["g1"]));
  });
});

describe("al volver la señal", () => {
  const llamadas = [];
  const funciones = (respuestas = {}) => ({
    cambiar: async (id, { cambios }) => {
      llamadas.push(["cambiar", id, cambios]);
      return (respuestas.cambiar || {})[id] || { fila: { id, devuelta: true }, pisadas: [], error: "" };
    },
    actualizar: async (id, una) => {
      llamadas.push(["actualizar", id, una.datos]);
      return { fila: una, error: "" };
    },
    borrar: async (ids) => {
      llamadas.push(["borrar", ids]);
      return respuestas.borrar || { borradas: ids, error: "" };
    },
  });
  const esDeRed = (respuesta) => /Failed to fetch/.test(`${respuesta?.detalle || ""}`);
  const subir = (cola, { respuestas, filaDe } = {}) => {
    llamadas.length = 0;
    return subirLaEspera(cola, { funciones: funciones(respuestas), filaDe, esDeRed });
  };

  test("sube todo en orden: los borrados seguidos, juntos; dice cuántos subieron y qué pisó", async () => {
    let cola = conCambio([], { id: "g1", cambios: { "datos.d": 7200 }, antes: { "datos.d": 6000 } });
    cola = conBorradas(cola, ["g2", "g3"]);
    cola = conCambio(cola, { id: "g4", cambios: { "datos.d": 5000 }, antes: { "datos.d": 4000 } });
    const respuesta = await subir(cola, { respuestas: { cambiar: { g4: { fila: {}, pisadas: [{ clave: "datos.d", habia: 4500 }], error: "" } } } });
    expect(llamadas).toEqual([
      ["cambiar", "g1", { "datos.d": 7200 }],
      ["borrar", ["g2", "g3"]],
      ["cambiar", "g4", { "datos.d": 5000 }],
    ]);
    expect(respuesta).toMatchObject({ subidos: 4, pisadas: [{ clave: "datos.d", habia: 4500, id: "g4" }], quedan: [], errores: [], cortado: false });
    // Para que la pantalla no espere a ponerse al día.
    expect(respuesta.devueltas).toEqual([{ id: "g1", devuelta: true }]);
    expect(respuesta.borradas).toEqual(["g2", "g3"]);
  });

  test("sin señal en el camino se corta y lo que falta queda; un error de la base no se reintenta; una que otro borró se cuenta", async () => {
    let cola = conCambio([], { id: "g1", cambios: { "datos.d": 7200 } });
    cola = conCambio(cola, { id: "g2", cambios: { "datos.d": 7300 } });
    cola = conBorradas(cola, ["g3"]);
    cola = conCambio(cola, { id: "g4", cambios: { "datos.d": 7400 } });
    const respuesta = await subir(cola, {
      respuestas: {
        cambiar: { g1: { borrada: true, error: "" }, g2: { error: "gps.error.sinPermiso" } },
        borrar: { borradas: [], error: "gps.error.noBorrar", detalle: "TypeError: Failed to fetch" },
      },
    });
    expect(respuesta).toMatchObject({ subidos: 0, borradasPorOtra: 1, errores: [{ error: "gps.error.sinPermiso", ids: ["g2"] }], cortado: true });
    expect(respuesta.quedan).toEqual([cola[2], cola[3]]);
  });

  test("sin la actualización de la base, el cambio va sobre la fila entera", async () => {
    const cola = conCambio([], { id: "g1", cambios: { "datos.d": 7200 } });
    const respuesta = await subir(cola, { respuestas: { cambiar: { g1: { sinFuncion: true, error: "" } } }, filaDe: (id) => fila(id) });
    expect(llamadas.at(-1)).toEqual(["actualizar", "g1", expect.objectContaining({ d: 7200, d_min: 120 })]);
    expect(respuesta.subidos).toBe(1);
  });

  test("lo que se hizo mientras subía queda; lo subido sale", async () => {
    const enviada = conBorradas(conCambio([], { id: "g1", cambios: { "datos.d": 7200 } }), ["g2"]);
    const respuesta = await subir(enviada);
    const ahora = conCambio(enviada, { id: "g5", cambios: { "datos.d": 1 } });
    expect(conLoHechoMientras(ahora, { enviada, ...respuesta })).toEqual([{ tipo: "cambiar", id: "g5", cambios: { "datos.d": 1 }, antes: {} }]);
  });
});

// Paso 3c.2b (Santiago, 23/10): «Cargar un día» sin señal; lo dejado para
// revisar «Queda en el aparato»; al subir, las reglas del «Mismo CSV».
describe("un día cargado sin señal", () => {
  const delDia = (id, d, extra = {}) => ({ fecha: "2026-06-02", jugador_id: id, persona: null, promedio: null, datos: { dispositivo: "catapult", d, tiempo: 1200, inicio: 36000 }, ...extra });

  test("entra con un id para cada fila y se ve en su fecha, después de las de la base y en otro color", () => {
    const { cola, id } = conDia([], { fecha: "2026-06-02", dispositivo: "catapult", filas: [delDia(1, 3000), delDia(2, 2800)] });
    expect(esLocal(id)).toBe(true);
    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({ tipo: "dia", fecha: "2026-06-02", dispositivo: "catapult", enCurso: null });
    expect(cola[0].filas.map((una) => una.id)).toEqual([`${id}#1`, `${id}#2`]);
    const base = [fila("g1", {}, { fecha: "2026-06-01" }), fila("g2", {}, { fecha: "2026-06-02" }), fila("g3", {}, { fecha: "2026-06-03" })];
    const vistas = conLoQueEspera(base, cola);
    expect(vistas.map((una) => una.id)).toEqual(["g1", "g2", `${id}#1`, `${id}#2`, "g3"]);
    expect(conLoQueEspera(vistas, cola)).toEqual(vistas);
    expect(idsEnEspera(cola)).toEqual(new Set([`${id}#1`, `${id}#2`]));
    expect(cuentaDeLaEspera(cola)).toEqual({ total: 2, chocan: 0, pendientes: 1 });
  });

  test("sus filas se cambian y se borran en el día (sin él, si se queda sin filas)", () => {
    let { cola, id } = conDia([], { fecha: "2026-06-02", filas: [delDia(1, 3000), delDia(2, 2800)] });
    const primera = filaQueEspera(cola, `${id}#1`);
    cola = conFilaCambiada(cola, { ...primera, datos: { ...primera.datos, d: 3100 } });
    expect(filaQueEspera(cola, `${id}#1`).datos.d).toBe(3100);
    cola = conBorradas(cola, [`${id}#2`, "g9"]);
    expect(cola.map((uno) => uno.tipo)).toEqual(["dia", "borrar"]);
    expect(cola[0].filas.map((una) => una.id)).toEqual([`${id}#1`]);
    cola = conBorradas(cola, [`${id}#1`]);
    expect(cola).toEqual([{ tipo: "borrar", id: "g9" }]);
  });

  test("dejar para revisar queda en el aparato; seguirla y dejarla otra vez la cambia; guardarla la saca", () => {
    let { cola, id } = conEnCurso([], { id: "ec1", version: 3, fecha: "2026-06-02", paso: 2, resumen: { titulo: "1. Rondo" }, datos: { formato: 1 }, dejadaEn: "2026-06-02T10:00:00Z" });
    expect(cola).toEqual([{ tipo: "enCurso", id, base: { id: "ec1", version: 3 }, fecha: "2026-06-02", paso: 2, resumen: { titulo: "1. Rondo" }, datos: { formato: 1 }, dejadaEn: "2026-06-02T10:00:00Z" }]);
    ({ cola } = conEnCurso(cola, { id, fecha: "2026-06-02", paso: 4, datos: { formato: 1, mas: true }, dejadaEn: "2026-06-02T11:00:00Z" }));
    expect(enCursoEnEspera(cola)).toEqual([expect.objectContaining({ id, base: { id: "ec1", version: 3 }, paso: 4 })]);
    // Guardada sin señal: el día recuerda la de la base que se había seguido.
    const conElDia = conDia(cola, { fecha: "2026-06-02", filas: [delDia(1, 3000)], enCurso: { id } });
    expect(conElDia.cola.map((uno) => uno.tipo)).toEqual(["dia"]);
    expect(conElDia.cola[0].enCurso).toBe("ec1");
    expect(sinEnCurso(cola, id)).toEqual([]);
  });

  const llamadas = [];
  const funciones = ({ base = [], enCurso = [], guardar = null, dejar = null } = {}) => ({
    guardarDia: async (dia) => {
      llamadas.push(["guardarDia", dia.fecha, dia.filas.length, dia.reemplazar]);
      return guardar ? guardar(dia) : { creadas: dia.filas.length, reemplazadas: 0, error: "" };
    },
    crear: async (filas) => {
      llamadas.push(["crear", filas.length]);
      return { creadas: filas, error: "" };
    },
    listar: async (fecha) => {
      llamadas.push(["listar", fecha]);
      return { filas: base.filter((una) => una.fecha === fecha), error: "" };
    },
    borrarEnCurso: async (id) => {
      llamadas.push(["borrarEnCurso", id]);
      return { error: "" };
    },
    enCursos: async (fecha) => ({ enCurso: enCurso.filter((una) => una.fecha === fecha).map(({ datos, ...resto }) => resto), error: "" }),
    leerEnCurso: async (id) => ({ enCurso: enCurso.find((una) => una.id === id), error: "" }),
    dejar: async (carga) => {
      llamadas.push(["dejar", carga.id, carga.version]);
      return dejar ? dejar(carga) : { id: "ec9", version: 1, error: "" };
    },
  });
  const esDeRed = (respuesta) => /Failed to fetch/.test(`${respuesta?.detalle || ""}`);
  // Las filas del CSV de lo hecho (en las pruebas, ya leídas).
  const csvDe = (datos) => datos?.csv || [];
  const subir = (cola, opciones) => {
    llamadas.length = 0;
    return subirLaEspera(cola, { funciones: funciones(opciones), csvDe, esDeRed });
  };

  test("al subir, el día va de una vez y la carga sin terminar que se siguió deja de estarlo", async () => {
    const { cola } = conDia([], { fecha: "2026-06-02", dispositivo: "catapult", filas: [delDia(1, 3000), delDia(2, 2800)], enCurso: { id: "ec1" } });
    const respuesta = await subir(cola);
    expect(llamadas).toEqual([
      ["guardarDia", "2026-06-02", 2, false],
      ["borrarEnCurso", "ec1"],
    ]);
    expect(respuesta).toMatchObject({ subidos: 2, quedan: [], errores: [], descartadas: [], conEnCurso: true });
  });

  test("si otra persona ya cargó ese CSV, se descarta y avisa; si es la misma sesión con otros datos, espera y pregunta", async () => {
    const { cola } = conDia([], { fecha: "2026-06-02", dispositivo: "catapult", filas: [delDia(1, 3000)] });
    const yaEsta = await subir(cola, { guardar: () => ({ yaEsta: true, error: "gps.cargar.yaEstaAlGuardar" }) });
    expect(yaEsta).toMatchObject({ subidos: 0, quedan: [], errores: [], descartadas: [{ tipo: "dia", fecha: "2026-06-02" }] });

    const otra = { id: "g7", ...delDia(1, 3500) };
    const chocan = await subir(cola, { base: [otra], guardar: () => ({ conOtras: true, error: "" }) });
    expect(chocan.quedan).toEqual([{ ...cola[0], chocan: true }]);
    expect(chocan.chocadas).toEqual([{ carga: chocan.quedan[0], existentes: [otra], dias: [{ fecha: "2026-06-02", filas: [otra] }] }]);
    expect(cuentaDeLaEspera(chocan.quedan)).toEqual({ total: 1, chocan: 1, pendientes: 0 });
    // Lo que volvió cambiado queda en su lugar.
    expect(conLoHechoMientras(cola, { enviada: cola, quedan: chocan.quedan })).toEqual(chocan.quedan);
    // «Reemplazar y cargar»: se sube reemplazando.
    const reemplazo = conReemplazo(chocan.quedan, cola[0].id);
    expect(reemplazo[0]).toMatchObject({ chocan: false, reemplazar: true });
    await subir(reemplazo);
    expect(llamadas[0]).toEqual(["guardarDia", "2026-06-02", 1, true]);
  });

  test("sin señal en el camino, el día queda; sin la actualización de la base, la app mira las reglas y lo crea", async () => {
    const { cola } = conDia([], { fecha: "2026-06-02", filas: [delDia(1, 3000)] });
    const cortado = await subir(cola, { guardar: () => ({ error: "gps.error.sinConexion", detalle: "TypeError: Failed to fetch" }) });
    expect(cortado).toMatchObject({ cortado: true, quedan: cola, subidos: 0 });

    const sinFuncion = await subir(cola, { guardar: () => ({ sinFuncion: true, error: "" }) });
    expect(llamadas.map((una) => una[0])).toEqual(["guardarDia", "listar", "crear"]);
    expect(sinFuncion).toMatchObject({ subidos: 1, quedan: [] });
    const yaEsta = await subir(cola, { base: [{ id: "g7", ...delDia(1, 3000) }], guardar: () => ({ sinFuncion: true, error: "" }) });
    expect(yaEsta.descartadas).toEqual([{ tipo: "dia", fecha: "2026-06-02" }]);
  });

  const csv = (d) => [{ nombre: "A", valores: { d, tiempo: 1200, inicio: 36000 } }];
  const dejada = (extra = {}) => conEnCurso([], { fecha: "2026-06-02", paso: 1, resumen: {}, datos: { csv: csv(3000) }, dejadaEn: "2026-06-02T10:00:00Z", ...extra }).cola;

  test("al subir, lo dejado para revisar va a «Sin terminar» (nueva, o la que se siguió)", async () => {
    const nueva = await subir(dejada());
    expect(llamadas).toEqual([
      ["listar", "2026-06-02"],
      ["dejar", null, null],
    ]);
    expect(nueva).toMatchObject({ subidos: 1, quedan: [], conEnCurso: true, subidasEnCurso: [{ local: expect.any(String), id: "ec9" }] });

    const seguida = dejada({ id: "ec1", version: 2 });
    await subir(seguida, { enCurso: [{ id: "ec1", fecha: "2026-06-02", datos: { csv: csv(3000) } }] });
    expect(llamadas.at(-1)).toEqual(["dejar", "ec1", 2]);
    // La que se siguió ya no está: queda como nueva.
    await subir(seguida, { dejar: (carga) => (carga.id ? { error: "gps.enCurso.noEsta" } : { id: "ec9", version: 1, error: "" }) });
    expect(llamadas.filter((una) => una[0] === "dejar")).toEqual([
      ["dejar", "ec1", 2],
      ["dejar", null, null],
    ]);
  });

  test("con el mismo CSV en la Base o en otra carga sin terminar, o si la siguieron en otro aparato, avisa y la descarta", async () => {
    const enLaBase = await subir(dejada(), { base: [{ id: "g7", ...delDia(1, 3000) }] });
    expect(enLaBase).toMatchObject({ subidos: 0, quedan: [], descartadas: [{ tipo: "enLaBase", fecha: "2026-06-02", otra: null }] });

    const otra = { id: "ec5", fecha: "2026-06-02", actualizado_email: "otra@club.com", datos: { csv: csv(3000) } };
    const repetida = await subir(dejada(), { enCurso: [otra] });
    expect(repetida.descartadas).toEqual([{ tipo: "repetida", fecha: "2026-06-02", otra: expect.objectContaining({ id: "ec5", actualizado_email: "otra@club.com" }) }]);
    expect(llamadas.some((una) => una[0] === "dejar")).toBe(false);
    // Otro CSV del mismo día (otro turno) sí va.
    const otroTurno = await subir(dejada(), { enCurso: [{ ...otra, datos: { csv: csv(5000) } }] });
    expect(otroTurno.subidos).toBe(1);

    const otroAparato = await subir(dejada({ id: "ec1", version: 2 }), { dejar: () => ({ error: "gps.enCurso.otroAparato" }) });
    expect(otroAparato.descartadas).toEqual([{ tipo: "otroAparato", fecha: "2026-06-02", otra: null }]);
  });
});

// Paso 3c.3 (Santiago, 23/10): «Pegar desde una planilla» sin señal; al
// subir, lo que ya está no se carga de nuevo y la Regla 1 espera y pregunta.
describe("lo pegado sin señal", () => {
  const pegada = (fecha, id, d, extra = {}) => ({ fecha, jugador_id: id, persona: null, promedio: null, datos: { dispositivo: "catapult", d, tiempo: 1200, inicio: 36000, ...extra } });
  const PEGADAS = () => [pegada("2026-06-01", 1, 3000), pegada("2026-06-01", 2, 2800), pegada("2026-06-02", 1, 3100), pegada("2026-06-02", 2, 2900)];

  test("entra con un id para cada fila, se ve en sus fechas y se cambia y se borra ahí", () => {
    const { cola, id } = conPegado([], { dispositivo: "catapult", filas: PEGADAS() });
    expect(cola[0]).toMatchObject({ tipo: "pegado", dispositivo: "catapult" });
    expect(cola[0].filas.map((una) => una.id)).toEqual([1, 2, 3, 4].map((n) => `${id}#${n}`));
    const vistas = conLoQueEspera([fila("g1", {}, { fecha: "2026-06-01" }), fila("g9", {}, { fecha: "2026-06-03" })], cola);
    expect(vistas.map((una) => una.id)).toEqual(["g1", `${id}#1`, `${id}#2`, `${id}#3`, `${id}#4`, "g9"]);
    expect(idsEnEspera(cola).size).toBe(4);
    expect(cuentaDeLaEspera(cola)).toEqual({ total: 4, chocan: 0, pendientes: 1 });
    let otra = conFilaCambiada(cola, { ...filaQueEspera(cola, `${id}#2`), datos: { d: 1 } });
    expect(filaQueEspera(otra, `${id}#2`).datos).toEqual({ d: 1 });
    otra = conBorradas(otra, [`${id}#1`, `${id}#2`, `${id}#3`, `${id}#4`]);
    expect(otra).toEqual([]);
  });

  const llamadas = [];
  const funciones = ({ base = [], pegar = null } = {}) => ({
    listar: async (desde, hasta) => {
      llamadas.push(["listar", desde, hasta]);
      return { filas: base.filter((una) => una.fecha >= desde && una.fecha <= hasta), error: "" };
    },
    pegar: async ({ dispositivo, filas, reemplazar }) => {
      llamadas.push(["pegar", dispositivo, filas.map((una) => `${una.fecha}|${una.jugador_id}`), reemplazar]);
      return pegar ? pegar(filas) : { creadas: filas.length, yaEstaban: 0, reemplazadas: 0, error: "" };
    },
    crear: async (filas) => {
      llamadas.push(["crear", filas.length]);
      return { creadas: filas, error: "" };
    },
  });
  const esDeRed = (respuesta) => /Failed to fetch/.test(`${respuesta?.detalle || ""}`);
  const subir = (cola, opciones) => {
    llamadas.length = 0;
    return subirLaEspera(cola, { funciones: funciones(opciones), esDeRed });
  };

  test("al subir, va todo de una vez; lo que ya estaba igual no se carga de nuevo y se avisa", async () => {
    const { cola } = conPegado([], { dispositivo: "catapult", filas: PEGADAS() });
    const respuesta = await subir(cola, { pegar: (filas) => ({ creadas: filas.length - 1, yaEstaban: 1, reemplazadas: 0, error: "" }) });
    expect(llamadas).toEqual([
      ["listar", "2026-06-01", "2026-06-02"],
      ["pegar", "catapult", ["2026-06-01|1", "2026-06-01|2", "2026-06-02|1", "2026-06-02|2"], false],
    ]);
    expect(respuesta).toMatchObject({ subidos: 3, quedan: [], descartadas: [{ tipo: "pegado", n: 1 }] });
  });

  test("un día que es la misma sesión con otros datos espera y pregunta; los demás suben; «Reemplazar y cargar» los reemplaza", async () => {
    const { cola } = conPegado([], { dispositivo: "catapult", filas: PEGADAS() });
    const otra = { id: "g7", ...pegada("2026-06-02", 1, 3500) };
    const respuesta = await subir(cola, { base: [otra] });
    expect(llamadas[1]).toEqual(["pegar", "catapult", ["2026-06-01|1", "2026-06-01|2"], false]);
    expect(respuesta.subidos).toBe(2);
    expect(respuesta.quedan).toEqual([{ ...cola[0], filas: cola[0].filas.slice(2), chocan: true }]);
    expect(respuesta.chocadas).toEqual([{ carga: respuesta.quedan[0], existentes: [otra], dias: [{ fecha: "2026-06-02", filas: [otra] }] }]);
    // Lo que volvió cambiado queda en su lugar.
    expect(conLoHechoMientras(cola, { enviada: cola, quedan: respuesta.quedan })).toEqual(respuesta.quedan);
    const reemplazo = conReemplazo(respuesta.quedan, cola[0].id);
    await subir(reemplazo, { base: [otra] });
    expect(llamadas[1]).toEqual(["pegar", "catapult", ["2026-06-02|1", "2026-06-02|2"], true]);
    // Una fila igual a la que ya está no hace chocar ese día.
    const igual = { id: "g8", ...pegada("2026-06-02", 1, 3100) };
    const sinChoque = await subir(cola, { base: [igual] });
    expect(sinChoque.chocadas).toEqual([]);
  });

  test("sin señal en el camino queda todo; si otra persona cargó esos días mientras tanto, espera y pregunta; sin la actualización, la app deja afuera lo que ya está", async () => {
    const { cola } = conPegado([], { dispositivo: "catapult", filas: PEGADAS() });
    const cortado = await subir(cola, { pegar: () => ({ creadas: 0, yaEstaban: 0, reemplazadas: 0, error: "gps.error.noGuardar", detalle: "TypeError: Failed to fetch" }) });
    expect(cortado).toMatchObject({ cortado: true, quedan: cola, subidos: 0 });

    const base = [];
    const mientras = await subirLaEspera(cola, {
      funciones: {
        ...funciones(),
        listar: async (desde, hasta) => ({ filas: base.filter((una) => una.fecha >= desde && una.fecha <= hasta), error: "" }),
        pegar: async () => {
          base.push({ id: "g7", ...pegada("2026-06-01", 2, 2500) });
          return { creadas: 0, yaEstaban: 0, reemplazadas: 0, conOtras: true, error: "" };
        },
      },
      esDeRed,
    });
    expect(mientras.quedan).toEqual([{ ...cola[0], chocan: true }]);
    expect(mientras.chocadas[0].dias.map((dia) => dia.fecha)).toEqual(["2026-06-01"]);

    const igual = { id: "g8", ...pegada("2026-06-01", 1, 3000) };
    const sinFuncion = await subir(cola, { base: [igual], pegar: () => ({ sinFuncion: true, creadas: 0, yaEstaban: 0, reemplazadas: 0, error: "" }) });
    expect(llamadas.at(-1)).toEqual(["crear", 3]);
    expect(sinFuncion).toMatchObject({ subidos: 3, quedan: [], descartadas: [{ tipo: "pegado", n: 1 }] });
  });
});

describe("los V.R. sin señal", () => {
  // Paso 3c.4 (Santiago, 23/10: «Números y "de partido"»; si otra persona
  // cambió el mismo número, gana el último y avisa). Todo inventado.
  const CATEGORIAS = { excelente: {}, muy_bueno: {}, regular: {}, malo: {} };
  const vr = (id, extra = {}) => ({ id, dispositivo: "catapult", tipo: "Futbol", tabla: "Oficial", grupo: "TOTAL", orden: 1, promedio: { d: 6000 }, desvio: { d: 500 }, categorias: CATEGORIAS, dePartido: false, planilla: null, ...extra });

  test("un número cambiado otra vez queda el último, con lo que se veía antes del primero; vuelto a como estaba, ya no espera", () => {
    let cola = conValorDeVr([], { id: "r1", cual: "promedio", clave: "d", valor: 6100, antes: 6000 });
    cola = conValorDeVr(cola, { id: "r1", cual: "promedio", clave: "d", valor: 6200, antes: 6100 });
    cola = conValorDeVr(cola, { id: "r1", cual: "excelente", clave: "d", valor: 7000, antes: undefined });
    expect(cola).toEqual([
      { tipo: "vr", id: "r1", cual: "promedio", clave: "d", valor: 6200, antes: 6000 },
      { tipo: "vr", id: "r1", cual: "excelente", clave: "d", valor: 7000, antes: null },
    ]);
    expect(conValorDeVr(cola, { id: "r1", cual: "promedio", clave: "d", valor: 6000, antes: 6200 })).toEqual([cola[1]]);
    expect(sinVrQueEspera(cola, { id: "r1", cual: "excelente", clave: "d" })).toEqual([cola[0]]);
  });

  test("el de partido: queda el último; vuelto al de antes, ya no espera", () => {
    let cola = conDePartido([], { dispositivo: "catapult", vr: "r2", antes: "r1" });
    cola = conDePartido(cola, { dispositivo: "catapult", vr: null, antes: "r2" });
    expect(cola).toEqual([{ tipo: "dePartido", dispositivo: "catapult", vr: null, antes: "r1" }]);
    expect(conDePartido(cola, { dispositivo: "catapult", vr: "r1", antes: null })).toEqual([]);
    expect(sinVrQueEspera(cola, { dispositivo: "catapult" })).toEqual([]);
  });

  test("se ven con lo que espera encima y se sabe qué pintar", () => {
    const referencias = [vr("r1", { dePartido: true }), vr("r2"), vr("r3", { dispositivo: "sport" })];
    expect(conVrQueEspera(referencias, [])).toBe(referencias);
    let cola = conValorDeVr([], { id: "r1", cual: "desvio", clave: "d", valor: null, antes: 500 });
    cola = conValorDeVr(cola, { id: "r2", cual: "malo", clave: "tiempo", valor: 1200, antes: null });
    cola = conDePartido(cola, { dispositivo: "catapult", vr: "r2", antes: "r1" });
    const vistas = conVrQueEspera(referencias, cola);
    expect(vistas[0]).toMatchObject({ desvio: {}, dePartido: false });
    expect(vistas[1]).toMatchObject({ categorias: { ...CATEGORIAS, malo: { tiempo: 1200 } }, dePartido: true });
    expect(vistas[2]).toBe(referencias[2]);
    expect(referencias[0].desvio).toEqual({ d: 500 });
    expect(vrEnEspera(cola)).toEqual({ numeros: new Set(["r1|desvio|d", "r2|malo|tiempo"]), dePartido: new Set(["r2", "r1"]) });
    expect(cuentaDeLaEspera(cola)).toEqual({ total: 3, chocan: 0, pendientes: 3 });
  });

  const llamadas = [];
  const funciones = ({ base = [], cambiar = null, marcar = null, leer = null } = {}) => ({
    leerReferencias: async () => {
      llamadas.push(["leer"]);
      return leer ? leer() : { referencias: base, error: "" };
    },
    cambiarVr: async (id, cual, clave, valor) => {
      llamadas.push(["cambiarVr", id, cual, clave, valor]);
      if (cambiar) return cambiar();
      const referencia = base.find((una) => una.id === id);
      return { referencia: conVrQueEspera([referencia], [{ tipo: "vr", id, cual, clave, valor }])[0], error: "" };
    },
    marcar: async (id, marcarlo) => {
      llamadas.push(["marcar", id, marcarlo]);
      if (marcar) return marcar();
      const dispositivo = base.find((una) => una.id === id).dispositivo;
      return { referencias: base.filter((una) => una.dispositivo === dispositivo).map((una) => ({ ...una, dePartido: marcarlo ? una.id === id : una.dePartido && una.id !== id })), error: "" };
    },
  });
  const esDeRed = (respuesta) => /Failed to fetch/.test(`${respuesta?.detalle || ""}`);
  const subir = (cola, opciones) => {
    llamadas.length = 0;
    return subirLaEspera(cola, { funciones: funciones(opciones), esDeRed });
  };

  test("al subir: lee los V.R. una vez; gana el último y avisa si otra persona lo había cambiado; lo que ya está así no se cambia", async () => {
    let cola = conValorDeVr([], { id: "r1", cual: "promedio", clave: "d", valor: 6100, antes: 6000 });
    cola = conValorDeVr(cola, { id: "r1", cual: "desvio", clave: "d", valor: 450, antes: 500 });
    cola = conValorDeVr(cola, { id: "r2", cual: "promedio", clave: "d", valor: 5000, antes: 6000 });
    cola = conDePartido(cola, { dispositivo: "catapult", vr: "r2", antes: "r1" });
    // Otra persona: el desvío de r1 a 480 y el promedio de r2 ya en 5000.
    const base = [vr("r1", { dePartido: true, desvio: { d: 480 } }), vr("r2", { promedio: { d: 5000 } })];
    const hecho = await subir(cola, { base });
    expect(llamadas).toEqual([["leer"], ["cambiarVr", "r1", "promedio", "d", 6100], ["cambiarVr", "r1", "desvio", "d", 450], ["marcar", "r2", true]]);
    expect(hecho).toMatchObject({ subidos: 4, vrPisados: 1, dePartidoPisados: [], vrBorrados: 0, quedan: [], errores: [] });
    expect(hecho.devueltasVr.at(-1)).toMatchObject({ id: "r2", dePartido: true });
  });

  test("el de partido que otra persona cambió mientras tanto: queda el de este aparato y se avisa; ninguno desmarca el que hay", async () => {
    const otra = [vr("r1"), vr("r2"), vr("r3", { dePartido: true })];
    const marcado = await subir(conDePartido([], { dispositivo: "catapult", vr: "r2", antes: "r1" }), { base: otra });
    expect(marcado).toMatchObject({ subidos: 1, dePartidoPisados: ["catapult"] });
    const ninguno = await subir(conDePartido([], { dispositivo: "catapult", vr: null, antes: "r1" }), { base: otra });
    expect(llamadas.at(-1)).toEqual(["marcar", "r3", false]);
    expect(ninguno).toMatchObject({ subidos: 1, dePartidoPisados: ["catapult"] });
  });

  test("si otra persona borró el V.R., no sube y se avisa; sin señal en el camino queda; un error de la base no se reintenta", async () => {
    let cola = conValorDeVr([], { id: "r9", cual: "promedio", clave: "d", valor: 1, antes: 2 });
    cola = conDePartido(cola, { dispositivo: "catapult", vr: "r9", antes: null });
    expect(await subir(cola, { base: [vr("r1")] })).toMatchObject({ subidos: 0, vrBorrados: 2, quedan: [] });

    const red = { error: "gps.error.noLeer", detalle: "TypeError: Failed to fetch" };
    expect(await subir(cola, { leer: () => ({ referencias: [], ...red }) })).toMatchObject({ cortado: true, quedan: cola });
    const uno = conValorDeVr([], { id: "r1", cual: "promedio", clave: "d", valor: 1, antes: 6000 });
    expect(await subir(uno, { base: [vr("r1")], cambiar: () => ({ error: "gps.error.sinConexion", detalle: "TypeError: Failed to fetch" }) })).toMatchObject({ cortado: true, quedan: uno });
    expect(await subir(uno, { base: [vr("r1")], cambiar: () => ({ error: "gps.error.sinPermiso", detalle: "referencia_sin_permiso" }) })).toMatchObject({
      cortado: false,
      quedan: [],
      errores: [{ error: "gps.error.sinPermiso", ids: ["r1"] }],
    });
  });
});
