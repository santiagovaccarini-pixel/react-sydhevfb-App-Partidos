Attribute VB_Name = "ActualizarCasosVR"
Option Explicit

' =====================================================================================
'  ActualizarColores_ManejoErrores  (version corregida)
'
'  Arma de nuevo las dos tablas de la hoja "Análisis Casos VR" y pinta de rojo los casos
'  actuales que ya justifican un VR nuevo, segun la Regla de Valores Referenciales:
'
'      Casos del VR actual      Casos actuales para pintar de rojo
'      0                        5 o mas        (con 1 a 3 casos se usa esta misma fila)
'      4 a 6                    9 o mas
'      7 a 10                   11 o mas
'      11 a 15                  20 o mas
'      16 a 20                  25 o mas
'      21 a 30                  45 o mas
'      mas de 30 (31 a 59)      60 o mas
'      60 o mas                 30 casos o mas de diferencia: al VR anterior se le agrega
'                               "1°" al nombre y se crea un VR nuevo con minimo 30 casos
'
'  Tabla 1 (A:P): casos de cada VR, leidos de la hoja VR (fila "Bueno", columna H
'                 "Cuenta") y la fecha del VR (columna B). Amarillo = VR que junta
'                 categorias (tiene la nota "Categorías juntadas" en la columna H).
'  Tabla 2 (S:AA): casos actuales, contados en "Data GPS Partido" por jugador (T),
'                 puesto (U) y categoria de tiempo (DG), en filas "Jugador PT/ST/Total"
'                 del equipo propio (columna G: el equipo con mas filas de jugadores).
'                 Se cuentan todas las filas aunque la hoja tenga filtros.
'
'  Categorias juntadas: el VR esta en la categoria de mas casos del grupo; los casos
'  actuales que se comparan son la suma de las categorias del grupo, y las otras
'  categorias del grupo quedan en gris con una nota.
'
'  Cada celda roja lleva una nota con los casos del VR, los actuales y la regla aplicada.
' =====================================================================================

Private Const COL_ITEM As String = "D"
Private Const COL_EQUIPO As String = "G"
Private Const COL_JUGADOR As String = "T"
Private Const COL_PUESTO As String = "U"
Private Const COL_CATEGORIA As String = "DG"
Private Const FILA_DATOS As Long = 15
Private Const FILA_TITULOS As Long = 7          ' titulos de las dos tablas en "Análisis Casos VR"
Private Const FILA_INICIO As Long = 8

Private paso As String      ' en que parte va la macro (para el mensaje de error)

' Quita tildes, espacios de mas y mayusculas para comparar nombres de hojas
Private Function Normalizar(ByVal t As String) As String
    Dim conTilde As String, sinTilde As String, i As Long
    conTilde = ChrW(225) & ChrW(233) & ChrW(237) & ChrW(243) & ChrW(250) & ChrW(193) & ChrW(201) & ChrW(205) & ChrW(211) & ChrW(218)
    sinTilde = "aeiouAEIOU"
    For i = 1 To Len(conTilde)
        t = Replace(t, Mid$(conTilde, i, 1), Mid$(sinTilde, i, 1))
    Next i
    t = Replace(t, ChrW(160), " ")
    Do While InStr(t, "  ") > 0: t = Replace(t, "  ", " "): Loop
    Normalizar = LCase$(Trim$(t))
End Function

' Busca una hoja por nombre sin importar tildes, mayusculas ni espacios
Private Function Hoja(ByVal nombre As String) As Worksheet
    Dim sh As Worksheet
    For Each sh In ThisWorkbook.Worksheets
        If Normalizar(sh.Name) = Normalizar(nombre) Then Set Hoja = sh: Exit Function
    Next sh
    Err.Raise vbObjectError + 9, , "No encuentro la hoja " & Chr(34) & nombre & Chr(34) & _
        ". Revisa el nombre de la solapa."
End Function

