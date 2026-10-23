// El partido en curso, dato por dato (paso 4 de la nota «cargar sin señal y
// a la vez que otra persona»; Santiago, 23/10, en cuestionarios: «Varios
// cargan a la vez»; si dos anotan el mismo dato con otro valor, «Gana el
// último y avisa»). Para compartirlo entre celulares (partidos_en_curso,
// 20261120_partido_en_curso.sql), el partido de la pantalla se desarma en
// datos sueltos: { "rival": "…", "inicioPT": "…", "varsPT.0.inicio": "…",
// "formacion.titulares": […], "cambios.<id>.sale": "…", … }. Así, lo que
// anotan dos celulares a la vez se junta, y solo el mismo dato se pisa.
//
//   · Lo de este celular o de cómo se ve (su número, la fila del Historial,
//     el VAR que se está mirando…) no se comparte.
//   · Los cambios (los propios y los del rival) van cada uno por su id, no
//     por su lugar: dos celulares que anotan un cambio a la vez suman dos
//     (por su lugar, los dos irían al «cambio 1» y uno se perdería). Su
//     lugar en la lista va como un dato más (lugar).
//   · Los VAR de cada tiempo, por su lugar (hasta tres).
//   · Lo vacío no va: así, borrar un dato es sacarlo.
//
// Al revés (armarPartido), con lo de la base se vuelve a armar el partido de
// la pantalla, con lo de este celular como estaba (parte 4b: lo que anotan
// los otros celulares llega y se junta).

const DE_ESTE_CELULAR = new Set([
  "idLocal",
  "idSupabase",
  "idEnCurso",
  // Lo último que se supo de la base de este partido y su versión (4b).
  "enCursoSubido",
  "enCursoVersion",
  "sinSincronizar",
  "fechaElegidaAMano",
  "varPTActivo",
  "varSTActivo",
  "varPTEActivo",
  "varSTEActivo",
]);
const POR_ID = new Set(["cambios", "cambiosRival"]);
const POR_LUGAR = new Set(["varsPT", "varsST", "varsPTE", "varsSTE"]);

// Como lo acepta la base: letras, números, _ y - (con hasta tres puntos).
const NOMBRE_VALIDO = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_-]+){0,3}$/;

const esObjeto = (valor) => valor !== null && typeof valor === "object" && !Array.isArray(valor);
const esVacio = (valor) => valor === undefined || valor === null || valor === "" || valor === false || (Array.isArray(valor) && valor.every(esVacio));
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Un cambio sin nada anotado (o solo con el tiempo en que iba) no está.
const cambioVacio = (cambio) => Object.entries(cambio).every(([campo, valor]) => campo === "id" || campo === "periodo" || esVacio(valor));

export const aplanarPartido = (registro = {}) => {
  const plano = {};
  const poner = (clave, valor) => {
    if (!esVacio(valor) && NOMBRE_VALIDO.test(clave) && clave.length <= 120) plano[clave] = valor;
  };
  Object.entries(registro || {}).forEach(([clave, valor]) => {
    if (DE_ESTE_CELULAR.has(clave)) return;
    if (POR_ID.has(clave)) {
      (Array.isArray(valor) ? valor : []).forEach((cambio, lugar) => {
        if (!esObjeto(cambio) || !cambio.id || cambioVacio(cambio)) return;
        Object.entries(cambio).forEach(([campo, dato]) => {
          if (campo !== "id") poner(`${clave}.${cambio.id}.${campo}`, dato);
        });
        poner(`${clave}.${cambio.id}.lugar`, lugar);
      });
      return;
    }
    if (POR_LUGAR.has(clave)) {
      (Array.isArray(valor) ? valor : []).forEach((uno, lugar) => {
        if (esObjeto(uno)) Object.entries(uno).forEach(([campo, dato]) => poner(`${clave}.${lugar}.${campo}`, dato));
      });
      return;
    }
    if (esObjeto(valor)) {
      Object.entries(valor).forEach(([campo, dato]) => poner(`${clave}.${campo}`, dato));
      return;
    }
    poner(clave, valor);
  });
  return plano;
};

// Lo que cambió entre lo que se subió y lo de ahora: { cambios, antes } (lo
// que se sacó va en null), como lo pide partido_en_curso_cambiar.
export const diferenciasDelPartido = (subido = {}, ahora = {}) => {
  const cambios = {};
  const antes = {};
  new Set([...Object.keys(subido || {}), ...Object.keys(ahora || {})]).forEach((clave) => {
    if (igual(subido?.[clave], ahora?.[clave])) return;
    cambios[clave] = ahora?.[clave] ?? null;
    antes[clave] = subido?.[clave] ?? null;
  });
  return { cambios, antes };
};

const lugarValido = (valor) => Number.isInteger(valor) && valor >= 0 && valor < 100;

