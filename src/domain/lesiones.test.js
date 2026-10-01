import { describe, expect, test } from "vitest";
import {
  calcular,
  claveDeErrorDeBase,
  conValor,
  diagnosticoDe,
  diasDeBaja,
  estadoDelPlantel,
  etapaDe,
  filtrarLesiones,
  buscarEnLesiones,
  lesionVacia,
  lesionesActivas,
  numeroDeRegistro,
  posibleRecidiva,
  recidivaDe,
  recurrenciaDe,
  seSolapa,
  severidadPorDias,
  validarLesion,
  valorDe,
} from "./lesiones.js";
import { CAMPOS, CAMPOS_EDITABLES, OPCIONES, armarConfig, esCalculado, etiquetaDeCampo, etiquetaDeOpcion, filasParaSembrar, opcionesDeCampo } from "./lesionesCampos.js";

const base = (extra = {}) =>
  lesionVacia({
    id: "a",
    jugador_id: 7,
    fecha_lesion: "2026-09-01",
    datos: { parte_cuerpo: "coxa", lado: "direito", tipo_lesion: "muscular_1a" },
    ...extra,
  });

describe("el catálogo del Excel", () => {
  test("tiene las columnas del Excel (más la posición del jugador), cada una con nombre en los dos idiomas", () => {
    expect(CAMPOS).toHaveLength(36);
    CAMPOS.forEach((campo) => {
      expect(campo.etiquetas["es-AR"]).toBeTruthy();
      expect(campo.etiquetas["pt-BR"]).toBeTruthy();
    });
    expect(CAMPOS.map((campo) => campo.clave).slice(0, 3)).toEqual(["numero_caso", "numero_registro", "jugador"]);
  });

  test("separa lo que se carga a mano de lo que el Excel calcula solo", () => {
    expect(CAMPOS.find((campo) => campo.clave === "jugador").tipo).toBe("jugador");
    expect(CAMPOS_EDITABLES.map((campo) => campo.clave)).toEqual([
      "tipo_lesion",
      "parte_cuerpo",
      "lado",
      "hora_imagen",
      "imagenes",
      "horas_imagen",
      "ligamento",
      "musculo",
      "musculo_especifico",
      "area",
      "producto",
      "mecanismo",
      "cuando",
      "localizacion",
      "fecha_lesion",
      "fecha_transicion",
      "fecha_retorno_entrenamiento",
      "fecha_alta",
      "comentarios",
      "medico",
    ]);
    ["numero_caso", "numero_registro", "categoria", "edad", "lado_habil", "recup_1", "recup_2", "recuperacion", "severidad", "recurrencia", "recidiva", "diagnostico"].forEach((clave) =>
      expect(esCalculado(clave), clave).toBe(true),
    );
    expect(esCalculado("medico")).toBe(false);
  });

  test("cada desplegable tiene opciones con código único y texto en los dos idiomas", () => {
    Object.entries(OPCIONES).forEach(([campo, lista]) => {
      expect(lista.length, campo).toBeGreaterThan(0);
      expect(new Set(lista.map((opcion) => opcion.codigo)).size).toBe(lista.length);
      lista.forEach((opcion) => {
        expect(opcion.etiquetas["es-AR"]).toBeTruthy();
        expect(opcion.etiquetas["pt-BR"]).toBeTruthy();
      });
    });
    expect(OPCIONES.lado.map((opcion) => opcion.etiquetas["pt-BR"])).toEqual(["Direito", "Esquerdo", "Não se aplica"]);
    expect(OPCIONES.tipo_lesion).toHaveLength(30);
    expect(OPCIONES.tipo_lesion.at(-1).etiquetas["pt-BR"]).toBe("FADIGA");
    expect(OPCIONES.musculo_especifico).toHaveLength(38);
    expect(OPCIONES.musculo_especifico.at(-1).etiquetas["pt-BR"]).toBe("GLÚTEO MÉDIO");
  });

  test("sin configuración del club valen los textos del Excel; con ella, los del club", () => {
    expect(etiquetaDeCampo("parte_cuerpo", null, "pt-BR")).toBe("Parte do Corpo Lesionada");
    expect(etiquetaDeCampo("parte_cuerpo", null, "es-AR")).toBe("Parte del cuerpo lesionada");
    expect(etiquetaDeOpcion("lado", "direito", null, "es-AR")).toBe("Derecho");

    const config = armarConfig(
      [{ campo: "parte_cuerpo", etiqueta_es: "Zona", etiqueta_pt: "", oculto: false, orden: 9 }],
      [
        { campo: "lado", codigo: "direito", etiqueta_es: "Der.", etiqueta_pt: "Dir.", oculto: false, orden: 0 },
        { campo: "lado", codigo: "esquerdo", etiqueta_es: "Izq.", etiqueta_pt: "Esq.", oculto: true, orden: 1 },
      ],
    );
    expect(etiquetaDeCampo("parte_cuerpo", config, "es-AR")).toBe("Zona");
    // Sin texto en portugués, se usa el del otro idioma antes que nada.
    expect(etiquetaDeCampo("parte_cuerpo", config, "pt-BR")).toBe("Zona");
    expect(opcionesDeCampo("lado", config, "pt-BR").map((opcion) => opcion.etiqueta)).toEqual(["Dir."]);
    expect(opcionesDeCampo("lado", config, "pt-BR", { conOcultas: true })).toHaveLength(2);
    // Una opción escondida sigue leyéndose en lo ya cargado.
    expect(etiquetaDeOpcion("lado", "esquerdo", config, "es-AR")).toBe("Izq.");
    expect(etiquetaDeOpcion("lado", "inventado", config, "es-AR")).toBe("inventado");
  });

  test("la semilla de un club trae todas las cabeceras y opciones", () => {
    const semilla = filasParaSembrar("eq-1");
    expect(semilla.campos).toHaveLength(36);
    expect(semilla.campos[0]).toMatchObject({ equipo_id: "eq-1", campo: "numero_caso", etiqueta_pt: "N° de Caso", orden: 0 });
    expect(semilla.opciones.length).toBeGreaterThan(150);
  });
});