Private Function Categorias() As Variant
    Categorias = Array(">=10 y <30 ST", ">=30 y Final ST", ">=70 y <85", ">=85", "PT + <25", _
                       "S" & ChrW(243) & "lo PT", "S" & ChrW(243) & "lo ST")
End Function

' Casos actuales necesarios para un VR nuevo, segun los casos del VR actual.
' Devuelve tambien el texto de la regla aplicada.
Private Function UmbralNuevoVR(ByVal casosVR As Long, ByRef regla As String) As Long
    Select Case casosVR
        Case Is <= 3:   UmbralNuevoVR = 5:  regla = "VR con " & casosVR & " casos: hacen falta 5 o mas"
        Case 4 To 6:    UmbralNuevoVR = 9:  regla = "VR de 4 a 6 casos: hacen falta 9 o mas"
        Case 7 To 10:   UmbralNuevoVR = 11: regla = "VR de 7 a 10 casos: hacen falta 11 o mas"
        Case 11 To 15:  UmbralNuevoVR = 20: regla = "VR de 11 a 15 casos: hacen falta 20 o mas"
        Case 16 To 20:  UmbralNuevoVR = 25: regla = "VR de 16 a 20 casos: hacen falta 25 o mas"
        Case 21 To 30:  UmbralNuevoVR = 45: regla = "VR de 21 a 30 casos: hacen falta 45 o mas"
        Case 31 To 59:  UmbralNuevoVR = 60: regla = "VR de mas de 30 casos: hacen falta 60 o mas"
        Case Else
            UmbralNuevoVR = casosVR + 30
            regla = "VR de 60 o mas casos: hacen falta 30 casos de diferencia (" & casosVR + 30 & "). " & _
                    "Al VR anterior se le agrega " & Chr(34) & "1" & ChrW(176) & Chr(34) & _
                    " al nombre y se crea un VR nuevo con minimo 30 casos."
    End Select
End Function

