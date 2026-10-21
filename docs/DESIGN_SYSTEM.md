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

- `src/components/AppChrome.js`: marco y navegación compartidos. En la compu, la barra lateral
  se achica a íconos y se abre tocando el escudo (el aparato lo recuerda); en el celular, la
  barra de abajo se va al bajar (la página o una tabla o lista grande de adentro) y vuelve al
  subir (UI-053).
- `src/components/SheetPanel.js`, `HojaOpciones.js` y `ConfirmSheet.js`: hojas,
  opciones y confirmaciones.
- `src/components/PortalTarjetas.jsx`: tarjetas y portadas de portal y bases, y las filas
  compactas de «Del club» del portal (`AccesosDelClub`, UI-050).
- `src/components/TablaDatos.jsx` y `tablaDatos.css`: tablas de las bases. Abren en la última
  fila y, al volver de una ficha, donde estaban (`abrirAlFinal`, encendido de entrada; UI-054):
  una base nueva lo trae solo; lo que no es una base lo apaga. Dos colores de fila, cada uno con
  su leyenda: gris cálido, quien ya no está en el plantel (`apagada`); dorado claro, lo cargado o
  cambiado sin señal que espera para subir (`espera`, UI-072).
- `src/components/ClubCrest.js` y `BotonVolver.jsx`: escudos y regreso.
- `src/components/BotonModulos.jsx`: volver a los módulos desde el encabezado, fijo arriba al
  bajar (UI-051).
- `src/components/SinSenal.jsx`: ver una base sin señal, igual en Lesiones, Evaluaciones y GPS:
  la copia del aparato, que se guarda sola, y el aviso de la copia (UI-065 a UI-067). En una
  base que deja cargar sin señal, `AvisoDeEspera`: el aviso dorado con cuántos cambios esperan
  para subir y, con señal, «Subir ahora» (UI-072); la cola, en `domain/filaDeEspera.js`. En
  las tarjetas de Nuevos casos de Lesiones, lo que espera va en dorado claro con la pastilla
  «Espera para subir» (`lesiones.css`, UI-073).

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
  filas tienen el mismo alto. (En el Informe, centrados desde el 15/10: ver abajo.)
- Las referencias (franjas, V.R.) van en un bloque aparte de los datos, con el color que toma
  cada una.
- Los colores de franjas y semáforos salen de `src/domain/colores.js`: en una celda pintada, el
  degradé de blanco a su tono fuerte (`rellenoDe()`, desde el 17/10, UI-040). La cabecera no
  lleva un color fuerte por grupo: el tono del grupo es una línea. (En el Informe, el fondo del
  tono desde el 15/10: ver abajo.)
- Una columna o una fila se oculta tocando su nombre, que pregunta antes. «Columnas» y «Filas»,
  arriba, dicen cuántas hay ocultas y las vuelven a mostrar. Los números no cambian. En las
  bases, donde tocar el nombre de la cabecera ya fija y mueve la columna, se oculta desde su
  embudo; las filas, eligiéndolas y tocando «Ocultar fila». Lo oculto se ve en ámbar con las
  demás acciones («1 columna oculta», «Mostrar las 2 filas ocultas»). En los reportes y los
  V.R., como en el Informe, con `src/components/Ocultar.jsx`; donde el nombre de una fila ya
  es otra cosa (un desplegable), el ojo tachado al lado. Lo oculto no sale al imprimir y dura
  mientras se está en esa base o ese informe: al salir, todo vuelve a verse (UI-039, 17/10).

**El Informe de GPS, con la estética de una imagen (15/10).** Santiago mandó la imagen de una
pantalla de ejemplo para el Informe («esta seria una estetica agradable a la vista y buena para
poder ver los datos, sacando el grafico pero dejando lo demas … NADA DE DATOS O CABECERAS
INVENTADAS»). En todo el Informe: tarjetas oscuras (`#0f172a`, borde finito, esquinas de 16 px);
los desplegables en una fila en la compu ancha, cada uno con su ícono a la izquierda; el título
de cada grupo con el fondo de su tono (`--grupo-fondo-N`, el de las bases) y su línea; las
franjas pintadas enteras con la letra oscura; el V.R. y el desvío en gris y cursiva; los
números centrados. De una imagen de ejemplo se toma cómo se ve, nunca sus datos, cabeceras ni
funciones (el gráfico, las tarjetas con números, «Exportar»): eso se pregunta. Las tarjetas se
preguntaron y el 15/10 fueron arriba de cada columna, con su promedio (Santiago: «quiero que
pongas el promedio de cada variable arriba de su columna»): oscuras, el número grande en negrita
y una línea arriba con el tono del grupo de su columna; qué son (el rótulo «Promedio», con su
«?») iba una sola vez, en la primera columna, no en cada tarjeta. **Sacadas el 16/10**
(Santiago: «no eso dejalo y mejor saca la ultima implementacion de los promedios con las
tarjetas»): el Informe no lleva tarjetas con números ni la comparación
«vs. microciclo anterior»; no volver a ponerlas si Santiago no lo pide.

