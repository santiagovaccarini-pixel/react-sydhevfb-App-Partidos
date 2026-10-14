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

## Entrenamiento (OpenField)

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
  solo para quien tiene Flujo diario, porque busca los chalecos con esa cuenta).
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
  12/10; falta que Santiago confirme si se pasan todos juntos, en un cambio aparte): los
  formularios de Lesiones (Nuevos casos) y de Evaluaciones (Cargar), que ponen en botones las
  listas de hasta 6 opciones; Mostrar / Oculta en Ajustes de Lesiones, Evaluaciones y GPS; el
  tipo de una columna nueva del GPS; los períodos de Lesiones › Reportes y de Lesiones c/1000 h;
  Frente / Espalda y las capas del mapa corporal; y el orden en el filtro de cada columna de las
  bases.
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
  entrenando, alta) salen de esas fechas; "activa" = sin alta.
- Reportes (`REGLAS_INCIDENCIA` en `src/domain/reportes.js`, copiadas de las fórmulas del
  Excel): el cuadro cada 1000 horas cuenta las lesiones no traumáticas (Datos Básicos P8)
  de partidos oficiales, amistosos y entrenamientos (R7:R9) del profesional (S7); "sin
  leves" saca solo la severidad leve (T8: las de registro quedan); LM son los grados 1A a
  3C y la sobrecarga muscular / calambre. La regla vale también para las LM: una LM
  traumática o de selección no entra (05/10: Santiago pidió dejarlo como el Excel y "solo
  aclarar cuáles van"). La nota de cada cuadro dice cuáles cuentan y cuáles son las LM, con
  los textos del club. Con los datos del Excel la app da lo mismo que "Incidencias c 1000h" fila 109;
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

- **El cuerpo humano para cargar la lesión (hecho el 02/10, rehecho el 02/10)**: en
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
- **Músculos, tendones y ligamentos en la figura (02/10)**: en Descripción específica la
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
  arriba, verde abajo); al lado, el "Mapa corporal de lesiones": la figura de cargar una
  lesión, de frente y de espaldas, como una escultura gris con relieve (dos imágenes WebP
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
- Para decidir cuando se hagan los informes: la categoría de una lesión hoy se muestra con
  la categoría actual del jugador (el código quería guardar la del día de la lesión, pero esa
  columna no se guarda porque cuenta como calculada); y "Imágenes" se carga como texto libre
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
    pedido), no con `puede_usar_en(equipo_id, …)` fila por fila. Ver «GPS (10/10)», Muchas filas.
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
    las filas (en el Excel AA2 tenía otra).
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
  los tiempos en la unidad del Excel). La app solo los lee. La columna "Pro" del resumen va
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
  "Valores de referencia" (solo lectura, cargados por SQL).
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
    «Quinta pantalla aparte»), solo para mirar.
  - **Ajustes**, como Lesiones › Ajustes: Cabeceras (por test, el nombre de cada columna y
    de cada bloque en cada idioma, y esconder columnas de la Base, la carga y los reportes;
    Fecha, Jugador y Selección no se esconden: sin ellas no hay de quién, de cuándo ni
    contra qué V.R.) y Listas (Selección y las que traiga cada test: renombrar, esconder y
    agregar opciones; lo cargado no se pierde). Una categoría que suma el club no tiene V.R.
    hasta que se carguen: sus clases quedan vacías. El selector del informe dice «Vs» y el
    nombre del club si lo cambió. Pegar desde Excel también reconoce los nombres del club.
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
3. **Reportes**.
4. **V.R. por dispositivo**: se arman una vez con reglas estadísticas y quedan fijos (Santiago,
   10/10: «Los VR se arman una ves con reglas estadisticas y se dejan fijos»; las reglas las
   explica él más adelante). Cada dispositivo tiene los suyos («Exacto»). No inventar reglas ni
   valores mientras tanto; los valores, como en Evaluaciones, por SQL en el chat.
5. **OpenField directo**: probar en la actividad 26-05 T, sin inventar direcciones de la API.
   Nota de Santiago (10/10): ver si desde la API se puede descargar el CSV; «hay varias maneras
   de descargarlo xq se puede descargar con variables de otra persona o todas las variables».

Como pide la regla de las bases (UI-012), cuando estén los pasos 2 y 3 la barra queda Cargar ·
Base · Reportes · Ajustes (y los V.R. donde se decida en el paso 4). Desde el 12/10: Cargar ·
Base · Ajustes, y abre en Cargar (como Evaluaciones).

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
  orden de su lista.
- Colores (D19:X30002 del Excel: de D a Tiempo): mayor que Excelente, verde oscuro; de Muy Bueno
  a Excelente, verde claro; de Promedio a Muy Bueno, amarillo; de Regular a Promedio, naranja;
  menos que Regular, rojo. En Nombre, el Team Average de una tarea va en amarillo, el de un
  tiempo de un Partido Oficial Torneo en gris y el de la sesión en rojo claro. Solo el fondo,
  como el Excel (sin negrita).
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
  los de la plantilla, uno solo para el club); la marca fija de la selección
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
    mirar. Al guardar en la Base, deja de estar sin terminar.
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
- ¿Los V.R. de partido van por dispositivo (paso 4)? Hoy hay uno solo por club, como la
  plantilla.
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
  - Mientras los otros módulos no tengan su turno, su botón de avanzar sigue diciendo
    «Siguiente» (sin a dónde va) y no tienen «Cómo se usa».
  - **Falta (se preguntó el 14/10)**: qué quiere decir cada opción de «Día del microciclo» (0,
    1, +1, -1…); sin eso no lleva «?» (no se inventa).
  - **Falta**: lo técnico de un aviso de base (qué actualización falta) iba a ir en «Pruebas
    técnicas»; hoy esa pantalla es de Flujo diario y no revisa la base, así que no está. Mientras
    tanto, Claude pasa el SQL por el chat, como siempre.
- Las otras 9, sin decidir todavía (se ven una por una, en este orden): cambiar un nombre o
  una opción y que cambie en todos lados (las filas guardadas con un nombre
  que no está en Datos básicos y los nombres de Partido); el
  permiso una vez por pedido también en Lesiones y Evaluaciones (no está hecho: solo GPS);
  el reporte individual de Lesiones (sin los puntos «Superior/Inferior a la referencia», el
  color en el %, tarjetas más chicas y «qué cuenta» en corto); sacar los botones «Entrar» de
  las tarjetas (reabre UI-007); editar y borrar los Valores de referencia (con la lógica de la
  planilla de valor referencial); arriba de la Base de GPS solo el promedio por dispositivo, los
  V.R. de GPS y el % vs V.R. de partido; revisar la lógica de Flujo diario; Isocinecia con el
  lector de Python y conectar con VALD; mejorar el cuerpo humano del reporte de Lesiones.

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
