# Registro Partido

Aplicación operativa para registrar períodos, VAR, hidrataciones, formaciones y
cambios de Atlético Mineiro y su rival. Funciona en escritorio y celular y
mantiene un borrador local mientras sincroniza el partido con Supabase.

## Instrucciones para trabajar en el proyecto

- [CLAUDE.md](CLAUDE.md): alcance, protección de funcionalidad y formato obligatorio
  para explicar cambios en lenguaje simple.
- [Sistema de diseño](docs/DESIGN_SYSTEM.md): criterios visuales, mobile-first y
  reutilización de componentes.
- [Decisiones de interfaz](docs/UI_DECISIONS.md): índice de decisiones cerradas y
  cómo registrar descartes sin duplicar la documentación existente.
- [Pendientes y acuerdos del producto](docs/PENDIENTES.md): conservar sus decisiones;
  los pendientes no autorizan cambios fuera del pedido.

## Desarrollo

Requiere Node.js 22.12 o superior (la versión recomendada está en `.nvmrc`).

```bash
npm install
npm run dev
```

Comandos de verificación:

```bash
npm test
npm run build
npm audit
```

## Configuración

La app conserva valores publishable compatibles con la instalación actual. Para
otro proyecto, copiá `.env.example` como `.env.local` y completá:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Las migraciones de `supabase/migrations/` se corren a mano en Supabase › SQL
Editor, cada una una sola vez. Sobre una base que ya está andando se corren
**solo las que faltan**, nunca todas de nuevo: las viejas desharían cambios
posteriores (por eso se niegan con «Ya está corrida…»). Todas en orden, solo en
una base vacía. Primero se corre el SQL y después se publica la app (ver
«Orden para publicar»). La migración del 8 de septiembre agrega la captura del
modo Transmisión y crea el índice de partido único sólo si no existen duplicados.
La del 20 de septiembre crea `catapult_cuentas` (cuenta de Catapult OpenField
por usuario, con contraseña y pase cifrados) y necesita en Vercel la variable
`CATAPULT_SESSION_KEY` (una frase de al menos 32 caracteres, Production y Preview).
La segunda del 20 de septiembre (`20260920_jugadores_catapult.sql`) agrega a
`jugadores` el vínculo con el atleta de Catapult; Partido no la necesita, Entrenamiento sí.
La del 30 de septiembre (`20260930_cuentas.sql`) crea `perfiles`: quién entra a la
app y qué puede usar. Antes de correrla hay que completar sus dos líneas de
"Semilla" (el correo del administrador y los correos que hasta entonces estaban
en `OPENFIELD_ALLOWED_EMAILS`); la app con esta versión no funciona sin ella.
La segunda del 30 de septiembre (`20260930_partido_solo_autorizados.sql`) cierra
las tablas de Partido a cuentas autorizadas y le saca todo al rol anon; ya está
aplicada en producción. Si alguna vez hiciera falta volver atrás,
`20260930_partido_abierto_de_nuevo.sql` las deja abiertas como antes.

En Supabase › Authentication hay que tener "Confirm email" y "Secure email
change" prendidos (Providers › Email): todo el modelo de cuentas descansa en que
tener el buzón es ser esa cuenta. En URL Configuration, el Site URL de producción y
`https://react-sydhevfb-app-partidos.vercel.app/**` en Redirect URLs, para que
el correo de "Olvidé mi contraseña" vuelva a la app.

Variables del servidor (Vercel › Settings › Environment Variables, Production y
Preview; solo los nombres): `OPENFIELD_API_BASE_URL`, `OPENFIELD_API_TOKEN`,
`CATAPULT_SESSION_KEY` y `OPENFIELD_SESSION_SECRET` (una frase al azar de al menos
32 caracteres, con la que se firma la sesión de OpenField; mientras no esté, la
firma se deriva del token de Catapult como antes). `OPENFIELD_ALLOWED_EMAILS` ya
no se usa: se puede borrar.

## Seguridad

La clave publishable puede estar en el navegador: no es una clave administrativa.
La protección efectiva de las filas depende de Supabase Auth y Row Level Security.