Public Sub ActualizarColores_ManejoErrores()
    Dim ws As Worksheet, wsD As Worksheet, wsVR As Worksheet
    Dim cats As Variant, nCat As Long, c As Long
    Dim calcPrev As XlCalculation

    On Error GoTo Fallo
    paso = "buscar las hojas"
    Set ws = Hoja("Analisis Casos VR")
    Set wsD = Hoja("Data GPS Partido")
    Set wsVR = Hoja("VR")
    cats = Categorias(): nCat = UBound(cats) + 1

    Application.ScreenUpdating = False
    calcPrev = Application.Calculation
    Application.Calculation = xlCalculationManual

    Dim r As Long, nombre As String, puesto As String, cat As String, clave As String

    paso = "contar los casos actuales en Data GPS Partido"
    Dim ultD As Long, vItem As Variant, vJug As Variant, vPue As Variant, vCat As Variant, vEq As Variant
    ultD = wsD.Cells(wsD.Rows.Count, COL_JUGADOR).End(xlUp).Row
    If ultD <= FILA_DATOS Then Err.Raise vbObjectError + 1, , "No hay datos en Data GPS Partido"
    vItem = wsD.Range(COL_ITEM & FILA_DATOS & ":" & COL_ITEM & ultD).Value
    vJug = wsD.Range(COL_JUGADOR & FILA_DATOS & ":" & COL_JUGADOR & ultD).Value
    vPue = wsD.Range(COL_PUESTO & FILA_DATOS & ":" & COL_PUESTO & ultD).Value
    vCat = wsD.Range(COL_CATEGORIA & FILA_DATOS & ":" & COL_CATEGORIA & ultD).Value
    vEq = wsD.Range(COL_EQUIPO & FILA_DATOS & ":" & COL_EQUIPO & ultD).Value

    ' equipo propio: el que tiene mas filas de jugadores en la base (los rivales tambien estan en la base)
    Dim equipos As Object: Set equipos = CreateObject("Scripting.Dictionary")
    Dim i As Long, eq As Variant, miEquipo As String, maxFilas As Long
    For i = 1 To UBound(vJug, 1)
        If Left$(CStr(vItem(i, 1)), 7) = "Jugador" Then
            eq = Trim(CStr(vEq(i, 1)))
            equipos(eq) = equipos(eq) + 1
        End If
    Next i
    For Each eq In equipos.Keys
        If equipos(eq) > maxFilas Then maxFilas = equipos(eq): miEquipo = eq
    Next eq

    Dim esCat As Object: Set esCat = CreateObject("Scripting.Dictionary")
    For c = 0 To nCat - 1: esCat(cats(c)) = c: Next c

    Dim actuales As Object: Set actuales = CreateObject("Scripting.Dictionary")   ' nombre|puesto|cat -> casos
    Dim filas As Object: Set filas = CreateObject("Scripting.Dictionary")         ' nombre|puesto -> True (orden)
    For i = 1 To UBound(vJug, 1)
        nombre = Trim(CStr(vJug(i, 1)))
        If Len(nombre) > 0 And Left$(CStr(vItem(i, 1)), 7) = "Jugador" And Trim(CStr(vEq(i, 1))) = miEquipo Then
            cat = Trim(CStr(vCat(i, 1)))
            If esCat.Exists(cat) Then
                puesto = Trim(CStr(vPue(i, 1)))
                clave = nombre & "|" & puesto
                If Not filas.Exists(clave) Then filas(clave) = True
                actuales(clave & "|" & cat) = actuales(clave & "|" & cat) + 1
            End If
        End If
    Next i

    paso = "leer los casos de cada VR en la hoja VR"
    Dim casosVR As Object: Set casosVR = CreateObject("Scripting.Dictionary")      ' nombre|puesto|cat -> casos
    Dim fechaVR As Object: Set fechaVR = CreateObject("Scripting.Dictionary")
    Dim grupoDe As Object: Set grupoDe = CreateObject("Scripting.Dictionary")      ' nombre|puesto|cat -> cat del VR
    Dim miembros As Object: Set miembros = CreateObject("Scripting.Dictionary")    ' nombre|puesto|catVR -> "cat1;cat2"
    Dim ultVR As Long, nota As String, k As Long
    ultVR = wsVR.Cells(wsVR.Rows.Count, "D").End(xlUp).Row
    For r = 4 To ultVR
        If CStr(wsVR.Cells(r, "G").Value) = "Bueno" And Left$(CStr(wsVR.Cells(r, "C").Value), 7) = "Jugador" Then
            nombre = Trim(CStr(wsVR.Cells(r, "D").Value))
            puesto = Trim(CStr(wsVR.Cells(r, "E").Value))
            cat = Trim(CStr(wsVR.Cells(r, "F").Value))
            If Len(nombre) > 0 And esCat.Exists(cat) Then
                clave = nombre & "|" & puesto
                If Not filas.Exists(clave) Then filas(clave) = True
                casosVR(clave & "|" & cat) = CLng(Val(wsVR.Cells(r, "H").Value))
                fechaVR(clave & "|" & cat) = wsVR.Cells(r, "B").Value
                nota = ""
                If Not wsVR.Cells(r, "H").Comment Is Nothing Then nota = wsVR.Cells(r, "H").Comment.Text
                If InStr(1, nota, "juntadas", vbTextCompare) > 0 Then
                    miembros(clave & "|" & cat) = ""
                    For k = 0 To nCat - 1
                        If InStr(1, nota, cats(k) & " (", vbBinaryCompare) > 0 Then
                            grupoDe(clave & "|" & cats(k)) = cat
                            miembros(clave & "|" & cat) = miembros(clave & "|" & cat) & cats(k) & ";"
                        End If
                    Next k
                End If
            End If
        End If
    Next r

    paso = "limpiar las tablas anteriores"
    Dim ultAnt As Long
    ultAnt = Application.WorksheetFunction.Max(ws.Cells(ws.Rows.Count, "A").End(xlUp).Row, _
                                               ws.Cells(ws.Rows.Count, "S").End(xlUp).Row, FILA_INICIO)
    With ws.Range("A" & FILA_INICIO & ":AA" & ultAnt)
        .ClearContents
        .ClearComments
        .Interior.Pattern = xlNone
    End With

    ' ---------- titulos
    ws.Cells(FILA_TITULOS, "A").Value = "Nombre": ws.Cells(FILA_TITULOS, "B").Value = "Puesto"
    ws.Cells(FILA_TITULOS, "S").Value = "Nombre": ws.Cells(FILA_TITULOS, "T").Value = "Puesto"
    For c = 0 To nCat - 1
        ws.Cells(FILA_TITULOS, 3 + 2 * c).Value = cats(c)         ' C, E, G, I, K, M, O
        ws.Cells(FILA_TITULOS, 4 + 2 * c).Value = "Fecha"         ' D, F, H, J, L, N, P
        ws.Cells(FILA_TITULOS, 21 + c).Value = cats(c)            ' U .. AA
    Next c

    paso = "escribir y pintar las tablas"
    Dim fila As Long, vr As Long, act As Long, umbral As Long, regla As String
    Dim celda As Range, partes As Variant, m As Variant, catVR As String, nRojos As Long
    fila = FILA_INICIO
    Dim claveFila As Variant
    For Each claveFila In filas.Keys
        partes = Split(claveFila, "|")
        ws.Cells(fila, "A").Value = partes(0): ws.Cells(fila, "B").Value = partes(1)
        ws.Cells(fila, "S").Value = partes(0): ws.Cells(fila, "T").Value = partes(1)
        For c = 0 To nCat - 1
            cat = cats(c): clave = claveFila & "|" & cat
            ' tabla 1: casos del VR y fecha
            vr = 0
            If casosVR.Exists(clave) Then vr = casosVR(clave)
            ws.Cells(fila, 3 + 2 * c).Value = vr
            If fechaVR.Exists(clave) Then ws.Cells(fila, 4 + 2 * c).Value = fechaVR(clave)
            If miembros.Exists(clave) Then ws.Cells(fila, 3 + 2 * c).Interior.Color = RGB(255, 255, 0)
            ' tabla 2: casos actuales
            act = 0
            If actuales.Exists(clave) Then act = actuales(clave)
            Set celda = ws.Cells(fila, 21 + c)
            celda.Value = act

            If grupoDe.Exists(clave) And Not miembros.Exists(clave) Then
                ' categoria juntada dentro del VR de otra categoria: se evalua junto con ese VR
                celda.Interior.Color = RGB(217, 217, 217)
                celda.AddComment "Juntada en el VR de " & grupoDe(clave) & "."
            Else
                If miembros.Exists(clave) Then
                    act = 0
                    For Each m In Split(miembros(clave), ";")
                        If Len(m) > 0 Then
                            If actuales.Exists(claveFila & "|" & m) Then act = act + actuales(claveFila & "|" & m)
                        End If
                    Next m
                End If
                umbral = UmbralNuevoVR(vr, regla)
                If act >= umbral Then
                    celda.Interior.Color = RGB(255, 0, 0)
                    celda.AddComment "VR actual: " & vr & " casos. Casos actuales: " & act & _
                        IIf(miembros.Exists(clave), " (suma de las categorias juntadas)", "") & "." & vbLf & regla
                    nRojos = nRojos + 1
                End If
            End If
        Next c
        fila = fila + 1
    Next claveFila

    With ws.Range("S" & FILA_INICIO & ":AA" & fila - 1)
        .HorizontalAlignment = xlCenter
    End With
    With ws.Range("A" & FILA_INICIO & ":P" & fila - 1)
        .HorizontalAlignment = xlCenter
    End With

    Application.Calculation = calcPrev
    Application.ScreenUpdating = True
    MsgBox "Listo (" & miEquipo & "): " & filas.Count & " jugadores/puestos revisados, " & nRojos & _
           " categorias en rojo (ya alcanzan para un VR nuevo).", vbInformation
    Exit Sub

Fallo:
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    MsgBox "Error " & (Err.Number And &HFFFF&) & " al " & paso & ":" & vbLf & Err.Description, vbCritical
End Sub