// El partido de la pantalla con los datos sueltos (plano) encima de uno
// vacío (vacio, el de la app) y lo de este celular de local. nuevoId: para
// los lugares libres de los cambios. Los cambios van a su lugar; si dos
// quieren el mismo, el segundo (por id) va al siguiente libre.
export const armarPartido = (plano = {}, { vacio = {}, local = {}, nuevoId = () => Math.random().toString(36).slice(2) } = {}) => {
  const registro = { ...vacio };
  Object.entries(local || {}).forEach(([clave, valor]) => {
    if (DE_ESTE_CELULAR.has(clave)) registro[clave] = valor;
  });
  const porId = Object.fromEntries([...POR_ID].map((clave) => [clave, new Map()]));
  const porLugar = Object.fromEntries([...POR_LUGAR].map((clave) => [clave, []]));
  Object.entries(plano || {}).forEach(([clave, valor]) => {
    const [cabeza, segundo, tercero] = clave.split(".");
    if (DE_ESTE_CELULAR.has(cabeza)) return;
    if (POR_ID.has(cabeza)) {
      if (!segundo || !tercero) return;
      const cambio = porId[cabeza].get(segundo) || { id: segundo };
      cambio[tercero] = valor;
      porId[cabeza].set(segundo, cambio);
      return;
    }
    if (POR_LUGAR.has(cabeza)) {
      const lugar = Number(segundo);
      if (!lugarValido(lugar) || !tercero) return;
      porLugar[cabeza][lugar] = { ...(porLugar[cabeza][lugar] || {}), [tercero]: valor };
      return;
    }
    if (segundo !== undefined) {
      registro[cabeza] = { ...(esObjeto(registro[cabeza]) ? registro[cabeza] : {}), [segundo]: valor };
      return;
    }
    registro[cabeza] = valor;
  });

  POR_ID.forEach((clave) => {
    const base = Array.isArray(vacio[clave]) ? vacio[clave] : [];
    const molde = Object.fromEntries(Object.keys(base[0] || {}).filter((campo) => campo !== "id").map((campo) => [campo, ""]));
    const cambios = [...porId[clave].values()].sort((a, b) => (lugarValido(a.lugar) ? a.lugar : 99) - (lugarValido(b.lugar) ? b.lugar : 99) || String(a.id).localeCompare(String(b.id)));
    const lugares = Array.from({ length: Math.max(base.length, cambios.length, ...cambios.map((cambio) => (lugarValido(cambio.lugar) ? cambio.lugar + 1 : 0))) }, () => null);
    cambios.forEach(({ lugar, ...cambio }) => {
      let donde = lugarValido(lugar) && !lugares[lugar] ? lugar : lugares.findIndex((uno, indice) => !uno && (!lugarValido(lugar) || indice > lugar));
      if (donde < 0) donde = lugares.findIndex((uno) => !uno);
      if (donde < 0) donde = lugares.push(null) - 1;
      lugares[donde] = { ...molde, ...cambio };
    });
    registro[clave] = lugares.map((cambio) => cambio || { ...molde, id: nuevoId() });
  });

  POR_LUGAR.forEach((clave) => {
    const lista = porLugar[clave];
    if (!lista.length) return;
    const molde = Object.fromEntries(Object.keys((vacio[clave] || [])[0] || { inicio: "", final: "" }).map((campo) => [campo, ""]));
    registro[clave] = Array.from({ length: lista.length }, (_, lugar) => ({ ...molde, ...(lista[lugar] || {}) }));
    const activo = clave.replace(/^vars/, "var") + "Activo";
    if (Number.isInteger(registro[activo]) && registro[activo] >= lista.length) registro[activo] = lista.length - 1;
  });
  return registro;
};

// Lo de la base (servidor) con lo de este celular que la base todavía no
// tiene encima: lo que cambió acá desde lo último que se supo de ella
// (subido). Gana lo de acá: se sube después, y si otra persona cambió lo
// mismo, la base lo dice.
export const juntarConLaBase = (servidor = {}, { subido = {}, ahora = {} } = {}) => {
  const { cambios } = diferenciasDelPartido(subido || {}, ahora);
  const plano = { ...(servidor || {}) };
  Object.entries(cambios).forEach(([clave, valor]) => {
    if (valor === null) delete plano[clave];
    else plano[clave] = valor;
  });
  return plano;
};

// Lo que se sabe que tiene la base después de leerla: lo de la base, salvo
// lo que este celular cambió y todavía no está ahí, que sigue con lo que se
// veía antes de cambiarlo (paso 4c). Así, al subirlo, si otra persona lo
// cambió mientras tanto (por ejemplo, mientras este celular no tenía señal),
// la base lo dice (pisadas) aunque se haya leído antes de subir.
export const loQueSeVio = (servidor = {}, { subido = {}, ahora = {} } = {}) => {
  const visto = { ...(servidor || {}) };
  Object.keys(diferenciasDelPartido(subido || {}, ahora).cambios).forEach((clave) => {
    if (igual(servidor?.[clave], ahora?.[clave])) return;
    if (subido && Object.prototype.hasOwnProperty.call(subido, clave)) visto[clave] = subido[clave];
    else delete visto[clave];
  });
  return visto;
};

