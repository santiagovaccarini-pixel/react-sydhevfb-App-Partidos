Option Explicit

Sub Traer_Partido_Desde_Supabase()

    On Error GoTo ManejarError

    Dim ws As Worksheet
    Dim fechaExcel As Variant, fechaSupabase As String
    Dim url As String, apiKey As String, endpoint As String
    Dim http As Object, respuesta As String
    
    Dim tiempoPT As Variant, tiempoST As Variant
    Dim finalPT As String, inicioPT As String
    Dim inicioST As String, finalST As String
    Dim jugadorFila As String, jugadorSale As String, jugadorEntra As String
    Dim horaCambio As Variant
    Dim filaJugador As Long, filaCambio As Long
    Dim tiempoJugadorST As Variant
    
    Set ws = ThisWorkbook.Sheets("Plantilla")
    
    url = "https://gwzebinonoaaxtdkpqem.supabase.co"
    apiKey = "sb_publishable_Sj4GFkR23dsbe07y04-YRA_JlVDBPan"
    
    fechaExcel = ws.Range("DJ101").Text
    
    If Trim(CStr(fechaExcel)) = "" Then
        MsgBox "Primero cargá la fecha en DJ101.", vbExclamation
        Exit Sub
    End If
    
    fechaSupabase = ConvertirFechaSupabase(fechaExcel)
    
    If fechaSupabase = "" Then
        MsgBox "La fecha de DJ101 no tiene formato válido. Usá DD/MM/YYYY.", vbCritical
        Exit Sub
    End If
    
    endpoint = url & "/rest/v1/registros_partido?fecha=eq." & fechaSupabase & _
               "&select=*&order=created_at.desc&limit=1"
    
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setTimeouts 5000, 5000, 10000, 10000
    http.Open "GET", endpoint, False
    http.setRequestHeader "apikey", apiKey
    http.setRequestHeader "Authorization", "Bearer " & apiKey
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "Accept", "application/json"
    http.Send
    
    If http.Status < 200 Or http.Status >= 300 Then
        MsgBox "Error consultando Supabase:" & vbCrLf & http.responseText, vbCritical
        Exit Sub
    End If
    
    respuesta = http.responseText
    
    If respuesta = "[]" Then
        MsgBox "No se encontró ningún registro para la fecha " & fechaSupabase, vbExclamation
        Exit Sub
    End If
    
    Application.ScreenUpdating = False
    
    ws.Range("DO105").Value = JsonValor(respuesta, "inicio_pt")
    ws.Range("DP105").Value = JsonValor(respuesta, "inicio_st")
    ws.Range("DJ109").Value = JsonValor(respuesta, "torneo")
    
    ws.Range("DQ106").Value = JsonValor(respuesta, "inicio_var_pt_1")
    ws.Range("DR106").Value = JsonValor(respuesta, "final_var_pt_1")
    ws.Range("DS106").Value = JsonValor(respuesta, "inicio_var_st_1")
    ws.Range("DT106").Value = JsonValor(respuesta, "final_var_st_1")
    
    ws.Range("DV106").Value = JsonValor(respuesta, "inicio_var_pt_2")
    ws.Range("DW106").Value = JsonValor(respuesta, "final_var_pt_2")
    ws.Range("DX106").Value = JsonValor(respuesta, "inicio_var_st_2")
    ws.Range("DY106").Value = JsonValor(respuesta, "final_var_st_2")
    
    ws.Range("DV110").Value = JsonValor(respuesta, "inicio_var_pt_3")
    ws.Range("DW110").Value = JsonValor(respuesta, "final_var_pt_3")
    ws.Range("DX110").Value = JsonValor(respuesta, "inicio_var_st_3")
    ws.Range("DY110").Value = JsonValor(respuesta, "final_var_st_3")
    
    ws.Range("DQ107").Value = JsonValor(respuesta, "inicio_hid_pt")
    ws.Range("DR107").Value = JsonValor(respuesta, "final_hid_pt")
    ws.Range("DS107").Value = JsonValor(respuesta, "inicio_hid_st")
    ws.Range("DT107").Value = JsonValor(respuesta, "final_hid_st")
    
    For filaCambio = 1 To 5
        ws.Range("DI" & 119 + filaCambio).Value = JsonValor(respuesta, "cambio_" & filaCambio & "_sale")
        ws.Range("DJ" & 119 + filaCambio).Value = JsonValor(respuesta, "cambio_" & filaCambio & "_entra")
        ws.Range("DM" & 119 + filaCambio).Value = JsonValor(respuesta, "cambio_" & filaCambio & "_tiempo")
    Next filaCambio
    
    inicioPT = JsonValor(respuesta, "inicio_pt")
    finalPT = JsonValor(respuesta, "final_pt")
    tiempoPT = CalcularDuracionHoras(inicioPT, finalPT)
    
    ' =========================
    ' TIEMPO PT MINEIRO - EC3:EC17
    ' =========================
    Dim nroCambioPT As Long
    
    For filaJugador = 3 To 17
    
        jugadorFila = Trim(CStr(ws.Range("DI" & filaJugador).Value))
        tiempoJugadorST = ""
    
        If jugadorFila <> "" Then
    
            For nroCambioPT = 1 To 5
    
                jugadorSale = Trim(CStr(JsonValor(respuesta, "cambio_" & nroCambioPT & "_sale")))
                jugadorEntra = Trim(CStr(JsonValor(respuesta, "cambio_" & nroCambioPT & "_entra")))
                horaCambio = JsonValor(respuesta, "cambio_" & nroCambioPT & "_tiempo")
    
                If Trim(CStr(horaCambio)) <> "" Then
    
                    If NombresIguales(jugadorFila, jugadorSale) Then
                        If HoraMenor(horaCambio, finalPT) Then
                            tiempoJugadorST = CalcularDuracionHoras(inicioPT, CStr(horaCambio))
                        Else
                            tiempoJugadorST = tiempoPT
                        End If
                        Exit For
                    End If
    
                    If NombresIguales(jugadorFila, jugadorEntra) Then
                        If HoraMenor(horaCambio, finalPT) Then
                            tiempoJugadorST = CalcularDuracionHoras(CStr(horaCambio), finalPT)
                        Else
                            tiempoJugadorST = tiempoPT
                        End If
                        Exit For
                    End If
    
                End If
    
            Next nroCambioPT
    
            If tiempoJugadorST = "" Then tiempoJugadorST = tiempoPT
            ws.Range("EC" & filaJugador).Value = tiempoJugadorST
    
        Else
            ws.Range("EC" & filaJugador).ClearContents
        End If
    
    Next filaJugador
    
    inicioST = JsonValor(respuesta, "inicio_st")
    finalST = JsonValor(respuesta, "final_st")
    tiempoST = CalcularDuracionHoras(inicioST, finalST)
    
    ' =========================
    ' TIEMPO ST MINEIRO - EC19:EC33
    ' =========================
    ' El ST se calcula SIEMPRE dentro del intervalo inicioST-finalST.
    ' Un cambio ocurrido en PT nunca se resta contra finalST: así el
    ' entretiempo no puede sumarse a los minutos del jugador.
    '
    ' Se recorren todos los cambios para cubrir también:
    ' entra en PT -> juega ST -> sale durante ST.
    Dim nroCambio As Long
    Dim inicioJugadorST As String
    Dim finalJugadorST As String
    Dim salioAntesST As Boolean

    For filaJugador = 19 To 33

        jugadorFila = Trim(CStr(ws.Range("DI" & filaJugador).Value))
        tiempoJugadorST = ""

        If jugadorFila <> "" Then

            inicioJugadorST = inicioST
            finalJugadorST = finalST
            salioAntesST = False

            For nroCambio = 1 To 5

                jugadorSale = Trim(CStr(JsonValor(respuesta, "cambio_" & nroCambio & "_sale")))
                jugadorEntra = Trim(CStr(JsonValor(respuesta, "cambio_" & nroCambio & "_entra")))
                horaCambio = JsonValor(respuesta, "cambio_" & nroCambio & "_tiempo")

                If Trim(CStr(horaCambio)) <> "" Then

                    ' Si entró en PT, al comenzar ST ya estaba en cancha:
                    ' inicioJugadorST se mantiene en inicioST.
                    If NombresIguales(jugadorFila, jugadorEntra) Then
                        If Not HoraMenor(horaCambio, inicioST) Then
                            If Not HoraMenor(finalST, horaCambio) Then
                                inicioJugadorST = CStr(horaCambio)
                            End If
                        End If
                    End If

                    ' Si sale durante ST, el tiempo termina en esa hora.
                    ' Si salió antes del ST, no jugó el segundo tiempo.
                    If NombresIguales(jugadorFila, jugadorSale) Then
                        If HoraMenor(horaCambio, inicioST) Then
                            salioAntesST = True
                        ElseIf Not HoraMenor(finalST, horaCambio) Then
                            finalJugadorST = CStr(horaCambio)
                        End If
                    End If

                End If

            Next nroCambio

            If salioAntesST Then
                tiempoJugadorST = "00:00:00"
            ElseIf HoraMenor(finalJugadorST, inicioJugadorST) Then
                ' Protección ante datos incoherentes: no crear 23+ horas.
                tiempoJugadorST = ""
            Else
                tiempoJugadorST = CalcularDuracionHoras(inicioJugadorST, finalJugadorST)
            End If

            ws.Range("EC" & filaJugador).Value = tiempoJugadorST

        Else
            ws.Range("EC" & filaJugador).ClearContents
        End If

    Next filaJugador

    ' =========================
    ' CAMBIOS RIVAL - NO SOBRESCRIBE SI YA HAY NOMBRE/HORA
    ' =========================
    Dim nroCambioRival As Long
    Dim filaRival As Long
    
    For nroCambioRival = 1 To 5
    
        filaRival = 119 + nroCambioRival
    
        If Trim(CStr(ws.Range("DO" & filaRival).Value)) = "" Then
            ws.Range("DO" & filaRival).Value = JsonValor(respuesta, "rival_cambio_sale" & nroCambioRival)
        End If
    
        If Trim(CStr(ws.Range("DP" & filaRival).Value)) = "" Then
            ws.Range("DP" & filaRival).Value = JsonValor(respuesta, "rival_cambio_entra" & nroCambioRival)
        End If
    
        If Trim(CStr(ws.Range("DS" & filaRival).Value)) = "" Then
            ws.Range("DS" & filaRival).Value = JsonValor(respuesta, "rival_cambio_horario" & nroCambioRival)
        End If
    
    Next nroCambioRival
    
    ' =========================
    ' TIEMPO PT RIVAL - EC51:EC65
    ' =========================
    Dim nroCambioRivalPT As Long
    
    For filaJugador = 51 To 65
    
        jugadorFila = Trim(CStr(ws.Range("DI" & filaJugador).Value))
        tiempoJugadorST = ""
    
        If jugadorFila <> "" Then
    
            For nroCambioRivalPT = 120 To 124
    
                jugadorSale = Trim(CStr(ws.Range("DO" & nroCambioRivalPT).Value))
                jugadorEntra = Trim(CStr(ws.Range("DP" & nroCambioRivalPT).Value))
                horaCambio = ws.Range("DS" & nroCambioRivalPT).Value
    
                If Trim(CStr(horaCambio)) <> "" Then
    
                    If NombresIguales(jugadorFila, jugadorSale) Then
                        If HoraMenor(horaCambio, finalPT) Then
                            tiempoJugadorST = CalcularDuracionHoras(inicioPT, CStr(horaCambio))
                        Else
                            tiempoJugadorST = tiempoPT
                        End If
                        Exit For
                    End If
    
                    If NombresIguales(jugadorFila, jugadorEntra) Then
                        If HoraMenor(horaCambio, finalPT) Then
                            tiempoJugadorST = CalcularDuracionHoras(CStr(horaCambio), finalPT)
                        Else
                            tiempoJugadorST = tiempoPT
                        End If
                        Exit For
                    End If
    
                End If
    
            Next nroCambioRivalPT
    
            If tiempoJugadorST = "" Then tiempoJugadorST = tiempoPT
            ws.Range("EC" & filaJugador).Value = tiempoJugadorST
    
        Else
            ws.Range("EC" & filaJugador).ClearContents
        End If
    
    Next filaJugador
    
    ' =========================
    ' TIEMPO ST RIVAL - EC67:EC81
    ' =========================
    Dim nroCambioRivalST As Long
    
    For filaJugador = 67 To 81
    
        jugadorFila = Trim(CStr(ws.Range("DI" & filaJugador).Value))
        tiempoJugadorST = ""
    
        If jugadorFila <> "" Then
    
            For nroCambioRivalST = 120 To 124
    
                jugadorSale = Trim(CStr(ws.Range("DO" & nroCambioRivalST).Value))
                jugadorEntra = Trim(CStr(ws.Range("DP" & nroCambioRivalST).Value))
                horaCambio = ws.Range("DS" & nroCambioRivalST).Value
    
                If Trim(CStr(horaCambio)) <> "" Then
    
                    If NombresIguales(jugadorFila, jugadorSale) Then
    If HoraMenor(horaCambio, inicioST) Then
        tiempoJugadorST = tiempoST
    Else
        tiempoJugadorST = CalcularDuracionHoras(inicioST, CStr(horaCambio))
    End If
    Exit For
