# Instrucciones persistentes para Claude

Aplican a todo el proyecto: Respondé en castellano simple.

## Antes de cambiar algo

1. Leé estas instrucciones, [el sistema de diseño](docs/DESIGN_SYSTEM.md),
   [el índice de decisiones](docs/UI_DECISIONS.md), el README y las secciones de
   `docs/PENDIENTES.md` del módulo afectado. Buscá también reglas locales.
2. Revisá el estado de Git, la pantalla, sus componentes compartidos y sus pruebas.
   Conservá cambios ajenos. Identificá qué pidió el usuario y qué queda afuera.
3. Distinguí decisiones aprobadas, propuestas y pendientes. Una lista de pendientes
   no autoriza implementarlos. La auditoría del 08/09 es histórica: contrastá sus
   conclusiones con la documentación posterior y el código actual.
4. Si falta una decisión imprescindible o hay contradicciones sin resolver,
   explicá el punto concreto y consultá; continuá lo que no dependa de él.

## Cómo trabajar

- Diseñá una interfaz elegante, simple, profesional, estética, agradable e
  intuitiva siguiendo `docs/DESIGN_SYSTEM.md`. Primero celular.
- Hacé el cambio mínimo necesario. No agregues funcionalidades, reorganices
  módulos, hagas refactorizaciones ni cambies dependencias fuera del pedido.
- Protegé lógica y funcionalidad: cálculos, fechas, importación/exportación,
  guardado local, sincronización, funcionamiento sin señal, permisos por club,
  modo de solo lectura y trazabilidad. Un pedido visual no autoriza cambiarlos.
- Reutilizá componentes y estilos existentes. Revisá todos sus consumidores si
  tocás algo compartido; no impongas un nuevo estilo al resto de la app.
- No reintroduzcas un elemento, ubicación o comportamiento descartado, ni lo
  renombres para volver a ponerlo. Solo un pedido explícito del usuario puede
  reabrir esa decisión; registrá la nueva decisión y su motivo.
- No inventes acuerdos de conversaciones que no están disponibles. Registrá
  nuevas decisiones con su fuente, alcance y qué queda prohibido.
- No borres ni reescribas decisiones existentes para simplificar documentación.
  Integrá reglas en su fuente actual y enlazalas; evitá versiones paralelas.
- Respetá las reglas de idioma, protocolo, Excel y privacidad ya documentadas.
  No publiques datos personales, credenciales ni valores de referencia del club.

## Verificación

Revisá el diff y comprobá alcance, enlaces y decisiones antes de cerrar.
Para cambios de código, ejecutá las pruebas pertinentes y `npm run build`;
`npm test` cubre la app. Si cambiás permisos o migraciones, ejecutá también
`npm run pruebas:base` en el entorno compatible con Bash/Postgres que usa CI.
Para cambios visuales, recorré el flujo en celular y escritorio, con los estados
afectados (vacío, carga, error, sin señal o solo lectura cuando corresponda).
Para documentación sola, verificá contenido y enlaces; no hace falta instalar
dependencias ni ejecutar la app. Informá exactamente qué se verificó y qué falta.

## Cierre obligatorio de cada cambio

Usá siempre estas cinco secciones, sin jerga y con información concreta:

### CAMBIOS
Qué cambió y qué va a ver o poder hacer la persona.

### POR QUÉ
Qué problema del pedido resuelve.

### NO SE MODIFICÓ
Qué lógica, funcionalidades y áreas relacionadas quedaron intactas.

### ARCHIVOS
Rutas de los archivos modificados y para qué se tocó cada uno.

### CÓMO PROBARLO
Pasos sencillos y resultado esperado; verificaciones realizadas y pendientes.
No afirmes que una prueba pasó si no la ejecutaste.
