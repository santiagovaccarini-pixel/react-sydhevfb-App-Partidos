// Las áreas del reporte individual de Evaluaciones (Santiago, 09/10: "Como
// la imagen"): cada test va en una, en este orden. Los tests que se suman
// dicen la suya en su archivo (`area`). Que el club las cambie en Ajustes
// queda para después (docs/PENDIENTES.md, "Evaluaciones").

const et = (es, pt) => ({ "es-AR": es, "pt-BR": pt });

export const AREAS = Object.freeze([
  { clave: "zona_media", titulo: et("Zona Media", "Zona Média") },
  { clave: "fuerza", titulo: et("Fuerza", "Força") },
  { clave: "potencia", titulo: et("Potencia y velocidad", "Potência e velocidade") },
  { clave: "funcionales", titulo: et("Funcionales", "Funcionais") },
]);

export const areaPorClave = (clave) => AREAS.find((area) => area.clave === clave) || null;
