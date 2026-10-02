# Valor Referencial (VR) por jugador — proceso

Cómo se generan los valores referenciales de cada jugador en el Excel de GPS
(`GPS_BD_Partido_CAM.xlsm`), qué hace cada archivo de esta carpeta y qué queda
por hacer. Escrito el 26/09/2026 a partir del archivo real.

## Qué es

La hoja **VR** guarda, para cada combinación de jugador y categoría de tiempo,
seis filas: **Excelente, Muy Bueno, Bueno, Regular, Malo y Desv. Estándar**.
Con esas filas la hoja **Data GPS Partido** "pinta" cada partido comparándolo
contra el valor referencial elegido en los desplegables `U2`, `V1`, `V2`, `V3`
(fila 2, "VR Promedio" y fila 3, "Pintado vs VR").

Hasta ahora la hoja VR solo tenía los valores de **Equipo** (162 filas). Los de
jugador se hacían a mano: filtrar la base por jugador y categoría, copiar las
filas 5 a 9 y pegarlas en VR. Son 31 jugadores × 7 categorías.

## Dónde está cada cosa en el Excel

| Qué | Dónde |
|---|---|
| Base de partidos | hoja `Data GPS Partido`, encabezados en la fila 13, datos desde la fila 15 |
| Jugador | columna `T` (`Equipo_Jugador`) |
| Categoría de tiempo | columna `DG` (encabezado "a"): `Sólo PT`, `Sólo ST`, `>=30 y Final ST`, `>=10 y <30 ST`, `>=85`, `>=70 y <85`, `PT + <25` |
| Puesto | columna `U` |
| Lista de jugadores y conteo de casos | hoja `Tiempos por jugador` (columna A; B:H cuentan con `SUMPRODUCT` sobre `T` y `DG`) |
| Filas resumen que responden al filtro | filas 5 a 9 de `Data GPS Partido`, columnas `AE` a `DA` |
| Grupos de métricas (fila 11) | `AF:AT` ABSOLUTOS · `AU:BH` RELATIVOS · `BJ:BW` CAÍDAS RELATIVAS · `BY:CL` RELATIVOS vs EQUIPO · `CN:DA` CAÍDAS pp vs EQUIPO |
| Destino | hoja `VR`; encabezados largos en la fila 2, filas de jugador desde la 166 |

### Cómo se calculan las filas 5 a 9

Todas usan `SUBTOTAL`, así que responden al filtro activo:

- **Bueno (fila 7)** = promedio de las filas visibles (`SUBTOTAL(1)`). En los
  relativos, si `N4` = "%" es el promedio de la columna; si no, cociente de
  sumas contra `DB` (minutos). En caídas relativas y caídas pp es un cociente
  de sumas de las columnas auxiliares `DC:EI`, `EY:FU` (PT/ST y equipo).
- **Muy Bueno / Regular** = Bueno ± 1 desvío estándar muestral (`SUBTOTAL(7)`).
- **Excelente / Malo** = Bueno ± 2 desvíos.
- **Desv. Estándar** (solo en VR) = Muy Bueno − Bueno.

Eso es lo que muestra el libro al filtrar. Para el VR de jugadores el script ya
no usa ± 1 y 2 desvíos: usa la lógica de la Plantilla VR (ver más abajo).
- **Cuenta** (columna H de VR) = casos con `Distance, m.` numérico.

Las columnas `P:S` (días al último partido, rotación, cambios) tienen fórmulas
que llegan solo hasta la fila 5216; no van a VR, así que no afecta.

### Estructura de cada fila que se escribe en VR

Igual a las filas de Equipo; la clave de la columna A la arma la fórmula que ya
tiene la hoja en esas filas (`=C&D&E&F&G`) y es la que busca `Data GPS Partido`
con `U2&V1&V2&V3&nivel`.