describe("etapas, días y severidad", () => {
  test("la etapa sale de las fechas cargadas", () => {
    expect(etapaDe(base())).toBe("lesionado");
    expect(etapaDe(base({ fecha_transicion: "2026-09-05" }))).toBe("transicion");
    expect(etapaDe(base({ fecha_retorno_entrenamiento: "2026-09-10" }))).toBe("entrenando");
    expect(etapaDe(base({ fecha_alta: "2026-09-15" }))).toBe("alta");
  });

  test("cuenta los días como el Excel", () => {
    const lesion = base({ fecha_transicion: "2026-09-05", fecha_retorno_entrenamiento: "2026-09-12", fecha_alta: "2026-09-20" });
    expect(calcular("recup_1", lesion)).toBe(4);
    // Recup 2 en el Excel va desde el inicio (no desde la transición).
    expect(calcular("recup_2", lesion)).toBe(11);
    expect(calcular("recuperacion", lesion)).toBe(19);
    // Sin alta, cuenta hasta hoy.
    expect(calcular("recuperacion", base(), null, { hoy: "2026-09-11" })).toBe(10);
    expect(diasDeBaja(lesion)).toBe(19);
    expect(diasDeBaja(base(), "2026-09-04")).toBe(3);
    expect(calcular("edad", base(), { fecha_nacimiento: "2000-09-02" })).toBe(25);
    expect(calcular("edad", base(), { fecha_nacimiento: "2000-09-01" })).toBe(26);
    // Las horas hasta la imagen las escribe el médico; no se calculan.
    expect(calcular("horas_imagen", base({ datos: { hora_imagen: "2026-09-02T06:00" } }))).toBe(null);
  });

  test("lado hábil, n° de registro, recurrencia, recidiva y diagnóstico salen como en el Excel", () => {
    expect(calcular("lado_habil", base(), { pie_dominante: "direito" })).toBe("sim");
    expect(calcular("lado_habil", base(), { pie_dominante: "esquerdo" })).toBe("nao");
    expect(calcular("lado_habil", base(), {})).toBe("");

    const primera = base({ id: "p", numero_caso: 1, fecha_lesion: "2026-03-01", fecha_alta: "2026-03-20", datos: { parte_cuerpo: "coxa", lado: "direito", musculo: "isquiotibiais", musculo_especifico: "biceps_femoral", area: "medio" } });
    const otra = base({ id: "o", numero_caso: 2, jugador_id: 8, fecha_lesion: "2026-04-01" });
    const segunda = base({ id: "s", numero_caso: 3, fecha_lesion: "2026-05-01", datos: { parte_cuerpo: "coxa", lado: "direito", musculo: "isquiotibiais", musculo_especifico: "biceps_femoral", area: "medio" } });
    const todas = [primera, otra, segunda];
    expect(numeroDeRegistro(primera, todas)).toBe(1);
    expect(numeroDeRegistro(segunda, todas)).toBe(2);
    expect(numeroDeRegistro(otra, todas)).toBe(1);
    expect(numeroDeRegistro(base({ id: null, numero_caso: null, fecha_lesion: "2026-09-01" }), todas)).toBe(3);

    // Recurrencia: misma parte, lado y músculo, con la anterior terminada hace 60 días o menos.
    expect(recurrenciaDe(segunda, todas)).toBe("sim");
    expect(recurrenciaDe({ ...segunda, fecha_lesion: "2026-05-20" }, todas)).toBe("nao");
    expect(recurrenciaDe({ ...segunda, datos: { ...segunda.datos, lado: "esquerdo" } }, todas)).toBe("nao");
    // Recidiva: exactamente la misma estructura, en cualquier momento.
    expect(recidivaDe({ ...segunda, fecha_lesion: "2026-12-01" }, todas)).toBe("sim");
    expect(recidivaDe({ ...segunda, datos: { ...segunda.datos, area: "proximal" } }, todas)).toBe("nao");
    expect(recidivaDe(primera, todas)).toBe("nao");
    expect(calcular("recurrencia", segunda, null, { lesiones: todas })).toBe("sim");

    const texto = (clave, codigo) => (codigo ? `${clave}:${codigo}` : "");
    expect(diagnosticoDe(segunda, texto)).toBe("musculo_especifico:biceps_femoral musculo:isquiotibiais area:medio lado:direito");
    expect(diagnosticoDe(base(), texto)).toBe("tipo_lesion:muscular_1a parte_cuerpo:coxa lado:direito");
    expect(diagnosticoDe(base({ datos: { tipo_lesion: "entorse", ligamento: "lca", parte_cuerpo: "joelho", lado: "esquerdo" } }), texto)).toBe("tipo_lesion:entorse ligamento:lca parte_cuerpo:joelho lado:esquerdo");
    expect(calcular("diagnostico", base({ datos: {} }))).toBe("");
  });

  test("severidad por días de recuperación con la escala del Excel", () => {
    expect(severidadPorDias(0)).toBe("registro");
    expect(severidadPorDias(1)).toBe("leve");
    expect(severidadPorDias(3)).toBe("leve");
    expect(severidadPorDias(5)).toBe("menor");
    expect(severidadPorDias(7)).toBe("menor");
    expect(severidadPorDias(8)).toBe("moderado");
    expect(severidadPorDias(28)).toBe("moderado");
    expect(severidadPorDias(29)).toBe("mayor");
    expect(severidadPorDias(null)).toBe("");
    // La severidad guardada no existe más: sale de las fechas, y solo con alta.
    expect(calcular("severidad", base({ fecha_alta: "2026-09-04" }))).toBe("leve");
    expect(calcular("severidad", base())).toBe("");
  });

  test("valorDe y conValor saben qué va en columna y qué en datos", () => {
    const lesion = conValor(conValor(base(), "fecha_alta", "2026-09-10"), "medico", "Dr. X");
    expect(lesion.fecha_alta).toBe("2026-09-10");
    expect(lesion.datos.medico).toBe("Dr. X");
    expect(valorDe(lesion, "fecha_alta")).toBe("2026-09-10");
    expect(valorDe(lesion, "medico")).toBe("Dr. X");
    expect(valorDe(conValor(lesion, "jugador", 9), "jugador")).toBe(9);
  });
});

