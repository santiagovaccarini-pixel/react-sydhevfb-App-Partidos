Option Explicit

' =====================================================================
' La sesión con Supabase para las macros del Excel.
'
' Desde el 30/09 la base no deja leer los partidos sin cuenta (la clave
' pública sola ya no alcanza). Las macros entran con la misma cuenta de la
' app (correo y contraseña) y ven solo lo de los clubes de esa cuenta.
'
'   - SB_Token(): el permiso para pedirle datos a la base. La primera vez
'     pide el correo y la contraseña; después sirve mientras el Excel esté
'     abierto (dura una hora y, si vence, vuelve a pedir la contraseña).
'     La contraseña no se guarda en ningún lado; el correo sí (para no
'     escribirlo cada vez).
'   - SB_ClubId(): el club de los datos. Con un solo club no pregunta; con
'     varios, pide elegir uno (una vez por sesión).
'   - SB_CerrarSesion(): para entrar con otra cuenta u otro club.
'
' En una macro que lee la base:
'   http.setRequestHeader "apikey", SB_ClavePublica()
'   http.setRequestHeader "Authorization", "Bearer " & SB_Token()
' y en la dirección, el club:  "&equipo_id=eq." & SB_ClubId()
' =====================================================================

Private Const BASE_URL As String = "https://gwzebinonoaaxtdkpqem.supabase.co"
Private Const BASE_CLAVE As String = "sb_publishable_Sj4GFkR23dsbe07y04-YRA_JlVDBPan"
Private Const NOMBRE_CORREO As String = "SB_Correo"

Private mToken As String
Private mVence As Date
Private mClubId As String

Public Function SB_Url() As String
    SB_Url = BASE_URL
End Function

Public Function SB_ClavePublica() As String
    SB_ClavePublica = BASE_CLAVE
End Function