| Col | Contenido |
|---|---|
| B | fecha de generación |
| C | Item: `Jugador PT` para `Sólo PT`, `Jugador ST` para `Sólo ST`, `Jugador Total` para el resto (así están etiquetados los datos) |
| D | Nombre (columna `T`, sin espacios al final: "SCARPA " y "SCARPA" son el mismo) |
| E | Puesto más frecuente del jugador en esos casos |
| F | Categoría de tiempo |
| G | Nivel: Excelente … Desv. Estándar |
| H | Cantidad de casos |
| I … CE | Métricas, ubicadas por **nombre de encabezado** (fila 13 de Data ↔ fila 2 de VR) |

Combinaciones sin casos no se escriben. Con un solo caso no hay desvío: queda
Bueno y Cuenta, el resto vacío.

### Categorías que se juntan por jugador (celdas pintadas)

Cuando un jugador no tiene casos suficientes en una categoría (la regla de
trabajo es llegar a 5), se juntan sus casos con los de otra categoría. Eso se
indica **pintando celdas en la hoja `Tiempos por jugador`**: en la fila del
jugador, las categorías (columnas B:H) pintadas **una al lado de la otra y del
mismo color** forman un grupo; una columna sin pintar en el medio separa dos
grupos (ALAN FRANCO tiene `>=30 y Final ST` + `>=10 y <30 ST` por un lado y
`>=70 y <85` + `PT + <25` por otro). Una celda pintada sola se ignora y el
script lo avisa. La columna I con "Juntar" es sólo una ayuda visual; lo que
manda es la pintura.

Por cada grupo el script escribe **un solo bloque** de seis filas en VR:

- se calcula con los casos de todas las categorías del grupo (A MINDA: 2 + 4
  + 3 = 9 casos);
- en la columna de categoría (F) va **la categoría con más casos propios** del
  grupo (para A MINDA, `>=70 y <85`); si empatan, la primera en el orden de las
  columnas. Las otras categorías del grupo no tienen bloque propio;
- la celda de cantidad de casos (H) lleva una **nota** que dice qué categorías
  se juntaron y con cuántos casos cada una, y por qué se muestra con esa
  etiqueta;
- las seis filas quedan **en amarillo**, la convención que ya tenía el libro
  ("casos duplicados de otro intervalo y/o puesto").

El Item (columna C) es el de la categoría mostrada; el Puesto y la Cuenta salen
del grupo completo.

Grupos aplicados el 28/09/2026, tomados de la captura de pantalla de la hoja
pintada (filas 2 a 25; las filas 26 a 32, VICTOR en adelante, no se veían):
A MINDA `>=85`+`>=70 y <85`+`PT + <25`; A PRECIADO `>=30 y Final ST`+`>=10 y <30 ST`
(pintada pero sin "Juntar" en la columna I; se juntó igual porque así llega a
5); ALAN FRANCO dos grupos; ALEXSANDER, IGOR GOMES, M CASSIERRA y RUAN
`>=70 y <85`+`PT + <25`; CISSE `>=85`+`>=70 y <85`+`PT + <25`; KAUA PASCINI y
MAYCON `>=30 y Final ST`+`>=10 y <30 ST`.

### Cómo se calculan los niveles del VR (lógica de la Plantilla VR)

Desde el 02/10/2026 los niveles **no** son Bueno ± 1 y 2 desvíos, que daban
negativos y desvíos muy altos. Se usa la lógica de la planilla "Plantilla VR"
(hojas `1.3 Proceso_Absolutos` y `2.3 Proceso_Relativos`, recibidas como
`Libro1.xlsx`), métrica por métrica, para cada jugador y categoría:

