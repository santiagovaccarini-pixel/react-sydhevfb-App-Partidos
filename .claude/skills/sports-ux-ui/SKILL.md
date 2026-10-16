---
name: sports-ux-ui
description: Aplicar la identidad deportiva negra/grafito y dorada y el estándar de claridad de ARK al crear, modificar o revisar interfaces web, formularios, navegación, reportes, tablas y dashboards. Usar también cuando se pide una función con interfaz sin mencionar diseño. No aplica a tareas exclusivamente de backend, cálculos o migraciones sin interfaz.
---

# Sports UX/UI para ARK

Aplicá la dirección visual de Santiago al alcance pedido: negro/grafito y dorado,
identidad deportiva, composición elegante, limpia y ordenada. La persona debe
entender rápidamente dónde está, qué está viendo y qué puede hacer. «Premium»
solo no alcanza para elegir ni evaluar un diseño.
Este es el estándar general de trabajo con interfaces, no una lista de cambios
por pantalla. Aplicalo aunque el pedido no mencione estética. El usuario define
la tarea; no necesita volver a describir sus preferencias visuales.

Si hay argumentos de invocación, usalos como pedido concreto:

$ARGUMENTS

Tomá el objetivo del pedido actual y su contexto; no exijas argumentos ni una lista
de retoques para aplicar el estándar. Si no hay ninguna tarea identificable,
consultá qué se quiere resolver. Si se pide solo revisión o propuesta, no edites.

## Ubicar el trabajo

1. Leé [CLAUDE.md](../../../CLAUDE.md) y
   [docs/DESIGN_SYSTEM.md](../../../docs/DESIGN_SYSTEM.md), especialmente la
   [dirección visual de ARK](../../../docs/DESIGN_SYSTEM.md#direccion-visual-ark)
   y la interpretación de las referencias. Es la fuente de criterios visuales;
   no crees otro sistema de diseño ni afirmes ver imágenes que no estén disponibles.
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
- Usá negro/grafito para la estructura y dorado sobrio para identidad, selección y
  énfasis. Separá esos acentos de los colores que expresan datos, franjas o calor.
  Un reporte puede tener cabecera oscura y cuerpo claro, con la misma identidad.
- Diseñá la composición: títulos con presencia, filtros agrupados, datos alineados,
  resultados junto a sus referencias y bloques con proporciones deliberadas.
  Colorear una plantilla genérica o sumar tarjetas no cumple por sí solo el estándar.
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
- Respetá las excepciones vigentes del módulo consultando su decisión actual
  completa. Mantené esas decisiones en sus fuentes; no conviertas esta Skill en
  un catálogo de casos particulares ni extiendas excepciones a toda la plataforma.
- En reportes de lesiones, la preferencia por el cuerpo anterior y posterior con
  zonas de calor está confirmada. Conservá el mapa y sus reglas actuales hasta un
  pedido sobre esa pieza; no inventes zonas, lateralidad, marcadores ni diagnósticos
  desde una imagen ilustrativa. Esta preferencia no devuelve la figura a la carga.

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
- Contrastá la propuesta con los rasgos documentados: identidad negro/dorado,
  orientación inmediata, lectura de datos y composición del reporte. Explicá qué
  rasgos aplicaste. Las dos propuestas anteriores «Editorial» y «Analítico» fueron
  rechazadas como dirección estética; no las uses como plantillas aprobadas.
- Cerrá con el formato de CLAUDE.md: CAMBIOS, POR QUÉ, NO SE MODIFICÓ, ARCHIVOS y
  CÓMO PROBARLO. Indicá las verificaciones realizadas y las pendientes.

Esta Skill guía el diseño solicitado; no publica, fusiona ramas ni autoriza cambios
fuera del pedido. Para cargarla y probarla en la nube, consultá
[docs/CLAUDE_CODE_CLOUD.md](../../../docs/CLAUDE_CODE_CLOUD.md).
