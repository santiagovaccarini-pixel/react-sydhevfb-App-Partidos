Attribute VB_Name = "GenerarVR_Jugadores"
Option Explicit

' =====================================================================================
'  GenerarVR_Jugadores
'  Recorre cada jugador de 'Tiempos por jugador' (columna A) x cada categoria de tiempo
'  (fila 1, columnas B:H), filtra 'Data GPS Partido' por columna T (jugador) y DG
'  (categoria), y copia las filas 5..9 (Excelente, Muy Bueno, Bueno, Regular, Malo)
'  mas la Desv. Estandar (= Muy Bueno - Bueno) a la hoja VR, en sus columnas
'  correspondientes (por nombre de encabezado: fila 13 de Data <-> fila 2 de VR).
'
'  Estructura de cada fila que escribe en VR (igual que las filas de Equipo):
'    A = formula existente (C&D&E&F&G)   B = fecha de hoy      C = Item
'    D = Nombre   E = Puesto   F = categoria de tiempo   G = nivel   H = cantidad de casos
'    I..CE = metricas (Tiempo, absolutos, relativos, caidas, vs equipo, caidas pp)
'
'  Como usarla: Alt+F11 > Archivo > Importar archivo... > este .bas > cerrar >
'               Alt+F8 > GenerarVR_Jugadores > Ejecutar.
'  Nota: no fue probada en este entorno (sin Excel); si algo falla revisar constantes.
' =====================================================================================

Private Const HOJA_DATA As String = "Data GPS Partido"
Private Const HOJA_VR As String = "VR"
Private Const HOJA_JUG As String = "Tiempos por jugador"
Private Const FILA_HDR_DATA As Long = 13         ' encabezados largos en Data
Private Const FILA_HDR_VR As Long = 2            ' encabezados largos en VR
Private Const PRIMERA_FILA_DATOS As Long = 15
Private Const PRIMERA_FILA_VR As Long = 166      ' primera fila libre debajo de los VR de Equipo
Private Const COL_JUGADOR As String = "T"
Private Const COL_CATEGORIA As String = "DG"
Private Const COL_PUESTO As String = "U"
Private Const COL_CONTEO As String = "AF"        ' columna usada para contar casos (Distance)
Private Const COL_METRICA_INI As String = "AE"   ' desde 'Tiempo'
Private Const COL_METRICA_FIN As String = "DA"   ' hasta la ultima 'Caida pp vs Eq'

