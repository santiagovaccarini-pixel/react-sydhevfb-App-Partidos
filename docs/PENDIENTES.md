# Pendientes

Lo que quedó pedido y todavía no está hecho. El orden es de más a menos valor,
no el orden en que se pidió. Lo que se va haciendo se borra de acá: el historial
de lo hecho está en los commits, no en esta lista.

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
  valores de referencia). El bloque
  "Plan Agudo" del Excel está marcado "no usar" y no se trajo.
- Lo que se suma al catálogo (`lesionesCampos.js`) llega solo a los clubes ya sembrados:
  `leerConfig` completa las cabeceras y opciones que falten sin pisar lo que el club cambió.
- La hoja de opciones (`HojaOpciones`) se desplaza y, con más de ocho opciones, tiene un
  buscador que acerca lo escrito.
- Regla de oro del 01/10: lo que es igual en otro módulo tiene que ser igual en toda la web
  (escudos descargados con `EscudoDeClub`, el filtro de Registros, fichas con "Ver detalle",
  Ajustes con filas y "Volver a Ajustes").
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
  y `manchasCuerpo.js`); abajo, el historial con doce columnas todas a la vista (en el
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
  en el plantel). Mientras tanto los cuadros muestran "—" y avisan que faltan los minutos.
  **Horas previas (03/10, migración `20261007_horas_previas.sql`)**: la columna A de "Datos
  Básicos" del Excel (sin título, en [h]:mm:ss) son las horas de entrenamiento de antes de
  que llegara el cuerpo técnico al Mineiro. Están en Datos básicos ("Horas previas", se
  escriben o se pegan como en el Excel: 30:14:20) y el reporte individual las suma a las
  horas del GPS del jugador (al VR no, como en el Excel). En el Excel la fórmula las suma a
  los minutos sin pasarlas a minutos, así que casi no cuentan (30 horas valen 1 minuto);
  en la app cuentan como horas. Santiago, 03/10: "por ahora dejalo".
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
  Evaluaciones, la columna `evaluaciones`, desde el 05/10) y la tarjeta Bases de Datos de la
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
  - `MODULOS_DEL_CLUB`, `COLUMNAS_MEMBRESIA`, `normalizarMiembro`, `listarInvitaciones` e
    `invitar` en `src/domain/membresiasDb.js`, e `INVITACION_INICIAL` en `src/CuentasAdmin.jsx`;
  - `membresiaDe` en `src/domain/equipo.js` (lo que se guarda del club en el celular) y
    `permisosDePerfil` y `permisosEnClub` en `src/domain/perfilesDb.js` (lo que puede cada uno
    en el club, y `datos`: Datos básicos va con cualquier módulo);
  - la lista que compara el club al volver a las tarjetas, en `src/PortalApp.jsx`;
  - los textos `cuentas.modulos.<permiso>` en los dos idiomas, y la base lo pide en `permiso`;
  - los escenarios de `supabase/pruebas/escenarios.sql` (con y sin el permiso, invitación,
    quien se fue).
- Fotos: la foto que tenía la tarjeta Lesiones (los servidores dorados) ahora es la de Bases de
  Datos (`public/portal/bases.webp` y `bases-parada.webp`). Lesiones tiene sus fotos desde el
  05/10 (`public/portal/lesiones.webp` y `lesiones-parada.webp`, las mandó Santiago); el dibujo
  de la figura del cuerpo en dorado queda por si no cargan. La foto de una base nueva va en
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
- Los que siguen, un PR cada uno, preguntando antes los errores que tenga cada hoja:
  Funcional, Iso Aductor-Abductor, Sentadilla Incremental, Press Plano y Saltos. El motor suma lo que usen (detener si es verdad, SUBTOTAL 3, BUSCARX, COINCIDIR,
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
