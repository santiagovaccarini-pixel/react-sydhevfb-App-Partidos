// Dónde quedó cada tabla de las bases (arriba/abajo y de costado), para
// volver ahí después de abrir una ficha o pegar y volver (Santiago, 18/10:
// «Donde estabas»). Se olvida al cambiar de solapa o de módulo: al entrar
// de nuevo, la base abre en la última fila («Abajo, en la última»).
const posiciones = new Map();

export const posicionDe = (clave) => (clave ? posiciones.get(clave) || null : null);

export const guardarPosicion = (clave, posicion) => {
  if (clave) posiciones.set(clave, posicion);
};

export const olvidarPosiciones = () => posiciones.clear();