describe("validar", () => {
  const hoy = "2026-10-01";
  test("pide jugador, fecha, parte del cuerpo y lado, y no acepta fechas raras", () => {
    expect(validarLesion(base({ jugador_id: null }), { hoy })).toBe("lesiones.error.jugador");
    expect(validarLesion(base({ fecha_lesion: "" }), { hoy })).toBe("lesiones.error.fecha");
    expect(validarLesion(base({ fecha_lesion: "2026-10-02" }), { hoy })).toBe("lesiones.error.fechaFutura");
    expect(validarLesion(base({ fecha_alta: "2026-08-30" }), { hoy })).toBe("lesiones.error.fechaAntes");
    expect(validarLesion(base({ fecha_transicion: "2026-10-05" }), { hoy })).toBe("lesiones.error.fechaFuturaOtra");
    expect(validarLesion(base({ datos: { lado: "direito" } }), { hoy })).toBe("lesiones.error.parte");
    expect(validarLesion(base({ datos: { parte_cuerpo: "coxa" } }), { hoy })).toBe("lesiones.error.lado");
    expect(validarLesion(base({ datos: { parte_cuerpo: "coxa", lado: "direito", horas_imagen: "-2" } }), { hoy })).toBe("lesiones.error.horas");
    expect(validarLesion(base({ datos: { parte_cuerpo: "coxa", lado: "direito", horas_imagen: "12,5" } }), { hoy })).toBe("lesiones.error.horas");
    expect(validarLesion(base({ datos: { parte_cuerpo: "coxa", lado: "direito", horas_imagen: 12.5 } }), { hoy })).toBe("");
    expect(validarLesion(base(), { hoy })).toBe("");
  });

  test("no deja dos lesiones a la vez en la misma parte del cuerpo y lado", () => {
    const activa = base({ id: "otra" });
    expect(seSolapa(base({ id: "nueva", fecha_lesion: "2026-09-20" }), [activa])).toBe(true);
    expect(seSolapa(base({ id: "nueva", fecha_lesion: "2026-09-20", datos: { parte_cuerpo: "coxa", lado: "esquerdo" } }), [activa])).toBe(false);
    const cerrada = base({ id: "otra", fecha_alta: "2026-09-10" });
    expect(seSolapa(base({ id: "nueva", fecha_lesion: "2026-09-10" }), [cerrada])).toBe(false);
    expect(seSolapa(base({ id: "nueva", fecha_lesion: "2026-09-09" }), [cerrada])).toBe(true);
    expect(validarLesion(base({ id: "nueva", fecha_lesion: "2026-09-20" }), { hoy, otras: [activa] })).toBe("lesiones.error.solapada");
    expect(seSolapa(activa, [activa])).toBe(false);
  });
});

