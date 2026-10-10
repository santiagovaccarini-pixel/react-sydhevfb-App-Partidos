# Sistema de diseño y experiencia

## Objetivo

Una app deportiva elegante, simple, profesional, estética y agradable, donde
la persona entienda dónde está y cómo completar su tarea sin explicaciones largas.
Estas reglas guían los cambios pedidos; no autorizan rediseñar pantallas existentes.
Las decisiones específicas del producto se consultan en [UI_DECISIONS.md](UI_DECISIONS.md).

## Criterios para cada pantalla

- Jerarquía clara: título, contenido necesario y una acción principal reconocible
  por paso. Las acciones secundarias no compiten visualmente con ella.
- Pocos elementos simultáneos. Mostrá detalles y ajustes secundarios cuando se
  necesitan, con los patrones de pestañas y hojas que ya usa el módulo.
- Priorizá espacio libre, alineación, agrupación y tipografía antes de agregar
  contenedores. Evitá interfaces recargadas y tarjetas dentro de tarjetas.
- Tarjetas, bordes, sombras, badges, degradados e íconos solo si ayudan a entender
  un grupo, una acción o un estado. No los agregues como decoración repetitiva.
- Antes de agregar un elemento, comprobá si ayuda a decidir o actuar. Si repite
  información de otra sección, no lo agregues sin una necesidad concreta.
- Textos breves, cotidianos y consistentes. Conservá etiquetas, unidades, errores,
  confirmaciones y avisos necesarios; simplificar no debe quitar información útil.
- No muevas una función de lugar por conveniencia de implementación. Revisá primero
  las decisiones cerradas y la coherencia con los demás módulos.

## Primero celular

- Resolvé primero el flujo en pantalla angosta y con el dedo; después adaptalo a
  escritorio. Comprobá 320–390 px y una pantalla de escritorio, según lo afectado.
- Acciones cómodas de tocar, sin superposición con teclado o barras de navegación.
  Como objetivo para controles nuevos, usá un área de toque de al menos 44 × 44 px.
- Texto legible, foco visible, nombres accesibles para botones con íconos y estados
  comprensibles sin depender solo del color. Conservá la navegación por teclado.
- Evitá desplazamiento horizontal de la pantalla. En tablas densas, conservá el
  desplazamiento dentro de la tabla y sus columnas fijas según el diseño existente.
- Revisá títulos largos, nombres en dos renglones, formularios y hojas abiertas.
  No cambies globalmente tamaños o barras para arreglar una sola pantalla.
- En tablas densas prioriza el desplazamiento por teclado que pueda mover la tabla y siempre fijar los nombres y alguna informacion necesaria mas que consideres.

## Consistencia y reutilización

La regla existente es que lo igual en otro módulo sea igual en toda la web
(`PENDIENTES.md`, sección «Idioma, Lesiones y Datos básicos»). Reutilizá:

- `src/components/AppChrome.js`: marco y navegación compartidos.
- `src/components/SheetPanel.js`, `HojaOpciones.js` y `ConfirmSheet.js`: hojas,
  opciones y confirmaciones.
- `src/components/PortalTarjetas.jsx`: tarjetas y portadas de portal y bases.
- `src/components/TablaDatos.jsx` y `tablaDatos.css`: tablas de las bases.
- `src/components/ClubCrest.js` y `BotonVolver.jsx`: escudos y regreso.

Revisá `src/style.css`, `portal.css`, `training.css`, `lesiones.css`,
`evaluaciones.css` y `gps.css` antes de crear estilos; mantené sus convenciones de color,
tipografía y espaciado. No introduzcas una biblioteca visual o un tema nuevo
sin que sea parte del pedido. Todo texto nuevo sigue la regla existente de claves
en `src/idioma/es-AR.js` y `src/idioma/pt-BR.js`.

Las fotos y portadas del portal, las tarjetas de tareas y los colores de reportes
y Evaluaciones tienen decisiones específicas aprobadas. Evitar el exceso visual
no implica eliminarlos ni alterar su significado. Respetá las excepciones técnicas
documentadas, como los textos de Pruebas técnicas.

## Revisión antes de entregar

Comprobá que la tarea principal se entiende, los controles se leen y se tocan,
los patrones coinciden con el módulo y no reaparece nada descartado. Recorré los
estados afectados sin quitar avisos de guardado, permisos o falta de datos.
Contrastá el antes y el después y verificá que el cambio visual conserva el flujo,
los resultados y la funcionalidad. Informá límites de la revisión realizada.
