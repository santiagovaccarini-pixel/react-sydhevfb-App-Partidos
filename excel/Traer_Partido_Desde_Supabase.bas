Sub Traer_Partido_Desde_Supabase()

    Dim ws As Worksheet
    Dim fechaExcel As Variant, fechaSupabase As String
    Dim url As String, apiKey As String, endpoint As String
    Dim http As Object, respuesta As String
    
    Dim tiempoPT As String, finalPT As String, inicioPT As String
    Dim inicioST As String, finalST As String, tiempoST As String
    Dim jugadorFila As String, jugadorSale As String, jugadorEntra As String
    Dim horaCambio As Variant
    Dim filaJugador As Long, filaCambio As Long
    Dim tiempoJugadorST As String
    
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
    
    endpoint = url & "/rest/v1/registros_partido?fecha=eq." & fechaSupabase & "&select=*&limit=1"
    
    Set http = CreateObject("MSXML2.XMLHTTP")
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
    
                    If jugadorFila = jugadorSale Then
                        If HoraMenor(horaCambio, finalPT) Then
                            tiempoJugadorST = CalcularDuracionHoras(inicioPT, CStr(horaCambio))
                        Else
                            tiempoJugadorST = tiempoPT
                        End If
                        Exit For
                    End If
    
                    If jugadorFila = jugadorEntra Then
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
                    If jugadorFila = jugadorEntra Then
                        If Not HoraMenor(horaCambio, inicioST) Then
                            If Not HoraMenor(finalST, horaCambio) Then
                                inicioJugadorST = CStr(horaCambio)
                            End If
                        End If
                    End If

                    ' Si sale durante ST, el tiempo termina en esa hora.
                    ' Si salió antes del ST, no jugó el segundo tiempo.
                    If jugadorFila = jugadorSale Then
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
    
                    If jugadorFila = jugadorSale Then
                        If HoraMenor(horaCambio, finalPT) Then
                            tiempoJugadorST = CalcularDuracionHoras(inicioPT, CStr(horaCambio))
                        Else
                            tiempoJugadorST = tiempoPT
                        End If
                        Exit For
                    End If
    
                    If jugadorFila = jugadorEntra Then
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
    
                    If jugadorFila = jugadorSale Then
    If HoraMenor(horaCambio, inicioST) Then
        tiempoJugadorST = tiempoST
    Else
        tiempoJugadorST = CalcularDuracionHoras(inicioST, CStr(horaCambio))
    End If
    Exit For
End If
    
                    If jugadorFila = jugadorEntra Then
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
    
    ws.Range("EC3:EC17").NumberFormat = "hh:mm:ss"
    ws.Range("EC19:EC33").NumberFormat = "hh:mm:ss"
    ws.Range("EC51:EC65").NumberFormat = "hh:mm:ss"
    ws.Range("EC67:EC81").NumberFormat = "hh:mm:ss"
    
    Application.ScreenUpdating = True
    
    MsgBox "Datos importados correctamente desde Supabase.", vbInformation

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

Function CalcularDuracionHoras(ByVal horaInicio As String, ByVal horaFinal As String) As String

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

    CalcularDuracionHoras = Format(diferencia, "hh:mm:ss")

    Exit Function

ErrorDuracion:
    CalcularDuracionHoras = ""

End Function

Function HoraMenor(ByVal hora1 As Variant, ByVal hora2 As Variant) As Boolean

    On Error GoTo ErrorHora

    If Trim(CStr(hora1)) = "" Or Trim(CStr(hora2)) = "" Then
        HoraMenor = False
        Exit Function
    End If

    HoraMenor = CDate(hora1) < CDate(hora2)
    Exit Function

ErrorHora:
    HoraMenor = False

End Function
Public Sub Probar_Primer_Boton_Crear_Copia()

    Const NOMBRE_PLANTILLA As String = "Plantilla GPS Partido_CAM_Final.xlsm"
    Const MACRO_PRIMER_BOTON As String = "EliminarGoalkeepers"

    Dim wbPlantilla As Workbook
    Dim nombreAntes As String
    Dim nombreDespues As String
    Dim rutaDespues As String

    On Error GoTo ManejarError

    On Error Resume Next
    Set wbPlantilla = Workbooks(NOMBRE_PLANTILLA)
    On Error GoTo ManejarError

    If wbPlantilla Is Nothing Then
        MsgBox "No está abierto el archivo:" & vbCrLf & _
               NOMBRE_PLANTILLA, vbCritical
        Exit Sub
    End If

    nombreAntes = wbPlantilla.Name

    Application.Run "'" & nombreAntes & "'!" & MACRO_PRIMER_BOTON

    'El mismo objeto Workbook debería quedar renombrado por Guardar como
    nombreDespues = wbPlantilla.Name
    rutaDespues = wbPlantilla.FullName

    If StrComp(nombreAntes, nombreDespues, vbTextCompare) = 0 Then
        MsgBox "La macro se ejecutó, pero el archivo no cambió de nombre." & _
               vbCrLf & vbCrLf & _
               "Archivo actual: " & nombreDespues, vbExclamation
        Exit Sub
    End If

    MsgBox "La copia se generó correctamente." & vbCrLf & vbCrLf & _
           "Antes: " & nombreAntes & vbCrLf & _
           "Ahora: " & nombreDespues & vbCrLf & vbCrLf & _
           "Ruta:" & vbCrLf & rutaDespues, vbInformation

    Exit Sub

ManejarError:

    MsgBox "Error al ejecutar el primer botón." & vbCrLf & vbCrLf & _
           "Número: " & Err.Number & vbCrLf & _
           "Descripción: " & Err.Description, vbCritical

End Sub