// Lo que se sabe que tiene la base después de subir: lo de antes con lo que
// se mandó (lo que se sacó, sin).
export const conLoEnviado = (subido = {}, cambios = {}) => {
  const visto = { ...(subido || {}) };
  Object.entries(cambios || {}).forEach(([clave, valor]) => {
    if (esVacio(valor)) delete visto[clave];
    else visto[clave] = valor;
  });
  return visto;
};

// Lo que anota «Guardar partido» en el partido compartido (si quedó
// guardado terminado y en qué celular): no es un dato del partido, así que
// no se avisa si se pisa.
const DEL_GUARDADO = new Set(["guardadoTerminado", "guardadoPor"]);
export const pisadasParaAvisar = (pisadas = []) =>
  (pisadas || []).filter((pisada) => pisada?.clave && !DEL_GUARDADO.has(String(pisada.clave).split(".")[0]));

// Lo que este celular subió llegó después de que otro celular guardó el
// partido terminado: no está en el Historial (paso 4c; Santiago, 23/10: si
// se guardó igual, al volver se le avisa que toque «Guardar partido»).
export const guardadoEnOtroCelular = (datos = {}, { cambios = {}, propio = "" } = {}) =>
  Boolean(datos?.guardadoTerminado) &&
  Boolean(datos?.guardadoPor) &&
  datos.guardadoPor !== propio &&
  Object.keys(cambios || {}).some((clave) => !DEL_GUARDADO.has(clave.split(".")[0]));

// Los otros celulares sumados al partido (sin este ni los que se fueron) y,
// de ellos, los que no se conectan hace más de un minuto (paso 4c; Santiago,
// 23/10: «Guardar partido» espera lo de todos, con «Guardar igual»). Un
// celular sin señal no puede avisar si tiene algo sin subir: lo que se sabe
// es desde cuándo no se conecta.
export const SEGUNDOS_SIN_CONECTARSE = 60;
export const otrosCelulares = (celulares = [], { propio = "" } = {}) =>
  (celulares || []).filter((uno) => uno?.celular && uno.celular !== propio && uno.sumado !== false);
export const celularesQueFaltan = (celulares = [], { propio = "", segundos = SEGUNDOS_SIN_CONECTARSE } = {}) =>
  otrosCelulares(celulares, { propio }).filter((uno) => Number(uno.segundos) > segundos);

// Terminado: con el segundo tiempo (y, con prórroga, el segundo
// suplementario) terminado.
export const partidoTerminado = (plano = {}) => Boolean(plano.finalST) && (!plano.prorrogaActiva || Boolean(plano.finalSTE));

// A cuáles se ofrece «Sumarme» (Santiago, 23/10: «Hasta guardarlo
// terminado»; si nadie lo guarda, a las 6 horas sin cambios deja de
// ofrecerse: eso lo hace la base). Sin el que ya está abierto acá ni uno
// vacío.
export const paraSumarse = (filas = [], { propio = null } = {}) =>
  (filas || []).filter((fila) => fila?.id && fila.id !== propio && !fila.datos?.guardadoTerminado && Object.keys(fila.datos || {}).length > 0);

// El nombre de un dato, para avisar cuál se pisó.
const NOMBRES = {
  rival: "Rival",
  resultado: "Resultado",
  fecha: "Fecha",
  localia: "Localía",
  formacion: "Formación",
};
const PERIODOS = { PT: "PT", ST: "ST", PTE: "PTE", STE: "STE" };
export const nombreDelDato = (clave = "") => {
  const [cabeza, , tercero] = String(clave).split(".");
  if (NOMBRES[cabeza]) return NOMBRES[cabeza];
  if (cabeza === "cambios") return tercero ? `Cambio (${tercero})` : "Cambio";
  if (cabeza === "cambiosRival") return tercero ? `Cambio del rival (${tercero})` : "Cambio del rival";
  const vars = cabeza.match(/^vars(PTE|STE|PT|ST)$/);
  if (vars) return `VAR ${PERIODOS[vars[1]]}${tercero ? ` (${tercero})` : ""}`;
  const momento = cabeza.match(/^(inicio|final)(Hidratacion)?(PTE|STE|PT|ST)$/);
  if (momento) return `${momento[1] === "inicio" ? "Inicio" : "Final"}${momento[2] ? " hidratación" : ""} ${PERIODOS[momento[3]]}`;
  return cabeza;
};