Public Sub GenerarVR_Jugadores()
    Dim wsD As Worksheet, wsVR As Worksheet, wsJ As Worksheet
    Set wsD = ThisWorkbook.Sheets(HOJA_DATA)
    Set wsVR = ThisWorkbook.Sheets(HOJA_VR)
    Set wsJ = ThisWorkbook.Sheets(HOJA_JUG)

    Dim niveles As Variant, filasOrigen As Variant
    niveles = Array("Excelente", "Muy Bueno", "Bueno", "Regular", "Malo", "Desv. Estándar")
    filasOrigen = Array(5, 6, 7, 8, 9, 0)    ' 0 = se calcula (fila6 - fila7)

    Dim calcPrev As XlCalculation, eventsPrev As Boolean
    calcPrev = Application.Calculation
    eventsPrev = Application.EnableEvents
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual

    On Error GoTo Salir

    ' ---- ultima fila de datos
    Dim ultFila As Long
    ultFila = wsD.Cells(wsD.Rows.Count, COL_JUGADOR).End(xlUp).Row
    If ultFila < PRIMERA_FILA_DATOS Then Err.Raise vbObjectError + 1, , "No hay datos en " & HOJA_DATA

    ' ---- asegurar autofiltro y calcular indices de campo
    If Not wsD.AutoFilterMode Then
        wsD.Range("B" & (PRIMERA_FILA_DATOS - 1) & ":FZ" & ultFila).AutoFilter
    End If
    Dim rngAF As Range: Set rngAF = wsD.AutoFilter.Range
    Dim fldJug As Long, fldCat As Long
    fldJug = wsD.Columns(COL_JUGADOR).Column - rngAF.Column + 1
    fldCat = wsD.Columns(COL_CATEGORIA).Column - rngAF.Column + 1
    rngAF.AutoFilter   ' quitar filtros previos
    wsD.Range("B" & (PRIMERA_FILA_DATOS - 1) & ":FZ" & ultFila).AutoFilter
    Set rngAF = wsD.AutoFilter.Range

    ' ---- mapa de columnas por encabezado (Data fila 13 -> VR fila 2)
    Dim colMap As Object: Set colMap = CreateObject("Scripting.Dictionary")
    Dim hdrVR As Range: Set hdrVR = wsVR.Range(wsVR.Cells(FILA_HDR_VR, 1), wsVR.Cells(FILA_HDR_VR, wsVR.Columns("CG").Column))
    Dim c As Long, h As Variant, m As Variant
    For c = wsD.Columns(COL_METRICA_INI).Column To wsD.Columns(COL_METRICA_FIN).Column
        h = wsD.Cells(FILA_HDR_DATA, c).Value
        If VarType(h) = vbString Then
            If Len(Trim(h)) > 0 Then
                m = Application.Match(h, hdrVR, 0)
                If IsError(m) Then m = Application.Match(Trim(h), hdrVR, 0)
                If Not IsError(m) Then colMap(c) = CLng(m)
            End If
        End If
    Next c

    ' ---- limpiar resultados de una corrida anterior (deja la formula de la columna A)
    Dim ultVR As Long
    ultVR = wsVR.Cells(wsVR.Rows.Count, "D").End(xlUp).Row
    If ultVR >= PRIMERA_FILA_VR Then
        wsVR.Range(wsVR.Cells(PRIMERA_FILA_VR, "B"), wsVR.Cells(ultVR, "CG")).ClearContents
    End If

    ' ---- recorrer jugadores x categorias
    Dim filaVR As Long: filaVR = PRIMERA_FILA_VR
    Dim ultJug As Long: ultJug = wsJ.Cells(wsJ.Rows.Count, "A").End(xlUp).Row
    Dim j As Long, k As Long, i As Long
    Dim jugador As String, categoria As String, item As String, puesto As String
    Dim nCasos As Double, v As Variant, v6 As Variant, v7 As Variant
    Dim rngDatos As Range, rngVis As Range
    Set rngDatos = wsD.Range(wsD.Cells(PRIMERA_FILA_DATOS, COL_CONTEO), wsD.Cells(ultFila, COL_CONTEO))

    For j = 2 To ultJug
        jugador = Trim(CStr(wsJ.Cells(j, "A").Value))
        If Len(jugador) = 0 Then GoTo SigJugador
        For k = 2 To 8
            categoria = CStr(wsJ.Cells(1, k).Value)
            If Len(categoria) = 0 Then GoTo SigCat
            Application.StatusBar = "VR: " & jugador & " / " & categoria & "  (fila VR " & filaVR & ")"

            rngAF.AutoFilter Field:=fldJug, Criteria1:=jugador
            rngAF.AutoFilter Field:=fldCat, Criteria1:=categoria
            Application.Calculate

            nCasos = Application.WorksheetFunction.Subtotal(2, rngDatos)
            If nCasos = 0 Then GoTo SigCat

            Select Case categoria
                Case "Sólo PT": item = "Jugador PT"
                Case "Sólo ST": item = "Jugador ST"
                Case Else:      item = "Jugador Total"
            End Select

            puesto = ""
            On Error Resume Next
            Set rngVis = wsD.Range(wsD.Cells(PRIMERA_FILA_DATOS, COL_PUESTO), wsD.Cells(ultFila, COL_PUESTO)).SpecialCells(xlCellTypeVisible)
            If Not rngVis Is Nothing Then puesto = CStr(rngVis.Areas(1).Cells(1, 1).Value)
            Set rngVis = Nothing
            On Error GoTo Salir

            For i = 0 To 5
                wsVR.Cells(filaVR, "B").Value = Date
                wsVR.Cells(filaVR, "C").Value = item
                wsVR.Cells(filaVR, "D").Value = jugador
                wsVR.Cells(filaVR, "E").Value = puesto
                wsVR.Cells(filaVR, "F").Value = categoria
                wsVR.Cells(filaVR, "G").Value = niveles(i)
                wsVR.Cells(filaVR, "H").Value = nCasos
                If Len(wsVR.Cells(filaVR, "A").Formula) = 0 Then
                    wsVR.Cells(filaVR, "A").Formula = "=C" & filaVR & "&D" & filaVR & "&E" & filaVR & "&F" & filaVR & "&G" & filaVR
                End If
                For Each c In colMap.Keys
                    If filasOrigen(i) > 0 Then
                        v = wsD.Cells(filasOrigen(i), c).Value
                    Else
                        v6 = wsD.Cells(6, c).Value: v7 = wsD.Cells(7, c).Value
                        If IsNumeric(v6) And IsNumeric(v7) And Not IsError(v6) And Not IsError(v7) And VarType(v6) <> vbString Then
                            v = CDbl(v6) - CDbl(v7)
                        Else
                            v = Empty
                        End If
                    End If
                    If IsError(v) Then v = Empty
                    If VarType(v) = vbString Then v = Empty
                    wsVR.Cells(filaVR, colMap(c)).Value = v
                Next c
                filaVR = filaVR + 1
            Next i
SigCat:
        Next k
SigJugador:
    Next j

    ' ---- quitar filtros y dejar todo visible
    If wsD.FilterMode Then wsD.ShowAllData
    Application.Calculate
    MsgBox "Listo. Se escribieron " & (filaVR - PRIMERA_FILA_VR) & " filas en la hoja VR (desde la fila " & PRIMERA_FILA_VR & ").", vbInformation

Salir:
    If Err.Number <> 0 Then MsgBox "Error " & Err.Number & ": " & Err.Description, vbCritical
    Application.StatusBar = False
    Application.Calculation = calcPrev
    Application.EnableEvents = eventsPrev
    Application.ScreenUpdating = True
End Sub