Las tablas que ya están conservan su estilo hasta que Santiago decida llevarles este
(«Despues lo vemos», 15/10). Los colores suaves y ocultar columnas y filas sí van en toda la
app (ver `PENDIENTES.md`, «Toda la app: presentación, colores suaves y ocultar»).

## El espacio (16/10)

Santiago, 16/10: «no esta sobrando muchisimo espacio en todas las cosas que fuimos agregando …
me gustaria que dejemos esta correccion como un estandar para la web»; «es en todas las
pantallas». Vio una primera pasada (antes y después, en la compu y en el celular) y el mismo
16/10 pidió subirla: «podes subir los cambio de la reduccion de espacios». Es una regla para todo
lo que se haga; lo que falta pasar está en `PENDIENTES.md`, «El espacio en toda la web (16/10)».

- Nada es más ancho ni más alto que lo que muestra. En la compu, un botón, un aviso o un campo
  mide lo que su texto, con un mínimo cómodo para tocarlo; en el celular, los botones siguen a
  lo ancho, para el dedo.
- Lo que es una lista va en columnas en la compu: los menús de opciones (Ajustes, Ver informes,
  Cabeceras, Listas) dentro de `.lista-opciones` (columnas de al menos 300 px; en el celular,
  una), las listas para elegir (rivales, equipos) en columnas de 280 px y las tarjetas del portal
  y de Bases de Datos en todas las columnas que entren.
- Los campos, del ancho de lo que se escribe: hasta 440 px un texto o un desplegable, 240 px una
  fecha, una hora o un número y 760 px un texto largo. Dentro de una tabla o de una hoja, sin
  límite.
- Un rótulo y su valor, cerca, no en las dos puntas de la pantalla; la cantidad, al lado de su
  título. «Volver» y «Guardar», juntos a la derecha, cada uno de su ancho.
- En los reportes, la barra de arriba (`.reporte-acciones`, en `lesiones.css`: Volver, Cambiar
  jugador, Imprimir, Siguiente) queda fija arriba al bajar, sobre un vidrio grafito que aparece
  al bajar; en el celular, en dos renglones si no entra, sin achicar la letra (UI-051). Un
  reporte nuevo usa esa barra.
- El botón para volver a los módulos del encabezado de cada módulo es `BotonModulos`: al bajar,
  el mismo botón queda fijo arriba sobre ese vidrio (UI-051). Un módulo nuevo lo usa.
- Lo que va fijo arriba de la barra de abajo del celular (la fila de Volver, los avisos) se
  ubica con `--alto-barra-abajo` (en `style.css`), así baja con ella cuando se va (UI-053). Un
  elemento fijo nuevo apoyado en esa barra la usa.
- Una sola separación entre tarjetas, no el hueco del contenedor más el margen de cada una.
- Encabezados bajos: el de cada módulo con escudo (GPS, Lesiones, Evaluaciones, Datos básicos),
  con el escudo chico a la izquierda y, al lado, el módulo, el club, la fecha y su pastilla (en
  la compu, todo en una franja); el de Partido y Flujo diario, con «Módulos» y el rótulo en la
  misma fila y los escudos más chicos.
- Las filas con acciones (Cuentas, Clubes de la app, Notas): en la compu, los datos a la
  izquierda y los botones a la derecha, en una franja.

Lo común está al final de `src/style.css` («El espacio»); lo de cada módulo, en su hoja de
estilos. Para ganar espacio no se saca ni se cambia ningún dato, texto ni función: si algo
sobra, se consulta.

## Preferencia visual y aplicación de la Skill (16/10)

El pedido del 16/10 para configurar Claude Code Cloud define esta dirección:
**premium, limpia, intuitiva y consistente, con datos legibles y navegación simple**,
tomando como referencia la estética de informes de lesiones, tablas y dashboards.
Premium se expresa en jerarquía, proporciones, alineación y cuidado de los detalles;
no requiere más tarjetas, efectos ni información.

