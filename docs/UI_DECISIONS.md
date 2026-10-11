# Índice de decisiones de interfaz

## Cómo usar este registro

Las decisiones existentes siguen en [PENDIENTES.md](PENDIENTES.md): este archivo
es un índice de restricciones, no una copia de su historia ni una segunda fuente.
Antes de tocar un módulo, leé la sección indicada completa. No implementes propuestas
pendientes como si fueran acuerdos cerrados. Cuando una nota vieja y otra posterior
difieran, revisá la decisión posterior y el código; si sigue ambiguo, consultá.

Una decisión descartada no se reintroduce, tampoco con otro nombre o en una pantalla
equivalente. Solo el usuario puede reabrirla explícitamente. Este registro no inventa
prohibiciones específicas de conversaciones que no están disponibles.

## Decisiones cerradas existentes

| ID | Restricción que debe conservarse | Fuente en PENDIENTES.md |
| --- | --- | --- |
| UI-001 | La administración de jugadores vive solo en Datos básicos. No devolver Ajustes › Jugadores a Partido ni Ajustes › Lista de jugadores a Flujo diario. Posiciones y Catapult permanecen en Datos básicos. Esto no elimina los selectores operativos de jugadores. | «Idioma, Lesiones y Datos básicos (01/10 y 02/10)», decisión del 02/10 |
| UI-002 | Datos básicos permanece en el portal principal. No moverlo dentro de Bases de Datos sin que el usuario reabra la decisión y defina quién lo ve. | «Bases de Datos (05/10)» |
| UI-003 | Ninguna base muestra una columna # para contar filas; la cantidad va arriba de la tabla. Los números propios del registro (N° de caso, N° de registro, nº Eva) sí quedan. | «Bases de Datos (05/10)», regla para todas las bases |
| UI-004 | Lesiones se carga por grupos, solo con campos manuales. Diagnóstico no es un paso y los campos calculados no vuelven al final del formulario. La ficha muestra un grupo a la vez. | «Idioma, Lesiones y Datos básicos (01/10 y 02/10)», grupos del Excel y ficha |
| UI-005 | En el mapa corporal no se agregan “Otro…” ni opciones inventadas; se respetan las listas del club y la alternativa “Elegir de la lista”. | «Lesiones: lo que sigue (anotado el 02/10)», cuerpo humano |
| UI-006 | Evaluaciones no vuelve a mostrar Posición, claves auxiliares de BUSCAR, la asimetría A separada del déficit ni los elementos enumerados como no copiados. No se eliminan columnas con resultados propios. | «Evaluaciones (05/10)», reglas para todos los tests y lo que no se copió |
| UI-007 | Conservá tarjetas, fotos y portadas aprobadas y su componente compartido; no las reemplaces al aplicar la regla general de reducir decoración. | «Entrenamiento (OpenField)», portal y portada; «Bases de Datos (05/10)» |
| UI-008 | En Tareas, las correcciones manuales siguen plegadas en “Ajustar horarios y pausas”. No expandir todo por defecto. | «Entrenamiento (OpenField)», tareas como un partido |
| UI-009 | Salir de un club vive solo en portal › Cambiar (abajo, «Salir de {club}», enlace secundario), igual para todos. No volver a ponerlo en la fila propia de Cuentas. | «Cuentas paso 2», salir de un club en un solo lugar (08/10) |
| UI-010 | El nombre de un club (y sus demás datos) lo cambian solo los dueños, en Clubes de la app («Cambiar nombre», con confirmación). Descartado: renombrar en Partido › Ajustes › Equipo (la tarjeta «Tu equipo» muestra el escudo y el nombre, nada más); no volver a ponerlo ahí ni en Cuentas, ni dárselo al administrador del club. | «Cuentas paso 2», los datos de un club los cambian solo los dueños (09/10) |
| UI-011 | En Cuentas, el aviso del mail de una invitación abierta nunca dice que el correo ya tiene cuenta ni que entró: si el mail no salió (también la invitación de un dueño de la app, que queda abierta) dice que la invitación quedó guardada y que se mande con «Copiar mensaje». No volver a poner «ya tiene cuenta: no hace falta el mail» ni decir que se mandó un mail que no salió. | «Cuentas paso 2», dueños protegidos; «Entrada a la app», «Invitaciones por mail», invitación a un dueño de la app (09/10) |
| UI-012 | Toda base carga lo nuevo en su propia pantalla, aparte (como Nuevos casos en Lesiones), y tiene una sola Base (si tiene varias tablas, se elige cuál ver), Reportes (se elige cuál) y Ajustes (cabeceras y listas). En Evaluaciones: Cargar · Base · Reportes · Valores de referencia · Ajustes. Descartado: volver a poner «Agregar evaluación» (o agregar filas nuevas) en la Base, y una pantalla por test. | «Bases de Datos (05/10)», regla del 09/10; «Evaluaciones (05/10)», las pantallas (09/10) |
| UI-013 | En el reporte individual de toda base con varios registros por atleta se ven sus registros con todas las cabeceras, los últimos 5, y cada lugar se cambia con un desplegable por otro registro suyo; nunca más de 5 a la vez. No volver a mostrar solo el último registro ni todos sin límite. Lo de las últimas 5, por ahora solo en Evaluaciones (Santiago, 09/10): Lesiones sigue mostrando todas. | «Bases de Datos (05/10)», regla del 09/10 de los registros de un atleta |
| UI-014 | Toda clasificación (1 a 5) se ve igual en toda la app, en la Base, el informe y los reportes de todos los tests: el número en negrita del color de su clase, sobre gris (como en el Excel). Historia: el 09/10 (PR #228) pasó a la celda entera del color de su clase con letra blanca u oscura; **reabierta el mismo 09/10** por Santiago («Mejor devolve el color gris a los fondos de clasificacion»), vuelve el gris. Descartado: la celda entera del color de la clase y los tonos propios de cada hoja del Excel. | «Evaluaciones (05/10)», cómo se ve una clase (09/10, reabierta) |
| UI-015 | En Evaluaciones el test se elige en un desplegable («Test»), el mismo en Cargar, Base, Reportes › Grupal, Valores de referencia y Ajustes › Cabeceras. Descartado: un botón (o una pestaña) por test, con todas las evaluaciones como opciones sueltas. | «Evaluaciones (05/10)», las pantallas (09/10), el test en un desplegable |
| UI-016 | Isocinecia es un solo test: en la Base y en Reportes › Grupal se elige la velocidad en un desplegable («Velocidad»: 60° / 180° / 300° / Todas, como los botones del Excel). No se carga a mano en Cargar (sale del PDF del equipo; el lector del PDF es un pendiente). Descartado: tres tests separados y un formulario a mano para Isocinecia. | «Evaluaciones (05/10)», Isocinecia (09/10) |
| UI-017 | La hoja Funcional son cuatro tests, uno por bloque (Movilidad de Tobillo, de Cadera, de Isquio y Estabilidad rotacional), cada uno con su fecha y su n° de evaluación, porque se toman en días distintos. Sentadilla de Arranque, Hombro, los Re - test y las notas no están. Descartado: un solo test «Funcional» con una fila por jugador que junte bloques de días distintos. | «Evaluaciones (05/10)», Funcional (09/10) |
| UI-018 | En Sentadilla Incremental cada una de las cinco series tiene «¿Cuenta?» (SI / NO): una serie con «NO», o sin Kg o sin PSE, no entra en el RM IND. Al pegar del Excel, la serie con Kg y PSE pero sin Fmax T viene en «NO». Dispositivo y Medio son listas (se cambian en Ajustes › Listas). Pot y RM IND/REL no están. Descartado: contar todas las series completas y volver a poner Pot o RM IND/REL. | «Evaluaciones (05/10)», Sentadilla Incremental (09/10) |
| UI-019 | La hoja Saltos son cuatro tests, uno por bloque (Salto Countermovement, Salto Drop, Salto Squat y Salto Single Leg), cada uno con su n° de evaluación; al pegar, cada uno toma la Fecha, la Selección y el P.C. de la fila. Drop y Squat tienen sus propios V.R. (vacíos hasta que se carguen; sin ellos, sin clases). Descartado: un solo test «Saltos» con los cuatro bloques en una fila, y clasificar Drop con los V.R. de Countermovement. | «Evaluaciones (05/10)», Saltos (10/10) |
| UI-020 | La web se llama ARK: la pestaña, lo que se ve al mandar el enlace, el nombre al instalarla, la pantalla de entrada y el mensaje de invitación. En Partido, la barra lateral dice «Partido» (el nombre del módulo). Descartado: volver a «Registro Partido» como nombre de la web. | «El nombre de la web: ARK (10/10)» |
| UI-021 | GPS: la Base muestra un período (Desde y Hasta arriba; al abrir, las últimas 4 semanas) y cada fila se pinta contra el promedio y el desvío de las filas a la vista de su mismo dispositivo (columna Dispositivo, una lista del club en Ajustes); con más de un dispositivo a la vista, un informe por dispositivo. Arriba también se elige Jugador y Dispositivo: la base filtra antes de traer; con más de 20.000 filas no se traen sin preguntar (dice cuántas son y deja acotar o traerlas igual; 11/10). Las columnas se renombran, se esconden («quitar» es esconder) y se suman en Ajustes › Cabeceras. Descartado: el corte por microciclo ≤16 / ≥17 del Excel («Tabla para microciclo <=16») y abrir con todo el historial. Hoy la barra es Base · Ajustes: Cargar y Reportes se suman en sus pasos (UI-012). | «GPS (10/10)» |
| UI-022 | La sesión se cierra y el club se elige o se cambia solo en el portal («Salir» y «Cambiar», arriba). Ningún módulo lo hace: Partido › Ajustes › Equipo muestra el escudo y el nombre (UI-010) y, sin club, dice que se elige en el portal; Partido no pasa a otro club por su cuenta. Descartado: «Cerrar sesión» en los Ajustes de Partido y de Flujo diario, la lista «Cambiar de equipo» y la lista para elegir club dentro de Partido. | «Notas (06/10)», lo anotado en Notas (11/10) |
| UI-023 | Lesiones › Reportes › Informes gráficos: cada gráfico (cada torta por separado) tiene su embudo arriba a la derecha, que filtra solo ese gráfico por el año y por cualquier cabecera de la Base de Lesiones a la vista (en los c/1000 h, sin las de la persona); debajo del título va lo filtrado. Descartado: los botones de filtros y de años arriba de cada bloque, compartidos por sus gráficos. | «Lesiones: lo que sigue», Informes gráficos, filtros (11/10) |

## Pendientes que no deben tratarse como decisiones cerradas

- Local / visitante / neutral en el filtro: falta confirmar botones u hoja
  («Chicas del filtro»). No registrar ninguna de las dos opciones como prohibida.
- Nombres del filtro de jugador: faltan los reemplazos concretos («Chicas del filtro»).
- Valor Referencial como módulo propio: es para más adelante; hoy los V.R. están
  en Evaluaciones, en su pantalla aparte (la quinta, decidido el 09/10), solo lectura
  («Evaluaciones (05/10)»).
- Evaluaciones › Cargar › Isocinecia desde el PDF del equipo: Santiago propuso (09/10) llevar
  a la app el lector en Python que ya tienen; falta el lector y PDF de ejemplo. No hacer un
  formulario a mano mientras tanto.
- Evaluaciones › notas en las celdas, como en Excel (Santiago, 09/10, «mejor» que una columna
  aparte): se hace en su propio cambio, para todos los tests.
- Evaluaciones › Reportes › Gráficos: falta definir qué gráficos van (Santiago, 09/10:
  «después lo vemos»). No agregar ninguno hasta que se defina.
- Evaluaciones › Reporte individual: la «Clasificación general» y el puntaje de cada área
  esperan la explicación de Santiago (09/10); el Grupal espera la solapa «Reporte grupal»
  del Excel. No inventar cortes, puntajes ni el diseño del grupal mientras tanto.
- Configuración del protocolo por club, tutorial, GPS y futuras bases: siguen el
  estado y alcance de su sección en PENDIENTES.md; no se implementan por este índice.
- GPS › Cargar (con la lógica de la plantilla), Reportes, V.R. por dispositivo y traerlo
  directo de OpenField: son los pasos 2 a 5 de «GPS (10/10)». Las reglas de los V.R. las
  explica Santiago; no inventarlas.

## Nuevas decisiones y reaperturas

Si la decisión ya tiene una fuente equivalente, actualizá esa fuente y sumá aquí
solo una referencia. Si no la tiene, registrala aquí con este formato:

```text
ID: UI-XXX
Estado: CERRADA / DESCARTADA / PENDIENTE / REABIERTA
Fecha y fuente: pedido explícito del usuario, documento o referencia comprobable
Alcance: módulo, pantalla y elemento
Decisión: qué se acordó
No reintroducir: elemento, ubicación o comportamiento concreto descartado
Motivo: por qué se tomó
Reapertura: pedido explícito, fecha, nueva decisión y decisión que reemplaza
Cómo comprobarlo: pantalla o recorrido donde se verifica
```

Conservá la decisión anterior y su referencia al reabrirla. No borres el historial
para justificar un cambio. Cuando falte evidencia del acuerdo, dejá la cuestión
pendiente y pedí el dato concreto solo si es necesario para el trabajo actual.
