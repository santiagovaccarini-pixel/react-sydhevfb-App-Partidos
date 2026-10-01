# Pendientes

Lo que quedó pedido y todavía no está hecho. El orden es de más a menos valor,
no el orden en que se pidió. Lo que se va haciendo se borra de acá: el historial
de lo hecho está en los commits, no en esta lista.

## Entrenamiento (OpenField)

### Interfaz (hecha el 21/09; queda lo fino)

- Entrenamiento ya tiene la cara de Partido: inicio con la sesión elegida,
  Tareas con tarjetas plegables y una pantalla aparte para enviar, Ajustes con
  opciones (Usuario y contraseña, Lista de jugadores, Pruebas técnicas,
  Cambiar de módulo, Cerrar sesión) y textos sin jerga ("chaleco", "bloque").
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
  y `lugarEnPantalla` en `src/PortalApp.jsx`; tiempos en `TIEMPOS_PORTADA`,
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
  `20261002_datos_basicos.sql`, **pendiente de correr en Supabase**: también agrega
  `jugadores.posicion` y `jugadores.foto_url`).
- La carga de una lesión va por pasos (quién, qué pasó, dónde, cómo y cuándo, evolución e
  imágenes, notas) con solo lo manual; lo calculado se muestra al final. Hay una pantalla
  **Base** estilo Excel (`src/components/TablaDatos.jsx`): cabeceras que se arrastran (en el
  celular, manteniendo apretado), celdas que se eligen, se copian y se pegan como texto con
  tabulaciones y se editan tocando dos veces. El orden de columnas queda en el celular.
- **Datos básicos** (`src/DatosBasicos.jsx`) es un módulo más del portal, para cualquiera con
  algún módulo: los jugadores del club (los mismos de Partido y Flujo diario) con nombre,
  categoría, nacimiento, edad, pie dominante, posición y foto, en la misma tabla.
- Del Excel quedan para más adelante: BD GPS (minutos para incidencia por 1000 h), la
  evaluación de lesiones (ROM y valores de referencia) y los reportes con gráficos. El bloque
  "Plan Agudo" del Excel está marcado "no usar" y no se trajo.
- Lo que se suma al catálogo (`lesionesCampos.js`) llega solo a los clubes ya sembrados:
  `leerConfig` completa las cabeceras y opciones que falten sin pisar lo que el club cambió.
- La hoja de opciones (`HojaOpciones`) se desplaza y, con más de ocho opciones, tiene un
  buscador que acerca lo escrito.
- Regla de oro del 01/10: lo que es igual en otro módulo tiene que ser igual en toda la web
  (escudos descargados con `EscudoDeClub`, el filtro de Registros, fichas con "Ver detalle",
  Ajustes con filas y "Volver a Ajustes").
- Después de entrar, lo primero es elegir el club (`src/ElegirClub.jsx`); desde el portal se
  cambia con "Cambiar". Falta la etapa grande de aislamiento por club en la base (RLS por
  `club_miembros`), que está en el plan del proyecto Control de Carga.
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
- Validaciones: obligatorios jugador, parte, lado y fecha de inicio; fechas no
  futuras y posteriores al inicio; no dos lesiones activas en la misma parte y
  lado (también como restricción `lesiones_sin_solapar` en la base).
- Los pasos de la carga y qué columna va en cada paso; el grupo de cada columna
  en la ficha; el aviso al cargar (misma parte y lado, 60 días); horas hasta la
  imagen manuales.

Plan para moverlo: una tabla `lesiones_protocolo` por club (clave, valor) con
los valores del Excel como semilla, igual que cabeceras y listas; se edita en
Ajustes › Protocolo; `leerConfig` la trae junto con lo demás y `calcular`,
`validarLesion` y el formulario reciben las reglas por contexto en vez de
constantes; la vista lee las mismas reglas con una función
`lesiones_regla(equipo, clave)` para que Power Query y la app coincidan; la
restricción de la base pasa a depender de la regla. Mientras tanto, cada regla
nueva se escribe en un solo lugar y con un nombre, para que mudarla sea corto.

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
