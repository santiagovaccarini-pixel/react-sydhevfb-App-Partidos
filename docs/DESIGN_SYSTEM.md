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

## Textos que guían (14/10)

Santiago, 14/10: «no tiene que haber referencias a excels especificos ni solapas especificas,
pensa como si lo fuese a usar por primera ves y necesitas una guia exacta de lo que se
necesita para saber que hacer y donde estas parado, que haces cada cosa y como guiarte mejor».
Aprobó la propuesta («esta bien todo»). Se aplica de a un módulo, empezando por GPS (después,
Lesiones, 14/10); los demás siguen como estaban hasta su turno (UI-031).

- **Para quien la usa por primera vez.** No conoce las planillas del club ni cómo se trabajaba
  antes: nada de «como en el Excel», «como hoy» ni «como la plantilla».
- **Sin planillas, hojas ni archivos del club.** No se nombran planillas, hojas (solapas),
  plantillas, columnas por letra ni archivos propios: se dice qué es cada cosa por lo que hace.
  Las herramientas que se usan de verdad sí se nombran (Catapult, OpenField, CSV).
- **Pegar desde una planilla.** El botón y los textos para traer lo que ya se tenía dicen
  «planilla», no «Excel».
- **Dónde estás.** Cada pantalla tiene, debajo de su título, una línea con para qué sirve.
- **Qué hacer ahora.** En una carga por pasos: «Paso X de N», lo que hay que hacer en pasos
  numerados (uno por acción, empezando por el verbo) y el botón de avanzar dice a dónde va
  («Siguiente: La sesión»). Un texto con pasos se escribe con un renglón por paso («1. …»,
  «2. …») y se muestra como lista (`TextoConPasos` en `src/components/Guia.jsx`).
- **Qué es cada cosa.** Las palabras propias (Team Average, Va, V.R., microciclo…) llevan un
  «?» al lado que abre su explicación en una o dos líneas (`Termino`). No se inventa una
  explicación: si no está documentado qué significa algo, se pregunta. En papel (los reportes)
  no salen ni los «?» ni el de la guía.
- **Guía del módulo.** «Cómo se usa» (el «?» de arriba, al lado del idioma) abre los pasos de lo
  que se hace en el módulo y las palabras que se usan (`GuiaDelModulo`). La primera vez que se
  entra al módulo en un aparato se ofrece verla («Ver cómo se usa» / «Ahora no»), una sola vez.
- **Avisos.** Qué pasó y qué hacer. Lo técnico (archivos SQL, nombres de tablas) no se muestra:
  «Falta una actualización de la base de datos… Avisale a quien administra la app.»
- **Tono.** Castellano rioplatense con «vos», cotidiano y en frases cortas; los botones se
  nombran entre «» tal como se ven. Todo en es-AR y en pt-BR.
- **Más adelante**: un modo tutorial (Santiago, 14/10: «tmb pensa que despues tenemos que hacer
  un modo tutorial, pero eso queda mas para adelante»). Ver PENDIENTES, «Modo tutorial la
  primera vez».

## La presentación (15/10)

Santiago, 15/10: «NECESITO QUE HAGAS MUCHO HINCAPIE EN LA MANERA DE PRESENTAR LAS COSAS Y QUE SE
VEAN MEJOR VISUALMENTE Y MAS INTUITIVAS NO SOLAMENTE PONERLAS Y PUNTO». Vale para todo lo que se
haga: no alcanza con que los datos estén; antes de entregar se mira cómo se leen, en el celular
y en la compu, y si el cambio es grande se le muestra el antes y el después.

En una tabla de datos (la primera hecha así: GPS › Informe, 15/10):

- Arriba, qué se está viendo: cuántas filas hay y contra qué se compara.
- La cabecera y la primera columna quedan a la vista al bajar y al deslizar de costado.
- La primera columna dice qué es cada fila, sin repetir el mismo texto en todas.
- Los números van a la derecha, con cifras del mismo ancho; donde no hay dato, «–»; todas las
  filas tienen el mismo alto.
- Las referencias (franjas, V.R.) van en un bloque aparte de los datos, con el color que toma
  cada una.
- Los colores de franjas y semáforos son los suaves de `src/domain/colores.js`. La cabecera no
  lleva un color fuerte por grupo: el tono del grupo es una línea.
- Una columna o una fila se oculta tocando su nombre, que pregunta antes. «Columnas» y «Filas»,
  arriba, dicen cuántas hay ocultas y las vuelven a mostrar. Los números no cambian.

Las tablas que ya están conservan su estilo hasta que Santiago decida llevarles este
(«Despues lo vemos», 15/10). Los colores suaves y ocultar columnas y filas sí van en toda la
app (ver `PENDIENTES.md`, «Toda la app: presentación, colores suaves y ocultar»).

## Revisión antes de entregar

Comprobá que la tarea principal se entiende, los controles se leen y se tocan,
los patrones coinciden con el módulo y no reaparece nada descartado. Recorré los
estados afectados sin quitar avisos de guardado, permisos o falta de datos.
Contrastá el antes y el después y verificá que el cambio visual conserva el flujo,
los resultados y la funcionalidad. Informá límites de la revisión realizada.
