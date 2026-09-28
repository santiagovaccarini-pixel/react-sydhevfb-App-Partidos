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

### Validación por cuartiles (valores atípicos)

Antes de calcular, cada métrica de cada combinación pasa por la regla de
Tukey: se calculan Q1 y Q3 (como `CUARTIL.INC` de Excel) y se descartan los
valores fuera de `[Q1 − 1,5·IQR, Q3 + 1,5·IQR]`. Se aplica sólo con **4 o más
casos** y si `IQR > 0`. El descarte es **métrica por métrica**: un partido con
una distancia atípica sale del cálculo de la distancia, pero sigue contando en
las demás métricas. En las métricas que son cociente de sumas (caídas
relativas y caídas pp), la fila descartada sale de todas las sumas de esa
métrica. Las celdas de VR calculadas con algún descarte quedan **en naranja**
(`F4B183`), y el detalle de cada valor descartado (jugador, categoría, partido,
métrica, valor y límites) va a la hoja `Atípicos` del resumen. La Cuenta
(columna H) es la cantidad de casos del grupo, sin descontar atípicos.

En la corrida del 28/09/2026 se descartó el 2,3 % de los valores (3.812 sobre
172 combinaciones × 71 métricas); la métrica con más descartes es `Tiempo`.

Leyenda de colores en VR: **amarillo** = categoría calculada juntando casos de
otra categoría; **naranja** = métrica calculada sin sus valores atípicos.

## Archivos

- `generar_vr_jugadores.py` — hace todo desde afuera de Excel. Lee el `.xlsm`,
  arma los grupos a juntar a partir de las celdas pintadas, descarta atípicos,
  calcula las 6 filas por combinación replicando las fórmulas de las filas 5 a 9
  (las traduce y las evalúa; primero valida que sin filtro den lo mismo que los
  valores guardados por Excel), escribe las filas en el XML de la hoja VR sin
  tocar nada más del archivo (macros, tablas dinámicas, formatos y desplegables
  quedan intactos; sólo agrega a los estilos las variantes amarilla y naranja) y
  deja un `<salida>_resumen.xlsx` con las hojas `VR`, `Combinaciones`,
  `Atípicos` y `Leyenda` para controlar.

  ```bash
  pip install openpyxl pandas numpy
  python excel/generar_vr_jugadores.py GPS_BD_Partido_CAM.xlsm GPS_BD_Partido_CAM_VR.xlsm
  # opciones: --sin-atipicos  --iqr-k 1.5  --min-n-iqr 4  --sin-juntar
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