El pedido posterior del mismo 16/10 precisa esa dirección con negro y dorado y dos
referencias visuales. La sección siguiente es la definición estética vigente;
las palabras generales anteriores se interpretan a través de ella.

Estos criterios amplían esta misma fuente de diseño. La Skill
[sports-ux-ui](../.claude/skills/sports-ux-ui/SKILL.md) los aplica al trabajo pedido;
no convierte propuestas pendientes en decisiones cerradas ni autoriza un rediseño
general. Las reglas específicas de cada módulo conservan su alcance.

<a id="direccion-visual-ark"></a>

### Dirección visual: negro, dorado y claridad (16/10)

Fuente: pedido explícito del usuario en la conversación de configuración de
Claude Code Cloud, acompañado por una interfaz de análisis por microciclo y un
reporte individual de lesiones. Pidió predominio de negro y dorado, una estética
limpia y ordenada, reportes elegantes y hechos con criterio, y comprensión rápida
al entrar. Su principio es: «donde el usuario se pierda, perdemos nosotros».

**Identidad de la aplicación.** Negro y grafito dominan el marco, la navegación
y las superficies de trabajo; deben distinguirse entre sí para que se reconozcan
los niveles. Dorado sobrio y cálido marca identidad, selección o énfasis en poca
superficie. Texto principal blanco o casi blanco, secundario gris legible. Bordes
discretos, sombras contenidas y radios coherentes; el volumen se obtiene por
contraste y alineación. Los tonos azulados y verdes de la primera captura no
reemplazan el negro/dorado que el usuario pidió expresamente.

Los colores de datos conservan su significado: franjas, comparaciones, clases,
grupos y calor siguen sus fuentes de dominio y decisiones vigentes. No convertir
un semáforo o un mapa corporal a dorado para hacerlo coincidir con la marca.

Como punto de partida técnico, se pueden evaluar negro `#0B0D10`, grafito
`#171B20` y dorado `#C6A15B`, con texto claro `#F2F4F7`. Son valores propuestos para
implementar y comprobar contraste, no colores exactos extraídos de las capturas
ni valores ya aplicados. Reutilizar componentes no exige conservar un acento de
marca anterior cuando el pedido autoriza trabajar el aspecto de esa pieza.

**Composición de la web.** Título fuerte, una explicación breve y controles
agrupados por tarea. En escritorio, filtros alineados en una banda; en celular,
reordenados con etiquetas visibles, sin achicar todo hasta que entre. El lugar
activo se distingue por texto y tratamiento visual; la navegación existente
mantiene sus destinos y un regreso claro. La barra lateral de la captura es una
referencia de orientación, no una orden para reemplazar la navegación del producto.
No agregar pasos, opciones o paneles permanentes que obliguen a buscar la acción.

**Composición de los reportes.** Identidad deportiva reconocible: cabecera oscura
con club y jugador o plantel, título con presencia y datos de contexto subordinados.
Las fotos y escudos se usan cuando existen y corresponden, con una composición
deliberada. Cuerpo claro o gris muy suave es compatible con negro/dorado y facilita
el papel; no es obligatorio oscurecer todas las celdas. La vista de pantalla sigue
las decisiones vigentes del módulo, sin extenderle un tema por una captura.
Resultados, unidades y referencias se leen como un conjunto. Indicadores, mapa e
historial comparten alineaciones, márgenes y proporciones; el cuerpo humano es una
pieza de información, no decoración ni una figura diminuta en un espacio sobrante.
La tabla tiene cabeceras agrupadas, filas regulares, cifras comparables y contexto.
Se conservan campos, formato de comparación y funciones aprobados: una portada
espectacular no compensa datos difíciles de leer ni permite quitar columnas.

#### Cómo interpretar los ejemplos

| Referencia aportada | Rasgos que orientan el diseño | Contenido que no queda autorizado por la imagen |
| --- | --- | --- |
| Interfaz de análisis por microciclo | Fondo oscuro por capas, título claro, controles alineados, agrupación de variables, estructura de tabla y lugar activo reconocible. Aplicar el acento de marca dorado pedido por el usuario. | Gráfico, métricas de resumen, comparaciones, selector de temporada, exportaciones, cifras y cabeceras. Se mantienen los descartes de UI-038 y los colores de UI-040. |
| Reporte individual de lesiones | Cabecera deportiva negra, identidad del jugador, tipografía con jerarquía, bloques de tasas organizados, figura anterior y posterior y tabla de historial compuesta como parte del mismo documento. | Cifras, identidad del jugador de ejemplo, «Categoría 4*», nuevos resúmenes, puntos de «Sobre referencia», líneas y marcadores anatómicos o lateralidad ilustrativa. No reabre descartes ni cambia el mapa clínico. |
| Otro reporte de lesiones mencionado por el usuario | Está confirmada la preferencia por un cuerpo humano de frente y de espalda con zonas de calor. | Esa otra imagen no está disponible en esta conversación; no atribuirle una paleta, figura, distribución o funciones que no se pudieron observar. |

