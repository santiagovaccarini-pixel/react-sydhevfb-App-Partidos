import { mensajeDeRespuesta } from "./trainingApi.js";

// Lo que el servidor contesta con un código se traduce a algo que se entienda
// sin conocer la cocina. Los códigos son los de api/openfield/*.
export const MENSAJES_CODIGO = {
  SIN_CUENTA: "Todavía no conectaste tu usuario. Hacelo en Ajustes › Usuario y contraseña.",
  SESION_APP: "Se venció tu acceso. Cerrá sesión y volvé a entrar.",
  SIN_CLAVE: "La app no está lista para enviar. Avisá por chat.",
  CONFIRMACION_INVALIDA: "El nombre no coincide. Escribilo tal cual.",
  SNAPSHOT_INCOMPLETO: "No se pudo leer la sesión. Probá de nuevo en un momento.",
  INTERNO_NO_LEGIBLE: "No se pudo leer la sesión. Probá de nuevo en un momento.",
  PLAN_INVALIDO: "Hay tareas que no se pueden enviar así. Revisá las marcadas.",
};

// Cómo terminó el envío, por código de veredicto.
export const ETIQUETAS_VEREDICTO = {
  "cortes-validados": "Todo quedó guardado en la sesión.",
  "cortes-con-diferencias": "Algunas tareas no quedaron como se pidió. Revisalas y volvé a enviar.",
  "ajenos-tocados": "Cambió algo de la sesión que la app no maneja. Avisá por chat.",
  "obsoletos-no-retirados": "Las tareas quedaron bien, pero una tarea vieja no se pudo sacar.",
  "sin-relectura": "Se envió, pero no se pudo confirmar. Fijate la señal y revisá más tarde.",
  "escritura-rechazada": "No se pudo enviar. Nada cambió; probá de nuevo.",
};

// Por qué una tarea quedó mal después del envío.
export const MOTIVOS_FALLO = {
  "no-encontrado": "no quedó como se pidió",
  diferencias: "no quedó como se pidió",
};

export const mensajeDeError = (payload, porDefecto) =>
  MENSAJES_CODIGO[payload?.code] || mensajeDeRespuesta(payload, porDefecto);
