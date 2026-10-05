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
  desde la app, verla en Por autorizar, autorizarla con un solo módulo, entrar
  con ella y confirmar que ve solo ese módulo; después quitarle el acceso).
  Lo demás quedó hecho el 30/09: un solo login antes del portal, permisos por
  cuenta (Partido, Flujo diario, administrador), pantalla Cuentas para
  autorizar, y las tablas de Partido y de Flujo diario cerradas a cuentas
  autorizadas (etapa 3 aplicada y probada en producción, con y sin señal). Lo
  que hay que tener configurado en Supabase está en el README.
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
  Lesiones y Datos básicos enteros. **Partido y Flujo diario siguen en castellano** aunque se
  elija portugués: funcionan igual, solo falta pasar sus textos al diccionario (mucho texto;
  va de a pantallas). Regla: texto nuevo = clave nueva en los dos archivos (la prueba lo exige).
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
  sin edición) leyendo `v_mis_clubes`. El administrador lo maneja desde Cuentas (sumar, dar
  de baja con el último día, reincorporar); una cuenta recién autorizada queda en el club con
  el que se está trabajando; quien crea un club queda adentro. Las cuentas autorizadas de hoy
  quedan en todos los clubes al correr la migración. Límite conocido: un cambio hecho después
  de la salida sobre una lesión anterior (el alta, por ejemplo) se ve igual, porque la fila es
  de antes.
- El idioma se cambia desde el globo arriba a la derecha (puerta, portal, Cuentas, Lesiones y
  Datos básicos). Partido y Flujo diario no lo muestran todavía porque siguen en castellano.
- El permiso `lesiones` de perfiles lo habilita el administrador desde Cuentas; las cuentas
  admin lo tienen prendido desde la migración.

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
  3C y la sobrecarga muscular / calambre.
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
  fijo como el número de fila de la base, y lleva la fila de los grupos con los mismos tonos que
  la base. En pantalla entran enteras desde una compu de 1366 px; más chica, se deslizan.
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
- Permiso: lo abre la columna `lesiones` de la membresía (`club_miembros`), que en Cuentas ahora
  se lee "Bases de Datos" y abre todas las bases. Si alguna base no la tiene que ver todo el que
  entra (por ejemplo, el detalle médico), lleva su propio permiso, y hoy la lista de módulos está
  escrita en varios lugares que hay que tocar juntos (o mejor, sacarlos de una sola lista):
  - la base: columna nueva en `club_miembros` y en `club_invitaciones`, las vistas `v_mis_clubes`
    y `v_miembros_club`, y los `case` de `puede_usar_en` y `puede_usar` (migración nueva);
  - `MODULOS_DEL_CLUB`, `COLUMNAS_MEMBRESIA`, `normalizarMiembro` e `invitar` en
    `src/domain/membresiasDb.js`, e `INVITACION_INICIAL` en `src/CuentasAdmin.jsx`;
  - `membresiaDe` en `src/domain/equipo.js` (lo que se guarda del club en el celular) y
    `permisosEnClub` en `src/domain/perfilesDb.js` (lo que puede cada uno en el club);
  - la lista que compara el club al volver a las tarjetas, en `src/PortalApp.jsx`;
  - los textos `cuentas.modulos.<permiso>` en los dos idiomas, y la base lo pide en `permiso`.
- Fotos: la foto que tenía la tarjeta Lesiones (los servidores dorados) ahora es la de Bases de
  Datos (`public/portal/bases.webp` y `bases-parada.webp`). Lesiones va con un dibujo (la figura
  del cuerpo en dorado) hasta que haya una foto para ella: se pone en `foto`/`fotoParada` de su
  entrada en `BASES` y en la lista de `scripts/precache.js`.
- Datos básicos sigue en la pantalla principal: lo ve cualquiera con algún módulo (Partido y
  Flujo diario también usan los jugadores), y adentro de Bases de Datos lo verían solo los que
  tienen ese permiso. Si se quiere adentro, hay que decidir quién lo ve.

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

Cómo está hoy (02/10):
- Con invitación funciona casi así: el admin invita por correo y copia un mensaje con el
  enlace a la app; la persona crea la cuenta con ese correo, lo confirma y entra sola al
  club con los permisos elegidos (si ya tenía cuenta, entra en el acto). Falta que el
  enlace abra "Crear cuenta" con el correo escrito y fijo: hoy lleva a la entrada común y,
  si escribe otro correo, queda pendiente.
- Sin invitación es distinto: la cuenta queda pendiente sin elegir club y la aprueba el
  dueño de la plataforma desde "Cuentas de la app" (sumándola a un club). El admin del
  club no la ve. "Rechazar" bloquea la cuenta entera y la deja en "Sin acceso".

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
- **La sesión de OpenField dura hasta 8 h como tope** (normalmente 75 min):
  bloquear una cuenta tarda eso en aplicarse a las pantallas de lectura de
  Flujo diario. Enviar cortes sí se comprueba en el momento.
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