describe("recidiva, plantel, filtro y buscador", () => {
  test("avisa si hubo una lesión igual con alta hace menos de dos meses", () => {
    const anterior = base({ id: "vieja", fecha_lesion: "2026-07-01", fecha_alta: "2026-08-01" });
    expect(posibleRecidiva(base({ id: null, fecha_lesion: "2026-09-15" }), [anterior])?.id).toBe("vieja");
    expect(posibleRecidiva(base({ id: null, fecha_lesion: "2026-10-15" }), [anterior])).toBe(null);
  });

  test("el plantel dice quién está lesionado, reintegrándose o disponible", () => {
    const plantel = [{ id: 7, nombre: "Hulk" }, { id: 8, nombre: "Scarpa" }, { id: 9, nombre: "Lemos" }];
    const lesiones = [base(), base({ id: "b", jugador_id: 8, fecha_retorno_entrenamiento: "2026-09-05" }), base({ id: "c", jugador_id: 9, fecha_alta: "2026-09-05" })];
    expect(lesionesActivas(lesiones).map((lesion) => lesion.id)).toEqual(["a", "b"]);
    expect(estadoDelPlantel(plantel, lesiones).map((fila) => fila.situacion)).toEqual(["lesionado", "reintegrandose", "disponible"]);
  });

  test("el filtro combina criterios como el de Partido", () => {
    const lesiones = [
      base({ id: "1" }),
      base({ id: "2", jugador_id: 8, fecha_lesion: "2026-08-10", fecha_alta: "2026-08-20", datos: { parte_cuerpo: "joelho", lado: "esquerdo" } }),
    ];
    expect(filtrarLesiones(lesiones, { criterios: [] })).toHaveLength(2);
    expect(filtrarLesiones(lesiones, { criterios: ["jugador"], jugador: "8" }).map((l) => l.id)).toEqual(["2"]);
    expect(filtrarLesiones(lesiones, { criterios: ["etapa"], etapas: ["alta"] }).map((l) => l.id)).toEqual(["2"]);
    expect(filtrarLesiones(lesiones, { criterios: ["fecha"], desde: "2026-09-01" }).map((l) => l.id)).toEqual(["1"]);
    expect(filtrarLesiones(lesiones, { criterios: ["parte_cuerpo"], listas: { parte_cuerpo: ["joelho"] } }).map((l) => l.id)).toEqual(["2"]);
    expect(filtrarLesiones(lesiones, { criterios: ["parte_cuerpo", "etapa"], listas: { parte_cuerpo: ["joelho"] }, etapas: ["lesionado"] })).toHaveLength(0);
  });

  test("el buscador mira el jugador, el diagnóstico y los textos de las listas", () => {
    const lesiones = [base({ datos: { parte_cuerpo: "joelho", lado: "direito", diagnostico: "Ruptura LCA" } })];
    const nombreDe = () => "HULK";
    expect(buscarEnLesiones(lesiones, "hulk", { nombreDe })).toHaveLength(1);
    expect(buscarEnLesiones(lesiones, "lca", { nombreDe })).toHaveLength(1);
    expect(buscarEnLesiones(lesiones, "rodilla", { nombreDe, idioma: "es-AR" })).toHaveLength(1);
    expect(buscarEnLesiones(lesiones, "joelho", { nombreDe, idioma: "pt-BR" })).toHaveLength(1);
    expect(buscarEnLesiones(lesiones, "tobillo", { nombreDe })).toHaveLength(0);
  });

  test("los errores de la base se traducen a claves", () => {
    expect(claveDeErrorDeBase({ code: "42P01", message: "relation public.lesiones does not exist" })).toBe("lesiones.error.faltaMigracion");
    expect(claveDeErrorDeBase({ code: "42703", message: "column jugadores.numero_registro does not exist" })).toBe("lesiones.error.faltaMigracion");
    expect(claveDeErrorDeBase({ code: "42501", message: "new row violates row-level security policy" })).toBe("lesiones.error.sinPermiso");
    expect(claveDeErrorDeBase({ code: "23P01", message: "conflicting key value violates exclusion constraint lesiones_sin_solapar" })).toBe("lesiones.error.solapada");
    expect(claveDeErrorDeBase({ message: "otra cosa" })).toBe("");
  });
});
