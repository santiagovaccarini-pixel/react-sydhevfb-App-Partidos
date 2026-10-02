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
   aceleraciones por minuto). El descarte es métrica por métrica.
2. **Bueno** = promedio sin datos raros (absolutos y relativos vs equipo);
   cociente de sumas de los casos que quedan (relativos por minuto: suma del
   absoluto sobre suma de minutos `DB`); fórmula de la fila 7 de
   `Data GPS Partido` sobre los casos que quedan (caídas relativas y caídas pp).
3. **Desv. Estándar** = desvío muestral sin datos raros.
4. **Muy Bueno** = Bueno + m·desvío, con m entre 0,25 y 1,75, elegido para que
   entre Bueno y Muy Bueno quede lo más cerca posible del 34% de los casos (los
   empates se resuelven como en la planilla, con `JERARQUÍA`).
5. **Excelente** = Bueno + (m + 0,25·i)·desvío, sin pasar de 2 desvíos,
   eligiendo i para acercarse a 2,5% de casos por encima de Excelente y 13,5%
   entre Muy Bueno y Excelente.
6. **Regular** = Bueno − m·desvío (34% de los casos entre Regular y Bueno) y
   **Malo** = Regular − 0,25·desvío. En la planilla la búsqueda del lado de
   abajo compara siempre la proporción por debajo de Regular, que es igual en
   todas las opciones, así que siempre gana la primera: Malo queda 0,25
   desvíos debajo de Regular. Se replicó tal cual.
7. **Negativos.** En métricas que no pueden ser negativas (absolutos, Tiempo,
   relativos por minuto y relativos vs equipo) un nivel que da negativo se
   lleva a 0. Pasa en métricas con muchos partidos en cero, como distancia a
   más de 7 m/s o aceleraciones mayores a 7 m/s. Las caídas sí pueden ser
   negativas, igual que en los VR de Equipo.

Decisiones propias al llevar la planilla a estos datos: la regla "promedio ≤ 1
no se limpia" no se aplica a los relativos vs equipo ni a las caídas, porque
son cocientes alrededor de 1 o de 0 y la regla los dejaría sin limpiar al
azar; para el Tiempo se mide en minutos. Todas las métricas son "más es
mejor", como en la planilla. Si el desvío no se puede calcular (un solo caso o
todos iguales) se escribe sólo Bueno.

Las celdas de VR con datos raros quitados quedan **en naranja** (`F4B183`).
El resumen trae la hoja `Proceso` (regla aplicada, multiplicadores elegidos y
asimetría por métrica) y `Atípicos` (cada valor quitado con sus límites).

Resultado del 02/10/2026 contra la versión anterior: Malo negativo en
métricas no negativas pasó de 1.627 a 428 casos antes de llevarlos a 0, y el
desvío bajó más de un 20% en 980 de 6.661 combinaciones × métricas.

Leyenda de colores en VR: **amarillo** = categoría calculada juntando casos de
otra categoría; **naranja** = métrica a la que se le quitaron datos raros.

## Archivos

- `generar_vr_jugadores.py` — hace todo desde afuera de Excel. Lee el `.xlsm`,
  arma los grupos a juntar a partir de las celdas pintadas, descarta atípicos,
  calcula las 6 filas por combinación replicando las fórmulas de las filas 5 a 9
  (las traduce y las evalúa; primero valida que sin filtro den lo mismo que los
  valores guardados por Excel), escribe las filas en el XML de la hoja VR sin
  tocar nada más del archivo (macros, tablas dinámicas, formatos y desplegables
  quedan intactos; sólo agrega a los estilos las variantes amarilla y naranja) y
  deja un `<salida>_resumen.xlsx` con las hojas `VR`, `Combinaciones`,
  `Proceso`, `Atípicos` y `Leyenda` para controlar.

  ```bash
  pip install openpyxl pandas numpy
  python excel/generar_vr_jugadores.py GPS_BD_Partido_CAM.xlsm GPS_BD_Partido_CAM_VR.xlsm
  # opciones: --sin-atipicos  --permitir-negativos  --sin-juntar
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