Se entra con correo y contraseña antes del portal. Cada cuenta tiene una fila en
`perfiles` (pendiente, autorizada o bloqueada). Nadie aprueba cuentas para toda
la app: a cada club se entra porque ese club te deja.

- **Por invitación.** El administrador de un club invita un correo (siempre como
  staff, con los módulos que elija). Al registrarse y confirmar ese correo, la
  cuenta queda autorizada y adentro del club; si ya tenía cuenta, entra en el acto.
- **Sin invitación.** La cuenta nueva escribe a qué club quiere entrar (nombre y
  país), manda el pedido y espera. Lo acepta (eligiendo los módulos) o lo rechaza
  el administrador de ese club, desde Cuentas. Si el nombre no coincide con ningún
  club de la app, o el club todavía no tiene administrador (o se quedó sin él), el
  pedido va al panel de los dueños, que lo mandan a un club con administrador o lo
  rechazan. La persona ve lo mismo en todos los casos.
- **Cada club maneja su gente**: módulos, dar de baja con el último día (ve lo
  cargado hasta ese día) y reincorporar. El administrador no toca a otro
  administrador, ni a sí mismo, ni a un dueño de la app. Sacar a alguien de un
  club no lo saca de otro.
- **Salir de un club**: cualquiera que siga activo se va desde el portal ›
  Cambiar (abajo, «Salir de» ese club, con confirmación). Ese día queda como su
  último día y sigue viendo lo cargado hasta ahí, en solo lectura, como cualquiera
  que se fue. Es el único lugar para irse.
- **Dueños de la app**: un dueño principal y sub-dueños (tablas `plataforma` y
  `plataforma_subduenos`, fuera de `perfiles`). Ven el panel «Clubes de la app»:
  de cada club solo el nombre, el correo de la entidad, el del administrador y
  cuánta gente tiene. Crean clubes (sin quedar adentro) y asignan el correo de la
  entidad. No ven la gente ni los datos de ningún club y no aceptan a nadie. Solo
  el principal suma, quita o pasa dueños. A ningún dueño (principal ni sub) lo
  saca otra persona de un club, ni le cambia los módulos: solo él se va. En
  Cuentas su fila dice «Dueño de la app» y no tiene acciones. Si el principal le
  saca el rol a un sub-dueño, pasa a ser un miembro común de sus clubes.
- Bloquear una cuenta en toda la app y borrar un club es solo por SQL. Borrar una
  cuenta es desde Supabase › Authentication › Users.
- **Flujo diario**: el token de Catapult del servidor (`OPENFIELD_API_TOKEN`) es de
  un solo club (`plataforma.catapult_equipo`, se cambia por SQL). Solo quien tiene
  Flujo diario en ese club lo usa; el resto ve «Tu club todavía no conectó
  Catapult en la app». Las pruebas técnicas son del dueño principal con Flujo
  diario en ese club.

Todo esto lo decide la base (Row Level Security y funciones que miran quién
llama), no la pantalla. Las tablas de Partido también están cerradas: cada club
ve solo lo suyo, y el rol anon no tiene permisos.

### Orden para publicar

1. Las pruebas en verde (`npm test`, `npm run build` y `npm run pruebas:base`).
2. En Supabase › SQL Editor se corre el SQL nuevo de la rama, completando los
   marcadores que pida (por ejemplo, en `20261014_duenos_y_pedidos.sql`:
   `CORREO_DEL_DUENO_PRINCIPAL`, `CORREOS_DE_SUBDUENOS` y
   `NOMBRE_DEL_CLUB_DEL_TOKEN_CATAPULT`; antes conviene correr
   `20261014_revisar_duenos.sql` para anotar los correos y el nombre exacto del
   club). Es una sola transacción: si algo no da, no cambia nada y dice qué falta.
3. Se miran las consultas del final.
4. Recién ahí se une el cambio y Vercel publica la app y el servidor juntos. La
   app nueva contra la base vieja no anda (el panel dice que falta actualizar la
   base y Flujo diario contesta 503); volver a publicar el deploy anterior sí es
   seguro.

Más detalle en [docs/AUDITORIA_2026-09-08.md](docs/AUDITORIA_2026-09-08.md).