End If
    
                    If NombresIguales(jugadorFila, jugadorEntra) Then
    If HoraMenor(horaCambio, inicioST) Then
        tiempoJugadorST = tiempoST
    Else
        tiempoJugadorST = CalcularDuracionHoras(CStr(horaCambio), finalST)
    End If
    Exit For
End If
    
                End If
    
            Next nroCambioRivalST
    
            If tiempoJugadorST = "" Then tiempoJugadorST = tiempoST
            ws.Range("EC" & filaJugador).Value = tiempoJugadorST
    
        Else
            ws.Range("EC" & filaJugador).ClearContents
        End If
    
    Next filaJugador
    
    ws.Range("EC3:EC17").NumberFormat = "[h]:mm:ss"
    ws.Range("EC19:EC33").NumberFormat = "[h]:mm:ss"
    ws.Range("EC51:EC65").NumberFormat = "[h]:mm:ss"
    ws.Range("EC67:EC81").NumberFormat = "[h]:mm:ss"
    
    Application.ScreenUpdating = True
    
    MsgBox "Datos importados correctamente desde Supabase.", vbInformation

    Exit Sub

ManejarError:
    Application.ScreenUpdating = True
    MsgBox "No se pudo importar el partido." & vbCrLf & _
           "Error " & Err.Number & ": " & Err.Description, vbCritical

