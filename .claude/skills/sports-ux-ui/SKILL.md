---
name: sports-ux-ui
description: Diseñar, mejorar o revisar la presentación y usabilidad de informes deportivos, tablas, bases de datos y dashboards de ARK con estética premium, limpia e intuitiva. Usar en pedidos visuales y de navegación; no en tareas exclusivamente de backend, cálculos o migraciones sin interfaz.
---

# Sports UX/UI para ARK

Aplicá la estética preferida de Santiago al alcance pedido: premium, limpia,
intuitiva, consistente, datos legibles y navegación simple. El resultado debe
ayudar a leer, comparar y actuar sin tener que aprender la estructura interna.

Si hay argumentos de invocación, usalos como pedido concreto:

$ARGUMENTS

Sin un objetivo concreto, pedí qué pantalla se quiere trabajar; no elijas un
rediseño por tu cuenta. Si se pide solo una revisión o propuesta, no edites archivos.

## Ubicar el trabajo

1. Leé [CLAUDE.md](../../../CLAUDE.md) y
   [docs/DESIGN_SYSTEM.md](../../../docs/DESIGN_SYSTEM.md), incluida «Preferencia
   visual y aplicación de la Skill». Es la fuente de criterios visuales; no crees
   otro sistema de diseño.
2. Revisá [docs/UI_DECISIONS.md](../../../docs/UI_DECISIONS.md) y las secciones
   pertinentes de [docs/PENDIENTES.md](../../../docs/PENDIENTES.md). Una preferencia
   estética no reabre decisiones descartadas. Si faltan una imagen o un acuerdo,
   no afirmes haberlos visto ni inventes sus detalles.
3. Revisá el estado de Git, el componente de la pantalla, sus estilos, formatos,
   traducciones y pruebas. Identificá la tarea principal, el contexto de los datos,
   las acciones existentes y los estados que puede ver la persona.

## Elegir y aplicar la mejora

- Explicá brevemente el problema visible y la mejora que lo resuelve. Priorizá
  jerarquía, alineación, legibilidad, densidad y controles comprensibles antes que
  efectos. Diseñá primero para celular y adaptá a escritorio.
- Reutilizá `AppChrome`, `SheetPanel`, `HojaOpciones`, `ConfirmSheet`, `TablaDatos`,
  `Ocultar`, `Guia` y los componentes del módulo que correspondan. Consultá el mapa
  de componentes y estilos en el sistema de diseño. Revisá sus consumidores antes
  de modificar algo compartido; preferí un ajuste local si el problema es local.
- En reportes, separá contexto, resultados y referencias con los patrones
  existentes. En bases, preservá comparación entre filas, cabeceras, identidad de
  fila y controles de la tabla. En dashboards pedidos, justificá cada resumen con
  datos existentes; no agregues métricas, gráficos o acciones desde una referencia.
- Mantené cálculos, precisión, unidades, filtros, reglas de color y comportamiento
  de ocultar. No cambies API, esquema, permisos, persistencia, sincronización ni
  exportaciones para resolver un pedido de estética.
- Conservá es-AR y pt-BR usando `src/idioma/`, etiquetas accesibles y foco visible.
  No transmitas significado solo con color. No agregues bibliotecas, fuentes ni un
  tema global para una mejora puntual.
- Respetá las excepciones vigentes: GPS › Informe no tiene tarjetas de promedios;
  su estética no se extiende automáticamente a otras tablas. La combinación del
  reporte de Lesiones con la imagen oscura sigue pendiente. Verificá la decisión
  actual completa en las fuentes anteriores antes de actuar.

## Comprobar y entregar

- Revisá el diff para confirmar que responde al pedido y conserva funcionalidad.
  Si solo cambió documentación, verificá contenido, rutas y enlaces.
- Si cambió código, ejecutá las pruebas pertinentes y `npm run build`, según
  CLAUDE.md. Ante una falla, distinguí la causa del cambio de un problema previo.
- Si cambió la interfaz, revisá el flujo a 320–390 px y en escritorio, teclado,
  nombres largos, traducciones y los estados afectados: vacío, carga, error, sin
  señal y solo lectura cuando apliquen. Si afecta un reporte imprimible, revisá
  también la impresión y las filas o columnas ocultas.
- Compará el antes y el después; en un cambio grande, mostralo si hay herramientas
  de captura disponibles. Usá datos de prueba anónimos, sin exponer datos del club.
  Si no hay navegador, sesión, datos o captura disponibles, informá el límite de
  la revisión; no presentes una inspección de código como prueba visual ejecutada.
- Cerrá con el formato de CLAUDE.md: CAMBIOS, POR QUÉ, NO SE MODIFICÓ, ARCHIVOS y
  CÓMO PROBARLO. Indicá las verificaciones realizadas y las pendientes.

Esta Skill guía el diseño solicitado; no publica, fusiona ramas ni autoriza cambios
fuera del pedido. Para cargarla y probarla en la nube, consultá
[docs/CLAUDE_CODE_CLOUD.md](../../../docs/CLAUDE_CODE_CLOUD.md).
