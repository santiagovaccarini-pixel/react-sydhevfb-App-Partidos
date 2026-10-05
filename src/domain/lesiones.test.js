import { describe, expect, test } from "vitest";
import {
  calcular,
  camposCambiados,
  claveDeErrorDeBase,
  claveDeQuien,
  conValor,
  diagnosticoDe,
  diasDeBaja,
  errorDeCampo,
  errorImagenAntes,
  erroresDeLesion,
  erroresNuevos,
  estadoDelPlantel,
  etapaDe,
  horasHastaLaImagen,
  lesionVacia,
  lesionesActivas,
  lesionesSinFecha,
  mismaPersona,
  numeroDeRegistro,
  ordenarPorCaso,
  posibleRecidiva,
  recidivaDe,
  recurrenciaDe,
  seRepite,
  severidadPorDias,
  validarLesion,
  valorDe,
} from "./lesiones.js";
import {
  CAMPOS,
  CAMPOS_EDITABLES,
  GRUPOS,
  OPCIONES,
  PASOS,
  armarConfig,
  campoOculto,
  claveDeGrupo,
  esCalculado,
  etiquetaDeCampo,
  etiquetaDeGrupo,
  etiquetaDeOpcion,
  filasParaSembrar,
  opcionesDeCampo,
} from "./lesionesCampos.js";

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

  test("una columna obligatoria no se esconde aunque la configuración lo pida", () => {
    const config = armarConfig(
      [
        { campo: "parte_cuerpo", etiqueta_es: "", etiqueta_pt: "", oculto: true, orden: 9 },
        { campo: "producto", etiqueta_es: "", etiqueta_pt: "", oculto: true, orden: 19 },
      ],
      [],
    );
    expect(campoOculto("parte_cuerpo", config)).toBe(false);
    expect(campoOculto("producto", config)).toBe(true);
    expect(campoOculto("medico", config)).toBe(false);
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

  test("la semilla de un club trae todas las cabeceras, los grupos y las opciones", () => {
    const semilla = filasParaSembrar("eq-1");
    expect(semilla.campos).toHaveLength(36 + 7);
    expect(semilla.campos[0]).toMatchObject({ equipo_id: "eq-1", campo: "numero_caso", etiqueta_pt: "N° de Caso", orden: 0 });
    expect(semilla.campos.at(-7)).toMatchObject({ campo: "grupo:dados_gerais", etiqueta_es: "Datos generales", etiqueta_pt: "Dados Gerais", orden: 1000 });
    expect(semilla.opciones.length).toBeGreaterThan(150);
  });

  test("las columnas van en los grupos del Excel, en orden y sin saltos", () => {
    expect(GRUPOS.map((grupo) => grupo.etiquetas["pt-BR"])).toEqual([
      "Dados Gerais",
      "Descrição Geral",
      "Descrição Específica",
      "Descrição Contextual",
      "Evolução e Continuação",
      "Diagnóstico",
      "Observações",
    ]);
    CAMPOS.forEach((campo) => expect(GRUPOS.some((grupo) => grupo.clave === campo.grupo), campo.clave).toBe(true));
    // Como en el Excel: cada grupo es un tramo seguido de columnas.
    const tramos = CAMPOS.map((campo) => campo.grupo).filter((grupo, i, todos) => grupo !== todos[i - 1]);
    expect(tramos).toEqual(GRUPOS.map((grupo) => grupo.clave));
    expect(CAMPOS.filter((campo) => campo.grupo === "descricao_geral").map((campo) => campo.clave)).toEqual([
      "tipo_lesion",
      "parte_cuerpo",
      "lado",
      "lado_habil",
      "hora_imagen",
      "imagenes",
      "horas_imagen",
    ]);
  });

  test("la carga tiene un paso por grupo, con lo que se escribe a mano", () => {
    expect(PASOS).toEqual([
      { id: "dados_gerais", campos: ["jugador"] },
      { id: "descricao_geral", campos: ["tipo_lesion", "parte_cuerpo", "lado", "hora_imagen", "imagenes"] },
      { id: "descricao_especifica", campos: ["ligamento", "musculo", "musculo_especifico", "area"] },
      { id: "descricao_contextual", campos: ["producto", "mecanismo", "cuando", "localizacion"] },
      { id: "evolucao", campos: ["fecha_lesion", "fecha_transicion", "fecha_retorno_entrenamiento", "fecha_alta"] },
      { id: "observacoes", campos: ["comentarios", "medico"] },
    ]);
  });

  test("el nombre de un grupo: el del Excel, o el que le puso el club", () => {
    expect(claveDeGrupo("evolucao")).toBe("grupo:evolucao");
    expect(etiquetaDeGrupo("evolucao", null, "es-AR")).toBe("Evolución y continuación");
    expect(etiquetaDeGrupo("evolucao", null, "pt-BR")).toBe("Evolução e Continuação");
    const config = armarConfig([{ campo: "grupo:evolucao", etiqueta_es: "Fechas", etiqueta_pt: "", oculto: false, orden: 1004 }], []);
    expect(etiquetaDeGrupo("evolucao", config, "es-AR")).toBe("Fechas");
    // Sin texto en portugués, el del otro idioma antes que nada.
    expect(etiquetaDeGrupo("evolucao", config, "pt-BR")).toBe("Fechas");
    expect(etiquetaDeGrupo("inventado", null, "es-AR")).toBe("inventado");
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
    // Las horas hasta la imagen salen solas: desde el comienzo del día de la lesión.
    expect(calcular("horas_imagen", base({ datos: { hora_imagen: "2026-09-02T06:00" } }))).toBe(30);
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
    // Recidiva: exactamente la misma estructura, con la anterior terminada hace 30 días o menos.
    expect(recidivaDe(segunda, todas)).toBe("nao"); // 42 días después del alta: ya no
    expect(recidivaDe({ ...segunda, fecha_lesion: "2026-04-19" }, todas)).toBe("sim"); // 30 días justos
    expect(recidivaDe({ ...segunda, fecha_lesion: "2026-04-20" }, todas)).toBe("nao"); // 31
    expect(recidivaDe({ ...segunda, fecha_lesion: "2026-04-10", datos: { ...segunda.datos, area: "proximal" } }, todas)).toBe("nao");
    expect(recidivaDe(primera, todas)).toBe("nao");
    // Si la anterior sigue abierta, cuenta desde hoy.
    const abierta = { ...primera, fecha_alta: null };
    expect(recidivaDe({ ...segunda, fecha_lesion: "2026-12-01" }, [abierta], "2026-12-01")).toBe("sim");
    expect(calcular("recurrencia", segunda, null, { lesiones: todas })).toBe("sim");
    expect(calcular("recidiva", { ...segunda, fecha_lesion: "2026-04-15" }, null, { lesiones: todas })).toBe("sim");

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
  test("pide jugador, fecha, tipo de lesión, parte del cuerpo y lado, y no acepta fechas raras", () => {
    const conDatos = (datos) => base({ datos: { tipo_lesion: "muscular_1a", parte_cuerpo: "coxa", lado: "direito", ...datos } });
    expect(validarLesion(base({ jugador_id: null }), { hoy })).toBe("lesiones.error.jugador");
    expect(validarLesion(base({ fecha_lesion: "" }), { hoy })).toBe("lesiones.error.fecha");
    expect(validarLesion(base({ fecha_lesion: "2026-10-02" }), { hoy })).toBe("lesiones.error.fechaFutura");
    expect(validarLesion(base({ fecha_alta: "2026-08-30" }), { hoy })).toBe("lesiones.error.fechaAntes");
    expect(validarLesion(base({ fecha_transicion: "2026-10-05" }), { hoy })).toBe("lesiones.error.fechaFuturaOtra");
    // El tipo de lesión no es opcional.
    expect(validarLesion(conDatos({ tipo_lesion: null }), { hoy })).toBe("lesiones.error.tipo");
    expect(validarLesion(conDatos({ parte_cuerpo: null }), { hoy })).toBe("lesiones.error.parte");
    expect(validarLesion(conDatos({ lado: null }), { hoy })).toBe("lesiones.error.lado");
    // La imagen no puede ser de antes del día de la lesión (ni media hora),
    // ni del futuro, ni una fecha u hora que no existe.
    expect(validarLesion(conDatos({ hora_imagen: "2026-08-31T23:00" }), { hoy })).toBe("lesiones.error.imagenAntes");
    expect(validarLesion(conDatos({ hora_imagen: "2026-08-31T23:45" }), { hoy })).toBe("lesiones.error.imagenAntes");
    expect(validarLesion(conDatos({ hora_imagen: "2026-10-05T10:00" }), { hoy })).toBe("lesiones.error.fechaFuturaOtra");
    expect(validarLesion(conDatos({ hora_imagen: "ayer a la tarde" }), { hoy })).toBe("lesiones.error.imagen");
    ["2026-02-30T10:00", "2025-13-05T10:00", "2026-09-01T25:99", "2026-09-01T24:00", "0026-09-01T10:00"].forEach((hora) =>
      expect(validarLesion(conDatos({ hora_imagen: hora }), { hoy }), hora).toBe("lesiones.error.imagen"),
    );
    expect(validarLesion(conDatos({ hora_imagen: "2026-09-02T10:30" }), { hoy })).toBe("");
    expect(validarLesion(base(), { hoy })).toBe("");
  });

  test("lo que el club escondió no se revisa: no se ve ni se puede corregir", () => {
    const conImagenVieja = base({ datos: { ...base().datos, hora_imagen: "2026-08-20T10:00" } });
    expect(validarLesion(conImagenVieja, { hoy })).toBe("lesiones.error.imagenAntes");
    expect(validarLesion(conImagenVieja, { hoy, oculto: (clave) => clave === "hora_imagen" })).toBe("");
    expect(validarLesion(base({ fecha_alta: "2026-08-30" }), { hoy, oculto: (clave) => clave === "fecha_alta" })).toBe("");
  });

  test("de cada error se sabe en qué columna se corrige, y una edición solo frena lo que rompe", () => {
    const vieja = base({ datos: { parte_cuerpo: "coxa", lado: "direito", hora_imagen: "2026-08-20T10:00" } });
    expect(erroresDeLesion(vieja, { hoy })).toEqual([
      { clave: "tipo_lesion", error: "lesiones.error.tipo" },
      { clave: "hora_imagen", error: "lesiones.error.imagenAntes" },
    ]);
    // A una lesión vieja sin tipo se le puede cambiar el médico, o arreglar
    // una cosa sin la otra.
    expect(erroresNuevos(vieja, conValor(vieja, "medico", "Dr. X"), { hoy })).toEqual([]);
    expect(erroresNuevos(vieja, conValor(vieja, "tipo_lesion", "entorse"), { hoy })).toEqual([]);
    expect(erroresNuevos(vieja, conValor(vieja, "hora_imagen", "2026-09-01T10:00"), { hoy })).toEqual([]);
    // Lo que la edición rompe, sí.
    expect(erroresNuevos(vieja, conValor(vieja, "lado", null), { hoy })).toEqual([{ clave: "lado", error: "lesiones.error.lado" }]);
    expect(erroresNuevos(base(), conValor(base(), "hora_imagen", "2026-08-31T22:00"), { hoy })).toEqual([{ clave: "hora_imagen", error: "lesiones.error.imagenAntes" }]);
    // Empeorar lo que ya estaba mal tampoco: mover la lesión más lejos de la
    // imagen, o cambiar una hora mala por otra mala.
    expect(erroresNuevos(vieja, conValor(vieja, "fecha_lesion", "2026-09-05"), { hoy })).toEqual([{ clave: "hora_imagen", error: "lesiones.error.imagenAntes" }]);
    const conHoraMala = conValor(vieja, "hora_imagen", "2026-09-01T25:00");
    expect(erroresNuevos(conHoraMala, conValor(conHoraMala, "hora_imagen", "1850-10-01T10:00"), { hoy })).toEqual([{ clave: "hora_imagen", error: "lesiones.error.imagen" }]);
    const otra = base({ id: "otra" });
    expect(erroresNuevos(base({ id: "b", datos: { ...base().datos, lado: "esquerdo" } }), base({ id: "b" }), { hoy, otras: [otra] })).toEqual([
      { clave: null, error: "lesiones.error.repetida" },
    ]);
  });

  test("las horas entre la lesión y la imagen salen solas, desde el comienzo del día de la lesión", () => {
    expect(horasHastaLaImagen("2026-09-01", "2026-09-01T00:00")).toBe(0);
    expect(horasHastaLaImagen("2026-09-01", "2026-09-02T10:30")).toBe(35);
    expect(horasHastaLaImagen("2026-09-01", "2026-09-01 18:14")).toBe(18);
    expect(horasHastaLaImagen("2026-09-01", "2026-09-01T18:30:00Z")).toBe(19);
    // Se redondea como en la base, floor(x + 0,5): sin "-0" y igual con las negativas.
    expect(Object.is(horasHastaLaImagen("2026-09-01", "2026-08-31T23:30"), 0)).toBe(true);
    expect(horasHastaLaImagen("2026-09-10", "2026-09-09T21:30")).toBe(-2);
    // Sin imagen, o con algo que no es una fecha y hora que exista, no hay horas.
    expect(horasHastaLaImagen("2026-09-01", "")).toBe(null);
    expect(horasHastaLaImagen("2026-09-01", "mañana")).toBe(null);
    expect(horasHastaLaImagen("", "2026-09-02T10:30")).toBe(null);
    ["2026-02-30T10:00", "2025-13-05T10:00", "2026-09-01T25:99", "2026-09-01T24:00"].forEach((hora) => expect(horasHastaLaImagen("2026-02-01", hora), hora).toBe(null));
    expect(calcular("horas_imagen", base({ datos: { hora_imagen: "2026-09-03T08:00" } }))).toBe(56);
    expect(calcular("horas_imagen", base())).toBe(null);
  });

  test("las horas que se cargaban a mano se siguen viendo si no hay hora de la imagen", () => {
    expect(calcular("horas_imagen", base({ datos: { horas_imagen: "12" } }))).toBe(12);
    expect(calcular("horas_imagen", base({ datos: { horas_imagen: "12,5" } }))).toBe(12.5);
    expect(calcular("horas_imagen", base({ datos: { horas_imagen: "doce" } }))).toBe(null);
    expect(calcular("horas_imagen", base({ datos: { horas_imagen: ".5" } }))).toBe(0.5);
    expect(calcular("horas_imagen", base({ datos: { horas_imagen: "1e3" } }))).toBe(1000);
    expect(calcular("horas_imagen", base({ datos: { horas_imagen: "0x10" } }))).toBe(null);
    // Con hora de la imagen manda la cuenta.
    expect(calcular("horas_imagen", base({ datos: { horas_imagen: "12", hora_imagen: "2026-09-02T10:30" } }))).toBe(35);
  });

  test("la imagen se compara con el día de la lesión, por fecha", () => {
    expect(errorImagenAntes(base({ datos: { hora_imagen: "2026-08-31T23:59" } }))).toBe("lesiones.error.imagenAntes");
    expect(errorImagenAntes(base({ datos: { hora_imagen: "2026-09-01T00:00" } }))).toBe("");
    expect(errorImagenAntes(base({ datos: {} }))).toBe("");
    // Si la hora no existe, eso lo dice la columna (no esto).
    expect(errorImagenAntes(base({ datos: { hora_imagen: "2026-08-31T25:00" } }))).toBe("");
  });

  test("la base va por n° de caso, como el Excel: las nuevas abajo", () => {
    const lesiones = [
      base({ id: "c", numero_caso: 3, fecha_lesion: "2026-08-01" }),
      base({ id: "sin", numero_caso: null, fecha_lesion: "2026-07-01" }),
      base({ id: "a", numero_caso: 1, fecha_lesion: "2026-09-01" }),
      base({ id: "b", numero_caso: 2, fecha_lesion: "2026-06-01" }),
    ];
    expect(ordenarPorCaso(lesiones).map((lesion) => lesion.id)).toEqual(["a", "b", "c", "sin"]);
  });

  test("una recaída durante la recuperación se puede cargar; la misma lesión dos veces, no", () => {
    const activa = base({ id: "otra" });
    // Otra fecha de inicio, aunque la anterior siga abierta: se puede.
    expect(seRepite(base({ id: "nueva", fecha_lesion: "2026-09-20" }), [activa])).toBe(false);
    expect(validarLesion(base({ id: "nueva", fecha_lesion: "2026-09-20" }), { hoy, otras: [activa] })).toBe("");
    // El mismo jugador, parte, lado y día: es la misma.
    expect(seRepite(base({ id: "nueva" }), [activa])).toBe(true);
    expect(validarLesion(base({ id: "nueva" }), { hoy, otras: [activa] })).toBe("lesiones.error.repetida");
    expect(seRepite(base({ id: "nueva", datos: { parte_cuerpo: "coxa", lado: "esquerdo" } }), [activa])).toBe(false);
    expect(seRepite(base({ id: "nueva", jugador_id: 99 }), [activa])).toBe(false);
    expect(seRepite(activa, [activa])).toBe(false);
  });
});

describe("recidiva, plantel, revisión y cambios", () => {
  test("avisa si hubo una lesión igual con alta hace menos de dos meses", () => {
    const anterior = base({ id: "vieja", fecha_lesion: "2026-07-01", fecha_alta: "2026-08-01" });
    expect(posibleRecidiva(base({ id: null, fecha_lesion: "2026-09-15" }), [anterior])?.id).toBe("vieja");
    expect(posibleRecidiva(base({ id: null, fecha_lesion: "2026-10-15" }), [anterior])).toBe(null);
    // También si la anterior todavía seguía (una recaída durante la recuperación).
    const abierta = base({ id: "abierta", fecha_lesion: "2026-08-20", fecha_alta: null });
    expect(posibleRecidiva(base({ id: null, fecha_lesion: "2026-09-15" }), [abierta])?.id).toBe("abierta");
    expect(posibleRecidiva(base({ id: null, fecha_lesion: "2026-09-15" }), [anterior, abierta])?.id).toBe("abierta");
    // Una que empezó después, no.
    expect(posibleRecidiva(base({ id: null, fecha_lesion: "2026-08-01" }), [abierta])).toBe(null);
  });

  test("el plantel dice quién está lesionado, reintegrándose o disponible", () => {
    const plantel = [{ id: 7, nombre: "Hulk" }, { id: 8, nombre: "Scarpa" }, { id: 9, nombre: "Lemos" }];
    const lesiones = [base(), base({ id: "b", jugador_id: 8, fecha_retorno_entrenamiento: "2026-09-05" }), base({ id: "c", jugador_id: 9, fecha_alta: "2026-09-05" })];
    expect(lesionesActivas(lesiones).map((lesion) => lesion.id)).toEqual(["a", "b"]);
    expect(estadoDelPlantel(plantel, lesiones).map((fila) => fila.situacion)).toEqual(["lesionado", "reintegrandose", "disponible"]);
  });

  test("cada columna se revisa sola, para frenar el paso donde está", () => {
    const hoy = "2026-10-02";
    expect(errorDeCampo(base({ jugador_id: null }), "jugador", hoy)).toBe("lesiones.error.jugador");
    expect(errorDeCampo(base({ fecha_lesion: "" }), "fecha_lesion", hoy)).toBe("lesiones.error.fecha");
    expect(errorDeCampo(base({ fecha_lesion: "2026-10-03" }), "fecha_lesion", hoy)).toBe("lesiones.error.fechaFutura");
    expect(errorDeCampo(base({ fecha_transicion: "2026-08-01" }), "fecha_transicion", hoy)).toBe("lesiones.error.fechaAntes");
    expect(errorDeCampo(base({ fecha_alta: "2026-10-05" }), "fecha_alta", hoy)).toBe("lesiones.error.fechaFuturaOtra");
    expect(errorDeCampo(base({ fecha_alta: null }), "fecha_alta", hoy)).toBe("");
    expect(errorDeCampo(base({ datos: { lado: "direito" } }), "parte_cuerpo", hoy)).toBe("lesiones.error.parte");
    expect(errorDeCampo(base({ datos: { parte_cuerpo: "coxa" } }), "lado", hoy)).toBe("lesiones.error.lado");
    expect(errorDeCampo(base({ datos: {} }), "tipo_lesion", hoy)).toBe("lesiones.error.tipo");
    // Que la imagen no sea de antes de la lesión lo dice errorImagenAntes:
    // compara dos columnas que se cargan en pasos distintos.
    expect(errorDeCampo(base({ datos: { hora_imagen: "2026-08-20T10:00" } }), "hora_imagen", hoy)).toBe("");
    expect(errorDeCampo(base({ datos: { hora_imagen: "2026-08-20T25:00" } }), "hora_imagen", hoy)).toBe("lesiones.error.imagen");
    expect(errorDeCampo(base({ datos: {} }), "hora_imagen", hoy)).toBe("");
    expect(errorDeCampo(base(), "medico", hoy)).toBe("");
  });

  test("de una edición se sabe qué columnas cargadas a mano cambió", () => {
    const antes = { ...base(), datos: { parte_cuerpo: "coxa", lado: "direito", medico: "Dr. X", diagnostico: "viejo" } };
    const despues = { ...base(), fecha_alta: "2026-09-20", datos: { parte_cuerpo: "coxa", lado: "esquerdo", medico: " Dr. X ", diagnostico: "nuevo" } };
    // Lo calculado (el diagnóstico) no cuenta, y los espacios tampoco.
    expect(camposCambiados(antes, despues)).toEqual(["lado", "fecha_alta"]);
    expect(camposCambiados(antes, { ...antes, jugador_id: 8 })).toEqual(["jugador"]);
    expect(camposCambiados(null, despues)).toEqual([]);
  });

  test("los errores de la base se traducen a claves", () => {
    expect(claveDeErrorDeBase({ code: "42P01", message: "relation public.lesiones does not exist" })).toBe("lesiones.error.faltaMigracion");
    expect(claveDeErrorDeBase({ code: "42703", message: "column jugadores.numero_registro does not exist" })).toBe("lesiones.error.faltaMigracion");
    expect(claveDeErrorDeBase({ code: "42501", message: "new row violates row-level security policy" })).toBe("lesiones.error.sinPermiso");
    expect(claveDeErrorDeBase({ code: "23P01", message: "conflicting key value violates exclusion constraint lesiones_sin_solapar" })).toBe("lesiones.error.solapada");
    expect(claveDeErrorDeBase({ code: "23505", message: 'duplicate key value violates unique constraint "lesiones_sin_repetir"' })).toBe("lesiones.error.repetida");
    expect(claveDeErrorDeBase({ code: "P0001", message: "jugador_de_otro_club" })).toBe("evaluaciones.error.jugadorDeOtroClub");
    expect(claveDeErrorDeBase({ message: "otra cosa" })).toBe("");
  });
});

describe("lesiones de alguien fuera de Datos básicos y sin fecha de inicio", () => {
  const dePersona = (extra = {}) => ({ id: extra.id || "p1", jugador_id: null, persona: "Cata Tres", fecha_lesion: "2026-03-01", fecha_alta: "2026-03-10", ...extra, datos: { parte_cuerpo: "coxa", lado: "direito", musculo: "isquiotibiais", ...(extra.datos || {}) } });

  test("de quién es: el jugador o la persona (sin mayúsculas ni espacios de más); sin ninguno, de nadie", () => {
    expect(claveDeQuien({ jugador_id: 7 })).toBe("j:7");
    expect(claveDeQuien({ jugador_id: null, persona: "  Cata   TRES " })).toBe("p:cata tres");
    expect(claveDeQuien({ jugador_id: null, persona: "" })).toBeNull();
    expect(mismaPersona(dePersona(), dePersona({ persona: "cata tres" }))).toBe(true);
    // Dos lesiones sin jugador ni persona no son de la misma persona.
    expect(mismaPersona({ jugador_id: null }, { jugador_id: null })).toBe(false);
    // Elegir un jugador deja de lado el nombre de la persona.
    expect(conValor(dePersona(), "jugador", 7)).toMatchObject({ jugador_id: 7, persona: null });
  });

  test("la recurrencia y el n° de registro son por persona: dos personas distintas sin jugador no se mezclan", () => {
    const anterior = dePersona({ id: "a", fecha_lesion: "2026-02-01", fecha_alta: "2026-02-20" });
    const otraPersona = dePersona({ id: "b", persona: "Otra Persona", fecha_lesion: "2026-02-05", fecha_alta: "2026-02-25" });
    const nueva = dePersona({ id: "c" });
    const todas = [anterior, otraPersona, nueva];
    expect(recurrenciaDe(nueva, todas, "2026-10-03")).toBe("sim");
    expect(recurrenciaDe(otraPersona, todas, "2026-10-03")).toBe("nao");
    expect(numeroDeRegistro(nueva, todas)).toBe(2);
    expect(numeroDeRegistro(otraPersona, todas)).toBe(1);
    expect(errorDeCampo(nueva, "jugador")).toBe("");
    expect(seRepite(dePersona({ id: "d", persona: "CATA TRES" }), todas)).toBe(true);
  });

  test("sin fecha de inicio: no está activa, no suma días ni recurrencias, y queda en la lista para completar", () => {
    const sinFecha = { id: "s", jugador_id: 7, numero_caso: 29, fecha_lesion: null, fecha_alta: null, datos: { parte_cuerpo: "coxa", lado: "direito" } };
    const conFecha = { id: "f", jugador_id: 7, numero_caso: 3, fecha_lesion: "2026-09-20", fecha_alta: null, datos: { parte_cuerpo: "coxa", lado: "direito" } };
    expect(etapaDe(sinFecha)).toBe("sinFecha");
    expect(lesionesActivas([sinFecha, conFecha]).map((una) => una.id)).toEqual(["f"]);
    expect(lesionesSinFecha([conFecha, sinFecha]).map((una) => una.id)).toEqual(["s"]);
    expect(diasDeBaja(sinFecha, "2026-10-03")).toBe(0);
    expect(recurrenciaDe(sinFecha, [sinFecha, conFecha], "2026-10-03")).toBe("");
    expect(recurrenciaDe(conFecha, [sinFecha, conFecha], "2026-10-03")).toBe("nao");
    expect(seRepite(sinFecha, [{ ...sinFecha, id: "otra" }])).toBe(false);
    expect(calcular("severidad", { ...sinFecha, fecha_alta: "2026-09-30" })).toBe("");
    expect(estadoDelPlantel([{ id: 7, nombre: "HULK" }], [sinFecha])[0].situacion).toBe("disponible");
    // Al editarla, falta la fecha (para completarla), pero no frena otros cambios.
    expect(errorDeCampo(sinFecha, "fecha_lesion")).toBe("lesiones.error.fecha");
    expect(erroresNuevos(sinFecha, conValor(sinFecha, "medico", "Dr. X"), { hoy: "2026-10-03" })).toEqual([]);
  });

  test("lo que dice la base si todavía no se corrió 20261010", () => {
    expect(claveDeErrorDeBase({ code: "23502", message: 'null value in column "fecha_lesion" of relation "lesiones" violates not-null constraint' })).toBe("lesiones.error.faltaMigracionPersonas");
    expect(claveDeErrorDeBase({ code: "PGRST204", message: "Could not find the 'persona' column of 'lesiones' in the schema cache" })).toBe("lesiones.error.faltaMigracionPersonas");
    expect(claveDeErrorDeBase({ code: "23514", message: 'violates check constraint "lesiones_de_quien"' })).toBe("lesiones.error.jugador");
    expect(claveDeErrorDeBase({ code: "23505", message: 'duplicate key value violates unique constraint "lesiones_sin_repetir_persona"' })).toBe("lesiones.error.repetida");
  });
});