1. **Datos raros.** Se calculan Q1 y Q3 (`CUARTIL` de Excel) y el porcentaje
   de valores fuera de 1,5 rangos intercuartílicos (RIC). Si es 10% o menos,
   se quitan los que están fuera de 1,5 RIC; si es más, sólo los que están
   fuera de 3 RIC. Los absolutos y relativos por minuto con promedio de 1 o
   menos no se limpian (regla de la planilla para variables chicas, como
   aceleraciones por minuto). El descarte es métrica por métrica, salvo en
   los relativos: el relativo por minuto es el absoluto dividido los minutos,
   así que usa exactamente los partidos que quedaron en su absoluto, y el
   relativo vs equipo también (más su propia limpieza). Si el absoluto no
   tiene VR, su relativo y su relativo vs equipo tampoco.
2. **Bueno** = promedio sin datos raros (absolutos, relativos vs equipo y
   caídas) o cociente de sumas de los casos que quedan (relativos por minuto:
   suma del absoluto sobre suma de minutos `DB`). En las caídas no se usa la
   fórmula de la fila 7 de `Data GPS Partido`: en las caídas pp esa fórmula da
   una fracción (por ejemplo −0,17) mientras los valores de cada partido están
   en puntos porcentuales (desvío 7,25), así que el libro mezcla escalas al
   armar Excelente y Malo; en las caídas relativas el cociente de sumas puede
   quedar fuera del rango de los datos.
3. **Reparto como una Gauss.** Los rangos se miden como pinta el libro:
   Excelente desde Excelente para arriba, Muy Bueno, Bueno y Regular entre su
   valor y el del nivel de arriba, y Malo todo lo que está debajo de Regular
   (el valor de Malo no se usa para pintar). Con el desvío de la muestra sin
   datos raros, se eligen los multiplicadores de a 0,25 desvíos (Excelente
   hasta 2) para que la muestra se reparta lo más parecido a una distribución
   normal: Excelente 2,5%, Muy Bueno 13,5%, Bueno 34%, Regular 34%, Malo 16%.
   En empates se elige lo más cercano a 1 y 2 desvíos. Malo = Regular − 0,25
   desvíos, como en la planilla. La hoja `Proceso` guarda también, como
   referencia, los multiplicadores que elegía la planilla.
4. **Reparto a mano.** Si con el desvío de la muestra Excelente queda con más
   del 10% de la muestra, Malo con más del 20%, algún nivel negativo (salvo
   caídas) o el desvío es más de 1,5 veces el del centro de la muestra
   ((P84 − P16) / 2), el desvío se reparte a mano: los cortes se ponen entre
   valores reales de la muestra, buscando el mismo reparto de Gauss sin pasar
   del 10% en Excelente ni del 20% en Malo. Así los niveles nunca salen del
   rango de los datos ni quedan negativos en métricas que no pueden serlo. El
   Desv. Estándar que se escribe es el del centro de la muestra. Esas celdas
   van en **celeste** y el detalle está en la hoja `A mano`.
5. **Muestras casi todas en 0.** Cuando casi todos los valores son 0 y hay uno
   o pocos distintos (por ejemplo 0, 0, 49, 0, 0), el rango intercuartílico da
   0 y la limpieza saca los valores distintos de 0: la muestra queda toda en 0
   y el VR vacío. En esos casos no se quitan valores y el VR se arma con el
   **25% del desvío**: Excelente = Bueno + 2 de ese desvío, Muy Bueno + 1,
   Regular − 1 y Malo − 1,25. El relativo por minuto y el relativo vs equipo de
   esa métrica siguen la misma regla. Van en celeste y se listan en la hoja
   `Casi todo en 0` del resumen. Si los datos son todos 0 de verdad, la métrica
   sigue vacía.
6. **Negativos.** En métricas que no pueden ser negativas (absolutos, Tiempo,
   relativos por minuto y relativos vs equipo) ningún nivel es negativo; si el
   valor de Malo da negativo se lleva a 0. Las caídas sí pueden ser negativas
   (bajan del primer al segundo tiempo): cuando cumplen todo lo anterior se
   escriben y se marcan con **letra roja**.
