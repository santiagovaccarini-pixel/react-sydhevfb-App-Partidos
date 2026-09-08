# Auditoría técnica — Registro Partido

Fecha: 8 de septiembre de 2026
Rama revisada: `main` en `46d57ffb62a9113c7cb2850ae4d0988bab7a4a5a`

## Resultado

Se revisaron la aplicación React, estilos, configuración, migraciones SQL y el
módulo VBA. Esta rama corrige los problemas detectados e incorpora acceso
multiusuario: cualquier correo puede crear una cuenta, cada usuario trabaja sólo
con sus partidos y una cuenta administradora puede consultar el historial global.

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
- Acceso anónimo a los partidos: ahora la aplicación exige enlace mágico por
  correo y no monta la interfaz ni consulta datos antes de validar la sesión.
- Historial compartido sin aislamiento: cada fila queda asociada a `owner_id`,
  los borradores locales usan una clave distinta por usuario y RLS limita las
  escrituras al propietario. El administrador sólo obtiene lectura global.
- Índice global fecha/rival incompatible con varias cuentas; la unicidad ahora se
  aplica por propietario.
- Borrado masivo peligroso para el administrador; ahora “Borrar mis registros”
  nunca incluye filas de otras cuentas.
- Dependencia obsoleta de Create React App: se migró a Vite/Vitest y `npm audit`
  queda en cero vulnerabilidades conocidas; Vercel queda configurado para publicar
  la salida `dist` del nuevo build.
- Componente de detalle que se reiniciaba durante una edición por estar anidado con
  estado propio.
- Selectores de tiempo que podían cerrarse y perder el foco al modificar un valor;
  el reloj en vivo quedó aislado para no repintar el formulario cada segundo.
- VBA sin timeout, sin salida segura, con comparación literal de alias, selección
  no determinista, cálculo incorrecto al cruzar medianoche y una macro de prueba
  ajena al flujo.

## Activación pendiente en infraestructura

El código y las políticas están preparados, pero la protección no existe en la
base activa hasta ejecutar las migraciones desde Supabase. Después hay que iniciar
sesión una vez y ejecutar `supabase/configurar_admin.sql` con el correo del
administrador. El correo real no se guarda en el repositorio.

## Limitaciones conocidas del módulo Excel

La macro continúa leyendo las primeras cinco sustituciones del esquema histórico.
Los cambios extra y los períodos de prórroga se guardan correctamente en JSONB,
pero requieren acordar dónde escribirlos en la plantilla Excel antes de ampliar la
macro. Tampoco se reemplazó el parser RegExp por un parser JSON externo para evitar
agregar una dependencia VBA sin autorización.

Además, la macro usa actualmente el rol anónimo de Supabase. RLS bloquea esa vía
para no filtrar datos entre cuentas. Su reactivación segura requiere un endpoint
servidor autenticado; una clave `service_role` nunca debe guardarse en VBA.

## Verificación

- Pruebas unitarias del motor de tiempos y alias.
- 17 pruebas automatizadas: motor de tiempos y alias, reloj aislado, navegación
  PC/móvil, marcador, inicio de período, acción VAR, foco estable, doble guardado,
  sesión por correo y registros ajenos de solo lectura.
- Build de producción con Vite.
- Auditoría de dependencias de producción y desarrollo.
