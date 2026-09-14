# Pendientes

Lo que quedó pedido y todavía no está hecho. El orden es de más a menos valor,
no el orden en que se pidió.

## Sobre el filtro de Registros

Salió en el PR #99, y quedaron tres cosas para la próxima vuelta.

- **Que el filtro esté también en Equipo.** Hoy el botón redondo aparece solo en
  la vista de Jugador, con un jugador abierto, porque filtra *sus* partidos. En
  Equipo hay que decidir por qué se filtra: rival, resultado (ganados, empatados,
  perdidos), fecha (desde / hasta), o si el partido está sin sincronizar. Nada de
  eso está definido todavía.

- **Cambiar los nombres del filtro.** Los de ahora son "Todos los partidos",
  "Titular", "Ingresó", "No ingresó" y "Minutos jugados", y los comparadores
  "Más de", "Al menos", "Menos de", "Como mucho" y "Entre". Falta saber cuáles
  molestan y cómo tendrían que decir.

- **Un botón para borrar los filtros.** Hoy para volver a ver todo hay que abrir
  el panel y elegir "Todos los partidos" a mano. Conviene que quede claro si
  borra todo de una o solo el filtro activo, y dónde va: dentro del panel, o
  manteniendo apretado el botón redondo.

## De la lista de mejoras de la app

- **Sacar los cortes de la app.** Un botón que copie la línea de tiempo del
  partido para pegarla en la consola de OpenField, en vez de retipear los
  horarios uno por uno. Es lo de mayor valor de toda la lista.

- **Guardar el partido en curso en la base.** Hoy lo que se está cargando vive
  solo en ese teléfono: si se muere la batería a mitad de partido, se pierde, y
  no se puede seguir desde otro aparato.

- **Chicos.** Avisar antes de pisar un partido que ya existe con la misma fecha y
  rival; deshacer el último corte; y "Borrar historial", que hoy está a dos
  toques de distancia sin mucha barrera.

## Limitaciones conocidas, que no son deudas

- Un partido guardado **sin formación cargada** no puede decir quién fue titular.
  En la vista de jugador aparece solo si el nombre figura en algún cambio. No es
  algo que se pueda arreglar: no está guardado.

- Los minutos de la vista de jugador van **en bruto** (reloj corrido), igual que
  como abre la ficha. Si alguna vez se quieren en neto —descontando VAR e
  hidratación— el dato ya se calcula, solo falta decidir cómo se elige.
