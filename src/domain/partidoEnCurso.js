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

const DE_ESTE_CELULAR = new Set([
  "idLocal",
  "idSupabase",
  "idEnCurso",
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
