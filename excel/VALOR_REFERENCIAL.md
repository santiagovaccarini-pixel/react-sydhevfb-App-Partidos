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

## Archivos

- `generar_vr_jugadores.py` — hace todo desde afuera de Excel. Lee el `.xlsm`,
  calcula las 6 filas por combinación replicando las fórmulas de las filas 5 a 9
  (las traduce y las evalúa; primero valida que sin filtro den lo mismo que los
  valores guardados por Excel), escribe las filas en el XML de la hoja VR sin
  tocar nada más del archivo (macros, tablas dinámicas, formatos y desplegables
  quedan intactos) y deja un `<salida>_resumen.xlsx` para controlar.

  ```bash
  pip install openpyxl pandas numpy
  python excel/generar_vr_jugadores.py GPS_BD_Partido_CAM.xlsm GPS_BD_Partido_CAM_VR.xlsm
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

1. **Mínimo de 5 casos.** Hoy se escribe cualquier combinación con al menos
   un caso. La regla de trabajo es que un VR necesita **al menos 5 casos**; si
   el jugador no llega, se completan con casos de **otro intervalo de tiempo
   y/o de otro puesto**, y las celdas quedan **en amarillo** para avisar que
   son prestados (así lo dice la nota de la fila 6 de VR y de "Análisis Casos
   VR"). La hoja `Notas` (filas 4 a 13) tiene el mapa de qué intervalo equivale
   a cuál según se mire PT, ST o Total. Falta definir, antes de programarlo:
   - el orden en que se toman prestados los casos (primero otro intervalo del
     mismo jugador, después mismo puesto de otros jugadores, o al revés);
   - si se completa hasta 5 justo o se suman todos los casos del intervalo
     prestado;
   - si con menos de 5 sin posibilidad de completar se deja vacío o se escribe
     igual, marcado.
   Con eso definido, el script ya tiene la base: la máscara de filas que
   alimenta cada combinación es lo único que cambia.
2. **Llevarlo a la app.** El cálculo es sencillo (promedio y desvío por
   columna sobre un subconjunto de filas), así que puede vivir en la app y
   quedar accesible sin Excel. Camino sugerido: subir el `.xlsm` (o un CSV de
   `Data GPS Partido`), calcular en el navegador o en una función de la API,
   mostrar la tabla y bajar el `.xlsm` completo o un `.xlsx` con las filas de
   VR para pegar. Ojo con el tamaño: la base tiene 9.600 filas × 448 columnas
   (más de 120 MB de XML dentro del `.xlsm`).