Las capturas se interpretan aquí por sus rasgos visuales. No se incorporan sus
datos personales o clínicos al repositorio ni se asume que los archivos temporales
del chat estarán disponibles en Claude Cloud. Si las imágenes no están en el
checkout, usar esta descripción y explicar esa limitación al compararlas.

El usuario rechazó las propuestas «Editorial» y «Analítico» presentadas antes de
estas referencias. No son ejemplos aprobados. Mantener orden, espaciado y una
tabla legible es necesario, pero una plantilla administrativa genérica, recoloreada
o llena de tarjetas intercambiables, no representa por sí sola esta dirección.

#### Criterio de aceptación del diseño

Al presentar un cambio, contrastar el resultado con estos puntos observables:

- Se reconoce la identidad negra/grafito y dorada sin confundir colores de marca
  con colores que expresan datos.
- Se entiende el módulo, qué datos se ven, el contexto y la siguiente acción con
  el título, las etiquetas y el estado visible; no hace falta adivinar un ícono.
- Los resultados se pueden comparar y sus unidades y referencias se encuentran
  junto a ellos; no se achica la letra ni se omite información para encajar.
- Cabecera, controles, bloques, figura y tabla comparten una retícula y una
  jerarquía intencionales. Explicar qué rasgos de las referencias se aplicaron.
- Celular, escritorio y papel cuando corresponda conservan legibilidad y recorrido.

Esta dirección guía los trabajos de interfaz que se pidan. No ordena repintar la
plataforma completa ni implementar todos los elementos de las imágenes. La nueva
figura del mapa de calor, su geometría y sus interacciones siguen el alcance de
UI-024 y los pendientes del módulo; la carga de Lesiones sigue sin figura (UI-036).

### Estándar por defecto para todo trabajo de interfaz

El usuario indica qué necesita lograr. Claude aplica estos criterios sin exigir
un pedido adicional de diseño ni una lista de ajustes por pantalla, tanto al
crear una función con interfaz como al mejorar una existente:

1. **Entender al entrar.** La pantalla deja claro dónde estás, qué muestra y cuál
   es el siguiente paso, con el contexto mínimo necesario.
2. **Leer y comparar sin esfuerzo.** Jerarquía tipográfica, alineación, espacio y
   contraste ordenan la información. La densidad acompaña la tarea; no se ocultan
   datos útiles para que la pantalla parezca más limpia.
3. **Actuar con claridad.** Acciones principales reconocibles, controles con
   nombres comprensibles, regreso previsible y estados que explican qué pasó.
4. **Reconocer el mismo producto.** Mismos patrones para tareas equivalentes,
   componentes existentes y significado consistente de colores, íconos y palabras.
5. **Funcionar en el contexto real.** Celular, escritorio, teclado, traducciones
   y estados afectados forman parte de la entrega. Impresión cuando corresponda.

Antes de cerrar, evaluá el resultado con esos cinco criterios y corregí los
problemas dentro del alcance autorizado. No hace falta agregar elementos nuevos
para cumplirlos. El estándar no dispara rediseños de pantallas ajenas al pedido.
Los acuerdos particulares permanecen en UI_DECISIONS y PENDIENTES, sin copiarlos
a cada nueva instrucción.

### Referencias y valores existentes

Antes de elegir valores, buscá la clase que usa la pantalla. Los siguientes son
ejemplos del estado actual, no una paleta de marca que reemplace la dirección
negro/dorado anterior. No deben imponerse a todos los módulos:

