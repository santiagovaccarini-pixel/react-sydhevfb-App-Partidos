// Consentimiento de los atletas (20261103): lo que no habla con la base,
// para que lo usen también los módulos que no la tocan (los errores de cada
// base) y consentimientoDb.js.

// El nombre de una persona como lo compara la base (persona_normalizada).
export const normalizarPersona = (nombre) =>
  String(nombre ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Lo que la base contestó al cargar sin la confirmación del club o de una
// persona, como clave del diccionario ("" si es otra cosa).
export const claveDeErrorConsentimiento = (error) => {
  const texto = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  if (/falta_consentimiento_persona/.test(texto)) return "consentimiento.error.persona";
  if (/falta_consentimiento/.test(texto)) return "consentimiento.error.club";
  return "";
};

// Las que todavía no están confirmadas, sin repetir (como se escribieron la
// primera vez).
export const personasSinConfirmar = (nombres, confirmadas) => {
  const vistas = new Set();
  const faltan = [];
  (nombres || []).forEach((nombre) => {
    const limpio = String(nombre ?? "").replace(/\s+/g, " ").trim();
    const clave = normalizarPersona(limpio);
    if (!clave || vistas.has(clave) || confirmadas?.has(clave)) return;
    vistas.add(clave);
    faltan.push(limpio);
  });
  return faltan;
};
