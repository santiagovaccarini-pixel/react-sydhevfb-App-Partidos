// Vuelca a un JSON la figura del cuerpo de la app (siluetaCuerpo.js) y sus
// músculos y tendones dibujados (anatomiaCuerpo.js), de frente y de
// espaldas, para que render.py arme las imágenes con relieve del mapa
// corporal de los reportes. Uso: node scripts/cuerpo-3d/volcar-geometria.mjs <salida.json>
import { writeFileSync } from "node:fs";
import { ORDEN_DE_REGIONES, dibujoDe } from "../../src/components/siluetaCuerpo.js";
import { estructurasDe } from "../../src/components/anatomiaCuerpo.js";

const salida = {};
for (const vista of ["frente", "espalda"]) {
  const piezas = [];
  const estructuras = [];
  const detalles = [];
  for (const region of ORDEN_DE_REGIONES) {
    const dibujo = dibujoDe(region, vista);
    if (!dibujo) continue;
    dibujo.piezas.forEach((pieza) => piezas.push({ region, parte: pieza.parte, d: pieza.camino, espejada: dibujo.espejada }));
    dibujo.detalles.forEach((camino) => detalles.push({ region, d: camino, espejada: dibujo.espejada }));
    estructurasDe(region, vista).forEach((una) => estructuras.push({ region, codigo: una.codigo, tipo: una.tipo, capa: una.capa || "superficie", d: una.camino, espejada: dibujo.espejada }));
  }
  salida[vista] = { piezas, estructuras, detalles };
}
writeFileSync(process.argv[2] || "geometria.json", JSON.stringify(salida));