7. **Mínimo de 5 casos.** Una combinación de jugador y categoría (o grupo
   juntado) con menos de 5 casos no tiene VR: no se escribe y queda listada en
   la hoja `Sin VR` del resumen. Una métrica con menos de 5 valores queda vacía.
   Si Bueno da 0 o el desvío es 0, la métrica queda vacía, igual que en la
   planilla.

Decisiones propias al llevar la planilla a estos datos: la regla "promedio ≤ 1
no se limpia" no se aplica a los relativos vs equipo ni a las caídas, porque
son cocientes alrededor de 1 o de 0 y la regla los dejaría sin limpiar al
azar; para el Tiempo se mide en minutos. Todas las métricas son "más es
mejor", como en la planilla. El umbral de "desvío enorme" (1,5 veces el del
centro de la muestra) se fijó mirando los datos: en la mitad de las métricas
la relación es 1,1 o menos y sólo el 9% pasa de 1,5.

Las celdas de VR con datos raros quitados quedan **en naranja** (`F4B183`).
El resumen trae la hoja `Proceso` (regla aplicada, multiplicadores elegidos y
asimetría por métrica) y `Atípicos` (cada valor quitado con sus límites).

Resultado del 02/10/2026 (archivo pintado de la captura): 119 combinaciones con
VR y 40 sin VR por tener menos de 5 casos. Reparto medio de la muestra por rango:
1,4 / 12,3 / 33,6 / 39,6 / 13,1 % (Excelente a Malo); ninguna métrica pasa del
10% en Excelente ni del 20% en Malo. 2.230 de 5.559 métricas necesitaron el
reparto a mano, sobre todo por muestras chicas (con 5 a 9 casos un partido ya
es 11 a 20% de la muestra) y métricas con muchos ceros.

Leyenda de colores en VR: **amarillo** = categoría calculada juntando casos de
otra categoría; **naranja** = métrica a la que se le quitaron datos raros;
**celeste** = métrica con el desvío repartido a mano (tiene prioridad sobre los
otros dos); **letra roja** = nivel negativo en una caída.

## Archivos

- `generar_vr_jugadores.py` — hace todo desde afuera de Excel. Lee el `.xlsm`,
  arma los grupos a juntar a partir de las celdas pintadas, descarta atípicos,
  calcula las 6 filas por combinación replicando las fórmulas de las filas 5 a 9
  (las traduce y las evalúa; primero valida que sin filtro den lo mismo que los
  valores guardados por Excel), escribe las filas en el XML de la hoja VR sin
  tocar nada más del archivo (macros, tablas dinámicas, formatos y desplegables
  quedan intactos; sólo agrega a los estilos las variantes amarilla y naranja) y
  deja un `<salida>_resumen.xlsx` con las hojas `VR`, `Combinaciones`,
  `Proceso`, `Sin VR`, `A mano`, `Casi todo en 0`, `Atípicos` y `Leyenda` para controlar.

  ```bash
  pip install openpyxl pandas numpy
  python excel/generar_vr_jugadores.py GPS_BD_Partido_CAM.xlsm GPS_BD_Partido_CAM_VR.xlsm
  # opciones: --sin-atipicos  --permitir-negativos  --sin-a-mano  --sin-juntar
  ```

  Tarda alrededor de un minuto. Marca el libro para recalcular al abrirlo.

- `GenerarVR_Jugadores.bas` — lo mismo pero desde Excel, usando las fórmulas
  del libro: recorre jugadores × categorías, aplica el autofiltro en `T` y `DG`,
  recalcula y copia las filas 5 a 9 a VR por encabezado. Se importa con
  Alt+F11 › Archivo › Importar y se corre con Alt+F8. **No está probada** (no
  hubo Excel a mano al escribirla); las constantes de arriba del módulo
  (hojas, filas y columnas) son lo primero a revisar si falla.

Resultado de la primera corrida (26/09/2026): 172 combinaciones con casos,
1.032 filas en VR desde la fila 166; 45 combinaciones sin casos; 4 jugadores sin
datos en la base (LEO DUARTE, GUTTE, SAMUEL, LEMOS); 24 combinaciones con un solo
caso.

