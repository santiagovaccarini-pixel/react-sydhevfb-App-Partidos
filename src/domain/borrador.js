// El borrador del partido que se está cargando, guardado en el celular.
//
// Hay uno por club: "registro_actual_partido:<club>". Antes había uno solo
// para todos, sin dueño: el partido cargado en un club aparecía "EN VIVO" en
// el otro y Guardar lo metía en el que estuviera elegido.
//
// La clave de siempre ("registro_actual_partido", sin club) se sigue
// escribiendo como copia del último borrador usado, con el club anotado: es
// la que lee una versión anterior de la app si hubiera que volver atrás.
// Un borrador ahí sin club anotado lo escribió una versión anterior: es del
// club donde se abra primero (y es lo más nuevo que hay, aunque ese club ya
// tenga el suyo).

export const CLAVE_BORRADOR = "registro_actual_partido";
export const CLAVE_RESPALDO_BORRADOR = "registro_actual_partido_respaldo";
export const VERSION_BORRADOR = 2;
const RESPALDOS_QUE_SE_GUARDAN = 5;

export const claveBorrador = (equipoId) =>
  equipoId ? `${CLAVE_BORRADOR}:${equipoId}` : CLAVE_BORRADOR;

const leer = (clave) => {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};

const escribir = (clave, valor) => {
  try {
    localStorage.setItem(clave, valor);
    return true;
  } catch {
    return false;
  }
};

const esObjeto = (valor) =>
  Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);

/**
 * Qué hay guardado en un texto del celular:
 * - "vacio": nada.
 * - "ok": un borrador que esta versión sabe leer (el de ahora, o el de la
 *   primera versión, que era el registro pelado).
 * - "otraVersion": lo escribió una versión que esta no conoce (por ejemplo,
 *   una más nueva, si se volvió atrás). Se lee lo que se pueda, pero se
 *   guarda una copia antes de escribir encima. Antes se lo tomaba por el
 *   formato viejo, el partido aparecía vacío y el borrador vacío lo pisaba.
 * - "ilegible": no se entiende. Tampoco se pisa sin guardar una copia.
 */
export const interpretarBorrador = (texto) => {
  if (texto === null || texto === undefined || texto === "") {
    return { estado: "vacio", registro: null };
  }

  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { estado: "ilegible", registro: null };
  }

  if (!esObjeto(datos)) return { estado: "ilegible", registro: null };

  const conClub = Object.prototype.hasOwnProperty.call(datos, "equipoId");
  const equipoId = conClub ? datos.equipoId ?? null : undefined;

  if (datos.version === VERSION_BORRADOR) {
    return esObjeto(datos.registro)
      ? { estado: "ok", registro: datos.registro, conClub, equipoId }
      : { estado: "ilegible", registro: null };
  }

  if (datos.version !== undefined) {
    return {
      estado: "otraVersion",
      registro: esObjeto(datos.registro) ? datos.registro : null,
      conClub,
      equipoId,
    };
  }

  // La primera versión guardaba el registro pelado, sin envoltorio.
  return { estado: "ok", registro: datos, conClub: false, equipoId: undefined };
};

/**
 * Guarda una copia de un borrador antes de que se escriba otro encima: uno
 * que no se pudo leer bien, o el de un club que se reemplaza por el que dejó
 * una versión anterior. Se guardan los últimos cinco.
 */
export const respaldarBorrador = (texto, motivo, clave = CLAVE_BORRADOR) => {
  if (!texto) return;
  let lista = [];
  try {
    const previa = JSON.parse(leer(CLAVE_RESPALDO_BORRADOR) || "[]");
    lista = Array.isArray(previa) ? previa : [];
  } catch {
    lista = [];
  }
  if (lista.some((item) => item?.texto === texto)) return;
  escribir(
    CLAVE_RESPALDO_BORRADOR,
    JSON.stringify(
      [{ texto, motivo, clave, guardadoEn: new Date().toISOString() }, ...lista].slice(
        0,
        RESPALDOS_QUE_SE_GUARDAN,
      ),
    ),
  );
};

/**
 * El borrador de un club. Sin club (no se sabe todavía de cuál es este
 * teléfono) se usa la clave de siempre, como antes.
 *
 * Devuelve el registro guardado (o null si no hay) y respalda lo que haga
 * falta antes de que se lo pise.
 */
export const leerBorradorDelClub = (equipoId, { hayPartido = () => true } = {}) => {
  const textoComun = leer(CLAVE_BORRADOR);
  const comun = interpretarBorrador(textoComun);

  if (comun.estado === "ilegible" || comun.estado === "otraVersion") {
    respaldarBorrador(textoComun, comun.estado, CLAVE_BORRADOR);
  }

  if (!equipoId) return comun.registro;

  const clavePropia = claveBorrador(equipoId);
  const textoPropio = leer(clavePropia);
  const propio = interpretarBorrador(textoPropio);

  if (propio.estado === "ilegible" || propio.estado === "otraVersion") {
    respaldarBorrador(textoPropio, propio.estado, clavePropia);
  }

  // Sin club anotado lo escribió una versión anterior de la app: es lo más
  // nuevo que hay en el teléfono y pasa a ser de este club. Si el club ya
  // tenía uno con un partido, queda una copia.
  //
  // Salvo que sea la copia vacía de otro borrador: la versión anterior
  // reescribe la común tal como la leyó, y si lo último usado había sido el
  // borrador vacío de otro club, ese vacío (con su propio idLocal) reemplazaba
  // el partido en curso de este. Ese otro borrador sigue en la clave de su
  // club, así que no se pierde nada.
  const vacioDeOtroBorrador =
    Boolean(comun.registro?.idLocal) &&
    Boolean(propio.registro?.idLocal) &&
    comun.registro.idLocal !== propio.registro.idLocal &&
    !hayPartido(comun.registro) &&
    hayPartido(propio.registro);

  if (comun.registro && !comun.conClub && !vacioDeOtroBorrador) {
    if (propio.registro && hayPartido(propio.registro)) {
      respaldarBorrador(textoPropio, "reemplazado", clavePropia);
    }
    return comun.registro;
  }

  if (propio.registro) return propio.registro;

  // La copia común es de este club (por ejemplo, si su clave propia se
  // perdió): sirve. Si es de otro club, no se toca.
  if (comun.registro && comun.equipoId === equipoId) return comun.registro;

  return null;
};

/**
 * Guarda el borrador en la clave de su club y deja la copia común con el
 * club anotado. Sin club se escribe solo la común, sin club, como antes.
 */
export const escribirBorrador = (registro, equipoId) => {
  if (!equipoId) {
    return escribir(
      CLAVE_BORRADOR,
      JSON.stringify({ version: VERSION_BORRADOR, registro }),
    );
  }

  const texto = JSON.stringify({ version: VERSION_BORRADOR, registro, equipoId });
  const propio = escribir(claveBorrador(equipoId), texto);

  // La común no se pisa si es la única copia del borrador de otro club: con
  // el celular casi lleno, la clave propia de ese club no se pudo crear y su
  // partido vive solo ahí. Antes, abrir otro club lo borraba. Cuando hay
  // lugar, la clave de cada club es igual a la común y esto no cambia nada.
  const textoComun = leer(CLAVE_BORRADOR);
  const comun = interpretarBorrador(textoComun);
  const unicaCopiaDeOtro =
    comun.registro &&
    comun.conClub &&
    comun.equipoId &&
    comun.equipoId !== equipoId &&
    leer(claveBorrador(comun.equipoId)) !== textoComun;
  if (!unicaCopiaDeOtro) escribir(CLAVE_BORRADOR, texto);
  return propio;
};
