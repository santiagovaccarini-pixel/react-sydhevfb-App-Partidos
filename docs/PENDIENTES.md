# Pendientes

Lo que quedó pedido y todavía no está hecho. El orden es de más a menos valor,
no el orden en que se pidió. Lo que se va haciendo se borra de acá: el historial
de lo hecho está en los commits, no en esta lista.

## Determinante y muy importante

Lo que Santiago marcó así. Cada punto está completo en su sección; acá solo se avisa.

- **GPS: un club con años de historial (14/10).** Con todas las filas al abrir, desde unas 2 o 3
  temporadas la Base se vuelve lenta y en un celular puede cerrarse. Sin decidir qué hacer. Ver
  «GPS (10/10)», «Todas las filas al abrir (14/10)», «Pendiente determinante: años de
  historial».

## Toda la app: presentación, colores suaves y ocultar (15/10)

Santiago, 15/10, al ver el Informe de GPS con los datos del club: «NECESITO QUE HAGAS MUCHO
HINCAPIE EN LA MANERA DE PRESENTAR LAS COSAS Y QUE SE VEAN MEJOR VISUALMENTE Y MAS INTUITIVAS
NO SOLAMENTE PONERLAS Y PUNTO» y «NECESITAMOS UNA MANERA DE EN TODO EL SOFT DE PODER OCULTAR
MANUALMENTE UN COLUMNA Y FILAS SIN NECESIDAD DE ENTRAR A AJUSTES Y OCULTARLAS». Lo que respondió
a la propuesta está en «GPS (10/10)», «La presentación, los colores y ocultar».

- **La presentación**: es una regla para todo lo que se haga. Está en
  [el sistema de diseño](DESIGN_SYSTEM.md), «La presentación (15/10)».
- **Colores suaves en toda la app** («suaviza todos los colores en todos los lugares donde se
  use»): los colores de las franjas y los semáforos son los de los archivos del club, más suaves
  (`COLORES_SUAVES` y `suave()` en `src/domain/colores.js`). Hecho (15/10) en el Informe de GPS,
  la Base de GPS (las celdas y la columna Nombre), los rellenos y degradés de Evaluaciones (la
  Base, lo de arriba y los reportes) y los dibujos de las tarjetas de GPS y Evaluaciones (los que
  se ven si no carga la foto). Quedan como estaban, a propósito: los números de las clases (son
  letra de color sobre gris, UI-014; más suaves no se leerían), el mapa de calor de Lesiones
  (UI-024: es una escala de intensidad, no estos colores), los gráficos de Lesiones y el % vs
  V.R. de partido de Cargar (ya tenía pastillas suaves y una barra fina). Si Santiago los
  quiere también, se ven aparte.
- **Ocultar columnas y filas en toda la app**: tocar el nombre de una columna o de una fila
  pregunta si se oculta; arriba de la tabla, «Columnas» y «Filas» dicen cuántas hay ocultas y
  las vuelven a mostrar; los números no cambian. (En el Informe de GPS, desde el 16/10, solo
  columnas: las filas no se ocultan y «Franjas» oculta y muestra las franjas; ver «GPS (10/10)»,
  «Objetivo, solo con jugadores…».) Hecho en el Informe de GPS y en las bases
  (15/10: GPS, Lesiones, Evaluaciones, Datos básicos y las tablas de Cargar de GPS; cómo, en
  «Bases de Datos (05/10)», Ocultar columnas y filas). **En los reportes y los V.R.** (15/10),
  como en el Informe de GPS, con lo común en `src/components/Ocultar.jsx` (`useOcultar`,
  `TocarParaOcultar`, `OcultasArriba`, `HojasDeOcultar`):
  - Evaluaciones › Reportes: el grupal (una evaluación se oculta tocando su jugador; las filas
    del informe, tocando su rótulo; la comparación con los V.R. va junta con la de abajo) y el
    individual (una fila, con el ojo al lado de su desplegable, porque el nombre ya es el
    desplegable; cada test, con su «Columnas» y «Filas»).
  - Lesiones › Reportes: la tabla del individual (una lesión, tocando su n° de registro, se va
    de las dos tablas; esa columna no se oculta) y el cuadro cada 1000 h (el grupal y «Lesiones
    c/1000h y días perdidos»; los títulos de arriba se ajustan a lo que queda).
  - Valores de referencia de Evaluaciones y de GPS: lo mismo en todas las tablas de la pantalla
    (tienen las mismas columnas y filas); el resumen de Evaluaciones, aparte.
  Las columnas quedan ocultas en ese aparato, por tabla (`reporte_ocultas:<tabla>`); las filas,
  mientras se está en esa pantalla. Siempre queda al menos una columna. Lo oculto tampoco sale
  al imprimir, y «Columnas» y «Filas» no se imprimen. Las cuentas, los promedios y los colores
  se calculan con todo, como antes. Queda prohibido ocultar sin preguntar.
- **El estilo de tabla del Informe en las demás tablas**: «Despues lo vemos». No hacerlo hasta
  que Santiago lo pida.

## El espacio en toda la web (16/10)

Santiago, 16/10: «no esta sobrando muchisimo espacio en todas las cosas que fuimos agregando …
me gustaria que dejemos esta correccion como un estandar para la web»; «es en todas las
pantallas»; «mostrame antes de subirlo a main». Se relevó cada pantalla en la compu y en el
celular, se le mostró una primera pasada con capturas de antes y después (datos inventados) y
el mismo 16/10 pidió subirla («podes subir los cambio de la reduccion de espacios»). La regla
quedó en [el sistema de diseño](DESIGN_SYSTEM.md), «El espacio (16/10)»; UI-042.

- **Hecho (16/10)**: los encabezados con escudo de GPS, Lesiones, Evaluaciones y Datos básicos,
  y los de Partido y Flujo diario, más bajos; los menús (Ajustes, Ver informes, Cabeceras,
  Listas) en columnas en la compu; botones, campos, avisos y «Pegar desde una planilla» del ancho
  de su contenido en la compu (en el celular, como antes); las comparaciones de la Base de GPS
  en franjas; el portal y Bases de Datos con más tarjetas por fila y la foto más baja en el
  celular; Cuentas, Clubes de la app y Notas con los botones a la derecha. No cambió ningún
  dato, texto, cálculo ni función.
- **Falta** (se deja para después, como el resto de lo pendiente): pasar la regla al resto de
  las pantallas. Lo relevado y no hecho: Partido (la cancha más alta que la pantalla en la
  compu, «Ajustar horarios y eventos» con Inicio y Final en una fila, el marcador y «Penales»),
  Elegir club y las pantallas de acceso, Datos básicos › Posiciones y Catapult, GPS › Cargar (el
  panel «% vs V.R. de partido» y los que no entrenaron) y los controles del Informe en el
  celular, Evaluaciones (el «nº» de arriba de la Base, el paso 1 de la carga), la cabecera de
  los reportes de Lesiones y Evaluaciones, Informes gráficos, Lesiones › Ficha y Nuevos casos
  vacío, Cuentas y Notas (el campo de nueva nota) y la barra lateral de la compu. Antes de sacar
  algo que es contenido (por ejemplo, «Seguir registrando» repetido en Flujo diario o la
  tarjeta «Crear reportes» de Lesiones), se consulta.
- **Errores encontrados al relevar** (arreglados el 16/10; Santiago eligió «Los 4 errores
  encontrados» en el cuestionario de qué seguir): GPS › Cargar › «La sesión» se corría de
  costado a 390 px (ahora la caja de lo elegido no pasa el ancho de la pantalla y lo largo
  termina en «…»); en Partido › Editar registro › Formación los convocados quedaban en una sola
  columna (la clase `grid-plantel` no tenía estilo: ahora usa `grilla-plantel`, como al cargar
  la formación); al entrar a un módulo desde el portal o a una base desde Bases de Datos la
  pantalla no volvía arriba (ahora arranca arriba); el aviso «OpenField no responde» tapaba
  «Módulos» en el celular (ahora ocupa su lugar arriba y corre lo de abajo). No cambió ningún
  dato, texto, cálculo ni función.
- **Sin revisar todavía**: de 721 a 1100 px (tablet) y con zoom, la impresión de los reportes,
  los estados de error y sin señal, y solo lectura en Partido, Tareas, Cuentas y Notas.

## Entrenamiento (OpenField)

### Entre celulares (23/10, pendiente para la nota de Flujo diario)

- Dos celulares en el mismo entrenamiento se pisan (se guarda entero y queda el del último), y
  cada celular recuerda solo lo que envió él a OpenField. Santiago eligió resolverlo en la nota
  «Flujo diario, revisar su lógica y moverlo a GPS» («Dejarlo para esa nota»); ahí se pregunta
  cómo se juntan y el aviso antes de repetir un envío. Ver «Entrenamiento, para la nota de Flujo
  diario» en «cargar sin señal y a la vez que otra persona».

### Interfaz (hecha el 21/09; queda lo fino)

- Entrenamiento ya tiene la cara de Partido: inicio con la sesión elegida,
  Tareas con tarjetas plegables y una pantalla aparte para enviar, Ajustes con
  opciones (Usuario y contraseña, Pruebas técnicas, Cambiar de módulo, Cerrar
  sesión) y textos sin jerga ("chaleco", "bloque"). La lista de jugadores y sus
  chalecos pasaron a Datos básicos (02/10).
- **Pendiente de mirar en un celular real**: la altura de los campos de hora
  con AM/PM (en la prueba de escritorio se ven apretados), y el aviso de
  "sin señal" en la cancha.
- **Pruebas técnicas** conserva los textos técnicos a propósito: son para
  mandar por chat cuando algo falla.

### Qué falta probar (sobre 26-05 T, desde el celular)

1. Enviar las dos tareas de prueba con "Todos": tilde en las dos, verlas en
   Sesión → Actualizar y en el editor. (En curso al cierre del 21/09.)
2. Corregir una tarea ya enviada (cambiar el fin un minuto): queda "Con
   cambios", se envía, y en el editor el mismo período se actualiza, sin
   duplicarse.
3. Un jugador con "Menos tiempo": en el editor aparecen dos períodos con el
   mismo nombre, uno con la ventana de ese jugador.
4. Borrar una tarea en la app y enviar: el período se retira de OpenField y el
   resto queda igual.
5. Pausas con los botones: segundos por pausa, total y tiempo efectivo. No van a
   OpenField; quedan en el celular.
6. Una sesión de verdad, o un ensayo: registrar en vivo con "Ahora" y enviar al
   final.
7. Otra persona desde otro celular: su cuenta de Catapult en Ajustes, jugadores
   ya vinculados, envío. Ahí se ve la limitación de "un celular por sesión".
8. Sin señal: cargar tareas funciona; enviar tiene que avisar de forma legible.
9. Que Partido siga igual: marco compartido y lista de jugadores.

### Repaso pantalla por pantalla (empezado el 22/09)

- Se recorren las pantallas en orden: portal, acceso, inicio, sesión de
  OpenField, tablero de tareas, hojas y ajustar, enviar, ajustes, y al final
  el tutorial. Cada una se cierra antes de pasar a la siguiente.
- **Portal (hecho)**: el módulo pasa a llamarse **Flujo diario** (representa
  todo el día: tareas y cortes en la nube, descarga de datos, planilla, PSE y
  archivos para cargar; hoy la app hace tareas y cortes). Tarjetas con fondo
  con las fotos que mandó Santi (`public/portal/*.webp`, también sin señal),
  íconos nuevos y descripciones en criollo. Si una foto no carga, va el
  dibujo en código de `src/components/PortalArt.jsx`.
- **Portada de entrada (hecho)**: al tocar una tarjeta, su foto crece desde
  la tarjeta hasta tapar la pantalla entera (se agranda entera, como un zoom;
  lo que no entra queda afuera), se queda un momento con el ícono y el nombre
  del módulo y se desvanece sobre el módulo, que ya se cargó abajo (`Portada`
  y `lugarEnPantalla` en `src/components/PortalTarjetas.jsx`, compartidas con
  Bases de Datos; tiempos en `TIEMPOS_PORTADA`,
  unos 2,4 s en total). En el celular, parado, la portada usa la versión
  vertical de cada foto (`public/portal/*-parada.webp`, `fotoParada` en cada
  tarjeta, también sin señal): el zoom arranca desde la foto de la tarjeta y
  en el camino se funde con la vertical, que tapa la pantalla casi entera.
  Apaisado (computadora) va la foto de la tarjeta, recortada apenas según el
  `foco`.
- **Acceso (hecho)**: la puerta de Flujo diario con la misma pinta que el
  portal: la foto del módulo borrosa de fondo, la nube dorada, tarjeta oscura,
  botón principal blanco, "Olvidé mi contraseña" y "Crear una cuenta" como
  enlaces dorados y "Volver al portal" arriba. Textos en criollo ("Entrá con
  tu cuenta", "Tu correo y tu contraseña de la app") y una ruedita mientras
  se comprueba el acceso. La lógica (Supabase Auth + `/api/openfield/session`)
  no cambió; ahora tiene pruebas (`src/TrainingAccessGate.smoke.test.jsx`).
  Partido entra sin su intro del estadio cuando viene del portal (`intro`
  en `App`), para no mostrar dos imágenes seguidas; la intro sigue en el
  código por si la app se abre sola.

### Entrenamiento por fecha y guardado en la base (hecho el 22/09)

- El entrenamiento se empieza por fecha desde Inicio ("Ir a Entrenamiento"),
  sin depender de OpenField. La sesión de OpenField se elige recién al enviar
  (o desde Inicio), y queda recordada. Cambiarla deja las tareas como sin
  enviar.
- Cada cambio se guarda en el celular al toque y en la base un momento
  después (tabla `entrenamientos`); sin señal queda pendiente y sube solo. La
  lista de Inicio mezcla lo del celular con lo de la base; abrir uno de la
  base lo trae entero. Entre dos aparatos gana el último que guardó.
- **Hay que correr la migración** `supabase/migrations/20260922_entrenamientos.sql`
  en Supabase › SQL Editor (y `20260922_revisar_entrenamientos.sql` para
  comprobar). Hasta entonces la app funciona solo con el celular y avisa
  "No se pudo guardar en la base".
- Lo registrado con el formato anterior (por sesión de OpenField) se migra
  solo al abrir la app, con esa sesión ya vinculada.

### Tareas como un partido (hecho el 22/09; queda probarlo en la cancha)

- Tareas ya se registra como los tiempos de un partido: una solapa por tarea
  (se deslizan cuando son muchas, el + fijo a la derecha), el reloj de la
  tarea arriba con el tiempo efectivo, la tarjeta de pausas debajo (muestra
  solo la última; "Ver anteriores" despliega el resto) y el panel con Iniciar
  / Terminar tarea, Jugadores (hoja desde abajo), Pausa y Entra / Sale.
  Enviar está arriba a la derecha; con algo incompleto abre "Ver todas" y dice
  qué falta. En la computadora la lista de tareas va al lado del panel.
- Lo que se corrige a mano (horas, pausas, menos tiempo, fecha, borrar) quedó
  plegado en "Ajustar horarios y pausas".
- **Probar en 26-05 T desde el celular**: registrar dos tareas con los botones,
  una pausa, un Entra / Sale, y enviar. Mirar que el reloj no se trabe con la
  pantalla apagada (el tiempo sale de la hora, no de un contador, así que
  tendría que volver bien).

### Pendientes de producto

- **Modo tutorial la primera vez** en cada módulo (propuesta del 22/09, maqueta
  mandada por chat): hoja de bienvenida con "Ver cómo funciona" / "Ahora no",
  después pasos que oscurecen la pantalla y señalan el botón a tocar. Una vez
  por módulo y por celular; se salta; se vuelve a ver desde Ajustes. Vale para
  Partido y para Entrenamiento, cada uno con sus pasos.
  Santiago, 14/10: «tmb pensa que despues tenemos que hacer un modo tutorial, pero eso queda
  mas para adelante»: vale para todos los módulos y va después de los textos que guían
  (`DESIGN_SYSTEM.md`, «Textos que guían (14/10)»). La guía «Cómo se usa» de cada módulo y su
  oferta la primera vez ya existen desde el 14/10 (GPS primero): el tutorial se va a apoyar en
  ellas, no las reemplaza sin que Santiago lo decida.
- **Cuentas: probar el circuito completo con una segunda cuenta** (registrarla
  desde la app, pedir acceso a un club, verla en Pedidos de acceso de ese club,
  aceptarla con un solo módulo, entrar con ella y confirmar que ve solo ese
  módulo; después darla de baja). Ver «Cuentas paso 2» más abajo. Lo que hay
  que tener configurado en Supabase está en el README.
- **Candado a 26-05 T** mientras dure la prueba. Opcional, a decisión.
- **Detectar pausas desde los datos GPS** ("Orión"), más adelante.

### Lo que aprendimos de OpenField (comprobado, no suposiciones)

- El batch del servicio interno **reemplaza todos los períodos** de la
  actividad. La app siempre manda el set completo y preserva los ajenos.
- OpenField toma como **fin de la actividad el fin de su último período**. Un
  corte fuera de ese rango vuelve con 422. Si las curvas llegan más lejos, un
  período creado en el editor hasta el final real extiende el rango (21/09:
  de 16:19:32 a 16:39:01).
- Un período **solo admite atletas con datos en la actividad**; con otros,
  422. Los participantes van con `athlete_id`.
- Los horarios se convierten **en el celular** (hora local) a instantes
  absolutos. El servidor corre en UTC y no convierte nada.
- La Connect API oficial **solo lee**; escribir es únicamente con el pase del
  editor, con la cuenta de Catapult de cada persona.

## El nombre de la web: ARK (10/10)

- Santiago, 10/10: «cambiar el nombre de la web a ARK, la idea seria que si se manda un
  link no salga react/app etc que sea ARK y en la web tmb»; «La imagen esta bien, lo que
  importa son los textos». Hecho: la pestaña del navegador, lo que se ve al mandar el
  enlace (título y descripción, `index.html`), el nombre al instalarla en el celular
  (`public/manifest.json`), la pantalla de entrada y el mensaje de invitación dicen ARK. El
  ícono no cambia. En Partido, la barra lateral dice «Partido» (el nombre del módulo, como
  en el portal y como Lesiones o Evaluaciones en las suyas); antes decía «Registro
  Partido». Lo interno que no se ve (el nombre del paquete y el de la caché) queda igual.
- **Pendiente: la dirección.** El enlace sigue siendo
  `react-sydhevfb-app-partidos.vercel.app`: se cambia en Vercel (Settings › Domains), no
  en el código. Al cambiarla: sumar la nueva en Supabase › Authentication › URL
  Configuration (Site URL y Redirect URLs, sin borrar la vieja hasta que nadie la use);
  lo guardado en cada celular (sin señal, la cuenta guardada) es de cada dirección, así
  que la vieja tiene que seguir andando hasta que todo esté sincronizado, y quien la
  instaló en el celular la vuelve a instalar desde la nueva.

## De la lista de mejoras de la app

- **Mandar los cortes solos a OpenField.** No es un botón de copiar: la idea es
  que los cortes del partido se escriban en OpenField sin retipear nada, igual
  que lo que se está armando en Entrenamiento. Se trabaja en otro lado (18/09);
  acá queda anotado para no duplicarlo. Falta definir qué es un período —los
  cortes del partido, cada jugador con sus minutos, o las dos cosas— porque eso
  decide el traductor de partido a períodos.

- **Guardar el partido en curso en la base.** Hoy lo que se está cargando vive
  solo en ese teléfono: si se muere la batería a mitad de partido, se pierde, y
  no se puede seguir desde otro aparato.

- **Chicos.** Avisar antes de pisar un partido que ya existe con la misma fecha y
  rival; deshacer el último corte; y "Borrar historial", que hoy está a dos
  toques de distancia sin mucha barrera.

## Anotadas para más adelante

- **Partir la descarga de la app.** Hoy Partido y Entrenamiento vienen en un
  solo paquete: abrir la app para un partido se baja también todo el módulo de
  Entrenamiento. Medido el 18/09 con `React.lazy` en `PortalApp.jsx`: son 14 kB
  comprimidos, un 8%, así que hoy no se justifica. Conviene hacerlo cuando
  Entrenamiento crezca, o si la app empieza a tardar en abrir. Son unas diez
  líneas y no se vuelve más difícil por esperar. De paso aísla las fallas: hoy
  un error de Entrenamiento se lleva puesta la pantalla de partido.

## Idioma, Lesiones y Datos básicos (01/10 y 02/10)

- La app tiene diccionario propio en `src/idioma/` (es-AR y pt-BR). Está traducido lo que
  rodea a los módulos: puerta de acceso, portal, Cuentas, barra de navegación, OpenField,
  Lesiones y Datos básicos enteros. **Flujo diario sigue en castellano y Partido, en casi todo**,
  aunque se elija portugués: funcionan igual, solo falta pasar sus textos al diccionario (mucho
  texto; va de a pantallas). De Partido ya están en el diccionario (05/10 al 07/10): la pantalla
  Ajustes › Equipo entera, las hojas que preguntan antes de reanudar un período o de tirar un
  registro o una formación sin guardar, y los avisos de celular sin lugar. Lo demás de Partido
  (incluida la lista de Ajustes) sigue en castellano. Regla: texto nuevo = clave nueva en los
  dos archivos (la prueba lo exige).
- Lesiones tiene las columnas del Excel original (`src/domain/lesionesCampos.js`, más la
  posición del jugador): fechas en columnas, el resto en `datos` (jsonb) con el código de cada
  opción; cabeceras y listas por club en `lesiones_campos` y `lesiones_opciones`, editables
  desde Ajustes en el idioma que se esté usando (la app las siembra con el Excel la primera
  vez). Revisado el Excel entero (02/10): se cargan a mano 21 columnas y el resto se calcula
  igual que ahí (`calcular` en `src/domain/lesiones.js`: n° de registro = enésima lesión del
  jugador, edad, lado hábil, Recup 1/2, recuperación, severidad por días con alta, recorrência
  a 60 días, recidiva por estructura exacta a 30 días, diagnóstico armado). La vista
  `v_lesiones_excel_v1` calcula lo mismo para Power Query (migración
  `20261002b_datos_basicos.sql`, corrida en Supabase el 02/10: también agrega
  `jugadores.posicion` y `jugadores.foto_url`).
- **Los grupos del Excel (02/10)**: la fila de arriba de las cabeceras (Datos generales,
  Descripción general, Descripción específica, Descripción contextual, Evolución y
  continuación, Diagnóstico, Observaciones) ordena todo: la carga va de a un paso por grupo
  con solo lo manual (Diagnóstico es todo calculado y no es paso; lo calculado ya no aparece
  al final del formulario), la Base y el historial muestran la fila de grupos arriba de las
  cabeceras, y la ficha tiene una pestaña por grupo. El nombre de cada grupo se cambia en
  Ajustes › Cabeceras (se guarda como `grupo:<clave>` en `lesiones_campos`).
- La pantalla **Base** estilo Excel (`src/components/TablaDatos.jsx`): cabeceras que se
  arrastran (en el celular, manteniendo apretado), celdas que se eligen, se copian y se pegan
  como texto con tabulaciones y se editan tocando dos veces. El orden de columnas queda en el
  celular. Cada cabecera tiene su filtro como en Excel (valores con su cantidad, buscador,
  Todos/Ninguno, ordenar de menor a mayor o al revés) y "Quitar filtros" vuelve a todo. Vale
  igual en Datos básicos.
- **La ficha de una lesión (02/10)** es como la de Partido: arriba el resumen (diagnóstico y
  días de baja) y abajo una pestaña por grupo; se mira uno a la vez. La pestaña Cambios
  muestra solo los últimos 5 (quién, cuándo y qué columnas tocó cada edición). "Editar" abre
  la carga en el paso del grupo que se estaba mirando.
- **El historial es de un jugador (02/10)**: se busca por el nombre y queda su base (la misma
  tabla, con sus lesiones nada más). Elegido, el buscador se retrae como el de equipo en
  Partido; en la carga de una lesión, el jugador elegido también.
- **Datos básicos** (`src/DatosBasicos.jsx`) es un módulo más del portal, para cualquiera con
  algún módulo: los jugadores del club (los mismos de Partido y Flujo diario) con nombre,
  categoría, nacimiento, edad, pie dominante, posición y foto, en la misma tabla.
  Su tarjeta del portal tiene foto desde el 13/10 (`public/portal/datos.webp` y
  `datos-parada.webp`, la lista del plantel en dorado que mandó Santiago: «Datos basicos»; con
  jugadores inventados, sin nombres reales); el dibujo queda por si no cargan.
  **Es el único lugar con la lista de jugadores (02/10)**: Partido ya no tiene Ajustes ›
  Jugadores ni Flujo diario Ajustes › Lista de jugadores. Lo que estaba ahí se mudó igual:
  la solapa **Posiciones** (los puestos y roles de Partido, `src/components/PosicionesPartido.jsx`)
  y la solapa **Catapult** (el chaleco de cada jugador, `src/components/VinculosCatapult.jsx`;
  solo para quien tiene Flujo diario, porque busca los chalecos con esa cuenta). Desde el
  17/10, Catapult está adentro de Datos básicos › Ajustes y Posiciones sigue como solapa (ver
  «Datos básicos › Ajustes» en «Lo anotado en Notas, tercera tanda (17/10)»).
- **Actual (03/10)**, en Datos básicos: quedan todos los jugadores que pasaron por el club, y
  la casilla "Actual" (al lado del nombre) marca los del plantel de hoy; se marca y desmarca
  con un toque y se guarda al toque (`jugadores.actual`, migración
  `20261011_jugadores_actual.sql`; los que ya estaban quedan marcados, los nuevos entran
  marcados). Un jugador que se fue no se borra: se desmarca. La regla en toda la app: **se
  carga siempre a todos** (los partidos guardan nombres; Flujo diario y Lesiones, ids: un ex
  jugador tiene que seguir apareciendo en lo suyo) y "Actual" solo decide a quién se ofrece
  para elegir (`esActual`, `plantelParaElegir`, `actualesPrimero` en `src/domain/plantel.js`):
  - Partido: la cancha y los desplegables, solo el plantel actual; al editar un partido
    viejo, también los que jugaron ese partido.
  - Flujo diario: para una tarea, solo el plantel actual, más los que ya están en alguna
    tarea de la sesión (una sesión vieja no los pierde).
  - Lesiones (lesión nueva, Historial individual, reporte individual), Posiciones, Catapult y los
    importadores: el plantel actual primero; los que se fueron, abajo y marcados "Ya no
    está" (en el Historial individual y el reporte, solo si tienen lesiones). A quien se fue no se le
    propone chaleco.
  - Reportes del plantel y la Base: todos (sus lesiones son historia del club).
  - La tabla de Datos básicos: los que se fueron, al final, también al ordenar por una columna
    (17/10; ver «Lo anotado en Notas, tercera tanda (17/10)»).
  Mientras no se corra el SQL, todos cuentan como actuales y marcar la casilla avisa qué SQL
  falta. Con lesiones cargadas, borrar no se puede: se avisa que se desmarque Actual.
- **Pegar desde Excel (02/10)**, en Datos básicos (`src/ImportarJugadores.jsx` y
  `src/domain/importarJugadores.js`): se copia la hoja "Datos Básicos" del Excel con su fila
  de cabeceras y se pega. Antes de guardar se ve qué pasa con cada fila: jugador nuevo, ya
  está en la app (y qué le cambia) o no se carga; quién es cada uno se corrige a mano (el
  mismo nombre se reconoce sin importar acentos ni mayúsculas, y se sugiere uno parecido
  cuando el nombre de la app está entero adentro del otro, como "SCARPA" en "Gustavo
  Scarpa"). Lo que el Excel trae vacío no borra nada; lo que no se entiende queda avisado.
  Probado en local con la hoja real: entran los 38 jugadores con todas sus columnas. Los
  datos no pasan por el repositorio ni por el chat: la carga la hace alguien del club desde
  la app.
- Del Excel quedan para más adelante: BD GPS (los minutos para las cuentas cada 1000
  horas de los reportes; falta decidir cómo llegan) y la evaluación de lesiones (ROM y
  valores de referencia). (10/10: el GPS ya es una base de la app, ver «GPS (10/10)»; falta
  conectar sus minutos a estas cuentas.) El bloque
  "Plan Agudo" del Excel está marcado "no usar" y no se trajo.
- Lo que se suma al catálogo (`lesionesCampos.js`) llega solo a los clubes ya sembrados:
  `leerConfig` completa las cabeceras y opciones que falten sin pisar lo que el club cambió.
- La hoja de opciones (`HojaOpciones`) se desplaza y, con más de ocho opciones, tiene un
  buscador que acerca lo escrito.
- Regla de oro del 01/10: lo que es igual en otro módulo tiene que ser igual en toda la web
  (escudos descargados con `EscudoDeClub`, el filtro de Registros, fichas con "Ver detalle",
  Ajustes con filas y "Volver a Ajustes").
- **Regla de los desplegables** (UI-027). Santiago, 01/10: «los nombres tiene que ser un
  desplegable, no todos tirados así nomás al igual que el resto de opciones»; lo recordó el
  12/10: «pusimos como regla del proyecto dejar de usar todas las opciones disponibles y solo
  poner desplegables». Toda lista de opciones se elige en un desplegable: el botón que abre la
  hoja de opciones (`HojaOpciones`) o un `select`; para elegir varios, el desplegable abre la
  lista con casillas del filtro de las bases (`ListaParaMarcar`). Queda prohibido poner todas
  las opciones a la vista como botones, también en listas cortas. Lo cumplen GPS › Cargar y
  Ajustes › Reglas de carga (12/10). **Todavía muestran opciones como botones** (anotado el
  12/10; falta que Santiago confirme si se pasan todos juntos, en un cambio aparte): ~~los
  formularios de Lesiones (Nuevos casos)~~ (hecho el 15/10, con la carga sin figura) y el de
  Evaluaciones (Cargar), que pone en botones las listas de hasta 6 opciones; Mostrar / Oculta en
  Ajustes de Lesiones, Evaluaciones y GPS; el tipo de una columna nueva del GPS; los períodos de
  Lesiones › Reportes y de Lesiones c/1000 h; ~~Frente / Espalda y las capas del mapa
  corporal~~ (la figura de la carga se sacó el 15/10); y el orden en el filtro de cada columna de
  las bases.
- Después de entrar, lo primero es elegir el club (`src/ElegirClub.jsx`); desde el portal se
  cambia con "Cambiar". Solo se ven los clubes en los que se está o se estuvo.
- **Clubes con fecha de salida (02/10, migración `20261003_club_miembros.sql`, corrida el
  02/10)**: la tabla `club_miembros` dice quién está en cada club y hasta cuándo. Quien se
  fue sigue viendo lo cargado hasta su último día (partidos, entrenamientos, lesiones y los
  jugadores que ya estaban) y no puede agregar ni cambiar nada: lo decide la base con las
  políticas (`acceso_club`, `puede_ver_fecha`, `puede_editar`), así que vale también para
  Power Query. La app lo muestra (aviso en cada módulo, botones de carga escondidos, tabla
  sin edición) leyendo `v_mis_clubes`. El administrador lo maneja desde Cuentas (invitar,
  aceptar pedidos, dar de baja con el último día, reincorporar). Desde el paso 2 de cuentas
  (06/10), quien crea un club (un dueño, desde Clubes de la app) no queda adentro. La
  migración de ese día dejó las cuentas autorizadas de entonces en todos los clubes. Límite conocido: un cambio hecho después
  de la salida sobre una lesión anterior (el alta, por ejemplo) se ve igual, porque la fila es
  de antes.
- El idioma se cambia desde el globo arriba a la derecha (puerta, portal, Cuentas, Lesiones y
  Datos básicos). Partido y Flujo diario no lo muestran todavía porque siguen en castellano
  (Partido, en casi todo: ver arriba qué ya está traducido).
- Los módulos (Partido, Flujo diario, Lesiones, Evaluaciones) los da el administrador de cada
  club desde Cuentas; los de `perfiles` ya no cuentan.

## Protocolo de lesiones: ninguna regla escrita en código (regla del 02/10)

Regla de Santiago: **ninguna regla del protocolo tiene que quedar escrita en
código**. Más adelante todo tiene que poder cambiarse desde la app, porque hay
gente que trabaja con otro protocolo. Las cabeceras y las listas ya se cambian
desde Ajustes; lo de abajo todavía está fijo en `src/domain/lesiones.js` (y
repetido en la vista `v_lesiones_excel_v1` para Power Query) y es lo que falta
mover a una configuración por club:

- Ventanas: recurrencia hasta 60 días y recidiva hasta 30, contados desde el fin
  de la lesión anterior (alta, o hoy si sigue abierta) hasta el inicio de la nueva.
- Qué tiene que coincidir: recurrencia = parte + lado + músculo; recidiva = eso
  más área y músculo específico.
- Escala de severidad por días de recuperación: registro (menos de 1), leve (1 a
  4), menor (5 a 7), moderado (8 a 28), mayor (29 o más); solo con alta.
- Las horas de entrenamiento (desde el 11/10, en `20261018_minutos_lesiones.sql`): qué
  columnas del GPS son minutos (Minutos Campo + Minutos Fuerza Metabólico) y cómo se reconoce
  una fila de la selección (la Descripción dice «Selección»).
- Cómo se arma el diagnóstico: tipo + ligamento (o músculo específico) + músculo
  (o parte) + área + lado.
- Lado hábil = el lado lesionado es el pie dominante. Edad = años cumplidos a la
  fecha de la lesión (en Datos básicos, a hoy). N° de registro = enésima lesión
  del jugador, por n° de caso.
- Recup 1 = transición − inicio; Recup 2 = retorno al entrenamiento − inicio;
  recuperación = alta (o hoy) − inicio. Las etapas (lesionado, transición,
  entrenando, alta) salen de esas fechas; "activa" = sin alta. Desde el 18/10
  esas fechas pueden ser previstas (futuras): la etapa la da la última fecha
  cargada, apenas se carga; los días y los reportes cuentan cada una recién
  cuando llega (hasta entonces, hasta hoy), y "activa" sigue siendo sin alta
  cargada.
- Reportes (`REGLAS_INCIDENCIA` en `src/domain/reportes.js`, copiadas de las fórmulas del
  Excel): el cuadro cada 1000 horas cuenta las lesiones no traumáticas (Datos Básicos P8)
  de partidos oficiales, amistosos y entrenamientos (R7:R9) del profesional (S7); "sin
  leves" saca solo la severidad leve (T8: las de registro quedan); LM son los grados 1A a
  3C y la sobrecarga muscular / calambre. La regla vale también para las LM: una LM
  traumática o de selección no entra (05/10: Santiago pidió dejarlo como el Excel y "solo
  aclarar cuáles van"). La nota de cada cuadro dice cuáles cuentan y cuáles son las LM, con
  los textos del club (en el reporte individual, en corto desde el 14/10: la lista de las LM se
  abre con «Ver cuáles»; ver «Lo anotado en Notas, segunda tanda (13/10)»). Con los datos del Excel la app da lo mismo que "Incidencias c 1000h" fila 109;
  ojo que en el Excel los títulos de la fila 108 están cruzados: las columnas que dicen
  "Tipos (Solo LM)" (B, C, H, I, N, O, T, U) tienen todas las lesiones, y las que dicen
  "Tipos (TODAS)", solo las LM.
- Informes gráficos (`REGLAS_GRAFICOS` en `src/domain/reportes.js`, de la hoja "Informes
  Graficos" del Excel): el año de un período guardado es el de su fecha final; en las
  tortas, por jugador y entrenamiento y partidos cuentan las que tienen tipo de lesión
  ("Cuenta de Tipo de lesão"); una torta por producto (no traumática, traumática) con una
  porción por parte del cuerpo; por jugador y por cuándo, apiladas o agrupadas por parte;
  qué filtros tiene cada bloque (las segmentaciones del Excel) y si la parte vacía cuenta
  como "Sin dato".
- La tabla del reporte individual (`TABLA_DEL_INDIVIDUAL` en `src/domain/reportes.js`, pedido
  de Santiago del 05/10): todas las columnas que el club tiene a la vista, en dos tablas una
  debajo de la otra: de Datos generales a Descripción específica arriba, y de Descripción
  contextual a Observaciones abajo (un grupo que no esté en ninguna va a la última). Cada tabla
  arranca con el N° de registro (o el N° de caso, si el registro está escondido), adelante y
  fijo al deslizar, y lleva la fila de los grupos con los mismos tonos que la base. En pantalla entran enteras desde una compu de 1366 px; más chica, se deslizan.
  Impreso (A4 apaisado), la segunda tabla va entera a la hoja siguiente si no entra: un jugador
  con pocas lesiones ocupa dos hojas (antes, con 12 columnas, entraba en una).
- Validaciones: obligatorios jugador, tipo de lesión (pedido del 02/10), parte,
  lado y fecha de inicio; fechas no futuras y posteriores al inicio (también la
  hora de la imagen: no antes del día de la lesión); la misma lesión no se
  carga dos veces: mismo jugador, parte, lado y fecha de inicio (también como
  restricción `lesiones_sin_repetir` en la base, migración 20261008). Una
  recaída durante la recuperación sí se carga (Santiago, 03/10: el Excel la
  tiene así, casos 16 y 17); antes la base no dejaba dos activas en la misma
  parte y lado (`lesiones_sin_solapar`).
- Pegar desde Excel en Lesiones: los valores que en el Excel se escribieron
  fuera de sus listas y a qué opción van (`EQUIVALENCIAS_DEL_EXCEL` en
  `src/domain/importarLesiones.js`; decidido el 03/10: RUPTURA DE TENDÃO y
  TENDINOPATIA → lesión tendinosa, PE → pie/dedo, LACERAÇÃO/ ABRASÃO →
  laceración). Van con las listas del club cuando se muden.
- Qué columna va en qué grupo del Excel (eso arma los pasos de la carga, la fila
  de grupos de la base y las pestañas de la ficha; el nombre de cada grupo ya se
  cambia desde Ajustes); el aviso al cargar (misma parte y lado, 60 días); las
  horas hasta la imagen se cuentan desde el comienzo del día de la lesión (la
  lesión no tiene hora), en la app y en la vista (`lesiones_horas_imagen`,
  migración 20261006); las que se escribían a mano antes quedan guardadas y se
  muestran si no hay hora de la imagen. La imagen se compara con el día de la
  lesión en el paso de Evolución (donde se carga ese día). El formulario pide
  corregir todo al guardar (y lleva al paso donde está lo que falta); una
  celda de la Base solo frena lo que esa edición rompe o empeora.

Plan para moverlo: una tabla `lesiones_protocolo` por club (clave, valor) con
los valores del Excel como semilla, igual que cabeceras y listas; se edita en
Ajustes › Protocolo; `leerConfig` la trae junto con lo demás y `calcular`,
`validarLesion` y el formulario reciben las reglas por contexto en vez de
constantes; la vista lee las mismas reglas con una función
`lesiones_regla(equipo, clave)` para que Power Query y la app coincidan; la
restricción de la base pasa a depender de la regla. Mientras tanto, cada regla
nueva se escribe en un solo lugar y con un nombre, para que mudarla sea corto.

## Lesiones: lo que sigue (anotado el 02/10)

- **La carga sin la figura del cuerpo (15/10).** Santiago, 15/10: «Saca toda la figura de la carga
  de lesiones y solo dejas desplegables y la haces mas intuitiva porfavor». Reemplaza lo de los
  dos puntos que siguen (la figura para cargar y los músculos dibujados), que quedan como
  historia. Ver UI-036.
  - **Descripción general**: «Parte del cuerpo lesionada» y «Lado», cada uno en su desplegable.
    Las partes van de la cabeza a los pies (las que agregó el club, al lado de la parte donde
    van; las que no se sabe dónde van, al final) y debajo de cada una dice lo que tiene (los
    tres primeros grupos musculares, o músculos, y ligamentos de las listas a la vista: «Muslo
    — Cuádriceps, Isquiotibiales, Aductores»). El lado se elige siempre a mano.
  - **Descripción específica**: arriba, la parte y el lado elegidos; abajo, «Músculo afectado»,
    «Músculo específico», «Área» y «Ligamento específico», cada uno en su desplegable y solo con
    lo que va en esa parte (el mismo `mapa` de `src/domain/mapaCorporal.js`). Sin grupo
    elegido, cada músculo dice de qué grupo es; elegido un músculo de un solo grupo, el grupo se
    completa; otro grupo borra el músculo de otro grupo; otra parte borra lo que no va en ella
    (como antes). El área: primero las del músculo entero y después las de cada tercio. Una
    columna sin nada para esa parte no aparece; si no hay ninguna, lo dice. Lo cargado que no
    va en la parte se ve igual, para poder sacarlo.
  - «Ver todas las opciones de las listas» (antes «Elegir de la lista») muestra las listas
    enteras, por si una opción que agregó el club quedó en otra parte; «Ver solo lo que va en
    (la parte)» vuelve.
  - **Todo en desplegables**: las listas cortas de la carga (Lado, Producto, Cuándo,
    Localización), que iban como botones a la vista, también (UI-027).
  - **La ficha** ya no lleva la figura chica al lado del diagnóstico.
  - Se borraron `MapaCorporal.jsx`, `FiguraCuerpo.jsx` y `FiguraAnatomica.jsx` (y sus estilos y
    textos). Siguen `siluetaCuerpo.js`, `anatomiaCuerpo.js` y `manchasCuerpo.js`: los usa el mapa
    de calor de los reportes, que no cambió.
  - No cambió qué se guarda ni cómo: las mismas columnas, los mismos códigos, el diagnóstico,
    la recurrencia y la recidiva.
  - **Queda prohibido** volver a poner la figura del cuerpo (o un dibujo para tocar) en la carga
    de una lesión o en su ficha, y volver a poner opciones como botones a la vista en la carga.
- ~~**El cuerpo humano para cargar la lesión (hecho el 02/10, rehecho el 02/10)**~~ (sacado el
  15/10, ver el punto de arriba): en
  Descripción general, la figura de un cuerpo de verdad, de frente o de espaldas
  (`src/components/siluetaCuerpo.js` dibuja la silueta y la parte en sus partes;
  `src/components/FiguraCuerpo.jsx` la muestra): se toca la zona, la figura se acerca, se
  marcan los bordes de sus partes y se elige la parte (el lado sale de la zona; en cabeza y
  tronco se elige). En Descripción específica, solo las opciones de las listas que van en esa
  parte, de lo grande a lo chico: grupo muscular → músculo específico → área (todas las del
  área, ordenadas por tercio con su título; los títulos no son opciones), o el ligamento. No
  hay "Otro…" ni opciones inventadas; una columna sin nada para esa parte no aparece; lo
  cargado que no está entre los botones se ve prendido para poder sacarlo. "Elegir de la
  lista" sigue llevando a los campos de siempre, con la lista entera. La ficha muestra la
  figura chica con la parte lesionada (de espaldas si el músculo es de atrás).
  En cada parte está lo que está en ella y lo que se inserta o nace ahí (en la rodilla, los
  tendones de los isquiotibiales y el origen de los gemelos; en la cadera, el origen de los
  isquiotibiales y la pared del abdomen que llega al pubis…): `src/domain/mapaCorporal.js`,
  con una prueba que verifica que cada opción del catálogo tenga su lugar y que no haya
  ninguna inventada.
  **Las opciones que agrega un club se ubican solas por su nombre** (en castellano o en
  portugués: "Gemelo interno" va en la rodilla y en la pierna, "Rótula" en la rodilla,
  "Unión miotendinosa distal" en el tercio distal); la que no se reconoce aparece en todas
  las partes, así ninguna queda afuera. En Ajustes › Listas cada opción del cuerpo dice dónde
  va, y al escribir una nueva se ve en el momento. **Queda pendiente**: que el club pueda
  corregir a mano dónde va una opción (y el mapa entero) desde Ajustes, por la regla del 02/10
  de que ninguna regla quede escrita en código; hace falta guardar las partes de cada opción
  en `lesiones_opciones` (una columna nueva, con su migración).
- ~~**Músculos, tendones y ligamentos en la figura (02/10)**~~ (sacado el 15/10, ver «La carga
  sin la figura del cuerpo»): en Descripción específica la
  parte se ve de cerca, de frente y de espaldas, con los músculos (gris azulado), los
  tendones (blanco) y los ligamentos (celeste) dibujados (`src/components/anatomiaCuerpo.js`,
  `src/components/FiguraAnatomica.jsx`); la rodilla, el tobillo (por fuera y por dentro) y la
  planta del pie tienen además su esquema por dentro, con rótulos (LCA, LCP, meniscos,
  ligamentos del tobillo, fascia plantar). Se toca uno y queda elegido abajo, con su grupo;
  tocar uno de otro grupo cambia el grupo; en el tronco se tocan los dos lados y el lado tocado
  queda como el lado de la lesión. Lo que no está en las listas de esa parte se ve oscuro y
  no se toca. Los músculos de debajo de otros (vasto intermedio, aductor corto, glúteo menor,
  piriforme, obturadores, pectoral menor, oblicuo interno) están en "Profundos". Las opciones
  que son combinaciones (por ejemplo, "ligamento lateral externo anterior / medio") y las
  variantes del tendón conjunto se eligen con los botones de abajo. Las que agrega un club
  todavía no tienen dibujo: se eligen con los botones. Los tendones que el catálogo no tiene
  como opción propia (el del bíceps femoral, el del semitendinoso, los del bíceps y el
  tríceps) están dibujados en blanco pero eligen su músculo; la parte del músculo (por
  ejemplo, "Distal – tendón libre") va en el área.
- **Reportes (02/10, rehechos el 03/10)**: solapa "Reportes" en Lesiones
  (`src/ReportesLesiones.jsx`; las cuentas en `src/domain/reportes.js`). Ver reportes tiene
  dos. El **individual** es la hoja "Reporte de Lesiones IND" del Excel con las mismas
  cuentas, solo mejor presentada (pedido de Santiago del 03/10: "las lógicas no se
  cambian"). Desde el 03/10 tiene el diseño que propuso Santiago (dos imágenes de muestra):
  cabecera negra con el escudo (y el escudo grande de marca de agua), el título, el
  jugador, su posición, nacimiento y pie (de Datos básicos) y la foto: a las del club
  (fondo gris liso) se les saca el fondo en el navegador (`src/domain/recorteFoto.js`) y
  el jugador queda parado sobre el negro; si una foto no tiene fondo liso o el sitio no
  deja leerla, va entera en un panel cortado en diagonal; "Lesiones / 1000 h" y "Días perdidos / 1000 h", cuatro tarjetas cada
  una con los nombres de las columnas del Excel ("Severidad (TODAS) y Tipos (TODOS)", "…
  (SIN LEVES) y Tipos (SOLO LM)"; en portugués, los del Excel), con el valor del jugador,
  la referencia (el VR del plantel) y el "jugador vs VR" (superior o inferior a la
  referencia y el porcentaje sobre el valor del jugador, como la fórmula del Excel; rojo
  arriba, verde abajo; **cambiado el 14/10**, ver «Lo anotado en Notas, segunda tanda
  (13/10)»: tarjetas chicas, el % con el color al lado del número, sin los puntos ni su
  leyenda); al lado, el "Mapa corporal de lesiones": la figura de cargar una
  lesión (desde el 15/10 la carga ya no tiene figura; el reporte sigue con estas imágenes),
  de frente y de espaldas, como una escultura gris con relieve (dos imágenes WebP
  en `src/assets/` que arma `scripts/cuerpo-3d/generar.sh` a partir del mismo dibujo del
  cuerpo, con músculos de adorno como el trapecio o los abdominales; si cambia el dibujo
  del cuerpo hay que volver a correrlo), una mancha de calor sobre el músculo,
  tendón o ligamento lesionado si está dibujado (si no, en el medio de la parte; más
  grande cuantas más lesiones) y una línea a su nombre (`src/components/CuerpoConCalor.jsx`
  y `manchasCuerpo.js`; **cambiado el 11/10**, ver «Lo anotado en Notas»: se pinta solo lo
  lesionado y sin nombres); abajo, el historial con doce columnas todas a la vista (en el
  Excel se elegían desde la cabecera por falta de lugar): las del diseño de Santiago, que
  son las del Excel con "Músculo específico" en lugar de "Pase a transición"; menos las
  que el club escondió. Títulos y números en Roboto Condensed (`@fontsource`, solo la
  parte latina). El mapa corporal es el mismo en el grupal (con los seis nombres con más
  lesiones de cada vista). El VR se calcula con toda la base hasta hoy (en el Excel es la fila
  "BASE COMPLETA" de "Incidencias c 1000h", que pega una macro). El **grupal** suma el
  mismo cuadro para el plantel en el período elegido (el contador por período de
  "Antecedentes BD": cuentan las empezadas en el período y los días que caen adentro),
  más los gráficos por mes, zona, tipo, severidad, mecanismo, cuándo, producto y posición.
  Se imprimen o se guardan en PDF (apaisado).
  **Las horas salen del GPS (decisión de Santiago del 03/10)**, como en la hoja "BD GPS"
  del Excel (minutos de cada jugador por día). **Cómo llegan (Santiago, 03/10): "después
  vamos a meter todas las bases dentro de la web y ahí se van a conectar entre sí"**: la base
  del GPS va a estar en la app y los reportes la leen (`gps`: [{ jugadorId, fecha, minutos }];
  en el Excel, minutos = las columnas C + D de "BD GPS", de todos los que aparecen, estén o no
  en el plantel). ~~Mientras tanto los cuadros muestran "—" y avisan que faltan los minutos.~~
  **Conectado el 11/10** (ver «Lo anotado en Notas», tiempos de selección): las columnas C y D
  de "BD GPS" son «Minutos Fuerza Metabólico» y «Minutos Campo» del GPS. Sin minutos (o sin la
  migración `20261018_minutos_lesiones.sql`) los cuadros siguen mostrando "—" con el aviso.
  **Horas previas (03/10, migración `20261007_horas_previas.sql`)**: la columna A de "Datos
  Básicos" del Excel (sin título, en [h]:mm:ss) son las horas de entrenamiento de antes de
  que llegara el cuerpo técnico al Mineiro. Están en Datos básicos ("Horas previas", se
  escriben o se pegan como en el Excel: 30:14:20) y el reporte individual las suma a las
  horas del GPS del jugador (al VR no, como en el Excel). En el Excel la fórmula las suma a
  los minutos sin pasarlas a minutos, así que casi no cuentan (30 horas valen 1 minuto);
  en la app cuentan como horas. Santiago, 03/10: "por ahora dejalo". **Confirmado el 12/10**
  (Santiago, al comparar el reporte individual con el del Excel, eligió «Como horas (como
  hoy)»): siguen contando como horas aunque el Excel dé otro número. No se copia el error del
  Excel (que casi no las cuenta) ni se dejan de sumar, salvo que Santiago lo pida. Para
  comparar los dos reportes: "BD GPS" del Excel tiene que llegar hasta la misma fecha que el
  GPS de la app, y la referencia del Excel es la foto de la última vez que se tocó ATUALIZAR
  VR (la de la app se calcula con todo lo cargado). **Cuentan completas** (Santiago, 12/10:
  «tiene que contar todo, hasta los segundos»): horas, minutos y segundos (36:04:48 son 36 h
  4 min 48 s); no se redondean ni se cortan. Lo prueba `src/ReportesLesiones.test.jsx`.
  **Lo que sigue: Crear reportes**, un lienzo con bloques (número, gráfico, tabla) donde se
  elige la medida, cómo separarla y los filtros, y se guarda por club.
- **Lesiones c/1000h y días perdidos (03/10)**, en Reportes (`src/ReporteCadaMil.jsx`): el
  contador de la derecha de "Antecedentes BD". Se eligen inicio (sin inicio, desde la primera
  lesión), final y un nombre; salen las lesiones y los días perdidos de las cuatro columnas
  (severidad todas o sin leves, tipos todos o solo LM), los minutos y las horas de
  entrenamiento y lo cada 1000 horas (lo de "Incidencias c 1000h"), con las mismas cuentas
  (`contadorDelPeriodo` en `src/domain/reportes.js`: una lesión sin alta cuenta sus días
  desde su inicio aunque sea de antes del período, como la columna CQ). "Base completa" es el
  botón ATUALIZAR VR. El período se guarda con su nombre (en el Excel, las letras A a P) en
  `lesiones_periodos` (migración `20261009_lesiones_periodos.sql`): solo nombre y fechas, los
  números se calculan cada vez (Santiago, 03/10); el nombre no se repite en el club, sin
  límite de 16. Lo ve quien usa Lesiones (también quien ya se fue); lo cambia quien puede
  editar. Los períodos guardados son los que comparan los Informes gráficos.
- **Informes gráficos (03/10)**, en Reportes (`src/ReporteGraficos.jsx`, los gráficos en
  `src/components/GraficosReporte.jsx`): la hoja "Informes Graficos" del Excel, los reportes
  del plantel que no son de un jugador, en cinco bloques con un atajo a cada uno arriba:
  1. N° de lesiones c/1000 h y 2. N° de días perdidos c/1000 h: una columna por período
     guardado (en el orden de las fechas) en los cuatro gráficos del Excel (severidad todas
     o sin leves, tipos todos o solo LM), con el filtro del año de cada bloque. Sin los
     minutos del GPS (todavía no están en la app) no hay columnas: dice "—", cuántas
     lesiones o días tiene cada período y el aviso. Sin períodos guardados, lleva a
     guardarlos.
  3. Partes del cuerpo: una torta de no traumáticas y otra de traumáticas, con los filtros
     del Excel (parte, músculo, músculo específico, ligamento, área, lado, tipo y posición).
  4. Lesiones por jugador, apiladas por parte del cuerpo (también quien no está en Datos
     básicos; todos, actuales o no), con filtro de jugador, tipo y producto.
  5. Entrenamiento y partidos: cuándo, por parte del cuerpo, del año (el de hoy si tiene
     lesiones), con filtro de cuándo y parte.
  Las sin fecha nunca cuentan. Cada parte tiene siempre el mismo color (en todos los
  gráficos, en los dos idiomas y aunque aparezca una parte nueva; ninguna repite). Las
  columnas comparten la base y la escala. Se imprime con un bloque por hoja (los 16
  períodos del Excel entran en cada gráfico; el de jugadores se corta entre jugadores).
  **Filtros (Santiago, 11/10, reemplaza los de arriba de cada bloque):** cada gráfico (cada
  torta por separado) tiene un embudo arriba a la derecha. Abre las cabeceras de ese
  gráfico, con un buscador: el año y todas las columnas de la Base de Lesiones que el club
  tiene a la vista; en los c/1000 h, sin las de la persona (nombre, categoría, fecha de
  nacimiento, pie dominante, posición, edad), porque las horas son de todo el plantel. Cada
  cabecera abre la lista para marcar varios valores, con cuántas lesiones del gráfico tiene
  cada uno (la misma hoja que el filtro de las columnas de la Base). Las listas se filtran por
  lo cargado; el jugador, por quién es; la posición, por la del plantel; lo demás, por lo que
  dice la celda de la Base. El año es el del período en los c/1000 h y el de la fecha de
  inicio en los demás; Entrenamiento y partidos arranca con el año de antes (el de hoy si
  tiene lesiones; si no, el último) y su título lo dice. Debajo del título de cada gráfico va
  lo filtrado (también impreso). Ya no están los botones de filtros ni de años de arriba
  (`REGLAS_GRAFICOS.filtros` se sacó). **Queda prohibido** volver a poner filtros compartidos
  arriba de un bloque.
  **Diferencias con el Excel** (para decidir si hace
  falta): los filtros eligen uno o todos (en el Excel, varios); bloque 4 en barras
  horizontales (se leen los nombres en el celular); las tortas con la leyenda al lado en
  vez del nombre sobre la porción; "Base completa", si se guardó como período, también se
  grafica (en el Excel nunca); el Excel imprimía solo los bloques 1 y 2.
- **Pegar desde Excel en Lesiones (03/10)**, en Base (`src/ImportarLesiones.jsx` y
  `src/domain/importarLesiones.js`): se copia la hoja "Antecedentes BD" desde la fila de
  cabeceras hasta la última lesión y se pega. Antes de cargar se ve qué pasa con cada fila:
  se carga, ya está en la app (la misma persona con el mismo N° de caso y sin otra fecha de
  inicio, o mismo jugador, parte, lado y fecha de inicio), o qué le impide cargarse (un N° de caso que en la app es de
  otra lesión, o lo mismo que frena la carga a mano). **Entran todas (Santiago, 03/10)**:
  - Las que no tienen fecha de inicio (casos sin terminar del Excel) se cargan y quedan
    "sin fecha de inicio": no cuentan como activas, ni en días perdidos, ni en recurrencias,
    ni en los reportes hasta completar la fecha (en Lesionados hay una lista para
    completarlas). A esas no se les pide tipo, parte ni lado; a las que tienen fecha, sí.
    Una fecha de inicio escrita que no se entiende no es un caso sin terminar: esa fila no
    se carga (se ve qué fecha no se entendió). Una fila con datos y sin nombre se ve y no se
    carga; las de abajo con solo el N° de caso no se leen.
  - Un nombre que no está en Datos básicos: se elige si se guarda con ese nombre (sin
    agregarlo a Datos básicos), si es un jugador de la lista o si no se carga ("Guardar
    igual" las elige todas; las que se parecen a dos jugadores se eligen una por una). En la
    base, la lesión queda con `persona` (el nombre) y sin `jugador_id` (migración
    `20261010_lesiones_sin_fecha_y_personas.sql`). Se ve en Lesionados, la Base, el
    Historial individual y la vista para Power Query, y cuenta en los reportes del plantel (como en el
    Excel) cada persona por su lado; el reporte individual es solo de Datos básicos. El
    mismo nombre escrito de otra forma (con o sin acentos, mayúsculas o signos) es la misma
    persona: se guarda como ya está escrito en la app, o como en la primera fila que lo
    trae. Los nombres que quedan sin elegir no se cargan: se avisa antes, y después de
    cargar el resto la pantalla sigue abierta con ellos. Si Datos básicos no se pudo leer de
    la base (se ve la última copia), no se carga nada: todos parecerían de afuera.
    **Falta**: si después se agrega esa persona a Datos básicos, sus lesiones no se pasan
    solas al jugador (al volver a pegar, el importador las reconoce y no las duplica); y de
    una persona de afuera no se guardan sus datos de jugador (categoría, posición,
    nacimiento), así que no entra en lo que se cuenta por posición ni tiene edad.
    Una sin fecha ni N° de caso que después se completó en la app se reconoce al volver a
    pegar si todo lo que trae la fila (también las fechas de transición, retorno y alta)
    está igual en una lesión de esa persona; y si se completó en el Excel, si todo lo que
    tiene la de la app está igual en la fila. Se traen solo las columnas que se cargan a mano; lo
  calculado lo calcula la app (con el Excel de Santiago dan iguales los 24 casos cerrados).
  Cada lesión entra con su N° de caso del Excel (las que no lo traen, después del más alto de
  lo pegado). Las fechas se leen como las copie el Excel de quien copia (día/mes o mes/día,
  decidido con todas las fechas juntas; las escritas como texto en el otro orden también). El
  jugador se busca por el nombre igual y, si no, sin acentos ni signos (si dos se parecen, no
  se adivina). Las listas: primero las opciones del club, después el texto original del
  Excel y al final las equivalencias; un valor que no se entiende deja esa columna vacía y
  avisa. No se traen los
  planes ni los tests (columnas AN en adelante). Antes de pegar hay que correr
  `20261008_lesiones_recaida.sql` y `20261010_lesiones_sin_fecha_y_personas.sql`.
- Para decidir cuando se hagan los informes: ~~la categoría de una lesión hoy se muestra con
  la categoría actual del jugador (el código quería guardar la del día de la lesión, pero esa
  columna no se guarda porque cuenta como calculada)~~ (resuelto el 17/10: cada lesión guarda
  la del día y, al cambiarla en Datos básicos, se pregunta; ver «El cambio de categoría de un
  jugador, en sus lesiones» en «Lo anotado en Notas, tercera tanda (17/10)»); y "Imágenes" se carga como texto libre
  aunque el catálogo tiene la lista del Excel (resonancia, ecografía, radiografía,
  tomografía, sin imagen).

## Bases de Datos (05/10)

- Lesiones, la barra (pedido de Santiago, 05/10): Nuevos casos (lo que antes decía Lesionados:
  las activas y "Nueva lesión"), Base, Historial individual, Reportes y Ajustes. En el celular
  los íconos de la barra quedan a la misma altura aunque un nombre ocupe dos renglones.
- El módulo Lesiones del portal pasó a llamarse **Bases de Datos** (pedido de Santiago, 05/10):
  adentro tiene la cara de la pantalla principal, una tarjeta por base, con la misma portada al
  entrar. Lesiones es la primera; las próximas (GPS, ROM, las que se definan) se suman ahí.
- Dónde: las bases están en un solo lugar, `BASES` en `src/BasesDeDatos.jsx` (cada una con su
  tarjeta, su pantalla y su permiso). Las tarjetas y la portada son las mismas del portal
  (`src/components/PortalTarjetas.jsx`): una base nueva es una entrada más en `BASES`.
- Permiso: cada base tiene el suyo (Lesiones, la columna `lesiones` de la membresía;
  Evaluaciones, la columna `evaluaciones`, desde el 05/10; GPS, la columna `gps`, desde el
  10/10) y la tarjeta Bases de Datos de la
  pantalla principal se ve si la cuenta tiene alguno (`basesHabilitadas` en
  `src/BasesDeDatos.jsx`). Para sumar un permiso hay que tocar juntos (o mejor, sacarlos de una
  sola lista):
  - la base (migración nueva, como `20261012_evaluaciones.sql`): columna en `club_miembros` y en
    `club_invitaciones`; los `case` de `puede_usar_en` y `puede_usar`; `aplicar_invitaciones()`
    (que la invitación la pase a la membresía); `equipos_sumar_creador()` (quien crea el club la
    tiene); `club_miembros_historial_anotar()` (que el historial anote el cambio); las vistas
    `v_mis_clubes` y `v_miembros_club` (la columna nueva, al final); y si la base tiene tablas
    propias, `datos_al_dia` (la lista de tablas y el `case` del módulo, para la foto de quien se
    va) y `anotar_version` en cada tabla;
  - desde `20261014_duenos_y_pedidos.sql` (el ejemplo más nuevo es `20261016_gps.sql`):
    `equipos_sumar_creador()` ya no existe (los clubes los crean los dueños);
    `aplicar_invitaciones()` sale de su versión de 20261014; también
    `club_miembros_proteger_duenos()` (el módulo en la lista de lo que no se le cambia a un
    dueño), `aceptar_pedido` con un parámetro más (`p_<permiso> boolean default false`: se
    borra la función vieja y se crea la nueva, con su `revoke`/`grant`), los permisos de
    columna (`grant update (<permiso>) on club_miembros`, `grant insert (<permiso>) on
    club_invitaciones`) y que la migración anterior que reemplaza esas funciones se frene si
    ya está corrida la nueva (como `20261014_duenos_y_pedidos.sql` con `gps`), con su prueba
    en `supabase/pruebas/correr.sh`; en la app, `aceptarPedido` en `src/domain/pedidosDb.js`
    y el aviso de `quitarJugador` en `src/domain/plantel.js`;
  - `MODULOS_DEL_CLUB`, `COLUMNAS_MEMBRESIA`, `normalizarMiembro`, `listarInvitaciones` e
    `invitar` en `src/domain/membresiasDb.js`, e `INVITACION_INICIAL` en `src/CuentasAdmin.jsx`;
  - `membresiaDe` en `src/domain/equipo.js` (lo que se guarda del club en el celular) y
    `permisosDePerfil` y `permisosEnClub` en `src/domain/perfilesDb.js` (lo que puede cada uno
    en el club, y `datos`: Datos básicos va con cualquier módulo);
  - la lista que compara el club al volver a las tarjetas, en `src/PortalApp.jsx`;
  - los textos `cuentas.modulos.<permiso>` en los dos idiomas, y la base lo pide en `permiso`;
  - los escenarios de `supabase/pruebas/escenarios.sql` (con y sin el permiso, invitación,
    quien se fue);
  - lo nuevo sin recargar (desde el 11/10): la tabla, en la publicación de Realtime (como
    `20261017_en_vivo.sql`, sin `replica identity full`), y la pantalla con `useEnVivo`
    (`src/domain/enVivo.js`) y su lectura en silencio. Ver «Lo anotado en Notas»;
  - si la tabla puede tener miles de filas (como el GPS), sus políticas con
    `equipo_id in (select public.clubes_donde_puedo('<permiso>'))` (el permiso, una vez por
    pedido), no con `puede_usar_en(equipo_id, …)` fila por fila. Ver «GPS (10/10)», Muchas filas;
  - toda tabla nueva con su `equipo_id` y RLS, cada política que abre mirando el club, y al menos
    una fila en `escenarios.sql`: las pruebas de aislamiento la recorren solas con cada cuenta.
    Una tabla o vista que se lea sin `equipo_id` se revisa y se suma a la lista de
    `huecos_entre_clubes()` y a `filas_ajenas` en los escenarios. Ver «Aislamiento entre clubes
    (18/10)»;
  - si la base guarda datos de atletas, su tabla con el disparador `exigir_consentimiento` (y
    su `persona`, si la tiene) y la carga de archivos con `useConsentimientoPersonas`
    (`src/components/Consentimiento.jsx`). Ver «Consentimiento de los atletas (18/10)».
    Reabierta (23/10): se sacó el consentimiento; ya no se pide (ver «Sin el consentimiento de
    los atletas (23/10)»);
  - si la base guarda datos de atletas, sus filas en `exportar_atleta` y su hoja en
    `src/domain/exportarAtleta.js`. Ver «Exportar los datos de un atleta (19/10)».
- Fotos: la foto que tenía la tarjeta Lesiones (los servidores dorados) ahora es la de Bases de
  Datos (`public/portal/bases.webp` y `bases-parada.webp`). Lesiones tiene sus fotos desde el
  05/10 (`public/portal/lesiones.webp` y `lesiones-parada.webp`, las mandó Santiago); el dibujo
  de la figura del cuerpo en dorado queda por si no cargan. Evaluaciones tiene las suyas desde el
  13/10 (`public/portal/evaluaciones.webp` y `evaluaciones-parada.webp`, el gimnasio de
  evaluación en dorado que mandó Santiago); su dibujo queda por si no cargan. GPS tiene las suyas
  desde el 13/10 (`public/portal/gps.webp` y `gps-parada.webp`, el tablero de GPS en dorado que
  mandó Santiago: «Modulo de gps»); su dibujo queda por si no cargan. La foto de una base nueva va en
  `foto`/`fotoParada` de su entrada en `BASES` y en la lista de `scripts/precache.js`.
- **Regla para todas las bases (Santiago, 09/10): lo nuevo se carga en su propia pantalla,
  aparte, como Nuevos casos en Lesiones.** Palabras del pedido: «una pantalla para cargar
  evaluaciones nuevas, aparte como la de lesiones (ESTO QUEDA DE REGLA PARA EL PROYECTO)».
  Cada base tiene, en este orden: la carga (formulario por pasos), **una sola Base** (si la
  base tiene varias tablas, como los tests de Evaluaciones, se elige cuál ver; no una
  pantalla por tabla), **Reportes** (se elige cuál ver: individual, grupal o gráficos, como
  en Lesiones) y **Ajustes** (cambiar las cabeceras y las listas, si tiene). En la Base se
  sigue corrigiendo en la tabla y se trae lo viejo con Pegar desde Excel; lo que no vuelve
  es un botón para agregar filas nuevas en la Base (ver UI-012 en
  [UI_DECISIONS.md](UI_DECISIONS.md)).
- **Regla para todas las bases (Santiago, 09/10): los registros de un atleta en su reporte
  individual.** Palabras del pedido: «Si una base puede contener más de un dato del atleta hay
  que poder ver esos distintos registros, como se ve hoy en lesiones que se puede ver en el
  reporte individual todas las lesiones y las cabeceras» y «como regla siempre tomamos las
  últimas 5». El reporte individual muestra los registros del atleta con todas las cabeceras
  que el club tiene a la vista; se ven los **últimos 5** y cada uno de esos 5 lugares tiene un
  desplegable para elegir otro registro suyo (la 1, la 2, la 7…), nunca más de 5 a la vez.
  Hecho en Evaluaciones (09/10). Lo de las últimas 5, **por ahora solo en Evaluaciones**
  (Santiago, 09/10: «por ahora dejalo solo para evaluaciones»): en Lesiones el individual
  sigue mostrando todas las lesiones. Las evaluaciones con muchas columnas (como Isocinecia)
  se resuelven después (Santiago, 09/10).
- Datos básicos sigue en la pantalla principal: lo ve cualquiera con algún módulo (Partido y
  Flujo diario también usan los jugadores), y adentro de Bases de Datos lo verían solo los que
  tienen ese permiso. Si se quiere adentro, hay que decidir quién lo ve.
- **Regla para todas las bases (Santiago, 05/10): ninguna columna cuenta las filas.** Arriba de
  cada tabla va cuántas filas hay ("29 filas"; con filtros, "13 de 29 filas"). Se sacó la columna
  # de la tabla (`src/components/TablaDatos.jsx`, la misma en Lesiones, Datos básicos y
  Evaluaciones); la fila entera se elige con Mayúscula + barra espaciadora, como en Excel. Las
  columnas con un número propio de cada fila (N° de caso, N° de registro, nº Eva) no son
  contadores y quedan.
- Ancho de las columnas (Santiago, 05/10): en todas las bases se achican o se agrandan a mano
  arrastrando el borde derecho de la cabecera, como en Excel (con el dedo también); dos clics en
  el borde la devuelven a su ancho. Queda guardado en cada celular, por tabla
  (`tabla_anchos:<tabla>`, como el orden de las columnas en `tabla_columnas:<tabla>`). Las fijas
  llevan su `ancho` de borde a borde.
- Columnas fijas con grupos arriba (Santiago, 09/10: «no respeta el fijado de las columnas», en
  la Base de Curl Nórdico en la compu): en la fila de los grupos, las fijas van juntas en una
  celda fija como ellas, y el título de cada grupo queda a la vista a la derecha de las fijas.
  Antes la barra del grupo pasaba por encima de las fijas al correr la tabla
  (`src/components/TablaDatos.jsx`, la misma tabla de todas las bases).
- Columnas fijas a elección (Santiago, 11/10: «si hago doble click en esa cabecera pasa a estar
  fija y se recuerda por dispositivo»): en la compu, en todas las bases, dos clics en una
  cabecera la dejan fija (va después de las que ya estaban) o la sueltan (vuelve a su lugar
  entre las demás); al pasar el mouse, la cabecera lo dice. Queda guardado en cada aparato, por
  tabla (`tabla_fijas:<tabla>`; en Evaluaciones, por test). Sin elegir nada, van las de
  entrada (las de quién y cuándo de cada base). Una fija sin ancho propio queda con el que
  medía. En el informe de arriba (GPS y Evaluaciones), el rótulo ocupa las fijas de entrada y
  una medida fijada con dos clics muestra su dato. ~~En el celular, dos toques no hacen nada:
  ahí las fijas corren con las demás (no entrarían).~~ **Cambiado el 11/10** (abajo).
- **En el celular, dos toques también fijan** (Santiago, 11/10: «revisa que en celular cuando
  hago doble click sobre una columna no se fija»; lo de que no hicieran nada lo había decidido
  Claude, no Santiago). El celular no avisa el doble clic: la tabla cuenta dos toques seguidos
  en la misma cabecera (quieto, sin mantenerlo apretado, que es arrastrarla; los toques en el
  filtro o en el borde no cuentan). Lo fijado ahí se guarda aparte (`tabla_fijas_celular:<tabla>`)
  y va primero, como las fijas en la compu. Las fijas de entrada siguen corriendo con las demás
  en el celular (lo del 05/10, «en el celular, no»): si se quiere una, se fija con dos toques. En
  el informe de arriba, la fijada lleva su dato fijo con ella y el rótulo va sobre las de
  entrada que siguen, corriendo. Si con otra fija no quedaría a la vista ni una columna de las
  más angostas (56 px), no se fija y la tabla dice «… no entra fija: soltá otra columna fija
  antes» (vale igual en la compu, donde casi nunca pasa). **Queda prohibido** volver a dejar el
  celular sin poder fijar columnas.
- Borrar varias filas (Santiago, 09/10: «que al boton de borrar fila borre todas las filas que
  tenga seleccionada, xq hice shift y seleccione varias filas para borrar y no se borraron»):
  en todas las bases (Lesiones, Evaluaciones y Datos básicos), «Borrar fila» borra todas las
  filas de lo elegido (con Shift, o Shift + barra espaciadora); con varias dice «Borrar 3
  filas», pregunta una sola vez cuántas se borran y las borra de a una. Si alguna no se puede
  (por ejemplo, un jugador con lesiones o evaluaciones), avisa el motivo y cuántas se
  borraron. Siguen las mismas reglas de cada base (quién puede borrar, solo lectura, historial).
- **Ocultar columnas y filas** (Santiago, 15/10: «EN TODO EL SOFT DE PODER OCULTAR MANUALMENTE
  UN COLUMNA Y FILAS SIN NECESIDAD DE ENTRAR A AJUSTES»; «Cuando toco un columna o fila en
  cierto lugar tiene que preguntarme si la quiero ocultar»): en todas las bases (la misma tabla,
  `src/components/TablaDatos.jsx`; también las tablas de Cargar de GPS), una columna se oculta
  desde su embudo, «Ocultar esta columna» (tocar el nombre de la cabecera ya la fija con dos
  toques y la mueve manteniéndola apretada, UI-026); las filas, eligiéndolas (una celda, o
  varias con Shift) y tocando «Ocultar fila», al lado de «Borrar fila». Las dos preguntan antes
  («¿Ocultar «…»?», «¿Ocultar estas 2 filas?»). Con algo oculto, con las demás acciones y en
  ámbar: «1 columna oculta» (abre la lista con casillas para volver a mostrarlas; sin ocultas
  dice «Columnas»; al menos una columna queda a la vista) y «Mostrar las 2 filas ocultas»;
  arriba, «1007 de 1009 filas». No se borra ni
  se cambia nada guardado, y el informe de arriba y los colores se calculan con todas las
  filas, como antes (para ver menos filas en las cuentas están los filtros). Las columnas
  quedan ocultas en ese aparato, por tabla (`tabla_ocultas:<tabla>`; en Evaluaciones, por test;
  la tabla final de Cargar de GPS es la misma que la Base, como el orden y los anchos); las
  filas, mientras la app está abierta, como los filtros, salvo en Cargar de GPS: ahí las filas
  van por su lugar (en la carga siguiente serían otras) y vuelven a verse al salir de la tabla.
  Ajustes › Cabeceras sigue escondiendo para todo el club. **Queda prohibido** ocultar sin
  preguntar.

## Evaluaciones (05/10)

Santiago subió `BD_evaluaciones.xlsx` (las evaluaciones físicas del club) y pidió replicarlo
en la app **sin cambiar datos ni lógicas, con el mismo formato condicional**. Es la segunda base
de Bases de Datos, con su permiso propio (`evaluaciones`). Se hace **de a un test** (un PR
cada uno), empezando por el de más a la izquierda: **Test Zona Media** (hecho el 05/10). Se
carga en la app; lo viejo se trae una vez con Pegar desde Excel.

- Dónde: lo común a todos los tests en `src/domain/evaluaciones/` — `excel.js` (cómo calcula
  y muestra Excel: vacía vs "", texto mayor que número, 15 cifras, SUBTOTAL, formatos),
  `formatoCondicional.js` (las reglas como datos, con su prioridad), `motor.js` (los dos pasos:
  cada fila con todas las del test; el informe y los colores con las filas que deja ver el
  filtro), `categorias.js` (Sub-15 … Mayor) e `importar.js` (Pegar desde Excel). Cada test es
  un archivo de `tests/` (columnas, fórmulas, informe, reglas de color, cómo son sus V.R.) y la
  lista de tests está en `tests/index.js`. La pantalla es `src/Evaluaciones.jsx` (Cargar,
  Base, Valores de referencia y Ajustes; desde el 09/10), `src/ReportesEvaluaciones.jsx` y
  `src/ImportarEvaluaciones.jsx`; lo que se ve en cada celda, `celdas.js`, y los Ajustes del
  club, `ajustes.js`; la base, `src/domain/evaluacionesDb.js`
  y la migración `supabase/migrations/20261012_evaluaciones.sql` (tablas `evaluaciones` y
  `evaluaciones_referencias`).
- **Regla para todos los tests (Santiago, 05/10): las columnas que solo existen para que las use
  un BUSCARV, BUSCARH, BUSCARX o cualquier BUSCAR no se usan** (en Zona Media, las claves ocultas
  A y B; en Funcional, las claves ocultas de cada test). Las que tienen un resultado propio sí
  van, con su fórmula y su formato (en Zona Media, "PRO??"). La "A" de Zona Media (la asimetría
  con signo) se juntó con "Deficit Lateral %", que es el mismo valor sin signo (Santiago, 05/10):
  no se muestra, el déficit se calcula igual que antes.
- Posición no se usa en Evaluaciones (Santiago, 05/10): salió de Zona Media.
- Lo que decidió Santiago el 05/10 (lo que el Excel hacía por sus límites, la app lo hace como
  se quiso):
  - % mejora: cada medida contra la misma de la evaluación anterior del jugador que la tenga,
    sin límite de cuántas atrás. En el Excel, Lateral D, Lateral I y Prono miraban otra columna.
  - Toda clase va de 5 a 1 con los mismos colores: 5 verde oscuro, 4 verde, 3 amarillo,
    2 naranja, 1 rojo. El Ratio del informe se clasifica con la misma regla que Ratio. Clas de
    las filas (en el Excel AA2 tenía otra). (15/10: los rellenos y degradés van con los mismos
    colores más suaves; el número de la clase sigue con su color, UI-040.)
  - **Cómo se ve una clase, igual en toda la app (Santiago, 09/10)**: «Necesitamos que se vean
    bien, no importa el color de fondo solo que se vean bien y sea lo mismo para todas las
    clasificaciones en todos lados». Primero (PR #228) la celda entera fue del color de su
    clase, con el número en negrita blanco u oscuro. **Reabierta el mismo 09/10** por
    Santiago: «Mejor devolve el color gris a los fondos de clasificacion». Queda: el número
    en negrita del color de su clase, sobre gris (#D9D9D9), como en el Excel, igual en
    todos los tests, la Base y los reportes (`estiloDeClase` en `formatoCondicional.js`).
    Descartado: la celda entera del color de la clase. Se ve que el 3 (amarillo) y el 4
    (verde claro) se leen poco sobre gris: si se quiere, hay que decidir otro tono para la
    letra o para el gris (no cambiarlo sin que Santiago lo pida).
  - Deficit. Clas sin Lateral D o sin Lateral I: vacía (el Excel ponía 1 en rojo). Ratio sin
    Prono: vacío (el Excel daba 0). Sin V.R. cargados: las clases vacías y un aviso (el Excel
    les daba 5 a todos). El informe sin ningún dato en una columna: vacío (el Excel mostraba
    #DIV/0! y 0).
  - nº Eva, la evaluación anterior y Va van por fecha (la misma fecha: el orden de carga; sin
    fecha: al final), no por el lugar de la fila.
  - Los tiempos son minutos y segundos: "3:04" es 3 min 04 s (en el Excel están como horas y
    minutos, h:mm). La app los guarda en segundos y los cuenta en la unidad del Excel
    (segundos ÷ 1440), así cada cuenta da igual.
  - Fecha Nac sale de Datos básicos (en el Excel, de "Lista Jugadores" del otro archivo).
- Los valores de referencia (V.R.) **no van al código** (el repositorio es público): se cargan
  con un SQL que se pasa en el chat, en `evaluaciones_referencias` (una fila por club y test;
  `datos` = `{ categorias: { <categoría>: { titulo, rotulo, n, excelente, muy_bueno, bueno,
  regular, malo } }, resumen: { n: { <categoría>: n } } }`, cada fila con un valor por medida,
  los tiempos en la unidad del Excel). La app solo los lee (hasta el 14/10: desde entonces se
  cambian en la solapa; ver «Los V.R. se cambian: una solapa en cada base (14/10)»). La columna "Pro" del resumen va
  vacía: en el Excel da #REF! (la celda de donde salía ya no existe); si se sabe qué tenía,
  se completa.
- Lo que no se copió (no cambia ningún resultado): las columnas de ayuda para buscar, el contador
  oculto C (es el # de cada fila), la columna vacía M, la fila de títulos repetida, las marcas
  sueltas "c"/"va", el botón "inicio" (macro del otro archivo), las 430 reglas de formato sin
  color, lo que dependía de hasta qué fila llegaban los rangos del Excel (todas las filas usan
  las reglas de las primeras), el segundo bloque "Mayores" (CW:DC) y la leyenda de Ratio
  (CP:CU). Las fechas van con el formato de la app.
- Ninguna regla escrita en código (regla del 02/10): cada test está entero en su archivo de
  `tests/`, en un solo lugar; los V.R. ya son de cada club (en la base). Lo que falta pasar a la
  configuración del club: los cortes del PRO?? (4,2 / 3,4 / 2,6 / 1,8) y los desvíos de cada
  regla de color. En los V.R. de Mayor, el Ratio sale del Bueno de a 0,17 (Muy Bueno = Bueno +
  0,17, Excelente = Muy Bueno + 0,17, Regular = Bueno − 0,17, Malo = Regular − 0,17): en la
  base están los valores ya calculados; si el club cambia el Bueno, hay que cambiar los otros.
- Más adelante (Santiago, 05/10): los valores de referencia pasarían a un módulo propio de la
  pantalla principal, **Valor Referencial**. Por ahora van en Evaluaciones, en la pestaña
  "Valores de referencia" (solo lectura, cargados por SQL). (14/10: a la pregunta de dónde va la
  solapa, Santiago eligió «Una en cada base» en lugar de un módulo con una solapa por base: el
  módulo propio no va. Desde ese día se cambian ahí; ver «Los V.R. se cambian: una solapa en
  cada base (14/10)».)
- **Curl Nórdico e Isoprone** (hecho el 09/10, `tests/curlNordicoIsoprone.js`). Lo que decidió
  Santiago el 09/10:
  - **Un solo test con cuatro bloques** (Curl Nórdico Máxima y Media, Isoprone Máxima y
    Media): «Son dos evaluaciones pero se toman en la misma maquina, por eso se dejan aparte
    pero en la misma hoja». Se carga el peso del día (P.C., en el primer paso, con el jugador
    y la fecha) y la fuerza de cada pierna en cada bloque; lo demás se calcula: la fuerza
    relativa al peso, su clase, su % de mejora, el déficit entre piernas con su clase y qué
    pierna rinde menos (PD, PI o Sin Deficit).
  - **Sin las columnas ocultas que suman las dos piernas** («% mejora L + R» y «Clas L + R»):
    «Saca esas columnas que sumen o usen las dos piernas, si hace falta despues las metemos
    pero por ahora no». El déficit entre piernas queda: «esas no se sacan, solo saca las que
    estan ocultas».
  - **Las clases, contra los V.R. de la categoría de cada fila**: «Si en el desplegable dice
    sub 17 todas las clasificaciones (1,2,3,4,5) se tienen que comparar contra el valor de ese
    vr y no de otro» (el Excel comparaba siempre contra Mayor). Sin categoría o sin V.R. de
    esa categoría, la clase queda vacía. Hoy el Excel tiene V.R. solo de Mayor.
  - El % mejora, como en Zona Media (05/10): contra la misma medida de la evaluación anterior
    del jugador que la tenga, sin límite de cuántas atrás (el Excel miraba solo la evaluación
    anterior del jugador; si esa no tenía la medida, quedaba vacío).
  - El informe (N°, Promedio, Desvío, Máximo y Mínimo) **no tiene «Vs …»** y el **N° cuenta
    los datos de cada columna** (Santiago, 09/10: «Que cuente datos»; en el Excel, las
    columnas ocultas de L + R contaban celdas, con o sin dato). En las columnas de Deficit
    Pierna dice cuántas PD, PI y Sin Deficit hay **respetando el filtro** (en el Excel, sin
    respetarlo), con el formato del Excel («PD 109,0»).
  - **Decimales que no se ven** (09/10): Pegar desde Excel trae lo que el Excel muestra, no lo
    que guarda. En Curl, P.C. (24 filas) y L MED. y R MED. de Curl Nórdico (25 filas cada
    una) tienen decimales escondidos por el formato; pegados así, cambiaban 165 resultados.
    Antes de copiar, a esas columnas se les pone formato Número con 15 decimales (sin guardar
    el Excel): así se pegan exactas (comprobado contra la hoja real: 0 diferencias).
    **Regla para cada test que se agregue**: buscar en su hoja los datos cargados con más
    decimales de los que se ven y avisar qué columnas cambiar antes de copiar.
  - **Las filas con el comentario «CONTROL»** (las 4 últimas de la hoja): «no son evaluaciones
    como tal, son solo controles que se le realizaron al atleta». No se traen: al pegar desde
    el Excel no se copian esas filas (el comentario no viaja con el texto copiado, así que la
    app no las puede reconocer sola). Si más adelante se quieren guardar los controles, hay
    que decidir dónde van.
  - Los V.R. tienen dos tablas (Curl Nórdico e Isoprone, `datos.categorias.<categoría>` con
    las medidas `curl_…` e `iso_…` y `titulos.curl` / `titulos.iso`); van por SQL, como los de
    Zona Media. En el Excel los cortes salen del promedio y el desvío (Bueno = Promedio): en
    la base van ya calculados; si el club cambia el promedio o el desvío, hay que
    recalcularlos. Las columnas «DE» del déficit solo se muestran.
  - Lo que no se copió (no cambia ningún resultado): las dos columnas ocultas de arriba, las
    columnas de ayuda para buscar y los tonos propios de esta hoja (verde oscuro, naranja y el
    amarillo de la clase 3): van los de toda la app.
- **Isocinecia** (hecho el 09/10, `tests/isocinecia.js`): el test isocinético de rodilla
  (extensión y flexión, PD y PI) a 60°, 180° y 300°, las tres en la misma fila. Lo que decidió
  Santiago el 09/10:
  - **Un solo test con un selector de velocidad** («Un test + selector»): en la Base y en
    Reportes › Grupal, «Velocidad» 60° / 180° / 300° / Todas, como los botones «60 Grados»,
    «180 Grados», «300 Grados» y «Tudo» del Excel (al entrar, 60°). Un solo nº de evaluación y
    un solo P.C. por fila. Descartado: tres tests separados.
  - **No se carga a mano en Cargar**: «no pierdas tiempo en meter eso en cargar evaluacion xq
    eso se carga atraves de un pdf, hay una macro que dice cargar evaluacion». En Cargar no
    aparece (ni para editar: lo de hoy se ve y se borra, y se corrige en la Base). Lo viejo se
    trae con Pegar desde Excel. **Pendiente: el lector del PDF** (Santiago, 09/10: «hicimos un
    lector en python que traia los datos, lo que se me ocurre es meter esa misma logica dentor
    del soft y cargar el pdf ahi y que ese lector funcione dentro de Carga evaluaciones»).
    Falta que Santiago pase el lector en Python y PDF de ejemplo (los PDF no van al
    repositorio).
  - El único dato en 0 (Work Fatigue Flexión derecha a 60°) **es real**: se trae como está.
  - Los comentarios «Corregido antes …» de dos celdas: «Si podemos agregar a la web que las
    notas se puedan poner como en el excel, mejor, sino dejas una columna aparte». **Pendiente:
    notas en las celdas, como en Excel**, para todos los tests (una marca en la esquina de la
    celda, la nota se ve al tocarla y se agrega con un botón «Nota»). Va en su propio cambio;
    hasta entonces, esos dos comentarios quedan en el Excel.
  - Igual que en Curl Nórdico (no se volvió a preguntar): las clases contra los V.R. de la
    categoría de cada fila (el Excel usaba siempre Mayor); el N° del informe cuenta datos (el
    Excel contaba también las fórmulas vacías); las cuentas de PD / PI / Sin Deficit respetan el
    filtro (filas Promedio, Desvío y Máximo, con el formato del Excel, «PD 9,0»); el % de
    mejora contra la evaluación anterior que tenga la medida; sin una de las dos piernas,
    «Deficit Pierna» vacío (el Excel ponía «PI» con la izquierda vacía); una división por cero
    (Ant/Ago con extensión 0), vacía; los colores, los de toda la app (esta hoja tenía otro
    verde oscuro y otro naranja en los degradé) y las letras de PD / PI / Sin Deficit, las de
    Curl Nórdico.
  - Lo que no se copió (no cambia ningún resultado): la columna A (ayuda de búsqueda), los
    separadores vacíos CP y FZ y los nombres largos que la fila 17 repetía en 300° (van los
    cortos, como en 60° y 180°). Los nombres de los V.R. de los déficits y los ratios se
    distinguían solo por un punto o un espacio («Deficit Pico Ext», «Deficit Pico Ext.»): en la
    pestaña de V.R. dicen de qué medida son.
  - Los V.R.: una tabla por velocidad (`datos.categorias.<categoría>` con las medidas `v60_…`,
    `v180_…` y `v300_…`, `titulos.v60` / `v180` / `v300`, y las «DE» de los déficits como
    `<déficit>_de`); van por SQL, como los otros. Hoy solo Mayor.
  - **Pegar desde Excel**: se copia desde la fila 16 (los nombres largos, «Peak TQ/BW Ext Right
    60»): la fila 17 repite «PD» y «PI» en cada medida. Decimales que no se ven: el P.C. (23
    filas) y ROM Right 180 (1 fila); antes de copiar, formato con 15 decimales.
  - En el reporte individual va en «Fuerza» con todas sus columnas (Santiago, 09/10: las
    evaluaciones extensas «después lo resolvemos», por ahora así).
  - Comprobado contra la hoja real (solo local): las 34.155 celdas calculadas dan igual; en el
    informe, solo cambia el N° (cuenta datos).
- **Funcional** (hecho el 09/10, `tests/movilidad.js` y `tests/estabilidadRotacional.js`).
  Lo que decidió Santiago el 09/10:
  - **Un test por bloque**: Movilidad de Tobillo, Movilidad de Cadera, Movilidad de Isquio y
    Estabilidad rotacional. «Como todas esas evaluaciones son de movilidad pero se toman
    distinto hicimos esto, ejemplo: Un jugador hace la evaluacion de tobillo, despues hace otra
    de tobillo y despues hace una de estabilidad, el dato de estabilidad se pone en la primera
    fila del jugador no en la segunda evaluacion de tobillo». En el Excel cada bloque tiene su
    fecha y su n° de evaluación: en la app, cada uno es su propio test, con su fecha y su n°.
  - **Sentadilla de Arranque, Hombro, los Re - test y las notas quedan afuera** («Dejarlos
    afuera»): no tienen datos. Si se usan más adelante, se agregan.
  - **La comparación «Vs …» como en Zona Media** («Armarla como Zona Media») en los tres de
    movilidad: el promedio sobre el «Bueno» de la categoría elegida, con la clase del
    promedio y su color. En el Excel la fila «Vs Mayor» de esta hoja miraba celdas de la
    Sentadilla y no servía.
  - Movilidad: PD y PI (cada pierna) se cargan; se calculan sus clases, el % Mejora, el %
    DEFICIT LATERAL (|PI − PD| / la menor) con su clase y qué pierna rinde menos. En Isquio,
    menos es mejor: las clases con <=, los colores de PD y PI al revés (como el déficit), su %
    Mejora sin color y «Deficit Pierna» marca la pierna con el valor más grande.
  - Igual que en Curl Nórdico e Isocinecia (no se volvió a preguntar): las clases contra los
    V.R. de la categoría de cada fila; el % Mejora contra la evaluación anterior que tenga el
    dato; el N° del informe cuenta datos; las cuentas de PD / PI / Sin Deficit respetan el
    filtro («PD 1,0»); sin una pierna, déficit y pierna vacíos; los colores y las letras de PD
    / PI / Sin Deficit, los de toda la app. El desvío del informe y de los colores lleva el
    0,0000000000001 que le suma el Excel. «Dificit Pierna» se llama «Deficit Pierna», como en
    los otros tests.
  - **Arreglado al pasar (a revisar con Santiago)**: «Deficit Pierna» en negro con la letra
    blanca cuando la clase del déficit es 2 o menos va en los tres; en el Excel de Tobillo esa
    regla estaba mal escrita (`IF($AR18<=2,"VERDADERO")`) y no pintaba nunca (con los datos de
    hoy, 108 celdas de Tobillo se ven en negro). En Isquio, el % Mejora PI y el % DEFICIT
    LATERAL del informe tenían formato de número (0,1 en vez de 10,0%): van en %. Los formatos
    de los datos cambiaban de fila a fila en la misma columna («17» y «17,0»): uno por columna.
  - Estabilidad rotacional: ocho listas (Cifosis Derecha, Cifosis Izquierda, Inestabilidad y
    Completa recorrido, con la pierna derecha y con la izquierda en apoyo), con las opciones
    del Excel (Cifosis: NO, ALTA, BAJA, ALTA Y BAJA; Inestabilidad: SI, NO; Completa
    recorrido: SI, NO 1, NO 2, NO 1 y 2); se cambian en Ajustes › Listas. Sin clases, sin
    V.R. y sin colores (el Excel no tiene). El informe dice cuántas tienen respuesta y qué
    parte tiene cada opción, con las filas que se ven («Baja 50,0%»). En el Excel algunas
    columnas dividían por el N° de otra (Cifosis Izquierda y la pierna izquierda, por el de la
    primera Cifosis; la segunda Inestabilidad, por el de la primera): acá cada una por el suyo
    (con los datos de hoy da igual).
  - Los V.R. (Tobillo, Cadera e Isquio; hoy solo Mayor): PD, PI y el déficit con su «DE»
    (`datos.categorias.<categoría>` con `pd`, `pi`, `deficit` y `deficit_de`, `titulo` y, en
    Cadera, el `rotulo` con la nota que trae el Excel); van por SQL, como los otros.
  - **Pegar desde Excel**: se copia desde la fila 17 (títulos), desde la columna Jugador hasta
    el final del bloque del test (o la hoja entera). Cada test busca su bloque por su propia
    Fecha (`bloqueDeFuncional` en `tests/movilidad.js`; `bloqueParaPegar` y `enBloque` en
    `importar.js`) y lee su PD y su PI adentro; saltea las filas sin sus datos
    (`saltearFilasSinMedidas`); las listas se entienden sin importar mayúsculas, en los dos
    idiomas y con los nombres del club. Las fechas salen como las muestra el Excel
    (dd/mm/aaaa). No hay decimales escondidos: PD y PI son números enteros.
    - Arreglado el 09/10 (Santiago: «xq no me deja cargar los datos de cadera?»): Excel **no
      copia las columnas ocultas**, y con las de Tobillo ocultas la app buscaba el PD de Cadera
      contando desde la izquierda (el 3.º PD) y no lo encontraba. Ahora los bloques se buscan
      por su Fecha: el primero (el de la Fecha de al lado del Jugador) es Tobillo; los que
      tienen PD después de su Fecha y su Evaluación son Cadera (el primero) e Isquio (el
      segundo); el de las Cifosis, Estabilidad. Si se ve uno solo de Cadera e Isquio, es
      Cadera cuando es lo último que se pegó (se copió hasta el fin de Cadera); si no, no se
      lee. Así nunca se cargan los datos de un bloque en otro test, salvo un caso que no se
      puede distinguir (Cadera oculta, en el test de Cadera, copiando justo hasta el fin de
      Isquio). Si no aparece ninguna columna del test, la pantalla lo dice («En lo que
      pegaste no están las columnas de este test…») en vez de «no hay evaluaciones».
  - Comprobado contra la hoja real (solo local): las 3262 celdas calculadas de las 503 filas
    y el n° de evaluación de cada una dan igual; en el informe, solo cambia el N° de dos
    columnas que el Excel deja vacío. Los colores, contra las reglas del Excel aplicadas
    aparte: iguales, salvo el negro de «Deficit Pierna» en Tobillo (arriba). Pegada la hoja
    entera, cada test lee sus filas (214, 213, 39 y 37) sin avisos y con los mismos datos.
- **Iso Aductor-Abductor** (hecho el 09/10, `tests/isoAductorAbductor.js`): como Curl Nórdico,
  una fila por evaluación con el peso del día (P.C.) y dos bloques (Aductores y Abductores):
  la fuerza de cada pierna (ABS), la relativa al peso (REL), su clase, su % de mejora, el
  déficit entre piernas con su clase y qué pierna rinde menos; al final, el ratio de cada
  pierna («Ant/Ago») con su clase de 1 a 3, a los dos lados (como el ratio de Isocinecia). Lo
  que decidió Santiago el 09/10:
  - **El ratio es Aductor ÷ Abductor**, como lo calcula la hoja («Aductor ÷ Abductor»): sus
    V.R. se llamaban «Ratio Abd/Adu»; solo se corrigió el nombre (en la app, «Ratio Aductor /
    Abductor»). Sus V.R. van a los dos lados del Bueno, con los nombres del Excel (Malo,
    Regular, Bueno, Regular, Malo).
  - **La comparación «Vs …» como en Zona Media** («Armarla como Zona Media»): en el Excel
    estaban el selector «Vs Mayor» y la nota, pero no había fila de comparación. Compara la
    REL, el déficit y el ratio.
  - **La última fila (sin fecha y sin peso) se trae igual** («Traerla igual»): entra sin
    fecha; sin el peso no hay REL, clases, déficit ni ratio hasta que se complete en la Base.
  - **La columna Grados queda afuera** («Dejarla afuera»): está vacía en todas las filas. Si
    se usa más adelante, se agrega.
  - Igual que en los otros tests (no se volvió a preguntar): las clases contra los V.R. de la
    categoría de cada fila; el % de mejora contra la evaluación anterior **por fecha** que
    tenga el dato (en el Excel, por el lugar de la fila: un jugador tiene dos filas fuera de
    orden y en la app cambian su n° y su % de mejora); el N° del informe cuenta datos (el
    Excel contaba las fórmulas vacías de DEFICIT PIERNA); las cuentas de PD / PI / Sin
    Deficit respetan el filtro (en las filas Promedios, Desvíos y Mínimo, como en el Excel);
    una división por cero, vacía; los colores de toda la app y las letras de PD / PI / Sin
    Deficit de Curl Nórdico. Los formatos, los del Excel (el % Mejora PD de Aductores con dos
    decimales). Lo que no se copió: las columnas de ayuda para buscar (A y B, ocultas),
    el contador C y Posición.
  - Los V.R.: tres tablas (Aductor, Abductor y el ratio; `datos.categorias.<categoría>` con
    `ad_…`, `ab_…`, `ratio_pd` / `ratio_pi`, `titulos.aductor` / `abductor` / `ratio` y las
    «DE» de los déficits como `<déficit>_de`); van por SQL, como los otros. Hoy solo Mayor.
  - **Pegar desde Excel**: se copia desde la fila 14 (títulos) hasta la última fila, desde la
    columna Jugador. «PD (ABS)» y «PD (REL)» se leen igual: va la primera PD de Aductores y la
    tercera de Abductores (lo mismo con PI). **Decimales que no se ven**: el P.C. (22 filas);
    antes de copiar, a esa columna se le pone formato Número con 15 decimales.
  - En el reporte individual va en «Funcionales».
  - Comprobado contra la hoja real (solo local): de 4906 celdas calculadas, cambian solo las
    de las dos filas fuera de orden de fecha (su n° y su % de mejora); el informe (126
    celdas) da igual; los colores, contra las reglas del Excel aplicadas aparte, iguales;
    pegada con el P.C. a 15 decimales, entran las 223 filas exactas.
- **Sentadilla Incremental** (hecho el 09/10, `tests/sentadillaIncremental.js`): una fila por
  evaluación con el peso del día (P.C.), el Dispositivo, el Medio (el ejercicio) y cinco series
  de carga creciente: en cada una, Kg, la carga (Kg + P.C.), Vel, PSE, el %RM que corresponde a
  ese PSE (la fórmula del Excel), el Fmax T (100 × carga ÷ %RM) y el % RM IND (carga ÷ RM IND).
  El RM IND es el promedio de los Fmax T, con su DESVIO, su COEF. VAR, su Rel (÷ P.C.), su %
  mejora y su Clas. Grupo (la Rel contra los V.R. de la categoría); aparte, el RM x Vel (lo da
  el dispositivo), su Rel (vel) y su % mejora. Lo que decidió Santiago el 09/10:
  - **Las series que no cuentan se respetan** («Respetar lo que sacaron»): en el Excel, a 20
    series les borraron a mano la fórmula para que no entren en el RM, sin una regla fija
    (otras iguales sí cuentan). En la app, cada serie tiene «¿Cuenta?» (SI / NO); una con
    «NO», o sin Kg o sin PSE, no entra (queda sin %RMx PSE ni Fmax T). Al pegar del Excel, la
    serie con Kg y PSE pero sin Fmax T viene en «NO» (`completarAlPegar`). Contar todas
    cambiaba el RM IND de 15 evaluaciones y la clase de 10.
  - **Leg Press sin peso corporal, en las cinco series** («Sin peso corporal»): la fórmula del
    Excel buscaba la palabra «prensa» (y solo en la serie 1) y la fila decía «Leg Press», así
    que le sumaba el peso. En la app, el Medio «Leg Press» (código `prensa`) va sin peso.
  - **La comparación «Vs …» como en Zona Media** («Armarla como Zona Media»): P.C., RM IND,
    Rel, RM x Vel y Rel (vel), el promedio sobre el «Bueno» de la categoría elegida, pintado
    con la clase del promedio (la de la Rel va en Clas. Grupo); el P.C. sin color. En el
    Excel no pintaba nada y la de RM IND/REL comparaba contra kilos.
  - **Pot, RM IND/REL y los V.R. «0.6» y «0.7» quedan afuera** («Sacar las tres»): Pot estaba
    vacía en todas; RM IND/REL daba igual que Rel (la Rel tomó sus colores); el Excel decía
    «BORRAR .6 Y .7». Si se usan más adelante, se agregan.
  - Igual que en los otros tests (no se volvió a preguntar): las clases contra los V.R. de la
    categoría de cada fila; los colores del RM IND (contra RM) y de la Rel (vel) (contra Rel
    (Vel)), también contra la categoría de la fila (en el Excel, siempre Mayor), con las
    franjas del Excel (en el corte del Bueno, naranja; Malo no se usa); el % mejora contra la
    evaluación anterior del jugador **con el mismo Medio** (como el Excel) que tenga el dato;
    una serie sin Kg queda vacía (en el Excel la carga era el peso solo); la Rel (vel) sin RM x
    Vel queda vacía (el Excel daba 0 y la pintaba de rojo); el informe solo con las
    evaluaciones (el Excel contaba 374 filas vacías con fórmulas). Dispositivo y Medio, que
    se escribían a mano, son listas con los textos de la hoja (se cambian en Ajustes ›
    Listas). El PSE va con un formato por columna (General: «7» y «0,5»). Lo que no se copió:
    las columnas de ayuda para buscar (A y B, ocultas; BJ, sin título; y el bloque de BUSCARX
    de FB a FM), el contador C, las cuentas sueltas de BS y CB y el «RESUMEN» de DW a EA.
  - Los V.R.: uno por categoría (`datos.categorias.<categoría>` con `pc`, `rep`, `rm_ind`,
    `kg`, `rel`, `rm_vel`, `rel_vel`, `titulo`, `rotulo` y, en Sub-23 y Mayor, `desvio`) y el
    resumen (`datos.resumen.n`), sin la columna «Pro» de Zona Media (`resumenConPro: false`).
    Van por SQL, como los otros. En el resumen del Excel, Mayor tenía el RM (Vel) bajo «Kg»:
    en la app, «Kg» de Mayor va vacío (no tiene).
  - **Pegar desde Excel**: se copia desde la fila 10 (títulos) hasta la última, desde la
    columna nº Eva hasta Nota. Kg, Vel, PSE y Fmax T están una vez por serie. Las fechas salen
    como las muestra el Excel (dd-mm-aa). Los PSE de 0,5 se ven y se copian como 0,5
    (Santiago, 09/10).
  - En el reporte individual va en «Funcionales».
  - Comprobado contra la hoja real (solo local): de 2296 celdas calculadas de las 82 filas,
    cambian solo 40, todas por lo decidido (la fila de Leg Press, 13 de series sin Kg, 4 Rel
    (vel) sin RM x Vel y 3 %RMx PSE de series que no cuentan); el informe da igual que el del
    Excel con esas 40 celdas y sin las filas vacías; los colores, contra las reglas del Excel
    aplicadas aparte, iguales (4346 celdas); pegada, entran las 82 filas con los mismos datos.
  - **Los V.R. juveniles se dejan como están** (Santiago, 10/10: «Dejarlos en las dos»): los
    bloques Sub-15 a Sub-20 de esta hoja son idénticos a los de Press Plano (hasta los
    comentarios «BORRAR .6 Y .7») y su escala es la del Press, no la de la Sentadilla (que
    suma el peso). Quedan igual en los dos tests.
- **Press Plano** (hecho el 10/10, `tests/pressPlano.js`; la hoja dice «Pecho Plano»): una fila
  por evaluación con el peso del día (P.C.), las repeticiones (Rep) y los Kg. Se calculan el RM
  (Kg × (1 + 0,029 × Rep)), las cargas al 0,4 … 0,8 del RM, la Rel (RM ÷ P.C.), la clase y el %
  mejora de cada uno y Va? (como el «Va» de Zona Media). Lo que decidió Santiago el 10/10:
  - **Sin Rep, el RM es el Kg levantado**, como en el Excel («dejalo como esta, esas vacias son
    1»: un intento de máximo). Hoy son 7 de las 32 evaluaciones.
  - **El bloque oculto «CARGA 1» a «CARGA 5» queda afuera** («Dejarlo afuera»): cinco cargas
    sugeridas desde el RM, fuera de la tabla y solo desde la fila 13. Si se usa, se agrega.
  - **La fila «Vs …» compara el RM y la Rel con su clase**, como estaba; **la celda que
    clasificaba el promedio del % mejora contra los V.R. de Rel salió** («Sacar esa celda»).
  - Igual que en los otros tests (no se volvió a preguntar): las clases contra los V.R. de la
    categoría de cada fila; el % mejora contra la evaluación anterior por fecha que tenga el
    dato (el Excel miraba hasta tres atrás, por su n°); el informe sin datos queda vacío (el
    Excel mostraba #DIV/0! y 0 en los % mejora); los V.R. «0.6» y «0.7» no van (el Excel dice
    «BORRAR .6 Y .7», como en Sentadilla; son el RM × 0,6 y × 0,7); Posición no va y la Fecha
    Nac sale de Datos básicos; sin la columna «Pro» en el resumen de V.R. Lo que no se copió:
    las columnas de ayuda para buscar (A y B), el contador C y el «RESUMEN» vacío de CL.
  - Los V.R.: uno por categoría (`datos.categorias.<categoría>` con `pc`, `rep`, `rm`, `kg`,
    `rel`, `titulo` y `rotulo`) y el resumen (`datos.resumen.n`). Van por SQL, como los otros.
  - **Pegar desde Excel**: se copia desde la fila 10 (títulos) hasta la última, desde la
    columna nº Eva hasta Nota. «Clas. RM» tiene un salto de línea: Excel lo copia entre
    comillas y se lee bien. **Decimales que no se ven**: un P.C. tiene dos decimales y se ve
    con uno; antes de copiar, a esa columna se le ponen dos decimales.
  - En el reporte individual va en «Fuerza».
  - Comprobado contra la hoja real (solo local): las 384 celdas calculadas de las 32 filas
    dan igual; en el informe solo cambian los 8 «% mejora» sin datos (vacíos); la fila «Vs
    Mayor», igual; los colores, contra las reglas del Excel aplicadas aparte, iguales (512
    celdas); pegada con el P.C. a dos decimales, entran las 32 filas exactas.
- **Saltos** (hecho el 10/10, `tests/saltos.js`; la hoja dice «EVALUACIONES DE SALTO»): en
  cada fila, los saltos de un jugador en un día, en cuatro bloques. **Cuatro tests, uno por
  bloque, como Funcional** (Santiago, 10/10: «es muy parecida a funcional»; «Cuatro tests»):
  Salto Countermovement, Salto Drop, Salto Squat y Salto Single Leg, cada uno con su n° de
  evaluación. Al pegar, cada uno toma la Fecha, la Selección y el P.C. de la fila (el P.C.
  va en los cuatro); Va? queda en Countermovement y la Nota en los tres que la tienen, como
  en el Excel. Countermovement, Drop y Squat: Altura, Pico de Fuerza, Pico de Potencia y
  RSI-modified, cada uno con su clase y su % mejora. Single Leg: esas cuatro medidas con
  cada pierna (PD y PI), con su clase y su % mejora, el DEFICIT LATERAL (|PI − PD| / la
  menor) con su clase (menos es mejor) y qué pierna rinde menos (DEFICIT PIERNA), como en
  Movilidad. Lo que decidió Santiago el 10/10:
  - **Drop y Squat tienen sus propios V.R., vacíos por ahora** («V.R. propios, vacíos»): sus
    clases quedan vacías hasta que pase sus V.R. y se carguen por SQL. En el Excel, Drop se
    clasificaba con los de Countermovement (daba 1 en toda la Fuerza y 5 en toda la
    Potencia) y Squat no tenía clases (sus columnas Clas estaban vacías).
  - **La comparación «Vs …» como en Zona Media, en los cuatro** («Como Zona Media»): en el
    Excel la fila «Vs Mayor» miraba celdas vacías y en Single Leg no estaba.
  - **Los títulos de clase que no eran de su medida, corregidos** («Corregirlos»): «Clas.
    RM» (la clase de la Altura) es «Clas. Altura»; «P. Rel. Clas» (la del RSI) es «Clas.
    RSI» (en Single Leg, «Clas. RSI PD» y «Clas. RSI PI»); en Single Leg, la clase del Pico
    de Fuerza PD es «Clas.PD», como su PI (decía «Pot. Clas PD»). Los demás, como el Excel.
  - Igual que en los otros tests (no se volvió a preguntar): las clases contra los V.R. de la
    categoría de cada fila; el % mejora contra la evaluación anterior por fecha que tenga el
    dato (el Excel miraba la anterior por su n°; con los datos de hoy da igual); sin una
    pierna, déficit y pierna vacíos; el informe sin datos queda vacío (el Excel mostraba
    #DIV/0! y 0); los formatos del informe, los del Excel; toda clase con los mismos colores
    (05/10): **en Single Leg, las clases no se pintaban en el Excel** (la regla devolvía el
    texto «Verdadero», como el negro de Tobillo en Funcional) y en la app se pintan como
    toda clase; el DEFICIT LATERAL no se pinta (como en el Excel); las letras de PD / PI /
    Sin Deficit, las de Curl Nórdico. El jugador se llama «Apellido» en el Excel: en la app,
    «Jugador», como en los otros tests (al pegar se entiende cualquiera de los dos).
  - Arreglado al pasar (a revisar con Santiago): algunos «% mejora» de Drop y Squat tenían
    formato General (0,05 en vez de 5,0%): van en %, como los otros; el Pico de Potencia de
    Single Leg cambiaba de formato de fila a fila («36,7» y «36,66666667»): va con uno.
  - Lo que no se copió: las columnas de ayuda para buscar (A y B, ocultas), el contador C,
    la columna H (sin título y vacía), las marcas «VA» sueltas de la fila 10, la cuenta suelta de ES19, la
    tablita suelta «Altura Cm / Pot. Rel. W/P.C.» de CV370:CW374 y la nota suelta de CW636
    (sobre las referencias «Profesional»); si sirven, se agregan.
  - Los V.R.: Countermovement, una tabla (`datos.categorias.<categoría>` con `altura`,
    `fuerza`, `potencia`, `rsi`, `n`, `promedio`, `desvio`, los cinco cortes y `titulo`);
    Single Leg, una por medida (`altura_pd`, `altura_pi`, `altura_deficit`, … y `titulos`
    por medida). Los nombres, los del Excel («Fuerza de caida (N)» y «Pot./Rel.» clasifican
    el Pico de Fuerza y el Pico de Potencia). Hoy solo Mayor. Van por SQL, como los otros.
  - **Pegar desde Excel**: se copia desde la fila 12 (títulos) hasta la última, desde la
    columna nº Eva hasta el final del bloque del test (o la hoja entera), sin filtros (el
    Excel está guardado con un filtro). Cada test busca su bloque por su lugar
    (`bloqueDeSaltos`): los bloques van de un «Altura» al siguiente; el que tiene «Va?» es
    Countermovement y los otros, Drop y Squat. Si se ve uno solo de Drop y Squat (el otro
    oculto), es Drop cuando es lo último que se pegó; si no, no se lee (nunca se cargan los
    datos de un bloque en otro test). Se saltean las filas sin medidas del bloque
    (`saltearFilasSinMedidas` con la lista: el P.C. está en los cuatro y no alcanza).
    **Decimales que no se ven** (el P.C., un RSI-modified y el Pico de Potencia de Single
    Leg): antes de copiar, desde la columna P.C. hasta el final, formato Número con 15
    decimales.
  - En el reporte individual van en «Potencia y velocidad».
  - Comprobado contra la hoja real (solo local): las celdas calculadas dan igual (1170 de
    Countermovement, 2912 de Single Leg y 24 de Squat; en Drop, con los V.R. de
    Countermovement como el Excel, sus 32 también); el n° de evaluación cambia solo en una
    fila de Drop y Squat (el primer salto de ese tipo del jugador: 1 y no 4); el informe con
    todas las filas, igual a las cuentas hechas aparte (360 celdas), y con las filas que dejó
    a la vista el filtro del Excel, igual salvo los #DIV/0! y 0 de las columnas sin datos
    (vacíos), con sus formatos; los colores, contra las reglas del Excel aplicadas aparte,
    iguales (5896 celdas) salvo las clases de Single Leg (1230, decidido arriba); pegada con
    la tabla a 15 decimales, entran las 241 filas exactas en los cuatro tests, también con
    Countermovement o Drop ocultos o copiando hasta el fin de Drop.
- Ya están todas las hojas del Excel. El motor suma lo que usen (detener si es verdad, SUBTOTAL 3, BUSCARX, COINCIDIR,
  CONTAR.SI.CONJUNTO). Cada uno entra en las pantallas de abajo (09/10): se carga en Cargar,
  se elige en la Base, va en los reportes y sus cabeceras y listas se cambian en Ajustes.
- **Las pantallas de Evaluaciones (Santiago, 09/10)**, como Lesiones (regla de «Bases de
  Datos»): Cargar · Base · Reportes · Valores de referencia · Ajustes.
  - **Cargar** (la primera, con la vuelta a Bases de Datos arriba): «Nueva evaluación» abre
    un formulario por pasos: primero el jugador, la fecha (hoy) y las listas sueltas (en
    Zona Media, Selección); después un paso por bloque de medidas (las columnas con el mismo
    grupo; las sueltas, juntas) y la nota al final. Los tiempos se escriben en minutos y
    segundos (3:04 o 3,04). Abajo, las evaluaciones de hoy, para corregirlas o borrarlas.
    **Reabierta el 18/10** (Santiago, «cargar una fila por jugador»): la carga nueva es de varios
    jugadores a la vez, el test y la fecha primero y una fila por jugador; el formulario por
    pasos queda solo para «Editar» (ver «Evaluaciones: cargar una fila por jugador», más abajo,
    y UI-055).
    En la Base ya no está «Agregar evaluación» (descartado: no volver a ponerlo ahí).
    Isocinecia no está en Cargar: sale del PDF del equipo (Santiago, 09/10; ver Isocinecia,
    más abajo).
  - **El test se elige en un desplegable** («Test»), el mismo en Cargar, Base, Reportes ›
    Grupal, Valores de referencia y Ajustes › Cabeceras (Santiago, 09/10: «Que la eleccion
    de test sea un desplegable, no pongas todas las evaluaciones como opciones sueltas»).
    Descartado: un botón por test (no volver a ponerlo, tampoco como pestañas).
  - **Base**: una sola, con el test arriba para elegir. El informe del Excel (promedio,
    desvío, n, máximo, mínimo y la comparación «Vs …») queda arriba de la tabla, como en la
    hoja (Santiago, 09/10: «Base y Grupal»). Se corrige en la tabla y se pega desde Excel.
  - **Reportes**, para imprimir; calculan con lo mismo que la Base (`motor.js`,
    `vistaDeFilas`; `celdas.js`).
    - **Individual** (Santiago, 09/10: «un jugador, todos los tests», y después: «para los
      reportes individuales podes guiarte por esta imagen»; la imagen, una ficha de
      «Performance» de un jugador, no va al repositorio). Arriba, como el de Lesiones: el
      escudo, el club · Performance, el nombre, Categoría (la Selección de su última
      evaluación), Última evaluación, Nº evaluaciones (los días con alguna) y la foto de
      Datos básicos. Abajo, por área (barra negra), cada test con sus evaluaciones y todas sus
      columnas (regla de «Bases de Datos» del 09/10): las últimas 5, de la más vieja a la más
      nueva, cada fila con su desplegable (n° · fecha) para poner otra; las que ya están a la
      vista no se repiten. Los colores, los de la Base filtrada por el jugador. Primero (el
      mismo 09/10) había una tarjeta por test con solo la última evaluación, como la imagen:
      la reemplazó esta regla. Las áreas, como la imagen (Santiago, 09/10,
      `src/domain/evaluaciones/areas.js`): Zona Media (Zona Media y Funcional), Fuerza
      (Isocinecia y Press Plano), Potencia y velocidad (Saltos) y Funcionales (Curl Nórdico,
      Isoprone, Iso Aductor-Abductor y Sentadilla Incremental); cada test dice la suya
      (`area`) en su archivo. **Pendiente** (Santiago, 09/10: «yo después te los explico»): la «Clasificación
      general» y el puntaje y la palabra de cada área (cómo se calculan y con qué cortes); no
      se muestran hasta que se definan. Cambiar las áreas desde Ajustes, para después. Los
      tests de la imagen que no están en el Excel (aceleraciones, agilidad, Navette, RSA,
      movilidad, plataforma de fuerza) no se inventan.
    - **Grupal**: hoy, un test por categoría y fechas con el informe del Excel y sus
      evaluaciones. Santiago pidió (09/10) guiarse por la solapa «Reporte grupal» del Excel
      de evaluaciones, pero el `BD_evaluaciones.xlsx` que mandó no la tiene (9 hojas, sin esa):
      **pendiente** hasta que mande la versión con esa solapa.
    - **Gráficos: pendiente** (Santiago, 09/10: «después lo vemos»); no se muestra hasta que
      se defina qué gráficos van.
  - **Valores de referencia**: sigue siendo una pantalla aparte, la quinta (Santiago, 09/10:
    «Quinta pantalla aparte»), solo para mirar. (Desde el 14/10 ahí se cambian, se agregan y
    se borran, con historial; ver «Los V.R. se cambian: una solapa en cada base (14/10)».)
  - **Ajustes**, como Lesiones › Ajustes: Cabeceras (por test, el nombre de cada columna y
    de cada bloque en cada idioma, y esconder columnas de la Base, la carga y los reportes;
    Fecha, Jugador y Selección no se esconden: sin ellas no hay de quién, de cuándo ni
    contra qué V.R.) y Listas (Selección y las que traiga cada test: renombrar, esconder y
    agregar opciones; lo cargado no se pierde). Una categoría que suma el club no tiene V.R.
    hasta que se carguen: sus clases quedan vacías. El selector del informe dice «Vs» y el
    nombre del club si lo cambió. Pegar desde Excel también reconoce los nombres del club.
    **Reabierta el 18/10** (ver «Evaluaciones: la elección de test y las categorías de Datos
    básicos», más abajo, y UI-056): Listas se elige por test y Selección ya no está; las
    categorías son las de Datos básicos y se cambian allá.
    En la base: migración `supabase/migrations/20261015_evaluaciones_ajustes.sql` (tablas
    `evaluaciones_campos` y `evaluaciones_opciones`, una fila solo para lo que cambió el
    club; permisos como Lesiones › Ajustes). Sin esa migración la app sigue con los nombres
    del Excel y al guardar avisa que falta el SQL.
    **Las relativas toman el nombre de su absoluta** (Santiago, 13/10: «si la base
    (Cualquiera) tiene datos relativos, dentro de ajustes donde se cambian el nombre de las
    cabeceras solo se puede cambiar el nombre de las absolutas y las relativas pasan a tomar
    el nombre del absoluto pero dependiendo que sea se le agrega /Min o /PC»). En
    Evaluaciones, las relativas al peso corporal (P.C.) llevan «/PC»: en Curl Nórdico e
    Isoprone «L Rel» y «R Rel» de cada bloque (por ejemplo, «L MÁX/PC»), en Iso
    Aductor-Abductor «PD (REL)» y «PI (REL)» («PD (ABS)/PC» y «PI (ABS)/PC»), en Press Plano
    «Rel» («RM/PC») y en Sentadilla Incremental «Rel» y «Rel (vel)» («RM IND/PC» y «RM x
    Vel/PC»). En Ajustes › Cabeceras la relativa dice de quién toma el nombre y no se
    renombra (se puede esconder); al cambiar el de su absoluta, cambia sola, en los dos
    idiomas. Un nombre que el club le hubiera puesto antes a una relativa deja de usarse. Las
    clases («Clas. PD (REL)», «Clas. Grupo (Rel)»…), los V.R. y lo que no se calcula en la
    app (Peak TQ/BW y Work/BW de Isocinecia, que vienen así del PDF) no cambian. Descartado:
    renombrar una relativa por su cuenta (UI-029).
- **Pendiente: validar las evaluaciones nuevas contra las que ya están** (Santiago, 09/10:
  «TENER VALIDACIONES CUANDO SE METEN EVALUACIONES NUEVAS, XQ PUEDO CARGAR TODAS LAS
  EVALUACIONES QUE QUIERE X MAS QUE YA ESTEN EN LA BASE»). Hoy se puede cargar otra vez una
  evaluación que ya está, desde Cargar o con Pegar desde Excel: al pegar, «Ya está» solo
  reconoce la que tiene el mismo jugador, la misma fecha y exactamente los mismos valores
  (con otros decimales, o con un valor corregido, entra como nueva). Falta decidir con
  Santiago qué cuenta como repetida (por ejemplo, mismo jugador, mismo test y misma fecha) y
  qué hace la app (avisar y dejar elegir, o no dejar). No se implementa hasta que lo decida.

## GPS (10/10)

Santiago subió el Excel del GPS del club (la hoja `BD_GPS`, con las hojas que la acompañan) y la
plantilla con la que hoy arma lo de cada día antes de pegarlo en la base (`Original Suma de
Bloques_CAM_nuevo.xlsm`). Es la tercera base de Bases de Datos, con su permiso propio (`gps`).
Los archivos no van al repositorio (nombres de jugadores y datos del club).

### Los pasos (Santiago, 10/10), un PR cada uno

1. **Base, historial y Ajustes** (hecho el 10/10, migración `20261016_gps.sql`): el permiso, la
   Base con su período, traer el historial con Pegar desde Excel y los Ajustes (columnas y
   listas, también los dispositivos).
2. **Cargar** (hecho el 12/10, migración `20261020_gps_reglas.sql`; abajo, «Cargar (paso 2)»):
   lo de cada día, con la lógica de la plantilla. Primero con el CSV de Catapult; después,
   traerlo directo de OpenField (paso 5).
3. **Reportes**. 15/10: el Informe (Por microciclo, Por tarea y Por jugador), ver «Informe:
   Por microciclo, Por tarea y Por jugador (15/10)». Por microciclo, hecho el 15/10 (la solapa
   Reportes, UI-038); Por tarea y Por jugador, el 16/10 (ver «Por tarea (16/10)» y «Por
   jugador (16/10)»). El Reporte individual y el Reporte grupal del Excel, el 16/10, dentro de
   Informe (ver «Reporte individual y Reporte grupal (16/10)»).
4. **V.R. por dispositivo**: se arman una vez con reglas estadísticas y quedan fijos (Santiago,
   10/10: «Los VR se arman una ves con reglas estadisticas y se dejan fijos»; las reglas las
   explica él más adelante). Cada dispositivo tiene los suyos («Exacto»). No inventar reglas ni
   valores mientras tanto; los valores, como en Evaluaciones, por SQL en el chat. (14/10: se
   ven, se cambian, se agregan y se borran en GPS › Valores de referencia, y cada dispositivo
   marca su V.R. de partido; ver «Los V.R. se cambian: una solapa en cada base (14/10)». Las
   reglas estadísticas para armarlos siguen pendientes.)
5. **OpenField directo**: probar en la actividad 26-05 T, sin inventar direcciones de la API.
   Nota de Santiago (10/10): ver si desde la API se puede descargar el CSV; «hay varias maneras
   de descargarlo xq se puede descargar con variables de otra persona o todas las variables».

Como pide la regla de las bases (UI-012), cuando estén los pasos 2 y 3 la barra queda Cargar ·
Base · Reportes · Ajustes (y los V.R. donde se decida en el paso 4). Desde el 12/10: Cargar ·
Base · Ajustes, y abre en Cargar (como Evaluaciones). Desde el 15/10: Cargar · Base · Reportes ·
Valores de referencia · Ajustes (como Evaluaciones). El mismo 15/10, Santiago: «cambiale el nombre
por Informe»: en GPS la solapa se llama **Informe** (en portugués, Relatório): Cargar · Base ·
Informe · Valores de referencia · Ajustes. Lesiones y Evaluaciones siguen con «Reportes» (no se
pidió).

### Decisiones de Santiago (10/10)

- **Dispositivo**: en el Excel las filas de los microciclos hasta el 16 se pintaban contra una
  tabla aparte («Tabla para microciclo <=16») porque cambiaron de dispositivo. Eso se saca y va
  una columna **Dispositivo** («podriamos sacar eso y dejar una columna que regitre el tipo de
  dispositivo»). El historial: hasta el microciclo 16, Sport; del 17 en adelante, Catapult («hasta
  el 16 ponele sport y del 17 en adelante Catapult»). Los dispositivos son una lista del club
  (Ajustes › Listas › Dispositivo).
- **Colores**: cada fila se pinta contra el promedio y el desvío de las filas a la vista **de su
  mismo dispositivo** («Las de su dispositivo»). Con las filas viejas (Sport) da igual que el
  Excel; las del microciclo 17 en adelante cambian de color en algunas celdas, porque el Excel
  las comparaba contra todas (también las de Sport).
- **Columnas**: «tiene que poder añadirse columna como quitarlas, las que yo quiera sin
  problema» (regla). En Ajustes › Cabeceras se renombra, se esconde («quitar» es esconder: lo
  cargado no se pierde y vuelve a verse) y se suman columnas del club (número, texto, duración
  u hora del día; van al final y al pegar se reconocen por su nombre). Nombre y Fecha no se
  esconden. «Esfuerzo Explosivo/min» no se usa y se va a sacar: lo esconde el club en Ajustes.
  Los **por minuto** toman el nombre de su medida con «/min» (Santiago, 13/10, la misma regla
  que en Evaluaciones: «las relativas pasan a tomar el nombre del absoluto pero dependiendo que
  sea se le agrega /Min o /PC»): si el club llama «Distancia» a «Distance (km)», su por minuto
  es «Distancia/min». En Ajustes › Cabeceras solo se renombran las medidas; el por minuto dice
  de quién toma el nombre y se puede esconder. Se escribe «/min» en minúscula, como 9 de los
  10 por minuto del Excel (el décimo, «Mts >= 90% Pico/Min», queda «/min»); si se prefiere
  «/Min», es cambiar una letra. Al pegar se siguen reconociendo los nombres del Excel. GPS ›
  Cargar también muestra los nombres del club. Descartado: renombrar un por minuto por su
  cuenta (UI-029).
- **La Base muestra un período** («Un período, se cambia»): Desde y Hasta arriba; al abrir, las
  últimas 4 semanas con hoy. El informe de arriba, los filtros y los colores van sobre eso.
  **Reabierto el 14/10**: la Base abre con todas las filas y ya no tiene Desde ni Hasta
  arriba (se filtra con el embudo de cada columna). Ver «Todas las filas al abrir (14/10)», más
  abajo.
- **Los «por minuto»** se traen como están en el Excel; si en la app se cambia una medida o el
  Tiempo de una fila, se recalcula su por minuto (medida ÷ minutos, como la plantilla). Un por
  minuto no se escribe a mano.
- **El historial se trae tal como está**: también los Team Average (Parcial y Sesion), los
  totales y lo que se cambió a mano en el Excel.
- **Errores chicos del Excel** (de la hoja y de la plantilla): se corrigen («Corregirlos»). Lo
  que quedó corregido en la Base está abajo.
- De la plantilla, «Pegado total manual» y «Parciales (en construcción)» no van.
- **Carga (para el paso 2)**: lo de la tarea y del día se escribe una vez por tarea («Una vez
  por tarea»); si un jugador tiene otro valor, se cambia solo el suyo.
- **Promedio del equipo (para el paso 2)**: con la lógica de la plantilla. Quien no entrenó
  nunca cuenta y Sesión + Regenerativo siempre cuenta, «como pasa hoy» (Santiago eligió primero
  «Siempre 30%» y lo cambió al ver que en la práctica la fórmula del Excel nunca los cuenta).
  Los cortes (30 % y 7) van en Ajustes, apagados.

### La Base (paso 1)

- Las columnas de `BD_GPS` en su orden (`src/domain/gps/columnas.js`, todo lo de cada una en un
  solo lugar), más Dispositivo al final y las que sume el club. Microciclo, Nombre y Puesto
  quedan fijas en la compu. Los nombres son los del Excel (las medidas, los de la fila 17,
  «14,4-25Km/h»; lo demás, los de la fila 18). Algunas columnas del Excel se llaman distinto de
  lo que guardan (por ejemplo, «Esfuerzo Explosivo/min» guarda «RHIE Effort Duration - Max» de
  Catapult): quedan con el nombre del Excel y el club las renombra en Ajustes.
- Arriba, el informe del Excel (filas 2 a 10) con lo que deja ver el filtro: Excelente
  (promedio + 2 desvíos), Muy Bueno (+ 1), Promedio/Bueno, Regular (− 1), Malo (− 2), Desvío, n,
  Máx. y Mín. En un por minuto, el promedio es el de la medida ÷ el de los minutos (como el
  Excel). Con más de un dispositivo a la vista, un informe por dispositivo, con su nombre, en el
  orden de su lista. (Hasta el 14/10: ahora arriba van solo el Promedio, el V.R. y el % vs V.R.
  de cada dispositivo, y las Comparaciones; ver «Arriba de la Base: promedio, V.R. y % (14/10)»,
  más abajo. Los colores no cambiaron.)
- Colores (D19:X30002 del Excel: de D a Tiempo): mayor que Excelente, verde oscuro; de Muy Bueno
  a Excelente, verde claro; de Promedio a Muy Bueno, amarillo; de Regular a Promedio, naranja;
  menos que Regular, rojo. En Nombre, el Team Average de una tarea va en amarillo, el de un
  tiempo de un Partido Oficial Torneo en gris y el de la sesión en rojo claro. Solo el fondo,
  como el Excel (sin negrita). (15/10: los mismos colores, más suaves, UI-040.)
- Se corrige en la tabla (Nombre se elige: un jugador o un Team Average), se borran filas
  (también varias, con Shift) y quien ya se fue del club ve la foto de su último día sin cambiar
  nada. Un período tiene miles de filas (en el historial, unas 2.000 cada 4 semanas): la tabla
  dibuja solo las que se ven (`muchasFilas` en `src/components/TablaDatos.jsx`, solo en GPS; las
  otras bases siguen igual). Elegir, copiar, pegar, filtrar y el informe siguen con todas.

### Muchas filas (11/10)

Con el historial pegado (unas 15.000 filas) la Base tardaba en traer, en cambiar una celda y en
borrar. Santiago (11/10): «de la manera mas comoda para que cuando se quiera ver algo en la base
no se trabe con muchas filas, si hay que pagar lo hacemos».

- **Qué se trae lo decide la base**: arriba, además de Desde y Hasta, **Jugador** (todos, el Team
  Average o uno) y **Dispositivo** (todos, uno o sin dispositivo). La base filtra antes de mandar:
  no se baja lo que no se pidió. Los filtros de cada columna de la tabla siguen mirando lo traído.
  (Hasta el 14/10: ahora se traen todas y los cuatro filtros de arriba se sacaron; ver «Todas
  las filas al abrir (14/10)».)
- **Más de 20.000 filas** (más o menos una temporada; `MAXIMO_SIN_PREGUNTAR` en `src/Gps.jsx`): no
  se traen sin preguntar. En lugar de la tabla, la Base dice cuántas son y deja acortar las fechas,
  elegir un jugador o un dispositivo, o «Traer igual». Cambiar qué traer vuelve a preguntar.
  (Hasta el 14/10: ya no se pregunta; ver «Todas las filas al abrir (14/10)».)
- **Más rápido** (comprobado con 14.000 filas inventadas, la app compilada y 150 ms de demora por
  pedido): ver todo el historial, de 8,5 s a 1,7 s; cambiar una celda, de 3,6 s a 0,6 s; borrar
  una fila, de 7,4 s a 0,6 s; borrar 24 juntas, de no terminar a 0,9 s. Cómo:
  - las fechas se escriben con un solo formato por idioma (`fechaCorta` en
    `src/idioma/formatos.js`: armar el formato en cada celda era lo más lento, en toda la app);
  - cada fila de la tabla se arma una vez: al cambiar o borrar una, se arma solo esa;
  - el informe de arriba recorre las filas una vez (no una por columna) con las mismas cuentas en
    el mismo orden (da igual al último decimal: comprobado otra vez contra el Excel real), y los
    colores de cada fila se calculan cuando la fila se dibuja;
  - la primera página dice cuántas filas son y las demás se piden de a cuatro a la vez;
  - se borran de a 100 por pedido (antes, de a una); al pegar en la tabla, se guardan de a seis
    filas a la vez y la tabla se redibuja una vez al final;
  - la tabla dibuja 8 filas de más arriba y abajo de las que se ven (antes 20).
  En un celular (el procesador 4 veces más lento), con las 4 semanas de entrada: elegir una
  celda 0,3 s y cambiarla 1 s.
- **Lo que viaja**: todo el historial son unos 15 MB (unos 2 MB comprimido); 4 semanas, unos
  2 MB.
- **Lo que ocupa en la base** (medido en Postgres con 15.000 filas como las del historial): unos
  31 MB la tabla y 21 MB su copia para la foto de quien se va; unos 95 MB por año de GPS. El plan
  gratis de Supabase tiene 500 MB para toda la base: alcanza para varios años; si se llega cerca,
  el plan pago (8 GB) alcanza para mucho más. Pagar no hace falta para la velocidad.
- Los Reportes (paso 3) van a hacer las cuentas de muchos años en la base, sin traer las filas.
- **El permiso, una vez por pedido (12/10, migración `20261019_gps_rapido.sql`).** Santiago,
  12/10: del 15/01 al 12/10 la Base decía «No se pudo leer el GPS» (con permiso de GPS: «si
  tiene permiso para ver gps tiene que cargarlas»). Era la base: las políticas de la tabla
  revisaban el permiso de la cuenta en cada fila (`puede_usar_en` + `puede_editar`) y, como
  cada página de 1000 se ordena entre todas las del período, con unas 16.000 filas cada página
  tardaba unos 3 s (medido en un Postgres con todas las migraciones) y en Supabase se pasaba
  del tiempo máximo. Ahora las políticas miran si la fila es de un club de
  `clubes_donde_puedo('gps')` (las mismas funciones, una vez por pedido): cada página, unos
  15 ms; contar, unos 10 ms. Quién ve, carga, cambia y borra no cambió (los escenarios del GPS
  pasan igual). Las otras tablas siguen como estaban (tienen pocas filas).
- **Lo cambiado, sin recorrer toda la tabla (19/10, migración `20261106_gps_indice_cambios.sql`).**
  Santiago, 19/10: «para solucionar la lentitud con las 15,000+ filas»; en un cuestionario, sobre
  el índice para «lo que cambió»: «Sí, agregalo».
  - **Qué se midió en la base del club** (solo lectura, 19/10; 16.103 filas de GPS, todas de un
    club). Al abrir la Base con la copia del aparato, el pedido de lo cambiado desde la última
    vez (`ponerAlDiaGps`) tardó de 1,2 a 1,6 s las tres veces de esos dos días, aunque traía de
    81 a 274 filas. No tenía un índice: la base recorría todas las filas del club. Lo normal es
    que eso tome de 8 a 15 ms, pero cuando el servidor está lento ese recorrido es lo que más se
    estira.
  - **Las reglas no eran la causa.** El mismo pedido tarda unos 15 ms con las reglas y unos 8 ms
    sin ellas. Una página de 1000 filas por fecha usa `gps_por_fecha`, con las reglas y también
    en el plan que Postgres reusa entre pedidos.
  - **El índice nuevo:** `gps_por_cambio (equipo_id, actualizado_en, id)`. Ahora se leen solo
    las filas cambiadas, ya en orden. Medido en Postgres con 16.000 filas inventadas y las
    reglas puestas: de 11,3 ms a 1,9 ms, leyendo 130 páginas en vez de 3.211. Ocupa
    aproximadamente 1 MB. Una prueba de los escenarios comprueba que ese pedido lo usa sin
    ordenar aparte.
  - **No se agregó un índice `(equipo_id, id)`** (opción del mismo cuestionario, no elegida).
    Medido igual: Postgres no lo usa, porque con todo el GPS de un solo club leer la tabla entera
    sigue siendo más rápido. Pedir todos los id tardó 92 ms sin el índice y 88 ms con él.
  - **No cambió:** quién ve, carga, cambia y borra; las reglas; los datos; la app. Lo que tarda la
    primera vez en un aparato (bajar todas las filas) tampoco cambia con este índice.

### Todas las filas al abrir (14/10)

Santiago, 14/10 (nota de «Por hacer»: la Base de GPS con todos los datos al entrar), al
preguntarle cómo hacerlo: «Lo que sea mejor para poder abrir lo mas rapido posible todas las
filas que se tengan». Reabre UI-021: lo de abrir con las últimas 4 semanas, la base que filtra
antes de traer y la pregunta de más de 20.000 filas quedan reemplazados por esto.

- **Se ven todas las filas del club.** Ya no se pregunta antes de mostrar muchas filas.
- **Sin los cuatro filtros de arriba.** Santiago, 14/10: «Cuando subas todo a main tmb saca esos
  4 filtros de arriba de fechas, jugador y dispositivo». La Base ya no tiene la tarjeta con
  Desde, Hasta, Jugador y Dispositivo (ni su texto de ayuda): se filtra con el embudo de cada
  columna de la tabla (Fecha, Nombre, Dispositivo y las demás), en el aparato y al instante. El
  informe de arriba y los colores salen de lo que dejan ver esos filtros, como antes. Arriba, en
  lugar del período, va la fecha de hoy, como en Cargar y en las otras bases; al lado, cuántas
  filas tiene el club. Descartado: volver a poner esos cuatro filtros arriba de la tabla.
- **Una copia en cada aparato** (`src/domain/copiaGps.js`, en IndexedDB: son miles de filas y no
  entran donde la app guarda lo demás). Una por cuenta y club. Con la copia, la Base abre al
  instante y después se trae de la base solo lo cambiado desde la última vez (con 10 minutos de
  margen, por si dos aparatos guardan casi juntos) y se cuenta cuántas hay: si alguien borró
  filas, se piden los id y se sacan; si faltan filas que la copia no tiene, se trae todo de nuevo
  (`ponerAlDiaGps` en `src/domain/gpsDb.js`). Lo mismo cuando otro carga o cambia algo (en vivo),
  al guardar un día y después de pegar desde Excel. Si no se puede (sin señal), queda lo que se
  veía y se intenta la próxima vez.
- **La primera vez en un aparato** (sin copia): primero las últimas 4 semanas (se ven
  enseguida) y después las demás, de a 1000 filas por pedido, seis pedidos a la vez. Mientras
  llegan, un aviso dice cuántas van y que ya se pueden usar las de las últimas 4 semanas. Si las
  demás no llegan, se ven las 4 semanas con un aviso y «Reintentar»; la copia no se guarda hasta
  tener todo.
- **La copia se borra** al salir de la cuenta, cuando la cuenta deja el club, cuando el club pasa
  a la foto del último día y cuando la cuenta pierde el permiso de GPS en ese club. Quien ya se
  fue del club ve la foto de su último día, como antes, sin copia. Es una copia de lo que la
  cuenta ya puede ver: no cambia quién ve qué (los permisos siguen en la base).
- **La pantalla no se traba con miles de filas.** GPS abre en Cargar: mientras tanto, las filas se
  preparan para la tabla de a 300, sin trabar la pantalla, y la Base las arma solo cuando se ve.
  La primera vez, las de antes de las 4 semanas se preparan antes de sumarlas a la tabla.
- Al guardar un día se vuelve a la Base con todas las filas (antes se corría el período para que
  se viera el día).
- **Medido** (15.000 filas inventadas, la app compilada, 150 ms de demora por pedido; nada del
  club; desde que se toca Base). En la compu, tocando Base un segundo después de entrar a GPS:
  todas a los 0,3 a 0,6 s, con la copia o sin ella; tocándola apenas se entra, la primera vez
  las 4 semanas a los 0,1 a 0,4 s y todas a los 1,3 s, y con la copia todas a los 0,7 a 0,8 s.
  En un celular (el procesador 4 veces más lento), tocando Base unos segundos después de entrar:
  todas en 1,2 a 1,3 s, con la copia o sin ella. Tocándola apenas se entra, en ese celular la
  primera vez se ven las 4 semanas a los 1,3 a 1,8 s y todas a los 4,7 s; con la copia, todas a
  los 3,6 s, con la pantalla trabada unos 2,7 s esa primera vez que se abre la Base (después,
  no). Lo que queda es armar y dibujar la tabla con 15.000 filas en ese celular.
- No cambió: cómo se carga un día, cómo se pega, cómo se cambia o se borra una fila, el informe,
  los colores, las cuentas, los permisos ni la base (no hace falta SQL).

#### Pendiente determinante: años de historial (14/10)

Santiago preguntó qué pasa con un club que quiere guardar años de información y, al ver lo
medido, pidió: «dejalo como pendiente pero como algo determinante y muy importante, por ahora
segui con las notas». **Nada decidido todavía**: hasta que lo decida, la Base sigue abriendo con
todas las filas.

- **Medido** (filas inventadas con todas las columnas, unas 54 celdas cada una, como el
  historial real; unas 20.000 filas por temporada, como el historial del club, que tiene unas
  15.600 del 15/01 al 12/10; la app compilada, 150 ms de demora por pedido; desde que se toca
  Base; nada del club):

  | Historial | Compu, primera vez | Compu, con la copia | Celular lento (×4) | Memoria |
  |---|---|---|---|---|
  | 1 temporada (15.000 filas) | 1,3 s | 0,7 s | algo más de 1 s | 150 MB |
  | 3 temporadas (60.000 filas) | 8 s | 4,4 s | 26 a 29 s, trabado hasta 25 s | 580 MB |
  | 6 temporadas (120.000 filas) | 17 s | 13 s, trabado casi 10 s | no medido | 1.150 MB |

  La copia en el aparato ocupa unos 7 MB por temporada en el disco: no es el problema. Lo que
  limita es la memoria: con 6 temporadas la página usa más de 1 GB y un celular suele cerrar
  una página así.
- **La base del club sí aguanta años**: el GPS ocupa unos 95 MB por año («Muchas filas
  (11/10)»). El plan gratis de Supabase tiene 500 MB para toda la app (unos 4 años de GPS);
  después, el plan pago (8 GB).
- **Opciones presentadas (14/10), sin elegir:**
  1. Dejarlo como está: con una temporada anda bien; desde 2 o 3, cada vez más lento, y el
     celular se complica.
  2. Abrir con la temporada actual (los últimos 12 meses) y un botón «Ver temporadas
     anteriores» que las suma cuando se piden. Todo sigue en la base. Cambia lo pedido el 14/10
     («todas las filas») y se parece a los filtros sacados ese día: lo decide Santiago.
  3. Aligerar la tabla: el texto de cada celda solo para las filas que se ven (estimado: más o
     menos la mitad de tiempo y memoria; sin medir). Toca la tabla compartida con Lesiones y
     Evaluaciones y con 6 temporadas no alcanza para el celular.
  4. Las cuentas de varios años, en la base: los Reportes del GPS (paso 3) calculan sin bajar
     las filas.
  Propuesta de Claude: la 2 y la 4 juntas; la 3 solo si hace falta. No está aprobada.

### Arriba de la Base: promedio, V.R. y % (14/10)

Nota del 12/10: «Sacar de gps todas las filas de arriba y solo dejar las de promedio por
dispositivo y agregar todos los vr de gps asi como los % vs vr de partido». Santiago, 14/10, a
las preguntas: de dónde salen los V.R., «Revisa la base de gps y te vas a dar cuenta de donde
salen y son los mismo que hay que traer»; los colores, «Como hoy»; el resumen, «Como esta hoy
en el excel mismo sentido»; los V.R. por dispositivo, «Cada uno tiene el suyo»; cuántos, «Dos,
como el Excel»; cuál es de cuál, «Futbol 2 es de sport y el otro es de catapult»; y el diseño
propuesto, «Sí, uno por dispositivo».

- **Arriba de la tabla, tres filas por dispositivo** (con más de uno a la vista, cada una con
  su nombre, en el orden de su lista): **Promedio** (el de lo que deja ver el filtro, la misma
  cuenta de antes), **V.R.** (el promedio del V.R. elegido para ese dispositivo) y **% vs
  V.R.** (Promedio ÷ V.R., en cada columna que tiene V.R.; sin V.R., vacías). Como las filas 13,
  12/14 y 15 de la hoja de la Base del Excel.
- **Ya no van** Excelente, Muy Bueno, Regular, Malo, Desvío, n, Máx. y Mín. Los colores de las
  filas siguen igual («Como hoy»): se siguen calculando con el promedio y el desvío de lo que se
  ve de cada dispositivo, aunque esas filas no estén. Descartado: volver a mostrar esas filas.
- **De dónde salen los V.R.** En el Excel, cada fila del V.R. busca en la hoja de los valores
  de referencia el PROM de un tipo, una tabla y un grupo: con Sport, FUTBOL · FUTBOL 2 · TOTAL
  FUTBOL; con Catapult, FUTBOL · Oficial EdLP · TOTAL FUTBOL. En esas dos tablas solo el grupo
  TOTAL FUTBOL tiene números (las posiciones están vacías). Van con todos sus decimales.
  Comprobado contra el Excel (en esta máquina, nada se sube): con los mismos promedios, el %
  contra el V.R. de Sport da lo mismo que el Excel en las 19 columnas.
- **Dónde se guardan**: en la tabla `gps_referencias` (migración `20261024_gps_referencias.sql`):
  una fila por V.R. del club, con su dispositivo (el código de la lista Dispositivo), el tipo
  (FUTBOL, DINAMICA, REDUCIDO), la tabla, el grupo, el promedio y el desvío de cada columna. Los
  ve quien tiene GPS en el club (también quien se fue, para mirar); nadie los cambia desde la
  app (editarlos es la nota de los Valores de referencia; desde el 14/10 se cambian en GPS ›
  Valores de referencia); anon, nada. Los números los pasa
  Claude por SQL en el chat (no van en el código). El SQL los pone solo en el club que tiene
  filas tomadas con Sport (el del historial del Excel), en el dispositivo de su lista que se
  llama Sport o Catapult.
- **Comparaciones** (la fila 16 del Excel), en un recuadro arriba de la tabla, una parte por
  dispositivo: qué V.R. usa (un desplegable con «tipo · tabla · grupo»; de entrada, el primero)
  y cinco números: **Volumen promedio** (el promedio de los % de D a > 45 W/PC, sin Mts >= 90%
  Pico), **Volumen zona de impacto** (el de las columnas de la zona elegida), **Densidad
  promedio** y **Densidad zona de impacto** (lo mismo con las por minuto) y **Tiempo** (el % del
  Tiempo). La **zona de impacto** se elige arriba (Fuerza, F-M, F-V, Metabólica, V-M, Velocidad
  o Tarea Mixta, con las columnas de la tabla del Excel; Tarea Mixta, todas; de entrada, Tarea
  Mixta). Lo elegido se recuerda en cada aparato, por club. Cada % sale con las columnas que
  tienen V.R. aunque estén escondidas, como el Excel.
- **Diferencias con el Excel, a la vista**: las Comparaciones van en un recuadro y no en una
  fila de la tabla (en el celular se leen sin correr la tabla de costado); el V.R. se elige en
  un solo desplegable por dispositivo (en el Excel, el tipo, la tabla y el grupo en tres
  celdas). Los números son los mismos.
- **Sin la migración** el recuadro dice que falta una actualización de la base; **sin V.R.**
  para un dispositivo, que todavía no tiene; las filas sin dispositivo, que no tienen V.R. En
  esos casos las filas V.R. y % quedan vacías. En el celular, los cinco números van en una lista
  corta; en la compu, en cinco tarjetas.
- **Para decidir**:
  - Las otras tablas de los valores de referencia con algún número (FUTBOL 3, FUTBOL 17 a
    medias, REDUCIDO 9 y un número suelto en Individual) no se cargaron: no se sabe de qué
    dispositivo son. Se cargan cuando Santiago lo diga (o con la nota de editar los Valores de
    referencia).
  - El V.R. de partido de Ajustes › Reglas de carga (el que usa Cargar para el % vs V.R. de
    partido) y el V.R. «Oficial EdLP · TOTAL FUTBOL» de Catapult son los mismos números en el
    Excel y hoy están en dos lugares. Unirlos o no lo decide Santiago; por ahora no se tocó.
    (Decidido el 14/10: «Unirlos»; ver «Los V.R. se cambian: una solapa en cada base (14/10)».)
- No cambió: la Base (filas, columnas, filtros, colores, edición, borrado, pegar, la copia en el
  aparato), Cargar, Ajustes, los permisos ni las cuentas de las filas.

### Los V.R. se cambian: una solapa en cada base (14/10)

Santiago, 14/10, al ver los V.R. de GPS arriba de la Base: «pero no puedo editar nada del vr,
ademas acordate que todos los vr van aparte». A las preguntas: qué V.R. van, «Todos los vr
tienen que tener su solapa aparte»; quién los cambia y borra, «siempre que se tenga acceso a las
bases y permisos para editarla»; el historial, «Sí, con volver atrás»; el V.R. de partido de
Reglas de carga y el de Catapult (los mismos números), «Unirlos». Después, entre «una solapa en
cada base» y «un módulo Valor Referencial con una solapa por base», eligió **una en cada base**;
con qué V.R. calcula Cargar el % de partido, «El de partido de cada dispositivo»; cuándo se elige
el dispositivo en Cargar, «Al subir el CSV»; y cómo se ve la solapa de GPS, «Como esta en
evaluaciones».

- **Dónde**: GPS suma la solapa **Valores de referencia** (Cargar · Base · Valores de referencia ·
  Ajustes); la de Evaluaciones (la quinta) deja de ser solo para mirar. No hay módulo propio en
  el portal (descartado en esa elección). La referencia de Lesiones (la del plantel) se calcula
  sola y no está en esto.
- **GPS › Valores de referencia** (`src/ReferenciasGps.jsx`): arriba se elige el dispositivo;
  cada V.R. suyo es una tarjeta, como las de Evaluaciones, con su tabla: Promedio y Desvío de
  cada medida (las de la hoja de los V.R.: de D a Mts >= 90% Pico, sus por minuto y el Tiempo,
  con el nombre que les puso el club). Los por minuto se ven con dos decimales (son chicos).
  Cada tarjeta: «Usar de partido» (o «Dejar de usar de partido»), «Cambiar nombre» (tipo, tabla
  y grupo) y «Borrar» (pregunta antes); abajo, «Agregar V.R. de (dispositivo)».
- **Evaluaciones › Valores de referencia** (`src/ReferenciasEvaluaciones.jsx`): los bloques por
  categoría y el resumen, como estaban; se cambian sus números (también el n del resumen; «Pro»
  sigue vacía y no se cambia), se agrega una categoría (vacía, para cargarla) y se borra una
  (pregunta antes; en todas sus tablas).
- **Cómo se cambia un número**: como en las bases, dos toques (o doble clic, o Enter) en la
  celda, se escribe como se ve (los tiempos, «3:10» o «1:30:00»; los %, con o sin %) y Enter (o
  tocar afuera) lo guarda; Esc no cambia nada; lo que no se entiende no se guarda y se avisa.
  Se guarda solo ese número, en la base (`gps_referencia_cambiar` y
  `evaluaciones_referencia_cambiar`): dos personas a la vez no se pisan. Lo que lo usa (las
  clases, los colores, los %) se recalcula solo.
- **Quién**: quien tiene esa base en el club y sigue en él (las políticas de las dos tablas).
  Quien ya se fue, los mira; anon, nada. Sin señal, se miran.
- **Historial con «Volver»** (`referencias_historial`, lo anota la base, también lo que se
  cambie por SQL): abajo de la solapa, los últimos cambios del dispositivo o del test elegido,
  con quién y cuándo, y qué cambió («FUTBOL · Oficial EdLP · TOTAL FUTBOL · D (Promedio):
  5000,0 → 5100,0»; «Mayor · Bueno · Lumbar: 2:50 → 3:00»). «Volver» deja lo cambiado como
  estaba; lo borrado vuelve; lo agregado se borra. Lo ve quien puede cambiar esos V.R.
- **El V.R. de partido**: cada dispositivo marca uno («De partido»; uno como mucho). Cargar
  calcula el % vs V.R. de partido de cada bloque con el del dispositivo de la carga; si no
  tiene, lo dice y dónde se marca. El dispositivo se elige **en el primer paso de Cargar**, al
  lado de la fecha (sin él no se sigue); en la sesión se ve y se puede cambiar. Reglas de carga
  ya no tiene el V.R. de partido.
- **Lo que tenía cada club en Reglas de carga** (migración `20261025`): pasa a cada dispositivo
  del club que no tenga uno de partido, con los mismos números, como «PARTIDO · V.R. de partido
  · TOTAL», y sale de las reglas (un club sin dispositivos lo conserva ahí). Así Cargar da lo
  mismo que antes. En el club, el SQL de los V.R. deja «Oficial EdLP · TOTAL FUTBOL» como el de
  partido de Catapult (la copia se borra: son los mismos números) y, en Sport, la copia queda
  de partido, después de FUTBOL 2.
- **Sin la actualización** (la app publicada antes de correr el SQL): los V.R. se miran y no se
  cambian (lo avisa) y Cargar sigue con el V.R. de partido de las reglas, como antes.
- Lo que cambia otra persona aparece sin recargar (como en las bases).
- **Falta**: la planilla de valor referencial, para que la app calcule los V.R. con su lógica
  (hoy se escriben a mano); y qué dispositivo tienen las otras tablas con números (FUTBOL 3,
  FUTBOL 17, REDUCIDO 9, Individual): con la solapa, se pueden agregar a mano en el que
  corresponda.
- No cambió: la Base (lo de arriba, los colores, las Comparaciones), Evaluaciones (Base,
  Cargar, Reportes, clases), los permisos de las bases ni las otras reglas de la carga.

### Los V.R. por jugador, con sus cinco categorías (15/10)

Santiago, 15/10, sobre las franjas del Informe: «Cuando pones valor referencial el bueno pasa a
ser el bueno del valor referencial que se este usando, ya sea de jugador o partido o tarea y el
desvio arma las demas franjas, en el caso de jugador ya tiene las 5 categorias entonces no se
usa desvio»; y «TE DOY EL PERMISO DE QUE ENTRES AL EXCEL Y AGARRES TODOS LOS VR DE LOS JUGADORES
Y LOS PONGAS EN UN SQL PARA PODER CARGARLO».

- **Qué hay en el Excel**: tres tablas por jugador (el tipo dice «Microcilo»): «Microciclo 7
  dias TOTAL Abs y Rel» (31 jugadores con números; solo las medidas y el Tiempo), «Microciclo 7
  dias Promedio Abs y Rel» (31; también las por minuto) y «Partidos» (20 con números y 10
  vacíos). Cada jugador tiene Excelente, Muy Bueno, Bueno (el PROM), Regular y Malo; sus filas
  de desvío están vacías. En las dos de microciclo las cinco son el Bueno más y menos uno y dos
  pasos iguales; en «Partidos» no (las medidas son la por minuto por el tiempo, que no baja de
  95 minutos, y algunas por minuto tampoco van de a pasos iguales). Por eso se guardan las
  cinco tal cual, en vez de armarlas con promedio y desvío.
- **Dónde se guardan** (migración `20261026_gps_referencias_categorias.sql`): en
  `gps_referencias.categorias`, Excelente, Muy Bueno, Regular y Malo de cada medida; el Bueno es
  el promedio. Un V.R. sin categorías (los del club, como FUTBOL · Oficial EdLP) sigue con
  promedio y desvío. Cada número de una categoría se cambia como los demás
  (`gps_referencia_cambiar`, de a uno) y queda en los últimos cambios con «Volver». La
  migración `20261025` ya no se vuelve a correr después de esta (se frena sola).
- **GPS › Valores de referencia**: un V.R. con categorías muestra las cinco filas (Excelente,
  Muy Bueno, Bueno, Regular y Malo; el desvío, solo si tiene); los demás, Promedio y Desvío
  como antes. Los cambios dicen la categoría («… · D (Excelente): 11800,0 → 12000,0»). Con V.R.
  de más de una tabla en un dispositivo aparece el desplegable **Tabla** para ver una sola; de
  entrada, «Todas las tablas» (se ve como antes). El desplegable lo propuso Claude al cargar
  los 82 V.R. en Catapult: falta que Santiago lo confirme.
- **El SQL** (lo pasa Claude como archivo, no en el chat ni en el repositorio: tiene los
  nombres): 82 V.R. (31, 31 y 20), en **Catapult**: en el Excel se elegían en las celdas de
  «>=17 Microciclos» (los de Catapult; los de Sport, del 10 al 16, usaban FUTBOL 2). Solo en el
  club que tiene filas tomadas con Sport, en el dispositivo de su lista que se llama Catapult.
  Tipo «Microciclo» (el Excel dice «Microcilo»); la tabla y el jugador, como en el Excel; el
  tiempo, en segundos. Se puede volver a correr. Comprobado en la máquina de trabajo, nada al
  repositorio: los 6.395 números de esas tablas quedan iguales en la base.
- **Falta**: que Santiago confirme que las tres tablas son de Catapult (si alguna es de Sport,
  se cambia el SQL); agregar desde la app un V.R. nuevo con sus cinco categorías (hoy se agrega
  con Promedio y Desvío; las categorías llegan por SQL); y cómo las usa el Informe (en su PR).
- No cambió: los V.R. del club y su V.R. de partido, la Base (lo de arriba, los colores, las
  Comparaciones), Cargar, los permisos de las bases.

### Informe: Por microciclo, Por tarea y Por jugador (15/10)

Santiago, 15/10: «Vamos a armarlo en una misma pantalla, Cuando se entra hay 3 opciones Por
microciclo, Por tarea o Por jugador (cada una tiene que replicar exactamente lo que hace la
logica de cada una xq puede ser que alguna formula este mal) Una ves elegido alguna de las 3
opciones, entra a los filtros, se hacen los filtros que se van a querer ver y despues se le da a
siguiente Cuando se le da a siguiente te deja dentro de la que seria la solapa de informes
(PORFAVOR TIENE QUE TENER LOS MISMOS BOTONES Y LOGICAS QUE TIENE EL ARCHIVO, ES MUY IMPORTANTE
PARA MANTENER EL CORRECTO FUNCIONAMIENTO DE LOS DATOS) Si tenes alguna duda o mejora de diseño
tanto grafico o logico, me lo planteas y lo charlamos». Se hace de a una parte, un PR cada una:
primero Por microciclo; Por tarea y Por jugador, después, cada una con sus dudas.

Lo que respondió a lo planteado para **Por microciclo** (15/10):

- **El V.R. de los colores** (D1): no va una tabla por dispositivo («si quiero ver a un
  jugador a lo largo del tiempo no podria verlo facil»). Las tres celdas del Excel con las que
  se elegía el V.R. pasan a ser una sola que dice el nombre del V.R. con el que se pintan los
  colores, y un «+» para sumar otro V.R. («ya sea de otro dispositivo u otro vr guardado con el
  mismo dispositivo»), que se usa solo en los microciclos que le corresponden.
- **Los filtros** (D2, «si»): desplegables con casillas; sin nada elegido, todos; solo las
  opciones que tienen datos. **En el celular** (D3, «Si»): la tabla corre de costado con la
  primera columna fija.
- **Extras** (1): se saca por ahora («era para poder agregar mas tipos de variables»).
- **>30km/h** (2, «B»): es Mts >= 90% Pico (en el Excel quedaba vacía).
- **Las franjas con Valor Referencial** (3): el Bueno es el del V.R. que se usa (de jugador, de
  partido o de tarea) y el desvío arma las demás; el de jugador usa sus cinco categorías, sin
  desvío (ver «Los V.R. por jugador, con sus cinco categorías (15/10)»). En el Excel esas filas
  daban error.
- **Los microciclos viejos** (4, «B»): con el V.R. elegido para su dispositivo (en el Excel,
  los del 10 al 16 buscaban en FUTBOL 2 con el tipo y el grupo elegidos para los del 17 en
  adelante, sin usar sus propias celdas).
- **La carga crónica** (5, «A»): exactamente como el Excel.
- **Objetivo Sesión/Microciclo** (6): «Hay un modo de filtrar que si pinta dentro de por
  microciclo»: como el Excel, pinta con Microciclo/Jugador en Jugador.
- **Las franjas** (7, «No»): se ven siempre, sin pedir que se elija un filtro (en el Excel
  quedaban vacías con Microciclo, Fecha y Tipo de Sesión en «(Todas)»).
- **Los colores** (8, «Si»): los del Excel. (15/10: los mismos, más suaves, y en todas las
  columnas: ver «La presentación, los colores y ocultar», abajo.)

Lo que respondió a la segunda tanda (15/10, tarde):

- **N° Descanso** (1): «Los descansos si cuentan como sesion y los n de descansos se cuentan a
  partir de que en tipo de sesion siga descanso». N° Sesiones sigue contando los días de
  descanso; N° Descanso cuenta los días con Tipo de Sesión «Descanso» (el Excel contaba los de
  Tipo de Sesión vacío y daba siempre 0).
- **El desvío de las franjas con Mi selección** (2, «B»): cada microciclo cuenta una vez (el
  Excel contaba cada uno dos veces, por cómo arma su tabla dinámica, y le daba un desvío un poco
  más chico).
- **«Ver tabla» y «Volver»** (5): «Ok, pero solo deja un boton». Un solo botón pasa las franjas
  de arriba de un V.R. a otro de los que se están usando.
- Siguen abiertos: **Microciclo/Jugador en «Jugador»** (3, se le volvió a explicar) y **VS
  RIVAL** (4). Sobre VS RIVAL dijo: «Eso es xq toma la descripción donde la condicion sea total,
  asi se va si entro o jugo el partido completo». En el Excel, las filas del promedio del equipo
  de un partido tienen todas Condición Parcial: toma la 3.ª y la 6.ª descripción en el orden en
  que se cargaron, pensando que son los TOTAL, y en los microciclos 17 y 18 muestra un ST. Las
  filas de cada jugador con Condición Total son las que dicen TOTAL, PT, ST o SIN INGRESAR.
- Respondidos el mismo 15/10 («3. B», «4. Si»):
  - **Microciclo/Jugador en «Jugador»** (3, «B»): como el archivo, una fila por jugador con los
    microciclos elegidos juntos, pero las franjas salen de esas mismas filas (el archivo mezclaba
    esos totales con cada microciclo suelto) y la carga crónica es la del **último microciclo
    elegido** (el archivo usaba la del último cargado, aunque se eligiera otro): la U.A. del
    jugador en ese microciclo ÷ el promedio de la de ese y los 3 microciclos anteriores de la base
    (suma y media); vacía si le falta alguno o si no hay 3 anteriores. Descartado: una fila por
    jugador y por microciclo (la opción C) y la carga crónica del último microciclo cargado.
  - **VS RIVAL** (4, «Si»): en el promedio del equipo, el TOTAL de cada partido oficial del
    microciclo, en orden de fecha; en un jugador, su fila del partido con Condición Total y, si
    su Total junta el partido con otra cosa, su fila del partido de más tiempo. Descartado: la 3.ª
    y la 6.ª descripción en el orden de carga.

Queda prohibido en el Informe: una tabla por dispositivo para Por microciclo, volver a poner las
tres celdas del V.R., la opción Extras (hasta que Santiago la pida) y dos botones para pasar de
un V.R. a otro («Ver tabla» y «Volver»: va uno solo).

Lo hecho de **Por microciclo** (15/10; `src/ReportesGps.jsx`, el cálculo en
`src/domain/gps/porMicrociclo.js`, UI-038):

- **GPS › Informe** (se llamó «Reportes» hasta que Santiago pidió, el mismo 15/10, «cambiale
  el nombre por Informe»): «Ver informes» con Por microciclo, Por tarea y Por jugador; los dos
  últimos dicen «Todavía no está».
- **Los filtros** (paso 1 de 2): Microciclo, Fecha, Tipo de Sesión, Tipo Microciclo,
  Clasificación Días, Microciclo/Jugador y Nombre, cada uno un desplegable que abre la lista con
  casillas de las bases. Solo muestran lo que tiene datos con lo elegido en los demás (como las
  segmentaciones del archivo); lo elegido sigue a la vista. Al entrar, Microciclo/Jugador en
  «Sesión» (el promedio del equipo de cada microciclo, como se ve el archivo al abrirlo);
  «Limpiar filtros» los vacía todos, como el botón del archivo. Dice cuántas filas va a tener
  el informe y «Siguiente: El informe».
- **El informe** (paso 2 de 2): arriba, lo filtrado en una línea; Tipo de variable
  (Absolutas o Relativas), Visualización (Valor promedio, Valor suma, % del promedio o % de la
  suma; con Relativas, solo los dos promedios desde el 16/10) y Categorización (Mi selección o Valor referencial); el V.R. (de entrada, el del
  dispositivo del último microciclo, el elegido en la Base) y «+ Otro V.R.» (sin elegir
  microciclos, vale en los de su dispositivo; si se eligen, solo en esos), con un aviso si
  algún microciclo quedó sin V.R. La tabla, como las de los reportes: la cabecera oscura con
  los grupos en su tono, la primera columna fija al deslizar, la fila del V.R. y las franjas
  (Excelente a Desvío; el Bueno es el promedio, por eso no va otra fila de Promedio; **15/10**:
  arriba fue, a pedido de Santiago, una tarjeta con el promedio de cada columna, y el **16/10**
  se sacó, también a su pedido: ver «Las tarjetas con el promedio», abajo) y una fila
  por microciclo (o por jugador) con los colores de la U.A. y la carga crónica. Con más de un
  V.R., un solo botón («Ver las de …») pasa las franjas de uno a otro. (Desde el 15/10, otra
  presentación, todas las columnas pintadas y ocultar a mano: ver «La presentación, los colores
  y ocultar», abajo.)
- **Los filtros, también dentro del informe (16/10).** Santiago: «necesito que ahora la pantalla de filtros salga dentro de informes despues de la actual
  pantalla de filtrado, haces una flechita hacia arriba que diga filtros y eso revela los
  filtros pero no te saca de la pantalla, despues podes volver a ocultarlo tocando la misma
  flecha».
  El paso 1 (los filtros) sigue igual. En el informe, arriba, la tarjeta «Filtros» (una flecha
  para arriba y lo que se filtró) abre ahí mismo los mismos filtros, con «Limpiar filtros» y
  cuántas filas quedan; el informe cambia sin salir de la pantalla y, tocándola otra vez, se
  cierran (abiertos, la flecha mira para abajo; al entrar al informe, cerrados). Al cambiar
  los filtros ahí, los V.R. se revisan como al pasar de los filtros al informe: siguen si
  alguno vale para lo filtrado; si no, van los de entrada. «‹ Informe» vuelve a «Ver
  informes» (antes, «‹ Filtros» volvía al paso 1, saliendo del informe). Lo de la flecha que
  gira al abrir lo propuso Claude. Vale para los tres informes (Por tarea y Por jugador,
  cuando se hagan).
- **Las franjas de «Mi selección» y «Objetivo», de todo lo que se ve (16/10).** Santiago, con
  una captura (Jugador, Valor suma, Mi selección: casi todo «–» y sin color): «no se esta
  pintando con mi seleccion, pero si se pinta si uso vr, me parece que estas confundiendo las
  cosas: 1. Mi Seleccion: pinta por todo, no importa los microciclos (Su definicion es:
  Promedio de todo lo que estoy viendo y las categorias se arman con el desvio estandar de los
  datos que estoy viendo) 2. V.R: El bueno (Promedio) es el del V.R y las demas categorias se
  arman con el desvio estandar de ese V.R o si se tienen las 5 categorias se arman con eso y no
  con desvio (ahi si importan los microciclos xq no podrias m¡pintar con el V.R de catapult
  microciclos que esta marcados con otro dispositivo) 3. Objetivo Sesion: El promedio es el de
  el microciclo seleccionado y las demas categorias se arman con el desvio de los jugadores que
  esten filtrados»; y con otra captura (Relativas, Valor promedio, Mi selección: solo unos 0
  en rojo): «Esto tmb, que se pinta solo de rojo y nada mas una variable».
  Hasta ese día los índices y las variables salían de las filas de cada V.R. (una tabla de
  franjas por V.R., como el archivo con los microciclos 10 a 16): una fila sin V.R. (por
  ejemplo, un jugador de un dispositivo sin V.R. elegido) quedaba sin franjas y solo se
  pintaban sus 0, en rojo. Desde el 16/10:
  - «Mi selección»: unas solas franjas con todas las filas del informe, sin importar el
    microciclo ni el V.R. de cada una; se pintan todas las filas, también las que no tienen
    V.R. En los %, cada fila se divide por su propio V.R. (las que no tienen V.R. no tienen
    %, ni cuentan en esas franjas); cada índice (Volumen, Alta, Máxima…) sale de las filas
    cuyo V.R. tiene todas sus medidas, para que no se mezclen filas distintas en cada medida;
  - «Objetivo»: lo mismo con todas las sesiones de lo filtrado (el Bueno, el promedio del
    Team Average de cada sesión; el desvío, el de los jugadores de cada sesión), sin separar
    por V.R.;
  - «Valor referencial»: igual que antes, cada fila con las franjas del V.R. de su dispositivo
    (o de sus microciclos).
  Con un solo V.R. los números dan lo mismo que antes (el archivo usa un V.R. por tabla). Arriba
  de la tabla dice «Franjas de Mi selección» (o de «Objetivo…»); el nombre del V.R. y «Ver las
  de …», solo con «Valor referencial»; con «Mi selección» u «Objetivo» y más de un V.R., las
  franjas llevan una fila de V.R. por dispositivo, con su nombre («V.R. Catapult», «V.R.
  Sport»; si dos son del mismo dispositivo, el nombre entero del V.R.), porque cada fila del
  informe tiene el suyo. (Primero se había sacado la fila del V.R. en ese caso; se cambió el
  mismo 16/10 al revisar la «Preferencia visual» del sistema de diseño: no se ocultan datos
  útiles y cada % tiene que tener su referencia a la vista.) La U.A. y la carga crónica ya
  salían de todas las filas.
  Descartado: con «Mi selección» u «Objetivo», separar las franjas por V.R. o por dispositivo.
  Se preguntó el 16/10: (a) un jugador con microciclos de dos dispositivos tomaba, para sus %,
  el V.R. del dispositivo de su primera fila; (b) con «Objetivo» y jugadores elegidos en
  Nombre, el desvío sale de todos los jugadores de cada sesión (como el archivo), no solo de
  los elegidos. Lo que respondió y lo que se hizo, en «Objetivo, solo con jugadores; las
  franjas, con su botón; sin ocultar filas (16/10)», abajo.
- **Con «Relativas», sin Valor suma ni % de la suma (16/10).** Santiago: «si se filtra por
  relativo no puede haber en el filtro Suma y % Suma». Con Tipo de variable «Relativas»,
  Visualización ofrece solo Valor promedio y % del promedio; si estaba en Valor suma pasa a
  Valor promedio y, si estaba en % de la suma, a % del promedio (eso lo propuso Claude). Antes,
  con Relativas y una suma, las variables quedaban sin franjas ni colores. Descartado: Valor
  suma y % de la suma con «Relativas».
- **Objetivo, solo con jugadores; las franjas, con su botón; sin ocultar filas (16/10).**
  Santiago respondió en un cuestionario:
  - A qué V.R. usa, para sus %, un jugador con microciclos de dos dispositivos: «SI ES MI
    SELECCION NO USA VR, TE LO DIJE UN MILLON DE VECES, SON VISTAS SEPARADAS Y MANERAS DE
    PINTAS DISTINTAS MI SELECCION SOLO USA LO QUE ESTA FILTRADO Y EL DESVIO DE LO QUE ESTA,
    NADA MAS». «Mi selección» ya pinta así: sus franjas salen solo de lo que se ve (ver «Las
    franjas de «Mi selección» y «Objetivo»…», arriba). El número de cada % sí se divide por un
    V.R., con cualquier categorización: es lo que muestran «% del promedio», «% de la suma» y
    los índices. Un jugador con microciclos de dos dispositivos toma el del dispositivo de su
    último microciclo, como el archivo, que a los jugadores les pone el V.R. de los
    microciclos del 17 en adelante. Hasta ese día tomaba el de su primera fila. Lo decidió
    Claude siguiendo el archivo; si Santiago prefiere otra cosa, se cambia.
  - Objetivo en Por microciclo: «SI ESTAS EN POR MICROCICLO NO SE PUEDE PINTAR POR OBJETIVO
    SESION, DESAPARECE LA OPCION». Al preguntarle cuándo (el 15/10 había dicho «Hay un modo de
    filtrar que si pinta dentro de por microciclo»): «Solo pinta en caso de que solo haya
    jugadores y el color sale dependiendo de los microciclos elegidos y el modo de verlos
    (Suma: suma todos los valores de los microciclos seleccionados y de ahi sale el pintado,
    promedio es un promedio entre todos los microciclos seleccionados y asi con las otras que
    quedan)».
    - «Objetivo sesión/microciclo» aparece en Categorización solo cuando todas las filas del
      informe son jugadores: con «Jugador» en Microciclo/Jugador o con solo jugadores en Nombre.
      Si vuelven filas del equipo, la opción se va y queda «Mi selección». Se sacó el aviso
      sobre «Jugador» en Microciclo/Jugador.
    - El cálculo ya era ese: con «Valor suma», la suma del Team Average de las sesiones de lo
      elegido; con «Valor promedio», su promedio; con los %, lo mismo dividido por el V.R. de
      cada sesión.
    - El desvío sigue saliendo de todos los jugadores de cada sesión, como el archivo, aunque se
      elijan algunos en Nombre; así se pinta también con un solo jugador elegido. Santiago no lo
      respondió: si prefiere solo los elegidos, se cambia.
  - Si se saca la fila del V.R. con «Mi selección» y «Objetivo»: «No, dejalo srive para ver el vr
    sin necesidad de cambiar la manera de categorizar ademas quiero que saques la opcion de
    ocultar filas y al lado de ocultar columnas agregues un boton para que se oculten las
    franjas de color y cuando lo vuelva a toca aparescan».
    - La fila del V.R. queda.
    - En el Informe ya no se ocultan filas: no está «Filas» arriba de la tabla y tocar el nombre
      de una fila no hace nada.
    - Al lado de «Columnas», «Franjas» (dice «A la vista» u «Ocultas») oculta con un toque de
      Excelente a Desvío y las vuelve a mostrar con otro. La fila del V.R. sigue a la vista y
      los colores de las filas no cambian. Queda así mientras se está en el Informe (eso lo
      propuso Claude).
    - Las demás tablas siguen como estaban (ver «Toda la app: presentación, colores suaves y
      ocultar», al principio).
  Descartado: Objetivo con filas del equipo, ocultar filas en el Informe de GPS y sacar la fila
  del V.R. con «Mi selección» u «Objetivo».
- **VS RIVAL**: en el promedio del equipo, el TOTAL de cada partido oficial del microciclo, en
  orden de fecha (Santiago: «toma la descripción donde la condicion sea total»); un partido sin
  TOTAL no va, como en el archivo. Comprobado con los datos del club: da igual que el archivo en
  19 de 22 microciclos; en el 17 y el 18 el archivo mostraba un ST (el orden de carga) y en el
  41 estaba sin actualizar. En un jugador, lo propuesto el 15/10 (a confirmar): su fila del
  partido con Condición Total; si su Total junta el partido con otra cosa, su fila del partido
  de más tiempo.
- **Jugador y Objetivo** (15/10, después de «3. B» y «4. Si»): cada jugador, con la carga
  crónica de su último microciclo elegido (comprobado con la tabla de carga por jugador del
  archivo: igual en los 144 casos comparados). «Objetivo sesión/microciclo», como el archivo: en
  cada sesión (fecha y microciclo) de lo filtrado, sin mirar Nombre ni Microciclo/Jugador, el
  valor del Team Average de la sesión y el desvío de los jugadores de esa sesión (Condición
  Total; Va vacío, No o Si). El Bueno es el promedio de las sesiones (en un por minuto, el
  promedio de la medida ÷ el promedio de los minutos, cada sesión al segundo) y el desvío, el
  promedio de los desvíos; con «Valor suma», las sumas. En los índices vale siempre; en las
  variables, solo con «Jugador» en Microciclo/Jugador (si no, las franjas de las variables
  quedan vacías y se avisa). (**Cambiado el 16/10**: Objetivo aparece solo cuando todas las
  filas son jugadores; ver «Objetivo, solo con jugadores…», arriba.) Comprobado con la tabla interna del archivo: el promedio da igual
  en las 150 sesiones y el desvío, en 148 (las otras dos el archivo las tenía sin actualizar).
  La descripción del archivo dice que el desvío es «solo con los jugadores que poseen la
  condición SI», pero cuenta Va vacío, No y Si: se hace como calcula.
- Por tarea y Por jugador, hechos el 16/10: ver abajo.

**Por tarea (16/10)** (`src/ReportesGps.jsx`; el cálculo en `src/domain/gps/porTarea.js`,
que usa las cuentas de Por microciclo; UI-038). En el archivo, «Por tarea» (filas 213 a 323 de
INFORME GPS) tiene cinco comparaciones fijas (A a E), cada una con sus segmentaciones (Tipo de
Sesión, Microciclo, Fecha, Nombre y Condición) y su tabla dinámica (Va vacío, No o Si). De cada
una muestra su fila (el Tipo de Sesión elegido, N° Micr., N° Ses. y el promedio de cada
columna) y, solo con un Tipo de Sesión elegido, una fila por microciclo (hasta 20); arriba, el
promedio de las cinco. No pinta. Santiago respondió en un cuestionario:

- **El promedio de cada comparación**: «LAS SELECCIONADAS, SI USAS SOLO 18 Y 12 SE USAN ESAS Y SI
  USAS MAS SE USAN ESAS». Promedia todos los microciclos elegidos (el archivo tomaba solo los del
  17 en adelante y los buscaba por su lugar en otra lista: si la comparación no empezaba en el
  10, fallaba).
- **Los tres errores del archivo** (marcó los tres): cada microciclo usa el V.R. de su
  dispositivo, como en Por microciclo (el archivo lo elegía mirando la tabla de Por
  microciclo); los índices Volumen y Máxima usan D_MP5 (el archivo usaba el % del tiempo); con
  «Relativas» no hay Valor suma ni % de la suma (el archivo sumaba valores por minuto).
  «>30km/h» es Mts ≥ 90% Pico, como en Por microciclo.
- **Los colores**: «Sí, como Por microciclo». Con «Mi selección», unas solas franjas de todas las
  filas de microciclo de todas las comparaciones (la U.A., al revés, como en Por microciclo);
  con «Valor referencial», las del V.R. de cada fila. Se pintan también la fila de cada
  comparación y la de arriba (con «Valor referencial», con el V.R. de su último microciclo).
  «Objetivo» no está: las filas son microciclos, no jugadores (ver «Objetivo, solo con
  jugadores…», arriba). **Cambiado el mismo 16/10** (Santiago, en el cuestionario de Por
  jugador: «por jugador si se pinta con las categorias y por tarea no se pinta con nada»): Por
  tarea no se pinta. No tiene Categorización, franjas ni «Franjas», y ninguna celda tiene
  color. Arriba queda la fila del V.R. (una por dispositivo si hay más de uno), porque los %
  salen de él. El título de la tabla dice «Comparaciones». Descartado: pintar Por tarea.
- **El diseño**: «Tarjetas que sumás». En el paso 1, una tarjeta por comparación (con su letra
  en dorado, el acento de la marca) con sus cinco filtros; arranca con una y «+ Otra
  comparación» suma hasta 5 (con 5 dice «Hasta 5 comparaciones»); con más de una, cada tarjeta
  tiene su botón para quitarla. «Limpiar filtros» vacía los de todas, como el botón del archivo.
  En el informe, los mismos controles que Por microciclo (sin Objetivo), «Filtros» con las
  mismas tarjetas y una sola tabla: arriba, «Promedio» (el de las filas de las comparaciones;
  solo con más de una), y de cada comparación su fila (su letra y el Tipo de Sesión elegido, o
  «Todas las tareas») y una fila por microciclo, siempre, sin el límite de 20. Una sola tabla,
  y no una por tarjeta como en el dibujo del cuestionario, para que las columnas queden
  alineadas al comparar (lo decidió Claude; si Santiago prefiere la tabla dentro de cada
  tarjeta, se cambia).
- **Al entrar**: una comparación sin filtros, como quedó guardado el archivo (Tipo de Sesión,
  Fecha, Nombre y Condición en «(Todas)»; el Microciclo tenía elegidos del 10 al 17). Claude le
  había dicho antes que el archivo abría con «Team Average Parcial» y «Parcial»: estaba mal.
- **Las columnas**: N° Micr. y N° Ses. (en la fila de cada comparación: cuántos microciclos y la
  suma de sus sesiones), U.A. suma y promedio, los índices y las variables; sin carga crónica
  ni VS RIVAL, como el archivo. En la fila de cada microciclo, N° Ses. dice sus sesiones (en el
  archivo, vacía; lo propuso Claude para que se vea de dónde sale la suma). N° de sesiones: los
  días (fecha y clasificación de días) de ese microciclo con los filtros de la comparación, sin
  mirar Va, como Micro_Sesión. Las columnas ocultas se recuerdan aparte de las de Por
  microciclo.
- **Comprobado**: con datos inventados (`src/domain/gps/porTarea.test.js` y
  `src/Gps.smoke.test.jsx`). La tabla dinámica de la comparación A del archivo está sin
  actualizar (no coincide con ninguna combinación de filtros de la base de hoy), así que no
  sirve para comparar números; las cuentas de cada fila son las de Por microciclo, que sí se
  comprobaron contra el archivo.

Descartado en Por tarea: las cinco comparaciones fijas, el detalle solo con un Tipo de Sesión y
hasta 20 microciclos, promediar solo los del 17 en adelante, el V.R. elegido mirando otra tabla,
el tiempo en los índices y la suma con «Relativas».

**Por jugador (16/10)** (`src/ReportesGps.jsx`; el cálculo en `src/domain/gps/porJugador.js`,
que usa las cuentas de Por microciclo y las filas por microciclo de Por tarea; UI-038). En el
archivo, «Por Jugador - Microciclo» (filas 71 a 211 de INFORME GPS) tiene cinco comparaciones
fijas (A a E), cada una con sus segmentaciones (Nombre, Microciclo, Fecha, Tipo de Sesión,
Condición y Clasificación Días) y su tabla dinámica (sin Va «Readaptación»). De cada una
muestra sus franjas (el promedio y el desvío de sus microciclos: cada jugador contra sí
mismo), su fila con el promedio y una fila por microciclo, con N° de sesiones y de descansos,
U.A., la carga crónica del jugador, los índices y las variables; los de antes del 17, en otro
bloque. Santiago respondió en un cuestionario:

- **Los cuatro errores del archivo** (marcó los cuatro): Excelente y Malo a 2 desvíos en todas
  (las comparaciones B a E los armaban a 1,5); en Total (D), el desvío de su propia comparación
  (B a E tomaban el de la tabla de Por microciclo); cada fila con el V.R. de su dispositivo,
  como en el resto (B a E lo buscaban en la hoja «Valores» con otra clave); todos los
  microciclos juntos, cada uno con el V.R. de su dispositivo (el archivo separaba los de antes
  del 17).
- **Objetivo**: «Sí, por microciclo». Cada microciclo de la comparación se pinta contra el del
  equipo en ese microciclo (el Bueno, el promedio del Team Average de sus sesiones; el desvío,
  el de los jugadores), con los demás filtros de la comparación menos Nombre y Condición. La
  fila de la comparación, con el promedio de los objetivos de sus microciclos. Solo aparece
  cuando todas las comparaciones tienen jugadores elegidos en Nombre (sin el promedio del
  equipo); si no, queda «Mi selección», como en Por microciclo.
- **Se pinta**: «es al reves, por jugador si se pinta con las categorias y por tarea no se
  pinta con nada». Con «Mi selección», unas solas franjas arriba de la tabla, con el promedio
  y el desvío de todos los microciclos de todas las comparaciones (la U.A. y la carga crónica,
  al revés, como en Por microciclo). Primero se hizo como el archivo, unas por comparación
  encima de su fila (PR #295), porque la pregunta se había respondido con lo de Por tarea;
  **cambiado el mismo 16/10** (Santiago, en un cuestionario: «Unas solas para todo»).
  Descartado: unas franjas por comparación. Con «Valor referencial», cada fila con el V.R. de
  su dispositivo (la de la comparación, con el de su último microciclo) y las franjas del V.R.
  arriba, con «Ver las de …» si hay más de uno. Con «Objetivo», cada microciclo con las suyas:
  no hay unas franjas para mostrar, así que tampoco va el botón «Franjas».
- **El diseño**: como Por tarea («Tarjetas que sumás»): una tarjeta por comparación con su
  letra en dorado y sus seis filtros, «+ Otra comparación» hasta 5, quitar cada una, «Limpiar
  filtros» para todas; al entrar, una comparación con Condición «Total». En el informe, los
  mismos controles que Por microciclo, «Filtros» con las mismas tarjetas, «Columnas» y
  «Franjas», y una sola tabla: arriba el V.R. y las franjas; de cada comparación, su fila (su
  letra y el jugador elegido, o «Todos los nombres») y una por microciclo. Sin el promedio de
  todas arriba (el archivo no lo tiene).
- **Las columnas**: como Por microciclo sin VS RIVAL (el archivo no lo tiene acá): N° Sesiones,
  N° Descanso, U.A., carga crónica (solo con un jugador elegido en la comparación: la de su
  tabla de carga en ese microciclo), los índices y las variables. En la fila de la comparación,
  N° de sesiones y de descansos suman; lo demás, el promedio de sus microciclos. Las columnas
  ocultas se recuerdan aparte.
- **Comprobado**: con datos inventados (`src/domain/gps/porJugador.test.js` y
  `src/Gps.smoke.test.jsx`). Las cuentas de cada fila son las de Por microciclo, que se
  comprobaron contra el archivo.

Descartado en Por jugador: las cinco comparaciones fijas, unas franjas por comparación, los 1,5
desvíos de B a E, el desvío de Total y el V.R. de B a E tomados de otra tabla y otra hoja, y los
microciclos de antes del 17 aparte.

**La presentación, los colores y ocultar (15/10, después de verlo con los datos del club).**
Santiago mandó una captura del informe con: «1. NECESITO QUE HAGAS MUCHO HINCAPIE EN LA MANERA
DE PRESENTAR LAS COSAS Y QUE SE VEAN MEJOR VISUALMENTE Y MAS INTUITIVAS NO SOLAMENTE PONERLAS Y
PUNTO 2. NECESITAMOS UNA MANERA DE EN TODO EL SOFT DE PODER OCULTAR MANUALMENTE UN COLUMNA Y
FILAS SIN NECESIDAD DE ENTRAR A AJUSTES Y OCULTARLAS 3. ESTANDO EN MI SELECCION NO SE PINTA
4. PENSAS QUE ESTA ES LA MANERA PROFESIONAL Y VISUALMENTE ESTETICA DE MOSTRAR UNOS DATOS?». Se le
mostró una versión de prueba (antes y después, en el celular y en la compu, con datos
inventados) y respondió: «1. Si 2. Todas las columnas se pintan con sus reglas 3. B 4. Cuando
toco un columna o fila en cierto lugar tiene que preguntarme si la quiero ocultar 5. Si
6. Despues lo vemos, pero si suaviza todos los colores en todos los lugares donde se use».

- **La tabla** («1. Si»): arriba, cuántos microciclos (o jugadores, o filas) hay y de qué V.R.
  son las franjas. La tabla corre dentro de su marco, con la cabecera y la primera columna
  siempre a la vista. La cabecera es oscura y lisa: el tono de cada grupo es una línea debajo
  de su nombre (antes, un fondo de color fuerte por grupo; **cambiado el 15/10**: ver «La
  estética», abajo). La primera columna dice qué es cada
  fila: «Microciclo» con solo microciclos del equipo (cada fila, su número), «Jugador» con solo
  jugadores (el nombre; sin sus microciclos desde el 17/10, ver «Lo anotado en Notas, tercera
  tanda») y «Nombre / Microciclo» si hay de los dos. Las franjas
  (el V.R. y de Excelente a Desvío) van en un bloque gris aparte, con un punto del color que
  toma lo que cae en cada franja al lado de su número. Los números van a la derecha, con
  cifras del mismo ancho; donde no hay dato, «–»; todas las filas del mismo alto (VS RIVAL en un
  renglón). No cambió ningún cálculo. (**Cambiado el 15/10**: las franjas pintadas enteras y
  los números centrados; ver «La estética», abajo.)
- **Todas las columnas se pintan con sus reglas** (2): la U.A. y la carga crónica, como el
  archivo en «Por microciclo» (la U.A., solo con «Mi selección»; la carga crónica, con sus
  franjas). Los índices y las variables, con la regla que el archivo usa para esas columnas en
  «Por jugador» (en «Por microciclo» el archivo no las pintaba, aunque mostraba sus franjas):
  desde Excelente, verde oscuro; desde Muy bueno, verde; desde Bueno, amarillo; desde Regular,
  naranja; más abajo, rojo; en las variables, además, un 0 va en rojo. Vale con las tres
  categorizaciones, contra sus franjas (con «Objetivo», el objetivo ± el desvío). Cada fila usa
  las franjas de su V.R. (el archivo tenía otra tabla para los microciclos 10 a 16); sin
  franjas, sin color. (**Cambiado el 16/10**: con «Mi selección» y «Objetivo», unas solas
  franjas de todo lo que se ve, para todas las filas; ver «Las franjas de «Mi selección» y
  «Objetivo», de todo lo que se ve», arriba.)
- **Los colores** («3. B»): los mismos del archivo, más suaves (`src/domain/colores.js`; en el
  archivo eran A7B093, C8E7A7, FFFF7F, FBCAA2, F1B584 y FF7F7F). Y «suaviza todos los colores en
  todos los lugares donde se use» (6): ver «Toda la app: presentación, colores suaves y
  ocultar», al principio.
- **Ocultar columnas y filas** (2, 4 y 5): tocar el nombre de una columna (su cabecera) o de
  una fila pregunta «¿Ocultar «…»?» («Ocultar» / «Cancelar»). Arriba de la tabla, «Columnas» y
  «Filas» dicen cuántas hay ocultas y abren la lista con casillas para volver a mostrarlas. Las
  filas de las franjas también se ocultan. Ocultar solo deja de mostrar: los números, las
  franjas y los colores no cambian («5. Si»; para sacar algo de las cuentas están los filtros).
  Las columnas quedan ocultas en ese aparato hasta que se vuelvan a mostrar (como las columnas
  fijas de las bases); las filas, hasta salir del informe (como sus filtros). Ajustes ›
  Cabeceras sigue escondiendo para todo el club. Que sea solo de cada aparato lo propuso Claude
  y Santiago no lo objetó (respondió cómo se oculta): si prefiere otra cosa, se cambia. En todas
  las demás tablas: ver «Toda la app: presentación, colores suaves y ocultar», al principio.
  (**Cambiado el 16/10** en el Informe: las filas ya no se ocultan y «Franjas», al lado de
  «Columnas», oculta y muestra las franjas; ver «Objetivo, solo con jugadores…», arriba.)
- **Queda para después** (6, «Despues lo vemos»): llevar este estilo de tabla a las demás
  tablas (bases y reportes). No hacerlo hasta que Santiago lo pida.
- **La estética (15/10, con una imagen)**: Santiago mandó la imagen de una pantalla de ejemplo,
  con datos inventados: «esta seria una estetica agradable a la vista y buena para poder ver los
  datos, sacando el grafico pero dejando lo demas, NO USES NINGUN DATO NI NADA SON DATOS
  INVENTADOS POR ESO HAY QUE PASAR ESA ESTETICA A INFORME PERO NADA DE DATOS O CABECERAS
  INVENTADAS». Hecho en todo el Informe (el menú, los filtros y el informe):
  - tarjetas oscuras;
  - los desplegables en una fila (en la compu ancha), cada uno con su ícono, y «+ Otro V.R.» al
    lado del V.R.;
  - arriba de la tabla, con un ícono, de qué V.R. son las franjas y, abajo, cuántas filas;
  - el título de cada grupo con el fondo de su tono (el mismo de las bases) y una línea más
    clara abajo: **reabre** «un fondo de color fuerte por grupo», que estaba prohibido (lo
    pidió Santiago con la imagen);
  - las franjas pintadas enteras (antes, un punto al lado del número); el V.R. y el desvío, en
    gris y en cursiva;
  - los números centrados, como en la imagen (antes, a la derecha).
  Siguen igual: qué se pinta y con qué regla, los colores suaves («B»), las columnas, las filas,
  los textos, ocultar y los cálculos. No se agregó nada de lo inventado de la imagen: el gráfico
  (lo sacó Santiago), las tarjetas de arriba con números (distancia promedio, alta intensidad,
  duración media, cumplimiento vs V.R. y «vs. microciclo anterior»: el informe no los calcula),
  «Exportar», la temporada ni las iniciales de quien usa la app. **Pendiente**: preguntarle si
  quiere esas tarjetas y con qué números; no hacerlas sin su respuesta. (Respondido el mismo
  15/10: ver «Las tarjetas con el promedio», abajo.)
- **Las tarjetas con el promedio (15/10)**: a la pregunta («¿Las querés? Si es así, decime qué
  número va en cada una»), Santiago: «Si las quiero y quiero que pongas el promedio de cada
  variable arriba de su columna». Hecho:
  - arriba de todo, la fila «Promedio» con una tarjeta oscura por columna, justo arriba de la
    suya: el número grande y una línea con el tono de su grupo, como las tarjetas de la imagen.
    VS RIVAL es texto y no lleva;
  - el promedio de todas las filas del informe (las que dejan los filtros), también las
    ocultas a mano: ocultar no cambia los números (UI-039). Las celdas vacías no cuentan, como
    PROMEDIO del Excel. Cada uno con el formato de su columna; N° Sesiones y N° Descanso, con
    un decimal (son cantidades: «5,7» dice más que «6»; lo propuso Claude);
  - no queda fija al bajar (como las franjas); su rótulo, sí al deslizar de costado. Se oculta
    tocando «Promedio», como las demás filas, y vuelve con «Filas»; un «?» explica la cuenta;
  - con «Mi selección», el Bueno de las franjas también es un promedio de las filas y suele dar
    lo mismo, pero no siempre: el Bueno sale solo de las filas de su V.R. y, en las por minuto,
    del promedio de la medida ÷ el de los minutos (como el archivo). Con «Valor referencial» u
    «Objetivo», el Bueno es el del V.R. o el objetivo, y la tarjeta sirve para compararlo.
  No se agregó la comparación «vs. microciclo anterior» de las tarjetas de la imagen (no la
  pidió): **pendiente** preguntarle si la quiere; no hacerla sin su respuesta.
  **Sacadas el 16/10.** A la pregunta por «vs. microciclo anterior», Santiago: «no eso dejalo y
  mejor saca la ultima implementacion de los promedios con las tarjetas». Se sacó la fila
  «Promedio» con sus tarjetas (el código, los estilos, los textos, el «?», la guía y su prueba):
  el Informe quedó como estaba antes del 15/10 a la tarde. Tampoco va la comparación
  «vs. microciclo anterior».

Queda prohibido en el Informe: volver a mostrar las franjas como filas de datos sin su color,
«Team Average Sesion» en cada fila cuando todas son del equipo, un fondo de color fuerte por
grupo en la cabecera (**reabierto el 15/10**: ahora va el fondo del tono de cada grupo, ver «La
estética»), pintar solo la U.A. y la carga crónica, los colores fuertes del archivo y ocultar sin
preguntar. Desde el 16/10 (Santiago: «no eso dejalo y mejor saca la ultima implementacion de los
promedios con las tarjetas»), también: las tarjetas con el promedio de cada columna arriba de la
tabla (una fila «Promedio» con números en tarjetas) y la comparación «vs. microciclo anterior».
Solo se vuelven a poner si Santiago lo pide.

### Reporte individual y Reporte grupal (16/10)

Santiago, 16/10: «Ahora tenemos que implementar los informes de gps». En el Excel, además de la
hoja INFORME GPS, están «Reporte Individual» y «Reporte Grupal». Se analizaron las dos y se le
preguntó en un cuestionario:

- **Dónde va**: «Dentro de Informe». En «Ver informes», una cuarta opción, «Reporte individual»
  (`src/ReporteIndividualGps.jsx`; el cálculo en `src/domain/gps/reporteIndividual.js`), con dos
  pasos como los demás: el jugador y los filtros, y el reporte, con «Filtros» adentro. La barra
  no cambia.
- **Qué tiene** (como el archivo): las segmentaciones Nombre (un jugador), Tipo de Sesión, Fecha
  y Microciclo; las tablas dinámicas fijan Condición «Total» (Va, todas). Cuatro tablas con los
  últimos 10 (de la fecha más nueva para atrás; en el mismo día, en el orden de carga): Por
  jugador (el elegido) y Por equipo (el Team Average de cada sesión), cada una en Totales
  (Tiempo, D, D_SHI, D_AccHI, D_DecHI, D_MPHI, D_S6, D_A8, D_A1, D_MP5, PSE, U.A. y
  Descripción, con «Promedio» y «Suma»; el equipo, también «Desv. est.») y Por minuto (Tiempo y
  los por minuto, con «Promedio»: la suma de cada medida ÷ los minutos de las filas que la
  tienen; el equipo, también «Desv. est.»). Los nombres de las columnas son los de Ajustes ›
  Cabeceras.
- **Los colores** (la regla del archivo, con los colores suaves): desde promedio + 2 desvíos,
  verde oscuro; desde + 1, verde; desde el promedio, amarillo; hasta − 1, naranja; más abajo,
  rojo. Por equipo, contra el promedio y el desvío de su tabla, como el archivo. Por jugador,
  «Contra el equipo ese día» (el archivo dice «*Pintado vs los valores del día de
  entrenamiento» pero no tiene la regla): el Team Average de la sesión de ese día (fecha y
  microciclo, como Objetivo) ± el desvío de los jugadores. Se pintan Tiempo y las 9 medidas;
  PSE y U.A., no.
- **Errores del archivo** («Explicación de variables», lo único marcado): la explicación de
  abajo decía rangos que no coinciden con los nombres de las columnas (16–24 km/h y 2–4 m/s²
  contra 14,4–25 km/h y 1,7–2,7 m/s²). Ahora usa el nombre de cada columna (el de Ajustes ›
  Cabeceras) y una explicación sin rangos. Quedan como el archivo, porque no se marcaron:
  - en «Por equipo · Por minuto», el amarillo llega hasta el promedio + el desvío de la tabla
    de Totales (en la práctica da lo mismo: el de Totales es más grande);
  - Gimnasio, Kine, Estudios y otras sesiones sin GPS cuentan como 0 en los últimos 10, en los
    promedios y en el desvío.
  «Tablas cruzadas» tampoco se marcó: en el archivo guardado, «Por jugador» no estaba filtrado
  por el jugador y «Por equipo» mostraba al jugador elegido. Se tomó que en el Excel de Santiago
  anda como dicen los títulos (Por jugador, el elegido; Por equipo, el Team Average). Santiago lo
  confirmó el 16/10 en un cuestionario: «Sí, como los títulos».
- **Los minutos de Por minuto (corregido el 16/10)**: el archivo pasa el tiempo sumado a minutos
  con DIA × 24 (y no × 1440); si los tiempos de las filas juntos pasan las 24 h, el Promedio de
  Por minuto sale más alto. Santiago, 16/10, en un cuestionario: «Corregirlo». La app cuenta
  todos los minutos (`minutosDe`, en segundos enteros como el archivo); por debajo de las 24 h da
  lo mismo que el archivo. Descartado: volver a contar los días × 24.
- **Ocultar**: las columnas se ocultan tocando su nombre (pregunta antes) y dejan de verse en
  las cuatro tablas; «Columnas» las vuelve a mostrar. Las filas no se ocultan, como en el
  Informe (UI-039). Se recuerdan aparte (`gps_reporte_individual_columnas_ocultas`).
- **Reporte grupal (hecho el 16/10)**: «Primero el individual». La hoja del Excel es un
  borrador (título, Período, Grupo, Sesiones, «Rendimiento y carga – análisis grupal», dos filas
  de cinco casillas con «Distancia (m)» en la primera y «Jugadores en el informe», sin datos ni
  fórmulas). Santiago, 16/10, en un cuestionario: «Proponeme el contenido»; se le mostró una
  propuesta con datos inventados y eligió «Así: 9 medidas y U.A.», «Promedio y total», «Todo el
  plantel» y, para la tabla de los jugadores, «Los 3 tipos de categorizacion». Quedó así
  (`src/ReporteGrupalGps.jsx`; el cálculo en `src/domain/gps/reporteGrupal.js`):
  - En «Ver informes», la quinta opción, con dos pasos como el individual: los filtros (Tipo de
    Sesión, Fecha y Microciclo; Condición Total) y el reporte, con «Filtros» adentro.
  - Arriba: Período (la primera y la última fecha), Grupo («Todo el plantel») y Sesiones (las
    del promedio del equipo de la sesión con tiempo: los descansos y las sesiones sin GPS no
    cuentan).
  - «Rendimiento y carga»: 10 casillas, las 9 medidas del Reporte individual y la U.A.; en cada
    una, grande, el promedio del equipo por sesión (el Team Average) y abajo el total del período.
    No reabre las tarjetas con el promedio que se sacaron del Informe (UI-038): son las casillas
    del borrador del Reporte grupal, elegidas por Santiago para esta pantalla.
  - «Jugadores en el informe»: cada jugador con sus sesiones y su promedio por sesión de Tiempo,
    las 9 medidas y la U.A., pintado con las tres categorizaciones del Informe y sus reglas
    («Mi selección», los jugadores que se ven; «Valor referencial», un V.R. que se elige, de
    entrada el de la Base para el dispositivo de la última sesión; «Objetivo sesión/microciclo»,
    el Team Average de las sesiones y el desvío de sus jugadores). Las franjas van arriba, con
    «Franjas» para ocultarlas, como en el Informe; la U.A., solo con «Mi selección» (al revés).
    Se ocultan columnas, no filas.
  - Descartado: elegir los jugadores del grupo, solo el promedio o solo el total en las
    casillas, y la tabla sin colores o solo con la lista de nombres.
- **Comprobado**: con datos inventados (`src/domain/gps/reporteIndividual.test.js` y
  `src/Gps.smoke.test.jsx`). La hoja «Datos» del archivo guardado estaba desactualizada (ver
  «Tablas cruzadas»), así que no sirve para comparar números.

Descartado en el Reporte individual: la explicación de variables con los rangos del archivo.

### Pegar desde Excel (el historial)

- En `BD_GPS`, sacar los filtros (o dejar a la vista lo que se quiere traer) y copiar desde la
  fila de títulos hasta la última. **Antes de copiar, poner las columnas D a AN y AY a BD con
  formato Número y 15 decimales**: Excel copia lo que se ve y con su formato los números llegan
  redondeados (comprobado con la hoja entera). Si es mucho, por partes.
- Se elige el dispositivo de lo pegado: el historial va en dos veces (hasta el microciclo 16 con
  Sport; del 17 en adelante con Catapult).
- Los nombres se buscan por su nombre en Catapult (el vínculo de Datos básicos) y si no, por el
  de Datos básicos. Un nombre que no está se elige una vez para todas sus filas (guardarlo con
  ese nombre, es un jugador de la lista o no cargarlo); «Guardar igual» los guarda todos con su
  nombre.
- «Ya está en la app»: misma fecha, misma persona y mismos valores (el dispositivo no cuenta).
  Dos filas iguales dentro de lo pegado se cargan las dos, como están en el Excel.
- Una celda con error del Excel (#¡DIV/0!, #¡VALOR!, #N/D) queda vacía y se avisa por columna.
  Un texto que no está en su lista (por ejemplo, «0» en Código Estrategia) se guarda como vino y
  se avisa: si hace falta, se suma en Ajustes › Listas. En Clasificación Días el signo cuenta
  («-4_M» no es «4_M»).
- Se guarda de a 250 filas, en el orden del Excel, y dice cuántas lleva; si se corta, lo que
  falta se ve como «para cargar» y se vuelve a intentar sin duplicar.

### Comprobado contra el Excel real (10/10, solo en la máquina de trabajo, nada al repositorio)

- Las 15.667 filas de `BD_GPS` (copiadas con 15 decimales): las 846.018 celdas se leen igual que
  en el Excel, salvo 22 de Máxima Velocidad que en el Excel están guardadas como texto («27,8»):
  la app las lee como número (el Excel no las cuenta en su informe).
- El informe de arriba (279 celdas, sin filtro) da igual que el que guardó el Excel, salvo:
  - las columnas donde el Excel muestra #DIV/0! o #VALOR! porque tiene celdas con error
    (Distancia Explosiva, 19,8-25,2Km/h/min, Esfuerzo Explosivo, Inicio y Finalización de
    tarea): en la app esas celdas quedan vacías y el informe se calcula con las demás;
  - el Mín. de GNSS Quality y HDOP: en el Excel esa fila es un promedio (=SUBTOTAL(1;…)), no el
    mínimo. Error chico, corregido: la app muestra el mínimo.
  - En Maxima Velocidad a HDOP el Excel tenía n, Máx. y Mín. una fila más abajo: en la app van
    alineados (corregido).
- Los colores, contra el formato condicional del Excel calculado aparte: en las filas de los
  microciclos 10 a 16 (Sport), las 77.721 celdas iguales. En las del 17 en adelante, 12.477
  celdas cambian de color porque ahora se comparan solo con las de Catapult (lo decidido).

### Para el paso 2 (Cargar), lo que ya se sabe

- **La selección, por jugador** (nota del 07/10 y Santiago, 11/10): los tiempos de la
  selección se cargan solo en las filas de quien fue, nunca como una tarea de todos («un
  jugador que no fue a selección … no puede tener más tiempo sumado solo xq uno fue»). Hoy se
  reconocen por la Descripción («Convocado/Convocación Selección…»); Santiago va a definir
  una marca fija para que se detecte fácil.

- El CSV de Catapult trae un título por columna. Cómo lo usa hoy la plantilla (por lugar): Total
  Distance → D; Velocity Distance 14-25 km/h → 14,4-25Km/h; Acceleration B2 Efforts (Gen 2) → n°
  1,7 a 2,7m/s2; Deceleration B2 → n° -1,7 a -2,7m/s2; Metabolic Power Band 2 Total Distance →
  20-45 W/PC; Velocity Band 6 Total Distance → > 25,2 Km/h; Acceleration B3 → n° Acel. >2,7;
  Deceleration B3 → n° Desacel. <-2,7; Metabolic Power Band 3 → > 45 W/PC; Velocity Band 6 Total
  Distance (Set 2) → Mts >= 90% Pico; Total Duration → Tiempo; Maximum Velocity → Maxima
  Velocidad; Max Acceleration → Aceleracion Maxima; Velocity Band 5 Total Distance →
  «19,8-25,2Km/h/min» (es distancia, no por minuto); RHIE Effort Duration - Min → «Esfuerzo
  Explosivo»; RHIE Effort Duration - Max → «Esfuerzo Explosivo/min»; Start Time → Inicio; End
  Time → Finalización; Average GNSS Quality → GNSS Quality; Average HDOP → HDOP. Distancia
  Explosiva no viene en el CSV (era del dispositivo viejo). En la app, por el título, no por el
  lugar.
- Las filas «Session» (Period Number 0) se descartan; un mismo nombre de período con otro
  número (SEGUNDO TIEMPO #1 y #2) es un solo bloque.
- En el historial hay cambios hechos a mano después de pegar (tiempos de tareas intermitentes,
  un jugador agregado a un tiempo): la carga tiene que dejar corregir.

### Cargar (paso 2, 12/10)

Santiago, 12/10: «podes seguir con el cargado del csv de catapult, yo te pase la plantilla que
usamos para anotar las cosas». Las cuentas están en `src/domain/gps/cargar.js` y la pantalla, en
`src/CargarGps.jsx`. En la pestaña **Cargar**, «Cargar un día» abre un paso por cada bloque
de la plantilla (toda lista, en un desplegable: UI-027; el orden, desde el 12/10: ver
«Correcciones de Santiago», abajo):

1. **El CSV de Catapult**: se elige el archivo o se pega su contenido; si la actividad está en
   varios archivos, se suman. Se lee por el título de cada columna (los de «Para el paso 2»,
   arriba; las columnas del club, por su nombre). Las filas «Session» no van; el mismo nombre
   de período con otro número es un bloque. Dice cuántas filas leyó, cada bloque con cuántos
   jugadores y qué columnas no trae. Lo que no es un CSV de Catapult no se suma. Los nombres,
   como en Pegar desde Excel (por su nombre en Catapult y si no por el de Datos básicos; el que
   no está se elige una vez). La fecha sale del CSV (se puede cambiar) y con ella se revisa si
   el CSV **ya está en la Base**: si está, lo dice y no deja seguir; si no, lo dice y deja
   seguir (y avisa si ese día hay filas de otra sesión). Esa revisión tiene que salir del
   propio CSV y no de la fecha elegida (Santiago, 13/10): ver «Pendiente», abajo. Siempre
   dice qué pasó con el partido de ese día en Partido (lo encontró, no hay, no trae rival, el
   CSV no trae los tiempos o no se pudo mirar). Los arqueros no se cargan si el club no los
   prende (lo dice).
2. **Primer tiempo** y 3. **Segundo tiempo** (si el CSV los tiene): arriba, en una sola
   tarjeta, el nombre del partido («Vs» y el rival del partido de ese día en Partido; se puede
   cambiar), Tarea o Partido, tipo de sesión, zona y pausa (lo demás de la plantilla —código,
   Nro. de jugadores, series, bloques, largo, ancho y m2— se muestra desde Ajustes; lo escrito
   va en la descripción, como la plantilla), el % vs V.R. de partido y agregar a mano un
   jugador. Abajo, la tabla con el Team Average y todos los jugadores, con todos sus datos;
   ahí también se cambia el nombre de una fila (alguien usó el GPS de otro).
4. **Partido completo**: su encabezado con su %, los que no ingresaron (salen de Partido; se
   cambian en un desplegable con casillas) con su tipo de sesión, y la tabla.
5. **Una tarea por paso** («Tarea 1 de N»): arriba, como la plantilla, tipo de sesión, nombre,
   código, zona, base, largo, ancho, Nro. de jugadores, pausa, C/P Jug y, calculados, C/P Tarea
   y m2; el % vs V.R. de partido; pasarla a «Adicional» o no cargarla; agregar o sacar un
   jugador. Abajo, la tabla con el Team Average y todos los jugadores con todos sus datos y su
   «Va Tarea» (columna después de m2, como en la plantilla), que se cambia en la tabla, igual
   que el nombre.
6. **Regenerativo y no entrenaron**: la duración y quiénes lo hicieron (de los que no
   entrenaron); los del plantel actual que no están en el CSV, con su motivo y su tipo de
   sesión (se saca de la lista a quien no corresponde y queda abajo de todo).
7. **La sesión**, al final: tipo de microciclo, día del microciclo (sin _M / _T: va solo, por la
   hora de inicio de cada fila) y dispositivo; el encabezado del Team Average de la sesión como
   en la plantilla (tipo de sesión, código, zona, base, largo, ancho, Nro. de jugadores, pausa,
   C/P Jug y, calculados, C/P Tarea y m2), su % vs V.R. de partido y qué tareas van en su
   descripción (desplegable con casillas, como «VA?» en la plantilla) con la descripción que
   queda, todo en una tarjeta; y la tabla con el Team Average de la sesión y el total de cada
   jugador, donde se cambia el «Va» de cada uno.
8. **Revisar y guardar**: las filas como van a quedar en la Base (la misma tabla, en el orden
   en que las pegaba la plantilla). En cualquier tabla se cambia cualquier número de Catapult
   de un jugador (se recalculan los totales y los Team Average), el «Va Tarea», el «Va» de cada
   total y lo demás (PSE, listas, textos, columnas del club), que queda como se escribe. Justo
   antes de guardar se vuelve a revisar que el CSV no esté en la Base. Se guarda de a tandas;
   si se corta, lo que falta se guarda al volver a tocar, sin duplicar. Después va a la Base
   con ese día a la vista.

Salir con un día a medio cargar pregunta. Quien ya se fue del club no carga.

- **Correcciones de Santiago (12/10, al probar la primera versión)**. Lo que cambió y queda
  descartado:
  - «la sesion tiene que ser la final x el echo de que la sesion sale de todas las tareas y el
    partido»: la sesión es el último paso antes de revisar. Descartado: la sesión al principio.
  - «siempre que sea la misma fecha que un partido (Lo chequeas dentro de partido si hay una
    fecha igual a la del csv) ponés Vs el rival de turno PT y lo mismo con el segundo tiempo»:
    el nombre del partido sale de `registros_partido` (el partido de esa fecha en ese club;
    `partidoDelDia` en `src/domain/gpsDb.js`). Lo lee quien tiene Partido en el club; si no hay
    partido o no se puede leer, se escribe a mano. Si se escribió a mano, no se pisa.
  - «necesito poder ver los datos con toda la info que tiene cada tarea … copiar la logica de
    como estan las cosas dentro de la planilla y abajo poner todos los jugadores sin espacios
    demas y con todos los datos»: cada bloque muestra arriba su encabezado (los mismos campos
    que la plantilla, en una grilla; en la compu, varias columnas) y abajo la tabla de la Base
    con todas sus columnas. Descartado: la lista de jugadores con solo el tiempo y el «Va».
  - «Si ya estan dentro de la base no tiene que dejar cargar el csv … si esta avisa y no deja
    seguir, si no esta avisa y deja seguir»: se revisa apenas se sabe la fecha. «Ya está» = al
    menos una fila del CSV tiene, ese día, una fila en la Base con la misma distancia, el mismo
    tiempo y la misma hora de inicio (los nombres no cuentan: una distancia con todos sus
    decimales no se repite); así otra sesión del mismo día (mañana y tarde) sí se carga.
    Descartado: el aviso de «ya hay filas ese día» al final, que dejaba guardar igual.
  - «Cada paso a completar tienen que ser las tareas del dia»: un paso por tarea (y por cada
    tiempo del partido). Descartado: todas las tareas en un solo paso.
  - «fijate que hay cosas que faltan (M2, individual de va en la sesion y poder sacar las
    descripciones de las tareas de la descripcion de la sesion)»: el m2 de cada tarea y de la
    sesión se ve calculado en su encabezado (y el de cada tiempo del partido se escribe, como en
    la plantilla); el «Va» de cada uno en la sesión se cambia en su tabla; qué tareas van en la
    descripción de la sesión se elige en la sesión.
  - La sesión de la plantilla ponía en la columna m2 la Base de la sesión (`$N$681`) en el Team
    Average de la sesión y en cada total: error chico, corregido («Corregirlos»): va el m2
    calculado de la sesión (largo × ancho, con la base como trapecio, ÷ jugadores).
- **Correcciones de Santiago (12/10, al probar la segunda versión)**. Lo que cambió y queda
  descartado:
  - «le cambie la fecha del partido al 12/10 y cuando entre a cargar los csv no me aparecio el
    nombre del rival»: la búsqueda era correcta (`registros_partido`, misma fecha y club), pero
    no decía nada si no encontraba. Ahora se busca apenas hay fecha (también si el CSV no trae
    los tiempos) y siempre se dice qué pasó: «Partido del dd/mm en Partido: Vs …», «No hay un
    partido guardado en Partido el dd/mm», «… no tiene rival cargado», «… el CSV no trae PRIMER
    TIEMPO ni SEGUNDO TIEMPO» o «No se pudo mirar Partido» (con Reintentar). Se ordena por `id`
    (antes por `created_at`). Si la fecha cambia, el nombre que no se escribió a mano se
    vuelve a buscar (o se borra). Falta saber qué pasó ese día (ver «Pendiente»).
  - «Hay demasiado espacio como para juntar las cosas y quede mas prolijo visualmente»: cada
    bloque va en una sola tarjeta (el nombre del partido, el encabezado, el %, agregar un
    jugador y, en la sesión, las tareas de la descripción), con menos aire entre lo de adentro
    y entre tarjetas; en la compu, cada uno de los que no entrenaron en una línea. Los controles
    siguen de 44 px. Descartado: una tarjeta por cosa.
  - «No estan los % vs vr de partido con los que se decide la densidad de la sesion»: cada
    bloque (cada tiempo, el partido completo, cada tarea y la sesión) muestra, como arriba de
    cada bloque en la plantilla (columnas P a Z), lo de cada minuto de su Team Average ÷ el V.R.
    de partido de cada medida (D, 14,4-25, aceleraciones y desaceleraciones, potencias, > 25,2 y
    Mts >= 90% Pico), la Metabólica (D, 14,4-25 y 20-45 W), la Fuerza (las cuatro de
    aceleración y desaceleración), la Velocidad (> 25,2 y > 45 W) y el promedio de las nueve
    primeras (sin Mts >= 90% Pico), como en la plantilla; el tipo de sesión (la densidad) se
    elige al lado (13/10: el tipo de sesión no es la densidad; ver «sacale densidad», abajo). Los V.R. de partido son los de la hoja «Datos Básicos» de la plantilla («VR
    Partido»): se guardan por club en `gps_reglas` (Ajustes › Reglas de carga › V.R. de
    partido, un número por medida) y los del club se cargan con un SQL que se pasa en el chat
    (no van al código). Sin V.R., el bloque lo dice; sin Team Average (menos de 4), también.
    (Hasta el 14/10: desde entonces es el V.R. marcado «de partido» del dispositivo de la
    carga, en GPS › Valores de referencia, y el dispositivo se elige al subir el CSV; ver «Los
    V.R. se cambian: una solapa en cada base (14/10)».)
  - Santiago, 13/10: «Hace mas estetico los % y respeta las reglas de menor a 90% en rojo y
    mayor o igual a 90% en verde». Los colores son los del formato condicional de la plantilla
    (filas 9, 50, 180, 681…): cada medida, en negrita, roja abajo del 90 % y verde desde el 90 %;
    el promedio (columna Z), con su propio corte, 70 %. La metabólica, la fuerza y la velocidad
    no tienen color en la plantilla: llevan el de las medidas (90 %), por la regla que dio
    Santiago. Los decimales, como la plantilla: las medidas y el promedio sin decimales; los tres
    grupos, con uno. Se compara como Excel (con 15 cifras). Los dos cortes están en Ajustes ›
    Reglas de carga (90 % y 70 %); el promedio queda en 70 % (Santiago, 13/10: «el promedio
    dejalo asi»). El recuadro: los tres grupos y el promedio en tarjetas con el
    número grande, un borde y una barra (de 0 a 150 %, con una marca en el corte) del color que
    toca; cada medida con su número en una pastilla verde o roja; arriba, qué es cada color.
    Sin dato, gris.
  - «Solo los bloques que son de partido, no tienen que estar las opciones de largo, ancho,
    base, m2, series, bloques, codigo de estrategia y nmro de jugadores (deja dentro de ajustes
    que se pueda ocultar y si quiero usarlo podes deocultarlo dentro de ajustes)»: en los
    tiempos, el partido completo y los que no ingresaron se ven el tipo de sesión, la zona y la
    pausa; lo demás se muestra en Ajustes › Reglas de carga › «Lo que se ve en los bloques del
    partido» (lista con casillas). Lo que no se ve no se carga. El tipo de sesión se ve siempre.
    «Base» no estaba en los bloques del partido. Las tareas y la sesión no cambian.
  - «los jugadores que no ingresaron tmb podes sacarlos del partido cargado»: salen del partido
    de esa fecha en Partido: los convocados que no entraron en ningún cambio (la misma cuenta de
    Partido, `calcularNoIngresaron`), con su jugador de Datos básicos (sin los que están en el
    CSV del partido ni los que ya no están en el plantel). Se cambian en el desplegable; desde
    que se cambian a mano, Partido ya no los pisa. El nombre de Partido que no está en Datos
    básicos se dice.
  - «Modificar los datos es imposible y si agrego un jugador nuevo no puedo cargarle datos»:
    en cualquier tabla de la app, tocar adentro de la celda que se está escribiendo (para poner
    el cursor, o en el celular) cortaba la edición sin guardar. Ahora no la corta, y el doble
    clic adentro elige una palabra en vez de volver a empezar. Con eso se cargan los números del
    jugador agregado. Comprobado en el navegador (antes y después).
  - «Si un jugador uso un gps de otro jugador tengo que poder modificarlo y que la web me
    pregunte si quiero cambiar todos los nombres de ese jugador en las tareas y partido o solo
    en esa tarea (3 opciones cambiar todos los nombres, solo en esa tarea o Cambiar en algunas y
    ahi te da a elegir de entre todas las tareas que haya y solo seleccionas cual)»: el Nombre
    de una fila del CSV se cambia en la tabla de su tiempo o su tarea (desplegable con los del
    plantel). Si ese nombre del CSV está en más de un bloque, pregunta: «Cambiar en todas las
    tareas y el partido (n)», «Solo en …» o «Cambiar en algunas (elegís cuáles)», que abre la
    lista con casillas de los bloques donde está ese nombre. Los números siguen siendo los de
    esa fila. Nadie puede estar dos veces en un bloque: no se sigue hasta cambiar uno. Al
    jugador agregado a mano se lo saca y se agrega otro. En el partido completo, la sesión y
    revisar el nombre no se cambia (son totales).
  - «agrega una opcion dentro de ajustes donde pueda sacar los arqueros del csv, xq por ejemplo
    la base de gps nuestra no lleva arqueros pero si otro club si los usa puedan activarlos
    dentro de ajustes»: Ajustes › Reglas de carga › «Arqueros en la carga», apagado de entrada.
    Apagado, los de Posición «Arquero» en Datos básicos no se cargan del CSV (se dice cuántos),
    no aparecen en los que no entrenaron, en los que no ingresaron ni en ningún desplegable de
    jugadores de la carga. Prendido, van como los demás.
  - «Si saco a alguien de los que no entrenaron tienen que quedar abajo del todo y subir a los
    que si estan»: los que se sacan quedan al final de la lista (en el orden del plantel).
  - «La lista de desplegable de regenerativo tienen que ser los que esten en no entrenaron»: el
    regenerativo se elige solo entre los del plantel actual que no están en el CSV, en el banco
    ni agregados; quien lo hizo deja de estar en «No entrenaron». Descartado: elegir para el
    regenerativo a alguien que está en el CSV (las cuentas de «sesión + regenerativo» siguen en
    `cargar.js`, pero desde la pantalla ya no se llega).
  - «No se puede cargar ningun dato que no tenga dia de microciclo, dispositivo o tipo de
    sesion»: no se sigue sin el tipo de sesión de cada tiempo, del partido completo, de los que
    no ingresaron (si hay), de cada tarea que se carga, de cada uno de los que no entrenaron y
    de la sesión, ni sin día del microciclo y dispositivo (si el club no tiene dispositivos,
    dice dónde sumarlos). Antes de guardar se revisa que toda fila tenga Clasificación Días,
    Dispositivo y Tipo de Sesión (también lo cambiado en la tabla).
  - Santiago, 13/10, con una captura de una tarea: «No hace falta que cosas que no van a ocupar
    mucho espacio tengan tanto espacio, como: base, ancho, largo, Codigo de estrategia, Tipo de
    sesion, zona de impacto, nro de jugadores, Pausa, Cpj […] en cambio la descripcion si
    tendria que tener espacio (Dale un largo normal y si el texto supera el largo que se vaya
    agrandando, con las demas podrias darle el largo suficiente, para las que tienen
    desplegable, para la opcion mas larga y las que no tienen desplegable le pones un cuadrado
    relativamente pequeño». Arriba de cada bloque (los tiempos, el partido completo, cada tarea
    y la sesión, también lo del día y los que no ingresaron) los campos van uno al lado del
    otro, cada uno de su tamaño: los números (base, largo, ancho, Nro. de jugadores, pausa, C/P
    Jug, series, bloques) y lo calculado (C/P Tarea, m2), una caja chica; los desplegables
    (tipo de sesión, código, zona, Tarea o Partido, tipo y día del microciclo, dispositivo), del
    ancho de su opción más larga, que se mide con las opciones del club; el nombre de la tarea y
    el del partido (van en la descripción), de un largo normal que crece con lo escrito y, al
    llegar al borde, sigue en otro renglón (es un solo renglón: Enter no corta). Ninguno es más
    angosto que su rótulo; lo que no entra pasa abajo (en el celular, también). Un desplegable
    sin nada elegido dice «Elegí…» (el rótulo ya está arriba; si dijera el rótulo, el ancho
    sería el del rótulo). Lo que explica un campo (por ejemplo, el día del microciclo) no lo
    ensancha más de una frase corta. Las listas de varios (los que no ingresaron, las tareas de
    la descripción) y la descripción de la sesión siguen anchas. Descartado: la grilla de
    columnas iguales (cada campo de 190 px o más).
  - Santiago, 13/10, al verlo: «esta bien, pero fijate que no hay orden visual, esta todo uno
    al lado del otro y es confuso, como hiciste con los porcentajes, hay que encontrar una
    manera de darle orden visual y separar las cosas para que se entienda bien, por ejemplo
    poner los 2 CPJ y CPT por un lado, Todas las mediciones y m2 por otro y asi». La tarjeta de
    cada bloque va en partes, cada una en su recuadro con su título, como el de los %: «La
    tarea» / «El partido» / «La sesión» (el nombre, Tarea o Partido, código y zona), «Medidas»
    (base, largo, ancho, Nro. de jugadores y m2), «Pausa» (series, bloques, pausa, C/P Jug y
    C/P Tarea) y, en la sesión, «Descripción» (las tareas que van y la descripción que queda).
    Una al lado de la otra si entran; la descripción, a todo el ancho. Después, el % vs V.R.
    de partido en su recuadro. Una parte sin nada a la vista (por ejemplo, las medidas del partido, ocultas en
    Ajustes) no va. Adentro, lo que se escribe va en blanco y lo calculado, en gris. Agregar un
    jugador sigue al final. Descartado: todos los campos sueltos uno al lado del otro.
  - Santiago, 13/10, al verlo agrupado: «sacale densidad a tipo de sesion xq no es eso la
    densidad y tiene que ir con la tarea». La columna se llama «Tipo de Sesión» (en portugués,
    «Tipo de Sessão») en toda la app: la Base, Ajustes y Cargar. Al pegar desde Excel se sigue
    reconociendo «Tipo de Sesión (Densidad)», como dice la hoja `BD_GPS`. En Cargar, el tipo de
    sesión va en la parte de la tarea (del partido o de la sesión), después del nombre. Una
    primera versión ponía el tipo de sesión con los % en una parte «Densidad»: descartada. Qué
    es la densidad no se definió; los % siguen siendo con los que Santiago la decide («No estan
    los % vs vr de partido con los que se decide la densidad de la sesion», 12/10).
  - Santiago, 13/10, con una captura de una tarea: «pasa el bloque de pausa abajo de las
    medidas porfavor». «Medidas» y, debajo, «Pausa» van en una columna, al lado de la parte de
    la tarea (del partido o de la sesión) si entra, o debajo de ella si no.
  - Santiago, 13/10, con dos capturas de una tarea: «La descripcion pasa a estar sola en una
    fila y las demas cosas dentro de la tarea pasan abajo, si la descripcion es mas larga que
    el cuadrado se agranda hacia abajo y todo se corre hacia abajo» y «Fijate que no llega
    hasta el limite del cuadro de la descripcion y se empieza a agrandar antes de llegar»; y
    después: «para agrandarse hacia abajo tiene que estar cerca del limite del cuadrado de La
    tarea y de ahi crecer hacia abajo». El nombre de la tarea (y el del partido) va solo en su
    renglón, a todo el ancho de su parte, y el tipo de sesión, el código y la zona, abajo. Lo
    escrito ya no ensancha nada (antes la pantalla acomodaba las partes según el largo del
    texto, por eso «Medidas» y «Pausa» saltaban abajo aunque el texto no llegara al borde):
    cuando llega al borde, la caja crece un renglón hacia abajo y lo demás se corre. Comprobado
    escribiendo de a una letra en la compu, el celular y con la pantalla agrandada: la caja
    crece justo cuando el texto pasa de renglón. Descartado: que el nombre crezca hacia el
    costado.
  - Santiago, 13/10, con una captura de un nombre con una palabra larga sin espacios: «cada ves
    que se llegue al limite del cuadrado tiene que crecer otro renglon hacia abajo, no puede
    tener limite de caracteres» y «la caja se salio del cuadro tmb». El nombre de la tarea y el
    del partido no tienen tope de letras (antes, 200 y 120; la base no tiene tope para lo que
    se guarda). Una palabra sin espacios se corta en el borde y sigue abajo: la caja no sale
    de su parte, y el título del paso, tampoco de la pantalla. Comprobado con un nombre de 479
    letras con palabras sin espacios, en la compu, el celular y con la pantalla agrandada.
- **Las cuentas son las de la hoja «Sesion Partido» de la plantilla**: una sola fila Total por
  jugador y día (la que junta todo lo que hizo; si hizo una sola cosa, esa) y las demás
  Parcial; el Team Average de cada tarea, con los «Va tarea»; el de cada tiempo del partido,
  la suma ÷ 10; el total de la sesión, sesión + regenerativo, regenerativo, no entrenaron, el
  Team Average final y el adicional. Comprobado solo en la máquina de trabajo contra dos días
  reales de `BD_GPS`: el entrenamiento del 09/10 da igual en sus 132 filas y el partido del
  08/10 en sus 43, salvo lo cambiado a mano en el Excel y los errores corregidos (abajo).
- **Las reglas, en Ajustes › Reglas de carga** (Santiago, 10/10: los números de las reglas
  quedan en Ajustes): inicio del microciclo 1, Va tarea (75 %), Team Average de cada tiempo del
  partido (÷ 10), jugadores para un Team Average (4), sesión de la tarde (13:00), regenerativo
  que cuenta (7), los cortes de sesión + regenerativo y de los que no entrenaron (apagados,
  «como pasa hoy»; 30 % del plantel) y «Día de partido, van todos». Se guardan por club en
  `gps_reglas`; sin la migración, valen las de la plantilla y Ajustes avisa qué SQL falta.
  Cambian lo que se carga desde ahí; lo guardado queda como está.
- **Errores chicos de la plantilla, corregidos** («Corregirlos», 10/10): rangos corridos una
  fila; HDOP del partido completo tomado del jugador de arriba; «Total» decidido por la
  distancia en lugar de por el jugador; la relación pausa / trabajo sin las horas; la
  clasificación del día sin _M / _T; las horas y la calidad GNSS del regenerativo, que salían
  de otras columnas; el tiempo del total con partido y tareas llega al final de la última tarea
  (la plantilla miraba la primera); GNSS y HDOP del total miran todas sus filas (la plantilla,
  solo las tareas); el inicio del Team Average de la sesión es el más temprano; inicio y fin de
  los que no ingresaron, los del partido. En el Team Average final, Aceleración Máxima y
  Esfuerzo Explosivo/min quedan vacíos (el Excel ponía 0).
- **Como el historial, a confirmar con Santiago**:
  - El día de partido todos los del partido, también los que no ingresaron, van en el Team
    Average de la sesión («Va» Si), como está en el historial. Se apaga en Reglas de carga.
  - Quien está en readaptación: en el historial su «Va» No del total se puso a mano; en la app
    también se cambia a mano, al revisar.
  - Minutos Campo va en cada fila Total (el tiempo en minutos, con un decimal), también el día
    de partido; en el partido comparado no coincide con el historial en esas filas: falta
    confirmar cuál va.
- **Lo que todavía no hace**: PSE y Unidad Arbitraria no se calculan (la PSE se escribe al
  revisar); los V.R. por dispositivo esperan el paso 4 (el % vs V.R. de partido de Cargar usa
  los de la plantilla, uno solo para el club; desde el 14/10, el de partido de cada
  dispositivo); la marca fija de la selección
  (la define Santiago); las columnas del club que vienen en el CSV van solo en las filas de
  cada jugador; traerlo directo de OpenField (paso 5).
- **Dejar para revisar y «Sin terminar» (13/10, migración `20261021_gps_en_curso.sql`).** Nota
  del 13/10: «Dejar un boton dentro de carga de gps donde pueda dejar el entrenamiento para
  revisar». Santiago, 13/10: «Yo lo que quiero es poder guardarlo en la computadora y poder
  seguirlo desde mi celular donde lo deje o vicerversa»; quién la ve: «cualquiera con los
  permisos para verla»; un día que ya tiene una carga sin terminar: «lo frena y dice que ya esta
  en curso ese cargado»; varias a la vez: «si puede»; «la intencion es que aparesca en un cuadro
  abajo de cargar como aparecen las lesion sin fecha de retorno».
  - En cada paso, con un CSV leído, debajo del título: **«Dejar para revisar»**. Guarda en la
    base todo lo hecho (el CSV, lo elegido en cada paso y lo corregido en las tablas) y el paso,
    y vuelve a Cargar. No entra a la Base ni a los reportes.
  - En Cargar, abajo de «Cargar un día», el cuadro **«N cargas sin terminar»**, con la cara de
    las lesiones en curso de Lesiones: la fecha del entrenamiento, «Paso X de Y», el nombre del
    paso, quién la dejó y cuándo, **Seguir** (abre en ese paso, en este aparato o en otro) y el
    tacho (borra, preguntando antes). Aparece sola en los otros aparatos (Realtime).
  - La ve, la sigue y la borra quien tiene GPS en el club y sigue (el permiso, una vez por
    pedido, como la tabla `gps`); quien ya se fue, no. Quién la dejó y cuándo lo pone la base.
  - **Una por día**: si ese día ya tiene una, el paso del CSV lo dice («Ya hay una carga en
    curso del …, la dejó …») y no deja seguir ni dejar otra; al guardar en la Base se vuelve a
    mirar. Al guardar en la Base, deja de estar sin terminar. Reabierta (23/10, UI-075): varias
    por día; la del mismo CSV se frena con aviso (ver «Hecho, paso 3c.2a»).
  - Si la siguieron desde otro aparato mientras estaba abierta, no se pisa: avisa («La
    siguieron desde otro aparato…») y deja abrir la última (cada vez que se deja, la versión
    sube).
  - En la base: `gps_en_curso` (la lista, liviana, en Realtime) y `gps_en_curso_datos` (lo
    hecho, aparte: no viaja a cada aparato), que se guardan juntas con `gps_dejar_en_curso`
    (todo o nada, con los permisos de quien la llama). Sin la migración, el cuadro no aparece
    y «Dejar para revisar» avisa qué SQL falta.

### Pendiente

- Pasos 3 a 5 (arriba).
- Cargar, el rival del 12/10 (Santiago, 12/10): ver con Santiago si el partido con fecha 12/10
  quedó guardado en la base (no solo en el celular, sin sincronizar) y si el CSV traía PRIMER
  TIEMPO y SEGUNDO TIEMPO. Con esta versión la pantalla dice cuál de las dos cosas pasó.
  13/10: «no aparecio el rival». En el código no se encontró la falla (Partido guarda la fecha
  como aaaa-mm-dd, la misma que busca Cargar, en el club elegido en ese aparato; la base solo
  deja leer los partidos a quien tiene Partido en ese club). Para saber cuál es: qué frase dice
  el paso del CSV sobre Partido y una consulta de solo lectura (pasada en el chat) con los
  partidos de esos días, su club y los permisos de Santiago en cada club.
- Cargar, si el CSV ya está en la Base (Santiago, 13/10): «Lo de si el csv esta cargado en la
  base tendria que salir del propio csv, xq con el hecho de cambiarlo en la fecha del dia en la
  web ya puede cargarse un csv que ya se cargo […] por ahora dejemoslo asi pero despues hay que
  cambiarlo». Hoy se comparan las filas del CSV con las de la Base del día elegido en la
  pantalla (al llegar a la fecha y otra vez al guardar; `filasYaEnLaBase` en
  `src/domain/gps/cargar.js`, usada en `src/CargarGps.jsx`). Si se cambia la fecha, se mira
  otro día y un CSV ya cargado se puede cargar de nuevo. Queda así hasta que se cambie; cómo
  sale del CSV (su propia fecha, sus datos o las dos cosas) se define con Santiago al hacerlo.
- ~~¿Los V.R. de partido van por dispositivo (paso 4)? Hoy hay uno solo por club, como la
  plantilla.~~ Decidido el 14/10: «El de partido de cada dispositivo» (ver «Los V.R. se
  cambian: una solapa en cada base (14/10)»).
- ~~El promedio del % vs V.R. de partido va en verde desde el 70 % (la plantilla) y no desde el
  90 % que dijo Santiago el 13/10: confirmar cuál (se cambia en Ajustes › Reglas de carga).~~
  Confirmado el 13/10: queda en 70 % («el promedio dejalo asi»).
- Lo descartado del regenerativo (quien está en el CSV ya no se elige): confirmar con Santiago
  que no hay días con sesión y regenerativo para la misma persona.
- A quien administra el club, o a un dueño de la app, un permiso nuevo (como GPS) no se le da
  desde Cuentas: nadie cambia su propia fila y la de un administrador o un dueño no la cambia la
  app. Se da con un SQL en Supabase › SQL Editor (Santiago se dio GPS así, 10/10). Si hace falta
  muchas veces, se puede pensar una forma desde la app.
- En la tabla de todas las bases, Mayúscula + flecha suma una sola fila a lo elegido (no va
  sumando como en Excel); Mayúscula + clic sí elige el rango. Visto el 11/10; no se tocó.
- ~~Las horas de entrenamiento de Lesiones (cada 1000 horas) salen de los minutos del GPS
  (decisión del 03/10, en «Lesiones: lo que sigue»): ahora que el GPS está en la app, falta
  conectarlas (cuáles columnas son los minutos de cada jugador por día).~~ Conectadas el 11/10:
  ver «Lo anotado en Notas», tiempos de selección.
- ~~La foto de la tarjeta: hasta que haya, va el dibujo.~~ Puesta el 13/10 (las mandó Santiago:
  «Modulo de gps»); ver «Bases de Datos (05/10)», Fotos.

## Cuentas paso 2: dueños, sub-dueños y pedidos por club (06/10)

Migración `supabase/migrations/20261014_duenos_y_pedidos.sql` (antes, para mirar,
`20261014_revisar_duenos.sql`). Lo que cambia:

- **Dueños de la app.** Un dueño principal y sub-dueños, en tablas aparte (`plataforma`,
  `plataforma_subduenos`), fuera de `perfiles`: el admin de un club no ve la lista de
  dueños; de la gente de su club solo sabe si alguien es dueño (`protegido` en
  `v_miembros_club`), para no ofrecerle acciones.
  Solo el principal suma o quita sub-dueños y pasa su lugar (solo a un sub-dueño; él queda
  como sub). Los sub-dueños hacen todo lo demás: crear clubes, cambiarles el nombre (desde
  el 09/10), asignar y cambiar el correo de la entidad, ver el panel y Movimientos. Al
  principal nadie lo saca de la plataforma.
- **Dueños protegidos en los clubes (decisión del dueño, 08/10).** A ningún dueño, principal
  ni sub-dueño, lo saca otra persona de un club (tampoco otro dueño): nadie le da de baja, le
  cambia los módulos ni borra su fila; solo él se va (`salir_del_club`). La base lo frena
  (`dueno_protegido`) y en Cuentas su fila dice «Dueño de la app» / «Dono do app», sin chips
  ni «Dar de baja»/«Reincorporar» (como la de otro admin). Si el principal le saca el rol a
  un sub-dueño, pasa a ser un miembro común y su admin lo maneja como a cualquiera.
  Tampoco lo mete nadie (revisión del 08/10): la invitación de otro le queda abierta, como
  la de un correo sin cuenta (también si el dueño se cambia el correo a esa dirección,
  revisión del 09/10), y a un club del que se fue vuelve solo con un pedido suyo que
  acepta el admin. Así, invitar un correo no sirve para averiguar si es dueño (`protegido`
  responde solo por quien comparte club). Con las invitaciones por mail (09/10), el mail de
  esa invitación no sale y quien invita ve lo mismo que cuando un mail no sale, nunca que
  el correo tiene cuenta (ver «Invitación a un dueño de la app» en «Invitaciones por
  mail»). Por lo mismo, la historia del club anota la entidad sin decir qué dueño la puso
  (eso queda en Movimientos).
- **Salir de un club, en un solo lugar (08/10).** Cualquier miembro activo se va desde el
  portal › Cambiar (`src/ElegirClub.jsx`): abajo de todo, «Salir de {club}» para el club
  elegido, como enlace (no compite con elegir club), con la hoja de confirmar de siempre.
  Después queda en solo lectura hasta hoy, como cualquiera que se fue. No vuelve a la fila
  propia de Cuentas (de ahí se sacó «Salir del club»: la fila propia no tiene acciones).
- **Panel «Clubes de la app»** (`src/ClubesDeLaApp.jsx`): de cada club solo nombre, correo
  de la entidad, correo del administrador y cantidad de personas; lo garantiza la base
  (`panel_clubes`). Crear un club (nombre, entidad opcional, zona de una lista corta),
  cambiarle el nombre (desde el 09/10; muestra el anterior y el nuevo antes de guardar),
  asignar/cambiar/sacar la entidad (cambiarla muestra el correo anterior y el nuevo),
  pedidos de clubes que no están, dueños y Movimientos. Ya no hay lista global de cuentas,
  aprobación de cuentas ni contador en el portal; los dueños no aceptan a nadie en un club.
- **Pedidos de acceso por club** (`src/PedidoAcceso.jsx`, tabla `club_pedidos`): quien entra
  sin invitación escribe el club (nombre y país), manda el pedido y espera. Nada más. Lo
  acepta (eligiendo módulos; entra como staff) o lo rechaza el administrador de ese club,
  arriba de todo en Cuentas. Rechazado: sale de la lista y la persona puede volver a pedir.
  Si el nombre no coincide con ningún club, va a «Pedidos de clubes que no están» del panel,
  y un dueño lo manda al club que corresponde (ahí decide su admin) o lo rechaza. Desde el
  08/10 también van al panel los pedidos a un club sin administrador (o que se quedó sin él:
  su pedido abierto pasa a verse ahí); al mandarlo, los clubes sin administrador se ven
  deshabilitados («Sin administrador») y la base no deja (`club_sin_admin`). La persona
  ve lo mismo en todos los casos («Esperando autorización de» lo que escribió). El invitado
  nunca ve esa pantalla. Una cuenta autorizada que se quedó sin ningún club activo ve el
  mismo formulario al elegir club. Desde el 09/10, cualquier cuenta, también con clubes
  activos, pide entrar a otro club desde portal › Cambiar: «Pedir entrar a otro club»,
  enlace debajo de la lista (no compite con elegir ni con «Salir de»), que abre el mismo
  formulario o, con un pedido abierto, «Esperando autorización de {club}» con Cancelar.
  Sigue habiendo un pedido abierto por cuenta y la persona nunca sabe si el club usa la
  app.
- **El admin del club** invita solo como staff (ya no hay chip de rol), da y saca módulos,
  da de baja y reincorpora (la fecha de entrada cambia solo al reincorporar; cuándo se creó
  la fila y quién decidió, los anota la base). No toca a otro admin, ni a sí mismo, ni a un
  dueño de la app (la base lo frena aunque la pantalla no lo supiera). Sacar a alguien de un
  club no lo saca de otro. Bloquear una cuenta en toda la app ya no está en la app: solo por
  SQL.
- **Clubes**: se crean solo desde el panel; no se borran desde la app (solo por SQL); el
  nombre lo cambia el admin del club (Partido › Ajustes › Equipo ya no crea clubes).
  **Reemplazado el 09/10** (ver el punto que sigue): el nombre ya no lo cambia el admin.
- **Los datos de un club los cambian solo los dueños (decisión del dueño, 09/10, en el
  chat).** Palabras del dueño: «Nadie puede cambiar el club ni modificarlo, solo yo o sub
  dueños» y «nadie puede modificar el nombre o agregar un club (Por eso dijimos que tenían
  que estar todos los clubes en la elección de clubes), Solo se pueden hacer pedidos de
  agregar un club que no esté. NADIE MODIFICA NADA DE NINGUN CLUB NI DEL NOMBRE DEL CLUB
  SOLO EL DUEÑO O SUB DUEÑO». Reemplaza la decisión 8 de este paso («El nombre lo cambia
  el admin del club»).
  - El nombre (y cualquier otro dato de `equipos`) lo cambian solo el dueño principal y
    los sub-dueños, desde Clubes de la app: «Cambiar nombre» en cada club (acción
    secundaria), con una confirmación que muestra el nombre anterior y el nuevo
    (`renombrar_club`; mismas reglas que al crear: hasta 60 letras y distinto de los otros
    clubes sin contar tildes ni mayúsculas). Queda en Movimientos («Nombre: {antes} →
    {nombre}») y en la historia del club sin decir qué dueño fue («El club pasó a llamarse
    {nombre}»; Cuentas hoy muestra la historia de cada persona, así que esa fila, como la
    de la entidad, se va a ver cuando haya historia del club, en el paso 3).
  - Crear clubes sigue siendo solo de los dueños. El administrador del club sigue
    manejando la gente de su club (invitar como staff, aceptar pedidos, módulos, bajas):
    eso no es modificar el club.
  - **Queda prohibido:** que el administrador, la entidad o el staff cambien el nombre u
    otro dato del club; volver a poner renombrar en Partido › Ajustes › Equipo (se sacó el
    09/10: la tarjeta «Tu equipo» muestra el escudo y el nombre, nada más) o ponerlo en
    Cuentas. La base lo frena igual (`equipos` sin UPDATE para las cuentas; solo la función
    de los dueños).
- **Catapult**: el token del servidor es de Atlético Mineiro (`plataforma.catapult_equipo`,
  se cambia por SQL). Solo quien tiene Flujo diario en ese club usa Flujo diario y los
  chalecos; el resto ve «Tu club todavía no conectó Catapult en la app». Pruebas técnicas
  aparece solo si la sesión de OpenField volvió con rol admin (el dueño principal con Flujo
  diario en ese club).

**Visto en la revisión del 08/10, queda afuera de este paso (a decidir o para otra rama):**
- **Resuelto el 09/10** (el nombre lo cambian solo los dueños, ver arriba; queda en
  Movimientos). Lo que se había anotado:
  Renombrar un club (lo hace su admin): como dos clubes no se escriben igual
  (`nombre_repetido`, contra todos los clubes), el admin puede averiguar si un nombre es de
  un club de la app que no ve; y si le pone a su club el nombre de un club que todavía no
  está en la app, desde ahí le llegan los pedidos de quien escriba ese nombre (antes iban
  al panel). El cambio de nombre no queda en Movimientos. Lo decide el dueño (hasta el
  catálogo del paso 6): por ejemplo, anotar los renombres en Movimientos o que el nombre lo
  cambien los dueños.
- **Ya no aplica desde el 09/10** (Partido no cambia más el nombre; en el panel el campo
  llega hasta 60 letras y `nombre_invalido` tiene su texto). Lo que se había anotado:
  Partido › Ajustes › Equipo: con un nombre de más de 60 letras la base contesta
  `nombre_invalido` y la pantalla dice que falla la señal. Arreglarlo toca `src/App.js`
  (Partido, fuera de este paso): un motivo propio en `motivoDelError`
  (`src/domain/equipo.js`), su texto en es-AR y pt-BR y `maxLength={60}` en el campo.

**Orden para ponerlo en producción (estricto):**
1. CI en verde.
2. Supabase › SQL Editor: correr `20261014_revisar_duenos.sql` y anotar el correo exacto del
   principal y de los sub-dueños y el nombre exacto del club del token.
3. Pegar `20261014_duenos_y_pedidos.sql` completando `CORREO_DEL_DUENO_PRINCIPAL`,
   `CORREOS_DE_SUBDUENOS` y `NOMBRE_DEL_CLUB_DEL_TOKEN_CATAPULT`, y correrla. Es una sola
   transacción con autoverificación: si algo no da, no cambia nada y dice qué falta. Mirar
   las consultas del final.
4. Recién ahí unir el cambio (Vercel publica la app y el servidor juntos) y subir la versión.
   La app nueva contra la base vieja no anda (el panel dice que falta actualizar la base;
   Flujo diario contesta 503). Volver a publicar el deploy anterior sí es seguro.

**Regla para cada migración nueva:** los privilegios por defecto de Postgres le dan EXECUTE a
PUBLIC (y con eso a anon) a toda función nueva, y un revoke por esquema no lo saca. Cada
migración que cree funciones repite, antes de su autoverificación,
`revoke execute on all functions in schema public from public, anon` y vuelve a dar la lista
blanca a authenticated.

**Queda para el paso 3 (la entidad y un solo admin):**
- La entidad del club: hoy su correo es solo un dato del panel. Se vincula a su cuenta, y
  al aceptarla tiene que poner una contraseña nueva (confirmar el correo solo no alcanza:
  alguien pudo crear antes la cuenta con ese correo y su propia contraseña).
- Un solo administrador por club, que nombra la entidad, y un suplente.
- La lista de la gente del club para el staff (solo lectura, sin módulos).
- Club en solo lectura: si se le revoca la entidad, el club sigue mirando sus datos y
  usando lo demás, sin cargar nada nuevo (pedido del dueño).
- Cerrar `perfiles.admin` (queda en false pero legible, porque la app vieja lo lee en la
  ventana entre el SQL y la publicación) y sacarle `puede_usar` a authenticated, para que un
  servidor viejo no pueda abrir el Catapult de otro club.
- Hasta entonces, un club sin admin no puede invitar ni aceptar pedidos (desde la app no
  se nombran administradores; sus pedidos esperan en el panel de los dueños), y un club
  creado en el panel queda vacío.

**Paso 5:** la invitación por correo (un enlace que abre «Crear cuenta» con el correo fijo) y
un aviso al dueño cuando llega un pedido sin club. Desde el 09/10 la invitación llega por
mail y su enlace abre la bienvenida, donde se elige la contraseña (ver «Invitaciones por
mail» en «Entrada a la app»); queda el aviso al dueño.

**Paso 6:** el catálogo mundial de clubes (elegir el club de una lista en vez de escribirlo).

## El siguiente nivel: un club entero usando esto (plan del 02/10)

Santiago: "hoy tuve la noticia de que vamos a tener que hacer esto un software muy
potente y muy seguro, para que un club entero lo use". Más allá de los módulos, lo
que hay que resolver es la lógica de seguridad y confianza. Lo que ya está y lo
que falta, en el orden en que conviene hacerlo:

**Ya está**: cuentas con autorización y módulos; clubes con membresía y fecha de
salida (quien se fue ve hasta su último día, decidido por la base, no por la
pantalla); todo lo guardado lleva su club; historial de cambios en Lesiones;
migraciones versionadas en `supabase/migrations`.

**Lo que falta, por orden:**

1. **Roles por club y entrada por invitación.** Hoy el permiso de cada módulo es
   global (`perfiles.partido/flujo/lesiones`) y hay un solo administrador para todo.
   Tiene que pasar a la membresía: `club_miembros` con rol (administrador del club o
   staff) y módulos por club; `perfiles.admin` queda como dueño de la plataforma.
   Entrar por invitación (`club_invitaciones`: correo, club, rol): al registrarse con
   ese correo, la cuenta queda autorizada y adentro del club sola; sin invitación no
   entra a ningún club. `puede_usar(modulo)` pasa a `puede_usar(club, modulo)`.
2. **Pruebas de permisos contra una base de prueba.** Lo que protege los datos son
   las políticas; hoy no hay pruebas automáticas de ellas. Falta un segundo proyecto
   de Supabase (prueba) y una batería que entra con varias cuentas (admin, staff,
   ex-miembro, otro club) y verifica fila por fila qué ve y qué puede cambiar cada
   una. Las migraciones se corren primero ahí y después en producción (Supabase CLI,
   no el editor a mano).
3. **Fotos de los datos (historial en todas las tablas).** Hoy el ex-miembro ve las
   filas de hasta su último día, pero con los cambios posteriores. Para que vea
   exactamente lo que había ese día: un disparador genérico que guarde cada versión
   (como `lesiones_historial`, pero para partidos, entrenamientos, jugadores y
   lesiones) y vistas "al día X". Lo mismo da papelera en vez de borrado definitivo
   (hoy "borrar historial" de Partido borra de verdad) y auditoría de quién cambió qué.
4. **El celular.** Al cerrar sesión o al quedar fuera de un club, borrar las copias
   locales de ese club (respaldo de partidos, pendientes, plantel, perfil). Sesiones
   cortas con renovación, y revisar la membresía en cada apertura (hoy se hace al
   volver al portal).
5. **Cuentas más duras.** Correo confirmado obligatorio (ya), contraseñas fuertes,
   segundo factor para administradores (Supabase lo trae), aviso por correo cuando
   alguien entra desde un aparato nuevo.
6. **Datos médicos.** Las lesiones son datos de salud (LGPD en Brasil, Ley 25.326 en
   Argentina): solo el rol médico ve el detalle, el resto ve disponible o no;
   registro de quién consultó; exportar y borrar a pedido del jugador.
7. **Copias de seguridad y plan.** Producción no puede quedar en el plan gratuito
   (se pausa por inactividad, sin copias automáticas). Plan Pro con copias diarias y
   recuperación a un punto en el tiempo, más una exportación completa por club
   (todo lo del club en un archivo) que el club pueda pedir cuando quiera.
8. **Una base por club.** El volumen no es el problema (Postgres aguanta décadas de
   partidos, entrenamientos y lesiones de un club); lo que vale es el aislamiento y
   que cada club sea dueño de lo suyo. Como todo ya lleva su club, el camino es:
   seguir con una base ahora, con las pruebas del punto 2; y cuando un club lo
   pida (o por contrato), darle su propio proyecto de Supabase. El código no
   cambia: se suma un "directorio de clubes" que le dice a la app a qué base ir, y
   la exportación del punto 7 es la mudanza. Costo: un proyecto Pro por club.

### Cómo dar una base por club sin que sea un trabajo (decidido el 02/10)

- **Directorio de clubes**: un proyecto chico y central de Supabase con una sola tabla
  (`clubes`: código, nombre, URL del proyecto, clave pública) y la lista de dueños de la
  plataforma. La app arranca pidiendo el código del club (o lo saca del subdominio,
  `cam.laapp.com`), busca en el directorio a qué base ir y recién ahí crea el cliente de
  Supabase y pide usuario y contraseña. Todo lo demás (migraciones, políticas, membresías)
  queda igual. Varios clubes pueden apuntar a la misma base (los chicos o los de prueba) y
  un club pago tiene la suya: la app no distingue.
- **Un comando para crear un club**: `npm run club:nuevo -- "Nombre del club" --dedicado`
  usa la API de administración de Supabase (con un token guardado como secreto, nunca en
  el repo) para crear el proyecto en la organización, esperar a que esté listo, correr
  todas las migraciones de `supabase/migrations`, configurar el acceso (correo confirmado,
  URL de la app), dejar la invitación del primer administrador y anotar el club en el
  directorio. Minutos, sin tocar nada a mano. Sin `--dedicado`, solo anota el club en la
  base compartida.
- **Un comando para actualizar todos**: `npm run migrar:todos` corre lo que falte de
  `supabase/migrations` en cada base del directorio, primero en la de prueba. Queda en
  GitHub Actions para que no dependa de una computadora.
- **Copias y exportación**: cada base dedicada tiene sus copias diarias (plan Pro) y
  `npm run club:exportar -- codigo` baja todo lo del club en un archivo. Lo mismo sirve
  para mudar un club de la base compartida a la suya.
- **¿Plan gratuito con una cuenta por club?** Se puede (el directorio acepta cualquier
  proyecto), pero no para vender: el proyecto gratuito se pausa a la semana sin uso, no
  tiene copias de seguridad, el correo de acceso tiene un límite de pocos envíos por hora
  y el club tendría que crear la cuenta, el proyecto y pasar las claves. Queda solo para
  demostraciones y pruebas. Dos caminos serios: (a) proyectos dentro de la organización
  propia en plan Pro (del orden de 10 USD por mes por club, va en el precio), con copias,
  sin pausas y con control total para migrar; (b) para el club que exige ser dueño, su
  propia cuenta paga y una invitación al operador (rol Developer) para correr las
  migraciones; el club puede revocarla cuando quiera. El administrador del club no
  necesita cuenta de Supabase: administra desde Cuentas en la app.
- Lo que hay que preparar: organización de Supabase en plan Pro, un token de
  administración, la región (San Pablo), y un dominio con subdominio comodín en Vercel.
  Las funciones del servidor (`api/openfield`) reciben el código del club y validan la
  sesión contra esa base.

### Cuentas v2: hecho el 02/10 (migración `20261004_cuentas_v2.sql`, corrida el 02/10)

- Rol (admin del club o staff) y módulos por club en `club_miembros`; la cuenta solo
  dice si está autorizada y si es dueña de la plataforma (`perfiles.admin`).
- Invitaciones por correo (`club_invitaciones`): si la cuenta existe y confirmó el
  correo, entra en el acto; si no, al confirmarlo. Vencen a los 14 días; se cancelan.
- Historia de cada membresía (`club_miembros_historial`), con quién y cuándo.
- Un club nunca queda sin administrador; la salida no puede ser futura; una membresía
  no se muda de club; solo el dueño crea clubes; los ajustes generales los cambia el
  dueño; un partido repetido es por club (antes chocaban dos clubes distintos).
- Pantalla Cuentas: gente del club (invitar, rol, módulos, dar de baja con fecha,
  reincorporar, historia) y, para el dueño, las cuentas de la app.
- Al salir de la cuenta se borran del celular el club elegido y las copias de los
  clubes (no lo que no se subió). Al dejar un club, las copias de ese club.
- **Pruebas de permisos contra un Postgres de verdad** (`supabase/pruebas`,
  `npm run pruebas:base`): todas las migraciones desde cero y más de 100 escenarios
  (cada tipo de cuenta, qué ve y qué cambia). Corren en GitHub Actions en cada cambio
  (`.github/workflows/pruebas.yml`), junto con las de la app y la compilación.

### Foto al día de salida: hecho el 02/10 (migración `20261005_foto_al_dia.sql`, corrida el 02/10)

- Quien se fue de un club ve cada partido, entrenamiento, jugador y lesión **tal como
  estaba al terminar su último día** (en la zona horaria del club). No ve lo que se
  cargó, se cambió ni se borró después.
- La base guarda una versión por fila y por día en que se tocó (`versiones_datos`, la
  escribe un disparador). `datos_al_dia(tabla, club)` arma la foto y pide el módulo
  (Partido, Flujo diario, Lesiones; el plantel, cualquier membresía).
- Las tablas solo se leen directo estando en el club: quien se fue lee únicamente la
  foto. El historial de cambios de una lesión tampoco (tendría lo de después).
- En la app, un club del que ya se fue es de solo lectura en todos los módulos:
  - Partido: inicio con el aviso y "Ver registros"; sin tablero, sin cargar formación,
    sin editar ni borrar registros, Ajustes de equipo y jugadores apagados. No sube
    los partidos pendientes de ese club (quedan guardados en el celular) y no guarda
    la foto en el celular.
  - Flujo diario: la lista es la de la foto; se abre y se mira, pero cualquier cambio
    muestra "Solo lectura" y no se guarda ni se sube. Sin Enviar ni Borrar. En Ajustes,
    la lista de jugadores se mira sin agregar ni emparejar chalecos.
  - Lesiones y Datos básicos: como antes, ahora con la foto; la tabla ya no ofrece
    Pegar (no había nada que se pudiera cambiar) ni la ficha el historial de cambios.
- Arreglo de paso: en Flujo diario, cada club ve solo sus entrenamientos aunque el
  celular tenga guardados los de otro club de la misma cuenta.
- Lo que ya estaba cargado arranca así: las lesiones, con toda su historia; partidos y
  jugadores, desde el día en que se crearon; entrenamientos, desde su último cambio. Ver
  "Limitaciones conocidas". De la migración en adelante es exacto.
- La zona horaria del club (`equipos.zona_horaria`) tiene que existir (la base la
  controla) y desde la app no se cambia: desde la app, de un club solo se cambia el
  nombre. Si igual quedara una mala, la carga de datos no se frena (usa la de siempre).
- Una fila que se pasa a otro club deja de estar en la foto del anterior desde ese día.
- Las migraciones 20261003 y 20261004 se niegan a correr si ya está corrida una
  posterior (desharían lo nuevo). Se comprueba en `supabase/pruebas/correr.sh`.
- Guardar sigue siendo rápido con mucha historia: con 400.000 versiones, guardar una
  fila tarda entre 0,5 y 2 ms (sin el ajuste del índice eran 18 a 38 ms).
- Escenarios nuevos en `supabase/pruebas/escenarios.sql`: la foto de quien se fue
  (partido de las 23:30 de su último día sí, el de las 00:30 del día siguiente no), un
  resultado cambiado y un partido borrado después de su salida, sin el módulo, cuenta
  pendiente y bloqueada, reincorporación, zona horaria (no la cambia un admin de club,
  una inválida no entra, una rota no frena la carga) y un partido que pasa a otro club.
- Orden para ponerlo en producción: primero se une el cambio (la app se publica sola) y
  enseguida se corre la migración. Mientras tanto nadie se ve afectado: todavía no hay
  nadie dado de baja en la base.

**Lo que sigue en cuentas:**
- Zona horaria del club editable desde la app (hoy queda America/Sao_Paulo; se cambia
  en `equipos.zona_horaria`).
- Segundo factor para administradores, aviso por aparato nuevo, cerrar sesión en todos.

### Cuentas v2: los escenarios que tiene que cubrir (decidido el 02/10)

Modelo: **cuenta** (correo), **club**, **membresía** (cuenta × club, con rol, módulos y
fecha de salida) y **historial de membresía** (cada alta, baja, cambio de rol, con quién
y cuándo). `perfiles.admin` pasa a ser "dueño de la plataforma"; el administrador de
cada club vive en la membresía.

1. Invitar (correo + rol + módulos) → la persona se registra con ese correo y entra
   solo a ese club. Invitación con vencimiento, reenviar, cancelar. Sin invitación no
   se entra a ningún club.
2. Cuenta que ya existe, invitada a otro club → le aparece en "Mis clubes".
3. Cambiar rol o módulos → al momento, por club.
4. Dar de baja con fecha (hoy, pasada o programada) → ve hasta ese día, no escribe;
   el celular borra las copias locales de ese club; la sesión sigue pero limitada.
5. Reincorporar la misma cuenta → vuelve con todo; el historial muestra los períodos.
6. Bloquear la cuenta entera (dueño de la plataforma) → no entra a nada.
7. Nunca queda un club sin administrador: traspaso antes de la baja del último.
8. Mis clubes, cambiar contraseña, cerrar sesión en todos los aparatos, segundo factor
   para administradores, aviso por aparato nuevo.
9. Soporte: el dueño ve membresías, no datos; "modo soporte" con tiempo y registro.
10. Auditoría de cada cambio de cuenta.
11. Pruebas automáticas de permisos contra una base de prueba (segundo proyecto, gratis):
    entra con cada tipo de cuenta y comprueba fila por fila qué ve y qué cambia.

### Entrada a la app: invitación y pedido de acceso (anotado el 02/10, después de Lesiones)

Santiago lo deja para después de terminar cómo se ve Lesiones. La lógica que quiere
para alguien que entra por primera vez:

- **Sin invitación:** entra a la web, crea su cuenta y en la primera pantalla elige el
  club. Le llega un pedido al administrador de ese club, que lo acepta (y le da los
  permisos) o lo rechaza. Un pedido rechazado desaparece de la lista de Cuentas, para que
  no se haga larga.
- **Con invitación:** el enlace de la invitación lo lleva directo a crear la cuenta con el
  correo invitado, que no se puede cambiar.

Cómo está desde el paso 2 (06/10): el pedido de acceso por club ya está (ver «Cuentas
paso 2» arriba). Con invitación sigue igual: el admin invita por correo y copia un mensaje
con el enlace; falta que el enlace abra "Crear cuenta" con el correo escrito y fijo (paso 5).
Desde el 09/10 la invitación además llega por mail (ver "Invitaciones por mail", abajo).
Lo que sigue de abajo es la propuesta del 02/10; lo que difiere del paso 2 vale como está
allá (por ejemplo, rechazado se puede volver a pedir, y el club se escribe hasta que esté
el catálogo).

- Desde el 08/10, en el mensaje que se copia el enlace y el correo van solos en su
  renglón (antes el punto final se pegaba al correo al copiarlo y la persona no podía
  crear la cuenta con ese correo). Invitar y Crear una cuenta rechazan un correo que no
  puede existir (punto al final, dos puntos seguidos, espacios). La base todavía acepta lo
  que pasaba antes. La app no manda ningún correo de invitación: el mensaje lo manda el
  administrador (hasta el 09/10: ver "Invitaciones por mail").
- **Pendiente urgente (08/10, lo encontró Santiago al invitar):** en producción "Confirm
  email" de Supabase está apagado (`/auth/v1/settings` dice `mailer_autoconfirm: true`).
  Así, quien sepa un correo invitado crea la cuenta con ese correo, sin abrir el buzón, y
  entra al club con los módulos de la invitación; también puede registrar antes el correo
  de alguien que todavía no fue invitado. El arreglo es de configuración: primero un SMTP
  propio (el correo que trae Supabase solo les llega a los miembros del equipo del
  proyecto), después prender "Confirm email" (ver README). Hasta entonces no se publica
  el paso 2 de cuentas (pedidos de acceso, sub-dueños y entidades confían en el correo).
- **Invitaciones por mail (09/10).** Santiago: "si envío una invitación, que les llegue al
  mail", con un solo remitente para todos los clubes (SMTP propio, "ARK"). Cómo quedó:
  - Al invitar, y con "Reenviar mail" en cada invitación abierta, el servidor
    (`api/invitar`) le pide a Supabase que mande el mail de invitación, siempre al correo
    de esa invitación: nada de lo que manda la app elige a quién. La invitación se lee con
    la sesión de quien invita, así que solo puede quien administra ese club (desde el paso
    2, un dueño de la app no ve las invitaciones de un club que no administra).
    El mail nombra el club; los textos de todos los correos están en `docs/correos`.
  - Mientras "Confirm email" esté apagado en Supabase, el servidor no manda nada
    (`CONFIRMACION_APAGADA`): el mail crea la cuenta sin contraseña y, con la confirmación
    apagada, quien sepa ese correo se registra con él y se queda con la cuenta y el club.
    La app avisa que la invitación quedó guardada y que se mande con "Copiar mensaje". Lo
    mismo sin la clave del servidor (`SUPABASE_SECRET_KEY`) o si el mail no sale.
  - El enlace vuelve a la app (`/?invitacion=1`) con la sesión abierta: "Bienvenido/a a
    [club]", elige su contraseña ("Guardar y entrar") y entra; la base ya lo metió en el
    club al confirmarse el correo. Si cierra la app en la bienvenida y la vuelve a abrir en
    ese celular (ya sin el enlace), se le sigue pidiendo: el celular anota esa cuenta hasta
    que elige la contraseña (solo esa cuenta; otra entra como siempre). En otro aparato no
    tiene sesión ni contraseña: entra con "Olvidé mi contraseña". Si el invitado ignora el
    mail y usa "Crear una cuenta",
    Supabase no guarda la contraseña que eligió (la cuenta ya existía por la invitación):
    al confirmar el correo, la app le pide que la elija. Un enlace vencido dice "pedile a
    quien te invitó que te lo reenvíe". Si el enlace sirvió pero la app no pudo abrir la
    sesión (sin señal al volver a la app, por ejemplo), la puerta lo dice: con señal,
    volver a cargar la página (si fue la señal, la dirección queda como vino) y, si no,
    "Olvidé mi contraseña" (el correo ya quedó confirmado y la invitación usada: no hay
    nada que reenviar).
  - Si el correo ya tiene una cuenta sin confirmar (de una invitación anterior o porque
    alguien hizo "Crear una cuenta" con ese correo y una contraseña suya), antes de mandar
    el mail el servidor le cambia la contraseña por una al azar que nadie conoce. Al abrir
    el mail, Supabase confirma el correo pero conserva la contraseña que tenga la cuenta, y
    la base la suma al club: sin este paso, quien registró el correo antes entraba al club
    sin haber abierto nunca ese buzón. Si no se puede comprobar la cuenta o cambiarle la
    contraseña, el mail no sale. En la bienvenida solo se entra si Supabase guardó la
    contraseña nueva (eso cierra cualquier otra sesión de la cuenta).
  - Si Supabase contesta con un error suyo (5xx) a "Olvidé mi contraseña" o "Crear una
    cuenta" (por ejemplo, falló el SMTP), la puerta dice "No se pudo mandar el mail. Probá
    de nuevo en un rato." y no "No hay conexión" (supabase-js marca los dos casos igual;
    se distinguen por el estado). Sin señal de verdad sigue diciendo "No hay conexión", y
    la entrada con la copia del celular no cambia. Si se pide otro mail al mismo correo
    antes del minuto (Supabase espera 60 s entre uno y otro, y la invitación cuenta: pasa
    si el invitado toca "Crear una cuenta" enseguida), dice que hay que esperar un minuto,
    y no el texto de Supabase en inglés.
  - El enlace del mail dura lo que diga "Email OTP Expiration" (24 h, el máximo del
    panel); la invitación, 14 días. "Reenviar mail" manda un enlace nuevo y el anterior
    deja de servir.
  - "Sumar a [club]" (Cuentas de la app, el dueño) sigue sin mail: son cuentas que ya
    existen, con la contraseña que eligieron al registrarse. Desde el paso 2 ya no existe
    (ver «Cuentas paso 2»: quien ya tiene cuenta pide entrar o lo invita el admin).
  - **Invitación a un dueño de la app (al unir el paso 2, 09/10).** Fuente: la protección
    de los dueños del paso 2 (revisión del 08/10: invitar un correo no sirve para averiguar
    si es dueño; su invitación queda abierta, como la de un correo sin cuenta). Con el mail,
    Supabase no le escribe a una cuenta confirmada, y antes el servidor contestaba "ya tiene
    cuenta" y Cuentas decía «{correo} ya tiene cuenta: no hace falta el mail»: como la base
    mete en el acto a cualquier otra cuenta confirmada, eso delataba al dueño. Ahora el
    servidor (`api/invitar`) contesta exactamente lo mismo que cuando el mail no sale
    (`ENVIO_FALLIDO`), y Cuentas, al invitar y con "Reenviar mail", muestra el aviso de
    siempre: «La invitación quedó guardada, pero el mail no salió. Mandale el mensaje con
    «Copiar mensaje».» / «O convite ficou salvo, mas o e-mail não saiu…». Es cierto (no
    salió ningún mail) y no dice que la cuenta exista. La invitación queda abierta, con
    "Copiar mensaje", "Reenviar mail" y "Cancelar", como cualquier otra. **Queda
    prohibido:** que el servidor o la app digan, para una invitación abierta, que el correo
    ya tiene cuenta o que entró (se borró `cuentas.mail.yaTieneCuenta`), o que digan que se
    mandó un mail que no salió. Lo que queda: quien invita ve que para ese correo el mail
    nunca sale mientras para otros sí; ocultarlo del todo obligaría a no confirmar nunca
    el envío ("Le mandamos un mail"), y eso no se hizo.
  - **Queda:** probar el primer envío real con la clave secreta (con la clave nueva
    `sb_secret_` se espera que ande; si Supabase la rechaza, usar la legacy service_role).
    Algunos servicios de correo abren los enlaces antes que la persona y los gastan
    (aparece como vencido): si pasa, armar un enlace propio con `{{ .TokenHash }}`.
    "Reenviar mail" no tiene espera propia: solo el límite de mails por hora del proyecto,
    que comparten todos los clubes (30 por hora con SMTP propio; se cambia en
    Authentication › Rate Limits). Sin resolver: si el mail no sale y la persona entra
    por "Copiar mensaje" + "Crear una cuenta" (o se registra sin invitación), y alguien
    había registrado antes ese correo con una contraseña suya, Supabase la conserva al
    confirmar el correo. El arreglo del servidor solo cubre el mail de invitación; para el
    resto hace falta decidir un cambio en la base o en Supabase Auth.

Lo que hay que sumar (propuesta del 02/10):
- Pedido de acceso por club (tabla de solicitudes): solo con el correo confirmado, uno a
  la vez por cuenta. Lo acepta o rechaza cualquier admin activo del club, eligiendo
  módulos. Rechazado: desaparece de la lista del admin; la persona ve "Tu pedido no fue
  aceptado" y puede pedirle a otro club, pero no otra vez al mismo (salvo que la
  inviten). Bloquear una cuenta entera queda solo para el dueño.
- Contador de pedidos en el portal y en Cuentas para el admin. Un mail automático
  necesita un servicio de correo aparte: más adelante.
- Enlace de invitación propio: abre "Crear cuenta" con el correo puesto y sin poder
  cambiarlo. Invitación vencida o cuenta con otro correo: mensaje claro y la opción de
  pedir acceso igual.
- Nombres de club que no se repitan tampoco con tildes ("Atlético" y "Atletico"): hoy la
  base solo compara sin mayúsculas ni espacios de más.
- El dueño deja de aprobar cuentas una por una: le quedan crear clubes, bloquear cuentas
  y ver todo.

Para decidir antes de armarlo:
1. ¿Lista con todos los clubes o buscador? Con lista, cualquiera que se registre ve los
   nombres de todos los clubes que usan la app (información sensible entre clubes
   rivales). Recomendado: buscador, que muestra el club solo al escribir su nombre.
2. ¿Un solo administrador por club o varios? Hoy puede haber varios y la base no deja que
   quede sin ninguno. Recomendado: varios (si el único se va, el club queda trabado).

Chequeo de seguridad: en Supabase › Authentication › Email, "Confirm email" tiene que
estar prendido. Si está apagado, cualquiera que sepa un correo invitado podría crear la
cuenta con ese correo y entrar al club sin abrir ese mail.

### Orion: la IA que vigila los datos (decidido el 02/10)

- Capa 1, gratis: reglas automáticas cada noche (fechas fuera de orden, lesiones sin alta
  hace mucho, jugadores repetidos, partidos sin resultado, valores imposibles) → tabla
  `alertas_datos` → pantalla "Revisión de datos" donde el staff confirma o descarta.
- Capa 2, Claude por API: cada noche revisa solo lo nuevo o cambiado de cada club, con
  los nombres reemplazados por códigos antes de salir (datos de salud), y marca lo que
  una regla no agarra (el comentario dice "izquierda" y la lesión dice derecha, un
  diagnóstico que no cierra con la estructura). "Aprende" guardando lo que el staff
  confirmó o descartó y usándolo de ejemplo; lo que se repite se vuelve regla. Costo:
  centavos por día por club (Opus 5.5 ~3 USD/mes por club; con el modelo chico, menos
  de 1; por lotes, la mitad). La API no usa los datos para entrenar.
- Capa 3, después: preguntarle a los datos en lenguaje común, siempre con los permisos
  de quien pregunta.

### Costos reales para vender (02/10)

Gratis: GitHub (repo privado, Actions, Dependabot), Supabase de prueba, Sentry para
errores, captcha, segundo factor. Cuando se vende: Supabase Pro (25 USD/mes la
organización, más ~10 por club dedicado), Vercel Pro (20 USD/mes: el plan gratuito
prohíbe uso comercial), dominio. Todo lo demás, 0.

## Revisión de privacidad del 05/10 (migración `20261013_seguridad.sql`)

Ningún dato de un club (y menos los médicos) se puede ver desde otro club. Lo que
encontró la revisión y cómo quedó:

- **Historial de lesiones por club.** `lesiones_historial` se abría si existía hoy una
  lesión con ese id en un club propio; el historial queda cuando la lesión se borra, así
  que creando en el club propio una lesión con el id de una borrada de otro club se leía
  toda su historia. Ahora cada cambio guarda su club (`equipo_id`, lo que ya estaba sale
  de la fila guardada en el mismo cambio) y se ve con la regla de las lesiones mirando
  ese club. Desde la app, el id de una lesión nueva lo pone la base. Se repasó el resto:
  ninguna otra política autoriza por el id de otra tabla (la foto al día ya miraba el
  club de cada versión). Las migraciones 20261001 y 20261002 se niegan a correr después
  de esta (20261002 borraría todas las lesiones).
  - De paso: quien sigue en el club con Lesiones ve también el historial de una lesión
    borrada de su club (antes desaparecía con la lesión). La app no lo muestra.
- **Una lesión es de un jugador de su club** (como una evaluación): al cargarla o al
  cambiarle el jugador, uno de otro club no entra (`jugador_de_otro_club`; la app lo
  muestra con el texto de Evaluaciones). Lo que ya estaba se sigue editando (por ejemplo,
  de un jugador que después pasó a otro club). La migración lista al final las lesiones
  con jugador de otro club, para mirarlas.
- **Quién cargó y quién cambió lo pone la base.** Desde la app, al cargar una lesión la
  base pone el autor y la fecha (antes la app podía mandar otros); después, quién la
  cargó y cuándo no cambian. Al borrar una cuenta, sus lesiones quedan sin autor y el
  resto (quién la cambió, cuándo) queda como estaba. Las invitaciones, al cambiarlas,
  pasan por el mismo control de correo que al invitar, y quién invitó no cambia (antes
  un administrador podía poner a alguien de otro club como autor y así figuraba en la
  historia del alta).
- **Al club se entra por invitación.** Un administrador de club podía sumar a su club
  cualquier cuenta de la que supiera el id (sin invitación) y con eso leer su perfil
  (correo, estado). La app nunca suma a mano: invitación, el creador del club y
  reincorporar (que cambia la membresía que ya está) siguen igual. Sumar a mano queda
  solo para el dueño de la plataforma. Se eligió esto y no recortar lo que el
  administrador ve de su gente: la pantalla Cuentas necesita el correo y el estado.
- **Orden para ponerlo en producción:** la migración y la app no dependen una de la otra
  (la app de antes anda con la migración y la nueva sin ella). Conviene correr la
  migración cuanto antes: es la que cierra lo de Lesiones. Al final muestra cuántos
  cambios del historial quedaron sin club (tiene que dar 0) y las lesiones con jugador
  de otro club, para mirarlas.
- **OpenField (Flujo diario) mira la membresía.** La API de Catapult autorizaba con los
  permisos viejos de `perfiles` (flujo, admin): quien se iba del club seguía leyendo y
  quien entraba por invitación con Flujo diario quedaba afuera. Ahora decide
  `puede_usar('flujo')` con el token de cada uno (Flujo diario en algún club donde
  sigue); el dueño de la plataforma sigue entrando. La cookie de sesión de OpenField
  dura 10 minutos como mucho (antes hasta 8 h): las rutas de lectura no le vuelven a
  preguntar a la base, así que una baja, un módulo sacado o una cuenta bloqueada se
  aplican en 10 minutos; enviar cortes y la cuenta de Catapult, en el momento. La app
  la renueva sola. Las cookies de antes quedan vencidas al publicar (versión 3).
- **Pruebas técnicas solo para el dueño.** Ajustes › Pruebas técnicas (sondas con los
  tokens del servidor y un navegador en el servidor que entra a Catapult) las corre el
  servidor solo con la sesión de rol admin. Desde el paso 2 (06/10) ese rol es del dueño
  principal con Flujo diario en el club del token, y la opción ni aparece para el resto. Si hace falta que otra cuenta las corra (pedido por chat), se prende
  `OPENFIELD_DIAGNOSTICO=1` en Vercel y se apaga después. La escritura de prueba sigue
  siendo solo del dueño, con la variable o sin ella.

**Queda anotado, sin hacer:**
- Un solo `OPENFIELD_API_TOKEN` para todos los clubes: las lecturas de Catapult
  (actividades, atletas, períodos) son las de esa cuenta, sea cual sea el club de quien
  pregunta. Con un segundo club en Catapult hace falta un token por club.
- En Supabase, Authentication › "Confirm email" tiene que quedar prendido: las
  invitaciones dejan entrar a la cuenta que tenga ese correo confirmado.

## Notas (06/10, migración `20261013b_notas.sql`)

Una tarjeta más en la pantalla principal, para todos: **Notas**, para anotar las mejoras
que se quieren hacer en la app, adentro de la app. Cada nota es del club donde se
escribió: la ve y la escribe la gente que sigue en ese club (`puede_editar`); ningún otro
club la ve, tampoco el dueño de la plataforma si no está en ese club, ni quien ya se fue.
Cualquiera del club la marca como hecha (pasa abajo, tachada) o la vuelve a abrir; la
corrige solo quien la escribió y la borra quien la escribió o el administrador del club
(pregunta antes). Quién la escribió y cuándo lo pone la base: desde la app se manda el
club y el texto (y después el texto o si está hecha).

- No usa `es_admin()`, así que el paso 2 de cuentas no la toca. Cuando la gestión del
  club pase a la entidad (paso 3), borrar la de otro también lo puede la entidad.

### Lo anotado en Notas, en marcha (11/10)

Santiago pidió avanzar con las notas del club (las pasó en capturas el 11/10) y decidió
cómo va cada una. Va un PR por nota.

- **Cerrar sesión y cambiar de club, solo en el portal (hecho el 11/10).** Nota del 06/10:
  «Sacar de ajustes de cualquier modulo las opciones de salir de la cuenta y cambiar de
  equipo»; Santiago, 11/10: «quedamos estrictamente que solo se cambia desde el portal».
  - Partido › Ajustes ya no tiene «Cerrar sesión». «Equipo» sigue y muestra el escudo y el
    nombre, nada más (UI-010): sin la lista «Cambiar de equipo».
  - Si Partido se abriera sin club (desde el portal no pasa: lo pide antes), ya no ofrece
    una lista: dice que el club se elige en el portal y deja volver a Módulos (o, si la
    cuenta no tiene ningún club con Partido, lo dice). El aviso de Registros sin club dice
    lo mismo.
  - Partido no pasa a otro club por su cuenta: antes, si el club elegido no estaba en la
    lista y la cuenta tenía un solo club, pasaba a ese. Sin ninguno elegido toma el único
    que hay, como las demás pantallas.
  - Flujo diario › Ajustes ya no tiene «Cerrar sesión» (quedan Usuario y contraseña de
    OpenField y, para quien corresponde, Pruebas técnicas). Las bases no lo tenían.
  - **Queda prohibido:** volver a poner cerrar sesión o elegir o cambiar de club en los
    Ajustes (o en cualquier pantalla) de un módulo. Se hace en el portal: «Salir» y
    «Cambiar», arriba.
- **Informes gráficos: un embudo en cada gráfico (hecho el 11/10).** Cada gráfico (y cada
  torta por separado) lleva un embudo para filtrarlo por cualquier columna de la Base de
  Lesiones, con el año adentro; se sacaron los botones de filtros y de años de arriba. En los
  de c/1000 h no se ofrece lo que es de la persona (las horas son de todo el plantel). Ver
  «Lesiones: lo que sigue», Informes gráficos.
- **Columnas fijas a elección (hecho el 11/10).** En cualquier base, doble clic en una cabecera
  la deja fija (o la suelta); se recuerda en cada aparato, por base. En el celular, con dos
  toques (arreglado el mismo 11/10: antes no hacían nada). Ver «Bases de Datos (05/10)»,
  columnas fijas a elección.
- **Mapa de calor (hecho el 11/10).** Nota del 06/10: «Mejorar las zonas de calor de los
  reportes individuales para que solo tome la parte del cuerpo lesionada y no muestre nada
  mas que la mancha de calor. La intensidad tiene que depender de cuantas lesiones tenga y
  donde». En el individual y en el grupal (el mismo mapa) se pinta el músculo, tendón o
  ligamento lesionado si está dibujado (si no, la parte entera; en el tronco y la cabeza sin
  músculo, la mitad del lado del jugador), recortado a la parte lesionada: nada se pasa a la
  parte de al lado. El color va de amarillo (una lesión) a rojo oscuro: la escala llega hasta
  4 lesiones o, si hay más, hasta el lugar con más del mapa. Mezclado con la figura (se ve el
  relieve). Abajo, una barra con la escala y la nota «Cuanto más intenso el color, más
  lesiones en ese lugar». El nombre de lo lesionado se lee al pasar el mouse (y lo lee quien
  no ve la pantalla). Los cuerpos quedan del mismo tamaño. **Queda prohibido** volver a
  poner nombres, líneas o puntos en el mapa, o una mancha redonda que pase de la parte
  lesionada.
- **Lo nuevo sin recargar (hecho el 11/10).** Nota del 06/10: «Mejorar la actualizacion de
  los nuevos registros entrantes al soft ya sean de datos o informacion. Tiene que ser rapida
  y al momento, no tiene que ser necesario recargar la pagina»; Santiago, 11/10: «si se
  cargan datos nuevos tengo que poder verlos sin recargar la pagina, eso es».
  - Lo que otra persona carga, cambia o borra aparece solo, en un segundo más o menos, en
    las pantallas abiertas de ese club: Lesiones, Evaluaciones, GPS, Datos básicos (y lo que
    usan de Datos básicos las otras tres) y Notas. Usa Realtime de Supabase
    (`src/domain/enVivo.js`, `useEnVivo`); las tablas entran en la publicación con
    `supabase/migrations/20261017_en_vivo.sql`. Sin esa migración, o sin señal, todo queda
    como antes (se ve lo nuevo al volver a entrar o con «Actualizar» donde lo hay).
  - Vuelve a leer en silencio: sin «Cargando…», sin mover lo que se está escribiendo o
    eligiendo, y si esa lectura falla quedan los datos que se veían, sin aviso de error.
    Varios cambios seguidos (un pegado de muchas filas) se leen una vez, al terminar. Al
    volver la conexión después de un corte, también lee.
  - Quien ya se fue del club (la foto de su último día, solo lectura) no escucha nada.
  - Las versiones nuevas de la app siguen como hoy (el aviso de «Actualizar»).
  - Los borrados: Supabase no los filtra por club ni mira las políticas; manda solo el id
    de la fila borrada a quien escuche la tabla. La app los escucha para volver a leer lo de
    su club. **Queda prohibido** poner `replica identity full` en estas tablas: un borrado
    mandaría la fila entera a cualquier cuenta con sesión.
  - **Falta:** Partido y Flujo diario (tienen su propia cola sin señal y borradores en
    curso: hay que pensarlos aparte), Cuentas y Ajustes de cada base.
- **Tiempos de selección por jugador y horas del GPS en Lesiones c/1000h (hecho el 11/10).**
  Nota del 07/10: «Los jugadores de seleccion o convocados a seleccion tienen que tener los
  tiempos de la seleccion a parte de los jugadores que no hayan estado en seleccion, xq un
  jugador que no fue a seleccion en el mismo periodo que otro jugador si fue a seleccion no
  puede tener mas tiempo sumado solo xq uno fue». Santiago, 11/10: los tiempos de selección
  «van a estar dentro de la base de gps y despues vamos a ver la manera de poner los que
  fueron a seleccion como para que se detecte facil»; que cuenten solo en las horas de ese
  jugador («Exacto»); «busca como se calculan dentro de la base de lesiones».
  - **Cómo calcula el Excel de lesiones** (leído el 11/10, con permiso de Santiago, solo en la
    máquina de trabajo): la hoja «BD GPS» tiene jugador, fecha y dos columnas sin título, C y
    D, que son «Minutos Fuerza Metabólico» y «Minutos Campo» de cada fila del GPS (las de
    cada tarea y las del total de la sesión), copiadas como se ven (redondeadas a minutos).
    El plantel en un período (Antecedentes BD CL5) suma C + D de todos entre las fechas; el
    individual (Reporte de Lesiones IND BD3), C + D de ese jugador. El promedio del equipo
    (Team Average) no está. Cruzado con el GPS: 5.519 de 5.541 jugador-días dan igual; los
    otros 22 son cuatro días de fines de agosto y septiembre con minutos de partido que el GPS
    ya tiene y esa copia del Excel no.
  - **En la app** (migración `20261018_minutos_lesiones.sql`, `minutos_de_entrenamiento`):
    por jugador (o persona fuera de Datos básicos) y día, «Minutos Campo» + «Minutos Fuerza
    Metabólico» de todas sus filas del GPS, como el Excel (Santiago: «Igual que el Excel»,
    también los días en que se suman la fila Total y filas de tareas, por ejemplo del 26/06
    al 07/07). Exactos, sin redondear («Exactos, como en el GPS»: menos de 0,1 % en todo el
    período). El promedio del equipo no cuenta. La base da solo los minutos sumados: quien
    tiene Lesiones los ve aunque no tenga GPS, sin ver las filas del GPS; quien se fue, los de
    su último día.
  - **La selección**: las filas de un convocado son solo suyas, así que nadie suma tiempo
    porque otro fue. Sus minutos cuentan en las horas de ese jugador (reporte individual) y
    **no** en las del plantel (grupal, referencia, Lesiones c/1000h e Informes gráficos):
    Santiago, «No, solo en el individual». Hasta que haya una marca fija se reconocen por la
    Descripción, que dice «Selección» (con o sin tilde): en el GPS de hoy son 204 filas de 9
    jugadores; hasta septiembre con 0 minutos y desde el 23/09 con los de allá.
  - Lesiones escucha también el GPS: los minutos nuevos llegan sin recargar a quien tiene
    GPS; quien no, los ve al volver a entrar.
  - **Falta:** la marca fija de la selección (Santiago la define); pasar a la configuración
    del club qué columnas son minutos y cómo se reconoce la selección (hoy en la migración,
    ver «Protocolo de lesiones: ninguna regla escrita en código»).

### Lo anotado en Notas, segunda tanda (13/10)

Santiago pasó en capturas las 12 notas de «Por hacer» (13/10: «Mas mejoras para la web,
cualquier duda me preguntas y me presentas las cosas como las harias pero no decidad nada
vos»). Se le presentó cómo se haría cada una, con preguntas, y pidió ir **de a una** («primero
vamos una por una, a mi me gusta trabajar asi») y que se le hable **solo en castellano**
(«hablame estrictamente en español, esto ya te lo pedi antes»).

- **Dejar el entrenamiento para revisar (hecho el 13/10).** Ver «GPS (10/10)», Cargar (paso 2),
  «Dejar para revisar y "Sin terminar"».
- **La Base de GPS con todos los datos al entrar (hecho el 14/10).** Ver «GPS (10/10)», «Todas
  las filas al abrir (14/10)».
- **Mejorar los textos explicativos (en marcha desde el 14/10).** La regla y cómo se hace están
  en `DESIGN_SYSTEM.md`, «Textos que guían (14/10)» (UI-031). Se hace de a un módulo: primero
  GPS; después los demás (Lesiones, Evaluaciones, Datos básicos, Partido, Flujo diario, el
  portal), uno por vez, mostrándole cada uno a Santiago antes de seguir.
  - **GPS (hecho el 14/10)**: todos sus textos sin planillas, hojas ni plantilla; «Pegar desde
    una planilla»; dónde estás en Cargar y en Base; los pasos de cada carga numerados y
    «Siguiente: (el paso que sigue)»; el «?» en Team Average, Va, Microciclo, % vs V.R. de
    partido, Sin ingresar y Regenerativo; «Cómo se usa GPS» con su oferta la primera vez; los
    avisos de base sin lo técnico. También cambiaron tres textos compartidos que GPS muestra y
    que usan otras bases: «Las horas se escriben así…», «Copiá celdas de una planilla…» y
    «Nombre original: …» (antes «Del Excel: …», en Ajustes › Cabeceras).
  - **Lesiones (hecho el 14/10; Santiago: «segui con los demas puntos»)**: sus textos sin
    planillas, hojas ni lo técnico de la base; «Pegar desde una planilla» con sus pasos
    numerados; dónde estás en Nuevos casos, la ficha, Base, Historial individual, Reportes (y en
    cada reporte, arriba, sin ir al papel) y Ajustes, con otra línea para quien ya se fue del
    club; la carga por pasos con lo que hay que hacer numerado y «Siguiente: (el grupo que
    sigue)»; el «?» en Etapa (paso de las fechas), Días de baja (ficha), Recurrencia y recidiva
    (el aviso de la carga), c/1000 h, Referencia (VR), Severidad y Sin leves y Solo LM (en los
    reportes); «Cómo se usa Lesiones» con su oferta la primera vez. En el reporte grupal, los
    filtros llevan arriba su rótulo («Período» y «Qué lesiones», con su «?»). Cada «?» explica
    lo que la app calcula hoy (`src/domain/lesiones.js` y `src/domain/reportes.js`); si cambia
    una regla, cambia su texto. Al imprimir no salen ni la guía ni los «?».
  - Mientras los otros módulos no tengan su turno, su botón de avanzar sigue diciendo
    «Siguiente» (sin a dónde va) y no tienen «Cómo se usa».
  - **Falta (se preguntó el 14/10)**: qué quiere decir cada opción de «Día del microciclo» (0,
    1, +1, -1…); sin eso no lleva «?» (no se inventa).
  - **Falta**: lo técnico de un aviso de base (qué actualización falta) iba a ir en «Pruebas
    técnicas»; hoy esa pantalla es de Flujo diario y no revisa la base, así que no está. Mientras
    tanto, Claude pasa el SQL por el chat, como siempre.
- **Un nombre o una opción cambiados, cambiados en todos lados (hecho el 14/10, migración
  `20261022_nombres_en_todos_lados.sql`).** Nota: «Si se cambia un nombre u opcion dentro de
  ajustes de cada modulo o dentro de datos basicos se tiene que reemplazar en todos los lugares
  donde este ese nombre u opcion». Santiago, 14/10: «si se cambia algo dentro de ajustes [...] y
  hay calculos relacionados a esa opcion [...] todo lo relacionado y previamente escrito se
  cambie a este nuevo valor»; «es automatico cuando se cambie algo»; en Partido «se reemplaza con
  el nuevo nombre»; «Todo junto». Eligió los puntos 1, 2, 4, 5 y 6 de la propuesta; el 3 (pasar
  solas al jugador las filas con un nombre escrito igual al suyo) no va: «si el jugador no esta
  en datos basicos ya pregunta quien es y se puede vincular».
  - **Lo que ya andaba (comprobado con pruebas):** las listas de Lesiones, Evaluaciones y GPS
    guardan el código de cada opción y Lesiones, Evaluaciones, GPS y Flujo diario guardan quién
    es cada jugador: renombrar en Ajustes o en Datos básicos ya se veía en la base, los casos,
    los filtros, los reportes y las cuentas (Solo LM, Sin leves… van por el código).
  - **Partido** (1 y 2): guarda los nombres escritos en cada partido. Al cambiarle el nombre a un
    jugador, la base lo cambia en todos los partidos del club (titulares, convocados, cambios,
    también los de la guía de la transmisión, y formación); lo del rival no se toca. Un partido
    que sube tarde con un nombre anterior se guarda con el de hoy (si ese paso fallara, el
    partido se guarda igual, como vino). Al correr la migración, los partidos con un nombre que
    se ve en la foto al día (desde el 05/10) pasan al de hoy. Cambiar el nombre en Datos básicos
    lo puede hacer cualquiera del club (como siempre): en Partido cambia aunque esa persona no
    tenga Partido. Un nombre anterior que hoy es de otro jugador, o que tuvieron dos, no se
    cambia. Los nombres anteriores quedan en `jugadores_nombres_anteriores` (los anota la base).
  - **GPS** (4): la Descripción lleva escrito el nombre de la opción de estrategia; al
    renombrarla en Ajustes › Listas, cambia también en las descripciones ya guardadas (donde
    empieza cada parte: después de la fecha o de « + »; no adentro del nombre de la tarea).
  - **Nombres anteriores** (5): al pegar una planilla (Lesiones, Evaluaciones, GPS, Datos
    básicos) o cargar el CSV del GPS, un nombre que tuvo el jugador se reconoce como él, si hoy
    no es de otro y lo tuvo uno solo.
  - **Filtros** (6): un filtro de una tabla con un valor que ya no está en ninguna fila no se
    aplica (escondería esas filas); si el valor vuelve, vuelve a aplicarse.
  - **Falta:** que Santiago corra el SQL (lo pasa Claude por el chat).
- **El permiso una vez por pedido también en Lesiones y Evaluaciones (hecho el 14/10, migración
  `20261023_lesiones_evaluaciones_rapido.sql`; Santiago: «segui»).** Nota: «hacer el mismo
  procedimiento de quitar que se lean los permisos fila por fila dentro de evaluaciones y
  lesiones como se hizo en gps para poder agilizar el cargado y filtrado de filas». Las ocho
  políticas de `lesiones` y `evaluaciones` usan `clubes_donde_puedo` (de
  `20261019_gps_rapido.sql`), como `gps`. Quién ve, carga, cambia y borra no cambia (lo
  comprueban los escenarios). Medido en una base local con 20.000 lesiones y 20.000
  evaluaciones: una página de 1000 filas pasó de unos 4,5 s a entre 4 y 10 ms. Falta que
  Santiago corra el SQL (lo pasa Claude por el chat).
- **El reporte individual de Lesiones, más chico (hecho el 14/10).** Nota del 12/10: «Dentro de
  reporte de lesiones individual sacar los puntos rojos y verdes que dicen Mayor a la
  referencia o Menor a la referencia y pasar el color a el % vs vr, achicar las tarjetas lo mas
  posible y reducir espacios dentro del reporte. Hacer mas resumido que lesiones cuentan para
  las horas y no poner todas las musculares». Santiago, 14/10: el % en rojo si el jugador está
  por encima de la referencia y en verde si está por debajo («si»); las LM en una frase corta
  con «Ver cuáles», que abre la lista («lista»). Las cuentas no cambian.
  - **Cada tarjeta**: el título, el número con el % contra la referencia al lado (rojo por
    encima, verde por debajo, gris si es igual; con su signo, así no depende solo del color) y
    «Referencia» abajo, en chico. Ya no van los puntos con «Superior/Inferior a la referencia»
    (se lee al pasar el mouse por el %), la leyenda de los puntos, «vs referencia» en cada
    tarjeta ni la unidad en cada tarjeta (está en el título: «Lesiones / 1000 h»). Pasaron de
    unos 178 a unos 80 px de alto; en papel, también más chicas.
  - **Menos espacio** entre las tarjetas, las partes del reporte y el pie.
  - **Debajo de las tarjetas**, dos renglones: «El % compara al jugador con la referencia, el
    valor del plantel (VR).», con su «?», y «Cuentan: No traumática · Partido oficial, Partido
    amistoso, Entrenamiento · Profesional. LM: lesiones musculares.» (las opciones que cuentan,
    con los nombres del club, sin el nombre de cada campo). «Ver cuáles» abre «Son LM: …» y
    «Ocultar» la cierra; el botón no sale en papel, la lista sí si está abierta.
  - **Solo el individual**: el grupal, Lesiones c/1000h e Informes gráficos siguen con la nota
    larga.
  - En la compu y en papel, el mapa del cuerpo es más alto que las tarjetas y queda lugar en
    blanco debajo de ellas. Se le preguntó si achicar el mapa y si poner la nota corta en los
    otros reportes; Santiago, 14/10: «por ahora dejalo asi y segui avanzando con lo que queda».
- **Sin los botones «Entrar» en las tarjetas (hecho el 14/10).** Nota del 12/10: «Sacar los
  botones de entrar dentro de cada modulo». Los únicos de la app eran el «Entrar ›» blanco de
  las tarjetas del portal y de Bases de Datos (el mismo componente, `TarjetasDelPortal` en
  `src/components/PortalTarjetas.jsx`): se sacaron de las dos. Santiago, 14/10, a la pregunta de
  qué va en su lugar: «Nada». La tarjeta se sigue tocando entera para entrar y el lector de
  pantalla la sigue nombrando «Entrar a …»; la foto, el ícono, el nombre y la línea de qué hay
  adentro no cambian. Reabre UI-007 solo en ese botón (UI-033).
- **Arriba de la Base de GPS, el promedio, el V.R. y el % de cada dispositivo (hecho el 14/10,
  migración `20261024_gps_referencias.sql`).** Nota del 12/10: «Sacar de gps todas las filas de
  arriba y solo dejar las de promedio por dispositivo y agregar todos los vr de gps asi como los
  % vs vr de partido». Ver «GPS (10/10)», «Arriba de la Base: promedio, V.R. y % (14/10)»
  (UI-034). Falta que Santiago corra los dos SQL (la tabla y los V.R.; los pasa Claude por el
  chat). (Al ver esto, Santiago pidió editarlos: ver la nota que sigue; los V.R. van con un
  SQL nuevo, después de `20261025`.)
- **Editar y borrar los Valores de referencia (hecho el 14/10, migración
  `20261025_referencias_editables.sql`).** Se había dejado para después porque falta la
  planilla de valor referencial (Santiago, 14/10: «seguir con lo de gps por ahora»). Al ver la
  parte de arriba de la Base, Santiago, 14/10: «pero no puedo editar nada del vr, ademas
  acordate que todos los vr van aparte». Ver «Los V.R. se cambian: una solapa en cada base
  (14/10)» (UI-035). Falta: que Santiago corra los SQL (los pasa Claude por el chat) y la
  planilla de valor referencial, para que la app calcule los V.R. con su lógica.
- Las otras 3, sin decidir todavía (se ven una por una, en este orden): revisar la lógica de
  Flujo diario; Isocinecia con el lector de Python y conectar con VALD; mejorar el cuerpo humano
  del reporte de Lesiones. **15/10**: Flujo diario pasa al final («Dejalo como ultimo punto»).
  - **Isocinecia**: el lector es un .exe de más de 30 MB (Santiago, 15/10). Se le pidió el
    código con el que se armó (los .py) y dos o tres PDF de ejemplo; con los PDF alcanza para
    armar la lectura aunque no esté el .py. Nada de eso va al repositorio.
    - **Hecho, el PDF en Cargar (23/10, 2026.10.23.11; UI-082).** Santiago, en cuestionarios:
      empezar por «Leer el PDF en Cargar» (VALD, después); mandó tres PDF de ejemplo («Solo PDF
      de ejemplo»), que se usaron solo en la sesión, sin subirlos ni repetir nombres. Claude
      relevó el PDF: el «Comprehensive Evaluation» del isocinético, una página por velocidad,
      letra común y el texto comprimido por página; la fecha en «Session» (mes/día/año), el peso
      en «Wt», y el orden de las piernas cambia con la pierna lesionada (fila RIGHT / LEFT). La
      lectura dio los mismos 55 datos que `pdftotext` en las nueve páginas, y Santiago confirmó
      que los de un PDF «Sí, coinciden» con su Excel. Eligió «Varios a la vez», la fecha «La del
      PDF» y «Una tarjeta por PDF» para revisar. En la app: Cargar › Isocinecia › «Elegir PDF» y
      «Revisar lo leído» (ver UI-082); se guarda una evaluación por PDF con las reglas de
      siempre. Las pruebas usan un PDF inventado (`pdfIsocineciaDePrueba.js`).
    - **Hecho, los nombres del PDF en Ajustes (23/10, 2026.10.23.12; UI-083).** Santiago preguntó
      cómo busca la web cada columna si el PDF agrega o quita columnas (por el nombre de la fila;
      si no la encuentra, esa medida queda vacía) y pidió poder elegirlas a mano y dejarlas en
      Ajustes. En cuestionarios: «Nombre y si se usa»; cuando no se encuentra, «Se elige en la
      tarjeta»; lo cambia «Quien cambia los Ajustes». En la app: Ajustes › «Lectura del PDF
      (Isocinecia)» y, en «Revisar lo leído», la lista de las filas libres del PDF con «Dejar
      vacía» y «Usar esta» (ver UI-083). Sin migración: va en `evaluaciones_campos`.
      Después (23/10, 2026.10.23.13): Santiago preguntó si el nombre era un desplegable y eligió
      «Desplegable en los dos»: en la tarjeta, las filas libres van en un desplegable; en Ajustes,
      «Elegir un PDF de ejemplo» (se lee en el aparato, no se guarda) da las filas del desplegable,
      con «Escribir a mano…» (ver UI-083).
    - **Lo que sigue de la nota:** conectar con VALD (falta que Santiago diga qué aparatos y
      qué datos), confirmado en un cuestionario antes de empezar.
    - **VALD, lo decidido (23/10).** Santiago, en cuestionarios: el club usa ForceDecks,
      NordBord y ForceFrame; para conectarlos, «Las dos, por partes» (primero importar el archivo
      que se exporta de VALD Hub y después que se traigan solas por la API); ForceDecks va a
      Saltos, NordBord a Curl Nórdico e Isoprone y ForceFrame a Iso Aductor-Abductor; se empieza
      por NordBord. Sobre la API respondió «No sé / hay que pedirlo» y preguntó qué dice la
      documentación de VALD. Claude buscó (las páginas de support.vald.com no se pudieron abrir
      directo; se usaron los resúmenes del buscador, el manual del paquete valdr y la página de
      integraciones de VALD): hay «External APIs» para esos tres aparatos, que permiten traer los
      tests cambiados desde una fecha sin entrar a VALD Hub; se piden por mail a support@vald.com
      con el ID de organización de VALD Hub y un acuerdo de licencia, y VALD da un clientId y un
      clientSecret (en marzo de 2026 cambió la autenticación); VALD dice que las integraciones
      no tienen cargo con la suscripción. El CSV sale a mano de VALD Hub (Dashboard › Results
      Export); no se encontró una exportación automática. Santiago eligió «Pido la API y
      mientras tanto el CSV». Falta: un CSV de NordBord de ejemplo (no va al repositorio) y,
      para la API, el acceso y la documentación oficial que mande VALD. Las claves van como
      secreto en el servidor, nunca en la app, en GitHub ni en el chat, y no se programa contra
      la API sin esa documentación.
  - **El cuerpo humano**: la figura de la carga se sacó (hecho el 15/10, ver «Lesiones: lo que
    sigue», la carga sin la figura del cuerpo). Para el reporte, Santiago preguntó si puede pasar
    una imagen para que se pinte ahí el calor y pidió (15/10, «investiga cual es la mejor manera
    de implementarlo y contrastalo contra otros soft o webs que hagan lo mismo») comparar con
    otros programas; la imagen la hace él («La puedo hacer rapido»). Hasta que decida, el mapa de
    calor del reporte sigue como está (UI-024).
    15/10, al mandar la imagen de un reporte oscuro («MAPA CORPORAL DE LESIONES»): «Tenemos
    que sacar las mejores parte de este reporte y mesclarlas con las mejores cosas de nuestro
    reporte» (se hace más adelante: primero GPS). No reemplaza el reporte de hoy. Falta que
    responda qué piezas toma de la imagen (P2: el cuerpo con N.º lesiones / Días perdidos, el
    detalle al tocar una zona, el ranking de zonas, los totales, el tipo de lesión, elegir el
    período), si va con fondo oscuro en pantalla y blanco al imprimir (P3), si las zonas las
    marca Claude o él pinta una copia con colores, y si van primero las partes del cuerpo y
    después los músculos. Para usar su figura hace falta la figura sola (sin calor), de frente
    y de espaldas, en grande y con permiso de uso.
    - **Hecho el mapa nuevo del individual (23/10, 2026.10.23.14; UI-084).** Santiago eligió
      seguir con esta nota (la de Flujo diario queda para el final). Claude buscó cómo lo hacen
      otros programas: TeamBuildr tiene un mapa del cuerpo para que el atleta marque dolor; en
      Kitman Labs y Smartabase no se encontró uno; en los estudios de lesiones el mapa por zona se
      arma con la cantidad y los días perdidos (la «carga lesional»). La foto del 15/10 no estaba en
      esta conversación: Santiago la mandó de nuevo y, en cuestionarios, eligió las piezas (ver
      UI-084), el período con desplegable, solo en el individual, oscuro en pantalla y blanco al
      imprimir y su figura, que mandó limpia de frente y de espaldas. A la figura se le sacó el fondo
      (y la sombra del piso) en la sesión; las zonas las marcó Claude a mano. **Falta que confirme**:
      las zonas marcadas, y lo que no respondió (qué es una zona, los lados juntos y la dona por
      familia), que se hizo con lo recomendado.

### Lo anotado en Notas, tercera tanda (17/10)

Santiago pasó en capturas las 22 notas de «Por hacer» (17/10: «Necesito que sigamos con esto y
vayamos punto por punto. Me vas preguntando cualquier duda o decision de logica o diseño»). Se
ordenaron de lo más chico a lo más grande y van de a una, un PR por nota.

**Cómo se trabajan las notas (Santiago, 17/10; vale para toda nota que pase).** «TE DIJE NOTA
POR NOTA Y NO PASAMOS A OTRA SIN CORNFIRMAR QUE ESTE TODO BIEN» y «Orden de trabajo cuando te
paso notas para hacer: 1. Las haces una por una 2. Cuando este terminada, tengas dudas o dudas
de diseño o como implementarlo me avisas 3. Subis todo y me preguntas si esta bien y podemos
pasar a la siguiente nota». O sea: una nota por vez; las dudas de esa nota se le preguntan
cuando aparecen (no las de la nota siguiente); al terminarla se sube (PR, CI, publicar) y se le
pregunta si está bien. **No se empieza ni se pregunta nada de la nota siguiente hasta que
confirme.**

- **Parecen hechas** (se le pidió que las mire y las marque): «Cuando se entra a bases de datos
  siempre te deja en el medio» (arreglado el 16/10, «El espacio en toda la web», errores
  encontrados al relevar) y «Hacer el reporte que te pase de lesiones» (06/10: ya están el
  individual, el grupal, Lesiones c/1000h e Informes gráficos).
- **Sin los microciclos al lado del nombre en el Informe (hecho el 17/10).** Nota del 15/10: «No
  poner los microciclos al lado de los nombres dentro de informes». En el Informe de GPS, la
  fila de un jugador lleva solo su nombre (antes, abajo, sus microciclos: «17 a 22»). Las filas
  del promedio del equipo siguen con su número de microciclo: es lo que distingue una de otra.
  **Queda prohibido** volver a poner los microciclos junto al nombre de un jugador.
- **Lo que se oculta, hasta salir (hecho el 17/10).** Nota del 16/10: «Hacer que las columnas
  que se oculten en las bases y/o filas sean temporales y una ves que se salga de la base queden
  como estan». Santiago, 17/10, en un cuestionario: «Hasta salir de esa base» y «Bases e
  informes». En las bases (`TablaDatos`), el Informe y los reportes de GPS, y los reportes y V.R.
  de Lesiones y Evaluaciones (`Ocultar.jsx`), columnas y filas quedan ocultas mientras se está
  ahí; al pasar a otra solapa, volver a «Ver informes» o a Módulos, vuelven a verse. Lo que
  quedaba guardado en el aparato se borra al entrar. Las columnas fijas, los anchos y el orden
  se siguen recordando. Ver UI-039.
- **El último dispositivo, en la cuenta (hecho el 17/10).** Nota del 16/10: «Recordar el ultimo
  dispositivo seleccionado cuando se copia para pegar en la base gps al igual que en la carga
  de un csv». Santiago, 17/10: «En mi cuenta» (no en el aparato ni para todo el club). En GPS ›
  «Pegar desde una planilla» y en «Cargar un día», el dispositivo arranca con el último que
  eligió esa cuenta en ese club, en ese mismo lugar (cada uno recuerda el suyo: elegir uno al
  cargar un CSV no cambia el de pegar). Se guarda al elegirlo; si ya no está en la lista de
  Ajustes, no se elige solo. Una carga sin terminar que ya tenía dispositivo sigue con el suyo.
  Es una ayuda: sin señal, sin la migración o en solo lectura se elige a mano, como antes, sin
  aviso. Va en la tabla `gps_preferencias` (migración `20261027_gps_preferencias.sql`): una fila
  por cuenta y club; cada cuenta ve y cambia solo la suya, donde tiene GPS y sigue; anon, nada.
  **Queda prohibido** guardarlo en el aparato o compartirlo entre las cuentas del club.
  Santiago corrió el SQL, la probó y confirmó: «funciona» (17/10).
- **«Chaleco» pasa a «dispositivo» (hecho el 17/10).** Nota de Datos básicos. Santiago, 17/10,
  en un cuestionario: «En toda la app» y, a los textos propuestos, «Sí, así». Donde la app decía
  «chaleco» (en portugués, «colete») ahora dice «dispositivo»: Datos básicos › Catapult
  («Dispositivos de Catapult», «N con dispositivo», «Dispositivo: …», «Sin dispositivo»,
  «Emparejar con los dispositivos», «Buscar dispositivos» y sus avisos) y Flujo diario («sin
  dispositivo» al elegir jugadores, «No hay jugadores con dispositivo y datos en esta sesión.»,
  «… no tiene dispositivo. Asignalo en Datos básicos › Catapult.», la ayuda del usuario y
  Pruebas técnicas). Es solo el texto: el vínculo de cada jugador con Catapult y lo guardado no
  cambiaron. **Queda prohibido** volver a decir «chaleco» o «colete» en la app. Ver UI-044.
  Santiago la confirmó: «Está bien, pasamos» (17/10).
- **Los que ya no están, al final de Datos básicos (hecho el 17/10).** Nota de Datos básicos
  («no actuales al final»). Santiago, 17/10, en un cuestionario: «Siempre al final», «Sí, en el
  momento» y «Solo Datos básicos». En la tabla de Datos básicos van primero los del plantel
  actual y después los que ya no están (en su color), cada grupo por nombre; si se ordena por
  una columna, cada grupo se ordena por ella y los que ya no están siguen abajo. Al desmarcar
  «Actual», la fila baja en el momento (y sube al marcarla); la celda elegida la sigue, así que
  lo que se escribe o se pega va al mismo jugador. Es una opción de la tabla compartida
  (`apagadasAlFinal`) que solo usa Datos básicos: en Lesiones, Evaluaciones y GPS las filas
  siguen por fecha y orden de carga. Ver UI-045. Santiago la confirmó: «Está bien, pasamos» (17/10).
- **Nombre y fecha de nacimiento obligatorios, con aviso de posibles repetidos (hecho el
  17/10).** Nota de Datos básicos. Santiago, 17/10, en un cuestionario:
  - Al pegar desde Excel, un jugador nuevo sin fecha: «Que avise y te diga que es obligatorio
    cargar la fecha, entonces ese nombre queda en rojo la fecha y no te deja cargar los demas
    hasta que le cargues la fecha pero pudiendolo hacer dentro de la web».
  - Los que ya están sin fecha: «Aviso arriba de la tabla».
  - Posible repetido: «La misma fecha, sale un cartel de "Esta fecha de nacimiento ya esta
    registrado con este nombre (…)" y preguntas "Es el mismo jugador?" dos opciones si no
    carga ese nuevo jugador y queda el que ya estaba aunque no este marcado como actual, no
    importa, si dice no, en caso de que haya algun jugador mas con esa fecha se hace lo mismo
    y pregunta hasta que no coincida nadie con la fecha y ahi se carga».

  Quedó así:
  - **A mano**: el formulario pide nombre y fecha de nacimiento; sin las dos, «Agregar
    jugador» no se puede tocar.
  - **En la tabla**: la fecha de nacimiento no se puede dejar vacía («La fecha de nacimiento es
    obligatoria»); si se pega una fila con la fecha vacía, lo demás de la fila se guarda.
  - **Al pegar desde Excel**: un jugador nuevo sin fecha (o con una que no se entiende) queda
    con el nombre y la fecha en rojo, y la fecha se carga ahí mismo. Mientras falte alguna o
    haya una pregunta sin responder, no se carga ninguno (abajo dice qué falta). Si se elige
    «No cargar» para esa fila, ya no hace falta su fecha.
  - **Posible repetido** (a mano o pegando): alguien de la lista (esté o no en el plantel
    actual) con la misma fecha. «¿Es el mismo jugador?» con «Esta fecha de nacimiento ya está
    registrada con este nombre: …». «Sí, es el mismo»: no se carga y queda el que estaba. «No,
    es otro»: se pregunta por el siguiente con esa fecha y, cuando no queda ninguno, se carga.
    A mano es un cartel (cerrarlo no agrega nada y deja el formulario); al pegar, la pregunta
    va en la fila. Solo se compara con los que ya están en la lista, no con otras filas del
    mismo pegado.
  - **Los que ya están sin fecha**: arriba de la tabla, «N jugadores sin fecha de nacimiento,
    que es obligatoria» con «Ver cuáles» (la tabla muestra solo esos) y «Ver todos». No se ve
    en solo lectura.
  - La base no cambió: es una regla de la app (sin SQL). Ver UI-046.
  - Santiago la confirmó: «Está bien, pasamos» (17/10).
- **El cambio de categoría de un jugador, en sus lesiones (hecho el 17/10).** Nota de Datos
  básicos («cambio de categoría de un jugador: todo o desde ahora»). Santiago, 17/10, en un
  cuestionario: «Solo a Lesiones», «Solo si tiene lesiones», «Desde una fecha, de entrada hoy»
  y, al pegar desde Excel, «Uno por uno».

  Quedó así:
  - **Cada lesión guarda su categoría**: al guardarla con el formulario de Lesiones queda la
    que tiene el jugador en ese momento (antes se borraba al guardar y se mostraba siempre la
    actual). Las que no la guardan (las cargadas antes y las pegadas desde Excel) muestran la
    actual hasta que se le cambie la categoría al jugador.
  - **En Datos básicos** (al elegirla en la tabla o al pegar sobre la celda): si alguien que
    tenía categoría pasa a otra y tiene lesiones cargadas, sale «¿Cambia en todo su historial o
    desde una fecha?», con la fecha (de entrada, hoy). «Desde esa fecha»: las lesiones que
    empezaron antes quedan con la que tenían (o con la anterior, si no tenían ninguna) y las de
    esa fecha en adelante y las sin fecha de inicio pasan a la nueva. «En todo su historial»:
    todas pasan a la nueva. Cerrar el cartel deja la categoría como estaba (si se pegó la fila
    entera, lo demás se guarda).
  - **En Pegar desde Excel** de Datos básicos: la misma pregunta va en la fila de cada jugador
    al que le cambia, uno por uno, con su fecha; hasta responderla no se carga ninguno.
    Respondida, la fila dice «Categoría: desde el …» o «Categoría: en todo su historial», con
    «Cambiar».
  - **No pregunta** si no tenía categoría, si no tiene lesiones o si quien la cambia no tiene
    Lesiones (no las ve): ahí las lesiones que no guardaban categoría muestran la nueva, como
    antes. Si no se pudo cambiar alguna lesión, la categoría del jugador queda cambiada y se
    avisa.
  - **Reabierta el 18/10 para Evaluaciones**: después de la de Lesiones va la misma pregunta
    para Evaluaciones (ver «Evaluaciones: la elección de test y las categorías de Datos
    básicos» y UI-056). GPS sigue sin cambiar. Lo de abajo es lo del 17/10.
  - Solo cambia Lesiones (la tabla, los reportes y la exportación, que ya usaba la de cada
    lesión): Evaluaciones sigue con la Selección de cada fila y GPS no cambia. La base no
    cambió (sin SQL). Ver UI-047.
  - **Queda prohibido** cambiar sin preguntar la categoría de las lesiones de un jugador que
    las tiene cargadas, y volver a mostrar en una lesión siempre la categoría actual.
  - Santiago la confirmó: «Está bien, pasamos» (17/10).
- **Datos básicos › Ajustes (hecho el 17/10).** Nota del 14/10: «Agregar ajustes de datos
  basicos y mover posiciones a ajustes de partido». Santiago, 17/10, en dos cuestionarios:
  - Qué va en Ajustes: «Listas», «Cabeceras» y «Catapult».
  - Lesiones: «En lesiones solo lo que sea de lesiones, si comparte columnas con datos basicos
    quedan en datos basicos».
  - Quién lo cambia: «Vamos a implementar un nivel mas de permisos para cada modulo (Solo
    Lectura y Edicion) solo lectura no deja editar nada y edicion si». Hacerlo «Aparte, justo
    después» y, mientras tanto, lo cambia «Cualquiera del club».
  - Esconder desde Datos básicos una columna que comparte con Lesiones: «Solo en Datos
    básicos».
  - Posiciones: «Mejor deja posiciones dentro de datos basicos» (no se pasa a Partido).

  Quedó así:
  - **Datos básicos** tiene la solapa **Ajustes** (Jugadores, Posiciones, Ajustes) con tres
    filas: **Cabeceras** (el nombre de cada columna en cada idioma y cuáles se ven en la tabla),
    **Listas** (las opciones de Categoría, Pie dominante y Posición: agregar, renombrar o
    esconder) y **Catapult** (el dispositivo de cada jugador; solo para quien tiene Flujo
    diario, como antes; se mira también en solo lectura). La solapa Catapult ya no está.
  - **Las columnas del jugador** (nombre y apellido, categoría, fecha de nacimiento, pie
    dominante y posición) se llaman igual en Lesiones y usan las mismas listas: se cambian
    solo desde Datos básicos › Ajustes. Lesiones › Ajustes ya no las muestra (avisa dónde se
    cambian) y en Lesiones siempre se ven.
  - **Esconder** una columna desde Datos básicos la saca solo de su tabla. El nombre de cada
    jugador no se esconde. Las columnas propias (Actual, Edad, Foto, Horas previas) tienen su
    nombre aparte: la Edad de Datos básicos (la de hoy) ya no toma el nombre de la Edad de
    Lesiones (la del día de la lesión).
  - **Quién**: hasta los niveles de permiso por módulo, cualquiera que sigue en el club (como
    los jugadores); en solo lectura, Cabeceras y Listas no se abren. Anon, nada.
  - **La base** (migración `20261028_datos_basicos_ajustes.sql`, se corre antes de usarlo):
    las políticas que dejan ver y cambiar el nombre y las listas de las columnas del jugador
    (`lesiones_campos` y `lesiones_opciones`, solo esas cinco; no se borran) y la tabla
    `datos_basicos_columnas` (nombre de las propias y lo escondido). Sin el SQL, quien no tiene
    Lesiones ve los nombres de la app y, al guardar, la app dice qué SQL falta.
  - **Queda prohibido** volver a cambiar las columnas del jugador desde Lesiones › Ajustes,
    que esconderlas en Datos básicos las esconda en Lesiones, y pasar Posiciones a Partido sin
    un pedido nuevo. Ver UI-048.
  - Santiago lo probó: «funciona» (17/10).
- **Niveles de permiso por módulo (hecho el 17/10).** Santiago, 17/10: «Vamos a implementar un
  nivel mas de permisos para cada modulo (Solo Lectura y Edicion) solo lectura no deja editar
  nada y edicion si». En un cuestionario:
  - Datos básicos: «Deja eso para el final» (se pregunta al cerrar esta nota).
  - Cuentas: «Un desplegable por módulo».
  - Qué ve con solo lectura: «Puede ver todo, siempre que tenga los permisos pero no puede
    editar nada si tiene solo lectura».

  Quedó así:
  - **Cuentas**: cada módulo (Partido, Flujo diario, Lesiones, Evaluaciones y GPS) tiene su
    desplegable con **Sin acceso**, **Solo lectura** o **Edición**, en cada miembro, al invitar
    y al aceptar un pedido (reemplazan los botones de prender y apagar). La hoja dice qué
    permite cada uno. De entrada, al invitar y al aceptar, Partido y Flujo diario con Edición.
    Las filas que no se tocan, las invitaciones y la historia dicen «(solo lectura)» al lado del
    módulo.
  - **En el módulo, con Solo lectura**: ve todo, al día, como quien edita (lo nuevo de otros
    sin recargar, los cambios de una lesión y los últimos cambios de los V.R., sin «Volver»),
    sin nada para cargar, cambiar, borrar ni pegar, y con los Ajustes cerrados. Arriba, «Tenés
    {módulo} en solo lectura.». No es la foto del último día: eso sigue siendo solo para quien
    se fue del club.
  - **Flujo diario**: no empieza ni cambia entrenamientos y no manda cortes a Catapult; el
    servidor también lo frena (`mi_cuenta` suma `flujo_edita` y la cookie pasa a la versión 5,
    con `edita`; las de antes vencen y la app pide otra sola).
  - **La base** (migración `20261029_niveles_de_permiso.sql`, se corre antes de publicar): la
    columna `solo_lectura` (los módulos que solo mira) en `club_miembros` y
    `club_invitaciones`; `puede_editar_en` y `clubes_donde_edito`; en las 18 tablas de los
    módulos, políticas restrictivas que solo dejan agregar, cambiar y borrar con Edición (una
    migración vieja corrida otra vez no las saca); `aceptar_pedido` con `p_solo_lectura`; la
    historia y los dueños protegidos con la lista; las vistas `v_mis_clubes` y
    `v_miembros_club`, con la lista. `20261016_gps.sql` se niega a correr después de esta. Sin
    el SQL, la app sigue como antes (todo es Edición) y elegir Solo lectura avisa que falta
    una actualización. Las columnas del jugador que Lesiones comparte con Datos básicos se
    siguen cambiando como Datos básicos.
  - **Datos básicos no cambió** en ese paso: lo siguió cambiando cualquiera que sigue en el
    club (ver abajo, el 17/10).
  - **Queda prohibido** volver a los botones de prender y apagar cada módulo en Cuentas, que
    Solo lectura muestre la foto del último día y dejar cargar, cambiar, borrar o mandar cortes
    con Solo lectura. Ver UI-049.
  - Santiago la confirmó: «Está bien, pasamos» (17/10).
  - **El nivel de Datos básicos (hecho el 17/10).** Santiago, en un cuestionario, a «¿quién
    cambia los jugadores, las posiciones y sus Ajustes?»: «Su propio desplegable». En Cuentas,
    Datos básicos suma su desplegable, al final, en cada miembro, al invitar y al aceptar un
    pedido, con **Solo lectura** o **Edición** (de entrada, Edición). No tiene «Sin acceso»:
    lo tiene todo el que sigue en el club, porque los demás módulos usan su lista de jugadores.
    - Con Solo lectura ve a los jugadores al día, sin agregar, cambiar, borrar ni pegar, con
      Cabeceras y Listas cerradas (Catapult se mira) y el aviso «Tenés Datos básicos en solo
      lectura.» arriba. Las filas y la historia de Cuentas dicen «Datos básicos (solo
      lectura)».
    - La base (migración `20261030_datos_basicos_nivel.sql`, se corre después de la de los
      niveles): `solo_lectura` admite `datos`; agregar, cambiar y borrar jugadores, lo propio de
      Datos básicos › Ajustes y el nombre y las listas de las columnas del jugador que comparte
      con Lesiones piden Edición en Datos básicos (lo demás de Lesiones sigue pidiendo Edición
      en Lesiones). `20261029_niveles_de_permiso.sql` se niega a correr después de esta.
    - Con Lesiones en Solo lectura, cambiar la categoría de un jugador con lesiones ya no
      pregunta desde cuándo (sus lesiones no se pueden cambiar): cambia la del jugador y cada
      lesión sigue con la que guardó.
    - **Queda prohibido** darle «Sin acceso» a Datos básicos y que alguien con Datos básicos en
      Solo lectura cambie jugadores, sus Ajustes o las listas de sus columnas desde otro módulo.
    - Santiago lo confirmó: «Está bien, pasamos» (17/10).
- **Datos básicos y Notas, fuera de los módulos principales (hecho el 17/10).** Nota del 14/10:
  «Pasar datos basicos a un modulo fuera de los principales al igual que notas». Santiago, 17/10,
  en un cuestionario: «Las dos salen» (Datos básicos y Notas) y «Abajo, en «Del club»».
  - En el portal, las tarjetas grandes son solo de los módulos principales: Partido, Flujo
    diario y Bases de Datos. Debajo, el apartado **Del club** (pt: «Do clube») con una fila
    compacta para Datos básicos y otra para Notas: el ícono, el nombre, la línea de qué hay
    adentro y la flechita; en la compu, una al lado de la otra. Se tocan enteras y entran con
    la misma portada (Datos básicos con su foto, Notas con su dibujo). Quién ve cada una no
    cambió (Datos básicos, con algún módulo; Notas, toda la gente que sigue en el club).
  - **Queda prohibido** volver a poner Datos básicos o Notas como tarjetas grandes entre los
    módulos principales sin un pedido nuevo. Ver UI-050.
- **Degradar los colores (hecho el 17/10).** Nota del 16/10: «Degradar los colores mitad blanco
  y el color que corresponda». Santiago, 17/10: «Mostrame las dos» (cada color mezclado mitad
  con blanco, o un degradé de blanco a su color dentro de la celda); viendo las capturas,
  «Quiero que sean un poco mas fuertes los colores y que se note un poco mas el degrade», «B
  fuerte pero un poco mas degradado» y «En toda la app». Cada celda pintada con un color de
  franja va de blanco (hasta el 30 %) a su tono fuerte (desde el 70 %): Informe y reportes de
  GPS, la Base de GPS y Evaluaciones. Las cuentas y las reglas de cada color no cambian. Ver
  UI-040.
- **Botones siempre a la vista en los reportes (hecho el 17/10).** Primera nota de «moverse por la
  app». Santiago, en un cuestionario, a «¿dónde?»: «la idea es que los botones de volver,
  siguiente o accesos rapidos para ir de un lugar al otro en un reporte queden a la vista»,
  «Reportes de Lesiones» y «Toda la app»; a «¿cómo?»: «Arriba, fija al bajar».
  - En todos los reportes (Lesiones › Reportes, Evaluaciones › Reportes y GPS › Informe, con
    el reporte individual y el grupal), la barra de arriba (Volver y, según el reporte,
    Cambiar jugador, Imprimir o guardar en PDF y Siguiente) queda fija arriba al bajar, sobre
    un vidrio grafito que aparece al empezar a bajar. Sin bajar, se ve como antes.
  - En el paso de filtros de GPS (Por microciclo, Por tarea, Por jugador, Reporte individual y
    Reporte grupal), «Siguiente» sube a esa barra, al lado de Volver; abajo de los filtros queda
    cuántas filas tendrá el informe.
  - En el celular, si los botones no entran en una fila, van en dos renglones parejos, con la
    misma letra y el nombre entero. En papel la barra no va.
  - No cambió la barra de Volver y Guardar de las pantallas de carga (en el celular, fija
    abajo) ni ningún cálculo, filtro o permiso.
  - **Queda prohibido** repetir «Siguiente» arriba y abajo y volver a dejar que la barra de
    los reportes se vaya al bajar sin un pedido nuevo. Ver UI-051.
  - **El botón para volver a los módulos, también (18/10).** Santiago: «Tmb deja fijo los
    botones para volver a modulo». El botón del encabezado de cada módulo («‹ Bases de Datos»
    en Lesiones, Evaluaciones y GPS; «‹ Módulos» en Datos básicos, Partido y Flujo diario)
    sigue en su lugar; al bajar, apenas empieza a taparse, el mismo botón aparece fijo arriba
    sobre el vidrio grafito de los reportes, y se va al volver arriba. Lo dibuja un componente
    compartido (`src/components/BotonModulos.jsx`). No va al papel.
- **Alta médica con las fechas de la vuelta (hecho el 18/10).** Al cerrar los botones a la vista,
  se vio que en la compu «Alta médica» y el borrar quedaban fuera de la tarjeta de la lesión (la
  regla del espacio del 16/10 dejaba a «Ver detalle» con todo el ancho). Santiago, en un
  cuestionario: «Si arreglalo, pero tmb agrega dentro de alta medica que se puedan completar
  las demas fechas y que solo se vaya de cargar cuando se cargue la fecha de vuelta a la
  competicion y no el resto».
  - En la compu, esos botones (en Lesiones, Partido › Registros, Evaluaciones y las cargas de GPS
    a medio hacer) van cada uno del ancho de su texto, adentro de su tarjeta.
  - «Alta médica» abre una hoja con el pase a transición, el retorno al entrenamiento y el
    retorno a la competencia (alta), con lo ya cargado; la del alta empieza vacía. Se puede
    guardar sin el alta: la lesión sigue en Nuevos casos, con su etapa al día. Con el retorno a
    la competencia, sale de la lista. Las cuentas (recuperación, Recup 1 y 2, severidad) no
    cambiaron.
  - **Queda prohibido** volver a la hoja que solo pide el alta, poner hoy de entrada en el alta y
    que otra fecha cierre la lesión. Ver UI-052.
  - **Fechas previstas (corrección del 18/10).** Santiago, al probarlo: «dentro de alta medica no
    me deja guardar y cuando aprieto cancelar me dice que niguna fecha puede ser futura. Primero
    es todo lo contrario, claro que son todas futuras. Segundo, si no deja cargar que el aviso
    apareaca visible aunque este adentro de la tarjeta». En un cuestionario: sale de Nuevos casos
    «Apenas la cargo»; etapa, días y reportes «Hasta hoy»; «En toda la app».
    - El pase a transición, el retorno al entrenamiento y el retorno a la competencia se pueden
      cargar a futuro en la hoja, al editar, en la Base y al pegar; la fecha de la lesión sigue
      sin poder ser futura. Base: `20261031_lesiones_fechas_futuras.sql` (la regla
      `lesiones_sin_futuro` queda solo para la fecha de la lesión; `v_lesiones` y la vista de
      Power Query cuentan hasta hoy). `20261010_lesiones_sin_fecha_y_personas.sql` se niega a
      correr después de esta. Sin el SQL, guardar una fecha futura avisa que falta una
      actualización.
    - Con el retorno a la competencia cargado, aunque sea futuro, la lesión sale de Nuevos casos.
      La etapa cambia el día que llega cada fecha; los días de baja, Recup 1 y 2 y los reportes
      cuentan hasta esa fecha o hasta hoy si todavía no llegó; la severidad aparece cuando llega
      el alta.
    - Lo que frena guardar se muestra adentro de la hoja (antes quedaba tapado y se veía al
      cancelar).
  - **La etapa, apenas se carga la fecha (segunda corrección del 18/10).** Santiago, al probarlo:
    «cargue la vuelta a entrenamiento y no ponia en Entrenamiento seguia diciendo en transicion»
    (la había cargado para el día siguiente a la transición). En un cuestionario: «Entrenando
    apenas la cargo».
    - La etapa la da la última fecha cargada (transición, retorno al entrenamiento o alta), haya
      llegado o no: en la tarjeta de Nuevos casos, en la ficha y en `v_lesiones`. Reemplaza
      «la etapa cambia el día que llega cada fecha» de la corrección anterior. Los días de baja,
      Recup 1 y 2, la severidad y los reportes siguen contando hasta hoy, y la lesión sigue
      saliendo de Nuevos casos apenas se carga el alta.
    - Base: `20261101_lesiones_etapa_al_cargar.sql` (rehace `v_lesiones` con la etapa nueva;
      la vista de Power Query no tiene etapa y no cambia). `20261031_lesiones_fechas_futuras.sql`
      se niega a correr después de esta.
    - **Queda prohibido** volver a esperar que llegue la fecha para cambiar la etapa. Ver UI-052.
- **El cuadro cada 1000 horas sin estirar la pantalla (18/10).** Visto al revisar los botones
  fijos: a 320 px, el reporte grupal y «Lesiones c/1000h y días perdidos» se corrían 25 px de
  costado (la grilla del cuadro tomaba el ancho de la tabla). Santiago, en un cuestionario: «Sí,
  después de la nota». Ahora la grilla va al ancho de la tarjeta y, si la tabla no entra, corre
  de costado adentro de su marco, como las demás tablas. En la compu y al imprimir no cambia.
- **Las barras se esconden (hecho el 18/10).** Segunda nota de «moverse por la app»: «esconder la
  barra lateral y la de abajo». Santiago, en un cuestionario: en la compu, «Achicar a íconos»; en
  el celular, «Se va al bajar»; «En toda la app».
  - Compu: tocando el escudo (con el nombre del módulo) la barra lateral se achica a una franja
    de 68 px con los íconos solos y se vuelve a abrir; el aparato lo recuerda
    (`barra_lateral_achicada`). Primero era una flechita abajo de la barra; Santiago, al verlo:
    «y si en compu mejor lo hacemos apretando el escudo?», y se cambió el mismo día. El nombre de
    cada solapa queda al pasar el mouse y para lectores de pantalla. Lo que se ubica por el ancho
    (la franja fija del botón de módulos, tablas, gráficos) se vuelve a medir.
  - Celular: la barra de abajo se va al bajar (pasados los primeros 56 px) y vuelve apenas se
    sube, al cambiar de solapa o al llegarle con el teclado. La fila de Volver y los avisos que
    estaban apoyados en ella bajan con ella (`--alto-barra-abajo`). Al imprimir no cambia nada.
  - Arreglo del mismo día (Santiago: «Fijate que hay lugares que en el celular no esta
    funcionando»): en las bases (`.tabla-datos-marco`), el Informe de GPS y la lista del
    Historial lo que corre es la tabla o la lista, no la página, y la barra no se enteraba. Ahora
    escucha también lo que se desliza adentro (en la fase de captura), si mide 150 px o más y no
    está dentro de una hoja abierta (`role="dialog"`); de costado no cambia nada. La causa
    principal era otra: al tocar una solapa, su botón queda con el foco y la regla para el
    teclado (`:focus-within`) dejaba la barra a la vista para siempre. Ahora la excepción es solo
    con el foco del teclado (`:focus-visible`).
  - **Queda prohibido** esconder la lateral del todo, que se esconda sola, volver a la flechita
    de abajo y esconder la de abajo con un botón o solo en algunas pantallas, salvo un pedido
    nuevo. Ver UI-053.
- **Cada base abre en el último registro (hecho el 18/10).** Tercera nota de «moverse por la app».
  Santiago, en cuestionarios: «Abajo, en la última»; «En todas las bases de datos, incluyendo las
  que se añadan en el futuro»; «Donde estabas»; para Datos básicos › Jugadores, «Arriba, como
  ahora».
  - En `TablaDatos` (`abrirAlFinal`, encendido de entrada): al entrar, la tabla abre bajada hasta
    la última fila; el orden no cambia. Mientras siga abajo de todo, si llegan filas o se
    filtra, sigue en la última; si se subió, no se mueve. Al abrir una ficha o pegar y volver,
    queda donde estaba (`posicionesDeTablas.js`); `MarcoAplicacion` lo olvida al cambiar de
    solapa o de módulo, antes de dibujar la solapa nueva.
  - Datos básicos › Jugadores y las tablas de la carga de GPS lo tienen apagado (abren arriba,
    como antes).
  - **Queda prohibido** dar vuelta el orden de las bases (lo último primero) y volver siempre a
    la última aunque se venga de una ficha, salvo un pedido nuevo. Ver UI-054.
- **Evaluaciones: cargar una fila por jugador (hecho el 18/10).** Santiago: «Me lo imagino asi, que
  la carga en ves de preguntar por jugador y ahi pasar a cargar los datos, que aprietes cargar,
  elijas el test y cuando le das a siguiente te lleva a una fila con las cabeceras del test elegido
  entonces a la isquierda elegis el nombre del jugador y abajo de esa fila un boton que te deje
  añadir un jugador. Esto es para que se puedan cargar varios jugadores al mismo tiempo en la misma
  evaluacion». Vio maquetas con datos inventados (Zona Media y la más larga, Sentadilla
  Incremental) y respondió en cuestionarios: «Queda lo que te explique antes» (reemplaza la carga
  por pasos), «Solo el plantel actual y la categoria se rellena con lo que tiene en datos basicos
  con la opcion de cambiarla», «Así está bien», la fecha «Una para todos», «Tarjetas en el
  celular», que las tarjetas «se puedan cerrar y abrir con una flechita al costado inferior derecho
  de la evaluacion» y Dispositivo y Medio «Uno para todos pero se puede modificar individual».
  - «Nueva evaluación» (`src/CargaPorJugador.jsx`) va en dos pasos. Paso 1: el test, la fecha (hoy,
    no posterior) y las listas sueltas que no son la Selección (hoy, Dispositivo y Medio de
    Sentadilla Incremental), para todos. Paso 2, «Una fila por jugador»: las columnas que se cargan
    a mano, en el orden de los pasos de antes (`columnasDeLaCarga` en `Evaluaciones.jsx`). En la
    compu, una tabla: el jugador fijo a la izquierda, los títulos de los bloques en dorado arriba de
    sus columnas y la tabla que se corre de costado. En el celular, una tarjeta por jugador con sus
    datos por bloque (tres o más bloques seguidos con las mismas columnas, como las series, en una
    grilla) y la flecha abajo a la derecha que la cierra (queda la Selección y cuántas medidas
    tiene) y la abre. Abajo, «+ Agregar jugador» (abre la hoja para elegirlo).
  - El jugador se elige en la hoja de opciones: solo el plantel actual y nadie dos veces. La
    Selección sale de la categoría de Datos básicos («Mayor (profesional)» es Mayor) y se cambia en
    la fila. Cambiar Dispositivo o Medio para todos cambia las filas que tenían el anterior, no las
    cambiadas a mano. Otro test en el paso 1 deja los jugadores y su Selección y borra lo demás.
  - «Guardar N evaluaciones» guarda una evaluación por fila con jugador y algo cargado (lo que se
    completa solo no cuenta), todas con la misma fecha y de a una. Una fila con algo cargado y sin
    jugador, o un número o un tiempo que no se entiende, no deja guardar y dice de qué fila o de
    quién es. Si una no se puede guardar, las guardadas salen de la carga y al reintentar no se
    repiten. Sacar una fila con algo cargado pregunta; salir con algo cargado, también.
  - «Editar» en las de hoy sigue con el formulario por pasos, sin cambiar el jugador. Isocinecia
    sigue fuera de Cargar.
  - **Queda prohibido** volver a la carga nueva por pasos de a un jugador, ofrecer jugadores que ya
    no están en el plantel, repetir un jugador en la misma carga y una fecha por fila, salvo un
    pedido nuevo. Ver UI-055.
- **Evaluaciones: la elección de test y las categorías de Datos básicos (hecho el 18/10).** Nota
  «sacar la selección de Ajustes / la elección de test para cambiar las listas» (llegó en capturas
  el 17/10; su texto exacto no quedó guardado). Santiago, en cuestionarios: «Sí, elegir el test»,
  que «Sacar la selección de Ajustes» era «La lista «Selección»», «Solo los que tienen listas»,
  que las categorías de Evaluaciones son «Usas las que tenga el jugador en datos basicos», con la
  lista y los nombres de «La de Datos básicos», al cargar «Se puede cambiar, como ahora», y al
  cambiar la categoría en Datos básicos: «Como hicimos en lesiones, se pregunta mismamente por
  base, es decir, hacemos la misma pregunta para la base de lesiones primero y despues para la de
  evaluaciones».
  - **Ajustes › Listas**: arriba, el desplegable «Test» solo con los tests que tienen listas (hoy,
    Estabilidad rotacional y Sentadilla Incremental) y abajo, solo sus listas. «Selección» ya no
    está; el texto de arriba dice que las categorías se cambian en Datos básicos › Ajustes ›
    Listas.
  - **Las categorías (Selección) son las de Datos básicos**, con sus nombres y su orden, en la
    Base, el informe («Vs …»), los V.R., los reportes, la carga y Pegar desde Excel. Datos básicos
    guarda «profissional» la que Evaluaciones guarda «mayor» (la del Excel y la de los V.R.): la
    app las traduce (`deDatosBasicos` y `aDatosBasicos` en `domain/evaluaciones/categorias.js`), y
    lo cargado y los V.R. no cambian (sin SQL). «Vs Sub 15» queda como el Excel cuando el nombre
    coincide; si no, «Vs» y el nombre de Datos básicos («Vs Mayor (profesional)»). Una categoría
    que el club suma en Datos básicos aparece con sus V.R. vacíos. Lo cargado antes con una que no
    está allá (una que el club había sumado en Evaluaciones) se sigue viendo con su nombre, sin
    poder elegirla. Las categorías se leen de `lesiones_opciones` (las ve cualquiera que sigue en
    el club; sin poder leerlas, valen las de la app).
  - **Al cargar** la Selección sigue viniendo de la categoría del jugador y se puede cambiar.
  - **Datos básicos**, al cambiar la categoría de alguien que tenía otra: primero la pregunta de
    Lesiones (si tiene lesiones) y después la misma para Evaluaciones (si tiene evaluaciones), con
    la fecha que se eligió para Lesiones; cada título dice de qué base es. «Desde esa fecha»: las
    evaluaciones de antes quedan con su Selección (o la anterior, si no tenían) y las de esa fecha
    en adelante pasan a la nueva; «En todo su historial»: todas. Cerrar cualquiera de las dos deja
    la categoría como estaba. Con una base en solo lectura no se pregunta por ella. Al pegar desde
    Excel, en la fila del jugador va primero la de Lesiones y, respondida, la de Evaluaciones; cada
    respuesta queda como «Categoría en Lesiones/Evaluaciones: …» con «Cambiar».
  - **Queda prohibido** volver a poner Selección en Evaluaciones › Ajustes › Listas, mostrar ahí
    todas las listas juntas o tests sin listas, usar en Evaluaciones otra lista de categorías que
    la de Datos básicos y cambiar las evaluaciones de un jugador sin preguntar, salvo un pedido
    nuevo. Ver UI-056.
- **Auditoría de seguridad (hecha el 18/10).** Santiago, en medio de la nota de los V.R.: «necesito
  hacer una auditoría de seguridad completa en este momento. Revisa todo nuestro repositorio […]
  Si encuentras cualquier riesgo, soluciónalo de inmediato». Se revisó:
  - **Claves y datos**: no hay claves secretas en el código ni en la historia disponible; la de
    Supabase en la app y en los macros de Excel es la publishable (hecha para estar a la vista: la
    protección es RLS); las del servidor (`SUPABASE_SECRET_KEY`, `OPENFIELD_API_TOKEN`,
    `OPENFIELD_SESSION_SECRET`, `CATAPULT_SESSION_KEY`) salen de las variables de Vercel; las de
    las pruebas son inventadas. Los correos del repositorio son de prueba. El nombre del club
    aparece en comentarios, pruebas y nombres de V.R. viejos (información pública, no un riesgo).
  - **La base**: las 37 tablas con RLS; a anon se le sacó todo (también lo que se cree después) y
    las pruebas de la base lo comprueban; las 69 funciones `security definer` fijan su
    `search_path`.
  - **El servidor** (`api/`): cada función comprueba la sesión con Supabase (o la cookie firmada,
    `HttpOnly`, `Secure`, `SameSite=Lax`, comparada en tiempo constante) antes de usar una clave;
    el mail de una invitación va solo al correo guardado y a la dirección de la app configurada.
  - **Los formularios**: React escapa todo lo que se muestra y la CSP de `index.html` solo deja
    correr scripts propios (no hay `innerHTML`, `eval` ni enlaces armados con lo cargado); la base
    recibe los valores por separado (no hay filtros armados con texto); las fotos se cargan como
    imagen. Al salir se borran las copias del aparato (`limpiarAlSalir`).
  - **Se arregló**: (1) las cabeceras de `vercel.json`: la app no se puede meter en un marco de
    otro sitio (`X-Frame-Options: DENY` y `frame-ancestors 'none'`, que la CSP de la página no
    puede poner), `X-Content-Type-Options: nosniff`, `Referrer-Policy:
    strict-origin-when-cross-origin` y sin cámara, micrófono, ubicación, pagos ni USB
    (`Permissions-Policy`; la app no los usa); (2) «Copiar» de las tablas (`aTexto` en
    `domain/tabla.js`): un texto que empieza como fórmula (=, +, -, @) va con un apóstrofo para que
    Excel o Sheets no lo ejecuten; los números con signo quedan igual y al pegar en la app el
    apóstrofo se saca; (3) `source-map-js` 1.2.1 → 1.2.2 (solo de la compilación y las pruebas;
    `npm audit`, 0 vulnerabilidades).
  - **Queda prohibido** permitir que la app se muestre dentro de otro sitio y copiar sin ese
    apóstrofo, salvo un pedido nuevo.
- **Aislamiento entre clubes (18/10, migración `20261102_aislamiento_entre_clubes.sql`).**
  Santiago: «esta es una aplicación multi-inquilino […] asegúrate de que no haya forma de que un
  club acceda a los datos de atletas de otro. Implementa filtros automáticos a nivel de backend
  basados en el club_id de la sesión». Ese filtro ya existía: las reglas de cada tabla (RLS)
  dejan ver y cambiar solo filas de los clubes de quien entra (`auth.uid()` de la sesión, en
  `club_miembros`), sin que la app tenga que pedirlo; las vistas leen con los permisos de quien
  las abre (`security_invoker`); las funciones con permisos especiales comprueban el club
  (`acceso_club`, `puede_usar_en`, `es_admin_de_club`); un registro no se cuelga de un jugador
  de otro club (`jugador_de_otro_club`); el servidor (`api/`) lee con la sesión de quien pide.
  Quien está en dos clubes ve los dos (es su permiso); el club elegido en la app ordena la
  pantalla, no es el candado. Se revisó con la base de pruebas, entrando como cada una de las 32
  cuentas: ninguna vio, cambió ni borró filas de un club donde nunca estuvo.
  - **Se arregló**: `ajustes`, la tabla de cuando la app era de un solo club (la app y el Excel
    ya no la usan), la leía cualquier cuenta autorizada de cualquier club, con el nombre del
    club de entonces. Quedó cerrada para la API (la fila queda).
  - **Se sumó**: `huecos_entre_clubes()` (solo desde el SQL Editor): lista lo que podría mezclar
    clubes (una tabla sin reglas, una regla que abre sin mirar el club, una vista que las
    saltea, algo que se lee sin columna de club fuera de lo revisado, algo abierto sin cuenta).
    Vacía, todo bien; la migración se frena si no lo está. Y en `escenarios.sql`, «Aislamiento
    entre clubes»: con cada cuenta y en cada tabla con club (también las que se sumen) cuenta
    lo ajeno que ve, cambia o borra a ciegas, más las funciones que leen por club; se comprobó
    que la prueba falla al plantar una regla floja de ver, de borrar o de cambiar.
  - **Queda**: Realtime avisa a cualquier cuenta conectada que se borró una fila (solo su
    número, sin datos ni club; Supabase no filtra los borrados). No se tocó: no muestra datos
    de nadie y cambiarlo es otro mecanismo.
  - **Queda prohibido** una tabla o vista con datos de un club sin su `equipo_id` y sus reglas,
    o una regla que abra sin mirar el club, salvo un pedido nuevo.
- **Consentimiento de los atletas (hecho el 18/10, migración `20261103_consentimiento.sql`,
  UI-057).** Santiago, como parte de cumplir con el RGPD y la CCPA: «Los clubes deben confirmar
  que tienen el consentimiento de los atletas (o de sus tutores si son menores de edad) para
  subir sus datos». En cuestionarios: «Una vez por club»; los jugadores ya cargados, «Quedan
  todos confirmados»; las personas fuera de Datos básicos, «Confirmar al cargar el archivo»;
  el documento firmado, «No, lo guarda el club»; mientras no confirme, «No se cargan hasta
  confirmar»; quién, «Entidad y administrador» y, como la entidad todavía no tiene su cuenta
  vinculada al club (paso 3), «Ahora el administrador; la entidad después».
  - **La base** (`consentimientos`): cada confirmación con el texto tal como se mostró, quién,
    como qué (administrador, entidad o carga) y cuándo, que pone la base; no se cambia ni se
    borra desde la app. La del club la hace el administrador (la entidad, cuando su cuenta
    quede vinculada al club: se suma a la política `consentimientos_confirmar`); la ven todos
    los del club. La de personas, quien carga en esa base, y la ve quien tiene esa base.
  - **Sin confirmar no se carga**: el disparador `exigir_consentimiento` frena las filas nuevas
    de `jugadores`, `lesiones`, `evaluaciones`, `gps` y `gps_en_curso` (`falta_consentimiento`)
    y la fila de una persona fuera de Datos básicos sin confirmar, al cargarla o al pasarle una
    fila (`falta_consentimiento_persona`; el nombre se compara sin mayúsculas ni espacios de
    más). Lo ya cargado se ve y se cambia igual. A quien no sigue en el club lo frenan sus
    reglas antes (no se entera de si el club confirmó). Desde el SQL Editor, no frena. Partido
    y Flujo diario no se frenan: usan el plantel de Datos básicos, que sí.
  - **Lo que ya estaba**: las personas fuera de Datos básicos ya cargadas quedan confirmadas al
    correr la migración, sin nombre de quien confirmó; los jugadores no necesitan nada.
  - **En la app**: el aviso de la pantalla principal y la hoja «Personas fuera de Datos
    básicos» en Lesiones y Evaluaciones (pegar) y al guardar una carga de GPS (UI-057). Si la
    base dice que falta, el aviso de cada pantalla lo explica.
  - **No es todo el RGPD ni la CCPA**: hacen falta también la política de privacidad, el
    contrato con cada club (la app trata datos por cuenta del club), dónde se guardan los datos
    y qué hacer ante una filtración. Lo tiene que revisar alguien que sepa de leyes. Siguen,
    nota por nota: exportar todo lo de un atleta (portabilidad) y borrarlo del todo (derecho al
    olvido).
  - **Queda prohibido** cargar datos nuevos de atletas sin la confirmación del club, o de una
    persona fuera de Datos básicos sin la suya, y que la confirme el staff por el club, salvo
    un pedido nuevo.
  - **Reabierta (23/10, UI-078): se saca todo.** Ver «Sin el consentimiento de los atletas
    (23/10)», abajo.
- **Sin el consentimiento de los atletas (hecho el 23/10, migración
  `20261119_sin_consentimiento.sql`, 2026.10.23.5; UI-078).** Santiago, en medio del paso 3c:
  «Te dije que saques lo del consentimiento de los jugadores, no lo vamos a usar» (ese pedido
  anterior no está en esta documentación; se registra con este mensaje). En un cuestionario:
  qué sacar, «Todo» (el aviso del club en la pantalla principal, la hoja de las personas fuera
  de Datos básicos al cargar y las reglas de la base); lo ya guardado, «Se borran»; cuándo,
  «Ahora».
  - **La base**: salen los disparadores `exigir_consentimiento` (jugadores, lesiones,
    evaluaciones, gps y gps_en_curso) y se borra la tabla `consentimientos` con todo lo que
    tenía (no se puede deshacer), con sus funciones. Se carga como antes del 18/10.
    `20261104_exportar_atleta.sql` pedía esa tabla para correr: ya está corrida y no hace
    falta volver a correrla.
  - **En la app**: sin el aviso de la pantalla principal y sin la hoja «Personas fuera de Datos
    básicos» (Lesiones, Evaluaciones y GPS). Sin señal, las personas fuera de Datos básicos se
    guardan y se pegan como las demás (antes se frenaban porque su consentimiento se
    confirmaba con señal: UI-076 y UI-077). La clase `consentimiento-personas` queda: es la de
    las listas de la Regla 1.
  - **Queda prohibido** volver a pedir el consentimiento, o frenar una carga por él, salvo un
    pedido nuevo.
- **Exportar los datos de un atleta (hecho el 19/10, migración `20261104_exportar_atleta.sql`,
  UI-058).** Santiago: «Añade una función para que un club pueda exportar todos los datos de un
  atleta si este lo solicita (Portabilidad)». En un cuestionario: «Excel y además JSON»; además
  de Datos básicos, Lesiones, Evaluaciones y GPS, «Partidos donde estuvo» e «Historial de
  cambios»; «El administrador, con todo»; «Datos básicos, en la ficha».
  - **La base** (`exportar_atleta(jugador)`): todo lo del jugador en su club, en un solo jsonb.
    Solo el administrador del club y con todo, aunque no tenga cada base (para cualquier otro,
    o un jugador que no existe, contesta lo mismo: `solo_admin`). Lleva su fila de Datos
    básicos y sus nombres anteriores; sus lesiones, evaluaciones y GPS, con el correo de quien
    los cargó y cambió; de cada partido del club donde figura por su nombre (o uno anterior),
    solo lo suyo: convocado, titular, cuándo entró y salió (nada de sus compañeros); el
    historial de sus lesiones (quién, cuándo y qué) y de su ficha, evaluaciones y GPS (cuándo
    y, si se sabe, quién); y los nombres de columnas y listas del club (no son del atleta, no
    van en el JSON). Lo de otros clubes donde estuvo no va: es de esos clubes.
  - **El Excel** (`src/domain/xlsx.js`, sin bibliotecas nuevas: un .xlsx de verdad, revisado
    con Excel de Python y con LibreOffice): una hoja por base con datos (Datos básicos,
    Lesiones, una por test de Evaluaciones, GPS, Partidos, Historial de cambios), con los
    nombres de columnas y listas del club, la primera fila fija y en negrita; lo guardado, no
    lo que se calcula; los números como números; un texto que empieza con «=» queda texto.
  - **El JSON**: lo guardado tal cual (códigos de las listas, fechas ISO), para otro sistema.
  - **Dónde**: Datos básicos, elegir un jugador y «Ver ficha» (solo el administrador): la hoja
    de abajo con su nombre, «Exportar sus datos», «Bajar el Excel» y «Bajar el JSON». Los
    archivos se llaman `datos-de-<nombre>-<fecha>`. Ahí va a ir también el borrado.
  - **Borrar del todo a un atleta (derecho al olvido): descartado (23/10).** Santiago, en un
    cuestionario, cuando Claude propuso arrancarlo como la nota que seguía: «no vamos a hacer
    eso». No se suma el borrado a «Ver ficha» ni en otro lado; exportar queda como está.
    **Queda prohibido** agregar el borrado del todo de un atleta, salvo un pedido nuevo.
  - **Arreglo (19/10, migración `20261105_exportar_atleta_partidos.sql`).** En la base del club,
    exportar decía «Falta una actualización de la base de datos». El diagnóstico en el SQL
    Editor dio «function unnest(jsonb) does not exist»: ahí los titulares y los convocados de
    los partidos están guardados como lista JSON (jsonb), no como lista de textos (text[], la
    instalación desde cero y las pruebas). `exportar_atleta` ahora los lee igual en los dos
    casos (`lista_de_nombres`), y las pruebas de la base lo prueban con las dos. La app decía
    «Falta una actualización» ante cualquier función que faltara adentro: ahora solo si falta
    `exportar_atleta`; lo demás es «No se pudieron preparar los datos» (y lo que dijo la base
    queda en la consola).
  - **Falla conocida, para después (Santiago, 19/10: «Solo la exportación»)**: con esas mismas
    columnas en jsonb, cambiarle el nombre a un jugador falla (`partido_con_nombres_de_hoy`, de
    `20261022_nombres_en_todos_lados.sql`, las lee como text[]; comprobado en la base de
    pruebas pasándolas a jsonb). En la base del club, cambiar un nombre en Datos básicos
    seguramente da «No se pudo guardar». El arreglo es el mismo: leerlas igual en los dos casos.
  - **Arreglada (20/10, migración `20261109_nombres_con_listas_json.sql`).** Santiago, en un
    cuestionario, eligió seguir con «Cambiar el nombre de un jugador». En la base del club
    (solo mirando cómo está armada y cuántas filas hay, sin leer datos) los titulares y los
    convocados están como lista JSON y `partido_con_nombres_de_hoy` es la de `20261022`. Ahora
    esa función los lee igual en los dos casos y los devuelve con el mismo tipo; lo demás
    (cambios, guía de la transmisión, formación, lo del rival sin tocar) queda igual. Al
    correrla, los partidos que hayan quedado con un nombre anterior pasan al de hoy. Las pruebas
    de la base cambian un nombre con las dos formas; sin el arreglo, con la lista JSON, da
    «function unnest(jsonb) does not exist». Claude la corrió en la base del club por la
    conexión y avisó.
  - **También en los V.R. por jugador del GPS (20/10, migración
    `20261110_nombres_en_los_vr.sql`).** Santiago preguntó si la nota era que el nombre cambie
    «en todos lados, no solo en partido». Se revisó en la base del club, contando filas sin leer
    nombres: Lesiones, Evaluaciones, GPS y Entrenamiento guardan el número del jugador (en las
    tres primeras, ninguna fila de un jugador tiene además el nombre escrito), así que el nombre
    nuevo se ve solo; Partido guarda los nombres escritos y los cambia la base; las personas
    fuera de Datos básicos no son jugadores y no cambian; el nombre de Catapult es aparte. Lo
    único con el nombre escrito que no cambiaba: los V.R. por jugador del GPS (los del Excel, con
    el jugador en `grupo`). Santiago, en un cuestionario: «Sí, que cambien». Hecho: al cambiar el nombre
    en Datos básicos, los V.R. del GPS del club con un nombre anterior de ese jugador en `grupo`
    pasan al de hoy (con los mismos cuidados que en los partidos) y queda en los últimos
    cambios de Valores de referencia, a nombre de quien cambió el nombre y con «Volver». Si en
    esa tabla ya hay un V.R. con el nombre nuevo, ese queda como está. Este paso nunca frena el
    cambio de nombre. Hoy la base del club no tiene V.R. por jugador: sirve para cuando se
    carguen. En la base del club: Claude corrió por la conexión la función de los V.R. y el
    paso final (0 V.R. cambiados); el cambio del disparador (`jugadores_nombre_cambiado`) no
    llegaba a la base por la conexión (se quedaba esperando una confirmación que no aparecía) y
    lo corrió Santiago en el SQL Editor (20/10: «Listo»). Claude comprobó después, solo
    mirando cómo está armada la base, que quedó puesto y conectado, y que ni las cuentas ni
    anon pueden llamar a esas funciones.
    - **Queda prohibido** que el cambio de nombre en los V.R. toque el tipo o la tabla, o que
      frene el cambio de nombre, salvo un pedido nuevo.
  - **Nota cerrada** (Santiago, 20/10, en un cuestionario: «Sí, está bien, cerrada»).
  - **Queda prohibido** que lo exporte alguien que no es el administrador, o que el archivo
    lleve datos de otros jugadores, salvo un pedido nuevo.
- **En curso: la planilla de valor referencial** (quedó en pausa por la auditoría). Santiago, en
  cuestionarios: elegir la base, ver todos sus datos, filtrar la muestra y calcular el V.R. con la
  lógica de su planilla («Plantilla VR»: descarte de atípicos por cuartiles y cortes que buscan
  2,5 / 13,5 / 34 / 34 / 16 %); «GPS primero», el sentido «Al calcular», «Automático y Manual»,
  Malo «Copialo igual» y «Un solo nombre libre» en «Agregar V.R.». La cuenta, copiada y
  comparada con la planilla recalculada (datos inventados), da igual; falta mostrarle la maqueta
  del flujo antes de hacerlo.
  - **La maqueta (19/10), con datos inventados.** GPS › Valores de referencia › «Agregar V.R. de
    (dispositivo)»: paso 1, el nombre libre y la muestra (todas las filas de ese dispositivo en la
    Base, filtradas con el embudo de cada columna, y arriba cuántas filas, jugadores y fechas
    quedan); paso 2, por medida, el sentido, Automático/Manual, los cinco valores (Excelente a
    Malo) con el % de la muestra en cada uno y cuántos datos y atípicos (en la compu, una tabla;
    en el celular, una tarjeta por medida); al guardar, una tarjeta más del dispositivo con sus
    cinco filas, como los V.R. por jugador. Santiago, en cuestionarios: «Me gusta, solo agregale
    alguna manera de poder ver que datos se descartaron como atipicos»; Recalcular, «Sí, con
    «Recalcular»»; los promedios del equipo, «Depende el VR que se quiera hacer» y, sin la opción
    aparte, «Se ven y se filtran» (las filas del promedio están en la tabla y se sacan con el
    embudo de Nombre); «Saca la opcion de entrenaron o no entrenaron, eso no es para el vr» (era
    «Promedios del equipo: No entran / Entran»: descartada); el sentido de cada medida va en
    Ajustes › Cabeceras («tiene que ser para todas las bases igual»), sin Automático/Manual («eso
    se decide si el automatico da malos porcentajes en cada categoria»); y el orden, «Primero
    Ajustes, después el V.R.».
  - **Nota 1, hecha el 19/10 (migración `20261107_sentido_de_las_medidas.sql`; UI-059).** En
    GPS, Evaluaciones, Lesiones y Datos básicos, la hoja de una cabecera de números o tiempos
    pregunta «Para los V.R.»: «Más es mejor» o «Menos es mejor» (columna `sentido` de
    `gps_campos`, `evaluaciones_campos`, `lesiones_campos` y `datos_basicos_columnas`; vacío es
    lo de la app). Cuáles: en GPS, las medidas, sus por minuto y los tiempos (no el Microciclo ni
    las horas); en Evaluaciones, lo que se carga con números o tiempos y lo calculado que tiene
    V.R. (relativas y déficits); en Lesiones, la edad, las horas hasta la imagen y los días de
    recuperación; en Datos básicos, la edad y las horas previas (`src/domain/sentido.js`). De
    entrada, «Más es mejor»; los déficits de Evaluaciones, «Menos es mejor», como sus clases. Lo
    cambia quien cambia las cabeceras (las mismas políticas). Sin el SQL, la app sigue como antes
    y no lo pregunta. Todavía no lo usa ninguna cuenta: es lo que va a venir elegido en la nota 2.
    **Cambio del mismo día (2026.10.19.4; UI-059).** Santiago, al probarlo: «solo tienen que
    aparecer cuando la base de datos o pantalla que este viendo tenga Valores Referenciales»; en
    cuestionarios, Lesiones «Sacarla de Lesiones» (su «VR» del reporte «no es un vr es un valor
    de referencia grupal») y en GPS y Evaluaciones «Todas las de números y tiempos». Queda solo
    en GPS y Evaluaciones (no en un test sin V.R.). El SQL ya estaba corrido en la base del club
    (19/10, por la conexión): las columnas `sentido` de `lesiones_campos` y
    `datos_basicos_columnas` quedan sin uso; no se borraron.
  - **Nota 2, hecha el 19/10 (migración `20261108_gps_vr_planilla.sql`; UI-060):** «Agregar V.R.» con la planilla en GPS, como la maqueta con lo de arriba:
    los atípicos de cada medida a la vista (qué filas, con qué valor y entre qué límites), las
    filas del promedio del equipo en la tabla para filtrarlas, el sentido de Ajustes (que se
    puede cambiar en cada cálculo), Automático/Manual al calcular, y «Recalcular» en la tarjeta
    (con la misma muestra y lo elegido, con los datos de ese día; pregunta antes y los números de
    antes quedan en los últimos cambios, con «Volver»).
    - **Cómo quedó.** La cuenta es la de la planilla (`src/domain/valorReferencial.js`, comparada
      con la planilla recalculada en 45 casos inventados; tres quedan en sus pruebas). La muestra
      y lo que se guarda, en `src/domain/gps/planillaVr.js`; la pantalla, en
      `src/PlanillaVrGps.jsx`. Las medidas son las de la hoja de los V.R. (de D a Mts >= 90% Pico,
      sus por minuto y el Tiempo); una medida sin al menos dos números distintos queda «Sin datos
      suficientes» y no se guarda. Un V.R. calculado se guarda con un solo nombre (en `tabla`,
      con tipo y grupo vacíos), el Bueno en el promedio y las otras cuatro en las categorías, y
      en `planilla` con qué se calculó: los filtros con los valores de las filas (el código de
      una opción, la fecha, el id del jugador; no los textos ni los nombres, así sirve en los dos
      idiomas), lo elegido en cada medida, cuántas filas y la fecha. Las personas fuera del
      plantel no tienen id: en «Recalcular» van todas juntas.
    - **Los colores con «Menos es mejor».** Un V.R. así trae las franjas al revés (Excelente por
      debajo del Bueno): el informe y el reporte grupal pintan lo bajo en verde
      (`colorDeMayorMejor`). Los V.R. de antes no cambian.
    - **Se calcula con todas las filas del GPS:** mientras llegan las de antes (la primera vez en
      un aparato) o si no llegaron, «Agregar V.R.» y «Recalcular» quedan apagados y se dice por
      qué.
    - **Sin la actualización 20261108**, «Agregar V.R.» sigue como antes (tipo, tabla y grupo,
      para escribirlo a mano). Con ella, ese V.R. vacío ya no se ofrece: «Agregar V.R.» lleva a la
      planilla, como estaba anotado en «Lo que sigue». Los números de cualquier V.R. se siguen
      cambiando a mano con dos toques.
    - **Cambio del mismo día, al probarla (2026.10.19.6; UI-060).** Santiago: «Necesito poder
      elegir las columnas que voy a usar en el vr (Siempre tienen que ser numericas)» y «El manual
      es para que yo elija los desvios que va a usar la categoria […] cada 0.25 desvios […] y
      siempre la suma de todos los % tiene que ser 100% si no es 100% no se deja avanzar»; en un
      cuestionario, «Vienen todas las numericas», «Los que dio Automático» y «Revisa devuelta el
      archivo […] ahi esta la logica de xq se descartan algunos desvios». Las medidas son todas
      las columnas de números de GPS (también las del club; no las fijas), todas marcadas de
      entrada, y se eligen en «Elegir medidas»; se guardan solo las elegidas (también para
      «Recalcular»). En Manual se eligen los desvíos de cada categoría, de entrada los de
      Automático, con lo que prueba la planilla: Muy bueno y Regular de 0,25 a 1,75; Excelente
      desde Muy bueno + 0,25 y Malo desde Regular + 0,25, hasta 2 (la planilla deja en blanco lo
      que pasa de 2 y las opciones que no superan a la de al lado). Se guardan en `planilla` y la
      suma de los % tiene que dar 100 % para guardar. Diferencia con la planilla: allá, en Manual,
      el % de Bueno es el de Automático (AC29) y por eso la suma podía no dar 100 % (AC33); acá
      sale de los cortes elegidos.
      Santiago lo confirmó en cuestionarios (19/10): Malo, «Todo lo que queda por debajo de
      Regular» (en «Menos es mejor», por encima); la suma de los % incluye el Bueno («la suma de
      los % que tiene que dar 100% suma el promedio (Bueno)»), y Bueno, «Bueno con el Muy bueno
      que elijo (como ahora)». Con eso las cinco categorías cubren toda la muestra y la suma da
      siempre 100 %; el control queda por seguridad. **Queda prohibido** tomar en Manual el % de
      Bueno de Automático, como AC29, salvo un pedido nuevo.
    - **Segundo cambio del 19/10, al probarla (2026.10.19.7; UI-060).** Santiago:
      - «si eso tiene que quedar en el paso 1, el paso 2 es el resultado de los que hiciste»: qué
        variables entran se elige en el paso 1, debajo del nombre («Variables del V.R.», «N de M
        elegidas» y «Elegir variables»); el paso 2 es el resultado. Al volver del paso 2, la
        muestra sigue filtrada como estaba (antes se perdían los filtros) y lo elegido en cada
        variable sigue; un V.R. nuevo arranca sin filtros.
      - «hace que cada desvio quede debajo de su columna asi queda mejor y no es gigante»: en la
        compu, en Manual, debajo de la variable va una fila «Desvíos» con la suma de los % y cada
        desvío en la columna de su categoría (Bueno, el promedio, no tiene). En el celular siguen
        juntos en la tarjeta.
      - «todo queda redondeado a dos decimales y si se quiere ver mas se hace click sobre la celda
        y se aumentan los decimales pero siempre en 2»: los valores del V.R. y de los atípicos van
        con 2 decimales; tocando un valor del V.R. se ven todos y, otra vez, vuelve a 2. Los
        tiempos siguen en horas y minutos. Es en esta pantalla: las tarjetas de Valores de
        referencia y el informe siguen con el formato de cada columna.
      - «y cambia medida por variables»: en esta pantalla dice «Variables» donde decía «Medida» o
        «Medidas».
    - **Por qué no da igual que la planilla con muchas filas** (19/10, al comparar el mismo V.R.:
      «no me esta dando lo mismo»). En el archivo de la planilla, «1.3 Proceso_Absolutos» tiene
      fórmulas hasta la fila 3738, que leen «1.1 Datos_Absolutos» hasta la fila 3720: toma como
      mucho 3716 filas. Además, el promedio (SUBTOTAL hasta la fila 10006) cuenta como mucho 9984
      filas y el desvío llega hasta la 100006. «2.3 Proceso_Relativos» tiene los mismos límites.
      La app usa toda la muestra: con hasta 3716 filas da lo mismo que la planilla (los desvíos
      elegidos coincidían; cambiaban el promedio y el desvío). Santiago lo confirmó en un
      cuestionario (la celda D10, «Menos de 12402») y eligió «Con todas las filas (Recomendado)».
      **Queda prohibido** copiar en la app el límite de filas de la planilla, salvo un pedido
      nuevo.
    - **Las por minuto con tiempo 0** (19/10; Santiago: «Para los relativos que tienen tiempo pero
      tienen dato 0 que en la planilla da div 0 y da error, que hiciste?»). En la planilla, una
      fila con tiempo 0 da #DIV/0! y el V.R. queda en blanco; hay que borrarla a mano. La app no
      la usa (tampoco la que no tiene tiempo) y calcula con las demás; el dato 0 con tiempo entra
      como 0 por minuto, como en la planilla, y si todos los datos son 0 el promedio usa 0,01, como
      la planilla. En un cuestionario eligió «Que lo diga (Recomendado)»: en esas variables,
      «Datos» suma «· N sin tiempo» (las filas con el dato y sin tiempo o con tiempo 0), también
      cuando no alcanza para calcular. La cuenta no cambia.
    - **Los atípicos con promedio de 1 o menos, también en las absolutas** (19/10). Santiago vio
      en Dist «Quedaron afuera los menores a -1997,8» y pidió revisar los rangos: «nunca van a
      haber datos negativos en esa variable». La cuenta es la de la planilla (columna F de
      «1.3 Proceso_Absolutos»: CUARTIL 1 − 1,5 × (CUARTIL 3 − CUARTIL 1)); con muchos datos
      chicos y una cola de grandes, el límite de abajo da negativo y por abajo no se descarta
      nada. Él respondió: «Agrega la condicion de que si el promedio es menor a 1 no descarta
      nada y no se ordenan los datos de menor a mayor, se dejan como estan, por eso te da
      negativo». Hecho: si el promedio de todos los datos es 1 o menos, no se descarta nada,
      también en las absolutas (su hoja no lo tenía; se usa «1 o menos», como la hoja de
      relativos). El orden no cambia nada: CUARTIL de Excel da lo mismo con los datos
      desordenados (comprobado con datos inventados; la app no cambia el orden de las filas).
      Queda pendiente que elija cómo se muestra el límite de abajo cuando no deja afuera ningún
      dato (le preguntó dos veces; no eligió).
    - **Correr los SQL por la conexión de Supabase** (permiso del 19/10): una consulta con
      `drop trigger` se queda esperando y se corta al minuto sin aplicar nada, aunque el disparador
      no exista. Si pasa, se corre por partes, cada una completa (así se corrió `20261026`).
    - **Queda prohibido** guardar en `planilla` textos o nombres de jugadores, y volver a poner
      «Promedios del equipo: No entran / Entran» o Automático/Manual en Ajustes, salvo un pedido
      nuevo.
    - **La base del club no tenía `20261026_gps_referencias_categorias.sql`** (las categorías de
      los V.R.; visto el 19/10 al correr `20261108`, que la necesita). No se podía correr: su
      control pedía exactamente cuatro políticas en `gps_referencias` y, después de
      `20261029_niveles_de_permiso.sql`, hay siete. Ahora busca las cuatro por su nombre, y las
      pruebas de la base la vuelven a correr después de la última, como las demás que se pueden
      volver a correr. Santiago, 19/10: «a partir de ahora tenes permiso para correr los sql en
      supabase sin preguntarme pero si avisarme»: Claude corre `20261026` y `20261108` por la
      conexión y avisa.
    - **Nota 2 cerrada** (Santiago, 19/10: «Cerrada»). Sigue pendiente que elija cómo se ve el
      límite de abajo de los atípicos cuando no deja afuera ningún dato. El 20/10 eligió: «deja como esta el limite» (se sigue viendo el que da la cuenta, aunque sea
      negativo).
  - **Nota 3, hecha el 19/10 y 20/10 (2026.10.20.1; UI-061): la planilla de V.R. en
    Evaluaciones** («Lo mismo que GPS, para los V.R. de cada test»). Santiago, en
    cuestionarios (19/10): «Un botón arriba», la muestra con «Las de esa Selección», las
    relativas «En ves de tiempo se divide por peso» y que llene el bloque entero («Eso se usa
    para ver el vr, lo que vos decis es mi seleccion»).
    - **Cómo quedó.** En Evaluaciones › Valores de referencia, arriba, «Calcular con la
      planilla» abre los dos pasos de GPS (la pantalla pasó a `src/PlanillaVr.jsx`, para las
      dos bases, y sus estilos a `src/planillaVr.css`): en el paso 1 se elige la categoría (de
      entrada, la primera que ya tiene V.R.; si no, Mayor), las variables y la muestra, que
      arranca filtrada por la Selección de esa categoría. Las variables son las de las tablas
      de V.R. del test, sin las «DE» de los déficits (se llenan con los desvíos elegidos). Las
      relativas por peso (las «Rel»: la fuerza ÷ el P.C.) son como las por minuto de GPS: cada
      fila, su fuerza ÷ su peso; el promedio, la suma de las fuerzas ÷ la de los pesos; las
      filas sin peso o con peso 0 no entran y «Datos» dice «N sin peso». Los tiempos, en la
      unidad del Excel, como los V.R. de siempre; los porcentajes, como porcentaje. Al guardar,
      el bloque de la categoría queda con lo calculado (las variables que no se calcularon y el
      título, como estaban), con qué se calculó (`planilla` del bloque; no hizo falta tocar la
      base) y el n de la categoría en el resumen, si el test tiene resumen. El bloque dice
      «Calculado el … con N filas · filtros» y suma «Recalcular»; en los últimos cambios, un
      cálculo es una línea («Calculó …» o «Recalculó …») y «Volver» deja el bloque entero como
      estaba. La cuenta y la muestra, en `src/domain/evaluaciones/planillaVr.js`.
    - **Pedido del 19/10, al ver las capturas:** «Agrega estos datos para todos los vr que
      hagamos de aca en adelante: Cantidad de datos utilizados en cada variable. Desvio de la
      muestra y saca esa fila de promedio que esta de mas». Hecho, en GPS y en Evaluaciones,
      para los V.R. calculados con la planilla: arriba, «n» (los datos usados después de sacar
      los atípicos) y el desvío de la muestra; sin la fila Promedio (es el Bueno). En GPS, el
      desvío va en `desvio` y el n en `planilla.n` (no se cambia a mano); en Evaluaciones, en
      las filas n y Desv. Estándar del bloque (también en los tests que no tenían esa fila,
      como Zona Media o Press Plano), y lo que había en Promedio de esas variables se va. Los
      V.R. cargados a mano o por SQL se ven como antes.
    - **Los tiempos sin la regla del promedio de 1 o menos.** En Evaluaciones los tiempos van
      en la unidad del Excel (días: 3:04 es 184 ÷ 1440) y su promedio siempre da menos de 1, así
      que nunca se descartaban atípicos. Santiago, en un cuestionario: «Cuando se use tiempo se
      saca esa regla». Hecho en las dos bases: en una variable de tiempo, los atípicos se
      descartan siempre con los cuartiles.
    - **Solo las variables que se usaron (20/10, 2026.10.20.2).** Santiago: «En el vr solo dejas
      las columnas que se hayan usado porfavor, si no se usaron no tienen que estar en el vr».
      Hecho en los V.R. calculados con la planilla: la tabla muestra solo las variables con
      resultado (en Evaluaciones, también sus «DE»; una tabla sin ninguna no va; las que
      quedaron «Sin datos suficientes» tampoco). En Evaluaciones, el bloque de la categoría
      guarda solo lo calculado (con su título); lo de antes queda en los últimos cambios, con
      «Volver». Los V.R. cargados a mano o por SQL se ven como antes, con todas las columnas.
    - **Queda prohibido** volver a mostrar la fila Promedio en un V.R. calculado con la planilla
      aplicar la regla del promedio de 1 o menos a los tiempos y dejar en un V.R. calculado
      variables que no se usaron, salvo un pedido nuevo.
    - **Nota 3 cerrada** (Santiago, 20/10, en un cuestionario: «Está bien, cerrada»).
- **En curso: cargar sin señal y a la vez que otra persona (20/10).** Santiago eligió esta nota
  y, en cuestionarios: en «Todas» las bases; sin señal «Tiene que poder hacer todo y que se suba
  cuando vuelva a tener internet»; si dos cambian la misma fila, «Se juntan; si es la misma
  celda, aviso»; «Las dos cosas» (las bases y Partido); una fila que otro borró mientras se la
  cambiaba sin señal «Queda borrada y te aviso»; la copia para trabajar sin señal «Solo donde se
  active»; Ajustes y Cuentas «Sí, con señal»; Entrenamiento (las tareas que van a OpenField)
  «Lo vemos al final». Preguntó los riesgos: Claude explicó los datos de salud en el celular
  (la copia es de esa cuenta y ese club, se borra al cerrar sesión, al cambiar de club y al
  perder el permiso; queda el riesgo de un celular perdido y desbloqueado), los permisos que
  cambian sin señal (la base rechaza lo que ya no se puede y la app lo dice), quién hizo cada
  cosa (la cuenta y la hora de cada cambio) y los choques. Sobre «una fila virtual donde se
  vayan cargando sin pisarse» (nota de Santiago): se puede; es el paso 2 (cada guardado manda
  solo su cambio, la base los aplica en orden y frena los duplicados con sus reglas).
  - **Orden acordado** (Santiago: «Antes de eso resolvamos los puntos debiles de hoy y las
    reglas de duplicados»): A) los puntos débiles de hoy y las reglas de duplicados, en tres
    partes (GPS › Cargar un día; GPS › Pegar desde una planilla; Evaluaciones); 1) ver sin
    señal; 2) la fila de espera de cambios; 3) cargar, cambiar y borrar sin señal; 4) Partido
    compartido entre celulares (y Entrenamiento, al final).
  - **Reglas de duplicados acordadas.** GPS: la de hoy, en la base (mismo día, misma distancia,
    tiempo y hora de inicio: el CSV ya está y no se carga). Regla 1, en Cargar un día, Pegar
    desde una planilla y Evaluaciones: «Si coincide fecha y jugador pero no datos se avisa…», con
    «Ir a la Base» (las filas que coinciden, con lo cargado en espera) o cargarlo directamente,
    que «Reemplaza» las filas de antes («Las del mismo dispositivo»; el promedio del equipo, «Sí,
    con el nuevo»). En GPS, la clave es «Jugador, fecha y hora de incio para preguntar si es
    duplicado»: otra hora de inicio es otro turno y se suma. Evaluaciones: «Es repetida si
    coincide nombre, fecha, y todos los datos son iguales» (en la base del club no hay ninguna).
  - **Hecho, parte A1 (20/10, migración `20261111_gps_guardar_dia.sql`, 2026.10.20.3; UI-062):
    GPS › Cargar un día.** Se guarda todo el día de una vez (todo o nada), con el día del club
    bloqueado mientras se revisa y se guarda: dos personas que guardan a la vez no pasan las dos.
    La regla del CSV que ya está quedó también en la base. La Regla 1, como arriba. En la base
    del club, contando filas sin leer datos: el total de cada jugador no tiene hora de inicio
    (ninguno de los cargados con Cargar un día y la mitad de los de antes) y las tareas sí casi
    siempre; por eso la misma sesión se reconoce por las tareas y, al reemplazar, cambian todas
    las filas de esos jugadores de ese día con ese dispositivo (tareas y total) y el promedio del
    equipo. No hubo nunca dos turnos del mismo jugador con el mismo dispositivo el mismo día.
    Al elegir la fecha, «Ese día ya hay N filas de otra sesión» pasó a «Ese día ya hay N filas en
    la Base» (la misma sesión se revisa al guardar). Sin la actualización de la base se guarda
    como antes y reemplazar avisa que falta.
    - **Límite conocido:** si un día hubiera dos turnos con el mismo dispositivo y se reemplaza
      uno, se reemplazan también las filas del otro turno de esos jugadores (el total no tiene
      hora). El aviso dice cuántas filas son y deja revisarlas antes con «Ir a la Base».
    - **Queda prohibido** que la app guarde un día por partes o sin la revisión de la base, y que
      «Reemplazar» toque otro dispositivo u otro día, salvo un pedido nuevo.
  - **Hecho, parte A2 (20/10, migración `20261112_gps_pegar_filas.sql`, 2026.10.20.4; UI-063):
    GPS › Pegar desde una planilla.** Lo pegado se guarda de a tandas de días enteros (hasta 500
    filas; un día más grande va solo): cada tanda, toda o nada, con sus días bloqueados (el mismo
    bloqueo que Cargar un día: Cargar y Pegar del mismo día no pasan a la vez). La regla de
    siempre, «Ya está en la app» (la misma persona, el mismo día y los mismos datos; el
    dispositivo no cuenta), quedó también en la base: si otra persona cargó esas filas mientras
    tanto, no se duplican. Dos iguales dentro de lo pegado se guardan las dos, como antes. La
    Regla 1, por día: un día de lo pegado es una sesión que ya está con otros datos si algún
    jugador (o persona) pegado tiene ese día, con el mismo dispositivo, una fila con la misma
    hora de inicio. Esos días no se guardan y la app pregunta, con la lista de días (cada uno con
    cuántos jugadores y cuántas filas tiene): «Ir a la Base» o «Reemplazar y cargar». Con
    reemplazar, en esos días se borran las filas de los jugadores pegados con ese dispositivo
    (tareas y total) y, si lo pegado trae el promedio del equipo de ese día, ese promedio; y se
    guardan todas las pegadas de ese día (también las que ya estaban iguales). Si lo pegado no
    trae el promedio, el aviso no dice que lo borra (el promedio de antes queda). Si mientras se
    revisaba otra persona cargó esos días, no se guardan y dice «Mientras tanto cambiaron filas
    de esos días en la Base.» (se vuelve a leer y se puede revisar de nuevo). Sin la
    actualización de la base se guarda como antes y reemplazar avisa que falta.
    - **Límite conocido:** como antes, si se corta a mitad de camino, las tandas ya guardadas
      quedan y el aviso dice cuántas filas se cargaron; al volver a intentar, esas cuentan como
      «Ya está en la app».
    - **Queda prohibido** que Pegar guarde un día por partes o sin la revisión de la base, y que
      «Reemplazar» toque otro dispositivo u otro día, salvo un pedido nuevo.
  - **Hecho, parte A3 (20/10, migración `20261113_evaluaciones_guardar.sql`, 2026.10.20.5;
    UI-064): Evaluaciones.** La regla de Santiago quedó en la base como regla fija: no puede
    haber dos evaluaciones iguales del mismo test (la misma persona, la misma fecha y los mismos
    datos), se carguen como se carguen; en la base del club no había ninguna. «Cargar» (una fila
    por jugador) y «Pegar desde Excel» guardan de una vez (Pegar, de a tandas de hasta 500, con
    las de un mismo jugador y día juntas): cada tanda, toda o nada, con esos días del test
    bloqueados mientras se revisa y se guarda. Antes, Cargar guardaba de a una y Pegar seguía
    con las demás si una fallaba; sin la actualización de la base, siguen así. Una igual en todo a
    una que ya está: en Cargar no se guarda y avisa «… esa evaluación ya está en la Base»; en
    Pegar sigue «Ya está en la app». La Regla 1: la clave es el jugador (o la persona), el test y
    la fecha (no hay hora de inicio; en la base del club nunca hubo dos evaluaciones del mismo
    test, del mismo jugador, el mismo día). Si una nueva choca, no se guarda nada y la app
    pregunta: «Ir a la Base» o «Reemplazar y cargar», que borra las de esos jugadores esos días
    en ese test (quedan en el historial) y guarda las nuevas. Si mientras tanto otra persona cargó
    esos días, no se guarda, se vuelve a leer y dice «Mientras tanto cambiaron evaluaciones de
    esos jugadores en la Base.».
    - **Lo que espera:** queda mientras la app está abierta. La carga en espera vuelve con
      «Seguir la carga» o al tocar «Nueva evaluación»; lo pegado, con «Seguir con lo pegado» o
      al volver a «Pegar desde Excel». «Volver» desde lo pegado deja de esperar.
    - **Queda prohibido** que Evaluaciones guarde dos iguales en todo, que guarde una tanda por
      partes y que «Reemplazar» toque otro test u otro día, salvo un pedido nuevo.
  - **Hecho, paso 1a (20/10, 2026.10.20.6; UI-065): ver Lesiones y Evaluaciones sin señal.**
    Santiago, en un cuestionario: se activa «En cada base» (en Ajustes, «Ver Lesiones sin señal en
    este aparato») y GPS, «Una sola regla» (paso 1b). Si se activa (pregunta antes, porque son datos
    de los atletas en el aparato), la base guarda en el aparato (IndexedDB, por club, base y cuenta)
    lo que trajo con señal, un rato después de cada cambio. Sin señal abre con esa copia, para
    mirar (sin botones para cambiar), con el aviso «Sin señal: ves la copia de este aparato» y de
    cuándo es; cuando vuelve la señal, se ve lo de la base, al día. Sin activarlo, sin señal sigue
    el aviso de siempre y dice dónde activarlo. La copia se borra al desactivarlo, al salir de la
    cuenta, al dejar el club y al perder esa base. Quien ya se fue del club no la guarda; quien tiene
    la base en «Solo lectura», sí (es para mirar). No toca la base de datos.
    - **Queda prohibido** guardar la copia sin que se active en ese aparato, y cambiar datos desde
      la copia (eso es el paso 3), salvo un pedido nuevo.
    - **Cambio (21/10; UI-066):** Santiago: «Ese boton tiene que ir dentro de la base, no en
      ajustes». El botón «Ver sin señal en este aparato» pasó a la Base, al lado de «Pegar desde
      Excel»; Ajustes quedó como antes. Queda prohibido volver a ponerlo en Ajustes, salvo un
      pedido nuevo. (No llegó a publicarse: lo reemplazó el cambio de abajo.)
    - **Cambio (21/10, 2026.10.21.1; UI-067): la copia es automática, sin botón.** Santiago
      preguntó «para que hicimos ese boton?» y si podía ser automático «cuando se detecta que no
      hay señal». Claude explicó que sin señal ya no se puede bajar la copia (tiene que guardarse
      antes, con señal) y el riesgo de guardarla en todos los aparatos; en un cuestionario eligió
      «Automática en todos, sin botón». Reabre «Solo donde se active»: todo aparato donde se abre la
      base guarda la copia solo, con señal, y sin señal abre con ella. Se sigue borrando al salir
      de la cuenta, al dejar el club y al perder la base; quien ya se fue no la guarda. Riesgo
      aceptado: quedan datos de los atletas en todo aparato donde se abre la base, también uno
      compartido, hasta que se sale de la cuenta. Para GPS (paso 1b), «Una sola regla» pasa a ser
      la misma: automático, sin botón.
      - **Queda prohibido** volver a pedir que se active o agregar un botón para apagarla, salvo un
        pedido nuevo.
  - **Hecho, paso 1b (21/10, 2026.10.21.2; UI-067): ver GPS sin señal.** Igual que Lesiones y
    Evaluaciones: automático, sin botón. Las filas ya iban en su copia de siempre (copiaGps.js, para
    abrir rápido); ahora también lo del club (Datos básicos, Ajustes, reglas y V.R.) queda en la
    copia para ver sin señal. Sin señal, GPS abre con las dos, para mirar (Base, Informe y V.R.),
    con el aviso «Sin señal: ves la copia de este aparato» y de cuándo es, sin intentar traer nada
    de la base; al volver la señal, se pone al día. Mientras se ve la copia, la copia de las filas
    no se vuelve a guardar (así no cambia de cuándo es). Sin sesión que leer (sin señal), la cuenta
    del aparato es la última que entró, como en la puerta de entrada, para encontrar la copia.
  - **Paso 2, la fila de espera de cambios, por partes:** 2a Evaluaciones (que arma también lo que
    comparten las demás), 2b Lesiones, 2c GPS y 2d Datos básicos. Santiago, en un cuestionario
    (21/10), para «Si dos personas cambian la misma celda a la vez, ¿qué hace la app con la
    segunda?»: «Gana el último, con aviso» (entre esa, «Avisa y elegís», que Claude recomendaba,
    y «Gana el primero, con aviso»).
  - **Hecho, paso 2a (21/10, migración `20261114_evaluaciones_cambiar.sql`, 2026.10.21.3; UI-068):
    Evaluaciones.** Al cambiar una evaluación (en la tabla de la Base o en el formulario), la app
    manda solo las celdas que cambiaron, con lo que se veía en cada una, no la fila entera. La base
    las aplica de a una por fila (la fila queda bloqueada mientras se cambia), así que dos personas
    que cambian celdas distintas de la misma fila a la vez quedan las dos. Si las dos cambian la
    misma celda, gana el último (el que guarda después) y a ese le aparece «Otra persona había
    cambiado «Lumbar» mientras tanto: quedó lo tuyo.» (con el nombre de las columnas). Si otra
    persona la borró mientras tanto, no se cambia nada, la fila sale de la tabla y aparece «Esa
    evaluación la borró otra persona: queda borrada.». Los permisos son los de siempre (los de la
    base para esa cuenta). Sin la actualización de la base se guarda la fila entera, como antes.
    El aviso de abajo de las bases (Lesiones, Evaluaciones, GPS y Datos básicos) ahora usa el ancho
    de la pantalla cuando es largo; los cortos quedan igual.
    - **Límite conocido:** la otra persona no ve el cambio hasta que vuelve a abrir la base (ver
      los cambios de otros en el momento no está pedido). El aviso dice qué columna se pisó, no
      qué valor tenía.
    - **Queda prohibido** que un cambio de Evaluaciones mande la fila entera cuando la base tiene la
      función nueva, que vuelva a crear una fila que otra persona borró o que pise una celda sin
      avisar, salvo un pedido nuevo.
  - **Hecho, paso 2b (21/10, migración `20261115_lesiones_cambiar.sql`, 2026.10.21.4; UI-069):
    Lesiones.** Santiago, en un cuestionario: «Sí, seguí con Lesiones». Lo mismo que en Evaluaciones,
    en los tres lugares donde se cambia una lesión: la tabla de la Base (escribir o pegar en una
    celda), el formulario («Editar») y el alta médica. Se mandan solo las celdas cambiadas, con lo
    que se veía; celdas distintas de la misma lesión quedan las dos; en la misma celda gana el último
    y le aparece «Otra persona había cambiado «Médico» mientras tanto: quedó lo tuyo.» (en vez de
    «Lesión guardada», «Alta guardada» o «Fechas guardadas»); si otra persona la borró, la lesión
    sale de la Base (y se cierran su ficha, el formulario o el alta) y aparece «Esa lesión la borró
    otra persona: queda borrada.». Las reglas de la base siguen igual (fechas en orden, la misma
    lesión dos veces, jugador del club, consentimiento de las personas, «Solo lectura»). Sin la
    actualización de la base se guarda la lesión entera, como antes.
    - **Queda afuera:** cambiar la categoría de las lesiones desde Datos básicos (al cambiarle la
      categoría a un jugador) sigue guardando los datos enteros de cada lesión; va con el paso 2d.
    - **Queda prohibido** lo mismo que en el paso 2a, para Lesiones, salvo un pedido nuevo.
  - **Hecho, paso 2c (21/10, migración `20261116_gps_cambiar.sql`, 2026.10.21.5; UI-070): GPS.**
    Santiago, en un cuestionario: «Sí, seguí con GPS». Lo mismo que en Evaluaciones y Lesiones al
    cambiar una celda de la Base (escribir o pegar): se mandan solo las celdas cambiadas, celdas
    distintas de la misma fila quedan las dos, en la misma celda gana el último y le aparece «Otra
    persona había cambiado «D» mientras tanto: quedó lo tuyo.», y una fila que otra persona borró
    sale de la Base con «Esa fila la borró otra persona: queda borrada.». La diferencia: los «por
    minuto» (D/min = D ÷ los minutos de la fila) ya no los manda la app; los calcula la base al
    juntar, con lo que quedó en la fila. Si una persona cambia la D y otra el Tiempo a la vez, la
    D/min sale de las dos (antes, con la fila entera, se perdía el cambio de una de las dos). La regla de
    siempre sigue (Santiago, 10/10: «lo traído del Excel queda como está; lo que se cambia, se
    recalcula»): se recalcula el de la medida cambiada y, si cambió el Tiempo, todos los de la fila,
    con la misma cuenta y los mismos decimales que la app. Sin la actualización de la base se
    guarda la fila entera, como antes.
    - **Queda prohibido** lo mismo que en el paso 2a, para GPS, y que un «por minuto» quede con una
      cuenta que no sale de lo que quedó en la fila, salvo un pedido nuevo.
  - **Hecho, paso 2d (21/10, migración `20261117_jugadores_cambiar.sql`, 2026.10.21.6; UI-071):
    Datos básicos.** Santiago, en un cuestionario: «Sí, seguí con Datos básicos». Datos básicos ya
    guardaba solo las columnas cambiadas (dos personas que cambian columnas distintas del mismo
    jugador quedaban las dos); ahora cada cambio va con lo que se veía y, si otra persona había
    cambiado la misma columna, gana el último y le aparece «Otra persona había cambiado «Pie
    dominante» mientras tanto: quedó lo tuyo.»; si otra persona lo borró, sale de la lista con «Ese
    jugador lo borró otra persona: queda borrado.». Dos cambios seguidos del mismo jugador desde la
    misma pantalla no se avisan como de otra persona. Al cambiarle la categoría a un jugador, en
    sus lesiones y evaluaciones se cambia solo la categoría (la Selección, en Evaluaciones), con la
    que tenía: lo demás que otra persona haya cambiado en esa lesión o evaluación queda (antes se
    guardaban todos sus datos y se podía pisar); si otra persona había cambiado esa categoría
    mientras tanto, queda la nueva y aparece «Otra persona había cambiado la categoría de N
    registros mientras tanto: quedó la tuya.»; una que otra persona borró se saltea. Las reglas de
    siempre siguen (el nombre no se repite en el club, el nombre de antes queda para los partidos y
    los V.R., «Solo lectura»). Sin la actualización de la base se guarda como antes.
    - **Con esto queda hecho el paso 2** (Evaluaciones, Lesiones, GPS y Datos básicos). Sigue el
      paso 3, cargar, cambiar y borrar sin señal, que se confirma antes de empezar.
    - **Queda prohibido** lo mismo que en el paso 2a, para Datos básicos y la categoría de sus
      registros, salvo un pedido nuevo.
  - **Paso 3, cargar, cambiar y borrar sin señal, por partes** (Santiago, en un cuestionario:
    «Sí, empezá con Evaluaciones»): 3a Evaluaciones, después Lesiones, GPS y Datos básicos. Para
    todas, sus respuestas del 21/10: lo que espera, «Opcion 1 pero de otro color las filas» (un
    aviso arriba con cuántos cambios esperan y las filas de otro color); al volver la señal, «Lo
    sube sola y avisa»; si una nueva choca con otra que cargó otra persona, «Espera y te
    pregunta»; en Evaluaciones, sin señal también «Pegar desde Excel» y «Valores de referencia».
  - **Hecho, paso 3a (21/10, 2026.10.21.7; UI-072): Evaluaciones sin señal.** Sin señal (o si la
    señal se corta al guardar) se carga, se cambia, se borra, se pega desde Excel y se cambian los
    V.R. como con señal; los Ajustes, no. Lo hecho queda en una fila de espera en el aparato (por
    club, base y cuenta; `domain/filaDeEspera.js` y `domain/evaluaciones/espera.js`) y se ve al
    toque, con el aviso dorado y las filas en dorado claro. Al volver la señal sube solo, en
    orden, con las funciones del paso 2 (lo que pisó y lo que otra persona borró se avisa como en
    UI-068) y avisa cuántos cambios subieron; con señal a medias lo reintenta cada medio minuto, y
    con señal se puede tocar «Subir ahora». Una nueva que choca (Regla 1) espera y pregunta con
    la hoja de siempre: «Ir a la Base» o «Reemplazar y cargar». Sin SQL nuevo.
    - **Lo que espera es trabajo de quien lo cargó:** como los partidos pendientes
      (`copiasLocales.js`), no se borra al salir de la cuenta ni al dejar el club; sube cuando
      esa cuenta vuelve a abrir Evaluaciones con señal. Si mientras tanto perdió el permiso, la
      base no lo deja subir: si todavía puede abrir Evaluaciones, la app avisa cuántos cambios no
      se pudieron subir y por qué.
    - **Límites conocidos:** (lo del consentimiento ya no aplica: se sacó el 23/10, UI-078)
      sin señal no se puede dejar confirmado el consentimiento de una
      persona que no está en Datos básicos: pegarla pide señal, como antes. El historial de los
      V.R. y «Volver» necesitan señal. Una nueva cargada sin señal, si se cambia mientras justo se
      está subiendo, puede volver a preguntar con la hoja de la Regla 1.
    - **Queda prohibido** que lo hecho sin señal se pierda sin avisar, que una nueva que choca
      suba sin preguntar, o cambiar los Ajustes sin señal, salvo un pedido nuevo.
  - **Hecho, paso 3b (21/10, 2026.10.21.8; UI-073): Lesiones sin señal.** Santiago, en
    cuestionarios: «Sí, seguí con Lesiones (Recomendado)», con las mismas respuestas del paso 3a;
    sin señal, «Cargar, cambiar y borrar», «Dar el alta» y «Pegar desde Excel». Sin señal (o si
    la señal se corta al guardar), Nueva lesión, Editar, el alta médica, las celdas de la Base y
    del historial, borrar y «Pegar desde una planilla» funcionan como con señal; los Ajustes, no.
    Lo hecho queda en la fila de espera del aparato (`domain/lesionesEspera.js`, con lo que
    comparte con Evaluaciones), con el aviso dorado, las filas en dorado claro y, en Nuevos
    casos, la tarjeta en dorado claro con «Espera para subir». Al volver la señal sube sola, en
    orden, y avisa. Sin SQL nuevo.
    - **La misma lesión:** si otra persona ya la cargó mientras tanto (mismo jugador o persona,
      parte del cuerpo, lado y fecha de inicio; la regla de la base), Santiago: «Si es la misma
      tiene que avisar y descartar» (le ofrecía «Juntar con la que ya está», que Claude
      recomendaba, «Quedarme con la de la Base» y «Reemplazar y cargar»). La tuya no sube y
      aparece «La lesión de {jugador} del {fecha} ya la había cargado otra persona: se descartó
      la tuya.».
    - **El N° de caso:** Santiago: «El Nº de caso se ordena por fecha de incio de lesiones» y,
      al preguntarle cómo, «Las nuevas, después del último» (no «Renumerar todo el club por
      fecha»). Una cargada sin señal no tiene N° hasta que sube; al subir, las nuevas toman los
      que siguen al último de la Base, de la fecha de inicio más vieja a la más nueva (las sin
      fecha, al final). Los N° que ya están no cambian. Un N° pegado del Excel queda si está
      libre; si otra persona lo usó mientras tanto, toma el que le toca por su fecha.
    - **Lo que espera es trabajo de quien lo cargó**, como en el paso 3a: no se borra al salir
      de la cuenta ni al dejar el club, y sube cuando esa cuenta vuelve a abrir Lesiones con
      señal.
    - **Límites conocidos:** (lo del consentimiento ya no aplica: se sacó el 23/10, UI-078)
      sin señal no se puede dejar confirmado el consentimiento de una
      persona que no está en Datos básicos (pegarla pide señal, como en el paso 3a). Los
      «Cambios» de la ficha necesitan señal; una cargada sin señal todavía no tiene. Si otra
      persona toma un N° justo mientras se sube, la lesión toma el que sigue aunque no quede en
      orden de fecha. Una lesión sin fecha de inicio igual a una que cargó otra persona no se
      reconoce como la misma (la base no la frena, como siempre).
    - **Queda prohibido** que lo hecho sin señal se pierda sin avisar, que la misma lesión quede
      dos veces, que al subir cambien N° de caso que ya están en la Base, o cambiar los Ajustes
      sin señal, salvo un pedido nuevo.
  - **Paso 3c, GPS, por partes** (Santiago, en cuestionarios del 23/10: «Sí, seguí con GPS
    (Recomendado)»; sin señal se puede «Cambiar y borrar en la Base», «Cargar un día», «Pegar
    desde una planilla» y «Valores de referencia»; «Dejar para revisar» sin señal, «Queda en el
    aparato (Recomendado)»: se sigue en ese aparato y al volver la señal se sube y aparece en los
    otros). Lo que se le dijo al elegir «Cargar un día» y «Pegar desde una planilla»: sin señal no
    se lee el partido del día (el «Vs» va a mano); al subir, si choca (Regla 1) espera y pregunta,
    y si otra persona cargó lo mismo, se descarta y avisa. Claude propuso hacerlo por partes, cada
    una con su PR y su confirmación: 3c.1 cambiar y borrar en la Base; 3c.2 Cargar un día (con
    «Dejar para revisar»); 3c.3 Pegar desde una planilla; 3c.4 los V.R.
  - **Hecho, paso 3c.1 (23/10, 2026.10.23.1; UI-074): GPS › Base sin señal.** Cambiar celdas
    (escribir o pegar) y borrar filas funciona sin señal (o si la señal se corta al guardar).
    Lo hecho queda en la fila de espera del aparato (`domain/gps/espera.js`), con el aviso dorado
    y las filas en dorado claro; el «por minuto» de lo cambiado se recalcula en el aparato. Al
    volver la señal sube sola, en orden (los borrados seguidos, juntos), y avisa; la Base queda con
    lo que devolvió la base y después se pone al día. Las filas de la pantalla siguen siendo las de
    la base (y su copia del aparato): lo que espera va encima, así la copia y la puesta al día no
    cambian. Los Ajustes, solo con señal. Sin SQL nuevo.
    - **Lo que espera es trabajo de quien lo cargó**, como en los pasos 3a y 3b.
    - **Queda para las partes que siguen:** Cargar un día, Pegar desde una planilla y los V.R.
      siguen sin señal como antes (para mirar).
  - **Hecho, paso 3c.2a (23/10, migración `20261118_gps_en_curso_varias.sql`, 2026.10.23.2;
    UI-075): varias cargas sin terminar el mismo día.** Santiago: «Sí, seguí con Cargar un día
    (Recomendado)». Al preguntarle qué pasa con un día dejado «para revisar» sin señal cuando ese
    día ya tiene otra carga sin terminar (Claude ofrecía «Espera y te pregunta», «Gana la última,
    con aviso» y «Queda solo en este aparato»), escribió «Deja que hayas mas de una por dia, pero
    si cumple con las reglas de validacion avisa y lo descarta»; «la misma», «Mismo CSV
    (Recomendado)»; y «Con y sin señal (Recomendado)». Claude lo separó en dos: esta parte (la
    regla, con señal y en la base) y la 3c.2b (Cargar un día sin señal). Un día puede tener
    varias cargas sin terminar; la del mismo CSV (alguna fila con las mismas distancias, tiempo y
    hora de inicio) se frena en el paso del CSV con «Ese CSV ya está en una carga sin terminar
    del …» y no deja seguir ni dejar otra. Al guardar en la Base, las otras del día ya no frenan.
    En la base sale la regla de una por día (la del mismo CSV la frena la app: el CSV va adentro
    de lo hecho).
    - **Límite conocido:** dos personas que dejan el mismo CSV para revisar al mismo tiempo,
      desde dos aparatos, pueden dejar las dos (la base no mira el CSV); al seguir una, la otra
      sigue en «Sin terminar» y se puede borrar.
    - **Queda prohibido** volver a una sola carga sin terminar por día o dejar seguir con un CSV
      que ya está en otra, salvo un pedido nuevo.
  - **Hecho, paso 3c.2b (23/10, 2026.10.23.3; UI-076): GPS › Cargar un día sin señal.**
    Santiago: «Sí, seguí (Recomendado)» a «Sin señal: el «Vs» va a mano, «Dejar para revisar»
    queda en el aparato, y al volver la señal se sube con estas reglas». Sin señal (o si se corta
    al guardar o al dejar), «Cargar un día» funciona con los mismos pasos: el «ya está», el
    «mismo CSV» y la Regla 1 se revisan con lo que tiene este aparato; Partido no se mira (el «Vs»
    va a mano); «Guardar» deja el día en la fila de espera (`domain/gps/espera.js`, en la Base en
    dorado claro, se cambia y se borra ahí); «Dejar para revisar» lo deja en este aparato (en
    «Sin terminar», con su pastilla, y se sigue sin señal). Al volver la señal se sube solo: el
    día con `gps_guardar_dia` (la base vuelve a mirar el CSV y la Regla 1) y lo dejado a «Sin
    terminar». Si otra persona ya cargó el mismo CSV, se descarta y avisa; si es la misma sesión
    con otros datos, espera y pregunta («Reemplazar y cargar» o «Ir a la Base»). Lo dejado sin
    señal cuyo CSV ya está en la Base o en otra carga sin terminar, o que siguieron desde otro
    aparato, se descarta y avisa. Sin SQL nuevo.
    - **Límites conocidos:** sin señal no se guardan personas que no están en Datos básicos
      (su consentimiento se confirma con señal): se deja para revisar (ya no: el consentimiento
      se sacó el 23/10, UI-078). Lo dejado sin señal es de
      este aparato y de esta cuenta hasta que sube (no se ve en otros aparatos). Mientras se
      sube, lo cargado sin señal no se cambia ni se borra («probá en un momento»). Si la señal se
      corta justo después de que la base guardó el día, al subir se ve como «ya lo había cargado
      otra persona» y se descarta (el día ya está en la Base).
    - **Queda para las partes que siguen:** Pegar desde una planilla (3c.3) y los V.R. (3c.4)
      siguen sin señal como antes (para mirar).
  - **Hecho, paso 3c.3 (23/10, 2026.10.23.4; UI-077): GPS › Pegar desde una planilla sin
    señal.** Santiago: «Sí, seguí (Recomendado)» a «lo pegado queda en el aparato y se ve en
    dorado en la Base. Al volver la señal se sube solo; si choca con otra persona (Regla 1),
    espera y te pregunta, y si otra persona ya cargó lo mismo, se descarta y avisa». Sin señal
    (o si se corta al cargar), lo que ya está y la Regla 1 se miran con lo de este aparato y lo
    pegado queda en la fila de espera (`domain/gps/espera.js`; en la Base en dorado claro, se
    cambia y se borra ahí). Al volver la señal sube solo con `gps_pegar_filas`: antes, la Regla 1
    con lo que hay ahora (`planDeLoPegado` y `diasDeLaMismaSesion`); los días que chocan esperan
    y se pregunta («Reemplazar y cargar» o «Ir a la Base»), los demás suben; lo que ya está igual
    no se carga de nuevo y se avisa. Volver a subir lo mismo no lo carga dos veces (la base deja
    afuera lo que ya está igual): si la señal se corta a mitad de camino, lo pegado queda entero
    y al volver sube lo que falta. Sin SQL nuevo.
    - **Límites conocidos:** sin señal no se cargan personas que no están en Datos básicos (su
      consentimiento se confirma con señal; ya no: el consentimiento se sacó el 23/10, UI-078). Si la señal se corta después de que subió una
      parte, al volver esa parte se cuenta como «ya estaba en la Base». Lo pegado sin señal es de
      este aparato y de esta cuenta hasta que sube.
    - **Visto al hacerlo (aparte, sin cambiar):** con señal, «Pegar desde una planilla» no pide
      el consentimiento de las personas que no están en Datos básicos (Cargar un día sí); la base
      frena las que no están confirmadas («consentimiento.error.persona»). Ya no aplica: el
      consentimiento se sacó el 23/10 (UI-078).
    - **Queda para la parte que sigue:** los V.R. (3c.4) siguen sin señal como antes (para
      mirar).
    - **Queda prohibido** que lo hecho sin señal se pierda sin avisar o cambiar los Ajustes sin
      señal, salvo un pedido nuevo.
  - **Hecho, paso 3c.4 (23/10, 2026.10.23.6; UI-079): GPS › Valores de referencia sin señal.**
    Santiago, en un cuestionario: «Números y "de partido" (Recomendado)» (cambiar números
    —promedio, desvío y categorías— y marcar cuál es el V.R. de partido; si otra persona cambió
    el mismo número, gana el último y avisa; agregar, renombrar, borrar y la planilla, con
    señal). Sin señal (o si se corta al guardar), un número se cambia con dos toques y «Usar de
    partido» funciona: queda en la fila de espera (`domain/gps/espera.js`: `{ tipo: "vr" }` y
    `{ tipo: "dePartido" }`), en dorado claro en la tabla (con la leyenda) y con la pastilla
    «Espera para subir» el de partido que cambió. Lo que se ve con lo que espera encima también
    lo usan la Base, el Informe y Cargar. Al volver la señal sube solo: se leen los V.R. de la
    base una vez; si otra persona había cambiado el mismo número (o el de partido), queda el de
    este aparato y se avisa; si borró el V.R., no sube y se avisa; lo que ya está así no se
    cambia. Sin SQL nuevo (`gps_referencia_cambiar` y `gps_referencia_de_partido`, como con
    señal). Agregar, cambiar el nombre, borrar, recalcular y volver atrás, solo con señal.
    - **Arreglado al hacerlo:** lo que «Cargar un día» y «Pegar desde una planilla» dejan en el
      aparato sin señal podía no guardarse en él si se hacía antes de que la app leyera la
      cuenta del aparato (se guardaba con la de un momento antes, vacía); ahora se guarda con la
      de ahora. Las pruebas de GPS guardan como la de verdad (sin cuenta, nada).
    - **Límites conocidos:** lo hecho sin señal es de este aparato y de esta cuenta hasta que
      sube. Gana el último aunque el otro cambio sea más nuevo (lo de este aparato sube después):
      se avisa y se puede volver atrás en «Últimos cambios».
    - **Queda prohibido** que lo hecho sin señal se pierda sin avisar, o agregar, renombrar,
      borrar o recalcular V.R. sin señal, salvo un pedido nuevo.
    - **Lo que sigue de la nota:** Datos básicos sin señal (la última parte del paso 3) y después
      el paso 4 (Partido compartido entre celulares; Entrenamiento, al final), cada uno
      confirmado en un cuestionario antes de empezar.
  - **Hecho, paso 3d (23/10, 2026.10.23.7; UI-080): Datos básicos sin señal, solo para mirar.**
    Santiago, en un cuestionario: lo de los V.R. de GPS «Sí, está bien» y, para Datos básicos,
    «Solo mirar» (entre «Ver y cambiar datos» y «Todo, también agregar y borrar»). Como el paso
    1 en las otras bases: con señal, lo que se ve (los jugadores con sus datos, los nombres de
    las columnas y las listas) queda en la copia de este aparato (`copiaSinSenal.js`, base
    «datos»); sin señal se abre con ella y el aviso de siempre, y no se cambia nada (ni la tabla,
    ni Posiciones, ni Ajustes; sin agregar, pegar, borrar ni la ficha). Sin copia, «No hay
    conexión» y tampoco se cambia nada. Al volver la señal, lo de la base. La copia no se guarda
    con lo que no llegó (el plantel de respaldo, que trae solo los nombres). Se borra como las
    otras y, además, cuando la cuenta se queda sin ningún módulo del club. Sin SQL nuevo.
    - **Con esto queda hecho el paso 3** (Evaluaciones, Lesiones, GPS y Datos básicos).
    - **Límite conocido:** si se corta la señal con la pantalla abierta, se sigue viendo lo
      último que llegó (con «No hay conexión»); la copia se usa al abrirla sin señal.
    - **Queda prohibido** cambiar, agregar o borrar en Datos básicos sin señal, salvo un pedido
      nuevo.
    - **Lo que sigue de la nota:** el paso 4 (Partido compartido entre celulares; Entrenamiento,
      al final), confirmado en un cuestionario antes de empezar.
  - **Paso 4, Partido compartido entre celulares, por partes (23/10; UI-081).** Santiago, en
    cuestionarios: Datos básicos sin señal «Sí, está bien» y «Sí, empezá con Partido»; cómo:
    «Varios cargan a la vez»; el mismo dato con otro valor, «Gana el último y avisa»; sin señal,
    «Sigue y se junta al volver»; «Sí, en 3 partes»; sumarse con un «Aviso con «Sumarme»»; al
    Historial (y al Excel) «No, al guardar, como hoy»; «Limpiar», «Solo en este celular». Claude
    relevó cómo guarda Partido: el partido en curso vive en un solo celular y «Guardar partido»
    lo sube entero (el último pisa entero al otro); los cambios van en lugares fijos (cambio 1,
    2…), así que dos celulares que anotan un cambio a la vez irían al mismo lugar. Partes: 4a la
    base, dato por dato; 4b sumarse y ver en vivo; 4c sin señal, se junta al volver.
  - **Hecho, paso 4a (23/10, migración `20261120_partido_en_curso.sql`, 2026.10.23.8): el
    partido en curso, en la base, dato por dato.** La tabla `partidos_en_curso` (aparte de
    `registros_partido`: el Historial y el Excel no la ven) guarda el partido que se está cargando
    desarmado en datos sueltos (`src/domain/partidoEnCurso.js`): los cambios, cada uno por su id
    (con su lugar como un dato más); los VAR, por su lugar; lo de este celular y de cómo se ve
    (su número, la fila del Historial, el VAR que se mira), no. `partido_en_curso_cambiar` sube
    solo lo que cambió, con lo que se veía: si otra persona cambió el mismo dato mientras tanto,
    gana el último y la base lo dice (pisadas). Lo ve quien tiene Partido en el club; lo carga y
    lo cambia quien lo tiene con Edición. En la app, un rato después de cada cambio se sube lo
    que cambió (la primera vez, todo); sin señal o si falla, queda para el próximo cambio o para
    cuando vuelva la señal; «Guardar partido» anota en él la fila del Historial; «Limpiar» empieza
    otro y deja el de antes. Sin la actualización de la base, Partido sigue como antes. A la
    vista no cambia nada. Cada cambio tiene ahora su id (los de antes lo reciben al abrir).
    - **Límites conocidos (para 4b y 4c):** todavía nadie lee el partido en curso: se suma y se
      ve en vivo en 4b. Al volver a abrir la app, la primera subida manda todo sin lo que se veía
      (no avisa pisadas) y no saca de la base lo que se borró mientras no subía. Falta decidir
      hasta cuándo se ofrece un partido en curso para sumarse (se pregunta en 4b).
    - **Queda prohibido** lo de UI-081, salvo un pedido nuevo.
  - **Hecho, paso 4b (23/10, migración `20261121_partido_en_curso_en_vivo.sql`, 2026.10.23.9):
    sumarse al partido en curso y verlo en vivo.** Santiago, en cuestionario: 4a «Sí, seguí con
    4b»; «Sumarme» se ofrece «Hasta guardarlo terminado» (si nadie lo guarda, deja de ofrecerse a
    las 6 horas sin cambios). `partidos_en_curso_del_club` trae los partidos en curso del club con
    algún cambio en las últimas 6 horas (lo ve quien tiene Partido en el club; anon, nada) y
    `partidos_en_curso` entra en Realtime. En la app:
    - Al abrir Partido, si hay uno en curso del club que no se guardó terminado, una tarjeta
      «EN VIVO» arriba de la carga del partido: «Hay un partido en curso: vs …», quién lo cambió
      por última vez y a qué hora, y «Sumarme». Si en ese celular ya hay otro partido cargado,
      pregunta antes («¿Dejar el partido de este celular?»).
    - Con «Sumarme», ese celular pasa a ese partido (con la formación y lo anotado). Lo que anota
      cada celular llega a los otros solo (y cada 20 segundos, por las dudas) y se junta con lo
      que ese celular todavía no subió. Si otra persona cambió el mismo dato mientras tanto, queda
      lo último y avisa cuál («Otra persona había cambiado Inicio ST mientras tanto: quedó lo
      tuyo.»). Una lectura vieja no pisa una nueva (versión).
    - En el partido queda lo último que se supo de la base: al volver a abrir la app ya no se
      manda todo de nuevo, y lo borrado mientras no subía se saca (resuelve el límite de 4a).
    - «Guardar partido» de un partido terminado (con el segundo tiempo terminado y, con
      prórroga, el segundo suplementario) lo marca guardado terminado: deja de ofrecerse.
      «Limpiar» avisa que en los otros celulares sigue. El Historial y el Excel, como hoy.
    - Sin la actualización de la base, Partido sigue como antes (sin tarjeta).
    - **Límites conocidos (para 4c):** sin señal, lo de cada celular queda para cuando vuelva,
      pero todavía no se probó ni se avisa con dos celulares sin señal a la vez (es 4c). Quien
      tiene Partido solo para mirar no ve la tarjeta (no se decidió que pueda mirarlo en vivo).
  - **Hecho, paso 4c (23/10, migración `20261122_partido_en_curso_celulares.sql`, 2026.10.23.10):
    sin señal, cada celular sigue y se junta al volver.** Santiago, en cuestionarios: 4b «Sí,
    seguí con 4c»; sin señal, «Aviso chico en el partido»; al volver, avisa «Solo si se pisó algo»;
    si otro celular guardó el partido terminado mientras uno no tenía señal, «No deja guardar hasta
    que todos los cambios se combinen» y, como un celular sin señal no puede avisar que tiene algo
    sin subir, «Espera, con «Guardar igual»». En la base, `partidos_en_curso_celulares` anota los
    celulares sumados a cada partido y cuándo se supo de cada uno (con la hora de la base);
    `partido_en_curso_celulares` dice que este sigue (o que se fue) y trae los del partido. Lo ve
    quien tiene Partido en el club; lo anota quien lo tiene con Edición; anon, nada. En la app:
    - Sin señal, debajo de «En vivo» del reloj: «Sin señal: lo que anotes se junta con los otros
      celulares cuando vuelva.» Solo si hay otros celulares en el partido; se va sola cuando lo de
      este celular sube.
    - Al volver, lo anotado se sube solo (también si el celular dice que hay red pero la base no
      contesta: se reintenta cada 20 segundos) y se junta; si otra persona cambió el mismo dato,
      el aviso de siempre («…quedó lo tuyo»). Arreglado: si se leía la base antes de subir, ese
      aviso no salía (ahora lo pendiente sigue con lo que se veía antes de cambiarlo).
    - Cada celular sumado le avisa a la base que sigue (cada 20 segundos). «Guardar partido», si
      otro celular sumado no se conecta hace más de un minuto (o este no tiene señal y hay otros),
      muestra «Falta juntar lo de otro celular» con quién falta y desde qué hora, y «Esperar» (no
      guarda) o «Guardar igual» (por si ese celular no vuelve). «Limpiar» o sumarse a otro saca a
      este celular de la lista.
    - Si un celular anota algo después de que otro guardó el partido terminado: «Este partido ya
      se guardó en otro celular: lo último que anotaste todavía no está en el Historial. Tocá
      «Guardar partido» para sumarlo.»
    - Arreglado también: un partido recién empezado en la base podía quedar repetido si se anotaba
      algo mientras subía por primera vez.
    - Sin la actualización de la base, como en 4b (sin lista de celulares: «Guardar partido» no
      espera).
    - **Límites conocidos:** un celular con la pantalla bloqueada o la app cerrada sin «Limpiar» se
      ve igual que uno sin señal: «Guardar partido» lo espera (para eso está «Guardar igual»). La
      hora de «desde las …» es la del celular que guarda, con lo que dice la base.
    - **Queda prohibido** lo de UI-081, salvo un pedido nuevo.
    - **Lo que sigue de la nota:** Entrenamiento («lo vemos al final»), confirmado en un
      cuestionario antes de empezar.
  - **Entrenamiento, para la nota de Flujo diario (23/10).** Santiago, en cuestionarios: 4c «Sí,
    seguí con Entrenamiento»; sobre cuánto hacer ahora en Entrenamiento (Flujo diario), sabiendo
    que después viene «revisar su lógica y moverlo a GPS»: «Dejarlo para esa nota», entre esa,
    «Lo justo para no perder datos» y «Como Partido, completo» (cómo se juntan dos celulares y el
    aviso antes de repetir un envío a OpenField quedaron sin respuesta: se preguntan en esa nota).
    Claude relevó cómo anda hoy: sin señal ya funciona (cada cambio queda en el celular y sube
    solo al volver); dos celulares en el mismo entrenamiento se pisan (se guarda entero y queda
    el del último); cada celular recuerda solo lo que envió él a OpenField, así que un envío
    desde otro celular puede repetir cortes. Queda como riesgo conocido hasta esa nota.
  - **Nota cerrada (23/10):** pasos 1 a 4 hechos; Entrenamiento pasa a la nota de Flujo diario.
- **Lo que sigue, en este orden**: borrar del todo a un atleta (derecho al olvido; descartado el
  23/10: «no vamos a hacer eso»); el cambio de
  nombre de un jugador con los partidos de antes (ver «Exportar los datos de un atleta», falla
  conocida; arreglada el 20/10); después, las grandes, cada una aparte (la planilla de valor
  referencial con carga por archivo y «Agregar V.R.» que lleve ahí con nombre libre; Flujo
  diario, revisar su lógica y moverlo a GPS (con Entrenamiento entre celulares: que no se pisen y
  el aviso antes de repetir un envío a OpenField, 23/10); cargar sin señal y a la vez que otra
  persona (cerrada el 23/10; Entrenamiento va con Flujo diario); Isocinecia con Python y VALD).

## Lo que dejó la revisión completa del 30/09

Se revisó toda la app (pruebas automáticas, recorrido en navegador de cada
pantalla y lectura módulo por módulo). Lo que se encontró roto se arregló en
cuatro tandas (versiones 2026.09.30.6 a .9). Esto es lo que quedó anotado sin
arreglar, de menor a mayor esfuerzo:

- **Botón de quitar pausa** en Tareas: 34 px de alto, chico para el dedo.
- **Cuentas, dos filas seguidas.** Si se toca una fila mientras la anterior
  todavía se está guardando, la segunda se habilita antes de tiempo y podría
  mandar el cambio dos veces. Raro, y sin daño real.
- **Ícono de Android "maskable".** Es el mismo dibujo que el ícono común, así
  que en los launchers redondos se recortan las esquinas y el borde dorado.
  Hace falta un ícono aparte con el logo más chico sobre fondo negro.
- **Bordes del iPhone (`viewport-fit=cover`).** La hoja de estilos ya
  contempla los bordes seguros, pero la etiqueta viewport no lo pide, así que
  las barras no llegan hasta el borde de la pantalla. Cambiarlo mueve el alto
  de las barras: probarlo en el teléfono antes de subirlo.
- ~~**La sesión de OpenField dura hasta 8 h como tope** (normalmente 75 min)~~:
  desde el 05/10 dura 10 minutos como mucho (ver "Revisión de privacidad del 05/10").
- **El envío de cortes puede pasar los 60 s de Vercel** en el peor caso (login
  en Catapult + dos lecturas + escritura). Si se corta después de escribir, la
  app no se entera; al reintentar ya no duplica los períodos (los reconoce por
  nombre y ventana), pero sigue siendo mejor acortar el presupuesto.
- **Tareas que cruzan la medianoche** no se contemplan (el fin tiene que ser
  posterior al inicio del mismo día).

## Chicas del filtro

- **Los nombres del filtro de jugador.** Siguen siendo "Titular", "Ingresó",
  "No ingresó" y "Minutos jugados", con los comparadores "Más de", "Al menos",
  "Menos de", "Como mucho" y "Entre". En su momento quedó pedido cambiarlos,
  pero nunca se dijo cuáles molestan ni cómo tendrían que decir. Los del filtro
  de equipo sí se revisaron.

- **Local / visitante / neutral dentro del filtro.** Es el único criterio que
  quedó como tres botones lado a lado en vez de subir la hoja, porque son tres
  opciones y así se eligen de un toque. Quedó pendiente confirmar si va así o si
  tiene que ser una hoja como el resto.

## Limitaciones conocidas, que no son deudas

- La **foto al día de salida** de filas viejas (las versiones se guardan desde
  `20261005_foto_al_dia.sql`; antes no había de dónde sacarlas):
  - partidos y jugadores editados antes de la migración aparecen como están hoy;
  - un entrenamiento editado antes de la migración aparece recién desde ese cambio: a
    quien se fue antes no le aparece (mejor eso que mostrarle lo de después).
- Para quien se fue, las cabeceras y listas de Lesiones y el nombre del club se ven como
  están hoy (son la configuración del club, no datos).
- Mientras se mira un club del que ya se fue, Flujo diario no sube nada pendiente, ni
  siquiera de otro club: sube al volver a un club donde sigue.

- Un partido guardado **sin formación cargada** no puede decir quién fue titular.
  En la vista de jugador aparece solo si el nombre figura en algún cambio. No es
  algo que se pueda arreglar: no está guardado.

- Los minutos de la vista de jugador van **en bruto** (reloj corrido), igual que
  como abre la ficha. Si alguna vez se quieren en neto —descontando VAR e
  hidratación— el dato ya se calcula, solo falta decidir cómo se elige.

- Con los **penales a la vista**, en pantallas de 320 px el nombre del equipo se
  recorta en el marcador. Ya se recortaba antes de que existieran los penales: a
  ese ancho no entra "Atlético Mineiro" entero.

- El **icono de la app** lo cachea el sistema, no el service worker. Cambiarlo en
  el repo no alcanza para que cambie en un teléfono donde la app ya está
  instalada: hay que desinstalarla y volver a agregarla a la pantalla de inicio.
