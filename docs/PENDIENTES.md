# Pendientes

Lo que quedó pedido y todavía no está hecho. El orden es de más a menos valor,
no el orden en que se pidió. Lo que se va haciendo se borra de acá: el historial
de lo hecho está en los commits, no en esta lista.

## De la lista de mejoras de la app

- **Mandar los cortes solos a OpenField.** No es un botón de copiar: la idea es
  que los cortes del partido se escriban en OpenField sin retipear nada, igual
  que lo que se está armando en Entrenamiento. Se trabaja en otro lado (18/09);
  acá queda anotado para no duplicarlo. Falta definir qué es un período —los
  cortes del partido, cada jugador con sus minutos, o las dos cosas— porque eso
  decide el traductor de partido a períodos.

- **Guardar el partido en curso en la base.** Hoy lo que se está cargando vive
  solo en ese teléfono: si se muere la batería a mitad de partido, se pierde, y
  no se puede seguir desde otro aparato.

- **Chicos.** Avisar antes de pisar un partido que ya existe con la misma fecha y
  rival; deshacer el último corte; y "Borrar historial", que hoy está a dos
  toques de distancia sin mucha barrera.

## Anotadas para más adelante

- **Partir la descarga de la app.** Hoy Partido y Entrenamiento vienen en un
  solo paquete: abrir la app para un partido se baja también todo el módulo de
  Entrenamiento. Medido el 18/09 con `React.lazy` en `PortalApp.jsx`: son 14 kB
  comprimidos, un 8%, así que hoy no se justifica. Conviene hacerlo cuando
  Entrenamiento crezca, o si la app empieza a tardar en abrir. Son unas diez
  líneas y no se vuelve más difícil por esperar. De paso aísla las fallas: hoy
  un error de Entrenamiento se lleva puesta la pantalla de partido.

## Esperando una decisión tuya

- **La app no tiene inicio de sesión.** Quien consiga la URL puede leer o tocar
  los partidos: las políticas de la base permiten todo al rol anónimo. Viene de
  la auditoría del 8 de septiembre y sigue igual. Para cerrarlo hace falta
  decidir quiénes entran —los correos o el criterio— antes de poner Supabase
  Auth y políticas RLS; una política genérica podría dejarte afuera a vos mismo.
  El detalle está en `AUDITORIA_2026-09-08.md`.

## Chicas del filtro

- **Los nombres del filtro de jugador.** Siguen siendo "Titular", "Ingresó",
  "No ingresó" y "Minutos jugados", con los comparadores "Más de", "Al menos",
  "Menos de", "Como mucho" y "Entre". En su momento quedó pedido cambiarlos,
  pero nunca se dijo cuáles molestan ni cómo tendrían que decir. Los del filtro
  de equipo sí se revisaron.

- **Local / visitante / neutral dentro del filtro.** Es el único criterio que
  quedó como tres botones lado a lado en vez de subir la hoja, porque son tres
  opciones y así se eligen de un toque. Quedó pendiente confirmar si va así o si
  tiene que ser una hoja como el resto.

## Limitaciones conocidas, que no son deudas

- Un partido guardado **sin formación cargada** no puede decir quién fue titular.
  En la vista de jugador aparece solo si el nombre figura en algún cambio. No es
  algo que se pueda arreglar: no está guardado.

- Los minutos de la vista de jugador van **en bruto** (reloj corrido), igual que
  como abre la ficha. Si alguna vez se quieren en neto —descontando VAR e
  hidratación— el dato ya se calcula, solo falta decidir cómo se elige.

- Con los **penales a la vista**, en pantallas de 320 px el nombre del equipo se
  recorta en el marcador. Ya se recortaba antes de que existieran los penales: a
  ese ancho no entra "Atlético Mineiro" entero.

- El **icono de la app** lo cachea el sistema, no el service worker. Cambiarlo en
  el repo no alcanza para que cambie en un teléfono donde la app ya está
  instalada: hay que desinstalarla y volver a agregarla a la pantalla de inicio.
