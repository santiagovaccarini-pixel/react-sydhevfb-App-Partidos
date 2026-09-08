# Auditoría técnica — Registro Partido

Fecha: 8 de septiembre de 2026
Rama revisada: `main` en `46d57ffb62a9113c7cb2850ae4d0988bab7a4a5a`

## Resultado

Se revisaron la aplicación React, estilos, configuración, migraciones SQL y el
módulo VBA. Esta rama corrige los problemas que podían resolverse sin cambiar
permisos ni eliminar datos. La autenticación/RLS queda como única decisión de
seguridad bloqueada por la lista de usuarios autorizados.

## Corregido en esta rama

- Borrado individual roto por el uso de un índice inexistente.
- Doble guardado que generaba registros repetidos; ahora un partido existente se
  actualiza por id o por fecha/rival y la migración agrega una barrera única.
- Fecha inicial calculada en UTC, que podía saltar al día siguiente en UTC-3.
- Clasificación del minuto 90 como prórroga aunque el partido no tuviera tiempo extra.
- Pérdida del modo Transmisión y de sus referencias al volver a abrir un partido.
- Rangos invertidos que podían producir duraciones de casi 24 horas.
- Alias de jugadores inconsistentes y falsos positivos en “No ingresaron”.
- Suma incompleta cuando había más de un evento VAR.
- Respaldo local que se sobrescribía vacío antes de cargar la nube.
- Borradores locales sin validación de tipos ni versión de esquema.
- Eliminación de la clave equivocada al limpiar el historial.
- JSONP sin límite de espera, sin validación de origen ni forma de respuesta.
- Registro de cargas completas del partido en la consola.
- Recursos visuales externos frágiles y una etiqueta de entrada incompatible con
  la herramienta de compilación anterior.
- Pantalla de carga fija de 1,8 segundos que demoraba innecesariamente el acceso al
  registro operativo.
- Dependencia obsoleta de Create React App: se migró a Vite/Vitest y `npm audit`
  queda en cero vulnerabilidades conocidas.
- Componente de detalle que se reiniciaba durante una edición por estar anidado con
  estado propio.
- Selectores de tiempo que podían cerrarse y perder el foco al modificar un valor;
  el reloj en vivo quedó aislado para no repintar el formulario cada segundo.
- VBA sin timeout, sin salida segura, con comparación literal de alias, selección
  no determinista, cálculo incorrecto al cruzar medianoche y una macro de prueba
  ajena al flujo.

## Riesgo pendiente que requiere una decisión

La app no presenta inicio de sesión. Si la tabla permite las operaciones actuales
al rol anónimo, cualquier persona que obtenga la URL podría intentar leer o alterar
partidos. La clave `sb_publishable_...` no es secreta por diseño; la protección debe
implementarse con Supabase Auth y políticas RLS.

Para cerrar este punto hacen falta los correos o el criterio de roles autorizado.
No se incluyó una política genérica que pudiera bloquear accidentalmente a los
usuarios actuales o permitir el alta libre de cualquier correo.

## Limitaciones conocidas del módulo Excel

La macro continúa leyendo las primeras cinco sustituciones del esquema histórico.
Los cambios extra y los períodos de prórroga se guardan correctamente en JSONB,
pero requieren acordar dónde escribirlos en la plantilla Excel antes de ampliar la
macro. Tampoco se reemplazó el parser RegExp por un parser JSON externo para evitar
agregar una dependencia VBA sin autorización.

## Verificación

- Pruebas unitarias del motor de tiempos y alias.
- 13 pruebas automatizadas: motor de tiempos y alias, reloj aislado, navegación
  PC/móvil, marcador, inicio de período, acción VAR, foco estable y doble guardado.
- Build de producción con Vite.
- Auditoría de dependencias de producción y desarrollo.