Public Function SB_Token() As String
    If mToken <> "" And Now < mVence Then
        SB_Token = mToken
        Exit Function
    End If

    Dim correo As String, contrasena As String
    correo = InputBox("Correo de tu cuenta de la app:", "Entrar a la base", SB_CorreoGuardado())
    correo = Trim(correo)
    If correo = "" Then Err.Raise vbObjectError + 701, "Supabase", "Sin el correo no se puede entrar a la base."
    ' (Excel no puede ocultarla en este cuadro: se ve lo que se escribe.)
    contrasena = InputBox("Contraseña de " & correo & ":" & vbCrLf & vbCrLf & "Ojo: se ve lo que escribís.", "Entrar a la base")
    If contrasena = "" Then Err.Raise vbObjectError + 702, "Supabase", "Sin la contraseña no se puede entrar a la base."

    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setTimeouts 5000, 5000, 15000, 15000
    http.Open "POST", BASE_URL & "/auth/v1/token?grant_type=password", False
    http.setRequestHeader "apikey", BASE_CLAVE
    http.setRequestHeader "Content-Type", "application/json"
    http.send "{""email"":""" & SB_TextoJson(correo) & """,""password"":""" & SB_TextoJson(contrasena) & """}"
    contrasena = ""

    If http.Status <> 200 Then
        Err.Raise vbObjectError + 703, "Supabase", "No se pudo entrar a la base (HTTP " & http.Status & "). Revisá el correo y la contraseña: son los de la app."
    End If

    Dim token As String, segundos As Double
    token = SB_ValorJson(http.responseText, "access_token")
    If token = "" Then Err.Raise vbObjectError + 704, "Supabase", "La base no devolvió el permiso para entrar."
    segundos = Val(SB_ValorJson(http.responseText, "expires_in"))
    If segundos <= 0 Then segundos = 3600

    mToken = token
    ' Dos minutos antes de que venza, se vuelve a pedir.
    mVence = Now + (segundos - 120) / 86400#
    ' Con otra cuenta, el club se vuelve a elegir.
    If StrComp(correo, SB_CorreoGuardado(), vbTextCompare) <> 0 Then mClubId = ""
    SB_GuardarCorreo correo
    SB_Token = mToken
End Function

Public Function SB_ClubId() As String
    ' Primero la cuenta (si hay que volver a entrar, puede cambiar el club).
    Dim token As String
    token = SB_Token()
    If mClubId <> "" Then
        SB_ClubId = mClubId
        Exit Function
    End If

    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setTimeouts 5000, 5000, 15000, 15000
    ' Solo los clubes donde la cuenta sigue y tiene Partido: los demás no
    ' dejan leer sus partidos.
    http.Open "GET", BASE_URL & "/rest/v1/v_mis_clubes?select=id,nombre&partido=is.true&hasta=is.null&order=nombre.asc", False
    http.setRequestHeader "apikey", BASE_CLAVE
    http.setRequestHeader "Authorization", "Bearer " & token
    http.setRequestHeader "Accept", "application/json"
    http.send

    If http.Status < 200 Or http.Status >= 300 Then
        Err.Raise vbObjectError + 705, "Supabase", "No se pudieron leer los clubes de la cuenta (HTTP " & http.Status & ")."
    End If

    Dim ids As Collection, nombres As Collection
    Set ids = SB_TodosLosValores(http.responseText, "id")
    Set nombres = SB_TodosLosValores(http.responseText, "nombre")

    If ids.Count = 0 Then
        Err.Raise vbObjectError + 706, "Supabase", "La cuenta no tiene Partido en ningún club en el que siga activa."
    ElseIf ids.Count = 1 Then
        mClubId = ids(1)
    Else
        Dim lista As String, i As Long, elegido As String
        For i = 1 To ids.Count
            lista = lista & i & ". " & nombres(i) & vbCrLf
        Next i
        elegido = InputBox("¿De qué club son los datos?" & vbCrLf & vbCrLf & lista & vbCrLf & "Escribí el número:", "Elegir club", "1")
        If Not IsNumeric(elegido) Then Err.Raise vbObjectError + 707, "Supabase", "No se eligió el club."
        If CLng(elegido) < 1 Or CLng(elegido) > ids.Count Then Err.Raise vbObjectError + 707, "Supabase", "No se eligió el club."
        mClubId = ids(CLng(elegido))
    End If

    SB_ClubId = mClubId
End Function

Public Sub SB_CerrarSesion()
    mToken = ""
    mVence = 0
    mClubId = ""
    MsgBox "Listo: la próxima vez se vuelve a pedir la cuenta y el club.", vbInformation
End Sub

' ------------------------------------------------------------ Ayudas --

Private Function SB_CorreoGuardado() As String
    On Error Resume Next
    SB_CorreoGuardado = CStr(Evaluate(ThisWorkbook.Names(NOMBRE_CORREO).RefersTo))
    If Err.Number <> 0 Then SB_CorreoGuardado = ""
    On Error GoTo 0
End Function

Private Sub SB_GuardarCorreo(ByVal correo As String)
    On Error Resume Next
    ThisWorkbook.Names.Add Name:=NOMBRE_CORREO, RefersTo:="=""" & Replace(correo, """", """""") & """", Visible:=False
    On Error GoTo 0
End Sub

' Un texto dentro de un JSON: con \ y " escapados.
Private Function SB_TextoJson(ByVal texto As String) As String
    texto = Replace(texto, "\", "\\")
    texto = Replace(texto, """", "\""")
    SB_TextoJson = texto
End Function

' El valor de una clave (el primero que aparece): texto o número.
Private Function SB_ValorJson(ByVal json As String, ByVal clave As String) As String
    Dim valores As Collection
    Set valores = SB_TodosLosValores(json, clave)
    If valores.Count > 0 Then SB_ValorJson = valores(1) Else SB_ValorJson = ""
End Function

' Todos los valores de una clave, en orden (sirve para una lista de filas).
Private Function SB_TodosLosValores(ByVal json As String, ByVal clave As String) As Collection
    Dim valores As New Collection
    Dim buscado As String, pos As Long, i As Long, c As String, valor As String
    buscado = """" & clave & """:"
    pos = InStr(1, json, buscado, vbBinaryCompare)
    Do While pos > 0
        i = pos + Len(buscado)
        Do While Mid$(json, i, 1) = " "
            i = i + 1
        Loop
        valor = ""
        If Mid$(json, i, 1) = """" Then
            i = i + 1
            Do While i <= Len(json)
                c = Mid$(json, i, 1)
                If c = "\" Then
                    valor = valor & SB_Escapado(json, i)
                ElseIf c = """" Then
                    Exit Do
                Else
                    valor = valor & c
                End If
                i = i + 1
            Loop
        Else
            Do While i <= Len(json)
                c = Mid$(json, i, 1)
                If c = "," Or c = "}" Or c = "]" Then Exit Do
                valor = valor & c
                i = i + 1
            Loop
            valor = Trim(valor)
            If valor = "null" Then valor = ""
        End If
        valores.Add valor
        pos = InStr(i, json, buscado, vbBinaryCompare)
    Loop
    Set SB_TodosLosValores = valores
End Function

' Un carácter escapado (\" \\ \/ \n \t \uXXXX). Deja i en el último carácter usado.
Private Function SB_Escapado(ByVal json As String, ByRef i As Long) As String
    Dim siguiente As String
    siguiente = Mid$(json, i + 1, 1)
    Select Case siguiente
        Case "n": SB_Escapado = vbLf
        Case "t": SB_Escapado = vbTab
        Case "r": SB_Escapado = vbCr
        Case "u"
            SB_Escapado = ChrW$(CLng("&H" & Mid$(json, i + 2, 4)))
            i = i + 4
        Case Else: SB_Escapado = siguiente
    End Select
    i = i + 1
End Function