End Sub

Function ConvertirFechaSupabase(ByVal valorFecha As Variant) As String
    On Error GoTo ErrorFecha
    
    Dim d As Date
    
    If IsDate(valorFecha) Then
        d = CDate(valorFecha)
        ConvertirFechaSupabase = Format(d, "yyyy-mm-dd")
        Exit Function
    End If
    
    ConvertirFechaSupabase = ""
    Exit Function
    
ErrorFecha:
    ConvertirFechaSupabase = ""
End Function
Function JsonValor(ByVal json As String, ByVal campo As String) As String
    Dim regex As Object
    Dim matches As Object
    Dim patron As String
    Dim valor As String
    
    Set regex = CreateObject("VBScript.RegExp")
    
    patron = """" & campo & """:\s*(null|""""|""([^""]*)""|[-0-9.]+|true|false)"
    
    With regex
        .Global = False
        .IgnoreCase = False
        .Pattern = patron
    End With
    
    If regex.Test(json) Then
        Set matches = regex.Execute(json)
        valor = matches(0).SubMatches(0)
        
        If valor = "null" Or valor = """""" Then
            JsonValor = ""
        Else
            valor = Replace(valor, """", "")
            valor = Replace(valor, "\/", "/")
            valor = Replace(valor, "\u00e1", "á")
            valor = Replace(valor, "\u00e9", "é")
            valor = Replace(valor, "\u00ed", "í")
            valor = Replace(valor, "\u00f3", "ó")
            valor = Replace(valor, "\u00fa", "ú")
            valor = Replace(valor, "\u00c1", "Á")
            valor = Replace(valor, "\u00c9", "É")
            valor = Replace(valor, "\u00cd", "Í")
            valor = Replace(valor, "\u00d3", "Ó")
            valor = Replace(valor, "\u00da", "Ú")
            valor = Replace(valor, "\u00f1", "ñ")
            valor = Replace(valor, "\u00d1", "Ñ")
            JsonValor = valor
        End If
    Else
        JsonValor = ""
    End If
End Function

Function CalcularDuracionHoras(ByVal horaInicio As String, ByVal horaFinal As String) As Variant

    On Error GoTo ErrorDuracion

    Dim tInicio As Date
    Dim tFinal As Date
    Dim diferencia As Double

    If Trim(horaInicio) = "" Or Trim(horaFinal) = "" Then
        CalcularDuracionHoras = ""
        Exit Function
    End If

    tInicio = CDate(horaInicio)
    tFinal = CDate(horaFinal)

    If tFinal < tInicio Then
        tFinal = tFinal + 1
    End If

    diferencia = tFinal - tInicio

    If diferencia < 0 Or diferencia > (4# / 24#) Then
        CalcularDuracionHoras = ""
        Exit Function
    End If

    ' Devuelve un valor temporal real; el formato visible se aplica en la hoja.
    CalcularDuracionHoras = diferencia

    Exit Function

ErrorDuracion:
    CalcularDuracionHoras = ""

End Function

Function HoraMenor(ByVal hora1 As Variant, ByVal hora2 As Variant) As Boolean

    On Error GoTo ErrorHora

    Dim valor1 As Double
    Dim valor2 As Double

    If Trim(CStr(hora1)) = "" Or Trim(CStr(hora2)) = "" Then
        HoraMenor = False
        Exit Function
    End If

    valor1 = CDbl(TimeValue(CStr(hora1)))
    valor2 = CDbl(TimeValue(CStr(hora2)))

    ' Si la distancia supera 12 horas, se trata del cruce de medianoche.
    ' Los eventos válidos de un partido nunca están separados por medio día.
    If valor2 - valor1 < -0.5 Then
        valor2 = valor2 + 1
    ElseIf valor2 - valor1 > 0.5 Then
        valor1 = valor1 + 1
    End If

    HoraMenor = valor1 < valor2
    Exit Function

ErrorHora:
    HoraMenor = False

End Function

Function NombresIguales(ByVal nombre1 As String, ByVal nombre2 As String) As Boolean
    NombresIguales = (NormalizarJugador(nombre1) = NormalizarJugador(nombre2))
End Function

Function NormalizarJugador(ByVal nombre As String) As String
    Dim valor As String

    valor = UCase(Trim(nombre))
    valor = Replace(valor, "Á", "A")
    valor = Replace(valor, "É", "E")
    valor = Replace(valor, "Í", "I")
    valor = Replace(valor, "Ó", "O")
    valor = Replace(valor, "Ú", "U")
    valor = WorksheetFunction.Trim(valor)

    Select Case valor
        Case "ALAN MINDA", "A. MINDA": valor = "A MINDA"
        Case "ANGELO PRECIADO", "A. PRECIADO": valor = "A PRECIADO"
        Case "JUNIOR ALONSO": valor = "ALONSO"
        Case "GUSTAVO SCARPA": valor = "SCARPA"
        Case "TOMAS CUELLO": valor = "CUELLO"
        Case "IVAN ROMAN": valor = "I ROMAN"
        Case "MATEUS ISEPPE": valor = "M ISEPPE"
        Case "MATEO CASSIERRA": valor = "M CASSIERRA"
        Case "TOMAS PEREZ": valor = "T PEREZ"
        Case "VITOR HUGO": valor = "V HUGO"
    End Select

    NormalizarJugador = valor
End Function