| Elemento | Fuente actual | Criterio de uso |
| --- | --- | --- |
| Tipografía de interfaz | `src/style.css`: Inter con Arial/sans-serif de respaldo | Conservá la familia y la escala del módulo; no agregues fuentes por estética. |
| Reportes de Lesiones | `src/lesiones.css`: Roboto Condensed en partes del reporte | Conservá su densidad y sus estilos de impresión; no cambies toda la app a esta fuente. |
| Superficies oscuras del Informe GPS | «La presentación», arriba; `src/gps.css` | Fondo `#0f172a`, bordes discretos y esquinas de 16 px donde ya corresponde. No implica pasar los reportes de Lesiones a oscuro. |
| Tonos de grupos de tablas | `src/components/tablaDatos.css`: `--grupo-fondo-N` y `--grupo-linea-N` | Reutilizá el par de cada grupo con su significado actual; evitá paletas paralelas. |
| Franjas y semáforos | `src/domain/colores.js`: `COLORES_SUAVES`, `suave()`, `COLORES_FUERTES` y `rellenoDe()` (el degradé de cada celda pintada) | Conservá categorías, umbrales y excepciones de UI-040; no son colores decorativos intercambiables. Pintá una celda con `rellenoDe(color)`, no con el color liso. |

El mapa de calor de Lesiones, sus gráficos y los colores de clases mantienen sus
reglas propias. Una preferencia estética no cambia el significado de un color.

### Informes y dashboards que se pidan

- Mostrá primero qué se está viendo: título, período, jugador o plantel y filtros
  aplicados cuando correspondan. Reutilizá el contexto existente sin duplicarlo.
- Hacé que se distingan el valor, la unidad y la referencia. Un porcentaje necesita
  una base de comparación comprensible. Conservá precisión, signos y redondeos.
- Usá solo métricas y gráficos existentes o expresamente pedidos y definidos.
  Una captura de referencia no autoriza copiar sus números, columnas ni acciones.
  Si un dato falta, mostrá su ausencia; no lo inventes ni lo conviertas en cero.
- Una tarjeta de resumen se justifica si aporta una lectura útil y está dentro del
  pedido. No repitas cada cifra de la tabla en una tarjeta. Consultá las decisiones
  del módulo para saber qué resúmenes están aprobados y cuáles descartados.
- Si se afecta la impresión, revisá también la vista de papel: títulos y columnas
  completos, leyendas legibles y cortes de página útiles. Conservá formato y
  orientación aprobados, y la regla de que lo oculto no sale al imprimir. Las ayudas
  interactivas no van al papel. No agregues un botón de exportación por una imagen.

### Tablas y bases de datos legibles

- Conservá el comportamiento de `TablaDatos`: selección, edición, pegado, filtros,
  orden, tamaños y columnas fijas. Las cabeceras y celdas no se reemplazan por
  tarjetas si con eso se pierde la comparación entre filas.
- En tablas anchas, mantené visible la identidad de la fila y la cabecera usando
  los mecanismos existentes. El desplazamiento queda dentro de la tabla y debe
  poder operarse con teclado sin bloquear la navegación al resto de la pantalla.
- Usá cifras de ancho uniforme (`tabular-nums`) donde el módulo lo admite, con
  unidades en la cabecera o el contexto. Conservá la alineación aprobada de cada
  tabla; no impongas una alineación universal si contradice su diseño vigente.
- No reduzcas la letra hasta volverla ilegible para hacer entrar más columnas.
  Conservá nombres y unidades accesibles cuando un texto deba recortarse.
- Distinguí vacío, cero y dato faltante según los formatos existentes. Ocultar filas
  o columnas cambia su visibilidad, no los cálculos; filtrar conserva su propia
  lógica (UI-039). La cantidad de filas va arriba, sin agregar una columna #.

### Navegación, lectura y estados

- Una acción principal clara por paso y un regreso reconocible con los componentes
  existentes. Conservá el lugar y el nombre de cada módulo, sus solapas y filtros.
- Los estados de carga, vacío, error, guardado, sin señal y solo lectura deben
  explicar qué pasa y qué se puede hacer. No ocultes un fallo con un estado exitoso
  ni agregues botones sin una acción implementada.
- Comprobá contraste de texto y controles, foco visible y etiquetas accesibles.
  No uses solo el color para transmitir un estado o una comparación. Cualquier
  significado desconocido se consulta en la fuente del dominio, no se deduce del color.
- Densidad compacta significa quitar repetición y ordenar; no comprimir áreas de
  toque ni perder información. Revisá nombres largos y ambas traducciones.

## Revisión antes de entregar

Comprobá que la tarea principal se entiende, los controles se leen y se tocan,
los patrones coinciden con el módulo y no reaparece nada descartado. Recorré los
estados afectados sin quitar avisos de guardado, permisos o falta de datos.
Contrastá el antes y el después y verificá que el cambio visual conserva el flujo,
los resultados y la funcionalidad. Informá límites de la revisión realizada.