### Cuándo hace falta un VR nuevo (`ActualizarCasosVR.bas`)

La macro `ActualizarColores_ManejoErrores` (versión corregida en
`excel/ActualizarCasosVR.bas`) arma de nuevo las dos tablas de la hoja
`Análisis Casos VR` y pinta de rojo las categorías que ya justifican un VR nuevo:

- Tabla 1 (A:P): casos de cada VR, leídos de la hoja `VR` (fila "Bueno",
  columna H) con su fecha. Amarillo = VR que junta categorías.
- Tabla 2 (S:AA): casos actuales, contados en `Data GPS Partido` por jugador
  (T), puesto (U) y categoría de tiempo (DG), sólo filas "Jugador PT/ST/Total"
  y sólo jugadores de `Tiempos por jugador`. Cuenta todo aunque haya filtros.

| Casos del VR actual | Casos actuales para pintar de rojo |
|---|---|
| 0 (y 1 a 3) | 5 o más |
| 4 a 6 | 9 o más |
| 7 a 10 | 11 o más |
| 11 a 15 | 20 o más |
| 16 a 20 | 25 o más |
| 21 a 30 | 45 o más |
| 31 a 59 | 60 o más |
| 60 o más | 30 de diferencia: el VR anterior pasa a llamarse "1°" y se crea uno nuevo con mínimo 30 casos |

En un VR con categorías juntadas se comparan los casos del VR con la suma de
las categorías del grupo; las otras categorías del grupo quedan en gris. Cada
celda roja lleva una nota con los casos y la regla aplicada.

Errores que tenía la versión anterior: las condiciones estaban al revés
(pintaba con `<=`), los rangos se pisaban, las categorías se leían por posición,
no limpiaba los rojos de la corrida anterior, y la tabla de casos actuales se
armaba con la columna CM en vez de DG (la categoría de tiempo).

Instalación: en el editor de VBA (Alt+F11) borrar el contenido de `Módulo6`
(o quitar el módulo) e importar `ActualizarCasosVR.bas`; la hoja `Hoja10` tiene
una copia vieja con el mismo nombre que conviene borrar. No está probada en
Excel (no hubo Excel en el entorno); la lógica se simuló en Python con los
mismos datos.

## Pendiente

1. **Confirmar las filas 26 a 32 de la hoja pintada.** Los grupos del 28/09 se
   copiaron de una captura de pantalla que llegaba hasta V HUGO (fila 25). Si
   VICTOR, VITAO, GUTTE, KEVIN CASTANO, FRED, SAMUEL o LEMOS tienen celdas
   pintadas, hay que correr el script con el `.xlsm` pintado real. El criterio
   de fondo sigue siendo llegar a **al menos 5 casos** por VR; lo decide la
   persona pintando, el script no lo impone. Si más adelante se quiere que lo
   proponga solo, la hoja `Notas` (filas 4 a 13) tiene el mapa de intervalos
   equivalentes según PT, ST o Total.
2. **La macro VBA no junta ni descarta atípicos**: hace el proceso básico
   (filtrar y copiar las filas 5 a 9). Si se usa la macro, esas dos cosas hay
   que hacerlas a mano o pasar al script.
3. **Llevarlo a la app.** El cálculo es sencillo (promedio y desvío por
   columna sobre un subconjunto de filas), así que puede vivir en la app y
   quedar accesible sin Excel. Camino sugerido: subir el `.xlsm` (o un CSV de
   `Data GPS Partido`), calcular en el navegador o en una función de la API,
   mostrar la tabla y bajar el `.xlsm` completo o un `.xlsx` con las filas de
   VR para pegar. Ojo con el tamaño: la base tiene 9.600 filas × 448 columnas
   (más de 120 MB de XML dentro del `.xlsm`).
